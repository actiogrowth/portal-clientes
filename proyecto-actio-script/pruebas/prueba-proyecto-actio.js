/* Pruebas de ProyectoActio.gs con un Sheet simulado (datos INVENTADOS).
 *
 *   node proyecto-actio-script/pruebas/prueba-proyecto-actio.js [otro.gs]
 *
 * Comprueba: lectura por TÍTULO (columnas desordenadas, títulos que no están
 * en la fila 1, columnas de más), fechas y porcentajes normalizados, que
 * «Origen duración» y «Notas» nunca salen, la clave y que solo existe «leer».
 * El primer argumento permite probar otra copia del .gs (la usa roturas.js).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GS = process.argv[2] || path.join(__dirname, '..', 'ProyectoActio.gs');
const CLAVE = 'clave-de-prueba-de-24-caracteres-o-mas';

let fallos = 0, total = 0;
const ok = (c, que) => { total++; if (!c) { fallos++; console.log('  ✗ ' + que); } };

/* Hojas inventadas. Entregables: los títulos en la fila 3 (encima, un título
   y una fila vacía) y en otro orden; una columna de más. */
const HOJAS = {
  'Entregables': [
    ['Hoja de ruta de prueba', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['ID', 'Proyecto', 'Entregable', 'Unidad de negocio', 'Columna de más', 'Segmento', 'Estado', '% Avance', 'Fecha compromiso', 'Fecha real', 'Visible para el cliente'],
    ['E-001', 'Proyecto 1', 'Plan inventado uno', 'Kinder', 'x', 'Ventas', 'Entregado', 1, new Date(2026, 2, 31), '31/03/2026', ''],
    ['E-002', 'Proyecto 1', 'Plan inventado dos', 'After School', 'x', 'Marketing', 'En curso', '45,5%', '', '', 'No'],
    ['E-101', 'Proyecto 2', 'Plan interno', 'Gerencia', 'x', 'Finanzas', 'Pendiente', '0%', '2026-11-30', '', 'Sí'],
    ['', '', '', '', '', '', '', '', '', '', '']
  ],
  'Documentos VEA': [
    ['Enlace', 'Nombre', 'ID Entregable', 'Tipo', 'Unidad de negocio', 'Segmento', 'Fecha'],
    ['https://ejemplo.test/a', 'Plan inventado uno (Documento)', 'E-001', 'Entregable', 'Kinder', 'Ventas', new Date(2026, 3, 2)],
    ['https://ejemplo.test/b', 'Plan inventado uno (Presentación)', 'E-001', 'Entregable', 'Kinder', 'Ventas', '02/04/2026']
  ],
  'Reuniones VEA': [
    ['Tema', 'Fecha', 'Grabación', 'Minuta'],
    ['Reunión inventada', new Date(2026, 6, 22), '', 'https://ejemplo.test/minuta']
  ],
  'Atención directa': [   // otro uso de mayúsculas: se encuentra igual
    ['Fecha', 'Tipo', 'Duración (min)', 'Origen duración', 'Asunto', 'Unidad de negocio', 'Enlace', 'Notas'],
    ['23/02/2026', 'Llamada', 12, 'Medida', 'Consulta inventada', '', '', 'NOTA INTERNA DE ACTIO'],
    [new Date(2026, 1, 24), 'Reunión virtual', '45', 'Estimada', 'Sesión inventada', 'Kinder', '', '']
  ]
};

function cargar(hojas, props) {
  const src = fs.readFileSync(GS, 'utf8');
  const hojasObj = Object.entries(hojas).map(([nombre, vals]) => ({
    getName: () => nombre,
    getDataRange: () => ({ getValues: () => vals.map(f => f.slice()) })
  }));
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => hojasObj }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props || {})[k] || null }) },
    ContentService: { createTextOutput: t => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Date, JSON, Math, String, Number, Object, Array, isNaN, parseFloat
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}
const pedir = (ctx, p) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(p) } }).texto);

const ctx = cargar(HOJAS, { PA_CLAVE_API: CLAVE });
const r = pedir(ctx, { key: CLAVE, usuario: 'cuenta-prueba', accion: 'leer', datos: {} });

console.log('· lectura por títulos');
ok(r.ok === true, 'leer responde ok (' + (r.error || '') + ')');
const R = r.resultado || {};
ok(Array.isArray(R.faltan) && R.faltan.length === 0, 'no falta ninguna columna obligatoria (' + JSON.stringify(R.faltan) + ')');
ok(R.entregables && R.entregables.length === 3, 'tres entregables: encuentra los títulos en la fila 3 y salta las filas vacías');
const e1 = (R.entregables || []).find(e => e.id === 'E-001') || {};
ok(e1.entregable === 'Plan inventado uno' && e1.unidad === 'Kinder' && e1.proyecto === 'Proyecto 1' && e1.segmento === 'Ventas',
  'cada valor sale de su columna por título, aunque estén en otro orden');
