<?php
/* Atelier — stockage des projets sur le serveur.
   Les données sont rangées HORS du dossier du site (../atelier-data), pour que les
   mises à jour automatiques depuis GitHub ne les touchent jamais.
   L'accès est protégé par le même mot de passe que le reste de l'atelier (.htaccess). */
header('Cache-Control: no-store');
@ini_set('display_errors', '0');// un avertissement affiché casserait les réponses JSON (et leur code d'erreur)
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
  // historique : on garde la version remplacée quand un autre appareil écrit par-dessus, quand on revient à une
  // ancienne version, et au moins une toutes les 15 minutes (30 versions au plus par document)
  $dev = isset($_GET['dev']) ? substr(preg_replace('/[^A-Za-z0-9]/', '', $_GET['dev']), 0, 20) : '';
  $f = $dir . '/docs/' . $id . '.json';
  if ($cur && empty($cur['deleted']) && is_file($f)) {
    $vd = $dir . '/versions/' . $id; if (!is_dir($vd)) @mkdir($vd, 0700, true);
    $vi = is_file($vd . '/index.json') ? json_decode(file_get_contents($vd . '/index.json'), true) : array(); if (!is_array($vi)) $vi = array();
    $lastAt = 0; foreach ($vi as $v) $lastAt = max($lastAt, (int) $v['saved']);
    $prevDev = isset($cur['dev']) ? $cur['dev'] : '';
    if (!empty($_GET['keep']) || ($dev !== '' && $prevDev !== '' && $dev !== $prevDev) || now_ms() - $lastAt > 15 * 60 * 1000) {
      @copy($f, $vd . '/' . $rev . '.json');
      $vi[] = array('rev' => $rev, 'updated' => (int) $cur['updated'], 'dev' => $prevDev, 'size' => (int) $cur['size'], 'saved' => now_ms());
      while (count($vi) > 30) { $old = array_shift($vi); @unlink($vd . '/' . $old['rev'] . '.json'); }
      file_put_contents($vd . '/index.json', json_encode($vi));
    }
  }
  file_put_contents($f, $body);
  $meta = array(
    'app' => isset($_GET['app']) ? substr($_GET['app'], 0, 40) : '',
    'name' => isset($_GET['name']) ? (function_exists('mb_substr') ? mb_substr($_GET['name'], 0, 200) : substr($_GET['name'], 0, 200)) : $id,
    'rev' => $rev + 1, 'updated' => now_ms(), 'size' => strlen($body), 'dev' => $dev
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
  header('Content-Type: ' . $t);
  readfile($f); exit;
}

if ($a === 'versions') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $vf = $dir . '/versions/' . $id . '/index.json';
  $vi = is_file($vf) ? json_decode(file_get_contents($vf), true) : array();
  out(200, array('items' => is_array($vi) ? $vi : array()));
}
if ($a === 'getver') {
  $v = isset($_GET['v']) ? (int) $_GET['v'] : -1;
  if (!okid($id) || $v < 0) out(400, array('error' => 'identifiant invalide'));
  $p = $dir . '/versions/' . $id . '/' . $v . '.json'; if (!is_file($p)) out(404, array('error' => 'introuvable'));
  header('Content-Type: application/json; charset=utf-8'); readfile($p); exit;
}

