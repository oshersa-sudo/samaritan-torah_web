/* אוצר השירה — מצב רכב: עובד שירות קטן ככל האפשר.
 *
 * טעמו היחיד הוא שהיחידה תיחשב אפליקציה ותוכל להיפתח בלי דפדפן. לכן הוא
 * שומר רק את המעטפת — העמוד, הסמלילים והמניפסט — ואינו נוגע בקטלוג ואינו
 * נוגע בשמע: אלו הולכים לרשת תמיד, שאחרת היה אפשר לשמוע אתמול.
 *
 * תחומו הוא /shira/car בלבד. היחידה הרגילה שב-/shira/ אינה נשלטת בידו.
 */
var CACHE = 'shira-car-v1';
var SHELL = ['car.html', 'car.webmanifest', 'img/car-icon.svg',
             'img/car-icon-192.png', 'img/car-icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL)['catch'](function () {});   // חסר אחד אינו מפיל הכול
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin !== location.origin) return;            // שרת המדיה — לעולם לא
  if (u.pathname.indexOf('/shira/api/') === 0) return;  // הקטלוג — תמיד מן הרשת
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    })['catch'](function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('car.html');
      });
    })
  );
});
