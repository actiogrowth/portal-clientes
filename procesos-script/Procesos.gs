/* ═════════════════════════════════════════════════════════════════════════════
 *  PROCESOS · EQUIPO · Sheet «Procesos — Vida en Arte» (26-oct-2026)
 *
 *  Los puestos de Vida en Arte, sus contratos de posición, sus listas de
 *  verificación y sus procesos. Lo edita Actio (reglas en la pestaña Léeme).
 *  Lo llama el portal (equipo/api.php) con el sobre de siempre:
 *      { key, usuario, accion, datos }
 *
 *  · leer     devuelve todas las pestañas al PUENTE. Qué ve cada persona lo
 *             decide el puente (equipo/api.php), no este script.
 *  · aceptar  { puesto, version }                         → Aceptaciones
 *  · marcar   { puesto, marcas: [{ orden, resultado, nota }] } → Marcas
 *  · revisar  { puesto, periodo, sorpresa, resultado, nota } → Revisiones
 *    Solo en puestos «Abierto al equipo». QUIÉN puede lo comprueba el puente
 *    (este script no conoce los roles del portal); aquí se valida el resto:
 *    que el puesto y el punto existan, la versión vigente y el período.
 *  · El período de una marca lo calcula ESTE script con la fecha de hoy y
 *    «Cada cuánto» del punto: el navegador no lo elige.
 *  · Solo escribe en Aceptaciones, Marcas y Revisiones (al final, nunca pisa
 *    una fila; 29-oct: y en Marcas de hojas, ver v3). Las columnas se leen por TÍTULO, nunca por letra, desde la
 *    fila de títulos que se encuentre en las primeras filas de cada pestaña.
 *  · La clave vive en las Propiedades del script (PR_CLAVE_API), nunca aquí.
 *
 *  · 26-oct (v2): «leer» trae también la pestaña Metas (las metas del
 *    Resumen del negocio; solo las usa resumen/api.php) y actualizarEstructura()
 *    la crea. El portal nunca escribe en Metas.
 *
 *  · 29-oct (v3): «leer» trae también Hojas (pasos diarios de un puesto),
 *    Reglas del juego, Horarios del servicio y Marcas de hojas.
 *    · marcarHoja { puesto, hoja, orden, marcado, iniciales } → Marcas de hojas.
 *      Marca un paso HOY con la hora del servidor; desmarcar borra la marca
 *      de hoy de ese paso, y solo si la puso el mismo usuario. Las iniciales
 *      las manda el puente (salen de la cuenta del portal), no el navegador.
 *      Si la pestaña no existe, la crea con sus títulos.
 *    · revisar con { hoja }: la verificación de una hoja. Período = un día
 *      (hoy si no viene; nunca uno futuro) y la Nota empieza con Hoja «…».
 *    · La Hora de «Horarios del servicio» se lee COMO SE VE en el Sheet
 *      (Sheets convierte «10:00» en una hora y la devolvería como fecha).
 *    Desde v3 escribe solo en Aceptaciones, Marcas, Marcas de hojas y
 *    Revisiones (en Marcas de hojas también borra, al desmarcar).
 *
 *  · 30-oct (v4): «Cada cuánto» acepta Quincenal (AAAA-MM-Q1/Q2), Trimestral
 *    (AAAA-T1…T4), Cada 4 meses (AAAA-C1…C3) y los de «por evento» (lo que
 *    empieza con «Por », Cada rotación, Cada cambio de tema): período = el
 *    día. «leer» agrega a cada punto su grupo y el orden del grupo.
 *
 *  Instalación: Extensiones › Apps Script en el MISMO Sheet, pegar este
 *  archivo, poner la propiedad PR_CLAVE_API e Implementar como aplicación
 *  web (pasos en docs/ARQUITECTURA.md › Equipo). Al cambiar de versión:
 *  Implementar › Gestionar implementaciones › editar › Versión nueva (la
 *  dirección /exec no cambia), y correr actualizarEstructura una vez.
 * ═════════════════════════════════════════════════════════════════════════════ */

var VERSION_SCRIPT = 'v4';   // 30-oct: frecuencias nuevas de «Cada cuánto» (v3, 29-oct: Hojas, Reglas, Horarios y Marcas de hojas)
var PROP_CLAVE = 'PR_CLAVE_API';
var FILAS_PARA_BUSCAR_TITULOS = 10;

