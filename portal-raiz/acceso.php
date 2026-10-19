<?php
/* Lo que la portada puede mostrar a este usuario: qué tarjetas (window.ACCESO)
 * y quién es. Solo decide qué se VE: abrir cada área lo vuelve a comprobar el
 * servidor (requerir_sesion en auth.php).
 *   window.ACCESO = "*"            Administrador y Dirección: todas
 *   window.ACCESO = ["kinder", …]  las áreas de sus roles
 */
require __DIR__ . '/auth.php';
requerir_sesion('');

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$roles = roles_actuales();
$nombres = array_map(fn($r) => ROLES[$r]['nombre'], $roles);
echo 'window.ACCESO = ' . json_encode(areas_visibles($roles)) . ";\n";
echo 'window.PORTAL = ' . json_encode(['usuario' => usuario_actual(), 'roles' => $nombres], JSON_UNESCAPED_UNICODE) . ";\n";
