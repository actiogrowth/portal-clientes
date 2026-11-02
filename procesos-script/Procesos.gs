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
 *    Revisiones (en v3 y v4, Marcas de hojas también borraba al desmarcar;
 *    desde v5 no borra nada, ver abajo).
 *
 *  · 30-oct (v4): «Cada cuánto» acepta Quincenal (AAAA-MM-Q1/Q2), Trimestral
 *    (AAAA-T1…T4), Cada 4 meses (AAAA-C1…C3) y los de «por evento» (lo que
 *    empieza con «Por », Cada rotación, Cada cambio de tema): período = el
 *    día. «leer» agrega a cada punto su grupo y el orden del grupo.
 *
 *  · 2-nov (v5): Equipo v3.
 *    · Marcas: el resultado es «Ejecutado» o «No ejecutado» (lo que llegue
 *      como «Cumplido» o «No», de un portal viejo, se escribe con el nombre
 *      nuevo). «No ejecutado» pide nota (el motivo); los puntos «por evento»
 *      también (a qué evento corresponde). Un punto que no es por evento se
 *      marca una vez por período: para cambiarlo se quita la marca primero.
 *    · desmarcar { puesto, orden, fecha }: quita una marca SIN borrar nada:
 *      agrega una fila con Resultado «Desmarcada» y en la Nota la fecha y hora
 *      de la marca que quita. Solo la propia y solo mientras siga abierto su
 *      período (el día, la semana, el mes… del punto; por evento, el mismo día).
 *    · marcarHoja: desmarcar ya no borra la fila (D-086 cambia): agrega
 *      «Desmarcada», con las mismas reglas. Los pasos con Momento «Cada
 *      semana» o «Cada mes» se marcan una vez en su semana o su mes.
 *    · «leer» trae el calendario de los últimos DIAS_CALENDARIO días (el
 *      período de cada forma para cada día: así la pantalla consulta el
 *      historial sin repetir la regla), la forma de cada punto y de cada paso,
 *      y la fecha y hora con segundos (identifica la marca que se quita).
 *    · Hojas tiene la columna opcional «Asignación» («Temporal»).
 *
 *  Instalación: Extensiones › Apps Script en el MISMO Sheet, pegar este
 *  archivo, poner la propiedad PR_CLAVE_API e Implementar como aplicación
 *  web (pasos en docs/ARQUITECTURA.md › Equipo). Al cambiar de versión:
 *  Implementar › Gestionar implementaciones › editar › Versión nueva (la
 *  dirección /exec no cambia), y correr actualizarEstructura una vez.
 * ═════════════════════════════════════════════════════════════════════════════ */

var VERSION_SCRIPT = 'v5';   // 2-nov: Equipo v3 — Ejecutado / No ejecutado, desmarcar sin borrar (v4, 30-oct: frecuencias nuevas)
var PROP_CLAVE = 'PR_CLAVE_API';
var FILAS_PARA_BUSCAR_TITULOS = 10;
var DIAS_CALENDARIO = 120;   // el historial que se puede consultar (equipo/api.php manda las marcas de los mismos 120 días)

