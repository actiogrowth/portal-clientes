<?php
/* Puente de Mensajes a familias (3-nov-2026). Contrato en
 * docs/ACCIONES_API.md › Mensajes a familias.
 *
 *   POST {accion: 'leer'}              → familias activas, clases, plantillas, configuración, envíos
 *   POST {accion: 'guardarPlantilla', datos: {nombre, nombreAnterior?, asunto, cuerpo, activa}}
 *   POST {accion: 'registrar', datos: {idEnvio, grupos, familias, sinCorreo, plantilla, asunto, tanda, tandas}}
 *
 * Cerrojos (el servidor decide; la pantalla solo esconde):
 *   1. requerir_sesion(): sesión y área «mensajes» (carpeta mensajes/ en
 *      CARPETAS_AREA). Hoy: Administrador, Dirección y Comercial. Profesor,
 *      Coordinación, Recepción y Contabilidad reciben 403 sin que salga nada.
 *   2. Además, mensajes.enviar para las tres acciones, y mensajes.plantillas
 *      (Dirección y Administrador) para guardarPlantilla.
 *   3. Solo salen niños INSCRITOS Y ACTIVOS, y de ellos solo unidad, ID,
 *      nombre, teléfono, correo y sus clases:
 *        After School  «Niños» › Estado = Activo (AfterSchool.gs › leer).
 *                      Sus clases: las inscripciones abiertas. Un niño cuyas
 *                      clases son todas de un «Servicio fuera de Mensajes»
 *                      (Config mensajes; hoy Baby & Me) no sale.
 *        Preschool     casilla «Kínder» de «👦 Base de Datos» Y «Estado
 *                      actual» = Activo en la pestaña Kínder (las dos a la
 *                      vez; apps-script-vea.gs › mensajesLeer manda solo las
 *                      de la casilla, con su estado).
 *      Nada de responsable, nacimiento, pagos, notas ni retirados.
 *   4. El registro lleva usuario y rol de la SESIÓN (no del navegador) y
 *      nunca correos: al script solo le llega la lista blanca de campos.
 *   5. Suelta la sesión antes de esperar a Google (D-068).
 *   6. Si After School o la Base de Datos no responden, no hay lista: un
 *      «Todo Vida en Arte» a medias se mandaría sin que nadie lo notara.
 *
 * Reutiliza el transporte de after-school/api.php (AS_SOLO_FUNCIONES), igual
 * que Equipo. La Base de Datos se pide con su clave de siempre MÁS la clave de
 * mensajes (msj_clave = propiedad MSJ_CLAVE_API del script de la Base de
 * Datos): la de siempre está en el index.html público de la Base de Datos.
 *
 * portal_config.php (fuera de la carpeta pública): as_exec y as_clave (After
 * School), exec y clave (Base de Datos, los de siempre) y
 *     'msj_clave' => 'la misma que MSJ_CLAVE_API en el script de la Base de Datos',
 *
 * MS_SOLO_FUNCIONES: con esa constante el archivo solo declara sus funciones
 * (las pruebas la usan).
 */
