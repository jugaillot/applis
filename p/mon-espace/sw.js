/* Mon espace — lanceur : ce service worker ne met rien en cache, il rend seulement l'appli installable. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
