/* El Apps Script del Sheet «Procesos» (procesos-script/Procesos.gs, v5 del
 * 2-nov: Equipo v3) corriendo en node contra un Sheet de MENTIRA en memoria,
 * y sus roturas (cada una tiene que hacer fallar alguna comprobación).
 *
 *   node procesos-script/pruebas/prueba-equipo-v3.js
 *
 * Se imitan solo las piezas de Google que usa el script (SpreadsheetApp con
 * pestañas en memoria, Utilities.formatDate en la zona de Panamá, el reloj).
 * Se prueba lo que no se ve desde el portal: que quitar una marca AGREGA una
 * fila «Desmarcada» y no borra nada, que solo se quita la propia y en su
 * período, «No ejecutado» con motivo, los puntos por evento con nota, los
 * pasos «Cada semana» y «Cada mes» de las hojas, el calendario que manda
 * «leer» y que actualizarEstructura agrega columnas sin tocar los datos.
 * Puestos y textos INVENTADOS.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'Procesos.gs'), 'utf8');
const CLAVE = 'clave-de-prueba-de-24-caracteres-o-mas';
const ZONA = -5;   // Panamá, sin horario de verano

/* ── Google de mentira ─────────────────────────────────────────────────── */
function formatear(d, fmt) {
  const x = new Date(d.getTime() + ZONA * 3600000), dos = n => String(n).padStart(2, '0');
  const t = { yyyy: x.getUTCFullYear(), MM: dos(x.getUTCMonth() + 1), dd: dos(x.getUTCDate()), HH: dos(x.getUTCHours()), mm: dos(x.getUTCMinutes()), ss: dos(x.getUTCSeconds()) };
  return fmt.replace(/'T'/g, 'T').replace(/yyyy|MM|dd|HH|mm|ss/g, k => t[k]);
}
class Hoja {
  constructor(nombre, filas) { this.nombre = nombre; this.filas = (filas || []).map(f => f.slice()); this.borradas = 0; }
  getName() { return this.nombre; }
  ancho() { return Math.max(1, ...this.filas.map(f => f.length)); }
  getDataRange() {
    const w = this.ancho(), m = this.filas.map(f => Array.from({ length: w }, (_, i) => f[i] === undefined ? '' : f[i]));
    return { getValues: () => m.map(f => f.slice()), getDisplayValues: () => m.map(f => f.map(v => v instanceof Date || Object.prototype.toString.call(v) === '[object Date]' ? formatear(v, 'dd/MM/yyyy') : String(v))) };
  }
  getLastRow() { for (let i = this.filas.length - 1; i >= 0; i--) if (this.filas[i].some(v => v !== '' && v != null)) return i + 1; return 0; }
  getRange(r, c, nr, nc) {
    const h = this;
    const poner = (i, j, v) => { while (h.filas.length < i) h.filas.push([]); const f = h.filas[i - 1]; while (f.length < j) f.push(''); f[j - 1] = v; };
    return { setValues(m) { m.forEach((f, i) => f.forEach((v, j) => poner(r + i, c + j, v))); return this; }, setValue(v) { poner(r, c, v); return this; },
             setNumberFormat() { return this; }, setDataValidation() { return this; } };
  }
  setFrozenRows() {}
  deleteRow() { this.borradas++; throw new Error('el script no debe borrar filas'); }
}
function crearGoogle(pestanas, reloj) {
  const hojas = Object.entries(pestanas).map(([n, f]) => new Hoja(n, f));
  const ss = { getSheets: () => hojas, insertSheet: n => { const h = new Hoja(n, []); hojas.push(h); return h; }, getSpreadsheetTimeZone: () => 'America/Panama' };
  const RealDate = Date;
  class FDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(reloj.t); } static now() { return reloj.t; } }
  const valida = { requireValueInList() { return valida; }, setAllowInvalid() { return valida; }, build() { return {}; } };
  const ctx = {
    Date: FDate, Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: () => valida },
    Utilities: { formatDate: (d, z, f) => formatear(d, f) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => CLAVE }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) }
  };
  return { ctx, hojas, hoja: n => hojas.find(h => h.nombre === n) };
}

