/* Ninguna clave en lo que se sube al cPanel (4-nov-2026, D-123).
 *
 *   node pruebas-portal/prueba-sin-claves.js [carpeta o archivo …]
 *
 * Sin argumentos revisa las carpetas del portal que se suben al servidor.
 * Con argumentos revisa además esas carpetas o archivos (por ejemplo la
 * carpeta de una entrega, publicar-<nombre>/, o el index.html de la Base de
 * Datos, que vive en otro repositorio).
 *
 * Busca: direcciones /exec de Apps Script con su ID, IDs de implementación
 * (AKfycb…), hojas publicadas en la web (…/spreadsheets/d/e/2PACX-…), claves en
 * una dirección (key=…), la clave vieja de la Base de Datos y cualquier clave
 * escrita como valor (APPS_KEY, CLAVE_API, 'clave' => …, 'as_clave' => …).
 * Los LEEME y REPORTE de una entrega no se revisan: viven en el computador de
 * Marco y no se suben (el LEEME lleva la clave nueva a propósito).
 *
 * Antes de revisar, se prueba a sí misma: cada patrón tiene que encontrar un
 * ejemplo plantado y no saltar con los textos de ejemplo que sí están bien.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CPANEL = ['portal-raiz', 'comun', 'after-school', 'pasar-lista', 'configuracion', 'proyecto-actio', 'procesos', 'equipo',
                'resumen', 'pendientes', 'kinder', 'mensajes', 'veranito', 'biblioteca', 'basededatos'];
const TEXTO = /\.(php|html?|js|css|txt|json|webmanifest|svg|gs)$/i;
const NO_SE_SUBEN = /^(LEEME|REPORTE)[^/\\]*\.(txt|md)$/i;
const VIEJA = ['vea', '2026', 'clave', 'secreta'].join('-');   // partida a propósito

const PATRONES = [
  ['dirección /exec con su ID', /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/],
  ['ID de implementación de Apps Script', /AKfycb[A-Za-z0-9_-]{6,}/],
  ['hoja publicada en la web', /spreadsheets\/d\/e\/2PACX-[A-Za-z0-9_-]{10,}/],
  ['clave en una dirección', /[?&](key|clave)=[A-Za-z0-9_.~-]{12,}/],
  ['la clave vieja de la Base de Datos', new RegExp(VIEJA)],
  ['clave escrita en el código', /\b(APPS_KEY|CLAVE_API|API_KEY)\s*[:=]\s*['"][^'"\s]{6,}['"]/],
  ['clave o /exec escrita como valor de configuración', /['"](clave|as_clave|pa_clave|pr_clave|msj_clave|exec|as_exec|pa_exec|pr_exec)['"]\s*=>\s*['"][^'"\s…]{12,}['"]/]
];

function hallazgos(texto) {
  return PATRONES.filter(([, re]) => re.test(texto)).map(([n]) => n);
}

/* La prueba se prueba: plantados que tiene que encontrar y textos buenos que no. */
const PLANTADOS = [
  "const URL = 'https://script.google.com/macros/s/AKfycbzEjemploInventado0123456789abcdef/exec';",
  "id: AKfycbInventado12",
  'fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vInventado0123456789/pub?output=csv")',
  'fetch("api.php?accion=leer&key=claveInventada0123456789")',
  "var CLAVE_API = '" + VIEJA + "';",
  'const APPS_KEY = "otra-clave-inventada";',
  "  'clave' => 'clave-inventada-0123456789',",
  "  'msj_clave' => 'Abc123Inventada456Xyz',"
];
const BUENOS = [
  " *     'msj_clave' => 'la misma que MSJ_CLAVE_API en el script de la Base de Datos',",
  " *     'pr_exec'      => 'https://script.google.com/macros/s/…/exec',",
  "var PROP_CLAVE_API = 'BD_CLAVE_API';",
  'const APPS_SCRIPT_URL = "api.php";',
  "const url = APPS_SCRIPT_URL + \"?accion=leer\";",
  "{key:\"nombre\",label:\"Nombre del niño\",type:\"text\"}"
];
let roto = 0;
for (const p of PLANTADOS) if (!hallazgos(p).length) { roto++; console.log('  ✗ la prueba no encuentra: ' + p); }
for (const b of BUENOS) if (hallazgos(b).length) { roto++; console.log('  ✗ la prueba salta con un texto bueno: ' + b + ' (' + hallazgos(b).join(', ') + ')'); }
if (roto) { console.log('\nLa prueba misma está rota (' + roto + ')'); process.exit(1); }

function recorrer(ruta, lista) {
  if (!fs.existsSync(ruta)) return;
  const st = fs.statSync(ruta);
  if (st.isDirectory()) { for (const n of fs.readdirSync(ruta)) if (n !== 'capturas' && n !== 'node_modules' && !n.startsWith('.')) recorrer(path.join(ruta, n), lista); return; }
  if (TEXTO.test(ruta) && !NO_SE_SUBEN.test(path.basename(ruta))) lista.push(ruta);
}

const archivos = [];
for (const c of CPANEL) recorrer(path.join(REPO, c), archivos);
const extra = process.argv.slice(2);
for (const e of extra) recorrer(path.resolve(e), archivos);

let malos = 0;
for (const f of archivos) {
  const lineas = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lineas.forEach((l, i) => {
    const h = hallazgos(l);
    if (h.length) { malos++; console.log('  ✗ ' + path.relative(process.cwd(), f) + ':' + (i + 1) + ' — ' + h.join(', ')); }
  });
}
console.log('\n' + archivos.length + ' archivos revisados' + (extra.length ? ' (incluidos ' + extra.join(', ') + ')' : '') + ': ' +
  (malos ? malos + ' líneas con algo que no debe subirse' : 'ninguna clave, /exec ni hoja publicada'));
process.exit(malos ? 1 : 0);
