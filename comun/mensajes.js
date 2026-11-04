/* ==========================================================================
   Vida en Arte · MENSAJES A FAMILIAS (3-nov-2026): las cuentas

   Todo lo que decide a quién le llega un mensaje, en un solo lugar y sin
   tocar la pantalla (la pantalla es mensajes/index.html; la prueba,
   pruebas-portal/prueba-mensajes.js). Funciona en el navegador
   (window.Mensajes) y en node (module.exports).

   Lo que recibe es lo que manda mensajes/api.php › leer, YA filtrado en el
   servidor a los niños inscritos y activos (docs/ACCIONES_API.md › Mensajes):
     familias: [{ unidad, id, nino, telefono, correo, clases: [código] }]
     clases:   [{ codigo, servicio, dia, hora }]
     config:   [{ parametro, valor }]   (pestaña «Config mensajes» del Sheet)

   Reglas (docs/REGLAS_NEGOCIO.md R161–R170):
     · Grupos: Todo Vida en Arte; por unidad; por disciplina de After School
       (salen de las clases, no de una lista escrita aquí); por clase. Elegir
       varios = la unión.
     · Un correo por familia: sin mayúsculas ni espacios, aunque tenga varios
       hijos o esté en las dos unidades.
     · Los correos de la lista de exclusión (Config › «Correo excluido») nunca
       reciben: el niño pasa a «Sin correo».
     · Un correo con formato inválido se aparta y se avisa.
     · Tandas de «Destinatarios por tanda» (50 si falta), en copia oculta.
   ========================================================================== */