/* Vocabulario del Sheet (lo que dice su pestaña Léeme). */
var ABIERTO = 'Abierto al equipo';
var RESULTADOS = ['Cumplido', 'No'];
var SORPRESA = ['Sí', 'No'];
var SECCIONES = { resultado: 'Resultado', trabajo: 'Trabajo', estandares: 'Estándar' };
/* «Cada cuánto» → [forma del período, grupo de la lista, orden del grupo].
   30-oct (v4): Quincenal, Trimestral y Cada 4 meses; y «por evento»: lo que
   empieza con «Por » (Por pago, Por cumpleaños…), Cada rotación, Cada cambio
   de tema, Cuando aplica y Por persona nueva → se marca cada vez que ocurre,
   período = el día, grupo «Cada vez que ocurre». «Por temporada» es de
   calendario (va antes de la regla de «Por »). */
var PERIODOS = {
  'diario': ['dia', 'Diario', 1], 'semanal': ['semana', 'Semanal', 2], 'quincenal': ['quincena', 'Quincenal', 3],
  'mensual': ['mes', 'Mensual', 4], 'trimestral': ['trimestre', 'Trimestral', 5], 'cada 4 meses': ['cuatrimestre', 'Cada 4 meses', 6],
  'por temporada': ['anio', 'Por temporada', 7]
};
var POR_EVENTO = ['dia', 'Cada vez que ocurre', 8];
var EVENTOS = ['cuando aplica', 'por persona nueva', 'cada rotacion', 'cada cambio de tema'];

/* Las pestañas y sus columnas ('campo' en la respuesta). */
var TABLAS = {
  puestos: { hoja: 'Puestos', obligatorias: ['ID', 'Puesto', 'Estado'], columnas: [
    ['ID', 'id'], ['Puesto', 'puesto'], ['Área', 'area'], ['Unidad', 'unidad'], ['Reporta a', 'reportaA'], ['Cantidad', 'cantidad'],
    ['Estado', 'estado'], ['Versión', 'version', 'numero'], ['Fecha versión', 'fechaVersion', 'fecha'], ['Verifica', 'verifica'], ['Cómo verifica', 'comoVerifica'],
    // 26-oct: opcional. Con algo, el puesto solo existe para esos usuarios o roles, Dirección y Administrador (lo aplica equipo/api.php).
    ['Visible solo para', 'soloPara']] },
  contratos: { hoja: 'Contratos', obligatorias: ['Puesto ID', 'Sección', 'Texto'], columnas: [
    ['Puesto ID', 'puesto'], ['Sección', 'seccion'], ['Orden', 'orden', 'numero'], ['Texto', 'texto']] },
  listas: { hoja: 'Listas', obligatorias: ['Puesto ID', 'Orden', 'Qué se verifica', 'Cada cuánto'], columnas: [
    ['Puesto ID', 'puesto'], ['Orden', 'orden', 'numero'], ['Qué se verifica', 'texto'], ['Evidencia', 'evidencia'], ['Cada cuánto', 'frecuencia']] },
  procesos: { hoja: 'Procesos', obligatorias: ['Puesto ID', 'Proceso'], columnas: [
    ['Puesto ID', 'puesto'], ['Proceso', 'proceso'], ['Descripción', 'descripcion'], ['Enlace', 'enlace'], ['Estado', 'estado']] },
  asignaciones: { hoja: 'Asignaciones', obligatorias: ['Usuario del portal', 'Puesto ID'], columnas: [
    ['Usuario del portal', 'usuario'], ['Puesto ID', 'puesto'], ['Desde', 'desde', 'fecha'], ['Hasta', 'hasta', 'fecha']] },
  aceptaciones: { hoja: 'Aceptaciones', obligatorias: ['Fecha y hora', 'Usuario', 'Puesto ID', 'Versión'], columnas: [
    ['Fecha y hora', 'fecha', 'fechaHora'], ['Usuario', 'usuario'], ['Puesto ID', 'puesto'], ['Versión', 'version', 'numero']] },
  marcas: { hoja: 'Marcas', obligatorias: ['Fecha y hora', 'Usuario', 'Puesto ID', 'Orden del punto', 'Período', 'Resultado'], columnas: [
    ['Fecha y hora', 'fecha', 'fechaHora'], ['Usuario', 'usuario'], ['Puesto ID', 'puesto'], ['Orden del punto', 'orden', 'numero'],
    ['Período', 'periodo', 'periodo'], ['Resultado', 'resultado'], ['Nota', 'nota']] },
  revisiones: { hoja: 'Revisiones', obligatorias: ['Fecha y hora', 'Revisor', 'Puesto ID', 'Período', 'Resultado'], columnas: [
    ['Fecha y hora', 'fecha', 'fechaHora'], ['Revisor', 'revisor'], ['Puesto ID', 'puesto'], ['Período', 'periodo', 'periodo'],
    ['Sorpresa', 'sorpresa'], ['Resultado', 'resultado'], ['Nota', 'nota']] },
  // 26-oct: metas del Resumen del negocio. Las escribe Vida en Arte; el portal solo las lee
  // (resumen/api.php). La pestaña la crea actualizarEstructura().
  metas: { hoja: 'Metas', obligatorias: ['Cifra', 'Unidad', 'Período', 'Valor', 'Estado'], columnas: [
    ['Cifra', 'cifra'], ['Unidad', 'unidad'], ['Período', 'periodo', 'periodoMeta'], ['Valor', 'valor', 'numero'], ['Estado', 'estado']] },
  // 29-oct (v3): las tres pestañas nuevas que edita Actio y la que escribe el portal.
  hojas: { hoja: 'Hojas', obligatorias: ['Puesto ID', 'Hoja', 'Paso'], columnas: [
    ['Puesto ID', 'puesto'], ['Hoja', 'hoja'], ['Orden', 'orden', 'numero'], ['Momento', 'momento'], ['Paso', 'paso']] },
  reglas: { hoja: 'Reglas del juego', obligatorias: ['Sección', 'Texto'], columnas: [
    ['Sección', 'seccion'], ['Orden', 'orden', 'numero'], ['Texto', 'texto']] },
  horarios: { hoja: 'Horarios del servicio', obligatorias: ['Momento', 'Hora'], columnas: [
    ['Momento', 'momento'], ['Unidad', 'unidad'], ['Hora', 'hora', 'visible'], ['Puestos que lo usan', 'puestos']] },
  // Opcional: la crea marcarHoja (o actualizarEstructura) la primera vez; mientras no exista, no se avisa.
  marcasHojas: { hoja: 'Marcas de hojas', opcional: true, obligatorias: ['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden'], columnas: [
    ['Fecha y hora', 'fecha', 'fechaHora'], ['Usuario', 'usuario'], ['Puesto ID', 'puesto'], ['Hoja', 'hoja'], ['Orden', 'orden', 'numero'], ['Iniciales', 'iniciales']] }
};
var TITULOS_MARCAS_HOJAS = ['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden', 'Iniciales'];
var LEEME_MARCAS_HOJAS = ['Marcas de hojas', 'La escribe el portal: cada paso marcado de una hoja diaria, con la fecha y hora y las iniciales de quien lo marcó. No editar a mano.'];
/* Las pestañas cuyas filas nombran un puesto: «leer» avisa si el puesto no existe en Puestos. */
var CON_PUESTO = ['contratos', 'listas', 'hojas', 'procesos', 'asignaciones'];

