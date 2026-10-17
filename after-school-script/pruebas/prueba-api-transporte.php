<?php
/* Pruebas del transporte de after-school/api.php: los casos del error_log de
 * producción (14, 15 y 16-oct) contra un Google simulado.
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
 *
 * EL RELOJ ES SIMULADO Y AVANZA: cada respuesta del guion «tarda» los segundos
 * que diga (dur), y cada pausa también cuenta. Hasta el 16-oct el reloj de
 * estas pruebas estaba congelado en 0, y por eso no vieron que un primer ciclo
 * lento dejaba sin reintentos (el tope de tiempo nunca se alcanzaba aquí).
 *
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
function contiene(string $texto, string $parte): bool { return strpos($texto, $parte) !== false; }

const EXEC = 'https://script.google.com/macros/s/IMPLEMENTACION/exec';
const ECHO_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=K&lib=L';
const JSON_OK = '{"ok":true,"resultado":{"x":1}}';
const JSON_REPETIDA = '{"ok":true,"repetida":true,"resultado":{"id":"INS-0001"},"estado":{}}';

/* Respuestas de Google para el guion. $dur = segundos que «tarda» esa respuesta. */
function r302(string $a, float $dur = 0): array { return ['codigo' => 302, 'location' => $a, 'ip' => '192.178.50.46', 'errno' => 0, 'error' => '', 'cuerpo' => '<html>moved</html>', 'dur' => $dur]; }
function r200(string $c = JSON_OK, float $dur = 0): array { return ['codigo' => 200, 'location' => '', 'ip' => '142.250.176.65', 'errno' => 0, 'error' => '', 'cuerpo' => $c, 'dur' => $dur]; }
function r404(float $dur = 0): array { return ['codigo' => 404, 'location' => '', 'ip' => '142.250.176.65', 'errno' => 0, 'error' => '', 'cuerpo' => 'Not Found', 'dur' => $dur]; }
function rSinConexion(): array { return ['codigo' => 0, 'location' => '', 'ip' => '', 'errno' => 7, 'error' => 'Failed to connect', 'cuerpo' => false, 'dur' => 0]; }

/**
 * Corre llamar_apps_script() con un guion: lista de respuestas que se van
 * entregando en orden, una por llamada a pedir(). Devuelve lo que pasó.
 */
function correr(string $accion, array $guion, bool $conId = false): array {
    $llamadas = []; $pausas = []; $log = []; $i = 0; $t = 0.0;
    $pedir = function (string $url, ?string $cuerpo) use (&$llamadas, &$i, &$t, $guion) {
        $llamadas[] = [$cuerpo === null ? 'GET' : 'POST', $url];
        if (!isset($guion[$i])) throw new Exception('el guion se acabó en la llamada ' . ($i + 1) . ' (' . $url . ')');
        $t += $guion[$i]['dur'];
        return $guion[$i++];
    };
    $dormir = function ($s) use (&$pausas, &$t) { $pausas[] = $s; $t += $s; };
    $registrar = function ($l) use (&$log) { $log[] = $l; };
    $reloj = function () use (&$t) { return $t; };
    $res = llamar_apps_script($accion, EXEC, '{"key":"x"}', $pedir, $dormir, $registrar, $reloj, $conId);
    $posts = count(array_filter($llamadas, fn($c) => $c[0] === 'POST'));
    $getsAExec = count(array_filter($llamadas, fn($c) => $c[0] === 'GET' && strpos($c[1], 'script.google.com') !== false));
    $getsFuera = count(array_filter($llamadas, fn($c) => $c[0] === 'GET' && !preg_match('#^https://[a-z0-9.-]*\.googleusercontent\.com/#', $c[1])));
    return ['res' => $res, 'json' => json_decode($res['cuerpo'], true), 'llamadas' => $llamadas, 'posts' => $posts,
            'getsAExec' => $getsAExec, 'getsFuera' => $getsFuera, 'pausas' => $pausas, 'log' => $log, 'sobrantes' => count($guion) - $i, 'tiempo' => $t];
}

