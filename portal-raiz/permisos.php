<?php
/* Roles del portal y lo que puede hacer cada uno. No se abre directamente
 * (el .htaccess lo prohíbe): lo cargan auth.php y los puentes de datos.
 *
 * Un usuario puede tener varios roles; los permisos se SUMAN. Un permiso es
 * un texto:
 *   area:<área>          abrir esa área del portal (carpeta, tarjeta, puente)
 *   as.<…>               acciones dentro de After School
 *   usuarios.gestionar   entrar a Configuración › Usuarios
 *   usuarios.admin       crear, editar, desactivar o reiniciar cuentas con rol
 *                        Administrador, y asignar ese rol
 * '*' concede todo; 'excepto' lo recorta para ese rol.
 * 'inactividad_max' (segundos): la sesión se cierra tras ese tiempo sin uso
 * (con varios roles manda el más corto).
 *
 * Las carpetas de la raíz del portal que no están en CARPETAS_AREA solo las
 * abre quien tenga area:* (Administrador y Dirección): una carpeta nueva no
 * queda abierta por descuido.
 */

const ROLES = [
    'administrador' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Administrador',
        'descripcion' => 'Todo, incluida la gestión de usuarios.',
        'permisos' => ['*'],
    ],
    'direccion' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Dirección',
        'descripcion' => 'Todo el negocio y la gestión de usuarios, salvo las cuentas con rol Administrador.',
        'permisos' => ['*'],
        'excepto' => ['usuarios.admin'],
    ],
    'coordinacion_afterschool' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Coordinación After School',
        'descripcion' => 'After School completo, Pasar lista (también otros días), seguimiento de asistencia y la Base de Datos VEA.',
        'permisos' => ['area:afterschool', 'area:basededatos', 'area:pasarlista', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.lista.ver', 'as.lista.marcar', 'as.lista.corregir', 'as.seguimiento'],
    ],
    'recepcion' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Recepción',
        'descripcion' => 'After School completo: inscribir, visitas del día, pagos, bajas, Por revisar y seguimiento. No pasa lista.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.seguimiento'],
    ],
    'comercial' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Comercial',
        'descripcion' => 'After School: Ocupación y Pruebas (ver y agendar). Tablero de Kínder y Base de Datos VEA.',
        'permisos' => ['area:afterschool', 'area:kinder', 'area:basededatos', 'as.ver', 'as.pruebas.ver',
                       'as.pruebas.agendar', 'as.contactos.prospectos'],
    ],
    'contabilidad' => [
        'inicio_as' => 'pagos',
        'nombre' => 'Contabilidad',
        'descripcion' => 'After School: Pagos (ver y registrar), pago de las pruebas y Ocupación en lectura. Sin datos de contacto.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.pagos.ver', 'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago'],
    ],
    'coordinacion_preescolar' => [
        'nombre' => 'Coordinación Preescolar',
        'descripcion' => 'Tablero de Kínder y Base de Datos VEA.',
        'permisos' => ['area:kinder', 'area:basededatos'],
    ],
    'profesor' => [
        'inicio_as' => 'lista',
        'nombre' => 'Profesor',
        'descripcion' => 'Solo Pasar lista, el mismo día: nombre, edad y la marca de visita de cada niño. La sesión se cierra tras 2 horas sin uso.',
        // 21-oct (rediseño): Pasar lista vive dentro de After School. El área
        // afterschool le abre la PÁGINA; sus datos siguen saliendo solo por
        // /pasar-lista/api.php (área pasarlista), que fija soloHoy y recorta.
        // En after-school/api.php no tiene ninguna acción (todas piden as.*).
        'permisos' => ['area:afterschool', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar'],
        'inactividad_max' => 7200,
    ],
];

/* Carpeta de la raíz del portal → área que hace falta para abrirla. */
const CARPETAS_AREA = [
    'kinder'        => 'kinder',
    'veranito'      => 'veranito',
    'after-school'  => 'afterschool',
    'basededatos'   => 'basededatos',
    'baby-and-me'   => 'babyandme',
    'cumpleanos'    => 'cumpleanos',
    'configuracion' => 'configuracion',
    'pasar-lista'   => 'pasarlista',
];

/* Áreas que la portada conoce (tarjetas). 'actio' es la tarjeta Sistema Operativo. */
/* 21-oct (rediseño): 'pasarlista' ya no es tarjeta (Pasar lista está dentro de After School). */
const AREAS = ['kinder', 'veranito', 'afterschool', 'basededatos', 'babyandme', 'cumpleanos', 'actio', 'configuracion'];

/* Dónde empieza cada área (para entrar directo tras el login si es la única). */
const AREA_URL = [
    'kinder' => '/kinder/', 'veranito' => '/veranito/', 'afterschool' => '/after-school/',
    'basededatos' => '/basededatos/', 'configuracion' => '/configuracion/',
];

/** Tras el login: si el usuario abre UNA sola sección del portal, va directo a ella; si no, a la portada. */
function destino_inicio(array $roles): string {
    $v = areas_visibles($roles);
    if ($v === '*') return '/';
    $conUrl = array_values(array_filter($v, fn($a) => isset(AREA_URL[$a])));
    return count($conUrl) === 1 && count($v) === 1 ? AREA_URL[$conUrl[0]] : '/';
}

/** La pestaña de After School con la que abre la página: la del primer rol (en el orden de ROLES) que la defina. */
function inicio_as(array $roles): string {
    foreach (ROLES as $id => $def) if (in_array($id, $roles, true) && !empty($def['inicio_as'])) return $def['inicio_as'];
    return 'ocupacion';
}