/* 26-oct: vocabulario de Metas (las listas desplegables que pone actualizarEstructura). */
var CIFRAS_META = ['Ocupación', 'Niños activos', 'Altas', 'Bajas', 'Pruebas que se inscriben', 'Facturación', 'Margen de la unidad', 'Margen neto'];
var UNIDADES_META = ['Negocio', 'Preschool', 'After School', 'Veranito', 'Baby & Me', 'Cumpleaños'];
var ESTADOS_META = ['Tentativa', 'Confirmada'];

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return respuesta_({ ok: false, error: 'Este puente solo responde a POST desde el portal.' }); }
function doPost(e) {
  var p;
  try { p = JSON.parse(e && e.postData ? e.postData.contents : ''); }
  catch (err) { return respuesta_({ ok: false, error: 'cuerpo ilegible' }); }
  return respuesta_(atender_(p || {}));
}

/** Compara sin cortar en el primer carácter distinto. */
function igualSeguro_(a, b) {
  a = String(a || ''); b = String(b || '');
  var dif = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}

function ErrorUsuario_(mensaje, codigo) { this.message = mensaje; this.codigo = codigo || ''; }

var ACCIONES = { leer: { escribe: false, fn: leer_ }, aceptar: { escribe: true, fn: aceptar_ }, marcar: { escribe: true, fn: marcar_ }, revisar: { escribe: true, fn: revisar_ },
                 marcarHoja: { escribe: true, fn: marcarHoja_ } };

