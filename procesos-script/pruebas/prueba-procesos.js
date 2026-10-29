/* Pruebas de Procesos.gs con un Sheet simulado (datos INVENTADOS, sin
 * nombres de personas).
 *
 *   node procesos-script/pruebas/prueba-procesos.js [otro.gs]
 *
 * Comprueba: lectura por TÍTULO (títulos fuera de la fila 1, columnas en otro
 * orden, columnas de más), la clave, las acciones que existen, que solo se
 * escribe al final de Aceptaciones, Marcas y Revisiones (las demás pestañas no
 * cambian), el período que calcula el script según «Cada cuánto», la versión
 * vigente al aceptar y que nada se escribe en un puesto que no está abierto.
 * El primer argumento permite probar otra copia del .gs (la usa roturas.js).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GS = process.argv[2] || path.join(__dirname, '..', 'Procesos.gs');
const CLAVE = 'clave-de-prueba-de-24-caracteres-o-mas';
const AHORA = new Date(2026, 9, 28, 10, 30);   // miércoles 28-oct-2026: semana ISO 44

let fallos = 0, total = 0;
const ok = (c, que) => { total++; if (!c) { fallos++; console.log('  ✗ ' + que); } };
const seccion = t => console.log('· ' + t);

const HOJAS = () => ({
  'Léeme': [['Tema', 'Detalle'], ['Qué es', 'Hoja de prueba']],
  'Puestos': [   // títulos en la fila 2, columnas en otro orden y una de más
    ['Puestos de prueba', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Puesto', 'ID', 'Estado', 'Área', 'Unidad', 'Reporta a', 'Cantidad', 'Columna de más', 'Versión', 'Fecha versión', 'Verifica', 'Cómo verifica', 'Visible solo para'],
    ['Dirección inventada', 'DIR', 'Por cargar', 'Dirección', 'Todas', '', '', 'x', '', '', '', '', ''],
    ['Coordinación inventada', 'COO', 'Abierto al equipo', 'Unidad A', 'Unidad A', 'DIR', '', 'x', 2, new Date(2026, 9, 20), 'Dirección, cada semana', 'Con el registro de prueba', ''],
    ['Recepción inventada', 'REC', 'Abierto al equipo', 'Unidad A', 'Unidad A', 'COO', '2 personas', 'x', '1', '2026-10-20', 'Dirección, cada semana', '', ' usuario-de-prueba '],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],   // una fila vacía en medio: se salta
    ['Administración inventada', 'ADM', 'Borrador', 'Administración', 'Todas', 'DIR', '', 'x', 1, '', 'Dirección, cada semana', '', '']
  ],
  'Contratos': [
    ['Puesto ID', 'Sección', 'Orden', 'Texto'],
    ['COO', 'Resultado', 1, 'Resultado de prueba'],
    ['COO', 'Trabajo', 2, 'Trabajo dos'],
    ['COO', 'Trabajo', 1, 'Trabajo uno'],
    ['COO', 'Estándar', 1, 'Estándar uno'],
    ['ADM', 'Resultado', 1, 'Resultado de un borrador']
  ],
  'Listas': [
    ['Orden', 'Puesto ID', 'Qué se verifica', 'Evidencia', 'Cada cuánto'],
    [1, 'COO', 'Punto diario', 'registro', 'Diario'],
    [2, 'COO', 'Punto semanal', 'registro', 'Semanal'],
    [3, 'COO', 'Punto mensual', 'registro', 'Mensual'],
    [4, 'COO', 'Punto de temporada', 'registro', 'Por temporada'],
    [5, 'COO', 'Punto cuando aplica', 'registro', 'Cuando aplica'],
    [6, 'COO', 'Punto por persona nueva', 'registro', 'Por persona nueva'],
    [7, 'COO', 'Punto con frecuencia rara', 'registro', 'Cada luna'],
    // 30-oct (v4): las frecuencias nuevas (con mayúsculas, tildes y espacios de más, como pueden venir del Sheet).
    [8, 'COO', 'Punto quincenal', 'registro', 'Quincenal'],
    [9, 'COO', 'Punto trimestral', 'registro', 'Trimestral'],
    [10, 'COO', 'Punto cada 4 meses', 'registro', 'Cada 4 meses'],
    [11, 'COO', 'Punto por cumpleaños', 'registro', 'Por cumpleaños'],
    [12, 'COO', 'Punto por pago', 'registro', 'POR  pago'],
    [13, 'COO', 'Punto cada rotación', 'registro', 'Cada rotacion'],
    [14, 'COO', 'Punto cada cambio de tema', 'registro', 'Cada cambio de tema'],
    [1, 'ADM', 'Punto de un borrador', 'registro', 'Diario']
  ],
  'Procesos': [['Puesto ID', 'Proceso', 'Descripción', 'Enlace', 'Estado'], ['COO', 'Proceso de prueba', 'Descripción', '/biblioteca/x.html', 'Listo']],
  'Asignaciones': [['Usuario del portal', 'Puesto ID', 'Desde', 'Hasta'], ['Usuario del rol Coordinación After School', 'COO', new Date(2026, 9, 1), '']],
  'Aceptaciones': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Versión']],
  'Marcas': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Orden del punto', 'Período', 'Resultado', 'Nota']],
  'Revisiones': [['Fecha y hora', 'Revisor', 'Puesto ID', 'Período', 'Sorpresa', 'Resultado', 'Nota']],
  // 26-oct: un mes que Sheets ya convirtió en fecha y un año que quedó como número.
  'Metas': [['Cifra', 'Unidad', 'Período', 'Valor', 'Estado'], ['Ocupación', 'Preschool', new Date(2026, 9, 1), 70, 'Tentativa'],
    ['Bajas', 'After School', 2026, '3', 'Confirmada'], ['Altas', 'Negocio', '2026-10', 12, '']],
  // 29-oct: las tres pestañas nuevas. Una hora que Sheets ya convirtió en hora (fecha de 1899) y otra escrita como texto.
  'Hojas': [['Puesto ID', 'Hoja', 'Orden', 'Momento', 'Paso'],
    ['COO', 'Cierre de prueba', 1, 'Antes de la salida', 'Paso uno'], ['COO', 'Cierre de prueba', 2, 'Antes de la salida', 'Paso dos'],
    ['COO', 'Cierre de prueba', 3, 'Al final', 'Paso tres'], ['ADM', 'Hoja de un borrador', 1, 'Mañana', 'Paso de borrador'],
    ['FANTASMA', 'Hoja huérfana', 1, 'Mañana', 'Paso de un puesto que no existe']],
  'Reglas del juego': [['Sección', 'Orden', 'Texto'], ['La idea', 2, 'Segunda'], ['La idea', 1, 'Primera'], ['Cómo se juega', 1, 'Una regla']],
  'Horarios del servicio': [['Momento', 'Unidad', 'Hora', 'Puestos que lo usan'],
    ['Cambio de prueba', 'Unidad A', new Date(1899, 11, 30, 10, 0), 'COO'], ['Reporte de prueba', 'Unidad A', '2:00 p. m.', 'COO, REC']]
});

/* Una hoja en memoria. Una celda sin formato de texto convierte «2026-10» y «2026-10-28» en fecha, como Sheets. */
function hojaFalsa(nombre, vals) {
  const formatos = {};
  const conv = (v, f) => {
    if (typeof v !== 'string' || f === '@') return v;
    let m;
    if ((m = /^(\d{4})-(\d{2})$/.exec(v))) return new Date(+m[1], +m[2] - 1, 1);
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  };
  const h = {
    vals, formatos, escrituras: 0,
    getName: () => nombre, validaciones: {}, congeladas: 0,
    setFrozenRows: n => { h.congeladas = n; },
    getDataRange: () => ({ getValues: () => vals.map(f => f.slice()),
      // Como se ve en el Sheet: una hora (fecha de 1899) como «10:00»; lo demás, como texto.
      getDisplayValues: () => vals.map(f => f.map(v => v instanceof Date ? (v.getFullYear() === 1899 ? v.getHours() + ':' + ('0' + v.getMinutes()).slice(-2) : String(v)) : v == null ? '' : String(v))) }),
    getLastRow: () => vals.length,
    deleteRow: n => { h.borradas = (h.borradas || 0) + 1; vals.splice(n - 1, 1); },
    getRange: (r, c, nr, nc) => ({
      setNumberFormat: fmt => { for (let i = 0; i < (nr || 1); i++) for (let j = 0; j < (nc || 1); j++) formatos[(r + i) + ',' + (c + j)] = fmt; return this; },
      setDataValidation: regla => { h.validaciones[c] = { desde: r, filas: nr, valores: regla.valores, invalidos: regla.invalidos }; },
      setValues: m => {
        h.escrituras++;
        m.forEach((fila, i) => { while (vals.length < r + i) vals.push([]); const dest = vals[r + i - 1]; fila.forEach((v, j) => { dest[c + j - 1] = conv(v, formatos[(r + i) + ',' + (c + j)]); }); });
      }
    })
  };
  return h;
}

