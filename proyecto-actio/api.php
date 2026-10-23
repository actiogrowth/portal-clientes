<?php
/* Puente de Proyecto Actio (22-oct): lo que Actio Growth le entrega a Vida en
 * Arte. SOLO LECTURA del Sheet «Datos — Vida en Arte», a través de su propio
 * Apps Script (proyecto-actio-script/ProyectoActio.gs). Contrato en
 * docs/ACCIONES_API.md › Proyecto Actio.
 *
 * Reutiliza el transporte de after-school/api.php (reintentos, redirección a
 * mano, esperas) cargándolo con AS_SOLO_FUNCIONES: solo sus funciones.
 *
 * Cerrojos:
 *   1. requerir_sesion(): sesión y área «proyecto-actio» (carpeta
 *      /proyecto-actio/): solo Administrador y Dirección.
 *   2. Una sola acción, «leer».
 *   3. EL RECORTE ES DE ESTE ARCHIVO, no de la pantalla: quien no tiene
 *      pa.internos (Dirección) recibe solo lo visible para el cliente:
 *        · «Visible para el cliente» = Sí → se envía, aunque sea de Proyecto 2;
 *        · = No → nunca se envía;
 *        · vacío (o sin la columna) → regla por proyecto: solo los de
 *          pa_proyectos_cliente. Un documento con la celda vacía hereda la
 *          visibilidad de su entregable (como hereda su proyecto).
 *      Reuniones y Atención directa: solo la regla por proyecto.
 *      Quien tiene pa.internos (Administrador) recibe todo, con soloActio en
 *      lo que no es de un proyecto del cliente y ocultoCliente en lo que
 *      Dirección no ve.
 *   4. Lista blanca de campos por tabla: aunque el script mandara de más
 *      (p. ej. «Notas» u «Origen duración» de Atención directa), no sale.
 *
 * Copia en el servidor: la respuesta completa del script se guarda
 * pa_cache_seg segundos (300 por defecto) en portal_cache/, FUERA de la
 * carpeta pública; si Google no responde, se usa la copia de menos de un día.
 *
 * portal_config.php (fuera de la carpeta pública) lleva, para esta área:
 *     'pa_exec'              => 'https://script.google.com/macros/s/…/exec',
 *     'pa_clave'             => 'la misma que PA_CLAVE_API en el Apps Script',
 *     'pa_proyectos_cliente' => ['Proyecto 1'],   // los que ve Vida en Arte
 *     'pa_cache_seg'         => 300,              // opcional
 */
