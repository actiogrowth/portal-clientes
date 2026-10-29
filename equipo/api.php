<?php
/* Puente de Procesos › Equipo (26-oct): los puestos de Vida en Arte, sus
 * fichas, la aceptación del contrato, Mi lista y Revisar. Fuente única: el
 * Sheet «Procesos — Vida en Arte», a través de su propio Apps Script
 * (procesos-script/Procesos.gs). Contrato en docs/ACCIONES_API.md › Equipo.
 *
 * Reutiliza el transporte de after-school/api.php (reintentos, redirección a
 * mano, esperas) cargándolo con AS_SOLO_FUNCIONES: solo sus funciones.
 *
 * Cerrojos:
 *   1. requerir_sesion(): sesión y área «equipo» (todos los roles).
 *   2. Cinco acciones: leer, aceptar, marcar, revisar y (29-oct) marcarHoja.
 *   3. EL RECORTE ES DE ESTE ARCHIVO: el script devuelve el Sheet entero y
 *      aquí se arma la respuesta de cada persona. Sin equipo.todo
 *      (Dirección y Administrador lo tienen por '*'): del organigrama solo el
 *      nombre y el área de cada puesto; una ficha solo si el puesto está
 *      «Abierto al equipo» y la persona lo ocupa o es su jefe; un puesto con
 *      «Visible solo para» no existe para nadie más (26-oct); las marcas y
 *      revisiones, solo de esas fichas; las aceptaciones, solo las suyas.
 *   4. Escribir: aceptar, marcar y marcarHoja solo quien OCUPA el puesto;
 *      revisar (la lista o una hoja) solo quien lo verifica o es su jefe, y
 *      NUNCA quien también ocupa el puesto (29-oct: nadie se verifica a sí
 *      mismo). Siempre en puestos abiertos. El script vuelve a mirar el
 *      estado, la versión, el período, la hoja y el paso.
 *   5. Suelta la sesión antes de esperar a Google (D-068).
 *   6. 26-oct: «personas» trae nombre y apellido (de las cuentas del portal)
 *      y el cargo de quienes aparecen en las marcas y revisiones que esta
 *      persona ya ve; nadie más.
 *
 * 29-oct (Equipo v2):
 *   · Quién verifica un puesto: «Verifica» es texto libre («Dirección, cada
 *     semana»); eq_verificador() lo empareja con el NOMBRE de un puesto de la
 *     pestaña Puestos comparando el comienzo del texto (sin mayúsculas ni
 *     tildes; gana el nombre más largo). Si quien ocupa el puesto ocupa
 *     también el que lo verifica, la verificación sube al puesto raíz
 *     (Dirección). Sin emparejar, se compara como antes con los roles.
 *   · Ocupar un puesto sale de eq_asignaciones(): HOY la pestaña
 *     Asignaciones. Al pasar a la gestión de usuarios del portal se cambia
 *     solo esa función.
 *   · Las iniciales de una marca de hoja las pone este archivo (nombre y
 *     apellido de la cuenta), no el navegador.
 *   · Reglas del juego y la hora de cada momento van a todos los que ven
 *     Equipo; la tabla completa de Horarios del servicio, solo con equipo.todo.
 *
 * EQ_SOLO_FUNCIONES (26-oct): con esa constante definida el archivo solo
 * declara sus funciones (eq_sheet, eq_vista…); lo usan resumen/api.php y
 * pendientes/api.php.
 *
 * Copia en el servidor: la respuesta del script se guarda pr_cache_seg
 * segundos (60 si no se configura) en portal_cache/equipo.json, FUERA de la
 * carpeta pública; se borra tras cada escritura.
 *
 * portal_config.php (fuera de la carpeta pública):
 *     'pr_exec'      => 'https://script.google.com/macros/s/…/exec',
 *     'pr_clave'     => 'la misma que PR_CLAVE_API en el Apps Script',
 *     'pr_cache_seg' => 60,   // opcional
 */