function cargar(props, hojas) {
  hojas = hojas || HOJAS();
  const objs = Object.entries(hojas).map(([n, v]) => hojaFalsa(n, v));
  const libro = { getSheets: () => objs, getSpreadsheetTimeZone: () => 'America/Panama',
    insertSheet: n => { const h = hojaFalsa(n, []); objs.push(h); return h; } };
  const registro = [];
  class DateFija extends Date { constructor(...a) { if (a.length) super(...a); else super(AHORA.getTime()); } static now() { return AHORA.getTime(); } }
  const two = n => ('0' + n).slice(-2);
  const lock = { tomado: 0, ocupado: false };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro, newDataValidation: () => {
      const r = { valores: null, invalidos: true };
      const b = { requireValueInList: v => { r.valores = v.slice(); return b; }, setAllowInvalid: x => { r.invalidos = x; return b; }, build: () => r };
      return b; } },
    Logger: { log: t => registro.push(t) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props || {})[k] || null }) },
    ContentService: { createTextOutput: t => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lock.ocupado) return false; lock.tomado++; return true; }, releaseLock: () => { lock.tomado--; } }) },
    Utilities: { formatDate: (d, z, p) => p.replace('yyyy', d.getFullYear()).replace('MM', two(d.getMonth() + 1)).replace('dd', two(d.getDate()))
      .replace("'T'", 'T').replace('HH', two(d.getHours())).replace('mm', two(d.getMinutes())) },
    Date: DateFija, JSON, Math, String, Number, Object, Array, isNaN, parseFloat
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(GS, 'utf8'), ctx, { filename: 'Procesos.gs' });
  const llamar = (accion, datos, extra) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ key: CLAVE, usuario: 'usuario-de-prueba', accion, datos: datos || {} }, extra || {})) } }).texto);
  const hoja = n => objs.find(h => h.getName() === n);
  return { llamar, hoja, lock, ctx, registro, objs };
}
const P = { PR_CLAVE_API: CLAVE };

