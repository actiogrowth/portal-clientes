/* ==========================================================================
   Vida en Arte 360 · APARIENCIA: claro, oscuro o automático (3-nov-2026,
   rediseño, ajuste 3)

   Se carga en el <head> de cada página ANTES de los estilos, sin «defer»:
   pone <html data-modo="claro|oscuro"> antes de pintar, así una página que
   abre en oscuro no parpadea en blanco. Todos los colores salen de los
   tokens de comun/vea.css, que tienen un segundo juego para data-modo="oscuro".

   La elección se guarda por usuario en este navegador:
     vea360.apariencia.<usuario>   'claro' | 'oscuro' | 'auto'
     vea360.apariencia.ultimo      la del último que entró (para pintar antes
                                   de saber quién es: la sesión llega después)
   Por defecto, 'claro' (5-nov, ajuste 4: decisión de Marco; antes era
   'auto'). Quien ya eligió algo a mano (la clave por usuario existe) lo
   conserva. 'auto' sigue al dispositivo (prefers-color-scheme) y cambia solo
   si el dispositivo cambia; se elige en el menú del usuario › Apariencia.
   El botón sol/luna de la barra superior alterna Claro y Oscuro
   (Apariencia.alternar). La pantalla de entrada usa la última.
   Al imprimir (el PDF del contrato o Ctrl P) la página pasa a claro.

     Apariencia.actual()            'claro' | 'oscuro' | 'auto'
     Apariencia.modo()              'claro' | 'oscuro' (lo que se ve)
     Apariencia.elegir(p, usuario)  guarda y aplica
     Apariencia.alternar(usuario)   Claro ↔ Oscuro según lo que se ve (desde
                                    Automático pasa al contrario de lo que
                                    muestra el dispositivo)
     Apariencia.deUsuario(usuario)  aplica la del usuario (al llegar la sesión)
   ========================================================================== */
(function () {
  'use strict';
  var CLAVE = 'vea360.apariencia.', OPCIONES = ['claro', 'oscuro', 'auto'], DEFECTO = 'claro';
  var raiz = document.documentElement, oscuroDisp = null, actual = DEFECTO, imprimiendo = false;
  function leer(k) { try { return localStorage.getItem(CLAVE + k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(CLAVE + k, v); } catch (e) { } }
  function valida(p) { return OPCIONES.indexOf(p) >= 0 ? p : DEFECTO; }
  try { oscuroDisp = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { }
  function modo() { return actual === 'oscuro' || (actual === 'auto' && !!(oscuroDisp && oscuroDisp.matches)) ? 'oscuro' : 'claro'; }
  function aplicar(p) {
    actual = valida(p);
    raiz.setAttribute('data-apariencia', actual);
    raiz.setAttribute('data-modo', imprimiendo ? 'claro' : modo());
    try { window.dispatchEvent(new CustomEvent('vea-apariencia', { detail: { apariencia: actual, modo: modo() } })); } catch (e) { }
  }
  // Automático: si el dispositivo cambia, la página cambia sola.
  if (oscuroDisp) {
    var alCambiar = function () { if (actual === 'auto') aplicar('auto'); };
    if (oscuroDisp.addEventListener) oscuroDisp.addEventListener('change', alCambiar); else if (oscuroDisp.addListener) oscuroDisp.addListener(alCambiar);
  }
  // El PDF y la impresión, siempre en claro.
  window.addEventListener('beforeprint', function () { imprimiendo = true; raiz.setAttribute('data-modo', 'claro'); });
  window.addEventListener('afterprint', function () { imprimiendo = false; raiz.setAttribute('data-modo', modo()); });
  aplicar(leer('ultimo'));
  window.Apariencia = {
    OPCIONES: OPCIONES,
    actual: function () { return actual; },
    modo: modo,
    elegir: function (p, usuario) { p = valida(p); if (usuario) guardar(usuario, p); guardar('ultimo', p); aplicar(p); },
    alternar: function (usuario) { window.Apariencia.elegir(modo() === 'oscuro' ? 'claro' : 'oscuro', usuario); },
    deUsuario: function (usuario) { if (!usuario) return; var p = valida(leer(usuario)); guardar('ultimo', p); if (p !== actual) aplicar(p); }
  };
})();
