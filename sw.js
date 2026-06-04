// Share Beer – service worker
// Network-first for the app shell (so nye versjoner vises), cache-first for statiske filer.
// Bumb CACHE-versjonen når du vil tvinge ny cache.
const CACHE = 'sharebeer-v1';
const ASSETS = ['./', './index.html', './icon.png', './bakgrunnsbilde.JPEG', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La Firebase/CDN-kall gå rett til nett – ikke rør dem.
  if (url.origin !== location.origin) return;

  const isShell = req.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isShell) {
    // Network-first: hent ferskt, fall tilbake til cache offline.
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Cache-first for statiske ressurser (ikon, bakgrunn, manifest).
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
