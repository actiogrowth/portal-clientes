<?php
/* Pruebas del transporte de after-school/api.php: los casos del error_log de
 * producción (14 y 15-oct) contra un Google simulado.
 *
 *   PHP=ruta/a/php node after-school-script/pruebas/correr-prueba-transporte.js
 *
 * Corren en GitHub Actions (.github/workflows/pruebas-after-school.yml), no en
 * el equipo de desarrollo: allí el antivirus retiene este archivo.
 *
 * (Se corre a través de ese script, que levanta un servidor local de eco en
 * Node para la parte de curl de verdad.)
 *
 * Carga api.php con AS_SOLO_FUNCIONES: solo las funciones, sin sesión ni
 * portal_config.php. pedir() se reemplaza por una función que contesta según
 * un guion y anota cada llamada; así se puede contar cuántos POST salieron.
 * Al final, pedir() DE VERDAD (curl) contra el servidor local de eco.
 *
 * Sale con 1 si falla cualquier comprobación. Primer argumento: otra copia de
 * api.php a probar (la usa roturas-api.js).
 */
define('AS_SOLO_FUNCIONES', true);
$api = $argv[1] ?? (__DIR__ . '/../../after-school/api.php');
ob_start();
require $api;
$salida = ob_get_clean();

$total = 0; $fallos = 0;
function ok(bool $cond, string $que): void {
    global $total, $fallos;
    $total++;
    if (!$cond) { $fallos++; echo "  ✗ $que\n"; }
}
function seccion(string $t): void { echo "· $t\n"; }

const EXEC = 'https://script.google.com/macros/s/IMPLEMENTACION/exec';
const ECHO_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=K&lib=L';
const JSON_OK = '{"ok":true,"resultado":{"x":1}}';

/* Respuestas de Google para el guion. */
function r302(string $a): array { return ['codigo' => 302, 'location' => $a, 'ip' => '142.250.0.1', 'errno' => 0, 'error' => '', 'cuerpo' => '<html>moved</html>']; }
function r200(string $c = JSON_OK): array { return ['codigo' => 200, 'location' => '', 'ip' => '142.250.0.2', 'errno' => 0, 'error' => '', 'cuerpo' => $c]; }
function r404(): array { return ['codigo' => 404, 'location' => '', 'ip' => '142.250.0.2', 'errno' => 0, 'error' => '', 'cuerpo' => 'Not Found']; }
function rSinConexion(): array { return ['codigo' => 0, 'location' => '', 'ip' => '', 'errno' => 7, 'error' => 'Failed to connect', 'cuerpo' => false]; }

/**
 * Corre llamar_apps_script() con un guion: lista de respuestas que se van
 * entregando en orden, una por llamada a pedir(). Devuelve lo que pasó.
 */
function correr(string $accion, array $guion, array $relojes = [], bool $conId = false): array {
    $llamadas = []; $pausas = []; $log = []; $i = 0; $t = 0;
    $pedir = function (string $url, ?string $cuerpo) use (&$llamadas, &$i, $guion) {
        $llamadas[] = [$cuerpo === null ? 'GET' : 'POST', $url];
        if (!isset($guion[$i])) throw new Exception('el guion se acabó en la llamada ' . ($i + 1) . ' (' . $url . ')');
        return $guion[$i++];
    };
    $dormir = function ($s) use (&$pausas) { $pausas[] = $s; };
    $registrar = function ($l) use (&$log) { $log[] = $l; };
    $reloj = function () use (&$t, $relojes) { $v = $relojes[$t] ?? ($relojes ? $relojes[count($relojes) - 1] : 0); $t++; return $v; };
    $res = llamar_apps_script($accion, EXEC, '{"key":"x"}', $pedir, $dormir, $registrar, $reloj, $conId);
    $posts = count(array_filter($llamadas, fn($c) => $c[0] === 'POST'));
    $getsAExec = count(array_filter($llamadas, fn($c) => $c[0] === 'GET' && strpos($c[1], 'script.google.com') !== false));
    $getsFuera = count(array_filter($llamadas, fn($c) => $c[0] === 'GET' && !preg_match('#^https://[a-z0-9.-]*\.googleusercontent\.com/#', $c[1])));
    return ['res' => $res, 'json' => json_decode($res['cuerpo'], true), 'llamadas' => $llamadas, 'posts' => $posts,
            'getsAExec' => $getsAExec, 'getsFuera' => $getsFuera, 'pausas' => $pausas, 'log' => $log, 'sobrantes' => count($guion) - $i];
}

seccion('la carga');
ok($salida === '', 'con AS_SOLO_FUNCIONES, api.php no imprime nada ni pide sesión');
ok(function_exists('llamar_apps_script') && function_exists('ciclo') && function_exists('pedir'), 'define las funciones del transporte');

