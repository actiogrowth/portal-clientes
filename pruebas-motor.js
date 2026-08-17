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

function cargarMotor() {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const m = html.match(/<script id="motor">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No se encontro el bloque <script id="motor"> en ' + ARCHIVO);
  const sandbox = {};
  new Function('exports', m[1] + '\nexports.MOTOR = MOTOR;')(sandbox);
  return sandbox.MOTOR;
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

const MOTOR = cargarMotor();

/* ==========================================================================
   KINDER
   ========================================================================== */
console.log('\nKINDER');

const kHoy = MOTOR.kinder({ ninos: 29 });
ok(kHoy.facturacion, 18754.30, 'hoy 29 ninos: facturacion calculada', 0.01);
esIgual(kHoy.grupos, 3, 'hoy 29 ninos: grupos');
ok(kHoy.costo, 8100, 'hoy 29 ninos: costo', 0);

const k60 = MOTOR.kinder({ ninos: 48 });
ok(k60.facturacion, 31042, 'al 60% (48 ninos): facturacion');
esIgual(k60.grupos, 5, 'al 60%: grupos');
ok(k60.costo, 13500, 'al 60%: costo', 0);
ok(k60.margen, 17542, 'al 60%: margen');

const k100 = MOTOR.kinder({ ninos: 80 });
ok(k100.facturacion, 51736, 'al 100% (80 ninos): facturacion', 0.01);
esIgual(k100.grupos, 8, 'al 100%: grupos');
ok(k100.costo, 21600, 'al 100%: costo', 0);
ok(k100.margen, 30136, 'al 100%: margen');

const k2028 = MOTOR.kinder({ ninos: 100, precio45: 687, precio8: 886 });
ok(k2028.facturacion, 74670, '2028 (100 ninos, precio +$100): facturacion', 0.01);
esIgual(k2028.grupos, 10, '2028: grupos');
ok(k2028.costo, 27000, '2028: costo', 0);
ok(k2028.margen, 47670, '2028: margen', 0.01);
ok(k2028.facturacion * 12, 896040, '2028: facturacion anual', 0.01);

// La regla que el cliente va a querer comprobar en vivo.
const k30 = MOTOR.kinder({ ninos: 30 }), k31 = MOTOR.kinder({ ninos: 31 });
ok(k31.costo - k30.costo, 2700, 'de 30 a 31 ninos el costo sube un grupo', 0);
esIgual(k30.grupos, 3, 'a 30 ninos: 3 grupos');
esIgual(k31.grupos, 4, 'a 31 ninos: 4 grupos');

// Tope de capacidad instalada.
esIgual(MOTOR.kinder({ ninos: 80 }).excedeCapacidad, false, 'a 80 ninos no excede capacidad');
esIgual(MOTOR.kinder({ ninos: 81 }).excedeCapacidad, true, 'a 81 ninos excede capacidad');
esIgual(MOTOR.kinder({ ninos: 100 }).excedeCapacidad, true, 'a 100 ninos (2028) excede capacidad');

// La brecha entre lo real y lo calculado: tarifas viejas sin migrar.
ok(kHoy.facturacion - MOTOR.REAL.kinder.facturacion, 1692, 'brecha tarifas sin migrar', 0.5);

/* ==========================================================================
   AFTER SCHOOL
   ========================================================================== */
console.log('\nAFTER SCHOOL');

esIgual(MOTOR.AS_CUPOS_TOTALES, 220, 'cupos totales');

const as100 = MOTOR.afterSchool({ ocupacion: 1 });
ok(as100.facturacion, 33577.28, 'al 100%: facturacion', 0.01);
esIgual(as100.alumnos, 220, 'al 100%: alumnos');
ok(as100.costo, 7447.60, 'al 100%: costo', 0.01);
ok(as100.margen, 26130, 'al 100%: margen');

const as60 = MOTOR.afterSchool({ ocupacion: 0.6 });
ok(as60.facturacion, 20281, 'al 60%: facturacion');
esIgual(as60.alumnos, 133, 'al 60%: alumnos (redondeo por disciplina)');
ok(as60.costo, 7447.60, 'al 60%: costo', 0.01);
ok(as60.margen, 12833, 'al 60%: margen');

// El hallazgo de la seccion 4: el costo no depende de cuantos ninos hay.
ok(as100.costo - as60.costo, 0, 'de 133 a 220 alumnos el costo no cambia', 0);

// Hoy: precios actuales, alumnos reales, sabado sin dictar.
const asHoy = MOTOR.afterSchoolHoy();
ok(asHoy.facturacion, 9089, 'hoy: facturacion con precios actuales', 0.01);
esIgual(asHoy.alumnos, 80, 'hoy: alumnos');
ok(asHoy.costo, 5265.28, 'hoy: costo (sin Baby & Me ni sabado)', 0.01);
ok(asHoy.costo, as100.costo - 433 - 1749.32, 'hoy: costo = total menos B&M y sabado', 0.01);

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

/* ==========================================================================
   CONSOLIDADO Y DELTAS
   ========================================================================== */
console.log('\nCONSOLIDADO');

const hoy = MOTOR.escenarioHoy();
ok(hoy.margen, 16615, 'margen consolidado de hoy', 1);
ok(hoy.facturacion, 30990, 'facturacion consolidada de hoy (cifras reales)', 1);

const e60 = MOTOR.escenario(0.6);
ok(e60.facturacion, 55823, 'al 60%: facturacion consolidada');
ok(e60.costo, 22668, 'al 60%: costo consolidado');
ok(e60.margen, 33155, 'al 60%: margen consolidado');
ok(e60.margen - hoy.margen, 16540, 'al 60%: delta de margen mensual');
ok((e60.margen - hoy.margen) * 12, 198480, 'al 60%: delta de margen anual', 12);

const e100 = MOTOR.escenario(1);
ok(e100.facturacion, 92963, 'al 100%: facturacion consolidada');
ok(e100.costo, 31972, 'al 100%: costo consolidado');
ok(e100.margen, 60992, 'al 100%: margen consolidado');
ok(e100.margen - hoy.margen, 44377, 'al 100%: delta de margen mensual');
ok((e100.margen - hoy.margen) * 12, 532524, 'al 100%: delta de margen anual', 12);

/* ==========================================================================
   PARTIDA Y REINICIO
   ========================================================================== */
console.log('\nPARTIDA');

const p = MOTOR.partida();
ok(p.kinder.ninos, 29, 'partida Kinder: ninos', 0);
ok(p.kinder.precio45, 587, 'partida Kinder: precio 4,5 h', 0);
ok(p.kinder.precio8, 786, 'partida Kinder: precio 8 h', 0);
ok(p.kinder.pct45, 0.70, 'partida Kinder: % plan 4,5 h', 0);
ok(p.kinder.costoGrupo, 2700, 'partida Kinder: costo por grupo', 0);
ok(p.afterSchool.ocupacion, 0.36, 'partida After School: ocupacion', 0.001);
ok(p.cumpleanos.eventosSemana, 1.4, 'partida Cumpleanos: eventos por semana', 0.001);
ok(p.veranito.mayAgo.ocupacion, 0.84, 'partida Veranito may-ago: ocupacion', 0.001);
ok(p.veranito.eneMar.ocupacion, 0.38, 'partida Veranito ene-mar: ocupacion', 0.001);

// partida() debe devolver copias: si devuelve la misma referencia, el boton
// de reinicio no restaura nada porque los controles ya la mutaron.
const p2 = MOTOR.partida();
p2.kinder.ninos = 999;
ok(MOTOR.partida().kinder.ninos, 29, 'partida() devuelve copia nueva cada vez', 0);

/* ========================================================================== */
console.log(`\n${'-'.repeat(78)}`);
console.log(`${pasadas} pasadas, ${fallidas} fallidas`);
if (fallidas) {
  console.log('\nFallos:');
  for (const f of fallos) console.log(`  · ${f.titulo}: dio ${f.real}, se esperaba ${f.esperado}`);
  process.exit(1);
}
