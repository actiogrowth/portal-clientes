/* Rediseño etapa 1 (3-nov-2026): la estructura común, por rol, en Chrome real.
 *
 *   node pruebas-portal/prueba-rediseno.js [carpeta-del-portal]
 *
 * Necesita playwright-core y Chrome (channel 'chrome'; otro con
 * CHROME_RUTA=<ruta>). Sin red: un servidor propio sirve las páginas del
 * repositorio y hace de los puentes con DATOS INVENTADOS. After School
 * contesta con el AfterSchool.gs DE VERDAD sobre el simulador de sus pruebas.
 * Los roles y sus permisos se leen de portal-raiz/permisos.php (no se copian).
 *
 * Qué comprueba:
 *   · el sistema visual: los colores de la marca en vea.css, todas las
 *     páginas con vea.css, ninguna con el vidrio ni la foto vieja;
 *   · por rol: la barra lateral (en 1440 y, de iconos, en 820), la barra
 *     inferior en 390, el botón «Nuevo» y lo que encuentra el buscador
 *     (nadie encuentra lo que no puede ver en su sección);
 *   · notificaciones: los mismos avisos que manda el servidor, el número
 *     rojo y «Marcar todo como leído» recordado por usuario;
 *   · Ocupación: las cuatro cifras, «N libres», «Lleno» y «Dónde hay más cupos»;
 *   · Pasar lista: los botones no cambian de ancho al marcarse y se guarda
 *     lo mismo que antes; «Guardar lista» dice cuántos faltan;
 *   · y sus ROTURAS: con marca.js alterado, la prueba tiene que fallar.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { medir: medirContraste } = require('./contraste.js');

const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const sim = require(path.join(RAIZ, 'after-school-script', 'pruebas', 'simulador.js'));

/* ── Roles: leídos de permisos.php ──────────────────────────────────────── */
const PHP = fs.readFileSync(path.join(RAIZ, 'portal-raiz', 'permisos.php'), 'utf8');
const lista = t => [...t.matchAll(/'([^']+)'/g)].map(m => m[1]);
const ROLES = {};
for (const m of PHP.slice(PHP.indexOf('const ROLES = ['), PHP.indexOf('/* Carpeta de la raíz')).matchAll(/'([a-z_]+)' => \[\s*(?:'inicio_as' => '([a-z]+)',\s*)?'nombre' => '([^']+)',[\s\S]*?'permisos' => \[([\s\S]*?)\],(?:\s*'excepto' => \[([^\]]*)\],)?/g))
  ROLES[m[1]] = { inicioAS: m[2] || 'ocupacion', nombre: m[3], permisos: lista(m[4]), excepto: m[5] ? lista(m[5]) : [] };
const AREAS = lista(/const AREAS = \[([^\]]*)\]/.exec(PHP)[1]);
const PERMISOS_AS = lista(/const PERMISOS_AS = \[([^\]]*)\]/.exec(PHP)[1]);
const permite = (rol, p) => { const r = ROLES[rol]; if (r.excepto.includes(p)) return false; return r.permisos.includes('*') || r.permisos.includes(p); };
function sesionDe(rol) {
  const todo = permite(rol, 'area:*');
  return { ok: true, usuario: 'usuario-' + rol, nombre: '', apellido: '', roles: [{ id: rol, nombre: ROLES[rol].nombre }],
    areas: todo ? '*' : AREAS.filter(a => permite(rol, 'area:' + a)), inicio: '/', inicioAS: ROLES[rol].inicioAS, permisosAS: PERMISOS_AS.filter(p => permite(rol, p)) };
}

/* ── After School de mentira (el .gs de verdad en el simulador) ─────────── */
function cargaAS() {
  const l = new sim.Libro('Carga inventada');
  const clases = [['Código clase', 'Servicio', 'Modalidad', 'Día', 'Hora inicio', 'Cupo', 'Edades']];
  [['LUN', 'Lunes'], ['MAR', 'Martes'], ['MIE', 'Miércoles'], ['JUE', 'Jueves']].forEach(([c, d]) => {
    clases.push([c + '-1630-PARKOUR', 'Parkour', 'Semana', d, '16:30', 10, '6 a 14']);
    clases.push([c + '-1630-TELAS', 'Telas', 'Semana', d, '16:30', 8, '6 a 14']);
    clases.push([c + '-1800-PARKIDS', 'Parkids', 'Semana', d, '18:00', 6, '3 a 5']);
  });
  clases.push(['SAB-0900-PARKOUR', 'Parkour', 'Sábado', 'Sábado', '09:00', 12, '6 a 14']);
  l.hojaDesdeFilas('Clases', clases);
  const ninos = [['Número de socio', 'Nombre', 'Apellidos', 'Fecha nacimiento', 'Sexo', 'Estado (Poliwin)', 'Fecha de alta', 'Móvil', 'Móvil 2', 'Teléfono', 'E-mail', 'Cabeza de familia', 'Observaciones', 'Revisar']];
  const ins = [['Número de socio', 'Código clase', 'Reservado en Poliwin el']];
  for (let i = 1; i <= 40; i++) {
    const socio = String(90000 + i);
    ninos.push([socio, i === 1 ? 'Zacarías' : 'Niño' + i, 'Inventado Prueba', '10/0' + (1 + i % 9) + '/2016', 'Hombre', 'ALTA', '01/09/2026', '600000' + (10 + i), '', '', '', socio, '', '']);
  }
  // Lunes y martes de Parkour llenos (10/10); el resto con menos.
  for (let i = 1; i <= 10; i++) { ins.push([String(90000 + i), 'LUN-1630-PARKOUR', '02/09/2026']); ins.push([String(90010 + i), 'MAR-1630-PARKOUR', '02/09/2026']); }
  // Miércoles de Parkour casi lleno (9/10: desde el umbral de Config, sin llegar al cupo).
  for (let i = 28; i <= 36; i++) ins.push([String(90000 + i), 'MIE-1630-PARKOUR', '02/09/2026']);
  for (let i = 21; i <= 24; i++) ins.push([String(90000 + i), 'MIE-1630-TELAS', '02/09/2026']);
  for (let i = 25; i <= 27; i++) ins.push([String(90000 + i), 'JUE-1800-PARKIDS', '02/09/2026']);
  l.hojaDesdeFilas('Niños', ninos);
  l.hojaDesdeFilas('Inscripciones', ins);
  return l;
}
const CLAVE = 'clave-de-prueba-del-rediseno-0123456789';
const g = sim.crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE, AS_ID_CARGA: 'carga' }, porId: { carga: cargaAS() } });
g.instalar();
g.cargaInicial();
const asPost = (accion, datos, usuario) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: CLAVE, usuario: usuario || 'prueba', accion, datos: datos || {} }) } }).getContent());

/* ── Servidor ───────────────────────────────────────────────────────────── */
const PENDIENTES = [{ clave: 'pruebas', n: 2, url: '/after-school/#pruebas' }, { clave: 'revisar', n: 0, url: '/equipo/#revisar' }, { clave: 'contratos', n: 3, url: '/procesos/#equipo' }];
const DOC_PROC = { nombre: 'Manual de bienvenida inventado', unidad: 'After School', proceso: 'Entrega de servicio', fecha: '2026-09-01', enlace: 'https://docs.google.com/document/d/PRUEBA/edit' };
const DOC_PA = { nombre: 'Informe reservado de Actio inventado', unidad: 'Gerencia', enlace: 'https://docs.google.com/document/d/PA/edit', idEntregable: '', fecha: '2026-10-01' };
let rol = 'administrador', mutaciones = {}, guardadas = [];
/* 3-nov: lo que manda mensajes/api.php › leer, inventado. */
const MSJ_DEMO = S => ({ hoy: '2026-11-03', familiasHoy: 0, puedePlantillas: S.areas === '*', usuario: S.usuario, rol: 'Prueba',
  clases: [{ codigo: 'LUN-1630-PARKOUR', servicio: 'Parkour', dia: 'Lunes', hora: '16:30' }, { codigo: 'MIE-1630-TELAS', servicio: 'Telas', dia: 'Miércoles', hora: '16:30' }],
  familias: [{ unidad: 'After School', id: 'AS-1', nino: 'ZACARÍAS INVENTADO', telefono: '6000-0001', correo: 'uno@ejemplo.test', clases: ['LUN-1630-PARKOUR'] },
    { unidad: 'After School', id: 'AS-2', nino: 'NIÑO DOS', telefono: '6000-0002', correo: '', clases: ['MIE-1630-TELAS'] },
    { unidad: 'Preschool', id: 'VEA-1', nino: 'Niña Tres', telefono: '6000-0003', correo: 'tres@ejemplo.test', clases: [] }],
  config: [{ parametro: 'Destinatarios por tanda', valor: '50' }],
  plantillas: [{ nombre: 'Aviso de evento', asunto: 'Te invitamos', cuerpo: 'Hola, familia', activa: true }],
  enviados: [{ fecha: '2026-11-02 10:00', usuario: 'prueba', rol: 'Comercial', grupos: 'Todo Vida en Arte', familias: 2, sinCorreo: 1, plantilla: '', asunto: 'Hola', tandas: '1 de 1' }] });
