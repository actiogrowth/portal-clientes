<?php
/* Puente entre la página de After School y su Apps Script (VEA_AfterSchool_BD).
 *
 * Mismo patrón que basededatos/api.php, con dos cerrojos más:
 *   1. Exige sesión del portal (requerir_sesion, de auth.php).
 *   2. El usuario de esa sesión tiene que estar en la lista 'as_usuarios'
 *      de portal_config.php. Si la lista falta o está vacía, no entra nadie:
 *      un permiso de Kínder no abre After School.
 *   3. La clave y el usuario los pone ESTE archivo. Lo que mande el navegador
 *      en esos campos se descarta: el navegador solo elige acción y datos.
 *
 * portal_config.php vive fuera de la carpeta pública y lleva, para esta área:
 *     'as_exec'         => 'https://script.google.com/macros/s/…/exec',
 *     'as_clave'        => 'la misma que AS_CLAVE_API en el Apps Script',
 *     'as_usuarios'     => ['usuario1', 'usuario2'],
 *     'as_campo_sesion' => 'usuario',   // opcional: la clave de $_SESSION con el usuario
 *
 * Diagnóstico: GET api.php?diagnostico=1 (con sesión) dice qué claves trae la
 * sesión —solo los NOMBRES, nunca los valores— y si encontró al usuario y si
 * está autorizado. Sirve para fijar 'as_campo_sesion' sin abrir auth.php.
 *
 * APAGADO POR DEFECTO. Solo responde si portal_config.php lleva
 *     'as_diagnostico' => true,
 * exactamente true (no "1", no "sí"). Sin esa línea, o con cualquier otro
 * valor, contesta 404 como si no existiera. Se enciende un momento para
 * ajustar as_campo_sesion y se borra la línea: olvidarla o borrarla deja el
 * sistema del lado seguro.
 *
 * PRUEBAS. Las funciones van primero y el flujo principal al final, dentro de
 * «if (!defined('AS_SOLO_FUNCIONES'))». En el servidor esa constante no existe
 * y el archivo hace exactamente lo de siempre; las pruebas
 * (after-school-script/pruebas/prueba-api-transporte.php) la definen para cargar
 * solo las funciones y simular a Google.
 */

function salir(int $codigo, array $cuerpo): void {
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}
function fallo(string $msg, int $codigo = 500, string $tipo = ''): void {
    salir($codigo, ['ok' => false, 'error' => $msg, 'codigo' => $tipo]);
}

/* El usuario de la sesión. Si portal_config.php dice qué clave usar, se usa
   solo esa. Si no, se prueban los nombres habituales, sin adivinar más allá:
   si no aparece, no se escribe nada. */
function usuario_del_portal(array $cfg): string {
    $s = $_SESSION ?? [];
    if (!empty($cfg['as_campo_sesion'])) {
        $v = $s[$cfg['as_campo_sesion']] ?? '';
        if (is_array($v)) $v = $v['usuario'] ?? $v['user'] ?? $v['username'] ?? $v['nombre'] ?? '';
        return is_string($v) ? trim($v) : '';
    }
    foreach (['usuario', 'user', 'username', 'login', 'nombre_usuario'] as $k) {
        $v = $s[$k] ?? null;
        if (is_string($v) && trim($v) !== '') return trim($v);
        if (is_array($v)) foreach (['usuario', 'user', 'username', 'login', 'nombre'] as $j)
            if (is_string($v[$j] ?? null) && trim($v[$j]) !== '') return trim($v[$j]);
    }
    return '';
}

function autorizado(string $usuario, array $cfg): bool {
    $lista = $cfg['as_usuarios'] ?? [];
    if (!is_array($lista) || !$lista || $usuario === '') return false;
    foreach ($lista as $u) if (is_string($u) && strcasecmp(trim($u), $usuario) === 0) return true;
    return false;
}

