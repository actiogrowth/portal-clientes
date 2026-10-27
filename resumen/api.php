<?php
/* Puente del Resumen del negocio (26-oct). Solo Dirección y Administrador
 * (carpeta «resumen» → área resumen, que no tiene nadie más). Contrato en
 * docs/ACCIONES_API.md › Resumen del negocio.
 *
 *   POST {accion: 'leer'} → {hoy, metas[], preschool, finanzas, faltan[]}
 *
 * De dónde sale cada cosa (ninguna cifra se escribe aquí a mano):
 *   · metas      la pestaña «Metas» del Sheet «Procesos — Vida en Arte», por su
 *                Apps Script (pr_exec, la misma copia corta que Equipo).
 *   · preschool  las dos tablas que ya lee el tablero de Preschool
 *                («Datos para análisis» y «Config Kínder», csv.analisis y
 *                csv.config de portal_config.php), con SUS reglas: activo =
 *                «Activo ese mes»; alta = «Fecha ingreso» en el mes; baja =
 *                «Fecha salida» en el mes; ocupación = activos ÷ «Capacidad
 *                máxima». Se calcula AQUÍ y solo salen conteos: ni nombres,
 *                ni IDs, ni montos (la columna de pagos no se lee). Lleva
 *                «nota» (28-oct): «Datos en revisión» hasta que la base de
 *                Preschool se depure; se quita en portal_config.php.
 *   · finanzas   null: todavía no hay fuente (docs/ACCIONES_API.md › Contrato
 *                de finanzas). La pantalla dice «Próximamente».
 *   After School lo lee la pantalla con Datos.afterSchool('leer') como antes.
 *
 * Una fuente que falla no tumba las demás: queda en «faltan» y su parte sale
 * vacía. Suelta la sesión antes de esperar a Google (D-068).
 */
if (!defined('AS_SOLO_FUNCIONES')) define('AS_SOLO_FUNCIONES', true);
if (!defined('EQ_SOLO_FUNCIONES')) define('EQ_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/equipo/api.php';

const RS_CACHE_SEG = 300;   // copia corta de cada CSV de Preschool
/* 28-oct: la nota junto a las cifras de Preschool mientras su base se depura
   (Fase 1). Se cambia o se quita en portal_config.php › preschool_nota
   ('' = sin nota), no aquí; sin esa clave, sale esta (R140). */
const RS_NOTA_PRESCHOOL = 'Datos en revisión';

if (!defined('RS_SOLO_FUNCIONES')) {
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
session_write_close();   // soltar la sesión antes de esperar a Google

$faltan = [];
$cache = dirname(__DIR__, 2) . '/portal_cache';

// Metas (pestaña «Metas» del Sheet de Procesos).
$metas = [];
if (empty($cfg['pr_exec']) || empty($cfg['pr_clave'])) $faltan[] = 'Metas: portal_config.php no tiene pr_exec y pr_clave';
else {
    $ttl = isset($cfg['pr_cache_seg']) ? max(0, (int) $cfg['pr_cache_seg']) : EQ_CACHE_SEG;
    $S = eq_sheet($cfg, $cache . '/equipo.json', $ttl, $usuario, true);
    if ($S === null) $faltan[] = 'Metas: el Sheet de Procesos no respondió';
    else {
        $metas = rs_metas((array) ($S['metas'] ?? []));
        foreach ((array) ($S['faltan'] ?? []) as $f) if (is_string($f) && stripos($f, 'Metas') !== false) $faltan[] = $f;
    }
}

// Preschool (las tablas del tablero de Preschool, sin montos).
$preschool = null;
$urlA = (string) ($cfg['csv']['analisis'] ?? ''); $urlC = (string) ($cfg['csv']['config'] ?? '');
if ($urlA === '' || $urlC === '') $faltan[] = 'Preschool: portal_config.php no tiene csv.analisis y csv.config';
else {
    $ttlCsv = isset($cfg['resumen_cache_seg']) ? max(0, (int) $cfg['resumen_cache_seg']) : RS_CACHE_SEG;
    $a = rs_traer($urlA, $cache . '/resumen-analisis.csv', $ttlCsv);
    $c = rs_traer($urlC, $cache . '/resumen-config.csv', $ttlCsv);
    if ($a === null || $c === null) $faltan[] = 'Preschool: no se pudo leer ' . ($a === null ? '«Datos para análisis»' : '«Config Kínder»');
    else {
        $preschool = rs_preschool(rs_filas($a), rs_filas($c));
        if ($preschool === null) $faltan[] = 'Preschool: «Datos para análisis» no trae la fila de títulos con «ID niño»';
        else $preschool['nota'] = rs_nota_preschool($cfg);
    }
}

echo json_encode(['ok' => true, 'resultado' => ['hoy' => date('Y-m-d'), 'metas' => $metas, 'preschool' => $preschool, 'finanzas' => null, 'faltan' => $faltan]],
    JSON_UNESCAPED_UNICODE);
exit;
}

/* ─── Funciones ───────────────────────────────────────────────────────── */

/** Las metas tal como vienen del Sheet, limpias: solo filas con cifra, unidad, período y valor. */
function rs_metas(array $filas): array {
    $out = [];
    foreach ($filas as $m) {
        if (!is_array($m)) continue;
        $x = ['cifra' => trim((string) ($m['cifra'] ?? '')), 'unidad' => trim((string) ($m['unidad'] ?? '')), 'periodo' => trim((string) ($m['periodo'] ?? '')),
              'valor' => is_numeric($m['valor'] ?? null) ? (float) $m['valor'] : null, 'estado' => trim((string) ($m['estado'] ?? ''))];
        if ($x['cifra'] === '' || $x['unidad'] === '' || !preg_match('/^\d{4}(-\d{2})?$/', $x['periodo']) || $x['valor'] === null) continue;
        $out[] = $x;
    }
    return $out;
}

/** Un CSV publicado, con copia corta fuera de la carpeta pública. null si no se pudo (y no hay copia de hoy). */
function rs_traer(string $url, string $archivo, int $ttl): ?string {
    if (is_file($archivo) && time() - filemtime($archivo) < $ttl) return (string) file_get_contents($archivo);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
                            CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 20]);
    $txt = curl_exec($ch);
    $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($txt === false || $codigo >= 400) return is_file($archivo) && time() - filemtime($archivo) < 86400 ? (string) file_get_contents($archivo) : null;
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $tmp = $archivo . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== false) { @chmod($tmp, 0600); @rename($tmp, $archivo); }
    return (string) $txt;
}

