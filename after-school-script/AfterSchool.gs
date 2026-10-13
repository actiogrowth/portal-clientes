/**
 * VEA_AfterSchool_BD — Apps Script del archivo
 *
 * Herramienta provisional de After School de Vida en Arte (reemplaza a
 * Poliwin desde octubre de 2026). Tres cosas en un solo archivo:
 *
 *   1) INSTALACIÓN       instalar()       crea las pestañas que falten
 *                        comprobar()      dice qué falta, sin escribir
 *   2) CARGA INICIAL     ensayarCarga()   informa lo que cargaría, SIN escribir
 *                        cargaInicial()   escribe; se niega si ya hay datos
 *   3) PUENTE (doPost)   lo llama el api.php del portal, nunca el navegador
 *
 * SEGURIDAD. Toda llamada al puente trae dos cosas que pone el servidor del
 * portal y no el navegador:
 *   · key      la clave compartida. Vive en las Propiedades del script
 *              (AS_CLAVE_API) y en portal_config.php, fuera de la carpeta
 *              pública. Nunca en este archivo ni en el HTML.
 *   · usuario  el usuario con sesión abierta en el portal. api.php lo saca
 *              de la sesión y descarta el que mande el navegador.
 * Sin clave correcta o sin usuario, el puente no lee ni escribe nada.
 *
 * CONVENCIONES DE LA HOJA (las mismas de VEA_BaseDatos_Clientes):
 * encabezados en la fila 5, datos desde la 6, columna A vacía. Las columnas
 * se buscan por su título, nunca por su letra, y se lee siempre hasta la
 * última fila con datos.
 *
 * FECHAS. Ida y vuelta con la MISMA zona (la del archivo): parseDate y
 * formatDate son inversas exactas solo así. Es el defecto que corrió las
 * fechas de Kínder en 2026 (ver bdclientesvea/CONTEXTO.md §4).
 *
 * NINGUNA REGLA DE NEGOCIO EN EL CÓDIGO. Cupos en «Clases»; motivos, planes,
 * conceptos, formas de pago y el umbral del amarillo en «Config». Lo único con
 * valores de negocio es INS_CONFIG, que solo se escribe si Config está vacía.
 */


// ═════════════════════════════════════════════════════════════════════════════
//  ESQUEMA
//  Los nombres de las pestañas y de las columnas son vocabulario de la base:
//  si se renombra una pestaña, se cambia aquí.
// ═════════════════════════════════════════════════════════════════════════════

var FILA_TITULOS = 5;
var FILA_DATOS   = 6;
var COL_INICIO   = 2;   // B: la A va vacía

var HOJAS = {
  ninos:         'Niños',
  clases:        'Clases',
  inscripciones: 'Inscripciones',
  pagos:         'Pagos',
  bajas:         'Bajas',
  config:        'Config',
  historial:     'Historial'
};

var COLUMNAS = {
  ninos: ['ID', 'Número socio Poliwin', 'Nombre', 'Apellidos', 'Fecha nacimiento',
          'Sexo', 'Nombre responsable', 'Teléfono', 'Teléfono 2', 'Correo',
          'Cabeza de familia', 'Estado', 'Fecha ingreso', 'Notas'],
  clases: ['Código clase', 'Servicio', 'Modalidad', 'Día', 'Hora inicio', 'Cupo',
           'Edades', 'Activa'],
  inscripciones: ['ID inscripción', 'ID niño', 'Código clase', 'Fecha alta',
                  'Fecha baja', 'Motivo baja', 'Detalle motivo', 'Registrado por',
                  'Fecha registro'],
  pagos: ['ID pago', 'ID niño', 'Mes que cubre', 'Concepto', 'Plan', 'Monto',
          'Fecha pago', 'Forma de pago', 'Registrado por', 'Notas'],
  bajas: ['ID niño', 'Fecha baja', 'Motivo', 'Detalle', 'Registrado por'],
  config: ['Lista', 'Valor', 'Número', 'Nota'],
  historial: ['Fecha', 'Usuario', 'Acción', 'ID', 'Detalle']
};

/* Columnas que se guardan como texto (formato @). Sin esto, Sheets convierte
   «2026-10» o «16:30» en fechas y un teléfono con + en una fórmula. */
var COLUMNAS_TEXTO = {
  ninos: ['ID', 'Número socio Poliwin', 'Teléfono', 'Teléfono 2', 'Cabeza de familia'],
  clases: ['Código clase', 'Hora inicio'],
  inscripciones: ['ID inscripción', 'ID niño', 'Código clase'],
  pagos: ['ID pago', 'ID niño', 'Mes que cubre'],
  bajas: ['ID niño'],
  historial: ['ID']
};
var COLUMNAS_FECHA = {
  ninos: ['Fecha nacimiento', 'Fecha ingreso'],
  inscripciones: ['Fecha alta', 'Fecha baja'],
  pagos: ['Fecha pago'],
  bajas: ['Fecha baja']
};
var COLUMNAS_FECHA_HORA = {
  inscripciones: ['Fecha registro'],
  historial: ['Fecha']
};

/* Prefijos de los ID que genera el script. */
var PREFIJO = { nino: 'AS-', inscripcion: 'INS-', pago: 'PAG-' };

/* Vocabulario fijo del sistema (no son reglas de negocio: son los estados
   que el propio sistema sabe tratar). */
var ESTADO = { activo: 'Activo', retirado: 'Retirado', revisar: 'Por revisar' };
var SI = 'Sí', NO = 'No';
var MOTIVO_CAMBIO_CLASE = 'Cambio de clase';   // mover no es una deserción
var DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/* Las listas de Config. El valor de la columna «Lista» es la etiqueta. */
var LISTA = {
  motivo:   'Motivo baja',
  plan:     'Plan',
  concepto: 'Concepto',
  forma:    'Forma de pago',
  param:    'Parámetro'
};
var PARAM_UMBRAL = 'Umbral amarillo';   // fracción: 0,8 = 80 %
var PARAM_CONCEPTO_MENSUAL = 'Concepto de mensualidad';  // cuál concepto cuenta como «pagó el mes»

/* Valores iniciales de Config. ÚNICO sitio del código con valores de negocio:
   instalar() los escribe solo si Config no tiene ninguna fila. Después mandan
   los de la hoja. */
var INS_CONFIG = [
  [LISTA.motivo, 'Horario', '', ''],
  [LISTA.motivo, 'Precio', '', ''],
  [LISTA.motivo, 'Se mudó', '', ''],
  [LISTA.motivo, 'Perdió interés', '', ''],
  [LISTA.motivo, 'Salud o lesión', '', ''],
  [LISTA.motivo, 'Cambió de actividad', '', ''],
  [LISTA.motivo, 'Temporada o vacaciones', '', ''],
  [LISTA.motivo, 'Otro', '', ''],
  [LISTA.plan, '4 clases', 85.60, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.plan, '8 clases', 128.40, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.plan, '12 clases', 165.85, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.concepto, 'Mensualidad', '', ''],
  [LISTA.concepto, 'Matrícula', '', ''],
  [LISTA.concepto, 'Otro', '', ''],
  [LISTA.forma, 'Efectivo', '', ''],
  [LISTA.forma, 'Tarjeta', '', ''],
  [LISTA.forma, 'Transferencia', '', ''],
  [LISTA.forma, 'Yappy', '', ''],
  [LISTA.forma, 'Otro', '', ''],
  [LISTA.param, PARAM_UMBRAL, 0.8, 'Desde esta ocupación la celda se pinta amarilla'],
  [LISTA.param, PARAM_CONCEPTO_MENSUAL, '', 'Mensualidad']
];