seccion('clave y acciones');
{
  ok(/no tiene clave/.test(cargar({}).llamar('leer').error), 'sin PR_CLAVE_API: se niega');
  ok(/no tiene clave/.test(cargar({ PR_CLAVE_API: 'corta' }).llamar('leer').error), 'con una clave corta: se niega');
  const g = cargar(P);
  ok(g.llamar('leer', {}, { key: 'otra' }).error === 'Clave incorrecta.', 'clave incorrecta: se niega');
  ok(/usuario/.test(g.llamar('leer', {}, { usuario: '' }).error), 'sin usuario: se niega');
  ok(g.llamar('borrarTodo').codigo === 'sin_permiso', 'una acción que no existe: se niega');
}

seccion('leer: por título, con todas las pestañas');
{
  const g = cargar(P), r = g.llamar('leer');
  ok(r.ok && r.resultado.faltan.length === 2 && /Cada luna/.test(r.resultado.faltan[0]) && /Hojas: el puesto «FANTASMA» no está en Puestos/.test(r.resultado.faltan[1]),
    'lee; solo avisa el «Cada cuánto» desconocido y el puesto de Hojas que no está en Puestos; la pestaña Marcas de hojas que todavía no existe no se avisa (' + JSON.stringify(r.resultado && r.resultado.faltan) + ')');
  const R = r.resultado, coo = R.puestos.find(p => p.id === 'COO');
  const perLeer = R.listas.filter(x => x.puesto === 'COO').map(x => x.orden + '=' + x.periodo).join(' ');
  ok(perLeer === '1=2026-10-28 2=2026-S44 3=2026-10 4=2026 5=2026-10-28 6=2026-10-28 7= 8=2026-10-Q2 9=2026-T4 10=2026-C3 11=2026-10-28 12=2026-10-28 13=2026-10-28 14=2026-10-28',
    'cada punto trae su período en curso; Quincenal, Trimestral, Cada 4 meses y los de por evento también (' + perLeer + ')');
  const grupos = R.listas.filter(x => x.puesto === 'COO').map(x => x.orden + ':' + x.grupo + ':' + x.grupoOrden).join(' | ');
  ok(grupos === '1:Diario:1 | 2:Semanal:2 | 3:Mensual:4 | 4:Por temporada:7 | 5:Cada vez que ocurre:8 | 6:Cada vez que ocurre:8 | 7:Cada luna:99 | 8:Quincenal:3 | 9:Trimestral:5 | 10:Cada 4 meses:6 | ' +
    '11:Cada vez que ocurre:8 | 12:Cada vez que ocurre:8 | 13:Cada vez que ocurre:8 | 14:Cada vez que ocurre:8',
    'cada punto trae su grupo y el orden del grupo; uno desconocido, su propio texto y al final (' + grupos + ')');
  ok(R.listas.find(x => x.orden === 11).frecuencia === 'Por cumpleaños', 'el punto conserva su «Cada cuánto» original');
  ok(R.puestos.length === 4 && coo.puesto === 'Coordinación inventada' && coo.reportaA === 'DIR' && coo.version === 2 && coo.fechaVersion === '2026-10-20',
    'Puestos: títulos en la fila 2, columnas en otro orden; versión como número y fecha como AAAA-MM-DD');
  ok(R.puestos.find(p => p.id === 'REC').version === 1 && R.puestos.find(p => p.id === 'DIR').version === null, 'versión escrita como texto o vacía');
  ok(!('columna de mas' in coo) && Object.keys(coo).sort().join() === 'area,cantidad,comoVerifica,estado,fechaVersion,id,puesto,reportaA,soloPara,unidad,verifica,version', 'solo los campos del contrato');
  ok(R.puestos.find(p => p.id === 'REC').soloPara === 'usuario-de-prueba' && coo.soloPara === '', '«Visible solo para» llega tal cual (sin espacios de más); vacía, vacía');
  const sinCol = HOJAS(); sinCol['Puestos'] = sinCol['Puestos'].map(f => f.slice(0, 12));
  const rs = cargar(P, sinCol).llamar('leer').resultado;
  ok(rs.puestos.length === 4 && rs.puestos.every(p => p.soloPara === '') && rs.faltan.length === 2, 'sin la columna «Visible solo para» (opcional): todos vacíos y no se avisa nada');
  ok(R.contratos.length === 5 && R.listas.length === 15 && R.procesos.length === 1 && R.asignaciones[0].desde === '2026-10-01', 'Contratos, Listas, Procesos y Asignaciones');
  ok(R.hoy === '2026-10-28' && R.version === 'v4', 'hoy (en la zona del archivo) y la versión del script');
  ok(JSON.stringify(R.metas) === JSON.stringify([{ cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026-10', valor: 70, estado: 'Tentativa' },
    { cifra: 'Bajas', unidad: 'After School', periodo: '2026', valor: 3, estado: 'Confirmada' }, { cifra: 'Altas', unidad: 'Negocio', periodo: '2026-10', valor: 12, estado: '' }]),
    'Metas: un mes que Sheets volvió fecha se lee como mes; un año escrito como número, como año (' + JSON.stringify(R.metas) + ')');
  ok(JSON.stringify(R.horarios) === JSON.stringify([{ momento: 'Cambio de prueba', unidad: 'Unidad A', hora: '10:00', puestos: 'COO' }, { momento: 'Reporte de prueba', unidad: 'Unidad A', hora: '2:00 p. m.', puestos: 'COO, REC' }]),
    'Horarios: la hora como se ve en el Sheet, aunque Sheets la haya vuelto hora (' + JSON.stringify(R.horarios) + ')');
  ok(R.reglas.length === 3 && R.reglas[0].seccion === 'La idea' && R.reglas[0].orden === 2 && R.hojas.length === 5 && R.hojas[0].momento === 'Antes de la salida' && R.hojas[0].paso === 'Paso uno',
    'Reglas del juego y Hojas, con sus columnas');
  ok(Array.isArray(R.marcasHojas) && R.marcasHojas.length === 0, 'sin la pestaña Marcas de hojas: lista vacía');
  const sinMarcas = HOJAS(); delete sinMarcas['Marcas'];
  ok(cargar(P, sinMarcas).llamar('leer').resultado.faltan.some(f => /Marcas/.test(f)), 'una pestaña que falta se informa en «faltan»');
}

seccion('aceptar: solo un puesto abierto y con su versión vigente');
{
  const g = cargar(P), A = g.hoja('Aceptaciones');
  let r = g.llamar('aceptar', { puesto: 'COO', version: 1 });
  ok(!r.ok && r.codigo === 'version_vieja' && A.vals.length === 1, 'con una versión vieja: se niega y no escribe');
  r = g.llamar('aceptar', { puesto: 'ADM', version: 1 });
  ok(!r.ok && r.codigo === 'no_abierto' && A.vals.length === 1, 'un puesto en Borrador: se niega');
  r = g.llamar('aceptar', { puesto: 'NADA', version: 1 });
  ok(!r.ok && r.codigo === 'no_existe', 'un puesto que no existe: se niega');
  r = g.llamar('aceptar', { puesto: 'COO', version: 2 });
  ok(r.ok && A.vals.length === 2 && A.vals[1][1] === 'usuario-de-prueba' && A.vals[1][2] === 'COO' && A.vals[1][3] === '2' && Object.prototype.toString.call(A.vals[1][0]) === '[object Date]',
    'acepta: fecha y hora, usuario, puesto y versión (como texto)');
  ok(g.lock.tomado === 0, 'el candado se suelta');
}

seccion('marcar: el período lo calcula el script según «Cada cuánto»');
{
  const g = cargar(P), M = g.hoja('Marcas');
  const marcas = [1, 2, 3, 4, 5, 6].map(o => ({ orden: o, resultado: o === 2 ? 'No' : 'Cumplido', nota: o === 2 ? 'falta un dato' : '' }));
  let r = g.llamar('marcar', { puesto: 'COO', marcas, periodo: '2020-01' });   // el período del navegador se ignora
  ok(r.ok, 'marca seis puntos (' + (r.error || '') + ')');
  const per = M.vals.slice(1).map(f => f[3] + '=' + f[4]).join(' ');
  ok(per === '1=2026-10-28 2=2026-S44 3=2026-10 4=2026 5=2026-10-28 6=2026-10-28',
    'Diario, Cuando aplica y Por persona nueva → el día; Semanal → la semana ISO; Mensual → el mes; Por temporada → el año (' + per + ')');
  ok(M.vals.slice(1).every(f => typeof f[4] === 'string'), 'el período queda como texto (Sheets no lo convierte en fecha)');
  ok(M.vals[2][5] === 'No' && M.vals[2][6] === 'falta un dato' && M.vals[2][1] === 'usuario-de-prueba', 'resultado, nota y usuario');
  r = g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'No' }] });
  ok(r.ok && M.vals.length === 8 && M.vals[1][5] === 'Cumplido', 'corregir agrega una marca nueva; la anterior queda');
  const antes = M.vals.length;
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 99, resultado: 'Cumplido' }] }).codigo === 'punto', 'un punto que no es del puesto: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Tal vez' }] }).codigo === 'resultado', 'resultado inválido: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'No' }, { orden: 1, resultado: 'No' }] }).codigo === 'punto', 'el mismo punto dos veces: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 7, resultado: 'No' }] }).codigo === 'frecuencia', '«Cada cuánto» desconocido: se niega y lo dice');
  ok(g.llamar('marcar', { puesto: 'ADM', marcas: [{ orden: 1, resultado: 'No' }] }).codigo === 'no_abierto', 'un puesto en Borrador: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [] }).codigo === 'vacia', 'sin marcas: se niega');
  ok(M.vals.length === antes, 'ninguna marca rechazada se escribió (ni a medias)');
  // 30-oct (v4): se marcan las frecuencias nuevas, cada una con su período.
  r = g.llamar('marcar', { puesto: 'COO', marcas: [8, 9, 10, 11, 12, 13, 14].map(o => ({ orden: o, resultado: 'Cumplido' })) });
  const nuevos = M.vals.slice(antes).map(f => f[3] + '=' + f[4]).join(' ');
  ok(r.ok && nuevos === '8=2026-10-Q2 9=2026-T4 10=2026-C3 11=2026-10-28 12=2026-10-28 13=2026-10-28 14=2026-10-28',
    'Quincenal → la quincena; Trimestral → el trimestre; Cada 4 meses → el cuatrimestre; por evento → el día (' + (r.error || nuevos) + ')');
}

