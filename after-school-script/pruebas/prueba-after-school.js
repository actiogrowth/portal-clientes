/* Pruebas de AfterSchool.gs contra el simulador. DATOS INVENTADOS: este
 * repositorio es público y ningún dato de un niño real puede entrar aquí.
 *
 *   TZ=America/Bogota node after-school-script/pruebas/prueba-after-school.js
 *
 * Sale con 1 si falla cualquier comprobación.
 */
const sim = require('./simulador');
const { Libro } = sim;

/* Tras CADA escritura que sale bien, el estado que devuelve el puente (armado
   desde las tablas en memoria) tiene que ser idéntico a una lectura nueva del
   Sheet. Si la copia en memoria se desvía de la hoja, esto lo atrapa. */
let estadosComparados = 0;
function crearEntorno(opciones) {
  const g = sim.crearEntorno(opciones);
  const llamar = g.llamar;
  g.llamar = function (accion, datos, extra) {
    const r = llamar(accion, datos, extra);
    if (r.ok && r.estado) {
      const fresco = llamar('leer').resultado;
      estadosComparados++;
      ok(JSON.stringify(r.estado) === JSON.stringify(fresco), 'el estado tras «' + accion + '» coincide con una lectura nueva');
    }
    return r;
  };
  return g;
}

let fallos = 0, total = 0;
function ok(cond, que) {
  total++;
  if (!cond) { fallos++; console.log('  ✗ ' + que); }
}
function seccion(t) { console.log('· ' + t); }

const CLAVE = 'clave-de-prueba-0123456789abcdef';
const HOY = (() => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
const MES = HOY.slice(0, 7);
const AYER = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
const MANANA = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();

/* El Excel de carga, inventado, con un caso de cada problema. */
function libroCarga() {
  const l = new Libro('Carga_Inicial_AfterSchool');
  l.hojaDesdeFilas('Clases', [
    ['Código clase', 'Servicio', 'Modalidad', 'Día', 'Hora inicio', 'Cupo', 'Edades', 'Reservados (Poliwin, semana)', 'Libres'],
    ['LUN-1630-PARKOUR', 'Parkour', 'Semana', 'Lunes', '16:30', 3, '6 a 14', 2, 1],
    ['LUN-1630-TELAS', 'Telas', 'Semana', 'Lunes', '16:30', 2, '6 a 14', 1, 1],
    ['SAB-0900-TELAS', 'Telas', 'Sábado', 'Sábado', '09:00', 12, 'Adultos', 1, 11],
    ['MAR-1630-PARKIDS', 'Parkids', 'Semana', 'Martes', '16:30', 8, '3 a 5', 5, 3],   // Poliwin dice 5, llegan 0
    ['', 'Parkour', 'Semana', 'Lunes', '18:00', 20, '6 a 14', 0, 20],               // sin código
    ['LUN-1630-PARKOUR', 'Parkour', 'Semana', 'Lunes', '16:30', 20, '6 a 14', 0, 20] // repetido
  ]);
  const T = ['Número de socio', 'Nombre', 'Apellidos', 'Fecha nacimiento', 'Sexo', 'Disciplina (Poliwin)',
    'Estado (Poliwin)', 'Fecha de alta', 'Próximo cobro (Poliwin)', 'Clases esta semana', 'Móvil', 'Móvil 2',
    'Teléfono', 'E-mail', 'Cabeza de familia', 'Observaciones', 'Revisar'];
  l.hojaDesdeFilas('Niños', [T,
    ['90001', 'Alma', 'Prueba Uno', '15/03/2016', 'Mujer', 'PARKOUR', 'ALTA', '01/02/2025', '', 1, '+50760000001', '', '+50760000001', 'a@ejemplo.test', '90001', '', ''],
    ['90002', 'Beto', 'Prueba Dos', '31/12/2015', 'Hombre', 'TELAS', 'BAJA', '10/05/2024', '', 1, '60000002', '60000099', '2000002', '', '90001', 'Alergia ficticia', 'Con clase pero no en ALTA'],
    ['90003', 'Caro', 'Prueba Tres', '31/02/2019', 'Mujer', 'PARKOUR', 'ALTA', '05/06/2025', '', 0, '60000003', '', '', '', '90003', '', 'En ALTA sin clase reservada'],
    ['90001', 'Duplicado', 'Prueba', '01/01/2010', 'Hombre', 'PARKOUR', 'ALTA', '01/01/2025', '', 0, '', '', '', '', '90001', '', ''],
    ['90004', 'Dani', 'Prueba Cuatro', '', '', 'TELAS', 'ALTA', '07/07/2025', '', 2, '60000004', '', '', '', '90004', '', ''],
    ['90005', 'Eva', 'Prueba Cinco', '20/08/1990', 'Mujer', 'TELAS', 'ALTA', '07/07/2025', '', 1, '60000005', '', '', '', '90005', '', '']
  ]);
  l.hojaDesdeFilas('Inscripciones', [
    ['Número de socio', 'Código clase', 'Reservado en Poliwin el'],
    ['90001', 'LUN-1630-PARKOUR', '01/09/2026'],
    ['90002', 'LUN-1630-TELAS', '02/09/2026'],
    ['90004', 'LUN-1630-PARKOUR', '03/09/2026'],
    ['90005', 'SAB-0900-TELAS', '04/09/2026'],
    ['99999', 'LUN-1630-PARKOUR', '05/09/2026'],      // socio inexistente
    ['90001', 'NO-EXISTE', '05/09/2026'],             // clase inexistente
    ['90001', 'LUN-1630-PARKOUR', '06/09/2026'],      // repetida
    ['90004', 'LUN-1630-TELAS', '99/99/2026']         // fecha ilegible
  ]);
  return l;
}

function entornoCargado() {
  const carga = libroCarga();
  const g = crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE, AS_ID_CARGA: 'id-carga' }, porId: { 'id-carga': carga } });
  g.instalar();
  g.cargaInicial();
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
seccion('instalar');
{
  const g = crearEntorno({ propiedades: {} });
  const inf = g.instalar();
  const L = g._libro;
  ['Niños', 'Clases', 'Inscripciones', 'Pagos', 'Bajas', 'Config', 'Historial', 'Pruebas', 'Solicitudes', 'Asistencia', 'Clases sin dictar'].forEach(n => ok(!!L.getSheetByName(n), 'crea la pestaña ' + n));
  const n = L.getSheetByName('Niños');
  ok(n.celda(5, 1) === '' && n.celda(5, 2) === 'ID' && n.celda(5, 15) === 'Notas', 'títulos de Niños en la fila 5 desde la B, A vacía');
  ok(n.celda(5, 16) === 'Colegio' && n.celda(5, 22) === 'Teléfono responsable 2', 'las columnas nuevas de Niños van después de Notas');
  const nIni = g.INS_CONFIG.length;
  ok(nIni === 47 && L.getSheetByName('Config').getLastRow() === 5 + nIni, 'Config con sus 47 valores iniciales');
  ok(/FALTA/.test(inf), 'comprobar avisa que falta la clave');
  const otra = g.instalar();
  ok(L.getSheetByName('Config').getLastRow() === 5 + nIni, 'instalar dos veces no duplica Config');
  ok(/Ya existía, completa: Niños/.test(otra) && /Config: completa, no se tocó/.test(otra), 'instalar dos veces no recrea pestañas ni columnas');
  const cfg = g.leerConfig_();
  ok(cfg.faltan.length === 0, 'Config inicial completa: ' + cfg.faltan.join('; '));
  ok(cfg.umbral === 0.8 && cfg.planes.length === 3 && cfg.planes[0].precio === 85.6, 'umbral y precios leídos de Config');
  ok(cfg.motivosNoInscripcion.length === 7 && cfg.comoConocio.length === 7 && cfg.intereses.length === 8 &&
     cfg.intereses[2] === 'Sábados' && cfg.intereses[7] === 'Baby & Me', 'las tres listas de pruebas en Config');
}

seccion('actualizar estructura sobre una base de la versión 3 (con datos)');
{
  /* Una base como la de producción el 14-oct: Niños con 14 columnas, Config
     con los 21 valores viejos (uno editado por Vida en Arte), sin Pruebas. */
  const L = new Libro('VEA_AfterSchool_BD');
  const g0 = crearEntorno({ libro: L, propiedades: { AS_CLAVE_API: CLAVE } });
  const NUEVAS = ['Colegio', 'Cómo nos conoció', 'Familia que lo refirió', 'Hermanos (edades)', 'Interés en otros servicios', 'Responsable 2', 'Teléfono responsable 2'];
  Object.keys(g0.HOJAS).filter(k => k !== 'pruebas' && k !== 'solicitudes').forEach(k => {
    const h = L.insertSheet(g0.HOJAS[k]);
    const cols = g0.COLUMNAS[k].filter(t => NUEVAS.indexOf(t) < 0);
    cols.forEach((t, i) => h.poner(5, 2 + i, t));
  });
  const N = L.getSheetByName('Niños');
  const filaVieja = ['AS-0001', '90001', 'Alma', 'Prueba Uno', new Date(2016, 2, 15), 'Mujer', '', '+50760000001', '', 'a@ejemplo.test', '90001', 'Activo', new Date(2025, 1, 1), 'nota vieja'];
  N.formatos['6,9'] = '@'; N.formatos['6,3'] = '@'; N.formatos['6,2'] = '@'; N.formatos['6,12'] = '@';
  filaVieja.forEach((v, i) => N.poner(6, 2 + i, v));
  const C = L.getSheetByName('Config');
  g0.INS_CONFIG.slice(0, 21).forEach((r, i) => r.forEach((v, j) => C.poner(6 + i, 2 + j, v)));
  C.poner(8, 3, 'Se mudó de país');     // Vida en Arte editó un motivo
  const antesNinos = JSON.stringify(N.fila(6)), antesConfig = JSON.stringify([6, 7, 8, 26].map(f => C.fila(f)));

  const inf = g0.actualizarEstructura();
  ok(!!L.getSheetByName('Pruebas') && L.getSheetByName('Pruebas').celda(5, 2) === 'ID prueba', 'crea la pestaña Pruebas');
  ok(!!L.getSheetByName('Solicitudes') && L.getSheetByName('Solicitudes').celda(5, 2) === 'ID solicitud' && /Creada: Solicitudes/.test(inf), 'crea la pestaña Solicitudes');
  ok(N.celda(5, 16) === 'Colegio' && N.celda(5, 22) === 'Teléfono responsable 2', 'agrega las 7 columnas de Niños a la derecha de Notas');
  ok(JSON.stringify(N.fila(6).slice(0, 15)) === JSON.stringify(JSON.parse(antesNinos).slice(0, 15)), 'no toca los datos del niño existente');
  ok(N.formatos['6,22'] === '@', 'la columna nueva de teléfono queda como texto');
  ok(C.getLastRow() === 5 + 21 + 26, 'Config: agrega las 22 filas de las 3 listas nuevas y los 4 parámetros de asistencia');
  ok(JSON.stringify([6, 7, 8, 26].map(f => C.fila(f))) === antesConfig, 'Config: no toca las filas que ya estaban (ni la editada)');
  ok(/Columnas agregadas al final de Niños/.test(inf) && /Creada: Pruebas/.test(inf), 'el informe dice qué agregó');
  ok(!/⚠ A la pestaña/.test(inf) && !/⚠ Config/.test(inf), 'comprobar queda sin avisos de estructura');
  const otra = g0.actualizarEstructura();
  ok(C.getLastRow() === 5 + 47 && N.getLastColumn() === 22 && /Config: completa/.test(otra), 'correrla otra vez no cambia nada');

  // Comprobar avisa de lo nuevo que falte.
  N.poner(5, 18, '');
  ok(/⚠ A la pestaña «Niños» le faltan los títulos: Familia que lo refirió/.test(g0.comprobar()), 'comprobar avisa si falta una columna nueva de Niños');
  N.poner(5, 18, 'Familia que lo refirió');
  for (let f = 6; f <= C.getLastRow(); f++) if (C.celda(f, 2) === 'Interés en servicios') C.poner(f, 2, 'Otra cosa');
  ok(/⚠ Config: falta filas «Interés en servicios»/.test(g0.comprobar()), 'comprobar avisa si falta una lista nueva de Config');
  L.getSheetByName('Pruebas').poner(5, 3, '');
  ok(/⚠ A la pestaña «Pruebas» le faltan los títulos: Fecha/.test(g0.comprobar()), 'comprobar valida la pestaña Pruebas');
}

seccion('autenticación del puente');
{
  const g = crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE } });
  g.instalar();
  ok(g.llamar('leer', {}, { key: 'otra' }).codigo === 'no_autorizado', 'clave equivocada → rechazo');
  ok(g.llamar('leer', {}, { key: undefined }).codigo === 'no_autorizado', 'sin clave → rechazo');
  ok(g.llamar('leer', {}, { usuario: '' }).codigo === 'no_autorizado', 'sin usuario → rechazo');
  ok(g.llamar('leer', {}, { usuario: '   ' }).codigo === 'no_autorizado', 'usuario en blanco → rechazo');
  ok(g.llamar('leer').ok === true, 'clave y usuario → lee');
  ok(JSON.parse(g.doGet().getContent()).ok === false, 'GET no responde datos');
  const sinClave = crearEntorno({ propiedades: {} });
  sinClave.instalar();
  ok(sinClave.llamar('leer', {}, { key: '' }).codigo === 'sin_clave', 'sin propiedad de clave → rechaza todo');
  const corta = crearEntorno({ propiedades: { AS_CLAVE_API: 'corta' } });
  corta.instalar();
  ok(corta.llamar('leer', {}, { key: 'corta' }).codigo === 'sin_clave', 'clave de menos de 24 caracteres → rechaza todo');
  ok(g.llamar('borrarTodo').ok === false, 'acción desconocida → rechazo');
  const ocupado = crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE }, lockOcupado: true });
  ocupado.instalar();
  ok(ocupado.llamar('crearNino', { nino: { nombre: 'X' } }).codigo === 'ocupado', 'sin lock → no escribe y lo dice');
  ok(ocupado._libro.getSheetByName('Niños').getLastRow() === 5, 'sin lock → la hoja queda igual');
}