function servidor() {
  const tipos = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8', png: 'image/png', webmanifest: 'application/manifest+json' };
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const json = (o, st) => { res.writeHead(st || 200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
    const S = sesionDe(rol), ve = a => S.areas === '*' || S.areas.includes(a), tiene = p => S.permisosAS.includes(p);
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    req.on('end', () => {
      let p = {}; try { p = JSON.parse(cuerpo || '{}'); } catch (e) { }
      // Los puentes: cada uno exige su área o su permiso, como los de verdad.
      // Sin ?formato=json, acceso.php da el JS de antes (lo usa Veranito).
      if (url === '/acceso.php' && !/formato=json/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end('window.ACCESO = ' + JSON.stringify(S.areas) + ';'); return; }
      if (url === '/kinder/config.php') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end('/* sin tablero en esta prueba */'); return; }
      if (url === '/acceso.php') return json(S);
      if (url === '/pendientes/api.php') return ve('equipo') ? json({ ok: true, resultado: { hoy: asPost('leer').resultado.hoy, items: PENDIENTES } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/procesos/api.php') return ve('procesos') ? json({ ok: true, resultado: { procesos: [], documentos: [DOC_PROC] } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/proyecto-actio/api.php') return ve('proyecto-actio') ? json({ ok: true, resultado: { proyectos: ['Proyecto 1'], entregables: [], documentos: [DOC_PA], reuniones: [], atencion: [], faltan: [] } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/equipo/api.php') {
        // Un organigrama mínimo (Dirección, un área con su coordinación y un puesto «Por cargar»): solo puestos inventados.
        const P = (id, puesto, area, reportaA, estado) => ({ id, puesto, area, reportaA, estado, ficha: false, unidad: 'Unidad', cantidad: '', version: null });
        return json({ ok: true, resultado: { hoy: '2026-11-03', yo: { usuario: S.usuario, todo: true }, mios: [], revisar: [], reglas: [], momentos: [], horarios: [], faltan: [], personas: {}, calendario: {},
          fichas: {}, puestos: [P('DIR', 'Dirección', 'Dirección', '', 'Por cargar'), P('C0', 'Coordinación de prueba', 'Comercial', 'DIR', 'Borrador'), P('C1', 'Puesto de prueba', 'Comercial', 'C0', 'Por cargar')] } });
      }
      // 3-nov: Mensajes a familias (datos inventados).
      if (url === '/mensajes/api.php') return ve('mensajes') ? json({ ok: true, resultado: MSJ_DEMO(S) }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/resumen/api.php') return ve('resumen') ? json({ ok: true, resultado: { hoy: asPost('leer').resultado.hoy, metas: [], preschool: null, finanzas: null, faltan: [] } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/after-school/api.php') {
        if (!tiene('as.ver')) return json({ ok: false, codigo: 'sin_permiso', error: 'Tu rol no permite esto.' }, 403);
        const j = asPost(p.accion, p.datos); if (j.ok) j.permisos = S.permisosAS; return json(j);
      }
      if (url === '/pasar-lista/api.php') {
        if (!tiene('as.lista.marcar')) return json({ ok: false, codigo: 'sin_permiso' }, 403);
        if (p.accion === 'guardarLista') guardadas.push(p.datos);
        const j = asPost(p.accion, Object.assign({}, p.datos, { soloHoy: false, limiteProfesor: false }), 'profesor-prueba');
        delete j.estado; j.permisos = { puedeOtroDia: true }; return json(j);
      }
      const PAG = { '/': 'portal-raiz/index.html', '/login.html': 'portal-raiz/login.html' };
      const carpeta = /^\/([a-z-]+)\/$/.exec(url);
      if (carpeta) PAG[url] = carpeta[1] + '/index.html';
      const rel = PAG[url] || (url.startsWith('/comun/') ? url.slice(1) : null);
      if (!rel || !fs.existsSync(path.join(RAIZ, rel))) { res.writeHead(404); res.end('no'); return; }
      let t = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
      for (const [a, b] of mutaciones[rel] || []) { if (!t.includes(a)) throw new Error('la rotura no encuentra su texto en ' + rel + ': ' + a); t = t.replace(a, b); }
      res.writeHead(200, { 'Content-Type': tipos[rel.split('.').pop()] || 'text/plain', 'Cache-Control': 'no-store' });
      res.end(t);
    });
  });
}

/* 3-nov: Pasar lista se mide siempre en el último lunes y en su clase con niños (LUN-1630-PARKOUR). Sin esto,
   de noche (abre la clase de las 19:00, vacía) o de viernes a domingo no había niños y la prueba de contraste
   no veía las etiquetas rosadas: la rotura «etiquetas rosadas» pasaba sin detectarse según la hora. */
const LISTA_FIJA = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const dos = n => String(n).padStart(2, '0');
  return '/after-school/?fecha=' + d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + '&clase=LUN-1630-PARKOUR#lista'; })();

/* ── Lo esperado por rol ────────────────────────────────────────────────── */
const TODO = ['inicio', 'afterschool', 'veranito', 'cumpleanos', 'kinder', 'babyandme', 'resumen', 'mensajes', 'procesos', 'equipo', 'basededatos', 'proyecto-actio', 'configuracion'];
const ESPERADO = {
  administrador:            { nav: TODO, nuevo: ['inscribir', 'visita', 'pago', 'mensaje'], ninos: true, pa: true, principal: 'afterschool' },
  direccion:                { nav: TODO, nuevo: ['inscribir', 'visita', 'pago', 'mensaje'], ninos: true, pa: true, principal: 'afterschool' },
  coordinacion_afterschool: { nav: ['inicio', 'afterschool', 'procesos', 'equipo', 'basededatos'], nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: false, principal: 'afterschool' },
  recepcion:                { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: false, principal: 'afterschool' },
  comercial:                { nav: ['inicio', 'afterschool', 'kinder', 'mensajes', 'procesos', 'equipo', 'basededatos'], nuevo: ['visita', 'mensaje'], ninos: true, pa: false, principal: 'afterschool' },
  contabilidad:             { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: ['pago'], ninos: true, pa: false, principal: 'afterschool' },
  coordinacion_preescolar:  { nav: ['inicio', 'kinder', 'procesos', 'equipo', 'basededatos'], nuevo: [], ninos: false, pa: false, principal: 'kinder' },
  profesor:                 { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: [], ninos: false, pa: false, principal: 'afterschool' }
};

/* ── La prueba ─────────────────────────────────────────────────────────── */
/* Un archivo como lo entrega el servidor de la prueba (con la rotura puesta, si la hay): así las
   comprobaciones sobre el texto de los archivos también ven las roturas. */