/* Propiedades del script. */
var PROP_CLAVE = 'AS_CLAVE_API';
var PROP_ID_CARGA = 'AS_ID_CARGA';

var USUARIO_CARGA = 'Carga inicial Poliwin';


// ═════════════════════════════════════════════════════════════════════════════
//  MENÚ
// ═════════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('After School')
    .addItem('Comprobar estructura', 'menuComprobar')
    .addItem('Instalar pestañas que falten', 'menuInstalar')
    .addSeparator()
    .addItem('Ensayar carga inicial (no escribe)', 'menuEnsayar')
    .addItem('Ejecutar carga inicial', 'menuCargar')
    .addToUi();
}
function menuComprobar() { mostrar_('Comprobar estructura', comprobar()); }
function menuInstalar()  { mostrar_('Instalar', instalar()); }
function menuEnsayar()   { mostrar_('Ensayo de carga', ensayarCarga()); }
function menuCargar() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Carga inicial',
    'Va a escribir Niños, Clases e Inscripciones desde la copia del Excel. ' +
    'Se niega si alguna de las tres ya tiene datos. ¿Seguir?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  mostrar_('Carga inicial', cargaInicial());
}
function mostrar_(titulo, texto) {
  Logger.log(texto);
  try {
    var html = HtmlService.createHtmlOutput('<pre style="font:12px monospace;white-space:pre-wrap">' +
      String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>').setWidth(720).setHeight(560);
    SpreadsheetApp.getUi().showModalDialog(html, titulo);
  } catch (e) { /* desde el editor no hay interfaz: queda en el registro */ }
}


// ═════════════════════════════════════════════════════════════════════════════
//  AYUDAS DE HOJA
// ═════════════════════════════════════════════════════════════════════════════

function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function zona_() { return libro_().getSpreadsheetTimeZone(); }

function hoja_(clave) {
  var h = libro_().getSheetByName(HOJAS[clave]);
  if (!h) throw new ErrorUsuario_('Falta la pestaña «' + HOJAS[clave] + '». Corre After School → Instalar.');
  return h;
}

/** Mapa título → número de columna (1-based), leído de la fila 5. */
function titulos_(hoja, clave) {
  var ultima = Math.max(hoja.getLastColumn(), COL_INICIO);
  var fila = hoja.getRange(FILA_TITULOS, 1, 1, ultima).getValues()[0];
  var mapa = {};
  for (var c = 0; c < fila.length; c++) {
    var t = String(fila[c] || '').trim();
    if (t && !(t in mapa)) mapa[t] = c + 1;
  }
  var faltan = COLUMNAS[clave].filter(function (t) { return !(t in mapa); });
  if (faltan.length) throw new ErrorUsuario_('A la pestaña «' + HOJAS[clave] +
    '» le faltan los títulos: ' + faltan.join(', ') + ' (fila ' + FILA_TITULOS + ').');
  return mapa;
}

/**
 * Lee una tabla entera hasta la última fila con datos. Devuelve objetos con
 * los títulos como claves y _fila con la fila real. Salta las filas cuya
 * primera columna del esquema está vacía.
 */
function leerTabla_(clave) {
  var hoja = hoja_(clave);
  var mapa = titulos_(hoja, clave);
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_DATOS) return { hoja: hoja, mapa: mapa, filas: [] };
  var ancho = hoja.getLastColumn();
  var datos = hoja.getRange(FILA_DATOS, 1, ultimaFila - FILA_DATOS + 1, ancho).getValues();
  var llave = COLUMNAS[clave][0];
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var o = { _fila: FILA_DATOS + i };
    COLUMNAS[clave].forEach(function (t) { o[t] = datos[i][mapa[t] - 1]; });
    if (String(o[llave] === null || o[llave] === undefined ? '' : o[llave]).trim() === '') continue;
    filas.push(o);
  }
  return { hoja: hoja, mapa: mapa, filas: filas };
}

/** Hoja y títulos, sin leer los datos: para agregar filas a tablas largas. */
function tablaParaAgregar_(clave) {
  var hoja = hoja_(clave);
  return { hoja: hoja, mapa: titulos_(hoja, clave), filas: null };
}

/**
 * Escribe filas nuevas debajo de la última con contenido. Antes de escribir
 * pone el formato de texto y de fecha en esas filas: el que dejó instalar()
 * llega solo hasta la fila 1000, y sin él Sheets convierte «2026-10» en fecha.
 */
function agregarFilas_(tabla, clave, objetos) {
  if (!objetos.length) return;
  var ancho = tabla.hoja.getLastColumn();
  var desde = Math.max(tabla.hoja.getLastRow() + 1, FILA_DATOS);
  [[COLUMNAS_TEXTO, '@'], [COLUMNAS_FECHA, 'dd/mm/yyyy'], [COLUMNAS_FECHA_HORA, 'dd/mm/yyyy hh:mm']].forEach(function (par) {
    (par[0][clave] || []).forEach(function (t) {
      tabla.hoja.getRange(desde, tabla.mapa[t], objetos.length, 1).setNumberFormat(par[1]);
    });
  });
  var matriz = objetos.map(function (o) {
    var fila = [];
    for (var c = 0; c < ancho; c++) fila.push('');
    COLUMNAS[clave].forEach(function (t) {
      var v = o[t];
      fila[tabla.mapa[t] - 1] = (v === undefined || v === null) ? '' : v;
    });
    return fila;
  });
  tabla.hoja.getRange(desde, 1, matriz.length, ancho).setValues(matriz);
}

/** Cambia celdas sueltas de una fila ya leída. */
function ponerCeldas_(tabla, fila, cambios) {
  Object.keys(cambios).forEach(function (t) {
    if (!(t in tabla.mapa)) throw new Error('columna desconocida ' + t);
    var v = cambios[t];
    tabla.hoja.getRange(fila._fila, tabla.mapa[t]).setValue(v === undefined || v === null ? '' : v);
    fila[t] = v;
  });
}

function texto_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** Normaliza para comparar: sin mayúsculas, acentos ni espacios dobles. */
function norm_(v) {
  return texto_(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function siguienteId_(filas, columna, prefijo) {
  var max = 0;
  filas.forEach(function (f) {
    var s = texto_(f[columna]);
    if (s.indexOf(prefijo) === 0) {
      var n = parseInt(s.slice(prefijo.length), 10);
      if (n > max) max = n;
    }
  });
  return function () { max++; return prefijo + ('0000' + max).slice(-Math.max(4, String(max).length)); };
}


// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Valor de celda → 'yyyy-MM-dd' (o '' si vacío). */
function aISO_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, zona_(), 'yyyy-MM-dd');
  }
  var d = fechaDeTexto_(String(v));
  return d ? Utilities.formatDate(d, zona_(), 'yyyy-MM-dd') : '';
}

/** Valor de celda → 'yyyy-MM-dd HH:mm'. */
function aISOHora_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()))
    return Utilities.formatDate(v, zona_(), 'yyyy-MM-dd HH:mm');
  return texto_(v);
}

/**
 * Texto → Date en la zona del archivo. Acepta 'yyyy-MM-dd' (lo que manda la
 * página) y 'dd/MM/yyyy' (lo que trae Poliwin). Devuelve null si no es una
 * fecha real (un 31/02 no pasa).
 */
function fechaDeTexto_(s) {
  s = texto_(s);
  var m, y, mo, d;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  var txt = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
  var f = Utilities.parseDate(txt, zona_(), 'yyyy-MM-dd');
  if (Utilities.formatDate(f, zona_(), 'yyyy-MM-dd') !== txt) return null;
  return f;
}