seccion('ensayo y carga inicial');
{
  const carga = libroCarga();
  const g = crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE, AS_ID_CARGA: 'id-carga' }, porId: { 'id-carga': carga } });
  g.instalar();
  const ens = g.ensayarCarga();
  ok(/NO SE ESCRIBIÓ NADA/.test(ens), 'el ensayo lo dice');
  ok(g._libro.getSheetByName('Niños').getLastRow() === 5, 'el ensayo no escribe Niños');
  ok(g._libro.getSheetByName('Historial').getLastRow() === 5, 'el ensayo no escribe Historial');
  ok(/Clases: 4\b/.test(ens), 'ensayo: 4 clases');
  ok(/Niños: 5\b/.test(ens), 'ensayo: 5 niños (uno repetido fuera)');
  ok(/Por revisar: 2/.test(ens) && /Activo: 3/.test(ens), 'ensayo: niños por estado');
  ok(/Inscripciones: 4\b/.test(ens), 'ensayo: 4 inscripciones');
  ok(/sin código de clase/.test(ens) && /código repetido/.test(ens), 'rechaza clase sin código y repetida');
  ok(/número de socio repetido/.test(ens), 'rechaza socio repetido');
  ok(/socio 99999 no está/.test(ens) && /NO-EXISTE/.test(ens) && /inscripción repetida/.test(ens) && /fecha de reserva ilegible/.test(ens), 'rechaza inscripciones malas con motivo');
  ok(/fecha de nacimiento ilegible «31\/02\/2019»/.test(ens), 'el 31/02 no pasa como fecha');
  ok(/MAR-1630-PARKIDS: 0 \/ 8   ⚠ Poliwin decía 5/.test(ens), 'compara con los reservados de Poliwin');
  ok(/clases de adultos, para revisar: 1/.test(ens) && /SAB-0900-TELAS \(Adultos\): AS-0005, socio 90005/.test(ens), 'lista las inscripciones en clase de adultos');
  ok(/LUN-1630-PARKOUR: 2 \/ 3/.test(ens), 'inscripciones por clase / cupo');

  const res = g.cargaInicial();
  ok(/CARGA INICIAL — ESCRITA/.test(res), 'la carga escribe');
  const N = g._libro.getSheetByName('Niños');
  ok(N.getLastRow() === 10, '5 niños escritos desde la fila 6');
  ok(N.celda(6, 2) === 'AS-0001' && N.celda(10, 2) === 'AS-0005', 'IDs AS-0001… en orden');
  ok(N.celda(6, 3) === '90001', 'el número de socio queda como texto');
  ok(N.celda(6, 9) === '+50760000001' && N.celda(6, 10) === '', 'Móvil → Teléfono; fijo igual al móvil no se repite');
  ok(N.celda(7, 9) === '60000002' && N.celda(7, 10) === '60000099', 'Móvil 2 → Teléfono 2');
  ok(/Otro teléfono: 2000002/.test(N.celda(7, 15)) && /Alergia ficticia/.test(N.celda(7, 15)) && /Revisar \(Poliwin\): Con clase/.test(N.celda(7, 15)) && /Estado en Poliwin: BAJA/.test(N.celda(7, 15)), 'Notas: observaciones, revisar, estado y tercer teléfono');
  ok(N.celda(7, 13) === 'Por revisar' && N.celda(6, 13) === 'Activo', 'Estado según Revisar');
  ok(N.celda(8, 6) === '', 'fecha imposible queda vacía');
  ok(N.celda(6, 8) === '', 'Nombre responsable vacío');
  const I = g._libro.getSheetByName('Inscripciones');
  ok(I.getLastRow() === 9, '4 inscripciones escritas');
  ok(Object.prototype.toString.call(I.celda(6, 5)) === '[object Date]' && g.aISO_(I.celda(6, 5)) === '2026-09-01', 'fecha de alta = Reservado en Poliwin el, como fecha real');
  ok(I.celda(9, 11) === 'Por verificar: clase de adultos' && I.celda(9, 4) === 'SAB-0900-TELAS', 'la inscripción en clase de adultos lleva la nota «Por verificar»');
  ok([6, 7, 8].every(f => I.celda(f, 11) === ''), 'las demás inscripciones van sin nota');
  ok(/se cargan con la nota «Por verificar: clase de adultos»/.test(res), 'el informe dice que van marcadas');
  const C = g._libro.getSheetByName('Clases');
  ok(C.celda(6, 6) === '16:30', 'la hora de la clase queda como texto');
  ok(C.celda(6, 9) === 'Sí', 'clases cargadas como activas');
  const otra = g.cargaInicial();
  ok(/NO SE CARGÓ NADA/.test(otra) && N.getLastRow() === 10, 'la segunda carga se niega');

  const sinId = crearEntorno({ propiedades: { AS_CLAVE_API: CLAVE } });
  sinId.instalar();
  ok(/falta la propiedad del script AS_ID_CARGA/.test(sinId.ensayarCarga()), 'sin AS_ID_CARGA lo dice');
}

seccion('lectura y ocupación');
{
  const g = entornoCargado();
  const r = g.llamar('leer');
  ok(r.ok, 'leer responde');
  const d = r.resultado;
  const parkour = d.clases.find(c => c.codigo === 'LUN-1630-PARKOUR');
  ok(parkour.reservados === 2 && parkour.cupo === 3 && parkour.activa === true, 'ocupación = inscripciones activas');
  ok(d.ninos.length === 5 && d.inscripciones.length === 4, 'devuelve niños e inscripciones activas');
  ok(d.ninos[0].nacimiento === '2016-03-15', 'fechas en ISO');
  ok(d.mes === MES && d.hoy === HOY, 'mes y día de la zona del archivo');
  ok(d.usuario === 'prueba', 'devuelve el usuario que llamó');
}

seccion('crear y editar niño');
{
  const g = entornoCargado();
  let r = g.llamar('crearNino', { nino: { nombre: 'Fede', apellidos: 'Prueba Seis', nacimiento: '2018-04-30', telefono: '+50760000006' } });
  ok(r.ok && r.resultado.id === 'AS-0006', 'crea con el siguiente ID');
  const N = g._libro.getSheetByName('Niños');
  ok(N.celda(11, 13) === 'Activo' && g.aISO_(N.celda(11, 14)) === HOY, 'nuevo: Activo, ingreso hoy');
  ok(N.celda(11, 9) === '+50760000006', 'teléfono con + queda como texto');
  ok(r.estado && r.estado.ninos.length === 6, 'la escritura devuelve el estado releído');
  r = g.llamar('crearNino', { nino: { nombre: 'fede', apellidos: 'PRUEBA SEIS' } });
  ok(!r.ok && r.codigo === 'duplicado', 'mismo nombre → pide confirmar');
  r = g.llamar('crearNino', { nino: { nombre: 'fede', apellidos: 'PRUEBA SEIS' }, confirmarDuplicado: true });
  ok(r.ok && r.resultado.id === 'AS-0007', 'confirmado → crea');
  ok(!g.llamar('crearNino', { nino: { nombre: '  ' } }).ok, 'sin nombre → rechazo');
  ok(!g.llamar('crearNino', { nino: { nombre: 'X', nacimiento: '2018-02-30' } }).ok, 'fecha imposible → rechazo');

  r = g.llamar('editarNino', { id: 'AS-0001', cambios: { responsable: 'Responsable Ficticia', nacimiento: '2016-03-15' } });
  ok(r.ok && N.celda(6, 8) === 'Responsable Ficticia', 'edita el responsable');
  // Ida y vuelta: guardar la misma fecha dos veces no la mueve.
  g.llamar('editarNino', { id: 'AS-0001', cambios: { nacimiento: g.llamar('leer').resultado.ninos[0].nacimiento } });
  g.llamar('editarNino', { id: 'AS-0001', cambios: { nacimiento: g.llamar('leer').resultado.ninos[0].nacimiento } });
  ok(g.llamar('leer').resultado.ninos[0].nacimiento === '2016-03-15', 'la fecha no se corre al guardarla varias veces');
  ok(!g.llamar('editarNino', { id: 'AS-0001', cambios: { nombre: '' } }).ok, 'no deja el nombre vacío');
  ok(!g.llamar('editarNino', { id: 'AS-9999', cambios: {} }).ok, 'niño inexistente → rechazo');
  ok(!g.llamar('editarNino', { id: 'AS-0001', reactivar: true }).ok, 'reactivar solo a un Retirado');
}

seccion('inscribir');
{
  const g = entornoCargado();
  let r = g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'LUN-1630-PARKOUR' });
  ok(r.ok, 'inscribe con cupo libre (2/3 → 3/3)');
  r = g.llamar('inscribir', { idNino: 'AS-0005', codigo: 'LUN-1630-PARKOUR' });
  ok(!r.ok && r.codigo === 'llena' && /llena: 3 de 3/.test(r.error), 'clase llena → rechazo que lo dice');
  ok(g.llamar('leer').resultado.clases.find(c => c.codigo === 'LUN-1630-PARKOUR').reservados === 3, 'el rechazo no escribe');
  ok(!g.llamar('inscribir', { idNino: 'AS-0001', codigo: 'LUN-1630-PARKOUR' }).ok, 'ya inscrito → rechazo');
  ok(!g.llamar('inscribir', { idNino: 'AS-0001', codigo: 'NO-EXISTE' }).ok, 'clase inexistente → rechazo');
  const C = g._libro.getSheetByName('Clases');
  C.poner(8, 9, 'No');   // SAB-0900-TELAS inactiva
  ok(!g.llamar('inscribir', { idNino: 'AS-0001', codigo: 'SAB-0900-TELAS' }).ok, 'clase inactiva → rechazo');
  const I = g._libro.getSheetByName('Inscripciones');
  ok(I.celda(10, 9) === 'prueba' && Object.prototype.toString.call(I.celda(10, 10)) === '[object Date]', 'guarda quién y cuándo');
  const H = g._libro.getSheetByName('Historial');
  ok(H.getLastRow() >= 7 && H.celda(H.getLastRow(), 3) === 'prueba' && H.celda(H.getLastRow(), 4) === 'Inscribir', 'deja fila en Historial');
}

seccion('mover');
{
  const g = entornoCargado();
  const insAna = g.llamar('leer').resultado.inscripciones.find(i => i.idNino === 'AS-0001');
  let r = g.llamar('mover', { idInscripcion: insAna.id, codigoNuevo: 'LUN-1630-TELAS', fecha: HOY });
  ok(r.ok, 'mueve de clase');
  let d = r.estado;
  ok(d.clases.find(c => c.codigo === 'LUN-1630-PARKOUR').reservados === 1 && d.clases.find(c => c.codigo === 'LUN-1630-TELAS').reservados === 2, 'la ocupación pasa de una a otra');
  const I = g._libro.getSheetByName('Inscripciones');
  const vieja = [6, 7, 8, 9, 10].find(f => I.celda(f, 2) === insAna.id);
  ok(I.celda(vieja, 7) === 'Cambio de clase' && /A LUN-1630-TELAS/.test(I.celda(vieja, 8)), 'la vieja se cierra con «Cambio de clase»');
  ok(g._libro.getSheetByName('Bajas').getLastRow() === 5, 'mover no escribe en Bajas');
  // Telas está llena (2/2): mover ahí se rechaza sin tocar nada.
  const insDani = d.inscripciones.find(i => i.idNino === 'AS-0004');
  const antes = I.getLastRow();
  r = g.llamar('mover', { idInscripcion: insDani.id, codigoNuevo: 'LUN-1630-TELAS', fecha: HOY });
  ok(!r.ok && r.codigo === 'llena', 'destino lleno → rechazo');
  ok(I.getLastRow() === antes && g.llamar('leer').resultado.inscripciones.some(i => i.id === insDani.id), 'el rechazo no cierra la vieja');
  ok(!g.llamar('mover', { idInscripcion: insDani.id, codigoNuevo: 'MAR-1630-PARKIDS', fecha: MANANA }).ok, 'mover con fecha futura → rechazo');
  ok(!g.llamar('mover', { idInscripcion: insDani.id, codigoNuevo: 'LUN-1630-PARKOUR', fecha: HOY }).ok, 'mover a la misma clase → rechazo');
}