/* Vocabulario del Sheet (lo que dice su pestaña Léeme). */
var ABIERTO = 'Abierto al equipo';
var RESULTADOS = ['Ejecutado', 'No ejecutado'];                       // marcas de la lista (2-nov)
var SINONIMOS = { 'cumplido': 'Ejecutado', 'no': 'No ejecutado' };    // lo que mandaba el portal hasta v4
var DESMARCADA = 'Desmarcada';
var RESULTADOS_REVISION = ['Cumplido', 'No'];                         // la revisión de quien verifica, como siempre
var SORPRESA = ['Sí', 'No'];
/* 2-nov: el Momento de un paso de hoja que no es de cada día → la forma de su período. */
var MOMENTO_PERIODO = { 'cada semana': 'semana', 'cada mes': 'mes' };
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
    ['Puesto ID', 'puesto'], ['Hoja', 'hoja'], ['Orden', 'orden', 'numero'], ['Momento', 'momento'], ['Paso', 'paso'],
    // 2-nov (v5): opcional; «Temporal» = la hoja la tiene el puesto por un tiempo (el portal lo dice junto a su nombre).
    ['Asignación', 'asignacion']] },
  reglas: { hoja: 'Reglas del juego', obligatorias: ['Sección', 'Texto'], columnas: [
    ['Sección', 'seccion'], ['Orden', 'orden', 'numero'], ['Texto', 'texto']] },
  horarios: { hoja: 'Horarios del servicio', obligatorias: ['Momento', 'Hora'], columnas: [
    ['Momento', 'momento'], ['Unidad', 'unidad'], ['Hora', 'hora', 'visible'], ['Puestos que lo usan', 'puestos']] },
  // Opcional: la crea marcarHoja (o actualizarEstructura) la primera vez; mientras no exista, no se avisa.
  marcasHojas: { hoja: 'Marcas de hojas', opcional: true, obligatorias: ['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden'], columnas: [
    ['Fecha y hora', 'fecha', 'fechaHora'], ['Usuario', 'usuario'], ['Puesto ID', 'puesto'], ['Hoja', 'hoja'], ['Orden', 'orden', 'numero'], ['Iniciales', 'iniciales'],
    // 2-nov (v5): «Ejecutado» o «Desmarcada» (vacío = Ejecutado: las filas de antes) y, al desmarcar, la fecha y hora de la marca que se quita.
    ['Resultado', 'resultado'], ['Nota', 'nota']] }
};
var TITULOS_MARCAS_HOJAS = ['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden', 'Iniciales', 'Resultado', 'Nota'];
/* Renglones del Léeme que escribe este script: si falta, se agrega al final; si ya está, se pone el texto de esta versión. */
var LEEME = [
  ['Marcas de hojas', 'La escribe el portal: cada paso marcado de una hoja, con la fecha y hora y las iniciales de quien lo marcó. Quitar una marca no borra nada: agrega una fila con Resultado «Desmarcada» y en la Nota la fecha y hora de la marca que quita. No editar a mano.'],
  ['Marcas: Ejecutado, No ejecutado y Desmarcada', 'Cada punto de la lista se marca «Ejecutado» o «No ejecutado» (con el motivo en la Nota). Quitar una marca agrega una fila «Desmarcada» con la fecha y hora de la marca que quita; nada se borra. Las marcas viejas «Cumplido» y «No» se leen como «Ejecutado» y «No ejecutado».'],
  ['Asignación (pestaña Hojas)', 'Opcional. «Temporal» = el puesto tiene esa hoja por un tiempo; el portal muestra «Asignación temporal» junto al nombre de la hoja.']];
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
                 marcarHoja: { escribe: true, fn: marcarHoja_ }, desmarcar: { escribe: true, fn: desmarcar_ } };

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
  // 2-nov (v5): la forma del período (dia, semana…) y si es «por evento» (la nota es obligatoria).
  out.listas.forEach(function (x) {
    var r = reglaDe_(x.frecuencia);
    x.grupo = r ? r[1] : texto_(x.frecuencia); x.grupoOrden = r ? r[2] : 99;
    x.forma = r ? r[0] : ''; x.evento = r === POR_EVENTO;
    try { x.periodo = periodoDe_(x.frecuencia, out.hoy); }
    catch (e) { x.periodo = ''; faltan.push('Listas: «Cada cuánto» = «' + x.frecuencia + '» (' + x.puesto + ' · ' + x.orden + ') no es uno de los conocidos'); }
  });
  out.hojas.forEach(function (x) { x.forma = formaPaso_(x.momento); });
  out.calendario = calendario_(out.hoy);
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
function fechaHoraDe_(d) { return Utilities.formatDate(d, zona_(), "yyyy-MM-dd'T'HH:mm:ss"); }

function convertir_(x, tipo) {
  if (tipo === 'numero') { if (x === '' || x == null) return null; var n = Number(String(x).replace(',', '.')); return isNaN(n) ? null : n; }
  if (tipo === 'fecha' || tipo === 'fechaHora') {
    // 2-nov (v5): con segundos — la Nota de una fila «Desmarcada» nombra así la marca que quita.
    if (Object.prototype.toString.call(x) === '[object Date]') return tipo === 'fecha' ? isoDe_(x) : fechaHoraDe_(x);
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
  return periodoForma_(r[0], iso);
}

/** 2-nov: la forma del período de un paso de hoja: «Cada semana» → semana, «Cada mes» → mes, lo demás → el día. */
function formaPaso_(momento) { return MOMENTO_PERIODO[normalizar_(momento)] || 'dia'; }

/** 2-nov: el día AAAA-MM-DD que está n días antes de iso. */
function diasAntes_(iso, n) {
  var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) - n));
  return d.getUTCFullYear() + '-' + dos_(d.getUTCMonth() + 1) + '-' + dos_(d.getUTCDate());
}