/* Las dos secuencias EXACTAS del error_log del 16-oct (un ciclo cada una). */
function ciclo_echo404_y_302_a_exec(float $durPost): array { return [r302(ECHO_URL, $durPost), r404(1), r302(EXEC, 1)]; }   // 15:32:30
function ciclo_echo302_a_exec(float $durPost): array { return [r302(ECHO_URL, $durPost), r302(EXEC, 1)]; }                // 15:33:07
function ciclo_bien(float $durPost = 5): array { return [r302(ECHO_URL, $durPost), r200(JSON_OK, 1)]; }

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

/* ── REGRESIÓN DEL 16-OCT: primer ciclo lento ─────────────────────────────── */

foreach ([['leer', false, 'lectura'], ['agendarPrueba', true, 'escritura con ID']] as [$acc, $conId, $quien]) {
    seccion("16-oct, $quien: echo 404 y luego 302 a /exec, con un primer ciclo de 37 s → hace el intento 2 y el 3");
    // 34,2 s de POST + 1 s del GET 404 + 0,8 s de pausa + 1 s del GET 302 = 37 s.
    $x = correr($acc, array_merge(ciclo_echo404_y_302_a_exec(34.2), ciclo_echo404_y_302_a_exec(5), ciclo_bien(5)), $conId);
    ok($x['posts'] === 3 && $x['res']['http'] === 200, "se recupera en el intento 3 (3 POST) aunque el primero tardó 37 s");
    ok($x['getsAExec'] === 0 && $x['getsFuera'] === 0, 'nunca pide /exec ni otro host con GET');
    ok($x['pausas'] === [0.8, 1, 0.8, 2], 'pausas: 0,8 s (echo 404), 1 s, 0,8 s, 2 s');
    ok(count($x['log']) === 3, 'tres líneas en el registro: dos perdidas y la recuperación');
    $tipo = $conId ? ', escritura con ID de solicitud' : '';
    ok(contiene($x['log'][0], "respuesta perdida (intento 1 de 3$tipo, 37,0 s): POST 302 [192.178.50.46] (34,2 s) → script.googleusercontent.com/macros/echo GET 404 [142.250.176.65] (1,0 s) GET 302 [192.178.50.46] (1,0 s) → script.google.com/macros/s/IMPLEMENTACION/exec (redirección no seguida: no es googleusercontent) · se reintenta"),
       'intento 1: la secuencia del log, con la duración de cada paso y del intento, y «se reintenta»');
    ok(contiene($x['log'][1], "respuesta perdida (intento 2 de 3$tipo, ") && contiene($x['log'][1], '· se reintenta'), 'intento 2: perdido y se reintenta');
    ok(contiene($x['log'][2], 'respuesta recuperada en el intento 3 de 3 ('), 'intento 3: recuperada, con el tiempo total');

    seccion("16-oct, $quien: echo 302 a /exec, con un primer ciclo de 37 s → intento 2 recupera");
    $x = correr($acc, array_merge(ciclo_echo302_a_exec(36), ciclo_bien(5)), $conId);
    ok($x['posts'] === 2 && $x['res']['http'] === 200 && $x['pausas'] === [1], 'se recupera en el intento 2 tras una pausa de 1 s');
    ok(contiene($x['log'][0], "(intento 1 de 3$tipo, 37,0 s): POST 302 [192.178.50.46] (36,0 s) → script.googleusercontent.com/macros/echo GET 302 [192.178.50.46] (1,0 s) → script.google.com/macros/s/IMPLEMENTACION/exec") &&
       contiene($x['log'][0], '· se reintenta'), 'intento 1: la secuencia exacta del log y «se reintenta»');
    ok(contiene($x['log'][1], 'respuesta recuperada en el intento 2 de 3 (6,0 s; 44,0 s en total)'), 'intento 2: recuperada, con duración y total');
}

