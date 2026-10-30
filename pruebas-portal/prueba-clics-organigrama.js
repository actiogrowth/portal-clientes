/* Clics REALES en el organigrama de Procesos › Equipo (30-oct, ajuste 2),
 * con Chrome manejado por Playwright: el mouse se mueve encima de la tarjeta
 * (como una persona), espera y hace clic en coordenadas; en tablet, un toque.
 * element.click() se salta el «hit testing» del navegador y no ve el error
 * que tuvo b4d1ff6: con el plano inclinado en 3D, Chrome ubicaba mal las
 * tarjetas transformadas y el clic caía en su columna.
 *
 *   node pruebas-portal/prueba-clics-organigrama.js [carpeta-del-portal]
 *
 * Necesita playwright-core (npm i --no-save playwright-core) y Chrome
 * instalado (channel 'chrome'; otro con CHROME_RUTA=<ruta al ejecutable>).
 * Datos INVENTADOS con la forma del Sheet de hoy: 28 puestos, 6 áreas
 * (4, 2, 2, 7, 7 y 5 puestos), con puestos que cuelgan de otro que no es la
 * coordinación. Sin red: un servidor propio sirve las páginas y un
 * /equipo/api.php de mentira.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
let fallos = 0, total = 0;
const ok = (c, que) => { total++; if (!c) { fallos++; console.log('  ✗ ' + que); } else console.log('  ✓ ' + que); };

const P = (id, puesto, area, reportaA, estado) => ({ id, puesto, area, reportaA, estado: estado || 'Borrador', ficha: true, unidad: 'Unidad', cantidad: '', version: 1, fechaVersion: '2026-10-29' });
const PUESTOS = [P('DIR', 'Dirección', 'Dirección', '', 'Por cargar'),
  P('C0', 'Coordinación comercial de prueba', 'Comercial', 'DIR'), P('C1', 'Comercial uno', 'Comercial', 'C0', 'Por cargar'), P('C2', 'Comercial dos', 'Comercial', 'C0'), P('C3', 'Comercial tres', 'Comercial', 'C0', 'Por cargar'),
  P('A0', 'Coordinación administrativa de prueba', 'Administración', 'DIR'), P('A1', 'Cobros de prueba', 'Administración', 'A0'),
  P('O0', 'Coordinación operativa de prueba', 'Operación', 'DIR'), P('O1', 'Limpieza de prueba · turno mañana', 'Operación', 'O0'),
  P('S0', 'Coordinación preescolar de prueba', 'Preschool', 'DIR'), P('S1', 'Asistente de prueba', 'Preschool', 'S0', 'Por cargar'), P('S2', 'Auxiliar de prueba', 'Preschool', 'S1'),
  P('S3', 'Maestra principal de prueba', 'Preschool', 'S0'), P('S4', 'Maestra asistente de prueba', 'Preschool', 'S3'), P('S5', 'Maestra de la tarde de prueba', 'Preschool', 'S0'), P('S6', 'Maestra de bebés de prueba', 'Preschool', 'S0'),
  P('F0', 'Coordinación de la tarde de prueba', 'After School', 'DIR'), P('F1', 'Recepción de prueba', 'After School', 'F0'), P('F2', 'Profesor uno de prueba', 'After School', 'F0'), P('F3', 'Profesora dos de prueba', 'After School', 'F0'),
  P('F4', 'Asistente dos de prueba', 'After School', 'F3', 'Por cargar'), P('F5', 'Profesor tres de prueba', 'After School', 'F0'), P('F6', 'Eventos de prueba', 'After School', 'F0'),
  P('V0', 'Coordinación de verano de prueba', 'Veranito', 'DIR', 'Por cargar'), P('V1', 'Recepción de verano de prueba', 'Veranito', 'V0', 'Por cargar'), P('V2', 'Profesor de verano de prueba', 'Veranito', 'V0', 'Por cargar'),
  P('V3', 'Profesora de verano de prueba', 'Veranito', 'V0', 'Por cargar'), P('V4', 'Auxiliar de verano de prueba', 'Veranito', 'V0', 'Por cargar')];
const FICHA = { version: 1, fechaVersion: '2026-10-29', verifica: 'Dirección, cada semana', comoVerifica: '', unidad: 'Unidad', contrato: { resultado: ['Resultado de prueba'], trabajo: ['Trabajo de prueba'], estandares: ['Estándar de prueba'] },
  lista: [], procesos: [], ocupo: false, jefe: false, verifico: false, aceptada: false, aceptadaVersion: null, aceptadaFecha: '', verificador: null, pdf: true, hojas: [], marcas: [], revisiones: [] };
const LEER = { hoy: '2026-10-29', generado: '', yo: { usuario: 'admin-de-prueba', todo: true }, puestos: PUESTOS, fichas: Object.fromEntries(PUESTOS.map(p => [p.id, FICHA])),
  mios: [], revisar: [], reglas: [], momentos: [], horarios: [], faltan: [], personas: {} };
const SESION = { ok: true, usuario: 'admin-de-prueba', nombre: '', apellido: '', roles: [{ id: 'admin', nombre: 'Administrador' }], areas: '*', inicio: '/' };
// Las cuatro tarjetas (de cuatro áreas, arriba y abajo de sus columnas) que se tocan.
const OBJETIVOS = ['O0', 'S3', 'F6', 'V1'];

function servidor() {
  const tipos = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webmanifest: 'application/manifest+json' };
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const json = o => { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
    if (url === '/acceso.php') return json(SESION);
    if (url === '/equipo/api.php') return json({ ok: true, resultado: LEER });
    const archivo = url === '/procesos/' ? path.join(RAIZ, 'procesos', 'index.html') : url.startsWith('/comun/') ? path.join(RAIZ, url) : null;
    if (!archivo || !fs.existsSync(archivo)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': tipos[archivo.split('.').pop()] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

/** Lleva la tarjeta a la vista y devuelve el centro de lo que se ve de ella. */
async function centro(page, id) {
  return page.evaluate(id => {
    const b = document.querySelector('[data-eq-puesto="' + id + '"]');
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
}
const abierta = page => page.evaluate(() => { const d = document.querySelector('dialog.eq-dialogo'); return d && d.open ? document.getElementById('eqFichaTit').textContent : ''; });
const cerrar = async page => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
const bajo = (page, p) => page.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const b = e && e.closest('[data-eq-puesto]'); return b ? b.dataset.eqPuesto : (e ? e.className.toString().split(' ')[0] || e.tagName : 'nada'); }, p);
const nombre = id => PUESTOS.find(p => p.id === id).puesto;