/** La nota de Preschool: la de portal_config.php › preschool_nota si está ('' la quita); si no, RS_NOTA_PRESCHOOL. */
function rs_nota_preschool(array $cfg): string {
    return array_key_exists('preschool_nota', $cfg) && is_scalar($cfg['preschool_nota']) ? trim((string) $cfg['preschool_nota']) : RS_NOTA_PRESCHOOL;
}

/** CSV → filas (respeta comillas y saltos de línea dentro de una celda). */
function rs_filas(string $txt): array {
    $f = fopen('php://memory', 'r+');
    fwrite($f, preg_replace('/^\xEF\xBB\xBF/', '', $txt));
    rewind($f);
    $filas = [];
    while (($r = fgetcsv($f, 0, ',', '"', '')) !== false) $filas[] = array_map(fn($v) => (string) $v, $r);
    fclose($f);
    return $filas;
}

/** Como normalizar() del tablero: sin tildes, minúsculas, un solo espacio. */
function rs_norm(string $s): string {
    $s = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', 'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u']);
}
function rs_cabecera(array $filas, string $marcador, int $desde = 0): int {
    $q = rs_norm($marcador);
    for ($i = $desde; $i < count($filas); $i++) foreach ($filas[$i] as $c) if (rs_norm($c) === $q) return $i;
    return -1;
}
function rs_col(array $cab, string $nombre): int {
    foreach ($cab as $i => $h) if (rs_norm($h) === rs_norm($nombre)) return $i;
    return -1;
}
/** Como fecha() del tablero: AAAA-MM-DD o DD/MM/AAAA; lo demás, null. Devuelve [año, mes]. */
function rs_fecha(string $s): ?array {
    $s = trim($s);
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})/', $s, $m)) return [(int) $m[1], (int) $m[2]];
    if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})#', $s, $m)) return [(int) $m[3], (int) $m[2]];
    return null;
}
/** Como esUno() del tablero («Activo ese mes» lo escribe estabaActivo() como 1 o 0). */
function rs_uno(string $v): bool { return in_array(mb_strtolower(trim($v)), ['1', 'true', 'verdadero', 'si', 'sí', 'x'], true); }
/** Como aNumero() del tablero (coma o punto decimal, separador de miles). */
function rs_numero(string $v): ?float {
    $s = preg_replace('/[$\s\x{00A0}]/u', '', trim($v));
    if (!preg_match('/^[-+]?[\d.,]*\d[\d.,]*$/', $s)) return null;
    $ic = strrpos($s, ','); $ip = strrpos($s, '.'); $dec = -1;
    if ($ic !== false && $ip !== false) $dec = max($ic, $ip);
    elseif ($ic !== false || $ip !== false) {
        $pos = $ic !== false ? $ic : $ip; $sep = $s[$pos];
        if (substr_count($s, $sep) === 1 && strlen($s) - $pos - 1 !== 3) $dec = $pos;
    }
    $s = $dec >= 0 ? str_replace([',', '.'], '', substr($s, 0, $dec)) . '.' . str_replace([',', '.'], '', substr($s, $dec + 1)) : str_replace([',', '.'], '', $s);
    return is_numeric($s) ? (float) $s : null;
}

