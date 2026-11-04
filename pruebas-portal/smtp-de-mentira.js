/* Un servidor de correo DE MENTIRA para las pruebas de Mensajes (5-nov-2026).
 *
 * Escucha en 127.0.0.1 (sin cifrar: el cliente de mensajes/correo.php solo lo
 * permite contra 127.0.0.1 o localhost) y habla SMTP lo justo: EHLO, AUTH
 * PLAIN / LOGIN, MAIL, RCPT, DATA, RSET, QUIT. No entrega nada a nadie: guarda
 * cada correo recibido en `correos` para que la prueba lo revise.
 *
 *   const s = await smtpDeMentira({ usuario, clave });
 *   s.puerto, s.correos [{ de, para: [..], datos, texto, html, encabezados }], s.conexiones
 *   s.reglas: { rechazarDesde: n  → desde el correo n (1, 2…) responde 451 al RCPT (límite del hosting)
 *               cortarEn: n       → en el correo n recibe el mensaje entero y corta sin responder
 *               rechazarPara: 'x@y' → ese destinatario, 550 al RCPT
 *               rechazarAuth: true }
 *   s.cerrar()
 */
const net = require('net');

function decodificar(datos) {
  const [cab, ...resto] = datos.split('\r\n\r\n');
  const encabezados = {};
  cab.replace(/\r\n[ \t]+/g, ' ').split('\r\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) encabezados[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim(); });
  const cuerpo = resto.join('\r\n\r\n');
  const m = /boundary="([^"]+)"/.exec(encabezados['content-type'] || '');
  const partes = {};
  if (m) cuerpo.split('--' + m[1]).forEach(p => {
    const [c, ...r] = p.split('\r\n\r\n');
    const tipo = /content-type:\s*([^;\r\n]+)/i.exec(c);
    if (tipo && /base64/i.test(c)) partes[tipo[1].trim()] = Buffer.from(r.join('').replace(/\s+/g, ''), 'base64').toString('utf8');
  });
  const asunto = (encabezados.subject || '').replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/gi, (x, b) => Buffer.from(b, 'base64').toString('utf8'));
  return { encabezados, asunto, texto: partes['text/plain'] || '', html: partes['text/html'] || '' };
}

function smtpDeMentira({ usuario, clave } = {}) {
  const s = { correos: [], conexiones: 0, intentos: 0, reglas: {}, auths: [] };
  const servidor = net.createServer(sock => {
    s.conexiones++;
    let buf = '', estado = 'orden', actual = null, autenticado = false, login = null;
    const resp = t => sock.write(t + '\r\n');
    resp('220 mentira.test ESMTP de prueba');
    sock.on('data', d => {
      buf += d.toString('utf8');
      while (true) {
        if (estado === 'datos') {
          const fin = buf.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          const datos = buf.slice(0, fin).replace(/^\.\./gm, '.');
          buf = buf.slice(fin + 5);
          estado = 'orden';
          s.intentos++;
          if (s.reglas.cortarEn && s.intentos === s.reglas.cortarEn) { s.cortado = Object.assign({ datos }, actual); sock.destroy(); return; }
          s.correos.push(Object.assign({ datos }, actual, decodificar(datos)));
          actual = null;
          resp('250 2.0.0 aceptado');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const l = buf.slice(0, i); buf = buf.slice(i + 2);
        const o = l.toUpperCase();
        if (login === 'usuario') { login = Buffer.from(l, 'base64').toString(); resp('334 UGFzc3dvcmQ6'); continue; }
        if (typeof login === 'string' && login !== '') { const u = login; login = null; const c = Buffer.from(l, 'base64').toString(); s.auths.push([u, c]);
          if (!s.reglas.rechazarAuth && u === usuario && c === clave) { autenticado = true; resp('235 bien'); } else resp('535 5.7.8 clave mala'); continue; }
        if (o.startsWith('EHLO') || o.startsWith('HELO')) { s.ehlo = l.slice(5); resp('250-mentira.test\r\n250-SIZE 52428800\r\n250 AUTH ' + (s.reglas.soloLogin ? 'LOGIN' : 'PLAIN LOGIN')); }
        else if (o.startsWith('AUTH PLAIN ')) { const [, u, c] = Buffer.from(l.slice(11), 'base64').toString().split('\0'); s.auths.push([u, c]);
          if (!s.reglas.rechazarAuth && u === usuario && c === clave) { autenticado = true; resp('235 bien'); } else resp('535 5.7.8 clave mala'); }
        else if (o === 'AUTH LOGIN') { login = 'usuario'; resp('334 VXNlcm5hbWU6'); }
        else if (o.startsWith('MAIL FROM:')) { if (!autenticado) resp('530 primero entra'); else { actual = { de: l.slice(10).replace(/[<>]/g, ''), para: [] }; resp('250 ok'); } }
        else if (o.startsWith('RCPT TO:')) {
          const para = l.slice(8).replace(/[<>]/g, '');
          const n = s.correos.length + 1;
          if (s.reglas.rechazarDesde && n >= s.reglas.rechazarDesde) resp('451 4.7.0 ' + para + ' supero el maximo de correos por hora');
          else if (s.reglas.rechazarPara === para) resp('550 5.1.1 <' + para + '> no existe');
          else if (!actual) resp('503 sin MAIL');
          else { actual.para.push(para); resp('250 ok'); }
        }
        else if (o === 'DATA') { if (!actual || !actual.para.length) resp('503 sin destinatario'); else { estado = 'datos'; resp('354 adelante'); } }
        else if (o === 'RSET') { actual = null; resp('250 ok'); }
        else if (o === 'QUIT') { resp('221 chao'); sock.end(); return; }
        else resp('500 no entiendo');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise(ok => servidor.listen(0, '127.0.0.1', () => {
    s.puerto = servidor.address().port;
    s.cerrar = () => new Promise(r => servidor.close(() => r()));
    ok(s);
  }));
}

module.exports = { smtpDeMentira, decodificar };
