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
      if (url === '/acceso.php') return json(S);
      if (url === '/pendientes/api.php') return ve('equipo') ? json({ ok: true, resultado: { hoy: asPost('leer').resultado.hoy, items: PENDIENTES } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/procesos/api.php') return ve('procesos') ? json({ ok: true, resultado: { procesos: [], documentos: [DOC_PROC] } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/proyecto-actio/api.php') return ve('proyecto-actio') ? json({ ok: true, resultado: { proyectos: ['Proyecto 1'], entregables: [], documentos: [DOC_PA], reuniones: [], atencion: [], faltan: [] } }) : json({ ok: false, codigo: 'sin_permiso' }, 403);
      if (url === '/equipo/api.php') return json({ ok: true, resultado: { hoy: '', mios: [], revisar: [], puestos: [], fichas: {} } });
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
      const PAG = { '/': 'portal-raiz/index.html', '/after-school/': 'after-school/index.html' };
      const rel = PAG[url] || (url.startsWith('/comun/') ? url.slice(1) : null);
      if (!rel || !fs.existsSync(path.join(RAIZ, rel))) { res.writeHead(404); res.end('no'); return; }
      let t = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
      for (const [a, b] of mutaciones[rel] || []) { if (!t.includes(a)) throw new Error('la rotura no encuentra su texto en ' + rel + ': ' + a); t = t.replace(a, b); }
      res.writeHead(200, { 'Content-Type': tipos[rel.split('.').pop()] || 'text/plain', 'Cache-Control': 'no-store' });
      res.end(t);
    });
  });
}

/* ── Lo esperado por rol ────────────────────────────────────────────────── */
const TODO = ['inicio', 'afterschool', 'veranito', 'cumpleanos', 'kinder', 'babyandme', 'resumen', 'procesos', 'equipo', 'basededatos', 'proyecto-actio', 'configuracion'];
const ESPERADO = {
  administrador:            { nav: TODO, nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: true, principal: 'afterschool' },
  direccion:                { nav: TODO, nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: true, principal: 'afterschool' },
  coordinacion_afterschool: { nav: ['inicio', 'afterschool', 'procesos', 'equipo', 'basededatos'], nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: false, principal: 'afterschool' },
  recepcion:                { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: ['inscribir', 'visita', 'pago'], ninos: true, pa: false, principal: 'afterschool' },
  comercial:                { nav: ['inicio', 'afterschool', 'kinder', 'procesos', 'equipo', 'basededatos'], nuevo: ['visita'], ninos: true, pa: false, principal: 'afterschool' },
  contabilidad:             { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: ['pago'], ninos: true, pa: false, principal: 'afterschool' },
  coordinacion_preescolar:  { nav: ['inicio', 'kinder', 'procesos', 'equipo', 'basededatos'], nuevo: [], ninos: false, pa: false, principal: 'kinder' },
  profesor:                 { nav: ['inicio', 'afterschool', 'procesos', 'equipo'], nuevo: [], ninos: false, pa: false, principal: 'afterschool' }
};

