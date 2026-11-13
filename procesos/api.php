<?php
/* Puente de Procesos (23-oct): la biblioteca permanente de Vida en Arte. Los
 * mismos documentos del catálogo («Documentos VEA» del Sheet «Datos — Vida en
 * Arte»), por unidad y proceso. SOLO LECTURA. Contrato en
 * docs/ACCIONES_API.md › Procesos.
 *
 * Reutiliza proyecto-actio/api.php cargándolo con PA_SOLO_FUNCIONES: la misma
 * lectura del Apps Script, la misma copia en portal_cache/ y el MISMO recorte
 * (pa_recortar) que recibe Dirección.
 *
 * Cerrojos:
 *   1. requerir_sesion(): sesión y área «procesos» (13-nov: solo Dirección y
 *      Soporte Actio; los demás roles responden «sin_permiso»).
 *   2. Una sola acción, «leer».
 *   3. Solo lo visible para el cliente, para TODOS los roles (también
 *      Administrador): pa_recortar sin pa.internos.
 *   4. Solo documentos, solo de los tres procesos (procesos_segmentos) y solo
 *      los campos que usa la pantalla: nombre, unidad, proceso, fecha, enlace.
 *      Nunca entregables, reuniones, acompañamiento, proyecto ni tipo.
 *   5. Permiso por fila (procesos_permite): hoy todos tienen procesos.ver:*,
 *      que desde el 5-nov (ajuste 4) NO cubre «General» (Gerencia): esa unidad
 *      la reciben solo Dirección y Administrador (PROCESOS_RESERVADAS en
 *      permisos.php). Pedir {accion:'leer', unidad:'General'} sin permiso da
 *      403 «sin_permiso».
 *   6. Los archivos de /biblioteca/ (5-nov): gate.php carga este archivo con
 *      PROCESOS_SOLO_FUNCIONES y entrega uno solo a quien lo recibe en su
 *      lista (procesos_biblioteca_permite): Procesos para todos y, para quien
 *      abre Proyecto Actio, también lo de Proyecto Actio. Si no, 403.
 *
 * portal_config.php, además de pa_exec, pa_clave y pa_proyectos_cliente:
 *     'procesos_segmentos' => ['Atracción' => ['Marketing'], 'Adquisición' => ['Ventas'], 'Entrega de servicio' => ['Servicio']],
 *     'procesos_general'   => ['Gerencia'],
 */
if (!defined('PA_SOLO_FUNCIONES')) define('PA_SOLO_FUNCIONES', true);
require_once dirname(__DIR__) . '/proyecto-actio/api.php';

const PROCESOS_CAMPOS = ['nombre', 'unidad', 'proceso', 'fecha', 'enlace'];
const PROCESOS_TILDES = ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u'];
/* Un archivo de la biblioteca en un enlace del Sheet: /biblioteca/<x>.html, la ruta vieja
   /proyecto-actio/archivos/<x>.html o la dirección completa del portal. Lo mismo que comun/visor.js. */
const PROCESOS_RE_BIBLIOTECA = '#^(?:https?://[^/]+)?/(?:biblioteca|proyecto-actio/archivos)/([a-z0-9][a-z0-9-]*\.html)$#';

if (!defined('PROCESOS_SOLO_FUNCIONES')) {
    requerir_sesion();
    pa_cabeceras();
    $cfg = pa_config(['procesos_segmentos', 'procesos_general']);
    pa_exigir_leer();
    // 5-nov (ajuste 4): {accion:'leer', unidad:'<unidad>'} pide solo esa unidad; sin permiso para ella, 403.
    $pedido = json_decode((string) file_get_contents('php://input'), true);
    $unidadPedida = is_array($pedido) && isset($pedido['unidad']) ? trim((string) $pedido['unidad']) : '';
    if ($unidadPedida !== '' && !procesos_unidad_permitida(roles_actuales(), $unidadPedida, $cfg['procesos_segmentos']))
        fallo('Tu usuario no tiene permiso para ver los documentos de «' . $unidadPedida . '».', 403, 'sin_permiso');
    session_write_close();   // 23-oct: soltar la sesión antes de esperar a Google (ver pasar-lista/api.php)
    $l = pa_leer_catalogo($cfg);
    echo procesos_respuesta(pa_recortar($l['cuerpo'], false, $cfg['pa_proyectos_cliente'], $l['edad']),
        $cfg['procesos_segmentos'], $cfg['procesos_general'], roles_actuales(), $unidadPedida);
    exit;
}