seccion('tope de tiempo: solo el intento 3; el motivo queda en el registro');
{
    // 1.º 40 s + 1 s de pausa + 2.º 20 s = 61 s ≥ 60 → el 3.º no empieza.
    $x = correr('leer', array_merge(ciclo_echo302_a_exec(39), ciclo_echo302_a_exec(19), ciclo_bien()));
    ok($x['posts'] === 2 && $x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto', 'con 61 s gastados no hace el intento 3');
    ok(contiene($x['log'][1], '(intento 2 de 3, 20,0 s)') && contiene($x['log'][1], '· no se reintenta: tope de tiempo alcanzado tras 61,0 s (el intento 3 no empieza pasados 60 s)'),
       'el registro dice el motivo concreto: tope de tiempo y cuánto se llevaba');
    // 1.º 40 s + 1 + 2.º 10 s = 51 s + 2 s de pausa < 60 → sí hace el 3.º.
    $x = correr('leer', array_merge(ciclo_echo302_a_exec(39), ciclo_echo302_a_exec(9), ciclo_bien()));
    ok($x['posts'] === 3 && $x['res']['http'] === 200, 'con 51 s gastados sí hace el intento 3');
    // Aunque el POST llegue al máximo de curl (40 s) y se corte, el intento 2 se hace.
    $cortado = ['codigo' => 0, 'location' => '', 'ip' => '192.178.50.46', 'errno' => 28, 'error' => 'Operation timed out after 40001 milliseconds', 'cuerpo' => false, 'dur' => 40];
    $x = correr('agendarPrueba', array_merge([$cortado], [r302(ECHO_URL), r200(JSON_REPETIDA)]), true);
    ok($x['posts'] === 2 && $x['res']['http'] === 200, 'un POST cortado a los 40 s cuenta como perdido (no «sin conexión») y se reintenta');
    ok(contiene($x['log'][0], 'POST sin respuesta (curl 28: Operation timed out after 40001 milliseconds) (40,0 s)'), 'el registro dice que curl cortó y a los cuántos segundos');
    // Un echo colgado: tres GET cortados a los 10 s y un ciclo nuevo.
    $colgado = ['codigo' => 0, 'location' => '', 'ip' => '142.250.176.65', 'errno' => 28, 'error' => 'timeout', 'cuerpo' => false, 'dur' => 10];
    $x = correr('leer', [r302(ECHO_URL, 5), $colgado, $colgado, $colgado, r302(ECHO_URL, 5), r200(JSON_OK, 1)]);
    ok($x['posts'] === 2 && $x['res']['http'] === 200 && $x['pausas'] === [0.8, 0.8, 1], 'un echo colgado: 3 GET, ciclo nuevo y se recupera');
    ok(contiene($x['log'][0], 'GET sin respuesta (curl 28) [142.250.176.65] (10,0 s)') && contiene($x['log'][0], '36,6 s)'), 'el registro muestra cada GET cortado a los 10 s');
}

seccion('esperas de curl por paso (17-oct)');
{
    $p = opciones_curl(true); $g = opciones_curl(false);
    ok($p[CURLOPT_CONNECTTIMEOUT] === 5 && $p[CURLOPT_TIMEOUT] === 40, 'POST a /exec: 5 s para conectar, 40 s en total');
    ok($g[CURLOPT_CONNECTTIMEOUT] === 5 && $g[CURLOPT_TIMEOUT] === 10, 'GET al echo: 5 s para conectar, 10 s en total');
    ok($p[CURLOPT_FOLLOWLOCATION] === false && $g[CURLOPT_FOLLOWLOCATION] === false, 'ninguno sigue redirecciones solo');
    // Peor caso de una llamada: dos ciclos completos al máximo + 1 s (el 3.º no empieza pasados 60 s).
    $ciclo = POST_TOTAL_S + 3 * ECHO_TOTAL_S + 2 * 0.8;
    ok(2 * $ciclo + LECTURA_PAUSAS_S[0] < 150 && 2 * $ciclo > TOPE_TERCER_INTENTO_S, 'peor caso ≈ ' . (2 * $ciclo + LECTURA_PAUSAS_S[0]) . ' s (< 150 s)');
    // Y simulado: todo al máximo.
    $postMax = ['codigo' => 0, 'location' => '', 'ip' => '', 'errno' => 28, 'error' => 'timeout', 'cuerpo' => false, 'dur' => POST_TOTAL_S];
    $x = correr('leer', [$postMax, $postMax, $postMax]);
    ok($x['posts'] === 2 && $x['tiempo'] < 150, 'con todo al máximo: 2 intentos y ' . segundos($x['tiempo']) . ' en total');
}

/* ── Casos de antes (15-oct), con el formato de registro nuevo ──────────────── */

seccion('lectura: el echo redirige a /exec (15-oct)');
{
    $x = correr('leer', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200()]);
    ok($x['res']['http'] === 200 && $x['json']['ok'] === true, 'se recupera en el segundo intento');
    ok($x['posts'] === 2 && $x['getsAExec'] === 0 && $x['getsFuera'] === 0 && $x['pausas'] === [1], '2 POST, ningún GET a /exec, pausa de 1 s');
    ok(count($x['log']) === 2 && contiene($x['log'][0], '[leer] respuesta perdida (intento 1 de 3, 0,0 s): POST 302 [192.178.50.46] (0,0 s) → script.googleusercontent.com/macros/echo GET 302') && contiene($x['log'][0], '· se reintenta'),
       'el log registra el intento perdido, con la duración, el rastro y la IP');
    ok(isset($x['log'][1]) && contiene($x['log'][1], '[leer] respuesta recuperada en el intento 2 de 3'), 'y que el reintento lo resolvió');
    ok(!contiene(implode("\n", $x['log']), 'user_content_key'), 'el log no guarda los parámetros del echo');
}

