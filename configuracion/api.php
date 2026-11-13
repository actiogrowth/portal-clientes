<?php
/* Configuración › Usuarios: el puente de la página de usuarios del portal.
 *
 * Soporte Actio (clave 'administrador'), Dirección y, desde el 13-nov,
 * Coordinación Operativa (usuarios.gestionar). requerir_sesion() ya corta a
 * los demás porque la carpeta configuracion pide area:configuracion o
 * area:usuarios; aquí se vuelve a exigir el permiso de gestión, y cada cambio
 * pasa por exigir_puede_tocar() (cuentas.php):
 *   · 13-nov: Coordinación Operativa solo ve, toca y asigna los roles de su
 *     lista 'gestiona' (permisos.php): las cuentas de Dirección, Soporte Actio
 *     y Coordinación Operativa no le llegan en «listar» ni las puede tocar.
 *   · Dirección no toca cuentas con rol Soporte Actio ni asigna ese rol.
 *   · Nadie se cambia sus roles ni se desactiva a sí mismo.
 *   · La última cuenta de Soporte Actio activa no se desactiva ni pierde el rol.
 *
 *   GET  api.php?accion=listar      → cuentas (las que están a su alcance), roles que puede asignar,
 *                                     puedeAdmin, puedeNombres, recortado y el token CSRF
 *   POST api.php  (cabecera X-CSRF) → {accion: crear|roles|desactivar|reactivar|reiniciar|nombre, usuario, roles?, nombre?, apellido?}
 *
 * 26-oct: «nombre» guarda el nombre y el apellido de la persona que usa la
 * cuenta (vacíos = se borran). No cambia el usuario para entrar. 13-nov: pide
 * usuarios.nombres (Soporte Actio en cualquier cuenta, también la suya;
 * Coordinación Operativa en las que gestiona; Dirección no, como hasta ahora).
 *
 * Contraseñas: al crear o reiniciar se genera una temporal que va SOLO en la
 * respuesta de esa petición (la página la muestra una vez). No se guarda en
 * claro, no se escribe en ningún registro y no se puede volver a pedir. Nadie
 * define aquí una contraseña definitiva: la elige cada usuario al entrar.
 * No hay borrado: se desactiva.
 */
require dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

function responder(int $http, array $cuerpo): void {
    http_response_code($http);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!puede('usuarios.gestionar')) responder(403, ['ok' => false, 'error' => 'Tu rol no permite gestionar usuarios.', 'codigo' => 'sin_permiso']);

$yo = usuario_actual();

/* 13-nov: solo las cuentas al alcance de quien pide (cuenta_al_alcance, permisos.php). */
function vista_cuentas(array $d): array {
    $r = [];
    $rolesYo = roles_actuales();
    foreach ($d['usuarios'] as $u => $c) {
        if (!cuenta_al_alcance($rolesYo, $c['roles'] ?? [])) continue;
        $r[] = ['usuario' => $u, 'nombre' => (string) ($c['nombre'] ?? ''), 'apellido' => (string) ($c['apellido'] ?? ''),
                'roles' => array_values($c['roles'] ?? []), 'activo' => !empty($c['activo']),
                'cambiarClave' => !empty($c['cambiar_clave']), 'creado' => $c['creado'] ?? null,
                'ultimoIngreso' => $c['ultimo_ingreso'] ?? null];
    }
    usort($r, fn($a, $b) => [$b['activo'], $a['usuario']] <=> [$a['activo'], $b['usuario']]);
    return $r;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($metodo === 'GET') {
    if (($_GET['accion'] ?? '') !== 'listar') responder(400, ['ok' => false, 'error' => 'Acción desconocida.']);
    $d = cuentas();
    $roles = [];
    $g = roles_gestionables(roles_actuales());   // 13-nov: con recorte, solo los roles que puede asignar
    foreach (ROLES as $id => $def) if ($g === null || in_array($id, $g, true))
        $roles[] = ['id' => $id, 'nombre' => $def['nombre'], 'descripcion' => $def['descripcion']];
    responder(200, ['ok' => true, 'usuarios' => vista_cuentas($d), 'roles' => $roles, 'yo' => $yo,
        'puedeAdmin' => puede('usuarios.admin'), 'puedeNombres' => puede('usuarios.nombres'), 'recortado' => $g !== null,
        'claveMinima' => CLAVE_MINIMA, 'csrf' => csrf_token()]);
}

if ($metodo !== 'POST') responder(405, ['ok' => false, 'error' => 'Método no permitido.']);
if (!csrf_valido($_SERVER['HTTP_X_CSRF'] ?? null))
    responder(403, ['ok' => false, 'error' => 'La página caducó: recárgala y vuelve a intentarlo.', 'codigo' => 'csrf']);

$e = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($e)) responder(400, ['ok' => false, 'error' => 'Cuerpo ilegible.']);
$accion  = (string) ($e['accion'] ?? '');
$usuario = strtolower(trim((string) ($e['usuario'] ?? '')));

