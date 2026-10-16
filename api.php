<?php
/* Atelier — stockage des projets sur le serveur.
   Les données sont rangées HORS du dossier du site (../atelier-data), pour que les
   mises à jour automatiques depuis GitHub ne les touchent jamais.
   L'accès est protégé par le même mot de passe que le reste de l'atelier (.htaccess). */
header('Cache-Control: no-store');
$dir = getenv('ATELIER_DATA') ? getenv('ATELIER_DATA') : dirname(__DIR__) . '/atelier-data';
foreach (array($dir, $dir . '/docs', $dir . '/blobs') as $d) { if (!is_dir($d)) @mkdir($d, 0700, true); }
if (!is_dir($dir . '/docs')) out(500, array('error' => 'dossier de stockage impossible à créer'));

function out($code, $data) { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function okid($s) { return is_string($s) && preg_match('/^[A-Za-z0-9._-]{1,120}$/', $s); }
function now_ms() { return (int) round(microtime(true) * 1000); }

$lock = fopen($dir . '/.lock', 'c');
function idx_read() { global $dir; $f = $dir . '/index.json'; if (!is_file($f)) return array('docs' => array(), 'blobs' => array()); $j = json_decode(file_get_contents($f), true); if (!is_array($j)) $j = array(); if (!isset($j['docs'])) $j['docs'] = array(); if (!isset($j['blobs'])) $j['blobs'] = array(); return $j; }
function idx_write($j) { global $dir; $tmp = $dir . '/index.json.tmp'; file_put_contents($tmp, json_encode($j, JSON_UNESCAPED_UNICODE)); rename($tmp, $dir . '/index.json'); }

$a = isset($_GET['a']) ? $_GET['a'] : '';
$id = isset($_GET['id']) ? $_GET['id'] : '';

if ($a === 'list') {
  flock($lock, LOCK_SH); $j = idx_read(); flock($lock, LOCK_UN);
  out(200, array('now' => now_ms(), 'docs' => (object) $j['docs'], 'blobs' => (object) $j['blobs']));
}

if ($a === 'get') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $f = $dir . '/docs/' . $id . '.json';
  if (!is_file($f)) out(404, array('error' => 'introuvable'));
  flock($lock, LOCK_SH); $j = idx_read(); flock($lock, LOCK_UN);
  $m = isset($j['docs'][$id]) ? $j['docs'][$id] : array();
  header('Content-Type: application/json; charset=utf-8');
  header('X-Rev: ' . (isset($m['rev']) ? $m['rev'] : 0));
  readfile($f); exit;
}

if ($a === 'put' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $body = file_get_contents('php://input');
  if ($body === false || $body === '') out(400, array('error' => 'contenu vide'));
  $base = isset($_GET['base']) ? (int) $_GET['base'] : 0;
  $force = !empty($_GET['force']);
  flock($lock, LOCK_EX);
  $j = idx_read();
  $cur = isset($j['docs'][$id]) ? $j['docs'][$id] : null;
  $rev = $cur ? (int) $cur['rev'] : 0;
  if ($cur && empty($cur['deleted']) && !$force && $base !== $rev) { flock($lock, LOCK_UN); out(409, array('error' => 'conflit', 'rev' => $rev, 'updated' => $cur['updated'])); }
  file_put_contents($dir . '/docs/' . $id . '.json', $body);
  $meta = array(
    'app' => isset($_GET['app']) ? substr($_GET['app'], 0, 40) : '',
    'name' => isset($_GET['name']) ? (function_exists('mb_substr') ? mb_substr($_GET['name'], 0, 200) : substr($_GET['name'], 0, 200)) : $id,
    'rev' => $rev + 1, 'updated' => now_ms(), 'size' => strlen($body)
  );
  $j['docs'][$id] = $meta; idx_write($j); flock($lock, LOCK_UN);
  out(200, $meta);
}

if ($a === 'del' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  flock($lock, LOCK_EX);
  $j = idx_read();
  $cur = isset($j['docs'][$id]) ? $j['docs'][$id] : array('app' => '', 'name' => $id, 'rev' => 0);
  @unlink($dir . '/docs/' . $id . '.json');
  $cur['deleted'] = true; $cur['rev'] = (int) $cur['rev'] + 1; $cur['updated'] = now_ms(); $cur['size'] = 0;
  $j['docs'][$id] = $cur; idx_write($j); flock($lock, LOCK_UN);
  out(200, $cur);
}

if ($a === 'putblob' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $in = fopen('php://input', 'rb'); $o = fopen($dir . '/blobs/' . $id, 'wb'); $n = stream_copy_to_stream($in, $o); fclose($o); fclose($in);
  flock($lock, LOCK_EX); $j = idx_read();
  $j['blobs'][$id] = array('size' => $n, 'type' => isset($_GET['type']) ? substr($_GET['type'], 0, 60) : '', 'updated' => now_ms());
  idx_write($j); flock($lock, LOCK_UN);
  out(200, $j['blobs'][$id]);
}

if ($a === 'getblob') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $f = $dir . '/blobs/' . $id;
  if (!is_file($f)) out(404, array('error' => 'introuvable'));
  flock($lock, LOCK_SH); $j = idx_read(); flock($lock, LOCK_UN);
  $t = isset($j['blobs'][$id]['type']) && $j['blobs'][$id]['type'] ? $j['blobs'][$id]['type'] : 'application/octet-stream';
  header('Content-Type: ' . $t); header('Content-Length: ' . filesize($f));
  readfile($f); exit;
}

out(400, array('error' => 'action inconnue'));
