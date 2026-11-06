/* Organigrama y ficha de Procesos › Equipo (comun/organigrama.js y
 * comun/puestos.js; 29-oct: Equipo v2), con puestos INVENTADOS, y sus
 * roturas (cada una tiene que hacer fallar alguna comprobación).
 *
 *   node pruebas-portal/prueba-organigrama.js
 *
 * Sin navegador: se cargan los archivos con un Marca de mentira y se prueban
 * la estructura de la escena (áreas en columnas en el orden del Sheet, la
 * sangría de quien no reporta a la coordinación, las líneas del color del
 * área, la cascada de entrada que termina a tiempo), los colores de las
 * áreas, la hora de los momentos y la ficha pintada con datos inventados
 * (formato del contrato, cuándo hay botón de Aceptar, Reglas antes de
 * aceptar, hoja diaria, PDF). Del movimiento y de la ficha se comprueba en
 * el código y en vea.css lo que no se puede ver sin navegador. La vista
 * previa (servir-after-school.js) lo muestra.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'comun', 'organigrama.js'), 'utf8');
const PUESTOS_JS = fs.readFileSync(path.join(__dirname, '..', 'comun', 'puestos.js'), 'utf8');
const VERIF_JS = fs.readFileSync(path.join(__dirname, '..', 'comun', 'verificacion.js'), 'utf8');   // 2-nov
const CSS = fs.readFileSync(path.join(__dirname, '..', 'comun', 'vea.css'), 'utf8');
const ARM = fs.readFileSync(path.join(__dirname, '..', 'comun', 'armazon.css'), 'utf8');   // 3-nov: la estructura común (las partículas)
function cargar(fuente, puestosJs, verifJs) {
  const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = { Marca: { esc, normal }, window: {}, document: { addEventListener() {}, documentElement: { classList: { toggle() {} } } } };
  vm.runInNewContext(puestosJs || PUESTOS_JS, ctx);
  ctx.Puestos = ctx.window.Puestos;
  vm.runInNewContext(verifJs || VERIF_JS, ctx);
  ctx.Verificacion = ctx.window.Verificacion;
  vm.runInNewContext(fuente, ctx);
  return { O: ctx.window.Organigrama, Pu: ctx.window.Puestos, V: ctx.window.Verificacion };
}

const P = (id, puesto, area, reportaA, estado) => ({ id, puesto, area, reportaA, estado: estado || 'Por cargar', ficha: true });
const PUESTOS = () => [
  P('DIR', 'Dirección', 'Dirección', ''),
  P('COM', 'Coordinación comercial', 'Comercial', 'DIR'), P('C1', 'Comercial uno', 'Comercial', 'COM'),
  P('ADM', 'Coordinación administrativa', 'Administración', 'DIR', 'Borrador'), P('CON', 'Contabilidad', 'Administración', 'ADM', 'Borrador'),
  P('OPE', 'Coordinación operativa', 'Operación', 'DIR', 'Borrador'), P('MAN', 'Mantenimiento', 'Operación', 'OPE'),
  P('PRE', 'Coordinación del preescolar', 'Preschool', 'DIR'), P('AUX', 'Auxiliar', 'Preschool', 'PRE'), P('SUB', 'Ayudante del auxiliar', 'Preschool', 'AUX', 'Validado'),
  P('AS', 'Coordinación After School', 'After School', 'DIR', 'Abierto al equipo'), P('PRO', 'Profesor', 'After School', 'AS'),
  P('VER', 'Coordinación de Veranito', 'Veranito', 'DIR'),
  P('SUELTO', 'Puesto sin jefe', 'Otra', 'NO-EXISTE')];
const MOMENTOS = [{ momento: 'Salida del mediodía', hora: '12:00 a 1:00' }, { momento: 'Preparación de la salida del mediodía', hora: '12:30' },
  { momento: 'Reporte diario', hora: '2:00 p. m.' }, { momento: 'Cambio de pañales', hora: '10:00' }];

/* 2-nov: el calendario que manda el servidor (Procesos.gs v5): el 29-oct es miércoles de la semana 44; el 20, de la 43. */
const CAL = Object.fromEntries(['2026-09-30', '2026-10-20', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map(d => [d,
  { dia: d, semana: d < '2026-10-26' ? (d < '2026-10-01' ? '2026-S40' : '2026-S43') : '2026-S44', quincena: d.slice(0, 7) + (+d.slice(8) <= 15 ? '-Q1' : '-Q2'), mes: d.slice(0, 7) }]));
/* Datos de la ficha (lo que manda equipo/api.php), con textos marcados para buscarlos. */
function datos(cambio) {
  const ficha = { version: 2, fechaVersion: '2026-10-29', verifica: 'Coordinación After School, cada día', comoVerifica: 'COMO-PRO', unidad: 'UNIDAD-PRO',
    contrato: { resultado: ['RESULTADO-PRO'], trabajo: ['TRABAJO-UNO', 'TRABAJO-DOS en la preparación de la SALIDA del mediodia'], estandares: ['ESTANDAR-UNO: el reporte diario llega a su hora'] },
    lista: [{ orden: 1, texto: 'PUNTO-UNO tras el cambio de pañales', evidencia: 'EVIDENCIA-UNO', frecuencia: 'Diario', periodo: '2026-10-29', forma: 'dia', evento: false, grupo: 'Diario', grupoOrden: 1 }], procesos: [],
    ocupo: true, jefe: false, verifico: false, aceptada: false, aceptadaVersion: null, aceptadaFecha: '', pdf: true,
    verificador: { id: 'AS', puesto: 'Coordinación After School', escalado: false },
    hojas: [{ hoja: 'HOJA-CIERRE', temporal: false, pasos: [{ orden: 1, momento: 'Antes de la salida', paso: 'PASO-UNO', forma: 'dia' }, { orden: 2, momento: 'Antes de la salida', paso: 'PASO-DOS', forma: 'dia' }, { orden: 3, momento: 'Al final', paso: 'PASO-TRES', forma: 'dia' }],
      marcas: [{ fecha: '2026-10-29T18:05:10', usuario: 'yo-de-prueba', orden: 1, iniciales: 'YP', resultado: 'Ejecutado', nota: '' }, { fecha: '2026-10-29T18:06:00', usuario: 'otra-persona', orden: 2, iniciales: 'OP', resultado: 'Ejecutado', nota: '' },
               { fecha: '2026-10-28T18:00:00', usuario: 'yo-de-prueba', orden: 3, iniciales: 'YP', resultado: 'Ejecutado', nota: '' }], revisiones: [] }],
    marcas: [], revisiones: [] };
  const D = { hoy: '2026-10-29', yo: { usuario: 'yo-de-prueba', todo: false }, puestos: PUESTOS().map(p => p.id === 'PRO' ? Object.assign(p, { estado: 'Abierto al equipo' }) : p),
    fichas: { PRO: ficha }, reglas: [{ seccion: 'SECCION-UNO', textos: ['REGLA-UNO', 'REGLA-DOS'] }], momentos: MOMENTOS, personas: {}, calendario: CAL };
  if (cambio) cambio(D, ficha);
  return D;
}

let total = 0;
function comprobar(cargado, decir, FUENTE, CSS, VERIF) {
  VERIF = VERIF || VERIF_JS;
  const { O, Pu, V } = cargado;
  let f = 0;
  const ok = (c, m) => { total++; if (!c) { f++; if (decir) console.log('  ✗ ' + m); } else if (decir) console.log('  ✓ ' + m); };
  // Estructura y escena.
  const a = O._arbol(PUESTOS());
  ok(a.raiz && a.raiz.id === 'DIR', 'la raíz es el puesto sin «Reporta a» (Dirección)');
  ok(a.columnas.map(c => c.cab.id).join() === 'COM,ADM,OPE,PRE,AS,VER,SUELTO', 'una columna por cada puesto que reporta a Dirección, en el orden del Sheet, y al final los sueltos');
  const pre = a.columnas.find(c => c.cab.id === 'PRE');
  ok(pre.puestos.map(x => x.p.id + ':' + x.nivel + ':' + x.padre).join() === 'AUX:0:PRE,SUB:1:AUX', 'debajo de cada área sus puestos, con su nivel y su jefe');
  const E = O._escena(a), M = O._medidas, col = id => E.columnas.find(c => c.cab.id === id);
  ok(E.columnas.length === 7 && E.ancho === 7 * M.col + 6 * M.sep, 'la escena: una columna de ancho fijo por área (y el suelto)');
  ok(col('PRE').cuantos === 3 && col('COM').cuantos === 2 && col('VER').cuantos === 1, 'cada cabeza dice cuántos puestos tiene su área (la coordinación incluida)');
  const sub = col('PRE').puestos.find(x => x.p.id === 'SUB'), aux = col('PRE').puestos.find(x => x.p.id === 'AUX');
  ok(aux.sangria === 0 && sub.sangria === M.sangria, 'sangría solo para quien reporta a otro puesto que no es la coordinación');
  const verticales = E.lineas.filter(l => l.tipo === 'v'), bus = E.lineas.filter(l => l.tipo === 'h');
  ok(verticales.length === 1 + 6 && bus.length === 1, 'de Dirección baja una línea, la barra las une y a cada área llega la suya (al suelto, ninguna)');
  ok(verticales.slice(1).map(l => l.color).join() === '#2E9D4F,#6B6B6B,#D71C0E,#1974A8,#FFA615,#FFA615', 'cada línea que llega a un área va de su color (Comercial verde, Operación rojo…)');
  ok(verticales.slice(1).every((l, i) => l.x === E.centros[i]) && bus[0].x === E.centros[0] && bus[0].x + bus[0].largo === E.centros[5], 'las líneas caen en el centro de cada columna');
  const retrasos = [].concat(E.lineas.map(l => l.d), E.columnas.map(c => c.d), ...E.columnas.map(c => c.puestos.map(x => x.d)));
  const E_ = O._entrada;
  ok(Math.max(...retrasos) + 0.7 <= E_.total + 0.5 && E.columnas.every((c, i) => !i || c.d > E.columnas[i - 1].d) && E_.dir < E_.lineas && E_.lineas < E_.areas && E_.areas < E_.puestos,
    'entrada en cascada: Dirección, las líneas, las áreas y los puestos, y termina en unos 2,5 s');
  const larga = O._escena(O._arbol([P('D', 'D', 'Dirección', '')].concat([1, 2, 3, 4, 5, 6].map(k => P('A' + k, 'a', 'Preschool', 'D')),
    Array.from({ length: 20 }, (_, k) => P('X' + k, 'x', 'Preschool', 'A6')))));
  ok(Math.max(...larga.columnas[5].puestos.map(x => x.d)) <= E_.tope, 'aunque un área tenga 20 puestos, la cascada termina a tiempo');
  // 3-nov (rediseño, ajuste 2): Equipo sobre el fondo claro; en oscuro (ajuste 3), el degradado.
  // 6-nov (pedido de Vida en Arte): sin chispas ni brillos, en ningún modo. El fondo de la escena es solo el piso.
  ok(!('_chispas' in O) && /classList\.toggle\('eq-escena-clara', si\)/.test(FUENTE) && !/'eq-escena'/.test(FUENTE) && /f\.innerHTML = '<div class="eq-piso"><\/div>';/.test(FUENTE) && !/eq-chispa|eq-brillos/.test(FUENTE),
    '6-nov: la escena de Equipo sin chispas ni brillos (solo el piso)');
  ok(!/eq-chispa|eq-brillos|eq-sube|\.particulas/.test(CSS) && /\.eq-escena-clara body \{ background-image: var\(--escena-fondo\);/.test(CSS) && !/\.eq-escena[ ,.{]/.test(CSS),
    'vea.css: en claro, el fondo de la app; en oscuro, el degradado; sin chispas, brillos ni partículas');
  // Colores, en un solo lugar.
  ok(Pu.colorArea('Operación').fondo === '#D71C0E' && Pu.colorArea('comercial').fondo === '#2E9D4F' && Pu.colorArea('Dirección').fondo === '#111111' &&
    Pu.colorArea('After School').texto === '#111111' && Pu.colorArea('Veranito').fondo === '#FFA615' && Pu.colorArea('Otra').fondo === '#555555', 'los colores de las áreas (texto negro sobre el naranja; un área desconocida, gris)');
  ok(Pu.colorArea('After School').linea === '#B86E00', 'sobre blanco, las líneas del naranja van más oscuras (celular)');
  ok(!/#2E9D4F|#D71C0E|#1974A8/i.test(FUENTE), 'organigrama.js no repite colores de área: salen de comun/puestos.js');
  // La hora de los momentos.
  const m = t => Pu.momentosEn(t, MOMENTOS).map(x => x.momento + '=' + x.hora).join(' | ');
  ok(m('En la preparación de la SALIDA del mediodia, todo listo') === 'Preparación de la salida del mediodía=12:30', 'sin mayúsculas ni tildes; si dos se pisan, gana el más largo');
  ok(m('Antes del cambio de pañales y en la salida del mediodía; el reporte diario') === 'Cambio de pañales=10:00 | Salida del mediodía=12:00 a 1:00 | Reporte diario=2:00 p. m.', 'varios momentos, en el orden del texto');
  ok(m('Los reportes diarios de la tarde') === '' && m('El recambio de pañales') === '' && m('') === '', 'solo palabras enteras; sin momento, nada');
  ok(O._conteo(PUESTOS().filter(p => p.area === 'Administración')) === '2 puestos · 2 en borrador' && O._conteo([P('X', 'x', 'y', '')]) === '1 puesto · en construcción', 'celular: el conteo de cada área');
  ok(O._hora12('18:05') === '6:05 p. m.' && O._hora12('09:30') === '9:30 a. m.' && O._hora12('12:00') === '12:00 p. m.', 'la hora de una marca: «6:05 p. m.»');

  // 30-oct: ajustar al ancho, áreas por fila y el tronco que une las filas.
  const anchoDe = k => k * M.col + (k - 1) * M.sep + 2 * M.margen;
  ok(O._porFila(6, 1326) === 6 && O._porFila(6, 1500) === 6, 'computador (1366 px): las 6 áreas en una sola fila');
  ok(O._porFila(6, 728) === 3 && O._porFila(6, 984) === 3, 'tablet (768 px vertical o 1024 horizontal): dos filas de 3');
  ok([1326, 984, 728, 500].every(w => (w - 16) / anchoDe(O._porFila(6, w)) >= M.legible || O._porFila(6, w) === 1) && M.legible >= 0.8,
    'con las filas que elige, la letra de las tarjetas queda a escala ' + M.legible + ' o más (13 px se leen)');
  ok(O._porFila(7, 728) === 3 && O._porFila(6, 0) === 6, 'con 7 columnas, filas de 3; sin medida todavía, una sola fila');
  const dos = O._escena(a, 3);
  ok(dos.filas.length === 3 && dos.filas[0].columnas.map(c => c.cab.id).join() === 'COM,ADM,OPE' && dos.filas[1].columnas.map(c => c.cab.id).join() === 'PRE,AS,VER' && dos.ancho === 3 * M.col + 2 * M.sep && dos.varias,
    'en filas de 3: el ancho de 3 columnas y las áreas en el orden del Sheet');
  const barra = f => f.lineas.find(l => l.tipo === 'h');
  ok(dos.filas.slice(0, 2).every(f => barra(f) && barra(f).x === M.tronco) && dos.filas[0].lineas.filter(l => l.tipo === 'v' && l.y === 0).length === 1 && dos.filas[1].lineas.every(l => l.y !== 0),
    'con varias filas, cada barra sale del tronco de la izquierda; Dirección baja solo a la primera');
  ok(/function ajustar\(\) \{[\s\S]*?vista\.s = Math\.max\(ZOOM_MIN, Math\.min\(1, \(vw - 16\) \/ W\)\);[\s\S]*?altoLienzo\(\);/.test(FUENTE) &&
    /function altoLienzo\(\) \{[\s\S]*?getBoundingClientRect\(\)[\s\S]*?lienzo\.style\.height = Math\.ceil\(vista\.y \+ abajo \+ HOLGURA_ABAJO\) \+ 'px';/.test(FUENTE) && /plano\.addEventListener\('animationend', altoLienzo\)/.test(FUENTE),
    '«Ajustar» encaja al ANCHO (sin pasar de 1) y el lienzo crece hasta mostrar el árbol entero COMO SE VE (inclinado, con sombra), también al terminar la entrada');
  ok(/if \(porFilaPara\(arbol\(D\.puestos\)\.columnas\.length, el\.clientWidth\) !== porFila\) \{ ajustado = false; pintar\(\); \} else ajustar\(\);/.test(FUENTE), 'al girar la tablet se vuelve a ajustar (y a repartir en filas si hace falta)');
  ok(/addEventListener\('wheel', e => \{ if \(!e\.ctrlKey && !e\.metaKey\) return;/.test(FUENTE) && /\.eq-org3d \.eq-lienzo \{[^}]*touch-action: pan-y;/.test(CSS),
    'la rueda y el dedo bajan la página; Ctrl con la rueda, o el pellizco, acercan');
  ok(/t\.style\.height = \(cajas\[cajas\.length - 1\]\.offsetTop - cajas\[0\]\.offsetTop\) \+ 'px'/.test(FUENTE), 'el tronco mide de la primera barra a la última');

  // 30-oct: los grupos de la lista (los manda el script) y los avisos del Sheet.
  const ag = Pu.agrupar([{ orden: 1, frecuencia: 'Por cumpleaños', grupo: 'Cada vez que ocurre', grupoOrden: 8 }, { orden: 2, frecuencia: 'Mensual', grupo: 'Mensual', grupoOrden: 4 },
    { orden: 3, frecuencia: 'Cada luna', grupo: 'Cada luna', grupoOrden: 99 }, { orden: 4, frecuencia: 'Diario', grupo: 'Diario', grupoOrden: 1 }, { orden: 5, frecuencia: 'Cada rotación', grupo: 'Cada vez que ocurre', grupoOrden: 8 },
    { orden: 6, frecuencia: 'Quincenal', grupo: 'Quincenal', grupoOrden: 3 }, { orden: 7, frecuencia: 'Viejo' }]);
  ok(ag.map(g => g.grupo + ':' + g.puntos.map(x => x.orden).join('+')).join(' ') === 'Diario:4 Quincenal:6 Mensual:2 Cada vez que ocurre:1+5 Cada luna:3 Viejo:7',
    'grupos en el orden del script (Diario, Quincenal, Mensual… y «Cada vez que ocurre»), lo desconocido al final (' + ag.map(g => g.grupo).join(', ') + ')');
  ok(Pu.frecuenciaPropia({ frecuencia: 'Por cumpleaños', grupo: 'Cada vez que ocurre' }) === 'Por cumpleaños' && Pu.frecuenciaPropia({ frecuencia: 'Mensual', grupo: 'Mensual' }) === '',
    'cada punto de «Cada vez que ocurre» conserva su texto («Por cumpleaños»)');
  O._probar.datos(datos((D, f) => { f.lista = [{ orden: 1, texto: 'PUNTO-EVENTO', frecuencia: 'Por cumpleaños', grupo: 'Cada vez que ocurre', grupoOrden: 8, periodo: '2026-10-29' },
    { orden: 2, texto: 'PUNTO-DIARIO', frecuencia: 'Diario', grupo: 'Diario', grupoOrden: 1, periodo: '2026-10-29' }]; }));
  const fl = O._probar.ficha('PRO', null, 'lista');
  ok(fl.indexOf('>Diario</h4>') >= 0 && fl.indexOf('>Diario</h4>') < fl.indexOf('>Cada vez que ocurre</h4>') && /PUNTO-EVENTO<\/span><span class="eq-cuando">Por cumpleaños<\/span>/.test(fl), 'la ficha agrupa así y muestra el «Cada cuánto» propio');
  ok(/<details class="eq-avisos"' \+ \(avisosAbiertos \? ' open' : ''\) \+ '><summary>Avisos del Sheet \(' \+ D\.faltan\.length \+ '\)<\/summary>/.test(FUENTE) && !/En el Sheet faltan/.test(FUENTE),
    'los avisos del Sheet: una franja «Avisos del Sheet (n)» que se despliega');

  // La ficha, pintada con datos inventados.
  const ficha = (cambio, paso, pestana, amplio) => { O._probar.datos(datos(cambio)); return O._probar.ficha('PRO', paso, pestana, amplio); };
  const h = ficha();
  ok(/Contrato de posición/.test(h) && /<th scope="row">Puesto<\/th><td>Profesor<\/td>/.test(h) && /<th scope="row">Unidad<\/th><td>UNIDAD-PRO<\/td>/.test(h) && /<th scope="row">Reporta a<\/th><td>Coordinación After School<\/td>/.test(h),
    'encabezado: «Contrato de posición» y la tabla Puesto · Unidad · Reporta a (con el NOMBRE del jefe)');
  const i = s => h.indexOf(s);
  ok(i('1. Resultado que produce') < i('RESULTADO-PRO') && i('RESULTADO-PRO') < i('2. Trabajo del que es responsable') && i('2. Trabajo') < i('TRABAJO-UNO') && i('TRABAJO-UNO') < i('TRABAJO-DOS') &&
    i('TRABAJO-DOS') < i('3. Estándares con que se evalúan los resultados') && i('3. Estándares') < i('ESTANDAR-UNO') && i('ESTANDAR-UNO') < i('4. Aceptación') && i('1. Resultado') > 0,
    'el orden del papel: 1, 2, 3 y 4');
  // 2-nov: pestañas; la pestaña Contrato no trae la lista ni la hoja.
  ok(/role="tablist"/.test(h) && /data-eq-pestana="contrato">Contrato</.test(h) && /data-eq-pestana="lista">Lista de verificación</.test(h) && /data-eq-pestana="hojas">Hojas del día</.test(h) &&
    /aria-selected="true" tabindex="0" data-eq-pestana="contrato"/.test(h) && /role="tabpanel" id="eqPanel" aria-labelledby="eqTab-contrato"/.test(h), 'la ficha en pestañas: Contrato | Lista de verificación | Hojas del día; abre en Contrato');
  ok(!/PUNTO-UNO|HOJA-CIERRE|data-vf-marcar|data-eq-paso/.test(h), 'en la pestaña Contrato no va la lista de verificación ni la hoja: se lee y se acepta');
  ok(!/data-eq-pestana="hojas"/.test(ficha((D, f) => { f.hojas = []; })), 'sin hojas, no hay pestaña «Hojas del día»');
  ok(/<article class="eq-papel"><p class="eqp-marca">Vida en Arte<\/p><h3 class="eqp-tit">Contrato de posición<\/h3><p class="eqp-puesto">Profesor<\/p><table class="eq-contrato-tabla">/.test(h),
    'el contrato en la ficha es la hoja del PDF: «Vida en Arte», «Contrato de posición», el puesto y la tabla');
  ok(O._probar.papel('PRO').startsWith('<p class="eqp-marca">Vida en Arte</p><h3 class="eqp-tit">Contrato de posición</h3>') && /hoja\.innerHTML = papelHtml\(p, f, false\) \+/.test(FUENTE),
    'el PDF usa la misma hoja (papelHtml), sin las horas');
  ok(/<ol class="eq-ol"><li><span>TRABAJO-UNO/.test(h) && !/[Hh]orario|[Jj]ornada/.test(h.replace(/Horarios del servicio/g, '')), 'trabajo y estándares numerados; sin horario de la persona');
  ok(h.includes('Acepto ser responsable de producir el resultado de esta posición, del trabajo y de los estándares con que se evalúa. Este contrato puede cambiar según las necesidades de Vida en Arte.'), '4. Aceptación con el texto exacto');
  ok(/data-eq-aceptar>Aceptar<\/button>/.test(h) && /data-eq-pdf/.test(h) && /data-eq-ampliar>Ampliar</.test(h), 'abierto y lo ocupa: «Aceptar», «Descargar PDF» y «Ampliar»');
  const hl = ficha(null, null, 'lista');
  ok(/Preparación de la salida del mediodía · 12:30/.test(h) && /Reporte diario · 2:00 p\. m\./.test(h) && /Cambio de pañales · 10:00/.test(hl), 'la hora junto al trabajo, el estándar y el punto de la lista que nombran un momento');
  // 2-nov: subpuntos «N.M » en Trabajo y Estándar: sangrados, con su número y sin número de la lista.
  const conSub = (D, f) => { f.contrato.trabajo = ['GENERAL-UNO. Incluye:', '1.1 SUB-A', '1.2 SUB-B', 'GENERAL-DOS', '2.1 SUB-C', 'GENERAL-TRES']; f.contrato.estandares = ['1.1 SUELTO', 'EST-UNO']; };
  const hs = ficha(conSub), ps = (O._probar.datos(datos(conSub)), O._probar.papel('PRO')), as = ficha(conSub, null, 'contrato', true);
  const trabajoOk = x => x.includes('<ol class="eq-ol"><li><span>GENERAL-UNO. Incluye:</span><ul class="eq-subs"><li><b class="eq-subn">1.1</b> <span>SUB-A</span></li><li><b class="eq-subn">1.2</b> <span>SUB-B</span></li></ul></li><li><span>GENERAL-DOS</span><ul class="eq-subs"><li><b class="eq-subn">2.1</b> <span>SUB-C</span></li></ul></li><li><span>GENERAL-TRES</span></li></ol>');
  ok(trabajoOk(hs), 'subpuntos en la ficha: bajo su punto general, con su «1.1» y sin número de la lista (los generales quedan 1, 2, 3)');
  ok(trabajoOk(ps) && trabajoOk(as), '… igual en el PDF y en el contrato ampliado');
  ok(hs.includes('<ol class="eq-ol"><li class="eq-sin-numero"><ul class="eq-subs"><li><b class="eq-subn">1.1</b> <span>SUELTO</span></li></ul></li><li><span>EST-UNO</span></li></ol>') && /\.eq-ol li\.eq-sin-numero \{ list-style: none; counter-increment: none; \}/.test(CSS),
    'un subpunto sin punto general arriba va solo y sin número (no corre la numeración)');
  ok(/\.eq-subs \{ list-style: none;[^}]*padding-left: 14px;/.test(CSS) && /#eq-impresion \.eq-subs \{ display: block; list-style: none; padding-left: 12pt;/.test(CSS), 'los subpuntos van sangrados en pantalla y en el PDF');
  // 2-nov: Ampliar.
  ok(/^<div class="eq-amplio">/.test(as) && /class="eq-papel grande"/.test(as) && (as.match(/data-eq-reducir/g) || []).length === 2 && /← Volver/.test(as) && /data-eq-pdf/.test(as) && /data-eq-aceptar>Aceptar</.test(as) && !/role="tablist"/.test(as),
    'el contrato ampliado: hoja grande, «Volver» y la X para regresar, «Descargar PDF» y «Aceptar»');
  ok(!/data-eq-aceptar/.test(ficha((D, f) => { f.aceptada = true; f.aceptadaVersion = 2; }, null, 'contrato', true)) && !/data-eq-pdf/.test(ficha((D, f) => { f.pdf = false; }, null, 'contrato', true)),
    'ampliado sin Aceptar si ya aceptó, y sin PDF a quien no le toca');
  ok(/function salirFicha\(\) \{ if \(ampliado\) ampliar\(false\); else cerrarFicha\(\); \}/.test(FUENTE) && /dlg\.addEventListener\('cancel', ev => \{ ev\.preventDefault\(\); salirFicha\(\); \}\);/.test(FUENTE) &&
    /if \(ev\.key === 'Escape'\) \{ ev\.preventDefault\(\); salirFicha\(\); return; \}/.test(FUENTE), 'Esc en el contrato ampliado vuelve a la ficha (no la cierra)');
  ok(/if \(b\.dataset\.eqAceptar !== undefined\) \{ paso = 'reglas'; aviso = ''; ampliado = false;/.test(FUENTE), 'Aceptar desde el ampliado pasa por las Reglas del juego, en la ficha');
  ok(/\.eq-dialogo\.amplio \{ width: 100vw; height: 100dvh;/.test(CSS) && /\.eq-papel\.grande \{ font-size: 18px;/.test(CSS), 'ampliado a pantalla completa y con letra más grande (18 px)');
  ok(/if \(ev\.target === dlg && !ampliado\) \{ cerrarFicha\(\); return; \}/.test(FUENTE), 'tocar afuera cierra la ficha; ampliado no hay afuera');
  const borrador = ficha((D, f) => { D.puestos.find(p => p.id === 'PRO').estado = 'Borrador'; });
  ok(!/data-eq-aceptar/.test(borrador) && /está en Borrador/.test(borrador) && borrador.includes('Acepto ser responsable'), 'en Borrador: el texto sin botón y la nota del estado');
  ok(/está Validado/.test(ficha((D) => { D.puestos.find(p => p.id === 'PRO').estado = 'Validado'; })), 'Validado: su nota');
  const ajeno = ficha((D, f) => { f.ocupo = false; f.pdf = false; });
  ok(!/data-eq-aceptar/.test(ajeno) && !/data-eq-pdf/.test(ajeno) && /Lo acepta, desde su ficha, quien ocupa este puesto/.test(ajeno), 'abierto pero no lo ocupa: sin botón y sin PDF');
  const ya = ficha((D, f) => { f.aceptada = true; f.aceptadaVersion = 2; f.aceptadaFecha = '2026-10-29T10:30'; });
  ok(/Aceptado el 29 de octubre de 2026, 10:30 a\. m\. · versión 2/.test(ya) && !/data-eq-aceptar/.test(ya), 'ya aceptó esta versión: «Aceptado el … · versión …»');
  ok(/Hay una versión nueva de este contrato<\/b> \(aceptaste la 1\)/.test(ficha((D, f) => { f.aceptadaVersion = 1; })) , 'la versión subió: pide aceptar de nuevo');
  const reglas = ficha(null, 'reglas');
  ok(/Antes de aceptar: las Reglas del juego/.test(reglas) && /REGLA-UNO/.test(reglas) && /REGLA-DOS/.test(reglas) && /data-eq-lei/.test(reglas) && /data-eq-confirmar disabled/.test(reglas) && !/RESULTADO-PRO/.test(reglas),
    'al tocar Aceptar: las Reglas del juego completas y, hasta confirmar que se leyeron, el botón apagado');
  ok(/b\.dataset\.eqConfirmar !== undefined\) \{ if \(leyoReglas\) aceptar\(b\)/.test(FUENTE) && /b\.dataset\.eqAceptar !== undefined\) \{ paso = 'reglas'/.test(FUENTE), 'Aceptar pasa primero por las Reglas; sin confirmarlas, no acepta');
  // Hojas del día (pestaña aparte).
  const hh = ficha(null, null, 'hojas'), j = s => hh.indexOf(s);
  const pasoDe = (x, o) => (x.match(new RegExp('<button type="button" class="eq-paso" data-eq-paso="0:' + o + '"[^>]*>[\\s\\S]*?</button>')) || [''])[0];
  const paso = o => pasoDe(hh, o);
  ok(/aria-pressed="true"/.test(paso(1)) && !/disabled/.test(paso(1)) && /6:05 p\. m\. · YP/.test(paso(1)), 'mi paso de hoy: marcado, con la hora y mis iniciales, y se puede desmarcar');
  ok(/aria-pressed="true"/.test(paso(2)) && /disabled/.test(paso(2)) && /6:06 p\. m\. · OP/.test(paso(2)), 'el paso que marcó otra persona: marcado y sin poder desmarcarlo');
  ok(/aria-pressed="false"/.test(paso(3)) && !/disabled/.test(paso(3)), 'la marca de ayer no cuenta hoy');
  ok(/2 de 3 pasos/.test(hh) && j('Antes de la salida') < j('PASO-UNO') && j('PASO-DOS') < j('Al final') && !/RESULTADO-PRO/.test(hh), 'agrupada por momento, con la cuenta del día (y sin el contrato)');
  const quitado = ficha((D, f) => { f.hojas[0].marcas.push({ fecha: '2026-10-29T18:07:00', usuario: 'yo-de-prueba', orden: 1, iniciales: 'YP', resultado: 'Desmarcada', nota: '2026-10-29T18:05:10' }); }, null, 'hojas');
  ok(/aria-pressed="false"/.test(pasoDe(quitado, 1)) && /1 de 3 pasos/.test(quitado), 'una marca quitada («Desmarcada» con su fecha) ya no cuenta: el paso vuelve a pendiente');
  // 2-nov: pasos «Cada semana» y «Cada mes».
  const semanal = ficha((D, f) => { f.hojas[0].pasos.push({ orden: 4, momento: 'Cada semana', paso: 'PASO-SEMANAL', forma: 'semana' }, { orden: 5, momento: 'Cada mes', paso: 'PASO-MENSUAL', forma: 'mes' },
    { orden: 6, momento: 'Cada semana', paso: 'PASO-SEMANAL-DOS', forma: 'semana' });
    f.hojas[0].marcas.push({ fecha: '2026-10-27T09:00:00', usuario: 'yo-de-prueba', orden: 4, iniciales: 'YP', resultado: 'Ejecutado', nota: '' },
      { fecha: '2026-10-20T09:00:00', usuario: 'yo-de-prueba', orden: 6, iniciales: 'YP', resultado: 'Ejecutado', nota: '' }); }, null, 'hojas');
  ok(/aria-pressed="true"/.test(pasoDe(semanal, 4)) && /27 de octubre · 9:00 a\. m\. · YP/.test(pasoDe(semanal, 4)) && !/disabled/.test(pasoDe(semanal, 4)), '«Cada semana»: marcado el martes, el miércoles sigue marcado (con su día) y se puede quitar');
  ok(/aria-pressed="false"/.test(pasoDe(semanal, 6)) && /Pendiente · esta semana/.test(pasoDe(semanal, 6)), '«Cada semana»: la marca de la semana pasada no cuenta; sale «Pendiente · esta semana»');
  ok(/Pendiente · este mes/.test(pasoDe(semanal, 5)), '«Cada mes» sin marca: «Pendiente · este mes»');
  ok(/aria-pressed="false"/.test(paso(3)) && !/Pendiente|Vencido/.test(paso(3)), 'un paso diario sin marca hoy no lleva etiqueta');
  // 2-nov: Asignación temporal y «Por definir».
  const temporal = ficha((D, f) => { f.hojas[0].temporal = true; f.hojas[0].hoja = 'Apertura de prueba'; D.momentos = MOMENTOS.concat([{ momento: 'Apertura de prueba', hora: '' }]); }, null, 'hojas');
  ok(/<h3>Apertura de prueba <span class="eq-temporal">Asignación temporal<\/span><span class="eq-hora">Apertura de prueba · Por definir<\/span><\/h3>/.test(temporal), '«Asignación temporal» junto al nombre de la hoja; su hora sin escribir sale «Por definir»');
  ok(!/eq-temporal/.test(hh), 'una hoja sin «Temporal» no lleva la etiqueta');
  ok(Pu.etiquetasHora('Al empezar la apertura de prueba', [{ momento: 'Apertura de prueba', hora: '  ' }], s => s) === '<span class="eq-hora">Apertura de prueba · Por definir</span>' && Pu.hora('Por definir') === 'Por definir' && Pu.hora('7:55') === '7:55',
    '«Por definir», nunca un espacio vacío');
  ok(/esc\(Puestos\.hora\(h\.hora\)\)/.test(FUENTE), 'la tabla de Horarios del servicio también');
  const hlista = ficha(null, null, 'lista');
  ok(/Verifica:<\/b> Coordinación After School, cada día/.test(hlista), 'la lista dice quién la verifica');
  const ajenoHoja = ficha((D, f) => { f.ocupo = false; }, null, 'hojas');
  ok((ajenoHoja.match(/class="eq-paso"[^>]*disabled/g) || []).length === 3 && !/eq-verificar-hoja/.test(ajenoHoja), 'quien no la ocupa no marca; sin verificar, no hay formulario');
  ok(/eq-verificar-hoja/.test(ficha((D, f) => { f.ocupo = false; f.verifico = true; }, null, 'hojas')), 'quien la verifica tiene el formulario de verificación');
  const escalado = ficha((D, f) => { f.verificador = { id: 'DIR', puesto: 'Dirección', escalado: true }; }, null, 'lista');
  ok(/Esta vez verifica Dirección:<\/b> quien ocupa este puesto ocupa también el que lo verifica/.test(escalado), 'si se verificaría a sí mismo, la ficha dice que verifica Dirección');

  // 2-nov: la lista de verificación (comun/verificacion.js), con marcas de varios casos.
  const L = (D, f) => {
    const P = (orden, texto, frecuencia, forma, evento, grupo, grupoOrden, periodo) => ({ orden, texto, evidencia: '', frecuencia, forma, evento, grupo, grupoOrden, periodo });
    f.lista = [P(1, 'P-PENDIENTE', 'Diario', 'dia', false, 'Diario', 1, '2026-10-29'), P(2, 'P-MIA', 'Diario', 'dia', false, 'Diario', 1, '2026-10-29'),
      P(3, 'P-AJENA', 'Diario', 'dia', false, 'Diario', 1, '2026-10-29'), P(4, 'P-SEMANAL', 'Semanal', 'semana', false, 'Semanal', 2, '2026-S44'),
      P(5, 'P-EVENTO', 'Por pago', 'dia', true, 'Cada vez que ocurre', 8, '2026-10-29'), P(6, 'P-QUITADA', 'Diario', 'dia', false, 'Diario', 1, '2026-10-29')];
    const M = (orden, fecha, usuario, periodo, resultado, nota) => ({ orden, fecha, usuario, periodo, resultado, nota: nota || '' });
    f.marcas = [M(2, '2026-10-29T08:00:00', 'yo-de-prueba', '2026-10-29', 'No ejecutado', 'MOTIVO-MIO'), M(3, '2026-10-29T08:30:00', 'otra-persona', '2026-10-29', 'Ejecutado'),
      M(5, '2026-10-29T09:00:00', 'yo-de-prueba', '2026-10-29', 'Ejecutado', 'PAGO-A'), M(5, '2026-10-29T09:30:00', 'otra-persona', '2026-10-29', 'Ejecutado', 'PAGO-B'),
      M(6, '2026-10-29T10:00:00', 'yo-de-prueba', '2026-10-29', 'Ejecutado'), M(6, '2026-10-29T10:05:00', 'yo-de-prueba', '2026-10-29', 'Desmarcada', '2026-10-29T10:00:00'),
      M(1, '2026-10-28T08:00:00', 'yo-de-prueba', '2026-10-28', 'Ejecutado')];
  };
  const hv = ficha(L, null, 'lista'), pv = o => (hv.match(new RegExp('<li class="vf-punto" data-vf-punto="' + o + '">[\\s\\S]*?</li>(?=<li class="vf-punto"|</ul>)')) || [''])[0];
  ok(/vf-estado pendiente">Pendiente</.test(pv(1)) && /data-vf-marcar="1\|Ejecutado"/.test(pv(1)) && /data-vf-marcar="1\|No ejecutado"/.test(pv(1)), 'sin marca: «Pendiente» y los botones «Ejecutado» y «No ejecutado»');
  ok(/vf-estado no">No ejecutado</.test(pv(2)) && /data-vf-quitar="2\|2026-10-29T08:00:00" aria-pressed="true"/.test(pv(2)) && /data-vf-marcar="2\|Ejecutado" aria-pressed="false" disabled/.test(pv(2)) && /MOTIVO-MIO/.test(pv(2)),
    'mi marca: el botón marcado la quita al tocarlo; el otro, apagado; se ve el motivo');
  ok(/aria-pressed="true" disabled/.test(pv(3)) && !/data-vf-quitar/.test(pv(3)) && /vf-estado si">Ejecutado</.test(pv(3)), 'la marca de otra persona: marcada y sin poder quitarla');
  ok(/vf-estado pendiente">Pendiente</.test(pv(4)) && /Semanal <span>· Semana 44 de 2026<\/span>/.test(hv), 'el semanal sin marca esta semana: «Pendiente», con su semana en el grupo');
  ok(/data-vf-quitar="5\|2026-10-29T09:00:00">Quitar</.test(pv(5)) && (pv(5).match(/data-vf-quitar/g) || []).length === 1 && /PAGO-A/.test(pv(5)) && /PAGO-B/.test(pv(5)) && /data-vf-marcar="5\|Ejecutado"/.test(pv(5)) && !/vf-estado/.test(pv(5).replace(/vf-estado si|vf-res si/g, '')),
    'por evento: cada registro con su nota; solo el propio se quita; y se puede registrar otro');
  ok(/vf-estado pendiente">Pendiente</.test(pv(6)) && !/data-vf-quitar/.test(pv(6)), 'una marca quitada no cuenta: el punto vuelve a «Pendiente»');
  ok(/1 ejecutado/.test(hv) && /1 no ejecutado/.test(hv) && /3 pendientes/.test(hv), 'arriba, la cuenta: ejecutados, no ejecutados y pendientes');
  ok(/<input type="date" data-vf-dia value="2026-10-29" max="2026-10-29" min="2026-09-30">/.test(hv), 'el selector de fecha, del primer día del calendario a hoy');
  O._probar.datos(datos(L)); O._probar.dia('2026-10-28');
  const pasada = O._probar.ficha('PRO', null, 'lista');
  O._probar.dia('');
  ok(/value="2026-10-28"/.test(pasada) && !/data-vf-marcar|data-vf-quitar/.test(pasada) && /vf-estado vencido">Vencido</.test(pasada) && /data-vf-hoy>Volver a hoy</.test(pasada) && /ya no se marca/.test(pasada),
    'un día anterior se consulta de solo lectura, con «Vencido» y «Volver a hoy»');
  const est = (dia, cambio) => { const d = datos((D, f) => { L(D, f); if (cambio) cambio(D, f); }); return Object.fromEntries(V.estados(d.fichas.PRO, d, dia).map(v => [v.x.texto, v.estado])); };
  const ayer = est('2026-10-28');
  ok(ayer['P-PENDIENTE'] === 'Ejecutado' && ayer['P-MIA'] === 'Vencido' && ayer['P-SEMANAL'] === 'Pendiente' && ayer['P-EVENTO'] === 'Por evento', 'un día anterior: lo que no tuvo marca, «Vencido»; el semanal sigue en su semana abierta');
  ok(est('2026-10-20')['P-SEMANAL'] === 'Vencido' && est('2026-09-30')['P-PENDIENTE'] === 'Vencido', 'la semana pasada sin marca: «Vencido»');
  const sinCal = est('2026-10-28', D => { delete D.calendario; });
  ok(sinCal['P-SEMANAL'] === '' && est('2026-10-29', D => { delete D.calendario; })['P-SEMANAL'] === 'Pendiente', 'sin calendario (un script viejo): solo se sabe hoy; un día anterior no se adivina');
  const ver = ficha((D, f) => { L(D, f); f.ocupo = false; f.verifico = true; }, null, 'lista');
  ok(!/data-vf-marcar|data-vf-quitar/.test(ver) && /Quitó su marca de 29 de octubre, 10:00 a\. m\.: tú|Quitó su marca de 29 de octubre, 10:00 a\. m\.: yo-de-prueba/.test(ver) && /href="\/equipo\/#revisar">Revisar</.test(ver),
    'quien verifica: de solo lectura, con las marcas quitadas (quién y cuándo) y el enlace a Revisar');
  ok(!/Quitó su marca/.test(hv), 'quien ocupa el puesto no ve el historial de quitadas (ve el punto pendiente)');
  const borradorL = ficha((D, f) => { L(D, f); D.puestos.find(p => p.id === 'PRO').estado = 'Borrador'; }, null, 'lista');
  ok(!/data-vf-marcar|data-vf-quitar/.test(borradorL) && /Se marca cuando el puesto esté «Abierto al equipo»/.test(borradorL), 'un puesto que no está abierto no se marca');
  ok(/if \(x && \(x\.evento \|\| resultado === NO_EJECUTADO\)\) \{ st\.abierta = \{ orden, resultado \};/.test(VERIF) && /if \(!nota\) \{ st\.aviso = 'Escribe la nota: es obligatoria\.';/.test(VERIF) && /required data-vf-nota-txt/.test(VERIF),
    '«No ejecutado» y los puntos por evento piden la nota antes de guardar; «Ejecutado» se guarda al tocar');
  const r = V.resumenHoy(datos(L).fichas.PRO, datos(L));
  ok(r.diarios === 4 && r.hechos === 2, 'Mi lista: la cuenta de diarios de hoy (' + r.hechos + '/' + r.diarios + ')');

  // En el código y en vea.css: ficha, movimiento y PDF.
  ok(/dlg\.showModal\(\)/.test(FUENTE) && /document\.createElement\('dialog'\)/.test(FUENTE), 'la ficha es un <dialog> que se abre con showModal: centrada y lo de atrás inerte');
  ok(/function salirFicha\(\) \{ if \(ampliado\) ampliar\(false\); else cerrarFicha\(\); \}/.test(FUENTE) && /if \(ev\.target === dlg && !ampliado\) \{ cerrarFicha\(\); return; \}/.test(FUENTE), 'Esc y tocar afuera la cierran');
  ok(/if \(ev\.key !== 'Tab'\) return;/.test(FUENTE) && /ultimo\.focus\(\)/.test(FUENTE) && /primero\.focus\(\)/.test(FUENTE), 'con Tab el foco da la vuelta dentro de la ficha');
  ok(/CELULAR = '\(max-width: 640px\)'/.test(FUENTE) && /modo = window\.matchMedia && window\.matchMedia\(CELULAR\)\.matches \? 'lista' : 'arbol'/.test(FUENTE), 'en celular (640 px o menos), la lista por áreas, sin 3D');
  ok(/data-eq-zoom="' \+ k/.test(FUENTE) && /'ajustar'/.test(FUENTE) && /addEventListener\('wheel'/.test(FUENTE) && /pellizco/.test(FUENTE), 'mover y acercar: rueda, pellizco y botones − / + / «Ajustar»');
  ok(/class="eq-losa ' \+ clases \+ '"' \+ st \+ ' data-eq-puesto=/.test(FUENTE) && /<button type="button" class="eq-losa/.test(FUENTE) && /\.eq-losa:focus-visible \{ outline: 3px solid var\(--azul\)/.test(CSS), 'cada tarjeta es un botón con foco visible que abre la ficha');
  ok(/addEventListener\('visibilitychange', \(\) => document\.documentElement\.classList\.toggle\('eq-pausa', document\.hidden\)\)/.test(FUENTE) && /\.eq-pausa \.eq-org3d \*[^{]*\{ animation-play-state: paused !important; \}/.test(CSS),
    'con la pestaña oculta, las animaciones se pausan');
  const cuadros = [...CSS.matchAll(/@keyframes (eq-[\w-]+) \{([\s\S]*?)\}\s*\}/g)];
  const props = cuadros.flatMap(k => [...k[2].matchAll(/([a-z-]+)\s*:/g)].map(x => x[1]));
  // 3-nov (ajuste 2): sin la de las chispas quedan 7 (plano, respira, luz v/h, crece v/h, aparece).
  ok(cuadros.length >= 7 && props.length && props.every(p => p === 'transform' || p === 'opacity'), 'las animaciones de Equipo mueven solo transform y opacity (' + [...new Set(props)].join(', ') + ')');
  ok(/@media \(prefers-reduced-motion: reduce\) \{\s*\.eq-org3d \*, \.eq-org3d \*::after \{ animation: none !important; \}/.test(CSS), 'con «reducir movimiento», todo quieto');
  ok(/@media \(prefers-reduced-transparency: reduce\) \{\s*\.eq-fondo \{ display: none; \}/.test(CSS) && /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*\.eq-fondo \{ display: none; \}/.test(CSS),
    'versión sólida (reducir transparencia o sin desenfoque): sin piso, tarjetas opacas y sin animación');
  // 3-nov (ajuste 2): sobre claro, las sombras de las losas son grises suaves (no negras) y los textos de la página, los normales.
  const cara = (/\.eq-cara \{([^}]*)\}/.exec(CSS) || [])[1] || '';
  ok(/box-shadow: 0 0 0 1px var\(--losa-borde\), var\(--losa-capas\), var\(--losa-sombra\);/.test(cara) && /--losa-sombra: 0 16px 28px rgba\(22, 24, 29, \.12\)/.test(CSS) && /--losa-sombra: 0 18px 30px rgba\(0, 0, 0, \.45\)/.test(CSS),
    'las tarjetas con grosor: en claro, sombras grises suaves; en oscuro, las de la escena oscura (tokens)');
  ok(/\.eq-acceso \{[^}]*color: var\(--tinta\)/.test(CSS) && /\.eq-leyenda \{ color: var\(--suave\); \}/.test(CSS) && /\.eq-fantasma \{ color: var\(--tinta\); \}/.test(CSS) && /\.eq-fantasma > \.eq-cara \{[^}]*dashed/.test(CSS),
    'Reglas del juego, Horarios, la leyenda y «En construcción» en los colores normales de la app (no blancos)');
  ok(/\.eq-lin \{[^}]*background: var\(--org-linea\)/.test(CSS) && /--org-linea: #958F86/.test(CSS) && /\.eq-lin-col \{ background: color-mix\(in srgb, var\(--c\)/.test(CSS) && /\.eq-lin-h::after \{[^}]*var\(--c, var\(--tinta\)\)/.test(CSS),
    'líneas en gris medio (oscuro: blanco tenue), las de cada área con su color, y la luz del color del área');
  ok(/\.eq-plano \{ transform-style: preserve-3d; transform: rotateX\(7deg\)/.test(CSS) && /\.eq-escenario \{ perspective: 1800px/.test(CSS) && /button\.eq-losa:hover > \.eq-cara \{ transform: translateY\(-6px\) translateZ\(40px\)/.test(CSS),
    'el plano inclinado 7° con perspectiva, y la tarjeta (su cara) se levanta al pasar el cursor');
  // 30-oct (ajuste 2): la zona de clic no se transforma; la cara no recibe clics; lo decorativo tampoco.
  const reglaLosa = (CSS.match(/\n\.eq-losa \{[^}]*\}/) || [''])[0], reglaCara = (CSS.match(/\n\.eq-cara \{[^}]*\}/) || [''])[0];
  ok(reglaLosa && !/transform|transition/.test(reglaLosa) && !/button\.eq-losa:hover \{/.test(CSS) && /pointer-events: none/.test(reglaCara) && /\.eq-lin, \.eq-tic, \.eq-halo, \.eq-bus \{ pointer-events: none; \}/.test(CSS),
    'el botón de la tarjeta no tiene transformación propia; la cara y lo decorativo no reciben clics');
  ok(/cara = '<span class="eq-cara">' \+ interior \+ '<\/span>'/.test(FUENTE) && /data-eq-puesto="' \+ esc\(p\.id\) \+ '" aria-haspopup="dialog">' \+ cara \+ '<\/button>'/.test(FUENTE), 'cada tarjeta lleva su cara dentro del botón');
  ok(/if \(punteros\.size === 1 && \(e\.pointerType !== 'mouse' \|\| arrastrable\(\)\)\) inicio =/.test(FUENTE) && /const arrastrable = \(\) => tactil\(\) \|\| vista\.s > escalaAjuste \+ 0\.001;/.test(FUENTE) &&
    /\.eq-org3d \.eq-lienzo \{[^}]*cursor: default; \}/.test(CSS) && /\.eq-org3d \.eq-lienzo\.puede-arrastrar \{ cursor: grab; \}/.test(CSS),
    'manito: con el mouse, a la escala de «Ajustar» no se arrastra (sin manito); acercado o en pantalla táctil, sí');
  ok(/\.eq-quieto \.eq-entra/.test(CSS) && /if \(!entro\) setTimeout\(\(\) => \{ entro = true; \}/.test(FUENTE), 'la entrada en cascada pasa una sola vez');
  ok(/window\.print\(\)/.test(FUENTE) && /@media print \{[\s\S]*html\.eq-imprimiendo body > \*:not\(#eq-impresion\) \{ display: none !important; \}/.test(CSS) && /#eq-impresion \{ display: none; \}/.test(CSS) && /family=Inter/.test(CSS),
    'PDF: hoja de impresión propia (solo el contrato), con Inter, sin librerías');
  ok(/<h3>4\. Firma<\/h3>/.test(FUENTE) && /eqp-firma-tit">Firma</.test(FUENTE) && /<span>Nombre:<\/span><span>Fecha:<\/span>/.test(FUENTE), 'PDF: al final, firma, nombre y fecha');
  return f;
}

console.log('· Organigrama y ficha');
const fallas = comprobar(cargar(FUENTE), true, FUENTE, CSS);
console.log(fallas ? '✗ ' + fallas + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');

// [nombre, archivo ('org' | 'puestos' | 'css'), texto de hoy, texto roto]
const ROTURAS = [
  ['las áreas salen en otro orden', 'org', "const cabs = raiz ? hijos(raiz.id) : [];", "const cabs = raiz ? hijos(raiz.id).reverse() : [];"],
  ['sin sangría por nivel', 'org', "sangria: x.nivel * M.sangria,", "sangria: 0,"],
  ['la sangría también a quien reporta a la coordinación', 'org', "sangria: x.nivel * M.sangria,", "sangria: (x.nivel + 1) * M.sangria,"],
  ['las líneas son todas blancas', 'org', "color: c.color.fondo, d: ENTRADA.lineas + 0.5", "color: '#FFFFFF', d: ENTRADA.lineas + 0.5"],
  // 30-oct
  ['«Ajustar» vuelve a encajar al alto', 'org', "vista.s = Math.max(ZOOM_MIN, Math.min(1, (vw - 16) / W));", "vista.s = Math.max(ZOOM_MIN, Math.min(1, (vw - 16) / W, 600 / H));"],
  ['el lienzo no crece con el árbol', 'org', "    lienzo.style.height = Math.ceil(vista.y + abajo + HOLGURA_ABAJO) + 'px';\n", ""],
  ['el lienzo vuelve al alto «plano» (corta la última tarjeta)', 'org', "if (plano) plano.addEventListener('animationend', altoLienzo);", ""],
  ['en tablet todas las áreas en una fila (letra diminuta)', 'org', "if ((disponible - 16) / anchoDe(k) >= M.legible) return k;", "return n;"],
  ['la letra legible se baja a la mitad', 'org', "legible: 0.85,", "legible: 0.5,"],
  ['las filas no cuelgan del tronco', 'org', "desde = varias ? M.tronco : centroEn(0);", "desde = centroEn(0);"],
  ['la rueda sola acerca (no deja bajar la página)', 'org', "if (!e.ctrlKey && !e.metaKey) return; ", ""],
  ['al girar la tablet no se reparte en filas', 'org', "if (porFilaPara(arbol(D.puestos).columnas.length, el.clientWidth) !== porFila) { ajustado = false; pintar(); } else ajustar();", "ajustar();"],
  ['los grupos salen en otro orden', 'puestos', ".sort((a, b) => a.orden - b.orden || a.i - b.i)", ".sort((a, b) => a.i - b.i)"],
  ['el punto pierde su «Cada cuánto»', 'puestos', "normal(x.frecuencia) !== normal(x.grupo || x.frecuencia) ? x.frecuencia : ''", "''"],
  ['los avisos tapan la pantalla', 'org', "return '<details class=\"eq-avisos\"' + (avisosAbiertos ? ' open' : '') + '><summary>Avisos del Sheet (' + D.faltan.length + ')</summary>' +", "return '<div class=\"aviso ojo\">En el Sheet faltan: ' + D.faltan.join(' · ') + '<details class=\"eq-avisos\"' + (avisosAbiertos ? ' open' : '') + '><summary>Avisos del Sheet (' + D.faltan.length + ')</summary>' +"],
  ['en la tablet el dedo no deja bajar la página', 'css', "touch-action: pan-y; cursor: default; }", "touch-action: none; cursor: default; }"],
  // 30-oct (ajuste 2)
  ['el botón de la tarjeta vuelve a transformarse (el clic cae en la columna)', 'css', "color: var(--tinta); font: inherit; text-align: left; }\nbutton.eq-losa", "color: var(--tinta); font: inherit; text-align: left; transform: translateZ(0); }\nbutton.eq-losa"],
  ['la cara recibe los clics', 'css', "color: inherit; pointer-events: none;", "color: inherit;"],
  ['las líneas reciben clics', 'css', ".eq-lin, .eq-tic, .eq-halo, .eq-bus { pointer-events: none; }", ".eq-tic, .eq-halo { pointer-events: none; }"],
  ['la tarjeta sin cara', 'org', "cara = '<span class=\"eq-cara\">' + interior + '</span>';", "cara = interior;"],
  ['con el mouse siempre se arrastra', 'org', "(e.pointerType !== 'mouse' || arrastrable())", "(true)"],
  ['la manito siempre', 'css', ".eq-org3d .eq-lienzo.puede-arrastrar { cursor: grab; }", ".eq-org3d .eq-lienzo { cursor: grab; }"],
  ['la cascada no termina', 'org', "d: Math.min(ENTRADA.tope, ENTRADA.puestos + i * ENTRADA.paso + j * ENTRADA.puesto)", "d: ENTRADA.puestos + i * ENTRADA.paso + j * 0.3"],
  ['vuelve la escena oscura', 'org', "classList.toggle('eq-escena-clara', si);", "classList.toggle('eq-escena-clara', si); document.documentElement.classList.toggle('eq-escena', si);"],
  ['vuelven las chispas a la escena', 'org', "f.innerHTML = '<div class=\"eq-piso\"></div>';", "f.innerHTML = '<div class=\"eq-piso\"></div><span class=\"eq-chispa\"></span>';"],
  ['vuelven los brillos de color en oscuro', 'css', ".eq-escena-clara body { background-image: var(--escena-fondo); background-attachment: fixed; }", ".eq-escena-clara body { background-image: var(--escena-fondo); background-attachment: fixed; }\n[data-modo=\"oscuro\"] .eq-brillos { display: block; }"],
  ['las sombras de las losas vuelven a negro en claro', 'css', "--losa-sombra: 0 16px 28px rgba(22, 24, 29, .12);", "--losa-sombra: 0 18px 30px rgba(0, 0, 0, .45);"],
  ['«En construcción» vuelve al vidrio blanco sobre oscuro', 'css', ".eq-fantasma { color: var(--tinta); }", ".eq-fantasma { color: #FFFFFF; }"],
  ['Operación sin su rojo', 'puestos', "'operacion':      { fondo: '#D71C0E'", "'operacion':      { fondo: '#555555'"],
  ['el naranja de las líneas no se ve sobre blanco', 'puestos', "'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' }", "'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#FFA615' }"],
  ['el momento corto le gana al largo', 'puestos', ".sort((a, b) => normal(b.momento).length - normal(a.momento).length)", ".sort((a, b) => normal(a.momento).length - normal(b.momento).length)"],
  ['busca dentro de las palabras', 'puestos', "if (letra(t[i - 1]) || letra(t[fin])) continue;", ""],
  ['distingue mayúsculas y tildes', 'puestos', "const t = normal(texto), tomados", "const t = String(texto || ''), tomados"],
  ['Aceptar aparece en Borrador', 'org', "if (abierto && f.ocupo) {", "if (f.ocupo) {"],
  ['Aceptar aparece a quien no ocupa el puesto', 'org', "if (abierto && f.ocupo) {", "if (abierto) {"],
  ['acepta sin pasar por las Reglas', 'org', "if (b.dataset.eqAceptar !== undefined) { paso = 'reglas';", "if (b.dataset.eqAceptar !== undefined) { aceptar(b); paso = 'contrato';"],
  ['el botón de confirmar no espera a que se lean las Reglas', 'org', "data-eq-confirmar' + (leyoReglas ? '' : ' disabled') + '>", "data-eq-confirmar>"],
  ['el texto de la aceptación cambió', 'org', "Este contrato puede cambiar según las necesidades de Vida en Arte.';", "Este contrato puede cambiar.';"],
  ['Reporta a muestra el ID', 'org', "esc(jefe ? jefe.puesto : '—')", "esc(jefe ? jefe.id : '—')"],
  ['sin la hora de los momentos', 'org', "const horas = t => Puestos.etiquetasHora(t, D.momentos, esc);", "const horas = t => '';"],
  ['se desmarca la marca de otra persona', 'org', "const activo = puedeMarcar && hoy && abiertoPaso(x) && !ajena && guardandoPaso !== clave;", "const activo = puedeMarcar && hoy && abiertoPaso(x) && guardandoPaso !== clave;"],
  ['la marca de ayer cuenta hoy', 'org', "return P ? pie.filter(m => +m.orden === +x.orden && periodo(x, m.fecha.slice(0, 10)) === P)", "return P ? pie.filter(m => +m.orden === +x.orden)"],
  ['el PDF a quien no le toca', 'org', "const pdf = f.pdf ?", "const pdf = true ?"],
  ['la ficha ya no se cierra con Esc', 'org', "if (ev.key === 'Escape') { ev.preventDefault(); salirFicha(); return; }", "if (ev.key === 'Escape') return;"],
  // 2-nov: Equipo v3
  ['la pestaña Contrato trae también la lista', 'org', "      : '<div class=\"eq-papel-barra\">", "      : listaHtmlFicha(f) + '<div class=\"eq-papel-barra\">"],
  ['la pestaña Hojas aparece sin hojas', 'org', ".concat(f.hojas.length ? [['hojas', 'Hojas del día']] : [])", ".concat([['hojas', 'Hojas del día']])"],
  ['el contrato de la ficha no es la hoja del PDF', 'org', "'<article class=\"eq-papel\">' + papelHtml(p, f, true)", "'<article class=\"eq-papel\">' + contratoHtml(p, f, true)"],
  ['el PDF no usa la misma hoja', 'org', "hoja.innerHTML = papelHtml(p, f, false) +", "hoja.innerHTML = contratoHtml(p, f, false) +"],
  ['los subpuntos se numeran como puntos', 'org', "const SUBPUNTO = /^(\\d+\\.\\d+)\\s+/;", "const SUBPUNTO = /^$/;"],
  ['un subpunto suelto corre la numeración', 'css', ".eq-ol li.eq-sin-numero { list-style: none; counter-increment: none; }", ".eq-ol li.eq-sin-numero { list-style: none; }"],
  ['el ampliado sin «Volver»', 'org', "<button type=\"button\" class=\"btn sec chico\" data-eq-reducir>← Volver</button>", "<span></span>"],
  ['el ampliado sin Aceptar', 'org', "'<div class=\"eq-amplio-cuerpo\"><article class=\"eq-papel grande\">' + papelHtml(p, f, true) + aceptacionHtml(p, f) + '</article>", "'<div class=\"eq-amplio-cuerpo\"><article class=\"eq-papel grande\">' + papelHtml(p, f, true) + '</article>"],
  ['el ampliado con la letra de siempre', 'css', ".eq-papel.grande { font-size: 18px;", ".eq-papel.grande { font-size: 14px;"],
  ['Esc en el ampliado cierra la ficha', 'org', "function salirFicha() { if (ampliado) ampliar(false); else cerrarFicha(); }", "function salirFicha() { cerrarFicha(); }"],
  ['sin «Asignación temporal»', 'org', "(h.temporal ? ' <span class=\"eq-temporal\">Asignación temporal</span>' : '')", "''"],
  ['una hora vacía queda en blanco', 'puestos', "const hora = h => String(h == null ? '' : h).trim() || POR_DEFINIR;", "const hora = h => String(h == null ? '' : h).trim();"],
  ['los pasos semanales se cuentan por día', 'org', "const periodo = (x, d) => V.periodoEn(D, x.forma || 'dia', d);", "const periodo = (x, d) => V.periodoEn(D, 'dia', d);"],
  ['una marca quitada de la hoja sigue contando', 'org', "const V = Verificacion, pie = V.enPie(h.marcas, m => +m.orden);", "const V = Verificacion, pie = h.marcas;"],
  ['una marca quitada de la lista sigue contando', 'verif', "return (marcas || []).filter(m => norm(m.resultado) !== norm(DESMARCADA) && !quitadas.has(", "return (marcas || []).filter(m => norm(m.resultado) !== norm(DESMARCADA) && !!quitadas.has('x') === false && !quitadas.has('y' + "],
  ['se puede quitar la marca de otra persona', 'verif', "const accion = puesta ? (propia ? ' data-vf-quitar=", "const accion = puesta ? (true ? ' data-vf-quitar="],
  ['con una marca en pie, el otro botón sigue encendido', 'verif', "const apagado = guardando || st.guardando || (ultima && !(puesta && propia));", "const apagado = guardando || st.guardando;"],
  ['sin «Vencido»', 'verif', "!periodo ? '' : abierto ? 'Pendiente' : 'Vencido';", "!periodo ? '' : 'Pendiente';"],
  ['«No ejecutado» se guarda sin motivo', 'verif', "if (x && (x.evento || resultado === NO_EJECUTADO)) {", "if (x && x.evento) {"],
  ['el ocupante ve el historial de quitadas', 'verif', "const historial = soloLectura && v.quitadas.length ?", "const historial = v.quitadas.length ?"],
  ['quien verifica no ve las quitadas', 'verif', "const historial = soloLectura && v.quitadas.length ?", "const historial = false ?"],
  ['por evento se quitan marcas ajenas', 'verif', "v.marcas.map(m => linea(m, marcable && mia(m)))", "v.marcas.map(m => linea(m, marcable))"],
  ['un día anterior se adivina sin calendario', 'verif', "return (forma || 'dia') === 'dia' && esDia(dia) ? dia : null;", "return dia;"],
  ['se marca un día anterior', 'verif', "const puedeMarcar = abierto && f.ocupo && hoy,", "const puedeMarcar = abierto && f.ocupo,"],
  ['el foco se escapa con Tab', 'org', "if (ev.key !== 'Tab') return;", "return;"],
  ['el celular ve el árbol', 'org', "CELULAR = '(max-width: 640px)'", "CELULAR = '(max-width: 1px)'"],
  ['no se pausa con la pestaña oculta', 'org', "document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('eq-pausa', document.hidden));", ""],
  ['una animación mueve otra cosa (el piso)', 'css', "@keyframes eq-crece-v { from { transform: scaleY(0); } to { transform: scaleY(1); } }", "@keyframes eq-crece-v { from { height: 0; } to { height: 100%; } }"],
  ['«reducir movimiento» ya no detiene todo', 'css', "  .eq-org3d *, .eq-org3d *::after { animation: none !important; }\n  .eq-plano { transform: rotateX(7deg); }", "  .eq-plano { transform: rotateX(7deg); }"],
  ['la versión sólida conserva el piso', 'css', "@media (prefers-reduced-transparency: reduce) {\n  .eq-fondo { display: none; }", "@media (prefers-reduced-transparency: reduce) {"],
  ['el PDF imprime toda la página', 'css', "  html.eq-imprimiendo body > *:not(#eq-impresion) { display: none !important; }\n", ""]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, cual, de, a] of ROTURAS) {
  const base = cual === 'org' ? FUENTE : cual === 'puestos' ? PUESTOS_JS : cual === 'verif' ? VERIF_JS : CSS;
  if (base.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  const roto = base.replace(de, a);
  let f;
  try { f = comprobar(cargar(cual === 'org' ? roto : FUENTE, cual === 'puestos' ? roto : PUESTOS_JS, cual === 'verif' ? roto : VERIF_JS), false, cual === 'org' ? roto : FUENTE, cual === 'css' ? roto : CSS, cual === 'verif' ? roto : VERIF_JS); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
