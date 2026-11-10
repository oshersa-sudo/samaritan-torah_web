/* התפריט הראשי — "אבני שהם".
 *
 * The page the app opens on: the Torah in a large circle in the middle, the other
 * apps on a ring round it that turns like a combination lock, each joined to the
 * centre by a dotted line. Whichever circle is at the top has a pop-up beside it
 * saying what that app gives. A language switch sits at the right; the choice is
 * the app's own LANG, so it goes with the reader into every screen, and the reader
 * is asked whether to keep it.
 *
 * Loaded after app.js and touching it only from the outside — wrapping a few of
 * its global functions — so that the whole feature can be taken out by removing
 * the markup, hub.css and this file.
 */
(function(){
  'use strict';
  const hub = document.getElementById('hub');
  if(!hub) return;
  const $ = id => document.getElementById(id);

  // ── words: the hub's own, in the app's three languages ─────────────────────
  // Full names of the apps are not repeated here — they come from the app's own
  // table (t('m_…')), so a name is spelled the same on the circle's pop-up as in
  // the hamburger menu. Only the short names on the circles and the descriptions
  // are the hub's.
  const TX = {
    he: {
      torah:'התורה השומרונית הישראלית', hint:'סובבו את החוגה · הקישו על עיגול כדי להיכנס',
      copy:'© כל הזכויות שמורות לאושר ששוני', go:'כניסה לאפליקציה ›', goAll:'לכל החידושים ›', newsTag:'עיקר החידושים האחרונים', langs:'שפה', ver:'גרסה', newsShort:'מה חדש', exit:'יציאה לתפריט הראשי', shots:'צ. מסך', title:'אבני שהם', goTorah:'כניסה לתורה ›',
      torahHelp:{ tag:'חמשת חומשי התורה בנוסח השומרוני',
        points:['חמישה חומשי תורה בנוסח השומרוני, בכתב השומרוני ובאותיות עבריות','פירוש הפסוק מן המקורות השומרוניים, ותרגומים: ארמי, ערבי ואנגלי','השוואת נוסחים: המסורה, השבעים, אונקלוס וקומראן','מילון מילים, הקראה, חיפוש מתקדם והדפסה'] },
      apps:{
        dict:{ name:'המילון הארמי-עברי', tag:'ארמית שומרונית ועברית',
          points:['מילון ארמי-עברי, ועברי-ארמי.','מבוסס על מילונים שונים ומגוונים.','חיפוש לפי מילה, שורש מילה','משמעות המילה, מופעי המילה בפיוטים השומרוניים, בתורה הארמית ובתיבת מרקה'] },
        shira:{ name:'אוצר השירה השומרונית', short:'אוצר השירה', tag:'ארכיון ההקלטות של השירה והפיוט',
          points:['הארכיון הגדול ביותר, לפיוטים והקלטות המושרות בידי בני העדה לאורך הדורות.','חיפוש לפי פיוט, אירוע, ומבצע','חיפוש מבצעים שונים לאותו פיוט','אקולייזר משוכלל המאפשר לשפר את איכות השמיעה','רשימות השמעה אישיות','מצב שמיעה ברכב'] },
        calendar:{ name:'לוח השנה השומרוני', tag:'התאריך, המועדים ופרשת השבוע',
          points:['לוח חשבון קשט - חשבון האמת - לוח השנה השומרוני.','מנוע חישובי עצמאי לאלפי שנים קדימה ולאחור.','ציון מועדי העדה, מועדי החגים היהודיים ואירועים כלליים.','ציון הפרשות השבועיות, כללי הלוח, אופן החישוב'] },
        library:{ name:'הספרייה', short:'הספרייה', tag:'הספרייה הדיגיטלית הנרחבת ביותר לאוצר החכמה השומרונית.',
          points:['ספרי מדרש, עיון, פרשנות, משפט והלכה מן המסורת השומרונית','אפשרות לחיפוש, תרגום, וקריאה סדירה.','מילון אישים','ארכיון פיוטים שומרוניים יחד עם התעתיק ופירוש המילים','חיפוש חרוזים'] },
        timeline:{ name:'ציר הזמן ההיסטורי', tag:'תולדות העדה לפי מניין השנים השומרוני',
          points:['אירועים בארץ ובעולם, לצד אירועים היסטוריים הקשורים בשומרונים','מניין השומרונים לכניסה ולבריאה לצד המניין הלועזי','הכל על ציר זמן אחד.','הסבר מפורט על כל אירוע.'] },
        mss:{ name:'אוצר כתבי היד הדיגיטלי', short:'אוצר כתבי היד', tag:'כתבי היד השומרוניים בספריות העולם',
          points:['קטלוג כתבי היד של התורה ושל כתבי העדה בספריות ובאוספים ברחבי העולם','פרטי כל כתב יד ותיאורו','צפייה בדפי כתב היד'] },
        genealogy:{ name:'אילן היוחסין השומרוני', short:'אילן היוחסין', tag:'אילן היוחסין המלא של בני העדה',
          points:['אילן היוחסין השומרוני המלא של משפחות העדה','חיפוש אדם ומעקב אחר אבותיו וצאצאיו','מבוסס על מפקד העדה ועל רישומי אירועים','צפייה בקשרי המשפחה בין הדורות'] },
      }
    },
    en: {
      torah:'The Israelite Samaritan Torah', hint:'Turn the dial · tap a circle to enter',
      copy:'© All rights reserved to Osher Sassoni', go:'Enter ›', goAll:'All the news ›', newsTag:'The main recent additions', langs:'Language', ver:'Version', newsShort:'What’s new', exit:'Exit to the main menu', shots:'Screenshots', title:'AVNEY SHOAM', goTorah:'Enter the Torah ›',
      torahHelp:{ tag:'The five books of the Torah in the Samaritan text',
        points:['The five books in the Samaritan text, in Samaritan script and Hebrew letters','Verse commentary from the Samaritan sources, and translations: Aramaic, Arabic and English','Comparison of versions: Masoretic, Septuagint, Onkelos and Qumran','A word dictionary, read-aloud, advanced search and printing'] },
      apps:{
        dict:{ name:'The Aramaic-Hebrew Dictionary', tag:'Samaritan Aramaic and Hebrew',
          points:['An Aramaic-Hebrew and Hebrew-Aramaic dictionary.','Based on a range of different dictionaries.','Search by word or by word root','The word’s meaning, and where it occurs in the Samaritan piyyutim, the Aramaic Targum and Tibat Marqe'] },
        shira:{ name:'The Samaritan Song Treasury', short:'The Song Treasury', tag:'The archive of Samaritan song and piyyut recordings',
          points:['The largest archive of piyyutim and recordings sung by members of the community across the generations.','Search by piyyut, event and performer','Find different performers of the same piyyut','An advanced equalizer to improve the listening quality','Personal playlists','Car listening mode'] },
        calendar:{ name:'The Samaritan Calendar', tag:'The date, the festivals and the weekly portion',
          points:['Luach Heshbon Qushta — the reckoning of truth — the Samaritan calendar.','An independent calculation engine for thousands of years forward and back.','Marks the community’s festivals, the Jewish festivals and general events.','Marks the weekly portions, the rules of the calendar and how it is calculated'] },
        library:{ name:'The Library', short:'The Library', tag:'The most extensive digital library of Samaritan wisdom.',
          points:['Books of midrash, study, commentary, law and halakha from the Samaritan tradition','Search, translation and continuous reading.','A dictionary of notable figures','An archive of Samaritan piyyutim with transcription and word meanings','Rhyme search'] },
        timeline:{ name:'The Historical Timeline', tag:'The community’s history by the Samaritan reckoning of years',
          points:['Events in the land and in the world, alongside historical events tied to the Samaritans','The Samaritan count from the entry into the land and from creation, beside the common count','Everything on a single timeline.','A detailed explanation of every event.'] },
        mss:{ name:'The Digital Manuscript Treasury', short:'The Manuscript Treasury', tag:'Samaritan manuscripts in the world’s libraries',
          points:['A catalogue of Torah and community manuscripts in libraries and collections worldwide','Details and a description of each manuscript','Viewing the manuscript pages'] },
        genealogy:{ name:'Samaritan Genealogy', short:'Genealogy', tag:'The full family tree of the community',
          points:['The full Samaritan family tree of the community’s families','Look up a person and follow their ancestors and descendants','Built on the community census and records of events','See the family ties across the generations'] },
      }
    },
    ar: {
      torah:'التوراة السامرية الإسرائيلية', hint:'أدِر القرص · اضغط على دائرة للدخول',
      copy:'© جميع الحقوق محفوظة لأوشير ساسوني', go:'دخول ›', goAll:'كل المستجدّات ›', newsTag:'أبرز المستجدّات الأخيرة', langs:'اللغة', ver:'الإصدار', newsShort:'ما الجديد', exit:'الخروج إلى القائمة الرئيسية', shots:'لقطات', title:'אבני שהם', goTorah:'دخول التوراة ›',
      torahHelp:{ tag:'أسفار التوراة الخمسة بالنص السامري',
        points:['أسفار التوراة الخمسة بالنص السامري، بالخط السامري وبالحروف العبرية','تفسير الآية من المصادر السامرية، وترجمات: آرامية وعربية وإنجليزية','مقارنة النسخ: الماسوري والسبعينية وأونقلوس وقمران','قاموس للكلمات، وقراءة مسموعة، وبحث متقدّم، وطباعة'] },
      apps:{
        dict:{ name:'القاموس الآرامي-العبري', tag:'الآرامية السامرية والعبرية',
          points:['قاموس آرامي-عبري، وعبري-آرامي.','مبني على قواميس متنوعة ومختلفة.','بحث بحسب الكلمة أو جذر الكلمة','معنى الكلمة ومواضع ورودها في القصائد السامرية وفي الترجمة الآرامية للتوراة وفي ميمر مرقة'] },
        shira:{ name:'كنز الأناشيد السامرية', short:'كنز الأناشيد', tag:'أرشيف تسجيلات الأناشيد والقصائد السامرية',
          points:['أكبر أرشيف للقصائد والتسجيلات التي أنشدها أبناء الطائفة عبر الأجيال.','بحث بحسب القصيدة والحدث والمؤدّي','البحث عن مؤدّين مختلفين للقصيدة نفسها','معادِل صوت متقدّم لتحسين جودة الاستماع','قوائم تشغيل شخصية','وضع الاستماع في السيارة'] },
        calendar:{ name:'التقويم السامري', tag:'التاريخ والأعياد ومقطع الأسبوع',
          points:['تقويم «حساب قشطة» — حساب الحق — التقويم السامري.','محرّك حسابي مستقل لآلاف السنين إلى الأمام وإلى الوراء.','بيان أعياد الطائفة والأعياد اليهودية والمناسبات العامة.','بيان المقاطع الأسبوعية وقواعد التقويم وطريقة الحساب'] },
        library:{ name:'المكتبة', short:'المكتبة', tag:'أوسع مكتبة رقمية لكنوز الحكمة السامرية.',
          points:['كتب المدراش والدراسة والتفسير والقضاء والشريعة من التراث السامري','إمكانية البحث والترجمة والقراءة المنتظمة.','معجم الأعلام','أرشيف القصائد السامرية مع النسخ الصوتي ومعاني الكلمات','البحث عن القوافي'] },
        timeline:{ name:'الخط الزمني التاريخي', tag:'تاريخ الطائفة بحسب العدّ السامري للسنين',
          points:['أحداث في البلاد والعالم، إلى جانب أحداث تاريخية متعلقة بالسامريين','العدّ السامري منذ دخول البلاد ومنذ الخليقة إلى جانب العدّ المعتاد','كل شيء على محور زمني واحد.','شرح مفصّل لكل حدث.'] },
        mss:{ name:'كنز المخطوطات الرقمي', short:'كنز المخطوطات', tag:'المخطوطات السامرية في مكتبات العالم',
          points:['فهرس لمخطوطات التوراة ومخطوطات الطائفة في المكتبات والمجموعات حول العالم','تفاصيل كل مخطوط ووصفه','تصفّح صفحات المخطوط'] },
        genealogy:{ name:'شجرة الأنساب السامرية', short:'شجرة الأنساب', tag:'شجرة الأنساب الكاملة لأبناء الطائفة',
          points:['شجرة الأنساب السامرية الكاملة لعائلات الطائفة','البحث عن شخص وتتبّع أجداده وأحفاده','مبنية على إحصاء الطائفة وسجلّات الأحداث','عرض الروابط العائلية عبر الأجيال'] },
      }
    }
  };
  const lang = () => (typeof LANG === 'string' && TX[LANG]) ? LANG : 'he';
  const T = () => TX[lang()];

  // ── the apps ────────────────────────────────────────────────────────────────
  const ICON = {
    shira:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/><path d="M9 9l12-2"/></svg>',
    calendar:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/></svg>',
    library:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>',
    timeline:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="8" y1="10" x2="8" y2="5"/><circle cx="8" cy="12" r="2"/><line x1="16" y1="14" x2="16" y2="19"/><circle cx="16" cy="12" r="2"/></svg>',
    mss:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></svg>',
    dict:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M4 18a2 2 0 0 1 2-2h12"/><line x1="8" y1="8" x2="14" y2="8"/><line x1="8" y1="12" x2="12" y2="12"/></svg>',
    genealogy:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.6"/><circle cx="5" cy="19" r="2.6"/><circle cx="19" cy="19" r="2.6"/><path d="M12 7.6V12M12 12H5v4.4M12 12h7v4.4"/></svg>',
  };
  // the order here is the order round the ring, clockwise from the top
  const APPS = [
    { key:'calendar',  open:() => openExternalUnit(CALENDAR_URL, t('m_calendar')) },
    { key:'library',   open:() => openLibrary() },
    { key:'dict',      open:() => { const m = $('dictModal'); if(m) m.dataset.direct = '1'; openDictApp(); } },
    { key:'shira',     open:() => openShira() },
    { key:'timeline',  open:() => openTimeline() },
    { key:'mss',       open:() => (typeof window.openMss === 'function') && window.openMss() },
    { key:'genealogy', open:() => openExternalUnit(GENEALOGY_URL, t('m_genealogy')) }
  ];
  const N = APPS.length, STEP = 360 / N;

  // ── build the ring: a circle for each app ──────────────────────────────────
  const dial = $('hubDial');
  const center = $('hubTorah');
  const sats = APPS.map((a, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hub-c hub-sat'; b.dataset.i = i;
    dial.appendChild(b);
    return b;
  });

  // ── the faint Samaritan page behind it all ─────────────────────────────────
  // Written across, in horizontal lines right to left, and filling the whole
  // screen — rebuilt to the screen's size when that changes.
  const pagesEl = $('hubPages');
  const ALPHA = 'ࠀࠁࠂࠃࠄࠅࠆࠇࠈࠉࠊࠋࠌࠍࠎࠏࠐࠑࠒࠓࠔࠕ'.split('');
  function buildPages(){
    const fs = Math.max(17, Math.min(28, innerWidth * 0.022));
    const lh = fs * 1.95;
    const rows = Math.ceil(innerHeight / lh) + 1;
    const perRow = Math.ceil(innerWidth / (fs * 0.5)) + 14;      // more than a line can hold
    pagesEl.style.setProperty('--pf', fs + 'px');
    let h = '';
    for(let r = 0; r < rows; r++){
      let t = '';
      for(let i = 0; i < perRow; i++){ t += ALPHA[(Math.random() * ALPHA.length) | 0]; if(Math.random() < .17) t += ' '; }
      h += '<div class="row">' + t + '</div>';
    }
    pagesEl.innerHTML = h;
  }
  buildPages();
  let _pgT = null, _pgW = innerWidth, _pgH = innerHeight;
  addEventListener('resize', () => {
    clearTimeout(_pgT);
    _pgT = setTimeout(() => {
      if(Math.abs(innerWidth - _pgW) < 40 && Math.abs(innerHeight - _pgH) < 120) return;   // a phone's bar sliding
      _pgW = innerWidth; _pgH = innerHeight; buildPages();
    }, 200);
  });

  // ── the language switch, at the right ──────────────────────────────────────
  const langBox = document.createElement('div');
  langBox.className = 'hub-lang'; langBox.setAttribute('role', 'group');
  const verEl = document.createElement('span'); verEl.className = 'hub-ver'; langBox.appendChild(verEl);
  [['he', 'עב', 'עברית'], ['en', 'EN', 'English'], ['ar', 'ع', 'العربية']].forEach(([code, label, name]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.lang = code; b.textContent = label; b.title = name; b.setAttribute('aria-label', name);
    b.addEventListener('click', () => pickLang(code));
    langBox.appendChild(b);
  });
  hub.appendChild(langBox);

  // ── the left side: the hamburger menu, and under it a gold star for what's new ──
  const side = document.createElement('div');
  side.className = 'hub-side';
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button'; menuBtn.className = 'hub-menu';
  menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  // the app's own drawer, with all of its entries; raised above the hub while the hub is up
  menuBtn.addEventListener('click', () => { if(typeof openMenu === 'function') openMenu(); });
  const starBtn = document.createElement('button');
  starBtn.type = 'button'; starBtn.className = 'hub-star';
  starBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 1.8 15.2 8.3 22.3 9.3 17.1 14.3 18.4 21.4 12 18 5.6 21.4 6.9 14.3 1.7 9.3 8.8 8.3"/></svg><span class="hub-star-cap"></span>';
  starBtn.addEventListener('click', () => openNews());
  side.appendChild(menuBtn); side.appendChild(starBtn);
  hub.appendChild(side);

  // what's new: the newest version and the two before it, scrolling, and no further back
  function openNews(){
    if(hub.querySelector('.hub-news')) return;
    const L = (typeof I18N !== 'undefined' && (I18N[lang()] || I18N.he)) || {};
    const pages = (L.whatsnew_pages || []).slice(0, 5);       // the app's own pages, newest first — never more than five versions back
    const o = document.createElement('div'); o.className = 'hub-news';
    o.innerHTML = '<div class="hub-news-box" role="dialog" aria-modal="true"><div class="hub-news-head"><h2></h2>' +
                  '<button type="button" class="hub-news-x">&times;</button></div><div class="hub-news-body"></div></div>';
    o.querySelector('h2').textContent = '★ ' + t('m_whatsnew');
    const body = o.querySelector('.hub-news-body');
    pages.forEach(html => { const d = document.createElement('div'); d.className = 'hub-news-page'; d.innerHTML = html; body.appendChild(d); });
    const x = o.querySelector('.hub-news-x'); x.setAttribute('aria-label', t('close'));
    const close = () => { o.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if(e.key === 'Escape') close(); };
    x.onclick = close;
    o.addEventListener('click', e => { if(e.target === o) close(); });
    document.addEventListener('keydown', esc);
    hub.appendChild(o); x.focus();
  }

  // a small question in the hub's own colours — the app's askConfirm lives at a
  // lower layer and would open underneath the hub
  function ask(title, msg, yes, no){
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'hub-confirm';
      o.innerHTML = '<div class="hub-confirm-box" role="dialog" aria-modal="true"><h3></h3><p></p>' +
                    '<button type="button" class="hub-yes"></button><button type="button" class="hub-no"></button></div>';
      o.querySelector('h3').textContent = title; o.querySelector('p').textContent = msg;
      const y = o.querySelector('.hub-yes'), n = o.querySelector('.hub-no');
      y.textContent = yes; n.textContent = no;
      const done = v => { o.remove(); res(v); };
      y.onclick = () => done(true); n.onclick = () => done(false);
      hub.appendChild(o); y.focus();
    });
  }
  // the choice is the app's own LANG: it goes on into every screen. Whether it is
  // kept for next time is asked, as it is from the hamburger menu.
  async function pickLang(code){
    if(code === lang() || typeof setLang !== 'function') return;
    setLang(code);
    paintHub();
    const keep = await ask(t('m_lang'), t('lang_save_q') + ' ' + t('lang_save_note'), t('save_yes'), t('save_no'));
    try{ if(keep) localStorage.setItem('uiLang', code); else localStorage.removeItem('uiLang'); }catch(e){}
  }

  // ── painting the words ─────────────────────────────────────────────────────
  const ORD = {
    he:['הראשון','השני','השלישי','הרביעי','החמישי','הששי','השביעי','השמיני','התשיעי','העשירי','האחד עשר','השנים עשר'],
    en:['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'],
    ar:['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر']
  };
  const GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ל':30};
  const gem = s => String(s || '').split('').reduce((n, c) => n + (GEM[c] || 0), 0);
  // the Torah header's own line, word for word; in another language the day,
  // month and year are put into that language, and the Hebrew original stays
  // beneath it — the day's feast names have no translation to be trusted
  function paintHubDate(){
    const main = $('hubDateMain'), he = $('hubDateHe'); if(!main || !he) return;
    const run = $('samDateRun');
    const orig = (run && run.textContent) || '';
    const L = lang();
    let d = null; try{ d = CAL && CAL.today; }catch(e){}
    if(L === 'he' || !d){ main.textContent = orig; he.textContent = ''; return; }
    const n = gem(d.d), mi = ORD.he.indexOf(d.m);
    const mon = mi >= 0 ? ORD[L][mi] : d.m;
    main.textContent = L === 'en'
      ? 'Day ' + n + ' of the ' + mon + ' month' + (d.y ? ' · Year ' + d.y + ' since entering Canaan' : '')
      : 'اليوم ' + n + ' من الشهر ' + mon + (d.y ? ' · سنة ' + d.y + ' لدخول كنعان' : '');
    he.textContent = orig;
  }
  function paintHub(){
    const L = lang(), X = T();
    hub.dir = L === 'en' ? 'ltr' : 'rtl';
    hub.setAttribute('lang', L);
    const ttl = hub.querySelector('.hub-title'); if(ttl) ttl.textContent = X.title;
    center.querySelector('.hub-name').textContent = X.torah;
    center.setAttribute('aria-label', X.torah);
    sats.forEach((b, i) => {
      const a = APPS[i], x = X.apps[a.key];
      b.innerHTML = ICON[a.key] + '<span class="hub-name"></span>';
      b.querySelector('.hub-name').textContent = x.short || x.name;   // the circle is small; the pop-up carries the full name
      b.setAttribute('aria-label', x.name);
    });
    $('hubHint').textContent = X.hint;
    $('hubCopy').textContent = X.copy;
    langBox.setAttribute('aria-label', X.langs);
    verEl.textContent = X.ver + ' ' + (window.APP_VERSION || '');
    const el = exitItem.querySelector('.mi-label'); if(el) el.textContent = X.exit;
    torahX.title = X.exit; torahX.setAttribute('aria-label', X.exit);
    menuBtn.setAttribute('aria-label', t('menu')); menuBtn.title = t('menu');
    starBtn.setAttribute('aria-label', t('m_whatsnew')); starBtn.title = t('m_whatsnew');
    starBtn.querySelector('.hub-star-cap').textContent = X.newsShort;
    langBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.lang === L));
    paintHubDate();
    if(topIdx >= 0) fill(topIdx);
  }

  // ── the turning ────────────────────────────────────────────────────────────
  // The dial has one stop for each app and, after the last of them, one more: the
  // Torah itself. `u` is the position in stops (counted on without wrapping, and
  // fractional while a finger is on it).
  //
  // Through the apps the ring turns a step per stop. After the last app it holds still
  // while the Torah's circle swells out from the middle until it fills the whole dial —
  // that is the stop at which the Torah's pop-up is shown — and on the next turn the
  // Torah shrinks back to its place as the ring carries on from the first app.
  const STOPS = N + 1;
  let u = 0;
  let introDeg = 0;                                  // extra turn of the ring during the way in
  let topIdx = -1;                                   // 0…N-1 an app; N the Torah
  const lap = x => ((x % STOPS) + STOPS) % STOPS;
  function ringSteps(x){
    const c = lap(x), base = Math.floor(x / STOPS) * N;
    if(c <= N - 1) return base + c;
    if(c <= N)     return base + N - 1;
    return base + N - 1 + (c - N);
  }
  function swell(x){                                 // 0 = the Torah in its place, 1 = filling the dial
    const c = lap(x);
    if(c <= N - 1) return 0;
    if(c <= N)     return c - (N - 1);
    return 1 - (c - N);
  }
  function paint(x){
    const ring = -ringSteps(x) * STEP + introDeg;
    sats.forEach((b, i) => b.style.setProperty('--a', (i * STEP + ring).toFixed(2) + 'deg'));
    dial.style.setProperty('--e', swell(x).toFixed(3));
  }
  function setTop(i){
    if(i === topIdx) return;
    topIdx = i;
    sats.forEach((b, k) => b.classList.toggle('top', k === i));
    center.classList.toggle('forward', i === N);
    showPop(i);
  }
  function turnTo(x){ u = x; paint(u); setTop(lap(Math.round(u))); }
  function snap(){ turnTo(Math.round(u)); }
  function step(dir){ turnTo(Math.round(u) + dir); }

  // ── the pop-up ─────────────────────────────────────────────────────────────
  const pop = $('hubPop');
  let popTimer = null;
  function fill(i){
    const isTorah = i === N, X = T();
    const a = isTorah ? null : APPS[i];
    const x = isTorah ? { name:X.torah, tag:X.torahHelp.tag, points:X.torahHelp.points } : X.apps[a.key];
    pop.innerHTML = '<div class="hub-pop-row"><div class="hub-pop-txt"><h2></h2><p class="hub-tag"></p><ul></ul><div class="hub-actions"><button type="button" class="hub-go"></button></div></div></div>';
    pop.querySelector('h2').textContent = x.name;
    pop.querySelector('.hub-tag').textContent = x.tag;
    const ul = pop.querySelector('ul');
    x.points.forEach(p => { const li = document.createElement('li'); li.textContent = p; ul.appendChild(li); });
    const go = pop.querySelector('.hub-go');
    go.textContent = isTorah ? X.goTorah : X.go;
    go.onclick = () => isTorah ? enterTorah() : enter(a.key);
    // beside "enter": a button for the app's screenshots — nothing of them shows until it is pressed.
    // It follows "enter" in reading order, so it stands to its left in Hebrew and to its right in English.
    const shotKey = isTorah ? 'torah' : a.key;
    if(SHOTS[shotKey]){
      const sb = document.createElement('button');
      sb.type = 'button'; sb.className = 'hub-shotbtn'; sb.setAttribute('aria-label', X.shots + ' — ' + x.name);
      sb.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 15l-5-5-8 8"/></svg><span></span>';
      sb.querySelector('span').textContent = X.shots;
      sb.onclick = () => openShots(shotKey, sb, x.name);
      pop.querySelector('.hub-actions').appendChild(sb);
    }
  }
  function showPop(i){
    clearTimeout(popTimer);
    if(!pop.innerHTML){ fill(i); return; }
    pop.classList.add('swap');
    popTimer = setTimeout(() => { fill(i); pop.classList.remove('swap'); }, 170);
  }

  // ── dragging it like a dial ────────────────────────────────────────────────
  let drag = null, justDragged = false;
  function angleOf(e){
    const r = dial.getBoundingClientRect();
    return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
  }
  const shortest = d => ((d + 540) % 360) - 180;
  dial.addEventListener('pointerdown', e => {
    if(e.button !== undefined && e.button > 0) return;
    drag = { id:e.pointerId, last:angleOf(e), acc:0, u0:u, x:e.clientX, y:e.clientY, moved:false };
  });
  dial.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    if(!drag.moved){
      if(Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
      drag.moved = true; dial.classList.add('dragging');
      try{ dial.setPointerCapture(e.pointerId); }catch(_){}
      drag.last = angleOf(e); drag.u0 = u; drag.acc = 0;    // start the turn from where it is now
    }
    const a = angleOf(e);
    drag.acc += shortest(a - drag.last); drag.last = a;      // add up small steps, so it can go on round
    turnTo(drag.u0 - drag.acc / STEP);
  });
  function endDrag(e){
    if(!drag || (e && e.pointerId !== drag.id)) return;
    const moved = drag.moved;
    drag = null; dial.classList.remove('dragging');
    if(moved){ justDragged = true; setTimeout(() => { justDragged = false; }, 60); snap(); }
  }
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  // a drag must not also count as a tap on the circle it ended over
  dial.addEventListener('click', e => { if(justDragged){ e.stopPropagation(); e.preventDefault(); } }, true);
  dial.addEventListener('wheel', e => {
    if(Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return;
    e.preventDefault();
    if(dial._wheelBusy) return;
    dial._wheelBusy = true; setTimeout(() => { dial._wheelBusy = false; }, 280);
    step((e.deltaY || e.deltaX) > 0 ? -1 : 1);
  }, { passive:false });
  document.addEventListener('keydown', e => {
    if(!isOpen() || hub.querySelector('.hub-confirm')) return;
    if(e.key === 'ArrowLeft'){ step(-1); e.preventDefault(); }
    else if(e.key === 'ArrowRight'){ step(1); e.preventDefault(); }
  });

  // ── screenshots ────────────────────────────────────────────────────────────
  // How many pictures each app has, in /static/img/hub/<app>-<n>.jpg
  const SHOTS = { calendar:2, library:3, dict:2, shira:2, timeline:2, mss:2, genealogy:1, torah:3 };
  const shotSrc = (k, n) => '/static/img/hub/' + k + '-' + n + '.jpg';
  // The window opens out of the little picture it was opened from, and closes back into it.
  function openShots(key, from, title){
    if(hub.querySelector('.hub-shots')) return;
    const n = SHOTS[key] || 0; if(!n) return;
    const o = document.createElement('div'); o.className = 'hub-shots';
    o.innerHTML = '<div class="hub-shots-box" role="dialog" aria-modal="true"><div class="hub-shots-head"><h2></h2>' +
                  '<button type="button" class="hub-news-x">&times;</button></div>' +
                  '<div class="hub-shots-strip" tabindex="0"></div><div class="hub-shots-dots"></div></div>';
    o.querySelector('h2').textContent = title;
    const strip = o.querySelector('.hub-shots-strip'), dots = o.querySelector('.hub-shots-dots');
    for(let i = 1; i <= n; i++){
      const im = document.createElement('img'); im.src = shotSrc(key, i); im.alt = title + ' ' + i; im.decoding = 'async';
      strip.appendChild(im);
      const d = document.createElement('i'); if(i === 1) d.className = 'on'; dots.appendChild(d);
    }
    if(n < 2) dots.style.display = 'none';
    const box = o.querySelector('.hub-shots-box');
    hub.appendChild(o);
    try{
      const fr = from.getBoundingClientRect(), br = box.getBoundingClientRect();
      box.style.transformOrigin = (fr.left + fr.width / 2 - br.left).toFixed(0) + 'px ' + (fr.top + fr.height / 2 - br.top).toFixed(0) + 'px';
    }catch(e){}
    let closing = false;
    const close = () => {
      if(closing) return; closing = true;
      document.removeEventListener('keydown', esc);
      o.classList.add('closing');
      setTimeout(() => o.remove(), 260);
    };
    const esc = e => { if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    o.querySelector('.hub-news-x').onclick = close;
    o.addEventListener('click', e => { if(e.target === o) close(); });
    // which picture is in the middle: the dots follow it
    strip.addEventListener('scroll', () => {
      const mid = strip.getBoundingClientRect().left + strip.clientWidth / 2;
      let best = 0, bd = 1e9;
      [...strip.children].forEach((im, i) => { const r = im.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if(d < bd){ bd = d; best = i; } });
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === best));
    }, { passive:true });
    strip.focus({ preventScroll:true });
  }

  // ── the way in ─────────────────────────────────────────────────────────────
  // Nothing sits between the entry animation and this page any more. As the splash
  // fades, all the small circles come out of the Torah at the middle, at once, to their
  // places round it, while the dial itself turns half a round as if by its own hand —
  // about a second and a half in all. Then it is the reader's.
  // (Played whatever the system's motion setting says: it is short, it happens once, and it was asked for.)
  const splashEl = document.getElementById('samaritan-splash');
  if(splashEl && isOpen()){
    hub.classList.add('hub-intro'); dial.classList.add('intro');
    dial.style.setProperty('--k', '0'); introDeg = -180; paint(u);        // waiting: all in the middle
    let started = false;
    const easeOut = p => 1 - Math.pow(1 - p, 3);
    const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const startIntro = () => {
      if(started) return; started = true;
      const DUR = 1600, t0 = performance.now();
      (function frame(now){
        const p = Math.min(1, (now - t0) / DUR);
        dial.style.setProperty('--k', easeOut(Math.min(1, p / .7)).toFixed(3));   // out from the middle
        introDeg = -(1 - easeInOut(p)) * 180;                                     // half a turn, then still
        paint(u);
        if(p < 1){ requestAnimationFrame(frame); return; }
        introDeg = 0; dial.style.removeProperty('--k'); paint(u);
        dial.classList.remove('intro'); hub.classList.remove('hub-intro');
      })(t0);
    };
    new MutationObserver(() => { if(splashEl.classList.contains('is-done')) startIntro(); })
      .observe(splashEl, { attributes:true, attributeFilter:['class'] });
    addEventListener('samaritanSplashComplete', startIntro);
    setTimeout(startIntro, 20000);                      // never leave the circles in the middle
  }

  // ── a glint of sun on the Torah's dome ─────────────────────────────────────
  // Not a fixed light: it flashes at a different point each time, and only now and
  // then — the first after about half a minute, then every two to five minutes.
  function glint(){
    if(!isOpen()) return;
    const ang = Math.random() * Math.PI * 2, rad = .15 + .6 * Math.sqrt(Math.random());
    center.style.setProperty('--gx', (50 + rad * 50 * Math.cos(ang)).toFixed(1) + '%');
    center.style.setProperty('--gy', (50 + rad * 50 * Math.sin(ang)).toFixed(1) + '%');
    center.classList.remove('glint'); void center.offsetWidth; center.classList.add('glint');
    setTimeout(() => center.classList.remove('glint'), 1600);
  }
  (function scheduleGlint(first){
    setTimeout(() => { glint(); scheduleGlint(false); },
               first ? 25000 + Math.random() * 20000 : 120000 + Math.random() * 180000);
  })(true);

  // ── entering an app ────────────────────────────────────────────────────────
  // the Torah's own hamburger and a circle here lead to the same units; what
  // differs is where they were reached from, and so whether "↩ התורה" is offered.
  function setOrigin(o){ document.body.classList.toggle('from-hub', o === 'hub'); }
  function isOpen(){ return !hub.classList.contains('hidden'); }
  function hideUnits(){
    const dm = $('dictModal'); if(dm) delete dm.dataset.direct;
    document.querySelectorAll('.rd-totorah').forEach(b => {
      const m = b.closest('.modal'); if(m) m.classList.add('hidden');
    });
    ['extFrameWrap', 'mssFrameWrap'].forEach(id => { const w = $(id); if(w) w.style.display = 'none'; });
    document.body.style.overflow = '';
    if(typeof closeMenu === 'function') closeMenu();
  }
  function showHub(){
    hideUnits();
    paintHub();                       // the language may have been changed elsewhere meanwhile
    hub.classList.remove('hidden');
    document.body.classList.add('hub-open');
    hub.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setOrigin('menu');
  }
  function hideHub(){ hub.classList.add('hidden'); document.body.classList.remove('hub-open'); document.body.style.overflow = ''; }
  function enter(key){
    const a = APPS.find(x => x.key === key); if(!a) return;
    hideUnits();
    setOrigin('hub');
    hideHub();
    a.open();
  }
  function enterTorah(){ setOrigin('menu'); hideHub(); }
  center.addEventListener('click', enterTorah);
  sats.forEach((b, i) => b.addEventListener('click', () => enter(APPS[i].key)));

  // the Torah's hamburger: units reached from there keep their way back to the Torah
  // From the Torah's own menu the unit keeps its way back to the Torah. From the hub's
  // menu: a unit is entered from the hub (no such link); a dialog (language, help,
  // version, contact, install, accessibility, admin) opens over the hub and the
  // reader stays on it (the tour begins on this very page); the bookmarks are about the Torah, so go there.
  const STAY = ['install', 'a11y', 'lang', 'whatsnew', 'help', 'version', 'contact', 'adminlogin', 'tour'];
  const TORAH = ['bookmarks', 'testimonials'];
  document.querySelectorAll('.menu-item').forEach(b =>
    b.addEventListener('click', () => {
      if(!isOpen()){ setOrigin('menu'); return; }
      const act = b.dataset.act;
      if(STAY.includes(act)) return;
      if(TORAH.includes(act)){ setOrigin('menu'); hideHub(); return; }
      setOrigin('hub'); hideHub();
    }, true));

  // ── every unit's own bar ───────────────────────────────────────────────────
  // X → the main menu. Added to the bars that carry the "↩ התורה" link; the two
  // framed units already have an X of their own, which is re-pointed.
  document.querySelectorAll('.rd-totorah').forEach(link => {
    const bar = link.parentElement; if(!bar) return;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'hub-x'; x.innerHTML = '&times;';
    x.title = 'חזרה לתפריט הראשי'; x.setAttribute('aria-label', 'חזרה לתפריט הראשי');
    x.addEventListener('click', showHub);
    bar.insertBefore(x, bar.firstChild);
  });
  // the "סגור" at the foot of a reader or the dictionary: a unit entered from here closes back to here
  document.querySelectorAll('.rd-totorah').forEach(link => {
    const m = link.closest('.modal'); if(!m) return;
    m.querySelectorAll('.popup-close').forEach(c =>
      c.addEventListener('click', () => { if(document.body.classList.contains('from-hub')) showHub(); }));
  });
  [['extFrameClose', 'extFrameWrap'], ['mssFrameClose', 'mssFrameWrap']].forEach(([xid, wid]) => {
    const x = $(xid); if(!x) return;
    x.title = 'חזרה לתפריט הראשי'; x.setAttribute('aria-label', 'חזרה לתפריט הראשי');
    x.classList.add('hub-x');
    x.addEventListener('click', showHub);              // after the old handler has hidden the frame
    const link = document.createElement('button');
    link.type = 'button'; link.className = 'unit-totorah'; link.textContent = '↩ התורה';
    link.title = 'חזרה לתורה';
    link.addEventListener('click', () => {
      const w = $(wid); if(w) w.style.display = 'none';
      document.body.style.overflow = '';
    });
    x.after(link);
  });

  // ── the Torah itself: a close in its header, and a way out in its hamburger ─────
  // Both lead to this page. The hamburger entry is the first line of the drawer, in
  // the same make as the others; it is not shown while this page is itself up.
  const torahX = document.createElement('button');
  torahX.type = 'button'; torahX.className = 'torah-x'; torahX.innerHTML = '&times;';
  torahX.addEventListener('click', showHub);
  const titleRow = document.querySelector('#hdr .title-row');
  if(titleRow) titleRow.appendChild(torahX);
  const drawer = $('menuDrawer');
  const exitItem = document.createElement('button');
  exitItem.type = 'button'; exitItem.className = 'menu-item'; exitItem.dataset.act = 'hub';
  exitItem.innerHTML = '<svg class="mi-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="1.6"/><circle cx="12" cy="20" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="20" cy="12" r="1.6"/></svg><span class="mi-label"></span>';
  exitItem.addEventListener('click', () => { if(typeof closeMenu === 'function') closeMenu(); showHub(); });
  if(drawer){ const head = drawer.querySelector('.menu-head'); head ? head.after(exitItem) : drawer.prepend(exitItem); }

  // ── the date follows the Torah's own line ──────────────────────────────────
  if(typeof paintSamDate === 'function'){
    const orig = paintSamDate;
    paintSamDate = function(){ const r = orig.apply(this, arguments); paintHubDate(); return r; };
  }

  // ── staying out of the hub's way ───────────────────────────────────────────
  // a unit opened by some other road (the recording that went on playing and is
  // brought back to the front) must not appear under the hub
  ['openTimeline', 'openShira', 'openLibrary', 'openExternalUnit'].forEach(n => {
    const orig = window[n]; if(typeof orig !== 'function') return;
    window[n] = function(){ if(isOpen()) hideHub(); return orig.apply(this, arguments); };
  });
  // Back, while the hub is up, is a press at the front page: nothing underneath
  // should step back behind it.
  addEventListener('popstate', e => { if(isOpen()) e.stopImmediatePropagation(); }, true);
  // the welcome/what's-new cards wait for the reader to reach the Torah itself
  if(typeof runOnboarding === 'function'){
    const orig = runOnboarding;
    runOnboarding = function(){
      const go = () => orig.apply(this, arguments);
      const touring = () => typeof TOUR !== 'undefined' && TOUR.running;      // not over the guided tour
      const reached = () => !isOpen() && !document.body.classList.contains('from-hub') && !touring();
      if(reached()) return go();
      const iv = setInterval(() => { if(reached()){ clearInterval(iv); go(); } }, 400);
    };
  }

  if(typeof setLang === 'function'){
    const orig = setLang;
    setLang = function(){ const r = orig.apply(this, arguments); paintHub(); return r; };
  }

  // ── the guided tour and the help page learn about this page ─────────────────
  // Steps go in after the welcome, narration to match (the tour wants the same count).
  const HUBTXT = {
    he: {
      tour:[
        'זהו התפריט הראשי — הדף שנפתח בכניסה לאפליקציה. התורה בעיגול הגדול שבאמצע, ומסביבה שאר האפליקציות: לוח השנה, הספרייה, המילון הארמי-עברי, אוצר השירה, ציר הזמן, אוצר כתבי היד ואילן היוחסין.',
        'מסובבים את החוגה בגרירה, בגלגל העכבר או בחצים. העיגול שבראש החוגה מציג בכרטיס שבצדו מה האפליקציה נותנת, ולחיצה על עיגול נכנסת אליה.',
        'בכל כרטיס יש כפתור "צ. מסך", משמאל לכפתור הכניסה. לחיצה עליו פותחת חלון עם צילומי מסך של האפליקציה שאפשר לגלול ביניהם.',
        'אחרי העיגול האחרון מתרחב עיגול התורה על פני כל החוגה ומציג את ההסבר על התורה. הסיבוב הבא מחזיר אותו למקומו, ולחיצה עליו נכנסת לתורה.',
        'בצד שמאל: תפריט ההמבורגר עם כל האפשרויות, ומתחתיו כוכב מהבהב — מה חדש, חמש הגרסאות האחרונות.',
        'בצד ימין: בחירת שפה — עברית, אנגלית או ערבית — שממשיכה לכל מסכי האפליקציה, ושואלת אם לשמור אותה. לידה מוצגת גרסת האפליקציה.',
        'מכל אפליקציה חוזרים לתפריט הראשי בלחיצה על X, וגם דרך "יציאה לתפריט הראשי" בתפריט ההמבורגר. הקישור "התורה" מוצג רק למי שנכנס מתפריט ההמבורגר של התורה.'
      ],
      help:['התפריט הראשי', [
        'בכניסה לאפליקציה, אחרי מסך הפתיחה, נפתח <b>התפריט הראשי</b> — העיגולים יוצאים מהמרכז אל מקומם והחוגה מסתובבת חצי סיבוב: <b>התורה</b> בעיגול הגדול שבאמצע, ומסביבה <b>חוגה מסתובבת</b> של האפליקציות — לוח השנה, הספרייה, המילון הארמי-עברי, אוצר השירה, ציר הזמן, אוצר כתבי היד ואילן היוחסין.',
        '<b>סיבוב החוגה</b> — בגרירה, בגלגל העכבר או בחצים. העיגול שבראש החוגה מציג <b>כרטיס</b> בצד: מה האפליקציה נותנת, וכפתור כניסה. לחיצה על העיגול עצמו נכנסת אליה.',
        '<b>צ. מסך</b> — בכל כרטיס יש כפתור כזה, משמאל לכפתור הכניסה. לחיצה עליו פותחת חלון עם צילומי מסך של האפליקציה שאפשר לגלול ביניהם; עד שלוחצים — אין צילומי מסך על המסך.',
        '<b>עיגול התורה</b> — אחרי העיגול האחרון הוא מתרחב על פני כל החוגה ומציג את ההסבר על התורה; הסיבוב הבא מחזיר אותו למקומו. לחיצה עליו נכנסת לתורה.',
        '<b>כוכב "מה חדש"</b> (משמאל, מהבהב) פותח את חמש הגרסאות האחרונות, עם גלילה. מעליו <b>תפריט ההמבורגר</b> עם כל האפשרויות. מימין — <b>בחירת שפה</b> (עברית · English · العربية), שממשיכה לכל מסכי האפליקציה ושואלת אם לשמור, וגרסת האפליקציה.',
        '<b>חזרה לתפריט הראשי</b> — X בכל אפליקציה ובכותרת התורה, ו"יציאה לתפריט הראשי" בתפריט ההמבורגר. הקישור "↩ התורה" מוצג רק למי שנכנס מתפריט ההמבורגר של התורה.'
      ]]
    },
    en: {
      tour:[
        'This is the main menu — the page that opens when you enter the app. The Torah is in the big circle in the middle, and around it the other apps: the calendar, the library, the Aramaic–Hebrew dictionary, the song treasury, the timeline, the manuscript treasury and the genealogy.',
        'Turn the dial by dragging, with the mouse wheel or with the arrow keys. The circle at the top of the dial shows, in the card beside it, what that app offers, and tapping a circle takes you in.',
        'Every card has a “Screenshots” button, beside the Enter button. Tap it to open a window of screenshots of the app that you can scroll through.',
        'After the last circle the Torah’s circle swells across the whole dial and shows what the Torah offers. The next turn puts it back in its place, and tapping it enters the Torah.',
        'On the left: the hamburger menu with all its options, and under it a blinking star — what’s new, the last five versions.',
        'On the right: the language switch — Hebrew, English or Arabic — which carries on through every screen of the app and asks whether to keep it. Beside it, the version of the app.',
        'From any app you return to the main menu with the X, or through “Exit to the main menu” in the hamburger menu. The “Torah” link is shown only to someone who came in from the Torah’s own hamburger menu.'
      ],
      help:['The main menu', [
        'On entering the app, after the opening screen, the <b>main menu</b> opens — the circles come out of the middle into place and the dial turns half a round: the <b>Torah</b> in the big circle in the middle, and round it a <b>turning dial</b> of the apps — the calendar, the library, the Aramaic–Hebrew dictionary, the song treasury, the timeline, the manuscript treasury and the genealogy.',
        '<b>Turning the dial</b> — by dragging, with the mouse wheel or with the arrow keys. The circle at the top shows a <b>card</b> at its side: what the app offers, and an enter button. Tapping the circle itself takes you in.',
        '<b>Screenshots</b> — each card has this button, beside the Enter button. Tap it to open a window of screenshots of the app that you can scroll through; until it is pressed, no screenshots are shown.',
        '<b>The Torah’s circle</b> — after the last circle it swells across the whole dial and shows what the Torah offers; the next turn puts it back. Tapping it enters the Torah.',
        '<b>The “What’s new” star</b> (left, blinking) opens the last five versions, scrolling. Above it, the <b>hamburger menu</b> with all its options. On the right, the <b>language switch</b> (עברית · English · العربية), which carries through every screen and asks whether to keep it, and the version of the app.',
        '<b>Back to the main menu</b> — an X in every app and in the Torah’s header, and “Exit to the main menu” in the hamburger menu. The “↩ Torah” link appears only for someone who came in from the Torah’s own hamburger menu.'
      ]]
    },
    ar: {
      tour:[
        'هذه هي القائمة الرئيسية — الصفحة التي تُفتح عند الدخول إلى التطبيق. التوراة في الدائرة الكبيرة في الوسط، وحولها بقية التطبيقات: التقويم، والمكتبة، والقاموس الآرامي-العبري، وكنز الأناشيد، والخط الزمني، وكنز المخطوطات، وشجرة الأنساب.',
        'أدِر القرص بالسحب أو بعجلة الفأرة أو بالأسهم. الدائرة التي في أعلى القرص تعرض في بطاقة بجانبها ما يقدّمه التطبيق، والضغط على دائرة يدخل إليه.',
        'في كل بطاقة زرّ «لقطات» بجانب زرّ الدخول. اضغط عليه لتفتح نافذة بلقطات شاشة للتطبيق يمكن تصفّحها.',
        'بعد الدائرة الأخيرة تتّسع دائرة التوراة على القرص كلّه وتعرض ما تقدّمه التوراة. الدورة التالية تعيدها إلى مكانها، والضغط عليها يدخل إلى التوراة.',
        'على اليسار: قائمة الهامبرغر بكل خياراتها، وتحتها نجمة وامضة — ما الجديد، آخر خمسة إصدارات.',
        'على اليمين: اختيار اللغة — العبرية أو الإنجليزية أو العربية — وهو يستمر في كل شاشات التطبيق ويسأل إن كنت تريد حفظه. وبجانبه إصدار التطبيق.',
        'من أي تطبيق تعود إلى القائمة الرئيسية بالضغط على X، أو عبر «الخروج إلى القائمة الرئيسية» في قائمة الهامبرغر. ورابط «التوراة» لا يظهر إلا لمن دخل من قائمة الهامبرغر الخاصة بالتوراة.'
      ],
      help:['القائمة الرئيسية', [
        'عند الدخول إلى التطبيق، بعد شاشة البداية، تُفتح <b>القائمة الرئيسية</b> — تخرج الدوائر من المركز إلى أماكنها ويدور القرص نصف دورة: <b>التوراة</b> في الدائرة الكبيرة في الوسط، وحولها <b>قرص يدور</b> من التطبيقات — التقويم، والمكتبة، والقاموس الآرامي-العبري، وكنز الأناشيد، والخط الزمني، وكنز المخطوطات، وشجرة الأنساب.',
        '<b>إدارة القرص</b> — بالسحب أو بعجلة الفأرة أو بالأسهم. الدائرة التي في أعلى القرص تعرض <b>بطاقة</b> على جانبها: ما يقدّمه التطبيق وزرّ للدخول. والضغط على الدائرة نفسها يدخل إليه.',
        '<b>لقطات</b> — في كل بطاقة هذا الزرّ بجانب زرّ الدخول. اضغط عليه لتفتح نافذة بلقطات شاشة للتطبيق يمكن تصفّحها؛ وما لم تضغط عليه لا تظهر أي لقطة.',
        '<b>دائرة التوراة</b> — بعد الدائرة الأخيرة تتّسع على القرص كلّه وتعرض ما تقدّمه التوراة؛ والدورة التالية تعيدها إلى مكانها. والضغط عليها يدخل إلى التوراة.',
        '<b>نجمة «ما الجديد»</b> (يسارًا، وامضة) تفتح آخر خمسة إصدارات مع التمرير. وفوقها <b>قائمة الهامبرغر</b> بكل خياراتها. وعلى اليمين <b>اختيار اللغة</b> (עברית · English · العربية) الذي يستمر في كل الشاشات ويسأل إن كنت تريد حفظه، وإصدار التطبيق.',
        '<b>العودة إلى القائمة الرئيسية</b> — X في كل تطبيق وفي رأس التوراة، و«الخروج إلى القائمة الرئيسية» في قائمة الهامبرغر. ورابط «↩ التوراة» لا يظهر إلا لمن دخل من قائمة الهامبرغر الخاصة بالتوراة.'
      ]]
    }
  };
  if(typeof TOUR_STEPS !== 'undefined' && typeof I18N !== 'undefined'){
    const showAt = async x => { showHub(); await tourWait(450); turnTo(x); await tourWait(850); };
    TOUR_STEPS.splice(1, 0,
      { pre:() => showAt(0), el:() => $('hubDial') },
      { pre:() => showAt(2), el:() => $('hubPop') },
      { pre:() => showAt(0), el:() => hub.querySelector('.hub-shotbtn') || $('hubPop') },
      { pre:() => showAt(N), el:() => $('hubTorah') },
      { pre:() => showAt(0), el:() => hub.querySelector('.hub-side') },
      { pre:() => showAt(0), el:() => hub.querySelector('.hub-lang') },
      { pre:async () => { hideHub(); if(typeof showBooks === 'function') showBooks(); await tourWait(500); }, el:() => document.querySelector('#hdr .torah-x') }
    );
    ['he', 'en', 'ar'].forEach(l => { if(I18N[l] && I18N[l].tour) I18N[l].tour.splice(1, 0, ...HUBTXT[l].tour); });
  }
  if(typeof HELP !== 'undefined') ['he', 'en', 'ar'].forEach(l => { if(HELP[l]) HELP[l].unshift(HUBTXT[l].help); });

  window.AvneiHub = { show:showHub, hide:hideHub, enter, apps:APPS, turnTo, step, glint, pickLang, get top(){ return topIdx; }, get pos(){ return u; } };
  turnTo(0); paintHub();
  document.body.classList.toggle('hub-open', !hub.classList.contains('hidden'));
  document.body.style.overflow = hub.classList.contains('hidden') ? '' : 'hidden';
})();
