<?php
/* Mensajes a familias · EL CORREO DEL SERVIDOR (5-nov-2026).
 *
 * Lo usa solo mensajes/api.php (require_once). NO es un puente: no se abre
 * desde el navegador. El .htaccess solo deja ejecutar api.php, csv.php y
 * config.php dentro de una carpeta (regla 3b); cualquier otro .php pasa por
 * gate.php, que no entrega .php (404). Y si alguien lo llamara directo, la
 * primera línea de abajo corta sin hacer nada.
 *
 * Tres piezas, sin librerías de fuera:
 *   1. msj_armar()      el correo: From «Vida en Arte <buzón>», un solo
 *                       destinatario en «Para», Reply-To al buzón, HTML simple
 *                       con la firma y el logo abajo (5-nov) + versión de solo texto. Sin
 *                       píxeles de seguimiento.
 *   2. smtp_*()         un cliente SMTP mínimo: SSL directo (puerto 465),
 *                       AUTH PLAIN o LOGIN, un correo por destinatario.
 *   3. msj_estado_*()   lo que ya salió de cada envío y los correos de la
 *                       última hora, en archivos FUERA de la carpeta pública
 *                       (junto a portal_config.php). De cada familia solo se
 *                       guarda su huella (HMAC del correo), nunca el correo.
 *
 * Contrato y reglas en docs/ACCIONES_API.md › Mensajes y REGLAS_NEGOCIO.md
 * R173–R182.
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }

const MSJ_FORMATO = '/^[^\s@,;<>()"\']+@[^\s@,;<>()"\']+\.[a-z]{2,}$/i';   // el mismo de comun/mensajes.js
const SMTP_ESPERA_S = 30;          // segundos que se espera cada respuesta del servidor de correo
const MSJ_VENTANA_S = 3600;        // «por hora»
const MSJ_GUARDAR_DIAS = 30;       // los archivos de envíos más viejos se borran

/* ─── 1 · El correo ───────────────────────────────────────────────────── */

/** Un correo razonable (algo@algo.dominio), ya sin espacios ni mayúsculas. */
function msj_correo_valido(string $c): bool { return (bool) preg_match(MSJ_FORMATO, $c); }
function msj_limpiar_correo($c): string { return strtolower(preg_replace('/\s+/', '', (string) $c)); }

/** Un encabezado con tildes, en UTF-8 (RFC 2047). Sin saltos de línea: nadie mete otro encabezado. */
function msj_encabezado(string $s): string {
    $s = trim(preg_replace('/[\r\n\t]+/', ' ', $s));
    if (!preg_match('/[^\x20-\x7E]/', $s)) return $s;
    return mb_encode_mimeheader($s, 'UTF-8', 'B', "\r\n");
}

