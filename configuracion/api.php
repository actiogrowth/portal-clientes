<?php
/* Configuración › Usuarios: el puente de la página de usuarios del portal.
 *
 * Solo Administrador y Dirección (usuarios.gestionar). requerir_sesion() ya
 * corta a los demás porque la carpeta configuracion pide area:configuracion;
 * aquí se vuelve a exigir el permiso de gestión, y cada cambio pasa por
 * exigir_puede_tocar() (cuentas.php):
 *   · Dirección no toca cuentas con rol Administrador ni asigna ese rol.
 *   · Nadie se cambia sus roles ni se desactiva a sí mismo.
 *   · El último Administrador activo no se desactiva ni pierde el rol.
 *
 *   GET  api.php?accion=listar      → cuentas, roles y el token CSRF
 *   POST api.php  (cabecera X-CSRF) → {accion: crear|roles|desactivar|reactivar|reiniciar|nombre, usuario, roles?, nombre?, apellido?}
 *
 * 27-oct: «nombre» guarda el nombre y el apellido de la persona que usa la
 * cuenta (vacíos = se borran). SOLO un Administrador (usuarios.admin), en
 * cualquier cuenta, también la suya. No cambia el usuario para entrar.
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

function vista_cuentas(array $d): array {
    $r = [];
    foreach ($d['usuarios'] as $u => $c) {
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
    foreach (ROLES as $id => $def) $roles[] = ['id' => $id, 'nombre' => $def['nombre'], 'descripcion' => $def['descripcion']];
    responder(200, ['ok' => true, 'usuarios' => vista_cuentas($d), 'roles' => $roles, 'yo' => $yo,
        'puedeAdmin' => puede('usuarios.admin'), 'claveMinima' => CLAVE_MINIMA, 'csrf' => csrf_token()]);
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
                if (!roles_permiten($d['usuarios'][$yo]['roles'] ?? [], 'usuarios.admin'))
                    throw new ErrorCuentas('Solo un Administrador edita el nombre y el apellido.', 403);
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
