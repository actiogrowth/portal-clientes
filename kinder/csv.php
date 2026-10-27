<?php
/* Trae del Sheet la tabla que pida el tablero de Preschool. Solo para quien
 * tiene sesión en el portal. Las direcciones viven en portal_config.php, en
 * el servidor.
 *
 * 28-oct: LO FINANCIERO NO SALE DE AQUÍ. Lo de dinero se va a Finanzas y el
 * tablero queda operativo (D-083, R138). El CSV no se pasa entero: se arma
 * de nuevo con una lista CERRADA de columnas y de parámetros. Lo que no está
 * en la lista no llega al navegador, aunque mañana el Sheet agregue columnas.
 *   · analisis  «Datos para análisis», solo filas de Kínder y solo las
 *               columnas de KI_COLUMNAS. «Pago del mes ($)» NO sale: en su
 *               lugar va «Pagó el mes» = Sí (hay un pago mayor que cero) o
 *               No. «Plan» tampoco sale: hoy no se registra (R139).
 *   · config    «Config Kínder»: de PARÁMETRO / VALOR solo los parámetros de
 *               KI_PARAMETROS (ni tarifas ni costos), y de la tabla de
 *               salones solo GRUPO, CAPACIDAD y ACTIVO.
 * La pestaña «Kínder» ya no se pide: trae Responsable y pagos.
 */
require_once dirname(__DIR__) . '/auth.php';

const KI_COLUMNAS = ['ID niño', 'Unidad', 'Mes #', 'Mes', 'Año', 'Activo ese mes', 'Fecha ingreso', 'Fecha salida',
                     'Fecha de nacimiento', 'Grupo', 'generado_en', 'Nombre del niño', 'Motivo de salida'];
const KI_PAGO     = 'Pago del mes ($)';
const KI_PAGO_SI  = 'Pagó el mes';
/* Las redacciones que acepta el tablero (p() en kinder/index.html). */
const KI_PARAMETROS = ['Capacidad máxima', 'capacidad_maxima', 'Meta de niños', 'meta_ninos', 'Meta niños', 'Meta',
                       'Fecha meta', 'fecha_meta', 'Fecha de meta'];
const KI_SALONES  = ['GRUPO', 'CAPACIDAD', 'ACTIVO'];

if (!defined('KI_SOLO_FUNCIONES')) {
requerir_sesion();
// 23-oct: soltar la sesión antes de esperar a Google (si no, los pedidos del mismo
// usuario hacen fila). Desde aquí la sesión no se usa.
session_write_close();

header('Cache-Control: private, no-store');

$tabla = (string) ($_GET['tabla'] ?? '');
if (!in_array($tabla, ['analisis', 'config'], true)) ki_cortar(400, 'tabla no reconocida');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) ki_cortar(500, 'falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
$url = $cfg['csv'][$tabla] ?? '';
if (!$url) ki_cortar(500, 'falta la dirección del CSV de ' . $tabla . ' en portal_config.php');

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_CONNECTTIMEOUT => 20,
]);
$respuesta = curl_exec($ch);
$error     = curl_error($ch);
$codigo    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($respuesta === false) ki_cortar(502, 'sin conexión con el Sheet: ' . $error);
if ($codigo >= 400)       ki_cortar(502, 'el Sheet respondió con el código ' . $codigo);

$filas = ki_filas((string) $respuesta);
$salida = $tabla === 'analisis' ? ki_analisis($filas) : ki_config($filas);
if ($salida === null) ki_cortar(502, $tabla === 'analisis'
    ? 'se leyó el CSV pero ninguna fila contiene «ID niño»: no se encontró el encabezado'
    : 'se leyó el CSV pero ninguna fila contiene «PARÁMETRO»: no se encontró el encabezado');

header('Content-Type: text/csv; charset=utf-8');
echo ki_csv($salida);
exit;
}

/* ─── Funciones ───────────────────────────────────────────────────────── */

