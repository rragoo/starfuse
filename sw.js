// The game used to run at starfuse.app with an offline service worker (the game's public/sw.js). The site is now the
// game's landing page, so this replacement removes that worker and everything it cached, the next time a browser
// that still has it checks for an update. Keep it here: browsers can hold the old worker for a long time.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
