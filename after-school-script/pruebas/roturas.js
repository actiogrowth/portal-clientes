/* Rompe a propósito cada defensa de AfterSchool.gs y comprueba que
 * prueba-after-school.js lo detecta. Una prueba que no puede fallar no
 * prueba nada.
 *
 *   node after-school-script/pruebas/roturas.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GS = path.join(__dirname, '..', 'AfterSchool.gs');
const PRUEBA = path.join(__dirname, 'prueba-after-school.js');
const original = fs.readFileSync(GS, 'utf8');

const ROTURAS = [
  ['no exige la clave', "if (!igualSeguro_(p.key, clave)) return", "if (false) return"],
  ['no exige el usuario', "if (!usuario) return { ok: false, error: 'La llamada no trae", "if (false) return { ok: false, error: 'La llamada no trae"],
  ['acepta claves cortas', "if (!clave || clave.length < 24)", "if (!clave)"],
  ['deja pasar la clase llena', "if (res >= cupo) throw", "if (res > cupo) throw"],
  ['cuenta las bajas como activas', "function inscripcionActiva_(f) { return texto_(f['Fecha baja']) === '' ; }", "function inscripcionActiva_(f) { return true; }"],
  ['no pone texto en las filas nuevas', "[[COLUMNAS_TEXTO, '@'], ", "["],
  ['no exige motivo de la lista', "if (!m) throw new ErrorUsuario_('El motivo", "if (false) throw new ErrorUsuario_('El motivo"],
  ['acepta bajas futuras', "if (Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') > hoyISO_())", "if (false)"],
  ['mover escribe antes de validar el destino', "  exigirCupo_(clases, ins, nueva);\n  var fecha = exigirFecha_(datos.fecha, 'la fecha del cambio');\n  exigirBajaNoAntesDeAlta_(vieja, fecha);\n  var id = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion)();\n  // Todo validado: ahora se escribe.\n  ponerCeldas_(ins, vieja,", "  var fecha = exigirFecha_(datos.fecha, 'la fecha del cambio');\n  exigirBajaNoAntesDeAlta_(vieja, fecha);\n  var id = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion)();\n  ponerCeldas_(ins, vieja,"],
  ['el ensayo escribe', "function ensayarCarga() { return informeCarga_(planCarga_(), false); }", "function ensayarCarga() { cargaInicial(); return informeCarga_(planCarga_(), false); }"],
  ['la carga pisa datos existentes', "if (ocupadas.length) return", "if (false) return"],
  ['Por revisar no depende de Revisar', "'Estado': revisar ? ESTADO.revisar : ESTADO.activo", "'Estado': ESTADO.activo"],
  ['no avisa el pago repetido', "if (previos.length) throw", "if (false) throw"],
  ['sin lock al escribir', "if (!lock.tryLock(20000)) return", "if (false) return"],
  ['fecha con la zona del script', "var f = Utilities.parseDate(txt, zona_(), 'yyyy-MM-dd');", "var f = Utilities.parseDate(txt, 'UTC', 'yyyy-MM-dd');"]
];

let detectadas = 0;
ROTURAS.forEach(([nombre, de, a]) => {
  if (original.indexOf(de) < 0) { console.log('  ? ' + nombre + ': el texto a romper ya no existe en el .gs (actualizar roturas.js)'); return; }
  const tmp = path.join(os.tmpdir(), 'as-rotura-' + process.pid + '.gs');
  fs.writeFileSync(tmp, original.replace(de, a));
  const r = spawnSync(process.execPath, [PRUEBA], { env: Object.assign({}, process.env, { AS_GS: tmp }), encoding: 'utf8' });
  fs.unlinkSync(tmp);
  const detectada = r.status !== 0;
  if (detectada) detectadas++;
  console.log((detectada ? '  ✓ ' : '  ✗ NO DETECTADA: ') + nombre);
});
console.log('');
console.log(detectadas + ' de ' + ROTURAS.length + ' roturas detectadas');
process.exit(detectadas === ROTURAS.length ? 0 : 1);
