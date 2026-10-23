/* Rompe a propósito cada defensa de roles y usuarios y comprueba que
 * prueba-portal.js lo detecta.
 *
 *   PHP=php node pruebas-portal/roturas-portal.js
 *
 * Cada rotura se aplica sobre una copia de portal-raiz/, after-school/,
 * configuracion/, pasar-lista/, comun/, proyecto-actio/, procesos/ y
 * biblioteca/ en una carpeta temporal; el repo no se toca.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { correr } = require('./prueba-portal');

const REPO = path.join(__dirname, '..');
const CARPETAS = ['portal-raiz', 'after-school', 'configuracion', 'pasar-lista', 'comun', 'proyecto-actio', 'procesos', 'biblioteca'];

// [nombre, archivo, texto de hoy, texto roto]
const ROTURAS = [
  // 23-oct: Procesos, biblioteca y portada por marca
  ['Procesos manda lo que no es para el cliente (recorte de Administrador)', 'procesos/api.php', "pa_recortar($l['cuerpo'], false,", "pa_recortar($l['cuerpo'], roles_permiten(roles_actuales(), 'pa.internos'),"],
  ['Procesos manda lo interno a todos', 'procesos/api.php', "pa_recortar($l['cuerpo'], false,", "pa_recortar($l['cuerpo'], true,"],
  ['Procesos manda documentos de otros segmentos (Finanzas, vacío)', 'procesos/api.php', "        if ($proceso === null) continue;", ""],
  ['Procesos sin lista blanca de campos', 'procesos/api.php', "$docs[] = array_intersect_key($fila, array_flip(PROCESOS_CAMPOS));", "$docs[] = $d;"],
  ['Procesos no junta Gerencia en General', 'procesos/api.php', "        if (in_array(pa_norm(strtr($unidad, PROCESOS_TILDES)), $esGeneral, true)) $unidad = 'General';\n", ""],
  ['Procesos funciona sin su configuración (valores en el código)', 'procesos/api.php', "$cfg = pa_config(['procesos_segmentos', 'procesos_general']);", "$cfg = pa_config([]) + ['procesos_segmentos' => ['Atracción' => ['Marketing'], 'Adquisición' => ['Ventas'], 'Entrega de servicio' => ['Servicio']], 'procesos_general' => ['Gerencia']];"],
  ['el Profesor no abre Procesos', 'portal-raiz/permisos.php', "'as.lista.ver', 'as.lista.marcar', 'area:procesos', 'procesos.ver:*'],", "'as.lista.ver', 'as.lista.marcar'],"],
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
  ['Dirección tiene pa.internos', 'portal-raiz/permisos.php', "'excepto' => ['usuarios.admin', 'pa.internos'],", "'excepto' => ['usuarios.admin'],"],
  ['Proyecto Actio sin lista blanca (salen las Notas)', 'proyecto-actio/api.php', "foreach ($campos as $c) $fila[$c] = $f[$c] ?? '';", "$fila = $f;"],
  ['cualquier rol de After School abre Proyecto Actio', 'portal-raiz/permisos.php', "'proyecto-actio' => 'proyecto-actio',", "'proyecto-actio' => 'afterschool',"],
  ['Proyecto Actio acepta otras acciones', 'proyecto-actio/api.php', "($datos['accion'] ?? '') !== 'leer'", "false"],
  ['Proyecto Actio sin copia en el servidor', 'proyecto-actio/api.php', "if ($copia && $edad < $ttl) {", "if (false) {"],
  ['la copia de Proyecto Actio vive en la carpeta pública', 'proyecto-actio/api.php', "$archivo = dirname(__DIR__, 2) . '/portal_cache/proyecto-actio.json';", "$archivo = dirname(__DIR__) . '/portal_cache/proyecto-actio.json';"],
  ['se usa una copia de más de un día', 'proyecto-actio/api.php', "if ($copia && $edad < PA_COPIA_MAX_SEG) {", "if ($copia) {"],
  ['un documento sin proyecto no toma el de su entregable (Proyecto 2 se le escapa a Dirección)', 'proyecto-actio/api.php', "if ($p === '' && $tabla === 'documentos') $p = $proyEntregable[(string) ($f['idEntregable'] ?? '')] ?? '';", ""],
  // permisos.php
  ['Dirección puede tocar cuentas de Administrador (sin «excepto»)', 'portal-raiz/permisos.php', "'excepto' => ['usuarios.admin', 'pa.internos'],", "'excepto' => ['pa.internos'],"],
  ['las carpetas sin asignar quedan abiertas', 'portal-raiz/permisos.php', "    return CARPETAS_AREA[$carpeta] ?? '*';", "    return CARPETAS_AREA[$carpeta] ?? null;"],
  ['Comercial con After School completo', 'portal-raiz/permisos.php', "'area:basededatos', 'as.ver', 'as.pruebas.ver',\n                       'as.pruebas.agendar', 'as.contactos.prospectos', 'area:procesos', 'procesos.ver:*'],", "'area:basededatos', 'as.ver', 'as.pruebas.ver', 'as.completo',\n                       'as.pruebas.agendar', 'as.contactos.prospectos', 'area:procesos', 'procesos.ver:*'],"],
  ['Contabilidad recibe contactos', 'portal-raiz/permisos.php', "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'area:procesos', 'procesos.ver:*'],", "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'as.contactos.todos', 'area:procesos', 'procesos.ver:*'],"],
  ['una acción sin permiso propio solo pide as.ver', 'portal-raiz/permisos.php', "    return PERMISO_ACCION_AS[$accion] ?? 'as.completo';", "    return PERMISO_ACCION_AS[$accion] ?? 'as.ver';"],
  ['Comercial ve contactos de cualquier niño', 'portal-raiz/permisos.php', "if ($esNino && !($politica === 'prospectos' && ($valor->estado ?? '') === 'Prospecto')) {", "if ($esNino && $politica !== 'prospectos') {"],
  // auth.php
  ['requerir_sesion no mira el área', 'portal-raiz/auth.php', "    if (!roles_abren_ruta($c['roles'] ?? [], $ruta)) {", "    if (false) {"],
  ['la sesión no se corta al cambiar o reiniciar la contraseña', 'portal-raiz/auth.php', "    if ((int) ($_SESSION['ver_clave'] ?? 0) !== (int) ($c['ver_clave'] ?? 0)) return null;\n", ''],
  ['la sesión de una cuenta desactivada sigue', 'portal-raiz/auth.php', "    if (!$c || empty($c['activo'])) return null;", "    if (!$c) return null;"],
  ['la contraseña temporal no obliga a cambiarla', 'portal-raiz/auth.php', "    if (!empty($c['cambiar_clave'])) {", "    if (false) {"],
  // gate.php
  ['gate.php no corre directo las páginas de la raíz (bucle con el .htaccess anterior, 20-oct)', 'portal-raiz/gate.php', "if (in_array($directa, ['login.php', 'logout.php', 'cambiar-clave.php', 'acceso.php'], true)) {", "if (false) {"],
  ['gate.php entrega sin mirar el área', 'portal-raiz/gate.php', "requerir_sesion(substr($ruta, strlen($base) + 1));", ''],
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
  ['pasar-lista respeta el soloHoy del navegador', 'pasar-lista/api.php', "$datos['datos']['soloHoy'] = !roles_permiten($roles, 'as.lista.corregir');", "$datos['datos']['soloHoy'] = ($datos['datos']['soloHoy'] ?? false) === true;"],
  ['pasar-lista deja pasar otras acciones', 'pasar-lista/api.php', "if (!in_array($datos['accion'], ACCIONES_LISTA, true)) fallo(", "if (false) fallo("],
  ['pasar-lista no recorta la respuesta', 'pasar-lista/api.php', "if ($res['http'] === 200) $res['cuerpo'] = lista_recortada($res['cuerpo']);", ""],
  ['la lista blanca deja pasar contactos', 'pasar-lista/api.php', "return $toma($n, ['idNino', 'nombre', 'edad', 'presencia', 'idVisita', 'estado', 'nota']);", "return $n;"],
  ['after-school/api.php acepta Pasar lista', 'after-school/api.php', "    if (in_array($datos['accion'], ['leerLista', 'guardarLista'], true)) {", "    if (false) {"],
  ['el Profesor no tiene tope de inactividad', 'portal-raiz/permisos.php', "        'inactividad_max' => 7200,\n", ""],
  ['el tope de inactividad no se mira', 'portal-raiz/auth.php', "    if ($max !== null && isset($_SESSION['ultimo']) && time() - (int) $_SESSION['ultimo'] > $max) return null;", ""],
  ['el uso no renueva el plazo', 'portal-raiz/auth.php', "    $_SESSION['ultimo'] = time();   // última actividad (para el tope de inactividad)\n", ""],
  ['Recepción pasa lista', 'portal-raiz/permisos.php', "'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',\n                       'as.seguimiento', 'area:procesos', 'procesos.ver:*'],", "'as.pagos.ver', 'as.pagos.registrar', 'as.contactos.todos', 'as.visitas.agendar',\n                       'as.seguimiento', 'area:pasarlista', 'as.lista.ver', 'as.lista.marcar', 'area:procesos', 'procesos.ver:*'],"],
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
  ['gate.php entrega cualquier cosa de comun/ sin sesión', 'portal-raiz/gate.php', "preg_match('#^comun/[a-z0-9-]+\\.(css|js|png|svg|webmanifest)$#', $directa)", "preg_match('#^comun/#', $directa)"],
  ['la regla de comun/ deja pasar PHP', 'portal-raiz/htaccess.txt', "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|svg|webmanifest)$ - [L]", "RewriteRule ^comun/[a-z0-9-]+\\.(css|js|png|svg|webmanifest|php)$ - [L]"],
  ['sin el cierre [F] de comun/ (listado y PHP pasan al gate o a los puentes)', 'portal-raiz/htaccess.txt', "RewriteRule ^comun(/|$) - [F,L]\n", ""],
  // (Quitar login.html de la regla 3 no se ve desde fuera: gate.php la entrega igual, a propósito. Se prueba esa copia arriba.)
  ['/pasar-lista/ ya no lleva a After School', 'pasar-lista/index.html', "location.replace('/after-school/' + q + '#lista');", "location.replace('/');"],
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
    if (original.split(de).length !== 2) { inexistentes++; log('  ? ' + nombre + ': el texto a romper no aparece una sola vez en ' + archivo + ' (actualizar roturas-portal.js)'); continue; }
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
  }
  log('');
  log(detectadas + ' de ' + ROTURAS.length + ' roturas detectadas' + (inexistentes ? ' (' + inexistentes + ' sin texto)' : ''));
  process.exit(detectadas === ROTURAS.length ? 0 : 1);
})();
