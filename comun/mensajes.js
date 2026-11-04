/* ==========================================================================
   Vida en Arte · MENSAJES A FAMILIAS (3-nov-2026; 5-nov: envía el servidor): las cuentas

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
     · Tandas de «Destinatarios por tanda» (50 si falta), nunca más grandes que
       «Máximo de correos por hora» (100 si falta).

   5-nov: el servidor ya clasifica cada correo (mensajes/api.php ›
   ms_clasificar, el único que ve la lista de exclusión) y manda cada familia
   con «estadoCorreo» (ok | vacio | excluido | invalido) y «clave», la huella del
   correo. Los hermanos tienen la misma huella: «un correo por familia» se
   cuenta por huella. Quien no puede enviar (Comercial) recibe las familias SIN
   el correo: las cifras y los grupos salen igual. Las tandas son listas de
   huellas; el servidor las vuelve a buscar y envía. Si una familia llega sin
   «estadoCorreo» (datos de antes), se clasifica aquí como en v1.
   ========================================================================== */
(function (raiz) {
  'use strict';

  const TODO = 'todo';
  const POR_DEFECTO = { porTanda: 50, avisoDia: 450, codigoPais: '507', maxHora: 100 };
  /* Un correo razonable: algo@algo.dominio, sin espacios ni comas. El mismo de mensajes/correo.php (MSJ_FORMATO). */
  const FORMATO = /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[a-z]{2,}$/i;

  const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const limpiarCorreo = c => String(c == null ? '' : c).replace(/\s+/g, '').toLowerCase();
  const correoValido = c => FORMATO.test(c);

  /** La pestaña «Config mensajes» en un objeto. Las filas que se repiten (exclusión, servicios fuera) se juntan. */
  function config(filas) {
    const c = { porTanda: POR_DEFECTO.porTanda, avisoDia: POR_DEFECTO.avisoDia, codigoPais: POR_DEFECTO.codigoPais, maxHora: POR_DEFECTO.maxHora, excluidos: [], serviciosFuera: [] };
    (filas || []).forEach(f => {
      const p = norm(f.parametro), v = String(f.valor == null ? '' : f.valor).trim();
      if (p === norm('Destinatarios por tanda')) { const n = parseInt(v, 10); if (n >= 1 && n <= 500) c.porTanda = n; }
      else if (p === norm('Máximo de correos por hora')) { const n = parseInt(v.replace(/\D/g, ''), 10); if (n >= 1) c.maxHora = n; }
      else if (p === norm('Aviso de familias por día')) { const n = parseInt(v, 10); if (n >= 1) c.avisoDia = n; }
      else if (p === norm('Código de país para WhatsApp')) { const d = v.replace(/\D/g, ''); if (d) c.codigoPais = d; }
      else if (p === norm('Correo excluido')) { const e = limpiarCorreo(v); if (e && !c.excluidos.includes(e)) c.excluidos.push(e); }
      else if (p === norm('Servicio fuera de Mensajes')) { if (v) c.serviciosFuera.push(v); }
    });
    c.porTanda = Math.min(c.porTanda, c.maxHora);   // una tanda que no cabe en una hora no podría salir nunca
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

  /** El estado del correo de una familia: el que mandó el servidor o, en datos de antes, calculado aquí. */
  function estadoDe(f, excl) {
    if (f.estadoCorreo) return { estado: f.estadoCorreo, clave: f.clave || '', correo: f.correo == null ? '' : String(f.correo) };
    const c = limpiarCorreo(f.correo);
    if (!c) return { estado: 'vacio', clave: '', correo: '' };
    if (excl.has(c)) return { estado: 'excluido', clave: '', correo: c };
    if (!correoValido(c)) return { estado: 'invalido', clave: '', correo: String(f.correo) };
    return { estado: 'ok', clave: c, correo: c };
  }

  /**
   * La lista para enviar a los grupos elegidos (ids de grupos()).
   *   destinos      [{ clave, correo }] uno por familia, por orden de clave
   *                 (el correo viene vacío para quien no puede enviar)
   *   claves        las huellas (lo que se manda al servidor, por tandas)
   *   correos       los correos únicos que se conocen (para «Copiar correos»)
   *   familias      cuántos (= destinos.length)
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
    const vistos = new Map(), sinCorreo = [], invalidos = [], exclVistos = new Set();
    let repetidos = 0, excluidos = 0, ninos = 0;
    fam.forEach(f => {
      const k = f.unidad + '|' + f.id;
      if (!union.has(k)) return;
      ninos++;
      const grupo = (elegidas.find(g => g.tipo === 'clase' && g.ninos.has(k)) || elegidas.find(g => g.tipo === 'disciplina' && g.ninos.has(k)) || {}).nombre || f.unidad;
      const tel = String(f.telefono || '').trim();
      const fila = { nino: f.nino, unidad: f.unidad, grupo, telefono: tel, whatsapp: enlaceWhatsapp(tel, cfg.codigoPais) };
      const e = estadoDe(f, excl);
      if (e.estado === 'vacio') { sinCorreo.push(Object.assign(fila, { motivo: 'vacio' })); return; }
      if (e.estado === 'excluido') { excluidos++; if (e.correo) exclVistos.add(e.correo); sinCorreo.push(Object.assign(fila, { motivo: 'excluido' })); return; }
      if (e.estado !== 'ok' || !e.clave) { invalidos.push(Object.assign(fila, { correo: e.correo })); return; }
      if (vistos.has(e.clave)) { repetidos++; return; }
      vistos.set(e.clave, e.correo);
    });
    const orden = (a, b) => a.nino.localeCompare(b.nino, 'es');
    const destinos = [...vistos.keys()].sort().map(clave => ({ clave, correo: vistos.get(clave) }));
    return { destinos, claves: destinos.map(d => d.clave), correos: destinos.map(d => d.correo).filter(Boolean).sort(), familias: destinos.length,
             sinCorreo: sinCorreo.sort(orden), invalidos: invalidos.sort(orden), repetidos, excluidos, excluidosCorreos: [...exclVistos].sort(), ninos };
  }

  /** Cuántas familias (correos únicos y válidos) tiene cada grupo por sí solo: { id: n }. */
  function conteos(datos, cfg) {
    cfg = cfg || config(datos && datos.config);
    const r = {};
    grupos(datos).forEach(g => { r[g.id] = armar(datos, [g.id], cfg).familias; });
    return r;
  }

  /** Divide una lista (las familias de armar().destinos) en tandas de `max`. */
  function tandas(lista, max) {
    const n = Math.max(1, parseInt(max, 10) || POR_DEFECTO.porTanda), out = [];
    for (let i = 0; i < (lista || []).length; i += n) out.push(lista.slice(i, i + n));
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

  /**
   * EL ENVÍO, detrás de una sola función (5-nov: lo hace el SERVIDOR, desde el
   * buzón del hosting). Para cambiar de canal (Resend…) se cambia el servidor;
   * la pantalla sigue llamando a Mensajes.enviar y leyendo lo mismo.
   *   pedido: { idEnvio, tanda, tandas, claves, asunto, cuerpo, plantilla, grupos, familias, sinCorreo }
   *           (claves: las huellas de ESA tanda; los correos los pone el servidor)
   *   transporte: opcional (por defecto Datos.mensajes.enviar; las pruebas pasan otro)
   * Devuelve la promesa del «resultado» del servidor:
   *   { estado: completa | detenida | limite | ocupado | cambiado, enviadas[], yaEstaban[], fallidas[{clave, motivo}],
   *     inciertas[], pendientes[], total: {enviadas, fallidas}, hora: {usados, max, libreA}, motivo, registro }
   */
  function enviar(pedido, transporte) {
    const t = transporte || (raiz.Datos && raiz.Datos.mensajes && raiz.Datos.mensajes.enviar);
    if (!t) return Promise.reject(new Error('No hay con qué enviar.'));
    const p = Object.assign({}, pedido, { claves: (pedido.claves || []).slice() });
    return Promise.resolve(t(p)).then(j => (j && j.resultado) || j);
  }

  /** «15:42»: la hora (en la zona del que mira) de una marca de tiempo en segundos. */
  function horaDe(segundos) {
    const d = new Date(Number(segundos) * 1000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /** Un ID para el envío (lo usa el registro para sumar las tandas a la misma fila). */
  function idEnvio() {
    const c = raiz.crypto;
    return (c && c.randomUUID) ? c.randomUUID() : 'env-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  const api = { TODO, norm, limpiarCorreo, correoValido, config, grupos, armar, conteos, tandas, enlaceWhatsapp, enviar, horaDe, idEnvio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.Mensajes = api;
})(typeof window !== 'undefined' ? window : globalThis);