function atender_(p) {
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  if (!clave || clave.length < 24) return { ok: false, error: 'El puente no tiene clave (' + PROP_CLAVE + ', 24 caracteres o más).' };
  if (!igualSeguro_(p.key, clave)) return { ok: false, error: 'Clave incorrecta.' };
  var usuario = texto_(p.usuario);
  if (!usuario) return { ok: false, error: 'La llamada no trae el usuario.' };
  var a = ACCIONES[texto_(p.accion)];
  if (!a) return { ok: false, error: 'Acción desconocida.', codigo: 'sin_permiso' };
  var lock = null;
  try {
    if (a.escribe) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return { ok: false, error: 'El Sheet está ocupado. Prueba otra vez en unos segundos.', codigo: 'ocupado' };
    }
    return { ok: true, resultado: a.fn(p.datos || {}, usuario) };
  } catch (e) {
    if (e instanceof ErrorUsuario_) return { ok: false, error: e.message, codigo: e.codigo };
    return { ok: false, error: 'Error del script: ' + (e && e.message ? e.message : e) };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/* ─── Leer ─────────────────────────────────────────────────────────────── */

function leer_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), faltan = [], out = { generado: new Date().toISOString(), hoy: hoyISO_(), version: VERSION_SCRIPT };
  Object.keys(TABLAS).forEach(function (k) { out[k] = leerTabla_(ss, TABLAS[k], faltan).filas; });
  // El período en curso de cada punto (la regla vive SOLO aquí: el puente y la pantalla no la repiten).
  // 30-oct: también su grupo en la lista y el orden del grupo (desconocido: su propio texto, al final).
  out.listas.forEach(function (x) {
    var r = reglaDe_(x.frecuencia);
    x.grupo = r ? r[1] : texto_(x.frecuencia); x.grupoOrden = r ? r[2] : 99;
    try { x.periodo = periodoDe_(x.frecuencia, out.hoy); }
    catch (e) { x.periodo = ''; faltan.push('Listas: «Cada cuánto» = «' + x.frecuencia + '» (' + x.puesto + ' · ' + x.orden + ') no es uno de los conocidos'); }
  });
  // 29-oct: filas que nombran un puesto que no está en Puestos (no se cortan: se avisan).
  var ids = {};
  out.puestos.forEach(function (p) { ids[p.id] = true; });
  CON_PUESTO.forEach(function (k) {
    var malos = {};
    out[k].forEach(function (x) { if (x.puesto && !ids[x.puesto]) malos[x.puesto] = true; });
    Object.keys(malos).forEach(function (id) { faltan.push(TABLAS[k].hoja + ': el puesto «' + id + '» no está en Puestos'); });
  });
  out.faltan = faltan;
  return out;
}

function normalizar_(s) { return texto_(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function texto_(v) { return v == null ? '' : String(v).trim(); }

function hoja_(ss, nombre) {
  var n = normalizar_(nombre), hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) if (normalizar_(hojas[i].getName()) === n) return hojas[i];
  return null;
}

/** Una pestaña por títulos: {filas, hoja, filaTitulos, col (título → número de columna)}. */
function leerTabla_(ss, def, faltan) {
  var h = hoja_(ss, def.hoja);
  if (!h) { if (!def.opcional) faltan.push('falta la pestaña «' + def.hoja + '»'); return { filas: [], hoja: null }; }
  var vals = h.getDataRange().getValues(), fila = -1, col = {};
  // 29-oct: las columnas 'visible' se leen como se ven en el Sheet (la Hora).
  var vis = def.columnas.some(function (c) { return c[2] === 'visible'; }) ? h.getDataRange().getDisplayValues() : null;
  for (var r = 0; r < Math.min(FILAS_PARA_BUSCAR_TITULOS, vals.length) && fila < 0; r++) {
    var mapa = {};
    vals[r].forEach(function (v, c) { if (texto_(v)) mapa[normalizar_(v)] = c; });
    if (def.obligatorias.every(function (t) { return normalizar_(t) in mapa; })) { fila = r; col = mapa; }
  }
  if (fila < 0) { faltan.push(def.hoja + ': faltan los títulos ' + def.obligatorias.join(', ')); return { filas: [], hoja: h }; }
  var filas = [];
  for (var i = fila + 1; i < vals.length; i++) {
    var o = {}, vacia = true;
    def.columnas.forEach(function (c) {
      var x = normalizar_(c[0]) in col ? (c[2] === 'visible' ? vis[i][col[normalizar_(c[0])]] : vals[i][col[normalizar_(c[0])]]) : '';
      o[c[1]] = convertir_(x, c[2]);
      if (o[c[1]] !== '' && o[c[1]] !== null) vacia = false;
    });
    if (!vacia) filas.push(o);
  }
  var porTitulo = {};
  Object.keys(col).forEach(function (t) { porTitulo[t] = col[t] + 1; });
  return { filas: filas, hoja: h, filaTitulos: fila + 1, col: porTitulo, ultima: vals.length };
}

function dos_(n) { return (n < 10 ? '0' : '') + n; }
function zona_() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); }
function hoyISO_() { return Utilities.formatDate(new Date(), zona_(), 'yyyy-MM-dd'); }
function isoDe_(d) { return Utilities.formatDate(d, zona_(), 'yyyy-MM-dd'); }

