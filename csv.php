<?php
/* Trae del Sheet la tabla que pida el tablero. Solo para quien tiene sesión
   en el portal. Las direcciones viven en portal_config.php, en el servidor. */
require dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Cache-Control: private, no-store');

function cortar(int $codigo, string $msg): void {
    http_response_code($codigo);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

$tabla = (string) ($_GET['tabla'] ?? '');
if (!in_array($tabla, ['analisis', 'config', 'kinder'], true)) cortar(400, 'tabla no reconocida');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) cortar(500, 'falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
$url = $cfg['csv'][$tabla] ?? '';
if (!$url) cortar(500, 'falta la dirección del CSV de ' . $tabla . ' en portal_config.php');

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

if ($respuesta === false) cortar(502, 'sin conexión con el Sheet: ' . $error);
if ($codigo >= 400)       cortar(502, 'el Sheet respondió con el código ' . $codigo);

header('Content-Type: text/csv; charset=utf-8');
echo $respuesta;
