'use strict';
// Web edition of the Samaritan Torah app. Talks to the Flask API (which reuses
// the app's own query layer) and reproduces the Kivy UI's behaviour. RTL and
// line-wrapping are native to the browser, so the verse text is rendered plainly
// and only the Samaritan script needs per-glyph spans.

const $ = id => document.getElementById(id);
// cache every GET response — the DB is read-only, so results never change within
// a session. Re-navigating (books↔portions↔chapters↔verses) becomes instant.
const _apiCache = new Map();
const api = async (path) => {
  if (_apiCache.has(path)) return _apiCache.get(path);
  const data = await (await fetch('/api/' + path)).json();
  _apiCache.set(path, data);
  return data;
};
const apiPost = async (path, body) =>
  (await fetch('/api/' + path, {method:'POST', headers:{'Content-Type':'application/json'},
                                body:JSON.stringify(body)})).json();
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls;
                                 if(html!=null)e.innerHTML=html; return e; };

// ── i18n: interface translation (he / en / ar) ───────────────────────────────
const I18N = {
  he: {
    app_title:'התורה השומרונית הישראלית', brand_top:'אבני שהם', div_jewish:'חלוקה יהודית', div_sam:'חלוקה שומרונית',
    spread:'פריסת פרקים', next_portion:'‹ פרשה הבאה', prev_portion:'פרשה קודמת ›',
    next_chapter:'‹ פרק הבא', prev_chapter:'פרק קודם ›', goto_book:'עבור ל',
    share:'שתף', export_excel:'ייצוא לאקסל', no_results_xls:'אין תוצאות לייצוא',
    back:'‹ חזור', back_t:'חזור', browse:'עיון', search:'חיפוש', dict:'מילון מילים',
    font_sam:'כתב שומרוני', font_heb:'כתב עברי', interp:'פירוש הפסוק', commentary:'פרשנות יהודית',
    compare:'השוואת נוסחים', variants:'חילופי נוסח', samsrc:'ממקור שומרון', translate:'תרגומי התורה',
    t_aramaic:'תרגום: ארמי', t_arabic:'תרגום: ערבי', t_english:'תרגום: אנגלית',
    search_ph:'חפש מילה', adv_search:'⚙ חיפוש מתקדם', search_help_btn:'❔ עזרה לחיפוש',
    flag_exact:'חיפוש מדויק', flag_meanings:'הצג פירוש המילים', flag_root:'לפי שורש המילה',
    flag_finals:'התעלם מסופיות', flag_aram:'חפש בתרגום הארמי', root_label:'שורש לחיפוש:',
    adv_hint:'או תוכל להשתמש ב-<b>?</b> או <b>*</b> כדי להחליף תו או מחרוזת תווים. לדוגמה: <b>א?ר</b> או <b>כא*</b>',
    apply:'אישור', menu:'תפריט', m_calendar:'חשבן קשטה — לוח השנה השומרוני',
    m_genealogy:'אילן היוחסין השומרוני המלא', m_install:'התקנת אפליקציה', m_lang:'שנה שפה',
    m_whatsnew:'מה חדש?', m_help:'עזרה למשתמש', m_version:'גרסא נוכחית', m_contact:'צור קשר',
    share_title:'שיתוף', email:'אימייל', close:'סגור',
    copied:'הטקסט הועתק', copy_fail:'ההעתקה נכשלה', share_copy:'העתקה ללוח',
    to_aramaic:'התרגום הארמי', to_arabic:'התרגום לערבית', to_english:'התרגום לאנגלית',
    cmp_title:'בחר נוסח להשוואה', cv_masoretic:'נוסח המסורה', cv_septuagint:'תרגום השבעים',
    cmp_sam:'נוסח שומרון', cmp_info:'מידע על הנוסח',
    ci_masoretic:'נוסח המסורה הוא הנוסח היהודי המקובל של המקרא, שנמסר, נוקד וטוים בידי בעלי המסורה בטבריה (סוף האלף הראשון לסה״נ). הוא הבסיס לרוב מהדורות התנ״ך הנדפסות.',
    ci_septuagint:'תרגום השבעים (LXX) הוא התרגום היווני הקדום של התורה, שנעשה באלכסנדריה במאה ה־3 לפנה״ס. הוא משקף לעיתים נוסח עברי קדום השונה מן המסורה, ובמקומות רבים קרוב דווקא לנוסח השומרוני.',
    c_name:'שם מלא', c_email:'כתובת מייל', c_msg:'הודעה (עד 100 מילים)', c_send:'שלח', c_cancel:'ביטול',
    lang_save_q:'האם ברצונך לשמור הגדרה זו?', lang_save_note:'הבחירה תישמר במכשיר זה לפעמים הבאות.',
    save_yes:'כן, שמור', save_no:'לא, רק הפעם',
    samsrc_pick:'ממקור שומרון — בחר מקור', checking_sources:'בודק מקורות זמינים…',
    no_sam_source:'אין מקור שומרוני זמין לפסוקים אלה', back_sources:'‹ מקורות',
    src_tibat:'תיבת מרקה', src_eyalk:'מן המסורת השומרונית', src_tzdaka:'פירוש צדקה אל-חכים',
    src_sir:'סוד הלבבות', src_shyt:'שו"ת — יעקב בן אהרן הכהן',
    variants_title:'חילופי נוסח — מהדורת פון גאל',
    no_variants:'אין חילופי נוסח לפסוקים אלה.',
    app_hint:'המילים המודגשות בפסוק נושאות חילופי נוסח — לחץ על מילה כדי לקפוץ לחילופיה, ולחץ על חילוף כדי לחזור למילה.',
    dict_hint:'מילון מילים — חץ ⬆ ליד התרגום הארמי מציין שיש תוצאות נוספות. הקש על השורה לפירוש המלא, למיקומים בתורה ולצורות נוספות מתוך מילון א. טל', no_dict:'אין מילון זמין לפסוק זה',
    more_results:'תוצאות נוספות', tal_meaning:'פירוש מתוך המילון', tal_torah:'מופעים בתורה', tal_forms:'צורות וערכים נוספים', tal_page:'עמ׳', tal_none:'לא נמצא ערך עבור מילה זו במילון א. טל.', tal_click_precise:'לחץ לפירוש המדויק מתוך מילון א. טל ⬅',
    m_library:'הספרייה השומרונית', m_dict_aram:'המילון הארמי-עברי השומרוני',
    m_tm_book:'תיבת מרקה (מימר מרקה)', tm_title:'תיבת מרקה — מימר מרקה', tm_search_ph:'חיפוש בתוך הספר…',
    tm_toc_hint:'בחר מימר לעיון:', tm_back_toc:'‹ תוכן העניינים', tm_back_chapter:'‹ חזרה לפרק',
    tm_words_btn:'מילון מילים', tm_words_title:'מילון מילים — מתוך מילון א. טל', tm_col_root:'שורש',
    tm_no_results:'לא נמצאו תוצאות', tm_sections_n:'קטעים', tm_open_verse:'פתח את הפסוק באפליקציה',
    m_tz_book:'פירוש צדקה אל-חכים (בראשית)', tz_title:'פירוש צדקה אל-חכים — בראשית',
    tz_toc_hint:'בחר פרק לעיון:', tz_chapter_label:'פרק', tz_arabic_pending:'התרגום לערבית בהכנה — מוצג הנוסח העברי.',
    rd_he:'עברית', rd_ar:'ערבית', rd_aram:'ארמית', rd_show:'הצג:',
    dict_app_title:'המילון הארמי-עברי השומרוני — א. טל', dict_app_ph:'הקלד מילה בארמית או שורש…', dict_app_search:'חפש', dict_app_hint:'חיפוש מילה במילון הארמית של השומרונים מאת א. טל: שורש · פירוש עברי מתוך המילון · מיקומים בתורה.', dict_app_empty:'לא נמצא ערך. נסה את שורש המילה.',
    dict_tab_search:'חיפוש', dict_tab_index:'אינדקס', dict_tab_pages:'דפדוף עמודים',
    dict_index_hint:'דפדף באינדקס המילון (לפי סדר א״ב). הקלד אות/מילה לקפיצה.', dict_index_ph:'קפוץ לאות/מילה…',
    dict_pages_hint:'דפדף בעמודי המילון.', dict_page_label:'עמוד', dict_prev:'‹ הקודם', dict_next:'הבא ›',
    dict_in_dict:'נמצא במילון כערך:', dict_form_hint:'לחץ על צורה לקבלת כל מיקומיה במילון',
    dict_locations_title:'מיקומים במילון', dict_loc_count:'מופעים', dict_open_page:'פתח עמוד במילון',
    ob_dont:'אל תציג שוב', ob_later:'אחר כך', ob_close:'סגור', wc_read:'קראתי',
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
    col_word:'מילה', col_aram:'תרגום ארמי', col_heb:'פירוש עברי', col_tal:'מילון טל', col_arabic:'ערבית',
    searching:'מחפש…', no_interp:'פירוש אינו זמין לפסוקים אלה',
    help_title:'עזרה למשתמש', search_help_title:'עזרה לחיפוש', install_title:'התקנת אפליקציה',
    m_admin:'כניסת מנהל', adm_user:'שם משתמש', adm_pass:'סיסמה', adm_login:'כניסה',
    adm_bad:'שם המשתמש או הסיסמה אינם נכונים.', admin_on:'מצב עריכה פעיל — לחץ על העיפרון שליד הטקסט.',
    edit_title:'עריכת טקסט', edit_save:'שמור שינוי', edit_saved:'השינוי נשמר.', edit_err:'שמירה נכשלה.',
    merge_next:'אחד עם הבא', split_chapter:'פצל פרק', split_verse:'פצל פסוק',
    split_pick:'בחר את הפסוק שאחריו יחל הפרק החדש (לחץ על מספר פסוק)', split_cancel:'ביטול פיצול',
    vsplit_pick:'בחר פסוק לפיצול (לחץ על מספר פסוק)',
    vsplit_title:'פיצול פסוק', vsplit_btn:'פצל פסוק',
    vsplit_hint:'החלק הראשון יישאר במספר הפסוק הנוכחי; החלק השני יהפוך לפסוק חדש עם מקף ומספר רץ (נראה בחלוקה השומרונית בלבד).',
    vsplit_p1:'חלק ראשון — נשאר פסוק', vsplit_p2:'חלק שני — פסוק חדש',
    vsplit_err:'יש למלא את שני החלקים.', vsplit_ok:'הפסוק פוצל. הפסוק החדש:',
    renum:'שנה מספר', renum_pick:'בחר פסוק לשינוי מספר (לחץ על מספר פסוק)',
    renum_title:'שינוי מספר פסוק', renum_cur:'מספר נוכחי:', renum_empty:'יש להזין מספר.',
    renum_cascade_q:'לשנות את כל הפסוקים הבאים בהתאם?', renum_cascade_yes:'כן, שנה את כל הבאים',
    renum_only_this:'רק פסוק זה', renum_ok:'מספר הפסוק עודכן.',
    merge_q:'לאחד את הפרק הנוכחי עם הפרק הבא? המספור בספר יתעדכן.', split_q:'לפצל את הפרק אחרי פסוק ',
    merged_ok:'הפרקים אוחדו.', split_ok:'הפרק פוצל.', confirm_yes:'אישור',
    bm_add:'הוסף סימניה לפרק זה', bm_my:'הסימניות שלי', bm_delete:'מחק נבחרות',
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
    compare:'Compare versions', variants:'Textual variants', samsrc:'Samaritan sources', translate:'Torah translations',
    t_aramaic:'Translation: Aramaic', t_arabic:'Translation: Arabic', t_english:'Translation: English',
    search_ph:'Search a word', adv_search:'⚙ Advanced search', search_help_btn:'❔ Search help',
    flag_exact:'Exact match', flag_meanings:'Show word meanings', flag_root:'By word root',
    flag_finals:'Ignore final letters', flag_aram:'Search the Aramaic', root_label:'Root to search:',
    adv_hint:'You can use <b>?</b> or <b>*</b> to replace a letter or a string. E.g. <b>א?ר</b> or <b>כא*</b>',
    apply:'Apply', menu:'Menu', m_calendar:'Samaritan calendar (Ḥešbon Qašta)',
    m_genealogy:'Full Samaritan genealogy', m_install:'Install app', m_lang:'Change language',
    m_whatsnew:"What's new?", m_help:'Help', m_version:'Current version', m_contact:'Contact us',
    share_title:'Share', email:'Email', close:'Close',
    copied:'Text copied', copy_fail:'Copy failed', share_copy:'Copy to clipboard',
    to_aramaic:'Aramaic translation', to_arabic:'Arabic translation', to_english:'English translation',
    cmp_title:'Choose a version to compare', cv_masoretic:'Masoretic Text', cv_septuagint:'Septuagint',
    cmp_sam:'Samaritan', cmp_info:'About this version',
    ci_masoretic:'The Masoretic Text is the authoritative Jewish text of the Hebrew Bible, transmitted and vocalised by the Masoretes of Tiberias (late 1st millennium CE). It underlies most printed editions of the Bible.',
    ci_septuagint:'The Septuagint (LXX) is the ancient Greek translation of the Torah, made in Alexandria in the 3rd century BCE. It sometimes reflects an early Hebrew text differing from the Masoretic — and in many places agrees with the Samaritan.',
    c_name:'Full name', c_email:'Email address', c_msg:'Message (up to 100 words)', c_send:'Send', c_cancel:'Cancel',
    lang_save_q:'Save this language preference?', lang_save_note:'It will be saved on this device for next time.',
    save_yes:'Yes, save', save_no:'No, just now',
    samsrc_pick:'Samaritan sources — choose a source', checking_sources:'Checking available sources…',
    no_sam_source:'No Samaritan source for these verses', back_sources:'‹ Sources',
    src_tibat:'Tībåt Mårqe', src_eyalk:'From the Samaritan tradition', src_tzdaka:"Ṣadaqah al-Ḥakīm's commentary",
    src_sir:'Sīr al-Qulūb (Secret of Hearts)', src_shyt:'Responsa of Jacob ben Aaron',
    variants_title:'Textual variants — von Gall edition',
    no_variants:"No textual variants for these verses.",
    app_hint:'The emphasised words in the verse carry textual variants — tap a word to jump to its variants, and tap a variant to jump back to the word.',
    dict_hint:"Word dictionary — a ⬆ arrow beside the Aramaic marks further results. Tap a row for the full entry, Torah occurrences and related forms from A. Tal's dictionary", no_dict:'No dictionary for this verse',
    more_results:'More results', tal_meaning:'Meaning from the dictionary', tal_torah:'Occurrences in the Torah', tal_forms:'Further forms & entries', tal_page:'p.', tal_none:'No entry found for this word in A. Tal\'s dictionary.', tal_click_precise:'Tap for the exact entry from A. Tal\'s dictionary ⬅',
    m_library:'The Samaritan Library', m_dict_aram:'The Samaritan Aramaic–Hebrew Dictionary',
    m_tm_book:'Tibåt Mårqe (Memar Marqah)', tm_title:'Tibåt Mårqe — Memar Marqah', tm_search_ph:'Search within the book…',
    tm_toc_hint:'Choose a Memar to read:', tm_back_toc:'‹ Contents', tm_back_chapter:'‹ Back to the chapter',
    tm_words_btn:'Word glossary', tm_words_title:'Word glossary — from A. Tal’s dictionary', tm_col_root:'Root',
    tm_no_results:'No results found', tm_sections_n:'sections', tm_open_verse:'Open the verse in the app',
    m_tz_book:'Ṣadaqah al-Ḥakīm (Genesis)', tz_title:'Ṣadaqah al-Ḥakīm — Genesis',
    tz_toc_hint:'Choose a chapter:', tz_chapter_label:'Chapter', tz_arabic_pending:'The Arabic is being prepared — showing the Hebrew.',
    rd_he:'Hebrew', rd_ar:'Arabic', rd_aram:'Aramaic', rd_show:'Show:',
    dict_app_title:'The Samaritan Aramaic–Hebrew Dictionary — A. Tal', dict_app_ph:'Type an Aramaic word or root…', dict_app_search:'Search', dict_app_hint:'Search the Dictionary of Samaritan Aramaic by A. Tal: root · Hebrew meaning from the dictionary · Torah occurrences.', dict_app_empty:'No entry found. Try the word\'s root.',
    dict_tab_search:'Search', dict_tab_index:'Index', dict_tab_pages:'Browse pages',
    dict_index_hint:'Browse the dictionary index (A–Z). Type a letter/word to jump.', dict_index_ph:'Jump to a letter/word…',
    dict_pages_hint:'Browse the dictionary pages.', dict_page_label:'Page', dict_prev:'‹ Prev', dict_next:'Next ›',
    dict_in_dict:'Found in the dictionary as a head-word:', dict_form_hint:'Tap a form for all its locations in the dictionary',
    dict_locations_title:'Locations in the dictionary', dict_loc_count:'occurrences', dict_open_page:'Open the dictionary page',
    ob_dont:'Don\'t show again', ob_later:'Later', ob_close:'Close', wc_read:'I have read',
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
    col_word:'Word', col_aram:'Aramaic', col_heb:'Hebrew meaning', col_tal:'Tal dictionary', col_arabic:'Arabic',
    searching:'Searching…', no_interp:'No commentary for these verses',
    help_title:'Help', search_help_title:'Search help', install_title:'Install app',
    m_admin:'Admin login', adm_user:'Username', adm_pass:'Password', adm_login:'Sign in',
    adm_bad:'The username or password is incorrect.', admin_on:'Edit mode is on — click the pencil next to a text.',
    edit_title:'Edit text', edit_save:'Save change', edit_saved:'Saved.', edit_err:'Save failed.',
    merge_next:'Merge with next', split_chapter:'Split chapter', split_verse:'Split verse',
    split_pick:'Choose the verse after which the new chapter starts (tap a verse number)', split_cancel:'Cancel split',
    vsplit_pick:'Choose a verse to split (tap a verse number)',
    vsplit_title:'Split verse', vsplit_btn:'Split verse',
    vsplit_hint:'The first part keeps the current verse number; the second becomes a new verse with a hyphen and running number (shown in the Samaritan division only).',
    vsplit_p1:'First part — stays verse', vsplit_p2:'Second part — new verse',
    vsplit_err:'Both parts are required.', vsplit_ok:'Verse split. New verse:',
    renum:'Change number', renum_pick:'Choose a verse to renumber (tap a verse number)',
    renum_title:'Change verse number', renum_cur:'Current number:', renum_empty:'Enter a number.',
    renum_cascade_q:'Renumber all following verses accordingly?', renum_cascade_yes:'Yes, all following',
    renum_only_this:'Only this verse', renum_ok:'Verse number updated.',
    merge_q:'Merge the current chapter with the next? The book numbering will update.', split_q:'Split the chapter after verse ',
    merged_ok:'Chapters merged.', split_ok:'Chapter split.', confirm_yes:'Confirm',
    bm_add:'Bookmark this chapter', bm_my:'My bookmarks', bm_delete:'Delete selected',
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
    compare:'مقارنة النصوص', variants:'اختلافات النصّ', samsrc:'مصادر سامرية', translate:'ترجمات التوراة',
    t_aramaic:'ترجمة: آرامية', t_arabic:'ترجمة: عربية', t_english:'ترجمة: إنجليزية',
    search_ph:'ابحث عن كلمة', adv_search:'⚙ بحث متقدم', search_help_btn:'❔ مساعدة البحث',
    flag_exact:'تطابق تامّ', flag_meanings:'إظهار معاني الكلمات', flag_root:'حسب جذر الكلمة',
    flag_finals:'تجاهل الحروف النهائية', flag_aram:'البحث في الترجمة الآرامية', root_label:'الجذر للبحث:',
    adv_hint:'يمكنك استخدام <b>?</b> أو <b>*</b> لاستبدال حرف أو سلسلة أحرف. مثال: <b>א?ר</b> أو <b>כא*</b>',
    apply:'تأكيد', menu:'القائمة', m_calendar:'التقويم السامري (حسبان قشطة)',
    m_genealogy:'شجرة الأنساب السامرية الكاملة', m_install:'تثبيت التطبيق', m_lang:'تغيير اللغة',
    m_whatsnew:'ما الجديد؟', m_help:'مساعدة المستخدم', m_version:'الإصدار الحالي', m_contact:'اتصل بنا',
    share_title:'مشاركة', email:'بريد إلكتروني', close:'إغلاق',
    copied:'تم نسخ النص', copy_fail:'فشل النسخ', share_copy:'نسخ إلى الحافظة',
    to_aramaic:'الترجمة الآرامية', to_arabic:'الترجمة العربية', to_english:'الترجمة الإنجليزية',
    cmp_title:'اختر النصّ للمقارنة', cv_masoretic:'النصّ الماسوري', cv_septuagint:'الترجمة السبعينية',
    cmp_sam:'النصّ السامري', cmp_info:'حول هذا النصّ',
    ci_masoretic:'النصّ الماسوري هو النصّ اليهودي المعتمد للكتاب المقدّس العبري، نقله وشكّله علماء المسورة في طبريّة (أواخر الألفية الأولى م). وهو أساس معظم الطبعات المطبوعة.',
    ci_septuagint:'الترجمة السبعينية (LXX) هي الترجمة اليونانية القديمة للتوراة، أُنجزت في الإسكندرية في القرن الثالث ق.م. تعكس أحيانًا نصًّا عبريًّا قديمًا يختلف عن الماسوري، ويقارب في مواضع كثيرة النصّ السامري.',
    c_name:'الاسم الكامل', c_email:'البريد الإلكتروني', c_msg:'رسالة (حتى 100 كلمة)', c_send:'إرسال', c_cancel:'إلغاء',
    lang_save_q:'هل تريد حفظ هذا الإعداد؟', lang_save_note:'سيُحفظ على هذا الجهاز للمرّات القادمة.',
    save_yes:'نعم، احفظ', save_no:'لا، هذه المرّة فقط',
    samsrc_pick:'مصادر سامرية — اختر مصدراً', checking_sources:'جارٍ التحقق من المصادر…',
    no_sam_source:'لا يوجد مصدر سامري لهذه الآيات', back_sources:'‹ المصادر',
    src_tibat:'تيبات مارقه', src_eyalk:'من التقليد السامري', src_tzdaka:'تفسير صدقة الحكيم',
    src_sir:'سرّ القلوب', src_shyt:'أجوبة يعقوب بن هارون الكاهن',
    variants_title:'اختلافات النصّ — طبعة فون غال',
    no_variants:'لا توجد اختلافات نصّية لهذه الآيات.',
    app_hint:'الكلمات المميّزة في الآية تحمل اختلافات نصّية — اضغط على كلمة للانتقال إلى اختلافاتها، واضغط على اختلاف للعودة إلى الكلمة.',
    dict_hint:'معجم الكلمات — السهم ⬆ بجانب الترجمة الآرامية يدلّ على وجود نتائج إضافية. اضغط على الصفّ لعرض المدخل الكامل ومواضع التوراة والصيغ الإضافية من معجم أ. طال', no_dict:'لا يوجد معجم لهذه الآية',
    more_results:'نتائج إضافية', tal_meaning:'المعنى من المعجم', tal_torah:'المواضع في التوراة', tal_forms:'صيغ ومداخل إضافية', tal_page:'ص', tal_none:'لم يُعثر على مدخل لهذه الكلمة في معجم أ. طال.', tal_click_precise:'اضغط للمدخل الدقيق من معجم أ. طال ⬅',
    m_library:'المكتبة السامرية', m_dict_aram:'المعجم الآرامي-العبري السامري',
    m_tm_book:'تيبات مارقه (ميمر مرقه)', tm_title:'تيبات مارقه — ميمر مرقه', tm_search_ph:'بحث داخل الكتاب…',
    tm_toc_hint:'اختر ميمراً للمطالعة:', tm_back_toc:'‹ المحتويات', tm_back_chapter:'‹ العودة إلى الفصل',
    tm_words_btn:'معجم الكلمات', tm_words_title:'معجم الكلمات — من معجم أ. طال', tm_col_root:'الجذر',
    tm_no_results:'لا توجد نتائج', tm_sections_n:'مقاطع', tm_open_verse:'افتح الآية في التطبيق',
    m_tz_book:'تفسير صدقة الحكيم (التكوين)', tz_title:'تفسير صدقة الحكيم — التكوين',
    tz_toc_hint:'اختر أصحاحاً:', tz_chapter_label:'أصحاح', tz_arabic_pending:'الترجمة العربية قيد الإعداد — يُعرض النصّ العبري.',
    rd_he:'العبرية', rd_ar:'العربية', rd_aram:'الآرامية', rd_show:'اعرض:',
    dict_app_title:'المعجم الآرامي-العبري السامري — أ. طال', dict_app_ph:'اكتب كلمة آرامية أو جذرًا…', dict_app_search:'بحث', dict_app_hint:'ابحث في معجم الآرامية السامرية لأ. طال: الجذر · المعنى العبري من المعجم · مواضع التوراة.', dict_app_empty:'لم يُعثر على مدخل. جرّب جذر الكلمة.',
    dict_tab_search:'بحث', dict_tab_index:'الفهرس', dict_tab_pages:'تصفّح الصفحات',
    dict_index_hint:'تصفّح فهرس المعجم (أ–ي). اكتب حرفاً/كلمة للقفز.', dict_index_ph:'اقفز إلى حرف/كلمة…',
    dict_pages_hint:'تصفّح صفحات المعجم.', dict_page_label:'صفحة', dict_prev:'‹ السابق', dict_next:'التالي ›',
    dict_in_dict:'موجودة في المعجم كمدخل:', dict_form_hint:'اضغط صيغةً لكلّ مواضعها في المعجم',
    dict_locations_title:'المواضع في المعجم', dict_loc_count:'مواضع', dict_open_page:'افتح صفحة المعجم',
    ob_dont:'لا تُظهر مرّة أخرى', ob_later:'لاحقًا', ob_close:'إغلاق', wc_read:'قرأتُ',
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
    col_word:'الكلمة', col_aram:'الآرامية', col_heb:'المعنى العبري', col_tal:'معجم طال', col_arabic:'العربية',
    searching:'جارٍ البحث…', no_interp:'لا يوجد تفسير لهذه الآيات',
    help_title:'مساعدة المستخدم', search_help_title:'مساعدة البحث', install_title:'تثبيت التطبيق',
    m_admin:'دخول المسؤول', adm_user:'اسم المستخدم', adm_pass:'كلمة المرور', adm_login:'دخول',
    adm_bad:'اسم المستخدم أو كلمة المرور غير صحيحة.', admin_on:'وضع التحرير مُفعَّل — اضغط على القلم بجانب النصّ.',
    edit_title:'تحرير النصّ', edit_save:'حفظ التغيير', edit_saved:'تمّ الحفظ.', edit_err:'فشل الحفظ.',
    merge_next:'دمج مع التالي', split_chapter:'تقسيم الأصحاح', split_verse:'تقسيم الآية',
    split_pick:'اختر الآية التي يبدأ بعدها الأصحاح الجديد (اضغط رقم آية)', split_cancel:'إلغاء التقسيم',
    vsplit_pick:'اختر آية للتقسيم (اضغط رقم آية)',
    vsplit_title:'تقسيم الآية', vsplit_btn:'تقسيم الآية',
    vsplit_hint:'يبقى الجزء الأول برقم الآية الحالي؛ ويصبح الجزء الثاني آية جديدة بشَرطة ورقم متسلسل (تظهر في التقسيم السامري فقط).',
    vsplit_p1:'الجزء الأول — يبقى آية', vsplit_p2:'الجزء الثاني — آية جديدة',
    vsplit_err:'كلا الجزأين مطلوبان.', vsplit_ok:'تم تقسيم الآية. الآية الجديدة:',
    renum:'تغيير الرقم', renum_pick:'اختر آية لتغيير رقمها (اضغط رقم آية)',
    renum_title:'تغيير رقم الآية', renum_cur:'الرقم الحالي:', renum_empty:'أدخل رقمًا.',
    renum_cascade_q:'إعادة ترقيم كل الآيات التالية تبعًا لذلك؟', renum_cascade_yes:'نعم، كل التالية',
    renum_only_this:'هذه الآية فقط', renum_ok:'تم تحديث رقم الآية.',
    merge_q:'دمج الأصحاح الحالي مع التالي؟ سيُحدَّث ترقيم السفر.', split_q:'تقسيم الأصحاح بعد الآية ',
    merged_ok:'تمّ دمج الأصحاحين.', split_ok:'تمّ تقسيم الأصحاح.', confirm_yes:'تأكيد',
    bm_add:'إضافة إشارة لهذا الأصحاح', bm_my:'إشاراتي المرجعية', bm_delete:'حذف المحدّد',
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
  samFont: false, english: false, dict: false,
  onlineDict: false,
  fontOffset: 0,
  book: null, bookName: '',
  portions: [], curPid: null,
  chList: [], chIdx: 0, chMode: 'standard',   // 'standard' | 'samaritan'
  curChId: null, curChNum: null, portionName: '',
  verses: [], verseFilter: null,
  commentarySel: null, samSrcChoice: null, tmSel: null,
  searchReturn: false, searchFontOffset: 0,
  stack: [],                      // navigation breadcrumb stack for Back
};

const COMMENTATORS = [['rashi','רש"י'],['ramban','רמב"ן'],['cassuto','קאסוטו'],
                      ['baal_haturim','בעל הטורים']];
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
// After layout, hide every separator middot that ends a visual line (the next word
// wrapped to the line below). Re-run on zoom/resize so dots reappear when reducing
// the text pulls more words up onto the line. Two passes: reset → measure → hide.
function trimEdgeDots(vtext){
  const seps=[...vtext.querySelectorAll('.wsep')];
  if(!seps.length) return;
  seps.forEach(s=>{ s.style.display=''; });
  const toHide=[];
  for(const s of seps){
    let n=s.nextElementSibling;
    while(n && !n.classList.contains('samchar')) n=n.nextElementSibling;
    if(!n || n.getBoundingClientRect().top > s.getBoundingClientRect().top + 1) toHide.push(s);
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
    const btn = el('button','listbtn',
      `<img class="ico" src="/static/img/icon_book_dark.png" alt=""><span>${label}</span>`);
    btn.onclick = ()=>showPortions(b.id, b.name);
    c.appendChild(btn);
  }
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
    const btn = el('button','listbtn',
      `<img class="ico" src="/static/img/icon_portion_dark.png" alt=""><span>${label}</span>`);
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
  renderChapterGrid(rows, 'בחר פרק שומרוני', (r)=>openSamChapter(r.id, r.number, pid, pname, false));
}
function renderChapterGrid(rows, hint, onClick){
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
    b.onclick=()=>onClick(r);
    grid.appendChild(b);
  }
  c.appendChild(grid);
}

