/* ═════════════════════════════════════════════════════════════════════════════
 *  PROYECTO ACTIO · lectura del Sheet «Datos — Vida en Arte» (22-oct-2026)
 *
 *  Lo que Actio Growth le entrega a Vida en Arte: entregables (con sus
 *  documentos), reuniones y atención directa. Lo escribe Actio desde el
 *  Tablero de Tareas; este script SOLO LEE. Lo llama el portal
 *  (proyecto-actio/api.php) con el mismo sobre que After School:
 *      { key, usuario, accion: "leer", datos: {} }
 *
 *  · Una sola acción, «leer». Cualquier otra se rechaza.
 *  · La clave vive en las Propiedades del script (PA_CLAVE_API), nunca aquí.
 *  · Las columnas se leen por TÍTULO, nunca por letra, desde la fila de
 *    títulos que se encuentre en las primeras filas de cada pestaña.
 *  · «Origen duración» y «Notas» de Atención Directa son internas de Actio:
 *    no se leen. El recorte por rol (Proyecto 2 solo para Administrador) lo
 *    hace el portal, en api.php.
 *  · «Visible para el cliente» (Entregables y Documentos VEA) es opcional: si
 *    la columna no existe, el campo sale vacío y rige la regla por proyecto.
 *    El portal decide con ella qué ve Dirección (api.php).
 *
 *  Instalación: Extensiones › Apps Script en el MISMO Sheet, pegar este
 *  archivo, poner la propiedad PA_CLAVE_API e Implementar como aplicación
 *  web (ver los pasos en docs/ARQUITECTURA.md).
 * ═════════════════════════════════════════════════════════════════════════════ */

var PROP_CLAVE = 'PA_CLAVE_API';

/* Las pestañas y sus columnas. 'campo' es el nombre en la respuesta. Las
   obligatorias faltantes se informan en «faltan» y esa tabla sale vacía. */
var TABLAS = {
  entregables: { pestana: 'Entregables', columnas: [
    { titulo: 'ID', campo: 'id', obligatoria: true },
    { titulo: 'Unidad de negocio', campo: 'unidad' },
    { titulo: 'Entregable', campo: 'entregable', obligatoria: true },
    { titulo: 'Segmento', campo: 'segmento' },
    { titulo: 'Estado', campo: 'estado' },
    { titulo: '% Avance', campo: 'avance', tipo: 'porcentaje' },
    { titulo: 'Fecha compromiso', campo: 'fechaCompromiso', tipo: 'fecha' },
    { titulo: 'Fecha real', campo: 'fechaReal', tipo: 'fecha' },
    { titulo: 'Proyecto', campo: 'proyecto', obligatoria: true },
    { titulo: 'Visible para el cliente', campo: 'visibleCliente' }   // Sí / No / vacío (23-oct; opcional)
  ] },
  documentos: { pestana: 'Documentos VEA', columnas: [
    { titulo: 'Nombre', campo: 'nombre', obligatoria: true },
    { titulo: 'Unidad de negocio', campo: 'unidad' },
    { titulo: 'Segmento', campo: 'segmento' },
    { titulo: 'Tipo', campo: 'tipo' },
    { titulo: 'Fecha', campo: 'fecha', tipo: 'fecha' },
    { titulo: 'Enlace', campo: 'enlace', obligatoria: true },
    { titulo: 'ID Entregable', campo: 'idEntregable' },
    { titulo: 'Proyecto', campo: 'proyecto' },
    { titulo: 'Visible para el cliente', campo: 'visibleCliente' }   // Sí / No / vacío (23-oct; opcional)
  ] },
  reuniones: { pestana: 'Reuniones VEA', columnas: [
    { titulo: 'Fecha', campo: 'fecha', tipo: 'fecha', obligatoria: true },
    { titulo: 'Tema', campo: 'tema', obligatoria: true },
    { titulo: 'Minuta', campo: 'minuta' },
    { titulo: 'Grabación', campo: 'grabacion' },
    { titulo: 'Proyecto', campo: 'proyecto' }
  ] },
  atencion: { pestana: 'Atención Directa', columnas: [
    { titulo: 'Fecha', campo: 'fecha', tipo: 'fecha', obligatoria: true },
    { titulo: 'Tipo', campo: 'tipo', obligatoria: true },
    { titulo: 'Duración (min)', campo: 'duracionMin', tipo: 'numero' },
    { titulo: 'Asunto', campo: 'asunto' },
    { titulo: 'Unidad de negocio', campo: 'unidad' },
    { titulo: 'Enlace', campo: 'enlace' },
    { titulo: 'Proyecto', campo: 'proyecto' }
    // «Origen duración» y «Notas»: internas de Actio, no se leen.
  ] }
};
var FILAS_PARA_BUSCAR_TITULOS = 10;

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

