/* Rompe a propósito cada defensa de Procesos.gs y exige que
 * prueba-procesos.js lo detecte (que falle con la copia rota).
 *
 *   node procesos-script/pruebas/roturas.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GS = path.join(__dirname, '..', 'Procesos.gs');
const PRUEBA = path.join(__dirname, 'prueba-procesos.js');

// [nombre, texto de hoy, texto roto]
const ROTURAS = [
  ['no lee «Visible solo para»', "    ['Visible solo para', 'soloPara']] },", "    ] },"],
  ['acepta cualquier clave', "if (!igualSeguro_(p.key, clave))", "if (false)"],
  ['acepta claves cortas', "if (!clave || clave.length < 24)", "if (!clave)"],
  ['acepta llamadas sin usuario', "if (!usuario) return", "if (false) return"],
  ['solo busca los títulos en la fila 1', "var FILAS_PARA_BUSCAR_TITULOS = 10;", "var FILAS_PARA_BUSCAR_TITULOS = 1;"],
  ['no salta las filas vacías', "if (!vacia) filas.push(o);", "filas.push(o);"],
  ['escribe en un puesto que no está abierto', "if (normalizar_(p.estado) !== normalizar_(ABIERTO)) throw", "if (false) throw"],
  ['acepta un contrato con la versión vieja', "if (Number(d.version) !== p.version) throw", "if (false) throw"],
  ['el período lo elige el navegador', "'Período': periodoDe_(punto.frecuencia, hoy)", "'Período': texto_(d.periodo) || periodoDe_(punto.frecuencia, hoy)"],
  ['semanal se guarda como mes', "  if (forma === 'semana') return semanaISO_(iso);", "  if (forma === 'semana') return iso.slice(0, 7);"],
  // 30-oct (v4): frecuencias nuevas
  ['la quincena corta en otro día', "(+iso.slice(8, 10) <= 15 ? '-Q1' : '-Q2')", "(+iso.slice(8, 10) < 15 ? '-Q1' : '-Q2')"],
  ['el trimestre se calcula como cuatrimestre', "return anio + '-T' + Math.ceil(mes / 3);", "return anio + '-T' + Math.ceil(mes / 4);"],
  ['el cuatrimestre se calcula como trimestre', "return anio + '-C' + Math.ceil(mes / 4);", "return anio + '-C' + Math.ceil(mes / 3);"],
  ['«Por …» no se acepta', "if (EVENTOS.indexOf(n) >= 0 || /^por \\S/.test(n)) return POR_EVENTO;", "if (EVENTOS.indexOf(n) >= 0) return POR_EVENTO;"],
  ['cualquier cosa que empiece con «Por» se acepta', "/^por \\S/.test(n)", "/^por/.test(n)"],
  ['Cada rotación no se acepta', "var EVENTOS = ['cuando aplica', 'por persona nueva', 'cada rotacion', 'cada cambio de tema'];", "var EVENTOS = ['cuando aplica', 'por persona nueva', 'cada cambio de tema'];"],
  ['«Por temporada» pasa a ser por evento', "  if (PERIODOS[n]) return PERIODOS[n];\n", ""],
  ['los grupos de la lista no llegan', "    x.grupo = r ? r[1] : texto_(x.frecuencia); x.grupoOrden = r ? r[2] : 99;", "    x.grupo = texto_(x.frecuencia); x.grupoOrden = 99;"],
  ['un período inválido de quincena se acepta', "|-Q[12])?|-S(", "|-Q\\d)?|-S("],
  ['un período inválido de cuatrimestre se acepta', "|-C[1-3])?$/", "|-C\\d)?$/"],
  ['el período no queda como texto (Sheets lo convierte en fecha)', "    if (c) t.hoja.getRange(desde, c, objetos.length, 1).setNumberFormat('@');", ""],
  ['marca un punto que no es del puesto', "    if (!punto) throw new ErrorUsuario_('El punto '", "    if (!punto) punto = puntos[0] || { frecuencia: 'Diario' }; if (false) throw new ErrorUsuario_('El punto '"],
  ['acepta cualquier resultado', "    if (!r) throw new ErrorUsuario_('Resultado inválido: «' + texto_(m.resultado)", "    if (!r) r = texto_(m.resultado); if (false) throw new ErrorUsuario_('Resultado inválido: «' + texto_(m.resultado)"],
  ['acepta un período inválido al revisar', "if (!periodoValido_(d.periodo)) throw", "if (false) throw"],
  ['escribe sin candado', "if (!lock.tryLock(20000)) return", "if (false) return"],
  ['no lee la pestaña Metas', "  metas: { hoja: 'Metas'", "  metasNo: { hoja: 'Metas'"],
  ['un mes de Metas convertido en fecha se lee como día', "if (Object.prototype.toString.call(x) === '[object Date]') return isoDe_(x).slice(0, 7);", "if (Object.prototype.toString.call(x) === '[object Date]') return isoDe_(x);"],
  ['actualizarEstructura no deja Período como texto', "    t.hoja.getRange(desde, t.col[normalizar_('Período')], filas, 1).setNumberFormat('@');", ""],
  ['actualizarEstructura repite los títulos', "  var faltan = agregar.filter(function (t) { return tiene.indexOf(normalizar_(t)) < 0; });", "  var faltan = agregar.slice();"],
  ['actualizarEstructura escribe encima de la última columna', "  h.getRange(fila + 1, ancho + 1, 1, faltan.length).setValues([faltan]);", "  h.getRange(fila + 1, ancho, 1, faltan.length).setValues([faltan]);"],
  ['Estado de Metas acepta cualquier cosa', ".setAllowInvalid(false).build();", ".setAllowInvalid(true).build();"],
  // 29-oct (v3)
  ['no lee la pestaña Hojas', "  hojas: { hoja: 'Hojas'", "  hojasNo: { hoja: 'Hojas'"],
  ['la hora se lee como fecha (no como se ve)', "['Hora', 'hora', 'visible']", "['Hora', 'hora', 'fechaHora']"],
  ['avisa que falta Marcas de hojas antes de que exista', "if (!h) { if (!def.opcional) faltan.push(", "if (!h) { if (true) faltan.push("],
  ['no avisa los puestos que no están en Puestos', "if (x.puesto && !ids[x.puesto]) malos[x.puesto] = true;", ""],
  ['marca un paso en un puesto que no está abierto', "  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto);\n  var pasos = pasosDe_(ss, p.id, d.hoja);", "  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = leerTabla_(ss, TABLAS.puestos, []).filas.filter(function (x) { return x.id === texto_(d.puesto); })[0];\n  var pasos = pasosDe_(ss, p.id, d.hoja);"],
  ['marca un paso que no es de la hoja', "  if (!paso) throw new ErrorUsuario_('El paso '", "  if (!paso) paso = pasos[0]; if (false) throw new ErrorUsuario_('El paso '"],
  ['marca dos veces el mismo paso el mismo día', "  if (d.marcado && !ya.length) {", "  if (d.marcado) {"],
  ['desmarca la marca de otra persona', "if (ya.some(function (m) { return normalizar_(m.usuario) !== normalizar_(usuario); })) throw", "if (false) throw"],
  ['desmarca marcas de días anteriores', "    if (fecha.slice(0, 10) !== hoy) continue;\n", ""],
  ['las iniciales llegan sin limpiar', "'Iniciales': iniciales_(d.iniciales, usuario)", "'Iniciales': texto_(d.iniciales)"],
  ['la verificación de una hoja acepta un día futuro', " || texto_(d.periodo) > hoyISO_()) throw", ") throw"],
  ['la nota de la verificación no dice la hoja', "  if (notaHoja) nota = notaHoja + (nota ? ' · ' + nota : '');", ""],
  ['actualizarEstructura repite el renglón del Léeme', "    if (lv.some(function (f) { return normalizar_(f[0]) === normalizar_(LEEME_MARCAS_HOJAS[0]); })) hechos.push", "    if (false) hechos.push"],
  ['escribe encima de la última fila',"var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos) + 1;", "var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos);"]
];

const original = fs.readFileSync(GS, 'utf8').replace(/\r\n/g, '\n');
let detectadas = 0, malas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (original.split(de).length !== 2) { malas++; console.log('  ? ' + nombre + ': el texto a romper no aparece una sola vez (actualizar roturas.js)'); continue; }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rotura-')), 'Procesos.gs');
  fs.writeFileSync(tmp, original.replace(de, a));
  const r = spawnSync(process.execPath, [PRUEBA, tmp], { encoding: 'utf8' });
  if (r.status !== 0) { detectadas++; console.log('  ✓ detectada: ' + nombre); }
  else console.log('  ✗ NO detectada: ' + nombre);
}
const total = ROTURAS.length;
console.log(detectadas === total && !malas ? '✓ las ' + total + ' roturas se detectan' : '✗ ' + (total - detectadas) + ' de ' + total + ' roturas sin detectar');
process.exit(detectadas === total && !malas ? 0 : 1);