// ── opening a chapter (verses) ───────────────────────────────────────────────
async function openChapter(chId, chNum, pid, pname, fromSearch){
  if(!fromSearch) S.verseFilter=null;
  S.chMode='standard'; S.curPid=pid; S.portionName=pname;
  const rows = await api('chapters?portion_id='+pid);
  S.chList = rows.map(r=>({id:r.id, number:r.number}));
  S.chIdx = Math.max(0, S.chList.findIndex(x=>x.id===chId));
  await renderVerses(chId, chNum, pid, pname);
}
async function openSamChapter(samId, samNum, pid, pname, fromSearch){
  if(!fromSearch) S.verseFilter=null;
  S.chMode='samaritan'; S.curPid=pid; S.portionName=pname;
  const rows = await api('sam_chapters?portion_id='+pid);
  S.chList = rows.map(r=>({id:r.id, number:r.number}));
  S.chIdx = Math.max(0, S.chList.findIndex(x=>x.id===samId));
  await renderVerses(samId, samNum, pid, pname);
}

async function renderVerses(chId, chNum, pid, pname){
  S.view='verses'; S.curChId=chId; S.curChNum=chNum; setView();
  await ensureBooks();   // populate S.books so the nav buttons can relabel at book edges
  const isSam = S.chMode==='samaritan';
  S.verses = isSam ? await api('sam_verses?sam_ch_id='+chId)
                   : await api('verses?chapter_id='+chId+(pid?('&portion_id='+pid):''));
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
  paintVerses();
  // Samaritan division only: landing on "וילך איש מבית לוי" (Moses' birth, Exod 2:1)
  // floats a slow-dissolving blessing over the text, replayed on each landing.
  if(isSam && S.verses.some(v=>_vfold(v.text||'').startsWith(BLESS_KEY))) playVerseBlessing();
}
const BLESS_KEY = 'וילכאישמביתלוי';   // _vfold of "וילך איש מבית לוי"
function playVerseBlessing(){
  document.querySelectorAll('.verse-bless').forEach(e=>e.remove());
  const c=$('content'); const rect=c.getBoundingClientRect();
  if(rect.width<10) return;
  const ov=el('div','verse-bless','שלום יהוה על משה');
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
  let gone=false; const done=()=>{ if(gone) return; gone=true; ov.remove(); };
  a.onfinish=done; a.oncancel=done; setTimeout(done, 5600);
}