async function preparar(navegador, opciones) {
  const ctx = await navegador.newContext(opciones);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto(base + '/procesos/#equipo');
  await page.waitForSelector('[data-eq-puesto="DIR"]');
  await page.waitForTimeout(3200);   // termina la entrada en cascada (~2,5 s)
  return { ctx, page, errores };
}

let base = '';
(async () => {
  const srv = servidor();
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;
  const navegador = await chromium.launch(process.env.CHROME_RUTA ? { executablePath: process.env.CHROME_RUTA } : { channel: 'chrome' });
  try {
    console.log('· computador (1366 × 768), mouse real: pasar por encima, esperar y hacer clic');
    {
      const { ctx, page, errores } = await preparar(navegador, { viewport: { width: 1366, height: 768 } });
      for (const id of OBJETIVOS) {
        const p = await centro(page, id);
        await page.mouse.move(p.x - 40, p.y - 30);
        await page.mouse.move(p.x, p.y, { steps: 5 });
        await page.waitForTimeout(500);   // la tarjeta «se levanta» (transición de 0,35 s)
        const debajo = await bajo(page, p);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(250);
        const t = await abierta(page);
        ok(t === nombre(id), 'clic en «' + nombre(id) + '»: abre su ficha (debajo del puntero: ' + debajo + '; ficha: «' + t + '»)');
        if (t) await cerrar(page);
      }
      // «Cualquier parte visible»: también cerca de las esquinas de la tarjeta (a 8 px del borde).
      for (const id of ['S2', 'F4']) {
        const esquinas = await page.evaluate(id => { const b = document.querySelector('[data-eq-puesto="' + id + '"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect();
          return [[r.left + 8, r.top + 8], [r.right - 8, r.top + 8], [r.left + 8, r.bottom - 8], [r.right - 8, r.bottom - 8]].map(([x, y]) => ({ x, y })); }, id);
        let abiertas = 0;
        for (const q of esquinas) { await page.mouse.move(q.x, q.y, { steps: 3 }); await page.waitForTimeout(450); await page.mouse.click(q.x, q.y); await page.waitForTimeout(200); if (await abierta(page) === nombre(id)) { abiertas++; await cerrar(page); } }
        ok(abiertas === 4, 'clic en las cuatro esquinas de «' + nombre(id) + '»: ' + abiertas + ' de 4 abren su ficha');
      }
      // 30-oct: la manito. A la escala de «Ajustar», sin arrastre en computador; con +, sí.
      const cursores = await page.evaluate(() => ({ lienzo: getComputedStyle(document.querySelector('.eq-lienzo')).cursor, tarjeta: getComputedStyle(document.querySelector('[data-eq-puesto="O0"]')).cursor }));
      ok(cursores.lienzo !== 'grab' && cursores.tarjeta === 'pointer', 'a la escala de «Ajustar»: el fondo sin manito, las tarjetas con la mano de clic (' + JSON.stringify(cursores) + ')');
      const transformada = () => page.evaluate(() => document.querySelector('.eq-mundo').style.transform);
      const antes = await transformada();
      // Un punto del fondo del lienzo (sin tarjeta), con el lienzo ya en pantalla.
      const caja = await page.evaluate(() => { const r = document.querySelector('.eq-lienzo').getBoundingClientRect(); window.scrollBy(0, r.top - 200); const q = document.querySelector('.eq-lienzo').getBoundingClientRect(); return { x: q.left + 10, y: Math.min(q.bottom - 20, innerHeight / 2) }; });
      ok(['eq-lienzo', 'eq-mundo', 'eq-escenario', 'eq-plano'].includes(await bajo(page, caja)), '(control) el punto para arrastrar es el fondo del organigrama (' + await bajo(page, caja) + ')');
      await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await page.mouse.move(caja.x + 120, caja.y + 10, { steps: 6 }); await page.mouse.up();
      ok(await transformada() === antes, 'a esa escala, arrastrar con el mouse no mueve el organigrama');
      await page.click('[data-eq-zoom="+"]');
      const cursorZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.eq-lienzo')).cursor);
      const antes2 = await transformada();
      await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await page.mouse.move(caja.x + 120, caja.y + 10, { steps: 6 }); await page.mouse.up();
      ok(cursorZoom === 'grab' && await transformada() !== antes2, 'después de acercar con +: la manito de arrastrar, y arrastrar mueve el organigrama (' + cursorZoom + ')');
      await page.click('[data-eq-zoom="ajustar"]');
      ok(await page.evaluate(() => getComputedStyle(document.querySelector('.eq-lienzo')).cursor) !== 'grab', '«Ajustar» vuelve a quitar la manito');
      const p = await centro(page, 'S3');
      await page.mouse.move(p.x, p.y, { steps: 3 }); await page.waitForTimeout(400); await page.mouse.click(p.x, p.y); await page.waitForTimeout(250);
      ok(await abierta(page) === nombre('S3'), 'y después de acercar y ajustar, el clic sigue abriendo la ficha');
      ok(!errores.length, 'sin errores de JavaScript (' + errores.join(' | ') + ')');
      await ctx.close();
    }
    console.log('· tablet (768 × 1024, táctil): un toque en la tarjeta');
    {
      const { ctx, page, errores } = await preparar(navegador, { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: false });
      for (const id of OBJETIVOS) {
        const p = await centro(page, id);
        const debajo = await bajo(page, p);
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForTimeout(300);
        const t = await abierta(page);
        ok(t === nombre(id), 'toque en «' + nombre(id) + '»: abre su ficha (debajo del dedo: ' + debajo + '; ficha: «' + t + '»)');
        if (t) await cerrar(page);
      }
      ok(await page.evaluate(() => document.querySelector('.eq-lienzo').classList.contains('puede-arrastrar')), 'en pantalla táctil el organigrama siempre se puede arrastrar');
      ok(!errores.length, 'sin errores de JavaScript (' + errores.join(' | ') + ')');
      await ctx.close();
    }
  } finally {
    await navegador.close();
    srv.close();
  }
  console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
