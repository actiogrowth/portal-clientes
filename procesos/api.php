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
 *   1. requerir_sesion(): sesión y área «procesos» (todos los roles).
 *   2. Una sola acción, «leer».
 *   3. Solo lo visible para el cliente, para TODOS los roles (también
 *      Administrador): pa_recortar sin pa.internos.
 *   4. Solo documentos, solo de los tres procesos (procesos_segmentos) y solo
 *      los campos que usa la pantalla: nombre, unidad, proceso, fecha, enlace.
 *      Nunca entregables, reuniones, acompañamiento, proyecto ni tipo.
 *   5. Permiso por fila (procesos_permite): hoy todos tienen procesos.ver:*.
 *
 * portal_config.php, además de pa_exec, pa_clave y pa_proyectos_cliente:
 *     'procesos_segmentos' => ['Atracción' => ['Marketing'], 'Adquisición' => ['Ventas'], 'Entrega de servicio' => ['Servicio']],
 *     'procesos_general'   => ['Gerencia'],
 */
define('PA_SOLO_FUNCIONES', true);
require dirname(__DIR__) . '/proyecto-actio/api.php';
requerir_sesion();
pa_cabeceras();

const PROCESOS_CAMPOS = ['nombre', 'unidad', 'proceso', 'fecha', 'enlace'];
const PROCESOS_TILDES = ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u'];

$cfg = pa_config(['procesos_segmentos', 'procesos_general']);
pa_exigir_leer();
session_write_close();   // 23-oct: soltar la sesión antes de esperar a Google (ver pasar-lista/api.php)
$l = pa_leer_catalogo($cfg);
echo procesos_respuesta(pa_recortar($l['cuerpo'], false, $cfg['pa_proyectos_cliente'], $l['edad']),
    $cfg['procesos_segmentos'], $cfg['procesos_general'], roles_actuales());
exit;

/**
 * De lo que recibiría Dirección, solo los documentos de los tres procesos que
 * este rol puede ver, con los campos de la pantalla.
 */
function procesos_respuesta(string $recortado, array $segmentos, array $general, array $roles): string {
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