/** 2-nov: {AAAA-MM-DD: {dia, semana, quincena, mes, trimestre, cuatrimestre, anio}} de hoy y los DIAS_CALENDARIO días anteriores. */
function calendario_(hoy) {
  var out = {}, formas = ['dia', 'semana', 'quincena', 'mes', 'trimestre', 'cuatrimestre', 'anio'];
  for (var i = DIAS_CALENDARIO; i >= 0; i--) {
    var dia = diasAntes_(hoy, i), c = {};
    formas.forEach(function (f) { c[f] = periodoForma_(f, dia); });
    out[dia] = c;
  }
  return out;
}

/** El período de una forma (dia, semana, quincena, mes, trimestre, cuatrimestre, anio) que contiene el día iso. */
function periodoForma_(forma, iso) {
  var anio = iso.slice(0, 4), mes = +iso.slice(5, 7);
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

/**
 * Agrega filas al final de una pestaña, cada valor en la columna de su título. Período, versión y nota como texto.
 * 2-nov: si una fila trae un título que la pestaña no tiene, NO escribe nada (una «Desmarcada» sin su columna
 * Resultado se leería como una marca nueva).
 */
function agregar_(ss, def, objetos) {
  var f = [], t = leerTabla_(ss, def, f);
  if (!t.hoja || !t.col) throw new ErrorUsuario_('Falta la pestaña «' + def.hoja + '» o sus títulos.', 'sin_estructura');
  objetos.forEach(function (o) { Object.keys(o).forEach(function (titulo) {
    if (!t.col[normalizar_(titulo)]) throw new ErrorUsuario_('A la pestaña «' + def.hoja + '» le falta la columna «' + titulo + '». Corre actualizarEstructura en el editor del script.', 'sin_estructura');
  }); });
  var ancho = Math.max.apply(null, Object.keys(t.col).map(function (k) { return t.col[k]; }));
  var desde = Math.max(t.hoja.getLastRow(), t.filaTitulos) + 1;
  var matriz = objetos.map(function (o) {
    var fila = []; for (var c = 0; c < ancho; c++) fila.push('');
    Object.keys(o).forEach(function (titulo) { var c = t.col[normalizar_(titulo)]; if (c) fila[c - 1] = o[titulo]; });
    return fila;
  });
  ['Período', 'Versión', 'Orden del punto', 'Nota'].forEach(function (titulo) {
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

/**
 * 2-nov: las marcas que siguen en pie. Una fila «Desmarcada» quita la marca de su mismo usuario y punto
 * cuya fecha y hora es su Nota. clave(x) dice qué es «el mismo punto» (en Marcas, el orden; en las hojas,
 * la hoja y el orden). Las filas sin Resultado (Marcas de hojas de antes de v5) son marcas.
 */
function vigentes_(filas, clave) {
  var quitadas = {};
  filas.forEach(function (x) { if (normalizar_(x.resultado) === normalizar_(DESMARCADA)) quitadas[normalizar_(x.usuario) + '|' + clave(x) + '|' + texto_(x.nota)] = true; });
  return filas.filter(function (x) { return normalizar_(x.resultado) !== normalizar_(DESMARCADA) && !quitadas[normalizar_(x.usuario) + '|' + clave(x) + '|' + x.fecha]; });
}

/** «Ejecutado» o «No ejecutado» (también lo que mandaba un portal viejo: «Cumplido» y «No»). */
function resultado_(v) {
  var n = normalizar_(v), r = RESULTADOS.filter(function (x) { return normalizar_(x) === n; })[0] || SINONIMOS[n];
  if (!r) throw new ErrorUsuario_('Resultado inválido: «' + texto_(v) + '» (Ejecutado o No ejecutado).', 'resultado');
  return r;
}

function fila_(m) { return { fecha: m['Fecha y hora'] instanceof Date ? fechaHoraDe_(m['Fecha y hora']) : texto_(m['Fecha y hora']), usuario: m['Usuario'], orden: Number(m['Orden del punto']),
                             periodo: m['Período'], resultado: m['Resultado'], nota: m['Nota'] }; }

function marcar_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto), f = [];
  var puntos = leerTabla_(ss, TABLAS.listas, f).filas.filter(function (x) { return x.puesto === p.id; });
  var marcas = Object.prototype.toString.call(d.marcas) === '[object Array]' ? d.marcas : [];
  if (!marcas.length) throw new ErrorUsuario_('No hay marcas para guardar.', 'vacia');
  var hoy = hoyISO_(), vistos = {}, ahora = new Date();
  // 2-nov: lo ya marcado en pie, para no marcar dos veces el mismo período.
  var enPie = vigentes_(leerTabla_(ss, TABLAS.marcas, f).filas.filter(function (x) { return x.puesto === p.id; }), function (x) { return x.orden; });
  var filas = marcas.map(function (m) {
    var orden = Number(m && m.orden), punto = puntos.filter(function (x) { return x.orden === orden; })[0];
    if (!punto) throw new ErrorUsuario_('El punto ' + texto_(m && m.orden) + ' no es de la lista de «' + p.puesto + '».', 'punto');
    var evento = reglaDe_(punto.frecuencia) === POR_EVENTO, periodo = periodoDe_(punto.frecuencia, hoy);
    // Por evento se marca cada vez que ocurre (varias en un envío, cada una con su nota); lo demás, una vez.
    if (vistos[orden] && !evento) throw new ErrorUsuario_('El punto ' + orden + ' viene dos veces.', 'punto');
    vistos[orden] = true;
    var r = resultado_(m.resultado), nota = texto_(m.nota).slice(0, 500);
    if (r === 'No ejecutado' && !nota) throw new ErrorUsuario_('«No ejecutado» lleva el motivo en la nota (punto ' + orden + ').', 'nota');
    if (evento && !nota) throw new ErrorUsuario_('El punto ' + orden + ' se marca cada vez que ocurre: la nota dice a qué corresponde.', 'nota');
    if (!evento && enPie.some(function (x) { return x.orden === orden && x.periodo === periodo; }))
      throw new ErrorUsuario_('El punto ' + orden + ' ya está marcado en este período. Para cambiarlo, primero quita la marca.', 'ya_marcado');
    return { 'Fecha y hora': ahora, 'Usuario': usuario, 'Puesto ID': p.id, 'Orden del punto': String(orden), 'Período': periodo, 'Resultado': r, 'Nota': nota };
  });
  agregar_(ss, TABLAS.marcas, filas);
  return { puesto: p.id, marcas: filas.map(fila_) };
}

/** 2-nov: quitar una marca propia de un período abierto: agrega «Desmarcada» (nunca borra ni edita). */
function desmarcar_(d, usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), p = puestoAbierto_(ss, d.puesto), f = [];
  var orden = Number(d.orden), fecha = texto_(d.fecha);
  var punto = leerTabla_(ss, TABLAS.listas, f).filas.filter(function (x) { return x.puesto === p.id && x.orden === orden; })[0];
  if (!punto) throw new ErrorUsuario_('El punto ' + texto_(d.orden) + ' no es de la lista de «' + p.puesto + '».', 'punto');
  var m = vigentes_(leerTabla_(ss, TABLAS.marcas, f).filas.filter(function (x) { return x.puesto === p.id; }), function (x) { return x.orden; })
    .filter(function (x) { return x.orden === orden && x.fecha === fecha; })[0];
  if (!m) throw new ErrorUsuario_('Esa marca ya no está: se quitó antes o no existe.', 'sin_marca');
  if (normalizar_(m.usuario) !== normalizar_(usuario)) throw new ErrorUsuario_('Esa marca la puso otra persona: solo ella puede quitarla.', 'ajena');
  if (m.periodo !== periodoDe_(punto.frecuencia, hoyISO_())) throw new ErrorUsuario_('El período de esa marca ya cerró: no se puede quitar.', 'cerrado');
  var fila = { 'Fecha y hora': new Date(), 'Usuario': usuario, 'Puesto ID': p.id, 'Orden del punto': String(orden), 'Período': m.periodo, 'Resultado': DESMARCADA, 'Nota': m.fecha };
  agregar_(ss, TABLAS.marcas, [fila]);
  return { puesto: p.id, marca: fila_(fila) };
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
  var r = RESULTADOS_REVISION.filter(function (x) { return normalizar_(x) === normalizar_(d.resultado); })[0];
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

/**
 * La pestaña «Marcas de hojas»; si no existe, la crea con sus títulos. 2-nov (v5): si existe sin «Resultado»
 * o «Nota», se los agrega al final (sin ellos, quitar una marca no tendría dónde decir «Desmarcada»).
 */
function hojaMarcasHojas_(ss) {
  var h = hoja_(ss, TABLAS.marcasHojas.hoja);
  if (h) { agregarTitulos_(h, TABLAS.marcasHojas.obligatorias, TITULOS_MARCAS_HOJAS); return h; }
  h = ss.insertSheet(TABLAS.marcasHojas.hoja);
  h.getRange(1, 1, 1, TITULOS_MARCAS_HOJAS.length).setValues([TITULOS_MARCAS_HOJAS]);
  h.setFrozenRows(1);
  return h;
}

/** 2-nov: las marcas en pie de una hoja (todas las fechas): [{fecha, usuario, orden, iniciales, …}]. */
function marcasHojaEnPie_(ss, puesto, hoja) {
  var filas = leerTabla_(ss, TABLAS.marcasHojas, []).filas.filter(function (x) { return x.puesto === puesto && normalizar_(x.hoja) === normalizar_(hoja); });
  return vigentes_(filas, function (x) { return x.orden; });
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
  // 2-nov (v5): el período del paso (el día; «Cada semana», su semana; «Cada mes», su mes) y sus marcas en pie en ese período.
  hojaMarcasHojas_(ss);
  var forma = formaPaso_(paso.momento), hoy = hoyISO_(), actual = periodoForma_(forma, hoy);
  var ya = marcasHojaEnPie_(ss, p.id, paso.hoja).filter(function (m) { return m.orden === orden && periodoForma_(forma, m.fecha.slice(0, 10)) === actual; });
  var filas = [], ahora = new Date();
  if (d.marcado && !ya.length) {
    filas.push({ 'Fecha y hora': ahora, 'Usuario': usuario, 'Puesto ID': p.id, 'Hoja': paso.hoja, 'Orden': orden, 'Iniciales': iniciales_(d.iniciales, usuario), 'Resultado': 'Ejecutado' });
  } else if (!d.marcado && ya.length) {
    // Solo lo propio y solo en su período: nada se borra, se agrega «Desmarcada» con la fecha y hora de la marca que quita.
    if (ya.some(function (m) { return normalizar_(m.usuario) !== normalizar_(usuario); })) throw new ErrorUsuario_('Ese paso lo marcó otra persona: solo ella puede desmarcarlo.', 'ajena');
    ya.forEach(function (m) { filas.push({ 'Fecha y hora': ahora, 'Usuario': usuario, 'Puesto ID': p.id, 'Hoja': paso.hoja, 'Orden': orden, 'Iniciales': m.iniciales, 'Resultado': DESMARCADA, 'Nota': m.fecha }); });
  }
  if (filas.length) agregar_(ss, TABLAS.marcasHojas, filas);
  return { puesto: p.id, hoja: paso.hoja, hoy: hoy, filas: filas.map(function (x) { return { fecha: fechaHoraDe_(ahora), usuario: usuario, orden: orden, iniciales: x['Iniciales'], resultado: x['Resultado'], nota: x['Nota'] || '' }; }) };
}

/* ─── Estructura (26-oct; se corre a mano desde el editor) ─────────────── */

/**
 * Crea la pestaña «Metas» (Cifra, Unidad, Período, Valor, Estado) con sus
 * listas desplegables, y agrega AL FINAL de la fila de títulos los que falten
 * en Metas y en Puestos («Visible solo para»). 29-oct (v3): crea también
 * «Marcas de hojas» y agrega al final del Léeme el renglón que la explica.
 * 2-nov (v5): agrega «Resultado» y «Nota» al final de «Marcas de hojas»,
 * «Asignación» al final de Hojas, y los renglones del Léeme de esta versión.
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
  // 29-oct (v3): «Marcas de hojas»; 2-nov (v5): con «Resultado» y «Nota» al final.
  if (!hoja_(ss, TABLAS.marcasHojas.hoja)) { hojaMarcasHojas_(ss); hechos.push('Creé la pestaña «Marcas de hojas» con sus títulos.'); }
  else hechos = hechos.concat(agregarTitulos_(hoja_(ss, TABLAS.marcasHojas.hoja), TABLAS.marcasHojas.obligatorias, TITULOS_MARCAS_HOJAS));
  // 2-nov (v5): Hojas con «Asignación» al final.
  var hh = hoja_(ss, TABLAS.hojas.hoja);
  if (hh) hechos = hechos.concat(agregarTitulos_(hh, TABLAS.hojas.obligatorias, ['Asignación']));
  else hechos.push('No encontré la pestaña «Hojas»; no la toqué.');
  // Los renglones del Léeme que escribe este script: el que falta se agrega al final; el que cambió, se pone al día (solo su Detalle).
  var l = hoja_(ss, 'Léeme');
  if (l) {
    LEEME.forEach(function (r) {
      var lv = l.getDataRange().getValues(), i = -1;
      lv.forEach(function (f, k) { if (i < 0 && normalizar_(f[0]) === normalizar_(r[0])) i = k; });
      if (i < 0) { l.getRange(l.getLastRow() + 1, 1, 1, 2).setValues([r]); hechos.push('Léeme: agregué al final «' + r[0] + '».'); }
      else if (texto_(lv[i][1]) !== r[1]) { l.getRange(i + 1, 2).setValue(r[1]); hechos.push('Léeme: puse al día el detalle de «' + r[0] + '».'); }
      else hechos.push('Léeme: «' + r[0] + '» ya estaba al día.');
    });
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
