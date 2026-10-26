/* ==========================================================================
   Vida en Arte · Procesos › Equipo: organigrama y ficha del puesto (26-oct)

   Lo usa /procesos/ (vista «Por equipo»). Habla solo con Datos.equipo
   (→ /equipo/api.php), que ya manda recortado lo que ve esta persona: el
   organigrama con el nombre y el área de cada puesto y SOLO las fichas que le
   tocan. Esta pantalla no decide nada de permisos: si una ficha no llegó, no
   existe aquí.

     Organigrama.mostrar(el, { alTitulo(titulo, sub), alRuta(ruta) })

   El organigrama sale de la pestaña Puestos: arriba el puesto sin «Reporta a»
   (Dirección); debajo, una columna por cada puesto que le reporta, con todos
   los que dependen de él. Colores por Área (texto blanco o negro con
   contraste AA). Estados: Por cargar → «En construcción» (borde punteado),
   Borrador, Validado, Abierto al equipo.
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => Marca.esc(s), norm = s => Marca.normal(s);
  const ABIERTO = 'Abierto al equipo';
  /* Color de cada Área (como la maqueta). El verde es más oscuro que el de la
     maqueta: con texto blanco, #2E9D4F no llega a 4,5:1 (#1E7A3C, 5,4:1). */
  const AREAS = {
    'direccion':      { fondo: '#111111', texto: '#FFFFFF' },
    'comercial':      { fondo: '#1E7A3C', texto: '#FFFFFF' },
    'administracion': { fondo: '#6B6B6B', texto: '#FFFFFF' },
    'preschool':      { fondo: '#1974A8', texto: '#FFFFFF' },
    'after school':   { fondo: '#FFA615', texto: '#111111' },
    'veranito':       { fondo: '#FFA615', texto: '#111111' }
  };
  const colorArea = a => AREAS[norm(a)] || { fondo: '#555555', texto: '#FFFFFF' };
  const FRECUENCIAS = ['Diario', 'Semanal', 'Mensual', 'Por temporada', 'Cuando aplica', 'Por persona nueva'];
  const estadoVisible = e => norm(e) === 'por cargar' ? 'En construcción' : e;

  let D = null, el = null, op = {}, sel = '', pestana = 'contrato', cargando = false, aviso = '';

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

  /* Columnas: los que reportan a la raíz, cada uno con todos sus dependientes (en el orden del Sheet). */
  function arbol() {
    const ps = D.puestos, porId = Object.fromEntries(ps.map(p => [p.id, p]));
    const hijos = id => ps.filter(p => p.reportaA === id);
    const raices = ps.filter(p => !p.reportaA || !porId[p.reportaA]);
    const raiz = raices[0] || null;
    const bajo = (id, nivel, vistos) => hijos(id).filter(p => !vistos.has(p.id)).flatMap(p => { vistos.add(p.id); return [{ p, nivel }].concat(bajo(p.id, nivel + 1, vistos)); });
    const columnas = raiz ? hijos(raiz.id).map(cab => ({ cab, puestos: bajo(cab.id, 0, new Set([raiz.id, cab.id])) })) : [];
    const otros = raices.slice(1);
    return { raiz, columnas, otros };
  }

  function chip(estado, sobreColor) {
    const e = norm(estado), cls = e === norm(ABIERTO) ? 'abierto' : e === 'validado' ? 'validado' : e === 'borrador' ? 'borrador' : 'construccion';
    return '<span class="eq-chip ' + cls + (sobreColor ? ' sobre' : '') + '">' + esc(estadoVisible(estado)) + '</span>';
  }

  /* Un puesto: botón si su ficha llegó (se puede abrir); si no, solo el nombre. */
  function tarjeta(p, cab, nivel) {
    const c = colorArea(cab ? p.area : (p.area || '')), constr = norm(estadoVisible(p.estado)) === 'en construccion';
    const nota = p.cantidad ? '<span class="eq-nota">' + esc(p.cantidad) + '</span>' : '';
    const estilo = cab ? 'background:' + c.fondo + ';color:' + c.texto : (constr ? '' : '--eq-borde:' + c.fondo);
    const clases = 'eq-puesto' + (cab ? ' cab' : '') + (constr ? ' construccion' : '') + (p.id === sel ? ' activo' : '') + (nivel ? ' n' + Math.min(nivel, 3) : '');
    const cuerpo = '<span class="eq-nombre">' + esc(p.puesto) + '</span>' + nota + chip(p.estado, cab);
    return p.ficha
      ? '<button type="button" class="' + clases + '" style="' + estilo + '" data-eq-puesto="' + esc(p.id) + '" aria-pressed="' + (p.id === sel) + '">' + cuerpo + '</button>'
      : '<div class="' + clases + '" style="' + estilo + '">' + cuerpo + '</div>';
  }

  function pintar() {
    if (!D) return;
    const { raiz, columnas, otros } = arbol();
    const leyenda = '<div class="eq-leyenda">' + (D.yo.todo ? '<span><i class="borrador"></i>Borrador: cargado, pendiente de validar</span><span><i class="validado"></i>Validado</span>' : '') +
      '<span><i class="construccion"></i>En construcción</span><span><i class="abierto"></i>Abierto al equipo</span></div>';
    const org = '<div class="eq-org vidrio-tarjeta">' +
      (raiz ? tarjeta(raiz, true, 0).replace('eq-puesto cab', 'eq-puesto cab raiz') + '<div class="eq-linea" aria-hidden="true"></div><div class="eq-linea-h" aria-hidden="true"></div>' : '') +
      '<div class="eq-columnas">' + columnas.map(col => '<div class="eq-columna"><div class="eq-linea corta" aria-hidden="true"></div>' + tarjeta(col.cab, true, 0) +
        col.puestos.map(x => tarjeta(Object.assign({}, x.p, { area: col.cab.area }), false, x.nivel)).join('') + '</div>').join('') +
        otros.map(p => '<div class="eq-columna">' + tarjeta(p, true, 0) + '</div>').join('') + '</div>' + leyenda + '</div>';
    const ficha = sel && D.fichas[sel] ? fichaHtml(sel) : '';
    el.innerHTML = (D.faltan && D.faltan.length ? '<div class="aviso ojo">En el Sheet faltan: ' + esc(D.faltan.join(' · ')) + '.</div>' : '') +
      '<div class="eq-vista' + (ficha ? ' con-ficha' : '') + '"><section class="eq-izq" aria-label="Organigrama">' + org + '</section>' + ficha + '</div>';
    if (ficha) { document.body.classList.toggle('eq-ficha-abierta', true); }
    else document.body.classList.remove('eq-ficha-abierta');
  }

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
    return '<aside class="eq-ficha vidrio-tarjeta" aria-label="Ficha del puesto"><div class="eq-ficha-cab"><div><span class="eq-sobre">Contrato de posición</span><h2 class="titulo">' + esc(p.puesto) + '</h2></div>' +
      '<button type="button" class="btn-circulo" data-eq-cerrar aria-label="Cerrar la ficha"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="eq-pills">' + chips + '</div>' +
      '<div class="eq-tabs" role="tablist" aria-label="Partes de la ficha">' + tab('contrato', 'Contrato') + tab('lista', 'Lista de verificación') + tab('procesos', 'Procesos') + '</div>' +
      '<div class="eq-cuerpo">' + cuerpo + '</div>' + aceptarHtml(p, f) + '</aside>';
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

  function clic(ev) {
    const b = ev.target.closest('[data-eq-puesto],[data-eq-cerrar],[data-eq-pestana],[data-eq-aceptar],[data-eq-proceso],[data-eq-reintentar]');
    if (!b || !el.contains(b)) return;
    if (b.dataset.eqReintentar !== undefined) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2></div>'; cargar(); return; }
    if (b.dataset.eqPuesto) { sel = b.dataset.eqPuesto; pestana = 'contrato'; aviso = ''; pintar(); const a = el.querySelector('.eq-ficha'); if (a) a.focus && a.querySelector('[data-eq-cerrar]').focus(); return; }
    if (b.dataset.eqCerrar !== undefined) { const antes = sel; sel = ''; pintar(); const v = el.querySelector('[data-eq-puesto="' + antes + '"]'); if (v) v.focus(); return; }
    if (b.dataset.eqPestana) { pestana = b.dataset.eqPestana; pintar(); const t = el.querySelector('[data-eq-pestana="' + pestana + '"]'); if (t) t.focus(); return; }
    if (b.dataset.eqProceso !== undefined) {
      const x = D.fichas[sel].procesos[+b.dataset.eqProceso];
      VisorPantalla.abrir(x.proceso, D.puestos.find(p => p.id === sel).puesto, [{ version: Visor.version(x.proceso, x.enlace), nombre: x.proceso, enlace: x.enlace }]);
      return;
    }
    if (b.dataset.eqAceptar !== undefined) aceptar(b);
  }

  async function aceptar(b) {
    const f = D.fichas[sel];
    b.disabled = true; b.textContent = 'Guardando…'; aviso = '';
    try { await Datos.equipo.aceptar(sel, f.version); Marca.toast('Contrato aceptado'); await cargar(); }
    catch (e) {
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      aviso = e.codigo === 'version_vieja' ? 'El contrato cambió mientras lo leías. Ya está la versión nueva: léela y vuelve a aceptar.' : e.message;
      if (e.codigo === 'version_vieja') await cargar(); else pintar();
    }
  }

  function mostrar(contenedor, opciones) {
    if (el !== contenedor) { el = contenedor; el.addEventListener('click', clic); document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && sel && el && !el.closest('.oculto')) { sel = ''; pintar(); } }); }
    op = opciones || {};
    if (op.alTitulo) op.alTitulo('Equipo de Vida en Arte', 'Quién hace qué, cómo se mide y cómo se verifica. Toca un puesto para ver su ficha.');
    if (D) pintar();
    else if (!cargando) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2><p>Leyendo los puestos de Vida en Arte.</p></div>'; cargar(); }
  }

  window.Organigrama = { mostrar };
})();