// the actual verse-area painter (re-run on every mode/filter/font change)
function paintVerses(){
  const c=$('content'); c.innerHTML='';
  c.classList.toggle('sam', S.samFont && !S.english);   // enables Samaritan justify
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
    } else {
      const mb=el('button','admin-btn', t('merge_next')); mb.onclick=mergeNext;
      bar.appendChild(mb);
      if(S.chMode==='samaritan'){          // verse split + renumber → Samaritan-only
        const vb=el('button','admin-btn', t('split_verse'));
        vb.onclick=()=>{ S.vsplitMode=true; paintVerses(); };
        bar.appendChild(vb);
        const rb=el('button','admin-btn', t('renum')); rb.onclick=()=>{ S.renumMode=true; paintVerses(); };
        bar.appendChild(rb);
      }
      const sb=el('button','admin-btn', t('split_chapter')); sb.onclick=()=>{ S.splitMode=true; paintVerses(); };
      bar.appendChild(sb);
    }
    c.appendChild(bar);
  }
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
  const usePanel = S.panel && !S.samFont;

  if(usePanel && S.panel!=='compare'){
    addNumStrip(c, all);
    if(S.panel==='commentary'){ addPlainRows(c, verses); buildCommentary(c, verses); }
    else if(S.panel==='samaritan_src'){ addPlainRows(c, verses); buildSamSrc(c, verses); }
    else if(S.panel==='variants'){ buildVariantsView(c, verses); }
    else if(S.panel==='interpret'){ buildInterpret(c, verses); maybeDict(c, verses); }
    else if(S.panel==='aramaic'){ buildAramaic(c, verses); maybeDict(c, verses); }
    else if(S.panel==='arabic'){ buildArabic(c, verses); maybeDict(c, verses); }
  } else if(usePanel && S.panel==='compare'){
    addNumStrip(c, all); buildCompare(c, verses);
  } else {
    if(S.english) c.appendChild(el('div','eng-credit',
      '<b>The Samaritan Pentateuch</b><br>An English Translation with a Parallel Annotated Hebrew Text<br>Moshe Florentin and Abraham Tal'));
    addPlainRows(c, verses);
    // three centered asterisks marking the end of a Samaritan portion: shown
    // after the last verse of the portion's last chapter (Samaritan original text).
    if(S.chMode==='samaritan' && !S.english && S.verseFilter==null
       && Array.isArray(S.chList) && S.chList.length && S.chIdx===S.chList.length-1)
      c.appendChild(el('div','portion-end','✶ ✶ ✶'));
    if(S.dict && !S.english) buildDict(c, verses);
  }
  scheduleDotTrim();   // drop justification dots that fall at a line edge (Samaritan font)
}

