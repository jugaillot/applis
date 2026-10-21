<?php
/* Atelier — page de connexion. Le navigateur peut enregistrer l'identifiant et le mot de passe,
   et l'atelier reste connecté sur cet appareil (cookie de longue durée). */
require __DIR__ . '/auth.inc.php';
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$r = isset($_REQUEST['r']) ? $_REQUEST['r'] : $base . '/';
if (!is_string($r) || $r === '' || $r[0] !== '/' || (strlen($r) > 1 && ($r[1] === '/' || $r[1] === '\\'))) $r = $base . '/';
if (strpos($r, '/login.php') !== false) $r = $base . '/';

if (isset($_GET['logout'])) { atelier_clear_cookie(); header('Location: ' . $base . '/login.php?bye=1'); exit; }
if (atelier_session() && $_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['bye'])) { header('Location: ' . $r); exit; }

$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $u = isset($_POST['u']) ? trim($_POST['u']) : '';
  $p = isset($_POST['p']) ? $_POST['p'] : '';
  if ($u !== '' && atelier_check_password($u, $p)) { atelier_set_cookie($u); header('Location: ' . $r, true, 303); exit; }
  usleep(800000);
  $err = 'Identifiant ou mot de passe incorrect.';
}
header('Cache-Control: no-store');
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atelier — connexion</title>
<meta name="theme-color" content="#fff3d6">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d1f;background:#fff3d6;display:flex;align-items:center;justify-content:center;padding:16px}
form{background:#fff;border-radius:16px;padding:28px 26px;width:100%;max-width:360px;box-shadow:0 10px 40px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:12px}
h1{margin:0 0 4px;font-size:22px}h1 span{color:#e89a2c}
label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#77756f}
input{font:inherit;color:#1d1d1f;border:1px solid #e3e0d9;border-radius:9px;padding:10px 12px;background:#fff}
input:focus{outline:2px solid #e89a2c;border-color:transparent}
button{font:inherit;font-weight:600;border:0;border-radius:9px;padding:11px;background:#1d1d1f;color:#fff;cursor:pointer;margin-top:4px}
.err{color:#b3261e;font-size:13px}.ok{color:#1f8a4c;font-size:13px}.muted{color:#77756f;font-size:12px}
</style></head><body>
<form method="post" action="<?php echo htmlspecialchars($base . '/login.php'); ?>" autocomplete="on">
  <h1>Atelier <span>·</span></h1>
  <?php if ($err) echo '<div class="err">' . htmlspecialchars($err) . '</div>'; ?>
  <?php if (isset($_GET['bye'])) echo '<div class="ok">Tu es déconnecté sur cet appareil.</div>'; ?>
  <input type="hidden" name="r" value="<?php echo htmlspecialchars($r); ?>">
  <label>Identifiant<input name="u" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus value="<?php echo isset($_POST['u']) ? htmlspecialchars($_POST['u']) : ''; ?>"></label>
  <label>Mot de passe<input name="p" type="password" autocomplete="current-password" required></label>
  <button type="submit">Se connecter</button>
  <div class="muted">Une fois connecté, l’atelier reste ouvert sur cet appareil. Ton navigateur peut aussi enregistrer l’identifiant et le mot de passe.</div>
</form>
</body></html>
