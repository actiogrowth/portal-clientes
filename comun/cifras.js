/* comun/cifras.js — las cifras del Resumen del negocio (26-oct; 26-oct: el
 * Resumen del negocio entero; 27-oct: altas, bajas y pruebas que se inscriben
 * de After School, R134–R137). Cada cifra usa una regla escrita en
 * docs/REGLAS_NEGOCIO.md (citada al lado) y lo que no tiene regla o dato
 * devuelve null con su motivo, para que la pantalla diga
 * «Próximamente». Sin datos ni llamadas: recibe lo que ya leyó la página.
 * Contrato en docs/ACCIONES_API.md › Resumen del negocio. Lo usan
 * resumen/index.html y la pestaña Ocupación de After School.
 */
(function (raiz) {
  'use strict';

  const dosDig = n => (n < 10 ? '0' : '') + n;
  const isoDe = d => d.getFullYear() + '-' + dosDig(d.getMonth() + 1) + '-' + dosDig(d.getDate());
  const aFecha = iso => new Date(iso + 'T12:00:00');
  function sumarDias(iso, n) { const d = aFecha(iso); d.setDate(d.getDate() + n); return isoDe(d); }
  function lunesDe(iso) { const d = aFecha(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDe(d); }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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
   * Ocupación After School (R125): en la semana de hoy, inscritos de cada clase
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

  /* ── Resumen del negocio (26-oct) ─────────────────────────────────────── */

  /** Períodos: mes «AAAA-MM» o año «AAAA». */
  const esMes = p => /^\d{4}-\d{2}$/.test(p);
  function mesMas(p, n) { const a = +p.slice(0, 4), m = +p.slice(5, 7) - 1 + n, d = new Date(a, m, 1); return d.getFullYear() + '-' + dosDig(d.getMonth() + 1); }
  /** El período anterior y el mismo del año anterior (en un año son el mismo: se da uno). */
  function comparables(p) {
    if (esMes(p)) return { anterior: mesMas(p, -1), anioAnterior: (+p.slice(0, 4) - 1) + p.slice(4) };
    return { anterior: String(+p - 1), anioAnterior: null };
  }
  function nombrePeriodo(p) {
    if (esMes(p)) { const s = MESES[+p.slice(5, 7) - 1]; return s.charAt(0).toUpperCase() + s.slice(1) + ' ' + p.slice(0, 4); }
    return 'Año ' + p;
  }

  /* Las cifras que son un porcentaje: su meta se escribe «70» o «70 %» (Sheets guarda 0,7). */
  const CIFRAS_PORCENTAJE = ['Ocupación', 'Pruebas que se inscriben', 'Margen neto'];
  const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /**
   * La meta de una cifra, una unidad («Negocio» para el total) y un período,
   * de la pestaña Metas. Exacta por período; una cifra que es porcentaje
   * también vale con la meta del año si el mes no tiene la suya.
   * → { valor (en % si es porcentaje), tentativa: estado distinto de «Confirmada», periodo } o null.
   */
  function metaDe(metas, cifra, unidad, periodo) {
    const es = m => normal(m.cifra) === normal(cifra) && normal(m.unidad) === normal(unidad);
    let m = (metas || []).find(x => es(x) && x.periodo === periodo);
    if (!m && esMes(periodo) && CIFRAS_PORCENTAJE.includes(cifra)) m = (metas || []).find(x => es(x) && x.periodo === periodo.slice(0, 4));
    if (!m || typeof m.valor !== 'number' || isNaN(m.valor)) return null;
    const valor = CIFRAS_PORCENTAJE.includes(cifra) && Math.abs(m.valor) <= 1 ? m.valor * 100 : m.valor;
    return { valor, tentativa: normal(m.estado) !== 'confirmada', periodo: m.periodo };
  }

  /**
   * Preschool en un período, con las reglas del tablero de Preschool (las
   * calcula resumen/api.php): activos = «Activo ese mes» del mes (en un año,
   * el último mes con datos); altas y bajas = las del mes (en un año, la
   * suma); ocupación = activos ÷ «Capacidad máxima». null si no hay datos.
   * aviso (28-oct, R140) = la nota que manda el servidor («Datos en revisión»).
   */
  function preschoolEn(pre, p) {
    if (!pre || !pre.meses) return null;
    const ocup = a => pre.capacidad ? a / pre.capacidad : null, aviso = typeof pre.nota === 'string' ? pre.nota.trim() : '';
    if (esMes(p)) {
      const m = pre.meses[p];
      return m ? { activos: m.activos, altas: m.altas, bajas: m.bajas, ocupacion: ocup(m.activos), aviso } : null;
    }
    const ms = Object.keys(pre.meses).filter(k => k.slice(0, 4) === p).sort();
    if (!ms.length) return null;
    const ult = pre.meses[ms[ms.length - 1]];
    return { activos: ult.activos, altas: ms.reduce((a, k) => a + pre.meses[k].altas, 0), bajas: ms.reduce((a, k) => a + pre.meses[k].bajas, 0), ocupacion: ocup(ult.activos), hasta: ms[ms.length - 1], aviso };
  }

  /* ── After School: altas, bajas y pruebas que se inscriben (27-oct) ──── */

  const finDeMes = p => isoDe(new Date(+p.slice(0, 4), +p.slice(5, 7), 0));
  const fechaCorta = iso => +iso.slice(8, 10) + ' de ' + MESES[+iso.slice(5, 7) - 1];

  /**
   * El tramo del período que la hoja de After School tiene completo: desde
   * «Cifras del Resumen desde» (Config; antes solo está lo que trajo la carga
   * de Poliwin) hasta hoy. parcial = el período empieza antes de esa fecha.
   * → { ini, fin, parcial } o null (nada del período está cubierto).
   */
  function cobertura(E, p) {
    const desde = E.config && E.config.resumenDesde;
    if (!desde) return null;
    const a = esMes(p) ? p + '-01' : p + '-01-01', b = esMes(p) ? finDeMes(p) : p + '-12-31';
    const ini = a < desde ? desde : a, fin = b > E.hoy ? E.hoy : b;
    return ini <= fin ? { ini, fin, parcial: ini > a } : null;
  }

  /** Las altas de cada niño en After School, con las inscripciones activas y las cerradas: { idNino: [alta…] }. */
  function altasPorNino(E) {
    const r = {};
    (E.inscripciones || []).concat(E.inscripcionesCerradas || []).forEach(i => { if (i.alta) (r[i.idNino] = r[i.idNino] || []).push(i.alta); });
    return r;
  }

  /** R134: altas = niños cuya PRIMERA inscripción cae en el tramo (un cambio de clase, una segunda clase o un regreso no son alta). */
  function altasAS(E, c) {
    return Object.values(altasPorNino(E)).map(l => l.reduce((m, a) => a < m ? a : m)).filter(a => a >= c.ini && a <= c.fin).length;
  }

  /** R135: bajas = niños con una baja total (pestaña Bajas) en el tramo, cada uno una vez. Dejar una clase no es baja. */
  function bajasAS(E, c) {
    return new Set(E.bajas.filter(b => b.fecha >= c.ini && b.fecha <= c.fin).map(b => b.idNino)).size;
  }

  /**
   * R136: de las pruebas realizadas en el tramo (Tipo «Prueba» y Estado
   * «Asistió»: ni canceladas, ni sin resultado, ni reposiciones ni
   * eventuales), las que tienen una inscripción del niño con alta entre el
   * día de la prueba y N días después (N = «Días para que una prueba cuente
   * como inscrita», Config). enCurso = alguna sin inscripción todavía puede
   * inscribirse (su plazo no terminó).
   */
  function pruebasAS(E, c, n) {
    const altas = altasPorNino(E);
    const hechas = (E.pruebas || []).filter(x => (x.tipo || 'Prueba') === 'Prueba' && x.estado === 'Asistió' && x.fecha >= c.ini && x.fecha <= c.fin);
    let si = 0, enCurso = false;
    for (const x of hechas) {
      const limite = sumarDias(x.fecha, n);
      if ((altas[x.idNino] || []).some(a => a >= x.fecha && a <= limite)) si++;
      else if (limite >= E.hoy) enCurso = true;
    }
    return hechas.length ? { valor: si / hechas.length, inscritas: si, realizadas: hechas.length, enCurso } : null;
  }

  /**
   * After School en un período. Activos y ocupación, solo el período en curso:
   * activos = niños en estado «Activo», cada uno una vez aunque esté en dos
   * clases (la cifra de la pestaña Ocupación); ocupación = R125 (esta semana).
   * Altas, bajas y pruebas que se inscriben (R134–R136): cualquier período
   * que la hoja tenga cubierto (cobertura). Lo que no se puede dar lleva su
   * motivo en «motivos». null si no hay nada del período.
   */
  function afterSchoolEn(E, p) {
    if (!E || !E.hoy) return null;
    const actual = E.hoy.slice(0, esMes(p) ? 7 : 4) === p, c = cobertura(E, p);
    if (!actual && !c) return null;
    const r = { activos: null, ocupacion: null, ocupacionNota: '', altas: null, bajas: null, pruebas: null, pruebasNota: '', enCurso: false,
      parcial: !!(c && c.parcial), desde: c && c.parcial ? c.ini : '', motivos: {} };
    if (actual) {
      r.activos = new Set((E.ninos || []).filter(n => n.estado === 'Activo').map(n => n.id)).size;
      const o = ocupacionAS(E);
      if (o) { r.ocupacion = o.valor; r.ocupacionNota = o.inscritos + ' de ' + o.cupos + ' cupos, esta semana'; }
    } else r.motivos.activos = r.motivos.ocupacion = 'Solo el período en curso';
    const desde = E.config && E.config.resumenDesde;
    if (!c) {
      r.motivos.altas = r.motivos.bajas = r.motivos.pruebas = desde ? 'Sin datos: After School cuenta desde el ' + fechaCorta(desde) : 'Falta en Config de After School: «Cifras del Resumen desde»';
      return r;
    }
    r.altas = altasAS(E, c);
    if (Array.isArray(E.bajas)) r.bajas = bajasAS(E, c);
    else r.motivos.bajas = 'Falta publicar la versión nueva del Apps Script de After School';
    const n = E.config.diasInscribe;
    if (!(n >= 1)) r.motivos.pruebas = 'Falta en Config de After School: «Días para que una prueba cuente como inscrita»';
    else {
      const pr = pruebasAS(E, c, n);
      if (pr) { r.pruebas = pr.valor; r.enCurso = pr.enCurso; r.pruebasNota = pr.inscritas + ' de ' + pr.realizadas + ' pruebas' + (pr.enCurso ? ' · en curso' : ''); }
      else r.motivos.pruebas = 'Sin pruebas realizadas en el período';
    }
    return r;
  }

  /**
   * Finanzas de un período, del contrato de docs/ACCIONES_API.md › Contrato de
   * finanzas. Hoy no hay fuente: con finanzas null, { disponible: false }.
   * Margen de las unidades = facturación − costos; utilidad neta = margen de
   * las unidades − gastos comunes; margen neto = utilidad ÷ facturación.
   */
  function finanzasEn(F, p) {
    const meses = F && F.meses ? Object.keys(F.meses).filter(k => esMes(p) ? k === p : k.slice(0, 4) === p) : [];
    if (!meses.length) return { disponible: false };
    let facturacion = 0, costos = 0, gastos = 0, cobrado = 0, porCobrar = 0, familias = 0;
    const unidades = {};
    for (const k of meses) {
      const m = F.meses[k];
      for (const [u, x] of Object.entries(m.unidades || {})) {
        const v = unidades[u] || (unidades[u] = { facturacion: 0, costos: 0 });
        v.facturacion += +x.facturacion || 0; v.costos += +x.costos || 0;
        facturacion += +x.facturacion || 0; costos += +x.costos || 0;
      }
      gastos += +m.gastosComunes || 0; cobrado += +m.cobrado || 0; porCobrar += +m.porCobrar || 0; familias = +m.familiasPorCobrar || familias;
    }
    Object.values(unidades).forEach(v => { v.margen = v.facturacion - v.costos; });
    const margen = facturacion - costos, utilidad = margen - gastos;
    return { disponible: true, facturacion, costos, margen, gastosComunes: gastos, utilidad, margenNeto: facturacion ? utilidad / facturacion : null,
      cobrado, porCobrar, cobradoPct: cobrado + porCobrar ? cobrado / (cobrado + porCobrar) : null, familiasPorCobrar: familias, unidades };
  }

  /** La serie de 12 meses que termina en el mes dado (para el gráfico): [{mes, facturacion, costosYGastos, utilidad} | {mes, sin: true}]. */
  function serieFinanzas(F, mes) {
    return Array.from({ length: 12 }, (_, i) => mesMas(mes, i - 11)).map(m => {
      const f = finanzasEn(F, m);
      return f.disponible ? { mes: m, facturacion: f.facturacion, costosYGastos: f.costos + f.gastosComunes, utilidad: f.utilidad } : { mes: m, sin: true };
    });
  }

  const UNIDADES = ['Preschool', 'After School', 'Veranito', 'Baby & Me', 'Cumpleaños'];

  /**
   * Todo el Resumen del negocio de un período.
   *   d: { periodo, E (After School «leer»), pre (resumen/api.php › preschool), metas, finanzas }
   * Cada cifra: { valor | null, motivo?, anterior?, anioAnterior?, meta? }.
   */
  function resumenNegocio(d) {
    const p = d.periodo, cmp = comparables(p), metas = d.metas || [];
    const unidadEn = (u, q) => u === 'Preschool' ? preschoolEn(d.pre, q) : u === 'After School' ? afterSchoolEn(d.E, q) : null;
    /* Un período que la hoja no tiene completo (parcial) no se usa para comparar. */
    const comparar = (u, campo) => {
      const ok = x => x && !x.parcial && x[campo] != null;
      const a = unidadEn(u, cmp.anterior), b = cmp.anioAnterior ? unidadEn(u, cmp.anioAnterior) : null;
      return { anterior: ok(a) ? a[campo] : null, anioAnterior: ok(b) ? b[campo] : null };
    };
    const unidades = UNIDADES.map(u => {
      const x = unidadEn(u, p);
      const cifra = (campo, nombreMeta) => {
        const v = x && x[campo] != null ? x[campo] : null;
        const r = { valor: v, motivo: v !== null ? '' : (x && x.motivos && x.motivos[campo]) || 'Sin datos' };
        if (v !== null) Object.assign(r, comparar(u, campo));
        if (nombreMeta) r.meta = metaDe(metas, nombreMeta, u, p);
        return r;
      };
      return { nombre: u, datos: !!x, ocupacion: cifra('ocupacion', 'Ocupación'), ocupacionNota: x && x.ocupacionNota || '',
        activos: cifra('activos', 'Niños activos'), altas: cifra('altas', 'Altas'), bajas: cifra('bajas', 'Bajas'), hasta: x && x.hasta || '',
        pruebas: cifra('pruebas', 'Pruebas que se inscriben'), pruebasNota: x && x.pruebasNota || '', enCurso: !!(x && x.enCurso), desde: x && x.desde || '', aviso: x && x.aviso || '' };
    });
    const fin = finanzasEn(d.finanzas, p);
    const finanzas = Object.assign({ periodo: p, anterior: finanzasEn(d.finanzas, cmp.anterior), anioAnterior: cmp.anioAnterior ? finanzasEn(d.finanzas, cmp.anioAnterior) : { disponible: false },
      metaMargenNeto: metaDe(metas, 'Margen neto', 'Negocio', p), metaFacturacion: metaDe(metas, 'Facturación', 'Negocio', p) }, fin);
    finanzas.unidades = fin.disponible ? fin.unidades : {};
    unidades.forEach(u => { const f = finanzas.unidades[u.nombre]; u.facturacion = f ? f.facturacion : null; u.margen = f ? f.margen : null; });
    /* Niños activos del negocio: el total necesita reconocer al mismo niño en
       dos unidades (After School y Preschool tienen IDs distintos), y esa regla
       no existe. Sumar contaría dos veces: no se suma (R128).
       Altas y bajas del negocio (R137): la suma de las de cada unidad, con su
       desglose; son movimientos de cada unidad, no niños distintos. Sin el
       dato de una unidad, no hay total. Pruebas que se inscriben: las de After
       School, la única unidad con pruebas en el portal. */
    const conDatos = ['Preschool', 'After School'].map(n => unidades.find(u => u.nombre === n));
    const sumaDe = (campo, nombreMeta) => {
      const desglose = conDatos.map(u => ({ unidad: u.nombre, valor: u[campo].valor, desde: u.desde, aviso: u.aviso }));
      const faltan = desglose.filter(x => x.valor === null).map(x => x.unidad);
      const total = k => conDatos.every(u => u[campo][k] != null) ? conDatos.reduce((t, u) => t + u[campo][k], 0) : null;
      return { valor: faltan.length ? null : desglose.reduce((t, x) => t + x.valor, 0), motivo: faltan.length ? 'Faltan los datos de ' + faltan.join(' y ') : '',
        desglose, anterior: faltan.length ? null : total('anterior'), anioAnterior: faltan.length ? null : total('anioAnterior'), meta: metaDe(metas, nombreMeta, 'Negocio', p) };
    };
    const asU = conDatos[1];
    const ninos = {
      activos: { valor: null, motivo: 'Falta la regla para reconocer al mismo niño en dos unidades', meta: metaDe(metas, 'Niños activos', 'Negocio', p) },
      altas: sumaDe('altas', 'Altas'),
      bajas: sumaDe('bajas', 'Bajas'),
      pruebas: Object.assign({}, asU.pruebas, { desglose: [{ unidad: 'After School', valor: asU.pruebas.valor, desde: asU.desde, aviso: asU.aviso }], nota: asU.pruebasNota, enCurso: asU.enCurso,
        meta: metaDe(metas, 'Pruebas que se inscriben', 'Negocio', p) || asU.pruebas.meta })
    };
    return { periodo: p, nombre: nombrePeriodo(p), comparables: cmp, finanzas, ninos, unidades, alertas: alertas(unidades, finanzas) };
  }

  /**
   * «Para mirar» (R129): solo excepciones, como mucho tres, la de mayor
   * distancia a su meta primero. Sin meta escrita en la pestaña Metas no hay
   * alerta: «lo normal» lo fija Vida en Arte ahí, no el portal.
   *   · ocupación de una unidad por debajo de su meta «Ocupación»;
   *   · bajas de una unidad por encima de su meta «Bajas» (el tope normal);
   *   · margen neto del negocio por debajo de su meta «Margen neto».
   */
  function alertas(unidades, finanzas) {
    const out = [];
    for (const u of unidades) {
      const o = u.ocupacion;
      if (o.valor !== null && o.meta && o.valor * 100 < o.meta.valor)
        out.push({ tipo: 'ocupacion', unidad: u.nombre, valor: o.valor * 100, meta: o.meta, aviso: u.aviso, distancia: (o.meta.valor - o.valor * 100) / Math.max(1, o.meta.valor) });
      const b = u.bajas;
      if (b.valor !== null && b.meta && b.valor > b.meta.valor)
        out.push({ tipo: 'bajas', unidad: u.nombre, valor: b.valor, meta: b.meta, aviso: u.aviso, distancia: (b.valor - b.meta.valor) / Math.max(1, b.meta.valor) });
    }
    if (finanzas.disponible && finanzas.margenNeto !== null && finanzas.metaMargenNeto && finanzas.margenNeto * 100 < finanzas.metaMargenNeto.valor)
      out.push({ tipo: 'margen', unidad: 'Negocio', valor: finanzas.margenNeto * 100, meta: finanzas.metaMargenNeto,
        distancia: (finanzas.metaMargenNeto.valor - finanzas.margenNeto * 100) / Math.max(1, Math.abs(finanzas.metaMargenNeto.valor)) });
    return out.sort((a, b) => b.distancia - a.distancia).slice(0, 3);
  }

  const Cifras = { ocupacionAS, metaDe, preschoolEn, afterSchoolEn, cobertura, finanzasEn, serieFinanzas, resumenNegocio, alertas, comparables, nombrePeriodo, mesMas, UNIDADES };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cifras;
  else raiz.Cifras = Cifras;
})(this);
