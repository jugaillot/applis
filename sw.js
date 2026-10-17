/* Atelier — fonctionnement hors connexion.
   Pages : réseau d'abord (pour avoir la dernière version), copie locale si pas de connexion.
   Bibliothèques et autres fichiers : copie locale d'abord, mise à jour en arrière-plan. */
const VERSION = 'atelier-v3';
const PRECACHE = [
  '/', '/riso/', '/vecto/', '/compil/', '/plan/',
  '/vecto/potrace-worker.js', '/lib/sync.js',
  '/lib/paper-core.min.js', '/lib/jspdf.umd.min.js', '/lib/svg2pdf.umd.min.js',
  '/lib/pdf.min.js', '/lib/pdf.worker.min.js', '/lib/pdf-lib.min.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(PRECACHE.map(async url => {
      try {
        const res = await fetch(url, { credentials: 'include', cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* on réessaiera au prochain passage */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function keyFor(req) {
  const u = new URL(req.url);
  let path = u.pathname;
  if (path.endsWith('/index.html')) path = path.slice(0, -10);
  return path;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api.php') return; // la synchronisation passe toujours par le réseau
  const key = keyFor(req);
  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(req, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(key) || await cache.match(key + '/');
        return hit || new Response('<!doctype html><meta charset="utf-8"><title>Hors connexion</title><body style="font:15px system-ui;padding:40px">Cette page n’a pas encore été ouverte avec une connexion sur cet appareil.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(key);
    const update = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { event.waitUntil(update); return hit; }
    const res = await update;
    return res || new Response('', { status: 504 });
  })());
});