seccion('períodos (v4): los bordes de cada forma, y nada que no encaje');
{
  const g = cargar(P), per = (f, iso) => { try { return g.ctx.periodoDe_(f, iso); } catch (e) { return 'ERROR'; } };
  ok(per('Quincenal', '2026-10-15') === '2026-10-Q1' && per('Quincenal', '2026-10-16') === '2026-10-Q2' && per('Quincenal', '2026-02-28') === '2026-02-Q2' && per('quincenal', '2026-01-01') === '2026-01-Q1',
    'Quincenal: del 1 al 15 es Q1; del 16 a fin de mes, Q2');
  ok(per('Trimestral', '2026-03-31') === '2026-T1' && per('Trimestral', '2026-04-01') === '2026-T2' && per('Trimestral', '2026-09-30') === '2026-T3' && per('Trimestral', '2026-12-31') === '2026-T4',
    'Trimestral: T1 a T4');
  ok(per('Cada 4 meses', '2026-04-30') === '2026-C1' && per('Cada 4 meses', '2026-05-01') === '2026-C2' && per('Cada 4 meses', '2026-08-31') === '2026-C2' && per('cada 4 MESES', '2026-09-01') === '2026-C3',
    'Cada 4 meses: enero a abril C1, mayo a agosto C2, septiembre a diciembre C3');
  ok(['Por reembolso', 'Por niño nuevo', 'Por reposición', 'Cuando aplica', 'Por persona nueva', 'Cada rotación', 'Cada cambio de tema'].every(f => per(f, '2026-10-28') === '2026-10-28'),
    'por evento (Por …, Cada rotación, Cada cambio de tema, Cuando aplica, Por persona nueva) → el día');
  ok(per('Por temporada', '2026-10-28') === '2026', '«Por temporada» sigue siendo el año (no es por evento)');
  ok(['Por', 'Porción diaria', 'Cada luna', 'Cada rotaciones', 'Bimestral', ''].every(f => per(f, '2026-10-28') === 'ERROR'), 'lo que no encaja en ninguna regla se sigue rechazando');
  const v = p => g.ctx.periodoValido_(p);
  ok(['2026', '2026-10', '2026-10-28', '2026-S44', '2026-10-Q1', '2026-10-Q2', '2026-T1', '2026-T4', '2026-C1', '2026-C3'].every(v), 'períodos válidos: año, mes, día, semana, quincena, trimestre y cuatrimestre');
  ok(!['2026-10-Q3', '2026-T5', '2026-T0', '2026-C4', '2026-13', '2026-10-32', '2026-S54', '2026-Q1', '2026-10-28-Q1', 'ayer', '2026-10-T1'].some(v), 'y nada más');
}

