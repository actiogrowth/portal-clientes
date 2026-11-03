/* ==========================================================================
   Vida en Arte · piezas de PRESENTACIÓN compartidas (21-oct-2026;
   3-nov-2026: rediseño etapa 1, la estructura común de toda la app)

   Marca.cabecera(el, {sesion, ruta}) arma, la primera vez, la ESTRUCTURA
   COMÚN de la página; las siguientes solo la pone al día (Procesos la llama
   en cada vista):
     · barra lateral fija (248 px en computador; solo iconos, 76 px, en
       tablet hasta 1024 px) con Inicio, las unidades por marca, Gestión,
       Administración y, abajo, el usuario con «Cambiar mi contraseña» y «Salir»;
     · barra superior (el elemento `el`): buscador, botón «Nuevo» y campana;
     · en celular (640 px o menos), en lugar de la barra lateral, una barra
       inferior: Inicio, la unidad principal del rol, Buscar, Notificaciones y
       «Más» (la lista completa);
     · las partículas de colores del fondo.
   Cada persona ve solo lo que su rol abre (las áreas de la sesión, las
   mismas de permisos.php); el servidor lo vuelve a exigir en cada carpeta.

   Lo que se lee para la estructura sale de la capa de datos (comun/datos.js):
     · notificaciones: Datos.pendientes.leer() (lo que antes era «Pendientes
       de hoy»), después de que la página cargó y con copia de 3 minutos en
       la pestaña del navegador;
     · buscador: se pide SOLO al abrirlo (After School `leer`, Procesos y,
       para quien lo ve, Proyecto Actio). Cada lectura pasa por su puente de
       siempre, que ya recorta según el rol: nadie encuentra lo que no puede
       ver en su sección.
   No pide nada más: la sesión la pasa la página.
   ========================================================================== */
