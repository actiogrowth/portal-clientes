/* Simulador del entorno de Apps Script para AfterSchool.gs.
 *
 * Carga el .gs DE VERDAD en un contexto aislado y le da un SpreadsheetApp en
 * memoria. No toca Google ni la red.
 *
 * Lo que importa imitar bien, porque es donde se rompen estas cosas:
 *   · La conversión automática de Sheets. Una celda que no tiene formato de
 *     texto convierte «2026-10» y «16:30» en fechas, y «50761234567» en un
 *     número. Si el script no pone formato @ donde toca, aquí se ve.
 *   · Las fechas viven en la zona del archivo. Utilities exige que la zona que
 *     se le pasa sea la del proceso (TZ=America/Bogota), y se niega si no: un
 *     verde con otra zona no probaría nada.
 *
 * Lo usan las pruebas y el servidor local de vista previa.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ZONA = 'America/Bogota';
/* Se mira la zona que Node usa de verdad, no la variable: en Git Bash de
   Windows TZ no llega al proceso aunque se escriba delante del comando. */
const ZONA_PROCESO = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (ZONA_PROCESO !== ZONA) {
  console.error('Correr con TZ=' + ZONA + ' (es la zona del Sheet y del script).');
  process.exit(2);
}

function esFecha(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

/* Lo que hace Sheets con un texto escrito en una celda sin formato @. */
function convertirComoSheets(v, formato) {
  if (typeof v !== 'string' || formato === '@') return v;
  let m;
  if ((m = /^(\d{4})-(\d{1,2})$/.exec(v))) return new Date(+m[1], +m[2] - 1, 1);
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(v))) return new Date(1899, 11, 30, +m[1], +m[2]);
  if (/^[+-]?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v);
  if (v.charAt(0) === '=') throw new Error('el simulador no evalúa fórmulas: «' + v + '»');
  return v;
}

class Rango {
  constructor(hoja, f, c, nf, nc) { Object.assign(this, { hoja, f, c, nf, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nf; i++) {
      const fila = [];
      for (let j = 0; j < this.nc; j++) {
        const v = this.hoja.celda(this.f + i, this.c + j);
        fila.push(esFecha(v) ? new Date(v.getTime()) : v);
      }
      out.push(fila);
    }
    return out;
  }
  setValues(m) {
    if (m.length !== this.nf || m.some(r => r.length !== this.nc))
      throw new Error('setValues: la matriz no coincide con el rango ' + this.nf + 'x' + this.nc);
    m.forEach((r, i) => r.forEach((v, j) => this.hoja.poner(this.f + i, this.c + j, v)));
    return this;
  }
  setValue(v) { this.hoja.poner(this.f, this.c, v); return this; }
  setNumberFormat(fmt) {
    for (let i = 0; i < this.nf; i++) for (let j = 0; j < this.nc; j++) this.hoja.formatos[(this.f + i) + ',' + (this.c + j)] = fmt;
    return this;
  }
  setFontWeight() { return this; }
  setFontSize() { return this; }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.datos = {}; this.formatos = {}; this.maxFilas = 1000; }
  getName() { return this.nombre; }
  celda(f, c) { const v = this.datos[f + ',' + c]; return v === undefined ? '' : v; }
  poner(f, c, v) {
    if (v === null || v === undefined) v = '';
    if (typeof v === 'boolean') v = v;   // Sheets guarda lógicos
    const conv = convertirComoSheets(v, this.formatos[f + ',' + c]);
    if (conv === '') delete this.datos[f + ',' + c]; else this.datos[f + ',' + c] = esFecha(conv) ? new Date(conv.getTime()) : conv;
    if (f > this.maxFilas) this.maxFilas = f;
  }
  getLastRow() { let m = 0; for (const k in this.datos) { const f = +k.split(',')[0]; if (f > m) m = f; } return m; }
  getLastColumn() { let m = 0; for (const k in this.datos) { const c = +k.split(',')[1]; if (c > m) m = c; } return m; }
  getMaxRows() { return this.maxFilas; }
  getRange(f, c, nf, nc) {
    if (!(f >= 1 && c >= 1)) throw new Error('getRange fuera de la hoja: ' + f + ',' + c);
    return new Rango(this, f, c, nf || 1, nc || 1);
  }
  getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows() {}
  setColumnWidth() {}
  /* Para las pruebas: la fila como texto plano. */
  fila(f) { const out = []; for (let c = 1; c <= this.getLastColumn(); c++) out.push(this.celda(f, c)); return out; }
}