seccion('bajas');
{
  const g = entornoCargado();
  const ins = g.llamar('leer').resultado.inscripciones;
  const i1 = ins.find(i => i.idNino === 'AS-0004');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, fecha: HOY }).ok, 'sin motivo → rechazo');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, motivo: 'Horario' }).ok, 'sin fecha → rechazo');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, fecha: HOY, motivo: 'Me aburrí' }).ok, 'motivo fuera de Config → rechazo');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, fecha: MANANA, motivo: 'Horario' }).ok, 'fecha futura → rechazo');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, fecha: '2026-08-01', motivo: 'Horario' }).ok, 'baja anterior al alta → rechazo');
  let r = g.llamar('bajaClase', { idInscripcion: i1.id, fecha: HOY, motivo: 'horario', detalle: 'cambia de turno' });
  ok(r.ok, 'baja de una clase');
  ok(r.estado.clases.find(c => c.codigo === 'LUN-1630-PARKOUR').reservados === 1, 'libera el cupo');
  ok(r.estado.ninos.find(n => n.id === 'AS-0004').estado === 'Activo', 'la baja de una clase no retira al niño');
  ok(g._libro.getSheetByName('Bajas').getLastRow() === 5, 'la baja de una clase no va a Bajas');
  ok(!g.llamar('bajaClase', { idInscripcion: i1.id, fecha: HOY, motivo: 'Horario' }).ok, 'dar de baja dos veces → rechazo');

  r = g.llamar('bajaTotal', { idNino: 'AS-0001', fecha: HOY, motivo: 'Precio' });
  ok(r.ok && r.resultado.clasesCerradas === 1, 'baja total cierra sus clases');
  ok(r.estado.ninos.find(n => n.id === 'AS-0001').estado === 'Retirado', 'baja total → Retirado');
  const B = g._libro.getSheetByName('Bajas');
  ok(B.getLastRow() === 6 && B.celda(6, 2) === 'AS-0001' && B.celda(6, 4) === 'Precio' && B.celda(6, 6) === 'prueba', 'fila en Bajas con motivo y usuario');
  ok(!g.llamar('inscribir', { idNino: 'AS-0001', codigo: 'MAR-1630-PARKIDS' }).ok, 'no inscribe a un Retirado');
  ok(g.llamar('editarNino', { id: 'AS-0001', reactivar: true }).ok, 'reactivar a un Retirado');
  ok(g.llamar('inscribir', { idNino: 'AS-0001', codigo: 'MAR-1630-PARKIDS' }).ok, 'reactivado → se inscribe');
}

seccion('por revisar');
{
  const g = entornoCargado();
  ok(!g.llamar('revisar', { idNino: 'AS-0001', estado: 'Activo' }).ok, 'solo a los «Por revisar»');
  let r = g.llamar('revisar', { idNino: 'AS-0003', estado: 'Activo' });
  ok(r.ok && r.estado.ninos.find(n => n.id === 'AS-0003').estado === 'Activo', 'Por revisar → Activo');
  ok(!g.llamar('revisar', { idNino: 'AS-0002', estado: 'Retirado', fecha: HOY }).ok, 'Retirado sin motivo → rechazo');
  r = g.llamar('revisar', { idNino: 'AS-0002', estado: 'Retirado', fecha: HOY, motivo: 'Se mudó' });
  ok(r.ok && r.estado.ninos.find(n => n.id === 'AS-0002').estado === 'Retirado' && r.resultado.clasesCerradas === 1, 'Por revisar → Retirado cierra sus clases');
  ok(g._libro.getSheetByName('Bajas').getLastRow() === 6, 'y deja fila en Bajas');
  ok(!g.llamar('revisar', { idNino: 'AS-0005', estado: 'Otro' }).ok, 'estado inválido → rechazo');
}

seccion('nota de inscripción');
{
  const g = entornoCargado();
  const adulta = g.llamar('leer').resultado.inscripciones.find(i => i.codigo === 'SAB-0900-TELAS');
  ok(adulta && adulta.nota === 'Por verificar: clase de adultos', 'leer devuelve la nota de la inscripción');
  let r = g.llamar('notaInscripcion', { idInscripcion: adulta.id, nota: '' });
  ok(r.ok && r.estado.inscripciones.find(i => i.id === adulta.id).nota === '', 'quitar la nota');
  ok(r.estado.clases.find(c => c.codigo === 'SAB-0900-TELAS').reservados === 1, 'quitar la nota no cambia la ocupación');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow(), 4) === 'Quitar nota de inscripción' && /antes: «Por verificar/.test(H.celda(H.getLastRow(), 6)), 'el Historial guarda la nota que se quitó');
  ok(!g.llamar('notaInscripcion', { idInscripcion: 'INS-9999', nota: '' }).ok, 'inscripción inexistente → rechazo');
}

seccion('pagos');
{
  const g = entornoCargado();
  const base = { idNino: 'AS-0001', mes: MES, concepto: 'Mensualidad', plan: '8 clases', monto: '128,40', fechaPago: HOY, forma: 'Yappy' };
  let r = g.llamar('registrarPago', base);
  ok(r.ok && r.resultado.id === 'PAG-0001', 'registra el pago');
  const P = g._libro.getSheetByName('Pagos');
  ok(P.celda(6, 4) === MES, 'el mes queda como texto AAAA-MM, no como fecha');
  ok(P.celda(6, 7) === 128.4, 'monto con coma decimal → 128,4');
  ok(P.celda(6, 10) === 'prueba', 'guarda quién registró');
  ok(r.estado.pagosMes.length === 1 && r.estado.pagosMes[0].idNino === 'AS-0001', 'aparece en los pagos del mes');
  r = g.llamar('registrarPago', base);
  ok(!r.ok && r.codigo === 'duplicado', 'misma mensualidad del mes → pide confirmar');
  ok(g.llamar('registrarPago', Object.assign({ confirmarDuplicado: true }, base)).ok, 'confirmado → registra');
  ok(!g.llamar('registrarPago', Object.assign({}, base, { monto: '0' })).ok, 'monto cero → rechazo');
  ok(!g.llamar('registrarPago', Object.assign({}, base, { monto: 'abc' })).ok, 'monto ilegible → rechazo');
  ok(!g.llamar('registrarPago', Object.assign({}, base, { forma: 'Bitcoin' })).ok, 'forma fuera de Config → rechazo');
  ok(!g.llamar('registrarPago', Object.assign({}, base, { plan: '99 clases' })).ok, 'plan fuera de Config → rechazo');
  ok(!g.llamar('registrarPago', Object.assign({}, base, { mes: '2026-13' })).ok, 'mes inválido → rechazo');
  ok(g.llamar('registrarPago', Object.assign({}, base, { concepto: 'Matrícula', plan: '' })).ok, 'plan es opcional');
  r = g.llamar('listarPagos', { mes: MES });
  ok(r.ok && r.resultado.pagos.length === 3, 'lista los pagos del mes');
  ok(g.llamar('listarPagos', { mes: '2020-01' }).resultado.pagos.length === 0, 'otro mes, vacío');
  ok(r.resultado.pagos[0].monto === 128.4, 'el monto vuelve como número');
}

/* La próxima fecha (hoy incluido) que cae en ese día de la semana. */
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function proximo(dia, desdeManana) {
  const d = new Date(); if (desdeManana) d.setDate(d.getDate() + 1);
  while (DIAS[(d.getDay() + 6) % 7] !== dia) d.setDate(d.getDate() + 1);
  return iso(d);
}
const DIA_HOY = DIAS[(new Date().getDay() + 6) % 7];
/* Agrega una clase que se dicta HOY, para probar lo que solo vale el día de la prueba. */
function claseDeHoy(g, codigo, cupo) {
  const C = g._libro.getSheetByName('Clases');
  const f = C.getLastRow() + 1;
  C.formatos[f + ',2'] = '@'; C.formatos[f + ',6'] = '@';
  ['', codigo, 'Telas', 'Semana', DIA_HOY, '20:00', cupo, '6 a 14', 'Sí'].forEach((v, i) => { if (i) C.poner(f, 1 + i, v); });
}
const NINO_NUEVO = { nombre: 'Gabi', apellidos: 'Prospecto Ficticio', nacimiento: '2018-06-01', responsable: 'Responsable Ficticia', telefono: '+50760000077' };

seccion('clases de prueba: agendar');
{
  const g = entornoCargado();
  const lunes = proximo('Lunes', true), martes = proximo('Martes', true);
  let r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nino: { nombre: 'Gabi' } });
  ok(!r.ok && /Faltan datos obligatorios del niño: apellidos, fecha nacimiento, nombre responsable, teléfono/.test(r.error), 'pide los datos obligatorios del niño nuevo');
  ok(!g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: '2020-01-06', nino: NINO_NUEVO }).ok, 'fecha pasada → rechazo');
  r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: martes, nino: NINO_NUEVO });
  ok(!r.ok && /es los lunes y el .* es martes/.test(r.error), 'fecha que no es el día de la clase → rechazo');
  ok(!g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nino: Object.assign({ comoConocio: 'TikTok' }, NINO_NUEVO) }).ok, '«cómo nos conoció» fuera de Config → rechazo');
  ok(!g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nino: Object.assign({ interes: ['Natación'] }, NINO_NUEVO) }).ok, 'interés fuera de Config → rechazo');
  ok(g._libro.getSheetByName('Niños').getLastRow() === 10, 'los rechazos no crean al niño');

  r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nota: 'viene con la abuela',
    nino: Object.assign({ comoConocio: 'instagram', interes: ['Parkour', 'baby & me'], colegio: 'Colegio Ficticio', responsable2: 'Otro Ficticio', telefonoResp2: '+50760000078' }, NINO_NUEVO) });
  ok(r.ok && r.resultado.id === 'PRU-0001' && r.resultado.idNino === 'AS-0006', 'agenda la prueba y crea al niño');
  const nuevo = r.estado.ninos.find(n => n.id === 'AS-0006');
  ok(nuevo.estado === 'Prospecto' && nuevo.ingreso === '', 'el niño nuevo queda Prospecto, sin fecha de ingreso');
  ok(nuevo.comoConocio === 'Instagram' && nuevo.interes === 'Parkour, Baby & Me' && nuevo.telefonoResp2 === '+50760000078', 'guarda los datos opcionales con la grafía de Config');
  const P = g._libro.getSheetByName('Pruebas');
  ok(P.celda(6, 2) === 'PRU-0001' && g.aISO_(P.celda(6, 3)) === lunes && P.celda(6, 6) === 'Agendada' && P.celda(6, 9) === 'viene con la abuela' && P.celda(6, 10) === 'prueba', 'fila en Pruebas');
  const H = g._libro.getSheetByName('Historial'), uh = H.getLastRow();
  ok(H.celda(uh - 1, 4) === 'Crear prospecto' && H.celda(uh, 4) === 'Agendar prueba' && H.celda(uh, 5) === 'PRU-0001', 'Historial: crear prospecto y agendar prueba');
  const pr = r.estado.pruebas[0];
  ok(pr.fecha === lunes && pr.codigo === 'LUN-1630-TELAS' && pr.estado === 'Agendada', 'leer devuelve la prueba');

  // LUN-1630-TELAS: cupo 2, Beto inscrito + la prueba de Gabi = llena ese lunes.
  r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, idNino: 'AS-0003' });
  ok(!r.ok && r.codigo === 'llena' && /llena el .*: 1 \+ 1 prueba de 2 cupos/.test(r.error), 'clase llena ese día → rechazo que lo dice');
  const otroLunes = (() => { const d = new Date(lunes + 'T12:00:00'); d.setDate(d.getDate() + 7); return iso(d); })();
  ok(g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: otroLunes, idNino: 'AS-0003' }).ok, 'otro lunes sí hay cupo: la prueba ocupa solo su día');
  ok(!g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: otroLunes, idNino: 'AS-0003' }).ok, 'la misma prueba dos veces → rechazo');
  ok(!g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: otroLunes, idNino: 'AS-0002' }).ok, 'un niño ya inscrito en esa clase → rechazo');
  r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-PARKOUR', fecha: lunes, nino: Object.assign({}, NINO_NUEVO, { telefono: '1' }) });
  ok(!r.ok && r.codigo === 'duplicado', 'mismo nombre que otro niño → pide confirmar');
  ok(g.llamar('agendarPrueba', { codigo: 'LUN-1630-PARKOUR', fecha: lunes, nino: Object.assign({}, NINO_NUEVO, { telefono: '1' }), confirmarDuplicado: true }).ok, 'confirmado → agenda');
}

