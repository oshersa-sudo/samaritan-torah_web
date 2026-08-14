'use strict';
// Web edition of the Samaritan Torah app. Talks to the Flask API (which reuses
// the app's own query layer) and reproduces the Kivy UI's behaviour. RTL and
// line-wrapping are native to the browser, so the verse text is rendered plainly
// and only the Samaritan script needs per-glyph spans.

const $ = id => document.getElementById(id);
// cache every GET response — the DB is read-only, so results never change within
// a session. Re-navigating (books↔portions↔chapters↔verses) becomes instant.
const _apiCache = new Map();
// The service worker turns a failed PAGE load into the maintenance screen, but
// the shell can also come back from cache and only then find the API dead (the
// server went down after the app was already open). Catch that here too, so a
// deploy never leaves the reader staring at an app that silently renders nothing.
function showMaintenance(){
  if (document.getElementById('maintScreen')) return;
  const d = document.createElement('div');
  d.id = 'maintScreen';
  d.innerHTML = '<div class="maint-card">'
    + '<div class="maint-brand">אבני שהם</div><div class="maint-ico">🛠️</div>'
    + '<h1>אנו מעדכנים את המערכת</h1>'
    + '<p>אנו מעדכנים את המערכת כרגע בתיקונים ובתוספות חדשים.<br>אנא נסה שוב מאוחר יותר.</p>'
    + '<button onclick="location.reload()">נסה שוב</button></div>';
  document.body.appendChild(d);
  const t = setInterval(() => fetch('/api/admin/status', {cache:'no-store'})
    .then(r => { if (r.ok) { clearInterval(t); location.reload(); } }).catch(()=>{}), 15000);
}
// ── "the app is thinking" ────────────────────────────────────────────────────
// Every wait for data goes through api(), so the hourglass is raised there and
// nowhere else. It is held back for a moment first: a chapter that arrives in
// 60ms should not make the screen flash, and only a wait long enough to be felt
// deserves to be shown. Counted, because several requests overlap on a landing.
let _busyN = 0, _busyTimer = null;
function busyStart(){
  if(++_busyN === 1 && !_busyTimer)
    _busyTimer = setTimeout(() => { const h = $('hourglass'); if(h) h.classList.add('on'); }, 220);
}
function busyEnd(){
  if(--_busyN > 0) return;
  _busyN = 0;
  clearTimeout(_busyTimer); _busyTimer = null;
  const h = $('hourglass'); if(h) h.classList.remove('on');
}
const api = async (path) => {
  if (_apiCache.has(path)) return _apiCache.get(path);
  let res;
  busyStart();
  try {
    res = await fetch('/api/' + path);
  } catch (err) {                       // network unreachable
    busyEnd();
    if (navigator.onLine) showMaintenance();
    throw err;
  }
  if (res.status >= 500) { busyEnd(); showMaintenance(); throw new Error('server ' + res.status); }
  try {
    const data = await res.json();
    _apiCache.set(path, data);
    return data;
  } finally { busyEnd(); }
};
const apiPost = async (path, body) =>
  (await fetch('/api/' + path, {method:'POST', headers:{'Content-Type':'application/json'},
                                body:JSON.stringify(body)})).json();
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls;
                                 if(html!=null)e.innerHTML=html; return e; };

// ── visit analytics (session id + page/section pings; feeds the admin dashboard) ──
// A per-tab session id (sessionStorage — cleared when the tab closes, which is the
// right lifetime for "time spent this visit"). Never any personal data client-side;
// IP/device are read server-side from the request itself.
const _SID = (()=>{
  try{
    let s = sessionStorage.getItem('as_sid');
    if(!s){
      s = (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random().toString(36).slice(2)))
            .replace(/[^A-Za-z0-9]/g,'').slice(0,32) || 'sid'+Date.now();
      sessionStorage.setItem('as_sid', s);
    }
    return s;
  }catch(e){ return 'nosession'+Date.now(); }
})();
let _lastNavLabel = null;
function _sendTrack(label){
  try{
    const body = JSON.stringify({ sid:_SID, path:label, title:label });
    if(navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], {type:'application/json'}));
    else fetch('/api/track', {method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true}).catch(()=>{});
  }catch(e){}
}
function trackNav(label){          // call on real navigation; de-duplicates repeats
  if(!label || label===_lastNavLabel) return;
  _lastNavLabel = label;
  _sendTrack(label);
}
setInterval(()=>{ if(_lastNavLabel) _sendTrack(_lastNavLabel); }, 30000);  // heartbeat → extends duration
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden' && _lastNavLabel) _sendTrack(_lastNavLabel);
});

// ── i18n: interface translation (he / en / ar) ───────────────────────────────
const I18N = {
  he: {
    app_title:'התורה השומרונית הישראלית', brand_top:'אבני שהם', div_jewish:'חלוקה יהודית', div_sam:'חלוקה שומרונית',
    spread:'פריסת פרקים', next_portion:'‹ פרשה הבאה', prev_portion:'פרשה קודמת ›',
    next_chapter:'‹ פרק הבא', prev_chapter:'פרק קודם ›', goto_book:'עבור ל',
    share:'שתף', export_excel:'ייצוא לאקסל', no_results_xls:'אין תוצאות לייצוא',
    back:'‹ חזור', back_t:'חזור', browse:'עיון', search:'חיפוש', dict:'מילון מילים',
    font_sam:'כתב שומרוני', font_heb:'כתב עברי', interp:'פירוש הפסוק', commentary:'פרשנות יהודית',
    sam_full_q:'כולל פירושים? ', sf_yes:'כן', sf_no:'לא',
    compare:'השוואת נוסחים', variants:'חילופי נוסח', samsrc:'ממקור שומרון', translate:'תרגומי התורה',
    t_aramaic:'תרגום: ארמי', t_arabic:'תרגום: ערבי', t_english:'תרגום: אנגלית',
    search_ph:'חפש מילה', adv_search:'⚙ חיפוש מתקדם', search_help_btn:'❔ עזרה לחיפוש',
    flag_exact:'חיפוש מדויק', flag_meanings:'הצג פירוש המילים', flag_root:'לפי שורש המילה',
    flag_finals:'התעלם מסופיות', flag_aram:'חפש בתרגום הארמי', root_label:'שורש לחיפוש:',
    adv_hint:'או תוכל להשתמש ב-<b>?</b> או <b>*</b> כדי להחליף תו או מחרוזת תווים. לדוגמה: <b>א?ר</b> או <b>כא*</b>',
    apply:'אישור', menu:'תפריט', m_calendar:'חשבן קשטה — לוח השנה השומרוני',
    m_genealogy:'אילן היוחסין השומרוני המלא', m_install:'התקנת אפליקציה', m_lang:'שנה שפה',
    m_whatsnew:'מה חדש?', m_help:'עזרה למשתמש', m_version:'גרסא נוכחית', m_contact:'צור קשר',
    m_tour:'סרטון הסבר מודרך', tour_prompt_title:'סרטון הסבר מודרך',
    tour_prompt_body:'רוצים סיור קצר ומונחה שמסביר ומדגים כיצד להשתמש במערכת? אפשר תמיד לחזור אליו מהתפריט, תחת העזרה.', tour_prompt_start:'התחל הסבר',
    tour:[
      'ברוכים הבאים לתורה השומרונית הישראלית. בהדגמה קצרה זו אלווה אתכם על המסך ואסביר מה עושה כל כפתור. אפשר לדלג קדימה ואחורה, או להשתיק את הקול, בכל רגע.',
      'בראש המסך בוחרים את חלוקת התורה: החלוקה היהודית המוכרת, או החלוקה השומרונית המקורית. לחיצה כאן מחליפה ביניהן.',
      'תחילה בוחרים ספר, אחר כך פרשה, ואז פרק — וכך מגיעים אל הפסוקים.',
      'אלו פסוקי הפרק. ליד כל פסוק מספרו; לחיצה על מספר מציגה רק אותו פסוק.',
      'שימו לב לסרגל הכלים שבתחתית. הוא מתקפל אוטומטית כדי לפנות מקום לקריאה — ראיתם איך נסגר ונפתח. גררו או הקישו על הידית שבמרכזו כדי לפתוח אותו שוב בכל עת.',
      'כפתור הכתב מחליף בין הכתב העברי הרגיל לבין הכתב העברי-השומרוני העתיק.',
      'כאן בוחרים תרגום — ארמי, ערבי או אנגלי — והוא מוצג במקום הטקסט.',
      'השוואת נוסחים מציגה את נוסח שומרון מול נוסח המסורה, וגם מול תרגום השבעים, עם סימון ההבדלים.',
      'חילופי נוסח מציג את גרסאות הנוסח מכתבי-יד שונים, ממהדורת פון גאל, עם עדי-הנוסח.',
      'ממקור שומרון פותח את הפרשנות השומרונית לפסוק: תיבת מרקה, פירוש צדקה אל-חכים, המסורת השומרונית ועוד.',
      'פירוש הפסוק נפתח בפאנל שמתחת לטקסט, ובו פירוש רציף לכל פסוק הבנוי אך ורק מן המקורות השומרוניים, עם ציון שם האומר. בכותרת הפאנל אפשר להציגו בכתב שומרוני רהוט או בערבית, ובתחתיתו קישורים להרחבה: ממקור שומרון, פרשנות יהודית ומילון מילים.',
      'מילון מילים מציג לכל מילה בפסוק את תרגומה הארמי ואת פירושה מתוך המילון.',
      'סמל המדפסת שבשורת הניווט מכין את הפרק להדפסה או לשמירה כקובץ PDF. אפשר לבחור גופן, להסיר את מספרי הפסוקים, ולצרף את פירוש הפסוק, מילון המילים ותרגום — ולראות תצוגה מקדימה על המסך לפני ההדפסה.',
      'בכפתורי פרק הבא והקודם מדפדפים בין הפרקים ברצף, גם מעבר לגבולות הספר. הזכוכיות מגדילות ומקטינות את הטקסט.',
      'כעת נדגים חיפוש. נפתח את מסך החיפוש ונקליד מילה — למשל, בראשית.',
      'אלו תוצאות החיפוש. כל תוצאה מציינת את מיקום הפסוק; לחיצה עליה קופצת ישירות אל הפסוק באפליקציה.',
      'בחיפוש המתקדם אפשר לחפש לפי שורש, בתרגום הארמי, או להתעלם מסופיות. אפשר גם להשתמש בתווים כלליים: סימן שאלה לתו אחד, כוכבית למחרוזת, ופלוס לכל המילים באותו פסוק.',
      'בתפריט ההמבורגר נמצאים: התקנת האפליקציה, החלפת שפה, לוח השנה השומרוני, אילן היוחסין, מה חדש, עזרה ועוד.',
      'תחת הספרייה השומרונית נמצאים המילון הארמי-עברי, ושני ספרים מלאים לעיון: תיבת מרקה ופירוש צדקה אל-חכים.',
      'כך נראה המילון: אפשר לחפש מילה, לדפדף באינדקס או בעמודי המילון, וללחוץ על מילה כדי לראות את כל מיקומיה.',
      'בכך תם הסיור. תוכלו לחזור אליו בכל עת מתפריט ההמבורגר, תחת העזרה. קריאה נעימה ומועילה!',
    ],
    share_title:'שיתוף', email:'אימייל', close:'סגור', to_torah:'↩ התורה', to_library:'📚 לספרייה',
    copied:'הטקסט הועתק', copy_fail:'ההעתקה נכשלה', share_copy:'העתקה ללוח',
    to_aramaic:'התרגום הארמי', to_arabic:'התרגום לערבית', to_english:'התרגום לאנגלית',
    cmp_title:'בחר נוסח להשוואה', cv_masoretic:'נוסח המסורה', cv_septuagint:'תרגום השבעים', cv_onkelos:'תרגום אונקלוס', cv_qumran:'מגילות קומראן',
    ci_qumran:'מגילות מדבר יהודה (קומראן) הן כתבי-היד המקראיים העתיקים ביותר שנמצאו (מאה 3 לפנה״ס–מאה 1 לסה״נ); חלקן משקפות נוסח קרוב לשומרוני ("קדם-שומרוני"). כאן כל פסוק משוחזר מן המגילה שנשתמרה בה בצורה הטובה ביותר — מבוסס על תמלול מ׳ אבג ומיזם ETCBC (רישיון CC-BY-NC). קטעים משוחזרים נכללים, ופסוקים שלא נשתמרו מסומנים בקו מקוקו.',
    cmp_source:'נוסח שומרון', cmp_aram:'תרגום ארמי (שומרוני)',
    ci_onkelos:'תרגום אונקלוס הוא התרגום הארמי המקובל של התורה, המיוחס לאונקלוס הגר (המאה ה־2 לסה״נ). זהו תרגום מילולי-פרשני שנתקדש במסורת היהודית ונדפס לצד רוב חומשי המקרא. כאן הוא מוצג מול התרגום הארמי השומרוני, עם סימון ההבדלים ביניהם.',
    cmp_sam:'נוסח שומרון', cmp_info:'מידע על הנוסח',
    cmp_chapter_field:'מספר פרק (בנוסח ההשוואה)',
    ci_masoretic:'נוסח המסורה הוא הנוסח היהודי המקובל של המקרא, שנמסר, נוקד וטוים בידי בעלי המסורה בטבריה (סוף האלף הראשון לסה״נ). הוא הבסיס לרוב מהדורות התנ״ך הנדפסות.',
    ci_septuagint:'תרגום השבעים (LXX) הוא התרגום היווני הקדום של התורה, שנעשה באלכסנדריה במאה ה־3 לפנה״ס. הוא משקף לעיתים נוסח עברי קדום השונה מן המסורה, ובמקומות רבים קרוב דווקא לנוסח השומרוני.',
    c_name:'שם מלא', c_email:'כתובת מייל', c_msg:'הודעה (עד 100 מילים)', c_send:'שלח', c_cancel:'ביטול',
    lang_save_q:'האם ברצונך לשמור הגדרה זו?', lang_save_note:'הבחירה תישמר במכשיר זה לפעמים הבאות.',
    save_yes:'כן, שמור', save_no:'לא, רק הפעם',
    samsrc_pick:'ממקור שומרון — בחר מקור', checking_sources:'בודק מקורות זמינים…',
    no_sam_source:'אין מקור שומרוני זמין לפסוקים אלה', back_sources:'‹ מקורות',
    src_tibat:'תיבת מרקה', src_eyalk:'מן המסורת השומרונית', src_tzdaka:'פירוש צדקה אל-חכים', src_bhuq:'פירוש אם בחקותי',
    src_sir:'סוד הלבבות', src_shyt:'שו"ת — יעקב בן אהרן הכהן', src_asatir:'ספר האסאטיר',
    src_translit:'תעתיק הגייה', tr_source:'טקסט המקור', tr_translit:'תעתיק ההגייה השומרוני',
    no_translit:'אין תעתיק הגייה לפסוקים אלה',
    variants_title:'חילופי נוסח — מהדורת פון גאל',
    no_variants:'אין חילופי נוסח לפסוקים אלה.',
    app_hint:'המילים המודגשות בפסוק נושאות חילופי נוסח — לחץ על מילה כדי לקפוץ לחילופיה, ולחץ על חילוף כדי לחזור למילה.',
    dict_hint:'מילון מילים — חץ ⬆ ליד התרגום הארמי מציין שיש תוצאות נוספות. הקש על השורה לפירוש המלא, למיקומים בתורה ולצורות נוספות מתוך המילון', no_dict:'אין מילון זמין לפסוק זה',
    dict_pick_word:'👆 לחץ על מילה מודגשת כדי לראות את פירושה. לחיצה על מילה אחרת תחליף; לחיצה חוזרת על "מילון מילים" תכבה.',
    more_results:'תוצאות נוספות', phr_occurrences:'מופעים', phr_words:'מילות הצירוף', phr_head:'מטבעות לשון', phr_formula:'כינוי קבוע', phr_idiom:'ניב', sug_head:'הצעה מתוך גזירה', sug_note:'לא אומתה מול המילון, מרקה או התורה — אין הפניה לשורש', ver_by:'מאומת לפי', infl_head:'ניתוח הצורה', infl_deriv:'גזירה', infl_marqe:'לפי התרגום העברי של מימר מרקה', infl_review:'הצעה — טעונה אישור', tal_meaning:'פירוש מתוך המילון', tal_torah:'מופעים בתורה', tal_forms:'צורות וערכים נוספים', tal_page:'עמ׳', tal_none:'לא נמצא ערך עבור מילה זו במילון.', tal_click_precise:'לחץ לפירוש המדויק מתוך המילון ⬅',
    week_portion:'פרשת השבוע', week_portion_here:'פרשת השבוע — {p}',
    m_timeline:'ציר הזמן ההיסטורי השומרוני',
    m_library:'הספרייה השומרונית', m_dict_aram:'המילון הארמי-עברי ועברי-ארמי',
    lib_search_ph:'חיפוש ספר בספרייה…', lib_no_result:'לא נמצא ספר תואם',
    m_tm_book:'תיבת מרקה (מימר מרקה)', tm_title:'תיבת מרקה — מימר מרקה', tm_search_ph:'חיפוש בתוך הספר…',
    tm_toc_hint:'בחר מימר לעיון:', tm_back_toc:'‹ תוכן העניינים', tm_back_chapter:'‹ חזרה לפרק',
    tm_words_btn:'מילון מילים', tm_words_title:'מילון מילים — מתוך המילון', tm_col_root:'שורש',
    tm_no_results:'לא נמצאו תוצאות', tm_sections_n:'קטעים', tm_open_verse:'פתח את הפסוק באפליקציה',
    m_tz_book:'פירוש צדקה אל-חכים (בראשית)', tz_title:'פירוש צדקה אל-חכים — בראשית',
    tz_toc_hint:'בחר פרק לעיון:', tz_chapter_label:'פרק', tz_arabic_pending:'התרגום לערבית בהכנה — מוצג הנוסח העברי.',
    m_shyt_book:'שו"ת — יעקב בן אהרן הכהן', shyt_title:'שו"ת — יעקב בן אהרן הכהן', shyt_toc_hint:'בחר שאלה לעיון:',
    m_sir_book:'סוד הלבבות (סיר אל-קלוב)', sir_title:'סוד הלבבות — סיר אל-קלוב', sir_toc_hint:'בחר פרק לעיון:',
    m_bhuq_book:'פירוש אם בחקותי', bhuq_title:'פירוש אם בחקותי — אבו אלפרג׳ איבן אל-כתאר',
    bhuq_toc_hint:'החיבור מחולק כאן לחלקים לפי מהלך הטיעון; המספרים בסוגריים הם סעיפי המחבר. בחר חלק לעיון:',
    m_asatir_book:'ספר האסאטיר', asatir_title:'ספר האסאטיר', asatir_toc_hint:'בחר פרק לעיון:',
    asatir_note:'ספר האסאטיר — דברי הימים השומרוני מאדם ועד אחרית הימים, בתעתיק עברי.',
    m_people_book:'אישים וחוקרים שומרוניים', pp_title:'אישים וחוקרים שומרוניים',
    pp_search_ph:'חיפוש שם, תקופה או עניין…', pp_back_list:'חזרה לרשימה',
    pp_by_era:'לפי תקופה', pp_by_abc:'לפי א״ב',
    pp_empty:'בחר אישיות מן הרשימה ←', pp_no_result:'לא נמצאה אישיות תואמת',
    pp_unavailable:'היחידה עדיין אינה זמינה בשרת. נסו שוב בקרוב.',
    pp_era_bib:'תקופת המקרא', pp_era_anc:'העת העתיקה', pp_era_med:'ימי הביניים',
    pp_era_early:'ראשית העת החדשה', pp_era_mod:'העת החדשה', pp_era_unk:'תקופה לא ידועה',
    pp_source:'מקור', pp_contributor:'רשם:', pp_pron:'הגייה',
    pp_more:'הרחבה', pp_refs:'לקריאה נוספת',
    pp_wiki_open:'מורחב — הערך המלא', pp_wiki_credit:'מתוך ויקיפדיה, הערך',
    pp_wiki_lang_he:'בעברית', pp_wiki_lang_en:'באנגלית', pp_wiki_lang_ar:'בערבית',
    m_piyutim_book:'עיון בפיוטים השומרוניים', piy_title:'עיון בפיוטים השומרוניים',
    piy_back_tree:'חזרה לתוכן', piy_dict_toggle:'מילון המילים', piy_search_ph:'חיפוש חיבור, מחבר או מילה…',
    piy_empty:'בחר חיבור מתוכן העניינים ←', piy_pick_first:'בחר חיבור',
    piy_translation_he:'תרגום עברי', piy_no_dict_line:'אין ערכי מילון לשורה זו עדיין',
    piy_no_dict_entry:'אין ערך מילון עדיין',
    piy_q_verified:'✔ מאומת', piy_q_cleaned:'✎ נוקה ידנית', piy_q_raw:'⚠ OCR גולמי',
    m_rhyme_book:'מציאת חרוזים', rhyme_title:'מציאת חרוזים',
    m_composer:'✍️ חבר לי חיבור', cmp_title_h:'✍️ חבר לי חיבור', cmp_genre:'סוג', cmp_theme:'נושא / חג',
    cmp_rhyme:'קבוצת חרוז', cmp_stanzas:'מס\' בתים', cmp_lines_per_stanza:'שורות בכל בית',
    cmp_acro_text:'אקרוסטיכון בבית (רשות)', cmp_stanza:'בית', cmp_go:'חבר לי!',
    cmp_rhyme_random:'אקראית (עשירה)', cmp_cola_n:'צלעות',
    cmp_note:'המחולל מרכיב טיוטת עבודה: כל צלע לקוחה כלשונה מהקורפוס המאומת ומסודרת לפי כללי הסוגה והחרוז שנבחרו — אך החיבור בין הצלעות מכני. זהו חומר גלם לפייטן, לא פיוט גמור: ערכו, החליפו צלעות (🎲), והתאימו.',
    cmp_copy:'📋 העתק את הטיוטה', cmp_copied:'הטיוטה הועתקה — הדבק/י לליטוש אמנותי.',
    m_privatecomp:'🔒 חיבורים פרטיים', pc_title_h:'🔒 חיבורים פרטיים — אושר ששוני',
    pc_new:'✍️ חיבור חדש בעזרת AI', pc_back_list:'↩ לרשימה', pc_empty:'עדיין אין חיבורים שמורים.',
    pc_prompt:'הוראות חופשיות לחיבור', pc_go:'חבר לי!', pc_generating:'מחבר... (כולל חיפוש ברשת, עשוי לקחת רגע)',
    pc_save_title:'כותרת לשמירה', pc_save:'💾 שמור כחיבור פרטי', pc_untitled:'חיבור ללא כותרת',
    pc_duplicate:'⧉ שכפל', pc_delete:'🗑 מחק', pc_delete_q:'החיבור יימחק לצמיתות מהאתר החי. להמשיך?',
    rhy_mode_exact:'מדויק', rhy_mode_syll:'מס\' הברות זהה', rhy_mode_sound:'צליל',
    rhy_q_ph:'הקלד מילה, למשל: שבתה', rhy_or:'או', rhy_start_letter:'אות פתיחה (רשות):', rhy_start_letter_ph:'למשל: מ',
    piy_to_rhyme:'🎵 לחיפוש',
    rhy_clean_only:'רק מטקסט מוגה', rhy_search_btn:'חפש חרוזים',
    rhy_empty:'חפש מילה, סופית או צליל — ותקבל את כל המילים המתחרזות מן הקורפוס.',
    rhy_no_results:'לא נמצאו מילים מתאימות', rhy_found_n:'נמצאו {n} מילים',
    rhy_approx:'שיוך משוער {p}%', rhy_clean_n:'במוגה', rhy_no_def:'אין ערך עדיין', rhy_root_lbl:'שורש:',
    rhy_occ_n:'חיבורים', rhy_no_data:'אין נתונים',
    rhy_col_word:'מילה', rhy_col_freq:'שכיחות', rhy_col_group:'קבוצת חרוז', rhy_col_def:'תרגום (מילון)', rhy_col_occ:'היכן מופיעה',
    rd_he:'עברית', rd_ar:'ערבית', rd_aram:'ארמית', rd_show:'הצג:',
    dict_app_title:'מילון ארמי&nbsp;-&nbsp;עברי,&nbsp;עברי&nbsp;ארמי', dict_app_ph:'הקלד מילה בארמית או שורש…', dict_app_search:'חפש', dict_app_hint:'חיפוש מילה במילון הארמית של השומרונים: שורש · פירוש עברי מתוך המילון · מיקומים בתורה.', dict_app_empty:'לא נמצא ערך. נסה את שורש המילה.',
    dict_tab_search:'חיפוש', dict_tab_index:'אינדקס מילים', dict_tab_phrases:'מטבעות לשון', dict_phrases_hint:'צירופי לשון קבועים מן הפיוטים וממימר מרקה — כינויים ונוסחאות וניבים, עם התרגום העברי שמימר מרקה עצמו נותן להם. הקש על צירוף לפירושו המלא.', dict_tab_pages:'דפדוף עמודים',
    dict_index_hint:'דפדף בכל מילות המילון (לפי א״ב). הקלד אות/מילה לקפיצה. לחץ על מילה כדי לראות את מופעיה בתורה ובתיבת מרקה — באותה משמעות.', dict_index_ph:'קפוץ לאות/מילה…',
    dict_dir_aram:'ארמית ← עברית', dict_dir_he:'עברית ← ארמית', dict_he_ph:'הקלד מילה בעברית…',
    dict_he_index_hint:'דפדף במילים בעברית (לפי א״ב). לחץ על מילה כדי להגיע לפירושה הארמי.',
    dict_he_search_hint:'חפש מילה בעברית — התוצאה תוביל אל פירושה (השורש) הארמי.', dict_he_roots:'שורשים ארמיים',
    dict_word_panel_btn:'פתח פירוש מלא',
    dict_w_torah:'מופיעה בתורה', dict_w_memar:'מופיעה בתיבת מרקה', dict_w_meanings:'משמעויות',
    dict_back_index:'‹ חזרה לאינדקס', dict_back_search:'‹ חזרה לחיפוש', dict_in_torah_sec:'מופעים בתורה', dict_in_memar_sec:'מופעים בתיבת מרקה',
    dict_same_meaning:'באותה משמעות (לפי השורש)', dict_more:'נוספים', dict_no_occ:'אין מופעים במשמעות זו.',
    dict_show_occ:'↳ הצג מופעים בתורה ובתיבת מרקה',
    dict_pages_hint:'דפדף בעמודי המילון.', dict_page_label:'עמוד', dict_prev:'‹ הקודם', dict_next:'הבא ›',
    dict_in_dict:'נמצא במילון כערך:', dict_form_hint:'לחץ על צורה לקבלת כל מיקומיה במילון',
    dict_locations_title:'מיקומים במילון', dict_loc_count:'מופעים', dict_open_page:'פתח עמוד במילון',
    ob_dont:'אל תציג שוב', ob_later:'אחר כך', ob_close:'סגור', wc_read:'קראתי',
    // newest first: a reader opening "מה חדש" wants this version, not 1.0
    whatsnew_pages:[
      '<p><b>גרסה 3.3 — ציר הזמן ההיסטורי השומרוני</b></p><ul><li>בתפריט, מעל הספרייה, נוסף <b>ציר הזמן ההיסטורי השומרוני</b> — ציר אינטראקטיבי מבריאת העולם ועד ימינו, הנפתח בתוך האפליקציה וחוזר לתורה בלחיצה אחת</li><li>ארבע שכבות שאפשר לכבות ולהדליק — תולדות השומרונים, עם ישראל ויהודה, ימי המקרא, והעולם והשלטונות — ולצדן אישים וחוקרים ורצועות של נושאי משרה: הכהנים הגדולים, ראשי הממשלה והנשיאים</li><li><b>נקודת ה־0</b> היא קו קבוע שהציר חולף תחתיו, ולידה נקראות יחד השנה הגרגוריאנית, השנה לבריאת העולם, השנה לכניסה לארץ כנען, ושם הכהן הגדול שכיהן באותה שנה</li><li>חיפוש אירוע, אישיות או שנה בכל אחד משלושת המניינים; לחיצה על אירוע פותחת כרטיס עם המקור; וכפתור <b>מסע</b> מניע את הציר מאליו</li><li>תוקן: התפריט התארך עד שבטלפון נקטעו פריטיו האחרונים — מעתה הוא <b>נגלל</b> במסכים שאינם מכילים אותו, והכותרת נשארת בראשו</li></ul>',
      '<p><b>גרסה 3.2 — ההדפסה: הדף עצמו, ולא צילום של האפליקציה</b></p><ul><li>מה שיוצא מהמדפסת הוא בדיוק מה שנראה ב<b>תצוגה המקדימה</b> — הדף מוגדר פעם אחת, במידות של נייר, והתצוגה מציגה גיליון A4 אמיתי בגודל הכתב שיודפס בפועל</li><li>על הנייר עולים <b>הטקסט ופירושיו בלבד</b>: מסגרת האפליקציה, שורת ההאזנה והכפתורים אינם מודפסים — גם בהדפסה מהדפדפן עצמו</li><li>בחירת הגופן — <b>שומרוני או עברי</b> — חלה על כל הדף, הפירוש בכלל זה, וחלון ההדפסה נפתח בכתב שעל המסך</li><li><b>פירוש הפסוק</b> בא מיד מתחת לפרק שלו ו<b>מילון מילים</b> אחריו; כל אחד מהם מופרד בקו ולא ממוסגר, וגודל הכתב קבוע בכל דף ובכל מכשיר</li><li>תוקן: פרק ארוך נחתך בסוף העמוד הראשון ולא הודפס עד סופו</li><li>גם <b>יחידות הספרייה</b> נושאות מעתה סמל מדפסת, ומדפיסות על אותו גיליון: הפרק הפתוח בספר או תוכן העניינים שלו, פיוט על שורותיו (ופירושי מילותיו אם המילון פתוח), ערך של אישיות או רשימת השמות, ותוצאות המילון ומציאת החרוזים</li><li>ולשבעת השומרונים שיש להם ערך בוויקיפדיה נוסף פרק מתקפל <b>מורחב — הערך המלא</b>, ובו הערך כולו כלשונו, בשפת הממשק היכן שהוא קיים בה</li></ul>',
      '<p><b>גרסה 3.1 — אישים וחוקרים שומרוניים, ומדף ספרים חדש</b></p><ul><li><b>אישים וחוקרים שומרוניים</b> נוסף לספרייה כיחידה עצמאית: 95 דמויות — מאהרן הכהן ובאבא רבה, דרך פייטני ימי הביניים, ועד בני העדה וחוקריה במאה העשרים — ולכל אחת הסבר על מקומה במסורת</li><li>הרשימה נפרשת <b>לפי תקופה</b> או <b>לפי א״ב</b>, והחיפוש רץ גם על גוף ההסברים — כך שאפשר למצוא אישיות לפי עניין ולא רק לפי שמה</li><li>ל-23 מן האישים נוספה <b>הרחבה</b> — תאריכים, תיקונים והקשר שאין בערך עצמו — ולצדה <b>לקריאה נוספת</b>; ושמותיהם העבריים הובאו במקום הצורה הערבית היכן שהם ידועים</li><li>מדף הספרים עוצב מחדש: שם הספר כתוב על הכריכה עצמה, לכל ספר צבע משלו, והכריכות הוקטנו — כך נכנסים בשורה אחת כפליים ספרים מקודם</li></ul>',
      '<p><b>גרסה 3.0 — אבו אלפרג׳ בתוך פירוש הפסוק, והקראה רציפה</b></p><ul><li>דעתו של <b>אבו אלפרג׳</b> מובאת מתחת לפירוש כל פסוק שהוא מדבר עליו — בשמו ובציון סעיף המחבר; 654 פסוקים ב-352 פרקים שומרוניים, והחיבור כולו תורגם לערבית</li><li><b>הקראה רציפה</b>: דגל בסרגל הניגון שממשיך אל הפרק הבא בתום ההקלטה — באותו עד קריאה ובאותה מהירות — ונעצר תמיד בגמר הפרשה</li><li>סרגל הניגון צומצם לטובת הטקסט, שלושת הסימנים שבשורת הניווט הוצמדו, וסרגל מקופל מסמן את עצמו בחץ קטן מתנדנד</li></ul>',
      '<p><b>האזנה להקראת התורה</b></p><ul><li>כל פרק נפתח עם סרגל ניגון, וההקראה נשמעת מפי <b>שמונה עדי קריאה</b> מן העדה — היכן שיש לפרק יותר מעד אחד אפשר לבחור ביניהם ולהשוות ביניהם</li><li><b>מאיר בן יפנה ששוני</b> הקריא את התורה כולה לפי החלוקה השומרונית: 941 פרקים, כשבע-עשרה שעות</li><li>לצדו ארכיון עדי הקריאה ההיסטוריים — <b>פנחס אברהם כהן, רצון צדקה, עובדיה צדקה, ישראל צדקה, אברהם צדקה, אלעזר צדקה כהן ואברהם בן יששכר המרחיב</b> — כארבע-עשרה שעות, שנחתכו ל-757 קטעים כך שכל פרק שומרוני נשמע במדויק גם מתוך הקלטה שנעשתה לפי החלוקה היהודית</li><li>בורר מהירות, סימון ♪ על כל פרק שיש לו הקלטה, והקראה רציפה עד גמר הפרשה</li></ul>',
      '<p><b>מתיחת פנים לספרייה השומרונית</b></p><ul><li>הספרייה נפתחת כעת כ<b>גלריית כרטיסיות</b> על פני העמוד כולו — כריכת ספר לכל חיבור, ששמו כתוב עליה ולכל אחת צבע משלה, ושורת חיפוש שמסננת את המדף תוך כדי הקלדה</li><li>מכל קורא אפשר לחזור אל התורה או אל הספרייה בלחיצה, ובכל הספרים: תוכן עניינים, חיפוש פנימי, הגדלת טקסט וקפיצה דו-כיוונית אל הפסוק</li></ul>',
      '<p><b>הספרים שעל המדף</b></p><ul><li><b>תיבת מרקה</b> — חיבור הדרש השומרוני הקדום, בארמית ובעברית זו מול זו</li><li><b>פירוש צדקה אל-חכים</b> — פירוש רצוף לספר בראשית, בעברית ובערבית</li><li><b>פירוש אם בחקותי</b> — חיבורו ההלכתי של אבו אלפרג׳ איבן אל-כתאר בתרגום ד"ר עלי ותד: 537 קטעים ב-24 חלקים, עם 814 ציטוטי מקרא לחיצים</li><li><b>ספר האסאטיר</b> — דברי הימים השומרוני מאדם ועד אחרית הימים, שישה-עשר פרקים המקושרים לפסוקים שהם מספרים</li><li><b>סוד הלבבות (סיר אל-קלוב)</b> — חיבור מחשבה ומוסר</li><li><b>שו"ת יעקב בן אהרן הכהן</b> — שאלות ותשובות בהלכה ובמנהג העדה</li><li><b>המילון הארמי-עברי</b> — דפדוף עמודי המילון, אינדקס, וכל מיקומי המילה</li><li><b>הפיוטים השומרוניים</b> ו<b>מציאת חרוזים</b> — עיון בפיוטים לפי חלוקתם, ומציאת חרוז מדויק, שוֵוה-הברות או שוֵוה-צליל</li><li><b>אישים וחוקרים שומרוניים</b> — 95 דמויות מתקופת המקרא ועד ימינו, לפי תקופה או לפי א״ב, ולכל אחת הסבר על מקומה במסורת</li></ul>',
      '<p><b>גרסה 2.3 — פירוש אם בחקותי בספרייה</b></p><ul><li>החיבור נוסף לספרייה כיחידה עצמאית, וספר האסאטיר נכנס גם לתוך "פירוש הפסוק" — מצוטט בשמו לצד הפירוש — ותורגם לערבית במלואו</li></ul><p><b>גרסה 2.2 — ספר האסאטיר</b></p><ul><li>הספר נוסף לספרייה כיחידה עצמאית, וגם ל"ממקור שומרון": בכל פסוק שהאסאטיר מספר את מעשהו נפתח כפתור ובו הפסקה הנוגעת בדבר</li></ul><p><b>גרסה 2.1 — פירוש לכל התורה, ערבית והדפסה</b></p><ul><li>פירוש הפסוק נכתב מחדש לכל בראשית, שמות, ויקרא ובמדבר — כל נקודה בשם אומרה</li><li>הדפסה ושמירה כ-PDF עם תצוגה מקדימה; במחשב — מסך מלא</li></ul>',
      '<p><b>גרסה 2.0 — הספרייה השומרונית</b></p><ul><li>הספרייה כעמוד כרטיסיות; קריאת פיוטים ומציאת חרוזים</li><li>האזנה להקראת פרקי התורה, עם בחירת קריין</li><li>כתב שומרוני גם לפירושים, ובראשית ב-250 פרקים מדויקים</li></ul><p><b>גרסה 1.5 — העשרת מקור המסורת</b></p><ul><li>"מן המסורת השומרונית" הורחב לארבעה חומשים מתוך ספרות הפירוש של הקהילה</li></ul><p><b>גרסה 1.4 — חוויית משתמש</b></p><ul><li>מסך פתיחה, חלון "ברוכים הבאים", אנימציית הפיכת דף, ודפדוף רציף בין פרקים וספרים</li></ul>',
      '<p><b>גרסה 1.3 — חילופי נוסח והשוואות</b></p><ul><li>חילופי נוסח ממהדורת פון גאל, עם עדי-נוסח ותיאורי כתבי-יד</li><li>השוואה גם לתרגום השבעים; מחליף שפת ממשק (עברית/אנגלית/ערבית)</li></ul><p><b>גרסה 1.2 — ממקור שומרון</b></p><ul><li>תיבת מרקה, המסורת השומרונית, פירוש צדקה אל-חכים, סוד הלבבות, ספר האסאטיר</li><li>"פירוש הפסוק" — פירוש רציף רב-מקורי</li></ul><p><b>גרסה 1.1 — מילונים ושורשים</b></p><ul><li>מילון הארמית השומרונית; "מילון מילים" טבלאי לכל מילה בפסוק</li></ul><p><b>גרסה 1.0 — המהדורה הוובית</b></p><ul><li>עיון בתורה השומרונית בשתי החלוקות, כתב שומרוני, תרגומים, השוואה לנוסח המסורה, חיפוש ושיתוף</li></ul><p class="wc-sign"><b>תהנו!</b></p>',
    ],
    interp_unavail:'פונקציה זו אינה פעילה באופן זמני.',
    welcome_title:'ברוכים הבאים לפרויקט אבני שהם',
    welcome_pages:[
      '<p><b>אבני שוהם</b> הוא פרויקט שנוצר לזכרו של המנוח אבי שהם ששוני ז״ל, מתוך שאיפה אחת — לפתוח את שערי הספרייה השומרונית לכל מבקש.</p><p>במסגרתו אנו מביאים לדיגיטציה ולתרגום אוצר של ספרי הלכה, לשון ופרשנות מן <b>המדף השומרוני</b>, רובם בסיוע כלי בינה מלאכותית מתקדמים, כדי להניח את הספרייה כולה בכף ידכם. הכול בהתנדבות מלאה וללא מטרות רווח.</p><p>בין הפרויקטים שכבר ראו אור:</p><ul><li><b>חשבון קשט</b> — לוח השנה העברי-השומרוני</li><li><b>מילון ארמי–עברי</b></li><li><b>אילן היוחסין</b> המלא של העדה השומרונית</li></ul>',
      '<p>ולפניכם הפרויקט החדש — <b>התורה השומרונית הישראלית</b>: בית לעיון, ללימוד ולמחקר של נוסח התורה כפי שנשמר בעדה השומרונית ונמסר בה מדור לדור, זה אלפי שנים.</p><p>כאן תמצאו פרשנות ומקורות מן המדף השומרוני — <b>מימר מרקה</b>, המילון והתרגום הארמי, התרגום הערבי, פירוש <b>צדקה אל-חכים</b>, ספר האסאטיר, ספר החילופים ועוד — לצד חילופי נוסח מכתבי-יד שונים. בעתיד יצטרפו הצלבה עם מקורות נוספים, הקראה קולית ואופן הגייה.</p>',
      '<p>כדי שלא תחמיצו דבר, אנו ממליצים לאשר קבלת התראות על חידושים ועדכונים.</p><p>ומכיוון שאנו נעזרים בכלים אוטומטיים, ייתכן שתיתקלו פה ושם בשיבוש או בתקלה — סליחתכם עמנו, ונשמח אם תעדכנו אותנו.</p><p>את האפליקציה אפשר להתקין במכשיר, ומומלץ להתחיל מתפריט <b>☰</b> שבפינה — שם גם תוכלו להחליף שפה ולעיין במדור <b>״מה חדש״</b>.</p><p class="wc-sign"><b>קריאה נעימה ומסע מרתק בתורת שומרון!</b></p>',
    ],
    install_rec_title:'התקנת האפליקציה',
    install_rec_body:'מומלץ להתקין את האפליקציה על מסך הבית — לגישה מהירה, חוויה מלאה ושימוש גם ללא חיבור לאינטרנט.',
    install_rec_btn:'התקן עכשיו',
    notif_rec_title:'קבלת התראות',
    notif_rec_body:'אפשר התראות כדי לקבל עדכונים על חידושים, תוספות וגרסאות חדשות של האפליקציה.',
    notif_rec_btn:'אפשר התראות',
    col_word:'מילה', col_aram:'תרגום ארמי', col_heb:'פירוש עברי', col_tal:'ערך במילון', col_arabic:'ערבית', col_meliz:'המליץ',
    col_wordtrans:'תרגום המילה', col_src:'מילת המקור', col_arab:'תרגום ערבי', col_eng:'תרגום אנגלי', col_hetrans:'תרגום עברי',
    ws_tap_hint:'👆 לחץ על השורה לקבלת פירוש מורחב — כל תרגום ופירוש מהמקור שלו', ws_translation:'תרגום עברי', ws_from_targum:'מהתרגום הארמי (פירוש הפסוק)', ws_web:'פירושים מן הרשת', ws_jewish:'פרשנות יהודית', ws_samaritan:'ממקורות שומרון',
    ws_tal:'תרגום מהארמית', ws_tal_ctx:'מהארמית — לפי ההקשר בפסוק', ws_tal_gen:'מהארמית — תרגום כללי',
    ws_english:'מהתרגום האנגלי', ws_from_english:'אנגלית → עברית', ws_english_pending:'התרגום מהאנגלית בהכנה',
    ws_melitz:'מן המליץ', ws_melitz_pending:'מקור המליץ טרם נוסף', ws_torah_occ:'מופעים בתורה (ארמית)', ws_marqe_occ:'מופעים בתיבת מרקה',
    ws_arabic:'מהתרגום הערבי', ws_from_arabic:'תרגום מהערבית לעברית', ws_arabic_pending:'התרגום מהערבית לעברית בהכנה',
    searching:'מחפש…', no_interp:'פירוש אינו זמין לפסוקים אלה',
    no_interp_ar:'התרגום הערבי לפירוש עדיין בהכנה', interp_ar_pending:'[טרם תורגם] ', interp_sam:'כתב שומרוני', interp_ar:'ערבית',
    interp_more:'להרחבה פנה אל:', interp_asatir_lead:'ומספר ספר האסאטיר',
    interp_bhuq_lead:'ומדברי אבו אלפרג׳ איבן אל-כתאר בפירוש אם בחקותי',
    help_title:'עזרה למשתמש', search_help_title:'עזרה לחיפוש', install_title:'התקנת אפליקציה',
    m_admin:'כניסת מנהל', adm_user:'שם משתמש', adm_pass:'סיסמה', adm_login:'כניסה',
    adm_bad:'שם המשתמש או הסיסמה אינם נכונים.', admin_on:'מצב עריכה פעיל — לחץ על העיפרון שליד הטקסט.',
    adm_sysdoc:'📘 תיעוד המערכת', adm_loading:'טוען…', adm_version_word:'גרסה',
    adm_no_log:'אין עדיין יומן גרסאות להצגה.',
    adm_analytics:'📊 נתוני כניסה ופעילות', adm_analytics_empty:'אין עדיין נתוני ביקורים.',
    adm_analytics_hint:'שם המכשיר מבוסס על מזהה הדפדפן — דפדפנים אינם חושפים את שם הטלפון/המחשב עצמו מטעמי פרטיות.',
    adm_first:'כניסה ראשונה', adm_last:'פעילות אחרונה', adm_duration:'משך ביקור', adm_min:'ד׳', adm_sec:'שנ׳',
    wa_setup:'🔒 הפעל כניסה בטביעת אצבע', wa_login:'כניסה בטביעת אצבע', wa_ok:'הכניסה בטביעת אצבע הופעלה בהצלחה.',
    wa_err:'לא ניתן להפעיל כניסה בטביעת אצבע במכשיר זה.', wa_login_err:'האימות נכשל. נסה שוב או השתמש בסיסמה.',
    admin_dl_db:'⬇ הורד את ה-DB (לסנכרון חזרה)', admin_reseed:'טען DB מהמאגר',
    admin_reseed_q:'פעולה זו תדרוס את ה-DB החי בעותק מהמאגר (git). עריכות שלא הורדו יאבדו. להמשיך?',
    reseed_report_title:'דוח השוואה לפני טעינה', reseed_approve:'אשר וטען',
    reseed_no_diff:'לא נמצאו הבדלים בין ה-DB החי לגרסה מהמאגר. בטוח להמשיך.',
    reseed_first_seed:'אין עדיין DB חי בדיסק — זו טעינה ראשונית (אין מה להשוות).',
    reseed_books:'פרקים שומרוניים לפי ספר', reseed_added:'נוספו', reseed_removed:'הוסרו', reseed_renumbered:'שונו במספור',
    reseed_verses:'פסוקים', reseed_changed:'שונו', reseed_ch_moved:'שויכו לפרק אחר',
    reseed_loss:'⚠ תוכן שעלול להימחק (קיים בשרת החי, חסר בגרסה הנטענת)',
    reseed_audio:'⚠ קישורי הקלטות שאינם תואמים את המבנה החדש',
    adm_disk:'💾 מקום בדיסק', adm_disk_db:'קובץ ה-DB החי', adm_disk_backups:'גיבויים ישנים',
    adm_disk_free:'פנוי בדיסק', adm_disk_total:'סה״כ דיסק', adm_disk_clean:'נקה גיבויים ישנים ושחרר מקום',
    adm_disk_clean_q:'הגיבויים הישנים יימחקו מהדיסק (היסטוריית ה-git נשארת שלמה כגיבוי אמיתי). להמשיך?',
    adm_disk_cleaned:'גיבויים נמחקו ומקום שוחרר.',
    edit_title:'עריכת טקסט', edit_save:'שמור שינוי', edit_saved:'השינוי נשמר.', edit_err:'שמירה נכשלה.',
    edit_which_ver:'לאיזה נוסח לבצע את השינוי?',
    vmerge_prev:'אחד פסוק עם הקודם', vmerge_next:'אחד פסוק עם הבא',
    vmerge_pick_prev:'בחר פסוק לאיחוד עם הפסוק שמעליו', vmerge_pick_next:'בחר פסוק לאיחוד עם הפסוק שמתחתיו',
    vmerge_q:'לאחד את פסוק {a} אל תוך פסוק {b}? השניים יהיו לפסוק אחד, ומספרו {b}.',
    vmerge_ok:'פסוק {a} אוחד אל תוך פסוק {b}.', vmerge_none:'אין פסוק שכן לאיחוד בכיוון זה.',
    canon_set:'קבע קאנון לפרשה', canon_set_book:'קבע קאנון לפרשה ולספר',
    canon_set_q:'להטביע {n} פרקים כקאנון של פרשת {p}? החתימה תיחתם בשמך ובתאריך, וכל שינוי במניין יבקש מכאן ואילך את מילת האישור.',
    canon_set_q_book:'זו הפרשה האחרונה בספר: הלחיצה תטביע את מניין הפרקים של כל פרשות הספר ואת סך הפרקים בספר, כפי שהם עכשיו ({n} בפרשת {p}). להמשיך?',
    canon_set_ok:'נחתם:', canon_book_total:'סה"כ בספר:',
    canon_drift:'שים לב: כרגע {a} פרקים בפועל מול {b} החתומים.',
    admin_badge:'מצב מנהל', admin_exit_q:'האם ברצונך לצאת ממצב מנהל?', admin_off:'יצאת ממצב מנהל.',
    apk_downloads:'קובץ ההתקנה הורד', apk_last_dl:'אחרון:',
    merge_next:'אחד עם הבא', split_chapter:'פצל פרק', split_verse:'פצל פסוק',
    split_pick:'בחר את הפסוק שאחריו יחל הפרק החדש (לחץ על מספר פסוק)', split_cancel:'ביטול פיצול',
    vsplit_pick:'בחר פסוק לפיצול (לחץ על מספר פסוק)',
    vsplit_title:'פיצול פסוק', vsplit_btn:'פצל פסוק',
    vsplit_hint:'החלק הראשון יישאר במספר הפסוק הנוכחי; החלק השני יהפוך לפסוק חדש עם מקף ומספר רץ (נראה בחלוקה השומרונית בלבד).',
    vsplit_p1:'חלק ראשון — נשאר פסוק', vsplit_p2:'חלק שני — פסוק חדש',
    vsplit_err:'יש למלא את שני החלקים.', vsplit_ok:'הפסוק פוצל. הפסוק החדש:',
    cmp_act_split:'פצל (העבר חלק לפסוק הבא)', cmp_act_merge:'אחד עם הפסוק הבא',
    cmp_split_title:'פיצול טקסט ההשוואה', cmp_split_hint:'החלק הראשון יישאר בפסוק זה; החלק השני יעבור אל תחילת הטקסט בפסוק הבא — בנוסח שנבחר בלבד, השומרוני אינו משתנה.',
    cmp_split_p1:'חלק ראשון — נשאר כאן', cmp_split_p2:'חלק שני — עובר לפסוק הבא',
    cmp_split_ok:'הטקסט פוצל בין הפסוקים.',
    cmp_merge_q:'לאחד את הטקסט (בנוסח שנבחר) עם הפסוק הבא? תוכן הפסוק הבא באותו נוסח יתרוקן.',
    cmp_merge_ok:'הטקסטים אוחדו.',
    renum:'שנה מספר', renum_pick:'בחר פסוק לשינוי מספר (לחץ על מספר פסוק)',
    renum_title:'שינוי מספר פסוק', renum_cur:'מספר נוכחי:', renum_empty:'יש להזין מספר.',
    renum_cascade_q:'לשנות את כל הפסוקים הבאים בהתאם?', renum_cascade_yes:'כן, שנה את כל הבאים',
    renum_only_this:'רק פסוק זה', renum_ok:'מספר הפסוק עודכן.',
    merge_q:'לאחד את הפרק הנוכחי עם הפרק הבא? המספור בספר יתעדכן.', split_q:'לפצל את הפרק אחרי פסוק ',
    merged_ok:'הפרקים אוחדו.', split_ok:'הפרק פוצל.', confirm_yes:'אישור',
    bm_add:'הוסף סימניה לפרק זה', play_chapter:'הקראת הפרק', show_pron:'הצג הגייה (תצוגה מקדימה)', bm_my:'הסימניות שלי', bm_delete:'מחק נבחרות',
    print_ch:'הדפסת פרק', print_title:'הדפסת פרק', print_font:'גופן להדפסה', print_font_sam:'שומרוני', print_font_heb:'עברי',
    print_nonums:'הסר מספרי פסוק (רצף, כתב שומרוני בלבד)',
    print_interp:'כולל פירוש הפסוק', print_dict:'כולל מילון מילים', print_trans:'כולל תרגום',
    print_preview:'תצוגה מקדימה', print_go:'הדפס / שמור PDF',
    print_unit:'הדפסה', print_toc:'תוכן העניינים', print_nothing:'אין מה להדפיס — פתח קודם את מה שברצונך להדפיס',
    print_failed:'טעינת הדף להדפסה נכשלה',
    bm_note_ph:'הוסף הערה…', bm_max:'הגעת למקסימום של 20 סימניות.', bm_dup:'כבר קיימת סימניה לפרק זה.',
    bm_added:'סימניה נוספה.', bm_empty:'אין סימניות.', bm_del_q:'למחוק את הסימניות שנבחרו?',
  },
  en: {
    app_title:'The Israelite Samaritan Torah', brand_top:'אבני שהם', div_jewish:'Jewish division', div_sam:'Samaritan division',
    spread:'All chapters', next_portion:'Next portion ›', prev_portion:'‹ Previous portion',
    next_chapter:'Next chapter ›', prev_chapter:'‹ Previous chapter', goto_book:'Go to ',
    share:'Share', export_excel:'Export to Excel', no_results_xls:'No results to export',
    back:'‹ Back', back_t:'Back', browse:'Browse', search:'Search', dict:'Word dictionary',
    font_sam:'Samaritan script', font_heb:'Hebrew script', interp:'Verse commentary', commentary:'Jewish commentary',
    sam_full_q:'Include commentaries? ', sf_yes:'Yes', sf_no:'No',
    compare:'Compare versions', variants:'Textual variants', samsrc:'Samaritan sources', translate:'Torah translations',
    t_aramaic:'Translation: Aramaic', t_arabic:'Translation: Arabic', t_english:'Translation: English',
    search_ph:'Search a word', adv_search:'⚙ Advanced search', search_help_btn:'❔ Search help',
    flag_exact:'Exact match', flag_meanings:'Show word meanings', flag_root:'By word root',
    flag_finals:'Ignore final letters', flag_aram:'Search the Aramaic', root_label:'Root to search:',
    adv_hint:'You can use <b>?</b> or <b>*</b> to replace a letter or a string. E.g. <b>א?ר</b> or <b>כא*</b>',
    apply:'Apply', menu:'Menu', m_calendar:'Samaritan calendar (Ḥešbon Qašta)',
    m_genealogy:'Full Samaritan genealogy', m_install:'Install app', m_lang:'Change language',
    m_whatsnew:"What's new?", m_help:'Help', m_version:'Current version', m_contact:'Contact us',
    m_tour:'Guided tour', tour_prompt_title:'Guided tour',
    tour_prompt_body:'Would you like a short guided tour that explains and demonstrates how to use the app? You can always return to it from the menu, under Help.', tour_prompt_start:'Start tour',
    tour:[
      'Welcome to the Israelite Samaritan Torah. In this short walkthrough I’ll guide you on screen and explain what each button does. You can move forward and back, or mute the voice, at any time.',
      'At the top you choose the Torah’s division: the familiar Jewish division, or the original Samaritan one. Tapping here switches between them.',
      'First pick a book, then a portion, then a chapter — and you reach the verses.',
      'These are the chapter’s verses. Each verse shows its number; tapping a number shows just that verse.',
      'Notice the toolbar at the bottom. It folds away automatically to make room for reading — you just saw it close and open. Drag or tap the handle in its middle to reopen it any time.',
      'The script button switches between ordinary Hebrew and the ancient Samaritan-Hebrew script.',
      'Here you choose a translation — Aramaic, Arabic or English — shown in place of the text.',
      'Compare versions shows the Samaritan text against the Masoretic, and the Septuagint, with the differences marked.',
      'Textual variants shows readings from different manuscripts, from von Gall’s edition, with their witnesses.',
      'Samaritan sources opens the Samaritan commentary on the verse: Tibåt Mårqe, Ṣadaqah al-Ḥakīm’s commentary, the Samaritan tradition and more.',
      'Verse commentary opens a panel beneath the text with a flowing commentary on every verse, built only from the Samaritan sources and crediting each point to the source that says it. From the panel header you can render it in the fluent Samaritan script or in Arabic, and at its foot are links onward to the Samaritan sources, the Jewish commentators and the word dictionary.',
      'The word dictionary shows, for each word in the verse, its Aramaic translation and meaning from the dictionary.',
      'The printer icon in the navigation row prepares the chapter for printing or for saving as a PDF. You can choose the font, drop the verse numbers, and include the verse commentary, the word dictionary and a translation — with an on-screen preview before you print.',
      'The next and previous buttons page through the chapters continuously, even across books. The magnifiers enlarge and shrink the text.',
      'Now let’s try a search. We open the search screen and type a word — for example, Bereshit.',
      'These are the search results. Each one shows the verse’s location; tapping it jumps straight to that verse.',
      'Advanced search lets you search by root, in the Aramaic, or ignore final letters. You can also use wildcards: a question mark for one letter, an asterisk for a string, and a plus for all words in the same verse.',
      'The menu holds: install the app, change language, the Samaritan calendar, the genealogy, what’s new, help and more.',
      'Under the Samaritan Library are the Aramaic–Hebrew dictionary and two full books to read: Tibåt Mårqe and Ṣadaqah al-Ḥakīm’s commentary.',
      'This is the dictionary: you can search a word, browse the index or the pages, and tap a word to see all its locations.',
      'That’s the end of the tour. You can return to it any time from the menu, under Help. Enjoy your study!',
    ],
    share_title:'Share', email:'Email', close:'Close', to_torah:'↩ Torah', to_library:'📚 Library',
    copied:'Text copied', copy_fail:'Copy failed', share_copy:'Copy to clipboard',
    to_aramaic:'Aramaic translation', to_arabic:'Arabic translation', to_english:'English translation',
    cmp_title:'Choose a version to compare', cv_masoretic:'Masoretic Text', cv_septuagint:'Septuagint', cv_onkelos:'Targum Onkelos', cv_qumran:'Qumran Scrolls',
    ci_qumran:'The Dead Sea (Qumran) Scrolls are the oldest surviving biblical manuscripts (3rd c. BCE–1st c. CE); some reflect a text close to the Samaritan ("pre-Samaritan"). Here each verse is reconstructed from its best-preserved scroll — based on M. Abegg\'s transcriptions via the ETCBC project (CC-BY-NC). Reconstructed portions are included; unattested verses are marked with a dashed line.',
    cmp_source:'Samaritan', cmp_aram:'Aramaic (Samaritan)',
    ci_onkelos:'Targum Onkelos is the authoritative Aramaic translation of the Torah, ascribed to Onkelos the proselyte (2nd c. CE). A largely literal rendering, it became canonical in Jewish tradition and is printed alongside most Ḥumashim. Here it is shown against the Samaritan Aramaic translation, with the differences marked.',
    cmp_sam:'Samaritan', cmp_info:'About this version',
    cmp_chapter_field:'Chapter number (in the compared version)',
    ci_masoretic:'The Masoretic Text is the authoritative Jewish text of the Hebrew Bible, transmitted and vocalised by the Masoretes of Tiberias (late 1st millennium CE). It underlies most printed editions of the Bible.',
    ci_septuagint:'The Septuagint (LXX) is the ancient Greek translation of the Torah, made in Alexandria in the 3rd century BCE. It sometimes reflects an early Hebrew text differing from the Masoretic — and in many places agrees with the Samaritan.',
    c_name:'Full name', c_email:'Email address', c_msg:'Message (up to 100 words)', c_send:'Send', c_cancel:'Cancel',
    lang_save_q:'Save this language preference?', lang_save_note:'It will be saved on this device for next time.',
    save_yes:'Yes, save', save_no:'No, just now',
    samsrc_pick:'Samaritan sources — choose a source', checking_sources:'Checking available sources…',
    no_sam_source:'No Samaritan source for these verses', back_sources:'‹ Sources',
    src_tibat:'Tībåt Mårqe', src_eyalk:'From the Samaritan tradition', src_tzdaka:"Ṣadaqah al-Ḥakīm's commentary", src_bhuq:'Commentary on Im Beḥuqotay',
    src_sir:'Sīr al-Qulūb (Secret of Hearts)', src_shyt:'Responsa of Jacob ben Aaron', src_asatir:'The Book of Asatir',
    src_translit:'Pronunciation transcription', tr_source:'Source text', tr_translit:'Samaritan pronunciation',
    no_translit:'No pronunciation transcription for these verses',
    variants_title:'Textual variants — von Gall edition',
    no_variants:"No textual variants for these verses.",
    app_hint:'The emphasised words in the verse carry textual variants — tap a word to jump to its variants, and tap a variant to jump back to the word.',
    dict_hint:"Word dictionary — a ⬆ arrow beside the Aramaic marks further results. Tap a row for the full entry, Torah occurrences and related forms from the dictionary", no_dict:'No dictionary for this verse',
    dict_pick_word:'👆 Tap an underlined word to see its entry. Tap another to swap it; tap “Word dictionary” again to turn off.',
    more_results:'More results', phr_occurrences:'occurrences', phr_words:'Words of the phrase', phr_head:'Set phrases', phr_formula:'fixed epithet', phr_idiom:'idiom', sug_head:'Suggested by derivation', sug_note:'not confirmed against the dictionary, Marqe or the Torah — no root is offered', ver_by:'confirmed by', infl_head:'Form analysis', infl_deriv:'Derivation', infl_marqe:'per Memar Marqe’s own Hebrew translation', infl_review:'proposal — needs confirmation', tal_meaning:'Meaning from the dictionary', tal_torah:'Occurrences in the Torah', tal_forms:'Further forms & entries', tal_page:'p.', tal_none:'No entry found for this word in the dictionary.', tal_click_precise:'Tap for the exact entry from the dictionary ⬅',
    week_portion:'This week’s portion', week_portion_here:'The portion of this week — {p}',
    m_timeline:'The Samaritan Historical Timeline',
    m_library:'The Samaritan Library', m_dict_aram:'The Aramaic–Hebrew & Hebrew–Aramaic Dictionary',
    lib_search_ph:'Search for a book…', lib_no_result:'No matching book',
    m_tm_book:'Tibåt Mårqe (Memar Marqah)', tm_title:'Tibåt Mårqe — Memar Marqah', tm_search_ph:'Search within the book…',
    tm_toc_hint:'Choose a Memar to read:', tm_back_toc:'‹ Contents', tm_back_chapter:'‹ Back to the chapter',
    tm_words_btn:'Word glossary', tm_words_title:'Word glossary — from the dictionary', tm_col_root:'Root',
    tm_no_results:'No results found', tm_sections_n:'sections', tm_open_verse:'Open the verse in the app',
    m_tz_book:'Ṣadaqah al-Ḥakīm (Genesis)', tz_title:'Ṣadaqah al-Ḥakīm — Genesis',
    tz_toc_hint:'Choose a chapter:', tz_chapter_label:'Chapter', tz_arabic_pending:'The Arabic is being prepared — showing the Hebrew.',
    m_shyt_book:'Responsa of Jacob ben Aaron', shyt_title:'Responsa — Jacob ben Aaron the Priest', shyt_toc_hint:'Choose a question:',
    m_sir_book:'Sīr al-Qulūb (Secret of Hearts)', sir_title:'Sīr al-Qulūb — The Secret of Hearts', sir_toc_hint:'Choose a section:',
    m_bhuq_book:'Commentary on Im Beḥuqotay', bhuq_title:'Im Beḥuqotay — Abū l-Faraj ibn al-Kathār',
    bhuq_toc_hint:'The treatise is divided here by the turns of its argument; the bracketed numbers are the author’s own paragraphs. Choose a part:',
    m_asatir_book:'The Book of Asatir', asatir_title:'The Book of Asatir', asatir_toc_hint:'Choose a chapter:',
    asatir_note:'The Book of Asatir — the Samaritan chronicle from Adam to the end of days, in Hebrew transcription.',
    m_people_book:'Samaritan Figures and Scholars', pp_title:'Samaritan Figures and Scholars',
    pp_search_ph:'Search a name, period or subject…', pp_back_list:'‹ Back to the list',
    pp_by_era:'By period', pp_by_abc:'A–Z',
    pp_empty:'Choose a figure from the list →', pp_no_result:'No matching figure',
    pp_unavailable:'This unit is not available on the server yet. Please try again soon.',
    pp_era_bib:'Biblical era', pp_era_anc:'Antiquity', pp_era_med:'The Middle Ages',
    pp_era_early:'Early modern period', pp_era_mod:'Modern era', pp_era_unk:'Period unknown',
    pp_source:'Source', pp_contributor:'contributed by', pp_pron:'pron.',
    pp_more:'Further detail', pp_refs:'Further reading',
    pp_wiki_open:'Expanded — the full article', pp_wiki_credit:'From Wikipedia, the article',
    pp_wiki_lang_he:'in Hebrew', pp_wiki_lang_en:'in English', pp_wiki_lang_ar:'in Arabic',
    m_piyutim_book:'Samaritan Piyyutim', piy_title:'Samaritan Piyyutim',
    piy_back_tree:'Back to contents', piy_dict_toggle:'Word dictionary', piy_search_ph:'Search composition, author, or word…',
    piy_empty:'Choose a composition from the contents ←', piy_pick_first:'Choose a composition',
    piy_translation_he:'Hebrew translation', piy_no_dict_line:'No dictionary entries for this line yet',
    piy_no_dict_entry:'No dictionary entry yet',
    piy_q_verified:'✔ Verified', piy_q_cleaned:'✎ Manually cleaned', piy_q_raw:'⚠ Raw OCR',
    m_rhyme_book:'Rhyme Finder', rhyme_title:'Rhyme Finder',
    m_composer:'✍️ Compose a piyyut', cmp_title_h:'✍️ Compose a piyyut', cmp_genre:'Genre', cmp_theme:'Theme / Festival',
    cmp_rhyme:'Rhyme group', cmp_stanzas:'Stanzas', cmp_lines_per_stanza:'Lines per stanza',
    cmp_acro_text:'Acrostic per stanza (optional)', cmp_stanza:'Stanza', cmp_go:'Compose!',
    cmp_rhyme_random:'Random (rich)', cmp_cola_n:'half-lines',
    cmp_note:'The generator assembles a WORKING DRAFT: every half-line is taken verbatim from the verified corpus and arranged per the chosen genre and rhyme — but the join between half-lines is mechanical. This is raw material for a paytan, not a finished piyyut: edit, swap half-lines (🎲), and adapt.',
    cmp_copy:'📋 Copy the draft', cmp_copied:'Draft copied — paste it for artistic polishing.',
    m_privatecomp:'🔒 Private compositions', pc_title_h:'🔒 Private Compositions — Osher Sassoni',
    pc_new:'✍️ New AI-assisted composition', pc_back_list:'↩ Back to list', pc_empty:'No saved compositions yet.',
    pc_prompt:'Free-text instructions', pc_go:'Compose!', pc_generating:'Composing... (may search the web, can take a moment)',
    pc_save_title:'Title to save as', pc_save:'💾 Save as private composition', pc_untitled:'Untitled composition',
    pc_duplicate:'⧉ Duplicate', pc_delete:'🗑 Delete', pc_delete_q:'This composition will be permanently deleted from the live site. Continue?',
    rhy_mode_exact:'Exact', rhy_mode_syll:'Same syllable count', rhy_mode_sound:'Sound',
    rhy_q_ph:'Type a word, e.g. שבתה', rhy_or:'or', rhy_start_letter:'Starting letter (optional):', rhy_start_letter_ph:'e.g. מ',
    piy_to_rhyme:'🎵 To search',
    rhy_clean_only:'Verified text only', rhy_search_btn:'Find rhymes',
    rhy_empty:'Search a word, suffix, or sound — get every rhyming word in the corpus.',
    rhy_no_results:'No matching words found', rhy_found_n:'{n} words found',
    rhy_approx:'~{p}% match', rhy_clean_n:'verified', rhy_no_def:'No entry yet', rhy_root_lbl:'root:',
    rhy_occ_n:'compositions', rhy_no_data:'No data',
    rhy_col_word:'Word', rhy_col_freq:'Frequency', rhy_col_group:'Rhyme group', rhy_col_def:'Gloss', rhy_col_occ:'Where it appears',
    rd_he:'Hebrew', rd_ar:'Arabic', rd_aram:'Aramaic', rd_show:'Show:',
    dict_app_title:'Aramaic&nbsp;-&nbsp;Hebrew,&nbsp;Hebrew&nbsp;-&nbsp;Aramaic Dictionary', dict_app_ph:'Type an Aramaic word or root…', dict_app_search:'Search', dict_app_hint:'Search the Dictionary of Samaritan Aramaic: root · Hebrew meaning from the dictionary · Torah occurrences.', dict_app_empty:'No entry found. Try the word\'s root.',
    dict_tab_search:'Search', dict_tab_index:'Word index', dict_tab_phrases:'Set phrases', dict_phrases_hint:'Fixed Aramaic phrases from the piyyutim and Memar Marqe — epithets, formulas and idioms, with the Hebrew that Memar Marqe’s own translation gives them. Tap one for its full entry.', dict_tab_pages:'Browse pages',
    dict_index_hint:'Browse every word in the dictionary (A–Z). Type a letter/word to jump. Tap a word to see where it occurs in the Torah and in Tībåt Mårqe — in the same meaning.', dict_index_ph:'Jump to a letter/word…',
    dict_dir_aram:'Aramaic → Hebrew', dict_dir_he:'Hebrew → Aramaic', dict_he_ph:'Type a Hebrew word…',
    dict_he_index_hint:'Browse the Hebrew words (A–Z). Tap a word to reach its Aramaic entry.',
    dict_he_search_hint:'Search a Hebrew word — the result leads to its Aramaic (root) entry.', dict_he_roots:'Aramaic roots',
    dict_word_panel_btn:'Open full entry',
    dict_w_torah:'Occurs in the Torah', dict_w_memar:'Occurs in Tībåt Mårqe', dict_w_meanings:'meanings',
    dict_back_index:'‹ Back to the index', dict_back_search:'‹ Back to search', dict_in_torah_sec:'Occurrences in the Torah', dict_in_memar_sec:'Occurrences in Tībåt Mårqe',
    dict_same_meaning:'in the same meaning (by root)', dict_more:'more', dict_no_occ:'No occurrences in this meaning.',
    dict_show_occ:'↳ Show occurrences in the Torah & Tībåt Mårqe',
    dict_pages_hint:'Browse the dictionary pages.', dict_page_label:'Page', dict_prev:'‹ Prev', dict_next:'Next ›',
    dict_in_dict:'Found in the dictionary as a head-word:', dict_form_hint:'Tap a form for all its locations in the dictionary',
    dict_locations_title:'Locations in the dictionary', dict_loc_count:'occurrences', dict_open_page:'Open the dictionary page',
    ob_dont:'Don\'t show again', ob_later:'Later', ob_close:'Close', wc_read:'I have read',
    // newest first: a reader opening "What's new" wants this version, not 1.0
    whatsnew_pages:[
      '<p><b>Version 3.3 — The Samaritan Historical Timeline</b></p><ul><li>The menu gains <b>The Samaritan Historical Timeline</b>, above the library: an interactive axis from the creation of the world to our own day, opening inside the app and returning to the Torah with one tap</li><li>Four layers you can switch on and off — Samaritan history, Israel and Judah, the biblical age, and the world and its rulers — beside figures and scholars, and bands of office-holders: the high priests, the prime ministers and the presidents</li><li>The <b>zero point</b> is a fixed line the timeline passes beneath, reading out together the Gregorian year, the year from the creation of the world, the year from the entry into Canaan, and the high priest of that year</li><li>Search an event, a person or a year in any of the three reckonings; tap an event for a card with its source; and <b>Journey</b> sets the timeline moving on its own</li><li>Fixed: the menu had grown until its last entries were cut off on a phone — it now <b>scrolls</b> on screens too short to hold it, with the title staying at its head</li></ul>',
      '<p><b>Version 3.2 — Printing: the sheet itself, not a photograph of the app</b></p><ul><li>What comes out of the printer is exactly what the <b>preview</b> showed — the page is defined once, in paper measures, and the preview draws a real A4 sheet at the type size that will actually be printed</li><li>Only <b>the text and its commentaries</b> reach the paper: the app frame, the reading bar and the buttons are never printed — not even from the browser\'s own print command</li><li>The font choice — <b>Samaritan or Hebrew</b> — governs the whole sheet, the commentary included, and the dialog opens on the script that is on the screen</li><li>The <b>verse commentary</b> comes directly beneath its chapter and the <b>word dictionary</b> after it; each is set off by a rule rather than boxed, and the type size is fixed on every page and every device</li><li>Fixed: a long chapter was cut off at the end of the first page instead of printing in full</li><li>The <b>library units</b> now carry a printer of their own, onto the same sheet: a book\'s open chapter or its contents, a piyyut with its lines (and its word glosses if the dictionary is open), a figure\'s entry or the list of names, and the results of the dictionary and the rhyme finder</li><li>The seven Samaritan figures who have a Wikipedia article carry a folded <b>Expanded — the full article</b> panel holding it whole, in the interface language wherever it exists there</li></ul>',
      '<p><b>Version 3.1 — Samaritan Figures and Scholars, and a new bookshelf</b></p><ul><li><b>Samaritan Figures and Scholars</b> joins the library as a unit of its own: 95 figures — from Aaron the priest and Baba Rabba, through the medieval poets, to community members and scholars of the twentieth century — each with an account of its place in the tradition</li><li>The list can be laid out <b>by period</b> or <b>A–Z</b>, and the search runs over the accounts themselves, so a figure can be found by subject and not only by name</li><li>23 of the figures carry <b>further detail</b> — dates, corrections and context the entry itself lacks — and a <b>further reading</b> list beside it; and their Hebrew names now lead where those are known</li><li>The bookshelf was redrawn: each title is written on its own cover, every book has its own colour, and the covers are smaller — so a row now holds twice as many books as before</li></ul>',
      '<p><b>Version 3.0 — Abu\'l-Faraj inside the verse commentary, and continuous reading</b></p><ul><li><b>Abu\'l-Faraj</b>\'s view is now set beneath the commentary on every verse he speaks about, in his name and with the author\'s section number: 654 verses across 352 Samaritan chapters, the whole work rendered in Arabic too</li><li><b>Continuous reading</b>: a flag on the play bar that carries on into the next chapter when a recording ends — same reading witness, same speed — and always stops at the end of the parasha</li><li>The play bar was slimmed down for the sake of the text, the three chapter signs were drawn together, and a folded bar now marks itself with a small bobbing arrow</li></ul>',
      '<p><b>Listening to the Torah read aloud</b></p><ul><li>Every chapter opens with a play bar, and the reading is heard from <b>eight reading witnesses</b> of the community — where a chapter has more than one, you can choose between them and compare</li><li><b>Meir ben Yefune Sassoni</b> recited the whole Torah in the Samaritan division: 941 chapters, some seventeen hours</li><li>Beside him an archive of historical witnesses — <b>Pinhas Abraham Cohen, Ratson Tsedaka, Ovadya Tsedaka, Israel Tsedaka, Abraham Tsedaka, Elazar Tsedaka Cohen and Abraham ben Yissachar</b> — some fourteen hours, cut into 757 segments so that every Samaritan chapter can be heard exactly, even from a recording made by the Jewish division</li><li>A speed selector, a ♪ mark on every chapter that has a recording, and continuous reading to the end of the parasha</li></ul>',
      '<p><b>A facelift for the Samaritan Library</b></p><ul><li>The library now opens as a <b>gallery of cards</b> across the whole page — a book cover for every work, each with its title written on it and a colour of its own, and a search box that filters the shelf as you type</li><li>From any reader you return to the Torah or to the shelf in one tap, and every book has contents, in-book search, text zoom and a two-way jump to the verse</li></ul>',
      '<p><b>The books on the shelf</b></p><ul><li><b>Tībåt Mårqe</b> — the early Samaritan homiletic work, Aramaic and Hebrew side by side</li><li><b>Ṣadaqah al-Ḥakīm</b> — a running commentary on Genesis, in Hebrew and Arabic</li><li><b>Im Bəḥuqqotay</b> — Abu\'l-Faraj ibn al-Kathār\'s halakhic work in Dr. Ali Watad\'s translation: 537 passages in 24 parts, with 814 tappable biblical citations</li><li><b>The Book of Asatir</b> — the Samaritan chronicle from Adam to the end of days, sixteen chapters linked to the verses they retell</li><li><b>Sīr al-Qulūb</b> — a work of thought and ethics</li><li><b>The responsa of Jacob ben Aaron the Priest</b> — questions and answers on law and custom</li><li><b>The Aramaic–Hebrew dictionary</b> — page browsing, an index, and every location of a word</li><li><b>The Samaritan piyyutim</b> and a <b>rhyme finder</b> — by exact rhyme, equal syllable count or sound</li><li><b>Samaritan Figures and Scholars</b> — 95 figures from the biblical era to our own day, by period or A–Z, each with an account of its place in the tradition</li></ul>',
      '<p><b>Version 2.3 — Im Bəḥuqqotay in the library</b></p><ul><li>The work joined the library as a unit of its own, and the Book of Asatir entered the verse commentary — quoted in its own name — and was translated into Arabic in full</li></ul><p><b>Version 2.2 — the Book of Asatir</b></p><ul><li>The book joined the library, and the Samaritan sources too: on every verse it recounts, a button opens the passage in question</li></ul><p><b>Version 2.1 — commentary for the whole Torah, Arabic and printing</b></p><ul><li>The verse commentary was rewritten for Genesis, Exodus, Leviticus and Numbers — every point credited to its source</li><li>Printing and PDF with an on-screen preview; on desktop the app fills the screen</li></ul>',
      '<p><b>Version 2.0 — the Samaritan library</b></p><ul><li>The library as a card gallery; a piyyutim reader and a rhyme finder</li><li>Listen to the Torah read aloud, with a choice of reader</li><li>Samaritan script for the commentaries too, and Genesis in an exact 250 chapters</li></ul><p><b>v1.5 — the Samaritan Library</b></p><ul><li>Full-book readers with contents, search and verse jumps; the Aramaic dictionary upgraded</li></ul><p><b>v1.4 — user experience</b></p><ul><li>Entry splash, a Welcome screen, a page-turn animation, continuous chapter & book paging</li></ul>',
      '<p><b>v1.3 — textual variants & comparisons</b></p><ul><li>von Gall\'s variants, with witnesses and manuscript descriptions</li><li>Comparison to the Septuagint; UI language switcher (he/en/ar)</li></ul><p><b>v1.2 — Samaritan sources</b></p><ul><li>Tībåt Mårqe, the Samaritan tradition, Ṣadaqah al-Ḥakīm, Sīr al-Qulūb, the Book of Asatir</li><li>“Verse commentary” — a continuous, multi-source reading</li></ul><p><b>v1.1 — dictionaries & roots</b></p><ul><li>The Samaritan Aramaic dictionary; a per-word table for every word in a verse</li></ul><p><b>v1.0 — the web edition</b></p><ul><li>The Samaritan Torah in both divisions, Samaritan script, translations, comparison to the Masorah, search and sharing</li></ul><p class="wc-sign"><b>Enjoy!</b></p>',
    ],
    interp_unavail:'This feature is temporarily unavailable.',
    welcome_title:'Welcome to the Avnei Shoham project',
    welcome_pages:[
      '<p><b>Avnei Shoham</b> is a project created in memory of the late Avi Shoham Sassoni, with a single aspiration — to open the gates of the Samaritan library to everyone who seeks it.</p><p>Within it we digitise and translate a treasury of works on law, language and commentary from the <b>Samaritan shelf</b>, most of them with the help of advanced AI tools, so that the whole library may rest in the palm of your hand. All of it is entirely voluntary and non-profit.</p><p>Among the projects already released:</p><ul><li><b>Ḥeshbon Qesheṭ</b> — the Samaritan-Hebrew calendar</li><li>an <b>Aramaic–Hebrew dictionary</b></li><li>the complete <b>genealogy</b> of the Samaritan community</li></ul>',
      '<p>And here is the new one — <b>the Israelite Samaritan Torah</b>: a home for reading, studying and researching the text of the Torah as it has been kept by the Samaritan community and handed down within it, generation to generation, for thousands of years.</p><p>Here you will find commentary and sources from the Samaritan shelf — <b>Tībåt Mårqe</b>, the Aramaic dictionary and translation, the Arabic translation, <b>Ṣadaqah al-Ḥakīm</b>’s commentary, the Book of Asatir, the Book of Variants and more — alongside textual variants from different manuscripts. Cross-referencing with further sources, audio recitation and pronunciation are yet to come.</p>',
      '<p>So you won’t miss a thing, we recommend allowing notifications about new features and updates.</p><p>And since we rely on automated tools, you may meet the occasional glitch or stray error here and there — our apologies, and we’d be grateful if you let us know.</p><p>The app can be installed on your device, and it’s best to begin from the <b>☰</b> menu in the corner — where you can also switch language and browse <b>“What’s new”</b>.</p><p class="wc-sign"><b>A pleasant read, and a fascinating journey through the Samaritan Torah!</b></p>',
    ],
    install_rec_title:'Install the app',
    install_rec_body:'We recommend installing the app to your home screen — for quick access, the full experience, and offline use.',
    install_rec_btn:'Install now',
    notif_rec_title:'Enable notifications',
    notif_rec_body:'Allow notifications to get updates about new features, additions and new versions of the app.',
    notif_rec_btn:'Enable notifications',
    col_word:'Word', col_aram:'Aramaic', col_heb:'Hebrew meaning', col_tal:'Dictionary entry', col_arabic:'Arabic', col_meliz:'HaMeliṣ',
    col_wordtrans:'Word translation', col_src:'Source word', col_arab:'Arabic', col_eng:'English', col_hetrans:'Hebrew translation',
    ws_tap_hint:'👆 Tap the row for an expanded interpretation — every translation from its source', ws_translation:'Hebrew translation', ws_from_targum:'from the Aramaic Targum (verse reading)', ws_web:'web dictionaries', ws_jewish:'Jewish commentary', ws_samaritan:'from Samaritan sources',
    ws_tal:'from the Aramaic', ws_tal_ctx:'from the Aramaic — by the verse context', ws_tal_gen:'from the Aramaic — general gloss',
    ws_english:'from the English', ws_from_english:'English → Hebrew', ws_english_pending:'English translation in preparation',
    ws_melitz:'from the Meliṣ', ws_melitz_pending:'the Meliṣ source is not yet added', ws_torah_occ:'occurrences in the Torah (Aramaic)', ws_marqe_occ:'occurrences in Tībåt Mårqe',
    ws_arabic:'from the Arabic', ws_from_arabic:'Arabic → Hebrew', ws_arabic_pending:'Arabic→Hebrew translation in preparation',
    searching:'Searching…', no_interp:'No commentary for these verses',
    no_interp_ar:'The Arabic rendering is still being prepared', interp_ar_pending:'[not yet translated] ', interp_sam:'Samaritan script', interp_ar:'Arabic',
    interp_more:'Read further in:', interp_asatir_lead:'And the Book of Asatir recounts',
    interp_bhuq_lead:'And Abū l-Faraj ibn al-Kathār says, in his commentary on Im Beḥuqotay',
    help_title:'Help', search_help_title:'Search help', install_title:'Install app',
    m_admin:'Admin login', adm_user:'Username', adm_pass:'Password', adm_login:'Sign in',
    adm_bad:'The username or password is incorrect.', admin_on:'Edit mode is on — click the pencil next to a text.',
    adm_sysdoc:'📘 System documentation', adm_loading:'Loading…', adm_version_word:'version',
    adm_no_log:'No changelog to show yet.',
    adm_analytics:'📊 Visitor login & activity', adm_analytics_empty:'No visit data yet.',
    adm_analytics_hint:'The "device" name is guessed from the browser\'s user-agent — browsers don\'t expose the actual phone/computer name, for privacy reasons.',
    adm_first:'First seen', adm_last:'Last active', adm_duration:'Time on site', adm_min:'m', adm_sec:'s',
    wa_setup:'🔒 Enable fingerprint sign-in', wa_login:'Sign in with fingerprint', wa_ok:'Fingerprint sign-in enabled successfully.',
    wa_err:'Fingerprint sign-in isn\'t available on this device.', wa_login_err:'Authentication failed. Try again or use the password.',
    admin_dl_db:'⬇ Download the DB (to sync back)', admin_reseed:'Load DB from repo',
    admin_reseed_q:'This overwrites the live DB with the repo (git) copy. Un-downloaded edits will be lost. Continue?',
    reseed_report_title:'Diff report before loading', reseed_approve:'Approve and load',
    reseed_no_diff:'No differences found between the live DB and the repo copy. Safe to proceed.',
    reseed_first_seed:'There is no live DB on disk yet — this is the initial seed (nothing to compare).',
    reseed_books:'Samaritan chapters by book', reseed_added:'added', reseed_removed:'removed', reseed_renumbered:'renumbered',
    reseed_verses:'Verses', reseed_changed:'changed', reseed_ch_moved:'moved to another chapter',
    reseed_loss:'⚠ Content that may be lost (exists on the live server, missing in the incoming version)',
    reseed_audio:'⚠ Recording links that no longer match the new structure',
    adm_disk:'💾 Disk space', adm_disk_db:'Live DB file', adm_disk_backups:'Old backups',
    adm_disk_free:'Free on disk', adm_disk_total:'Total disk', adm_disk_clean:'Clean old backups and free space',
    adm_disk_clean_q:'Old backups on disk will be deleted (git history remains the real backup). Continue?',
    adm_disk_cleaned:'Backups deleted and space freed.',
    edit_title:'Edit text', edit_save:'Save change', edit_saved:'Saved.', edit_err:'Save failed.',
    edit_which_ver:'Which version do you want to edit?',
    vmerge_prev:'Merge verse with previous', vmerge_next:'Merge verse with next',
    vmerge_pick_prev:'Pick a verse to merge into the one above it', vmerge_pick_next:'Pick a verse to merge with the one below it',
    vmerge_q:'Merge verse {a} into verse {b}? The two become one, numbered {b}.',
    vmerge_ok:'Verse {a} was merged into verse {b}.', vmerge_none:'There is no neighbouring verse in that direction.',
    canon_set:'Engrave the canon of this portion', canon_set_book:'Engrave the canon: portion and book',
    canon_set_q:'Engrave {n} chapters as the canon of portion {p}? It is signed and dated in your name, and from then on any change to the count asks for the confirmation phrase.',
    canon_set_q_book:'This is the last portion of the book: this engraves the chapter count of every portion of the book and its own total, as they now stand ({n} in {p}). Continue?',
    canon_set_ok:'Engraved:', canon_book_total:'Book total:',
    canon_drift:'Note: {a} chapters at present against {b} engraved.',
    admin_badge:'Admin mode', admin_exit_q:'Leave admin mode?', admin_off:'You have left admin mode.',
    apk_downloads:'Install file downloaded', apk_last_dl:'last:',
    merge_next:'Merge with next', split_chapter:'Split chapter', split_verse:'Split verse',
    split_pick:'Choose the verse after which the new chapter starts (tap a verse number)', split_cancel:'Cancel split',
    vsplit_pick:'Choose a verse to split (tap a verse number)',
    vsplit_title:'Split verse', vsplit_btn:'Split verse',
    vsplit_hint:'The first part keeps the current verse number; the second becomes a new verse with a hyphen and running number (shown in the Samaritan division only).',
    vsplit_p1:'First part — stays verse', vsplit_p2:'Second part — new verse',
    vsplit_err:'Both parts are required.', vsplit_ok:'Verse split. New verse:',
    cmp_act_split:'Split (move part to next verse)', cmp_act_merge:'Merge with next verse',
    cmp_split_title:'Split comparison text', cmp_split_hint:'The first part stays on this verse; the second moves to the start of the next verse’s text — only for the chosen version, the Samaritan text is unaffected.',
    cmp_split_p1:'First part — stays here', cmp_split_p2:'Second part — moves to next verse',
    cmp_split_ok:'Text split between the verses.',
    cmp_merge_q:'Merge this text (in the chosen version) with the next verse? The next verse’s text in that version will be cleared.',
    cmp_merge_ok:'Texts merged.',
    renum:'Change number', renum_pick:'Choose a verse to renumber (tap a verse number)',
    renum_title:'Change verse number', renum_cur:'Current number:', renum_empty:'Enter a number.',
    renum_cascade_q:'Renumber all following verses accordingly?', renum_cascade_yes:'Yes, all following',
    renum_only_this:'Only this verse', renum_ok:'Verse number updated.',
    merge_q:'Merge the current chapter with the next? The book numbering will update.', split_q:'Split the chapter after verse ',
    merged_ok:'Chapters merged.', split_ok:'Chapter split.', confirm_yes:'Confirm',
    bm_add:'Bookmark this chapter', play_chapter:'Read the chapter aloud', show_pron:'Show pronunciation (preview)', bm_my:'My bookmarks', bm_delete:'Delete selected',
    print_ch:'Print chapter', print_title:'Print chapter', print_font:'Print font', print_font_sam:'Samaritan', print_font_heb:'Hebrew',
    print_nonums:'Remove verse numbers (continuous, Samaritan script only)',
    print_interp:'Include verse commentary', print_dict:'Include word dictionary', print_trans:'Include translation',
    print_preview:'Preview', print_go:'Print / Save as PDF',
    print_unit:'Print', print_toc:'Contents', print_nothing:'Nothing to print — open what you want printed first',
    print_failed:'The page could not be loaded for printing',
    bm_note_ph:'Add a note…', bm_max:'You have reached the maximum of 20 bookmarks.', bm_dup:'This chapter is already bookmarked.',
    bm_added:'Bookmark added.', bm_empty:'No bookmarks.', bm_del_q:'Delete the selected bookmarks?',
  },
  ar: {
    app_title:'التوراة السامرية الإسرائيلية', brand_top:'אבני שהם', div_jewish:'التقسيم اليهودي', div_sam:'التقسيم السامري',
    spread:'كل الأصحاحات', next_portion:'المقطع التالي ›', prev_portion:'‹ المقطع السابق',
    next_chapter:'الأصحاح التالي ›', prev_chapter:'‹ الأصحاح السابق', goto_book:'الانتقال إلى ',
    share:'مشاركة', export_excel:'تصدير إلى إكسل', no_results_xls:'لا توجد نتائج للتصدير',
    back:'‹ رجوع', back_t:'رجوع', browse:'تصفّح', search:'بحث', dict:'معجم الكلمات',
    font_sam:'الخط السامري', font_heb:'الخط العبري', interp:'تفسير الآية', commentary:'تفسير يهودي',
    sam_full_q:'يشمل التفاسير؟ ', sf_yes:'نعم', sf_no:'لا',
    compare:'مقارنة النصوص', variants:'اختلافات النصّ', samsrc:'مصادر سامرية', translate:'ترجمات التوراة',
    t_aramaic:'ترجمة: آرامية', t_arabic:'ترجمة: عربية', t_english:'ترجمة: إنجليزية',
    search_ph:'ابحث عن كلمة', adv_search:'⚙ بحث متقدم', search_help_btn:'❔ مساعدة البحث',
    flag_exact:'تطابق تامّ', flag_meanings:'إظهار معاني الكلمات', flag_root:'حسب جذر الكلمة',
    flag_finals:'تجاهل الحروف النهائية', flag_aram:'البحث في الترجمة الآرامية', root_label:'الجذر للبحث:',
    adv_hint:'يمكنك استخدام <b>?</b> أو <b>*</b> لاستبدال حرف أو سلسلة أحرف. مثال: <b>א?ר</b> أو <b>כא*</b>',
    apply:'تأكيد', menu:'القائمة', m_calendar:'التقويم السامري (حسبان قشطة)',
    m_genealogy:'شجرة الأنساب السامرية الكاملة', m_install:'تثبيت التطبيق', m_lang:'تغيير اللغة',
    m_whatsnew:'ما الجديد؟', m_help:'مساعدة المستخدم', m_version:'الإصدار الحالي', m_contact:'اتصل بنا',
    m_tour:'جولة إرشادية', tour_prompt_title:'جولة إرشادية',
    tour_prompt_body:'هل تريدون جولة قصيرة موجَّهة تشرح وتعرض كيفية استخدام التطبيق؟ يمكنكم دائمًا العودة إليها من القائمة، تحت المساعدة.', tour_prompt_start:'ابدأ الجولة',
    tour:[
      'أهلًا بكم في التوراة السامرية الإسرائيلية. في هذا العرض القصير سأرافقكم على الشاشة وأشرح ما يفعله كلّ زرّ. يمكنكم التقدّم والرجوع، أو كتم الصوت، في أيّ وقت.',
      'في الأعلى تختارون تقسيم التوراة: التقسيم اليهودي المعروف، أو التقسيم السامري الأصلي. الضغط هنا يبدّل بينهما.',
      'أولًا اختاروا سفرًا، ثم مقطعًا، ثم أصحاحًا — فتصلون إلى الآيات.',
      'هذه آيات الأصحاح. بجانب كلّ آية رقمها؛ والضغط على الرقم يعرض تلك الآية وحدها.',
      'انتبهوا إلى شريط الأدوات في الأسفل. يُطوى تلقائيًا لإفساح مجال القراءة — رأيتموه يُغلق ويُفتح. اسحبوا أو اضغطوا المقبض في وسطه لإعادة فتحه في أيّ وقت.',
      'زرّ الخطّ يبدّل بين العبرية العادية والخطّ العبري-السامري القديم.',
      'هنا تختارون ترجمة — آرامية أو عربية أو إنجليزية — تُعرض مكان النصّ.',
      'مقارنة النصوص تعرض النصّ السامري مقابل الماسوري، والسبعينية، مع تمييز الفروق.',
      'اختلافات النصّ تعرض قراءات من مخطوطات مختلفة، من طبعة فون غال، مع شهودها.',
      'مصادر سامرية تفتح التفسير السامري للآية: تيبات مارقه، تفسير صدقة الحكيم، التقليد السامري وغيرها.',
      'تفسير الآية يفتح لوحة تحت النصّ فيها تفسير متصل لكلّ آية، مبنيّ على المصادر السامرية وحدها مع نسبة كلّ قول إلى قائله. ومن عنوان اللوحة يمكن عرضه بالخطّ السامري أو بالعربية، وفي أسفلها روابط إلى المصادر السامرية والتفسير اليهودي ومعجم الكلمات.',
      'معجم الكلمات يعرض لكلّ كلمة في الآية ترجمتها الآرامية ومعناها من المعجم.',
      'رمز الطابعة في شريط التنقّل يهيئ الأصحاح للطباعة أو للحفظ كملفّ PDF. يمكنك اختيار الخطّ، وإزالة أرقام الآيات، وإرفاق تفسير الآية ومعجم الكلمات وترجمة — مع معاينة على الشاشة قبل الطباعة.',
      'زرّا الأصحاح التالي والسابق يقلّبان بين الأصحاحات بسلاسة، حتى عبر الأسفار. والعدسات تكبّر النصّ وتصغّره.',
      'والآن لنجرّب البحث. نفتح شاشة البحث ونكتب كلمة — مثلًا، بيريشيت.',
      'هذه نتائج البحث. كلّ نتيجة تبيّن موضع الآية؛ والضغط عليها يقفز مباشرة إلى تلك الآية.',
      'البحث المتقدّم يتيح البحث حسب الجذر، في الآرامية، أو تجاهل الحروف النهائية. ويمكن استخدام أحرف عامة: علامة استفهام لحرفٍ واحد، ونجمة لسلسلة، وزائد لكلّ الكلمات في الآية نفسها.',
      'تضمّ القائمة: تثبيت التطبيق، تغيير اللغة، التقويم السامري، شجرة الأنساب، ما الجديد، المساعدة وغيرها.',
      'ضمن المكتبة السامرية يوجد المعجم الآرامي-العبري، وكتابان كاملان للمطالعة: تيبات مارقه وتفسير صدقة الحكيم.',
      'هكذا يبدو المعجم: يمكنكم البحث عن كلمة، وتصفّح الفهرس أو صفحات المعجم، والضغط على كلمة لرؤية كلّ مواضعها.',
      'بهذا انتهت الجولة. يمكنكم العودة إليها في أيّ وقت من القائمة، تحت المساعدة. قراءةً ممتعة ونافعة!',
    ],
    share_title:'مشاركة', email:'بريد إلكتروني', close:'إغلاق', to_torah:'↩ التوراة', to_library:'📚 المكتبة',
    copied:'تم نسخ النص', copy_fail:'فشل النسخ', share_copy:'نسخ إلى الحافظة',
    to_aramaic:'الترجمة الآرامية', to_arabic:'الترجمة العربية', to_english:'الترجمة الإنجليزية',
    cmp_title:'اختر النصّ للمقارنة', cv_masoretic:'النصّ الماسوري', cv_septuagint:'الترجمة السبعينية', cv_onkelos:'ترجوم أونكيلوس', cv_qumran:'مخطوطات قمران',
    ci_qumran:'مخطوطات البحر الميت (قمران) هي أقدم المخطوطات الكتابية الباقية (القرن 3 ق.م–القرن 1 م)؛ بعضها يعكس نصًّا قريبًا من السامري. هنا يُعاد بناء كل آية من أفضل مخطوطة حُفظت فيها — استنادًا إلى نسخ م. أبيغ عبر مشروع ETCBC (رخصة CC-BY-NC). تُضمَّن الأجزاء المعاد بناؤها، والآيات غير المحفوظة تُعلَّم بخطّ متقطّع.',
    cmp_source:'النصّ السامري', cmp_aram:'الآرامية (السامرية)',
    ci_onkelos:'ترجوم أونكيلوس هي الترجمة الآرامية المعتمدة للتوراة، المنسوبة إلى أونكيلوس الدخيل (القرن الثاني م). ترجمة حرفية غالبًا، صارت مقدّسة في التقليد اليهودي وتُطبع بجانب معظم أسفار التوراة. تُعرض هنا مقابل الترجمة الآرامية السامرية مع تمييز الفروق.',
    cmp_sam:'النصّ السامري', cmp_info:'حول هذا النصّ',
    cmp_chapter_field:'رقم الفصل (في النسخة المقارنة)',
    ci_masoretic:'النصّ الماسوري هو النصّ اليهودي المعتمد للكتاب المقدّس العبري، نقله وشكّله علماء المسورة في طبريّة (أواخر الألفية الأولى م). وهو أساس معظم الطبعات المطبوعة.',
    ci_septuagint:'الترجمة السبعينية (LXX) هي الترجمة اليونانية القديمة للتوراة، أُنجزت في الإسكندرية في القرن الثالث ق.م. تعكس أحيانًا نصًّا عبريًّا قديمًا يختلف عن الماسوري، ويقارب في مواضع كثيرة النصّ السامري.',
    c_name:'الاسم الكامل', c_email:'البريد الإلكتروني', c_msg:'رسالة (حتى 100 كلمة)', c_send:'إرسال', c_cancel:'إلغاء',
    lang_save_q:'هل تريد حفظ هذا الإعداد؟', lang_save_note:'سيُحفظ على هذا الجهاز للمرّات القادمة.',
    save_yes:'نعم، احفظ', save_no:'لا، هذه المرّة فقط',
    samsrc_pick:'مصادر سامرية — اختر مصدراً', checking_sources:'جارٍ التحقق من المصادر…',
    no_sam_source:'لا يوجد مصدر سامري لهذه الآيات', back_sources:'‹ المصادر',
    src_tibat:'تيبات مارقه', src_eyalk:'من التقليد السامري', src_tzdaka:'تفسير صدقة الحكيم', src_bhuq:'تفسير «إن سلكتم في فرائضي»',
    src_sir:'سرّ القلوب', src_shyt:'أجوبة يعقوب بن هارون الكاهن', src_asatir:'كتاب الأساطير',
    src_translit:'نسخ النطق', tr_source:'النصّ المصدر', tr_translit:'نطق السامريين',
    no_translit:'لا يوجد نسخ نطق لهذه الآيات',
    variants_title:'اختلافات النصّ — طبعة فون غال',
    no_variants:'لا توجد اختلافات نصّية لهذه الآيات.',
    app_hint:'الكلمات المميّزة في الآية تحمل اختلافات نصّية — اضغط على كلمة للانتقال إلى اختلافاتها، واضغط على اختلاف للعودة إلى الكلمة.',
    dict_hint:'معجم الكلمات — السهم ⬆ بجانب الترجمة الآرامية يدلّ على وجود نتائج إضافية. اضغط على الصفّ لعرض المدخل الكامل ومواضع التوراة والصيغ الإضافية من المعجم', no_dict:'لا يوجد معجم لهذه الآية',
    dict_pick_word:'👆 اضغط على كلمة مسطّرة لرؤية مدخلها. اضغط أخرى لتبديلها؛ واضغط «معجم الكلمات» مرّة أخرى لإيقافه.',
    more_results:'نتائج إضافية', phr_occurrences:'مواضع', phr_words:'كلمات التعبير', phr_head:'تعابير ثابتة', phr_formula:'لقب ثابت', phr_idiom:'تعبير اصطلاحي', sug_head:'اقتراح من الاشتقاق', sug_note:'غير مؤكَّد مقابل المعجم أو مرقة أو التوراة — لا يُعطى جذر', ver_by:'مؤكَّد بواسطة', infl_head:'تحليل الصيغة', infl_deriv:'الاشتقاق', infl_marqe:'حسب الترجمة العبرية لميمر مرقة', infl_review:'اقتراح — بحاجة إلى تأكيد', tal_meaning:'المعنى من المعجم', tal_torah:'المواضع في التوراة', tal_forms:'صيغ ومداخل إضافية', tal_page:'ص', tal_none:'لم يُعثر على مدخل لهذه الكلمة في المعجم.', tal_click_precise:'اضغط للمدخل الدقيق من المعجم ⬅',
    week_portion:'فصل الأسبوع', week_portion_here:'فصل هذا الأسبوع — {p}',
    m_timeline:'الخطّ الزمني التاريخي السامري',
    m_library:'المكتبة السامرية', m_dict_aram:'المعجم الآرامي-العبري والعبري-الآرامي',
    lib_search_ph:'ابحث عن كتاب…', lib_no_result:'لا يوجد كتاب مطابق',
    m_tm_book:'تيبات مارقه (ميمر مرقه)', tm_title:'تيبات مارقه — ميمر مرقه', tm_search_ph:'بحث داخل الكتاب…',
    tm_toc_hint:'اختر ميمراً للمطالعة:', tm_back_toc:'‹ المحتويات', tm_back_chapter:'‹ العودة إلى الفصل',
    tm_words_btn:'معجم الكلمات', tm_words_title:'معجم الكلمات — من المعجم', tm_col_root:'الجذر',
    tm_no_results:'لا توجد نتائج', tm_sections_n:'مقاطع', tm_open_verse:'افتح الآية في التطبيق',
    m_tz_book:'تفسير صدقة الحكيم (التكوين)', tz_title:'تفسير صدقة الحكيم — التكوين',
    tz_toc_hint:'اختر أصحاحاً:', tz_chapter_label:'أصحاح', tz_arabic_pending:'الترجمة العربية قيد الإعداد — يُعرض النصّ العبري.',
    m_shyt_book:'أجوبة يعقوب بن هارون الكاهن', shyt_title:'أجوبة يعقوب بن هارون الكاهن', shyt_toc_hint:'اختر سؤالاً:',
    m_sir_book:'سِرّ القلوب', sir_title:'سِرّ القلوب', sir_toc_hint:'اختر فصلاً:',
    m_bhuq_book:'تفسير إم بحقوتي', bhuq_title:'تفسير إم بحقوتي — أبو الفرج ابن الكثار',
    bhuq_toc_hint:'قُسّم الكتاب هنا حسب مسار الحجّة؛ الأرقام بين قوسين هي فقرات المؤلف. اختر قسمًا:',
    m_asatir_book:'كتاب الأساطير', asatir_title:'كتاب الأساطير', asatir_toc_hint:'اختر أصحاحاً:',
    asatir_note:'كتاب الأساطير — التاريخ السامري من آدم إلى آخر الأيام، بالنسخ العبري.',
    m_people_book:'أعلام وباحثون سامريّون', pp_title:'أعلام وباحثون سامريّون',
    pp_search_ph:'ابحث عن اسم أو حقبة أو موضوع…', pp_back_list:'العودة إلى القائمة',
    pp_by_era:'حسب الحقبة', pp_by_abc:'حسب الأبجدية',
    pp_empty:'اختر شخصية من القائمة ←', pp_no_result:'لم يُعثر على شخصية مطابقة',
    pp_unavailable:'هذه الوحدة غير متاحة على الخادم بعد. حاول مرّة أخرى قريباً.',
    pp_era_bib:'العصر التوراتي', pp_era_anc:'العصور القديمة', pp_era_med:'العصور الوسطى',
    pp_era_early:'مطلع العصر الحديث', pp_era_mod:'العصر الحديث', pp_era_unk:'حقبة غير معروفة',
    pp_source:'المصدر', pp_contributor:'بقلم', pp_pron:'النطق',
    pp_more:'تفصيل إضافي', pp_refs:'لمزيد من القراءة',
    pp_wiki_open:'موسّع — المقالة كاملة', pp_wiki_credit:'من ويكيبيديا، مقالة',
    pp_wiki_lang_he:'بالعبرية', pp_wiki_lang_en:'بالإنجليزية', pp_wiki_lang_ar:'بالعربية',
    m_piyutim_book:'الأناشيد السامرية', piy_title:'تصفّح الأناشيد السامرية',
    piy_back_tree:'العودة للفهرس', piy_dict_toggle:'قاموس الكلمات', piy_search_ph:'بحث عن تأليف أو مؤلف أو كلمة…',
    piy_empty:'اختر تأليفًا من الفهرس ←', piy_pick_first:'اختر تأليفًا',
    piy_translation_he:'الترجمة العبرية', piy_no_dict_line:'لا توجد مداخل قاموس لهذا السطر بعد',
    piy_no_dict_entry:'لا يوجد مدخل قاموس بعد',
    piy_q_verified:'✔ موثّق', piy_q_cleaned:'✎ منقّح يدويًا', piy_q_raw:'⚠ OCR خام',
    m_rhyme_book:'إيجاد القوافي', rhyme_title:'إيجاد القوافي',
    m_composer:'✍️ ألّف لي قصيدة', cmp_title_h:'✍️ ألّف لي قصيدة', cmp_genre:'النوع', cmp_theme:'الموضوع / العيد',
    cmp_rhyme:'مجموعة القافية', cmp_stanzas:'عدد المقاطع', cmp_lines_per_stanza:'الأسطر في كل مقطع',
    cmp_acro_text:'أكروستيك في المقطع (اختياري)', cmp_stanza:'مقطع', cmp_go:'ألّف لي!',
    cmp_rhyme_random:'عشوائي (غني)', cmp_cola_n:'أشطر',
    cmp_note:'يُركّب المولّد مسودة عمل: كل شطر مأخوذ حرفيًا من المتن الموثّق ومرتّب حسب قواعد النوع والقافية المختارين — لكن الربط بين الأشطر آلي. هذه مادة خام للشاعر، وليست قصيدة مكتملة: حرّرها، بدّل الأشطر (🎲)، وكيّفها.',
    cmp_copy:'📋 انسخ المسودة', cmp_copied:'تم نسخ المسودة — الصقها لتلميع فني.',
    m_privatecomp:'🔒 مؤلفات خاصة', pc_title_h:'🔒 مؤلفات خاصة — أوشر ششوني',
    pc_new:'✍️ تأليف جديد بمساعدة AI', pc_back_list:'↩ إلى القائمة', pc_empty:'لا توجد مؤلفات محفوظة بعد.',
    pc_prompt:'تعليمات حرة للتأليف', pc_go:'ألّف لي!', pc_generating:'جارٍ التأليف... (قد يشمل بحثًا في الويب، قد يستغرق لحظة)',
    pc_save_title:'عنوان للحفظ', pc_save:'💾 احفظ كتأليف خاص', pc_untitled:'تأليف بلا عنوان',
    pc_duplicate:'⧉ استنساخ', pc_delete:'🗑 حذف', pc_delete_q:'سيُحذف هذا التأليف نهائيًا من الموقع الحي. متابعة؟',
    rhy_mode_exact:'دقيق', rhy_mode_syll:'نفس عدد المقاطع', rhy_mode_sound:'الصوت',
    rhy_q_ph:'اكتب كلمة، مثل: שבתה', rhy_or:'أو', rhy_start_letter:'حرف البداية (اختياري):', rhy_start_letter_ph:'مثل: מ',
    piy_to_rhyme:'🎵 إلى البحث',
    rhy_clean_only:'من نص موثّق فقط', rhy_search_btn:'ابحث عن القوافي',
    rhy_empty:'ابحث عن كلمة أو لاحقة أو صوت — واحصل على كل الكلمات المتقافية في المتن.',
    rhy_no_results:'لم يُعثر على كلمات مطابقة', rhy_found_n:'تم العثور على {n} كلمة',
    rhy_approx:'تطابق تقريبي {p}%', rhy_clean_n:'موثّق', rhy_no_def:'لا يوجد مدخل بعد', rhy_root_lbl:'جذر:',
    rhy_occ_n:'تأليفات', rhy_no_data:'لا توجد بيانات',
    rhy_col_word:'الكلمة', rhy_col_freq:'التكرار', rhy_col_group:'مجموعة القافية', rhy_col_def:'الترجمة', rhy_col_occ:'أين تظهر',
    rd_he:'العبرية', rd_ar:'العربية', rd_aram:'الآرامية', rd_show:'اعرض:',
    dict_app_title:'معجم آرامي&nbsp;-&nbsp;عبري،&nbsp;عبري&nbsp;آرامي', dict_app_ph:'اكتب كلمة آرامية أو جذرًا…', dict_app_search:'بحث', dict_app_hint:'ابحث في معجم الآرامية السامرية: الجذر · المعنى العبري من المعجم · مواضع التوراة.', dict_app_empty:'لم يُعثر على مدخل. جرّب جذر الكلمة.',
    dict_tab_search:'بحث', dict_tab_index:'فهرس الكلمات', dict_tab_phrases:'تعابير ثابتة', dict_phrases_hint:'تعابير آرامية ثابتة من القصائد ومن ميمر مرقة — ألقاب وصيغ وتعابير اصطلاحية، مع الترجمة العبرية التي يمنحها ميمر مرقة نفسه. اضغط على تعبير لعرض مدخله الكامل.', dict_tab_pages:'تصفّح الصفحات',
    dict_index_hint:'تصفّح كلّ كلمات المعجم (أ–ي). اكتب حرفاً/كلمة للقفز. اضغط كلمة لرؤية مواضعها في التوراة وفي تيبات مارقه — بالمعنى نفسه.', dict_index_ph:'اقفز إلى حرف/كلمة…',
    dict_dir_aram:'آرامية ← عبرية', dict_dir_he:'عبرية ← آرامية', dict_he_ph:'اكتب كلمة عبرية…',
    dict_he_index_hint:'تصفّح الكلمات العبرية (أ–ي). اضغط كلمة للوصول إلى مدخلها الآرامي.',
    dict_he_search_hint:'ابحث كلمة عبرية — تقودك النتيجة إلى مدخلها (جذرها) الآرامي.', dict_he_roots:'جذور آرامية',
    dict_word_panel_btn:'افتح المدخل الكامل',
    dict_w_torah:'ترد في التوراة', dict_w_memar:'ترد في تيبات مارقه', dict_w_meanings:'معانٍ',
    dict_back_index:'‹ العودة إلى الفهرس', dict_back_search:'‹ العودة إلى البحث', dict_in_torah_sec:'المواضع في التوراة', dict_in_memar_sec:'المواضع في تيبات مارقه',
    dict_same_meaning:'بالمعنى نفسه (حسب الجذر)', dict_more:'أخرى', dict_no_occ:'لا مواضع بهذا المعنى.',
    dict_show_occ:'↳ إظهار المواضع في التوراة وتيبات مارقه',
    dict_pages_hint:'تصفّح صفحات المعجم.', dict_page_label:'صفحة', dict_prev:'‹ السابق', dict_next:'التالي ›',
    dict_in_dict:'موجودة في المعجم كمدخل:', dict_form_hint:'اضغط صيغةً لكلّ مواضعها في المعجم',
    dict_locations_title:'المواضع في المعجم', dict_loc_count:'مواضع', dict_open_page:'افتح صفحة المعجم',
    ob_dont:'لا تُظهر مرّة أخرى', ob_later:'لاحقًا', ob_close:'إغلاق', wc_read:'قرأتُ',
    // newest first: a reader opening "ما الجديد" wants this version, not 1.0
    whatsnew_pages:[
      '<p><b>الإصدار 3.3 — الخطّ الزمني التاريخي السامري</b></p><ul><li>أُضيف إلى القائمة، فوق المكتبة، <b>الخطّ الزمني التاريخي السامري</b>: خطّ تفاعلي من خلق العالم إلى أيّامنا، يُفتح داخل التطبيق ويعود إلى التوراة بضغطة واحدة</li><li>أربع طبقات تُطفأ وتُشعل — تاريخ السامريين، وبنو إسرائيل ويهوذا، وأيّام المقرأ، والعالم والحكّام — وإلى جانبها الأعلام والباحثون وأشرطة أصحاب المناصب: الكهنة الكبار، ورؤساء الحكومة، والرؤساء</li><li><b>نقطة الصفر</b> خطّ ثابت يمرّ الزمن تحته، وتُقرأ عنده معاً السنة الميلادية، والسنة لخلق العالم، والسنة لدخول أرض كنعان، واسم الكاهن الأكبر في تلك السنة</li><li>بحث عن حدث أو شخصية أو سنة بأيّ من التقاويم الثلاثة؛ والضغط على حدث يفتح بطاقة بمصدره؛ وزرّ <b>رحلة</b> يُسيّر الخطّ من تلقائه</li><li>أُصلح: طالت القائمة حتّى صارت آخر بنودها تُقتطع على الهاتف — وهي الآن <b>تنزلق</b> في الشاشات التي لا تسعها، ويبقى العنوان في رأسها</li></ul>',
      '<p><b>الإصدار 3.2 — الطباعة: الورقة نفسها لا صورةٌ عن التطبيق</b></p><ul><li>ما يخرج من الطابعة هو تماماً ما أظهرته <b>المعاينة</b> — فالصفحة معرَّفة مرّة واحدة بمقاييس الورق، والمعاينة تعرض ورقة A4 حقيقية بحجم الخطّ الذي سيُطبع فعلاً</li><li>لا يصل إلى الورق سوى <b>النصّ وتفاسيره</b>: هيكل التطبيق وشريط الاستماع والأزرار لا تُطبع — ولا حتّى من أمر الطباعة في المتصفّح نفسه</li><li>اختيار الخطّ — <b>السامري أو العبري</b> — يسري على الورقة كلّها والتفسير منها، ونافذة الطباعة تفتح على الخطّ الظاهر على الشاشة</li><li><b>تفسير الآية</b> يأتي تحت أصحاحه مباشرة و<b>معجم الكلمات</b> بعده؛ يفصل كلاًّ منهما خطّ لا إطار، وحجم الخطّ ثابت في كلّ صفحة وعلى كلّ جهاز</li><li>أُصلح: كان الأصحاح الطويل يُقصّ عند نهاية الصفحة الأولى فلا يُطبع كاملاً</li><li>ولوحدات <b>المكتبة</b> الآن طابعتها الخاصّة، وعلى الورقة نفسها: أصحاح الكتاب المفتوح أو محتوياته، وقصيدة بأسطرها (وشروح كلماتها إن كان المعجم مفتوحاً)، ومدخل عَلَم أو قائمة الأسماء، ونتائج المعجم وباحث القوافي</li><li>وللشخصيات السامرية السبع التي لها مقالة في ويكيبيديا أُضيف قسم مطويّ <b>موسّع — المقالة كاملة</b> يحملها بتمامها، بلغة الواجهة حيثما وُجدت بها</li></ul>',
      '<p><b>الإصدار 3.1 — أعلام وباحثون سامريّون، ورفّ كتب جديد</b></p><ul><li>أُضيف <b>أعلام وباحثون سامريّون</b> إلى المكتبة كوحدة مستقلّة: 95 شخصية — من هارون الكاهن وبابا ربّا، مروراً بشعراء العصور الوسطى، وصولاً إلى أبناء الطائفة وباحثيها في القرن العشرين — ولكلّ واحدة شرح لمكانتها في التقليد</li><li>تُعرض القائمة <b>حسب الحقبة</b> أو <b>حسب الأبجدية</b>، والبحث يجري في متن الشروح أيضاً، فتُوجد الشخصية بموضوعها لا باسمها وحده</li><li>أُضيف إلى 23 شخصية <b>تفصيل إضافي</b> — تواريخ وتصويبات وسياق لا يرد في المدخل نفسه — وإلى جانبه قائمة <b>لمزيد من القراءة</b>؛ وصارت أسماؤهم العبرية تتصدّر حيثما كانت معروفة</li><li>أُعيد رسم رفّ الكتب: اسم الكتاب مكتوب على غلافه نفسه، ولكلّ كتاب لونه الخاصّ، وصُغّرت الأغلفة — فصار السطر الواحد يتّسع لضعف ما كان</li></ul>',
      '<p><b>الإصدار 3.0 — أبو الفرج داخل شرح الآية، والقراءة المتواصلة</b></p><ul><li>يَرِد رأي <b>أبي الفرج</b> الآن تحت شرح كلّ آية يتحدّث عنها، باسمه وبرقم فقرة المؤلّف: 654 آية في 352 أصحاحاً سامرياً، والمصنَّف كلّه مترجَم إلى العربية</li><li><b>القراءة المتواصلة</b>: علامة في شريط التشغيل تتابع إلى الأصحاح التالي عند انتهاء التسجيل — بالقارئ نفسه وبالسرعة نفسها — وتتوقّف دائماً عند نهاية البارشاة</li><li>جرى تضييق شريط التشغيل لصالح النصّ، وقُرِّبت العلامات الثلاث في سطر التنقّل بعضها إلى بعض، وصار الشريط المطويّ يشير إلى نفسه بسهم صغير متمايل</li></ul>',
      '<p><b>الاستماع إلى قراءة التوراة</b></p><ul><li>يُفتح كلّ أصحاح مع شريط تشغيل، وتُسمع القراءة بأصوات <b>ثمانية من قرّاء الطائفة</b> — وحيث يوجد للأصحاح أكثر من قارئ يمكن الاختيار بينهم والمقارنة</li><li>قرأ <b>مئير بن يفنه ششوني</b> التوراة كلّها وفق التقسيم السامري: 941 أصحاحاً، نحو سبع عشرة ساعة</li><li>وإلى جانبه أرشيف القرّاء التاريخيّين — <b>فنحاس أبراهام كوهين، ورصون صدقة، وعوبديا صدقة، وإسرائيل صدقة، وأبراهام صدقة، وألعازار صدقة كوهين، وأبراهام بن يساخر</b> — نحو أربع عشرة ساعة، قُطّعت إلى 757 مقطعاً كي يُسمع كلّ أصحاح سامريّ بدقّة حتى من تسجيل جرى وفق التقسيم اليهودي</li><li>مُحدِّد سرعة، وعلامة ♪ على كلّ أصحاح له تسجيل، وقراءة متواصلة حتى نهاية البارشاة</li></ul>',
      '<p><b>تجديد وجه المكتبة السامرية</b></p><ul><li>تُفتح المكتبة الآن <b>معرضَ بطاقات</b> على الصفحة كلّها — غلاف كتاب لكلّ مصنَّف، اسمه مكتوب عليه ولكلّ غلاف لونه الخاصّ، وسطر بحث يُنقّي الرفّ أثناء الكتابة</li><li>ومن أيّ قارئ تعود إلى التوراة أو إلى الرفّ بلمسة، ولكلّ كتاب محتويات وبحث داخليّ وتكبير نصّ وقفزٌ ثنائيّ الاتّجاه إلى الآية</li></ul>',
      '<p><b>الكتب التي على الرفّ</b></p><ul><li><b>تيبات مارقيه</b> — مصنَّف الدرس السامريّ القديم، بالآرامية والعبرية جنباً إلى جنب</li><li><b>شرح صدقة الحكيم</b> — شرح متّصل لسفر التكوين، بالعبرية والعربية</li><li><b>شرح «إم بحقوتاي»</b> — مصنَّف أبي الفرج ابن الكثار الفقهيّ بترجمة د. علي وتد: 537 مقطعاً في 24 قسماً، مع 814 اقتباساً قابلاً للنقر</li><li><b>كتاب الأساطير</b> — تاريخ السامريين من آدم إلى آخر الأيام، ستّة عشر أصحاحاً موصولة بالآيات التي ترويها</li><li><b>سرّ القلوب</b> — مصنَّف في الفكر والأخلاق</li><li><b>مسائل يعقوب بن هارون الكاهن وأجوبتها</b> — في الشريعة وعادات الطائفة</li><li><b>المعجم الآرامي–العبري</b> — تصفّح الصفحات، وفهرس، وكلّ مواضع الكلمة</li><li><b>القصائد السامرية</b> و<b>باحث القوافي</b> — بقافية مطابقة أو مساوية في المقاطع أو في الصوت</li><li><b>أعلام وباحثون سامريّون</b> — 95 شخصية من العصر التوراتي حتى يومنا، حسب الحقبة أو الأبجدية، ولكلّ واحدة شرح لمكانتها في التقليد</li></ul>',
      '<p><b>الإصدار 2.3 — شرح «إم بحقوتاي» في المكتبة</b></p><ul><li>أُضيف المصنَّف إلى المكتبة كوحدة مستقلّة، ودخل كتاب الأساطير إلى «شرح الآية» مقتبساً باسمه، وتُرجم إلى العربية كاملاً</li></ul><p><b>الإصدار 2.2 — كتاب الأساطير</b></p><ul><li>أُضيف الكتاب إلى المكتبة وإلى «المصادر السامرية»: في كلّ آية يرويها يظهر زرّ بالفقرة المعنيّة</li></ul><p><b>الإصدار 2.1 — شرح لكلّ التوراة، والعربية والطباعة</b></p><ul><li>أُعيدت كتابة شرح الآية للتكوين والخروج واللاويين والعدد — كلّ نقطة منسوبة إلى قائلها</li><li>طباعة وحفظ PDF مع معاينة؛ وعلى الحاسوب يملأ التطبيق الشاشة</li></ul>',
      '<p><b>الإصدار 2.0 — المكتبة السامرية</b></p><ul><li>المكتبة كمعرض بطاقات؛ قراءة القصائد وباحث القوافي</li><li>الاستماع إلى قراءة أصحاح التوراة، مع اختيار القارئ</li><li>الخطّ السامريّ للشروح أيضاً، والتكوين في 250 أصحاحاً دقيقاً</li></ul><p><b>الإصدار 1.5 — إثراء مصدر التقليد</b></p><ul><li>وُسّع «من التقليد السامري» ليشمل أربعة أسفار</li></ul><p><b>الإصدار 1.4 — تجربة المستخدم</b></p><ul><li>شاشة افتتاح، ونافذة ترحيب، وحركة قلب الصفحة، وتصفّح متّصل بين الأصحاحات والأسفار</li></ul>',
      '<p><b>الإصدار 1.3 — اختلافات النصّ والمقارنات</b></p><ul><li>اختلافات فون غال، مع الشهود ووصف المخطوطات</li><li>مقارنة بالسبعينية أيضاً؛ ومبدّل لغة الواجهة (عبرية/إنجليزية/عربية)</li></ul><p><b>الإصدار 1.2 — من مصادر السامرة</b></p><ul><li>تيبات مارقيه، والتقليد السامري، وشرح صدقة الحكيم، وسرّ القلوب، وكتاب الأساطير</li><li>«شرح الآية» — شرح متّصل متعدّد المصادر</li></ul><p><b>الإصدار 1.1 — المعاجم والجذور</b></p><ul><li>المعجم الآرامي السامري؛ وجدول لكلّ كلمة في الآية</li></ul><p><b>الإصدار 1.0 — الإصدار الشبكي</b></p><ul><li>التوراة السامرية في التقسيمَين، والخطّ السامري، والترجمات، والمقارنة بالنصّ المسوري، والبحث والمشاركة</li></ul><p class="wc-sign"><b>استمتعوا!</b></p>',
    ],
    interp_unavail:'هذه الميزة غير متاحة مؤقّتًا.',
    welcome_title:'أهلًا بكم في مشروع «أبني شوهم»',
    welcome_pages:[
      '<p><b>«أبني شوهم»</b> مشروعٌ أُنشئ إحياءً لذكرى الراحل آبي شوهم ساسوني، بغايةٍ واحدة — أن تُفتَح أبواب المكتبة السامرية أمام كلّ طالبٍ لها.</p><p>نعمل في إطاره على رقمنة وترجمة كنزٍ من كتب الشريعة واللغة والتفسير من <b>الرفّ السامري</b>، معظمها بمعونة أدوات ذكاء اصطناعي متقدّمة، كي تستقرّ المكتبة كلّها في كفّ أيديكم. وكلّ ذلك تطوّعيٌّ بالكامل وبلا غاياتٍ ربحية.</p><p>ومن المشاريع التي صدرت بالفعل:</p><ul><li><b>حسبون قشط</b> — التقويم العبري-السامري</li><li><b>معجم آرامي–عبري</b></li><li><b>شجرة الأنساب</b> الكاملة للطائفة السامرية</li></ul>',
      '<p>وبين أيديكم المشروع الجديد — <b>التوراة السامرية الإسرائيلية</b>: بيتٌ لمطالعة نصّ التوراة ودراسته وبحثه كما حفظته الطائفة السامرية وتناقلته جيلاً بعد جيل، منذ آلاف السنين.</p><p>هنا تجدون تفاسير ومصادر من الرفّ السامري — <b>تيبات مارقه</b>، المعجم والترجمة الآراميّان، الترجمة العربية، تفسير <b>صدقة الحكيم</b>، كتاب الأساطير، كتاب الاختلافات وغيرها — إلى جانب اختلافات النصّ من مخطوطاتٍ مختلفة. وسيُضاف لاحقاً التقاطع مع مصادر أخرى، والتلاوة الصوتية وكيفية النطق.</p>',
      '<p>ولئلّا يفوتكم جديد، ننصح بالسماح بالإشعارات حول الميزات والتحديثات.</p><p>ولأنّنا نستعين بأدوات آلية، فقد تصادفون بين الحين والآخر خللاً أو تشوّهاً هنا أو هناك — نعتذر إليكم، ويسعدنا أن تُعلِمونا بذلك.</p><p>يمكن تثبيت التطبيق على جهازكم، ويُستحسن البدء من قائمة <b>☰</b> في الزاوية — وفيها أيضاً يمكنكم تغيير اللغة وتصفّح <b>«ما الجديد»</b>.</p><p class="wc-sign"><b>قراءةً ممتعة، ورحلةً شيّقة في توراة السامريين!</b></p>',
    ],
    install_rec_title:'تثبيت التطبيق',
    install_rec_body:'نوصي بتثبيت التطبيق على الشاشة الرئيسية — لوصول سريع، وتجربة كاملة، واستخدام دون اتصال بالإنترنت.',
    install_rec_btn:'ثبّت الآن',
    notif_rec_title:'تفعيل الإشعارات',
    notif_rec_body:'اسمح بالإشعارات لتصلك تحديثات حول الميزات الجديدة والإضافات والإصدارات الجديدة للتطبيق.',
    notif_rec_btn:'تفعيل الإشعارات',
    col_word:'الكلمة', col_aram:'الآرامية', col_heb:'المعنى العبري', col_tal:'مدخل المعجم', col_arabic:'العربية', col_meliz:'المليص',
    col_wordtrans:'ترجمة الكلمة', col_src:'الكلمة الأصلية', col_arab:'ترجمة عربية', col_eng:'ترجمة إنجليزية', col_hetrans:'ترجمة عبرية',
    ws_tap_hint:'👆 اضغط الصفّ لتفسير موسّع — كلّ ترجمة من مصدرها', ws_translation:'ترجمة عبرية', ws_from_targum:'من الترجمة الآرامية (قراءة الآية)', ws_web:'معاجم الشبكة', ws_jewish:'تفسير يهودي', ws_samaritan:'من مصادر سامرية',
    ws_tal:'من الآرامية', ws_tal_ctx:'من الآرامية — حسب سياق الآية', ws_tal_gen:'من الآرامية — ترجمة عامة',
    ws_english:'من الإنجليزية', ws_from_english:'الإنجليزية ← العبرية', ws_english_pending:'الترجمة من الإنجليزية قيد الإعداد',
    ws_melitz:'من المليص', ws_melitz_pending:'مصدر المليص لم يُضَف بعد', ws_torah_occ:'مواضع في التوراة (آرامية)', ws_marqe_occ:'مواضع في تيبات مارقه',
    ws_arabic:'من العربية', ws_from_arabic:'العربية ← العبرية', ws_arabic_pending:'ترجمة العربية إلى العبرية قيد الإعداد',
    searching:'جارٍ البحث…', no_interp:'لا يوجد تفسير لهذه الآيات',
    no_interp_ar:'الترجمة العربية للتفسير قيد الإعداد', interp_ar_pending:'[لم يُترجَم بعد] ', interp_sam:'الخط السامري', interp_ar:'العربية',
    interp_more:'للتوسّع راجِع:', interp_asatir_lead:'ويروي كتاب الأساطير',
    interp_bhuq_lead:'ويقول أبو الفرج ابن الكثار في تفسير «إن سلكتم في فرائضي»',
    help_title:'مساعدة المستخدم', search_help_title:'مساعدة البحث', install_title:'تثبيت التطبيق',
    m_admin:'دخول المسؤول', adm_user:'اسم المستخدم', adm_pass:'كلمة المرور', adm_login:'دخول',
    adm_bad:'اسم المستخدم أو كلمة المرور غير صحيحة.', admin_on:'وضع التحرير مُفعَّل — اضغط على القلم بجانب النصّ.',
    adm_sysdoc:'📘 توثيق النظام', adm_loading:'جارٍ التحميل…', adm_version_word:'إصدار',
    adm_no_log:'لا يوجد سجلّ إصدارات لعرضه بعد.',
    adm_analytics:'📊 بيانات دخول ونشاط الزوار', adm_analytics_empty:'لا توجد بيانات زيارات بعد.',
    adm_analytics_hint:'اسم الجهاز مُستنتج من بيانات المتصفح — المتصفحات لا تكشف اسم الهاتف/الحاسوب الفعلي لأسباب خصوصية.',
    adm_first:'أول دخول', adm_last:'آخر نشاط', adm_duration:'مدة الزيارة', adm_min:'د', adm_sec:'ث',
    wa_setup:'🔒 تفعيل الدخول ببصمة الإصبع', wa_login:'الدخول ببصمة الإصبع', wa_ok:'تم تفعيل الدخول ببصمة الإصبع بنجاح.',
    wa_err:'الدخول ببصمة الإصبع غير متاح على هذا الجهاز.', wa_login_err:'فشل التحقق. حاول مجددًا أو استخدم كلمة المرور.',
    admin_dl_db:'⬇ تنزيل قاعدة البيانات (للمزامنة)', admin_reseed:'تحميل DB من المستودع',
    admin_reseed_q:'سيؤدي هذا إلى استبدال قاعدة البيانات الحيّة بنسخة المستودع (git). ستُفقد التعديلات غير المنزَّلة. متابعة؟',
    reseed_report_title:'تقرير مقارنة قبل التحميل', reseed_approve:'الموافقة والتحميل',
    reseed_no_diff:'لم يتم العثور على فروقات بين قاعدة البيانات الحيّة ونسخة المستودع. يمكن المتابعة بأمان.',
    reseed_first_seed:'لا توجد قاعدة بيانات حيّة على القرص بعد — هذا تحميل أولي (لا يوجد ما تتم مقارنته).',
    reseed_books:'الفصول السامرية حسب السفر', reseed_added:'أضيفت', reseed_removed:'حُذفت', reseed_renumbered:'غُيّر ترقيمها',
    reseed_verses:'الآيات', reseed_changed:'تغيّرت', reseed_ch_moved:'انتقلت إلى فصل آخر',
    reseed_loss:'⚠ محتوى قد يُفقد (موجود على الخادم الحيّ، غير موجود في النسخة الجديدة)',
    reseed_audio:'⚠ روابط تسجيلات لا تطابق البنية الجديدة',
    adm_disk:'💾 مساحة القرص', adm_disk_db:'ملف DB الحيّ', adm_disk_backups:'نسخ احتياطية قديمة',
    adm_disk_free:'المساحة الحرّة', adm_disk_total:'إجمالي القرص', adm_disk_clean:'حذف النسخ الاحتياطية القديمة وتحرير المساحة',
    adm_disk_clean_q:'سيتم حذف النسخ الاحتياطية القديمة من القرص (سجلّ git يبقى النسخة الاحتياطية الحقيقية). متابعة؟',
    adm_disk_cleaned:'تم حذف النسخ الاحتياطية وتحرير المساحة.',
    edit_title:'تحرير النصّ', edit_save:'حفظ التغيير', edit_saved:'تمّ الحفظ.', edit_err:'فشل الحفظ.',
    edit_which_ver:'ما هو النصّ الذي تريد تعديله؟',
    vmerge_prev:'دمج الآية مع السابقة', vmerge_next:'دمج الآية مع التالية',
    vmerge_pick_prev:'اختر آية لدمجها مع التي فوقها', vmerge_pick_next:'اختر آية لدمجها مع التي تحتها',
    vmerge_q:'دمج الآية {a} في الآية {b}؟ تصيران آية واحدة رقمها {b}.',
    vmerge_ok:'دُمجت الآية {a} في الآية {b}.', vmerge_none:'لا توجد آية مجاورة في هذا الاتجاه.',
    canon_set:'تثبيت قانون الفصل', canon_set_book:'تثبيت القانون: الفصل والسفر',
    canon_set_q:'تثبيت {n} أصحاحاً قانوناً لفصل {p}؟ يُوقَّع باسمك وبتاريخه، ومن ثمّ يطلب كلّ تغيير في العدد كلمة التأكيد.',
    canon_set_q_book:'هذا آخر فصول السفر: يثبّت هذا عدد أصحاح كلّ فصل من فصوله ومجموع السفر كما هي الآن ({n} في {p}). أنتابع؟',
    canon_set_ok:'ثُبِّت:', canon_book_total:'مجموع السفر:',
    canon_drift:'انتبه: {a} أصحاحاً فعلياً مقابل {b} مثبَّتاً.',
    admin_badge:'وضع الإدارة', admin_exit_q:'هل تريد الخروج من وضع الإدارة؟', admin_off:'خرجت من وضع الإدارة.',
    apk_downloads:'نُزّل ملفّ التثبيت', apk_last_dl:'الأخير:',
    merge_next:'دمج مع التالي', split_chapter:'تقسيم الأصحاح', split_verse:'تقسيم الآية',
    split_pick:'اختر الآية التي يبدأ بعدها الأصحاح الجديد (اضغط رقم آية)', split_cancel:'إلغاء التقسيم',
    vsplit_pick:'اختر آية للتقسيم (اضغط رقم آية)',
    vsplit_title:'تقسيم الآية', vsplit_btn:'تقسيم الآية',
    vsplit_hint:'يبقى الجزء الأول برقم الآية الحالي؛ ويصبح الجزء الثاني آية جديدة بشَرطة ورقم متسلسل (تظهر في التقسيم السامري فقط).',
    vsplit_p1:'الجزء الأول — يبقى آية', vsplit_p2:'الجزء الثاني — آية جديدة',
    vsplit_err:'كلا الجزأين مطلوبان.', vsplit_ok:'تم تقسيم الآية. الآية الجديدة:',
    cmp_act_split:'تقسيم (نقل جزء إلى الآية التالية)', cmp_act_merge:'دمج مع الآية التالية',
    cmp_split_title:'تقسيم نصّ المقارنة', cmp_split_hint:'يبقى الجزء الأول في هذه الآية؛ وينتقل الجزء الثاني إلى بداية نصّ الآية التالية — للنسخة المختارة فقط، دون أن يتأثر النصّ السامري.',
    cmp_split_p1:'الجزء الأول — يبقى هنا', cmp_split_p2:'الجزء الثاني — ينتقل للآية التالية',
    cmp_split_ok:'تمّ تقسيم النصّ بين الآيتين.',
    cmp_merge_q:'دمج هذا النصّ (في النسخة المختارة) مع الآية التالية؟ سيُفرَّغ نصّ الآية التالية في تلك النسخة.',
    cmp_merge_ok:'تمّ دمج النصوص.',
    renum:'تغيير الرقم', renum_pick:'اختر آية لتغيير رقمها (اضغط رقم آية)',
    renum_title:'تغيير رقم الآية', renum_cur:'الرقم الحالي:', renum_empty:'أدخل رقمًا.',
    renum_cascade_q:'إعادة ترقيم كل الآيات التالية تبعًا لذلك؟', renum_cascade_yes:'نعم، كل التالية',
    renum_only_this:'هذه الآية فقط', renum_ok:'تم تحديث رقم الآية.',
    merge_q:'دمج الأصحاح الحالي مع التالي؟ سيُحدَّث ترقيم السفر.', split_q:'تقسيم الأصحاح بعد الآية ',
    merged_ok:'تمّ دمج الأصحاحين.', split_ok:'تمّ تقسيم الأصحاح.', confirm_yes:'تأكيد',
    bm_add:'إضافة إشارة لهذا الأصحاح', play_chapter:'قراءة الأصحاح صوتيًا', show_pron:'إظهار النطق (معاينة)', bm_my:'إشاراتي المرجعية', bm_delete:'حذف المحدّد',
    print_ch:'طباعة الأصحاح', print_title:'طباعة الأصحاح', print_font:'خط الطباعة', print_font_sam:'سامري', print_font_heb:'عبري',
    print_nonums:'إزالة أرقام الآيات (نصّ متّصل، بالخط السامري فقط)',
    print_interp:'تضمين تفسير الآية', print_dict:'تضمين قاموس الكلمات', print_trans:'تضمين الترجمة',
    print_preview:'معاينة', print_go:'طباعة / حفظ كملف PDF',
    print_unit:'طباعة', print_toc:'المحتويات', print_nothing:'لا شيء للطباعة — افتح أوّلاً ما تريد طباعته',
    print_failed:'تعذّر تحميل الصفحة للطباعة',
    bm_note_ph:'أضف ملاحظة…', bm_max:'وصلت إلى الحدّ الأقصى 20 إشارة.', bm_dup:'هذا الأصحاح مُؤشَّر بالفعل.',
    bm_added:'تمت إضافة الإشارة.', bm_empty:'لا توجد إشارات.', bm_del_q:'حذف الإشارات المحدّدة؟',
  },
};
// pick the UI language: a saved choice wins; otherwise fall back to the device's
// language so a non-Hebrew phone sees the welcome / UI in its own language —
// Hebrew→he, Arabic→ar, anything else→en (the international fallback).
function _detectLang(){
  const saved = localStorage.getItem('uiLang');
  if(saved && I18N[saved]) return saved;
  const codes = (navigator.languages && navigator.languages.length) ? navigator.languages
              : [navigator.language || ''];
  const p = (codes[0] || '').toLowerCase();
  if(p.startsWith('he') || p.startsWith('iw')) return 'he';   // Hebrew (iw = legacy code)
  if(p.startsWith('ar')) return 'ar';                         // Arabic
  return p ? 'en' : 'he';                                     // any other language → English
}
let LANG = _detectLang();
const t = k => (I18N[LANG] && I18N[LANG][k] != null) ? I18N[LANG][k] : (I18N.he[k] != null ? I18N.he[k] : k);

// Pin the app to the REAL visible height. On mobile the browser's collapsing
// address bar changes window.innerHeight, which 100vh does not follow — leaving
// the bottom toolbar hidden behind the browser bar. Re-measure on every change.
function setAppHeight(){ document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px'); }
['resize','orientationchange','pageshow'].forEach(ev => addEventListener(ev, setAppHeight));
if (window.visualViewport) visualViewport.addEventListener('resize', setAppHeight);
setAppHeight();

// ── state ───────────────────────────────────────────────────────────────────
const S = {
  division: 'samaritan',          // 'samaritan' | 'standard'
  view: 'books',                  // books|portions|chapters|sam_chapters|spread|verses|search
  panel: null,                    // null|compare|interpret|aramaic|arabic|commentary|samaritan_src
  samFont: false, samFontFull: false, english: false, dict: false,
  onlineDict: false,
  fontOffset: 0,
  book: null, bookName: '',
  portions: [], curPid: null,
  chList: [], chIdx: 0, chMode: 'standard',   // 'standard' | 'samaritan'
  curChId: null, curChNum: null, portionName: '',
  verses: [], verseFilter: null,
  commentarySel: null, samSrcChoice: null, tmSel: null,
  interpSam: false, interpLang: 'he',   // פירוש הפסוק view switches, panel-local
  searchReturn: false, searchFontOffset: 0,
  stack: [],                      // navigation breadcrumb stack for Back
};

const COMMENTATORS = [['rashi','רש"י'],['ramban','רמב"ן'],['cassuto','קאסוטו'],
                      ['baal_haturim','בעל הטורים']];
// ── the Samaritan calendar ───────────────────────────────────────────────────
// Baked out of the calendar project's own engine (scripts/calendar/build_calendar_data.py)
// into one small file per Gregorian year, so the date and the portion of the week
// are there even with no network — and the calendar site is never on the critical
// path of opening the Torah.
const CAL = { days:null, shabbat:null, today:null, week:null };
function _isoDay(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
                            + '-' + String(d.getDate()).padStart(2,'0'); }
async function loadSamCalendar(){
  const now = new Date();
  // the coming Sabbath (today, when today IS the Sabbath) may fall in the next year
  const sat = new Date(now); sat.setDate(sat.getDate() + ((6 - sat.getDay()) % 7));
  // A file holds one SAMARITAN year — Abib to Abib — so from January until Abib
  // today's date lives in the previous Gregorian year's file, not this one.
  const years = [...new Set([now.getFullYear() - 1, now.getFullYear(), sat.getFullYear()])];
  const days = {}, shabbat = {};
  for(const y of years){
    try{
      const r = await fetch('/static/data/calendar/' + y + '.json');
      if(!r.ok) continue;
      const j = await r.json();
      // the Canaan year belongs to the Samaritan year the file holds, so it is
      // stamped onto its days as they are merged with the neighbouring year's
      for(const [k, v] of Object.entries(j.days || {})) days[k] = Object.assign({y: j.canaan}, v);
      Object.assign(shabbat, j.shabbat || {});
    }catch(e){ /* offline and not yet cached — the app simply says nothing */ }
  }
  CAL.days = days; CAL.shabbat = shabbat;
  CAL.today = days[_isoDay(now)] || null;
  CAL.week = shabbat[_isoDay(sat)] || null;
  paintSamDate();
  if(S.view === 'books') showBooks();          // repaint if the list is already up
  else if(S.view === 'portions' && S.book) showPortions(S.book, S.bookName);
}
// the line under the title: 'ב׳ מן החדש החמישי', and the day's event after it
function paintSamDate(){
  const box = $('samDate'), run = $('samDateRun');
  if(!box || !run) return;
  const d = CAL.today;
  if(!d){ box.classList.add('empty'); run.textContent = ''; return; }
  let txt = d.d + ' מן החדש ' + d.m;
  if(d.y) txt += ' · שנת ' + d.y + ' לכניסה לכנען';
  if(d.ev && d.ev.length) txt += ' · ' + d.ev.join(' · ');
  run.textContent = txt;
  box.classList.remove('empty');
  // one line, centred: step the type down until it fits the width it is given.
  // setTimeout rather than requestAnimationFrame — rAF does not fire on a page
  // that is not compositing, and the line must still be sized correctly.
  setTimeout(() => fitSamDate(), 0);
}
// The line must never wrap or be clipped: from 11px down to 8px, stop at the first
// size that fits the track. Re-run on resize, since the width it has to fit changes
// with the window (and with the phone turning).
function fitSamDate(){
  const box = $('samDate'), run = $('samDateRun');
  if(!box || !run || !run.textContent) return;
  const avail = box.clientWidth - 2;
  if(avail <= 0) return;
  for(const px of [11, 10.5, 10, 9.5, 9, 8.5, 8]){
    run.style.fontSize = px + 'px';
    if(run.scrollWidth <= avail) return;
  }
}
let _samFitTimer = null;
addEventListener('resize', () => {
  clearTimeout(_samFitTimer);
  _samFitTimer = setTimeout(() => { fitSamDate(); fitBookPoem(); }, 120);
});

// is this portion the one read this coming Sabbath?
function isWeekPortion(portionId){
  return !!(CAL.week && CAL.week.id && portionId === CAL.week.id);
}
function isWeekBook(bookId){
  return !!(CAL.week && CAL.week.book && bookId === CAL.week.book);
}

const PANEL_MODES = ['compare','interpret','aramaic','arabic','commentary','samaritan_src','variants'];

// ── Samaritan rendering (ports _add_word_dots + _sam_markup) ─────────────────
function addWordDots(text){
  text = text.replace(/\.\s*:/g, ':').replace(/:\s*\./g, ':').replace(/\.\s*׃/g, '׃');
  const PAUSE = /[:.׃]$/;     // stop / standing / verse-end marks — no separator after these
  const out = [];
  for (const line of text.split('\n')){
    const toks = line.split(' ').filter(t => t !== '');
    const nt = [];
    for (let i=0;i<toks.length;i++){
      const tok = toks[i], nx = toks[i+1];
      // a word-separating dot is glued to the END of the current word, but not:
      // after a number, after a stop/standing/verse-end mark, at the end of the
      // line/chapter, or right before the verse-end (׃) / chapter-end (--) marks.
      const sep = tok && !/^\d+$/.test(tok) && !PAUSE.test(tok)
                  && i < toks.length-1 && nx && !nx.startsWith('׃') && !nx.startsWith('--');
      nt.push(sep ? tok + '·' : tok);
    }
    out.push(nt.join(' '));
  }
  return out.join('\n').replace(/ ?\./g, ' .');
}
function samMarkup(text){
  // Hebrew letter runs and the verse-pause period render in the Samaritan font; the
  // word-separating middot is wrapped in its own .wsep span so trimEdgeDots() can
  // drop the ones that land at a line break.
  let html=''; const re=/([א-ת]+|\.|·)/g; let last=0, m;
  while((m=re.exec(text))!==null){
    if(m.index>last) html += esc(text.slice(last,m.index));
    html += (m[0]==='·') ? '<span class="wsep">·</span>'
                         : '<span class="samchar">'+esc(m[0])+'</span>';
    last = re.lastIndex;
  }
  if(last<text.length) html += esc(text.slice(last));
  return html;
}
// Free-text variant of samMarkup for commentary/translation prose (not word-dot
// processed like verse text): wraps the 22 letters + the period in the alternate
// SamComment font (.samchar2), mirroring samMarkup()'s own convention for the main
// verse text exactly. Everything else — numbers, Latin text, whitespace, and every
// other punctuation/bracket/symbol ([ ] , " ~ ? : < > ; * - + ! @ # $ % ^ & ) ( …)
// — stays in the default (Hebrew) font, unchanged.
const SAM_FREE_RE = /([א-ת]+|\.)/g;
function samMarkupFree(text){
  let html=''; let last=0, m;
  SAM_FREE_RE.lastIndex = 0;
  while((m=SAM_FREE_RE.exec(text))!==null){
    if(m.index>last) html += esc(text.slice(last,m.index));
    html += '<span class="samchar2">'+esc(m[0])+'</span>';
    last = SAM_FREE_RE.lastIndex;
  }
  if(last<text.length) html += esc(text.slice(last));
  return html;
}
// strip Hebrew niqqud/cantillation (the combining marks block, ֑-ׇ) —
// commentary/translation prose sometimes carries pointing (e.g. quoted verses),
// but the Samaritan-script rendering never shows it; base letters (א-ת, a
// separate Unicode block) are untouched.
function stripNiqqud(text){ return (text||'').replace(/[֑-ׇ]/g, ''); }
// commentary/translation text, respecting the "כולל פירושים?" toggle — Samaritan
// script (SamComment) when samFont+samFontFull are both on, plain escaped text
// otherwise. In Samaritan mode: strip niqqud, then run the SAME word-separator-dot
// pass as the main verse text (addWordDots — no dot at a sentence end or right
// before an existing period), THEN wrap letters/period in the alternate font.
function commentaryText(text){
  if(!(S.samFont && S.samFontFull)) return esc(text||'');
  return samMarkupFree(addWordDots(stripNiqqud(text||'')));
}
// פירוש הפסוק text: unlike commentaryText() this keys off samFont ALONE, so a
// reader in Samaritan script gets the commentary in the fluent Samaritan
// commentary font (SamComment) without having to also turn on "כולל פירושים?".
function interpText(text){
  if(!S.samFont) return esc(text||'');
  return samMarkupFree(addWordDots(stripNiqqud(text||'')));
}
// Is a side/bottom panel currently showing? Samaritan-font mode normally
// suppresses panels and falls back to plain verse text, unless "כולל פירושים?"
// is on — but פירוש הפסוק renders UNDER the verses in its own font, so it stays
// available either way. Single source of truth: paintVerses and plainTextMode
// both read this, so the two can never disagree about what is on screen.
function panelActive(){
  return !!(S.panel && (!S.samFont || S.samFontFull || S.panel==='interpret'));
}
// After layout, hide every separator middot that ends a visual line (the next word
// wrapped to the line below). Re-run on zoom/resize so dots reappear when reducing
// the text pulls more words up onto the line. Two passes: reset → measure → hide.
function trimEdgeDots(vtext){
  const seps=[...vtext.querySelectorAll('.wsep')];
  if(!seps.length) return;
  seps.forEach(s=>{ s.style.display=''; });
  const toHide=[];
  for(const s of seps){
    // Compare the surrounding .samchar words' own positions, NOT the dot's own
    // box — the dot deliberately keeps a different (non-Samaritan) font since
    // the Samaritan webfont has no middle-dot glyph, and that font's differing
    // ascent/line-height metrics make the dot's OWN "top" an unreliable signal
    // (it can sit a visible fraction off the true line even with no wrap).
    // Comparing two same-font neighbours is immune to that.
    let n=s.nextElementSibling;
    while(n && !n.classList.contains('samchar')) n=n.nextElementSibling;
    let p=s.previousElementSibling;
    while(p && !p.classList.contains('samchar')) p=p.previousElementSibling;
    if(!n || !p || n.getBoundingClientRect().top > p.getBoundingClientRect().top + 1) toHide.push(s);
  }
  toHide.forEach(s=>{ s.style.display='none'; });
}
function trimAllEdgeDots(){
  if(!(S.samFont && !S.english)) return;
  document.querySelectorAll('#content .vrow .vtext').forEach(trimEdgeDots);
}
function scheduleDotTrim(){
  if(!(S.samFont && !S.english)) return;
  const run=()=>requestAnimationFrame(trimAllEdgeDots);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
}
let _dotTimer=null;
window.addEventListener('resize', ()=>{ clearTimeout(_dotTimer); _dotTimer=setTimeout(trimAllEdgeDots,160); });
function verseHTML(v){
  if(S.english){ const e=v.english||('[verse '+v.number+']'); return {html:esc(e), cls:'vtext eng'}; }
  if(S.samFont) return {html:samMarkup(addWordDots(v.text||'')), cls:'vtext'};
  return {html:esc(v.text||''), cls:'vtext'};
}
function fsize(){ return (S.samFont?19:20) + S.fontOffset; }

// ── division toggle ──────────────────────────────────────────────────────────
$('btnStandard').onclick = () => setDivision('standard');
$('btnSamaritan').onclick = () => setDivision('samaritan');
function setDivision(d){
  S.division = d;
  $('btnStandard').classList.toggle('active', d==='standard');
  $('btnSamaritan').classList.toggle('active', d==='samaritan');
  showSearch(false);
  showBooks();
}

// ── breadcrumb ───────────────────────────────────────────────────────────────
function setCrumbs(items){            // items: [{t, fn}]  (rightmost = first)
  const bar = $('crumbs');
  bar.querySelectorAll('.crumb, .sep').forEach(e=>e.remove());   // keep #bmAddBtn pinned in the corner
  items.forEach((it,i)=>{
    const c = el('button', 'crumb'+(it.fn?'':' static'), esc(it.t));
    if(it.fn) c.onclick = it.fn;
    bar.appendChild(c);
    if(i<items.length-1) bar.appendChild(el('span','sep','‹'));
  });
}

// ── books ────────────────────────────────────────────────────────────────────
async function showBooks(){
  S.view='books'; S.stack=[]; setView();
  setCrumbs([{t:'בחר ספר'}]);
  $('backBtn').disabled = true;
  const mode = S.division==='samaritan'?'samaritan':'standard';
  const books = await api('books?mode='+mode);
  S.books = books; S.booksMode = mode;          // cached for cross-book chapter paging
  const c = $('content'); c.innerHTML='';
  for(const b of books){
    const label = S.division==='samaritan'
      ? `${esc(b.name)} <small>(${b.n_portions}-${b.n_chapters})</small>` : esc(b.name);
    const mark = (S.division==='samaritan' && isWeekBook(b.id))
      ? `<span class="week-mark">⟶ ${esc(t('week_portion'))} · ${esc(CAL.week.name)}</span>` : '';
    const btn = el('button','listbtn'+(mark?' is-week':''),
      `<img class="ico" src="/static/img/icon_book_dark.png" alt=""><span>${label}</span>${mark}`);
    btn.onclick = ()=>showPortions(b.id, b.name);
    c.appendChild(btn);
  }
  c.appendChild(bookPoem());
}

// ── the poem in the space under the book list ────────────────────────────────
// Five couplets, each split at its colon: what stands before the colon is the
// right column, what stands after it the left. Both columns keep one width all
// the way down and the words inside a half are spread to fill it, so the poem
// reads as the table it is on the page — without any of the rules drawn.
// Set in the face the Torah's text is read in, marks and all.
const BOOKS_POEM = [
  ['סיחון סיחוניך עדן:',      'משקה החיים מגן עדן.'],
  ['הן הוה הים מלא מן מים:',  'כן כתבה מלא רחמים:'],
  ['המאור הגדול יתכסה:',      'ונהר כתבה לא יתכסה:'],
  ['מן הוה בכתבה דביק:',      'יהי אנש טב וצדיק:'],
  ['מן דרש אלה עליו יחמל:',   'לא יסור ימין ושמאל:-'],
];
// The rule that frames the poem, above it and (turned about) below it: two lines
// running the width of the page, a point set in the middle of them, and at one
// end the quill — two feathers lying along the line, its shaft sweeping up into
// an open curl. Drawn once and used twice; the lower one is the same rule turned
// through half a circle, so the curl falls at the other end.
function ornRule(cls){
  const s = el('div','orn-rule'+(cls?' '+cls:''));
  s.innerHTML =
    '<svg viewBox="0 0 1000 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
    + '<g fill="none" stroke="#6b4d1e" stroke-linecap="round">'
    +   '<path d="M4 52 H735" stroke-width="2.4"/>'
    +   '<path d="M24 60 H690" stroke-width=".9"/>'
    +   '<path d="M735 52 C 792 52 830 44 856 30" stroke-width="1.8"/>'
    +   '<path d="M690 60 C 750 60 792 52 820 40" stroke-width=".9"/>'
    +   '<path d="M856 30 C 884 14 918 12 932 24 C 946 36 936 54 916 54 C 900 54 892 42 900 32" stroke-width="1.5"/>'
    +   '<path d="M820 40 C 852 28 876 24 892 28" stroke-width=".85"/>'
    + '</g>'
    + '<path d="M762 48 C 792 34 834 27 856 29 C 834 44 796 54 762 48 Z" fill="#8a6a2c"/>'
    + '<path d="M668 57 C 692 49 716 45 730 47 C 714 57 690 61 668 57 Z" fill="#c2ab84"/>'
    + '<circle cx="368" cy="52" r="2.6" fill="#6b4d1e"/>'
    + '</svg>';
  return s;
}
function bookPoem(){
  const wrap = el('div','bkpoem'), frame = el('div','ornframe'), grid = el('div','bkpoem-grid');
  for(const couplet of BOOKS_POEM)
    for(const half of couplet) grid.appendChild(el('div','bkpoem-cell', esc(half)));
  frame.appendChild(ornRule());
  frame.appendChild(grid);
  frame.appendChild(ornRule('bot'));
  wrap.appendChild(frame);
  // setTimeout rather than rAF, which does not fire on a page that is not
  // compositing; and again once the Torah face is in, since it is measured.
  setTimeout(fitBookPoem, 0);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitBookPoem);
  return wrap;
}
// It may never break a line and never be cut off, at any width: measure the poem
// at its full size and take the type down to whatever room the screen gives it.
const POEM_MAX = 23, POEM_MIN = 7;
function fitBookPoem(){
  const wrap = document.querySelector('.bkpoem'); if(!wrap) return;
  const grid = wrap.querySelector('.bkpoem-grid'), cs = getComputedStyle(wrap);
  if(!grid) return;
  // the room is the wrapper's CONTENT box: clientWidth still carries its padding
  const avail = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 1;
  if(avail <= 0) return;                       // not on screen yet
  grid.style.fontSize = POEM_MAX + 'px';
  const nat = grid.getBoundingClientRect().width;    // never shrinks: flex 0 0 auto
  if(!nat) return;
  let px = Math.max(POEM_MIN, Math.min(POEM_MAX, POEM_MAX * avail / nat));
  grid.style.fontSize = px.toFixed(2) + 'px';
  const got = grid.getBoundingClientRect().width;    // one pass for the rounding
  if(got > avail) grid.style.fontSize = Math.max(POEM_MIN, px * avail / got).toFixed(2) + 'px';
}

// make sure the book list (for the current division) is cached, so chapter paging
// can carry the reader across book boundaries even on a deep-linked verse page.
async function ensureBooks(){
  const mode = S.division==='samaritan'?'samaritan':'standard';
  if(S.books && S.booksMode===mode) return;
  S.books = await api('books?mode='+mode); S.booksMode = mode;
}

// ── portions ─────────────────────────────────────────────────────────────────
async function showPortions(bookId, bookName){
  S.view='portions'; S.book=bookId; S.bookName=bookName; setView();
  S.stack=[{t:bookName, fn:()=>showBooks()}];
  setCrumbs([{t:bookName, fn:()=>showBooks()}]);
  $('backBtn').disabled = false;
  const mode = S.division==='samaritan'?'samaritan':'standard';
  S.portions = await api(`portions?book_id=${bookId}&mode=${mode}`);
  const c = $('content'); c.innerHTML='';
  for(const p of S.portions){
    const label = S.division==='samaritan'
      ? `${esc(p.name)} <small>(${p.n_chapters})</small>` : esc(p.name);
    const mark = (S.division==='samaritan' && isWeekPortion(p.id))
      ? `<span class="week-mark">${esc(t('week_portion'))}</span>` : '';
    const btn = el('button','listbtn'+(mark?' is-week':''),
      `<img class="ico" src="/static/img/icon_portion_dark.png" alt=""><span>${label}</span>${mark}`);
    btn.onclick = ()=> S.division==='samaritan'
      ? showSamChapters(p.id, p.name) : showChapters(p.id, p.name);
    c.appendChild(btn);
  }
  $('spreadBtn').classList.remove('hidden');
}
$('spreadBtn').onclick = ()=>showSpread();

async function showSpread(){
  S.view='spread'; setView();
  setCrumbs([{t:S.bookName, fn:()=>showPortions(S.book,S.bookName)}, {t:'פריסת פרקים'}]);
  const c=$('content'); c.innerHTML='';
  c.appendChild(el('div','hint','בחר פרק'));
  const grid = el('div','grid g15');
  if(S.division==='samaritan'){
    const ch2port = {};
    for(const p of S.portions){
      const scs = await api('sam_chapters?portion_id='+p.id);
      for(const sc of scs) if(!(sc.id in ch2port)) ch2port[sc.id]=p;
    }
    const rows = await api('sam_chapters?book_id='+S.book);
    for(const r of rows){
      const p = ch2port[r.id]||{id:null,name:''};
      const b=el('button','cell',String(r.number));
      b.onclick=()=>{ S.curPid=p.id; S.portionName=p.name;
        openSamChapter(r.id, r.number, p.id, p.name, false); };
      grid.appendChild(b);
    }
  } else {
    const rows = await api('chapters?book_id='+S.book);
    for(const r of rows){
      const p = portionForChapter(r.number);
      const b=el('button','cell',String(r.number));
      b.onclick=()=>{ S.curPid=p.id; S.portionName=p.name;
        openChapter(r.id, r.number, p.id, p.name, false); };
      grid.appendChild(b);
    }
  }
  c.appendChild(grid);
}
function portionForChapter(num){
  for(const p of S.portions) if(p.start_ch<=num && num<=p.end_ch) return p;
  return {id:null,name:''};
}

// ── chapter lists ────────────────────────────────────────────────────────────
async function showChapters(pid, pname){
  S.view='chapters'; S.curPid=pid; S.portionName=pname; setView();
  setCrumbs([{t:S.bookName, fn:()=>showPortions(S.book,S.bookName)}, {t:pname}]);
  S.stack=[{t:S.bookName, fn:()=>showPortions(S.book,S.bookName)},
           {t:pname, fn:()=>showChapters(pid,pname)}];
  navState('portion');
  const rows = await api('chapters?portion_id='+pid);
  renderChapterGrid(rows, 'בחר פרק', (r)=>openChapter(r.id, r.number, pid, pname, false));
}
async function showSamChapters(pid, pname){
  S.view='sam_chapters'; S.curPid=pid; S.portionName=pname; setView();
  setCrumbs([{t:S.bookName, fn:()=>showPortions(S.book,S.bookName)}, {t:pname}]);
  S.stack=[{t:S.bookName, fn:()=>showPortions(S.book,S.bookName)},
           {t:pname, fn:()=>showSamChapters(pid,pname)}];
  navState('portion');
  const rows = await api('sam_chapters?portion_id='+pid);
  renderChapterGrid(rows, 'בחר פרק שומרוני', (r)=>openSamChapter(r.id, r.number, pid, pname, false), true);
}
function renderChapterGrid(rows, hint, onClick, isSam){
  const c=$('content'); c.innerHTML='';
  c.appendChild(el('div','hint',hint));
  // Samaritan chapters carry their opening two words (incipit) under the number, to
  // help identify each chapter; standard chapters have no 'opening' and stay compact.
  const hasIncipit = rows.some(r=>r.opening);
  const grid=el('div','grid '+(hasIncipit?'g3 incipit-grid':'g5'));
  for(const r of rows){
    const b=el('button','cell'+(r.opening?' has-incipit':''));
    b.appendChild(el('span','cell-num',String(r.number)));
    if(r.opening) b.appendChild(el('span','cell-incipit',esc(r.opening)));
    const hasAudio = isSam
      ? (typeof readingFor==='function' && readingFor(r.number, S.book))
      : (typeof masorotFor==='function' && masorotFor(S.book, r.number).length);
    if(hasAudio) b.appendChild(el('span','cell-audio','♪'));   // chapter has a reading witness
    b.onclick=()=>onClick(r);
    grid.appendChild(b);
  }
  c.appendChild(grid);
}

// ── opening a chapter (verses) ───────────────────────────────────────────────
async function openChapter(chId, chNum, pid, pname, fromSearch){
  if(!fromSearch) S.verseFilter=null;
  S.appReturn=null;                 // a fresh chapter open ends any source-app return
  S.chMode='standard'; S.curPid=pid; S.portionName=pname;
  const rows = await api('chapters?portion_id='+pid);
  S.chList = rows.map(r=>({id:r.id, number:r.number}));
  S.chIdx = Math.max(0, S.chList.findIndex(x=>x.id===chId));
  await renderVerses(chId, chNum, pid, pname);
}
async function openSamChapter(samId, samNum, pid, pname, fromSearch){
  if(!fromSearch) S.verseFilter=null;
  S.appReturn=null;                 // a fresh chapter open ends any source-app return
  S.chMode='samaritan'; S.curPid=pid; S.portionName=pname;
  const rows = await api('sam_chapters?portion_id='+pid);
  S.chList = rows.map(r=>({id:r.id, number:r.number}));
  S.chIdx = Math.max(0, S.chList.findIndex(x=>x.id===samId));
  await renderVerses(samId, samNum, pid, pname);
}

async function renderVerses(chId, chNum, pid, pname){
  if(typeof ttsStop==='function') ttsStop();   // a new chapter ends any read-aloud
  if(typeof readingStop==='function') readingStop();   // …and any reading recording
  S.view='verses'; S.curChId=chId; S.curChNum=chNum; setView();
  await ensureBooks();   // populate S.books so the nav buttons can relabel at book edges
  const isSam = S.chMode==='samaritan';
  S.verses = isSam ? await api('sam_verses?sam_ch_id='+chId)
                   : await api('verses?chapter_id='+chId+(pid?('&portion_id='+pid):''));
  S.canonNote = isSam ? await api('canon_note?sam_ch_id='+chId) : null;
  let chLabel = isSam ? ('פרק שומרוני '+chNum) : ('פרק '+chNum);
  if(isSam && S.verses.length){          // append the 4 words that open the chapter
    const w=(S.verses[0].text||'').trim().split(/\s+/).filter(Boolean).slice(0,4).join(' ');
    if(w) chLabel += ' (' + w + ')';
  }
  setCrumbs([
    {t:S.bookName, fn:()=>showPortions(S.book,S.bookName)},
    {t:pname, fn:()=> isSam ? showSamChapters(pid,pname) : showChapters(pid,pname)},
    {t:chLabel},
  ]);
  navState('chapter');
  document.querySelectorAll('.verse-bless').forEach(e=>e.remove());   // clear on navigation
  _blessBusy=false; _blessNext=null; _cueFired.clear();   // a new chapter, blessed afresh
  if(SHOW_PRON) await ensurePron();          // pronunciation preview data for this chapter
  paintVerses();
  if(isSam) blessOnLanding(chNum);
}
// ── blessings floated over a chapter as the reader lands on it ───────────────
// Samaritan division only. Each is the community's own praise at that place, and
// each is replayed on every landing rather than once per session.
//   ctx.opens(s)  — the chapter BEGINS with these words (skeleton-matched, so the
//                   spelling of the text itself never breaks the rule)
//   ctx.has(s)    — some verse of the chapter begins with them
//   ctx.prevWord  — the last word of the previous Samaritan chapter (from the server)
// 'שלום יהוה על הנביא…' answers three different places, so it is written once
const BLESS_MOSHE = 'שלום יהוה על הנביא הצדיק התמים הטהור הנאמן משה';
// דברים — the chapters of the rebuke, from 'והיה אם לא תשמע' through 'אם לא תשמר',
// eight consecutive chapters. Named by their openings rather than their numbers,
// so a renumbering of the Samaritan chapters can never move the rule off them.
const DEUT_REBUKE = [
  'והיה אם לא תשמע בקול יהוה אלהיך',
  'יכך יהוה בשחפת ובקדחת',
  'יכך יהוה בשחין מצרים',
  'יוליך יהוה אתך ואת מלכך',
  'ישא יהוה עליך גוי מרחק',
  'האיש הרך בך והענג מאד',
  'הרכה בך וענגה',
  'אם לא תשמר לעשות את כל דברי התורה הזאת',
];
const BLESSINGS = [
  { text:'שלום יהוה על משה',                          // Moses' birth, שמות ב׳:1
    when: c => c.book===2 && c.has('וילך איש מבית לוי') },
  { text:'ישתבח יהוה אלהים : ברוך יהוה אלהים',        // בראשית, Samaritan chapter 10
    when: c => c.book===1 && c.num===10 },
  { text:'ישתבח קעימה דלא מת',                         // after a chapter that ended 'וימת'
    when: c => c.book===1 && c.prevWord==='וימת' },
  { text:'ישתבח אלהים לית אלה אלא אחד',                // שמע ישראל, in דברים
    when: c => c.book===5 && c.opens('שמע ישראל יהוה אלהינו') },
  { text:'יתגלג קראה דקרא עסרתי מליה:',                // the Ten Words, in שמות
    when: c => c.book===2 && c.opens('וידבר אלהים את כל הדברים האלה לאמר') },
  { text:'יתרבה זה השם הקדוש',                         // אהיה אשר אהיה, in שמות
    when: c => c.book===2 && c.opens('ויאמר אלהים אל משה אהיה אשר אהיה') },
  { text:BLESS_MOSHE,                                  // the day the tabernacle was raised
    when: c => c.book===4 && c.opens('וביום הוקם את המשכן') },
  { text:BLESS_MOSHE,                                  // וביום השמיני עצרת, in פרשת פינחס
    when: c => c.book===4 && c.opens('וביום השמיני עצרת') },
  { text:'אדני יהוה שוב מחרון אפך',                    // every chapter of the rebuke in דברים
    when: c => c.book===5 && DEUT_REBUKE.some(o => c.opens(o)) },
];
async function blessOnLanding(chNum){
  const first = _vfold((S.verses[0] || {}).text || '');
  const ctx = {
    book: S.book, num: chNum, prevWord: null,
    opens: str => first.startsWith(_vfold(str)),
    has: str => S.verses.some(v => _vfold(v.text||'').startsWith(_vfold(str))),
  };
  // only fetched when a rule could actually turn on it, so no chapter pays for it
  if(S.book === 1){
    try{ const m = await api('sam_chapter_marks?sam_ch_id=' + S.curChId); ctx.prevWord = m && m.prev_last_word; }
    catch(e){}
    if(S.curChNum !== chNum) return;        // the reader moved on while we asked
  }
  const hit = BLESSINGS.find(b => { try{ return b.when(ctx); }catch(e){ return false; } });
  if(hit) playVerseBlessing(hit.text);
}
// Only one blessing is on the screen at a time. A second place reached while the
// first is still showing waits for it (one deep — a reader moving fast is not
// owed a queue of them), and the wait is dropped when the chapter changes.
let _blessBusy = false, _blessNext = null;
function queueVerseBlessing(text){
  if(!text) return;
  if(_blessBusy){ _blessNext = _blessNext || text; return; }
  playVerseBlessing(text);
}
function playVerseBlessing(text){
  document.querySelectorAll('.verse-bless').forEach(e=>e.remove());
  const c=$('content'); const rect=c.getBoundingClientRect();
  if(rect.width<10) return;
  const ov=el('div','verse-bless', esc(text || 'שלום יהוה על משה'));
  Object.assign(ov.style,{ left:rect.left+'px', top:rect.top+'px',
    width:rect.width+'px', height:rect.height+'px' });
  document.body.appendChild(ov);
  // a translucent rise-and-dissolve so the verse behind stays readable throughout
  const a=ov.animate([
    { opacity:0,   transform:'scale(.94)' },
    { opacity:.42, transform:'scale(1)',    offset:.18 },
    { opacity:.34, transform:'scale(1.03)', offset:.55 },
    { opacity:0,   transform:'scale(1.08)' },
  ], { duration:5200, easing:'ease-in-out' });
  _blessBusy = true;
  let gone=false;
  const done=()=>{
    if(gone) return;
    gone=true; ov.remove(); _blessBusy=false;
    const nx=_blessNext; _blessNext=null;
    if(nx) setTimeout(()=>{ if(!_blessBusy && S.view==='verses') playVerseBlessing(nx); }, 400);
  };
  a.onfinish=done; a.oncancel=done; setTimeout(done, 5600);
}

// ── blessings the reading itself calls for, rather than the landing ──────────
// Not answers to a chapter's opening but to a place reached in it: the end of any
// verse closing with 'כאשר צוה יהוה את משה', the verse telling that the work of
// the tabernacle was finished, and the end of each chapter of the rebuke in
// פרשת אם בחקתי. A cue is planted at the point that has to be reached — after the
// verse for an end, before it for an entry — and an observer on the scrolling
// area fires it the first time it is scrolled into view. Once per chapter: a
// repaint (a font change, a panel opened) re-plants the cues but never re-blesses
// a place already blessed.
const LEV_REBUKE = [    // אם בחקתי, through 'והנשארים בכם והבאתי מרך בלבבם'
  'אם בחקתי תלכו',
  'ואם לא תשמעו לי',
  'ואם עד אלה לא תשמעו לי',
  'ואם באלה לא תוסרו לי',
  'ואם בזאת לא תשמעו לי',
  'והנשארים בכם והבאתי מרך בלבבם',
];
function readingCues(){
  const out = [], verses = S.verses || [];
  const closing = _vfold('כאשר צוה יהוה את משה');
  for(const v of verses){
    const f = _vfold(v.text||'');
    if(!f) continue;
    if(f.endsWith(closing)) out.push({vid:v.id, where:'after', text:BLESS_MOSHE + '.'});
    if(S.book===2 && f.startsWith(_vfold('ותכל כל עבדת המשכן')))
      out.push({vid:v.id, where:'before',
                text:'מרי השיב עלינן מן ברכת הנביא הצדיק התמים הטהור הנאמן משה.'});
  }
  // the rebuke — at the END of the chapter, and only in the Samaritan division,
  // where each of these is a chapter of its own
  const first = _vfold((verses[0]||{}).text || ''), last = verses[verses.length-1];
  if(S.chMode==='samaritan' && S.book===3 && last
     && LEV_REBUKE.some(o => first.startsWith(_vfold(o))))
    out.push({vid:last.id, where:'after', text:'אדני יהוה סלח נא לעון העם הזה כגדל חסדך.'});
  return out;
}
let _cueMarks = [], _cueFired = new Set(), _cueLive = false, _cueTimer = null;
function armReadingBlessings(){
  _cueLive = false; _cueMarks = [];
  document.querySelectorAll('.bless-cue').forEach(e => e.remove());
  if(S.view !== 'verses') return;
  const root = $('content'); if(!root) return;
  for(const cue of readingCues()){
    const key = cue.vid + ':' + cue.where;
    if(_cueFired.has(key)) continue;
    const row = root.querySelector('.vrow[data-vid="'+cue.vid+'"]');
    if(!row || !row.parentNode) continue;
    const mark = el('i','bless-cue');
    mark.dataset.text = cue.text; mark.dataset.key = key;
    row.parentNode.insertBefore(mark, cue.where==='before' ? row : row.nextSibling);
    _cueMarks.push(mark);
  }
  if(!_cueMarks.length) return;
  // a moment's grace, so a blessing owed to the landing has the screen to itself
  setTimeout(() => { if(S.view==='verses'){ _cueLive = true; cueCheck(); } }, 1400);
}
// a cue is reached when its mark stands inside the reading area. Measured on the
// scroll rather than watched by an observer: the mark is a zero-height line in
// the flow, and comparing rectangles answers the same question everywhere.
function cueCheck(){
  if(!_cueLive || !_cueMarks.length) return;
  const root = $('content'); if(!root) return;
  const r = root.getBoundingClientRect();
  for(const m of _cueMarks){
    if(!m.isConnected || _cueFired.has(m.dataset.key)) continue;
    const b = m.getBoundingClientRect();
    if(b.top <= r.bottom && b.bottom >= r.top){
      _cueFired.add(m.dataset.key);                 // each place blesses once
      queueVerseBlessing(m.dataset.text);
    }
  }
}
(function(){
  const root = $('content'); if(!root) return;
  root.addEventListener('scroll', () => {
    if(!_cueLive || _cueTimer) return;
    _cueTimer = setTimeout(() => { _cueTimer = null; cueCheck(); }, 120);
  }, {passive:true});
})();

// the actual verse-area painter (re-run on every mode/filter/font change)
function paintVerses(){
  const c=$('content'); c.innerHTML='';
  c.classList.toggle('sam', S.samFont && !S.english);   // enables Samaritan justify
  c.classList.toggle('samfull', S.samFont && S.samFontFull);   // justify + styling for commentaryText() panels
  if(!S.verses.length){ c.appendChild(el('div','note','אין פסוקים')); return; }
  // admin-only chapter tools: merge with next / split here (current division)
  if(ADMIN.token){
    const bar=el('div','admin-bar');
    if(S.splitMode){
      bar.appendChild(el('span','admin-hint', t('split_pick')));
      const cancel=el('button','admin-btn cancel', t('split_cancel'));
      cancel.onclick=()=>{ S.splitMode=false; paintVerses(); };
      bar.appendChild(cancel);
    } else if(S.vsplitMode){
      bar.appendChild(el('span','admin-hint', t('vsplit_pick')));
      const cancel=el('button','admin-btn cancel', t('split_cancel'));
      cancel.onclick=()=>{ S.vsplitMode=false; paintVerses(); };
      bar.appendChild(cancel);
    } else if(S.renumMode){
      bar.appendChild(el('span','admin-hint', t('renum_pick')));
      const cancel=el('button','admin-btn cancel', t('split_cancel'));
      cancel.onclick=()=>{ S.renumMode=false; paintVerses(); };
      bar.appendChild(cancel);
    } else if(S.vmergeMode){
      bar.appendChild(el('span','admin-hint',
        S.vmergeMode==='prev' ? t('vmerge_pick_prev') : t('vmerge_pick_next')));
      const cancel=el('button','admin-btn cancel', t('split_cancel'));
      cancel.onclick=()=>{ S.vmergeMode=null; paintVerses(); };
      bar.appendChild(cancel);
    } else {
      const mb=el('button','admin-btn', t('merge_next')); mb.onclick=mergeNext;
      bar.appendChild(mb);
      if(S.chMode==='samaritan'){          // verse split + renumber → Samaritan-only
        const vb=el('button','admin-btn', t('split_verse'));
        vb.onclick=()=>{ S.vsplitMode=true; paintVerses(); };
        bar.appendChild(vb);
        const rb=el('button','admin-btn', t('renum')); rb.onclick=()=>{ S.renumMode=true; paintVerses(); };
        bar.appendChild(rb);
        // merge a verse into the one above it, or swallow the one below — either
        // way the pair ends up under the EARLIER number
        for(const dir of ['prev','next']){
          const b=el('button','admin-btn', t(dir==='prev' ? 'vmerge_prev' : 'vmerge_next'));
          b.onclick=()=>{ S.vmergeMode=dir; paintVerses(); };
          bar.appendChild(b);
        }
      }
      const sb=el('button','admin-btn', t('split_chapter')); sb.onclick=()=>{ S.splitMode=true; paintVerses(); };
      bar.appendChild(sb);
    }
    c.appendChild(bar);
  }
  // reading inside the portion of the week, in the Samaritan division: say so,
  // right above the play bar
  if(S.chMode==='samaritan' && isWeekPortion(S.curPid)){
    const w = el('div','week-banner');
    w.textContent = t('week_portion_here').replace('{p}', (CAL.week && CAL.week.name) || '');
    c.appendChild(w);
  }
  if(typeof readingBar==='function') readingBar(c);   // chanted-reading recording, if one exists
  const all = S.verses;
  const verses = S.verseFilter!=null ? all.filter(v=>v.id===S.verseFilter) : all;
  // when a single verse is filtered (e.g. arrived from a search result), show a
  // prominent "clear filter" button at the top — in every view mode.
  if(S.verseFilter!=null){
    const bar=el('div','clear-filter-bar');
    const btn=el('button','clear-filter-btn','נקה סינון');
    btn.onclick=()=>filterVerse(null);
    bar.appendChild(btn); c.appendChild(bar);
  }
  // "כולל פירושים?" (samFontFull) lets the reader keep the Samaritan-font mode ON
  // while still viewing a source/translation/commentary panel underneath it —
  // normally samFont suppresses all panels, falling back to plain verse text.
  const usePanel = panelActive();

  if(usePanel && S.panel!=='compare'){
    addNumStrip(c, all);
    if(S.panel==='commentary'){ addPlainRows(c, verses); buildCommentary(c, verses); }
    else if(S.panel==='samaritan_src'){ if(S.samSrcChoice!=='translit') addPlainRows(c, verses); buildSamSrc(c, verses); }
    else if(S.panel==='variants'){ buildVariantsView(c, verses); }
    else if(S.panel==='interpret'){ addPlainRows(c, verses); buildInterpret(c, verses); maybeDict(c, verses); }
    else if(S.panel==='aramaic'){ buildAramaic(c, verses); maybeDict(c, verses); }
    else if(S.panel==='arabic'){ buildArabic(c, verses); maybeDict(c, verses); }
  } else if(usePanel && S.panel==='compare'){
    addNumStrip(c, all); buildCompare(c, verses);
  } else if(S.dict && !S.english){
    buildDictSelect(c, verses);               // word-by-word picker (underline → tap a word)
  } else {
    if(S.english) c.appendChild(el('div','eng-credit',
      '<b>The Samaritan Pentateuch</b><br>An English Translation with a Parallel Annotated Hebrew Text<br>Moshe Florentin and Abraham Tal'));
    addPlainRows(c, verses);
    // three centered asterisks marking the end of a Samaritan portion: shown
    // after the last verse of the portion's last chapter (Samaritan original text).
    if(S.chMode==='samaritan' && !S.english && S.verseFilter==null
       && Array.isArray(S.chList) && S.chList.length && S.chIdx===S.chList.length-1)
      c.appendChild(el('div','portion-end','✶ ✶ ✶'));
    // fixed canon marker: shown after the LAST Samaritan chapter of a book,
    // documenting the permanent chapter count set by the project owner.
    if(S.chMode==='samaritan' && !S.english && S.verseFilter==null && S.canonNote){
      const cn=el('div','canon-note');
      if(S.canonNote.count!=null){
        cn.appendChild(el('div','canon-note-count', 'סה"כ '+S.canonNote.count+' פרקים בחלוקה השומרונית'));
        cn.appendChild(el('div','canon-note-text', S.canonNote.note));
      }
      // the same one level down: at the end of a portion, its own signature —
      // and, for an admin, the button that engraves it
      const P = S.canonNote.portion;
      if(P){
        if(P.count!=null){
          cn.appendChild(el('div','canon-note-count',
            'פרשת '+P.name+' — '+P.count+' פרקים בחלוקה השומרונית'));
          cn.appendChild(el('div','canon-note-text', P.note||''));
        }
        if(ADMIN.token){
          const wholeBook = S.canonNote.count!=null;   // the book's last chapter as well
          const b=el('button','admin-btn canon-set-btn',
                     t(wholeBook ? 'canon_set_book' : 'canon_set') + ' (' + P.live + ')');
          b.onclick=()=>setCanon(P.sam_ch_id, P.name, P.live, wholeBook);
          cn.appendChild(b);
          if(P.count!=null && P.count!==P.live)
            cn.appendChild(el('div','canon-note-text canon-drift',
              t('canon_drift').replace('{a}', P.live).replace('{b}', P.count)));
        }
      }
      if(cn.children.length) c.appendChild(cn);
    }
  }
  scheduleDotTrim();   // drop justification dots that fall at a line edge (Samaritan font)
  armReadingBlessings();   // plant the cues for blessings the reading itself calls for
}

function addPlainRows(c, verses){
  const fs = fsize();
  for(const v of verses){
    if(!(v.text||'').trim() && !S.english) continue;
    const row = el('div','vrow'); row.dataset.vid = v.id;   // for read-aloud highlighting
    const numActive = S.verseFilter===v.id ? ' active':'';
    const num = el('button','num'+numActive, String(v.number));
    num.onclick=()=>{
      if(ADMIN.token && S.splitMode)  return askSplit(v);
      if(ADMIN.token && S.vsplitMode) return openVsplit(v);
      if(ADMIN.token && S.renumMode)  return openRenumber(v);
      if(ADMIN.token && S.vmergeMode) return askMergeVerse(v, S.vmergeMode);
      return filterVerse(v.id);
    };
    const vh = verseHTML(v);
    const t = el('div', vh.cls, vh.html);
    t.style.fontSize = (S.english?17:fs)+'px';
    if(S.english){ row.appendChild(num); row.appendChild(t); }
    else { row.appendChild(t); row.appendChild(num); }
    addPencil(row, v.id, S.english?'english':'text', ()=> S.english?(v.english||''):(v.text||''));
    c.appendChild(row);
    // live pronunciation preview: transcription → the pointed Hebrew the TTS will speak
    if(SHOW_PRON && !S.english){
      const pt = (PRON[v.id]||'').trim();
      if(pt){
        const pr = el('div','vpron');
        pr.innerHTML = '<span class="vpron-lat">'+esc(pt)+'</span>'
                     + '<span class="vpron-arrow">→</span>'
                     + '<span class="vpron-heb">'+esc(ttsHeb(pt))+'</span>';
        c.appendChild(pr);
      }
    }
  }
}

function addNumStrip(c, all){
  const strip = el('div','numstrip');
  // (the "clear filter" button now lives at the top of the view, in paintVerses)
  for(const v of all){
    const b=el('button','num'+(S.verseFilter===v.id?' active':''), String(v.number));
    b.onclick=()=>filterVerse(v.id); strip.appendChild(b);
  }
  c.appendChild(strip);
}
function filterVerse(id){ S.verseFilter=id; paintVerses(); }

// ── panel builders ───────────────────────────────────────────────────────────
function panelEl(title, bodyHTML, bodyCls){
  const p=el('div','panel');
  p.appendChild(el('div','ptitle',esc(title)));
  const b=el('div','pbody'+(bodyCls?(' '+bodyCls):''), bodyHTML);
  b.style.fontSize=(fsize())+'px';
  p.appendChild(b); return p;
}
function pairEl(left,right){ const d=el('div','pair'); d.appendChild(left); d.appendChild(right); return d; }
function origPanel(verses){
  const txt = verses.map(v=>`${v.number}  ${esc(v.text||'')}`).join('\n');
  return panelEl('הטקסט המקורי', txt);
}

async function buildCompare(c, verses){
  const ver = S.cmpVersion || 'masoretic';
  const fs=fsize();
  const render = toks => toks.map(t=> t[1]?`<span class="diff">${esc(t[0])}</span>`:esc(t[0])).join(' ');
  const renderNoNum = toks => render(toks.slice(1));   // drop the leading number token
  // verse-number label with the chapter prefixed before verse 1 (e.g. "20:1")
  const numLabel = v => { const n=String(v.number);
    return (n==='1') ? ((v.jchapter!=null?v.jchapter:S.curChNum)+':1') : n; };

  // ── Targum Onkelos: THREE columns — Samaritan source · Samaritan Aramaic · Onkelos —
  //    with the diff marked between the two ARAMAIC columns; a dashed line where a
  //    Samaritan-Aramaic verse has no Onkelos counterpart. ──────────────────────────
  if(ver==='onkelos'){
    const ph=el('div','note','טוען השוואה…'); c.appendChild(ph);
    const data = await apiPost('compare', {verses: verses.map(v=>({
      sam_num:v.number, mas_num:v.number,
      text:v.sam_aramaic||'', masoretic_text:v.onkelos_text||'' }))});
    ph.remove();
    const grid=el('div','cmp-grid cmp-grid3');
    grid.appendChild(el('div','cmp-cell cmp-head', t('cmp_source')));
    grid.appendChild(el('div','cmp-cell cmp-head', t('cmp_aram')));
    const oh=el('div','cmp-cell cmp-head'); oh.appendChild(document.createTextNode(t('cv_onkelos')+' '));
    const info=el('span','cmp-info'); info.textContent='ⓘ'; info.title=t('cmp_info');
    info.setAttribute('role','button'); info.tabIndex=0; info.setAttribute('aria-label',t('cmp_info'));
    const showOnk=()=>showInfo(t('cv_onkelos'), `<div class="ver-info">${esc(t('ci_onkelos'))}</div>`);
    info.onclick=showOnk; info.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); showOnk(); } };
    oh.appendChild(info); grid.appendChild(oh);
    verses.forEach((v,i)=>{
      const d=data[i]; if(!d) return;
      const src=esc(v.text||'').trim();
      const aram=renderNoNum(d.sam).trim();
      const hasOnk=(v.onkelos_text||'').trim().length>0;
      const onk=renderNoNum(d.mas).trim();
      if(!src && !aram && !hasOnk) return;
      const sc=el('div','cmp-cell','<b class="cmp-vn">'+esc(numLabel(v))+'</b> '+(src||'<span class="cmp-blackbar" aria-label="אין מקבילה"></span>'));
      const ac=el('div','cmp-cell', aram||'<span class="cmp-blackbar" aria-label="אין מקבילה"></span>');
      // no Onkelos for this verse → a solid bar (Samaritan-only verse, no counterpart)
      const oc=el('div','cmp-cell', hasOnk ? onk : '<span class="cmp-blackbar" aria-label="אין באונקלוס"></span>');
      [sc,ac,oc].forEach(x=>x.style.fontSize=fs+'px');
      addCmpPencil(sc, v.id, [
        {column:'text', label:t('cmp_source'), getText:()=>v.text||''},
        {column:'sam_aramaic', label:t('cmp_aram'), getText:()=>v.sam_aramaic||''},
        {column:'onkelos_text', label:t('cv_onkelos'), getText:()=>v.onkelos_text||''},
        // only verse 1 of a chapter shows a "20:1"-style label built from jchapter
        ...(String(v.number)==='1' ? [{column:'mas_chapter', label:t('cmp_chapter_field'), getText:()=>String(v.jchapter!=null?v.jchapter:'')}] : []),
      ]);
      grid.appendChild(sc); grid.appendChild(ac); grid.appendChild(oc);
    });
    c.appendChild(grid);
    return;
  }

  // the "other" side: Masoretic text, or — for the Septuagint — the Masoretic text
  // with the LXX variant readings substituted in (lxx_text); verses with no recorded
  // LXX variant fall back to the Masoretic text.
  // Qumran (Dead Sea Scrolls) has no fallback — verses not attested in the scrolls stay
  // empty and get a dashed line; otherwise Masoretic (or MT+LXX variants for the LXX).
  const otherText = v => (ver==='septuagint') ? (v.lxx_text || v.masoretic_text)
                       : (ver==='qumran') ? (v.qumran_text || '')
                       : v.masoretic_text;
  const _CVK = {masoretic:['cv_masoretic','ci_masoretic'], septuagint:['cv_septuagint','ci_septuagint'],
                qumran:['cv_qumran','ci_qumran']};
  const _ck = _CVK[ver] || _CVK.masoretic;
  const otherCol = {masoretic:'masoretic_text', septuagint:'lxx_text', qumran:'qumran_text'}[ver] || 'masoretic_text';
  const ph = el('div','note','טוען השוואה…'); c.appendChild(ph);
  const data = await apiPost('compare', {verses: verses.map(v=>{
    const mas = String(v.masnum!=null ? v.masnum : v.number);
    const masLabel = (mas==='1') ? ((v.jchapter!=null?v.jchapter:S.curChNum)+':1') : mas;
    return {sam_num:v.number, mas_num:masLabel, text:v.text, masoretic_text:otherText(v)};
  })});
  ph.remove();
  // Verse-opposite-verse: a 2-column CSS grid where every verse is one grid row
  // (source-version cell | Samaritan cell). Grid rows stay aligned even when a verse
  // wraps. Where a verse has no counterpart on a side, that cell shows "---".
  const grid=el('div','cmp-grid');
  // left header carries the version name + a small info icon; tapping it opens a
  // concise in-app floating popup about the version (Masoretic / Septuagint)
  const verName = t(_ck[0]);
  const lh=el('div','cmp-cell cmp-head');
  lh.appendChild(document.createTextNode(verName+' '));
  const info=el('span','cmp-info'); info.textContent='ⓘ';
  info.title=t('cmp_info'); info.setAttribute('role','button'); info.tabIndex=0;
  info.setAttribute('aria-label',t('cmp_info'));
  const showVer=()=>showInfo(verName, `<div class="ver-info">${esc(t(_ck[1]))}</div>`);
  info.onclick=showVer;
  info.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); showVer(); } };
  lh.appendChild(info);
  grid.appendChild(lh);
  grid.appendChild(el('div','cmp-cell cmp-head', t('cmp_sam')));
  verses.forEach((v,i)=>{
    const d=data[i]; if(!d) return;
    const m=render(d.mas).trim(), s=render(d.sam).trim();
    if(!m && !s) return;
    // no counterpart in the compared version → a solid bar (never a blank cell)
    const miss = '<span class="cmp-blackbar" aria-label="אין מקבילה"></span>';
    const mc=el('div','cmp-cell', m || miss);
    const sc=el('div','cmp-cell', s || miss);
    mc.style.fontSize=fs+'px'; sc.style.fontSize=fs+'px';
    // the "X:1" chapter-number label is built from the MASORETIC-side verse number
    // (masnum), which can be verse 1 of its Masoretic chapter even when this row
    // isn't verse 1 of the Samaritan chapter (chapter boundaries don't always align)
    // — gate the edit option on that same condition, not on the Samaritan v.number.
    const mas=String(v.masnum!=null ? v.masnum : v.number);
    addCmpPencil(mc, v.id, [
      {column:otherCol, label:t(_ck[0]), getText:()=>v[otherCol]||''},
      {column:'text', label:t('cmp_sam'), getText:()=>v.text||''},
      ...(mas==='1' ? [{column:'mas_chapter', label:t('cmp_chapter_field'), getText:()=>String(v.jchapter!=null?v.jchapter:'')}] : []),
    ]);
    grid.appendChild(mc); grid.appendChild(sc);
  });
  c.appendChild(grid);
}
async function buildInterpret(c, verses){
  // Rendered as its own panel BELOW the verse text (the caller adds the plain
  // verses first), matching how "ממקור שומרון" presents its sources — rather
  // than replacing the verse text inline the way it used to. In Samaritan-font
  // mode the commentary comes out in the fluent Samaritan commentary font, so
  // the original stands in Samaritan script with its interpretation beneath it.
  const ar = (S.interpLang==='ar');
  const ids = verses.map(v=>v.id).join(',');
  // In Arabic mode fetch BOTH: a verse whose Arabic is still missing falls back
  // to its Hebrew commentary with a marker, rather than silently vanishing from
  // the panel and making the chapter look like it has fewer verses than it does.
  const m  = await api('interpretations?verse_ids='+ids+(ar?'&lang=ar':''));
  const mHe = ar ? await api('interpretations?verse_ids='+ids) : m;
  // ספר האסאטיר retells whole episodes rather than expounding wording, so it is
  // set BENEATH the commentary in its own name and its own words — not folded
  // into the prose. It has no Arabic rendering; like the scripture quotations
  // inside the Arabic commentary, it stays in Hebrew there too.
  const asa = await api('asatir_by_verse?verse_ids='+ids).catch(()=>({}));
  // פירוש אם בחקותי sits beneath the commentary the same way, and for the
  // opposite reason: it argues about the wording, so folding a fifth attributed
  // voice into a paragraph that already names three or four would turn prose
  // into a roll-call. Unlike the Asatir it does have an Arabic rendering, and
  // /api/bhuq_by_verse falls back to the Hebrew per section where it is missing.
  const bhq = await api('bhuq_by_verse?verse_ids='+ids+(ar?'&lang=ar':'')).catch(()=>({}));
  const fs = fsize();
  const panel = el('div','srcpanel interp-panel');

  // Header: title on one side, the two view switches on the other. Both are
  // panel-local — the Samaritan one deliberately does NOT touch S.samFont, so
  // switching the commentary to Samaritan script leaves the verse text alone.
  const head = el('div','ptitle irow-head');
  head.appendChild(el('span','', t('interp')));
  const tools = el('div','ihead-tools');
  const samOn = (S.interpSam || S.samFont) && !ar;
  const bSam = el('button','ihead-btn'+(samOn?' on':''), t('interp_sam'));
  bSam.onclick=()=>{ S.interpLang='he'; S.interpSam = !samOn; paintVerses(); };
  const bAr  = el('button','ihead-btn'+(ar?' on':''), t('interp_ar'));
  bAr.onclick=()=>{ S.interpLang = ar ? 'he' : 'ar'; paintVerses(); };
  tools.appendChild(bSam); tools.appendChild(bAr);
  head.appendChild(tools);
  panel.appendChild(head);

  let any = false;
  for(const v of verses){
    let txt = (m[v.id]||'').trim();
    const fellBack = ar && !txt && !!(mHe[v.id]||'').trim();
    if(fellBack) txt = (mHe[v.id]||'').trim();
    const asaItems = asa[v.id] || [];
    const bhqItems = bhq[v.id] || [];
    // strip leftover markdown (heading lines, ** bold) that leaked into the text
    txt = txt.replace(/\*\*/g,'').replace(/^[ \t]*#{1,6}[ \t]+.*$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
    // a verse a source speaks about is worth a row even when it has no
    // commentary of its own — that is what gives דברים anything to read
    if(!txt && !asaItems.length && !bhqItems.length) continue;
    any = true;
    const row = el('div','irow');
    const num = el('button','inum'+(S.verseFilter===v.id?' active':''), String(v.number));
    num.onclick=()=>filterVerse(v.id);
    const col = el('div','icol');
    if(txt){
      const showAr = ar && !fellBack;
      const body = el('div','itext'+(showAr?' iar':''), showAr ? esc(txt) : (!ar && (S.interpSam||S.samFont))
        ? samMarkupFree(addWordDots(stripNiqqud(txt))) : esc(txt));
      if(fellBack) body.prepend(el('span','ipend', t('interp_ar_pending')));
      body.style.fontSize = fs+'px';
      col.appendChild(body);
    }
    for(const it of asaItems){
      const box = el('div','iasatir');
      const lead = t('interp_asatir_lead')
        + (it.ref ? ' (' + it.ref + (it.title ? ' · ' + it.title : '') + ')' : '') + ':';
      box.appendChild(el('div','iasatir-lead', esc(lead)));
      const showArAsa = ar && !!(it.arabic||'').trim();
      const at = el('div','iasatir-text'+(showArAsa?' iar':''),
        showArAsa ? esc(it.arabic)
        : ((!ar && (S.interpSam||S.samFont))
            ? samMarkupFree(addWordDots(stripNiqqud(it.text))) : esc(it.text)));
      at.style.fontSize = fs+'px';
      box.appendChild(at);
      col.appendChild(box);
    }
    for(const it of bhqItems){
      const box = el('div','iasatir ibhuq');
      const lead = t('interp_bhuq_lead')
        + (it.ref ? ' ' + it.ref + (it.title ? ' · ' + it.title : '') : '') + ':';
      box.appendChild(el('div','iasatir-lead', esc(lead)));
      // Arabic mode shows the Arabic rendering; a section not yet translated
      // falls back to its Hebrew, marked, exactly as the commentary above does
      const showAr = ar && !it.pending;
      const bt = el('div','iasatir-text'+(showAr?' iar':''), showAr ? esc(it.text)
        : (!ar && (S.interpSam||S.samFont))
          ? samMarkupFree(addWordDots(stripNiqqud(it.text))) : esc(it.text));
      if(ar && it.pending) bt.prepend(el('span','ipend', t('interp_ar_pending')));
      bt.style.fontSize = fs+'px';
      box.appendChild(bt);
      col.appendChild(box);
    }
    row.appendChild(num); row.appendChild(col);
    if(!ar) addPencil(row, v.id, 'interpretation', ()=>(m[v.id]||''));
    panel.appendChild(row);
  }
  if(!any) panel.appendChild(el('div','note', ar ? t('no_interp_ar') : t('no_interp')));
  else panel.appendChild(interpFooter());
  c.appendChild(panel);
}
// "להרחבה פנה אל…" — the commentary is a synthesis, so every panel ends with
// one-click routes to the material it was distilled from (the Samaritan
// sources), to the Jewish commentators for contrast, and to the word glossary.
function interpFooter(){
  const f = el('div','ifoot');
  f.appendChild(el('span','ifoot-lead', t('interp_more')));
  const mk=(label,fn)=>{ const b=el('button','ifoot-btn',label); b.onclick=fn; f.appendChild(b); };
  mk(t('samsrc'),     ()=>togglePanel('samaritan_src'));
  mk(t('commentary'), ()=>togglePanel('commentary'));
  mk(t('dict'),       ()=>{ S.dict=!S.dict; syncToolbar(true); paintVerses(); });
  return f;
}
// ── חילופי נוסח (von Gall critical apparatus) ───────────────────────────────
// consonantal fold for matching an apparatus lemma to a word in the verse text
function _vfold(s){
  return (s||'').replace(/[֑-ׇ]/g,'').replace(/[^א-ת]/g,'')
    .replace(/[ךםןףץ]/g, m=>({'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'}[m]));
}
// the consonantal skeleton — drops the matres lectionis (א ה ו י) so orthographic
// variants of the same word (ויבדל ↔ ויבדיל) share a key
function _vskel(s){ return _vfold(s).replace(/[אהוי]/g,''); }
function _appReadHTML(it){
  if(it.type==='om') return 'חֲסֵרָה';
  if(it.type==='add') return 'נוסף: '+esc(it.reading);
  if(it.type==='transp') return 'היפוך סדר'+(it.reading?': '+esc(it.reading):'');
  if(it.type==='del') return 'מחיקת מגיה'+(it.reading?': '+esc(it.reading):'');
  return esc(it.reading||'—');
}
function _flash(id){
  const node=document.getElementById(id); if(!node) return;
  node.scrollIntoView({behavior:'smooth', block:'center'});
  node.classList.remove('app-flash'); void node.offsetWidth; node.classList.add('app-flash');
}
// the variants view: the verse text with the apparatus lemmas EMPHASISED and tied
// to their reading cards — tap a marked word to jump to its variants, tap a variant
// to jump back to the word in the text. (Words are inline spans, not buttons.)
async function buildVariantsView(c, verses){
  const items = await api('apparatus?verse_ids='+verses.map(v=>v.id).join(','));
  items.forEach((it,i)=>{ it._idx=i; });
  const byVerse={};
  for(const it of items){ (byVerse[it.verse]=byVerse[it.verse]||[]).push(it); }
  const fs=fsize();

  // verse rows, with each apparatus lemma highlighted and linked to its card
  for(const v of verses){
    if(!(v.text||'').trim()) continue;
    const row=el('div','vrow'); row.id='appverse-'+v.number;
    const num=el('button','num'+(S.verseFilter===v.id?' active':''), String(v.number));
    num.onclick=()=>filterVerse(v.id);
    const td=el('div','vtext'); td.style.fontSize=fs+'px';
    const tokens=(v.text||'').split(/(\s+)/);   // keep whitespace tokens
    const wordIx=[]; const tfold=[]; const tskel=[];
    tokens.forEach((tok,i)=>{ if(tok && !/^\s+$/.test(tok)){ const f=_vfold(tok);
      if(f){ wordIx.push(i); tfold[i]=f; tskel[i]=_vskel(tok); } } });
    const litems=(byVerse[v.number]||[]);
    const assigned={};               // token index → apparatus item._idx
    const usedTok=new Set();
    // pass 1 — exact consonantal match; pass 2 — matres-lectionis-insensitive
    // skeleton match (so ויבדל ↔ ויבדיל etc. still light up the word).
    for(const pass of [0,1]){
      for(const it of litems){
        if(it._mt) continue;
        const key = pass===0 ? _vfold(it.lemma) : _vskel(it.lemma);
        if(!key || (pass===1 && key.length<2)) continue;
        const ti = wordIx.find(i=>!usedTok.has(i) && (pass===0?tfold[i]:tskel[i])===key);
        if(ti!==undefined){ usedTok.add(ti); assigned[ti]=it._idx; it._mt=1; }
      }
    }
    litems.forEach(it=>{ delete it._mt; });
    td.innerHTML = tokens.map((tok,i)=>{
      if(assigned[i]!==undefined)
        return '<span class="app-word" id="appw-'+assigned[i]+'" data-idx="'+assigned[i]+'">'+esc(tok)+'</span>';
      return esc(tok);
    }).join('');
    td.querySelectorAll('.app-word').forEach(sp=>{
      sp.onclick=()=>_flash('appcard-'+sp.dataset.idx);
      sp.title='לחץ לראות את חילופי הנוסח';
    });
    row.appendChild(td); row.appendChild(num);
    c.appendChild(row);
  }

  const panel=el('div','srcpanel');
  panel.appendChild(el('div','ptitle',t('variants_title')));
  if(!items.length){ panel.appendChild(el('div','note',t('no_variants'))); c.appendChild(panel); return; }
  panel.appendChild(el('div','app-hint',t('app_hint')));
  let curV=null;
  for(const it of items){
    if(it.verse!==curV){ curV=it.verse; panel.appendChild(el('div','app-vhead','פסוק '+esc(String(it.verse)))); }
    const card=el('div','app-card'); card.id='appcard-'+it._idx;
    const occ = it.occurrence?'<sup>'+esc(it.occurrence)+'</sup>':'';
    const reg = it.register===2?' <span class="app-reg">כתיב/ניקוד</span>':'';
    const lemma=el('div','app-lemma','<b>'+esc(it.lemma||'—')+'</b>'+occ+reg);
    card.appendChild(lemma);
    card.appendChild(el('div','app-read','<span class="app-type">'+esc(it.type_label)+'</span> '+_appReadHTML(it)));
    if(it.witness_info && it.witness_info.length){
      const wbox=el('div','app-wit'); wbox.appendChild(el('div','app-wit-h','עדי נוסח:'));
      for(const w of it.witness_info){
        const desc=[w.repository, w.shelfmark].filter(x=>x && x!=='—').join(' · ');
        const dt=w.date && w.date!=='—' ? '  ('+w.date+')' : '';
        const ln=el('div','app-wit-ms');
        ln.innerHTML='<span class="app-sig" dir="ltr">'+esc(w.siglum)+'</span> '+
                     (desc?esc(desc):'<span class="app-wit-unk">לא זוהה</span>')+esc(dt);
        wbox.appendChild(ln);
      }
      card.appendChild(wbox);
    } else if(it.witnesses && it.witnesses.length){
      card.appendChild(el('div','app-wit','עדים: <span dir="ltr">'+esc(it.witnesses.join(', '))+'</span>'));
    }
    if(it.note) card.appendChild(el('div','app-note',esc(it.note)));
    // tapping the variant jumps back to the word in the verse line (or the verse)
    card.onclick=()=>_flash(document.getElementById('appw-'+it._idx)?('appw-'+it._idx):('appverse-'+it.verse));
    card.style.cursor='pointer'; card.title='לחץ לחזרה למילה בפסוק';
    panel.appendChild(card);
  }
  c.appendChild(panel);
}
function buildAramaic(c, verses){
  const parts = verses.filter(v=>(v.sam_aramaic||'').trim())
    .map(v=>`${v.number}  ${commentaryText((v.sam_aramaic||'').trim())}`).join('\n');
  const ap = panelEl('תרגום ארמי', parts || 'תרגום ארמי אינו זמין');
  c.appendChild(pairEl(ap, origPanel(verses)));
}
function buildArabic(c, verses){
  const parts = verses.filter(v=>(v.arabic_trans||'').trim())
    .map(v=>`${v.number}  ${esc((v.arabic_trans||'').trim())}`).join('\n');
  const ap = parts ? panelEl('תרגום ערבי', parts, 'ar') : panelEl('תרגום ערבי','תרגום ערבי אינו זמין');
  c.appendChild(pairEl(ap, origPanel(verses)));
}

// ── Jewish commentary ────────────────────────────────────────────────────────
function buildCommentary(c, verses){
  const panel = el('div','srcpanel');
  if(S.commentarySel===null){
    panel.appendChild(el('div','ptitle','בחר פרשן'));
    // only commentators that actually have text on the current verse(s)
    const avail = COMMENTATORS.filter(([key]) => verses.some(v => (v[key]||'').trim()));
    for(const [key,name] of avail){
      const b=el('button','picker-btn',esc(name)); b.onclick=()=>{ S.commentarySel=key; paintVerses(); };
      panel.appendChild(b);
    }
    // the live-Sefaria option is always offered (its results are fetched on demand)
    const wb=el('button','picker-btn','פרשנים נוספים (ספריא)');
    wb.onclick=()=>{ S.commentarySel='web'; paintVerses(); }; panel.appendChild(wb);
    if(!avail.length) panel.appendChild(el('div','note','אין פרשנות מקומית לפסוקים אלה'));
  } else {
    const head=el('div','shead');
    const back=el('button','miniback','‹ בחר פרשן'); back.onclick=()=>{ S.commentarySel=null; paintVerses(); };
    const names=Object.fromEntries(COMMENTATORS.concat([['web','פרשנים נוספים (ספריא)']]));
    head.appendChild(back); head.appendChild(el('div','stitle',esc(names[S.commentarySel])));
    panel.appendChild(head);
    if(S.commentarySel==='web'){
      panel.appendChild(el('div','note','מתוך אתר ספריא'));
      if(verses.length!==1){
        panel.appendChild(el('div','note','בחר פסוק יחיד (מהפס שלמעלה) לצפייה בפרשנים נוספים מספריא'));
      } else {
        const box=el('div'); box.appendChild(el('div','note','טוען פרשנים נוספים מספריא…'));
        panel.appendChild(box);
        api('sefaria?verse_id='+verses[0].id).then(d=>{
          box.innerHTML='';
          if(!d.ok){ box.appendChild(el('div','note','שגיאה בטעינת הפרשנים מספריא / אין חיבור לרשת.')); return; }
          if(!d.items.length){ box.appendChild(el('div','note','לא נמצאו פרשנים נוספים לפסוק זה בספריא.')); return; }
          for(const it of d.items){
            const card=el('div','card');
            card.appendChild(el('div','chead',esc(it.name)));
            const b=el('div','cbody',esc(it.text)); b.style.fontSize=fsize()+'px'; card.appendChild(b);
            box.appendChild(card);
          }
        });
      }
    } else {
      const parts = verses.filter(v=>(v[S.commentarySel]||'').trim())
        .map(v=>`${v.number}  ${esc((v[S.commentarySel]||'').trim())}`).join('\n');
      const body=el('div','pbody', parts || ('אין פרשנות '+esc(names[S.commentarySel])+' לפסוק זה'));
      body.style.fontSize=fsize()+'px'; panel.appendChild(el('div','note','באדיבות אתר ספריא')); panel.appendChild(body);
    }
  }
  c.appendChild(panel);
}

// ── ממקור שומרון (Tibåt Mårqe / eyalk) ───────────────────────────────────────
async function buildSamSrc(c, verses){
  const ids = verses.map(v=>v.id).join(',');
  if(S.samSrcChoice===null){
    const panel=el('div','srcpanel');
    panel.appendChild(el('div','ptitle',t('samsrc_pick')));
    const loading=el('div','note',t('checking_sources')); panel.appendChild(loading);
    c.appendChild(panel);
    // only show a source that actually has content on the current verse(s)
    const [tm, ey, tz, sir, shyt, bhuq, asa, tr] = await Promise.all([api('tibat_marqe?verse_ids='+ids),
      api('eyalk?verse_ids='+ids), api('tzdaka?verse_ids='+ids), api('sir?verse_ids='+ids),
      api('shyt?verse_ids='+ids), api('bhuq?verse_ids='+ids), api('asatir?verse_ids='+ids),
      api('translit?verse_ids='+ids)]);
    loading.remove();
    const avail=[];
    if(tm.length) avail.push([t('src_tibat'),'tm']);
    if(ey.length) avail.push([t('src_eyalk'),'eyalk']);
    if(tz.length) avail.push([t('src_tzdaka'),'tzdaka']);
    if(sir.length) avail.push([t('src_sir'),'sir']);
    if(shyt.length) avail.push([t('src_shyt'),'shyt']);
    if(bhuq.length) avail.push([t('src_bhuq'),'bhuq']);
    if(asa.length) avail.push([t('src_asatir'),'asatir']);
    if(tr && Object.keys(tr).length) avail.push([t('src_translit'),'translit']);
    if(!avail.length){ panel.appendChild(el('div','note',t('no_sam_source'))); return; }
    for(const [label,ch] of avail){
      const b=el('button','picker-btn',label); b.onclick=()=>{ S.samSrcChoice=ch; S.tmSel=null; paintVerses(); };
      panel.appendChild(b);
    }
    // bring the screen up so ALL available sources for this chapter/verse are visible
    panel.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  if(S.samSrcChoice==='translit'){
    // verse-opposite-verse: right = the source (Samaritan) text, left = the
    // Ben-Ḥayyim phonetic transcription, mirroring the version-comparison grid.
    const data = await api('translit?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_translit')));
    panel.appendChild(head);
    const fs=fsize();
    // grid is direction:ltr → first cell is LEFT. Transcription on the left,
    // source text on the right (matching the version-comparison layout).
    const grid=el('div','cmp-grid');
    grid.appendChild(el('div','cmp-cell cmp-head', t('tr_translit')));
    grid.appendChild(el('div','cmp-cell cmp-head', t('tr_source')));
    let any=false;
    for(const v of verses){
      const tr=(data[v.id]||'').trim(), src=(v.text||'').trim();
      if(!src && !tr) continue;
      any=true;
      const num = v.number!=null ? ('<b>'+esc(String(v.number))+'</b>  ') : '';
      const tc=el('div','cmp-cell tr-latin', tr ? esc(tr) : '<span class="cmp-missing">- - -</span>');
      tc.setAttribute('dir','ltr'); tc.style.textAlign='left';
      const sc=el('div','cmp-cell', src ? (num+esc(src)) : '<span class="cmp-missing">- - -</span>');
      sc.style.fontSize=fs+'px'; tc.style.fontSize=fs+'px';
      grid.appendChild(tc); grid.appendChild(sc);
    }
    if(!any) panel.appendChild(el('div','note',t('no_translit')));
    else panel.appendChild(grid);
    c.appendChild(panel);
    panel.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  if(S.samSrcChoice==='eyalk'){
    const items = await api('eyalk?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_eyalk')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note','אין פרשנות רלוונטית לפסוקים אלה'));
    for(const it of items){
      const card=el('div','card');
      if(it.parsha) card.appendChild(el('div','chead',esc(it.parsha)));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      if(it.anchors) card.appendChild(el('div','canchors',esc(it.anchors)));
      panel.appendChild(card);
    }
    c.appendChild(panel); return;
  }
  if(S.samSrcChoice==='tzdaka'){
    const items = await api('tzdaka?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_tzdaka')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note','אין פרשנות רלוונטית לפסוקים אלה'));
    for(const it of items){
      const card=el('div','card');
      const lbl=[it.ref, it.title].filter(Boolean).join('  ·  ');
      if(lbl) card.appendChild(el('div','chead',esc(lbl)));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      if(it.anchors) card.appendChild(el('div','canchors',esc(it.anchors)));
      panel.appendChild(card);
    }
    c.appendChild(panel); return;
  }
  if(S.samSrcChoice==='sir'){
    const items = await api('sir?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_sir')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note','אין פרשנות רלוונטית לפסוקים אלה'));
    for(const it of items){
      const card=el('div','card');
      if(it.title) card.appendChild(el('div','chead',esc(it.title)));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      if(it.anchors) card.appendChild(el('div','canchors',esc(it.anchors)));
      panel.appendChild(card);
    }
    c.appendChild(panel); return;
  }
  if(S.samSrcChoice==='shyt'){
    const items = await api('shyt?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_shyt')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note','אין פרשנות רלוונטית לפסוקים אלה'));
    for(const it of items){
      const card=el('div','card');
      if(it.title) card.appendChild(el('div','chead',esc(it.title)));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      if(it.anchors) card.appendChild(el('div','canchors',esc(it.anchors)));
      panel.appendChild(card);
    }
    c.appendChild(panel); return;
  }
  if(S.samSrcChoice==='bhuq'){
    // The commentary reasons from verses all over the Torah, so a section can
    // surface far from Leviticus 26; the {NN} mark is the paragraph number of
    // the manuscript, shown so a reader can find the place in the edition.
    const items = await api('bhuq?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_bhuq')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note',t('no_sam_source')));
    for(const it of items){
      const card=el('div','card');
      if(it.title) card.appendChild(el('div','chead',esc(it.title)+(it.ref?'  '+esc(it.ref):'')));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      panel.appendChild(card);
    }
    panel.appendChild(el('div','canchors',"אבו אלפרג' איבן אל-כתאר · תרגום ד\"ר עלי ותד · מנוסח בעריכה"));
    c.appendChild(panel); return;
  }
  if(S.samSrcChoice==='asatir'){
    // The Asatir retells the Torah rather than commenting on it, so a passage is
    // attached to the episode it recounts; the "אסאטיר ט,4" mark is its own
    // chapter,paragraph citation, and the chapter heading follows it.
    const items = await api('asatir?verse_ids='+ids);
    const panel=el('div','srcpanel');
    const head=el('div','shead');
    const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; paintVerses(); };
    head.appendChild(back); head.appendChild(el('div','stitle',t('src_asatir')));
    panel.appendChild(head);
    if(!items.length) panel.appendChild(el('div','note',t('no_sam_source')));
    for(const it of items){
      const card=el('div','card');
      const lbl=[it.ref, it.title].filter(Boolean).join('  ·  ');
      if(lbl) card.appendChild(el('div','chead',esc(lbl)));
      const body=el('div','cbody',commentaryText(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      panel.appendChild(card);
    }
    panel.appendChild(el('div','canchors',t('asatir_note')));
    c.appendChild(panel); return;
  }
  // tm
  const items = await api('tibat_marqe?verse_ids='+ids);
  const panel=el('div','srcpanel');
  const head=el('div','shead');
  const back=el('button','miniback',t('back_sources')); back.onclick=()=>{ S.samSrcChoice=null; S.tmSel=null; paintVerses(); };
  head.appendChild(back); head.appendChild(el('div','stitle',t('src_tibat')));
  panel.appendChild(head);
  if(!items.length){ panel.appendChild(el('div','note','אין קטע רלוונטי מתיבת מרקה לפסוקים אלה')); c.appendChild(panel); return; }
  const cur = items.find(it=> S.tmSel && it.book===S.tmSel[0] && it.section===S.tmSel[1]);
  if(!cur){
    panel.appendChild(el('div','note','הקש על קטע להצגת התרגום'));
    for(const it of items){
      const card=el('div','card');
      const h=el('div','chead', esc(it.label)+'  ⟵ הקש לתרגום');
      h.onclick=()=>{ S.tmSel=[it.book,it.section]; paintVerses(); };
      card.appendChild(h);
      const body=el('div','cbody', commentaryText(it.aramaic||it.hebrew||'טקסט המקור אינו זמין'));
      body.style.fontSize=fsize()+'px';
      body.onclick=()=>{ S.tmSel=[it.book,it.section]; paintVerses(); };
      card.appendChild(body); panel.appendChild(card);
    }
  } else {
    const sub=el('div','shead');
    const b2=el('button','miniback','‹ חזרה'); b2.onclick=()=>{ S.tmSel=null; paintVerses(); };
    sub.appendChild(b2); sub.appendChild(el('div','stitle', esc(cur.label+' ('+cur.book_title+')')));
    panel.appendChild(sub);
    // show both panels only when the Aramaic original exists; otherwise the Hebrew
    // translation alone, full-width (some passages have no Aramaic in the source).
    if((cur.aramaic||'').trim()){
      const he=panelEl('תרגום לעברית', commentaryText(cur.hebrew||'התרגום העברי בהכנה'));
      const ar=panelEl('מקור ארמי', commentaryText(cur.aramaic));
      panel.appendChild(pairEl(he,ar));
    } else {
      panel.appendChild(panelEl('תרגום לעברית', commentaryText(cur.hebrew||'—')));
    }
  }
  c.appendChild(panel);
}

// ── "מילון מילים": word-by-word picker ───────────────────────────────────────
// Tapping the button no longer dumps the whole table. Instead it underlines every
// word that has a dictionary entry; tap a word to open ITS row (same 5-column
// format), tap another to swap it, close the row to keep picking, and tap the
// button again to turn the whole mode (underlines + row) off.
let DICT_SELECT_MAP = {};
let DICT_SELECT_PROMISE = null;   // in-flight /dict_select load for the current verse set
function buildDictSelect(c, verses){
  c.appendChild(el('div','dict-pick-hint', t('dict_pick_word')));
  const fs=fsize();
  const spanMap={};
  for(const v of verses){
    if(!(v.text||'').trim()) continue;
    const row=el('div','vrow');
    const num=el('button','num'+(S.verseFilter===v.id?' active':''), String(v.number));
    num.onclick=()=>filterVerse(v.id);
    const td=el('div','vtext'); td.style.fontSize=fs+'px';
    const toks=(v.text||'').split(/(\s+)/);
    let wi=0;
    td.innerHTML = toks.map(tok=>{
      if(tok && !/^\s+$/.test(tok)){
        const i=wi++;                                   // keep index aligned with backend (all non-space tokens)
        if(!/[א-ת]/.test(tok)) return esc(tok); // punctuation-only (e.g. ׃--): not a word, not clickable
        return '<span class="dw" data-k="'+v.id+':'+i+'">'+esc(tok)+'</span>';
      }
      return esc(tok);
    }).join('');
    td.querySelectorAll('.dw').forEach(sp=>{ spanMap[sp.dataset.k]=sp; });
    row.appendChild(td); row.appendChild(num);
    c.appendChild(row);
  }
  const panel=el('div','dictpanel dict-one hidden'); panel.id='dictOnePanel';
  c.appendChild(panel);
  // EVERY word is underlined and tappable; words with a dictionary entry are marked
  // (a touch stronger) so the user sees which carry full data.
  Object.keys(spanMap).forEach(k=>{
    const sp=spanMap[k]; sp.classList.add('on');
    const p=k.indexOf(':'); const vid=k.slice(0,p), idx=k.slice(p+1);
    sp.onclick=()=>pickDictWord(vid, idx, sp);
  });
  DICT_SELECT_MAP = {};                              // clear stale data from the previous chapter
  DICT_SELECT_PROMISE = api('dict_select?verse_ids='+verses.map(v=>v.id).join(',')).then(map=>{
    DICT_SELECT_MAP=map||{};
    for(const vid in DICT_SELECT_MAP)
      for(const idx in DICT_SELECT_MAP[vid]){
        const sp=spanMap[vid+':'+idx]; if(sp) sp.classList.add('has-data');
      }
    if(S.dictWord){                                  // restore selection after a repaint
      const sp=spanMap[S.dictWord.k];
      if(sp){ sp.classList.add('sel'); renderOneWord(S.dictWord, false); }
    }
    return DICT_SELECT_MAP;
  }).catch(()=>{ DICT_SELECT_MAP={}; return DICT_SELECT_MAP; });
}
async function pickDictWord(vid, idx, sp){
  const word=(sp.textContent||'').trim();
  const k=vid+':'+idx;
  document.querySelectorAll('.dw.sel').forEach(x=>x.classList.remove('sel'));
  sp.classList.add('sel');
  let entry=(DICT_SELECT_MAP[vid]||{})[idx];
  // BUGFIX: words are clickable immediately, but /dict_select loads asynchronously. If a
  // word is tapped before it resolves, wait for the in-flight load (showing a spinner)
  // instead of opening an empty row that only fills after a close+reopen.
  if(!entry && DICT_SELECT_PROMISE){
    const panel=$('dictOnePanel');
    if(panel){ panel.classList.remove('hidden'); panel.innerHTML='';
      panel.appendChild(el('div','note',t('searching'))); scrollToEl('#dictOnePanel'); }
    await DICT_SELECT_PROMISE;
    if(!sp.classList.contains('sel')) return;        // user moved on / closed while loading
    entry=(DICT_SELECT_MAP[vid]||{})[idx];
  }
  // a word without a curated entry still opens — showing what other sources have
  entry = entry || {word:word, aramaic:'', arabic:'', english:'', he:'', he_combined:'', tal_he:''};
  S.dictWord={k, entry, vid, word};
  renderOneWord(S.dictWord, true);
}
// the single-word row: מילה · תרגום ארמי · ערבית · תרגום המילה (the accurate,
// context Hebrew). Tapping the row opens the full breakdown by source.
function renderOneWord(sel, scroll){
  const entry=sel.entry||{};
  const panel=$('dictOnePanel'); if(!panel) return;
  panel.classList.remove('hidden'); panel.innerHTML='';
  const close=el('button','dict-one-close','✕'); close.title=t('close'); close.setAttribute('aria-label',t('close'));
  close.onclick=()=>{ panel.classList.add('hidden'); panel.innerHTML=''; S.dictWord=null;
    document.querySelectorAll('.dw.sel').forEach(x=>x.classList.remove('sel')); };
  panel.appendChild(close);
  const sc=el('div','dict-scroll'); const tbl=el('table','wtbl');
  const hr=el('tr');
  for(const h of [t('col_src'),t('col_aram'),t('col_arab'),t('col_eng'),t('col_hetrans'),t('ws_jewish')]) hr.appendChild(el('th',null,esc(h)));
  tbl.appendChild(hr);
  const tr=el('tr');
  tr.appendChild(el('td','wt-word',esc(sel.word||entry.word||'—')));
  const aramTd=el('td','wt-aram'); aramTd.innerHTML=esc(entry.aramaic||'—');
  if(entry.aramaic) aramTd.appendChild(el('span','more-arrow','⬆'));
  tr.appendChild(aramTd);
  tr.appendChild(el('td','wt-ar', entry.arabic?('<span dir="rtl">'+esc(entry.arabic)+'</span>'):'—'));
  tr.appendChild(el('td','wt-eng', entry.english?('<span dir="ltr">'+esc(entry.english)+'</span>'):'—'));
  tr.appendChild(el('td','wt-trans', esc(entry.he_combined||entry.he||entry.meaning||'—')));
  tr.appendChild(el('td','wt-jewish', esc(entry.jewish||'—')));
  tr.classList.add('tappable'); tr.onclick=()=>showWordSources(sel);
  tbl.appendChild(tr); sc.appendChild(tbl); panel.appendChild(sc);
  panel.appendChild(el('div','dict-one-tap', t('ws_tap_hint')));
  if(scroll) scrollToEl('#dictOnePanel');
}
// the word's translation broken down by source: Arabic (+ its Hebrew), the Aramaic
// dictionary (closest translations + Torah & Tibåt Mårqe occurrences), English (+ its
// Hebrew), and the Meliṣ (a source not yet available).
async function showWordSources(sel){
  const entry=sel.entry||{};
  const body=$('popupBody'); body.innerHTML=''; $('popupTitle').textContent=sel.word||entry.word||entry.he||'';
  $('popup').classList.remove('hidden');
  // 1) Arabic + Arabic→Hebrew
  if(entry.arabic){
    body.appendChild(el('div','ws-h', t('ws_arabic')));
    const blk=el('div','ws-block');
    blk.appendChild(el('div','ws-val','<span dir="rtl">'+esc(entry.arabic)+'</span>'));
    if(entry.ar_he){ blk.appendChild(el('div','ws-val', esc(entry.ar_he)));
                     blk.appendChild(el('div','ws-from', t('ws_from_arabic'))); }
    else blk.appendChild(el('div','ws-from ws-pending', t('ws_arabic_pending')));
    body.appendChild(blk);
  }
  // 2) from the Aramaic: the closest gloss, then the dictionary entry with its Torah
  //    (Aramaic) and Tibåt Mårqe occurrences
  body.appendChild(el('div','ws-h', t('ws_tal')));
  if(entry.tal_he){
    const blk=el('div','ws-block');
    blk.appendChild(el('div','ws-val', esc(entry.tal_he)));
    blk.appendChild(el('div','ws-from', entry.tal_ctx?t('ws_tal_ctx'):t('ws_tal_gen')));
    body.appendChild(blk);
  }
  const loading=el('div','note',t('searching')); body.appendChild(loading);
  let d=null; try{ d=await api('dict_word_detail?word='+encodeURIComponent(entry.aramaic||'')); }catch(e){}
  loading.remove();
  for(const m of ((d&&d.meanings)||[])){
    body.appendChild(el('div','tal-head','שורש '+esc(m.root)+(m.sense_label?(' — '+esc(m.sense_label)):'')));
    for(const s of (m.senses||[]).slice(0,4)) body.appendChild(el('div','tal-sense', esc(s.gloss||'')));
    if(m.torah_count){
      body.appendChild(el('div','tal-sec', t('ws_torah_occ')+' ('+m.torah_count+')'));
      const wrap=el('div','tal-locs');
      for(const o of (m.torah||[]).slice(0,12)){
        const sp=el('span','tal-loc occ-link', esc(o.book+' '+o.ch+':'+o.vn));
        sp.onclick=()=>openOccurrence('torah', o); wrap.appendChild(sp);
      }
      if(m.torah_count>(m.torah||[]).length) wrap.appendChild(el('span','tal-more','…'));
      body.appendChild(wrap);
    }
    if(m.memar_count){
      body.appendChild(el('div','tal-sec', t('ws_marqe_occ')+' ('+m.memar_count+')'));
      const wrap=el('div','tal-locs');
      for(const o of (m.memar||[]).slice(0,8)){
        const sp=el('span','tal-loc occ-link', esc(((o.title||'')+' '+(o.section||'')).trim()));
        sp.onclick=()=>openOccurrence('memar', o); wrap.appendChild(sp);
      }
      if(m.memar_count>(m.memar||[]).length) wrap.appendChild(el('span','tal-more','…'));
      body.appendChild(wrap);
    }
  }
  // 3) Samaritan sources (synthesised note) + Jewish commentary (synthesised note)
  if(entry.samaritan){
    body.appendChild(el('div','ws-h', t('ws_samaritan')));
    const blk=el('div','ws-block'); blk.appendChild(el('div','ws-val', esc(entry.samaritan))); body.appendChild(blk);
  }
  if(entry.jewish){
    body.appendChild(el('div','ws-h', t('ws_jewish')));
    const blk=el('div','ws-block'); blk.appendChild(el('div','ws-val', esc(entry.jewish))); body.appendChild(blk);
  }
  // 4) English + English→Hebrew (pending generation)
  body.appendChild(el('div','ws-h', t('ws_english')));
  { const blk=el('div','ws-block');
    if(entry.english) blk.appendChild(el('div','ws-val','<span dir="ltr">'+esc(entry.english)+'</span>'));
    if(entry.en_he){ blk.appendChild(el('div','ws-val', esc(entry.en_he)));
                     blk.appendChild(el('div','ws-from', t('ws_from_english'))); }
    else blk.appendChild(el('div','ws-from ws-pending', t('ws_english_pending')));
    body.appendChild(blk); }
  // 4) web dictionaries (free, live — Wiktionary / Wikipedia)
  body.appendChild(el('div','ws-h', t('ws_web')));
  { const wword = sel.word || entry.word || '';
    const blk=el('div','ws-block'); blk.appendChild(el('div','note',t('searching'))); body.appendChild(blk);
    api('online_dict?words='+encodeURIComponent(wword)).then(res=>{
      blk.innerHTML='';
      const r = res && res[wword];
      if(r && r.summary){
        blk.appendChild(el('div','ws-val', esc(r.summary)));
        const credit=(r.sources||[]).map(s=>s[0]+' ('+s[1]+')').join(' · ');
        if(credit) blk.appendChild(el('div','ws-from', esc(credit)));
      } else blk.appendChild(el('div','ws-from ws-pending','—'));
    }).catch(()=>{ blk.innerHTML=''; blk.appendChild(el('div','ws-from ws-pending','—')); }); }
  // 5) the Meliṣ — a further source, not yet added
  body.appendChild(el('div','ws-h', t('ws_melitz')));
  { const blk=el('div','ws-block');
    if(entry.meliz_ar || entry.meliz_he){
      if(entry.meliz_ar) blk.appendChild(el('div','ws-val','<span dir="rtl">'+esc(entry.meliz_ar)+'</span>'));
      if(entry.meliz_he) blk.appendChild(el('div','ws-val', esc(entry.meliz_he)));
      blk.appendChild(el('div','ws-from', t('ws_melitz')));
    } else {
      blk.appendChild(el('div','ws-from ws-pending', t('ws_melitz_pending')));
    }
    body.appendChild(blk); }
}
// tap an occurrence reference → the verse (Torah) or passage (Tibåt Mårqe) itself,
// with the matched word(s) highlighted (reuses dictHlSpan from the word index)
function openOccurrence(type, o){
  const body=$('occBody'); body.innerHTML='';
  let title;
  if(type==='torah'){
    title = ((o.book||'')+' '+(o.ch||'')+':'+(o.vn||'')).trim();
    body.appendChild(dictHlSpan(o.text||'', o.hi||[], 'occ-text'));
  } else {
    title = ((o.title||'')+' '+(o.section||'')).trim();
    body.appendChild(dictHlSpan(o.aramaic||'', o.hi||[], 'occ-text aram'));
    if(o.hebrew) body.appendChild(el('div','occ-heb', esc(o.hebrew)));
  }
  $('occTitle').textContent = title;
  $('occModal').classList.remove('hidden');
}
$('occClose').onclick=()=>$('occModal').classList.add('hidden');
// also close when tapping the dark backdrop (outside the box)
$('occModal').addEventListener('click', e=>{ if(e.target===$('occModal')) $('occModal').classList.add('hidden'); });

// ── dictionary (legacy full-table — still used under translation panels) ──────
async function buildDict(c, verses){ await renderDict(c, verses); }
function maybeDict(c, verses){ if(S.dict) renderDict(c, verses); }
async function renderDict(c, verses){
  const ids = verses.map(v=>v.id).join(',');
  const map = await api('word_table?verse_ids='+ids);
  const panel=el('div','dictpanel');
  panel.appendChild(el('div','dhint-strong',t('dict_hint')));

  // online Hebrew-Hebrew dictionary toggle (Wiktionary + Wikipedia, free)
  const orow=el('div','online-row');
  const lbl=el('label',null,'הצג תוצאות ממילונים ברשת');
  const cb=el('input'); cb.type='checkbox'; cb.checked=S.onlineDict;
  cb.onchange=()=>{ S.onlineDict=cb.checked; paintVerses(); };
  lbl.prepend(cb); orow.appendChild(lbl); panel.appendChild(orow);

  const rows=[];
  for(const v of verses) for(const w of (map[v.id]||[])) rows.push(w);
  if(!rows.length){ panel.appendChild(el('div','note',t('no_dict'))); c.appendChild(panel); return; }

  const scroll=el('div','dict-scroll');
  const tbl=el('table','wtbl');
  const hr=el('tr');
  for(const h of [t('col_word'),t('col_aram'),t('col_heb'),t('col_tal'),t('col_arabic'),t('col_meliz')]) hr.appendChild(el('th',null,esc(h)));
  tbl.appendChild(hr);
  for(const w of rows){
    const tr=el('tr');
    tr.appendChild(el('td','wt-word',esc(w.word||'—')));
    const aramTd=el('td','wt-aram');
    aramTd.innerHTML=esc(w.aramaic||'—');
    if(w.aramaic) aramTd.appendChild(el('span','more-arrow','⬆'));   // marks: more results on tap
    tr.appendChild(aramTd);
    tr.appendChild(el('td','wt-mean',esc(w.meaning||'—')));
    tr.appendChild(el('td','wt-tal',esc(w.tal||'—')));
    tr.appendChild(el('td','wt-ar',esc(w.arabic||'—')));
    tr.appendChild(el('td','wt-meliz',esc(w.meliz_he||'—')));    // HaMeliṣ Hebrew gloss
    if(w.aramaic){ tr.classList.add('tappable'); tr.onclick=()=>showTalFull(w.aramaic); }
    tbl.appendChild(tr);
  }
  scroll.appendChild(tbl);
  panel.appendChild(scroll);
  c.appendChild(panel);

  // optional online Hebrew dictionary, shown as a separate block below the table
  if(S.onlineDict){
    const uniq=[...new Set(rows.map(w=>w.word).filter(Boolean))];
    const ob=el('div','online-block'); ob.appendChild(el('div','note','טוען ממילוני רשת…'));
    panel.appendChild(ob);
    api('online_dict?words='+encodeURIComponent(uniq.join(','))).then(res=>{
      ob.innerHTML='';
      for(const wd of uniq){
        const r=res[wd]; if(!r) continue;
        const credit=(r.sources||[]).map(s=>`${s[0]} (${s[1]})`).join('  ·  ');
        const it=el('div','online-item',`<b>${esc(wd)}</b> — ${esc(r.summary)}`);
        if(credit) it.appendChild(el('div','src','מקורות: '+esc(credit)));
        ob.appendChild(it);
      }
      if(!ob.children.length) ob.appendChild(el('div','note','לא נמצאו תוצאות ברשת'));
    }).catch(()=>{ ob.innerHTML=''; ob.appendChild(el('div','note','שגיאה בטעינה מהרשת')); });
  }
}
// Tap a dictionary word → the authoritative entry from A. Tal's dictionary, in the
// order the user asked for: per root, FIRST its meaning(s) read off the dictionary,
// THEN its occurrences across the Torah, and finally other forms/entries.
async function showTalFull(word){
  const body=$('popupBody'); body.innerHTML=''; $('popupTitle').textContent=word;
  body.appendChild(el('div','note',t('searching')));
  $('popup').classList.remove('hidden');
  let d; try{ d = await api('tal_lookup?word='+encodeURIComponent(word)); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note',t('tal_none'))); return; }
  body.innerHTML='';
  const roots=(d&&d.roots)||[];
  // The word may be an inflected form harvested from the piyyutim / Memar Marqe.
  // Show how it was taken apart before the root entries, so the reader can judge
  // the derivation rather than trust it.
  // A derivation nothing could confirm: show the meaning, say plainly that it is
  // unconfirmed, and offer no root — an unverified root is what sent readers to
  // the wrong occurrences.
  const sug=d&&d.suggestion;
  if(sug){
    body.appendChild(el('div','tal-sec',t('sug_head')));
    const box=el('div','tal-infl');
    if(sug.gloss) box.appendChild(el('div','tal-sense', esc(sug.gloss)));
    box.appendChild(el('div','note', t('infl_deriv')+': '+esc(sug.derivation||'')));
    box.appendChild(el('div','note', t('sug_note')));
    body.appendChild(box);
  }
  const dv=d&&d.derived_root;
  if(dv){
    body.appendChild(el('div','note', t('ver_by')+': '+esc(dv.verified||'')
      +(dv.memar_he?(' · '+esc(dv.memar_he)):'')));
  }
  const inf=d&&d.inflection;
  if(inf){
    body.appendChild(el('div','tal-sec',t('infl_head')));
    const box=el('div','tal-infl');
    box.appendChild(el('div','tal-sense', t('infl_deriv')+': '+esc(inf.derivation||'')));
    if(inf.gloss) box.appendChild(el('div','tal-sense', esc(inf.gloss)));
    if(inf.gloss_tal) box.appendChild(el('div','note', t('infl_marqe')+' · '+esc(inf.memar_he||'')));
    if(inf.status==='review') box.appendChild(el('div','note', t('infl_review')));
    body.appendChild(box);
  }
  if(!roots.length){
    if(!inf) body.appendChild(el('div','note',t('tal_none')));
    return;
  }
  // Set phrases the word takes part in, with the Hebrew that Memar Marqe's own
  // translation gives them. Only formulas and idioms are stored, never free pairs.
  const phr=(d&&d.phrases)||[];
  if(phr.length){
    body.appendChild(el('div','tal-sec',t('phr_head')));
    for(const p of phr){
      const it=el('div','tal-phrase');
      it.innerHTML='<b>'+esc(p.phrase)+'</b> <span class="pos">'
        +esc(p.cls==='formula'?t('phr_formula'):t('phr_idiom'))+'</span>';
      if(p.hebrew) it.appendChild(el('div','tal-sense','← '+esc(p.hebrew)));
      else if(p.parts) it.appendChild(el('div','note',esc(p.parts)));
      it.appendChild(el('span','tal-pg','  ('+esc(p.ref)+', '+p.count+')'));
      body.appendChild(it);
    }
  }
  for(const rt of roots){
    body.appendChild(el('div','tal-head','שורש '+esc(rt.root)));
    // 1) meaning(s) from the dictionary
    if(rt.senses && rt.senses.length){
      body.appendChild(el('div','tal-sec',t('tal_meaning')));
      for(const s of rt.senses){
        const it=el('div','tal-sense');
        let lead=''; if(s.lemma) lead+='<b>'+esc(s.lemma)+'</b> '; if(s.pos) lead+='<span class="pos">'+esc(s.pos)+'</span> ';
        it.innerHTML=lead+esc(s.gloss||'');
        if(s.page) it.appendChild(el('span','tal-pg','  ('+t('tal_page')+' '+esc(String(s.page))+')'));
        body.appendChild(it);
      }
    }
    // 2) occurrences in the Torah
    if(rt.torah && rt.torah.length){
      body.appendChild(el('div','tal-sec',t('tal_torah')+' ('+rt.torah_count+')'));
      const wrap=el('div','tal-locs');
      for(const loc of rt.torah) wrap.appendChild(el('span','tal-loc', esc(loc.book+' '+loc.ch+':'+loc.vn)));
      if(rt.torah_count>rt.torah.length) wrap.appendChild(el('span','tal-more','…'));
      body.appendChild(wrap);
    }
    // 3) other forms / entries from the dictionary
    if(rt.forms && rt.forms.length){
      body.appendChild(el('div','tal-sec',t('tal_forms')));
      body.appendChild(el('div','tal-formlist', rt.forms.map(esc).join('  ·  ')));
    }
  }
}
// own close handler (not a .share-opt, so the share handler never overwrites it)
$('popupClose').onclick=()=>$('popup').classList.add('hidden');

// ── prev / next navigation ───────────────────────────────────────────────────
function navState(mode){
  // mode: 'portion' (chapter-list pages) or 'chapter' (verse pages)
  S.navMode = mode;
  $('navbar').classList.remove('hidden');
  updateNavDisabled();
}
// the prev/next arrows are TRANSPARENT and show only an arrow glyph by default; a
// label appears inside them only when the step crosses into another PARASHA or BOOK.
function navArrow(isNext){
  return (LANG==='en' || LANG==='ar') ? (isNext ? '›' : '‹') : (isNext ? '‹' : '›');  // forward-pointing
}
// a real arrow icon (shaft + head) for the bare prev/next arrows
function navArrowSvg(isNext){
  const left = navArrow(isNext) === '‹';
  const inner = left
    ? '<line x1="20" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'
    : '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
  return `<svg class="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
function setNavBtn(btn, isNext, label){     // label → prominent text button; else faint arrow icon
  if(label){ btn.textContent = label; btn.classList.add('nav-haslabel'); }
  else { btn.innerHTML = navArrowSvg(isNext); btn.classList.remove('nav-haslabel'); }
}
function navLabel(name, isNext){     // name + arrow, side per language
  if(LANG==='en' || LANG==='ar') return isNext ? (name+' ›') : ('‹ '+name);
  return isNext ? ('‹ '+name) : (name+' ›');                  // Hebrew
}
function gotoBookLabel(name, isNext){ return navLabel(t('goto_book')+name, isNext); }
function updateNavDisabled(){
  const ids = S.portions.map(p=>p.id); const pidx = ids.indexOf(S.curPid);
  const nb=$('nextBtn'), pb=$('prevBtn');
  if(S.navMode==='chapter'){
    // chapter paging carries across parashot within a book; the button shows the
    // PARASHA name when the step enters a new parasha, the BOOK name at a book edge,
    // and just a bare arrow while paging chapters inside the same parasha.
    const atBookStart = (S.chIdx<=0) && (pidx<=0);
    const atBookEnd   = (S.chIdx>=S.chList.length-1) && (pidx>=ids.length-1);
    const books = S.books||[]; const bIdx = books.findIndex(b=>b.id===S.book);
    const prevBook = bIdx>0 ? books[bIdx-1] : null;
    const nextBook = (bIdx>=0 && bIdx<books.length-1) ? books[bIdx+1] : null;
    // PREV
    if(atBookStart && prevBook){ setNavBtn(pb,false,gotoBookLabel(prevBook.name,false)); pb.disabled=false; }
    else if(S.chIdx<=0 && pidx>0){ setNavBtn(pb,false,navLabel((S.portions[pidx-1]||{}).name||'', false)); pb.disabled=false; }
    else { setNavBtn(pb,false,''); pb.disabled = atBookStart; }
    // NEXT
    if(atBookEnd && nextBook){ setNavBtn(nb,true,gotoBookLabel(nextBook.name,true)); nb.disabled=false; }
    else if(S.chIdx>=S.chList.length-1 && pidx<ids.length-1){ setNavBtn(nb,true,navLabel((S.portions[pidx+1]||{}).name||'', true)); nb.disabled=false; }
    else { setNavBtn(nb,true,''); nb.disabled = atBookEnd; }
  } else {
    // chapter-list (portion) paging: each step is a parasha; at the first/last parasha
    // of a book the button crosses to the adjacent BOOK (its first/last parasha).
    const books=S.books||[]; const bIdx=books.findIndex(b=>b.id===S.book);
    const prevBook = bIdx>0 ? books[bIdx-1] : null;
    const nextBook = (bIdx>=0 && bIdx<books.length-1) ? books[bIdx+1] : null;
    if(pidx>0){ setNavBtn(pb,false,navLabel((S.portions[pidx-1]||{}).name||'', false)); pb.disabled=false; }
    else if(prevBook){ setNavBtn(pb,false,gotoBookLabel(prevBook.name,false)); pb.disabled=false; }
    else { setNavBtn(pb,false,''); pb.disabled=true; }
    if(pidx<ids.length-1){ setNavBtn(nb,true,navLabel((S.portions[pidx+1]||{}).name||'', true)); nb.disabled=false; }
    else if(nextBook){ setNavBtn(nb,true,gotoBookLabel(nextBook.name,true)); nb.disabled=false; }
    else { setNavBtn(nb,true,''); nb.disabled=true; }
  }
}
$('prevBtn').onclick=()=> S.navMode==='chapter'? stepChapter(-1) : stepPortion(-1);
$('nextBtn').onclick=()=> S.navMode==='chapter'? stepChapter(1)  : stepPortion(1);

async function stepChapter(delta){
  S.verseFilter=null;
  const ghost = makeFlipGhost();          // snapshot the current page (plain text mode only)
  const ni = S.chIdx+delta;
  if(ni>=0 && ni<S.chList.length){
    S.chIdx=ni; const ch=S.chList[ni];
    await renderVerses(ch.id, ch.number, S.curPid, S.portionName);
  } else {
    const ids=S.portions.map(p=>p.id); const pidx=ids.indexOf(S.curPid);
    const np=pidx+delta;
    if(np>=0 && np<S.portions.length) await crossPortion(delta);  // next/prev parasha (same book)
    else await crossBook(delta);                                   // book edge → adjacent book
  }
  runFlipGhost(ghost, delta);             // turn the old page away, revealing the new one
}
// ── page-turn animation (chapter↔chapter, plain text mode without extra panels) ─
// In the Hebrew text a forward step turns the page leftwards; in the English
// translation the reading direction flips, so the page turns the opposite way.
function plainTextMode(){
  // "כולל פירושים?" (samFontFull) lets the reader keep the Samaritan-font mode ON
  // while still viewing a source/translation/commentary panel underneath it —
  // normally samFont suppresses all panels, falling back to plain verse text.
  const usePanel = panelActive();                                     // compare / commentary / aramaic / interpret
  return !usePanel && !(S.dict && !S.english);     // no comparison/commentary/dict panel
}
function makeFlipGhost(){
  if(!plainTextMode()) return null;
  document.querySelectorAll('.flip-ghost').forEach(g=>g.remove());  // clear any in-flight turn
  const c=$('content'); const rect=c.getBoundingClientRect();
  if(rect.width<10 || rect.height<10) return null;
  const ghost=el('div','flip-ghost');
  Object.assign(ghost.style,{left:rect.left+'px', top:rect.top+'px',
    width:rect.width+'px', height:rect.height+'px'});
  // parchment layer, sized/positioned to the app box and clipped by the ghost's overflow,
  // so it matches the background image behind the leaf exactly (no flat-cream wipe)
  const app=$('app'), ar=app.getBoundingClientRect(), cs=getComputedStyle(app);
  const bg=el('div','flip-ghost-bg');
  Object.assign(bg.style,{ left:(ar.left-rect.left)+'px', top:(ar.top-rect.top)+'px',
    width:ar.width+'px', height:ar.height+'px', backgroundImage:cs.backgroundImage,
    backgroundSize:cs.backgroundSize, backgroundPosition:cs.backgroundPosition,
    backgroundColor:cs.backgroundColor });
  ghost.appendChild(bg);
  const inner=el('div','flip-ghost-inner'); inner.style.top=(-c.scrollTop)+'px';
  for(const ch of c.children) inner.appendChild(ch.cloneNode(true));
  ghost.appendChild(inner);
  ghost.appendChild(el('div','flip-ghost-shade'));
  ghost.appendChild(el('div','flip-ghost-gloss'));
  document.body.appendChild(ghost);
  return ghost;
}
function runFlipGhost(ghost, delta){
  if(!ghost) return;
  // Hebrew: NEXT chapter turns the page to the right, PREV to the left; the English
  // translation (LTR reading) reverses it.
  const exitLeft = (delta<0) !== !!S.english;
  const s = exitLeft ? -1 : 1;                   // sign of the rotation
  ghost.style.transformOrigin = (exitLeft?'left':'right')+' center';
  // a real page doesn't pivot rigidly — it FLEXES and ripples as it lifts. We flutter the
  // leaf with a skew that oscillates sign several times (the "wave"), bow it out of plane
  // with an alternating rotateX, and add a touch of rotateZ wobble; amplitude is randomised
  // a little so each turn looks a bit different.
  // The leaf flexes as it turns: its free edge PEELS up first (revealing a sliver of the next
  // page already sitting underneath), then it flutters over with an oscillating skew ("wave"),
  // an out-of-plane bow (rotateX) and a touch of rotateZ wobble.
  const w  = 2.2 + Math.random()*1.6;
  const bx = 2.0 + Math.random()*1.2;
  const dur = 680;
  const P = 'perspective(1400px)';
  const fr = (offset, ry, skew, rx, rz, sc) =>
    ({ offset, transform:`${P} rotateY(${s*ry}deg) rotateX(${rx}deg) rotateZ(${s*rz}deg) skewY(${skew}deg) scale(${sc})` });
  const a=ghost.animate([
    fr(0,     0,   0,          0,      0,    1),
    fr(.12,  16,  s*w*0.6,     bx*0.6, 0.2,  1.006),   // free edge peels up → next page peeks beneath
    fr(.30,  38,  s*w,        -bx*0.5, 0.5,  1.014),
    fr(.48,  62, -s*w,         bx,     0.2,  1.016),
    fr(.66,  84,  s*w*0.7,    -bx*0.6,-0.2,  1.009),
    fr(.85, 106, -s*w*0.35,    bx*0.3, 0,    1.003),
    fr(1,   122,  0,           0,      0,    1),
  ], {duration:dur, easing:'cubic-bezier(.36,.02,.24,1)'});
  $('content').animate([{opacity:.5, transform:'scale(.99)'},{opacity:1, transform:'none'}],
                       {duration:420, easing:'ease-out'});
  // several soft shadow LINES run along the page (dark troughs, multiply) with light crests
  // (soft-light) between them, and travel sideways — the corrugated look of a flexing page.
  const ang = exitLeft ? 90 : 270;
  const from = exitLeft ? '100%' : '0%';
  const to   = exitLeft ? '0%'   : '100%';
  const shade=ghost.querySelector('.flip-ghost-shade');
  if(shade){
    shade.style.background = `linear-gradient(${ang}deg,`
      + ' rgba(0,0,0,.34) 0%, rgba(0,0,0,0) 15%, rgba(0,0,0,.26) 34%, rgba(0,0,0,0) 50%,'
      + ' rgba(0,0,0,.24) 66%, rgba(0,0,0,0) 82%, rgba(0,0,0,.4) 100%)';
    shade.style.backgroundSize = '210% 100%';
    shade.animate([
      {opacity:.15, backgroundPositionX:from},
      {opacity:.85, offset:.5},
      {opacity:.2,  backgroundPositionX:to},
    ], {duration:dur, easing:'ease-in-out'});
  }
  const gloss=ghost.querySelector('.flip-ghost-gloss');
  if(gloss){
    gloss.style.background = `linear-gradient(${ang}deg,`
      + ' rgba(255,255,255,0) 6%, rgba(255,255,255,.55) 24%, rgba(255,255,255,0) 42%,'
      + ' rgba(255,255,255,.5) 58%, rgba(255,255,255,0) 74%, rgba(255,255,255,.4) 92%)';
    gloss.style.backgroundSize = '210% 100%';
    gloss.animate([
      {opacity:0, backgroundPositionX:from},
      {opacity:.95, offset:.5},
      {opacity:0, backgroundPositionX:to},
    ], {duration:dur, easing:'ease-in-out'});
  }
  // remove the ghost when the turn ends — plus a hard fallback in case the page
  // is backgrounded (a frozen animation timeline would otherwise never fire onfinish)
  let gone=false; const done=()=>{ if(gone) return; gone=true; ghost.remove(); };
  a.onfinish=done; a.oncancel=done; setTimeout(done, 1000);
}
async function crossPortion(delta){
  const ids=S.portions.map(p=>p.id); const pidx=ids.indexOf(S.curPid);
  const np=pidx+delta; if(np<0||np>=S.portions.length) return;
  const p=S.portions[np];
  const rows = S.chMode==='standard'
    ? await api('chapters?portion_id='+p.id) : await api('sam_chapters?portion_id='+p.id);
  if(!rows.length) return;
  S.chList=rows.map(r=>({id:r.id,number:r.number}));
  S.chIdx = delta>0 ? 0 : S.chList.length-1;
  S.curPid=p.id; S.portionName=p.name;
  const ch=S.chList[S.chIdx];
  await renderVerses(ch.id, ch.number, p.id, p.name);
}
// crossing a book boundary: load the adjacent book's portions and open its first
// (forward) or last (backward) chapter — keeps the reader in continuous verse view.
async function crossBook(delta){
  await ensureBooks();
  const bIdx = (S.books||[]).findIndex(b=>b.id===S.book);
  const nb = bIdx+delta; if(bIdx<0 || nb<0 || nb>=S.books.length) return;
  const book = S.books[nb];
  const mode = S.division==='samaritan'?'samaritan':'standard';
  S.book = book.id; S.bookName = book.name;
  S.portions = await api(`portions?book_id=${book.id}&mode=${mode}`);
  if(!S.portions.length) return;
  const p = delta>0 ? S.portions[0] : S.portions[S.portions.length-1];
  const rows = S.chMode==='standard'
    ? await api('chapters?portion_id='+p.id) : await api('sam_chapters?portion_id='+p.id);
  if(!rows.length) return;
  S.chList = rows.map(r=>({id:r.id,number:r.number}));
  S.chIdx = delta>0 ? 0 : S.chList.length-1;
  S.curPid = p.id; S.portionName = p.name;
  const ch = S.chList[S.chIdx];
  await renderVerses(ch.id, ch.number, p.id, p.name);
}
async function stepPortion(delta){
  const ids=S.portions.map(p=>p.id); const pidx=ids.indexOf(S.curPid);
  const ni=pidx+delta;
  if(ni>=0 && ni<S.portions.length){
    const p=S.portions[ni];
    S.division==='samaritan' ? showSamChapters(p.id,p.name) : showChapters(p.id,p.name);
  } else {
    await crossBookPortion(delta);                 // first/last parasha → adjacent book
  }
}
// like crossBook, but stays in the chapter-LIST view of the adjacent book's
// first (forward) / last (backward) parasha
async function crossBookPortion(delta){
  await ensureBooks();
  const bIdx=(S.books||[]).findIndex(b=>b.id===S.book);
  const nb=bIdx+delta; if(bIdx<0||nb<0||nb>=S.books.length) return;
  const book=S.books[nb];
  const mode=S.division==='samaritan'?'samaritan':'standard';
  S.book=book.id; S.bookName=book.name;
  S.portions=await api(`portions?book_id=${book.id}&mode=${mode}`);
  if(!S.portions.length) return;
  const p = delta>0 ? S.portions[0] : S.portions[S.portions.length-1];
  S.division==='samaritan' ? showSamChapters(p.id,p.name) : showChapters(p.id,p.name);
}

// ── font size ────────────────────────────────────────────────────────────────
// reasonable zoom bounds: fsize()=(samFont?22:20)+offset, so the body text
// stays between ~14px (still readable) and ~40px (won't overflow the screen).
const FONT_MIN=-6, FONT_MAX=18;
$('minusBtn').onclick=()=>{ S.fontOffset=Math.max(FONT_MIN,S.fontOffset-2); paintVerses(); updateZoomButtons(); };
$('plusBtn').onclick=()=>{ S.fontOffset=Math.min(FONT_MAX,S.fontOffset+2); paintVerses(); updateZoomButtons(); };
// the navbar magnifiers only do something in verse view (there is body text to
// resize); on the chapter-list screens they are shown dimmed and non-clickable,
// and within verse view they dim once the min/max font size is reached.
function updateZoomButtons(){
  const isVerse = S.view==='verses';
  $('minusBtn').disabled = !isVerse || S.fontOffset<=FONT_MIN;
  $('plusBtn').disabled  = !isVerse || S.fontOffset>=FONT_MAX;
}

// ── read-aloud: speak the chapter from the Ben-Ḥayyim transcription (verse_translit) ─
const TTS = { items:[], idx:0, on:false, paused:false };
// the transcription is Latin with diacritics; fold it to plain ASCII so a generic
// voice pronounces it reasonably (å→a, ē→e, š→sh, ṣ→s, drop ʾ/ʿ …). Fallback only.
function ttsNorm(s){
  if(!s) return '';
  s = s.replace(/[ʾʿʼ'`ːˀ]/g,'')
       .replace(/š/g,'sh').replace(/Š/g,'Sh').replace(/ṣ/g,'s').replace(/ṭ/g,'t')
       .replace(/ġ/g,'gh').replace(/ḏ/g,'d').replace(/ḥ/g,'h').replace(/ṯ/g,'th')
       .replace(/[əǝ]/g,'e').replace(/[ɑɒ]/g,'a').replace(/ɛ/g,'e').replace(/ɔ/g,'o');
  return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
}
// Convert the Ben-Ḥayyim transcription to POINTED HEBREW so a Hebrew (he-IL) voice
// speaks it with Semitic phonetics, per Ben-Ḥayyim's key (memory: translit-pronunciation-key):
//   q(ק)→glottal א (not k) · ʾ/ʿ→א · ḥ dropped (lost) · ṣ→ס, ṭ→ט · š→שׁ · å→qamats, a→patach,
//   e→segol, ə→sheva, i→hiriq, o→holam, u→qubuts · length ':'/'^' folded away · gemination kept.
const _TTS_C = {b:'ב',B:'ב',v:'ב',f:'פ',p:'פ',m:'מ',w:'ו',t:'ת','ṭ':'ט',d:'ד','ḏ':'ד',
  s:'ס','ṣ':'ס',z:'ז','š':'שׁ','Š':'שׁ','ś':'שׂ','ṯ':'ת',l:'ל',r:'ר',n:'נ',y:'י',j:'י',
  g:'ג','ġ':'ג',k:'כ',q:'א',"'":'א','ʾ':'א','ʿ':'א','ḥ':'',h:'ה'};
// a/å → patach (clear /a/; qamats ָ is misread as qamats-katan /o/ by the voice);
// ə schwa → segol (audible; sheva ְ gets dropped and collapses the word)
const _TTS_V = {a:'ַ','å':'ַ','ā':'ַ','ɑ':'ַ','ɒ':'ַ',e:'ֶ','ē':'ֵ','ɛ':'ֶ','ə':'ֶ','ǝ':'ֶ',
  i:'ִ','ī':'ִ',o:'ֹ','ō':'ֹ','ɔ':'ֹ',u:'ֻ','ū':'ֻ'};
function ttsHeb(s){
  if(!s) return '';
  const isV = c => c in _TTS_V;
  return s.split(/(\s+)/).map(w=>{
    if(!w.trim()) return ' ';
    w = w.replace(/[:^ˆ̄̂]/g,'');     // drop length/stress marks (folded)
    const chars=[...w];
    let out='', cons=null;
    for(let k=0;k<chars.length;k++){
      const ch=chars[k];
      if(ch==='w'){                              // /w/ has no Hebrew consonant → render as a u-glide ("או")
        if(cons!==null){ out+=cons; cons=null; }
        out+='וּ'; continue;
      }
      if(ch==="'"||ch==='ʾ'||ch==='ʿ'){          // glottal from א/ה/ע
        if(cons!==null){ out+=cons; }
        // between two vowels → a light ה (avoids the vowels collapsing); else silent א
        cons = (k>0 && isV(chars[k-1]) && k+1<chars.length && isV(chars[k+1])) ? 'ה' : 'א';
        continue;
      }
      if(isV(ch)){
        if(cons!==null){ out+=cons+_TTS_V[ch]; cons=null; }
        else out+='א'+_TTS_V[ch];                // vowel onset
      } else if(ch in _TTS_C){
        if(_TTS_C[ch]==='') continue;            // ḥ — lost, dropped
        if(cons!==null) out+=cons;               // previous consonant closes the syllable
        cons=_TTS_C[ch];
      } else if(!/[.,;:!?'"()\[\]־–—*]/.test(ch)){
        if(cons!==null){ out+=cons; cons=null; }
        out+=ch;
      }
    }
    if(cons!==null) out+=cons;                   // final consonant
    return out;
  }).join('');
}
let _TTS_HEVOICE = null;
function ttsHebVoice(){
  try{ const vs=speechSynthesis.getVoices()||[];
    _TTS_HEVOICE = vs.find(v=>/^(he|iw)\b/i.test(v.lang||'')) || _TTS_HEVOICE;
  }catch(e){}
  return _TTS_HEVOICE;
}
try{ speechSynthesis.onvoiceschanged = ttsHebVoice; ttsHebVoice(); }catch(e){}
// Server-side Azure Neural TTS (IPA-driven, correct mil'el stress) is preferred when
// configured; otherwise we fall back to the browser voice. TTS_SERVER: null=unprobed.
let TTS_SERVER = null;
let ttsAudio = null;
async function ttsProbeServer(){
  if(TTS_SERVER !== null) return TTS_SERVER;
  try{ const s = await api('tts_status'); TTS_SERVER = !!(s && s.enabled); }
  catch(e){ TTS_SERVER = false; }
  return TTS_SERVER;
}
async function ttsStart(){
  if(S.view!=='verses' || !Array.isArray(S.verses) || !S.verses.length) return;
  if(typeof readingStop==='function') readingStop();   // TTS and the reading recording are exclusive
  await ttsProbeServer();
  if(!TTS_SERVER && !('speechSynthesis' in window)){ showInfo(t('play_chapter'), '<div class="note">קול אינו נתמך בדפדפן זה.</div>'); return; }
  let tr; try{ tr=await api('translit?verse_ids='+S.verses.map(v=>v.id).join(',')); }catch(e){ tr={}; }
  TTS.items = S.verses.filter(v=>tr[v.id] && tr[v.id].trim()).map(v=>({vid:v.id, num:v.number, text:tr[v.id]}));
  if(!TTS.items.length){ showInfo(t('play_chapter'), '<div class="note">אין תעתיק הגייה לפרק זה.</div>'); return; }
  TTS.idx=0; TTS.on=true; TTS.paused=false;
  $('audioBar').classList.remove('hidden');
  { const pb=$('playBtn'); if(pb) pb.classList.add('playing'); }   // header button removed; kept null-safe
  $('auSeek').max = TTS.items.length-1; $('auSeek').value = 0;
  ttsSpeak();
}
function ttsStopAudio(){ if(ttsAudio){ try{ ttsAudio.pause(); }catch(e){} ttsAudio.onended=null; ttsAudio.onerror=null; ttsAudio=null; } }
function ttsAdvance(){ if(!TTS.on || TTS.paused) return;
  if(TTS.idx < TTS.items.length-1){ TTS.idx++; ttsBar(); ttsSpeak(); } else ttsStop(); }
function ttsSpeak(){
  const it = TTS.items[TTS.idx]; if(!it){ ttsStop(); return; }
  ttsHighlight(it.vid); ttsBar();
  if(TTS_SERVER){
    try{ speechSynthesis.cancel(); }catch(e){}
    ttsStopAudio();
    const a = new Audio('/api/tts?verse_id='+it.vid);
    ttsAudio = a;
    a.onended = ()=>{ if(a===ttsAudio) ttsAdvance(); };
    a.onerror = ()=>{ if(a!==ttsAudio) return; ttsAudio=null; ttsSpeakBrowser(it); };  // fall back per-verse
    a.play().catch(()=>{ if(a!==ttsAudio) return; ttsAudio=null; ttsSpeakBrowser(it); });
    return;
  }
  ttsSpeakBrowser(it);
}
function ttsSpeakBrowser(it){
  try{ speechSynthesis.cancel(); }catch(e){}
  const voice = ttsHebVoice();
  const u = new SpeechSynthesisUtterance(voice ? ttsHeb(it.text) : ttsNorm(it.text));
  if(voice){ u.voice = voice; u.lang = voice.lang; } else u.lang = 'he-IL';
  u.rate = 0.8;
  u.onend = ttsAdvance;
  try{ speechSynthesis.speak(u); }catch(e){}
}
function ttsBar(){ $('auSeek').value = TTS.idx; $('auPos').textContent = (TTS.idx+1)+'/'+TTS.items.length; }
function ttsHighlight(vid){
  document.querySelectorAll('.tts-reading').forEach(e=>e.classList.remove('tts-reading'));
  const row = document.querySelector('.vrow[data-vid="'+vid+'"]');
  if(row){ row.classList.add('tts-reading'); row.scrollIntoView({block:'center', behavior:'smooth'}); }
}
function ttsPauseResume(){
  if(TTS.paused){
    TTS.paused=false; setAuIcon(false);
    if(ttsAudio){ ttsAudio.play().catch(()=>{}); } else { try{ speechSynthesis.resume(); }catch(e){} }
  } else {
    TTS.paused=true; setAuIcon(true);
    if(ttsAudio){ try{ ttsAudio.pause(); }catch(e){} } else { try{ speechSynthesis.pause(); }catch(e){} }
  }
}
function setAuIcon(showPlay){   // showPlay=true → ▶ (resume); else ❚❚ (pause)
  $('auPlayPause').innerHTML = showPlay
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
}
function ttsStop(){
  TTS.on=false; TTS.paused=false; try{ speechSynthesis.cancel(); }catch(e){} ttsStopAudio();
  $('audioBar').classList.add('hidden');
  { const pb=$('playBtn'); if(pb) pb.classList.remove('playing'); }
  setAuIcon(false);
  document.querySelectorAll('.tts-reading').forEach(e=>e.classList.remove('tts-reading'));
}
function ttsSeek(i){
  TTS.idx = Math.max(0, Math.min(TTS.items.length-1, i|0));
  if(TTS.on){ TTS.paused=false; setAuIcon(false); ttsSpeak(); } else ttsBar();
}
{ const pb=$('playBtn'); if(pb) pb.onclick = ()=>{ TTS.on ? ttsStop() : ttsStart(); }; }   // header TTS button removed from the UI
$('auPlayPause').onclick = ttsPauseResume;
$('auStop').onclick      = ttsStop;
$('auSeek').oninput      = e=>ttsSeek(+e.target.value);
// enable the read-aloud button once server-side (Azure) TTS is confirmed available
(async ()=>{ try{ if(await ttsProbeServer()){ const b=$('playBtn'); if(b){ b.disabled=false; b.title=t('play_chapter')||'הקראת הפרק'; } } }catch(e){} })();

// ── live pronunciation preview: show, under each verse, the transcription and the
//    pointed-Hebrew the read-aloud engine will actually speak (for tuning the rules) ──
let PRON = {};             // verse_id -> transcription text
let SHOW_PRON = localStorage.getItem('as_pron')==='1';
async function ensurePron(){
  const need = (S.verses||[]).map(v=>v.id).filter(id=>!(id in PRON));
  if(!need.length) return;
  try{ const tr=await api('translit?verse_ids='+need.join(',')); for(const id of need) PRON[id]=tr[id]||''; }
  catch(e){ for(const id of need) PRON[id]=PRON[id]||''; }
}
async function togglePron(){
  SHOW_PRON=!SHOW_PRON; localStorage.setItem('as_pron', SHOW_PRON?'1':'0');
  $('pronBtn').classList.toggle('on', SHOW_PRON);
  if(SHOW_PRON) await ensurePron();
  paintVerses();
}
$('pronBtn').onclick = togglePron;
$('pronBtn').classList.toggle('on', SHOW_PRON);

// ── view chrome (show/hide nav + enable toolbar) ─────────────────────────────
// NOTE: must not be called navLabel — that name belongs to the prev/next button
// label builder above, and a second declaration would silently overwrite it
// (leaving the arrows labelled with the current screen instead of the parasha).
function viewLabel(){
  if(S.view==='books') return 'רשימת ספרים';
  if(S.view==='portions') return 'פרשות · '+(S.bookName||'');
  if(S.view==='spread') return 'פריסת פרקים · '+(S.bookName||'');
  if(S.view==='chapters'||S.view==='sam_chapters') return (S.bookName||'')+' › '+(S.portionName||'');
  if(S.view==='verses') return (S.bookName||'')+' › פרק '+(S.curChNum||'')+(S.chMode==='samaritan'?' (שומרוני)':'');
  return S.view||'';
}
function setView(){
  trackNav(viewLabel());
  const isVerse = S.view==='verses';
  const browse = (S.view==='books'||S.view==='portions'||S.view==='spread');
  // the navbar now hosts the back button, so it shows on every screen except search;
  // on the plain browse screens only the (centered) back button is visible.
  $('navbar').classList.remove('hidden');
  ['nextBtn','prevBtn','minusBtn','plusBtn'].forEach(id=>$(id).classList.toggle('hidden', browse));
  $('navbar').classList.toggle('nav-backonly', browse);
  $('spreadBtn').classList.toggle('hidden', !(S.view==='portions'));
  $('bmAddBtn').classList.toggle('hidden', !isVerse);   // floating "add bookmark"
  { const pb=$('playBtn'); if(pb) pb.classList.toggle('hidden', !isVerse); }   // (removed from UI)
  $('printBtn').classList.toggle('hidden', !isVerse);   // print-to-PDF
  $('pronBtn').classList.toggle('hidden', !isVerse);    // pronunciation preview toggle
  if(!isVerse && typeof ttsStop==='function') ttsStop();
  syncToolbar(isVerse);
  updateToolbarFold(isVerse);
  updateZoomButtons();
}

// ── collapsible bottom toolbar (text / comparison screens) ─────────────────────
// the two display-mode rows fold away after a few seconds, leaving a drag handle;
// the next/prev and zoom controls (in #navbar) stay put.
let tbFolded=false, tbUserOpened=false, tbFoldTimer=null, tbInVerse=false;
let divFolded=false, divUserOpened=false;
// the standing hint arrow on a folded handle. It goes up only AFTER whatever
// animation just ran has finished — the fold transition, and the big transient
// arrow when one was shown — so the two never sit on the handle together.
const TB_ARROW_MS = 3000, TB_FOLD_MS = 420;
let tbHintTimer=null, divHintTimer=null;
function hintAfterFold(node, folded, withArrow, timer){
  clearTimeout(timer);
  node.classList.remove('hint-on');
  if(!folded) return null;
  return setTimeout(()=>node.classList.add('hint-on'),
                    withArrow ? TB_ARROW_MS + 250 : TB_FOLD_MS);
}
// linkDiv=false folds the bottom bar ALONE — used on the book list, where the
// division toggle above is the whole point of the screen and must stay up.
function setToolbarFolded(folded, withArrow, linkDiv){
  const wasFolded=tbFolded;
  tbFolded=folded;
  const tb=$('toolbar'); tb.classList.toggle('folded', folded);
  tb.classList.remove('show-arrow'); tb.classList.remove('show-down');
  if(folded && withArrow){
    void tb.offsetWidth; tb.classList.add('show-arrow');             // up-arrow ~3s after folding
    setTimeout(()=>tb.classList.remove('show-arrow'), TB_ARROW_MS);
  } else if(!folded && withArrow && wasFolded){
    void tb.offsetWidth; tb.classList.add('show-down');              // reverse: down-arrow ~2s after opening
    setTimeout(()=>tb.classList.remove('show-down'), 2000);
  }
  tbHintTimer = hintAfterFold(tb, folded, withArrow, tbHintTimer);
  if(folded && linkDiv!==false && !divFolded) setDivFolded(true, withArrow);   // FOLD links both bars (not open)
}
// the top division-toggle bar (יהודית/שומרונית) folds like the bottom toolbar, with
// its own handle. Folding links both bars; opening one does NOT open the other.
function setDivFolded(folded, withArrow){
  const was=divFolded; divFolded=folded;
  document.body.classList.toggle('div-collapsed', folded);
  const h=$('divHandle');
  if(h){
    h.classList.remove('show-arrow'); h.classList.remove('show-down');
    if(folded && withArrow){ void h.offsetWidth; h.classList.add('show-arrow'); setTimeout(()=>h.classList.remove('show-arrow'),TB_ARROW_MS); }
    else if(!folded && withArrow && was){ void h.offsetWidth; h.classList.add('show-down'); setTimeout(()=>h.classList.remove('show-down'),2000); }
    divHintTimer = hintAfterFold(h, folded, withArrow, divHintTimer);
  }
  if(folded && !tbFolded) setToolbarFolded(true, withArrow);        // fold together
}
function armAutoFold(){   // fold (with the arrow animation) after 3s
  clearTimeout(tbFoldTimer);
  tbFoldTimer=setTimeout(()=>{ if(S.view==='verses' && !tbUserOpened) setToolbarFolded(true,true); }, 3000);
}
function updateToolbarFold(isVerse){
  clearTimeout(tbFoldTimer);
  if(!isVerse){                                  // not a text screen
    tbInVerse=false; setToolbarFolded(false,false); setDivFolded(false,false);
    // the book list carries the poem in the space beneath the books: fold the
    // bottom bar away after a moment so the poem is in view. The bar above it
    // stays — choosing the division is what that screen is for.
    if(S.view==='books')
      tbFoldTimer=setTimeout(()=>{ if(S.view==='books') setToolbarFolded(true,true,false); }, 1500);
    return;
  }
  const fresh = !tbInVerse;   // arriving at a text/comparison screen from elsewhere
  tbInVerse=true;
  // every fresh entry: show the bar open, then auto-fold (with animation) after 3s —
  // not just the first time, so re-entering these screens always re-runs the fold.
  if(fresh){ tbUserOpened=false; divUserOpened=false; setDivFolded(false,false); setToolbarFolded(false,false); armAutoFold(); return; }
  // moving chapter-to-chapter within the text view: keep the user's current choice
  if(tbUserOpened){ setToolbarFolded(false,false); return; }
  if(tbFolded){ setToolbarFolded(true,false); return; }
  armAutoFold();
}
(function(){
  const h=document.getElementById('tbHandle'); if(!h) return;
  let downY=null;
  h.addEventListener('pointerdown', e=>{ downY=e.clientY; });
  const release=(e)=>{
    const dy = downY==null ? 0 : (e.clientY-downY); downY=null;
    if(dy < -12){ tbUserOpened=true; setToolbarFolded(false,true); }        // drag up → open (down-arrow)
    else if(dy > 12){ tbUserOpened=false; setToolbarFolded(true,true); }    // drag down → fold
    else if(tbFolded){ tbUserOpened=true; setToolbarFolded(false,true); }   // tap → open (down-arrow)
    else { tbUserOpened=false; setToolbarFolded(true,true); }               // tap → fold
  };
  h.addEventListener('pointerup', release);
  h.addEventListener('pointercancel', ()=>{ downY=null; });
})();
// the top division-bar handle: same gestures, but the bar opens DOWNWARD (drag down
// or tap-when-folded opens; drag up or tap-when-open folds). Opens only itself.
(function(){
  const h=document.getElementById('divHandle'); if(!h) return;
  let downY=null;
  h.addEventListener('pointerdown', e=>{ downY=e.clientY; });
  const release=(e)=>{
    const dy = downY==null ? 0 : (e.clientY-downY); downY=null;
    if(dy > 12){ divUserOpened=true; setDivFolded(false,true); }        // drag down → open
    else if(dy < -12){ divUserOpened=false; setDivFolded(true,true); }  // drag up → fold
    else if(divFolded){ divUserOpened=true; setDivFolded(false,true); } // tap → open
    else { divUserOpened=false; setDivFolded(true,true); }              // tap → fold
  };
  h.addEventListener('pointerup', release);
  h.addEventListener('pointercancel', ()=>{ downY=null; });
})();
// base colours of each mode button (matching the native app's palette);
// disabled → grey, active → bright blue, otherwise its own colour.
const BTN_BASE = {
  fontBtn:'#40406b', translateBtn:'#2a6e7a', dictBtn:'#405973', interpBtn:'#335959',
  compareBtn:'#593373', commentaryBtn:'#4d4d80', samSrcBtn:'#735438',
  variantsBtn:'#7a3550',
};
function syncToolbar(isVerse){
  $('shareBtn').classList.toggle('hidden', !isVerse);
  // "עיון" goes to the book list — so on the book list itself it does nothing, and
  // it greys out there like any other button with nothing to do
  $('browseBtn').disabled = (S.view === 'books');
  const setBtn=(id,enabled,on)=>{
    const b=$(id); b.disabled=!enabled; b.classList.toggle('on',!!on);
    b.style.background = !enabled ? '#555' : (on ? 'var(--active)' : (BTN_BASE[id]||''));
  };
  // all the content/display buttons form a single-select group: only one is
  // active at a time (clicking one turns the previous off), so every button is
  // simply enabled in verse view and highlighted when it is the active one.
  const sam=S.samFont;
  setBtn('fontBtn', isVerse, sam);
  // the button shows just "א-ב" in the script you'd switch TO: Samaritan ࠀࠁ when
  // currently Hebrew, regular Hebrew אב when currently Samaritan.
  const _ab=$('fontBtn').querySelector('.font-ab');
  // the button shows "א.ב" in the script you'd switch TO. In the Samaritan form only
  // the two LETTERS use the Samaritan font; the separating dot stays a normal "."
  // (default font) so it looks exactly like the dot in the Hebrew "א.ב".
  _ab.classList.remove('sam-script');
  if(sam) _ab.textContent = 'א.ב';
  else    _ab.innerHTML = '<span class="sam-let">ࠀ</span>.<span class="sam-let">ࠁ</span>';
  $('fontBtn').title = sam ? t('font_heb') : t('font_sam');
  $('fontBtn').setAttribute('aria-label', sam ? t('font_heb') : t('font_sam'));
  // "כולל פירושים?" — only visible while the Samaritan font itself is on
  { const fb=$('samFullBtn');
    fb.classList.toggle('hidden', !(isVerse && sam));
    fb.classList.toggle('on', S.samFontFull);
    fb.textContent = t('sam_full_q') + (S.samFontFull ? t('sf_yes') : t('sf_no')); }
  setBtn('dictBtn',       isVerse, S.dict);
  setBtn('interpBtn',     isVerse, S.panel==='interpret');
  setBtn('compareBtn',    isVerse, S.panel==='compare');
  setBtn('commentaryBtn', isVerse, S.panel==='commentary');
  setBtn('variantsBtn',   isVerse, S.panel==='variants');
  setBtn('samSrcBtn',     isVerse, S.panel==='samaritan_src');
  const transOn = S.english || S.panel==='aramaic' || S.panel==='arabic';
  setBtn('translateBtn',  isVerse, transOn);
  $('translateBtn').textContent = S.english ? t('t_english')
    : S.panel==='aramaic' ? t('t_aramaic')
    : S.panel==='arabic'  ? t('t_arabic') : t('translate');
}

// ── toolbar handlers ─────────────────────────────────────────────────────────
// spin the round "back" icon a full 360° on each press
function spinBack(btn){
  const ic=btn && btn.querySelector('.tbi'); if(!ic) return;
  ic.classList.remove('spin360'); void ic.offsetWidth; ic.classList.add('spin360');
}
$('browseBtn').onclick=()=>{ showSearch(false); showBooks(); };
$('searchBtn').onclick=()=>showSearch(true);
$('backBtn').onclick=()=>{ spinBack($('backBtn')); goBack(); };

// every content/display mode is mutually exclusive — turning one on clears the rest
function clearModes(){ S.panel=null; S.dict=false; S.english=false; S.samFont=false; S.samFontFull=false; S.dictWord=null; S.interpSam=false; S.interpLang='he'; DICT_SELECT_MAP={}; }
// like clearModes(), but when the reader has "כולל פירושים?" on AND is switching
// to/from one of the three surfaces it actually covers (ממקור שומרון / Aramaic
// translation / verse interpretation), the Samaritan-font state survives the
// switch instead of being reset — matching "switching to yes keeps the
// Samaritan text also when Samaritan sources or verse commentary appear".
function clearModesPreserveFont(targetPanel){
  const preserve = S.samFont && S.samFontFull &&
    ['samaritan_src','aramaic','interpret'].includes(targetPanel);
  const sf=S.samFont, sff=S.samFontFull;
  clearModes();
  if(preserve){ S.samFont=sf; S.samFontFull=sff; }
}
$('fontBtn').onclick=()=>{ const was=S.samFont; clearModes(); S.samFont=!was; syncToolbar(true); paintVerses(); };
// "כולל פירושים?" — only meaningful while samFont is on; syncToolbar() shows/hides
// and labels this button on every relevant state change, so this handler only
// needs to flip the flag itself.
$('samFullBtn').onclick=()=>{ S.samFontFull=!S.samFontFull; syncToolbar(true); paintVerses(); };
// "תרגומי התורה" — opens a small picker (ארמי / ערבי / אנגלי), marking the active one
$('translateBtn').onclick=()=>{
  // if a translation is already showing, this button turns it OFF → back to the text
  if(S.english || S.panel==='aramaic' || S.panel==='arabic'){
    clearModesPreserveFont(S.panel); syncToolbar(true); paintVerses(); return;
  }
  // otherwise open the picker (marking the active choice, if any)
  document.querySelectorAll('#transModal .trans-opt').forEach(b=>{
    const tr=b.dataset.tr;
    b.classList.toggle('sel', (tr==='english'&&S.english)||(!!tr&&S.panel===tr));
  });
  $('transModal').classList.remove('hidden');
};
document.querySelectorAll('#transModal .trans-opt').forEach(b=>{
  b.onclick=()=>{
    const tr=b.dataset.tr; $('transModal').classList.add('hidden');
    if(!tr) return;                                  // "סגור"
    if(tr==='english'){ const was=S.english; clearModes(); S.english=!was; syncToolbar(true); paintVerses(); }
    else togglePanel(tr);                            // aramaic / arabic — toggles + exclusion + scroll
  };
});
// when a panel/dictionary opens below the text, scroll it into view so the user
// sees that something opened (it retries until the async panel is in the DOM).
function scrollToEl(selector){
  let tries=0;
  const tick=()=>{
    const el=$('content').querySelector(selector);
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    else if(tries++<25) setTimeout(tick,60);
  };
  setTimeout(tick,60);
}
$('dictBtn').onclick=()=>{ const was=S.dict; clearModes(); S.dict=!was; syncToolbar(true); paintVerses(); };
function togglePanel(name){
  const was = (S.panel===name);
  clearModesPreserveFont(name);
  if(!was){
    S.panel = name;
    if(S.panel==='commentary') S.commentarySel=null;
    if(S.panel==='samaritan_src'){ S.samSrcChoice=null; S.tmSel=null; }
  }
  syncToolbar(true); paintVerses();
  if(S.panel) scrollToEl('.pair, .srcpanel');
}
$('interpBtn').onclick=()=>togglePanel('interpret');
// "השוואת נוסחים": if the comparison is open, close it; otherwise open the version
// picker (Masoretic / Septuagint) and show the chosen comparison.
$('compareBtn').onclick=()=>{
  if(S.panel==='compare'){ clearModes(); syncToolbar(true); paintVerses(); return; }
  document.querySelectorAll('#cmpModal .cv-opt').forEach(b=>
    b.classList.toggle('sel', !!b.dataset.cv && b.dataset.cv===(S.cmpVersion||'masoretic')));
  $('cmpModal').classList.remove('hidden');
};
document.querySelectorAll('#cmpModal .cv-opt').forEach(b=>{
  b.onclick=()=>{
    const cv=b.dataset.cv; $('cmpModal').classList.add('hidden');
    if(!cv) return;                       // "סגור"
    S.cmpVersion=cv; clearModes(); S.panel='compare';
    syncToolbar(true); paintVerses(); scrollToEl('.cmp-grid');
  };
});
$('commentaryBtn').onclick=()=>togglePanel('commentary');
$('samSrcBtn').onclick=()=>togglePanel('samaritan_src');
$('variantsBtn').onclick=()=>togglePanel('variants');

// ── print to PDF ─────────────────────────────────────────────────────────
// Builds a dedicated, self-contained #printArea page (own layout, not the
// on-screen reader) and either shows it as an on-screen mock-up
// (body.print-preview) or hands it to the browser's native print/Save-as-PDF
// dialog (body.printing, via @media print in style.css — see there for why a
// body-class toggle was used instead of listing every modal id).
//
// Preview and paper are ONE layout, not two: the .pr-* rules sit outside any
// media query and are written in pt/mm, and the preview draws the page at its
// true A4 size. They used to be styled separately, which is precisely how the
// two drifted apart — what came out of the printer was not what the preview
// had shown.
const PRINT_TR_FIELD  = {aramaic:'sam_aramaic', arabic:'arabic_trans', english:'english'};
const PRINT_TR_LABEL  = {aramaic:'תרגום ארמי',  arabic:'תרגום ערבי',  english:'תרגום אנגלי'};
const S_print = {font:'samaritan', fontTouched:false, noNums:false, interp:false,
                 dict:false, trans:false, trChoice:null};

$('printBtn').onclick = () => {
  // open on the script the reader is actually looking at, so printing follows
  // what is on the screen — until the reader picks a font themselves, after
  // which their choice stands and is not overwritten on the next open.
  if(!S_print.fontTouched) S_print.font = S.samFont ? 'samaritan' : 'hebrew';
  document.querySelectorAll('#printModal .pr-opt').forEach(b=>b.classList.toggle('sel', b.dataset.font===S_print.font));
  $('prNoNums').checked = S_print.noNums;
  $('prInterp').checked = S_print.interp;
  $('prDict').checked = S_print.dict;
  $('prTrans').checked = S_print.trans;
  updatePrintNoNumsState();
  updatePrintTransLabel();
  $('printModal').classList.remove('hidden');
};
$('prCancel').onclick = () => $('printModal').classList.add('hidden');
document.querySelectorAll('#printModal .pr-opt').forEach(b=>{
  b.onclick = () => { S_print.font = b.dataset.font; S_print.fontTouched = true;
    document.querySelectorAll('#printModal .pr-opt').forEach(x=>x.classList.toggle('sel', x===b));
    updatePrintNoNumsState(); };
});
// "הסר מספרי פסוק" (continuous scroll-style flow) applies only to a
// single-column Samaritan printout, so the checkbox is greyed out whenever it
// cannot take effect — with the Hebrew font, and with a translation chosen
// (there the columns must stay alignable verse-for-verse). The Hebrew-font case
// also force-clears it, since that is a different rendering mode entirely;
// the translation case only disables, so unchecking the translation brings the
// user's choice back rather than silently discarding it.
function updatePrintNoNumsState(){
  const samFont = S_print.font === 'samaritan';
  const splitMode = !!(S_print.trans && S_print.trChoice);
  const cb = $('prNoNums');
  cb.disabled = !samFont || splitMode;
  $('prNoNumsRow').classList.toggle('pr-disabled', cb.disabled);
  if(!samFont && cb.checked){ cb.checked = false; S_print.noNums = false; }
}
$('prNoNums').onchange = e => { S_print.noNums = e.target.checked; };
$('prInterp').onchange = e => { S_print.interp = e.target.checked; };
$('prDict').onchange   = e => { S_print.dict   = e.target.checked; };
$('prTrans').onchange = e => {
  S_print.trans = e.target.checked;
  if(S_print.trans && !S_print.trChoice){
    $('printModal').classList.add('hidden');
    $('printTransModal').classList.remove('hidden');
  } else if(!S_print.trans){
    S_print.trChoice = null;
  }
  updatePrintTransLabel();
  updatePrintNoNumsState();
};
document.querySelectorAll('#printTransModal .pt-opt').forEach(b=>{
  b.onclick = () => {
    const tr = b.dataset.tr;
    $('printTransModal').classList.add('hidden');
    if(tr) S_print.trChoice = tr;
    else if(!S_print.trChoice){ S_print.trans = false; $('prTrans').checked = false; }
    updatePrintTransLabel();
    updatePrintNoNumsState();
    $('printModal').classList.remove('hidden');
  };
});
function updatePrintTransLabel(){
  const lab = $('prTransChosen');
  if(S_print.trans && S_print.trChoice){ lab.textContent = 'נבחר: ' + PRINT_TR_LABEL[S_print.trChoice]; lab.classList.remove('hidden'); }
  else lab.classList.add('hidden');
}
$('prPreview').onclick = async () => {
  $('printModal').classList.add('hidden');
  await buildPrintPage();
  fitPreviewSheet();
  document.body.classList.add('print-preview');
  $('printPreviewBar').classList.remove('hidden');
};
// The preview shows a real A4 sheet — 210mm wide, which on a phone is wider than
// the screen. Zoom it down to fit rather than scale it: `zoom` shrinks the layout
// box with the content, so the scroll area follows, while `transform` would leave
// the sheet's original footprint behind as empty grey.
function fitPreviewSheet(){
  const A4 = 210 / 25.4 * 96;                   // 210mm in CSS pixels (96dpi)
  document.documentElement.style.setProperty(
    '--pr-zoom', Math.min(1, (window.innerWidth - 16) / A4).toFixed(3));
}
window.addEventListener('resize', () => {
  if(document.body.classList.contains('print-preview')) fitPreviewSheet();
});
$('ppCloseBtn').onclick = () => {
  document.body.classList.remove('print-preview');
  $('printPreviewBar').classList.add('hidden');
  // drop the built sheet with the preview: it belongs to the view that was open
  // when it was built, and a later Ctrl+P must not print a page from somewhere else
  $('printArea').innerHTML = '';
};
$('ppPrintBtn').onclick = () => {
  // printing straight from the on-screen preview still needs the SAME
  // body.printing isolation prGo uses (@media print keys off it exclusively) —
  // print-preview's own CSS is screen-only and does nothing for paper output.
  document.body.classList.add('printing');
  window.print();
};
$('prGo').onclick = async () => {
  $('printModal').classList.add('hidden');
  await buildPrintPage();
  document.body.classList.add('printing');
  setTimeout(()=>window.print(), 60);   // let layout/fonts settle before the print dialog opens
};
// Ctrl+P, the browser's own menu and the phone's share→print never pass through
// the buttons above, so body.printing would never be set and the whole app —
// header, toolbar, reading bar and all — would land on the paper. Catch the print
// at the last moment instead: if a page was already built (from the preview) use
// it, otherwise build the chapter on the spot. beforeprint cannot await, so that
// fallback is the text alone — the commentary and the dictionary need the server.
window.addEventListener('beforeprint', () => {
  if(document.body.classList.contains('printing')) return;
  if(!$('printArea').children.length){
    if(!(S.verses || []).length) return;        // not in a chapter — leave the page alone
    $('printArea').appendChild(printSkeleton());
  }
  document.body.classList.add('printing');
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
  // same reason as the preview's close button — unless the preview is still up,
  // in which case the sheet on screen is the one that was just printed
  if(!document.body.classList.contains('print-preview')) $('printArea').innerHTML = '';
});

// The page is built in two steps so that it can also be produced synchronously:
// printSkeleton() is everything that needs no server call — the header and the
// chapter text itself — and buildPrintPage() adds the commentary and the
// dictionary on top of it. beforeprint, which cannot await, prints the skeleton.
const prVerseText = text => S_print.font === 'samaritan'
  ? samMarkup(addWordDots(text||'')) : esc(text||'');
// Commentary and quoted sources follow the SAME script chosen for the text —
// Samaritan (in the fluent SamComment face that prose uses on screen) or plain
// Hebrew. There is no separate choice for them: one sheet, one script.
const prProse = txt => S_print.font === 'samaritan'
  ? samMarkupFree(addWordDots(stripNiqqud(txt||''))) : esc(txt||'');
const prVrow = (num, innerHTML, cls) => {
  const r = el('div','pr-vrow' + (cls ? ' ' + cls : ''));
  if(num != null) r.appendChild(el('span','pr-vnum', esc(String(num))));
  r.insertAdjacentHTML('beforeend', innerHTML);
  return r;
};
// פירוש הפסוק and מילון מילים are sections of the sheet, not boxes on it: a frame
// drawn round a commentary that runs over three pages breaks badly, so each is
// set off from the text above it by a rule instead.
const prSection = title => {
  const s = el('div','pr-sec');
  s.appendChild(el('div','pr-sec-title', title));
  return s;
};

function printSkeleton(){
  const verses = S.verses || [];
  const useSam = S_print.font === 'samaritan';
  const page = el('div','pr-page');

  const hdr = el('div','pr-header');
  hdr.appendChild(el('div','pr-book', esc(S.bookName||'')));
  hdr.appendChild(el('div','pr-portion', esc(S.portionName||'')));
  let chLabel = S.chMode==='samaritan' ? ('פרק שומרוני '+S.curChNum) : ('פרק '+S.curChNum);
  const opening = ((verses[0]||{}).text||'').trim().split(/\s+/).filter(Boolean).slice(0,4).join(' ');
  if(opening) chLabel += ' (' + opening + ')';
  hdr.appendChild(el('div','pr-chapter', esc(chLabel)));
  page.appendChild(hdr);

  // "הסר מספרי פסוק": one continuous justified block instead of a row per verse,
  // Samaritan script only. The verse texts are joined BEFORE addWordDots so the
  // word-separator dots fall between verses by the very same rules they follow
  // inside one (its own PAUSE rule already suppresses a dot after a verse-final
  // ./׃), which is what makes the result read as an unbroken scroll line.
  // …but NOT when a translation is printed: there the two columns have to stay
  // alignable verse-for-verse, so the numbers are kept regardless of the flag.
  const splitMode = !!(S_print.trans && S_print.trChoice);
  const flow = useSam && S_print.noNums && !splitMode;

  if(splitMode){
    const main = el('div','pr-main pr-split');
    const fld = PRINT_TR_FIELD[S_print.trChoice];
    const origCol = el('div','pr-col pr-orig');
    origCol.appendChild(el('div','pr-col-title','המקור'));
    const trCol = el('div','pr-col pr-tr');
    if(S_print.trChoice === 'english') trCol.dir = 'ltr';
    trCol.appendChild(el('div','pr-col-title', PRINT_TR_LABEL[S_print.trChoice]));
    verses.forEach(v => origCol.appendChild(prVrow(v.number, prVerseText(v.text))));
    verses.forEach(v => trCol.appendChild(prVrow(v.number, esc(v[fld]||''))));
    main.appendChild(origCol); main.appendChild(trCol);
    page.appendChild(main);
  } else if(flow){
    const joined = verses.map(v => (v.text||'').trim()).filter(Boolean).join(' ');
    const d = el('div','pr-main pr-flow');
    d.innerHTML = samMarkup(addWordDots(joined));
    page.appendChild(d);
  } else {
    const main = el('div','pr-main');
    verses.forEach(v => main.appendChild(prVrow(v.number, prVerseText(v.text))));
    page.appendChild(main);
  }
  return page;
}

async function buildPrintPage(){
  const verses = S.verses || [];
  if(!verses.length) return;
  const area = $('printArea'); area.innerHTML = '';
  const page = printSkeleton();
  area.appendChild(page);
  // the commentary belongs to the chapter above it and so follows it directly;
  // the dictionary — a reference table rather than a reading — comes after both.
  if(S_print.interp) await addPrintInterp(page, verses);
  if(S_print.dict)   await addPrintDict(page, verses);
}

async function addPrintInterp(page, verses){
  const sec = prSection('פירוש הפסוק');
  try{
    const vids = verses.map(v=>v.id).join(',');
    const m = await api('interpretations?verse_ids='+vids);
    // the printed page carries what the screen carries, ספר האסאטיר included
    const asa = await api('asatir_by_verse?verse_ids='+vids).catch(()=>({}));
    const bhq = await api('bhuq_by_verse?verse_ids='+vids).catch(()=>({}));
    let any = false;
    verses.forEach(v => {
      const txt = (m[v.id]||'').trim();
      const items = asa[v.id] || [];
      const bitems = bhq[v.id] || [];
      if(!txt && !items.length && !bitems.length) return;
      any = true;
      if(txt) sec.appendChild(prVrow(v.number, prProse(txt)));
      // `first` carries the verse number onto whichever quoted source opens the
      // row, so a verse with no commentary of its own is still numbered once
      let first = !txt;
      const quoted = (lead, text) => {
        const r = prVrow(first ? v.number : null, '', 'pr-quoted');
        first = false;
        r.appendChild(el('span','pr-quoted-lead', esc(lead)));
        r.insertAdjacentHTML('beforeend', prProse(text));
        sec.appendChild(r);
      };
      for(const it of items)
        quoted(t('interp_asatir_lead')
          + (it.ref ? ' (' + it.ref + (it.title ? ' · ' + it.title : '') + ')' : '') + ': ', it.text);
      for(const it of bitems)
        quoted(t('interp_bhuq_lead')
          + (it.ref ? ' ' + it.ref + (it.title ? ' · ' + it.title : '') : '') + ': ', it.text);
    });
    if(!any) sec.appendChild(el('div','','אין פירוש זמין לפרק זה'));
  }catch(e){ sec.appendChild(el('div','','שגיאה בטעינת פירוש הפסוק')); }
  page.appendChild(sec);
}

async function addPrintDict(page, verses){
  const sec = prSection('מילון מילים');
  try{
    const m = await api('word_table?verse_ids='+verses.map(v=>v.id).join(','));
    const tbl = el('table','pr-wtbl','<thead><tr><th>מילה</th><th>ארמית</th><th>עברית</th><th>מילון</th></tr></thead>');
    const tbody = el('tbody');
    verses.forEach(v => (m[v.id]||[]).forEach(row => {
      const tr = el('tr','','');
      // the word itself is the verse's own word, so it is set in the script the
      // reader chose for the verses; the glosses stay in Hebrew, as they are
      tr.innerHTML = '<td>'+prVerseText(row.word||'')+'</td><td>'+esc(row.aramaic||'')+'</td>'
                   + '<td>'+esc(row.meaning||'')+'</td><td>'+esc(row.tal||'')+'</td>';
      tbody.appendChild(tr);
    }));
    tbl.appendChild(tbody);
    sec.appendChild(tbl);
  }catch(e){ sec.appendChild(el('div','','שגיאה בטעינת מילון המילים')); }
  page.appendChild(sec);
}

// ── printing a library unit ──────────────────────────────────────────────────
// The library's standalone units print onto the SAME sheet as the Torah — same
// .pr-page, same preview, same isolation — so a page printed from the Memar
// looks like a page printed from בראשית. Each unit only has to say what goes on
// the sheet; nothing here knows about paper.
function unitSheet(title, subtitleHtml){
  const page = el('div','pr-page');
  const hdr = el('div','pr-header');
  hdr.appendChild(el('div','pr-book', esc(title)));
  if(subtitleHtml) hdr.appendChild(el('div','pr-portion', subtitleHtml));
  page.appendChild(hdr);
  return page;
}
function unitBody(page, cls){
  const b = el('div','pr-main' + (cls ? ' ' + cls : ''));
  page.appendChild(b);
  return b;
}
// one labelled passage: the label is the unit's own reference (§ 12, a question
// number, a citation), set above the text rather than superscript to it, since
// these references are words and not verse numbers.
function unitRow(host, labelHtml, html, cls){
  const r = el('div','pr-vrow pr-unitrow' + (cls ? ' ' + cls : ''));
  if(labelHtml) r.appendChild(el('div','pr-unit-ref', labelHtml));
  r.insertAdjacentHTML('beforeend', html || '—');
  host.appendChild(r);
  return r;
}
// content lifted straight from a unit's own pane, for the two tool units whose
// output is a table of results rather than a text. Buttons there carry real
// content (a dictionary form, an occurrence count), so they become plain text
// instead of being dropped; the CSS flattens the screen's colours to ink.
function unitClone(page, node){
  const wrap = el('div','pr-clone');
  wrap.innerHTML = node.innerHTML;
  wrap.querySelectorAll('.hidden, input, select').forEach(e => e.remove());
  wrap.querySelectorAll('button').forEach(b => {
    const s = document.createElement('span');
    s.className = b.className;        // keep the class: it is what lays the list out
    s.textContent = b.textContent;
    b.replaceWith(s);
  });
  page.appendChild(wrap);
}
function unitPreview(page){
  const area = $('printArea');
  area.innerHTML = '';
  area.appendChild(page);
  fitPreviewSheet();
  document.body.classList.add('print-preview');
  $('printPreviewBar').classList.remove('hidden');
}

// the six books of the generic reader (Memar, Ṣadaqah, the responsa, Sīr
// al-Qulūb, Abu'l-Faraj, the Asatir): the open chapter in the open language —
// or, when the reader is standing on the contents page, the contents themselves.
async function rdPrint(){
  const cfg = RD.cfg; if(!cfg) return;
  const title = t(cfg.titleKey);
  if(RD.chapter == null){
    let toc; try{ toc = await cfg.toc(); }catch(e){ return toast(t('print_failed')); }
    const page = unitSheet(title, esc(t('print_toc')));
    const body = unitBody(page);
    toc.forEach(raw => {
      const b = cfg.tocItem(raw);
      unitRow(body, esc(b.letter), esc(b.title)
        + (b.count ? ('  ·  ' + b.count + ' ' + esc(t('tm_sections_n'))) : ''));
    });
    return unitPreview(page);
  }
  let ch; try{ ch = await cfg.chapter(RD.chapter); }catch(e){ return toast(t('print_failed')); }
  const lc = cfg.langs.find(l => l.key === RD.lang) || cfg.langs[0];
  const page = unitSheet(title, cfg.chapterTitle(ch));
  const body = unitBody(page);
  for(const s of ch.sections){
    const html = (lc.htmlKey && s[lc.htmlKey]) ? s[lc.htmlKey] : esc(s[lc.key] || '');
    const r = unitRow(body, cfg.unitLabel(s), html, lc.key === 'arabic' ? 'pr-ar' : '');
    if(lc.dir) r.dir = lc.dir;
  }
  unitPreview(page);
}

// a piyyut, as it is read: its heading line, the poem itself, and — only if the
// reader has the word dictionary open — the glosses beneath it.
function piyPrint(){
  const p = PIY.cur;
  if(!p) return toast(t('print_nothing'));
  const page = unitSheet(t('m_piyutim_book'), esc(p.title || ''));
  const meta = [p.author, p.festival, p.genre,
                (p.source || '') + (p.source_ref ? ' · ' + p.source_ref : '')]
               .filter(x => x && String(x).trim());
  const body = unitBody(page);
  if(meta.length) body.appendChild(el('div','pr-meta', esc(meta.join('  ·  '))));
  body.appendChild(el('div','pr-flow pr-lines', esc(p.text || '')));
  if(p.notes) body.appendChild(el('div','pr-meta', esc(p.notes)));
  if(p.translation_he){
    const sec = prSection(t('piy_translation_he'));
    sec.appendChild(el('div','pr-flow pr-lines', esc(p.translation_he)));
    page.appendChild(sec);
  }
  if(PIY.dictOn){
    const sec = prSection(t('piy_dict_toggle'));
    for(const line of (p.text || '').split('\n')){
      const ws = line.match(/[א-ת]+/g) || [];
      if(!ws.length) continue;
      const defs = ws.map(w => { const d = PIY.curDict && PIY.curDict[piyNorm(w)];
                                 return d ? ('<b>' + esc(w) + '</b> — ' + esc(d)) : null; })
                     .filter(Boolean);
      if(defs.length) unitRow(sec, esc(line), defs.join('  ·  '));
    }
    page.appendChild(sec);
  }
  unitPreview(page);
}

// a figure's entry — or, when none is open, the list of names as it currently
// stands (the reader's era/A-Z choice and search included).
function ppPrint(){
  const p = PP.cur;
  if(!p || !$('ppBody').classList.contains('pp-detail-open')){
    const page = unitSheet(t('pp_title'), esc(t(PP.mode === 'abc' ? 'pp_by_abc' : 'pp_by_era')));
    unitClone(page, $('ppList'));
    return unitPreview(page);
  }
  const page = unitSheet(t('pp_title'), esc(ppName(p)));
  const body = unitBody(page);
  const chips = [ppPeriod(p), p.name_he, p.name_en, p.name_ar,
                 p.pronunciation ? '/' + p.pronunciation + '/' : ''].filter(Boolean);
  body.appendChild(el('div','pr-meta', esc(chips.join('  ·  '))));
  const pick = (he, en, ar) => (LANG === 'en' ? en : LANG === 'ar' ? ar : he) || he || en || '';
  body.appendChild(el('div','pr-flow',
    esc(pick(p.description_he, p.description_en, p.description_ar))));
  const note = (pick(p.enriched_note_he, p.enriched_note_en, p.enriched_note_ar) || '').trim();
  if(note){
    const sec = prSection(t('pp_more'));
    sec.appendChild(el('div','pr-flow', esc(note)));
    page.appendChild(sec);
  }
  const refs = (p.references || []).filter(r => r && (r.url || r.title));
  if(refs.length){
    const sec = prSection(t('pp_refs'));
    refs.forEach(r => sec.appendChild(el('div','pr-vrow',
      esc(r.title || '') + (r.url ? ('  ·  ' + esc(r.url)) : ''))));
    page.appendChild(sec);
  }
  if(p.source) page.appendChild(el('div','pr-meta', esc(t('pp_source') + ': ' + p.source)));
  unitPreview(page);
}

// the rhyme finder and the dictionary app both answer with a table of results,
// so they print what they found, lifted from their own pane.
function rhyPrint(){
  const res = $('rhyResults');
  if(!res.querySelector('table')) return toast(t('print_nothing'));
  const page = unitSheet(t('rhyme_title'), esc($('rhySummary').textContent || ''));
  unitClone(page, res);
  unitPreview(page);
}

function dictPrint(){
  const body = $('dictAppBody');
  if(!body.textContent.trim()) return toast(t('print_nothing'));
  const page = unitSheet(t('m_dict_aram'), esc(($('dictAppInput').value || '').trim()));
  unitClone(page, body);
  unitPreview(page);
}

// One binding for all five, and each guarded: a printer button lives in another
// unit's header markup, and a single missing one must not take the whole script
// down with it — an unbound button is a button that does nothing, which is
// recoverable; a thrown TypeError here stops every line of app.js after it.
[['rdPrint', rdPrint], ['piyPrint', piyPrint], ['ppPrint', ppPrint],
 ['rhyPrint', rhyPrint], ['dictPrint', dictPrint]].forEach(([id, fn]) => {
  const b = $(id);
  if(b) b.onclick = fn; else console.warn('print button missing:', id);
});

function goBack(){
  // jumped here from a source app (Memar / Ṣadaqah) → one Back returns to that app,
  // even though the jumped-to verse is shown filtered/highlighted.
  if(S.appReturn && S.view==='verses'){ const a=S.appReturn; S.appReturn=null; S.verseFilter=null; reopenReader(a); return; }
  if(S.verseFilter!=null){ filterVerse(null); return; }
  if(S.searchReturn && S.view==='verses'){ S.searchReturn=false; showSearch(true); return; }
  // walk up: verses->chapter list->portions->books
  if(S.view==='verses'){
    S.chMode==='samaritan' ? showSamChapters(S.curPid,S.portionName) : showChapters(S.curPid,S.portionName);
  } else if(S.view==='chapters'||S.view==='sam_chapters'||S.view==='spread'){
    showPortions(S.book,S.bookName);
  } else if(S.view==='portions'){
    showBooks();
  }
}

// ── share ────────────────────────────────────────────────────────────────────
function openShare(){ $('shareModal').classList.remove('hidden'); }
$('shareBtn').onclick=openShare;
$('sShareBtn').onclick=openShare;
// export the current search results to an .xlsx (downloads, then opens in Excel)
$('sExcelBtn').onclick=()=>{
  if(!S.lastSearchParams || !(S.searchData && S.searchData.rows && S.searchData.rows.length)){
    toast(t('no_results_xls')); return;
  }
  const a=document.createElement('a');
  a.href='/api/search_export?'+S.lastSearchParams;
  document.body.appendChild(a); a.click(); a.remove();
};
document.querySelectorAll('#shareModal .share-opt').forEach(b=>b.onclick=()=>{
  const act=b.dataset.t; $('shareModal').classList.add('hidden');
  if(!act) return;
  const payload = shareText()+'\n'+location.href;   // on-screen text (mode-aware) + app link
  if(act==='whatsapp') open('https://wa.me/?text='+encodeURIComponent(payload),'_blank');
  else if(act==='email') open('mailto:?subject='+encodeURIComponent(t('app_title'))+'&body='+encodeURIComponent(payload),'_blank');
  else if(act==='copy') copyToClipboard(payload).then(ok=>toast(t(ok?'copied':'copy_fail')));
});
// the text currently shown in the verse area, following the active display mode
// (original / a translation / the verse commentary) and any single-verse filter.
function shareText(){
  // on the search screen, share the search RESULTS exactly as shown — every field:
  // Jewish path, Samaritan path, the verse, the word's transliteration + binyan/
  // form, and the meaning. Nothing is dropped.
  if(!$('searchScreen').classList.contains('hidden') && S.searchData && S.searchData.rows && S.searchData.rows.length){
    const d=S.searchData;
    const head = t('search')+': '+($('searchInput').value.trim());
    const body = d.rows.map(r=>{
      const lines=[];
      lines.push(`יהודית: ${r.book_name} › ${r.portion_name||''} › פרק ${r.chapter_num} פסוק ${r.number}`);
      if(r.sam){
        const op=r.sam.opening?`  (${r.sam.opening})`:'';
        lines.push(`שומרונית: ${r.book_name} › ${r.sam.sam_portion_name||''} › פרק שומרוני ${r.sam.sam_ch_num} פסוק ${r.sam.number}${op}`);
      }
      lines.push(((d.aramaic? r.sam_aramaic : r.text)||'').trim());
      if(r.occ && r.occ.length){
        const occs=r.occ.map(([pron,binyan,form])=>{
          const cp=cleanPron(pron); if(!cp) return '';
          const extra=[binyan,form].filter(Boolean).join(' ');
          return `‹ ${cp} ›`+(extra?` ${extra}`:'');
        }).filter(Boolean);
        if(occs.length) lines.push(occs.join('    '));
      }
      const mparts=[];
      if(r.aramaic) mparts.push('תרגום ארמי: '+r.aramaic);
      if(r.meaning) mparts.push('מילון: '+r.meaning);
      if(mparts.length) lines.push(mparts.join('  ·  '));
      return lines.join('\n');
    }).join('\n\n');
    return head+'\n\n'+body;
  }
  if(S.view==='verses' && Array.isArray(S.verses) && S.verses.length){
    const isSam=S.chMode==='samaritan';
    const head = `${S.bookName} ${isSam?'פרק שומרוני':'פרק'} ${S.curChNum}`;
    const col = S.english ? 'english'
      : S.panel==='aramaic'   ? 'sam_aramaic'
      : S.panel==='arabic'    ? 'arabic_trans'
      : S.panel==='interpret' ? 'interpretation'
      : 'text';
    const vs = S.verseFilter!=null ? S.verses.filter(v=>v.id===S.verseFilter) : S.verses;
    const body = vs.map(v=>{ const tx=(v[col]||'').trim(); return tx ? `${v.number} ${tx}` : ''; })
                   .filter(Boolean).join('\n');
    return head+'\n'+body;
  }
  return 'התורה השומרונית הישראלית';
}
async function copyToClipboard(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch(e){
    try{ const ta=document.createElement('textarea'); ta.value=txt;
      ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
      ta.focus(); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok;
    }catch(_){ return false; }
  }
}
let _toastT=null;
function toast(msg){
  let d=$('toast'); if(!d){ d=el('div'); d.id='toast'; d.className='toast'; document.body.appendChild(d); }
  d.textContent=msg; d.classList.add('show');
  clearTimeout(_toastT); _toastT=setTimeout(()=>d.classList.remove('show'), 1700);
}

// ── search screen ────────────────────────────────────────────────────────────
function showSearch(on){
  $('searchScreen').classList.toggle('hidden', !on);
  $('content').classList.toggle('hidden', on);
  $('crumbs').classList.toggle('hidden', on);
  $('toolbar').classList.toggle('hidden', on);
  $('navbar').classList.toggle('hidden', on);   // navbar (with back) hidden only while searching
  $('spreadBtn').classList.add('hidden');
  if(on){ $('searchInput').focus(); updateSearchZoomButtons($('searchResults').children.length>0); }
}
$('sBackBtn').onclick=()=>{ spinBack($('sBackBtn')); showSearch(false); restoreFromSearch(); };
$('sBrowseBtn').onclick=()=>{ showSearch(false); showBooks(); };
// re-render the view we came from, so its nav bar / chrome is restored (showSearch
// hides the nav bar; without a re-render the prev/next + font buttons stay gone).
function restoreFromSearch(){
  if(S.view==='verses')           renderVerses(S.curChId, S.curChNum, S.curPid, S.portionName);
  else if(S.view==='chapters')    showChapters(S.curPid, S.portionName);
  else if(S.view==='sam_chapters')showSamChapters(S.curPid, S.portionName);
  else if(S.view==='portions')    showPortions(S.book, S.bookName);
  else                            showBooks();
}
$('doSearchBtn').onclick=doSearch;
$('searchInput').addEventListener('keydown',e=>{ if(e.key==='Enter') doSearch(); });
// advanced-search: the flags live in a panel toggled by "חיפוש מתקדם"; "אישור"
// closes the panel and runs the search, so the results show without the flags.
$('advBtn').onclick=()=>$('advPanel').classList.toggle('hidden');
$('advApply').onclick=()=>{ $('advPanel').classList.add('hidden'); if($('searchInput').value.trim()) doSearch(); };
$('cbRoot').addEventListener('change',e=>{
  $('rootBoxRow').classList.toggle('hidden', !e.target.checked);
  if(e.target.checked && $('cbExact').checked) $('cbExact').checked=false;
  if(e.target.checked) fillRootBox();
});
$('cbExact').addEventListener('change',e=>{ if(e.target.checked) $('cbRoot').checked=false, $('rootBoxRow').classList.add('hidden'); });
$('searchInput').addEventListener('input',()=>{ if($('cbRoot').checked) fillRootBox(); });
const SFONT_MIN=-6, SFONT_MAX=18;
$('sMinusBtn').onclick=()=>{ S.searchFontOffset=Math.max(SFONT_MIN,S.searchFontOffset-2); doSearch(); };
$('sPlusBtn').onclick=()=>{ S.searchFontOffset=Math.min(SFONT_MAX,S.searchFontOffset+2); doSearch(); };
// dim the search magnifiers when there are no results to resize / at zoom limits
function updateSearchZoomButtons(hasResults){
  $('sMinusBtn').disabled = !hasResults || S.searchFontOffset<=SFONT_MIN;
  $('sPlusBtn').disabled  = !hasResults || S.searchFontOffset>=SFONT_MAX;
}

async function fillRootBox(){
  const q=$('searchInput').value.trim();
  if(q.split(/\s+/).length!==1){ $('rootBox').value=''; return; }
  const r=await api('root_box?word='+encodeURIComponent(q));
  $('rootBox').value = r.root||'';
}

const HEB_ONLY=/[^א-ת]/g;
const heb = s => (s||'').replace(HEB_ONLY,'');
const FINALS_MAP={'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
const foldFin = s => (s||'').replace(/[ךםןףץ]/g, c=>FINALS_MAP[c]);
function markQuery(text, q, exact, root, matchWords, aramaic, ignoreFinals){
  // fold word-final letters too when "ignore finals" is on, so the matched words
  // are highlighted just like the search matched them (הציף ↔ הציפ).
  const hf = s => { const h=heb(s); return ignoreFinals ? foldFin(h) : h; };
  let isMatch;
  const hasWild = q.includes('?')||q.includes('*')||q.includes('+');
  if(hasWild){            // ?/*/+ override the flags here too, matching the server
    const parts=q.split('+').map(t=>t.trim()).filter(Boolean);
    const lits=[]; const wilds=[];
    for(const t of parts){ if(t.includes('?')||t.includes('*')){ wilds.push([...t].filter(c=>(c>='א'&&c<='ת')||c==='?'||c==='*').join('')); }
                           else for(const w of t.split(/\s+/)){ const h=hf(w); if(h) lits.push(h); } }
    isMatch=w=>{ const h=hf(w); if(!h) return false;
      return wilds.some(p=>wildMatch(h,p)) || lits.some(t=>h.includes(t)); };
  } else if(root && matchWords){ const mw=new Set(matchWords.map(hf).filter(Boolean)); isMatch=w=>{const h=hf(w);return h&&mw.has(h);}; }
  else {
    const terms=q.split(/\s+/).map(hf).filter(Boolean);
    isMatch=w=>{ const h=hf(w); if(!h||!terms.length) return false;
      return exact? terms.includes(h) : terms.some(t=>h.includes(t)); };
  }
  return text.split(/\s+/).map(w=> isMatch(w)?`<span class="hl">${esc(w)}</span>`:esc(w)).join(' ');
}
function wildMatch(word,pat){
  if(pat.includes('*')){                       // glob: anchor where there is no '*'
    const left=!pat.startsWith('*'), right=!pat.endsWith('*');
    const core=pat.replace(/^\*+/,'').replace(/\*+$/,'');
    const body=[...core].map(c=>c==='?'?'[א-ת]':c==='*'?'[א-ת]*':c).join('');
    try{ return new RegExp((left?'^':'')+body+(right?'$':'')).test(word); }catch(e){ return false; }
  }
  if(pat && [...pat].every(c=>c==='?')) return word.length===pat.length;
  const body=[...pat].map(c=>c==='?'?'[א-ת]':c).join('');
  try{ return new RegExp(body).test(word); }catch(e){ return false; }
}

async function doSearch(){
  const q=$('searchInput').value.trim(); if(!q) return;
  trackNav('חיפוש');
  const exact=$('cbExact').checked, rootFlag=$('cbRoot').checked, aram=$('cbAram').checked;
  const ignoreFinals=$('cbIgnoreFinals').checked, showMeanings=$('cbShowMeanings').checked;
  const rootLetters=$('rootBox').value.trim();
  const params=new URLSearchParams({q, exact:exact?'1':'0', root:rootFlag?'1':'0',
    aramaic:aram?'1':'0', root_letters:rootLetters, ignore_finals:ignoreFinals?'1':'0'});
  // clear the previous results first, and show a prominent blinking "searching…"
  $('searchResults').innerHTML='';
  $('searchStatus').textContent=t('searching');
  $('searchStatus').classList.add('searching');
  S.lastSearchParams = params.toString();
  const data = await api('search?'+params.toString());
  S.searchData = data;                       // kept for share + Excel export
  const root = data.root;
  const res=$('searchResults'); res.innerHTML='';
  $('searchStatus').classList.remove('searching');
  const cTot = data.count, cShown = (data.shown!=null ? data.shown : cTot);
  const lbl = LANG==='en' ? ['Found','results'] : LANG==='ar' ? ['','نتيجة'] : ['נמצאו','תוצאות'];
  let cHtml = `${esc(lbl[0])} <b class="res-count">${cTot}</b> ${esc(lbl[1])}`.trim();
  if(cShown < cTot)
    cHtml += LANG==='en' ? ` <span class="res-shown">(showing first ${cShown})</span>`
           : LANG==='ar' ? ` <span class="res-shown">(تُعرض أول ${cShown})</span>`
           : ` <span class="res-shown">(מוצגות ${cShown} הראשונות)</span>`;
  if(aram) cHtml += ' · '+esc(t('flag_aram'));
  $('searchStatus').innerHTML = cHtml;
  updateSearchZoomButtons(cTot>0);
  let curSub=null;
  const heWords=new Set();          // Hebrew words to look up in the online dictionary
  for(const r of data.rows){
    if(root && r.subroot && r.subroot!==data.searched_root && r.subroot!==curSub){
      res.appendChild(el('div','res-subroot',esc(r.subroot))); curSub=r.subroot;
    }
    const jb=el('button','res-path jew');
    jb.innerHTML = `<b>יהודית</b> <span class="dir">←</span> ` +
      esc(`${r.book_name}  ›  ${r.portion_name}  ›  פרק ${r.chapter_num}  פסוק ${r.number}`);
    jb.onclick=()=>goToJewish(r); res.appendChild(jb);
    if(r.sam){
      const open = r.sam.opening ? `  (${r.sam.opening})` : '';
      const sb=el('button','res-path sam');
      sb.innerHTML = `<b>שומרונית</b> <span class="dir">←</span> ` +
        esc(`${r.book_name}  ›  ${r.sam.sam_portion_name}  ›  פרק שומרוני ${r.sam.sam_ch_num}  פסוק ${r.sam.number}${open}`);
      sb.onclick=()=>goToSam(r); res.appendChild(sb);
    }
    const dtext=(aram? r.sam_aramaic : r.text)||'';
    const vl=el('div','res-verse', markQuery(dtext,q,exact,root,r.match_words,aram,ignoreFinals));
    vl.style.fontSize=(19+S.searchFontOffset)+'px'; res.appendChild(vl);
    if(r.occ && r.occ.length){
      const spans=[];
      for(const [pron,binyan,form] of r.occ){
        const cp=cleanPron(pron); if(!cp) continue;
        let s=`‹ ${esc(cp)} ›`; const extra=[binyan,form].filter(Boolean).join(' ');
        if(extra) s+=` <span class="extra">${esc(extra)}</span>`;
        spans.push(s);
      }
      if(spans.length){ const ol=el('div','res-occ',spans.join('    '));
        ol.style.fontSize=(20+S.searchFontOffset)+'px'; res.appendChild(ol); }
    }
    // "show meanings" flag → open the word's FULL interpretation panel (the מילון
    // מילים format) on click, instead of an inline gloss.
    if(showMeanings){
      const heWord = (r.matched_word || q || '').trim();
      const mb=el('button','res-meaning-btn');
      mb.innerHTML = '📖 '+esc(t('dict_word_panel_btn'))+(heWord?(' — <b>'+esc(heWord)+'</b>'):'');
      mb.onclick=()=>openSearchWord(r);
      res.appendChild(mb);
    }
  }
  // fill every result's Hebrew-dictionary meaning in one bulk request
  if(heWords.size){
    api('online_dict?words='+encodeURIComponent([...heWords].join(','))).then(rmap=>{
      res.querySelectorAll('.he-mean').forEach(sp=>{
        const rr=rmap[sp.dataset.word];
        if(rr && rr.summary){
          const pre = sp.dataset.sep==='1' ? '&nbsp;&nbsp;·&nbsp;&nbsp;' : '';
          sp.innerHTML = pre + 'פירוש עברי: ' + esc(rr.summary.slice(0,180));
        }
      });
    }).catch(()=>{});
  }
}
// a search result's word → its full interpretation panel (the same sources view as
// the מילון מילים picker), pulling the verse's full entry where available.
async function openSearchWord(r){
  const word=(r.matched_word||'').trim();
  let entry=null;
  if(r.id){
    try{
      const map=await api('dict_select?verse_ids='+r.id);
      const es=map[String(r.id)]||map[r.id]||{};
      const wc=word.replace(/[^א-ת]/g,'');
      for(const k in es){ if(r.aramaic && es[k].aramaic===r.aramaic){ entry=es[k]; break; } }
      if(!entry) for(const k in es){ if((es[k].word||'').replace(/[^א-ת]/g,'')===wc){ entry=es[k]; break; } }
    }catch(e){}
  }
  if(!entry) entry={word:word||'', aramaic:r.aramaic||'', arabic:'', english:'',
                    he:r.meaning||'', he_combined:r.meaning||'', tal_he:''};
  showWordSources({entry, vid:r.id, word: word||entry.word||''});
}
function cleanPron(p){ return (p||'').replace(/\([^)]*[א-ת؀-ۿ][^)]*\)/g,'').replace(/[א-ת؀-ۿ]/g,'').replace(/\s+/g,' ').trim(); }

async function goToJewish(r){
  showSearch(false); S.searchReturn=true; S.division='standard';
  $('btnStandard').classList.add('active'); $('btnSamaritan').classList.remove('active');
  S.book=r.book_id; S.bookName=r.book_name;
  S.portions = await api(`portions?book_id=${r.book_id}&mode=standard`);
  S.verseFilter=r.id;
  await openChapter(r.chapter_id, r.chapter_num, r.portion_id, r.portion_name, true);
}
async function goToSam(r){
  showSearch(false); S.searchReturn=true; S.division='samaritan';
  $('btnSamaritan').classList.add('active'); $('btnStandard').classList.remove('active');
  S.book=r.book_id; S.bookName=r.book_name;
  S.portions = await api(`portions?book_id=${r.book_id}&mode=samaritan`);
  S.verseFilter=r.id;
  await openSamChapter(r.sam.sam_ch_id, r.sam.sam_ch_num, r.sam.sam_portion_id, r.sam.sam_portion_name, true);
}

// close modals on backdrop click
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.add('hidden'); }));

// ── side menu (hamburger) ────────────────────────────────────────────────────
const CALENDAR_URL  = 'https://sam-calendar.the-samaritans.net/';
const GENEALOGY_URL = 'https://samaritan-genealogy.oshersa.workers.dev/';
const CONTACT_EMAIL = 'OSHERSA@GMAIL.COM';

function openMenu(){ $('menuDrawer').classList.remove('hidden'); $('menuOverlay').classList.remove('hidden'); }
function closeMenu(){ $('menuDrawer').classList.add('hidden'); $('menuOverlay').classList.add('hidden'); }
$('menuBtn').onclick=openMenu;
$('menuOverlay').onclick=closeMenu;
document.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>{
  closeMenu(); menuAction(b.dataset.act);
});

// ── הספרייה השומרונית: full-page gallery (searchable) ─────────────────────────
// The cover IS the label: every book's title is written on its own front, so the
// cards need no caption underneath and fit far more per row. Each book gets its
// own colour, derived from its fixed position in LIB_ITEMS — so a given book
// always wears the same binding, and books added later simply take the next hue
// (past the palette's length the hues shift, never repeat outright).
const LIB_HUES = [352, 210, 96, 32, 275, 186, 18, 228, 320, 152, 45, 258];
function libCoverVars(i){
  const h = (LIB_HUES[i % LIB_HUES.length] + Math.floor(i / LIB_HUES.length) * 17) % 360;
  return { '--bk':`hsl(${h} 33% 39%)`, '--bk-dark':`hsl(${h} 40% 23%)`,
           '--bk-lite':`hsl(${h} 29% 50%)` };
}
const LIB_ITEMS = [
  {act:'dict_app',     titleKey:'m_dict_aram',    open:()=>openDictApp()},
  {act:'tm_book',      titleKey:'m_tm_book',      open:()=>openTmBook()},
  {act:'tz_book',      titleKey:'m_tz_book',      open:()=>openTzBook()},
  {act:'shyt_book',    titleKey:'m_shyt_book',    open:()=>openShytBook()},
  {act:'sir_book',     titleKey:'m_sir_book',     open:()=>openSirBook()},
  {act:'bhuq_book',    titleKey:'m_bhuq_book',    open:()=>openBhuqBook()},
  {act:'asatir_book',  titleKey:'m_asatir_book',  open:()=>openAsatirBook()},
  {act:'piyutim_book', titleKey:'m_piyutim_book', open:()=>openPiyutimBook()},
  {act:'rhyme_book',   titleKey:'m_rhyme_book',   open:()=>openRhymeBook()},
  {act:'people_book',  titleKey:'m_people_book',  open:()=>openPeopleBook()},
  {act:'composer',     titleKey:'m_composer',     open:()=>openComposer(), adminOnly:true},
  {act:'privatecomp',  titleKey:'m_privatecomp',  open:()=>openPrivateComp(), adminOnly:true},
];
// ── ציר הזמן ההיסטורי השומרוני ───────────────────────────────────────────────
// A page of its own (/timeline) with its own code and its own generated data,
// shown in a frame that fills the app rather than replacing it: the reader keeps
// the app around the timeline and returns with one tap, as from the library. The
// frame is loaded once and kept, so coming back lands where it was left — unless
// the app's language changed meanwhile, which the timeline reads from ?lang.
let _tlLang = null;
function openTimeline(){
  const f = $('tlFrame');
  // the trailing slash matters: the timeline's own css/ and js/ are relative
  if(_tlLang !== LANG){ _tlLang = LANG; f.src = '/timeline/?lang=' + encodeURIComponent(LANG); }
  $('timelineModal').classList.remove('hidden');
  trackNav(t('m_timeline'));
}
// The timeline also stands on its own outside the app, so it carries a link back
// to the-samaritans.net and a home link on its title. In the frame those two
// would navigate away from the app with no way back, so they are neutralised
// from here — not in the timeline's own source, which must keep working when the
// page is opened directly.
$('tlFrame').addEventListener('load', () => {
  try{
    const d = $('tlFrame').contentDocument;
    if(!d || !d.head) return;
    const s = d.createElement('style');
    s.textContent = '#backSite{display:none!important}#brandHome{pointer-events:none;cursor:default}';
    d.head.appendChild(s);
  }catch(e){ /* a cross-origin frame would throw here; this one never is */ }
});
$('tlToTorah').onclick = () => $('timelineModal').classList.add('hidden');

function openLibrary(){
  $('libraryModal').classList.remove('hidden');
  $('libGallerySearch').value='';
  libBuildGrid();
  trackNav(t('m_library'));
}
function libBuildGrid(){
  const q=($('libGallerySearch').value||'').trim().toLowerCase();
  const grid=$('libGrid'); grid.innerHTML='';
  let shown=0;
  LIB_ITEMS.forEach((item, i)=>{
    if(item.adminOnly && !ADMIN.token) return;   // "מחולל טיוטות פיוט" — שלב ראשון: מנהל בלבד
    const label=t(item.titleKey);
    if(q && !label.toLowerCase().includes(q)) return;
    shown++;
    const card=el('button','lib-card', `<span class="lib-book"><span class="lib-book-title">${esc(label)}</span></span>`);
    card.title=label;                       // the cover clips very long titles — the tooltip doesn't
    // colour by the item's fixed index, not by its place in the filtered grid,
    // so a book keeps its binding while the reader searches
    const vars=libCoverVars(i);
    for(const k in vars) card.style.setProperty(k, vars[k]);
    card.onclick=()=>{ $('libraryModal').classList.add('hidden'); item.open(); };
    grid.appendChild(card);
  });
  $('libGalleryNoResult').classList.toggle('hidden', shown>0);
}
$('libGallerySearch').addEventListener('input', libBuildGrid);
$('libGallerySearch').addEventListener('keydown', e=>{ if(e.key==='Enter'){
  const first=$('libGrid').querySelector('.lib-card'); if(first) first.click(); } });
$('libToTorah').onclick=()=>$('libraryModal').classList.add('hidden');
$('rdToLib').onclick=()=>{ $('bookModal').classList.add('hidden'); openLibrary(); };
$('piyToLib').onclick=()=>{ $('piyModal').classList.add('hidden'); openLibrary(); };
$('rhyToLib').onclick=()=>{ $('rhymeModal').classList.add('hidden'); openLibrary(); };
$('dictToLib').onclick=()=>{ $('dictModal').classList.add('hidden'); openLibrary(); };

function menuAction(a){
  if(a==='calendar')       open(CALENDAR_URL, '_blank', 'noopener');
  else if(a==='genealogy') open(GENEALOGY_URL, '_blank', 'noopener');
  else if(a==='timeline')  openTimeline();
  else if(a==='library')   openLibrary();
  else if(a==='dict_app')  openDictApp();
  else if(a==='tm_book')   openTmBook();
  else if(a==='tz_book')   openTzBook();
  else if(a==='shyt_book') openShytBook();
  else if(a==='sir_book')  openSirBook();
  else if(a==='bhuq_book') openBhuqBook();
  else if(a==='asatir_book') openAsatirBook();
  else if(a==='piyutim_book') openPiyutimBook();
  else if(a==='rhyme_book')   openRhymeBook();
  else if(a==='people_book')  openPeopleBook();
  else if(a==='install')   doInstall();
  else if(a==='bookmarks') openBookmarks();
  else if(a==='adminlogin') openAdminLogin();
  else if(a==='lang')      $('langModal').classList.remove('hidden');
  else if(a==='whatsnew')  showWhatsNewCarousel();
  else if(a==='help')      showHelp();
  else if(a==='tour')      startTour();
  else if(a==='version')   showVersionLog();
  else if(a==='contact')   openContact();
}

// ── Samaritan Aramaic–Hebrew dictionary (A. Tal) — standalone in-app dictionary ──
let DICT_MODE='search';
function openDictApp(){
  $('dictModal').classList.remove('hidden');
  trackNav('מילון מילים');
  dictApplyFs();
  DICT_DIR='aram';
  document.querySelectorAll('.dict-dir-btn').forEach(b=>b.classList.toggle('active', b.dataset.dir==='aram'));
  const pagesTab=document.querySelector('.dict-tab[data-mode="pages"]'); if(pagesTab) pagesTab.classList.remove('hidden');
  dictSetMode('search');
  setTimeout(()=>$('dictAppInput').focus(), 50);
}
// text zoom for the dictionary app
let DICT_FS = parseFloat(localStorage.getItem('as_dict_fs')||'1')||1;
function dictApplyFs(){ $('dictAppBody').style.setProperty('--dict-fs', DICT_FS); }
function dictZoom(d){ DICT_FS=Math.min(2.2, Math.max(0.8, +(DICT_FS+d).toFixed(2)));
  localStorage.setItem('as_dict_fs', DICT_FS); dictApplyFs(); }
$('dZoomIn').onclick=()=>dictZoom(0.12);
$('dZoomOut').onclick=()=>dictZoom(-0.12);
let DICT_DIR='aram';                           // 'aram' (ארמית→עברית) | 'he' (עברית→ארמית)
let DICT_RETURN=null;   // {dir, word} set right before drilling into a word/root detail FROM a
                        // search result, so its back button returns to that search (not the index)
function dictSetDir(dir){
  DICT_DIR=dir;
  document.querySelectorAll('.dict-dir-btn').forEach(b=>b.classList.toggle('active', b.dataset.dir===dir));
  const pagesTab=document.querySelector('.dict-tab[data-mode="pages"]');   // pages = Aramaic dictionary only
  if(pagesTab) pagesTab.classList.toggle('hidden', dir==='he');
  dictSetMode(dir==='he' && DICT_MODE==='pages' ? 'search' : DICT_MODE);
}
document.querySelectorAll('.dict-dir-btn').forEach(b=>b.onclick=()=>dictSetDir(b.dataset.dir));

function dictSetMode(mode){
  DICT_MODE=mode;
  document.querySelectorAll('.dict-tab').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
  $('dictAppBody').innerHTML=''; $('dictNav').innerHTML=''; $('dictNav').classList.add('hidden');
  $('dictSearchRow').classList.toggle('hidden', mode==='pages');
  const inp=$('dictAppInput'); inp.value='';
  const he = DICT_DIR==='he';
  if(mode==='search'){ $('dictAppHint').textContent=t(he?'dict_he_search_hint':'dict_app_hint'); inp.placeholder=t(he?'dict_he_ph':'dict_app_ph'); }
  else if(mode==='index'){ $('dictAppHint').textContent=t(he?'dict_he_index_hint':'dict_index_hint'); inp.placeholder=t(he?'dict_he_ph':'dict_index_ph'); (he?dictHeBrowse:dictWords)(0); }
  else if(mode==='phrases'){ $('dictAppHint').textContent=t('dict_phrases_hint'); inp.placeholder=t('dict_app_ph'); dictPhrases(''); }
  else if(mode==='pages'){ $('dictAppHint').textContent=t('dict_pages_hint'); dictPage(1); }
}
// Browse the set phrases (dict_phrase): epithets and idioms only — free word
// pairs were never stored. Each row shows the Hebrew that Memar Marqe's own
// translation gives the phrase, or, where no rendering recurred often enough to
// trust, the word-by-word meaning instead.
async function dictPhrases(q){
  const body=$('dictAppBody'); body.innerHTML='';
  body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_phrases?q='+encodeURIComponent(q||'')); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  const items=(d&&d.items)||[];
  if(!items.length){ body.appendChild(el('div','note',t('dict_app_empty'))); return; }
  for(const p of items){
    const row=el('button','tm-result');
    row.appendChild(el('span','tm-res-ref', esc(p.phrase)+'  ·  '+esc(p.cls==='formula'?t('phr_formula'):t('phr_idiom'))));
    row.appendChild(el('span','tm-res-snip', esc(p.hebrew || p.parts || '')));
    row.appendChild(el('span','tal-pg', esc(p.ref)+'  ·  '+p.count+' '+t('phr_occurrences')));
    row.onclick=()=>{ DICT_RETURN=null; dictWordDetail(p.phrase); };
    body.appendChild(row);
  }
}
document.querySelectorAll('.dict-tab').forEach(b=>b.onclick=()=>dictSetMode(b.dataset.mode));

// the search box doubles as the index "jump to letter/word" box; in the Hebrew
// direction, search runs a results search (not an index jump) per the spec.
function dictGo(){
  const q=($('dictAppInput').value||'').trim();
  if(DICT_DIR==='he'){ if(DICT_MODE==='index') dictHeBrowse(0, q); else dictHeSearch(q); return; }
  if(DICT_MODE==='phrases'){ dictPhrases(q); return; }
  if(DICT_MODE==='index') dictWords(0, q); else dictAppSearch();
}

// ── Hebrew → Aramaic: browse the Hebrew index, or search a Hebrew word → its roots ──
async function dictHeBrowse(start, prefix){
  const body=$('dictAppBody'); body.innerHTML=''; body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_he?start='+(start||0)+(prefix?('&prefix='+encodeURIComponent(prefix)):'')); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  const grid=el('div','dict-wgrid');
  for(const it of d.items){
    const cell=el('button','dict-wcell');
    cell.appendChild(el('span','dict-wword', esc(it.word)));
    if(it.roots>1){ const b=el('span','dict-wb mng', it.roots+'·'); b.title=t('dict_he_roots'); cell.appendChild(b); }
    cell.onclick=()=>{ dictSetMode('search'); $('dictAppInput').value=it.word; dictHeSearch(it.word); };
    grid.appendChild(cell);
  }
  body.appendChild(grid); body.scrollTop=0;
  dictNav([
    {label:t('dict_prev'), disabled:d.start<=0, fn:()=>dictHeBrowse(Math.max(0,d.start-d.limit))},
    {text:(d.start+1)+'–'+Math.min(d.total,d.start+d.items.length)+' / '+d.total},
    {label:t('dict_next'), disabled:d.start+d.limit>=d.total, fn:()=>dictHeBrowse(d.start+d.limit)},
  ]);
}
async function dictHeSearch(word){
  const body=$('dictAppBody'); body.innerHTML='';
  if(!word) return;
  body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_he_search?word='+encodeURIComponent(word)); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note',t('dict_app_empty'))); return; }
  body.innerHTML='';
  if(!d.results || !d.results.length){ body.appendChild(el('div','note',t('dict_app_empty'))); return; }
  for(const r of d.results){
    const card=el('div','dict-he-res');
    card.appendChild(el('div','dict-he-word', esc(r.word)));
    card.appendChild(el('div','dict-he-rlabel', esc(t('dict_he_roots'))+':'));
    const rl=el('div','dict-he-roots');
    for(const root of (r.roots||[])){
      const chip=el('button','dict-he-root', esc(root));
      chip.onclick=()=>{ DICT_RETURN={dir:'he', word}; dictWordDetail(root, root); };    // → the Aramaic interpretation (root entry)
      rl.appendChild(chip);
    }
    card.appendChild(rl);
    body.appendChild(card);
  }
}

// ── tap a form → all its locations in the dictionary (inline expand) ─────────
async function dictToggleLocations(form, chip){
  const sib=chip.nextElementSibling;
  if(sib && sib.classList.contains('dict-loclist')){ sib.remove(); chip.classList.remove('open'); return; }
  chip.classList.add('open');
  const box=el('div','dict-loclist'); box.appendChild(el('div','note',t('searching'))); chip.after(box);
  let d; try{ d=await api('dict_locations?word='+encodeURIComponent(form)); }catch(e){ box.innerHTML=''; box.appendChild(el('div','note','—')); return; }
  box.innerHTML='';
  box.appendChild(el('div','dict-loc-head', esc(t('dict_locations_title'))+' · '+esc(form)+' ('+(d.count||0)+' '+esc(t('dict_loc_count'))+')'));
  if(!d.locations || !d.locations.length){ box.appendChild(el('div','note','—')); return; }
  for(const loc of d.locations){
    const row=el('div','dict-loc-row');
    row.appendChild(el('span','dict-loc-ref', esc(loc.ref)));
    if(loc.quote) row.appendChild(el('span','dict-loc-q', esc(loc.quote)));
    box.appendChild(row);
  }
}
function dictFormChip(form){
  const chip=el('span','dict-form', esc(form)+' <span class="dict-form-i">📍</span>');
  chip.title=t('dict_form_hint');
  chip.onclick=()=>dictToggleLocations(form, chip);
  return chip;
}
function dictRootCard(rt, searchWord){
  const card=el('div','dict-entry');
  card.appendChild(el('div','tal-head','שורש '+esc(rt.root)));
  if(rt.senses && rt.senses.length){
    card.appendChild(el('div','tal-sec',t('tal_meaning')));
    for(const s of rt.senses){
      const it=el('div','tal-sense');
      if(s.lemma){ it.appendChild(dictFormChip(s.lemma)); it.appendChild(document.createTextNode(' ')); }
      if(s.pos) it.appendChild(el('span','pos', esc(s.pos)+' '));
      it.appendChild(document.createTextNode(s.gloss||''));
      if(s.page) it.appendChild(el('span','tal-pg','  ('+t('tal_page')+' '+esc(String(s.page))+')'));
      card.appendChild(it);
    }
  }
  if(rt.torah && rt.torah.length){
    card.appendChild(el('div','tal-sec',t('tal_torah')+' ('+rt.torah_count+')'));
    const wrap=el('div','tal-locs');
    for(const loc of rt.torah) wrap.appendChild(el('span','tal-loc', esc(loc.book+' '+loc.ch+':'+loc.vn)));
    if(rt.torah_count>rt.torah.length) wrap.appendChild(el('span','tal-more','…'));
    card.appendChild(wrap);
  }
  if(rt.forms && rt.forms.length){
    card.appendChild(el('div','tal-sec',t('tal_forms')));
    card.appendChild(el('div','dict-form-hint', esc(t('dict_form_hint'))));
    const fl=el('div','tal-formlist clickable-forms');
    for(const f of rt.forms) fl.appendChild(dictFormChip(f));
    card.appendChild(fl);
  }
  const occBtn=el('button','dict-occ-btn', esc(t('dict_show_occ')));   // → full occurrences view
  occBtn.onclick=()=>{ DICT_RETURN={dir:'aram', word:searchWord}; dictWordDetail(rt.root, rt.root); };
  card.appendChild(occBtn);
  return card;
}
async function dictAppSearch(){
  const word=($('dictAppInput').value||'').trim();
  const body=$('dictAppBody'); body.innerHTML='';
  if(!word) return;
  body.appendChild(el('div','note',t('searching')));
  let d, direct;
  try{ [d, direct]=await Promise.all([
      api('tal_lookup?word='+encodeURIComponent(word)),
      api('dict_word?word='+encodeURIComponent(word)) ]); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note',t('dict_app_empty'))); return; }
  body.innerHTML='';
  const roots=(d&&d.roots)||[];
  // direct head-word matches (the word itself stands in the dictionary), regardless of root
  if(direct && direct.length){
    const have=new Set(roots.map(r=>r.root));
    const fresh=direct.filter(e=>!e.root || !have.has(e.root));
    if(fresh.length){
      body.appendChild(el('div','tal-sec dict-direct-sec', esc(t('dict_in_dict'))));
      for(const e of fresh){
        const it=el('div','dict-direct');
        if(e.lemma){ it.appendChild(dictFormChip(e.lemma)); it.appendChild(document.createTextNode(' ')); }
        if(e.pos) it.appendChild(el('span','pos', esc(e.pos)+' '));
        if(e.root) it.appendChild(el('span','dict-direct-root', '('+t('tm_col_root')+' '+esc(e.root)+') '));
        it.appendChild(document.createTextNode(e.gloss||''));
        if(e.page) it.appendChild(el('span','tal-pg','  ('+t('tal_page')+' '+esc(String(e.page))+')'));
        body.appendChild(it);
      }
    }
  }
  if(!roots.length && !(direct&&direct.length)){ body.appendChild(el('div','note',t('dict_app_empty'))); return; }
  for(const rt of roots) body.appendChild(dictRootCard(rt, word));
}
// ── comprehensive word-index browsing ────────────────────────────────────────
let DICT_WB={start:0, limit:60, total:0, prefix:''};
async function dictWords(start, prefix){
  const body=$('dictAppBody'); body.innerHTML=''; body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_words?start='+(start||0)+(prefix?('&prefix='+encodeURIComponent(prefix)):'')); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML=''; DICT_WB={start:d.start, limit:d.limit, total:d.total, prefix:prefix||''};
  const grid=el('div','dict-wgrid');
  for(const it of d.items){
    const cell=el('button','dict-wcell');
    cell.appendChild(el('span','dict-wword', esc(it.word)));
    const bd=el('span','dict-wbadges');
    if(it.in_torah){ const b=el('span','dict-wb tor','ת'); b.title=t('dict_w_torah'); bd.appendChild(b); }
    if(it.in_memar){ const b=el('span','dict-wb mem','מ'); b.title=t('dict_w_memar'); bd.appendChild(b); }
    if(it.meanings>1){ const b=el('span','dict-wb mng', it.meanings+'·'); b.title=t('dict_w_meanings'); bd.appendChild(b); }
    cell.appendChild(bd);
    cell.onclick=()=>dictWordDetail(it.word);
    grid.appendChild(cell);
  }
  body.appendChild(grid); body.scrollTop=0;
  dictNav([
    {label:t('dict_prev'), disabled:d.start<=0, fn:()=>dictWords(Math.max(0,d.start-d.limit))},
    {text:(d.start+1)+'–'+Math.min(d.total,d.start+d.items.length)+' / '+d.total},
    {label:t('dict_next'), disabled:d.start+d.limit>=d.total, fn:()=>dictWords(d.start+d.limit)},
  ]);
}

// bold the matched surface forms inside a sentence (compare by Hebrew-letter core,
// so trailing punctuation on a token doesn't defeat the match)
function dictHlSpan(text, hi, cls){
  const span=el('span', cls); const set=new Set(hi||[]);
  for(const part of String(text||'').split(/(\s+)/)){
    const core=part.replace(/[^א-ת]/g,'');
    if(core && set.has(core)) span.appendChild(el('b','dict-hl', esc(part)));
    else span.appendChild(document.createTextNode(part));
  }
  return span;
}

// a clicked word → its meaning(s), each with the Torah verses and the Tibåt Mårqe
// passages that share that meaning (= the same root)
async function dictWordDetail(word, root){
  const body=$('dictAppBody'); body.innerHTML=''; body.appendChild(el('div','note',t('searching')));
  $('dictNav').classList.add('hidden');
  let d; try{ d=await api('dict_word_detail?word='+encodeURIComponent(word)+(root?('&root='+encodeURIComponent(root)):'')); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  const ret=DICT_RETURN; DICT_RETURN=null;   // consume once; a fresh drill-in sets it again
  const back=el('button','dict-back', esc(ret ? t('dict_back_search') : t('dict_back_index')));
  back.onclick=()=>{
    if(ret){
      dictSetDir(ret.dir); dictSetMode('search'); $('dictAppInput').value=ret.word;
      if(ret.dir==='he') dictHeSearch(ret.word); else dictAppSearch();
    } else { dictSetMode('index'); dictWords(DICT_WB.start||0, DICT_WB.prefix||''); }
  };
  body.appendChild(back);
  body.appendChild(el('div','dict-detail-word', esc(d.word)));
  // A set phrase is its own entry — its meaning is the phrase's, not a root's, so
  // it gets the phrase card instead of the root-by-root breakdown below.
  if(d.is_phrase){
    for(const s of (d.senses||[])){
      const card=el('div','dict-mcard');
      card.appendChild(el('div','dict-mroot', esc(s.cls==='formula'?t('phr_formula'):t('phr_idiom'))));
      if(s.hebrew) card.appendChild(el('div','tal-sense','← '+esc(s.hebrew)));
      if(s.parts) card.appendChild(el('div','note', esc(s.parts)));
      card.appendChild(el('div','note', esc(s.ref)+' · '+s.count+' '+t('phr_occurrences')));
      body.appendChild(card);
    }
    if(d.words && d.words.length){
      body.appendChild(el('div','tal-sec',t('phr_words')));
      const wrap=el('div','tal-formlist');
      d.words.forEach((w,i)=>{
        const a=el('span','dict-form', esc(w));
        a.onclick=()=>dictWordDetail(w);
        wrap.appendChild(a); if(i<d.words.length-1) wrap.appendChild(document.createTextNode('  ·  '));
      });
      body.appendChild(wrap);
    }
    body.scrollTop=0; return;
  }
  if(!d.meanings || !d.meanings.length){ body.appendChild(el('div','note',t('dict_app_empty'))); body.scrollTop=0; return; }
  for(const m of d.meanings){
    const card=el('div','dict-mcard');
    card.appendChild(el('div','dict-mroot', esc(t('tm_col_root')+' '+m.root)));
    if(m.sense_label) card.appendChild(el('div','dict-sense-banner', '◆ '+esc(m.sense_label)));
    const meaningTag=m.sense_label ? ('「'+m.sense_label+'」') : t('dict_same_meaning');
    if(m.senses && m.senses.length){
      const sl=el('div','dict-senses');
      for(const s of m.senses){
        const it=el('div','dict-sense');
        if(s.pos) it.appendChild(el('span','pos', esc(s.pos)+' '));
        it.appendChild(document.createTextNode(s.gloss||''));
        if(s.page) it.appendChild(el('span','tal-pg',' ('+t('tal_page')+' '+esc(String(s.page))+')'));
        sl.appendChild(it);
      }
      card.appendChild(sl);
    }
    // Torah occurrences (same meaning)
    card.appendChild(el('div','dict-occ-h',
      esc(t('dict_in_torah_sec'))+' ('+m.torah_count+') · '+esc(meaningTag)));
    if(m.torah && m.torah.length){
      const wrap=el('div','dict-occ-list');
      for(const o of m.torah){
        const row=el('div','dict-occ');
        row.appendChild(el('span','dict-occ-ref', esc(o.book+' '+o.ch+':'+o.vn)));
        row.appendChild(dictHlSpan(o.text, o.hi, 'dict-occ-txt'));
        wrap.appendChild(row);
      }
      card.appendChild(wrap);
      if(m.torah_count>m.torah.length)
        card.appendChild(el('div','note dict-more','…'+(m.torah_count-m.torah.length)+' '+t('dict_more')));
    } else card.appendChild(el('div','note dict-noocc', t('dict_no_occ')));
    // Tibåt Mårqe occurrences (same meaning)
    card.appendChild(el('div','dict-occ-h',
      esc(t('dict_in_memar_sec'))+' ('+m.memar_count+') · '+esc(meaningTag)));
    if(m.memar && m.memar.length){
      const wrap=el('div','dict-occ-list');
      for(const o of m.memar){
        const row=el('div','dict-occ mem');
        const ref=(o.title||'')+(o.section?(' '+o.section):'');
        if(ref.trim()) row.appendChild(el('span','dict-occ-ref', esc(ref)));
        row.appendChild(dictHlSpan(o.aramaic, o.hi, 'dict-occ-txt aram'));
        if(o.hebrew) row.appendChild(el('div','dict-occ-heb', esc(o.hebrew)));
        wrap.appendChild(row);
      }
      card.appendChild(wrap);
      if(m.memar_count>m.memar.length)
        card.appendChild(el('div','note dict-more','…'+(m.memar_count-m.memar.length)+' '+t('dict_more')));
    } else card.appendChild(el('div','note dict-noocc', t('dict_no_occ')));
    body.appendChild(card);
  }
  body.scrollTop=0;
}
// ── page browsing ───────────────────────────────────────────────────────────
async function dictPage(p){
  const body=$('dictAppBody'); body.innerHTML=''; body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_page?page='+(p||1)); }catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  for(const e of d.entries){
    const it=el('div','dict-pageentry');
    let h='<b>'+esc(e.lemma)+'</b> ';
    if(e.pos) h+='<span class="pos">'+esc(e.pos)+'</span> ';
    it.innerHTML=h+esc(e.gloss||'');
    body.appendChild(it);
  }
  if(!d.entries.length) body.appendChild(el('div','note','—'));
  body.scrollTop=0;
  const head=(d.head&&/^[א-תְ-ֽ\s\-–]{3,}$/.test(d.head.trim()))?d.head.trim():'';  // skip OCR-garbled heads
  dictNav([
    {label:t('dict_prev'), disabled:d.prev==null, fn:()=>dictPage(d.prev)},
    {text:t('dict_page_label')+' '+d.page+(head?(' · '+head):'')},
    {label:t('dict_next'), disabled:d.next==null, fn:()=>dictPage(d.next)},
  ]);
}
function dictNav(items){
  const nav=$('dictNav'); nav.innerHTML=''; nav.classList.remove('hidden');
  for(const it of items){
    if(it.text){ nav.appendChild(el('span','dict-nav-lbl', esc(it.text))); continue; }
    const b=el('button','dict-nav-btn', esc(it.label)); b.disabled=!!it.disabled;
    if(it.fn) b.onclick=it.fn; nav.appendChild(b);
  }
}
$('dictAppBtn').onclick=dictGo;
$('dictAppClose').onclick=()=>$('dictModal').classList.add('hidden');
$('dictToTorah').onclick=()=>$('dictModal').classList.add('hidden');   // ↩ return to the Torah app
$('dictAppInput').addEventListener('keydown',e=>{ if(e.key==='Enter') dictGo(); });

// ── generic full-book reader (Samaritan Library) ─────────────────────────────
// Drives both Tibåt Mårqe (Aramaic⇄Hebrew) and Ṣadaqah al-Ḥakīm (Hebrew⇄Arabic):
// a full-screen window with a table of contents, per-chapter reading, a header
// language toggle, in-book search, and verse-citation jumps into the Torah app.
const BOOK_CFG = {
  tm: {
    titleKey:'tm_title', tocHintKey:'tm_toc_hint',
    toc:()=>api('tm_toc'),
    chapter:(id)=>api('tm_chapter?book='+encodeURIComponent(id)),
    search:(q)=>api('tm_search?q='+encodeURIComponent(q)),
    words:(id)=>api('tm_words?book='+encodeURIComponent(id)),
    tocItem:(b)=>({id:b.book, letter:b.letter, title:b.title, count:b.count}),
    chapterTitle:(ch)=>esc(ch.letter)+'. '+esc(ch.title),
    unitLabel:(s)=>'§ '+esc(s.section),
    unitVid:()=>null,
    unitDom:(s)=>'rdsec-'+s.section,
    searchRef:(r)=>esc(r.letter)+' §'+esc(r.section),
    searchTo:(r)=>({chap:r.book, dom:'rdsec-'+r.section}),
    langs:[{key:'aramaic', labelKey:'rd_aram'},
           {key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'}],
  },
  tz: {
    titleKey:'tz_title', tocHintKey:'tz_toc_hint',
    toc:()=>api('tz_toc'),
    chapter:(id)=>api('tz_chapter?chap='+encodeURIComponent(id)),
    search:(q)=>api('tz_search?q='+encodeURIComponent(q)),
    words:null,
    tocItem:(c)=>({id:c.chap, letter:c.heb, title:t('tz_chapter_label')+' '+c.heb, count:c.count}),
    chapterTitle:(ch)=>t('tz_chapter_label')+' '+esc(ch.heb),
    unitLabel:(s)=>esc(s.ref)+(s.title?(' · '+esc(s.title)):''),
    unitVid:(s)=>s.verse_id,
    unitDom:(s)=>'rdsec-'+s.id,
    searchRef:(r)=>t('tz_chapter_label')+' '+esc(r.heb)+' · '+esc(r.ref),
    searchTo:(r)=>({chap:r.chap, dom:'rdsec-'+r.id}),
    langs:[{key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'},
           {key:'arabic', labelKey:'rd_ar', dir:'rtl'}],
  },
  shyt: {                              // responsa of Jacob ben Aaron — flat book of questions
    titleKey:'shyt_title', tocHintKey:'shyt_toc_hint',
    toc:()=>api('shyt_toc'),
    chapter:(id)=>api('shyt_chapter?q='+encodeURIComponent(id)),
    search:(q)=>api('shyt_search?q='+encodeURIComponent(q)),
    words:null,
    tocItem:(c)=>({id:c.id, letter:String(c.qnum), title:c.title, count:0}),   // each item is one question
    chapterTitle:(ch)=>esc(ch.title||('שאלה '+ch.qnum)),
    unitLabel:(s)=>esc(s.ref||''),
    unitVid:(s)=>s.verse_id,
    unitDom:(s)=>'rdsec-'+s.id,
    searchRef:(r)=>esc(r.title||('שאלה '+r.qnum)),
    searchTo:(r)=>({chap:r.id, dom:'rdsec-'+r.id}),
    langs:[{key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'}],
  },
  sir: {                               // Sīr al-Qulūb ("סוד הלבבות") — flat book of sections
    titleKey:'sir_title', tocHintKey:'sir_toc_hint',
    toc:()=>api('sir_toc'),
    chapter:(id)=>api('sir_chapter?sec='+encodeURIComponent(id)),
    search:(q)=>api('sir_search?q='+encodeURIComponent(q)),
    words:null,
    tocItem:(c)=>({id:c.id, letter:String(c.ord!=null?c.ord+1:c.id), title:c.title, count:0}),
    chapterTitle:(ch)=>esc(ch.title||''),
    unitLabel:(s)=>esc(s.ref||''),
    unitVid:(s)=>s.verse_id,
    unitDom:(s)=>'rdsec-'+s.id,
    searchRef:(r)=>esc(r.title||''),
    searchTo:(r)=>({chap:r.id, dom:'rdsec-'+r.id}),
    langs:[{key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'}],
  },
  bhuq: {                              // פירוש אם בחקותי — one treatise, grouped into parts
    titleKey:'bhuq_title', tocHintKey:'bhuq_toc_hint',
    toc:()=>api('bhuq_toc'),
    chapter:(id)=>api('bhuq_chapter?part='+encodeURIComponent(id)),
    search:(q)=>api('bhuq_search?q='+encodeURIComponent(q)),
    words:null,
    // the badge is the part number; the paragraph range rides along in the title
    // so the reader can see which of the author's sections a part covers
    tocItem:(c)=>({id:c.part, letter:c.letter,
                   title:c.title+(c.paras?('  ·  '+c.paras):''), count:c.count}),
    chapterTitle:(ch)=>esc(ch.title||''),
    unitLabel:(s)=>esc(s.ref||'')+(s.title?('  ·  '+esc(s.title)):''),
    unitVid:(s)=>s.verse_id,
    unitDom:(s)=>'rdsec-'+s.id,
    searchRef:(r)=>esc(r.ref||'')+(r.title?('  ·  '+esc(r.title)):''),
    searchTo:(r)=>({chap:r.part, dom:'rdsec-'+r.id}),
    langs:[{key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'}],
  },
  asatir: {                            // ספר האסאטיר — 16 chapters, each a run of paragraphs
    titleKey:'asatir_title', tocHintKey:'asatir_toc_hint',
    toc:()=>api('asatir_toc'),
    chapter:(id)=>api('asatir_chapter?chap='+encodeURIComponent(id)),
    search:(q)=>api('asatir_search?q='+encodeURIComponent(q)),
    words:null,
    tocItem:(c)=>({id:c.chap, letter:c.heb, title:c.title, count:c.count}),
    chapterTitle:(ch)=>esc(ch.heb)+'. '+esc(ch.title||''),
    unitLabel:(s)=>esc(s.ref||''),
    unitVid:(s)=>s.verse_id,
    unitDom:(s)=>'rdsec-'+s.id,
    searchRef:(r)=>esc(r.ref||'')+(r.title?('  ·  '+esc(r.title)):''),
    searchTo:(r)=>({chap:r.chap, dom:'rdsec-'+r.id}),
    langs:[{key:'hebrew', htmlKey:'hebrew_html', labelKey:'rd_he'},
           {key:'arabic', labelKey:'rd_ar', dir:'rtl'}],
  },
};
let RD = { key:null, cfg:null, chapter:null, lang:null, fs:parseFloat(localStorage.getItem('as_rd_fs')||'1')||1 };
function rdApplyFs(){ $('rdBody').style.setProperty('--rd-fs', RD.fs); }
function rdZoom(d){ RD.fs=Math.min(2.2, Math.max(0.8, +(RD.fs+d).toFixed(2)));
  localStorage.setItem('as_rd_fs', RD.fs); rdApplyFs(); }
$('rdZoomIn').onclick=()=>rdZoom(0.12);
$('rdZoomOut').onclick=()=>rdZoom(-0.12);
function openReader(key){
  RD.key=key; RD.cfg=BOOK_CFG[key]; RD.chapter=null; RD.lang=RD.cfg.langs[0].key;
  $('rdInput').value=''; $('rdLang').classList.add('hidden');
  $('bookModal').classList.remove('hidden');
  rdApplyFs();
  rdShowToc();
  trackNav('ספריה · '+t(RD.cfg.titleKey));
}
function openTmBook(){ openReader('tm'); }
function openTzBook(){ openReader('tz'); }
function openShytBook(){ openReader('shyt'); }
function openSirBook(){ openReader('sir'); }
function openBhuqBook(){ openReader('bhuq'); }
function openAsatirBook(){ openReader('asatir'); }
function rdSetBack(mode){           // '' hidden · 'toc' · 'chapter'
  const b=$('rdBack');
  if(!mode){ b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  b.textContent = mode==='toc' ? t('tm_back_toc') : t('tm_back_chapter');
  b.onclick = mode==='toc' ? rdShowToc : ()=>openRdChapter(RD.chapter);
}
async function rdShowToc(){
  RD.chapter=null; rdSetBack(''); $('rdLang').classList.add('hidden');
  $('rdTitle').textContent=t(RD.cfg.titleKey);
  const body=$('rdBody'); body.innerHTML=''; body.scrollTop=0;
  body.appendChild(el('div','tm-hint',esc(t(RD.cfg.tocHintKey))));
  let toc; try{ toc=await RD.cfg.toc(); }catch(e){ body.appendChild(el('div','note','—')); return; }
  const list=el('div','tm-toc');
  toc.forEach(raw=>{ const b=RD.cfg.tocItem(raw);
    const card=el('button','tm-toc-item',
      '<span class="tm-toc-letter">'+esc(b.letter)+'</span>'
      +'<span class="tm-toc-title">'+esc(b.title)+'</span>'
      +(b.count?('<span class="tm-toc-count">'+b.count+' '+esc(t('tm_sections_n'))+'</span>'):''));
    card.onclick=()=>openRdChapter(b.id);
    list.appendChild(card);
  });
  body.appendChild(list);
}
function rdTopSection(){      // the section currently nearest the top (to keep place on lang toggle)
  const body=$('rdBody'), top=body.getBoundingClientRect().top;
  let best=null, bd=1e9;
  body.querySelectorAll('.tm-sec').forEach(s=>{ const d=s.getBoundingClientRect().top-top;
    if(d>=-24 && d<bd){ bd=d; best=s; } });
  return best ? best.id : null;
}
function rdLangBtn(){
  const cfg=RD.cfg, b=$('rdLang');
  if(cfg.langs.length<2){ b.classList.add('hidden'); return; }
  const other=cfg.langs.find(l=>l.key!==RD.lang) || cfg.langs[0];
  b.classList.remove('hidden');
  b.textContent = t('rd_show')+' '+t(other.labelKey);
  b.onclick = ()=>{ RD.lang=other.key; openRdChapter(RD.chapter, rdTopSection()); };
}
async function openRdChapter(id, scrollDom){
  RD.chapter=id; rdSetBack('toc');
  const body=$('rdBody'); body.innerHTML=''; body.scrollTop=0;
  body.appendChild(el('div','note',t('searching')));
  let ch; try{ ch=await RD.cfg.chapter(id); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  $('rdTitle').innerHTML=RD.cfg.chapterTitle(ch);
  rdLangBtn();
  if(RD.cfg.words){
    const tools=el('div','tm-tools');
    const wbtn=el('button','tm-words-btn',esc(t('tm_words_btn')));
    wbtn.onclick=()=>rdShowWords(id);
    tools.appendChild(wbtn); body.appendChild(tools);
  }
  const lc=RD.cfg.langs.find(l=>l.key===RD.lang)||RD.cfg.langs[0];
  if(lc.key==='arabic' && ch.sections.every(s=>!s.arabic))
    body.appendChild(el('div','tm-hint',esc(t('tz_arabic_pending'))));
  for(const s of ch.sections){
    const sec=el('div','tm-sec'); sec.id=RD.cfg.unitDom(s);
    const vid=RD.cfg.unitVid(s);
    const num=el('div','tm-secnum'+(vid?' tm-jump':''), RD.cfg.unitLabel(s));
    if(vid){ num.dataset.vid=vid; num.title=t('tm_open_verse'); }
    sec.appendChild(num);
    const html=(lc.htmlKey && s[lc.htmlKey]) ? s[lc.htmlKey] : esc(s[lc.key]||'');
    const td=el('div', lc.key==='aramaic' ? 'tm-aram' : 'tm-heb', html || '—');
    if(lc.dir) td.dir=lc.dir;
    sec.appendChild(td);
    body.appendChild(sec);
  }
  if(scrollDom){ const tgt=document.getElementById(scrollDom);
    if(tgt){ tgt.scrollIntoView({block:'start'}); tgt.classList.add('tm-flash');
      setTimeout(()=>tgt.classList.remove('tm-flash'),1600); } }
}
// jumps: inline verse refs (.tm-ref) and clickable unit headers (.tm-jump)
$('rdBody').addEventListener('click', async e=>{
  const a=e.target.closest('.tm-ref, .tm-jump'); if(!a) return;
  const vid=parseInt(a.dataset.vid,10); if(!vid) return;
  let rec; try{ rec=await api('locate_verse?verse_id='+vid); }catch(_){ return; }
  if(!rec || !rec.portion_id) return;
  const ret={key:RD.key, chapter:RD.chapter, lang:RD.lang};   // remember this reader
  $('bookModal').classList.add('hidden');
  await goToJewish(rec);
  S.searchReturn=false;            // back should return to the reader, not to search
  S.appReturn=ret;
});
// re-open a source app (Memar / Ṣadaqah reader) at the chapter the reader was on
function reopenReader(a){
  if(!a || !BOOK_CFG[a.key]) return;
  RD.key=a.key; RD.cfg=BOOK_CFG[a.key]; RD.lang=a.lang;
  $('bookModal').classList.remove('hidden');
  openRdChapter(a.chapter);
}
async function rdShowWords(id){
  rdSetBack('chapter'); $('rdLang').classList.add('hidden');
  $('rdTitle').textContent=t('tm_words_title');
  const body=$('rdBody'); body.innerHTML=''; body.scrollTop=0;
  body.appendChild(el('div','note',t('searching')));
  let words; try{ words=await RD.cfg.words(id); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML='';
  if(!words.length){ body.appendChild(el('div','note',t('tm_no_results'))); return; }
  const tbl=el('table','wtbl tm-wtbl');
  const hr=el('tr'); for(const h of [t('col_word'),t('tm_col_root'),t('col_heb')]) hr.appendChild(el('th',null,esc(h)));
  tbl.appendChild(hr);
  for(const w of words){ const tr=el('tr');
    tr.appendChild(el('td','wt-word',esc(w.word)));
    tr.appendChild(el('td','wt-tal',esc(w.root||'—')));
    tr.appendChild(el('td','wt-mean',esc(w.gloss||'—')));
    tr.classList.add('tappable'); tr.onclick=()=>showTalFull(w.word);
    tbl.appendChild(tr);
  }
  body.appendChild(tbl);
}
async function rdSearch(){
  const q=($('rdInput').value||'').trim(); if(!q) return;
  rdSetBack('toc'); $('rdLang').classList.add('hidden');
  $('rdTitle').textContent=t(RD.cfg.titleKey);
  const body=$('rdBody'); body.innerHTML=''; body.scrollTop=0;
  body.appendChild(el('div','note',t('searching')));
  let res; try{ res=await RD.cfg.search(q); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note',t('tm_no_results'))); return; }
  body.innerHTML='';
  if(!res.length){ body.appendChild(el('div','note',t('tm_no_results'))); return; }
  body.appendChild(el('div','tm-hint', res.length+' '+esc(t('tm_sections_n'))));
  for(const r of res){
    const it=el('button','tm-result',
      '<span class="tm-res-ref">'+RD.cfg.searchRef(r)+'</span>'
      +'<span class="tm-res-snip">'+esc(r.snippet)+'</span>');
    const to=RD.cfg.searchTo(r);
    it.onclick=()=>openRdChapter(to.chap, to.dom);
    body.appendChild(it);
  }
}
$('rdSearchBtn').onclick=rdSearch;
$('rdInput').addEventListener('keydown',e=>{ if(e.key==='Enter') rdSearch(); });
$('rdClose').onclick=()=>$('bookModal').classList.add('hidden');
$('rdToTorah').onclick=()=>$('bookModal').classList.add('hidden');     // ↩ return to the Torah app

// ── אישים וחוקרים שומרוניים — a who's-who of 95 figures, list on one side, entry on the
// other. Grouped by era (the import assigned the bucket + sort year) or by A-Z;
// search runs server-side over names AND descriptions in all three languages.
const PP = { toc:null, cur:null, mode:'era', _searchRows:null };
const PP_ERA_ORDER = ['bib','anc','med','early','mod','unk'];
async function ppEnsureData(){
  // a live deployment's DB can predate the people table (it arrives with a
  // reseed) — treat that as "no data yet" rather than letting the unit hang empty
  if(!PP.toc){ try{ PP.toc = await api('people_toc'); }catch(e){ PP.toc = []; } }
  return PP.toc;
}
function openPeopleBook(){
  $('peopleModal').classList.remove('hidden');
  $('ppBody').classList.remove('pp-detail-open');
  $('ppBack').classList.add('hidden');
  ppApplyFs();
  ppEnsureData().then(()=>ppBuildList());
  trackNav('ספריה · '+t('pp_title'));
}
function ppApplyFs(){ $('ppDetail').style.setProperty('--rd-fs', RD.fs); }
$('ppZoomIn').onclick=()=>{ rdZoom(0.12); ppApplyFs(); };
$('ppZoomOut').onclick=()=>{ rdZoom(-0.12); ppApplyFs(); };
function ppName(p){ return (LANG==='en'?p.name_en : LANG==='ar'?p.name_ar : p.name_he) || p.name_he || p.name_en; }
function ppPeriod(p){ return (LANG==='en'?p.period : LANG==='ar'?p.period_ar : p.period_he) || p.period || ''; }
function ppBuildList(){
  const list=$('ppList'); list.innerHTML='';
  const rows = PP._searchRows || PP.toc || [];
  if(!rows.length){
    // nothing to browse at all is a different message from "your search matched nothing"
    list.appendChild(el('div','note', (PP.toc && PP.toc.length) ? t('pp_no_result') : t('pp_unavailable')));
    return;
  }
  const groups={}, order=[];
  for(const p of rows){
    const key = PP.mode==='era' ? p.era : (ppName(p).replace(/^[^א-תA-Za-zء-ي]+/,'')[0]||'…').toUpperCase();
    if(!groups[key]){ groups[key]=[]; order.push(key); }
    groups[key].push(p);
  }
  const keys = PP.mode==='era'
    ? PP_ERA_ORDER.filter(k=>groups[k])
    : order.slice().sort((a,b)=>a.localeCompare(b, LANG==='ar'?'ar':LANG==='en'?'en':'he'));
  for(const key of keys){
    const items = PP.mode==='era' ? groups[key]
      : groups[key].slice().sort((a,b)=>ppName(a).localeCompare(ppName(b)));
    // a search shows every hit expanded; browsing opens the A-Z letters and, in
    // era mode, just the first era — six shut drawers read as an empty page
    const d=el('details','pp-group'); d.open = !!PP._searchRows || PP.mode==='abc' || key===keys[0];
    const label = PP.mode==='era' ? t('pp_era_'+key) : key;
    d.innerHTML=`<summary>${esc(label)} <span class="piy-count">(${items.length})</span></summary>`;
    for(const p of items){
      const it=el('div','pp-item'); it.dataset.id=p.id;
      if(PP.cur && PP.cur.id===p.id) it.classList.add('sel');
      it.innerHTML=`<span class="pp-item-name">${esc(ppName(p))}</span>`
        +`<span class="pp-item-per">${esc(ppPeriod(p))}</span>`;
      it.onclick=()=>ppShow(p.id);
      d.appendChild(it);
    }
    list.appendChild(d);
  }
}
async function ppShow(id){
  let p; try{ p=await api('person?id='+encodeURIComponent(id)); }catch(e){ p=null; }
  if(!p || p.error) return;
  PP.cur=p;
  document.querySelectorAll('#ppList .pp-item.sel').forEach(e=>e.classList.remove('sel'));
  document.querySelectorAll(`#ppList .pp-item[data-id="${p.id}"]`).forEach(e=>e.classList.add('sel'));
  const desc = (LANG==='en'?p.description_en : LANG==='ar'?p.description_ar : p.description_he)
            || p.description_he || p.description_en || '';
  // the two names the reader isn't currently reading in, kept as chips so every
  // entry can be looked up under its Hebrew, Latin or Arabic form
  const others = [
    {lbl:'עב', val:p.name_he, d:'rtl', skip:LANG==='he'},
    {lbl:'EN', val:p.name_en, d:'ltr', skip:LANG==='en'},
    {lbl:'عر', val:p.name_ar, d:'rtl', skip:LANG==='ar'},
  ].filter(n=>!n.skip && n.val);
  const src = p.source ? `<div class="pp-src">${esc(t('pp_source'))}: ${esc(p.source)}`
      + (p.contributor_initials && p.contributor_initials!=='unsigned'
          ? ` · ${esc(t('pp_contributor'))} ${esc(p.contributor_initials)}` : '')
      + `</div>` : '';
  // the second delivery's additions, shown only where the source supplied them:
  // a note that fills in dates/corrections the encyclopedia entry lacks, and links onward
  const note = (LANG==='en'?p.enriched_note_en : LANG==='ar'?p.enriched_note_ar : p.enriched_note_he)
            || p.enriched_note_he || p.enriched_note_en || '';
  const noteHtml = (note||'').trim()
    ? `<div class="pp-note"><h4>${esc(t('pp_more'))}</h4><div>${esc(note)}</div></div>` : '';
  // the Wikipedia article, in the reader's own language where that Wikipedia has
  // one — nothing is machine-translated — falling back to whatever language does.
  // CC BY-SA, so the article's name, its link and the licence travel with the text.
  const wiki = p.wikipedia || {};
  const wLang = wiki[LANG] ? LANG : (['he','en','ar'].find(l=>wiki[l]) || null);
  let wikiHtml = '';
  if(wLang){
    const w = wiki[wLang];
    const body = (w.text||'').split('\n').map(line=>{
      const h = line.match(/^(=+)\s*(.*?)\s*=+$/);
      if(h) return `<h5 class="pp-wiki-h${Math.min(h[1].length,3)}">${esc(h[2])}</h5>`;
      return line.trim() ? `<p>${esc(line)}</p>` : '';
    }).join('');
    const via = wLang===LANG ? '' : ' · '+esc(t('pp_wiki_lang_'+wLang));
    wikiHtml = `<details class="pp-wiki"><summary>${esc(t('pp_wiki_open'))}${via}</summary>`
      + `<div class="pp-wiki-body" dir="${wLang==='en'?'ltr':'rtl'}" lang="${wLang}">${body}</div>`
      + `<div class="pp-wiki-credit">${esc(t('pp_wiki_credit'))} `
      + `<a href="${esc(w.url||'')}" target="_blank" rel="noopener noreferrer">${esc(w.title||'')}</a>`
      + ` · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></div>`
      + `</details>`;
  }
  const refs = (p.references||[]).filter(r=>r && (r.url||r.title));
  const refsHtml = refs.length
    ? `<div class="pp-refs"><h4>${esc(t('pp_refs'))}</h4><ul>` + refs.map(r=>{
        const label = esc(r.title || r.url);
        return `<li>` + (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
                               : label) + `</li>`;
      }).join('') + `</ul></div>` : '';
  $('ppDetail').innerHTML=`
    <h2 class="pp-name">${esc(ppName(p))}</h2>
    <div class="pp-chips">
      ${ppPeriod(p)?`<span class="pp-chip pp-chip-per">🕰 ${esc(ppPeriod(p))}</span>`:''}
      ${others.map(n=>`<span class="pp-chip" dir="${n.d}"><b>${n.lbl}</b> ${esc(n.val)}</span>`).join('')}
      ${p.pronunciation?`<span class="pp-chip" dir="ltr"><b>${esc(t('pp_pron'))}</b> /${esc(p.pronunciation)}/</span>`:''}
    </div>
    <div class="pp-desc">${esc(desc)}</div>
    ${noteHtml}
    ${wikiHtml}
    ${refsHtml}
    ${src}`;
  $('ppBody').classList.add('pp-detail-open');   // mobile: swap list → entry
  $('ppBack').classList.remove('hidden');
  ppApplyFs();
}
function ppSetMode(m){
  PP.mode=m;
  $('ppModeEra').classList.toggle('on', m==='era');
  $('ppModeAbc').classList.toggle('on', m==='abc');
  ppBuildList();
}
$('ppModeEra').onclick=()=>ppSetMode('era');
$('ppModeAbc').onclick=()=>ppSetMode('abc');
let _ppSearchTimer=null;
$('ppSearch').addEventListener('input', ()=>{
  clearTimeout(_ppSearchTimer);
  _ppSearchTimer=setTimeout(async ()=>{
    const q=($('ppSearch').value||'').trim();
    if(!q){ PP._searchRows=null; ppBuildList(); return; }
    try{ PP._searchRows=await api('people_search?q='+encodeURIComponent(q)); }
    catch(e){ PP._searchRows=[]; }
    ppBuildList();
  }, 250);
});
$('ppBack').onclick=()=>{ $('ppBody').classList.remove('pp-detail-open'); $('ppBack').classList.add('hidden'); };
$('ppClose').onclick=()=>$('peopleModal').classList.add('hidden');
$('ppToTorah').onclick=()=>$('peopleModal').classList.add('hidden');
$('ppToLib').onclick=()=>{ $('peopleModal').classList.add('hidden'); openLibrary(); };

// ── עיון בפיוטים השומרוניים — festival/genre tree + reader + inline word
// dictionary. Ported from the standalone app_unit/piyutim_unit.html prototype
// onto the app's own DB-backed API instead of an embedded multi-MB JS blob.
const PIY = { toc:null, dict:null, cur:null, dictOn:false, _searchRows:null };
const PIY_FEST_ORDER = ['שבת','פסח','חג המצות','שבועות','ראש החודש','יום הכיפורים','סוכות','שמיני עצרת','שמחה','שונות'];
async function piyEnsureData(){
  if(!PIY.toc)  PIY.toc  = await api('piyutim_toc');
  if(!PIY.dict) PIY.dict = await api('piyutim_dict');
  return PIY;
}
function openPiyutimBook(){
  $('piyModal').classList.remove('hidden');
  $('piyBody').classList.remove('piy-detail-open');
  $('piyToRhyme').classList.add('hidden');   // only shown when entered via a rhyme-search jump
  piyEnsureData().then(()=>piyBuildTree());
  trackNav(t('piy_title'));
}
function piyNorm(s){ return (s||'').replace(/[^א-ת]/g,''); }
function piyBuildTree(){
  const q=($('piySearch').value||'').trim();
  const tree=$('piyTree'); tree.innerHTML='';
  const rows = q ? (PIY._searchRows||[]) : (PIY.toc||[]);
  const byFest={};
  for(const p of rows){
    (byFest[p.festival] ||= {})[p.genre] ||= [];
    byFest[p.festival][p.genre].push(p);
  }
  const order = PIY_FEST_ORDER.filter(f=>byFest[f]).concat(Object.keys(byFest).filter(f=>!PIY_FEST_ORDER.includes(f)));
  for(const fest of order){
    const genres=byFest[fest]; if(!genres) continue;
    const total=Object.values(genres).reduce((a,b)=>a+b.length,0);
    const fd=el('details','piy-fest'); fd.open=!!q;
    fd.innerHTML=`<summary>${esc(fest)} <span class="piy-count">(${total})</span></summary>`;
    for(const genre of Object.keys(genres).sort()){
      const items=genres[genre];
      const gd=el('details','piy-genre'); gd.open=!!q;
      gd.innerHTML=`<summary>${esc(genre)} <span class="piy-count">(${items.length})</span></summary>`;
      for(const p of items.slice().sort((a,b)=>(a.author+a.incipit3).localeCompare(b.author+b.incipit3))){
        const div=el('div','piy-item'); div.dataset.id=p.id;
        if(PIY.cur && PIY.cur.id===p.id) div.classList.add('sel');
        div.innerHTML=`<span class="piy-item-title">${esc(p.title||p.incipit3||'')}</span><span class="piy-item-auth">${esc(p.author||'')}</span>`;
        div.onclick=()=>piyShow(p.id);
        gd.appendChild(div);
      }
      fd.appendChild(gd);
    }
    tree.appendChild(fd);
  }
  if(!tree.children.length) tree.appendChild(el('div','note', t('lib_no_result')));
}
let _piySearchTimer=null;
$('piySearch').addEventListener('input', ()=>{
  clearTimeout(_piySearchTimer);
  _piySearchTimer=setTimeout(async ()=>{
    const q=($('piySearch').value||'').trim();
    if(!q){ PIY._searchRows=null; piyBuildTree(); return; }
    try{ PIY._searchRows=await api('piyutim_search?q='+encodeURIComponent(q)); }
    catch(e){ PIY._searchRows=[]; }
    piyBuildTree();
  }, 250);
});
function piyWordSpan(w){
  const clean=piyNorm(w), has=clean && PIY.curDict && PIY.curDict[clean];
  return `<span class="piy-w ${has?'piy-hasdef':''}" data-w="${esc(clean)}">${esc(w)}</span>`;
}
async function piyShow(id){
  let p; try{ p=await api('piyutim_chapter?id='+id); }catch(e){ p=null; }
  if(!p || p.error) return;
  PIY.cur=p;
  PIY.curDict=Object.assign({}, PIY.dict, p.dict||{});   // per-piece dict, enriched server-side with tal_word_gloss
  document.querySelectorAll('#piyTree .piy-item.sel').forEach(e=>e.classList.remove('sel'));
  document.querySelectorAll(`#piyTree .piy-item[data-id="${id}"]`).forEach(e=>e.classList.add('sel'));
  const lines=(p.text||'').split('\n').map(l=>
    l.split(/(\s+)/).map(tk=>/[א-ת]/.test(tk)?piyWordSpan(tk):esc(tk)).join('')).join('\n');
  const qBadge = p.quality==='verified' ? t('piy_q_verified') : p.quality==='ocr_cleaned' ? t('piy_q_cleaned') : t('piy_q_raw');
  $('piyTextPane').innerHTML=`
    <h2 class="piy-title">${esc(p.title||'')}</h2>
    <div class="piy-meta">
      <span class="piy-tag">✍ ${esc(p.author||'')}</span>
      <span class="piy-tag">🕎 ${esc(p.festival||'')}</span>
      <span class="piy-tag">◈ ${esc(p.genre||'')}</span>
      <span class="piy-tag">📖 ${esc(p.source||'')}${p.source_ref?(' · '+esc(p.source_ref)):''}</span>
      <span class="piy-tag">${esc(qBadge)}</span>
    </div>
    <div class="piy-text">${lines}</div>
    ${p.notes?`<div class="piy-notes">${esc(p.notes)}</div>`:''}`;
  piyRenderDict();
  $('piyBody').classList.add('piy-detail-open');   // mobile: swap tree → detail
  $('piyBack').classList.remove('hidden');
}
function piyRenderDict(){
  const body=$('piyDictPane'), p=PIY.cur;
  if(!p){ body.innerHTML=`<div class="note">${esc(t('piy_pick_first'))}</div>`; return; }
  let html='';
  if(p.translation_he) html+=`<h4>${esc(t('piy_translation_he'))}</h4><div class="piy-text" style="font-size:1.02em">${esc(p.translation_he)}</div><hr>`;
  for(const line of (p.text||'').split('\n')){
    const ws=line.match(/[א-ת]+/g)||[];
    if(!ws.length) continue;
    let defs='';
    for(const w of ws){
      const d=PIY.curDict && PIY.curDict[piyNorm(w)];
      if(d) defs+=`<span class="piy-dw"><b>${esc(w)}</b> — <span>${esc(d)}</span></span>`;
    }
    html+=`<div class="piy-dline"><div class="piy-dsrc">${esc(line)}</div>${defs||`<span class="piy-dw piy-dw-none">${esc(t('piy_no_dict_line'))}</span>`}</div>`;
  }
  body.innerHTML = html || `<div class="note">${esc(t('piy_pick_first'))}</div>`;
}
$('piyDictToggle').onclick=()=>{
  PIY.dictOn=!PIY.dictOn;
  $('piyDictPane').classList.toggle('hidden', !PIY.dictOn);
  $('piyDictToggle').classList.toggle('active', PIY.dictOn);
  if(PIY.dictOn) piyRenderDict();
};
$('piyBack').onclick=()=>$('piyBody').classList.remove('piy-detail-open');
$('piyClose').onclick=()=>$('piyModal').classList.add('hidden');
$('piyToTorah').onclick=()=>$('piyModal').classList.add('hidden');
// word-tap popup (mirrors the standalone prototype's #wordPop)
document.addEventListener('click', e=>{
  const pop=$('piyWordPop'); if(!pop) return;
  if(e.target.classList && e.target.classList.contains('piy-w')){
    const w=e.target.dataset.w, d=PIY.curDict && PIY.curDict[w];
    pop.innerHTML=`<b>${esc(w)}</b><br>${d?esc(d):('<i>'+esc(t('piy_no_dict_entry'))+'</i>')}`;
    pop.classList.remove('hidden');
    pop.style.top=Math.min(e.clientY+12, innerHeight-90)+'px';
    pop.style.left=Math.max(10, e.clientX-150)+'px';
  } else if(!pop.classList.contains('hidden')) pop.classList.add('hidden');
});

// ── מציאת חרוזים — word/suffix/sound rhyme search over the piyyutim word bank.
// Ported from app_unit/rhyme_unit.html onto the API instead of an embedded blob.
const RHY = { mode:'exact', sounds:null };
function openRhymeBook(){
  $('rhymeModal').classList.remove('hidden');
  if(!RHY.sounds){
    api('piyutim_rhyme_sounds').then(list=>{
      RHY.sounds=list;
      $('rhySoundSel').innerHTML=`<option value="">—</option>`+list.map(k=>`<option>${esc(k)}</option>`).join('');
    });
  }
  trackNav(t('rhyme_title'));
}
function rhySetMode(m){
  RHY.mode=m;
  const ids={exact:'rhyModeExact', syll:'rhyModeSyll', sound:'rhyModeSound'};
  Object.values(ids).forEach(id=>$(id).classList.remove('on'));
  $(ids[m]).classList.add('on');
  // the group dropdown ("or pick a sound-group directly") only makes sense in sound mode
  const showGroup = m==='sound';
  $('rhyOrLabel').classList.toggle('hidden', !showGroup);
  $('rhySoundSel').classList.toggle('hidden', !showGroup);
  $('rhyQ').placeholder = t('rhy_q_ph');
}
$('rhyModeExact').onclick=()=>rhySetMode('exact');
$('rhyModeSyll').onclick=()=>rhySetMode('syll');
$('rhyModeSound').onclick=()=>rhySetMode('sound');
rhySetMode('exact');
async function rhySearch(){
  const cleanOnly=$('rhyCleanOnly').checked;
  const q=($('rhyQ').value||'').trim();
  const startLetter=($('rhyStartLetter').value||'').trim();
  const group = (RHY.mode==='sound' && !q) ? $('rhySoundSel').value : '';
  if(!q && !group) return;
  $('rhySummary').textContent=t('searching');
  const params=new URLSearchParams({mode:RHY.mode, q, group});
  if(cleanOnly) params.set('clean_only','1');
  if(startLetter) params.set('start_letter', startLetter);
  let list; try{ list=await api('piyutim_rhyme?'+params.toString()); }
  catch(e){ list=[]; }
  await piyEnsureData();   // needed to resolve occurrence ids → piece titles
  rhyRender(list);
}
function rhyRender(list){
  const res=$('rhyResults');
  if(!list.length){ $('rhySummary').textContent=''; res.innerHTML=`<div class="note">${esc(t('rhy_no_results'))}</div>`; return; }
  $('rhySummary').textContent=t('rhy_found_n').replace('{n}', list.length);
  let html=`<table class="rhy-table"><tr><th>${esc(t('rhy_col_word'))}</th><th>${esc(t('rhy_col_freq'))}</th>`
    +`<th>${esc(t('rhy_col_group'))}</th><th>${esc(t('rhy_col_def'))}</th><th>${esc(t('rhy_col_occ'))}</th></tr>`;
  list.forEach((w,i)=>{
    const grp = w.rhyme_human
      ? `<span class="rhy-grp">${esc(w.rhyme_human)}</span>`
        + (w.rhyme_method!=='book_exact' ? `<div class="rhy-conf">${esc(t('rhy_approx').replace('{p}', Math.round((w.rhyme_conf||0)*100)))}</div>` : '')
      : '<span class="rhy-conf">—</span>';
    const def = w.definition || (PIY.dict && PIY.dict[w.word]);
    const defHtml = def
      ? esc(def)+(w.tal_root?` <span class="rhy-conf">(${esc(t('rhy_root_lbl'))} ${esc(w.tal_root)})</span>`:'')
      : esc(t('rhy_no_def'));
    html+=`<tr>
      <td class="rhy-word">${esc(w.word)}</td>
      <td>${w.freq||0}${w.freq_clean?` <span class="rhy-conf">(${w.freq_clean} ${esc(t('rhy_clean_n'))})</span>`:''}</td>
      <td>${grp}</td>
      <td class="rhy-def ${def?'':'rhy-def-none'}">${defHtml}</td>
      <td>${(w.occurrences&&w.occurrences.length) ? `<button class="rhy-occbtn" data-i="${i}">${w.occurrences.length} ${esc(t('rhy_occ_n'))} ▾</button><div class="rhy-occlist hidden"></div>` : '<span class="rhy-conf">—</span>'}</td>
    </tr>`;
  });
  res.innerHTML=html+'</table>';
  res.querySelectorAll('.rhy-occbtn').forEach(btn=>{ btn.onclick=()=>rhyToggleOcc(btn, list[+btn.dataset.i]); });
}
function rhyToggleOcc(btn, w){
  const div=btn.nextElementSibling;
  if(!div.classList.contains('hidden')){ div.classList.add('hidden'); return; }
  const tocById={}; (PIY.toc||[]).forEach(p=>tocById[p.id]=p);
  let html='';
  for(const pid of (w.occurrences||[])){
    const p=tocById[pid]; if(!p) continue;
    html+=`<button class="rhy-occlink" data-id="${pid}">📜 ${esc(p.incipit3||p.title||'')} — ${esc(p.author||'')} (${esc(p.festival||'')} · ${esc(p.genre||'')})</button>`;
  }
  div.innerHTML = html || esc(t('rhy_no_data'));
  div.classList.remove('hidden');
  div.querySelectorAll('.rhy-occlink').forEach(a=>{
    a.onclick=()=>{
      // hide (not clear) the rhyme results — RHY/#rhyResults keep their exact
      // state, so "return to search" below just un-hides them, no re-search
      $('rhymeModal').classList.add('hidden');
      $('piyModal').classList.remove('hidden');
      $('piySearch').value=''; $('piyBody').classList.remove('piy-detail-open');
      $('piyToRhyme').classList.remove('hidden');
      piyEnsureData().then(()=>{ piyBuildTree(); piyShow(+a.dataset.id); });
    };
  });
}
$('rhyGo').onclick=rhySearch;
$('rhyQ').addEventListener('keydown', e=>{ if(e.key==='Enter') rhySearch(); });
$('rhyClose').onclick=()=>$('rhymeModal').classList.add('hidden');
$('rhyToTorah').onclick=()=>$('rhymeModal').classList.add('hidden');
$('piyToRhyme').onclick=()=>{ $('piyModal').classList.add('hidden'); $('rhymeModal').classList.remove('hidden'); };

// ── "חבר לי חיבור" — piyyut draft composer (admin-only, first phase) ─────────
// Ported from the standalone piyyut_composer.html prototype: assembles a DRAFT
// from real corpus half-lines ("צלעות", cola) grouped by rhyme, per simple
// genre templates (opener/refrain/closer) — a starting point for a human
// paytan to edit, not a finished composition.
const CMP = { data:null, current:[] };
const CMP_AB = 'אבגדהוזחטיכלמנסעפצקרשת';
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function openComposer(){
  if(!ADMIN.token) return;
  $('composerModal').classList.remove('hidden');
  if(!CMP.data){
    if(!window.COMPOSER_DATA) await loadScript('/static/composer_data.js');
    CMP.data=window.COMPOSER_DATA;
    const gSel=$('cmpGenre'), tSel=$('cmpTheme'), rSel=$('cmpRhyme');
    gSel.innerHTML=Object.keys(CMP.data.genres).map(g=>`<option>${esc(g)}</option>`).join('');
    tSel.innerHTML=Object.keys(CMP.data.themes).map(x=>`<option>${esc(x)}</option>`).join('');
    rSel.innerHTML=`<option value="">${esc(t('cmp_rhyme_random'))}</option>`
      +Object.entries(CMP.data.cola_by_rhyme).map(([k,v])=>
        `<option value="${esc(k)}">${esc(v.header)} (${esc(k)}) — ${v.cola.length} ${esc(t('cmp_cola_n'))}</option>`).join('');
  }
  trackNav(t('m_composer'));
}
function cmpPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function cmpPool(theme){
  const kws=CMP.data.themes[theme]||[];
  let all=[];
  for(const g of Object.values(CMP.data.cola_by_rhyme)) all=all.concat(g.cola);
  const themed = kws.length ? all.filter(c=>kws.some(k=>c.includes(k))) : [];
  return {all, themed};
}
function cmpAcroPool(aPool, all, letter){
  if(!letter) return aPool;
  const hit=aPool.filter(c=>c[0]===letter);
  if(hit.length) return hit;
  const anyHit=all.filter(c=>c[0]===letter);
  return anyHit.length ? anyHit : aPool;
}
function cmpGenerate(){
  const genre=$('cmpGenre').value, theme=$('cmpTheme').value;
  let rk=$('cmpRhyme').value;
  if(!rk){
    const rich=Object.entries(CMP.data.cola_by_rhyme).sort((a,b)=>b[1].cola.length-a[1].cola.length).slice(0,5);
    rk=cmpPick(rich)[0];
  }
  const G=CMP.data.genres[genre], R=CMP.data.cola_by_rhyme[rk];
  const stanzas=Math.max(1, Math.min(+$('cmpStanzas').value||1, 12));
  const perStanza=Math.max(1, Math.min(+$('cmpLinesPerStanza').value||1, R.cola.length));
  const acroText=($('cmpAcroText').value||'').replace(/[^א-ת]/g,'');
  const {all, themed}=cmpPool(theme);
  CMP.current=[];
  if(G.openers) CMP.current.push({t:'frame', a:G.openers[0]});
  for(let s=0;s<stanzas;s++){
    CMP.current.push({t:'stanza', label:CMP_AB[s % CMP_AB.length]});
    const usedEnd=new Set();
    for(let i=0;i<perStanza;i++){
      const cands=R.cola.filter(c=>!usedEnd.has(c.split(' ').pop()));
      if(!cands.length) break;
      const b=cmpPick(cands); usedEnd.add(b.split(' ').pop());
      const letter=acroText ? acroText[i % acroText.length] : null;
      const aPool=cmpAcroPool(themed.length ? themed : all, all, letter);
      let a=cmpPick(aPool);
      if(a===b) a=cmpPick(all);
      CMP.current.push({t:'line', a, b, ref:G.refrain, letter});
    }
  }
  CMP.current.push({t:'frame', a:cmpPick(G.closers)});
  cmpRender();
}
function cmpRender(){
  const box=$('cmpPoem');
  box.innerHTML=CMP.current.map((l,i)=>{
    if(l.t==='frame') return `<div class="cmp-line"><span class="cmp-frame">${esc(l.a)} :</span></div>`;
    if(l.t==='stanza') return `<div class="cmp-stanza-h">${esc(t('cmp_stanza'))} ${esc(l.label)}׳</div>`;
    const bodyA = l.letter ? esc(l.a).replace(/^(.)/, '<u>$1</u>') : esc(l.a);
    return `<div class="cmp-line"><span>${bodyA} • <b>${esc(l.b)}</b>${l.ref?(' — <span class="cmp-refrain">'+esc(l.ref)+'</span>'):''} :</span>
      <button class="cmp-reroll" data-i="${i}">🎲</button></div>`;
  }).join('');
  box.querySelectorAll('.cmp-reroll').forEach(btn=>{ btn.onclick=()=>cmpReroll(+btn.dataset.i); });
  $('cmpCopy').classList.toggle('hidden', !CMP.current.length);
}
function cmpReroll(i){
  const l=CMP.current[i];
  if(!l || l.t!=='line') return;
  const rk=$('cmpRhyme').value || Object.keys(CMP.data.cola_by_rhyme)[0];
  const R=CMP.data.cola_by_rhyme[$('cmpRhyme').value] || CMP.data.cola_by_rhyme[rk];
  const {all, themed}=cmpPool($('cmpTheme').value);
  l.a=cmpPick(cmpAcroPool(themed.length ? themed : all, all, l.letter));
  const used=new Set(CMP.current.filter(x=>x.t==='line' && x.b).map(x=>x.b.split(' ').pop()));
  const cands=R.cola.filter(c=>!used.has(c.split(' ').pop()));
  if(cands.length) l.b=cmpPick(cands);
  cmpRender();
}
function cmpCopyPoem(){
  const txt=CMP.current.map(l=>{
    if(l.t==='frame') return l.a+' :';
    if(l.t==='stanza') return '\n'+t('cmp_stanza')+' '+l.label+'׳';
    return `${l.a} • ${l.b}${l.ref?(' — '+l.ref):''} :`;
  }).join('\n').trim();
  navigator.clipboard.writeText(txt).catch(()=>{});
  showInfo(t('m_composer'), `<div class="note">${esc(t('cmp_copied'))}</div>`);
}
$('cmpGo').onclick=cmpGenerate;
$('cmpCopy').onclick=cmpCopyPoem;
$('cmpClose').onclick=()=>$('composerModal').classList.add('hidden');
$('cmpToTorah').onclick=()=>$('composerModal').classList.add('hidden');
$('cmpToLib').onclick=()=>{ $('composerModal').classList.add('hidden'); openLibrary(); };

// ── "חיבורים פרטיים": free-text AI composer + saved private compositions ─────
// (admin-only). Unlike the corpus-based מחולל above, this calls a real Claude
// API request server-side (own ANTHROPIC_API_KEY, billed separately) with web
// search enabled. Drafts are ephemeral until the admin explicitly saves one;
// saved compositions are stored line-by-line so the existing verse-pencil edit
// flow (openEdit/addPencil) can edit them, table 'private_composition_lines'.
const PC = { items:[], current:null, draftText:'', draftPrompt:'' };
function pcShowPanel(which){
  $('pcListPanel').classList.toggle('hidden', which!=='list');
  $('pcGenPanel').classList.toggle('hidden', which!=='gen');
  $('pcDetailPanel').classList.toggle('hidden', which!=='detail');
}
async function openPrivateComp(){
  if(!ADMIN.token) return;
  $('privateCompModal').classList.remove('hidden');
  await pcLoadList();
  pcShowPanel('list');
  trackNav(t('m_privatecomp'));
}
async function pcLoadList(){
  let r; try{ r = await fetch('/api/private_comp/list?token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  PC.items = (r && r.ok) ? r.items : [];
  const box = $('pcList');
  if(!PC.items.length){ box.innerHTML = `<div class="cmp-note">${esc(t('pc_empty'))}</div>`; return; }
  box.innerHTML = PC.items.map(it=>`<button class="pc-item" data-id="${it.id}">
      <span class="pc-item-title">${esc(it.title)}</span><span class="pc-item-date">${esc((it.created_at||'').slice(0,10))}</span>
    </button>`).join('');
  box.querySelectorAll('.pc-item').forEach(b=>{ b.onclick=()=>pcOpenDetail(+b.dataset.id); });
}
$('pcNewBtn').onclick=()=>{
  $('pcPrompt').value=''; $('pcGenStatus').classList.add('hidden');
  $('pcDraftWrap').classList.add('hidden'); $('pcSaveTitle').value='';
  pcShowPanel('gen');
};
$('pcGenBack').onclick=()=>pcShowPanel('list');
$('pcGoBtn').onclick=async ()=>{
  const prompt = $('pcPrompt').value.trim();
  if(!prompt) return;
  $('pcGoBtn').disabled = true;
  $('pcGenStatus').classList.remove('hidden'); $('pcGenStatus').textContent=t('pc_generating');
  $('pcDraftWrap').classList.add('hidden');
  let r; try{ r = await apiPost('admin/private_comp/generate', {token:ADMIN.token, prompt}); }catch(e){ r={ok:false}; }
  $('pcGoBtn').disabled = false;
  if(!r || !r.ok){ $('pcGenStatus').textContent = (r&&r.error) || t('edit_err'); return; }
  $('pcGenStatus').classList.add('hidden');
  PC.draftText = r.text; PC.draftPrompt = prompt;
  $('pcDraft').textContent = r.text;
  $('pcSaveTitle').value = prompt.slice(0, 40);
  $('pcDraftWrap').classList.remove('hidden');
};
$('pcSaveBtn').onclick=async ()=>{
  const title = $('pcSaveTitle').value.trim() || t('pc_untitled');
  let r; try{ r = await apiPost('admin/private_comp/save',
    {token:ADMIN.token, title, prompt:PC.draftPrompt||'', text:PC.draftText||''}); }catch(e){ r={ok:false}; }
  if(r && r.ok){ await pcLoadList(); pcOpenDetail(r.id); }
  else showInfo(t('m_privatecomp'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
};
async function pcOpenDetail(id){
  let r; try{ r = await fetch('/api/private_comp/get?id='+id+'&token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  if(!r || !r.ok) return;
  PC.current = r.comp;
  $('pcDetailTitle').textContent = r.comp.title;
  const box = $('pcDetailLines');
  box.innerHTML = (r.comp.lines||[]).map(l=>`<div class="pc-line" data-lid="${l.id}"><span class="pc-line-text">${esc(l.text)}</span></div>`).join('');
  box.querySelectorAll('.pc-line').forEach(rowEl=>{
    const lid = +rowEl.dataset.lid;
    const line = r.comp.lines.find(l=>l.id===lid);
    addPencil(rowEl, lid, 'text', ()=>line.text, 'private_composition_lines', ()=>pcOpenDetail(id));
  });
  pcShowPanel('detail');
}
$('pcDetailBack').onclick=()=>pcShowPanel('list');
$('pcDupBtn').onclick=async ()=>{
  if(!PC.current) return;
  let r; try{ r = await apiPost('admin/private_comp/duplicate', {token:ADMIN.token, id:PC.current.id}); }catch(e){ r={ok:false}; }
  if(r && r.ok){ await pcLoadList(); pcOpenDetail(r.id); }
};
$('pcDelBtn').onclick=async ()=>{
  if(!PC.current) return;
  if(!await askConfirm(t('pc_delete'), t('pc_delete_q'), t('confirm_yes'), t('c_cancel'))) return;
  let r; try{ r = await apiPost('admin/private_comp/delete', {token:ADMIN.token, id:PC.current.id}); }catch(e){ r={ok:false}; }
  if(r && r.ok){ await pcLoadList(); pcShowPanel('list'); }
};
$('pcClose').onclick=()=>$('privateCompModal').classList.add('hidden');
$('pcToTorah').onclick=()=>$('privateCompModal').classList.add('hidden');
$('pcToLib').onclick=()=>{ $('privateCompModal').classList.add('hidden'); openLibrary(); };

// ── PWA install ("התקנת אפליקציה") ───────────────────────────────────────────
// Capture the browser's install prompt so the menu button can trigger it; fall
// back to platform instructions where the prompt isn't available (iOS Safari).
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
window.addEventListener('appinstalled', () => { deferredInstall = null; });
const INSTALL_TXT = {
  he:{ not_done:'ההתקנה לא הושלמה. אפשר לנסות שוב מהתפריט בכל עת.', already:'האפליקציה כבר מותקנת ופועלת כאפליקציה. 🎉',
       ios_h:'התקנה באייפון / אייפד', ios:['הקש על כפתור <b>השיתוף</b> (ריבוע עם חץ כלפי מעלה) בסרגל התחתון של Safari.','גלול ובחר <b>„הוסף למסך הבית"</b>.','הקש <b>„הוסף"</b> בפינה העליונה — וזהו.'],
       ios_only:'פעולה זו אפשרית רק בדפדפן <b>Safari</b>.',
       android_h:'התקנה באנדרואיד', android:['הקש על תפריט <b>שלוש הנקודות</b> (⋮) בפינה העליונה.','בחר <b>„התקנת אפליקציה"</b> או <b>„הוספה למסך הבית"</b>.','אשר את ההוספה.'],
       desktop_h:'התקנה במחשב', desktop:['ב-<b>Chrome / Edge</b>: לחץ על סמל ההתקנה <b>⊕</b> בשורת הכתובת, או תפריט הדפדפן (⋮) → <b>„התקנת האפליקציה"</b>.','אשר את ההתקנה.'],
       inapp_warn:'אתה גולש מתוך דפדפן פנימי של אפליקציה אחרת (וואטסאפ / פייסבוק וכד׳) שאינו תומך בהתקנה. יש לפתוח תחילה את הדף בדפדפן רגיל.',
       inapp:['הקש על תפריט <b>שלוש הנקודות</b> בפינה.','בחר <b>„פתח בדפדפן"</b> או <b>„פתח ב-Safari / Chrome"</b>.','בדפדפן: הקש <b>שיתוף</b> ← <b>„הוסף למסך הבית"</b>, או תפריט (⋮) ← <b>„התקנת אפליקציה"</b>.'],
       name:'ייווצר קיצור בשם ' },
  en:{ not_done:'Installation was not completed. You can try again from the menu anytime.', already:'The app is already installed and running. 🎉',
       ios_h:'Install on iPhone / iPad', ios:['Tap the <b>Share</b> button (a square with an up arrow) in Safari’s bottom bar.','Scroll and choose <b>“Add to Home Screen”</b>.','Tap <b>“Add”</b> in the top corner — done.'],
       ios_only:'This works only in the <b>Safari</b> browser.',
       android_h:'Install on Android', android:['Tap the <b>three-dots</b> menu (⋮) at the top corner.','Choose <b>“Install app”</b> or <b>“Add to Home screen”</b>.','Confirm to add.'],
       desktop_h:'Install on desktop', desktop:['In <b>Chrome / Edge</b>: click the install icon <b>⊕</b> in the address bar, or the browser menu (⋮) → <b>“Install app”</b>.','Confirm the installation.'],
       inapp_warn:'You’re browsing inside another app’s built-in browser (WhatsApp / Facebook etc.), which can’t install. Open the page in a regular browser first.',
       inapp:['Tap the <b>three-dots</b> menu in the corner.','Choose <b>“Open in browser”</b> or <b>“Open in Safari / Chrome”</b>.','In the browser: tap <b>Share</b> → <b>“Add to Home Screen”</b>, or menu (⋮) → <b>“Install app”</b>.'],
       name:'A shortcut will be created named ' },
  ar:{ not_done:'لم يكتمل التثبيت. يمكنك المحاولة ثانيةً من القائمة في أيّ وقت.', already:'التطبيق مثبّت ويعمل بالفعل. 🎉',
       ios_h:'التثبيت على آيفون / آيباد', ios:['اضغط على زرّ <b>المشاركة</b> (مربّع بسهم للأعلى) في الشريط السفلي في Safari.','مرّر واختر <b>«إضافة إلى الشاشة الرئيسية»</b>.','اضغط <b>«إضافة»</b> في الزاوية العلوية — وانتهى.'],
       ios_only:'تعمل هذه الميزة في متصفح <b>Safari</b> فقط.',
       android_h:'التثبيت على أندرويد', android:['اضغط على قائمة <b>النقاط الثلاث</b> (⋮) في الزاوية العلوية.','اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.','أكّد الإضافة.'],
       desktop_h:'التثبيت على الحاسوب', desktop:['في <b>Chrome / Edge</b>: اضغط رمز التثبيت <b>⊕</b> في شريط العنوان، أو قائمة المتصفّح (⋮) ← <b>«تثبيت التطبيق»</b>.','أكّد التثبيت.'],
       inapp_warn:'أنت تتصفّح داخل متصفح مدمج لتطبيق آخر (واتساب / فيسبوك وغيرها) لا يدعم التثبيت. افتح الصفحة في متصفح عادي أولًا.',
       inapp:['اضغط على قائمة <b>النقاط الثلاث</b> في الزاوية.','اختر <b>«فتح في المتصفح»</b> أو <b>«فتح في Safari / Chrome»</b>.','في المتصفح: اضغط <b>مشاركة</b> ← <b>«إضافة إلى الشاشة الرئيسية»</b>، أو القائمة (⋮) ← <b>«تثبيت التطبيق»</b>.'],
       name:'سيُنشأ اختصار باسم ' },
};
// platform detection (incl. in-app browsers, where install is blocked) — mirrors
// the dedicated install module so the menu/welcome flow gives the same guidance.
function installPlatform(){
  const ua = navigator.userAgent || '';
  if(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return 'installed';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|WhatsApp|Snapchat|MicroMessenger/i.test(ua);
  if(iOS) return (!inApp && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) ? 'ios-safari' : 'ios-inapp';
  if(android) return inApp ? 'android-inapp' : 'android';
  return 'desktop';
}
// card strings (title / subtitle / button) and icons, styled like the dedicated
// install module: a navy-and-gold parchment card with the אבני שהם logo.
const INSTALL_UI = {
  he:{ title:'הוספת התורה למסך הבית', sub:'גישה מהירה במסך מלא, גם ללא רשת.', install:'התקנת האפליקציה', close:'סגירה',
       hint_and:'ההתקנה מוסיפה אייקון למסך הבית ופותחת את האפליקציה במסך מלא.', hint_desk:'יתווסף קיצור לאפליקציה שייפתח בחלון נפרד.',
       or:'או', pwa_h:'התקנה מהדפדפן', apk_h:'הורדת אפליקציית אנדרואיד', apk_sub:'קובץ התקנה להורדה ישירה למכשיר.',
       apk_btn:'הורדת האפליקציה', apk_ver:'גרסה',
       apk_note:'בסיום ההורדה פתח את הקובץ ואשר את ההתקנה. אם המכשיר שואל — אשר התקנה ממקור זה.' },
  en:{ title:'Add the Torah to your home screen', sub:'Quick full-screen access, even offline.', install:'Install the app', close:'Close',
       hint_and:'Installing adds an icon to your home screen and opens the app full-screen.', hint_desk:'A shortcut will be added that opens in its own window.',
       or:'or', pwa_h:'Install from the browser', apk_h:'Download the Android app', apk_sub:'An installer file, downloaded straight to your device.',
       apk_btn:'Download the app', apk_ver:'version',
       apk_note:'When the download finishes, open the file and confirm the installation. If your device asks, allow installing from this source.' },
  ar:{ title:'أضِف التوراة إلى الشاشة الرئيسية', sub:'وصول سريع بملء الشاشة، حتى دون اتصال.', install:'تثبيت التطبيق', close:'إغلاق',
       hint_and:'يضيف التثبيت أيقونة إلى شاشتك الرئيسية ويفتح التطبيق بملء الشاشة.', hint_desk:'ستتم إضافة اختصار يُفتح في نافذة مستقلة.',
       or:'أو', pwa_h:'التثبيت من المتصفّح', apk_h:'تنزيل تطبيق أندرويد', apk_sub:'ملف تثبيت يُنزَّل مباشرةً إلى جهازك.',
       apk_btn:'تنزيل التطبيق', apk_ver:'الإصدار',
       apk_note:'عند انتهاء التنزيل افتح الملف وأكّد التثبيت. إذا سألك الجهاز، اسمح بالتثبيت من هذا المصدر.' },
};
// The signed APK, offered next to the PWA install on Android. Fetched once and
// cached; when it isn't published the card simply omits the option rather than
// offering a download that 404s.
let APK_INFO = null;
async function loadApkInfo(){
  // with an admin token the answer also carries the download tally, which is
  // why this is re-fetched on entering admin mode rather than cached for good
  const q = ADMIN.token ? '?token=' + encodeURIComponent(ADMIN.token) : '';
  try{ APK_INFO = await (await fetch('/api/apk_info' + q)).json(); }
  catch(e){ APK_INFO = {available:false}; }
  return APK_INFO;
}
const INSTALL_ICONS = {
  share:'<svg width="20" height="22" viewBox="0 0 20 22" fill="none"><path d="M10 1.5v12" stroke="#1F3864" stroke-width="1.7" stroke-linecap="round"/><path d="M6 5l4-4 4 4" stroke="#1F3864" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9H3.2A1.2 1.2 0 0 0 2 10.2v9.1A1.2 1.2 0 0 0 3.2 20.5h13.6A1.2 1.2 0 0 0 18 19.3v-9.1A1.2 1.2 0 0 0 16.8 9H15" stroke="#1F3864" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  add:'<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2.2" y="2.2" width="17.6" height="17.6" rx="4.4" stroke="#1F3864" stroke-width="1.7"/><path d="M11 7v8M7 11h8" stroke="#B8860B" stroke-width="1.9" stroke-linecap="round"/></svg>',
  check:'<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="#1F3864" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots:'<svg width="6" height="22" viewBox="0 0 6 22" fill="none"><circle cx="3" cy="3" r="2.1" fill="#1F3864"/><circle cx="3" cy="11" r="2.1" fill="#1F3864"/><circle cx="3" cy="19" r="2.1" fill="#1F3864"/></svg>',
  down:'<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2v10" stroke="#FBF8F0" stroke-width="1.9" stroke-linecap="round"/><path d="M6 8.5l4 4 4-4" stroke="#FBF8F0" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 16.5h13" stroke="#FBF8F0" stroke-width="1.9" stroke-linecap="round"/></svg>',
  warn:'<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2.5l8.7 15.1H2.3L11 2.5z" stroke="#B5731B" stroke-width="1.7" stroke-linejoin="round"/><path d="M11 8.5v4" stroke="#B5731B" stroke-width="1.8" stroke-linecap="round"/><circle cx="11" cy="15.4" r="1.05" fill="#B5731B"/></svg>',
  logo:'<svg width="30" height="30" viewBox="0 2 40 36" fill="none" aria-hidden="true"><defs><linearGradient id="gShoham" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2D77E"/><stop offset=".5" stop-color="#C9A227"/><stop offset="1" stop-color="#8A6A12"/></linearGradient></defs><path d="M13 12 Q20 7 27 12" stroke="#C9A227" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="20" cy="9.4" r="1.9" fill="#C9A227" stroke="#6E5210" stroke-width=".6"/><ellipse cx="27" cy="21.5" rx="6.4" ry="8.6" fill="url(#gShoham)" stroke="#6E5210" stroke-width="1"/><ellipse cx="24.9" cy="18" rx="2.1" ry="3" fill="#FBEFC0" opacity=".55"/><line x1="22.3" y1="20" x2="31.7" y2="20" stroke="#6E5210" stroke-width=".65" opacity=".4"/><line x1="21.9" y1="22.4" x2="32.1" y2="22.4" stroke="#6E5210" stroke-width=".65" opacity=".4"/><line x1="22.3" y1="24.8" x2="31.7" y2="24.8" stroke="#6E5210" stroke-width=".65" opacity=".4"/><ellipse cx="13" cy="21.5" rx="6.4" ry="8.6" fill="url(#gShoham)" stroke="#6E5210" stroke-width="1"/><ellipse cx="10.9" cy="18" rx="2.1" ry="3" fill="#FBEFC0" opacity=".55"/><line x1="8.3" y1="20" x2="17.7" y2="20" stroke="#6E5210" stroke-width=".65" opacity=".4"/><line x1="7.9" y1="22.4" x2="18.1" y2="22.4" stroke="#6E5210" stroke-width=".65" opacity=".4"/><line x1="8.3" y1="24.8" x2="17.7" y2="24.8" stroke="#6E5210" stroke-width=".65" opacity=".4"/></svg>',
};
function instStep(glyph, html){
  return '<li class="pwa-step"><span class="pwa-num"></span>'+
         (glyph?'<span class="pwa-glyph">'+glyph+'</span>':'')+
         '<span class="pwa-text">'+html+'</span></li>';
}
// the second install option: a direct download of the signed Android app
function apkBlock(U){
  if(!APK_INFO || !APK_INFO.available) return '';
  const meta = [APK_INFO.version ? U.apk_ver+' '+APK_INFO.version : '',
                APK_INFO.size_mb ? APK_INFO.size_mb+' MB' : ''].filter(Boolean).join(' · ');
  // admin only: how many times the file has actually been downloaded, and when
  const tally = (ADMIN.token && APK_INFO.downloads != null)
    ? '<p class="pwa-tally">' + esc(t('apk_downloads')) + ' <b>' + APK_INFO.downloads + '</b>'
      + (APK_INFO.last_download ? ' <span>· ' + esc(t('apk_last_dl')) + ' ' + esc(APK_INFO.last_download) + '</span>' : '')
      + '</p>'
    : '';
  return '<div class="pwa-or"><span>'+U.or+'</span></div>'+
         '<p class="pwa-opt-h">'+U.apk_h+'</p>'+
         '<p class="pwa-opt-sub">'+U.apk_sub+(meta?' <span class="pwa-opt-meta">'+meta+'</span>':'')+'</p>'+
         '<a class="pwa-btn" href="/download/samaritan-torah.apk" download>'+INSTALL_ICONS.down+' '+U.apk_btn+'</a>'+
         tally +
         '<p class="pwa-hint">'+U.apk_note+'</p>';
}
function instBody(plat, L, U){
  const I = INSTALL_ICONS;
  const btn = '<button class="pwa-btn" id="pwaCardInstall">'+I.down+' '+U.install+'</button>';
  if(plat === 'installed') return '<p class="pwa-hint">'+L.already+'</p>';
  if(plat === 'ios-safari')
    return '<ul class="pwa-steps">'+instStep(I.share,L.ios[0])+instStep(I.add,L.ios[1])+instStep(I.check,L.ios[2])+
           '</ul><p class="pwa-hint">'+L.ios_only+'</p>';
  const inappSteps = '<div class="pwa-warn">'+I.warn+'<p>'+L.inapp_warn+'</p></div><ul class="pwa-steps">'+
                     instStep(I.dots,L.inapp[0])+instStep('',L.inapp[1])+instStep(I.share,L.inapp[2])+'</ul>';
  if(plat === 'ios-inapp') return inappSteps;
  if(plat === 'android' || plat === 'android-inapp'){
    // Two ways in: install from the browser, or download the signed APK. The
    // in-app browser can't do the first but downloads the second just fine, so
    // the APK is the more useful option exactly where the PWA route is blocked.
    let browserWay;
    if(plat === 'android-inapp')  browserWay = inappSteps;
    else if(deferredInstall)      browserWay = btn+'<p class="pwa-hint">'+U.hint_and+'</p>';
    else                          browserWay = '<ul class="pwa-steps">'+instStep(I.dots,L.android[0])+
                                               instStep(I.add,L.android[1])+instStep(I.check,L.android[2])+'</ul>';
    const apk = apkBlock(U);
    return apk ? '<p class="pwa-opt-h">'+U.pwa_h+'</p>'+browserWay+apk : browserWay;
  }
  if(deferredInstall) return btn+'<p class="pwa-hint">'+U.hint_desk+'</p>';      // desktop
  return '<ul class="pwa-steps">'+instStep('',L.desktop[0])+instStep('',L.desktop[1])+'</ul>';
}
function renderInstallCard(){
  const L = INSTALL_TXT[LANG] || INSTALL_TXT.he, U = INSTALL_UI[LANG] || INSTALL_UI.he, I = INSTALL_ICONS;
  const plat = installPlatform();
  const card = $('installCard');
  card.dir = LANG === 'en' ? 'ltr' : 'rtl';
  const lbtn = (c,l)=>'<button class="pwa-lang'+(LANG===c?' is-on':'')+'" data-lang="'+c+'" type="button">'+l+'</button>';
  card.innerHTML =
    '<div class="pwa-head">'+
      '<span class="pwa-mark" aria-hidden="true">'+I.logo+'</span>'+
      '<div class="pwa-titles"><p class="pwa-title">'+U.title+'</p><p class="pwa-sub">'+U.sub+'</p></div>'+
      '<button class="pwa-x" id="pwaCardClose" type="button" aria-label="'+U.close+'">×</button>'+
    '</div>'+
    '<div class="pwa-body">'+ instBody(plat, L, U) +'</div>'+
    '<div class="pwa-foot"><div class="pwa-langs">'+lbtn('he','עב')+lbtn('en','EN')+lbtn('ar','ع')+'</div>'+
      '<button class="pwa-snooze" id="pwaCardClose2" type="button">'+U.close+'</button></div>';
  $('pwaCardClose').onclick = $('pwaCardClose2').onclick = ()=>$('installModal').classList.add('hidden');
  card.querySelectorAll('.pwa-lang').forEach(b=>{ b.onclick=()=>{ setLang(b.dataset.lang); renderInstallCard(); }; });
  const ib = $('pwaCardInstall');
  if(ib) ib.onclick = async ()=>{
    if(!deferredInstall) return;
    deferredInstall.prompt();
    let outcome='dismissed'; try{ ({outcome}=await deferredInstall.userChoice); }catch(e){}
    deferredInstall = null;
    if(outcome === 'accepted') $('installModal').classList.add('hidden'); else renderInstallCard();
  };
}
function doInstall(){
  $('installModal').classList.remove('hidden');
  renderInstallCard();
  // the APK option appears as soon as its details arrive, so opening the card
  // never waits on the network
  // as an admin, always re-ask: the tally moves, and it is only in the admin answer
  if(!APK_INFO || ADMIN.token) loadApkInfo().then(renderInstallCard);
}

function showInfo(title, html){
  $('infoTitle').textContent=title; $('infoBody').innerHTML=html;
  $('infoModal').classList.remove('hidden');
}
$('infoClose').onclick=()=>$('infoModal').classList.add('hidden');

// tap a word's translation in the search results → its root from Tal's dictionary
// (with citation locations) and where it also occurs in Tibåt Mårqe and the
// Samaritan-tradition sources, in a closable window.
async function openWordSources(word){
  showInfo('מיקומים נוספים: ' + word, '<div class="note">מחפש…</div>');
  let d;
  try { d = await api('word_sources?word=' + encodeURIComponent(word)); }
  catch(e){ $('infoBody').innerHTML = '<div class="note">שגיאה בטעינה.</div>'; return; }
  let h = '';
  if(d.tal && d.tal.length){
    h += '<div class="ws-h">מילון — שורש ומיקומים</div>';
    for(const e of d.tal){
      h += `<div class="ws-item"><b>${esc(e.lemma||word)}</b>` +
           (e.pos?` <span class="pos">${esc(e.pos)}</span>`:'') +
           (e.gloss_en?` ${esc(e.gloss_en)}`:'');
      for(const c of (e.citations||[])) h += `<div class="ws-cite">${esc(c.quote)} — ${esc(c.ref||'')}</div>`;
      h += '</div>';
    }
  }
  if(d.tibat_marqe && d.tibat_marqe.length){
    h += '<div class="ws-h">תיבת מרקה</div>';
    for(const t of d.tibat_marqe)
      h += `<div class="ws-item"><b>${esc(t.label)}</b> ${esc(t.book_title)}<div class="ws-snip">${esc(t.snippet)}</div></div>`;
  }
  if(d.eyalk && d.eyalk.length){
    h += '<div class="ws-h">מן המסורת השומרונית</div>';
    for(const t of d.eyalk)
      h += `<div class="ws-item">${t.parsha?'<b>'+esc(t.parsha)+'</b>':''}<div class="ws-snip">${esc(t.snippet)}</div></div>`;
  }
  $('infoBody').innerHTML = h || '<div class="note">לא נמצאו מיקומים נוספים למילה זו.</div>';
}

// concise, organised help for all of the app's options (per language)
const HELP = {
  he: [
    ['סרטון הסבר מודרך 🎬', [
      'מומלץ להתחיל ב<b>סרטון ההסבר המודרך</b> — סיור קולי קצר שמסביר ומדגים על המערכת עצמה את כל הכפתורים והאפשרויות, עם חיצים מצביעים וכיתוב בשפת הממשק. הסיור נפתח אוטומטית בכניסה הראשונה, וניתן לחזור אליו בכל עת מ<b>תפריט ההמבורגר ← מתחת ל"עזרה" ← "סרטון הסבר מודרך"</b>. אפשר להשתיק את הקריינות (ולקרוא רק את הכיתובים), לדלג קדימה/אחורה או לסגור בכל שלב.']],
    ['חלוקה', ['בראש המסך — <b>חלוקה יהודית</b> / <b>חלוקה שומרונית</b>: מעבר בין שתי חלוקות הפרקים והפרשות.']],
    ['עיון', [
      'בחר <b>ספר → פרשה → פרק</b>, ואז מוצגים הפסוקים. <b>פריסת פרקים</b> מאפשר קפיצה לכל פרק. בחלוקה השומרונית מוצגות תחת מספר כל פרק שתי מילות הפתיחה שלו לזיהוי מהיר.',
      'שורת הניווט: <b>פרק/פרשה הבא/קודם</b> ואייקוני <b>זכוכית-מגדלת ＋ / －</b> להגדלת/הקטנת הטקסט (הזכוכיות מתעמעמות כשאין טקסט להגדיל, והזום מוגבל לטווח קריא).',
      '<b>דפדוף רציף בין פרקים</b> — פרק הבא/קודם ממשיכים גם מעבר לגבולות הפרשה; בגבול הספר הכפתור משתנה ל<b>"עבור ל&lt;שם הספר&gt;"</b> ולחיצה עליו עוברת לספר הסמוך. במצב הטקסט המעבר מלווה ב<b>אנימציית הפיכת דף</b> (בעברית: הבא ימינה, קודם שמאלה; באנגלית הפוך).',
      'הקש על <b>מספר פסוק</b> כדי לראות רק אותו; <b>נקה סינון</b> מבטל.']],
    ['מצבי תצוגה (הסרגל התחתון)', [
      'כפתורי התצוגה הם <b>קבוצת בחירה-יחידה</b>: לחיצה על כפתור מכבה אוטומטית את הקודם.',
      'במסכי הטקסט וההשוואות הסרגל <b>מתקפל מטה אוטומטית</b> לאחר כמה שניות (כפתורי הבא/קודם וההגדלה/הקטנה נשארים). חץ מהבהב וידית גרירה קטנה מסמנים שניתן <b>לגרור/להקיש על הידית</b> כדי לפתוח אותו שוב.',
      '<b>כתב שומרוני</b> (הכפתור א.ב) — מחליף בין הכתב העברי-השומרוני לכתב העברי הרגיל; הכפתור מציג א.ב בכתב שאליו עוברים. הטקסט השומרוני מיושר לשני הצדדים, ונקודות-ההפרדה הנופלות בקצה השורה מושמטות וחוזרות כשמקטינים את הטקסט.',
      '<b>תרגומי התורה</b> — כפתור אחד הפותח בחירה: תרגום ארמי · ערבי · אנגלי. לחיצה חוזרת חוזרת לטקסט.',
      '<b>פירוש הפסוק</b> — נפתח ב<b>פאנל שמתחת לטקסט</b> (כמו "ממקור שומרון"), ובו פירוש רציף לכל פסוק הבנוי אך ורק מן המקורות השומרוניים (תרגום ארמי שומרוני, תיבת מרקה, פירוש צדקה אל-חכים, סוד הלבבות, שו"ת יעקב בן אהרן הכהן ועוד) וממילון המילים — לעולם לא מפרשנות יהודית. <b>דברים בשם אומרם</b>: כל נקודה הנשענת על מקור נקוב-שם מובאת בשמו. מכסה את בראשית, שמות, ויקרא ובמדבר; בפרק שאין לו חומר פרשני מיוחד הפירוש קצר ונשען על התרגום והמילון בלבד — מוטב קצר ומבוסס ממומצא.',
      'בכותרת פאנל הפירוש שני מתגים: <b>כתב שומרוני</b> — מציג את הפירוש בכתב השומרוני הרהוט, בלי לשנות את הטקסט שמעליו; ו<b>ערבית</b> — מציג תרגום ערבי מקצועי של הפירוש, שבו ציטוטי המקרא נשמרים בכתב העברי והייחוסים נשמרים כלשונם. בתחתית הפאנל קישורי הרחבה: <b>ממקור שומרון</b>, <b>פרשנות יהודית</b> ו<b>מילון מילים</b>.',
      '<b>השוואה לנ.מסורה</b> — נוסח שומרון מול המסורה (וגם מול תרגום השבעים), עם סימון ההבדלים באדום.',
      '<b>חילופי נוסח</b> — חילופי הנוסח (העיצוריים) ממהדורת פון גאל, לכל חמשת חומשי התורה. <b>המילים שיש להן חילופי נוסח מודגשות בפסוק</b> — לחיצה על מילה קופצת לחילופיה, ולחיצה על חילוף חוזרת אל המילה בשורת הטקסט. ליד חילופים שתועדו להם עדי-נוסח מוצגים תיאור כתב-היד ותארוכו (כרגע לבראשית א׳).',
      '<b>פרשנות יהודית</b> — רש"י, רמב"ן, קאסוטו, בעל הטורים ועוד, מאתר ספריא.',
      '<b>ממקור שומרון</b> — כל מקורות הפרשנות השומרוניים, והפאנל קופץ מעלה ומציג את כל הקיימים לפרק/לפסוק: <b>תיבת מרקה</b> · <b>מן המסורת השומרונית</b> (כולל השו"ת של יעקב בן אהרן הכהן, ופרשנויות בשם פנחס בן אברהם הכהן ואלעזר בן צדקה הכהן) · <b>פירוש צדקה אל-חכים</b> · <b>סוד הלבבות</b>.',
      '<b>מילון מילים</b> — טבלה לכל מילה: המילה · ארמי · פירוש עברי · ערך במילון · ערבית. הפירוש נקרא מתוך מילון הארמית השומרונית. <b>חץ ⬆ ליד התרגום הארמי מציין תוצאות נוספות</b> — לחיצה על שורה פותחת את הפירוש המלא מהמילון, מופעי המילה בתורה, וצורות נוספות.',
      '<b>שתף</b> — וואטסאפ, אימייל או פייסבוק.']],
    ['הדפסה ושמירה כ-PDF 🖨️', [
      'בשורת הניווט שמעל הטקסט יש <b>סמל מדפסת</b> — הוא מכין את הפרק להדפסה או לשמירה כקובץ PDF, עם כותרת הנושאת את שם הספר, הפרשה, מספר הפרק ומילות הפתיחה שלו.',
      'בחלון ההדפסה בוחרים גופן — <b>שומרוני</b> או <b>עברי</b> — והבחירה חלה על כל הדף, הפירוש בכלל זה. מסמנים מה לצרף: <b>פירוש הפסוק</b>, <b>מילון מילים</b> ו<b>תרגום</b>. במצב תרגום מודפסות שתי עמודות זו לצד זו — המקור מימין והתרגום משמאל.',
      'הדף הוא הטקסט ופירושיו בלבד: הפירוש בא מיד מתחת לפרק שלו, המילון אחריו, וכל אחד מהם מופרד בקו ולא ממוסגר. מסגרת האפליקציה, שורת ההאזנה והכפתורים אינם מודפסים — לא מן התצוגה המקדימה, לא מכפתור ההדפסה ולא מהדפסה של הדפדפן עצמו (Ctrl+P).',
      '<b>הסר מספרי פסוק</b> — מדפיס את הפרק ברצף אחד, בלי קפיצת שורה לכל פסוק ועם יישור לשני הצדדים. האפשרות רלוונטית לגופן השומרוני; במצב תרגום המספור נשמר.',
      '<b>תצוגה מקדימה</b> — מציגה את גיליון ה-A4 עצמו, בגודלו האמיתי ובגודל הכתב שיודפס בפועל, לפני ששולחים למדפסת.',
      'גם ליחידות הספרייה יש <b>סמל מדפסת</b> בראש היחידה, ועל אותו גיליון: בספרים — הפרק הפתוח בשפה הפתוחה, ובעמוד התוכן — תוכן העניינים; בפיוטים — הפיוט על שורותיו, ואם מילון המילים פתוח גם פירושי המילים; באישים — הערך הפתוח או רשימת השמות כפי שסוננה; ובמילון ובמציאת החרוזים — התוצאות שנמצאו.']],
    ['במחשב ובנייד', [
      'במסכי מחשב האפליקציה <b>פרושה על מלוא המסך</b>. הטקסט עצמו נשמר ברוחב קריא וממורכז, והמקום הנוסף מנוצל לרשתות הפרקים, להשוואות ולספרייה — כך שאין שורות ארוכות מדי לקריאה. בנייד ובטאבלט התצוגה נשארת כשהייתה.',
      'אם המערכת בעדכון והשרת אינו זמין לרגע, מוצג מסך <b>"אנו מעדכנים את המערכת"</b>, והאפליקציה חוזרת מעצמה כשהשרת שב.']],
    ['חיפוש', [
      'הקלד מילה ולחץ <b>חפש</b>. יש כפתור <b>❔ עזרה לחיפוש</b> עם מדריך מפורט.',
      '<b>תווים כלליים:</b> <b>?</b> = תו אחד · <b>*</b> = מחרוזת · <b>+</b> = כל המילים באותו פסוק.',
      '<b>חיפוש מתקדם:</b> מדויק · לפי שורש · בתרגום הארמי · התעלם מסופיות · הצג פירוש המילים.',
      'כשהאפשרות <b>הצג פירוש המילים</b> דלוקה, מתחת לכל תוצאה מודגש הפירוש מתוך המילון, וניתן ללחוץ עליו לקבלת הערך המדויק מהמילון.']],
    ['ציר הזמן ההיסטורי השומרוני 🕰️', [
      'בתפריט, מעל הספרייה, נפתח <b>ציר זמן אינטראקטיבי</b> מבריאת העולם ועד ימינו — בתוך האפליקציה עצמה, וכפתור <b>↩ התורה</b> מחזיר לטקסט בדיוק למקום שבו היית.',
      'גרירת הציר, הגלגלת או החצים מזיזות בזמן; <b>Ctrl</b> עם הגלגלת, הכפתורים + ו-− או המחוון משנים את קנה המידה; והסרגל האנכי שמן הצד מראה איזה חלק מן הציר כולו מוצג כרגע.',
      'ה<b>שכבות</b> נדלקות ונכבות לפי העניין — תולדות השומרונים, עם ישראל ויהודה, ימי המקרא, העולם והשלטונות, ואישים וחוקרים — ולצדן <b>רצועות</b> של נושאי משרה: הכהנים הגדולים לדורותיהם, ראשי הממשלה והנשיאים.',
      'הקו הזהוב הקבוע הוא <b>נקודת ה-0</b>: הציר חולף תחתיו, ולידו נקראות בבת אחת השנה הגרגוריאנית, השנה לבריאת העולם, השנה לכניסה לארץ כנען, ושמו של הכהן הגדול שכיהן אז.',
      'ב<b>חיפוש</b> אפשר להקליד אירוע, אישיות או שנה בכל אחד משלושת המניינים; לחיצה על אירוע פותחת כרטיס עם התיאור המלא ומקורו; וכפתור <b>מסע</b> (או מקש הרווח) מניע את הציר מאליו.']],
    ['הספרייה השומרונית', [
      'בתפריט, תחת <b>הספרייה השומרונית</b>, נמצא <b>המילון הארמי-עברי השומרוני</b> — אפליקציית מילון: הקלד מילה בארמית (או שורש) וקבל את שורשה, פירושה העברי מתוך המילון, ומופעיה בתורה.',
      'הספרייה נפתחת כעמוד כרטיסיות, וכל יחידה מצוירת ככריכת ספר בצבע משלה ששמו כתוב עליה. יש בה גם ספרי עיון מלאים, קריאת פיוטים ומציאת חרוזים.',
      '<b>אישים וחוקרים שומרוניים</b> — 95 דמויות מתקופת המקרא ועד ימינו, כל אחת עם הסבר על מקומה במסורת השומרונית. הרשימה נפרשת <b>לפי תקופה</b> או <b>לפי א״ב</b>, והחיפוש רץ גם על גוף ההסברים — בעברית, באנגלית ובערבית. לצד כל אישיות מובאים שמה בשלוש השפות, תקופתה ומקורה.']],
    ['מסך פתיחה והתקנה', [
      'בכניסה מוצג מסך פתיחה שבו יד כותבת את הפסוק בכתב השומרוני (עם צליל כתיבה — ניתן להפעילו בכפתור 🔊). <b>דלג ›</b> מדלג עליו; במכשיר שבו האפליקציה מותקנת מופיע גם <b>דלג תמיד</b> שנכנס ישר לאפליקציה בפעמים הבאות.',
      'בכניסה הראשונה מוצג חלון <b>ברוכים הבאים</b>. אם האפליקציה אינה מותקנת תוצע <b>התקנה</b>, ואם ההתראות לא אושרו עדיין תוצע אפשרות <b>לאשר התראות</b> על חידושים ועדכוני גרסה — לכל הצעה יש <b>אל תציג שוב</b>.']],
    ['תפריט', [
      '<b>התקנת אפליקציה</b> · <b>שנה שפה</b> · לוח השנה השומרוני · אילן היוחסין · <b>הספרייה השומרונית → המילון הארמי-עברי השומרוני</b> · <b>סרטון הסבר מודרך</b> (מתחת לעזרה) · עזרה · גרסה · צור קשר.']],
  ],
  en: [
    ['Guided tour 🎬', [
      'A great place to start is the <b>guided tour</b> — a short voiced walkthrough that explains and demonstrates every button and option on the app itself, with pointing arrows and captions in your language. It opens automatically on your first visit, and you can return to it any time from the <b>menu → under “Help” → “Guided tour”</b>. You can mute the narration (and just read the captions), step forward/back, or close it at any point.']],
    ['Division', ['At the top — <b>Jewish division</b> / <b>Samaritan division</b>: switch between the two chapter/portion divisions.']],
    ['Browse', [
      'Choose <b>book → portion → chapter</b> to show the verses. <b>All chapters</b> jumps to any chapter. In the Samaritan division each chapter cell also shows its opening two words.',
      'Navigation bar: <b>next / previous chapter & portion</b> and <b>magnifier ＋ / －</b> icons for text size (the magnifiers dim when there is no text to resize, and zoom is capped to a readable range).',
      '<b>Continuous chapter paging</b> — next / previous keep going across portion boundaries; at a book edge the button changes to <b>“Go to &lt;book&gt;”</b> and tapping it moves to the adjacent book. In text mode the move is accompanied by a <b>page-turn animation</b> (Hebrew: next turns right, previous left; English reversed).',
      'Tap a <b>verse number</b> to see only it; <b>clear filter</b> resets.']],
    ['Display modes (bottom bar)', [
      'The display buttons are a <b>single-select group</b>: tapping one turns the previous off.',
      'On the text/comparison screens the bar <b>auto-collapses</b> after a few seconds (next/prev and zoom stay). A blinking arrow and a small grip show that you can <b>drag/tap the handle</b> to reopen it.',
      '<b>Samaritan script</b> (the א.ב button) — switches between the Samaritan-Hebrew and ordinary Hebrew scripts; the button shows an A-B in the script you switch to. The Samaritan text is justified to both edges, and separator dots that fall at a line break are dropped (and return when the text is made smaller).',
      '<b>Torah translations</b> — one button opening a choice: Aramaic · Arabic · English. Tapping it again returns to the text.',
      '<b>Verse commentary</b> — opens in a <b>panel beneath the text</b> (like Samaritan sources), with a flowing commentary on each verse built only from the Samaritan sources (the Samaritan Aramaic targum, Tibåt Mårqe, Ṣadaqah al-Ḥakīm, Sirr al-Qulūb, the responsa of Jacob ben Aaron and more) and the word dictionary — never from Jewish commentary. Every point resting on a named source is <b>credited to it by name</b>. It covers Genesis, Exodus, Leviticus and Numbers; where a chapter has no dedicated commentary material the note is short and rests on the targum and dictionary alone.',
      'The panel header carries two switches: <b>Samaritan script</b> renders the commentary in the fluent Samaritan face, leaving the verse text above it as it was; <b>Arabic</b> shows a professional Arabic rendering in which scriptural quotations stay in Hebrew letters and the attributions are preserved. At the foot of the panel are links onward to <b>Samaritan sources</b>, <b>Jewish commentary</b> and the <b>word dictionary</b>.',
      '<b>Compare to Masorah</b> — Samaritan vs. Masoretic text (and vs. the Septuagint), with the differences marked in red.',
      '<b>Textual variants</b> — the (consonantal) variants from von Gall’s edition, for the whole Torah. <b>Words that carry a variant are emphasised in the verse</b> — tap a word to jump to its variants, tap a variant to jump back to the word. Where witnesses are recorded, each one shows its manuscript and date (currently Genesis 1).',
      '<b>Jewish commentary</b> — Rashi, Ramban, Cassuto, Baal ha-Turim and more, from Sefaria.',
      '<b>Samaritan sources</b> — all the Samaritan commentary sources (the panel scrolls up to show every one available for the chapter/verse): <b>Tībåt Mårqe</b> · <b>the Samaritan tradition</b> (incl. the responsa of Jacob ben Aaron, and pieces by Phinehas ben Abraham and Eleazar ben Tsedaka) · <b>Ṣadaqah al-Ḥakīm’s commentary</b> · <b>Sīr al-Qulūb</b>.',
      '<b>Word dictionary</b> — a table per word: word · Aramaic · Hebrew meaning · dictionary entry · Arabic. The meaning is read from the Samaritan Aramaic dictionary. <b>A ⬆ arrow by the Aramaic marks more results</b> — tap a row for the full entry, the word’s Torah occurrences and related forms.',
      '<b>Share</b> — WhatsApp, email or Facebook.']],
    ['Printing and saving as PDF 🖨️', [
      'The navigation row above the text carries a <b>printer icon</b>: it lays the chapter out for printing or for saving as a PDF, with a header naming the book, the portion, the chapter number and its opening words.',
      'In the print dialog you choose a font — <b>Samaritan</b> or <b>Hebrew</b> — and that choice governs the whole sheet, the commentary included. Then tick what to include: the <b>verse commentary</b>, the <b>word dictionary</b> and a <b>translation</b>. In translation mode the page prints as two columns side by side — the original on the right, the translation on the left.',
      'The sheet carries the text and its commentaries, nothing else: the commentary comes directly beneath the chapter it belongs to, the dictionary after it, each set off by a rule rather than boxed. The app frame, the reading bar and the buttons are never printed — not from the preview, not from the print button, and not from the browser\'s own Ctrl+P.',
      '<b>Drop verse numbers</b> prints the chapter as continuous text, without a line break per verse and justified on both sides. It applies to the Samaritan font; in translation mode the numbering is kept.',
      '<b>Preview</b> shows the A4 sheet itself, at its true size and at the type size that will actually be printed, before anything is sent to the printer.',
      'The library units carry a <b>printer icon</b> in their own header, printing onto the same sheet: for the books, the open chapter in the open language — or, on the contents page, the contents; for the piyyutim, the poem with its lines, and the word glosses too if the dictionary is open; for the figures, the open entry or the list of names as filtered; and for the dictionary and the rhyme finder, the results they found.']],
    ['On desktop and on mobile', [
      'On desktop screens the app <b>fills the whole screen</b>. The text itself stays at a readable width and centred, while the extra room goes to the chapter grids, the comparison views and the library — so lines never stretch too long to read. On phones and tablets the layout is unchanged.',
      'If the system is being updated and the server is briefly unavailable, a <b>“We are updating the system”</b> screen appears, and the app returns by itself once the server is back.']],
    ['Search', [
      'Type a word and tap <b>Search</b>. A <b>❔ Search help</b> button gives a detailed guide.',
      '<b>Wildcards:</b> <b>?</b> = one letter · <b>*</b> = a string · <b>+</b> = all words in the same verse.',
      '<b>Advanced search:</b> exact · by root · in the Aramaic · ignore final letters · show word meanings.',
      'With <b>show word meanings</b> on, each result shows the meaning from the dictionary, clickable for the exact entry.']],
    ['The Samaritan Historical Timeline 🕰️', [
      'Above the library the menu opens an <b>interactive timeline</b> from the creation of the world to our own day — inside the app itself, with <b>↩ התורה</b> returning you to the text exactly where you left it.',
      'Drag the axis, or use the wheel and the arrows, to move in time; <b>Ctrl</b> with the wheel, the + and − buttons or the slider change the scale; and the vertical rail at the side shows which part of the whole is on screen.',
      'The <b>layers</b> switch on and off as you please — Samaritan history, Israel and Judah, the biblical age, the world and its rulers, and figures and scholars — beside <b>bands</b> of office-holders: the high priests through the generations, the prime ministers and the presidents.',
      'The fixed golden line is the <b>zero point</b>: the timeline passes beneath it, and beside it you read at once the Gregorian year, the year from the creation of the world, the year from the entry into Canaan, and the high priest who served then.',
      '<b>Search</b> takes an event, a person or a year in any of the three reckonings; tapping an event opens a card with the full description and its source; and <b>Journey</b> (or the space bar) sets the timeline moving.']],
    ['The Samaritan Library', [
      'In the menu, under <b>The Samaritan Library</b>, is <b>The Samaritan Aramaic–Hebrew Dictionary</b> — type an Aramaic word (or root) to get its root, its Hebrew meaning from the dictionary, and its Torah occurrences.',
      'The library opens as a page of cards: every unit is drawn as a book binding in its own colour, with its title written on the cover. It also holds full reading editions, the piyyutim reader and the rhyme finder.',
      '<b>Samaritan Figures and Scholars</b> — 95 figures from the biblical era to our own day, each with an account of its place in the Samaritan tradition. The list can be laid out <b>by period</b> or <b>A–Z</b>, and the search runs over the accounts themselves too — in Hebrew, English and Arabic. Each entry carries the name in all three languages, its period and its source.']],
    ['Entry splash & install', [
      'On entry a splash shows a hand writing the verse in Samaritan script (with a writing sound — tap 🔊 to enable it). <b>Skip ›</b> skips it; on the installed app an <b>Always skip</b> option goes straight in next time.',
      'On the first visit a <b>Welcome</b> window appears. If the app isn’t installed you’ll be offered to <b>install</b> it, and if notifications aren’t enabled yet you’ll be offered to <b>allow notifications</b> about new features and versions — each prompt has a <b>Don’t show again</b> option.']],
    ['Menu', [
      '<b>Install app</b> · <b>Change language</b> · Samaritan calendar · genealogy · <b>The Samaritan Library → the Aramaic–Hebrew dictionary</b> · <b>Guided tour</b> (under Help) · help · version · contact.']],
  ],
  ar: [
    ['جولة إرشادية 🎬', [
      'من الأفضل أن تبدأ بـ<b>الجولة الإرشادية</b> — جولة صوتية قصيرة تشرح وتعرض على التطبيق نفسه كلّ الأزرار والخيارات، مع أسهم مؤشِّرة وتعليقات بلغة الواجهة. تُفتح تلقائياً في أوّل زيارة، ويمكنك العودة إليها في أيّ وقت من <b>القائمة ← تحت «مساعدة» ← «جولة إرشادية»</b>. يمكنك كتم الصوت (وقراءة التعليقات فقط)، أو التقدّم/الرجوع، أو الإغلاق في أيّ لحظة.']],
    ['التقسيم', ['في الأعلى — <b>التقسيم اليهودي</b> / <b>التقسيم السامري</b>: التبديل بين تقسيمَي الأصحاحات والمقاطع.']],
    ['التصفّح', [
      'اختر <b>سفر ← مقطع ← أصحاح</b> لعرض الآيات. <b>كل الأصحاحات</b> للانتقال إلى أيّ أصحاح. في التقسيم السامري يظهر تحت رقم كلّ أصحاح أوّل كلمتين منه.',
      'شريط التنقّل: <b>الأصحاح/المقطع التالي والسابق</b> وأيقونتا <b>عدسة مكبّرة ＋ / －</b> لحجم النصّ (تخفت العدسات عند غياب نصّ للتكبير، والتكبير محدود بمدى مقروء).',
      '<b>تصفّح متّصل بين الأصحاحات</b> — التالي/السابق يستمرّان حتى عبر حدود المقطع؛ وعند حدّ السفر يتغيّر الزرّ إلى <b>«الانتقال إلى &lt;السفر&gt;»</b> والضغط عليه ينقلك إلى السفر المجاور. في وضع النصّ يرافق الانتقالَ <b>تأثير قلب صفحة</b> (بالعبرية: التالي يميناً والسابق يساراً؛ وبالإنجليزية بالعكس).',
      'اضغط على <b>رقم الآية</b> لعرضها وحدها؛ <b>مسح التصفية</b> يلغي ذلك.']],
    ['أوضاع العرض (الشريط السفلي)', [
      'أزرار العرض <b>مجموعة اختيار واحد</b>: الضغط على زرّ يُطفئ السابق تلقائياً.',
      'في شاشات النصّ والمقارنات <b>يُطوى الشريط تلقائياً</b> بعد بضع ثوانٍ (يبقى التالي/السابق والتكبير/التصغير). سهم وامض ومقبض صغير يدلّان على أنّه يمكن <b>سحب/الضغط على المقبض</b> لإعادة فتحه.',
      '<b>الخط السامري</b> (الزرّ ࠀࠁ / אب) — يبدّل بين الخطّ العبري-السامري والعبري العادي؛ يعرض الزرّ أ.ب بالخطّ الذي ستنتقل إليه. النصّ السامري مضبوط على الحافّتين، ونقاط الفصل التي تقع في نهاية السطر تُحذف وتعود عند تصغير النصّ.',
      '<b>ترجمات التوراة</b> — زرّ واحد يفتح اختياراً: آرامية · عربية · إنجليزية. الضغط ثانيةً يعيد إلى النصّ.',
      '<b>تفسير الآية</b> — يُفتح في <b>لوحة تحت النصّ</b> (مثل «مصادر سامرية»)، وفيها تفسير متصل لكلّ آية مبنيّ على المصادر السامرية وحدها (الترجوم الآرامي السامري، تيبات مارقه، تفسير صدقة الحكيم، سرّ القلوب، مسائل يعقوب بن هارون وغيرها) وعلى معجم الكلمات — وليس من التفسير اليهودي أبداً. وكلّ نقطة تستند إلى مصدر مسمّى <b>تُنسَب إليه</b>. يغطّي التكوين والخروج واللاويين والعدد.',
      'في عنوان اللوحة مفتاحان: <b>الخطّ السامري</b> يعرض التفسير بالخطّ السامري المتصل دون تغيير النصّ فوقه؛ و<b>العربية</b> تعرض ترجمة عربية محترفة تبقى فيها اقتباسات التوراة بالحروف العبرية وتُحفَظ النسبة إلى قائليها. وفي أسفل اللوحة روابط: <b>مصادر سامرية</b> و<b>تفسير يهودي</b> و<b>معجم الكلمات</b>.',
      '<b>مقارنة بالنصّ الماسوري</b> — النصّ السامري مقابل الماسوري مع تمييز الفروق بالأحمر.',
      '<b>اختلافات النصّ</b> — الاختلافات (الحرفية الساكنة) من طبعة فون غال، لكامل التوراة. <b>الكلمات التي لها اختلاف مميّزة في الآية</b> — اضغط كلمة للانتقال إلى اختلافاتها، واضغط اختلافاً للعودة إلى الكلمة. وحيث تُذكر الشهود يظهر لكلّ شاهد وصف المخطوطة وتاريخها (حالياً التكوين ١).',
      '<b>تفسير يهودي</b> — راشي، رمبان، كاسوتو، بعل هاطوريم وغيرهم من موقع سفاريا.',
      '<b>مصادر سامرية</b> — كلّ مصادر التفسير السامرية (تنتقل اللوحة للأعلى لعرض كلّ المتوفّر للأصحاح/الآية): <b>تيبات مارقه</b> · <b>التقليد السامري</b> (يشمل مسائل يعقوب بن هارون، ونصوصاً لفنحاس بن إبراهيم وألعازار بن صدقة) · <b>تفسير صدقة الحكيم</b> · <b>سرّ القلوب</b>.',
      '<b>معجم الكلمات</b> — جدول لكلّ كلمة: الكلمة · الآرامية · المعنى العبري · مدخل المعجم · العربية. المعنى مأخوذ من المعجم. <b>السهم ⬆ بجانب الآرامية يدلّ على نتائج إضافية</b> — اضغط الصفّ للمدخل الكامل ومواضع الكلمة في التوراة والصيغ المتعلّقة.',
      '<b>مشاركة</b> — واتساب، بريد إلكتروني أو فيسبوك.']],
    ['الطباعة والحفظ كـ PDF 🖨️', [
      'في شريط التنقّل فوق النصّ <b>رمز طابعة</b> يهيئ الأصحاح للطباعة أو للحفظ كملفّ PDF، مع عنوان يحمل اسم السفر والفصل ورقم الأصحاح وكلماته الافتتاحية.',
      'في نافذة الطباعة تختار الخطّ — <b>السامري</b> أو <b>العبري</b> — ويسري الاختيار على الورقة كلّها، والتفسير منها. ثمّ تحدّد ما ترفقه: <b>تفسير الآية</b>، و<b>معجم الكلمات</b>، و<b>ترجمة</b>. وفي وضع الترجمة تُطبع عمودان متجاوران — الأصل يميناً والترجمة يساراً.',
      'الورقة نصٌّ وتفاسيره لا غير: التفسير يأتي تحت أصحاحه مباشرة، والمعجم بعده، ويفصل بينهما خطّ لا إطار. أمّا هيكل التطبيق وشريط الاستماع والأزرار فلا تُطبع — لا من المعاينة، ولا من زرّ الطباعة، ولا من طباعة المتصفّح نفسه (Ctrl+P).',
      '<b>إزالة أرقام الآيات</b> تطبع الأصحاح نصّاً متصلاً دون كسر سطر عند كلّ آية ومضبوطاً من الجهتين؛ وهي تخصّ الخطّ السامري، وفي وضع الترجمة تبقى الأرقام.',
      '<b>المعاينة</b> تعرض ورقة A4 نفسها بحجمها الحقيقي وبحجم الخطّ الذي سيُطبع فعلاً، قبل إرسالها إلى الطابعة.',
      'ولوحدات المكتبة <b>رمز طابعة</b> في أعلى كلّ وحدة، وعلى الورقة نفسها: في الكتب — الأصحاح المفتوح باللغة المفتوحة، وفي صفحة المحتويات — المحتويات؛ وفي القصائد — القصيدة بأسطرها، ومعها شروح الكلمات إن كان المعجم مفتوحاً؛ وفي الأعلام — المدخل المفتوح أو قائمة الأسماء كما رُشِّحت؛ وفي المعجم وباحث القوافي — النتائج التي وُجدت.']],
    ['على الحاسوب وعلى الهاتف', [
      'على شاشات الحاسوب <b>يملأ التطبيق الشاشة كلّها</b>. ويبقى النصّ نفسه بعرض مريح للقراءة وفي الوسط، بينما تذهب المساحة الزائدة إلى شبكات الأصحاحات والمقارنات والمكتبة — فلا تطول السطور أكثر ممّا يُقرأ. أمّا على الهواتف والأجهزة اللوحية فالعرض كما كان.',
      'وإذا كان النظام قيد التحديث والخادم غير متاح للحظات، تظهر شاشة <b>«نحن نحدّث النظام»</b> ويعود التطبيق تلقائياً عند عودة الخادم.']],
    ['البحث', [
      'اكتب كلمة واضغط <b>بحث</b>. يوجد زرّ <b>❔ مساعدة البحث</b> بدليل مفصّل.',
      '<b>أحرف عامة:</b> <b>?</b> = حرف واحد · <b>*</b> = سلسلة · <b>+</b> = كلّ الكلمات في الآية نفسها.',
      '<b>بحث متقدم:</b> تطابق تامّ · حسب الجذر · في الآرامية · تجاهل النهائية · إظهار المعاني.',
      'عند تفعيل <b>إظهار المعاني</b>، يظهر تحت كلّ نتيجة المعنى من المعجم، ويمكن الضغط عليه للمدخل الدقيق.']],
    ['الخطّ الزمني التاريخي السامري 🕰️', [
      'فوق المكتبة تفتح القائمة <b>خطّاً زمنيّاً تفاعليّاً</b> من خلق العالم إلى أيّامنا — داخل التطبيق نفسه، وزرّ <b>↩ התורה</b> يعيدك إلى النصّ في الموضع الذي تركته.',
      'سحب الخطّ أو العجلة أو الأسهم يحرّك الزمن؛ و<b>Ctrl</b> مع العجلة أو الزرّان + و− أو المؤشّر تغيّر المقياس؛ والشريط العمودي جانباً يبيّن أيّ جزء من الخطّ كلّه معروض الآن.',
      'تُطفأ <b>الطبقات</b> وتُشعل حسب الحاجة — تاريخ السامريين، وبنو إسرائيل ويهوذا، وأيّام المقرأ، والعالم والحكّام، والأعلام والباحثون — وإلى جانبها <b>أشرطة</b> أصحاب المناصب: الكهنة الكبار عبر الأجيال، ورؤساء الحكومة، والرؤساء.',
      'الخطّ الذهبي الثابت هو <b>نقطة الصفر</b>: يمرّ الزمن تحته، وتُقرأ عنده معاً السنة الميلادية، والسنة لخلق العالم، والسنة لدخول أرض كنعان، واسم الكاهن الأكبر الذي خدم حينها.',
      'ويقبل <b>البحث</b> حدثاً أو شخصية أو سنة بأيّ من التقاويم الثلاثة؛ والضغط على حدث يفتح بطاقة بالوصف الكامل ومصدره؛ وزرّ <b>رحلة</b> (أو مفتاح المسافة) يُسيّر الخطّ من تلقائه.']],
    ['المكتبة السامرية', [
      'في القائمة، ضمن <b>المكتبة السامرية</b>، يوجد <b>المعجم الآرامي-العبري السامري</b> — اكتب كلمة آرامية (أو جذراً) لتحصل على جذرها ومعناها العبري من المعجم ومواضعها في التوراة.',
      'تُفتح المكتبة كصفحة بطاقات، وكلّ وحدة مرسومة كغلاف كتاب بلونه الخاصّ واسمه مكتوب عليه. وفيها أيضاً كتب كاملة للمطالعة، وقراءة الأناشيد، وإيجاد القوافي.',
      '<b>أعلام وباحثون سامريّون</b> — 95 شخصية من العصر التوراتي حتى يومنا، ولكلّ واحدة شرح لمكانتها في التقليد السامري. تُعرض القائمة <b>حسب الحقبة</b> أو <b>حسب الأبجدية</b>، والبحث يجري في متن الشروح أيضاً — بالعبرية والإنجليزية والعربية. ويرد مع كلّ شخصية اسمها باللغات الثلاث وحقبتها ومصدرها.']],
    ['شاشة الدخول والتثبيت', [
      'عند الدخول تظهر شاشة بداية فيها يد تكتب الآية بالخطّ السامري (مع صوت كتابة — اضغط 🔊 لتفعيله). <b>تخطٍّ ›</b> يتخطّاها؛ وعلى التطبيق المثبّت يظهر <b>تخطٍّ دائماً</b> للدخول مباشرةً في المرّات التالية.',
      'في أوّل زيارة تظهر نافذة <b>ترحيب</b>. إن لم يكن التطبيق مثبّتاً يُقترح <b>تثبيته</b>، وإن لم تُفعّل الإشعارات بعد يُقترح <b>السماح بالإشعارات</b> حول الميزات والإصدارات الجديدة — ولكلّ اقتراح خيار <b>لا تُظهر مرّة أخرى</b>.']],
    ['القائمة', [
      '<b>تثبيت التطبيق</b> · <b>تغيير اللغة</b> · التقويم السامري · شجرة الأنساب · <b>المكتبة السامرية ← المعجم الآرامي-العبري</b> · <b>جولة إرشادية</b> (تحت مساعدة) · مساعدة · الإصدار · اتصل بنا.']],
  ],
};
function showHelp(){
  let h = '';
  for(const [title, items] of (HELP[LANG] || HELP.he)){
    h += `<div class="help-h">${title}</div><ul class="help-list">`;
    for(const it of items) h += `<li>${it}</li>`;
    h += '</ul>';
  }
  showInfo(t('help_title'), h);
}

// focused, accurate help for the search screen (every option + examples)
const SEARCH_HELP = {
  he: [
    ['חיפוש בסיסי', [
      'הקלד מילה (או חלק ממילה) ולחץ <b>חפש</b>. נמצאים כל הפסוקים שהמילה מופיעה בהם — גם כחלק ממילה. לדוגמה: <b>אלה</b> תמצא גם אלהים, האלה.',
      'כל תוצאה מציגה את מיקום הפסוק ב<b>חלוקה היהודית</b> וב<b>שומרונית</b> (לחיצה קופצת לפסוק), את הטקסט עם המילה <b>מודגשת</b>, ואת ההגייה.']],
    ['תווים כלליים', [
      '<b>?</b> — תו אחד כלשהו. <b>א?ר</b> מוצא אור, אמר, עבר.',
      '<b>????</b> (רק ?) — מילים שלמות באורך המדויק (כאן 4 אותיות).',
      '<b>*</b> — מחרוזת לא ידועה. <b>כא*</b> = מתחיל בכא · <b>*כא</b> = מסתיים · <b>*כא*</b> = מכיל.',
      '<b>+</b> — וגם: כל המילים באותו פסוק. <b>אור+חשך</b>.',
      'הערה: <b>?</b> / <b>*</b> / <b>+</b> גוברים על דגלי החיפוש המתקדם ופועלים תמיד.']],
    ['חיפוש מתקדם — מה כל דגל עושה', [
      '<b>חיפוש מדויק</b> — רק המילה השלמה, לא כחלק ממילה. <b>אל</b> → רק "אל".',
      '<b>לפי שורש המילה</b> — כל הנטיות של השורש. <b>ברא</b> → ברא, בורא, נברא. למילה אחת.',
      '<b>חפש בתרגום הארמי</b> — מחפש בתרגום הארמי במקום בעברי.',
      '<b>התעלם מסופיות</b> — ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ. <b>הציף</b> = הציפ.',
      '<b>הצג פירוש המילים</b> — מתחת לתוצאה: תרגום ארמי, ערך במילון, ופירוש עברי.',
      '<b>אישור</b> — מריץ את החיפוש עם הדגלים שבחרת.']],
  ],
  en: [
    ['Basic search', [
      'Type a word (or part of one) and tap <b>Search</b>. All verses containing it are found — also as part of a longer word. E.g. <b>אלה</b> also finds אלהים, האלה.',
      'Each result shows the verse location in the <b>Jewish</b> and <b>Samaritan</b> divisions (tap to jump), the text with the word <b>highlighted</b>, and the pronunciation.']],
    ['Wildcards', [
      '<b>?</b> — any single letter. <b>א?ר</b> finds אור, אמר, עבר.',
      '<b>????</b> (only ?) — whole words of that exact length (here, 4 letters).',
      '<b>*</b> — an unknown string. <b>כא*</b> = starts with כא · <b>*כא</b> = ends · <b>*כא*</b> = contains.',
      '<b>+</b> — AND: all words in the same verse. <b>אור+חשך</b>.',
      'Note: <b>?</b> / <b>*</b> / <b>+</b> override the advanced flags and always run a pattern search.']],
    ['Advanced search — what each flag does', [
      '<b>Exact match</b> — only the whole word, not as part of a word. <b>אל</b> → only "אל".',
      '<b>By word root</b> — all inflections of the root. <b>ברא</b> → ברא, בורא, נברא. Single word only.',
      '<b>Search the Aramaic</b> — searches the Aramaic translation instead of the Hebrew.',
      '<b>Ignore final letters</b> — ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ. <b>הציף</b> = הציפ.',
      '<b>Show word meanings</b> — under each result: Aramaic translation, dictionary entry, and a Hebrew meaning.',
      '<b>Apply</b> — runs the search with the chosen flags.']],
  ],
  ar: [
    ['البحث الأساسي', [
      'اكتب كلمة (أو جزءاً منها) واضغط <b>بحث</b>. تُعرض كلّ الآيات التي تحوي الكلمة — حتى كجزء من كلمة أطول. مثال: <b>אלה</b> يجد أيضاً אלהים، האלה.',
      'تُظهر كلّ نتيجة موضع الآية في <b>التقسيم اليهودي</b> و<b>السامري</b> (اضغط للانتقال)، والنصّ مع <b>تمييز</b> الكلمة، واللفظ.']],
    ['الأحرف العامة', [
      '<b>?</b> — أيّ حرف واحد. <b>א?ר</b> يجد אור، אמר، עבר.',
      '<b>????</b> (؟ فقط) — كلمات كاملة بالطول المحدّد (هنا ٤ أحرف).',
      '<b>*</b> — سلسلة غير معروفة. <b>כא*</b> = يبدأ بـכא · <b>*כא</b> = ينتهي · <b>*כא*</b> = يحتوي.',
      '<b>+</b> — «و»: كلّ الكلمات في الآية نفسها. <b>אור+חשך</b>.',
      'ملاحظة: <b>?</b> / <b>*</b> / <b>+</b> تتقدّم على خيارات البحث المتقدم وتعمل دائماً.']],
    ['البحث المتقدم — ماذا يفعل كلّ خيار', [
      '<b>تطابق تامّ</b> — الكلمة الكاملة فقط، لا كجزء من كلمة. <b>אל</b> → «אל» فقط.',
      '<b>حسب جذر الكلمة</b> — كلّ تصريفات الجذر. <b>ברא</b> → ברא، בורא، נברא. لكلمة واحدة.',
      '<b>البحث في الآرامية</b> — يبحث في الترجمة الآرامية بدل العبرية.',
      '<b>تجاهل الحروف النهائية</b> — ך=כ، ם=מ، ן=נ، ף=פ، ץ=צ. <b>הציף</b> = הציפ.',
      '<b>إظهار معاني الكلمات</b> — تحت كلّ نتيجة: الترجمة الآرامية، مدخل المعجم، ومعنى عبري.',
      '<b>تأكيد</b> — يُجري البحث بالخيارات المختارة.']],
  ],
};
function showSearchHelp(){
  let h = '';
  for(const [title, items] of (SEARCH_HELP[LANG] || SEARCH_HELP.he)){
    h += `<div class="help-h">${title}</div><ul class="help-list">`;
    for(const it of items) h += `<li>${it}</li>`;
    h += '</ul>';
  }
  showInfo(t('search_help_title'), h);
}
$('searchHelpBtn').onclick=showSearchHelp;

// "גרסא נוכחית": the version number, and beneath it the changelog itself — read
// from VER_UPDATES.txt on the server, so the file the maintainer keeps is the one
// the reader sees. (Until now the menu item showed the number alone and this
// loader had no caller, leaving the whole log unreachable from the app.)
async function showVersionLog(){
  const num = `<div class="ver-num">${esc(t('adm_version_word'))} ${esc(window.APP_VERSION||'1.0')}</div>`;
  showInfo(t('m_version'), num + `<div class="note">${esc(t('adm_loading'))}</div>`);
  try{
    const d=await api('whats_new');
    const txt=(d.text||'').trim();
    $('infoBody').innerHTML = num + (txt ? '<pre class="whatsnew">'+esc(txt)+'</pre>'
                                         : `<div class="note">${esc(t('adm_no_log'))}</div>`);
  }catch(e){ $('infoBody').innerHTML = num + `<div class="note">${esc(t('edit_err'))}</div>`; }
}

// ── contact form ─────────────────────────────────────────────────────────────
function wordCount(s){ return (s.trim().match(/\S+/g)||[]).length; }
function updateWordCount(){
  const n=wordCount($('cMsg').value);
  $('cCount').textContent=n+' / 100 מילים';
  $('cCount').style.color = n>100 ? '#bf3930' : '#73738c';
}
function openContact(){
  $('cErr').textContent=''; $('cName').value=''; $('cEmail').value=''; $('cMsg').value='';
  updateWordCount(); $('contactModal').classList.remove('hidden'); $('cName').focus();
}
$('cCancel').onclick=()=>$('contactModal').classList.add('hidden');
$('cMsg').addEventListener('input', updateWordCount);
$('cSend').onclick=()=>{
  const name=$('cName').value.trim(), email=$('cEmail').value.trim(), msg=$('cMsg').value.trim();
  const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const n=wordCount(msg);
  if(!name){ $('cErr').textContent='יש להזין שם מלא.'; return; }
  if(!emailOk){ $('cErr').textContent='יש להזין כתובת מייל תקינה.'; return; }
  if(n===0){ $('cErr').textContent='יש להזין הודעה.'; return; }
  if(n>100){ $('cErr').textContent='ההודעה ארוכה מ-100 מילים.'; return; }
  const subject='פנייה מהתורה השומרונית — '+name;
  const body='שם: '+name+'\nמייל: '+email+'\n\n'+msg;
  // open the user's mail client, pre-filled, addressed to the contact address
  window.location.href='mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  $('contactModal').classList.add('hidden');
};

// ── apply the chosen UI language ─────────────────────────────────────────────
function applyI18n(){
  const d = (LANG === 'en') ? 'ltr' : 'rtl';
  document.documentElement.lang = LANG;
  document.documentElement.dir = d;
  // keep browser auto-translation off — the app does its own UI translation
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  const app = $('app'); if(app) app.style.direction = d;
  document.querySelectorAll('[data-i18n]').forEach(n=>{ const v=t(n.dataset.i18n); if(v!=null) n.innerHTML=v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(n=>{ n.placeholder = t(n.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(n=>{ n.title = t(n.dataset.i18nTitle); });
  if(typeof syncToolbar === 'function') syncToolbar(S.view === 'verses');
  if(typeof paintVerses === 'function' && S.view === 'verses') paintVerses();
  // the prev/next buttons are set per-mode by navState — re-apply so they too translate
  if(typeof navState === 'function' && S.navMode && !$('navbar').classList.contains('hidden')) navState(S.navMode);
}
function setLang(lang){ if(!I18N[lang]) return; LANG = lang; applyI18n(); }
// a small styled yes/no dialog → Promise<boolean>
function askConfirm(title, msg, yes, no){
  return new Promise(res=>{
    const m = el('div','modal');
    m.innerHTML = `<div class="modal-box"><div class="modal-title">${esc(title)}</div>`
      + `<div class="note" style="text-align:center;margin-bottom:6px">${esc(msg)}</div>`
      + `<button class="share-opt" style="background:#3a6b34">${esc(yes)}</button>`
      + `<button class="share-opt close">${esc(no)}</button></div>`;
    document.body.appendChild(m);
    const [yb,nb] = m.querySelectorAll('button');
    yb.onclick=()=>{ m.remove(); res(true); };
    nb.onclick=()=>{ m.remove(); res(false); };
  });
}
// like askConfirm, but the body is trusted, pre-escaped HTML (a rich report)
// rather than a plain message — used for the reseed diff-report gate below.
function askConfirmHtml(title, bodyHtml, yes, no, danger){
  return new Promise(res=>{
    const m = el('div','modal');
    m.innerHTML = `<div class="modal-box big"><div class="modal-title">${esc(title)}</div>`
      + `<div class="note" style="text-align:start;margin-bottom:6px;max-height:60vh;overflow-y:auto">${bodyHtml}</div>`
      + `<button class="share-opt" style="background:${danger?'#a02a2a':'#3a6b34'}">${esc(yes)}</button>`
      + `<button class="share-opt close">${esc(no)}</button></div>`;
    document.body.appendChild(m);
    const [yb,nb] = m.querySelectorAll('button');
    yb.onclick=()=>{ m.remove(); res(true); };
    nb.onclick=()=>{ m.remove(); res(false); };
  });
}
// language picker → switch immediately, then ask whether to persist on this device
document.querySelectorAll('#langModal .lang-opt, #langModal .close').forEach(b=>{
  b.onclick = async ()=>{
    const lang = b.dataset.lang;
    $('langModal').classList.add('hidden');
    if(!lang) return;
    setLang(lang);
    const save = await askConfirm(t('m_lang'), t('lang_save_q') + ' ' + t('lang_save_note'),
                                  t('save_yes'), t('save_no'));
    if(save) localStorage.setItem('uiLang', lang); else localStorage.removeItem('uiLang');
  };
});

// ── admin editing (login + floating-pencil edit; gated entirely server-side) ──
const ADMIN = { token:null, webauthn:false };
// reveal "כניסת מנהל" only where admin is enabled (the local server has a password)
loadSamCalendar();          // the date under the title, and the portion of the week

api('admin/status').then(s=>{ if(s && s.enabled){
  $('adminSep').classList.remove('hidden'); $('adminMenuItem').classList.remove('hidden'); ADMIN.webauthn=!!s.webauthn;
} }).catch(()=>{});
function waSupported(){
  return !!(window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON
            && PublicKeyCredential.parseRequestOptionsFromJSON);
}
function openAdminLogin(){
  if(ADMIN.token){ ADMIN.token=null; $('adminMenuItem').textContent=t('m_admin');
                   adminBadge(false); paintVerses(); return; }   // logout
  $('admErr').textContent=''; $('admUser').value=''; $('admPass').value='';
  $('admWebauthnBtn').classList.toggle('hidden', !(ADMIN.webauthn && waSupported()));
  $('adminModal').classList.remove('hidden'); $('admUser').focus();
}
$('admCancel').onclick=()=>$('adminModal').classList.add('hidden');
$('admLogin').onclick=async ()=>{
  const user=$('admUser').value.trim(), password=$('admPass').value;
  $('admErr').textContent='';
  let r; try{ r=await apiPost('admin/login', {user, password}); }catch(e){ r={ok:false}; }
  if(r && r.ok){ adminLoggedIn(r.token); }
  else { $('admErr').textContent=t('adm_bad'); }
};
// A standing reminder that this session can rewrite the text — and the way out
// of it. Yellow, beside the hamburger, so it is impossible to be in admin mode
// without knowing it.
function adminBadge(on){
  const b = $('adminBadge');
  if(!b) return;
  b.classList.toggle('hidden', !on);
  b.textContent = t('admin_badge');
}
$('adminBadge').onclick = async () => {
  if(!ADMIN.token) return;
  if(!await askConfirm(t('admin_badge'), t('admin_exit_q'), t('confirm_yes'), t('c_cancel'))) return;
  ADMIN.token = null;
  S.splitMode = S.vsplitMode = S.renumMode = false; S.vmergeMode = null;
  $('adminMenuItem').textContent = t('m_admin');
  adminBadge(false);
  paintVerses();
  showInfo(t('m_admin'), `<div class="note">${esc(t('admin_off'))}</div>`);
};
function adminLoggedIn(token){
  ADMIN.token=token; $('adminModal').classList.add('hidden');
  $('adminMenuItem').textContent='✓ '+t('m_admin');
  adminBadge(true);
  APK_INFO = null;                     // re-ask, so the download tally comes with it
  let extra = '';
  if(!ADMIN.webauthn && waSupported())
    extra = `<button class="admin-btn" onclick="waRegister()">${esc(t('wa_setup'))}</button>`;
  showInfo(t('m_admin'), `<div class="note">${esc(t('admin_on'))}</div>`
    +`<div class="note" style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${extra}</div>`+adminDbControls());
  paintVerses();
}
// register this device's fingerprint/Face ID so future admin logins can skip the password
async function waRegister(){
  if(!ADMIN.token) return;
  try{
    const r = await apiPost('admin/webauthn/register_options', {token:ADMIN.token});
    if(!r || !r.ok) throw new Error('no options');
    const options = PublicKeyCredential.parseCreationOptionsFromJSON(r.options);
    const cred = await navigator.credentials.create({publicKey: options});
    const v = await apiPost('admin/webauthn/register_verify', {token:ADMIN.token, state:r.state, credential:cred.toJSON()});
    if(v && v.ok){ ADMIN.webauthn=true; showInfo(t('m_admin'), `<div class="note">✓ ${esc(t('wa_ok'))}</div>`+adminDbControls()); }
    else showInfo(t('m_admin'), `<div class="note">${esc((v&&v.error)||t('wa_err'))}</div>`+adminDbControls());
  }catch(e){ showInfo(t('m_admin'), `<div class="note">${esc(t('wa_err'))}</div>`+adminDbControls()); }
}
$('admWebauthnBtn').onclick=async ()=>{
  $('admErr').textContent='';
  try{
    const r = await fetch('/api/admin/webauthn/login_options').then(x=>x.json());
    if(!r || !r.ok) throw new Error('not available');
    const options = PublicKeyCredential.parseRequestOptionsFromJSON(r.options);
    const cred = await navigator.credentials.get({publicKey: options});
    const v = await apiPost('admin/webauthn/login_verify', {state:r.state, credential:cred.toJSON()});
    if(v && v.ok) adminLoggedIn(v.token);
    else $('admErr').textContent=t('wa_login_err');
  }catch(e){ $('admErr').textContent=t('wa_login_err'); }
};
// admin DB sync controls (download the live DB to commit back; re-seed from repo)
function adminDbControls(){
  if(!ADMIN.token) return '';
  return `<div class="note" style="margin-top:10px;display:flex;flex-direction:column;gap:6px">`
    + `<button class="admin-btn" onclick="openSystemDoc()">${esc(t('adm_sysdoc'))}</button>`
    + `<button class="admin-btn" onclick="openAnalytics()">${esc(t('adm_analytics'))}</button>`
    + `<button class="admin-btn" onclick="openDiskUsage()">${esc(t('adm_disk'))}</button>`
    + `<a class="admin-btn" style="text-decoration:none;text-align:center" `
    + `href="/api/admin/download_db?token=${encodeURIComponent(ADMIN.token)}">${esc(t('admin_dl_db'))}</a>`
    + `<button class="admin-btn cancel" onclick="adminReseed()">${esc(t('admin_reseed'))}</button></div>`;
}
// the system's own documentation (web/SYSTEM_DOC.txt) — what the system is, what
// it is built of, where each body of text came from, and what every version did.
// Read straight from the server so the deployed copy is always the one shown.
async function openSystemDoc(){
  if(!ADMIN.token) return;
  showInfo(t('adm_sysdoc'), `<div class="note">${esc(t('adm_loading'))}</div>`);
  let r; try{ r = await fetch('/api/admin/system_doc?token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  if(!r || !r.ok || !(r.text||'').trim()){
    $('infoBody').innerHTML = `<div class="note">${esc(t('edit_err'))}</div>`; return;
  }
  $('infoTitle').textContent = t('adm_sysdoc') + ' — ' + t('adm_version_word') + ' ' + (r.version||'');
  $('infoBody').innerHTML = '<pre class="whatsnew sysdoc">'+esc(r.text.trim())+'</pre>';
}
// admin disk-usage panel — surfaces the live persistent disk's free space and
// lets the admin reclaim it by deleting old same-disk backup copies (the git
// history is the real backup, so these are safe to prune)
function fmtBytes(n){
  if(n>=1e9) return (n/1e9).toFixed(2)+' GB';
  if(n>=1e6) return (n/1e6).toFixed(1)+' MB';
  if(n>=1e3) return (n/1e3).toFixed(0)+' KB';
  return n+' B';
}
async function openDiskUsage(){
  if(!ADMIN.token) return;
  let r; try{ r = await fetch('/api/admin/disk_usage?token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  if(!r || !r.ok){ showInfo(t('adm_disk'), `<div class="note">${esc(t('edit_err'))}</div>`); return; }
  const html = `<div class="note" style="display:flex;flex-direction:column;gap:4px">`
    + `<div>${esc(t('adm_disk_db'))}: <b>${fmtBytes(r.db_bytes)}</b></div>`
    + `<div>${esc(t('adm_disk_backups'))}: <b>${r.backups.length}</b> (${fmtBytes(r.backups_bytes)})</div>`
    + `<div>${esc(t('adm_disk_free'))}: <b>${fmtBytes(r.disk_free)}</b> / ${esc(t('adm_disk_total'))}: ${fmtBytes(r.disk_total)}</div>`
    + `</div>`
    + `<button class="admin-btn cancel" style="margin-top:10px" onclick="adminCleanBackups()">${esc(t('adm_disk_clean'))}</button>`;
  showInfo(t('adm_disk'), html);
}
async function adminCleanBackups(){
  if(!ADMIN.token) return;
  if(!await askConfirm(t('adm_disk'), t('adm_disk_clean_q'), t('confirm_yes'), t('c_cancel'))) return;
  let r; try{ r=await apiPost('admin/clean_backups', {token:ADMIN.token, keep:0}); }catch(e){ r={ok:false}; }
  showInfo(t('adm_disk'), `<div class="note">${r&&r.ok ? esc(t('adm_disk_cleaned'))+' ('+fmtBytes(r.freed_bytes)+')' : esc((r&&r.error)||'error')}</div>`);
}
// admin analytics dashboard — who visited (device/IP), how long, which pages
async function openAnalytics(){
  if(!ADMIN.token) return;
  let r; try{ r = await fetch('/api/admin/analytics?token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  if(!r || !r.ok){ showInfo(t('adm_analytics'), `<div class="note">${esc(t('edit_err'))}</div>`); return; }
  const rows = r.sessions||[];
  if(!rows.length){ showInfo(t('adm_analytics'), `<div class="note">${esc(t('adm_analytics_empty'))}</div>`); return; }
  const locale = LANG==='he'?'he-IL':(LANG==='ar'?'ar':'en-US');
  const fmt = ts => ts ? new Date(ts*1000).toLocaleString(locale) : '';
  const dur = sec => { sec=sec||0; const m=Math.floor(sec/60), s=sec%60;
    return m>0 ? `${m}${t('adm_min')} ${s}${t('adm_sec')}` : `${s}${t('adm_sec')}`; };
  const html = `<div class="note" style="margin-bottom:8px">${esc(t('adm_analytics_hint'))}</div>`
    + '<div class="an-list">' + rows.map(s => `
      <div class="an-row">
        <div class="an-top"><b>${esc(s.device||'?')}</b><span class="an-ip">${esc(s.ip||'')}</span></div>
        <div class="an-meta">${esc(t('adm_first'))}: ${esc(fmt(s.first_seen))} · ${esc(t('adm_last'))}: ${esc(fmt(s.last_seen))} · ${esc(t('adm_duration'))}: ${dur(s.duration)}</div>
        <div class="an-pages">${(s.pages||[]).map(p=>esc(p.label)+(p.count>1?` ×${p.count}`:'')).join(' · ')}</div>
      </div>`).join('') + '</div>';
  showInfo(t('adm_analytics'), html);
}
// build the HTML body of the reseed diff-report — every section is skipped
// when empty, so a clean report just reads "no differences found"
function _reseedReportHtml(rep){
  let h = '';
  if(rep.first_seed){
    return `<div class="note">${esc(t('reseed_first_seed'))}</div>`;
  }
  const hasBooks = (rep.books||[]).length;
  const v = rep.verses||{};
  const hasVerses = v.added||v.removed||v.text_changed||v.sam_ch_changed;
  const hasLoss = (rep.content_loss||[]).length;
  const hasAudio = (rep.audio_issues||[]).length;
  if(!hasBooks && !hasVerses && !hasLoss && !hasAudio){
    return `<div class="note">${esc(t('reseed_no_diff'))}</div>`;
  }
  if(hasBooks){
    h += `<div class="rs-h">${esc(t('reseed_books'))}</div>`;
    for(const b of rep.books){
      h += `<div class="rs-row"><b>${esc(b.name)}</b>: ${b.sam_count_live} → ${b.sam_count_bundled}`
         + ` (${esc(t('reseed_added'))} ${b.added}, ${esc(t('reseed_removed'))} ${b.removed}, ${esc(t('reseed_renumbered'))} ${b.renumbered})</div>`;
    }
  }
  if(hasVerses){
    h += `<div class="rs-h">${esc(t('reseed_verses'))}</div>`;
    h += `<div class="rs-row">${esc(t('reseed_added'))} ${v.added} · ${esc(t('reseed_removed'))} ${v.removed}`
       + ` · ${esc(t('reseed_changed'))} ${v.text_changed} · ${esc(t('reseed_ch_moved'))} ${v.sam_ch_changed}</div>`;
    for(const s of (v.text_sample||[])){
      h += `<div class="rs-diff"><b>${esc(s.ref)}</b>`
         + `<div class="rs-old">${esc(s.live)}</div><div class="rs-new">${esc(s.bundled)}</div></div>`;
    }
  }
  if(hasLoss){
    h += `<div class="rs-h rs-warn">${esc(t('reseed_loss'))}</div>`;
    for(const c of rep.content_loss){
      h += `<div class="rs-row rs-warn-row"><b>${esc(c.ref)}</b>: ${esc(c.tables.join(', '))}</div>`;
    }
  }
  if(hasAudio){
    h += `<div class="rs-h rs-warn">${esc(t('reseed_audio'))}</div>`;
    for(const a of rep.audio_issues){
      h += `<div class="rs-row rs-warn-row">${esc(a.file)} — ${esc(a.detail)}</div>`;
    }
  }
  return h;
}
async function adminReseed(){
  if(!ADMIN.token) return;
  let r; try{ r = await fetch('/api/admin/reseed_diff?token='+encodeURIComponent(ADMIN.token)).then(x=>x.json()); }
  catch(e){ r={ok:false}; }
  if(!r || !r.ok){ showInfo(t('admin_reseed'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`); return; }
  const rep = r.report;
  if(rep.noop){ showInfo(t('admin_reseed'), `<div class="note">${esc(rep.reason||'')}</div>`); return; }
  const body = _reseedReportHtml(rep);
  const proceed = await askConfirmHtml(t('reseed_report_title'), body, t('reseed_approve'), t('c_cancel'), true);
  if(!proceed) return;
  let rr; try{ rr=await apiPost('admin/reseed_db', {token:ADMIN.token, confirm:'REPLACE', state_hash:rep.state_hash}); }
  catch(e){ rr={ok:false}; }
  showInfo(t('admin_reseed'), `<div class="note">${rr&&rr.ok ? '✓' : esc((rr&&rr.error)||'error')}</div>`);
}
$('admPass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('admLogin').click(); });
// add a floating edit pencil (admin only) to a text row → opens the edit window
function addPencil(rowEl, verseId, column, getText, table, onSaved){
  if(!ADMIN.token) return;
  rowEl.classList.add('editable-row');
  const p=el('button','edit-pencil','✎'); p.title=t('edit_title');
  p.onclick=(ev)=>{ ev.stopPropagation(); openEdit(verseId, column, getText(), table, onSaved); };
  rowEl.prepend(p);   // leftmost (the row is LTR) → floats to the left of the text
}
// comparison-view pencil (admin only): a verse row here holds MULTIPLE text columns
// (e.g. source + Onkelos) — clicking always asks which one to edit before opening
// the normal edit window, since there's no single "the" text for that row.
function addCmpPencil(cellEl, verseId, fields){
  if(!ADMIN.token || !fields.length) return;
  const p=el('button','edit-pencil','✎'); p.title=t('edit_title');
  p.onclick=(ev)=>{ ev.stopPropagation(); chooseCmpField(verseId, fields); };
  cellEl.prepend(p);
}
function chooseCmpField(verseId, fields){
  const html = '<div class="note" style="display:flex;flex-direction:column;gap:6px">'
    + fields.map((f,i)=>`<button class="admin-btn" data-i="${i}">${esc(f.label)}</button>`).join('')
    + '</div>';
  showInfo(t('edit_which_ver'), html);
  $('infoBody').querySelectorAll('button[data-i]').forEach(btn=>{
    const f = fields[+btn.dataset.i];
    btn.onclick=()=>{ $('infoModal').classList.add('hidden'); chooseCmpAction(verseId, f); };
  });
}
// step 2: what to do with the chosen version's text on this row. Split/merge only
// make sense for the comparison-only columns (not 'text' — the Samaritan verse
// already has its own real split/merge/renumber tools elsewhere), and only when
// a next verse exists in S.verses to move text to/from (client-side order, which
// is already the correct reading order — safer than re-deriving it server-side).
function chooseCmpAction(verseId, field){
  const idx=(S.verses||[]).findIndex(x=>x.id===verseId);
  const nextV = idx>=0 ? (S.verses[idx+1]||null) : null;
  const structural = field.column!=='text' && field.column!=='mas_chapter';
  let html = '<div class="note" style="display:flex;flex-direction:column;gap:6px">'
    + `<button class="admin-btn" id="cmpActEdit">${esc(t('edit_title'))}</button>`;
  if(structural && nextV) html += `<button class="admin-btn" id="cmpActSplit">${esc(t('cmp_act_split'))}</button>`
                                 + `<button class="admin-btn" id="cmpActMerge">${esc(t('cmp_act_merge'))}</button>`;
  html += '</div>';
  showInfo(field.label, html);
  $('infoBody').querySelector('#cmpActEdit').onclick=()=>{ $('infoModal').classList.add('hidden'); openEdit(verseId, field.column, field.getText()); };
  const sb=$('infoBody').querySelector('#cmpActSplit');
  if(sb) sb.onclick=()=>{ $('infoModal').classList.add('hidden'); openCmpSplit(verseId, nextV.id, field); };
  const mb=$('infoBody').querySelector('#cmpActMerge');
  if(mb) mb.onclick=()=>{ $('infoModal').classList.add('hidden'); cmpMergeNext(verseId, nextV.id, field); };
}
// split the chosen version's text: part 1 stays on this verse, part 2 moves to
// the START of the next verse's text in that same version (prepended, so any
// text already there is preserved) — no new verse/row is created.
function openCmpSplit(verseId, nextId, field){
  const m=el('div','modal');
  m.innerHTML=`<div class="modal-box">
     <div class="modal-title">${esc(t('cmp_split_title'))} — ${esc(field.label)}</div>
     <div class="note" style="margin-bottom:4px">${esc(t('cmp_split_hint'))}</div>
     <label class="vsplit-lab">${esc(t('cmp_split_p1'))}</label>
     <textarea id="csP1" class="vsplit-area" dir="rtl"></textarea>
     <label class="vsplit-lab">${esc(t('cmp_split_p2'))}</label>
     <textarea id="csP2" class="vsplit-area" dir="rtl"></textarea>
     <div class="note" id="csErr" style="color:#b00;min-height:1em"></div>
     <button class="share-opt" style="background:#3a6b34" id="csGo">${esc(t('vsplit_btn'))}</button>
     <button class="share-opt close" id="csCancel">${esc(t('c_cancel'))}</button>
   </div>`;
  document.body.appendChild(m);
  m.querySelector('#csP1').value=field.getText();
  m.querySelector('#csCancel').onclick=()=>m.remove();
  m.querySelector('#csGo').onclick=async ()=>{
    const text1=m.querySelector('#csP1').value.trim(), text2=m.querySelector('#csP2').value.trim();
    if(!text1 || !text2){ m.querySelector('#csErr').textContent=t('vsplit_err'); return; }
    let r; try{ r=await apiPost('admin/cmp_split_next', {token:ADMIN.token, verse_id:verseId, next_verse_id:nextId, column:field.column, text1, text2}); }catch(e){ r={ok:false}; }
    if(r && r.ok){ m.remove(); await reloadChapters(); showInfo(t('m_admin'), `<div class="note">${esc(t('cmp_split_ok'))}</div>`); }
    else { m.querySelector('#csErr').textContent=(r&&r.error)||t('edit_err'); }
  };
}
async function cmpMergeNext(verseId, nextId, field){
  if(!await askConfirm(t('cmp_act_merge'), t('cmp_merge_q'), t('confirm_yes'), t('c_cancel'))) return;
  let r; try{ r=await apiPost('admin/cmp_merge_next', {token:ADMIN.token, verse_id:verseId, next_verse_id:nextId, column:field.column}); }catch(e){ r={ok:false}; }
  if(r&&r.ok){ await reloadChapters(); showInfo(t('m_admin'), `<div class="note">${esc(t('cmp_merge_ok'))}</div>`); }
  else showInfo(t('m_admin'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
}
let _editCtx=null;
// table/onSaved let non-verse rows (e.g. private-composition lines) reuse this same
// edit window; omitting them keeps the original verses-only behavior unchanged.
function openEdit(verseId, column, text, table, onSaved){
  _editCtx={verseId, column, table:table||'verses', onSaved};
  $('editTitle').textContent=t('edit_title'); $('editErr').textContent=''; $('editArea').value=text||'';
  $('editModal').classList.remove('hidden'); $('editArea').focus();
}
$('editCancel').onclick=()=>$('editModal').classList.add('hidden');
$('editSave').onclick=async ()=>{
  if(!_editCtx || !ADMIN.token) return;
  const value=$('editArea').value; $('editErr').textContent='';
  let r; try{ r=await apiPost('admin/edit', {token:ADMIN.token, table:_editCtx.table, column:_editCtx.column, id:_editCtx.verseId, value}); }catch(e){ r={ok:false}; }
  if(r && r.ok){
    if(_editCtx.table==='verses'){
      const v=(S.verses||[]).find(x=>x.id===_editCtx.verseId);
      if(v){
        v[_editCtx.column]=value;
        // mas_chapter overrides the derived jchapter used by the comparison-view label
        if(_editCtx.column==='mas_chapter') v.jchapter = value || null;
      }
      _apiCache.clear();                 // drop cached responses holding the old text
      $('editModal').classList.add('hidden'); paintVerses();
    } else {
      $('editModal').classList.add('hidden');
      if(_editCtx.onSaved) _editCtx.onSaved();
    }
  } else { $('editErr').textContent=t('edit_err'); }
};
// admin chapter restructuring (merge with next / split here) — standard division
async function reloadChapters(){
  _apiCache.clear();
  const rows = S.chMode==='samaritan' ? await api('sam_chapters?portion_id='+S.curPid)
                                      : await api('chapters?portion_id='+S.curPid);
  S.chList = rows.map(r=>({id:r.id, number:r.number}));
  S.chIdx = Math.max(0, S.chList.findIndex(x=>x.id===S.curChId));
  await renderVerses(S.curChId, S.curChNum, S.curPid, S.portionName);
}
// The canon warns, it does not block: a split or merge that would take a book's
// or a portion's Samaritan chapter count off its canon comes back from the server
// as a confirmation request, with the numbers, rather than as a refusal. It goes
// through once the agreed phrase is typed — a second, deliberate gate against an
// accidental drift, not a lock: this number is the owner's to move.
function askCanonPhrase(d){
  return new Promise(res=>{
    const rows = [];
    if(d && d.book) rows.push(['בספר', d.book.now, d.book.after, d.book.canon, d.book.closer]);
    if(d && d.portion) rows.push(['בפרשת ' + d.portion.name, d.portion.now, d.portion.after,
                                  d.portion.canon, d.portion.closer]);
    const m = el('div','modal');
    m.innerHTML = `<div class="modal-box canon-ask">
      <div class="modal-title">⚠ חריגה מן הקאנון</div>
      <table class="canon-tbl"><tr><th></th><th>עכשיו</th><th>אחרי</th><th>קאנון</th><th></th></tr>`
      + rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td class="after">${r[2]}</td><td>${r[3]}</td>`
                 + `<td class="${r[4]?'closer':'farther'}">${r[4]?'מתקרב':'מתרחק'}</td></tr>`).join('')
      + `</table>
      <div class="note">הפעולה תבוצע — אך המניין יצא מן הקאנון. להמשך, הקלד את מילת האישור.</div>
      <input id="canonPhrase" type="text" dir="rtl" placeholder="מילת האישור" autocomplete="off">
      <button class="share-opt" id="canonGo" style="background:#8a3030">בצע בכל זאת</button>
      <button class="share-opt close" id="canonNo">ביטול</button></div>`;
    document.body.appendChild(m);
    const inp = m.querySelector('#canonPhrase');
    inp.focus();
    const done = v => { m.remove(); res(v); };
    m.querySelector('#canonGo').onclick = () => done(inp.value.trim());
    m.querySelector('#canonNo').onclick = () => done(null);
    inp.onkeydown = e => { if(e.key === 'Enter') done(inp.value.trim()); };
  });
}
// one attempt, and if the canon stands in the way a second one carrying the phrase
async function postCanon(ep, body){
  let r; try{ r = await apiPost(ep, body); }catch(e){ r = {ok:false}; }
  if(r && r.canon_confirm){
    const phrase = await askCanonPhrase(r.details);
    if(!phrase) return {ok:false, error:'בוטל — המניין לא שונה.'};
    try{ r = await apiPost(ep, Object.assign({}, body, {canon_phrase:phrase})); }catch(e){ r = {ok:false}; }
    if(r && r.canon_confirm) return {ok:false, error:'מילת האישור אינה נכונה — לא בוצע שינוי.'};
  }
  return r;
}
async function mergeNext(){
  if(!ADMIN.token) return;
  if(!await askConfirm(t('merge_next'), t('merge_q'), t('confirm_yes'), t('c_cancel'))) return;
  const ep = S.chMode==='samaritan' ? 'admin/merge_next_sam' : 'admin/merge_next';
  const r = await postCanon(ep, {token:ADMIN.token, chapter_id:S.curChId});
  if(r&&r.ok){ await reloadChapters(); showInfo(t('m_admin'), `<div class="note">${esc(t('merged_ok'))}</div>`); }
  else showInfo(t('m_admin'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
}
// Merge a verse with its neighbour. Whichever direction is chosen, the survivor
// is the earlier of the two and keeps its own number — merging upwards files this
// verse under the one above, merging downwards swallows the one below into this
// one. The client picks the neighbour out of its already-ordered S.verses rather
// than letting the server re-derive an order from mixed '10' / '10-1' numbers.
async function askMergeVerse(v, dir){
  const all = S.verses || [];
  const i = all.findIndex(x => x.id === v.id);
  const other = dir === 'prev' ? all[i-1] : all[i+1];
  if(!other){ showInfo(t('m_admin'), `<div class="note">${esc(t('vmerge_none'))}</div>`); return; }
  const keep = dir === 'prev' ? other : v;          // the earlier of the pair
  const drop = dir === 'prev' ? v : other;
  const q = t('vmerge_q').replace('{a}', drop.number).replace('{b}', keep.number);
  if(!await askConfirm(t(dir==='prev' ? 'vmerge_prev' : 'vmerge_next'), q, t('confirm_yes'), t('c_cancel'))) return;
  S.vmergeMode = null;
  let r; try{ r = await apiPost('admin/merge_verse',
      {token:ADMIN.token, verse_id:v.id, other_verse_id:other.id, direction:dir}); }catch(e){ r={ok:false}; }
  await reloadChapters();
  showInfo(t('m_admin'), `<div class="note">${esc(r&&r.ok
      ? t('vmerge_ok').replace('{a}', r.dropped).replace('{b}', r.number)
      : ((r&&r.error)||t('edit_err')))}</div>`);
}
// Engrave the count as it now stands: from the last Samaritan chapter of a
// portion it signs that portion, and from the last portion of a book it signs
// every portion of the book and the book's own total.
async function setCanon(samChId, portionName, live, wholeBook){
  const q = (wholeBook ? t('canon_set_q_book') : t('canon_set_q'))
              .replace('{p}', portionName).replace('{n}', live);
  if(!await askConfirm(t('canon_set'), q, t('confirm_yes'), t('c_cancel'))) return;
  let r; try{ r = await apiPost('admin/set_canon', {token:ADMIN.token, sam_ch_id:samChId}); }
  catch(e){ r = {ok:false}; }
  if(r && r.ok){
    _apiCache.clear();
    const lines = (r.stamped||[]).map(x => `${esc(x.portion)} — ${x.count}`).join('<br>');
    showInfo(t('canon_set'), `<div class="note">${esc(t('canon_set_ok'))}<br>${lines}`
      + (r.book_total ? `<br><b>${esc(t('canon_book_total'))} ${r.book_total}</b>` : '') + '</div>');
    await renderVerses(S.curChId, S.curChNum, S.curPid, S.portionName);
  } else showInfo(t('canon_set'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
}

async function askSplit(v){
  if(!await askConfirm(t('split_chapter'), t('split_q')+v.number+'?', t('confirm_yes'), t('c_cancel'))) return;
  S.splitMode=false;
  const ep = S.chMode==='samaritan' ? 'admin/split_sam' : 'admin/split';
  const r = await postCanon(ep, {token:ADMIN.token, chapter_id:S.curChId, after_verse_id:v.id});
  await reloadChapters();
  showInfo(t('m_admin'), `<div class="note">${esc(r&&r.ok ? t('split_ok') : ((r&&r.error)||t('edit_err')))}</div>`);
}
// split a single verse → a new Samaritan-only maqaf sub-verse (10 → 10-1, …).
// The admin divides the text into two parts; part 1 stays, part 2 is the new verse.
function openVsplit(v){
  S.vsplitMode=false;
  const base=String(v.number).split('-')[0];
  let mx=0;                                  // best-effort projected sub-number for the label
  for(const x of (S.verses||[])){ const s=String(x.number);
    if(s.indexOf(base+'-')===0){ const tl=s.slice(base.length+1); if(/^\d+$/.test(tl)) mx=Math.max(mx,+tl); } }
  const newNum=base+'-'+(mx+1);
  const m=el('div','modal');
  m.innerHTML=`<div class="modal-box">
     <div class="modal-title">${esc(t('vsplit_title'))} ${esc(String(v.number))}</div>
     <div class="note" style="margin-bottom:4px">${esc(t('vsplit_hint'))}</div>
     <label class="vsplit-lab">${esc(t('vsplit_p1'))} ${esc(String(v.number))}</label>
     <textarea id="vsP1" class="vsplit-area" dir="rtl"></textarea>
     <label class="vsplit-lab">${esc(t('vsplit_p2'))} ${esc(newNum)}</label>
     <textarea id="vsP2" class="vsplit-area" dir="rtl"></textarea>
     <div class="note" id="vsErr" style="color:#b00;min-height:1em"></div>
     <button class="share-opt" style="background:#3a6b34" id="vsGo">${esc(t('vsplit_btn'))}</button>
     <button class="share-opt close" id="vsCancel">${esc(t('c_cancel'))}</button>
   </div>`;
  document.body.appendChild(m);
  m.querySelector('#vsP1').value=v.text||'';
  m.querySelector('#vsCancel').onclick=()=>{ m.remove(); paintVerses(); };
  m.querySelector('#vsGo').onclick=async ()=>{
    const text1=m.querySelector('#vsP1').value.trim(), text2=m.querySelector('#vsP2').value.trim();
    if(!text1 || !text2){ m.querySelector('#vsErr').textContent=t('vsplit_err'); return; }
    let r; try{ r=await apiPost('admin/split_verse', {token:ADMIN.token, verse_id:v.id, text1, text2}); }catch(e){ r={ok:false}; }
    if(r && r.ok){ m.remove(); _apiCache.clear(); await reloadChapters();
      showInfo(t('m_admin'), `<div class="note">${esc(t('vsplit_ok'))} ${esc(r.new_number||'')}</div>`); }
    else { m.querySelector('#vsErr').textContent=(r&&r.error)||t('edit_err'); }
  };
}
// change a verse's number → optionally cascade the change to all following verses.
function openRenumber(v){
  S.renumMode=false;
  const m=el('div','modal');
  m.innerHTML=`<div class="modal-box">
     <div class="modal-title">${esc(t('renum_title'))}</div>
     <div class="note" style="margin-bottom:6px">${esc(t('renum_cur'))} ${esc(String(v.number))}</div>
     <input id="renumInp" class="renum-inp" value="${esc(String(v.number))}">
     <div class="note" id="renumErr" style="color:#b00;min-height:1em"></div>
     <button class="share-opt" style="background:#3a6b34" id="renumGo">${esc(t('apply'))}</button>
     <button class="share-opt close" id="renumCancel">${esc(t('c_cancel'))}</button>
   </div>`;
  document.body.appendChild(m);
  const inp=m.querySelector('#renumInp'); inp.focus(); inp.select();
  m.querySelector('#renumCancel').onclick=()=>{ m.remove(); paintVerses(); };
  m.querySelector('#renumGo').onclick=async ()=>{
    const nn=inp.value.trim();
    if(!nn){ m.querySelector('#renumErr').textContent=t('renum_empty'); return; }
    if(nn===String(v.number)){ m.remove(); paintVerses(); return; }
    m.remove();
    // ask whether to also renumber all following verses accordingly
    const cascade=await askConfirm(t('renum_title'), t('renum_cascade_q'), t('renum_cascade_yes'), t('renum_only_this'));
    let r; try{ r=await apiPost('admin/renumber_verse', {token:ADMIN.token, verse_id:v.id, new_number:nn, cascade}); }catch(e){ r={ok:false}; }
    if(r && r.ok){ _apiCache.clear(); await reloadChapters(); showInfo(t('m_admin'), `<div class="note">${esc(t('renum_ok'))}</div>`); }
    else showInfo(t('m_admin'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
  };
}

// ── bookmarks (saved on this device; up to 20) ───────────────────────────────
function loadBookmarks(){ try{ return JSON.parse(localStorage.getItem('bookmarks')||'[]'); }catch(e){ return []; } }
function saveBookmarks(a){ localStorage.setItem('bookmarks', JSON.stringify(a)); }
function updateBmMenu(){ $('bmMenuItem').classList.toggle('hidden', loadBookmarks().length===0); }
function bmLabel(b){ return (b.division==='samaritan'?'פרק שומרוני ':'פרק ')+b.chNum
                          + (b.division==='samaritan' && b.chName ? ' ('+b.chName+')' : ''); }
function addBookmark(){
  if(S.view!=='verses' || S.curChId==null) return;
  const bms=loadBookmarks();
  if(bms.length>=20){ showInfo(t('bm_my'), `<div class="note">${esc(t('bm_max'))}</div>`); return; }
  if(bms.some(b=>b.division===S.chMode && b.chId===S.curChId)){ showInfo(t('bm_my'), `<div class="note">${esc(t('bm_dup'))}</div>`); return; }
  // for a Samaritan chapter, store its 4 opening words (same as the breadcrumb)
  const chName = (S.chMode==='samaritan' && S.verses && S.verses[0])
    ? (S.verses[0].text||'').trim().split(/\s+/).filter(Boolean).slice(0,4).join(' ') : '';
  bms.push({ id:'bm'+Date.now()+Math.random().toString(36).slice(2,8), division:S.chMode, book:S.book, bookName:S.bookName,
             portionId:S.curPid, portionName:S.portionName||'', chId:S.curChId, chNum:S.curChNum, chName:chName, note:'', ts:Date.now() });
  saveBookmarks(bms); updateBmMenu();
  showInfo(t('bm_my'), `<div class="note">${esc(t('bm_added'))}</div>`);
}
// bookmark sign lives in the navbar (between − and +); a tap adds a bookmark
$('bmAddBtn').onclick = addBookmark;
function openBookmarks(){
  const bms=loadBookmarks(); const list=$('bmList'); list.innerHTML='';
  if(!bms.length) list.appendChild(el('div','note',t('bm_empty')));
  for(const b of bms){
    const row=el('div','bm-row');
    const cb=el('input'); cb.type='checkbox'; cb.dataset.id=b.id; row.appendChild(cb);
    const main=el('div','bm-main');
    const path=el('div','bm-path', esc(`${b.bookName}  ›  ${b.portionName}  ›  ${bmLabel(b)}`));
    path.onclick=()=>gotoBookmark(b);
    main.appendChild(path);
    main.appendChild(el('div','bm-div', b.division==='samaritan'?'חלוקה שומרונית':'חלוקה יהודית'));
    const note=el('textarea','bm-note'); note.rows=1; note.value=b.note||''; note.placeholder=t('bm_note_ph');
    note.onchange=()=>{ const all=loadBookmarks(); const x=all.find(z=>z.id===b.id); if(x){ x.note=note.value; saveBookmarks(all); } };
    main.appendChild(note); row.appendChild(main); list.appendChild(row);
  }
  $('bmModal').classList.remove('hidden');
}
$('bmClose').onclick=()=>$('bmModal').classList.add('hidden');
$('bmDelete').onclick=async ()=>{
  const ids=[...$('bmList').querySelectorAll('input[type=checkbox]:checked')].map(c=>c.dataset.id);
  if(!ids.length) return;
  if(!await askConfirm(t('bm_my'), t('bm_del_q'), t('confirm_yes'), t('c_cancel'))) return;
  saveBookmarks(loadBookmarks().filter(b=>!ids.includes(b.id))); updateBmMenu(); openBookmarks();
};
async function gotoBookmark(b){
  $('bmModal').classList.add('hidden'); closeMenu();
  S.division=b.division;
  $('btnStandard').classList.toggle('active', b.division==='standard');
  $('btnSamaritan').classList.toggle('active', b.division==='samaritan');
  S.book=b.book; S.bookName=b.bookName;
  const mode=b.division==='samaritan'?'samaritan':'standard';
  try{
    S.portions=await api(`portions?book_id=${b.book}&mode=${mode}`);
    S.curPid=b.portionId; S.portionName=b.portionName;
    const rows=b.division==='samaritan' ? await api('sam_chapters?portion_id='+b.portionId) : await api('chapters?portion_id='+b.portionId);
    S.chList=rows.map(r=>({id:r.id, number:r.number}));
    if(b.division==='samaritan') await openSamChapter(b.chId, b.chNum, b.portionId, b.portionName);
    else await openChapter(b.chId, b.chNum, b.portionId, b.portionName);
  }catch(e){ showInfo(t('bm_my'), '<div class="note">לא ניתן לפתוח את הסימניה (ייתכן שהמבנה השתנה).</div>'); }
}

// ── onboarding: welcome (first entry) + install & notification recommendations ──
function isInstalled(){
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
}
// a single reusable onboarding card; resolves {primary, dont}
function showOnboard(opts){
  return new Promise(resolve=>{
    $('obTitle').textContent = opts.title || '';
    $('obBody').innerHTML = opts.body || '';
    const dont=$('obDontShow'); dont.checked=false;
    $('obDontWrap').classList.toggle('hidden', !opts.dont);
    const prim=$('obPrimary');
    if(opts.primaryLabel){ prim.textContent=opts.primaryLabel; prim.classList.remove('hidden'); }
    else prim.classList.add('hidden');
    $('obLater').textContent = opts.dont ? t('ob_later') : t('ob_close');
    const done=(didPrimary)=>{ $('onboardModal').classList.add('hidden'); resolve({primary:didPrimary, dont:dont.checked}); };
    prim.onclick=async ()=>{ try{ if(opts.onPrimary) await opts.onPrimary(); }catch(e){} done(true); };
    $('obLater').onclick=()=>done(false);
    $('onboardModal').classList.remove('hidden');
  });
}
// ── welcome carousel ───────────────────────────────────────────────────────────
// which page is centred in the (direction-agnostic) horizontal track
function wcActiveIndex(track){
  const tr=track.getBoundingClientRect(), tc=tr.left+tr.width/2;
  let best=0, bd=Infinity;
  [...track.children].forEach((pg,i)=>{ const r=pg.getBoundingClientRect();
    const d=Math.abs((r.left+r.width/2)-tc); if(d<bd){ bd=d; best=i; } });
  return best;
}
// a paginated carousel (dots, swipe) in #welcomeModal — used by both the welcome
// screen (with the "קראתי" flag) and the "what's new" screen (no flag).
function showCarousel(opts){
  return new Promise(resolve=>{
    const pages = opts.pages || [];
    $('wcTitle').textContent = opts.title || '';
    const track=$('wcTrack'); track.innerHTML='';
    track.style.direction = (LANG==='en') ? 'ltr' : 'rtl';
    pages.forEach(html=>{ const pg=el('div','wc-page'); pg.innerHTML=html; track.appendChild(pg); });
    const dots=$('wcDots'); dots.innerHTML='';
    const setActive=i=>[...dots.children].forEach((d,j)=>d.classList.toggle('active', j===i));
    pages.forEach((_,i)=>{ const d=el('button','wc-dot'+(i===0?' active':''));
      d.setAttribute('aria-label', String(i+1));
      d.onclick=()=>{ setActive(i); track.children[i].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); };
      dots.appendChild(d); });
    let st=null;
    track.onscroll=()=>{ clearTimeout(st); st=setTimeout(()=>setActive(wcActiveIndex(track)), 60); };
    const readWrap=document.querySelector('#welcomeModal .wc-read'), read=$('wcRead');
    if(opts.withRead){ readWrap.classList.remove('hidden'); read.checked=false;
      read.onchange=()=>{ if(read.checked) localStorage.setItem('as_welcome_read','1');
                          else localStorage.removeItem('as_welcome_read'); };
    } else { readWrap.classList.add('hidden'); }
    const done=()=>{ if(opts.withRead && read.checked) localStorage.setItem('as_welcome_read','1');
                     $('welcomeModal').classList.add('hidden'); resolve(); };
    $('wcClose').onclick=done;
    $('welcomeModal').classList.remove('hidden');
    requestAnimationFrame(()=>{ if(track.children[0]) track.children[0].scrollIntoView({inline:'center', block:'nearest'}); setActive(0); });
  });
}
function showWelcome(){
  const L=I18N[LANG]||I18N.he;
  return showCarousel({ title:t('welcome_title'), pages:L.welcome_pages||[L.welcome_body||''], withRead:true });
}
function showWhatsNewCarousel(){
  const L=I18N[LANG]||I18N.he;
  return showCarousel({ title:t('m_whatsnew'), pages:L.whatsnew_pages||[], withRead:false });
}
async function requestNotif(){ try{ if('Notification' in window) await Notification.requestPermission(); }catch(e){} }
async function runOnboarding(){
  const ver = window.APP_VERSION || '1.0';
  // 1a. welcome — shown on EVERY entry until the reader ticks "קראתי" (as_welcome_read).
  if(localStorage.getItem('as_welcome_read')!=='1'){
    await showWelcome();
  }
  // 1b. returning user: on re-entry after a version update, show "what's new" once.
  else if(localStorage.getItem('as_seen_ver') !== ver){
    await showWhatsNewCarousel();
  }
  localStorage.setItem('as_seen_ver', ver);
  // 2. recommend installing — unless already installed, or the user said "don't show again"
  if(!isInstalled() && localStorage.getItem('as_install_hide')!=='1'){
    const r=await showOnboard({ title:t('install_rec_title'), body:t('install_rec_body'),
      primaryLabel:t('install_rec_btn'), onPrimary:doInstall, dont:true });
    if(r.dont) localStorage.setItem('as_install_hide','1');
  }
  // 3. recommend notifications — only if permission is still undecided (not granted/denied)
  //    and the user hasn't dismissed it for good
  if(('Notification' in window) && Notification.permission==='default'
     && localStorage.getItem('as_notif_hide')!=='1'){
    const r=await showOnboard({ title:t('notif_rec_title'), body:t('notif_rec_body'),
      primaryLabel:t('notif_rec_btn'), onPrimary:requestNotif, dont:true });
    if(r.dont) localStorage.setItem('as_notif_hide','1');
  }
  // 4. first entry: offer the guided tour (audio needs a tap, so we prompt, not autoplay)
  if(localStorage.getItem('as_tour_seen')!=='1'){
    localStorage.setItem('as_tour_seen','1');
    $('tourPromptBody').textContent = t('tour_prompt_body');
    $('tourPrompt').classList.remove('hidden');
  }
}
$('tourPromptStart').onclick=()=>{ $('tourPrompt').classList.add('hidden'); startTour(); };
$('tourPromptSkip').onclick=()=>$('tourPrompt').classList.add('hidden');
let _onboardRan=false;
function triggerOnboarding(){
  if(_onboardRan) return; _onboardRan=true;
  // wait until the splash overlay AND the etching transition are fully gone
  const waitClear=()=>{
    if(document.getElementById('samaritan-splash') || document.getElementById('splash-image'))
      return setTimeout(waitClear, 200);
    runOnboarding();
  };
  setTimeout(waitClear, 300);
}
window.addEventListener('samaritanSplashComplete', triggerOnboarding);
// fallback if the splash is absent/skipped (e.g. reduced-motion): run shortly after load
setTimeout(triggerOnboarding, 2500);

// ── guided interactive tour ("סרטון הסבר") ───────────────────────────────────
// A live voiced walkthrough: it narrates (TTS, male-ish voice, in the UI language),
// spotlights each control with an arrow + caption, and DRIVES the real app as the
// demo (opens menus, runs a live search, opens the library …). Auto-advances per
// narration, with prev/next/mute/close; opens on first entry and from the menu.
const TOUR = { i:0, token:0, running:false, muted:false, auto:true, _t:null };
let TOUR_VOICES = [];
function tourLoadVoices(){ try{ TOUR_VOICES = speechSynthesis.getVoices()||[]; }catch(e){} }
if('speechSynthesis' in window){ tourLoadVoices(); speechSynthesis.onvoiceschanged = tourLoadVoices; }
function tourWait(ms){ return new Promise(r=>setTimeout(r, ms)); }
function tourPickVoice(){
  const lp = {he:'he', en:'en', ar:'ar'}[LANG] || 'he';
  const cands = TOUR_VOICES.filter(v=>(v.lang||'').toLowerCase().startsWith(lp));
  const male = cands.find(v=>/\b(male|david|daniel|maged|majed|fahad|fahed|tarik|naayf|hamza)\b/i.test(v.name||''));
  return male || cands[0] || TOUR_VOICES.find(v=>(v.lang||'').toLowerCase().startsWith(lp)) || null;
}
function tourSpeak(text, adv){
  clearTimeout(TOUR._t);
  const fallback = Math.max(3200, (text||'').length*60);
  if(TOUR.muted || !('speechSynthesis' in window) || !text){ TOUR._t=setTimeout(adv, fallback); return; }
  try{ speechSynthesis.cancel(); }catch(e){}
  const u=new SpeechSynthesisUtterance(text);
  const v=tourPickVoice();
  if(v){ u.voice=v; u.lang=v.lang; } else u.lang={he:'he-IL', en:'en-US', ar:'ar-SA'}[LANG]||'he-IL';
  u.pitch=0.8; u.rate=0.97; u.onend=adv;
  try{ speechSynthesis.speak(u); }catch(e){ TOUR._t=setTimeout(adv, fallback); return; }
  TOUR._t=setTimeout(adv, fallback+4000);   // safety, in case onend never fires
}
function tourPlace(el){
  const ring=$('tourRing'), arrow=$('tourArrow'), cap=$('tourCaption');
  if(!el){ ring.classList.remove('on'); arrow.classList.remove('on'); cap.classList.remove('top'); return; }
  const r=el.getBoundingClientRect();
  if(r.width<2 || r.height<2){ ring.classList.remove('on'); arrow.classList.remove('on'); return; }
  const pad=6;
  ring.style.left=(r.left-pad)+'px'; ring.style.top=(r.top-pad)+'px';
  ring.style.width=(r.width+pad*2)+'px'; ring.style.height=(r.height+pad*2)+'px';
  ring.classList.add('on');
  const lower = r.top > innerHeight*0.52;          // caption goes opposite the target
  cap.classList.toggle('top', lower);
  arrow.textContent = lower ? '▼' : '▲';
  arrow.style.left=(Math.min(Math.max(r.left+r.width/2-13, 8), innerWidth-26))+'px';
  arrow.style.top = lower ? (r.top-40)+'px' : (r.bottom+6)+'px';
  arrow.classList.add('on');
}
// scene setup helpers (drive the real app). Each navigation waits for the view to
// actually settle (the renders are async), so the demo never races ahead.
function tourWaitFor(cond, timeout=3000){
  return new Promise(res=>{ const t0=Date.now(); (function p(){
    let ok=false; try{ ok=cond(); }catch(e){}
    if(ok || Date.now()-t0>timeout) return res(ok);
    setTimeout(p, 80);
  })(); });
}
function tourClickFirst(sel){ const e=document.querySelector(sel); if(e){ e.click(); return true; } return false; }
async function tourToVerses(){
  if(S.view!=='verses'){
    try{ setDivision('standard'); }catch(e){}
    showBooks();                                              await tourWait(500);
    tourClickFirst('#content .listbtn, #content button');    await tourWait(560);  // → portion list
    tourClickFirst('#content .listbtn, #content button');    await tourWait(560);  // → chapter grid
    tourClickFirst('#content .cell, #content .grid button'); await tourWait(680);  // → verses
  }
  setToolbarFolded(false,false);
}
const TOUR_STEPS = [
  { pre:async()=>{ closeMenu(); showSearch(false); $('bookModal') && $('bookModal').classList.add('hidden');
                   $('dictModal').classList.add('hidden'); showBooks(); }, el:()=>null },
  { el:()=>$('btnSamaritan') },
  { pre:async()=>{ showBooks(); await tourWait(120); }, el:()=>document.querySelector('#content button') },
  { pre:tourToVerses, el:()=>document.querySelector('#content .vrow .num') || $('content') },
  { pre:async()=>{ await tourToVerses(); setToolbarFolded(true,true); await tourWait(1300); setToolbarFolded(false,true); await tourWait(300); },
    el:()=>$('tbHandle') },
  { pre:async()=>{ await tourToVerses(); }, el:()=>$('fontBtn') },
  { el:()=>$('translateBtn') },
  { el:()=>$('compareBtn') },
  { el:()=>$('variantsBtn') },
  { el:()=>$('samSrcBtn') },
  { pre:async()=>{ await tourToVerses(); }, el:()=>$('interpBtn') },
  { el:()=>$('dictBtn') },
  { pre:async()=>{ await tourToVerses(); }, el:()=>$('printBtn') },
  { el:()=>$('nextBtn') },
  { pre:async()=>{ showSearch(true); await tourWait(280); $('searchInput').value='בראשית'; }, el:()=>$('searchInput') },
  { pre:async()=>{ $('searchInput').value='בראשית'; doSearch(); await tourWait(750); },
    el:()=>document.querySelector('#searchResults .res-path') || $('searchResults') },
  { pre:async()=>{ if($('advPanel').classList.contains('hidden')) $('advBtn').click(); await tourWait(250); }, el:()=>$('advPanel') },
  { pre:async()=>{ $('advPanel') && $('advPanel').classList.add('hidden'); showSearch(false); showBooks(); openMenu(); await tourWait(300); },
    el:()=>document.querySelector('.menu-item[data-act="lang"]') },
  { pre:async()=>{ closeMenu(); openLibrary(); await tourWait(250); }, el:()=>$('libGrid') },
  { pre:async()=>{ $('libraryModal').classList.add('hidden'); openDictApp(); await tourWait(350); }, el:()=>document.querySelector('.dict-tabs') },
  { pre:async()=>{ $('dictModal').classList.add('hidden'); }, el:()=>null },
];
function tourNarration(){ return (I18N[LANG]||I18N.he).tour || []; }
function tourSetMuteIcon(){ $('tourMute').textContent = TOUR.muted ? '🔇' : '🔊'; }
function tourGo(i){
  if(!TOUR.running) return;
  if(i<0) i=0;
  if(i>=TOUR_STEPS.length) return endTour();
  TOUR.i=i; const tok=++TOUR.token; const step=TOUR_STEPS[i];
  $('tourPrev').disabled = (i===0);
  (async()=>{
    if(step.pre){ try{ await step.pre(); }catch(e){} }
    if(tok!==TOUR.token || !TOUR.running) return;
    await tourWait(step.wait||320);
    if(tok!==TOUR.token || !TOUR.running) return;
    const text=tourNarration()[i]||'';
    $('tourText').textContent=text;
    $('tourStep').textContent=(i+1)+' / '+TOUR_STEPS.length;
    tourPlace(step.el ? step.el() : null);
    let done=false;
    const adv=()=>{ if(done || tok!==TOUR.token || !TOUR.running) return; done=true; if(TOUR.auto) tourGo(i+1); };
    tourSpeak(text, adv);
  })();
}
function startTour(){
  closeMenu();
  ['welcomeModal','tourPrompt','onboardModal','infoModal'].forEach(id=>{ const m=$(id); if(m) m.classList.add('hidden'); });
  TOUR.running=true; TOUR.auto=true; TOUR.i=0;
  $('tourOverlay').classList.remove('hidden');
  tourSetMuteIcon();
  tourLoadVoices();
  tourGo(0);
}
function endTour(){
  TOUR.running=false; TOUR.token++;
  clearTimeout(TOUR._t);
  try{ speechSynthesis.cancel(); }catch(e){}
  $('tourOverlay').classList.add('hidden');
  $('bookModal') && $('bookModal').classList.add('hidden');
  $('dictModal').classList.add('hidden'); closeMenu();
  localStorage.setItem('as_tour_seen','1');
}
$('tourNext').onclick=()=>{ TOUR.auto=true; tourGo(TOUR.i+1); };
$('tourPrev').onclick=()=>{ TOUR.auto=true; tourGo(TOUR.i-1); };
$('tourEnd').onclick=endTour;
$('tourMute').onclick=()=>{ TOUR.muted=!TOUR.muted; tourSetMuteIcon();
  if(TOUR.muted){ try{ speechSynthesis.cancel(); }catch(e){} } };

// ── chanted-reading recordings (הקלטות קריאה לפי פרקים שומרוניים) ─────────────
// Manifest lives at /static/audio/readings/readings.json; each entry carries the
// book_id + sam chapter number it belongs to (ids drift across DB copies, numbers don't).
let READINGS = null;                       // null = not loaded (or absent)
const RD_SPEEDS = [1, 1.25, 1.5, 2, 0.75];     // tap ×N to cycle; saved per device
const RDAU = { audio:null, el:null, key:null, playing:false, ui:null, seekFix:null,
               speed: (parseFloat(localStorage.getItem('rd_speed')) || 1) };
// ── keeping the phone awake while it reads ───────────────────────────────────
// A recording that runs on into the next chapter — repeat on, or continuous
// reading on — is exactly the case where the reader puts the phone down. The
// screen then locks and playback dies with it. A screen wake lock holds it open
// for as long as something is actually playing, and is dropped the moment it
// stops, so it never keeps a screen alive for nothing.
//
// The lock is released by the browser whenever the page is hidden (switching
// apps, the user locking the screen by hand), so it is re-taken on the way back
// if the reading is still going.
const WAKE = { lock:null };
async function wakeKeep(){
  if(WAKE.lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try{
    WAKE.lock = await navigator.wakeLock.request('screen');
    WAKE.lock.addEventListener('release', () => { WAKE.lock = null; });
  }catch(e){ WAKE.lock = null; }   // refused (battery saver, an older browser) — play on regardless
}
function wakeRelease(){
  const l = WAKE.lock; WAKE.lock = null;
  if(l){ try{ l.release(); }catch(e){} }
}
// one place decides: something is playing → hold the screen; nothing is → let go
function wakeSync(){
  const playing = !!(RDAU && RDAU.playing) || !!(typeof ttsAudio !== 'undefined' && ttsAudio && !ttsAudio.paused);
  if(playing) wakeKeep(); else wakeRelease();
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible') wakeSync(); else WAKE.lock = null;
});

// ── continuous reading (הקראה רציפה) ─────────────────────────────────────────
// A flag on the chapter's play bar, remembered per device. While it is on, the end
// of a chapter's recording turns the page to the next chapter and goes on reading
// it at the same speed — with the same reading witness where that witness has this
// chapter too, and with another one where it does not. A run always stops at the
// end of the parasha (גמר פרשה), never crossing into the next one.
//   want = the witness the reader themself started with (kept for the whole run,
//          so a chapter that forced a substitute doesn't lose the original)
//   last = the witness actually heard last, the fallback when `want` is missing
const RDC = { on: localStorage.getItem('rd_cont')==='1', want:null, last:null, busy:false };
// ── repeat (השמעה חוזרת) ─────────────────────────────────────────────────────
// The play bar's repeat button, in the three states media players use:
//   0 off · 1 (🔂, a "1" in the loop) this reading over and over · 2 (🔁) the
//   whole parasha over and over, wrapping from its last chapter back to its
//   first. Either repeating state keeps going until the reader stops it.
const RDR = { mode: (parseInt(localStorage.getItem('rd_repeat'), 10) || 0) % 3 };
fetch('/static/audio/readings/readings.json')
  .then(r=>r.ok ? r.json() : null)
  .then(j=>{ READINGS=j;
    if(!j) return;
    // repaint whatever is on screen so ▶ / ♪ appear without a manual refresh
    if(S.view==='verses') paintVerses();
    else if(S.view==='sam_chapters' && S.curPid!=null) showSamChapters(S.curPid, S.portionName);
  })
  .catch(()=>{});
function readingFor(samNum, bookId){
  // Keyed by book + Samaritan chapter NUMBER (ids drift across DB copies after
  // admin merges/splits; numbers are the stable coordinate). Supports the
  // multi-book manifest (v3: {books:[...]}) and the single-book one (v2).
  if(!READINGS) return null;
  let list = null;
  if(Array.isArray(READINGS.books)){
    const b = READINGS.books.find(x=>x.book_id===bookId);
    list = b && b.chapters;
  } else if(READINGS.book_id===bookId){
    list = READINGS.chapters;
  }
  if(!Array.isArray(list)) return null;
  return list.find(c=>c.sam_ch_number===samNum) || null;
}
const rdFmt = s => { s=Math.max(0,s|0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

// ── masorot archive: historical reading witnesses (עדי קריאה), one file per
// STANDARD chapter. Loaded alongside the chanter's per-Samaritan-chapter set.
let MASOROT = null;
const CHANTER = 'מאיר בן יפנה ששוני';   // the reading witness of the original set
fetch('/static/audio/masorot/masorot.json')
  .then(r=>r.ok ? r.json() : null)
  .then(j=>{ MASOROT=j; if(j && S.view==='verses') paintVerses(); })
  .catch(()=>{});
function masorotFor(bookId, stdChapter){
  if(!MASOROT || !Array.isArray(MASOROT.items)) return [];
  return MASOROT.items.filter(it=>it.book_id===bookId && it.chapter===stdChapter);
}
// exact per-reader Samaritan-chapter witnesses: time ranges INSIDE the masorot
// files (no separate audio), computed offline by the reading pipeline.
let WITNESSES = null;
fetch('/static/audio/witnesses.json')
  .then(r=>r.ok ? r.json() : null)
  .then(j=>{ WITNESSES=j; if(j && S.view==='verses') paintVerses(); })
  .catch(()=>{});
function witnessesFor(bookId, samNum){
  if(!WITNESSES || !Array.isArray(WITNESSES.items)) return [];
  return WITNESSES.items.filter(it=>it.book_id===bookId && it.sam_ch_number===samNum);
}
// an option's audio = list of segments; plain files are a single full-length segment
const rdSegs = rec => rec.segs || [{file:rec.file, t0:0, t1:rec.duration||1e9}];
const rdKey  = rec => rec.segs ? ('segs:'+rec.segs.map(s=>s.file+'@'+s.t0).join('|')) : rec.file;
const _vnum = v => { const m=String(v==null?'':v).match(/\d+/); return m?+m[0]:null; };
// witness label: which verses of which standard chapter this file actually covers
function _witnessLabel(it, partial){
  return partial ? ('פרק '+it.chapter+', פסוקים '+it.v1+'–'+it.v2) : ('פרק '+it.chapter);
}
// every reading-witness option for the chapter currently on screen.
// Samaritan mode: the chanter's exact sam-chapter cut, plus archive files whose
// (standard chapter, verse span) OVERLAPS the sam chapter's true span — computed
// from the first/last verse's standard coordinates, so multi-part chapter files
// attach only to the sam chapters they actually contain.
function readingOptions(){
  const opts = [];
  if(S.chMode==='samaritan'){
    const rec = readingFor(S.curChNum, S.book);
    if(rec) opts.push({reader:CHANTER, file:rec.file, duration:rec.duration, name:rec.name});
    const exact = witnessesFor(S.book, S.curChNum);
    for(const w of exact)
      opts.push({reader:w.reader, segs:w.segs, duration:w.duration,
                 name:'פרק שומרוני '+S.curChNum, vlabel:''});
    const _covered = new Set(exact.map(w=>w.reader));
    if(S.verses && S.verses.length){
      const f=S.verses[0], l=S.verses[S.verses.length-1];
      const c1=parseInt(f.jchapter,10), c2=parseInt(l.jchapter,10);
      const v1=_vnum(f.masnum!=null?f.masnum:f.number), v2=_vnum(l.masnum!=null?l.masnum:l.number);
      if(c1) for(let ch=c1; ch<=(c2||c1); ch++){
        for(const it of masorotFor(S.book, ch)){
          if(_covered.has(it.reader)) continue;    // exact sam-cut already offered
          const lo = (ch===c1) ? v1 : 1, hi = (ch===c2) ? v2 : 999;
          if(lo!=null && hi!=null && it.v2 >= lo && it.v1 <= hi){
            const partial = !(it.v1<=1 && it.v2>=900) && (it.v1>1 || it.v2<900);
            opts.push({reader:it.reader, file:it.file, duration:it.duration,
                       name:_witnessLabel(it, it.v1>1 || (S.verses && it.v2<hi)),
                       vlabel:(it.v1>1||it.v2<999)?(it.v1+'–'+it.v2):''});
          }
        }
      }
    }
  } else {
    for(const it of masorotFor(S.book, S.curChNum))
      opts.push({reader:it.reader, file:it.file, duration:it.duration,
                 name:_witnessLabel(it, false),
                 vlabel:(it.v1>1||it.v2<999)?(it.v1+'–'+it.v2):''});
  }
  return opts;
}
// which witness the bar opens with: the one the reader picked by hand (kept per
// device), else — inside a continuous run — the one it started with, else the one
// last heard, and only then the chapter's first option.
function rdPickOption(opts){
  const saved = localStorage.getItem('rd_reader');
  return opts.find(o=>o.reader===saved)
      || (RDC.on && RDC.want && opts.find(o=>o.reader===RDC.want))
      || (RDC.on && RDC.last && opts.find(o=>o.reader===RDC.last))
      || opts[0];
}
// a play the reader asked for: it also sets the witness the continuous run follows
function rdUserPlay(rec, seekTo){ RDC.want = rec.reader; return readingToggle(rec, seekTo); }
function rdLastOfPortion(){       // this chapter closes the parasha → nowhere to continue
  return !(Array.isArray(S.chList) && S.chList.length) || S.chIdx >= S.chList.length-1;
}
// the repeat button: the players' own loop glyph, carrying a "1" in state 1
// The loop is only a frame, drawn open so the middle stays clear: state 1 stands a
// play inside it with a "1" knocked out of the play itself, state 2 the same play
// without the "1", and the idle state the bare loop.
function rdRepeatSvg(mode){
  const play = '<path d="M8.4 8.1 16.5 12l-8.1 3.9z" fill="currentColor" stroke="none"/>';
  const one  = '<text x="10.4" y="14.3" text-anchor="middle" font-size="7.2" font-weight="700"'
             + ' stroke="none" fill="var(--rd-rep-bg,#fdfbf5)">1</text>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
       + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
       + '<polyline points="17 2 21 6 17 10"/><path d="M3 12V10a4 4 0 0 1 4-4h14"/>'
       + '<polyline points="7 22 3 18 7 14"/><path d="M21 12v2a4 4 0 0 1-4 4H3"/>'
       + (mode ? play : '') + (mode===1 ? one : '')
       + '</svg>';
}
function rdRepeatBtn(){
  const b = el('button','reading-repeat');
  const paint = ()=>{
    b.innerHTML = rdRepeatSvg(RDR.mode);
    b.classList.toggle('on', RDR.mode>0);
    b.title = RDR.mode===1 ? 'השמעה חוזרת — ההקראה הזו שוב ושוב'
            : RDR.mode===2 ? 'השמעה חוזרת — הפרשה כולה שוב ושוב'
            : 'השמעה חוזרת';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', RDR.mode>0 ? 'true' : 'false');
  };
  paint();
  b.onclick = ()=>{
    RDR.mode = (RDR.mode + 1) % 3;               // off → this reading → the parasha → off
    localStorage.setItem('rd_repeat', String(RDR.mode));
    paint();
    toast(RDR.mode===1 ? 'השמעה חוזרת: ההקראה הזו תושמע שוב ושוב'
        : RDR.mode===2 ? 'השמעה חוזרת: הפרשה כולה תושמע שוב ושוב'
        : 'השמעה חוזרת כבויה');
  };
  return b;
}
function rdContChip(){
  const b = el('button','reading-cont'+(RDC.on?' on':''), 'הקראה רציפה');
  b.setAttribute('aria-pressed', RDC.on ? 'true' : 'false');
  b.title = rdLastOfPortion()
    ? 'הקראה רציפה — זה הפרק האחרון בפרשה, וההקראה נעצרת בסופו'
    : 'הקראה רציפה — בתום הפרק האפליקציה עוברת לפרק הבא וממשיכה להשמיע, עד גמר הפרשה';
  b.onclick = ()=>{
    RDC.on = !RDC.on;
    localStorage.setItem('rd_cont', RDC.on ? '1' : '0');
    b.classList.toggle('on', RDC.on);
    b.setAttribute('aria-pressed', RDC.on ? 'true' : 'false');
    if(RDC.on){ if(RDAU.ui && RDAU.ui.rec) RDC.want = RDAU.ui.rec.reader; }
    else { RDC.last = null; }
    toast(RDC.on ? 'הקראה רציפה: מעבר אוטומטי לפרק הבא, עצירה בגמר הפרשה'
                 : 'הקראה רציפה כבויה');
  };
  return b;
}
function readingBar(c){
  RDAU.ui = null;
  const opts = readingOptions(); if(!opts.length) return;
  let rec = rdPickOption(opts);
  const bar = el('div','reading-bar');
  const head = el('div','reading-head');
  const row = el('div','reading-row');
  const btn = el('button','reading-btn');
  const isCur = RDAU.audio && RDAU.key===rdKey(rec);
  btn.innerHTML = (isCur && RDAU.playing) ? '&#10074;&#10074;' : '&#9654;';
  btn.title = 'האזנה לעד קריאה';
  btn.onclick = ()=>rdUserPlay(RDAU.ui.rec);
  const title = el('div','reading-title');
  const renderTitle = r => { title.innerHTML = 'האזנה לעד קריאה &middot; ' + esc(r.reader); };
  renderTitle(rec);
  head.appendChild(title);
  head.appendChild(rdRepeatBtn());     // RTL: lands immediately to the right of the flag
  head.appendChild(rdContChip());
  bar.appendChild(head);
  bar.appendChild(row);
  row.appendChild(btn);
  const seek = el('input','reading-seek'); seek.type='range'; seek.min=0; seek.step=0.1;
  seek.max = rec.duration || 0; seek.value = isCur ? rdVirtual() : 0;
  seek.oninput = ()=>{ const r=RDAU.ui.rec;
                       rdUserPlay(r, parseFloat(seek.value)); };
  row.appendChild(seek);
  const time = el('span','reading-time', rdFmt(isCur?rdVirtual():0)+' / '+rdFmt(rec.duration||0));
  row.appendChild(time);
  // witness picker — only when this chapter has more than one reading witness
  if(opts.length > 1){
    const sel = el('select','reading-witness');
    opts.forEach((o,i)=>{ const op=document.createElement('option');
      op.value=i;
      // distinguish multiple parts by the same witness via their verse span
      op.textContent = o.reader + (o.vlabel ? (' (פס׳ '+o.vlabel+')') : '');
      if(o===rec) op.selected=true; sel.appendChild(op); });
    sel.onchange = ()=>{
      const wasPlaying = RDAU.playing;
      const o = opts[+sel.value];
      localStorage.setItem('rd_reader', o.reader);
      RDC.want = o.reader;                  // a continuous run follows the new choice too
      RDAU.ui.rec = o; renderTitle(o);
      seek.max = o.duration || 0; seek.value = 0;
      time.textContent = rdFmt(0)+' / '+rdFmt(o.duration||0);
      readingStop();
      if(wasPlaying) readingToggle(o);      // switching mid-play continues with the new witness
    };
    row.appendChild(sel);
  }
  const spd = el('button','reading-speed','×'+RDAU.speed);
  spd.title = 'מהירות ההשמעה';
  spd.onclick = ()=>{
    RDAU.speed = RD_SPEEDS[(RD_SPEEDS.indexOf(RDAU.speed)+1) % RD_SPEEDS.length] || 1;
    localStorage.setItem('rd_speed', RDAU.speed);
    if(RDAU.audio) RDAU.audio.playbackRate = RDAU.speed;
    spd.textContent = '×'+RDAU.speed;
  };
  row.appendChild(spd);
  RDAU.ui = { btn, seek, time, rec };
  c.appendChild(bar);
}
function rdVirtual(){       // playback position on the option's own 0..duration axis
  if(!RDAU.audio || !RDAU.rec) return 0;
  const s = rdSegs(RDAU.rec)[RDAU.segIdx||0];
  return (RDAU.segBase||0) + Math.max(0, RDAU.audio.currentTime - s.t0);
}
function readingSync(){
  if(!RDAU.ui) return;
  const cur = RDAU.audio && RDAU.key===rdKey(RDAU.ui.rec);
  RDAU.ui.btn.innerHTML = (cur && RDAU.playing) ? '&#10074;&#10074;' : '&#9654;';
  if(cur){ const vt = rdVirtual();
           RDAU.ui.seek.value = vt;
           RDAU.ui.time.textContent = rdFmt(vt)+' / '+rdFmt(RDAU.ui.rec.duration||0); }
}
// ONE audio element for the whole session, reused for every segment, every witness
// and every chapter. A media element is cleared for programmatic play() only once
// the reader has tapped THAT element, so reusing it is what lets the next segment —
// or the next chapter of a continuous run — start without a fresh tap (iOS).
function rdEl(){
  if(!RDAU.el){ const a = new Audio(); a.preload='auto'; RDAU.el = a; }
  return RDAU.el;
}
function rdDetach(a){          // drop the previous play's handlers off the shared element
  if(!a) return;
  a.onplay=a.onpause=a.onended=a.ontimeupdate=a.onerror=null;
  if(RDAU.seekFix){ a.removeEventListener('loadedmetadata', RDAU.seekFix); RDAU.seekFix=null; }
}
function rdPlayFrom(vt){
  const segs = rdSegs(RDAU.rec);
  let i = 0, acc = 0;
  while(i < segs.length-1 && vt >= acc + (segs[i].t1 - segs[i].t0)){ acc += segs[i].t1 - segs[i].t0; i++; }
  RDAU.segIdx = i; RDAU.segBase = acc;
  const s = segs[i];
  const a = rdEl();
  try{ a.pause(); }catch(e){}
  rdDetach(a);
  const want = new URL(s.file, location.href).href;
  if(a.src !== want) a.src = s.file;    // successive segments of one file: no reload
  a.playbackRate = RDAU.speed;
  RDAU.audio = a;
  // seek even to 0: the shared element is left wherever the previous cut ended, so a
  // replay of a segment that starts at 0 has to be rewound rather than resumed
  const pos = s.t0 + (vt - acc);
  const st = ()=>{ try{ a.currentTime=pos; }catch(e){} };
  st();                                 // …and again once metadata is in, if it wasn't yet
  RDAU.seekFix = ()=>{ RDAU.seekFix=null; st(); };
  a.addEventListener('loadedmetadata', RDAU.seekFix, {once:true});
  const advance = ()=>{ const done = RDAU.segBase + (s.t1 - s.t0);
                        if(RDAU.segIdx < segs.length-1) rdPlayFrom(done); else rdFinish(); };
  a.onplay  = ()=>{ RDAU.playing=true;
                    if(a.playbackRate!==RDAU.speed) a.playbackRate=RDAU.speed;   // a fresh src can reset it
                    wakeSync(); readingSync(); };
  a.onpause = ()=>{ RDAU.playing=false; wakeSync(); readingSync(); };
  a.onended = advance;
  a.ontimeupdate = ()=>{ if(a.currentTime >= s.t1 - 0.04) advance(); else readingSync(); };
  a.onerror = ()=>{ const run = RDC.on && RDC.last; readingStop();
                    if(run) toast('ההקלטה לא נטענה — ההקראה הרציפה נעצרה'); };
  const pr = a.play();
  if(pr && pr.catch) pr.catch(()=>{});   // refusals are reported by whoever asked for the play
  return pr;
}
function readingToggle(rec, seekTo){
  const key = rdKey(rec);
  if(RDAU.audio && RDAU.key===key && seekTo===undefined){
    if(RDAU.playing){ RDAU.audio.pause(); return null; }
    const pr = RDAU.audio.play();
    if(pr && pr.catch) pr.catch(()=>{});
    return pr;
  }
  if(!(RDAU.audio && RDAU.key===key)) readingStop();
  if(typeof ttsStop==='function') ttsStop();     // recording and TTS are exclusive
  RDAU.rec = rec; RDAU.key = key;
  return rdPlayFrom(seekTo || 0);
}
function readingStop(){
  if(RDAU.audio){ try{ RDAU.audio.pause(); }catch(e){} rdDetach(RDAU.audio); }
  RDAU.audio=null; RDAU.key=null; RDAU.rec=null; RDAU.segIdx=0; RDAU.segBase=0; RDAU.playing=false;
  wakeSync();          // nothing is reading any more — let the screen sleep
  readingSync();
}
// the chapter's recording played out to its end
function rdFinish(){
  if(RDR.mode===1 && RDAU.rec){ rdPlayFrom(0); return; }   // 🔂 — the same reading again
  const reader = RDAU.rec && RDAU.rec.reader;
  readingStop();
  // 🔁 carries on through the parasha even when the continuous flag is off: there
  // is no other way to repeat a parasha than to read it through
  if(RDR.mode===2 || RDC.on) rdContinue(reader);
}
// …and, with the flag on, the reading goes on into the next chapter of the parasha.
async function rdContinue(reader){
  if(RDC.busy) return;
  if(S.view!=='verses') return;                  // the reader has left the chapter meanwhile
  const wrap = rdLastOfPortion();                // standing on the parasha's last chapter
  if(wrap && RDR.mode!==2){                      // גמר פרשה — a run never crosses it
    RDC.last = null;
    toast('גמר פרשה — ההקראה הרציפה נעצרה');
    return;
  }
  RDC.last = reader || RDC.last;
  const chId = S.curChId;
  RDC.busy = true;
  // 🔁 turns back to the parasha's first chapter instead of stepping past its last
  const delta = wrap ? -S.chIdx : 1;
  try{ await stepChapter(delta); }
  finally{ RDC.busy = false; }
  if(S.view!=='verses') return;
  if(!wrap && S.curChId===chId) return;          // the page never turned
  if(wrap) toast('סוף הפרשה — חוזר לתחילתה');
  if(!RDAU.ui){                                        // the new chapter has no witness at all
    RDC.last = null;
    toast('אין עד קריאה לפרק זה — ההקראה הרציפה נעצרה');
    return;
  }
  const rec = RDAU.ui.rec;                             // same witness where it exists, else another
  if(reader && rec.reader!==reader) toast('עד הנוסח הוחלף: ' + rec.reader);
  const pr = readingToggle(rec);                       // same speed: RDAU.speed carries over
  if(pr && pr.catch) pr.catch(()=>toast('ההשמעה האוטומטית נחסמה — הקישו ▶ להמשך'));
}

// ── start ────────────────────────────────────────────────────────────────────
showBooks();
applyI18n();
updateBmMenu();