try {
    $res = modificar_cuentas(function (array &$d) use ($accion, $usuario, $e, $yo) {
        $existe = isset($d['usuarios'][$usuario]);
        switch ($accion) {
            case 'crear':
                if (!usuario_valido($usuario))
                    throw new ErrorCuentas('El usuario tiene que ser de 3 a 40 letras minúsculas, números y guiones (por ejemplo recepcion-afterschool).');
                // 13-nov: a quien no ve esa cuenta (Coordinación Operativa ante Dirección o Soporte Actio) no se le dice de quién es.
                if ($existe && !cuenta_al_alcance($d['usuarios'][$yo]['roles'] ?? [], $d['usuarios'][$usuario]['roles'] ?? []))
                    throw new ErrorCuentas('Ese usuario ya está en uso: elige otro.');
                if ($existe) throw new ErrorCuentas('Ya existe un usuario «' . $usuario . '». Si está desactivado, reactívalo.');
                $roles = roles_limpios($e['roles'] ?? null);
                exigir_puede_tocar($d, $yo, 'crear', $usuario, $roles);
                $temporal = clave_temporal();
                $d['usuarios'][$usuario] = ['hash' => password_hash($temporal, PASSWORD_DEFAULT), 'roles' => $roles, 'activo' => true,
                    'cambiar_clave' => true, 'ver_clave' => 0, 'clases' => [], 'creado' => date('c'), 'creado_por' => $yo, 'ultimo_ingreso' => null];
                anotar_evento($d, $yo, 'crear', $usuario, implode(', ', $roles));
                return ['temporal' => $temporal];
            case 'roles':
                if (!$existe) throw new ErrorCuentas('No existe el usuario «' . $usuario . '».', 404);
                $roles = roles_limpios($e['roles'] ?? null);
                exigir_puede_tocar($d, $yo, 'roles', $usuario, $roles);
                $antes = implode(', ', $d['usuarios'][$usuario]['roles']);
                $d['usuarios'][$usuario]['roles'] = $roles;
                anotar_evento($d, $yo, 'roles', $usuario, $antes . ' → ' . implode(', ', $roles));
                return [];
            case 'desactivar':
            case 'reactivar':
                if (!$existe) throw new ErrorCuentas('No existe el usuario «' . $usuario . '».', 404);
                exigir_puede_tocar($d, $yo, $accion, $usuario);
                $d['usuarios'][$usuario]['activo'] = $accion === 'reactivar';
                anotar_evento($d, $yo, $accion, $usuario);
                return [];
            case 'nombre':
                if (!$existe) throw new ErrorCuentas('No existe el usuario «' . $usuario . '».', 404);
                if (!roles_permiten($d['usuarios'][$yo]['roles'] ?? [], 'usuarios.nombres'))
                    throw new ErrorCuentas('Tu rol no edita el nombre y el apellido: lo hacen Soporte Actio y Coordinación Operativa.', 403);
                exigir_puede_tocar($d, $yo, 'nombre', $usuario);   // 13-nov: solo en las cuentas que gestiona
                $nombre = nombre_limpio($e['nombre'] ?? '', 'nombre');
                $apellido = nombre_limpio($e['apellido'] ?? '', 'apellido');
                $d['usuarios'][$usuario]['nombre'] = $nombre;
                $d['usuarios'][$usuario]['apellido'] = $apellido;
                anotar_evento($d, $yo, 'nombre', $usuario);   // sin el nombre: el registro no guarda datos personales
                return [];
            case 'reiniciar':
                if (!$existe) throw new ErrorCuentas('No existe el usuario «' . $usuario . '».', 404);
                exigir_puede_tocar($d, $yo, 'reiniciar', $usuario);
                $temporal = clave_temporal();
                $x = &$d['usuarios'][$usuario];
                $x['hash'] = password_hash($temporal, PASSWORD_DEFAULT);
                $x['cambiar_clave'] = true;
                $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;   // corta sus sesiones abiertas
                anotar_evento($d, $yo, 'reiniciar', $usuario);
                return ['temporal' => $temporal];
        }
        throw new ErrorCuentas('Acción desconocida.');
    });
} catch (ErrorCuentas $x) {
    responder($x->http, ['ok' => false, 'error' => $x->getMessage(), 'codigo' => 'rechazado']);
} catch (Throwable $x) {
    error_log('portal configuracion: ' . $accion . ' falló: ' . $x->getMessage());
    responder(500, ['ok' => false, 'error' => 'No se pudo guardar el cambio. Vuelve a intentarlo.']);
}

// Si el usuario se reinició a sí mismo, su sesión se corta: la página lo sabrá al listar.
responder(200, ['ok' => true] + $res + ['usuarios' => vista_cuentas(cuentas())]);
