<?php
/* Puente de «Pendientes de hoy» (26-oct), la tarjeta de la portada. Lo abre
 * cualquier rol (carpeta «pendientes» → área equipo, que tienen todos) y a
 * cada uno le devuelve SOLO lo que le toca actuar, decidido aquí con sus
 * permisos (docs/REGLAS_NEGOCIO.md R130):
 *
 *   sinLista   Clases de hoy sin lista        as.seguimiento y as.lista.marcar
 *   pruebas    Pruebas sin resultado          el permiso de «resultadoPrueba» (as.completo)
 *   revisar    Listas sin revisar             los puestos que verifica o de los que es jefe
 *   contratos  Contratos por validar          equipo.todo (Dirección y Administrador)
 *
 *   POST {accion: 'leer'} → {hoy, items: [{clave, n, url}]}   (n = null si su fuente no respondió)
 *
 * Solo salen conteos: ni nombres de niños ni de puestos. Lo que el rol no
 * tiene no se calcula y su fuente ni se consulta. Contrato en
 * docs/ACCIONES_API.md › Pendientes de hoy. Suelta la sesión antes de
 * esperar a Google (D-068).
 */
if (!defined('AS_SOLO_FUNCIONES')) define('AS_SOLO_FUNCIONES', true);
if (!defined('EQ_SOLO_FUNCIONES')) define('EQ_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/equipo/api.php';

const PE_CACHE_SEG = 60;   // copia corta de lo que trae After School

if (!defined('PE_SOLO_FUNCIONES')) {
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg)) fallo('portal_config.php no se puede leer');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos) || ($datos['accion'] ?? '') !== 'leer') fallo('Acción desconocida.', 403, 'sin_permiso');

$usuario = usuario_actual();
$roles = roles_actuales();
$nombresRol = array_values(array_filter(array_map(fn($r) => ROLES[$r]['nombre'] ?? '', $roles)));
$puede = pe_que_ve($roles);
session_write_close();   // soltar la sesión antes de esperar a Google

$cache = dirname(__DIR__, 2) . '/portal_cache';
$hoy = date('Y-m-d');
$items = [];

// After School: solo lo que el rol puede atender (y solo entonces se consulta).
if ($puede['sinLista'] || $puede['pruebas']) {
    $hayAS = !empty($cfg['as_exec']) && !empty($cfg['as_clave']);
    if ($puede['sinLista']) {
        $SEG = $hayAS ? pe_as($cfg, 'seguimiento', $cache . '/pendientes-seguimiento.json', $usuario) : null;
        $items[] = ['clave' => 'sinLista', 'url' => '/after-school/#seguimiento', 'n' => $SEG === null ? null : pe_sin_lista($SEG)];
    }
    if ($puede['pruebas']) {
        $E = $hayAS ? pe_as($cfg, 'leer', $cache . '/pendientes-leer.json', $usuario) : null;
        $items[] = ['clave' => 'pruebas', 'url' => '/after-school/#pruebas', 'n' => $E === null ? null : pe_pruebas($E)];
    }
}

// Equipo: lo que revisa y, para Dirección y Administrador, los contratos por validar.
if (!empty($cfg['pr_exec']) && !empty($cfg['pr_clave'])) {
    $ttl = isset($cfg['pr_cache_seg']) ? max(0, (int) $cfg['pr_cache_seg']) : EQ_CACHE_SEG;
    $S = eq_sheet($cfg, $cache . '/equipo.json', $ttl, $usuario, true);
    $V = $S === null ? null : eq_vista($S, $usuario, $roles, $nombresRol, $puede['contratos']);
    if ($V === null || $V['respuesta']['revisar'] || $puede['contratos'])
        $items[] = ['clave' => 'revisar', 'url' => '/equipo/#revisar', 'n' => $V === null ? null : pe_sin_revisar($V['respuesta'], $puede['contratos'])];
    if ($puede['contratos']) $items[] = ['clave' => 'contratos', 'url' => '/procesos/#equipo', 'n' => $V === null ? null : pe_borradores($V['respuesta'])];
}