class Libro {
  constructor(nombre, zona) { this.nombre = nombre; this.zona = zona || ZONA; this.hojas = []; }
  getName() { return this.nombre; }
  getSpreadsheetTimeZone() { return this.zona; }
  getSheetByName(n) { return this.hojas.find(h => h.nombre === n) || null; }
  insertSheet(n) {
    if (this.getSheetByName(n)) throw new Error('ya existe la hoja ' + n);
    const h = new Hoja(n); this.hojas.push(h); return h;
  }
  /* Para las pruebas: crear una hoja con títulos en la fila 1, como el Excel convertido. */
  hojaDesdeFilas(nombre, filas) {
    const h = this.insertSheet(nombre);
    filas.forEach((r, i) => r.forEach((v, j) => {
      // El Excel convertido trae el texto como texto: se marca @ para no convertirlo.
      h.formatos[(i + 1) + ',' + (j + 1)] = typeof v === 'string' ? '@' : undefined;
      h.poner(i + 1, j + 1, v);
    }));
    return h;
  }
}

function dos(n) { return ('0' + n).slice(-2); }

function crearEntorno(opciones) {
  opciones = opciones || {};
  const activo = opciones.libro || new Libro('VEA_AfterSchool_BD');
  const porId = opciones.porId || {};
  const props = Object.assign({}, opciones.propiedades || {});
  const registro = [];
  const estadoLock = { ocupado: !!opciones.lockOcupado, tomado: 0 };

  function exigirZona(z) {
    if (z !== ZONA_PROCESO) throw new Error('Utilities con zona ' + z + ' distinta de la del proceso ' + ZONA_PROCESO);
  }

  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => activo,
      openById: id => { if (!porId[id]) throw new Error('No se encontró el archivo ' + id); return porId[id]; },
      flush: () => {},
      getUi: () => { throw new Error('sin interfaz'); }
    },
    Utilities: {
      formatDate(d, z, patron) {
        exigirZona(z);
        if (!esFecha(d)) throw new Error('formatDate sin fecha');
        return patron.replace('yyyy', d.getFullYear()).replace('MM', dos(d.getMonth() + 1))
          .replace('dd', dos(d.getDate())).replace('HH', dos(d.getHours())).replace('mm', dos(d.getMinutes()))
          .replace('ss', dos(d.getSeconds()));
      },
      parseDate(s, z, patron) {
        exigirZona(z);
        if (patron !== 'yyyy-MM-dd') throw new Error('el simulador solo entiende yyyy-MM-dd');
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (!m) throw new Error('parseDate: ' + s);
        return new Date(+m[1], +m[2] - 1, +m[3]);   // Date desborda igual que Java: 31/02 → 03/03
      }
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (estadoLock.ocupado) return false; estadoLock.tomado++; return true; },
        waitLock: () => { if (estadoLock.ocupado) throw new Error('lock'); estadoLock.tomado++; },
        releaseLock: () => { estadoLock.tomado--; }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: s => ({ contenido: s, setMimeType() { return this; }, getContent() { return this.contenido; } })
    },
    HtmlService: { createHtmlOutput: () => { throw new Error('sin interfaz'); } },
    Session: { getScriptTimeZone: () => opciones.zonaScript || ZONA },
    Logger: { log: s => registro.push(String(s)) }
  };
  vm.createContext(ctx);
  const gs = opciones.gs || process.env.AS_GS || path.join(__dirname, '..', 'AfterSchool.gs');
  vm.runInContext(fs.readFileSync(gs, 'utf8'), ctx, { filename: 'AfterSchool.gs' });

  /* Atajo: llamar al puente como lo haría api.php. */
  ctx.llamar = function (accion, datos, extra) {
    const cuerpo = Object.assign({ key: props.AS_CLAVE_API, usuario: 'prueba', accion, datos: datos || {} }, extra || {});
    const salida = ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } });
    return JSON.parse(salida.getContent());
  };
  ctx._libro = activo;
  ctx._props = props;
  ctx._lock = estadoLock;
  ctx._registro = registro;
  return ctx;
}

module.exports = { crearEntorno, Libro, Hoja, ZONA };
