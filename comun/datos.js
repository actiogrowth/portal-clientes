/* ==========================================================================
   Vida en Arte · CAPA DE DATOS del portal (21-oct-2026)

   Todas las páginas (login, cambiar contraseña, portada, After School con
   Pasar lista, Configuración) piden y guardan datos SOLO a través de este
   módulo: ninguna pantalla llama a api.php ni a otro PHP por su cuenta.
   Al migrar a Firebase se reemplaza este archivo y nada más: las pantallas
   siguen llamando a las mismas funciones con los mismos datos.

   Hoy habla con:
     /acceso.php?formato=json      quién soy, mis áreas y dónde empiezo
     /login.php                    estado (GET ?estado=1) y entrar (POST JSON)
     /cambiar-clave.php            estado (GET ?estado=1) y cambiar (POST JSON)
     /logout.php                   salir
     /after-school/api.php         acciones de After School (docs/ACCIONES_API.md)
     /pasar-lista/api.php          leerLista y guardarLista (soloHoy lo pone el servidor)
     /configuracion/api.php        usuarios (X-CSRF en las escrituras)

   Errores: se lanza Datos.Error con .codigo:
     'sesion'        no hay sesión (la página manda al login)
     'red'           no salió la petición
     'incierto'      la petición salió y la respuesta se perdió (una escritura PUDO hacerse)
     'ilegible'      respuesta que no se entiende
     o el código que mande el servidor (sin_permiso, llena, duplicado, solo_hoy…).
   ========================================================================== */
(function () {
  'use strict';

  class ErrorDatos extends Error {
    constructor(mensaje, codigo) { super(mensaje); this.codigo = codigo || ''; }
  }

  /* Petición JSON. tipo: 'json' (cuerpo JSON) o 'texto' (text/plain, lo que
     esperan los puentes de After School). */
  async function pedir(url, { metodo = 'GET', cuerpo, cabeceras, tipo = 'json' } = {}) {
    const h = Object.assign({}, cabeceras || {});
    let body;
    if (cuerpo !== undefined) {
      body = JSON.stringify(cuerpo);
      h['Content-Type'] = tipo === 'texto' ? 'text/plain;charset=utf-8' : 'application/json';
    }
    let r;
    try { r = await fetch(url, { method: metodo, credentials: 'same-origin', cache: 'no-store', headers: h, body }); }
    catch (e) { throw new ErrorDatos('No hay conexión con el servidor del portal.', 'red'); }
    let txt;
    try { txt = await r.text(); } catch (e) { throw new ErrorDatos('Se cortó la respuesta del servidor del portal.', 'red'); }
    const esHtml = /text\/html/i.test(r.headers.get('content-type') || '') || /^\s*</.test(txt);
    // Un 5xx en HTML es el servidor (p. ej. un 504), no la sesión: la petición pudo llegar.
    if (r.status >= 500 && esHtml) throw new ErrorDatos('El servidor del portal no respondió bien (código ' + r.status + ').', 'incierto');
    // La sesión caducada responde con el login (HTML, tras redirección) o 401.
    if (r.status === 401 || esHtml) throw new ErrorDatos('La sesión del portal caducó.', 'sesion');
    let j;
    try { j = JSON.parse(txt); } catch (e) { throw new ErrorDatos('El servidor respondió algo que no se entiende (código ' + r.status + ').', 'ilegible'); }
    if (j && j.codigo === 'cambiar_clave') {
      irA('/cambiar-clave.html?r=' + encodeURIComponent(location.pathname + location.search + location.hash));
      throw new ErrorDatos('Antes de seguir tienes que cambiar tu contraseña temporal.', 'cambiar_clave');
    }
    if (!j || j.ok === false) throw new ErrorDatos((j && j.error) || ('Error ' + r.status), (j && j.codigo) || '');
    return j;
  }

  function irA(url) { location.href = url; }
  function aLogin() { irA('/login.html?r=' + encodeURIComponent(location.pathname + location.search + location.hash)); }

  /* ID de solicitud: el mismo para la misma acción con los mismos datos
     (un reintento no duplica la escritura; ver docs/REGLAS_NEGOCIO.md R61). */
  function idSolicitud() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  let csrfUsuarios = '';

  window.Datos = {
    Error: ErrorDatos,
    idSolicitud,
    aLogin,

    /* ── Sesión ─────────────────────────────────────────────────────────── */
    /** {usuario, roles:[{id, nombre}], areas: '*' | [...], inicio, inicioAS, permisosAS:[...]} */
    sesion() { return pedir('/acceso.php?formato=json'); },
    salir() { irA('/logout.php'); },

    /* ── Acceso (login y contraseña) ────────────────────────────────────── */
    acceso: {
      /** {csrf, conSesion, destino?, mantenimiento?} */
      estadoLogin(r) { return pedir('/login.php?estado=1&r=' + encodeURIComponent(r || '/')); },
      /** {destino} */
      entrar(usuario, clave, csrf, r) { return pedir('/login.php', { metodo: 'POST', cuerpo: { usuario, clave, csrf, r } }); },
      /** {usuario, obligatorio, csrf} */
      estadoClave() { return pedir('/cambiar-clave.php?estado=1'); },
      /** {destino} */
      cambiarClave(actual, nueva, repetir, csrf, r) {
        return pedir('/cambiar-clave.php', { metodo: 'POST', cuerpo: { actual, nueva, repetir, csrf, r } });
      }
    },

    /* ── After School ───────────────────────────────────────────────────── */
    /** Una acción de After School: {resultado, estado?, permisos?, repetida?} */
    afterSchool(accion, datos, id) {
      const cuerpo = { accion, datos: datos || {} };
      if (id) cuerpo.idSolicitud = id;
      return pedir('/after-school/api.php', { metodo: 'POST', cuerpo, tipo: 'texto' });
    },

    /* ── Pasar lista ────────────────────────────────────────────────────── */
    lista: {
      /** {resultado: {fecha, hoy, clases[...]}, permisos: {puedeOtroDia}} */
      leer(fecha) { return pedir('/pasar-lista/api.php', { metodo: 'POST', cuerpo: { accion: 'leerLista', datos: fecha ? { fecha } : {} }, tipo: 'texto' }); },
      /** {resultado: {nuevas, corregidas, visitasMarcadas}} */
      guardar(datos, id) {
        return pedir('/pasar-lista/api.php', { metodo: 'POST', cuerpo: { accion: 'guardarLista', datos, idSolicitud: id }, tipo: 'texto' });
      }
    },

    /* ── Configuración › Usuarios ───────────────────────────────────────── */
    usuarios: {
      /** {usuarios[], roles[], yo, puedeAdmin, claveMinima} */
      async listar() {
        const j = await pedir('/configuracion/api.php?accion=listar');
        csrfUsuarios = j.csrf || '';
        return j;
      },
      /** accion: crear | roles | desactivar | reactivar | reiniciar → {usuarios, temporal?} */
      async cambiar(accion, datos) {
        if (!csrfUsuarios) await this.listar();
        return pedir('/configuracion/api.php', { metodo: 'POST', cuerpo: Object.assign({ accion }, datos || {}), cabeceras: { 'X-CSRF': csrfUsuarios } });
      }
    }
  };
})();