seccion('las acciones de lectura son las mismas que en AfterSchool.gs');
{
    $gs = file_get_contents(__DIR__ . '/../AfterSchool.gs');
    preg_match_all('/^\s+(\w+): \{ escribe: false/m', $gs, $m);
    $enGs = $m[1]; sort($enGs); $enApi = ACCIONES_LECTURA; sort($enApi);
    ok($enGs === $enApi, 'ACCIONES_LECTURA (' . implode(', ', $enApi) . ') = escribe:false del .gs (' . implode(', ', $enGs) . ')');
    preg_match_all('/^\s+(\w+): \{ escribe: true/m', $gs, $m2);
    ok(count($m2[1]) >= 10 && !array_intersect($m2[1], ACCIONES_LECTURA), 'ninguna escritura está en la lista de lecturas');
}

seccion('lectura: el echo redirige a /exec (log del 14-oct y del 15-oct 14:04)');
{
    $x = correr('leer', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200()]);
    ok($x['res']['http'] === 200 && $x['json']['ok'] === true, 'se recupera en el segundo intento');
    ok($x['posts'] === 2, 'hace un POST nuevo (2 en total)');
    ok($x['getsAExec'] === 0 && $x['getsFuera'] === 0, 'nunca pide /exec ni otro host con GET');
    ok($x['pausas'] === [1], 'espera 1 s antes de reintentar');
    ok(count($x['log']) === 2 && strpos($x['log'][0], '[leer] respuesta perdida (intento 1 de 3): POST 302 [142.250.0.1] → script.googleusercontent.com/macros/echo GET 302 [142.250.0.1] → script.google.com/macros/s/IMPLEMENTACION/exec (redirección no seguida: no es googleusercontent) · se reintenta') !== false,
       'el log registra el intento perdido, con el rastro y la IP');
    ok(isset($x['log'][1]) && strpos($x['log'][1], '[leer] respuesta recuperada en el intento 2 de 3') !== false, 'y que el reintento lo resolvió');
    ok(strpos(implode("\n", $x['log']), 'user_content_key') === false, 'el log no guarda los parámetros del echo');
}

seccion('lectura: el echo da 404 y después redirige a /exec (log del 15-oct 14:03)');
{
    $x = correr('leer', [r302(ECHO_URL), r404(), r302(EXEC), r302(ECHO_URL), r200()]);
    ok($x['res']['http'] === 200, 'se recupera');
    ok($x['posts'] === 2 && $x['getsAExec'] === 0, '2 POST, ningún GET a /exec');
    ok($x['pausas'] === [0.8, 1], 'reintenta el echo tras 0,8 s y el ciclo tras 1 s');
    ok(strpos($x['log'][0], 'GET 404 [142.250.0.2] GET 302') !== false, 'el log muestra el 404 y la redirección');
}

seccion('lectura: se pierde tres veces');
{
    $g = [r302(ECHO_URL), r302(EXEC)];
    $x = correr('listarPagos', array_merge($g, $g, $g));
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto', 'responde «incierto»');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet.', 'con el mensaje de lectura de siempre');
    ok($x['posts'] === 3 && $x['pausas'] === [1, 2], '3 POST, pausas de 1 s y 2 s');
    ok(count($x['log']) === 3 && strpos($x['log'][2], '(intento 3 de 3)') !== false && strpos($x['log'][2], 'sin recuperar') !== false, 'el log dice que no se recuperó');
}

seccion('lectura: no empieza un intento nuevo pasado el presupuesto de tiempo');
{
    $g = [r302(ECHO_URL), r302(EXEC)];
    $x = correr('leer', array_merge($g, $g, $g), [0, 30]);
    ok($x['posts'] === 1 && $x['res']['http'] === 502, 'con 30 s ya gastados no reintenta');
    ok(strpos($x['log'][0], 'sin recuperar') !== false, 'y lo registra');
    $x = correr('leer', array_merge($g, [r302(ECHO_URL), r200()]), [0, 3, 3]);
    ok($x['posts'] === 2 && $x['res']['http'] === 200, 'con 3 s gastados sí reintenta');
}

seccion('lectura: sin conexión, y después bien');
{
    $x = correr('leer', [rSinConexion(), r302(ECHO_URL), r200()]);
    ok($x['res']['http'] === 200 && $x['posts'] === 2, 'una lectura sin conexión también se reintenta');
    ok(strpos($x['log'][0], 'sin conexión (Failed to connect)') !== false, 'y queda en el log');
}