seccion('clases de prueba: resultado');
{
  const g = entornoCargado();
  const lunes = proximo('Lunes', true);
  const r0 = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nino: NINO_NUEVO });
  const id = r0.resultado.id;
  let r = g.llamar('resultadoPrueba', { idPrueba: id, estado: 'Asistió' });
  ok(!r.ok && /se marca desde el día de la prueba/.test(r.error), 'Asistió antes del día de la prueba → rechazo');
  ok(!g.llamar('resultadoPrueba', { idPrueba: id, estado: 'No asistió' }).ok, 'No asistió antes del día → rechazo');
  ok(!g.llamar('resultadoPrueba', { idPrueba: id, estado: 'Quizás' }).ok, 'resultado inválido → rechazo');
  r = g.llamar('resultadoPrueba', { idPrueba: id, estado: 'Cancelada' });
  ok(r.ok && r.estado.pruebas[0].estado === 'Cancelada', 'Cancelada se puede marcar antes');
  ok(g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, idNino: 'AS-0003' }).ok, 'la cancelada libera el cupo de ese día');

  claseDeHoy(g, 'HOY-2000-TELAS', 5);
  const rh = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0006' });
  ok(rh.ok, 'agenda una prueba para hoy');
  ok(/el motivo es obligatorio/.test(g.llamar('resultadoPrueba', { idPrueba: rh.resultado.id, estado: 'Asistió', seInscribio: 'No' }).error), 'No sin motivo → rechazo que lo dice');
  ok(!g.llamar('resultadoPrueba', { idPrueba: rh.resultado.id, estado: 'Asistió', seInscribio: 'No', motivo: 'Me caía mal' }).ok, 'motivo fuera de Config → rechazo');
  r = g.llamar('resultadoPrueba', { idPrueba: rh.resultado.id, estado: 'Asistió', seInscribio: 'No', motivo: 'precio', nota: 'lo va a hablar' });
  const p = r.estado.pruebas.find(x => x.id === rh.resultado.id);
  ok(r.ok && p.estado === 'Asistió' && p.seInscribio === 'No' && p.motivo === 'Precio' && p.nota === 'lo va a hablar', 'Asistió, No, motivo y nota');
  ok(r.estado.ninos.find(n => n.id === 'AS-0006').estado === 'Prospecto', '«No se inscribió» deja al niño Prospecto');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow(), 4) === 'Resultado de prueba' && /Asistió · se inscribió: No · Precio/.test(H.celda(H.getLastRow(), 6)), 'Historial del resultado');
  r = g.llamar('resultadoPrueba', { idPrueba: rh.resultado.id, estado: 'Asistió', seInscribio: 'Sí' });
  ok(r.ok && r.estado.pruebas.find(x => x.id === rh.resultado.id).motivo === '', 'cambiar a Sí borra el motivo');
  ok(g.llamar('resultadoPrueba', { idPrueba: rh.resultado.id, estado: 'Asistió', seInscribio: 'Sí' }).resultado.sinCambios, 'sin cambios no escribe');
  r = g.llamar('inscribir', { idNino: 'AS-0006', codigo: 'HOY-2000-TELAS' });
  const n6 = r.estado.ninos.find(n => n.id === 'AS-0006');
  ok(r.ok && n6.estado === 'Activo' && n6.ingreso === HOY, 'al inscribirse, el Prospecto pasa a Activo con fecha de ingreso');
  ok(H.celda(H.getLastRow(), 4) === 'Prospecto → Activo', 'Historial del cambio de estado');
  ok(!g.llamar('resultadoPrueba', { idPrueba: 'PRU-9999', estado: 'Cancelada' }).ok, 'prueba inexistente → rechazo');
}

seccion('inscribir varias');
{
  const g = entornoCargado();
  let r = g.llamar('inscribirVarias', { idNino: 'AS-0003', codigos: ['LUN-1630-PARKOUR', 'MAR-1630-PARKIDS'] });
  ok(r.ok && r.resultado.ids.length === 2, 'inscribe en dos clases de una vez');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow(), 4) === 'Inscribir' && H.celda(H.getLastRow() - 1, 4) === 'Inscribir', 'una fila de Historial por clase');
  // LUN-1630-PARKOUR ahora 3/3: pedir otra libre + esa llena no guarda ninguna.
  const I = g._libro.getSheetByName('Inscripciones'), antes = I.getLastRow();
  r = g.llamar('inscribirVarias', { idNino: 'AS-0005', codigos: ['MAR-1630-PARKIDS', 'LUN-1630-PARKOUR'] });
  ok(!r.ok && /No se inscribió en ninguna de las 2 clases/.test(r.error) && /LUN-1630-PARKOUR está llena: 3 de 3/.test(r.error), 'si una está llena no guarda ninguna y dice cuál');
  ok(I.getLastRow() === antes, 'todo o nada: no escribió ninguna fila');
  ok(!g.llamar('inscribirVarias', { idNino: 'AS-0005', codigos: [] }).ok, 'sin clases → rechazo');
  ok(!g.llamar('inscribirVarias', { idNino: 'AS-0005', codigos: ['MAR-1630-PARKIDS'], fechaAlta: MANANA }).ok, 'inscribir varias con alta futura → rechazo');
  ok(!g.llamar('inscribir', { idNino: 'AS-0005', codigo: 'MAR-1630-PARKIDS', fechaAlta: MANANA }).ok, 'inscribir con alta futura → rechazo');
  ok(g.llamar('inscribir', { idNino: 'AS-0005', codigo: 'MAR-1630-PARKIDS', fechaAlta: AYER }).ok, 'alta de ayer sí');
}

seccion('las pruebas futuras cuentan al inscribir y al mover');
{
  const g = entornoCargado();
  const lunes = proximo('Lunes', true);
  // LUN-1630-PARKOUR: 2 inscritos de 3. Una prueba el lunes lo deja lleno ese día.
  const rp = g.llamar('agendarPrueba', { codigo: 'LUN-1630-PARKOUR', fecha: lunes, nino: NINO_NUEVO });
  ok(rp.ok, 'prueba agendada');
  let r = g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'LUN-1630-PARKOUR' });
  ok(!r.ok && r.codigo === 'llena' && /no tiene cupo el .* por las pruebas agendadas ese día \(2 \+ 1 prueba de 3 cupos\)/.test(r.error), 'inscribir choca con la prueba de una fecha próxima y dice cuál');
  const insBeto = r && g.llamar('leer').resultado.inscripciones.find(i => i.idNino === 'AS-0002');
  r = g.llamar('mover', { idInscripcion: insBeto.id, codigoNuevo: 'LUN-1630-PARKOUR', fecha: HOY });
  ok(!r.ok && /por las pruebas agendadas/.test(r.error), 'mover también choca con la prueba');
  ok(!g.llamar('mover', { idInscripcion: insBeto.id, codigoNuevo: 'MAR-1630-PARKIDS', fecha: MANANA }).ok, 'mover con fecha futura → rechazo');
  r = g.llamar('inscribir', { idNino: rp.resultado.idNino, codigo: 'LUN-1630-PARKOUR' });
  ok(r.ok, 'la prueba del propio niño no le cierra el cupo');
}
{
  // Cupo 2, sin inscritos; el mismo día prueban X (AS-0003) e Y (AS-0005).
  // Inscribir a X: 0 inscritos + la prueba de Y + X = 2 → cabe. Si la prueba
  // de X contara contra él serían 3.
  const g = entornoCargado();
  claseDeHoy(g, 'HOY-2000-TELAS', 2);
  ok(g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0003' }).ok &&
     g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0005' }).ok, 'dos pruebas hoy');
  ok(g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'HOY-2000-TELAS' }).ok, 'con otra prueba el mismo día, la propia sigue sin contar');
}

seccion('ocupación en una fecha');
{
  const g = entornoCargado();
  const ins = g.leerTabla_('inscripciones'), pr = g.leerTabla_('pruebas');
  const I = g._libro.getSheetByName('Inscripciones');
  // Alma (alta 01/09/2026) se da de baja con fecha 2026-09-10 (escrita a mano para la prueba).
  I.poner(6, 6, new Date(2026, 8, 10));
  const ins2 = g.leerTabla_('inscripciones');
  ok(g.ocupacionEn_('LUN-1630-PARKOUR', '2026-08-31', ins2, pr).inscritos === 0, 'antes del alta no cuenta');
  ok(g.ocupacionEn_('LUN-1630-PARKOUR', '2026-09-07', ins2, pr).inscritos === 2, 'entre alta y baja cuenta');
  ok(g.ocupacionEn_('LUN-1630-PARKOUR', '2026-09-10', ins2, pr).inscritos === 1, 'el día de la baja ya no cuenta');
  const d = g.llamar('leer').resultado;
  ok(d.inscripcionesCerradas.length === 1 && d.inscripcionesCerradas[0].baja === '2026-09-10' && d.inscripciones.length === 3, 'leer separa activas y cerradas');
  ok(ins.filas.length === 4, '(control)');
}

seccion('baja total cancela las pruebas agendadas');
{
  const g = entornoCargado();
  const lunes = proximo('Lunes', true), otroLunes = (() => { const d = new Date(lunes + 'T12:00:00'); d.setDate(d.getDate() + 7); return iso(d); })();
  claseDeHoy(g, 'HOY-2000-TELAS', 5);
  // Dani (AS-0004): una prueba hoy, una el lunes (con nota), una el otro lunes ya Cancelada,
  // y una de hoy marcada Asistió (de otro niño, para controlar que no se toque).
  const pHoy = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0004' }).resultado.id;
  const pLun = g.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: proximo('Martes', true), idNino: 'AS-0004', nota: 'trae ropa cómoda' }).resultado.id;
  const pCan = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: otroLunes, idNino: 'AS-0004' }).resultado.id;
  g.llamar('resultadoPrueba', { idPrueba: pCan, estado: 'Cancelada' });
  const pOtro = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0005' }).resultado.id;
  g.llamar('resultadoPrueba', { idPrueba: pOtro, estado: 'Asistió' });
  // Una prueba PASADA y Agendada de Dani, escrita a mano (no se puede agendar en pasado).
  const P = g._libro.getSheetByName('Pruebas'), fp = P.getLastRow() + 1;
  ['', 'PRU-0090', new Date(2026, 8, 1), 'LUN-1630-PARKOUR', 'AS-0004', 'Agendada', '', '', '', 'x', new Date()].forEach((v, i) => { if (i) { P.formatos[fp + ',' + (i + 1)] = (i === 1 || i === 3 || i === 4) ? '@' : undefined; P.poner(fp, i + 1, v); } });

  const ocupAntes = g.llamar('leer').resultado;
  const cHoy = ocupAntes.clases.find(c => c.codigo === 'HOY-2000-TELAS');
  ok(cHoy && g.ocupacionEn_('HOY-2000-TELAS', HOY, g.leerTabla_('inscripciones'), g.leerTabla_('pruebas')).pruebas === 2, '(control) 2 pruebas hoy en la clase');

  // bajaClase NO cancela pruebas.
  const insDani = ocupAntes.inscripciones.find(i => i.idNino === 'AS-0004');
  let r = g.llamar('bajaClase', { idInscripcion: insDani.id, fecha: HOY, motivo: 'Horario' });
  ok(r.ok && r.estado.pruebas.filter(p => p.idNino === 'AS-0004' && p.estado === 'Agendada').length === 3, 'la baja de una clase no cancela pruebas');

  r = g.llamar('bajaTotal', { idNino: 'AS-0004', fecha: HOY, motivo: 'Precio' });
  ok(r.ok && r.resultado.pruebasCanceladas === 2, 'baja total: cancela las 2 pruebas Agendadas de hoy en adelante');
  const pr = id => r.estado.pruebas.find(p => p.id === id);
  ok(pr(pHoy).estado === 'Cancelada' && pr(pHoy).nota === 'Cancelada por baja total', 'la de hoy queda Cancelada con la nota');
  ok(pr(pLun).estado === 'Cancelada' && pr(pLun).nota === 'trae ropa cómoda · Cancelada por baja total', 'la próxima queda Cancelada y conserva su nota');
  ok(pr('PRU-0090').estado === 'Agendada', 'la pasada sin resultado no se toca');
  ok(pr(pCan).estado === 'Cancelada' && pr(pCan).nota === '', 'la que ya estaba Cancelada no se toca');
  ok(pr(pOtro).estado === 'Asistió', 'las pruebas de otro niño no se tocan');
  ok(g.ocupacionEn_('HOY-2000-TELAS', HOY, g.leerTabla_('inscripciones'), g.leerTabla_('pruebas')).pruebas === 1, 'libera el cupo de ese día');
  const H = g._libro.getSheetByName('Historial'), u = H.getLastRow();
  ok(H.celda(u - 2, 4) === 'Baja total' && /2 prueba\(s\) canceladas/.test(H.celda(u - 2, 6)) &&
     H.celda(u - 1, 4) === 'Cancelar prueba' && H.celda(u, 4) === 'Cancelar prueba' && /Cancelada por baja total/.test(H.celda(u, 6)), 'Historial: la baja y una fila por prueba cancelada');
  ok(r.estado.ninos.find(n => n.id === 'AS-0004').estado === 'Retirado', 'y el niño queda Retirado');

  // Un rechazo de la baja total no cancela nada (todo o nada).
  const g2 = entornoCargado();
  const p2 = g2.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: proximo('Martes', true), idNino: 'AS-0004' }).resultado.id;
  ok(!g2.llamar('bajaTotal', { idNino: 'AS-0004', fecha: HOY, motivo: 'Inventado' }).ok, 'baja total con motivo inválido → rechazo');
  ok(g2.llamar('leer').resultado.pruebas.find(p => p.id === p2).estado === 'Agendada', 'el rechazo no cancela la prueba');
  // Por revisar → Retirado también es una baja total.
  const p3 = g2.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: proximo('Martes', true), idNino: 'AS-0002' }).resultado.id;
  r = g2.llamar('revisar', { idNino: 'AS-0002', estado: 'Retirado', fecha: HOY, motivo: 'Se mudó' });
  ok(r.ok && r.estado.pruebas.find(p => p.id === p3).estado === 'Cancelada', '«Por revisar → Retirado» también cancela sus pruebas agendadas');
}

