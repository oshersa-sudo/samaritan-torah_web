/* ───────────────────────────────────────────────────────────── קליפת הסיור
 *
 * שני דברים שלא היו לסיור משלו.
 *
 * האחד — צעד אחורה. הסיור נפתח בתוך מסגרת של האפליקציה, ומקש החזרה של
 * הטלפון הגיע עד כה אל האפליקציה בלבד: לחיצה אחת סגרה את הסיור כולו, גם
 * כשהיה פתוח בתוכו כרטיס, סיפור או תמונה. `unitBack` היא מה שהאפליקציה
 * שואלת לפני שהיא סוגרת (layerStep ב-app.js), והיא מסירה כאן דבר אחד
 * בלבד — העליון שבהם — ומחזירה "טיפלתי". רק כשאין מה להסיר הסיור עצמו
 * נסגר. בתוך סיפורי המטיילים גם מטייל יחיד הוא שלב: החזרה ממנו היא אל
 * הרשימה, לא החוצה.
 *
 * השני — כרטיס שאפשר לקפל. כרטיס המספר על מקום מכסה את המקום עצמו, וזה
 * בדיוק מה שרוצים לראות בשעה שקוראים עליו. לחיצה על – מקפלת אותו לשורת
 * כותרת צפה, שאפשר לגרור לכל פינה של המסך ולהחזיר בלחיצה. רק כרטיסי
 * המקומות — כרטיס המקום וסיור המעיינות; מה שנפתח על פני כל המסך נסגר ולא
 * מקופל.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const vis = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  };
  const press = sel => {
    const b = document.querySelector(sel);
    if (b && vis(b)) { b.click(); return true; }
    return false;
  };

  // The app above keeps its round back-arrow in the top-right corner of the
  // frame — the corner opposite every embedded app's own menu. The title of
  // the tour starts exactly there, so it is given room.
  if (window.top !== window.self) document.documentElement.classList.add('inframe');

  /* ── צעד אחורה ──────────────────────────────────────────────────────────
   * The order is the order they stand in on the screen: the topmost first.
   * Each entry closes by pressing the panel's own button, never by hiding it
   * behind the tour's back — so whatever that button does (stopping a walk,
   * letting go of an image, putting the map back) still happens.
   */
  const LAYERS = [
    ['lightbox', () => press('#lbX')],
    ['xsheet',   () => press('#xsheet .xsx') || press('#xsheet button')],
    ['story',    () => storyStep()],
    ['scene',    () => press('#scX')],
    ['tourPop',  () => press('#tourPop .lyx')],
    ['lyPop',    () => press('#lyPop .lyx')],
    // a folded card hides its own buttons, so the folded bar's ✕ — which
    // presses that same button after unfolding — stands in for them
    ['pwalk',    () => press('#pwX') || press('#pwalk .crdx')],
    ['walk',     () => press('#walkInfo.open .wx') || press('#walkExit')],
    ['card',     () => press('#cardX') || press('#card .crdx')],
    ['coach',    () => press('#coachX')],
  ];

  /* inside the travellers' reader a single traveller is a step of its own:
     back from him is back to the list of them all, and only then out */
  function storyStep() {
    const sel = $('stSel');
    if (sel && sel.value) {
      sel.value = '';
      sel.dispatchEvent(new Event('change'));
      return true;
    }
    return press('#story .stx');
  }

  window.unitBack = function () {
    for (const [id, close] of LAYERS) {
      const el = $(id);
      if (el && vis(el)) return !!close();
    }
    return false;                       // nothing of ours is open: close the tour
  };

  /* ── כרטיס מקופל ────────────────────────────────────────────────────────
   * Only the cards that tell about a place. A card is rebuilt from scratch
   * every time another place is opened, which takes its buttons with it, so
   * the fold is re-fitted whenever the card's content changes — and a card
   * that has just been opened on a new place is never left folded.
   */
  const FOLDABLE = ['card', 'pwalk'];
  const TXT = {
    he: { fold: 'מזעור לשורת כותרת', open: 'פתיחה', close: 'סגירה', drag: 'גרירה' },
    en: { fold: 'Fold to its title', open: 'Open', close: 'Close', drag: 'Drag' },
    ar: { fold: 'تصغير إلى شريط العنوان', open: 'فتح', close: 'إغلاق', drag: 'سحب' },
  };
  const lang = () => (document.documentElement.lang || 'he').slice(0, 2);
  const T = k => (TXT[lang()] || TXT.he)[k];

  const titleOf = el => {
    const t = el.querySelector('h2, #pwTitle, h3, b');
    return (t && t.textContent.trim()) || '';
  };

  function fitted(el) {
    if (el.querySelector(':scope > .crdmin')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'crdmin';
    b.innerHTML = '&#8211;';                       // –
    b.title = T('fold');
    b.setAttribute('aria-label', T('fold'));
    b.addEventListener('click', ev => { ev.stopPropagation(); fold(el, true); });
    el.appendChild(b);
  }

  function fold(el, on) {
    if (on) {
      const r = el.getBoundingClientRect();       // fold where it stands
      let bar = el.querySelector(':scope > .crdbar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'crdbar';
        const up = document.createElement('button');
        up.type = 'button'; up.className = 'crdup'; up.innerHTML = '&#9633;';
        up.title = T('open'); up.setAttribute('aria-label', T('open'));
        up.addEventListener('click', ev => { ev.stopPropagation(); fold(el, false); });
        const t = document.createElement('span');
        t.className = 'crdt';
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'crdx'; x.innerHTML = '&#10005;';
        x.title = T('close'); x.setAttribute('aria-label', T('close'));
        // the card's own close, so whatever it does still happens
        x.addEventListener('click', ev => {
          ev.stopPropagation();
          fold(el, false);
          const own = el.querySelector('#cardX, #pwX, .x');
          if (own) own.click(); else el.style.display = 'none';
        });
        bar.append(up, t, x);
        el.appendChild(bar);
        movable(el, bar);
      }
      bar.querySelector('.crdt').textContent = titleOf(el);
      el.classList.add('folded');
      // where it was, in plain numbers, so it can be dragged from there
      el.style.position = 'fixed';
      el.style.insetInlineStart = 'auto';
      el.style.insetInlineEnd = 'auto';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = Math.round(Math.min(r.left, innerWidth - 60)) + 'px';
      el.style.top = Math.round(Math.max(6, Math.min(r.top, innerHeight - 60))) + 'px';
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
    } else {
      el.classList.remove('folded');
      for (const p of ['position', 'left', 'top', 'right', 'bottom', 'insetInlineStart',
                       'insetInlineEnd', 'width', 'height', 'maxHeight'])
        el.style[p] = '';
    }
  }

  /* dragging, by the folded bar only — a card in full is not a window to shove
     about, and a map under a dragging finger must keep taking the finger */
  function movable(el, handle) {
    let dx = 0, dy = 0, id = null;
    handle.addEventListener('pointerdown', ev => {
      if (ev.target.closest('button')) return;           // the two buttons are not a grip
      const r = el.getBoundingClientRect();
      dx = ev.clientX - r.left; dy = ev.clientY - r.top; id = ev.pointerId;
      handle.setPointerCapture(id);
      el.classList.add('dragging');
      ev.preventDefault();
    });
    handle.addEventListener('pointermove', ev => {
      if (id === null || ev.pointerId !== id) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.max(2, Math.min(innerWidth - w - 2, ev.clientX - dx)) + 'px';
      el.style.top = Math.max(2, Math.min(innerHeight - h - 2, ev.clientY - dy)) + 'px';
    });
    const done = ev => {
      if (id === null) return;
      try { handle.releasePointerCapture(id); } catch (e) {}
      id = null;
      el.classList.remove('dragging');
    };
    handle.addEventListener('pointerup', done);
    handle.addEventListener('pointercancel', done);
  }

  const ours = n => n.nodeType === 1 &&
                    (n.classList.contains('crdbar') || n.classList.contains('crdmin'));

  for (const id of FOLDABLE) {
    const el = $(id);
    if (!el) continue;
    fitted(el);
    // The card is written anew for every place: the fold button goes with the
    // old content, and a new place must not arrive already folded.
    // Our own two elements are not that change, though — adding the folded
    // title bar is itself a change of children, and unfolding on it meant the
    // card sprang open in the same breath it was folded.
    new MutationObserver(recs => {
      const theirs = recs.some(r => [...r.addedNodes].some(n => !ours(n)) ||
                                    [...r.removedNodes].some(n => !ours(n)));
      if (!theirs) return;
      if (el.classList.contains('folded')) fold(el, false);
      fitted(el);
    }).observe(el, { childList: true });
  }
})();