const leerComoSirve = f => { let t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); for (const [a, b] of mutaciones[f] || []) t = t.replace(a, b); return t; };
async function correr(nav, base, log) {
  let fallos = 0, total = 0;
  const ok = (c, que) => { total++; if (!c) fallos++; if (log || !c) console.log((c ? '  ✓ ' : '  ✗ ') + que); if (log && !c && process.env.GITHUB_ACTIONS) console.log('::error title=Rediseño::' + que.slice(0, 900)); };
  const nueva = async (ancho, alto) => { const ctx = await nav.newContext({ viewport: { width: ancho, height: alto || 900 }, reducedMotion: 'reduce', hasTouch: ancho < 1100 });
    const p = await ctx.newPage(); p.errores = []; p.on('pageerror', e => p.errores.push(e.message)); return [ctx, p]; };
  /* 5-nov (ajuste 4): por defecto la página va en Claro. Para medir los dos modos siguiendo al dispositivo,
     cada usuario de prueba queda en Automático (como si lo hubiera elegido en el menú). */
  const USUARIOS_PRUEBA = Object.keys(ROLES).map(r => 'usuario-' + r);
  const automatico = p => p.addInitScript(us => { try { localStorage.setItem('vea360.apariencia.ultimo', 'auto'); us.forEach(u => localStorage.setItem('vea360.apariencia.' + u, 'auto')); } catch (e) { } }, USUARIOS_PRUEBA);

  if (log) console.log('· sistema visual');
  {
    const css = fs.readFileSync(path.join(RAIZ, 'comun', 'vea.css'), 'utf8'), raiz = /:root,\n[^{]*\{([\s\S]*?)\n\}/.exec(css)[1];   // el juego claro
    const COLORES = { fondo: '#FAF8F5', panel: '#FFFFFF', linea: '#ECE8E2', tinta: '#16181D', suave: '#5B5F68', tenue: '#8A8E96', accion: '#D71C0E',
      parkour: '#E0412F', telas: '#1974A8', parkids: '#F2A01E', babyme: '#7FB3D5', ok: '#278746', alerta: '#E08A00', peligro: '#D71C0E' };
    ok(Object.entries(COLORES).every(([k, v]) => new RegExp('--' + k + ': ' + v + '[;\\s]').test(raiz)), 'vea.css: los colores del sistema (fondo, panel, línea, tinta, disciplinas y estados)');
    const paginas = ['portal-raiz/index.html', 'portal-raiz/login.html', 'portal-raiz/cambiar-clave.html', 'after-school/index.html', 'configuracion/index.html', 'procesos/index.html',
      'equipo/index.html', 'resumen/index.html', 'proyecto-actio/index.html', 'veranito/index.html', 'kinder/index.html', 'mensajes/index.html'];
    const malas = paginas.filter(f => { const t = leerComoSirve(f); return !/\/comun\/vea\.css\?v=/.test(t) || /class="vidrio"|fondo-local/.test(t); });
    ok(!malas.length, 'todas las páginas usan vea.css y ninguna lleva el vidrio ni la foto vieja' + (malas.length ? ' (' + malas.join(', ') + ')' : ''));
    ok(!/fondo-local|\.vidrio body/.test(css + fs.readFileSync(path.join(RAIZ, 'comun', 'organigrama.js'), 'utf8')), 'vea.css y el organigrama sin la foto de fondo');
    // 6-nov (pedido de Vida en Arte): sin partículas, chispas ni brillos. Que no quede código de ellas en comun/.
    const restos = ['marca.js', 'armazon.css', 'vea.css', 'organigrama.js'].filter(f => /\.particulas|particulas\(|COLORES_PARTICULAS|vea-sube|vea-pausa|--particulas|eq-chispa|eq-brillos|eq-sube|CHISPAS/.test(
      fs.readFileSync(path.join(RAIZ, 'comun', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
    ok(!restos.length, '6-nov: sin código de partículas, chispas ni brillos en comun/' + (restos.length ? ' (quedan en: ' + restos.join(', ') + ')' : ''));
  }

  if (log) console.log('· la entrada activa de la barra, en cada página (también las de estilos propios)');
  {
    rol = 'administrador';
    const PAGINAS = { '/': 'inicio', '/after-school/': 'afterschool', '/kinder/': 'kinder', '/veranito/': 'veranito', '/procesos/': 'procesos', '/procesos/#equipo': 'equipo',
      '/equipo/': 'equipo', '/resumen/': 'resumen', '/proyecto-actio/': 'proyecto-actio', '/configuracion/': 'configuracion', '/mensajes/': 'mensajes' };
    for (const [ruta, id] of Object.entries(PAGINAS)) {
      const [ctx, p] = await nueva(1440);
      await p.goto(base + ruta); await p.waitForSelector('.lat [aria-current="page"]', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300);
      const a = await p.evaluate(() => {
        const x = document.querySelector('.lat [aria-current="page"]');
        if (!x) return null;
        const t = x.querySelector('.lat-txt'), r = t.getBoundingClientRect(), cs = getComputedStyle(x);
        return { id: x.dataset.nav, fondo: cs.backgroundColor, letra: getComputedStyle(t).color, ancho: r.width, alto: r.height, texto: t.textContent.trim(), visible: getComputedStyle(t).visibility };
      });
      ok(a && a.id === id && a.fondo === 'rgb(22, 24, 29)' && a.letra === 'rgb(255, 255, 255)' && a.ancho > 20 && a.alto > 10 && a.texto && a.visible === 'visible',
        ruta + ': la entrada activa («' + (a ? a.texto : '—') + '») se ve con su nombre y el fondo de activo' + (a ? ' (' + a.fondo + ' / ' + a.letra + ')' : ' (no hay)'));
      await ctx.close();
    }
    // 6-nov: ninguna página, en Claro ni en Oscuro, tiene partículas, chispas ni brillos, ni nada que se mueva sin parar
    // detrás del contenido (lo único que se mueve siempre es el organigrama 3D; y el «cargando», mientras carga).
    for (const modo of ['claro', 'oscuro']) for (const ruta of Object.keys(PAGINAS)) {
      const [ctx, p] = await nueva(1440);
      await p.addInitScript(m => { try { localStorage.setItem('vea360.apariencia.ultimo', m); localStorage.setItem('vea360.apariencia.usuario-administrador', m); } catch (e) { } }, modo);
      await p.goto(base + ruta); await p.waitForSelector('.lat [aria-current="page"]', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(ruta.includes('equipo') ? 3000 : 600);
      const f = await p.evaluate(() => ({
        modo: document.documentElement.dataset.modo,
        adornos: document.querySelectorAll('.particulas, .eq-chispa, .eq-brillos').length,
        siempre: [...document.querySelectorAll('body *')].filter(x => getComputedStyle(x).animationIterationCount.includes('infinite') && !x.closest('.eq-org3d') && !x.closest('.esq'))
          .map(x => x.tagName.toLowerCase() + '.' + [...x.classList].join('.')).slice(0, 4) }));
      ok(f.modo === modo && !f.adornos && !f.siempre.length, modo + ' ' + ruta + ': sin partículas, chispas ni brillos, y nada que se mueva sin parar fuera del organigrama' +
        (f.adornos || f.siempre.length ? ' (' + f.adornos + ' adornos; ' + f.siempre.join(', ') + ')' : ''));
      await ctx.close();
    }
  }

  if (log) console.log('· apariencia: claro, oscuro y automático (ajuste 3)');
  {
    rol = 'administrador';
    // Cada página carga comun/tema.js en el <head>, ANTES de los estilos (sin parpadeo).
    const PAGS = ['portal-raiz/index.html', 'portal-raiz/login.html', 'portal-raiz/cambiar-clave.html', 'after-school/index.html', 'configuracion/index.html', 'procesos/index.html',
      'equipo/index.html', 'resumen/index.html', 'proyecto-actio/index.html', 'veranito/index.html', 'kinder/index.html', 'mensajes/index.html'];
    const sinTema = PAGS.filter(f => { const t = leerComoSirve(f); const i = t.indexOf('/comun/tema.js?v='), j = t.indexOf('/comun/vea.css?v=');
      return i < 0 || j < 0 || i > j || !/<script src="\/comun\/tema\.js\?v=[0-9a-f]{10}"><\/script>/.test(t) || t.indexOf('</head>') < i; });
    ok(!sinTema.length, 'todas las páginas aplican la apariencia en el <head>, antes de los estilos' + (sinTema.length ? ' (faltan: ' + sinTema.join(', ') + ')' : ''));
    // Sin parpadeo: con «oscuro» guardado, la página ya está en oscuro en su PRIMER pintado.
    let [ctx, p] = await nueva(1440);
    await p.addInitScript(() => { try { localStorage.setItem('vea360.apariencia.ultimo', 'oscuro'); localStorage.setItem('vea360.apariencia.usuario-administrador', 'oscuro'); } catch (e) { }
      new MutationObserver((m, o) => { if (document.body) { window.__primerModo = document.documentElement.dataset.modo; window.__primerFondo = getComputedStyle(document.body).backgroundColor; o.disconnect(); } })
        .observe(document, { childList: true, subtree: true }); });
    await p.goto(base + '/');
    const primero = await p.evaluate(() => ({ modo: window.__primerModo, fondo: window.__primerFondo }));
    // El modo ya está puesto cuando aparece el cuerpo; los estilos (que bloquean el primer pintado) lo leen desde el principio.
    const fondoFinal = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(primero.modo === 'oscuro' && fondoFinal === 'rgb(17, 19, 23)', 'sin parpadeo: el modo oscuro ya está puesto cuando aparece el cuerpo de la página (' + primero.modo + ', fondo ' + fondoFinal + ')');
    await ctx.close();
    // La elección en el menú del usuario: se guarda POR USUARIO y se aplica al volver.
    [ctx, p] = await nueva(1440, 900);
    await p.goto(base + '/'); await p.waitForSelector('.lat-yo');
    await p.click('.lat .lat-yo'); await p.waitForTimeout(200);
    const ops = await p.$$eval('#usuMenu [data-apariencia]', l => l.map(b => b.textContent));
    ok(JSON.stringify(ops) === '["Claro","Oscuro","Automático"]' && await p.$eval('#usuMenu [data-apariencia="claro"]', b => b.getAttribute('aria-pressed')) === 'true',
      'menú del usuario › Apariencia: Claro, Oscuro y Automático; por defecto (5-nov), Claro');
    await p.click('#usuMenu [data-apariencia="oscuro"]'); await p.waitForTimeout(100);
    const g1 = await p.evaluate(() => ({ modo: document.documentElement.dataset.modo, mio: localStorage.getItem('vea360.apariencia.usuario-administrador') }));
    await p.reload(); await p.waitForSelector('.lat-yo'); await p.waitForTimeout(300);
    const g2 = await p.evaluate(() => document.documentElement.dataset.modo);
    ok(g1.modo === 'oscuro' && g1.mio === 'oscuro' && g2 === 'oscuro', 'elegir «Oscuro» lo aplica al instante, lo guarda para ese usuario y sigue al volver a entrar');
    rol = 'recepcion';
    await p.reload(); await p.waitForSelector('.lat-yo'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.documentElement.dataset.apariencia) === 'claro', 'otro usuario en el mismo navegador tiene la suya (Claro, si no eligió)');
    rol = 'administrador';
    await ctx.close();
    // 5-nov (ajuste 4): por defecto CLARO, también con el dispositivo en oscuro y para quien nunca eligió.
    [ctx, p] = await nueva(1440);
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.goto(base + '/'); await p.waitForSelector('.lat-yo'); await p.waitForTimeout(200);
    const def = await p.evaluate(() => ({ modo: document.documentElement.dataset.modo, ap: document.documentElement.dataset.apariencia, guardada: localStorage.getItem('vea360.apariencia.usuario-administrador') }));
    ok(def.modo === 'claro' && def.ap === 'claro' && def.guardada === null, 'sin elegir nada (y el dispositivo en oscuro): Claro, sin guardar nada por el usuario (' + JSON.stringify(def) + ')');
    // El botón sol/luna junto a la campana: a la vista en computador, tablet y celular; un clic alterna Claro y Oscuro y se guarda por usuario.
    for (const ancho of [1440, 820, 390]) {
      await p.setViewportSize({ width: ancho, height: 900 }); await p.waitForTimeout(150);
      const b = await p.evaluate(() => { const x = document.getElementById('botonTema'), c = document.getElementById('campana'), r = x && x.getBoundingClientRect();
        return x && { visible: r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden', enCab: !!x.closest('.cab'), alLado: !c || c.previousElementSibling === x, arriba: r.top < 80, ancho: r.width, alto: r.height,
          dentro: r.right <= innerWidth, etiqueta: x.getAttribute('aria-label'), luna: /A9 9 0 1 1/.test(x.innerHTML) }; });
      ok(b && b.visible && b.enCab && b.alLado && b.arriba && b.dentro && b.ancho >= 40 && b.alto >= 40 && b.luna && b.etiqueta === 'Cambiar a modo oscuro',
        ancho + ' px: botón con la luna en la barra de arriba, junto a la campana, a la vista y de buen tamaño (' + JSON.stringify(b) + ')');
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.click('#botonTema'); await p.waitForTimeout(150);
    const t1 = await p.evaluate(() => ({ modo: document.documentElement.dataset.modo, mio: localStorage.getItem('vea360.apariencia.usuario-administrador'),
      sol: !/A9 9 0 1 1/.test(document.getElementById('botonTema').innerHTML), etiqueta: document.getElementById('botonTema').getAttribute('aria-label') }));
    ok(t1.modo === 'oscuro' && t1.mio === 'oscuro' && t1.sol && t1.etiqueta === 'Cambiar a modo claro', 'un clic en la luna pasa a Oscuro, lo guarda para el usuario y muestra el sol (' + JSON.stringify(t1) + ')');
    await p.reload(); await p.waitForSelector('#botonTema'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.dataset.modo) === 'oscuro', 'Oscuro sigue al volver a entrar');
    await p.click('#botonTema'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.documentElement.dataset.modo + '/' + localStorage.getItem('vea360.apariencia.usuario-administrador')) === 'claro/claro', 'otro clic (el sol) vuelve a Claro y lo guarda');
    // «Automático» solo en el menú del usuario: el botón no lo ofrece.
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !document.querySelector('.cab [data-apariencia="auto"]') && !!document.querySelector('#usuMenu [data-apariencia="auto"]')), 'Automático no está en la barra de arriba; sí en el menú del usuario › Apariencia');
    // Quien ya eligió Automático a mano lo conserva; desde Automático (dispositivo en oscuro), el botón pasa a Claro.
    await p.click('.lat .lat-yo'); await p.waitForTimeout(150); await p.click('#usuMenu [data-apariencia="auto"]'); await p.waitForTimeout(150);
    await p.reload(); await p.waitForSelector('#botonTema'); await p.waitForTimeout(200);
    const au = await p.evaluate(() => document.documentElement.dataset.apariencia + '/' + document.documentElement.dataset.modo);
    ok(au === 'auto/oscuro', 'quien eligió Automático a mano lo conserva (sigue al dispositivo, en oscuro) (' + au + ')');
    await p.click('#botonTema'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.documentElement.dataset.apariencia + '/' + document.documentElement.dataset.modo) === 'claro/claro', 'desde Automático en oscuro, el botón pasa a Claro');
    await ctx.close();
    // Automático (elegido a mano) sigue al dispositivo, y cambia solo si el dispositivo cambia.
    [ctx, p] = await nueva(1440);
    await p.addInitScript(() => { try { localStorage.setItem('vea360.apariencia.ultimo', 'auto'); localStorage.setItem('vea360.apariencia.usuario-administrador', 'auto'); } catch (e) { } });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.goto(base + '/'); await p.waitForSelector('.lat-yo');
    const a1 = await p.evaluate(() => document.documentElement.dataset.modo);
    // En oscuro, el logo de Vida en Arte es su versión clara (la de letras negras, oculta).
    const logos = await p.evaluate(() => [...document.querySelectorAll('.lat-logo img, .ini-marca-cab img')].filter(i => getComputedStyle(i).display !== 'none').map(i => i.getAttribute('src').split('?')[0]));
    ok(logos.includes('/comun/logo-vea-oscuro.png') && !logos.includes('/comun/logo-vea.png'), 'en oscuro se ve el logo claro de Vida en Arte, no el de letras negras (' + logos.join(', ') + ')');
    await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(150);
    const a2 = await p.evaluate(() => document.documentElement.dataset.modo);
    ok(a1 === 'oscuro' && a2 === 'claro', 'Automático: oscuro si el dispositivo está en oscuro, y cambia solo cuando el dispositivo cambia (' + a1 + ' → ' + a2 + ')');
    // El PDF y la impresión, siempre en claro.
    await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(100);
    const imp = await p.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); const d = document.documentElement.dataset.modo; window.dispatchEvent(new Event('afterprint')); return [d, document.documentElement.dataset.modo]; });
    ok(imp[0] === 'claro' && imp[1] === 'oscuro', 'al imprimir (el PDF del contrato o Ctrl P) la página pasa a claro, y vuelve después (' + imp.join(' → ') + ')');
    await ctx.close();
    // La pantalla de entrada también respeta Automático (si es lo último que se eligió).
    [ctx, p] = await nueva(1440);
    await p.addInitScript(() => { try { localStorage.setItem('vea360.apariencia.ultimo', 'auto'); } catch (e) { } });
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.goto(base + '/login.html').catch(() => {});
    ok(await p.evaluate(() => document.documentElement.dataset.modo) === 'oscuro', 'la pantalla de entrada respeta Automático');
    await ctx.close();
  }

  if (log) console.log('· Inicio: las tarjetas de las marcas (ajuste 4)');
  {
    rol = 'administrador';
    for (const [ancho, alto] of [[1440, 900], [1180, 820], [820, 1180], [390, 844]]) {
      const [ctx, p] = await nueva(ancho, alto);
      await p.goto(base + '/'); await p.waitForSelector('.ini-marca'); await p.waitForTimeout(250);
      const m = await p.evaluate(() => {
        const t = [...document.querySelectorAll('.ini-marca')].map(x => x.getBoundingClientRect());
        const u = [...document.querySelectorAll('.ini-marca')].map(x => [...x.querySelectorAll('.ini-unidad')].map(y => Math.round(y.getBoundingClientRect().height)));
        const acc = document.getElementById('accesos'), marcas = document.querySelector('.ini-marcas').getBoundingClientRect();
        const ocultos = [...document.querySelectorAll('.ini-marca details, .ini-marca [aria-expanded]')].length;
        return { n: t.length, altos: t.map(r => Math.round(r.height)), arriba: t.map(r => Math.round(r.top)), izq: t.map(r => Math.round(r.left)), unidades: u,
          hueco: acc && !acc.classList.contains('oculto') ? Math.round(acc.getBoundingClientRect().top - marcas.bottom) : null, ocultos, ancho: document.documentElement.scrollWidth <= innerWidth };
      });
      // Sin estirarse: ninguna unidad de Kids es más alta que la más alta de Vida en Arte (su alto es el de su contenido).
      const parejas = Math.max(...m.unidades[1]) <= Math.max(...m.unidades[0]) + 30;
      if (ancho > 640) ok(m.n === 2 && m.arriba[0] === m.arriba[1] && m.izq[0] !== m.izq[1] && Math.abs(m.altos[0] - m.altos[1]) <= 1 && parejas && !m.ocultos && m.ancho,
        ancho + ' px: Vida en Arte (3 unidades) y Kids (2) lado a lado, con la MISMA altura, unidades del mismo alto (sin estirarse) y todo a la vista (' + JSON.stringify(m) + ')');
      else ok(m.n === 2 && m.arriba[1] > m.arriba[0] && m.izq[0] === m.izq[1] && parejas && m.ancho, ancho + ' px: una tarjeta debajo de la otra (' + JSON.stringify(m) + ')');
      ok(m.hueco !== null && m.hueco >= (ancho > 640 ? 36 : 24), ancho + ' px: espacio entre las tarjetas y «Accesos rápidos» (' + m.hueco + ' px)');
      await ctx.close();
    }
  }

  if (log) console.log('· colores solo en los tokens (ajuste 3)');
  {
    const sinComentarios = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
    const fuera = (texto, nombre) => {
      const malos = []; let enPrint = false, nivel = 0;
      for (const l of sinComentarios(texto).split('\n')) {
        if (/@media print/.test(l)) { enPrint = true; nivel = 0; }
        if (enPrint) { nivel += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length; if (nivel <= 0 && /\}/.test(l)) enPrint = false; continue; }
        if (/eq-imprimiendo|#eq-impresion|theme-color/.test(l)) continue;
        // Un color escrito vale SOLO en la declaración de un token (--nombre: valor).
        // (y lo que es un selector, no un color: $('#cab'), querySelector('#ocCupos'), un id en una regla)
        const sinTokens = l.replace(/--[a-z0-9-]+\s*:[^;{}]*;?/gi, '').replace(/(\$|querySelector(All)?|getElementById|closest|matches)\(\s*['"][^'"]*['"]/g, '').replace(/^\s*[^{:]*#[\w-]+[^{]*\{/, '{');
        if (/#[0-9a-f]{3,8}\b|rgba?\((?!\s*(0, 0, 0|22, 24, 29|20, 26, 30|0,0,0|22,24,29)\b|"\s*\+)/i.test(sinTokens)) malos.push(nombre + ': ' + l.trim().slice(0, 90));   // (un rgb( armado con números calculados no es un color escrito)
      }
      return malos;
    };
    const archivos = ['comun/vea.css', 'comun/armazon.css', 'portal-raiz/index.html', 'portal-raiz/login.html', 'portal-raiz/cambiar-clave.html', 'after-school/index.html',
      'configuracion/index.html', 'procesos/index.html', 'equipo/index.html', 'resumen/index.html', 'proyecto-actio/index.html', 'kinder/index.html', 'mensajes/index.html', 'comun/organigrama.js', 'comun/verificacion.js', 'comun/visor-pantalla.js', 'comun/mensajes.js'];
    const malos = archivos.flatMap(f => fuera(leerComoSirve(f), f));
    // Un comentario sin cerrar «se come» las reglas que siguen, sin ningún error a la vista (pasó en el ajuste 3).
    const abiertos = ['comun/vea.css', 'comun/armazon.css'].filter(f => { let d = false, mal = false;
      for (const m of leerComoSirve(f).matchAll(/\/\*|\*\//g)) { if (m[0] === '/*') { if (d) mal = true; d = true; } else d = false; } return mal || d; });
    ok(!abiertos.length, 'los estilos no tienen comentarios sin cerrar' + (abiertos.length ? ' (' + abiertos.join(', ') + ')' : ''));
    ok(!malos.length, 'ningún color fuera de los tokens en los estilos ni en las páginas' + (malos.length ? ' (' + malos.length + ': ' + malos.slice(0, 4).join(' | ') + ')' : ''));
  }

  if (log) console.log('· contraste en los dos modos, en las pantallas principales (ajuste 3)');
  for (const modo of ['claro', 'oscuro']) {
    rol = 'administrador';
    for (const [ruta, nombre] of [['/', 'Inicio'], ['/after-school/#ocupacion', 'Ocupación'], [LISTA_FIJA, 'Pasar lista'], ['/after-school/#seguimiento', 'Seguimiento'], ['/after-school/#pagos', 'Pagos'], ['/procesos/#documentos', 'Procesos'], ['/resumen/', 'Resumen'], ['/mensajes/', 'Mensajes']]) {
      const [ctx, p] = await nueva(1440);
      await automatico(p);
      await p.emulateMedia({ colorScheme: modo === 'oscuro' ? 'dark' : 'light' });
      await p.goto(base + ruta); await p.waitForTimeout(1600);
      const c = await p.evaluate(medirContraste);
      ok(c.medidos > 10 && !c.fallan.length, modo + ' · ' + nombre + ': todo el texto a 4,5:1 o más (' + c.medidos + ' medidos' + (c.fallan.length ? '; fallan ' + c.fallan.length + ': ' + c.fallan.slice(0, 3).map(f => '«' + f.texto + '» ' + f.razon + ':1').join(' · ') : '') + ')');
      await ctx.close();
    }
  }
  /* 3-nov: comprobaciones FIJAS (antes dependían de lo que hubiera en pantalla según la hora: «1 clase sin lista»
     solo existe a ciertas horas y Preschool no se medía en oscuro). */
  {
    rol = 'administrador';
    const [ctx, p] = await nueva(1440);
    await automatico(p);
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.goto(base + '/after-school/#ocupacion'); await p.waitForTimeout(1600);
    const et = await p.evaluate(() => {
      const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const caja = document.createElement('div'); caja.innerHTML = '<span class="chip sinpago">Sin pago</span><div class="cifra alerta rosa">1 clase sin lista</div>';
      document.querySelector('main').appendChild(caja);
      return [...caja.children].map(e => Math.round(razon(getComputedStyle(e).color, getComputedStyle(e).backgroundColor) * 10) / 10);
    });
    ok(et.every(r => r >= 4.5), 'oscuro · las etiquetas rosadas («Sin pago», «clases sin lista») a 4,5:1 o más (' + et.join(', ') + ')');
    for (const [modo, letra] of [['oscuro', 'rgb(242, 241, 238)'], ['claro', 'rgb(22, 24, 29)']]) {
      await p.emulateMedia({ colorScheme: modo === 'oscuro' ? 'dark' : 'light' });
      await p.goto(base + '/kinder/'); await p.waitForTimeout(1600);
      const k = await p.evaluate(() => ({ modo: document.documentElement.dataset.modo, letra: getComputedStyle(document.body).color, tinta: getComputedStyle(document.documentElement).getPropertyValue('--tinta').trim() }));
      ok(k.modo === modo && k.letra === letra && k.tinta !== '', modo + ' · Preschool: el texto toma --tinta del sistema (sin un círculo que lo deje vacío) (' + k.letra + ', --tinta «' + k.tinta + '»)');
    }
    await ctx.close();
  }

  if (log) console.log('· Equipo en claro (ajuste 2)');
  {
    rol = 'administrador';
    const [ctx, p] = await nueva(1440);
    await p.goto(base + '/procesos/#equipo'); await p.waitForSelector('.eq-acceso', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(500);
    const e = await p.evaluate(() => ({
      oscura: document.documentElement.classList.contains('eq-escena'), clara: document.documentElement.classList.contains('eq-escena-clara'),
      fondo: getComputedStyle(document.body).backgroundColor, chispas: document.querySelectorAll('.eq-chispa, .eq-brillos, .particulas').length,
      titulo: getComputedStyle(document.querySelector('main h1')).color, acceso: (x => x && getComputedStyle(x).color)(document.querySelector('.eq-acceso')),
      barra: getComputedStyle(document.querySelector('.cab')).backgroundColor }));
    ok(!e.oscura && e.clara && e.fondo === 'rgb(250, 248, 245)' && !e.chispas, 'Equipo ya no usa la escena oscura: fondo claro de la app, sin partículas, chispas ni brillos (' + e.fondo + ')');
    ok(e.titulo === 'rgb(22, 24, 29)' && e.acceso === 'rgb(22, 24, 29)' && !/^rgba\(14, 15, 17/.test(e.barra), 'título, «Reglas del juego» / «Horarios» y la barra de arriba en los colores normales de la app');
    ok(!p.errores.length, 'Equipo sin errores de JavaScript' + (p.errores.length ? ' (' + p.errores.join(' | ') + ')' : ''));
    await ctx.close();
  }

  for (const r of Object.keys(ESPERADO)) {
    rol = r;
    const E = ESPERADO[r];
    if (log) console.log('· ' + ROLES[r].nombre);
    // Computador: barra lateral y «Nuevo».
    let [ctx, p] = await nueva(1440);
    await p.goto(base + '/'); await p.waitForSelector('.lat-item'); await p.waitForTimeout(400);
    const navs = await p.$$eval('.lat [data-nav]', l => l.map(x => x.dataset.nav));
    ok(JSON.stringify(navs) === JSON.stringify(E.nav), r + ': barra lateral = ' + E.nav.join(', ') + (JSON.stringify(navs) === JSON.stringify(E.nav) ? '' : ' (dio ' + navs.join(', ') + ')'));
    const pronto = await p.$$eval('.lat .lat-item.pronto', l => l.map(x => x.textContent));
    ok(pronto.every(t => /Próximamente/.test(t)) && (!E.nav.includes('cumpleanos') || pronto.length === 2), r + ': las secciones sin página dicen «Próximamente»');
    const nuevo = await p.$$eval('#nuevoMenu a', l => l.map(a => a.getAttribute('href').split('=')[1]));
    ok(JSON.stringify(nuevo) === JSON.stringify(E.nuevo) && (await p.$('#nuevo')) !== null === (E.nuevo.length > 0), r + ': «Nuevo» = ' + (E.nuevo.join(', ') || 'sin botón') + (JSON.stringify(nuevo) === JSON.stringify(E.nuevo) ? '' : ' (dio ' + nuevo.join(', ') + ')'));
    // Buscador: un niño, una clase, el documento de Procesos y el de Proyecto Actio.
    const buscar = async q => { await p.keyboard.press('Control+k'); await p.fill('#busTxt', q); await p.waitForTimeout(1200);
      const res = await p.$$eval('#busRes .bus-grupo, #busRes .bus-item b', l => l.map(x => (x.classList.contains('bus-grupo') ? '#' : '') + x.textContent)); await p.keyboard.press('Escape'); return res; };
    const rn = await buscar('zacarias');
    ok(rn.includes('#Niños') === E.ninos && rn.some(t => /Zacarías/.test(t)) === E.ninos, r + ': el buscador ' + (E.ninos ? 'encuentra' : 'NO encuentra') + ' niños (sin tilde ni mayúsculas)');
    const rc = await buscar('parkour lunes');
    ok(rc.includes('#Clases') === E.ninos, r + ': ' + (E.ninos ? 'encuentra' : 'no encuentra') + ' clases');
    const rd = await buscar('inventado');
    ok(rd.some(t => /Manual de bienvenida/.test(t)) && rd.some(t => /Informe reservado/.test(t)) === E.pa, r + ': documentos de Procesos' + (E.pa ? ' y de Proyecto Actio' : '; nada de Proyecto Actio'));
    const rs = await buscar('configuracion');
    ok(rs.some(t => t === 'Configuración') === E.nav.includes('configuracion'), r + ': las secciones, solo las de su rol');
    ok(!p.errores.length, r + ': sin errores de JavaScript' + (p.errores.length ? ' (' + p.errores.join(' | ') + ')' : ''));
    await ctx.close();
    // Tablet: barra de iconos de 76 px con el nombre en cada uno.
    [ctx, p] = await nueva(820);
    await p.goto(base + '/'); await p.waitForSelector('.lat-item');
    const t820 = await p.evaluate(() => ({ ancho: document.querySelector('.lat').getBoundingClientRect().width, titulos: [...document.querySelectorAll('.lat .lat-item')].every(a => a.title) }));
    ok(t820.ancho === 76 && t820.titulos, r + ': en tablet la barra es de iconos (76 px) y cada uno dice su nombre');
    await ctx.close();
    // Celular: barra inferior.
    [ctx, p] = await nueva(390, 844);
    await p.goto(base + '/'); await p.waitForSelector('.abajo-item');
    const abajo = await p.evaluate(() => ({ lat: getComputedStyle(document.querySelector('.lat')).display, items: [...document.querySelectorAll('.abajo .abajo-item')].map(x => x.dataset.nav || x.querySelector('span:not(.cab-numero)').textContent.trim()) }));
    const esperado = ['inicio', E.principal, 'Buscar', 'Avisos', 'Más'];
    ok(abajo.lat === 'none' && JSON.stringify(abajo.items) === JSON.stringify(esperado), r + ': en celular, barra inferior ' + esperado.join(' · ') + (JSON.stringify(abajo.items) === JSON.stringify(esperado) ? '' : ' (dio ' + abajo.items.join(' · ') + ')'));
    // 5-nov (ajuste): el panel «Más» muestra cada sección con su NOMBRE visible al lado del icono (antes, solo iconos),
    // y solo las secciones del rol (las mismas que su barra lateral).
    await p.click('#abrirMas'); await p.waitForTimeout(300);
    const mas = await p.$$eval('#hojaMas .lat-item', l => l.map(a => { const t = a.querySelector('.lat-txt'), r = t && t.getBoundingClientRect();
      return { nav: a.dataset.nav || '', txt: t ? t.textContent.trim() : '', ve: !!(t && getComputedStyle(t).display !== 'none' && r.width > 20 && r.height > 8), ancho: a.getBoundingClientRect().width }; }));
    ok(mas.length > 0 && mas.every(x => x.ve && x.txt && x.ancho > 200), r + ': en celular, «Más» con el nombre de cada sección (' + mas.filter(x => !x.ve).map(x => x.nav).join(', ') + ')');
    ok(JSON.stringify(mas.map(x => x.nav).filter(Boolean)) === JSON.stringify(navs.filter(x => mas.some(y => y.nav === x))) && mas.every(x => !x.nav || E.nav.includes(x.nav)), r + ': «Más» solo con las secciones de su rol');
    await ctx.close();
  }

  if (log) console.log('· notificaciones');
  {
    rol = 'administrador';
    let [ctx, p] = await nueva(1440);
    await p.goto(base + '/'); await p.waitForSelector('.lat-item'); await p.waitForTimeout(1500);
    const n = await p.textContent('#campanaN');
    await p.click('#campana'); await p.waitForTimeout(300);
    const avisos = await p.$$eval('#notifLista .notif-item b', l => l.map(b => b.textContent));
    ok(n === '2' && JSON.stringify(avisos) === JSON.stringify(['2 pruebas sin resultado', '3 contratos de posición por validar']), 'los avisos que manda el servidor (los que no son 0) y el número rojo: ' + n + ' · ' + avisos.join(' · '));
    await p.click('#notifLeer'); await p.waitForTimeout(200);
    ok(await p.$eval('#campanaN', b => b.classList.contains('oculto')), '«Marcar todo como leído» quita el número');
    await p.reload(); await p.waitForSelector('.lat-item'); await p.waitForTimeout(1500);
    ok(await p.$eval('#campanaN', b => b.classList.contains('oculto')), 'lo leído se recuerda al volver a entrar');
    rol = 'recepcion';
    await p.evaluate(() => sessionStorage.clear());
    await p.reload(); await p.waitForSelector('.lat-item'); await p.waitForTimeout(1500);
    ok(await p.textContent('#campanaN') === '2', 'otro usuario en el mismo navegador ve sus avisos sin leer (lo leído es por usuario)');
    await ctx.close();
  }

  if (log) console.log('· Ocupación');
  {
    rol = 'administrador';
    const [ctx, p] = await nueva(1440);
    await p.goto(base + '/after-school/#ocupacion'); await p.waitForSelector('#ocCifras .as-cifra'); await p.waitForTimeout(400);
    const L = asPost('leer').resultado, Cif = require(path.join(RAIZ, 'comun', 'cifras.js')), o = Cif.ocupacionAS(L);
    const cifras = await p.$$eval('#ocCifras .as-cifra', l => l.map(x => x.querySelector('.cifra-grande').textContent));
    ok(cifras[0] === Math.round(o.inscritos / o.cupos * 100) + ' %', 'ocupación de la semana = la del Resumen (' + cifras[0] + ')');
    ok(cifras[2] === String(L.ninos.filter(x => x.estado === 'Activo').length), 'inscritos activos = niños «Activo» (' + cifras[2] + ')');
    const clases = await p.$$eval('#grillas .oc-clase', l => l.map(x => ({ cifra: x.querySelector('.cifra').textContent, libres: (x.querySelector('.libres') || {}).textContent || '',
      casi: x.classList.contains('casi'), borde: getComputedStyle(x).borderTopColor })));
    const num = c => c.cifra.split('/').map(Number);
    const llenas = clases.filter(c => c.libres === 'Lleno'), casi = clases.filter(c => c.casi);
    ok(llenas.length && llenas.every(c => { const [t, k] = num(c); return t >= k; }) && clases.filter(c => { const [t, k] = num(c); return t >= k; }).length === llenas.length,
      '«Lleno» solo sin ningún cupo (' + llenas.length + ' clases)');
    ok(casi.length && casi.every(c => { const [t, k] = num(c); return t < k && t / k >= L.config.umbral && c.libres === (k - t) + (k - t === 1 ? ' libre' : ' libres'); }),
      '«Casi lleno» desde el umbral de Config: dice sus libres (' + casi.length + ' clases)');
    ok(casi.every(c => !llenas.length || c.borde !== llenas[0].borde || false) && await p.$eval('#grillas .oc-clase.casi .libres', e => getComputedStyle(e).color) === 'rgb(138, 83, 0)',
      '«Casi lleno» sin el borde de lleno y con sus libres en el color de alerta');
    ok(clases.filter(c => c.libres !== 'Lleno').every(c => { const [t, k] = num(c); return c.libres === (k - t) + (k - t === 1 ? ' libre' : ' libres'); }), 'cada clase que no está llena dice sus cupos libres (cupo − ocupados)');
    const detalle = await p.$eval('#ocCifras .as-cifra:nth-child(4) small', e => e.textContent);
    ok(cifras[3] === String(llenas.length) && detalle.split(' · ').length === llenas.length, 'clases llenas = solo las de 100 %, y el detalle las nombra (' + cifras[3] + ': ' + detalle + ')');
    ok(/naranja = casi lleno, desde \d+ %/.test(await p.textContent('#leyenda')), 'la leyenda explica lleno y casi lleno');
    const cupos = await p.$$eval('#ocCupos .oc-cupo .libres', l => l.map(x => parseInt(x.textContent, 10)));
    ok(cupos.length <= 6 && cupos.length > 0 && cupos.every((v, i) => !i || cupos[i - 1] >= v), '«Dónde hay más cupos»: hasta 6, de más a menos (' + cupos.join(', ') + ')');
    // 6-nov: «lo que queda de la semana» puede ser poco (un viernes en la tarde): la semana siguiente está entera,
    // así que ahí también se mira el orden, con el desempate por fecha (la más cercana primero).
    await p.click('#ocSig'); await p.waitForTimeout(300);
    const sig = await p.$$eval('#ocCupos .oc-cupo', l => l.map(x => ({ n: parseInt(x.querySelector('.libres').textContent, 10), f: x.dataset.fecha })));
    ok(sig.length > 1 && new Set(sig.map(x => x.f)).size > 1 && sig.every((v, i) => !i || sig[i - 1].n > v.n || (sig[i - 1].n === v.n && sig[i - 1].f <= v.f)),
      '«Dónde hay más cupos», semana siguiente: de más a menos y, si empatan, la fecha más cercana primero (' + sig.map(x => x.n + ' ' + x.f).join(', ') + ')');
    await p.click('#ocHoy'); await p.waitForTimeout(300);
    await p.click('[data-filtro="Telas"]'); await p.waitForTimeout(200);
    const soloTelas = await p.$$eval('#grillas .oc-clase .txt', l => [...new Set(l.map(x => x.textContent))]);
    ok(JSON.stringify(soloTelas) === '["Telas"]', 'el filtro por disciplina deja solo esa');
    await p.click('[data-filtro="Telas"]'); await p.waitForTimeout(200);
    await p.click('#grillas .oc-clase'); await p.waitForTimeout(300);
    ok(await p.$eval('#dlgClase', d => d.open), 'tocar una clase abre sus niños y visitas, como antes');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.keyboard.press('Control+k'); await p.fill('#busTxt', 'ZACARIAS'); await p.waitForTimeout(800); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !document.getElementById('v-registrar').classList.contains('oculto') && /Zacarías/.test(document.getElementById('ficha').textContent)),
      'buscador: elegir un niño (Enter) abre su ficha en After School');
    ok(!p.errores.length, 'Ocupación sin errores de JavaScript' + (p.errores.length ? ' (' + p.errores.join(' | ') + ')' : ''));
    await ctx.close();
  }

  if (log) console.log('· Pasar lista (tablet, Profesor)');
  {
    rol = 'profesor'; guardadas = [];
    const [ctx, p] = await nueva(820, 1180);
    await p.goto(base + '/after-school/'); await p.waitForTimeout(800);
    // El día con niños: un lunes o martes con Parkour (la lista abre la clase de la hora).
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-pl]')].find(x => /Parkour/.test(x.textContent)); if (b) b.click(); });
    await p.waitForTimeout(300);
    const hay = await p.$$('.pl-botones button');
    if (!hay.length) {
      // Hoy puede no tener Parkour: se va a un lunes.
      const lunes = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); });
      await p.evaluate(f => irADiaLista(f), lunes); await p.waitForTimeout(800);
      await p.evaluate(() => { const b = [...document.querySelectorAll('[data-pl]')].find(x => /Parkour/.test(x.textContent)); if (b) b.click(); });
      await p.waitForTimeout(300);
    }
        // El estado que NO está marcado en el primero (Tarde o Ausente): tocarlo marca, no quita.
    const elegido = await p.$eval('.pl-nino .pl-botones', g => g.querySelector('[data-e="Llegó tarde"]').getAttribute('aria-pressed') === 'true' ? 'Ausente' : 'Llegó tarde');
    const TARDE = '.pl-nino .pl-botones button[data-e="' + elegido + '"]';
    const b0 = await p.$eval(TARDE, b => b.getBoundingClientRect().width);
    const alto = await p.$eval(TARDE, b => b.getBoundingClientRect().height);
    await p.click(TARDE);
    const b1 = await p.$eval(TARDE, b => b.getBoundingClientRect().width);
    ok(alto >= 48 && Math.abs(b0 - b1) < 0.5, 'botones de 48 px que no cambian de ancho al marcarse (' + b0 + ' → ' + b1 + ')');
    const total = await p.$$eval('.pl-nino', l => l.length);
    const sin = await p.$$eval('.pl-nino', l => l.filter(x => !x.querySelector('[aria-pressed="true"]')).length);
    const txt = await p.textContent('#plGuardar');
    ok(sin > 0 ? txt === 'Guardar lista (' + sin + ' sin marcar)' : /^(Guardar lista|✓ Lista guardada)$/.test(txt), '«Guardar lista» dice cuántos faltan (' + txt + '; sin marcar: ' + sin + ')');
    const colorGuardar = () => p.$eval('#plGuardar', b => ({ des: b.disabled, fondo: getComputedStyle(b).backgroundColor }));
    const gris = await p.evaluate(() => { const b = document.createElement('button'); b.className = 'btn primario guardar'; b.disabled = true; document.body.appendChild(b);
      const f = getComputedStyle(b).backgroundColor; b.remove(); return f; });
    ok(gris === 'rgb(236, 232, 226)', '«Guardar lista» sin nada que guardar: gris (deshabilitado), no rojo pálido (' + gris + ')');
    const g1 = await colorGuardar();
    ok(!g1.des && g1.fondo === 'rgb(215, 28, 14)', '«Guardar lista» con marcas: rojo (' + g1.fondo + ')');
    const verde = await p.evaluate(() => { const g = document.createElement('div'); g.className = 'pl-botones'; g.innerHTML = '<button data-e="Presente" aria-pressed="true">x</button>';
      document.querySelector('.pl-ninos').appendChild(g); const f = getComputedStyle(g.firstChild).backgroundColor; g.remove(); return f; });
    const lum = c => { const v = c.match(/\d+/g).slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    ok(verde === 'rgb(39, 135, 70)' && 1.05 / (lum(verde) + 0.05) >= 4.5, '«Presente»: el verde de ok (#278746), con letra blanca a ' + (1.05 / (lum(verde) + 0.05)).toFixed(2) + ':1');
    await p.click('#plTodos'); await p.click('#plGuardar'); await p.waitForTimeout(800);
    const g0 = guardadas[0];
    ok(guardadas.length === 1 && g0.marcas.length === total && g0.marcas[0].estado === elegido && g0.marcas.slice(1).every(m => m.estado === 'Presente'),
      'se guarda lo mismo que antes: una marca por niño, en guardarLista');
    ok(!p.errores.length, 'Pasar lista sin errores de JavaScript' + (p.errores.length ? ' (' + p.errores.join(' | ') + ')' : ''));
    await ctx.close();
  }
  return { fallos, total };
}

/* Roturas: con estos cambios, la prueba TIENE que fallar. */
const ROTURAS = [
  // 5-nov (ajuste 4): sol/luna, Claro por defecto y las tarjetas de Inicio.
  ['por defecto vuelve a Automático', 'comun/tema.js', "DEFECTO = 'claro';", "DEFECTO = 'auto';"],
  ['sin el botón sol/luna', 'comun/marca.js', "nuevoHtml() + temaHtml() +", "nuevoHtml() +"],
  ['el botón sol/luna se esconde en celular', 'comun/armazon.css', ".cab-buscar, .cab-campana { display: none; }", ".cab-buscar, .cab-campana, .cab-tema { display: none; }"],
  ['el botón sol/luna no alterna', 'comun/tema.js', "window.Apariencia.elegir(modo() === 'oscuro' ? 'claro' : 'oscuro', usuario);", "window.Apariencia.elegir('oscuro', usuario);"],
  ['las tarjetas de Inicio con distinta altura', 'comun/vea.css', "grid-auto-columns: minmax(0, 1fr); gap: 20px; align-items: stretch; }", "grid-auto-columns: minmax(0, 1fr); gap: 20px; align-items: start; }"],
  ['las tarjetas de Inicio una debajo de la otra en tablet', 'comun/vea.css', ".ini-marcas { display: grid; grid-auto-flow: column;", ".ini-marcas { display: grid; grid-auto-flow: row;"],
  ['«Accesos rápidos» pegado a las tarjetas', 'comun/vea.css', ".ini-marcas + #accesos, .ini-marcas + .ini-resumen { margin-top: 40px; }", ".ini-marcas + #accesos, .ini-marcas + .ini-resumen { margin-top: 0; }"],
  // (Pedir niños sin as.ver tampoco es rotura de esta pieza: after-school/api.php se los niega; lo prueba prueba-portal.js.)
  ['vuelven las partículas de fondo', 'comun/marca.js', "    enganchar();", "    document.body.insertAdjacentHTML('beforeend', '<div class=\"particulas\" aria-hidden=\"true\"><i></i></div>'); enganchar();"],
  ['algo se mueve sin parar detrás del contenido', 'comun/armazon.css', "/* ── Esqueletos de carga (Marca.esqueleto)", ".lat-logo { animation: vea-gira 9s linear infinite; } @keyframes vea-gira { to { opacity: .99; } }\n/* ── Esqueletos de carga (Marca.esqueleto)"],
  ['elegir un niño no abre su ficha', 'comun/marca.js', "if (r.tipo === 'nino') ir('/after-school/#ficha=' + encodeURIComponent(r.dato.id));", "if (r.tipo === 'nino') ir('/after-school/#ocupacion');"],
  // (Pedir Proyecto Actio sin el área no es rotura de esta pieza: el puente lo niega, y eso lo prueba prueba-portal.js.)
  ['el buscador distingue tildes', 'comun/marca.js', "const coincide = (texto, q) => { const h = normal(texto);", "const coincide = (texto, q) => { const h = String(texto).toLowerCase();"],
  ['la barra lateral muestra todo a todos', 'comun/marca.js', "const veItem = it => it.areas.every(ve);", "const veItem = it => true;"],
  ['«Nuevo» ofrece acciones sin permiso', 'comun/marca.js', "NUEVO.filter(a => permAS(a.permiso))", "NUEVO.slice()"],
  ['las notificaciones cuentan los avisos en 0', 'comun/marca.js', "filter(x => NOTIFICACIONES[x.clave] && x.n);", "filter(x => NOTIFICACIONES[x.clave]);"],
  ['lo leído no se recuerda por usuario', 'comun/marca.js', "const claveUsuario = k => 'vea360.' + k + '.' + (S ? S.usuario : '');", "const claveUsuario = k => 'vea360.' + k;"],
  ['«Lleno» con cualquier ocupación', 'after-school/index.html', "const estaLleno = est => est === 'lleno';", "const estaLleno = est => est !== 'inactiva';"],
  ['«Lleno» vuelve a empezar en el umbral (casi lleno)', 'after-school/index.html', "const estaLleno = est => est === 'lleno';", "const estaLleno = est => est === 'lleno' || est === 'casi';"],
  ['«Guardar lista» deshabilitado vuelve al rojo pálido', 'comun/vea.css', ".btn.primario:disabled, .btn.negro:disabled, .btn.azul:disabled { opacity: 1;", ".x-sin-uso:disabled { opacity: 1;"],
  ['el verde de ok vuelve al claro (blanco a 3,5:1)', 'comun/vea.css', "--ok: #278746;", "--ok: #2E9D4F;"],
  ['«Dónde hay más cupos» sin ordenar', 'after-school/index.html', ".sort((a, b) => b.libres - a.libres || a.iso.localeCompare(b.iso) || a.c.hora.localeCompare(b.c.hora)).slice(0, 6);", ".slice(0, 6).reverse();"],
  ['los botones de Pasar lista cambian de ancho', 'comun/vea.css', ".pl-botones button[aria-pressed=\"true\"] .pl-check { display: inline-block; }", ".pl-botones button[aria-pressed=\"true\"] .pl-check { display: inline-block; } .pl-botones button[aria-pressed=\"true\"] { width: 130px; }"],
  ['Preschool vuelve a redefinir --tinta en círculo', 'kinder/index.html', "  --tinta2:var(--texto-2);", "  --tinta:var(--texto); --linea:var(--gris); --tinta2:var(--texto-2);"],
  ['Equipo vuelve al fondo oscuro', 'comun/organigrama.js', "classList.toggle('eq-escena-clara', si);", "classList.toggle('eq-escena-clara', si); document.documentElement.classList.toggle('eq-escena', si); document.body.style.background = '#0E0F11';"],
  ['la barra inferior no aparece en celular', 'comun/armazon.css', "  .abajo { display: flex;", "  .abajo { display: none;"],
  // 3-nov (ajuste 3): la apariencia
  ['Automático no sigue al dispositivo cuando cambia', 'comun/tema.js', "if (actual === 'auto') aplicar('auto');", ""],
  ['la elección no es por usuario (vale la del último)', 'comun/tema.js', "deUsuario: function (usuario) { if (!usuario) return;", "deUsuario: function (usuario) { return;"],
  ['al imprimir sigue en oscuro', 'comun/tema.js', "window.addEventListener('beforeprint', function () { imprimiendo = true; raiz.setAttribute('data-modo', 'claro'); });", ""],
  ['los menús se cortan: cualquier clic «elige» una apariencia', 'comun/marca.js', "t.closest('button[data-apariencia]')", "t.closest('[data-apariencia]')"],
  ['un color escrito fuera de los tokens', 'comun/vea.css', ".btn:hover { background: var(--fondo-suave);", ".btn:hover { background: #F4F1EC;"],
  ['en oscuro, las etiquetas rosadas quedan claras sobre claro', 'comun/vea.css', "  --rosa: #4A1F1B; --arena: #45351A;", ""],
  ['un comentario sin cerrar se come las reglas que siguen', 'comun/vea.css', 'el gris suave no llegaba a 4,5 */', 'el gris suave no llegaba a 4,5']
];

(async () => {
  const srv = servidor().listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const nav = await chromium.launch(process.env.CHROME_RUTA ? { executablePath: process.env.CHROME_RUTA } : { channel: 'chrome' });
  const r = await correr(nav, base, true);
  console.log(r.fallos ? '✗ ' + r.fallos + ' de ' + r.total + ' fallan' : '✓ ' + r.total + ' comprobaciones pasan');
  let noDetectadas = 0;
  if (!r.fallos && !process.env.SIN_ROTURAS) {
    console.log('· roturas');
    for (const [que, archivo, a, b] of ROTURAS) {
      mutaciones = { [archivo]: [[a, b]] };
      let x;
      try { x = await correr(nav, base, false); } catch (e) { x = { fallos: 1 }; }
      console.log((x.fallos ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + que); if (!x.fallos && process.env.GITHUB_ACTIONS) console.log('::error title=Rotura no detectada::' + que);
      if (!x.fallos) noDetectadas++;
    }
    mutaciones = {};
    console.log(noDetectadas ? '✗ ' + noDetectadas + ' roturas no se detectan' : '✓ las ' + ROTURAS.length + ' roturas se detectan');
  }
  await nav.close(); srv.close();
  process.exit(r.fallos || noDetectadas ? 1 : 0);
})();
