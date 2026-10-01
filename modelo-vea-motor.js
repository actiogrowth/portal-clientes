/* ==========================================================================
   MODELO DE PROYECCION DE VIDA EN ARTE · MOTOR Y FORMATO

   Lo cargan presentacion-vea-efb4db06.html y proyeccion-vea-*.html, y lo
   prueba pruebas-motor.js leyendo este mismo archivo: lo que se prueba es
   exactamente lo que corre delante del cliente, en los dos.

   Tres piezas, en este orden:
     MOTOR       las cinco unidades, el resumen de 2027 y sus partidas
     FORMATO     como se escriben las cifras
     VALOR_VIDA  las relaciones de valor de vida que pinta la tarjeta de
                 Kinder

   El cronograma de pagos de la inversion no esta aqui: es de la
   presentacion y vive en su bloque <script id="plan">.
   ========================================================================== */

/* ==========================================================================
   MOTOR DE CALCULO
   Funciones puras. No tocan el DOM y no leen estado global: reciben
   parametros y devuelven cifras. Asi pruebas-motor.js las ejecuta en node
   contra los casos de la spec sin abrir el navegador.

   Cada constante de aqui es un dato del negocio, no una decision de diseño.
   Si el cliente corrige una tarifa en la reunion, se cambia en este bloque
   y se vuelve a correr `node pruebas-motor.js`.
   ========================================================================== */
