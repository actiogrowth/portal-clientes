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
    ['90001', 'Ana', 'Prueba Uno', '15/03/2016', 'Mujer', 'PARKOUR', 'ALTA', '01/02/2025', '', 1, '+50760000001', '', '+50760000001', 'a@ejemplo.test', '90001', '', ''],
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
  ['Niños', 'Clases', 'Inscripciones', 'Pagos', 'Bajas', 'Config', 'Historial'].forEach(n => ok(!!L.getSheetByName(n), 'crea la pestaña ' + n));
  const n = L.getSheetByName('Niños');
  ok(n.celda(5, 1) === '' && n.celda(5, 2) === 'ID' && n.celda(5, 15) === 'Notas', 'títulos de Niños en la fila 5 desde la B, A vacía');
  ok(L.getSheetByName('Config').getLastRow() === 5 + 21, 'Config con sus 21 valores iniciales');
  ok(/FALTA/.test(inf), 'comprobar avisa que falta la clave');
  const otra = g.instalar();
  ok(L.getSheetByName('Config').getLastRow() === 5 + 21, 'instalar dos veces no duplica Config');
  ok(/Ya existía: Niños/.test(otra), 'instalar dos veces no recrea pestañas');
  const cfg = g.leerConfig_();
  ok(cfg.faltan.length === 0, 'Config inicial completa: ' + cfg.faltan.join('; '));
  ok(cfg.umbral === 0.8 && cfg.planes.length === 3 && cfg.planes[0].precio === 85.6, 'umbral y precios leídos de Config');
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