function hoyISO_() { return Utilities.formatDate(new Date(), zona_(), 'yyyy-MM-dd'); }
function mesISO_() { return Utilities.formatDate(new Date(), zona_(), 'yyyy-MM'); }

/** Hora de clase → 'HH:mm'. Sheets puede haberla convertido en hora. */
function aHora_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, zona_(), 'HH:mm');
  var s = texto_(v), m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s;
}

/** Mes que cubre → 'yyyy-MM'. */
function aMes_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, zona_(), 'yyyy-MM');
  var s = texto_(v), m = /^(\d{4})-(\d{1,2})$/.exec(s);
  return m && +m[2] >= 1 && +m[2] <= 12 ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

/**
 * Número con la regla de bdclientesvea: si aparecen coma y punto manda el
 * último; si uno solo aparece más de una vez es de miles; si aparece una vez
 * es decimal, salvo que lo sigan exactamente tres dígitos.
 */
function numeroDe_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  var s = texto_(v).replace(/[\s$]/g, '');
  if (!s) return NaN;
  var c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) {
    var dec = c > p ? ',' : '.', mil = dec === ',' ? '.' : ',';
    s = s.split(mil).join('').replace(dec, '.');
  } else if (c >= 0 || p >= 0) {
    var sep = c >= 0 ? ',' : '.';
    var partes = s.split(sep);
    if (partes.length > 2 || partes[1].length === 3) s = partes.join('');
    else s = partes.join('.');
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}


// ═════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═════════════════════════════════════════════════════════════════════════════

function leerConfig_() {
  var t = leerTabla_('config');
  var cfg = { motivos: [], planes: [], conceptos: [], formas: [], umbral: null, conceptoMensual: '', faltan: [] };
  t.filas.forEach(function (f) {
    var lista = norm_(f['Lista']), valor = texto_(f['Valor']);
    if (!valor) return;
    if (lista === norm_(LISTA.motivo)) cfg.motivos.push(valor);
    else if (lista === norm_(LISTA.plan)) cfg.planes.push({ nombre: valor, precio: numeroDe_(f['Número']) });
    else if (lista === norm_(LISTA.concepto)) cfg.conceptos.push(valor);
    else if (lista === norm_(LISTA.forma)) cfg.formas.push(valor);
    else if (lista === norm_(LISTA.param)) {
      if (norm_(valor) === norm_(PARAM_UMBRAL)) {
        var u = numeroDe_(f['Número']);
        if (u > 1) u = u / 100;          // admite 80 o 0,8
        if (u > 0 && u <= 1) cfg.umbral = u;
      } else if (norm_(valor) === norm_(PARAM_CONCEPTO_MENSUAL)) {
        cfg.conceptoMensual = texto_(f['Nota']);
      }
    }
  });
  cfg.planes.forEach(function (p) { if (isNaN(p.precio)) p.precio = null; });
  if (!cfg.motivos.length) cfg.faltan.push('filas «' + LISTA.motivo + '»');
  if (!cfg.planes.length) cfg.faltan.push('filas «' + LISTA.plan + '»');
  if (!cfg.conceptos.length) cfg.faltan.push('filas «' + LISTA.concepto + '»');
  if (!cfg.formas.length) cfg.faltan.push('filas «' + LISTA.forma + '»');
  if (cfg.umbral === null) cfg.faltan.push('«' + LISTA.param + ' / ' + PARAM_UMBRAL + '» con un número entre 0 y 1 en la columna Número');
  if (!cfg.conceptoMensual) cfg.faltan.push('«' + LISTA.param + ' / ' + PARAM_CONCEPTO_MENSUAL + '» con el concepto en la columna Nota');
  else if (cfg.conceptos.map(norm_).indexOf(norm_(cfg.conceptoMensual)) < 0)
    cfg.faltan.push('el concepto de mensualidad «' + cfg.conceptoMensual + '» no está en la lista «' + LISTA.concepto + '»');
  return cfg;
}

function enLista_(valor, lista) {
  var n = norm_(valor);
  for (var i = 0; i < lista.length; i++) if (norm_(lista[i]) === n) return lista[i];
  return null;
}


// ═════════════════════════════════════════════════════════════════════════════
//  INSTALACIÓN Y COMPROBACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/** Crea las pestañas que falten con sus títulos. No toca las que existen. */
function instalar() {
  var ss = libro_(), informe = [];
  Object.keys(HOJAS).forEach(function (clave) {
    var h = ss.getSheetByName(HOJAS[clave]);
    if (h) { informe.push('Ya existía: ' + HOJAS[clave]); return; }
    h = ss.insertSheet(HOJAS[clave]);
    var cols = COLUMNAS[clave];
    h.getRange(FILA_TITULOS, COL_INICIO, 1, cols.length).setValues([cols]).setFontWeight('bold');
    h.setFrozenRows(FILA_TITULOS);
    h.setColumnWidth(1, 24);
    var formato = function (lista, fmt) {
      (lista[clave] || []).forEach(function (t) {
        var c = COL_INICIO + cols.indexOf(t);
        h.getRange(FILA_DATOS, c, h.getMaxRows() - FILA_DATOS + 1, 1).setNumberFormat(fmt);
      });
    };
    formato(COLUMNAS_TEXTO, '@');
    formato(COLUMNAS_FECHA, 'dd/mm/yyyy');
    formato(COLUMNAS_FECHA_HORA, 'dd/mm/yyyy hh:mm');
    h.getRange(2, COL_INICIO).setValue(HOJAS[clave]).setFontWeight('bold').setFontSize(13);
    informe.push('Creada: ' + HOJAS[clave]);
  });
  var cfg = hoja_('config');
  if (cfg.getLastRow() < FILA_DATOS) {
    var t = leerTabla_('config');
    agregarFilas_(t, 'config', INS_CONFIG.map(function (r) {
      return { 'Lista': r[0], 'Valor': r[1], 'Número': r[2], 'Nota': r[3] };
    }));
    informe.push('Config: escritos ' + INS_CONFIG.length + ' valores iniciales');
  } else informe.push('Config: ya tenía datos, no se tocó');
  informe.push('');
  informe.push(comprobar());
  return informe.join('\n');
}

/** Diagnóstico. No escribe nada. */
function comprobar() {
  var ss = libro_(), l = [];
  l.push('Archivo: ' + ss.getName());
  var zArchivo = ss.getSpreadsheetTimeZone(), zScript = Session.getScriptTimeZone();
  l.push('Zona del archivo: ' + zArchivo + ' · zona del script: ' + zScript +
    (zArchivo === zScript ? '' : '   ⚠ DIFIEREN: igualarlas antes de usar'));
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  l.push('Clave del puente (' + PROP_CLAVE + '): ' + (clave && clave.length >= 24 ? 'configurada' :
    clave ? '⚠ demasiado corta (mínimo 24 caracteres)' : '⚠ FALTA: el puente rechaza todo'));
  Object.keys(HOJAS).forEach(function (k) {
    try { var t = leerTabla_(k); l.push(HOJAS[k] + ': ' + t.filas.length + ' filas'); }
    catch (e) { l.push('⚠ ' + e.message); }
  });
  try {
    var cfg = leerConfig_();
    l.push('Config: ' + cfg.motivos.length + ' motivos, ' + cfg.planes.length + ' planes, ' +
      cfg.conceptos.length + ' conceptos, ' + cfg.formas.length + ' formas de pago, umbral ' +
      (cfg.umbral === null ? '—' : Math.round(cfg.umbral * 100) + ' %'));
    cfg.faltan.forEach(function (f) { l.push('⚠ Config: falta ' + f); });
  } catch (e) { l.push('⚠ ' + e.message); }
  return l.join('\n');
}


