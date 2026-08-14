/* Service worker: NETWORK-FIRST so the app always loads the latest code when
   online (an earlier cache-first version served stale assets after updates),
   falling back to the cache only when offline. /api/* always hits the network. */
const CACHE = 'torah-web-v203';
const SHELL = [
  '/', '/static/style.css', '/static/app.js', '/manifest.json',
  '/static/maintenance.html',
  '/static/img/icon-192.png', '/static/img/icon-512.png',
  '/static/img/app_icon.png', '/static/img/torah_scroll_nobg.png',
  '/static/img/icon_book_dark.png', '/static/img/icon_portion_dark.png',
  '/static/img/background.jpg', '/static/img/splash_elder.jpg',
  '/static/img/quill_hand.png',
  '/fonts/SBL_Hbrw.ttf', '/fonts/Sam_font.ttf',
  '/fonts/Amiri-Regular.ttf', '/fonts/CharisSIL-Regular.ttf',
  '/fonts/ben-nor23.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // delete every other cache — including the old 'torah-audio-v1' persistent
  // audio cache from earlier builds, so stale recording cuts leave all devices
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;  // live data

  // reading recordings: NETWORK ONLY, never stored on the device — every play
  // streams the current file from the server, so updated cuts reach everyone.
  if (u.pathname.startsWith('/static/audio/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  const cacheable = u.pathname.startsWith('/static/') ||
                    u.pathname.startsWith('/fonts/') || u.pathname === '/';
  const isNav = e.request.mode === 'navigate';

  e.respondWith(
    fetch(e.request).then(resp => {                 // network first
      // A deploying/restarting Render instance answers 5xx rather than refusing
      // the connection; treat that as "server is down" too, otherwise the error
      // page would be cached and shown as if it were the app.
      if (isNav && resp.status >= 500) throw new Error('server ' + resp.status);
      if (resp.ok && cacheable) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => {
      // Page load failed. If the DEVICE is offline this is ordinary offline use
      // and the cached app should still open (that is the whole point of the
      // PWA). If the device is online, the server itself is unreachable — a
      // deploy or an outage — so show the maintenance page instead of the blank
      // screen a half-loaded shell would produce.
      if (isNav && self.navigator.onLine) {
        return caches.match('/static/maintenance.html')
                     .then(hit => hit || caches.match('/'));
      }
      return caches.match(e.request).then(hit => hit || caches.match('/'));
    })
  );
});