define('AS_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/after-school/api.php';
require_once dirname(__DIR__) . '/auth.php';

/* Lo único que sale de cada tabla, en este orden. */
const PA_CAMPOS = [
    'entregables' => ['id', 'unidad', 'entregable', 'segmento', 'estado', 'avance', 'fechaCompromiso', 'fechaReal', 'proyecto'],
    'documentos'  => ['nombre', 'unidad', 'segmento', 'tipo', 'fecha', 'enlace', 'idEntregable', 'proyecto'],
    'reuniones'   => ['fecha', 'tema', 'minuta', 'grabacion', 'proyecto'],
    'atencion'    => ['fecha', 'tipo', 'duracionMin', 'asunto', 'unidad', 'enlace', 'proyecto'],
];
const PA_CACHE_SEG = 300;          // si portal_config.php no dice otra cosa
const PA_COPIA_MAX_SEG = 86400;    // una copia más vieja que esto no se usa ni aunque Google falle

/* 23-oct: procesos/api.php carga este archivo con PA_SOLO_FUNCIONES para usar
   la misma lectura, la misma copia y el mismo recorte (pa_*). */
if (!defined('PA_SOLO_FUNCIONES')) {
    requerir_sesion();
    pa_cabeceras();
    $cfg = pa_config([]);
    pa_exigir_leer();
    $internos = roles_permiten(roles_actuales(), 'pa.internos');
    $l = pa_leer_catalogo($cfg);
    echo pa_recortar($l['cuerpo'], $internos, $cfg['pa_proyectos_cliente'], $l['edad']);
    exit;
}

function pa_cabeceras(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
}

/** portal_config.php con lo de Proyecto Actio y, además, las claves $extra; si falta algo, corta nombrándolo. */
function pa_config(array $extra): array {
    $rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
    if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
    $cfg = require $rutaConfig;
    $cliente = is_array($cfg) ? ($cfg['pa_proyectos_cliente'] ?? null) : null;
    if (!is_array($cfg) || empty($cfg['pa_exec']) || empty($cfg['pa_clave']) || !is_array($cliente) || !$cliente)
        fallo('portal_config.php no tiene pa_exec, pa_clave y pa_proyectos_cliente para Proyecto Actio', 500, 'sin_configuracion');
    $faltan = array_values(array_filter($extra, fn($k) => !isset($cfg[$k]) || !is_array($cfg[$k]) || !$cfg[$k]));
    if ($faltan) fallo('portal_config.php no tiene ' . implode(', ', $faltan), 500, 'sin_configuracion');
    return $cfg;
}

/** Solo POST {accion: 'leer'}. */
function pa_exigir_leer(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
    $datos = json_decode(file_get_contents('php://input'), true);
    if (!is_array($datos) || ($datos['accion'] ?? '') !== 'leer') fallo('Solo se puede leer.', 403, 'sin_permiso');
}

/**
 * La respuesta completa del script ({cuerpo, edad}): de la copia si tiene
 * menos de pa_cache_seg; si no, de Google; si Google falla, la copia de menos
 * de un día. Si no hay nada que dar, responde el error y corta.
 */
function pa_leer_catalogo(array $cfg): array {
    $archivo = dirname(__DIR__, 2) . '/portal_cache/proyecto-actio.json';
    $ttl = isset($cfg['pa_cache_seg']) ? max(0, (int) $cfg['pa_cache_seg']) : PA_CACHE_SEG;
    $copia = pa_leer_copia($archivo);
    $edad = $copia ? time() - $copia['t'] : null;
    if ($copia && $edad < $ttl) {
        return ['cuerpo' => $copia['cuerpo'], 'edad' => $edad];
    }
    $envio = envio_para($cfg['pa_clave'], usuario_actual(), ['accion' => 'leer', 'datos' => []]);
    $res = llamar_apps_script('leer', $cfg['pa_exec'], $envio['json'], 'pedir',
        function ($s) { usleep((int) ($s * 1000000)); },
        function ($linea) { error_log('proyecto-actio: ' . $linea); },
        function () { return microtime(true); });
    $j = $res['http'] === 200 ? json_decode($res['cuerpo'], true) : null;
    if (is_array($j) && ($j['ok'] ?? false) === true) {
        pa_guardar_copia($archivo, $res['cuerpo']);
        return ['cuerpo' => $res['cuerpo'], 'edad' => null];
    }
    if ($copia && $edad < PA_COPIA_MAX_SEG) {        // Google no respondió: la copia, diciendo de cuándo es
        error_log('proyecto-actio: el Sheet no respondió; se entrega la copia de hace ' . $edad . ' s');
        return ['cuerpo' => $copia['cuerpo'], 'edad' => $edad];
    }
    http_response_code($res['http'] === 200 ? 502 : $res['http']);
    echo is_array($j) ? json_encode(['ok' => false, 'error' => (string) ($j['error'] ?? 'El Sheet respondió con un error.'), 'codigo' => (string) ($j['codigo'] ?? '')], JSON_UNESCAPED_UNICODE) : $res['cuerpo'];
    exit;
}

/* ─── Copia en el servidor ─────────────────────────────────────────────── */

function pa_leer_copia(string $archivo): ?array {
    if (!is_file($archivo)) return null;
    $c = json_decode((string) @file_get_contents($archivo), true);
    return is_array($c) && isset($c['t'], $c['cuerpo']) && is_string($c['cuerpo']) ? $c : null;
}

function pa_guardar_copia(string $archivo, string $cuerpo): void {
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $tmp = $archivo . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode(['t' => time(), 'cuerpo' => $cuerpo], JSON_UNESCAPED_UNICODE), LOCK_EX) === false) return;
    @chmod($tmp, 0600);
    @rename($tmp, $archivo);
}

/* ─── Recorte por rol ──────────────────────────────────────────────────── */

function pa_norm(string $s): string { return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $s))); }