const MOTOR = (function(){

  /* Semanas por mes. Aparece en todo calculo de costo por hora de clase
     y en la conversion de eventos semanales a mensuales. */
  const SEM_MES = 4.33;

  /* ------------------------------------------------------------------------
     CIFRAS REALES DE HOY
     No se calculan: son lo que el negocio facturo. El escenario Hoy las usa
     tal cual, porque la diferencia contra lo calculado es justamente parte
     del argumento (tarifas viejas sin migrar en Kinder).
     ---------------------------------------------------------------------- */
  const REAL = {
    kinder:      { facturacion:17062, ninos:29 },
    afterSchool: { facturacion:11286, alumnos:80 },
    // $18.494 facturados en siete meses. El promedio mensual es la cifra
    // que se muestra; los eventos de hoy se derivan de ella, no al reves.
    cumpleanos:  { facturacion:2642, facturadoTotal:18494, mesesMedidos:7 },
    veranito:    { mayAgo:85008, eneMar:37888, anual2026:122896, anual2025:54286,
                   inversionAcumulada:2726 },
  };

  /* ========================================================================
     KINDER
     ====================================================================== */
  /* El costo por grupo sale de sus partes y no es un numero suelto: si
     alguien lo revisa, la cuenta esta a la vista. Es el costo ya ajustado
     que contempla el proyecto, y por eso el margen bruto de 2027 cae contra
     2026, cuando el grupo costaba unos $1.680. */
  const KINDER_COSTO_PROFESOR = 1200;
  const KINDER_COSTO_ASISTENTE = 600;
  const PRESTACIONES = 0.50;
  const KINDER_COSTO_GRUPO = (KINDER_COSTO_PROFESOR + KINDER_COSTO_ASISTENTE) * (1 + PRESTACIONES);
  const KINDER_COSTO_GRUPO_2026 = 1680;   // sin el ajuste salarial

  const KINDER_PARTIDA = { ninos:30, precio45:587, precio8:786, pct45:0.70,
                           costoGrupo:KINDER_COSTO_GRUPO };
  const KINDER_NINOS_POR_GRUPO = 10;
  const KINDER_CAPACIDAD = 80;

  function kinder(p){
    const c = Object.assign({}, KINDER_PARTIDA, p || {});

    /* Reparto entero entre los dos planes. Un niño paga uno o el otro, asi
       que la facturacion sale de la suma de los dos y no de un ticket
       promedio: con el promedio la tabla desglosada de la tarjeta no
       sumaria su propio total, que es lo que el cliente comprueba. */
    const ninos45 = Math.round(c.ninos * c.pct45);
    const ninos8 = c.ninos - ninos45;
    const detalle = [
      { nombre:'Plan 4,5 horas', ninos:ninos45, precio:c.precio45, facturacion:ninos45 * c.precio45 },
      { nombre:'Plan 8 horas',   ninos:ninos8,  precio:c.precio8,  facturacion:ninos8 * c.precio8 },
    ];
    const facturacion = detalle.reduce((s, d) => s + d.facturacion, 0);

    /* El costo escala por escalon, no proporcionalmente: un niño mas puede
       abrir un grupo entero. Pasar de 30 a 31 suma un costoGrupo completo. */
    const grupos = Math.ceil(c.ninos / KINDER_NINOS_POR_GRUPO);
    const costo = grupos * c.costoGrupo;

    return {
      ninos: c.ninos, ninos45, ninos8, grupos, facturacion, costo, detalle,
      ticket: c.ninos ? facturacion / c.ninos : 0,
      margen: facturacion - costo,
      excedeCapacidad: c.ninos > KINDER_CAPACIDAD,
    };
  }

  /* ========================================================================
     AFTER SCHOOL

     Dos reglas gobiernan esta unidad y son las que sostienen el hallazgo de
     la seccion 4:

     1. El costo depende de las horas de clase dictadas, no de cuantos niños
        hay en el aula. Por eso entre 133 y 220 alumnos no sube ni un dolar.
     2. Una disciplina sin alumnos no se dicta, y lo que no se dicta no
        cuesta. Hoy eso saca a Baby & Me ($433) y al sabado completo
        ($1.749,32) del costo.

     `sesiones` es cuantas veces por semana corre la disciplina, y por eso
     define tambien la tarifa: dos veces por semana paga plan de dos veces,
     una vez por semana paga la tarifa de una vez. Los cupos vendibles de
     cada disciplina son cupos x sesiones; sumados al sabado dan los 220.
     ====================================================================== */
  const AS_PROFESOR = 25;    // costo por hora de un profesor
  const AS_ASISTENTE = 18;   // Telas necesita asistente ademas del profesor

  /* La unidad se modela por grupos y no por sesiones sueltas. Un grupo es una
     franja horaria fija: el alumno se inscribe en una y asiste a todas sus
     sesiones. Un grupo sin alumnos no se dicta y no cuesta.

     El modelo anterior repartia los alumnos entre todas las sesiones de la
     disciplina y pagaba profesor en cada una, de modo que un solo niño en
     ParKour 6-14 costaba 866 al mes: las cuatro franjas abiertas para el. Con
     grupos cuesta 216,50, que es una franja de dos sesiones. */
  const AS_DISCIPLINAS = [
    { nombre:'ParKour 6-14',   grupos:4, capGrupo:20, sesiones:2, precio:169.06, tipo:'parkour' },
    { nombre:'ParKour 15+',    grupos:2, capGrupo:20, sesiones:2, precio:169.06, tipo:'parkour' },
    { nombre:'Telas 6-14',     grupos:4, capGrupo:10, sesiones:2, precio:200,    tipo:'telas'   },
    { nombre:'Telas 15+',      grupos:2, capGrupo:10, sesiones:2, precio:200,    tipo:'telas'   },
    { nombre:'ParKids',        grupos:2, capGrupo:8,  sesiones:2, precio:169.06, tipo:'parkids' },
    { nombre:'ParKour 6-14 sábado', grupos:2, capGrupo:20, sesiones:1, precio:111.28, tipo:'parkour' },
    { nombre:'ParKour 15+ sábado',  grupos:1, capGrupo:20, sesiones:1, precio:111.28, tipo:'parkour' },
    { nombre:'Telas 6-14 sábado',   grupos:2, capGrupo:10, sesiones:1, precio:111.28, tipo:'telas'   },
    { nombre:'Telas 15+ sábado',    grupos:1, capGrupo:10, sesiones:1, precio:111.28, tipo:'telas'   },
    { nombre:'ParKids sábado',      grupos:3, capGrupo:8,  sesiones:1, precio:111.28, tipo:'parkids' },
  ];
  const asCupos = d => d.grupos * d.capGrupo;
  const AS_CUPOS_TOTALES = AS_DISCIPLINAS.reduce((s, d) => s + asCupos(d), 0);

  const AS_ALUMNOS_HOY = 80;
  const AS_OCUPACION_HOY = AS_ALUMNOS_HOY / AS_CUPOS_TOTALES;
  const AS_PARTIDA = {
    ocupacion: AS_OCUPACION_HOY,
    precios: AS_DISCIPLINAS.map(d => d.precio),
    profesor: AS_PROFESOR,
    asistente: AS_ASISTENTE,
  };

  /* Cuantos niños atiende un profesor, y cuanto cuesta la plantilla de un
     grupo por sesion. */
  const asPorProfesor = d => d.tipo === 'parkids' ? 8 : 10;
  const asTarifaGrupo = (d, c) => d.tipo === 'telas' ? (c.profesor + c.asistente) : c.profesor;

  /* Los alumnos llenan un grupo antes de abrir el siguiente. Es lo realista y
     lo mas barato: nadie dicta cuatro franjas vacias para un niño. */
  function asGrupos(d, alumnos){
    const dentro = [];
    let restante = Math.max(0, alumnos);
    for (let g = 0; g < d.grupos && restante > 0; g++){
      const enGrupo = Math.min(d.capGrupo, restante);
      dentro.push(enGrupo);
      restante -= enGrupo;
    }
    return dentro;
  }

  function asCostoDisciplina(d, alumnos, c){
    const tarifa = asTarifaGrupo(d, c);
    const porProf = asPorProfesor(d);
    const semanal = asGrupos(d, alumnos)
      .reduce((s, enGrupo) => s + d.sesiones * Math.ceil(enGrupo / porProf) * tarifa, 0);
    return semanal * SEM_MES;
  }

  /* Reparto entero por resto mayor: los enteros primero y las unidades que
     sobran a las disciplinas con mayor fraccion pendiente. Asi la suma es
     siempre round(cupos x ocupacion), que es lo que el cliente espera al leer
     el porcentaje. Redondeando cada disciplina por su lado los saltos se
     acumulan y los 80 alumnos de hoy saldrian 79. */
  function asReparto(ocupacion){
    const exactos = AS_DISCIPLINAS.map(d => asCupos(d) * ocupacion);
    const enteros = exactos.map(Math.floor);
    let faltan = Math.round(AS_CUPOS_TOTALES * ocupacion) - enteros.reduce((s,x) => s + x, 0);
    exactos.map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac)
      .forEach(({ i }) => { if (faltan > 0){ enteros[i]++; faltan--; } });
    return enteros;
  }

  function afterSchool(p){
    const c = Object.assign({}, AS_PARTIDA, p || {});
    const reparto = c.alumnos ? null : asReparto(c.ocupacion);
    let facturacion = 0, alumnos = 0, costo = 0;
    const detalle = [];

    AS_DISCIPLINAS.forEach((d, i) => {
      const cupos = asCupos(d);
      /* alumnos explicito gana sobre la ocupacion: la tabla permite editar
         cada disciplina por separado. Enteros en los dos casos: lo que se ve
         en el campo tiene que ser lo que usa el motor, o el 0,32 que no se
         muestra cruza el escalon del segundo profesor. */
      const al = c.alumnos ? Math.round(Math.max(0, c.alumnos[i] || 0)) : reparto[i];
      const precio = (c.precios && c.precios[i] != null) ? c.precios[i] : d.precio;
      const dentro = asGrupos(d, al);
      const ingreso = al * precio;
      const gasto = asCostoDisciplina(d, al, c);
      alumnos += al; facturacion += ingreso; costo += gasto;
      detalle.push({ nombre:d.nombre, cupos, alumnos:al, precio,
                     facturacion:ingreso, costo:gasto,
                     gruposAbiertos:dentro.length, grupos:d.grupos,
                     enGrupo:dentro, capGrupo:d.capGrupo, sesiones:d.sesiones, tipo:d.tipo });
    });

    return { alumnos, cupos:AS_CUPOS_TOTALES, facturacion, costo,
             margen: facturacion - costo, detalle };
  }

  /* ========================================================================
     BABY AND ME

     Unidad propia desde la spec v2, separada de After School por su
     potencial. Hoy no tiene un solo alumno, y la tarjeta lo dice: el
     argumento es el potencial, no un resultado que no existe.

     Dos franjas con precio distinto:

       Sabado        2 sesiones de 1 h, 8 niños cada una. Cada niño va una
                     vez por semana, asi que caben 16 y pagan plan de $97.
       Lunes a jueves 8 sesiones de 1 h —dos diarias durante cuatro dias—, 8
                     niños cada una. Cada niño va dos veces por semana, asi
                     que se venden 32 cupos y pagan plan de $165.

     Las dos horas del sabado son las mismas que estaban dentro del costo
     del sabado de After School. Se quitaron de alli al separar la unidad:
     las mismas horas no se pagan dos veces.
     ====================================================================== */
  /* Baby and Me se modela por grupos, igual que After School. Un grupo es una
     franja horaria fija y un profesor lo atiende entero, porque su capacidad
     —ocho niños— es el grupo que atiende una persona.

     El modelo anterior cobraba las diez sesiones semanales siempre, asi que un
     solo niño entre semana costaba 1.082,50 al mes. Con grupos cuesta 216,50:
     su grupo, que se reune dos veces por semana.

     Los cuatro grupos de entre semana son dos franjas horarias por dos parejas
     de dias; cada niño asiste dos veces por semana y el sabado una. */
  const BABY_FRANJAS = [
    { nombre:'Sábado',         grupos:2, capGrupo:8, sesiones:1, precio:97 },
    { nombre:'Lunes a jueves', grupos:4, capGrupo:8, sesiones:2, precio:165 },
  ];
  const babyCupos = f => f.grupos * f.capGrupo;
  const BABY_CUPOS = BABY_FRANJAS.reduce((s, f) => s + babyCupos(f), 0);
  const BABY_ALUMNOS_HOY = 0;
  const BABY_PARTIDA = { ocupacion:0, costoHora:AS_PROFESOR,
                         precios:BABY_FRANJAS.map(f => f.precio) };

  /* Un grupo sin alumnos no se dicta y no cuesta. Se llena uno antes de abrir
     el siguiente, que es lo realista y lo mas barato. */
  function babyGrupos(f, alumnos){
    const dentro = [];
    let restante = Math.max(0, alumnos);
    for (let g = 0; g < f.grupos && restante > 0; g++){
      const enGrupo = Math.min(f.capGrupo, restante);
      dentro.push(enGrupo);
      restante -= enGrupo;
    }
    return dentro;
  }

  function babyCostoFranja(f, alumnos, costoHora){
    return babyGrupos(f, alumnos).length * f.sesiones * costoHora * SEM_MES;
  }

  function baby(p){
    const c = Object.assign({}, BABY_PARTIDA, p || {});
    const detalle = [];
    let alumnos = 0, facturacion = 0, costo = 0;

    BABY_FRANJAS.forEach((f, i) => {
      const cupos = babyCupos(f);
      /* Enteros: lo que muestra el campo es lo que usa la cuenta. */
      const al = Math.round(c.alumnos ? Math.max(0, c.alumnos[i] || 0)
                                      : cupos * c.ocupacion);
      const precio = (c.precios && c.precios[i] != null) ? c.precios[i] : f.precio;
      const dentro = babyGrupos(f, al);
      const ing = al * precio;
      const gasto = babyCostoFranja(f, al, c.costoHora);
      alumnos += al; facturacion += ing; costo += gasto;
      detalle.push({ nombre:f.nombre, cupos, alumnos:al, precio, facturacion:ing, costo:gasto,
                     gruposAbiertos:dentro.length, grupos:f.grupos,
                     capGrupo:f.capGrupo, sesiones:f.sesiones });
    });

    return { alumnos, cupos:BABY_CUPOS, facturacion, costo, detalle,
             margen: facturacion - costo };
  }

  /* ========================================================================
     CUMPLEAÑOS
     ====================================================================== */
  const CUMPLE_PARTIDA = { eventosSemana:1.4, precio:450, costoEvento:172 };
  const CUMPLE_TOPE_SEMANA = 4;  // viernes y sabado desde las 14:00, domingo dos turnos

  function cumpleanos(p){
    const c = Object.assign({}, CUMPLE_PARTIDA, p || {});
    /* Enteros: nadie hace 10,4 fiestas, y asi el cliente verifica la cuenta
       de cabeza mientras Ricardo habla. */
    const eventos = Math.round(c.eventosSemana * SEM_MES);
    const facturacion = eventos * c.precio;
    const costo = eventos * c.costoEvento;
    const detalle = [{ nombre:'Eventos del mes', cantidad:eventos,
                       porSemana:c.eventosSemana, precio:c.precio,
                       facturacion, costo }];
    return { eventos, facturacion, costo, detalle, margen: facturacion - costo };
  }

  /* ========================================================================
     VERANITO

     Los precios de lista son $185 y $220, pero el ticket que entra de verdad
     es $182,42: hay cupones (16,4% de las ventas), plan Tardes mas barato y
     descuentos. Todo se calcula sobre el ticket real. Los controles de
     precio mueven el de lista y el efectivo se ajusta en la misma
     proporcion, para que el control no quede decorativo.
     ====================================================================== */
  const VERANITO_PARTIDA = {
    semanas:10, cuposSemana:50, precio45:185, precio8:220, pct45:0.75,
    mayAgo:{ ocupacion:0.84 }, eneMar:{ ocupacion:0.38 },
  };
  const VERANITO_COSTO_OPERATIVO = 0.20;  // del ingreso
  const TICKET_LISTA = VERANITO_PARTIDA.pct45 * VERANITO_PARTIDA.precio45
                     + (1 - VERANITO_PARTIDA.pct45) * VERANITO_PARTIDA.precio8;
  const TICKET_VERANITO = 182.42;
  const FACTOR_REALIZACION = TICKET_VERANITO / TICKET_LISTA;

  function veranito(p){
    const c = Object.assign({}, VERANITO_PARTIDA, { ocupacion:0.84 }, p || {});
    const lista = c.pct45 * c.precio45 + (1 - c.pct45) * c.precio8;
    const ticket = lista * FACTOR_REALIZACION;
    const cuposTemporada = c.semanas * c.cuposSemana;
    const cupos = Math.round(cuposTemporada * c.ocupacion);
    const facturacion = cupos * ticket;
    const costo = facturacion * VERANITO_COSTO_OPERATIVO;
    return { cupos, cuposTemporada, ticket, facturacion, costo, margen: facturacion - costo };
  }

  /* Las dos temporadas juntas, en las dos unidades de tiempo que hacen
     falta: el año, que es como funciona Veranito de verdad, y el mes
     prorrateado, que es lo que la deja comparable con las otras cuatro
     unidades, todas mensuales.

     La cadena queda explicita —temporadas suman el año, el año entre doce
     da el mes— porque en la tarjeta se ven las tres cosas a la vez y
     tienen que cuadrar entre si. */
  function veranitoAnual(p){
    const base = p || {};
    const comun = Object.assign({}, VERANITO_PARTIDA, base);
    const mayAgo = veranito(Object.assign({}, comun, base.mayAgo || VERANITO_PARTIDA.mayAgo));
    const eneMar = veranito(Object.assign({}, comun, base.eneMar || VERANITO_PARTIDA.eneMar));

    const anual = {
      facturacion: mayAgo.facturacion + eneMar.facturacion,
      costo: mayAgo.costo + eneMar.costo,
      margen: mayAgo.margen + eneMar.margen,
      cupos: mayAgo.cupos + eneMar.cupos,
      cuposTemporada: mayAgo.cuposTemporada + eneMar.cuposTemporada,
    };
    const mes = {
      facturacion: anual.facturacion / 12,
      costo: anual.costo / 12,
      margen: anual.margen / 12,
    };
    return { mayAgo, eneMar, anual, mes, ticket: mayAgo.ticket };
  }

  /* ========================================================================
     CONSOLIDADO

     Veranito queda fuera del consolidado mensual a proposito: es estacional
     y mezclarlo con unidades que facturan todos los meses daria un promedio
     que no describe ningun mes real. Se presenta aparte.
     ====================================================================== */
  function consolidar(partes){
    const facturacion = partes.reduce((s,x) => s + x.facturacion, 0);
    const costo = partes.reduce((s,x) => s + x.costo, 0);
    return { facturacion, costo, margen: facturacion - costo };
  }

  function escenario(ocupacion){
    const k = kinder({ ninos: Math.round(KINDER_CAPACIDAD * ocupacion) });
    const a = afterSchool({ ocupacion });
    const c = cumpleanos({ eventosSemana: CUMPLE_TOPE_SEMANA * ocupacion });
    const b = baby({ ocupacion });
    return Object.assign(consolidar([k,a,c,b]), { kinder:k, afterSchool:a, cumpleanos:c, baby:b });
  }

  /* ========================================================================
     CUADRO RESUMEN

     Las dos primeras columnas son datos cerrados: no se calculan, se
     declaran. 2025 es el año completo. La segunda ya no es un 2026 estimado
     sino los siete meses reales de enero a julio, sin anualizar, con los
     gastos operativos a $25.000 por cada uno de esos siete meses.

     Se declaran ingresos, mano de obra y gastos; el margen bruto, el EBITDA
     y sus porcentajes salen de ahi, que es lo que impide que la cabecera y
     el pie digan cosas distintas.

     2027 si se calcula, con las mismas reglas de las unidades, y es lo
     unico que mueven los dos controles.
     ====================================================================== */
  const ANIOS = {
    2025: { ingresos:477150, manoDeObra:120044, gastos:295066 },
    2026: { ingresos:324194, manoDeObra:65765, gastos:25000 * 7 },
  };
  /* Orden: Kinder, After School, Veranito, Cumpleaños, Baby and Me, otros.

     Ojo con los de 2026: son la estimacion anualizada del año completo, que
     es de donde salio OTROS_INGRESOS. Ya no es lo que muestra la columna del
     cuadro, que ahora son siete meses reales. Se conservan porque siguen
     siendo la referencia del año y la suite comprueba que cuadran entre si. */
  const UNIDADES_2025 = [207548, 143891, 92174, 18017, 2365, 13156];
  const UNIDADES_2026 = [232032, 133675, 121421, 31706, 1752, 10874];
  const VERANITO_2026 = { eneMar:36413, mayAgo:85008 };

  /* Renglon fijo anual, al nivel del año 2026 completo. No escala con la
     ocupacion porque no depende de cuantos cupos se llenen. */
  const OTROS_INGRESOS = 10900;
  const GASTOS_MES_PARTIDA = 25000;
  const OCUPACION_2027_PARTIDA = 0.60;
  /* Suelo y paso del deslizador de 2027. Van juntos y son los dos los que
     sostienen una garantia de la reunion: el EBITDA nunca puede bajar
     mientras el cliente sube la ocupacion.

     El paso resuelve lo menos evidente. Un grupo de Kinder cuesta $32.400
     al año y un punto de ocupacion solo aporta unos $13.200, asi que con
     paso de un punto el EBITDA retrocede cada vez que Kinder cruza un
     escalon de diez niños. Con cinco puntos cada movimiento aporta unos
     $66.000 y absorbe el grupo entero.

     El suelo baja de 45% a 5% porque el deslizador ya no tiene un valor
     propio: enseña el mismo dato que la seccion 2, que arranca en la
     ocupacion real de cada unidad y llega hasta el 0% de Baby and Me. Con
     el suelo en 45% el deslizador habria dicho 45% mientras el valor
     compartido decia otra cosa.

     No baja hasta 0 porque ahi si retrocede, y por un motivo distinto al
     de Kinder: entre 0% y 5% se enciende de golpe toda la base de costos
     —los $6.798 al mes de After School van completos con el primer alumno—
     y son $131.074 al año de costo contra $82.489 de ingreso. Del 5% al
     100% el recorrido es estrictamente creciente.

     Lo que el suelo ya no hace es sacar la zona de perdida: el EBITDA es
     negativo por debajo del 40%. Es el precio de que las dos secciones
     hablen del mismo dato. La suite lo comprueba todo. */
  const OCUPACION_2027_MINIMA = 0.05;
  const OCUPACION_2027_PASO = 5;

  function conPorcentajes(x){
    x.margenBruto = x.ingresos - x.manoDeObra;
    x.margenBrutoPct = x.ingresos ? x.margenBruto / x.ingresos : 0;
    x.ebitda = x.margenBruto - x.gastos;
    x.ebitdaPct = x.ingresos ? x.ebitda / x.ingresos : 0;
    return x;
  }

  function resumen(anio){
    return conPorcentajes(Object.assign({ anio }, ANIOS[anio]));
  }

  /* Una ocupacion por unidad. El deslizador unico se conserva como atajo
     —ocupacion aplica a las cinco— porque es lo que usa el resto del motor,
     pero la seccion 3 mueve cada unidad por su lado. */
  function ocupacionesDe(p){
    const base = (p && p.ocupacion !== undefined) ? p.ocupacion : OCUPACION_2027_PARTIDA;
    const o = Object.assign(
      { kinder:base, afterSchool:base, veranito:base, cumpleanos:base, baby:base },
      (p && p.ocupaciones) || {});
    return o;
  }

  /* 2027 se arma con el estado completo de cada unidad, no solo con su
     ocupacion. La regla que sostiene el cuadro: lo que muestra la tarjeta de
     una unidad y lo que esa unidad aporta aqui salen del mismo calculo con el
     mismo estado. Antes solo viajaba la ocupacion, de modo que cambiar un
     precio o un costo movia la tarjeta y dejaba el cuadro donde estaba.

     Sin 'unidades' se cae al escenario declarado —los valores de partida a la
     ocupacion que se pida—, que es lo que usan la frase del 60% y la suite. */
  function resumen2027(p){
    const o = ocupacionesDe(p);
    const gastosMes = p && p.gastosMes !== undefined ? p.gastosMes : GASTOS_MES_PARTIDA;
    const u = (p && p.unidades) || null;

    const k = kinder(u ? u.kinder : { ninos: Math.round(KINDER_CAPACIDAD * o.kinder) });
    const a = afterSchool(u ? u.afterSchool : { ocupacion: o.afterSchool });
    const c = cumpleanos(u ? u.cumpleanos : { eventosSemana: CUMPLE_TOPE_SEMANA * o.cumpleanos });
    const b = baby(u ? u.baby : { ocupacion: o.baby });
    const mes = Object.assign(consolidar([k,a,c,b]), { kinder:k, afterSchool:a, cumpleanos:c, baby:b });

    /* Veranito entra por veranitoAnual en los dos casos. Antes se sumaban dos
       llamadas sueltas a la misma ocupacion, y esa era la via por la que
       "cupos por semana" empujaba el cuadro por el redondeo de alumnos sobre
       cupos sin propagar su efecto real. */
    const v = veranitoAnual(u ? u.veranito
                              : Object.assign({}, VERANITO_PARTIDA,
                                  { mayAgo:{ ocupacion:o.veranito }, eneMar:{ ocupacion:o.veranito } }));

    const ingresos = mes.facturacion * 12 + v.anual.facturacion + OTROS_INGRESOS;
    const manoDeObra = mes.costo * 12 + v.anual.costo;

    return conPorcentajes({
      anio: 2027, ingresos, manoDeObra, gastos: gastosMes * 12,
      otrosIngresos: OTROS_INGRESOS, ocupaciones: o, gastosMes,
      unidades: {
        kinder: mes.kinder, afterSchool: mes.afterSchool,
        cumpleanos: mes.cumpleanos, baby: mes.baby,
        veranito: { mayAgo:v.mayAgo, eneMar:v.eneMar, anual:v.anual },
      },
    });
  }


  /* Copia nueva en cada llamada. Si devolviera las constantes, el boton de
     reinicio no restauraria nada: los controles ya las habrian mutado. */
  function partida(){
    return JSON.parse(JSON.stringify({
      kinder: KINDER_PARTIDA,
      afterSchool: AS_PARTIDA,
      cumpleanos: CUMPLE_PARTIDA,
      baby: BABY_PARTIDA,
      veranito: VERANITO_PARTIDA,
    }));
  }

  return {
    SEM_MES, REAL,
    KINDER_CAPACIDAD, KINDER_NINOS_POR_GRUPO,
    KINDER_COSTO_PROFESOR, KINDER_COSTO_ASISTENTE, PRESTACIONES,
    KINDER_COSTO_GRUPO, KINDER_COSTO_GRUPO_2026,
    AS_DISCIPLINAS, AS_CUPOS_TOTALES, AS_OCUPACION_HOY, AS_ALUMNOS_HOY,
    AS_PROFESOR, AS_ASISTENTE, asCupos, asGrupos, asCostoDisciplina, asPorProfesor, asReparto,
    CUMPLE_TOPE_SEMANA,
    TICKET_LISTA, TICKET_VERANITO, FACTOR_REALIZACION, VERANITO_COSTO_OPERATIVO,
    BABY_CUPOS, BABY_ALUMNOS_HOY, BABY_FRANJAS, babyCupos, babyGrupos, babyCostoFranja,
    ANIOS, UNIDADES_2025, UNIDADES_2026, VERANITO_2026,
    OTROS_INGRESOS, GASTOS_MES_PARTIDA,
    OCUPACION_2027_PARTIDA, OCUPACION_2027_MINIMA, OCUPACION_2027_PASO,
    kinder, afterSchool, baby, cumpleanos, veranito,
    consolidar, escenario, resumen, resumen2027, partida, veranitoAnual,
  };
})();

