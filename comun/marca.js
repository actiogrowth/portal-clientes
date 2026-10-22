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
   */
  function cabecera(el, { sesion, ruta, prefijo, logo } = {}) {
    const lg = logo || { src: '/comun/logo-vea.png?v=03a73eb9c2', alt: 'Vida en Arte' };
    const usuario = sesion ? sesion.usuario : '';
    const rol = sesion && sesion.roles && sesion.roles.length ? sesion.roles.map(r => r.nombre).join(' · ') : '';
    const miga = (ruta || []).map((p, i, l) => i < l.length - 1 && p.url
      ? '<a href="' + esc(p.url) + '">' + esc(p.texto) + '</a><span aria-hidden="true">/</span>'
      : '<b>' + esc(p.texto) + '</b>').join('');
    el.className = 'cab';
    el.innerHTML = '<div class="cab-in">' +
      '<div class="cab-marca"><a href="/" aria-label="Inicio del portal"><img src="' + esc(lg.src) + '" alt="' + esc(lg.alt) + '"' + (logo ? ' class="kids"' : '') + '></a>' +
      (miga ? '<nav class="cab-ruta" aria-label="Ruta">' + miga + '</nav>' : '') + '</div>' +
      '<div class="cab-usuario">' +
      (usuario ? '<span class="cab-quien">' + (prefijo ? '' : '<span class="inicial" aria-hidden="true">' + esc(usuario.charAt(0).toUpperCase()) + '</span>') +
        '<span>' + (prefijo ? esc(prefijo) + ' ' : '') + '<b>' + esc(usuario) + '</b>' + (rol && !prefijo ? '<span class="rol"> · ' + esc(rol) + '</span>' : '') + '</span></span>' : '') +
      '<a class="cab-enlace" href="/cambiar-clave.html?r=' + encodeURIComponent(location.pathname) + '"><span class="largo">Cambiar mi contraseña</span><span class="corto">Contraseña</span></a>' +
      '<a class="btn" href="/logout.php">Salir</a></div></div>';
  }

  let t = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('ver');
    clearTimeout(t); t = setTimeout(() => el.classList.remove('ver'), 3200);
  }

  /** «Martes 21 de octubre» */
  function fechaLarga(iso) {
    const d = iso ? new Date(iso + 'T12:00:00') : new Date();
    const s = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.Marca = { esc, cabecera, toast, fechaLarga };
})();