/** El texto del mensaje en HTML: párrafos por línea en blanco, <br> por salto, enlaces para las direcciones web. */
function msj_html_cuerpo(string $texto): string {
    $texto = str_replace("\r\n", "\n", $texto);
    $parrafos = preg_split('/\n\s*\n/', trim($texto));
    $out = '';
    foreach ($parrafos as $p) {
        $h = htmlspecialchars($p, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $h = preg_replace('#\bhttps?://[^\s<>"\']+[^\s<>"\'.,;:!?)]#u', '<a href="$0" style="color:#1A5C3A;">$0</a>', $h);
        $out .= '<p style="margin:0 0 16px;">' . nl2br($h, false) . '</p>';
    }
    return $out;
}

/** 5-nov (ajuste): un aviso personal, no un boletín. Sin fondos de color ni recuadros: el texto, debajo la
 *  línea de firma («Config mensajes» › «Firma») y debajo el logo, pequeño y a la izquierda, como firma. */
const MSJ_LOGO_ANCHO = 140;   // px del logo en la firma (el archivo es de 581 × 120)

function msj_html(string $asunto, string $cuerpo, string $logo, string $nombre, string $firma = ''): string {
    $a = htmlspecialchars($asunto, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $n = htmlspecialchars($nombre, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $f = $firma !== '' ? '<p style="margin:24px 0 10px;">' . nl2br(htmlspecialchars($firma, ENT_QUOTES | ENT_HTML5, 'UTF-8'), false) . '</p>' : '';
    $img = $logo !== '' ? '<img src="' . htmlspecialchars($logo, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '" width="' . MSJ_LOGO_ANCHO . '" alt="' . $n .
        '" style="display:block;width:' . MSJ_LOGO_ANCHO . 'px;max-width:50%;height:auto;border:0;margin:' . ($f === '' ? '24px' : '0') . ' 0 0;">' : '';
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' .
        '<title>' . $a . '</title></head><body style="margin:0;padding:0;">' .
        '<div style="max-width:600px;padding:16px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#222222;">' .
        msj_html_cuerpo($cuerpo) . $f . $img .
        '</div></body></html>';
}

/**
 * El correo entero, listo para DATA (líneas con CRLF, sin el punto final).
 * $p: de (correo), nombre, para (correo), asunto, cuerpo, logo (URL), dominio, firma (5-nov), fecha (opcional, para las pruebas).
 */
function msj_armar(array $p): string {
    $limite = 'vea-' . bin2hex(random_bytes(12));
    $b64 = fn($s) => rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
    $texto = str_replace(["\r\n", "\r"], "\n", (string) $p['cuerpo']);
    $firma = trim(str_replace(["\r\n", "\r"], "\n", (string) ($p['firma'] ?? '')));
    $h = [
        'Date: ' . ($p['fecha'] ?? date('r')),
        'From: ' . msj_encabezado((string) $p['nombre']) . ' <' . $p['de'] . '>',
        'To: <' . $p['para'] . '>',
        'Reply-To: <' . $p['de'] . '>',
        'Subject: ' . msj_encabezado((string) $p['asunto']),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $p['dominio'] . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $limite . '"',
    ];
    $partes = [
        '--' . $limite,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        $b64(str_replace("\n", "\r\n", rtrim($texto) . ($firma !== '' ? "\n\n" . $firma : ''))),
        '--' . $limite,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        $b64(msj_html((string) $p['asunto'], $texto, (string) ($p['logo'] ?? ''), (string) $p['nombre'], $firma)),
        '--' . $limite . '--',
    ];
    return implode("\r\n", $h) . "\r\n\r\n" . implode("\r\n", $partes);
}

/* ─── 2 · SMTP ────────────────────────────────────────────────────────── */

/** Una respuesta del servidor (varias líneas «250-…» y la última «250 …»): [código, texto]. Código 0 = se cortó. */
function smtp_leer($s): array {
    $texto = '';
    while (true) {
        $l = fgets($s, 2048);
        if ($l === false) return [0, trim($texto) !== '' ? trim($texto) : 'se cortó la conexión'];
        $texto .= $l;
        if (strlen($l) < 4 || $l[3] !== '-') break;
    }
    return [(int) substr($texto, 0, 3), trim($texto)];
}

/** Manda una orden y lee la respuesta. */
function smtp_orden($s, string $orden): array {
    if (@fwrite($s, $orden . "\r\n") === false) return [0, 'se cortó la conexión'];
    return smtp_leer($s);
}

/** Lo que se puede guardar o mostrar de una respuesta: sin correos, corto. */
function smtp_resumen(string $t): string {
    return mb_substr(preg_replace('/[^\s<>@]+@[^\s<>@]+/', '[correo]', preg_replace('/\s+/', ' ', $t)), 0, 240);
}

/**
 * Abre la conexión y entra al buzón. $c: host, puerto, seguridad ('ssl' o, SOLO
 * contra 127.0.0.1 / localhost, 'ninguna' para las pruebas), usuario, clave,
 * ehlo. Devuelve ['s' => conexión] o ['error' => texto para la pantalla].
 */
function smtp_abrir(array $c): array {
    $host = (string) $c['host'];
    $seg = (string) ($c['seguridad'] ?? 'ssl');
    $local = in_array($host, ['127.0.0.1', 'localhost'], true);
    if ($seg !== 'ssl' && !($seg === 'ninguna' && $local)) return ['error' => 'La conexión con el correo tiene que ir cifrada (SSL).'];
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host, 'SNI_enabled' => true]]);
    $dir = ($seg === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . (int) $c['puerto'];
    $s = @stream_socket_client($dir, $errno, $errstr, SMTP_ESPERA_S, STREAM_CLIENT_CONNECT, $ctx);
    if (!$s) return ['error' => 'No se pudo conectar con el servidor de correo (' . smtp_resumen($errstr ?: 'sin respuesta') . ').'];
    stream_set_timeout($s, SMTP_ESPERA_S);
    [$k, $t] = smtp_leer($s);
    if ($k !== 220) { fclose($s); return ['error' => 'El servidor de correo no saludó: ' . smtp_resumen($t)]; }
    [$k, $t] = smtp_orden($s, 'EHLO ' . $c['ehlo']);
    if ($k !== 250) { fclose($s); return ['error' => 'El servidor de correo no aceptó el saludo: ' . smtp_resumen($t)]; }
    $u = (string) $c['usuario']; $cl = (string) $c['clave'];
    if (preg_match('/AUTH[ =][^\r\n]*PLAIN/i', $t)) {
        [$k, $t2] = smtp_orden($s, 'AUTH PLAIN ' . base64_encode("\0" . $u . "\0" . $cl));
    } else {
        [$k, $t2] = smtp_orden($s, 'AUTH LOGIN');
        if ($k === 334) [$k, $t2] = smtp_orden($s, base64_encode($u));
        if ($k === 334) [$k, $t2] = smtp_orden($s, base64_encode($cl));
    }
    if ($k !== 235) { @smtp_orden($s, 'QUIT'); fclose($s); return ['error' => 'El buzón no aceptó el usuario o la contraseña (' . smtp_resumen($t2) . '). Revisa smtp_usuario y smtp_clave en portal_config.php.']; }
    return ['s' => $s];
}

function smtp_cerrar($s): void { if (is_resource($s)) { @fwrite($s, "QUIT\r\n"); @fclose($s); } }

/**
 * Un correo a UN destinatario. Devuelve ['estado' => …, 'detalle' => …]:
 *   'enviado'   el servidor respondió 250 al final del mensaje;
 *   'fallido'   el servidor dijo que no (nunca lo aceptó): se puede reintentar;
 *   'incierto'  se mandó el mensaje entero y la respuesta no llegó: PUDO salir.
 *               No se reintenta solo (sería el riesgo de mandarlo dos veces).
 * $antesDelPunto se llama justo antes de cerrar el mensaje (para anotar
 * «incierto» en el archivo ANTES de que el correo pueda salir).
 */
function smtp_enviar($s, string $de, string $para, string $datos, callable $antesDelPunto): array {
    [$k, $t] = smtp_orden($s, 'MAIL FROM:<' . $de . '>');
    if ($k !== 250) return ['estado' => 'fallido', 'detalle' => smtp_resumen($t), 'codigo' => $k];
    [$k, $t] = smtp_orden($s, 'RCPT TO:<' . $para . '>');
    if ($k !== 250 && $k !== 251) { @smtp_orden($s, 'RSET'); return ['estado' => 'fallido', 'detalle' => smtp_resumen($t), 'codigo' => $k]; }
    [$k, $t] = smtp_orden($s, 'DATA');
    if ($k !== 354) { @smtp_orden($s, 'RSET'); return ['estado' => 'fallido', 'detalle' => smtp_resumen($t), 'codigo' => $k]; }
    // Punto al principio de una línea → dos puntos (si no, el servidor creería que el mensaje terminó).
    $cuerpo = preg_replace('/^\./m', '..', $datos);
    $antesDelPunto();
    if (@fwrite($s, $cuerpo . "\r\n.\r\n") === false) return ['estado' => 'incierto', 'detalle' => 'se cortó la conexión al mandar el mensaje', 'codigo' => 0];
    [$k, $t] = smtp_leer($s);
    if ($k === 250) return ['estado' => 'enviado', 'detalle' => '', 'codigo' => 250];
    if ($k === 0) return ['estado' => 'incierto', 'detalle' => smtp_resumen($t), 'codigo' => 0];
    return ['estado' => 'fallido', 'detalle' => smtp_resumen($t), 'codigo' => $k];
}

/* ─── 3 · Lo que ya salió (fuera de la carpeta pública) ──────────────── */

/** La carpeta de los archivos de envíos: junto a portal_config.php (o la que diga 'msj_carpeta'). */
function msj_carpeta(array $cfg): string {
    $d = (string) ($cfg['msj_carpeta'] ?? '') ?: dirname(__DIR__, 2) . '/portal_mensajes';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

/** La huella de un correo: no se puede volver al correo sin la clave del servidor. */
function msj_huella(string $correo, string $secreto): string {
    return substr(hash_hmac('sha256', msj_limpiar_correo($correo), 'vea-mensajes|' . $secreto), 0, 32);
}

/** El candado de los envíos (uno a la vez en todo el portal). null si otro envío lo tiene; false si no se pudo abrir la carpeta. */
function msj_candado(string $carpeta) {
    if (!is_dir($carpeta)) @mkdir($carpeta, 0700, true);
    $f = @fopen($carpeta . '/candado', 'c');
    if (!$f) return false;
    if (!flock($f, LOCK_EX | LOCK_NB)) { fclose($f); return null; }
    return $f;
}
function msj_soltar($f): void { if (is_resource($f)) { flock($f, LOCK_UN); fclose($f); } }

function msj_leer_json(string $ruta): array {
    if (!is_file($ruta)) return [];
    $j = json_decode((string) @file_get_contents($ruta), true);
    return is_array($j) ? $j : [];
}
/** Escribe entero o nada (archivo temporal y cambio de nombre). */
function msj_escribir_json(string $ruta, array $datos): bool {
    $tmp = $ruta . '.tmp' . getmypid();
    if (@file_put_contents($tmp, json_encode($datos, JSON_UNESCAPED_UNICODE)) === false) return false;
    @chmod($tmp, 0600);
    return @rename($tmp, $ruta);
}

function msj_ruta_envio(string $carpeta, string $id): string { return $carpeta . '/envio-' . $id . '.json'; }

/** Los correos que salieron (o pudieron salir) en la última hora: lista de marcas de tiempo, ya sin las viejas. */
function msj_hora(string $carpeta, int $ahora): array {
    $t = msj_leer_json($carpeta . '/hora.json');
    return array_values(array_filter(array_map('intval', (array) ($t['envios'] ?? [])), fn($x) => $x > $ahora - MSJ_VENTANA_S));
}
function msj_hora_guardar(string $carpeta, array $marcas): void { msj_escribir_json($carpeta . '/hora.json', ['envios' => array_values($marcas)]); }

/**
 * ¿Caben $n correos más esta hora? Devuelve ['cabe' => bool, 'usados', 'max', 'libreA' => marca de tiempo
 * desde la que caben (0 si ya caben)].
 */
function msj_cupo(array $marcas, int $max, int $n, int $ahora): array {
    sort($marcas);
    $usados = count($marcas);
    if ($usados + $n <= $max) return ['cabe' => true, 'usados' => $usados, 'max' => $max, 'libreA' => 0];
    if ($n > $max) return ['cabe' => false, 'usados' => $usados, 'max' => $max, 'libreA' => -1];
    $deben = $usados + $n - $max;              // cuántos de los más viejos tienen que salir de la ventana
    return ['cabe' => false, 'usados' => $usados, 'max' => $max, 'libreA' => $marcas[$deben - 1] + MSJ_VENTANA_S + 1];
}

/** Borra los archivos de envíos de hace más de MSJ_GUARDAR_DIAS. */
function msj_limpiar_viejos(string $carpeta, int $ahora): void {
    foreach ((array) glob($carpeta . '/envio-*.json') as $f) if (@filemtime($f) < $ahora - MSJ_GUARDAR_DIAS * 86400) @unlink($f);
}