// ═════════════════════════════════════════════════════════════════════════════
//  CARGA INICIAL DESDE POLIWIN
//
//  Lee una copia CONVERTIDA a Google Sheets de Carga_Inicial_AfterSchool.xlsx
//  (en Drive: clic derecho → Abrir con → Hojas de cálculo de Google). Su ID va
//  en la propiedad AS_ID_CARGA. Tres pestañas con títulos en la fila 1:
//    Clases         Código clase, Servicio, Modalidad, Día, Hora inicio, Cupo, Edades
//                   (+ «Reservados…», que solo se usa para comprobar)
//    Niños          Número de socio, Nombre, Apellidos, Fecha nacimiento, Sexo,
//                   Estado (Poliwin), Fecha de alta, Móvil, Móvil 2, Teléfono,
//                   E-mail, Cabeza de familia, Observaciones, Revisar
//    Inscripciones  Número de socio, Código clase, Reservado en Poliwin el
// ═════════════════════════════════════════════════════════════════════════════

function ensayarCarga() { return informeCarga_(planCarga_(), false); }

function cargaInicial() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'Otra operación está escribiendo. Vuelve a intentarlo en un minuto.';
  try {
    var plan = planCarga_();
    var ocupadas = ['ninos', 'clases', 'inscripciones'].filter(function (k) { return leerTabla_(k).filas.length > 0; });
    if (ocupadas.length) return 'NO SE CARGÓ NADA: ' + ocupadas.map(function (k) { return HOJAS[k]; }).join(', ') +
      ' ya tiene datos. La carga inicial solo corre sobre pestañas vacías.';
    if (plan.errorGrave) return 'NO SE CARGÓ NADA: ' + plan.errorGrave;
    agregarFilas_(leerTabla_('clases'), 'clases', plan.clases);
    agregarFilas_(leerTabla_('ninos'), 'ninos', plan.ninos);
    agregarFilas_(leerTabla_('inscripciones'), 'inscripciones', plan.inscripciones);
    historial_(USUARIO_CARGA, 'Carga inicial', '', plan.clases.length + ' clases, ' +
      plan.ninos.length + ' niños, ' + plan.inscripciones.length + ' inscripciones');
    SpreadsheetApp.flush();
    return informeCarga_(plan, true);
  } finally { lock.releaseLock(); }
}

function leerOrigen_(ss, nombre) {
  var h = ss.getSheetByName(nombre);
  if (!h) return null;
  var v = h.getDataRange().getValues();
  if (!v.length) return { titulos: {}, filas: [] };
  var tit = {};
  v[0].forEach(function (t, i) { t = texto_(t); if (t && !(t in tit)) tit[t] = i; });
  return { titulos: tit, filas: v.slice(1).map(function (r, i) { return { n: i + 2, r: r }; }) };
}

/** Busca una columna por título normalizado; admite que empiece igual. */
function colOrigen_(origen, titulo, prefijo) {
  var objetivo = norm_(titulo);
  for (var t in origen.titulos) {
    var n = norm_(t);
    if (n === objetivo || (prefijo && n.indexOf(objetivo) === 0)) return origen.titulos[t];
  }
  return -1;
}

