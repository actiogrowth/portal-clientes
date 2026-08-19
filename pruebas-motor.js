/* ============================================================================
   Pruebas del motor de calculo de presentacion-vea-efb4db06.html

   Se ejecuta con:  node pruebas-motor.js

   Por que existe este archivo:
   Los numeros de la presentacion se proyectan delante del cliente y el
   cliente conoce su nomina. Un margen inflado se nota. Cada cifra de la
   spec esta aqui como caso de prueba, asi que si alguien toca una tarifa
   o una regla de escalado, la consola lo dice antes que Ricardo.

   El motor vive dentro del HTML (la spec pide un solo archivo). Este
   arnes lo extrae del bloque <script id="motor"> y lo evalua en node,
   de modo que se prueba exactamente el codigo que corre en la reunion,
   no una copia que puede quedar desincronizada.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

/* El sufijo no es decorativo: Pages publica main, asi que esta direccion es
   publica. El nombre no se deriva del portal que el cliente ya tiene, igual
   que seguimiento-a7f39c21.html. Si se renombra el HTML, se cambia aqui. */
const ARCHIVO = path.join(__dirname, 'presentacion-vea-efb4db06.html');

function cargarBloques(ids) {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const cuerpos = ids.map(id => {
    const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
    if (!m) throw new Error('No se encontro el bloque <script id="' + id + '"> en ' + ARCHIVO);
    return m[1];
  });
  const exportar = ids.map(id => 'exports.' + id.toUpperCase() + ' = ' + id.toUpperCase() + ';').join('\n');
  const sandbox = {};
  new Function('exports', cuerpos.join('\n') + '\n' + exportar)(sandbox);
  return sandbox;
}

/* --------------------------------------------------------------------------
   Arnes minimo. Tolerancia explicita por caso: las cifras de la spec estan
   redondeadas al peso, asi que comparar al centavo daria falsos negativos.
   -------------------------------------------------------------------------- */
let pasadas = 0, fallidas = 0;
const fallos = [];

function ok(real, esperado, titulo, tol = 1) {
  const bien = Math.abs(real - esperado) <= tol;
  if (bien) pasadas++; else { fallidas++; fallos.push({ titulo, real, esperado }); }
  const val = typeof real === 'number' ? (Math.round(real * 100) / 100) : real;
  console.log(`${bien ? '  ok  ' : ' FALLA'} ${titulo.padEnd(52)} ${String(val).padStart(11)}   esperado ${esperado}`);
}

function esIgual(real, esperado, titulo) {
  const bien = real === esperado;
  if (bien) pasadas++; else { fallidas++; fallos.push({ titulo, real, esperado }); }
  console.log(`${bien ? '  ok  ' : ' FALLA'} ${titulo.padEnd(52)} ${String(real).padStart(11)}   esperado ${esperado}`);
}

/* El orden importa: datos lee cifras reales de MOTOR. */
const { MOTOR, DATOS, FORMATO } = cargarBloques(['motor', 'datos', 'formato']);

/* ==========================================================================
   KINDER
   ========================================================================== */
console.log('\nKINDER');

/* La facturacion sale del reparto entero entre los dos planes, no de un
   ticket promedio. Un niño paga un plan o el otro; con el promedio la tabla
   desglosada de la tarjeta no sumaria su propio total, que es justo lo que
   el cliente comprueba. */
const kHoy = MOTOR.kinder({ ninos: 29 });
esIgual(kHoy.detalle.length, 2, 'hoy 29 ninos: dos planes en el desglose');
esIgual(kHoy.detalle[0].ninos + kHoy.detalle[1].ninos, 29, 'los dos planes suman los niños');
ok(kHoy.detalle.reduce((s, d) => s + d.facturacion, 0), kHoy.facturacion,
   'hoy 29 ninos: el desglose suma la facturacion', 0.01);
ok(kHoy.detalle[0].ninos, 20, 'hoy: 70% de 29 son 20 niños en plan 4,5 h', 0);
ok(kHoy.detalle[1].ninos, 9, 'hoy: los otros 9 en plan 8 h', 0);
ok(kHoy.facturacion, 20*587 + 9*786, 'hoy 29 ninos: facturacion', 0.01);
esIgual(kHoy.grupos, 3, 'hoy 29 ninos: grupos');
ok(kHoy.costo, 8100, 'hoy 29 ninos: costo', 0);

const k60 = MOTOR.kinder({ ninos: 48 });
ok(k60.detalle.reduce((s, d) => s + d.facturacion, 0), k60.facturacion,
   'a 48 ninos: el desglose suma la facturacion', 0.01);
ok(k60.facturacion, 34*587 + 14*786, 'a 48 ninos: facturacion', 0.01);
esIgual(k60.grupos, 5, 'a 48 ninos: grupos');
ok(k60.costo, 13500, 'a 48 ninos: costo', 0);

/* A capacidad llena el reparto es exacto (56 y 24) y coincide con lo que
   daba el ticket promedio. */
const k100 = MOTOR.kinder({ ninos: 80 });
ok(k100.facturacion, 51736, 'a 80 ninos: facturacion', 0.01);
ok(k100.detalle[0].ninos, 56, 'a 80 ninos: 56 en plan 4,5 h', 0);
ok(k100.detalle[1].ninos, 24, 'a 80 ninos: 24 en plan 8 h', 0);
ok(k100.detalle.reduce((s, d) => s + d.facturacion, 0), 51736,
   'a 80 ninos: el desglose suma la facturacion', 0.01);
esIgual(k100.grupos, 8, 'a 80 ninos: grupos');
ok(k100.costo, 21600, 'a 80 ninos: costo', 0);
ok(k100.margen, 30136, 'a 80 ninos: margen');

/* El desglose tiene que cuadrar en todo el recorrido, no solo en los
   escenarios elegidos. */
for (const n of [29, 33, 41, 55, 67, 73, 80]){
  const k = MOTOR.kinder({ ninos: n });
  ok(k.detalle.reduce((s, d) => s + d.facturacion, 0), k.facturacion,
     `a ${n} ninos el desglose cuadra`, 0.01);
  esIgual(k.detalle.reduce((s, d) => s + d.ninos, 0), n, `a ${n} ninos los planes suman`);
}

