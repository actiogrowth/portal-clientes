/* Cifras del Resumen de Dirección (comun/cifras.js), con datos INVENTADOS
 * con la forma de After School «leer», y sus roturas (cada una tiene que
 * hacer fallar alguna comprobación).
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
  return f;
}

console.log('· Ocupación After School');
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
  ['la cifra es la de la semana pasada', 'valor: ahora.inscritos / ahora.cupos', 'valor: serie[0]']
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
