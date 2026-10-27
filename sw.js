// Starfuse offline support.
//  - Pages: network first, so players always get the newest version when online; the saved copy is
//    only a fallback offline. (Serving the saved page first broke the game after updates: an old
//    page could point at a game file that a newer deploy no longer had.)
//  - Hashed game files (assets/): cache first; a given file name never changes content.
//  - Everything else of ours and Google Fonts: serve the saved copy, refresh it in the background.
// Bump CACHE to drop every player's saved files at once.
const CACHE = 'starfuse-v3';
const CORE = ['./', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  // The game page is saved as './' whatever its query (challenge links carry one); other pages
  // (stats.html) under their own path, so they never replace the game's offline copy.
  const path = new URL(req.url).pathname;
  const key = /\/(index\.html)?$/.test(path) ? './' : path;
  try {
    // no-cache: revalidate with the server instead of trusting the browser's 10-minute HTTP cache.
    const res = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }));
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !font) return; // leaderboard and other APIs: always network
  if (url.pathname.includes('/preview/')) return; // the preview build (npm run build:preview) is never saved
  if (req.mode === 'navigate') e.respondWith(networkFirst(req));
  else if (url.pathname.includes('/assets/')) e.respondWith(cacheFirst(req));
  else e.respondWith(staleWhileRevalidate(req));
});