seccion('comas en la lista «Interés en servicios»');
{
  const g = entornoCargado();
  const C = g._libro.getSheetByName('Config'), f = C.getLastRow() + 1;
  ['', 'Interés en servicios', 'Teatro, danza', '', ''].forEach((v, i) => { if (i) C.poner(f, i + 1, v); });
  const cfg = g.llamar('leer').resultado.config;
  ok(cfg.intereses.indexOf('Teatro, danza') < 0 && cfg.intereses.length === 8, 'el valor con coma no se ofrece');
  ok(cfg.avisos.length === 1 && /«Teatro, danza».*tiene una coma/.test(cfg.avisos[0]) && cfg.faltan.length === 0, 'leer lo avisa (sin contarlo como faltante)');
  ok(/⚠ Config: el valor «Teatro, danza» de la lista «Interés en servicios» tiene una coma/.test(g.comprobar()), 'Comprobar estructura lo marca con ⚠');
  let r = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: proximo('Lunes', true), nino: Object.assign({ interes: ['Parkour', 'Teatro, danza'] }, NINO_NUEVO) });
  ok(!r.ok && /«Teatro, danza» tiene una coma/.test(r.error), 'al guardar, un interés con coma se rechaza con mensaje claro');
  ok(g._libro.getSheetByName('Niños').getLastRow() === 10, 'y no crea al niño');
  r = g.llamar('editarNino', { id: 'AS-0001', cambios: { interes: ['Teatro, danza'] } });
  ok(!r.ok && /tiene una coma/.test(r.error), 'editar con un interés con coma → rechazo');
  ok(g.llamar('editarNino', { id: 'AS-0001', cambios: { interes: ['Parkour', 'Telas'] } }).ok, 'los valores sin coma se guardan');
  // Una coma en otra lista (motivo de baja) no molesta: esos valores van uno por celda.
  ['', 'Motivo baja', 'Precio, horario', '', ''].forEach((v, i) => { if (i) C.poner(f + 1, i + 1, v); });
  ok(g.llamar('leer').resultado.config.motivos.indexOf('Precio, horario') >= 0, 'otras listas aceptan comas (se guardan un valor por celda)');
}

seccion('escrituras idempotentes: el mismo ID de solicitud se ejecuta una sola vez');
{
  const g = entornoCargado();
  const L = g._libro, I = L.getSheetByName('Inscripciones'), H = L.getSheetByName('Historial'), S = L.getSheetByName('Solicitudes');
  const ID = 'a1b2c3d4-0000-4000-8000-000000000001';
  const datos = { idNino: 'AS-0003', codigo: 'LUN-1630-PARKOUR' };
  const insAntes = I.getLastRow(), hAntes = H.getLastRow();
  const r1 = g.llamar('inscribir', datos, { idSolicitud: ID });
  ok(r1.ok && !r1.repetida, 'primera vez: se ejecuta');
  ok(I.getLastRow() === insAntes + 1 && H.getLastRow() === hAntes + 1, 'una inscripción y una fila de Historial');
  ok(S.getLastRow() === 6 && S.celda(6, 2) === ID && S.celda(6, 3) === 'inscribir' && /^[0-9a-f]{64}$/.test(S.celda(6, 4)) &&
     JSON.parse(S.celda(6, 5)).id === r1.resultado.id && S.celda(6, 6) === 'prueba' && Object.prototype.toString.call(S.celda(6, 7)) === '[object Date]',
     'Solicitudes guarda ID, acción, huella, resultado, usuario y fecha');
  ok(JSON.stringify(S.fila(6)).indexOf('AS-0003') < 0 && JSON.stringify(S.fila(6)).indexOf('LUN-1630') < 0, 'Solicitudes no guarda los datos, solo su huella');

  // Reintento con el mismo ID (respuesta perdida, o doble clic que llegó).
  const r2 = g.llamar('inscribir', datos, { idSolicitud: ID });
  ok(r2.ok && r2.repetida === true && r2.resultado.id === r1.resultado.id, 'el reintento devuelve el resultado guardado y avisa que es repetida');
  ok(I.getLastRow() === insAntes + 1 && H.getLastRow() === hAntes + 1 && S.getLastRow() === 6, 'y no ejecuta nada: ni inscripción, ni Historial, ni otra fila de Solicitudes');
  ok(r2.estado.clases.find(c => c.codigo === 'LUN-1630-PARKOUR').reservados === 3, 'trae el estado actual para la página');
  const r2b = g.llamar('inscribir', { codigo: 'LUN-1630-PARKOUR', idNino: 'AS-0003' }, { idSolicitud: ID });
  ok(r2b.ok && r2b.repetida === true, 'los mismos datos en otro orden son la misma solicitud');

  // Mismo ID con otros datos u otra acción: se rechaza sin escribir.
  const r3 = g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'MAR-1630-PARKIDS' }, { idSolicitud: ID });
  ok(!r3.ok && r3.codigo === 'id_repetido' && /otra operación distinta/.test(r3.error), 'mismo ID con datos distintos → rechazo con mensaje claro');
  const r4 = g.llamar('notaInscripcion', { idInscripcion: r1.resultado.id, nota: 'x' }, { idSolicitud: ID });
  ok(!r4.ok && r4.codigo === 'id_repetido', 'mismo ID en otra acción → rechazo');
  ok(I.getLastRow() === insAntes + 1 && H.getLastRow() === hAntes + 1, 'los rechazos no escriben');
  ok(g.llamar('inscribir', datos, { idSolicitud: 'corto' }).codigo === 'id_invalido', 'ID con formato inválido → rechazo');
  ok(g.llamar('leer', {}, { idSolicitud: 'no-importa-en-lecturas' }).ok && g.llamar('listarPagos', { mes: MES }, { idSolicitud: 'no-importa-en-lecturas' }).ok &&
     S.getLastRow() === 6, 'las lecturas ignoran el ID (no registran nada en Solicitudes)');
}
{
  // Sin ID: exactamente como antes (dos llamadas = dos escrituras).
  const g = entornoCargado();
  const N = g._libro.getSheetByName('Niños'), S = g._libro.getSheetByName('Solicitudes');
  const nino = { nino: { nombre: 'Gemelo', apellidos: 'Ficticio' }, confirmarDuplicado: true };
  g.llamar('crearNino', nino); g.llamar('crearNino', nino);
  ok(N.getLastRow() === 12 && S.getLastRow() === 5, 'sin ID: dos llamadas crean dos niños y no tocan Solicitudes');
  const ID = 'b2c3d4e5-0000-4000-8000-000000000002';
  g.llamar('crearNino', nino, { idSolicitud: ID }); g.llamar('crearNino', nino, { idSolicitud: ID });
  ok(N.getLastRow() === 13 && S.getLastRow() === 6, 'con ID: dos llamadas crean un solo niño');
}
{
  // La primera ejecución todavía corre cuando llega el reintento: el reintento
  // espera el lock; si no lo consigue, no escribe nada; cuando lo consigue,
  // encuentra el ID.
  const g = entornoCargado();
  const P = g._libro.getSheetByName('Pagos'), H = g._libro.getSheetByName('Historial');
  const ID = 'c3d4e5f6-0000-4000-8000-000000000003';
  const pago = { idNino: 'AS-0001', mes: MES, concepto: 'Mensualidad', plan: '8 clases', monto: 128.4, fechaPago: HOY, forma: 'Yappy' };
  const r1 = g.llamar('registrarPago', pago, { idSolicitud: ID });
  const hTras = H.getLastRow();
  g._lock.ocupado = true;
  const rOcupado = g.llamar('registrarPago', pago, { idSolicitud: ID });
  ok(!rOcupado.ok && rOcupado.codigo === 'ocupado' && P.getLastRow() === 6, 'con el lock tomado, el reintento no escribe nada');
  g._lock.ocupado = false;
  const r2 = g.llamar('registrarPago', pago, { idSolicitud: ID });
  ok(r2.ok && r2.repetida && r2.resultado.id === r1.resultado.id && P.getLastRow() === 6 && H.getLastRow() === hTras, 'con el lock libre, encuentra el ID: un solo pago y una sola fila de Historial');
}
{
  // La primera nunca llegó a correr: el reintento la ejecuta una vez.
  const g = entornoCargado();
  const ID = 'd4e5f6a7-0000-4000-8000-000000000004';
  const B = g._libro.getSheetByName('Bajas'), S = g._libro.getSheetByName('Solicitudes');
  const lunes = proximo('Martes', true);
  const pr = g.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: lunes, idNino: 'AS-0004' }).resultado.id;
  const baja = { idNino: 'AS-0004', fecha: HOY, motivo: 'Precio' };
  const r1 = g.llamar('bajaTotal', baja, { idSolicitud: ID });
  ok(r1.ok && !r1.repetida && B.getLastRow() === 6 && S.getLastRow() === 6, 'el «reintento» de una que nunca corrió se ejecuta una vez');
  const H = g._libro.getSheetByName('Historial'), hTras = H.getLastRow();
  const r2 = g.llamar('bajaTotal', baja, { idSolicitud: ID });
  ok(r2.ok && r2.repetida && r2.resultado.pruebasCanceladas === 1 && B.getLastRow() === 6 && H.getLastRow() === hTras, 'repetida: ni otra baja, ni otra cancelación, ni Historial');
  ok(r2.estado.pruebas.find(p => p.id === pr).estado === 'Cancelada', '(control) la prueba quedó cancelada una vez');
}
{
  // Un error de negocio no registra el ID: el reintento vuelve a validar.
  const g = entornoCargado();
  const S = g._libro.getSheetByName('Solicitudes');
  const ID = 'e5f6a7b8-0000-4000-8000-000000000005';
  g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'LUN-1630-PARKOUR' });            // 3/3: llena
  const r1 = g.llamar('inscribir', { idNino: 'AS-0005', codigo: 'LUN-1630-PARKOUR' }, { idSolicitud: ID });
  ok(!r1.ok && r1.codigo === 'llena' && S.getLastRow() === 5, 'clase llena: no escribe y no registra el ID');
  const ins = g.llamar('leer').resultado.inscripciones.find(i => i.idNino === 'AS-0001');
  g.llamar('bajaClase', { idInscripcion: ins.id, fecha: HOY, motivo: 'Horario' });
  const r2 = g.llamar('inscribir', { idNino: 'AS-0005', codigo: 'LUN-1630-PARKOUR' }, { idSolicitud: ID });
  ok(r2.ok && !r2.repetida && S.getLastRow() === 6, 'con cupo libre, el mismo ID se ejecuta (una vez)');
}
{
  // resultadoPrueba repetido: Historial una sola vez.
  const g = entornoCargado();
  const H = g._libro.getSheetByName('Historial');
  const pr = g.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: proximo('Martes', true), idNino: 'AS-0003' }).resultado.id;
  const ID = 'f6a7b8c9-0000-4000-8000-000000000006';
  g.llamar('resultadoPrueba', { idPrueba: pr, estado: 'Cancelada' }, { idSolicitud: ID });
  const h1 = H.getLastRow();
  const r2 = g.llamar('resultadoPrueba', { idPrueba: pr, estado: 'Cancelada' }, { idSolicitud: ID });
  ok(r2.ok && r2.repetida && H.getLastRow() === h1, 'resultado de prueba repetido: una sola fila de Historial');
}
{
  // Ventana: solo se miran las últimas 500 solicitudes.
  const g = entornoCargado();
  const S = g._libro.getSheetByName('Solicitudes');
  const ID = 'a7b8c9d0-0000-4000-8000-000000000007';
  const nota = n => ({ idInscripcion: g.llamar('leer').resultado.inscripciones[0].id, nota: n });
  g.llamar('notaInscripcion', nota('vieja'), { idSolicitud: ID });
  for (let f = 7; f < 7 + 500; f++) { S.formatos[f + ',2'] = '@'; S.poner(f, 2, 'relleno-' + f); }
  const r = g.llamar('notaInscripcion', nota('vieja'), { idSolicitud: ID });
  ok(r.ok && !r.repetida, 'un ID más viejo que las últimas 500 solicitudes ya no se reconoce (un reintento llega en segundos)');
}
{
  // Sin la pestaña Solicitudes (estructura sin actualizar): con ID falla claro; sin ID funciona.
  const g = entornoCargado();
  g._libro.hojas = g._libro.hojas.filter(h => h.nombre !== 'Solicitudes');
  const r = g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'MAR-1630-PARKIDS' }, { idSolicitud: 'b8c9d0e1-0000-4000-8000-000000000008' });
  ok(!r.ok && /Falta la pestaña «Solicitudes»/.test(r.error), 'con ID y sin pestaña: error que dice qué falta');
  ok(g._libro.getSheetByName('Inscripciones').getLastRow() === 9, 'y no escribe nada');
  ok(g.llamar('inscribir', { idNino: 'AS-0003', codigo: 'MAR-1630-PARKIDS' }).ok, 'sin ID funciona como siempre');
  ok(/⚠ Falta la pestaña «Solicitudes»/.test(g.comprobar()), 'Comprobar estructura avisa que falta');
}

