// Minimal service worker so Chrome treats Pest Panic as an installable app.
// It does not cache anything: every request goes straight to the network, so updates show up right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
