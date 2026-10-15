<?php
$fichier = '/home/rdutemps/.htpasswd-applis';
$msg = ''; $ok = false;
if (file_exists($fichier)) {
  $msg = 'Le mot de passe est déjà défini. Cette page est désactivée.';
  $ok = true;
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $u = trim($_POST['u'] ?? ''); $p = $_POST['p'] ?? ''; $p2 = $_POST['p2'] ?? '';
  if (!preg_match('/^[A-Za-z0-9._-]{2,32}$/', $u)) $msg = 'Nom d’utilisateur : lettres, chiffres, point, tiret (2 à 32 caractères).';
  elseif (strlen($p) < 8) $msg = 'Mot de passe : 8 caractères minimum.';
  elseif ($p !== $p2) $msg = 'Les deux mots de passe ne correspondent pas.';
  elseif (file_put_contents($fichier, $u . ':' . password_hash($p, PASSWORD_BCRYPT) . "\n", LOCK_EX) === false) $msg = 'Impossible d’écrire le fichier sur le serveur.';
  else { @chmod($fichier, 0640); $msg = 'C’est enregistré. Tu peux prévenir Claude.'; $ok = true; }
}
?><!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Réglage de l’accès</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#f1efea;color:#1d1d1f;margin:0;padding:40px 16px}main{max-width:380px;margin:auto;background:#fff;border:1px solid #e3e0d9;border-radius:10px;padding:20px}h1{font-size:18px;margin:0 0 12px}label{display:block;margin:10px 0 4px;font-size:13px;color:#77756f}input{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #e3e0d9;border-radius:6px}button{margin-top:16px;width:100%;font:inherit;padding:9px;border:0;border-radius:6px;background:#1d1d1f;color:#fff;cursor:pointer}.m{margin-top:12px;padding:8px 10px;border-radius:6px;background:#f7f6f2}</style></head>
<body><main><h1>Accès à l’atelier</h1>
<?php if ($msg) echo '<div class="m">' . htmlspecialchars($msg) . '</div>'; ?>
<?php if (!$ok): ?>
<form method="post" autocomplete="off">
<label>Nom d’utilisateur</label><input name="u" required>
<label>Mot de passe</label><input name="p" type="password" required>
<label>Confirmer le mot de passe</label><input name="p2" type="password" required>
<button>Enregistrer</button>
</form>
<?php endif; ?>
</main></body></html>