seccion('escritura: el echo redirige a /exec — NUNCA se repite el POST');
{
    $x = correr('inscribir', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1, 'un solo POST');
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto', 'responde «incierto» para que la página verifique');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet. Puede que el cambio se haya guardado.', 'con el mensaje de escritura de siempre');
    ok($x['pausas'] === [] && $x['getsAExec'] === 0, 'sin pausas de reintento y sin GET a /exec');
    ok(count($x['log']) === 1 && strpos($x['log'][0], '[inscribir] respuesta perdida (intento 1 de 1, las escrituras no se repiten)') !== false, 'el log lo registra');
    ok($x['sobrantes'] === 2, '(control) quedaron sin pedir el POST y el echo de un reintento');
}

seccion('escritura: el echo da 404 tres veces');
{
    $x = correr('registrarPago', [r302(ECHO_URL), r404(), r404(), r404(), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1 && $x['res']['http'] === 502, 'un POST, «incierto»');
    ok(count($x['llamadas']) === 4 && $x['pausas'] === [0.8, 0.8], 'reintenta solo el GET al echo (idempotente)');
}

seccion('escrituras: todas las acciones que escriben, ninguna se repite');
{
    $gs = file_get_contents(__DIR__ . '/../AfterSchool.gs');
    preg_match_all('/^\s+(\w+): \{ escribe: true/m', $gs, $m);
    $repetidas = [];
    foreach ($m[1] as $acc) {
        $x = correr($acc, [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200(), r302(ECHO_URL), r200()]);
        if ($x['posts'] !== 1) $repetidas[] = $acc;
    }
    ok(!$repetidas, 'ninguna escritura manda más de un POST' . ($repetidas ? ': ' . implode(', ', $repetidas) : ''));
    ok(in_array('agendarPrueba', $m[1], true) && in_array('inscribirVarias', $m[1], true), '(control) se recorrieron también agendarPrueba e inscribirVarias');
}

seccion('escritura: sin conexión y camino normal');
{
    $x = correr('crearNino', [rSinConexion(), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1 && $x['json']['codigo'] === 'sin_conexion', 'sin conexión: no se repite y dice sin_conexion');
    ok($x['json']['error'] === 'Sin conexión con el Sheet: Failed to connect. No se guardó nada.', 'con el mensaje de siempre');
    $x = correr('inscribir', [r302(ECHO_URL), r200('{"ok":false,"error":"La clase está llena","codigo":"llena"}')]);
    ok($x['res']['http'] === 200 && $x['json']['codigo'] === 'llena' && $x['log'] === [], 'una respuesta de negocio pasa tal cual y no deja log');
}

const JSON_REPETIDA = '{"ok":true,"repetida":true,"resultado":{"id":"INS-0001"},"estado":{}}';

seccion('escritura CON ID de solicitud: el echo redirige a /exec — se reintenta y se recupera');
{
    $x = correr('inscribir', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200(JSON_REPETIDA)], [], true);
    ok($x['res']['http'] === 200 && $x['json']['ok'] === true && $x['json']['repetida'] === true, 'se recupera en el segundo intento');
    ok($x['posts'] === 2 && $x['getsAExec'] === 0 && $x['pausas'] === [1], '2 POST, ningún GET a /exec, pausa de 1 s');
    ok(count($x['log']) === 2 && strpos($x['log'][0], '[inscribir] respuesta perdida (intento 1 de 3, escritura con ID de solicitud)') !== false && strpos($x['log'][0], '· se reintenta') !== false,
       'el log registra el intento perdido como escritura con ID');
    ok(strpos($x['log'][1], 'respuesta recuperada en el intento 2 de 3 · el script reconoció la solicitud repetida y no la volvió a ejecutar') !== false,
       'y que se recuperó, con el ID repetido reconocido por el script');
}

seccion('escritura CON ID: el echo da 404 y redirige; y sin conexión');
{
    $x = correr('registrarPago', [r302(ECHO_URL), r404(), r302(EXEC), r302(ECHO_URL), r200()], [], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 2 && $x['pausas'] === [0.8, 1], 'se recupera tras el 404');
    ok(strpos($x['log'][1], 'recuperada en el intento 2 de 3: ') !== false && strpos($x['log'][1], 'reconoció') === false,
       'si la primera nunca corrió, el reintento la ejecuta y el log no dice «repetida»');
    $x = correr('agendarPrueba', [rSinConexion(), r302(ECHO_URL), r200()], [], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 2, 'con ID, sin conexión también se reintenta');
}

seccion('escritura CON ID: se pierde tres veces');
{
    $g = [r302(ECHO_URL), r302(EXEC)];
    $x = correr('bajaTotal', array_merge($g, $g, $g), [], true);
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto' && $x['posts'] === 3 && $x['pausas'] === [1, 2], '3 POST y «incierto»');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet. Puede que el cambio se haya guardado.', 'con el mensaje de escritura');
    ok(strpos($x['log'][2], '(intento 3 de 3, escritura con ID de solicitud)') !== false && strpos($x['log'][2], 'sin recuperar') !== false, 'el log dice que no se recuperó');
}

