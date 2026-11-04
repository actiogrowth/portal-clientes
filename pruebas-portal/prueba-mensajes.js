/* Mensajes a familias (3-nov-2026): las cuentas de comun/mensajes.js.
 *
 *   node pruebas-portal/prueba-mensajes.js
 *
 * Datos INVENTADOS (regla del repo). Comprueba: los grupos salen de los
 * datos (unidad, disciplina, clase), la unión de varios grupos, un correo por
 * familia (mayúsculas y espacios), la lista de exclusión, los correos con
 * formato inválido, «Sin correo» con su enlace de WhatsApp, las tandas, el
 * enlace de Gmail (todo en CCO, «Para» vacío, cuenta con authuser) y que el
 * envío pasa por una sola función. Al final rompe comun/mensajes.js de varias
 * formas y exige que esta prueba falle con cada rotura.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ARCHIVO = process.env.MENSAJES_JS || path.join(__dirname, '..', 'comun', 'mensajes.js');
const M = require(ARCHIVO);

let total = 0, fallos = 0;
const callado = !!process.env.MENSAJES_JS;
const ok = (c, que, extra) => { total++; if (!c) { fallos++; console.log('  ✗ ' + que + (extra ? '\n      ' + extra : '')); } else if (!callado) console.log('  ✓ ' + que); };

const D = {
  clases: [
    { codigo: 'LUN-1630-PARKOUR', servicio: 'Parkour', dia: 'Lunes', hora: '16:30' },
    { codigo: 'MAR-1630-TELAS', servicio: 'Telas', dia: 'Martes', hora: '16:30' },
    { codigo: 'SAB-0900-PARKIDS', servicio: 'Parkids', dia: 'Sábado', hora: '09:00' },
    { codigo: 'LUN-1800-PARKOUR', servicio: 'Parkour', dia: 'Lunes', hora: '18:00' }
  ],
  familias: [
    { unidad: 'After School', id: 'AS-1', nino: 'ANA UNO', telefono: '6000-0001', correo: 'Familia.Uno@Ejemplo.test', clases: ['LUN-1630-PARKOUR', 'MAR-1630-TELAS'] },
    { unidad: 'After School', id: 'AS-2', nino: 'BETO UNO', telefono: '6000-0001', correo: ' familia.uno@ejemplo.test ', clases: ['SAB-0900-PARKIDS'] },   // hermano: mismo correo
    { unidad: 'After School', id: 'AS-3', nino: 'CATA DOS', telefono: '+1 305 555 0102', correo: 'dos@ejemplo.test', clases: ['MAR-1630-TELAS'] },
    { unidad: 'After School', id: 'AS-4', nino: 'DANI TRES', telefono: '6000-0003', correo: '', clases: ['LUN-1630-PARKOUR'] },                     // sin correo
    { unidad: 'After School', id: 'AS-5', nino: 'EVA CUATRO', telefono: '6000-0004', correo: 'OFICINA@escuela.test', clases: ['LUN-1800-PARKOUR'] }, // correo de la escuela
    { unidad: 'After School', id: 'AS-6', nino: 'FER CINCO', telefono: '', correo: 'cinco@ejemplo', clases: ['MAR-1630-TELAS'] },                  // formato inválido
    { unidad: 'After School', id: 'AS-7', nino: 'GABI SEIS', telefono: '6000-0006', correo: 'seis@ejemplo.test', clases: [] },                      // activo sin clase
    { unidad: 'Preschool', id: 'VEA-1', nino: 'Hugo Uno', telefono: '6000-0001', correo: 'familia.uno@ejemplo.test', clases: [] },                  // la misma familia en Preschool
    { unidad: 'Preschool', id: 'VEA-2', nino: 'Ines Siete', telefono: '600-0007', correo: 'siete@ejemplo.test', clases: [] },
    { unidad: 'Preschool', id: 'VEA-3', nino: 'Juan Ocho', telefono: '66000008', correo: '', clases: [] }
  ],
  config: [
    { parametro: 'Cuenta de Gmail para mensajes', valor: '' },
    { parametro: 'Destinatarios por tanda', valor: '2' },
    { parametro: 'Aviso de familias por día', valor: '450' },
    { parametro: 'Código de país para WhatsApp', valor: '507' },
    { parametro: 'Servicio fuera de Mensajes', valor: 'Baby & Me' },
    { parametro: 'Correo excluido', valor: ' oficina@ESCUELA.test' },
    { parametro: 'Correo excluido', valor: 'nadie@escuela.test' }
  ]
};
const CFG = M.config(D.config);

console.log('· configuración (pestaña «Config mensajes»)');
ok(CFG.cuenta === '' && CFG.porTanda === 2 && CFG.avisoDia === 450 && CFG.codigoPais === '507', 'cuenta, tamaño de tanda, aviso diario y código de país salen del Sheet');
ok(CFG.excluidos.join() === 'oficina@escuela.test,nadie@escuela.test', 'la lista de exclusión junta las filas, sin mayúsculas ni espacios', CFG.excluidos.join());
ok(M.config([]).porTanda === 50 && M.config([]).avisoDia === 450, 'sin configuración: tandas de 50 y aviso desde 450');
ok(M.config([{ parametro: 'Cuenta de Gmail para mensajes', valor: 'no es un correo' }]).cuenta === '', 'una cuenta que no es un correo se ignora (se abre la de la sesión)');
ok(M.config([{ parametro: 'Destinatarios por tanda', valor: '0' }]).porTanda === 50, 'una tanda de 0 no vale');

console.log('· grupos (salen de los datos)');
const G = M.grupos(D);
const ids = G.map(g => g.id);
ok(ids[0] === 'todo' && ids.includes('u:After School') && ids.includes('u:Preschool'), 'Todo Vida en Arte y una por unidad');
ok(G.filter(g => g.tipo === 'disciplina').map(g => g.nombre).join() === 'Parkids,Parkour,Telas', 'las disciplinas salen de las clases (no escritas a mano)', G.filter(g => g.tipo === 'disciplina').map(g => g.nombre).join());
ok(G.filter(g => g.tipo === 'clase').map(g => g.nombre).join('|') === 'Lunes 16:30 · Parkour|Lunes 18:00 · Parkour|Martes 16:30 · Telas|Sábado 09:00 · Parkids', 'las clases, por día y hora', G.filter(g => g.tipo === 'clase').map(g => g.nombre).join('|'));
const D2 = Object.assign({}, D, { clases: D.clases.concat([{ codigo: 'VIE-1000-CIRCO', servicio: 'Circo', dia: 'Viernes', hora: '10:00' }]) });
ok(!M.grupos(D2).some(g => g.nombre === 'Circo'), 'una disciplina o clase sin niños no aparece');
const D3 = { clases: D.clases.concat([{ codigo: 'VIE-1000-ACRO', servicio: 'Acrobacia', dia: 'Viernes', hora: '10:00' }]), familias: D.familias.concat([{ unidad: 'After School', id: 'AS-9', nino: 'X', correo: 'x@ejemplo.test', clases: ['VIE-1000-ACRO'] }]), config: D.config };
ok(M.grupos(D3).some(g => g.id === 'd:Acrobacia'), 'una disciplina nueva en los datos aparece sola');

console.log('· la lista: unión, un correo por familia, exclusión, inválidos y sin correo');
let L = M.armar(D, ['todo'], CFG);
ok(L.correos.join() === 'dos@ejemplo.test,familia.uno@ejemplo.test,seis@ejemplo.test,siete@ejemplo.test', 'Todo Vida en Arte: cuatro familias', L.correos.join());
ok(L.familias === 4 && L.ninos === 10, '4 familias de 10 niños');
ok(L.repetidos === 2, 'los dos hermanos y la familia que está en las dos unidades no se repiten (2 quitados)', String(L.repetidos));
ok(L.excluidos === 1 && L.excluidosCorreos.join() === 'oficina@escuela.test', 'el correo de la escuela nunca recibe');
ok(L.sinCorreo.map(x => x.nino).join() === 'DANI TRES,EVA CUATRO,Juan Ocho', 'Sin correo: vacíos y el de la escuela', L.sinCorreo.map(x => x.nino).join());
ok(L.sinCorreo.find(x => x.nino === 'EVA CUATRO').motivo === 'excluido' && L.sinCorreo.find(x => x.nino === 'DANI TRES').motivo === 'vacio', 'con el motivo');
ok(L.invalidos.length === 1 && L.invalidos[0].nino === 'FER CINCO' && L.invalidos[0].correo === 'cinco@ejemplo', 'el correo con formato inválido se aparta y se avisa');
ok(!L.correos.some(c => /[A-Z\s]/.test(c)), 'los correos van en minúsculas y sin espacios');
L = M.armar(D, ['d:Telas', 'u:Preschool'], CFG);
ok(L.correos.join() === 'dos@ejemplo.test,familia.uno@ejemplo.test,siete@ejemplo.test', 'Telas + Preschool: la unión', L.correos.join());
ok(L.sinCorreo.map(x => x.nino).join() === 'Juan Ocho' && L.invalidos.map(x => x.nino).join() === 'FER CINCO', 'con sus sin correo e inválidos');
L = M.armar(D, ['c:LUN-1630-PARKOUR'], CFG);
ok(L.correos.join() === 'familia.uno@ejemplo.test' && L.sinCorreo.length === 1 && L.sinCorreo[0].grupo === 'Lunes 16:30 · Parkour', 'una clase: sus familias y en «Sin correo» el grupo es la clase');
L = M.armar(D, ['c:LUN-1630-PARKOUR', 'd:Parkour'], CFG);
ok(L.familias === 1 && L.sinCorreo.length === 2, 'elegir una clase y su disciplina no cuenta dos veces');
ok(M.armar(D, [], CFG).familias === 0, 'sin grupos, nadie');
ok(M.armar(D, ['u:After School'], CFG).correos.includes('seis@ejemplo.test'), 'un niño activo sin clase está en su unidad');
ok(!M.armar(D, ['d:Parkour', 'd:Telas', 'd:Parkids'], CFG).correos.includes('seis@ejemplo.test'), 'pero en ninguna disciplina');

console.log('· cuántas familias tiene cada grupo');
const C = M.conteos(D, CFG);
ok(C['todo'] === 4 && C['u:After School'] === 3 && C['u:Preschool'] === 2 && C['d:Telas'] === 2 && C['c:LUN-1800-PARKOUR'] === 0, 'el número junto a cada grupo', JSON.stringify(C));

console.log('· WhatsApp');
ok(M.enlaceWhatsapp('6000-0001', '507') === 'https://wa.me/50760000001', 'un número local de 8 dígitos lleva el código de país');
ok(M.enlaceWhatsapp('600-0007', '507') === 'https://wa.me/5076000007', 'uno de 7, también');
ok(M.enlaceWhatsapp('+1 305 555 0102', '507') === 'https://wa.me/13055550102', 'uno con + se deja como está');
ok(M.enlaceWhatsapp('', '507') === '' && M.enlaceWhatsapp('123', '507') === '', 'sin número, sin enlace');
ok(M.armar(D, ['todo'], CFG).sinCorreo.find(x => x.nino === 'Juan Ocho').whatsapp === 'https://wa.me/50766000008', '«Sin correo» trae su enlace');

console.log('· tandas y Gmail');
L = M.armar(D, ['todo'], CFG);
const T = M.tandas(L.correos, CFG.porTanda);
ok(T.length === 2 && T[0].length === 2 && T[1].length === 2, 'tandas del tamaño de la configuración (2 + 2)');
ok(M.tandas(Array.from({ length: 120 }, (_, i) => i + '@e.test'), 50).map(t => t.length).join() === '50,50,20', 'con 50: 120 familias son 3 tandas (50, 50, 20)');
let u = new URL(M.enlaceGmail({ cuenta: '', asunto: 'Día sin clase', cuerpo: 'Hola,\nfamilia & más', cco: T[0] }));
ok(u.origin === 'https://mail.google.com' && u.searchParams.get('view') === 'cm', 'abre la redacción de Gmail web');
ok(u.searchParams.get('bcc') === T[0].join(',') && !u.searchParams.has('to'), 'todos en copia oculta y el «Para» vacío');
ok(u.searchParams.get('su') === 'Día sin clase' && u.searchParams.get('body') === 'Hola,\nfamilia & más', 'asunto y cuerpo bien escritos (tildes, saltos y &)');
ok(!u.searchParams.has('authuser'), 'sin cuenta configurada, la de la sesión');
u = new URL(M.enlaceGmail({ cuenta: 'mensajes@escuela.test', asunto: 'a', cuerpo: 'b', cco: ['x@e.test'] }));
ok(u.searchParams.get('authuser') === 'mensajes@escuela.test', 'con cuenta configurada, esa (authuser)');

console.log('· el envío, detrás de una sola función');
let abierta = '';
let r = M.enviar(T[1], { asunto: 'A', cuerpo: 'B' }, CFG, url => { abierta = url; return true; });
ok(r.canal === 'gmail' && r.abierto && abierta === r.url && new URL(abierta).searchParams.get('bcc') === T[1].join(','), 'Mensajes.enviar abre Gmail con esa tanda');
r = M.enviar(T[1], { asunto: 'A', cuerpo: 'B' }, CFG, () => false);
ok(r.abierto === false, 'si el navegador bloquea la ventana, lo dice');
r = M.enviar(T[1], { asunto: 'A', cuerpo: 'x'.repeat(9000) }, CFG, () => true);
ok(r.demasiadoLargo === true, 'avisa si el enlace es demasiado largo para Gmail');
const pagina = fs.readFileSync(path.join(__dirname, '..', 'mensajes', 'index.html'), 'utf8');
ok(!/mail\.google\.com|resend/i.test(pagina) && /Mensajes\.enviar\(/.test(pagina), 'la pantalla no arma enlaces de correo: solo llama a Mensajes.enviar');
ok(!/fetch\(|\.php/.test(pagina.replace(/<!--[\s\S]*?-->/g, '')), 'la pantalla no llama a ningún .php: pide todo a Datos');
ok(/Registrado como abierto en Gmail/.test(pagina) && /Revisa que estés en la cuenta de Vida en Arte/.test(pagina), 'la pantalla dice «Registrado como abierto en Gmail» y el aviso de la cuenta');
ok(/Tanda ' \+ \(i \+ 1\) \+ ' de ' \+ n/.test(pagina) && /Copiar correos/.test(pagina) && /Copiar mensaje/.test(pagina), '«Tanda N de M», «Copiar correos» y «Copiar mensaje»');

/* ── Roturas ─────────────────────────────────────────────────────────── */
if (!callado) {
  console.log('\n' + (fallos ? fallos + ' de ' + total + ' FALLAN' : 'Las ' + total + ' comprobaciones pasan') + '\n\nRoturas (cada una tiene que hacer fallar esta prueba):');
  const src = fs.readFileSync(ARCHIVO, 'utf8');
  const ROTURAS = [
    ['no quita repetidos', '      if (vistos.has(c)) { repetidos++; return; }', ''],
    ['distingue mayúsculas', "  const limpiarCorreo = c => String(c == null ? '' : c).replace(/\\s+/g, '').toLowerCase();", "  const limpiarCorreo = c => String(c == null ? '' : c).trim();"],
    ['no excluye', "      if (excl.has(c)) { excluidos++; exclVistos.add(c); sinCorreo.push(Object.assign(fila, { motivo: 'excluido' })); return; }", ''],
    ['deja pasar inválidos', '      if (!correoValido(c)) { invalidos.push(Object.assign(fila, { correo: String(f.correo) })); return; }', ''],
    ['la unión toma solo el primer grupo', '    elegidas.forEach(g => g.ninos.forEach(k => union.add(k)));', '    elegidas.slice(0, 1).forEach(g => g.ninos.forEach(k => union.add(k)));'],
    ['en «Para» y no en copia oculta', "'bcc=' + encodeURIComponent((cco || []).join(','))", "'to=' + encodeURIComponent((cco || []).join(','))"],
    ['tandas de tamaño fijo', "    const n = Math.max(1, parseInt(max, 10) || POR_DEFECTO.porTanda), out = [];", '    const n = 50, out = [];'],
    ['sin authuser', "    if (cuenta) p.push('authuser=' + encodeURIComponent(cuenta));", ''],
    ['WhatsApp sin código de país', "    if (!t.startsWith('+') && (d.length === 7 || d.length === 8)) d = String(codigoPais || POR_DEFECTO.codigoPais).replace(/\\D/g, '') + d;", ''],
    ['disciplinas escritas a mano', "    clases.forEach(c => { if (c.servicio && !servicios.includes(c.servicio)) servicios.push(c.servicio); });", "    ['Parkour', 'Telas', 'Parkids'].forEach(s => servicios.push(s));"]
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msj-'));
  let sin = 0;
  ROTURAS.forEach(([nombre, de, a], i) => {
    if (!src.includes(de)) { sin++; console.log('  NO SE PUDO APLICAR  ' + nombre); return; }
    const f = path.join(tmp, 'rota-' + i + '.js');
    fs.writeFileSync(f, src.replace(de, a));
    let paso = true;
    try { execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { MENSAJES_JS: f }), stdio: 'pipe' }); } catch (e) { paso = false; }
    if (paso) { sin++; console.log('  NO DETECTADA  ' + nombre); } else console.log('  detectada     ' + nombre);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(sin ? '\n' + sin + ' roturas sin detectar' : '\nLas ' + ROTURAS.length + ' roturas se detectan');
  if (fallos || sin) process.exit(1);
} else if (fallos) process.exit(1);