const k2028 = MOTOR.kinder({ ninos: 100, precio45: 687, precio8: 886 });
ok(k2028.facturacion, 74670, 'con 100 ninos y precio +$100: facturacion', 0.01);
esIgual(k2028.grupos, 10, 'con 100 ninos: grupos');
ok(k2028.costo, 27000, 'con 100 ninos: costo', 0);
ok(k2028.margen, 47670, 'con 100 ninos: margen', 0.01);
ok(k2028.facturacion * 12, 896040, 'con 100 ninos: facturacion anual', 0.01);

// La regla que el cliente va a querer comprobar en vivo.
const k30 = MOTOR.kinder({ ninos: 30 }), k31 = MOTOR.kinder({ ninos: 31 });
ok(k31.costo - k30.costo, 2700, 'de 30 a 31 ninos el costo sube un grupo', 0);
esIgual(k30.grupos, 3, 'a 30 ninos: 3 grupos');
esIgual(k31.grupos, 4, 'a 31 ninos: 4 grupos');

// Tope de capacidad instalada.
esIgual(MOTOR.kinder({ ninos: 80 }).excedeCapacidad, false, 'a 80 ninos no excede capacidad');
esIgual(MOTOR.kinder({ ninos: 81 }).excedeCapacidad, true, 'a 81 ninos excede capacidad');
esIgual(MOTOR.kinder({ ninos: 100 }).excedeCapacidad, true, 'a 100 ninos excede capacidad');

/* El costo por grupo sale de sus partes, no es un numero suelto: profesor
   mas asistente mas prestaciones. Es el costo ya ajustado que contempla el
   proyecto, y es lo que sostiene la nota al pie del cuadro resumen sobre la
   caida del margen bruto. */
ok(MOTOR.KINDER_COSTO_PROFESOR + MOTOR.KINDER_COSTO_ASISTENTE, 1800, 'profesor mas asistente', 0);
ok((MOTOR.KINDER_COSTO_PROFESOR + MOTOR.KINDER_COSTO_ASISTENTE) * (1 + MOTOR.PRESTACIONES),
   2700, 'con 50% de prestaciones da el costo por grupo', 0);
ok(MOTOR.partida().kinder.costoGrupo, 2700, 'y es el que usa el motor', 0);
ok(MOTOR.KINDER_COSTO_GRUPO_2026, 1680, 'costo por grupo de 2026, sin el ajuste', 0);
esIgual(MOTOR.KINDER_COSTO_GRUPO_2026 < 2700, true, 'el ajuste salarial encarece el grupo');

// La brecha entre lo real y lo calculado: tarifas viejas sin migrar.
ok(kHoy.facturacion - MOTOR.REAL.kinder.facturacion, 1752, 'brecha tarifas sin migrar', 0.5);

/* ==========================================================================
   AFTER SCHOOL
   ========================================================================== */
console.log('\nAFTER SCHOOL');

/* Baby & Me sale de After School y pasa a ser unidad propia: 220 - 8 = 212.
   Solo se le quitan los 8 cupos de entre semana; su franja del sabado sigue
   dictandose dentro de After School y sigue costando. */
esIgual(MOTOR.AS_CUPOS_TOTALES, 212, 'cupos totales sin Baby & Me entre semana');

const as100 = MOTOR.afterSchool({ ocupacion: 1 });
ok(as100.facturacion, 32687.04, 'al 100%: facturacion', 0.01);
esIgual(as100.alumnos, 212, 'al 100%: alumnos');
ok(as100.costo, 6798.10, 'al 100%: costo (sin Baby & Me, que es unidad propia)', 0.01);
ok(as100.margen, 25888.94, 'al 100%: margen', 0.01);

/* El conteo real de hoy son 80 alumnos. Con redondeo independiente por
   disciplina no hay ninguna ocupacion que de 80: salta de 78 a 81, porque
   cada disciplina redondea por su lado y los saltos se acumulan. El reparto
   por resto mayor reparte primero los enteros y luego las unidades que
   sobran a las disciplinas con mayor fraccion pendiente, de modo que la
   suma es siempre round(cupos x ocupacion). */
const asHoy = MOTOR.afterSchool({ ocupacion: MOTOR.AS_OCUPACION_HOY });
esIgual(asHoy.alumnos, 80, 'en la ocupacion de hoy: 80 alumnos, el conteo real');
ok(MOTOR.AS_OCUPACION_HOY * 100, 37.7, 'que sobre 212 cupos es 37,7%', 0.05);

for (const o of [0, 0.25, 0.377358, 0.5, 0.6, 0.777, 0.9, 1]){
  const r = MOTOR.afterSchool({ ocupacion: o });
  esIgual(r.alumnos, Math.round(MOTOR.AS_CUPOS_TOTALES * o),
          `al ${(o*100).toFixed(1)}%: los alumnos suman round(212 x ocupacion)`);
  esIgual(r.detalle.every(d => Number.isInteger(d.alumnos)), true,
          `al ${(o*100).toFixed(1)}%: y cada disciplina tiene alumnos enteros`);
}

const as60 = MOTOR.afterSchool({ ocupacion: 0.6 });
esIgual(as60.alumnos, 127, 'al 60%: alumnos');
ok(as60.costo, 6798.10, 'al 60%: costo', 0.01);

/* La regla que confirmo el equipo: al llenar los cupos que ya existen el
   costo no se mueve, porque las clases ya se dictan. Es lo que sostiene el
   hallazgo de la seccion 2 y lo que separa a After School de Kinder. */
ok(as100.costo - as60.costo, 0, 'de 128 a 212 alumnos el costo no cambia', 0);
ok(MOTOR.afterSchool({ ocupacion: 0.35 }).costo, 6798.10, 'ni siquiera al 35%', 0.01);

/* ==========================================================================
   BABY AND ME

   Dos franjas con precio distinto, no una sola sesion:

     Sabado      2 sesiones de 1 h, 8 niños cada una = 16 cupos, plan $97
     Entre semana 4 sesiones de 1 h (lunes a jueves), 8 niños cada una.
                  Cada niño asiste dos veces por semana, asi que caben 16,
                  no 32, y pagan plan de $165.

   El costo escala con las sesiones que se dictan: una franja sin alumnos no
   se dicta y no cuesta. Es la misma regla de After School.
   ========================================================================== */
console.log('\nBABY AND ME');

