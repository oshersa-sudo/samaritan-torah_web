/* chrono.js — המרות בין מניני השנים.
 *
 * כל השנים בקוד נשמרות כ"שנה אסטרונומית" (signed): 1 לספירה = 1, שנה אחת
 * לפנה"ס = 0, שנתיים לפנה"ס = -1 וכן הלאה. כך אריתמטיקה של הפרשי שנים
 * עובדת בלי חור סביב השנה אפס.
 *
 * העוגנים נלקחו ממנוע לוח השנה השומרוני (samaritan_calendar):
 *   מניין כניסה לארץ כנען = שנה גרגוריאנית + 1638   [מאומת מול לוחות אותנטיים]
 *   מניין לבריאת העולם    = מניין כנען + 2800        [כפי שמודפס בלוחות]
 * ומכאן: לבריאת העולם = שנה גרגוריאנית + 4438.
 */
(function (global) {
  'use strict';

  var CANAAN_OFFSET = 1638;   // כנען = גרגוריאני + 1638
  var CREATION_FROM_CANAAN = 2800; // לבריאה = כנען + 2800
  var CREATION_OFFSET = CANAAN_OFFSET + CREATION_FROM_CANAAN; // 4438

  /* גבולות הציר */
  var FIRST_YEAR = 1 - CREATION_OFFSET;  // שנת הבריאה, -4437 = 4438 לפנה"ס
  var LAST_YEAR = new Date().getFullYear();

  function toCanaan(y) { return y + CANAAN_OFFSET; }
  function toCreation(y) { return y + CREATION_OFFSET; }
  function fromCreation(am) { return am - CREATION_OFFSET; }
  function fromCanaan(c) { return c - CANAAN_OFFSET; }

  function T(k) { return window.I18N ? window.I18N.t(k) : k; }

  /* תצוגת שנה גרגוריאנית: 2026 לספירה / 586 לפנה"ס */
  function gregLabel(y, opts) {
    opts = opts || {};
    if (y > 0) return opts.short ? String(y) : y + ' ' + T('ce');
    var b = 1 - y;
    if (!opts.short) return b + ' ' + T('bce');
    var rtl = window.I18N ? window.I18N.isRtl() : true;
    return rtl ? b + '-' : '-' + b;      /* בעברית ובערבית המינוס נכתב אחרי */
  }

  function creationLabel(y) {
    var a = toCreation(y);
    return a > 0 ? a + ' ' + T('toCreation') : '—';
  }

  function canaanLabel(y) {
    var c = toCanaan(y);
    if (c >= 1) return c + ' ' + T('toEntry');
    return (1 - c) + ' ' + T('beforeEntry');
  }

  /* מחרוזת מלאה לשלושת המניינים */
  function fullLabel(y) {
    return gregLabel(y) + ' · ' + creationLabel(y) + ' · ' + canaanLabel(y);
  }

  /* פירוש קלט חופשי של המשתמש בחיפוש שנה: "586-", "1948", "3665 לכניסה" */
  function parseYear(str) {
    if (!str) return null;
    var s = String(str).trim();
    var m;
    if ((m = s.match(/^(\d+)\s*(?:לכניסה|לכנען)$/))) return fromCanaan(+m[1]);
    if ((m = s.match(/^(\d+)\s*(?:לבריאה|לבריאת העולם)$/))) return fromCreation(+m[1]);
    if ((m = s.match(/^(\d+)\s*(?:לפנה"?ס|לפני הספירה|לפנהייס|bce|bc)$/i))) return 1 - (+m[1]);
    if ((m = s.match(/^-\s*(\d+)$/)) || (m = s.match(/^(\d+)\s*-$/))) return 1 - (+m[1]);
    if ((m = s.match(/^(\d+)$/))) return +m[1];
    return null;
  }

  global.Chrono = {
    CANAAN_OFFSET: CANAAN_OFFSET,
    CREATION_OFFSET: CREATION_OFFSET,
    FIRST_YEAR: FIRST_YEAR,
    LAST_YEAR: LAST_YEAR,
    toCanaan: toCanaan,
    toCreation: toCreation,
    fromCanaan: fromCanaan,
    fromCreation: fromCreation,
    gregLabel: gregLabel,
    creationLabel: creationLabel,
    canaanLabel: canaanLabel,
    fullLabel: fullLabel,
    parseYear: parseYear
  };
})(window);
