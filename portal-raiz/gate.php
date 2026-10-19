<?php
/* Entrega los archivos del portal solo a quien inició sesión y tiene un rol
   que abre esa carpeta (permisos.php). */
require __DIR__ . '/auth.php';
requerir_sesion('');   // sesión (y contraseña temporal ya cambiada); el área se mira abajo

$base = realpath(__DIR__);
$f    = (string) ($_GET['f'] ?? '');
$ruta = realpath($base . '/' . $f);

function no_encontrado(): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>No encontrado</title>'
       . '<p style="font-family:system-ui;padding:40px">Esta página no existe. '
       . '<a href="/">Volver al portal</a></p>';
    exit;
}

if ($ruta === false || ($ruta !== $base && !str_starts_with($ruta, $base . DIRECTORY_SEPARATOR))) no_encontrado();

if (is_dir($ruta)) {
    // /kinder → /kinder/ para que los enlaces internos de cada unidad funcionen
    if ($f !== '' && !str_ends_with($f, '/')) {
        header('Location: /' . $f . '/', true, 301);
        exit;
    }
    $ruta .= '/index.html';
    if (!is_file($ruta)) no_encontrado();
}

// Nunca se entregan archivos ocultos ni internos
if (preg_match('#/\.#', str_replace($base, '', $ruta))) no_encontrado();

$tipos = [
    'html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8',
    'css'  => 'text/css; charset=utf-8',  'js'  => 'application/javascript; charset=utf-8',
    'json' => 'application/json; charset=utf-8', 'csv' => 'text/csv; charset=utf-8',
    'txt'  => 'text/plain; charset=utf-8', 'pdf' => 'application/pdf',
    'png'  => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif',
    'svg'  => 'image/svg+xml', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
    'woff' => 'font/woff', 'woff2' => 'font/woff2', 'mp4' => 'video/mp4',
];
// El área sale del archivo real que se va a entregar, ya resuelto.
requerir_sesion(substr($ruta, strlen($base) + 1));

$ext = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));
if (!isset($tipos[$ext])) no_encontrado();

header('Content-Type: ' . $tipos[$ext]);
header('Content-Length: ' . filesize($ruta));
header('Cache-Control: private, no-store');
header('X-Robots-Tag: noindex, nofollow');
readfile($ruta);