esIgual(MOTOR.BABY_CUPOS, 32, 'treinta y dos cupos entre las dos franjas');
esIgual(MOTOR.BABY_ALUMNOS_HOY, 0, 'cero alumnos hoy');

const b100 = MOTOR.baby({ ocupacion: 1 });
esIgual(b100.alumnos, 32, 'a plena ocupacion: 32 alumnos');
ok(b100.facturacion, 4192, 'a plena ocupacion: facturacion mensual', 0);
ok(b100.facturacion * 12, 50304, 'a plena ocupacion: facturacion anual', 0);
ok(b100.costo, 649.50, 'a plena ocupacion: costo (6 sesiones x 1 h x 4,33 x $25)', 0.5);
ok(b100.margen, 3542, 'a plena ocupacion: margen', 1);
ok(b100.margen / b100.facturacion * 100, 85, 'a plena ocupacion: margen sobre facturacion', 0.5);

/* El desglose de la tarjeta tiene que sumar su propio total. */
esIgual(b100.detalle.length, 2, 'dos franjas en el desglose');
ok(b100.detalle.reduce((s, d) => s + d.facturacion, 0), b100.facturacion, 'el desglose suma la facturacion', 0.01);
ok(b100.detalle.reduce((s, d) => s + d.costo, 0), b100.costo, 'y el costo', 0.01);
ok(b100.detalle[0].cupos, 16, 'sabado: 16 cupos', 0);
ok(b100.detalle[0].precio, 97, 'sabado: plan de $97', 0);
ok(b100.detalle[1].cupos, 16, 'entre semana: 16 cupos', 0);
ok(b100.detalle[1].precio, 165, 'entre semana: plan de $165', 0);
ok(b100.detalle[0].facturacion, 1552, 'sabado: facturacion', 0);
ok(b100.detalle[1].facturacion, 2640, 'entre semana: facturacion', 0);

/* Sin alumnos no se dicta, y lo que no se dicta no cuesta. */
const b0 = MOTOR.baby({ ocupacion: 0 });
ok(b0.facturacion, 0, 'sin alumnos: no factura', 0);
ok(b0.costo, 0, 'sin alumnos: no cuesta', 0);
ok(b0.margen, 0, 'sin alumnos: margen cero', 0);

/* El costo escala por franja: si solo hay alumnos en el sabado, solo se
   dictan sus dos sesiones. */
const bSoloSab = MOTOR.baby({ alumnos: [16, 0] });
ok(bSoloSab.costo, 2 * 4.33 * 25, 'solo sabado: dos sesiones dictadas', 0.5);
ok(bSoloSab.facturacion, 1552, 'solo sabado: factura solo su franja', 0);
const bSoloSem = MOTOR.baby({ alumnos: [0, 16] });
ok(bSoloSem.costo, 4 * 4.33 * 25, 'solo entre semana: cuatro sesiones dictadas', 0.5);

/* El costo por hora es editable: puede atenderla un profesor de Kinder. */
const bCaro = MOTOR.baby({ ocupacion: 1, costoHora: 40 });
ok(bCaro.costo, 6 * 4.33 * 40, 'costo por hora editable', 0.5);
esIgual(bCaro.facturacion === b100.facturacion, true, 'y no toca la facturacion');
/* ==========================================================================
   CUMPLEANOS
   ========================================================================== */
console.log('\nCUMPLEANOS');

const c60 = MOTOR.cumpleanos({ eventosSemana: 2.4 });
esIgual(c60.eventos, 10, 'al 60%: eventos (enteros)');
ok(c60.facturacion, 4500, 'al 60%: facturacion', 0);
ok(c60.costo, 1720, 'al 60%: costo', 0);
ok(c60.margen, 2780, 'al 60%: margen', 0);

const c100 = MOTOR.cumpleanos({ eventosSemana: 4 });
esIgual(c100.eventos, 17, 'al 100%: eventos (tope 4 por semana)');
ok(c100.facturacion, 7650, 'al 100%: facturacion', 0);
ok(c100.costo, 2924, 'al 100%: costo', 0);
ok(c100.margen, 4726, 'al 100%: margen', 0);

esIgual(Number.isInteger(MOTOR.cumpleanos({ eventosSemana: 1.4 }).eventos), true, 'los eventos siempre son enteros');

/* Desglose para la tabla de la tarjeta. */
esIgual(c60.detalle.length, 1, 'Cumpleanos: una linea de desglose');
ok(c60.detalle[0].facturacion, c60.facturacion, 'y suma la facturacion', 0.01);
ok(c60.detalle[0].costo, c60.costo, 'y el costo', 0.01);
ok(c60.detalle[0].cantidad, 10, 'con los eventos del mes', 0);


/* ==========================================================================
   VERANITO
   ========================================================================== */
console.log('\nVERANITO');

const vTemp = MOTOR.veranito({ ocupacion: 1 });
ok(vTemp.facturacion * 2, 200662, 'dos temporadas al 100%', 1);
ok(vTemp.costo, vTemp.facturacion * 0.20, 'costo operativo = 20% de la facturacion', 0.01);
ok(MOTOR.TICKET_VERANITO, 182.42, 'ticket real (no el de lista)', 0.01);

// Los controles de precio deben mover el ticket efectivo, no ignorarse.
const vCaro = MOTOR.veranito({ ocupacion: 1, precio45: 200, precio8: 235 });
esIgual(vCaro.facturacion > vTemp.facturacion, true, 'subir el precio de lista sube la facturacion');

/* La tarjeta muestra la cifra mensual prorrateada para que se lea igual que
   las otras cuatro unidades, que son todas mensuales. La cadena que la
   sostiene tiene que quedar visible y cuadrar: las dos temporadas suman el
   año, y el año entre doce da la cifra grande. */
const vHoy = MOTOR.veranitoAnual({
  mayAgo: { ocupacion: 0.84 }, eneMar: { ocupacion: 0.38 },
});
ok(vHoy.anual.facturacion, 122404, 'las dos temporadas de hoy suman el año', 1);
ok(vHoy.mayAgo.facturacion + vHoy.eneMar.facturacion, vHoy.anual.facturacion,
   'el desglose por temporada suma el anual', 0.01);
