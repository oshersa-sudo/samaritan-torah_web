/* ציר הזמן — מראה: ערכות צבעים, ותמונת התקופה ברקע.
 *
 * שני דברים בתפריט ההמבורגר ("≡ שכבות"), מתחת לשכבות ולרצועות:
 *
 *  1. ערכת צבעים — שש: לילה (כפי שהיה), קלף, ים, זית, אדמה וניגודיות גבוהה.
 *     כל ערכה היא רק ערכי משתנים על <html data-theme>; style.css מחיל אותם
 *     גם על המשטחים שצבעם היה כתוב בו במפורש.
 *  2. "תמונות התקופה ברקע" — מסומן או לא. כשמסומן, מאחורי הציר עומדת תמונה
 *     של התקופה שתחת נקודת ה-0, מעומעמת מאוד ומטושטשת מעט, ומתחלפת בהדרגה
 *     כשעוברים לתקופה אחרת. היא לעולם אינה מעל הטקסט, ואינה תופסת לחיצות.
 *     בפינה — שם התמונה, היוצר והרישיון, באותיות קטנות.
 *
 * שתי הבחירות נשמרות במכשיר.
 */
(function () {
  'use strict';
  var IMGS = (window.TL_PERIOD_IMAGES || []).slice().sort(function (a, b) { return a.from - b.from; });
  var THEMES = ['night', 'parchment', 'sea', 'olive', 'earth', 'contrast'];
  var TXT = {
    he: { theme: 'ערכת צבעים:', night: 'לילה', parchment: 'קלף', sea: 'ים', olive: 'זית', earth: 'אדמה', contrast: 'ניגודיות',
          pics: 'תמונות התקופה ברקע', picsHint: 'מעומעמות, מאחורי הציר', bg: 'ברקע' },
    en: { theme: 'Colours:', night: 'Night', parchment: 'Parchment', sea: 'Sea', olive: 'Olive', earth: 'Earth', contrast: 'Contrast',
          pics: 'Pictures of the period behind', picsHint: 'dimmed, behind the timeline', bg: 'Behind' },
    ar: { theme: 'الألوان:', night: 'ليل', parchment: 'رَقّ', sea: 'بحر', olive: 'زيتون', earth: 'تراب', contrast: 'تباين',
          pics: 'صور الحقبة في الخلفية', picsHint: 'باهتة، خلف الخط الزمني', bg: 'في الخلفية' }
  };
  var lang = function () { var l = (document.documentElement.lang || 'he').slice(0, 2); return TXT[l] ? l : 'he'; };
  var T = function (k) { return TXT[lang()][k]; };
  var get = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* אין אחסון */ } };

  var menu = document.getElementById('menuExtra'), main = document.getElementById('main');
  if (!menu || !main) return;

  /* ── 1. ערכת הצבעים ── */
  function setTheme(id) {
    if (THEMES.indexOf(id) < 0) id = 'night';
    if (id === 'night') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
    put('tlTheme', id);
    var bs = box.querySelectorAll('.tl-sw');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-t') === id);
  }
  var box = document.createElement('div'); box.className = 'tl-look';
  var h = document.createElement('span'); h.className = 'flabel sep'; box.appendChild(h);
  var row = document.createElement('div'); row.className = 'tl-swatches'; box.appendChild(row);
  THEMES.forEach(function (id) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tl-sw'; b.setAttribute('data-t', id);
    b.innerHTML = '<i class="tl-dot tl-dot-' + id + '"></i><span></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); setTheme(id); });
    row.appendChild(b);
  });

  /* ── 2. תמונת התקופה ── */
  var lab = document.createElement('label'); lab.className = 'tl-pics';   // not .chip: app.js counts, relabels and re-renders every .chip as a layer
  var cb = document.createElement('input'); cb.type = 'checkbox';
  var ls = document.createElement('span'); lab.appendChild(cb); lab.appendChild(ls);
  var hint = document.createElement('small'); hint.className = 'tl-hint'; lab.appendChild(hint);
  box.appendChild(lab);
  menu.parentNode.insertBefore(box, menu);           // לפני מה שעובר לתפריט בטלפון

  var layer = document.createElement('div'); layer.id = 'periodBg'; layer.setAttribute('aria-hidden', 'true');
  var A = document.createElement('div'), B = document.createElement('div');
  A.className = B.className = 'pb-img';
  var cap = document.createElement('a'); cap.className = 'pb-cap'; cap.target = '_blank'; cap.rel = 'noopener';
  layer.appendChild(A); layer.appendChild(B);
  main.insertBefore(layer, main.firstChild);
  main.appendChild(cap);                              // מעל הכול, כדי שאפשר יהיה ללחוץ על הקרדיט

  var front = A, cur = null, lastY = null, on = false;
  function imgFor(y) {
    var pick = null;
    for (var i = 0; i < IMGS.length; i++) if (IMGS[i].from <= y) pick = IMGS[i];
    return pick || IMGS[0] || null;
  }
  function show(r) {
    if (!r || r === cur) return;
    cur = r;
    var back = front === A ? B : A, url = r.src || r.t;
    var im = new Image();
    im.onload = function () {
      if (cur !== r) return;                         // כבר עברו הלאה
      back.style.backgroundImage = 'url("' + url + '")';
      back.classList.add('vis'); front.classList.remove('vis'); front = back;
    };
    im.src = url;
    cap.textContent = T('bg') + ': ' + r.title + ' · ' + r.by + ' · ' + r.lic + ' · Wikimedia Commons';
    cap.href = r.page || '#';
    // the next period's picture, ready before it is needed
    var i = IMGS.indexOf(r); if (IMGS[i + 1]) (new Image()).src = IMGS[i + 1].src || IMGS[i + 1].t;
  }
  function setPics(v) {
    on = !!v; cb.checked = on; put('tlPics', on ? '1' : '0');
    document.documentElement.classList.toggle('tl-pics', on);
    if (on && lastY != null) show(imgFor(lastY));
    if (!on) { cur = null; A.classList.remove('vis'); B.classList.remove('vis'); }
  }
  cb.addEventListener('change', function () { setPics(cb.checked); });
  lab.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('tl:year', function (e) {
    lastY = e.detail;
    if (on) show(imgFor(lastY));
  });

  /* ── התוויות, בשפת הממשק — וכשהיא מתחלפת ── */
  function label() {
    h.textContent = T('theme');
    var bs = row.querySelectorAll('.tl-sw');
    for (var i = 0; i < bs.length; i++) bs[i].querySelector('span').textContent = T(bs[i].getAttribute('data-t'));
    ls.textContent = ' ' + T('pics'); hint.textContent = T('picsHint');
    if (cur) cap.textContent = T('bg') + ': ' + cur.title + ' · ' + cur.by + ' · ' + cur.lic + ' · Wikimedia Commons';
  }
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  label();
  setTheme(get('tlTheme', 'night'));
  setPics(get('tlPics', '0') === '1');
})();