function planCarga_() {
  var plan = { clases: [], ninos: [], inscripciones: [], rechazos: [], avisos: [], revisarEdad: [],
               reservadosPoliwin: {}, errorGrave: '' };
  var id = PropertiesService.getScriptProperties().getProperty(PROP_ID_CARGA);
  if (!id) { plan.errorGrave = 'falta la propiedad del script ' + PROP_ID_CARGA + ' con el ID de la copia convertida del Excel.'; return plan; }
  var ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { plan.errorGrave = 'no se pudo abrir el archivo ' + id + ': ' + e.message; return plan; }

  var oC = leerOrigen_(ss, 'Clases'), oN = leerOrigen_(ss, 'Niños'), oI = leerOrigen_(ss, 'Inscripciones');
  var faltan = [];
  if (!oC) faltan.push('Clases'); if (!oN) faltan.push('Niños'); if (!oI) faltan.push('Inscripciones');
  if (faltan.length) { plan.errorGrave = 'al archivo de carga le faltan las pestañas: ' + faltan.join(', '); return plan; }

  function cols(origen, nombreHoja, lista) {
    var r = {}, miss = [];
    lista.forEach(function (x) {
      var c = colOrigen_(origen, x[0], x[1]);
      if (c < 0 && !x[2]) miss.push(x[0]);
      r[x[0]] = c;
    });
    if (miss.length) plan.errorGrave = (plan.errorGrave ? plan.errorGrave + '; ' : '') +
      'a la pestaña ' + nombreHoja + ' le faltan las columnas: ' + miss.join(', ');
    return r;
  }
  function val(fila, c) { return c < 0 ? '' : fila.r[c]; }

  // [título, admite prefijo, opcional]
  var cC = cols(oC, 'Clases', [['Código clase'], ['Servicio'], ['Modalidad'], ['Día'], ['Hora inicio'],
                               ['Cupo'], ['Edades'], ['Reservados', true, true]]);
  var cN = cols(oN, 'Niños', [['Número de socio'], ['Nombre'], ['Apellidos'], ['Fecha nacimiento'], ['Sexo'],
                              ['Estado (Poliwin)', true, true], ['Fecha de alta'], ['Móvil'], ['Móvil 2'],
                              ['Teléfono'], ['E-mail'], ['Cabeza de familia'], ['Observaciones'], ['Revisar']]);
  var cI = cols(oI, 'Inscripciones', [['Número de socio'], ['Código clase'], ['Reservado en Poliwin el']]);
  if (plan.errorGrave) return plan;

  var ahora = new Date();

  // ── Clases ──
  var codigos = {};
  oC.filas.forEach(function (f) {
    var cod = texto_(val(f, cC['Código clase']));
    if (!cod && f.r.every(function (x) { return texto_(x) === ''; })) return;
    var dia = enLista_(val(f, cC['Día']), DIAS_ORDEN);
    var cupo = numeroDe_(val(f, cC['Cupo']));
    var motivo = !cod ? 'sin código de clase' :
                 codigos[cod] ? 'código repetido' :
                 !texto_(val(f, cC['Servicio'])) ? 'sin servicio' :
                 !dia ? 'día no reconocido «' + texto_(val(f, cC['Día'])) + '»' :
                 !(cupo > 0 && Math.floor(cupo) === cupo) ? 'cupo no es un entero positivo' : '';
    if (motivo) { plan.rechazos.push('Clases fila ' + f.n + ' (' + (cod || '—') + '): ' + motivo); return; }
    codigos[cod] = { edades: texto_(val(f, cC['Edades'])) };
    if (cC['Reservados'] >= 0) plan.reservadosPoliwin[cod] = numeroDe_(val(f, cC['Reservados']));
    plan.clases.push({
      'Código clase': cod, 'Servicio': texto_(val(f, cC['Servicio'])),
      'Modalidad': texto_(val(f, cC['Modalidad'])), 'Día': dia,
      'Hora inicio': aHora_(val(f, cC['Hora inicio'])), 'Cupo': cupo,
      'Edades': codigos[cod].edades, 'Activa': SI
    });
  });

  // ── Niños ──
  var siguiente = siguienteId_([], 'ID', PREFIJO.nino);
  var porSocio = {};
  oN.filas.forEach(function (f) {
    var socio = texto_(val(f, cN['Número de socio']));
    var nombre = texto_(val(f, cN['Nombre']));
    if (!socio && !nombre && f.r.every(function (x) { return texto_(x) === ''; })) return;
    var motivo = !socio ? 'sin número de socio' : porSocio[socio] ? 'número de socio repetido' :
                 !nombre ? 'sin nombre' : '';
    if (motivo) { plan.rechazos.push('Niños fila ' + f.n + ' (socio ' + (socio || '—') + '): ' + motivo); return; }

    var nacTxt = val(f, cN['Fecha nacimiento']), nac = '';
    if (texto_(nacTxt) !== '') {
      nac = Object.prototype.toString.call(nacTxt) === '[object Date]' ? nacTxt : fechaDeTexto_(nacTxt);
      if (!nac) { plan.avisos.push('Niños fila ' + f.n + ' (socio ' + socio + '): fecha de nacimiento ilegible «' + texto_(nacTxt) + '», se carga vacía'); nac = ''; }
    }
    var altaTxt = val(f, cN['Fecha de alta']), alta = '';
    if (texto_(altaTxt) !== '') {
      alta = Object.prototype.toString.call(altaTxt) === '[object Date]' ? altaTxt : fechaDeTexto_(altaTxt);
      if (!alta) { plan.avisos.push('Niños fila ' + f.n + ' (socio ' + socio + '): fecha de alta ilegible, se carga vacía'); alta = ''; }
    }

    // Teléfonos: Móvil → Teléfono; Móvil 2, o el fijo si difiere del móvil → Teléfono 2.
    var movil = texto_(val(f, cN['Móvil'])), movil2 = texto_(val(f, cN['Móvil 2'])), fijo = texto_(val(f, cN['Teléfono']));
    var tels = [];
    [movil, movil2, fijo].forEach(function (t) { if (t && tels.indexOf(t) < 0) tels.push(t); });
    var notas = [];
    var obs = texto_(val(f, cN['Observaciones']));
    if (obs) notas.push(obs);
    var revisar = texto_(val(f, cN['Revisar']));
    if (revisar) notas.push('Revisar (Poliwin): ' + revisar);
    var estP = cN['Estado (Poliwin)'] >= 0 ? texto_(val(f, cN['Estado (Poliwin)'])) : '';
    if (estP && norm_(estP) !== 'alta') notas.push('Estado en Poliwin: ' + estP);
    if (tels.length > 2) notas.push('Otro teléfono: ' + tels.slice(2).join(', '));

    var idNino = siguiente();
    porSocio[socio] = idNino;
    plan.ninos.push({
      'ID': idNino, 'Número socio Poliwin': socio, 'Nombre': nombre,
      'Apellidos': texto_(val(f, cN['Apellidos'])), 'Fecha nacimiento': nac,
      'Sexo': texto_(val(f, cN['Sexo'])), 'Nombre responsable': '',
      'Teléfono': tels[0] || '', 'Teléfono 2': tels[1] || '',
      'Correo': texto_(val(f, cN['E-mail'])), 'Cabeza de familia': texto_(val(f, cN['Cabeza de familia'])),
      'Estado': revisar ? ESTADO.revisar : ESTADO.activo, 'Fecha ingreso': alta,
      'Notas': notas.join(' · '), _nac: nac
    });
  });

  // ── Inscripciones ──
  var sigIns = siguienteId_([], 'ID inscripción', PREFIJO.inscripcion);
  var vistas = {};
  var ninoPorId = {};
  plan.ninos.forEach(function (n) { ninoPorId[n['ID']] = n; });
  oI.filas.forEach(function (f) {
    var socio = texto_(val(f, cI['Número de socio'])), cod = texto_(val(f, cI['Código clase']));
    if (!socio && !cod) return;
    var fechaTxt = val(f, cI['Reservado en Poliwin el']);
    var fecha = Object.prototype.toString.call(fechaTxt) === '[object Date]' ? fechaTxt : fechaDeTexto_(fechaTxt);
    var idNino = porSocio[socio];
    var motivo = !idNino ? 'el socio ' + (socio || '—') + ' no está entre los niños cargados' :
                 !codigos[cod] ? 'la clase «' + cod + '» no está entre las clases cargadas' :
                 vistas[socio + '|' + cod] ? 'inscripción repetida' :
                 !fecha ? 'fecha de reserva ilegible «' + texto_(fechaTxt) + '»' : '';
    if (motivo) { plan.rechazos.push('Inscripciones fila ' + f.n + ' (socio ' + (socio || '—') + ', ' + (cod || '—') + '): ' + motivo); return; }
    vistas[socio + '|' + cod] = true;
    plan.inscripciones.push({
      'ID inscripción': sigIns(), 'ID niño': idNino, 'Código clase': cod, 'Fecha alta': fecha,
      'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': '',
      'Registrado por': USUARIO_CARGA, 'Fecha registro': ahora
    });
    if (norm_(codigos[cod].edades) === 'adultos') {
      var n = ninoPorId[idNino];
      plan.revisarEdad.push(cod + ' (' + codigos[cod].edades + '): ' + idNino + ', socio ' + socio +
        ', ' + (n._nac ? edadTexto_(n._nac) : 'sin fecha de nacimiento'));
    }
  });
  plan.ninos.forEach(function (n) { delete n._nac; });
  return plan;
}

function edadTexto_(nac) {
  var hoy = new Date();
  var a = hoy.getFullYear() - nac.getFullYear();
  var m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) a--;
  return a + ' años';
}

function informeCarga_(plan, escrito) {
  var l = [];
  l.push(escrito ? 'CARGA INICIAL — ESCRITA' : 'ENSAYO DE CARGA — NO SE ESCRIBIÓ NADA');
  if (plan.errorGrave) { l.push(''); l.push('⚠ ' + plan.errorGrave); return l.join('\n'); }
  l.push('');
  l.push('Clases: ' + plan.clases.length);
  l.push('Niños: ' + plan.ninos.length);
  var est = {};
  plan.ninos.forEach(function (n) { est[n['Estado']] = (est[n['Estado']] || 0) + 1; });
  Object.keys(est).forEach(function (e) { l.push('   ' + e + ': ' + est[e]); });
  l.push('Inscripciones: ' + plan.inscripciones.length);
  var porClase = {};
  plan.inscripciones.forEach(function (i) { porClase[i['Código clase']] = (porClase[i['Código clase']] || 0) + 1; });
  l.push('');
  l.push('Inscripciones por clase (reservados / cupo):');
  plan.clases.forEach(function (c) {
    var cod = c['Código clase'], n = porClase[cod] || 0;
    var p = plan.reservadosPoliwin[cod];
    var dif = (p !== undefined && !isNaN(p) && p !== n) ? '   ⚠ Poliwin decía ' + p : '';
    l.push('   ' + cod + ': ' + n + ' / ' + c['Cupo'] + (n > c['Cupo'] ? '   ⚠ SOBRE EL CUPO' : '') + dif);
  });
  l.push('');
  l.push('Filas que NO se cargan: ' + plan.rechazos.length);
  plan.rechazos.forEach(function (r) { l.push('   ' + r); });
  l.push('Avisos (se cargan con el dato vacío): ' + plan.avisos.length);
  plan.avisos.forEach(function (r) { l.push('   ' + r); });
  l.push('Inscripciones en clases de adultos, para revisar: ' + plan.revisarEdad.length);
  plan.revisarEdad.forEach(function (r) { l.push('   ' + r); });
  return l.join('\n');
}


