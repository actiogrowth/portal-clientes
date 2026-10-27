/* Tablero de Preschool operativo (kinder/index.html, 28-oct), con datos
 * INVENTADOS y un documento de mentira, y sus roturas (cada una tiene que
 * hacer fallar alguna comprobación).
 *
 * Lo que se comprueba (R138, R139):
 *   · ningún monto en pantalla, aunque la hoja mandara la columna de pagos;
 *   · el globo de cada cupo dice solo nombre y edad;
 *   · cupos libres por salón con la capacidad de «Config Kínder»;
 *   · salidas del mes con su motivo, o «Motivo no registrado»;
 *   · pendientes de pago: quién y desde qué mes, solo inscritos, solo meses
 *     activos y hasta el último mes con pagos cargados;
 *   · plan «por registrar» para todos, aunque la hoja trajera un plan.
 * Lo que entrega el servidor (kinder/csv.php sin montos) se prueba en
 * prueba-portal.js, con PHP.
 *
 *   node pruebas-portal/prueba-preschool.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'kinder', 'index.html'), 'utf8');

/* ── Datos inventados ─────────────────────────────────────────────────── */
/* [id, nombre, unidad, salón, ingreso, salida, motivo, meses activos [desde, hasta], meses sin pago, mes inactivo] */
const NINOS = [
  ['K-01', 'Ana Prueba', 'Kínder', 'Green Room', '05/01/2026', '', '', [1, 10], [9]],
  ['K-02', 'Beto Prueba', 'Kínder', 'Green Room', '10/02/2026', '', '', [2, 10], [7, 8, 9]],
  ['K-03', 'Ciro Prueba', 'Kínder', 'Red Room', '03/03/2026', '', '', [3, 10], []],
  ['K-04', 'Dora Prueba', 'Kínder', 'Red Room', '01/01/2026', '20/10/2026', 'Se mudó', [1, 10], []],
  ['K-05', 'Eli Prueba', 'Kínder', 'Red Room', '01/02/2026', '12/10/2026', '', [2, 10], []],
  ['K-06', 'Fede Prueba', 'Kínder', 'Green Room', '01/01/2026', '15/06/2026', 'Cambio de colegio', [1, 6], [5]],
  ['K-07', 'Gala Prueba', 'Kínder', 'Blue Room', '01/04/2026', '', '', [4, 10], [8], 8],
  ['K-08', 'Hugo Fuera', 'After School', 'Green Room', '01/01/2026', '', '', [1, 10], [3]]
];
/* `crudo`: además de lo que manda csv.php, las columnas que csv.php quita
   (el monto y el plan). La pantalla tiene que seguir sin mostrarlas. */
function analisis(crudo) {
  const cab = ['ID niño', 'Unidad', 'Mes #', 'Mes', 'Año', 'Activo ese mes', 'Fecha ingreso', 'Fecha salida', 'Fecha de nacimiento', 'Grupo',
    'generado_en', 'Nombre del niño', 'Motivo de salida', 'Pagó el mes'].concat(crudo ? ['Pago del mes ($)', 'Plan'] : []);
  const filas = [',DATOS PARA ANÁLISIS · formato largo', cab.join(',')];
  NINOS.forEach(([id, nom, uni, g, ing, sal, mot, [a, b], sinPago, inactivo], i) => {
    for (let m = 1; m <= 12; m++) {
      const act = m >= a && m <= b && m !== inactivo ? 1 : 0;
      /* Octubre no tiene NINGÚN pago cargado: el último mes con pagos es septiembre. */
      const pago = act && m <= 9 && !sinPago.includes(m);
      const fila = [id, uni, m, 'mes', 2026, act, ing, sal, '10/03/' + (2021 + i % 2), g, filas.length === 2 ? '2026-10-27 7:40' : '', nom, mot, pago ? 'Sí' : 'No'];
      if (crudo) fila.push(pago ? '"98.765,00"' : '', '8 h');
      filas.push(fila.join(','));
    }
  });
  return filas.join('\n');
}
const CONFIG = 'PARÁMETRO,VALOR\nCapacidad máxima,38\nMeta de niños,20\nFecha meta,31/03/2027\n\n' +
  'GRUPO,CAPACIDAD,ACTIVO\nGreen Room,10,Sí\nRed Room,10,Sí\nBlue Room,8,Sí\nGrey Room,10,No\n';

