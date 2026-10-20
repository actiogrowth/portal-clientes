/* Pruebas de roles y usuarios del portal, de punta a punta.
 *
 *   PHP=php node pruebas-portal/prueba-portal.js
 *
 * Corren en GitHub Actions (.github/workflows/pruebas-after-school.yml), no en
 * el equipo de desarrollo: allí el antivirus retiene los PHP de prueba. Por eso
 * todo lo de PHP que necesitan (el enrutador que imita el .htaccess, las áreas
 * de mentira, la prueba suelta de la regla del último Administrador) se
 * escribe en una carpeta temporal al correr, nunca en el repo.
 *
 * Arma un portal de prueba igual al del servidor:
 *   <tmp>/home/portal_config.php          (as_exec apunta a un Apps Script falso)
 *   <tmp>/home/portal/                    portal-raiz/* + after-school/ + configuracion/
 *   <tmp>/home/portal/usuarios.php        el archivo de siempre, con huellas de prueba
 * y lo sirve con `php -S` y un enrutador que aplica las reglas de htaccess.txt
 * tal como están escritas (leídas del archivo, no copiadas).
 *
 * Los usuarios son INVENTADOS (regla del repo: nada de nombres del cliente) y
 * reproducen la forma del servidor: tres Administradores, una Dirección y una
 * Coordinación After School, migrados desde usuarios.php con 'roles_iniciales'.
 *
 * Primer argumento opcional: otra carpeta con portal-raiz/, after-school/ y
 * configuracion/ (la usa roturas-portal.js para probar copias rotas).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const PHP = process.env.PHP || 'php';
const REPO = path.join(__dirname, '..');

let total = 0, fallos = 0;
const ok = (cond, que) => { total++; if (!cond) { fallos++; console.log('  ✗ ' + que); } };
const seccion = t => console.log('· ' + t);

/* ── El portal de prueba ─────────────────────────────────────────────────── */

function copiar(de, a) {
  fs.mkdirSync(a, { recursive: true });
  for (const n of fs.readdirSync(de)) {
    const x = path.join(de, n), y = path.join(a, n);
    if (fs.statSync(x).isDirectory()) copiar(x, y); else fs.copyFileSync(x, y);
  }
}

const huella = clave => {
  const r = spawnSync(PHP, ['-r', 'echo password_hash($argv[1], PASSWORD_DEFAULT);', clave], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.startsWith('$2y$')) throw new Error('no se pudo generar la huella: ' + r.stderr);
  return r.stdout;
};
const clave = () => 'Prueba-' + crypto.randomBytes(9).toString('base64url');

/* Los usuarios «de siempre», inventados. */
const HEREDADOS = {
  'admin-uno': ['administrador'], 'admin-dos': ['administrador'], 'admin-tres': ['administrador'],
  'cuenta-direccion': ['direccion'], 'cuenta-general': ['coordinacion_afterschool']
};