/* Contactos de las familias (teléfonos y correo). El nombre del responsable no cuenta. */
const CAMPOS_CONTACTO = ['telefono', 'telefono2', 'correo', 'telefonoResp2'];

function rol_valido(string $rol): bool { return isset(ROLES[$rol]); }

/** ¿Alguno de estos roles concede el permiso? */
function roles_permiten(array $roles, string $permiso): bool {
    foreach ($roles as $r) {
        $def = ROLES[$r] ?? null;
        if (!$def) continue;
        if (in_array($permiso, $def['excepto'] ?? [], true)) continue;
        if (in_array('*', $def['permisos'], true) || in_array($permiso, $def['permisos'], true)) return true;
        // area:* concede cualquier área
        if (str_starts_with($permiso, 'area:') && in_array('area:*', $def['permisos'], true)) return true;
    }
    return false;
}

/** Área que pide una ruta relativa a la raíz del portal ('' = sin área: la portada y sus archivos). */
function area_de_ruta(string $ruta): ?string {
    $ruta = ltrim(str_replace('\\', '/', $ruta), '/');
    $p = strpos($ruta, '/');
    if ($p === false) return null;               // archivo de la raíz
    $carpeta = substr($ruta, 0, $p);
    return CARPETAS_AREA[$carpeta] ?? '*';       // carpeta sin asignar: solo area:*
}

/** ¿Pueden estos roles abrir esa ruta? */
function roles_abren_ruta(array $roles, string $ruta): bool {
    $area = area_de_ruta($ruta);
    if ($area === null) return true;
    return roles_permiten($roles, 'area:' . $area);
}

/** Lo que se le dice a la portada: '*' o la lista de áreas visibles. */
function areas_visibles(array $roles) {
    if (roles_permiten($roles, 'area:*')) return '*';
    return array_values(array_filter(AREAS, fn($a) => roles_permiten($roles, 'area:' . $a)));
}

/** Política de contactos en After School: 'todos', 'prospectos' o 'ninguno'. */
function politica_contactos(array $roles): string {
    if (roles_permiten($roles, 'as.contactos.todos')) return 'todos';
    if (roles_permiten($roles, 'as.contactos.prospectos')) return 'prospectos';
    return 'ninguno';
}

/** Permisos de After School que la página necesita conocer para mostrar pestañas y botones. */
const PERMISOS_AS = ['as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar', 'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar',
                     'as.visitas.agendar', 'as.seguimiento', 'as.lista.marcar', 'as.lista.corregir', 'as.lista.ver'];
function permisos_as(array $roles): array {
    return array_values(array_filter(PERMISOS_AS, fn($p) => roles_permiten($roles, $p)));
}

/* Acción de After School → permiso que exige. Las que no están exigen as.completo. */
const PERMISO_ACCION_AS = [
    'leer'          => 'as.ver',
    'ocupacion'     => 'as.ver',
    'listarPagos'   => 'as.pagos.ver',
    'registrarPago' => 'as.pagos.registrar',
    'agendarPrueba' => 'as.pruebas.agendar',
    'pagoPrueba'    => 'as.pruebas.pago',
    // 21-oct
    'agendarVisita'        => 'as.visitas.agendar',
    'seguimiento'          => 'as.seguimiento',
    'asistenciaNino'       => 'as.seguimiento',
    'noHuboClase'          => 'as.lista.corregir',
    'resolverFueraDeLista' => 'as.lista.corregir',
    'leerLista'            => 'as.lista.ver',
    'guardarLista'         => 'as.lista.marcar',
];
/* Las de Pasar lista solo entran por /pasar-lista/api.php, que fija soloHoy. */
const ACCIONES_LISTA = ['leerLista', 'guardarLista'];

/** Segundos sin uso tras los que se cierra la sesión (null = sin tope). Con varios roles, el más corto. */
function inactividad_max(array $roles): ?int {
    $min = null;
    foreach ($roles as $r) {
        $s = ROLES[$r]['inactividad_max'] ?? null;
        if (is_int($s) && ($min === null || $s < $min)) $min = $s;
    }
    return $min;
}
function permiso_de_accion_as(string $accion): string {
    return PERMISO_ACCION_AS[$accion] ?? 'as.completo';
}

/**
 * Quita los contactos de los niños que el rol no debe ver, en cualquier
 * parte de la respuesta (lectura y estado que devuelven las escrituras).
 * Un niño es un objeto con 'id' y alguno de los campos de contacto.
 * Trabaja con objetos (json_decode sin assoc) para no convertir {} en [].
 */
function filtrar_contactos($valor, string $politica) {
    if ($politica === 'todos') return $valor;
    if (is_array($valor)) {
        foreach ($valor as $k => $v) $valor[$k] = filtrar_contactos($v, $politica);
        return $valor;
    }
    if (is_object($valor)) {
        $esNino = isset($valor->id);
        if ($esNino) {
            $tiene = false;
            foreach (CAMPOS_CONTACTO as $c) if (property_exists($valor, $c)) { $tiene = true; break; }
            $esNino = $tiene;
        }
        if ($esNino && !($politica === 'prospectos' && ($valor->estado ?? '') === 'Prospecto')) {
            foreach (CAMPOS_CONTACTO as $c) unset($valor->$c);
        }
        foreach (get_object_vars($valor) as $k => $v) $valor->$k = filtrar_contactos($v, $politica);
        return $valor;
    }
    return $valor;
}
