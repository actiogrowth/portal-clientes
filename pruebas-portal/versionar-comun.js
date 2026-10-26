/* Versión de los archivos de comun/ en cada página (22-oct-2026).
 *
 * EL PROBLEMA. Un navegador que ya abrió el portal guarda /comun/vea.css (y
 * marca.js, datos.js, los logos). Al publicar una página nueva, la página
 * llega nueva pero el estilo viejo sale de la caché, y se ve rota.
 *
 * LA SOLUCIÓN. Cada referencia lleva ?v=<hash del archivo>: /comun/vea.css?v=3f9a…
 * El hash sale del CONTENIDO (sha256, 10 caracteres, con los finales de
 * línea normalizados para que Windows y el servidor den lo mismo): cambia
 * solo cuando el archivo cambia, sin poner fechas a mano. El servidor ignora
 * el ?v= (el .htaccess y gate.php miran solo la ruta).
 *
 *   node pruebas-portal/versionar-comun.js                 comprueba (sale 1 si algo falta)
 *   node pruebas-portal/versionar-comun.js --escribir      pone o actualiza las versiones
 *   … [--escribir] otra/pagina.html …                      también esas páginas (Preschool,
 *                                                          Base de Datos: viven en otras ramas)
 *
 * Se versionan las referencias que CARGAN algo: entre comillas o en url(…).
 * Un comentario que nombra /comun/marca.js no se toca.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const COMUN = path.join(REPO, 'comun');
const PAGINAS = ['portal-raiz/index.html', 'portal-raiz/login.html', 'portal-raiz/cambiar-clave.html',
  'after-school/index.html', 'configuracion/index.html', 'pasar-lista/index.html', 'veranito/index.html', 'proyecto-actio/index.html',
  'procesos/index.html', 'equipo/index.html', 'resumen/index.html'];
const REF = /(["']|url\()\/comun\/([a-z0-9-]+\.(?:css|js|png|jpg|svg|webmanifest))(\?v=[0-9a-f]*)?/g;

const normalizar = b => Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
const hash = archivo => crypto.createHash('sha256').update(normalizar(fs.readFileSync(path.join(COMUN, archivo)))).digest('hex').slice(0, 10);

/* Pone la versión correcta a cada referencia de un texto. */
function versionar(texto, hashes) {
  return texto.replace(REF, (todo, antes, archivo) => hashes[archivo] ? antes + '/comun/' + archivo + '?v=' + hashes[archivo] : todo);
}
/* Lo que está mal en un texto: referencias sin versión, con otra versión o a archivos que no existen. */
function problemas(texto, hashes) {
  const p = [];
  for (const m of texto.matchAll(REF)) {
    const archivo = m[2], v = m[3] ? m[3].slice(3) : '';
    if (!hashes[archivo]) p.push('/comun/' + archivo + ' no existe en comun/');
    else if (!v) p.push('/comun/' + archivo + ' sin versión (falta ?v=' + hashes[archivo] + ')');
    else if (v !== hashes[archivo]) p.push('/comun/' + archivo + '?v=' + v + ' es una versión vieja (la de hoy es ' + hashes[archivo] + ')');
  }
  return p;
}

/* Los archivos de comun/ también se citan entre sí (marca.js carga el logo;
   app.webmanifest, sus íconos):
   primero se versionan por dentro y después se calcula su propio hash, hasta
   que nada cambie. */
function hashesDeComun(escribir) {
  const archivos = fs.readdirSync(COMUN).filter(f => /^[a-z0-9-]+\.(css|js|png|jpg|svg|webmanifest)$/.test(f));
  let hashes = {};
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    hashes = Object.fromEntries(archivos.map(f => [f, hash(f)]));
    let cambio = false;
    for (const f of archivos.filter(f => /\.(css|js|webmanifest)$/.test(f))) {
      const t = fs.readFileSync(path.join(COMUN, f), 'utf8'), n = versionar(t, hashes);
      if (n !== t) { cambio = true; if (escribir) fs.writeFileSync(path.join(COMUN, f), n); }
    }
    if (!cambio || !escribir) break;
  }
  return { archivos, hashes };
}

function correr(argv) {
  const escribir = argv.includes('--escribir');
  const extra = argv.filter(a => !a.startsWith('--'));
  const { archivos, hashes } = hashesDeComun(escribir);
  const revisar = archivos.filter(f => /\.(css|js|webmanifest)$/.test(f)).map(f => path.join(COMUN, f))
    .concat(PAGINAS.map(p => path.join(REPO, p)), extra.map(p => path.resolve(p)));
  let malos = 0;
  for (const f of revisar) {
    let t = fs.readFileSync(f, 'utf8');
    if (escribir) { const n = versionar(t, hashes); if (n !== t) { fs.writeFileSync(f, n); t = n; console.log('  versionado ' + path.relative(process.cwd(), f)); } }
    for (const p of problemas(t, hashes)) { malos++; console.log('  ✗ ' + path.relative(process.cwd(), f) + ': ' + p); }
  }
  console.log(malos ? malos + ' referencia(s) a comun/ sin la versión correcta' : '✓ todas las referencias a comun/ llevan la versión de hoy');
  return malos === 0;
}

module.exports = { versionar, problemas, REF };
if (require.main === module) process.exit(correr(process.argv.slice(2)) ? 0 : 1);