/* ==========================================================================
   FORMATO
   La spec fija como se ven las cifras, no solo cuanto valen. Vive en su
   propio bloque porque pruebas-motor.js tambien lo extrae y lo prueba:
   un delta sin el signo + o un evento con decimales son errores tan
   visibles en la reunion como un margen mal calculado.
   ========================================================================== */
const FORMATO = (function(){

  function miles(n){
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* Al peso. Nadie lee centavos proyectados a tres metros. */
  function dinero(n){
    return (n < 0 ? '-' : '') + '$' + miles(Math.round(Math.abs(n)));
  }

  /* Conteos que pueden salir con decimales: el 55% de 30 cupos son 16,5
     alumnos. Se muestra el valor real y no un entero, o la fila diria una
     cantidad y facturaria otra. */
  function cantidad(n){
    const r = Math.round(n * 10) / 10;
    return String(Number.isInteger(r) ? r : r.toFixed(1)).replace('.', ',');
  }

  /* Signo explicito: a tres metros el color solo no distingue un delta
     positivo de uno negativo. */
  function delta(n){
    const r = Math.round(n);
    if (r === 0) return '$0';
    return (r > 0 ? '+' : '-') + '$' + miles(Math.abs(r));
  }

  /* Los precios si conservan centavos cuando los tienen: $169,06 es una
     tarifa real y redondearla haria que el cliente no reconozca la suya.
     Pero $200 no se escribe $200,00. */
  function precio(n){
    const centavos = Math.round(Math.abs(n) * 100) % 100;
    const s = (n < 0 ? '-' : '') + '$' + miles(Math.floor(Math.abs(n)));
    return centavos ? s + ',' + String(centavos).padStart(2, '0') : s;
  }

  function pct(x){ return Math.round(x * 100) + '%'; }

  /* Un decimal, con la coma local. El cuadro resumen lo necesita porque su
     tabla esta escrita a un decimal (74,8% · 13,0%) y redondeada a entero
     dejaria de coincidir con lo que el equipo ya reviso. */
  function pctDecimal(x){
    return (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + '%';
  }
  function entero(n){ return String(Math.round(n)); }

  /* Suma lo que se VE, no lo que vale. Cada parte se redondea antes de
     sumarse, de modo que el total del consolidado coincide con la columna
     que el cliente puede sumar de cabeza. Sumar exacto y redondear al
     final da un peso de diferencia y ese peso se nota. */
  function sumaVisible(partes){
    return partes.reduce((s, x) => s + Math.round(x), 0);
  }

  /* El anual se deriva del mensual ya redondeado por la misma razon: el
     cliente multiplica por 12 la cifra que tiene delante. */
  function deltaAnual(mensual){
    return delta(Math.round(mensual) * 12);
  }

  /* Nivel de ocupacion. Se usa para el color y para el glifo, de modo que
     el estado sobreviva a un proyector que lava los colores. */
  function nivel(x){
    if (x >= 0.70) return 'alto';
    if (x >= 0.40) return 'medio';
    return 'bajo';
  }
  const GLIFO = { alto:'●', medio:'◐', bajo:'○' };

  return { miles, dinero, delta, precio, pct, pctDecimal, entero, cantidad, sumaVisible, deltaAnual, nivel, GLIFO };
})();

/* --------------------------------------------------------------------------
   Las relaciones que Ricardo dice en voz alta. Se calculan, no se escriben:
   si alguien corrige una cifra, la relacion se corrige sola en vez de quedar
   contradiciendola.
   -------------------------------------------------------------------------- */
const VALOR_VIDA = { kinder:{ valor:14088, adquisicion:500 },
                     veranito:{ ventaPorCliente:347.56, adquisicion:18.30 } };
VALOR_VIDA.kinder.relacion   = VALOR_VIDA.kinder.valor / VALOR_VIDA.kinder.adquisicion;
VALOR_VIDA.veranito.relacion = VALOR_VIDA.veranito.ventaPorCliente / VALOR_VIDA.veranito.adquisicion;
