/*
 * Service Worker – מאפשר התקנה כאפליקציה (PWA) ועבודה אופליין מלאה.
 * מאחסן את כל קבצי האפליקציה במטמון, ומגיש אותם גם ללא רשת.
 */
const CACHE = "eng-app-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./data/words.js",
  "./data/words-extra.js",
  "./data/words-extra2.js",
  "./data/grammar.js",
  "./js/storage.js",
  "./js/scheduler.js",
  "./js/speech.js",
  "./js/ipa2heb.js",
  "./js/council.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

// התקנה – אחסון מוקדם של כל הקבצים
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// הפעלה – ניקוי מטמונים ישנים
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// שליפה – קודם מהמטמון, אחרת מהרשת (ושמירה במטמון לפעם הבאה)
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // אחסון קבצים חדשים מאותו מקור (למשל words-wiktionary.js שנוסף מאוחר יותר)
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