seccion('pago de la clase de prueba');
{
  const g = entornoCargado();
  const P = g._libro.getSheetByName('Pruebas'), H = g._libro.getSheetByName('Historial');
  ok(P.celda(5, 12) === 'Pagó' && P.celda(5, 13) === 'Monto pagado', 'Pruebas tiene «Pagó» y «Monto pagado» al final');
  const martes = proximo('Martes', true);
  const pr = g.llamar('agendarPrueba', { codigo: 'MAR-1630-PARKIDS', fecha: martes, idNino: 'AS-0003' }).resultado.id;
  let p = g.llamar('leer').resultado.pruebas.find(x => x.id === pr);
  ok(p.pago === '' && p.monto === null, 'una prueba nueva: sin pago registrado (se puede agendar sin pagar)');

  ok(/el monto es obligatorio/.test(g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí' }).error), 'Pagó Sí sin monto → rechazo');
  ok(!g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: '0' }).ok, 'monto cero → rechazo');
  ok(!g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: '-5' }).ok, 'monto negativo → rechazo');
  ok(!g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: 'diez' }).ok, 'monto ilegible → rechazo');
  ok(!g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Quizás', monto: '10' }).ok, '«Pagó» inválido → rechazo');
  ok(!g.llamar('pagoPrueba', { idPrueba: 'PRU-9999', pago: 'Sí', monto: '10' }).ok, 'prueba inexistente → rechazo');
  ok(P.celda(6, 12) === '' && P.celda(6, 13) === '', 'los rechazos no escriben');

  let r = g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: '25,50' });
  p = r.estado.pruebas.find(x => x.id === pr);
  ok(r.ok && p.pago === 'Sí' && p.monto === 25.5 && P.celda(6, 13) === 25.5, 'se registra ANTES de la clase, con coma decimal → 25,5');
  ok(p.estado === 'Agendada', 'registrar el pago no cambia el estado de la prueba');
  ok(H.celda(H.getLastRow(), 4) === 'Pago de prueba' && /AS-0003 · MAR-1630-PARKIDS · .* · pagó: Sí \(25\.5\)/.test(H.celda(H.getLastRow(), 6)), 'deja fila en Historial');
  const hTras = H.getLastRow();
  ok(g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: 25.5 }).resultado.sinCambios && H.getLastRow() === hTras, 'sin cambios no escribe ni deja Historial');
  r = g.llamar('pagoPrueba', { idPrueba: pr, pago: 'No', monto: '40' });
  p = r.estado.pruebas.find(x => x.id === pr);
  ok(r.ok && p.pago === 'No' && p.monto === null && P.celda(6, 13) === '', 'Pagó No: el monto queda vacío');
  ok(/pagó: No · antes: pagó: Sí \(25\.5\)/.test(H.celda(H.getLastRow(), 6)), 'el Historial guarda el valor anterior');
  r = g.llamar('pagoPrueba', { idPrueba: pr, pago: '' });
  ok(r.ok && r.estado.pruebas.find(x => x.id === pr).pago === '', 'se puede volver a «sin registrar»');
  r = g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: '12,3456' });
  ok(r.ok && r.estado.pruebas.find(x => x.id === pr).monto === 12.35, 'el monto se guarda redondeado a centavos');
  g.llamar('pagoPrueba', { idPrueba: pr, pago: '' });

  // Idempotente con ID de solicitud.
  const ID = 'c9d0e1f2-0000-4000-8000-000000000009';
  g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: 30 }, { idSolicitud: ID });
  const h1 = H.getLastRow();
  r = g.llamar('pagoPrueba', { idPrueba: pr, pago: 'Sí', monto: 30 }, { idSolicitud: ID });
  ok(r.ok && r.repetida && H.getLastRow() === h1, 'con el mismo ID: no se repite y el Historial queda una vez');

  // En el diálogo Resultado, junto con el resultado.
  claseDeHoy(g, 'HOY-2000-TELAS', 5);
  const prHoy = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0005' }).resultado.id;
  ok(!g.llamar('resultadoPrueba', { idPrueba: prHoy, estado: 'Asistió', pago: 'Sí', monto: '' }).ok, 'resultado con Pagó Sí sin monto → rechazo (no guarda el resultado tampoco)');
  ok(g.llamar('leer').resultado.pruebas.find(x => x.id === prHoy).estado === 'Agendada', '(control) el rechazo no cambió el estado');
  r = g.llamar('resultadoPrueba', { idPrueba: prHoy, estado: 'Asistió', seInscribio: 'Sí', pago: 'Sí', monto: '18' });
  p = r.estado.pruebas.find(x => x.id === prHoy);
  ok(r.ok && p.estado === 'Asistió' && p.pago === 'Sí' && p.monto === 18, 'el resultado guarda también el pago');
  ok(/Asistió · se inscribió: Sí · pagó: Sí \(18\)/.test(H.celda(H.getLastRow(), 6)), 'en una sola fila de Historial');
  r = g.llamar('resultadoPrueba', { idPrueba: prHoy, estado: 'Asistió', seInscribio: 'Sí', nota: 'vuelve el jueves' });
  ok(r.ok && r.estado.pruebas.find(x => x.id === prHoy).monto === 18, 'un resultado sin campos de pago no toca el pago');
}
{
  // Actualizar estructura sobre una pestaña Pruebas de la versión 5 (sin las columnas de pago), con datos.
  const L = new Libro('VEA_AfterSchool_BD');
  const g0 = crearEntorno({ libro: L, propiedades: { AS_CLAVE_API: CLAVE } });
  g0.instalar();
  const P = L.getSheetByName('Pruebas');
  P.poner(5, 12, ''); P.poner(5, 13, '');           // como estaba antes del 16-oct
  P.poner(5, 14, ''); P.poner(5, 15, ''); P.poner(5, 16, '');   // y sin las de visitas (21-oct)
  ['PRU-0001', new Date(2026, 9, 20), 'LUN-1630-TELAS', 'AS-0001', 'Agendada', '', '', 'nota', 'recepcion', new Date()].forEach((v, i) => {
    P.formatos['6,' + (2 + i)] = [0, 2, 3].includes(i) ? '@' : undefined; P.poner(6, 2 + i, v); });
  const antes = JSON.stringify(P.fila(6));
  ok(/⚠ A la pestaña «Pruebas» le faltan los títulos: Pagó, Monto pagado/.test(g0.comprobar()), 'Comprobar estructura avisa si faltan las columnas de pago');
  const inf = g0.actualizarEstructura();
  ok(P.celda(5, 12) === 'Pagó' && P.celda(5, 13) === 'Monto pagado' && /Columnas agregadas al final de Pruebas: Pagó, Monto pagado/.test(inf), 'Actualizar estructura agrega las dos columnas al final');
  ok(P.celda(5, 14) === 'Tipo' && P.celda(5, 15) === 'Repone asistencia' && P.celda(5, 16) === 'Resultado por lista', 'y las tres de visitas, después');
  ok(JSON.stringify(P.fila(6).slice(0, 11)) === JSON.stringify(JSON.parse(antes).slice(0, 11)), 'sin tocar los datos de la prueba existente');
  ok(P.celda(6, 14) === 'Prueba' && /Pruebas: 1 fila\(s\) sin Tipo quedaron como «Prueba»/.test(inf), 'la prueba existente queda con Tipo «Prueba»');
  const inf2 = g0.actualizarEstructura();
  ok(!/sin Tipo/.test(inf2), 'correrla otra vez no vuelve a tocar el Tipo');
  ok(!/⚠ A la pestaña/.test(g0.comprobar()), 'y Comprobar queda sin avisos de títulos');
  ok(/Ya existía, completa: Pruebas/.test(g0.actualizarEstructura()), 'correrla otra vez no cambia nada');
}

// ═════════════════════════════════════════════════════════════════════════════
// 21-oct: visitas de un día, Pasar lista y seguimiento
// ═════════════════════════════════════════════════════════════════════════════

/* Fija la hora del script (ahora_) para probar lo que depende del momento. */
function fijarHora(g, hh, mm) {
  const d = new Date(); d.setHours(hh, mm, 0, 0);
  g.ahora_ = () => new Date(d.getTime());
}
const HACE = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
function sumar(f, n) { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }

/* Una clase del día de la semana de «fecha», con hora y servicio. */
function claseDelDia(g, codigo, fecha, hora, servicio, cupo) {
  const C = g._libro.getSheetByName('Clases');
  const f = C.getLastRow() + 1;
  C.formatos[f + ',2'] = '@'; C.formatos[f + ',6'] = '@';
  const dia = DIAS[(new Date(fecha + 'T12:00:00').getDay() + 6) % 7];
  ['', codigo, servicio, 'Semana', dia, hora, cupo, '6 a 14', 'Sí'].forEach((v, i) => { if (i) C.poner(f, 1 + i, v); });
}

/* Inscripción escrita a mano (alta en el pasado, como si viniera de antes). */
function inscripcionPasada(g, idNino, codigo, alta) {
  const I = g._libro.getSheetByName('Inscripciones'), f = I.getLastRow() + 1;
  [2, 3, 4].forEach(c => { I.formatos[f + ',' + c] = '@'; });
  ['', 'INS-' + (900 + f), idNino, codigo, new Date(alta + 'T00:00:00'), '', '', '', 'prueba', new Date(), ''].forEach((v, i) => { if (i) I.poner(f, 1 + i, v); });
}

/* Asistencia escrita a mano (días pasados). */
function asistenciaPasada(g, id, fecha, codigo, idNino, estado, presencia) {
  const A = g._libro.getSheetByName('Asistencia'), f = A.getLastRow() + 1;
  [2, 4, 5, 7].forEach(c => { A.formatos[f + ',' + c] = '@'; });
  ['', id, new Date(fecha + 'T00:00:00'), codigo, idNino, presencia || 'Inscrito', '', estado, '', 'profe', new Date(), '', ''].forEach((v, i) => { if (i) A.poner(f, 1 + i, v); });
}

seccion('visitas: ocupación por tipo y calculada por el servidor');
{
  const g = entornoCargado();
  claseDeHoy(g, 'HOY-2000-TELAS', 4);
  inscripcionPasada(g, 'AS-0001', 'HOY-2000-TELAS', AYER);
  ok(g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0003' }).ok, 'una prueba hoy');
  let r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'HOY-2000-TELAS', fecha: HOY, nino: Object.assign({}, NINO_NUEVO, { nombre: 'Eva', apellidos: 'Eventual Ficticia' }), pago: 'Sí', monto: '15' });
  ok(r.ok && /^PRU-/.test(r.resultado.id), 'una eventual hoy (con pago)');
  const ev = r.estado.ninos.find(n => n.id === r.resultado.idNino);
  ok(ev && ev.estado === 'Eventual', 'el niño nuevo de una eventual nace «Eventual»');
  const pe = r.estado.pruebas.find(p => p.id === r.resultado.id);
  ok(pe.tipo === 'Eventual' && pe.pago === 'Sí' && pe.monto === 15, 'la eventual guarda tipo, Pagó y monto');
  const o = r.estado.ocupacion[HOY]['HOY-2000-TELAS'];
  ok(o && o.i === 1 && o.v === 2 && o.tipos.Prueba === 1 && o.tipos.Eventual === 1, 'leer devuelve la ocupación del día: 1 inscrito + 2 visitas por tipo');
  ok(o.ninos.join() === 'AS-0001' && o.visitas.length === 2, 'con los IDs de los inscritos y de las visitas (la página no recalcula)');
  const s = g.ocupacionEn_('HOY-2000-TELAS', HOY, g.leerTabla_('inscripciones'), g.leerTabla_('pruebas'));
  ok(s.total === 3 && s.pruebas === 2, 'ocupacionEn_ cuenta las visitas de todos los tipos');
  ok(g.textoOcupacion_(s, 4) === '1 + 2 visitas de 4 cupos', 'el texto dice «visitas» si hay tipos mezclados');
  // Llenar: cupo 4 → una visita más cabe, la siguiente no.
  ok(g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0005' }).ok, 'cabe una visita más (4/4)');
  r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'HOY-2000-TELAS', fecha: HOY, nino: Object.assign({}, NINO_NUEVO, { nombre: 'Otro', apellidos: 'Lleno Ficticio' }) });
  ok(!r.ok && r.codigo === 'llena' && /1 \+ 3 visitas de 4 cupos/.test(r.error), 'la clase llena por visitas rechaza otra visita y lo dice');
  r = g.llamar('inscribir', { idNino: 'AS-0004', codigo: 'HOY-2000-TELAS' });
  ok(!r.ok && r.codigo === 'llena', 'y una inscripción fija tampoco cabe ese día');
  // La ventana de leer coincide con ocupacionEn_ en todas sus fechas (con una baja de hoy dentro).
  const insAlma = g.llamar('leer').resultado.inscripciones.find(i => i.idNino === 'AS-0001' && i.codigo === 'LUN-1630-PARKOUR');
  ok(g.llamar('bajaClase', { idInscripcion: insAlma.id, fecha: HOY, motivo: 'Horario' }).ok, '(una baja de hoy para la comparación)');
  const d = g.llamar('leer').resultado;
  const ins = g.leerTabla_('inscripciones'), pr = g.leerTabla_('pruebas');
  let iguales = true, n = 0;
  Object.keys(d.ocupacion).forEach(f => Object.keys(d.ocupacion[f]).forEach(c => {
    const x = g.ocupacionEn_(c, f, ins, pr), y = d.ocupacion[f][c]; n++;
    if (x.inscritos !== y.i || x.visitas !== y.v) iguales = false;
  }));
  ok(iguales && n > 20, 'la ocupación de leer coincide con la regla del servidor en las ' + n + ' celdas de la ventana');
  ok(d.ocupacion[HACE(14)] && d.ocupacion[sumar(HOY, 41)] && !d.ocupacion[HACE(15)], 'ventana: 14 días atrás y 41 adelante');
  const lejos = sumar(proximo('Lunes', true), 70);
  ok(g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lejos, idNino: 'AS-0003' }).ok, 'una prueba a 10 semanas');
  ok(!!g.llamar('leer').resultado.ocupacion[lejos], 'una fecha futura con visitas fuera de la ventana también viene');
  r = g.llamar('ocupacion', { desde: '2026-09-07', hasta: '2026-09-13' });
  ok(r.ok && r.resultado.ocupacion['2026-09-07']['LUN-1630-PARKOUR'].i === 2, 'la acción «ocupacion» da otras semanas');
  ok(!g.llamar('ocupacion', { desde: '2026-01-01', hasta: '2026-06-01' }).ok, 'y no más de 62 días');
}

