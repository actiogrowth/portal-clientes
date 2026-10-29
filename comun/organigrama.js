/* ==========================================================================
   Vida en Arte · Procesos › Equipo: organigrama y ficha del puesto
   (26-oct; 29-oct: Equipo v2 — organigrama «Escenario 3D», ficha con el
   formato del contrato en papel, PDF, hoja diaria, Reglas del juego y
   Horarios del servicio)

   Lo usa /procesos/ (#equipo, #reglas, #horarios, #puesto=<ID>). Habla solo
   con Datos.equipo (→ /equipo/api.php), que ya manda recortado lo que ve
   esta persona: el organigrama con el nombre y el área de cada puesto y SOLO
   las fichas que le tocan. Esta pantalla no decide nada de permisos: si una
   ficha no llegó, no existe aquí; si el servidor no mandó la tabla de
   horarios, la sección no está.

     Organigrama.mostrar(el, { alTitulo(titulo, sub), vista, abrir })
       vista: 'org' (por defecto) | 'reglas' | 'horarios'; abrir: un ID de puesto
     Organigrama.salir()   la página dejó Equipo: se apaga la escena oscura

   El organigrama sale de la pestaña Puestos («Reporta a»; el orden de las
   áreas es el del Sheet; los colores, de comun/puestos.js):
   · Computador y tablet (más de 640 px): la escena oscura. Dirección arriba;
     las áreas (los puestos que le reportan) en columnas, cada una con la
     cabeza del color del área, su coordinación y el número de puestos; bajo
     cada una sus puestos, con sangría los que reportan a otro que no es la
     coordinación. Plano inclinado 7° con perspectiva, tarjetas con grosor
     (sombras escalonadas) que se levantan al pasar el cursor; «Por cargar»
     como vidrio translúcido con borde punteado. Se arrastra para moverlo, la
     rueda o el pellizco acercan, y hay − / + / «Ajustar».
     Movimiento: entrada en cascada (~2,5 s, una vez), y después una luz que
     recorre las líneas, chispas que suben (máx. 20) y el halo de Dirección.
     Solo se anima transform y opacity; se pausa con la pestaña oculta; con
     «reducir movimiento» todo queda quieto; con «reducir transparencia» (o
     sin desenfoque) el fondo es plano, sin foto ni animación.
   · Celular: una lista por áreas que se despliega, sin 3D.
   · La ficha se abre CENTRADA en un <dialog> (Esc, tocar afuera, foco
     atrapado). Tiene el formato del contrato en papel: «Contrato de
     posición», la tabla Puesto · Unidad · Reporta a, 1. Resultado,
     2. Trabajo, 3. Estándares, 4. Aceptación; debajo, la lista de
     verificación y la hoja diaria. Aceptar pasa antes por las Reglas del
     juego. «Descargar PDF» arma una hoja de impresión (Inter, títulos en
     verde, firma, nombre y fecha) y abre el diálogo de imprimir.
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => Marca.esc(s), norm = s => Marca.normal(s);
  const ABIERTO = 'Abierto al equipo';
  const colorArea = a => Puestos.colorArea(a);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const TEXTO_ACEPTACION = 'Acepto ser responsable de producir el resultado de esta posición, del trabajo y de los estándares con que se evalúa. Este contrato puede cambiar según las necesidades de Vida en Arte.';
  const estadoVisible = e => norm(e) === 'por cargar' ? 'En construcción' : e;
  const enConstruccion = p => norm(estadoVisible(p.estado)) === 'en construccion';
  /* Medidas de la escena (px, antes del zoom) y del movimiento. */
  // 30-oct: legible = la escala mínima con la que se lee el texto de las tarjetas (13 px × 0,85 ≈ 11 px);
  // tronco = dónde baja la línea que une las filas (a la izquierda de la primera columna).
  const M = { col: 210, sep: 16, margen: 24, bus: 56, sangria: 16, legible: 0.85, tronco: -12 };
  const ENTRADA = { dir: 0.15, lineas: 0.6, areas: 1.25, paso: 0.09, puestos: 1.7, puesto: 0.07, tope: 2.4, total: 2.6 };
  const CHISPAS = 16;   // máximo 20
  const ZOOM_MIN = 0.3, ZOOM_MAX = 1.6, CELULAR = '(max-width: 640px)';

  let D = null, el = null, op = {}, sel = '', paso = 'contrato', leyoReglas = false, cargando = false, aviso = '', porFila = 0;
  let dlg = null, origen = null, modo = '', abiertas = {}, vista = { x: 0, y: 0, s: 1 }, mundo = null, lienzo = null, ajustado = false;
  let entro = false, diaHoja = {}, avisoHoja = {}, guardandoPaso = '';

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
    if (op.abrir && D.fichas[op.abrir]) { const id = op.abrir; op.abrir = ''; abrirFicha(id, el.querySelector('[data-eq-puesto="' + id + '"]')); }
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

  /**
   * La escena: ancho, centro de cada columna, los trazos que bajan de
   * Dirección y el retraso de entrada de cada pieza (en segundos; la cascada
   * termina antes de ENTRADA.total).
   * 30-oct: porFila = cuántas áreas van en una fila (todas, si no se dice).
   * Con más de una fila, cada fila tiene su barra y todas cuelgan de un
   * tronco a la izquierda (M.tronco), que baja desde la barra de la primera
   * (su alto lo mide la pantalla: depende de lo alta que salga cada fila).
   */
  function escena(a, porFila) {
    const n = a.columnas.length, k = Math.max(1, Math.min(n || 1, porFila || n || 1));
    const ancho = k * M.col + Math.max(0, k - 1) * M.sep;
    const centroEn = j => j * (M.col + M.sep) + M.col / 2;
    const columnas = a.columnas.map((c, i) => ({
      cab: c.cab, suelta: !!c.suelta, color: colorArea(c.cab.area), cuantos: 1 + c.puestos.length, d: ENTRADA.areas + i * ENTRADA.paso,
      puestos: c.puestos.map((x, j) => ({ p: x.p, nivel: x.nivel, padre: x.padre, sangria: x.nivel * M.sangria,
        d: Math.min(ENTRADA.tope, ENTRADA.puestos + i * ENTRADA.paso + j * ENTRADA.puesto) }))
    }));
    const filas = [];
    for (let i = 0; i < n; i += k) filas.push({ columnas: columnas.slice(i, i + k), desde: i, lineas: [] });
    const varias = filas.length > 1, y = M.bus / 2 - 2;
    if (a.raiz) filas.forEach((f, r) => {
      // La barra une solo las áreas (los sueltos, al final, no cuelgan de Dirección).
      const areas = f.columnas.filter(c => !c.suelta).length;
      if (!areas) return;
      const ultimo = centroEn(areas - 1), desde = varias ? M.tronco : centroEn(0);
      if (r === 0) f.lineas.push({ tipo: 'v', x: ancho / 2, y: 0, largo: y, color: '#FFFFFF', d: ENTRADA.lineas });
      if (areas > 1 || varias) f.lineas.push({ tipo: 'h', x: desde, y, largo: ultimo - desde, color: '#FFFFFF', d: ENTRADA.lineas + 0.25 });
      f.columnas.forEach((c, j) => { if (!c.suelta) f.lineas.push({ tipo: 'v', x: centroEn(j), y, largo: M.bus / 2 + 2, color: c.color.fondo, d: ENTRADA.lineas + 0.5 + (f.desde + j) * 0.05 }); });
    });
    return { ancho, porFila: k, filas, varias, centros: filas.length ? filas[0].columnas.map((c, j) => centroEn(j)) : [], lineas: filas.flatMap(f => f.lineas), columnas };
  }

  /**
   * 30-oct: cuántas áreas por fila caben en `disponible` px con la letra legible
   * (escala ≥ M.legible): todas en una fila si se puede; si no, en 2, 3… filas
   * parejas. Así «Ajustar» encaja al ancho sin achicar el texto de más.
   */
  function porFilaPara(n, disponible) {
    if (!n || !disponible) return n || 1;
    const anchoDe = k => k * M.col + Math.max(0, k - 1) * M.sep + 2 * M.margen;
    for (let filas = 1; filas <= n; filas++) {
      const k = Math.ceil(n / filas);
      if ((disponible - 16) / anchoDe(k) >= M.legible) return k;
    }
    return 1;
  }

  /** «3 puestos · 2 en borrador» (con todo); «4 puestos · en construcción» si nada está más avanzado. */
  function conteo(ps) {
    const de = e => ps.filter(p => norm(p.estado) === norm(e)).length;
    const partes = [[de('Borrador'), 'en borrador', 'en borrador'], [de('Validado'), 'validado', 'validados'], [de(ABIERTO), 'abierto', 'abiertos']]
      .filter(x => x[0]).map(x => x[0] + ' ' + (x[0] === 1 ? x[1] : x[2]));
    return ps.length + (ps.length === 1 ? ' puesto' : ' puestos') + ' · ' + (partes.length ? partes.join(' · ') : 'en construcción');
  }

  /* ── Textos ───────────────────────────────────────────────────────────── */

  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  /** «2026-10-29T14:05» → «29 de octubre de 2026, 2:05 p. m.» */
  function hora12(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
    if (!m) return '';
    const h = +m[1];
    return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' a. m.' : ' p. m.');
  }
  function diaTexto(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? +m[3] + ' de ' + MESES[+m[2] - 1] + ' de ' + m[1] : iso; }
  const fechaHora = s => diaTexto(s) + (hora12(String(s).slice(11, 16)) ? ', ' + hora12(String(s).slice(11, 16)) : '');
  const horas = t => Puestos.etiquetasHora(t, D.momentos, esc);
  const quien = u => { const p = D.personas && D.personas[u]; return p && p.nombre ? p.nombre : u; };
  const nombreDe = id => (D.puestos.find(x => x.id === id) || {}).puesto || id;

  /* ── Pantalla ─────────────────────────────────────────────────────────── */

  function chip(estado, sobreColor) {
    const e = norm(estado), cls = e === norm(ABIERTO) ? 'abierto' : e === 'validado' ? 'validado' : e === 'borrador' ? 'borrador' : 'construccion';
    return '<span class="eq-chip ' + cls + (sobreColor ? ' sobre' : '') + '">' + esc(estadoVisible(estado)) + '</span>';
  }

  /* Un puesto de la lista del celular: botón si su ficha llegó (se puede abrir); si no, solo el nombre. */
  function tarjeta(p, tipo, area, estilo) {
    const c = colorArea(area), constr = enConstruccion(p), relleno = tipo !== 'puesto';
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
    return '<div class="eq-leyenda">' + (D.yo.todo ? '<span><span class="eq-chip borrador">Borrador</span>cargado, falta validar</span><span><span class="eq-chip validado">Validado</span></span>' : '') +
      '<span><i class="construccion"></i>En construcción</span><span><span class="eq-chip abierto">Abierto</span>al equipo</span></div>';
  }

  /* Los accesos de Equipo: Reglas del juego (todos) y Horarios del servicio (solo si el servidor mandó la tabla). */
  function accesos() {
    const ir = (href, t) => '<a class="eq-acceso" href="' + href + '">' + t + '</a>';
    return '<nav class="eq-accesos" aria-label="Más de Equipo">' + ir('#reglas', 'Reglas del juego') + (D.horarios ? ir('#horarios', 'Horarios del servicio') : '') + '</nav>';
  }

  function subtitulo() {
    const a = arbol(D.puestos), areas = a.columnas.filter(c => !c.suelta).length;
    return plural(D.puestos.length, 'puesto', 'puestos') + ' · ' + plural(areas, 'área', 'áreas') + '. Toca un puesto para ver su contrato y su lista.';
  }

  function pintar() {
    if (!D) return;
    escenaOscura(true);
    const v = op.vista || 'org';
    if (v === 'reglas') { titulo('Reglas del juego', 'Lo que une a todos en Vida en Arte. Se lee antes de aceptar cualquier contrato.'); el.innerHTML = reglasHtml(true); return; }
    if (v === 'horarios') {
      titulo('Horarios del servicio', 'La hora de cada momento del servicio a las familias. Cambiarla aquí no cambia ningún contrato.');
      el.innerHTML = D.horarios ? horariosHtml() : '<div class="pantalla"><h2>Sin acceso</h2><p>Los horarios del servicio los ven Dirección y Administración.</p></div>';
      return;
    }
    titulo('Equipo', subtitulo());
    modo = window.matchMedia && window.matchMedia(CELULAR).matches ? 'lista' : 'arbol';
    const a = arbol(D.puestos);
    // 30-oct: cuántas áreas por fila, según el ancho que hay (en una fila si se lee; si no, en varias filas parejas).
    porFila = porFilaPara(a.columnas.length, el.clientWidth);
    el.innerHTML = avisosHtml() +
      '<div class="eq-barra">' + accesos() + leyenda() + '</div>' +
      (modo === 'lista' ? listaHtml(a) : arbolHtml(a, porFila));
    if (modo === 'arbol') {
      medirTronco();
      prepararLienzo();
      if (!entro) setTimeout(() => { entro = true; }, ENTRADA.total * 1000);
    }
  }
  function titulo(t, s) { if (op.alTitulo) op.alTitulo(t, s); }

  /* 30-oct: lo que el Sheet avisa (solo llega con equipo.todo: Dirección y Administrador), en una franja de una línea que se despliega. */
  let avisosAbiertos = false;
  function avisosHtml() {
    if (!D.faltan || !D.faltan.length) return '';
    return '<details class="eq-avisos"' + (avisosAbiertos ? ' open' : '') + '><summary>Avisos del Sheet (' + D.faltan.length + ')</summary>' +
      '<ul>' + D.faltan.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>';
  }
  document.addEventListener('toggle', ev => { if (ev.target.matches && ev.target.matches('.eq-avisos')) avisosAbiertos = ev.target.open; }, true);

  /* La escena oscura de la página (fondo, piso, chispas y la barra de arriba en vidrio oscuro). */
  function escenaOscura(si) {
    const html = document.documentElement;
    html.classList.toggle('eq-escena', si);
    let f = document.getElementById('eqFondo');
    if (si && !f) {
      f = document.createElement('div');
      f.id = 'eqFondo'; f.className = 'eq-fondo'; f.setAttribute('aria-hidden', 'true');
      // Chispas en lugares fijos (no al azar: la página se ve igual cada vez).
      let s = 7, chispas = '';
      const azar = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < Math.min(CHISPAS, 20); i++)
        chispas += '<span class="eq-chispa" style="left:' + (4 + azar() * 92).toFixed(1) + '%;top:' + (60 + azar() * 38).toFixed(1) + '%;animation-delay:' + (ENTRADA.total + azar() * 9).toFixed(1) + 's"></span>';
      f.innerHTML = '<div class="eq-brillos"></div><div class="eq-foto"></div><div class="eq-piso"></div>' + chispas;
      document.body.insertBefore(f, document.body.firstChild);
    }
    if (si && D) {
      // Los brillos, de los colores de las áreas que hay (izquierda, centro y derecha).
      const cols = arbol(D.puestos).columnas.filter(c => !c.suelta).map(c => colorArea(c.cab.area).fondo);
      const b = f.querySelector('.eq-brillos'), en = (i, x, y) => cols.length ? 'radial-gradient(700px 420px at ' + x + ' ' + y + ', ' + cols[Math.min(cols.length - 1, i)] + '38, transparent 70%)' : '';
      if (b) b.style.backgroundImage = [en(0, '8%', '70%'), en(Math.floor(cols.length / 2), '50%', '95%'), en(cols.length - 1, '92%', '65%')].filter(Boolean).join(',');
    }
    if (f) f.hidden = !si;
  }
  function salir() { escenaOscura(false); }
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('eq-pausa', document.hidden));

  /* Una tarjeta de la escena (la «losa»): botón si su ficha llegó. */
  function losa(p, clases, estilo, interior) {
    const st = estilo ? ' style="' + estilo + '"' : '';
    return p.ficha
      ? '<button type="button" class="eq-losa ' + clases + '"' + st + ' data-eq-puesto="' + esc(p.id) + '" aria-haspopup="dialog">' + interior + '</button>'
      : '<div class="eq-losa ' + clases + '"' + st + '>' + interior + '</div>';
  }

  function arbolHtml(a, porFila) {
    const E = escena(a, porFila);
    const r = a.raiz;
    const dir = r ? '<div class="eq-dir-fila"><div class="eq-dir eq-entra" style="--d:' + ENTRADA.dir + 's"><div class="eq-halo" aria-hidden="true"></div>' +
      losa(r, 'eq-losa-dir', '', '<span class="eq-dir-id">' + esc(r.id) + '</span><span class="eq-dir-nom">' + esc(r.puesto) + '</span>') + '</div></div>' : '';
    const linea = l => '<i class="eq-lin eq-lin-' + l.tipo + ' eq-crece-' + l.tipo + '" style="--c:' + l.color + ';--d:' + l.d.toFixed(2) + 's;left:' + l.x + 'px;top:' + l.y + 'px;' +
      (l.tipo === 'v' ? 'height:' + l.largo + 'px' : 'width:' + l.largo + 'px') + '"></i>';
    // Con varias filas, el tronco que las une baja por la izquierda; su alto lo pone medirTronco() al pintar.
    const tronco = E.varias ? '<i class="eq-lin eq-lin-v eq-crece-v eq-tronco" style="--c:#FFFFFF;--d:' + (ENTRADA.lineas + 0.2).toFixed(2) + 's;left:' + M.tronco + 'px;top:' + (M.bus / 2 - 2) + 'px;height:0"></i>' : '';
    const columna = c => {
      const col = c.color, cab = c.cab, fantasma = enConstruccion(cab);
      const cabeza = losa(cab, 'eq-losa-cab eq-entra' + (fantasma ? ' eq-tenue' : ''), '--d:' + c.d.toFixed(2) + 's',
        '<span class="eq-cab-banda" style="background:' + col.fondo + ';color:' + col.texto + '"><span class="eq-cab-area">' + esc(cab.area || cab.puesto) + '</span>' +
          '<span class="eq-cab-n" aria-label="' + plural(c.cuantos, 'puesto', 'puestos') + '">' + c.cuantos + '</span></span>' +
        '<span class="eq-cab-cuerpo"><span class="eq-nombre">' + esc(cab.puesto) + '</span>' + chip(cab.estado) + '</span>');
      const hijos = c.puestos.map(x => losa(x.p, 'eq-losa-puesto eq-entra' + (enConstruccion(x.p) ? ' eq-fantasma' : ''),
        '--c:' + col.fondo + ';--d:' + x.d.toFixed(2) + 's;margin-left:' + x.sangria + 'px;--tic:' + (10 + x.sangria) + 'px',
        '<i class="eq-tic" aria-hidden="true"></i><span class="eq-nombre">' + esc(x.p.puesto) + '</span>' +
        (x.p.cantidad ? '<span class="eq-nota">' + esc(x.p.cantidad) + '</span>' : '') + '<span class="eq-fila">' + chip(x.p.estado) + '</span>')).join('');
      return '<div class="eq-col" style="--c:' + col.fondo + '">' + cabeza +
        (c.puestos.length ? '<div class="eq-hijos"><i class="eq-lin eq-lin-v eq-lin-col eq-crece-v" aria-hidden="true" style="--c:' + col.fondo + ';--d:' + (c.d + 0.35).toFixed(2) + 's"></i>' + hijos + '</div>' : '') + '</div>';
    };
    const filas = E.filas.map((f, i) => (r ? '<div class="eq-bus-caja" style="width:' + E.ancho + 'px"><div class="eq-bus" aria-hidden="true">' + (i === 0 ? tronco : '') + f.lineas.map(linea).join('') + '</div></div>' : '') +
      '<div class="eq-columnas" style="grid-template-columns:repeat(' + E.porFila + ',' + M.col + 'px);column-gap:' + M.sep + 'px">' + f.columnas.map(columna).join('') + '</div>').join('');
    const boton = (k, t, etq) => '<button type="button" class="btn-circulo" data-eq-zoom="' + k + '" aria-label="' + etq + '">' + t + '</button>';
    return '<div class="eq-org3d' + (entro ? ' eq-quieto' : '') + '">' +
      '<div class="eq-lienzo" role="region" aria-label="Organigrama. Se arrastra para moverlo; Ctrl con la rueda, o el pellizco, acercan y alejan.">' +
        '<div class="eq-mundo" style="width:' + (E.ancho + 2 * M.margen) + 'px"><div class="eq-escenario"><div class="eq-plano" style="padding:' + M.margen + 'px">' +
          dir + filas +
        '</div></div></div></div>' +
      '<div class="eq-pie"><div class="eq-zoom" role="group" aria-label="Acercar o alejar">' + boton('-', '−', 'Alejar') + boton('+', '+', 'Acercar') +
        '<button type="button" class="btn sec chico" data-eq-zoom="ajustar">Ajustar</button></div></div></div>';
  }

  function listaHtml(a) {
    const raiz = a.raiz ? '<div class="eq-lista-raiz">' + tarjeta(a.raiz, 'raiz', a.raiz.area) + '</div>' : '';
    const areas = a.columnas.map(c => {
      const todos = [c.cab].concat(c.puestos.map(x => x.p)), abierta = !!abiertas[c.cab.id], col = colorArea(c.cab.area);
      const id = 'eq-area-' + esc(c.cab.id);
      return '<li class="eq-area" style="--eq-color:' + col.linea + '">' +
        '<button type="button" class="eq-area-cab" data-eq-area="' + esc(c.cab.id) + '" aria-expanded="' + abierta + '" aria-controls="' + id + '">' +
          '<i class="eq-punto" style="background:' + col.fondo + '" aria-hidden="true"></i><span class="eq-area-txt"><b>' + esc(c.cab.area || c.cab.puesto) + '</b><small>' + esc(conteo(todos)) + '</small></span>' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="' + (abierta ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6') + '"/></svg></button>' +
        '<div class="eq-area-cuerpo' + (abierta ? '' : ' oculto') + '" id="' + id + '">' +
          [{ p: c.cab, nivel: -1 }].concat(c.puestos).map(x => tarjeta(x.p, 'puesto', c.cab.area, 'margin-left:' + (x.nivel + 1) * 14 + 'px')).join('') + '</div></li>';
    }).join('');
    return '<div class="eq-org eq-org-lista vidrio-tarjeta">' + raiz + '<ul class="eq-areas">' + areas + '</ul></div>';
  }

  /* ── Reglas del juego y Horarios del servicio ─────────────────────────── */

  function reglasHtml(pagina) {
    if (!D.reglas || !D.reglas.length) return '<div class="vidrio-tarjeta eq-regla-sec"><p class="ayuda">Todavía no hay Reglas del juego cargadas.</p></div>';
    return '<div class="eq-reglas' + (pagina ? ' pagina-reglas' : '') + '">' + D.reglas.map(g =>
      '<section class="' + (pagina ? 'vidrio-tarjeta ' : '') + 'eq-regla-sec"><h2 class="titulo">' + esc(g.seccion) + '</h2>' + g.textos.map(t => '<p>' + esc(t) + '</p>').join('') + '</section>').join('') + '</div>';
  }

  function horariosHtml() {
    return '<div class="vidrio-tarjeta eq-horarios"><table class="tabla"><thead><tr><th scope="col">Momento</th><th scope="col">Unidad</th><th scope="col">Hora</th><th scope="col">Puestos que lo usan</th></tr></thead><tbody>' +
      D.horarios.map(h => '<tr><td><b>' + esc(h.momento) + '</b></td><td>' + esc(h.unidad) + '</td><td class="eq-horarios-hora">' + esc(h.hora) + '</td><td>' + esc(h.puestos.join(', ')) + '</td></tr>').join('') +
      '</tbody></table></div>';
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
  /* 30-oct: «Ajustar» encaja el árbol al ANCHO del lienzo (sin pasar de 1) y el
     lienzo crece hasta mostrarlo entero a esa escala: la página baja con su
     scroll de siempre. */
  function ajustar() {
    if (!lienzo) return;
    const { vw, W, H } = medidas();
    vista.s = Math.max(ZOOM_MIN, Math.min(1, (vw - 16) / W));
    lienzo.style.height = Math.ceil(H * vista.s + 16) + 'px';
    vista.x = (vw - W * vista.s) / 2; vista.y = 8;
    aplicar();
  }
  /* El tronco que une las filas: de la barra de la primera fila a la de la última (alturas reales, antes del zoom). */
  function medirTronco() {
    const t = el.querySelector('.eq-tronco'), cajas = el.querySelectorAll('.eq-bus-caja');
    if (t && cajas.length > 1) t.style.height = (cajas[cajas.length - 1].offsetTop - cajas[0].offsetTop) + 'px';
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
    if (!ajustado) { ajustar(); ajustado = true; } else { lienzo.style.height = Math.ceil(mundo.offsetHeight * vista.s + 16) + 'px'; limitar(); aplicar(); }
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
    // 30-oct: la rueda sola baja la página (el lienzo ya es tan alto como el árbol); con Ctrl (o el pellizco del panel táctil) acerca y aleja.
    lienzo.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const p = local(e); zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });
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

  /* ── Ficha: el contrato con el formato del papel ──────────────────────── */

  function contratoHtml(p, f, conHoras) {
    const jefe = D.puestos.find(x => x.id === p.reportaA), c = f.contrato, h = conHoras ? horas : () => '';
    const ol = (l, t) => l.length ? '<ol class="eq-ol">' + l.map(x => '<li><span>' + esc(x) + '</span>' + h(x) + '</li>').join('') + '</ol>' : '<p class="ayuda">Sin ' + t + ' cargado todavía.</p>';
    return '<table class="eq-contrato-tabla"><tbody><tr><th scope="row">Puesto</th><td>' + esc(p.puesto) + '</td></tr>' +
        '<tr><th scope="row">Unidad</th><td>' + esc(f.unidad || '—') + '</td></tr>' +
        '<tr><th scope="row">Reporta a</th><td>' + esc(jefe ? jefe.puesto : '—') + '</td></tr></tbody></table>' +
      '<section class="eq-sec"><h3>1. Resultado que produce</h3>' + (c.resultado.length ? c.resultado.map(x => '<p class="eq-resultado">' + esc(x) + h(x) + '</p>').join('') : '<p class="ayuda">Sin resultado cargado todavía.</p>') + '</section>' +
      '<section class="eq-sec"><h3>2. Trabajo del que es responsable</h3>' + ol(c.trabajo, 'trabajo') + '</section>' +
      '<section class="eq-sec"><h3>3. Estándares con que se evalúan los resultados</h3>' + ol(c.estandares, 'estándar') + '</section>';
  }

  /* 4. Aceptación: el texto siempre; el botón solo a quien ocupa el puesto y si está «Abierto al equipo» (el servidor lo vuelve a mirar). */
  function aceptacionHtml(p, f) {
    const abierto = norm(p.estado) === norm(ABIERTO);
    let pie;
    if (abierto && f.ocupo) {
      if (f.aceptada) pie = '<div class="eq-aceptar ok"><p>Aceptado el ' + esc(fechaHora(f.aceptadaFecha)) + ' · versión ' + esc(f.version) + '</p></div>';
      else pie = '<div class="eq-aceptar"><p>' + (f.aceptadaVersion !== null && f.aceptadaVersion !== undefined
          ? '<b>Hay una versión nueva de este contrato</b> (aceptaste la ' + esc(f.aceptadaVersion) + '). Léela y vuelve a aceptarla.'
          : 'Lee el contrato y acéptalo. Antes vas a leer las Reglas del juego. Queda registrado con tu usuario, la fecha y la versión.') + '</p>' +
        (aviso ? '<div class="aviso mal">' + esc(aviso) + '</div>' : '') +
        '<button type="button" class="btn negro" data-eq-aceptar>Aceptar</button></div>';
    } else {
      const e = norm(p.estado);
      const nota = abierto ? 'Lo acepta, desde su ficha, quien ocupa este puesto.'
        : e === 'borrador' ? 'Este contrato está en Borrador: cargado y pendiente de validar. Todavía no se puede aceptar.'
        : e === 'validado' ? 'Este contrato está Validado. Se podrá aceptar cuando el puesto esté «Abierto al equipo».'
        : 'Este puesto está en construcción. Todavía no se puede aceptar.';
      pie = '<div class="eq-aceptar gris"><p>' + nota + '</p></div>';
    }
    return '<section class="eq-sec"><h3>4. Aceptación</h3><p class="eq-texto-acepto">' + TEXTO_ACEPTACION + '</p>' + pie + '</section>';
  }

  /* El paso previo a aceptar: las Reglas del juego completas y la confirmación de que se leyeron. */
  function pasoReglasHtml(p, f) {
    return '<section class="eq-sec eq-paso-reglas"><h3>Antes de aceptar: las Reglas del juego</h3>' + reglasHtml(false) +
      '<label class="eq-lei"><input type="checkbox" data-eq-lei' + (leyoReglas ? ' checked' : '') + '> Leí las Reglas del juego.</label>' +
      (aviso ? '<div class="aviso mal">' + esc(aviso) + '</div>' : '') +
      '<div class="eq-botones"><button type="button" class="btn sec" data-eq-volver>Volver al contrato</button>' +
      '<button type="button" class="btn negro" data-eq-confirmar' + (leyoReglas ? '' : ' disabled') + '>Acepto el contrato · versión ' + esc(f.version) + '</button></div></section>';
  }

  function listaHtmlFicha(f) {
    // 30-oct: agrupada como la manda el script (Diario … Por temporada, y al final «Cada vez que ocurre»); cada punto conserva su «Cada cuánto».
    const grupos = Puestos.agrupar(f.lista);
    return '<section class="eq-sec eq-sec-lista"><h3>Lista de verificación</h3>' + verificaHtml(f) +
      (grupos.length ? grupos.map(g => '<h4 class="eq-frec">' + esc(g.grupo) + '</h4><ul class="eq-puntos">' + g.puntos.map(x =>
        '<li><span>' + esc(x.texto) + '</span>' + (Puestos.frecuenciaPropia(x) ? '<span class="eq-cuando">' + esc(Puestos.frecuenciaPropia(x)) + '</span>' : '') + horas(x.texto) +
        (x.evidencia ? '<span class="ayuda">Evidencia: ' + esc(x.evidencia) + '</span>' : '') + '</li>').join('') + '</ul>').join('')
        : '<p class="ayuda">Sin lista de verificación cargada todavía.</p>') + '</section>';
  }

  function verificaHtml(f) {
    if (!f.verifica) return '';
    const v = f.verificador;
    return '<p class="eq-verifica"><b>Verifica:</b> ' + esc(f.verifica) +
      (v && v.escalado ? '<br><b>Esta vez verifica ' + esc(v.puesto) + ':</b> quien ocupa este puesto ocupa también el que lo verifica, y nadie se verifica a sí mismo.' : '') +
      (f.comoVerifica ? '<br><b>Cómo:</b> ' + esc(f.comoVerifica) : '') + '</p>';
  }

  /* La hoja diaria: por momento, cada paso con su hora de marca y las iniciales. */
  function hojaHtml(p, f, h, k) {
    const abierto = norm(p.estado) === norm(ABIERTO), puedeMarcar = abierto && f.ocupo;
    const dias = [...new Set([D.hoy].concat(h.marcas.map(m => m.fecha.slice(0, 10))).concat(h.revisiones.map(r => r.periodo)))].filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse();
    const dia = dias.includes(diaHoja[k]) ? diaHoja[k] : D.hoy, hoy = dia === D.hoy;
    const marcasDia = h.marcas.filter(m => m.fecha.slice(0, 10) === dia);
    const marcaDe = o => marcasDia.filter(m => +m.orden === +o).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop() || null;
    const momentos = [...new Set(h.pasos.map(x => x.momento))];
    const hechos = h.pasos.filter(x => marcaDe(x.orden)).length;
    const yo = norm(D.yo.usuario);
    // Si el momento ES uno de Horarios del servicio, junto al título va solo su hora.
    const horaDe = mo => { const m = Puestos.momentosEn(mo, D.momentos); return m.length === 1 && norm(m[0].momento) === norm(mo) ? (m[0].hora ? '<span class="eq-hora">' + esc(m[0].hora) + '</span>' : '') : horas(mo); };
    const cuerpo = momentos.map(mo => '<h4 class="eq-frec">' + esc(mo || 'Sin momento') + horaDe(mo) + '</h4><ul class="eq-pasos">' + h.pasos.filter(x => x.momento === mo).map(x => {
      const m = marcaDe(x.orden), clave = k + ':' + x.orden, ajena = m && norm(m.usuario) !== yo;
      const activo = puedeMarcar && hoy && !ajena && guardandoPaso !== clave;
      const sello = m ? '<span class="eq-sello">' + esc(hora12(m.fecha.slice(11, 16))) + ' · ' + esc(m.iniciales || '') + '</span>' : '';
      return '<li><button type="button" class="eq-paso" data-eq-paso="' + esc(clave) + '" aria-pressed="' + !!m + '"' + (activo ? '' : ' disabled') +
        (ajena ? ' title="Lo marcó ' + esc(quien(m.usuario)) + '"' : '') + '><span class="eq-caja" aria-hidden="true"></span><span class="eq-paso-txt">' + esc(x.paso) + horas(x.paso) + '</span>' +
        (guardandoPaso === clave ? '<span class="eq-sello">Guardando…</span>' : sello) + '</button></li>';
    }).join('') + '</ul>').join('');
    const revs = h.revisiones.filter(r => r.periodo === dia);
    const nota = !abierto ? 'Se marca cuando el puesto esté «Abierto al equipo».' : puedeMarcar ? (hoy ? 'Toca un paso al hacerlo: queda con la hora y tus iniciales. Puedes desmarcarlo hoy mismo.' : 'Los días anteriores se ven, pero ya no se marcan.') : '';
    const verif = f.verifico ? '<form class="ml-revisar eq-verificar-hoja" data-eq-hoja-rev="' + esc(k) + '"><fieldset><legend>Resultado</legend>' +
        '<label><input type="radio" name="r" value="Cumplido" checked> Cumplido</label><label><input type="radio" name="r" value="No"> No</label></fieldset>' +
        '<fieldset><legend>Sorpresa</legend><label><input type="radio" name="s" value="Sí"> Sí</label><label><input type="radio" name="s" value="No" checked> No</label></fieldset>' +
        '<label class="ml-nota-rev">Nota <input type="text" maxlength="400" name="nota"></label><button type="submit" class="btn negro">Verificar la hoja del ' + esc(diaTexto(dia)) + '</button></form>' : '';
    return '<section class="eq-sec eq-hoja" data-eq-hoja="' + esc(k) + '"><h3>Hoja diaria · ' + esc(h.hoja) + '</h3>' +
      '<div class="eq-hoja-cab"><span class="eq-pill' + (hechos === h.pasos.length ? ' ok' : '') + '">' + hechos + ' de ' + plural(h.pasos.length, 'paso', 'pasos') + '</span>' +
        (dias.length > 1 ? '<label class="eq-dia">Día <select data-eq-dia="' + esc(k) + '">' + dias.map(d => '<option value="' + d + '"' + (d === dia ? ' selected' : '') + '>' + (d === D.hoy ? 'Hoy' : esc(diaTexto(d))) + '</option>').join('') + '</select></label>' : '') + '</div>' +
      (nota ? '<p class="ayuda">' + nota + '</p>' : '') + (avisoHoja[k] ? '<div class="aviso mal">' + esc(avisoHoja[k]) + '</div>' : '') + cuerpo +
      (revs.length ? revs.map(r => '<p class="ayuda ml-revision">Verificada por ' + esc(quien(r.revisor)) + ' · ' + esc(fechaHora(r.fecha)) + ' · ' + esc(r.resultado) + (r.sorpresa === 'Sí' ? ' · sorpresa' : '') +
        (r.nota.replace(/^Hoja «[^»]*»( · )?/, '') ? ' · «' + esc(r.nota.replace(/^Hoja «[^»]*»( · )?/, '')) + '»' : '') + '</p>').join('') : '<p class="ayuda">La hoja de este día no tiene verificación.</p>') +
      verif + '</section>';
  }

  function fichaHtml(id) {
    const p = D.puestos.find(x => x.id === id), f = D.fichas[id];
    const procesos = f.procesos.length ? '<section class="eq-sec"><h3>Procesos</h3><ul class="eq-puntos">' + f.procesos.map((x, i) => '<li><span><b>' + esc(x.proceso) + '</b>' + (x.estado ? ' <span class="eq-chip construccion">' + esc(x.estado) + '</span>' : '') + '</span>' +
        (x.descripcion ? '<span class="ayuda">' + esc(x.descripcion) + '</span>' : '') +
        (x.enlace && window.Visor && Visor.vista(x.enlace).modo !== 'nada' ? '<button type="button" class="pa-boton" data-eq-proceso="' + i + '">Abrir</button>' : '') + '</li>').join('') + '</ul></section>' : '';
    const estado = '<span class="eq-pill oscuro">' + esc(estadoVisible(p.estado)) + (f.version !== null && f.version !== undefined ? ' · versión ' + esc(f.version) : '') + '</span>';
    const pdf = f.pdf ? '<button type="button" class="btn sec chico" data-eq-pdf>Descargar PDF</button>' : '';
    const cuerpo = paso === 'reglas' ? pasoReglasHtml(p, f)
      : contratoHtml(p, f, true) + aceptacionHtml(p, f) + listaHtmlFicha(f) + f.hojas.map((h, i) => hojaHtml(p, f, h, String(i))).join('') + procesos;
    return '<div class="eq-ficha"><div class="eq-ficha-cab"><div><span class="eq-sobre">Contrato de posición</span><h2 class="titulo" id="eqFichaTit">' + esc(p.puesto) + '</h2></div>' +
      '<button type="button" class="btn-circulo" data-eq-cerrar aria-label="Cerrar la ficha"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="eq-pills">' + estado + pdf + '</div><div class="eq-cuerpo">' + cuerpo + '</div></div>';
  }

  /* ── PDF: una hoja de impresión con el formato del modelo ─────────────── */

  function imprimir(id) {
    const p = D.puestos.find(x => x.id === id), f = D.fichas[id];
    const viejo = document.getElementById('eq-impresion');
    if (viejo) viejo.remove();
    const hoja = document.createElement('div');
    hoja.id = 'eq-impresion';
    // Sin las horas de los momentos: la hora es del servicio y puede cambiar sin que cambie el contrato firmado.
    hoja.innerHTML = '<p class="eqp-marca">Vida en Arte</p><h1>Contrato de posición</h1><h2>' + esc(p.puesto) + '</h2>' + contratoHtml(p, f, false) +
      '<section class="eq-sec eqp-firma"><h3>4. Firma</h3><p class="eq-texto-acepto">' + TEXTO_ACEPTACION + '</p>' +
      '<div class="eqp-linea"></div><p class="eqp-firma-tit">Firma</p><div class="eqp-datos"><span>Nombre:</span><span>Fecha:</span></div></section>';
    document.body.appendChild(hoja);
    const titulo = document.title;
    document.title = 'Contrato de posición - ' + p.puesto;
    document.documentElement.classList.add('eq-imprimiendo');
    const fin = () => { document.documentElement.classList.remove('eq-imprimiendo'); document.title = titulo; hoja.remove(); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); }, 60);
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
    dlg.addEventListener('change', ev => {
      const t = ev.target;
      if (t.matches('[data-eq-lei]')) { leyoReglas = t.checked; const b = dlg.querySelector('[data-eq-confirmar]'); if (b) b.disabled = !leyoReglas; }
      if (t.matches('[data-eq-dia]')) { diaHoja[t.dataset.eqDia] = t.value; repintarFicha('[data-eq-dia="' + t.dataset.eqDia + '"]'); }
    });
    dlg.addEventListener('submit', ev => { const fm = ev.target.closest('form[data-eq-hoja-rev]'); if (fm) { ev.preventDefault(); verificarHoja(fm); } });
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
    sel = id; paso = 'contrato'; leyoReglas = false; aviso = ''; diaHoja = {}; avisoHoja = {}; origen = desde || null;
    if (!dlg) crearDialogo();
    dlg.innerHTML = fichaHtml(id);
    if (!dlg.open) { dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); }
    document.body.classList.add('eq-ficha-abierta');
    dlg.scrollTop = 0;
    const x = dlg.querySelector('[data-eq-cerrar]'); if (x) x.focus();
  }
  function repintarFicha(foco) {
    if (!dlg || !sel) return;
    const caja = dlg.querySelector('.eq-ficha'), arriba = caja ? caja.scrollTop : 0;
    dlg.innerHTML = fichaHtml(sel);
    const nueva = dlg.querySelector('.eq-ficha'); if (nueva) nueva.scrollTop = arriba;
    const f = foco && dlg.querySelector(foco); if (f) f.focus({ preventScroll: true });
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
    const b = ev.target.closest('[data-eq-puesto],[data-eq-cerrar],[data-eq-aceptar],[data-eq-confirmar],[data-eq-volver],[data-eq-pdf],[data-eq-paso],[data-eq-proceso],[data-eq-reintentar],[data-eq-zoom],[data-eq-area]');
    if (!b) return;
    if (b.dataset.eqReintentar !== undefined) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2></div>'; cargar(); return; }
    if (b.dataset.eqZoom) { if (b.dataset.eqZoom === 'ajustar') ajustar(); else zoom(b.dataset.eqZoom === '+' ? 1.25 : 0.8); return; }
    if (b.dataset.eqArea) { abiertas[b.dataset.eqArea] = !abiertas[b.dataset.eqArea]; pintar(); const v = el.querySelector('[data-eq-area="' + b.dataset.eqArea + '"]'); if (v) v.focus(); return; }
    if (b.dataset.eqPuesto) { if (lienzo && lienzo.dataset.arrastre) return; abrirFicha(b.dataset.eqPuesto, b); return; }
    if (b.dataset.eqCerrar !== undefined) { cerrarFicha(); return; }
    if (b.dataset.eqAceptar !== undefined) { paso = 'reglas'; aviso = ''; repintarFicha('[data-eq-lei]'); const c = dlg.querySelector('.eq-ficha'); if (c) c.scrollTop = 0; return; }
    if (b.dataset.eqVolver !== undefined) { paso = 'contrato'; aviso = ''; repintarFicha('[data-eq-aceptar]'); return; }
    if (b.dataset.eqConfirmar !== undefined) { if (leyoReglas) aceptar(b); return; }
    if (b.dataset.eqPdf !== undefined) { imprimir(sel); return; }
    if (b.dataset.eqPaso) { marcarPaso(b.dataset.eqPaso, b.getAttribute('aria-pressed') !== 'true'); return; }
    if (b.dataset.eqProceso !== undefined) {
      const x = D.fichas[sel].procesos[+b.dataset.eqProceso];
      VisorPantalla.abrir(x.proceso, D.puestos.find(p => p.id === sel).puesto, [{ version: Visor.version(x.proceso, x.enlace), nombre: x.proceso, enlace: x.enlace }]);
    }
  }

  async function aceptar(b) {
    const f = D.fichas[sel], id = sel;
    b.disabled = true; b.textContent = 'Guardando…'; aviso = '';
    try {
      await Datos.equipo.aceptar(id, f.version);
      Marca.toast('Contrato aceptado');
      await cargar();
      if (D && D.fichas[id]) { sel = id; paso = 'contrato'; repintarFicha('[data-eq-cerrar]'); }
    } catch (e) {
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      aviso = e.codigo === 'version_vieja' ? 'El contrato cambió mientras lo leías. Ya está la versión nueva: léela y vuelve a aceptar.' : e.message;
      if (e.codigo === 'version_vieja') { await cargar(); sel = id; paso = 'contrato'; }
      repintarFicha(paso === 'reglas' ? '[data-eq-confirmar]' : '[data-eq-aceptar]');
    }
  }

  /* Marcar o desmarcar un paso: se guarda al tocarlo; la respuesta trae las marcas de hoy de esa hoja. */
  async function marcarPaso(clave, marcado) {
    if (guardandoPaso) return;
    const [k, orden] = clave.split(':'), f = D.fichas[sel], h = f.hojas[+k], id = sel;
    guardandoPaso = clave; avisoHoja[k] = ''; repintarFicha('[data-eq-paso="' + clave + '"]');
    try {
      const r = (await Datos.equipo.marcarHoja(id, h.hoja, +orden, marcado)).resultado;
      h.marcas = h.marcas.filter(m => m.fecha.slice(0, 10) !== r.hoy).concat(r.marcas);
    } catch (e) {
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      avisoHoja[k] = e.codigo === 'incierto' || e.codigo === 'red' ? 'No llegó la respuesta. Cierra y vuelve a abrir la ficha: si se guardó, ya aparece marcado.' : e.message;
    } finally {
      guardandoPaso = '';
      if (sel === id) repintarFicha('[data-eq-paso="' + clave + '"]');
    }
  }

  async function verificarHoja(fm) {
    const k = fm.dataset.eqHojaRev, id = sel, h = D.fichas[id].hojas[+k], dia = diaHoja[k] || D.hoy, b = fm.querySelector('button');
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await Datos.equipo.revisarHoja(id, h.hoja, dia, fm.querySelector('[name="s"]:checked').value, fm.querySelector('[name="r"]:checked').value, fm.nota.value);
      Marca.toast('Hoja verificada');
      await cargar();
      if (D && D.fichas[id]) { sel = id; diaHoja[k] = dia; repintarFicha('[data-eq-hoja="' + k + '"] h3'); }
    } catch (e) {
      if (e.codigo === 'sesion') { Datos.aLogin(); return; }
      avisoHoja[k] = e.message; repintarFicha('[data-eq-hoja-rev="' + k + '"] button');
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
      window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => {
        if (!(modo === 'arbol' && lienzo && document.contains(lienzo) && lienzo.clientWidth)) return;
        // 30-oct: si al girar cambia cuántas áreas caben por fila, se vuelve a dibujar; si no, solo se ajusta al ancho.
        if (porFilaPara(arbol(D.puestos).columnas.length, el.clientWidth) !== porFila) { ajustado = false; pintar(); } else ajustar();
      }, 150); });
    }
    if ((op.vista || 'org') !== ((opciones || {}).vista || 'org')) ajustado = false;   // al volver al organigrama, se ajusta de nuevo
    op = opciones || {};
    escenaOscura(true);
    if (D) {
      pintar();
      if (op.abrir && D.fichas[op.abrir]) { const id = op.abrir; op.abrir = ''; abrirFicha(id, el.querySelector('[data-eq-puesto="' + id + '"]')); }
    } else {
      titulo(op.vista === 'reglas' ? 'Reglas del juego' : op.vista === 'horarios' ? 'Horarios del servicio' : 'Equipo', '');
      if (!cargando) { el.innerHTML = '<div class="pantalla"><h2>Cargando…</h2><p>Leyendo los puestos de Vida en Arte.</p></div>'; cargar(); }
    }
  }

  window.Organigrama = { mostrar, salir, _arbol: arbol, _escena: escena, _porFila: porFilaPara, _conteo: conteo, _medidas: M, _entrada: ENTRADA, _chispas: CHISPAS, _hora12: hora12,
    // Para la prueba (pruebas-portal/prueba-organigrama.js): pintar la ficha con datos inventados, sin navegador.
    _probar: { datos(d) { D = d; }, ficha(id, p) { paso = p || 'contrato'; return fichaHtml(id); } } };
})();