(function (raiz) {
  'use strict';

  const TODO = 'todo';
  const POR_DEFECTO = { porTanda: 50, avisoDia: 450, codigoPais: '507' };
  /* Un correo razonable: algo@algo.dominio, sin espacios ni comas (la coma separa la lista de Gmail). */
  const FORMATO = /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[a-z]{2,}$/i;
  const LARGO_GMAIL = 8000;   // más allá, Gmail puede no abrir el enlace: se avisa y queda «Copiar»

  const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const limpiarCorreo = c => String(c == null ? '' : c).replace(/\s+/g, '').toLowerCase();
  const correoValido = c => FORMATO.test(c);

  /** La pestaña «Config mensajes» en un objeto. Las filas que se repiten (exclusión, servicios fuera) se juntan. */
  function config(filas) {
    const c = { cuenta: '', porTanda: POR_DEFECTO.porTanda, avisoDia: POR_DEFECTO.avisoDia, codigoPais: POR_DEFECTO.codigoPais, excluidos: [], serviciosFuera: [] };
    (filas || []).forEach(f => {
      const p = norm(f.parametro), v = String(f.valor == null ? '' : f.valor).trim();
      if (p === norm('Cuenta de Gmail para mensajes')) c.cuenta = limpiarCorreo(v);
      else if (p === norm('Destinatarios por tanda')) { const n = parseInt(v, 10); if (n >= 1 && n <= 500) c.porTanda = n; }
      else if (p === norm('Aviso de familias por día')) { const n = parseInt(v, 10); if (n >= 1) c.avisoDia = n; }
      else if (p === norm('Código de país para WhatsApp')) { const d = v.replace(/\D/g, ''); if (d) c.codigoPais = d; }
      else if (p === norm('Correo excluido')) { const e = limpiarCorreo(v); if (e && !c.excluidos.includes(e)) c.excluidos.push(e); }
      else if (p === norm('Servicio fuera de Mensajes')) { if (v) c.serviciosFuera.push(v); }
    });
    if (c.cuenta && !correoValido(c.cuenta)) c.cuenta = '';
    return c;
  }

  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const ordenDia = d => { const i = DIAS.findIndex(x => norm(x) === norm(d)); return i < 0 ? 99 : i; };
  const nombreClase = c => (c.dia ? c.dia + ' ' : '') + (c.hora || '') + ' · ' + (c.servicio || c.codigo);

  /**
   * Los grupos que se pueden elegir, con los niños de cada uno.
   * [{ id, tipo: 'todo'|'unidad'|'disciplina'|'clase', nombre, ninos: Set de claves }]
   * La clave de un niño es «unidad|id». Solo aparecen grupos con algún niño.
   */
  function grupos(datos) {
    const fam = (datos && datos.familias) || [];
    const clases = ((datos && datos.clases) || []).slice();
    const clave = f => f.unidad + '|' + f.id;
    const out = [{ id: TODO, tipo: 'todo', nombre: 'Todo Vida en Arte', ninos: new Set(fam.map(clave)) }];
    const unidades = [];
    fam.forEach(f => { if (!unidades.includes(f.unidad)) unidades.push(f.unidad); });
    unidades.sort((a, b) => a.localeCompare(b, 'es')).forEach(u =>
      out.push({ id: 'u:' + u, tipo: 'unidad', nombre: u, ninos: new Set(fam.filter(f => f.unidad === u).map(clave)) }));
    const porCodigo = {};
    clases.forEach(c => { porCodigo[c.codigo] = c; });
    const servicios = [];
    clases.forEach(c => { if (c.servicio && !servicios.includes(c.servicio)) servicios.push(c.servicio); });
    servicios.sort((a, b) => a.localeCompare(b, 'es')).forEach(s => {
      const ninos = new Set(fam.filter(f => (f.clases || []).some(k => porCodigo[k] && porCodigo[k].servicio === s)).map(clave));
      if (ninos.size) out.push({ id: 'd:' + s, tipo: 'disciplina', nombre: s, ninos });
    });
    clases.sort((a, b) => ordenDia(a.dia) - ordenDia(b.dia) || String(a.hora).localeCompare(String(b.hora)) || String(a.servicio).localeCompare(String(b.servicio), 'es'))
      .forEach(c => {
        const ninos = new Set(fam.filter(f => (f.clases || []).includes(c.codigo)).map(clave));
        if (ninos.size) out.push({ id: 'c:' + c.codigo, tipo: 'clase', nombre: nombreClase(c), ninos });
      });
    return out;
  }

  /**
   * La lista para enviar a los grupos elegidos (ids de grupos()).
   *   correos       los correos únicos, en orden alfabético
   *   familias      cuántos (= correos.length)
   *   sinCorreo     [{ nino, unidad, grupo, telefono, whatsapp, motivo: 'vacio'|'excluido' }]
   *   invalidos     [{ nino, unidad, grupo, correo, telefono, whatsapp }]
   *   repetidos     cuántos niños compartían el correo de otro (se quitaron)
   *   excluidos     cuántos niños tenían un correo de la lista de exclusión
   *   excluidosCorreos  los correos de la lista que aparecieron en los datos
   *   ninos         cuántos niños hay en la unión
   */
  function armar(datos, elegidos, cfg) {
    cfg = cfg || config(datos && datos.config);
    const G = grupos(datos);
    const ids = new Set(elegidos || []);
    const fam = (datos && datos.familias) || [];
    const elegidas = G.filter(g => ids.has(g.id));
    const union = new Set();
    elegidas.forEach(g => g.ninos.forEach(k => union.add(k)));
    const excl = new Set(cfg.excluidos);
    const vistos = new Set(), sinCorreo = [], invalidos = [], exclVistos = new Set();
    let repetidos = 0, excluidos = 0, ninos = 0;
    fam.forEach(f => {
      const k = f.unidad + '|' + f.id;
      if (!union.has(k)) return;
      ninos++;
      const grupo = (elegidas.find(g => g.tipo === 'clase' && g.ninos.has(k)) || elegidas.find(g => g.tipo === 'disciplina' && g.ninos.has(k)) || {}).nombre || f.unidad;
      const tel = String(f.telefono || '').trim();
      const fila = { nino: f.nino, unidad: f.unidad, grupo, telefono: tel, whatsapp: enlaceWhatsapp(tel, cfg.codigoPais) };
      const c = limpiarCorreo(f.correo);
      if (!c) { sinCorreo.push(Object.assign(fila, { motivo: 'vacio' })); return; }
      if (excl.has(c)) { excluidos++; exclVistos.add(c); sinCorreo.push(Object.assign(fila, { motivo: 'excluido' })); return; }
      if (!correoValido(c)) { invalidos.push(Object.assign(fila, { correo: String(f.correo) })); return; }
      if (vistos.has(c)) { repetidos++; return; }
      vistos.add(c);
    });
    const orden = (a, b) => a.nino.localeCompare(b.nino, 'es');
    const correos = [...vistos].sort();
    return { correos, familias: correos.length, sinCorreo: sinCorreo.sort(orden), invalidos: invalidos.sort(orden),
             repetidos, excluidos, excluidosCorreos: [...exclVistos].sort(), ninos };
  }

  /** Cuántas familias (correos únicos y válidos) tiene cada grupo por sí solo: { id: n }. */
  function conteos(datos, cfg) {
    cfg = cfg || config(datos && datos.config);
    const r = {};
    grupos(datos).forEach(g => { r[g.id] = armar(datos, [g.id], cfg).familias; });
    return r;
  }

  /** Divide los correos en tandas de `max`. */
  function tandas(correos, max) {
    const n = Math.max(1, parseInt(max, 10) || POR_DEFECTO.porTanda), out = [];
    for (let i = 0; i < (correos || []).length; i += n) out.push(correos.slice(i, i + n));
    return out;
  }

  /** Enlace de WhatsApp de un teléfono: solo dígitos; a uno de 7 u 8 dígitos se le antepone el código de país. '' si no hay número. */
  function enlaceWhatsapp(tel, codigoPais) {
    const t = String(tel || '').trim();
    let d = t.replace(/\D/g, '');
    if (d.length < 7) return '';
    if (!t.startsWith('+') && (d.length === 7 || d.length === 8)) d = String(codigoPais || POR_DEFECTO.codigoPais).replace(/\D/g, '') + d;
    return 'https://wa.me/' + d;
  }

  /** La redacción de Gmail web con todo en copia oculta («Para» vacío). Con cuenta, abre esa (authuser). */
  function enlaceGmail({ cuenta, asunto, cuerpo, cco }) {
    const p = [];
    if (cuenta) p.push('authuser=' + encodeURIComponent(cuenta));
    p.push('view=cm', 'fs=1', 'tf=1', 'bcc=' + encodeURIComponent((cco || []).join(',')),
           'su=' + encodeURIComponent(asunto || ''), 'body=' + encodeURIComponent(cuerpo || ''));
    return 'https://mail.google.com/mail/?' + p.join('&');
  }

  /**
   * EL ENVÍO, detrás de una sola función (v1: Gmail). Para pasar a otro canal
   * (Resend) se cambia SOLO esto: la pantalla llama a Mensajes.enviar y lee
   * { canal, abierto, largo, demasiadoLargo }.
   *   tanda:   la lista de correos de esa tanda
   *   mensaje: { asunto, cuerpo }
   *   cfg:     config() (la cuenta de Gmail)
   *   abrir:   opcional, cómo abrir el enlace (por defecto window.open; las pruebas pasan otra)
   */
  function enviar(tanda, mensaje, cfg, abrir) {
    const url = enlaceGmail({ cuenta: (cfg && cfg.cuenta) || '', asunto: mensaje.asunto, cuerpo: mensaje.cuerpo, cco: tanda });
    /* Sin «noopener» en window.open: con él devuelve siempre null y no se sabría si el navegador lo bloqueó.
       Se corta el vínculo a mano. Tiene que llamarse dentro del clic (si no, el navegador lo bloquea). */
    const ab = abrir || (u => { const w = raiz.open ? raiz.open(u, '_blank') : null; if (w) { try { w.opener = null; } catch (e) { } } return !!w; });
    const abierto = ab(url) !== false;
    return { canal: 'gmail', url, abierto, largo: url.length, demasiadoLargo: url.length > LARGO_GMAIL };
  }

  /** Un ID para el envío (lo usa el registro para sumar las tandas a la misma fila). */
  function idEnvio() {
    const c = raiz.crypto;
    return (c && c.randomUUID) ? c.randomUUID() : 'env-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  const api = { TODO, LARGO_GMAIL, norm, limpiarCorreo, correoValido, config, grupos, armar, conteos, tandas, enlaceWhatsapp, enlaceGmail, enviar, idEnvio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.Mensajes = api;
})(typeof window !== 'undefined' ? window : globalThis);