// ═════════════════════════════════════════════════════════════════════════════
//  PUENTE
// ═════════════════════════════════════════════════════════════════════════════

function ErrorUsuario_(mensaje, codigo) { this.message = mensaje; this.codigo = codigo || ''; }

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return respuesta_({ ok: false, error: 'Este puente solo responde a POST desde el portal.' });
}

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

var ACCIONES = {
  leer: { escribe: false, fn: accLeer_ },
  listarPagos: { escribe: false, fn: accListarPagos_ },
  crearNino: { escribe: true, fn: accCrearNino_ },
  editarNino: { escribe: true, fn: accEditarNino_ },
  inscribir: { escribe: true, fn: accInscribir_ },
  mover: { escribe: true, fn: accMover_ },
  bajaClase: { escribe: true, fn: accBajaClase_ },
  bajaTotal: { escribe: true, fn: accBajaTotal_ },
  registrarPago: { escribe: true, fn: accRegistrarPago_ },
  revisar: { escribe: true, fn: accRevisar_ }
};

function atender_(p) {
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  if (!clave || clave.length < 24) return { ok: false, error: 'El puente no tiene clave configurada.', codigo: 'sin_clave' };
  if (!igualSeguro_(p.key, clave)) return { ok: false, error: 'clave inválida', codigo: 'no_autorizado' };
  var usuario = texto_(p.usuario);
  if (!usuario) return { ok: false, error: 'La llamada no trae el usuario del portal.', codigo: 'no_autorizado' };
  var acc = ACCIONES[p.accion];
  if (!acc) return { ok: false, error: 'acción desconocida: ' + texto_(p.accion) };

  var lock = null;
  try {
    if (acc.escribe) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return { ok: false, error: 'Otra persona está guardando en este momento. Espera unos segundos y vuelve a intentarlo.', codigo: 'ocupado' };
    }
    var datos = p.datos || {};
    var resultado = acc.fn(datos, usuario);
    if (acc.escribe) {
      SpreadsheetApp.flush();
      return { ok: true, resultado: resultado, estado: accLeer_({}, usuario) };
    }
    return { ok: true, resultado: resultado };
  } catch (err) {
    if (err instanceof ErrorUsuario_) return { ok: false, error: err.message, codigo: err.codigo };
    return { ok: false, error: 'Error interno: ' + (err && err.message ? err.message : String(err)) };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function historial_(usuario, accion, id, detalle) {
  var t = tablaParaAgregar_('historial');
  agregarFilas_(t, 'historial', [{ 'Fecha': new Date(), 'Usuario': usuario, 'Acción': accion, 'ID': id, 'Detalle': detalle }]);
}


// ─── Lectura ─────────────────────────────────────────────────────────────────

function ninoPublico_(f) {
  return {
    id: texto_(f['ID']), socio: texto_(f['Número socio Poliwin']), nombre: texto_(f['Nombre']),
    apellidos: texto_(f['Apellidos']), nacimiento: aISO_(f['Fecha nacimiento']), sexo: texto_(f['Sexo']),
    responsable: texto_(f['Nombre responsable']), telefono: texto_(f['Teléfono']),
    telefono2: texto_(f['Teléfono 2']), correo: texto_(f['Correo']),
    cabeza: texto_(f['Cabeza de familia']), estado: texto_(f['Estado']),
    ingreso: aISO_(f['Fecha ingreso']), notas: texto_(f['Notas'])
  };
}

function clasePublica_(f) {
  return {
    codigo: texto_(f['Código clase']), servicio: texto_(f['Servicio']), modalidad: texto_(f['Modalidad']),
    dia: enLista_(f['Día'], DIAS_ORDEN) || texto_(f['Día']), hora: aHora_(f['Hora inicio']),
    cupo: numeroDe_(f['Cupo']), edades: texto_(f['Edades']),
    activa: norm_(f['Activa']) === norm_(SI)
  };
}

function inscripcionActiva_(f) { return texto_(f['Fecha baja']) === '' ; }

function pagoPublico_(f) {
  return {
    id: texto_(f['ID pago']), idNino: texto_(f['ID niño']), mes: aMes_(f['Mes que cubre']),
    concepto: texto_(f['Concepto']), plan: texto_(f['Plan']), monto: numeroDe_(f['Monto']),
    fecha: aISO_(f['Fecha pago']), forma: texto_(f['Forma de pago']),
    registradoPor: texto_(f['Registrado por']), notas: texto_(f['Notas'])
  };
}

function accLeer_(datos, usuario) {
  var clases = leerTabla_('clases').filas.map(clasePublica_);
  var ninos = leerTabla_('ninos').filas.map(ninoPublico_);
  var ins = leerTabla_('inscripciones').filas.filter(inscripcionActiva_).map(function (f) {
    return { id: texto_(f['ID inscripción']), idNino: texto_(f['ID niño']),
             codigo: texto_(f['Código clase']), alta: aISO_(f['Fecha alta']) };
  });
  var cuenta = {};
  ins.forEach(function (i) { cuenta[i.codigo] = (cuenta[i.codigo] || 0) + 1; });
  clases.forEach(function (c) { c.reservados = cuenta[c.codigo] || 0; });
  var mes = mesISO_();
  var pagos = leerTabla_('pagos').filas.map(pagoPublico_).filter(function (p) { return p.mes === mes; });
  return {
    archivo: libro_().getName(), usuario: usuario, hoy: hoyISO_(), mes: mes,
    config: leerConfig_(), clases: clases, ninos: ninos, inscripciones: ins, pagosMes: pagos,
    estados: [ESTADO.activo, ESTADO.revisar, ESTADO.retirado], motivoCambio: MOTIVO_CAMBIO_CLASE,
    dias: DIAS_ORDEN
  };
}

function accListarPagos_(datos) {
  var mes = aMes_(datos.mes);
  if (!mes) throw new ErrorUsuario_('El mes tiene que venir como AAAA-MM.');
  return { mes: mes, pagos: leerTabla_('pagos').filas.map(pagoPublico_).filter(function (p) { return p.mes === mes; }) };
}


// ─── Validaciones comunes ────────────────────────────────────────────────────

function exigirFecha_(v, nombre) {
  var d = fechaDeTexto_(v);
  if (!d) throw new ErrorUsuario_('Falta ' + nombre + ' o no es una fecha válida.');
  return d;
}

function exigirMotivo_(v, cfg) {
  if (!texto_(v)) throw new ErrorUsuario_('Falta el motivo de la baja.');
  var m = enLista_(v, cfg.motivos);
  if (!m) throw new ErrorUsuario_('El motivo «' + texto_(v) + '» no está en la lista de Config.');
  return m;
}

function buscarNino_(tabla, id) {
  id = texto_(id);
  for (var i = 0; i < tabla.filas.length; i++) if (texto_(tabla.filas[i]['ID']) === id) return tabla.filas[i];
  throw new ErrorUsuario_('No existe el niño ' + (id || '(sin ID)') + '.');
}

function buscarClase_(tabla, codigo) {
  codigo = texto_(codigo);
  for (var i = 0; i < tabla.filas.length; i++) if (texto_(tabla.filas[i]['Código clase']) === codigo) return tabla.filas[i];
  throw new ErrorUsuario_('No existe la clase ' + (codigo || '(sin código)') + '.');
}

function nombreDe_(f) { return (texto_(f['Nombre']) + ' ' + texto_(f['Apellidos'])).trim(); }

/** Comprueba que la clase admita a un niño más. Devuelve la fila de la clase. */
function exigirCupo_(clases, ins, codigo) {
  var c = buscarClase_(clases, codigo);
  if (norm_(c['Activa']) !== norm_(SI)) throw new ErrorUsuario_('La clase ' + codigo + ' no está activa.');
  var cupo = numeroDe_(c['Cupo']);
  if (!(cupo > 0)) throw new ErrorUsuario_('La clase ' + codigo + ' no tiene un cupo válido en la pestaña Clases.');
  var res = ins.filas.filter(function (f) { return inscripcionActiva_(f) && texto_(f['Código clase']) === codigo; }).length;
  if (res >= cupo) throw new ErrorUsuario_('La clase ' + codigo + ' está llena: ' + res + ' de ' + cupo + ' cupos. No se inscribió.', 'llena');
  return c;
}

var CAMPOS_NINO = {
  socio: 'Número socio Poliwin', nombre: 'Nombre', apellidos: 'Apellidos', nacimiento: 'Fecha nacimiento',
  sexo: 'Sexo', responsable: 'Nombre responsable', telefono: 'Teléfono', telefono2: 'Teléfono 2',
  correo: 'Correo', cabeza: 'Cabeza de familia', ingreso: 'Fecha ingreso', notas: 'Notas'
};

function valoresNino_(entrada, parcial) {
  var out = {};
  Object.keys(CAMPOS_NINO).forEach(function (k) {
    if (!(k in entrada)) { if (!parcial) out[CAMPOS_NINO[k]] = ''; return; }
    var v = texto_(entrada[k]);
    if (k === 'nacimiento' || k === 'ingreso') {
      if (v === '') { out[CAMPOS_NINO[k]] = ''; return; }
      var d = fechaDeTexto_(v);
      if (!d) throw new ErrorUsuario_('La ' + (k === 'nacimiento' ? 'fecha de nacimiento' : 'fecha de ingreso') + ' no es válida.');
      out[CAMPOS_NINO[k]] = d;
    } else out[CAMPOS_NINO[k]] = v;
  });
  return out;
}


// ─── Escrituras ──────────────────────────────────────────────────────────────

function accCrearNino_(datos, usuario) {
  var n = datos.nino || {};
  var valores = valoresNino_(n, false);
  if (!valores['Nombre']) throw new ErrorUsuario_('El nombre es obligatorio.');
  var t = leerTabla_('ninos');
  if (!datos.confirmarDuplicado) {
    var nuevo = norm_(valores['Nombre'] + ' ' + valores['Apellidos']);
    var igual = t.filas.filter(function (f) { return norm_(nombreDe_(f)) === nuevo; });
    if (igual.length) throw new ErrorUsuario_('Ya existe ' + igual.map(function (f) {
      return texto_(f['ID']) + ' ' + nombreDe_(f) + ' (' + texto_(f['Estado']) + ')'; }).join(', ') +
      '. Si es otro niño con el mismo nombre, confirma para crearlo igual.', 'duplicado');
  }
  if (!valores['Fecha ingreso']) valores['Fecha ingreso'] = fechaDeTexto_(hoyISO_());
  var id = siguienteId_(t.filas, 'ID', PREFIJO.nino)();
  valores['ID'] = id;
  valores['Estado'] = ESTADO.activo;
  agregarFilas_(t, 'ninos', [valores]);
  historial_(usuario, 'Crear niño', id, nombreDe_(valores));
  return { id: id };
}

function accEditarNino_(datos, usuario) {
  var t = leerTabla_('ninos');
  var f = buscarNino_(t, datos.id);
  var cambios = valoresNino_(datos.cambios || {}, true);
  if ('Nombre' in cambios && !cambios['Nombre']) throw new ErrorUsuario_('El nombre no puede quedar vacío.');
  var detalle = [];
  Object.keys(cambios).forEach(function (col) {
    var antes = COLUMNAS_FECHA.ninos.indexOf(col) >= 0 ? aISO_(f[col]) : texto_(f[col]);
    var despues = COLUMNAS_FECHA.ninos.indexOf(col) >= 0 ? aISO_(cambios[col]) : texto_(cambios[col]);
    if (antes === despues) delete cambios[col]; else detalle.push(col);
  });
  if (datos.reactivar) {
    if (texto_(f['Estado']) !== ESTADO.retirado) throw new ErrorUsuario_('Solo se reactiva a un niño Retirado.');
    cambios['Estado'] = ESTADO.activo;
    detalle.push('Estado → Activo');
  }
  if (!detalle.length) return { id: texto_(f['ID']), sinCambios: true };
  ponerCeldas_(t, f, cambios);
  historial_(usuario, datos.reactivar ? 'Reactivar niño' : 'Editar niño', texto_(f['ID']), detalle.join(', '));
  return { id: texto_(f['ID']) };
}

function accInscribir_(datos, usuario) {
  var ninos = leerTabla_('ninos'), clases = leerTabla_('clases'), ins = leerTabla_('inscripciones');
  var n = buscarNino_(ninos, datos.idNino);
  if (texto_(n['Estado']) === ESTADO.retirado)
    throw new ErrorUsuario_(nombreDe_(n) + ' está Retirado. Reactívalo antes de inscribirlo.');
  var codigo = texto_(datos.codigo);
  var ya = ins.filas.some(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === texto_(n['ID']) && texto_(f['Código clase']) === codigo; });
  if (ya) throw new ErrorUsuario_(nombreDe_(n) + ' ya está inscrito en ' + codigo + '.');
  exigirCupo_(clases, ins, codigo);
  var alta = datos.fechaAlta ? exigirFecha_(datos.fechaAlta, 'la fecha de alta') : fechaDeTexto_(hoyISO_());
  var id = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion)();
  agregarFilas_(ins, 'inscripciones', [{
    'ID inscripción': id, 'ID niño': texto_(n['ID']), 'Código clase': codigo, 'Fecha alta': alta,
    'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': '', 'Registrado por': usuario, 'Fecha registro': new Date()
  }]);
  historial_(usuario, 'Inscribir', id, texto_(n['ID']) + ' en ' + codigo);
  return { id: id };
}

