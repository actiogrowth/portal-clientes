<?php
require __DIR__ . '/auth.php';
$_SESSION = [];
$p = session_get_cookie_params();
setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
session_destroy();
header('Location: /login.php?salida=1');
exit;