if (!defined('AS_SOLO_FUNCIONES')) define('AS_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/after-school/api.php';
require_once dirname(__DIR__) . '/auth.php';

const MS_ACCIONES = ['leer', 'guardarPlantilla', 'registrar'];
const MS_ACTIVO = 'activo';                 // el valor de «Estado» (After School) y de «Estado actual» (Kínder), normalizado
const MS_UNIDAD_AS = 'After School';
const MS_UNIDAD_PRE = 'Preschool';
const MS_SERVICIO_FUERA = 'Servicio fuera de Mensajes';

if (!defined('MS_SOLO_FUNCIONES')) {
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

if (!puede('mensajes.enviar')) fallo('Tu rol no permite enviar mensajes a familias.', 403, 'sin_permiso');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
$datos = json_decode((string) file_get_contents('php://input'), true);
$accion = is_array($datos) ? (string) ($datos['accion'] ?? '') : '';
if (!in_array($accion, MS_ACCIONES, true)) fallo('Acción desconocida.', 403, 'sin_permiso');
if ($accion === 'guardarPlantilla' && !puede('mensajes.plantillas')) fallo('Solo Dirección y Administrador editan las plantillas.', 403, 'sin_permiso');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
$faltan = [];
foreach (['as_exec', 'as_clave', 'exec', 'clave', 'msj_clave'] as $k) if (!is_array($cfg) || empty($cfg[$k])) $faltan[] = $k;
if ($faltan) fallo('portal_config.php no tiene ' . implode(', ', $faltan) . ' para Mensajes.', 500, 'sin_configuracion');

$usuario = usuario_actual();
$roles = roles_actuales();
$rol = implode(' · ', array_values(array_filter(array_map(fn($r) => ROLES[$r]['nombre'] ?? '', $roles))));
$puedePlantillas = puede('mensajes.plantillas');
session_write_close();   // soltar la sesión antes de esperar a Google

$d = is_array($datos['datos'] ?? null) ? $datos['datos'] : [];

if ($accion === 'leer') {
    $bd = ms_llamar($cfg['exec'], $cfg['clave'], $usuario, 'mensajesLeer', [], $cfg['msj_clave'], true);
    if (!$bd) fallo('No se pudo leer la Base de Datos (Preschool, plantillas y configuración). Vuelve a intentarlo en un momento.', 502, 'incierto');
    $as = ms_llamar($cfg['as_exec'], $cfg['as_clave'], $usuario, 'leer', [], '', true);
    if (!$as) fallo('No se pudo leer After School. Vuelve a intentarlo en un momento.', 502, 'incierto');
    $fuera = ms_servicios_fuera((array) ($bd['config'] ?? []));
    $f = ms_familias($as, (array) ($bd['preschool'] ?? []), $fuera);
    $plantillas = array_values(array_filter(array_map('ms_plantilla', (array) ($bd['plantillas'] ?? [])), fn($p) => $p && ($puedePlantillas || $p['activa'])));
    echo json_encode(['ok' => true, 'resultado' => [
        'hoy' => (string) ($bd['hoy'] ?? date('Y-m-d')),
        'familias' => $f['familias'], 'clases' => $f['clases'],
        'config' => ms_config_filas((array) ($bd['config'] ?? [])),
        'plantillas' => $plantillas,
        'enviados' => array_values(array_map('ms_enviado', array_slice((array) ($bd['enviados'] ?? []), 0, 20))),
        'familiasHoy' => (int) ($bd['familiasHoy'] ?? 0),
        'puedePlantillas' => $puedePlantillas,
        'usuario' => $usuario, 'rol' => $rol,
    ]], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($accion === 'guardarPlantilla') {
    $p = ['nombre' => ms_texto($d['nombre'] ?? '', 80), 'nombreAnterior' => ms_texto($d['nombreAnterior'] ?? '', 80),
          'asunto' => ms_texto($d['asunto'] ?? '', 200), 'cuerpo' => ms_texto($d['cuerpo'] ?? '', 20000, true), 'activa' => ($d['activa'] ?? true) !== false];
    if ($p['nombre'] === '') fallo('Escribe el nombre de la plantilla.', 400, 'datos');
    $r = ms_llamar($cfg['exec'], $cfg['clave'], $usuario, 'mensajesGuardarPlantilla', $p, $cfg['msj_clave'], false, $error);
    if (!$r) fallo($error ?: 'No se pudo guardar la plantilla. Vuelve a intentarlo.', $error ? 400 : 502, $error ? 'rechazado' : 'incierto');
    echo json_encode(['ok' => true, 'resultado' => ['plantillas' => array_values(array_filter(array_map('ms_plantilla', (array) ($r['plantillas'] ?? []))))]], JSON_UNESCAPED_UNICODE);
    exit;
}

// registrar: lista blanca; usuario y rol de la sesión.
$reg = ['idEnvio' => ms_texto($d['idEnvio'] ?? '', 64), 'usuario' => $usuario, 'rol' => $rol,
        'grupos' => ms_texto($d['grupos'] ?? '', 500), 'familias' => max(0, (int) ($d['familias'] ?? 0)), 'sinCorreo' => max(0, (int) ($d['sinCorreo'] ?? 0)),
        'plantilla' => ms_texto($d['plantilla'] ?? '', 80), 'asunto' => ms_texto($d['asunto'] ?? '', 200),
        'tanda' => (int) ($d['tanda'] ?? 0), 'tandas' => (int) ($d['tandas'] ?? 0)];
if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $reg['idEnvio'])) fallo('Falta el ID del envío.', 400, 'datos');
if ($reg['tanda'] < 1 || $reg['tandas'] < 1 || $reg['tanda'] > $reg['tandas']) fallo('Tanda fuera de rango.', 400, 'datos');
// Ningún correo entra al registro, aunque alguien lo escriba en el asunto o en los grupos.
foreach (['grupos', 'asunto', 'plantilla'] as $k) $reg[$k] = preg_replace('/[^\s@]+@[^\s@]+/', '[correo]', $reg[$k]);
$r = ms_llamar($cfg['exec'], $cfg['clave'], $usuario, 'mensajesRegistrar', $reg, $cfg['msj_clave'], false, $error);
if (!$r) fallo($error ?: 'No se pudo registrar la tanda. El correo puede haberse abierto igual.', $error ? 400 : 502, $error ? 'rechazado' : 'incierto');
echo json_encode(['ok' => true, 'resultado' => ['idEnvio' => (string) ($r['idEnvio'] ?? ''), 'tandas' => (string) ($r['tandas'] ?? '')]], JSON_UNESCAPED_UNICODE);
exit;
}

/* ─── Funciones ───────────────────────────────────────────────────────── */

/** Minúsculas, sin tildes, un solo espacio. */
function ms_norm($s): string {
    $s = mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $s)));
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
}

