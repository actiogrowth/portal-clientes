<?php
/* Entrar al portal: punto JSON detrás de la página fija login.html (21-oct,
 * rediseño). La presentación no depende de PHP: login.html la pinta y habla
 * con este archivo por JSON a través de comun/datos.js.
 *
 *   GET  login.php?estado=1&r=…   → {ok, csrf, conSesion, destino?, mantenimiento}
 *   POST login.php  (JSON {usuario, clave, csrf, r}) → {ok, destino} o {ok:false, error, codigo}
 *   GET  login.php (sin estado)   → redirige a /login.html (direcciones viejas)
 *
 * Seguridad (igual que antes):
 *   · CSRF: token por sesión; sin él no se mira la contraseña ('csrf').
 *   · 5 fallos seguidos desde la misma conexión bloquean 15 minutos ('bloqueado').
 *   · Una cuenta desactivada responde igual que una contraseña mala ('credenciales').
 *   · La sesión se regenera al entrar (iniciar_sesion).
 *   · Contraseña temporal → el destino es /cambiar-clave.html.
 *   · Destino tras el login: lo que se pidió (r) o, si no, según el rol:
 *     una sola sección → directo a ella; si no, la portada (destino_inicio).
 */
require __DIR__ . '/auth.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');

function responder_login(int $http, array $cuerpo): void {
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

/** A dónde va el usuario tras entrar: lo pedido, o su inicio según el rol. */
function destino_tras_login(string $pedido, array $c): string {
    $d = destino_seguro($pedido);
    if ($d === '/') $d = destino_inicio($c['roles'] ?? []);
    return !empty($c['cambiar_clave']) ? '/cambiar-clave.html?r=' . urlencode($d) : $d;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// Sin cuentas utilizables (migración pendiente o archivo dañado) nadie entra.
// El detalle (puede nombrar usuarios) va solo al error_log.
$sinCuentas = cuentas() === null;
if ($sinCuentas) error_log('portal login: sin cuentas utilizables: ' . $GLOBALS['cuentas_error']);

if ($metodo === 'GET') {
    if (!isset($_GET['estado'])) {
        $q = $_SERVER['QUERY_STRING'] ?? '';
        header('Location: /login.html' . ($q !== '' ? '?' . $q : ''));
        exit;
    }
    $c = cuenta_actual();
    responder_login(200, ['ok' => true, 'csrf' => csrf_token(), 'conSesion' => $c !== null,
        'destino' => $c ? destino_tras_login((string) ($_GET['r'] ?? '/'), $c) : null, 'mantenimiento' => $sinCuentas]);
}
if ($metodo !== 'POST') responder_login(405, ['ok' => false, 'error' => 'Método no permitido.']);

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) $e = $_POST;   // por si llega un formulario
if ($sinCuentas) responder_login(503, ['ok' => false, 'codigo' => 'mantenimiento',
    'error' => 'En mantenimiento: falta terminar la configuración de usuarios. El detalle está en el error_log del servidor.']);
if (!csrf_valido($e['csrf'] ?? null)) responder_login(403, ['ok' => false, 'codigo' => 'csrf', 'error' => 'La página caducó. Vuelve a escribir tu usuario y contraseña.']);
if ($min = bloqueado()) responder_login(429, ['ok' => false, 'codigo' => 'bloqueado', 'error' => "Demasiados intentos fallidos. Vuelve a intentarlo en $min min."]);

$usuario = strtolower(trim((string) ($e['usuario'] ?? '')));
$clave   = (string) ($e['clave'] ?? '');
$c = $usuario !== '' ? cuenta($usuario) : null;
if ($c && !empty($c['activo']) && password_verify($clave, $c['hash'])) {
    limpiar_intentos();
    try {
        $c = modificar_cuentas(function (array &$d) use ($usuario, $clave) {
            $x = &$d['usuarios'][$usuario];
            $x['ultimo_ingreso'] = date('c');
            if (password_needs_rehash($x['hash'], PASSWORD_DEFAULT)) $x['hash'] = password_hash($clave, PASSWORD_DEFAULT);
            return $x;
        });
    } catch (Throwable $x) {
        error_log('portal login: no se pudo anotar el ingreso de ' . $usuario . ': ' . $x->getMessage());
    }
    iniciar_sesion($usuario, $c);
    responder_login(200, ['ok' => true, 'destino' => destino_tras_login((string) ($e['r'] ?? '/'), $c), 'csrf' => csrf_token()]);
}
registrar_fallo();
usleep(800000);
responder_login(403, ['ok' => false, 'codigo' => 'credenciales', 'error' => 'Usuario o contraseña incorrectos.']);
