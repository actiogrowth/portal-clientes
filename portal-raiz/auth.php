<?php
/* Sesión y permisos del portal. No se abre directamente: lo usan los demás
 * archivos (gate.php, login.php, los puentes api.php/csv.php/config.php de
 * cada carpeta…).
 *
 * requerir_sesion() es el PUNTO CENTRAL de los permisos: además de exigir
 * sesión, comprueba que los roles del usuario abran el área de la carpeta
 * pedida (permisos.php). gate.php le pasa la ruta del archivo que va a
 * entregar; los puentes la llaman sin argumentos y se usa la carpeta del
 * script que corre. Así cada puente queda protegido sin tocarlo.
 *
 * Las cuentas (usuario, huella, roles, activo) están en cuentas.php. Los
 * roles se leen en cada petición: un cambio de roles, una desactivación o un
 * reinicio de contraseña se aplican en la siguiente página que se abra.
 */
require_once __DIR__ . '/permisos.php';
require_once __DIR__ . '/cuentas.php';

// Las sesiones se guardan fuera de la carpeta pública del portal.
$dirSesiones = dirname(__DIR__) . '/portal_sesiones';
if (!is_dir($dirSesiones)) { @mkdir($dirSesiones, 0700, true); }
if (is_dir($dirSesiones) && is_writable($dirSesiones)) {
    ini_set('session.save_path', $dirSesiones);
}
// Una sesión sin actividad por 12 horas se borra en el servidor.
ini_set('session.gc_maxlifetime', '43200');
ini_set('session.use_strict_mode', '1');

session_name('vea_portal');
session_set_cookie_params([
    'lifetime' => 0,          // la sesión termina al cerrar el navegador
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

/** Compatibilidad: usuario → huella de las cuentas activas (lo que devolvía usuarios.php). */
function usuarios(): array {
    $d = cuentas();
    $r = [];
    foreach (($d['usuarios'] ?? []) as $u => $c) if (!empty($c['activo'])) $r[$u] = $c['hash'];
    return $r;
}

/**
 * La cuenta de la sesión, o null si no hay sesión válida: la cuenta tiene que
 * existir, estar activa y tener la misma versión de contraseña que cuando se
 * inició la sesión (un reinicio o cambio de contraseña corta las demás).
 */
function cuenta_actual(): ?array {
    $u = $_SESSION['usuario'] ?? '';
    if (!is_string($u) || $u === '') return null;
    $c = cuenta($u);
    if (!$c || empty($c['activo'])) return null;
    if ((int) ($_SESSION['ver_clave'] ?? 0) !== (int) ($c['ver_clave'] ?? 0)) return null;
    return $c;
}

function sesion_activa(): bool { return cuenta_actual() !== null; }

function usuario_actual(): string { return sesion_activa() ? (string) $_SESSION['usuario'] : ''; }

function roles_actuales(): array {
    $c = cuenta_actual();
    return $c ? ($c['roles'] ?? []) : [];
}

function puede(string $permiso): bool { return roles_permiten(roles_actuales(), $permiso); }

/* ── CSRF: un token por sesión, en un campo oculto o en la cabecera X-CSRF ── */
function csrf_token(): string {
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_valido($t): bool {
    return is_string($t) && $t !== '' && !empty($_SESSION['csrf']) && is_string($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t);
}

/** Inicia la sesión de un usuario ya verificado. */
function iniciar_sesion(string $u, array $c): void {
    session_regenerate_id(true);
    $_SESSION = ['usuario' => $u, 'ver_clave' => (int) ($c['ver_clave'] ?? 0)];
    csrf_token();
}

/** ¿La petición es a un puente de datos (responde JSON, no páginas)? */
function es_puente(): bool {
    $s = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
    return (bool) preg_match('#^/[^/]+/(api|csv|config)\.php$#', $s);
}

/** Corta la petición: JSON para los puentes, una página corta para lo demás. */
function negar(string $mensaje, int $http, string $codigo): void {
    http_response_code($http);
    header('Cache-Control: private, no-store');
    if (es_puente()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => $mensaje, 'codigo' => $codigo], JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin permiso</title>'
           . '<p style="font-family:system-ui;padding:40px;max-width:520px">' . htmlspecialchars($mensaje)
           . '<br><br><a href="/">Volver al portal</a></p>';
    }
    exit;
}

/**
 * Exige sesión y permiso para la ruta. $ruta: relativa a la raíz del portal
 * (gate.php pasa la del archivo); null = la del script que corre (puentes).
 */
function requerir_sesion(?string $ruta = null): void {
    if (!sesion_activa()) {
        // Sesión cortada (cuenta desactivada o contraseña reiniciada): se vacía.
        if (!empty($_SESSION['usuario'])) { $_SESSION = []; session_regenerate_id(true); }
        $destino = $_SERVER['REQUEST_URI'] ?? '/';
        header('Location: /login.php?r=' . urlencode($destino));
        exit;
    }
    $c = cuenta_actual();
    if (!empty($c['cambiar_clave'])) {
        if (es_puente()) negar('Antes de seguir tienes que cambiar tu contraseña temporal.', 403, 'cambiar_clave');
        header('Location: /cambiar-clave.php?r=' . urlencode($_SERVER['REQUEST_URI'] ?? '/'));
        exit;
    }
    if ($ruta === null) $ruta = ltrim((string) ($_SERVER['SCRIPT_NAME'] ?? ''), '/');
    if (!roles_abren_ruta($c['roles'] ?? [], $ruta)) {
        negar('Tu usuario no tiene permiso para abrir esta sección.', 403, 'sin_permiso');
    }
}

function destino_seguro(?string $r): string {
    if (!$r || $r[0] !== '/' || str_starts_with($r, '//') || str_contains($r, '\\')) return '/';
    if (preg_match('#^/(login|logout|cambiar-clave)\.php#', $r)) return '/';
    return $r;
}

/* Límite de intentos: 5 fallos seguidos desde la misma conexión bloquean 15 minutos. */
function archivo_intentos(): string {
    $dir = ini_get('session.save_path') ?: sys_get_temp_dir();
    return rtrim($dir, '/') . '/intentos_' . md5($_SERVER['REMOTE_ADDR'] ?? '') . '.json';
}
function intentos(): array {
    $f = archivo_intentos();
    $d = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    return is_array($d) ? $d : ['n' => 0, 't' => 0];
}
function bloqueado(): int {
    $d = intentos();
    $resta = ($d['t'] + 900) - time();
    return ($d['n'] >= 5 && $resta > 0) ? (int) ceil($resta / 60) : 0;
}
function registrar_fallo(): void {
    $d = intentos();
    if (time() - $d['t'] > 900) $d = ['n' => 0, 't' => 0];
    $d['n']++; $d['t'] = time();
    @file_put_contents(archivo_intentos(), json_encode($d));
}
function limpiar_intentos(): void { @unlink(archivo_intentos()); }