if (!defined('AS_SOLO_FUNCIONES')) define('AS_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/after-school/api.php';
require_once dirname(__DIR__) . '/auth.php';

const EQ_ABIERTO = 'Abierto al equipo';
const EQ_CACHE_SEG = 60;
const EQ_DIAS_MARCAS = 120;   // marcas y revisiones que se mandan: las de los últimos N días
const EQ_ACCIONES = ['leer', 'aceptar', 'marcar', 'revisar', 'marcarHoja'];

if (!defined('EQ_SOLO_FUNCIONES')) {
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg) || empty($cfg['pr_exec']) || empty($cfg['pr_clave']))
    fallo('portal_config.php no tiene pr_exec y pr_clave para Equipo', 500, 'sin_configuracion');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
$datos = json_decode(file_get_contents('php://input'), true);
$accion = is_array($datos) ? (string) ($datos['accion'] ?? '') : '';
if (!in_array($accion, EQ_ACCIONES, true)) fallo('Acción desconocida.', 403, 'sin_permiso');

$usuario = usuario_actual();
$roles = roles_actuales();
$nombresRol = array_values(array_filter(array_map(fn($r) => ROLES[$r]['nombre'] ?? '', $roles)));
$todo = roles_permiten($roles, 'equipo.todo');
session_write_close();   // soltar la sesión antes de esperar a Google (ver pasar-lista/api.php)

$archivo = dirname(__DIR__, 2) . '/portal_cache/equipo.json';
$ttl = isset($cfg['pr_cache_seg']) ? max(0, (int) $cfg['pr_cache_seg']) : EQ_CACHE_SEG;
$S = eq_sheet($cfg, $archivo, $ttl, $usuario);
$V = eq_vista($S, $usuario, $roles, $nombresRol, $todo);

