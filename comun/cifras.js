/* comun/cifras.js — cifras del Resumen de Dirección que salen de After School
 * (27-oct). Sin reglas nuevas: usa la ocupación que calcula el servidor
 * (leer.ocupacion, R02 y R07) y los cupos de la pestaña Clases, igual que la
 * pestaña Ocupación. Contrato en docs/ACCIONES_API.md › Resumen.
 * Sin datos ni llamadas: recibe el resultado de After School «leer».
 */
(function (raiz) {
  'use strict';

  const dosDig = n => (n < 10 ? '0' : '') + n;
  const isoDe = d => d.getFullYear() + '-' + dosDig(d.getMonth() + 1) + '-' + dosDig(d.getDate());
  const aFecha = iso => new Date(iso + 'T12:00:00');
  function sumarDias(iso, n) { const d = aFecha(iso); d.setDate(d.getDate() + n); return isoDe(d); }
  function lunesDe(iso) { const d = aFecha(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDe(d); }

  /** Inscritos y cupos de la semana que empieza el lunes dado, o null si leer() no la trae completa. */
  function semana(E, lunes, clases) {
    let inscritos = 0, cupos = 0;
    for (const c of clases) {
      const k = E.dias.indexOf(c.dia);
      if (k < 0) continue;
      const dia = E.ocupacion[sumarDias(lunes, k)];
      if (!dia) return null;   // ese día no vino en leer(): la semana no está completa
      inscritos += dia[c.codigo] ? dia[c.codigo].i : 0;
      cupos += c.cupo;
    }
    return cupos > 0 ? { inscritos, cupos, lunes } : null;
  }

  /**
   * Ocupación After School: en la semana de hoy, inscritos de cada clase
   * activa en su día ÷ cupos de esas clases. Tendencia: la misma cifra en las
   * semanas anteriores que vienen completas (si hay al menos dos semanas).
   * Devuelve { valor (0–1), inscritos, cupos, serie: [0–1…] | null } o null.
   */
  function ocupacionAS(E) {
    if (!E || !E.hoy || !E.ocupacion || !Array.isArray(E.clases) || !Array.isArray(E.dias)) return null;
    const clases = E.clases.filter(c => c.activa && c.cupo > 0);
    const hoy = lunesDe(E.hoy), ahora = semana(E, hoy, clases);
    if (!ahora) return null;
    const antes = [];
    for (let l = sumarDias(hoy, -7); ; l = sumarDias(l, -7)) {
      const s = semana(E, l, clases);
      if (!s) break;
      antes.unshift(s);
    }
    const serie = antes.concat([ahora]).map(s => s.inscritos / s.cupos);
    return { valor: ahora.inscritos / ahora.cupos, inscritos: ahora.inscritos, cupos: ahora.cupos, serie: serie.length >= 2 ? serie : null };
  }

  const Cifras = { ocupacionAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cifras;
  else raiz.Cifras = Cifras;
})(this);
