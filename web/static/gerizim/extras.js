/* שני לוחות מידע שנפתחים מעל המפה:
   - "על המספר": מי היה המטייל שכתב את הסיפור (narrators.js, נטען רק כשמבקשים)
   - "שמות הר גריזים במסורת השומרונית": שלושה-עשר השמות שבתיבת מרקה, ועוד השם שהוסיף הכהן הגדול (mount_names.js)
   שניהם נבנים בידי tools/build_extras.py. */
(function () {
  'use strict';
  const A = window.GerizimTourAPI;
  if (!A) return;
  const esc = A.esc;
  let lang = A.lang();
  const TX = {
    he: { about: 'על המספר', close: 'סגירה', wiki: 'בוויקיפדיה ↗', story: '📖 הסיפור המלא', scene: '👁 תיאור חזותי', loading: 'טוען…', fail: 'המידע לא נטען. בדקו את החיבור לרשת ונסו שוב.',
      visit: 'ביקור', pub: 'פרסום', names: 'שמות הר גריזים במסורת השומרונית', extra: 'השם הארבעה-עשר', other: 'בלשונות אחרות', sam: 'בכתב שומרוני' },
    en: { about: 'About the narrator', close: 'Close', wiki: 'On Wikipedia ↗', story: '📖 The full story', scene: '👁 Visual description', loading: 'Loading…', fail: 'The information did not load. Check the connection and try again.',
      visit: 'visit', pub: 'published', names: 'The names of Mount Gerizim in the Samaritan tradition', extra: 'The fourteenth name', other: 'In other languages', sam: 'In Samaritan script' },
    ar: { about: 'عن الراوي', close: 'إغلاق', wiki: 'في ويكيبيديا ↗', story: '📖 القصة كاملة', scene: '👁 وصف مرئي', loading: 'جارٍ التحميل…', fail: 'لم تُحمَّل المعلومات. تحقّق من الاتصال وحاول مجددًا.',
      visit: 'الزيارة', pub: 'النشر', names: 'أسماء جبل جرزيم في التقليد السامري', extra: 'الاسم الرابع عشر', other: 'في لغات أخرى', sam: 'بالخط السامري' }
  };
  const T = k => (TX[lang] || TX.he)[k];
  const L = v => (v && typeof v === 'object') ? (v[lang] || v.he || v.en || '') : (v || '');
  const TRAVEL = window.GERIZIM_TRAVEL || [];

  /* ---------- טעינה לפי דרישה ---------- */
  const me = [...document.scripts].find(s => /(^|\/)extras\.js/.test(s.getAttribute('src') || ''));
  const VER = me ? (me.getAttribute('src').split('?')[1] || '') : '';
  const got = {};
  function load(file, key) {
    if (window[key]) return Promise.resolve(window[key]);
    if (got[file]) return got[file];
    return (got[file] = new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = file + (VER ? '?' + VER : '');
      s.onload = () => window[key] ? ok(window[key]) : bad(new Error(key));
      s.onerror = () => { delete got[file]; s.remove(); bad(new Error(file)); };
      document.head.appendChild(s);
    }));
  }

  /* ---------- הלוח ---------- */
  const box = document.createElement('div');
  box.id = 'xsheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="xin"><div class="xtop"><b id="xTitle"></b><button id="xX">✕</button></div><div id="xBody"></div></div>';
  document.body.appendChild(box);
  const $ = id => document.getElementById(id);
  let shown = null;                                   // מה מוצג עכשיו, כדי לבנות מחדש בהחלפת שפה
  function open(title) {
    box.dir = lang === 'en' ? 'ltr' : 'rtl';
    $('xTitle').textContent = title; $('xX').setAttribute('aria-label', T('close'));
    $('xBody').innerHTML = '<p class="xload">' + esc(T('loading')) + '</p>';
    box.classList.add('open');
  }
  function close() { box.classList.remove('open'); $('xBody').innerHTML = ''; shown = null; }
  $('xX').onclick = close;
  box.onclick = e => { if (e.target === box) close(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) { e.stopImmediatePropagation(); close(); } }, true);

  /* ---------- על המספר ---------- */
  function narrator(id, from) {
    shown = ['n', id, from];
    const e = TRAVEL.find(x => x.id === id);
    open(T('about'));
    load('narrators.js', 'GERIZIM_NARRATORS').then(N => {
      const d = N[id];
      if (!d) { $('xBody').innerHTML = '<p class="xload">' + esc(T('fail')) + '</p>'; return; }
      const yr = e ? (e.visit_year || e.pub_year || '') : '';
      $('xBody').innerHTML = '<h2>' + esc(e ? L(e.writer) : id) + '</h2>' +
        '<div class="xmeta">' + esc(L(d.life)) + (yr ? ' · ' + esc(T(e.visit_year ? 'visit' : 'pub')) + ' ' + esc(String(yr)) : '') + '</div>' +
        '<p class="xbio">' + esc(L(d.bio)) + '</p>' +
        '<div class="xacts">' +
        (from !== 'story' && window.GerizimLayers && GerizimLayers.hasStory(id) ? '<button data-x="story">' + esc(T('story')) + '</button>' : '') +
        (window.GerizimScenes && GerizimScenes.has(id) ? '<button data-x="scene">' + esc(T('scene')) + '</button>' : '') +
        (d.wiki ? '<a href="' + esc(d.wiki) + '" target="_blank" rel="noopener">' + esc(T('wiki')) + '</a>' : '') + '</div>';
      const b1 = $('xBody').querySelector('[data-x="story"]'), b2 = $('xBody').querySelector('[data-x="scene"]');
      const menuOff = () => { const tp = document.getElementById('tourPop'); if (tp) tp.classList.remove('open'); };
      if (b1) b1.onclick = () => { close(); menuOff(); GerizimLayers.openStory(id); };
      if (b2) b2.onclick = () => { close(); menuOff(); GerizimScenes.play(id); };
    }).catch(() => { $('xBody').innerHTML = '<p class="xload">' + esc(T('fail')) + '</p>'; });
  }

  /* ---------- שמות ההר ---------- */
  function names() {
    shown = ['m'];
    open(T('names'));
    load('mount_names.js', 'GERIZIM_MOUNT_NAMES').then(M => {
      const item = q => '<li><div class="xnh"><b>' + esc(q.name.he) + '</b><span class="xsam" title="' + esc(T('sam')) + '">' + esc(q.name.he) + '</span>' +
        (lang !== 'he' ? '<i>' + esc(L(q.name)) + '</i>' : '') + '</div>' +
        (q.verse ? '<div class="xv">' + esc(L(q.verse)) + (q.text ? ' · <span dir="rtl">' + esc(q.text) + '</span>' : '') + '</div>' : '') +
        (q.note ? '<p>' + esc(L(q.note)) + '</p>' : '') + '</li>';
      $('xBody').innerHTML = '<p class="xintro">' + esc(L(M.intro)) + '</p>' +
        '<ol class="xnames">' + M.names.map(item).join('') + '</ol>' +
        ((M.extra || []).length ? '<h3>' + esc(T('extra')) + '</h3><ol class="xnames" start="14">' + M.extra.map(item).join('') + '</ol>' : '') +
        (M.other ? '<h3>' + esc(T('other')) + '</h3><p class="xintro">' + esc(L(M.other)) + '</p>' : '') +
        (M.source ? '<p class="xsrc">' + esc(L(M.source)) + '</p>' : '');
    }).catch(() => { $('xBody').innerHTML = '<p class="xload">' + esc(T('fail')) + '</p>'; });
  }

  window.GerizimExtras = {
    narrator, names, close,
    setLang: l => { lang = l; if (!shown || !box.classList.contains('open')) return; if (shown[0] === 'n') narrator(shown[1], shown[2]); else names(); }
  };
})();
