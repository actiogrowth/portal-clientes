<?php
/* Puente de Mensajes a familias (3-nov-2026; 5-nov: el SERVIDOR envía el
 * correo, desde el buzón del hosting, ya no Gmail). Contrato en
 * docs/ACCIONES_API.md › Mensajes a familias.
 *
 *   POST {accion: 'leer'}              → familias activas (con la huella de su correo), clases, plantillas, configuración, envíos
 *   POST {accion: 'guardarPlantilla', datos: {nombre, nombreAnterior?, asunto, cuerpo, activa}}
 *   POST {accion: 'enviar', datos: {idEnvio, tanda, tandas, claves[], asunto, cuerpo, plantilla, grupos, familias, sinCorreo}}   (X-CSRF)
 *   POST {accion: 'prueba', datos: {asunto, cuerpo}}                                                                           (X-CSRF)
 *   POST {accion: 'avance', datos: {idEnvio}}  → cuántos lleva la tanda que se está enviando
 *
 * Cerrojos (el servidor decide; la pantalla solo esconde):
 *   1. requerir_sesion(): sesión y área «mensajes» (carpeta mensajes/ en
 *      CARPETAS_AREA). Hoy: Administrador, Dirección y Comercial. Profesor,
 *      Coordinación, Recepción y Contabilidad reciben 403 sin que salga nada.
 *   2. 5-nov: con el área se puede LEER (armar el grupo, contar familias, ver la
 *      vista previa), pero los correos solo los recibe quien tiene
 *      mensajes.enviar (Dirección y Administrador). A los demás cada familia
 *      les llega con su huella y el estado de su correo, sin el correo.
 *      enviar, prueba y avance piden mensajes.enviar y el sello CSRF;
 *      guardarPlantilla, mensajes.plantillas.
 *   3. Solo salen niños INSCRITOS Y ACTIVOS (ms_familias, igual que en v1).
 *   4. El envío: la pantalla manda las HUELLAS de la tanda; el servidor vuelve
 *      a leer las familias y solo envía a una huella que hoy es de una familia
 *      activa con correo válido y fuera de la lista de exclusión. Un correo por
 *      familia, ella sola en «Para». Nunca dos veces la misma huella en un
 *      mismo envío (archivo del envío, fuera de la carpeta pública). Nunca más
 *      de «Máximo de correos por hora». Un solo envío a la vez en todo el portal.
 *   5. El registro («Mensajes enviados») lo escribe el SERVIDOR con lo que de
 *      verdad pasó: usuario y rol de la sesión, enviadas y fallidas. Nunca correos.
 *   6. Suelta la sesión antes de esperar a Google o al correo (D-068).
 *
 * portal_config.php (fuera de la carpeta pública):
 *     as_exec, as_clave (After School), exec, clave (Base de Datos), msj_clave
 *     y, para enviar (5-nov):
 *     'smtp_host'    => 'el servidor de correo del hosting',
 *     'smtp_puerto'  => 465,
 *     'smtp_usuario' => 'el buzón que envía (también es el remitente)',
 *     'smtp_clave'   => 'la contraseña de ese buzón (la escribe Marco a mano)',
 *   Opcionales: 'smtp_nombre' (por defecto «Vida en Arte»), 'msj_logo' (la
 *   dirección del logo), 'msj_carpeta' (dónde se guardan los envíos; por
 *   defecto portal_mensajes/ junto a portal_config.php).
 *
 * MS_SOLO_FUNCIONES: con esa constante el archivo solo declara sus funciones
 * (las pruebas la usan).
 */