ok(vHoy.mes.facturacion, 122404 / 12, 'la cifra mensual es el anual entre doce', 1);
ok(vHoy.mes.facturacion, 10200, 'que hoy son unos $10.200 al mes', 1);
ok(vHoy.mes.costo, vHoy.anual.costo / 12, 'y el costo va prorrateado igual', 0.01);
ok(vHoy.mes.margen, vHoy.anual.margen / 12, 'y el margen tambien', 0.01);
ok(vHoy.mes.facturacion - vHoy.mes.costo, vHoy.mes.margen, 'el margen mensual cuadra', 0.01);

const vLleno = MOTOR.veranitoAnual({ mayAgo:{ ocupacion:1 }, eneMar:{ ocupacion:1 } });
ok(vLleno.anual.facturacion, 200662, 'a plena ocupacion el anual es el de la spec', 1);
ok(vLleno.mes.facturacion, 200662 / 12, 'y su mensual sale del mismo anual', 1);

/* ==========================================================================
   CUADRO RESUMEN
   El corazon de la reunion. 2025 y 2026 son datos cerrados y se comprueban
   contra si mismos; 2027 se calcula con las reglas de las unidades.
   ========================================================================== */
console.log('\nRESUMEN · 2025 Y 2026');

const a25 = MOTOR.resumen(2025), a26 = MOTOR.resumen(2026);

ok(a25.ingresos, 477150, '2025: ingresos', 0);
ok(a25.manoDeObra, 120044, '2025: costo de mano de obra', 0);
ok(a25.margenBruto, 357106, '2025: margen bruto', 0);
ok(a25.margenBrutoPct * 100, 74.8, '2025: margen bruto %', 0.05);
ok(a25.gastos, 295066, '2025: gastos operativos', 0);
ok(a25.ebitda, 62040, '2025: EBITDA', 0);
ok(a25.ebitdaPct * 100, 13.0, '2025: EBITDA %', 0.05);

ok(a26.ingresos, 531459, '2026: ingresos', 0);
ok(a26.manoDeObra, 107160, '2026: costo de mano de obra', 0);
ok(a26.margenBruto, 424299, '2026: margen bruto', 0);
ok(a26.margenBrutoPct * 100, 79.8, '2026: margen bruto %', 0.05);
ok(a26.gastos, 300000, '2026: gastos operativos', 0);
ok(a26.ebitda, 124299, '2026: EBITDA', 0);
ok(a26.ebitdaPct * 100, 23.4, '2026: EBITDA %', 0.05);

/* El desglose por unidad tiene que sumar el total del año, o el cuadro y el
   detalle se contradicen delante del cliente. */
const suma = u => u.reduce((s, x) => s + x, 0);
ok(suma(MOTOR.UNIDADES_2025), 477150, '2025: el desglose por unidad suma el total', 1);
ok(suma(MOTOR.UNIDADES_2026), 531459, '2026: el desglose por unidad suma el total', 1);
ok(MOTOR.VERANITO_2026.eneMar + MOTOR.VERANITO_2026.mayAgo, 121421,
   '2026: Veranito son sus dos temporadas reales', 0);

console.log('\nRESUMEN · 2027');

/* Otros ingresos: renglon fijo al nivel de 2026. No escala con la ocupacion
   porque no depende de cuantos cupos se llenen. */
ok(MOTOR.OTROS_INGRESOS, 10900, 'otros ingresos, fijos', 0);

const p60  = MOTOR.resumen2027({ ocupacion: 0.60, gastosMes: 25000 });
const p80  = MOTOR.resumen2027({ ocupacion: 0.80, gastosMes: 25000 });
const p100 = MOTOR.resumen2027({ ocupacion: 1.00, gastosMes: 25000 });

ok(p60.ingresos, 822945, 'al 60%: ingresos', 50);
ok(p60.margenBrutoPct * 100, 64.0, 'al 60%: margen bruto %', 0.15);
ok(p60.ebitda, 226854, 'al 60%: EBITDA', 50);
ok(p60.ebitdaPct * 100, 27.6, 'al 60%: EBITDA %', 0.15);

ok(p80.ingresos, 1098558, 'al 80%: ingresos', 50);
ok(p80.margenBrutoPct * 100, 65.7, 'al 80%: margen bruto %', 0.15);
ok(p80.ebitda, 421385, 'al 80%: EBITDA', 50);

ok(p100.ingresos, 1366742, 'al 100%: ingresos', 50);
ok(p100.margenBrutoPct * 100, 69.0, 'al 100%: margen bruto %', 0.15);
ok(p100.ebitda, 642951, 'al 100%: EBITDA', 50);

/* ==========================================================================
   EL DESLIZADOR NUNCA PUEDE BAJAR EL EBITDA

   Es un requisito de la reunion, no una preferencia: si el cliente sube la
   ocupacion y el numero baja, la proyeccion pierde credibilidad aunque la
   aritmetica sea correcta.

   Y baja de verdad si el paso es fino. Un grupo de Kinder cuesta $32.400 al
   año y un punto de ocupacion solo aporta unos $13.200, asi que cada vez
   que Kinder cruza un escalon de diez niños el EBITDA retrocede. Con paso
   de cinco puntos cada movimiento aporta unos $66.000 y absorbe el grupo.

   El suelo y el paso viven en el motor porque son los dos juntos los que
   sostienen esta garantia: cambiar uno solo la rompe.

   El suelo esta en 5% y no en 45% desde que la ocupacion se comparte con la
   seccion 2: el deslizador enseña el mismo dato que las tarjetas, que
   arrancan en la ocupacion real y bajan hasta el 0% de Baby and Me.

   No baja hasta 0 porque entre 0% y 5% si retrocede, por un motivo distinto
   al de Kinder: ahi se enciende de golpe toda la base de costos. Los valores
   que la rejilla no puede representar —0%, 37,5%— se muestran exactos en la
   etiqueta aunque el punto descanse en la posicion mas cercana.
   ========================================================================== */
console.log('\nRECORRIDO DEL DESLIZADOR');

ok(MOTOR.OCUPACION_2027_MINIMA * 100, 5, 'ocupacion minima del deslizador', 0);
ok(MOTOR.OCUPACION_2027_PASO, 5, 'paso del deslizador, en puntos', 0);

const posiciones = [];
for (let o = MOTOR.OCUPACION_2027_MINIMA * 100; o <= 100; o += MOTOR.OCUPACION_2027_PASO) posiciones.push(o);