/* ── El Sheet de mentira ───────────────────────────────────────────────── */
const AHORA = Date.UTC(2026, 10, 4, 20, 0, 0);   // miércoles 4-nov-2026, 3:00 p. m. en Panamá (semana 45)
const SHEET = () => ({
  'Léeme': [['Tema', 'Detalle'], ['Marcas de hojas', 'TEXTO-VIEJO-DEL-LEEME']],
  'Puestos': [['ID', 'Puesto', 'Área', 'Unidad', 'Reporta a', 'Cantidad', 'Estado', 'Versión', 'Fecha versión', 'Verifica', 'Cómo verifica', 'Visible solo para'],
    ['DIR', 'Dirección de prueba', 'Dirección', 'Todas', '', '', 'Por cargar', '', '', '', '', ''],
    ['PUE', 'Puesto de prueba', 'Operación', 'Todas', 'DIR', '', 'Abierto al equipo', 1, '', 'Dirección de prueba, cada semana', '', ''],
    ['BOR', 'Puesto en borrador', 'Operación', 'Todas', 'DIR', '', 'Borrador', 1, '', '', '', '']],
  'Contratos': [['Puesto ID', 'Sección', 'Orden', 'Texto'], ['PUE', 'Trabajo', 1, 'Trabajo general. Incluye:'], ['PUE', 'Trabajo', 2, '1.1 Subpunto de prueba']],
  'Listas': [['Puesto ID', 'Orden', 'Qué se verifica', 'Evidencia', 'Cada cuánto'],
    ['PUE', 1, 'PUNTO-DIARIO', '', 'Diario'], ['PUE', 2, 'PUNTO-SEMANAL', '', 'Semanal'], ['PUE', 3, 'PUNTO-POR-PAGO', '', 'Por pago'],
    ['PUE', 4, 'PUNTO-MENSUAL', '', 'Mensual'], ['PUE', 5, 'PUNTO-CUANDO-APLICA', '', 'Cuando aplica'], ['PUE', 6, 'PUNTO-DIARIO-DOS', '', 'Diario']],
  'Hojas': [['Puesto ID', 'Hoja', 'Orden', 'Momento', 'Paso'],
    ['PUE', 'Hoja de prueba', 1, 'Al abrir', 'PASO-DIARIO'], ['PUE', 'Hoja de prueba', 2, 'Cada semana', 'PASO-SEMANAL'], ['PUE', 'Hoja de prueba', 3, 'Cada mes', 'PASO-MENSUAL']],
  'Reglas del juego': [['Sección', 'Orden', 'Texto'], ['Una', 1, 'Regla']],
  'Horarios del servicio': [['Momento', 'Unidad', 'Hora', 'Puestos que lo usan'], ['Apertura de prueba', 'Todas', 'Por definir', 'PUE']],
  'Procesos': [['Puesto ID', 'Proceso', 'Descripción', 'Enlace', 'Estado']],
  'Asignaciones': [['Usuario del portal', 'Puesto ID', 'Desde', 'Hasta'], ['quien-ocupa', 'PUE', '', '']],
  'Aceptaciones': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Versión']],
  'Marcas': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Orden del punto', 'Período', 'Resultado', 'Nota'],
    // La semana pasada (S44) quien ocupa marcó el semanal; ayer, el diario. Una marca vieja con «Cumplido».
    [new Date(Date.UTC(2026, 9, 28, 15, 0, 0)), 'quien-ocupa', 'PUE', '2', '2026-S44', 'Ejecutado', ''],
    [new Date(Date.UTC(2026, 10, 3, 15, 0, 0)), 'quien-ocupa', 'PUE', '1', '2026-11-03', 'Cumplido', '']],
  'Revisiones': [['Fecha y hora', 'Revisor', 'Puesto ID', 'Período', 'Sorpresa', 'Resultado', 'Nota']],
  'Metas': [['Cifra', 'Unidad', 'Período', 'Valor', 'Estado']],
  // Como estaba antes de v5: sin Resultado ni Nota, con una marca del lunes de esta semana en el paso semanal.
  'Marcas de hojas': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden', 'Iniciales'],
    [new Date(Date.UTC(2026, 10, 2, 14, 0, 0)), 'quien-ocupa', 'PUE', 'Hoja de prueba', 2, 'QO'],
    [new Date(Date.UTC(2026, 9, 27, 14, 0, 0)), 'quien-ocupa', 'PUE', 'Hoja de prueba', 3, 'QO']]   // el mes pasado: no cuenta para noviembre
});

