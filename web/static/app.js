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
    next_chapter:'‹ פרק הבא', prev_chapter:'פרק קודם ›',
    share:'שתף', export_excel:'ייצוא לאקסל', no_results_xls:'אין תוצאות לייצוא',
    back:'‹ חזור', browse:'עיון', search:'חיפוש', dict:'מילון מילים',
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
    no_variants:'אין חילופי נוסח לפסוקים אלה. (האפראט של פון גאל מתועד כרגע לבראשית פרק א׳ בלבד.)',
    dict_hint:'מילון מילים — הקש על שורה לערך המלא במילון א. טל', no_dict:'אין מילון זמין לפסוק זה',
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
    next_chapter:'Next chapter ›', prev_chapter:'‹ Previous chapter',
    share:'Share', export_excel:'Export to Excel', no_results_xls:'No results to export',
    back:'‹ Back', browse:'Browse', search:'Search', dict:'Word dictionary',
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
    no_variants:"No textual variants for these verses. (Von Gall's apparatus is currently digitised for Genesis 1 only.)",
    dict_hint:"Word dictionary — tap a row for the full entry in A. Tal's dictionary", no_dict:'No dictionary for this verse',
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
    next_chapter:'الأصحاح التالي ›', prev_chapter:'‹ الأصحاح السابق',
    share:'مشاركة', export_excel:'تصدير إلى إكسل', no_results_xls:'لا توجد نتائج للتصدير',
    back:'‹ رجوع', browse:'تصفّح', search:'بحث', dict:'معجم الكلمات',
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
    no_variants:'لا توجد اختلافات نصّية لهذه الآيات. (جهاز فون غال موثّق حالياً للإصحاح الأول من سفر التكوين فقط.)',
    dict_hint:'معجم الكلمات — اضغط على صفّ لعرض المدخل الكامل في معجم أ. طال', no_dict:'لا يوجد معجم لهذه الآية',
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
let LANG = (localStorage.getItem('uiLang') && I18N[localStorage.getItem('uiLang')]) ? localStorage.getItem('uiLang') : 'he';
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
  // Hebrew letter runs and the verse-pause period render in the Samaritan font.
  let html=''; const re=/([א-ת]+|\.)/g; let last=0, m;
  while((m=re.exec(text))!==null){
    if(m.index>last) html += esc(text.slice(last,m.index));
    html += '<span class="samchar">'+esc(m[0])+'</span>';
    last = re.lastIndex;
  }
  if(last<text.length) html += esc(text.slice(last));
  return html;
}
function verseHTML(v){
  if(S.english){ const e=v.english||('[verse '+v.number+']'); return {html:esc(e), cls:'vtext eng'}; }
  if(S.samFont) return {html:samMarkup(addWordDots(v.text||'')), cls:'vtext'};
  return {html:esc(v.text||''), cls:'vtext'};
}
function fsize(){ return (S.samFont?22:20) + S.fontOffset; }

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
  const books = await api('books?mode='+(S.division==='samaritan'?'samaritan':'standard'));
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
  const grid=el('div','grid g5');
  for(const r of rows){ const b=el('button','cell',String(r.number)); b.onclick=()=>onClick(r); grid.appendChild(b); }
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
  paintVerses();
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
    else if(S.panel==='variants'){ addPlainRows(c, verses); buildVariants(c, verses); }
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
async function buildVariants(c, verses){
  const items = await api('apparatus?verse_ids='+verses.map(v=>v.id).join(','));
  const panel=el('div','srcpanel');
  panel.appendChild(el('div','ptitle',t('variants_title')));
  if(!items.length){
    panel.appendChild(el('div','note',t('no_variants')));
    c.appendChild(panel); return;
  }
  let curV=null;
  for(const it of items){
    if(it.verse!==curV){ curV=it.verse; panel.appendChild(el('div','app-vhead','פסוק '+esc(String(it.verse)))); }
    const card=el('div','app-card');
    const occ = it.occurrence?'<sup>'+esc(it.occurrence)+'</sup>':'';
    const reg = it.register===2?' <span class="app-reg">כתיב/ניקוד</span>':'';
    card.appendChild(el('div','app-lemma','<b>'+esc(it.lemma||'—')+'</b>'+occ+reg+'  <span class="app-mark">⟵ מצביע</span>'));
    let rd;
    if(it.type==='om') rd='חֲסֵרָה';
    else if(it.type==='add') rd='נוסף: '+esc(it.reading);
    else if(it.type==='transp') rd='היפוך סדר'+(it.reading?': '+esc(it.reading):'');
    else if(it.type==='del') rd='מחיקת מגיה'+(it.reading?': '+esc(it.reading):'');
    else rd=esc(it.reading||'—');
    card.appendChild(el('div','app-read','<span class="app-type">'+esc(it.type_label)+'</span> '+rd));
    if(it.witnesses && it.witnesses.length)
      card.appendChild(el('div','app-wit','עדים: <span dir="ltr">'+esc(it.witnesses.join(', '))+'</span>'));
    if(it.note) card.appendChild(el('div','app-note',esc(it.note)));
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
    tr.appendChild(el('td','wt-aram',esc(w.aramaic||'—')));
    tr.appendChild(el('td','wt-mean',esc(w.meaning||'—')));
    tr.appendChild(el('td','wt-tal',esc(w.tal||'—')));
    tr.appendChild(el('td','wt-ar',esc(w.arabic||'—')));
    if(w.aramaic){ tr.classList.add('tappable'); tr.onclick=()=>showTal(w.aramaic); }
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
// Tap a dictionary word → a popup window with its full entry/entries from Tal's
// dictionary (lemma, part of speech, gloss, full text, citations, page).
async function showTal(word){
  const res = await api('tal?word='+encodeURIComponent(word));
  const body=$('popupBody'); body.innerHTML=''; $('popupTitle').textContent=word;
  if(!res.length){ body.appendChild(el('div','note','לא נמצא ערך עבור מילה זו במילון של טל.')); }
  res.forEach((r,i)=>{
    let head=esc(r.lemma||word); if(r.pos) head+=`  ·  ${esc(r.pos)}`;
    body.appendChild(el('div','tal-head',head));
    if(r.gloss_en) body.appendChild(el('div','tal-gloss',esc(r.gloss_en)));
    if((r.notes||'').trim()) body.appendChild(el('div','tal-note',esc(r.notes.slice(0,600))));
    for(const [q,ref] of (r.citations||[])) body.appendChild(el('div','tal-cite',esc(q+'  —  '+ref)));
    if(r.page) body.appendChild(el('div','tal-cite',`(עמ׳ ${esc(String(r.page))} במילון)`));
    if(i<res.length-1) body.appendChild(el('hr'));
  });
  $('popup').classList.remove('hidden');
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
function updateNavDisabled(){
  const ids = S.portions.map(p=>p.id); const pidx = ids.indexOf(S.curPid);
  if(S.navMode==='chapter'){
    const firstP = pidx<=0, lastP = pidx>=ids.length-1;
    $('prevBtn').disabled = (S.chIdx<=0) && firstP;
    $('nextBtn').disabled = (S.chIdx>=S.chList.length-1) && lastP;
  } else {
    $('prevBtn').disabled = pidx<=0;
    $('nextBtn').disabled = pidx>=ids.length-1;
  }
}
$('prevBtn').onclick=()=> S.navMode==='chapter'? stepChapter(-1) : stepPortion(-1);
$('nextBtn').onclick=()=> S.navMode==='chapter'? stepChapter(1)  : stepPortion(1);

async function stepChapter(delta){
  S.verseFilter=null;
  const ni = S.chIdx+delta;
  if(ni>=0 && ni<S.chList.length){
    S.chIdx=ni; const ch=S.chList[ni];
    await renderVerses(ch.id, ch.number, S.curPid, S.portionName);
  } else { await crossPortion(delta); }
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
async function stepPortion(delta){
  const ids=S.portions.map(p=>p.id); const pidx=ids.indexOf(S.curPid);
  const ni=pidx+delta; if(ni<0||ni>=S.portions.length) return;
  const p=S.portions[ni];
  S.division==='samaritan' ? showSamChapters(p.id,p.name) : showChapters(p.id,p.name);
}

// ── font size ────────────────────────────────────────────────────────────────
$('minusBtn').onclick=()=>{ S.fontOffset-=2; paintVerses(); };
$('plusBtn').onclick=()=>{ S.fontOffset+=2; paintVerses(); };

// ── view chrome (show/hide nav + enable toolbar) ─────────────────────────────
function setView(){
  const isVerse = S.view==='verses';
  $('navbar').classList.toggle('hidden', !(isVerse || S.view==='chapters' || S.view==='sam_chapters'));
  $('spreadBtn').classList.toggle('hidden', !(S.view==='portions'));
  if(S.view==='books'||S.view==='portions'||S.view==='spread') $('navbar').classList.add('hidden');
  $('bmAddBtn').classList.toggle('hidden', !isVerse);   // floating "add bookmark"
  syncToolbar(isVerse);
}
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
  $('fontBtn').textContent = sam ? t('font_heb') : t('font_sam');
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
$('browseBtn').onclick=()=>{ showSearch(false); showBooks(); };
$('searchBtn').onclick=()=>showSearch(true);
$('backBtn').onclick=()=>goBack();

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
  if(on) $('searchInput').focus();
}
$('sBackBtn').onclick=()=>{ showSearch(false); restoreFromSearch(); };
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
$('sMinusBtn').onclick=()=>{ S.searchFontOffset=Math.max(-6,S.searchFontOffset-2); doSearch(); };
$('sPlusBtn').onclick=()=>{ S.searchFontOffset=Math.min(40,S.searchFontOffset+2); doSearch(); };

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
    // Aramaic translation (clickable → more locations) + Tal gloss + online Hebrew.
    if(showMeanings){
      const heWord = r.matched_word || q;
      const ml=el('div','res-meaning');
      let hasParts=false;
      if(r.aramaic){
        const a=el('span','aram-link', 'תרגום ארמי: ');
        a.appendChild(el('b','', esc(r.aramaic)));
        a.appendChild(el('span','more-hint', ' (לחץ על המילה לתוצאות נוספות)'));
        a.title='לחץ למיקומים נוספים של המילה';
        a.onclick=()=>openWordSources(r.aramaic);
        ml.appendChild(a); hasParts=true;
      }
      if(r.meaning){
        if(hasParts) ml.appendChild(el('span','sep','  ·  '));
        ml.appendChild(el('span','', 'מילון טל: '+esc(r.meaning))); hasParts=true;
      }
      const heSpan=el('span','he-mean');
      heSpan.dataset.word=heWord; heSpan.dataset.sep=hasParts?'1':'0';
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
document.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>{ const a=b.dataset.act; closeMenu(); menuAction(a); });

function menuAction(a){
  if(a==='calendar')       open(CALENDAR_URL, '_blank', 'noopener');
  else if(a==='genealogy') open(GENEALOGY_URL, '_blank', 'noopener');
  else if(a==='install')   doInstall();
  else if(a==='bookmarks') openBookmarks();
  else if(a==='adminlogin') openAdminLogin();
  else if(a==='lang')      $('langModal').classList.remove('hidden');
  else if(a==='whatsnew')  showWhatsNew();
  else if(a==='help')      showHelp();
  else if(a==='version')   showInfo('גרסא נוכחית', `<div class="ver-num">גרסה ${esc(window.APP_VERSION||'1.0')}</div>`);
  else if(a==='contact')   openContact();
}

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
      'בחר <b>ספר → פרשה → פרק</b>, ואז מוצגים הפסוקים. <b>פריסת פרקים</b> מאפשר קפיצה לכל פרק.',
      'שורת הניווט: <b>פרק/פרשה הבא/קודם</b> ו-<b>+ / −</b> לגודל הטקסט.',
      'הקש על <b>מספר פסוק</b> כדי לראות רק אותו; <b>נקה סינון</b> מבטל.']],
    ['מצבי תצוגה (הסרגל התחתון)', [
      'כפתורי התצוגה הם <b>קבוצת בחירה-יחידה</b>: לחיצה על כפתור מכבה אוטומטית את הקודם.',
      '<b>כתב שומרוני</b> — מציג בכתב העברי-השומרוני.',
      '<b>תרגומי התורה</b> — כפתור אחד הפותח בחירה: תרגום ארמי · ערבי · אנגלי. לחיצה חוזרת חוזרת לטקסט.',
      '<b>פירוש הפסוק</b> — פירוש רציף, מוצג במקום הטקסט, השוזר מקורות (כרגע לבראשית א׳–ו׳).',
      '<b>השוואה לנ.מסורה</b> — נוסח שומרון מול המסורה, עם סימון ההבדלים באדום.',
      '<b>חילופי נוסח</b> — חילופי הנוסח ממהדורת פון גאל עם עדי-הנוסח (כרגע לבראשית א׳).',
      '<b>פרשנות יהודית</b> — רש"י, רמב"ן, קאסוטו, בעל הטורים ועוד, מאתר ספריא.',
      '<b>ממקור שומרון</b> — תיבת מרקה · מן המסורת השומרונית · פירוש צדקה אל-חכים.',
      '<b>מילון מילים</b> — טבלה לכל מילה: המילה · ארמי · פירוש עברי · מילון א. טל · ערבית.',
      '<b>שתף</b> — וואטסאפ, אימייל או פייסבוק.']],
    ['חיפוש', [
      'הקלד מילה ולחץ <b>חפש</b>. יש כפתור <b>❔ עזרה לחיפוש</b> עם מדריך מפורט.',
      '<b>תווים כלליים:</b> <b>?</b> = תו אחד · <b>*</b> = מחרוזת · <b>+</b> = כל המילים באותו פסוק.',
      '<b>חיפוש מתקדם:</b> מדויק · לפי שורש · בתרגום הארמי · התעלם מסופיות · הצג פירוש המילים.']],
    ['תפריט', [
      '<b>התקנת אפליקציה</b> · <b>שנה שפה</b> · לוח השנה השומרוני · אילן היוחסין · עזרה · גרסה · צור קשר.']],
  ],
  en: [
    ['Division', ['At the top — <b>Jewish division</b> / <b>Samaritan division</b>: switch between the two chapter/portion divisions.']],
    ['Browse', [
      'Choose <b>book → portion → chapter</b> to show the verses. <b>All chapters</b> jumps to any chapter.',
      'Navigation bar: <b>next / previous chapter & portion</b> and <b>+ / −</b> for text size.',
      'Tap a <b>verse number</b> to see only it; <b>clear filter</b> resets.']],
    ['Display modes (bottom bar)', [
      'The display buttons are a <b>single-select group</b>: tapping one turns the previous off.',
      '<b>Samaritan script</b> — shows the text in the Samaritan-Hebrew script.',
      '<b>Torah translations</b> — one button opening a choice: Aramaic · Arabic · English. Tapping it again returns to the text.',
      '<b>Verse commentary</b> — a continuous commentary shown in place of the text, weaving the sources (currently Genesis 1–6).',
      '<b>Compare to Masorah</b> — Samaritan vs. Masoretic text, with the differences marked in red.',
      '<b>Textual variants</b> — variants from von Gall’s edition with the manuscript witnesses (currently Genesis 1).',
      '<b>Jewish commentary</b> — Rashi, Ramban, Cassuto, Baal ha-Turim and more, from Sefaria.',
      '<b>Samaritan sources</b> — Tībåt Mårqe · the Samaritan tradition · Ṣadaqah al-Ḥakīm’s commentary.',
      '<b>Word dictionary</b> — a table per word: word · Aramaic · Hebrew meaning · A. Tal’s dictionary · Arabic.',
      '<b>Share</b> — WhatsApp, email or Facebook.']],
    ['Search', [
      'Type a word and tap <b>Search</b>. A <b>❔ Search help</b> button gives a detailed guide.',
      '<b>Wildcards:</b> <b>?</b> = one letter · <b>*</b> = a string · <b>+</b> = all words in the same verse.',
      '<b>Advanced search:</b> exact · by root · in the Aramaic · ignore final letters · show word meanings.']],
    ['Menu', [
      '<b>Install app</b> · <b>Change language</b> · Samaritan calendar · genealogy · help · version · contact.']],
  ],
  ar: [
    ['التقسيم', ['في الأعلى — <b>التقسيم اليهودي</b> / <b>التقسيم السامري</b>: التبديل بين تقسيمَي الأصحاحات والمقاطع.']],
    ['التصفّح', [
      'اختر <b>سفر ← مقطع ← أصحاح</b> لعرض الآيات. <b>كل الأصحاحات</b> للانتقال إلى أيّ أصحاح.',
      'شريط التنقّل: <b>الأصحاح/المقطع التالي والسابق</b> و<b>+ / −</b> لحجم النصّ.',
      'اضغط على <b>رقم الآية</b> لعرضها وحدها؛ <b>مسح التصفية</b> يلغي ذلك.']],
    ['أوضاع العرض (الشريط السفلي)', [
      'أزرار العرض <b>مجموعة اختيار واحد</b>: الضغط على زرّ يُطفئ السابق تلقائياً.',
      '<b>الخط السامري</b> — يعرض النصّ بالخطّ العبري-السامري.',
      '<b>ترجمات التوراة</b> — زرّ واحد يفتح اختياراً: آرامية · عربية · إنجليزية. الضغط ثانيةً يعيد إلى النصّ.',
      '<b>تفسير الآية</b> — تفسير متّصل يُعرض مكان النصّ ويجمع المصادر (حالياً التكوين ١–٦).',
      '<b>مقارنة بالنصّ الماسوري</b> — النصّ السامري مقابل الماسوري مع تمييز الفروق بالأحمر.',
      '<b>اختلافات النصّ</b> — اختلافات من طبعة فون غال مع شهود النصّ (حالياً التكوين ١).',
      '<b>تفسير يهودي</b> — راشي، رمبان، كاسوتو، بعل هاطوريم وغيرهم من موقع سفاريا.',
      '<b>مصادر سامرية</b> — تيبات مارقه · التقليد السامري · تفسير صدقة الحكيم.',
      '<b>معجم الكلمات</b> — جدول لكلّ كلمة: الكلمة · الآرامية · المعنى العبري · معجم أ. طال · العربية.',
      '<b>مشاركة</b> — واتساب، بريد إلكتروني أو فيسبوك.']],
    ['البحث', [
      'اكتب كلمة واضغط <b>بحث</b>. يوجد زرّ <b>❔ مساعدة البحث</b> بدليل مفصّل.',
      '<b>أحرف عامة:</b> <b>?</b> = حرف واحد · <b>*</b> = سلسلة · <b>+</b> = كلّ الكلمات في الآية نفسها.',
      '<b>بحث متقدم:</b> تطابق تامّ · حسب الجذر · في الآرامية · تجاهل النهائية · إظهار المعاني.']],
    ['القائمة', [
      '<b>تثبيت التطبيق</b> · <b>تغيير اللغة</b> · التقويم السامري · شجرة الأنساب · مساعدة · الإصدار · اتصل بنا.']],
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

// ── start ────────────────────────────────────────────────────────────────────
showBooks();
applyI18n();
updateBmMenu();