seccion('lectura: se pierde tres veces');
{
    $g = [r302(ECHO_URL), r302(EXEC)];
    $x = correr('listarPagos', array_merge($g, $g, $g));
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto', 'responde «incierto»');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet.', 'con el mensaje de lectura de siempre');
    ok($x['posts'] === 3 && $x['pausas'] === [1, 2], '3 POST, pausas de 1 s y 2 s');
    ok(count($x['log']) === 3 && contiene($x['log'][2], '(intento 3 de 3, ') && contiene($x['log'][2], '· no se reintenta: ya se hicieron los 3 intentos'), 'el log dice por qué para');
}

seccion('lectura: sin conexión, y después bien');
{
    $x = correr('leer', [rSinConexion(), r302(ECHO_URL), r200()]);
    ok($x['res']['http'] === 200 && $x['posts'] === 2, 'una lectura sin conexión también se reintenta');
    ok(contiene($x['log'][0], 'sin conexión (Failed to connect)'), 'y queda en el log');
}

seccion('escritura SIN ID: el echo redirige a /exec — NUNCA se repite el POST');
{
    $x = correr('inscribir', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1, 'un solo POST');
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto', 'responde «incierto» para que la página verifique');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet. Puede que el cambio se haya guardado.', 'con el mensaje de escritura de siempre');
    ok($x['pausas'] === [] && $x['getsAExec'] === 0, 'sin pausas de reintento y sin GET a /exec');
    ok(count($x['log']) === 1 && contiene($x['log'][0], '[inscribir] respuesta perdida (intento 1 de 1, las escrituras no se repiten, ') &&
       contiene($x['log'][0], '· no se reintenta: escritura sin ID de solicitud: repetirla podría duplicarla'), 'el log dice el motivo: escritura sin ID');
    ok($x['sobrantes'] === 2, '(control) quedaron sin pedir el POST y el echo de un reintento');
    // Aun con un primer ciclo lento y la secuencia exacta del 16-oct.
    $x = correr('inscribir', array_merge(ciclo_echo404_y_302_a_exec(35), ciclo_bien()));
    ok($x['posts'] === 1 && $x['json']['codigo'] === 'incierto', 'con la secuencia del 16-oct tampoco se repite');
}