function addPlainRows(c, verses){
  const fs = fsize();
  for(const v of verses){
    if(!(v.text||'').trim() && !S.english) continue;
    const row = el('div','vrow');
    const numActive = S.verseFilter===v.id ? ' active':'';
    const num = el('button','num'+numActive, String(v.number));
    num.onclick=()=>{
      if(ADMIN.token && S.splitMode)  return askSplit(v);
      if(ADMIN.token && S.vsplitMode) return openVsplit(v);
      if(ADMIN.token && S.renumMode)  return openRenumber(v);
      return filterVerse(v.id);
    };
    const vh = verseHTML(v);
    const t = el('div', vh.cls, vh.html);
    t.style.fontSize = (S.english?17:fs)+'px';
    if(S.english){ row.appendChild(num); row.appendChild(t); }
    else { row.appendChild(t); row.appendChild(num); }
    addPencil(row, v.id, S.english?'english':'text', ()=> S.english?(v.english||''):(v.text||''));
    c.appendChild(row);
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
  // the "other" side: Masoretic text, or — for the Septuagint — the Masoretic text
  // with the LXX variant readings substituted in (lxx_text); verses with no recorded
  // LXX variant fall back to the Masoretic text.
  const otherText = v => (ver==='septuagint') ? (v.lxx_text || v.masoretic_text) : v.masoretic_text;
  const ph = el('div','note','טוען השוואה…'); c.appendChild(ph);
  const data = await apiPost('compare', {verses: verses.map(v=>{
    const mas = String(v.masnum!=null ? v.masnum : v.number);
    // on the source side, prefix the chapter before verse 1 (e.g. "20:1") so the
    // reader sees which chapter the verse belongs to
    const masLabel = (mas==='1') ? ((v.jchapter!=null?v.jchapter:S.curChNum)+':1') : mas;
    return {sam_num:v.number, mas_num:masLabel, text:v.text, masoretic_text:otherText(v)};
  })});
  ph.remove();
  const fs=fsize();
  const render = toks => toks.map(t=> t[1]?`<span class="diff">${esc(t[0])}</span>`:esc(t[0])).join(' ');
  // Verse-opposite-verse: a 2-column CSS grid where every verse is one grid row
  // (source-version cell | Samaritan cell). Grid rows stay aligned even when a verse
  // wraps. Where a verse has no counterpart on a side, that cell shows "---".
  const grid=el('div','cmp-grid');
  // left header carries the version name + a small info icon; tapping it opens a
  // concise in-app floating popup about the version (Masoretic / Septuagint)
  const verName = t(ver==='septuagint'?'cv_septuagint':'cv_masoretic');
  const lh=el('div','cmp-cell cmp-head');
  lh.appendChild(document.createTextNode(verName+' '));
  const info=el('span','cmp-info'); info.textContent='ⓘ';
  info.title=t('cmp_info'); info.setAttribute('role','button'); info.tabIndex=0;
  info.setAttribute('aria-label',t('cmp_info'));
  const showVer=()=>showInfo(verName,
    `<div class="ver-info">${esc(t(ver==='septuagint'?'ci_septuagint':'ci_masoretic'))}</div>`);
  info.onclick=showVer;
  info.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); showVer(); } };
  lh.appendChild(info);
  grid.appendChild(lh);
  grid.appendChild(el('div','cmp-cell cmp-head', t('cmp_sam')));
  for(const d of data){
    const m=render(d.mas).trim(), s=render(d.sam).trim();
    if(!m && !s) continue;
    const mc=el('div','cmp-cell', m || '<span class="cmp-missing">- - -</span>');
    const sc=el('div','cmp-cell', s || '<span class="cmp-missing">- - -</span>');
    mc.style.fontSize=fs+'px'; sc.style.fontSize=fs+'px';
    grid.appendChild(mc); grid.appendChild(sc);
  }
  c.appendChild(grid);
}
async function buildInterpret(c, verses){
  // Show the verse commentary INLINE, in place of the original verse text
  // (one row per verse), rather than as a separate panel beside the original.
  const m = await api('interpretations?verse_ids='+verses.map(v=>v.id).join(','));
  const fs = fsize();
  let any = false;
  for(const v of verses){
    let txt = (m[v.id]||'').trim();
    if(!txt) continue;
    // strip leftover markdown (heading lines, ** bold) that leaked into the text
    txt = txt.replace(/\*\*/g,'').replace(/^[ \t]*#{1,6}[ \t]+.*$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
    if(!txt) continue;
    any = true;
    const row = el('div','vrow');
    const num = el('button','num'+(S.verseFilter===v.id?' active':''), String(v.number));
    num.onclick=()=>filterVerse(v.id);
    const t = el('div','vtext interp', esc(txt));
    t.style.fontSize = fs+'px';
    row.appendChild(t); row.appendChild(num);
    addPencil(row, v.id, 'interpretation', ()=>(m[v.id]||''));
    c.appendChild(row);
  }
  if(!any) c.appendChild(el('div','note',t('no_interp')));
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
    .map(v=>`${v.number}  ${esc((v.sam_aramaic||'').trim())}`).join('\n');
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
    const [tm, ey, tz, sir, shyt] = await Promise.all([api('tibat_marqe?verse_ids='+ids),
      api('eyalk?verse_ids='+ids), api('tzdaka?verse_ids='+ids), api('sir?verse_ids='+ids),
      api('shyt?verse_ids='+ids)]);
    loading.remove();
    const avail=[];
    if(tm.length) avail.push([t('src_tibat'),'tm']);
    if(ey.length) avail.push([t('src_eyalk'),'eyalk']);
    if(tz.length) avail.push([t('src_tzdaka'),'tzdaka']);
    if(sir.length) avail.push([t('src_sir'),'sir']);
    if(shyt.length) avail.push([t('src_shyt'),'shyt']);
    if(!avail.length){ panel.appendChild(el('div','note',t('no_sam_source'))); return; }
    for(const [label,ch] of avail){
      const b=el('button','picker-btn',label); b.onclick=()=>{ S.samSrcChoice=ch; S.tmSel=null; paintVerses(); };
      panel.appendChild(b);
    }
    // bring the screen up so ALL available sources for this chapter/verse are visible
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
      const body=el('div','cbody',esc(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
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
      const body=el('div','cbody',esc(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
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
      const body=el('div','cbody',esc(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
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
      const body=el('div','cbody',esc(it.text)); body.style.fontSize=fsize()+'px'; card.appendChild(body);
      if(it.anchors) card.appendChild(el('div','canchors',esc(it.anchors)));
      panel.appendChild(card);
    }
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
      const body=el('div','cbody', esc(it.aramaic||it.hebrew||'טקסט המקור אינו זמין'));
      body.style.fontSize=fsize()+'px';
      body.onclick=()=>{ S.tmSel=[it.book,it.section]; paintVerses(); };
      card.appendChild(body); panel.appendChild(card);
    }
  } else {
    const sub=el('div','shead');
    const b2=el('button','miniback','‹ חזרה'); b2.onclick=()=>{ S.tmSel=null; paintVerses(); };
    sub.appendChild(b2); sub.appendChild(el('div','stitle', esc(cur.label+' ('+cur.book_title+')')));
    panel.appendChild(sub);
    const he=panelEl('תרגום לעברית', esc(cur.hebrew||'התרגום העברי בהכנה'));
    const ar=panelEl('מקור ארמי', esc(cur.aramaic||'המקור הארמי אינו זמין'));
    panel.appendChild(pairEl(he,ar));
  }
  c.appendChild(panel);
}

// ── dictionary ───────────────────────────────────────────────────────────────
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
  for(const h of [t('col_word'),t('col_aram'),t('col_heb'),t('col_tal'),t('col_arabic')]) hr.appendChild(el('th',null,esc(h)));
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
  if(!roots.length){ body.appendChild(el('div','note',t('tal_none'))); return; }
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
  // navbar is LTR (matching the source app): next on the LEFT, previous on the RIGHT.
  $('nextBtn').textContent = mode==='chapter' ? t('next_chapter') : t('next_portion');
  $('prevBtn').textContent = mode==='chapter' ? t('prev_chapter') : t('prev_portion');
  updateNavDisabled();
}
// the prev/next labels when a step would carry the reader into an adjacent book:
// "עבור ל<שם הספר>" (arrow side matches the regular chapter labels per language)
function gotoBookLabel(name, isNext){
  const txt = t('goto_book')+name;
  if(LANG==='en' || LANG==='ar') return isNext ? (txt+' ›') : ('‹ '+txt);
  return isNext ? ('‹ '+txt) : (txt+' ›');                  // Hebrew
}
function updateNavDisabled(){
  const ids = S.portions.map(p=>p.id); const pidx = ids.indexOf(S.curPid);
  if(S.navMode==='chapter'){
    // chapter paging carries across parashot within a book; at a BOOK edge the
    // button relabels to "go to <adjacent book>" and only the Torah's very ends stop.
    const atBookStart = (S.chIdx<=0) && (pidx<=0);
    const atBookEnd   = (S.chIdx>=S.chList.length-1) && (pidx>=ids.length-1);
    const books = S.books||[]; const bIdx = books.findIndex(b=>b.id===S.book);
    const prevBook = bIdx>0 ? books[bIdx-1] : null;
    const nextBook = (bIdx>=0 && bIdx<books.length-1) ? books[bIdx+1] : null;
    if(atBookStart && prevBook){ $('prevBtn').textContent = gotoBookLabel(prevBook.name,false); $('prevBtn').disabled=false; }
    else { $('prevBtn').textContent = t('prev_chapter'); $('prevBtn').disabled = atBookStart; }
    if(atBookEnd && nextBook){ $('nextBtn').textContent = gotoBookLabel(nextBook.name,true); $('nextBtn').disabled=false; }
    else { $('nextBtn').textContent = t('next_chapter'); $('nextBtn').disabled = atBookEnd; }
  } else {
    $('prevBtn').disabled = pidx<=0;
    $('nextBtn').disabled = pidx>=ids.length-1;
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
  const usePanel = S.panel && !S.samFont;          // compare / commentary / aramaic …
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
  const inner=el('div','flip-ghost-inner'); inner.style.top=(-c.scrollTop)+'px';
  for(const ch of c.children) inner.appendChild(ch.cloneNode(true));
  ghost.appendChild(inner);
  ghost.appendChild(el('div','flip-ghost-shade'));
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
  // a real page doesn't pivot rigidly — it flexes and ripples as it lifts. We bow the
  // leaf with an oscillating skew (the "wave") whose strength is randomised a touch so
  // each turn looks a little different, and bend it slightly out of plane with rotateX.
  const w = 1.6 + Math.random()*1.8;             // wave amplitude (deg)
  const P = 'perspective(1500px)';
  const fr = (offset, ry, skew, rx, sc) =>
    ({ offset, transform:`${P} rotateY(${s*ry}deg) skewY(${skew}deg) rotateX(${rx}deg) scale(${sc})` });
  const a=ghost.animate([
    fr(0,    0,   0,        0,    1),
    fr(.22,  22,  s*w,      1.4,  1.012),
    fr(.46,  56, -s*w*1.1, -1.0,  1.008),
    fr(.72,  90,  s*w*0.6,  0.6,  1.003),
    fr(1,    120, 0,        0,    1),
  ], {duration:560, easing:'cubic-bezier(.42,.04,.28,1)'});
  $('content').animate([{opacity:.5, transform:'scale(.99)'},{opacity:1, transform:'none'}],
                       {duration:380, easing:'ease-out'});
  // the curl shadow pools toward the page's free edge, deepening as it stands up then
  // releasing as the leaf falls away — gives the turn its sense of light and volume.
  const shade=ghost.querySelector('.flip-ghost-shade');
  if(shade){
    shade.style.background = `linear-gradient(${exitLeft?90:270}deg,`
      + ' rgba(0,0,0,0) 28%, rgba(0,0,0,.08) 58%, rgba(0,0,0,.30) 88%, rgba(0,0,0,.42) 100%)';
    shade.animate([{opacity:0},{opacity:.55,offset:.5},{opacity:.12}],
                  {duration:560, easing:'ease-in-out'});
  }
  // remove the ghost when the turn ends — plus a hard fallback in case the page
  // is backgrounded (a frozen animation timeline would otherwise never fire onfinish)
  let gone=false; const done=()=>{ if(gone) return; gone=true; ghost.remove(); };
  a.onfinish=done; a.oncancel=done; setTimeout(done, 800);
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
  const ni=pidx+delta; if(ni<0||ni>=S.portions.length) return;
  const p=S.portions[ni];
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

// ── view chrome (show/hide nav + enable toolbar) ─────────────────────────────
function setView(){
  const isVerse = S.view==='verses';
  $('navbar').classList.toggle('hidden', !(isVerse || S.view==='chapters' || S.view==='sam_chapters'));
  $('spreadBtn').classList.toggle('hidden', !(S.view==='portions'));
  if(S.view==='books'||S.view==='portions'||S.view==='spread') $('navbar').classList.add('hidden');
  $('bmAddBtn').classList.toggle('hidden', !isVerse);   // floating "add bookmark"
  syncToolbar(isVerse);
  updateToolbarFold(isVerse);
  updateZoomButtons();
}

// ── collapsible bottom toolbar (text / comparison screens) ─────────────────────
// the two display-mode rows fold away after a few seconds, leaving a drag handle;
// the next/prev and zoom controls (in #navbar) stay put.
let tbFolded=false, tbUserOpened=false, tbFoldTimer=null, tbInVerse=false;
function setToolbarFolded(folded, withArrow){
  const wasFolded=tbFolded;
  tbFolded=folded;
  const tb=$('toolbar'); tb.classList.toggle('folded', folded);
  tb.classList.remove('show-arrow'); tb.classList.remove('show-down');
  if(folded && withArrow){
    void tb.offsetWidth; tb.classList.add('show-arrow');             // up-arrow ~3s after folding
    setTimeout(()=>tb.classList.remove('show-arrow'), 3000);
  } else if(!folded && withArrow && wasFolded){
    void tb.offsetWidth; tb.classList.add('show-down');              // reverse: down-arrow ~2s after opening
    setTimeout(()=>tb.classList.remove('show-down'), 2000);
  }
}
function armAutoFold(){   // fold (with the arrow animation) after 3s
  clearTimeout(tbFoldTimer);
  tbFoldTimer=setTimeout(()=>{ if(S.view==='verses' && !tbUserOpened) setToolbarFolded(true,true); }, 3000);
}
function updateToolbarFold(isVerse){
  clearTimeout(tbFoldTimer);
  if(!isVerse){ tbInVerse=false; setToolbarFolded(false,false); return; }  // not a text screen
  const fresh = !tbInVerse;   // arriving at a text/comparison screen from elsewhere
  tbInVerse=true;
  // every fresh entry: show the bar open, then auto-fold (with animation) after 3s —
  // not just the first time, so re-entering these screens always re-runs the fold.
  if(fresh){ tbUserOpened=false; setToolbarFolded(false,false); armAutoFold(); return; }
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
// base colours of each mode button (matching the native app's palette);
// disabled → grey, active → bright blue, otherwise its own colour.
const BTN_BASE = {
  fontBtn:'#40406b', translateBtn:'#2a6e7a', dictBtn:'#405973', interpBtn:'#335959',
  compareBtn:'#593373', commentaryBtn:'#4d4d80', samSrcBtn:'#735438',
  variantsBtn:'#7a3550',
};
function syncToolbar(isVerse){
  $('shareBtn').classList.toggle('hidden', !isVerse);
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
  setBtn('dictBtn',       isVerse, S.dict);
  // "פירוש הפסוק" is TEMPORARILY disabled: keep it tappable in verse view (to show a
  // notice) but styled as unavailable — never highlighted/active.
  { const b=$('interpBtn'); b.disabled=!isVerse; b.classList.remove('on');
    b.classList.toggle('unavail', isVerse); b.style.background = '#555'; }
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
function clearModes(){ S.panel=null; S.dict=false; S.english=false; S.samFont=false; }
$('fontBtn').onclick=()=>{ const was=S.samFont; clearModes(); S.samFont=!was; syncToolbar(true); paintVerses(); };
// "תרגומי התורה" — opens a small picker (ארמי / ערבי / אנגלי), marking the active one
$('translateBtn').onclick=()=>{
  // if a translation is already showing, this button turns it OFF → back to the text
  if(S.english || S.panel==='aramaic' || S.panel==='arabic'){
    clearModes(); syncToolbar(true); paintVerses(); return;
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
$('dictBtn').onclick=()=>{ const was=S.dict; clearModes(); S.dict=!was; syncToolbar(true); paintVerses(); if(S.dict) scrollToEl('.dictpanel'); };
function togglePanel(name){
  const was = (S.panel===name);
  clearModes();
  if(!was){
    S.panel = name;
    if(S.panel==='commentary') S.commentarySel=null;
    if(S.panel==='samaritan_src'){ S.samSrcChoice=null; S.tmSel=null; }
  }
  syncToolbar(true); paintVerses();
  if(S.panel) scrollToEl('.pair, .srcpanel');
}
$('interpBtn').onclick=()=> showInfo(t('interp'), '<div class="note">'+t('interp_unavail')+'</div>');
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

function goBack(){
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
      if(r.meaning) mparts.push('מילון טל: '+r.meaning);
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
  $('navbar').classList.add('hidden');
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
  const cnt = LANG==='en' ? `Found ${data.count} results` : LANG==='ar' ? `${data.count} نتيجة` : `נמצאו ${data.count} תוצאות`;
  $('searchStatus').textContent = cnt + (aram ? ' · '+t('flag_aram') : '');
  updateSearchZoomButtons(data.count>0);
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
    // meaning of the HIGHLIGHTED word (only when the "show meanings" flag is on):
    // Aramaic translation + an EMPHASISED dictionary meaning the user can click to
    // open the exact entry from A. Tal's dictionary, plus an online Hebrew gloss.
    if(showMeanings){
      const heWord = r.matched_word || q;
      const ml=el('div','res-meaning');
      let hasParts=false;
      if(r.aramaic){
        const a=el('span','aram-link', 'תרגום ארמי: ');
        a.appendChild(el('b','', esc(r.aramaic)));
        a.title='לחץ לפירוש המלא של המילה';
        a.onclick=()=>showTalFull(r.aramaic);
        ml.appendChild(a); hasParts=true;
      }
      // the dictionary meaning, emphasised, and clickable to the precise Tal entry
      if(r.aramaic || r.meaning){
        const dl=el('div','res-dict');
        if(r.meaning){ dl.appendChild(el('span','dict-label','מילון א. טל: '));
          dl.appendChild(el('b','dict-gloss', esc(r.meaning))); }
        const link=el('span','dict-precise', t('tal_click_precise'));
        link.onclick=()=>showTalFull(r.aramaic||heWord);
        dl.appendChild(link);
        ml.appendChild(dl);
      }
      const heSpan=el('span','he-mean');
      heSpan.dataset.word=heWord; heSpan.dataset.sep='0';
      ml.appendChild(heSpan); res.appendChild(ml);
      if(heWord) heWords.add(heWord);
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
  const a=b.dataset.act;
  if(a==='library'){     // expand/collapse the "הספרייה השומרונית" sub-section in place
    $('librarySub').classList.toggle('hidden'); $('libraryHead').classList.toggle('open'); return;
  }
  closeMenu(); menuAction(a);
});

function menuAction(a){
  if(a==='calendar')       open(CALENDAR_URL, '_blank', 'noopener');
  else if(a==='genealogy') open(GENEALOGY_URL, '_blank', 'noopener');
  else if(a==='dict_app')  openDictApp();
  else if(a==='tm_book')   openTmBook();
  else if(a==='tz_book')   openTzBook();
  else if(a==='install')   doInstall();
  else if(a==='bookmarks') openBookmarks();
  else if(a==='adminlogin') openAdminLogin();
  else if(a==='lang')      $('langModal').classList.remove('hidden');
  else if(a==='whatsnew')  showWhatsNew();
  else if(a==='help')      showHelp();
  else if(a==='version')   showInfo('גרסא נוכחית', `<div class="ver-num">גרסה ${esc(window.APP_VERSION||'1.0')}</div>`);
  else if(a==='contact')   openContact();
}

// ── Samaritan Aramaic–Hebrew dictionary (A. Tal) — standalone in-app dictionary ──
let DICT_MODE='search';
function openDictApp(){
  $('dictModal').classList.remove('hidden');
  dictSetMode('search');
  setTimeout(()=>$('dictAppInput').focus(), 50);
}
function dictSetMode(mode){
  DICT_MODE=mode;
  document.querySelectorAll('.dict-tab').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
  $('dictAppBody').innerHTML=''; $('dictNav').innerHTML=''; $('dictNav').classList.add('hidden');
  $('dictSearchRow').classList.toggle('hidden', mode==='pages');
  const inp=$('dictAppInput'); inp.value='';
  if(mode==='search'){ $('dictAppHint').textContent=t('dict_app_hint'); inp.placeholder=t('dict_app_ph'); }
  else if(mode==='index'){ $('dictAppHint').textContent=t('dict_index_hint'); inp.placeholder=t('dict_index_ph'); dictIndex(0); }
  else if(mode==='pages'){ $('dictAppHint').textContent=t('dict_pages_hint'); dictPage(1); }
}
document.querySelectorAll('.dict-tab').forEach(b=>b.onclick=()=>dictSetMode(b.dataset.mode));

// the search box doubles as the index "jump to letter/word" box
function dictGo(){ if(DICT_MODE==='index') dictIndex(0, ($('dictAppInput').value||'').trim());
                   else dictAppSearch(); }

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
function dictRootCard(rt){
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
  for(const rt of roots) body.appendChild(dictRootCard(rt));
}
// ── index browsing ──────────────────────────────────────────────────────────
let DICT_IDX={start:0, limit:80, total:0};
async function dictIndex(start, prefix){
  const body=$('dictAppBody'); body.innerHTML=''; body.appendChild(el('div','note',t('searching')));
  let d; try{ d=await api('dict_index?start='+(start||0)+(prefix?('&prefix='+encodeURIComponent(prefix)):'')); }
  catch(e){ body.innerHTML=''; body.appendChild(el('div','note','—')); return; }
  body.innerHTML=''; DICT_IDX={start:d.start, limit:d.limit, total:d.total};
  const list=el('div','dict-index');
  for(const it of d.items){
    const row=el('button','dict-index-row',
      '<span class="dict-ix-lemma">'+esc(it.lemma)+'</span>'
      +(it.root?'<span class="dict-ix-root">'+esc(it.root)+'</span>':'')
      +(it.page?'<span class="dict-ix-page">'+t('dict_page_label')+' '+it.page+'</span>':''));
    row.onclick=()=>{                                  // open this head-word's dictionary page
      DICT_MODE='pages';
      document.querySelectorAll('.dict-tab').forEach(b=>b.classList.toggle('active', b.dataset.mode==='pages'));
      $('dictSearchRow').classList.add('hidden'); $('dictAppHint').textContent=t('dict_pages_hint');
      dictPage(it.page||1);
    };
    list.appendChild(row);
  }
  body.appendChild(list); body.scrollTop=0;
  dictNav([
    {label:t('dict_prev'), disabled:d.start<=0, fn:()=>dictIndex(Math.max(0,d.start-d.limit))},
    {text:(d.start+1)+'–'+Math.min(d.total,d.start+d.items.length)+' / '+d.total},
    {label:t('dict_next'), disabled:d.start+d.limit>=d.total, fn:()=>dictIndex(d.start+d.limit)},
  ]);
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
};
let RD = { key:null, cfg:null, chapter:null, lang:null };
function openReader(key){
  RD.key=key; RD.cfg=BOOK_CFG[key]; RD.chapter=null; RD.lang=RD.cfg.langs[0].key;
  $('rdInput').value=''; $('rdLang').classList.add('hidden');
  $('bookModal').classList.remove('hidden');
  rdShowToc();
}
function openTmBook(){ openReader('tm'); }
function openTzBook(){ openReader('tz'); }
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
      +'<span class="tm-toc-count">'+b.count+' '+esc(t('tm_sections_n'))+'</span>');
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
  $('bookModal').classList.add('hidden'); goToJewish(rec);
});
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

// ── PWA install ("התקנת אפליקציה") ───────────────────────────────────────────
// Capture the browser's install prompt so the menu button can trigger it; fall
// back to platform instructions where the prompt isn't available (iOS Safari).
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
window.addEventListener('appinstalled', () => { deferredInstall = null; });
const INSTALL_TXT = {
  he:{ not_done:'ההתקנה לא הושלמה. אפשר לנסות שוב מהתפריט בכל עת.', already:'האפליקציה כבר מותקנת ופועלת כאפליקציה. 🎉',
       ios_h:'התקנה באייפון / אייפד', ios:['פתח את האתר ב-<b>Safari</b>.','הקש על כפתור <b>השיתוף</b> (ריבוע עם חץ כלפי מעלה) שבתחתית המסך.','בחר <b>"הוסף למסך הבית"</b> ואשר.'],
       other_h:'התקנה במחשב / אנדרואיד', other:['ב-<b>Chrome / Edge</b>: לחץ על סמל ההתקנה <b>⊕</b> בשורת הכתובת, או תפריט הדפדפן (⋮) → <b>"התקנת האפליקציה"</b>.','אשר את ההתקנה.'],
       name:'ייווצר קיצור בשם ' },
  en:{ not_done:'Installation was not completed. You can try again from the menu anytime.', already:'The app is already installed and running. 🎉',
       ios_h:'Install on iPhone / iPad', ios:['Open the site in <b>Safari</b>.','Tap the <b>Share</b> button (a square with an up arrow) at the bottom.','Choose <b>"Add to Home Screen"</b> and confirm.'],
       other_h:'Install on desktop / Android', other:['In <b>Chrome / Edge</b>: click the install icon <b>⊕</b> in the address bar, or the browser menu (⋮) → <b>"Install app"</b>.','Confirm the installation.'],
       name:'A shortcut will be created named ' },
  ar:{ not_done:'لم يكتمل التثبيت. يمكنك المحاولة ثانيةً من القائمة في أيّ وقت.', already:'التطبيق مثبّت ويعمل بالفعل. 🎉',
       ios_h:'التثبيت على آيفون / آيباد', ios:['افتح الموقع في <b>Safari</b>.','اضغط على زرّ <b>المشاركة</b> (مربّع بسهم للأعلى) في الأسفل.','اختر <b>«إضافة إلى الشاشة الرئيسية»</b> وأكّد.'],
       other_h:'التثبيت على الحاسوب / أندرويد', other:['في <b>Chrome / Edge</b>: اضغط رمز التثبيت <b>⊕</b> في شريط العنوان، أو قائمة المتصفّح (⋮) ← <b>«تثبيت التطبيق»</b>.','أكّد التثبيت.'],
       name:'سيُنشأ اختصار باسم ' },
};
async function doInstall(){
  const L = INSTALL_TXT[LANG] || INSTALL_TXT.he;
  if(deferredInstall){
    deferredInstall.prompt();
    let outcome='dismissed';
    try{ ({outcome} = await deferredInstall.userChoice); }catch(e){}
    deferredInstall = null;
    if(outcome!=='accepted') showInfo(t('install_title'), `<div class="note">${L.not_done}</div>`);
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const nameNote = `<div class="note">${L.name}<b>"${esc(t('app_title'))}"</b>.</div>`;
  let h;
  if(standalone) h = `<div class="note">${L.already}</div>`;
  else {
    const steps = ios ? L.ios : L.other, head = ios ? L.ios_h : L.other_h;
    h = `<div class="help-h">${head}</div><ul class="help-list">`
      + steps.map(x=>`<li>${x}</li>`).join('') + '</ul>' + nameNote;
  }
  showInfo(t('install_title'), h);
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
    h += '<div class="ws-h">מילון טל — שורש ומיקומים</div>';
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
      '<b>פירוש הפסוק</b> — פירוש רציף, מוצג במקום הטקסט, השוזר מקורות (כרגע לבראשית א׳–ו׳).',
      '<b>השוואה לנ.מסורה</b> — נוסח שומרון מול המסורה (וגם מול תרגום השבעים), עם סימון ההבדלים באדום.',
      '<b>חילופי נוסח</b> — חילופי הנוסח (העיצוריים) ממהדורת פון גאל, לכל חמשת חומשי התורה. <b>המילים שיש להן חילופי נוסח מודגשות בפסוק</b> — לחיצה על מילה קופצת לחילופיה, ולחיצה על חילוף חוזרת אל המילה בשורת הטקסט. ליד חילופים שתועדו להם עדי-נוסח מוצגים תיאור כתב-היד ותארוכו (כרגע לבראשית א׳).',
      '<b>פרשנות יהודית</b> — רש"י, רמב"ן, קאסוטו, בעל הטורים ועוד, מאתר ספריא.',
      '<b>ממקור שומרון</b> — כל מקורות הפרשנות השומרוניים, והפאנל קופץ מעלה ומציג את כל הקיימים לפרק/לפסוק: <b>תיבת מרקה</b> · <b>מן המסורת השומרונית</b> (כולל השו"ת של יעקב בן אהרן הכהן, ופרשנויות בשם פנחס בן אברהם הכהן ואלעזר בן צדקה הכהן) · <b>פירוש צדקה אל-חכים</b> · <b>סוד הלבבות</b>.',
      '<b>מילון מילים</b> — טבלה לכל מילה: המילה · ארמי · פירוש עברי · מילון א. טל · ערבית. הפירוש נקרא מתוך מילון הארמית של א. טל. <b>חץ ⬆ ליד התרגום הארמי מציין תוצאות נוספות</b> — לחיצה על שורה פותחת את הפירוש המלא מהמילון, מופעי המילה בתורה, וצורות נוספות.',
      '<b>שתף</b> — וואטסאפ, אימייל או פייסבוק.']],
    ['חיפוש', [
      'הקלד מילה ולחץ <b>חפש</b>. יש כפתור <b>❔ עזרה לחיפוש</b> עם מדריך מפורט.',
      '<b>תווים כלליים:</b> <b>?</b> = תו אחד · <b>*</b> = מחרוזת · <b>+</b> = כל המילים באותו פסוק.',
      '<b>חיפוש מתקדם:</b> מדויק · לפי שורש · בתרגום הארמי · התעלם מסופיות · הצג פירוש המילים.',
      'כשהאפשרות <b>הצג פירוש המילים</b> דלוקה, מתחת לכל תוצאה מודגש הפירוש מתוך מילון א. טל, וניתן ללחוץ עליו לקבלת הערך המדויק מהמילון.']],
    ['הספרייה השומרונית', [
      'בתפריט, תחת <b>הספרייה השומרונית</b>, נמצא <b>המילון הארמי-עברי השומרוני</b> — אפליקציית מילון: הקלד מילה בארמית (או שורש) וקבל את שורשה, פירושה העברי מתוך מילון א. טל, ומופעיה בתורה.']],
    ['מסך פתיחה והתקנה', [
      'בכניסה מוצג מסך פתיחה שבו יד כותבת את הפסוק בכתב השומרוני (עם צליל כתיבה — ניתן להפעילו בכפתור 🔊). <b>דלג ›</b> מדלג עליו; במכשיר שבו האפליקציה מותקנת מופיע גם <b>דלג תמיד</b> שנכנס ישר לאפליקציה בפעמים הבאות.',
      'בכניסה הראשונה מוצג חלון <b>ברוכים הבאים</b>. אם האפליקציה אינה מותקנת תוצע <b>התקנה</b>, ואם ההתראות לא אושרו עדיין תוצע אפשרות <b>לאשר התראות</b> על חידושים ועדכוני גרסה — לכל הצעה יש <b>אל תציג שוב</b>.']],
    ['תפריט', [
      '<b>התקנת אפליקציה</b> · <b>שנה שפה</b> · לוח השנה השומרוני · אילן היוחסין · <b>הספרייה השומרונית → המילון הארמי-עברי השומרוני</b> · עזרה · גרסה · צור קשר.']],
  ],
  en: [
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
      '<b>Verse commentary</b> — a continuous commentary shown in place of the text, weaving the sources (currently Genesis 1–6).',
      '<b>Compare to Masorah</b> — Samaritan vs. Masoretic text (and vs. the Septuagint), with the differences marked in red.',
      '<b>Textual variants</b> — the (consonantal) variants from von Gall’s edition, for the whole Torah. <b>Words that carry a variant are emphasised in the verse</b> — tap a word to jump to its variants, tap a variant to jump back to the word. Where witnesses are recorded, each one shows its manuscript and date (currently Genesis 1).',
      '<b>Jewish commentary</b> — Rashi, Ramban, Cassuto, Baal ha-Turim and more, from Sefaria.',
      '<b>Samaritan sources</b> — all the Samaritan commentary sources (the panel scrolls up to show every one available for the chapter/verse): <b>Tībåt Mårqe</b> · <b>the Samaritan tradition</b> (incl. the responsa of Jacob ben Aaron, and pieces by Phinehas ben Abraham and Eleazar ben Tsedaka) · <b>Ṣadaqah al-Ḥakīm’s commentary</b> · <b>Sīr al-Qulūb</b>.',
      '<b>Word dictionary</b> — a table per word: word · Aramaic · Hebrew meaning · A. Tal’s dictionary · Arabic. The meaning is read from Tal’s dictionary. <b>A ⬆ arrow by the Aramaic marks more results</b> — tap a row for the full entry, the word’s Torah occurrences and related forms.',
      '<b>Share</b> — WhatsApp, email or Facebook.']],
    ['Search', [
      'Type a word and tap <b>Search</b>. A <b>❔ Search help</b> button gives a detailed guide.',
      '<b>Wildcards:</b> <b>?</b> = one letter · <b>*</b> = a string · <b>+</b> = all words in the same verse.',
      '<b>Advanced search:</b> exact · by root · in the Aramaic · ignore final letters · show word meanings.',
      'With <b>show word meanings</b> on, each result shows the meaning from A. Tal’s dictionary, clickable for the exact entry.']],
    ['The Samaritan Library', [
      'In the menu, under <b>The Samaritan Library</b>, is <b>The Samaritan Aramaic–Hebrew Dictionary</b> — type an Aramaic word (or root) to get its root, its Hebrew meaning from A. Tal’s dictionary, and its Torah occurrences.']],
    ['Entry splash & install', [
      'On entry a splash shows a hand writing the verse in Samaritan script (with a writing sound — tap 🔊 to enable it). <b>Skip ›</b> skips it; on the installed app an <b>Always skip</b> option goes straight in next time.',
      'On the first visit a <b>Welcome</b> window appears. If the app isn’t installed you’ll be offered to <b>install</b> it, and if notifications aren’t enabled yet you’ll be offered to <b>allow notifications</b> about new features and versions — each prompt has a <b>Don’t show again</b> option.']],
    ['Menu', [
      '<b>Install app</b> · <b>Change language</b> · Samaritan calendar · genealogy · <b>The Samaritan Library → the Aramaic–Hebrew dictionary</b> · help · version · contact.']],
  ],
  ar: [
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
      '<b>تفسير الآية</b> — تفسير متّصل يُعرض مكان النصّ ويجمع المصادر (حالياً التكوين ١–٦).',
      '<b>مقارنة بالنصّ الماسوري</b> — النصّ السامري مقابل الماسوري مع تمييز الفروق بالأحمر.',
      '<b>اختلافات النصّ</b> — الاختلافات (الحرفية الساكنة) من طبعة فون غال، لكامل التوراة. <b>الكلمات التي لها اختلاف مميّزة في الآية</b> — اضغط كلمة للانتقال إلى اختلافاتها، واضغط اختلافاً للعودة إلى الكلمة. وحيث تُذكر الشهود يظهر لكلّ شاهد وصف المخطوطة وتاريخها (حالياً التكوين ١).',
      '<b>تفسير يهودي</b> — راشي، رمبان، كاسوتو، بعل هاطوريم وغيرهم من موقع سفاريا.',
      '<b>مصادر سامرية</b> — كلّ مصادر التفسير السامرية (تنتقل اللوحة للأعلى لعرض كلّ المتوفّر للأصحاح/الآية): <b>تيبات مارقه</b> · <b>التقليد السامري</b> (يشمل مسائل يعقوب بن هارون، ونصوصاً لفنحاس بن إبراهيم وألعازار بن صدقة) · <b>تفسير صدقة الحكيم</b> · <b>سرّ القلوب</b>.',
      '<b>معجم الكلمات</b> — جدول لكلّ كلمة: الكلمة · الآرامية · المعنى العبري · معجم أ. طال · العربية. المعنى مأخوذ من معجم طال. <b>السهم ⬆ بجانب الآرامية يدلّ على نتائج إضافية</b> — اضغط الصفّ للمدخل الكامل ومواضع الكلمة في التوراة والصيغ المتعلّقة.',
      '<b>مشاركة</b> — واتساب، بريد إلكتروني أو فيسبوك.']],
    ['البحث', [
      'اكتب كلمة واضغط <b>بحث</b>. يوجد زرّ <b>❔ مساعدة البحث</b> بدليل مفصّل.',
      '<b>أحرف عامة:</b> <b>?</b> = حرف واحد · <b>*</b> = سلسلة · <b>+</b> = كلّ الكلمات في الآية نفسها.',
      '<b>بحث متقدم:</b> تطابق تامّ · حسب الجذر · في الآرامية · تجاهل النهائية · إظهار المعاني.',
      'عند تفعيل <b>إظهار المعاني</b>، يظهر تحت كلّ نتيجة المعنى من معجم أ. طال، ويمكن الضغط عليه للمدخل الدقيق.']],
    ['المكتبة السامرية', [
      'في القائمة، ضمن <b>المكتبة السامرية</b>، يوجد <b>المعجم الآرامي-العبري السامري</b> — اكتب كلمة آرامية (أو جذراً) لتحصل على جذرها ومعناها العبري من معجم أ. طال ومواضعها في التوراة.']],
    ['شاشة الدخول والتثبيت', [
      'عند الدخول تظهر شاشة بداية فيها يد تكتب الآية بالخطّ السامري (مع صوت كتابة — اضغط 🔊 لتفعيله). <b>تخطٍّ ›</b> يتخطّاها؛ وعلى التطبيق المثبّت يظهر <b>تخطٍّ دائماً</b> للدخول مباشرةً في المرّات التالية.',
      'في أوّل زيارة تظهر نافذة <b>ترحيب</b>. إن لم يكن التطبيق مثبّتاً يُقترح <b>تثبيته</b>، وإن لم تُفعّل الإشعارات بعد يُقترح <b>السماح بالإشعارات</b> حول الميزات والإصدارات الجديدة — ولكلّ اقتراح خيار <b>لا تُظهر مرّة أخرى</b>.']],
    ['القائمة', [
      '<b>تثبيت التطبيق</b> · <b>تغيير اللغة</b> · التقويم السامري · شجرة الأنساب · <b>المكتبة السامرية ← المعجم الآرامي-العبري</b> · مساعدة · الإصدار · اتصل بنا.']],
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
      '<b>הצג פירוש המילים</b> — מתחת לתוצאה: תרגום ארמי, מילון טל, ופירוש עברי.',
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
      '<b>Show word meanings</b> — under each result: Aramaic translation, Tal’s dictionary, and a Hebrew meaning.',
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
      '<b>إظهار معاني الكلمات</b> — تحت كلّ نتيجة: الترجمة الآرامية، معجم طال، ومعنى عبري.',
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

async function showWhatsNew(){
  showInfo('מה חדש?', '<div class="note">טוען…</div>');
  try{
    const d=await api('whats_new');
    const txt=(d.text||'').trim() || 'אין חידושים להצגה.';
    $('infoTitle').textContent='מה חדש? — גרסה '+(d.version||'');
    $('infoBody').innerHTML='<pre class="whatsnew">'+esc(txt)+'</pre>';
  }catch(e){ $('infoBody').innerHTML='<div class="note">שגיאה בטעינת החידושים.</div>'; }
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
const ADMIN = { token:null };
// reveal "כניסת מנהל" only where admin is enabled (the local server has a password)
api('admin/status').then(s=>{ if(s && s.enabled){ $('adminSep').classList.remove('hidden'); $('adminMenuItem').classList.remove('hidden'); } }).catch(()=>{});
function openAdminLogin(){
  if(ADMIN.token){ ADMIN.token=null; $('adminMenuItem').textContent=t('m_admin'); paintVerses(); return; } // logout
  $('admErr').textContent=''; $('admUser').value=''; $('admPass').value='';
  $('adminModal').classList.remove('hidden'); $('admUser').focus();
}
$('admCancel').onclick=()=>$('adminModal').classList.add('hidden');
$('admLogin').onclick=async ()=>{
  const user=$('admUser').value.trim(), password=$('admPass').value;
  $('admErr').textContent='';
  let r; try{ r=await apiPost('admin/login', {user, password}); }catch(e){ r={ok:false}; }
  if(r && r.ok){
    ADMIN.token=r.token; $('adminModal').classList.add('hidden');
    $('adminMenuItem').textContent='✓ '+t('m_admin');
    showInfo(t('m_admin'), `<div class="note">${esc(t('admin_on'))}</div>`);
    paintVerses();
  } else { $('admErr').textContent=t('adm_bad'); }
};
$('admPass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('admLogin').click(); });
// add a floating edit pencil (admin only) to a text row → opens the edit window
function addPencil(rowEl, verseId, column, getText){
  if(!ADMIN.token) return;
  rowEl.classList.add('editable-row');
  const p=el('button','edit-pencil','✎'); p.title=t('edit_title');
  p.onclick=(ev)=>{ ev.stopPropagation(); openEdit(verseId, column, getText()); };
  rowEl.prepend(p);   // leftmost (the row is LTR) → floats to the left of the text
}
let _editCtx=null;
function openEdit(verseId, column, text){
  _editCtx={verseId, column};
  $('editTitle').textContent=t('edit_title'); $('editErr').textContent=''; $('editArea').value=text||'';
  $('editModal').classList.remove('hidden'); $('editArea').focus();
}
$('editCancel').onclick=()=>$('editModal').classList.add('hidden');
$('editSave').onclick=async ()=>{
  if(!_editCtx || !ADMIN.token) return;
  const value=$('editArea').value; $('editErr').textContent='';
  let r; try{ r=await apiPost('admin/edit', {token:ADMIN.token, table:'verses', column:_editCtx.column, id:_editCtx.verseId, value}); }catch(e){ r={ok:false}; }
  if(r && r.ok){
    const v=(S.verses||[]).find(x=>x.id===_editCtx.verseId); if(v) v[_editCtx.column]=value;
    _apiCache.clear();                 // drop cached responses holding the old text
    $('editModal').classList.add('hidden'); paintVerses();
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
async function mergeNext(){
  if(!ADMIN.token) return;
  if(!await askConfirm(t('merge_next'), t('merge_q'), t('confirm_yes'), t('c_cancel'))) return;
  const ep = S.chMode==='samaritan' ? 'admin/merge_next_sam' : 'admin/merge_next';
  let r; try{ r=await apiPost(ep, {token:ADMIN.token, chapter_id:S.curChId}); }catch(e){ r={ok:false}; }
  if(r&&r.ok){ await reloadChapters(); showInfo(t('m_admin'), `<div class="note">${esc(t('merged_ok'))}</div>`); }
  else showInfo(t('m_admin'), `<div class="note">${esc((r&&r.error)||t('edit_err'))}</div>`);
}
async function askSplit(v){
  if(!await askConfirm(t('split_chapter'), t('split_q')+v.number+'?', t('confirm_yes'), t('c_cancel'))) return;
  S.splitMode=false;
  const ep = S.chMode==='samaritan' ? 'admin/split_sam' : 'admin/split';
  let r; try{ r=await apiPost(ep, {token:ADMIN.token, chapter_id:S.curChId, after_verse_id:v.id}); }catch(e){ r={ok:false}; }
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
function showWelcome(){
  return new Promise(resolve=>{
    const L=I18N[LANG]||I18N.he;
    const pages = L.welcome_pages || [L.welcome_body || ''];
    $('wcTitle').textContent = t('welcome_title');
    const track=$('wcTrack'); track.innerHTML='';
    track.style.direction = (LANG==='en') ? 'ltr' : 'rtl';
    pages.forEach(html=>{ const pg=el('div','wc-page'); pg.innerHTML=html; track.appendChild(pg); });
    const dots=$('wcDots'); dots.innerHTML='';
    const setActive=i=>[...dots.children].forEach((d,j)=>d.classList.toggle('active', j===i));
    pages.forEach((_,i)=>{ const d=el('button','wc-dot'+(i===0?' active':''));
      d.setAttribute('aria-label', String(i+1));
      d.onclick=()=>{ setActive(i);   // update immediately (don't rely only on the scroll event)
        track.children[i].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); };
      dots.appendChild(d); });
    let st=null;
    track.onscroll=()=>{ clearTimeout(st); st=setTimeout(()=>setActive(wcActiveIndex(track)), 60); };
    const read=$('wcRead'); read.checked=false;          // off by default
    read.onchange=()=>{ if(read.checked) localStorage.setItem('as_welcome_read','1');
                        else localStorage.removeItem('as_welcome_read'); };
    const done=()=>{ if(read.checked) localStorage.setItem('as_welcome_read','1');
                     $('welcomeModal').classList.add('hidden'); resolve(); };
    $('wcClose').onclick=done;
    $('welcomeModal').classList.remove('hidden');
    requestAnimationFrame(()=>{ track.children[0].scrollIntoView({inline:'center', block:'nearest'}); setActive(0); });
  });
}
async function requestNotif(){ try{ if('Notification' in window) await Notification.requestPermission(); }catch(e){} }
async function runOnboarding(){
  // 1. welcome — a paginated carousel shown on EVERY entry until the reader ticks
  //    "I have read" (which persists as_welcome_read='1').
  if(localStorage.getItem('as_welcome_read')!=='1'){
    await showWelcome();
  }
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
}
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

// ── start ────────────────────────────────────────────────────────────────────
showBooks();
applyI18n();
updateBmMenu();
