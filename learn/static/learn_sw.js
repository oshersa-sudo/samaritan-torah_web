/* Service worker for the learning trainer (OnyxApps).
   NETWORK-FIRST so the newest code loads when online, falling back to the
   cache offline. /api/* always hits the network (live sync). */
const CACHE = 'learn-app-v38';
const SHELL = [
  '/exam',
  '/static/exam.css', '/static/exam.js',
  '/static/vocab_en.js', '/static/hebrew_data.js', '/static/hebrew_niqqud.js',
  '/static/heb_lex.js', '/static/torah_data.js', '/static/lashon_data.js',
  '/static/science_data.js', '/static/geo_data.js', '/static/hist_data.js', '/static/curriculum.js', '/static/games_library.js',
  '/static/learn.webmanifest',
  '/static/sounds/sfx-correct.mp3', '/static/sounds/sfx-wrong.mp3', '/static/sounds/sfx-tap.wav',
  '/static/sounds/jingle-english.wav', '/static/sounds/jingle-hebrew.wav',
  '/static/sounds/jingle-math.wav', '/static/sounds/jingle-science.wav',
  '/static/sounds/celebrate.mp3',
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

// ── Practice reminders on the child's own device (works with screen locked) ──
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: 'Onyx לימודי', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Onyx לימודי 🎯', {
    body: d.body || 'זמן לתרגל!', dir: 'rtl', lang: 'he', tag: 'onyx-practice',
    renotify: true, data: { url: d.url || '/exam' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/exam';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    for (let i = 0; i < cl.length; i++) { if (cl[i].url.indexOf('/exam') >= 0 && 'focus' in cl[i]) return cl[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
