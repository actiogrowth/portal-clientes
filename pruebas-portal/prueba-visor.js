/* El visor de documentos por tipo de enlace (comun/visor.js). Enlaces
 * INVENTADOS: ninguno apunta a un documento real.
 *
 *   node pruebas-portal/prueba-visor.js
 */
const V = require('../comun/visor.js');
let fallos = 0, total = 0;
const ok = (c, que) => { total++; if (!c) { fallos++; console.log('  ✗ ' + que); } };
const igual = (a, b, que) => ok(JSON.stringify(a) === JSON.stringify(b), que + ' (dio ' + JSON.stringify(a) + ')');

console.log('· cómo se muestra cada enlace');
igual(V.vista('https://drive.google.com/file/d/ARCHIVO-1/view?usp=sharing'), { modo: 'incrustar', url: 'https://drive.google.com/file/d/ARCHIVO-1/preview' }, 'Drive → /preview en el portal');
igual(V.vista('https://docs.google.com/document/d/DOC-1/edit'), { modo: 'incrustar', url: 'https://docs.google.com/document/d/DOC-1/preview' }, 'Google Docs → vista de solo lectura (nunca /edit)');
igual(V.vista('https://docs.google.com/presentation/d/PRES-1/edit#slide=id.p'), { modo: 'incrustar', url: 'https://docs.google.com/presentation/d/PRES-1/preview' }, 'Google Slides → /preview');
igual(V.vista('https://docs.google.com/spreadsheets/d/HOJA-1/edit'), { modo: 'incrustar', url: 'https://docs.google.com/spreadsheets/d/HOJA-1/preview' }, 'Google Sheets → /preview');
igual(V.vista('https://gamma.app/docs/Plan-de-Prueba-abc123xyz'), { modo: 'incrustar', url: 'https://gamma.app/embed/abc123xyz' }, 'Gamma → su modo de inserción');
igual(V.vista('https://gamma.app/docs/abc123xyz?mode=doc'), { modo: 'incrustar', url: 'https://gamma.app/embed/abc123xyz' }, 'Gamma sin título en la dirección');
igual(V.vista('https://ejemplo.test/tablero/'), { modo: 'nueva', url: 'https://ejemplo.test/tablero/' }, 'otro enlace → pestaña nueva');
igual(V.vista(''), { modo: 'nada', url: '' }, 'sin enlace → nada');
igual(V.vista('javascript:alert(1)'), { modo: 'nada', url: '' }, 'un enlace que no es http(s) nunca se abre');

console.log('· presentaciones privadas del portal (/proyecto-actio/archivos/)');
igual(V.vista('/proyecto-actio/archivos/palanca-1-anuncios.html'), { modo: 'incrustar', url: '/proyecto-actio/archivos/palanca-1-anuncios.html', aislado: true }, 'se incrustan aisladas (sandbox)');
igual(V.vista('/proyecto-actio/archivos/Palanca 1.html'), { modo: 'nada', url: '' }, 'un nombre con espacios o mayúsculas no se abre');
igual(V.vista('/proyecto-actio/archivos/../api.php'), { modo: 'nada', url: '' }, 'una ruta con .. no se abre');
igual(V.vista('/proyecto-actio/archivos/x.php'), { modo: 'nada', url: '' }, 'solo .html');
igual(V.vista('/after-school/'), { modo: 'nada', url: '' }, 'otra ruta del portal no se incrusta');
ok(V.version('Plan', '/proyecto-actio/archivos/plan-de-prueba.html') === 'Presentación', 'cuentan como Presentación');
ok(V.descarga('/proyecto-actio/archivos/plan-de-prueba.html') === '', 'sin botón de descarga');
ok(V.vista('https://drive.google.com/file/d/A/view').aislado === undefined, 'lo de Google no se marca aislado (su propio dominio ya lo aísla)');

console.log('· descarga');
ok(V.descarga('https://drive.google.com/file/d/ARCHIVO-1/view') === 'https://drive.usercontent.google.com/download?id=ARCHIVO-1&export=download', 'Drive se descarga');
ok(V.descarga('https://docs.google.com/document/d/DOC-1/edit') === 'https://docs.google.com/document/d/DOC-1/export?format=pdf', 'Docs como PDF');
ok(V.descarga('https://docs.google.com/presentation/d/PRES-1/edit') === 'https://docs.google.com/presentation/d/PRES-1/export/pdf', 'Slides como PDF');
ok(V.descarga('https://docs.google.com/spreadsheets/d/HOJA-1/edit') === 'https://docs.google.com/spreadsheets/d/HOJA-1/export?format=xlsx', 'Sheets como XLSX');
ok(V.descarga('https://gamma.app/docs/abc123xyz') === '' && V.descarga('https://ejemplo.test/x') === '', 'Gamma y páginas web: sin botón de descarga');

console.log('· versiones de un entregable');
ok(V.version('Plan de prueba (Presentación)', 'https://drive.google.com/file/d/X/view') === 'Presentación', 'la etiqueta del nombre manda');
ok(V.version('Plan de prueba (presentacion)', '') === 'Presentación', 'sin importar acentos ni mayúsculas');
ok(V.version('Plan de prueba (2)', 'https://drive.google.com/file/d/X/view') === 'Documento', 'una etiqueta que no es versión no cuenta: sale del enlace');
ok(V.version('Plan', 'https://gamma.app/docs/abc123xyz') === 'Presentación', 'sin etiqueta: Gamma es Presentación');
ok(V.version('Plan', 'https://ejemplo.test/app') === 'Interactiva', 'sin etiqueta: una página web es Interactiva');
ok(V.nombreBase('Plan de prueba (Interactiva)') === 'Plan de prueba' && V.nombreBase('Plan (2)') === 'Plan (2)', 'nombre base sin la etiqueta de versión');
const vs = V.versiones([
  { nombre: 'Plan (Interactiva)', enlace: 'https://ejemplo.test/app', fecha: '2026-01-01' },
  { nombre: 'Plan (Documento)', enlace: 'https://drive.google.com/file/d/A/view', fecha: '2026-01-01' },
  { nombre: 'Plan (Documento)', enlace: 'https://drive.google.com/file/d/B/view', fecha: '2026-02-01' },
  { nombre: 'Plan (Presentación)', enlace: 'https://gamma.app/docs/abc123xyz', fecha: '2026-01-01' }]);
ok(vs.map(v => v.version).join() === 'Documento,Presentación,Interactiva', 'orden fijo: Documento, Presentación, Interactiva');
ok(vs[0].enlace === 'https://drive.google.com/file/d/B/view', 'si hay dos de la misma versión, la más reciente');

console.log(fallos ? '✗ ' + fallos + ' de ' + total + ' comprobaciones fallan' : '✓ ' + total + ' comprobaciones del visor pasan');
process.exit(fallos ? 1 : 0);
