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
  ['semanal se guarda como mes', "  if (forma === 'mes') return iso.slice(0, 7);", "  if (forma === 'mes' || forma === 'semana') return iso.slice(0, 7);"],
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
  ['escribe encima de la última fila', "var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos) + 1;", "var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos);"]
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