/* ── Transporte ────────────────────────────────────────────────────────────
 * Apps Script contesta un POST a /exec con un 302 hacia
 * script.googleusercontent.com/macros/echo?…, donde espera la respuesta ya
 * calculada. Ese salto se hace A MANO: con CURLOPT_FOLLOWLOCATION, un 302 que
 * apuntara otra vez a /exec terminaba en un GET a /exec (doGet), y la página
 * mostraba «solo responde a POST» aunque la escritura SÍ se había hecho
 * (14-oct, INS-0220).
 *
 * Reglas:
 *   · Solo se sigue un Location que apunte a *.googleusercontent.com, con GET.
 *     Jamás se pide /exec con GET.
 *   · El GET al echo sí se puede repetir (solo lee la respuesta guardada): si
 *     da 404 o 5xx se reintenta dos veces.
 *   · ESCRITURAS SIN ID DE SOLICITUD (página vieja): el POST a /exec se manda
 *     UNA vez y nunca se repite: no es idempotente (duplicaría inscripciones,
 *     pagos o pruebas). Si salió pero la respuesta no llega, el error lleva el
 *     código «incierto»: la página vuelve a leer y comprueba si el cambio quedó.
 *   · ESCRITURAS CON ID DE SOLICITUD (16-oct): se reintentan igual que las
 *     lecturas. Es seguro porque AfterSchool.gs, dentro del lock, reconoce el
 *     ID ya procesado y devuelve el resultado guardado sin ejecutar nada
 *     (responde «repetida»: true). El ID lo genera la página; aquí solo se
 *     reenvía si tiene un formato válido.
 *   · LECTURAS (las de ACCIONES_LECTURA, las mismas que en AfterSchool.gs
 *     tienen escribe:false): si la respuesta se pierde, se repite el ciclo
 *     COMPLETO —POST nuevo + echo— hasta 2 veces más, con pausas de 1 s y
 *     2 s. (15-oct: el echo a veces da 404 o redirige a /exec aunque el script
 *     corrió bien; un POST nuevo trae un echo nuevo.)
 *   · TIEMPO (corregido el 16-oct): el intento 2 se hace SIEMPRE, tarde lo que
 *     tarde el primero. Solo el intento 3 tiene tope: no empieza si ya pasaron
 *     TOPE_TERCER_INTENTO_S desde el principio. Antes el tope de 25 s contaba
 *     también el primer ciclo, y un primer ciclo lento (≥ 24 s) dejaba sin
 *     ningún reintento: «intento 1 de 3 … sin recuperar» del 16-oct.
 *   · «sin_conexion» es solo cuando seguro no salió (no hubo conexión).
 *   · Cada respuesta perdida deja una línea en el error_log de PHP con el
 *     intento, cuánto tardó, lo que pasó (códigos, destino sin parámetros, IP
 *     de cada salto) y, si no se reintenta, el motivo concreto.
 */
const ACCIONES_LECTURA = ['leer', 'listarPagos'];
const LECTURA_INTENTOS = 3;                 // 1 + 2 reintentos
const LECTURA_PAUSAS_S = [1, 2];            // antes del 2.º y del 3.º intento
const TOPE_TERCER_INTENTO_S = 60;           // el 3.er intento no empieza pasado esto (desde el principio)

function pedir(string $url, ?string $cuerpo): array {
    $ch = curl_init($url);
    $op = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 20,
    ];
    if ($cuerpo !== null) {
        $op[CURLOPT_POST]       = true;
        $op[CURLOPT_POSTFIELDS] = $cuerpo;
        $op[CURLOPT_HTTPHEADER] = ['Content-Type: text/plain;charset=utf-8'];
    } else {
        $op[CURLOPT_HTTPGET] = true;
    }
    curl_setopt_array($ch, $op);
    $cuerpoResp = curl_exec($ch);
    $r = [
        'codigo'   => (int) curl_getinfo($ch, CURLINFO_HTTP_CODE),
        'location' => (string) (curl_getinfo($ch, CURLINFO_REDIRECT_URL) ?: ''),
        'ip'       => (string) (curl_getinfo($ch, CURLINFO_PRIMARY_IP) ?: ''),
        'errno'    => curl_errno($ch),
        'error'    => curl_error($ch),
        'cuerpo'   => $cuerpoResp,
    ];
    curl_close($ch);
    return $r;
}

/** Destino sin parámetros, para el registro (los parámetros del echo no se guardan). */
function destino(string $url): string {
    $p = parse_url($url);
    return ($p['host'] ?? '?') . ($p['path'] ?? '');
}

function json_valido($texto): bool {
    return is_string($texto) && is_array(json_decode($texto, true));
}

/** «[ip]» para el rastro, si curl la informó. */
function ip_de(array $r): string {
    return !empty($r['ip']) ? ' [' . $r['ip'] . ']' : '';
}

/**
 * UN ciclo: POST a /exec y, si redirige, GET al echo. Devuelve
 *   ['estado' => 'ok' | 'sin_conexion' | 'perdida', 'cuerpo' => …, 'rastro' => …, 'error' => …]
 * $pedir es pedir() en producción; las pruebas la cambian por una simulada.
 */
