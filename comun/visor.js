/* ==========================================================================
   Vida en Arte · cómo se ve un documento dentro del portal (22-oct-2026)

   Funciones puras (sin pantalla): qué versión es un documento y cómo se
   incrusta o se descarga según su enlace. Las usa /proyecto-actio/ y las
   prueba pruebas-portal/prueba-visor.js. El portal solo depende del ENLACE
   de cada documento, no de quién es dueño del archivo.

     Drive (archivo)        /preview dentro del portal; descarga por Drive
     Google Docs/Hojas/
       Presentaciones       /preview (solo lectura); descarga como PDF/XLSX
     Gamma                  su modo de inserción (/embed/<id>); sin descarga
     /biblioteca/<nombre>.html (23-oct; antes /proyecto-actio/archivos/,
       que se muestra desde /biblioteca/)
                            presentación privada del portal: se incrusta
                            AISLADA (iframe con sandbox, sin allow-same-origin:
                            sus scripts corren pero no ven la sesión)
     cualquier otro enlace  se abre en pestaña nueva (no se incrusta)
   ========================================================================== */
(function (raiz) {
  'use strict';

  const VERSIONES = ['Documento', 'Presentación', 'Interactiva'];
  const RE_ETIQUETA = /^(.*?)\s*\(([^()]*)\)\s*$/;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const drive = u => (u.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/) || [])[1] || '';
  const docs = u => { const m = u.match(/^https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/); return m ? { tipo: m[1], id: m[2] } : null; };
  /* Presentación privada del portal: solo un nombre simple en minúsculas. La
     ruta vieja (/proyecto-actio/archivos/) se lleva a /biblioteca/. */
  const RE_PORTAL = /^\/(?:biblioteca|proyecto-actio\/archivos)\/([a-z0-9][a-z0-9-]*\.html)$/;
  const archivoPortal = u => RE_PORTAL.test(u);
  const gamma = u => { const m = u.match(/^https?:\/\/gamma\.app\/(?:docs|embed|public)\/(?:[^/?#]*-)?([a-z0-9]+)(?:[/?#]|$)/i); return m ? m[1] : ''; };

  /** Cómo se muestra un enlace: {modo: 'incrustar' | 'nueva', url}. */
  function vista(enlace) {
    const u = String(enlace || '').trim();
    if (archivoPortal(u)) return { modo: 'incrustar', url: '/biblioteca/' + u.match(RE_PORTAL)[1], aislado: true };
    if (!/^https?:\/\//i.test(u)) return { modo: 'nada', url: '' };
    const d = drive(u); if (d) return { modo: 'incrustar', url: 'https://drive.google.com/file/d/' + d + '/preview' };
    const g = docs(u); if (g) return { modo: 'incrustar', url: 'https://docs.google.com/' + g.tipo + '/d/' + g.id + '/preview' };
    const ga = gamma(u); if (ga) return { modo: 'incrustar', url: 'https://gamma.app/embed/' + ga };
    return { modo: 'nueva', url: u };
  }

  /** Enlace de descarga, o '' si no es un archivo que se pueda bajar. */
  function descarga(enlace) {
    const u = String(enlace || '').trim();
    const d = drive(u); if (d) return 'https://drive.usercontent.google.com/download?id=' + d + '&export=download';
    const g = docs(u);
    if (g) {
      if (g.tipo === 'presentation') return 'https://docs.google.com/presentation/d/' + g.id + '/export/pdf';
      return 'https://docs.google.com/' + g.tipo + '/d/' + g.id + '/export?format=' + (g.tipo === 'spreadsheets' ? 'xlsx' : 'pdf');
    }
    return '';
  }

  /** La versión de un documento: la etiqueta final del nombre si es una de las
      tres («Plan (Presentación)»); si no, la que sugiere su enlace. */
  function version(nombre, enlace) {
    const m = String(nombre || '').match(RE_ETIQUETA);
    if (m) { const v = VERSIONES.find(x => norm(x) === norm(m[2])); if (v) return v; }
    const u = String(enlace || '');
    if (archivoPortal(u) || gamma(u) || (docs(u) || {}).tipo === 'presentation') return 'Presentación';
    if (drive(u) || docs(u)) return 'Documento';
    return /^https?:\/\//i.test(u) ? 'Interactiva' : 'Documento';
  }

  /** El nombre sin la etiqueta de versión. */
  function nombreBase(nombre) {
    const m = String(nombre || '').match(RE_ETIQUETA);
    return m && VERSIONES.some(x => norm(x) === norm(m[2])) ? m[1].trim() : String(nombre || '').trim();
  }

  /** Las versiones de un entregable, en el orden Documento, Presentación,
      Interactiva; si hubiera dos de la misma, la de fecha más reciente. */
  function versiones(documentos) {
    const por = {};
    (documentos || []).forEach(d => {
      const v = version(d.nombre, d.enlace);
      if (!por[v] || String(d.fecha || '') > String(por[v].fecha || '')) por[v] = Object.assign({}, d, { version: v });
    });
    return VERSIONES.filter(v => por[v]).map(v => por[v]);
  }

  const Visor = { VERSIONES, vista, descarga, version, nombreBase, versiones };
  if (typeof module !== 'undefined' && module.exports) module.exports = Visor;
  else raiz.Visor = Visor;
})(typeof window !== 'undefined' ? window : this);
