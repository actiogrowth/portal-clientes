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
 *                        Soporte Actio (clave interna 'administrador'), y asignar ese rol
 *   usuarios.nombres     13-nov (roles-gerencia): editar el nombre y el apellido de las
 *                        cuentas que gestiona (Soporte Actio, por '*', y Coordinación
 *                        Operativa). Dirección no lo tiene (como hasta ahora).
 *   area:usuarios        13-nov: abrir SOLO la parte «Usuarios» de Configuración (la carpeta
 *                        configuracion/ se abre con area:configuracion o con area:usuarios;
 *                        ver CARPETAS_AREA). Una parte nueva de Configuración tiene que pedir
 *                        area:configuracion en la página y en su puente.
 *   'gestiona' (en el rol, no es un permiso): 13-nov, la lista CERRADA de roles cuyas
 *                        cuentas ve y toca ese rol en Usuarios, y que puede asignar. Sin
 *                        'gestiona', el rol ve todas (con la regla de usuarios.admin). Una
 *                        cuenta con algún rol fuera de la lista no le aparece ni la toca.
 *   pa.internos          Proyecto Actio: ver lo que es solo de Actio (los
 *                        proyectos que no son del cliente, p. ej. Proyecto 2)
 *   equipo.todo          Procesos › Equipo (26-oct): ver todos los puestos y fichas en
 *                        cualquier estado (Dirección y Soporte Actio, por '*'; 13-nov: también
 *                        Coordinación Operativa).
 *   equipo.ficha:<ID>    preparado: ver la ficha de ese puesto aunque no lo ocupe ni
 *                        sea su jefe (hoy no lo tiene ningún rol).
 *   mensajes.enviar      Mensajes a familias: enviar el correo (el servidor lo manda
 *                        desde el buzón del hosting), «Enviarme una prueba» y ver o
 *                        copiar los correos (5-nov: solo Dirección y Soporte Actio,
 *                        por '*'; 13-nov: también Coordinación Operativa). Con area:mensajes, sin este permiso, se abre la
 *                        pantalla, se arma el grupo y se ven las cifras y la vista
 *                        previa, pero el servidor no da los correos ni envía (Comercial).
 *   mensajes.plantillas  crear y editar las plantillas de mensajes (Dirección y
 *                        Soporte Actio, por '*'; 13-nov: también Coordinación Operativa).
 *   procesos.ver:<…>     Procesos (23-oct): qué documentos recibe. '*' todos;
 *                        '<unidad>' toda la unidad; '<unidad>:<proceso>' uno
 *                        solo (ver procesos_permite). Hasta el 13-nov todos los
 *                        roles tenían 'procesos.ver:*'; desde el 13-nov
 *                        (roles-gerencia) Procesos lo abren solo Dirección y
 *                        Soporte Actio (por '*'). 5-nov (ajuste 4): '*' NO
 *                        cubre las unidades de PROCESOS_RESERVADAS («General»,
 *                        los documentos de Gerencia): esas piden su permiso
 *                        propio, 'procesos.ver:general', que hoy solo tienen
 *                        Dirección y Administrador (por '*'). Vale también
 *                        para los archivos de /biblioteca/ (gate.php).
 *   bd.editar            Base de Datos VEA (4-nov, D-123): guardar y eliminar
 *                        por basededatos/api.php. Leer basta con
 *                        area:basededatos. 13-nov (roles-gerencia): ya no lo
 *                        tiene ningún rol y la carpeta basededatos/ está en
 *                        CARPETAS_CERRADAS (página quitada para todos). Antes lo
 *                        tenían todos los roles que abrían la Base de Datos (todos
 *                        editaban); quitarlo de un rol lo deja en solo lectura
 *                        del lado del servidor.
 * '*' concede todo; 'excepto' lo recorta para ese rol.
 * 'inactividad_max' (segundos): la sesión se cierra tras ese tiempo sin uso
 * (con varios roles manda el más corto).
 *
 * Las carpetas de la raíz del portal que no están en CARPETAS_AREA solo las
 * abre quien tenga area:* (Soporte Actio y Dirección): una carpeta nueva no
 * queda abierta por descuido.
 */