function ciclo(string $exec, string $envio, callable $pedir, callable $dormir): array {
    $r = $pedir($exec, $envio);
    if ($r['cuerpo'] === false) {
        // 6/7/35: no se pudo resolver, conectar o negociar TLS → el POST no salió.
        if (in_array($r['errno'], [5, 6, 7, 35], true)) return ['estado' => 'sin_conexion', 'error' => $r['error'], 'rastro' => ''];
        return ['estado' => 'perdida', 'rastro' => 'POST sin respuesta (curl ' . $r['errno'] . ': ' . $r['error'] . ')'];
    }
    $rastro = 'POST ' . $r['codigo'] . ip_de($r);
    $saltos = 0;
    while (in_array($r['codigo'], [301, 302, 303, 307, 308], true)) {
        $loc  = $r['location'];
        $host = (string) parse_url($loc, PHP_URL_HOST);
        $rastro .= ' → ' . destino($loc);
        if ($loc === '' || !preg_match('/(^|\.)googleusercontent\.com$/i', $host) || ++$saltos > 3) {
            return ['estado' => 'perdida', 'rastro' => $rastro . ' (redirección no seguida: no es googleusercontent)'];
        }
        for ($intento = 1; $intento <= 3; $intento++) {
            $r = $pedir($loc, null);
            $rastro .= ' GET ' . ($r['cuerpo'] === false ? 'sin respuesta' : $r['codigo']) . ip_de($r);
            $repetible = $r['cuerpo'] === false || $r['codigo'] === 404 || $r['codigo'] >= 500;
            if (!$repetible || $intento === 3) break;
            $dormir(0.8);
        }
        if ($r['cuerpo'] === false) return ['estado' => 'perdida', 'rastro' => $rastro];
    }
    if ($r['codigo'] !== 200 || !json_valido($r['cuerpo'])) {
        return ['estado' => 'perdida', 'rastro' => $rastro . ($r['codigo'] === 200 ? ' (cuerpo no es JSON)' : '')];
    }
    return ['estado' => 'ok', 'cuerpo' => $r['cuerpo'], 'rastro' => $rastro];
}

/**
 * El cuerpo que va al Apps Script. La clave y el usuario los pone el
 * servidor; del navegador solo se toman la acción, los datos y el ID de
 * solicitud, y este último solo si tiene un formato válido (si no, la
 * escritura va sin ID y se comporta como antes: nunca se repite).
 * Devuelve ['json' => …, 'conId' => bool].
 */
const ID_SOLICITUD_VALIDO = '/^[A-Za-z0-9-]{8,64}$/';
function envio_para(string $clave, string $usuario, array $datos): array {
    $cuerpo = [
        'key'     => $clave,
        'usuario' => $usuario,
        'accion'  => $datos['accion'],
        'datos'   => is_array($datos['datos'] ?? null) ? $datos['datos'] : new stdClass(),
    ];
    $id = $datos['idSolicitud'] ?? '';
    $conId = is_string($id) && preg_match(ID_SOLICITUD_VALIDO, $id) === 1;
    if ($conId) $cuerpo['idSolicitud'] = $id;
    return ['json' => json_encode($cuerpo, JSON_UNESCAPED_UNICODE), 'conId' => $conId];
}

/** «37,2 s», para el registro. */
function segundos(float $s): string {
    return number_format($s, 1, ',', '') . ' s';
}

/**
 * La llamada entera, con la política de reintentos. Devuelve
 *   ['http' => código, 'cuerpo' => JSON a devolver al navegador].
 * $registrar escribe en el error_log; $reloj da los segundos transcurridos.
 */