function convertir_(x, tipo) {
  if (tipo === 'numero') { if (x === '' || x == null) return null; var n = Number(String(x).replace(',', '.')); return isNaN(n) ? null : n; }
  if (tipo === 'fecha' || tipo === 'fechaHora') {
    if (Object.prototype.toString.call(x) === '[object Date]') return tipo === 'fecha' ? isoDe_(x) : Utilities.formatDate(x, zona_(), "yyyy-MM-dd'T'HH:mm");
    var s = texto_(x), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + dos_(+m[2]) + '-' + dos_(+m[1]);
    return s;
  }
  if (tipo === 'periodoMeta') {
    // Una meta es de un mes («2026-10») o de un año («2026»). Si Sheets convirtió el mes en fecha, vale el mes.
    if (Object.prototype.toString.call(x) === '[object Date]') return isoDe_(x).slice(0, 7);
    var t = texto_(x);
    return /^\d{4}\.0+$/.test(t) ? t.slice(0, 4) : t;
  }
  if (tipo === 'periodo') {
    // Un período escrito sin formato de texto que Sheets convirtió en fecha: se lee como día.
    if (Object.prototype.toString.call(x) === '[object Date]') return isoDe_(x);
    return texto_(x);
  }
  return texto_(x);
}

/* ─── Períodos ─────────────────────────────────────────────────────────── */

/** [forma, grupo, orden] de un «Cada cuánto», o null si no encaja en ninguna regla. */
function reglaDe_(frecuencia) {
  var n = normalizar_(frecuencia);
  if (PERIODOS[n]) return PERIODOS[n];
  if (EVENTOS.indexOf(n) >= 0 || /^por \S/.test(n)) return POR_EVENTO;
  return null;
}

/** El período en curso de un punto según «Cada cuánto» (hoy en la zona del archivo). */
function periodoDe_(frecuencia, iso) {
  var r = reglaDe_(frecuencia);
  if (!r) throw new ErrorUsuario_('«Cada cuánto» = «' + texto_(frecuencia) + '» no es uno de: Diario, Semanal, Quincenal, Mensual, Trimestral, Cada 4 meses, Por temporada, Cuando aplica, Cada rotación, Cada cambio de tema o uno que empiece con «Por » (por evento).', 'frecuencia');
  var forma = r[0], anio = iso.slice(0, 4), mes = +iso.slice(5, 7);
  if (forma === 'dia') return iso;
  if (forma === 'semana') return semanaISO_(iso);
  if (forma === 'quincena') return iso.slice(0, 7) + (+iso.slice(8, 10) <= 15 ? '-Q1' : '-Q2');   // del 1 al 15, y del 16 a fin de mes
  if (forma === 'mes') return iso.slice(0, 7);
  if (forma === 'trimestre') return anio + '-T' + Math.ceil(mes / 3);
  if (forma === 'cuatrimestre') return anio + '-C' + Math.ceil(mes / 4);                       // ene–abr, may–ago, sep–dic
  return anio;
}

/** Semana ISO 8601: «2026-S44». */
function semanaISO_(iso) {
  var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  var dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  var inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear() + '-S' + dos_(Math.ceil(((d - inicio) / 86400000 + 1) / 7));
}

/** Un período de alguna de las formas de arriba, y nada más: año, mes, día, semana, quincena, trimestre o cuatrimestre. */
function periodoValido_(p) {
  return /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01])|-Q[12])?|-S(0[1-9]|[1-4]\d|5[0-3])|-T[1-4]|-C[1-3])?$/.test(texto_(p));
}

/* ─── Escribir ─────────────────────────────────────────────────────────── */

function puestoAbierto_(ss, id) {
  var f = [], t = leerTabla_(ss, TABLAS.puestos, f);
  var p = t.filas.filter(function (x) { return x.id === texto_(id); })[0];
  if (!p) throw new ErrorUsuario_('No existe el puesto «' + texto_(id) + '».', 'no_existe');
  if (normalizar_(p.estado) !== normalizar_(ABIERTO)) throw new ErrorUsuario_('El puesto «' + p.puesto + '» todavía no está abierto al equipo.', 'no_abierto');
  return p;
}

/** Agrega filas al final de una pestaña, cada valor en la columna de su título. Período y versión como texto. */
function agregar_(ss, def, objetos) {
  var f = [], t = leerTabla_(ss, def, f);
  if (!t.hoja || !t.col) throw new ErrorUsuario_('Falta la pestaña «' + def.hoja + '» o sus títulos.', 'sin_estructura');
  var ancho = Math.max.apply(null, Object.keys(t.col).map(function (k) { return t.col[k]; }));
  var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos) + 1;
  var matriz = objetos.map(function (o) {
    var fila = []; for (var c = 0; c < ancho; c++) fila.push('');
    Object.keys(o).forEach(function (titulo) { var c = t.col[normalizar_(titulo)]; if (c) fila[c - 1] = o[titulo]; });
    return fila;
  });
  ['Período', 'Versión', 'Orden del punto'].forEach(function (titulo) {
    var c = t.col[normalizar_(titulo)];
    if (c) t.hoja.getRange(desde, c, objetos.length, 1).setNumberFormat('@');
  });
  t.hoja.getRange(desde, 1, matriz.length, ancho).setValues(matriz);
}