esIgual(posiciones.includes(MOTOR.OCUPACION_2027_PARTIDA * 100), true,
        'la ocupacion de partida cae en una posicion del deslizador');

let subeSiempre = true, positivoSiempre = true, caida = '';
let anterior = null;
for (const o of posiciones){
  const p = MOTOR.resumen2027({ ocupacion:o/100, gastosMes:MOTOR.GASTOS_MES_PARTIDA });
  if (p.ebitda < 0) positivoSiempre = false;
  if (anterior !== null && p.ebitda < anterior.eb){
    subeSiempre = false;
    caida = `${anterior.o}% -> ${o}%`;
  }
  anterior = { o, eb: p.ebitda };
}
esIgual(subeSiempre, true, 'el EBITDA nunca baja mientras la ocupacion sube' + (caida ? ' · cae en ' + caida : ''));
esIgual(posiciones.length, 20, 'veinte posiciones, de 5% a 100%');

/* El suelo ya no saca la zona de perdida: eso se perdio al compartir el dato
   con la seccion 2. Queda anotado donde deja de ser negativo, que es lo que
   hay que saber antes de arrastrar el deslizador delante del cliente. */
esIgual(positivoSiempre, false, 'por debajo del 40% el EBITDA es negativo');
esIgual(posiciones.find(o => MOTOR.resumen2027({ ocupacion:o/100, gastosMes:MOTOR.GASTOS_MES_PARTIDA }).ebitda >= 0), 40,
        'y a partir del 40% es positivo');

/* La prueba de que el paso fino si la rompe: si alguien lo devuelve a 1,
   esta comprobacion recuerda por que estaba en 5. */
let caidasConPasoFino = 0, prev = null;
for (let o = MOTOR.OCUPACION_2027_MINIMA * 100; o <= 100; o++){
  const eb = MOTOR.resumen2027({ ocupacion:o/100, gastosMes:MOTOR.GASTOS_MES_PARTIDA }).ebitda;
  if (prev !== null && eb < prev) caidasConPasoFino++;
  prev = eb;
}
esIgual(caidasConPasoFino, 7, 'con paso de 1 punto habria siete retrocesos');

/* Y la razon exacta de que el suelo sea 5 y no 0: ahi el retroceso no lo
   causa Kinder abriendo grupo, sino toda la base de costos encendiendose. */
const eb0 = MOTOR.resumen2027({ ocupacion:0, gastosMes:MOTOR.GASTOS_MES_PARTIDA }).ebitda;
const eb5 = MOTOR.resumen2027({ ocupacion:0.05, gastosMes:MOTOR.GASTOS_MES_PARTIDA }).ebitda;
esIgual(eb5 < eb0, true, 'del 0% al 5% el EBITDA retrocede: por eso el suelo no es 0');

/* Coherencia interna en cualquier punto del deslizador. */
for (const o of [0.30, 0.45, 0.72, 0.91, 1.00]){
  const p = MOTOR.resumen2027({ ocupacion: o, gastosMes: 25000 });
  ok(p.ingresos - p.manoDeObra, p.margenBruto, `al ${Math.round(o*100)}%: margen bruto cuadra`, 0.5);
  ok(p.margenBruto - p.gastos, p.ebitda, `al ${Math.round(o*100)}%: EBITDA cuadra`, 0.5);
}

/* Los gastos solo tocan 2027, y por doce. */
const gastosAltos = MOTOR.resumen2027({ ocupacion: 0.60, gastosMes: 30000 });
ok(gastosAltos.gastos, 360000, 'los gastos mensuales se anualizan por doce', 0);
ok(p60.ebitda - gastosAltos.ebitda, 60000, 'subir gastos $5.000/mes baja el EBITDA $60.000', 0.5);
ok(gastosAltos.margenBruto, p60.margenBruto, 'los gastos no tocan el margen bruto', 0.5);
ok(MOTOR.resumen(2025).ebitda, 62040, 'los gastos de 2027 no tocan 2025', 0);
ok(MOTOR.resumen(2026).ebitda, 124299, 'los gastos de 2027 no tocan 2026', 0);

/* La ocupacion mueve ingresos y mano de obra; otros ingresos no. */
ok(p100.ingresos - p60.ingresos, 543798, 'la ocupacion mueve los ingresos', 100);
esIgual(p60.otrosIngresos === p100.otrosIngresos, true, 'otros ingresos no escalan');

/* El contraste que hay que poder explicar: el margen bruto cae respecto a
   2026 pero el EBITDA sube. */
esIgual(p60.margenBrutoPct < a26.margenBrutoPct, true, 'el margen bruto de 2027 baja contra 2026');
esIgual(p60.ebitdaPct > a26.ebitdaPct, true, 'y aun asi el EBITDA sube');

/* ==========================================================================
   PARTIDA Y REINICIO
   ========================================================================== */
console.log('\nPARTIDA');

const p = MOTOR.partida();
ok(p.kinder.ninos, 30, 'partida Kinder: ninos', 0);
ok(p.kinder.precio45, 587, 'partida Kinder: precio 4,5 h', 0);
ok(p.kinder.precio8, 786, 'partida Kinder: precio 8 h', 0);
ok(p.kinder.pct45, 0.70, 'partida Kinder: % plan 4,5 h', 0);
ok(p.kinder.costoGrupo, 2700, 'partida Kinder: costo por grupo', 0);
ok(p.afterSchool.ocupacion, 80/212, 'partida After School: la ocupacion de hoy', 0.001);
ok(p.cumpleanos.eventosSemana, 1.4, 'partida Cumpleanos: eventos por semana', 0.001);
ok(p.veranito.mayAgo.ocupacion, 0.84, 'partida Veranito may-ago: ocupacion', 0.001);
ok(p.veranito.eneMar.ocupacion, 0.38, 'partida Veranito ene-mar: ocupacion', 0.001);

// partida() debe devolver copias: si devuelve la misma referencia, el boton
// de reinicio no restaura nada porque los controles ya la mutaron.
const p2 = MOTOR.partida();
p2.kinder.ninos = 999;
ok(MOTOR.partida().kinder.ninos, 30, 'partida() devuelve copia nueva cada vez', 0);

/* ==========================================================================
   FORMATO
   La spec fija como se ven las cifras, no solo cuanto valen: enteros donde
   el cliente verifica de cabeza, signo + explicito en los deltas, y
   decimales solo donde importan.
   ========================================================================== */
