/* Atelier — fonctionnement hors connexion.
   Pages : réseau d'abord (pour avoir la dernière version), copie locale si pas de connexion.
   Scripts de l'atelier : réseau d'abord aussi. Grosses bibliothèques et polices : copie locale d'abord. */
const VERSION = 'atelier-v121';
const PRECACHE = [
  '/', '/riso/', '/vecto/', '/compil/', '/plan/', '/photo/', '/dossiers/', '/paysage/',
  '/vecto/potrace-worker.js', '/lib/sync.js','/lib/tabs.js', '/lib/help.js',
  '/lib/paper-core.min.js', '/lib/clipper.js', '/lib/jspdf.umd.min.js', '/lib/svg2pdf.umd.min.js',
  '/lib/pdf.min.js', '/lib/pdf.worker.min.js', '/lib/pdf-lib.min.js',
  '/lib/toastui-editor-all.min.js', '/lib/toastui-editor.css', '/lib/docx.iife.js', '/lib/fonts.css',
  '/lib/fonts/dm-serif-display-latin-400-italic.woff2', '/lib/fonts/dm-serif-display-latin-400-normal.woff2', '/lib/fonts/fraunces-latin-400-italic.woff2', '/lib/fonts/fraunces-latin-400-normal.woff2', '/lib/fonts/fraunces-latin-700-italic.woff2', '/lib/fonts/fraunces-latin-700-normal.woff2', '/lib/fonts/ibm-plex-sans-latin-400-italic.woff2', '/lib/fonts/ibm-plex-sans-latin-400-normal.woff2', '/lib/fonts/ibm-plex-sans-latin-700-italic.woff2', '/lib/fonts/ibm-plex-sans-latin-700-normal.woff2', '/lib/fonts/inter-latin-400-italic.woff2', '/lib/fonts/inter-latin-400-normal.woff2', '/lib/fonts/inter-latin-700-italic.woff2', '/lib/fonts/inter-latin-700-normal.woff2', '/lib/fonts/space-grotesk-latin-400-normal.woff2', '/lib/fonts/space-grotesk-latin-700-normal.woff2', '/lib/fonts/syne-latin-400-normal.woff2', '/lib/fonts/syne-latin-700-normal.woff2', '/lib/fonts/work-sans-latin-400-italic.woff2', '/lib/fonts/work-sans-latin-400-normal.woff2', '/lib/fonts/work-sans-latin-700-italic.woff2', '/lib/fonts/work-sans-latin-700-normal.woff2',
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
  if (url.pathname.startsWith('/p/') || url.pathname === '/login.php') return; // pages publiques et connexion : toujours le réseau
  const key = keyFor(req);
  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    // pages : la requête du navigateur telle quelle (le plus sûr), la copie locale seulement si le réseau ne répond pas
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('délai')), 10000))]);
        if (res && res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(key) || await cache.match(key + '/');
        return hit || new Response('<!doctype html><meta charset="utf-8"><title>Hors connexion</title><body style="font:15px system-ui;padding:40px">Cette page n’a pas encore été ouverte avec une connexion sur cet appareil. <a href="/">Retour</a></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // grosses bibliothèques et polices (elles ne changent pas) : copie locale d'abord
  const stable = /\/lib\/fonts\/|\.min\.(js|css)$|\/lib\/(pdf\.worker\.min|docx\.iife|clipper)\.js$|\.woff2$|\/icons\//.test(url.pathname);
  if (stable) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(key);
      const update = fetch(req).then(res => { if (res.ok && !res.redirected) cache.put(key, res.clone()); return res; }).catch(() => null);
      if (hit) { event.waitUntil(update); return hit; }
      const res = await update;
      return res || new Response('', { status: 504 });
    })());
    return;
  }
  // le reste (scripts de l'atelier, réglages…) : toujours la dernière version, copie locale seulement hors connexion
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(req, { signal: ctrl.signal, cache: 'no-cache' });
      clearTimeout(t);
      if (res.ok && !res.redirected) cache.put(key, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(key);
      return hit || new Response('', { status: 504 });
    }
  })());
});