seccion('escritura SIN ID: el echo da 404 tres veces');
{
    $x = correr('registrarPago', [r302(ECHO_URL), r404(), r404(), r404(), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1 && $x['res']['http'] === 502, 'un POST, «incierto»');
    ok(count($x['llamadas']) === 4 && $x['pausas'] === [0.8, 0.8], 'reintenta solo el GET al echo (idempotente)');
}

seccion('escritura SIN ID: sin conexión y camino normal');
{
    $x = correr('crearNino', [rSinConexion(), r302(ECHO_URL), r200()]);
    ok($x['posts'] === 1 && $x['json']['codigo'] === 'sin_conexion', 'sin conexión: no se repite y dice sin_conexion');
    ok($x['json']['error'] === 'Sin conexión con el Sheet: Failed to connect. No se guardó nada.', 'con el mensaje de siempre');
    ok(count($x['log']) === 1 && contiene($x['log'][0], '· no se reintenta: escritura sin ID de solicitud (no llegó a salir: no se guardó nada)'), 'y el log dice el motivo');
    $x = correr('inscribir', [r302(ECHO_URL), r200('{"ok":false,"error":"La clase está llena","codigo":"llena"}')]);
    ok($x['res']['http'] === 200 && $x['json']['codigo'] === 'llena' && $x['log'] === [], 'una respuesta de negocio pasa tal cual y no deja log');
}

seccion('escritura CON ID: se recupera y el script reconoce la repetida');
{
    $x = correr('inscribir', [r302(ECHO_URL), r302(EXEC), r302(ECHO_URL), r200(JSON_REPETIDA)], true);
    ok($x['res']['http'] === 200 && $x['json']['repetida'] === true && $x['posts'] === 2, 'se recupera en el segundo intento');
    ok(contiene($x['log'][0], '[inscribir] respuesta perdida (intento 1 de 3, escritura con ID de solicitud, ') && contiene($x['log'][0], '· se reintenta'), 'el log la registra como escritura con ID');
    ok(contiene($x['log'][1], 'respuesta recuperada en el intento 2 de 3 (') && contiene($x['log'][1], '· el script reconoció la solicitud repetida y no la volvió a ejecutar'),
       'y que se recuperó, con el ID repetido reconocido por el script');
    $x = correr('registrarPago', [r302(ECHO_URL), r404(), r302(EXEC), r302(ECHO_URL), r200()], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 2 && !contiene($x['log'][1], 'reconoció'), 'si la primera nunca corrió, el reintento la ejecuta y el log no dice «repetida»');
    $x = correr('agendarPrueba', [rSinConexion(), r302(ECHO_URL), r200()], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 2, 'con ID, sin conexión también se reintenta');
    $g = [r302(ECHO_URL), r302(EXEC)];
    $x = correr('bajaTotal', array_merge($g, $g, $g), true);
    ok($x['res']['http'] === 502 && $x['json']['codigo'] === 'incierto' && $x['posts'] === 3 && $x['pausas'] === [1, 2], 'tres perdidas: 3 POST e «incierto»');
    ok($x['json']['error'] === 'No llegó la respuesta del Sheet. Puede que el cambio se haya guardado.', 'con el mensaje de escritura');
    $x = correr('resultadoPrueba', [r302(ECHO_URL), r200(JSON_REPETIDA)], true);
    ok($x['res']['http'] === 200 && $x['posts'] === 1 && count($x['log']) === 1 && contiene($x['log'][0], 'solicitud repetida reconocida por el script'), 'reenviada por la página: un POST y queda en el log');
}

seccion('escrituras CON ID: todas se reintentan; SIN ID: ninguna');
{
    $gs = file_get_contents(__DIR__ . '/../AfterSchool.gs');
    preg_match_all('/^\s+(\w+): \{ escribe: true/m', $gs, $m);
    $malConId = []; $malSinId = [];
    foreach ($m[1] as $acc) {
        $guion = array_merge(ciclo_echo302_a_exec(36), [r302(ECHO_URL), r200(JSON_REPETIDA)], ciclo_bien());
        if (correr($acc, $guion, true)['posts'] !== 2) $malConId[] = $acc;
        if (correr($acc, $guion, false)['posts'] !== 1) $malSinId[] = $acc;
    }
    ok(!$malConId, 'con ID se recuperan todas al segundo POST, aun con un primer ciclo de 37 s' . ($malConId ? ': ' . implode(', ', $malConId) : ''));
    ok(!$malSinId, 'sin ID ninguna manda más de un POST' . ($malSinId ? ': ' . implode(', ', $malSinId) : ''));
    ok(in_array('pagoPrueba', $m[1], true) && in_array('agendarPrueba', $m[1], true), '(control) se recorrieron también pagoPrueba y agendarPrueba');
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
    ok($x['posts'] === 2 && contiene($x['log'][0], 'cuerpo no es JSON'), 'un 200 que no es JSON cuenta como perdida');
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
    $t0 = microtime(true);
    $c = pedir($base . '/echo-colgado', null);
    $dura = microtime(true) - $t0;
    ok($c['cuerpo'] === false && $c['errno'] === 28 && $dura >= 9.5 && $dura < 11.5, 'pedir() corta un echo colgado a los 10 s (curl 28, ' . segundos($dura) . ')');
}

echo "\n" . ($fallos ? "✗ $fallos de $total comprobaciones fallaron" : "✓ $total comprobaciones pasan") . "\n";
exit($fallos ? 1 : 0);