console.log('\nFORMATO');

esIgual(FORMATO.dinero(31041.6), '$31.042', 'dinero redondea al peso');
esIgual(FORMATO.dinero(92963.28), '$92.963', 'dinero con separador de miles');
esIgual(FORMATO.dinero(0), '$0', 'dinero en cero');
esIgual(FORMATO.dinero(-1200), '-$1.200', 'dinero negativo lleva el signo antes');
esIgual(FORMATO.dinero(896040), '$896.040', 'dinero en cifras de seis digitos');

esIgual(FORMATO.delta(16539.87), '+$16.540', 'delta positivo lleva + explicito');
esIgual(FORMATO.delta(44376.79), '+$44.377', 'delta positivo grande');
esIgual(FORMATO.delta(-2300), '-$2.300', 'delta negativo lleva -');
esIgual(FORMATO.delta(0), '$0', 'delta en cero no lleva signo');

esIgual(FORMATO.precio(169.06), '$169,06', 'precio conserva los centavos');
esIgual(FORMATO.precio(111.28), '$111,28', 'precio con centavos');
esIgual(FORMATO.precio(200), '$200', 'precio redondo sin centavos de relleno');
esIgual(FORMATO.precio(587), '$587', 'precio de Kinder');

esIgual(FORMATO.pct(0.6), '60%', 'porcentaje sin decimales');

/* El cuadro resumen necesita un decimal: la spec escribe 74,8% y 13,0%, y
   redondeados a entero (75% y 13%) el cuadro deja de coincidir con la tabla
   que el equipo ya reviso. */
esIgual(FORMATO.pctDecimal(0.748), '74,8%', 'un decimal para el cuadro resumen');
esIgual(FORMATO.pctDecimal(0.13), '13,0%', 'el cero decimal no se omite');
esIgual(FORMATO.pctDecimal(0.798), '79,8%', 'margen bruto de 2026');
esIgual(FORMATO.pctDecimal(0.234), '23,4%', 'EBITDA de 2026');
esIgual(FORMATO.pctDecimal(MOTOR.resumen(2025).margenBrutoPct), '74,8%', '2025 desde el motor');
esIgual(FORMATO.pctDecimal(MOTOR.resumen(2025).ebitdaPct), '13,0%', '2025 EBITDA desde el motor');
esIgual(FORMATO.pctDecimal(MOTOR.resumen(2026).margenBrutoPct), '79,8%', '2026 desde el motor');
esIgual(FORMATO.pctDecimal(MOTOR.resumen(2026).ebitdaPct), '23,4%', '2026 EBITDA desde el motor');
esIgual(FORMATO.pct(0.3636), '36%', 'porcentaje redondea');
esIgual(FORMATO.pct(0.84), '84%', 'porcentaje de Veranito');

esIgual(FORMATO.entero(10.392), '10', 'entero para los eventos de Cumpleanos');
esIgual(FORMATO.entero(17.32), '17', 'entero al tope de Cumpleanos');

/* ==========================================================================
   PLAN DE PAGOS
   Un cronograma de pagos que no suma el total es peor que no mostrarlo:
   el cliente saca la calculadora en la reunion. Los montos que se muestran
   tienen que cuadrar al peso, incluso cuando el resto no se divide exacto
   entre las mensualidades.
   ========================================================================== */
console.log('\nPLAN DE PAGOS');

const pl1 = MOTOR.plan({ total:96000, pctPrimero:0.5, meses:6, pctFinal:0 });
ok(pl1.primero, 48000, 'primer pago del 50%', 0);
ok(pl1.mensualidad, 8000, 'seis mensualidades de 8.000', 0);
ok(pl1.final, 0, 'sin pago final', 0);
esIgual(pl1.suma === 96000, true, 'los montos suman el total');
esIgual(pl1.valido, true, 'plan valido');

const pl2 = MOTOR.plan({ total:96000, pctPrimero:0.4, meses:5, pctFinal:0.1 });
ok(pl2.primero, 38400, 'primer pago del 40%', 0);
ok(pl2.final, 9600, 'pago final del 10%', 0);
ok(pl2.mensualidad, 9600, 'cinco mensualidades de 9.600', 0);
esIgual(pl2.suma === 96000, true, 'con pago final tambien suma el total');

/* El caso que rompe cualquier cronograma escrito a mano: el resto no se
   divide exacto. El ajuste va a la ultima cuota y se dice cual es. */
// 70.000 entre 6 no da exacto: 11.666 y una ultima de 11.670.
const pl3 = MOTOR.plan({ total:100000, pctPrimero:0.3, meses:6, pctFinal:0 });
esIgual(pl3.suma === 100000, true, 'resto indivisible: sigue sumando el total');
esIgual(pl3.ultimaDifiere, true, 'la ultima cuota absorbe el ajuste');
ok(pl3.mensualidad, 11666, 'cuota regular', 0);
ok(pl3.ultima, 11670, 'ultima cuota con el ajuste', 0);
ok(pl3.mensualidad * (pl3.meses - 1) + pl3.ultima + pl3.primero, 100000, 'desglose completo', 0);
esIgual(Number.isInteger(pl3.mensualidad) && Number.isInteger(pl3.ultima), true,
        'las cuotas son enteras');

// Y cuando si divide exacto, no se inventa una ultima distinta.
const pl3b = MOTOR.plan({ total:100000, pctPrimero:0.3, meses:7, pctFinal:0 });
esIgual(pl3b.ultimaDifiere, false, 'division exacta: todas las cuotas iguales');
ok(pl3b.mensualidad, 10000, 'siete cuotas de 10.000', 0);

const pl4 = MOTOR.plan({ total:96000, pctPrimero:1, meses:0, pctFinal:0 });
ok(pl4.primero, 96000, 'pago unico', 0);
ok(pl4.mensualidad, 0, 'sin mensualidades', 0);
esIgual(pl4.valido, true, 'pago unico es valido');

const pl5 = MOTOR.plan({ total:96000, pctPrimero:0.7, meses:3, pctFinal:0.5 });
esIgual(pl5.valido, false, 'primer pago mas final por encima del total es invalido');

