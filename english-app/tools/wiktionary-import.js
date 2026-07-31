#!/usr/bin/env node
/*
 * wiktionary-import.js – ממיר קובץ Wiktionary (בפורמט JSONL של kaikki.org)
 * למבנה המילים של האפליקציה, ומייצר את data/words-wiktionary.js.
 *
 * מאיפה להוריד את קובץ המקור (חד-פעמי, חינמי, רישיון CC-BY-SA):
 *   https://kaikki.org/dictionary/English/  → "Download JSON data"
 *   (הקובץ הגדול kaikki.org-dictionary-English.jsonl, או תת-קבוצה מסוננת).
 *
 * שימוש:
 *   node tools/wiktionary-import.js <path-to-kaikki.jsonl> [--limit N]
 *
 * הסקריפט:
 *   - לוקח מכל ערך: מילה באנגלית, IPA (→ תעתיק עברי), ותרגום עברי מ-translations.
 *   - מדלג על ערכים ללא תרגום עברי, ועל מילים שכבר קיימות במאגר.
 *   - מקבץ לפי חלק דיבר (שם עצם / פועל / תואר...) כ"תחומים" נפרדים.
 */
const fs = require("fs");
const path = require("path");
const ipaToHebrew = require("../js/ipa2heb.js");

// ----- טעינת המילים הקיימות כדי למנוע כפילויות -----
function loadExistingEn() {
  const g = { window: {} };
  const win = g.window;
  win.WORDS = win.WORDS || [];
  win.CATEGORIES = win.CATEGORIES || [];
  const dataDir = path.join(__dirname, "..", "data");
  ["words.js", "words-extra.js", "words-extra2.js"].forEach(f => {
    const p = path.join(dataDir, f);
    if (!fs.existsSync(p)) return;
    const code = fs.readFileSync(p, "utf8");
    // הרצה בהקשר שבו 'window' מוגדר
    new Function("window", code)(win);
  });
  return new Set((win.WORDS || []).map(w => String(w.en).toLowerCase()));
}

const POS_CAT = {
  noun:      { key: "wik_noun",  he: "מילון: שמות עצם" },
  verb:      { key: "wik_verb",  he: "מילון: פעלים" },
  adj:       { key: "wik_adj",   he: "מילון: שמות תואר" },
  adv:       { key: "wik_adv",   he: "מילון: תארי פועל" },
  name:      { key: "wik_name",  he: "מילון: שמות" }
};
const OTHER_CAT = { key: "wik_other", he: "מילון: שונות" };

function firstIpa(entry) {
  if (!Array.isArray(entry.sounds)) return "";
  for (const s of entry.sounds) if (s && s.ipa) return s.ipa;
  return "";
}
function hebrewTranslations(entry) {
  if (!Array.isArray(entry.translations)) return [];
  const out = [];
  for (const t of entry.translations) {
    if (!t || !t.word) continue;
    const code = t.code || t.lang_code;
    if (code === "he" || t.lang === "Hebrew") out.push(String(t.word).trim());
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--"));
  const limIdx = args.indexOf("--limit");
  const limit = limIdx >= 0 ? parseInt(args[limIdx + 1], 10) : Infinity;
  if (!input) {
    console.error("שימוש: node tools/wiktionary-import.js <kaikki.jsonl> [--limit N]");
    process.exit(1);
  }

  const existing = loadExistingEn();
  const seen = new Set();          // en שכבר נוספו בריצה זו
  const cats = {};                 // key -> {key,he}
  const words = [];
  let scanned = 0, added = 0, noHe = 0, dup = 0;

  const data = fs.readFileSync(input, "utf8").split(/\r?\n/);
  for (const line of data) {
    if (!line.trim()) continue;
    if (added >= limit) break;
    scanned++;
    let e;
    try { e = JSON.parse(line); } catch (_) { continue; }
    if (e.lang_code && e.lang_code !== "en") continue;
    const en = (e.word || "").trim();
    if (!en || /[^ -~'’.\- ]/.test(en)) continue;   // מילים באנגלית בלבד
    const key = en.toLowerCase();
    if (existing.has(key) || seen.has(key)) { dup++; continue; }

    const he = hebrewTranslations(e);
    if (!he.length) { noHe++; continue; }

    const ipa = firstIpa(e);
    const pron = ipa ? ipaToHebrew(ipa) : "";
    const cat = (POS_CAT[e.pos] || OTHER_CAT);
    cats[cat.key] = cat;

    words.push({
      en,
      pron: pron || "(אין תעתיק)",
      he: he.slice(0, 2).join(" / "),
      cat: cat.key
    });
    seen.add(key);
    added++;
  }

  // כתיבת קובץ הפלט
  const outCats = Object.values(cats);
  const header =
    "/*\n * words-wiktionary.js – נוצר אוטומטית ע\"י tools/wiktionary-import.js\n" +
    " * מקור: Wiktionary (kaikki.org), רישיון CC-BY-SA.\n" +
    " * התעתיק העברי מקורב (הומר מ-IPA); ההגייה הקולית נותנת את ההגייה המדויקת.\n */\n";
  const body =
    "window.CATEGORIES = (window.CATEGORIES || []).concat(" +
    JSON.stringify(outCats, null, 0) + ");\n" +
    "window.WORDS = (window.WORDS || []).concat(" +
    JSON.stringify(words) + ");\n";

  const outPath = path.join(__dirname, "..", "data", "words-wiktionary.js");
  fs.writeFileSync(outPath, header + body);

  console.log(`נסרקו ${scanned} ערכים.`);
  console.log(`נוספו ${added} מילים ב-${outCats.length} תחומים.`);
  console.log(`דולגו: ${noHe} ללא תרגום עברי, ${dup} כפולות/קיימות.`);
  console.log(`נכתב: ${outPath}`);
  console.log(`להפעלה: הוסיפו <script src="data/words-wiktionary.js"></script> ל-index.html אחרי words-extra2.js`);
}

main();