function aceptar_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto);
  if (p.version === null) throw new ErrorUsuario_('El puesto «' + p.puesto + '» no tiene Versión.', 'sin_version');
  if (Number(d.version) !== p.version) throw new ErrorUsuario_('El contrato cambió (versión ' + p.version + '). Vuelve a leerlo antes de aceptar.', 'version_vieja');
  agregar_(ss, TABLAS.aceptaciones, [{ 'Fecha y hora': new Date(), 'Usuario': usuario, 'Puesto ID': p.id, 'Versión': String(p.version) }]);
  return { puesto: p.id, version: p.version };
}

function marcar_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto), f = [];
  var puntos = leerTabla_(ss, TABLAS.listas, f).filas.filter(function (x) { return x.puesto === p.id; });
  var marcas = Object.prototype.toString.call(d.marcas) === '[object Array]' ? d.marcas : [];
  if (!marcas.length) throw new ErrorUsuario_('No hay marcas para guardar.', 'vacia');
  var hoy = hoyISO_(), vistos = {}, ahora = new Date();
  var filas = marcas.map(function (m) {
    var orden = Number(m && m.orden), punto = puntos.filter(function (x) { return x.orden === orden; })[0];
    if (!punto) throw new ErrorUsuario_('El punto ' + texto_(m && m.orden) + ' no es de la lista de «' + p.puesto + '».', 'punto');
    if (vistos[orden]) throw new ErrorUsuario_('El punto ' + orden + ' viene dos veces.', 'punto');
    vistos[orden] = true;
    var r = RESULTADOS.filter(function (x) { return normalizar_(x) === normalizar_(m.resultado); })[0];
    if (!r) throw new ErrorUsuario_('Resultado inválido: «' + texto_(m.resultado) + '» (Cumplido o No).', 'resultado');
    return { 'Fecha y hora': ahora, 'Usuario': usuario, 'Puesto ID': p.id, 'Orden del punto': String(orden),
             'Período': periodoDe_(punto.frecuencia, hoy), 'Resultado': r, 'Nota': texto_(m.nota).slice(0, 500) };
  });
  agregar_(ss, TABLAS.marcas, filas);
  return { puesto: p.id, marcas: filas.map(function (x) { return { orden: Number(x['Orden del punto']), periodo: x['Período'] }; }) };
}

/** Los pasos de una hoja de un puesto (la hoja por su nombre, sin mayúsculas ni tildes). */
function pasosDe_(ss, puesto, hoja) {
  var f = [];
  return leerTabla_(ss, TABLAS.hojas, f).filas.filter(function (x) { return x.puesto === puesto && normalizar_(x.hoja) === normalizar_(hoja) && normalizar_(hoja) !== ''; });
}

function revisar_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto), notaHoja = '';
  // 29-oct: verificar una hoja diaria. El período es un día (hoy si no viene; nunca uno futuro).
  if (texto_(d.hoja)) {
    var pasos = pasosDe_(ss, p.id, d.hoja);
    if (!pasos.length) throw new ErrorUsuario_('El puesto «' + p.puesto + '» no tiene la hoja «' + texto_(d.hoja) + '».', 'hoja');
    if (!texto_(d.periodo)) d.periodo = hoyISO_();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.periodo)) || texto_(d.periodo) > hoyISO_()) throw new ErrorUsuario_('La hoja se verifica por día, y no uno que todavía no llegó: «' + texto_(d.periodo) + '».', 'periodo');
    notaHoja = 'Hoja «' + pasos[0].hoja + '»';
  }
  if (!periodoValido_(d.periodo)) throw new ErrorUsuario_('Período inválido: «' + texto_(d.periodo) + '».', 'periodo');
  var r = RESULTADOS.filter(function (x) { return normalizar_(x) === normalizar_(d.resultado); })[0];
  if (!r) throw new ErrorUsuario_('Resultado inválido: «' + texto_(d.resultado) + '» (Cumplido o No).', 'resultado');
  var s = SORPRESA.filter(function (x) { return normalizar_(x) === normalizar_(d.sorpresa); })[0];
  if (!s) throw new ErrorUsuario_('Sorpresa: Sí o No.', 'sorpresa');
  var nota = texto_(d.nota).slice(0, 500);
  if (notaHoja) nota = notaHoja + (nota ? ' · ' + nota : '');
  agregar_(ss, TABLAS.revisiones, [{ 'Fecha y hora': new Date(), 'Revisor': usuario, 'Puesto ID': p.id, 'Período': texto_(d.periodo),
    'Sorpresa': s, 'Resultado': r, 'Nota': nota }]);
  return { puesto: p.id, periodo: texto_(d.periodo) };
}