/* ── La prueba ─────────────────────────────────────────────────────────── */
async function correr(nav, base, log) {
  let fallos = 0, total = 0;
  const ok = (c, que) => { total++; if (!c) fallos++; if (log || !c) console.log((c ? '  ✓ ' : '  ✗ ') + que); };
  const nueva = async (ancho, alto) => { const ctx = await nav.newContext({ viewport: { width: ancho, height: alto || 900 }, reducedMotion: 'reduce', hasTouch: ancho < 1100 });
    const p = await ctx.newPage(); p.errores = []; p.on('pageerror', e => p.errores.push(e.message)); return [ctx, p]; };

  if (log) console.log('· sistema visual');
  {
    const css = fs.readFileSync(path.join(RAIZ, 'comun', 'vea.css'), 'utf8'), raiz = /:root \{([\s\S]*?)\n\}/.exec(css)[1];
    const COLORES = { fondo: '#FAF8F5', panel: '#FFFFFF', linea: '#ECE8E2', tinta: '#16181D', suave: '#5B5F68', tenue: '#8A8E96', accion: '#D71C0E',
      parkour: '#E0412F', telas: '#1974A8', parkids: '#F2A01E', babyme: '#7FB3D5', ok: '#2E9D4F', alerta: '#E08A00', peligro: '#D71C0E' };
    ok(Object.entries(COLORES).every(([k, v]) => new RegExp('--' + k + ': ' + v + '[;\\s]').test(raiz)), 'vea.css: los colores del sistema (fondo, panel, línea, tinta, disciplinas y estados)');
    const paginas = ['portal-raiz/index.html', 'portal-raiz/login.html', 'portal-raiz/cambiar-clave.html', 'after-school/index.html', 'configuracion/index.html', 'procesos/index.html',
      'equipo/index.html', 'resumen/index.html', 'proyecto-actio/index.html', 'veranito/index.html', 'kinder/index.html'];
    const malas = paginas.filter(f => { const t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); return !/\/comun\/vea\.css\?v=/.test(t) || /class="vidrio"|fondo-local/.test(t); });
    ok(!malas.length, 'todas las páginas usan vea.css y ninguna lleva el vidrio ni la foto vieja' + (malas.length ? ' (' + malas.join(', ') + ')' : ''));
    ok(!/fondo-local|\.vidrio body/.test(css + fs.readFileSync(path.join(RAIZ, 'comun', 'organigrama.js'), 'utf8')), 'vea.css y el organigrama sin la foto de fondo');
    const arm = fs.readFileSync(path.join(RAIZ, 'comun', 'armazon.css'), 'utf8');
    ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.particulas i \{ animation: none/.test(arm) && /\.vea-pausa \.particulas i \{ animation-play-state: paused; \}/.test(arm) && /\.particulas \{[^}]*pointer-events: none/.test(arm),
      'partículas: quietas con «reducir movimiento», en pausa con la pestaña oculta y sin recibir clics');
    const mj = fs.readFileSync(path.join(RAIZ, 'comun', 'marca.js'), 'utf8'), n = +/for \(let i = 0; i < (\d+); i\+\+\) \{\s*const tam/.exec(mj)[1];
    ok(n <= 30, 'partículas: ' + n + ' (máximo 30)');
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
    const clases = await p.$$eval('#grillas .oc-clase', l => l.map(x => ({ cifra: x.querySelector('.cifra').textContent, libres: (x.querySelector('.libres') || {}).textContent || '' })));
    const llenas = clases.filter(c => c.libres === 'Lleno');
    ok(llenas.length && llenas.every(c => { const [t, k] = c.cifra.split('/').map(Number); return t / k >= L.config.umbral; }), '«Lleno» desde el umbral de Config (' + llenas.length + ' clases)');
    ok(clases.filter(c => c.libres !== 'Lleno').every(c => { const [t, k] = c.cifra.split('/').map(Number); return c.libres === (k - t) + (k - t === 1 ? ' libre' : ' libres'); }), 'cada clase dice sus cupos libres (cupo − ocupados)');
    ok(cifras[3] === String(llenas.length), 'clases llenas = las que dicen «Lleno» (' + cifras[3] + ')');
    const cupos = await p.$$eval('#ocCupos .oc-cupo .libres', l => l.map(x => parseInt(x.textContent, 10)));
    ok(cupos.length <= 6 && cupos.length > 0 && cupos.every((v, i) => !i || cupos[i - 1] >= v), '«Dónde hay más cupos»: hasta 6, de más a menos (' + cupos.join(', ') + ')');
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
  // (Pedir niños sin as.ver tampoco es rotura de esta pieza: after-school/api.php se los niega; lo prueba prueba-portal.js.)
  ['elegir un niño no abre su ficha', 'comun/marca.js', "if (r.tipo === 'nino') ir('/after-school/#ficha=' + encodeURIComponent(r.dato.id));", "if (r.tipo === 'nino') ir('/after-school/#ocupacion');"],
  // (Pedir Proyecto Actio sin el área no es rotura de esta pieza: el puente lo niega, y eso lo prueba prueba-portal.js.)
  ['el buscador distingue tildes', 'comun/marca.js', "const coincide = (texto, q) => { const h = normal(texto);", "const coincide = (texto, q) => { const h = String(texto).toLowerCase();"],
  ['la barra lateral muestra todo a todos', 'comun/marca.js', "const veItem = it => it.areas.every(ve);", "const veItem = it => true;"],
  ['«Nuevo» ofrece acciones sin permiso', 'comun/marca.js', "NUEVO.filter(a => permAS(a.permiso))", "NUEVO.slice()"],
  ['las notificaciones cuentan los avisos en 0', 'comun/marca.js', "filter(x => NOTIFICACIONES[x.clave] && x.n);", "filter(x => NOTIFICACIONES[x.clave]);"],
  ['lo leído no se recuerda por usuario', 'comun/marca.js', "const claveUsuario = k => 'vea360.' + k + '.' + (S ? S.usuario : '');", "const claveUsuario = k => 'vea360.' + k;"],
  ['«Lleno» con cualquier ocupación', 'after-school/index.html', "const estaLleno = est => est === 'lleno' || est === 'casi';", "const estaLleno = est => est !== 'inactiva';"],
  ['«Dónde hay más cupos» sin ordenar', 'after-school/index.html', ".sort((a, b) => b.libres - a.libres || a.iso.localeCompare(b.iso) || a.c.hora.localeCompare(b.c.hora)).slice(0, 6);", ".slice(0, 6).reverse();"],
  ['los botones de Pasar lista cambian de ancho', 'comun/vea.css', ".pl-botones button[aria-pressed=\"true\"] .pl-check { display: inline-block; }", ".pl-botones button[aria-pressed=\"true\"] .pl-check { display: inline-block; } .pl-botones button[aria-pressed=\"true\"] { width: 130px; }"],
  ['la barra inferior no aparece en celular', 'comun/armazon.css', "  .abajo { display: flex;", "  .abajo { display: none;"]
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
      console.log((x.fallos ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + que);
      if (!x.fallos) noDetectadas++;
    }
    mutaciones = {};
    console.log(noDetectadas ? '✗ ' + noDetectadas + ' roturas no se detectan' : '✓ las ' + ROTURAS.length + ' roturas se detectan');
  }
  await nav.close(); srv.close();
  process.exit(r.fallos || noDetectadas ? 1 : 0);
})();
