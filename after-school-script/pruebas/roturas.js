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
// Con core.autocrlf el .gs puede llegar con CRLF: se normaliza para que las roturas de varias líneas encuentren su texto.
const original = fs.readFileSync(GS, 'utf8').replace(/\r\n/g, '\n');

const ROTURAS = [
  ['no exige la clave', "if (!igualSeguro_(p.key, clave)) return", "if (false) return"],
  ['no exige el usuario', "if (!usuario) return { ok: false, error: 'La llamada no trae", "if (false) return { ok: false, error: 'La llamada no trae"],
  ['acepta claves cortas', "if (!clave || clave.length < 24)", "if (!clave)"],
  ['deja pasar la clase llena', "if (res >= c.cupo) throw", "if (res > c.cupo) throw"],
  ['cuenta las bajas como activas', "function inscripcionActiva_(f) { return texto_(f['Fecha baja']) === '' ; }", "function inscripcionActiva_(f) { return true; }"],
  ['no pone texto en las filas nuevas', "[[COLUMNAS_TEXTO, '@'], ", "["],
  ['no exige motivo de la lista', "if (!m) throw new ErrorUsuario_('El motivo", "if (false) throw new ErrorUsuario_('El motivo"],
  ['acepta bajas futuras', "if (Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') > hoyISO_())", "if (false)"],
  ['mover no valida el cupo del destino', "  exigirNoFutura_(fecha, 'del cambio');\n  exigirCupoFijo_(clases, ins, pruebas, nueva, idNino);", "  exigirNoFutura_(fecha, 'del cambio');"],
  ['el ensayo escribe', "function ensayarCarga() { return informeCarga_(planCarga_(), false); }", "function ensayarCarga() { cargaInicial(); return informeCarga_(planCarga_(), false); }"],
  ['la carga pisa datos existentes', "if (ocupadas.length) return", "if (false) return"],
  ['Por revisar no depende de Revisar', "'Estado': revisar ? ESTADO.revisar : ESTADO.activo", "'Estado': ESTADO.activo"],
  ['no avisa el pago repetido', "if (previos.length) throw", "if (false) throw"],
  ['sin lock al escribir', "if (!lock.tryLock(20000)) return", "if (false) return"],
  ['la carga no marca la clase de adultos', "'Notas': adultos ? NOTA_CLASE_ADULTOS : ''", "'Notas': ''"],
  ['leer no devuelve la nota', "alta: aISO_(f['Fecha alta']), nota: texto_(f['Notas']) });", "alta: aISO_(f['Fecha alta']), nota: '' });"],
  ['la copia en memoria no recibe las filas nuevas', "  if (tabla.filas) objetos.forEach(", "  if (false) objetos.forEach("],
  ['la copia en memoria no recibe los cambios de celda', "  cols.forEach(function (x) { fila[x.t] = x.v; });", ""],
  ['escribe las filas nuevas encima de la última', "var desde = Math.max(ultima + 1, FILA_DATOS)", "var desde = Math.max(ultima, FILA_DATOS)"],
  // 15-oct: pruebas, inscribir varias, ocupación por fecha, estructura
  ['la prueba no ocupa cupo', "var PRUEBA_OCUPA = [ESTADO_PRUEBA.agendada, ESTADO_PRUEBA.asistio];", "var PRUEBA_OCUPA = [];"],
  ['inscribir ignora las pruebas futuras', "    if (d >= hoy) fechas[d] = true;", ""],
  ['la propia prueba del niño le cierra el cupo', "!(excluirNino && texto_(f['Niño ID']) === excluirNino)", "true"],
  ['inscribir varias no es todo o nada', "  if (errores.length) {\n    if (lista.length === 1)", "  if (errores.length && lista.length === 1) {\n    if (lista.length === 1)"],
  ['acepta alta futura', "  exigirNoFutura_(alta, 'de alta');", ""],
  ['mover acepta fecha futura', "  exigirNoFutura_(fecha, 'del cambio');\n  exigirCupoFijo_(clases, ins, pruebas, nueva, idNino);\n  exigirBajaNoAntesDeAlta_(vieja, fecha);", "  exigirCupoFijo_(clases, ins, pruebas, nueva, idNino);"],
  ['agenda en un día que no es el de la clase', "  if (diaSemana_(iso) !== dia) {", "  if (false) {"],
  ['agenda en fecha pasada', "if (iso < hoyISO_()) throw", "if (false) throw"],
  ['Asistió antes del día de la prueba', "if (estado !== ESTADO_PRUEBA.cancelada && iso > hoy)", "if (false)"],
  ['No se inscribió sin motivo', "if (!texto_(datos.motivo)) throw new ErrorUsuario_('Si no se inscribió", "if (false) throw new ErrorUsuario_('Si no se inscribió"],
  ['el Prospecto no pasa a Activo', "if (texto_(n['Estado']) === ESTADO.prospecto) {", "if (false) {"],
  ['el prospecto nace Activo', "idNino = agregarNino_(ninos, valores, ESTADO.prospecto);", "idNino = agregarNino_(ninos, valores, ESTADO.activo);"],
  ['las inscripciones cerradas cuentan después de la baja', "return (!alta || alta <= iso) && (!baja || baja > iso);", "return (!alta || alta <= iso) && (!baja || baja >= iso);"],
  ['estructura pisa la última columna', "    var desde = ultima + 1;", "    var desde = ultima;"],
  ['estructura repite listas de Config', "!listas[norm_(r[0])];", "true;"],
  ['no valida «cómo nos conoció»', "if (!v) throw new ErrorUsuario_('«' + valores[col] + '» no está en la lista", "if (false) throw new ErrorUsuario_('«' + valores[col] + '» no está en la lista"],
  // Ajustes previos a publicar: baja total y comas
  ['la baja total no cancela las pruebas', "  aCancelar.forEach(function (f) {\n    var nota", "  [].forEach(function (f) {\n    var nota"],
  ['la baja total cancela también las pruebas pasadas', "texto_(f['Estado']) === ESTADO_PRUEBA.agendada && aISO_(f['Fecha']) >= hoy;", "texto_(f['Estado']) === ESTADO_PRUEBA.agendada;"],
  ['la baja total cancela pruebas con resultado', "texto_(f['Estado']) === ESTADO_PRUEBA.agendada && aISO_(f['Fecha']) >= hoy;", "aISO_(f['Fecha']) >= hoy;"],
  ['la baja total pisa la nota de la prueba', "Nota': nota ? nota + ' · ' + NOTA_CANCELADA_POR_BAJA : NOTA_CANCELADA_POR_BAJA", "Nota': NOTA_CANCELADA_POR_BAJA"],
  ['la cancelación no queda en Historial', "    hist.push(['Cancelar prueba',", "    [].push(['Cancelar prueba',"],
  ['ofrece intereses con coma', "      if (valor.indexOf(',') >= 0) cfg.avisos.push(", "      if (false) cfg.avisos.push("],
  ['comprobar no avisa de las comas', "    cfg.avisos.forEach(function (f) { l.push('⚠ Config: ' + f); });", ""],
  ['acepta al guardar un interés con coma', "        if (texto_(x).indexOf(',') >= 0) throw", "        if (false) throw"],
  // 16-oct: escrituras idempotentes
  ['no busca el ID: el reintento se ejecuta otra vez', "      var previa = buscarSolicitud_(sol, idSol);", "      var previa = null;"],
  ['no compara la huella: otro dato con el mismo ID pasa', "        if (texto_(previa['Huella']) !== huella || texto_(previa['Acción']) !== p.accion)", "        if (false)"],
  ['no registra el ID tras ejecutar', "    if (idSol) registrarSolicitud_(sol, idSol, p.accion, huella, resultado, usuario);", ""],
  ['registra el ID antes de ejecutar (y aunque falle)', "    var resultado = acc.fn(datos, usuario);\n    if (idSol) registrarSolicitud_(sol, idSol, p.accion, huella, resultado, usuario);", "    if (idSol) registrarSolicitud_(sol, idSol, p.accion, huella, null, usuario);\n    var resultado = acc.fn(datos, usuario);"],
  ['la huella depende del orden de las claves', "Object.keys(v).sort().map(", "Object.keys(v).map("],
  ['acepta un ID de formato inválido', "  if (idSol && !ID_SOLICITUD_VALIDO.test(idSol)) return", "  if (false) return"],
  ['busca en toda la pestaña en vez de la ventana', "Math.max(FILA_DATOS, ultima - VENTANA_SOLICITUDES + 1)", "FILA_DATOS"],
  ['las lecturas también usan el ID', "  var idSol = acc.escribe ? texto_(p.idSolicitud) : '';", "  var idSol = texto_(p.idSolicitud);"],
  // 16-oct: pago de la clase de prueba
  ['Pagó Sí sin exigir monto', "    if (!(monto > 0)) throw new ErrorUsuario_('Si pagó, el monto es obligatorio", "    if (false) throw new ErrorUsuario_('Si pagó, el monto es obligatorio"],
  ['acepta cualquier valor en «Pagó»', "  if (pago && pago !== SI && pago !== NO) throw", "  if (false) throw"],
  ['Pagó No conserva el monto', "  var monto = '';\n  if (pago === SI) {", "  var monto = numeroDe_(datos.monto) || '';\n  if (pago === SI) {"],
  ['no redondea el monto a centavos', "    monto = Math.round(monto * 100) / 100;\n  }\n  return { 'Pagó'", "  }\n  return { 'Pagó'"],
  ['el resultado ignora el pago', "  var pago = 'pago' in datos ? valoresPagoPrueba_(datos) : null;", "  var pago = null;"],
  ['el resultado borra el pago si no viene', "  var pago = 'pago' in datos ? valoresPagoPrueba_(datos) : null;", "  var pago = valoresPagoPrueba_(datos);"],
  ['el pago no deja Historial', "  historial_(usuario, 'Pago de prueba',", "  if (false) historial_(usuario, 'Pago de prueba',"],
  ['leer no devuelve el monto', "monto: texto_(f['Monto pagado']) === '' ? null : numeroDe_(f['Monto pagado'])", "monto: null"],
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