/* boîte de réception d'un document : photos envoyées depuis le portable (« Envoyer un dessin ») */
function inbox_dir($id) { global $dir; return $dir . '/inbox/' . $id; }
if ($a === 'inbox_put' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $d = inbox_dir($id); if (!is_dir($d)) @mkdir($d, 0700, true);
  if (!is_dir($d) || !is_writable($d)) out(500, array('error' => 'dossier de réception impossible à créer sur le serveur'));
  $t = isset($_GET['type']) ? $_GET['type'] : 'image/jpeg';
  $ext = $t === 'image/png' ? 'png' : 'jpg';
  $body = file_get_contents('php://input');
  $n = ($body === false) ? 0 : strlen($body);
  if ($n < 1) out(400, array('error' => 'envoi vide ou trop lourd pour le serveur (' . ini_get('post_max_size') . ' au plus)'));
  // envoi en plusieurs morceaux (les hébergeurs limitent la taille d'une requête) : up = identifiant, part / of
  $up = isset($_GET['up']) ? preg_replace('/[^a-z0-9]/', '', substr($_GET['up'], 0, 20)) : '';
  $part = isset($_GET['part']) ? (int) $_GET['part'] : 0; $of = isset($_GET['of']) ? (int) $_GET['of'] : 1;
  if ($up !== '' && $of > 1) {
    $tmp = $d . '/.up-' . $up; if ($part === 0) @unlink($tmp);
    if (@file_put_contents($tmp, $body, FILE_APPEND) === false) out(500, array('error' => 'écriture impossible sur le serveur'));
    if ($part < $of - 1) out(200, array('ok' => true, 'part' => $part));
    $body = file_get_contents($tmp); @unlink($tmp); $n = strlen($body);
  }
  if ($n < 100) out(400, array('error' => 'image vide'));
  $f = sprintf('%.0f', microtime(true) * 1000) . '-' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
  if (@file_put_contents($d . '/' . $f, $body) !== $n) { @unlink($d . '/' . $f); out(500, array('error' => 'écriture impossible sur le serveur')); }
  $name = isset($_GET['name']) ? preg_replace('/[^\p{L}\p{N} ._-]/u', '', substr($_GET['name'], 0, 80)) : '';
  if ($name !== '') file_put_contents($d . '/' . $f . '.name', $name);
  if (isset($_GET['vx']) && strlen($_GET['vx']) < 4000 && json_decode($_GET['vx']) !== null) file_put_contents($d . '/' . $f . '.vx', $_GET['vx']);
  out(200, array('ok' => true, 'f' => $f, 'size' => $n));
}
if ($a === 'inbox_list') {
  if (!okid($id)) out(400, array('error' => 'identifiant invalide'));
  $d = inbox_dir($id); $l = array();
  if (is_dir($d)) foreach (scandir($d) as $f) { if (!preg_match('/^\d+-[a-f0-9]+\.(jpg|png)$/', $f)) continue; $nf = $d . '/' . $f . '.name'; $vf = $d . '/' . $f . '.vx';
    $l[] = array('f' => $f, 'size' => filesize($d . '/' . $f), 'at' => (int) $f, 'name' => is_file($nf) ? file_get_contents($nf) : '', 'vx' => is_file($vf) ? json_decode(file_get_contents($vf)) : null); }
  out(200, array('items' => $l));
}
if ($a === 'inbox_diag') {
  $b = $dir . '/inbox'; $o = array('dir' => is_dir($b), 'writable' => is_dir($b) ? is_writable($b) : is_writable($dir), 'post_max_size' => ini_get('post_max_size'), 'upload_max_filesize' => ini_get('upload_max_filesize'), 'php' => PHP_VERSION, 'int' => PHP_INT_SIZE, 'items' => array());
  if (is_dir($b)) foreach (scandir($b) as $d) { if ($d[0] === '.') continue; $o['items'][$d] = is_dir($b . '/' . $d) ? array_values(array_diff(scandir($b . '/' . $d), array('.', '..'))) : 'fichier'; }
  out(200, $o);
}
if ($a === 'inbox_all') {
  // tous les documents qui ont des envois en attente (pour proposer une photo envoyée vers un autre document)
  flock($lock, LOCK_SH); $j = idx_read(); flock($lock, LOCK_UN); $o = array(); $base = $dir . '/inbox';
  if (is_dir($base)) foreach (scandir($base) as $d) { if (!okid($d) || !is_dir($base . '/' . $d)) continue; $n = 0;
    foreach (scandir($base . '/' . $d) as $f) if (preg_match('/^\d+-[a-f0-9]+\.(jpg|png)$/', $f)) $n++;
    if ($n) $o[$d] = array('n' => $n, 'app' => isset($j['docs'][$d]['app']) ? $j['docs'][$d]['app'] : '', 'name' => isset($j['docs'][$d]['name']) ? $j['docs'][$d]['name'] : $d); }
  out(200, array('docs' => (object) $o));
}
if ($a === 'inbox_get') {
  $f = isset($_GET['f']) ? $_GET['f'] : '';
  if (!okid($id) || !preg_match('/^\d+-[a-f0-9]+\.(jpg|png)$/', $f)) out(400, array('error' => 'identifiant invalide'));
  $p = inbox_dir($id) . '/' . $f; if (!is_file($p)) out(404, array('error' => 'introuvable'));
  header('Content-Type: ' . (substr($f, -3) === 'png' ? 'image/png' : 'image/jpeg')); readfile($p); exit;
}
if ($a === 'inbox_del' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $f = isset($_GET['f']) ? $_GET['f'] : '';
  if (!okid($id) || !preg_match('/^\d+-[a-f0-9]+\.(jpg|png)$/', $f)) out(400, array('error' => 'identifiant invalide'));
  $p = inbox_dir($id) . '/' . $f; @unlink($p); @unlink($p . '.name'); @unlink($p . '.vx'); @rmdir(inbox_dir($id));
  out(200, array('ok' => true));
}

out(400, array('error' => 'action inconnue'));
