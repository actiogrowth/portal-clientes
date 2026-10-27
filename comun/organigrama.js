/* ==========================================================================
   Vida en Arte · Procesos › Equipo: organigrama y ficha del puesto
   (26-oct; 26-oct: árbol que se mueve y se acerca, lista en celular y ficha
   centrada)

   Lo usa /procesos/#equipo. Habla solo con Datos.equipo (→ /equipo/api.php),
   que ya manda recortado lo que ve esta persona: el organigrama con el nombre
   y el área de cada puesto y SOLO las fichas que le tocan. Esta pantalla no
   decide nada de permisos: si una ficha no llegó, no existe aquí.

     Organigrama.mostrar(el, { alTitulo(titulo, sub) })

   El organigrama sale de la pestaña Puestos («Reporta a»):
   · Computador y tablet (más de 640 px): un árbol real. Arriba el puesto sin
     «Reporta a» (Dirección); debajo, en UNA fila, los que le reportan (las
     áreas), y bajo cada uno sus puestos, con sangría por nivel. Cada puesto
     se une a su jefe con una línea del color del área. Se arrastra para
     moverlo, la rueda o el pellizco acercan y alejan, y hay botones − / + /
     «Ajustar».
   · Celular: una lista por áreas que se despliega (Dirección arriba; cada
     área con su color y su conteo; al tocarla, sus puestos con sangría).
   · La ficha se abre CENTRADA en un <dialog> (lo de atrás queda desenfocado);
     se cierra con la X, Esc o tocando afuera, y el foco no sale de ella
     mientras está abierta. En celular ocupa toda la pantalla.
   Colores por Área con texto blanco o negro que pasa AA. Estados: Por cargar
   → «En construcción» (borde punteado), Borrador, Validado, Abierto al equipo.
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => Marca.esc(s), norm = s => Marca.normal(s);
  const ABIERTO = 'Abierto al equipo';
  /* Color de cada Área: fondo de la tarjeta de cabeza (con su texto, AA) y
     color de sus líneas (3:1 o más sobre blanco: el naranja de la marca no
     llega, así que sus líneas van en un naranja más oscuro). */
  const AREAS = {
    'direccion':      { fondo: '#111111', texto: '#FFFFFF', linea: '#111111' },
    'comercial':      { fondo: '#1E7A3C', texto: '#FFFFFF', linea: '#1E7A3C' },
    'administracion': { fondo: '#6B6B6B', texto: '#FFFFFF', linea: '#6B6B6B' },
    'preschool':      { fondo: '#1974A8', texto: '#FFFFFF', linea: '#1974A8' },
    'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' },
    'veranito':       { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' }
  };
  const colorArea = a => AREAS[norm(a)] || { fondo: '#555555', texto: '#FFFFFF', linea: '#555555' };
  const FRECUENCIAS = ['Diario', 'Semanal', 'Mensual', 'Por temporada', 'Cuando aplica', 'Por persona nueva'];
  const estadoVisible = e => norm(e) === 'por cargar' ? 'En construcción' : e;
  /* Medidas del árbol (px, antes del zoom). */
  const M = { ancho: 224, sep: 28, alto: 74, altoCab: 86, altoRaiz: 62, paso: 10, sangria: 18, bajada: 30, margen: 28 };
  const ZOOM_MIN = 0.3, ZOOM_MAX = 1.6, CELULAR = '(max-width: 640px)';

  let D = null, el = null, op = {}, sel = '', pestana = 'contrato', cargando = false, aviso = '';
  let dlg = null, origen = null, modo = '', abiertas = {}, vista = { x: 0, y: 0, s: 1 }, mundo = null, lienzo = null, ajustado = false;

  async function cargar() {
    cargando = true;
    try { D = (await Datos.equipo.leer()).resultado; }
    catch (e) {
      cargando = false;
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      el.innerHTML = '<div class="pantalla"><h2>No se pudo leer el equipo</h2><p>La página no muestra nada hasta poder leer los datos.</p><pre>' + esc(e.message) +
        '</pre><button class="btn" type="button" data-eq-reintentar>Reintentar</button></div>';
      return;
    }
    cargando = false;
    pintar();
  }

  /* ── Estructura (sin pantalla: se prueba con node) ─────────────────────── */

  /** Raíz, columnas (los que le reportan a la raíz, cada uno con sus dependientes y a quién cuelgan) y raíces sueltas. */
  function arbol(ps) {
    const porId = Object.fromEntries(ps.map(p => [p.id, p]));
    const hijos = id => ps.filter(p => p.reportaA === id);
    const raices = ps.filter(p => !p.reportaA || !porId[p.reportaA]);
    const raiz = raices[0] || null;
    const bajo = (id, nivel, vistos) => hijos(id).filter(p => !vistos.has(p.id)).flatMap(p => { vistos.add(p.id); return [{ p, nivel, padre: id }].concat(bajo(p.id, nivel + 1, vistos)); });
    const vistos = new Set(raiz ? [raiz.id] : []);
    const cabs = raiz ? hijos(raiz.id) : [];
    cabs.forEach(c => vistos.add(c.id));
    const columnas = cabs.map(cab => ({ cab, puestos: bajo(cab.id, 0, vistos) }));
    const otros = raices.slice(1).map(cab => { vistos.add(cab.id); return { cab, puestos: bajo(cab.id, 0, vistos), suelta: true }; });
    return { raiz, columnas: columnas.concat(otros) };
  }

  /** Posición de cada tarjeta y trazo de cada línea. Las cabezas (las áreas) quedan todas en la MISMA fila. */
  function disponer(a) {
    const nodos = [], lineas = [];
    const n = a.columnas.length, ancho = Math.max(M.ancho, n * M.ancho + Math.max(0, n - 1) * M.sep) + 2 * M.margen;
    const yCab = M.margen + (a.raiz ? M.altoRaiz + 2 * M.bajada : 0);
    let alto = yCab;
    if (a.raiz) nodos.push({ id: a.raiz.id, tipo: 'raiz', x: ancho / 2 - M.ancho / 2, y: M.margen, w: M.ancho, h: M.altoRaiz, area: a.raiz.area });
    const xs = a.columnas.map((c, i) => M.margen + i * (M.ancho + M.sep));
    if (a.raiz && n) {
      const yBus = M.margen + M.altoRaiz + M.bajada, centros = xs.map(x => x + M.ancho / 2);
      lineas.push({ d: 'M' + ancho / 2 + ' ' + (M.margen + M.altoRaiz) + 'V' + yBus, color: colorArea(a.raiz.area).linea });
      if (n > 1) lineas.push({ d: 'M' + centros[0] + ' ' + yBus + 'H' + centros[n - 1], color: colorArea(a.raiz.area).linea });
      a.columnas.forEach((c, i) => { if (!c.suelta) lineas.push({ d: 'M' + centros[i] + ' ' + yBus + 'V' + yCab, color: colorArea(c.cab.area).linea }); });
    }
    a.columnas.forEach((c, i) => {
      const area = c.cab.area, color = colorArea(area).linea, pos = {};
      const cab = { id: c.cab.id, tipo: 'cab', x: xs[i], y: yCab, w: M.ancho, h: M.altoCab, area };
      nodos.push(cab); pos[cab.id] = cab;
      let y = yCab + M.altoCab + M.paso;
      c.puestos.forEach(x => {
        const sang = M.sangria * (x.nivel + 1);
        const nd = { id: x.p.id, tipo: 'puesto', x: xs[i] + sang, y, w: M.ancho - sang, h: M.alto, area, nivel: x.nivel, padre: x.padre };
        nodos.push(nd); pos[nd.id] = nd;
        const pa = pos[x.padre];
        // Del borde izquierdo del jefe, baja hasta la mitad del puesto y entra por su izquierda.
        if (pa) lineas.push({ d: 'M' + (pa.x + 10) + ' ' + (pa.y + pa.h) + 'V' + (y + M.alto / 2) + 'H' + nd.x, color });
        y += M.alto + M.paso;
      });
      alto = Math.max(alto, y);
    });
    return { nodos, lineas, ancho, alto: alto + M.margen };
  }

  /** «3 puestos · 2 en borrador» (con todo); «4 puestos · en construcción» si nada está más avanzado. */
  function conteo(ps) {
    const de = e => ps.filter(p => norm(p.estado) === norm(e)).length;
    const partes = [[de('Borrador'), 'en borrador', 'en borrador'], [de('Validado'), 'validado', 'validados'], [de(ABIERTO), 'abierto', 'abiertos']]
      .filter(x => x[0]).map(x => x[0] + ' ' + (x[0] === 1 ? x[1] : x[2]));
    return ps.length + (ps.length === 1 ? ' puesto' : ' puestos') + ' · ' + (partes.length ? partes.join(' · ') : 'en construcción');
  }

  /* ── Pantalla ─────────────────────────────────────────────────────────── */

  function chip(estado, sobreColor) {
    const e = norm(estado), cls = e === norm(ABIERTO) ? 'abierto' : e === 'validado' ? 'validado' : e === 'borrador' ? 'borrador' : 'construccion';
    return '<span class="eq-chip ' + cls + (sobreColor ? ' sobre' : '') + '">' + esc(estadoVisible(estado)) + '</span>';
  }

  /* Un puesto: botón si su ficha llegó (se puede abrir); si no, solo el nombre. */
  function tarjeta(p, tipo, area, estilo) {
    const c = colorArea(area), constr = norm(estadoVisible(p.estado)) === 'en construccion', relleno = tipo !== 'puesto';
    const nota = p.cantidad ? '<span class="eq-nota">' + esc(p.cantidad) + '</span>' : '';
    const color = relleno ? 'background:' + c.fondo + ';color:' + c.texto : (constr ? '' : '--eq-borde:' + c.linea);
    const clases = 'eq-puesto ' + tipo + (constr && !relleno ? ' construccion' : '') + (p.id === sel ? ' activo' : '');
    const cuerpo = '<span class="eq-nombre">' + esc(p.puesto) + '</span><span class="eq-fila">' + chip(p.estado, relleno) + nota + '</span>';
    const st = ' style="' + color + (estilo ? ';' + estilo : '') + '"';
    return p.ficha
      ? '<button type="button" class="' + clases + '"' + st + ' data-eq-puesto="' + esc(p.id) + '" aria-haspopup="dialog">' + cuerpo + '</button>'
      : '<div class="' + clases + '"' + st + '>' + cuerpo + '</div>';
  }

  function leyenda() {
    return '<div class="eq-leyenda">' + (D.yo.todo ? '<span><i class="borrador"></i>Borrador: cargado, pendiente de validar</span><span><i class="validado"></i>Validado</span>' : '') +
      '<span><i class="construccion"></i>En construcción</span><span><i class="abierto"></i>Abierto al equipo</span></div>';
  }

  function pintar() {
    if (!D) return;
    modo = window.matchMedia && window.matchMedia(CELULAR).matches ? 'lista' : 'arbol';
    const a = arbol(D.puestos);
    el.innerHTML = (D.faltan && D.faltan.length ? '<div class="aviso ojo">En el Sheet faltan: ' + esc(D.faltan.join(' · ')) + '.</div>' : '') +
      (modo === 'lista' ? listaHtml(a) : arbolHtml(a));
    if (modo === 'arbol') prepararLienzo();
  }

  function arbolHtml(a) {
    const L = disponer(a), porId = Object.fromEntries(D.puestos.map(p => [p.id, p]));
    const svg = '<svg class="eq-lineas" width="' + L.ancho + '" height="' + L.alto + '" viewBox="0 0 ' + L.ancho + ' ' + L.alto + '" aria-hidden="true">' +
      L.lineas.map(l => '<path d="' + l.d + '" stroke="' + l.color + '"/>').join('') + '</svg>';
    const nodos = L.nodos.map(n => tarjeta(porId[n.id], n.tipo, n.area, 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px')).join('');
    const boton = (k, t, etq) => '<button type="button" class="btn-circulo" data-eq-zoom="' + k + '" aria-label="' + etq + '">' + t + '</button>';
    return '<div class="eq-org vidrio-tarjeta">' +
      '<div class="eq-lienzo" role="region" aria-label="Organigrama. Se arrastra para moverlo; la rueda o el pellizco acercan y alejan.">' +
        '<div class="eq-mundo" style="width:' + L.ancho + 'px;height:' + L.alto + 'px">' + svg + nodos + '</div></div>' +
      '<div class="eq-pie"><div class="eq-zoom" role="group" aria-label="Acercar o alejar">' + boton('-', '−', 'Alejar') + boton('+', '+', 'Acercar') +
        '<button type="button" class="btn sec chico" data-eq-zoom="ajustar">Ajustar</button></div>' + leyenda() + '</div></div>';
  }

  function listaHtml(a) {
    const raiz = a.raiz ? '<div class="eq-lista-raiz">' + tarjeta(a.raiz, 'raiz', a.raiz.area) + '</div>' : '';
    const areas = a.columnas.map(c => {
      const todos = [c.cab].concat(c.puestos.map(x => x.p)), abierta = !!abiertas[c.cab.id], col = colorArea(c.cab.area);
      const id = 'eq-area-' + esc(c.cab.id);
      return '<li class="eq-area" style="--eq-color:' + col.linea + '">' +
        '<button type="button" class="eq-area-cab" data-eq-area="' + esc(c.cab.id) + '" aria-expanded="' + abierta + '" aria-controls="' + id + '">' +
          '<i class="eq-punto" style="background:' + col.fondo + '" aria-hidden="true"></i><span class="eq-area-txt"><b>' + esc(c.cab.puesto) + '</b><small>' + esc(conteo(todos)) + '</small></span>' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="' + (abierta ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6') + '"/></svg></button>' +
        '<div class="eq-area-cuerpo' + (abierta ? '' : ' oculto') + '" id="' + id + '">' +
          [{ p: c.cab, nivel: -1 }].concat(c.puestos).map(x => tarjeta(x.p, 'puesto', c.cab.area, 'margin-left:' + (x.nivel + 1) * 14 + 'px')).join('') + '</div></li>';
    }).join('');
    return '<div class="eq-org eq-org-lista vidrio-tarjeta">' + raiz + '<ul class="eq-areas">' + areas + '</ul>' + leyenda() + '</div>';
  }

  /* ── Mover y acercar ──────────────────────────────────────────────────── */

  function aplicar() { if (mundo) mundo.style.transform = 'translate(' + Math.round(vista.x) + 'px,' + Math.round(vista.y) + 'px) scale(' + vista.s.toFixed(3) + ')'; }
  function medidas() { return { vw: lienzo.clientWidth, vh: lienzo.clientHeight, W: mundo.offsetWidth, H: mundo.offsetHeight }; }
  /* Que el árbol no se vaya del todo: siempre quedan 80 px a la vista. */
  function limitar() {
    const { vw, vh, W, H } = medidas(), q = 80;
    vista.x = Math.min(vw - q, Math.max(q - W * vista.s, vista.x));
    vista.y = Math.min(vh - q, Math.max(q - H * vista.s, vista.y));
  }
  function ajustar() {
    if (!lienzo) return;
    const { vw, vh, W, H } = medidas();
    vista.s = Math.max(ZOOM_MIN, Math.min(1, (vw - 16) / W, (vh - 16) / H));
    vista.x = (vw - W * vista.s) / 2; vista.y = Math.max(8, (vh - H * vista.s) / 2);
    aplicar();
  }
  /* Acercar o alejar dejando quieto el punto (px, py) del lienzo. */
  function zoom(f, px, py) {
    const s = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vista.s * f)), k = s / vista.s;
    if (px === undefined) { px = lienzo.clientWidth / 2; py = lienzo.clientHeight / 2; }
    vista.x = px - (px - vista.x) * k; vista.y = py - (py - vista.y) * k; vista.s = s;
    limitar(); aplicar();
  }

  function prepararLienzo() {
    lienzo = el.querySelector('.eq-lienzo'); mundo = el.querySelector('.eq-mundo');
    // Oculto (la vista todavía no se muestra) no tiene medidas: se ajusta al mostrarlo.
    if (!lienzo.clientWidth) return;
    if (!ajustado) { ajustar(); ajustado = true; } else { limitar(); aplicar(); }
    const punteros = new Map();
    let inicio = null, pellizco = null, movido = false;
    const local = e => { const r = lienzo.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    lienzo.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      punteros.set(e.pointerId, local(e));
      movido = false;
      if (punteros.size === 1) inicio = { p: local(e), x: vista.x, y: vista.y, id: e.pointerId };
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), s: vista.s }; }
    });
    lienzo.addEventListener('pointermove', e => {
      if (!punteros.has(e.pointerId)) return;
      const p = local(e); punteros.set(e.pointerId, p);
      if (punteros.size >= 2 && pellizco) {
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pellizco.d > 0) zoom(pellizco.s * d / pellizco.d / vista.s, (a.x + b.x) / 2, (a.y + b.y) / 2);
        movido = true; return;
      }
      if (!inicio) return;
      const dx = p.x - inicio.p.x, dy = p.y - inicio.p.y;
      // Hasta 6 px es un toque (abre la ficha); desde ahí, arrastrar.
      if (!movido && Math.hypot(dx, dy) < 6) return;
      if (!movido) { movido = true; lienzo.setPointerCapture && lienzo.setPointerCapture(e.pointerId); lienzo.classList.add('arrastrando'); }
      vista.x = inicio.x + dx; vista.y = inicio.y + dy; limitar(); aplicar();
    });
    const soltar = e => {
      punteros.delete(e.pointerId);
      if (punteros.size < 2) pellizco = null;
      if (!punteros.size) { inicio = null; lienzo.classList.remove('arrastrando'); }
      if (movido) { lienzo.dataset.arrastre = '1'; setTimeout(() => { delete lienzo.dataset.arrastre; }, 0); }
    };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
    lienzo.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });
    // Con el teclado: el puesto que recibe el foco se trae a la vista.
    lienzo.addEventListener('focusin', e => {
      const b = e.target.closest('[data-eq-puesto]');
      if (!b) return;
      const r = lienzo.getBoundingClientRect(), q = b.getBoundingClientRect();
      if (q.left < r.left || q.right > r.right || q.top < r.top || q.bottom > r.bottom) {
        vista.x += (r.left + r.width / 2) - (q.left + q.width / 2); vista.y += (r.top + r.height / 2) - (q.top + q.height / 2); limitar(); aplicar();
      }
    });
  }

  /* ── Ficha (centrada, en un <dialog>) ─────────────────────────────────── */

  function fichaHtml(id) {
    const p = D.puestos.find(x => x.id === id), f = D.fichas[id], jefe = D.puestos.find(x => x.id === p.reportaA);
    const lista = (t, l) => l.length ? '<ol class="eq-ol">' + l.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '<p class="ayuda">Sin ' + t + ' cargado todavía.</p>';
    const c = f.contrato;
    const contrato = '<div class="eq-bloque"><h3>Resultado que produce</h3>' + (c.resultado.length ? c.resultado.map(x => '<p class="eq-resultado">' + esc(x) + '</p>').join('') : '<p class="ayuda">Sin resultado cargado todavía.</p>') + '</div>' +
      '<details open class="eq-det"><summary>Trabajo del que es responsable · ' + c.trabajo.length + '</summary>' + lista('trabajo', c.trabajo) + '</details>' +
      '<details class="eq-det"><summary>Estándares con que se evalúa · ' + c.estandares.length + '</summary>' + lista('estándar', c.estandares) + '</details>';
    const grupos = FRECUENCIAS.concat([...new Set(f.lista.map(x => x.frecuencia))].filter(x => !FRECUENCIAS.includes(x)))
      .map(fr => ({ fr, puntos: f.lista.filter(x => x.frecuencia === fr) })).filter(g => g.puntos.length);
    const listaV = (f.verifica ? '<p class="eq-verifica"><b>Verifica:</b> ' + esc(f.verifica) + (f.comoVerifica ? '<br><b>Cómo:</b> ' + esc(f.comoVerifica) : '') + '</p>' : '') +
      (grupos.length ? grupos.map(g => '<h3 class="eq-frec">' + esc(g.fr) + '</h3><ul class="eq-puntos">' + g.puntos.map(x =>
        '<li><span>' + esc(x.texto) + '</span>' + (x.evidencia ? '<span class="ayuda">Evidencia: ' + esc(x.evidencia) + '</span>' : '') + '</li>').join('') + '</ul>').join('')
        : '<p class="ayuda">Sin lista de verificación cargada todavía.</p>');
    const procesos = f.procesos.length ? '<ul class="eq-puntos">' + f.procesos.map((x, i) => '<li><span><b>' + esc(x.proceso) + '</b>' + (x.estado ? ' <span class="eq-chip construccion">' + esc(x.estado) + '</span>' : '') + '</span>' +
        (x.descripcion ? '<span class="ayuda">' + esc(x.descripcion) + '</span>' : '') +
        (x.enlace && window.Visor && Visor.vista(x.enlace).modo !== 'nada' ? '<button type="button" class="pa-boton" data-eq-proceso="' + i + '">Abrir</button>' : '') + '</li>').join('') + '</ul>'
      : '<p class="ayuda">Todavía no hay procesos cargados para este puesto.</p>';
    const cuerpo = pestana === 'lista' ? listaV : pestana === 'procesos' ? procesos : contrato;
    const tab = (k, t) => '<button type="button" role="tab" aria-selected="' + (pestana === k) + '" data-eq-pestana="' + k + '">' + t + '</button>';
    const chips = [jefe ? 'Reporta a ' + jefe.puesto : '', f.unidad].filter(Boolean).map(x => '<span class="eq-pill">' + esc(x) + '</span>').join('') +
      '<span class="eq-pill oscuro">' + esc(estadoVisible(p.estado)) + (f.version !== null && f.version !== undefined ? ' · versión ' + esc(f.version) : '') + '</span>';
    return '<div class="eq-ficha"><div class="eq-ficha-cab"><div><span class="eq-sobre">Contrato de posición</span><h2 class="titulo" id="eqFichaTit">' + esc(p.puesto) + '</h2></div>' +
      '<button type="button" class="btn-circulo" data-eq-cerrar aria-label="Cerrar la ficha"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="eq-pills">' + chips + '</div>' +
      '<div class="eq-tabs" role="tablist" aria-label="Partes de la ficha">' + tab('contrato', 'Contrato') + tab('lista', 'Lista de verificación') + tab('procesos', 'Procesos') + '</div>' +
      '<div class="eq-cuerpo">' + cuerpo + '</div>' + aceptarHtml(p, f) + '</div>';
  }

  /* Aceptar el contrato: solo quien ocupa el puesto y solo «Abierto al equipo» (el servidor lo vuelve a mirar). */
  function aceptarHtml(p, f) {
    const abierto = norm(p.estado) === norm(ABIERTO);
    if (!f.ocupo || !abierto) {
      return D.yo.todo && !abierto ? '<div class="eq-aceptar gris"><p>Cuando el puesto esté «Abierto al equipo», quien lo ocupa lee aquí el contrato y lo acepta. Queda registrado con su usuario, la fecha y la versión.</p></div>' : '';
    }
    if (f.aceptada) return '<div class="eq-aceptar ok"><p>Aceptaste la versión ' + esc(f.version) + ' de este contrato.</p></div>';
    const nueva = f.aceptadaVersion !== null && f.aceptadaVersion !== undefined;
    return '<div class="eq-aceptar"><p>' + (nueva ? '<b>Hay una versión nueva de tu contrato</b> (aceptaste la ' + esc(f.aceptadaVersion) + '). Léela y acéptala.' : 'Lee tu contrato y acéptalo. Queda registrado con tu usuario, la fecha y la versión.') + '</p>' +
      (aviso ? '<div class="aviso mal">' + esc(aviso) + '</div>' : '') +
      '<button type="button" class="btn negro" data-eq-aceptar>Acepto el contrato · versión ' + esc(f.version) + '</button></div>';
  }

  /** Lo que se puede enfocar dentro de la ficha, en orden. */
  const enfocables = () => [...dlg.querySelectorAll('button:not([disabled]), [href], summary, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);

  function crearDialogo() {
    dlg = document.createElement('dialog');
    dlg.className = 'eq-dialogo';
    dlg.setAttribute('aria-labelledby', 'eqFichaTit');
    document.body.appendChild(dlg);
    dlg.addEventListener('click', ev => { if (ev.target === dlg) { cerrarFicha(); return; } clic(ev); });   // tocar afuera (el fondo) cierra
    dlg.addEventListener('cancel', ev => { ev.preventDefault(); cerrarFicha(); });                       // Esc
    dlg.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); cerrarFicha(); return; }
      if (ev.key !== 'Tab') return;
      // El foco no sale de la ficha mientras está abierta.
      const f = enfocables();
      if (!f.length) { ev.preventDefault(); return; }
      const primero = f[0], ultimo = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === primero || !dlg.contains(document.activeElement))) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && (document.activeElement === ultimo || !dlg.contains(document.activeElement))) { ev.preventDefault(); primero.focus(); }
    });
  }

  function abrirFicha(id, desde) {
    if (!D.fichas[id]) return;
    sel = id; pestana = 'contrato'; aviso = ''; origen = desde || null;
    if (!dlg) crearDialogo();
    dlg.innerHTML = fichaHtml(id);
    if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); }
    document.body.classList.add('eq-ficha-abierta');
    dlg.scrollTop = 0;
    const x = dlg.querySelector('[data-eq-cerrar]'); if (x) x.focus();
  }
  function repintarFicha(foco) {
    if (!dlg || !sel) return;
    dlg.innerHTML = fichaHtml(sel);
    const f = foco && dlg.querySelector(foco); if (f) f.focus();
  }
  function cerrarFicha() {
    if (!dlg) return;
    sel = ''; aviso = '';
    if (dlg.open) { dlg.close ? dlg.close() : dlg.removeAttribute('open'); }
    document.body.classList.remove('eq-ficha-abierta');
    // El foco vuelve al puesto que la abrió (aunque se haya repintado).
    const id = origen && origen.dataset ? origen.dataset.eqPuesto : '';
    const v = (origen && document.contains(origen)) ? origen : (id && el.querySelector('[data-eq-puesto="' + id + '"]'));
    if (v) v.focus({ preventScroll: true });
  }

  function clic(ev) {
    const b = ev.target.closest('[data-eq-puesto],[data-eq-cerrar],[data-eq-pestana],[data-eq-aceptar],[data-eq-proceso],[data-eq-reintentar],[data-eq-zoom],[data-eq-area]');
    if (!b) return;
    if (b.dataset.eqReintentar !== undefined) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2></div>'; cargar(); return; }
    if (b.dataset.eqZoom) { if (b.dataset.eqZoom === 'ajustar') ajustar(); else zoom(b.dataset.eqZoom === '+' ? 1.25 : 0.8); return; }
    if (b.dataset.eqArea) { abiertas[b.dataset.eqArea] = !abiertas[b.dataset.eqArea]; pintar(); const v = el.querySelector('[data-eq-area="' + b.dataset.eqArea + '"]'); if (v) v.focus(); return; }
    if (b.dataset.eqPuesto) { if (lienzo && lienzo.dataset.arrastre) return; abrirFicha(b.dataset.eqPuesto, b); return; }
    if (b.dataset.eqCerrar !== undefined) { cerrarFicha(); return; }
    if (b.dataset.eqPestana) { pestana = b.dataset.eqPestana; repintarFicha('[data-eq-pestana="' + pestana + '"]'); return; }
    if (b.dataset.eqProceso !== undefined) {
      const x = D.fichas[sel].procesos[+b.dataset.eqProceso];
      VisorPantalla.abrir(x.proceso, D.puestos.find(p => p.id === sel).puesto, [{ version: Visor.version(x.proceso, x.enlace), nombre: x.proceso, enlace: x.enlace }]);
      return;
    }
    if (b.dataset.eqAceptar !== undefined) aceptar(b);
  }

  async function aceptar(b) {
    const f = D.fichas[sel], id = sel;
    b.disabled = true; b.textContent = 'Guardando…'; aviso = '';
    try { await Datos.equipo.aceptar(id, f.version); Marca.toast('Contrato aceptado'); await cargar(); if (D && D.fichas[id]) { sel = id; repintarFicha('[data-eq-cerrar]'); } }
    catch (e) {
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      aviso = e.codigo === 'version_vieja' ? 'El contrato cambió mientras lo leías. Ya está la versión nueva: léela y vuelve a aceptar.' : e.message;
      if (e.codigo === 'version_vieja') { await cargar(); sel = id; }
      repintarFicha('[data-eq-aceptar]');
    }
  }

  function mostrar(contenedor, opciones) {
    if (el !== contenedor) {
      el = contenedor; el.addEventListener('click', clic);
      // Al pasar de celular a tablet (o al girarla) se cambia de lista a árbol.
      if (window.matchMedia) {
        const mq = window.matchMedia(CELULAR), cambio = () => { if (D && el && !el.closest('.oculto')) { ajustado = false; pintar(); } };
        if (mq.addEventListener) mq.addEventListener('change', cambio); else if (mq.addListener) mq.addListener(cambio);
      }
      // Si cambia el tamaño de la pantalla (girar la tablet), el árbol se vuelve a ajustar.
      let espera = null;
      window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { if (modo === 'arbol' && lienzo && document.contains(lienzo) && lienzo.clientWidth) ajustar(); }, 150); });
    }
    op = opciones || {};
    if (op.alTitulo) op.alTitulo('Equipo', 'Quién hace qué, cómo se mide y cómo se verifica. Toca un puesto para ver su ficha.');
    if (D) pintar();
    else if (!cargando) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2><p>Leyendo los puestos de Vida en Arte.</p></div>'; cargar(); }
  }

  window.Organigrama = { mostrar, _arbol: arbol, _disponer: disponer, _conteo: conteo, _medidas: M };
})();