const pl6 = MOTOR.plan({ total:96000, pctPrimero:0, meses:12, pctFinal:0 });
ok(pl6.mensualidad, 8000, 'sin primer pago: doce cuotas de 8.000', 0);
esIgual(pl6.suma === 96000, true, 'sin primer pago tambien cuadra');


/* ==========================================================================
   AFTER SCHOOL EDITABLE POR DISCIPLINA
   El deslizador global reparte, pero cada disciplina se puede tocar aparte:
   ParKour al 100% y ParKids al 50% es una pregunta real en la reunion.
   ========================================================================== */
console.log('\nAFTER SCHOOL · POR DISCIPLINA');

const asBase = MOTOR.afterSchool({ ocupacion: 1 });
const nDis = asBase.detalle.length;
esIgual(nDis, 6, 'cinco disciplinas mas el sabado');

/* alumnos explicito gana sobre la ocupacion. */
const asMano = MOTOR.afterSchool({ alumnos: [40, 20, 20, 10, 8, 38] });
esIgual(asMano.alumnos, 136, 'los alumnos explicitos mandan');
esIgual(asMano.detalle[0].alumnos, 40, 'ParKour 6-14 al tope');
esIgual(asMano.detalle[4].alumnos, 8, 'ParKids a la mitad');
ok(asMano.detalle.reduce((s, d) => s + d.facturacion, 0), asMano.facturacion,
   'el desglose sigue sumando la facturacion', 0.01);

/* Una disciplina sin alumnos no se dicta y no cuesta; las demas si. */
const asSinParKids = MOTOR.afterSchool({ alumnos: [40, 40, 20, 20, 0, 76] });
ok(asBase.costo - asSinParKids.costo, 4 * MOTOR.SEM_MES * 25,
   'vaciar ParKids quita solo sus horas', 0.5);

/* El costo por hora tambien es editable, disciplina por disciplina. */
const asCaro = MOTOR.afterSchool({ ocupacion: 1, costosHora: [100, 50, 43, 43, 25, null] });
ok(asCaro.costo - asBase.costo, 8 * MOTOR.SEM_MES * (100 - 50),
   'subir el costo por hora de una disciplina', 0.5);
esIgual(asCaro.facturacion === asBase.facturacion, true, 'y no toca la facturacion');

/* ==========================================================================
   OCUPACION POR UNIDAD EN 2027
   Un deslizador por unidad en vez de uno solo: se puede mostrar Kinder al
   80% con After School al 50% y ver el total.
   ========================================================================== */
console.log('\n2027 · OCUPACION POR UNIDAD');

const uniforme = MOTOR.resumen2027({ ocupacion: 0.60, gastosMes: 25000 });
const porUnidad = MOTOR.resumen2027({
  ocupaciones: { kinder:0.60, afterSchool:0.60, veranito:0.60, cumpleanos:0.60, baby:0.60 },
  gastosMes: 25000 });
ok(porUnidad.ingresos, uniforme.ingresos, 'todas al 60% da lo mismo que el deslizador unico', 1);

const mixto = MOTOR.resumen2027({
  ocupaciones: { kinder:0.80, afterSchool:0.50, veranito:0.60, cumpleanos:0.60, baby:0.60 },
  gastosMes: 25000 });
esIgual(mixto.ingresos !== uniforme.ingresos, true, 'mover una sola unidad cambia el total');
ok(mixto.ingresos - mixto.manoDeObra, mixto.margenBruto, 'el margen bruto sigue cuadrando', 0.5);
ok(mixto.margenBruto - mixto.gastos, mixto.ebitda, 'y el EBITDA tambien', 0.5);

/* Subir una sola unidad tiene que subir los ingresos del total. */
const soloKinder = MOTOR.resumen2027({
  ocupaciones: { kinder:1, afterSchool:0.60, veranito:0.60, cumpleanos:0.60, baby:0.60 },
  gastosMes: 25000 });
esIgual(soloKinder.ingresos > uniforme.ingresos, true, 'subir solo Kinder sube el total');
const soloBaby = MOTOR.resumen2027({
  ocupaciones: { kinder:0.60, afterSchool:0.60, veranito:0.60, cumpleanos:0.60, baby:1 },
  gastosMes: 25000 });
esIgual(soloBaby.ingresos > uniforme.ingresos, true, 'y subir solo Baby and Me tambien');

/* ==========================================================================
   PLAN DE PAGOS POR MONTOS
   Los campos editables son montos, no porcentajes: total, pago inicial,
   numero de mensualidades y pago final.
   ========================================================================== */
console.log('\nPLAN POR MONTOS');

const pm = MOTOR.plan({ total:71500, primero:25000, meses:10, final:7750 });
ok(pm.primero, 25000, 'pago inicial', 0);
ok(pm.mensualidad, 3875, 'diez mensualidades de 3.875', 0);
ok(pm.final, 7750, 'pago final', 0);
esIgual(pm.suma === 71500, true, 'el desglose suma el total');
esIgual(pm.ultimaDifiere, false, 'las diez cuotas son iguales');
esIgual(pm.valido, true, 'plan valido');
ok(pm.pctPrimero * 100, 35, 'el porcentaje del inicial se deriva del monto', 0.1);
ok(pm.pctFinal * 100, 10.8, 'y el del final tambien', 0.1);

/* Si los dos pagos se pasan del total, se dice en vez de mostrar una cuota
   negativa. */
const pmMal = MOTOR.plan({ total:71500, primero:50000, meses:10, final:30000 });
esIgual(pmMal.valido, false, 'inicial mas final por encima del total es invalido');

/* Resto indivisible: el ajuste va a la ultima y se declara. */
const pmResto = MOTOR.plan({ total:100000, primero:30000, meses:6, final:0 });
esIgual(pmResto.suma === 100000, true, 'con resto indivisible sigue sumando');
esIgual(pmResto.ultimaDifiere, true, 'y la ultima absorbe el ajuste');

/* ==========================================================================
   ENTREGABLES
   El conteo por fase es una afirmacion de la presentacion: si alguien
   agrega o mueve uno en la hoja y lo transcribe mal aqui, el titulo de la
   fase deja de coincidir con lo que se despliega debajo.
   ========================================================================== */
console.log('\nENTREGABLES');

