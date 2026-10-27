/* Cifras del Resumen del negocio (comun/cifras.js), con datos INVENTADOS
 * con la forma de After School «leer» y de resumen/api.php, y sus roturas
 * (cada una tiene que hacer fallar alguna comprobación).
 *
 *   node pruebas-portal/prueba-cifras.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'comun', 'cifras.js'), 'utf8');
function cargar(fuente) { const m = { exports: {} }; vm.runInNewContext(fuente, { module: m }); return m.exports; }

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/* Hoy miércoles 28-oct-2026. leer() trae del 14-oct (miércoles) al 8-dic: la
   semana del 12-oct queda incompleta; la del 19 y la del 26, completas. */
function estado() {
  const clases = [
    { codigo: 'LUN-A', dia: 'Lunes', cupo: 10, activa: true },
    { codigo: 'MIE-B', dia: 'Miércoles', cupo: 5, activa: true },
    { codigo: 'LUN-C', dia: 'Lunes', cupo: 8, activa: false },     // inactiva: no cuenta
    { codigo: 'VIE-D', dia: 'Viernes', cupo: null, activa: true }  // sin cupo válido: no cuenta
  ];
  const I = { '2026-10-19': { 'LUN-A': 6, 'LUN-C': 8 }, '2026-10-21': { 'MIE-B': 3 }, '2026-10-26': { 'LUN-A': 8, 'LUN-C': 8 }, '2026-10-28': { 'MIE-B': 4 } };
  const ocupacion = {};
  for (let d = '2026-10-14'; d <= '2026-12-08'; d = sumar(d, 1)) {
    const dia = DIAS[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7], o = {};
    clases.filter(c => c.dia === dia).forEach(c => { o[c.codigo] = { i: (I[d] || {})[c.codigo] || (d > '2026-10-28' && c.codigo === 'LUN-A' ? 9 : 0), v: c.codigo === 'LUN-A' ? 3 : 0 }; });
    ocupacion[d] = o;
  }
  return { hoy: '2026-10-28', dias: DIAS, clases, ocupacion };
}

let fallas = 0, total = 0;
function comprobar(C, decir) {
  let f = 0;
  const ok = (c, m) => { total++; if (!c) { f++; if (decir) console.log('  ✗ ' + m); } else if (decir) console.log('  ✓ ' + m); };
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;
  const r = C.ocupacionAS(estado());
  ok(r && r.inscritos === 12 && r.cupos === 15 && cerca(r.valor, 0.8),
    'semana de hoy: (8 + 4) inscritos ÷ (10 + 5) cupos de las clases activas = 80 %; ni la inactiva, ni la sin cupo, ni las visitas (' + JSON.stringify(r) + ')');
  ok(r && Array.isArray(r.serie) && r.serie.length === 2 && cerca(r.serie[0], 0.6) && cerca(r.serie[1], 0.8),
    'tendencia: la semana anterior (60 %) y la de hoy; la del 12-oct no viene completa y no se usa');
  const E2 = estado(); delete E2.ocupacion['2026-10-19'];
  const r2 = C.ocupacionAS(E2);
  ok(r2 && cerca(r2.valor, 0.8) && r2.serie === null, 'si la semana anterior no viene completa: la cifra sin tendencia');
  const E3 = estado(); delete E3.ocupacion['2026-10-28'];
  ok(C.ocupacionAS(E3) === null, 'si la semana de hoy no viene completa: no hay cifra (no se inventa)');
  const E4 = estado(); E4.clases.forEach(c => { c.activa = false; });
  ok(C.ocupacionAS(E4) === null, 'sin clases activas con cupo: no hay cifra');
  ok(C.ocupacionAS(null) === null && C.ocupacionAS({ hoy: '2026-10-28' }) === null, 'sin la lectura de After School: no hay cifra');
  const E5 = estado(); E5.hoy = '2026-11-01';   // domingo: sigue siendo la semana del lunes 26
  const r5 = C.ocupacionAS(E5);
  ok(r5 && r5.inscritos === 12 && r5.cupos === 15, 'la semana va de lunes a domingo (el domingo 1-nov es la semana del 26-oct)');
  f += negocio(C, ok, cerca);
  return f;
}

