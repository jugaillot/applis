<?php
/* Atelier — connexion par cookie (remplace la fenêtre de mot de passe du navigateur).
   Identifiants : le même fichier .htpasswd qu'avant. Compatible PHP 7.3. */

function atelier_base() { return dirname(__DIR__); }
function atelier_htpasswd() { return getenv('ATELIER_HTPASSWD') ? getenv('ATELIER_HTPASSWD') : atelier_base() . '/.htpasswd-applis'; }
function atelier_datadir() { return getenv('ATELIER_DATA') ? getenv('ATELIER_DATA') : atelier_base() . '/atelier-data'; }
define('ATELIER_COOKIE', 'atelier_auth');
define('ATELIER_DAYS', 400); // durée maximale acceptée par les navigateurs

function atelier_secret() {
  $dir = atelier_datadir();
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  $f = $dir . '/.cle-connexion';
  if (!is_file($f)) { @file_put_contents($f, bin2hex(random_bytes(32))); @chmod($f, 0600); }
  $k = @file_get_contents($f);
  if (!$k) { http_response_code(500); exit('Impossible de créer la clé de connexion dans ' . $dir); }
  return trim($k);
}

/* ----- vérification des mots de passe du fichier .htpasswd ----- */
function atelier_apr1($pw, $salt) {
  $len = strlen($pw);
  $text = $pw . '$apr1$' . $salt;
  $bin = pack('H32', md5($pw . $salt . $pw));
  for ($i = $len; $i > 0; $i -= 16) $text .= substr($bin, 0, min(16, $i));
  for ($i = $len; $i > 0; $i >>= 1) $text .= ($i & 1) ? chr(0) : $pw[0];
  $bin = pack('H32', md5($text));
  for ($i = 0; $i < 1000; $i++) {
    $new = ($i & 1) ? $pw : $bin;
    if ($i % 3) $new .= $salt;
    if ($i % 7) $new .= $pw;
    $new .= ($i & 1) ? $bin : $pw;
    $bin = pack('H32', md5($new));
  }
  $tmp = '';
  for ($i = 0; $i < 5; $i++) {
    $k = $i + 6; $j = $i + 12; if ($j == 16) $j = 5;
    $tmp = $bin[$i] . $bin[$k] . $bin[$j] . $tmp;
  }
  $tmp = chr(0) . chr(0) . $bin[11] . $tmp;
  $tmp = strtr(strrev(substr(base64_encode($tmp), 2)),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  return '$apr1$' . $salt . '$' . $tmp;
}
function atelier_check_password($user, $pw) {
  $lines = @file(atelier_htpasswd(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if (!$lines) return false;
  foreach ($lines as $line) {
    $p = strpos($line, ':'); if ($p === false) continue;
    if (substr($line, 0, $p) !== $user) continue;
    $hash = trim(substr($line, $p + 1));
    if (strpos($hash, '$apr1$') === 0) { $parts = explode('$', $hash); return hash_equals($hash, atelier_apr1($pw, $parts[2])); }
    if (strpos($hash, '{SHA}') === 0) return hash_equals($hash, '{SHA}' . base64_encode(sha1($pw, true)));
    if (strpos($hash, '$2') === 0 || strpos($hash, '$1$') === 0 || strpos($hash, '$5$') === 0 || strpos($hash, '$6$') === 0) return password_verify($pw, $hash);
    return false;
  }
  return false;
}

/* ----- cookie signé ----- */
function atelier_b64($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function atelier_unb64($s) { return base64_decode(strtr($s, '-_', '+/')); }
function atelier_set_cookie($user) {
  $exp = time() + ATELIER_DAYS * 86400;
  $payload = atelier_b64($user) . '.' . $exp;
  $val = $payload . '.' . hash_hmac('sha256', $payload, atelier_secret());
  $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
  setcookie(ATELIER_COOKIE, $val, array('expires' => $exp, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax'));
}
function atelier_clear_cookie() { setcookie(ATELIER_COOKIE, '', array('expires' => 1, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax')); }
/* renvoie [utilisateur, expiration] si le cookie est valide, sinon null */
function atelier_session() {
  if (empty($_COOKIE[ATELIER_COOKIE])) return null;
  $parts = explode('.', $_COOKIE[ATELIER_COOKIE]);
  if (count($parts) !== 3) return null;
  $payload = $parts[0] . '.' . $parts[1];
  if (!hash_equals(hash_hmac('sha256', $payload, atelier_secret()), $parts[2])) return null;
  if ((int) $parts[1] < time()) return null;
  return array(atelier_unb64($parts[0]), (int) $parts[1]);
}
