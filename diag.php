<?php
header('Content-Type: text/plain; charset=utf-8');
$f = '/home/rdutemps/.htpasswd-applis';
echo "existe: " . (file_exists($f) ? 'oui' : 'non') . "\n";
if (file_exists($f)) {
  echo "lisible: " . (is_readable($f) ? 'oui' : 'non') . "\n";
  echo "droits: " . substr(sprintf('%o', fileperms($f)), -4) . "\n";
  $l = trim(file_get_contents($f));
  echo "format: " . (preg_match('/^[^:]+:\$2y\$/', $l) ? 'bcrypt ok' : 'inattendu') . "\n";
}
echo "php: " . PHP_VERSION . "\n";
echo "serveur: " . ($_SERVER['SERVER_SOFTWARE'] ?? '?') . "\n";