/* ── Documento de mentira ─────────────────────────────────────────────── */
function nuevoElemento(id) {
  return { id, innerHTML: '', textContent: '', title: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {},
    getBoundingClientRect: () => ({ width: 600, height: 200, left: 0, top: 0, right: 600, bottom: 200 }) };
}
async function correr(html, csvAnalisis) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const principal = scripts.find(s => s.includes('function calcular('));
  if (!principal) throw new Error('no se encontró el script del tablero');
  const els = {};
  const document = { getElementById: id => els[id] || (els[id] = nuevoElemento(id)), querySelectorAll: () => [], createElement: () => nuevoElemento(''),
    body: { appendChild() {} } };
  const respuesta = txt => Promise.resolve({ ok: true, status: 200, headers: { get: () => 'text/csv; charset=utf-8' }, text: () => Promise.resolve(txt) });
  const ctx = { document, console, Promise, Date, Math, JSON, Object, Array, String, Number, Set, Error, RegExp, isNaN,
    innerWidth: 1200, addEventListener() {}, setInterval() { return 0; }, clearInterval() {},
    getComputedStyle: () => ({ color: 'rgb(120, 120, 120)' }),
    fetch: url => respuesta(/analisis/.test(url) ? csvAnalisis : CONFIG) };
  ctx.window = ctx;
  ctx.CSV_ANALISIS_LOCAL = 'csv.php?tabla=analisis'; ctx.CSV_CONFIG_LOCAL = 'csv.php?tabla=config';
  vm.runInNewContext(principal, ctx);
  await new Promise(r => setTimeout(r, 30));
  const todo = Object.values(els).map(e => e.innerHTML + ' ' + e.textContent + ' ' + e.title).join('\n');
  return { els, todo, d: ctx.calcular() };
}

/* ── Comprobaciones ───────────────────────────────────────────────────── */
let total = 0;
async function comprobar(html, hablar) {
  let fallas = 0;
  const ok = (c, msg) => { total += hablar ? 1 : 0; if (!c) fallas++; if (hablar) console.log((c ? '  ✓ ' : '  ✗ ') + msg); };
  for (const crudo of [false, true]) {
    const { els, todo, d } = await correr(html, analisis(crudo));
    const caso = crudo ? ' (con la columna de pagos y el plan en la hoja)' : '';
    ok(d.ok && d.ninos === 6, 'inscritos de octubre: los seis de Kínder activos (sin la fila de After School)' + caso);
    ok(!/\$|98[.,]?765|Cobrado|Margen|Ticket|equilibrio|Tarifa/i.test(todo), 'R138 ningún monto ni cifra de dinero en pantalla' + caso);
    ok(!/Hugo Fuera/.test(todo), 'una fila de otra unidad no aparece');
    const infos = [...els.salones.innerHTML.matchAll(/data-info="([^"]*)"/g)].map(m => m[1]);
    ok(infos.length === 6 && infos.every(i => /^\d+ años?$|^edad sin fecha de nacimiento$/.test(i)), 'R138 el globo de cada cupo dice solo la edad (y el nombre en data-nom): ' + infos.join(' | '));
    ok(/Green Room[\s\S]*?<b>8<\/b> cupos libres/.test(els.salones.innerHTML) && /Blue Room[\s\S]*?<b>7<\/b> cupos libres/.test(els.salones.innerHTML),
      'R138 cupos libres por salón con la capacidad de «Config Kínder» (Blue Room tiene 8)');
    ok(String(els['k-libres'].innerHTML) === '22', 'cupos libres en los salones abiertos: 8 + 7 + 7 = 22 (dio ' + els['k-libres'].innerHTML + ')');
    const sal = els.salidas.innerHTML;
    ok(/Eli Prueba[\s\S]*Motivo no registrado[\s\S]*Dora Prueba[\s\S]*Motivo: <b>Se mudó<\/b>/.test(sal) && !/Fede Prueba/.test(sal),
      'R138 salidas de octubre, por fecha, con el motivo o «Motivo no registrado» (la de junio no entra)');
    ok(els['sal-tit'].textContent === 'Salidas de octubre', 'el título dice el mes');
    const pen = els.pendientes.innerHTML;
    ok(/Beto Prueba[\s\S]*Desde <b>julio<\/b> · 3 meses sin pago: julio, agosto, septiembre[\s\S]*Ana Prueba[\s\S]*Desde <b>septiembre<\/b> · 1 mes sin pago/.test(pen),
      'R138 pendientes de pago: quién y desde qué mes, el más antiguo primero');
    ok(!/Fede Prueba|Gala Prueba|Ciro Prueba/.test(pen), 'R138 no son pendientes: el que ya salió, un mes en que el niño no estaba activo, ni quien pagó todo');
    ok(!/octubre/.test(pen.replace(/Desde <b>[a-z]+<\/b>/g, '')) && /hasta septiembre/.test(pen), 'R138 octubre no tiene pagos cargados: no cuenta como pendiente (hasta septiembre)');
    ok(String(els['k-pend'].innerHTML) === '2', 'la cifra de pendientes de pago: 2 (dio ' + els['k-pend'].innerHTML + ')');
    const planes = (els.planes.innerHTML.match(/Plan por registrar/g) || []).length;
    ok(planes === 6 && !/8 h<\/span>|4,5 h<\/span>|Tarde<\/span>/.test(els.planes.innerHTML), 'R139 plan «por registrar» para los seis, sin deducirlo ni leerlo de la hoja' + caso);
  }
  /* Sin la columna «Pagó el mes»: no se inventa nada. */
  const sinPagos = await correr(html, analisis(false).replace(/,Pagó el mes/, ',Otra cosa'));
  ok(sinPagos.els['k-pend'].innerHTML === '—' && /no trae si cada mes tiene pago/.test(sinPagos.els.pendientes.innerHTML), 'sin «Pagó el mes»: pendientes «—» y lo dice');
  return fallas;
}