let total = 0;
function comprobar(fuente, decir) {
  let f = 0;
  const ok = (c, m) => { total++; if (!c) { f++; if (decir) console.log('  ✗ ' + m); } else if (decir) console.log('  ✓ ' + m); };
  const reloj = { t: AHORA };
  const G = crearGoogle(SHEET(), reloj);
  vm.runInNewContext(fuente, G.ctx);
  const llamar = (usuario, accion, datos) => G.ctx.atender_({ key: CLAVE, usuario, accion, datos });
  const filas = n => G.hoja(n).filas.length;
  const ultima = n => G.hoja(n).filas[G.hoja(n).filas.length - 1];
  const col = (n, t) => G.hoja(n).filas[0].indexOf(t);

  // Leer.
  const L = llamar('quien-ocupa', 'leer', {});
  const R = L.ok ? L.resultado : {};
  ok(L.ok && R.version === 'v5', 'leer responde con la versión v5 (' + (L.error || R.version) + ')');
  const cal = R.calendario || {}, dias = Object.keys(cal);
  ok(dias.length === 121 && dias[dias.length - 1] === '2026-11-04' && dias[0] === '2026-07-07', 'el calendario: hoy y los 120 días anteriores (' + dias.length + ': ' + dias[0] + ' … ' + dias[dias.length - 1] + ')');
  ok(cal['2026-11-04'] && cal['2026-11-04'].semana === '2026-S45' && cal['2026-11-01'].semana === '2026-S44' && cal['2026-11-04'].mes === '2026-11' && cal['2026-11-04'].quincena === '2026-11-Q1' && cal['2026-11-04'].dia === '2026-11-04',
    'cada día con el período de cada forma (el domingo 1-nov es de la semana 44)');
  const punto = o => (R.listas || []).find(x => x.puesto === 'PUE' && x.orden === o) || {};
  ok(punto(1).forma === 'dia' && punto(2).forma === 'semana' && punto(4).forma === 'mes' && punto(3).forma === 'dia' && punto(3).evento === true && punto(5).evento === true && punto(1).evento === false,
    'cada punto trae su forma y si es por evento («Por pago», «Cuando aplica»)');
  const paso = o => (R.hojas || []).find(x => x.orden === o) || {};
  ok(paso(1).forma === 'dia' && paso(2).forma === 'semana' && paso(3).forma === 'mes', 'los pasos «Cada semana» y «Cada mes» traen su forma; los demás, el día');
  ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(((R.marcas || [])[0] || {}).fecha || ''), 'la fecha y hora de una marca con segundos (' + ((R.marcas || [])[0] || {}).fecha + ')');
  ok((R.marcasHojas || []).length === 2 && R.marcasHojas.every(x => x.resultado === ''), 'Marcas de hojas de antes se leen (sin Resultado)');

  // Marcar la lista.
  const e = (r, codigo) => !r.ok && r.codigo === codigo;
  let r = llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 1, resultado: 'Ejecutado' }] });
  ok(r.ok && ultima('Marcas')[col('Marcas', 'Resultado')] === 'Ejecutado' && ultima('Marcas')[col('Marcas', 'Período')] === '2026-11-04', 'marca «Ejecutado» con el período de hoy (' + (r.error || '') + ')');
  const mia = r.ok ? r.resultado.marcas[0] : {};
  ok(mia.fecha === '2026-11-04T15:00:00' && mia.usuario === 'quien-ocupa' && mia.resultado === 'Ejecutado' && mia.periodo === '2026-11-04', 'la respuesta trae la fila escrita, con la hora del servidor (' + JSON.stringify(mia) + ')');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 1, resultado: 'No ejecutado', nota: 'x' }] }), 'ya_marcado'), 'el mismo punto no se marca dos veces en su período');
  ok(e(llamar('otra-persona', 'marcar', { puesto: 'PUE', marcas: [{ orden: 1, resultado: 'Ejecutado' }] }), 'ya_marcado'), 'ni por otra persona');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 6, resultado: 'No ejecutado' }] }), 'nota'), '«No ejecutado» sin motivo se rechaza');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 6, resultado: 'No ejecutado', nota: '   ' }] }), 'nota'), '… y un motivo en blanco tampoco vale');
  r = llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 6, resultado: 'No ejecutado', nota: 'MOTIVO' }] });
  ok(r.ok && ultima('Marcas')[col('Marcas', 'Nota')] === 'MOTIVO', '«No ejecutado» con motivo se guarda');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 3, resultado: 'Ejecutado' }] }), 'nota'), 'un punto por evento sin nota se rechaza');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 5, resultado: 'Ejecutado' }] }), 'nota'), '«Cuando aplica» sin nota, también');
  const antes = filas('Marcas');
  r = llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 3, resultado: 'Ejecutado', nota: 'Pago A' }, { orden: 3, resultado: 'Ejecutado', nota: 'Pago B' }] });
  ok(r.ok && filas('Marcas') === antes + 2, 'por evento: varias marcas el mismo día, cada una con su nota');
  ok(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 3, resultado: 'No ejecutado', nota: 'Pago C' }] }).ok, '… y otra más después');
  r = llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 4, resultado: 'Cumplido' }] });
  ok(r.ok && ultima('Marcas')[col('Marcas', 'Resultado')] === 'Ejecutado' && r.resultado.marcas[0].periodo === '2026-11', 'lo que llega como «Cumplido» (un portal viejo) se escribe «Ejecutado»; el mensual, con su mes');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 2, resultado: 'Hecho' }] }), 'resultado'), 'un resultado desconocido se rechaza');
  ok(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 2, resultado: 'Ejecutado' }] }).ok, 'el semanal se marca: la marca de la semana pasada no cuenta en esta');

  // Desmarcar: agrega «Desmarcada», nunca borra.
  const copia = JSON.stringify(G.hoja('Marcas').filas.slice(0, -0 || undefined).map(f => f.map(v => v instanceof Date || Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : v)));
  ok(e(llamar('otra-persona', 'desmarcar', { puesto: 'PUE', orden: 1, fecha: mia.fecha }), 'ajena'), 'nadie quita la marca de otra persona');
  const n0 = filas('Marcas');
  r = llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 1, fecha: mia.fecha });
  const u = ultima('Marcas');
  ok(r.ok && filas('Marcas') === n0 + 1 && u[col('Marcas', 'Resultado')] === 'Desmarcada' && u[col('Marcas', 'Nota')] === '2026-11-04T15:00:00' && u[col('Marcas', 'Período')] === '2026-11-04' && u[col('Marcas', 'Usuario')] === 'quien-ocupa',
    'quitar la propia agrega una fila «Desmarcada» con la fecha y hora de la marca en la Nota (' + (r.error || u.join(' | ')) + ')');
  const despues = JSON.stringify(G.hoja('Marcas').filas.slice(0, n0).map(f => f.map(v => v instanceof Date || Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : v)));
  ok(despues === copia && G.hoja('Marcas').borradas === 0, 'y no borra ni cambia ninguna fila de antes');
  ok(r.ok && r.resultado.marca.resultado === 'Desmarcada' && r.resultado.marca.nota === mia.fecha, 'la respuesta trae la fila «Desmarcada»');
  ok(e(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 1, fecha: mia.fecha }), 'sin_marca'), 'la misma marca no se quita dos veces');
  ok(llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 1, resultado: 'No ejecutado', nota: 'Al final no' }] }).ok, 'quitada la marca, el punto se vuelve a marcar en su período');
  const ayer = (R.marcas || []).find(x => x.orden === 1 && x.periodo === '2026-11-03') || {};
  ok(e(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 1, fecha: ayer.fecha }), 'cerrado'), 'la marca de ayer de un punto diario ya no se quita (período cerrado)');
  const semPasada = (R.marcas || []).find(x => x.orden === 2) || {};
  ok(e(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 2, fecha: semPasada.fecha }), 'cerrado'), 'ni la de la semana pasada de un punto semanal');
  // Un punto semanal marcado el lunes se puede quitar el miércoles (misma semana).
  reloj.t = Date.UTC(2026, 10, 2, 14, 0, 0);
  const lunes = llamar('quien-ocupa', 'marcar', { puesto: 'PUE', marcas: [{ orden: 4, resultado: 'Ejecutado' }] });   // el mensual ya está: rechazado
  ok(e(lunes, 'ya_marcado'), '(control) el mensual ya estaba marcado este mes');
  reloj.t = AHORA;
  const sem = llamar('quien-ocupa', 'leer', {}).resultado.marcas.filter(x => x.orden === 2 && x.periodo === '2026-S45')[0] || {};
  ok(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 2, fecha: sem.fecha }).ok, 'el semanal de esta semana se quita mientras la semana siga abierta');
  const evt = llamar('quien-ocupa', 'leer', {}).resultado.marcas.filter(x => x.orden === 3)[0] || {};
  reloj.t = Date.UTC(2026, 10, 5, 15, 0, 0);
  ok(e(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 3, fecha: evt.fecha }), 'cerrado'), 'por evento: se quita solo el mismo día');
  reloj.t = AHORA;
  ok(llamar('quien-ocupa', 'desmarcar', { puesto: 'PUE', orden: 3, fecha: evt.fecha }).ok, '… y ese día, sí');
  ok(e(llamar('quien-ocupa', 'marcar', { puesto: 'BOR', marcas: [{ orden: 1, resultado: 'Ejecutado' }] }), 'no_abierto') && e(llamar('quien-ocupa', 'desmarcar', { puesto: 'BOR', orden: 1, fecha: 'x' }), 'no_abierto'),
    'en un puesto que no está abierto no se marca ni se quita');

  // Revisar sigue con Cumplido / No.
  ok(llamar('dir', 'revisar', { puesto: 'PUE', periodo: '2026-11-04', sorpresa: 'No', resultado: 'Cumplido' }).ok && e(llamar('dir', 'revisar', { puesto: 'PUE', periodo: '2026-11-04', sorpresa: 'No', resultado: 'Ejecutado' }), 'resultado'),
    'la revisión de quien verifica sigue con «Cumplido» o «No»');

  // Hojas.
  const nh = filas('Marcas de hojas');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 1, marcado: true, iniciales: 'QO' });
  ok(r.ok && col('Marcas de hojas', 'Resultado') === 6 && col('Marcas de hojas', 'Nota') === 7, 'Marcas de hojas sin Resultado ni Nota: se agregan al final al marcar (' + (r.error || G.hoja('Marcas de hojas').filas[0].join(', ')) + ')');
  ok(r.ok && filas('Marcas de hojas') === nh + 1 && ultima('Marcas de hojas')[6] === 'Ejecutado' && r.resultado.filas.length === 1 && r.resultado.filas[0].resultado === 'Ejecutado',
    'marcar un paso agrega su fila «Ejecutado»');
  const pasoHoy = r.ok ? r.resultado.filas[0] : {};
  ok(e(llamar('otra-persona', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 1, marcado: false }), 'ajena'), 'nadie desmarca el paso que marcó otra persona');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 1, marcado: false });
  ok(r.ok && filas('Marcas de hojas') === nh + 2 && ultima('Marcas de hojas')[6] === 'Desmarcada' && ultima('Marcas de hojas')[7] === pasoHoy.fecha && G.hoja('Marcas de hojas').borradas === 0,
    'desmarcar un paso AGREGA «Desmarcada» con la fecha de la marca, y no borra (D-086 cambia)');
  ok(llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 1, marcado: true }).ok && filas('Marcas de hojas') === nh + 3, 'se vuelve a marcar el mismo día');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 2, marcado: true });
  ok(r.ok && r.resultado.filas.length === 0 && filas('Marcas de hojas') === nh + 3, '«Cada semana»: marcado el lunes, el miércoles ya cuenta (no se repite)');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 2, marcado: false });
  ok(r.ok && r.resultado.filas.length === 1 && ultima('Marcas de hojas')[7] === '2026-11-02T09:00:00', '… y se quita mientras siga la semana (la fila de antes de v5 cuenta como «Ejecutado»)');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 3, marcado: true });
  ok(r.ok && r.resultado.filas.length === 1, '«Cada mes»: la marca de octubre no cuenta en noviembre');
  reloj.t = Date.UTC(2026, 10, 9, 15, 0, 0);
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 2, marcado: true });
  ok(r.ok && r.resultado.filas.length === 1, '«Cada semana»: la semana siguiente se marca otra vez');
  r = llamar('quien-ocupa', 'marcarHoja', { puesto: 'PUE', hoja: 'Hoja de prueba', orden: 3, marcado: true });
  ok(r.ok && r.resultado.filas.length === 0, '«Cada mes»: dentro del mes ya cuenta');
  reloj.t = AHORA;

  // Estructura.
  const G2 = crearGoogle(SHEET(), { t: AHORA });
  G2.hoja('Hojas').filas[1].push('', '', 'NO-TOCAR');   // un dato suelto más a la derecha: el título va al final de los títulos
  vm.runInNewContext(fuente, G2.ctx);
  const datos = n => JSON.stringify(G2.hoja(n).filas.slice(1).map(f => f.map(v => Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : v)));
  const antesH = datos('Hojas'), antesMH = datos('Marcas de hojas');
  const hechos = G2.ctx.actualizarEstructura();
  ok(G2.hoja('Hojas').filas[0][5] === 'Asignación' && datos('Hojas') === antesH, 'actualizarEstructura agrega «Asignación» al final de Hojas sin tocar sus filas');
  ok(G2.hoja('Marcas de hojas').filas[0].slice(6).join() === 'Resultado,Nota' && datos('Marcas de hojas') === antesMH, '… y «Resultado» y «Nota» al final de Marcas de hojas, sin tocar las marcas');
  const leeme = G2.hoja('Léeme').filas;
  ok(leeme.length === 4 && leeme[1][1] !== 'TEXTO-VIEJO-DEL-LEEME' && /Desmarcada/.test(leeme[1][1]) && leeme.some(f => /Asignación/.test(f[0])), 'el Léeme: pone al día su renglón y agrega los nuevos (' + hechos.join(' / ') + ')');
  const otra = G2.ctx.actualizarEstructura();
  ok(G2.hoja('Léeme').filas.length === 4 && G2.hoja('Hojas').filas[0].filter(t => t === 'Asignación').length === 1 && otra.some(x => /ya tenía todos sus títulos/.test(x)), 'correrla otra vez no repite nada');
  // Una escritura con una columna que falta no escribe nada.
  const G3 = crearGoogle(Object.assign(SHEET(), { 'Marcas': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Orden del punto', 'Período', 'Resultado']] }), { t: AHORA });
  vm.runInNewContext(fuente, G3.ctx);
  const r3 = G3.ctx.atender_({ key: CLAVE, usuario: 'quien-ocupa', accion: 'marcar', datos: { puesto: 'PUE', marcas: [{ orden: 6, resultado: 'No ejecutado', nota: 'x' }] } });
  ok(!r3.ok && r3.codigo === 'sin_estructura' && G3.hoja('Marcas').filas.length === 1, 'si a Marcas le falta la columna Nota, no escribe nada y lo dice');
  return f;
}

console.log('· Procesos.gs (v5)');
const fallas = comprobar(FUENTE, true);
console.log(fallas ? '✗ ' + fallas + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');

// [nombre, texto de hoy, texto roto]
const ROTURAS = [
  ['se quita la marca de otra persona', "if (normalizar_(m.usuario) !== normalizar_(usuario)) throw new ErrorUsuario_('Esa marca la puso otra persona: solo ella puede quitarla.', 'ajena');", ""],
  ['se quita una marca de un período cerrado', "if (m.periodo !== periodoDe_(punto.frecuencia, hoyISO_())) throw new ErrorUsuario_('El período de esa marca ya cerró: no se puede quitar.', 'cerrado');", ""],
  ['«No ejecutado» sin motivo', "if (r === 'No ejecutado' && !nota) throw", "if (false) throw"],
  ['por evento sin nota', "if (evento && !nota) throw", "if (false) throw"],
  ['el mismo período se marca dos veces', "if (!evento && enPie.some(function (x) { return x.orden === orden && x.periodo === periodo; }))", "if (false)"],
  ['una «Desmarcada» no quita nada', "quitadas[normalizar_(x.usuario) + '|' + clave(x) + '|' + texto_(x.nota)] = true;", "quitadas[texto_(x.nota)] = true;"],
  ['«Cumplido» ya no se entiende', "|| SINONIMOS[n];", ";"],
  ['los pasos semanales se cuentan por día', "function formaPaso_(momento) { return MOMENTO_PERIODO[normalizar_(momento)] || 'dia'; }", "function formaPaso_(momento) { return 'dia'; }"],
  ['se desmarca el paso de otra persona', "if (ya.some(function (m) { return normalizar_(m.usuario) !== normalizar_(usuario); })) throw new ErrorUsuario_('Ese paso lo marcó otra persona: solo ella puede desmarcarlo.', 'ajena');", ""],
  ['leer sin calendario', "  out.calendario = calendario_(out.hoy);\n", ""],
  ['el calendario de menos días', "var DIAS_CALENDARIO = 120;", "var DIAS_CALENDARIO = 30;"],
  ['la fecha sin segundos', "return Utilities.formatDate(d, zona_(), \"yyyy-MM-dd'T'HH:mm:ss\");", "return Utilities.formatDate(d, zona_(), \"yyyy-MM-dd'T'HH:mm\");"],
  ['agregar_ escribe aunque falte la columna', "    if (!t.col[normalizar_(titulo)]) throw", "    if (false) throw"],
  ['actualizarEstructura no agrega «Asignación»', "  if (hh) hechos = hechos.concat(agregarTitulos_(hh, TABLAS.hojas.obligatorias, ['Asignación']));\n", ""],
  ['Marcas de hojas no recibe Resultado ni Nota al marcar', "  if (h) { agregarTitulos_(h, TABLAS.marcasHojas.obligatorias, TITULOS_MARCAS_HOJAS); return h; }", "  if (h) return h;"],
  ['el Léeme no se pone al día', "else if (texto_(lv[i][1]) !== r[1]) {", "else if (false) {"],
  ['la revisión acepta «Ejecutado»', "var RESULTADOS_REVISION = ['Cumplido', 'No'];", "var RESULTADOS_REVISION = ['Cumplido', 'No', 'Ejecutado'];"],
  ['los puntos no dicen si son por evento', "x.forma = r ? r[0] : ''; x.evento = r === POR_EVENTO;", "x.forma = r ? r[0] : '';"]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (FUENTE.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  let f;
  try { f = comprobar(FUENTE.replace(de, a), false); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
