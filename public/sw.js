// Minimal service worker — kun til stede for PWA-installerbarhet.
//
// Handel i Børsliga krever nettforbindelse: denne workeren cacher IKKE
// sider, API-kall eller kursdata, og køer ingen forespørsler for senere
// sending. Alle fetch-kall går alltid direkte til nettverket.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