{
}

seccion('revisar');
{
  const g = cargar(P), R = g.hoja('Revisiones');
  let r = g.llamar('revisar', { puesto: 'COO', periodo: '2026-S44', sorpresa: 'Sí', resultado: 'Cumplido', nota: 'bien' });
  ok(r.ok && R.vals.length === 2 && R.vals[1][1] === 'usuario-de-prueba' && R.vals[1][3] === '2026-S44' && R.vals[1][4] === 'Sí' && R.vals[1][5] === 'Cumplido', 'registra revisor, período, sorpresa, resultado y nota');
  ok(g.llamar('revisar', { puesto: 'COO', periodo: '2026-10', sorpresa: 'No', resultado: 'No' }).ok && typeof R.vals[2][3] === 'string', 'un período mensual queda como texto');
  ok(g.llamar('revisar', { puesto: 'COO', periodo: 'ayer', sorpresa: 'No', resultado: 'No' }).codigo === 'periodo', 'período inválido: se niega');
  ok(g.llamar('revisar', { puesto: 'COO', periodo: '2026-10', sorpresa: 'Quizás', resultado: 'No' }).codigo === 'sorpresa', 'sorpresa inválida: se niega');
  ok(g.llamar('revisar', { puesto: 'ADM', periodo: '2026-10', sorpresa: 'No', resultado: 'No' }).codigo === 'no_abierto', 'un puesto en Borrador: se niega');
}

