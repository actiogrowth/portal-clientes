<?php
/* Puente de la Base de Datos VEA (4-nov-2026, D-123). Contrato en
 * docs/ACCIONES_API.md › Base de Datos VEA.
 *
 *   GET  api.php?accion=leer                        → lo que devuelve el script (todo el contenido)
 *        cabecera de respuesta X-CSRF: el sello de la sesión para escribir
 *   POST api.php  (cabecera X-CSRF) {accion: 'guardarTodo', baseDatos: [...], unidades: {...}}
 *   POST api.php  (cabecera X-CSRF) {accion: 'eliminarNino', id: 'VEA-###'}
 *
 * Cerrojos (el servidor decide; la página no tiene ninguna clave):
 *   1. requerir_sesion(): sesión y área «basededatos» (carpeta basededatos/
 *      en CARPETAS_AREA). Hoy: Administrador, Dirección, Coordinación After
 *      School, Comercial y Coordinación Preschool. Los demás, 403.
 *   2. Escribir (guardarTodo, eliminarNino) pide además 'bd.editar' y el
 *      sello CSRF de la sesión. Sin él, 403 «csrf».
 *   3. Lista cerrada de acciones y de campos: al script solo llega lo de
 *      la lista (nada de 'login', ni las acciones de Mensajes, que tienen su
 *      propio puente). Cualquier 'key' que mande el navegador se descarta.
 *   4. La dirección /exec y la clave ('exec' y 'clave') viven en
 *      portal_config.php, fuera de la carpeta pública. La clave es la
 *      propiedad BD_CLAVE_API del script del Sheet.
 *   5. Suelta la sesión antes de esperar a Google (D-068).
 *
 * Reemplaza al api.php que vivía en el repositorio de la Base de Datos
 * (pedía sesión, pero no miraba el rol ni el CSRF y dejaba pasar cualquier
 * acción).
 *
 * BD_SOLO_FUNCIONES: con esa constante el archivo solo declara sus funciones.
 */
require_once dirname(__DIR__) . '/auth.php';

const BD_LEER = ['leer'];
const BD_ESCRIBIR = ['guardarTodo', 'eliminarNino'];
const BD_CAMPOS = ['guardarTodo' => ['baseDatos', 'unidades'], 'eliminarNino' => ['id']];

function bd_fallo(string $msg, int $http = 500, string $codigo = 'error'): void {
    http_response_code($http);
    echo json_encode(['ok' => false, 'error' => $msg, 'codigo' => $codigo], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Lo que se le manda al script: solo la acción, sus campos de la lista y la clave del servidor. */
function bd_envio(string $accion, array $datos, string $clave): array {
    $envio = ['accion' => $accion];
    foreach (BD_CAMPOS[$accion] ?? [] as $c) if (array_key_exists($c, $datos)) $envio[$c] = $datos[$c];
    $envio['key'] = $clave;
    return $envio;
}

if (!defined('BD_SOLO_FUNCIONES')) {
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$esPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
if ($esPost) {
    if (!csrf_valido($_SERVER['HTTP_X_CSRF'] ?? null)) bd_fallo('La página caducó: recárgala y vuelve a intentarlo.', 403, 'csrf');
    // Un cuerpo de JSON (como manda la página): los objetos vacíos siguen siendo objetos.
    $datos = json_decode((string) file_get_contents('php://input'));
    $accion = is_object($datos) ? (string) ($datos->accion ?? '') : '';
    if (!in_array($accion, BD_ESCRIBIR, true)) bd_fallo('Acción desconocida.', 403, 'sin_permiso');
    if (!puede('bd.editar')) bd_fallo('Tu rol puede ver la Base de Datos, pero no guardar cambios.', 403, 'sin_permiso');
} else {
    $accion = (string) ($_GET['accion'] ?? '');
    if (!in_array($accion, BD_LEER, true)) bd_fallo('Acción desconocida.', 403, 'sin_permiso');
    header('X-CSRF: ' . csrf_token());   // el sello se crea aquí, antes de soltar la sesión
}
session_write_close();   // soltar la sesión antes de esperar a Google (D-068)

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) bd_fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg) || empty($cfg['exec']) || empty($cfg['clave'])) bd_fallo('portal_config.php no tiene exec y clave para la Base de Datos', 500, 'sin_configuracion');

if ($esPost) {
    $envio = bd_envio($accion, get_object_vars($datos), (string) $cfg['clave']);
    $url = (string) $cfg['exec'];
} else {
    $url = $cfg['exec'] . '?' . http_build_query(['accion' => 'leer', 'key' => (string) $cfg['clave']]);
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,   // /exec redirige a googleusercontent
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 180,    // un guardado completo tarda ~31 s
    CURLOPT_CONNECTTIMEOUT => 20,
]);
if ($esPost) {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($envio, JSON_UNESCAPED_UNICODE));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/plain;charset=utf-8']);
}
$respuesta = curl_exec($ch);
$error     = curl_error($ch);
$codigo    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($respuesta === false) bd_fallo('sin conexión con el Sheet: ' . $error, 502);
if ($codigo >= 400)       bd_fallo('el Sheet respondió con el código ' . $codigo, 502);

echo $respuesta;
}
