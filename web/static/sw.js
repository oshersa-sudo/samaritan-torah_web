/* Service worker: NETWORK-FIRST so the app always loads the latest code when
   online (an earlier cache-first version served stale assets after updates),
   falling back to the cache only when offline. /api/* always hits the network. */
const CACHE = 'torah-web-v344';
const SHELL = [
  '/', '/manifest.json',      // app.js + style.css are cached by the page's own
                             // versioned request; precaching them here fetched
                             // a second, unversioned copy of 640KB on every visit
  '/static/maintenance.html',
  '/static/img/icon-192.png', '/static/img/icon-512.png',
  '/static/img/icon-maskable-512.png',
  '/static/img/app_icon.png', '/static/img/torah_scroll_nobg.png',
  '/static/img/icon_book_dark.png', '/static/img/icon_portion_dark.png',
  '/static/img/background.jpg',
  '/fonts/SBL_Hbrw.ttf', '/fonts/Sam_font.ttf'
  // Amiri (Arabic), CharisSIL (transcription) and ben-nor23 (Samaritan
  // commentary) are cached the first time a screen actually asks for them —
  // precaching them cost every reader 200KB for pages most never open

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

/* ── התראות על תוכן חדש ───────────────────────────────────────────────────────
   The server sends one of these when something is added to an app (see
   web/push.py). It arrives whether or not the app is open, which is the whole
   point: the star on the circle is only seen by someone who is already here. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: (e.data && e.data.text()) || '' }; }
  const title = d.title || 'אבני שהם';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/static/img/icon-192.png',
    badge: '/static/img/icon-192.png',
    lang: d.lang || 'he',
    dir: (d.lang === 'en') ? 'ltr' : 'rtl',
    // one notification per app replaces the previous one for that app, so a
    // quiet week of additions does not pile up a tower on the lock screen
    tag: d.tag || 'news',
    renotify: true,
    data: { url: d.url || '/' }
  }));
});

/* A press opens the app — the window that is already open if there is one, so a
   reader is not given a second copy of it, and at the news of that app. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin) {
        return c.focus().then(() => c.navigate ? c.navigate(url) : null).catch(() => c.focus());
      }
    }
    return self.clients.openWindow(url);
  }));
});

/* The push service may retire a subscription on its own; ask for a new one with
   the same key so notifications do not stop silently. */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const r = await fetch('/api/push/key');
      const { key } = await r.json();
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: key
      });
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), lang: 'he' })
      });
    } catch (err) { /* nothing to be done from here */ }
  })());
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

  // A page load gets a second chance before anything is concluded: a restarting
  // server refuses one request and answers the next, and a reader reloading in
  // that half-second should not be shown a maintenance page.
  const tryFetch = () => fetch(e.request).catch(err => {
    if (!isNav) throw err;
    return new Promise(r => setTimeout(r, 900)).then(() => fetch(e.request));
  });

  e.respondWith(
    tryFetch().then(resp => {                       // network first
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
