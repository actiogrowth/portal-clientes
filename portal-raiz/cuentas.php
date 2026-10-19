<?php
/* Cuentas del portal: usuario, huella de la contraseña, roles y estado.
 * No se abre directamente (el .htaccess lo prohíbe): lo carga auth.php.
 *
 * DÓNDE VIVEN. En portal_usuarios.json, una carpeta MÁS ARRIBA que la del
 * portal (junto a portal_config.php), fuera de la web y fuera del repo:
 *   /home/…/portal_usuarios.json
 * Se escribe con un candado (portal_usuarios.lock) y por reemplazo atómico,
 * así dos cambios a la vez no se pisan ni dejan el archivo a medias.
 *
 * Cada cuenta:
 *   hash          password_hash() de la contraseña. Nunca la contraseña.
 *   roles         lista de roles de permisos.php
 *   activo        false = desactivada: no entra y su sesión abierta se corta
 *   cambiar_clave true = la contraseña es temporal: hay que cambiarla al entrar
 *   ver_clave     sube con cada cambio o reinicio de contraseña; una sesión
 *                 abierta con otra versión se corta
 *   clases        reservado para Profesor (clases que podrá ver en Pasar lista)
 *   creado, creado_por, ultimo_ingreso
 *
 * MIGRACIÓN (una sola vez). Si portal_usuarios.json no existe, se arma con
 * las huellas de usuarios.php (el archivo de siempre, en la carpeta del
 * portal) y los roles de 'roles_iniciales' en portal_config.php. Solo se
 * migra si TODOS los usuarios de usuarios.php tienen al menos un rol válido y
 * hay un Administrador: si no, no se escribe nada y el login avisa. Así nadie
 * queda a medias ni sin acceso. Las huellas pasan tal cual: cada uno entra
 * con su contraseña de siempre.
 */

const REGEX_USUARIO = '/^[a-z0-9]+(-[a-z0-9]+)*$/';
const CLAVE_MINIMA = 10;
const EVENTOS_MAXIMO = 500;

function ruta_cuentas(): string {
    return defined('PORTAL_CUENTAS') ? PORTAL_CUENTAS : dirname(__DIR__) . '/portal_usuarios.json';
}
function ruta_config_portal(): string {
    return defined('PORTAL_CONFIG') ? PORTAL_CONFIG : dirname(__DIR__) . '/portal_config.php';
}
function ruta_usuarios_heredados(): string {
    return defined('PORTAL_USUARIOS_HEREDADOS') ? PORTAL_USUARIOS_HEREDADOS : __DIR__ . '/usuarios.php';
}

function usuario_valido(string $u): bool {
    return strlen($u) >= 3 && strlen($u) <= 40 && preg_match(REGEX_USUARIO, $u) === 1;
}

/** Lee el archivo tal como está (null si no existe o está dañado). */
function leer_cuentas_crudo(): ?array {
    $f = ruta_cuentas();
    if (!is_file($f)) return null;
    $d = json_decode((string) file_get_contents($f), true);
    return (is_array($d) && isset($d['usuarios']) && is_array($d['usuarios'])) ? $d : null;
}

/* Error de la migración, si no se pudo hacer ('' = sin problema). */
$GLOBALS['cuentas_error'] = '';

/** Las cuentas, migrando si hace falta. null = no hay cuentas utilizables (ver cuentas_error). */
function cuentas(): ?array {
    $d = leer_cuentas_crudo();
    if ($d !== null) return $d;
    if (is_file(ruta_cuentas())) { $GLOBALS['cuentas_error'] = 'portal_usuarios.json existe pero no se puede leer'; return null; }
    return migrar_cuentas();
}

/** Arma portal_usuarios.json desde usuarios.php + roles_iniciales. */
function migrar_cuentas(): ?array {
    $h = ruta_usuarios_heredados();
    $lista = is_file($h) ? require $h : null;
    if (!is_array($lista) || !$lista) { $GLOBALS['cuentas_error'] = 'no hay portal_usuarios.json ni usuarios.php'; return null; }
    $cfgF = ruta_config_portal();
    $cfg = is_file($cfgF) ? require $cfgF : [];
    $iniciales = is_array($cfg) ? ($cfg['roles_iniciales'] ?? null) : null;
    if (!is_array($iniciales)) { $GLOBALS['cuentas_error'] = "falta 'roles_iniciales' en portal_config.php"; return null; }

    $usuarios = []; $faltan = []; $hayAdmin = false;
    foreach ($lista as $u => $hash) {
        $u = strtolower(trim((string) $u));
        $roles = $iniciales[$u] ?? null;
        $roles = is_array($roles) ? array_values(array_unique(array_filter($roles, fn($r) => is_string($r) && rol_valido($r)))) : [];
        if (!$roles || !is_string($hash) || $hash === '') { $faltan[] = $u; continue; }
        if (in_array('administrador', $roles, true)) $hayAdmin = true;
        $usuarios[$u] = ['hash' => $hash, 'roles' => $roles, 'activo' => true, 'cambiar_clave' => false, 'ver_clave' => 0,
                         'clases' => [], 'creado' => date('c'), 'creado_por' => '(migración)', 'ultimo_ingreso' => null];
    }
    if ($faltan) { $GLOBALS['cuentas_error'] = "en 'roles_iniciales' faltan roles válidos para: " . implode(', ', $faltan); return null; }
    if (!$hayAdmin) { $GLOBALS['cuentas_error'] = "'roles_iniciales' no tiene ningún administrador"; return null; }

    $datos = ['version' => 1, 'usuarios' => $usuarios, 'eventos' => [
        ['fecha' => date('c'), 'quien' => '(migración)', 'accion' => 'migrar', 'usuario' => '', 'detalle' => count($usuarios) . ' cuentas desde usuarios.php']]];
    // Con el candado: si dos peticiones migran a la vez, la segunda encuentra el archivo hecho.
    try {
        return con_candado(function () use ($datos) {
            $ya = leer_cuentas_crudo();
            if ($ya !== null) return $ya;
            escribir_cuentas($datos);
            return $datos;
        });
    } catch (Throwable $e) {
        $GLOBALS['cuentas_error'] = 'no se pudo escribir portal_usuarios.json (' . $e->getMessage() . ')';
        return null;
    }
}

