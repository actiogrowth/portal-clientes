/* Rompe a propósito cada defensa del transporte de after-school/api.php y
 * comprueba que prueba-api-transporte.php lo detecta.
 *
 *   PHP=ruta/a/php.exe node after-school-script/pruebas/roturas-api.js
 *
 * (Sin la variable PHP usa «php» del PATH.) Las copias rotas se escriben con
 * extensión .txt en la carpeta temporal: PHP las carga igual con require.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { correrPrueba } = require('./correr-prueba-transporte');

const API = path.join(__dirname, '..', '..', 'after-school', 'api.php');
const original = fs.readFileSync(API, 'utf8').replace(/\r\n/g, '\n');

const ROTURAS = [
  ['las lecturas no se reintentan', "$maximo  = $lectura ? LECTURA_INTENTOS : 1;", "$maximo  = 1;"],
  ['las escrituras se repiten', "$maximo  = $lectura ? LECTURA_INTENTOS : 1;", "$maximo  = LECTURA_INTENTOS;"],
  ['sigue cualquier redirección', "!preg_match('/(^|\\.)googleusercontent\\.com$/i', $host)", "false"],
  ['acepta hosts parecidos', "'/(^|\\.)googleusercontent\\.com$/i'", "'/googleusercontent\\.com/i'"],
  ['no registra que el reintento lo resolvió', "if ($intento > 1) $registrar(", "if (false) $registrar("],
  ['reintenta sin pausa', "        $dormir($pausa);\n", "\n"],
  ['ignora el presupuesto de tiempo', "($reloj() - $inicio) + $pausa < LECTURA_PRESUPUESTO_S", "true"],
  ['curl sigue las redirecciones solo', "CURLOPT_FOLLOWLOCATION => false,", "CURLOPT_FOLLOWLOCATION => true,"],
  ['el log guarda los parámetros del echo', "return ($p['host'] ?? '?') . ($p['path'] ?? '');", "return $url;"],
  ['la lectura dice «puede que se haya guardado»', "($lectura ? '' : ' Puede que el cambio se haya guardado.')", "(' Puede que el cambio se haya guardado.')"],
  ['no reintenta el GET al echo', "$repetible = $r['cuerpo'] === false || $r['codigo'] === 404 || $r['codigo'] >= 500;", "$repetible = false;"],
  ['el flujo principal corre en las pruebas', "if (!defined('AS_SOLO_FUNCIONES')) {", "if (true) {"]
];

(async () => {
  const base = await correrPrueba();
  if (base.status !== 0) { console.error('prueba-api-transporte.php no pasa sobre el api.php real: arreglar eso primero.\n' + base.salida); process.exit(2); }
  let detectadas = 0;
  for (const [nombre, de, a] of ROTURAS) {
    if (original.indexOf(de) < 0) { console.log('  ? ' + nombre + ': el texto a romper ya no existe en api.php (actualizar roturas-api.js)'); continue; }
    const tmp = path.join(os.tmpdir(), 'as-rotura-api-' + process.pid + '.txt');
    fs.writeFileSync(tmp, original.replace(de, a));
    const r = await correrPrueba(tmp);
    fs.unlinkSync(tmp);
    const detectada = r.status !== 0;
    if (detectada) detectadas++;
    console.log((detectada ? '  ✓ ' : '  ✗ NO DETECTADA: ') + nombre + (detectada ? '' : '\n' + r.salida.split('\n').slice(-3).join('\n')));
  }
  console.log('');
  console.log(detectadas + ' de ' + ROTURAS.length + ' roturas detectadas');
  process.exit(detectadas === ROTURAS.length ? 0 : 1);
})();
