<?php
/* Puente de Pasar lista (21-oct). Lo usan el rol Profesor (solo hoy) y la
 * coordinación (Coordinación After School, Administrador, Dirección: también
 * otros días, para corregir).
 *
 * Reutiliza el transporte de after-school/api.php (reintentos, redirección a
 * mano, esperas) cargándolo con AS_SOLO_FUNCIONES: solo sus funciones.
 *
 * Cerrojos:
 *   1. requerir_sesion(): sesión y área «pasarlista» (carpeta /pasar-lista/).
 *   2. Solo dos acciones: leerLista (as.lista.ver) y guardarLista (as.lista.marcar).
 *   3. El límite de días lo pone ESTE archivo según el rol: sin
 *      as.lista.corregir (Profesor) → limiteProfesor = true (23-oct: la
 *      ventana de Config, AfterSchool.gs v8) y soloHoy = true (para que un
 *      script anterior a v8 siga limitando a hoy). Lo que mande el navegador
 *      se descarta. El Apps Script lo respeta.
 *   4. La respuesta se recorta a una lista blanca: por niño, solo nombre,
 *      edad, la marca de visita y lo marcado. Nada de contactos ni del
 *      resto de After School, aunque el script mandara más.
 */
define('AS_SOLO_FUNCIONES', true);
require dirname(__DIR__) . '/after-school/api.php';
require dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg) || empty($cfg['as_exec']) || empty($cfg['as_clave'])) fallo('portal_config.php no tiene as_exec y as_clave');

$usuario = usuario_actual();
$roles = roles_actuales();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos) || empty($datos['accion']) || !is_string($datos['accion'])) fallo('cuerpo ilegible', 400);
if (!in_array($datos['accion'], ACCIONES_LISTA, true)) fallo('Esta página solo pasa lista.', 403, 'sin_permiso');
if (!roles_permiten($roles, permiso_de_accion_as($datos['accion']))) fallo('Tu rol no permite pasar lista.', 403, 'sin_permiso');

if (!is_array($datos['datos'] ?? null)) $datos['datos'] = [];
$conLimite = !roles_permiten($roles, 'as.lista.corregir');
$datos['datos']['soloHoy'] = $conLimite;
$datos['datos']['limiteProfesor'] = $conLimite;

$envio = envio_para($cfg['as_clave'], $usuario, $datos);
$res = llamar_apps_script($datos['accion'], $cfg['as_exec'], $envio['json'], 'pedir',
    function ($s) { usleep((int) ($s * 1000000)); },
    function ($linea) { error_log($linea); },
    function () { return microtime(true); },
    $envio['conId']);
if ($res['http'] === 200) $res['cuerpo'] = lista_recortada($res['cuerpo']);
http_response_code($res['http']);
echo $res['cuerpo'];

/** Solo lo que la pantalla de Pasar lista necesita (lista blanca). */
function lista_recortada(string $cuerpo): string {
    $j = json_decode($cuerpo, true);
    if (!is_array($j)) return $cuerpo;
    $toma = function ($o, array $claves) {
        $r = [];
        foreach ($claves as $k) if (is_array($o) && array_key_exists($k, $o)) $r[$k] = $o[$k];
        return $r;
    };
    $out = $toma($j, ['ok', 'error', 'codigo', 'repetida']);
    $res = $j['resultado'] ?? null;
    if (is_array($res) && isset($res['clases']) && is_array($res['clases'])) {
        $r = $toma($res, ['fecha', 'hoy', 'dia', 'otroDia', 'desde', 'hasta', 'soloLectura', 'estados']);
        $r['clases'] = array_map(function ($c) use ($toma) {
            $x = $toma($c, ['codigo', 'servicio', 'hora', 'guardada', 'sinClase']);
            $x['ninos'] = array_map(function ($n) use ($toma) {
                return $toma($n, ['idNino', 'nombre', 'edad', 'presencia', 'idVisita', 'estado', 'nota']);
            }, is_array($c['ninos'] ?? null) ? $c['ninos'] : []);
            $x['fueraDeLista'] = array_map(function ($n) use ($toma) {
                return $toma($n, ['idAsistencia', 'nombre', 'estado', 'nota']);
            }, is_array($c['fueraDeLista'] ?? null) ? $c['fueraDeLista'] : []);
            return $x;
        }, $res['clases']);
        $out['resultado'] = $r;
    } elseif (is_array($res)) {
        $out['resultado'] = $toma($res, ['fecha', 'codigo', 'nuevas', 'corregidas', 'visitasMarcadas']);
    }
    $out['permisos'] = ['puedeOtroDia' => roles_permiten(roles_actuales(), 'as.lista.corregir')];
    return json_encode($out, JSON_UNESCAPED_UNICODE);
}