function buscarInscripcionActiva_(ins, id) {
  id = texto_(id);
  for (var i = 0; i < ins.filas.length; i++) {
    var f = ins.filas[i];
    if (texto_(f['ID inscripción']) === id) {
      if (!inscripcionActiva_(f)) throw new ErrorUsuario_('La inscripción ' + id + ' ya estaba dada de baja.');
      return f;
    }
  }
  throw new ErrorUsuario_('No existe la inscripción ' + (id || '(sin ID)') + '.');
}

/**
 * Una baja no puede ser futura: una inscripción con fecha de baja ya no
 * cuenta como activa, así que una baja «a fin de mes» liberaría el cupo hoy.
 * Se registra el día que ocurre.
 */
function exigirNoFutura_(fecha, que) {
  if (Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') > hoyISO_())
    throw new ErrorUsuario_('La fecha ' + que + ' no puede ser posterior a hoy: regístrala el día que ocurra.');
}

function exigirBajaNoAntesDeAlta_(f, fecha) {
  exigirNoFutura_(fecha, 'de baja');
  var alta = aISO_(f['Fecha alta']);
  if (alta && Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') < alta)
    throw new ErrorUsuario_('La fecha de baja no puede ser anterior a la de alta (' + alta + ') en ' + texto_(f['Código clase']) + '.');
}

function accMover_(datos, usuario) {
  var clases = leerTabla_('clases'), ins = leerTabla_('inscripciones'), ninos = leerTabla_('ninos');
  var vieja = buscarInscripcionActiva_(ins, datos.idInscripcion);
  var nueva = texto_(datos.codigoNuevo);
  if (nueva === texto_(vieja['Código clase'])) throw new ErrorUsuario_('La clase nueva es la misma que la actual.');
  var idNino = texto_(vieja['ID niño']);
  buscarNino_(ninos, idNino);
  var ya = ins.filas.some(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === idNino && texto_(f['Código clase']) === nueva; });
  if (ya) throw new ErrorUsuario_('El niño ya está inscrito en ' + nueva + '.');
  exigirCupo_(clases, ins, nueva);
  var fecha = exigirFecha_(datos.fecha, 'la fecha del cambio');
  exigirBajaNoAntesDeAlta_(vieja, fecha);
  var id = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion)();
  // Todo validado: ahora se escribe.
  ponerCeldas_(ins, vieja, { 'Fecha baja': fecha, 'Motivo baja': MOTIVO_CAMBIO_CLASE, 'Detalle motivo': 'A ' + nueva + (texto_(datos.detalle) ? ' · ' + texto_(datos.detalle) : '') });
  agregarFilas_(ins, 'inscripciones', [{
    'ID inscripción': id, 'ID niño': idNino, 'Código clase': nueva, 'Fecha alta': fecha,
    'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': 'Viene de ' + texto_(vieja['Código clase']),
    'Registrado por': usuario, 'Fecha registro': new Date()
  }]);
  historial_(usuario, 'Mover de clase', idNino, texto_(vieja['Código clase']) + ' → ' + nueva + ' (' + texto_(vieja['ID inscripción']) + ' → ' + id + ')');
  return { id: id };
}

