/* ==========================================================================
   Vida en Arte · Procesos › Equipo: piezas compartidas (29-oct-2026)

   Lo usan el organigrama y la ficha (comun/organigrama.js) y Mi lista
   (equipo/index.html). No pide datos: recibe lo que mandó Datos.equipo.

   · AREAS: el color de cada área, en UN SOLO LUGAR del código. Qué áreas
     hay y en qué orden salen de la pestaña Puestos; aquí solo su color.
       fondo  el color del área (cabeza de la columna, punto de la lista)
       texto  el texto sobre ese fondo (el naranja lleva texto negro)
       linea  sus líneas sobre blanco (3:1 o más): el naranja no llega, así
              que va en un naranja más oscuro; en la escena oscura del
              organigrama se usa el fondo.
     Un área que no esté aquí sale en gris.
   · momentosEn(texto, momentos): los momentos de «Horarios del servicio»
     que nombra un texto, con su hora. Busca el NOMBRE del momento dentro
     del texto, sin mayúsculas ni tildes y como palabras enteras; si dos se
     pisan («Salida del mediodía» dentro de «Preparación de la salida del
     mediodía»), gana el más largo. La hora es un dato del Sheet: cambiarla
     no cambia ningún contrato.
   ========================================================================== */
(function () {
  'use strict';
  const AREAS = {
    'direccion':      { fondo: '#111111', texto: '#FFFFFF', linea: '#111111' },
    'comercial':      { fondo: '#2E9D4F', texto: '#FFFFFF', linea: '#2E9D4F' },
    'administracion': { fondo: '#6B6B6B', texto: '#FFFFFF', linea: '#6B6B6B' },
    'operacion':      { fondo: '#D71C0E', texto: '#FFFFFF', linea: '#D71C0E' },
    'preschool':      { fondo: '#1974A8', texto: '#FFFFFF', linea: '#1974A8' },
    'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' },
    'veranito':       { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' }
  };
  const SIN_AREA = { fondo: '#555555', texto: '#FFFFFF', linea: '#555555' };
  const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const colorArea = a => AREAS[normal(a)] || SIN_AREA;

  const letra = c => /[a-z0-9ñ]/.test(c || '');
  /** [{momento, hora}] en el orden en que aparecen en el texto. */
  function momentosEn(texto, momentos) {
    const t = normal(texto), tomados = [], out = [];
    const lista = (momentos || []).filter(m => m && normal(m.momento)).slice().sort((a, b) => normal(b.momento).length - normal(a.momento).length);
    for (const m of lista) {
      const n = normal(m.momento);
      for (let i = t.indexOf(n); i >= 0; i = t.indexOf(n, i + 1)) {
        const fin = i + n.length;
        if (letra(t[i - 1]) || letra(t[fin])) continue;
        if (tomados.some(([a, b]) => i < b && fin > a)) continue;
        tomados.push([i, fin]); out.push({ momento: m.momento, hora: m.hora || '', en: i });
        break;
      }
    }
    return out.sort((a, b) => a.en - b.en).map(({ momento, hora }) => ({ momento, hora }));
  }

  /** Las etiquetas «Momento · hora» para poner junto a un texto (HTML, ya escapado). */
  function etiquetasHora(texto, momentos, esc) {
    return momentosEn(texto, momentos).filter(m => m.hora)
      .map(m => '<span class="eq-hora">' + esc(m.momento) + ' · ' + esc(m.hora) + '</span>').join('');
  }

  window.Puestos = { AREAS, colorArea, momentosEn, etiquetasHora, normal };
})();
