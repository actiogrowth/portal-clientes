<?php
/* Cambiar mi contraseña. Para todos los usuarios, y obligatorio cuando la
 * contraseña es temporal (recién creada o reiniciada desde Configuración):
 * mientras tanto requerir_sesion() trae aquí cualquier página del portal.
 *
 * Pide la contraseña actual (la temporal, si es el caso) y la nueva dos
 * veces. Al guardar sube ver_clave: las demás sesiones abiertas de esa cuenta
 * se cortan, y esta se renueva.
 */
require __DIR__ . '/auth.php';

if (!sesion_activa()) {
    header('Location: /login.php?r=' . urlencode('/cambiar-clave.php'));
    exit;
}
$usuario = usuario_actual();
$c = cuenta_actual();
$obligatorio = !empty($c['cambiar_clave']);
$destino = destino_seguro($_GET['r'] ?? $_POST['r'] ?? '/');
$error = '';
$listo = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $actual = (string) ($_POST['actual'] ?? '');
    $nueva  = (string) ($_POST['nueva'] ?? '');
    $otra   = (string) ($_POST['repetir'] ?? '');
    if (!csrf_valido($_POST['csrf'] ?? null)) {
        $error = 'La página caducó. Vuelve a intentarlo.';
    } elseif (!password_verify($actual, $c['hash'])) {
        usleep(800000);
        $error = 'La contraseña actual no es correcta.';
    } elseif (strlen($nueva) < CLAVE_MINIMA) {
        $error = 'La contraseña nueva tiene que tener al menos ' . CLAVE_MINIMA . ' caracteres.';
    } elseif ($nueva !== $otra) {
        $error = 'Las dos contraseñas nuevas no coinciden.';
    } elseif ($nueva === $actual) {
        $error = 'La contraseña nueva tiene que ser distinta de la actual.';
    } else {
        try {
            $c = modificar_cuentas(function (array &$d) use ($usuario, $nueva) {
                $x = &$d['usuarios'][$usuario];
                $x['hash'] = password_hash($nueva, PASSWORD_DEFAULT);
                $x['cambiar_clave'] = false;
                $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;
                anotar_evento($d, $usuario, 'cambiar_clave', $usuario);
                return $x;
            });
            iniciar_sesion($usuario, $c);
            if ($obligatorio) { header('Location: ' . $destino); exit; }
            $listo = true;
        } catch (Throwable $e) {
            error_log('portal cambiar-clave: no se pudo guardar para ' . $usuario . ': ' . $e->getMessage());
            $error = 'No se pudo guardar la contraseña. Vuelve a intentarlo en un momento.';
        }
    }
}
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');
?><!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Cambiar contraseña · Vida en Arte 360</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --negro:#000; --texto:#1c1c1c; --gris:#6b6f76; --linea:#e3e5ea; --fondo:#f5f6f8; --blanco:#fff;
    --azul-marca:#2e5aa8; --naranja:#f5a11c; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--fondo); color:var(--texto);
    min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 20px; }
  .wrap { width:100%; max-width:420px; }
  .card { background:var(--blanco); border:1px solid var(--linea); border-radius:16px; padding:32px 28px 26px; }
  h1 { font-size:20px; font-weight:700; color:var(--negro); }
  .sub { margin-top:6px; font-size:13px; color:var(--gris); }
  form { margin-top:22px; display:flex; flex-direction:column; gap:14px; }
  label { display:block; font-size:12.5px; font-weight:600; margin-bottom:6px; }
  input { width:100%; font:inherit; font-size:14px; padding:11px 14px; border:1px solid var(--linea); border-radius:10px; }
  input:focus { outline:none; border-color:var(--azul-marca); box-shadow:0 0 0 3px color-mix(in srgb, var(--azul-marca) 20%, transparent); }
  .ayuda { font-size:12px; color:var(--gris); margin-top:4px; }
  button, .btn { margin-top:4px; font:inherit; font-size:14px; font-weight:600; padding:12px; border:0; border-radius:10px; cursor:pointer;
    background:var(--azul-marca); color:var(--blanco); text-align:center; text-decoration:none; display:block; }
  button:hover { background:#244b8f; }
  button:focus-visible, a:focus-visible { outline:3px solid var(--naranja); outline-offset:2px; }
  .aviso { font-size:13px; padding:10px 12px; border-radius:10px; }
  .aviso.error { background:#fdecea; color:#a3160f; }
  .aviso.ok { background:#e6f5ec; color:#17804a; }
  .pie { margin-top:16px; font-size:12.5px; text-align:center; }
  .pie a { color:var(--gris); }
</style>
</head>
<body>
  <main class="wrap">
    <div class="card">
      <h1><?= $obligatorio ? 'Crea tu contraseña' : 'Cambiar mi contraseña' ?></h1>
      <p class="sub"><?= $obligatorio
        ? 'Entraste con una contraseña temporal. Antes de seguir, elige una tuya.'
        : 'Usuario: ' . htmlspecialchars($usuario) ?></p>
      <?php if ($listo): ?>
        <form><div class="aviso ok" role="status">Listo: tu contraseña cambió.</div>
          <a class="btn" href="<?= htmlspecialchars($destino) ?>">Volver al portal</a></form>
      <?php else: ?>
      <form method="post" action="/cambiar-clave.php" novalidate>
        <?php if ($error): ?><div class="aviso error" role="alert"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
        <input type="hidden" name="r" value="<?= htmlspecialchars($destino) ?>">
        <input type="text" name="usuario" value="<?= htmlspecialchars($usuario) ?>" autocomplete="username" hidden>
        <div>
          <label for="actual"><?= $obligatorio ? 'Contraseña temporal' : 'Contraseña actual' ?></label>
          <input id="actual" name="actual" type="password" autocomplete="current-password" required autofocus>
        </div>
        <div>
          <label for="nueva">Contraseña nueva</label>
          <input id="nueva" name="nueva" type="password" autocomplete="new-password" minlength="<?= CLAVE_MINIMA ?>" required>
          <p class="ayuda">Al menos <?= CLAVE_MINIMA ?> caracteres.</p>
        </div>
        <div>
          <label for="repetir">Repite la contraseña nueva</label>
          <input id="repetir" name="repetir" type="password" autocomplete="new-password" minlength="<?= CLAVE_MINIMA ?>" required>
        </div>
        <button type="submit">Guardar contraseña</button>
      </form>
      <?php endif; ?>
    </div>
    <p class="pie"><?php if (!$obligatorio && !$listo): ?><a href="<?= htmlspecialchars($destino) ?>">Volver sin cambiar</a> · <?php endif; ?><a href="/logout.php">Cerrar sesión</a></p>
  </main>
</body>
</html>