function atender_(p) {
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  if (!clave || clave.length < 24) return { ok: false, error: 'El puente no tiene clave configurada.', codigo: 'sin_clave' };
  if (!igualSeguro_(p.key, clave)) return { ok: false, error: 'clave inválida', codigo: 'no_autorizado' };
  if (!texto_(p.usuario)) return { ok: false, error: 'La llamada no trae el usuario del portal.', codigo: 'no_autorizado' };
  if (p.accion !== 'leer') return { ok: false, error: 'acción desconocida: ' + texto_(p.accion) };
  try {
    return { ok: true, resultado: leer_() };
  } catch (err) {
    return { ok: false, error: 'Error interno: ' + (err && err.message ? err.message : String(err)) };
  }
}

function leer_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var faltan = [], r = { generado: new Date().toISOString() };
  Object.keys(TABLAS).forEach(function (k) { r[k] = leerTabla_(ss, TABLAS[k], faltan); });
  r.faltan = faltan;
  return r;
}

/* ─── Lectura por títulos ──────────────────────────────────────────────── */

function normalizar_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function texto_(v) { return v == null ? '' : String(v).trim(); }

function hoja_(ss, nombre) {
  var buscado = normalizar_(nombre), hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) if (normalizar_(hojas[i].getName()) === buscado) return hojas[i];
  return null;
}

/** Las filas de una pestaña como objetos {campo: valor}, leídas por título. */
function leerTabla_(ss, def, faltan) {
  var h = hoja_(ss, def.pestana);
  if (!h) { faltan.push(def.pestana + ': no existe la pestaña'); return []; }
  var valores = h.getDataRange().getValues();
  // La fila de títulos: la primera (de las primeras) que tenga todas las obligatorias.
  var oblig = def.columnas.filter(function (c) { return c.obligatoria; }).map(function (c) { return normalizar_(c.titulo); });
  var fila = -1;
  for (var f = 0; f < Math.min(FILAS_PARA_BUSCAR_TITULOS, valores.length); f++) {
    var tit = valores[f].map(normalizar_);
    if (oblig.every(function (o) { return tit.indexOf(o) >= 0; })) { fila = f; break; }
  }
  if (fila < 0) {
    var primera = (valores[0] || []).map(normalizar_);
    def.columnas.forEach(function (c) { if (c.obligatoria && primera.indexOf(normalizar_(c.titulo)) < 0) faltan.push(def.pestana + ': ' + c.titulo); });
    return [];
  }
  var titulos = valores[fila].map(normalizar_);
  var col = {};
  def.columnas.forEach(function (c) { col[c.campo] = titulos.indexOf(normalizar_(c.titulo)); });
  var filas = [];
  for (var i = fila + 1; i < valores.length; i++) {
    var v = valores[i], o = {}, vacia = true;
    def.columnas.forEach(function (c) {
      var x = col[c.campo] >= 0 ? v[col[c.campo]] : '';
      o[c.campo] = convertir_(x, c.tipo);
      if (o[c.campo] !== '' && o[c.campo] !== null) vacia = false;
    });
    if (!vacia) filas.push(o);
  }
  return filas;
}

function dos_(n) { return (n < 10 ? '0' : '') + n; }
function convertir_(x, tipo) {
  if (tipo === 'fecha') {
    if (x instanceof Date && !isNaN(x)) return x.getFullYear() + '-' + dos_(x.getMonth() + 1) + '-' + dos_(x.getDate());
    var s = texto_(x), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + '-' + dos_(+m[2]) + '-' + dos_(+m[1]);      // dd/mm/aaaa
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }
  if (tipo === 'porcentaje') {
    if (typeof x === 'number') return Math.round((x <= 1 ? x * 100 : x) * 10) / 10;   // 1 = 100 % en una celda con formato
    var p = parseFloat(texto_(x).replace('%', '').replace(',', '.'));
    return isNaN(p) ? null : Math.round(p * 10) / 10;
  }
  if (tipo === 'numero') {
    if (typeof x === 'number') return x;
    var n = parseFloat(texto_(x).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  return texto_(x);
}
