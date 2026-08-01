/* Service worker: NETWORK-FIRST so the app always loads the latest code when
   online (an earlier cache-first version served stale assets after updates),
   falling back to the cache only when offline. /api/* always hits the network. */
const CACHE = 'torah-web-v152';
// reading recordings live in their OWN cache: cache-first (immutable files) and
// NEVER deleted on app updates — once a chapter was played on a device, it keeps
// playing there even if the file is later removed from the server.
const AUDIO_CACHE = 'torah-audio-v1';
const SHELL = [
  '/', '/static/style.css', '/static/app.js', '/manifest.json',
  '/static/img/icon-192.png', '/static/img/icon-512.png',
  '/static/img/app_icon.png', '/static/img/torah_scroll_nobg.png',
  '/static/img/icon_book_dark.png', '/static/img/icon_portion_dark.png',
  '/static/img/background.jpg', '/static/img/splash_elder.jpg',
  '/static/img/quill_hand.png',
  '/fonts/SBL_Hbrw.ttf', '/fonts/Sam_font.ttf',
  '/fonts/Amiri-Regular.ttf', '/fonts/CharisSIL-Regular.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== AUDIO_CACHE)
                              .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;  // live data

  // reading recordings: CACHE-FIRST from the persistent audio cache. We fetch by
  // bare path (never forwarding a Range header) so a complete 200 is stored; media
  // elements accept a full 200 in answer to a range request.
  if (u.pathname.startsWith('/static/audio/readings/') && u.pathname.endsWith('.mp3')) {
    e.respondWith(caches.open(AUDIO_CACHE).then(async c => {
      const hit = await c.match(u.pathname);
      if (hit) return hit;
      const resp = await fetch(u.pathname);
      if (resp.status === 200) c.put(u.pathname, resp.clone());
      return resp;
    }).catch(() => caches.match(u.pathname)));
    return;
  }

  const cacheable = u.pathname.startsWith('/static/') ||
                    u.pathname.startsWith('/fonts/') || u.pathname === '/';
  e.respondWith(
    fetch(e.request).then(resp => {                 // network first
      if (resp.ok && cacheable) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('/')))
  );
});