if ($accion === 'leer') {
    echo json_encode(['ok' => true, 'resultado' => $V['respuesta'] + ['personas' => eq_personas($V['respuesta'])]], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ─── Escribir: primero quién, después el script (que mira el resto) ──── */
$d = is_array($datos['datos'] ?? null) ? $datos['datos'] : [];
$puesto = (string) ($d['puesto'] ?? '');
$p = $V['puestos'][$puesto] ?? null;
if (!$p) fallo('No existe el puesto.', 403, 'sin_permiso');
if (!eq_abierto($p)) fallo('El puesto todavía no está abierto al equipo.', 403, 'no_abierto');
if (in_array($accion, ['aceptar', 'marcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))
    fallo('Solo quien ocupa el puesto puede ' . ($accion === 'aceptar' ? 'aceptar su contrato.' : ($accion === 'marcar' ? 'marcar su lista.' : 'marcar su hoja.')), 403, 'sin_permiso');
if ($accion === 'revisar' && !in_array($puesto, $V['reviso'], true))
    fallo('Solo quien verifica el puesto o su jefe puede revisarlo, y nunca quien también lo ocupa.', 403, 'sin_permiso');
if ($accion === 'marcarHoja') {
    // Las iniciales salen de la cuenta, no del navegador.
    $d = ['puesto' => $puesto, 'hoja' => (string) ($d['hoja'] ?? ''), 'orden' => $d['orden'] ?? null, 'marcado' => $d['marcado'] ?? null,
          'iniciales' => eq_iniciales(cuenta($usuario), $usuario)];
}
$envio = envio_para($cfg['pr_clave'], $usuario, ['accion' => $accion, 'datos' => $d]);
$res = llamar_apps_script($accion, $cfg['pr_exec'], $envio['json'], 'pedir',
    function ($s) { usleep((int) ($s * 1000000)); },
    function ($linea) { error_log('equipo: ' . $linea); },
    function () { return microtime(true); });
@unlink($archivo);   // lo escrito se ve en la próxima lectura
$j = $res['http'] === 200 ? json_decode($res['cuerpo'], true) : null;
http_response_code(is_array($j) && ($j['ok'] ?? false) === true ? 200 : ($res['http'] === 200 ? 400 : $res['http']));
echo is_array($j)
    ? json_encode(['ok' => (bool) ($j['ok'] ?? false), 'resultado' => $j['resultado'] ?? null, 'error' => (string) ($j['error'] ?? ''), 'codigo' => (string) ($j['codigo'] ?? '')], JSON_UNESCAPED_UNICODE)
    : json_encode(['ok' => false, 'error' => 'El Sheet no respondió bien.', 'codigo' => 'incierto'], JSON_UNESCAPED_UNICODE);
exit;
}

/* ─── El Sheet (con su copia corta) ────────────────────────────────────── */

/** El Sheet entero. $suave (26-oct): si Google no responde y no hay copia, devuelve null en vez de cortar la respuesta. */
function eq_sheet(array $cfg, string $archivo, int $ttl, string $usuario, bool $suave = false): ?array {
    $c = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : null;
    if (is_array($c) && isset($c['t'], $c['r']) && time() - $c['t'] < $ttl) return $c['r'];
    $envio = envio_para($cfg['pr_clave'], $usuario, ['accion' => 'leer', 'datos' => []]);
    $res = llamar_apps_script('leer', $cfg['pr_exec'], $envio['json'], 'pedir',
        function ($s) { usleep((int) ($s * 1000000)); },
        function ($linea) { error_log('equipo: ' . $linea); },
        function () { return microtime(true); });
    $j = $res['http'] === 200 ? json_decode($res['cuerpo'], true) : null;
    if (!is_array($j) || ($j['ok'] ?? false) !== true || !is_array($j['resultado'] ?? null)) {
        if (is_array($c) && isset($c['r']) && time() - $c['t'] < 86400) return $c['r'];   // Google no respondió: la copia del día
        if ($suave) return null;
        fallo(is_array($j) ? (string) ($j['error'] ?? 'El Sheet respondió con un error.') : 'El Sheet no respondió.', $res['http'] === 200 ? 502 : $res['http'], 'incierto');
    }
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $tmp = $archivo . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode(['t' => time(), 'r' => $j['resultado']], JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) { @chmod($tmp, 0600); @rename($tmp, $archivo); }
    return $j['resultado'];
}

/**
 * 26-oct: nombre y cargo de quienes aparecen en las marcas y revisiones de
 * la respuesta (solo de esas fichas; 29-oct: también las marcas y
 * verificaciones de sus hojas). Sin nombre cargado, nombre ''.
 * {usuario: {nombre: 'Nombre Apellido', cargo: 'Rol · Rol'}}
 */
function eq_personas(array $respuesta): object {
    $quienes = [];
    foreach ((array) ($respuesta['fichas'] ?? []) as $f) {
        foreach ((array) ($f['marcas'] ?? []) as $m) $quienes[(string) ($m['usuario'] ?? '')] = true;
        foreach ((array) ($f['revisiones'] ?? []) as $r) $quienes[(string) ($r['revisor'] ?? '')] = true;
        foreach ((array) ($f['hojas'] ?? []) as $h) {
            foreach ((array) ($h['marcas'] ?? []) as $m) $quienes[(string) ($m['usuario'] ?? '')] = true;
            foreach ((array) ($h['revisiones'] ?? []) as $r) $quienes[(string) ($r['revisor'] ?? '')] = true;
        }
    }
    $out = [];
    foreach (array_keys($quienes) as $u) {
        $c = $u !== '' ? cuenta((string) $u) : null;
        if (!$c) continue;
        $out[$u] = ['nombre' => nombre_completo($c),
                    'cargo' => implode(' · ', array_map(fn($r) => ROLES[$r]['nombre'], array_values(array_filter($c['roles'] ?? [], 'rol_valido'))))];
    }
    return (object) $out;
}

/** 29-oct: iniciales para una marca de hoja: la primera letra del nombre y la del apellido; sin nombre, las dos primeras del usuario. */
function eq_iniciales(?array $c, string $usuario): string {
    $partes = array_filter([trim((string) ($c['nombre'] ?? '')), trim((string) ($c['apellido'] ?? ''))], fn($x) => $x !== '');
    $ini = implode('', array_map(fn($x) => mb_strtoupper(mb_substr($x, 0, 1)), $partes));
    return $ini !== '' ? $ini : mb_strtoupper(mb_substr(preg_replace('/[^\p{L}]/u', '', $usuario), 0, 2));
}

function eq_norm(string $s): string {
    $s = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $s)));
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
}
function eq_abierto(array $p): bool { return eq_norm((string) ($p['estado'] ?? '')) === eq_norm(EQ_ABIERTO); }

/** ¿Esta fila de Asignaciones es de esta persona? Un usuario, o un rol («Usuario del rol X» o «X»). */
function eq_es_mia(string $quien, string $usuario, array $nombresRol): bool {
    $q = eq_norm($quien);
    if ($q === '') return false;
    if ($q === eq_norm($usuario)) return true;
    if (preg_match('/^usuarios? del rol (.+)$/u', $q, $m)) $q = trim($m[1]);
    foreach ($nombresRol as $n) if (eq_norm($n) === $q) return true;
    return false;
}

/** Puesto reservado («Visible solo para», 26-oct): con algo, solo existe para esos usuarios o roles (Dirección y Administrador lo ven por equipo.todo). */
function eq_para_mi(array $p, string $usuario, array $nombresRol): bool {
    $para = trim((string) ($p['soloPara'] ?? ''));
    if ($para === '') return true;
    foreach (explode(',', $para) as $quien) if (eq_es_mia($quien, $usuario, $nombresRol)) return true;
    return false;
}

/**
 * 29-oct: QUIÉN OCUPA QUÉ PUESTO, en un solo lugar. Hoy sale de la pestaña
 * Asignaciones del Sheet: [{usuario, puesto, desde, hasta}], con «usuario» un
 * usuario del portal o un rol («Usuario del rol X»). Cuando las asignaciones
 * pasen a la gestión de usuarios del portal, solo cambia esta función (y
 * devuelve la misma forma).
 */
function eq_asignaciones(array $S): array {
    return array_values(array_filter((array) ($S['asignaciones'] ?? []), 'is_array'));
}

/** Las asignaciones vigentes hoy, por puesto: {ID: [quien normalizado, …]}. */
function eq_ocupantes(array $S, string $hoy): array {
    $out = [];
    foreach (eq_asignaciones($S) as $a) {
        $desde = (string) ($a['desde'] ?? ''); $hasta = (string) ($a['hasta'] ?? '');
        if (($desde !== '' && $desde > $hoy) || ($hasta !== '' && $hasta < $hoy)) continue;
        $id = (string) ($a['puesto'] ?? ''); $q = eq_norm((string) ($a['usuario'] ?? ''));
        if ($id !== '' && $q !== '') $out[$id][$q] = true;
    }
    return array_map('array_keys', $out);
}

/**
 * 29-oct: el puesto que verifica a $p, desde «Verifica» (texto libre):
 * el puesto cuyo NOMBRE es el comienzo del texto, seguido de nada, una coma,
 * un punto y coma o un espacio («Dirección, cada semana» → Dirección). Sin
 * mayúsculas ni tildes; si varios encajan, el nombre más largo. null si
 * ninguno encaja.
 */
function eq_verificador(array $p, array $todos): ?string {
    $v = eq_norm((string) ($p['verifica'] ?? ''));
    if ($v === '') return null;
    $mejor = null; $largo = 0;
    foreach ($todos as $id => $x) {
        $n = eq_norm((string) ($x['puesto'] ?? ''));
        if ($n === '' || strpos($v, $n) !== 0) continue;
        $sigue = substr($v, strlen($n), 1);
        if ($sigue !== '' && $sigue !== ',' && $sigue !== ';' && $sigue !== ' ') continue;
        if (strlen($n) > $largo) { $mejor = (string) $id; $largo = strlen($n); }
    }
    return $mejor;
}

/**
 * Lo que esta persona ve y puede hacer: puestos (por ID), los que ocupa, los
 * que revisa, y la respuesta ya recortada.
 */
function eq_vista(array $S, string $usuario, array $roles, array $nombresRol, bool $todo): array {
    $hoy = (string) ($S['hoy'] ?? date('Y-m-d'));
    // Todos los puestos (para emparejar «Verifica») y los que esta persona ve.
    $todos = [];
    foreach ((array) ($S['puestos'] ?? []) as $p) if (is_array($p) && ($p['id'] ?? '') !== '') $todos[(string) $p['id']] = $p;
    $puestos = array_filter($todos, fn($p) => $todo || eq_para_mi($p, $usuario, $nombresRol));
    // Puestos que ocupa (asignaciones vigentes).
    $ocupantes = eq_ocupantes($S, $hoy);
    $ocupo = [];
    foreach ($ocupantes as $id => $quienes) {
        if (!isset($puestos[$id])) continue;
        foreach ($quienes as $q) if (eq_es_mia($q, $usuario, $nombresRol)) { $ocupo[$id] = true; break; }
    }
    // La raíz (el puesto sin «Reporta a»: Dirección): a ella sube la verificación cuando alguien se verificaría a sí mismo.
    $raiz = null;
    foreach ($todos as $id => $p) if (trim((string) ($p['reportaA'] ?? '')) === '') { $raiz = (string) $id; break; }
    // Quién verifica cada puesto (lo mismo para todos los que miran).
    $verificador = [];
    foreach ($todos as $id => $p) {
        $v = eq_verificador($p, $todos);
        $escalado = false;
        if ($v !== null && $v !== $raiz && array_intersect($ocupantes[$id] ?? [], $ocupantes[$v] ?? [])) { $v = $raiz; $escalado = true; }
        $verificador[$id] = ['id' => $v, 'escalado' => $escalado];
    }
    // Jefe: ocupa el puesto de «Reporta a», o uno de más arriba.
    $esJefe = function (string $id) use ($puestos, $ocupo): bool {
        $vistos = [];
        $j = (string) ($puestos[$id]['reportaA'] ?? '');
        while ($j !== '' && isset($puestos[$j]) && !isset($vistos[$j])) {
            if (isset($ocupo[$j])) return true;
            $vistos[$j] = true;
            $j = (string) ($puestos[$j]['reportaA'] ?? '');
        }
        return false;
    };
    // Verifica: ocupa el puesto verificador o tiene el rol con su nombre. Sin emparejar, como antes: el comienzo de «Verifica» contra sus roles.
    $verifico = function (string $id) use ($todos, $verificador, $ocupo, $nombresRol): bool {
        $v = $verificador[$id]['id'];
        if ($v !== null) {
            if (isset($ocupo[$v])) return true;
            foreach ($nombresRol as $n) if (eq_norm($n) === eq_norm((string) ($todos[$v]['puesto'] ?? ''))) return true;
            return false;
        }
        $quien = eq_norm(explode(',', (string) ($todos[$id]['verifica'] ?? ''))[0]);
        if ($quien === '') return false;
        foreach ($nombresRol as $n) if (eq_norm($n) === $quien) return true;
        return false;
    };
    $permite = fn(string $id) => $todo || roles_permiten($roles, 'equipo.ficha:' . $id);

    $desdeMarcas = date('Y-m-d', strtotime($hoy . ' -' . EQ_DIAS_MARCAS . ' days'));
    $de = function (string $tabla, string $id) use ($S): array {
        return array_values(array_filter((array) ($S[$tabla] ?? []), fn($x) => is_array($x) && (string) ($x['puesto'] ?? '') === $id));
    };
    $orden = fn(array $l) => (usort($l, fn($a, $b) => ((float) ($a['orden'] ?? 0)) <=> ((float) ($b['orden'] ?? 0))) ? $l : $l);
    $reciente = fn(array $l) => array_values(array_filter($l, fn($x) => substr((string) ($x['fecha'] ?? ''), 0, 10) >= $desdeMarcas));
    $deHoja = fn(string $nota) => preg_match('/^Hoja «([^»]*)»/u', $nota, $m) ? $m[1] : null;

    $lista = []; $fichas = []; $mios = []; $revisar = []; $reviso = [];
    foreach ($puestos as $id => $p) {
        $id = (string) $id;
        $abierto = eq_abierto($p);
        $ocupa = isset($ocupo[$id]); $jefe = $esJefe($id);
        // Nadie se verifica a sí mismo: quien ocupa el puesto no lo revisa, aunque sea su jefe o su verificador.
        $puedeRevisar = $abierto && !$ocupa && ($verifico($id) || $jefe);
        $veFicha = $permite($id) || ($abierto && ($ocupa || $jefe));
        $fila = ['id' => $id, 'puesto' => (string) ($p['puesto'] ?? ''), 'area' => (string) ($p['area'] ?? ''), 'reportaA' => (string) ($p['reportaA'] ?? ''),
                 'estado' => $todo ? (string) ($p['estado'] ?? '') : ($abierto ? EQ_ABIERTO : 'En construcción'), 'ficha' => $veFicha];
        if ($todo) $fila += ['unidad' => (string) ($p['unidad'] ?? ''), 'cantidad' => (string) ($p['cantidad'] ?? ''), 'version' => $p['version'] ?? null, 'fechaVersion' => (string) ($p['fechaVersion'] ?? '')];
        $lista[] = $fila;
        if ($abierto && $ocupa) $mios[] = $id;
        if ($puedeRevisar) { $revisar[] = $id; $reviso[] = $id; }
        if (!$veFicha) continue;
        $contrato = ['resultado' => [], 'trabajo' => [], 'estandares' => []];
        foreach ($orden($de('contratos', $id)) as $c) {
            $s = eq_norm((string) ($c['seccion'] ?? ''));
            $k = $s === 'resultado' ? 'resultado' : ($s === 'trabajo' ? 'trabajo' : (strpos($s, 'estandar') === 0 ? 'estandares' : null));
            if ($k) $contrato[$k][] = (string) ($c['texto'] ?? '');
        }
        $version = $p['version'] ?? null;
        $mias = array_values(array_filter($de('aceptaciones', $id), fn($a) => eq_norm((string) ($a['usuario'] ?? '')) === eq_norm($usuario)));
        $ultima = null; $ultimaFecha = '';
        foreach ($mias as $a) if ($ultima === null || (float) ($a['version'] ?? 0) >= (float) $ultima) { $ultima = $a['version'] ?? null; $ultimaFecha = (string) ($a['fecha'] ?? ''); }
        $aceptada = $version !== null && $ultima !== null && (float) $ultima === (float) $version;
        // Revisiones: las de la lista aquí; las de una hoja («Hoja «…»» al comienzo de la nota) van con su hoja.
        $revs = array_map(fn($x) => ['fecha' => (string) ($x['fecha'] ?? ''), 'revisor' => (string) ($x['revisor'] ?? ''), 'periodo' => (string) ($x['periodo'] ?? ''),
                                     'sorpresa' => (string) ($x['sorpresa'] ?? ''), 'resultado' => (string) ($x['resultado'] ?? ''), 'nota' => (string) ($x['nota'] ?? '')],
                          $reciente($de('revisiones', $id)));
        // Hojas diarias del puesto, en el orden del Sheet, con sus marcas y verificaciones recientes.
        $hojas = [];
        foreach ($orden($de('hojas', $id)) as $x) {
            $k = eq_norm((string) ($x['hoja'] ?? ''));
            if ($k === '') continue;
            if (!isset($hojas[$k])) $hojas[$k] = ['hoja' => (string) $x['hoja'], 'pasos' => [], 'marcas' => [], 'revisiones' => []];
            $hojas[$k]['pasos'][] = ['orden' => $x['orden'] ?? null, 'momento' => (string) ($x['momento'] ?? ''), 'paso' => (string) ($x['paso'] ?? '')];
        }
        foreach ($reciente($de('marcasHojas', $id)) as $m) {
            $k = eq_norm((string) ($m['hoja'] ?? ''));
            if (isset($hojas[$k])) $hojas[$k]['marcas'][] = ['fecha' => (string) ($m['fecha'] ?? ''), 'usuario' => (string) ($m['usuario'] ?? ''), 'orden' => $m['orden'] ?? null, 'iniciales' => (string) ($m['iniciales'] ?? '')];
        }
        foreach ($revs as $r) {
            $h = $deHoja($r['nota']);
            if ($h !== null && isset($hojas[eq_norm($h)])) $hojas[eq_norm($h)]['revisiones'][] = $r;
        }
        $vf = $verificador[$id];
        $fichas[$id] = [
            'version' => $version, 'fechaVersion' => (string) ($p['fechaVersion'] ?? ''), 'verifica' => (string) ($p['verifica'] ?? ''), 'comoVerifica' => (string) ($p['comoVerifica'] ?? ''),
            'unidad' => (string) ($p['unidad'] ?? ''), 'contrato' => $contrato,
            'lista' => array_map(fn($x) => ['orden' => $x['orden'] ?? null, 'texto' => (string) ($x['texto'] ?? ''), 'evidencia' => (string) ($x['evidencia'] ?? ''),
                                           'frecuencia' => (string) ($x['frecuencia'] ?? ''), 'periodo' => (string) ($x['periodo'] ?? ''),
                                           // 30-oct: el grupo y su orden los pone Procesos.gs (v4); con un script viejo, el texto de «Cada cuánto».
                                           'grupo' => (string) ($x['grupo'] ?? ($x['frecuencia'] ?? '')), 'grupoOrden' => (int) ($x['grupoOrden'] ?? 99)], $orden($de('listas', $id))),
            'procesos' => array_map(fn($x) => ['proceso' => (string) ($x['proceso'] ?? ''), 'descripcion' => (string) ($x['descripcion'] ?? ''),
                                              'enlace' => (string) ($x['enlace'] ?? ''), 'estado' => (string) ($x['estado'] ?? '')], $de('procesos', $id)),
            'ocupo' => $ocupa, 'jefe' => $jefe, 'verifico' => $puedeRevisar,
            'aceptada' => $aceptada, 'aceptadaVersion' => $ultima, 'aceptadaFecha' => $ultimaFecha,
            // 29-oct: quién verifica (el puesto emparejado; «escalado» si subió a Dirección), el PDF y las hojas diarias.
            'verificador' => $vf['id'] !== null ? ['id' => $vf['id'], 'puesto' => (string) ($todos[$vf['id']]['puesto'] ?? ''), 'escalado' => $vf['escalado']] : null,
            'pdf' => $todo || ($ocupa && $abierto),
            'hojas' => array_values($hojas),
            'marcas' => array_map(fn($x) => ['fecha' => (string) ($x['fecha'] ?? ''), 'usuario' => (string) ($x['usuario'] ?? ''), 'orden' => $x['orden'] ?? null,
                                            'periodo' => (string) ($x['periodo'] ?? ''), 'resultado' => (string) ($x['resultado'] ?? ''), 'nota' => (string) ($x['nota'] ?? '')],
                                  $reciente($de('marcas', $id))),
            'revisiones' => array_values(array_filter($revs, fn($r) => $deHoja($r['nota']) === null)),
        ];
    }
    // 29-oct: Reglas del juego (para todos, por sección en el orden del Sheet) y la hora de cada momento.
    $reglas = [];
    foreach ((array) ($S['reglas'] ?? []) as $r) {
        if (!is_array($r) || trim((string) ($r['texto'] ?? '')) === '') continue;
        $s = (string) ($r['seccion'] ?? '');
        if (!isset($reglas[$s])) $reglas[$s] = ['seccion' => $s, 'textos' => []];
        $reglas[$s]['textos'][] = $r;
    }
    $reglas = array_values(array_map(fn($g) => ['seccion' => $g['seccion'], 'textos' => array_map(fn($r) => (string) $r['texto'], $orden($g['textos']))], $reglas));
    $horarios = array_values(array_filter((array) ($S['horarios'] ?? []), fn($h) => is_array($h) && trim((string) ($h['momento'] ?? '')) !== ''));
    $respuesta = ['hoy' => $hoy, 'generado' => (string) ($S['generado'] ?? ''), 'yo' => ['usuario' => $usuario, 'todo' => $todo],
                  'puestos' => $lista, 'fichas' => (object) $fichas, 'mios' => $mios, 'revisar' => $revisar,
                  'reglas' => $reglas, 'momentos' => array_map(fn($h) => ['momento' => (string) $h['momento'], 'hora' => (string) ($h['hora'] ?? '')], $horarios)];
    if ($todo) {
        $respuesta['faltan'] = array_values(array_filter((array) ($S['faltan'] ?? []), 'is_string'));
        // La tabla de Horarios del servicio, con el NOMBRE de los puestos (un ID que no existe queda tal cual).
        $respuesta['horarios'] = array_map(fn($h) => ['momento' => (string) $h['momento'], 'unidad' => (string) ($h['unidad'] ?? ''), 'hora' => (string) ($h['hora'] ?? ''),
            'puestos' => array_values(array_map(fn($x) => (string) ($todos[trim($x)]['puesto'] ?? trim($x)), array_filter(explode(',', (string) ($h['puestos'] ?? '')), fn($x) => trim($x) !== '')))], $horarios);
    }
    return ['puestos' => $puestos, 'ocupo' => array_keys($ocupo), 'reviso' => $reviso, 'respuesta' => $respuesta];
}
