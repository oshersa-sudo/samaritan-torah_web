/* שכבות המפה: "סיפורי מטיילים" ו"הר שופע מעיינות".
   - סיפורי מטיילים: כל מקום שמטייל מתאר בסיפורו מסומן על המפה; הסיפור עצמו נפתח במסך מלא (קורא הסיפורים),
     ולחיצה על מקום שבסיפור מצמידה את הקורא לצד ומעבירה את המפה אל המקום. הטקסטים המלאים (travel_stories.js)
     נטענים רק כשפותחים את השכבה או את הקורא.
   - הר שופע מעיינות: כל המעיינות שסביב ההר על מפת ההתמצאות, וסיור ביניהם (טיול בתמונות 'springs' שב-springs.js).
   נשען על window.GerizimTourAPI שמגדיר tour.js. */
(function () {
  const A = window.GerizimTourAPI; if (!A) return;
  const { map, state, byId, esc } = A;
  const $ = id => document.getElementById(id);
  let lang = A.lang();
  const TX = {
    he: { layers: 'שכבות', lyTitle: 'שכבות על המפה', lyTravel: 'סיפורי מטיילים', lyTravelTip: 'המקומות שמטיילים נוצרים, מארק טוויין ואחרים, תיארו בסיפור ביקורם בהר — כל אחד במקומו על המפה',
      lySprings: 'הר שופע מעיינות', lySpringsTip: 'כל המעיינות שסביב הר גריזים, וסיור ממעיין למעיין עם תמונות', stOpen: '📖 פתיחת הסיפורים', sprTour: '▶ סיור בין המעיינות',
      stFindPh: 'חיפוש מספר, שנה או מילה בתוך הסיפורים', stFindN: 'מספרים', stFindT: 'בתוך הסיפורים', stFindCount: '{n} מופעים ב-{m} סיפורים', stFindNone: 'לא נמצא דבר', stFindBtn: 'חיפוש בסיפורים', stAbout: '👤 על המספר', scState: 'מצב האזור בעיני המספר', scShow: 'הצג תיאור חזותי', stTitle: 'סיפורי מטיילים בהר גריזים', stIntro: 'נוסעים וצליינים נוצרים, ומארק טוויין ביניהם, שכתבו על ביקורם בהר ובשכם. כל סיפור מובא מן המקור עצמו, בתרגום; המקומות שהם מתארים מסומנים בטקסט — לחיצה מראה אותם על המפה.',
      stOrig: 'המקור', stTr: 'התרגום', stMap: 'הצגה על המפה', stFull: '⤢ מסך מלא', stClose: 'סגירה', stPlaces: 'המקומות שבסיפור', stSource: 'המקור', stPrev: '→ הקודם', stNext: 'הבא ←',
      stLoading: 'טוען את הסיפורים…', stFail: 'הסיפורים לא נטענו. בדקו את החיבור לרשת ונסו שוב.', stNoStory: 'לסיפור הזה עדיין אין נוסח מלא; מוצג הציטוט הקצר.',
      conf_sure: 'זיהוי ודאי', conf_likely: 'זיהוי סביר', conf_guess: 'זיהוי משוער', stMentions: 'מוזכר בסיפורי:', stIdx: 'המטיילים', stAt: 'בסיפור', origLang: { en: 'אנגלית', fr: 'צרפתית', de: 'גרמנית', la: 'לטינית', ar: 'ערבית' },
      tr_climbed: 'עלה להר', tr_seen: 'ראה את ההר מרחוק', tr_nablus_only: 'תיאר את שכם והסביבה', visit: 'ביקור', pub: 'פרסום', orig: 'נוסח המקור', trNote: 'התרגום נעשה לצורך הסיור.' },
    en: { layers: 'Layers', lyTitle: 'Layers on the map', lyTravel: 'Travellers\' stories', lyTravelTip: 'The places that Christian travellers, Mark Twain and others, described in the story of their visit — each in its place on the map',
      lySprings: 'A mountain of springs', lySpringsTip: 'All the springs around Mount Gerizim, and a tour from spring to spring with photos', stOpen: '📖 Open the stories', sprTour: '▶ Tour of the springs',
      stFindPh: 'Search a narrator, a year or a word in the stories', stFindN: 'Narrators', stFindT: 'In the stories', stFindCount: '{n} matches in {m} stories', stFindNone: 'Nothing found', stFindBtn: 'Search the stories', stAbout: '👤 About the narrator', scState: 'The area as the narrator saw it', scShow: 'Show the visual description', stTitle: 'Travellers\' stories of Mount Gerizim', stIntro: 'Christian travellers and pilgrims, Mark Twain among them, who wrote about their visit to the mountain and to Nablus. Each story comes from the source itself; the places they describe are marked in the text — tap one to see it on the map.',
      stOrig: 'Original', stTr: 'Translation', stMap: 'Show on the map', stFull: '⤢ Full screen', stClose: 'Close', stPlaces: 'Places in the story', stSource: 'Source', stPrev: '← Previous', stNext: 'Next →',
      stLoading: 'Loading the stories…', stFail: 'The stories did not load. Check the connection and try again.', stNoStory: 'This story has no full text yet; the short quote is shown.',
      conf_sure: 'certain identification', conf_likely: 'likely identification', conf_guess: 'conjectural identification', stMentions: 'Mentioned by:', stIdx: 'The travellers', stAt: 'In the story', origLang: { en: 'English', fr: 'French', de: 'German', la: 'Latin', ar: 'Arabic' },
      tr_climbed: 'Climbed the mountain', tr_seen: 'Saw the mountain from afar', tr_nablus_only: 'Described Nablus and its surroundings', visit: 'visit', pub: 'published', orig: 'Original text', trNote: 'Translated for this tour.' },
    ar: { layers: 'الطبقات', lyTitle: 'طبقات على الخريطة', lyTravel: 'قصص الرحّالة', lyTravelTip: 'الأماكن التي وصفها الرحّالة المسيحيون، ومارك توين وغيره، في قصة زيارتهم للجبل — كلٌّ في موضعه على الخريطة',
      lySprings: 'جبل الينابيع', lySpringsTip: 'كل الينابيع حول جبل جرزيم، وجولة من نبع إلى نبع مع الصور', stOpen: '📖 فتح القصص', sprTour: '▶ جولة بين الينابيع',
      stFindPh: 'ابحث عن راوٍ أو سنة أو كلمة في القصص', stFindN: 'الرواة', stFindT: 'داخل القصص', stFindCount: '{n} موضعًا في {m} قصة', stFindNone: 'لم يُعثر على شيء', stFindBtn: 'البحث في القصص', stAbout: '👤 عن الراوي', scState: 'حال المنطقة كما رآها الراوي', scShow: 'اعرض الوصف المرئي', stTitle: 'قصص الرحّالة عن جبل جرزيم', stIntro: 'رحّالة وحجّاج مسيحيون، ومنهم مارك توين، كتبوا عن زيارتهم للجبل ولنابلس. كل قصة مأخوذة من المصدر نفسه مترجمةً؛ والأماكن التي يصفونها معلَّمة في النص — انقر عليها لتراها على الخريطة.',
      stOrig: 'الأصل', stTr: 'الترجمة', stMap: 'عرض على الخريطة', stFull: '⤢ ملء الشاشة', stClose: 'إغلاق', stPlaces: 'الأماكن في القصة', stSource: 'المصدر', stPrev: '→ السابق', stNext: 'التالي ←',
      stLoading: 'جارٍ تحميل القصص…', stFail: 'لم تُحمَّل القصص. تحقّق من الاتصال وحاول مجددًا.', stNoStory: 'لا نصّ كاملًا لهذه القصة بعد؛ يُعرض الاقتباس القصير.',
      conf_sure: 'تحديد مؤكد', conf_likely: 'تحديد مرجّح', conf_guess: 'تحديد تقديري', stMentions: 'ورد في قصص:', stIdx: 'الرحّالة', stAt: 'في القصة', origLang: { en: 'الإنجليزية', fr: 'الفرنسية', de: 'الألمانية', la: 'اللاتينية', ar: 'العربية' },
      tr_climbed: 'صعد الجبل', tr_seen: 'رأى الجبل من بعيد', tr_nablus_only: 'وصف نابلس وما حولها', visit: 'الزيارة', pub: 'النشر', orig: 'النص الأصلي', trNote: 'تُرجم لأجل هذه الجولة.' }
  };
  const T = k => (TX[lang] || TX.he)[k];
  const L = v => (v && typeof v === 'object') ? (v[lang] || v.he || v.en || '') : (v || '');
  const TRAVEL = (window.GERIZIM_TRAVEL || []).slice();
  const VER = ((document.querySelector('script[src*="layers.js"]') || {}).src || '').split('?')[1] || '';

  /* ---------- טעינת הסיפורים המלאים, פעם אחת ---------- */
  let STORIES = window.GERIZIM_STORIES || null, loading = null;
  function loadStories() {
    if (STORIES) return Promise.resolve(STORIES);
    if (loading) return loading;
    loading = new Promise((ok, fail) => {
      const sc = document.createElement('script');
      sc.src = 'travel_stories.js' + (VER ? '?' + VER : '');
      sc.onload = () => { STORIES = window.GERIZIM_STORIES || {}; ok(STORIES); };
      sc.onerror = () => { loading = null; sc.remove(); fail(new Error('stories')); };
      document.head.appendChild(sc);
    });
    return loading;
  }
  const hasStory = id => !!(TRAVEL.find(e => e.id === id) || {}).story;

  /* ---------- היכן נמצא מקום שבסיפור ---------- */
  function ptLL(q) {
    if (q.station && byId[q.station] && byId[q.station].center) return byId[q.station].center;
    if (q.lat != null && q.lon != null) return [q.lon, q.lat];
    return null;
  }
  // שם המקום: שם התחנה, או קטע הטקסט מקוצר לכמה מילים
  function ptName(q) {
    if (q.station && byId[q.station]) return L(byId[q.station].name);
    const f = (L(q.name) || L(q.q) || '').split(/\s*(?:\.\.\.|…)\s*/)[0];
    if (f.length <= 42) return f;
    const w = f.slice(0, 42), k = w.lastIndexOf(' ');
    return (k > 20 ? w.slice(0, k) : w) + '…';
  }
  const SUMMIT = [35.2731, 32.2009];
  const farFrom = ll => Math.hypot((ll[0] - SUMMIT[0]) * 94.3, (ll[1] - SUMMIT[1]) * 111) > 1.6;   // ק"מ

  /* ---------- כפתור השכבות ולוח הבחירה ---------- */
  const btn = document.createElement('button');
  btn.id = 'btnLayers'; btn.setAttribute('aria-expanded', 'false');
  const anchor = $('btnList'); anchor.parentNode.insertBefore(btn, anchor);
  const pop = document.createElement('div');
  pop.id = 'lyPop'; pop.setAttribute('role', 'dialog');
  document.body.appendChild(pop);
  const on = { travel: false, springs: false };
  function popHtml() {
    on.springs = !!state.lySpr && state.orient;
    pop.innerHTML = '<div class="lyh"><b>' + esc(T('lyTitle')) + '</b><button class="lyx" aria-label="' + esc(T('stClose')) + '">✕</button></div>' +
      row('travel', '📖', T('lyTravel'), T('lyTravelTip'), '<button class="lyact" id="lyStories">' + esc(T('stOpen')) + '</button>') +
      row('springs', '💧', T('lySprings'), T('lySpringsTip'), '<button class="lyact" id="lySprTour">' + esc(T('sprTour')) + '</button>');
    pop.querySelector('.lyx').onclick = () => popShow(false);
    pop.querySelectorAll('[data-ly]').forEach(b => { b.onclick = () => toggle(b.dataset.ly); });
    $('lyStories').onclick = () => { popShow(false); openReader(); };
    $('lySprTour').onclick = () => { popShow(false); springsTour(); };
  }
  function row(id, ic, name, tip, act) {
    return '<div class="lyrow' + (on[id] ? ' on' : '') + '"><button class="lytg" data-ly="' + id + '" role="switch" aria-checked="' + on[id] + '">' +
      '<i>' + ic + '</i><span><b>' + esc(name) + '</b><small>' + esc(tip) + '</small></span><em></em></button>' + act + '</div>';
  }
  function popShow(v) {
    if (v) popHtml();
    pop.classList.toggle('open', v); btn.classList.toggle('on', v || on.travel || on.springs); btn.setAttribute('aria-expanded', v ? 'true' : 'false');
  }
  btn.onclick = e => { e.stopPropagation(); popShow(!pop.classList.contains('open')); };
  document.addEventListener('click', e => { if (pop.classList.contains('open') && !pop.contains(e.target) && e.target !== btn) popShow(false); });
  function toggle(id) {
    if (id === 'travel') travelLayer(!on.travel); else springsLayer(!on.springs);
    popHtml(); btn.classList.toggle('on', on.travel || on.springs);
  }

  /* ---------- שכבת סיפורי המטיילים: סימן לכל מקום, ובו מי תיאר אותו ---------- */
  let marks = [], popup = null;
  function travelLayer(v) {
    on.travel = v;
    marks.forEach(m => m.remove()); marks = [];
    if (popup) { popup.remove(); popup = null; }
    document.body.classList.toggle('lytravel', v);
    if (!v) return;
    loadStories().then(buildMarks).catch(() => toastMsg(T('stFail')));
  }
  function buildMarks() {
    if (!on.travel) return;
    const groups = {};
    TRAVEL.forEach(e => {
      const st = STORIES[e.id]; if (!st || !st.points) return;
      st.points.forEach((q, i) => {
        const ll = ptLL(q); if (!ll) return;
        const k = q.station || ll.map(x => x.toFixed(3)).join(',');
        const g = groups[k] = groups[k] || { ll, name: ptName(q), list: [] };
        if (!g.list.some(x => x.e === e)) g.list.push({ e, i });
      });
    });
    Object.keys(groups).forEach(k => {
      const g = groups[k], el = document.createElement('button');
      el.className = 'stmk'; el.title = g.name;
      el.innerHTML = '<i>📖</i>' + (g.list.length > 1 ? '<b>' + g.list.length + '</b>' : '');
      el.onclick = ev => { ev.stopPropagation(); markPopup(g); };
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(g.ll).addTo(map);
      m._n = g.list.length; marks.push(m);
    });
    thin();
  }
  // סימנים שעולים זה על זה: נשאר המקום שיותר מטיילים תיארו, והאחר מחכה עד שמתקרבים
  function thin() {
    const shown = [];
    marks.slice().sort((a, b) => b._n - a._n).forEach(m => {
      const q = map.project(m.getLngLat()), hit = shown.some(o => Math.abs(o.x - q.x) < 34 && Math.abs(o.y - q.y) < 26);
      m.getElement().style.visibility = hit ? 'hidden' : '';
      if (!hit) shown.push(q);
    });
  }
  let thinT = 0;
  map.on('move', () => { if (marks.length) { clearTimeout(thinT); thinT = setTimeout(thin, 120); } });
  function markPopup(g) {
    if (popup) popup.remove();
    const div = document.createElement('div');
    div.className = 'stpop'; div.dir = lang === 'en' ? 'ltr' : 'rtl';
    div.innerHTML = '<b>' + esc(g.name) + '</b><small>' + esc(T('stMentions')) + '</small>' + g.list.map((x, n) =>
      '<button data-n="' + n + '">' + esc(L(x.e.writer)) + ' <i>' + esc(x.e.visit_year || x.e.pub_year || '') + '</i></button>').join('');
    div.querySelectorAll('button').forEach(b => { b.onclick = () => { const x = g.list[+b.dataset.n]; popup.remove(); popup = null; openReader(x.e.id, x.i); }; });
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 26 }).setLngLat(g.ll).setDOMContent(div).addTo(map);
  }

  /* ---------- שכבת המעיינות ---------- */
  const SPR = () => A.PLACES.filter(p => p.group === 'springs' && p.center);
  function springsLayer(v) {
    on.springs = v; state.lySpr = v;
    document.body.classList.toggle('lysprings', v);
    if (v) {
      A.enterOrient(false);
      const b = new maplibregl.LngLatBounds(); SPR().forEach(p => b.extend(p.center));
      const ph = A.isPhone();
      map.fitBounds(b, { padding: { top: 70, bottom: (document.getElementById('bar').offsetHeight || 90) + 30, left: ph ? 20 : 60, right: ph ? 20 : 60 }, pitch: 0, bearing: 0, duration: 1800 });
    }
    A.repaint();
  }
  function springsTour() {
    if (!A.PWALK.springs) return;
    if (!on.springs) springsLayer(true);
    A.photoWalk('springs', 0);
  }

  /* ---------- קורא הסיפורים ---------- */
  const rd = document.createElement('div');
  rd.id = 'story'; rd.setAttribute('role', 'dialog'); rd.setAttribute('aria-modal', 'true');
  document.body.appendChild(rd);
  let cur = null, mode = 'tr', ptMark = null, query = '', hl = null;
  function openReader(id, pt) {
    A.photoWalkEnd(); A.introEnd(true); A.endTour();
    rd.classList.add('open'); rd.classList.remove('docked'); document.body.classList.add('storyopen');
    rd.innerHTML = '<div class="sttop"><b>' + esc(T('stTitle')) + '</b><button class="stx" aria-label="' + esc(T('stClose')) + '">✕</button></div><div class="stload">' + esc(T('stLoading')) + '</div>';
    rd.querySelector('.stx').onclick = closeReader;
    loadStories().then(() => {
      const list = order();
      cur = id && list.some(e => e.id === id) ? id : null;
      render(pt);
    }).catch(() => { rd.querySelector('.stload').textContent = T('stFail'); });
  }
  function closeReader() {
    rd.classList.remove('open', 'docked'); document.body.classList.remove('storyopen', 'storydock'); rd.innerHTML = ''; cur = null;
    if (ptMark) { ptMark.remove(); ptMark = null; }
    A.fingerSel();
  }
  // קטע שבתוכו השמטה ("...") — מסמנים את החלק שעד ההשמטה
  const cut = f => f ? f.split(/\s*(?:\.\.\.|…)\s*/)[0] : f;
  const order = () => TRAVEL.filter(e => STORIES[e.id]).sort((a, b) => (a.visit_year || a.pub_year || 0) - (b.visit_year || b.pub_year || 0));
  // הנוסח שמוצג: התרגום לשפת הממשק, או המקור
  function paras(st) {
    const s = st.story || {};
    if (mode === 'orig') return s.orig || [];
    return s[lang] || (lang === 'en' ? s.orig : null) || s.en || s.orig || [];
  }
  function render(pt) {
    const list = order();
    const sel = '<select id="stSel" aria-label="' + esc(T('stIdx')) + '"><option value="">' + esc(T('stTitle')) + '</option>' +
      list.map(e => '<option value="' + esc(e.id) + '"' + (e.id === cur ? ' selected' : '') + '>' + esc(L(e.writer)) + ' · ' + esc(e.visit_year || e.pub_year || '') + '</option>').join('') + '</select>';
    const nav = '<nav id="stIdx"><h3>' + esc(T('stIdx')) + '</h3>' + list.map(e =>
      '<button data-id="' + esc(e.id) + '"' + (e.id === cur ? ' class="on"' : '') + '><b>' + esc(L(e.writer)) + '</b><i>' + esc(e.visit_year || e.pub_year || '') + ' · ' + esc(T('tr_' + e.did_climb) || '') + '</i></button>').join('') + '</nav>';
    const e = cur && TRAVEL.find(x => x.id === cur), st = e && STORIES[e.id];
    let art;
    if (!e) {
      art = '<h2>' + esc(T('stTitle')) + '</h2><p class="stsum">' + esc(T('stIntro')) + '</p>' +
        '<div class="stfind"><input id="stQ" type="search" autocomplete="off" placeholder="' + esc(T('stFindPh')) + '" aria-label="' + esc(T('stFindPh')) + '" value="' + esc(query) + '"><div id="stRes"></div></div>' +
        '<div class="stcards">' + list.map(x =>
        '<button data-id="' + esc(x.id) + '" data-key="' + esc(keyOf(x)) + '"><b>' + esc(L(x.writer)) + '</b><i>' + esc(x.visit_year || x.pub_year || '') + ' · ' + esc(T('tr_' + x.did_climb) || '') + '</i><span>' + esc(L(x.summary)) + '</span></button>').join('') + '</div>';
    } else {
      const P = paras(st), pts = st.points || [], orig = (st.story || {}).orig || [];
      const canOrig = st.lang_orig && st.lang_orig !== lang && orig.length && (st.story[lang] || lang !== 'en');
      const used = new Set();
      const body = P.map((tx, k) => {
        // המקומות שבפסקה: קטע הטקסט מסומן במקומו; אם הקטע אינו נמצא בתרגום — סימן בסוף הפסקה
        let html = esc(tx), tail = '';
        pts.forEach((q, i) => {
          const frag = cut(mode === 'orig' ? q.q && q.q.orig : (q.q && (q.q[lang] || (lang === 'en' ? q.q.orig : ''))));
          const fe = frag ? esc(frag) : '';
          if (fe && !used.has(i) && html.includes(fe)) { html = html.replace(fe, '<button class="stq" data-pt="' + i + '">' + fe + '</button>'); used.add(i); }
        });
        pts.forEach((q, i) => {
          if (used.has(i) || !q.q || !q.q.orig) return;
          if ((orig[k] || '').includes(cut(q.q.orig))) { tail += ' <button class="stq chip" data-pt="' + i + '">📍 ' + esc(ptName(q)) + '</button>'; used.add(i); }
        });
        return '<p dir="auto">' + html + tail + '</p>';
      }).join('');
      const i0 = list.indexOf(e);
      art = '<div class="sthead"><h2>' + esc(L(e.writer)) + '</h2><button class="lyact stabout" data-narr="' + esc(e.id) + '">' + esc(T('stAbout')) + '</button><div class="stmeta"><i>' + esc((lang === 'ar' ? (e.title.ar || e.title.en) : L(e.title)) || e.title.orig) + '</i>' +
        [e.visit_year ? T('visit') + ' ' + e.visit_year : '', e.pub_year ? T('pub') + ' ' + e.pub_year : ''].filter(Boolean).map(x => ' · ' + esc(x)).join('') +
        ' <em class="c-' + esc(e.did_climb) + '">' + esc(T('tr_' + e.did_climb) || '') + '</em></div>' +
        (canOrig ? '<div class="stmode"><button data-m="tr"' + (mode === 'tr' ? ' class="on"' : '') + '>' + esc(T('stTr')) + '</button><button data-m="orig"' + (mode === 'orig' ? ' class="on"' : '') + '>' + esc(T('stOrig')) + ' · ' + esc((T('origLang') || {})[st.lang_orig] || st.lang_orig) + '</button></div>' : '') +
        '</div><p class="stsum">' + esc(L(e.summary)) + '</p>' +
        (window.GerizimScenes && GerizimScenes.has(e.id) ? '<div class="stscene"><b>' + esc(T('scState')) + '</b><p>' + esc(L(GerizimScenes.state(e.id))) + '</p><button class="lyact" data-scene="' + esc(e.id) + '">👁 ' + esc(T('scShow')) + '</button></div>' : '') +
        (P.length ? '<div class="sttext' + (mode === 'orig' ? ' orig' : '') + '">' + body + '</div>' : '<p class="stsum">' + esc(T('stNoStory')) + '</p>') +
        (pts.length ? '<h3>' + esc(T('stPlaces')) + '</h3><ol class="stpts">' + pts.map((q, i) =>
          '<li><button class="stq" data-pt="' + i + '"' + (ptLL(q) ? '' : ' disabled') + '>📍 ' + esc(ptName(q)) + '</button>' +
          (q.conf ? '<em class="cf-' + esc(q.conf) + '">' + esc(T('conf_' + q.conf) || '') + '</em>' : '') +
          (L(q.how) ? '<span>' + esc(L(q.how)) + '</span>' : '') + '</li>').join('') + '</ol>' : '') +
        '<p class="stsrc">' + (st.where ? esc(st.where) + ' · ' : '') + '<a href="' + esc(st.url || e.url) + '" target="_blank" rel="noopener">' + esc(T('stSource')) + ' ↗</a>' +
        (mode === 'tr' && st.lang_orig !== lang ? ' · ' + esc(T('trNote')) : '') + '</p>' +
        '<div class="stnav">' + (i0 > 0 ? '<button data-id="' + esc(list[i0 - 1].id) + '">' + esc(T('stPrev')) + ' ' + esc(L(list[i0 - 1].writer)) + '</button>' : '<span></span>') +
        (i0 < list.length - 1 ? '<button data-id="' + esc(list[i0 + 1].id) + '">' + esc(L(list[i0 + 1].writer)) + ' ' + esc(T('stNext')) + '</button>' : '') + '</div>';
    }
    rd.innerHTML = '<div class="sttop"><b>' + esc(T('stTitle')) + '</b>' + sel +
      '<button class="stfind1" aria-label="' + esc(T('stFindBtn')) + '" title="' + esc(T('stFindBtn')) + '">🔍</button><button class="stfull">' + esc(T('stFull')) + '</button><button class="stx" aria-label="' + esc(T('stClose')) + '">✕</button></div>' +
      '<div class="stbody">' + nav + '<article id="stArt" dir="' + (lang === 'en' ? 'ltr' : 'rtl') + '">' + art + '</article></div>';
    rd.querySelector('.stx').onclick = closeReader;
    rd.querySelector('.stfull').onclick = () => { rd.classList.remove('docked'); document.body.classList.remove('storydock'); };
    $('stSel').onchange = ev => { cur = ev.target.value || null; hl = null; render(); };
    rd.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => { cur = b.dataset.id; hl = null; render(); }; });
    rd.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { mode = b.dataset.m; render(); }; });
    rd.querySelectorAll('[data-pt]').forEach(b => { b.onclick = () => showPoint(+b.dataset.pt, b); });
    rd.querySelectorAll('[data-scene]').forEach(b => { b.onclick = () => GerizimScenes.play(b.dataset.scene, 'story'); });
    rd.querySelectorAll('[data-narr]').forEach(b => { b.onclick = () => window.GerizimExtras && GerizimExtras.narrator(b.dataset.narr, 'story'); });
    rd.querySelector('.stfind1').onclick = () => { cur = null; hl = null; rd.classList.remove('docked'); document.body.classList.remove('storydock'); render(); const q = $('stQ'); if (q) q.focus(); };
    if (!e) {
      const q = $('stQ'); let qt = 0;
      q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { query = q.value; find(); }, 180); };
      find();
    } else if (hl) mark($('stArt').querySelector('.sttext'), hl);
    const artEl = $('stArt'); artEl.scrollTop = 0;
    if (pt && pt.para != null && st) {
      const pEl = artEl.querySelectorAll('.sttext p')[pt.para], m = pEl && (pEl.querySelector('mark') || pEl);
      if (m) setTimeout(() => m.scrollIntoView({ block: 'center' }), 60);
    } else if (pt != null && st) {
      const b = artEl.querySelector('.sttext [data-pt="' + pt + '"]') || artEl.querySelector('[data-pt="' + pt + '"]');
      if (b) { b.classList.add('hit'); setTimeout(() => b.scrollIntoView({ block: 'center' }), 60); }
    }
  }
  /* ---------- חיפוש: מספר (שם, שנה, שם הספר) או מילה בתוך הסיפורים ---------- */
  // ניקוד, טעמים, תנועות ערביות וסימני הטעמה אינם מפריעים להתאמה
  const MARKS = '[\u0591-\u05C7\u064B-\u065F\u0670\u0300-\u036f]';
  const norm = t => String(t || '').normalize('NFD').replace(new RegExp(MARKS, 'g'), '').toLowerCase();
  const keyOf = x => norm([x.writer && x.writer.he, x.writer && x.writer.en, x.writer && x.writer.ar, x.title && x.title.he, x.title && x.title.en, x.title && x.title.ar, x.title && x.title.orig, x.visit_year, x.pub_year].join(' '));
  const reOf = t => new RegExp(t.normalize('NFD').replace(new RegExp(MARKS, 'g'), '').split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + MARKS + '*').join(''), 'gi');
  function find() {
    const res = $('stRes'); if (!res) return;
    const q = norm(query).trim();
    rd.querySelectorAll('.stcards [data-key]').forEach(b => { b.style.display = !q || b.dataset.key.includes(q) ? '' : 'none'; });
    if (q.length < 2) { res.innerHTML = ''; return; }
    const list = order(), who = list.filter(x => keyOf(x).includes(q));
    let hits = 0, nst = 0, h = '';
    list.forEach(x => {
      const st = STORIES[x.id]; if (!st || !st.story) return;
      const tr = st.story[lang] || (lang === 'en' ? st.story.orig : null) || [], orig = st.lang_orig !== lang ? (st.story.orig || []) : [];
      const found = [];
      [[tr, 'tr'], [orig, 'orig']].forEach(([P, m]) => P.forEach((tx, k) => {
        const n = norm(tx); let i = n.indexOf(q), c = 0;
        while (i >= 0) { c++; if (found.length < 3 && c === 1) found.push({ m, k, tx }); i = n.indexOf(q, i + q.length); }
        hits += c;
      }));
      if (!found.length) return;
      nst++;
      h += '<div class="stfhit"><b>' + esc(L(x.writer)) + ' · ' + esc(x.visit_year || x.pub_year || '') + '</b>' + found.map(f => {
        // קטע קצר סביב המילה, מתוך הטקסט עצמו (עם הניקוד שבו)
        const re = reOf(query.trim()), mm = re.exec(f.tx), i = mm ? mm.index : 0, len = mm ? mm[0].length : 0;
        const a = Math.max(0, i - 60), b = Math.min(f.tx.length, i + len + 80);
        const snip = (a ? '…' : '') + f.tx.slice(a, b) + (b < f.tx.length ? '…' : '');
        return '<button data-fid="' + esc(x.id) + '" data-fk="' + f.k + '" data-fm="' + f.m + '" dir="auto">' + esc(snip).replace(reOf(query.trim()), '<mark>$&</mark>') + '</button>';
      }).join('') + '</div>';
    });
    res.innerHTML = (who.length ? '<h4>' + esc(T('stFindN')) + '</h4><div class="stfwho">' + who.map(x => '<button data-wid="' + esc(x.id) + '">' + esc(L(x.writer)) + ' <i>' + esc(x.visit_year || x.pub_year || '') + '</i></button>').join('') + '</div>' : '') +
      (nst ? '<h4>' + esc(T('stFindT')) + ' <em>' + esc(T('stFindCount').replace('{n}', hits).replace('{m}', nst)) + '</em></h4>' + h : '') +
      (!who.length && !nst ? '<p class="stsum">' + esc(T('stFindNone')) + '</p>' : '');
    res.querySelectorAll('[data-wid]').forEach(b => { b.onclick = () => { cur = b.dataset.wid; hl = null; render(); }; });
    res.querySelectorAll('[data-fid]').forEach(b => { b.onclick = () => { cur = b.dataset.fid; mode = b.dataset.fm; hl = query.trim(); render({ para: +b.dataset.fk }); }; });
  }
  // הדגשת המילה שחיפשו בתוך הסיפור שנפתח
  function mark(root, term) {
    if (!root || !term) return;
    const re = reOf(term), nodes = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      re.lastIndex = 0; if (!re.test(n.nodeValue)) return;
      const span = document.createElement('span'); re.lastIndex = 0;
      span.innerHTML = esc(n.nodeValue).replace(re, '<mark>$&</mark>');
      n.parentNode.replaceChild(span, n);
    });
  }

  // מקום שבסיפור: הקורא נצמד לצד, והמפה עוברת אליו
  function showPoint(i, b) {
    const st = STORIES[cur], q = st && st.points[i], ll = q && ptLL(q); if (!ll) return;
    rd.querySelectorAll('.stq.hit').forEach(x => x.classList.remove('hit')); if (b) b.classList.add('hit');
    rd.classList.add('docked'); document.body.classList.add('storydock');
    const far = farFrom(ll) || (q.station && byId[q.station] && (byId[q.station].far || byId[q.station].orient));
    if (far && !state.orient) A.enterOrient(false);
    if (!far && state.orient) A.leaveOrient();
    if (!ptMark) { const el = document.createElement('div'); el.className = 'stdot'; ptMark = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map); }
    ptMark.setLngLat(ll);
    const el = ptMark.getElement(); el.innerHTML = '<span>' + esc(ptName(q)) + '</span>';
    A.finger(ll, 48);                                    // מעל התווית שעל הנקודה
    map.flyTo({ center: ll, zoom: far ? 15.4 : 17.3, pitch: far ? 45 : 55, bearing: map.getBearing(), padding: A.padFor(rd), duration: 2000, essential: true });
  }
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (rd.classList.contains('open') && !document.getElementById('lightbox').classList.contains('open')) closeReader();
    else if (pop.classList.contains('open')) popShow(false);
  });

  function toastMsg(m) { const t = $('toast'); if (!t) return; t.textContent = m; t.style.display = 'block'; setTimeout(() => { t.style.display = 'none'; }, 5000); }
  function setLang(l) {
    lang = l; btn.textContent = T('layers'); btn.title = T('lyTitle');
    if (pop.classList.contains('open')) popHtml();
    if (on.travel) travelLayer(true);
    if (rd.classList.contains('open') && STORIES) { const dock = rd.classList.contains('docked'); render(); if (dock) rd.classList.add('docked'); }
    A.barHeight();
  }
  window.GerizimLayers = { hasStory, openStory: id => openReader(id), closeStory: () => closeReader(), isOpen: () => rd.classList.contains('open'), setLang, travelLayer, springsLayer };
  setLang(lang);
  A.renderCard();                      // כפתורי "הסיפור המלא" בכרטיסים שכבר פתוחים
})();
