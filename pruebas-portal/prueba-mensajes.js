/* Mensajes a familias (3-nov-2026): las cuentas de comun/mensajes.js.
 *
 *   node pruebas-portal/prueba-mensajes.js
 *
 * Datos INVENTADOS (regla del repo). Comprueba: los grupos salen de los
 * datos (unidad, disciplina, clase), la unión de varios grupos, un correo por
 * familia (mayúsculas y espacios), la lista de exclusión, los correos con
 * formato inválido, «Sin correo» con su enlace de WhatsApp, las tandas y que
 * el envío pasa por una sola función. 5-nov: con las familias ya clasificadas
 * por el servidor (huella y estado del correo; sin correo para quien no envía)
 * salen las mismas cifras; las tandas son de huellas y nunca más grandes que el
 * máximo por hora; ya no hay Gmail. Al final rompe comun/mensajes.js de varias
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
ok(CFG.porTanda === 2 && CFG.avisoDia === 450 && CFG.codigoPais === '507', 'tamaño de tanda, aviso diario y código de país salen del Sheet');
ok(CFG.excluidos.join() === 'oficina@escuela.test,nadie@escuela.test', 'la lista de exclusión junta las filas, sin mayúsculas ni espacios', CFG.excluidos.join());
ok(M.config([]).porTanda === 50 && M.config([]).avisoDia === 450 && M.config([]).maxHora === 100, 'sin configuración: tandas de 50, aviso desde 450 y 100 correos por hora');
ok(!('cuenta' in CFG), '5-nov: ya no hay «Cuenta de Gmail para mensajes»');
ok(M.config([{ parametro: 'Máximo de correos por hora', valor: '80' }]).maxHora === 80, '5-nov: el máximo por hora sale del Sheet');
ok(M.config([{ parametro: 'Destinatarios por tanda', valor: '50' }, { parametro: 'Máximo de correos por hora', valor: '30' }]).porTanda === 30, 'una tanda nunca es más grande que el máximo por hora');
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

console.log('· tandas');
L = M.armar(D, ['todo'], CFG);
const T = M.tandas(L.destinos, CFG.porTanda);
ok(T.length === 2 && T[0].length === 2 && T[1].length === 2, 'tandas del tamaño de la configuración (2 + 2)');
ok(M.tandas(Array.from({ length: 120 }, (_, i) => i + '@e.test'), 50).map(t => t.length).join() === '50,50,20', 'con 50: 120 familias son 3 tandas (50, 50, 20)');
ok(L.claves.length === 4 && L.destinos.every(d => d.clave && d.correo), 'cada familia con su clave (lo que se manda al servidor)');

console.log('· 5-nov: las familias ya clasificadas por el servidor');
/* Como las manda mensajes/api.php › ms_clasificar: huella y estado; a quien no envía, sin el correo. */
const huella = c => 'h' + require('crypto').createHash('sha256').update(c).digest('hex').slice(0, 31);
const clasificar = (fams, conCorreo) => fams.map(f => {
  const c = M.limpiarCorreo(f.correo);
  const estado = !c ? 'vacio' : CFG.excluidos.includes(c) ? 'excluido' : M.correoValido(c) ? 'ok' : 'invalido';
  const g = Object.assign({}, f, { estadoCorreo: estado, clave: estado === 'ok' ? huella(c) : '', correo: estado === 'ok' ? c : estado === 'invalido' ? f.correo : '' });
  if (!conCorreo) delete g.correo;
  return g;
});
const DS = Object.assign({}, D, { familias: clasificar(D.familias, true), config: D.config.filter(x => x.parametro !== 'Correo excluido') });
const DC = Object.assign({}, D, { familias: clasificar(D.familias, false), config: DS.config });
const LS = M.armar(DS, ['todo'], M.config(DS.config)), LC = M.armar(DC, ['todo'], M.config(DC.config)), LV = M.armar(D, ['todo'], CFG);
ok(LS.familias === LV.familias && LS.repetidos === LV.repetidos && LS.sinCorreo.length === LV.sinCorreo.length && LS.invalidos.length === LV.invalidos.length && LS.excluidos === LV.excluidos,
  'las mismas cifras que calculando aquí (familias, repetidos, sin correo, inválidos, excluidos), sin que el navegador vea la lista de exclusión', JSON.stringify([LS.familias, LS.repetidos, LS.excluidos]));
ok(LS.correos.join() === LV.correos.join() && LS.claves.every(k => /^h/.test(k)), 'quien envía: los mismos correos (para «Copiar correos») y las tandas son de huellas');
ok(LC.familias === LV.familias && LC.correos.length === 0 && LC.claves.length === 4 && !/@/.test(JSON.stringify(LC.destinos)), 'quien NO envía (Comercial): las mismas cifras, ningún correo', JSON.stringify(LC.destinos));
ok(JSON.stringify(M.conteos(DC, M.config(DC.config))) === JSON.stringify(M.conteos(D, CFG)), 'y el número junto a cada grupo es el mismo');
ok(LC.invalidos.length === 1 && LC.invalidos[0].correo === '', 'el inválido se avisa, sin mostrar el correo a quien no envía');