function phpLiteral(v) { return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

function escribirConfig(home, iniciales, puertoGoogle) {
  const roles = Object.entries(iniciales).map(([u, r]) => '    ' + phpLiteral(u) + ' => [' + r.map(phpLiteral).join(', ') + '],').join('\n');
  fs.writeFileSync(path.join(home, 'portal_config.php'), `<?php
return [
  'as_exec' => 'http://127.0.0.1:${puertoGoogle}/exec',
  'as_clave' => 'clave-de-prueba',
  'as_usuarios' => ['admin-uno'],
  'roles_iniciales' => [
${roles}
  ],
];
`);
}

/* Enrutador de php -S: aplica las RewriteRule de htaccess.txt en orden. */
const ENRUTADOR = String.raw`<?php
$web = getenv('PORTAL_WEB');
$rel = ltrim(urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)), '/');
$reglas = []; $conCondicion = false;
foreach (file(getenv('PORTAL_HTACCESS')) as $l) {
    $l = trim($l);
    if (str_starts_with($l, 'RewriteCond')) { $conCondicion = true; continue; }
    if (!str_starts_with($l, 'RewriteRule')) continue;
    $p = preg_split('/\s+/', $l);
    if (!$conCondicion) $reglas[] = ['patron' => $p[1], 'destino' => $p[2], 'flags' => $p[3] ?? ''];
    $conCondicion = false;
}
foreach ($reglas as $r) {
    if (!preg_match('#' . $r['patron'] . '#', $rel, $m)) continue;
    if (str_contains($r['flags'], 'F')) { http_response_code(403); echo 'Prohibido'; return true; }
    if ($r['destino'] === '-') {
        if (is_file($web . '/' . $rel)) return false;
        http_response_code(404); echo 'No existe'; return true;
    }
    if (str_starts_with($r['destino'], 'gate.php')) {
        $_GET['f'] = $m[1] ?? $rel;
        chdir($web);
        require $web . '/gate.php';
        return true;
    }
}
http_response_code(404); echo 'Sin regla'; return true;
`;

/* El .htaccess que había en producción antes de los roles (sin cambiar-clave.php
   ni acceso.php en la regla 3). El 20-oct seguía publicado y el login con
   contraseña temporal entraba en bucle: el recorrido se prueba con los dos. */
const HTACCESS_ANTERIOR = String.raw`# Portal Vida en Arte 360 — renombrar este archivo a .htaccess en el servidor
Options -Indexes
DirectoryIndex index.html

RewriteEngine On

# Validación del certificado SSL (AutoSSL): debe quedar libre
RewriteRule ^\.well-known/ - [L]

# 1. Siempre por HTTPS
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 2. Archivos internos: nunca accesibles desde el navegador
RewriteRule ^(auth\.php|usuarios\.php|php\.ini|htaccess\.txt)$ - [F,L]
RewriteRule (^|/)\. - [F,L]

# 3. Páginas que se abren sin sesión
RewriteRule ^(login\.php|logout\.php|generar-clave\.php|gate\.php|robots\.txt)$ - [L]

# 3b. Los puentes de datos: comprueban la sesión por dentro
RewriteRule ^[a-z0-9-]+/(api|csv|config)\.php$ - [L]

# 4. Todo lo demás pasa por el control de sesión
RewriteRule ^(.*)$ gate.php?f=$1 [L,QSA]
`;

/* Áreas de mentira: una página por carpeta y puentes que solo llaman a requerir_sesion(). */
function areasDeMentira(web) {
  const pagina = t => '<!doctype html><title>' + t + '</title><p>' + t + '</p>';
  const puente = '<?php require dirname(__DIR__) . \'/auth.php\'; requerir_sesion(); header(\'Content-Type: application/json\'); echo \'{"ok":true}\';';
  for (const c of ['kinder', 'veranito', 'basededatos', 'baby-and-me', 'cumpleanos', 'cgi-bin', 'carpeta-nueva']) {
    fs.mkdirSync(path.join(web, c), { recursive: true });
    fs.writeFileSync(path.join(web, c, 'index.html'), pagina(c));
  }
  fs.writeFileSync(path.join(web, 'kinder', 'csv.php'), puente);
  fs.writeFileSync(path.join(web, 'basededatos', 'api.php'), puente);
  fs.writeFileSync(path.join(web, 'raiz.txt'), 'archivo de la raíz');
  fs.mkdirSync(path.join(web, '.well-known', 'acme-challenge'), { recursive: true });
  fs.writeFileSync(path.join(web, '.well-known', 'acme-challenge', 'ficha.txt'), 'certificado');
}

/* ── Apps Script falso ───────────────────────────────────────────────────── */

const NINOS = () => [
  { id: 'AS-0001', estado: 'Activo', nombre: 'Inventado', apellidos: 'Uno', responsable: 'Responsable Uno', telefono: '555-0101',
    telefono2: '555-0102', correo: 'uno@ejemplo.test', responsable2: 'Otro Uno', telefonoResp2: '555-0103' },
  { id: 'AS-0002', estado: 'Prospecto', nombre: 'Inventado', apellidos: 'Dos', responsable: 'Responsable Dos', telefono: '555-0201',
    telefono2: '', correo: 'dos@ejemplo.test', responsable2: '', telefonoResp2: '' }
];
const ESTADO = () => ({ usuario: 'x', hoy: '2026-10-19', mes: '2026-10', config: {}, clases: [], ninos: NINOS(), inscripciones: [],
  inscripcionesCerradas: [], pruebas: [{ id: 'PR-0001', idNino: 'AS-0002', estado: 'Agendada', pago: '', monto: null }],
  pagosMes: [{ id: 'PG-0001', idNino: 'AS-0001', monto: 50 }] });

function googleFalso() {
  const llamadas = [];
  const s = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', d => { cuerpo += d; });
    req.on('end', () => {
      let j = {}; try { j = JSON.parse(cuerpo); } catch (e) { }
      llamadas.push({ accion: j.accion, usuario: j.usuario, key: j.key });
      let r;
      if (j.accion === 'leer') r = { ok: true, resultado: ESTADO() };
      else if (j.accion === 'listarPagos') r = { ok: true, resultado: { mes: '2026-10', pagos: [{ id: 'PG-0001', idNino: 'AS-0001', monto: 50 }] } };
      else r = { ok: true, resultado: { id: 'AS-0003', estado: 'Prospecto', telefono: '555-0301' }, estado: ESTADO() };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r));
    });
  });
  return new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve({ s, llamadas })));
}

/* ── Navegador con cookies ───────────────────────────────────────────────── */

class Nav {
  constructor(base) { this.base = base; this.cookies = {}; }
  async pedir(metodo, ruta, { form, json, headers } = {}) {
    const h = Object.assign({}, headers || {});
    const c = Object.entries(this.cookies).map(([k, v]) => k + '=' + v).join('; ');
    if (c) h.Cookie = c;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['Content-Type'] = 'application/x-www-form-urlencoded'; }
    if (json) { body = JSON.stringify(json); h['Content-Type'] = 'application/json'; }
    const r = await fetch(this.base + ruta, { method: metodo, headers: h, body, redirect: 'manual' });
    for (const sc of r.headers.getSetCookie()) {
      const [kv] = sc.split(';'); const i = kv.indexOf('=');
      const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
      if (/expires=Thu, 01 Jan 1970|max-age=0/i.test(sc) || v === 'deleted' || v === '') delete this.cookies[k]; else this.cookies[k] = v;
    }
    const texto = await r.text();
    let j = null; try { j = JSON.parse(texto); } catch (e) { }
    return { status: r.status, location: r.headers.get('location') || '', texto, j };
  }
  get(ruta, o) { return this.pedir('GET', ruta, o); }
  post(ruta, o) { return this.pedir('POST', ruta, o); }
  async csrfDe(ruta) {
    const r = await this.get(ruta);
    const m = r.texto.match(/name="csrf" value="([^"]+)"/);
    return m ? m[1] : '';
  }
  async entrar(usuario, clave) {
    const csrf = await this.csrfDe('/login.php');
    return this.post('/login.php', { form: { usuario, clave, csrf, r: '/' } });
  }
  async cambiarClave(actual, nueva, repetir) {
    const csrf = await this.csrfDe('/cambiar-clave.php');
    return this.post('/cambiar-clave.php', { form: { actual, nueva, repetir: repetir === undefined ? nueva : repetir, csrf, r: '/' } });
  }
  async config(accion, datos) {
    const l = await this.get('/configuracion/api.php?accion=listar');
    const csrf = l.j && l.j.csrf;
    return this.post('/configuracion/api.php', { json: Object.assign({ accion }, datos || {}), headers: { 'X-CSRF': csrf || '' } });
  }
  as(accion, datos) { return this.post('/after-school/api.php', { json: { accion, datos: datos || {} } }); }
  /* Como un navegador: sigue las redirecciones. Más de 8 seguidas = bucle. */
  async seguir(r) {
    const saltos = [];
    while (r.status >= 300 && r.status < 400 && r.location) {
      if (saltos.length >= 8) return Object.assign(r, { bucle: true, saltos });
      const destino = r.location.replace(/^https?:\/\/[^/]+/, '');
      saltos.push(destino);
      r = await this.get(destino);
    }
    return Object.assign(r, { bucle: false, saltos });
  }
  async entrarSiguiendo(usuario, clave) { return this.seguir(await this.entrar(usuario, clave)); }
}