/* ─── Hojas diarias (29-oct) ───────────────────────────────────────────── */

/** La pestaña «Marcas de hojas»; si no existe, la crea con sus títulos. */
function hojaMarcasHojas_(ss) {
  var h = hoja_(ss, TABLAS.marcasHojas.hoja);
  if (h) return h;
  h = ss.insertSheet(TABLAS.marcasHojas.hoja);
  h.getRange(1, 1, 1, TITULOS_MARCAS_HOJAS.length).setValues([TITULOS_MARCAS_HOJAS]);
  h.setFrozenRows(1);
  return h;
}

/** Las marcas de HOY de una hoja: [{orden, fecha, usuario, iniciales, fila}] (fila = número de fila en la pestaña). */
function marcasDeHoy_(ss, puesto, hoja) {
  var t = leerTabla_(ss, TABLAS.marcasHojas, []), hoy = hoyISO_(), out = [];
  if (!t.hoja || !t.col) return out;
  var vals = t.hoja.getDataRange().getValues(), c = function (titulo) { return t.col[normalizar_(titulo)] - 1; };
  for (var i = t.filaTitulos; i < vals.length; i++) {
    var f = vals[i];
    if (texto_(f[c('Puesto ID')]) !== puesto || normalizar_(f[c('Hoja')]) !== normalizar_(hoja)) continue;
    var fecha = convertir_(f[c('Fecha y hora')], 'fechaHora');
    if (fecha.slice(0, 10) !== hoy) continue;
    out.push({ orden: convertir_(f[c('Orden')], 'numero'), fecha: fecha, usuario: texto_(f[c('Usuario')]),
               iniciales: t.col[normalizar_('Iniciales')] ? texto_(f[c('Iniciales')]) : '', fila: i + 1 });
  }
  return out;
}

/** Iniciales limpias: hasta 4 letras en mayúscula; sin nada, las dos primeras del usuario. */
function iniciales_(s, usuario) {
  var x = texto_(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-zÑñ]/g, '').toUpperCase().slice(0, 4);
  return x || texto_(usuario).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '?';
}

function marcarHoja_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto);
  var pasos = pasosDe_(ss, p.id, d.hoja);
  if (!pasos.length) throw new ErrorUsuario_('El puesto «' + p.puesto + '» no tiene la hoja «' + texto_(d.hoja) + '».', 'hoja');
  var orden = Number(d.orden), paso = pasos.filter(function (x) { return x.orden === orden; })[0];
  if (!paso) throw new ErrorUsuario_('El paso ' + texto_(d.orden) + ' no es de la hoja «' + pasos[0].hoja + '».', 'paso');
  if (d.marcado !== true && d.marcado !== false) throw new ErrorUsuario_('Falta decir si el paso se marca o se desmarca.', 'marcado');
  var h = hojaMarcasHojas_(ss), ya = marcasDeHoy_(ss, p.id, paso.hoja).filter(function (m) { return m.orden === orden; });
  if (d.marcado && !ya.length) {
    agregar_(ss, TABLAS.marcasHojas, [{ 'Fecha y hora': new Date(), 'Usuario': usuario, 'Puesto ID': p.id, 'Hoja': paso.hoja, 'Orden': orden, 'Iniciales': iniciales_(d.iniciales, usuario) }]);
  } else if (!d.marcado && ya.length) {
    // Solo hoy y solo lo propio: una marca de otra persona no se borra desde aquí.
    if (ya.some(function (m) { return normalizar_(m.usuario) !== normalizar_(usuario); })) throw new ErrorUsuario_('Ese paso lo marcó otra persona: solo ella puede desmarcarlo.', 'ajena');
    ya.map(function (m) { return m.fila; }).sort(function (a, b) { return b - a; }).forEach(function (fila) { h.deleteRow(fila); });
  }
  return { puesto: p.id, hoja: paso.hoja, hoy: hoyISO_(), marcas: marcasDeHoy_(ss, p.id, paso.hoja).map(function (m) { return { orden: m.orden, fecha: m.fecha, usuario: m.usuario, iniciales: m.iniciales }; }) };
}

/* ─── Estructura (26-oct; se corre a mano desde el editor) ─────────────── */

