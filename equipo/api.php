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
 *   2. Cuatro acciones: leer, aceptar, marcar, revisar.
 *   3. EL RECORTE ES DE ESTE ARCHIVO: el script devuelve el Sheet entero y
 *      aquí se arma la respuesta de cada persona. Sin equipo.todo
 *      (Dirección y Administrador lo tienen por '*'): del organigrama solo el
 *      nombre y el área de cada puesto; una ficha solo si el puesto está
 *      «Abierto al equipo» y la persona lo ocupa o es su jefe; un puesto con
 *      «Visible solo para» no existe para nadie más (26-oct); las marcas y
 *      revisiones, solo de esas fichas; las aceptaciones, solo las suyas.
 *   4. Escribir: aceptar y marcar solo quien OCUPA el puesto; revisar solo
 *      quien figura en «Verifica» o es su jefe. Siempre en puestos abiertos.
 *      El script vuelve a mirar el estado, la versión y el período.
 *   5. Suelta la sesión antes de esperar a Google (D-068).
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
define('AS_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/after-school/api.php';
require_once dirname(__DIR__) . '/auth.php';
requerir_sesion();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

const EQ_ABIERTO = 'Abierto al equipo';
const EQ_CACHE_SEG = 60;
const EQ_DIAS_MARCAS = 120;   // marcas y revisiones que se mandan: las de los últimos N días

$rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
$cfg = require $rutaConfig;
if (!is_array($cfg) || empty($cfg['pr_exec']) || empty($cfg['pr_clave']))
    fallo('portal_config.php no tiene pr_exec y pr_clave para Equipo', 500, 'sin_configuracion');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
$datos = json_decode(file_get_contents('php://input'), true);
$accion = is_array($datos) ? (string) ($datos['accion'] ?? '') : '';
if (!in_array($accion, ['leer', 'aceptar', 'marcar', 'revisar'], true)) fallo('Acción desconocida.', 403, 'sin_permiso');

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
    echo json_encode(['ok' => true, 'resultado' => $V['respuesta']], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ─── Escribir: primero quién, después el script (que mira el resto) ──── */
$d = is_array($datos['datos'] ?? null) ? $datos['datos'] : [];
$puesto = (string) ($d['puesto'] ?? '');
$p = $V['puestos'][$puesto] ?? null;
if (!$p) fallo('No existe el puesto.', 403, 'sin_permiso');
if (!eq_abierto($p)) fallo('El puesto todavía no está abierto al equipo.', 403, 'no_abierto');
if (in_array($accion, ['aceptar', 'marcar'], true) && !in_array($puesto, $V['ocupo'], true))
    fallo('Solo quien ocupa el puesto puede ' . ($accion === 'aceptar' ? 'aceptar su contrato.' : 'marcar su lista.'), 403, 'sin_permiso');
if ($accion === 'revisar' && !in_array($puesto, $V['reviso'], true))
    fallo('Solo quien verifica el puesto o su jefe puede revisarlo.', 403, 'sin_permiso');
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

/* ─── El Sheet (con su copia corta) ────────────────────────────────────── */

function eq_sheet(array $cfg, string $archivo, int $ttl, string $usuario): array {
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
        fallo(is_array($j) ? (string) ($j['error'] ?? 'El Sheet respondió con un error.') : 'El Sheet no respondió.', $res['http'] === 200 ? 502 : $res['http'], 'incierto');
    }
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $tmp = $archivo . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode(['t' => time(), 'r' => $j['resultado']], JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) { @chmod($tmp, 0600); @rename($tmp, $archivo); }
    return $j['resultado'];
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
 * Lo que esta persona ve y puede hacer: puestos (por ID), los que ocupa, los
 * que revisa, y la respuesta ya recortada.
 */
function eq_vista(array $S, string $usuario, array $roles, array $nombresRol, bool $todo): array {
    $hoy = (string) ($S['hoy'] ?? date('Y-m-d'));
    $puestos = [];
    foreach ((array) ($S['puestos'] ?? []) as $p) if (is_array($p) && ($p['id'] ?? '') !== '' && ($todo || eq_para_mi($p, $usuario, $nombresRol))) $puestos[(string) $p['id']] = $p;
    // Puestos que ocupa (Asignaciones vigentes).
    $ocupo = [];
    foreach ((array) ($S['asignaciones'] ?? []) as $a) {
        if (!is_array($a) || !isset($puestos[(string) ($a['puesto'] ?? '')])) continue;
        $desde = (string) ($a['desde'] ?? ''); $hasta = (string) ($a['hasta'] ?? '');
        if (($desde !== '' && $desde > $hoy) || ($hasta !== '' && $hasta < $hoy)) continue;
        if (eq_es_mia((string) ($a['usuario'] ?? ''), $usuario, $nombresRol)) $ocupo[(string) $a['puesto']] = true;
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
    $verifico = function (array $p) use ($nombresRol): bool {
        $quien = eq_norm(explode(',', (string) ($p['verifica'] ?? ''))[0]);
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

    $lista = []; $fichas = []; $mios = []; $revisar = []; $reviso = [];
    foreach ($puestos as $id => $p) {
        $abierto = eq_abierto($p);
        $ocupa = isset($ocupo[$id]); $jefe = $esJefe($id); $verif = $verifico($p);
        $veFicha = $permite($id) || ($abierto && ($ocupa || $jefe));
        $fila = ['id' => $id, 'puesto' => (string) ($p['puesto'] ?? ''), 'area' => (string) ($p['area'] ?? ''), 'reportaA' => (string) ($p['reportaA'] ?? ''),
                 'estado' => $todo ? (string) ($p['estado'] ?? '') : ($abierto ? EQ_ABIERTO : 'En construcción'), 'ficha' => $veFicha];
        if ($todo) $fila += ['unidad' => (string) ($p['unidad'] ?? ''), 'cantidad' => (string) ($p['cantidad'] ?? ''), 'version' => $p['version'] ?? null, 'fechaVersion' => (string) ($p['fechaVersion'] ?? '')];
        $lista[] = $fila;
        if ($abierto && $ocupa) $mios[] = $id;
        if ($abierto && ($verif || $jefe)) { $revisar[] = $id; $reviso[] = $id; }
        if (!$veFicha) continue;
        $contrato = ['resultado' => [], 'trabajo' => [], 'estandares' => []];
        foreach ($orden($de('contratos', $id)) as $c) {
            $s = eq_norm((string) ($c['seccion'] ?? ''));
            $k = $s === 'resultado' ? 'resultado' : ($s === 'trabajo' ? 'trabajo' : (strpos($s, 'estandar') === 0 ? 'estandares' : null));
            if ($k) $contrato[$k][] = (string) ($c['texto'] ?? '');
        }
        $version = $p['version'] ?? null;
        $mias = array_values(array_filter($de('aceptaciones', $id), fn($a) => eq_norm((string) ($a['usuario'] ?? '')) === eq_norm($usuario)));
        $ultima = null;
        foreach ($mias as $a) if ($ultima === null || (float) ($a['version'] ?? 0) >= (float) $ultima) $ultima = $a['version'] ?? null;
        $fichas[$id] = [
            'version' => $version, 'fechaVersion' => (string) ($p['fechaVersion'] ?? ''), 'verifica' => (string) ($p['verifica'] ?? ''), 'comoVerifica' => (string) ($p['comoVerifica'] ?? ''),
            'unidad' => (string) ($p['unidad'] ?? ''), 'contrato' => $contrato,
            'lista' => array_map(fn($x) => ['orden' => $x['orden'] ?? null, 'texto' => (string) ($x['texto'] ?? ''), 'evidencia' => (string) ($x['evidencia'] ?? ''),
                                           'frecuencia' => (string) ($x['frecuencia'] ?? ''), 'periodo' => (string) ($x['periodo'] ?? '')], $orden($de('listas', $id))),
            'procesos' => array_map(fn($x) => ['proceso' => (string) ($x['proceso'] ?? ''), 'descripcion' => (string) ($x['descripcion'] ?? ''),
                                              'enlace' => (string) ($x['enlace'] ?? ''), 'estado' => (string) ($x['estado'] ?? '')], $de('procesos', $id)),
            'ocupo' => $ocupa, 'jefe' => $jefe, 'verifico' => $verif && $abierto,
            'aceptada' => $version !== null && $ultima !== null && (float) $ultima === (float) $version, 'aceptadaVersion' => $ultima,
            'marcas' => array_map(fn($x) => ['fecha' => (string) ($x['fecha'] ?? ''), 'usuario' => (string) ($x['usuario'] ?? ''), 'orden' => $x['orden'] ?? null,
                                            'periodo' => (string) ($x['periodo'] ?? ''), 'resultado' => (string) ($x['resultado'] ?? ''), 'nota' => (string) ($x['nota'] ?? '')],
                                  array_values(array_filter($de('marcas', $id), fn($x) => substr((string) ($x['fecha'] ?? ''), 0, 10) >= $desdeMarcas))),
            'revisiones' => array_map(fn($x) => ['fecha' => (string) ($x['fecha'] ?? ''), 'revisor' => (string) ($x['revisor'] ?? ''), 'periodo' => (string) ($x['periodo'] ?? ''),
                                                'sorpresa' => (string) ($x['sorpresa'] ?? ''), 'resultado' => (string) ($x['resultado'] ?? ''), 'nota' => (string) ($x['nota'] ?? '')],
                                      array_values(array_filter($de('revisiones', $id), fn($x) => substr((string) ($x['fecha'] ?? ''), 0, 10) >= $desdeMarcas))),
        ];
    }
    $respuesta = ['hoy' => $hoy, 'generado' => (string) ($S['generado'] ?? ''), 'yo' => ['usuario' => $usuario, 'todo' => $todo],
                  'puestos' => $lista, 'fichas' => (object) $fichas, 'mios' => $mios, 'revisar' => $revisar];
    if ($todo) $respuesta['faltan'] = array_values(array_filter((array) ($S['faltan'] ?? []), 'is_string'));
    return ['puestos' => $puestos, 'ocupo' => array_keys($ocupo), 'reviso' => $reviso, 'respuesta' => $respuesta];
}
