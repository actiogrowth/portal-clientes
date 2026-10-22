/* Falla si alguna página carga un archivo de comun/ sin versión, o con una
 * versión que no es la del archivo de hoy (ver versionar-comun.js). Así una
 * entrega no puede salir con un vea.css que el navegador saque de su caché.
 *
 *   node pruebas-portal/prueba-versiones.js
 *
 * Arreglo, si falla:  node pruebas-portal/versionar-comun.js --escribir
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { versionar, problemas } = require('./versionar-comun');

let fallos = 0;
const ok = (c, que) => { if (!c) { fallos++; console.log('  ✗ ' + que); } };

// La prueba se prueba a sí misma: lo que tiene que detectar, lo detecta.
const h = { 'vea.css': 'aaaaaaaaaa', 'marca.js': 'bbbbbbbbbb' };
ok(problemas('<link rel="stylesheet" href="/comun/vea.css">', h).length === 1, 'detecta un vea.css sin versión');
ok(problemas('<script src="/comun/marca.js?v=0000000000"></script>', h).length === 1, 'detecta una versión vieja');
ok(problemas('<style>@import url("/comun/vea.css") layer(vea);</style>', h).length === 1, 'detecta el @import sin versión');
ok(problemas("src: '/comun/otro.js'", h).length === 1, 'detecta un archivo que no existe en comun/');
ok(problemas('<!-- lo pinta /comun/marca.js -->', h).length === 0, 'un comentario que nombra el archivo no cuenta');
ok(problemas(versionar('<link href="/comun/vea.css"><script src="/comun/marca.js?v=0000000000"></script>', h), h).length === 0,
  'versionar() deja todo con la versión de hoy');

// Las páginas reales del repositorio.
try {
  execFileSync(process.execPath, [path.join(__dirname, 'versionar-comun.js')], { stdio: 'inherit' });
} catch (e) { fallos++; console.log('  ✗ hay páginas que cargan comun/ sin la versión correcta (node pruebas-portal/versionar-comun.js --escribir)'); }

console.log(fallos ? fallos + ' fallo(s)' : '✓ versiones de comun/: todo en orden');
process.exit(fallos ? 1 : 0);