/**
 * Preschool con las reglas del tablero de Preschool (kinder/index.html ›
 * calcular). Solo las filas de Kínder; el año es el de los datos y los
 * meses llegan hasta el del sello («generado_en»): los posteriores son
 * proyección y no se cuentan.
 * → {anio, corte, sello, capacidad, meses: {'AAAA-MM': {activos, altas, bajas}}} o null sin títulos.
 */
function rs_preschool(array $A, array $C): ?array {
    $i = rs_cabecera($A, 'ID niño');
    if ($i < 0) return null;
    $cab = $A[$i];
    $cId = rs_col($cab, 'ID niño'); $cUni = rs_col($cab, 'Unidad'); $cMes = rs_col($cab, 'Mes #'); $cAnio = rs_col($cab, 'Año');
    $cAct = rs_col($cab, 'Activo ese mes'); $cIng = rs_col($cab, 'Fecha ingreso'); $cSal = rs_col($cab, 'Fecha salida'); $cSello = rs_col($cab, 'generado_en');
    $sello = ''; $anio = null; $ninos = [];
    for ($k = $i + 1; $k < count($A); $k++) {
        $r = $A[$k];
        if (trim(implode('', $r)) === '') continue;
        if ($cSello >= 0 && $sello === '' && trim($r[$cSello] ?? '') !== '') $sello = trim($r[$cSello]);
        if ($cUni >= 0 && !preg_match('/k[íi]nder/iu', $r[$cUni] ?? '')) continue;
        $id = trim($r[$cId] ?? '');
        if ($id === '') continue;
        $a = (int) ($r[$cAnio] ?? 0);
        if ($anio === null && $a) $anio = $a;
        $n = &$ninos[$id];
        if ($n === null) $n = ['ing' => null, 'sal' => null, 'meses' => []];
        if ($n['ing'] === null && $cIng >= 0) $n['ing'] = rs_fecha($r[$cIng] ?? '');
        if ($n['sal'] === null && $cSal >= 0) $n['sal'] = rs_fecha($r[$cSal] ?? '');
        $m = (int) ($r[$cMes] ?? 0);
        if ($m >= 1 && $m <= 12) $n['meses'][$m] = $cAct >= 0 && rs_uno($r[$cAct] ?? '');
        unset($n);
    }
    $corte = null;
    if ($anio !== null && preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $sello, $s)) {
        $corte = (int) $s[1] > $anio ? 12 : ((int) $s[1] < $anio ? 0 : (int) $s[2]);
    }
    $hasta = $corte === null ? 12 : $corte;
    $meses = [];
    if ($anio !== null) for ($m = 1; $m <= $hasta; $m++) {
        $act = 0; $alt = 0; $baj = 0;
        foreach ($ninos as $n) {
            if (!empty($n['meses'][$m])) $act++;
            if ($n['ing'] && $n['ing'][0] === $anio && $n['ing'][1] === $m) $alt++;
            if ($n['sal'] && $n['sal'][0] === $anio && $n['sal'][1] === $m) $baj++;
        }
        $meses[sprintf('%04d-%02d', $anio, $m)] = ['activos' => $act, 'altas' => $alt, 'bajas' => $baj];
    }
    // «Capacidad máxima» de «Config Kínder» (tabla de PARÁMETRO / VALOR).
    $capacidad = null;
    $iP = rs_cabecera($C, 'PARÁMETRO');
    if ($iP >= 0) {
        $cP = max(0, rs_col($C[$iP], 'parametro')); $cV = rs_col($C[$iP], 'valor'); if ($cV < 0) $cV = 1;
        for ($k = $iP + 1; $k < count($C); $k++) {
            if (trim(implode('', $C[$k])) === '') break;   // la primera fila vacía termina esa tabla
            if (rs_norm($C[$k][$cP] ?? '') === rs_norm('Capacidad máxima')) { $v = rs_numero($C[$k][$cV] ?? ''); $capacidad = $v !== null && $v > 0 ? $v : null; }
        }
    }
    return ['anio' => $anio, 'corte' => $corte, 'sello' => substr($sello, 0, 10), 'capacidad' => $capacidad, 'meses' => (object) $meses];
}
