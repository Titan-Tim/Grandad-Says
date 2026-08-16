/* Grandad's Play & Learn — service worker v5
   v4 used cache-first with no skipWaiting, which meant an iPad could stay on an
   old version for days after a deploy. This version takes over immediately and
   prefers the network for code, so a reload always picks up the latest build
   while still working fully offline. */
const CACHE = 'grandads-play-learn-v5';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./boepa-mascot.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const CODE = /\.(?:html|js|css|webmanifest)$/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const wantsFreshCode = req.mode === 'navigate' || CODE.test(new URL(req.url).pathname);

  if (wantsFreshCode) {
    // Network first, fall back to cache when offline or slow.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Images and everything else: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