seccion('escritura CON ID que la página reenvía: el script la reconoce al primer intento');
{
    $x = correr('resultadoPrueba', [r302(ECHO_URL), r200(JSON_REPETIDA)], [], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 1, 'un POST');
    ok(count($x['log']) === 1 && strpos($x['log'][0], 'solicitud repetida reconocida por el script') !== false, 'y queda en el log');
}

seccion('escrituras CON ID: todas se reintentan; SIN ID: ninguna');
{
    $gs = file_get_contents(__DIR__ . '/../AfterSchool.gs');
    preg_match_all('/^\s+(\w+): \{ escribe: true/m', $gs, $m);
    $malConId = []; $malSinId = [];
    foreach ($m[1] as $acc) {
        $guion = [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200(JSON_REPETIDA), r302(ECHO_URL), r200()];
        if (correr($acc, $guion, [], true)['posts'] !== 2) $malConId[] = $acc;
        if (correr($acc, $guion, [], false)['posts'] !== 1) $malSinId[] = $acc;
    }
    ok(!$malConId, 'con ID se recuperan todas al segundo POST' . ($malConId ? ': ' . implode(', ', $malConId) : ''));
    ok(!$malSinId, 'sin ID ninguna manda más de un POST' . ($malSinId ? ': ' . implode(', ', $malSinId) : ''));
}

seccion('envio_para: qué se le manda al Apps Script');
{
    $e = envio_para('CLAVE-DEL-SERVIDOR', 'recepcion', ['accion' => 'inscribir', 'datos' => ['idNino' => 'AS-0001'], 'idSolicitud' => 'a1b2c3d4-0000-4000-8000-000000000001', 'key' => 'falsa', 'usuario' => 'otro']);
    $j = json_decode($e['json'], true);
    ok($e['conId'] === true && $j['idSolicitud'] === 'a1b2c3d4-0000-4000-8000-000000000001', 'un ID válido se reenvía');
    ok($j['key'] === 'CLAVE-DEL-SERVIDOR' && $j['usuario'] === 'recepcion', 'la clave y el usuario los pone el servidor, no el navegador');
    foreach (['corto', '<script>alert(1)</script>', str_repeat('a', 65), 123, ['x']] as $malo) {
        $e = envio_para('C', 'u', ['accion' => 'inscribir', 'datos' => [], 'idSolicitud' => $malo]);
        if ($e['conId'] !== false || array_key_exists('idSolicitud', json_decode($e['json'], true))) { ok(false, 'un ID inválido no se reenvía: ' . json_encode($malo)); }
    }
    ok(true, 'un ID inválido no se reenvía (la escritura va sin ID y no se repite)');
    $e = envio_para('C', 'u', ['accion' => 'leer']);
    ok($e['conId'] === false && json_decode($e['json'], true)['datos'] === [], 'sin ID ni datos: cuerpo como antes');
}

seccion('solo se siguen redirecciones a googleusercontent');
{
    $x = correr('leer', [r302('https://evilgoogleusercontent.com/macros/echo?x=1'), r302('https://script.googleusercontent.com.evil.test/x'), r302(ECHO_URL), r200()]);
    ok($x['getsFuera'] === 0 && $x['res']['http'] === 200 && $x['posts'] === 3, 'no sigue hosts parecidos; recupera al tercer POST');
    $x = correr('leer', [r302(ECHO_URL), r200('<html>no es json</html>'), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 2 && strpos($x['log'][0], 'cuerpo no es JSON') !== false, 'un 200 que no es JSON cuenta como perdida');
}

seccion('pedir() de verdad, con curl, contra el servidor local de eco');
$puerto = (int) (getenv('AS_ECO_PUERTO') ?: 0);
if (!function_exists('curl_init')) {
    ok(false, 'falta la extensión curl en este PHP');
} elseif (!$puerto) {
    ok(false, 'falta el servidor de eco: correr con correr-prueba-transporte.js');
} else {
    $base = 'http://127.0.0.1:' . $puerto;
    $r = pedir($base . '/exec', '{"a":1}');
    ok($r['codigo'] === 302 && $r['location'] === $base . '/echo?k=1' && $r['ip'] === '127.0.0.1', 'pedir() con POST no sigue el 302 y devuelve código, Location e IP');
    $g = pedir($r['location'], null);
    ok($g['codigo'] === 200 && json_valido($g['cuerpo']), 'pedir() con GET trae el cuerpo');
    $e = pedir('http://127.0.0.1:1/exec', '{}');
    ok($e['cuerpo'] === false && $e['errno'] === 7, 'sin servidor: errno 7 (no se pudo conectar)');
}

echo "\n" . ($fallos ? "✗ $fallos de $total comprobaciones fallaron" : "✓ $total comprobaciones pasan") . "\n";
exit($fallos ? 1 : 0);
