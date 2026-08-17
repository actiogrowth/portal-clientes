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
esIgual(FORMATO.pct(0.3636), '36%', 'porcentaje redondea');
esIgual(FORMATO.pct(0.84), '84%', 'porcentaje de Veranito');

esIgual(FORMATO.entero(10.392), '10', 'entero para los eventos de Cumpleanos');
esIgual(FORMATO.entero(17.32), '17', 'entero al tope de Cumpleanos');

/* Lo que esta en pantalla tiene que sumar. Si el consolidado se calcula
   exacto y se redondea al final, la columna no cuadra con su total y el
   cliente lo nota sumando de cabeza, que es exactamente lo que la spec
   quiere que pueda hacer. */
console.log('\nCUADRE VISIBLE');

const v60 = MOTOR.escenario(0.6), v100 = MOTOR.escenario(1);

esIgual(FORMATO.dinero(FORMATO.sumaVisible(
  [v60.kinder.facturacion, v60.afterSchool.facturacion, v60.cumpleanos.facturacion])),
  '$55.823', 'al 60%: el consolidado suma lo que se ve');
esIgual(FORMATO.dinero(FORMATO.sumaVisible(
  [v60.kinder.costo, v60.afterSchool.costo, v60.cumpleanos.costo])),
  '$22.668', 'al 60%: costo consolidado visible');
esIgual(FORMATO.dinero(FORMATO.sumaVisible(
  [v60.kinder.margen, v60.afterSchool.margen, v60.cumpleanos.margen])),
  '$33.155', 'al 60%: margen consolidado visible');

esIgual(FORMATO.dinero(FORMATO.sumaVisible(
  [v100.kinder.facturacion, v100.afterSchool.facturacion, v100.cumpleanos.facturacion])),
  '$92.963', 'al 100%: el consolidado suma lo que se ve');
esIgual(FORMATO.dinero(FORMATO.sumaVisible(
  [v100.kinder.margen, v100.afterSchool.margen, v100.cumpleanos.margen])),
  '$60.992', 'al 100%: margen consolidado visible');

/* El anual sale del mensual ya redondeado: el cliente multiplica por 12 lo
   que ve, no la cifra exacta que no ve. */
esIgual(FORMATO.deltaAnual(16540), '+$198.480', 'delta anual al 60%');
esIgual(FORMATO.deltaAnual(44377), '+$532.524', 'delta anual al 100%');
esIgual(FORMATO.deltaAnual(-1000), '-$12.000', 'delta anual negativo');

/* ==========================================================================
   REGLAS QUE NO SE ROMPEN
   Casos que ya funcionan y se fijan para que un cambio futuro no los pise.
   ========================================================================== */
console.log('\nREGLAS');

// ParKour 6-14 tiene 41 alumnos en 40 cupos: dejaron entrar uno de mas.
// El motor no debe recortarlo al cupo.
const pk = MOTOR.afterSchoolHoy().detalle.find(d => d.nombre === 'ParKour 6-14');
esIgual(pk.alumnos, 41, 'ParKour 6-14 conserva los 41 alumnos');
esIgual(pk.cupos, 40, 'ParKour 6-14 declara 40 cupos');
esIgual(pk.alumnos > pk.cupos, true, 'el motor no recorta al cupo');

// Veranito no entra en el consolidado mensual: es estacional.
esIgual(MOTOR.escenario(1).facturacion === MOTOR.escenario(1).kinder.facturacion
      + MOTOR.escenario(1).afterSchool.facturacion
      + MOTOR.escenario(1).cumpleanos.facturacion, true, 'el consolidado excluye Veranito');

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
   ENTREGABLES
   El conteo por fase es una afirmacion de la presentacion: si alguien
   agrega o mueve uno en la hoja y lo transcribe mal aqui, el titulo de la
   fase deja de coincidir con lo que se despliega debajo.
   ========================================================================== */
console.log('\nENTREGABLES');

esIgual(DATOS.ENTREGABLES.length, 34, 'total de entregables');
const porFase = n => DATOS.ENTREGABLES.filter(e => e.fase === n).length;
esIgual(porFase(1), 6,  'Fase 1');
esIgual(porFase(2), 11, 'Fase 2');
esIgual(porFase(3), 6,  'Fase 3');
esIgual(porFase(4), 8,  'Fase 4');
esIgual(porFase(0), 3,  'Durante todo el proyecto');

esIgual(DATOS.ENTREGABLES.every(e => e.unidad && e.segmento && e.fecha && e.nota),
        true, 'todos traen unidad, segmento, fecha y descripcion');
esIgual(new Set(DATOS.ENTREGABLES.map(e => e.unidad)).size, 5,
        'cinco unidades incluyendo Gerencia');

/* ==========================================================================
   RELACIONES QUE SE DICEN EN VOZ ALTA
   ========================================================================== */
console.log('\nRELACIONES');

esIgual(FORMATO.pct(DATOS.PRUEBA_VERANITO.crecimiento), '57%', 'crecimiento de Veranito');
ok(DATOS.PRUEBA_VERANITO.relacion, 11, 'relacion de retorno de Veranito (11 a 1)', 0.3);
ok(DATOS.VALOR_VIDA.kinder.relacion, 28, 'valor de vida contra adquisicion en Kinder (28 a 1)', 0.2);
ok(DATOS.VALOR_VIDA.veranito.relacion, 19, 'venta contra adquisicion en Veranito', 0.1);

esIgual(typeof DATOS.INVERSION === 'number' && DATOS.INVERSION > 0, true,
        'la inversion sale de una constante configurable');

/* ========================================================================== */
console.log(`\n${'-'.repeat(78)}`);
console.log(`${pasadas} pasadas, ${fallidas} fallidas`);
if (fallidas) {
  console.log('\nFallos:');
  for (const f of fallos) console.log(`  · ${f.titulo}: dio ${f.real}, se esperaba ${f.esperado}`);
  process.exit(1);
}
