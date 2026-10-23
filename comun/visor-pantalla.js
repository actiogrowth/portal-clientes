/* ==========================================================================
   Vida en Arte · el VISOR en pantalla (23-oct-2026)

   El documento se ve en la misma página, a pantalla entera, con Descargar,
   Pantalla completa y Cerrar; si el documento tiene varias versiones, van
   como pestañas. Lo usan Proyecto Actio y Procesos (antes vivía dentro de
   proyecto-actio/index.html). Necesita comun/visor.js y comun/marca.js.

     VisorPantalla.abrir(titulo, sub, versiones, pedida)
       versiones: [{version, nombre, enlace}]; pedida: la versión que abre
       (1 clic desde la fila). Un enlace que no se puede incrustar se abre en
       una pestaña nueva.

   Una presentación privada del portal (/biblioteca/) se incrusta AISLADA:
   iframe con sandbox SIN allow-same-origin: sus scripts corren, pero en un
   origen propio, sin ver la sesión ni esta página.
   ========================================================================== */
(function () {
  'use strict';
  const esc = s => Marca.esc(s);
  let el = null, versiones = [], volverFoco = null;
  const $ = s => el.querySelector(s);

  function montar() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'pa-visor oculto'; el.id = 'visor';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'visorTit');
    el.innerHTML =
      '<div class="pa-visor-cab">' +
        '<div class="pa-visor-tit"><b id="visorTit"></b><span id="visorSub"></span></div>' +
        '<div class="pa-visor-acciones">' +
          '<a class="btn sec chico" id="visorDescargar" target="_blank" rel="noopener">Descargar</a>' +
          '<button class="btn sec chico" id="visorCompleta" type="button">Pantalla completa</button>' +
          '<button class="btn-circulo" id="visorCerrar" type="button" aria-label="Cerrar el documento">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="pestanas pa-versiones" id="visorVersiones" role="tablist" aria-label="Versiones"></div>' +
      '<div class="pa-visor-cuerpo" id="visorCuerpo"></div>';
    document.body.appendChild(el);
    $('#visorCerrar').onclick = cerrar;
    $('#visorCompleta').onclick = () => { const f = $('#visorCuerpo'); if (f.requestFullscreen) f.requestFullscreen().catch(() => {}); };
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !el.classList.contains('oculto') && !document.fullscreenElement) cerrar(); });
  }

  function abrir(titulo, sub, lista, pedida) {
    versiones = (lista || []).filter(v => Visor.vista(v.enlace).modo !== 'nada');
    if (!versiones.length) return;
    const i = Math.max(0, versiones.findIndex(v => v.version === pedida));
    if (Visor.vista(versiones[i].enlace).modo === 'nueva') { window.open(versiones[i].enlace, '_blank', 'noopener'); return; }
    montar();
    volverFoco = document.activeElement;
    $('#visorTit').textContent = titulo; $('#visorSub').textContent = sub || '';
    $('#visorVersiones').innerHTML = versiones.length > 1 ? versiones.map((v, k) =>
      '<button role="tab" type="button" data-v="' + k + '">' + esc(v.version) + '</button>').join('') : '';
    $('#visorVersiones').querySelectorAll('[data-v]').forEach(b => b.onclick = () => ver(+b.dataset.v));
    el.classList.remove('oculto'); document.body.classList.add('pa-visor-abierto');
    ver(i);
    $('#visorCerrar').focus();
  }

  function ver(i) {
    const v = versiones[i], x = Visor.vista(v.enlace), des = Visor.descarga(v.enlace);
    $('#visorVersiones').querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-selected', +b.dataset.v === i ? 'true' : 'false'));
    $('#visorDescargar').classList.toggle('oculto', !des);
    if (des) $('#visorDescargar').href = des;
    $('#visorCompleta').classList.toggle('oculto', x.modo !== 'incrustar' || !document.fullscreenEnabled);
    $('#visorCuerpo').innerHTML = x.modo === 'incrustar'
      ? '<iframe src="' + esc(x.url) + '" title="' + esc(v.version + ': ' + (v.nombre || '')) + '" allow="fullscreen; autoplay" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"' +
        // Presentación del portal: sus scripts corren, pero aislada en un origen propio: no ve la sesión ni esta página.
        (x.aislado ? ' sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"' : '') + '></iframe>'
      : '<div class="pantalla"><h2>' + esc(v.version) + '</h2><p>Este enlace no se puede mostrar aquí: se abre en una pestaña nueva.</p>' +
        '<a class="btn negro" href="' + esc(x.url) + '" target="_blank" rel="noopener">Abrir en una pestaña nueva</a></div>';
  }

  function cerrar() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    el.classList.add('oculto'); document.body.classList.remove('pa-visor-abierto');
    $('#visorCuerpo').innerHTML = '';
    if (volverFoco) volverFoco.focus();
  }

  window.VisorPantalla = { abrir, cerrar };
})();
