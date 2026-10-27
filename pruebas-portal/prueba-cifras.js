/* Cifras del Resumen del negocio (comun/cifras.js), con datos INVENTADOS
 * con la forma de After School «leer» y de resumen/api.php, y sus roturas
 * (cada una tiene que hacer fallar alguna comprobación).
 *
 *   node pruebas-portal/prueba-cifras.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'comun', 'cifras.js'), 'utf8');
function cargar(fuente) { const m = { exports: {} }; vm.runInNewContext(fuente, { module: m }); return m.exports; }

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/* Hoy miércoles 28-oct-2026. leer() trae del 14-oct (miércoles) al 8-dic: la
   semana del 12-oct queda incompleta; la del 19 y la del 26, completas. */
function estado() {
  const clases = [
    { codigo: 'LUN-A', dia: 'Lunes', cupo: 10, activa: true },
    { codigo: 'MIE-B', dia: 'Miércoles', cupo: 5, activa: true },
    { codigo: 'LUN-C', dia: 'Lunes', cupo: 8, activa: false },     // inactiva: no cuenta
    { codigo: 'VIE-D', dia: 'Viernes', cupo: null, activa: true }  // sin cupo válido: no cuenta
  ];
  const I = { '2026-10-19': { 'LUN-A': 6, 'LUN-C': 8 }, '2026-10-21': { 'MIE-B': 3 }, '2026-10-26': { 'LUN-A': 8, 'LUN-C': 8 }, '2026-10-28': { 'MIE-B': 4 } };
  const ocupacion = {};
  for (let d = '2026-10-14'; d <= '2026-12-08'; d = sumar(d, 1)) {
    const dia = DIAS[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7], o = {};
    clases.filter(c => c.dia === dia).forEach(c => { o[c.codigo] = { i: (I[d] || {})[c.codigo] || (d > '2026-10-28' && c.codigo === 'LUN-A' ? 9 : 0), v: c.codigo === 'LUN-A' ? 3 : 0 }; });
    ocupacion[d] = o;
  }
  return { hoy: '2026-10-28', dias: DIAS, clases, ocupacion };
}

let fallas = 0, total = 0;
function comprobar(C, decir) {
  let f = 0;
  const ok = (c, m) => { total++; if (!c) { f++; if (decir) console.log('  ✗ ' + m); } else if (decir) console.log('  ✓ ' + m); };
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;
  const r = C.ocupacionAS(estado());
  ok(r && r.inscritos === 12 && r.cupos === 15 && cerca(r.valor, 0.8),
    'semana de hoy: (8 + 4) inscritos ÷ (10 + 5) cupos de las clases activas = 80 %; ni la inactiva, ni la sin cupo, ni las visitas (' + JSON.stringify(r) + ')');
  ok(r && Array.isArray(r.serie) && r.serie.length === 2 && cerca(r.serie[0], 0.6) && cerca(r.serie[1], 0.8),
    'tendencia: la semana anterior (60 %) y la de hoy; la del 12-oct no viene completa y no se usa');
  const E2 = estado(); delete E2.ocupacion['2026-10-19'];
  const r2 = C.ocupacionAS(E2);
  ok(r2 && cerca(r2.valor, 0.8) && r2.serie === null, 'si la semana anterior no viene completa: la cifra sin tendencia');
  const E3 = estado(); delete E3.ocupacion['2026-10-28'];
  ok(C.ocupacionAS(E3) === null, 'si la semana de hoy no viene completa: no hay cifra (no se inventa)');
  const E4 = estado(); E4.clases.forEach(c => { c.activa = false; });
  ok(C.ocupacionAS(E4) === null, 'sin clases activas con cupo: no hay cifra');
  ok(C.ocupacionAS(null) === null && C.ocupacionAS({ hoy: '2026-10-28' }) === null, 'sin la lectura de After School: no hay cifra');
  const E5 = estado(); E5.hoy = '2026-11-01';   // domingo: sigue siendo la semana del lunes 26
  const r5 = C.ocupacionAS(E5);
  ok(r5 && r5.inscritos === 12 && r5.cupos === 15, 'la semana va de lunes a domingo (el domingo 1-nov es la semana del 26-oct)');
  f += negocio(C, ok, cerca);
  return f;
}

