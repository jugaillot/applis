<?php
/* Atelier — porte d'entrée : vérifie la connexion puis sert le fichier demandé. */
require __DIR__ . '/auth.inc.php';

$root = __DIR__;
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');           // si l'atelier n'est pas à la racine du site
if ($base !== '' && strpos($path, $base . '/') === 0) $path = substr($path, strlen($base));

$sess = atelier_session();
if (!$sess) {
  $mode = isset($_SERVER['HTTP_SEC_FETCH_MODE']) ? $_SERVER['HTTP_SEC_FETCH_MODE'] : '';
  $accept = isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
  $dest = isset($_SERVER['HTTP_SEC_FETCH_DEST']) ? $_SERVER['HTTP_SEC_FETCH_DEST'] : '';
  // une page (y compris rechargée par l'appli hors connexion, qui ne dit pas « navigate »)
  $isPage = $mode === 'navigate' || $dest === 'document' || strpos($accept, 'text/html') !== false;
  if ($isPage && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Cache-Control: no-store');
    header('Location: ' . $base . '/login.php?r=' . rawurlencode($_SERVER['REQUEST_URI']), true, 302);
    exit;
  }
  http_response_code(401); header('Cache-Control: no-store'); header('Content-Type: text/plain; charset=utf-8');
  exit('Connexion nécessaire');
}
// la connexion se prolonge toute seule tant que l'atelier est utilisé
if ($sess[1] - time() < (ATELIER_DAYS - 30) * 86400) atelier_set_cookie($sess[0]);

// chemin sûr : pas de « .. », pas de fichiers cachés
foreach (explode('/', $path) as $seg) {
  if ($seg !== '' && ($seg[0] === '.' || $seg === '..')) { http_response_code(404); exit('Introuvable'); }
}
$full = realpath($root . $path);
if ($full === false || strpos($full, $root) !== 0) { http_response_code(404); exit('Introuvable'); }

if (is_dir($full)) {
  if (substr($path, -1) !== '/') { header('Location: ' . $base . $path . '/' . (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : ''), true, 301); exit; }
  $full = rtrim($full, '/') . '/index.html';
  if (!is_file($full)) { http_response_code(404); exit('Introuvable'); }
}

$ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
if ($ext === 'php') {
  // seul api.php (synchronisation) s'exécute ; les autres fichiers PHP ne sont jamais servis
  if ($full === $root . '/api.php') { chdir($root); require $full; exit; }
  http_response_code(404); exit('Introuvable');
}

$types = array(
  'html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
  'js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
  'webmanifest' => 'application/manifest+json; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg',
  'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2', 'woff' => 'font/woff',
  'ttf' => 'font/ttf', 'otf' => 'font/otf', 'pdf' => 'application/pdf', 'txt' => 'text/plain; charset=utf-8', 'md' => 'text/plain; charset=utf-8',
  'wasm' => 'application/wasm', 'map' => 'application/json', 'xml' => 'application/xml', 'zip' => 'application/zip'
);
$mtime = filemtime($full); $size = filesize($full);
$etag = '"' . dechex($mtime) . '-' . dechex($size) . '"';
header('Content-Type: ' . (isset($types[$ext]) ? $types[$ext] : 'application/octet-stream'));
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
header('Cache-Control: private, no-cache');
header('X-Content-Type-Options: nosniff');
if ((isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag)) { http_response_code(304); exit; }
// pas de Content-Length : si le serveur compresse la réponse, une longueur annoncée fausse fait échouer Chrome (ERR_HTTP2_PROTOCOL_ERROR)
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
readfile($full);