console.log('· el envío, detrás de una sola función (lo hace el servidor)');
(async () => {
  let pedido = null;
  const r = await M.enviar({ idEnvio: 'envio-1', tanda: 2, tandas: 2, claves: T[1].map(d => d.clave), asunto: 'A', cuerpo: 'B' }, p => { pedido = p; return { ok: true, resultado: { estado: 'completa', enviadas: p.claves } }; });
  ok(pedido && pedido.tanda === 2 && pedido.claves.join() === T[1].map(d => d.clave).join() && r.estado === 'completa', 'Mensajes.enviar manda al servidor las claves de ESA tanda y devuelve su resultado');
  ok(pedido && !('correos' in pedido) && !/@/.test(JSON.stringify(pedido.claves.filter(k => /^h/.test(k)))), 'no manda una lista de correos: el servidor los busca por su cuenta');
  let error = '';
  try { await M.enviar({ claves: [] }, () => { throw new Error('sin permiso'); }); } catch (e) { error = e.message; }
  ok(error === 'sin permiso', 'si el servidor dice que no, la pantalla se entera');
  ok(M.horaDe(0) === new Date(0).getHours().toString().padStart(2, '0') + ':' + new Date(0).getMinutes().toString().padStart(2, '0'), 'la hora para «se puede seguir a las…», en la zona del que mira');
  ok(!('enlaceGmail' in M) && !/mail\.google\.com|authuser|bcc=/.test(fs.readFileSync(ARCHIVO, 'utf8')), 'ya no se arma ningún enlace de Gmail');

  const pagina = fs.readFileSync(path.join(__dirname, '..', 'mensajes', 'index.html'), 'utf8');
  const sinComentarios = pagina.replace(/<!--[\s\S]*?-->/g, '');
  ok(!/mail\.google\.com|resend|Abrir en Gmail/i.test(sinComentarios) && /Mensajes\.enviar\(/.test(pagina), 'la pantalla no abre Gmail: solo llama a Mensajes.enviar');
  ok(!/fetch\(|\.php/.test(sinComentarios), 'la pantalla no llama a ningún .php: pide todo a Datos');
  ok(/Enviarme una prueba/.test(pagina) && /Reintentar/.test(pagina) && /Copiar correos/.test(pagina) && /Copiar mensaje/.test(pagina), '«Enviarme una prueba», «Reintentar», «Copiar correos» y «Copiar mensaje»');
  ok(/D\.puedeEnviar/.test(pagina), 'lo de enviar y copiar depende de si el servidor dice que puede enviar');
  ok(/e\.canal/.test(pagina) && /enviado por el servidor/.test(pagina) && pagina.includes('Registrado como abierto en Gmail (antes del 5-nov)'), '«Enviados» dice lo que de verdad salió; las filas de antes, como abiertas en Gmail');
  console.log('· 5-nov (ajuste): corchetes, firma, pasos, barra y panel «Más»');
  ok(M.corchetes('Aviso: [día sin clase / cambio de horario]', 'Hola, [nombre]. Otra vez [nombre].').join('|') === '[día sin clase / cambio de horario]|[nombre]', 'encuentra los corchetes de la plantilla, en el asunto y en el mensaje');
  ok(M.corchetes('Todo completo', 'sin corchetes [ ni cierres').length === 0, 'un texto completo no tiene nada que marcar');
  ok(/if \(E\.paso === 3\) return !Mensajes\.corchetes\(E\.asunto, E\.cuerpo\)\.length;/.test(pagina), 'con corchetes, «Ir a enviar» no avanza');
  ok(/const ocupado = E\.enviando > 0 \|\| sinCompletar\.length > 0;/.test(pagina) && /async function enviarTanda\(i\) \{\n?\s*if \(E\.enviando \|\| Mensajes\.corchetes/.test(pagina.replace(/\r/g, '')) && /async function enviarPrueba\(\) \{\n?\s*if \(Mensajes\.corchetes/.test(pagina.replace(/\r/g, '')),
    'ni la prueba ni las tandas salen con corchetes');
  ok(/Falta completar/.test(pagina) && /ms-falta/.test(pagina), '«Revisar» dice qué corchete falta y lo marca en la vista previa');
  ok(/class="ms-firma"/.test(pagina) && pagina.indexOf('ms-firma"') < pagina.indexOf('class="ms-firma-img"') && pagina.indexOf('marcarCorchetes(E.cuerpo)') < pagina.indexOf('ms-firma"'), 'la vista previa: texto, línea de firma y la firma en imagen abajo, como el correo');
  ok(/\(D\.firma \? '<div class="ms-firma">' \+ esc\(D\.firma\) \+ '<\/div>' : ''\)/.test(pagina) && !/FIRMA_FALTA/.test(pagina) && !('FIRMA_FALTA' in M),
    '6-nov: con «Firma» vacía, la vista previa no inventa una línea (solo la imagen)');
  ok(/<img class="ms-firma-img" src="\/comun\/firma-vea\.png\?v=[0-9a-f]{10}" alt="' \+ esc\(D\.firmaAlt \|\| ''\) \+ '" width="660" height="220">/.test(pagina) && /href="' \+ esc\(D\.firmaEnlace \|\| ''\) \+ '" target="_blank" rel="noopener">/.test(pagina),
    '6-nov: la vista previa usa la misma imagen, el mismo texto alternativo y el mismo enlace que el correo');
  const css = fs.readFileSync(path.join(__dirname, '..', 'comun', 'vea.css'), 'utf8'), arm = fs.readFileSync(path.join(__dirname, '..', 'comun', 'armazon.css'), 'utf8');
  ok(/\.ms-pasos li::before \{ content: attr\(data-paso\);/.test(css) && !/counter-increment: paso/.test(css) && /data-paso="3"/.test(pagina), 'los números de los pasos salen de cada paso (iPhone: «3 Revisar», «4 Enviar»)');
  ok(/\.ms-barra \{ bottom: calc\(var\(--alto-abajo, 64px\) \+ env\(safe-area-inset-bottom, 0px\) \+ 8px\);/.test(css), 'en celular la barra de Mensajes queda encima de la navegación inferior, contando la franja del iPhone');
  ok(/\.lat \.lat-360, \.lat \.lat-grupo-tit, \.lat \.lat-txt/.test(arm) && !/\n  \.lat-360, \.lat-grupo-tit, \.lat-txt/.test(arm.replace(/\r/g, '')), 'el panel «Más» del celular conserva los nombres (las reglas de iconos son solo de la barra lateral)');
  fin();
})();
function fin() {
/* ── Roturas ─────────────────────────────────────────────────────────── */
if (!callado) {
  console.log('\n' + (fallos ? fallos + ' de ' + total + ' FALLAN' : 'Las ' + total + ' comprobaciones pasan') + '\n\nRoturas (cada una tiene que hacer fallar esta prueba):');
  const src = fs.readFileSync(ARCHIVO, 'utf8');
  const ROTURAS = [
    ['no quita repetidos', '      if (vistos.has(e.clave)) { repetidos++; return; }', ''],
    ['distingue mayúsculas', "  const limpiarCorreo = c => String(c == null ? '' : c).replace(/\\s+/g, '').toLowerCase();", "  const limpiarCorreo = c => String(c == null ? '' : c).trim();"],
    ['no excluye', "    if (excl.has(c)) return { estado: 'excluido', clave: '', correo: c };", ''],
    ['deja pasar inválidos', "    if (!correoValido(c)) return { estado: 'invalido', clave: '', correo: String(f.correo) };", ''],
    ['la unión toma solo el primer grupo', '    elegidas.forEach(g => g.ninos.forEach(k => union.add(k)));', '    elegidas.slice(0, 1).forEach(g => g.ninos.forEach(k => union.add(k)));'],
    ['tandas de tamaño fijo', "    const n = Math.max(1, parseInt(max, 10) || POR_DEFECTO.porTanda), out = [];", '    const n = 50, out = [];'],
    ['la tanda pasa del máximo por hora', '    c.porTanda = Math.min(c.porTanda, c.maxHora);', ''],
    ['no usa el estado que manda el servidor', '    if (f.estadoCorreo) return', '    if (false) return'],
    ['el envío manda los correos y no las claves', "    const p = Object.assign({}, pedido, { claves: (pedido.claves || []).slice() });", "    const p = Object.assign({}, pedido, { correos: (pedido.claves || []).slice() });"],
    ['WhatsApp sin código de país', "    if (!t.startsWith('+') && (d.length === 7 || d.length === 8)) d = String(codigoPais || POR_DEFECTO.codigoPais).replace(/\\D/g, '') + d;", ''],
    ['no encuentra los corchetes', "(String(t == null ? '' : t).match(/\\[[^\\[\\]\\n]{1,200}\\]/g) || [])", '[]'],
    ['«Firma» vacía vuelve a inventar «Equipo Vida en Arte»', "  const api = { TODO, norm,", "  const FIRMA_FALTA = 'Equipo Vida en Arte';\n  const api = { TODO, FIRMA_FALTA, norm,"],
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
}