esIgual(DATOS.ENTREGABLES.length, 41, 'total de entregables');
const porFase = n => DATOS.ENTREGABLES.filter(e => e.fase === n).length;
esIgual(porFase(1), 12, 'Fase 1');
esIgual(porFase(2), 11, 'Fase 2');
esIgual(porFase(3), 8,  'Fase 3');
esIgual(porFase(4), 8,  'Fase 4');
esIgual(porFase(0), 2,  'Durante todo el proyecto');

/* Baby and Me deja de ser una fila vacia en el gantt: pasa de cero
   entregables propios a siete. */
esIgual(DATOS.ENTREGABLES.filter(e => e.unidad === 'Baby and Me').length, 7,
        'Baby and Me tiene siete entregables propios');

esIgual(DATOS.ENTREGABLES.every(e => e.unidad && e.segmento && e.nota && e.fecha),
        true, 'todos traen unidad, segmento, fecha y descripcion');
esIgual(new Set(DATOS.ENTREGABLES.map(e => e.unidad)).size, 6,
        'seis unidades incluyendo Gerencia');

/* ==========================================================================
   LAS FECHAS CAEN DENTRO DE SU FASE

   Es lo que permite mostrarlas y colocar el conteo del gantt en el mes que
   toca. Mientras no calzaban, mostrarlas habria dejado a la vista que un
   entregable de fase 2 vencia en un mes de fase 1.
   ========================================================================== */
console.log('\nFECHAS');

const fuera = DATOS.ENTREGABLES.filter(e => {
  if (e.fase === 0) return false;
  const f = DATOS.FASES.find(x => x.numero === e.fase);
  return e.mes == null || e.mes < f.desde || e.mes > f.hasta;
});
esIgual(fuera.length, 0, 'ninguna fecha se sale de su fase');
if (fuera.length) fuera.forEach(e => console.log('       ' + e.nombre + ' · ' + e.fecha));

esIgual(DATOS.ENTREGABLES.filter(e => e.fase !== 0).every(e => e.mes >= 0 && e.mes < 12),
        true, 'todas caen dentro de los doce meses');
esIgual(DATOS.ENTREGABLES.filter(e => e.fase === 0).every(e => e.mes === null),
        true, 'los transversales no tienen mes propio');

/* Septiembre queda sin entregas: ese mes se dedica a cerrar el proyecto 1.
   La hoja de ruta tiene que decirlo, o el mes se lee como un hueco. */
esIgual(DATOS.ENTREGABLES.filter(e => e.mes === 0).length, 0,
        'septiembre no tiene entregas');
esIgual(Math.min(...DATOS.ENTREGABLES.filter(e => e.mes != null).map(e => e.mes)), 1,
        'la primera entrega cae en octubre');

/* El reparto por mes tiene que sumar los 39 con fase. */
const porMes = {};
DATOS.ENTREGABLES.forEach(e => { if (e.mes != null) porMes[e.mes] = (porMes[e.mes] || 0) + 1; });
esIgual(Object.values(porMes).reduce((a, b) => a + b, 0), 39,
        'los 39 con fase se reparten entre los meses');

/* ==========================================================================
   HOJA DE RUTA
   Doce meses y cuatro fases de tres. Si una fase se sale del rango o dos se
   solapan, el gantt dibuja barras que se pisan y el cliente lo ve.
   ========================================================================== */
console.log('\nHOJA DE RUTA');

esIgual(DATOS.MESES.length, 12, 'doce meses en la linea de tiempo');
const conNumero = DATOS.FASES.filter(f => f.numero > 0);
esIgual(conNumero.length, 4, 'cuatro fases numeradas');
esIgual(conNumero.every(f => f.hasta - f.desde === 2), true, 'cada fase ocupa tres meses');
esIgual(conNumero.every((f, i) => i === 0 || f.desde === conNumero[i-1].hasta + 1), true,
        'las fases van seguidas y no se solapan');
esIgual(conNumero[0].desde === 0 && conNumero[3].hasta === 11, true,
        'cubren los doce meses completos');
const transversal = DATOS.FASES.find(f => f.numero === 0);
esIgual(transversal.desde === 0 && transversal.hasta === 11, true,
        'los transversales cruzan los doce meses');

/* ==========================================================================
   INVERSION
   ========================================================================== */
console.log('\nINVERSION');

ok(DATOS.INVERSION.total, 71500, 'monto del proyecto', 0);
ok(DATOS.INVERSION.primero, 25000, 'pago inicial', 0);
ok(DATOS.INVERSION.cuotas, 10, 'numero de mensualidades', 0);
ok(DATOS.INVERSION.final, 7750, 'pago final', 0);

const inv = MOTOR.plan({ total:DATOS.INVERSION.total, primero:DATOS.INVERSION.primero,
                         meses:DATOS.INVERSION.cuotas, final:DATOS.INVERSION.final });
ok(inv.primero, 25000, 'el desglose arranca con los 25.000', 0);
ok(inv.mensualidad, 3875, 'diez cuotas de 3.875', 0);
ok(inv.final, 7750, 'y el pago final', 0);
ok(inv.pctPrimero * 100, 35, 'el inicial es el 35% del total', 0.1);
ok(inv.pctFinal * 100, 10.8, 'y el final el 10,8%', 0.1);
esIgual(inv.ultimaDifiere, false, 'las diez cuotas son iguales');
esIgual(inv.suma === 71500, true, 'el desglose suma el total');

/* ==========================================================================
   RELACIONES QUE SE DICEN EN VOZ ALTA
   ========================================================================== */
console.log('\nRELACIONES');

esIgual(FORMATO.pct(DATOS.PRUEBA_VERANITO.crecimiento), '57%', 'crecimiento de Veranito');
ok(DATOS.PRUEBA_VERANITO.relacion, 11, 'relacion de retorno de Veranito (11 a 1)', 0.3);
ok(DATOS.VALOR_VIDA.kinder.relacion, 28, 'valor de vida contra adquisicion en Kinder (28 a 1)', 0.2);
ok(DATOS.VALOR_VIDA.veranito.relacion, 19, 'venta contra adquisicion en Veranito', 0.1);


/* ========================================================================== */
console.log(`\n${'-'.repeat(78)}`);
console.log(`${pasadas} pasadas, ${fallidas} fallidas`);
if (fallidas) {
  console.log('\nFallos:');
  for (const f of fallos) console.log(`  · ${f.titulo}: dio ${f.real}, se esperaba ${f.esperado}`);
  process.exit(1);
}
