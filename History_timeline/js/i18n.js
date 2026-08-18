/* i18n.js — שלוש שפות הממשק: עברית, אנגלית וערבית.
 *
 * השפה נבחרת לפי הסדר הזה:
 *   1. פרמטר ?lang=he|en|ar בכתובת   (כך שולח אותה אתר the-samaritans.net)
 *   2. הנתיב שממנו הגענו: /he/ או /ar/ באתר
 *   3. הבחירה הידנית האחרונה (localStorage)
 *   4. שפת הדפדפן
 *   5. ברירת מחדל: עברית
 */
(function (global) {
  'use strict';

  var UI = {
    he: {
      brand: 'אבני שהם — פרויקט האב',
      title: 'ציר הזמן ההיסטורי',
      subtitle: 'הישראלים השומרונים — מבריאת העולם ועד ימינו',
      searchPlaceholder: 'חיפוש אירוע, אישיות או שנה…',
      layers: 'שכבות:',
      bands: 'רצועות:',
      all: 'הכל',
      allTitle: 'להציג את כל הציר',
      play: '▶ מסע',
      stop: '❚❚ עצירה',
      playTitle: 'מסע אוטומטי על הציר',
      popAxis: 'אוכלוסייה',
      popChip: 'גרף האוכלוסייה',
      popTitle: 'שומרונים בעולם',
      popCensus: 'מניין מתועד',
      popEstimate: 'אומדן מחקרי',
      helpTitle: 'הסבר',
      muteTitle: 'השתקת מוסיקת הרקע',
      unmuteTitle: 'הפעלת מוסיקת הרקע',
      backToSite: '↩ לאתר',
      zoomInTitle: 'התקרבות (+)',
      zoomOutTitle: 'התרחקות (−)',
      railTitle: 'גרירה כאן מזיזה את ציר הזמן',
      noResults: 'לא נמצאו תוצאות',
      goToYear: 'מעבר לשנה',
      source: 'מקור: ',
      yearsOfOffice: 'שנות כהונה',
      approx: 'בערך ',
      gapInList: 'פער ברשימה',
      copy: '© כל הזכויות שמורות ל־Osher Sassoni',
      /* מניני השנים */
      bce: 'לפנה״ס',
      ce: 'לספירה',
      toCreation: 'לבריאה',
      toEntry: 'לכניסה',
      beforeEntry: 'לפני הכניסה',
      /* שמות השכבות */
      tr_samaritan: 'תולדות השומרונים',
      tr_israel: 'עם ישראל ויהודה',
      tr_torah: 'ימי המקרא',
      tr_world: 'העולם והשלטונות',
      tr_people: 'אישים וחוקרים',
      rs_priests: 'כהנים גדולים',
      rs_pm: 'ראשי ממשלה',
      rs_pres: 'נשיאים',
      ttl_priests: 'הכהן הגדול',
      ttl_pm: 'ראש הממשלה',
      ttl_pres: 'נשיא המדינה',
      inTheDaysOf: 'בימי ',
      inDynasty: ' (ה־{n} בשושלת)',
      /* עזרה */
      mk_creation: 'הבריאה', mk_patriarchs: 'האבות', mk_entry: 'הכניסה לארץ',
      mk_samaria: 'חורבן שומרון', mk_ce: 'הספירה', mk_arab: 'הכיבוש הערבי',
      mk_ottoman: 'העות׳מאנים', mk_today: 'ימינו',
      helpH: 'איך משתמשים בציר',
      help1: '<b>הסרגל האנכי שמשמאל</b> מציג את החלק היחסי שאתם רואים מתוך הציר כולו. גרירה שלו כלפי מטה מסיעה את ציר הזמן שמאלה, קדימה אל ימינו. הציר עצמו רץ משמאל לימין: הבריאה בקצה השמאלי, ימינו בקצה הימני.',
      help2: '<b>נקודת ה־0</b> היא הקו הזהוב הקבוע בקצה השמאלי: הוא אינו זז, וציר הזמן חולף תחתיו. לידו מוצגות השנה הגרגוריאנית, השנה לבריאת העולם, השנה לכניסה לארץ כנען ושמות נושאי המשרה שכיהנו אז — הכהן הגדול, ומשנת 1948 גם ראש הממשלה ונשיא המדינה.',
      help3: 'גלילה עם העכבר, גרירה של הציר, או מקשי החיצים — מזיזים את הזמן. <b>Ctrl+גלגלת</b> או כפתורי + / − משנים את קנה המידה.',
      help4: 'לחיצה על אירוע פותחת את פרטיו ואת המקור שממנו נלקח.',
      help5: '<b>הסרגל האנכי שמימין</b> מודד את מספר השומרונים בעולם באותה עת. הסקאלה לוגריתמית — מ‎100 נפש עד מיליון — שאם לא כן היה כל מה שאירע מן המאה ה‎-12 ואילך נמחק לקו אפס. נקודה מלאה היא מניין מתועד; נקודה מקווקוות היא אומדן מחקרי, וגם הקו שביניהן מקווקו. לחיצה על נקודה מציגה את המספר ואת מקורו.',
      helpH2: 'מניני השנים',
      helpEras: '<b>לכניסה לארץ כנען</b> = השנה הגרגוריאנית + 1638, על פי מנוע לוח השנה השומרוני. <b>לבריאת העולם</b> = מניין כנען + 2800, כפי שנדפס בלוחות השומרוניים. חשבון התורה עצמו (נוסח שומרון) נותן 1307 שנה מהבריאה למבול, 942 עד לידת אברהם, 430 שנות מגורים בכנען ובמצרים ו־40 שנות מדבר.'
    },

    en: {
      brand: 'Avnei Shoham — the parent project',
      title: 'The Historical Timeline',
      subtitle: 'The Israelite Samaritans — from Creation to our own day',
      searchPlaceholder: 'Search an event, a person or a year…',
      layers: 'Layers:',
      bands: 'Bands:',
      all: 'All',
      allTitle: 'Fit the whole timeline',
      play: '▶ Journey',
      stop: '❚❚ Stop',
      playTitle: 'Travel automatically along the timeline',
      popAxis: 'Population',
      popChip: 'Population graph',
      popTitle: 'Samaritans in the world',
      popCensus: 'documented count',
      popEstimate: 'scholarly estimate',
      helpTitle: 'Help',
      muteTitle: 'Mute the background music',
      unmuteTitle: 'Unmute the background music',
      backToSite: '↩ Back to site',
      zoomInTitle: 'Zoom in (+)',
      zoomOutTitle: 'Zoom out (−)',
      railTitle: 'Drag here to move the timeline',
      noResults: 'No results',
      goToYear: 'Go to the year',
      source: 'Source: ',
      yearsOfOffice: 'years in office',
      approx: 'c. ',
      gapInList: 'Gap in the list',
      copy: '© All rights reserved to Osher Sassoni',
      bce: 'BCE',
      ce: 'CE',
      toCreation: 'AM',
      toEntry: 'to the Entry',
      beforeEntry: 'before the Entry',
      tr_samaritan: 'Samaritan history',
      tr_israel: 'Israel and Judah',
      tr_torah: 'Biblical era',
      tr_world: 'The world and its rulers',
      tr_people: 'Figures and scholars',
      rs_priests: 'High Priests',
      rs_pm: 'Prime Ministers',
      rs_pres: 'Presidents',
      ttl_priests: 'High Priest',
      ttl_pm: 'Prime Minister',
      ttl_pres: 'President of Israel',
      inTheDaysOf: 'In the days of ',
      inDynasty: ' ({n} in the line)',
      mk_creation: 'Creation', mk_patriarchs: 'Patriarchs', mk_entry: 'Entry to the Land',
      mk_samaria: 'Fall of Samaria', mk_ce: 'Common Era', mk_arab: 'Arab conquest',
      mk_ottoman: 'Ottomans', mk_today: 'Today',
      helpH: 'How to use the timeline',
      help1: '<b>The vertical rail on the left</b> shows which part of the whole timeline you are looking at. Dragging it downwards moves the timeline leftwards, forward towards our own day. The axis itself runs left to right: Creation at the far left, today at the far right.',
      help2: '<b>The zero point</b> is the fixed golden line at the left edge. It never moves; the timeline slides beneath it. Beside it you see the Gregorian year, the year from the Creation of the World, the year from the Entry into the Land of Canaan, and who held office in that year — the High Priest, and from 1948 also the Prime Minister and the President.',
      help3: 'The mouse wheel, dragging the axis, or the arrow keys move you through time. <b>Ctrl+wheel</b> or the + / − buttons change the scale.',
      help4: 'Clicking an event opens its full description and the source it came from.',
      help5: '<b>The vertical scale on the right</b> measures how many Samaritans there were in the world at that time. The scale is logarithmic — from 100 souls to a million — since otherwise everything from the 12th century onwards would collapse onto the zero line. A solid dot is a documented count; a dashed dot is a scholarly estimate, and so is the line between them. Clicking a dot shows the figure and its source.',
      helpH2: 'The year counts',
      helpEras: '<b>From the Entry into Canaan</b> = the Gregorian year + 1638, following the Samaritan calendar engine. <b>From the Creation of the World</b> = the Canaan count + 2800, as printed on the Samaritan calendars. The Torah’s own reckoning (the Samaritan version) gives 1307 years from Creation to the Flood, 942 more to the birth of Abraham, 430 years of sojourning in Canaan and Egypt, and 40 years in the wilderness.'
    },

    ar: {
      brand: 'أبني شوهم — المشروع الأم',
      title: 'الخط الزمني التاريخي',
      subtitle: 'الإسرائيليون السامريون — من الخليقة حتى يومنا هذا',
      searchPlaceholder: 'ابحث عن حدث أو شخصية أو سنة…',
      layers: 'الطبقات:',
      bands: 'الأشرطة:',
      all: 'الكل',
      allTitle: 'عرض الخط الزمني كاملاً',
      play: '▶ رحلة',
      stop: '❚❚ إيقاف',
      playTitle: 'التنقل التلقائي على الخط الزمني',
      popAxis: 'عدد السكان',
      popChip: 'منحنى السكان',
      popTitle: 'السامريون في العالم',
      popCensus: 'إحصاء موثّق',
      popEstimate: 'تقدير بحثي',
      helpTitle: 'مساعدة',
      muteTitle: 'كتم موسيقى الخلفية',
      unmuteTitle: 'تشغيل موسيقى الخلفية',
      backToSite: '↩ إلى الموقع',
      zoomInTitle: 'تكبير (+)',
      zoomOutTitle: 'تصغير (−)',
      railTitle: 'اسحب هنا لتحريك الخط الزمني',
      noResults: 'لا توجد نتائج',
      goToYear: 'الانتقال إلى سنة',
      source: 'المصدر: ',
      yearsOfOffice: 'سنوات في المنصب',
      approx: 'نحو ',
      gapInList: 'فجوة في القائمة',
      copy: '© جميع الحقوق محفوظة لـ Osher Sassoni',
      bce: 'ق.م',
      ce: 'م',
      toCreation: 'للخليقة',
      toEntry: 'للدخول',
      beforeEntry: 'قبل الدخول',
      tr_samaritan: 'تاريخ السامريين',
      tr_israel: 'إسرائيل ويهوذا',
      tr_torah: 'العصر التوراتي',
      tr_world: 'العالم والحكّام',
      tr_people: 'شخصيات وباحثون',
      rs_priests: 'الكهنة الأكبرون',
      rs_pm: 'رؤساء الحكومة',
      rs_pres: 'الرؤساء',
      ttl_priests: 'الكاهن الأكبر',
      ttl_pm: 'رئيس الحكومة',
      ttl_pres: 'رئيس الدولة',
      inTheDaysOf: 'في أيام ',
      inDynasty: ' (الـ{n} في السلسلة)',
      mk_creation: 'الخليقة', mk_patriarchs: 'الآباء', mk_entry: 'الدخول إلى الأرض',
      mk_samaria: 'سقوط السامرة', mk_ce: 'الميلاد', mk_arab: 'الفتح العربي',
      mk_ottoman: 'العثمانيون', mk_today: 'اليوم',
      helpH: 'كيف تستخدم الخط الزمني',
      help1: '<b>الشريط العمودي على اليسار</b> يبيّن أي جزء من الخط الزمني تشاهده. سحبه إلى الأسفل يحرّك الخط الزمني إلى اليسار، أي إلى الأمام نحو أيامنا. أما المحور نفسه فيمتد من اليسار إلى اليمين: الخليقة في أقصى اليسار، ويومنا في أقصى اليمين.',
      help2: '<b>نقطة الصفر</b> هي الخط الذهبي الثابت عند الحافة اليسرى. لا يتحرك، بل ينزلق الخط الزمني تحته. وبجانبه تظهر السنة الميلادية، والسنة من خلق العالم، والسنة من الدخول إلى أرض كنعان، وأسماء من تولّوا المناصب في تلك السنة — الكاهن الأكبر، ومنذ 1948 أيضاً رئيس الحكومة ورئيس الدولة.',
      help3: 'عجلة الفأرة أو سحب المحور أو مفاتيح الأسهم تنقلك عبر الزمن. <b>Ctrl + العجلة</b> أو زرّا + / − يغيّران المقياس.',
      help4: 'النقر على أي حدث يفتح وصفه الكامل والمصدر المأخوذ عنه.',
      help5: '<b>المقياس العمودي على اليمين</b> يبيّن كم سامرياً كان في العالم في ذلك الزمن. والمقياس لوغاريتمي — من 100 نفس إلى مليون — وإلا لانمحى كل ما جرى من القرن الثاني عشر فصاعداً على خط الصفر. النقطة المصمتة إحصاء موثّق؛ والنقطة المتقطعة تقدير بحثي، وكذلك الخط الواصل بينهما. والنقر على أي نقطة يعرض الرقم ومصدره.',
      helpH2: 'تقاويم السنين',
      helpEras: '<b>من الدخول إلى كنعان</b> = السنة الميلادية + 1638، وفق محرك التقويم السامري. <b>من خلق العالم</b> = تقويم كنعان + 2800، كما يُطبع في التقاويم السامرية. أما حساب التوراة نفسه (النسخة السامرية) فيعطي 1307 سنة من الخليقة إلى الطوفان، و942 حتى ولادة إبراهيم، و430 سنة إقامة في كنعان ومصر، و40 سنة في البرية.'
    }
  };

  var RTL = { he: 1, ar: 1 };

  function detect() {
    var m = /[?&]lang=(he|en|ar)\b/i.exec(location.search);
    if (m) return m[1].toLowerCase();
    try {
      var ref = document.referrer || '';
      if (/\/\/[^/]*the-samaritans\.net\/he(\/|$)/i.test(ref)) return 'he';
      if (/\/\/[^/]*the-samaritans\.net\/ar(\/|$)/i.test(ref)) return 'ar';
      if (/\/\/[^/]*the-samaritans\.net\//i.test(ref)) return 'en';
      var saved = localStorage.getItem('timelineLang');
      if (saved && UI[saved]) return saved;
    } catch (e) { /* localStorage חסום — לא נורא */ }
    var nav = (navigator.language || 'he').slice(0, 2).toLowerCase();
    return UI[nav] ? nav : 'he';
  }

  var lang = detect();

  function t(key) {
    var d = UI[lang] || UI.he;
    return d[key] != null ? d[key] : (UI.he[key] != null ? UI.he[key] : key);
  }

  /* בחירת שדה מתורגם מתוך מילון הנתונים, עם נפילה חזרה לעברית */
  function pick(table, id, field, fallback) {
    var T = global.I18N_DATA && global.I18N_DATA[lang];
    var rec = T && T[table] && T[table][id];
    if (rec && rec[field] != null && rec[field] !== '') return rec[field];
    return fallback;
  }

  function apply() {
    var d = UI[lang] || UI.he;
    var rtl = !!RTL[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.style.setProperty('--tdir', rtl ? 'rtl' : 'ltr');
    document.title = d.title + ' — ' + d.subtitle;
    document.body.setAttribute('data-lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var v = d[n.getAttribute('data-i18n')];
      if (v != null) n.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (n) {
      var v = d[n.getAttribute('data-i18n-title')];
      if (v != null) n.setAttribute('title', v);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      var v = d[n.getAttribute('data-i18n-ph')];
      if (v != null) n.setAttribute('placeholder', v);
    });
  }

  function setLang(next) {
    if (!UI[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem('timelineLang', next); } catch (e) { /* אין אחסון */ }
    var u = new URL(location.href);
    u.searchParams.set('lang', next);
    location.replace(u.toString());
  }

  /* קישור החזרה לאתר, לפי שפת האתר */
  function siteUrl() {
    return 'https://www.the-samaritans.net/' + (lang === 'he' ? 'he/' : lang === 'ar' ? 'ar/' : '');
  }

  global.I18N = {
    get lang() { return lang; },
    isRtl: function () { return !!RTL[lang]; },
    t: t, pick: pick, apply: apply, setLang: setLang, siteUrl: siteUrl,
    languages: ['he', 'en', 'ar']
  };
})(window);