seccion('visitas: Eventual');
{
  const g = entornoCargado();
  const lunes = proximo('Lunes', true);
  let r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: lunes, idNino: 'AS-0001' });
  ok(!r.ok && /está Activo/.test(r.error), 'un niño Activo no viene como eventual');
  r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: lunes, idNino: 'AS-0002' });
  ok(!r.ok && /Por revisar/.test(r.error), 'uno «Por revisar» tampoco');
  ok(!g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: lunes, nino: { nombre: 'Sin datos' } }).ok, 'niño nuevo: los mismos obligatorios que la prueba');
  ok(!g.llamar('agendarVisita', { tipo: 'Prueba', codigo: 'LUN-1630-PARKOUR', fecha: lunes, idNino: 'AS-0003' }).ok, 'agendarVisita no agenda pruebas');
  ok(!g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: lunes, nino: NINO_NUEVO, pago: 'Sí' }).ok, 'Pagó Sí sin monto → rechazo');
  // Prospecto → Eventual
  const rp = g.llamar('agendarPrueba', { codigo: 'LUN-1630-TELAS', fecha: lunes, nino: NINO_NUEVO });
  const idP = rp.resultado.idNino;
  r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: sumar(lunes, 7), idNino: idP });
  ok(r.ok && r.estado.ninos.find(n => n.id === idP).estado === 'Eventual', 'un Prospecto que viene como eventual pasa a Eventual');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow() - 1, 4) === 'Prospecto → Eventual' && H.celda(H.getLastRow(), 4) === 'Agendar eventual', 'Historial del cambio de estado y de la visita');
  // Retirado → Eventual
  g.llamar('bajaTotal', { idNino: 'AS-0004', fecha: HOY, motivo: 'Precio' });
  r = g.llamar('agendarVisita', { tipo: 'Eventual', codigo: 'LUN-1630-PARKOUR', fecha: lunes, idNino: 'AS-0004', pago: 'No' });
  ok(r.ok && r.estado.ninos.find(n => n.id === 'AS-0004').estado === 'Eventual', 'un Retirado que viene un día pasa a Eventual');
  // Eventual → Activo al inscribirse
  r = g.llamar('inscribir', { idNino: idP, codigo: 'MAR-1630-PARKIDS' });
  ok(r.ok && r.estado.ninos.find(n => n.id === idP).estado === 'Activo', 'un Eventual que se inscribe pasa a Activo');
  ok(H.celda(H.getLastRow(), 4) === 'Eventual → Activo', 'Historial: Eventual → Activo');
  // Pago de la eventual con pagoPrueba
  const idEv = g.llamar('leer').resultado.pruebas.find(p => p.idNino === 'AS-0004').id;
  r = g.llamar('pagoPrueba', { idPrueba: idEv, pago: 'Sí', monto: '12,50' });
  ok(r.ok && r.estado.pruebas.find(p => p.id === idEv).monto === 12.5, 'el pago de una eventual se registra igual que el de una prueba');
}

seccion('visitas: Reposición de una sola falta, del mismo servicio');
{
  const g = entornoCargado();
  const lunesPasado = HACE(((new Date().getDay() + 6) % 7) + 7);       // el lunes de la semana pasada
  asistenciaPasada(g, 'ASI-0001', lunesPasado, 'LUN-1630-PARKOUR', 'AS-0001', 'Ausente');
  asistenciaPasada(g, 'ASI-0002', lunesPasado, 'LUN-1630-PARKOUR', 'AS-0004', 'Presente');
  asistenciaPasada(g, 'ASI-0003', lunesPasado, 'LUN-1630-TELAS', 'AS-0002', 'Falta justificada');
  const martes = proximo('Martes', true);
  claseDelDia(g, 'MAR-1800-PARKOUR', martes, '18:00', 'Parkour', 10);
  let r = g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1630-PARKIDS', fecha: martes, idNino: 'AS-0001', reponeAsistencia: 'ASI-0001' });
  ok(!r.ok && /La falta es de Parkour: se repone en una clase de Parkour/.test(r.error), 'se repone solo en una clase del mismo servicio');
  ok(!g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0004', reponeAsistencia: 'ASI-0002' }).ok, 'un Presente no es una falta');
  ok(!g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0004', reponeAsistencia: 'ASI-0001' }).ok, 'la falta de otro niño → rechazo');
  ok(!g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0001' }).ok, 'sin elegir la falta → rechazo');
  ok(!g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0001', reponeAsistencia: 'ASI-0001', pago: 'Sí', monto: 5 }).ok, 'la reposición no se cobra');
  r = g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0001', reponeAsistencia: 'ASI-0001' });
  ok(r.ok, 'repone la falta en otra clase de Parkour');
  const rep = r.estado.pruebas.find(p => p.id === r.resultado.id);
  ok(rep.tipo === 'Reposición' && rep.repone === 'ASI-0001' && rep.pago === '', 'la visita guarda tipo y la falta que repone');
  r = g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: sumar(martes, 7), idNino: 'AS-0001', reponeAsistencia: 'ASI-0001' });
  ok(!r.ok && /ya se repone con PRU-/.test(r.error), 'cada falta se repone una sola vez');
  ok(!g.llamar('pagoPrueba', { idPrueba: rep.id, pago: 'Sí', monto: 5 }).ok, 'pagoPrueba rechaza una reposición');
  const a = g.llamar('asistenciaNino', { idNino: 'AS-0001' }).resultado.asistencias[0];
  ok(a.id === 'ASI-0001' && a.repuestaCon === rep.id && a.reponible === false, 'la asistencia del niño dice con qué visita se repone');
  // Cancelada → la falta vuelve a estar disponible.
  g.llamar('resultadoPrueba', { idPrueba: rep.id, estado: 'Cancelada' });
  ok(g.llamar('asistenciaNino', { idNino: 'AS-0001' }).resultado.asistencias[0].reponible === true, 'si la reposición se cancela, la falta vuelve a quedar disponible');
  r = g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: sumar(martes, 7), idNino: 'AS-0001', reponeAsistencia: 'ASI-0001' });
  ok(r.ok, 'y se puede reponer otra vez');
  // Una reposición ocupa cupo: con cupo 1, la reposición llena la clase.
  claseDelDia(g, 'MAR-1900-PARKOUR', martes, '19:00', 'Parkour', 1);
  asistenciaPasada(g, 'ASI-0011', lunesPasado, 'LUN-1630-PARKOUR', 'AS-0001', 'Ausente');
  ok(g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1900-PARKOUR', fecha: martes, idNino: 'AS-0001', reponeAsistencia: 'ASI-0011' }).ok, 'reposición en una clase de cupo 1');
  r = g.llamar('agendarPrueba', { codigo: 'MAR-1900-PARKOUR', fecha: martes, idNino: 'AS-0003' });
  ok(!r.ok && r.codigo === 'llena', 'la reposición ocupa el cupo: otra visita ya no cabe');
  // Una reposición que queda «No asistió» libera la falta.
  claseDelDia(g, 'HOY-2100-PARKOUR', HOY, '21:00', 'Parkour', 10);
  asistenciaPasada(g, 'ASI-0010', lunesPasado, 'LUN-1630-PARKOUR', 'AS-0001', 'Ausente');
  const rHoy = g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'HOY-2100-PARKOUR', fecha: HOY, idNino: 'AS-0001', reponeAsistencia: 'ASI-0010' });
  ok(rHoy.ok, 'reposición hoy');
  const falta10 = () => g.llamar('asistenciaNino', { idNino: 'AS-0001' }).resultado.asistencias.find(x => x.id === 'ASI-0010');
  ok(falta10().reponible === false, '(control) con la reposición en pie, la falta no está disponible');
  g.llamar('resultadoPrueba', { idPrueba: rHoy.resultado.id, estado: 'No asistió' });
  ok(falta10().reponible === true, 'si la reposición queda «No asistió», la falta vuelve a estar disponible');
  // Una Falta justificada también se repone; a un Retirado, no.
  g.llamar('revisar', { idNino: 'AS-0002', estado: 'Activo' });
  ok(g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'LUN-1630-TELAS', fecha: proximo('Lunes', true), idNino: 'AS-0002', reponeAsistencia: 'ASI-0003' }).ok === false, '(el niño ya está inscrito en esa clase: rechazo)');
  claseDelDia(g, 'MIE-1700-TELAS', proximo('Miércoles', true), '17:00', 'Telas', 10);
  ok(g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MIE-1700-TELAS', fecha: proximo('Miércoles', true), idNino: 'AS-0002', reponeAsistencia: 'ASI-0003' }).ok, 'una Falta justificada también se repone');
  g.llamar('bajaTotal', { idNino: 'AS-0004', fecha: HOY, motivo: 'Precio' });
  asistenciaPasada(g, 'ASI-0009', lunesPasado, 'LUN-1630-PARKOUR', 'AS-0004', 'Ausente');
  ok(/la reposición es para niños Activos/.test(g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: martes, idNino: 'AS-0004', reponeAsistencia: 'ASI-0009' }).error), 'a un niño que no está Activo no se le agenda reposición');
}

seccion('Pasar lista: lo que ve el profesor y lo que guarda');
{
  const g = entornoCargado();
  fijarHora(g, 20, 30);
  claseDeHoy(g, 'HOY-2000-TELAS', 10);
  inscripcionPasada(g, 'AS-0001', 'HOY-2000-TELAS', AYER);
  inscripcionPasada(g, 'AS-0005', 'HOY-2000-TELAS', AYER);
  const pr = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, nino: NINO_NUEVO }).resultado;
  const cancelada = g.llamar('agendarPrueba', { codigo: 'HOY-2000-TELAS', fecha: HOY, idNino: 'AS-0003' }).resultado.id;
  g.llamar('resultadoPrueba', { idPrueba: cancelada, estado: 'Cancelada' });
  let r = g.llamar('leerLista', { soloHoy: true });
  ok(r.ok && r.resultado.fecha === HOY, 'leerLista: la lista de hoy');
  const cl = r.resultado.clases.find(c => c.codigo === 'HOY-2000-TELAS');
  ok(cl && cl.ninos.length === 3, 'la clase de hoy: 2 inscritos + 1 prueba (la cancelada no va)');
  const gabi = cl.ninos.find(n => n.idNino === pr.idNino);
  ok(gabi.presencia === 'Prueba' && gabi.idVisita === pr.id && /años/.test(gabi.edad), 'la prueba va con su marca y la edad');
  const claves = Object.keys(cl.ninos[0]).sort().join();
  ok(claves === 'edad,estado,idNino,idVisita,nombre,nota,presencia', 'por niño solo nombre, edad, marca y lo marcado (' + claves + ')');
  ok(!JSON.stringify(r.resultado).match(/555|telefono|correo|responsable|@/), 'ningún dato de contacto en la lista');
  ok(!r.estado, 'leerLista no trae el estado de After School');
  // Profesor: otro día no.
  r = g.llamar('leerLista', { fecha: AYER, soloHoy: true });
  ok(!r.ok && r.codigo === 'solo_hoy', 'con soloHoy, otro día → rechazo');
  ok(g.llamar('leerLista', { fecha: AYER }).ok, 'sin soloHoy (coordinación), otro día sí');
  ok(!g.llamar('leerLista', { fecha: MANANA }).ok, 'un día futuro, nunca');

  // Guardar
  const marcas = [{ idNino: 'AS-0001', estado: 'Presente' }, { idNino: 'AS-0005', estado: 'Ausente' }, { idNino: pr.idNino, estado: 'Llegó tarde' }];
  ok(!g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: 'AS-0002', estado: 'Presente' }], soloHoy: true }).ok, 'un niño que no está en la lista → rechazo');
  ok(!g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: 'AS-0001', estado: 'Dormido' }], soloHoy: true }).ok, 'estado inválido → rechazo');
  ok(!g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [marcas[0], marcas[0]], soloHoy: true }).ok, 'el mismo niño dos veces → rechazo');
  ok(!g.llamar('guardarLista', { codigo: 'LUN-1630-PARKOUR', fecha: HOY, marcas: marcas, soloHoy: true }).ok || DIA_HOY === 'Lunes', 'una clase que no es de hoy → rechazo');
  r = g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: marcas, fueraDeLista: [{ nombre: 'Niño Escrito A Mano', estado: 'Presente' }], soloHoy: true },
    { idSolicitud: 'lista-0001-aaaa' });
  ok(r.ok && r.resultado.nuevas === 4 && r.resultado.visitasMarcadas === 1, 'guarda 3 marcas + 1 fuera de lista y marca la prueba');
  ok(!r.estado, 'guardarLista no devuelve el estado de After School (el profesor no lo recibe)');
  const A = g._libro.getSheetByName('Asistencia');
  ok(A.getLastRow() === 9 && A.celda(6, 2) === 'ASI-0001' && A.celda(6, 6) === 'Inscrito' && A.celda(6, 8) === 'Presente' && A.celda(6, 10) === 'prueba', 'filas en Asistencia con ID, presencia, estado y quién');
  const rep = g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: marcas, fueraDeLista: [{ nombre: 'Niño Escrito A Mano', estado: 'Presente' }], soloHoy: true },
    { idSolicitud: 'lista-0001-aaaa' });
  ok(rep.ok && rep.repetida && A.getLastRow() === 9, 'el mismo ID de solicitud no guarda dos veces');
  let p = g.llamar('leer').resultado.pruebas.find(x => x.id === pr.id);
  ok(p.estado === 'Asistió' && p.porLista === true && p.seInscribio === '', 'Llegó tarde → la prueba queda Asistió, por la lista, sin tocar «Se inscribió»');
  // Corregir el mismo día: la prueba sigue a la lista.
  r = g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: pr.idNino, estado: 'Ausente' }], soloHoy: true });
  ok(r.ok && r.resultado.corregidas === 1 && r.resultado.nuevas === 0, 'corregir el mismo día actualiza la fila (no agrega otra)');
  p = g.llamar('leer').resultado.pruebas.find(x => x.id === pr.id);
  ok(p.estado === 'No asistió', 'Ausente → la prueba pasa a No asistió');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow() - 1, 4) === 'Corregir asistencia' && /Llegó tarde → Ausente/.test(H.celda(H.getLastRow() - 1, 6)), 'la corrección queda en Historial');
  r = g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: pr.idNino, estado: 'Falta justificada' }], soloHoy: true });
  ok(g.llamar('leer').resultado.pruebas.find(x => x.id === pr.id).estado === 'No asistió', 'Falta justificada → No asistió');
  // Un resultado puesto a mano no se pisa.
  g.llamar('resultadoPrueba', { idPrueba: pr.id, estado: 'Asistió', seInscribio: 'Sí' });
  g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: pr.idNino, estado: 'Ausente' }], soloHoy: true });
  p = g.llamar('leer').resultado.pruebas.find(x => x.id === pr.id);
  ok(p.estado === 'Asistió' && p.seInscribio === 'Sí' && p.porLista === false, 'la lista no pisa un resultado registrado a mano');
  // Lo guardado aparece en la lista.
  const cl2 = g.llamar('leerLista', { soloHoy: true }).resultado.clases.find(c => c.codigo === 'HOY-2000-TELAS');
  ok(cl2.guardada && cl2.ninos.find(n => n.idNino === 'AS-0005').estado === 'Ausente' && cl2.fueraDeLista[0].nombre === 'Niño Escrito A Mano', 'la lista vuelve con lo marcado y los fuera de lista');
  // El profesor no corrige otro día; la coordinación sí.
  const hoyLista = { codigo: 'HOY-2000-TELAS', fecha: HOY, marcas: [{ idNino: 'AS-0001', estado: 'Ausente' }] };
  ok(g.llamar('guardarLista', Object.assign({}, hoyLista, { fecha: sumar(HOY, -7), soloHoy: true })).codigo === 'solo_hoy', 'con soloHoy no se corrige otro día');
  ok(g.llamar('guardarLista', Object.assign({}, hoyLista, { fecha: sumar(HOY, 7) })).ok === false, 'nunca un día futuro');
}

