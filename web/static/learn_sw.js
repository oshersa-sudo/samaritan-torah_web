/* Service worker for the learning trainer (OnyxApps).
   NETWORK-FIRST so the newest code loads when online, falling back to the
   cache offline. /api/* always hits the network (live sync). */
const CACHE = 'learn-app-v6';
const SHELL = [
  '/exam',
  '/static/exam.css', '/static/exam.js',
  '/static/vocab_en.js', '/static/hebrew_data.js', '/static/hebrew_niqqud.js',
  '/static/science_data.js', '/static/curriculum.js', '/static/games_library.js',
  '/static/learn.webmanifest',
  '/static/sounds/sfx-correct.wav', '/static/sounds/sfx-wrong.wav', '/static/sounds/sfx-tap.wav',
  '/static/sounds/jingle-english.wav', '/static/sounds/jingle-hebrew.wav',
  '/static/sounds/jingle-math.wav', '/static/sounds/jingle-science.wav',
  '/static/sounds/celebrate.wav',
  '/static/img/onyx_learn_icon.svg',
  '/static/img/onyx_learn_icon-192.png', '/static/img/onyx_learn_icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;   // live data
  const cacheable = u.pathname.startsWith('/static/') || u.pathname === '/' || u.pathname === '/exam';
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok && cacheable) { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return resp;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('/exam')))
  );
});