/** Un texto del navegador, recortado. Sin saltos de línea salvo en el cuerpo. */
function ms_texto($v, int $max, bool $multilinea = false): string {
    $s = is_scalar($v) ? (string) $v : '';
    $s = $multilinea ? str_replace("\r\n", "\n", $s) : trim(preg_replace('/\s+/u', ' ', $s));
    return mb_substr($s, 0, $max);
}

/**
 * Una llamada a un Apps Script por el transporte de After School. Devuelve el
 * «resultado» o null. $lectura: se reintenta como lectura; las dos escrituras
 * también son seguras de repetir (el script reconoce la plantilla por nombre y
 * el envío por su ID), por eso van con reintento (conId). $error: el mensaje
 * del script si respondió que no.
 */
function ms_llamar(string $exec, string $clave, string $usuario, string $accion, array $datos, string $claveMsj, bool $lectura, ?string &$error = null): ?array {
    $error = null;
    $cuerpo = ['key' => $clave, 'usuario' => $usuario, 'accion' => $accion, 'datos' => $datos ?: new stdClass()];
    if ($claveMsj !== '') $cuerpo['claveMensajes'] = $claveMsj;
    $res = llamar_apps_script($lectura ? 'leer' : $accion, $exec, json_encode($cuerpo, JSON_UNESCAPED_UNICODE), 'pedir',
        function ($s) { usleep((int) ($s * 1000000)); },
        function ($linea) { error_log('mensajes: ' . $linea); },
        function () { return microtime(true); },
        !$lectura);
    $j = $res['http'] === 200 ? json_decode($res['cuerpo'], true) : null;
    if (!is_array($j)) return null;
    if (($j['ok'] ?? false) !== true || !is_array($j['resultado'] ?? null)) {
        $error = is_string($j['error'] ?? null) && $j['error'] !== '' ? $j['error'] : null;
        if ($lectura) { error_log('mensajes: ' . $accion . ' respondió con error: ' . (string) ($j['error'] ?? '')); $error = null; }
        return null;
    }
    return $j['resultado'];
}

/** Los servicios de After School que no reciben mensajes (Config mensajes). */
function ms_servicios_fuera(array $filas): array {
    $out = [];
    foreach ($filas as $f) if (is_array($f) && ms_norm($f['parametro'] ?? '') === ms_norm(MS_SERVICIO_FUERA) && trim((string) ($f['valor'] ?? '')) !== '')
        $out[] = ms_norm($f['valor']);
    return $out;
}

/** La configuración tal cual (parámetro y valor), para comun/mensajes.js › config. */
function ms_config_filas(array $filas): array {
    $out = [];
    foreach ($filas as $f) if (is_array($f) && trim((string) ($f['parametro'] ?? '')) !== '')
        $out[] = ['parametro' => trim((string) $f['parametro']), 'valor' => trim((string) ($f['valor'] ?? ''))];
    return $out;
}