seccion('marcarHoja: un paso hoy, con la hora del servidor y las iniciales');
{
  const g = cargar(P);
  ok(!g.hoja('Marcas de hojas'), '(control) todavía no existe la pestaña Marcas de hojas');
  let r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'cierre DE prueba', orden: 2, marcado: true, iniciales: 'j.p.' });
  const MH = g.hoja('Marcas de hojas');
  ok(r.ok && MH && JSON.stringify(MH.vals[0]) === JSON.stringify(['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden', 'Iniciales']) && MH.congeladas === 1,
    'la primera marca crea la pestaña con sus títulos (' + (r.error || '') + ')');
  ok(MH.vals.length === 2 && MH.vals[1][1] === 'usuario-de-prueba' && MH.vals[1][2] === 'COO' && MH.vals[1][3] === 'Cierre de prueba' && MH.vals[1][4] === 2 && MH.vals[1][5] === 'JP' &&
    Object.prototype.toString.call(MH.vals[1][0]) === '[object Date]', 'fecha y hora, usuario, puesto, la hoja con su nombre del Sheet, el paso e iniciales limpias');
  ok(r.ok && JSON.stringify(r.resultado.marcas) === JSON.stringify([{ orden: 2, fecha: '2026-10-28T10:30', usuario: 'usuario-de-prueba', iniciales: 'JP' }]) && r.resultado.hoy === '2026-10-28',
    'responde las marcas de hoy de esa hoja (' + JSON.stringify(r.resultado) + ')');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 2, marcado: true, iniciales: 'XX' });
  ok(r.ok && MH.vals.length === 2, 'marcar otra vez un paso ya marcado hoy no lo repite');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 3, marcado: true }, { usuario: 'otra-persona' });
  ok(r.ok && MH.vals.length === 3 && MH.vals[2][5] === 'OT', 'sin iniciales: las dos primeras letras del usuario');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 3, marcado: false });
  ok(!r.ok && r.codigo === 'ajena' && MH.vals.length === 3, 'nadie desmarca el paso que marcó otra persona');
  MH.vals.push([new Date(2026, 9, 27, 18, 0), 'usuario-de-prueba', 'COO', 'Cierre de prueba', 1, 'JP']);   // una marca de AYER
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 1, marcado: false });
  ok(r.ok && MH.vals.length === 4, 'una marca de ayer no se desmarca (solo el mismo día)');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 1, marcado: true });
  ok(r.ok && MH.vals.length === 5 && r.resultado.marcas.map(m => m.orden).sort().join() === '1,2,3', 'la marca de ayer no cuenta como de hoy: el paso se marca de nuevo');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 2, marcado: false });
  ok(r.ok && MH.vals.length === 4 && MH.borradas === 1 && !MH.vals.some(f => f[4] === 2) && r.resultado.marcas.map(m => m.orden).sort().join() === '1,3', 'desmarcar el mismo día borra solo esa marca, la propia');
  r = g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 2, marcado: false });
  ok(r.ok && MH.vals.length === 4, 'desmarcar un paso sin marca no hace nada');
  const antes = MH.vals.length;
  ok(g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 9, marcado: true }).codigo === 'paso', 'un paso que no es de la hoja: se niega');
  ok(g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Otra hoja', orden: 1, marcado: true }).codigo === 'hoja', 'una hoja que el puesto no tiene: se niega');
  ok(g.llamar('marcarHoja', { puesto: 'COO', hoja: '', orden: 1, marcado: true }).codigo === 'hoja', 'sin hoja: se niega');
  ok(g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 1, marcado: 'si' }).codigo === 'marcado', 'sin decir marcar o desmarcar: se niega');
  ok(g.llamar('marcarHoja', { puesto: 'ADM', hoja: 'Hoja de un borrador', orden: 1, marcado: true }).codigo === 'no_abierto', 'un puesto en Borrador: se niega');
  ok(MH.vals.length === antes, 'nada rechazado se escribió');
  ok(g.llamar('leer').resultado.marcasHojas.length === 3, 'leer trae las marcas de hojas (también la de ayer)');
}

