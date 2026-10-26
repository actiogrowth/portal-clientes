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
    [1, 'ADM', 'Punto de un borrador', 'registro', 'Diario']
  ],
  'Procesos': [['Puesto ID', 'Proceso', 'Descripción', 'Enlace', 'Estado'], ['COO', 'Proceso de prueba', 'Descripción', '/biblioteca/x.html', 'Listo']],
  'Asignaciones': [['Usuario del portal', 'Puesto ID', 'Desde', 'Hasta'], ['Usuario del rol Coordinación After School', 'COO', new Date(2026, 9, 1), '']],
  'Aceptaciones': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Versión']],
  'Marcas': [['Fecha y hora', 'Usuario', 'Puesto ID', 'Orden del punto', 'Período', 'Resultado', 'Nota']],
  'Revisiones': [['Fecha y hora', 'Revisor', 'Puesto ID', 'Período', 'Sorpresa', 'Resultado', 'Nota']]
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
    getName: () => nombre,
    getDataRange: () => ({ getValues: () => vals.map(f => f.slice()) }),
    getLastRow: () => vals.length,
    getRange: (r, c, nr, nc) => ({
      setNumberFormat: fmt => { for (let i = 0; i < (nr || 1); i++) for (let j = 0; j < (nc || 1); j++) formatos[(r + i) + ',' + (c + j)] = fmt; return this; },
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
  const libro = { getSheets: () => objs, getSpreadsheetTimeZone: () => 'America/Panama' };
  class DateFija extends Date { constructor(...a) { if (a.length) super(...a); else super(AHORA.getTime()); } static now() { return AHORA.getTime(); } }
  const two = n => ('0' + n).slice(-2);
  const lock = { tomado: 0, ocupado: false };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro },
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
  return { llamar, hoja, lock, ctx };
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
  ok(r.ok && r.resultado.faltan.length === 1 && /Cada luna/.test(r.resultado.faltan[0]), 'lee; solo avisa el «Cada cuánto» desconocido (' + JSON.stringify(r.resultado && r.resultado.faltan) + ')');
  const R = r.resultado, coo = R.puestos.find(p => p.id === 'COO');
  const perLeer = R.listas.filter(x => x.puesto === 'COO').map(x => x.orden + '=' + x.periodo).join(' ');
  ok(perLeer === '1=2026-10-28 2=2026-S44 3=2026-10 4=2026 5=2026-10-28 6=2026-10-28 7=', 'cada punto trae su período en curso (' + perLeer + ')');
  ok(R.puestos.length === 4 && coo.puesto === 'Coordinación inventada' && coo.reportaA === 'DIR' && coo.version === 2 && coo.fechaVersion === '2026-10-20',
    'Puestos: títulos en la fila 2, columnas en otro orden; versión como número y fecha como AAAA-MM-DD');
  ok(R.puestos.find(p => p.id === 'REC').version === 1 && R.puestos.find(p => p.id === 'DIR').version === null, 'versión escrita como texto o vacía');
  ok(!('columna de mas' in coo) && Object.keys(coo).sort().join() === 'area,cantidad,comoVerifica,estado,fechaVersion,id,puesto,reportaA,soloPara,unidad,verifica,version', 'solo los campos del contrato');
  ok(R.puestos.find(p => p.id === 'REC').soloPara === 'usuario-de-prueba' && coo.soloPara === '', '«Visible solo para» llega tal cual (sin espacios de más); vacía, vacía');
  const sinCol = HOJAS(); sinCol['Puestos'] = sinCol['Puestos'].map(f => f.slice(0, 12));
  const rs = cargar(P, sinCol).llamar('leer').resultado;
  ok(rs.puestos.length === 4 && rs.puestos.every(p => p.soloPara === '') && rs.faltan.length === 1, 'sin la columna «Visible solo para» (opcional): todos vacíos y no se avisa nada');
  ok(R.contratos.length === 5 && R.listas.length === 8 && R.procesos.length === 1 && R.asignaciones[0].desde === '2026-10-01', 'Contratos, Listas, Procesos y Asignaciones');
  ok(R.hoy === '2026-10-28' && R.version === 'v1', 'hoy (en la zona del archivo) y la versión del script');
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
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 9, resultado: 'Cumplido' }] }).codigo === 'punto', 'un punto que no es del puesto: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Tal vez' }] }).codigo === 'resultado', 'resultado inválido: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'No' }, { orden: 1, resultado: 'No' }] }).codigo === 'punto', 'el mismo punto dos veces: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 7, resultado: 'No' }] }).codigo === 'frecuencia', '«Cada cuánto» desconocido: se niega y lo dice');
  ok(g.llamar('marcar', { puesto: 'ADM', marcas: [{ orden: 1, resultado: 'No' }] }).codigo === 'no_abierto', 'un puesto en Borrador: se niega');
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [] }).codigo === 'vacia', 'sin marcas: se niega');
  ok(M.vals.length === antes, 'ninguna marca rechazada se escribió (ni a medias)');
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

seccion('solo se escribe en Aceptaciones, Marcas y Revisiones');
{
  const g = cargar(P);
  const foto = () => ['Léeme', 'Puestos', 'Contratos', 'Listas', 'Procesos', 'Asignaciones'].map(n => JSON.stringify(g.hoja(n).vals)).join('|');
  const antes = foto();
  g.llamar('aceptar', { puesto: 'COO', version: 2 });
  g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Cumplido' }] });
  g.llamar('revisar', { puesto: 'COO', periodo: '2026-10-28', sorpresa: 'No', resultado: 'Cumplido' });
  ok(foto() === antes, 'las pestañas que edita Actio no cambian');
  ok(['Léeme', 'Puestos', 'Contratos', 'Listas', 'Procesos', 'Asignaciones'].every(n => g.hoja(n).escrituras === 0), 'ni una escritura en ellas');
  g.lock.ocupado = true;
  ok(g.llamar('marcar', { puesto: 'COO', marcas: [{ orden: 1, resultado: 'Cumplido' }] }).codigo === 'ocupado', 'con el Sheet ocupado (candado): no escribe y lo dice');
}

console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');
process.exit(fallos ? 1 : 0);