echo json_encode(['ok' => true, 'resultado' => ['hoy' => $hoy, 'items' => $items]], JSON_UNESCAPED_UNICODE);
exit;
}

/* ─── Funciones ───────────────────────────────────────────────────────── */

/** Qué pendientes puede atender este rol. */
function pe_que_ve(array $roles): array {
    return [
        'sinLista'  => roles_permiten($roles, 'as.seguimiento') && roles_permiten($roles, 'as.lista.marcar'),
        'pruebas'   => roles_permiten($roles, permiso_de_accion_as('resultadoPrueba')),
        'contratos' => roles_permiten($roles, 'equipo.todo'),
    ];
}

/** Una lectura de After School (con copia corta compartida: solo se cuentan cosas, nada sale de aquí). null si no respondió. */
function pe_as(array $cfg, string $accion, string $archivo, string $usuario): ?array {
    $c = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : null;
    if (is_array($c) && isset($c['t'], $c['r']) && time() - $c['t'] < PE_CACHE_SEG) return $c['r'];
    $envio = envio_para($cfg['as_clave'], $usuario, ['accion' => $accion, 'datos' => []]);
    $res = llamar_apps_script($accion, $cfg['as_exec'], $envio['json'], 'pedir',
        function ($s) { usleep((int) ($s * 1000000)); },
        function ($linea) { error_log('pendientes: ' . $linea); },
        function () { return microtime(true); });
    $j = $res['http'] === 200 ? json_decode($res['cuerpo'], true) : null;
    if (!is_array($j) || ($j['ok'] ?? false) !== true || !is_array($j['resultado'] ?? null)) return null;
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $tmp = $archivo . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode(['t' => time(), 'r' => $j['resultado']], JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) { @chmod($tmp, 0600); @rename($tmp, $archivo); }
    return $j['resultado'];
}

/** Clases de hoy sin lista (R112, las de la fecha de hoy). */
function pe_sin_lista(array $SEG): int {
    $hoy = (string) ($SEG['hoy'] ?? date('Y-m-d'));
    return count(array_filter((array) ($SEG['clasesSinLista'] ?? []), fn($c) => is_array($c) && (string) ($c['fecha'] ?? '') === $hoy));
}
/** Pruebas sin resultado: ya pasó su día y siguen «Agendada». */
function pe_pruebas(array $E): int {
    $hoy = (string) ($E['hoy'] ?? date('Y-m-d'));
    return count(array_filter((array) ($E['pruebas'] ?? []), fn($p) => is_array($p) && ($p['estado'] ?? '') === 'Agendada' && (string) ($p['fecha'] ?? '') < $hoy));
}
/** Listas sin revisar: cada puesto y período con marcas y sin revisión de ese período, de los puestos que revisa (con equipo.todo, de todos los abiertos). */
function pe_sin_revisar(array $R, bool $todo): int {
    $n = 0;
    $ids = $todo ? array_map(fn($p) => (string) $p['id'], array_filter((array) ($R['puestos'] ?? []), fn($p) => eq_abierto($p))) : (array) ($R['revisar'] ?? []);
    foreach ($ids as $id) {
        $f = ((array) $R['fichas'])[$id] ?? null;
        if (!is_array($f)) continue;
        $revisados = array_map(fn($r) => (string) ($r['periodo'] ?? ''), (array) ($f['revisiones'] ?? []));
        foreach (array_unique(array_map(fn($m) => (string) ($m['periodo'] ?? ''), (array) ($f['marcas'] ?? []))) as $per)
            if (!in_array($per, $revisados, true)) $n++;
    }
    return $n;
}
/** Contratos por validar: puestos en Borrador. */
function pe_borradores(array $R): int {
    return count(array_filter((array) ($R['puestos'] ?? []), fn($p) => eq_norm((string) ($p['estado'] ?? '')) === 'borrador'));
}
