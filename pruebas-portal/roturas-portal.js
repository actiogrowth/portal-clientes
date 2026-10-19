/* Rompe a propósito cada defensa de roles y usuarios y comprueba que
 * prueba-portal.js lo detecta.
 *
 *   PHP=php node pruebas-portal/roturas-portal.js
 *
 * Cada rotura se aplica sobre una copia de portal-raiz/, after-school/ y
 * configuracion/ en una carpeta temporal; el repo no se toca.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { correr } = require('./prueba-portal');

const REPO = path.join(__dirname, '..');
const CARPETAS = ['portal-raiz', 'after-school', 'configuracion'];

// [nombre, archivo, texto de hoy, texto roto]
const ROTURAS = [
  // permisos.php
  ['Dirección puede tocar cuentas de Administrador (sin «excepto»)', 'portal-raiz/permisos.php', "        'excepto' => ['usuarios.admin'],\n", ''],
  ['las carpetas sin asignar quedan abiertas', 'portal-raiz/permisos.php', "    return CARPETAS_AREA[$carpeta] ?? '*';", "    return CARPETAS_AREA[$carpeta] ?? null;"],
  ['Comercial con After School completo', 'portal-raiz/permisos.php', "'area:basededatos', 'as.ver', 'as.pruebas.ver',\n                       'as.pruebas.agendar', 'as.contactos.prospectos'],", "'area:basededatos', 'as.ver', 'as.pruebas.ver', 'as.completo',\n                       'as.pruebas.agendar', 'as.contactos.prospectos'],"],
  ['Contabilidad recibe contactos', 'portal-raiz/permisos.php', "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago'],", "'as.pagos.registrar', 'as.pruebas.ver', 'as.pruebas.pago', 'as.contactos.todos'],"],
  ['una acción sin permiso propio solo pide as.ver', 'portal-raiz/permisos.php', "    return PERMISO_ACCION_AS[$accion] ?? 'as.completo';", "    return PERMISO_ACCION_AS[$accion] ?? 'as.ver';"],
  ['Comercial ve contactos de cualquier niño', 'portal-raiz/permisos.php', "if ($esNino && !($politica === 'prospectos' && ($valor->estado ?? '') === 'Prospecto')) {", "if ($esNino && $politica !== 'prospectos') {"],
  // auth.php
  ['requerir_sesion no mira el área', 'portal-raiz/auth.php', "    if (!roles_abren_ruta($c['roles'] ?? [], $ruta)) {", "    if (false) {"],
  ['la sesión no se corta al cambiar o reiniciar la contraseña', 'portal-raiz/auth.php', "    if ((int) ($_SESSION['ver_clave'] ?? 0) !== (int) ($c['ver_clave'] ?? 0)) return null;\n", ''],
  ['la sesión de una cuenta desactivada sigue', 'portal-raiz/auth.php', "    if (!$c || empty($c['activo'])) return null;", "    if (!$c) return null;"],
  ['la contraseña temporal no obliga a cambiarla', 'portal-raiz/auth.php', "    if (!empty($c['cambiar_clave'])) {", "    if (false) {"],
  // gate.php
  ['gate.php entrega sin mirar el área', 'portal-raiz/gate.php', "requerir_sesion(substr($ruta, strlen($base) + 1));", ''],
  // acceso.php
  ['la portada muestra todas las tarjetas a todos', 'portal-raiz/acceso.php', "json_encode(areas_visibles($roles))", "json_encode('*')"],
  // login.php
  ['una cuenta desactivada entra', 'portal-raiz/login.php', "if ($c && !empty($c['activo']) && password_verify(", "if ($c && password_verify("],
  ['el login no exige CSRF', 'portal-raiz/login.php', "    if (!csrf_valido($_POST['csrf'] ?? null)) {\n        $error = 'La página caducó. Vuelve a escribir", "    if (false) {\n        $error = 'La página caducó. Vuelve a escribir"],
  ['el login no manda a cambiar la temporal', 'portal-raiz/login.php', "header('Location: ' . (!empty($c['cambiar_clave']) ? '/cambiar-clave.php?r=' . urlencode($destino) : $destino));", "header('Location: ' . $destino);"],
  ['el login no exige roles_iniciales completos (migra a medias)', 'portal-raiz/cuentas.php', "    if ($faltan) { $GLOBALS['cuentas_error']", "    if (false) { $GLOBALS['cuentas_error']"],
  // cambiar-clave.php
  ['cambiar la contraseña no exige CSRF', 'portal-raiz/cambiar-clave.php', "    if (!csrf_valido($_POST['csrf'] ?? null)) {\n        $error = 'La página caducó. Vuelve a intentarlo.';", "    if (false) {\n        $error = 'La página caducó. Vuelve a intentarlo.';"],
  ['cambiar la contraseña no pide la actual', 'portal-raiz/cambiar-clave.php', "    } elseif (!password_verify($actual, $c['hash'])) {", "    } elseif (false) {"],
  ['acepta contraseñas de menos de 10', 'portal-raiz/cambiar-clave.php', "    } elseif (strlen($nueva) < CLAVE_MINIMA) {", "    } elseif (false) {"],
  ['cambiar la contraseña no corta las otras sesiones', 'portal-raiz/cambiar-clave.php', "                $x['ver_clave'] = (int) ($x['ver_clave'] ?? 0) + 1;\n                anotar_evento($d, $usuario, 'cambiar_clave', $usuario);", "                anotar_evento($d, $usuario, 'cambiar_clave', $usuario);"],
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