seccion('revisar una hoja: período = el día; la nota empieza con Hoja «…»');
{
  const g = cargar(P), R = g.hoja('Revisiones');
  let r = g.llamar('revisar', { puesto: 'COO', hoja: 'cierre de prueba', sorpresa: 'No', resultado: 'Cumplido', nota: 'todo en orden' });
  ok(r.ok && R.vals[1][3] === '2026-10-28' && R.vals[1][6] === 'Hoja «Cierre de prueba» · todo en orden', 'sin período: hoy; la nota con el nombre de la hoja (' + JSON.stringify(R.vals[1]) + ')');
  r = g.llamar('revisar', { puesto: 'COO', hoja: 'Cierre de prueba', periodo: '2026-10-27', sorpresa: 'Sí', resultado: 'No' });
  ok(r.ok && R.vals[2][3] === '2026-10-27' && R.vals[2][6] === 'Hoja «Cierre de prueba»', 'la hoja de ayer; sin nota, solo el nombre de la hoja');
  ok(g.llamar('revisar', { puesto: 'COO', hoja: 'Cierre de prueba', periodo: '2026-10-29', sorpresa: 'No', resultado: 'No' }).codigo === 'periodo', 'un día que todavía no llegó: se niega');
  ok(g.llamar('revisar', { puesto: 'COO', hoja: 'Cierre de prueba', periodo: '2026-S44', sorpresa: 'No', resultado: 'No' }).codigo === 'periodo', 'una hoja no se verifica por semana');
  ok(g.llamar('revisar', { puesto: 'COO', hoja: 'No existe', sorpresa: 'No', resultado: 'No' }).codigo === 'hoja', 'una hoja que el puesto no tiene: se niega');
  ok(R.vals.length === 3, 'nada rechazado se escribió');
}

seccion('solo se escribe en Aceptaciones, Marcas, Marcas de hojas y Revisiones');
{
  const g = cargar(P);
  const EDITA_ACTIO = ['Léeme', 'Puestos', 'Contratos', 'Listas', 'Procesos', 'Asignaciones', 'Metas', 'Hojas', 'Reglas del juego', 'Horarios del servicio'];
  const foto = () => EDITA_ACTIO.map(n => JSON.stringify(g.hoja(n).vals)).join('|');
  const antes = foto();
  g.llamar('aceptar', { puesto: 'COO', version: 2 });
  g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Cumplido' }] });
  g.llamar('revisar', { puesto: 'COO', periodo: '2026-10-28', sorpresa: 'No', resultado: 'Cumplido' });
  g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 1, marcado: true });
  g.llamar('marcarHoja', { puesto: 'COO', hoja: 'Cierre de prueba', orden: 1, marcado: false });
  g.llamar('revisar', { puesto: 'COO', hoja: 'Cierre de prueba', sorpresa: 'No', resultado: 'Cumplido' });
  ok(foto() === antes, 'las pestañas que edita Actio no cambian');
  ok(EDITA_ACTIO.every(n => g.hoja(n).escrituras === 0 && !g.hoja(n).borradas), 'ni una escritura ni un borrado en ellas');
  g.lock.ocupado = true;
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Cumplido' }] }).codigo === 'ocupado', 'con el Sheet ocupado (candado): no escribe y lo dice');
}

