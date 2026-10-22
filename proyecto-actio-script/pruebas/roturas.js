/* Rompe a propósito cada defensa de ProyectoActio.gs y exige que
 * prueba-proyecto-actio.js lo detecte (que falle con la copia rota).
 *
 *   node proyecto-actio-script/pruebas/roturas.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GS = path.join(__dirname, '..', 'ProyectoActio.gs');
const PRUEBA = path.join(__dirname, 'prueba-proyecto-actio.js');

// [nombre, texto de hoy, texto roto]
const ROTURAS = [
  ['lee por posición en vez de por título', "col[c.campo] = titulos.indexOf(normalizar_(c.titulo));", "col[c.campo] = def.columnas.indexOf(c);"],
  ['solo busca los títulos en la fila 1', "var FILAS_PARA_BUSCAR_TITULOS = 10;", "var FILAS_PARA_BUSCAR_TITULOS = 1;"],
  ['manda las Notas internas de Actio', "    { titulo: 'Proyecto', campo: 'proyecto' }\n    // «Origen duración»", "    { titulo: 'Proyecto', campo: 'proyecto' }, { titulo: 'Notas', campo: 'notas' }\n    // «Origen duración»"],
  ['manda el Origen de la duración', "    { titulo: 'Duración (min)', campo: 'duracionMin', tipo: 'numero' },", "    { titulo: 'Duración (min)', campo: 'duracionMin', tipo: 'numero' }, { titulo: 'Origen duración', campo: 'origenDuracion' },"],
  ['acepta cualquier clave', "if (!igualSeguro_(p.key, clave))", "if (false)"],
  ['acepta otras acciones', "if (p.accion !== 'leer')", "if (false)"],
  ['acepta claves cortas', "if (!clave || clave.length < 24)", "if (!clave)"],
  ['no normaliza dd/mm/aaaa', "if (m) return m[3] + '-' + dos_(+m[2]) + '-' + dos_(+m[1]);", "if (m) return s;"],
  ['el 100 % de una celda con formato queda en 1', "return Math.round((x <= 1 ? x * 100 : x) * 10) / 10;", "return x;"],
  ['no salta las filas vacías', "if (!vacia) filas.push(o);", "filas.push(o);"]
];

const original = fs.readFileSync(GS, 'utf8').replace(/\r\n/g, '\n');
let detectadas = 0, malas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (original.split(de).length !== 2) { malas++; console.log('  ? ' + nombre + ': el texto a romper no aparece una sola vez (actualizar roturas.js)'); continue; }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pa-rotura-')), 'ProyectoActio.gs');
  fs.writeFileSync(tmp, original.replace(de, a));
  const r = spawnSync(process.execPath, [PRUEBA, tmp], { encoding: 'utf8' });
  if (r.status !== 0) { detectadas++; console.log('  ✓ detectada: ' + nombre); }
  else console.log('  ✗ NO detectada: ' + nombre);
}
const total = ROTURAS.length;
console.log(detectadas === total && !malas ? '✓ las ' + total + ' roturas se detectan' : '✗ ' + (total - detectadas) + ' de ' + total + ' roturas sin detectar');
process.exit(detectadas === total && !malas ? 0 : 1);