/* ── La prueba ───────────────────────────────────────────────────────────── */

async function correr(fuente) {
  fuente = fuente || REPO;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const home = path.join(tmp, 'home'), web = path.join(home, 'portal');
  copiar(path.join(fuente, 'portal-raiz'), web);
  copiar(path.join(fuente, 'after-school'), path.join(web, 'after-school'));
  copiar(path.join(fuente, 'configuracion'), path.join(web, 'configuracion'));
  areasDeMentira(web);
  fs.writeFileSync(path.join(tmp, 'enrutador.php'), ENRUTADOR);
  // El enrutador lee este archivo en cada petición: se puede cambiar de .htaccess en plena prueba.
  const htActivo = path.join(tmp, 'htaccess-activo');
  const htNuevo = fs.readFileSync(path.join(web, 'htaccess.txt'), 'utf8');
  fs.writeFileSync(htActivo, htNuevo);

  const claves = {};                       // todas las contraseñas usadas: ninguna puede aparecer en registros
  for (const u of Object.keys(HEREDADOS)) claves[u] = clave();
  const huellas = {};
  for (const [u, c] of Object.entries(claves)) huellas[u] = huella(c);
  fs.writeFileSync(path.join(web, 'usuarios.php'), '<?php\nreturn [\n' +
    Object.entries(huellas).map(([u, h]) => '  ' + phpLiteral(u) + ' => ' + phpLiteral(h) + ',').join('\n') + '\n];\n');

  const google = await googleFalso();
  const puertoG = google.s.address().port;
  // Primero, roles_iniciales INCOMPLETO: a cuenta-general le falta el rol.
  const incompleto = Object.assign({}, HEREDADOS); delete incompleto['cuenta-general'];
  escribirConfig(home, incompleto, puertoG);

  const puerto = 20000 + Math.floor(Math.random() * 20000);
  let salidaPhp = '';
  const srv = spawn(PHP, ['-S', '127.0.0.1:' + puerto, '-t', web, path.join(tmp, 'enrutador.php')], {
    env: Object.assign({}, process.env, { PORTAL_WEB: web, PORTAL_HTACCESS: htActivo }) });
  srv.stdout.on('data', d => { salidaPhp += d; });
  srv.stderr.on('data', d => { salidaPhp += d; });
  const base = 'http://127.0.0.1:' + puerto;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/login.php'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }

  const cuentasF = path.join(home, 'portal_usuarios.json');
  const leerCuentas = () => JSON.parse(fs.readFileSync(cuentasF, 'utf8'));
  const limpiarIntentos = () => { const d = path.join(home, 'portal_sesiones'); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.startsWith('intentos_')) fs.unlinkSync(path.join(d, f)); };
  const temporales = [];

  try {
    seccion('migración: con roles_iniciales incompleto no se migra y nadie entra a medias');
    {
      const n = new Nav(base);
      const r = await n.entrar('admin-uno', claves['admin-uno']);
      ok(r.status === 200 && /mantenimiento/.test(r.texto), 'el login dice «mantenimiento» en vez de dejar entrar');
      ok(!/cuenta-general/.test(r.texto), 'la página pública no nombra usuarios (el detalle va al error_log)');
      ok(!fs.existsSync(cuentasF), 'no se escribió portal_usuarios.json');
    }

    seccion('migración: con roles_iniciales completo, los usuarios de siempre entran con su contraseña y su rol');
    escribirConfig(home, HEREDADOS, puertoG);
    const nav = {};
    for (const u of Object.keys(HEREDADOS)) {
      nav[u] = new Nav(base);
      const r = await nav[u].entrar(u, claves[u]);
      ok(r.status === 302 && r.location === '/', u + ' entra con su contraseña de siempre');
    }
    {
      const d = leerCuentas();
      ok(Object.keys(d.usuarios).sort().join() === Object.keys(HEREDADOS).sort().join(), 'portal_usuarios.json tiene a los cinco');
      for (const [u, roles] of Object.entries(HEREDADOS)) {
        ok(JSON.stringify(d.usuarios[u].roles) === JSON.stringify(roles), u + ' quedó con ' + roles.join(', '));
        ok(d.usuarios[u].hash === huellas[u], u + ' conserva su huella tal cual');
        ok(d.usuarios[u].activo === true && d.usuarios[u].cambiar_clave === false, u + ' activo y sin cambio obligatorio');
      }
      const a = await nav['admin-uno'].get('/acceso.php');
      ok(/window\.ACCESO = "\*"/.test(a.texto), 'acceso.php: un Administrador ve todas las tarjetas');
      const g = await nav['cuenta-general'].get('/acceso.php');
      ok(/window\.ACCESO = \["afterschool","basededatos"\]/.test(g.texto), 'acceso.php: Coordinación After School ve After School y Base de Datos (' + g.texto.split('\n')[0] + ')');
      // Un cambio posterior en usuarios.php ya no cuenta.
      fs.writeFileSync(path.join(web, 'usuarios.php'), '<?php return [];');
      const n = new Nav(base);
      ok((await n.entrar('admin-dos', claves['admin-dos'])).status === 302, 'migrado: usuarios.php ya no se lee');
    }

    seccion('archivos internos y raíz');
    {
      const n = new Nav(base);
      for (const f of ['auth.php', 'permisos.php', 'cuentas.php', 'usuarios.php', 'htaccess.txt'])
        ok((await n.get('/' + f)).status === 403, '/' + f + ' está prohibido');
      const g = await n.get('/generar-clave.php');
      ok(g.status === 302 && /login\.php/.test(g.location), 'generar-clave.php ya no se abre sin sesión (pasa por el control)');
      const w = await n.get('/.well-known/acme-challenge/ficha.txt');
      ok(w.status === 200 && w.texto === 'certificado', '.well-known queda libre, sin sesión (certificados)');
      ok((await n.get('/kinder/')).status === 302, 'sin sesión, una carpeta lleva al login');
    }

    seccion('crear cuentas por cargo: contraseña temporal, una sola vez, cambio obligatorio');
    const porRol = {
      'direccion': 'prueba-direccion', 'coordinacion_afterschool': 'prueba-coord-as', 'recepcion': 'prueba-recepcion',
      'comercial': 'prueba-comercial', 'contabilidad': 'prueba-contabilidad', 'coordinacion_preescolar': 'prueba-coord-pre',
      'profesor': 'prueba-profesor-1'
    };
    const admin = nav['admin-uno'];
    for (const [rol, u] of Object.entries(porRol)) {
      const r = await admin.config('crear', { usuario: u, roles: [rol] });
      ok(r.status === 200 && r.j && r.j.ok && typeof r.j.temporal === 'string' && r.j.temporal.length >= 10, 'se crea ' + u + ' (' + rol + ') con contraseña temporal');
      claves[u] = r.j && r.j.temporal; temporales.push(claves[u]);
      ok(!JSON.stringify(r.j.usuarios || []).includes(claves[u]), 'la lista no repite la temporal');
    }
    {
      const l = await admin.get('/configuracion/api.php?accion=listar');
      ok(!temporales.some(t => l.texto.includes(t)), 'listar nunca devuelve contraseñas');
      ok(!l.texto.includes('$2y$'), 'listar nunca devuelve huellas');
      const d = leerCuentas();
      ok(d.usuarios['prueba-recepcion'].cambiar_clave === true, 'la cuenta nueva queda con cambio obligatorio');
      ok(!temporales.some(t => fs.readFileSync(cuentasF, 'utf8').includes(t)), 'portal_usuarios.json no guarda la temporal en claro');
      const otra = await admin.config('crear', { usuario: 'prueba-recepcion', roles: ['recepcion'] });
      ok(otra.status === 400, 'no se crea dos veces el mismo usuario');
      const mal = await admin.config('crear', { usuario: 'Con Espacios', roles: ['recepcion'] });
      ok(mal.status === 400, 'el usuario tiene que ser por cargo: minúsculas, números y guiones');
      const sinRol = await admin.config('crear', { usuario: 'prueba-sin-rol', roles: [] });
      ok(sinRol.status === 400, 'hace falta al menos un rol');
      const rolRaro = await admin.config('crear', { usuario: 'prueba-raro', roles: ['superusuario'] });
      ok(rolRaro.status === 400, 'un rol que no existe se rechaza');
    }
    const n = {};
    for (const u of Object.values(porRol)) {
      n[u] = new Nav(base);
      const r = await n[u].entrar(u, claves[u]);
      ok(r.status === 302 && r.location.startsWith('/cambiar-clave.php'), u + ': con la temporal entra directo a cambiar la contraseña');
    }
    {
      const x = n['prueba-recepcion'];
      const p = await x.get('/');
      ok(p.status === 302 && p.location.startsWith('/cambiar-clave.php'), 'con contraseña temporal, la portada lleva a cambiarla');
      const a = await x.as('leer');
      ok(a.status === 403 && a.j && a.j.codigo === 'cambiar_clave', 'con contraseña temporal, api.php responde «cambiar_clave»');
      const k = await x.get('/kinder/');
      ok(k.status === 302 && k.location.startsWith('/cambiar-clave.php'), 'y cualquier carpeta también');
      const corta = await x.cambiarClave(claves['prueba-recepcion'], 'corta');
      ok(/al menos 10/.test(corta.texto), 'una contraseña de menos de 10 caracteres se rechaza');
      const distinta = await x.cambiarClave(claves['prueba-recepcion'], 'una-larga-1234', 'otra-larga-1234');
      ok(/no coinciden/.test(distinta.texto), 'las dos nuevas tienen que coincidir');
      const igual = await x.cambiarClave(claves['prueba-recepcion'], claves['prueba-recepcion']);
      ok(/distinta de la actual/.test(igual.texto), 'la nueva no puede ser la temporal');
      const mala = await x.cambiarClave('no-es-la-actual', 'una-larga-1234');
      ok(/actual no es correcta/.test(mala.texto), 'hay que dar la contraseña actual');
      const sinCsrf = await x.post('/cambiar-clave.php', { form: { actual: claves['prueba-recepcion'], nueva: 'una-larga-1234', repetir: 'una-larga-1234', r: '/' } });
      ok(/caducó/.test(sinCsrf.texto) && leerCuentas().usuarios['prueba-recepcion'].cambiar_clave === true, 'sin token CSRF no se cambia');
    }
    for (const u of Object.values(porRol)) {
      const nueva = clave();
      const r = await n[u].cambiarClave(claves[u], nueva);
      ok(r.status === 302 && r.location === '/', u + ': cambia la temporal por una propia y sigue');
      ok(leerCuentas().usuarios[u].cambiar_clave === false, u + ': ya no tiene cambio obligatorio');
      const vieja = claves[u]; claves[u] = nueva;
      limpiarIntentos();
      const otra = new Nav(base);
      ok((await otra.entrar(u, vieja)).status === 200, u + ': la temporal ya no sirve');
      limpiarIntentos();
    }
    for (const [u] of Object.entries(HEREDADOS)) n[u] = nav[u];

    for (const [nombreHt, contenido, u] of [['el .htaccess nuevo', htNuevo, 'prueba-recorrido'], ['el .htaccess ANTERIOR (publicación a medias)', HTACCESS_ANTERIOR, 'prueba-recorrido-viejo']]) {
      seccion('recorrido real con contraseña temporal, como un navegador, con ' + nombreHt);
      const c = await nav['admin-uno'].config('crear', { usuario: u, roles: ['recepcion'] });
      const temporal = c.j && c.j.temporal; temporales.push(temporal);
      fs.writeFileSync(htActivo, contenido);
      try {
        const x = new Nav(base);
        const e = await x.entrarSiguiendo(u, temporal);
        ok(!e.bucle && e.status === 200 && /Crea tu contraseña/.test(e.texto), 'login con la temporal → carga cambiar-clave.php (' + e.status + ', ' + e.saltos.length + ' saltos' + (e.bucle ? ', BUCLE: ' + e.saltos[2] : '') + ')');
        const p = await x.seguir(await x.get('/'));
        ok(!p.bucle && p.status === 200 && /Crea tu contraseña/.test(p.texto), 'la portada lo devuelve a cambiar-clave.php, sin bucle');
        const k = await x.seguir(await x.get('/after-school/'));
        ok(!k.bucle && /Crea tu contraseña/.test(k.texto), 'After School también, sin bucle');
        const s = await x.seguir(await x.get('/logout.php'));
        ok(!s.bucle && s.status === 200 && /Cerraste sesión/.test(s.texto), 'Cerrar sesión funciona con la temporal');
        await x.entrarSiguiendo(u, temporal);
        const nueva = clave();
        const csrf = await x.csrfDe('/cambiar-clave.php');
        const f = await x.seguir(await x.post('/cambiar-clave.php', { form: { actual: temporal, nueva, repetir: nueva, csrf, r: '/' } }));
        ok(!f.bucle && f.status === 200 && /UNIDADES DE NEGOCIO/.test(f.texto), 'tras cambiarla, termina en la portada');
        ok(leerCuentas().usuarios[u].cambiar_clave === false, 'y la cuenta ya no tiene cambio obligatorio');
        claves[u] = nueva;
      } finally {
        fs.writeFileSync(htActivo, htNuevo);
      }
    }

    seccion('áreas: cada rol abre solo lo suyo (y la URL directa responde sin permiso)');
    {
      const R = {
        'admin-uno':           { kinder: 1, veranito: 1, as: 1, bd: 1, conf: 1, cgi: 1, baby: 1, cumple: 1, nueva: 1 },
        'prueba-direccion':    { kinder: 1, veranito: 1, as: 1, bd: 1, conf: 1, cgi: 1, baby: 1, cumple: 1, nueva: 1 },
        'prueba-coord-as':     { as: 1, bd: 1 },
        'prueba-recepcion':    { as: 1 },
        'prueba-comercial':    { kinder: 1, as: 1, bd: 1 },
        'prueba-contabilidad': { as: 1 },
        'prueba-coord-pre':    { kinder: 1, bd: 1 },
        'prueba-profesor-1':   {}
      };
      const RUTAS = { kinder: ['/kinder/', '/kinder/csv.php'], veranito: ['/veranito/'], as: ['/after-school/'], bd: ['/basededatos/', '/basededatos/api.php'],
        conf: ['/configuracion/', '/configuracion/api.php?accion=listar'], cgi: ['/cgi-bin/'], baby: ['/baby-and-me/'], cumple: ['/cumpleanos/'], nueva: ['/carpeta-nueva/'] };
      for (const [u, puede] of Object.entries(R)) {
        for (const [k, rutas] of Object.entries(RUTAS)) for (const ruta of rutas) {
          const r = await n[u].get(ruta);
          const esperado = puede[k] ? 200 : 403;
          ok(r.status === esperado, u + ' ' + ruta + ' → ' + esperado + ' (dio ' + r.status + ')');
          if (!puede[k] && /\.php/.test(ruta)) ok(r.j && r.j.codigo === 'sin_permiso', u + ' ' + ruta + ': el puente responde JSON «sin_permiso»');
        }
        ok((await n[u].get('/raiz.txt')).status === 200, u + ': los archivos de la raíz (portada) se abren con sesión');
      }
      const ac = await n['prueba-profesor-1'].get('/acceso.php');
      ok(/window\.ACCESO = \[\];/.test(ac.texto), 'Profesor: la portada no muestra ninguna tarjeta');
      const co = await n['prueba-comercial'].get('/acceso.php');
      ok(/window\.ACCESO = \["kinder","afterschool","basededatos"\]/.test(co.texto), 'Comercial: Kínder, After School y Base de Datos');
      const di = await n['prueba-direccion'].get('/acceso.php');
      ok(/window\.ACCESO = "\*"/.test(di.texto), 'Dirección: todas las tarjetas, Configuración incluida');
    }

    seccion('After School: cada acción según el rol; las prohibidas no llegan al Apps Script');
    {
      const ACCIONES = ['leer', 'listarPagos', 'crearNino', 'editarNino', 'inscribir', 'inscribirVarias', 'mover', 'bajaClase', 'bajaTotal',
        'registrarPago', 'revisar', 'notaInscripcion', 'agendarPrueba', 'resultadoPrueba', 'pagoPrueba', 'accionInventada'];
      const COMPLETO = new Set(ACCIONES);
      const R = {
        'admin-uno': COMPLETO, 'prueba-direccion': COMPLETO, 'prueba-coord-as': COMPLETO, 'prueba-recepcion': COMPLETO,
        'prueba-comercial': new Set(['leer', 'agendarPrueba']),
        'prueba-contabilidad': new Set(['leer', 'listarPagos', 'registrarPago', 'pagoPrueba']),
        'prueba-coord-pre': new Set(), 'prueba-profesor-1': new Set()
      };
      for (const [u, permitidas] of Object.entries(R)) {
        for (const a of ACCIONES) {
          const antes = google.llamadas.length;
          const r = await n[u].as(a, { idNino: 'AS-0001' });
          const llego = google.llamadas.length - antes;
          if (permitidas.has(a)) ok(r.status === 200 && llego === 1, u + ' puede ' + a);
          else ok(r.status === 403 && r.j && /^(sin_permiso)$/.test(r.j.codigo) && llego === 0, u + ' NO puede ' + a + ' (403 sin_permiso, no llega al Apps Script; dio ' + r.status + ')');
        }
      }
      const forz = await n['prueba-comercial'].post('/after-school/api.php', { json: { accion: 'inscribir', datos: {}, key: 'otra', usuario: 'admin-uno' } });
      ok(forz.status === 403, 'forzar la llamada mandando otro usuario o clave no da permiso');
      await n['prueba-contabilidad'].post('/after-school/api.php', { json: { accion: 'registrarPago', datos: {}, key: 'otra', usuario: 'admin-uno' } });
      const ult = google.llamadas[google.llamadas.length - 1];
      ok(ult.usuario === 'prueba-contabilidad' && ult.key === 'clave-de-prueba', 'el usuario y la clave que llegan al Apps Script los pone el servidor');
    }

    seccion('After School: contactos y pagos según el rol');
    {
      const leer = async u => (await n[u].as('leer')).j;
      const nino = (j, id) => j.resultado.ninos.find(x => x.id === id);
      const a = await leer('admin-uno');
      ok(nino(a, 'AS-0001').telefono === '555-0101' && nino(a, 'AS-0001').correo === 'uno@ejemplo.test', 'Administrador ve todos los contactos');
      ok(a.resultado.pagosMes.length === 1, 'Administrador ve los pagos del mes');
      ok(Array.isArray(a.permisos) && a.permisos.includes('as.completo'), 'la respuesta trae los permisos para la página');
      const r = await leer('prueba-recepcion');
      ok(nino(r, 'AS-0001').telefono === '555-0101', 'Recepción ve todos los contactos');
      const c = await leer('prueba-comercial');
      ok(!('telefono' in nino(c, 'AS-0001')) && !('correo' in nino(c, 'AS-0001')) && !('telefono2' in nino(c, 'AS-0001')) && !('telefonoResp2' in nino(c, 'AS-0001')),
        'Comercial no recibe contactos de un niño Activo');
      ok(nino(c, 'AS-0002').telefono === '555-0201' && nino(c, 'AS-0002').correo === 'dos@ejemplo.test', 'Comercial sí recibe los de un Prospecto');
      ok(c.resultado.pagosMes.length === 0, 'Comercial no recibe los pagos del mes');
      ok(JSON.stringify(c.permisos) === JSON.stringify(['as.ver', 'as.pruebas.ver', 'as.pruebas.agendar']), 'permisos de Comercial: ' + JSON.stringify(c.permisos));
      const k = await leer('prueba-contabilidad');
      ok(k.resultado.ninos.every(x => !('telefono' in x) && !('correo' in x) && !('telefono2' in x) && !('telefonoResp2' in x)), 'Contabilidad no recibe ningún contacto');
      ok(nino(k, 'AS-0001').responsable === 'Responsable Uno', 'Contabilidad sí ve el nombre del responsable');
      ok(k.resultado.pagosMes.length === 1, 'Contabilidad ve los pagos del mes');
      ok(JSON.stringify(k.permisos) === JSON.stringify(['as.ver', 'as.pruebas.ver', 'as.pruebas.pago', 'as.pagos.ver', 'as.pagos.registrar']), 'permisos de Contabilidad: ' + JSON.stringify(k.permisos));
      const e = (await n['prueba-comercial'].as('agendarPrueba', {})).j;
      ok(e.estado.ninos.every(x => x.estado === 'Prospecto' || !('telefono' in x)), 'también se recortan los contactos del estado que devuelve una escritura');
      ok(e.estado.pagosMes.length === 0, 'y los pagos de ese estado');
      ok(e.resultado.telefono === '555-0301', 'el prospecto recién creado sí trae su teléfono para Comercial');
      const pg = (await n['prueba-contabilidad'].as('registrarPago', {})).j;
      ok(!('telefono' in pg.resultado), 'en la respuesta de una escritura de Contabilidad tampoco hay contactos');
      ok(typeof e.estado.config === 'object' && !Array.isArray(e.estado.config), 'un objeto vacío {} sigue siendo objeto después del recorte');
    }

    seccion('Configuración: Dirección no toca cuentas de Administrador');
    {
      const d = n['prueba-direccion'];
      const pruebas = [
        ['crear', { usuario: 'prueba-otro-admin', roles: ['administrador'] }, 'crear una cuenta Administrador'],
        ['crear', { usuario: 'prueba-mixta', roles: ['recepcion', 'administrador'] }, 'crear una cuenta con Administrador entre sus roles'],
        ['roles', { usuario: 'admin-dos', roles: ['recepcion'] }, 'cambiar los roles de un Administrador'],
        ['roles', { usuario: 'prueba-recepcion', roles: ['recepcion', 'administrador'] }, 'asignar el rol Administrador'],
        ['desactivar', { usuario: 'admin-dos' }, 'desactivar a un Administrador'],
        ['reiniciar', { usuario: 'admin-dos' }, 'reiniciar la contraseña de un Administrador']
      ];
      for (const [acc, datos, que] of pruebas) {
        const r = await d.config(acc, datos);
        ok(r.status === 403, 'Dirección NO puede ' + que + ' (dio ' + r.status + ')');
      }
      ok(leerCuentas().usuarios['admin-dos'].activo === true && leerCuentas().usuarios['admin-dos'].roles.includes('administrador'), 'admin-dos sigue intacto');
      ok(!leerCuentas().usuarios['prueba-otro-admin'] && !leerCuentas().usuarios['prueba-mixta'], 'no se creó ninguna cuenta Administrador');
      // Reactivar a un Administrador desactivado tampoco.
      ok((await n['admin-uno'].config('desactivar', { usuario: 'admin-tres' })).status === 200, 'un Administrador sí desactiva a otro');
      ok((await d.config('reactivar', { usuario: 'admin-tres' })).status === 403, 'Dirección NO puede reactivar a un Administrador');
      ok((await n['admin-uno'].config('reactivar', { usuario: 'admin-tres' })).status === 200, 'un Administrador sí lo reactiva');
      // Lo que sí puede Dirección.
      const c = await d.config('crear', { usuario: 'prueba-hecha-por-direccion', roles: ['recepcion'] });
      ok(c.status === 200 && c.j.temporal, 'Dirección sí crea cuentas sin rol Administrador');
      temporales.push(c.j && c.j.temporal);
      ok((await d.config('roles', { usuario: 'prueba-hecha-por-direccion', roles: ['recepcion', 'comercial'] })).status === 200, 'y les cambia los roles');
      ok((await d.config('reiniciar', { usuario: 'prueba-hecha-por-direccion' })).status === 200, 'y les reinicia la contraseña');
      ok((await d.config('desactivar', { usuario: 'prueba-hecha-por-direccion' })).status === 200, 'y las desactiva');
      ok((await d.config('reactivar', { usuario: 'prueba-hecha-por-direccion' })).status === 200, 'y las reactiva');
      ok((await d.config('roles', { usuario: 'prueba-direccion', roles: ['recepcion'] })).status === 403, 'nadie se cambia sus propios roles');
      ok((await n['admin-uno'].config('desactivar', { usuario: 'admin-uno' })).status === 403, 'nadie se desactiva a sí mismo');
      const ev = leerCuentas().eventos.map(e => e.accion + ':' + e.usuario + ':' + e.quien);
      ok(ev.includes('crear:prueba-hecha-por-direccion:prueba-direccion'), 'cada cambio queda anotado con quién lo hizo');
      for (const u of ['prueba-comercial', 'prueba-contabilidad', 'prueba-recepcion', 'prueba-profesor-1']) {
        const r = await n[u].config('crear', { usuario: 'prueba-intruso', roles: ['administrador'] });
        ok(r.status === 403, u + ' no puede usar Configuración aunque fuerce la llamada');
      }
    }

    seccion('regla del último Administrador activo');
    {
      const script = path.join(tmp, 'ultimo-admin.php');
      fs.writeFileSync(script, `<?php
require '${web.replace(/\\/g, '/')}/permisos.php';
require '${web.replace(/\\/g, '/')}/cuentas.php';
// actor: Administrador desactivado (el único caso en que alguien con permiso puede tocar al último activo)
$d = ['usuarios' => [
  'actor' => ['roles' => ['administrador'], 'activo' => false],
  'unico' => ['roles' => ['administrador'], 'activo' => true],
  'otro'  => ['roles' => ['recepcion'], 'activo' => true],
]];
$r = [];
foreach ([['desactivar', null], ['roles', ['recepcion']], ['roles', ['administrador', 'recepcion']], ['reiniciar', null]] as [$a, $roles]) {
  try { exigir_puede_tocar($d, 'actor', $a, 'unico', $roles); $r[] = $a . ':permitido'; }
  catch (ErrorCuentas $e) { $r[] = $a . ':rechazado'; }
}
echo implode(',', $r);
`);
      const r = spawnSync(PHP, [script], { encoding: 'utf8' });
      ok(r.stdout === 'desactivar:rechazado,roles:rechazado,roles:permitido,reiniciar:permitido',
        'al último Administrador activo no se le desactiva ni se le quita el rol; sí se le pueden sumar roles o reiniciar (dio ' + r.stdout + r.stderr + ')');
      ok((await n['admin-uno'].config('desactivar', { usuario: 'admin-dos' })).status === 200, '(control) con varios Administradores, uno desactiva a otro');
      ok((await n['admin-uno'].config('reactivar', { usuario: 'admin-dos' })).status === 200, '(control) y lo reactiva');
    }

    seccion('CSRF');
    {
      const a = n['admin-uno'];
      const sin = await a.post('/configuracion/api.php', { json: { accion: 'crear', usuario: 'prueba-csrf', roles: ['recepcion'] } });
      ok(sin.status === 403 && sin.j && sin.j.codigo === 'csrf', 'Configuración sin token CSRF: 403');
      const malo = await a.post('/configuracion/api.php', { json: { accion: 'crear', usuario: 'prueba-csrf', roles: ['recepcion'] }, headers: { 'X-CSRF': 'falso' } });
      ok(malo.status === 403, 'Configuración con un token falso: 403');
      const ajena = new Nav(base); await ajena.entrar('admin-dos', claves['admin-dos']);
      const csrfAjeno = (await ajena.get('/configuracion/api.php?accion=listar')).j.csrf;
      const cruzado = await a.post('/configuracion/api.php', { json: { accion: 'crear', usuario: 'prueba-csrf', roles: ['recepcion'] }, headers: { 'X-CSRF': csrfAjeno } });
      ok(cruzado.status === 403, 'el token de otra sesión no sirve');
      ok(!leerCuentas().usuarios['prueba-csrf'], 'no se creó nada');
      const l = new Nav(base);
      await l.get('/login.php');
      const r = await l.post('/login.php', { form: { usuario: 'admin-uno', clave: claves['admin-uno'], r: '/' } });
      ok(r.status === 200 && /caducó/.test(r.texto), 'el login sin token CSRF no entra');
      limpiarIntentos();
    }

    seccion('desactivar y reactivar');
    {
      const u = 'prueba-recepcion';
      ok((await n['admin-uno'].config('desactivar', { usuario: u })).status === 200, 'se desactiva ' + u);
      const r = await n[u].get('/after-school/');
      ok(r.status === 302 && /login\.php/.test(r.location), 'su sesión abierta se corta en la siguiente página');
      const x = await n[u].as('leer');
      ok(x.status === 302, 'y api.php ya no le responde');
      const otra = new Nav(base);
      const e = await otra.entrar(u, claves[u]);
      ok(e.status === 200 && /incorrectos/.test(e.texto), 'una cuenta desactivada no entra (mismo mensaje que una contraseña mala)');
      limpiarIntentos();
      ok((await n['admin-uno'].config('reactivar', { usuario: u })).status === 200, 'se reactiva');
      ok((await n[u].entrar(u, claves[u])).status === 302, 'y vuelve a entrar con su contraseña de antes');
    }

    seccion('reiniciar contraseña');
    {
      const u = 'prueba-comercial';
      const r = await n['admin-uno'].config('reiniciar', { usuario: u });
      ok(r.status === 200 && r.j.temporal && r.j.temporal !== claves[u], 'se genera otra temporal');
      temporales.push(r.j.temporal);
      ok((await n[u].get('/kinder/')).status === 302, 'la sesión abierta se corta');
      limpiarIntentos();
      const vieja = new Nav(base);
      ok((await vieja.entrar(u, claves[u])).status === 200, 'la contraseña anterior ya no sirve');
      limpiarIntentos();
      const t = await n[u].entrar(u, r.j.temporal);
      ok(t.status === 302 && t.location.startsWith('/cambiar-clave.php'), 'con la temporal hay que cambiarla otra vez');
      const nueva = clave();
      ok((await n[u].cambiarClave(r.j.temporal, nueva)).status === 302, 'y queda con una propia');
      claves[u] = nueva;
    }

    seccion('cambiar mi contraseña (cualquier usuario) corta sus otras sesiones');
    {
      const u = 'prueba-contabilidad';
      const otra = new Nav(base); await otra.entrar(u, claves[u]);
      ok((await otra.get('/after-school/')).status === 200, '(control) la otra sesión funciona');
      const nueva = clave();
      const r = await n[u].cambiarClave(claves[u], nueva);
      ok(r.status === 200 && /tu contraseña cambió/.test(r.texto), 'cambio voluntario: confirma y se queda en la página');
      ok((await n[u].get('/after-school/')).status === 200, 'esta sesión sigue');
      ok((await otra.get('/after-school/')).status === 302, 'la otra sesión del mismo usuario se corta');
      claves[u] = nueva;
    }

    seccion('se mantiene el bloqueo de 5 fallos por conexión');
    {
      limpiarIntentos();
      const x = new Nav(base);
      for (let i = 0; i < 5; i++) await x.entrar('admin-uno', 'mala-' + i);
      const r = await x.entrar('admin-uno', claves['admin-uno']);
      ok(/Demasiados intentos/.test(r.texto), 'tras 5 fallos, ni la contraseña buena entra durante 15 minutos');
      limpiarIntentos();
    }

    seccion('ninguna contraseña en registros ni en el archivo de cuentas');
    {
      const todas = Object.values(claves).concat(temporales).filter(Boolean);
      ok(!todas.some(c => salidaPhp.includes(c)), 'la salida del servidor (error_log) no tiene contraseñas');
      const archivo = fs.readFileSync(cuentasF, 'utf8');
      ok(!todas.some(c => archivo.includes(c)), 'portal_usuarios.json solo tiene huellas');
      ok((fs.statSync(cuentasF).mode & 0o077) === 0 || process.platform === 'win32', 'portal_usuarios.json no es legible por otros (0600)');
    }
  } finally {
    srv.kill();
    google.s.close();
  }
  console.log('\n' + (fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan'));
  return fallos === 0;
}

module.exports = { correr };

if (require.main === module) {
  correr(process.argv[2]).then(b => process.exit(b ? 0 : 1), e => { console.error(e); process.exit(1); });
}