if (!defined('AS_SOLO_FUNCIONES')) define('AS_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/after-school/api.php';
require_once __DIR__ . '/correo.php';
if (!defined('MS_SOLO_FUNCIONES')) require_once dirname(__DIR__) . '/auth.php';

const MS_ACCIONES = ['leer', 'guardarPlantilla', 'enviar', 'prueba', 'avance'];
const MS_ENVIAN = ['enviar', 'prueba', 'avance'];
const MS_ACTIVO = 'activo';                 // el valor de «Estado» (After School) y de «Estado actual» (Kínder), normalizado
const MS_UNIDAD_AS = 'After School';
const MS_UNIDAD_PRE = 'Preschool';
const MS_SERVICIO_FUERA = 'Servicio fuera de Mensajes';
const MS_EXCLUIDO = 'Correo excluido';
const MS_CORREO_PRUEBA = 'Correo de prueba';
const MS_POR_TANDA = 'Destinatarios por tanda';
const MS_MAX_HORA = 'Máximo de correos por hora';
/* Lo que pasa si falta el parámetro en «Config mensajes»: el valor prudente.
   El número de verdad vive en el Sheet (regla: nada de negocio en el código). */
const MS_POR_TANDA_FALTA = 50;
const MS_MAX_HORA_FALTA = 100;
const MS_NOMBRE_FALTA = 'Vida en Arte';
const MS_LOGO_FALTA = 'https://portal.vidaenarte.com/comun/logo-vea.png';
/* Parámetros con correos: nunca salen al navegador (ni a quien envía: no los necesita). */
const MS_PARAMETROS_PRIVADOS = ['Correo excluido', 'Correo de prueba', 'Cuenta de Gmail para mensajes'];
const MS_REGISTRO_INTENTOS = 3;             // «otro guardado en curso»: se espera y se reintenta

if (!defined('MS_SOLO_FUNCIONES')) {
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
$datos = json_decode((string) file_get_contents('php://input'), true);
$accion = is_array($datos) ? (string) ($datos['accion'] ?? '') : '';
if (!in_array($accion, MS_ACCIONES, true)) fallo('Acción desconocida.', 403, 'sin_permiso');
$puedeEnviar = puede('mensajes.enviar');
if (in_array($accion, MS_ENVIAN, true) && !$puedeEnviar) fallo('Tu rol puede armar el mensaje, pero no enviarlo: lo envían Dirección o Administración.', 403, 'sin_permiso');
if ($accion === 'guardarPlantilla' && !puede('mensajes.plantillas')) fallo('Solo Dirección y Administrador editan las plantillas.', 403, 'sin_permiso');
if (in_array($accion, ['enviar', 'prueba'], true) && !csrf_valido($_SERVER['HTTP_X_CSRF'] ?? '')) fallo('Vuelve a abrir Mensajes: la página quedó vieja (sello de seguridad).', 403, 'csrf');

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
$csrf = $puedeEnviar ? csrf_token() : '';
session_write_close();   // soltar la sesión antes de esperar a Google o al correo

$d = is_array($datos['datos'] ?? null) ? $datos['datos'] : [];
$smtp = ms_smtp($cfg, (string) ($_SERVER['SERVER_NAME'] ?? ''));
$carpeta = msj_carpeta($cfg);

if ($accion === 'avance') {
    $id = ms_texto($d['idEnvio'] ?? '', 64);
    if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) fallo('Falta el ID del envío.', 400, 'datos');
    $e = msj_leer_json(msj_ruta_envio($carpeta, $id));
    echo json_encode(['ok' => true, 'resultado' => ['avance' => $e['avance'] ?? null]], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($accion === 'leer') {
    $L = ms_leer_todo($cfg, $usuario);
    $plantillas = array_values(array_filter(array_map('ms_plantilla', (array) ($L['bd']['plantillas'] ?? [])), fn($p) => $p && ($puedePlantillas || $p['activa'])));
    $familias = array_map(function ($f) use ($puedeEnviar) { if (!$puedeEnviar) unset($f['correo']); return $f; }, $L['familias']);
    $hora = msj_cupo(msj_hora($carpeta, time()), $L['maxHora'], 0, time());
    $res = [
        'hoy' => (string) ($L['bd']['hoy'] ?? date('Y-m-d')),
        'familias' => $familias, 'clases' => $L['clases'],
        'config' => ms_config_filas((array) ($L['bd']['config'] ?? [])),
        'plantillas' => $plantillas,
        'enviados' => array_values(array_map('ms_enviado', array_slice((array) ($L['bd']['enviados'] ?? []), 0, 20))),
        'familiasHoy' => (int) ($L['bd']['familiasHoy'] ?? 0),
        'puedePlantillas' => $puedePlantillas, 'puedeEnviar' => $puedeEnviar,
        'usuario' => $usuario, 'rol' => $rol,
    ];
    if ($puedeEnviar) {
        $res['csrf'] = $csrf;
        $res['envio'] = ['listo' => $smtp['listo'], 'remitente' => $smtp['listo'] ? $smtp['nombre'] . ' <' . $smtp['usuario'] . '>' : '',
                         'destinoPrueba' => ms_destino_prueba($L['config'], $usuario, $smtp['usuario']),
                         'porTanda' => $L['porTanda'], 'maxHora' => $L['maxHora'], 'usadosHora' => $hora['usados']];
    }
    echo json_encode(['ok' => true, 'resultado' => $res], JSON_UNESCAPED_UNICODE);
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

/* enviar y prueba: hace falta el buzón configurado. */
if (!$smtp['listo']) fallo('Falta configurar el correo del servidor en portal_config.php (' . implode(', ', $smtp['faltan']) . '). No se envió nada.', 500, 'sin_configuracion');
$asunto = ms_texto($d['asunto'] ?? '', 200);
$cuerpo = rtrim(ms_texto($d['cuerpo'] ?? '', 20000, true));
if ($asunto === '' || trim($cuerpo) === '') fallo('Falta el asunto o el mensaje.', 400, 'datos');
@set_time_limit(300);
ignore_user_abort(true);   // si se cierra la pestaña a mitad, el servidor termina la tanda y anota lo que salió

if ($accion === 'prueba') {
    $L = ms_leer_todo($cfg, $usuario);
    $para = ms_destino_prueba($L['config'], $usuario, $smtp['usuario']);
    $r = ms_enviar_tanda(['carpeta' => $carpeta, 'smtp' => $smtp, 'id' => '', 'huellaMensaje' => '', 'asunto' => '[Prueba] ' . $asunto, 'cuerpo' => $cuerpo,
        'tanda' => 1, 'destinos' => ['prueba' => $para], 'claves' => ['prueba'], 'porTanda' => 1, 'maxHora' => $L['maxHora']]);
    $r['para'] = $para;
    echo json_encode(['ok' => true, 'resultado' => $r], JSON_UNESCAPED_UNICODE);
    exit;
}

// enviar
$id = ms_texto($d['idEnvio'] ?? '', 64);
$tanda = (int) ($d['tanda'] ?? 0); $tandas = (int) ($d['tandas'] ?? 0);
$claves = array_values(array_unique(array_filter(array_map(fn($c) => is_string($c) ? $c : '', (array) ($d['claves'] ?? [])), fn($c) => preg_match('/^[0-9a-f]{32}$/', $c))));
if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) fallo('Falta el ID del envío.', 400, 'datos');
if ($tanda < 1 || $tandas < 1 || $tanda > $tandas || $tandas > 500) fallo('Tanda fuera de rango.', 400, 'datos');
if (!$claves) fallo('La tanda no tiene familias.', 400, 'datos');
$L = ms_leer_todo($cfg, $usuario);
if (count($claves) > $L['porTanda']) fallo('La tanda tiene más familias de las que permite «' . MS_POR_TANDA . '» (' . $L['porTanda'] . '). Vuelve a abrir Mensajes.', 400, 'datos');
$destinos = [];
foreach ($L['familias'] as $f) if ($f['estadoCorreo'] === 'ok') $destinos[$f['clave']] = $f['correo'];
$r = ms_enviar_tanda(['carpeta' => $carpeta, 'smtp' => $smtp, 'id' => $id, 'huellaMensaje' => hash('sha256', $asunto . "\n" . $cuerpo),
    'asunto' => $asunto, 'cuerpo' => $cuerpo, 'tanda' => $tanda, 'destinos' => $destinos, 'claves' => $claves, 'porTanda' => $L['porTanda'], 'maxHora' => $L['maxHora']]);
// El registro: lo que de verdad pasó en todo el envío hasta ahora (si esta tanda no llegó a enviar nada, no hay nada nuevo que anotar).
if (in_array($r['estado'], ['completa', 'detenida'], true)) {
    $reg = ['idEnvio' => $id, 'usuario' => $usuario, 'rol' => $rol,
            'grupos' => ms_sin_correos(ms_texto($d['grupos'] ?? '', 500)), 'familias' => max(0, (int) ($d['familias'] ?? 0)), 'sinCorreo' => max(0, (int) ($d['sinCorreo'] ?? 0)),
            'plantilla' => ms_sin_correos(ms_texto($d['plantilla'] ?? '', 80)), 'asunto' => ms_sin_correos($asunto),
            'tanda' => $tanda, 'tandas' => $tandas, 'enviadas' => $r['total']['enviadas'], 'fallidas' => $r['total']['fallidas']];
    $r['registro'] = ms_registrar($cfg, $usuario, $reg);
}
echo json_encode(['ok' => true, 'resultado' => $r], JSON_UNESCAPED_UNICODE);
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

/** Ningún correo entra al registro, aunque alguien lo escriba en el asunto o en los grupos. */
function ms_sin_correos(string $s): string { return preg_replace('/[^\s@]+@[^\s@]+/', '[correo]', $s); }

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

/**
 * Lee las dos fuentes y arma las familias ya clasificadas. Si alguna no
 * responde, corta (502): un «Todo Vida en Arte» a medias se mandaría sin que
 * nadie lo notara.
 */
function ms_leer_todo(array $cfg, string $usuario): array {
    $bd = ms_llamar($cfg['exec'], $cfg['clave'], $usuario, 'mensajesLeer', [], $cfg['msj_clave'], true);
    if (!$bd) fallo('No se pudo leer la Base de Datos (Preschool, plantillas y configuración). Vuelve a intentarlo en un momento.', 502, 'incierto');
    $as = ms_llamar($cfg['as_exec'], $cfg['as_clave'], $usuario, 'leer', [], '', true);
    if (!$as) fallo('No se pudo leer After School. Vuelve a intentarlo en un momento.', 502, 'incierto');
    $config = (array) ($bd['config'] ?? []);
    $f = ms_familias($as, (array) ($bd['preschool'] ?? []), ms_servicios_fuera($config));
    $f['familias'] = ms_clasificar($f['familias'], ms_valores($config, MS_EXCLUIDO), (string) $cfg['msj_clave']);
    $porTanda = ms_numero($config, MS_POR_TANDA, MS_POR_TANDA_FALTA, 1, 500);
    $maxHora = ms_numero($config, MS_MAX_HORA, MS_MAX_HORA_FALTA, 1, 100000);
    return ['bd' => $bd, 'familias' => $f['familias'], 'clases' => $f['clases'], 'config' => $config,
            'porTanda' => min($porTanda, $maxHora), 'maxHora' => $maxHora];
}

/** Los valores de un parámetro de «Config mensajes» (puede repetirse). */
function ms_valores(array $filas, string $parametro): array {
    $out = [];
    foreach ($filas as $f) if (is_array($f) && ms_norm($f['parametro'] ?? '') === ms_norm($parametro) && trim((string) ($f['valor'] ?? '')) !== '')
        $out[] = trim((string) $f['valor']);
    return $out;
}
/** Un número de «Config mensajes»; fuera de rango o vacío, el de por defecto. */
function ms_numero(array $filas, string $parametro, int $defecto, int $min, int $max): int {
    $v = ms_valores($filas, $parametro);
    $n = $v ? (int) preg_replace('/\D/', '', $v[0]) : 0;
    return ($n >= $min && $n <= $max) ? $n : $defecto;
}

/** Los servicios de After School que no reciben mensajes (Config mensajes). */
function ms_servicios_fuera(array $filas): array { return array_map('ms_norm', ms_valores($filas, MS_SERVICIO_FUERA)); }

/** La configuración (parámetro y valor) para comun/mensajes.js › config, SIN los parámetros con correos. */
function ms_config_filas(array $filas): array {
    $privados = array_map('ms_norm', MS_PARAMETROS_PRIVADOS);
    $out = [];
    foreach ($filas as $f) {
        if (!is_array($f) || trim((string) ($f['parametro'] ?? '')) === '') continue;
        if (in_array(ms_norm($f['parametro']), $privados, true) || str_contains((string) ($f['valor'] ?? ''), '@')) continue;
        $out[] = ['parametro' => trim((string) $f['parametro']), 'valor' => trim((string) ($f['valor'] ?? ''))];
    }
    return $out;
}

/**
 * A cada familia: su correo limpio, la huella del correo («clave», la misma
 * para hermanos) y el estado: ok | vacio | excluido | invalido. Las mismas
 * reglas que tenía comun/mensajes.js (R163–R165), ahora en el servidor, que es
 * el único que conoce la lista de exclusión.
 */
function ms_clasificar(array $familias, array $excluidos, string $secreto): array {
    $ex = array_map('msj_limpiar_correo', $excluidos);
    foreach ($familias as &$f) {
        $c = msj_limpiar_correo($f['correo'] ?? '');
        $estado = $c === '' ? 'vacio' : (in_array($c, $ex, true) ? 'excluido' : (msj_correo_valido($c) ? 'ok' : 'invalido'));
        $f['correo'] = $estado === 'invalido' ? (string) ($f['correo'] ?? '') : ($estado === 'ok' ? $c : '');
        $f['estadoCorreo'] = $estado;
        $f['clave'] = $estado === 'ok' ? msj_huella($c, $secreto) : '';
    }
    return $familias;
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
            'asunto' => (string) ($e['asunto'] ?? ''), 'tandas' => (string) ($e['tandas'] ?? ''),
            'enviadas' => $n($e['enviadas'] ?? null), 'fallidas' => $n($e['fallidas'] ?? null), 'canal' => (string) ($e['canal'] ?? '')];
}

/** El buzón que envía, de portal_config.php. 'listo' = están las cuatro líneas. */
function ms_smtp(array $cfg, string $servidor): array {
    $faltan = [];
    foreach (['smtp_host', 'smtp_puerto', 'smtp_usuario', 'smtp_clave'] as $k) if (empty($cfg[$k])) $faltan[] = $k;
    $usuario = msj_limpiar_correo($cfg['smtp_usuario'] ?? '');
    if (!$faltan && !msj_correo_valido($usuario)) $faltan[] = 'smtp_usuario (no es un correo)';
    $ehlo = preg_replace('/[^A-Za-z0-9.-]/', '', $servidor) ?: 'localhost';
    return ['listo' => !$faltan, 'faltan' => $faltan, 'host' => (string) ($cfg['smtp_host'] ?? ''), 'puerto' => (int) ($cfg['smtp_puerto'] ?? 0),
            'seguridad' => (string) ($cfg['smtp_seguridad'] ?? 'ssl'), 'usuario' => $usuario, 'clave' => (string) ($cfg['smtp_clave'] ?? ''),
            'nombre' => trim((string) ($cfg['smtp_nombre'] ?? '')) ?: MS_NOMBRE_FALTA, 'logo' => (string) ($cfg['msj_logo'] ?? MS_LOGO_FALTA),
            'ehlo' => $ehlo, 'dominio' => substr(strrchr($usuario, '@') ?: '@localhost', 1)];
}

/** «Enviarme una prueba»: el «Correo de prueba» de Config mensajes; si no hay, el usuario si su usuario es un correo; si no, el buzón que envía. */
function ms_destino_prueba(array $config, string $usuario, string $buzon): string {
    foreach (ms_valores($config, MS_CORREO_PRUEBA) as $v) { $c = msj_limpiar_correo($v); if (msj_correo_valido($c)) return $c; }
    $u = msj_limpiar_correo($usuario);
    return msj_correo_valido($u) ? $u : $buzon;
}

/**
 * Envía UNA tanda. $t: carpeta, smtp, id ('' = prueba, sin archivo de envío),
 * huellaMensaje, asunto, cuerpo, tanda, destinos [huella => correo de una
 * familia activa], claves [las huellas que pidió la pantalla], porTanda, maxHora,
 * ahora (opcional, para las pruebas).
 *
 * Devuelve ['estado' => completa | detenida | limite | ocupado | cambiado, …]:
 *   enviadas    huellas que salieron en ESTA llamada
 *   yaEstaban   huellas que ya habían salido antes en este envío (no se repiten)
 *   fallidas    [{clave, motivo}] las que el servidor de correo rechazó o ya no son de una familia activa
 *   inciertas   huellas que pudieron salir (se cortó la respuesta): no se reintentan solas
 *   pendientes  huellas que no se intentaron porque la tanda se detuvo
 *   total       {enviadas, fallidas} de todo el envío (lo que va al registro)
 *   hora        {usados, max, libreA (marca de tiempo desde la que cabe la tanda; 0 = ya cabe)}
 */
function ms_enviar_tanda(array $t): array {
    $ahora = (int) ($t['ahora'] ?? time());
    $carpeta = $t['carpeta']; $id = (string) $t['id'];
    $vacio = ['enviadas' => [], 'yaEstaban' => [], 'fallidas' => [], 'inciertas' => [], 'pendientes' => [], 'total' => ['enviadas' => 0, 'fallidas' => 0], 'motivo' => ''];
    $candado = msj_candado($carpeta);
    if ($candado === false) return array_merge($vacio, ['estado' => 'detenida', 'motivo' => 'El servidor no pudo preparar la carpeta de los envíos (portal_mensajes). No se envió nada.', 'pendientes' => $t['claves']]);
    if (!$candado) return array_merge($vacio, ['estado' => 'ocupado', 'motivo' => 'Hay otro envío en curso en el portal. Espera a que termine y vuelve a pulsar.', 'pendientes' => $t['claves']]);
    try {
        msj_limpiar_viejos($carpeta, $ahora);
        $ruta = $id !== '' ? msj_ruta_envio($carpeta, $id) : '';
        $E = $ruta ? msj_leer_json($ruta) : [];
        if (!$E) $E = ['id' => $id, 'huellaMensaje' => $t['huellaMensaje'], 'creado' => $ahora, 'destinos' => [], 'tandas' => []];
        if ($id !== '' && ($E['huellaMensaje'] ?? '') !== $t['huellaMensaje'])
            return array_merge($vacio, ['estado' => 'cambiado', 'motivo' => 'El mensaje cambió después de enviar una parte. Para mandar el texto nuevo, empieza un envío nuevo.', 'pendientes' => $t['claves']]);
        $guardar = function () use (&$E, $ruta) { if ($ruta) msj_escribir_json($ruta, $E); };

        // Qué falta de esta tanda: primero las que nunca se intentaron, después las que fallaron.
        $nuevas = []; $repetir = []; $res = $vacio;
        foreach ($t['claves'] as $k) {
            $e = $E['destinos'][$k]['e'] ?? '';
            if ($e === 'enviado') $res['yaEstaban'][] = $k;
            elseif ($e === 'incierto') $res['inciertas'][] = $k;
            elseif ($e === 'fallido') $repetir[] = $k;
            else $nuevas[] = $k;
        }
        $cola = array_merge($nuevas, $repetir);
        // Las que hoy ya no son de una familia activa (o cambió su correo): no se envían.
        $cola = array_values(array_filter($cola, function ($k) use ($t, &$E, &$res, $ahora) {
            if (isset($t['destinos'][$k])) return true;
            $E['destinos'][$k] = ['e' => 'fallido', 't' => $ahora, 'm' => 'ya no es una familia activa con ese correo'];
            $res['fallidas'][] = ['clave' => $k, 'motivo' => 'ya no es una familia activa con ese correo'];
            return false;
        }));

        $marcas = msj_hora($carpeta, $ahora);
        $cupo = msj_cupo($marcas, (int) $t['maxHora'], count($cola), $ahora);
        $res['hora'] = ['usados' => $cupo['usados'], 'max' => $cupo['max'], 'libreA' => max(0, $cupo['libreA'])];   // marca de tiempo: la hora la pone la pantalla, en la zona del que mira
        if (!$cola) { $guardar(); return ms_totales(array_merge($res, ['estado' => 'completa']), $E); }
        if (!$cupo['cabe']) {
            $guardar();
            $res['pendientes'] = $cola;
            $res['motivo'] = $cupo['libreA'] < 0 ? 'Esta tanda tiene más familias que el máximo de correos por hora.'
                : 'Con esta tanda se pasaría el máximo de ' . $cupo['max'] . ' correos por hora (en la última hora ya salieron ' . $cupo['usados'] . ').';
            return ms_totales(array_merge($res, ['estado' => 'limite']), $E);
        }

        $E['tandas'][(string) $t['tanda']] = true;
        $E['avance'] = ['tanda' => (int) $t['tanda'], 'hechos' => 0, 'total' => count($cola), 'enCurso' => true];
        $guardar();
        $s = $t['smtp'];
        $con = smtp_abrir($s);
        if (isset($con['error'])) {
            $E['avance']['enCurso'] = false; $guardar();
            $res['pendientes'] = $cola; $res['motivo'] = $con['error'];
            return ms_totales(array_merge($res, ['estado' => 'detenida']), $E);
        }
        $detenida = false;
        foreach ($cola as $i => $k) {
            if ($detenida) { $res['pendientes'][] = $k; continue; }
            $datos = msj_armar(['de' => $s['usuario'], 'nombre' => $s['nombre'], 'para' => $t['destinos'][$k], 'asunto' => $t['asunto'],
                                'cuerpo' => $t['cuerpo'], 'logo' => $s['logo'], 'dominio' => $s['dominio']]);
            $r = smtp_enviar($con['s'], $s['usuario'], $t['destinos'][$k], $datos, function () use (&$E, &$marcas, $k, $guardar, $carpeta, $ahora) {
                // ANTES de que el correo pueda salir: queda «incierto» y cuenta para la hora.
                $E['destinos'][$k] = ['e' => 'incierto', 't' => time()];
                $guardar();
                $marcas[] = time();
                msj_hora_guardar($carpeta, $marcas);
            });
            if ($r['estado'] === 'enviado') { $E['destinos'][$k] = ['e' => 'enviado', 't' => time()]; $res['enviadas'][] = $k; }
            elseif ($r['estado'] === 'incierto') { $res['inciertas'][] = $k; $detenida = true; $res['motivo'] = 'Se cortó la conexión con el servidor de correo: ' . $r['detalle']; }
            else {
                // Rechazado: no salió. Si ya se había contado para la hora (rechazo al final del mensaje), se descuenta.
                if (($E['destinos'][$k]['e'] ?? '') === 'incierto') { array_pop($marcas); msj_hora_guardar($carpeta, $marcas); }
                $E['destinos'][$k] = ['e' => 'fallido', 't' => time(), 'm' => $r['detalle']];
                $res['fallidas'][] = ['clave' => $k, 'motivo' => $r['detalle']];
                $detenida = true;
                $res['motivo'] = 'El servidor de correo rechazó un envío y la tanda se detuvo: ' . $r['detalle'];
            }
            $E['avance']['hechos'] = $i + 1;
            $guardar();
        }
        smtp_cerrar($con['s']);
        $E['avance']['enCurso'] = false;
        $guardar();
        $res['hora'] = ['usados' => count($marcas), 'max' => (int) $t['maxHora'], 'libreA' => 0];
        return ms_totales(array_merge($res, ['estado' => $detenida ? 'detenida' : 'completa']), $E);
    } finally {
        msj_soltar($candado);
    }
}

/** Las cuentas de todo el envío, para el registro: enviadas, y fallidas (rechazadas + las que pudieron salir sin confirmar). */
function ms_totales(array $res, array $E): array {
    $env = 0; $fal = 0;
    foreach ((array) ($E['destinos'] ?? []) as $x) { if (($x['e'] ?? '') === 'enviado') $env++; else $fal++; }
    $res['total'] = ['enviadas' => $env, 'fallidas' => $fal];
    return $res;
}

/** Anota la tanda en «Mensajes enviados». Si el Sheet está ocupado («otro guardado en curso»), espera y reintenta. */
function ms_registrar(array $cfg, string $usuario, array $reg): array {
    $error = null;
    for ($i = 1; $i <= MS_REGISTRO_INTENTOS; $i++) {
        $r = ms_llamar($cfg['exec'], $cfg['clave'], $usuario, 'mensajesRegistrar', $reg, $cfg['msj_clave'], false, $error);
        if ($r) return ['ok' => true, 'tandas' => (string) ($r['tandas'] ?? '')];
        if ($i < MS_REGISTRO_INTENTOS) usleep(2000000);
    }
    return ['ok' => false, 'error' => $error ?: 'el Sheet no respondió'];
}