/* 26-oct: el Resumen del negocio. Preschool con la forma que devuelve resumen/api.php. */
const PRE = () => ({ anio: 2026, corte: 10, sello: '2026-10-25', capacidad: 80, meses: {
  '2026-08': { activos: 24, altas: 2, bajas: 0 }, '2026-09': { activos: 26, altas: 3, bajas: 1 }, '2026-10': { activos: 28, altas: 4, bajas: 3 } } });
const METAS = () => [
  { cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026', valor: 0.45, estado: 'Tentativa' },        // del año, escrita como 45 % (Sheets guarda 0,45)
  { cifra: 'Ocupación', unidad: 'After School', periodo: '2026-10', valor: 90, estado: 'Confirmada' },
  { cifra: 'Bajas', unidad: 'Preschool', periodo: '2026-10', valor: 2, estado: '' },                      // vacía = tentativa
  { cifra: 'Altas', unidad: 'Preschool', periodo: '2026', valor: 30, estado: 'Tentativa' },               // de año: no vale para un mes (no es porcentaje)
  { cifra: 'Niños activos', unidad: 'preschool', periodo: '2026-10', valor: 50, estado: 'confirmada' }];
function negocio(C, ok, cerca) {
  let f0 = 0; const ok2 = (c, m) => { if (!c) f0++; ok(c, m); };
  const m1 = C.metaDe(METAS(), 'Ocupación', 'Preschool', '2026-10');
  ok2(m1 && cerca(m1.valor, 45) && m1.tentativa === true && m1.periodo === '2026', 'meta de porcentaje: la del año vale para el mes y 0,45 se lee 45 %; dice tentativa');
  ok2(C.metaDe(METAS(), 'Altas', 'Preschool', '2026-10') === null, 'una meta de conteo del año no se reparte en meses');
  const m3 = C.metaDe(METAS(), 'Niños activos', 'Preschool', '2026-10');
  ok2(m3 && m3.valor === 50 && m3.tentativa === false, 'Confirmada (sin importar mayúsculas) deja de decir tentativa; la unidad se compara sin mayúsculas');
  ok2(C.metaDe(METAS(), 'Bajas', 'Preschool', '2026-10').tentativa === true, 'Estado vacío = tentativa');
  const p = C.preschoolEn(PRE(), '2026-10');
  ok2(p && p.activos === 28 && p.altas === 4 && p.bajas === 3 && cerca(p.ocupacion, 28 / 80), 'Preschool en el mes: activos, altas, bajas y ocupación = activos ÷ capacidad máxima');
  const pa = C.preschoolEn(PRE(), '2026');
  ok2(pa && pa.activos === 28 && pa.altas === 9 && pa.bajas === 4 && pa.hasta === '2026-10', 'Preschool en el año: activos del último mes; altas y bajas sumadas');
  ok2(C.preschoolEn(PRE(), '2025-10') === null && C.preschoolEn(null, '2026-10') === null, 'sin datos del período: null (no se inventa)');
  const E = estado();
  E.ninos = [{ id: 'AS-1', estado: 'Activo' }, { id: 'AS-1', estado: 'Activo' }, { id: 'AS-2', estado: 'Activo' }, { id: 'AS-3', estado: 'Prospecto' }];
  const a = C.afterSchoolEn(E, '2026-10');
  ok2(a && a.activos === 2 && cerca(a.ocupacion, 0.8) && a.altas === null && a.bajas === null && /Cifras del Resumen desde/.test(a.motivos.altas),
    'After School: activos únicos (el mismo niño una vez), ocupación de la semana; sin «Cifras del Resumen desde» en Config, altas y bajas dicen qué falta');
  ok2(C.afterSchoolEn(E, '2026-09') === null, 'After School sin esa fecha: otro mes no tiene datos');
  const N = C.resumenNegocio({ periodo: '2026-10', E, pre: PRE(), metas: METAS(), finanzas: null });
  ok2(N.ninos.activos.valor === null && /mismo niño/.test(N.ninos.activos.motivo), 'niños activos del negocio: NO se suman las unidades (contaría dos veces); falta la regla');
  ok2(N.ninos.altas.valor === null && /After School/.test(N.ninos.altas.motivo) && N.ninos.bajas.valor === null && N.ninos.pruebas.valor === null,
    'sin datos de After School: altas, bajas y pruebas del negocio «Próximamente», con lo que falta');
  ok2(N.finanzas.disponible === false && N.unidades.every(u => u.facturacion === null && u.margen === null), 'sin fuente de finanzas: nada disponible, ningún número');
  const pre = N.unidades.find(u => u.nombre === 'Preschool'), as = N.unidades.find(u => u.nombre === 'After School'), ver = N.unidades.find(u => u.nombre === 'Veranito');
  ok2(pre.activos.valor === 28 && pre.activos.anterior === 26 && pre.activos.anioAnterior === null, 'comparación con el mes anterior; sin el mismo mes del año anterior, no se muestra');
  ok2(ver.datos === false && ver.activos.valor === null && N.unidades.map(u => u.nombre).join() === 'Preschool,After School,Veranito,Baby & Me,Cumpleaños', 'las cinco unidades; sin datos, vacías');
  ok2(N.alertas.length === 3 && N.alertas[0].tipo === 'bajas' && N.alertas[0].unidad === 'Preschool' && N.alertas.some(x => x.tipo === 'ocupacion' && x.unidad === 'After School'),
    'Para mirar: bajas por encima del tope y ocupaciones bajo la meta, la más lejos primero (' + N.alertas.map(x => x.tipo + ':' + x.unidad).join(' ') + ')');
  const sinMetas = C.resumenNegocio({ periodo: '2026-10', E, pre: PRE(), metas: [], finanzas: null });
  ok2(sinMetas.alertas.length === 0, 'sin metas no hay alertas: lo normal lo fija Vida en Arte');
  const muchas = METAS().concat([{ cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026-10', valor: 99, estado: 'Tentativa' }]);
  const N2 = C.alertas([{ nombre: 'U1', ocupacion: { valor: 0.1, meta: { valor: 50 } }, bajas: { valor: 9, meta: { valor: 1 } } },
    { nombre: 'U2', ocupacion: { valor: 0.4, meta: { valor: 50 } }, bajas: { valor: 1, meta: { valor: 1 } } },
    { nombre: 'U3', ocupacion: { valor: 0.3, meta: { valor: 50 } }, bajas: { valor: null, meta: null } }], { disponible: false });
  ok2(N2.length === 3 && N2[0].tipo === 'bajas' && N2.every((x, i, l) => !i || l[i - 1].distancia >= x.distancia) && !N2.some(x => x.unidad === 'U2' && x.tipo === 'bajas'),
    'como mucho tres, ordenadas');
  ok2(C.alertas([{ nombre: 'U', ocupacion: { valor: 0.5, meta: { valor: 50 } }, bajas: { valor: 2, meta: { valor: 2 } } }], { disponible: false }).length === 0,
    'en la meta justa (ocupación igual, bajas iguales al tope) no hay alerta');
  ok2(C.metaDe(muchas, 'Ocupación', 'Preschool', '2026-10').valor === 99, 'la meta del mes manda sobre la del año');
  // Finanzas con el contrato (números INVENTADOS, solo en la prueba).
  const F = { meses: { '2026-09': { unidades: { Preschool: { facturacion: 100, costos: 40 } }, gastosComunes: 20, cobrado: 70, porCobrar: 30, familiasPorCobrar: 3 },
    '2026-10': { unidades: { Preschool: { facturacion: 200, costos: 80 }, 'After School': { facturacion: 100, costos: 70 } }, gastosComunes: 60, cobrado: 240, porCobrar: 60, familiasPorCobrar: 4 } } };
  const fin = C.finanzasEn(F, '2026-10');
  ok2(fin.disponible && fin.facturacion === 300 && fin.costos === 150 && fin.margen === 150 && fin.utilidad === 90 && cerca(fin.margenNeto, 0.3) && cerca(fin.cobradoPct, 0.8) && fin.unidades.Preschool.margen === 120,
    'finanzas: margen de las unidades = facturación − costos; utilidad neta = margen − gastos comunes; margen neto = utilidad ÷ facturación');
  const fa = C.finanzasEn(F, '2026');
  ok2(fa.facturacion === 400 && fa.gastosComunes === 80, 'finanzas del año: la suma de sus meses');
  const S = C.serieFinanzas(F, '2026-10');
  ok2(S.length === 12 && S[11].mes === '2026-10' && S[11].facturacion === 300 && S[10].utilidad === 40 && S[0].sin === true, 'gráfico: 12 meses que terminan en el elegido; los meses sin datos, vacíos');
  ok2(C.comparables('2026-01').anterior === '2025-12' && C.comparables('2026-01').anioAnterior === '2025-01' && C.comparables('2026').anioAnterior === null, 'mes anterior y mismo mes del año anterior');
  f0 += reglasAS(C, ok);
  return f0;
}

/* 27-oct: altas, bajas y pruebas que se inscriben de After School (R134–R137).
   Hoy 28-oct-2026; la hoja está completa desde el 15-sep («Cifras del Resumen desde»). */
function conHistoria(cfg) {
  const E = estado();
  E.config = Object.assign({ resumenDesde: '2026-09-15', diasInscribe: 30 }, cfg || {});
  E.ninos = [{ id: 'AS-1', estado: 'Activo' }];
  E.inscripciones = [
    { idNino: 'AS-1', alta: '2026-10-05' }, { idNino: 'AS-1', alta: '2026-10-20' },   // primera vez en octubre; la segunda clase no es otra alta
    { idNino: 'AS-2', alta: '2026-10-03' },                                            // cambio de clase: su primera alta es de agosto
    { idNino: 'AS-3', alta: '2026-10-15' },                                            // regreso tras dejar en septiembre
    { idNino: 'AS-4', alta: '2026-10-27' }, { idNino: 'AS-5', alta: '2026-09-01' },     // AS-5: antes del 15-sep, no cuenta
    { idNino: 'AS-14', alta: '2026-09-01' }, { idNino: 'AS-15', alta: '2026-10-21' }, { idNino: 'AS-16', alta: '2026-10-16' }];
  E.inscripcionesCerradas = [{ idNino: 'AS-2', alta: '2026-08-01', baja: '2026-10-03' }, { idNino: 'AS-3', alta: '2026-09-20', baja: '2026-09-30' }];
  E.bajas = [{ idNino: 'AS-6', fecha: '2026-10-02' }, { idNino: 'AS-6', fecha: '2026-10-20' }, { idNino: 'AS-7', fecha: '2026-10-25' }, { idNino: 'AS-8', fecha: '2026-09-10' }];
  const p = (idNino, fecha, estado, tipo) => ({ idNino, fecha, estado, tipo: tipo === undefined ? 'Prueba' : tipo });
  E.pruebas = [
    p('AS-4', '2026-10-10', 'Asistió'),            // se inscribe a los 17 días: sí
    p('AS-9', '2026-10-05', 'Asistió'),            // todavía no: su plazo sigue abierto (en curso)
    p('AS-10', '2026-10-06', 'Cancelada'), p('AS-11', '2026-10-07', 'Asistió', 'Reposición'), p('AS-12', '2026-10-08', 'Asistió', 'Eventual'),
    p('AS-13', '2026-10-09', 'No asistió'), p('AS-18', '2026-10-11', 'Agendada'),
    p('AS-1', '2026-10-01', 'Asistió', ''),        // Tipo vacío = Prueba; se inscribe a los 4 días: sí
    p('AS-14', '2026-10-02', 'Asistió'),           // ya estaba inscrito de antes: no es «se inscribe»
    p('AS-15', '2026-09-20', 'Asistió'),           // se inscribe a los 31 días: no
    p('AS-16', '2026-09-16', 'Asistió'),           // a los 30 días justos: sí
    p('AS-17', '2026-09-10', 'Asistió')];          // antes del 15-sep: no cuenta
  return E;
}
function reglasAS(C, ok) {
  let f0 = 0; const ok2 = (c, m) => { if (!c) f0++; ok(c, m); };
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;
  const o = C.afterSchoolEn(conHistoria(), '2026-10');
  ok2(o && o.altas === 4, 'R134 altas de octubre = 4: primera inscripción en el mes (AS-1, AS-4, AS-15, AS-16); ni la segunda clase, ni el cambio de clase, ni el regreso (' + (o && o.altas) + ')');
  ok2(o && o.bajas === 2, 'R135 bajas de octubre = 2: bajas totales de niños distintos (AS-6 una vez, AS-7); dejar una clase no cuenta (' + (o && o.bajas) + ')');
  ok2(o && cerca(o.pruebas, 0.5) && o.enCurso === true && o.pruebasNota === '2 de 4 pruebas · en curso',
    'R136 octubre: 4 pruebas realizadas (sin canceladas, sin resultado, reposiciones ni eventuales; el Tipo vacío es Prueba), 2 con inscripción en 30 días; en curso (' + (o && o.pruebasNota) + ')');
  const s = C.afterSchoolEn(conHistoria(), '2026-09');
  ok2(s && s.altas === 1 && s.bajas === 0 && s.parcial === true && s.desde === '2026-09-15', 'septiembre cuenta solo desde el 15 (AS-3 sí; AS-5, la baja de AS-8 y la prueba de AS-17 no) y queda marcado como parcial');
  ok2(s && cerca(s.pruebas, 0.5) && s.enCurso === false && s.pruebasNota === '1 de 2 pruebas', 'R136 el plazo incluye el día 30 (AS-16 sí) y no el 31 (AS-15 no); cerrado, sin «en curso»');
  ok2(s && s.activos === null && s.ocupacion === null && /en curso/.test(s.motivos.activos), 'activos y ocupación de After School: solo el período en curso');
  const s31 = C.afterSchoolEn(conHistoria({ diasInscribe: 31 }), '2026-09');
  ok2(s31 && cerca(s31.pruebas, 1), 'los días del plazo salen de Config: con 31, AS-15 también cuenta');
  ok2(C.afterSchoolEn(conHistoria(), '2026-08') === null, 'antes de «Cifras del Resumen desde»: sin datos (no se inventa)');
  const sinDias = C.afterSchoolEn(conHistoria({ diasInscribe: null }), '2026-10');
  ok2(sinDias.pruebas === null && /Días para que una prueba cuente como inscrita/.test(sinDias.motivos.pruebas) && sinDias.altas === 4, 'sin el plazo en Config: la cifra de pruebas dice qué falta; las altas siguen');
  const viejo = conHistoria(); delete viejo.bajas;
  const v = C.afterSchoolEn(viejo, '2026-10');
  ok2(v.bajas === null && /Apps Script/.test(v.motivos.bajas), 'con el Apps Script anterior (sin bajas): las bajas dicen que falta publicarlo');
  const a = C.afterSchoolEn(conHistoria(), '2026');
  ok2(a && a.altas === 5 && a.bajas === 2 && a.parcial === true, 'el año: desde el 15-sep, altas 1 + 4 y bajas 0 + 2');
  const metas = METAS().concat([{ cifra: 'Pruebas que se inscriben', unidad: 'After School', periodo: '2026', valor: 0.6, estado: 'Tentativa' }]);
  const N = C.resumenNegocio({ periodo: '2026-10', E: conHistoria(), pre: PRE(), metas, finanzas: null });
  const as = N.unidades.find(u => u.nombre === 'After School');
  ok2(as.altas.valor === 4 && as.altas.anterior === null && as.bajas.anterior === null, 'no compara con septiembre: la hoja no lo tiene completo');
  ok2(as.pruebas.meta && cerca(as.pruebas.meta.valor, 60) && as.pruebasNota === '2 de 4 pruebas · en curso' && as.enCurso === true, 'la tabla por unidad trae las pruebas de After School con su meta');
  ok2(N.ninos.altas.valor === 8 && N.ninos.altas.desglose.map(x => x.unidad + ' ' + x.valor).join(', ') === 'Preschool 4, After School 4' && N.ninos.bajas.valor === 5,
    'R137 altas y bajas del negocio: la suma de Preschool y After School, con el desglose');
  ok2(N.ninos.altas.anterior === null, 'el negocio no compara si una unidad no tiene el período anterior completo');
  ok2(cerca(N.ninos.pruebas.valor, 0.5) && N.ninos.pruebas.enCurso === true && N.ninos.pruebas.meta && cerca(N.ninos.pruebas.meta.valor, 60), 'pruebas del negocio = las de After School; sin meta del Negocio, la de After School');
  const Ns = C.resumenNegocio({ periodo: '2026-09', E: conHistoria(), pre: PRE(), metas: [], finanzas: null });
  ok2(Ns.ninos.altas.valor === 4 && Ns.ninos.altas.desglose[1].desde === '2026-09-15' && !Ns.ninos.altas.desglose[0].desde,
    'un mes que After School tiene solo en parte: el desglose lo dice («desde el 15»)');
  const sinPre = C.resumenNegocio({ periodo: '2026-10', E: conHistoria(), pre: null, metas: [], finanzas: null });
  ok2(sinPre.ninos.altas.valor === null && /Preschool/.test(sinPre.ninos.altas.motivo), 'sin los datos de una unidad, el negocio no suma (dice cuál falta)');

  /* 28-oct (R140): la nota de Preschool que manda el servidor, junto a sus cifras; vacía, nada. */
  const conNota = Object.assign(PRE(), { nota: 'Datos en revisión' });
  const Nn = C.resumenNegocio({ periodo: '2026-10', E: conHistoria(), pre: conNota, metas: METAS(), finanzas: null });
  const preN = Nn.unidades.find(u => u.nombre === 'Preschool'), asN = Nn.unidades.find(u => u.nombre === 'After School');
  ok2(preN.aviso === 'Datos en revisión' && asN.aviso === '', 'R140 la fila de Preschool lleva la nota «Datos en revisión»; After School, ninguna');
  ok2(Nn.ninos.altas.desglose[0].aviso === 'Datos en revisión' && Nn.ninos.bajas.desglose[0].aviso === 'Datos en revisión' && !Nn.ninos.altas.desglose[1].aviso,
    'R140 en las tarjetas, la nota va junto a la cifra de Preschool del desglose (altas y bajas)');
  const Na = C.resumenNegocio({ periodo: '2026-10', E: conHistoria(), pre: conNota, finanzas: null,
    metas: [{ cifra: 'Ocupación', unidad: 'Preschool', periodo: '2026-10', valor: 99, estado: '' }, { cifra: 'Bajas', unidad: 'Preschool', periodo: '2026-10', valor: 1, estado: '' }] });
  const alPre = Na.alertas.filter(a => a.unidad === 'Preschool');
  ok2(alPre.length === 2 && alPre.every(a => a.aviso === 'Datos en revisión'), 'R140 las alertas de Preschool (ocupación y bajas) también llevan la nota');
  ok2(C.preschoolEn(conNota, '2026').aviso === 'Datos en revisión', 'R140 la nota vale también en el año');
  const sinNota = C.resumenNegocio({ periodo: '2026-10', E: conHistoria(), pre: Object.assign(PRE(), { nota: '' }), metas: METAS(), finanzas: null });
  ok2(sinNota.unidades[0].aviso === '' && !sinNota.ninos.altas.desglose[0].aviso, 'R140 con la nota vacía en la configuración, no sale ninguna');
  return f0;
}

console.log('· Ocupación After School y Resumen del negocio');
fallas = comprobar(cargar(FUENTE), true);
console.log(fallas ? '✗ ' + fallas + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');

const ROTURAS = [
  ['cuenta las clases inactivas', 'E.clases.filter(c => c.activa && c.cupo > 0)', 'E.clases.filter(c => c.cupo > 0 || c.activa === false)'],
  ['cuenta las clases sin cupo válido', 'E.clases.filter(c => c.activa && c.cupo > 0)', 'E.clases.filter(c => c.activa).map(c => Object.assign({}, c, { cupo: c.cupo || 5 }))'],
  ['suma las visitas de un día', 'dia[c.codigo] ? dia[c.codigo].i : 0', 'dia[c.codigo] ? dia[c.codigo].i + dia[c.codigo].v : 0'],
  ['una semana incompleta cuenta igual', 'if (!dia) return null;', 'if (!dia) continue;'],
  ['tendencia con una sola semana', 'serie.length >= 2 ? serie : null', 'serie'],
  ['la semana empieza el domingo', '(d.getDay() + 6) % 7', 'd.getDay()'],
  ['la tendencia mira semanas futuras', 'sumarDias(hoy, -7); ; l = sumarDias(l, -7)', 'sumarDias(hoy, 7); ; l = sumarDias(l, 7)'],
  ['la cifra es la de la semana pasada', 'valor: ahora.inscritos / ahora.cupos', 'valor: serie[0]'],
  // 26-oct: Resumen del negocio
  ['los niños activos del negocio se suman', "activos: { valor: null, motivo: 'Falta la regla para reconocer al mismo niño en dos unidades'", "activos: { valor: unidades.reduce((t, u) => t + (u.activos.valor || 0), 0), motivo: 'Falta la regla para reconocer al mismo niño en dos unidades'"],
  ['After School cuenta dos veces al mismo niño', "new Set((E.ninos || []).filter(n => n.estado === 'Activo').map(n => n.id)).size", "(E.ninos || []).filter(n => n.estado === 'Activo').length"],
  ['una meta confirmada sigue diciendo tentativa', "tentativa: normal(m.estado) !== 'confirmada'", "tentativa: true"],
  ['la meta del año se reparte en meses de conteo', "if (!m && esMes(periodo) && CIFRAS_PORCENTAJE.includes(cifra))", "if (!m && esMes(periodo))"],
  ['una meta de 0,45 no se lee como 45 %', "Math.abs(m.valor) <= 1 ? m.valor * 100 : m.valor", "m.valor"],
  ['alerta sin meta escrita', "if (o.valor !== null && o.meta && o.valor * 100 < o.meta.valor)", "if (o.valor !== null && o.valor * 100 < (o.meta ? o.meta.valor : 100))"],
  ['más de tres alertas', ".slice(0, 3);", ";"],
  ['las bajas iguales al tope avisan', "b.valor > b.meta.valor", "b.valor >= b.meta.valor"],
  ['la utilidad no resta los gastos comunes', "utilidad = margen - gastos", "utilidad = margen"],
  ['la ocupación de Preschool contra otra base', "pre.capacidad ? a / pre.capacidad : null", "pre.capacidad ? a / 100 : null"],
  ['las altas del año no se suman', "altas: ms.reduce((a, k) => a + pre.meses[k].altas, 0)", "altas: ult.altas"],
  ['After School da activos de otros meses', "    if (actual) {\n      r.activos", "    if (true) {\n      r.activos"],
  // 27-oct: altas, bajas y pruebas que se inscriben de After School
  ['el cambio de clase cuenta como alta', "Object.values(altasPorNino(E)).map(l => l.reduce((m, a) => a < m ? a : m)).filter(", "[].concat(...Object.values(altasPorNino(E))).filter("],
  ['el regreso tras una baja cuenta como alta', "(E.inscripciones || []).concat(E.inscripcionesCerradas || []).forEach(i => { if (i.alta)", "(E.inscripciones || []).forEach(i => { if (i.alta)"],
  ['la misma baja total cuenta dos veces', "return new Set(E.bajas.filter(b => b.fecha >= c.ini && b.fecha <= c.fin).map(b => b.idNino)).size;", "return E.bajas.filter(b => b.fecha >= c.ini && b.fecha <= c.fin).length;"],
  ['dejar una clase cuenta como baja', "return new Set(E.bajas.filter(", "return new Set(E.bajas.concat((E.inscripcionesCerradas || []).map(i => ({ idNino: i.idNino, fecha: i.baja }))).filter("],
  ['cuenta las pruebas canceladas o sin resultado', "&& x.estado === 'Asistió' &&", "&& x.estado !== 'Agendada' &&"],
  ['cuenta reposiciones y eventuales', "(x.tipo || 'Prueba') === 'Prueba' &&", "true &&"],
  ['una prueba sin Tipo no cuenta', "(x.tipo || 'Prueba') === 'Prueba' &&", "x.tipo === 'Prueba' &&"],
  ['cuenta inscripciones de antes de la prueba', ".some(a => a >= x.fecha && a <= limite)", ".some(a => a <= limite)"],
  ['el plazo deja fuera su último día', ".some(a => a >= x.fecha && a <= limite)", ".some(a => a >= x.fecha && a < limite)"],
  ['el plazo está escrito en el código', "const n = E.config.diasInscribe;", "const n = 30;"],
  ['no marca «en curso»', "else if (limite >= E.hoy) enCurso = true;", "else if (false) enCurso = true;"],
  ['cuenta desde antes de «Cifras del Resumen desde»', "const ini = a < desde ? desde : a,", "const ini = a,"],
  ['compara con un período incompleto', "const ok = x => x && !x.parcial && x[campo] != null;", "const ok = x => x && x[campo] != null;"],
  ['el negocio suma sin una unidad', "faltan.length ? null : desglose.reduce((t, x) => t + x.valor, 0)", "desglose.reduce((t, x) => t + (x.valor || 0), 0)"],
  ['el desglose no dice desde cuándo cuenta After School', "valor: u[campo].valor, desde: u.desde, aviso", "valor: u[campo].valor, aviso"],
  ['la nota de Preschool no llega a la fila', "desde: x && x.desde || '', aviso: x && x.aviso || '' };", "desde: x && x.desde || '', aviso: '' };"],
  ['la nota no va en el desglose', "desde: u.desde, aviso: u.aviso }));", "desde: u.desde }));"],
  ['la nota se pone aunque la configuración la quite', "aviso = typeof pre.nota === 'string' ? pre.nota.trim() : '';", "aviso = 'Datos en revisión';"],
  ['la nota solo vale en el mes', "hasta: ms[ms.length - 1], aviso };", "hasta: ms[ms.length - 1] };"],
  ['la alerta de ocupación pierde la nota', "meta: o.meta, aviso: u.aviso,", "meta: o.meta,"],
  ['la alerta de bajas pierde la nota', "meta: b.meta, aviso: u.aviso,", "meta: b.meta,"],
  ['las pruebas del negocio no son las de After School', "pruebas: Object.assign({}, asU.pruebas,", "pruebas: Object.assign({}, asU.pruebas, { valor: null },"]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (FUENTE.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  let f;
  try { f = comprobar(cargar(FUENTE.replace(de, a)), false); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
