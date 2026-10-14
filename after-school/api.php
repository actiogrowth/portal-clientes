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

/* ── Transporte ────────────────────────────────────────────────────────────
 * Apps Script contesta un POST a /exec con un 302 hacia
 * script.googleusercontent.com/macros/echo?…, donde espera la respuesta ya
 * calculada. Ese salto se hace A MANO: con CURLOPT_FOLLOWLOCATION, un 302 que
 * apuntara otra vez a /exec terminaba en un GET a /exec (doGet), y la página
 * mostraba «solo responde a POST» aunque la escritura SÍ se había hecho
 * (14-oct, INS-0220).
 *
 * Reglas:
 *   · El POST a /exec se manda UNA vez y nunca se repite: no es idempotente.
 *   · Solo se sigue un Location que apunte a *.googleusercontent.com, con GET.
 *     Jamás se pide /exec con GET.
 *   · El GET al echo sí se puede repetir (solo lee la respuesta guardada): si
 *     da 404 o 5xx se reintenta dos veces.
 *   · Si el POST salió pero la respuesta no llega, el error lleva el código
 *     «incierto»: la página vuelve a leer y comprueba si el cambio quedó.
 *     «sin_conexion» es solo cuando seguro no salió (no hubo conexión).
 *   · Cada «incierto» deja una línea en el error_log de PHP con lo que pasó
 *     (código, destino sin parámetros), para poder diagnosticarlo.
 */
function pedir(string $url, ?string $cuerpo): array {
    $ch = curl_init($url);
    $op = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 20,
    ];
    if ($cuerpo !== null) {
        $op[CURLOPT_POST]       = true;
        $op[CURLOPT_POSTFIELDS] = $cuerpo;
        $op[CURLOPT_HTTPHEADER] = ['Content-Type: text/plain;charset=utf-8'];
    } else {
        $op[CURLOPT_HTTPGET] = true;
    }
    curl_setopt_array($ch, $op);
    $cuerpoResp = curl_exec($ch);
    $r = [
        'codigo'   => (int) curl_getinfo($ch, CURLINFO_HTTP_CODE),
        'location' => (string) (curl_getinfo($ch, CURLINFO_REDIRECT_URL) ?: ''),
        'errno'    => curl_errno($ch),
        'error'    => curl_error($ch),
        'cuerpo'   => $cuerpoResp,
    ];
    curl_close($ch);
    return $r;
}

/** Destino sin parámetros, para el registro (los parámetros del echo no se guardan). */
function destino(string $url): string {
    $p = parse_url($url);
    return ($p['host'] ?? '?') . ($p['path'] ?? '');
}

function incierto(string $accion, string $que): void {
    error_log('after-school api.php [' . $accion . '] respuesta perdida: ' . $que);
    $lectura = in_array($accion, ['leer', 'listarPagos'], true);
    fallo('No llegó la respuesta del Sheet.' . ($lectura ? '' : ' Puede que el cambio se haya guardado.'), 502, 'incierto');
}

function json_valido($texto): bool {
    return is_string($texto) && is_array(json_decode($texto, true));
}

$accion = $datos['accion'];
$r = pedir($cfg['as_exec'], $envio);

if ($r['cuerpo'] === false) {
    // 6/7/35: no se pudo resolver, conectar o negociar TLS → el POST no salió.
    if (in_array($r['errno'], [5, 6, 7, 35], true)) fallo('Sin conexión con el Sheet: ' . $r['error'] . '. No se guardó nada.', 502, 'sin_conexion');
    incierto($accion, 'POST sin respuesta (curl ' . $r['errno'] . ': ' . $r['error'] . ')');
}

$rastro = 'POST ' . $r['codigo'];
$saltos = 0;
while (in_array($r['codigo'], [301, 302, 303, 307, 308], true)) {
    $loc  = $r['location'];
    $host = (string) parse_url($loc, PHP_URL_HOST);
    $rastro .= ' → ' . destino($loc);
    if ($loc === '' || !preg_match('/(^|\.)googleusercontent\.com$/i', $host) || ++$saltos > 3) {
        incierto($accion, $rastro . ' (redirección no seguida: no es googleusercontent)');
    }
    for ($intento = 1; $intento <= 3; $intento++) {
        $r = pedir($loc, null);
        $rastro .= ' GET ' . ($r['cuerpo'] === false ? 'sin respuesta' : $r['codigo']);
        $repetible = $r['cuerpo'] === false || $r['codigo'] === 404 || $r['codigo'] >= 500;
        if (!$repetible || $intento === 3) break;
        usleep(800000);
    }
    if ($r['cuerpo'] === false) incierto($accion, $rastro);
}

if ($r['codigo'] !== 200 || !json_valido($r['cuerpo'])) {
    incierto($accion, $rastro . ($r['codigo'] === 200 ? ' (cuerpo no es JSON)' : ''));
}

echo $r['cuerpo'];
