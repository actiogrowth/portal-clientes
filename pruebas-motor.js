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

// La brecha entre lo real y lo calculado: tarifas viejas sin migrar.
ok(kHoy.facturacion - MOTOR.REAL.kinder.facturacion, 1692, 'brecha tarifas sin migrar', 0.5);

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
ok(as100.costo, 7014.60, 'al 100%: costo (sin Baby & Me entre semana)', 0.01);
ok(as100.margen, 25672.44, 'al 100%: margen', 0.01);

const as60 = MOTOR.afterSchool({ ocupacion: 0.6 });
esIgual(as60.alumnos, 128, 'al 60%: alumnos (redondeo por disciplina)');
ok(as60.costo, 7014.60, 'al 60%: costo', 0.01);

/* La regla que confirmo el equipo: al llenar los cupos que ya existen el
   costo no se mueve, porque las clases ya se dictan. Es lo que sostiene el
   hallazgo de la seccion 2 y lo que separa a After School de Kinder. */
ok(as100.costo - as60.costo, 0, 'de 128 a 212 alumnos el costo no cambia', 0);
ok(MOTOR.afterSchool({ ocupacion: 0.35 }).costo, 7014.60, 'ni siquiera al 35%', 0.01);

/* ==========================================================================
   BABY AND ME
   Unidad propia desde la spec v2. Cero alumnos hoy: la tarjeta tiene que
   decirlo sin disfrazarlo, y su potencial es el argumento.
   ========================================================================== */
console.log('\nBABY AND ME');

esIgual(MOTOR.BABY_CUPOS, 8, 'ocho cupos');
esIgual(MOTOR.BABY_ALUMNOS_HOY, 0, 'cero alumnos hoy');

const b100 = MOTOR.baby({ ocupacion: 1 });
ok(b100.facturacion, 776, 'al 100%: facturacion mensual', 0);
ok(b100.facturacion * 12, 9312, 'al 100%: potencial anual', 0);
ok(b100.costo, 433, 'al 100%: costo mensual (1 profesor, 4 h/sem)', 0.01);
ok(b100.costo * 12, 5196, 'al 100%: costo anual', 0.5);
esIgual(b100.alumnos, 8, 'al 100%: alumnos');

/* Sin alumnos no se dicta, y lo que no se dicta no cuesta: la misma regla
   que saca al sabado del costo de hoy. */
const b0 = MOTOR.baby({ ocupacion: 0 });
ok(b0.facturacion, 0, 'sin alumnos: no factura', 0);
ok(b0.costo, 0, 'sin alumnos: no cuesta', 0);
ok(b0.margen, 0, 'sin alumnos: margen cero', 0);

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

ok(p60.ingresos, 800309, 'al 60%: ingresos', 50);
ok(p60.margenBrutoPct * 100, 63.0, 'al 60%: margen bruto %', 0.15);
ok(p60.ebitda, 204219, 'al 60%: EBITDA', 50);
ok(p60.ebitdaPct * 100, 25.5, 'al 60%: EBITDA %', 0.15);

ok(p80.ingresos, 1065148, 'al 80%: ingresos', 50);
ok(p80.margenBrutoPct * 100, 64.6, 'al 80%: margen bruto %', 0.15);
ok(p80.ebitda, 387974, 'al 80%: EBITDA', 50);

ok(p100.ingresos, 1325750, 'al 100%: ingresos', 50);
ok(p100.margenBrutoPct * 100, 68.0, 'al 100%: margen bruto %', 0.15);
ok(p100.ebitda, 601959, 'al 100%: EBITDA', 50);

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
ok(p100.ingresos - p60.ingresos, 525441, 'la ocupacion mueve los ingresos', 100);
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
   ENTREGABLES
   El conteo por fase es una afirmacion de la presentacion: si alguien
   agrega o mueve uno en la hoja y lo transcribe mal aqui, el titulo de la
   fase deja de coincidir con lo que se despliega debajo.
   ========================================================================== */
console.log('\nENTREGABLES');

esIgual(DATOS.ENTREGABLES.length, 35, 'total de entregables');
const porFase = n => DATOS.ENTREGABLES.filter(e => e.fase === n).length;
esIgual(porFase(1), 6,  'Fase 1');
esIgual(porFase(2), 11, 'Fase 2');
esIgual(porFase(3), 6,  'Fase 3');
esIgual(porFase(4), 9,  'Fase 4');
esIgual(porFase(0), 3,  'Durante todo el proyecto');

esIgual(DATOS.ENTREGABLES.some(e => e.nombre === 'Plataforma de cursos para profesoras'
        && e.unidad === 'Kinder' && e.segmento === 'Servicio' && e.fase === 4),
        true, 'el entregable 35 esta, en Kinder y fase 4');

esIgual(DATOS.ENTREGABLES.every(e => e.unidad && e.segmento && e.nota),
        true, 'todos traen unidad, segmento y descripcion');
esIgual(new Set(DATOS.ENTREGABLES.map(e => e.unidad)).size, 5,
        'cinco unidades incluyendo Gerencia');

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

ok(DATOS.INVERSION.total, 66000, 'monto del proyecto', 0);
ok(DATOS.INVERSION.pctPrimero * 100, 20, 'porcentaje del pago inicial', 0);
ok(DATOS.INVERSION.cuotas, 11, 'numero de cuotas', 0);

const inv = MOTOR.plan({ total:DATOS.INVERSION.total, pctPrimero:DATOS.INVERSION.pctPrimero,
                         meses:DATOS.INVERSION.cuotas, pctFinal:0 });
ok(inv.primero, 13200, 'pago inicial del 20%', 0);
ok(inv.mensualidad, 4800, 'once cuotas de 4.800', 0);
esIgual(inv.ultimaDifiere, false, 'las once cuotas son iguales');
ok(inv.final, 0, 'sin pago final', 0);
esIgual(inv.suma === 66000, true, 'el desglose suma el total');
esIgual(inv.valido, true, 'el plan es valido');

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
