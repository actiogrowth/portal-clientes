/* ==========================================================================
   MODELO DE PROYECCION DE VIDA EN ARTE · PINTADO DE LAS DOS SECCIONES

   Monta "Detalle por unidad" y "Cuadro resumen" en el contenedor que le
   pase cada archivo: montarUnidades() primero y montarResumen() despues,
   porque el cuadro arranca en la ocupacion que publican las tarjetas.

   Necesita cargado antes modelo-vea-motor.js. La navegacion entre
   pestañas no esta aqui: cada archivo tiene la suya.
   ========================================================================== */
const F = FORMATO;
const REINICIOS = [];

/* ==========================================================================
   PIEZAS COMPARTIDAS
   ========================================================================== */
const NOTA_COSTO =
  'El costo cubre mano de obra directa únicamente. No incluye arriendo, ' +
  'servicios, administración ni inversión publicitaria, así que el margen ' +
  'no es utilidad neta.';

const NOTA_COSTO_VERANITO =
  'Costo operativo del 20% del ingreso, mano de obra directa únicamente. ' +
  'Veranito es estacional: sus cifras son por temporada y por año, no por mes.';

function nodo(tag, clase, texto){
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/* Un control devuelve su nodo y como restaurarlo. Los deslizadores llevan
   el valor escrito al lado de la etiqueta; los campos numericos ya lo
   muestran dentro. */
function control(cfg){
  const wrap = nodo('div', 'control' + (cfg.ancho ? ' ancho' : ''));
  const lab = nodo('label');
  lab.appendChild(nodo('span', null, cfg.etiqueta));
  const val = nodo('span', 'valor');
  lab.appendChild(val);

  const inp = document.createElement('input');
  inp.type = cfg.tipo;
  inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.paso;
  inp.value = cfg.valor;

  function refrescarEtiqueta(){
    val.textContent = cfg.tipo === 'range' ? cfg.formato(Number(inp.value)) : '';
  }
  refrescarEtiqueta();

  inp.addEventListener('input', () => {
    const v = Number(inp.value);
    if (!Number.isFinite(v)) return;   // campo vaciado a media escritura
    /* La etiqueta se refresca antes de avisar: asi quien escuche puede
       corregirla despues con el valor real. Al reves, el repintado que
       dispara alCambiar quedaba pisado por el valor del propio control. */
    refrescarEtiqueta();
    cfg.alCambiar(v);
  });

  wrap.append(lab, inp);
  return { wrap, inp,
    /* Con 'exacto' se separan las dos cosas: el punto cae donde la rejilla lo
       permite y la etiqueta dice el valor de verdad. Es lo que deja mostrar
       el 0% de Baby and Me en un deslizador cuyo minimo es 5. */
    restaurar(v, exacto){
      inp.value = v;
      if (exacto === undefined) refrescarEtiqueta();
      else val.textContent = cfg.formato(exacto);
    } };
}

function pastilla(texto, fraccion){
  const nivel = F.nivel(fraccion);
  const p = nodo('span', 'pastilla');
  p.dataset.nivel = nivel;
  p.appendChild(nodo('span', 'glifo', F.GLIFO[nivel]));
  p.appendChild(nodo('span', null, texto));
  return p;
}

function ponPastilla(t, texto, fraccion){
  if (t.pastillaNodo) t.pastillaNodo.remove();
  t.pastillaNodo = pastilla(texto, fraccion);
  t.cab.appendChild(t.pastillaNodo);
}

/* Se construye una sola vez: repintar solo cambia texto, asi el foco no
   salta del control que Ricardo esta moviendo. */
function tarjeta(titulo){
  const art = nodo('article', 'unidad');
  const cab = nodo('div', 'unidad-cab');
  cab.appendChild(nodo('h3', null, titulo));
  art.appendChild(cab);

  const apoyo = nodo('div', 'cifra-apoyo');
  art.appendChild(apoyo);

  const cifras = nodo('div', 'cifras');
  const refs = {};
  for (const [clave, etiqueta] of [['facturacion','Facturación'],['costo','Costo'],['margen','Margen']]){
    const bloque = nodo('div', 'cifra-bloque' + (clave === 'margen' ? ' destacada' : ''));
    bloque.appendChild(nodo('span', 'etiqueta', etiqueta));
    refs[clave] = nodo('b', null, '');
    bloque.appendChild(refs[clave]);
    cifras.appendChild(bloque);
  }
  art.appendChild(cifras);

  const aviso = nodo('div', 'aviso');
  aviso.style.display = 'none';
  art.appendChild(aviso);

  /* Ranura para lo que pertenece a una unidad concreta: el resultado de
     Veranito, el valor de vida de Kinder, el potencial de Baby and Me. */
  const extra = nodo('div', 'unidad-extra');
  art.appendChild(extra);

  const controles = nodo('div', 'controles');
  art.appendChild(controles);

  const nota = nodo('p', 'nota-costo', NOTA_COSTO);
  art.appendChild(nota);

  return { art, cab, apoyo, refs, aviso, extra, controles, nota };
}

function ponCifras(refs, r){
  refs.facturacion.textContent = F.dinero(r.facturacion);
  refs.costo.textContent = F.dinero(r.costo);
  refs.margen.textContent = F.dinero(r.margen);
}

function bloqueDestacado(html){
  const d = nodo('div', 'bloque-unidad');
  d.innerHTML = html;
  return d;
}

function barraReinicio(contenedor, texto){
  const barra = nodo('div', 'barra-acciones');
  const btn = nodo('button', null, texto || 'Reiniciar');
  btn.addEventListener('click', () => REINICIOS.forEach(r => r()));
  barra.appendChild(btn);
  contenedor.appendChild(barra);
}

/* ==========================================================================
   DETALLE POR UNIDAD

   Una tarjeta de ancho completo por unidad, apiladas. Cada una lleva su
   tabla desglosada a la izquierda y las cifras y los controles a la
   derecha, de modo que el cliente ve de donde sale cada dolar mientras
   Ricardo mueve el deslizador.

   Todas arrancan en la ocupacion real de hoy: al eliminarse "Donde estan
   hoy", es esta seccion la que carga el punto de partida.
   ========================================================================== */
/* Una celda es texto o un campo editable. Se crean una sola vez; despues
   solo se actualizan valores, y el campo que tiene el foco no se toca para
   no interrumpir a quien esta escribiendo. */
function crearFila(tbody, cruda){
  const celdas = Array.isArray(cruda) ? cruda : cruda.celdas;
  const tr = document.createElement('tr');
  if (!Array.isArray(cruda) && cruda.clase) tr.className = cruda.clase;
  const refs = celdas.map((celda, i) => {
    const td = document.createElement(i === 0 ? 'th' : 'td');
    if (i === 0) td.scope = 'row'; else td.className = 'num';
    const ref = { td, input:null, alCambiar:null };
    if (celda && typeof celda === 'object' && celda.editable){
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'celda-editable';
      inp.inputMode = 'numeric';
      inp.addEventListener('input', () => {
        const v = Number(inp.value);
        /* Un campo a medio escribir no dispara nada: si se recalculara con
           el valor parcial, el repintado devolveria el numero corregido y
           se comeria el resto de las teclas. */
        if (inp.value !== '' && Number.isFinite(v) && ref.alCambiar) ref.alCambiar(v);
      });
      /* Al salir del campo se normaliza lo que quedo a medias. */
      inp.addEventListener('blur', () => {
        if (inp.value === '' && ref.alCambiar) ref.alCambiar(0);
      });
      td.appendChild(inp);
      ref.input = inp;
    }
    tr.appendChild(td);
    return ref;
  });
  tbody.appendChild(tr);
  return { tr, refs };
}

function actualizarFila(dom, cruda){
  const celdas = Array.isArray(cruda) ? cruda : cruda.celdas;
  celdas.forEach((celda, i) => {
    const ref = dom.refs[i];
    if (celda && typeof celda === 'object' && celda.editable){
      if (!ref.input) return;
      ref.alCambiar = celda.alCambiar;   // se reengancha al estado nuevo
      ref.input.min = celda.min != null ? celda.min : 0;
      if (celda.max != null) ref.input.max = celda.max;
      ref.input.step = celda.paso != null ? celda.paso : 1;
      if (document.activeElement !== ref.input) ref.input.value = celda.valor;
    } else if (!ref.input){
      ref.td.textContent = celda;
    }
  });
}

/* ==========================================================================
   OCUPACION COMPARTIDA

   "Detalle por unidad" y "Cuadro resumen" mueven el mismo dato: cuantos de
   los cupos de cada unidad estan llenos. Antes cada seccion guardaba el suyo,
   asi que se podia dejar Kinder al 40% en una pestaña y al 60% en la otra sin
   que nada lo indicara, y los totales dejaban de hablar del mismo escenario.

   Ahora el valor vive aqui una sola vez y cada seccion se suscribe. Manda el
   ultimo cambio, sea cual sea la pestaña donde se hizo.
   ========================================================================== */
const OCUPACION = (() => {
  const valores = {};
  const oyentes = [];
  return {
    lee: (clave, siFalta) => valores[clave] !== undefined ? valores[clave] : siFalta,
    /* Se publica en bloque y se avisa una sola vez: la seccion 2 recalcula las
       cinco unidades en cada repintado. Quien publica no se escucha a si mismo,
       que es lo que cerraria el ciclo. Se avisa que claves cambiaron para que
       nadie repare lo que nadie toco. */
    fija(cambios, origen){
      const cambiadas = [];
      for (const clave in cambios){
        if (valores[clave] === cambios[clave]) continue;
        valores[clave] = cambios[clave];
        cambiadas.push(clave);
      }
      if (cambiadas.length) oyentes.forEach(o => { if (o.nombre !== origen) o.fn(cambiadas); });
    },
    suscribe(nombre, fn){ oyentes.push({ nombre, fn }); },
  };
})();

/* ==========================================================================
   PARAMETROS DE LAS UNIDADES

   La ocupacion viaja en los dos sentidos y por eso tiene su propio almacen.
   Esto es lo otro: precios, costos, mezclas, semanas y cupos, que solo van de
   "Detalle por unidad" al "Cuadro resumen". Sin este canal el cuadro armaba
   2027 con los valores de partida, asi que cambiar un costo movia la tarjeta
   y dejaba el cuadro donde estaba, y el margen dejaba de cuadrar entre las
   dos pestañas.

   Se publica por referencia y se avisa en cada repintado, tambien cuando no
   cambia la ocupacion: si no, reiniciar los precios no repintaria el cuadro.
   ========================================================================== */
const PARAMETROS = (() => {
  let valor = null;
  const oyentes = [];
  return {
    lee: () => valor,
    publica(v){ valor = v; oyentes.forEach(fn => fn()); },
    suscribe(fn){ oyentes.push(fn); },
  };
})();

function montarUnidades(contenedor){
  const inicial = () => MOTOR.partida();
  let est = inicial();
  const restauradores = [];

  const reg = (cfg, lee) => {
    const c = control(cfg);
    restauradores.push(p => c.restaurar(lee(p)));
    return c.wrap;
  };

  /* Deslizadores que representan un dato que tambien se edita en la tabla.
     Se guardan para poder devolverles el valor calculado desde los alumnos
     en cada repintado: si no, el deslizador quedaria diciendo una ocupacion
     que ya no es la que hay. */
  /* Marca visual entre el control maestro y los de ajuste fino. Devuelve un
     nodo mas para la lista de controles, no un control. */
  const separador = texto => {
    const d = nodo('div', 'control ancho separador-control');
    d.appendChild(nodo('span', null, texto || 'Ajuste fino'));
    return d;
  };

  /* Cuatro unidades facturan al mes y su año son doce veces eso. Veranito no:
     es estacional, su cuenta nace anual y la mensual es el prorrateo. Por eso
     su anual se lee del mismo sitio que la fila "Total al año" de su tabla, y
     no de multiplicar el prorrateo: dividir entre doce y volver a multiplicar
     puede devolver un centimo distinto del que la tabla tiene impreso. */
  const anualDe = (ficha, r) => ficha.anual ? ficha.anual(r) : r.facturacion * 12;

  /* Como se reparte una ocupacion dentro de cada unidad. Es la cuenta que
     ya hacia cada control maestro, puesta en un solo sitio porque ahora entra
     tambien desde el cuadro resumen. */
  const APLICAR = {
    kinder:      f => { est.kinder.ninos = Math.round(MOTOR.KINDER_CAPACIDAD * f); },
    afterSchool: f => { est.afterSchool.ocupacion = f; est.afterSchool.alumnos = null; },
    veranito:    f => { est.veranito.mayAgo.ocupacion = f; est.veranito.eneMar.ocupacion = f; },
    cumpleanos:  f => { est.cumpleanos.eventosSemana = MOTOR.CUMPLE_TOPE_SEMANA * f; },
    baby:        f => { est.baby.alumnos = MOTOR.BABY_FRANJAS.map(fr =>
                          Math.round(MOTOR.babyCupos(fr) * f)); },
  };

  let sincronizables = [];
  const regSync = (cfg, lee) => {
    const c = control(cfg);
    if (cfg.maestro) c.wrap.classList.add('maestro');
    restauradores.push(p => c.restaurar(lee(p)));
    sincronizables.push(c);
    return c.wrap;
  };

  /* Cada unidad declara de donde sale su ocupacion, que columnas tiene su
     tabla y como se arman sus filas. Lo que cambia entre unidades son los
     datos, no la forma de la tarjeta.

     Todas llevan un control maestro de ocupacion que manda sobre los
     granulares, y los granulares debajo como ajuste fino. La sincronizacion
     va en los dos sentidos: el maestro reparte, y tocar un granular
     recalcula el maestro como alumnos sobre cupos. Sin eso, la seccion 2 y
     el cuadro resumen podian quedar en estados distintos sin que nada lo
     indicara, y sus totales dejaban de coincidir. */
  const FICHAS = [
    {
      nombre: 'Kinder', clave: 'kinder',
      columnas: ['Plan', 'Niños', 'Precio', 'Facturación'],
      calcular: () => MOTOR.kinder(est.kinder),
      ocupacion: r => ({ texto: r.ninos + ' de ' + MOTOR.KINDER_CAPACIDAD + ' niños',
                         frac: r.ninos / MOTOR.KINDER_CAPACIDAD }),
      sincronizar: r => [Math.round(r.ninos / MOTOR.KINDER_CAPACIDAD * 100)],
      apoyo: r => r.grupos + ' grupos abiertos · ticket promedio ' + F.precio(r.ticket),
      filas: r => r.detalle.map(d => [d.nombre, d.ninos, F.precio(d.precio), F.dinero(d.facturacion)])
                   .concat([['Costo de los grupos', r.grupos, F.precio(est.kinder.costoGrupo),
                             '−' + F.dinero(r.costo)]]),
      aviso: r => r.excedeCapacidad
        ? r.ninos + ' niños no caben en la capacidad actual: requiere habilitar salones adicionales.' : null,
      controles: () => [
        regSync({ etiqueta:'Ocupación', tipo:'range', min:0, max:100, paso:1, maestro:true,
                  valor: est.kinder.ninos / MOTOR.KINDER_CAPACIDAD * 100, formato:x => x + '%', ancho:true,
                  alCambiar:x => { APLICAR.kinder(x / 100); pintar(); } },
                p => p.kinder.ninos / MOTOR.KINDER_CAPACIDAD * 100),
        separador(),
        reg({ etiqueta:'Mezcla 4,5 h / 8 h', tipo:'range', min:0, max:100, paso:5, valor:est.kinder.pct45*100,
              formato:x => x + ' / ' + (100 - x), ancho:true,
              alCambiar:x => { est.kinder.pct45 = x/100; pintar(); } }, p => p.kinder.pct45*100),
        reg({ etiqueta:'Precio 4,5 h', tipo:'number', min:0, max:2000, paso:1, valor:est.kinder.precio45,
              alCambiar:x => { est.kinder.precio45 = x; pintar(); } }, p => p.kinder.precio45),
        reg({ etiqueta:'Precio 8 h', tipo:'number', min:0, max:2000, paso:1, valor:est.kinder.precio8,
              alCambiar:x => { est.kinder.precio8 = x; pintar(); } }, p => p.kinder.precio8),
        reg({ etiqueta:'Costo por grupo', tipo:'number', min:0, max:9000, paso:50, valor:est.kinder.costoGrupo,
              ancho:true, alCambiar:x => { est.kinder.costoGrupo = x; pintar(); } }, p => p.kinder.costoGrupo),
      ],
      extra: () => {
        const v = VALOR_VIDA;
        return 'Valor de vida de una familia: <strong>' + F.dinero(v.kinder.valor) + '</strong> contra ' +
               F.dinero(v.kinder.adquisicion) + ' de costo de adquisición. Relación de <strong>' +
               Math.round(v.kinder.relacion) + ' a 1</strong>.';
      },
    },
    {
      nombre: 'After School', clave: 'afterSchool',
      columnas: ['Disciplina', 'Cupos', 'Alumnos', 'Grupos', 'Precio', 'Facturación', 'Costo'],
      calcular: () => MOTOR.afterSchool(est.afterSchool),
      /* La ocupacion sale de los alumnos, no de la facturacion: el precio no
         mueve cuantos niños hay. */
      ocupacion: r => ({ texto: r.alumnos + ' de ' + MOTOR.AS_CUPOS_TOTALES + ' alumnos',
                         frac: r.alumnos / MOTOR.AS_CUPOS_TOTALES }),
      sincronizar: r => [Math.round(r.alumnos / MOTOR.AS_CUPOS_TOTALES * 100)],
      filas: r => r.detalle.map((d, i) => [
        d.nombre + ' · ' + d.grupos + (d.grupos === 1 ? ' grupo de ' : ' grupos de ') + d.capGrupo,
        d.cupos,
        /* El motor entrega enteros, asi que el campo muestra exactamente lo
           que usa la cuenta. */
        { editable:true, valor:d.alumnos, min:0, max:d.cupos, paso:1,
          alCambiar:v => { fijarAlumnosAS(r, i, v); pintar(); } },
        d.gruposAbiertos + ' de ' + d.grupos,
        { editable:true, valor:d.precio, min:0, max:900, paso:0.01,
          alCambiar:v => { fijarPrecioAS(r, i, v); pintar(); } },
        F.dinero(d.facturacion),
        d.costo ? '−' + F.dinero(d.costo) : '—',
      ]),
      controles: () => [
        regSync({ etiqueta:'Ocupación', tipo:'range', min:0, max:100, paso:1, maestro:true,
                  valor:est.afterSchool.ocupacion*100, formato:x => x + '%', ancho:true,
                  /* Reparte y vuelve a mandar sobre lo editado en la tabla. */
                  alCambiar:x => { APLICAR.afterSchool(x / 100); pintar(); } },
                p => p.afterSchool.ocupacion*100),
        separador('Los alumnos y el precio de cada disciplina se ajustan en la tabla'),
        /* Las dos tarifas viven aqui y no por disciplina: son la misma persona
           cobrando lo mismo en cualquiera de las ocho. */
        reg({ etiqueta:'Profesor por hora', tipo:'number', min:0, max:500, paso:1,
              valor:est.afterSchool.profesor,
              alCambiar:x => { est.afterSchool.profesor = x; pintar(); } }, p => p.afterSchool.profesor),
        reg({ etiqueta:'Asistente por hora', tipo:'number', min:0, max:500, paso:1,
              valor:est.afterSchool.asistente,
              alCambiar:x => { est.afterSchool.asistente = x; pintar(); } }, p => p.afterSchool.asistente),
      ],
    },
    {
      nombre: 'Veranito', clave: 'veranito',
      columnas: ['Temporada', 'Cupos', 'Vendidos', 'Facturación', 'Costo'],
      /* La cifra grande es la mensual prorrateada, no la anual: asi Veranito
         se lee igual que las otras cuatro unidades, que son mensuales. */
      calcular: () => {
        const v = MOTOR.veranitoAnual(est.veranito);
        return Object.assign({}, v.mes, { v });
      },
      ocupacion: r => ({
        texto: r.v.anual.cupos + ' de ' + r.v.anual.cuposTemporada + ' cupos al año',
        frac: r.v.anual.cupos / r.v.anual.cuposTemporada,
      }),
      sincronizar: r => [
        Math.round(r.v.anual.cupos / r.v.anual.cuposTemporada * 100),
        Math.round(r.v.mayAgo.cupos / r.v.mayAgo.cuposTemporada * 100),
        Math.round(r.v.eneMar.cupos / r.v.eneMar.cuposTemporada * 100),
      ],
      anual: r => r.v.anual.facturacion,
      filas: r => [
        ['Mayo a agosto', r.v.mayAgo.cuposTemporada, r.v.mayAgo.cupos,
         F.dinero(r.v.mayAgo.facturacion), '−' + F.dinero(r.v.mayAgo.costo)],
        ['Enero a marzo', r.v.eneMar.cuposTemporada, r.v.eneMar.cupos,
         F.dinero(r.v.eneMar.facturacion), '−' + F.dinero(r.v.eneMar.costo)],
        { clase:'suma', celdas:['Total al año', r.v.anual.cuposTemporada, r.v.anual.cupos,
          F.dinero(r.v.anual.facturacion), '−' + F.dinero(r.v.anual.costo)] },
        { clase:'suma destacada', celdas:['Prorrateado al mes', '', '',
          F.dinero(r.v.mes.facturacion), '−' + F.dinero(r.v.mes.costo)] },
      ],
      controles: () => [
        regSync({ etiqueta:'Ocupación', tipo:'range', min:0, max:100, paso:1, maestro:true,
                  valor:0, formato:x => x + '%', ancho:true,
                  alCambiar:x => { APLICAR.veranito(x / 100); pintar(); } },
                () => 0),
        separador('Cada temporada por separado'),
        regSync({ etiqueta:'Mayo–agosto', tipo:'range', min:0, max:100, paso:1,
                  valor:est.veranito.mayAgo.ocupacion*100, formato:x => x + '%',
                  alCambiar:x => { est.veranito.mayAgo.ocupacion = x/100; pintar(); } },
                p => p.veranito.mayAgo.ocupacion*100),
        regSync({ etiqueta:'Enero–marzo', tipo:'range', min:0, max:100, paso:1,
                  valor:est.veranito.eneMar.ocupacion*100, formato:x => x + '%',
                  alCambiar:x => { est.veranito.eneMar.ocupacion = x/100; pintar(); } },
                p => p.veranito.eneMar.ocupacion*100),
        reg({ etiqueta:'Semanas', tipo:'range', min:1, max:16, paso:1, valor:est.veranito.semanas,
              formato:x => x + ' semanas',
              alCambiar:x => { est.veranito.semanas = x; pintar(); } }, p => p.veranito.semanas),
        reg({ etiqueta:'Cupos por semana', tipo:'range', min:0, max:50, paso:1, valor:est.veranito.cuposSemana,
              formato:x => x + ' cupos',
              alCambiar:x => { est.veranito.cuposSemana = x; pintar(); } }, p => p.veranito.cuposSemana),
        reg({ etiqueta:'Precio 4,5 h', tipo:'number', min:0, max:900, paso:1, valor:est.veranito.precio45,
              alCambiar:x => { est.veranito.precio45 = x; pintar(); } }, p => p.veranito.precio45),
        reg({ etiqueta:'Precio 8 h', tipo:'number', min:0, max:900, paso:1, valor:est.veranito.precio8,
              alCambiar:x => { est.veranito.precio8 = x; pintar(); } }, p => p.veranito.precio8),
      ],
      nota: () => NOTA_COSTO_VERANITO,
    },
    {
      nombre: 'Cumpleaños', clave: 'cumpleanos',
      columnas: ['Concepto', 'Al mes', 'Precio', 'Facturación', 'Costo'],
      calcular: () => MOTOR.cumpleanos(est.cumpleanos),
      ocupacion: r => {
        const tope = Math.round(MOTOR.CUMPLE_TOPE_SEMANA * MOTOR.SEM_MES);
        return { texto: r.eventos + ' de ' + tope + ' eventos al mes', frac: r.eventos / tope };
      },
      /* El maestro va en porcentaje, como en las otras cuatro, y el control
         de eventos por semana queda debajo. Sin el maestro, "ponerlo al 65%"
         no era la misma accion aqui que en el cuadro resumen. */
      sincronizar: () => [
        Math.round(est.cumpleanos.eventosSemana / MOTOR.CUMPLE_TOPE_SEMANA * 100),
        Math.round(est.cumpleanos.eventosSemana * 10) / 10,
      ],
      apoyo: () => 'Tope real: ' + MOTOR.CUMPLE_TOPE_SEMANA + ' eventos por semana.',
      filas: r => r.detalle.map(d => [
        d.nombre + ' · ' + d.porSemana.toFixed(1).replace('.', ',') + ' por semana',
        d.cantidad, F.precio(d.precio), F.dinero(d.facturacion), '−' + F.dinero(d.costo)]),
      controles: () => [
        regSync({ etiqueta:'Ocupación', tipo:'range', min:0, max:100, paso:1, maestro:true,
                  valor:est.cumpleanos.eventosSemana / MOTOR.CUMPLE_TOPE_SEMANA * 100,
                  formato:x => x + '%', ancho:true,
                  alCambiar:x => { APLICAR.cumpleanos(x / 100); pintar(); } },
                p => p.cumpleanos.eventosSemana / MOTOR.CUMPLE_TOPE_SEMANA * 100),
        separador(),
        regSync({ etiqueta:'Eventos por semana', tipo:'range', min:0, max:MOTOR.CUMPLE_TOPE_SEMANA, paso:0.1,
                  valor:est.cumpleanos.eventosSemana,
                  formato:x => x.toFixed(1).replace('.', ',') + ' por semana', ancho:true,
                  alCambiar:x => { est.cumpleanos.eventosSemana = x; pintar(); } },
                p => p.cumpleanos.eventosSemana),
        reg({ etiqueta:'Precio del paquete', tipo:'number', min:0, max:3000, paso:1, valor:est.cumpleanos.precio,
              alCambiar:x => { est.cumpleanos.precio = x; pintar(); } }, p => p.cumpleanos.precio),
        reg({ etiqueta:'Costo por evento', tipo:'number', min:0, max:3000, paso:1, valor:est.cumpleanos.costoEvento,
              alCambiar:x => { est.cumpleanos.costoEvento = x; pintar(); } }, p => p.cumpleanos.costoEvento),
      ],
    },
    {
      nombre: 'Baby and Me', clave: 'baby',
      columnas: ['Franja', 'Cupos', 'Alumnos', 'Grupos', 'Precio', 'Facturación', 'Costo'],
      calcular: () => MOTOR.baby(est.baby),
      ocupacion: r => ({ texto: r.alumnos + ' de ' + r.cupos + ' cupos', frac: r.alumnos / r.cupos }),
      sincronizar: r => [
        Math.round(r.alumnos / r.cupos * 100),
        Math.round(r.detalle[0].alumnos / r.detalle[0].cupos * 100),
        Math.round(r.detalle[1].alumnos / r.detalle[1].cupos * 100),
      ],
      filas: r => r.detalle.map((d, i) => [
        d.nombre + ' · ' + d.grupos + (d.grupos === 1 ? ' grupo de ' : ' grupos de ') + d.capGrupo,
        d.cupos,
        { editable:true, valor:d.alumnos, min:0, max:d.cupos, paso:1,
          alCambiar:v => { est.baby.alumnos = r.detalle.map(x => x.alumnos);
                           est.baby.alumnos[i] = v; pintar(); } },
        d.gruposAbiertos + ' de ' + d.grupos,
        F.precio(d.precio),
        F.dinero(d.facturacion),
        d.costo ? '−' + F.dinero(d.costo) : '—',
      ]),
      /* El maestro reparte entre las dos franjas; cada una se afina debajo.
         Los planes cuestan distinto —sabado $97, semana $165— asi que
         llenar una no vale lo mismo que llenar la otra. */
      controles: () => [
        regSync({ etiqueta:'Ocupación', tipo:'range', min:0, max:100, paso:1, maestro:true,
                  valor:0, formato:x => x + '%', ancho:true,
                  alCambiar:x => { APLICAR.baby(x / 100); pintar(); } },
                () => 0),
        separador('Cada franja por separado'),
      ].concat(MOTOR.BABY_FRANJAS.map((fr, i) => {
        const cupos = MOTOR.babyCupos(fr);
        return regSync({ etiqueta:fr.nombre, tipo:'range', min:0, max:100, paso:1,
                         valor:0, formato:x => x + '%',
                         alCambiar:x => {
                           const actual = MOTOR.baby(est.baby).detalle.map(d => d.alumnos);
                           actual[i] = Math.round(cupos * x / 100);
                           est.baby.alumnos = actual;
                           pintar();
                         } },
                       () => 0);
      })).concat([
        separador('Precio de cada plan'),
        /* Los dos planes cuestan distinto y se editan por separado. El precio
           no toca el costo: las sesiones dictadas son las mismas cobren lo
           que cobren, y de ahi salen los $650 del mes. */
        reg({ etiqueta:'Precio plan sábado', tipo:'number', min:0, max:900, paso:0.01,
              valor:est.baby.precios[0],
              alCambiar:x => { est.baby.precios[0] = x; pintar(); } }, p => p.baby.precios[0]),
        reg({ etiqueta:'Precio plan semana', tipo:'number', min:0, max:900, paso:0.01,
              valor:est.baby.precios[1],
              alCambiar:x => { est.baby.precios[1] = x; pintar(); } }, p => p.baby.precios[1]),
        /* Editable porque puede atenderla un profesor de Kinder. */
        reg({ etiqueta:'Costo por hora', tipo:'number', min:0, max:500, paso:1, valor:est.baby.costoHora,
              ancho:true, alCambiar:x => { est.baby.costoHora = x; pintar(); } }, p => p.baby.costoHora),
      ]),
    },
  ];

  /* Al tocar una celda se congela el vector completo con lo que hay en
     pantalla y se cambia solo esa posicion: si no, el reparto del deslizador
     volveria a pisar lo editado en el siguiente repintado. */
  function fijarAlumnosAS(r, i, v){
    est.afterSchool.alumnos = r.detalle.map(d => d.alumnos);
    est.afterSchool.alumnos[i] = v;
  }
  function fijarPrecioAS(r, i, v){
    est.afterSchool.precios = r.detalle.map(d => d.precio);
    est.afterSchool.precios[i] = v;
  }

  const tarjetas = FICHAS.map(ficha => {
    const art = nodo('article', 'unidad-ancha');

    const cab = nodo('div', 'ua-cab');
    cab.appendChild(nodo('h3', null, ficha.nombre));
    const pastillaCaja = nodo('span', 'ua-pastilla');
    cab.appendChild(pastillaCaja);
    art.appendChild(cab);

    /* Solo las fichas que declaran linea de apoyo tienen nodo. Veranito no la
       lleva: su tabla ya dice el total al año y el prorrateo mensual. */
    let apoyo = null;
    if (ficha.apoyo){
      apoyo = nodo('div', 'cifra-apoyo');
      art.appendChild(apoyo);
    }

    const aviso = nodo('div', 'aviso');
    aviso.style.display = 'none';
    art.appendChild(aviso);

    const cuerpo = nodo('div', 'ua-cuerpo');

    /* Izquierda: la tabla desglosada, que es de donde sale cada dolar. */
    const cajaTabla = nodo('div', 'ua-tabla');
    const tabla = document.createElement('table');
    tabla.className = 'desglose';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ficha.columnas.forEach((c, i) => {
      const th = document.createElement('th');
      th.textContent = c;
      if (i > 0) th.className = 'num';
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);
    const tbody = document.createElement('tbody');
    tabla.appendChild(tbody);
    cajaTabla.appendChild(tabla);
    cuerpo.appendChild(cajaTabla);

    /* Derecha: las tres cifras y los controles. */
    const lado = nodo('div', 'ua-lado');
    const cifras = nodo('div', 'cifras');
    const refs = {};
    /* La anual va pegada a la mensual: es la misma cifra en la escala en la
       que el cliente piensa el año, y asi se comparan las dos de un vistazo. */
    for (const par of [['facturacion','Facturación'],['anual','Facturación anual'],
                       ['costo','Costo'],['margen','Margen']]){
      const bloque = nodo('div', 'cifra-bloque' + (par[0] === 'margen' ? ' destacada' : ''));
      bloque.appendChild(nodo('span', 'etiqueta', par[1]));
      refs[par[0]] = nodo('b');
      bloque.appendChild(refs[par[0]]);
      cifras.appendChild(bloque);
    }
    lado.appendChild(cifras);

    const controles = nodo('div', 'controles');
    const desde = sincronizables.length;
    ficha.controles().forEach(w => controles.appendChild(w));
    const suyos = sincronizables.slice(desde);
    lado.appendChild(controles);
    cuerpo.appendChild(lado);
    art.appendChild(cuerpo);

    if (ficha.extra) art.appendChild(bloqueDestacado(ficha.extra()));
    art.appendChild(nodo('p', 'nota-costo', ficha.nota ? ficha.nota() : NOTA_COSTO));

    contenedor.appendChild(art);
    return { ficha, pastillaCaja, apoyo, aviso, tbody, refs, pastillaNodo:null, sincronizables:suyos };
  });

  barraReinicio(contenedor, 'Reiniciar valores');

  function pintar(){
    const fracs = {};
    for (const t of tarjetas){
      const r = t.ficha.calcular();

      const oc = t.ficha.ocupacion(r);
      if (t.ficha.clave) fracs[t.ficha.clave] = oc.frac;
      if (t.pastillaNodo) t.pastillaNodo.remove();
      t.pastillaNodo = pastilla(oc.texto + ' · ' + F.pct(oc.frac), oc.frac);
      t.pastillaCaja.appendChild(t.pastillaNodo);

      if (t.apoyo) t.apoyo.textContent = t.ficha.apoyo(r);

      const av = t.ficha.aviso ? t.ficha.aviso(r) : null;
      t.aviso.style.display = av ? '' : 'none';
      if (av) t.aviso.textContent = av;

      /* La tabla se construye una vez y luego solo se actualiza. Rehacerla
         en cada repintado destruia el campo que se estaba escribiendo: por
         eso solo aceptaba un digito y obligaba a volver a hacer clic. */
      const filas = t.ficha.filas(r);
      if (!t.filasDom) t.filasDom = filas.map(cruda => crearFila(t.tbody, cruda));
      filas.forEach((cruda, i) => actualizarFila(t.filasDom[i], cruda));

      /* El deslizador vuelve al valor que dicen los alumnos. Se calcula
         desde alumnos sobre cupos, nunca desde la facturacion: el precio no
         cambia la ocupacion. El que tiene el foco no se toca. */
      if (t.ficha.sincronizar){
        const valores = t.ficha.sincronizar(r);
        t.sincronizables.forEach((c, i) => {
          if (valores[i] == null) return;
          /* Sin redondear aqui: hay controles con paso decimal, como los
             eventos por semana. Cada ficha devuelve el valor ya en las
             unidades de su control. */
          if (document.activeElement !== c.inp) c.restaurar(valores[i]);
        });
      }

      t.refs.facturacion.textContent = F.dinero(r.facturacion);
      t.refs.anual.textContent = F.dinero(anualDe(t.ficha, r));
      t.refs.costo.textContent = F.dinero(r.costo);
      t.refs.margen.textContent = F.dinero(r.margen);
    }

    /* La ocupacion que sale de estas tarjetas es la que ve el cuadro resumen.
       Si no cambio nada, fija() no avisa y aqui se detiene el ciclo. */
    OCUPACION.fija(fracs, 'unidades');

    /* Y con ella el resto del estado: el cuadro arma 2027 con este mismo
       objeto, de modo que no puede calcular una unidad distinta de la que
       enseña la tarjeta. */
    PARAMETROS.publica(est);
  }

  /* Lo que llega del cuadro resumen se reparte dentro de la unidad que cambio
     —solo esa: reaplicar las cinco borraria los alumnos editados a mano en la
     tabla de otra unidad— y se repinta. */
  OCUPACION.suscribe('unidades', claves => {
    let toco = false;
    for (const clave of claves){
      if (!APLICAR[clave]) continue;
      APLICAR[clave](OCUPACION.lee(clave));
      toco = true;
    }
    if (toco) pintar();
  });

  function reiniciar(){ est = inicial(); restauradores.forEach(r => r(est)); pintar(); }
  pintar();
  REINICIOS.push(reiniciar);
}


/* ==========================================================================
   CUADRO RESUMEN

   Las dos primeras columnas son datos cerrados y no se tocan: ni la de 2025
   ni la de los siete meses de 2026. Solo la de 2027 responde a los controles.
   ========================================================================== */
function montarResumen(contenedor){
  /* Un deslizador por unidad en vez de uno solo: la pregunta de la reunion
     es "Kinder al 80% pero After School al 50%, cuanto da".

     Estos deslizadores recorren de 0 a 100 de punto en punto, y no de 45 a
     100 de cinco en cinco como antes. El motivo es que ahora muestran el
     mismo dato que la seccion 2, que arranca en la ocupacion real de cada
     unidad —Kinder en 37,5%, Baby and Me en 0%— y ninguno de esos valores
     cabe en aquella rejilla: el deslizador habria enseñado 45% mientras el
     valor compartido decia otra cosa.

     Lo que se pierde con el paso de un punto esta medido y documentado en
     pruebas-motor.js: el EBITDA retrocede cuatro veces al subir la ocupacion,
     cuando Kinder cruza un escalon de grupo. */
  const UNIDADES_2027 = [
    { clave:'kinder',      rotulo:'Kinder' },
    { clave:'afterSchool', rotulo:'After School' },
    { clave:'veranito',    rotulo:'Veranito' },
    { clave:'cumpleanos',  rotulo:'Cumpleaños' },
    { clave:'baby',        rotulo:'Baby and Me' },
  ];
  /* El punto de partida es el que trae la seccion 2, que ya se monto. Los
     dos botones de reinicio vuelven aqui, para que no haya dos "estados
     iniciales" distintos segun por donde se reinicie. */
  const OCUPACIONES_PARTIDA = UNIDADES_2027.reduce(
    (o, u) => (o[u.clave] = OCUPACION.lee(u.clave, MOTOR.OCUPACION_2027_PARTIDA), o), {});
  const inicial = () => ({
    ocupaciones: Object.assign({}, OCUPACIONES_PARTIDA),
    gastosMes: MOTOR.GASTOS_MES_PARTIDA,
  });
  let est = inicial();
  const restauradores = [];
  const deslizadores = {};

  /* La posicion mas cercana que el deslizador puede ocupar. Nunca por debajo
     del suelo ni fuera del paso: el input rechazaria el valor y se quedaria
     en otro sitio sin avisar. */
  const enRejilla = x => {
    const paso = MOTOR.OCUPACION_2027_PASO;
    const suelo = MOTOR.OCUPACION_2027_MINIMA * 100;
    return Math.min(100, Math.max(suelo, Math.round(x / paso) * paso));
  };
  /* Un decimal y coma, para que 37,5% no salga como 37.5% ni redondeado a 38. */
  const PCT = x => (Math.round(x * 10) / 10).toString().replace('.', ',') + '%';

  const panel = nodo('div', 'plan-controles');
  const reg = (cfg, lee) => {
    const c = control(cfg);
    restauradores.push(p => c.restaurar(lee(p)));
    panel.appendChild(c.wrap);
    return c;
  };
  for (const u of UNIDADES_2027){
    deslizadores[u.clave] = reg({ etiqueta:'Ocupación · ' + u.rotulo, tipo:'range',
          min:MOTOR.OCUPACION_2027_MINIMA*100, max:100, paso:MOTOR.OCUPACION_2027_PASO,
          valor:enRejilla(est.ocupaciones[u.clave]*100), formato:PCT,
          alCambiar:x => { est.ocupaciones[u.clave] = x/100;
                           OCUPACION.fija({ [u.clave]: x/100 }, 'resumen');
                           pintar(); } },
        p => p.ocupaciones[u.clave]*100);
  }
  reg({ etiqueta:'Gastos operativos mensuales', tipo:'number', min:0, max:200000, paso:500,
        valor:est.gastosMes,
        alCambiar:x => { est.gastosMes = x; pintar(); } }, p => p.gastosMes);
  contenedor.appendChild(panel);

  const caja = nodo('div', 'tabla-caja');
  const tabla = document.createElement('table');
  tabla.className = 'resumen';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const t of ['', '2025 real', 'A julio 2026 · 7 meses', '2027 proyectado']){
    const th = document.createElement('th');
    th.textContent = t;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  tabla.appendChild(thead);

  const tbody = document.createElement('tbody');
  const FILAS = [
    { clave:'ingresos',   rotulo:'Ingresos', grande:true, verde:true },
    { clave:'manoDeObra', rotulo:'(−) Costo de mano de obra' },
    { clave:'margenBruto', rotulo:'Margen bruto', destacada:true, grande:true, pct:'margenBrutoPct',
      visible: a => F.sumaVisible([a.ingresos, -a.manoDeObra]) },
    { clave:'gastos',     rotulo:'(−) Gastos operativos' },
    { clave:'ebitda',     rotulo:'EBITDA', destacada:true, verde:true, grande:true, pct:'ebitdaPct',
      visible: a => F.sumaVisible([F.sumaVisible([a.ingresos, -a.manoDeObra]), -a.gastos]) },
  ];
  const celdas = {};
  for (const f of FILAS){
    const tr = document.createElement('tr');
    if (f.destacada) tr.className = 'destacada';
    if (f.verde) tr.classList.add('verde');
    if (f.grande) tr.classList.add('grande');
    if (f.clave === 'ingresos') tr.classList.add('ingresos');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = f.rotulo;
    tr.appendChild(th);
    celdas[f.clave] = [];
    for (let i = 0; i < 3; i++){
      const td = document.createElement('td');
      const cifra = nodo('b');
      td.appendChild(cifra);
      let porc = null;
      if (f.pct){ porc = nodo('span', 'porcentaje'); td.appendChild(porc); }
      celdas[f.clave].push({ cifra, porc });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabla.appendChild(tbody);
  caja.appendChild(tabla);
  contenedor.appendChild(caja);

  /* Las notas de metodo no son decorativas: sin ellas las cifras de 2026 y
     el tratamiento de Veranito quedan sin explicar y el cliente pregunta. */
  const notas = nodo('div', 'notas-metodo');
  for (const t of [
      'La columna de 2026 recoge la facturación real de enero a julio, siete meses. Los gastos ' +
      'operativos van a ' + F.dinero(MOTOR.GASTOS_MES_PARTIDA) + ' al mes por esos siete meses. Las cifras no están anualizadas.',
      'Veranito es estacional: en el resumen anual entra completo y en las vistas mensuales se prorratea.',
      'En 2027, otros ingresos entran como renglón fijo anual de ' + F.dinero(MOTOR.OTROS_INGRESOS) +
      ', al nivel del año 2026 completo, y no escalan con la ocupación.',
      NOTA_COSTO,
    ]) notas.appendChild(nodo('p', null, t));
  contenedor.appendChild(notas);

  /* El contraste que hay que poder explicar, anclado al escenario del 60% y
     no a lo que muestre la columna en ese instante. Antes se leia de la
     columna viva y, desde que 2027 abre en la ocupacion real, la frase decia
     que el EBITDA subia mientras enseñaba una caida.

     Se escribe una sola vez, fuera de pintar(), porque sus dos extremos son
     fijos: la columna de julio es un dato cerrado y el 60% es un escenario
     declarado. Los porcentajes salen del motor.

     Se comparan porcentajes y nunca montos: julio son siete meses y 2027
     son doce, asi que sus cifras en dolares no son comparables. */
  const contexto = nodo('div', 'hallazgo');
  {
    const jul = MOTOR.resumen(2026);
    const p60 = MOTOR.resumen2027({ ocupacion:MOTOR.OCUPACION_2027_PARTIDA,
                                    gastosMes:MOTOR.GASTOS_MES_PARTIDA });
    contexto.innerHTML =
      'Con las cinco unidades al ' + F.pct(MOTOR.OCUPACION_2027_PARTIDA) + ' de ocupación, ' +
      'el margen bruto baja de <strong>' +
      F.pctDecimal(jul.margenBrutoPct) + '</strong> a <strong>' + F.pctDecimal(p60.margenBrutoPct) +
      '</strong> por dos razones: Kinder abre grupos al llenarse, y cada grupo cuesta más porque el ' +
      'proyecto contempla el ajuste salarial del equipo docente. El EBITDA sube igual, de <strong>' +
      F.pctDecimal(jul.ebitdaPct) + '</strong> a <strong>' + F.pctDecimal(p60.ebitdaPct) +
      '</strong>, porque los gastos fijos se reparten entre muchos más ingresos. Se comparan ' +
      'porcentajes y no montos: la columna de julio son siete meses y la de 2027, doce.';
  }
  contenedor.appendChild(contexto);
  barraReinicio(contenedor, 'Reiniciar 2027');

  function pintar(){
    /* Cada deslizador se pone donde diga el valor compartido, salvo el que
       tenga el foco: moverlo bajo los dedos de quien lo arrastra. El entero
       es solo lo que se pinta; la cuenta usa el valor exacto. */
    for (const clave in deslizadores){
      const c = deslizadores[clave];
      if (document.activeElement === c.inp) continue;
      const exacto = est.ocupaciones[clave] * 100;
      c.restaurar(enRejilla(exacto), exacto);
    }

    const anios = [MOTOR.resumen(2025), MOTOR.resumen(2026),
                   MOTOR.resumen2027({ unidades:PARAMETROS.lee(),
                                       ocupaciones:est.ocupaciones, gastosMes:est.gastosMes })];
    for (const f of FILAS){
      anios.forEach((a, i) => {
        const c = celdas[f.clave][i];
        c.cifra.textContent = F.dinero(f.visible ? f.visible(a) : a[f.clave]);
        if (c.porc) c.porc.textContent = F.pctDecimal(a[f.pct]) + ' sobre ingresos';
      });
    }
  }

  /* Cualquier cambio de la seccion 2 —un precio, un costo— obliga a repintar
     aunque la ocupacion no se haya movido. */
  PARAMETROS.suscribe(() => pintar());

  /* La seccion 2 publica en cada repintado suyo. Aqui se recoge el valor y
     se repinta, sin volver a publicar: eso es lo que corta el ida y vuelta. */
  OCUPACION.suscribe('resumen', claves => {
    for (const clave of claves){
      if (!(clave in est.ocupaciones)) continue;
      est.ocupaciones[clave] = OCUPACION.lee(clave);
    }
    pintar();
  });

  /* Reiniciar aqui devuelve tambien la ocupacion compartida al punto de
     partida, o la seccion 2 se quedaria donde el cliente la dejo. */
  function reiniciar(){
    est = inicial();
    restauradores.forEach(r => r(est));
    OCUPACION.fija(Object.assign({}, OCUPACIONES_PARTIDA), 'resumen');
    pintar();
  }
  pintar();
  REINICIOS.push(reiniciar);
}