/**
 * Las familias que pueden recibir: solo activos y solo los campos de la lista.
 * $as = el «resultado» de AfterSchool.gs › leer; $pre = mensajesLeer › preschool.
 */
function ms_familias(array $as, array $pre, array $fuera): array {
    $clases = [];
    foreach ((array) ($as['clases'] ?? []) as $c) if (is_array($c) && ($c['codigo'] ?? '') !== '') $clases[(string) $c['codigo']] = $c;
    $ins = [];
    foreach ((array) ($as['inscripciones'] ?? []) as $i) if (is_array($i)) $ins[(string) ($i['idNino'] ?? '')][] = (string) ($i['codigo'] ?? '');
    $esFuera = fn($k) => isset($clases[$k]) && in_array(ms_norm($clases[$k]['servicio'] ?? ''), $fuera, true);
    $familias = []; $usadas = [];
    foreach ((array) ($as['ninos'] ?? []) as $n) {
        if (!is_array($n) || ms_norm($n['estado'] ?? '') !== MS_ACTIVO) continue;
        $id = (string) ($n['id'] ?? '');
        if ($id === '') continue;
        $cods = array_values(array_unique(array_filter($ins[$id] ?? [], fn($k) => $k !== '')));
        if ($cods && count(array_filter($cods, $esFuera)) === count($cods)) continue;   // solo servicios fuera (Baby & Me)
        $suyas = array_values(array_filter($cods, fn($k) => isset($clases[$k]) && !$esFuera($k)));
        foreach ($suyas as $k) $usadas[$k] = true;
        $familias[] = ['unidad' => MS_UNIDAD_AS, 'id' => $id, 'nino' => trim(((string) ($n['nombre'] ?? '')) . ' ' . ((string) ($n['apellidos'] ?? ''))),
                       'telefono' => (string) ($n['telefono'] ?? ''), 'correo' => (string) ($n['correo'] ?? ''), 'clases' => $suyas];
    }
    foreach ($pre as $p) {
        if (!is_array($p) || ms_norm($p['estado'] ?? '') !== MS_ACTIVO || ($p['id'] ?? '') === '') continue;
        $familias[] = ['unidad' => MS_UNIDAD_PRE, 'id' => (string) $p['id'], 'nino' => trim(((string) ($p['nombre'] ?? '')) . ' ' . ((string) ($p['apellidos'] ?? ''))),
                       'telefono' => (string) ($p['telefono'] ?? ''), 'correo' => (string) ($p['correo'] ?? ''), 'clases' => []];
    }
    $lista = [];
    foreach (array_keys($usadas) as $k) $lista[] = ['codigo' => $k, 'servicio' => (string) ($clases[$k]['servicio'] ?? ''), 'dia' => (string) ($clases[$k]['dia'] ?? ''), 'hora' => (string) ($clases[$k]['hora'] ?? '')];
    return ['familias' => $familias, 'clases' => $lista];
}

function ms_plantilla($p): ?array {
    if (!is_array($p) || trim((string) ($p['nombre'] ?? '')) === '') return null;
    return ['nombre' => (string) $p['nombre'], 'asunto' => (string) ($p['asunto'] ?? ''), 'cuerpo' => (string) ($p['cuerpo'] ?? ''), 'activa' => ($p['activa'] ?? false) === true];
}

function ms_enviado($e): array {
    $e = is_array($e) ? $e : [];
    $n = fn($v) => is_numeric($v) ? (int) $v : null;
    return ['fecha' => (string) ($e['fecha'] ?? ''), 'usuario' => (string) ($e['usuario'] ?? ''), 'rol' => (string) ($e['rol'] ?? ''), 'grupos' => (string) ($e['grupos'] ?? ''),
            'familias' => $n($e['familias'] ?? null), 'sinCorreo' => $n($e['sinCorreo'] ?? null), 'plantilla' => (string) ($e['plantilla'] ?? ''),
            'asunto' => (string) ($e['asunto'] ?? ''), 'tandas' => (string) ($e['tandas'] ?? '')];
}
