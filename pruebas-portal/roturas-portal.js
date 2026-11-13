/* Rompe a propósito cada defensa de roles y usuarios y comprueba que
 * prueba-portal.js lo detecta.
 *
 *   PHP=php node pruebas-portal/roturas-portal.js
 *
 * Cada rotura se aplica sobre una copia de portal-raiz/, after-school/,
 * configuracion/, pasar-lista/, comun/, proyecto-actio/, procesos/,
 * biblioteca/, equipo/, resumen/, pendientes/ y kinder/ en una carpeta temporal; el repo no se toca.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { correr } = require('./prueba-portal');

const REPO = path.join(__dirname, '..');
const CARPETAS = ['portal-raiz', 'after-school', 'configuracion', 'pasar-lista', 'comun', 'proyecto-actio', 'procesos', 'biblioteca', 'equipo', 'resumen', 'pendientes', 'kinder', 'mensajes', 'basededatos'];

// [nombre, archivo, texto de hoy, texto roto]
const ROTURAS = [
  // 13-nov (roles-gerencia): Soporte Actio, Coordinación Operativa, Gerencia solo para Dirección y Soporte Actio, sin Base de datos
  ['la Base de datos vuelve a abrirse (sin carpetas cerradas)', 'portal-raiz/permisos.php', "const CARPETAS_CERRADAS = ['basededatos'];", "const CARPETAS_CERRADAS = [];"],
  ['roles_abren_ruta no mira las carpetas cerradas', 'portal-raiz/permisos.php', "    if ($area === false) return false;\n", ""],
  ['area_de_ruta no mira las carpetas cerradas', 'portal-raiz/permisos.php', "    if (in_array($carpeta, CARPETAS_CERRADAS, true)) return false;   // 13-nov: nadie, ni con '*'\n", ""],
  ['Recepción vuelve a abrir Procesos', 'portal-raiz/permisos.php', "                       'as.seguimiento', 'area:equipo'],   // 13-nov: sin Procesos", "                       'as.seguimiento', 'area:procesos', 'procesos.ver:*', 'area:equipo'],"],
  ['Coordinación Preschool vuelve a abrir Procesos', 'portal-raiz/permisos.php', "        'permisos' => ['area:kinder', 'area:equipo'],", "        'permisos' => ['area:kinder', 'area:procesos', 'procesos.ver:*', 'area:equipo'],"],
  ['biblioteca: la lista de Procesos no mira ni el área ni el rol', 'procesos/api.php', "    if (roles_permiten($roles, 'area:procesos'))\n        $listas[] = procesos_respuesta(pa_recortar($cat['cuerpo'], false, $c['pa_proyectos_cliente'], $cat['edad']),\n            $c['procesos_segmentos'], $c['procesos_general'], $roles);", "    $listas[] = procesos_respuesta(pa_recortar($cat['cuerpo'], false, $c['pa_proyectos_cliente'], $cat['edad']),\n            $c['procesos_segmentos'], $c['procesos_general'], ['direccion']);"],
  ['Coordinación Operativa sin lista «gestiona» (ve y toca todas las cuentas)', 'portal-raiz/permisos.php', "        'gestiona' => ['coordinacion_afterschool', 'recepcion', 'comercial', 'contabilidad', 'coordinacion_preescolar', 'profesor'],\n", ""],
  ['Coordinación Operativa gestiona también Dirección', 'portal-raiz/permisos.php', "        'gestiona' => ['coordinacion_afterschool',", "        'gestiona' => ['direccion', 'coordinacion_afterschool',"],
  ['Coordinación Operativa gestiona también otras Coordinaciones Operativas', 'portal-raiz/permisos.php', "        'gestiona' => ['coordinacion_afterschool',", "        'gestiona' => ['coordinacion_operativa', 'coordinacion_afterschool',"],
  ['roles_gestionables no recorta a nadie', 'portal-raiz/permisos.php', "        if (!array_key_exists('gestiona', $def)) return null;", "        return null;"],
  ['cuenta_al_alcance deja pasar todo', 'portal-raiz/permisos.php', "    return $g === null || ($rolesCuenta && !array_diff($rolesCuenta, $g));", "    return true;"],
  ['Usuarios: listar no recorta las cuentas', 'configuracion/api.php', "        if (!cuenta_al_alcance($rolesYo, $c['roles'] ?? [])) continue;\n", ""],
  ['Usuarios: listar ofrece todos los roles', 'configuracion/api.php', "foreach (ROLES as $id => $def) if ($g === null || in_array($id, $g, true))", "foreach (ROLES as $id => $def) if (true)"],
  ['Usuarios: tocar una cuenta fuera de su alcance', 'portal-raiz/cuentas.php', "    if ($obj && !cuenta_al_alcance($rolesActor, $obj['roles'] ?? []))\n        throw new ErrorCuentas('No existe el usuario «' . $objetivo . '».', 404);\n", ""],
  ['Usuarios: asignar roles fuera de su lista', 'portal-raiz/cuentas.php', "    if ($rolesNuevos !== null && ($g = roles_gestionables($rolesActor)) !== null && array_diff($rolesNuevos, $g))\n        throw new ErrorCuentas('Tu rol no puede asignar Dirección, Soporte Actio ni Coordinación Operativa.', 403);\n", ""],
  ['Usuarios: el nombre se cambia en cualquier cuenta', 'configuracion/api.php', "                exigir_puede_tocar($d, $yo, 'nombre', $usuario);   // 13-nov: solo en las cuentas que gestiona\n", ""],
  ['Usuarios: crear con un usuario oculto dice que existe', 'configuracion/api.php', "                if ($existe && !cuenta_al_alcance($d['usuarios'][$yo]['roles'] ?? [], $d['usuarios'][$usuario]['roles'] ?? []))\n                    throw new ErrorCuentas('Ese usuario ya está en uso: elige otro.');\n", ""],
  ['Coordinación Operativa abre toda Configuración', 'portal-raiz/permisos.php', "                       'area:usuarios', 'usuarios.gestionar', 'usuarios.nombres'],", "                       'area:configuracion', 'area:usuarios', 'usuarios.gestionar', 'usuarios.nombres'],"],
  ['Coordinación Operativa sin usuarios.nombres', 'portal-raiz/permisos.php', "                       'area:usuarios', 'usuarios.gestionar', 'usuarios.nombres'],", "                       'area:usuarios', 'usuarios.gestionar'],"],
  ['Coordinación Operativa sin Usuarios', 'portal-raiz/permisos.php', "                       'area:usuarios', 'usuarios.gestionar', 'usuarios.nombres'],", "                       'usuarios.gestionar', 'usuarios.nombres'],"],
  ['Coordinación Operativa abre Procesos', 'portal-raiz/permisos.php', "                       'area:equipo', 'equipo.todo',", "                       'area:equipo', 'equipo.todo', 'area:procesos', 'procesos.ver:*',"],
  ['Coordinación Operativa abre el Resumen del negocio', 'portal-raiz/permisos.php', "                       'area:equipo', 'equipo.todo',", "                       'area:equipo', 'equipo.todo', 'area:resumen',"],
  ['Coordinación Operativa abre Proyecto Actio', 'portal-raiz/permisos.php', "                       'area:equipo', 'equipo.todo',", "                       'area:equipo', 'equipo.todo', 'area:proyecto-actio',"],
  ['Coordinación Operativa no envía mensajes', 'portal-raiz/permisos.php', "                       'area:mensajes', 'mensajes.enviar', 'mensajes.plantillas',", "                       'area:mensajes', 'mensajes.plantillas',"],
  ['Coordinación Operativa no edita plantillas', 'portal-raiz/permisos.php', "                       'area:mensajes', 'mensajes.enviar', 'mensajes.plantillas',", "                       'area:mensajes', 'mensajes.enviar',"],
  ['Coordinación Operativa sin Veranito', 'portal-raiz/permisos.php', "                       'area:kinder', 'area:veranito', 'area:cumpleanos', 'area:babyandme',", "                       'area:kinder', 'area:cumpleanos', 'area:babyandme',"],
  ['Coordinación Operativa sin equipo.todo', 'portal-raiz/permisos.php', "                       'area:equipo', 'equipo.todo',", "                       'area:equipo',"],
  ['Coordinación Operativa no corrige la lista', 'portal-raiz/permisos.php', "                       'as.lista.ver', 'as.lista.marcar', 'as.lista.corregir', 'as.seguimiento',\n                       'area:kinder'", "                       'as.lista.ver', 'as.lista.marcar', 'as.seguimiento',\n                       'area:kinder'"],
  ['la carpeta de Configuración solo pide area:configuracion', 'portal-raiz/permisos.php', "    'configuracion' => ['configuracion', 'usuarios'],", "    'configuracion' => 'configuracion',"],
  ['roles_abren_ruta solo mira la primera área de la lista', 'portal-raiz/permisos.php', "    foreach ((array) $area as $a) if (roles_permiten($roles, 'area:' . $a)) return true;\n    return false;", "    return roles_permiten($roles, 'area:' . ((array) $area)[0]);"],
  ['Dirección edita nombres', 'portal-raiz/permisos.php', "'excepto' => ['usuarios.admin', 'pa.internos', 'usuarios.nombres'],", "'excepto' => ['usuarios.admin', 'pa.internos'],"],
  ['Soporte Actio vuelve a llamarse Administrador', 'portal-raiz/permisos.php', "        'nombre' => 'Soporte Actio',", "        'nombre' => 'Administrador',"],
  ['Procesos ya no lleva las direcciones viejas de Equipo a su dirección', 'procesos/index.html', "if (/^#(equipo|reglas|horarios|puesto=)/.test(location.hash)) location.replace('/equipo/organigrama/' + location.hash);", ""],
  ['Mi lista vuelve a enlazar la ficha en Procesos', 'equipo/index.html', "const fichaUrl = id => '/equipo/organigrama/#puesto=' + encodeURIComponent(id);", "const fichaUrl = id => '/procesos/#puesto=' + encodeURIComponent(id);"],
  ['el aviso de contratos vuelve a llevar a Procesos', 'pendientes/api.php', "'url' => '/equipo/organigrama/'", "'url' => '/procesos/#equipo'"],
  ['la Base de datos vuelve a la barra lateral', 'comun/marca.js', "      { id: 'proyecto-actio', texto: 'Proyecto Actio'", "      { id: 'basededatos', texto: 'Base de datos', url: '/basededatos/', icono: 'datos', areas: ['basededatos'] },\n      { id: 'proyecto-actio', texto: 'Proyecto Actio'"],
  // 5-nov: Mensajes, envío por el servidor
  ['Mensajes: Comercial puede enviar', 'portal-raiz/permisos.php', "                       'area:mensajes'],", "                       'area:mensajes', 'mensajes.enviar'],"],
  ['Mensajes: envía sin mensajes.enviar', 'mensajes/api.php', "if (in_array($accion, MS_ENVIAN, true) && !$puedeEnviar) fallo(", "if (false) fallo("],
  ['Mensajes: envía sin el sello CSRF', 'mensajes/api.php', "if (in_array($accion, ['enviar', 'prueba'], true) && !csrf_valido($_SERVER['HTTP_X_CSRF'] ?? '')) fallo(", "if (false) fallo("],
  ['Mensajes: los correos le llegan a quien no envía', 'mensajes/api.php', "if (!$puedeEnviar) unset($f['correo']); return $f;", "return $f;"],
  ['Mensajes: el registro usa el usuario del navegador', 'mensajes/api.php', "    $reg = ['idEnvio' => $id, 'usuario' => $usuario, 'rol' => $rol,", "    $reg = ['idEnvio' => $id, 'usuario' => (string) ($d['usuario'] ?? $usuario), 'rol' => (string) ($d['rol'] ?? $rol),"],
  ['Mensajes: la prueba va a cualquier dirección', 'mensajes/api.php', "    $para = ms_destino_prueba($L['config'], $usuario, $smtp['usuario']);", "    $para = (string) ($d['para'] ?? 'otra@ejemplo.test');"],
  ['Mensajes: lo enviado se guarda en la carpeta pública', 'mensajes/correo.php', "dirname(__DIR__, 2) . '/portal_mensajes'", "dirname(__DIR__) . '/portal_mensajes'"],
  // 4-nov (D-123): el puente de la Base de Datos
  ['Base de Datos: no pide sesión ni rol', 'basededatos/api.php', "\nrequerir_sesion();\n", "\n"],
  // 5-nov (ajuste 4): «General» (Gerencia) solo para Dirección y Administrador, también en /biblioteca/
  ['Procesos: procesos.ver:* vuelve a abrir General', 'portal-raiz/permisos.php', "const PROCESOS_RESERVADAS = ['general'];", "const PROCESOS_RESERVADAS = [];"],
  ['Procesos: General para todos (sin mirar las reservadas)', 'portal-raiz/permisos.php', "    return !in_array($u, PROCESOS_RESERVADAS, true) && roles_permiten($roles, 'procesos.ver:*');", "    return roles_permiten($roles, 'procesos.ver:*');"],
  ['Procesos: pedir General sin permiso no da 403', 'procesos/api.php', "    if ($unidadPedida !== '' && !procesos_unidad_permitida(", "    if (false && !procesos_unidad_permitida("],
  ['Procesos: pedir una unidad devuelve todas', 'procesos/api.php', "        if ($soloUnidad !== '' && procesos_clave($unidad) !== procesos_clave($soloUnidad)) continue;\n", ""],
  ['biblioteca: vuelve a abrirse con la sola sesión', 'portal-raiz/gate.php', "    if (!procesos_biblioteca_permite($rolesBib, $nombreBib)) negar(", "    if (false) negar("],
  ['biblioteca: abre lo que no está en ninguna lista', 'procesos/api.php', "        if ($hay) return true;\n    }\n    return false;", "        if ($hay) return true;\n    }\n    return true;"],
  ['biblioteca: Proyecto Actio abre sus archivos a cualquiera', 'procesos/api.php', "    if (roles_permiten($roles, 'area:proyecto-actio'))\n", "    if (true)\n"],
  // 23-oct: Procesos, biblioteca y portada por marca
  ['Procesos manda lo que no es para el cliente (recorte de Administrador)', 'procesos/api.php', "pa_recortar($l['cuerpo'], false,", "pa_recortar($l['cuerpo'], roles_permiten(roles_actuales(), 'pa.internos'),"],
  ['Procesos manda lo interno a todos', 'procesos/api.php', "pa_recortar($l['cuerpo'], false,", "pa_recortar($l['cuerpo'], true,"],
  ['Procesos manda documentos de otros segmentos (Finanzas, vacío)', 'procesos/api.php', "        if ($proceso === null) continue;", ""],
  ['Procesos sin lista blanca de campos', 'procesos/api.php', "$docs[] = array_intersect_key($fila, array_flip(PROCESOS_CAMPOS));", "$docs[] = $d;"],
  ['Procesos no junta Gerencia en General', 'procesos/api.php', "        if (in_array(pa_norm(strtr($unidad, PROCESOS_TILDES)), $esGeneral, true)) $unidad = 'General';\n", ""],
  ['Procesos funciona sin su configuración (valores en el código)', 'procesos/api.php', "$cfg = pa_config(['procesos_segmentos', 'procesos_general']);", "$cfg = pa_config([]) + ['procesos_segmentos' => ['Atracción' => ['Marketing'], 'Adquisición' => ['Ventas'], 'Entrega de servicio' => ['Servicio']], 'procesos_general' => ['Gerencia']];"],
  ['el Profesor vuelve a abrir Procesos (13-nov)', 'portal-raiz/permisos.php', "'as.lista.ver', 'as.lista.marcar', 'area:equipo'],", "'as.lista.ver', 'as.lista.marcar', 'area:procesos', 'procesos.ver:*', 'area:equipo'],"],
  ['la biblioteca pide un área (solo Administrador y Dirección)', 'portal-raiz/permisos.php', "    if (in_array($carpeta, CARPETAS_LIBRES, true)) return null;   // basta la sesión\n", ""],
  ['las presentaciones de la biblioteca se abren sin sesión', 'portal-raiz/gate.php', "if (in_array($directa, ['login.html', 'cambiar-clave.html'], true) || preg_match(", "if (str_starts_with($directa, 'biblioteca/') || in_array($directa, ['login.html', 'cambiar-clave.html'], true) || preg_match("],
  ['un api.php subido a la biblioteca se ejecuta', 'portal-raiz/htaccess.txt', "RewriteRule ^biblioteca/.*\\.(php|php[0-9]|phtml|phar)$ - [F,L]\n", ""],
  ['los enlaces viejos de /proyecto-actio/archivos/ ya no llevan a la biblioteca', 'portal-raiz/gate.php', "    header('Location: /biblioteca/' . $m[1], true, 301);", "    header('Location: /', true, 301);"],
  ['Procesos cuenta para la entrada directa (el Profesor iría a la portada)', 'portal-raiz/permisos.php', "    $v = array_values(array_diff($v, AREAS_SIN_ENTRADA));\n", ""],
  ['solo unidades de una marca no lleva a la página de la marca', 'portal-raiz/permisos.php', "    foreach (MARCAS as $marca => $areas) if ($v && !array_diff($v, $areas)) return '/?marca=' . $marca;\n", ""],
  ['Veranito queda en la marca Kids', 'portal-raiz/permisos.php', "    'vea'  => ['afterschool', 'veranito', 'cumpleanos'],\n    'kids' => ['kinder', 'babyandme'],", "    'vea'  => ['afterschool', 'cumpleanos'],\n    'kids' => ['kinder', 'babyandme', 'veranito'],"],
  // 22-oct: Proyecto Actio
  ['Dirección recibe filas «No»', 'proyecto-actio/api.php', "$alCliente = $v === 'si' ? true : ($v === 'no' ? false : !$soloActio);", "$alCliente = $v === 'si' ? true : !$soloActio;"],
  ['no se respeta «Sí» (solo la regla por proyecto)', 'proyecto-actio/api.php', "$alCliente = $v === 'si' ? true : ($v === 'no' ? false : !$soloActio);", "$alCliente = $v === 'no' ? false : !$soloActio;"],
  ['un documento no hereda la visibilidad de su entregable', 'proyecto-actio/api.php', "if ($v === '' && $tabla === 'documentos') $v = $visEntregable[(string) ($f['idEntregable'] ?? '')] ?? '';", ""],
  ['a Dirección le llega soloActio', 'proyecto-actio/api.php', "$fila['soloActio'] = $internos && $soloActio;", "$fila['soloActio'] = $soloActio;"],
  ['las presentaciones se abren sin sandbox', 'comun/visor-pantalla.js', " sandbox=\"allow-scripts allow-popups allow-popups-to-escape-sandbox\"", ""],
  ['las presentaciones con allow-same-origin (verían la sesión)', 'comun/visor-pantalla.js', "allow-scripts allow-popups allow-popups-to-escape-sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"],
  ['Dirección recibe Proyecto 2 (sin recorte en el servidor)', 'proyecto-actio/api.php', "if (!$alCliente && !$internos) continue;", ""],
  ['Dirección tiene pa.internos', 'portal-raiz/permisos.php', "'excepto' => ['usuarios.admin', 'pa.internos', 'usuarios.nombres'],", "'excepto' => ['usuarios.admin', 'usuarios.nombres'],"],
  ['Proyecto Actio sin lista blanca (salen las Notas)', 'proyecto-actio/api.php', "foreach ($campos as $c) $fila[$c] = $f[$c] ?? '';", "$fila = $f;"],
  ['cualquier rol de After School abre Proyecto Actio', 'portal-raiz/permisos.php', "'proyecto-actio' => 'proyecto-actio',", "'proyecto-actio' => 'afterschool',"],
  ['Proyecto Actio acepta otras acciones', 'proyecto-actio/api.php', "($datos['accion'] ?? '') !== 'leer'", "false"],
  ['Proyecto Actio sin copia en el servidor', 'proyecto-actio/api.php', "if ($copia && $edad < $ttl) {", "if (false) {"],
  ['la copia de Proyecto Actio vive en la carpeta pública', 'proyecto-actio/api.php', "$archivo = dirname(__DIR__, 2) . '/portal_cache/proyecto-actio.json';", "$archivo = dirname(__DIR__) . '/portal_cache/proyecto-actio.json';"],
  ['se usa una copia de más de un día', 'proyecto-actio/api.php', "if ($copia && $edad < PA_COPIA_MAX_SEG) {", "if ($copia) {"],
  ['un documento sin proyecto no toma el de su entregable (Proyecto 2 se le escapa a Dirección)', 'proyecto-actio/api.php', "if ($p === '' && $tabla === 'documentos') $p = $proyEntregable[(string) ($f['idEntregable'] ?? '')] ?? '';", ""],
  // permisos.php
  ['Dirección puede tocar cuentas de Soporte Actio (sin «excepto»)', 'portal-raiz/permisos.php', "'excepto' => ['usuarios.admin', 'pa.internos', 'usuarios.nombres'],", "'excepto' => ['pa.internos', 'usuarios.nombres'],"],
  ['las carpetas sin asignar quedan abiertas', 'portal-raiz/permisos.php', "    return CARPETAS_AREA[$carpeta] ?? '*';", "    return CARPETAS_AREA[$carpeta] ?? null;"],
  ['Comercial con After School completo', 'portal-raiz/permisos.php', "        'permisos' => ['area:afterschool', 'area:kinder', 'as.ver', 'as.pruebas.ver',", "        'permisos' => ['area:afterschool', 'area:kinder', 'as.ver', 'as.pruebas.ver', 'as.completo',"],
  ['Contabilidad recibe contactos', 'portal-raiz/permisos.php', "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'area:equipo'],", "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'as.contactos.todos', 'area:equipo'],"],
  ['una acción sin permiso propio solo pide as.ver', 'portal-raiz/permisos.php', "    return PERMISO_ACCION_AS[$accion] ?? 'as.completo';", "    return PERMISO_ACCION_AS[$accion] ?? 'as.ver';"],
  ['Comercial ve contactos de cualquier niño', 'portal-raiz/permisos.php', "if ($esNino && !($politica === 'prospectos' && ($valor->estado ?? '') === 'Prospecto')) {", "if ($esNino && $politica !== 'prospectos') {"],
  // auth.php
  ['requerir_sesion no mira el área', 'portal-raiz/auth.php', "    if (!roles_abren_ruta($c['roles'] ?? [], $ruta)) {", "    if (false) {"],
  ['la sesión no se corta al cambiar o reiniciar la contraseña', 'portal-raiz/auth.php', "    if ((int) ($_SESSION['ver_clave'] ?? 0) !== (int) ($c['ver_clave'] ?? 0)) return null;\n", ''],
  ['la sesión de una cuenta desactivada sigue', 'portal-raiz/auth.php', "    if (!$c || empty($c['activo'])) return null;", "    if (!$c) return null;"],
  ['la contraseña temporal no obliga a cambiarla', 'portal-raiz/auth.php', "    if (!empty($c['cambiar_clave'])) {", "    if (false) {"],
  // gate.php
  ['gate.php no corre directo las páginas de la raíz (bucle con el .htaccess anterior, 20-oct)', 'portal-raiz/gate.php', "if (in_array($directa, ['login.php', 'logout.php', 'cambiar-clave.php', 'acceso.php'], true)) {", "if (false) {"],
  ['gate.php entrega sin mirar el área', 'portal-raiz/gate.php', "requerir_sesion($rel);\n", ''],
  // acceso.php
  ['la portada muestra todas las tarjetas a todos', 'portal-raiz/acceso.php', "json_encode(areas_visibles($roles))", "json_encode('*')"],
  // login.php
  ['una cuenta desactivada entra', 'portal-raiz/login.php', "if ($c && !empty($c['activo']) && password_verify(", "if ($c && password_verify("],
  ['el login no exige CSRF', 'portal-raiz/login.php', "if (!csrf_valido($e['csrf'] ?? null)) responder_login(", "if (false) responder_login("],
  ['el login no manda a cambiar la temporal', 'portal-raiz/login.php', "return !empty($c['cambiar_clave']) ? '/cambiar-clave.html?r=' . urlencode($d) : $d;", "return $d;"],
  ['el login no bloquea tras 5 fallos', 'portal-raiz/login.php', "if ($min = bloqueado()) responder_login(", "if (false) responder_login("],
  ['el login no anota los fallos', 'portal-raiz/login.php', "registrar_fallo();\nusleep(800000);", "usleep(800000);"],
  ['el login sigue un destino de otro sitio', 'portal-raiz/login.php', "    $d = destino_seguro($pedido);\n", "    $d = $pedido !== '' ? $pedido : '/';\n"],
  ['el login no exige roles_iniciales completos (migra a medias)', 'portal-raiz/cuentas.php', "    if ($faltan) { $GLOBALS['cuentas_error']", "    if (false) { $GLOBALS['cuentas_error']"],
  // cambiar-clave.php
  ['cambiar la contraseña no exige CSRF', 'portal-raiz/cambiar-clave.php', "if (!csrf_valido($e['csrf'] ?? null)) $no(", "if (false) $no("],
  ['cambiar la contraseña no pide la actual', 'portal-raiz/cambiar-clave.php', "if (!password_verify($actual, $c['hash'])) {", "if (false) {"],
  ['acepta contraseñas de menos de 10', 'portal-raiz/cambiar-clave.php', "if (strlen($nueva) < CLAVE_MINIMA) $no(", "if (false) $no("],
  ['cambiar la contraseña no quita la marca de temporal', 'portal-raiz/cambiar-clave.php', "        $x['cambiar_clave'] = false;\n", ""],
  ['cambiar la contraseña funciona sin sesión', 'portal-raiz/cambiar-clave.php', "if (!sesion_activa()) responder_clave(", "if (false) responder_clave("],
  ['cambiar la contraseña no corta las otras sesiones', 'portal-raiz/cambiar-clave.php', "        $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;\n        anotar_evento($d, $usuario, 'cambiar_clave', $usuario);", "        anotar_evento($d, $usuario, 'cambiar_clave', $usuario);"],
  // cuentas.php
  ['Dirección modifica una cuenta Administrador', 'portal-raiz/cuentas.php', "    if ($obj && es_admin($obj) && !$adminActor)", "    if (false)"],
  ['Dirección asigna el rol Administrador', 'portal-raiz/cuentas.php', "    if ($rolesNuevos !== null && in_array('administrador', $rolesNuevos, true) && !$adminActor)", "    if (false)"],
  ['uno se cambia sus roles o se desactiva', 'portal-raiz/cuentas.php', "    if ($objetivo === $actor && in_array($accion, ['roles', 'desactivar'], true))", "    if (false)"],
  ['el último Administrador se puede desactivar', 'portal-raiz/cuentas.php', "        if ($accion === 'desactivar' || ($accion === 'roles' && !in_array('administrador', $rolesNuevos ?? [], true)))", "        if (false)"],
  // configuracion/api.php
  ['Configuración no exige CSRF', 'configuracion/api.php', "if (!csrf_valido($_SERVER['HTTP_X_CSRF'] ?? null))", "if (false)"],
  ['reiniciar no corta la sesión abierta', 'configuracion/api.php', "                $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;   // corta sus sesiones abiertas\n", ''],
  // after-school/api.php
  ['api.php de After School no valida la acción por rol', 'after-school/api.php', "    if ($conRoles && !roles_permiten($roles, permiso_de_accion_as($datos['accion']))) {", "    if (false) {"],
  ['api.php no recorta la respuesta', 'after-school/api.php', "    if ($conRoles && $res['http'] === 200) $res['cuerpo'] = respuesta_para_roles($res['cuerpo'], $roles);\n", ''],
  ['api.php manda los pagos a quien no ve Pagos', 'after-school/api.php', "    if (!roles_permiten($roles, 'as.pagos.ver')) {\n        foreach", "    if (false) {\n        foreach"],
  // 21-oct: Pasar lista, permisos nuevos e inactividad
  ['pasar-lista respeta el soloHoy del navegador', 'pasar-lista/api.php', "$datos['datos']['soloHoy'] = $conLimite;", "$datos['datos']['soloHoy'] = ($datos['datos']['soloHoy'] ?? false) === true;"],
  // 23-oct: la sesión se suelta antes de esperar a Google
  ['Pasar lista deja la sesión tomada mientras espera a Google', 'pasar-lista/api.php', "\nsession_write_close();\n", "\n"],
  ['After School deja la sesión tomada mientras espera a Google', 'after-school/api.php', "    session_write_close();\n", ""],
  ['Procesos deja la sesión tomada mientras espera a Google', 'procesos/api.php', "session_write_close();   // 23-oct", "//"],
  ['Proyecto Actio deja la sesión tomada mientras espera a Google', 'proyecto-actio/api.php', "    session_write_close();   // 23-oct", "    //"],
  // 23-oct (ajustes): quitar marcas, tiempos y cambio de día seguro
  ['pasar-lista no deja pasar «quitadas»', 'pasar-lista/api.php', "'nuevas', 'corregidas', 'quitadas', 'visitasMarcadas'", "'nuevas', 'corregidas', 'visitasMarcadas'"],
  ['pasar-lista no dice cuánto tardó', 'pasar-lista/api.php', "    if ($tiempos) $out['tiempos'] = $tiempos;\n", ""],
  ['la pantalla pinta la respuesta de un pedido anterior', 'after-school/index.html', "  if (n !== LISTA.pedido) return;                         // respuesta de un pedido anterior", ""],
  ['las flechas cuentan desde la última respuesta (dos toques)', 'after-school/index.html', "$('#plSig').onclick = () => irADiaLista(sumarDia(diaActual(), 1));", "$('#plSig').onclick = () => irADiaLista(sumarDia((LISTA.datos || {}).fecha || diaActual(), 1));"],
  ['tocar otra vez no quita la marca', 'after-school/index.html', "b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.e", "b.dataset.e"],
  ['al guardar no se mandan las marcas quitadas', 'after-school/index.html', "  if (q.quitar.length) datos.quitar = q.quitar;\n", ""],
  // 23-oct: ventana del Profesor (AfterSchool.gs v8)
  ['pasar-lista respeta el limiteProfesor del navegador', 'pasar-lista/api.php', "$datos['datos']['limiteProfesor'] = $conLimite;", "$datos['datos']['limiteProfesor'] = ($datos['datos']['limiteProfesor'] ?? false) === true;"],
  ['pasar-lista no manda la ventana al script (el Profesor queda solo hoy)', 'pasar-lista/api.php', "$datos['datos']['limiteProfesor'] = $conLimite;\n", ""],
  ['la pantalla no recibe la ventana ni si el día es solo para ver', 'pasar-lista/api.php', "'otroDia', 'desde', 'hasta', 'soloLectura', 'estados'", "'otroDia', 'estados'"],
  ['el Profesor no tiene la barra común en Pasar lista', 'after-school/index.html', "Marca.cabecera($('#cab'), { sesion: ses, ruta: [{ texto: 'Inicio', url: '/' }, { texto: 'After School' }, { texto: 'Pasar lista' }] });", ""],
  ['pasar-lista deja pasar otras acciones', 'pasar-lista/api.php', "if (!in_array($datos['accion'], ACCIONES_LISTA, true)) fallo(", "if (false) fallo("],
  ['pasar-lista no recorta la respuesta', 'pasar-lista/api.php', "if ($res['http'] === 200) $res['cuerpo'] = lista_recortada($res['cuerpo'], $tiempos);", ""],
  ['la lista blanca deja pasar contactos', 'pasar-lista/api.php', "return $toma($n, ['idNino', 'nombre', 'edad', 'presencia', 'idVisita', 'estado', 'nota']);", "return $n;"],
  ['after-school/api.php acepta Pasar lista', 'after-school/api.php', "    if (in_array($datos['accion'], ['leerLista', 'guardarLista'], true)) {", "    if (false) {"],
  ['el Profesor no tiene tope de inactividad', 'portal-raiz/permisos.php', "        'inactividad_max' => 7200,\n", ""],
  ['el tope de inactividad no se mira', 'portal-raiz/auth.php', "    if ($max !== null && isset($_SESSION['ultimo']) && time() - (int) $_SESSION['ultimo'] > $max) return null;", ""],
  ['el uso no renueva el plazo', 'portal-raiz/auth.php', "    $_SESSION['ultimo'] = time();   // última actividad (para el tope de inactividad)\n", ""],
  ['Recepción pasa lista', 'portal-raiz/permisos.php', "                       'as.seguimiento', 'area:equipo'],   // 13-nov: sin Procesos", "                       'as.seguimiento', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:equipo'],"],
  ['Recepción resuelve fuera de lista', 'portal-raiz/permisos.php', "    'resolverFueraDeLista' => 'as.lista.corregir',", "    'resolverFueraDeLista' => 'as.seguimiento',"],
  ['Comercial agenda reposiciones', 'portal-raiz/permisos.php', "    'agendarVisita'        => 'as.visitas.agendar',", "    'agendarVisita'        => 'as.pruebas.agendar',"],
  ['la carpeta pasar-lista no tiene área', 'portal-raiz/permisos.php', "    'pasar-lista'   => 'pasarlista',\n", ""],
  // 21-oct (rediseño): navegación por rol, páginas fijas y comun/
  ['destino_inicio siempre manda a la portada', 'portal-raiz/permisos.php', "    if ($v === '*') return '/';", "    return '/';"],
  ['After School abre siempre en Ocupación (inicio_as)', 'portal-raiz/permisos.php', "        'inicio_as' => 'lista',", "        'inicio_as' => 'ocupacion',"],
  ['Contabilidad abre en otra pestaña', 'portal-raiz/permisos.php', "        'inicio_as' => 'pagos',", "        'inicio_as' => 'pruebas',"],
  ['el Profesor no abre After School', 'portal-raiz/permisos.php', "'permisos' => ['area:afterschool', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar',", "'permisos' => ['area:pasarlista', 'as.lista.ver', 'as.lista.marcar',"],
  ['el Profesor recibe Ocupación', 'portal-raiz/permisos.php', "'permisos' => ['area:afterschool', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar',", "'permisos' => ['area:afterschool', 'area:pasarlista', 'as.ver', 'as.lista.ver', 'as.lista.marcar',"],
  ['acceso.php no da la pestaña de entrada', 'portal-raiz/acceso.php', "'inicioAS' => inicio_as($roles)", "'inicioAS' => 'ocupacion'"],
  ['requerir_sesion manda a login.php (vuelve el bucle)', 'portal-raiz/auth.php', "/login.html?r=", "/login.php?r="],
  ['gate.php no entrega login.html sin sesión (bucle con el .htaccess anterior)', 'portal-raiz/gate.php', "if (in_array($directa, ['login.html', 'cambiar-clave.html'], true) || preg_match(", "if (preg_match("],
  ['gate.php entrega cualquier cosa de comun/ sin sesión', 'portal-raiz/gate.php', "preg_match('#^comun/[a-z0-9-]+\\.(css|js|png|jpg|svg|webmanifest)$#', $directa)", "preg_match('#^comun/#', $directa)"],
  ['la regla de comun/ deja pasar PHP', 'portal-raiz/htaccess.txt', "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|jpg|svg|webmanifest)$ - [L]", "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|jpg|svg|webmanifest|php)$ - [L]"],
  ['sin el cierre [F] de comun/ (listado y PHP pasan al gate o a los puentes)', 'portal-raiz/htaccess.txt', "RewriteRule ^comun(/|$) - [F,L]\n", ""],
  // (Quitar login.html de la regla 3 no se ve desde fuera: gate.php la entrega igual, a propósito. Se prueba esa copia arriba.)
  ['/pasar-lista/ ya no lleva a After School', 'pasar-lista/index.html', "location.replace('/after-school/' + q + '#lista');", "location.replace('/');"],
  // 26-oct: Equipo, Resumen y vidrio
  ["Equipo manda el estado real de los puestos a todos", "equipo/api.php", "'estado' => $todo ? (string) ($p['estado'] ?? '') : ($abierto ? EQ_ABIERTO : 'En construcción')", "'estado' => (string) ($p['estado'] ?? '')"],
  ["Equipo da la ficha de un puesto no abierto a quien lo ocupa", "equipo/api.php", "$veFicha = $permite($id) || ($abierto && ($ocupa || $jefe));", "$veFicha = $permite($id) || $ocupa || ($abierto && $jefe);"],
  ["Equipo da todas las fichas a cualquiera", "equipo/api.php", "$veFicha = $permite($id) || ($abierto && ($ocupa || $jefe));", "$veFicha = true;"],
  ["Equipo trata a todos como Dirección", "equipo/api.php", "$todo = roles_permiten($roles, 'equipo.todo');", "$todo = true;"],
  ["Equipo manda unidad y cantidad a todos", "equipo/api.php", "if ($todo) $fila += [", "if (true) $fila += ["],
  ["el jefe no ve a su equipo", "equipo/api.php", "$ocupa = isset($ocupo[$id]); $jefe = $esJefe($id);", "$ocupa = isset($ocupo[$id]); $jefe = false;"],
  ["el jefe ve puestos fuera de su equipo", "equipo/api.php", "            if (isset($ocupo[$j])) return true;", "            if (true) return true;"],
  ["una asignación vencida sigue contando", "equipo/api.php", "        if (($desde !== '' && $desde > $hoy) || ($hasta !== '' && $hasta < $hoy)) continue;\n", ""],
  ["Asignaciones no entiende «Usuario del rol …»", "equipo/api.php", "    if (preg_match('/^usuarios? del rol (.+)$/u', $q, $m)) $q = trim($m[1]);\n", ""],
  ["cualquiera acepta un contrato", "equipo/api.php", "if (in_array($accion, ['aceptar', 'marcar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))", "if (in_array($accion, ['marcar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))"],
  ["cualquiera marca una lista", "equipo/api.php", "if (in_array($accion, ['aceptar', 'marcar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))", "if (in_array($accion, ['aceptar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))"],
  ["cualquiera revisa una lista", "equipo/api.php", "if ($accion === 'revisar' && !in_array($puesto, $V['reviso'], true))", "if (false)"],
  ["se escribe en puestos no abiertos", "equipo/api.php", "if (!eq_abierto($p)) fallo(", "if (false) fallo("],
  ["una versión nueva no invalida la aceptación", "equipo/api.php", "$aceptada = $version !== null && $ultima !== null && (float) $ultima === (float) $version;", "$aceptada = $ultima !== null;"],
  ["cuentan las aceptaciones de otros", "equipo/api.php", "fn($a) => eq_norm((string) ($a['usuario'] ?? '')) === eq_norm($usuario)", "fn($a) => true"],
  ["Equipo manda marcas de hace meses", "equipo/api.php", "$reciente = fn(array $l) => array_values(array_filter($l, fn($x) => substr((string) ($x['fecha'] ?? ''), 0, 10) >= $desdeMarcas));", "$reciente = fn(array $l) => $l;"],
  ["Equipo no suelta la sesión antes de Google", "equipo/api.php", "session_write_close();   // soltar la sesión antes de esperar a Google (ver pasar-lista/api.php)", ""],
  ["Equipo no borra la copia tras escribir", "equipo/api.php", "@unlink($archivo);   // lo escrito se ve en la próxima lectura", ""],
  // 29-oct (Equipo v2)
  ["alguien se verifica a sí mismo", "equipo/api.php", "$puedeRevisar = $abierto && !$ocupa && ($verifico($id) || $jefe);", "$puedeRevisar = $abierto && ($verifico($id) || $jefe);"],
  ["la verificación no sube a Dirección", "equipo/api.php", "{ $v = $raiz; $escalado = true; }", "{ $escalado = true; }"],
  ["«Verifica» no se empareja con los puestos", "equipo/api.php", "        $v = eq_verificador($p, $todos);", "        $v = null;"],
  ["cualquiera marca una hoja", "equipo/api.php", "if (in_array($accion, ['aceptar', 'marcar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))", "if (in_array($accion, ['aceptar', 'marcar', 'desmarcar'], true) && !in_array($puesto, $V['ocupo'], true))"],
  // 2-nov (Equipo v3)
  ["cualquiera quita una marca", "equipo/api.php", "if (in_array($accion, ['aceptar', 'marcar', 'desmarcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))", "if (in_array($accion, ['aceptar', 'marcar', 'marcarHoja'], true) && !in_array($puesto, $V['ocupo'], true))"],
  ["desmarcar manda al script todo lo que llega", "equipo/api.php", "if ($accion === 'desmarcar') $d = ['puesto' => $puesto, 'orden' => $d['orden'] ?? null, 'fecha' => (string) ($d['fecha'] ?? '')];", ""],
  ["las marcas viejas llegan como «Cumplido» y «No»", "equipo/api.php", "'resultado' => eq_resultado((string) ($x['resultado'] ?? ''))", "'resultado' => (string) ($x['resultado'] ?? '')"],
  ["sin el calendario del script", "equipo/api.php", "'calendario' => (object) (is_array($S['calendario'] ?? null) ? $S['calendario'] : [])", "'calendario' => (object) []"],
  ["la hoja temporal no se marca", "equipo/api.php", "if (eq_norm((string) ($x['asignacion'] ?? '')) === eq_norm(EQ_TEMPORAL)) $hojas[$k]['temporal'] = true;", ""],
  ["las iniciales las elige el navegador", "equipo/api.php", "'iniciales' => eq_iniciales(cuenta($usuario), $usuario)];", "'iniciales' => (string) ($d['iniciales'] ?? '')];"],
  ["la tabla de horarios le llega a todos", "equipo/api.php", "    if ($todo) {\n        $respuesta['faltan']", "    if (true) {\n        $respuesta['faltan']"],
  ["Horarios con el ID del puesto en vez del nombre", "equipo/api.php", "(string) ($todos[trim($x)]['puesto'] ?? trim($x))", "trim($x)"],
  ["la verificación de una hoja se mezcla con la lista", "equipo/api.php", "'revisiones' => array_values(array_filter($revs, fn($r) => $deHoja($r['nota']) === null)),", "'revisiones' => $revs,"],
  ["el PDF a quien no le toca", "equipo/api.php", "'pdf' => $todo || ($ocupa && $abierto),", "'pdf' => $todo || $ocupa || $jefe,"],
  ["30-oct: el grupo de la lista no pasa del script a la pantalla", "equipo/api.php", "'grupo' => (string) ($x['grupo'] ?? ($x['frecuencia'] ?? '')), 'grupoOrden' => (int) ($x['grupoOrden'] ?? 99)", "'grupo' => (string) ($x['frecuencia'] ?? ''), 'grupoOrden' => 99"],
  ["las Reglas del juego con filas vacías", "equipo/api.php", "if (!is_array($r) || trim((string) ($r['texto'] ?? '')) === '') continue;", "if (!is_array($r)) continue;"],
  ['el Profesor no abre Equipo', 'portal-raiz/permisos.php', "'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:equipo']", "'area:pasarlista', 'as.lista.ver', 'as.lista.marcar']"],
  ['el Profesor abre el Resumen de Dirección', 'portal-raiz/permisos.php', "'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:equipo']", "'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:equipo', 'area:resumen']"],
  ["Inicio muestra el Resumen a todos", "portal-raiz/index.html", "if (!m && ve('resumen')) html +=", "if (!m) html +="],
  // 3-nov (rediseño): el vidrio y la foto ya no vuelven
  ["After School vuelve al estilo vidrio", "after-school/index.html", "<html lang=\"es\">", "<html lang=\"es\" class=\"vidrio\">"],
  ["Procesos vuelve al estilo vidrio", "procesos/index.html", "<html lang=\"es\">", "<html lang=\"es\" class=\"vidrio\">"],
  ["vea.css vuelve a poner la foto de fondo", "comun/vea.css", "/* ── Estilo vidrio (26-oct): RETIRADO", ".x { background: url(/comun/fondo-local.jpg); } /* ── Estilo vidrio (26-oct): RETIRADO"],
  ["la foto de fondo pide sesión", "portal-raiz/htaccess.txt", "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|jpg|svg|webmanifest)$ - [L]", "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|svg|webmanifest)$ - [L]"],
  // 26-oct: puesto reservado de prueba y Ocupación en el Resumen
  ["un puesto reservado de prueba se ve igual que los demás", "equipo/api.php", "fn($p) => $todo || eq_para_mi($p, $usuario, $nombresRol)", "fn($p) => true"],
  ["Dirección no ve el puesto reservado de prueba", "equipo/api.php", "fn($p) => $todo || eq_para_mi($p, $usuario, $nombresRol)", "fn($p) => eq_para_mi($p, $usuario, $nombresRol)"],
  ["ni su usuario ve el puesto reservado de prueba", "equipo/api.php", "    if ($para === '') return true;\n", "    if ($para !== '') return false;\n"],
  ["«Visible solo para» admite un solo nombre", "equipo/api.php", "foreach (explode(',', $para) as $quien)", "foreach ([$para] as $quien)"],
  ["el Resumen hace sus cuentas fuera de comun/cifras.js", "resumen/index.html", "const N = Cifras.resumenNegocio({ periodo, E: AS, pre: R.preschool, metas: R.metas, finanzas: R.finanzas });", "const N = { finanzas: {}, ninos: {}, unidades: [], alertas: [] };"],
  ["el Resumen no carga comun/cifras.js", "resumen/index.html", "<script src=\"/comun/cifras.js?v=", "<script data-x=\"/comun/cifras.js?v="],
  // 26-oct: Resumen del negocio, Pendientes de hoy, nombres, Procesos y Ocupación
  ["Pendientes: Recepción recibe las clases sin lista (no pasa lista)", "pendientes/api.php", "roles_permiten($roles, 'as.seguimiento') && roles_permiten($roles, 'as.lista.marcar')", "roles_permiten($roles, 'as.seguimiento')"],
  ["Pendientes: los contratos por validar le llegan a todos", "pendientes/api.php", "'contratos' => roles_permiten($roles, 'equipo.todo'),", "'contratos' => true,"],
  ["Pendientes: las pruebas sin resultado a quien no puede ponerlo", "pendientes/api.php", "'pruebas'   => roles_permiten($roles, permiso_de_accion_as('resultadoPrueba')),", "'pruebas'   => roles_permiten($roles, 'as.ver'),"],
  ["Pendientes: consulta After School aunque el rol no lo atienda", "pendientes/api.php", "if ($puede['sinLista'] || $puede['pruebas']) {", "if (true) { if (!empty($cfg['as_exec'])) pe_as($cfg, 'seguimiento', $cache . '/pendientes-x-' . bin2hex(random_bytes(3)) . '.json', $usuario);"],
  ["Pendientes: cuenta clases sin lista de otros días", "pendientes/api.php", "(string) ($c['fecha'] ?? '') === $hoy", "true"],
  ["Pendientes: listas sin revisar de puestos que no revisa", "pendientes/api.php", ": (array) ($R['revisar'] ?? []);", ": array_map(fn($p) => (string) $p['id'], (array) ($R['puestos'] ?? []));"],
  ["Pendientes: manda lo que leyó de After School", "pendientes/api.php", "'n' => $E === null ? null : pe_pruebas($E)];", "'n' => $E === null ? null : pe_pruebas($E), 'e' => $E];"],
  ["Resumen: su puente lo abre cualquiera", "portal-raiz/permisos.php", "    'resumen'       => 'resumen',", "    'resumen'       => 'equipo',"],
  ["Resumen: manda las filas de Preschool (montos y nombres)", "resumen/api.php", "'meses' => (object) $meses];", "'meses' => (object) $meses, 'filas' => array_slice($A, 3, 6)];"],
  ["Resumen: cuenta las filas de otras unidades", "resumen/api.php", "        if ($cUni >= 0 && !preg_match('/k[íi]nder/iu', $r[$cUni] ?? '')) continue;\n", ""],
  ["Resumen: las altas de otros años cuentan", "resumen/api.php", "if ($n['ing'] && $n['ing'][0] === $anio && $n['ing'][1] === $m) $alt++;", "if ($n['ing'] && $n['ing'][1] === $m) $alt++;"],
  ["Resumen: cuenta los meses después del sello", "resumen/api.php", "$hasta = $corte === null ? 12 : $corte;", "$hasta = 12;"],
  ["Resumen: la capacidad no sale de Config Kínder", "resumen/api.php", "$capacidad = $v !== null && $v > 0 ? $v : null;", "$capacidad = 100;"],
  // 28-oct: Preschool operativo (kinder/csv.php sin montos) y la nota del Resumen
  ["Preschool: csv.php pasa la columna de pagos", "kinder/csv.php", "'Fecha de nacimiento', 'Grupo',", "'Fecha de nacimiento', 'Grupo', 'Pago del mes ($)',"],
  ["Preschool: csv.php pasa el plan", "kinder/csv.php", "'Nombre del niño', 'Motivo de salida'];", "'Nombre del niño', 'Motivo de salida', 'Plan'];"],
  ["Preschool: csv.php pasa las tarifas", "kinder/csv.php", "'Fecha meta', 'fecha_meta', 'Fecha de meta'];", "'Fecha meta', 'fecha_meta', 'Fecha de meta', 'Tarifa plan 4.5 horas'];"],
  ["Preschool: csv.php pasa el CSV entero", "kinder/csv.php", "echo ki_csv($salida);", "echo $respuesta;"],
  ["Preschool: csv.php pasa las filas de otras unidades", "kinder/csv.php", "        if ($cUni >= 0 && !preg_match('/k[íi]nder/iu', $r[$cUni] ?? '')) continue;\n", ""],
  ["Preschool: «Pagó el mes» dice Sí sin pago", "kinder/csv.php", "if ($cPago >= 0) $fila[] = ki_pago($r[$cPago] ?? '') ? 'Sí' : 'No';", "if ($cPago >= 0) $fila[] = 'Sí';"],
  ["Preschool: un pago con coma no cuenta", "kinder/csv.php", "\\x{00A0}.,]/u', '', trim($v));\n    return preg_match", "\\x{00A0}]/u', '', trim($v));\n    return preg_match"],
  ["Preschool: la tabla de salones pasa todas sus columnas", "kinder/csv.php", "$cols = array_map(fn($n) => ki_col($C[$iG], $n), KI_SALONES);", "$cols = array_keys($C[$iG]);"],
  ["Preschool: se puede pedir la pestaña Kínder", "kinder/csv.php", "if (!in_array($tabla, ['analisis', 'config'], true))", "if (!in_array($tabla, ['analisis', 'config', 'kinder'], true))"],
  ["Preschool: la página vuelve a cargar config-local.js", "kinder/index.html", "<script src=\"config.php\"></script>", "<script src=\"config.php\"></script>\n<script src=\"config-local.js\"></script>"],
  ["Resumen: la nota de Preschool no se puede quitar", "resumen/api.php", "return array_key_exists('preschool_nota', $cfg) && is_scalar($cfg['preschool_nota']) ? trim((string) $cfg['preschool_nota']) : RS_NOTA_PRESCHOOL;", "return RS_NOTA_PRESCHOOL;"],
  ["Resumen: sin la nota de Preschool", "resumen/api.php", "else $preschool['nota'] = rs_nota_preschool($cfg);", ""],
  ["Resumen: pasa las metas incompletas", "resumen/api.php", " || $x['valor'] === null) continue;", ") continue;"],
  ["Configuración: nadie mira usuarios.nombres (Dirección edita nombres)", "configuracion/api.php", "if (!roles_permiten($d['usuarios'][$yo]['roles'] ?? [], 'usuarios.nombres'))", "if (false)"],
  ["un nombre acepta cualquier cosa", "portal-raiz/cuentas.php", "if (mb_strlen($v) > 40 || !preg_match(\"/^\\p{L}[\\p{L}\\p{M} .'’-]*$/u\", $v))", "if (mb_strlen($v) > 40)"],
  ["el registro guarda el nombre", "configuracion/api.php", "anotar_evento($d, $yo, 'nombre', $usuario);", "anotar_evento($d, $yo, 'nombre', $usuario, $nombre);"],
  ["la sesión no trae el nombre", "portal-raiz/acceso.php", "'nombre' => trim((string) ($c['nombre'] ?? '')),", "'nombre' => '',"],
  ["Revisar manda el nombre de todas las cuentas", "equipo/api.php", "foreach (array_keys($quienes) as $u) {", "foreach (array_keys((array) (cuentas()['usuarios'] ?? [])) as $u) {"],
  ["la barra lateral no muestra el nombre", "comun/marca.js", "const nom = nombreDe(S) || 'Usuario'", "const nom = (S && S.usuario) || 'Usuario'"],
  ["Ocupación sin la regla del Resumen", "after-school/index.html", "cif = deHoy ? Cifras.ocupacionAS(E) : null;", "cif = null;"],
  ["las notificaciones muestran avisos que el servidor no mandó", "comun/marca.js", "return (NOTI.items || []).filter(x => NOTIFICACIONES[x.clave] && x.n);", "return Object.keys(NOTIFICACIONES).map(clave => ({ clave, n: 1, url: '/' }));"],
  // htaccess.txt
  ['cuentas.php se puede pedir desde el navegador', 'portal-raiz/htaccess.txt', "auth\\.php|permisos\\.php|cuentas\\.php|", "auth\\.php|permisos\\.php|"],
  ['generar-clave.php sigue abierto sin sesión', 'portal-raiz/htaccess.txt', "login\\.php|logout\\.php|cambiar-clave", "login\\.php|logout\\.php|generar-clave\\.php|cambiar-clave"]
];

function copiar(de, a) {
  fs.mkdirSync(a, { recursive: true });
  for (const n of fs.readdirSync(de)) {
    const x = path.join(de, n), y = path.join(a, n);
    if (fs.statSync(x).isDirectory()) copiar(x, y); else fs.copyFileSync(x, y);
  }
}

(async () => {
  const log = console.log;
  let detectadas = 0, inexistentes = 0;
  for (const [nombre, archivo, de, a] of ROTURAS) {
    const original = fs.readFileSync(path.join(REPO, archivo), 'utf8').replace(/\r\n/g, '\n');
    if (original.split(de).length !== 2) { inexistentes++; if (process.env.GITHUB_ACTIONS) log('::error title=Rotura sin texto::' + nombre + ' (' + archivo + ')'); log('  ? ' + nombre + ': el texto a romper no aparece una sola vez en ' + archivo + ' (actualizar roturas-portal.js)'); continue; }
    const fuente = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-rotura-'));
    for (const c of CARPETAS) copiar(path.join(REPO, c), path.join(fuente, c));
    fs.writeFileSync(path.join(fuente, archivo), original.replace(de, a));
    const lineas = [];
    console.log = (...x) => lineas.push(x.join(' '));
    let paso;
    try { paso = await correr(fuente); } catch (e) { paso = false; lineas.push(String(e)); }
    console.log = log;
    if (!paso) detectadas++;
    log((paso ? '  ✗ NO DETECTADA: ' : '  ✓ ') + nombre);
    // En GitHub, además, como aviso de la tanda: los avisos se leen sin iniciar sesión.
    if (paso && process.env.GITHUB_ACTIONS) log('::error title=Rotura no detectada::' + nombre + ' (' + archivo + ')');
  }
  log('');
  log(detectadas + ' de ' + ROTURAS.length + ' roturas detectadas' + (inexistentes ? ' (' + inexistentes + ' sin texto)' : ''));
  process.exit(detectadas === ROTURAS.length ? 0 : 1);
})();