const ROTURAS = [
  ['lee el monto en vez de «Pagó el mes»', 'cPagoSi=col(head,"Pagó el mes"),', 'cPagoSi=col(head,"Pago del mes ($)"),'],
  ['el plan se deduce', "'<span class=\"marca-pend\">Plan por registrar</span></span></li>';", "(n.edad>4?'8 h</span>':'4,5 h</span>')+'</span></li>';"],
  ['pendientes cuentan meses sin pagos cargados', 'for(let m=1;m<=d.mesPagos;m++){', 'for(let m=1;m<=hasta;m++){'],
  ['pendientes cuentan meses inactivos', 'if(c && c.activo && c.pagado===false) meses.push(m);', 'if(c && c.pagado===false) meses.push(m);'],
  ['pendientes incluyen a los que ya salieron', 'matriculados.forEach(n=>{\n      const meses=[];', 'Object.values(porNino).forEach(n=>{\n      const meses=[];'],
  ['salidas de otros meses', 'n.sal.getFullYear()===anioDatos && n.sal.getMonth()+1===mesHoy)\n', 'n.sal.getFullYear()===anioDatos && n.sal.getMonth()+1<=mesHoy)\n'],
  ['el motivo se inventa', "'<span class=\"marca-pend\">Motivo no registrado</span>'", "'Motivo: <b>Otro</b>'"],
  ['cupos libres sin la capacidad de Config', 'Math.max(0, capacidad-ns.length)', 'Math.max(0, 10-ns.length)'],
  ['el globo dice más que nombre y edad', 'data-info="\'+esc(info)+\'"', 'data-info="\'+esc(info+" · "+k.id)+\'"'],
  ['cuenta filas de otras unidades', 'if(cUni>=0 && !/k[íi]nder/i.test(r[cUni]||"")) return;', ''],
  ['las salidas no se ordenan por fecha', '    .sort((a,b)=>a.sal-b.sal);', '    .sort((a,b)=>b.sal-a.sal);']
];

(async function () {
  console.log('· Preschool operativo (kinder/index.html)');
  const f = await comprobar(HTML, true);
  console.log(f ? '✗ ' + f + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');
  console.log('\n· roturas');
  let detectadas = 0;
  for (const [nombre, de, a] of ROTURAS) {
    if (HTML.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
    let rota;
    try { rota = await comprobar(HTML.replace(de, a), false); } catch (e) { rota = 1; }
    if (rota) detectadas++;
    console.log((rota ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
  }
  console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
  process.exit(f || detectadas !== ROTURAS.length ? 1 : 0);
})();
