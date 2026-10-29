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
const CSS = fs.readFileSync(path.join(__dirname, '..', 'comun', 'vea.css'), 'utf8');
function cargar(fuente, puestosJs) {
  const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = { Marca: { esc, normal }, window: {}, document: { addEventListener() {}, documentElement: { classList: { toggle() {} } } } };
  vm.runInNewContext(puestosJs || PUESTOS_JS, ctx);
  ctx.Puestos = ctx.window.Puestos;
  vm.runInNewContext(fuente, ctx);
  return { O: ctx.window.Organigrama, Pu: ctx.window.Puestos };
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

/* Datos de la ficha (lo que manda equipo/api.php), con textos marcados para buscarlos. */
function datos(cambio) {
  const ficha = { version: 2, fechaVersion: '2026-10-29', verifica: 'Coordinación After School, cada día', comoVerifica: 'COMO-PRO', unidad: 'UNIDAD-PRO',
    contrato: { resultado: ['RESULTADO-PRO'], trabajo: ['TRABAJO-UNO', 'TRABAJO-DOS en la preparación de la SALIDA del mediodia'], estandares: ['ESTANDAR-UNO: el reporte diario llega a su hora'] },
    lista: [{ orden: 1, texto: 'PUNTO-UNO tras el cambio de pañales', evidencia: 'EVIDENCIA-UNO', frecuencia: 'Diario', periodo: '2026-10-29' }], procesos: [],
    ocupo: true, jefe: false, verifico: false, aceptada: false, aceptadaVersion: null, aceptadaFecha: '', pdf: true,
    verificador: { id: 'AS', puesto: 'Coordinación After School', escalado: false },
    hojas: [{ hoja: 'HOJA-CIERRE', pasos: [{ orden: 1, momento: 'Antes de la salida', paso: 'PASO-UNO' }, { orden: 2, momento: 'Antes de la salida', paso: 'PASO-DOS' }, { orden: 3, momento: 'Al final', paso: 'PASO-TRES' }],
      marcas: [{ fecha: '2026-10-29T18:05', usuario: 'yo-de-prueba', orden: 1, iniciales: 'YP' }, { fecha: '2026-10-29T18:06', usuario: 'otra-persona', orden: 2, iniciales: 'OP' },
               { fecha: '2026-10-28T18:00', usuario: 'yo-de-prueba', orden: 3, iniciales: 'YP' }], revisiones: [] }],
    marcas: [], revisiones: [] };
  const D = { hoy: '2026-10-29', yo: { usuario: 'yo-de-prueba', todo: false }, puestos: PUESTOS().map(p => p.id === 'PRO' ? Object.assign(p, { estado: 'Abierto al equipo' }) : p),
    fichas: { PRO: ficha }, reglas: [{ seccion: 'SECCION-UNO', textos: ['REGLA-UNO', 'REGLA-DOS'] }], momentos: MOMENTOS, personas: {} };
  if (cambio) cambio(D, ficha);
  return D;
}

let total = 0;
function comprobar(cargado, decir, FUENTE, CSS) {
  const { O, Pu } = cargado;
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
  ok(O._chispas > 0 && O._chispas <= 20, 'como mucho 20 chispas');
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

  // La ficha, pintada con datos inventados.
  const ficha = (cambio, paso) => { O._probar.datos(datos(cambio)); return O._probar.ficha('PRO', paso); };
  const h = ficha();
  ok(/Contrato de posición/.test(h) && /<th scope="row">Puesto<\/th><td>Profesor<\/td>/.test(h) && /<th scope="row">Unidad<\/th><td>UNIDAD-PRO<\/td>/.test(h) && /<th scope="row">Reporta a<\/th><td>Coordinación After School<\/td>/.test(h),
    'encabezado: «Contrato de posición» y la tabla Puesto · Unidad · Reporta a (con el NOMBRE del jefe)');
  const i = s => h.indexOf(s);
  ok(i('1. Resultado que produce') < i('RESULTADO-PRO') && i('RESULTADO-PRO') < i('2. Trabajo del que es responsable') && i('2. Trabajo') < i('TRABAJO-UNO') && i('TRABAJO-UNO') < i('TRABAJO-DOS') &&
    i('TRABAJO-DOS') < i('3. Estándares con que se evalúan los resultados') && i('3. Estándares') < i('ESTANDAR-UNO') && i('ESTANDAR-UNO') < i('4. Aceptación') && i('4. Aceptación') < i('Lista de verificación') && i('Lista de verificación') < i('HOJA-CIERRE'),
    'el orden del papel: 1, 2, 3, 4; debajo, la lista y la hoja diaria');
  ok(/<ol class="eq-ol"><li><span>TRABAJO-UNO/.test(h) && !/[Hh]orario|[Jj]ornada/.test(h.replace(/Horarios del servicio/g, '')), 'trabajo y estándares numerados; sin horario de la persona');
  ok(h.includes('Acepto ser responsable de producir el resultado de esta posición, del trabajo y de los estándares con que se evalúa. Este contrato puede cambiar según las necesidades de Vida en Arte.'), '4. Aceptación con el texto exacto');
  ok(/data-eq-aceptar>Aceptar<\/button>/.test(h) && /data-eq-pdf/.test(h), 'abierto y lo ocupa: botón «Aceptar» y «Descargar PDF»');
  ok(/Preparación de la salida del mediodía · 12:30/.test(h) && /Reporte diario · 2:00 p\. m\./.test(h) && /Cambio de pañales · 10:00/.test(h), 'la hora junto al trabajo, el estándar y el punto de la lista que nombran un momento');
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
  // Hoja diaria.
  const paso = o => (h.match(new RegExp('<button type="button" class="eq-paso" data-eq-paso="0:' + o + '"[^>]*>[\\s\\S]*?</button>')) || [''])[0];
  ok(/aria-pressed="true"/.test(paso(1)) && !/disabled/.test(paso(1)) && /6:05 p\. m\. · YP/.test(paso(1)), 'mi paso de hoy: marcado, con la hora y mis iniciales, y se puede desmarcar');
  ok(/aria-pressed="true"/.test(paso(2)) && /disabled/.test(paso(2)) && /6:06 p\. m\. · OP/.test(paso(2)), 'el paso que marcó otra persona: marcado y sin poder desmarcarlo');
  ok(/aria-pressed="false"/.test(paso(3)) && !/disabled/.test(paso(3)), 'la marca de ayer no cuenta hoy');
  ok(/2 de 3 pasos/.test(h) && i('Antes de la salida') < i('PASO-UNO') && i('PASO-DOS') < i('Al final'), 'agrupada por momento, con la cuenta del día');
  ok(/La verifica|Verifica:<\/b> Coordinación After School, cada día/.test(h), 'dice quién la verifica');
  const ajenoHoja = ficha((D, f) => { f.ocupo = false; });
  ok((ajenoHoja.match(/class="eq-paso"[^>]*disabled/g) || []).length === 3 && !/eq-verificar-hoja/.test(ajenoHoja), 'quien no la ocupa no marca; sin verificar, no hay formulario');
  ok(/eq-verificar-hoja/.test(ficha((D, f) => { f.ocupo = false; f.verifico = true; })), 'quien la verifica tiene el formulario de verificación');
  const escalado = ficha((D, f) => { f.verificador = { id: 'DIR', puesto: 'Dirección', escalado: true }; });
  ok(/Esta vez verifica Dirección:<\/b> quien ocupa este puesto ocupa también el que lo verifica/.test(escalado), 'si se verificaría a sí mismo, la ficha dice que verifica Dirección');

  // En el código y en vea.css: ficha, movimiento y PDF.
  ok(/dlg\.showModal\(\)/.test(FUENTE) && /document\.createElement\('dialog'\)/.test(FUENTE), 'la ficha es un <dialog> que se abre con showModal: centrada y lo de atrás inerte');
  ok(/ev\.key === 'Escape'\) \{ ev\.preventDefault\(\); cerrarFicha\(\)/.test(FUENTE) && /if \(ev\.target === dlg\) \{ cerrarFicha\(\); return; \}/.test(FUENTE), 'Esc y tocar afuera la cierran');
  ok(/if \(ev\.key !== 'Tab'\) return;/.test(FUENTE) && /ultimo\.focus\(\)/.test(FUENTE) && /primero\.focus\(\)/.test(FUENTE), 'con Tab el foco da la vuelta dentro de la ficha');
  ok(/CELULAR = '\(max-width: 640px\)'/.test(FUENTE) && /modo = window\.matchMedia && window\.matchMedia\(CELULAR\)\.matches \? 'lista' : 'arbol'/.test(FUENTE), 'en celular (640 px o menos), la lista por áreas, sin 3D');
  ok(/data-eq-zoom="' \+ k/.test(FUENTE) && /'ajustar'/.test(FUENTE) && /addEventListener\('wheel'/.test(FUENTE) && /pellizco/.test(FUENTE), 'mover y acercar: rueda, pellizco y botones − / + / «Ajustar»');
  ok(/class="eq-losa ' \+ clases \+ '"' \+ st \+ ' data-eq-puesto=/.test(FUENTE) && /<button type="button" class="eq-losa/.test(FUENTE) && /\.eq-losa:focus-visible \{ outline: 3px solid #FFFFFF/.test(CSS), 'cada tarjeta es un botón con foco visible que abre la ficha');
  ok(/addEventListener\('visibilitychange', \(\) => document\.documentElement\.classList\.toggle\('eq-pausa', document\.hidden\)\)/.test(FUENTE) && /\.eq-pausa \.eq-fondo \*, \.eq-pausa \.eq-org3d \*[^{]*\{ animation-play-state: paused !important; \}/.test(CSS),
    'con la pestaña oculta, las animaciones se pausan');
  const cuadros = [...CSS.matchAll(/@keyframes (eq-[\w-]+) \{([\s\S]*?)\}\s*\}/g)];
  const props = cuadros.flatMap(k => [...k[2].matchAll(/([a-z-]+)\s*:/g)].map(x => x[1]));
  ok(cuadros.length >= 8 && props.length && props.every(p => p === 'transform' || p === 'opacity'), 'las animaciones de Equipo mueven solo transform y opacity (' + [...new Set(props)].join(', ') + ')');
  ok(/@media \(prefers-reduced-motion: reduce\) \{\s*\.eq-fondo \*, \.eq-org3d \*, \.eq-org3d \*::after \{ animation: none !important; \}/.test(CSS), 'con «reducir movimiento», todo quieto');
  ok(/@media \(prefers-reduced-transparency: reduce\) \{\s*\.eq-escena body \{ background: #141618; \}\s*\.eq-fondo \{ display: none; \}/.test(CSS) && /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*\.eq-escena body \{ background: #141618; \}\s*\.eq-fondo \{ display: none; \}/.test(CSS),
    'versión sólida (reducir transparencia o sin desenfoque): fondo plano, sin foto ni animación');
  ok(/\.eq-plano \{ transform-style: preserve-3d; transform: rotateX\(7deg\)/.test(CSS) && /\.eq-escenario \{ perspective: 1800px/.test(CSS) && /button\.eq-losa:hover \{ transform: translateY\(-6px\) translateZ\(40px\)/.test(CSS),
    'el plano inclinado 7° con perspectiva, y la tarjeta se levanta al pasar el cursor');
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
  ['las líneas son todas blancas', 'org', "color: colorArea(c.cab.area).fondo, d: ENTRADA.lineas + 0.5", "color: '#FFFFFF', d: ENTRADA.lineas + 0.5"],
  ['la cascada no termina', 'org', "d: Math.min(ENTRADA.tope, ENTRADA.puestos + i * ENTRADA.paso + j * ENTRADA.puesto)", "d: ENTRADA.puestos + i * ENTRADA.paso + j * 0.3"],
  ['demasiadas chispas', 'org', "const CHISPAS = 16;", "const CHISPAS = 40;"],
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
  ['se desmarca la marca de otra persona', 'org', "const activo = puedeMarcar && hoy && !ajena && guardandoPaso !== clave;", "const activo = puedeMarcar && hoy && guardandoPaso !== clave;"],
  ['la marca de ayer cuenta hoy', 'org', "const marcasDia = h.marcas.filter(m => m.fecha.slice(0, 10) === dia);", "const marcasDia = h.marcas;"],
  ['el PDF a quien no le toca', 'org', "const pdf = f.pdf ?", "const pdf = true ?"],
  ['la ficha ya no se cierra con Esc', 'org', "if (ev.key === 'Escape') { ev.preventDefault(); cerrarFicha(); return; }", "if (ev.key === 'Escape') return;"],
  ['el foco se escapa con Tab', 'org', "if (ev.key !== 'Tab') return;", "return;"],
  ['el celular ve el árbol', 'org', "CELULAR = '(max-width: 640px)'", "CELULAR = '(max-width: 1px)'"],
  ['no se pausa con la pestaña oculta', 'org', "document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('eq-pausa', document.hidden));", ""],
  ['una animación mueve otra cosa (el piso)', 'css', "@keyframes eq-crece-v { from { transform: scaleY(0); } to { transform: scaleY(1); } }", "@keyframes eq-crece-v { from { height: 0; } to { height: 100%; } }"],
  ['«reducir movimiento» ya no detiene todo', 'css', "  .eq-fondo *, .eq-org3d *, .eq-org3d *::after { animation: none !important; }\n  .eq-chispa { display: none; }", "  .eq-chispa { display: none; }"],
  ['la versión sólida conserva el fondo', 'css', "  .eq-escena body { background: #141618; }\n  .eq-fondo { display: none; }\n  .eq-escena .cab { background: #141618; -webkit-backdrop-filter", "  .eq-escena body { background: #141618; }\n  .eq-escena .cab { background: #141618; -webkit-backdrop-filter"],
  ['el PDF imprime toda la página', 'css', "  html.eq-imprimiendo body > *:not(#eq-impresion) { display: none !important; }\n", ""]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, cual, de, a] of ROTURAS) {
  const base = cual === 'org' ? FUENTE : cual === 'puestos' ? PUESTOS_JS : CSS;
  if (base.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  const roto = base.replace(de, a);
  let f;
  try { f = comprobar(cargar(cual === 'org' ? roto : FUENTE, cual === 'puestos' ? roto : PUESTOS_JS), false, cual === 'org' ? roto : FUENTE, cual === 'css' ? roto : CSS); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
