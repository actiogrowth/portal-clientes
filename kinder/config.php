<?php
/* Le dice al tablero por dónde pedir cada tabla. Nunca entrega las
   direcciones reales del Sheet: solo rutas de este mismo portal. */
require dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: private, no-store');

$csv = [];
$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (is_file($rutaConfig)) {
    $cfg = require $rutaConfig;
    $csv = isset($cfg['csv']) && is_array($cfg['csv']) ? $cfg['csv'] : [];
}

/* Una tabla sin dirección configurada se deja vacía a propósito: el tablero
   ya sabe decir en pantalla cuál le falta. */
$ruta = function (string $tabla) use ($csv): string {
    return empty($csv[$tabla]) ? '' : 'csv.php?tabla=' . $tabla;
};

echo 'window.CSV_ANALISIS_LOCAL = ' . json_encode($ruta('analisis')) . ";\n";
echo 'window.CSV_CONFIG_LOCAL = '   . json_encode($ruta('config'))   . ";\n";