/** ¿Puede este rol ver algún proceso de esa unidad? (5-nov: para pedir una unidad sola). */
function procesos_unidad_permitida(array $roles, string $unidad, array $segmentos): bool {
    foreach (array_keys($segmentos) as $proceso) if (procesos_permite($roles, $unidad, (string) $proceso)) return true;
    return false;
}

/**
 * 5-nov (ajuste 4): ¿puede este rol abrir el archivo <nombre>.html de /biblioteca/? Solo si lo
 * recibe en alguna de sus listas, con el MISMO recorte de los puentes: Procesos (13-nov: solo para
 * quien abre Procesos) y, para quien abre Proyecto Actio, también lo de Proyecto
 * Actio (Dirección sin lo interno). Un archivo que no está en ninguna lista suya no se entrega.
 * Si no se puede leer el catálogo, pa_leer_catalogo corta con su error (nunca se entrega a ciegas).
 */
function procesos_biblioteca_permite(array $roles, string $nombre): bool {
    $c = pa_config(['procesos_segmentos', 'procesos_general']);
    $cat = pa_leer_catalogo($c);
    // 13-nov (roles-gerencia): la lista de Procesos cuenta solo para quien abre Procesos (area:procesos:
    // Dirección y Soporte Actio). Los demás roles ya no reciben archivos de la biblioteca por Procesos.
    $listas = [];
    if (roles_permiten($roles, 'area:procesos'))
        $listas[] = procesos_respuesta(pa_recortar($cat['cuerpo'], false, $c['pa_proyectos_cliente'], $cat['edad']),
            $c['procesos_segmentos'], $c['procesos_general'], $roles);
    if (roles_permiten($roles, 'area:proyecto-actio'))
        $listas[] = pa_recortar($cat['cuerpo'], roles_permiten($roles, 'pa.internos'), $c['pa_proyectos_cliente'], $cat['edad']);
    foreach ($listas as $texto) {
        $j = json_decode($texto, true);
        if (!is_array($j) || ($j['ok'] ?? false) !== true || !is_array($j['resultado'] ?? null)) continue;
        $hay = false;
        array_walk_recursive($j['resultado'], function ($v) use ($nombre, &$hay) {
            if (is_string($v) && preg_match(PROCESOS_RE_BIBLIOTECA, trim($v), $m) && $m[1] === $nombre) $hay = true;
        });
        if ($hay) return true;
    }
    return false;
}

/**
 * De lo que recibiría Dirección, solo los documentos de los tres procesos que
 * este rol puede ver, con los campos de la pantalla.
 */
function procesos_respuesta(string $recortado, array $segmentos, array $general, array $roles, string $soloUnidad = ''): string {
    $j = json_decode($recortado, true);
    if (!is_array($j) || ($j['ok'] ?? false) !== true) return $recortado;   // el error de pa_recortar, tal cual
    $deSegmento = [];
    foreach ($segmentos as $proceso => $lista) foreach ((array) $lista as $s) $deSegmento[pa_norm(strtr((string) $s, PROCESOS_TILDES))] = (string) $proceso;
    $esGeneral = array_map(fn($u) => pa_norm(strtr((string) $u, PROCESOS_TILDES)), $general);
    $docs = [];
    foreach ($j['resultado']['documentos'] ?? [] as $d) {
        $proceso = $deSegmento[pa_norm(strtr((string) ($d['segmento'] ?? ''), PROCESOS_TILDES))] ?? null;
        if ($proceso === null) continue;                                   // Finanzas, vacío u otro: no aparece
        $unidad = trim((string) ($d['unidad'] ?? ''));
        if (in_array(pa_norm(strtr($unidad, PROCESOS_TILDES)), $esGeneral, true)) $unidad = 'General';
        if (!procesos_permite($roles, $unidad, $proceso)) continue;
        if ($soloUnidad !== '' && procesos_clave($unidad) !== procesos_clave($soloUnidad)) continue;
        $fila = ['nombre' => (string) ($d['nombre'] ?? ''), 'unidad' => $unidad, 'proceso' => $proceso,
                 'fecha' => (string) ($d['fecha'] ?? ''), 'enlace' => (string) ($d['enlace'] ?? '')];
        $docs[] = array_intersect_key($fila, array_flip(PROCESOS_CAMPOS));
    }
    $resp = ['ok' => true, 'resultado' => ['generado' => (string) ($j['resultado']['generado'] ?? ''),
        'procesos' => array_map(fn($p) => ['nombre' => (string) $p, 'segmentos' => array_map('strval', (array) $segmentos[$p])], array_keys($segmentos)),
        'documentos' => $docs]];
    if (isset($j['copia'])) $resp['copia'] = $j['copia'];
    return json_encode($resp, JSON_UNESCAPED_UNICODE);
}

