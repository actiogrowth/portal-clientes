/* ==========================================================================
   Vida en Arte · Procesos › Equipo: la lista de verificación (2-nov-2026,
   Equipo v3)

   La usan la ficha del puesto (comun/organigrama.js, pestaña «Lista de
   verificación») y Mi lista (equipo/index.html): una sola manera de marcar.
   Necesita Marca (esc), Puestos (agrupar, etiquetasHora) y Datos.equipo.

   · Cada punto: «Ejecutado» o «No ejecutado» (este pide el motivo). Los
     puntos «por evento» (grupo «Cada vez que ocurre») se marcan cada vez que
     ocurre, cada vez con su nota (a qué evento corresponde). Se guarda al
     tocar: no hay botón Guardar.
   · Quitar una marca: quien la puso la toca de nuevo mientras siga abierto el
     período del punto (el día, la semana, el mes…; por evento, el mismo día).
     El servidor no borra nada: agrega una fila «Desmarcada».
   · Abre en el período actual; sin marca en pie, «Pendiente»; si el período
     ya cerró sin marca, «Vencido». Con el selector de fecha se consulta un día
     anterior (de solo lectura). El período de cada día lo manda el servidor
     (D.calendario, de Procesos.gs): aquí no se repite la regla.
   · Quien no ocupa el puesto (verifica, es su jefe, Dirección) lo ve de solo
     lectura, con las marcas quitadas: quién y cuándo.

     Verificacion.crear({ datos: () => D, puesto: () => id, repintar(foco), aLogin(), revisar })
       → { html(), clic(ev), enviar(ev), cambio(ev), entrada(ev), reiniciar() }
       clic/enviar/cambio/entrada devuelven true si el evento era suyo.
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => Marca.esc(s), norm = s => Puestos.normal(s);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const EJECUTADO = 'Ejecutado', NO_EJECUTADO = 'No ejecutado', DESMARCADA = 'Desmarcada';
  const esDia = p => /^\d{4}-\d{2}-\d{2}$/.test(p || '');

  /* «2026-10-28» → «28 de octubre de 2026»; «2026-S44» → «Semana 44 de 2026»; «2026-10» → «Octubre de 2026»;
     «2026-10-Q2» → «Del 16 al fin de octubre de 2026»; «2026-T4» → «Octubre a diciembre de 2026»; «2026-C3» → «Septiembre a diciembre de 2026». */
  const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);
  const tramo = (a, desde, hasta) => mayus(MESES[desde - 1]) + ' a ' + MESES[hasta - 1] + ' de ' + a;
  function periodoTexto(p) {
    let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p))) return +m[3] + ' de ' + MESES[+m[2] - 1] + ' de ' + m[1];
    if ((m = /^(\d{4})-S(\d{2})$/.exec(p))) return 'Semana ' + +m[2] + ' de ' + m[1];
    if ((m = /^(\d{4})-(\d{2})-Q([12])$/.exec(p))) return (m[3] === '1' ? 'Del 1 al 15 de ' : 'Del 16 al fin de ') + MESES[+m[2] - 1] + ' de ' + m[1];
    if ((m = /^(\d{4})-(\d{2})$/.exec(p))) return mayus(MESES[+m[2] - 1]) + ' de ' + m[1];
    if ((m = /^(\d{4})-T([1-4])$/.exec(p))) return tramo(m[1], 3 * m[2] - 2, 3 * m[2]);
    if ((m = /^(\d{4})-C([1-3])$/.exec(p))) return tramo(m[1], 4 * m[2] - 3, 4 * m[2]);
    return p;
  }
  function hora12(s) {
    const m = /T(\d{1,2}):(\d{2})/.exec(s || '');
    if (!m) return '';
    const h = +m[1];
    return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' a. m.' : ' p. m.');
  }
  const diaCorto = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? +m[3] + ' de ' + MESES[+m[2] - 1] : ''; };
  const cuando = s => diaCorto(s) + (hora12(s) ? ', ' + hora12(s) : '');

  /**
   * Las marcas en pie: una fila «Desmarcada» quita la marca de su MISMO usuario y punto cuya fecha y hora
   * es su nota. clave(m) dice qué es el mismo punto (en la lista, el orden). La misma regla que Procesos.gs.
   */
  function enPie(marcas, clave) {
    const quitadas = new Set((marcas || []).filter(m => norm(m.resultado) === norm(DESMARCADA)).map(m => norm(m.usuario) + '|' + clave(m) + '|' + String(m.nota || '').trim()));
    return (marcas || []).filter(m => norm(m.resultado) !== norm(DESMARCADA) && !quitadas.has(norm(m.usuario) + '|' + clave(m) + '|' + m.fecha));
  }

  /** El período de una forma (dia, semana, mes…) que contiene el día `dia`, según el calendario del servidor; null si no se sabe. */
  function periodoEn(D, forma, dia) {
    const c = D.calendario && D.calendario[dia];
    if (c && forma && c[forma]) return c[forma];
    return (forma || 'dia') === 'dia' && esDia(dia) ? dia : null;
  }

  /**
   * Cada punto de la lista el día `dia`: {x, periodo, abierto, marcas (en pie, de su período), quitadas, estado}.
   * estado: «Ejecutado» | «No ejecutado» (la última en pie) | «Pendiente» (período abierto, sin marca) |
   * «Vencido» (período cerrado, sin marca) | «Por evento» | '' (no se sabe: un script viejo, sin calendario).
   */
  function estados(f, D, dia) {
    const todas = (f.marcas || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const pie = enPie(todas, m => +m.orden);
    return (f.lista || []).map(x => {
      // Sin forma o sin calendario (Procesos.gs de antes de v5): solo se sabe el período de hoy.
      const periodo = (x.forma && periodoEn(D, x.forma, dia)) || (dia === D.hoy ? x.periodo || null : null);
      const abierto = !!periodo && periodo === x.periodo;
      const delPeriodo = m => +m.orden === +x.orden && m.periodo === periodo;
      const marcas = periodo ? pie.filter(delPeriodo) : [];
      const quitadas = periodo ? todas.filter(m => delPeriodo(m) && norm(m.resultado) === norm(DESMARCADA)) : [];
      const estado = x.evento ? 'Por evento' : marcas.length ? marcas[marcas.length - 1].resultado : !periodo ? '' : abierto ? 'Pendiente' : 'Vencido';
      return { x, periodo, abierto, marcas, quitadas, estado };
    });
  }

  /** Para la cabecera de Mi lista: los puntos diarios (no por evento) y cuántos tienen marca hoy. */
  function resumenHoy(f, D) {
    const e = estados(f, D, D.hoy).filter(v => !v.x.evento && (v.x.forma || 'dia') === 'dia' && v.periodo);
    return { diarios: e.length, hechos: e.filter(v => v.marcas.length).length };
  }

  const claseEstado = e => ({ 'Ejecutado': 'si', 'No ejecutado': 'no', 'Pendiente': 'pendiente', 'Vencido': 'vencido' }[e] || 'neutro');

  function crear(op) {
    const st = { dia: '', abierta: null, nota: '', guardando: '', aviso: '' };
    const D = () => op.datos(), id = () => op.puesto(), ficha = () => D().fichas[id()];
    const quien = u => { const p = D().personas && D().personas[u]; return u === D().yo.usuario ? 'tú' : p && p.nombre ? p.nombre : u; };
    const horas = t => Puestos.etiquetasHora(t, D().momentos, esc);
    const diaVisto = () => (st.dia && D().calendario && D().calendario[st.dia]) ? st.dia : D().hoy;
    const yo = () => norm(D().yo.usuario);
    const mia = m => norm(m.usuario) === yo();

    function linea(m, quitable) {
      const nota = m.nota && norm(m.resultado) !== norm(DESMARCADA) ? ' · «' + esc(m.nota) + '»' : '';
      return '<span class="vf-marca"><b class="vf-res ' + claseEstado(m.resultado) + '">' + esc(m.resultado) + '</b> ' + esc(cuando(m.fecha)) + ' · ' + esc(quien(m.usuario)) + nota +
        (quitable ? ' <button type="button" class="vf-quitar" data-vf-quitar="' + esc(m.orden + '|' + m.fecha) + '"' + (st.guardando ? ' disabled' : '') + '>Quitar</button>' : '') + '</span>';
    }

    function punto(v, puedeMarcar, soloLectura) {
      const x = v.x, k = String(x.orden), guardando = st.guardando === k;
      const marcable = puedeMarcar && v.abierto, ultima = v.marcas[v.marcas.length - 1] || null;
      const propia = ultima && mia(ultima);
      let botones = '';
      if (marcable && !x.evento) {
        // Una marca por período: la propia se quita tocándola; con una marca en pie, el otro botón se apaga.
        const boton = (res, cls) => {
          const puesta = ultima && ultima.resultado === res;
          const accion = puesta ? (propia ? ' data-vf-quitar="' + esc(k + '|' + ultima.fecha) + '"' : '') : ' data-vf-marcar="' + esc(k + '|' + res) + '"';
          const apagado = guardando || st.guardando || (ultima && !(puesta && propia));
          return '<button type="button" class="ml-res ' + cls + '"' + accion + ' aria-pressed="' + !!puesta + '"' + (apagado ? ' disabled' : '') +
            (puesta && propia ? ' title="Toca para quitar tu marca"' : '') + '>' + res + '</button>';
        };
        botones = '<div class="ml-botones" role="group" aria-label="' + esc(x.texto) + '">' + boton(EJECUTADO, 'si') + boton(NO_EJECUTADO, 'no') + '</div>';
      } else if (marcable && x.evento) {
        botones = '<div class="ml-botones" role="group" aria-label="' + esc(x.texto) + '">' +
          [[EJECUTADO, 'si'], [NO_EJECUTADO, 'no']].map(([res, cls]) => '<button type="button" class="ml-res ' + cls + '" data-vf-marcar="' + esc(k + '|' + res) + '"' + (st.guardando ? ' disabled' : '') + '>' + res + '</button>').join('') + '</div>';
      }
      const abierta = st.abierta && String(st.abierta.orden) === k;
      const form = abierta ? '<form class="vf-nota" data-vf-nota="' + esc(k) + '"><label><span>' + (x.evento ? '¿A qué corresponde? <small>(obligatorio)</small>' : 'Motivo <small>(obligatorio)</small>') + '</span>' +
          '<input type="text" maxlength="500" required data-vf-nota-txt value="' + esc(st.nota) + '" placeholder="' + (x.evento ? 'Por ejemplo, el pago o el niño' : 'Por qué no se hizo') + '"></label>' +
          '<div class="eq-botones"><button type="submit" class="btn negro chico"' + (guardando ? ' disabled' : '') + '>' + (guardando ? 'Guardando…' : 'Guardar · ' + esc(st.abierta.resultado)) + '</button>' +
          '<button type="button" class="btn sec chico" data-vf-cancelar>Cancelar</button></div></form>' : '';
      // Lo que ya está: por evento, cada marca (la propia del día se puede quitar); lo demás, la marca en pie.
      let detalle = '';
      if (x.evento) detalle = v.marcas.map(m => linea(m, marcable && mia(m))).join('') || (v.periodo ? '<span class="ayuda">Sin registros ' + (v.periodo === D().hoy ? 'hoy' : 'ese día') + '.</span>' : '');
      else if (ultima) detalle = '<span class="ayuda">' + esc(cuando(ultima.fecha)) + ' · ' + esc(quien(ultima.usuario)) + (ultima.nota ? ' · «' + esc(ultima.nota) + '»' : '') +
        (marcable && propia ? ' · toca tu marca para quitarla' : '') + '</span>';
      // Quien no ocupa el puesto ve también las marcas quitadas: quién y cuándo.
      const historial = soloLectura && v.quitadas.length ? '<span class="vf-quitadas">' + v.quitadas.map(m => 'Quitó su marca de ' + esc(cuando(m.nota)) + ': ' + esc(quien(m.usuario)) + ', ' + esc(cuando(m.fecha))).join('<br>') + '</span>' : '';
      const chip = v.estado && v.estado !== 'Por evento' ? '<span class="vf-estado ' + claseEstado(v.estado) + '">' + esc(guardando ? 'Guardando…' : v.estado) + '</span>' : '';
      return '<li class="vf-punto" data-vf-punto="' + esc(k) + '"><div class="vf-cuerpo"><div class="vf-txt"><span class="ml-que">' + esc(x.texto) + '</span>' +
          (Puestos.frecuenciaPropia(x) ? '<span class="eq-cuando">' + esc(Puestos.frecuenciaPropia(x)) + '</span>' : '') + horas(x.texto) +
          (x.evidencia ? '<span class="ayuda">Evidencia: ' + esc(x.evidencia) + '</span>' : '') + detalle + historial + '</div>' + chip + '</div>' + botones + form + '</li>';
    }

    function html() {
      const d = D(), f = ficha(), p = d.puestos.find(x => x.id === id()) || {};
      if (!f.lista || !f.lista.length) return '<p class="ayuda">Este puesto todavía no tiene lista de verificación.</p>';
      const dia = diaVisto(), hoy = dia === d.hoy;
      const abierto = norm(p.estado) === norm('Abierto al equipo');
      const puedeMarcar = abierto && f.ocupo && hoy, soloLectura = !f.ocupo;
      const vs = estados(f, d, dia);
      const grupos = Puestos.agrupar(vs.map(v => Object.assign({}, v.x, { _v: v })));
      const cuenta = e => vs.filter(v => v.estado === e).length;
      const resumen = [[EJECUTADO, 'si'], [NO_EJECUTADO, 'no'], ['Pendiente', 'pendiente'], ['Vencido', 'vencido']].filter(([e]) => cuenta(e))
        .map(([e, c]) => '<span class="vf-estado ' + c + '">' + cuenta(e) + ' ' + (e === 'Pendiente' && cuenta(e) > 1 ? 'pendientes' : e === 'Vencido' && cuenta(e) > 1 ? 'vencidos' : e.toLowerCase()) + '</span>').join('');
      const dias = Object.keys(d.calendario || {}).sort();
      const nota = !abierto ? 'Se marca cuando el puesto esté «Abierto al equipo».'
        : f.ocupo ? (hoy ? 'Toca «Ejecutado» al hacerlo, o «No ejecutado» con el motivo. Tu marca se quita tocándola de nuevo mientras siga abierto su período.' : 'Un día anterior se consulta, pero ya no se marca.')
        : 'La marca quien ocupa el puesto.' + (f.verifico && op.revisar ? ' Las revisiones se registran en <a href="' + op.revisar + '">Revisar</a>.' : '');
      return '<div class="vf-lista">' +
        '<div class="vf-cab"><label class="eq-dia">Día <input type="date" data-vf-dia value="' + esc(dia) + '" max="' + esc(d.hoy) + '"' + (dias.length ? ' min="' + esc(dias[0]) + '"' : ' disabled') + '></label>' +
          (hoy ? '' : '<button type="button" class="btn sec chico" data-vf-hoy>Volver a hoy</button>') + '<div class="vf-resumen">' + resumen + '</div></div>' +
        '<p class="ayuda">' + nota + '</p>' + (st.aviso ? '<div class="aviso mal">' + esc(st.aviso) + '</div>' : '') +
        grupos.map(g => {
          const v0 = g.puntos[0]._v, per = v0.periodo && !esDia(v0.periodo) ? ' <span>· ' + esc(periodoTexto(v0.periodo)) + '</span>' : '';
          return '<h4 class="eq-frec">' + esc(g.grupo) + per + '</h4><ul class="vf-puntos">' + g.puntos.map(x => punto(x._v, puedeMarcar, soloLectura)).join('') + '</ul>';
        }).join('') + '</div>';
    }

    async function guardar(orden, resultado, nota) {
      const f = ficha(), puesto = id(), k = String(orden);
      st.guardando = k; st.aviso = ''; op.repintar();
      try {
        const r = (await Datos.equipo.marcar(puesto, [{ orden: +orden, resultado, nota }])).resultado;
        f.marcas = (f.marcas || []).concat(r.marcas || []);
        st.abierta = null; st.nota = '';
        Marca.toast(resultado === EJECUTADO ? 'Marcado: Ejecutado' : 'Marcado: ' + resultado);
      } catch (e) {
        if (e.codigo === 'sesion') { op.aLogin(); return; }
        st.aviso = e.codigo === 'incierto' || e.codigo === 'red' ? 'No llegó la respuesta. Vuelve a abrir la lista: si se guardó, ya aparece marcado.' : e.message;
      } finally { st.guardando = ''; op.repintar('[data-vf-punto="' + k + '"] button:not([disabled])'); }
    }

    async function quitar(orden, fecha) {
      const f = ficha(), puesto = id(), k = String(orden);
      st.guardando = k; st.aviso = ''; op.repintar();
      try {
        const r = (await Datos.equipo.desmarcar(puesto, +orden, fecha)).resultado;
        f.marcas = (f.marcas || []).concat(r.marca ? [r.marca] : []);
        Marca.toast('Marca quitada');
      } catch (e) {
        if (e.codigo === 'sesion') { op.aLogin(); return; }
        st.aviso = e.codigo === 'incierto' || e.codigo === 'red' ? 'No llegó la respuesta. Vuelve a abrir la lista para ver si se quitó.' : e.message;
      } finally { st.guardando = ''; op.repintar('[data-vf-punto="' + k + '"] button:not([disabled])'); }
    }

    return {
      html,
      reiniciar() { st.dia = ''; st.abierta = null; st.nota = ''; st.aviso = ''; },
      clic(ev) {
        const b = ev.target.closest('[data-vf-marcar],[data-vf-quitar],[data-vf-cancelar],[data-vf-hoy]');
        if (!b) return false;
        if (st.guardando) return true;
        if (b.dataset.vfHoy !== undefined) { st.dia = ''; op.repintar('[data-vf-dia]'); return true; }
        if (b.dataset.vfCancelar !== undefined) { const k = st.abierta && st.abierta.orden; st.abierta = null; st.nota = ''; op.repintar('[data-vf-punto="' + k + '"] button:not([disabled])'); return true; }
        if (b.dataset.vfQuitar) { const i = b.dataset.vfQuitar.indexOf('|'); quitar(b.dataset.vfQuitar.slice(0, i), b.dataset.vfQuitar.slice(i + 1)); return true; }
        const [orden, resultado] = b.dataset.vfMarcar.split('|'), x = ficha().lista.find(y => String(y.orden) === orden);
        // «No ejecutado» pide el motivo; por evento, siempre la nota. «Ejecutado» se guarda al tocar.
        if (x && (x.evento || resultado === NO_EJECUTADO)) { st.abierta = { orden, resultado }; st.nota = ''; st.aviso = ''; op.repintar('[data-vf-nota-txt]'); }
        else guardar(orden, resultado, '');
        return true;
      },
      enviar(ev) {
        const fm = ev.target.closest && ev.target.closest('form[data-vf-nota]');
        if (!fm) return false;
        ev.preventDefault();
        const nota = (fm.querySelector('[data-vf-nota-txt]').value || '').trim();
        if (!nota) { st.aviso = 'Escribe la nota: es obligatoria.'; op.repintar('[data-vf-nota-txt]'); return true; }
        if (!st.guardando && st.abierta) guardar(st.abierta.orden, st.abierta.resultado, nota);
        return true;
      },
      cambio(ev) {
        if (!ev.target.matches('[data-vf-dia]')) return false;
        const v = ev.target.value;
        st.dia = v && D().calendario && D().calendario[v] ? v : ''; st.abierta = null;
        op.repintar('[data-vf-dia]');
        return true;
      },
      entrada(ev) { if (!ev.target.matches('[data-vf-nota-txt]')) return false; st.nota = ev.target.value; return true; }
    };
  }

  window.Verificacion = { crear, estados, enPie, periodoEn, periodoTexto, resumenHoy, hora12 };
})();