/** «Visible para el cliente»: 'si', 'no' o '' (vacío o cualquier otra cosa: rige la regla por proyecto). */
function pa_visible(string $v): string {
    $v = strtr(pa_norm($v), ['í' => 'i']);
    if (in_array($v, ['si', 's', 'x', 'yes', 'true', '1'], true)) return 'si';
    if (in_array($v, ['no', 'n', 'false', '0'], true)) return 'no';
    return '';
}

/**
 * La respuesta del script, recortada para quien pregunta. $internos: si ve lo
 * que no es del cliente. $cliente: los proyectos que ve Vida en Arte. Una fila
 * sin proyecto queda con el primero del cliente; un documento sin proyecto,
 * con el de su entregable.
 */
function pa_recortar(string $cuerpo, bool $internos, array $cliente, ?int $edad): string {
    $j = json_decode($cuerpo, true);
    if (!is_array($j) || ($j['ok'] ?? false) !== true || !is_array($j['resultado'] ?? null)) {
        return json_encode(['ok' => false, 'error' => 'La respuesta del Sheet no se pudo leer.', 'codigo' => 'incierto'], JSON_UNESCAPED_UNICODE);
    }
    $r = $j['resultado'];
    $deCliente = array_map('pa_norm', array_map('strval', $cliente));
    $porDefecto = (string) $cliente[0];
    $proyEntregable = []; $visEntregable = [];
    foreach (is_array($r['entregables'] ?? null) ? $r['entregables'] : [] as $e) {
        if (!is_array($e) || !isset($e['id'])) continue;
        $proyEntregable[(string) $e['id']] = trim((string) ($e['proyecto'] ?? ''));
        $visEntregable[(string) $e['id']] = pa_visible((string) ($e['visibleCliente'] ?? ''));
    }
    $out = ['generado' => (string) ($r['generado'] ?? ''), 'proyectos' => []];
    $vistos = [];
    foreach (PA_CAMPOS as $tabla => $campos) {
        $out[$tabla] = [];
        foreach (is_array($r[$tabla] ?? null) ? $r[$tabla] : [] as $f) {
            if (!is_array($f)) continue;
            $p = trim((string) ($f['proyecto'] ?? ''));
            if ($p === '' && $tabla === 'documentos') $p = $proyEntregable[(string) ($f['idEntregable'] ?? '')] ?? '';
            if ($p === '') $p = $porDefecto;
            $soloActio = !in_array(pa_norm($p), $deCliente, true);
            $v = in_array($tabla, ['entregables', 'documentos'], true) ? pa_visible((string) ($f['visibleCliente'] ?? '')) : '';
            if ($v === '' && $tabla === 'documentos') $v = $visEntregable[(string) ($f['idEntregable'] ?? '')] ?? '';
            $alCliente = $v === 'si' ? true : ($v === 'no' ? false : !$soloActio);
            if (!$alCliente && !$internos) continue;           // Dirección: lo que no es para el cliente no sale del servidor
            $fila = [];
            foreach ($campos as $c) $fila[$c] = $f[$c] ?? '';
            $fila['proyecto'] = $p;
            $fila['soloActio'] = $internos && $soloActio;       // a Dirección no le llega lo interno
            $fila['ocultoCliente'] = $internos && !$alCliente;
            $out[$tabla][] = $fila;
            $vistos[$p] = ($vistos[$p] ?? true) && $fila['soloActio'];
        }
    }
    // Primero los del cliente, en el orden de la configuración; después los demás.
    foreach ($cliente as $c) foreach ($vistos as $p => $s) if (!$s && pa_norm($p) === pa_norm((string) $c)) { $out['proyectos'][] = $p; unset($vistos[$p]); }
    $resto = array_keys($vistos); sort($resto, SORT_NATURAL); $out['proyectos'] = array_merge($out['proyectos'], $resto);
    $out['faltan'] = array_values(array_filter(is_array($r['faltan'] ?? null) ? $r['faltan'] : [], 'is_string'));
    $resp = ['ok' => true, 'resultado' => $out];
    if ($edad !== null) $resp['copia'] = ['segundos' => $edad];
    return json_encode($resp, JSON_UNESCAPED_UNICODE);
}
