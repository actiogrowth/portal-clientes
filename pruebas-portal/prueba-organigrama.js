/* Organigrama de Procesos › Equipo (comun/organigrama.js, 27-oct), con
 * puestos INVENTADOS, y sus roturas (cada una tiene que hacer fallar alguna
 * comprobación).
 *
 *   node pruebas-portal/prueba-organigrama.js
 *
 * Sin navegador: se carga el archivo con un Marca de mentira y se prueban la
 * estructura y las posiciones que calcula (las áreas en UNA fila, cada línea
 * de su jefe al puesto y del color del área, el conteo de la lista del
 * celular). De la ficha se comprueba en el código lo que no se puede ver sin
 * navegador: que se abre con showModal (centrada, lo de atrás inerte), que
 * se cierra con Esc y tocando afuera, que el foco no sale con Tab y que
 * vuelve al puesto. La vista previa (servir-after-school.js) lo muestra.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'comun', 'organigrama.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'comun', 'vea.css'), 'utf8');
function cargar(fuente) {
  const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ctx = { Marca: { esc: s => String(s), normal }, window: {} };
  vm.runInNewContext(fuente, ctx);
  return ctx.window.Organigrama;
}

const P = (id, puesto, area, reportaA, estado) => ({ id, puesto, area, reportaA, estado: estado || 'Por cargar', ficha: true });
const PUESTOS = () => [
  P('DIR', 'Dirección', 'Dirección', ''),
  P('COM', 'Dirección comercial', 'Comercial', 'DIR'), P('C1', 'Comercial uno', 'Comercial', 'COM'),
  P('ADM', 'Administración', 'Administración', 'DIR', 'Borrador'), P('CON', 'Contabilidad', 'Administración', 'ADM', 'Borrador'), P('MAN', 'Mantenimiento', 'Administración', 'ADM'),
  P('PRE', 'Coordinación del preescolar', 'Preschool', 'DIR'), P('AUX', 'Auxiliar', 'Preschool', 'PRE'), P('SUB', 'Ayudante del auxiliar', 'Preschool', 'AUX', 'Validado'),
  P('AS', 'Coordinación After School', 'After School', 'DIR', 'Abierto al equipo'), P('PRO', 'Profesor', 'After School', 'AS'),
  P('VER', 'Coordinación de Veranito', 'Veranito', 'DIR'),
  P('SUELTO', 'Puesto sin jefe', 'Otra', 'NO-EXISTE')];

let total = 0;
function comprobar(O, decir, FUENTE) {
  let f = 0;
  const ok = (c, m) => { total++; if (!c) { f++; if (decir) console.log('  ✗ ' + m); } else if (decir) console.log('  ✓ ' + m); };
  const a = O._arbol(PUESTOS());
  ok(a.raiz && a.raiz.id === 'DIR', 'la raíz es el puesto sin «Reporta a» (Dirección)');
  ok(a.columnas.map(c => c.cab.id).join() === 'COM,ADM,PRE,AS,VER,SUELTO', 'una columna por cada puesto que reporta a Dirección (en el orden del Sheet) y, al final, los sueltos');
  const pre = a.columnas.find(c => c.cab.id === 'PRE');
  ok(pre.puestos.map(x => x.p.id + ':' + x.nivel + ':' + x.padre).join() === 'AUX:0:PRE,SUB:1:AUX', 'debajo de cada área sus puestos, con su nivel y su jefe');
  const L = O._disponer(a), M = O._medidas, por = Object.fromEntries(L.nodos.map(n => [n.id, n]));
  const cabs = L.nodos.filter(n => n.tipo === 'cab');
  ok(cabs.length === 6 && new Set(cabs.map(n => n.y)).size === 1, 'computador y tablet: las áreas (y los sueltos) en UNA sola fila');
  ok(cabs.every((n, i) => !i || n.x > cabs[i - 1].x + n.w - 1), 'una al lado de la otra, sin encimarse');
  ok(por.DIR.y < cabs[0].y && Math.abs(por.DIR.x + por.DIR.w / 2 - L.ancho / 2) < 1, 'Dirección arriba, al centro');
  ok(por.SUB.x > por.AUX.x && por.AUX.x > por.PRE.x && por.SUB.y > por.AUX.y && por.AUX.y > por.PRE.y, 'cada nivel más abajo y con más sangría que su jefe');
  const linea = id => L.lineas.find(l => new RegExp('H' + por[id].x + '$').test(l.d) && l.d.startsWith('M' + (por[por[id].padre].x + 10) + ' '));
  ok(['C1', 'CON', 'MAN', 'AUX', 'SUB', 'PRO'].every(id => linea(id)), 'cada puesto tiene una línea que sale de su jefe y llega a él');
  ok(linea('PRO').color === '#B86E00' && linea('AUX').color === '#1974A8' && linea('CON').color === '#6B6B6B', 'la línea va del color del área (el naranja, oscurecido para verse sobre blanco)');
  ok(L.lineas.filter(l => /V/.test(l.d) && !/H/.test(l.d)).length === 1 + 5, 'de Dirección baja una línea y a cada área llega la suya (al suelto, ninguna)');
  ok(L.ancho >= cabs[cabs.length - 1].x + M.ancho && L.alto > por.SUB.y + M.alto, 'el lienzo alcanza para todas las tarjetas');
  ok(O._conteo(PUESTOS().filter(p => p.area === 'Administración')) === '3 puestos · 2 en borrador', 'celular: «3 puestos · 2 en borrador»');
  ok(O._conteo([P('X', 'x', 'y', ''), P('Z', 'z', 'y', '')]) === '2 puestos · en construcción', 'celular: sin nada más avanzado, «en construcción»');
  ok(O._conteo(PUESTOS().filter(p => p.area === 'Preschool')) === '3 puestos · 1 validado' && O._conteo([P('A', 'a', 'y', '', 'Abierto al equipo')]) === '1 puesto · 1 abierto', 'celular: singular y plural');
  // La ficha (en el código: el comportamiento lo muestra la vista previa).
  ok(/dlg\.showModal\(\)/.test(FUENTE) && /document\.createElement\('dialog'\)/.test(FUENTE), 'la ficha es un <dialog> que se abre con showModal: centrada y lo de atrás inerte');
  ok(/ev\.key === 'Escape'\) \{ ev\.preventDefault\(\); cerrarFicha\(\)/.test(FUENTE) && /addEventListener\('cancel', ev => \{ ev\.preventDefault\(\); cerrarFicha\(\); \}\)/.test(FUENTE), 'Esc la cierra');
  ok(/if \(ev\.target === dlg\) \{ cerrarFicha\(\); return; \}/.test(FUENTE), 'tocar afuera (el fondo) la cierra');
  ok(/if \(ev\.key !== 'Tab'\) return;/.test(FUENTE) && /ultimo\.focus\(\)/.test(FUENTE) && /primero\.focus\(\)/.test(FUENTE), 'con Tab el foco da la vuelta dentro de la ficha');
  ok(/const x = dlg\.querySelector\('\[data-eq-cerrar\]'\); if \(x\) x\.focus\(\);/.test(FUENTE) && /if \(v\) v\.focus\(\{ preventScroll: true \}\);/.test(FUENTE), 'al abrir, el foco va a la X; al cerrar, vuelve al puesto');
  ok(/CELULAR = '\(max-width: 640px\)'/.test(FUENTE) && /modo = window\.matchMedia && window\.matchMedia\(CELULAR\)\.matches \? 'lista' : 'arbol'/.test(FUENTE), 'en celular (640 px o menos), la lista por áreas');
  ok(/\.eq-dialogo::backdrop \{[^}]*backdrop-filter: blur\(/.test(CSS) && /@media \(max-width: 640px\) \{\s*\/\*[^*]*\*\/\s*\.eq-dialogo \{ width: 100vw; height: 100dvh;/.test(CSS) && /\.eq-dialogo \{ margin: auto;/.test(CSS),
    'vea.css: lo de atrás desenfocado, centrada (margin auto) y a pantalla completa en celular');
  ok(/data-eq-zoom="' \+ k/.test(FUENTE) && /'ajustar'/.test(FUENTE) && /addEventListener\('wheel'/.test(FUENTE) && /pellizco/.test(FUENTE) && /\.eq-zoom \.btn-circulo \{ width: var\(--toque\); height: var\(--toque\)/.test(CSS),
    'mover y acercar: rueda, pellizco y botones − / + / «Ajustar» de 44 px');
  return f;
}

console.log('· Organigrama');
const fallas = comprobar(cargar(FUENTE), true, FUENTE);
console.log(fallas ? '✗ ' + fallas + ' de ' + total + ' comprobaciones fallaron' : '✓ ' + total + ' comprobaciones pasan');

const ROTURAS = [
  ['las áreas bajan en escalera', "const cab = { id: c.cab.id, tipo: 'cab', x: xs[i], y: yCab,", "const cab = { id: c.cab.id, tipo: 'cab', x: xs[i], y: yCab + i * 20,"],
  ['las áreas se enciman', "const xs = a.columnas.map((c, i) => M.margen + i * (M.ancho + M.sep));", "const xs = a.columnas.map((c, i) => M.margen + i * M.sep);"],
  ['la línea llega al jefe equivocado', "const pa = pos[x.padre];", "const pa = pos[c.cab.id];"],
  ['las líneas son todas negras', "const area = c.cab.area, color = colorArea(area).linea, pos = {};", "const area = c.cab.area, color = '#111111', pos = {};"],
  ['el naranja de las líneas no se ve sobre blanco', "'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#B86E00' }", "'after school':   { fondo: '#FFA615', texto: '#111111', linea: '#FFA615' }"],
  ['sin sangría por nivel', "const sang = M.sangria * (x.nivel + 1);", "const sang = 0;"],
  ['el conteo no dice los borradores', "[[de('Borrador'), 'en borrador', 'en borrador'], ", "["],
  ['la ficha ya no se cierra con Esc', "if (ev.key === 'Escape') { ev.preventDefault(); cerrarFicha(); return; }", "if (ev.key === 'Escape') return;"],
  ['tocar afuera no cierra', "if (ev.target === dlg) { cerrarFicha(); return; }", "if (false) { cerrarFicha(); return; }"],
  ['el foco se escapa con Tab', "if (ev.key !== 'Tab') return;", "return;"],
  ['la ficha se abre sin showModal', "dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '')", "dlg.setAttribute('open', '')"],
  ['el celular ve el árbol', "CELULAR = '(max-width: 640px)'", "CELULAR = '(max-width: 1px)'"]
];
console.log('\n· roturas');
let detectadas = 0;
for (const [nombre, de, a] of ROTURAS) {
  if (FUENTE.split(de).length !== 2) { console.log('  ? ' + nombre + ': el texto no aparece una sola vez'); continue; }
  let f;
  const roto = FUENTE.replace(de, a);
  try { f = comprobar(cargar(roto), false, roto); } catch (e) { f = 1; }
  if (f) detectadas++;
  console.log((f ? '  ✓ detectada: ' : '  ✗ NO DETECTADA: ') + nombre);
}
console.log(detectadas === ROTURAS.length ? '✓ las ' + ROTURAS.length + ' roturas se detectan' : '✗ ' + (ROTURAS.length - detectadas) + ' roturas sin detectar');
process.exit(fallas || detectadas !== ROTURAS.length ? 1 : 0);