/* 26-oct: el Resumen del negocio. Preschool con la forma que devuelve resumen/api.php. */
const PRE = () => ({ anio: 2026, corte: 10, sello: '2026-10-25', capacidad: 80, meses: {
  '2026-08': { activos: 24, altas: 2, bajas: 0 }, '2026-09': { activos: 26, altas: 3, bajas: 1 }, '2026-10': { activos: 28, altas: 4, bajas: 3 } } });
const METAS = () => [
  { cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026', valor: 0.45, estado: 'Tentativa' },        // del año, escrita como 45 % (Sheets guarda 0,45)
  { cifra: 'Ocupación', unidad: 'After School', periodo: '2026-10', valor: 90, estado: 'Confirmada' },
  { cifra: 'Bajas', unidad: 'Preschool', periodo: '2026-10', valor: 2, estado: '' },                      // vacía = tentativa
  { cifra: 'Altas', unidad: 'Preschool', periodo: '2026', valor: 30, estado: 'Tentativa' },               // de año: no vale para un mes (no es porcentaje)
  { cifra: 'Niños activos', unidad: 'preschool', periodo: '2026-10', valor: 50, estado: 'confirmada' }];
function negocio(C, ok, cerca) {
  let f0 = 0; const ok2 = (c, m) => { if (!c) f0++; ok(c, m); };
  const m1 = C.metaDe(METAS(), 'Ocupación', 'Preschool', '2026-10');
  ok2(m1 && cerca(m1.valor, 45) && m1.tentativa === true && m1.periodo === '2026', 'meta de porcentaje: la del año vale para el mes y 0,45 se lee 45 %; dice tentativa');
  ok2(C.metaDe(METAS(), 'Altas', 'Preschool', '2026-10') === null, 'una meta de conteo del año no se reparte en meses');
  const m3 = C.metaDe(METAS(), 'Niños activos', 'Preschool', '2026-10');
  ok2(m3 && m3.valor === 50 && m3.tentativa === false, 'Confirmada (sin importar mayúsculas) deja de decir tentativa; la unidad se compara sin mayúsculas');
  ok2(C.metaDe(METAS(), 'Bajas', 'Preschool', '2026-10').tentativa === true, 'Estado vacío = tentativa');
  const p = C.preschoolEn(PRE(), '2026-10');
  ok2(p && p.activos === 28 && p.altas === 4 && p.bajas === 3 && cerca(p.ocupacion, 28 / 80), 'Preschool en el mes: activos, altas, bajas y ocupación = activos ÷ capacidad máxima');
  const pa = C.preschoolEn(PRE(), '2026');
  ok2(pa && pa.activos === 28 && pa.altas === 9 && pa.bajas === 4 && pa.hasta === '2026-10', 'Preschool en el año: activos del último mes; altas y bajas sumadas');
  ok2(C.preschoolEn(PRE(), '2025-10') === null && C.preschoolEn(null, '2026-10') === null, 'sin datos del período: null (no se inventa)');
  const E = estado();
  E.ninos = [{ id: 'AS-1', estado: 'Activo' }, { id: 'AS-1', estado: 'Activo' }, { id: 'AS-2', estado: 'Activo' }, { id: 'AS-3', estado: 'Prospecto' }];
  const a = C.afterSchoolEn(E, '2026-10');
  ok2(a && a.activos === 2 && cerca(a.ocupacion, 0.8) && a.altas === null && a.bajas === null, 'After School: activos únicos (el mismo niño una vez), ocupación de la semana, altas y bajas sin regla');
  ok2(C.afterSchoolEn(E, '2026-09') === null, 'After School: otro mes no tiene datos (leer trae hoy)');
  const N = C.resumenNegocio({ periodo: '2026-10', E, pre: PRE(), metas: METAS(), finanzas: null });
  ok2(N.ninos.activos.valor === null && /mismo niño/.test(N.ninos.activos.motivo), 'niños activos del negocio: NO se suman las unidades (contaría dos veces); falta la regla');
  ok2(N.ninos.altas.valor === null && N.ninos.bajas.valor === null && N.ninos.pruebas.valor === null, 'altas, bajas y pruebas del negocio: «Próximamente»');
  ok2(N.finanzas.disponible === false && N.unidades.every(u => u.facturacion === null && u.margen === null), 'sin fuente de finanzas: nada disponible, ningún número');
  const pre = N.unidades.find(u => u.nombre === 'Preschool'), as = N.unidades.find(u => u.nombre === 'After School'), ver = N.unidades.find(u => u.nombre === 'Veranito');
  ok2(pre.activos.valor === 28 && pre.activos.anterior === 26 && pre.activos.anioAnterior === null, 'comparación con el mes anterior; sin el mismo mes del año anterior, no se muestra');
  ok2(ver.datos === false && ver.activos.valor === null && N.unidades.map(u => u.nombre).join() === 'Preschool,After School,Veranito,Baby & Me,Cumpleaños', 'las cinco unidades; sin datos, vacías');
  ok2(N.alertas.length === 3 && N.alertas[0].tipo === 'bajas' && N.alertas[0].unidad === 'Preschool' && N.alertas.some(x => x.tipo === 'ocupacion' && x.unidad === 'After School'),
    'Para mirar: bajas por encima del tope y ocupaciones bajo la meta, la más lejos primero (' + N.alertas.map(x => x.tipo + ':' + x.unidad).join(' ') + ')');
  const sinMetas = C.resumenNegocio({ periodo: '2026-10', E, pre: PRE(), metas: [], finanzas: null });
  ok2(sinMetas.alertas.length === 0, 'sin metas no hay alertas: lo normal lo fija Vida en Arte');
  const muchas = METAS().concat([{ cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026-10', valor: 99, estado: 'Tentativa' }]);
  const N2 = C.alertas([{ nombre: 'U1', ocupacion: { valor: 0.1, meta: { valor: 50 } }, bajas: { valor: 9, meta: { valor: 1 } } },
    { nombre: 'U2', ocupacion: { valor: 0.4, meta: { valor: 50 } }, bajas: { valor: 1, meta: { valor: 1 } } },
    { nombre: 'U3', ocupacion: { valor: 0.3, meta: { valor: 50 } }, bajas: { valor: null, meta: null } }], { disponible: false });
  ok2(N2.length === 3 && N2[0].tipo === 'bajas' && N2.every((x, i, l) => !i || l[i - 1].distancia >= x.distancia) && !N2.some(x => x.unidad === 'U2' && x.tipo === 'bajas'),
    'como mucho tres, ordenadas');
  ok2(C.alertas([{ nombre: 'U', ocupacion: { valor: 0.5, meta: { valor: 50 } }, bajas: { valor: 2, meta: { valor: 2 } } }], { disponible: false }).length === 0,
    'en la meta justa (ocupación igual, bajas iguales al tope) no hay alerta');
  ok2(C.metaDe(muchas, 'Ocupación', 'Preschool', '2026-10').valor === 99, 'la meta del mes manda sobre la del año');
  // Finanzas con el contrato (números INVENTADOS, solo en la prueba).
  const F = { meses: { '2026-09': { unidades: { Preschool: { facturacion: 100, costos: 40 } }, gastosComunes: 20, cobrado: 70, porCobrar: 30, familiasPorCobrar: 3 },
    '2026-10': { unidades: { Preschool: { facturacion: 200, costos: 80 }, 'After School': { facturacion: 100, costos: 70 } }, gastosComunes: 60, cobrado: 240, porCobrar: 60, familiasPorCobrar: 4 } } };
  const fin = C.finanzasEn(F, '2026-10');
  ok2(fin.disponible && fin.facturacion === 300 && fin.costos === 150 && fin.margen === 150 && fin.utilidad === 90 && cerca(fin.margenNeto, 0.3) && cerca(fin.cobradoPct, 0.8) && fin.unidades.Preschool.margen === 120,
    'finanzas: margen de las unidades = facturación − costos; utilidad neta = margen − gastos comunes; margen neto = utilidad ÷ facturación');
  const fa = C.finanzasEn(F, '2026');
  ok2(fa.facturacion === 400 && fa.gastosComunes === 80, 'finanzas del año: la suma de sus meses');
  const S = C.serieFinanzas(F, '2026-10');
  ok2(S.length === 12 && S[11].mes === '2026-10' && S[11].facturacion === 300 && S[10].utilidad === 40 && S[0].sin === true, 'gráfico: 12 meses que terminan en el elegido; los meses sin datos, vacíos');
  ok2(C.comparables('2026-01').anterior === '2025-12' && C.comparables('2026-01').anioAnterior === '2025-01' && C.comparables('2026').anioAnterior === null, 'mes anterior y mismo mes del año anterior');
  return f0;
}

console.log('· Ocupación After School y Resumen del negocio');
fallas = comprobar(cargar(FUENTE), true);
console.log(fallas ? '✗ ' + fallas + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');

const ROTURAS = [
  ['cuenta las clases inactivas', 'E.clases.filter(c => c.activa && c.cupo > 0)', 'E.clases.filter(c => c.cupo > 0 || c.activa === false)'],
  ['cuenta las clases sin cupo válido', 'E.clases.filter(c => c.activa && c.cupo > 0)', 'E.clases.filter(c => c.activa).map(c => Object.assign({}, c, { cupo: c.cupo || 5 }))'],
  ['suma las visitas de un día', 'dia[c.codigo] ? dia[c.codigo].i : 0', 'dia[c.codigo] ? dia[c.codigo].i + dia[c.codigo].v : 0'],
  ['una semana incompleta cuenta igual', 'if (!dia) return null;', 'if (!dia) continue;'],
  ['tendencia con una sola semana', 'serie.length >= 2 ? serie : null', 'serie'],
  ['la semana empieza el domingo', '(d.getDay() + 6) % 7', 'd.getDay()'],
  ['la tendencia mira semanas futuras', 'sumarDias(hoy, -7); ; l = sumarDias(l, -7)', 'sumarDias(hoy, 7); ; l = sumarDias(l, 7)'],
  ['la cifra es la de la semana pasada', 'valor: ahora.inscritos / ahora.cupos', 'valor: serie[0]'],
  // 26-oct: Resumen del negocio
  ['los niños activos del negocio se suman', "activos: { valor: null, motivo: 'Falta la regla para reconocer al mismo niño en dos unidades'", "activos: { valor: unidades.reduce((t, u) => t + (u.activos.valor || 0), 0), motivo: 'Falta la regla para reconocer al mismo niño en dos unidades'"],
  ['After School cuenta dos veces al mismo niño', "new Set((E.ninos || []).filter(n => n.estado === 'Activo').map(n => n.id)).size", "(E.ninos || []).filter(n => n.estado === 'Activo').length"],
  ['After School inventa altas', "return { activos, altas: null, bajas: null,", "return { activos, altas: activos, bajas: null,"],
  ['una meta confirmada sigue diciendo tentativa', "tentativa: normal(m.estado) !== 'confirmada'", "tentativa: true"],
  ['la meta del año se reparte en meses de conteo', "if (!m && esMes(periodo) && CIFRAS_PORCENTAJE.includes(cifra))", "if (!m && esMes(periodo))"],
  ['una meta de 0,45 no se lee como 45 %', "Math.abs(m.valor) <= 1 ? m.valor * 100 : m.valor", "m.valor"],
  ['alerta sin meta escrita', "if (o.valor !== null && o.meta && o.valor * 100 < o.meta.valor)", "if (o.valor !== null && o.valor * 100 < (o.meta ? o.meta.valor : 100))"],
  ['más de tres alertas', ".slice(0, 3);", ";"],
  ['las bajas iguales al tope avisan', "b.valor > b.meta.valor", "b.valor >= b.meta.valor"],
  ['la utilidad no resta los gastos comunes', "utilidad = margen - gastos", "utilidad = margen"],
  ['la ocupación de Preschool contra otra base', "pre.capacidad ? a / pre.capacidad : null", "pre.capacidad ? a / 100 : null"],
  ['las altas del año no se suman', "altas: ms.reduce((a, k) => a + pre.meses[k].altas, 0)", "altas: ult.altas"],
  ['After School da datos de otros meses', "if (!E || !E.hoy || !(E.hoy.slice(0, esMes(p) ? 7 : 4) === p)) return null;", "if (!E || !E.hoy) return null;"]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (FUENTE.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  let f;
  try { f = comprobar(cargar(FUENTE.replace(de, a)), false); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
