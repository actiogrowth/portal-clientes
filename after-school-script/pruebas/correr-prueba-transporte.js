/* Corre prueba-api-transporte.php con un servidor local de eco para la parte que
 * usa curl de verdad.
 *
 *   PHP=ruta/a/php.exe node after-school-script/pruebas/correr-prueba-transporte.js
 *
 * El servidor de eco es de Node a propósito: la prueba PHP no escribe archivos
 * .php ni lanza procesos (el 15-oct, una versión que sí lo hacía fue retenida
 * por el antivirus del equipo de desarrollo).
 *
 *   POST /exec  → 302 a /echo?k=1      (como Apps Script)
 *   GET  /echo  → 200 {"ok":true}
 *   lo demás    → 405
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PHP = process.env.PHP || 'php';
const PRUEBA = path.join(__dirname, 'prueba-api-transporte.php');

function servidorEco() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/exec') {
        req.resume();
        req.on('end', () => { res.writeHead(302, { Location: 'http://127.0.0.1:' + s.address().port + '/echo?k=1' }); res.end('movido'); });
        return;
      }
      if (req.method === 'GET' && req.url.indexOf('/echo') === 0) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
      res.writeHead(405); res.end('metodo');
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

/* Corre la prueba PHP (con otra copia de api.php si se pasa) y devuelve { status, salida }. */
async function correrPrueba(api) {
  const s = await servidorEco();
  const args = [PRUEBA].concat(api ? [api] : []);
  const env = Object.assign({}, process.env, { AS_ECO_PUERTO: String(s.address().port) });
  return new Promise(resolve => {
    const p = spawn(PHP, args, { env });
    let salida = '';
    p.stdout.on('data', d => { salida += d; });
    p.stderr.on('data', d => { salida += d; });
    p.on('close', status => { s.close(); resolve({ status, salida }); });
    p.on('error', e => { s.close(); resolve({ status: -1, salida: String(e) }); });
  });
}

module.exports = { correrPrueba };

if (require.main === module) {
  correrPrueba().then(r => { process.stdout.write(r.salida); process.exit(r.status === 0 ? 0 : 1); });
}