function accBajaClase_(datos, usuario) {
  var cfg = leerConfig_(), ins = leerTabla_('inscripciones');
  var f = buscarInscripcionActiva_(ins, datos.idInscripcion);
  var fecha = exigirFecha_(datos.fecha, 'la fecha de baja');
  var motivo = exigirMotivo_(datos.motivo, cfg);
  exigirBajaNoAntesDeAlta_(f, fecha);
  ponerCeldas_(ins, f, { 'Fecha baja': fecha, 'Motivo baja': motivo, 'Detalle motivo': texto_(datos.detalle) });
  historial_(usuario, 'Baja de clase', texto_(f['ID niño']), texto_(f['Código clase']) + ' · ' + motivo);
  return { id: texto_(f['ID inscripción']) };
}

/** Retira al niño del todo: cierra sus inscripciones, Estado Retirado y fila en Bajas. */
function retirar_(idNino, fechaTxt, motivoTxt, detalle, usuario, accion) {
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), ins = leerTabla_('inscripciones');
  var n = buscarNino_(ninos, idNino);
  if (texto_(n['Estado']) === ESTADO.retirado) throw new ErrorUsuario_(nombreDe_(n) + ' ya está Retirado.');
  var fecha = exigirFecha_(fechaTxt, 'la fecha de baja');
  var motivo = exigirMotivo_(motivoTxt, cfg);
  var activas = ins.filas.filter(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === texto_(n['ID']); });
  activas.forEach(function (f) { exigirBajaNoAntesDeAlta_(f, fecha); });
  activas.forEach(function (f) {
    ponerCeldas_(ins, f, { 'Fecha baja': fecha, 'Motivo baja': motivo, 'Detalle motivo': texto_(detalle) });
  });
  ponerCeldas_(ninos, n, { 'Estado': ESTADO.retirado });
  agregarFilas_(tablaParaAgregar_('bajas'), 'bajas', [{ 'ID niño': texto_(n['ID']), 'Fecha baja': fecha, 'Motivo': motivo, 'Detalle': texto_(detalle), 'Registrado por': usuario }]);
  historial_(usuario, accion, texto_(n['ID']), motivo + ' · ' + activas.length + ' clase(s) cerradas');
  return { id: texto_(n['ID']), clasesCerradas: activas.length };
}

function accBajaTotal_(datos, usuario) {
  return retirar_(datos.idNino, datos.fecha, datos.motivo, datos.detalle, usuario, 'Baja total');
}

function accRevisar_(datos, usuario) {
  var ninos = leerTabla_('ninos');
  var n = buscarNino_(ninos, datos.idNino);
  if (texto_(n['Estado']) !== ESTADO.revisar) throw new ErrorUsuario_(nombreDe_(n) + ' ya no está «Por revisar» (está ' + texto_(n['Estado']) + ').');
  if (datos.estado === ESTADO.activo) {
    ponerCeldas_(ninos, n, { 'Estado': ESTADO.activo });
    historial_(usuario, 'Revisado → Activo', texto_(n['ID']), '');
    return { id: texto_(n['ID']), estado: ESTADO.activo };
  }
  if (datos.estado === ESTADO.retirado) {
    var r = retirar_(datos.idNino, datos.fecha, datos.motivo, datos.detalle, usuario, 'Revisado → Retirado');
    r.estado = ESTADO.retirado;
    return r;
  }
  throw new ErrorUsuario_('El estado tiene que ser Activo o Retirado.');
}

function accRegistrarPago_(datos, usuario) {
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), pagos = leerTabla_('pagos');
  var n = buscarNino_(ninos, datos.idNino);
  var mes = aMes_(datos.mes);
  if (!mes) throw new ErrorUsuario_('Falta el mes que cubre (AAAA-MM).');
  var concepto = enLista_(datos.concepto, cfg.conceptos);
  if (!concepto) throw new ErrorUsuario_('Falta el concepto o no está en la lista de Config.');
  var plan = '';
  if (texto_(datos.plan)) {
    var p = enLista_(datos.plan, cfg.planes.map(function (x) { return x.nombre; }));
    if (!p) throw new ErrorUsuario_('El plan «' + texto_(datos.plan) + '» no está en la lista de Config.');
    plan = p;
  }
  var monto = numeroDe_(datos.monto);
  if (!(monto > 0)) throw new ErrorUsuario_('El monto tiene que ser un número mayor que cero.');
  monto = Math.round(monto * 100) / 100;
  var fecha = exigirFecha_(datos.fechaPago, 'la fecha de pago');
  var forma = enLista_(datos.forma, cfg.formas);
  if (!forma) throw new ErrorUsuario_('Falta la forma de pago o no está en la lista de Config.');
  if (!datos.confirmarDuplicado) {
    var previos = pagos.filas.filter(function (f) {
      return texto_(f['ID niño']) === texto_(n['ID']) && aMes_(f['Mes que cubre']) === mes && norm_(f['Concepto']) === norm_(concepto);
    });
    if (previos.length) throw new ErrorUsuario_(nombreDe_(n) + ' ya tiene ' + previos.length + ' pago(s) de ' + concepto +
      ' para ' + mes + ' (' + previos.map(function (f) { return texto_(f['ID pago']) + ' por ' + numeroDe_(f['Monto']); }).join(', ') +
      '). Confirma si es un pago adicional.', 'duplicado');
  }
  var id = siguienteId_(pagos.filas, 'ID pago', PREFIJO.pago)();
  agregarFilas_(pagos, 'pagos', [{
    'ID pago': id, 'ID niño': texto_(n['ID']), 'Mes que cubre': mes, 'Concepto': concepto, 'Plan': plan,
    'Monto': monto, 'Fecha pago': fecha, 'Forma de pago': forma, 'Registrado por': usuario, 'Notas': texto_(datos.notas)
  }]);
  historial_(usuario, 'Registrar pago', id, texto_(n['ID']) + ' · ' + mes + ' · ' + concepto + ' · ' + monto);
  return { id: id };
}
