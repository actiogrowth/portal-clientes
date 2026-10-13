<?php
/* Puente entre la página de After School y su Apps Script (VEA_AfterSchool_BD).
 *
 * Mismo patrón que basededatos/api.php, con dos cerrojos más:
 *   1. Exige sesión del portal (requerir_sesion, de auth.php).
 *   2. El usuario de esa sesión tiene que estar en la lista 'as_usuarios'
 *      de portal_config.php. Si la lista falta o está vacía, no entra nadie:
 *      un permiso de Kínder no abre After School.
 *   3. La clave y el usuario los pone ESTE archivo. Lo que mande el navegador
 *      en esos campos se descarta: el navegador solo elige acción y datos.
 *
 * portal_config.php vive fuera de la carpeta pública y lleva, para esta área:
 *     'as_exec'         => 'https://script.google.com/macros/s/…/exec',
 *     'as_clave'        => 'la misma que AS_CLAVE_API en el Apps Script',
 *     'as_usuarios'     => ['usuario1', 'usuario2'],
 *     'as_campo_sesion' => 'usuario',   // opcional: la clave de $_SESSION con el usuario
 *
 * Diagnóstico: GET api.php?diagnostico=1 (con sesión) dice qué claves trae la
 * sesión —solo los NOMBRES, nunca los valores— y si encontró al usuario y si
 * está autorizado. Sirve para fijar 'as_campo_sesion' sin abrir auth.php.
 *
 * APAGADO POR DEFECTO. Solo responde si portal_config.php lleva
 *     'as_diagnostico' => true,
 * exactamente true (no "1", no "sí"). Sin esa línea, o con cualquier otro
 * valor, contesta 404 como si no existiera. Se enciende un momento para
 * ajustar as_campo_sesion y se borra la línea: olvidarla o borrarla deja el
 * sistema del lado seguro.
 */

require dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

function salir(int $codigo, array $cuerpo): void {
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}
function fallo(string $msg, int $codigo = 500, string $tipo = ''): void {
    salir($codigo, ['ok' => false, 'error' => $msg, 'codigo' => $tipo]);
}

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg) || empty($cfg['as_exec']) || empty($cfg['as_clave']))
    fallo('portal_config.php no tiene as_exec y as_clave para After School');

if (session_status() !== PHP_SESSION_ACTIVE) @session_start();

/* El usuario de la sesión. Si portal_config.php dice qué clave usar, se usa
   solo esa. Si no, se prueban los nombres habituales, sin adivinar más allá:
   si no aparece, no se escribe nada. */
function usuario_del_portal(array $cfg): string {
    $s = $_SESSION ?? [];
    if (!empty($cfg['as_campo_sesion'])) {
        $v = $s[$cfg['as_campo_sesion']] ?? '';
        if (is_array($v)) $v = $v['usuario'] ?? $v['user'] ?? $v['username'] ?? $v['nombre'] ?? '';
        return is_string($v) ? trim($v) : '';
    }
    foreach (['usuario', 'user', 'username', 'login', 'nombre_usuario'] as $k) {
        $v = $s[$k] ?? null;
        if (is_string($v) && trim($v) !== '') return trim($v);
        if (is_array($v)) foreach (['usuario', 'user', 'username', 'login', 'nombre'] as $j)
            if (is_string($v[$j] ?? null) && trim($v[$j]) !== '') return trim($v[$j]);
    }
    return '';
}

function autorizado(string $usuario, array $cfg): bool {
    $lista = $cfg['as_usuarios'] ?? [];
    if (!is_array($lista) || !$lista || $usuario === '') return false;
    foreach ($lista as $u) if (is_string($u) && strcasecmp(trim($u), $usuario) === 0) return true;
    return false;
}

$usuario = usuario_del_portal($cfg);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && isset($_GET['diagnostico'])) {
    if (($cfg['as_diagnostico'] ?? null) !== true) fallo('no encontrado', 404);
    $claves = [];
    foreach (($_SESSION ?? []) as $k => $v) {
        $claves[] = is_array($v) ? $k . ' → [' . implode(', ', array_map('strval', array_keys($v))) . ']' : (string)$k;
    }
    salir(200, ['ok' => true, 'diagnostico' => [
        'claves_de_sesion' => $claves,
        'usuario_encontrado' => $usuario !== '',
        'autorizado' => autorizado($usuario, $cfg),
        'lista_configurada' => is_array($cfg['as_usuarios'] ?? null) && count($cfg['as_usuarios']) > 0,
    ]]);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
if ($usuario === '') fallo('No se pudo leer el usuario de la sesión del portal. Encender as_diagnostico en portal_config.php, abrir api.php?diagnostico=1, fijar as_campo_sesion y volver a apagarlo.', 403, 'sin_usuario');
if (!autorizado($usuario, $cfg)) fallo('El usuario «' . $usuario . '» no tiene acceso a After School.', 403, 'no_autorizado');

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos) || empty($datos['accion']) || !is_string($datos['accion'])) fallo('cuerpo ilegible', 400);

$envio = json_encode([
    'key'     => $cfg['as_clave'],
    'usuario' => $usuario,
    'accion'  => $datos['accion'],
    'datos'   => is_array($datos['datos'] ?? null) ? $datos['datos'] : new stdClass(),
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($cfg['as_exec']);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,   // /exec redirige a googleusercontent
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 90,
    CURLOPT_CONNECTTIMEOUT => 20,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $envio,
    CURLOPT_HTTPHEADER     => ['Content-Type: text/plain;charset=utf-8'],
]);
$respuesta = curl_exec($ch);
$error     = curl_error($ch);
$codigo    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($respuesta === false) fallo('sin conexión con el Sheet: ' . $error, 502);
if ($codigo >= 400)       fallo('el Sheet respondió con el código ' . $codigo, 502);
if (!is_array(json_decode($respuesta, true))) fallo('el Sheet no respondió JSON (¿la implementación está publicada?)', 502);

echo $respuesta;
