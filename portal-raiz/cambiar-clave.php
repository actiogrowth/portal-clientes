<?php
/* Cambiar mi contraseña: punto JSON detrás de la página fija
 * cambiar-clave.html (21-oct, rediseño). Para todos los usuarios, y
 * obligatorio cuando la contraseña es temporal (recién creada o reiniciada
 * desde Configuración): mientras tanto requerir_sesion() manda aquí
 * cualquier página del portal.
 *
 *   GET  cambiar-clave.php?estado=1 → {ok, usuario, obligatorio, csrf} o 401 {codigo:'sesion'}
 *   POST cambiar-clave.php (JSON {actual, nueva, repetir, csrf, r}) → {ok, destino, obligatorio}
 *   GET  cambiar-clave.php (sin estado) → redirige a /cambiar-clave.html
 *
 * Pide la contraseña actual (la temporal, si es el caso) y la nueva dos
 * veces. Al guardar sube ver_clave: las demás sesiones abiertas de esa
 * cuenta se cortan, y esta se renueva.
 */
require __DIR__ . '/auth.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');

function responder_clave(int $http, array $cuerpo): void {
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metodo === 'GET' && !isset($_GET['estado'])) {
    $q = $_SERVER['QUERY_STRING'] ?? '';
    header('Location: /cambiar-clave.html' . ($q !== '' ? '?' . $q : ''));
    exit;
}
if (!sesion_activa()) responder_clave(401, ['ok' => false, 'codigo' => 'sesion', 'error' => 'La sesión del portal caducó.']);
$usuario = usuario_actual();
$c = cuenta_actual();
$obligatorio = !empty($c['cambiar_clave']);

if ($metodo === 'GET') responder_clave(200, ['ok' => true, 'usuario' => $usuario, 'obligatorio' => $obligatorio, 'csrf' => csrf_token(),
    'claveMinima' => CLAVE_MINIMA]);
if ($metodo !== 'POST') responder_clave(405, ['ok' => false, 'error' => 'Método no permitido.']);

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) $e = $_POST;
$actual = (string) ($e['actual'] ?? '');
$nueva  = (string) ($e['nueva'] ?? '');
$otra   = (string) ($e['repetir'] ?? '');
$no = function (string $codigo, string $error, int $http = 400) { responder_clave($http, ['ok' => false, 'codigo' => $codigo, 'error' => $error]); };
if (!csrf_valido($e['csrf'] ?? null)) $no('csrf', 'La página caducó. Vuelve a intentarlo.', 403);
if (!password_verify($actual, $c['hash'])) { usleep(800000); $no('actual', 'La contraseña actual no es correcta.'); }
if (strlen($nueva) < CLAVE_MINIMA) $no('corta', 'La contraseña nueva tiene que tener al menos ' . CLAVE_MINIMA . ' caracteres.');
if ($nueva !== $otra) $no('distintas', 'Las dos contraseñas nuevas no coinciden.');
if ($nueva === $actual) $no('igual', 'La contraseña nueva tiene que ser distinta de la actual.');
try {
    $c = modificar_cuentas(function (array &$d) use ($usuario, $nueva) {
        $x = &$d['usuarios'][$usuario];
        $x['hash'] = password_hash($nueva, PASSWORD_DEFAULT);
        $x['cambiar_clave'] = false;
        $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;
        anotar_evento($d, $usuario, 'cambiar_clave', $usuario);
        return $x;
    });
} catch (Throwable $x) {
    error_log('portal cambiar-clave: no se pudo guardar para ' . $usuario . ': ' . $x->getMessage());
    $no('guardar', 'No se pudo guardar la contraseña. Vuelve a intentarlo en un momento.', 500);
}
iniciar_sesion($usuario, $c);
// Tras la temporal, sigue a donde iba (o a su inicio según el rol).
$destino = destino_seguro((string) ($e['r'] ?? '/'));
if ($destino === '/') $destino = destino_inicio($c['roles'] ?? []);
responder_clave(200, ['ok' => true, 'obligatorio' => $obligatorio, 'destino' => $destino]);
