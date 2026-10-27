<?php
/* Quién es el usuario y qué puede abrir. Solo decide qué se VE: abrir cada
 * área lo vuelve a comprobar el servidor (requerir_sesion en auth.php).
 *
 *   acceso.php?formato=json  (21-oct, rediseño; lo usa comun/datos.js)
 *     {ok, usuario, nombre, apellido (27-oct; '' sin nombre cargado), roles:[{id, nombre}], areas: '*' | ['kinder', …],
 *      inicio: dónde empieza tras el login, inicioAS: pestaña de After School,
 *      permisosAS: lo de After School que puede hacer}
 *     Sin sesión → 401 {codigo:'sesion'}; contraseña temporal → 403 {codigo:'cambiar_clave'}.
 *
 *   acceso.php (sin formato): el JavaScript de antes (window.ACCESO y
 *     window.PORTAL), para la portada anterior si hubiera que volver atrás.
 */
require __DIR__ . '/auth.php';

header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

if (($_GET['formato'] ?? '') === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    $c = cuenta_actual();
    if (!$c) { http_response_code(401); echo json_encode(['ok' => false, 'codigo' => 'sesion', 'error' => 'Tu sesión caducó.']); exit; }
    if (!empty($c['cambiar_clave'])) { http_response_code(403); echo json_encode(['ok' => false, 'codigo' => 'cambiar_clave', 'error' => 'Cambia tu contraseña temporal.']); exit; }
    $_SESSION['ultimo'] = time();
    $roles = $c['roles'] ?? [];
    echo json_encode(['ok' => true, 'usuario' => usuario_actual(),
        'nombre' => trim((string) ($c['nombre'] ?? '')), 'apellido' => trim((string) ($c['apellido'] ?? '')),
        'roles' => array_map(fn($r) => ['id' => $r, 'nombre' => ROLES[$r]['nombre']], array_values(array_filter($roles, 'rol_valido'))),
        'areas' => areas_visibles($roles), 'inicio' => destino_inicio($roles), 'inicioAS' => inicio_as($roles),
        'permisosAS' => permisos_as($roles)], JSON_UNESCAPED_UNICODE);
    exit;
}

requerir_sesion('');
header('Content-Type: application/javascript; charset=utf-8');
$roles = roles_actuales();
$nombres = array_map(fn($r) => ROLES[$r]['nombre'], $roles);
echo 'window.ACCESO = ' . json_encode(areas_visibles($roles)) . ";\n";
echo 'window.PORTAL = ' . json_encode(['usuario' => usuario_actual(), 'roles' => $nombres], JSON_UNESCAPED_UNICODE) . ";\n";
