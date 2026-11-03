/* Contraste de TODO el texto visible de una página (3-nov-2026, rediseño ajuste 3).
 *
 * Se ejecuta DENTRO del navegador (page.evaluate(contraste.medir)). Para cada
 * elemento con texto propio y visible: su color contra el fondo que tiene
 * detrás (el primer fondo sólido subiendo por los padres, mezclando los
 * semitransparentes). Pide 4,5:1; 3:1 al texto grande (24 px, o 18,66 px en
 * negrita). No mide lo que tiene una imagen o un degradado detrás (no se
 * puede saber el color), lo deshabilitado ni lo oculto a lectores.
 * Devuelve { medidos, fallan: [{ texto, color, fondo, razon, minimo }] }.
 * Lo usan prueba-rediseno.js y las capturas.
 */
'use strict';
function medir() {
  const rgb = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const mezcla = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  /* Los fondos posibles detrás del elemento: el primer fondo sólido subiendo por los padres (mezclando los
     semitransparentes). Un degradado de colores lisos (la barra que se llena de Ocupación) da UN fondo por
     cada color: la letra tiene que leerse sobre todos. Una imagen: no se puede saber (null). */
  function fondos(el) {
    const capas = []; let grad = null;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (/url\(/.test(cs.backgroundImage) || !/gradient/.test(cs.backgroundImage)) return null;
        const cols = (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(rgb).filter(Boolean);
        if (!cols.length) return null;
        if (!grad) grad = { capas: capas.slice(), cols };
      }
      const c = rgb(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    const raiz = rgb(getComputedStyle(document.body).backgroundColor);
    if (raiz && raiz.a >= 1) base = raiz;
    const componer = (lista, f) => { for (let i = lista.length - 1; i >= 0; i--) f = lista[i].a >= 1 ? lista[i] : mezcla(lista[i], f); return f; };
    const solido = componer(capas, base);
    if (!grad) return [solido];
    // El degradado va sobre lo que hay debajo de su elemento; encima, las capas de los hijos.
    const debajo = componer(capas.slice(grad.capas.length), base);
    return grad.cols.map(c => componer(grad.capas, c.a >= 1 ? c : mezcla(c, debajo)));
  }
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) return false;
      if (e.getAttribute('aria-hidden') === 'true' || e.hidden) return false;
    }
    return true;
  };
  const fallan = []; let medidos = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName) || el.closest('svg, [disabled], .sr, .eq-imprimiendo, #eq-impresion')) continue;
    const propio = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!propio || !visible(el)) continue;
    const cs = getComputedStyle(el), color = rgb(cs.color);
    if (!color || color.a === 0) continue;   // letra transparente a propósito (p. ej. el número de una barra muy corta): no se lee, no se mide
    const fs = fondos(el);
    if (!fs) continue;
    // La opacidad de los padres también aclara la letra (se aproxima mezclándola con el fondo).
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    let razon = Infinity, f = fs[0];
    for (const fo of fs) {
      const txt = color.a < 1 || op < 1 ? mezcla({ r: color.r, g: color.g, b: color.b, a: color.a * op }, fo) : color;
      const L1 = lum(txt), L2 = lum(fo), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (r < razon) { razon = r; f = fo; }
    }
    const px = parseFloat(cs.fontSize), negrita = +cs.fontWeight >= 700, grande = px >= 24 || (px >= 18.66 && negrita);
    const minimo = grande ? 3 : 4.5;
    medidos++;
    if (razon < minimo - 0.02) fallan.push({ texto: el.textContent.trim().slice(0, 40), clase: (el.className && el.className.baseVal === undefined ? el.className : '') + '', color: cs.color,
      fondo: 'rgb(' + [f.r, f.g, f.b].map(Math.round).join(', ') + ')', razon: +razon.toFixed(2), minimo });
  }
  return { medidos, fallan };
}
if (typeof module !== 'undefined') module.exports = { medir };