function con_candado(callable $fn) {
    $lock = @fopen(preg_replace('/\.json$/', '', ruta_cuentas()) . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new ErrorCuentas('No se pudo bloquear las cuentas.', 500);
    try { return $fn(); }
    finally { flock($lock, LOCK_UN); fclose($lock); }
}

function escribir_cuentas(array $d): void {
    $f = ruta_cuentas();
    $tmp = $f . '.tmp-' . bin2hex(random_bytes(4));
    $json = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($tmp, $json) === false) throw new RuntimeException('no se pudo escribir las cuentas');
    @chmod($tmp, 0600);
    if (!rename($tmp, $f)) { @unlink($tmp); throw new RuntimeException('no se pudo reemplazar las cuentas'); }
}

/**
 * Cambia las cuentas dentro del candado: lee lo último, aplica $fn y guarda.
 * $fn recibe los datos por referencia y devuelve lo que se quiera devolver;
 * si lanza ErrorCuentas, no se guarda nada.
 */
function modificar_cuentas(callable $fn) {
    return con_candado(function () use ($fn) {
        $d = leer_cuentas_crudo();
        if ($d === null) throw new ErrorCuentas('No se pueden leer las cuentas.', 500);
        $res = $fn($d);
        $d['eventos'] = array_slice($d['eventos'] ?? [], -EVENTOS_MAXIMO);
        escribir_cuentas($d);
        return $res;
    });
}

class ErrorCuentas extends Exception {
    public int $http;
    public function __construct(string $m, int $http = 400) { parent::__construct($m); $this->http = $http; }
}

function cuenta(string $u): ?array {
    $d = cuentas();
    return $d['usuarios'][$u] ?? null;
}

function anotar_evento(array &$d, string $quien, string $accion, string $usuario, string $detalle = ''): void {
    $d['eventos'][] = ['fecha' => date('c'), 'quien' => $quien, 'accion' => $accion, 'usuario' => $usuario, 'detalle' => $detalle];
}

/** Contraseña temporal: 14 caracteres sin los que se confunden (0/O, 1/l/I). */
function clave_temporal(): string {
    $abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $s = '';
    for ($i = 0; $i < 14; $i++) $s .= $abc[random_int(0, strlen($abc) - 1)];
    return $s;
}

/** Normaliza una lista de roles; lanza si alguno no existe o viene vacía. */
function roles_limpios($roles): array {
    if (!is_array($roles)) throw new ErrorCuentas('Los roles tienen que venir como lista.');
    $r = [];
    foreach ($roles as $x) {
        if (!is_string($x) || !rol_valido($x)) throw new ErrorCuentas('Rol desconocido: ' . (is_string($x) ? $x : '?') . '.');
        $r[] = $x;
    }
    $r = array_values(array_unique($r));
    if (!$r) throw new ErrorCuentas('Elige al menos un rol.');
    return $r;
}

function es_admin(array $c): bool { return in_array('administrador', $c['roles'] ?? [], true); }

function admins_activos(array $d): int {
    return count(array_filter($d['usuarios'], fn($c) => !empty($c['activo']) && es_admin($c)));
}

/**
 * Reglas de quién puede tocar qué cuenta. $actor = usuario que actúa (con sus
 * roles en $d). Lanza ErrorCuentas (403) con el motivo si no puede.
 *   · Sin usuarios.gestionar no se toca nada.
 *   · Sin usuarios.admin (Dirección) no se toca una cuenta con rol
 *     Administrador ni se asigna ese rol.
 *   · Nadie se cambia sus propios roles ni se desactiva a sí mismo.
 *   · El último Administrador activo no se desactiva ni pierde el rol.
 */
function exigir_puede_tocar(array $d, string $actor, string $accion, string $objetivo, ?array $rolesNuevos = null): void {
    $rolesActor = $d['usuarios'][$actor]['roles'] ?? [];
    if (!roles_permiten($rolesActor, 'usuarios.gestionar')) throw new ErrorCuentas('Tu rol no permite gestionar usuarios.', 403);
    $obj = $d['usuarios'][$objetivo] ?? null;
    $adminActor = roles_permiten($rolesActor, 'usuarios.admin');
    if ($obj && es_admin($obj) && !$adminActor)
        throw new ErrorCuentas('Solo un Administrador puede modificar una cuenta con rol Administrador.', 403);
    if ($rolesNuevos !== null && in_array('administrador', $rolesNuevos, true) && !$adminActor)
        throw new ErrorCuentas('Solo un Administrador puede asignar el rol Administrador.', 403);
    if ($objetivo === $actor && in_array($accion, ['roles', 'desactivar'], true))
        throw new ErrorCuentas('No puedes cambiar tus propios roles ni desactivar tu cuenta: pídeselo a otra persona con permiso.', 403);
    if ($obj && es_admin($obj) && !empty($obj['activo']) && admins_activos($d) <= 1) {
        if ($accion === 'desactivar' || ($accion === 'roles' && !in_array('administrador', $rolesNuevos ?? [], true)))
            throw new ErrorCuentas('Es el último Administrador activo: no se puede desactivar ni quitarle el rol.', 403);
    }
}