const ROLES = [
    /* 13-nov (roles-gerencia): se MUESTRA como «Soporte Actio» y es solo para Actio. La clave
       interna sigue siendo 'administrador': así la tienen guardada las cuentas de
       portal_usuarios.json y 'roles_iniciales' de portal_config.php, y no hay que tocarlas. */
    'administrador' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Soporte Actio',
        'descripcion' => 'Solo para Actio. Todo, incluida la gestión de todas las cuentas.',
        'permisos' => ['*'],
    ],
    'direccion' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Dirección',
        'descripcion' => 'Todo el negocio, Gerencia y la gestión de usuarios, salvo las cuentas de Soporte Actio.',
        'permisos' => ['*'],
        'excepto' => ['usuarios.admin', 'pa.internos', 'usuarios.nombres'],
    ],
    /* 13-nov (roles-gerencia): la coordinadora operativa, que también lleva los sistemas. Todas
       las unidades y Equipo completo; Mensajes completo; las cuentas del equipo SALVO las de
       Dirección, Soporte Actio y Coordinación Operativa ('gestiona'). Sin Resumen del negocio,
       Procesos, Proyecto Actio ni el resto de Configuración (solo area:usuarios). */
    'coordinacion_operativa' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Coordinación Operativa',
        'descripcion' => 'Todas las unidades (After School completo con Pasar lista y pagos, Preschool, Veranito), Equipo completo, Mensajes (armar, enviar y plantillas) y las cuentas del equipo, salvo las de Dirección, Soporte Actio y Coordinación Operativa.',
        'permisos' => ['area:afterschool', 'area:pasarlista', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.lista.ver', 'as.lista.marcar', 'as.lista.corregir', 'as.seguimiento',
                       'area:kinder', 'area:veranito', 'area:cumpleanos', 'area:babyandme',
                       'area:equipo', 'equipo.todo',
                       'area:mensajes', 'mensajes.enviar', 'mensajes.plantillas',
                       'area:usuarios', 'usuarios.gestionar', 'usuarios.nombres'],
        'gestiona' => ['coordinacion_afterschool', 'recepcion', 'comercial', 'contabilidad', 'coordinacion_preescolar', 'profesor'],
    ],
    'coordinacion_afterschool' => [
        'inicio_as' => 'ocupacion',
        'nombre' => 'Coordinación After School',
        'descripcion' => 'After School completo, Pasar lista (también otros días), seguimiento de asistencia y Equipo.',
        // 13-nov (roles-gerencia): sin Base de datos ni Procesos.
        'permisos' => ['area:afterschool', 'area:pasarlista', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.lista.ver', 'as.lista.marcar', 'as.lista.corregir', 'as.seguimiento', 'area:equipo'],
    ],
    'recepcion' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Recepción',
        'descripcion' => 'After School completo: inscribir, visitas del día, pagos, bajas, Por revisar y seguimiento. No pasa lista. Y Equipo.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.completo', 'as.pruebas.ver', 'as.pruebas.agendar',
                       'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',
                       'as.seguimiento', 'area:equipo'],   // 13-nov: sin Procesos
    ],
    'comercial' => [
        'inicio_as' => 'pruebas',
        'nombre' => 'Comercial',
        'descripcion' => 'After School: Ocupación y Pruebas (ver y agendar). Tablero de Preschool, Equipo y Mensajes a familias (armar y revisar, sin enviar).',
        'permisos' => ['area:afterschool', 'area:kinder', 'as.ver', 'as.pruebas.ver',
                       'as.pruebas.agendar', 'as.contactos.prospectos', 'area:equipo',   // 13-nov: sin Base de datos ni Procesos
                       // 3-nov: Mensajes a familias. 5-nov: arma el grupo y ve la vista previa, pero
                       // NO envía ni ve los correos (sin mensajes.enviar; envían Dirección, Soporte Actio
                       // y, desde el 13-nov, Coordinación Operativa).
                       'area:mensajes'],
    ],
    'contabilidad' => [
        'inicio_as' => 'pagos',
        'nombre' => 'Contabilidad',
        'descripcion' => 'After School: Pagos (ver y registrar), pago de las pruebas y Ocupación en lectura. Sin datos de contacto. Y Equipo.',
        'permisos' => ['area:afterschool', 'as.ver', 'as.pagos.ver', 'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'area:equipo'],   // 13-nov: sin Procesos
    ],
    'coordinacion_preescolar' => [
        'nombre' => 'Coordinación Preschool',
        'descripcion' => 'Tablero de Preschool y Equipo.',
        'permisos' => ['area:kinder', 'area:equipo'],   // 13-nov: sin Base de datos ni Procesos
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
        // 13-nov (roles-gerencia): ya no Procesos; sí Equipo.
        'permisos' => ['area:afterschool', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:equipo'],
        'inactividad_max' => 7200,
    ],
];

/* Carpeta de la raíz del portal → área que hace falta para abrirla (o lista de áreas: basta una). */
const CARPETAS_AREA = [
    'kinder'        => 'kinder',
    'veranito'      => 'veranito',
    'after-school'  => 'afterschool',
    'baby-and-me'   => 'babyandme',
    'cumpleanos'    => 'cumpleanos',
    'configuracion' => ['configuracion', 'usuarios'],   // 13-nov: con area:usuarios se abre SOLO «Usuarios» (Coordinación Operativa)
    'pasar-lista'   => 'pasarlista',
    'proyecto-actio' => 'proyecto-actio',   // 22-oct: solo Soporte Actio y Dirección (nadie más la tiene)
    'procesos'      => 'procesos',          // 23-oct: todos los roles. 13-nov: solo Soporte Actio y Dirección (nadie más la tiene)
    'equipo'        => 'equipo',            // 26-oct: Mi lista, Revisar y el puente de Equipo; todos los roles. 13-nov: también el organigrama (/equipo/organigrama/)
    'resumen'       => 'resumen',           // 26-oct: Resumen (26-oct: del negocio); solo Soporte Actio y Dirección (nadie más la tiene)
    'mensajes'      => 'mensajes',          // 3-nov: Mensajes a familias; Soporte Actio, Dirección, Comercial y (13-nov) Coordinación Operativa
    'pendientes'    => 'equipo',            // 26-oct: el puente de «Pendientes de hoy» de la portada; todos los roles (cada uno recibe lo suyo)
];

/* 23-oct: carpetas que abre CUALQUIER usuario con sesión, sin área: la
   biblioteca de presentaciones (la usan Procesos y Proyecto Actio). */
const CARPETAS_LIBRES = ['biblioteca'];

/* 13-nov (roles-gerencia): carpetas que no abre NADIE, ni con '*'. La página «Base de datos» se
   quitó para todos los roles: la página y su puente basededatos/api.php responden «sin permiso».
   El Sheet VEA_BaseDatos_Clientes sigue: Mensajes lee de ahí los correos por su propio camino
   (mensajes/api.php con la clave de mensajes), sin pasar por esta carpeta. */
const CARPETAS_CERRADAS = ['basededatos'];

/* Áreas que la portada conoce (tarjetas). 22-oct: 'proyecto-actio' reemplaza a
   'actio' (la tarjeta Sistema Operativo, que llevaba a GitHub Pages). */
/* 21-oct (rediseño): 'pasarlista' ya no es tarjeta (Pasar lista está dentro de After School). */
/* 13-nov: sin 'basededatos' (página quitada); 'usuarios' = solo la parte Usuarios de Configuración. */
const AREAS = ['kinder', 'veranito', 'afterschool', 'babyandme', 'cumpleanos', 'proyecto-actio', 'configuracion', 'usuarios', 'procesos', 'equipo', 'resumen', 'mensajes'];

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
    'configuracion' => '/configuracion/', 'usuarios' => '/configuracion/', 'proyecto-actio' => '/proyecto-actio/',
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
   (las unidades de procesos_general de portal_config.php): solo Dirección y Soporte Actio, por '*'.
   13-nov: además, Procesos entero (area:procesos) ya solo lo tienen Dirección y Soporte Actio.
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

/** Área (o lista de áreas: basta una) que pide una ruta relativa a la raíz del portal
    (null = sin área: la portada y sus archivos; false = carpeta cerrada para todos). */
function area_de_ruta(string $ruta) {
    $ruta = ltrim(str_replace('\\', '/', $ruta), '/');
    $p = strpos($ruta, '/');
    if ($p === false) return null;               // archivo de la raíz
    $carpeta = substr($ruta, 0, $p);
    if (in_array($carpeta, CARPETAS_CERRADAS, true)) return false;   // 13-nov: nadie, ni con '*'
    if (in_array($carpeta, CARPETAS_LIBRES, true)) return null;   // basta la sesión
    return CARPETAS_AREA[$carpeta] ?? '*';       // carpeta sin asignar: solo area:*
}

/** ¿Pueden estos roles abrir esa ruta? */
function roles_abren_ruta(array $roles, string $ruta): bool {
    $area = area_de_ruta($ruta);
    if ($area === null) return true;
    if ($area === false) return false;
    foreach ((array) $area as $a) if (roles_permiten($roles, 'area:' . $a)) return true;
    return false;
}

/** 13-nov (roles-gerencia): roles cuyas cuentas ven y tocan estos roles en Usuarios, y que pueden
    asignar. null = sin recorte (queda solo la regla de usuarios.admin para Soporte Actio). Con
    varios roles se suman; basta uno con gestión y sin 'gestiona' para no tener recorte. */
function roles_gestionables(array $roles): ?array {
    $lista = [];
    foreach ($roles as $r) {
        $def = ROLES[$r] ?? null;
        if (!$def || !roles_permiten([$r], 'usuarios.gestionar')) continue;
        if (!array_key_exists('gestiona', $def)) return null;
        $lista = array_merge($lista, $def['gestiona']);
    }
    return array_values(array_unique($lista));
}

/** ¿Está esa cuenta (con esos roles) al alcance de quien tiene estos roles? Una cuenta con algún
    rol fuera de su lista no le aparece en Usuarios ni la puede tocar. */
function cuenta_al_alcance(array $rolesActor, array $rolesCuenta): bool {
    $g = roles_gestionables($rolesActor);
    return $g === null || ($rolesCuenta && !array_diff($rolesCuenta, $g));
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