ok(!('Columna de más' in e1) && !Object.values(e1).includes('x'), 'una columna que no está en el contrato no sale');
ok(e1.fechaCompromiso === '2026-03-31' && e1.fechaReal === '2026-03-31', 'fechas a AAAA-MM-DD (de fecha y de texto dd/mm/aaaa)');
ok(e1.avance === 100, '% Avance 1 (celda con formato) → 100');
ok(((R.entregables || []).find(e => e.id === 'E-002') || {}).avance === 45.5, '% Avance «45,5%» → 45.5');
ok(((R.entregables || []).find(e => e.id === 'E-101') || {}).fechaCompromiso === '2026-11-30', 'fecha ya en AAAA-MM-DD se respeta');
ok(R.entregables.some(e => e.proyecto === 'Proyecto 2'), 'el script manda Proyecto 2: el recorte por rol es del portal');
const d = R.documentos || [];
ok(d.length === 2 && d[0].nombre === 'Plan inventado uno (Documento)' && d[0].enlace === 'https://ejemplo.test/a' && d[0].idEntregable === 'E-001', 'documentos por título');
ok(d[1].fecha === '2026-04-02' && d[0].fecha === '2026-04-02', 'fecha de documento normalizada');
ok(d[0].proyecto === '', 'sin columna Proyecto en Documentos, el campo va vacío (el portal lo toma del entregable)');
const reu = (R.reuniones || [])[0] || {};
ok(reu.tema === 'Reunión inventada' && reu.fecha === '2026-07-22' && reu.minuta === 'https://ejemplo.test/minuta' && reu.grabacion === '', 'reuniones por título');

console.log('· «Visible para el cliente» (opcional)');
const vis = id => ((R.entregables || []).find(e => e.id === id) || {}).visibleCliente;
ok(vis('E-001') === '' && vis('E-002') === 'No' && vis('E-101') === 'Sí', 'se lee por título en Entregables');
ok(d.every(x => x.visibleCliente === ''), 'en Documentos VEA, sin la columna, sale vacío (rige la regla por proyecto)');

console.log('· atención directa: lo interno de Actio no sale');
const a = R.atencion || [];
ok(a.length === 2, 'dos registros (la pestaña se encuentra sin importar mayúsculas)');
ok(a[0].duracionMin === 12 && a[1].duracionMin === 45, 'Duración (min) como número');
ok(a[0].fecha === '2026-02-23' && a[1].fecha === '2026-02-24', 'fechas normalizadas');
ok(!JSON.stringify(a).includes('NOTA INTERNA') && !JSON.stringify(a).includes('Medida') && !JSON.stringify(a).includes('Estimada'),
  'nunca salen «Notas» ni «Origen duración»');
ok(a.every(x => !('notas' in x) && !('origen' in x) && !('origenDuracion' in x)), 'ni siquiera como campo vacío');

console.log('· clave y acciones');
ok(pedir(ctx, { key: 'otra', usuario: 'x', accion: 'leer' }).codigo === 'no_autorizado', 'clave equivocada: no_autorizado');
ok(pedir(ctx, { key: CLAVE, usuario: '', accion: 'leer' }).codigo === 'no_autorizado', 'sin usuario: no_autorizado');
ok(pedir(ctx, { key: CLAVE, usuario: 'x', accion: 'guardar' }).ok === false, 'cualquier otra acción se rechaza (solo lectura)');
ok(pedir(cargar(HOJAS, {}), { key: CLAVE, usuario: 'x', accion: 'leer' }).codigo === 'sin_clave', 'sin PA_CLAVE_API: sin_clave');
ok(pedir(cargar(HOJAS, { PA_CLAVE_API: 'corta' }), { key: 'corta', usuario: 'x', accion: 'leer' }).codigo === 'sin_clave', 'clave de menos de 24: sin_clave');
ok(!/[A-Za-z0-9_-]{30,}\/exec|script\.google\.com\/macros/.test(fs.readFileSync(GS, 'utf8')), 'el .gs no lleva direcciones /exec');

console.log('· columnas obligatorias que faltan');
const sinEnlace = JSON.parse(JSON.stringify(HOJAS, (k, v) => v instanceof Date ? v.toISOString() : v));
sinEnlace['Documentos VEA'] = [['Nombre', 'Fecha'], ['Algo', '']];
const r2 = pedir(cargar(sinEnlace, { PA_CLAVE_API: CLAVE }), { key: CLAVE, usuario: 'x', accion: 'leer' });
ok(r2.ok && r2.resultado.documentos.length === 0 && r2.resultado.faltan.includes('Documentos VEA: Enlace'), 'sin Enlace: documentos vacío y «faltan» lo dice');
const sinHoja = Object.assign({}, HOJAS); delete sinHoja['Reuniones VEA'];
const r3 = pedir(cargar(sinHoja, { PA_CLAVE_API: CLAVE }), { key: CLAVE, usuario: 'x', accion: 'leer' });
ok(r3.ok && r3.resultado.reuniones.length === 0 && r3.resultado.faltan.some(f => /Reuniones VEA/.test(f)), 'sin la pestaña: tabla vacía y aviso');

console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallan' : '✓ ' + total + ' comprobaciones pasan');
process.exit(fallos ? 1 : 0);