(function () {
  'use strict';
  /* 3-nov: los estilos de la estructura común, aparte y sin capa (ver comun/armazon.css). Se
     piden en cuanto carga este archivo: cuando llega la sesión ya están. */
  if (!document.querySelector('link[data-armazon]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/comun/armazon.css?v=116fea6736'; l.setAttribute('data-armazon', '');
    document.head.appendChild(l);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  /* 26-oct: el nombre de la persona (Configuración › Usuarios). Sin nombre
     cargado, el usuario, como antes. */
  const nombreDe = s => s ? (((s.nombre || '') + ' ' + (s.apellido || '')).trim() || s.usuario || '') : '';
  /** «Buenos días, Ana» (sin nombre: «Buenos días, recepcion-as»). */
  function saludo(s, ahora) {
    const h = (ahora || new Date()).getHours();
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + (s ? ', ' + ((s.nombre || '').trim() || s.usuario) : '');
  }

  /* ── Iconos (trazo, 24 × 24) ───────────────────────────────────────────── */
  const ICONOS = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    parkour: '<circle cx="13" cy="4" r="2"/><path d="M4 22l4-7 3 2 2-5 4 3"/><path d="M9 9l3-1 3 3 4 1"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    torta: '<path d="M4 21V13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8"/><path d="M4 16c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0"/><path d="M2 21h20M12 11V8"/>',
    birrete: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    bebe: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    resumen: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    organigrama: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/>',
    datos: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    maletin: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    engrane: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    lista: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8l1.5 1.5L13 7"/><path d="M9 14l1.5 1.5L13 13"/><path d="M15 8h1M15 14h1"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    campana: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    flecha: '<path d="M9 6l6 6-6 6"/>',
    arriba: '<path d="M6 15l6-6 6 6"/>',
    pasarLista: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    pago: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    nino: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    seccion: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 20V9"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };
  const icono = (k, tam) => '<svg width="' + (tam || 20) + '" height="' + (tam || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[k] || '') + '</svg>';

  /* 23-oct: las dos marcas y qué áreas (unidades) tiene cada una. Tocar el
     logo en Inicio abre la página de la marca (Inicio con ?marca=).
     El mismo reparto está en MARCAS de permisos.php (entrada directa); la
     prueba del portal compara los dos. */
  const MARCAS = [
    { id: 'vea', nombre: 'Vida en Arte', url: '/?marca=vea', logo: { src: '/comun/logo-vea.png?v=03a73eb9c2', alt: 'Vida en Arte' },
      areas: ['afterschool', 'veranito', 'cumpleanos'] },
    { id: 'kids', nombre: 'Vida en Arte Kids', url: '/?marca=kids', logo: { src: '/comun/logo-kids.png?v=84821d6ddf', alt: 'Vida en Arte Kids' },
      areas: ['kinder', 'babyandme'], kids: true }
  ];
  const marcaDe = area => MARCAS.find(m => m.areas.includes(area)) || null;

  /* Las unidades: nombre, página (vacía = «Próximamente»), icono y color.
     Los colores son los de UNIDADES_DOC (abajo): los mismos en la barra
     lateral, en Inicio y en Procesos. */
  const UNIDADES = {
    afterschool: { nombre: 'After School', url: '/after-school/', icono: 'parkour', color: '#D71C0E', desc: 'Parkour, Telas, Parkids y Baby & Me' },
    veranito:    { nombre: 'Veranito', url: '/veranito/', icono: 'sol', color: '#FFA615', desc: 'Campamento de vacaciones' },
    cumpleanos:  { nombre: 'Cumpleaños', url: '', icono: 'torta', color: '#1974A8', desc: 'Reservas y eventos' },
    kinder:      { nombre: 'Preschool', url: '/kinder/', icono: 'birrete', color: '#7E53A2', desc: 'Matrícula y ocupación por salón' },
    babyandme:   { nombre: 'Baby & Me', url: '', icono: 'bebe', color: '#68A8C9', desc: 'Grupos y asistencia' }
  };

  /* La barra lateral. areas: las que hacen falta para verla (todas). */
  const NAV = [
    { grupo: '', items: [{ id: 'inicio', texto: 'Inicio', url: '/', icono: 'inicio', areas: [] }] },
    { grupo: 'Vida en Arte', items: ['afterschool', 'veranito', 'cumpleanos'].map(a => ({ id: a, texto: UNIDADES[a].nombre, url: UNIDADES[a].url, icono: UNIDADES[a].icono, color: UNIDADES[a].color, areas: [a] })) },
    { grupo: 'Vida en Arte Kids', items: ['kinder', 'babyandme'].map(a => ({ id: a, texto: UNIDADES[a].nombre, url: UNIDADES[a].url, icono: UNIDADES[a].icono, color: UNIDADES[a].color, areas: [a] })) },
    { grupo: 'Gestión', items: [
      { id: 'resumen', texto: 'Resumen del negocio', url: '/resumen/', icono: 'resumen', areas: ['resumen'] },
      { id: 'procesos', texto: 'Procesos', url: '/procesos/#documentos', icono: 'documento', areas: ['procesos'] },
      { id: 'equipo', texto: 'Equipo', url: '/procesos/#equipo', icono: 'organigrama', areas: ['procesos', 'equipo'] }] },
    { grupo: 'Administración', items: [
      { id: 'basededatos', texto: 'Base de datos', url: '/basededatos/', icono: 'datos', areas: ['basededatos'] },
      { id: 'proyecto-actio', texto: 'Proyecto Actio', url: '/proyecto-actio/', icono: 'maletin', areas: ['proyecto-actio'] },
      { id: 'configuracion', texto: 'Configuración', url: '/configuracion/', icono: 'engrane', areas: ['configuracion'] }] }
  ];
  /* La unidad principal del rol (barra inferior del celular): la primera que abre, en este orden. */
  const PRINCIPAL = ['afterschool', 'kinder', 'veranito', 'resumen', 'basededatos', 'proyecto-actio', 'configuracion'];

  /* Qué entrada de la barra está activa según la dirección. */
  const VISTAS_EQUIPO = /^#(equipo|puesto=|reglas|horarios)/;
  function activoAhora() {
    const p = location.pathname, h = location.hash || '';
    if (p === '/' || p === '/index.html') return 'inicio';
    if (p.startsWith('/after-school/') || p.startsWith('/pasar-lista/')) return 'afterschool';
    if (p.startsWith('/equipo/')) return 'equipo';
    if (p.startsWith('/procesos/')) return VISTAS_EQUIPO.test(h) ? 'equipo' : 'procesos';
    const m = /^\/([a-z-]+)\//.exec(p);
    return m ? ({ kinder: 'kinder', veranito: 'veranito', resumen: 'resumen', basededatos: 'basededatos', 'proyecto-actio': 'proyecto-actio', configuracion: 'configuracion' })[m[1]] || '' : '';
  }

  /* ── Estado de la estructura ───────────────────────────────────────────── */
  let S = null;            // la sesión
  let armada = false;
  const ve = a => !!S && (S.areas === '*' || (Array.isArray(S.areas) && S.areas.includes(a)));
  const permAS = p => !!S && Array.isArray(S.permisosAS) && S.permisosAS.includes(p);
  const veItem = it => it.areas.every(ve);
  const $ = s => document.querySelector(s);

  /** Pinta (o pone al día) la estructura común. `el` es la barra superior. */
  function cabecera(el, { sesion, ruta } = {}) {
    if (sesion) S = sesion;
    if (S && window.Apariencia) Apariencia.deUsuario(S.usuario);   // la de esta persona (antes de saberlo, la del último que entró)
    if (!S) return;   // sin sesión todavía (Veranito pinta antes de tenerla): se arma cuando llegue
    if (!armada) armar(el);
    marcarActivo();
    ponerCeja(ruta);
  }

  /* El logo de Vida en Arte tiene las letras negras: sobre fondo oscuro no se lee. En oscuro se muestra
     su versión clara (letras y barras blancas, entregada por Vida en Arte el 3-nov). Sin ella, iría
     sobre una placa clara (.logo-placa). (No se invierte con un filtro: dañaría los colores del ícono.) */
  const LOGO_VEA_OSCURO = '/comun/logo-vea-oscuro.png?v=df4114ef00';
  function logoVea(clase) {
    const c = (clase ? clase + ' ' : '');
    return LOGO_VEA_OSCURO
      ? '<img class="' + c + 'logo-solo-claro" src="/comun/logo-vea.png?v=03a73eb9c2" alt="Vida en Arte"><img class="' + c + 'logo-solo-oscuro" src="' + LOGO_VEA_OSCURO + '" alt="Vida en Arte">'
      : '<img class="' + c + 'logo-placa" src="/comun/logo-vea.png?v=03a73eb9c2" alt="Vida en Arte">';
  }

  function armar(el) {
    armada = true;
    document.body.classList.add('con-armazon');
    // 1. Barra lateral.
    const lat = document.createElement('aside');
    lat.className = 'lat'; lat.id = 'lateral'; lat.setAttribute('aria-label', 'Secciones del portal');
    lat.innerHTML = '<a class="lat-logo" href="/" aria-label="Inicio · Vida en Arte 360">' + logoVea('lat-logo-largo') + '<img class="lat-logo-ic" src="/comun/app-icono-192.png?v=ce63fbd4f4" alt="Vida en Arte"><span class="lat-360">360</span></a>' +
      '<nav class="lat-nav">' + navHtml('lat') + '</nav>' + usuarioHtml();
    document.body.insertBefore(lat, document.body.firstChild);
    // 2. Barra superior.
    el.className = 'cab';
    el.innerHTML = '<div class="cab-in">' +
      '<a class="cab-logo" href="/" aria-label="Inicio">' + logoVea('') + '</a>' +
      '<button class="cab-buscar" type="button" data-abrir-buscador aria-haspopup="dialog">' + icono('buscar', 18) +
        '<span class="cab-buscar-txt">' + esc(textoBuscador()) + '</span><kbd>' + (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl') + ' K</kbd></button>' +
      '<div class="cab-acciones">' + nuevoHtml() +
        '<button class="btn-icono cab-campana" type="button" id="campana" aria-haspopup="true" aria-expanded="false" aria-controls="notif" aria-label="Notificaciones">' +
          icono('campana') + '<span class="cab-numero oculto" id="campanaN"></span></button>' +
      '</div></div>';
    // 3. Barra inferior (celular).
    const abajo = document.createElement('nav');
    abajo.className = 'abajo'; abajo.setAttribute('aria-label', 'Navegación');
    abajo.innerHTML = abajoHtml();
    document.body.appendChild(abajo);
    // 4. Paneles: notificaciones, «Más» y el menú del usuario.
    const capas = document.createElement('div');
    capas.innerHTML = '<div class="pop notif oculto" id="notif" role="dialog" aria-label="Notificaciones">' +
        '<div class="notif-cab"><b>Notificaciones</b><button type="button" class="enlace" id="notifLeer">Marcar todo como leído</button></div>' +
        '<div class="notif-lista" id="notifLista"><p class="notif-vacio">Leyendo…</p></div></div>' +
      '<div class="hoja oculto" id="hojaMas" role="dialog" aria-modal="true" aria-label="Todas las secciones"><div class="hoja-in">' +
        '<div class="hoja-cab"><b>Secciones</b><button type="button" class="btn-icono" data-cerrar-hoja aria-label="Cerrar">' + icono('cerrar') + '</button></div>' +
        '<nav class="lat-nav">' + navHtml('mas') + '</nav>' + usuarioHtml('mas') + '</div></div>';
    while (capas.firstChild) document.body.appendChild(capas.firstChild);
    particulas();
    enganchar();
    // Las notificaciones, cuando la página ya pidió lo suyo.
    if (ve('equipo')) setTimeout(() => leerNotificaciones(false), 700);
    else $('#campana').classList.add('oculto');
  }

  function navHtml(donde) {
    return NAV.map(g => {
      const items = g.items.filter(veItem);
      if (!items.length) return '';
      return '<div class="lat-grupo">' + (g.grupo ? '<p class="lat-grupo-tit">' + esc(g.grupo) + '</p>' : '') +
        items.map(it => {
          const punto = it.color ? '<i class="lat-punto" style="background:' + it.color + '" aria-hidden="true"></i>' : '';
          if (!it.url) return '<span class="lat-item pronto" data-nav="' + it.id + '" aria-disabled="true" title="' + esc(it.texto) + ' · Próximamente">' + icono(it.icono) +
            '<span class="lat-txt">' + esc(it.texto) + '<small>Próximamente</small></span></span>';
          return '<a class="lat-item" data-nav="' + it.id + '" href="' + esc(it.url) + '" title="' + esc(it.texto) + '">' + icono(it.icono) +
            '<span class="lat-txt">' + esc(it.texto) + '</span>' + punto + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  /* 3-nov (ajuste 3): la apariencia, en el menú del usuario. La aplica y la guarda comun/tema.js. */
  const APARIENCIAS = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']];
  const aparienciaActual = () => window.Apariencia ? Apariencia.actual() : 'auto';
  function marcarApariencia() {
    document.querySelectorAll('button[data-apariencia]').forEach(b => b.setAttribute('aria-pressed', b.dataset.apariencia === aparienciaActual() ? 'true' : 'false'));
  }

  function usuarioHtml(donde) {
    const nom = nombreDe(S) || 'Usuario', rol = S && S.roles && S.roles.length ? S.roles.map(r => r.nombre).join(' · ') : '';
    const id = donde ? 'usuMenu' + donde : 'usuMenu';
    return '<div class="lat-usuario">' +
      '<button type="button" class="lat-yo" aria-haspopup="true" aria-expanded="false" aria-controls="' + id + '" title="' + esc(nom + (rol ? ' · ' + rol : '')) + '">' +
        '<span class="avatar" aria-hidden="true">' + esc(nom.charAt(0).toUpperCase()) + '</span>' +
        '<span class="lat-txt"><b>' + esc(nom) + '</b>' + (rol ? '<small>' + esc(rol) + '</small>' : '') + '</span>' + icono('arriba', 16) + '</button>' +
      '<div class="menu oculto" id="' + id + '" role="menu">' +
        '<a role="menuitem" href="/cambiar-clave.html?r=' + encodeURIComponent(location.pathname) + '">' + icono('llave', 18) + 'Cambiar mi contraseña</a>' +
        '<div class="menu-apariencia" role="group" aria-label="Apariencia"><span class="menu-apariencia-tit">' + icono('luna', 18) + 'Apariencia</span>' +
          '<div class="menu-apariencia-ops">' + APARIENCIAS.map(([v, t]) => '<button type="button" data-apariencia="' + v + '" aria-pressed="' + (aparienciaActual() === v) + '">' + t + '</button>').join('') + '</div></div>' +
        '<a role="menuitem" href="/logout.php">' + icono('salir', 18) + 'Salir</a></div></div>';
  }

  function abajoHtml() {
    const p = PRINCIPAL.find(a => {
      const it = NAV.flatMap(g => g.items).find(x => x.id === a);
      return it && it.url && veItem(it);
    });
    const it = p && NAV.flatMap(g => g.items).find(x => x.id === p);
    const boton = (attrs, ic, txt, extra) => '<button type="button" class="abajo-item" ' + attrs + '>' + icono(ic, 22) + '<span>' + txt + '</span>' + (extra || '') + '</button>';
    return '<a class="abajo-item" data-nav="inicio" href="/">' + icono('inicio', 22) + '<span>Inicio</span></a>' +
      (it ? '<a class="abajo-item" data-nav="' + it.id + '" href="' + esc(it.url) + '">' + icono(it.icono, 22) + '<span>' + esc(it.texto) + '</span></a>' : '') +
      boton('data-abrir-buscador aria-haspopup="dialog"', 'buscar', 'Buscar') +
      (ve('equipo') ? boton('id="campanaAbajo" aria-haspopup="true" aria-controls="notif" aria-label="Notificaciones"', 'campana', 'Avisos', '<span class="cab-numero oculto" id="campanaAbajoN"></span>') : '') +
      boton('id="abrirMas" aria-haspopup="dialog" aria-controls="hojaMas"', 'menu', 'Más');
  }

  function marcarActivo() {
    const a = activoAhora();
    document.querySelectorAll('[data-nav]').forEach(x => {
      if (x.dataset.nav === a) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
    });
  }

  /* La ceja sobre el título de la página: el lugar («Vida en Arte», «Procesos»). Sale de la ruta de siempre. */
  function ponerCeja(ruta) {
    const h1 = document.querySelector('main h1');
    if (!h1) return;
    const medio = (ruta || []).slice(1, -1);
    let c = document.querySelector('[data-ceja]');
    if (!medio.length) { if (c) c.remove(); return; }
    if (!c) {
      c = document.createElement('p'); c.className = 'ceja'; c.setAttribute('data-ceja', '');
      let padre = h1.parentNode;
      if (padre.classList.contains('encabezado')) {   // el título va en una fila: se envuelve con su ceja
        const caja = document.createElement('div'); caja.className = 'encabezado-tit';
        padre.insertBefore(caja, h1); caja.appendChild(h1); padre = caja;
      }
      padre.insertBefore(c, h1);
    }
    c.innerHTML = medio.map(p => p.url ? '<a href="' + esc(p.url) + '">' + esc(p.texto) + '</a>' : '<span>' + esc(p.texto) + '</span>').join('<span aria-hidden="true">›</span>');
  }

  /* ── Botón «Nuevo»: las acciones que el rol puede hacer hoy ──────────────
     Cada una abre el formulario que ya existe en After School (en la misma
     página, o llevando a ella con el formulario abierto). Sin ninguna, no hay botón. */
  const NUEVO = [
    { id: 'inscribir', texto: 'Inscribir niño', desc: 'Niño nuevo o ya en la base', icono: 'nino', permiso: 'as.completo' },
    { id: 'visita', texto: 'Agendar visita', desc: 'Prueba, reposición o eventual', icono: 'calendario', permiso: 'as.pruebas.agendar' },
    { id: 'pago', texto: 'Registrar pago', desc: 'Mensualidad u otro concepto', icono: 'pago', permiso: 'as.pagos.registrar' }
  ];
  const accionesNuevo = () => ve('afterschool') ? NUEVO.filter(a => permAS(a.permiso)) : [];
  const urlNuevo = id => '/after-school/#nuevo=' + id;
  function nuevoHtml() {
    const acc = accionesNuevo();
    if (!acc.length) return '';
    return '<div class="nuevo"><button class="btn cab-nuevo" type="button" id="nuevo" aria-haspopup="true" aria-expanded="false" aria-controls="nuevoMenu">' +
      icono('mas', 18) + '<span>Nuevo</span></button>' +
      '<div class="menu oculto" id="nuevoMenu" role="menu">' + acc.map(a => '<a role="menuitem" href="' + urlNuevo(a.id) + '">' +
        '<span class="menu-ic">' + icono(a.icono, 18) + '</span><span><b>' + esc(a.texto) + '</b><small>' + esc(a.desc) + '</small></span></a>').join('') + '</div></div>';
  }

  /* ── Menús y paneles ───────────────────────────────────────────────────── */
  let abierto = null;   // {panel, boton}
  function cerrarPaneles() {
    if (!abierto) return;
    abierto.panel.classList.add('oculto');
    if (abierto.boton) abierto.boton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('hoja-abierta');
    abierto = null;
  }
  function alternar(panel, boton) {
    const ya = abierto && abierto.panel === panel;
    cerrarPaneles();
    if (ya) return;
    panel.classList.remove('oculto');
    if (boton) boton.setAttribute('aria-expanded', 'true');
    abierto = { panel, boton };
    const foco = panel.querySelector('a, button');
    if (foco && panel.classList.contains('menu')) foco.focus();
  }

  function enganchar() {
    document.addEventListener('click', ev => {
      const t = ev.target;
      if (t.closest('[data-abrir-buscador]')) { ev.preventDefault(); cerrarPaneles(); abrirBuscador(); return; }
      const ap = t.closest('button[data-apariencia]');   // solo los botones del menú: <html> también lleva data-apariencia
      if (ap && window.Apariencia) { Apariencia.elegir(ap.dataset.apariencia, S && S.usuario); marcarApariencia(); return; }
      const yo = t.closest('.lat-yo');
      if (yo) { alternar(document.getElementById(yo.getAttribute('aria-controls')), yo); return; }
      if (t.closest('#nuevo')) { alternar($('#nuevoMenu'), $('#nuevo')); return; }
      if (t.closest('#campana') || t.closest('#campanaAbajo')) { const b = t.closest('#campana, #campanaAbajo'); alternar($('#notif'), b); pintarNotificaciones(); leerNotificaciones(false); return; }
      if (t.closest('#abrirMas')) { alternar($('#hojaMas'), $('#abrirMas')); document.body.classList.add('hoja-abierta'); return; }
      if (t.closest('[data-cerrar-hoja]')) { cerrarPaneles(); return; }
      const aviso = t.closest('[data-aviso]');
      if (aviso) { marcarLeida(aviso.dataset.aviso); cerrarPaneles(); return; }
      if (t.closest('#notifLeer')) { marcarTodasLeidas(); return; }
      // En la misma página, un «Nuevo» o un enlace con # cierra el menú y deja que la página lo atienda.
      if (abierto && (t.closest('.menu a') || t.closest('#hojaMas a'))) { cerrarPaneles(); return; }
      if (abierto && !abierto.panel.contains(t)) cerrarPaneles();
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && abierto) { const b = abierto.boton; cerrarPaneles(); if (b) b.focus(); }
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); cerrarPaneles(); abrirBuscador(); }
    });
    window.addEventListener('hashchange', marcarActivo);
  }

  /* ── Partículas del fondo ──────────────────────────────────────────────
     Máximo 30, muy tenues, de los colores de la marca. Solo se animan
     transform y opacity; detrás del contenido y sin recibir clics. Se
     detienen con la pestaña oculta y quedan quietas con «reducir movimiento»
     (vea.css). */
  const COLORES_PARTICULAS = ['#E0412F', '#1974A8', '#F2A01E', '#7FB3D5', '#278746', '#7E53A2'];
  function particulas() {
    if (document.querySelector('.particulas')) return;
    const p = document.createElement('div');
    p.className = 'particulas'; p.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let i = 0; i < 26; i++) {
      const tam = 3 + (i * 7) % 5, x = (i * 37 + 11) % 100, dur = 22 + (i * 13) % 18, ret = -((i * 29) % dur);
      html += '<i style="left:' + x + '%;width:' + tam + 'px;height:' + tam + 'px;background:' + COLORES_PARTICULAS[i % COLORES_PARTICULAS.length] +
        ';animation-duration:' + dur + 's;animation-delay:' + ret + 's;--o:' + (0.22 + (i % 4) * 0.06).toFixed(2) + '"></i>';
    }
    p.innerHTML = html;
    document.body.appendChild(p);
    document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('vea-pausa', document.hidden));
  }

  /* ── Notificaciones (lo que antes era «Pendientes de hoy») ────────────────
     Los mismos cálculos y permisos: pendientes/api.php decide qué le llega a
     cada rol. Lo leído se recuerda POR USUARIO en este navegador: un aviso
     vuelve a contar como nuevo si cambia su número o es otro día. */
  const NOTIFICACIONES = {
    sinLista:  { uno: 'clase de hoy sin lista', varios: 'clases de hoy sin lista', donde: 'After School › Seguimiento', color: 'var(--peligro)' },
    pruebas:   { uno: 'prueba sin resultado', varios: 'pruebas sin resultado', donde: 'After School › Visitas del día', color: 'var(--alerta)' },
    revisar:   { uno: 'lista de verificación sin revisar', varios: 'listas de verificación sin revisar', donde: 'Mi lista › Revisar', color: 'var(--telas)' },
    contratos: { uno: 'contrato de posición por validar', varios: 'contratos de posición por validar', donde: 'Procesos › Equipo', color: 'var(--tinta)' }
  };
  const COPIA_MS = 3 * 60 * 1000;
  let NOTI = null, leyendoNoti = null;
  const claveUsuario = k => 'vea360.' + k + '.' + (S ? S.usuario : '');
  const leerLocal = (almacen, k) => { try { return JSON.parse(almacen.getItem(claveUsuario(k)) || 'null'); } catch (e) { return null; } };
  const guardarLocal = (almacen, k, v) => { try { almacen.setItem(claveUsuario(k), JSON.stringify(v)); } catch (e) { } };
  const firma = (x, hoy) => hoy + ':' + x.n;

  function leerNotificaciones(forzar) {
    if (!S || !window.Datos || !Datos.pendientes) return;
    const copia = leerLocal(sessionStorage, 'notif');
    if (!forzar && copia && Date.now() - copia.t < COPIA_MS) { NOTI = copia.r; pintarNotificaciones(); return; }
    if (leyendoNoti) return;
    leyendoNoti = Datos.pendientes.leer().then(j => {
      NOTI = j.resultado; guardarLocal(sessionStorage, 'notif', { t: Date.now(), r: NOTI });
      pintarNotificaciones();
    }).catch(e => { NOTI = { error: e.message }; pintarNotificaciones(); }).finally(() => { leyendoNoti = null; });
  }
  function avisos() {
    if (!NOTI || NOTI.error) return [];
    return (NOTI.items || []).filter(x => NOTIFICACIONES[x.clave] && x.n);
  }
  function noLeidos() {
    const l = leerLocal(localStorage, 'leidas') || {};
    return avisos().filter(x => l[x.clave] !== firma(x, NOTI.hoy));
  }
  function pintarNotificaciones() {
    const lista = $('#notifLista');
    if (!lista) return;
    const n = noLeidos().length;
    [$('#campanaN'), $('#campanaAbajoN')].forEach(b => { if (b) { b.textContent = n > 9 ? '9+' : n; b.classList.toggle('oculto', !n); } });
    const c = $('#campana');
    if (c) c.setAttribute('aria-label', n ? 'Notificaciones: ' + n + (n === 1 ? ' sin leer' : ' sin leer') : 'Notificaciones');
    if (!NOTI) { lista.innerHTML = '<p class="notif-vacio">Leyendo…</p>'; return; }
    if (NOTI.error) { lista.innerHTML = '<p class="notif-vacio">No se pudieron leer: ' + esc(NOTI.error) + '</p>'; return; }
    const l = leerLocal(localStorage, 'leidas') || {}, items = avisos();
    const fallan = (NOTI.items || []).filter(x => NOTIFICACIONES[x.clave] && x.n === null);
    lista.innerHTML = (items.length ? items.map(x => {
      const t = NOTIFICACIONES[x.clave], nuevo = l[x.clave] !== firma(x, NOTI.hoy);
      return '<a class="notif-item' + (nuevo ? ' nuevo' : '') + '" href="' + esc(x.url) + '" data-aviso="' + esc(x.clave) + '">' +
        '<i class="notif-punto" style="background:' + t.color + '" aria-hidden="true"></i>' +
        '<span class="notif-txt"><b>' + x.n + ' ' + esc(x.n === 1 ? t.uno : t.varios) + '</b><small>' + esc(t.donde) + '</small></span>' +
        '<span class="notif-cuando">Hoy</span></a>';
    }).join('') : '<p class="notif-vacio">Hoy no tienes nada pendiente.</p>') +
      (fallan.length ? '<p class="notif-vacio">No se pudo leer: ' + esc(fallan.map(x => NOTIFICACIONES[x.clave].varios).join(' · ')) + '.</p>' : '');
    $('#notifLeer').disabled = !noLeidos().length;
  }
  function marcarLeida(clave) {
    const x = avisos().find(a => a.clave === clave);
    if (!x) return;
    const l = leerLocal(localStorage, 'leidas') || {};
    l[clave] = firma(x, NOTI.hoy); guardarLocal(localStorage, 'leidas', l);
    pintarNotificaciones();
  }
  function marcarTodasLeidas() {
    const l = leerLocal(localStorage, 'leidas') || {};
    avisos().forEach(x => { l[x.clave] = firma(x, NOTI.hoy); });
    guardarLocal(localStorage, 'leidas', l);
    pintarNotificaciones();
  }

  /* ── Buscador general (Ctrl K / ⌘ K, la lupa en celular) ──────────────────
     Qué busca cada rol (los datos llegan recortados por su puente):
       · Niños (nombre, ID, unidad y estado) y Clases: quien ve After School
         (as.ver). El Profesor no: su puente solo da la lista del día y no hay
         una asignación de profesor a clases, así que no busca niños.
       · Documentos: los de Procesos (todos los roles) y, para quien la abre,
         Proyecto Actio (Administrador y Dirección; Dirección sin lo interno).
       · Secciones: las de su barra lateral y las pestañas de After School de su rol.
     Sin tildes ni mayúsculas. Los datos se piden al ABRIR el buscador. */
  const PESTANAS_AS = [
    { texto: 'Ocupación', vista: 'ocupacion', permiso: 'as.ver' }, { texto: 'Pasar lista', vista: 'lista', permiso: 'as.lista.marcar' },
    { texto: 'Visitas del día', vista: 'pruebas', permiso: 'as.pruebas.ver' }, { texto: 'Niños', vista: 'registrar', permiso: 'as.completo' },
    { texto: 'Pagos', vista: 'pagos', permiso: 'as.pagos.ver' }, { texto: 'Seguimiento', vista: 'seguimiento', permiso: 'as.seguimiento' },
    { texto: 'Por revisar', vista: 'revisar', permiso: 'as.completo' }];
  const textoBuscador = () => permAS('as.ver') ? 'Buscar niño, clase o documento' : 'Buscar sección o documento';
  let B = null;           // {ninos, clases, documentos, secciones, faltan[]}
  let cargandoB = null, dlg = null, resultados = [], marcado = 0;

  function secciones() {
    const l = [];
    NAV.forEach(g => g.items.filter(veItem).forEach(it => { if (it.url) l.push({ texto: it.texto, sub: g.grupo || 'Vida en Arte 360', url: it.url, icono: it.icono }); }));
    if (ve('afterschool')) PESTANAS_AS.filter(p => permAS(p.permiso)).forEach(p => l.push({ texto: p.texto, sub: 'After School', url: '/after-school/#' + p.vista, icono: p.vista === 'lista' ? 'pasarLista' : 'parkour' }));
    if (ve('equipo')) l.push({ texto: 'Mi lista', sub: 'Equipo', url: '/equipo/', icono: 'lista' });
    if (ve('procesos')) l.push({ texto: 'Reglas del juego', sub: 'Procesos › Equipo', url: '/procesos/#reglas', icono: 'documento' });
    return l;
  }

  function cargarBusqueda() {
    if (B) return Promise.resolve(B);
    if (cargandoB) return cargandoB;
    const r = { ninos: [], clases: [], documentos: [], secciones: secciones(), faltan: [] };
    const tareas = [];
    if (ve('afterschool') && permAS('as.ver')) {
      const desdePagina = window.Marca && Marca.datosAS ? Promise.resolve({ resultado: Marca.datosAS }) : Datos.afterSchool('leer');
      tareas.push(desdePagina.then(j => {
        const E = j.resultado || {};
        (E.ninos || []).forEach(n => r.ninos.push({ id: n.id, nombre: ((n.nombre || '') + ' ' + (n.apellidos || '')).trim(), estado: n.estado || '', unidad: 'After School' }));
        (E.clases || []).filter(c => c.activa !== false).forEach(c => r.clases.push({ codigo: c.codigo, servicio: c.servicio, dia: c.dia, hora: c.hora, cupo: c.cupo,
          inscritos: (E.inscripciones || []).filter(i => i.codigo === c.codigo).length }));
      }).catch(e => { r.faltan.push('niños y clases (' + e.message + ')'); }));
    }
    if (ve('procesos')) tareas.push(Datos.procesos.leer().then(j => (j.resultado.documentos || []).forEach(d => r.documentos.push({ nombre: d.nombre, enlace: d.enlace, sub: ['Procesos', unidadDoc(d.unidad).nombre, d.proceso].filter(Boolean).join(' › ') })))
      .catch(e => { r.faltan.push('documentos de Procesos (' + e.message + ')'); }));
    if (ve('proyecto-actio')) tareas.push(Datos.proyectoActio.leer().then(j => (j.resultado.documentos || []).forEach(d => {
      if (!r.documentos.some(x => x.enlace === d.enlace)) r.documentos.push({ nombre: d.nombre, enlace: d.enlace, sub: ['Proyecto Actio', unidadDoc(d.unidad).nombre].filter(Boolean).join(' › ') });
    })).catch(e => { r.faltan.push('documentos de Proyecto Actio (' + e.message + ')'); }));
    cargandoB = Promise.all(tareas).then(() => { B = r; cargandoB = null; return r; });
    return cargandoB;
  }

  function montarBuscador() {
    if (dlg) return;
    dlg = document.createElement('dialog');
    dlg.className = 'bus-dialogo'; dlg.setAttribute('aria-label', 'Buscar');
    dlg.innerHTML = '<div class="bus-cab">' + icono('buscar', 20) +
      '<input type="search" id="busTxt" placeholder="' + esc(textoBuscador()) + '" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="busRes" aria-autocomplete="list">' +
      '<kbd>Esc</kbd></div><div class="bus-res" id="busRes" role="listbox" aria-label="Resultados"></div>' +
      '<div class="bus-pie"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div>';
    document.body.appendChild(dlg);
    const txt = dlg.querySelector('#busTxt');
    txt.addEventListener('input', () => { marcado = 0; pintarBusqueda(); });
    txt.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); mover(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); mover(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (resultados[marcado]) elegir(resultados[marcado]); }
    });
    dlg.addEventListener('click', ev => {
      if (ev.target === dlg) { dlg.close(); return; }
      const r = ev.target.closest('[data-res]');
      if (r) elegir(resultados[+r.dataset.res]);
    });
  }
  function abrirBuscador() {
    if (!S) return;
    montarBuscador();
    const txt = dlg.querySelector('#busTxt');
    txt.value = ''; marcado = 0;
    if (!dlg.open) dlg.showModal();
    txt.focus();
    pintarBusqueda();
    if (!B) cargarBusqueda().then(() => { if (dlg.open) pintarBusqueda(); });
  }
  function mover(d) {
    if (!resultados.length) return;
    marcado = (marcado + d + resultados.length) % resultados.length;
    pintarMarcado();
  }
  function pintarMarcado() {
    dlg.querySelectorAll('[data-res]').forEach(el => {
      const si = +el.dataset.res === marcado;
      el.setAttribute('aria-selected', si ? 'true' : 'false');
      if (si) { el.scrollIntoView({ block: 'nearest' }); dlg.querySelector('#busTxt').setAttribute('aria-activedescendant', el.id); }
    });
  }
  const coincide = (texto, q) => { const h = normal(texto); return q.split(/\s+/).every(p => h.includes(p)); };
  function pintarBusqueda() {
    const q = normal(dlg.querySelector('#busTxt').value), cont = dlg.querySelector('#busRes');
    const grupos = [];
    const base = B || { ninos: [], clases: [], documentos: [], secciones: secciones(), faltan: [] };
    const tope = q ? 6 : 5;
    if (q) {
      grupos.push(['Niños', base.ninos.filter(n => coincide(n.nombre + ' ' + n.id, q)).slice(0, tope).map(n => ({ tipo: 'nino', dato: n, icono: 'nino',
        texto: n.nombre, sub: n.id + ' · ' + n.unidad + (n.estado ? ' · ' + n.estado : '') }))]);
      grupos.push(['Clases', base.clases.filter(c => coincide(c.servicio + ' ' + c.dia + ' ' + c.hora + ' ' + c.codigo, q)).slice(0, tope).map(c => ({ tipo: 'clase', dato: c, icono: 'reloj',
        texto: c.servicio + ' · ' + c.dia + ' ' + c.hora, sub: 'After School · ' + c.inscritos + '/' + c.cupo + ' inscritos' }))]);
      grupos.push(['Documentos', base.documentos.filter(d => coincide(d.nombre + ' ' + d.sub, q)).slice(0, tope).map(d => ({ tipo: 'doc', dato: d, icono: 'documento', texto: d.nombre, sub: d.sub }))]);
    }
    grupos.push(['Secciones', base.secciones.filter(x => !q || coincide(x.texto + ' ' + x.sub, q)).slice(0, q ? tope : 8).map(x => ({ tipo: 'seccion', dato: x, icono: x.icono, texto: x.texto, sub: x.sub }))]);
    resultados = [];
    let html = '';
    grupos.forEach(([titulo, items]) => {
      if (!items.length) return;
      html += '<p class="bus-grupo">' + esc(titulo) + '</p>' + items.map(it => {
        const i = resultados.push(it) - 1;
        return '<button type="button" class="bus-item" role="option" id="busOp' + i + '" data-res="' + i + '" aria-selected="false">' +
          '<span class="bus-ic">' + icono(it.icono, 18) + '</span><span class="bus-txt"><b>' + esc(it.texto) + '</b><small>' + esc(it.sub) + '</small></span></button>';
      }).join('');
    });
    if (!B && q) html += '<p class="bus-vacio">Buscando en los datos…</p>';
    else if (!resultados.length) html += '<p class="bus-vacio">Nada coincide con «' + esc(dlg.querySelector('#busTxt').value) + '».</p>';
    if (B && B.faltan.length) html += '<p class="bus-vacio">No se pudo leer: ' + esc(B.faltan.join(' · ')) + '.</p>';
    cont.innerHTML = html;
    if (marcado >= resultados.length) marcado = 0;
    pintarMarcado();
  }
  function elegir(r) {
    if (!r) return;
    dlg.close();
    if (r.tipo === 'nino') ir('/after-school/#ficha=' + encodeURIComponent(r.dato.id));
    else if (r.tipo === 'clase') ir('/after-school/#clase=' + encodeURIComponent(r.dato.codigo));
    else if (r.tipo === 'seccion') ir(r.dato.url);
    else if (r.tipo === 'doc') abrirDocumento(r.dato);
  }
  /* En la misma página basta cambiar el # (la página lo atiende); si no, se va a ella. */
  function ir(url) {
    const u = new URL(url, location.origin);
    if (u.pathname === location.pathname) { if (location.hash === u.hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = u.hash; }
    else location.href = url;
  }
  /* Un documento se abre en el visor, aquí mismo (los guiones del visor se cargan la primera vez). */
  const GUIONES_VISOR = ['/comun/visor.js?v=3de76954cc', '/comun/visor-pantalla.js?v=5a17db4017'];
  function cargarGuion(src) {
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el visor.')); document.head.appendChild(s); });
  }
  async function abrirDocumento(d) {
    try {
      if (!window.Visor) await cargarGuion(GUIONES_VISOR[0]);
      if (!window.VisorPantalla) await cargarGuion(GUIONES_VISOR[1]);
    } catch (e) { toast(e.message); return; }
    if (Visor.vista(d.enlace).modo === 'nada') { toast('Ese documento no tiene enlace.'); return; }
    VisorPantalla.abrir(Visor.nombreBase(d.nombre), d.sub, [{ version: Visor.version(d.nombre, d.enlace), nombre: d.nombre, enlace: d.enlace }]);
  }

  /* ── Esqueletos de carga ───────────────────────────────────────────────
     Mientras carga una pantalla, su forma en gris (no una tarjeta de «Cargando…»).
     Marca.esqueleto(tipo): 'ocupacion' | 'lista' | 'tarjetas' | 'tabla' | 'inicio'. */
  function esqueleto(tipo) {
    const b = (w, h, extra) => '<i class="esq-b" style="width:' + w + ';height:' + h + 'px' + (extra ? ';' + extra : '') + '"></i>';
    const caja = (dentro, extra) => '<div class="esq-caja"' + (extra ? ' style="' + extra + '"' : '') + '>' + dentro + '</div>';
    const n = (k, f) => Array.from({ length: k }, (_, i) => f(i)).join('');
    let h;
    if (tipo === 'ocupacion') h = '<div class="esq-fila4">' + n(4, () => caja(b('60%', 14) + b('40%', 30) + b('70%', 12))) + '</div>' +
      '<div class="esq-dos">' + caja(n(4, () => '<div class="esq-fila5">' + n(5, () => b('100%', 54, 'border-radius:12px')) + '</div>')) + caja(n(6, () => b('100%', 46, 'border-radius:12px'))) + '</div>';
    else if (tipo === 'lista') h = '<div class="esq-chips">' + n(4, () => b('130px', 46, 'border-radius:12px')) + '</div>' + caja(n(8, () => '<div class="esq-renglon">' + b('36px', 36, 'border-radius:50%') + b('30%', 16) + '<span style="flex:1"></span>' + n(4, () => b('84px', 46, 'border-radius:12px')) + '</div>'));
    else if (tipo === 'tabla') h = caja(n(8, () => '<div class="esq-renglon">' + b('40%', 16) + '<span style="flex:1"></span>' + b('20%', 16) + '</div>'));
    else if (tipo === 'inicio') h = '<div class="esq-dos iguales">' + n(2, () => caja(b('40%', 28) + n(3, () => b('100%', 72, 'border-radius:14px')))) + '</div>' + '<div class="esq-fila4">' + n(4, () => caja(b('60%', 16) + b('80%', 12))) + '</div>';
    else h = '<div class="esq-tarjetas">' + n(6, () => caja(b('48px', 48, 'border-radius:14px') + b('70%', 16) + b('90%', 12))) + '</div>';
    return '<div class="esq" role="status" aria-live="polite"><span class="sr">Cargando…</span>' + h + '</div>';
  }

  let t = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('ver');
    clearTimeout(t); t = setTimeout(() => el.classList.remove('ver'), 3200);
  }

  /** Miga de pan de una página de unidad: «Inicio / <Marca> / <Unidad>». */
  function rutaUnidad(area, nombre) {
    const m = marcaDe(area);
    return [{ texto: 'Inicio', url: '/' }].concat(m ? [{ texto: m.nombre, url: m.url }] : [], [{ texto: nombre }]);
  }

  /* Cada unidad del catálogo (columna «Unidad de negocio» del Sheet) con su
     color e iniciales; texto negro sobre los claros (contraste ≥ 4.5). Se
     muestra como se llama hoy (D-046); el dato no cambia. La usan Proyecto
     Actio y Procesos. */
  const UNIDADES_DOC = {
    kinder:         { nombre: 'Preschool',    ini: 'PS', fondo: '#7E53A2', texto: '#FFFFFF' },
    preschool:      { nombre: 'Preschool',    ini: 'PS', fondo: '#7E53A2', texto: '#FFFFFF' },
    veranito:       { nombre: 'Veranito',     ini: 'VE', fondo: '#FFA615', texto: '#111111' },
    'after school': { nombre: 'After School', ini: 'AS', fondo: '#D71C0E', texto: '#FFFFFF' },
    gerencia:       { nombre: 'Gerencia',     ini: 'GE', fondo: '#111111', texto: '#FFFFFF' },
    general:        { nombre: 'General',      ini: 'GE', fondo: '#111111', texto: '#FFFFFF' },
    cumpleanos:     { nombre: 'Cumpleaños',   ini: 'CU', fondo: '#1974A8', texto: '#FFFFFF' },
    'baby & me':    { nombre: 'Baby & Me',    ini: 'BM', fondo: '#68A8C9', texto: '#111111' },
    'baby and me':  { nombre: 'Baby & Me',    ini: 'BM', fondo: '#68A8C9', texto: '#111111' }
  };
  function unidadDoc(u) {
    const n = String(u || '').trim();
    return UNIDADES_DOC[normal(n)] || { nombre: n || 'Sin unidad', ini: (n || '?').slice(0, 2).toUpperCase(), fondo: '#6B6B6B', texto: '#FFFFFF' };
  }

  /** «Martes 21 de octubre» */
  function fechaLarga(iso) {
    const d = iso ? new Date(iso + 'T12:00:00') : new Date();
    const s = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  window.Marca = { esc, cabecera, saludo, nombreDe, toast, fechaLarga, MARCAS, marcaDe, rutaUnidad, unidadDoc, normal,
    UNIDADES, icono, esqueleto, logoVea, abrirBuscador, accionesNuevo, urlNuevo, NOTIFICACIONES, datosAS: null };
})();