seccion('actualizarEstructura: crea Metas y agrega al final lo que falte, sin mover nada');
{
  const sin = HOJAS(); delete sin['Metas']; sin['Puestos'] = sin['Puestos'].map(f => f.slice(0, 12));   // sin Metas ni «Visible solo para»
  const g = cargar(P, sin), antesPuestos = JSON.stringify(g.hoja('Puestos').vals);
  ok(cargar(P, sin).llamar('leer').resultado.faltan.some(f => /Metas/.test(f)), '(control) sin la pestaña Metas, «leer» lo avisa');
  const hechos = g.ctx.actualizarEstructura();
  const M = g.hoja('Metas');
  ok(M && JSON.stringify(M.vals[0]) === JSON.stringify(['Cifra', 'Unidad', 'Período', 'Valor', 'Estado']) && M.congeladas === 1, 'crea «Metas» con sus cinco títulos en la fila 1');
  ok(M.formatos['2,3'] === '@' && M.formatos['1001,3'] === '@' && !M.formatos['1,3'], 'Período como texto en las filas de datos (no en el título)');
  ok(M.validaciones[1].valores.join() === 'Ocupación,Niños activos,Altas,Bajas,Pruebas que se inscriben,Facturación,Margen de la unidad,Margen neto' &&
    M.validaciones[2].valores.includes('Preschool') && M.validaciones[5].valores.join() === 'Tentativa,Confirmada' && M.validaciones[5].invalidos === false && M.validaciones[5].desde === 2,
    'listas: Cifra, Unidad y Estado (Tentativa o Confirmada; no se acepta otra cosa)');
  const P2 = g.hoja('Puestos').vals;
  ok(P2[1][12] === 'Visible solo para' && JSON.stringify(P2.map(f => f.slice(0, 12))) === antesPuestos, 'Puestos: «Visible solo para» al final de su fila de títulos (la 2); nada más cambia');
  ok(hechos.some(t => /Creé la pestaña/.test(t)) && g.registro.length === 1, 'dice lo que hizo en el registro');
  g.ctx.actualizarEstructura();
  ok(g.hoja('Metas').vals[0].length === 5 && g.hoja('Puestos').vals[1].filter(t => t === 'Visible solo para').length === 1 && g.objs.filter(h => h.getName() === 'Metas').length === 1,
    'correrla otra vez no repite nada');
  const r = g.llamar('leer').resultado;
  ok(!r.faltan.some(f => /Metas/.test(f)) && Array.isArray(r.metas) && r.metas.length === 0, 'después, «leer» encuentra Metas (vacía)');
  const parcial = HOJAS(); parcial['Metas'] = [['Cifra', 'Unidad', 'Período', 'Valor'], ['Altas', 'Negocio', '2026', 5]];
  const g2 = cargar(P, parcial);
  g2.ctx.actualizarEstructura();
  ok(JSON.stringify(g2.hoja('Metas').vals) === JSON.stringify([['Cifra', 'Unidad', 'Período', 'Valor', 'Estado'], ['Altas', 'Negocio', '2026', 5]]), 'a una Metas sin «Estado» le agrega ese título al final; las filas no se tocan');
}

seccion('actualizarEstructura (v3): crea Marcas de hojas y la explica en el Léeme, una sola vez');
{
  const g = cargar(P);
  g.ctx.actualizarEstructura();
  const MH = g.hoja('Marcas de hojas'), L = g.hoja('Léeme');
  ok(MH && JSON.stringify(MH.vals[0]) === JSON.stringify(['Fecha y hora', 'Usuario', 'Puesto ID', 'Hoja', 'Orden', 'Iniciales']), 'crea «Marcas de hojas» con sus seis títulos');
  ok(L.vals.length === 3 && L.vals[2][0] === 'Marcas de hojas' && /La escribe el portal/.test(L.vals[2][1]) && L.vals[1][0] === 'Qué es', 'agrega al final del Léeme el renglón «Marcas de hojas»; lo demás no se toca');
  g.ctx.actualizarEstructura();
  ok(L.vals.length === 3 && g.objs.filter(h => h.getName() === 'Marcas de hojas').length === 1, 'correrla otra vez no repite nada');
}

console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');
process.exit(fallos ? 1 : 0);
