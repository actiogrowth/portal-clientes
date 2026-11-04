/* Mensajes a familias · el envío por el servidor (5-nov-2026).
 *
 *   PHP=php node pruebas-portal/prueba-mensajes-smtp.js
 *
 * Corre las funciones de mensajes/api.php y mensajes/correo.php de verdad
 * (PHP), contra un servidor de correo DE MENTIRA (smtp-de-mentira.js): no sale
 * ningún correo real. Datos inventados. Comprueba:
 *   · el correo: From «Vida en Arte <buzón>», Reply-To, la familia sola en
 *     «Para» (sin Cc ni Bcc), asunto con tildes, HTML con el logo arriba y el
 *     texto, versión de solo texto, ninguna otra imagen (sin píxeles);
 *   · un correo por familia y por tanda; repetir la tanda no reenvía;
 *   · el máximo por hora: la tanda que lo pasaría no sale y dice desde cuándo;
 *   · corte a mitad (rechazo del hosting): se detiene, dice qué salió y qué no,
 *     y el reintento manda solo lo que falta, sin duplicados;
 *   · respuesta perdida tras el mensaje: queda «incierto» y NO se reenvía;
 *   · el archivo del envío vive fuera de la carpeta pública y no tiene correos;
 *   · un envío a la vez (candado); usuario o clave malos; sin SSL solo en local;
 *   · la clasificación de correos (huella, exclusión, inválidos) y que la
 *     configuración no saca correos al navegador.
 * Al final rompe mensajes/api.php y correo.php de varias formas y exige que
 * esta prueba falle con cada rotura.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const { smtpDeMentira, decodificar } = require('./smtp-de-mentira');

const PHP = process.env.PHP || 'php';
const REPO = path.join(__dirname, '..');
const FUENTE = process.env.MENSAJES_FUENTE || REPO;   // las roturas pasan otra carpeta
const callado = !!process.env.MENSAJES_FUENTE;
let total = 0, fallos = 0;
const ok = (c, que, extra) => {
  total++;
  if (!c) { fallos++; console.log('  ✗ ' + que + (extra ? '\n      ' + String(extra).slice(0, 600) : '')); if (process.env.GITHUB_ACTIONS && !callado) console.log('::error title=Mensajes SMTP::' + que); }
  else if (!callado) console.log('  ✓ ' + que);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msj-smtp-'));
const web = path.join(tmp, 'portal');                      // la carpeta pública
for (const c of ['mensajes', 'after-school']) { fs.mkdirSync(path.join(web, c), { recursive: true }); for (const f of fs.readdirSync(path.join(FUENTE, c))) if (f.endsWith('.php')) fs.copyFileSync(path.join(FUENTE, c, f), path.join(web, c, f)); }
const carpeta = path.join(tmp, 'portal_mensajes');         // fuera de la pública, como en el servidor

const DRIVER = path.join(tmp, 'driver.php');
fs.writeFileSync(DRIVER, `<?php
define('MS_SOLO_FUNCIONES', true);
require ${JSON.stringify(path.join(web, 'mensajes', 'api.php'))};
$p = json_decode(file_get_contents($argv[1]), true);
$candado = !empty($p['ocupar']) ? msj_candado($p['carpeta']) : null;
$r = [];
switch ($p['op']) {
  case 'tanda': $t = $p['t']; $t['smtp'] = ms_smtp($p['cfg'], 'portal.prueba.test'); $r = ms_enviar_tanda($t); break;
  case 'armar': $r = ['datos' => msj_armar($p['m'])]; break;
  case 'clasificar': $r = ms_clasificar($p['familias'], $p['excluidos'], 'secreto-de-prueba'); break;
  case 'config': $r = ms_config_filas($p['filas']); break;
  case 'destino': $r = [ms_destino_prueba($p['config'], $p['usuario'], 'buzon@vea-prueba.test')]; break;
  case 'cupo': $r = msj_cupo($p['marcas'], $p['max'], $p['n'], $p['ahora']); break;
  case 'smtp': $r = ms_smtp($p['cfg'], 'x'); unset($r['clave']); break;
  case 'numero': $r = [ms_numero($p['filas'], $p['parametro'], 50, 1, 500)]; break;
}
echo json_encode($r, JSON_UNESCAPED_UNICODE);
`);
let n = 0;
function php(p) {
  const f = path.join(tmp, 'pedido-' + (n++) + '.json');
  fs.writeFileSync(f, JSON.stringify(p));
  const r = spawnSync(PHP, [DRIVER, f], { encoding: 'utf8', timeout: 60000 });
  try { return JSON.parse(r.stdout); } catch (e) { return { _error: (r.stdout + r.stderr).slice(0, 800) }; }
}

const BUZON = 'admin@vea-prueba.test';
const CLAVE_BUZON = 'clave-del-buzon-de-prueba';
const huella = (c) => require('crypto').createHmac('sha256', 'vea-mensajes|secreto-de-prueba').update(c).digest('hex').slice(0, 32);
const FAM = ['ana@familia.test', 'beto@familia.test', 'cata@familia.test', 'dani@familia.test', 'eva@familia.test'];
const DEST = {}; FAM.forEach(c => { DEST[huella(c)] = c; });
const CLAVES = Object.keys(DEST);

(async () => {
  const S = await smtpDeMentira({ usuario: BUZON, clave: CLAVE_BUZON });
  const cfg = { smtp_host: '127.0.0.1', smtp_puerto: S.puerto, smtp_seguridad: 'ninguna', smtp_usuario: BUZON, smtp_clave: CLAVE_BUZON, msj_logo: 'https://portal.prueba.test/comun/logo-vea.png' };
  const tanda = (t, extra) => php(Object.assign({ op: 'tanda', cfg, carpeta, t: Object.assign({ carpeta, id: 'envio-prueba-0001', huellaMensaje: 'h1', asunto: 'Función de fin de año', cuerpo: 'Hola, familia:\n\nLos esperamos.\nhttps://vidaenarte.test/fiesta\n\n<script>x</script>', tanda: 1, destinos: DEST, claves: CLAVES, porTanda: 50, maxHora: 100 }, t) }, extra || {}));
  const veces = c => S.correos.filter(m => m.para.includes(c)).length;
  try {
    console.log('· el correo');
    let r = tanda({});
    ok(r.estado === 'completa' && r.enviadas.length === 5 && !r.fallidas.length && r.total.enviadas === 5 && r.total.fallidas === 0, 'una tanda de 5 familias: 5 enviadas', JSON.stringify(r));
    ok(S.correos.length === 5 && FAM.every(c => veces(c) === 1), 'un correo por familia');
    ok(S.correos.every(m => m.para.length === 1), 'cada correo con UN solo destinatario (la familia)');
    const m = S.correos[0];
    ok(m && m.de === BUZON, 'el remitente del sobre es el buzón');
    ok(m && m.encabezados.from === 'Vida en Arte <' + BUZON + '>', 'From «Vida en Arte <buzón>»', m && m.encabezados.from);
    ok(m && m.encabezados['reply-to'] === '<' + BUZON + '>', 'Reply-To al buzón', m && m.encabezados['reply-to']);
    ok(m && m.encabezados.to === '<' + m.para[0] + '>', '«Para»: solo la familia', m && m.encabezados.to);
    ok(S.correos.every(x => !('cc' in x.encabezados) && !('bcc' in x.encabezados)), 'sin copia ni copia oculta');
    ok(m && m.asunto === 'Función de fin de año', 'el asunto con tildes llega bien', m && m.asunto);
    ok(m && /Hola, familia:/.test(m.texto) && /Los esperamos\./.test(m.texto), 'la versión de solo texto lleva el mensaje', m && m.texto);
    ok(m && /<img src="https:\/\/portal\.prueba\.test\/comun\/logo-vea\.png"/.test(m.html) && m.html.indexOf('<img') < m.html.indexOf('Hola, familia'), 'el HTML lleva el logo ARRIBA y el texto debajo', m && m.html.slice(0, 900));
    ok(m && (m.html.match(/<img/g) || []).length === 1, 'ninguna otra imagen (sin píxeles de seguimiento)');
    ok(m && /&lt;script&gt;/.test(m.html) && !/<script/.test(m.html), 'el texto se escapa en el HTML (no se cuela código)');
    ok(m && /<a href="https:\/\/vidaenarte\.test\/fiesta"/.test(m.html), 'las direcciones web quedan como enlace');
    ok(m && /max-width:560px/.test(m.html) && /name="viewport"/.test(m.html), 'HTML simple que se lee en celular (ancho máximo y viewport)');
    ok(m && /^Message-ID: <[0-9a-f]{32}@vea-prueba\.test>\r?$/m.test(m.datos), 'Message-ID con el dominio del buzón');
    ok(S.auths.length === 1 && S.auths[0][0] === BUZON, 'entra al buzón una vez por tanda (AUTH PLAIN)');

    console.log('· nunca dos veces en un mismo envío');
    r = tanda({});
    ok(r.estado === 'completa' && r.yaEstaban.length === 5 && !r.enviadas.length && S.correos.length === 5, 'repetir la tanda no reenvía nada (5 ya estaban)', JSON.stringify(r));
    r = tanda({ huellaMensaje: 'h2' });
    ok(r.estado === 'cambiado' && S.correos.length === 5, 'el mismo ID con otro mensaje: no envía y pide un envío nuevo', JSON.stringify(r));
    const archivo = path.join(carpeta, 'envio-envio-prueba-0001.json');
    ok(fs.existsSync(archivo) && !archivo.startsWith(web), 'lo que salió se guarda FUERA de la carpeta pública');
    const contenido = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : '';
    ok(contenido && !/@/.test(contenido) && CLAVES.every(k => contenido.includes(k)), 'como huellas: el archivo no tiene ningún correo', contenido.slice(0, 300));

    console.log('· máximo de correos por hora');
    S.correos.length = 0;
    r = tanda({ id: 'envio-prueba-0002', maxHora: 7 });
    ok(r.estado === 'limite' && r.pendientes.length === 5 && S.correos.length === 0 && r.hora.usados === 5 && r.hora.max === 7, 'con 5 ya enviados esta hora y un máximo de 7, la tanda de 5 no sale', JSON.stringify(r));
    const ahora = Date.now() / 1000;
    ok(r.hora.libreA > ahora + 3500 && r.hora.libreA < ahora + 3700, 'y dice desde cuándo se puede seguir (cuando los primeros cumplan una hora)', r.hora && r.hora.libreA);
    r = tanda({ id: 'envio-prueba-0002', maxHora: 10 });
    ok(r.estado === 'completa' && S.correos.length === 5, 'con un máximo de 10, sí sale (5 + 5)');
    let c = php({ op: 'cupo', marcas: [100, 200, 300], max: 4, n: 2, ahora: 1000 });
    ok(c.cabe === false && c.libreA === 100 + 3600 + 1, 'el cupo: 3 usados + 2 > 4 → cuando salga el más viejo', JSON.stringify(c));
    c = php({ op: 'cupo', marcas: [100, 200], max: 4, n: 2, ahora: 1000 });
    ok(c.cabe === true, 'y 2 + 2 caben');

    console.log('· corte a mitad y reintento');
    fs.rmSync(path.join(carpeta, 'hora.json'), { force: true });
    S.correos.length = 0;
    S.reglas = { rechazarDesde: 3 };
    r = tanda({ id: 'envio-prueba-0003' });
    ok(r.estado === 'detenida' && r.enviadas.length === 2 && r.fallidas.length === 1 && r.pendientes.length === 2 && S.correos.length === 2, 'el hosting rechaza el tercero: se detiene con 2 enviadas, 1 fallida y 2 sin intentar', JSON.stringify(r));
    ok(/maximo de correos por hora/.test(r.motivo) && !/@/.test(r.motivo + JSON.stringify(r.fallidas)), 'dice por qué, sin correos en el motivo', r.motivo);
    ok(r.total.enviadas === 2 && r.total.fallidas === 1, 'para el registro: 2 enviadas y 1 fallida');
    S.reglas = {};
    r = tanda({ id: 'envio-prueba-0003' });
    ok(r.estado === 'completa' && r.enviadas.length === 3 && r.yaEstaban.length === 2 && S.correos.length === 5 && FAM.every(x => veces(x) === 1), '«Reintentar» manda solo los 3 que faltaban: cada familia una sola vez', JSON.stringify(r));
    ok(r.total.enviadas === 5 && r.total.fallidas === 0, 'y el total queda en 5 enviadas, 0 fallidas');

    console.log('· respuesta perdida: «incierto», no se reenvía solo');
    S.correos.length = 0; S.intentos = 0;
    S.reglas = { cortarEn: 2 };
    r = tanda({ id: 'envio-prueba-0004' });
    ok(r.estado === 'detenida' && r.enviadas.length === 1 && r.inciertas.length === 1 && r.pendientes.length === 3, 'se corta tras mandar el segundo: 1 enviada, 1 incierta, 3 sin intentar', JSON.stringify(r));
    S.reglas = {};
    r = tanda({ id: 'envio-prueba-0004' });
    const cortada = S.cortado && S.cortado.para[0];
    ok(r.estado === 'completa' && r.enviadas.length === 3 && r.inciertas.length === 1 && cortada && veces(cortada) === 0, 'el reintento manda los 3 que faltaban y NO la incierta (pudo haber salido)', JSON.stringify(r));
    ok(r.total.fallidas === 1, 'la incierta cuenta como no confirmada (fallida) en el registro');

    console.log('· lo demás');
    S.correos.length = 0;
    const DEST2 = Object.assign({}, DEST); delete DEST2[CLAVES[0]];
    r = tanda({ id: 'envio-prueba-0005', destinos: DEST2 });
    ok(r.estado === 'completa' && r.enviadas.length === 4 && r.fallidas.length === 1 && r.fallidas[0].clave === CLAVES[0] && veces(FAM[0]) === 0, 'una huella que ya no es de una familia activa no se envía', JSON.stringify(r));
    r = tanda({ id: 'envio-prueba-0006' }, { ocupar: true });
    ok(r.estado === 'ocupado' && S.correos.length === 4, 'con otro envío en curso, no envía nada (uno a la vez)', JSON.stringify(r));
    r = php({ op: 'tanda', cfg: Object.assign({}, cfg, { smtp_clave: 'clave-equivocada-xyz' }), carpeta, t: { carpeta, id: 'envio-prueba-0007', huellaMensaje: 'h', asunto: 'a', cuerpo: 'b', tanda: 1, destinos: DEST, claves: CLAVES, porTanda: 50, maxHora: 100 } });
    ok(r.estado === 'detenida' && r.pendientes.length === 5 && /usuario o la contraseña/.test(r.motivo) && S.correos.length === 4, 'con la contraseña del buzón mal, no sale nada y lo dice', JSON.stringify(r));
    ok(!JSON.stringify(r).includes('clave-equivocada-xyz') && !JSON.stringify(r).includes(CLAVE_BUZON), 'la contraseña no aparece en la respuesta');
    r = php({ op: 'tanda', cfg: Object.assign({}, cfg, { smtp_host: 'correo.prueba.test' }), carpeta, t: { carpeta, id: 'envio-prueba-0008', huellaMensaje: 'h', asunto: 'a', cuerpo: 'b', tanda: 1, destinos: DEST, claves: CLAVES, porTanda: 50, maxHora: 100 } });
    ok(r.estado === 'detenida' && /cifrada/.test(r.motivo), 'sin SSL solo contra 127.0.0.1 (las pruebas); a otro servidor, no', JSON.stringify(r));
    S.reglas = { soloLogin: true }; S.auths.length = 0;
    r = tanda({ id: 'envio-prueba-0009', claves: CLAVES.slice(0, 1) });
    ok(r.estado === 'completa' && S.auths.length === 1, 'si el servidor solo ofrece AUTH LOGIN, entra igual', JSON.stringify(r));
    S.reglas = {};
    const sm = php({ op: 'smtp', cfg: { smtp_host: 'h', smtp_puerto: 465, smtp_usuario: 'Admin@Vea-Prueba.test ' } });
    ok(sm.listo === false && sm.faltan.join() === 'smtp_clave', 'sin smtp_clave en portal_config.php, no está listo (y dice qué falta)', JSON.stringify(sm));
    const sm2 = php({ op: 'smtp', cfg: { smtp_host: 'h', smtp_puerto: 465, smtp_usuario: 'Admin@Vea-Prueba.test', smtp_clave: 'x' } });
    ok(sm2.listo === true && sm2.nombre === 'Vida en Arte' && sm2.seguridad === 'ssl' && sm2.usuario === 'admin@vea-prueba.test', 'por defecto: SSL y «Vida en Arte»', JSON.stringify(sm2));

    console.log('· clasificación y configuración');
    const cl = php({ op: 'clasificar', excluidos: [' OFICINA@escuela.test'], familias: [
      { id: '1', correo: 'Ana@Familia.test ' }, { id: '2', correo: 'ana@familia.test' }, { id: '3', correo: '' }, { id: '4', correo: 'oficina@escuela.test' }, { id: '5', correo: 'mal@sin-punto' }] });
    ok(Array.isArray(cl) && cl[0].estadoCorreo === 'ok' && cl[0].clave === cl[1].clave && cl[0].clave === huella('ana@familia.test') && cl[0].correo === 'ana@familia.test', 'hermanos con el mismo correo (mayúsculas, espacios): la misma huella', JSON.stringify(cl));
    ok(cl[2].estadoCorreo === 'vacio' && cl[3].estadoCorreo === 'excluido' && cl[3].correo === '' && cl[3].clave === '' && cl[4].estadoCorreo === 'invalido' && cl[4].clave === '', 'vacío, excluido (sin correo ni huella) e inválido', JSON.stringify(cl));
    const co = php({ op: 'config', filas: [{ parametro: 'Destinatarios por tanda', valor: '50' }, { parametro: 'Correo excluido', valor: 'oficina@escuela.test' }, { parametro: 'Correo de prueba', valor: 'yo@vea.test' },
      { parametro: 'Cuenta de Gmail para mensajes', valor: 'x@gmail.test' }, { parametro: 'Otro', valor: 'algo@raro.test' }, { parametro: 'Máximo de correos por hora', valor: '100' }] });
    ok(JSON.stringify(co) === JSON.stringify([{ parametro: 'Destinatarios por tanda', valor: '50' }, { parametro: 'Máximo de correos por hora', valor: '100' }]), 'la configuración que va al navegador no lleva ningún correo', JSON.stringify(co));
    ok(php({ op: 'destino', config: [{ parametro: 'Correo de prueba', valor: ' Yo@VEA.test' }], usuario: 'otra@vea.test' })[0] === 'yo@vea.test', '«Enviarme una prueba»: primero el «Correo de prueba» de Config mensajes');
    ok(php({ op: 'destino', config: [], usuario: 'Direccion@vea.test' })[0] === 'direccion@vea.test', 'si no hay, el usuario de la sesión si es un correo');
    ok(php({ op: 'destino', config: [], usuario: 'direccion-uno' })[0] === 'buzon@vea-prueba.test', 'si no, el buzón que envía');
    ok(php({ op: 'numero', filas: [{ parametro: 'Máximo de correos por hora', valor: '100' }], parametro: 'Máximo de correos por hora' })[0] === 100 &&
       php({ op: 'numero', filas: [], parametro: 'Máximo de correos por hora' })[0] === 50, 'los números salen de Config mensajes (y si faltan, el valor prudente)');
    const ar = php({ op: 'armar', m: { de: BUZON, nombre: 'Vida en Arte', para: 'x@familia.test', asunto: 'Hola\r\nBcc: otro@malo.test', cuerpo: '.línea con punto', logo: '', dominio: 'vea-prueba.test' } });
    const dd = decodificar(ar.datos || '');
    ok(!('bcc' in dd.encabezados) && /^Subject: Hola Bcc: otro@malo\.test\r?$/m.test(ar.datos || ''), 'un salto de línea en el asunto no mete otro encabezado', (ar.datos || '').slice(0, 400));
  } finally {
    await S.cerrar();
  }

  if (!callado) {
    console.log('\n' + (fallos ? fallos + ' de ' + total + ' FALLAN' : 'Las ' + total + ' comprobaciones pasan') + '\n\nRoturas (cada una tiene que hacer fallar esta prueba):');
    const ROTURAS = [
      ['correo.php', 'manda a todos en copia oculta', "        'To: <' . $p['para'] . '>',", "        'To: <' . $p['para'] . '>',\r\n        'Bcc: copia@vea-prueba.test',"],
      ['correo.php', 'sin Reply-To', "        'Reply-To: <' . $p['de'] . '>',\n", ''],
      ['correo.php', 'sin la versión de solo texto', "        'Content-Type: text/plain; charset=UTF-8',", "        'Content-Type: text/x-nada; charset=UTF-8',"],
      ['correo.php', 'sin el logo', "        $img .\n", ''],
      ['correo.php', 'el texto sin escapar en el HTML', "        $h = htmlspecialchars($p, ENT_QUOTES | ENT_HTML5, 'UTF-8');", '        $h = $p;'],
      ['correo.php', 'sin SSL a cualquier servidor', "    if ($seg !== 'ssl' && !($seg === 'ninguna' && $local))", '    if (false)'],
      ['correo.php', 'el asunto deja pasar saltos de línea', "    $s = trim(preg_replace('/[\\r\\n\\t]+/', ' ', $s));", '    $s = trim($s);'],
      ['correo.php', 'el máximo por hora no se respeta', "    if ($usados + $n <= $max) return", '    if (true) return'],
      ['correo.php', 'el archivo del envío guarda el correo', "    return substr(hash_hmac('sha256', msj_limpiar_correo($correo), 'vea-mensajes|' . $secreto), 0, 32);", "    return substr(hash_hmac('sha256', msj_limpiar_correo($correo), 'vea-mensajes|' . $secreto), 0, 32) . '|' . $correo;"],
      ['correo.php', 'sin candado (dos envíos a la vez)', '    if (!flock($f, LOCK_EX | LOCK_NB)) { fclose($f); return null; }', ''],
      ['api.php', 'repetir la tanda reenvía', "            if ($e === 'enviado') $res['yaEstaban'][] = $k;", "            if ($e === 'enviado') $nuevas[] = $k;"],
      ['api.php', 'la incierta se reenvía', "            elseif ($e === 'incierto') $res['inciertas'][] = $k;", "            elseif ($e === 'incierto') $repetir[] = $k;"],
      ['api.php', 'no se detiene cuando el hosting rechaza', "                $detenida = true;\n                $res['motivo'] = 'El servidor de correo rechazó", "                $res['motivo'] = 'El servidor de correo rechazó"],
      ['api.php', 'envía a una huella que ya no es de una familia activa', "            if (isset($t['destinos'][$k])) return true;", "            if (true) return true;"],
      ['api.php', 'otro mensaje con el mismo ID sigue enviando', "        if ($id !== '' && ($E['huellaMensaje'] ?? '') !== $t['huellaMensaje'])", "        if (false)"],
      ['api.php', 'la configuración saca la lista de exclusión', "        if (in_array(ms_norm($f['parametro']), $privados, true) || str_contains((string) ($f['valor'] ?? ''), '@')) continue;", ''],
      ['api.php', 'un correo excluido recibe', "(in_array($c, $ex, true) ? 'excluido' :", '(false ? \'excluido\' :'],
      ['api.php', 'no se anota lo que salió', "            if ($r['estado'] === 'enviado') { $E['destinos'][$k] = ['e' => 'enviado', 't' => time()]; $res['enviadas'][] = $k; }", "            if ($r['estado'] === 'enviado') { $res['enviadas'][] = $k; }"]
    ];
    let sinDetectar = 0;
    for (const [arch, nombre, de, a] of ROTURAS) {
      const fuente = fs.mkdtempSync(path.join(os.tmpdir(), 'msj-rotura-'));
      for (const c of ['mensajes', 'after-school']) { fs.mkdirSync(path.join(fuente, c), { recursive: true }); for (const f of fs.readdirSync(path.join(REPO, c))) fs.copyFileSync(path.join(REPO, c, f), path.join(fuente, c, f)); }
      const ruta = path.join(fuente, 'mensajes', arch);
      const orig = fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
      if (orig.split(de).length !== 2) { sinDetectar++; console.log('  ? ' + nombre + ': el texto a romper no aparece una sola vez en ' + arch); if (process.env.GITHUB_ACTIONS) console.log('::error title=Rotura sin texto::' + nombre); continue; }
      fs.writeFileSync(ruta, orig.replace(de, a));
      let paso = true;
      try { execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { MENSAJES_FUENTE: fuente }), stdio: 'pipe', timeout: 300000 }); } catch (e) { paso = false; }
      fs.rmSync(fuente, { recursive: true, force: true });
      if (paso) { sinDetectar++; console.log('  ✗ NO DETECTADA: ' + nombre); if (process.env.GITHUB_ACTIONS) console.log('::error title=Rotura no detectada::' + nombre); }
      else console.log('  ✓ ' + nombre);
    }
    console.log(sinDetectar ? '\n' + sinDetectar + ' roturas sin detectar' : '\nLas ' + ROTURAS.length + ' roturas se detectan');
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(fallos || sinDetectar ? 1 : 0);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fallos ? 1 : 0);
})();
