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
 *   pa.internos          Proyecto Actio: ver lo que es solo de Actio (los
 *                        proyectos que no son del cliente, p. ej. Proyecto 2)
 *   equipo.todo          Procesos › Equipo (26-oct): ver todos los puestos y fichas en
 *                        cualquier estado (Dirección y Administrador, por '*').
 *   equipo.ficha:<ID>    preparado: ver la ficha de ese puesto aunque no lo ocupe ni
 *                        sea su jefe (hoy no lo tiene ningún rol).
 *   mensajes.enviar      Mensajes a familias: enviar el correo (el servidor lo manda
 *                        desde el buzón del hosting), «Enviarme una prueba» y ver o
 *                        copiar los correos (5-nov: solo Dirección y Administrador,
 *                        por '*'). Con area:mensajes, sin este permiso, se abre la
 *                        pantalla, se arma el grupo y se ven las cifras y la vista
 *                        previa, pero el servidor no da los correos ni envía (Comercial).
 *   mensajes.plantillas  crear y editar las plantillas de mensajes (Dirección y
 *                        Administrador, por '*').
 *   procesos.ver:<…>     Procesos (23-oct): qué documentos recibe. '*' todos;
 *                        '<unidad>' toda la unidad; '<unidad>:<proceso>' uno
 *                        solo (ver procesos_permite). Hoy todos los roles
 *                        tienen 'procesos.ver:*'. 5-nov (ajuste 4): '*' NO
 *                        cubre las unidades de PROCESOS_RESERVADAS («General»,
 *                        los documentos de Gerencia): esas piden su permiso
 *                        propio, 'procesos.ver:general', que hoy solo tienen
 *                        Dirección y Administrador (por '*'). Vale también
 *                        para los archivos de /biblioteca/ (gate.php).
 *   bd.editar            Base de Datos VEA (4-nov, D-123): guardar y eliminar
 *                        por basededatos/api.php. Leer basta con
 *                        area:basededatos. Hoy lo tienen todos los roles que
 *                        abren la Base de Datos (como hasta ahora: todos
 *                        editaban); quitarlo de un rol lo deja en solo lectura
 *                        del lado del servidor.
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
        'excepto' => ['usuarios.admin', 'pa.internos'],
    ],
    'coordinacion_afterschool' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Coordinación After School',
        'descripcion' => 'After School completo, Pasar lista (también otros días), seguimiento de asistencia y la Base de Datos VEA.',
        'permisos' => ['area:afterschool', 'area:basededatos', 'area:pasarlista', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.lista.ver', 'as.lista.marcar', 'as.lista.corregir', 'as.seguimiento', 'area:procesos', 'procesos.ver:*', 'area:equipo',
                       'bd.editar'],   // 4-nov: guarda en la Base de Datos (D-123)
    ],
    'recepcion' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Recepción',
        'descripcion' => 'After School completo: inscribir, visitas del día, pagos, bajas, Por revisar y seguimiento. No pasa lista.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.seguimiento', 'area:procesos', 'procesos.ver:*', 'area:equipo'],
    ],
    'comercial' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Comercial',
        'descripcion' => 'After School: Ocupación y Pruebas (ver y agendar). Tablero de Preschool, Base de Datos VEA y Mensajes a familias (armar y revisar, sin enviar).',
        'permisos' => ['area:afterschool', 'area:kinder', 'area:basededatos', 'as.ver', 'as.pruebas.ver',
                       'as.pruebas.agendar', 'as.contactos.prospectos', 'area:procesos', 'procesos.ver:*', 'area:equipo',
                       // 3-nov: Mensajes a familias. 5-nov: arma el grupo y ve la vista previa, pero
                       // NO envía ni ve los correos (sin mensajes.enviar; envían Dirección y Administrador).
                       'area:mensajes',
                       'bd.editar'],   // 4-nov: guarda en la Base de Datos (D-123)
    ],
    'contabilidad' => [
        'inicio_as' => 'pagos',
        'nombre' => 'Contabilidad',
        'descripcion' => 'After School: Pagos (ver y registrar), pago de las pruebas y Ocupación en lectura. Sin datos de contacto.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.pagos.ver', 'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'area:procesos', 'procesos.ver:*', 'area:equipo'],
    ],
    'coordinacion_preescolar' => [
        'nombre' => 'Coordinación Preschool',
        'descripcion' => 'Tablero de Preschool y Base de Datos VEA.',
        'permisos' => ['area:kinder', 'area:basededatos', 'area:procesos', 'procesos.ver:*', 'area:equipo',
                       'bd.editar'],   // 4-nov: guarda en la Base de Datos (D-123)
    ],
    'profesor' => [
        'inicio_as' => 'lista',
        'nombre' => 'Profesor',
        'descripcion' => 'Solo Pasar lista, el mismo día: nombre, edad y la marca de visita de cada niño. La sesión se cierra tras 2 horas sin uso.',
        // 21-oct (rediseño): Pasar lista vive dentro de After School. El área
        // afterschool le abre la PÁGINA; sus datos siguen saliendo solo por
        // /pasar-lista/api.php (área pasarlista), que fija soloHoy y recorta.
        // En after-school/api.php no tiene ninguna acción (todas piden as.*).
        // 23-oct: también Procesos, al que llega desde Inicio (no cambia su entrada directa).
        'permisos' => ['area:afterschool', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:procesos', 'procesos.ver:*', 'area:equipo'],
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
    'proyecto-actio' => 'proyecto-actio',   // 22-oct: solo Administrador y Dirección (nadie más la tiene)
    'procesos'      => 'procesos',          // 23-oct: todos los roles
    'equipo'        => 'equipo',            // 26-oct: Mi lista, Revisar y el puente de Equipo; todos los roles
    'resumen'       => 'resumen',           // 26-oct: Resumen (26-oct: del negocio); solo Administrador y Dirección (nadie más la tiene)
    'mensajes'      => 'mensajes',          // 3-nov: Mensajes a familias; Administrador, Dirección y Comercial
    'pendientes'    => 'equipo',            // 26-oct: el puente de «Pendientes de hoy» de la portada; todos los roles (cada uno recibe lo suyo)
];

/* 23-oct: carpetas que abre CUALQUIER usuario con sesión, sin área: la
   biblioteca de presentaciones (la usan Procesos y Proyecto Actio). */
const CARPETAS_LIBRES = ['biblioteca'];

/* Áreas que la portada conoce (tarjetas). 22-oct: 'proyecto-actio' reemplaza a
   'actio' (la tarjeta Sistema Operativo, que llevaba a GitHub Pages). */
/* 21-oct (rediseño): 'pasarlista' ya no es tarjeta (Pasar lista está dentro de After School). */
const AREAS = ['kinder', 'veranito', 'afterschool', 'basededatos', 'babyandme', 'cumpleanos', 'proyecto-actio', 'configuracion', 'procesos', 'equipo', 'resumen', 'mensajes'];

/* 23-oct: la portada agrupa las unidades por marca; tocar un logo abre la
   página de esa marca (la portada con ?marca=). Mismo orden que en comun/marca.js. */
const MARCAS = [
    'vea'  => ['afterschool', 'veranito', 'cumpleanos'],
    'kids' => ['kinder', 'babyandme'],
];
/* Áreas que no cuentan para entrar directo: todos los roles tienen Procesos y
   llegan a ella desde Inicio. */
const AREAS_SIN_ENTRADA = ['procesos', 'equipo'];   // 26-oct: Equipo también (todos lo tienen)

/* Dónde empieza cada área (para entrar directo tras el login si es la única). */
const AREA_URL = [
    'kinder' => '/kinder/', 'veranito' => '/veranito/', 'afterschool' => '/after-school/',
    'basededatos' => '/basededatos/', 'configuracion' => '/configuracion/', 'proyecto-actio' => '/proyecto-actio/',
    'procesos' => '/procesos/', 'equipo' => '/equipo/', 'resumen' => '/resumen/', 'mensajes' => '/mensajes/',
];

/** Tras el login: si el usuario abre UNA sola sección, va directo a ella; si
    todo lo que abre son unidades de una misma marca, a la página de esa marca;
    si no, a la portada. Procesos no cuenta (AREAS_SIN_ENTRADA). */
function destino_inicio(array $roles): string {
    return destino_de_areas(areas_visibles($roles));
}
/** Lo mismo a partir de las áreas visibles ('*' o lista); aparte para poder probarlo con cualquier combinación. */
function destino_de_areas($v): string {
    if ($v === '*') return '/';
    $v = array_values(array_diff($v, AREAS_SIN_ENTRADA));
    if (count($v) === 1 && isset(AREA_URL[$v[0]])) return AREA_URL[$v[0]];
    foreach (MARCAS as $marca => $areas) if ($v && !array_diff($v, $areas)) return '/?marca=' . $marca;
    return '/';
}

/** Texto de un permiso de Procesos: minúsculas, sin tildes, espacios como guiones («After School» → after-school). */
function procesos_clave(string $s): string {
    $s = mb_strtolower(trim($s));
    $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}

/* 5-nov (ajuste 4): unidades de Procesos que 'procesos.ver:*' NO abre. Cada una pide su permiso
   propio ('procesos.ver:<unidad>' o '<unidad>:<proceso>'). «General» son los documentos de Gerencia
   (las unidades de procesos_general de portal_config.php): solo Dirección y Administrador, por '*'.
   Para abrir una a otro rol, se le agrega 'procesos.ver:general' en ROLES. */
const PROCESOS_RESERVADAS = ['general'];

/** ¿Recibe este rol un documento de Procesos de esa unidad y ese proceso? */
function procesos_permite(array $roles, string $unidad, string $proceso): bool {
    $u = procesos_clave($unidad); $p = procesos_clave($proceso);
    if (roles_permiten($roles, 'procesos.ver:' . $u) || roles_permiten($roles, 'procesos.ver:' . $u . ':' . $p)) return true;
    return !in_array($u, PROCESOS_RESERVADAS, true) && roles_permiten($roles, 'procesos.ver:*');
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
    if (in_array($carpeta, CARPETAS_LIBRES, true)) return null;   // basta la sesión
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
