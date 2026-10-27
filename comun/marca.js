/* ==========================================================================
   Vida en Arte · piezas de PRESENTACIÓN compartidas (21-oct-2026)

   El encabezado (logo, ruta, usuario, Cambiar mi contraseña, Salir) y el
   aviso flotante, iguales en todas las páginas con la marca. No pide datos:
   recibe la sesión que la página obtuvo con Datos.sesion() (comun/datos.js).
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * Pinta el encabezado dentro de `el`.
   *   sesion: {usuario, roles:[{nombre}]}
   *   ruta:   [{texto, url?}]  (miga de pan: «Inicio / After School»)
   *   prefijo: texto antes del usuario (p. ej. «Pasando lista:»)
   *   logo:   {src, alt} (por defecto, el de Vida en Arte; Preschool usa el de Kids)
   *   accesos: [{texto, url}] (23-oct) enlaces de texto en una fila propia,
   *           visibles en todo tamaño (el Profesor en Pasar lista: Inicio, Procesos)
   */
  /* 27-oct: el nombre de la persona (Configuración › Usuarios). Sin nombre
     cargado, el usuario, como antes. */
  const nombreDe = s => s ? (((s.nombre || '') + ' ' + (s.apellido || '')).trim() || s.usuario || '') : '';
  /** «Buenos días, Ana» (sin nombre: «Buenos días, recepcion-as»). */
  function saludo(s, ahora) {
    const h = (ahora || new Date()).getHours();
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + (s ? ', ' + ((s.nombre || '').trim() || s.usuario) : '');
  }

  function cabecera(el, { sesion, ruta, prefijo, logo, accesos } = {}) {
    const lg = logo || { src: '/comun/logo-vea.png?v=03a73eb9c2', alt: 'Vida en Arte' };
    const usuario = nombreDe(sesion);
    const rol = sesion && sesion.roles && sesion.roles.length ? sesion.roles.map(r => r.nombre).join(' · ') : '';
    const miga = (ruta || []).map((p, i, l) => i < l.length - 1 && p.url
      ? '<a href="' + esc(p.url) + '">' + esc(p.texto) + '</a><span aria-hidden="true">/</span>'
      : '<b>' + esc(p.texto) + '</b>').join('');
    el.className = 'cab';
    el.innerHTML = '<div class="cab-in">' +
      '<div class="cab-marca"><a href="/" aria-label="Inicio"><img src="' + esc(lg.src) + '" alt="' + esc(lg.alt) + '"' + (logo ? ' class="kids"' : '') + '></a>' +
      (miga ? '<nav class="cab-ruta" aria-label="Ruta">' + miga + '</nav>' : '') + '</div>' +
      '<div class="cab-usuario">' +
      (usuario ? '<span class="cab-quien">' + (prefijo ? '' : '<span class="inicial" aria-hidden="true">' + esc(usuario.charAt(0).toUpperCase()) + '</span>') +
        '<span>' + (prefijo ? esc(prefijo) + ' ' : '') + '<b>' + esc(usuario) + '</b>' + (rol && !prefijo ? '<span class="rol"> · ' + esc(rol) + '</span>' : '') + '</span></span>' : '') +
      '<a class="cab-enlace" href="/cambiar-clave.html?r=' + encodeURIComponent(location.pathname) + '"><span class="largo">Cambiar mi contraseña</span><span class="corto">Contraseña</span></a>' +
      '<a class="btn" href="/logout.php">Salir</a></div></div>' +
      (accesos && accesos.length ? '<nav class="cab-accesos" aria-label="Ir a"><div class="cab-accesos-in">' +
        accesos.map(a => '<a href="' + esc(a.url) + '">' + esc(a.texto) + '</a>').join('') + '</div></nav>' : '');
  }

  let t = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('ver');
    clearTimeout(t); t = setTimeout(() => el.classList.remove('ver'), 3200);
  }

  /* 23-oct: las dos marcas y qué áreas (unidades) tiene cada una. Tocar el
     logo en la portada abre la página de la marca (la portada con ?marca=).
     El mismo reparto está en MARCAS de permisos.php (entrada directa); la
     prueba del portal compara los dos. */
  const MARCAS = [
    { id: 'vea', nombre: 'Vida en Arte', url: '/?marca=vea', logo: { src: '/comun/logo-vea.png?v=03a73eb9c2', alt: 'Vida en Arte' },
      areas: ['afterschool', 'veranito', 'cumpleanos'] },
    { id: 'kids', nombre: 'Vida en Arte Kids', url: '/?marca=kids', logo: { src: '/comun/logo-kids.png?v=84821d6ddf', alt: 'Vida en Arte Kids' },
      areas: ['kinder', 'babyandme'], kids: true }
  ];
  const marcaDe = area => MARCAS.find(m => m.areas.includes(area)) || null;

  /** Miga de pan de una página de unidad: «Inicio / <Marca> / <Unidad>». */
  function rutaUnidad(area, nombre) {
    const m = marcaDe(area);
    return [{ texto: 'Inicio', url: '/' }].concat(m ? [{ texto: m.nombre, url: m.url }] : [], [{ texto: nombre }]);
  }

  /* Cada unidad del catálogo (columna «Unidad de negocio» del Sheet) con su
     color e iniciales; texto negro sobre los claros (contraste ≥ 4.5). Se
     muestra como se llama hoy (D-046); el dato no cambia. La usan Proyecto
     Actio y Procesos. */
  const UNIDADES_DOC = {
    kinder:         { nombre: 'Preschool',    ini: 'PS', fondo: '#7E53A2', texto: '#FFFFFF' },
    preschool:      { nombre: 'Preschool',    ini: 'PS', fondo: '#7E53A2', texto: '#FFFFFF' },
    veranito:       { nombre: 'Veranito',     ini: 'VE', fondo: '#FFA615', texto: '#111111' },
    'after school': { nombre: 'After School', ini: 'AS', fondo: '#D71C0E', texto: '#FFFFFF' },
    gerencia:       { nombre: 'Gerencia',     ini: 'GE', fondo: '#111111', texto: '#FFFFFF' },
    general:        { nombre: 'General',      ini: 'GE', fondo: '#111111', texto: '#FFFFFF' },
    cumpleanos:     { nombre: 'Cumpleaños',   ini: 'CU', fondo: '#1974A8', texto: '#FFFFFF' },
    'baby & me':    { nombre: 'Baby & Me',    ini: 'BM', fondo: '#68A8C9', texto: '#111111' },
    'baby and me':  { nombre: 'Baby & Me',    ini: 'BM', fondo: '#68A8C9', texto: '#111111' }
  };
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function unidadDoc(u) {
    const n = String(u || '').trim();
    return UNIDADES_DOC[normal(n)] || { nombre: n || 'Sin unidad', ini: (n || '?').slice(0, 2).toUpperCase(), fondo: '#6B6B6B', texto: '#FFFFFF' };
  }

  /** «Martes 21 de octubre» */
  function fechaLarga(iso) {
    const d = iso ? new Date(iso + 'T12:00:00') : new Date();
    const s = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.Marca = { esc, cabecera, saludo, nombreDe, toast, fechaLarga, MARCAS, marcaDe, rutaUnidad, unidadDoc, normal };
})();