seccion('Pasar lista: niño fuera de lista y «No hubo clase»');
{
  const g = entornoCargado();
  fijarHora(g, 21, 0);
  claseDeHoy(g, 'HOY-2000-TELAS', 10);
  inscripcionPasada(g, 'AS-0001', 'HOY-2000-TELAS', AYER);
  g.llamar('guardarLista', { codigo: 'HOY-2000-TELAS', marcas: [{ idNino: 'AS-0001', estado: 'Presente' }], fueraDeLista: [{ nombre: 'Uno', estado: 'Presente' }, { nombre: 'Dos', estado: 'Presente' }, { nombre: 'Tres', estado: 'Presente' }] });
  let s = g.llamar('seguimiento').resultado;
  ok(s.fueraDeLista.length === 3 && s.fueraDeLista[0].nombre === 'Uno', 'los fuera de lista aparecen para la coordinación');
  const [a1, a2, a3] = s.fueraDeLista.map(x => x.idAsistencia);
  ok(!g.llamar('resolverFueraDeLista', { idAsistencia: a1, resolucion: 'vincular', idNino: 'AS-0001' }).ok, 'vincular a un niño que ya tiene asistencia en esa clase ese día → rechazo');
  ok(g.llamar('resolverFueraDeLista', { idAsistencia: a1, resolucion: 'vincular', idNino: 'AS-0003' }).ok, 'vincular a un niño existente');
  const r = g.llamar('resolverFueraDeLista', { idAsistencia: a2, resolucion: 'crear', nino: NINO_NUEVO });
  ok(r.ok && r.estado.ninos.find(n => n.id === r.resultado.idNino).estado === 'Eventual', 'crear el niño (queda Eventual)');
  ok(g.llamar('resolverFueraDeLista', { idAsistencia: a3, resolucion: 'descartar' }).ok, 'descartar');
  ok(!g.llamar('resolverFueraDeLista', { idAsistencia: a3, resolucion: 'descartar' }).ok, 'una sola vez');
  s = g.llamar('seguimiento').resultado;
  ok(s.fueraDeLista.length === 0, 'resueltos, ya no aparecen');
  ok(g.llamar('asistenciaNino', { idNino: 'AS-0003' }).resultado.asistencias.length === 1, 'el vinculado tiene esa asistencia en su ficha');
  // No hubo clase
  claseDelDia(g, 'AYER-1600-PARKOUR', AYER, '16:00', 'Parkour', 10);
  inscripcionPasada(g, 'AS-0004', 'AYER-1600-PARKOUR', HACE(10));
  ok(!g.llamar('noHuboClase', { codigo: 'HOY-2000-TELAS', fecha: HOY }).ok, '«No hubo clase» en una clase con lista → rechazo');
  ok(!g.llamar('noHuboClase', { codigo: 'AYER-1600-PARKOUR', fecha: MANANA }).ok, 'ni en un día futuro');
  ok(g.llamar('noHuboClase', { codigo: 'AYER-1600-PARKOUR', fecha: AYER, nota: 'feriado' }).ok, '«No hubo clase» ayer');
  const H = g._libro.getSheetByName('Historial');
  ok(H.celda(H.getLastRow(), 4) === 'No hubo clase' && /feriado/.test(H.celda(H.getLastRow(), 6)), 'queda en Historial');
  ok(g.llamar('noHuboClase', { codigo: 'AYER-1600-PARKOUR', fecha: AYER }).resultado.sinCambios, 'repetirlo no escribe');
  ok(!g.llamar('guardarLista', { codigo: 'AYER-1600-PARKOUR', fecha: AYER, marcas: [{ idNino: 'AS-0004', estado: 'Presente' }] }).ok, 'y ya no se le pasa lista');
}

seccion('seguimiento: faltas seguidas, faltas por reponer y clases sin lista');
{
  const g = entornoCargado();
  // Parkour de Alma (AS-0001) y Dani (AS-0004): cuatro lunes seguidos.
  const L = n => HACE(((new Date().getDay() + 6) % 7) + 7 * n);   // el lunes de hace n semanas
  asistenciaPasada(g, 'ASI-0001', L(4), 'LUN-1630-PARKOUR', 'AS-0001', 'Presente');
  asistenciaPasada(g, 'ASI-0002', L(3), 'LUN-1630-PARKOUR', 'AS-0001', 'Ausente');
  asistenciaPasada(g, 'ASI-0003', L(2), 'LUN-1630-PARKOUR', 'AS-0001', 'Falta justificada');
  asistenciaPasada(g, 'ASI-0004', L(1), 'LUN-1630-PARKOUR', 'AS-0001', 'Ausente');
  asistenciaPasada(g, 'ASI-0005', L(3), 'LUN-1630-PARKOUR', 'AS-0004', 'Ausente');
  asistenciaPasada(g, 'ASI-0006', L(2), 'LUN-1630-PARKOUR', 'AS-0004', 'Llegó tarde');
  asistenciaPasada(g, 'ASI-0007', L(1), 'LUN-1630-PARKOUR', 'AS-0004', 'Ausente');
  asistenciaPasada(g, 'ASI-0008', HACE(60), 'LUN-1630-PARKOUR', 'AS-0004', 'Ausente');
  let s = g.llamar('seguimiento').resultado;
  const alma = s.faltasSeguidas.find(x => x.idNino === 'AS-0001');
  ok(alma && alma.cuantas === 2 && alma.desde === L(3) && alma.hasta === L(1), 'Alma: Ausente, justificada (se salta), Ausente → 2 seguidas');
  ok(!s.faltasSeguidas.find(x => x.idNino === 'AS-0004'), 'Dani: «Llegó tarde» corta la racha → sin alerta');
  ok(s.umbral === 2, 'el umbral sale de Config');
  const C = g._libro.getSheetByName('Config');
  for (let f = 6; f <= C.getLastRow(); f++) if (C.celda(f, 3) === 'Faltas seguidas') C.poner(f, 4, 3);
  ok(!g.llamar('seguimiento').resultado.faltasSeguidas.length, 'con umbral 3 en Config, ya no hay alerta');
  const porReponer = s.faltasPorReponer.map(x => x.idAsistencia).sort().join();
  ok(porReponer === 'ASI-0002,ASI-0003,ASI-0004,ASI-0005,ASI-0007', 'faltas por reponer: Ausente y justificada de los últimos 30 días (' + porReponer + ')');
  ok(!s.faltasPorReponer.find(x => x.idAsistencia === 'ASI-0008'), 'la de hace 60 días no (Días para reponer = 30)');
  // Al reponer una, sale de la lista.
  claseDelDia(g, 'MAR-1800-PARKOUR', proximo('Martes', true), '18:00', 'Parkour', 10);
  g.llamar('agendarVisita', { tipo: 'Reposición', codigo: 'MAR-1800-PARKOUR', fecha: proximo('Martes', true), idNino: 'AS-0001', reponeAsistencia: 'ASI-0002' });
  ok(!g.llamar('seguimiento').resultado.faltasPorReponer.find(x => x.idAsistencia === 'ASI-0002'), 'una falta con reposición agendada sale de «por reponer»');

  // Clases sin lista
  const g2 = entornoCargado();
  const C2 = g2._libro.getSheetByName('Config');
  for (let f = 6; f <= C2.getLastRow(); f++) if (C2.celda(f, 3) === 'Asistencia desde') C2.poner(f, 5, new Date(HACE(3) + 'T00:00:00'));
  claseDelDia(g2, 'HOY-1600-PARKOUR', HOY, '16:00', 'Parkour', 10);
  claseDelDia(g2, 'HOY-1500-TELAS', HOY, '15:00', 'Telas', 10);           // terminó, pero sin niños: no se avisa
  claseDelDia(g2, 'AYER-1600-TELAS', AYER, '16:00', 'Telas', 10);
  inscripcionPasada(g2, 'AS-0001', 'HOY-1600-PARKOUR', HACE(30));
  inscripcionPasada(g2, 'AS-0001', 'AYER-1600-TELAS', HACE(30));
  fijarHora(g2, 16, 59);
  s = g2.llamar('seguimiento').resultado;
  ok(!s.clasesSinLista.find(x => x.codigo === 'HOY-1600-PARKOUR'), 'a las 16:59 la clase de las 16:00 (60 min) todavía no terminó');
  ok(s.clasesSinLista.find(x => x.codigo === 'AYER-1600-TELAS' && x.fecha === AYER), 'la de ayer sin lista sí se avisa');
  fijarHora(g2, 17, 0);
  s = g2.llamar('seguimiento').resultado;
  ok(s.clasesSinLista.find(x => x.codigo === 'HOY-1600-PARKOUR' && x.hora === '16:00' && x.servicio === 'Parkour'), 'a las 17:00 terminó: «Parkour 16:00 – lista sin pasar»');
  ok(!s.clasesSinLista.find(x => x.codigo === 'HOY-1500-TELAS'), 'una clase que terminó pero no tenía niños no se avisa');
  ok(!s.clasesSinLista.find(x => x.fecha < HACE(3)), 'nada antes de «Asistencia desde»');
  for (let f = 6; f <= C2.getLastRow(); f++) if (C2.celda(f, 3) === 'Duración de clase (min)') C2.poner(f, 4, 90);
  ok(!g2.llamar('seguimiento').resultado.clasesSinLista.find(x => x.codigo === 'HOY-1600-PARKOUR'), 'con 90 minutos de duración en Config, a las 17:00 todavía no');
  g2.llamar('guardarLista', { codigo: 'AYER-1600-TELAS', fecha: AYER, marcas: [{ idNino: 'AS-0001', estado: 'Presente' }] });
  ok(!g2.llamar('seguimiento').resultado.clasesSinLista.find(x => x.codigo === 'AYER-1600-TELAS'), 'con la lista guardada, ya no se avisa');
}

seccion('filas más allá de la 1000');
{
  const g = entornoCargado();
  const P = g._libro.getSheetByName('Pagos');
  P.poner(1200, 2, 'PAG-0500'); P.poner(1200, 3, 'AS-0001');   // una fila lejana, sin formato
  const r = g.llamar('registrarPago', { idNino: 'AS-0002', mes: MES, concepto: 'Mensualidad', plan: '4 clases', monto: 85.6, fechaPago: HOY, forma: 'Efectivo' });
  ok(r.ok && r.resultado.id === 'PAG-0501', 'el ID sigue al mayor');
  ok(P.celda(1201, 4) === MES, 'en la fila 1201 el mes sigue siendo texto');
}

console.log('  (' + estadosComparados + ' escrituras comparadas contra una lectura nueva)');
console.log('');
console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');
process.exit(fallos ? 1 : 0);