function ki_cortar(int $codigo, string $msg): void {
    http_response_code($codigo);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

/** CSV → filas (respeta comillas y saltos de línea dentro de una celda). */
function ki_filas(string $txt): array {
    $f = fopen('php://memory', 'r+');
    fwrite($f, preg_replace('/^\xEF\xBB\xBF/', '', $txt));
    rewind($f);
    $filas = [];
    while (($r = fgetcsv($f, 0, ',', '"', '')) !== false) $filas[] = array_map(fn($v) => (string) $v, $r);
    fclose($f);
    return $filas;
}

/** Filas → CSV. */
function ki_csv(array $filas): string {
    $f = fopen('php://memory', 'r+');
    foreach ($filas as $r) fputcsv($f, $r, ',', '"', '');
    rewind($f);
    $txt = stream_get_contents($f);
    fclose($f);
    return $txt;
}

/** Como normalizar() del tablero: sin tildes, minúsculas, un solo espacio. */
function ki_norm(string $s): string {
    $s = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
}
function ki_cabecera(array $filas, string $marcador, int $desde = 0): int {
    $q = ki_norm($marcador);
    for ($i = $desde; $i < count($filas); $i++) foreach ($filas[$i] as $c) if (ki_norm($c) === $q) return $i;
    return -1;
}
function ki_col(array $cab, string $nombre): int {
    foreach ($cab as $i => $h) if (ki_norm($h) === ki_norm($nombre)) return $i;
    return -1;
}

/** ¿El monto del mes es un pago? Un número mayor que cero, escrito con coma o con punto. */
function ki_pago(string $v): bool {
    $s = preg_replace('/[$\s\x{00A0}.,]/u', '', trim($v));
    return preg_match('/^\+?\d+$/', $s) === 1 && (int) ltrim($s, '+') > 0;
}

/**
 * «Datos para análisis» sin dinero: los títulos de KI_COLUMNAS que existan,
 * más «Pagó el mes», y solo las filas de Kínder. null si no hay títulos.
 */
function ki_analisis(array $A): ?array {
    $i = ki_cabecera($A, 'ID niño');
    if ($i < 0) return null;
    $cab = $A[$i];
    $cols = [];
    foreach (KI_COLUMNAS as $nombre) { $c = ki_col($cab, $nombre); if ($c >= 0) $cols[$nombre] = $c; }
    $cPago = ki_col($cab, KI_PAGO);
    $cUni = $cols['Unidad'] ?? -1;
    $salida = [array_merge(array_keys($cols), $cPago >= 0 ? [KI_PAGO_SI] : [])];
    for ($k = $i + 1; $k < count($A); $k++) {
        $r = $A[$k];
        if (trim(implode('', $r)) === '') continue;
        if ($cUni >= 0 && !preg_match('/k[íi]nder/iu', $r[$cUni] ?? '')) continue;
        $fila = [];
        foreach ($cols as $c) $fila[] = $r[$c] ?? '';
        if ($cPago >= 0) $fila[] = ki_pago($r[$cPago] ?? '') ? 'Sí' : 'No';
        $salida[] = $fila;
    }
    return $salida;
}

/**
 * «Config Kínder» sin dinero: los parámetros de KI_PARAMETROS y la tabla de
 * salones con sus tres columnas. null si no está la tabla de parámetros.
 */
function ki_config(array $C): ?array {
    $iP = ki_cabecera($C, 'PARÁMETRO');
    if ($iP < 0) return null;
    $cP = max(0, ki_col($C[$iP], 'parametro')); $cV = ki_col($C[$iP], 'valor'); if ($cV < 0) $cV = 1;
    $permitidos = array_map('ki_norm', KI_PARAMETROS);
    $salida = [['PARÁMETRO', 'VALOR']];
    $k = $iP + 1;
    for (; $k < count($C); $k++) {
        if (trim(implode('', $C[$k])) === '') break;   // la primera fila vacía termina esa tabla
        $etq = trim($C[$k][$cP] ?? '');
        if (in_array(ki_norm($etq), $permitidos, true)) $salida[] = [$etq, trim($C[$k][$cV] ?? '')];
    }
    $iG = ki_cabecera($C, 'GRUPO', $k);
    if ($iG >= 0) {
        $cols = array_map(fn($n) => ki_col($C[$iG], $n), KI_SALONES);
        $salida[] = [''];
        $salida[] = KI_SALONES;
        for ($j = $iG + 1; $j < count($C); $j++) {
            if (trim(implode('', $C[$j])) === '') break;
            $salida[] = array_map(fn($c) => $c >= 0 ? trim($C[$j][$c] ?? '') : '', $cols);
        }
    }
    return $salida;
}