/**
 * Crea la pestaña «Metas» (Cifra, Unidad, Período, Valor, Estado) con sus
 * listas desplegables, y agrega AL FINAL de la fila de títulos los que falten
 * en Metas y en Puestos («Visible solo para»). 29-oct (v3): crea también
 * «Marcas de hojas» y agrega al final del Léeme el renglón que la explica.
 * No mueve, no renombra y no borra nada: se puede correr las veces que haga
 * falta.
 * Cómo: en el editor de Apps Script, arriba, elegir «actualizarEstructura» y
 * tocar «Ejecutar». Lo que hizo queda en el «Registro de ejecución».
 */
function actualizarEstructura() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), hechos = [];
  var titulos = TABLAS.metas.columnas.map(function (c) { return c[0]; });
  var h = hoja_(ss, TABLAS.metas.hoja);
  if (!h) {
    h = ss.insertSheet(TABLAS.metas.hoja);
    h.getRange(1, 1, 1, titulos.length).setValues([titulos]);
    h.setFrozenRows(1);
    hechos.push('Creé la pestaña «Metas» con sus títulos.');
  } else {
    hechos = hechos.concat(agregarTitulos_(h, titulos, titulos));
  }
  var t = leerTabla_(ss, TABLAS.metas, []);
  if (t.col) {
    var desde = t.filaTitulos + 1, filas = 1000;
    // Período como texto: si no, Sheets convierte «2026-10» en una fecha.
    t.hoja.getRange(desde, t.col[normalizar_('Período')], filas, 1).setNumberFormat('@');
    lista_(t.hoja, desde, t.col[normalizar_('Cifra')], filas, CIFRAS_META);
    lista_(t.hoja, desde, t.col[normalizar_('Unidad')], filas, UNIDADES_META);
    lista_(t.hoja, desde, t.col[normalizar_('Estado')], filas, ESTADOS_META);
    hechos.push('Metas: Período queda como texto y Cifra, Unidad y Estado con su lista.');
  }
  var p = hoja_(ss, TABLAS.puestos.hoja);
  if (p) hechos = hechos.concat(agregarTitulos_(p, TABLAS.puestos.obligatorias, ['Visible solo para']));
  // 29-oct (v3): «Marcas de hojas» y su renglón en el Léeme.
  if (!hoja_(ss, TABLAS.marcasHojas.hoja)) { hojaMarcasHojas_(ss); hechos.push('Creé la pestaña «Marcas de hojas» con sus títulos.'); }
  else hechos = hechos.concat(agregarTitulos_(hoja_(ss, TABLAS.marcasHojas.hoja), TABLAS.marcasHojas.obligatorias, TITULOS_MARCAS_HOJAS));
  var l = hoja_(ss, 'Léeme');
  if (l) {
    var lv = l.getDataRange().getValues();
    if (lv.some(function (f) { return normalizar_(f[0]) === normalizar_(LEEME_MARCAS_HOJAS[0]); })) hechos.push('Léeme: ya decía qué es «Marcas de hojas».');
    else { l.getRange(l.getLastRow() + 1, 1, 1, 2).setValues([LEEME_MARCAS_HOJAS]); hechos.push('Léeme: agregué al final qué es «Marcas de hojas».'); }
  } else hechos.push('No encontré la pestaña «Léeme»; no la toqué.');
  Logger.log(hechos.join('\n'));
  return hechos;
}

/** Agrega al final de la fila de títulos los que falten. La fila es la primera (de las 10 primeras) con algún título de `buscar`. */
function agregarTitulos_(h, buscar, agregar) {
  var vals = h.getDataRange().getValues(), nombre = h.getName(), fila = -1, ancho = 0;
  for (var r = 0; r < Math.min(FILAS_PARA_BUSCAR_TITULOS, vals.length) && fila < 0; r++) {
    var hay = vals[r].map(normalizar_);
    if (buscar.some(function (t) { return hay.indexOf(normalizar_(t)) >= 0; })) fila = r;
  }
  if (fila < 0) {
    if (vals.length && vals.some(function (f) { return f.some(function (v) { return texto_(v) !== ''; }); }))
      return ['' + nombre + ': no encontré la fila de títulos; no toqué nada.'];
    fila = 0;
  }
  var tiene = (vals[fila] || []).map(normalizar_);
  (vals[fila] || []).forEach(function (v, c) { if (texto_(v) !== '') ancho = c + 1; });
  var faltan = agregar.filter(function (t) { return tiene.indexOf(normalizar_(t)) < 0; });
  if (!faltan.length) return [nombre + ': ya tenía todos sus títulos.'];
  h.getRange(fila + 1, ancho + 1, 1, faltan.length).setValues([faltan]);
  return [nombre + ': agregué al final ' + faltan.map(function (t) { return '«' + t + '»'; }).join(', ') + '.'];
}

function lista_(h, fila, col, filas, valores) {
  var regla = SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(false).build();
  h.getRange(fila, col, filas, 1).setDataValidation(regla);
}