function llamar_apps_script(string $accion, string $exec, string $envio, callable $pedir, callable $dormir, callable $registrar, callable $reloj, bool $conId = false): array {
    $lectura = in_array($accion, ACCIONES_LECTURA, true);
    // Se repite el ciclo en las lecturas y en las escrituras con ID de
    // solicitud (el .gs no las ejecuta dos veces). Sin ID, nunca.
    $reintentable = $lectura || $conId;
    $maximo  = $reintentable ? LECTURA_INTENTOS : 1;
    $tipo    = $lectura ? '' : ($conId ? ', escritura con ID de solicitud' : ', las escrituras no se repiten');
    $inicio  = $reloj();
    for ($intento = 1; ; $intento++) {
        $t0 = $reloj();
        $c = ciclo($exec, $envio, $pedir, $dormir);
        $dura = segundos($reloj() - $t0);
        if ($c['estado'] === 'ok') {
            $resp = json_decode($c['cuerpo'], true);
            $repetida = is_array($resp) && ($resp['repetida'] ?? false) === true;
            if ($intento > 1) {
                $registrar('after-school api.php [' . $accion . '] respuesta recuperada en el intento ' . $intento . ' de ' . $maximo .
                    ' (' . $dura . '; ' . segundos($reloj() - $inicio) . ' en total)' .
                    ($repetida ? ' · el script reconoció la solicitud repetida y no la volvió a ejecutar' : '') . ': ' . $c['rastro']);
            } elseif ($repetida) {
                $registrar('after-school api.php [' . $accion . '] solicitud repetida reconocida por el script (la página la volvió a enviar): no se ejecutó otra vez');
            }
            return ['http' => 200, 'cuerpo' => $c['cuerpo']];
        }
        $que = $c['estado'] === 'sin_conexion' ? 'sin conexión (' . $c['error'] . ')' : $c['rastro'];
        $pausa = LECTURA_PAUSAS_S[$intento - 1] ?? 0;
        $transcurrido = $reloj() - $inicio;
        // Por qué NO se sigue (vacío = se reintenta). El intento 2 no tiene
        // tope de tiempo; el 3 no empieza pasados TOPE_TERCER_INTENTO_S.
        if (!$reintentable) {
            $motivo = $c['estado'] === 'sin_conexion' ? 'escritura sin ID de solicitud (no llegó a salir: no se guardó nada)' : 'escritura sin ID de solicitud: repetirla podría duplicarla';
        } elseif ($intento >= $maximo) {
            $motivo = 'ya se hicieron los ' . $maximo . ' intentos';
        } elseif ($intento >= 2 && $transcurrido + $pausa >= TOPE_TERCER_INTENTO_S) {
            $motivo = 'tope de tiempo alcanzado tras ' . segundos($transcurrido) . ' (el intento ' . ($intento + 1) . ' no empieza pasados ' . TOPE_TERCER_INTENTO_S . ' s)';
        } else {
            $motivo = '';
        }
        $otro = $motivo === '';
        $registrar('after-school api.php [' . $accion . '] respuesta perdida (intento ' . $intento . ' de ' . $maximo .
            $tipo . ', ' . $dura . '): ' . $que . ($otro ? ' · se reintenta' : ' · no se reintenta: ' . $motivo));
        if (!$otro) {
            if ($c['estado'] === 'sin_conexion') {
                return ['http' => 502, 'cuerpo' => json_encode(['ok' => false, 'error' => 'Sin conexión con el Sheet: ' . $c['error'] . '. No se guardó nada.', 'codigo' => 'sin_conexion'], JSON_UNESCAPED_UNICODE)];
            }
            return ['http' => 502, 'cuerpo' => json_encode(['ok' => false,
                'error' => 'No llegó la respuesta del Sheet.' . ($lectura ? '' : ' Puede que el cambio se haya guardado.'), 'codigo' => 'incierto'], JSON_UNESCAPED_UNICODE)];
        }
        $dormir($pausa);
    }
}

if (!defined('AS_SOLO_FUNCIONES')) {
    require dirname(__DIR__) . '/auth.php';
    requerir_sesion();

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');

    $rutaConfig = dirname(__DIR__, 2) . '/portal_config.php';
    if (!is_file($rutaConfig)) fallo('falta portal_config.php en el servidor');
    $cfg = require $rutaConfig;
    if (!is_array($cfg) || empty($cfg['as_exec']) || empty($cfg['as_clave']))
        fallo('portal_config.php no tiene as_exec y as_clave para After School');

    if (session_status() !== PHP_SESSION_ACTIVE) @session_start();

    $usuario = usuario_del_portal($cfg);

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && isset($_GET['diagnostico'])) {
        if (($cfg['as_diagnostico'] ?? null) !== true) fallo('no encontrado', 404);
        $claves = [];
        foreach (($_SESSION ?? []) as $k => $v) {
            $claves[] = is_array($v) ? $k . ' → [' . implode(', ', array_map('strval', array_keys($v))) . ']' : (string)$k;
        }
        salir(200, ['ok' => true, 'diagnostico' => [
            'claves_de_sesion' => $claves,
            'usuario_encontrado' => $usuario !== '',
            'autorizado' => autorizado($usuario, $cfg),
            'lista_configurada' => is_array($cfg['as_usuarios'] ?? null) && count($cfg['as_usuarios']) > 0,
        ]]);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fallo('solo POST', 405);
    if ($usuario === '') fallo('No se pudo leer el usuario de la sesión del portal. Encender as_diagnostico en portal_config.php, abrir api.php?diagnostico=1, fijar as_campo_sesion y volver a apagarlo.', 403, 'sin_usuario');
    if (!autorizado($usuario, $cfg)) fallo('El usuario «' . $usuario . '» no tiene acceso a After School.', 403, 'no_autorizado');

    $datos = json_decode(file_get_contents('php://input'), true);
    if (!is_array($datos) || empty($datos['accion']) || !is_string($datos['accion'])) fallo('cuerpo ilegible', 400);

    $envio = envio_para($cfg['as_clave'], $usuario, $datos);

    $res = llamar_apps_script($datos['accion'], $cfg['as_exec'], $envio['json'], 'pedir',
        function ($s) { usleep((int) ($s * 1000000)); },
        function ($linea) { error_log($linea); },
        function () { return microtime(true); },
        $envio['conId']);
    http_response_code($res['http']);
    echo $res['cuerpo'];
}
