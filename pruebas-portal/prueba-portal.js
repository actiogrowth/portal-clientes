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
/* En GitHub Actions cada fallo sale también como anotación (::error): las
   anotaciones se leen sin iniciar sesión; el registro completo, no. */
const anotar = t => { if (process.env.GITHUB_ACTIONS) console.log('::error title=prueba-portal::' + String(t).replace(/%/g, '%25').replace(/\r?\n/g, '%0A')); };
const ok = (cond, que) => { total++; if (!cond) { fallos++; console.log('  ✗ ' + que); if (fallos <= 9) anotar(que); } };
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
  // Un PHP subido por error a comun/: nunca se tiene que ejecutar ni entregar.
  for (const f of ['prueba.php', 'api.php']) fs.writeFileSync(path.join(web, 'comun', f), '<?php echo "EJ" . "ECUTADO";');
  fs.mkdirSync(path.join(web, 'comun', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(web, 'comun', 'sub', 'x.css'), 'body{}');
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
      llamadas.push({ accion: j.accion, usuario: j.usuario, key: j.key, datos: j.datos || {} });
      let r;
      if (j.accion === 'leer') r = { ok: true, resultado: ESTADO() };
      // Pasar lista: el script falso manda DE MÁS (contactos, el estado entero)
      // para comprobar que pasar-lista/api.php lo recorta.
      else if (j.accion === 'leerLista') r = { ok: true, estado: ESTADO(), resultado: { fecha: '2026-10-19', hoy: '2026-10-19', dia: 'Lunes', otroDia: true, estados: ['Presente'], secreto: 'x',
        clases: [{ codigo: 'LUN-1630-PARKOUR', servicio: 'Parkour', hora: '16:30', guardada: false, sinClase: false, cupo: 20, modalidad: 'Semana',
          ninos: [{ idNino: 'AS-0001', nombre: 'Inventado Uno', edad: '8 años', presencia: 'Inscrito', idVisita: '', estado: '', nota: '',
                    telefono: '555-0101', correo: 'uno@ejemplo.test', responsable: 'Responsable Uno', nacimiento: '2018-01-01' }],
          fueraDeLista: [{ idAsistencia: 'ASI-0001', nombre: 'Escrito', estado: 'Presente', nota: '', telefono: '555-0999' }] }] } };
      else if (j.accion === 'guardarLista') r = { ok: true, estado: ESTADO(), resultado: { fecha: '2026-10-19', codigo: 'LUN-1630-PARKOUR', nuevas: 1, corregidas: 0, visitasMarcadas: 0, secreto: 'x' } };
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
  /* 21-oct (rediseño): login y cambio de contraseña son páginas fijas que
     hablan con login.php y cambiar-clave.php por JSON; aquí se hace lo mismo
     que hace comun/datos.js. */
  async csrfLogin() { const r = await this.get('/login.php?estado=1'); return (r.j && r.j.csrf) || ''; }
  async entrar(usuario, clave, pedido) {
    const csrf = await this.csrfLogin();
    const r = await this.post('/login.php', { json: { usuario, clave, csrf, r: pedido || '/' } });
    return Object.assign(r, { ok: !!(r.j && r.j.ok), destino: (r.j && r.j.destino) || '', codigo: (r.j && r.j.codigo) || '' });
  }
  async csrfClave() { const r = await this.get('/cambiar-clave.php?estado=1'); return (r.j && r.j.csrf) || ''; }
  async cambiarClave(actual, nueva, repetir, pedido) {
    const csrf = await this.csrfClave();
    const r = await this.post('/cambiar-clave.php', { json: { actual, nueva, repetir: repetir === undefined ? nueva : repetir, csrf, r: pedido || '/' } });
    return Object.assign(r, { ok: !!(r.j && r.j.ok), destino: (r.j && r.j.destino) || '', codigo: (r.j && r.j.codigo) || '' });
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
  /* Como el navegador: entra y va a donde dice el servidor, siguiendo redirecciones. */
  async entrarSiguiendo(usuario, clave) { const r = await this.entrar(usuario, clave); return r.ok ? this.seguir(await this.get(r.destino)) : Object.assign(r, { bucle: false, saltos: [] }); }
}

/* ── La prueba ───────────────────────────────────────────────────────────── */

async function correr(fuente) {
  fuente = fuente || REPO;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const home = path.join(tmp, 'home'), web = path.join(home, 'portal');
  copiar(path.join(fuente, 'portal-raiz'), web);
  copiar(path.join(fuente, 'after-school'), path.join(web, 'after-school'));
  copiar(path.join(fuente, 'configuracion'), path.join(web, 'configuracion'));
  copiar(path.join(fuente, 'pasar-lista'), path.join(web, 'pasar-lista'));
  copiar(path.join(fuente, 'comun'), path.join(web, 'comun'));
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
      ok(r.status === 503 && r.codigo === 'mantenimiento', 'el login dice «mantenimiento» en vez de dejar entrar');
      ok((await n.get('/login.php?estado=1')).j.mantenimiento === true, 'y la página de login lo sabe antes de escribir nada');
      ok(!/cuenta-general/.test(r.texto), 'la página pública no nombra usuarios (el detalle va al error_log)');
      ok(!fs.existsSync(cuentasF), 'no se escribió portal_usuarios.json');
    }

    seccion('migración: con roles_iniciales completo, los usuarios de siempre entran con su contraseña y su rol');
    escribirConfig(home, HEREDADOS, puertoG);
    const nav = {};
    for (const u of Object.keys(HEREDADOS)) {
      nav[u] = new Nav(base);
      const r = await nav[u].entrar(u, claves[u]);
      ok(r.ok && r.destino === '/', u + ' entra con su contraseña de siempre (y va a la portada: tiene varias secciones)');
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
      ok(/window\.ACCESO = \["afterschool","basededatos"\]/.test(g.texto), 'acceso.php: Coordinación After School ve After School y Base de Datos (Pasar lista ya no es tarjeta) (' + g.texto.split('\n')[0] + ')');
      // Un cambio posterior en usuarios.php ya no cuenta.
      fs.writeFileSync(path.join(web, 'usuarios.php'), '<?php return [];');
      const n = new Nav(base);
      ok((await n.entrar('admin-dos', claves['admin-dos'])).ok, 'migrado: usuarios.php ya no se lee');
    }

    seccion('archivos internos y raíz');
    {
      const n = new Nav(base);
      for (const f of ['auth.php', 'permisos.php', 'cuentas.php', 'usuarios.php', 'htaccess.txt'])
        ok((await n.get('/' + f)).status === 403, '/' + f + ' está prohibido');
      const g = await n.get('/generar-clave.php');
      ok(g.status === 302 && /login\.html/.test(g.location), 'generar-clave.php ya no se abre sin sesión (pasa por el control)');
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
      ok(r.ok && r.destino.startsWith('/cambiar-clave.html'), u + ': con la temporal entra directo a cambiar la contraseña');
    }
    {
      const x = n['prueba-recepcion'];
      const p = await x.get('/');
      ok(p.status === 302 && p.location.startsWith('/cambiar-clave.html'), 'con contraseña temporal, la portada lleva a cambiarla');
      const a = await x.as('leer');
      ok(a.status === 403 && a.j && a.j.codigo === 'cambiar_clave', 'con contraseña temporal, api.php responde «cambiar_clave»');
      const k = await x.get('/kinder/');
      ok(k.status === 302 && k.location.startsWith('/cambiar-clave.html'), 'y cualquier carpeta también');
      const est = await x.get('/cambiar-clave.php?estado=1');
      ok(est.j && est.j.ok && est.j.obligatorio === true && est.j.usuario === 'prueba-recepcion', 'cambiar-clave.php sabe que la contraseña es temporal');
      const corta = await x.cambiarClave(claves['prueba-recepcion'], 'corta');
      ok(corta.codigo === 'corta' && /al menos 10/.test(corta.texto), 'una contraseña de menos de 10 caracteres se rechaza');
      const distinta = await x.cambiarClave(claves['prueba-recepcion'], 'una-larga-1234', 'otra-larga-1234');
      ok(distinta.codigo === 'distintas', 'las dos nuevas tienen que coincidir');
      const igual = await x.cambiarClave(claves['prueba-recepcion'], claves['prueba-recepcion']);
      ok(igual.codigo === 'igual', 'la nueva no puede ser la temporal');
      const mala = await x.cambiarClave('no-es-la-actual', 'una-larga-1234');
      ok(mala.codigo === 'actual', 'hay que dar la contraseña actual');
      const sinCsrf = await x.post('/cambiar-clave.php', { json: { actual: claves['prueba-recepcion'], nueva: 'una-larga-1234', repetir: 'una-larga-1234', r: '/' } });
      ok(sinCsrf.status === 403 && sinCsrf.j.codigo === 'csrf' && leerCuentas().usuarios['prueba-recepcion'].cambiar_clave === true, 'sin token CSRF no se cambia');
    }
    /* Tras cambiar la temporal, cada uno va a su inicio: si abre UNA sola sección, directo a ella. */
    const INICIO = { 'prueba-direccion': '/', 'prueba-coord-as': '/', 'prueba-recepcion': '/after-school/', 'prueba-comercial': '/',
                     'prueba-contabilidad': '/after-school/', 'prueba-coord-pre': '/', 'prueba-profesor-1': '/after-school/' };
    for (const u of Object.values(porRol)) {
      const nueva = clave();
      const r = await n[u].cambiarClave(claves[u], nueva);
      ok(r.ok && r.j.obligatorio === true && r.destino === INICIO[u], u + ': cambia la temporal por una propia y va a su inicio (' + r.destino + ')');
      ok(leerCuentas().usuarios[u].cambiar_clave === false, u + ': ya no tiene cambio obligatorio');
      const vieja = claves[u]; claves[u] = nueva;
      limpiarIntentos();
      const otra = new Nav(base);
      ok(!(await otra.entrar(u, vieja)).ok, u + ': la temporal ya no sirve');
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
        ok(!e.bucle && e.status === 200 && /<title>Cambiar contraseña/.test(e.texto), 'login con la temporal → carga cambiar-clave.html (' + e.status + ', ' + (e.saltos || []).length + ' saltos' + (e.bucle ? ', BUCLE: ' + e.saltos[2] : '') + ')');
        const p = await x.seguir(await x.get('/'));
        ok(!p.bucle && p.status === 200 && /<title>Cambiar contraseña/.test(p.texto), 'la portada lo devuelve a cambiar-clave.html, sin bucle');
        const k = await x.seguir(await x.get('/after-school/'));
        ok(!k.bucle && /<title>Cambiar contraseña/.test(k.texto), 'After School también, sin bucle');
        const css = await x.get('/comun/vea.css');
        ok(css.status === 200 && /--rojo: #D71C0E/.test(css.texto), 'los estilos compartidos se entregan');
        const s = await x.seguir(await x.get('/logout.php'));
        ok(!s.bucle && s.status === 200 && /<title>Entrar · Vida en Arte/.test(s.texto), 'Cerrar sesión funciona con la temporal y termina en el login');
        ok((await x.get('/login.php?estado=1')).j.conSesion === false, 'y la sesión quedó cerrada');
        await x.entrar(u, temporal);
        const nueva = clave();
        const f0 = await x.cambiarClave(temporal, nueva);
        ok(f0.ok && f0.destino === '/after-school/', 'tras cambiarla va a su inicio (Recepción: After School)');
        const f = await x.seguir(await x.get(f0.destino));
        ok(!f.bucle && f.status === 200 && /<title>After School · Vida en Arte/.test(f.texto), 'y After School carga, sin bucle');
        ok(leerCuentas().usuarios[u].cambiar_clave === false, 'y la cuenta ya no tiene cambio obligatorio');
        claves[u] = nueva;
      } finally {
        fs.writeFileSync(htActivo, htNuevo);
      }
    }

    seccion('áreas: cada rol abre solo lo suyo (y la URL directa responde sin permiso)');
    {
      const R = {
        'admin-uno':           { kinder: 1, veranito: 1, as: 1, bd: 1, conf: 1, cgi: 1, baby: 1, cumple: 1, nueva: 1, pl: 1 },
        'prueba-direccion':    { kinder: 1, veranito: 1, as: 1, bd: 1, conf: 1, cgi: 1, baby: 1, cumple: 1, nueva: 1, pl: 1 },
        'prueba-coord-as':     { as: 1, bd: 1, pl: 1 },
        'prueba-recepcion':    { as: 1 },
        'prueba-comercial':    { kinder: 1, as: 1, bd: 1 },
        'prueba-contabilidad': { as: 1 },
        'prueba-coord-pre':    { kinder: 1, bd: 1 },
        'prueba-profesor-1':   { as: 1, pl: 1 }
      };
      const RUTAS = { kinder: ['/kinder/', '/kinder/csv.php'], veranito: ['/veranito/'], as: ['/after-school/'], bd: ['/basededatos/', '/basededatos/api.php'],
        conf: ['/configuracion/', '/configuracion/api.php?accion=listar'], cgi: ['/cgi-bin/'], baby: ['/baby-and-me/'], cumple: ['/cumpleanos/'], nueva: ['/carpeta-nueva/'],
        pl: ['/pasar-lista/'] };
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
      ok(/window\.ACCESO = \["afterschool"\];/.test(ac.texto), 'Profesor: la portada solo tendría After School (entra directo a Pasar lista)');
      const co = await n['prueba-comercial'].get('/acceso.php');
      ok(/window\.ACCESO = \["kinder","afterschool","basededatos"\]/.test(co.texto), 'Comercial: Preschool, After School y Base de Datos');
      const di = await n['prueba-direccion'].get('/acceso.php');
      ok(/window\.ACCESO = "\*"/.test(di.texto), 'Dirección: todas las tarjetas, Configuración incluida');
    }

    seccion('rediseño: a dónde va cada rol, pestaña de entrada y Pasar lista dentro de After School');
    {
      const ESPERA = {
        'admin-uno':           { inicio: '/', inicioAS: 'ocupacion' },
        'prueba-direccion':    { inicio: '/', inicioAS: 'ocupacion' },
        'prueba-coord-as':     { inicio: '/', inicioAS: 'ocupacion' },
        'prueba-recepcion':    { inicio: '/after-school/', inicioAS: 'pruebas' },
        'prueba-comercial':    { inicio: '/', inicioAS: 'pruebas' },
        'prueba-contabilidad': { inicio: '/after-school/', inicioAS: 'pagos' },
        'prueba-coord-pre':    { inicio: '/', inicioAS: 'ocupacion' },
        'prueba-profesor-1':   { inicio: '/after-school/', inicioAS: 'lista' }
      };
      for (const [u, e] of Object.entries(ESPERA)) {
        const a = await n[u].get('/acceso.php?formato=json');
        ok(a.j && a.j.ok && a.j.usuario === u && a.j.inicio === e.inicio && a.j.inicioAS === e.inicioAS,
          u + ': empieza en ' + e.inicio + ' y After School abre en «' + e.inicioAS + '» (dio ' + (a.j && a.j.inicio) + ', ' + (a.j && a.j.inicioAS) + ')');
      }
      const prof = (await n['prueba-profesor-1'].get('/acceso.php?formato=json')).j;
      ok(JSON.stringify(prof.permisosAS.slice().sort()) === '["as.lista.marcar","as.lista.ver"]' && JSON.stringify(prof.areas) === '["afterschool"]',
        'Profesor: solo los permisos de Pasar lista (' + JSON.stringify(prof.permisosAS) + ')');
      const coord = (await n['prueba-coord-as'].get('/acceso.php?formato=json')).j;
      ok(coord.permisosAS.includes('as.lista.marcar') && coord.permisosAS.includes('as.ver'), 'Coordinación: Pasar lista es una pestaña más');
      ok(!(await n['prueba-recepcion'].get('/acceso.php?formato=json')).j.permisosAS.includes('as.lista.marcar'), 'Recepción no pasa lista');
      // Tras el login, sin pedir nada: cada uno a su inicio; con una dirección pedida, a esa.
      const x = new Nav(base);
      let r = await x.entrar('prueba-profesor-1', claves['prueba-profesor-1']);
      ok(r.ok && r.destino === '/after-school/', 'el profesor entra directo a After School (Pasar lista)');
      r = await new Nav(base).entrar('prueba-contabilidad', claves['prueba-contabilidad']);
      ok(r.ok && r.destino === '/after-school/', 'Contabilidad (una sola sección) entra directo a After School');
      r = await new Nav(base).entrar('prueba-comercial', claves['prueba-comercial']);
      ok(r.ok && r.destino === '/', 'Comercial (tres secciones) va a la portada');
      r = await new Nav(base).entrar('prueba-comercial', claves['prueba-comercial'], '/kinder/');
      ok(r.ok && r.destino === '/kinder/', 'con una dirección pedida, vuelve a esa');
      r = await new Nav(base).entrar('prueba-comercial', claves['prueba-comercial'], '//otro-sitio.test/');
      ok(r.ok && r.destino === '/', 'una dirección de otro sitio no se sigue');
      ok((await x.get('/login.php?estado=1')).j.destino === '/after-school/', 'el login con sesión abierta manda directo a su inicio');
      // La página de After School se entrega al profesor; sus datos, solo por Pasar lista.
      const pg = await n['prueba-profesor-1'].get('/after-school/');
      ok(pg.status === 200 && /<title>After School · Vida en Arte/.test(pg.texto) && /data-vista="lista"/.test(pg.texto), 'el profesor abre la página de After School (con Pasar lista)');
      const viejo = await n['prueba-profesor-1'].get('/pasar-lista/');
      ok(viejo.status === 200 && /url=\/after-school\/#lista/.test(viejo.texto) && /location\.replace\('\/after-school\/' \+ q \+ '#lista'\)/.test(viejo.texto),
        'la dirección vieja /pasar-lista/ lleva a Pasar lista dentro de After School (conservando fecha y clase)');
      // Llamadas de verdad (una dirección entre comillas o un fetch); los comentarios pueden nombrar api.php.
      ok(!/['"`]\/?[\w\/-]*api\.php/.test(pg.texto) && !/fetch\(/.test(pg.texto), 'la página no llama a api.php: todo pasa por la capa de datos');
      ok(/<link rel="stylesheet" href="\/comun\/vea\.css\?v=[0-9a-f]{10}">/.test(pg.texto) && !/<style>/.test(pg.texto), 'un solo archivo de estilos compartido, sin estilos propios');
      // 22-oct (segunda ronda): ocupación compacta, sin «Actualizar» ni campo de fecha suelto.
      ok(!/id="btnActualizar"/.test(pg.texto) && /id="ocRango"/.test(pg.texto) && /id="ocDias"/.test(pg.texto) && /function bloqueHtml/.test(pg.texto),
        'After School: semana en bloques, vista por día, la fecha abre el calendario y no hay botón «Actualizar»');
      const css = (await new Nav(base).get('/comun/vea.css')).texto;
      ok(/\.tema-kids\s*\{[^}]*#7E53A2[^}]*#9DCC4C[^}]*#FCCC14/.test(css) && /@media \(pointer: fine\)/.test(css),
        'vea.css: tema Kids con la paleta de VEA Kids y Pasar lista compacta con mouse');
      const portada = (await n['admin-uno'].get('/')).texto;
      ok(/nombre: 'Preschool', url: '\/kinder\/'/.test(portada) && !/Preescolar|Kínder/.test(portada) && /Reservas y eventos/.test(portada) && /Procesos y herramientas del negocio/.test(portada),
        'portada: la unidad se llama Preschool (la ruta sigue /kinder/) y las tarjetas dicen qué serán');
      for (const pagina of ['/', '/configuracion/', '/login.html', '/cambiar-clave.html']) {
        const t = (await n['admin-uno'].get(pagina)).texto;
        ok(/href="\/comun\/vea\.css\?v=[0-9a-f]{10}"/.test(t) && !/<style>/.test(t) && !/fetch\(/.test(t), pagina + ': usa vea.css y no hace fetch por su cuenta');
      }
    }

    seccion('rediseño: páginas públicas y comun/ (sin datos, sin PHP, sin listado)');
    {
      const anon = new Nav(base);
      for (const [ruta, re] of [['/login.html', /<title>Entrar/], ['/cambiar-clave.html', /<title>Cambiar contraseña/], ['/comun/vea.css', /--rojo/],
                                ['/comun/datos.js', /window\.Datos/], ['/comun/marca.js', /window\.Marca/],
                                ['/comun/vea.css?v=0123456789', /--rojo/], ['/comun/marca.js?v=0123456789', /window\.Marca/]]) {
        const r = await anon.get(ruta);
        ok(r.status === 200 && re.test(r.texto), ruta + ' se abre sin sesión');
      }
      const png = await anon.get('/comun/logo-vea.png');
      ok(png.status === 200, '/comun/logo-vea.png se abre sin sesión');
      for (const ruta of ['/comun/', '/comun', '/comun/prueba.php', '/comun/api.php', '/comun/sub/x.css', '/comun/htaccess.txt', '/comun/.htaccess']) {
        const r = await anon.get(ruta);
        ok(r.status === 403 && !/EJECUTADO|vea\.css|datos\.js/.test(r.texto), ruta + ' → 403: ni listado, ni PHP, ni otra cosa (dio ' + r.status + ')');
      }
      const cc = await anon.get('/cambiar-clave.php?estado=1');
      ok(cc.status === 401 && cc.j && cc.j.codigo === 'sesion', 'cambiar-clave.php sin sesión: 401 «sesion» (la página manda al login)');
      const cp = await anon.post('/cambiar-clave.php', { json: { actual: 'x', nueva: 'una-larga-1234', repetir: 'una-larga-1234', csrf: 'x' } });
      ok(cp.status === 401, 'y no cambia nada sin sesión');
      const conSesion = await n['admin-uno'].get('/comun/prueba.php');
      ok(conSesion.status === 403 && !/EJECUTADO/.test(conSesion.texto), 'con sesión tampoco se ejecuta un PHP subido a comun/');
      // Con el .htaccess ANTERIOR (si se publicara solo el código): gate.php entrega lo público y nunca ejecuta PHP.
      fs.writeFileSync(htActivo, HTACCESS_ANTERIOR);
      try {
        for (const [ruta, re] of [['/login.html', /<title>Entrar/], ['/comun/vea.css', /--rojo/], ['/comun/datos.js', /window\.Datos/],
                                  ['/comun/vea.css?v=0123456789', /--rojo/]]) {
          const r = await anon.seguir(await anon.get(ruta));
          ok(!r.bucle && r.status === 200 && re.test(r.texto), 'con el .htaccess anterior, ' + ruta + ' también se abre sin sesión y sin bucle');
        }
        const php = await n['admin-uno'].get('/comun/prueba.php');
        ok(php.status !== 200 && !/EJECUTADO|<\?php/.test(php.texto), 'con el .htaccess anterior, comun/prueba.php no se ejecuta ni se entrega su código (dio ' + php.status + ')');
      } finally { fs.writeFileSync(htActivo, htNuevo); }
      // Logout de verdad: corta la sesión y lleva al login.
      const y = new Nav(base);
      await y.entrar('admin-dos', claves['admin-dos']);
      ok((await y.get('/after-school/')).status === 200, '(control) con sesión, After School abre');
      const fuera = await y.seguir(await y.get('/logout.php'));
      ok(!fuera.bucle && /<title>Entrar/.test(fuera.texto) && fuera.saltos.some(z => /login\.html\?salida=1/.test(z)), 'Salir lleva al login con «Cerraste sesión»');
      const tras = await y.get('/after-school/');
      ok(tras.status === 302 && /login\.html/.test(tras.location), 'después de Salir, After School pide entrar otra vez');
    }

    seccion('After School: cada acción según el rol; las prohibidas no llegan al Apps Script');
    {
      const ACCIONES = ['leer', 'listarPagos', 'crearNino', 'editarNino', 'inscribir', 'inscribirVarias', 'mover', 'bajaClase', 'bajaTotal',
        'registrarPago', 'revisar', 'notaInscripcion', 'agendarPrueba', 'resultadoPrueba', 'pagoPrueba', 'accionInventada',
        // 21-oct
        'ocupacion', 'agendarVisita', 'seguimiento', 'asistenciaNino', 'noHuboClase', 'resolverFueraDeLista', 'leerLista', 'guardarLista'];
      // Pasar lista nunca entra por after-school/api.php (ni para Administrador).
      const COMPLETO = new Set(ACCIONES.filter(a => a !== 'leerLista' && a !== 'guardarLista'));
      const sinCorregir = new Set([...COMPLETO].filter(a => a !== 'noHuboClase' && a !== 'resolverFueraDeLista'));
      const R = {
        'admin-uno': COMPLETO, 'prueba-direccion': COMPLETO, 'prueba-coord-as': COMPLETO, 'prueba-recepcion': sinCorregir,
        'prueba-comercial': new Set(['leer', 'ocupacion', 'agendarPrueba']),
        'prueba-contabilidad': new Set(['leer', 'ocupacion', 'listarPagos', 'registrarPago', 'pagoPrueba']),
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

    seccion('Pasar lista: quién entra, soloHoy y lo que recibe el profesor');
    {
      const pl = (u, accion, datos) => n[u].post('/pasar-lista/api.php', { json: { accion, datos: datos || {} } });
      const ultima = () => google.llamadas[google.llamadas.length - 1];
      let antes = google.llamadas.length;
      let r = await pl('prueba-profesor-1', 'leerLista', { fecha: '2026-10-01', soloHoy: false });
      ok(r.status === 200 && r.j.ok && google.llamadas.length === antes + 1, 'Profesor lee la lista');
      ok(ultima().datos.soloHoy === true && ultima().usuario === 'prueba-profesor-1', 'al script le llega soloHoy = true aunque el navegador mande false');
      const cl = r.j.resultado.clases[0];
      ok(Object.keys(cl.ninos[0]).sort().join() === 'edad,estado,idNino,idVisita,nombre,nota,presencia', 'por niño solo nombre, edad, marca y lo marcado (' + Object.keys(cl.ninos[0]).join() + ')');
      ok(!/555|correo|ejemplo\.test|Responsable|nacimiento/.test(r.texto), 'ningún contacto ni fecha de nacimiento llega al profesor');
      ok(!('estado' in r.j) && !('secreto' in r.j.resultado) && !('cupo' in cl), 'ni el estado de After School ni campos de más');
      ok(Object.keys(cl.fueraDeLista[0]).sort().join() === 'estado,idAsistencia,nombre,nota', 'los fuera de lista, recortados igual');
      ok(r.j.permisos && r.j.permisos.puedeOtroDia === false, 'la página sabe que el profesor no puede otro día');
      r = await pl('prueba-profesor-1', 'guardarLista', { codigo: 'LUN-1630-PARKOUR', marcas: [{ idNino: 'AS-0001', estado: 'Presente' }] });
      ok(r.status === 200 && r.j.ok && !('estado' in r.j) && !('secreto' in r.j.resultado) && r.j.resultado.nuevas === 1, 'guardar: el profesor no recibe el estado de After School');
      ok(ultima().accion === 'guardarLista' && ultima().datos.soloHoy === true, 'guardar también va con soloHoy = true');
      for (const a of ['leer', 'agendarVisita', 'seguimiento', 'noHuboClase', 'accionInventada']) {
        antes = google.llamadas.length;
        r = await pl('prueba-profesor-1', a);
        ok(r.status === 403 && r.j.codigo === 'sin_permiso' && google.llamadas.length === antes, 'Pasar lista no deja pasar «' + a + '»');
      }
      antes = google.llamadas.length;
      r = await pl('admin-uno', 'leer');
      ok(r.status === 403 && google.llamadas.length === antes, 'ni un Administrador usa Pasar lista para otra acción');
      antes = google.llamadas.length;
      r = await n['prueba-profesor-1'].as('leer');
      ok(r.status === 403 && google.llamadas.length === antes, 'el profesor no entra a after-school/api.php');
      r = await pl('prueba-coord-as', 'leerLista', { fecha: '2026-10-01' });
      ok(r.status === 200 && ultima().datos.soloHoy === false && r.j.permisos.puedeOtroDia === true, 'Coordinación After School: soloHoy = false (corrige otros días)');
      await pl('admin-uno', 'guardarLista', { codigo: 'X', marcas: [] });
      ok(ultima().datos.soloHoy === false, 'Administrador: también otros días');
      for (const u of ['prueba-recepcion', 'prueba-comercial', 'prueba-contabilidad', 'prueba-coord-pre']) {
        antes = google.llamadas.length;
        r = await pl(u, 'leerLista');
        ok(r.status === 403 && google.llamadas.length === antes, u + ' no pasa lista');
      }
    }

    seccion('Profesor: la sesión se cierra tras 2 horas sin uso');
    {
      const dirSes = path.join(home, 'portal_sesiones');
      const envejecer = (u, segundos) => {
        const f = path.join(dirSes, 'sess_' + n[u].cookies.vea_portal);
        const s = fs.readFileSync(f, 'utf8');
        fs.writeFileSync(f, s.replace(/ultimo\|i:\d+;/, 'ultimo|i:' + (Math.floor(Date.now() / 1000) - segundos) + ';'));
      };
      ok((await n['prueba-profesor-1'].get('/pasar-lista/')).status === 200, '(control) el profesor está dentro');
      envejecer('prueba-profesor-1', 7000);
      ok((await n['prueba-profesor-1'].get('/pasar-lista/')).status === 200, 'con 1 h 56 min sin uso sigue dentro');
      const ult = +(/ultimo\|i:(\d+);/.exec(fs.readFileSync(path.join(dirSes, 'sess_' + n['prueba-profesor-1'].cookies.vea_portal), 'utf8')) || [])[1];
      ok(Date.now() / 1000 - ult < 60, 'y el uso renueva el plazo');
      envejecer('prueba-profesor-1', 7300);
      const r = await n['prueba-profesor-1'].get('/pasar-lista/');
      ok(r.status === 302 && /login\.html/.test(r.location), 'con más de 2 horas sin uso, la sesión se cierra');
      envejecer('prueba-coord-as', 30000);
      ok((await n['prueba-coord-as'].get('/after-school/')).status === 200, 'los demás roles no tienen ese tope');
      const c = await n['prueba-profesor-1'].entrar('prueba-profesor-1', claves['prueba-profesor-1']);
      ok(c.ok && c.destino === '/after-school/', 'el profesor vuelve a entrar (directo a After School)');
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
      await l.get('/login.php?estado=1');
      let r = await l.post('/login.php', { json: { usuario: 'admin-uno', clave: claves['admin-uno'], r: '/' } });
      ok(r.status === 403 && r.j.codigo === 'csrf' && !r.j.destino, 'el login sin token CSRF no entra');
      r = await l.post('/login.php', { json: { usuario: 'admin-uno', clave: claves['admin-uno'], csrf: 'falso', r: '/' } });
      ok(r.status === 403 && r.j.codigo === 'csrf', 'con un token falso tampoco');
      ok((await l.get('/login.php?estado=1')).j.conSesion === false, '(control) no quedó ninguna sesión');
      limpiarIntentos();
    }

    seccion('desactivar y reactivar');
    {
      const u = 'prueba-recepcion';
      ok((await n['admin-uno'].config('desactivar', { usuario: u })).status === 200, 'se desactiva ' + u);
      const r = await n[u].get('/after-school/');
      ok(r.status === 302 && /login\.html/.test(r.location), 'su sesión abierta se corta en la siguiente página');
      const x = await n[u].as('leer');
      ok(x.status === 302, 'y api.php ya no le responde');
      const otra = new Nav(base);
      const e = await otra.entrar(u, claves[u]);
      ok(!e.ok && e.codigo === 'credenciales' && /incorrectos/.test(e.j.error), 'una cuenta desactivada no entra (mismo mensaje que una contraseña mala)');
      limpiarIntentos();
      ok((await n['admin-uno'].config('reactivar', { usuario: u })).status === 200, 'se reactiva');
      ok((await n[u].entrar(u, claves[u])).ok, 'y vuelve a entrar con su contraseña de antes');
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
      ok(!(await vieja.entrar(u, claves[u])).ok, 'la contraseña anterior ya no sirve');
      limpiarIntentos();
      const t = await n[u].entrar(u, r.j.temporal);
      ok(t.ok && t.destino.startsWith('/cambiar-clave.html'), 'con la temporal hay que cambiarla otra vez');
      const nueva = clave();
      ok((await n[u].cambiarClave(r.j.temporal, nueva)).ok, 'y queda con una propia');
      claves[u] = nueva;
    }

    seccion('cambiar mi contraseña (cualquier usuario) corta sus otras sesiones');
    {
      const u = 'prueba-contabilidad';
      const otra = new Nav(base); await otra.entrar(u, claves[u]);
      ok((await otra.get('/after-school/')).status === 200, '(control) la otra sesión funciona');
      const nueva = clave();
      const r = await n[u].cambiarClave(claves[u], nueva);
      ok(r.ok && r.j.obligatorio === false, 'cambio voluntario: queda guardado (la página dice «tu contraseña cambió»)');
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
      ok(!r.ok && r.codigo === 'bloqueado' && /Demasiados intentos/.test(r.j.error), 'tras 5 fallos, ni la contraseña buena entra durante 15 minutos');
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
  correr(process.argv[2]).then(b => process.exit(b ? 0 : 1), e => { console.error(e); anotar('se cayó: ' + (e && e.stack || e)); process.exit(1); });
}
