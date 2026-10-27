/**
 * VEA_AfterSchool_BD — Apps Script del archivo
 *
 * Herramienta provisional de After School de Vida en Arte (reemplaza a
 * Poliwin desde octubre de 2026). Tres cosas en un solo archivo:
 *
 *   1) INSTALACIÓN       instalar()       crea las pestañas que falten
 *                        comprobar()      dice qué falta, sin escribir
 *   2) CARGA INICIAL     ensayarCarga()   informa lo que cargaría, SIN escribir
 *                        cargaInicial()   escribe; se niega si ya hay datos
 *   3) PUENTE (doPost)   lo llama el api.php del portal, nunca el navegador
 *
 * SEGURIDAD. Toda llamada al puente trae dos cosas que pone el servidor del
 * portal y no el navegador:
 *   · key      la clave compartida. Vive en las Propiedades del script
 *              (AS_CLAVE_API) y en portal_config.php, fuera de la carpeta
 *              pública. Nunca en este archivo ni en el HTML.
 *   · usuario  el usuario con sesión abierta en el portal. api.php lo saca
 *              de la sesión y descarta el que mande el navegador.
 * Sin clave correcta o sin usuario, el puente no lee ni escribe nada.
 *
 * CONVENCIONES DE LA HOJA (las mismas de VEA_BaseDatos_Clientes):
 * encabezados en la fila 5, datos desde la 6, columna A vacía. Las columnas
 * se buscan por su título, nunca por su letra, y se lee siempre hasta la
 * última fila con datos.
 *
 * FECHAS. Ida y vuelta con la MISMA zona (la del archivo): parseDate y
 * formatDate son inversas exactas solo así. Es el defecto que corrió las
 * fechas de Kínder en 2026 (ver bdclientesvea/CONTEXTO.md §4).
 *
 * NINGUNA REGLA DE NEGOCIO EN EL CÓDIGO. Cupos en «Clases»; motivos, planes,
 * conceptos, formas de pago y el umbral del amarillo en «Config». Lo único con
 * valores de negocio es INS_CONFIG, que solo se escribe si Config está vacía.
 *
 * VERSIÓN v8 (23-oct-2026): Pasar lista del Profesor con ventana de días
 * (los últimos N para marcar y corregir; los próximos M solo para ver), con
 * N y M en Config; la coordinación también ve los próximos M días; nadie
 * marca un día futuro; y el rastro completo de cada corrección en Historial.
 *
 * VERSIÓN v9 (23-oct-2026): quitar una marca ya guardada (la fila se borra de
 * Asistencia y queda «Quitar asistencia» en Historial con lo que decía).
 *
 * VERSIÓN v10 (27-oct-2026): para las cifras de After School del Resumen del
 * negocio, leer devuelve también la pestaña Bajas (solo ID niño y fecha) y
 * dos parámetros de Config: «Días para que una prueba cuente como inscrita»
 * y «Cifras del Resumen desde». Las cuentas las hace comun/cifras.js.
 */
var VERSION_SCRIPT = 'v10';


// ═════════════════════════════════════════════════════════════════════════════
//  ESQUEMA
//  Los nombres de las pestañas y de las columnas son vocabulario de la base:
//  si se renombra una pestaña, se cambia aquí.
// ═════════════════════════════════════════════════════════════════════════════

var FILA_TITULOS = 5;
var FILA_DATOS   = 6;
var COL_INICIO   = 2;   // B: la A va vacía

var HOJAS = {
  ninos:         'Niños',
  clases:        'Clases',
  inscripciones: 'Inscripciones',
  pagos:         'Pagos',
  bajas:         'Bajas',
  config:        'Config',
  historial:     'Historial',
  pruebas:       'Pruebas',
  solicitudes:   'Solicitudes',
  // 21-oct: Pasar lista
  asistencia:    'Asistencia',
  sinClase:      'Clases sin dictar'
};

/* Las columnas que se agregan después de la carga inicial van SIEMPRE al
   final de su lista: actualizarEstructura() las crea a la derecha de las que
   ya existen, sin mover nada. Las columnas se buscan por título, así que el
   orden de la hoja no importa para leer. */
var COLUMNAS = {
  ninos: ['ID', 'Número socio Poliwin', 'Nombre', 'Apellidos', 'Fecha nacimiento',
          'Sexo', 'Nombre responsable', 'Teléfono', 'Teléfono 2', 'Correo',
          'Cabeza de familia', 'Estado', 'Fecha ingreso', 'Notas',
          // 15-oct: datos de la clase de prueba
          'Colegio', 'Cómo nos conoció', 'Familia que lo refirió', 'Hermanos (edades)',
          'Interés en otros servicios', 'Responsable 2', 'Teléfono responsable 2'],
  pruebas: ['ID prueba', 'Fecha', 'Clase ID', 'Niño ID', 'Estado', 'Se inscribió',
            'Motivo no inscripción', 'Nota', 'Registrado por', 'Fecha de registro',
            // 16-oct: la prueba tiene costo y se paga el día de la clase
            'Pagó', 'Monto pagado',
            // 21-oct: las pruebas pasan a ser «visitas de un día» de tres tipos
            // (Prueba, Reposición, Eventual). Vacío = Prueba (las anteriores).
            'Tipo', 'Repone asistencia', 'Resultado por lista'],
  // 21-oct: una fila por niño, clase y fecha. Corregir = actualizar la fila.
  asistencia: ['ID asistencia', 'Fecha', 'Código clase', 'ID niño', 'Presencia', 'ID visita', 'Estado',
               'Nombre fuera de lista', 'Marcado por', 'Hora', 'Nota', 'Resolución'],
  // 21-oct: clases que no se dictaron (feriado…): no se avisan como «sin lista».
  sinClase: ['Fecha', 'Código clase', 'Nota', 'Registrado por', 'Fecha registro'],
  // 16-oct: escrituras idempotentes (ver «Solicitudes» más abajo). Solo la
  // huella de los datos, nunca los datos: aquí no queda ningún dato de niños.
  solicitudes: ['ID solicitud', 'Acción', 'Huella', 'Resultado', 'Usuario', 'Fecha'],
  clases: ['Código clase', 'Servicio', 'Modalidad', 'Día', 'Hora inicio', 'Cupo',
           'Edades', 'Activa'],
  inscripciones: ['ID inscripción', 'ID niño', 'Código clase', 'Fecha alta',
                  'Fecha baja', 'Motivo baja', 'Detalle motivo', 'Registrado por',
                  'Fecha registro', 'Notas'],
  pagos: ['ID pago', 'ID niño', 'Mes que cubre', 'Concepto', 'Plan', 'Monto',
          'Fecha pago', 'Forma de pago', 'Registrado por', 'Notas'],
  bajas: ['ID niño', 'Fecha baja', 'Motivo', 'Detalle', 'Registrado por'],
  config: ['Lista', 'Valor', 'Número', 'Nota'],
  historial: ['Fecha', 'Usuario', 'Acción', 'ID', 'Detalle']
};

/* Columnas que se guardan como texto (formato @). Sin esto, Sheets convierte
   «2026-10» o «16:30» en fechas y un teléfono con + en una fórmula. */
var COLUMNAS_TEXTO = {
  ninos: ['ID', 'Número socio Poliwin', 'Teléfono', 'Teléfono 2', 'Cabeza de familia', 'Teléfono responsable 2'],
  clases: ['Código clase', 'Hora inicio'],
  inscripciones: ['ID inscripción', 'ID niño', 'Código clase'],
  pagos: ['ID pago', 'ID niño', 'Mes que cubre'],
  bajas: ['ID niño'],
  historial: ['ID'],
  pruebas: ['ID prueba', 'Clase ID', 'Niño ID', 'Repone asistencia'],
  solicitudes: ['ID solicitud', 'Huella', 'Resultado'],
  asistencia: ['ID asistencia', 'Código clase', 'ID niño', 'ID visita'],
  sinClase: ['Código clase']
};
var COLUMNAS_FECHA = {
  ninos: ['Fecha nacimiento', 'Fecha ingreso'],
  inscripciones: ['Fecha alta', 'Fecha baja'],
  pagos: ['Fecha pago'],
  bajas: ['Fecha baja'],
  pruebas: ['Fecha'],
  asistencia: ['Fecha'],
  sinClase: ['Fecha']
};
var COLUMNAS_FECHA_HORA = {
  inscripciones: ['Fecha registro'],
  historial: ['Fecha'],
  pruebas: ['Fecha de registro'],
  solicitudes: ['Fecha'],
  asistencia: ['Hora'],
  sinClase: ['Fecha registro']
};

/* Prefijos de los ID que genera el script. */
var PREFIJO = { nino: 'AS-', inscripcion: 'INS-', pago: 'PAG-', prueba: 'PRU-', asistencia: 'ASI-' };

/* Vocabulario fijo del sistema (no son reglas de negocio: son los estados
   que el propio sistema sabe tratar). */
var ESTADO = { activo: 'Activo', retirado: 'Retirado', revisar: 'Por revisar', prospecto: 'Prospecto', eventual: 'Eventual' };
var ESTADO_PRUEBA = { agendada: 'Agendada', asistio: 'Asistió', noAsistio: 'No asistió', cancelada: 'Cancelada' };
/* Las pruebas en estos estados ocupan un cupo de la clase ese día. */
var PRUEBA_OCUPA = [ESTADO_PRUEBA.agendada, ESTADO_PRUEBA.asistio];
/* 21-oct: tipos de visita de un día. Las tres ocupan cupo igual. */
var TIPO_VISITA = { prueba: 'Prueba', reposicion: 'Reposición', eventual: 'Eventual' };
var TIPOS_VISITA = [TIPO_VISITA.prueba, TIPO_VISITA.reposicion, TIPO_VISITA.eventual];
/* 21-oct: Pasar lista. */
var ESTADO_ASIS = { presente: 'Presente', ausente: 'Ausente', tarde: 'Llegó tarde', justificada: 'Falta justificada' };
var ESTADOS_ASIS = [ESTADO_ASIS.presente, ESTADO_ASIS.ausente, ESTADO_ASIS.tarde, ESTADO_ASIS.justificada];
var FALTAS = [ESTADO_ASIS.ausente, ESTADO_ASIS.justificada];          // las que se pueden reponer
var PRESENCIA = { inscrito: 'Inscrito', fuera: 'Fuera de lista' };    // o el tipo de la visita
var RESOLUCION = { vinculado: 'Vinculado', creado: 'Creado', descartado: 'Descartado' };
var SI = 'Sí', NO = 'No';
var MOTIVO_CAMBIO_CLASE = 'Cambio de clase';   // mover no es una deserción
var DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/* Las listas de Config. El valor de la columna «Lista» es la etiqueta. */
var LISTA = {
  motivo:   'Motivo baja',
  plan:     'Plan',
  concepto: 'Concepto',
  forma:    'Forma de pago',
  param:    'Parámetro',
  motivoNoInscripcion: 'Motivo no inscripción',
  comoConocio:         'Cómo nos conoció',
  interes:             'Interés en servicios'
};
var PARAM_UMBRAL = 'Umbral amarillo';   // fracción: 0,8 = 80 %
var PARAM_CONCEPTO_MENSUAL = 'Concepto de mensualidad';  // cuál concepto cuenta como «pagó el mes»
// 21-oct: seguimiento de asistencia
var PARAM_FALTAS_SEGUIDAS = 'Faltas seguidas';           // Número: ausencias seguidas que encienden la alerta
var PARAM_DIAS_REPONER = 'Días para reponer';            // Número: días hacia atrás de «faltas por reponer»
var PARAM_DURACION = 'Duración de clase (min)';          // Número: cuándo termina una clase (aviso «sin lista»)
var PARAM_ASIS_DESDE = 'Asistencia desde';               // Nota: fecha desde la que se avisa «sin lista»
// 23-oct (v8): ventana del Profesor en Pasar lista
var PARAM_LISTA_ATRAS = 'Días atrás para pasar lista (Profesor)';      // Número: días hacia atrás que marca y corrige
var PARAM_LISTA_ADELANTE = 'Días adelante para ver la lista (Profesor)'; // Número: días hacia adelante que ve, sin marcar
// 27-oct (v10): cifras de After School del Resumen del negocio
var PARAM_DIAS_INSCRIBE = 'Días para que una prueba cuente como inscrita'; // Número: ventana tras la prueba
var PARAM_RESUMEN_DESDE = 'Cifras del Resumen desde';  // Nota: fecha desde la que la hoja tiene altas y bajas completas

/* Valores iniciales de Config. ÚNICO sitio del código con valores de negocio.
   actualizarEstructura() escribe las filas de una lista SOLO si esa lista no
   tiene ninguna fila en Config (y los parámetros, solo si ese parámetro no
   existe). Después mandan los de la hoja: lo que Vida en Arte edite no se
   vuelve a escribir. */
var INS_CONFIG = [
  [LISTA.motivo, 'Horario', '', ''],
  [LISTA.motivo, 'Precio', '', ''],
  [LISTA.motivo, 'Se mudó', '', ''],
  [LISTA.motivo, 'Perdió interés', '', ''],
  [LISTA.motivo, 'Salud o lesión', '', ''],
  [LISTA.motivo, 'Cambió de actividad', '', ''],
  [LISTA.motivo, 'Temporada o vacaciones', '', ''],
  [LISTA.motivo, 'Otro', '', ''],
  [LISTA.plan, '4 clases', 85.60, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.plan, '8 clases', 128.40, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.plan, '12 clases', 165.85, 'Precio de referencia con ITBMS (Poliwin)'],
  [LISTA.concepto, 'Mensualidad', '', ''],
  [LISTA.concepto, 'Matrícula', '', ''],
  [LISTA.concepto, 'Otro', '', ''],
  [LISTA.forma, 'Efectivo', '', ''],
  [LISTA.forma, 'Tarjeta', '', ''],
  [LISTA.forma, 'Transferencia', '', ''],
  [LISTA.forma, 'Yappy', '', ''],
  [LISTA.forma, 'Otro', '', ''],
  [LISTA.param, PARAM_UMBRAL, 0.8, 'Desde esta ocupación la celda se pinta amarilla'],
  [LISTA.param, PARAM_CONCEPTO_MENSUAL, '', 'Mensualidad'],
  // 15-oct: clases de prueba
  [LISTA.motivoNoInscripcion, 'Precio', '', ''],
  [LISTA.motivoNoInscripcion, 'El horario no le sirve', '', ''],
  [LISTA.motivoNoInscripcion, 'Al niño no le gustó', '', ''],
  [LISTA.motivoNoInscripcion, 'Distancia o ubicación', '', ''],
  [LISTA.motivoNoInscripcion, 'Eligió otro lugar', '', ''],
  [LISTA.motivoNoInscripcion, 'Lo va a pensar o no respondió', '', ''],
  [LISTA.motivoNoInscripcion, 'Otro', '', ''],
  [LISTA.comoConocio, 'Instagram', '', ''],
  [LISTA.comoConocio, 'Facebook', '', ''],
  [LISTA.comoConocio, 'Google', '', ''],
  [LISTA.comoConocio, 'Referido por una familia', '', ''],
  [LISTA.comoConocio, 'Pasó por el local', '', ''],
  [LISTA.comoConocio, 'Colegio', '', ''],
  [LISTA.comoConocio, 'Otro', '', ''],
  [LISTA.interes, 'Kínder', '', ''],
  [LISTA.interes, 'Veranito', '', ''],
  [LISTA.interes, 'Sábados', '', ''],
  [LISTA.interes, 'Cumpleaños', '', ''],
  [LISTA.interes, 'Parkour', '', ''],
  [LISTA.interes, 'Telas', '', ''],
  [LISTA.interes, 'Parkids', '', ''],
  [LISTA.interes, 'Baby & Me', '', ''],
  // 21-oct: seguimiento de asistencia. «Asistencia desde» se escribe con la
  // fecha del día en que se corre Actualizar estructura (ver actualizarEstructura).
  [LISTA.param, PARAM_FALTAS_SEGUIDAS, 2, 'Ausencias seguidas (las justificadas no cuentan) que encienden la alerta'],
  [LISTA.param, PARAM_DIAS_REPONER, 30, 'La lista «faltas por reponer» mira estos días hacia atrás'],
  [LISTA.param, PARAM_DURACION, 60, 'Una clase sin lista se avisa cuando termina'],
  [LISTA.param, PARAM_ASIS_DESDE, '', ''],
  // 23-oct (v8): el Profesor marca y corrige hasta 7 días atrás y ve 7 días adelante (sin marcar).
  [LISTA.param, PARAM_LISTA_ATRAS, 7, 'Pasar lista: días hacia atrás que el Profesor puede marcar y corregir (0 = solo hoy)'],
  [LISTA.param, PARAM_LISTA_ADELANTE, 7, 'Pasar lista: días hacia adelante que el Profesor ve para preparar, sin marcar'],
  // 27-oct (v10): Resumen del negocio. «Cifras del Resumen desde» se escribe con
  // el primer registro de Inscripciones (la carga inicial; ver actualizarEstructura).
  [LISTA.param, PARAM_DIAS_INSCRIBE, 30, 'Resumen: una prueba cuenta como inscrita si el niño se inscribe dentro de estos días'],
  [LISTA.param, PARAM_RESUMEN_DESDE, '', 'Resumen: las altas, bajas y pruebas de After School se cuentan desde esta fecha']
];

/* Propiedades del script. */
var PROP_CLAVE = 'AS_CLAVE_API';
var PROP_ID_CARGA = 'AS_ID_CARGA';

var USUARIO_CARGA = 'Carga inicial Poliwin';

/* La carga marca así las inscripciones de niños en clases de adultos, para
   que Vida en Arte las confirme. Se ve en la lista de la clase y se quita con
   «Quitar nota» cuando esté verificada. */
var NOTA_CLASE_ADULTOS = 'Por verificar: clase de adultos';


// ═════════════════════════════════════════════════════════════════════════════
//  MENÚ
// ═════════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('After School')
    .addItem('Comprobar estructura', 'menuComprobar')
    .addItem('Actualizar estructura (crea lo que falte, no toca datos)', 'menuInstalar')
    .addSeparator()
    .addItem('Ensayar carga inicial (no escribe)', 'menuEnsayar')
    .addItem('Ejecutar carga inicial', 'menuCargar')
    .addToUi();
}
function menuComprobar() { mostrar_('Comprobar estructura', comprobar()); }
function menuInstalar()  { mostrar_('Actualizar estructura', actualizarEstructura()); }
function menuEnsayar()   { mostrar_('Ensayo de carga', ensayarCarga()); }
function menuCargar() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Carga inicial',
    'Va a escribir Niños, Clases e Inscripciones desde la copia del Excel. ' +
    'Se niega si alguna de las tres ya tiene datos. ¿Seguir?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  mostrar_('Carga inicial', cargaInicial());
}
function mostrar_(titulo, texto) {
  Logger.log(texto);
  try {
    var html = HtmlService.createHtmlOutput('<pre style="font:12px monospace;white-space:pre-wrap">' +
      String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>').setWidth(720).setHeight(560);
    SpreadsheetApp.getUi().showModalDialog(html, titulo);
  } catch (e) { /* desde el editor no hay interfaz: queda en el registro */ }
}


// ═════════════════════════════════════════════════════════════════════════════
//  AYUDAS DE HOJA
// ═════════════════════════════════════════════════════════════════════════════

/*
 * CACHÉ DE UNA EJECUCIÓN. Cada llamada al Sheet es un viaje al servicio y es
 * lo que hace lenta una escritura: medido en el simulador el 14-oct, una
 * escritura hacía ~1.180 llamadas, casi todas pidiendo la zona horaria una
 * vez por fecha. Ahora el libro y la zona se piden una vez, y las tablas que
 * ya se leyeron dentro de una llamada al puente se reutilizan: las escrituras
 * actualizan la copia en memoria, y el estado que se devuelve sale de ella
 * en vez de releer las pestañas. Es seguro porque todo ocurre bajo el lock;
 * prueba-after-school.js compara ese estado con una lectura nueva tras cada
 * escritura.
 *
 * Las variables globales de Apps Script nacen vacías en cada ejecución, pero
 * atender_() la vacía igual al empezar y al terminar.
 */
var CACHE_ = { libro: null, zona: null, tablas: null };
function reiniciarCache_(conTablas) { CACHE_ = { libro: null, zona: null, tablas: conTablas ? {} : null }; }

function libro_() { return CACHE_.libro || (CACHE_.libro = SpreadsheetApp.getActiveSpreadsheet()); }
function zona_() { return CACHE_.zona || (CACHE_.zona = libro_().getSpreadsheetTimeZone()); }

function hoja_(clave) {
  var h = libro_().getSheetByName(HOJAS[clave]);
  if (!h) throw new ErrorUsuario_('Falta la pestaña «' + HOJAS[clave] + '». Corre After School → Instalar.');
  return h;
}

/** Mapa título → número de columna (1-based) a partir de la fila 5 ya leída. */
function mapaTitulos_(fila, clave) {
  var mapa = {};
  for (var c = 0; c < fila.length; c++) {
    var t = String(fila[c] || '').trim();
    if (t && !(t in mapa)) mapa[t] = c + 1;
  }
  var faltan = COLUMNAS[clave].filter(function (t) { return !(t in mapa); });
  if (faltan.length) throw new ErrorUsuario_('A la pestaña «' + HOJAS[clave] +
    '» le faltan los títulos: ' + faltan.join(', ') + ' (fila ' + FILA_TITULOS + ').');
  return mapa;
}

/** Lee solo la fila de títulos. */
function titulos_(hoja, clave) {
  var ultima = Math.max(hoja.getLastColumn(), COL_INICIO);
  return { mapa: mapaTitulos_(hoja.getRange(FILA_TITULOS, 1, 1, ultima).getValues()[0], clave), ancho: ultima };
}

/**
 * Lee una tabla entera hasta la última fila con datos, en UNA lectura
 * (getDataRange: de la fila 1 a la última con contenido). Devuelve objetos
 * con los títulos como claves y _fila con la fila real. Salta las filas cuya
 * primera columna del esquema está vacía.
 */
function leerTabla_(clave) {
  if (CACHE_.tablas && CACHE_.tablas[clave]) return CACHE_.tablas[clave];
  var hoja = hoja_(clave);
  var todo = hoja.getDataRange().getValues();
  if (todo.length < FILA_TITULOS) mapaTitulos_([], clave);   // lanza el error de títulos
  var ancho = todo[0].length;
  var mapa = mapaTitulos_(todo[FILA_TITULOS - 1], clave);
  var llave = COLUMNAS[clave][0];
  var filas = [];
  for (var i = FILA_DATOS - 1; i < todo.length; i++) {
    var o = { _fila: i + 1 };
    COLUMNAS[clave].forEach(function (t) { o[t] = todo[i][mapa[t] - 1]; });
    if (String(o[llave] === null || o[llave] === undefined ? '' : o[llave]).trim() === '') continue;
    filas.push(o);
  }
  var tabla = { hoja: hoja, mapa: mapa, filas: filas, ultimaFila: todo.length, ancho: ancho };
  if (CACHE_.tablas) CACHE_.tablas[clave] = tabla;
  return tabla;
}

/** Hoja y títulos, sin leer los datos: para agregar filas a tablas largas (Historial, Bajas). */
function tablaParaAgregar_(clave) {
  if (CACHE_.tablas && CACHE_.tablas[clave]) return CACHE_.tablas[clave];
  var hoja = hoja_(clave);
  var t = titulos_(hoja, clave);
  return { hoja: hoja, mapa: t.mapa, filas: null, ultimaFila: null, ancho: t.ancho };
}

function letraCol_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/**
 * Escribe filas nuevas debajo de la última con contenido. Antes de escribir
 * pone el formato de texto y de fecha en esas filas: el que dejó instalar()
 * llega solo hasta la fila 1000, y sin él Sheets convierte «2026-10» en fecha.
 * Una llamada por tipo de formato (RangeList), no una por columna.
 */
function agregarFilas_(tabla, clave, objetos) {
  if (!objetos.length) return;
  var ancho = Math.max(tabla.ancho || tabla.hoja.getLastColumn(), COL_INICIO);
  var ultima = tabla.ultimaFila !== null && tabla.ultimaFila !== undefined ? tabla.ultimaFila : tabla.hoja.getLastRow();
  var desde = Math.max(ultima + 1, FILA_DATOS), hasta = desde + objetos.length - 1;
  [[COLUMNAS_TEXTO, '@'], [COLUMNAS_FECHA, 'dd/mm/yyyy'], [COLUMNAS_FECHA_HORA, 'dd/mm/yyyy hh:mm']].forEach(function (par) {
    var a1 = (par[0][clave] || []).map(function (t) { var l = letraCol_(tabla.mapa[t]); return l + desde + ':' + l + hasta; });
    if (a1.length) tabla.hoja.getRangeList(a1).setNumberFormat(par[1]);
  });
  var matriz = objetos.map(function (o) {
    var fila = [];
    for (var c = 0; c < ancho; c++) fila.push('');
    COLUMNAS[clave].forEach(function (t) {
      var v = o[t];
      fila[tabla.mapa[t] - 1] = (v === undefined || v === null) ? '' : v;
    });
    return fila;
  });
  tabla.hoja.getRange(desde, 1, matriz.length, ancho).setValues(matriz);
  tabla.ultimaFila = hasta;
  if (tabla.filas) objetos.forEach(function (o, i) {
    var copia = { _fila: desde + i };
    COLUMNAS[clave].forEach(function (t) { copia[t] = (o[t] === undefined || o[t] === null) ? '' : o[t]; });
    tabla.filas.push(copia);
  });
}

/**
 * Cambia celdas de una fila ya leída. Si las columnas son contiguas (Fecha
 * baja, Motivo baja, Detalle motivo) va en una sola escritura.
 */
function ponerCeldas_(tabla, fila, cambios) {
  var cols = Object.keys(cambios).map(function (t) {
    if (!(t in tabla.mapa)) throw new Error('columna desconocida ' + t);
    return { t: t, c: tabla.mapa[t], v: (cambios[t] === undefined || cambios[t] === null) ? '' : cambios[t] };
  }).sort(function (a, b) { return a.c - b.c; });
  if (!cols.length) return;
  var contiguas = cols[cols.length - 1].c - cols[0].c + 1 === cols.length;
  if (contiguas) tabla.hoja.getRange(fila._fila, cols[0].c, 1, cols.length).setValues([cols.map(function (x) { return x.v; })]);
  else cols.forEach(function (x) { tabla.hoja.getRange(fila._fila, x.c).setValue(x.v); });
  cols.forEach(function (x) { fila[x.t] = x.v; });
}

/**
 * Borra filas ya leídas (v9: quitar una marca de Asistencia). De abajo hacia
 * arriba, para que borrar una no corra el número de las otras; después pone
 * al día la copia en memoria (las filas de más abajo suben). Se llama DESPUÉS
 * de las demás escrituras de la misma acción.
 */
function borrarFilas_(tabla, filas) {
  var nums = filas.map(function (f) { return f._fila; }).sort(function (a, b) { return b - a; });
  nums.forEach(function (n) { tabla.hoja.deleteRow(n); });
  if (tabla.filas) {
    tabla.filas = tabla.filas.filter(function (f) { return filas.indexOf(f) < 0; });
    tabla.filas.forEach(function (f) { f._fila -= nums.filter(function (n) { return n < f._fila; }).length; });
  }
  if (tabla.ultimaFila !== null && tabla.ultimaFila !== undefined) tabla.ultimaFila -= nums.length;
}

function texto_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** Normaliza para comparar: sin mayúsculas, acentos ni espacios dobles. */
function norm_(v) {
  return texto_(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function siguienteId_(filas, columna, prefijo) {
  var max = 0;
  filas.forEach(function (f) {
    var s = texto_(f[columna]);
    if (s.indexOf(prefijo) === 0) {
      var n = parseInt(s.slice(prefijo.length), 10);
      if (n > max) max = n;
    }
  });
  return function () { max++; return prefijo + ('0000' + max).slice(-Math.max(4, String(max).length)); };
}


// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Valor de celda → 'yyyy-MM-dd' (o '' si vacío). */
function aISO_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, zona_(), 'yyyy-MM-dd');
  }
  var d = fechaDeTexto_(String(v));
  return d ? Utilities.formatDate(d, zona_(), 'yyyy-MM-dd') : '';
}

/** Valor de celda → 'yyyy-MM-dd HH:mm'. */
function aISOHora_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()))
    return Utilities.formatDate(v, zona_(), 'yyyy-MM-dd HH:mm');
  return texto_(v);
}

/**
 * Texto → Date en la zona del archivo. Acepta 'yyyy-MM-dd' (lo que manda la
 * página) y 'dd/MM/yyyy' (lo que trae Poliwin). Devuelve null si no es una
 * fecha real (un 31/02 no pasa).
 */
function fechaDeTexto_(s) {
  s = texto_(s);
  var m, y, mo, d;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  var txt = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
  var f = Utilities.parseDate(txt, zona_(), 'yyyy-MM-dd');
  if (Utilities.formatDate(f, zona_(), 'yyyy-MM-dd') !== txt) return null;
  return f;
}

/* El momento actual. Una sola función para que las pruebas puedan fijar la hora
   (clases que ya terminaron, lista del mismo día). */
function ahora_() { return new Date(); }
function hoyISO_() { return Utilities.formatDate(ahora_(), zona_(), 'yyyy-MM-dd'); }
function mesISO_() { return Utilities.formatDate(ahora_(), zona_(), 'yyyy-MM'); }
function horaAhora_() { return Utilities.formatDate(ahora_(), zona_(), 'HH:mm'); }
/* 'yyyy-MM-dd' ± n días, sin zonas (mediodía UTC). */
function sumarDiasISO_(iso, n) {
  var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
  d.setUTCDate(d.getUTCDate() + n);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/** Hora de clase → 'HH:mm'. Sheets puede haberla convertido en hora. */
function aHora_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, zona_(), 'HH:mm');
  var s = texto_(v), m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s;
}

/** Mes que cubre → 'yyyy-MM'. */
function aMes_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, zona_(), 'yyyy-MM');
  var s = texto_(v), m = /^(\d{4})-(\d{1,2})$/.exec(s);
  return m && +m[2] >= 1 && +m[2] <= 12 ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

/**
 * Número con la regla de bdclientesvea: si aparecen coma y punto manda el
 * último; si uno solo aparece más de una vez es de miles; si aparece una vez
 * es decimal, salvo que lo sigan exactamente tres dígitos.
 */
function numeroDe_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  var s = texto_(v).replace(/[\s$]/g, '');
  if (!s) return NaN;
  var c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) {
    var dec = c > p ? ',' : '.', mil = dec === ',' ? '.' : ',';
    s = s.split(mil).join('').replace(dec, '.');
  } else if (c >= 0 || p >= 0) {
    var sep = c >= 0 ? ',' : '.';
    var partes = s.split(sep);
    if (partes.length > 2 || partes[1].length === 3) s = partes.join('');
    else s = partes.join('.');
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}


// ═════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═════════════════════════════════════════════════════════════════════════════

function leerConfig_() {
  var t = leerTabla_('config');
  var cfg = { motivos: [], planes: [], conceptos: [], formas: [], umbral: null, conceptoMensual: '',
              motivosNoInscripcion: [], comoConocio: [], intereses: [], faltan: [], avisos: [],
              faltasSeguidas: null, diasReponer: null, duracionClase: null, asistenciaDesde: '',
              listaAtras: null, listaAdelante: null, diasInscribe: null, resumenDesde: '' };
  var entero = function (v) { var n = numeroDe_(v); return n >= 1 && Math.floor(n) === n ? n : null; };
  var enteroCero = function (v) { var n = numeroDe_(v); return n >= 0 && Math.floor(n) === n ? n : null; };
  t.filas.forEach(function (f) {
    var lista = norm_(f['Lista']), valor = texto_(f['Valor']);
    if (!valor) return;
    if (lista === norm_(LISTA.motivo)) cfg.motivos.push(valor);
    else if (lista === norm_(LISTA.motivoNoInscripcion)) cfg.motivosNoInscripcion.push(valor);
    else if (lista === norm_(LISTA.comoConocio)) cfg.comoConocio.push(valor);
    else if (lista === norm_(LISTA.interes)) {
      // Los intereses de un niño se guardan en UNA celda separados por coma:
      // un valor con coma se partiría en dos al leerlo. No se ofrece y se avisa.
      if (valor.indexOf(',') >= 0) cfg.avisos.push('el valor «' + valor + '» de la lista «' + LISTA.interes +
        '» tiene una coma y no se ofrece: quitar la coma en Config');
      else cfg.intereses.push(valor);
    }
    else if (lista === norm_(LISTA.plan)) cfg.planes.push({ nombre: valor, precio: numeroDe_(f['Número']) });
    else if (lista === norm_(LISTA.concepto)) cfg.conceptos.push(valor);
    else if (lista === norm_(LISTA.forma)) cfg.formas.push(valor);
    else if (lista === norm_(LISTA.param)) {
      if (norm_(valor) === norm_(PARAM_UMBRAL)) {
        var u = numeroDe_(f['Número']);
        if (u > 1) u = u / 100;          // admite 80 o 0,8
        if (u > 0 && u <= 1) cfg.umbral = u;
      } else if (norm_(valor) === norm_(PARAM_CONCEPTO_MENSUAL)) {
        cfg.conceptoMensual = texto_(f['Nota']);
      } else if (norm_(valor) === norm_(PARAM_FALTAS_SEGUIDAS)) cfg.faltasSeguidas = entero(f['Número']);
      else if (norm_(valor) === norm_(PARAM_DIAS_REPONER)) cfg.diasReponer = entero(f['Número']);
      else if (norm_(valor) === norm_(PARAM_DURACION)) cfg.duracionClase = entero(f['Número']);
      else if (norm_(valor) === norm_(PARAM_ASIS_DESDE)) cfg.asistenciaDesde = aISO_(f['Nota']);
      else if (norm_(valor) === norm_(PARAM_LISTA_ATRAS)) cfg.listaAtras = enteroCero(f['Número']);
      else if (norm_(valor) === norm_(PARAM_LISTA_ADELANTE)) cfg.listaAdelante = enteroCero(f['Número']);
      // 27-oct (v10): solo los usa el Resumen; sin ellos, esas cifras dicen qué falta (no van a «faltan»).
      else if (norm_(valor) === norm_(PARAM_DIAS_INSCRIBE)) cfg.diasInscribe = entero(f['Número']);
      else if (norm_(valor) === norm_(PARAM_RESUMEN_DESDE)) cfg.resumenDesde = aISO_(f['Nota']);
    }
  });
  cfg.planes.forEach(function (p) { if (isNaN(p.precio)) p.precio = null; });
  if (!cfg.motivos.length) cfg.faltan.push('filas «' + LISTA.motivo + '»');
  if (!cfg.planes.length) cfg.faltan.push('filas «' + LISTA.plan + '»');
  if (!cfg.conceptos.length) cfg.faltan.push('filas «' + LISTA.concepto + '»');
  if (!cfg.formas.length) cfg.faltan.push('filas «' + LISTA.forma + '»');
  if (!cfg.motivosNoInscripcion.length) cfg.faltan.push('filas «' + LISTA.motivoNoInscripcion + '»');
  if (!cfg.comoConocio.length) cfg.faltan.push('filas «' + LISTA.comoConocio + '»');
  if (!cfg.intereses.length) cfg.faltan.push('filas «' + LISTA.interes + '»');
  if (cfg.umbral === null) cfg.faltan.push('«' + LISTA.param + ' / ' + PARAM_UMBRAL + '» con un número entre 0 y 1 en la columna Número');
  if (!cfg.conceptoMensual) cfg.faltan.push('«' + LISTA.param + ' / ' + PARAM_CONCEPTO_MENSUAL + '» con el concepto en la columna Nota');
  else if (cfg.conceptos.map(norm_).indexOf(norm_(cfg.conceptoMensual)) < 0)
    cfg.faltan.push('el concepto de mensualidad «' + cfg.conceptoMensual + '» no está en la lista «' + LISTA.concepto + '»');
  [[PARAM_FALTAS_SEGUIDAS, cfg.faltasSeguidas], [PARAM_DIAS_REPONER, cfg.diasReponer], [PARAM_DURACION, cfg.duracionClase]].forEach(function (p) {
    if (p[1] === null) cfg.faltan.push('«' + LISTA.param + ' / ' + p[0] + '» con un número entero (1 o más) en la columna Número');
  });
  if (!cfg.asistenciaDesde) cfg.faltan.push('«' + LISTA.param + ' / ' + PARAM_ASIS_DESDE + '» con una fecha en la columna Nota');
  [[PARAM_LISTA_ATRAS, cfg.listaAtras], [PARAM_LISTA_ADELANTE, cfg.listaAdelante]].forEach(function (p) {
    if (p[1] === null) cfg.faltan.push('«' + LISTA.param + ' / ' + p[0] + '» con un número entero (0 o más) en la columna Número');
  });
  return cfg;
}

function enLista_(valor, lista) {
  var n = norm_(valor);
  for (var i = 0; i < lista.length; i++) if (norm_(lista[i]) === n) return lista[i];
  return null;
}


// ═════════════════════════════════════════════════════════════════════════════
//  INSTALACIÓN Y COMPROBACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/** Nombre anterior del menú; hace lo mismo. */
function instalar() { return actualizarEstructura(); }

/**
 * Crea lo que falte y NO toca datos. Se puede correr las veces que haga falta:
 *   · pestañas que falten, con sus títulos en la fila 5;
 *   · en pestañas que ya existen, los títulos que falten, AGREGADOS A LA
 *     DERECHA de la última columna usada (nunca se mueve ni se pisa una
 *     columna existente);
 *   · en Config, las filas iniciales de cada lista que no tenga ninguna fila
 *     (y de cada parámetro que no exista). Una lista que Vida en Arte ya
 *     editó no se toca.
 * Termina con comprobar().
 */
function actualizarEstructura() {
  var ss = libro_(), informe = [];
  var formatear = function (h, clave, columnas, colDe) {
    [[COLUMNAS_TEXTO, '@'], [COLUMNAS_FECHA, 'dd/mm/yyyy'], [COLUMNAS_FECHA_HORA, 'dd/mm/yyyy hh:mm']].forEach(function (par) {
      (par[0][clave] || []).forEach(function (t) {
        if (columnas.indexOf(t) < 0) return;
        h.getRange(FILA_DATOS, colDe(t), Math.max(h.getMaxRows() - FILA_DATOS + 1, 1), 1).setNumberFormat(par[1]);
      });
    });
  };
  Object.keys(HOJAS).forEach(function (clave) {
    var cols = COLUMNAS[clave];
    var h = ss.getSheetByName(HOJAS[clave]);
    if (!h) {
      h = ss.insertSheet(HOJAS[clave]);
      h.getRange(FILA_TITULOS, COL_INICIO, 1, cols.length).setValues([cols]).setFontWeight('bold');
      h.setFrozenRows(FILA_TITULOS);
      h.setColumnWidth(1, 24);
      formatear(h, clave, cols, function (t) { return COL_INICIO + cols.indexOf(t); });
      h.getRange(2, COL_INICIO).setValue(HOJAS[clave]).setFontWeight('bold').setFontSize(13);
      informe.push('Creada: ' + HOJAS[clave]);
      return;
    }
    var ultima = Math.max(h.getLastColumn(), COL_INICIO);
    var fila = h.getRange(FILA_TITULOS, 1, 1, ultima).getValues()[0].map(function (v) { return String(v || '').trim(); });
    var faltan = cols.filter(function (t) { return fila.indexOf(t) < 0; });
    if (!faltan.length) { informe.push('Ya existía, completa: ' + HOJAS[clave]); return; }
    var desde = ultima + 1;
    h.getRange(FILA_TITULOS, desde, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
    formatear(h, clave, faltan, function (t) { return desde + faltan.indexOf(t); });
    informe.push('Columnas agregadas al final de ' + HOJAS[clave] + ': ' + faltan.join(', '));
  });

  var t = leerTabla_('config');
  var listas = {}, params = {};
  t.filas.forEach(function (f) {
    listas[norm_(f['Lista'])] = true;
    if (norm_(f['Lista']) === norm_(LISTA.param)) params[norm_(f['Valor'])] = true;
  });
  var nuevas = INS_CONFIG.filter(function (r) {
    return norm_(r[0]) === norm_(LISTA.param) ? !params[norm_(r[1])] : !listas[norm_(r[0])];
  });
  if (nuevas.length) {
    agregarFilas_(t, 'config', nuevas.map(function (r) {
      // «Asistencia desde» arranca el día en que se instala: las clases de antes no se avisan como «sin lista».
      // «Cifras del Resumen desde»: el primer registro de Inscripciones (desde ahí la hoja tiene
      // todas las altas y las bajas; antes, solo lo que trajo la carga de Poliwin).
      var nota = r[1] === PARAM_ASIS_DESDE ? fechaDeTexto_(hoyISO_()) : r[1] === PARAM_RESUMEN_DESDE ? fechaDeTexto_(primerRegistro_()) : r[3];
      return { 'Lista': r[0], 'Valor': r[1], 'Número': r[2], 'Nota': nota };
    }));
    var porLista = {};
    nuevas.forEach(function (r) { porLista[r[0]] = (porLista[r[0]] || 0) + 1; });
    informe.push('Config: agregadas ' + Object.keys(porLista).map(function (k) { return k + ' (' + porLista[k] + ')'; }).join(', '));
  } else informe.push('Config: completa, no se tocó');

  // 21-oct: las pruebas anteriores a las visitas quedan como tipo «Prueba».
  // Una sola escritura de la columna; solo las filas con ID y Tipo vacío.
  var pr = leerTabla_('pruebas'), sinTipo = pr.filas.filter(function (f) { return texto_(f['Tipo']) === ''; });
  if (sinTipo.length) {
    var colTipo = pr.mapa['Tipo'], desdeF = FILA_DATOS, n = pr.ultimaFila - FILA_DATOS + 1;
    var rango = pr.hoja.getRange(desdeF, colTipo, n, 1), vals = rango.getValues();
    sinTipo.forEach(function (f) { vals[f._fila - desdeF][0] = TIPO_VISITA.prueba; f['Tipo'] = TIPO_VISITA.prueba; });
    rango.setValues(vals);
    informe.push('Pruebas: ' + sinTipo.length + ' fila(s) sin Tipo quedaron como «' + TIPO_VISITA.prueba + '»');
  }
  informe.push('');
  informe.push(comprobar());
  return informe.join('\n');
}

/** Diagnóstico. No escribe nada. */
function comprobar() {
  var ss = libro_(), l = [];
  l.push('Archivo: ' + ss.getName() + ' · AfterSchool.gs ' + VERSION_SCRIPT);
  var zArchivo = ss.getSpreadsheetTimeZone(), zScript = Session.getScriptTimeZone();
  l.push('Zona del archivo: ' + zArchivo + ' · zona del script: ' + zScript +
    (zArchivo === zScript ? '' : '   ⚠ DIFIEREN: igualarlas antes de usar'));
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  l.push('Clave del puente (' + PROP_CLAVE + '): ' + (clave && clave.length >= 24 ? 'configurada' :
    clave ? '⚠ demasiado corta (mínimo 24 caracteres)' : '⚠ FALTA: el puente rechaza todo'));
  Object.keys(HOJAS).forEach(function (k) {
    try { var t = leerTabla_(k); l.push(HOJAS[k] + ': ' + t.filas.length + ' filas'); }
    catch (e) { l.push('⚠ ' + e.message); }
  });
  try {
    var cfg = leerConfig_();
    l.push('Config: ' + cfg.motivos.length + ' motivos, ' + cfg.planes.length + ' planes, ' +
      cfg.conceptos.length + ' conceptos, ' + cfg.formas.length + ' formas de pago, umbral ' +
      (cfg.umbral === null ? '—' : Math.round(cfg.umbral * 100) + ' %'));
    l.push('Config (pruebas): ' + cfg.motivosNoInscripcion.length + ' motivos de no inscripción, ' +
      cfg.comoConocio.length + ' opciones de «cómo nos conoció», ' + cfg.intereses.length + ' servicios de interés');
    cfg.faltan.forEach(function (f) { l.push('⚠ Config: falta ' + f); });
    cfg.avisos.forEach(function (f) { l.push('⚠ Config: ' + f); });
  } catch (e) { l.push('⚠ ' + e.message); }
  return l.join('\n');
}


// ═════════════════════════════════════════════════════════════════════════════
//  CARGA INICIAL DESDE POLIWIN
//
//  Lee una copia CONVERTIDA a Google Sheets de Carga_Inicial_AfterSchool.xlsx
//  (en Drive: clic derecho → Abrir con → Hojas de cálculo de Google). Su ID va
//  en la propiedad AS_ID_CARGA. Tres pestañas con títulos en la fila 1:
//    Clases         Código clase, Servicio, Modalidad, Día, Hora inicio, Cupo, Edades
//                   (+ «Reservados…», que solo se usa para comprobar)
//    Niños          Número de socio, Nombre, Apellidos, Fecha nacimiento, Sexo,
//                   Estado (Poliwin), Fecha de alta, Móvil, Móvil 2, Teléfono,
//                   E-mail, Cabeza de familia, Observaciones, Revisar
//    Inscripciones  Número de socio, Código clase, Reservado en Poliwin el
// ═════════════════════════════════════════════════════════════════════════════

function ensayarCarga() { return informeCarga_(planCarga_(), false); }

function cargaInicial() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'Otra operación está escribiendo. Vuelve a intentarlo en un minuto.';
  try {
    var plan = planCarga_();
    var ocupadas = ['ninos', 'clases', 'inscripciones'].filter(function (k) { return leerTabla_(k).filas.length > 0; });
    if (ocupadas.length) return 'NO SE CARGÓ NADA: ' + ocupadas.map(function (k) { return HOJAS[k]; }).join(', ') +
      ' ya tiene datos. La carga inicial solo corre sobre pestañas vacías.';
    if (plan.errorGrave) return 'NO SE CARGÓ NADA: ' + plan.errorGrave;
    agregarFilas_(leerTabla_('clases'), 'clases', plan.clases);
    agregarFilas_(leerTabla_('ninos'), 'ninos', plan.ninos);
    agregarFilas_(leerTabla_('inscripciones'), 'inscripciones', plan.inscripciones);
    historial_(USUARIO_CARGA, 'Carga inicial', '', plan.clases.length + ' clases, ' +
      plan.ninos.length + ' niños, ' + plan.inscripciones.length + ' inscripciones');
    SpreadsheetApp.flush();
    return informeCarga_(plan, true);
  } finally { lock.releaseLock(); }
}

function leerOrigen_(ss, nombre) {
  var h = ss.getSheetByName(nombre);
  if (!h) return null;
  var v = h.getDataRange().getValues();
  if (!v.length) return { titulos: {}, filas: [] };
  var tit = {};
  v[0].forEach(function (t, i) { t = texto_(t); if (t && !(t in tit)) tit[t] = i; });
  return { titulos: tit, filas: v.slice(1).map(function (r, i) { return { n: i + 2, r: r }; }) };
}

/** Busca una columna por título normalizado; admite que empiece igual. */
function colOrigen_(origen, titulo, prefijo) {
  var objetivo = norm_(titulo);
  for (var t in origen.titulos) {
    var n = norm_(t);
    if (n === objetivo || (prefijo && n.indexOf(objetivo) === 0)) return origen.titulos[t];
  }
  return -1;
}

function planCarga_() {
  var plan = { clases: [], ninos: [], inscripciones: [], rechazos: [], avisos: [], revisarEdad: [],
               reservadosPoliwin: {}, errorGrave: '' };
  var id = PropertiesService.getScriptProperties().getProperty(PROP_ID_CARGA);
  if (!id) { plan.errorGrave = 'falta la propiedad del script ' + PROP_ID_CARGA + ' con el ID de la copia convertida del Excel.'; return plan; }
  var ss;
  try { ss = SpreadsheetApp.openById(id); }
  catch (e) { plan.errorGrave = 'no se pudo abrir el archivo ' + id + ': ' + e.message; return plan; }

  var oC = leerOrigen_(ss, 'Clases'), oN = leerOrigen_(ss, 'Niños'), oI = leerOrigen_(ss, 'Inscripciones');
  var faltan = [];
  if (!oC) faltan.push('Clases'); if (!oN) faltan.push('Niños'); if (!oI) faltan.push('Inscripciones');
  if (faltan.length) { plan.errorGrave = 'al archivo de carga le faltan las pestañas: ' + faltan.join(', '); return plan; }

  function cols(origen, nombreHoja, lista) {
    var r = {}, miss = [];
    lista.forEach(function (x) {
      var c = colOrigen_(origen, x[0], x[1]);
      if (c < 0 && !x[2]) miss.push(x[0]);
      r[x[0]] = c;
    });
    if (miss.length) plan.errorGrave = (plan.errorGrave ? plan.errorGrave + '; ' : '') +
      'a la pestaña ' + nombreHoja + ' le faltan las columnas: ' + miss.join(', ');
    return r;
  }
  function val(fila, c) { return c < 0 ? '' : fila.r[c]; }

  // [título, admite prefijo, opcional]
  var cC = cols(oC, 'Clases', [['Código clase'], ['Servicio'], ['Modalidad'], ['Día'], ['Hora inicio'],
                               ['Cupo'], ['Edades'], ['Reservados', true, true]]);
  var cN = cols(oN, 'Niños', [['Número de socio'], ['Nombre'], ['Apellidos'], ['Fecha nacimiento'], ['Sexo'],
                              ['Estado (Poliwin)', true, true], ['Fecha de alta'], ['Móvil'], ['Móvil 2'],
                              ['Teléfono'], ['E-mail'], ['Cabeza de familia'], ['Observaciones'], ['Revisar']]);
  var cI = cols(oI, 'Inscripciones', [['Número de socio'], ['Código clase'], ['Reservado en Poliwin el']]);
  if (plan.errorGrave) return plan;

  var ahora = new Date();

  // ── Clases ──
  var codigos = {};
  oC.filas.forEach(function (f) {
    var cod = texto_(val(f, cC['Código clase']));
    if (!cod && f.r.every(function (x) { return texto_(x) === ''; })) return;
    var dia = enLista_(val(f, cC['Día']), DIAS_ORDEN);
    var cupo = numeroDe_(val(f, cC['Cupo']));
    var motivo = !cod ? 'sin código de clase' :
                 codigos[cod] ? 'código repetido' :
                 !texto_(val(f, cC['Servicio'])) ? 'sin servicio' :
                 !dia ? 'día no reconocido «' + texto_(val(f, cC['Día'])) + '»' :
                 !(cupo > 0 && Math.floor(cupo) === cupo) ? 'cupo no es un entero positivo' : '';
    if (motivo) { plan.rechazos.push('Clases fila ' + f.n + ' (' + (cod || '—') + '): ' + motivo); return; }
    codigos[cod] = { edades: texto_(val(f, cC['Edades'])) };
    if (cC['Reservados'] >= 0) plan.reservadosPoliwin[cod] = numeroDe_(val(f, cC['Reservados']));
    plan.clases.push({
      'Código clase': cod, 'Servicio': texto_(val(f, cC['Servicio'])),
      'Modalidad': texto_(val(f, cC['Modalidad'])), 'Día': dia,
      'Hora inicio': aHora_(val(f, cC['Hora inicio'])), 'Cupo': cupo,
      'Edades': codigos[cod].edades, 'Activa': SI
    });
  });

  // ── Niños ──
  var siguiente = siguienteId_([], 'ID', PREFIJO.nino);
  var porSocio = {};
  oN.filas.forEach(function (f) {
    var socio = texto_(val(f, cN['Número de socio']));
    var nombre = texto_(val(f, cN['Nombre']));
    if (!socio && !nombre && f.r.every(function (x) { return texto_(x) === ''; })) return;
    var motivo = !socio ? 'sin número de socio' : porSocio[socio] ? 'número de socio repetido' :
                 !nombre ? 'sin nombre' : '';
    if (motivo) { plan.rechazos.push('Niños fila ' + f.n + ' (socio ' + (socio || '—') + '): ' + motivo); return; }

    var nacTxt = val(f, cN['Fecha nacimiento']), nac = '';
    if (texto_(nacTxt) !== '') {
      nac = Object.prototype.toString.call(nacTxt) === '[object Date]' ? nacTxt : fechaDeTexto_(nacTxt);
      if (!nac) { plan.avisos.push('Niños fila ' + f.n + ' (socio ' + socio + '): fecha de nacimiento ilegible «' + texto_(nacTxt) + '», se carga vacía'); nac = ''; }
    }
    var altaTxt = val(f, cN['Fecha de alta']), alta = '';
    if (texto_(altaTxt) !== '') {
      alta = Object.prototype.toString.call(altaTxt) === '[object Date]' ? altaTxt : fechaDeTexto_(altaTxt);
      if (!alta) { plan.avisos.push('Niños fila ' + f.n + ' (socio ' + socio + '): fecha de alta ilegible, se carga vacía'); alta = ''; }
    }

    // Teléfonos: Móvil → Teléfono; Móvil 2, o el fijo si difiere del móvil → Teléfono 2.
    var movil = texto_(val(f, cN['Móvil'])), movil2 = texto_(val(f, cN['Móvil 2'])), fijo = texto_(val(f, cN['Teléfono']));
    var tels = [];
    [movil, movil2, fijo].forEach(function (t) { if (t && tels.indexOf(t) < 0) tels.push(t); });
    var notas = [];
    var obs = texto_(val(f, cN['Observaciones']));
    if (obs) notas.push(obs);
    var revisar = texto_(val(f, cN['Revisar']));
    if (revisar) notas.push('Revisar (Poliwin): ' + revisar);
    var estP = cN['Estado (Poliwin)'] >= 0 ? texto_(val(f, cN['Estado (Poliwin)'])) : '';
    if (estP && norm_(estP) !== 'alta') notas.push('Estado en Poliwin: ' + estP);
    if (tels.length > 2) notas.push('Otro teléfono: ' + tels.slice(2).join(', '));

    var idNino = siguiente();
    porSocio[socio] = idNino;
    plan.ninos.push({
      'ID': idNino, 'Número socio Poliwin': socio, 'Nombre': nombre,
      'Apellidos': texto_(val(f, cN['Apellidos'])), 'Fecha nacimiento': nac,
      'Sexo': texto_(val(f, cN['Sexo'])), 'Nombre responsable': '',
      'Teléfono': tels[0] || '', 'Teléfono 2': tels[1] || '',
      'Correo': texto_(val(f, cN['E-mail'])), 'Cabeza de familia': texto_(val(f, cN['Cabeza de familia'])),
      'Estado': revisar ? ESTADO.revisar : ESTADO.activo, 'Fecha ingreso': alta,
      'Notas': notas.join(' · '), _nac: nac
    });
  });

  // ── Inscripciones ──
  var sigIns = siguienteId_([], 'ID inscripción', PREFIJO.inscripcion);
  var vistas = {};
  var ninoPorId = {};
  plan.ninos.forEach(function (n) { ninoPorId[n['ID']] = n; });
  oI.filas.forEach(function (f) {
    var socio = texto_(val(f, cI['Número de socio'])), cod = texto_(val(f, cI['Código clase']));
    if (!socio && !cod) return;
    var fechaTxt = val(f, cI['Reservado en Poliwin el']);
    var fecha = Object.prototype.toString.call(fechaTxt) === '[object Date]' ? fechaTxt : fechaDeTexto_(fechaTxt);
    var idNino = porSocio[socio];
    var motivo = !idNino ? 'el socio ' + (socio || '—') + ' no está entre los niños cargados' :
                 !codigos[cod] ? 'la clase «' + cod + '» no está entre las clases cargadas' :
                 vistas[socio + '|' + cod] ? 'inscripción repetida' :
                 !fecha ? 'fecha de reserva ilegible «' + texto_(fechaTxt) + '»' : '';
    if (motivo) { plan.rechazos.push('Inscripciones fila ' + f.n + ' (socio ' + (socio || '—') + ', ' + (cod || '—') + '): ' + motivo); return; }
    vistas[socio + '|' + cod] = true;
    var adultos = norm_(codigos[cod].edades) === 'adultos';
    plan.inscripciones.push({
      'ID inscripción': sigIns(), 'ID niño': idNino, 'Código clase': cod, 'Fecha alta': fecha,
      'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': '',
      'Registrado por': USUARIO_CARGA, 'Fecha registro': ahora,
      'Notas': adultos ? NOTA_CLASE_ADULTOS : ''
    });
    if (adultos) {
      var n = ninoPorId[idNino];
      plan.revisarEdad.push(cod + ' (' + codigos[cod].edades + '): ' + idNino + ', socio ' + socio +
        ', ' + (n._nac ? edadTexto_(n._nac) : 'sin fecha de nacimiento'));
    }
  });
  plan.ninos.forEach(function (n) { delete n._nac; });
  return plan;
}

function edadTexto_(nac) {
  var hoy = new Date();
  var a = hoy.getFullYear() - nac.getFullYear();
  var m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) a--;
  return a + ' años';
}

function informeCarga_(plan, escrito) {
  var l = [];
  l.push(escrito ? 'CARGA INICIAL — ESCRITA' : 'ENSAYO DE CARGA — NO SE ESCRIBIÓ NADA');
  if (plan.errorGrave) { l.push(''); l.push('⚠ ' + plan.errorGrave); return l.join('\n'); }
  l.push('');
  l.push('Clases: ' + plan.clases.length);
  l.push('Niños: ' + plan.ninos.length);
  var est = {};
  plan.ninos.forEach(function (n) { est[n['Estado']] = (est[n['Estado']] || 0) + 1; });
  Object.keys(est).forEach(function (e) { l.push('   ' + e + ': ' + est[e]); });
  l.push('Inscripciones: ' + plan.inscripciones.length);
  var porClase = {};
  plan.inscripciones.forEach(function (i) { porClase[i['Código clase']] = (porClase[i['Código clase']] || 0) + 1; });
  l.push('');
  l.push('Inscripciones por clase (reservados / cupo):');
  plan.clases.forEach(function (c) {
    var cod = c['Código clase'], n = porClase[cod] || 0;
    var p = plan.reservadosPoliwin[cod];
    var dif = (p !== undefined && !isNaN(p) && p !== n) ? '   ⚠ Poliwin decía ' + p : '';
    l.push('   ' + cod + ': ' + n + ' / ' + c['Cupo'] + (n > c['Cupo'] ? '   ⚠ SOBRE EL CUPO' : '') + dif);
  });
  l.push('');
  l.push('Filas que NO se cargan: ' + plan.rechazos.length);
  plan.rechazos.forEach(function (r) { l.push('   ' + r); });
  l.push('Avisos (se cargan con el dato vacío): ' + plan.avisos.length);
  plan.avisos.forEach(function (r) { l.push('   ' + r); });
  l.push('Inscripciones en clases de adultos, para revisar: ' + plan.revisarEdad.length);
  plan.revisarEdad.forEach(function (r) { l.push('   ' + r); });
  if (plan.revisarEdad.length) l.push('   (se cargan con la nota «' + NOTA_CLASE_ADULTOS + '» en la inscripción)');
  return l.join('\n');
}


// ═════════════════════════════════════════════════════════════════════════════
//  PUENTE
// ═════════════════════════════════════════════════════════════════════════════

function ErrorUsuario_(mensaje, codigo) { this.message = mensaje; this.codigo = codigo || ''; }

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return respuesta_({ ok: false, error: 'Este puente solo responde a POST desde el portal.' });
}

function doPost(e) {
  var p;
  try { p = JSON.parse(e && e.postData ? e.postData.contents : ''); }
  catch (err) { return respuesta_({ ok: false, error: 'cuerpo ilegible' }); }
  return respuesta_(atender_(p || {}));
}

/** Compara sin cortar en el primer carácter distinto. */
function igualSeguro_(a, b) {
  a = String(a || ''); b = String(b || '');
  var dif = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}

var ACCIONES = {
  leer: { escribe: false, fn: accLeer_ },
  listarPagos: { escribe: false, fn: accListarPagos_ },
  crearNino: { escribe: true, fn: accCrearNino_ },
  editarNino: { escribe: true, fn: accEditarNino_ },
  inscribir: { escribe: true, fn: accInscribir_ },
  inscribirVarias: { escribe: true, fn: accInscribirVarias_ },
  mover: { escribe: true, fn: accMover_ },
  bajaClase: { escribe: true, fn: accBajaClase_ },
  bajaTotal: { escribe: true, fn: accBajaTotal_ },
  registrarPago: { escribe: true, fn: accRegistrarPago_ },
  revisar: { escribe: true, fn: accRevisar_ },
  notaInscripcion: { escribe: true, fn: accNotaInscripcion_ },
  agendarPrueba: { escribe: true, fn: accAgendarPrueba_ },
  resultadoPrueba: { escribe: true, fn: accResultadoPrueba_ },
  pagoPrueba: { escribe: true, fn: accPagoPrueba_ },
  // 21-oct: visitas de un día, Pasar lista y seguimiento
  agendarVisita: { escribe: true, fn: accAgendarVisita_ },
  ocupacion: { escribe: false, fn: accOcupacion_ },
  leerLista: { escribe: false, fn: accLeerLista_ },
  // sinEstado: no devuelve el estado completo de After School (lo usa el rol
  // Profesor, que no debe recibir nada más que su lista).
  guardarLista: { escribe: true, sinEstado: true, fn: accGuardarLista_ },
  noHuboClase: { escribe: true, fn: accNoHuboClase_ },
  resolverFueraDeLista: { escribe: true, fn: accResolverFueraDeLista_ },
  seguimiento: { escribe: false, fn: accSeguimiento_ },
  asistenciaNino: { escribe: false, fn: accAsistenciaNino_ }
};

function atender_(p) {
  var clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
  if (!clave || clave.length < 24) return { ok: false, error: 'El puente no tiene clave configurada.', codigo: 'sin_clave' };
  if (!igualSeguro_(p.key, clave)) return { ok: false, error: 'clave inválida', codigo: 'no_autorizado' };
  var usuario = texto_(p.usuario);
  if (!usuario) return { ok: false, error: 'La llamada no trae el usuario del portal.', codigo: 'no_autorizado' };
  var acc = ACCIONES[p.accion];
  if (!acc) return { ok: false, error: 'acción desconocida: ' + texto_(p.accion) };

  // Solo las escrituras usan el ID de solicitud; sin ID, todo como antes.
  var idSol = acc.escribe ? texto_(p.idSolicitud) : '';
  if (idSol && !ID_SOLICITUD_VALIDO.test(idSol)) return { ok: false, error: 'El ID de solicitud no es válido.', codigo: 'id_invalido' };

  var lock = null;
  try {
    reiniciarCache_(true);
    if (acc.escribe) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return { ok: false, error: 'Otra persona está guardando en este momento. Espera unos segundos y vuelve a intentarlo.', codigo: 'ocupado' };
    }
    var datos = p.datos || {};
    // Idempotencia, DENTRO del lock: si este ID ya se procesó, no se ejecuta
    // nada y se devuelve lo que devolvió la primera vez.
    var sol = null, huella = '';
    if (idSol) {
      huella = huellaSolicitud_(p.accion, datos);
      sol = leerSolicitudesRecientes_();
      var previa = buscarSolicitud_(sol, idSol);
      if (previa) {
        if (texto_(previa['Huella']) !== huella || texto_(previa['Acción']) !== p.accion)
          throw new ErrorUsuario_('Esta solicitud ya se usó para otra operación distinta y no se volvió a ejecutar. Recarga la página y repite la acción.', 'id_repetido');
        if (acc.sinEstado) return { ok: true, resultado: resultadoGuardado_(previa), repetida: true };
        return { ok: true, resultado: resultadoGuardado_(previa), estado: accLeer_({}, usuario), repetida: true };
      }
    }
    var resultado = acc.fn(datos, usuario);
    if (idSol) registrarSolicitud_(sol, idSol, p.accion, huella, resultado, usuario);
    if (acc.escribe && !acc.sinEstado) {
      // El estado sale de las tablas en memoria (ya actualizadas por la
      // escritura); solo se leen las pestañas que la escritura no tocó.
      var estado = accLeer_({}, usuario);
      SpreadsheetApp.flush();
      return { ok: true, resultado: resultado, estado: estado };
    }
    if (acc.escribe) SpreadsheetApp.flush();
    return { ok: true, resultado: resultado };
  } catch (err) {
    if (err instanceof ErrorUsuario_) return { ok: false, error: err.message, codigo: err.codigo };
    return { ok: false, error: 'Error interno: ' + (err && err.message ? err.message : String(err)) };
  } finally {
    reiniciarCache_(false);
    if (lock) lock.releaseLock();
  }
}

// ─── Solicitudes: escrituras idempotentes ────────────────────────────────────
//
// La página manda en cada escritura un ID de solicitud único (el mismo si la
// misma acción se repite) y api.php, si se pierde la respuesta, repite el
// POST con ese ID. Aquí, dentro del lock, se mira si el ID ya se procesó:
// si sí, no se ejecuta nada y se devuelve el resultado guardado.
//
// DÓNDE: pestaña «Solicitudes» del mismo Sheet, una fila por escritura con ID:
// ID, acción, huella SHA-256 de (acción + datos), resultado (JSON corto),
// usuario y fecha. No se guardan los datos, solo su huella.
//   · No CacheService: puede olvidar una clave antes de tiempo, y un olvido
//     es justo un duplicado.
//   · No PropertiesService: tope de 500 KB, habría que podar, y sus
//     escrituras no van en el mismo orden que las del Sheet.
//   · En el Sheet, la fila del ID se escribe en la MISMA ejecución y bajo el
//     MISMO lock, inmediatamente DESPUÉS de las escrituras de la acción y
//     antes del flush. Sheets no tiene transacciones: si Google cortara la
//     ejecución justo entre las dos (milisegundos), quedaría la escritura sin
//     su ID y un reintento podría repetirla. Al revés (ID primero) el corte
//     dejaría un ID sin escritura, y el reintento diría «guardado» sin haber
//     guardado nada: es peor, por eso el ID va después.
//   · Si la acción falla con un error de negocio (clase llena, motivo
//     inválido…) no se escribe nada y el ID NO se registra: el reintento
//     vuelve a validar.
//
// CUÁNTO: la búsqueda mira las últimas VENTANA_SOLICITUDES filas (unos días
// de trabajo); un reintento llega en segundos. Las filas se quedan como
// registro técnico; la pestaña crece una fila por escritura (pocos KB al mes).
var VENTANA_SOLICITUDES = 500;
var MAX_RESULTADO = 2000;                          // caracteres del JSON guardado
var ID_SOLICITUD_VALIDO = /^[A-Za-z0-9-]{8,64}$/;

/** JSON con las claves ordenadas: los mismos datos dan siempre el mismo texto. */
function jsonEstable_(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Object.prototype.toString.call(v) === '[object Array]') return '[' + v.map(jsonEstable_).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + jsonEstable_(v[k]); }).join(',') + '}';
}

function huellaSolicitud_(accion, datos) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, accion + '\n' + jsonEstable_(datos), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Las últimas VENTANA_SOLICITUDES filas de Solicitudes, en una lectura. */
function leerSolicitudesRecientes_() {
  var hoja = hoja_('solicitudes');
  var t = titulos_(hoja, 'solicitudes');
  var ultima = hoja.getLastRow(), filas = [];
  if (ultima >= FILA_DATOS) {
    var desde = Math.max(FILA_DATOS, ultima - VENTANA_SOLICITUDES + 1);
    hoja.getRange(desde, 1, ultima - desde + 1, t.ancho).getValues().forEach(function (r, i) {
      var o = { _fila: desde + i };
      COLUMNAS.solicitudes.forEach(function (c) { o[c] = r[t.mapa[c] - 1]; });
      filas.push(o);
    });
  }
  return { hoja: hoja, mapa: t.mapa, filas: filas, ultimaFila: Math.max(ultima, FILA_TITULOS), ancho: t.ancho };
}

function buscarSolicitud_(sol, id) {
  for (var i = sol.filas.length - 1; i >= 0; i--) if (texto_(sol.filas[i]['ID solicitud']) === id) return sol.filas[i];
  return null;
}

function registrarSolicitud_(sol, id, accion, huella, resultado, usuario) {
  var json = JSON.stringify(resultado === undefined ? null : resultado);
  if (json.length > MAX_RESULTADO) json = JSON.stringify({ guardado: true, resultadoRecortado: true });
  agregarFilas_(sol, 'solicitudes', [{ 'ID solicitud': id, 'Acción': accion, 'Huella': huella, 'Resultado': json, 'Usuario': usuario, 'Fecha': new Date() }]);
}

function resultadoGuardado_(f) {
  try { return JSON.parse(texto_(f['Resultado']) || 'null'); } catch (e) { return { guardado: true }; }
}

/** Una fila de Historial. */
function historial_(usuario, accion, id, detalle) { historialVarios_(usuario, [[accion, id, detalle]]); }

/** Varias filas de Historial en una sola escritura: [[acción, ID, detalle], …]. */
function historialVarios_(usuario, filas) {
  if (!filas.length) return;
  var ahora = new Date();
  agregarFilas_(tablaParaAgregar_('historial'), 'historial', filas.map(function (r) {
    return { 'Fecha': ahora, 'Usuario': usuario, 'Acción': r[0], 'ID': r[1], 'Detalle': r[2] };
  }));
}


// ─── Fechas y ocupación ──────────────────────────────────────────────────────

/** 'yyyy-MM-dd' → 'dd/mm/yyyy', para los mensajes. */
function fechaCorta_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

/** Día de la semana de una fecha 'yyyy-MM-dd', en el vocabulario de Clases. No depende de zonas. */
function diaSemana_(iso) {
  var p = iso.split('-');
  return DIAS_ORDEN[(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() + 6) % 7];
}

/** ¿La inscripción ocupa cupo ese día? Alta <= día y (sin baja o baja > día). */
function inscripcionEnFecha_(f, iso) {
  var alta = aISO_(f['Fecha alta']), baja = aISO_(f['Fecha baja']);
  return (!alta || alta <= iso) && (!baja || baja > iso);
}

function pruebaOcupa_(f) { return PRUEBA_OCUPA.indexOf(texto_(f['Estado'])) >= 0; }

/** Tipo de una visita de un día. Vacío (las anteriores al 21-oct) = Prueba. */
function tipoVisita_(f) { return enLista_(f['Tipo'], TIPOS_VISITA) || TIPO_VISITA.prueba; }

/**
 * Ocupación de una clase en una fecha = inscripciones activas ese día +
 * visitas de un día (Prueba, Reposición, Eventual) Agendadas o Asistió de esa
 * clase ese día. excluirNino deja fuera las visitas de ese niño (para que su
 * propia visita no le cierre el cupo).
 * La página NO la recalcula: leer() la devuelve hecha (ocupacionVentana_).
 * «pruebas» es el total de visitas (nombre anterior, se conserva).
 */
function ocupacionEn_(codigo, iso, ins, pruebas, excluirNino) {
  var ids = [];
  ins.filas.forEach(function (f) {
    if (texto_(f['Código clase']) === codigo && inscripcionEnFecha_(f, iso)) ids.push(texto_(f['ID niño']));
  });
  var visitas = [], porTipo = {};
  pruebas.filas.forEach(function (f) {
    if (texto_(f['Clase ID']) === codigo && pruebaOcupa_(f) && aISO_(f['Fecha']) === iso &&
        !(excluirNino && texto_(f['Niño ID']) === excluirNino)) {
      visitas.push(texto_(f['ID prueba']));
      var t = tipoVisita_(f);
      porTipo[t] = (porTipo[t] || 0) + 1;
    }
  });
  return { inscritos: ids.length, pruebas: visitas.length, visitas: visitas.length, porTipo: porTipo,
           total: ids.length + visitas.length, idsInscritos: ids, idsVisitas: visitas };
}

/** «18 + 1 prueba de 20 cupos»; con reposiciones o eventuales, «18 + 3 visitas…». */
function textoOcupacion_(o, cupo) {
  var soloPruebas = (o.porTipo || {})[TIPO_VISITA.prueba] === o.pruebas;
  var palabra = soloPruebas ? (o.pruebas === 1 ? ' prueba' : ' pruebas') : (o.pruebas === 1 ? ' visita' : ' visitas');
  return o.inscritos + (o.pruebas ? ' + ' + o.pruebas + palabra : '') + ' de ' + cupo + ' cupos';
}

/* Días de ocupación que leer() devuelve ya calculados: dos semanas atrás y
   seis adelante, más cualquier fecha futura con visitas que ocupan. Fuera
   de eso la página pide la acción «ocupacion». */
var OCUPACION_ATRAS = 14, OCUPACION_ADELANTE = 41, OCUPACION_MAX_DIAS = 62;

/**
 * Ocupación por fecha y clase, calculada aquí (la página solo la pinta):
 *   { 'yyyy-MM-dd': { codigo: { i, v, tipos: {Prueba: n…}, ninos: [ID niño…], visitas: [ID prueba…] } } }
 * Solo las clases activas, cada una en los días de su semana.
 */
function ocupacionFechas_(fechas, clases, ins, pruebas) {
  // Las fechas de cada fila se convierten UNA vez (son cientos de días × clases).
  // Misma regla que ocupacionEn_; la prueba compara las dos.
  var insPorClase = {}, visPorClaseFecha = {};
  ins.filas.forEach(function (f) {
    var k = texto_(f['Código clase']);
    (insPorClase[k] = insPorClase[k] || []).push({ nino: texto_(f['ID niño']), alta: aISO_(f['Fecha alta']), baja: aISO_(f['Fecha baja']) });
  });
  pruebas.filas.forEach(function (f) {
    if (!pruebaOcupa_(f)) return;
    var k = texto_(f['Clase ID']) + '|' + aISO_(f['Fecha']);
    (visPorClaseFecha[k] = visPorClaseFecha[k] || []).push({ id: texto_(f['ID prueba']), tipo: tipoVisita_(f) });
  });
  var porDia = {};
  clases.filas.forEach(function (c) {
    if (norm_(c['Activa']) !== norm_(SI)) return;
    var d = enLista_(c['Día'], DIAS_ORDEN);
    if (d) (porDia[d] = porDia[d] || []).push(texto_(c['Código clase']));
  });
  var out = {};
  fechas.forEach(function (iso) {
    var delDia = {};
    (porDia[diaSemana_(iso)] || []).forEach(function (codigo) {
      var ninos = (insPorClase[codigo] || []).filter(function (x) { return (!x.alta || x.alta <= iso) && (!x.baja || x.baja > iso); })
        .map(function (x) { return x.nino; });
      var vis = visPorClaseFecha[codigo + '|' + iso] || [], tipos = {};
      vis.forEach(function (x) { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
      delDia[codigo] = { i: ninos.length, v: vis.length, tipos: tipos, ninos: ninos, visitas: vis.map(function (x) { return x.id; }) };
    });
    out[iso] = delDia;
  });
  return out;
}

function ocupacionVentana_(clases, ins, pruebas) {
  var hoy = hoyISO_(), fechas = {}, hasta = sumarDiasISO_(hoy, OCUPACION_ADELANTE);
  for (var d = sumarDiasISO_(hoy, -OCUPACION_ATRAS); d <= hasta; d = sumarDiasISO_(d, 1)) fechas[d] = true;
  pruebas.filas.forEach(function (f) { var d = aISO_(f['Fecha']); if (d > hasta && pruebaOcupa_(f)) fechas[d] = true; });
  return ocupacionFechas_(Object.keys(fechas).sort(), clases, ins, pruebas);
}

/** La clase existe, está activa y tiene un cupo válido. Devuelve { fila, cupo }. */
function claseUsable_(clases, codigo) {
  var c = buscarClase_(clases, codigo);
  if (norm_(c['Activa']) !== norm_(SI)) throw new ErrorUsuario_('La clase ' + codigo + ' no está activa.');
  var cupo = numeroDe_(c['Cupo']);
  if (!(cupo > 0)) throw new ErrorUsuario_('La clase ' + codigo + ' no tiene un cupo válido en la pestaña Clases.');
  return { fila: c, cupo: cupo };
}

/**
 * Cupo para una inscripción FIJA de idNino en codigo:
 *   1) los inscritos sin baja no llenan la clase (la regla de siempre);
 *   2) en cada fecha de hoy en adelante con pruebas que ocupan cupo, los
 *      inscritos de ese día + las pruebas + este niño no pasan del cupo.
 * Las pruebas del propio niño no cuentan contra él.
 */
function exigirCupoFijo_(clases, ins, pruebas, codigo, idNino) {
  var c = claseUsable_(clases, codigo);
  var res = ins.filas.filter(function (f) { return inscripcionActiva_(f) && texto_(f['Código clase']) === codigo; }).length;
  if (res >= c.cupo) throw new ErrorUsuario_('La clase ' + codigo + ' está llena: ' + res + ' de ' + c.cupo + ' cupos.', 'llena');
  var hoy = hoyISO_(), fechas = {};
  pruebas.filas.forEach(function (f) {
    if (texto_(f['Clase ID']) !== codigo || !pruebaOcupa_(f) || texto_(f['Niño ID']) === idNino) return;
    var d = aISO_(f['Fecha']);
    if (d >= hoy) fechas[d] = true;
  });
  Object.keys(fechas).sort().forEach(function (d) {
    var o = ocupacionEn_(codigo, d, ins, pruebas, idNino);
    if (o.total + 1 > c.cupo) throw new ErrorUsuario_('La clase ' + codigo + ' no tiene cupo el ' + fechaCorta_(d) +
      ' por las pruebas agendadas ese día (' + textoOcupacion_(o, c.cupo) + ').', 'llena');
  });
  return c.fila;
}


// ─── Lectura ─────────────────────────────────────────────────────────────────

function ninoPublico_(f) {
  return {
    id: texto_(f['ID']), socio: texto_(f['Número socio Poliwin']), nombre: texto_(f['Nombre']),
    apellidos: texto_(f['Apellidos']), nacimiento: aISO_(f['Fecha nacimiento']), sexo: texto_(f['Sexo']),
    responsable: texto_(f['Nombre responsable']), telefono: texto_(f['Teléfono']),
    telefono2: texto_(f['Teléfono 2']), correo: texto_(f['Correo']),
    cabeza: texto_(f['Cabeza de familia']), estado: texto_(f['Estado']),
    ingreso: aISO_(f['Fecha ingreso']), notas: texto_(f['Notas']),
    colegio: texto_(f['Colegio']), comoConocio: texto_(f['Cómo nos conoció']),
    referido: texto_(f['Familia que lo refirió']), hermanos: texto_(f['Hermanos (edades)']),
    interes: texto_(f['Interés en otros servicios']), responsable2: texto_(f['Responsable 2']),
    telefonoResp2: texto_(f['Teléfono responsable 2'])
  };
}

function clasePublica_(f) {
  return {
    codigo: texto_(f['Código clase']), servicio: texto_(f['Servicio']), modalidad: texto_(f['Modalidad']),
    dia: enLista_(f['Día'], DIAS_ORDEN) || texto_(f['Día']), hora: aHora_(f['Hora inicio']),
    cupo: numeroDe_(f['Cupo']), edades: texto_(f['Edades']),
    activa: norm_(f['Activa']) === norm_(SI)
  };
}

function inscripcionActiva_(f) { return texto_(f['Fecha baja']) === '' ; }

function pagoPublico_(f) {
  return {
    id: texto_(f['ID pago']), idNino: texto_(f['ID niño']), mes: aMes_(f['Mes que cubre']),
    concepto: texto_(f['Concepto']), plan: texto_(f['Plan']), monto: numeroDe_(f['Monto']),
    fecha: aISO_(f['Fecha pago']), forma: texto_(f['Forma de pago']),
    registradoPor: texto_(f['Registrado por']), notas: texto_(f['Notas'])
  };
}

function pruebaPublica_(f) {
  return {
    id: texto_(f['ID prueba']), fecha: aISO_(f['Fecha']), codigo: texto_(f['Clase ID']), idNino: texto_(f['Niño ID']),
    estado: texto_(f['Estado']), seInscribio: texto_(f['Se inscribió']), motivo: texto_(f['Motivo no inscripción']),
    nota: texto_(f['Nota']), registradoPor: texto_(f['Registrado por']),
    pago: texto_(f['Pagó']), monto: texto_(f['Monto pagado']) === '' ? null : numeroDe_(f['Monto pagado']),
    tipo: tipoVisita_(f), repone: texto_(f['Repone asistencia']), porLista: texto_(f['Resultado por lista']) === SI
  };
}

/**
 * Todo lo que la página necesita en una sola llamada. Las inscripciones van
 * en dos listas: las activas (con todo lo que usan Registrar y Pagos) y las
 * cerradas (solo clase, alta y baja), que la página usa para la ocupación de
 * fechas pasadas.
 */
function accLeer_(datos, usuario) {
  var clases = leerTabla_('clases').filas.map(clasePublica_);
  var ninos = leerTabla_('ninos').filas.map(ninoPublico_);
  var ins = [], cerradas = [];
  leerTabla_('inscripciones').filas.forEach(function (f) {
    if (inscripcionActiva_(f)) ins.push({ id: texto_(f['ID inscripción']), idNino: texto_(f['ID niño']),
      codigo: texto_(f['Código clase']), alta: aISO_(f['Fecha alta']), nota: texto_(f['Notas']) });
    else cerradas.push({ idNino: texto_(f['ID niño']), codigo: texto_(f['Código clase']),
      alta: aISO_(f['Fecha alta']), baja: aISO_(f['Fecha baja']) });
  });
  var cuenta = {};
  ins.forEach(function (i) { cuenta[i.codigo] = (cuenta[i.codigo] || 0) + 1; });
  clases.forEach(function (c) { c.reservados = cuenta[c.codigo] || 0; });
  var mes = mesISO_();
  var pagos = leerTabla_('pagos').filas.map(pagoPublico_).filter(function (p) { return p.mes === mes; });
  return {
    archivo: libro_().getName(), usuario: usuario, hoy: hoyISO_(), mes: mes,
    config: leerConfig_(), clases: clases, ninos: ninos, inscripciones: ins, inscripcionesCerradas: cerradas,
    pruebas: leerTabla_('pruebas').filas.map(pruebaPublica_), pagosMes: pagos,
    // 27-oct (v10): las bajas totales, para el Resumen. Solo ID y fecha (ni motivo ni detalle).
    bajas: leerTabla_('bajas').filas.map(function (f) { return { idNino: texto_(f['ID niño']), fecha: aISO_(f['Fecha baja']) }; }),
    // 21-oct: la ocupación la calcula el servidor; la página solo la pinta.
    ocupacion: ocupacionVentana_(leerTabla_('clases'), leerTabla_('inscripciones'), leerTabla_('pruebas')),
    estados: [ESTADO.activo, ESTADO.revisar, ESTADO.prospecto, ESTADO.eventual, ESTADO.retirado], motivoCambio: MOTIVO_CAMBIO_CLASE,
    estadosPrueba: [ESTADO_PRUEBA.agendada, ESTADO_PRUEBA.asistio, ESTADO_PRUEBA.noAsistio, ESTADO_PRUEBA.cancelada],
    pruebaOcupa: PRUEBA_OCUPA, dias: DIAS_ORDEN, tiposVisita: TIPOS_VISITA, estadosAsistencia: ESTADOS_ASIS
  };
}

/** El día del primer registro de Inscripciones (la carga inicial), o hoy si no hay. */
function primerRegistro_() {
  var min = '';
  leerTabla_('inscripciones').filas.forEach(function (f) {
    var d = aISO_(f['Fecha registro']);
    if (d && (!min || d < min)) min = d;
  });
  return min || hoyISO_();
}

/** Ocupación de otras fechas (la página navega semanas fuera de la ventana de leer). */
function accOcupacion_(datos) {
  var desde = aISO_(exigirFecha_(datos.desde, 'la fecha desde')), hasta = aISO_(exigirFecha_(datos.hasta, 'la fecha hasta'));
  if (hasta < desde) throw new ErrorUsuario_('La fecha hasta es anterior a la fecha desde.');
  var fechas = [];
  for (var d = desde; d <= hasta; d = sumarDiasISO_(d, 1)) {
    fechas.push(d);
    if (fechas.length > OCUPACION_MAX_DIAS) throw new ErrorUsuario_('Se piden como mucho ' + OCUPACION_MAX_DIAS + ' días de ocupación.');
  }
  return { ocupacion: ocupacionFechas_(fechas, leerTabla_('clases'), leerTabla_('inscripciones'), leerTabla_('pruebas')) };
}

function accListarPagos_(datos) {
  var mes = aMes_(datos.mes);
  if (!mes) throw new ErrorUsuario_('El mes tiene que venir como AAAA-MM.');
  return { mes: mes, pagos: leerTabla_('pagos').filas.map(pagoPublico_).filter(function (p) { return p.mes === mes; }) };
}


// ─── Validaciones comunes ────────────────────────────────────────────────────

function exigirFecha_(v, nombre) {
  var d = fechaDeTexto_(v);
  if (!d) throw new ErrorUsuario_('Falta ' + nombre + ' o no es una fecha válida.');
  return d;
}

function exigirMotivo_(v, cfg) {
  if (!texto_(v)) throw new ErrorUsuario_('Falta el motivo de la baja.');
  var m = enLista_(v, cfg.motivos);
  if (!m) throw new ErrorUsuario_('El motivo «' + texto_(v) + '» no está en la lista de Config.');
  return m;
}

function buscarNino_(tabla, id) {
  id = texto_(id);
  for (var i = 0; i < tabla.filas.length; i++) if (texto_(tabla.filas[i]['ID']) === id) return tabla.filas[i];
  throw new ErrorUsuario_('No existe el niño ' + (id || '(sin ID)') + '.');
}

function buscarClase_(tabla, codigo) {
  codigo = texto_(codigo);
  for (var i = 0; i < tabla.filas.length; i++) if (texto_(tabla.filas[i]['Código clase']) === codigo) return tabla.filas[i];
  throw new ErrorUsuario_('No existe la clase ' + (codigo || '(sin código)') + '.');
}

function buscarPrueba_(tabla, id) {
  id = texto_(id);
  for (var i = 0; i < tabla.filas.length; i++) if (texto_(tabla.filas[i]['ID prueba']) === id) return tabla.filas[i];
  throw new ErrorUsuario_('No existe la prueba ' + (id || '(sin ID)') + '.');
}

function nombreDe_(f) { return (texto_(f['Nombre']) + ' ' + texto_(f['Apellidos'])).trim(); }

var CAMPOS_NINO = {
  socio: 'Número socio Poliwin', nombre: 'Nombre', apellidos: 'Apellidos', nacimiento: 'Fecha nacimiento',
  sexo: 'Sexo', responsable: 'Nombre responsable', telefono: 'Teléfono', telefono2: 'Teléfono 2',
  correo: 'Correo', cabeza: 'Cabeza de familia', ingreso: 'Fecha ingreso', notas: 'Notas',
  colegio: 'Colegio', comoConocio: 'Cómo nos conoció', referido: 'Familia que lo refirió',
  hermanos: 'Hermanos (edades)', interes: 'Interés en otros servicios', responsable2: 'Responsable 2',
  telefonoResp2: 'Teléfono responsable 2'
};
var SEPARADOR_INTERES = ', ';

function valoresNino_(entrada, parcial) {
  var out = {};
  Object.keys(CAMPOS_NINO).forEach(function (k) {
    if (!(k in entrada)) { if (!parcial) out[CAMPOS_NINO[k]] = ''; return; }
    if (k === 'interes') {
      var esLista = Object.prototype.toString.call(entrada[k]) === '[object Array]';
      if (esLista) entrada[k].forEach(function (x) {
        if (texto_(x).indexOf(',') >= 0) throw new ErrorUsuario_('El servicio de interés «' + texto_(x) +
          '» tiene una coma, y los intereses se guardan separados por coma. Quita la coma de ese valor en la lista «' + LISTA.interes + '» de Config.');
      });
      var lista = esLista ? entrada[k] : texto_(entrada[k]).split(',');
      out[CAMPOS_NINO[k]] = lista.map(texto_).filter(function (x) { return x; }).join(SEPARADOR_INTERES);
      return;
    }
    var v = texto_(entrada[k]);
    if (k === 'nacimiento' || k === 'ingreso') {
      if (v === '') { out[CAMPOS_NINO[k]] = ''; return; }
      var d = fechaDeTexto_(v);
      if (!d) throw new ErrorUsuario_('La ' + (k === 'nacimiento' ? 'fecha de nacimiento' : 'fecha de ingreso') + ' no es válida.');
      out[CAMPOS_NINO[k]] = d;
    } else out[CAMPOS_NINO[k]] = v;
  });
  return out;
}

/**
 * «Cómo nos conoció» y «Interés en otros servicios» tienen que venir de las
 * listas de Config. Se valida solo lo que cambia: un valor viejo que Vida en
 * Arte haya sacado de la lista no impide editar otro dato del niño. Devuelve
 * los valores con la grafía de Config.
 */
function validarListasNino_(valores, cfg) {
  var col = CAMPOS_NINO.comoConocio;
  if (col in valores && valores[col]) {
    var v = enLista_(valores[col], cfg.comoConocio);
    if (!v) throw new ErrorUsuario_('«' + valores[col] + '» no está en la lista «' + LISTA.comoConocio + '» de Config.');
    valores[col] = v;
  }
  col = CAMPOS_NINO.interes;
  if (col in valores && valores[col]) {
    valores[col] = valores[col].split(SEPARADOR_INTERES).map(function (x) {
      var v = enLista_(x, cfg.intereses);
      if (!v) throw new ErrorUsuario_('«' + x + '» no está en la lista «' + LISTA.interes + '» de Config.');
      return v;
    }).join(SEPARADOR_INTERES);
  }
}

/** Avisa si ya hay un niño con el mismo nombre y apellidos (salvo que se confirme). */
function exigirNoDuplicado_(t, valores, confirmado) {
  if (confirmado) return;
  var nuevo = norm_(valores['Nombre'] + ' ' + valores['Apellidos']);
  var igual = t.filas.filter(function (f) { return norm_(nombreDe_(f)) === nuevo; });
  if (igual.length) throw new ErrorUsuario_('Ya existe ' + igual.map(function (f) {
    return texto_(f['ID']) + ' ' + nombreDe_(f) + ' (' + texto_(f['Estado']) + ')'; }).join(', ') +
    '. Si es otro niño con el mismo nombre, confirma para crearlo igual.', 'duplicado');
}

/** Escribe un niño nuevo con el siguiente AS-xxxx. No valida: eso va antes. */
function agregarNino_(t, valores, estado) {
  var id = siguienteId_(t.filas, 'ID', PREFIJO.nino)();
  valores['ID'] = id;
  valores['Estado'] = estado;
  agregarFilas_(t, 'ninos', [valores]);
  return id;
}


// ─── Escrituras ──────────────────────────────────────────────────────────────

function accCrearNino_(datos, usuario) {
  var valores = valoresNino_(datos.nino || {}, false);
  if (!valores['Nombre']) throw new ErrorUsuario_('El nombre es obligatorio.');
  validarListasNino_(valores, leerConfig_());
  var t = leerTabla_('ninos');
  exigirNoDuplicado_(t, valores, datos.confirmarDuplicado);
  if (!valores['Fecha ingreso']) valores['Fecha ingreso'] = fechaDeTexto_(hoyISO_());
  var id = agregarNino_(t, valores, ESTADO.activo);
  historial_(usuario, 'Crear niño', id, nombreDe_(valores));
  return { id: id };
}

function accEditarNino_(datos, usuario) {
  var t = leerTabla_('ninos');
  var f = buscarNino_(t, datos.id);
  var cambios = valoresNino_(datos.cambios || {}, true);
  if ('Nombre' in cambios && !cambios['Nombre']) throw new ErrorUsuario_('El nombre no puede quedar vacío.');
  var detalle = [];
  Object.keys(cambios).forEach(function (col) {
    var antes = COLUMNAS_FECHA.ninos.indexOf(col) >= 0 ? aISO_(f[col]) : texto_(f[col]);
    var despues = COLUMNAS_FECHA.ninos.indexOf(col) >= 0 ? aISO_(cambios[col]) : texto_(cambios[col]);
    if (antes === despues) delete cambios[col]; else detalle.push(col);
  });
  if (detalle.length) validarListasNino_(cambios, leerConfig_());
  if (datos.reactivar) {
    if (texto_(f['Estado']) !== ESTADO.retirado) throw new ErrorUsuario_('Solo se reactiva a un niño Retirado.');
    cambios['Estado'] = ESTADO.activo;
    detalle.push('Estado → Activo');
  }
  if (!detalle.length) return { id: texto_(f['ID']), sinCambios: true };
  ponerCeldas_(t, f, cambios);
  historial_(usuario, datos.reactivar ? 'Reactivar niño' : 'Editar niño', texto_(f['ID']), detalle.join(', '));
  return { id: texto_(f['ID']) };
}

/**
 * Inscribe a un niño en una o varias clases. TODO O NADA: primero se valida
 * cada clase (que exista, esté activa, el niño no esté ya, haya cupo hoy y en
 * las fechas con pruebas) y, si alguna falla, no se escribe ninguna y el
 * error dice cuál y por qué. Todo ocurre bajo el lock de atender_().
 * La fecha de alta no puede ser futura. Un Prospecto pasa a Activo.
 */
function inscribirEn_(datos, codigos, usuario) {
  var ninos = leerTabla_('ninos'), clases = leerTabla_('clases'), ins = leerTabla_('inscripciones'), pruebas = leerTabla_('pruebas');
  var n = buscarNino_(ninos, datos.idNino), idNino = texto_(n['ID']);
  if (texto_(n['Estado']) === ESTADO.retirado)
    throw new ErrorUsuario_(nombreDe_(n) + ' está Retirado. Reactívalo antes de inscribirlo.');
  var lista = [];
  (codigos || []).forEach(function (c) { c = texto_(c); if (c && lista.indexOf(c) < 0) lista.push(c); });
  if (!lista.length) throw new ErrorUsuario_('Elige al menos una clase.');
  var alta = datos.fechaAlta ? exigirFecha_(datos.fechaAlta, 'la fecha de alta') : fechaDeTexto_(hoyISO_());
  exigirNoFutura_(alta, 'de alta');

  var errores = [], codigoError = '';
  lista.forEach(function (codigo) {
    try {
      var ya = ins.filas.some(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === idNino && texto_(f['Código clase']) === codigo; });
      if (ya) throw new ErrorUsuario_(nombreDe_(n) + ' ya está inscrito en ' + codigo + '.');
      exigirCupoFijo_(clases, ins, pruebas, codigo, idNino);
    } catch (e) {
      if (!(e instanceof ErrorUsuario_)) throw e;
      errores.push(e.message);
      codigoError = codigoError || e.codigo;
    }
  });
  if (errores.length) {
    if (lista.length === 1) throw new ErrorUsuario_(errores[0] + ' No se inscribió.', codigoError);
    throw new ErrorUsuario_('No se inscribió en ninguna de las ' + lista.length + ' clases. ' + errores.join(' · '), codigoError || 'varias');
  }

  // Todo validado: ahora se escribe, en una sola escritura.
  var sig = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion), ahora = new Date();
  var nuevas = lista.map(function (codigo) {
    return { 'ID inscripción': sig(), 'ID niño': idNino, 'Código clase': codigo, 'Fecha alta': alta,
             'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': '', 'Registrado por': usuario, 'Fecha registro': ahora };
  });
  agregarFilas_(ins, 'inscripciones', nuevas);
  var hist = nuevas.map(function (f) { return ['Inscribir', f['ID inscripción'], idNino + ' en ' + f['Código clase']]; });
  var estadoAntes = texto_(n['Estado']);
  if (estadoAntes === ESTADO.prospecto || estadoAntes === ESTADO.eventual) {
    var cambios = { 'Estado': ESTADO.activo };
    if (!aISO_(n['Fecha ingreso'])) cambios['Fecha ingreso'] = alta;
    ponerCeldas_(ninos, n, cambios);
    hist.push([estadoAntes + ' → Activo', idNino, 'al inscribirse en ' + lista.join(', ')]);
  }
  historialVarios_(usuario, hist);
  return { ids: nuevas.map(function (f) { return f['ID inscripción']; }) };
}

function accInscribir_(datos, usuario) {
  return { id: inscribirEn_(datos, [datos.codigo], usuario).ids[0] };
}

function accInscribirVarias_(datos, usuario) {
  return inscribirEn_(datos, datos.codigos, usuario);
}

function buscarInscripcionActiva_(ins, id) {
  id = texto_(id);
  for (var i = 0; i < ins.filas.length; i++) {
    var f = ins.filas[i];
    if (texto_(f['ID inscripción']) === id) {
      if (!inscripcionActiva_(f)) throw new ErrorUsuario_('La inscripción ' + id + ' ya estaba dada de baja.');
      return f;
    }
  }
  throw new ErrorUsuario_('No existe la inscripción ' + (id || '(sin ID)') + '.');
}

/**
 * Ni las bajas ni las altas pueden ser futuras. Una inscripción con fecha de
 * baja deja de contar al momento, así que una baja «a fin de mes» liberaría
 * el cupo hoy; y un alta futura se registra el día que el niño empieza (o se
 * agenda como prueba).
 */
function exigirNoFutura_(fecha, que) {
  if (Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') > hoyISO_())
    throw new ErrorUsuario_('La fecha ' + que + ' no puede ser posterior a hoy: regístrala el día que ocurra.');
}

function exigirBajaNoAntesDeAlta_(f, fecha) {
  exigirNoFutura_(fecha, 'de baja');
  var alta = aISO_(f['Fecha alta']);
  if (alta && Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd') < alta)
    throw new ErrorUsuario_('La fecha de baja no puede ser anterior a la de alta (' + alta + ') en ' + texto_(f['Código clase']) + '.');
}

function accMover_(datos, usuario) {
  var clases = leerTabla_('clases'), ins = leerTabla_('inscripciones'), ninos = leerTabla_('ninos'), pruebas = leerTabla_('pruebas');
  var vieja = buscarInscripcionActiva_(ins, datos.idInscripcion);
  var nueva = texto_(datos.codigoNuevo);
  if (nueva === texto_(vieja['Código clase'])) throw new ErrorUsuario_('La clase nueva es la misma que la actual.');
  var idNino = texto_(vieja['ID niño']);
  buscarNino_(ninos, idNino);
  var ya = ins.filas.some(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === idNino && texto_(f['Código clase']) === nueva; });
  if (ya) throw new ErrorUsuario_('El niño ya está inscrito en ' + nueva + '.');
  var fecha = exigirFecha_(datos.fecha, 'la fecha del cambio');
  exigirNoFutura_(fecha, 'del cambio');
  exigirCupoFijo_(clases, ins, pruebas, nueva, idNino);
  exigirBajaNoAntesDeAlta_(vieja, fecha);
  var id = siguienteId_(ins.filas, 'ID inscripción', PREFIJO.inscripcion)();
  // Todo validado: ahora se escribe.
  ponerCeldas_(ins, vieja, { 'Fecha baja': fecha, 'Motivo baja': MOTIVO_CAMBIO_CLASE, 'Detalle motivo': 'A ' + nueva + (texto_(datos.detalle) ? ' · ' + texto_(datos.detalle) : '') });
  agregarFilas_(ins, 'inscripciones', [{
    'ID inscripción': id, 'ID niño': idNino, 'Código clase': nueva, 'Fecha alta': fecha,
    'Fecha baja': '', 'Motivo baja': '', 'Detalle motivo': 'Viene de ' + texto_(vieja['Código clase']),
    'Registrado por': usuario, 'Fecha registro': new Date()
  }]);
  historial_(usuario, 'Mover de clase', idNino, texto_(vieja['Código clase']) + ' → ' + nueva + ' (' + texto_(vieja['ID inscripción']) + ' → ' + id + ')');
  return { id: id };
}

function accBajaClase_(datos, usuario) {
  var cfg = leerConfig_(), ins = leerTabla_('inscripciones');
  var f = buscarInscripcionActiva_(ins, datos.idInscripcion);
  var fecha = exigirFecha_(datos.fecha, 'la fecha de baja');
  var motivo = exigirMotivo_(datos.motivo, cfg);
  exigirBajaNoAntesDeAlta_(f, fecha);
  ponerCeldas_(ins, f, { 'Fecha baja': fecha, 'Motivo baja': motivo, 'Detalle motivo': texto_(datos.detalle) });
  historial_(usuario, 'Baja de clase', texto_(f['ID niño']), texto_(f['Código clase']) + ' · ' + motivo);
  return { id: texto_(f['ID inscripción']) };
}

var NOTA_CANCELADA_POR_BAJA = 'Cancelada por baja total';

/**
 * Retira al niño del todo: cierra sus inscripciones, Estado Retirado, fila en
 * Bajas, y CANCELA sus pruebas Agendadas de hoy en adelante (liberan el cupo
 * de ese día). Las pruebas pasadas y las que ya tienen resultado no se tocan.
 * Todo en la misma llamada, bajo el lock de atender_(). Lo usan la baja total
 * y «Por revisar → Retirado». La baja de UNA clase no cancela pruebas.
 */
function retirar_(idNino, fechaTxt, motivoTxt, detalle, usuario, accion) {
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), ins = leerTabla_('inscripciones'), pruebas = leerTabla_('pruebas');
  var n = buscarNino_(ninos, idNino), id = texto_(n['ID']);
  if (texto_(n['Estado']) === ESTADO.retirado) throw new ErrorUsuario_(nombreDe_(n) + ' ya está Retirado.');
  var fecha = exigirFecha_(fechaTxt, 'la fecha de baja');
  var motivo = exigirMotivo_(motivoTxt, cfg);
  var activas = ins.filas.filter(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === id; });
  activas.forEach(function (f) { exigirBajaNoAntesDeAlta_(f, fecha); });
  var hoy = hoyISO_();
  var aCancelar = pruebas.filas.filter(function (f) {
    return texto_(f['Niño ID']) === id && texto_(f['Estado']) === ESTADO_PRUEBA.agendada && aISO_(f['Fecha']) >= hoy;
  });
  // Todo validado: ahora se escribe.
  activas.forEach(function (f) {
    ponerCeldas_(ins, f, { 'Fecha baja': fecha, 'Motivo baja': motivo, 'Detalle motivo': texto_(detalle) });
  });
  var hist = [];
  aCancelar.forEach(function (f) {
    var nota = texto_(f['Nota']);
    ponerCeldas_(pruebas, f, { 'Estado': ESTADO_PRUEBA.cancelada, 'Nota': nota ? nota + ' · ' + NOTA_CANCELADA_POR_BAJA : NOTA_CANCELADA_POR_BAJA });
    hist.push(['Cancelar prueba', texto_(f['ID prueba']), id + ' · ' + texto_(f['Clase ID']) + ' · ' + fechaCorta_(aISO_(f['Fecha'])) + ' · ' + NOTA_CANCELADA_POR_BAJA]);
  });
  ponerCeldas_(ninos, n, { 'Estado': ESTADO.retirado });
  agregarFilas_(tablaParaAgregar_('bajas'), 'bajas', [{ 'ID niño': id, 'Fecha baja': fecha, 'Motivo': motivo, 'Detalle': texto_(detalle), 'Registrado por': usuario }]);
  hist.unshift([accion, id, motivo + ' · ' + activas.length + ' clase(s) cerradas' + (aCancelar.length ? ' · ' + aCancelar.length + ' prueba(s) canceladas' : '')]);
  historialVarios_(usuario, hist);
  return { id: id, clasesCerradas: activas.length, pruebasCanceladas: aCancelar.length };
}

function accBajaTotal_(datos, usuario) {
  return retirar_(datos.idNino, datos.fecha, datos.motivo, datos.detalle, usuario, 'Baja total');
}

function accRevisar_(datos, usuario) {
  var ninos = leerTabla_('ninos');
  var n = buscarNino_(ninos, datos.idNino);
  if (texto_(n['Estado']) !== ESTADO.revisar) throw new ErrorUsuario_(nombreDe_(n) + ' ya no está «Por revisar» (está ' + texto_(n['Estado']) + ').');
  if (datos.estado === ESTADO.activo) {
    ponerCeldas_(ninos, n, { 'Estado': ESTADO.activo });
    historial_(usuario, 'Revisado → Activo', texto_(n['ID']), '');
    return { id: texto_(n['ID']), estado: ESTADO.activo };
  }
  if (datos.estado === ESTADO.retirado) {
    var r = retirar_(datos.idNino, datos.fecha, datos.motivo, datos.detalle, usuario, 'Revisado → Retirado');
    r.estado = ESTADO.retirado;
    return r;
  }
  throw new ErrorUsuario_('El estado tiene que ser Activo o Retirado.');
}

function accRegistrarPago_(datos, usuario) {
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), pagos = leerTabla_('pagos');
  var n = buscarNino_(ninos, datos.idNino);
  var mes = aMes_(datos.mes);
  if (!mes) throw new ErrorUsuario_('Falta el mes que cubre (AAAA-MM).');
  var concepto = enLista_(datos.concepto, cfg.conceptos);
  if (!concepto) throw new ErrorUsuario_('Falta el concepto o no está en la lista de Config.');
  var plan = '';
  if (texto_(datos.plan)) {
    var p = enLista_(datos.plan, cfg.planes.map(function (x) { return x.nombre; }));
    if (!p) throw new ErrorUsuario_('El plan «' + texto_(datos.plan) + '» no está en la lista de Config.');
    plan = p;
  }
  var monto = numeroDe_(datos.monto);
  if (!(monto > 0)) throw new ErrorUsuario_('El monto tiene que ser un número mayor que cero.');
  monto = Math.round(monto * 100) / 100;
  var fecha = exigirFecha_(datos.fechaPago, 'la fecha de pago');
  var forma = enLista_(datos.forma, cfg.formas);
  if (!forma) throw new ErrorUsuario_('Falta la forma de pago o no está en la lista de Config.');
  if (!datos.confirmarDuplicado) {
    var previos = pagos.filas.filter(function (f) {
      return texto_(f['ID niño']) === texto_(n['ID']) && aMes_(f['Mes que cubre']) === mes && norm_(f['Concepto']) === norm_(concepto);
    });
    if (previos.length) throw new ErrorUsuario_(nombreDe_(n) + ' ya tiene ' + previos.length + ' pago(s) de ' + concepto +
      ' para ' + mes + ' (' + previos.map(function (f) { return texto_(f['ID pago']) + ' por ' + numeroDe_(f['Monto']); }).join(', ') +
      '). Confirma si es un pago adicional.', 'duplicado');
  }
  var id = siguienteId_(pagos.filas, 'ID pago', PREFIJO.pago)();
  agregarFilas_(pagos, 'pagos', [{
    'ID pago': id, 'ID niño': texto_(n['ID']), 'Mes que cubre': mes, 'Concepto': concepto, 'Plan': plan,
    'Monto': monto, 'Fecha pago': fecha, 'Forma de pago': forma, 'Registrado por': usuario, 'Notas': texto_(datos.notas)
  }]);
  historial_(usuario, 'Registrar pago', id, texto_(n['ID']) + ' · ' + mes + ' · ' + concepto + ' · ' + monto);
  return { id: id };
}

/** Cambia o quita la nota de una inscripción activa (p. ej. la de clase de adultos ya verificada). */
function accNotaInscripcion_(datos, usuario) {
  var ins = leerTabla_('inscripciones');
  var f = buscarInscripcionActiva_(ins, datos.idInscripcion);
  var antes = texto_(f['Notas']), despues = texto_(datos.nota);
  if (antes === despues) return { id: texto_(f['ID inscripción']), sinCambios: true };
  ponerCeldas_(ins, f, { 'Notas': despues });
  historial_(usuario, despues ? 'Nota de inscripción' : 'Quitar nota de inscripción', texto_(f['ID niño']),
    texto_(f['ID inscripción']) + ' · ' + texto_(f['Código clase']) + ' · antes: «' + antes + '»' + (despues ? ' · ahora: «' + despues + '»' : ''));
  return { id: texto_(f['ID inscripción']) };
}


// ─── Clases de prueba ────────────────────────────────────────────────────────

/* Datos obligatorios para crear un Prospecto desde una prueba. */
var OBLIGATORIOS_PROSPECTO = ['nombre', 'apellidos', 'nacimiento', 'responsable', 'telefono'];

/**
 * Lo común a toda visita de un día (Prueba, Reposición, Eventual):
 *   · fecha de hoy en adelante, y que caiga el día de la semana de la clase;
 *   · la clase activa (el cupo se mira después, con exigirCupoVisita_).
 * «palabra» va en el mensaje: «La prueba…», «La visita…».
 */
function validarFechaVisita_(datos, clases, palabra) {
  var fecha = exigirFecha_(datos.fecha, 'la fecha de la ' + palabra.toLowerCase());
  var iso = Utilities.formatDate(fecha, zona_(), 'yyyy-MM-dd');
  if (iso < hoyISO_()) throw new ErrorUsuario_('La ' + palabra.toLowerCase() + ' no puede ser en una fecha pasada.');
  var codigo = texto_(datos.codigo);
  var c = claseUsable_(clases, codigo);
  var dia = enLista_(c.fila['Día'], DIAS_ORDEN);
  if (diaSemana_(iso) !== dia) {
    var d = (dia || texto_(c.fila['Día'])).toLowerCase();
    throw new ErrorUsuario_('La clase ' + codigo + ' es los ' + (/s$/.test(d) ? d : d + 's') +
      ' y el ' + fechaCorta_(iso) + ' es ' + diaSemana_(iso).toLowerCase() + '.');
  }
  return { fecha: fecha, iso: iso, codigo: codigo, c: c };
}

/** El niño no está inscrito en esa clase ni tiene otra visita que ocupa ese día en ella. */
function exigirNinoLibreEn_(n, codigo, iso, ins, pruebas, palabra) {
  var idN = texto_(n['ID']);
  if (ins.filas.some(function (f) { return inscripcionActiva_(f) && texto_(f['ID niño']) === idN && texto_(f['Código clase']) === codigo; }))
    throw new ErrorUsuario_(nombreDe_(n) + ' ya está inscrito en ' + codigo + '.');
  if (pruebas.filas.some(function (f) { return texto_(f['Niño ID']) === idN && texto_(f['Clase ID']) === codigo && aISO_(f['Fecha']) === iso && pruebaOcupa_(f); }))
    throw new ErrorUsuario_(nombreDe_(n) + ' ya tiene una ' + palabra + ' en ' + codigo + ' el ' + fechaCorta_(iso) + '.');
}

/** Cupo de ese día: inscritos + visitas que ocupan < cupo. */
function exigirCupoVisita_(v, ins, pruebas) {
  var o = ocupacionEn_(v.codigo, v.iso, ins, pruebas);
  if (o.total >= v.c.cupo) throw new ErrorUsuario_('La clase ' + v.codigo + ' está llena el ' + fechaCorta_(v.iso) + ': ' +
    textoOcupacion_(o, v.c.cupo) + '. No se agendó.', 'llena');
}

/** Datos de un niño nuevo de una visita (Prueba o Eventual): los mismos obligatorios. */
function valoresNinoVisita_(datos, cfg, ninos) {
  var entrada = datos.nino || {};
  var faltan = OBLIGATORIOS_PROSPECTO.filter(function (k) { return !texto_(entrada[k]); });
  if (faltan.length) throw new ErrorUsuario_('Faltan datos obligatorios del niño: ' +
    faltan.map(function (k) { return CAMPOS_NINO[k].toLowerCase(); }).join(', ') + '.');
  var valores = valoresNino_(entrada, false);
  validarListasNino_(valores, cfg);
  exigirNoDuplicado_(ninos, valores, datos.confirmarDuplicado);
  return valores;
}

/** Escribe la fila de la visita y devuelve su ID (PRU-xxxx para los tres tipos). */
function escribirVisita_(pruebas, v, idNino, tipo, extra, nota, usuario) {
  var id = siguienteId_(pruebas.filas, 'ID prueba', PREFIJO.prueba)();
  var fila = {
    'ID prueba': id, 'Fecha': v.fecha, 'Clase ID': v.codigo, 'Niño ID': idNino, 'Estado': ESTADO_PRUEBA.agendada,
    'Se inscribió': '', 'Motivo no inscripción': '', 'Nota': texto_(nota),
    'Registrado por': usuario, 'Fecha de registro': new Date(), 'Tipo': tipo, 'Repone asistencia': '', 'Resultado por lista': ''
  };
  Object.keys(extra || {}).forEach(function (k) { fila[k] = extra[k]; });
  agregarFilas_(pruebas, 'pruebas', [fila]);
  return id;
}

/**
 * Agenda una clase de prueba (visita de tipo Prueba). Ocupa un cupo de esa
 * clase ESE día. El niño: uno existente (idNino) o uno nuevo, que se crea
 * como Prospecto. Todo se valida antes de escribir.
 */
function accAgendarPrueba_(datos, usuario) {
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), clases = leerTabla_('clases');
  var ins = leerTabla_('inscripciones'), pruebas = leerTabla_('pruebas');
  var v = validarFechaVisita_(datos, clases, 'Prueba');
  var n = null, valores = null;
  if (texto_(datos.idNino)) {
    n = buscarNino_(ninos, datos.idNino);
    exigirNinoLibreEn_(n, v.codigo, v.iso, ins, pruebas, 'prueba');
  } else valores = valoresNinoVisita_(datos, cfg, ninos);
  exigirCupoVisita_(v, ins, pruebas);

  // Todo validado: ahora se escribe.
  var hist = [], idNino;
  if (n) idNino = texto_(n['ID']);
  else {
    idNino = agregarNino_(ninos, valores, ESTADO.prospecto);
    hist.push(['Crear prospecto', idNino, nombreDe_(valores)]);
  }
  var id = escribirVisita_(pruebas, v, idNino, TIPO_VISITA.prueba, null, datos.nota, usuario);
  hist.push(['Agendar prueba', id, idNino + ' · ' + v.codigo + ' · ' + fechaCorta_(v.iso)]);
  historialVarios_(usuario, hist);
  return { id: id, idNino: idNino };
}

/** Visitas que reponen una falta y siguen en pie: ID asistencia → ID prueba. Cancelada o No asistió liberan la falta. */
function faltasRepuestas_(pruebas) {
  var r = {};
  pruebas.filas.forEach(function (f) {
    var a = texto_(f['Repone asistencia']), e = texto_(f['Estado']);
    if (a && e !== ESTADO_PRUEBA.cancelada && e !== ESTADO_PRUEBA.noAsistio) r[a] = texto_(f['ID prueba']);
  });
  return r;
}

/**
 * La falta que se repone: del mismo niño, de una clase fija (no de otra
 * visita), Ausente o Falta justificada, del mismo SERVICIO que la clase donde
 * se repone, y sin otra reposición en pie. Sin plazo.
 */
function exigirFaltaReponible_(falta, n, pruebas, clases, claseDestino) {
  var id = texto_(falta['ID asistencia']);
  if (texto_(falta['ID niño']) !== texto_(n['ID'])) throw new ErrorUsuario_('La falta ' + id + ' es de otro niño.');
  if (texto_(falta['Presencia']) !== PRESENCIA.inscrito) throw new ErrorUsuario_('Solo se reponen faltas de una clase fija (' + id + ' es de una visita).');
  if (FALTAS.indexOf(texto_(falta['Estado'])) < 0) throw new ErrorUsuario_('La asistencia ' + id + ' está «' + texto_(falta['Estado']) + '»: no es una falta.');
  var origen = buscarClase_(clases, falta['Código clase']);
  if (norm_(origen['Servicio']) !== norm_(claseDestino['Servicio']))
    throw new ErrorUsuario_('La falta es de ' + texto_(origen['Servicio']) + ': se repone en una clase de ' + texto_(origen['Servicio']) + '.');
  var ya = faltasRepuestas_(pruebas)[id];
  if (ya) throw new ErrorUsuario_('Esa falta ya se repone con ' + ya + '.');
}

/**
 * Agenda una visita de tipo Reposición o Eventual (las pruebas van por
 * agendarPrueba, que también puede usar Comercial).
 *   Reposición: niño Activo; reponeAsistencia = la falta (ver exigirFaltaReponible_). Sin pago.
 *   Eventual: niño que NO está Activo (nuevo, Prospecto, Retirado o ya Eventual;
 *     «Por revisar» no). Su estado pasa a Eventual. Pagó/Monto como la prueba.
 */
function accAgendarVisita_(datos, usuario) {
  var tipo = enLista_(datos.tipo, [TIPO_VISITA.reposicion, TIPO_VISITA.eventual]);
  if (!tipo) throw new ErrorUsuario_('El tipo de visita tiene que ser Reposición o Eventual (las pruebas se agendan aparte).');
  var cfg = leerConfig_(), ninos = leerTabla_('ninos'), clases = leerTabla_('clases');
  var ins = leerTabla_('inscripciones'), pruebas = leerTabla_('pruebas');
  var v = validarFechaVisita_(datos, clases, 'Visita');
  var n = null, valores = null, extra = {}, pago = null;
  if (tipo === TIPO_VISITA.reposicion) {
    if (!texto_(datos.idNino)) throw new ErrorUsuario_('La reposición es para un niño que ya está en la base: elige al niño.');
    n = buscarNino_(ninos, datos.idNino);
    if (texto_(n['Estado']) !== ESTADO.activo)
      throw new ErrorUsuario_(nombreDe_(n) + ' está ' + texto_(n['Estado']) + ': la reposición es para niños Activos.');
    if (!texto_(datos.reponeAsistencia)) throw new ErrorUsuario_('Elige la falta que se repone.');
    var falta = buscarAsistencia_(leerTabla_('asistencia'), datos.reponeAsistencia);
    exigirFaltaReponible_(falta, n, pruebas, clases, v.c.fila);
    if (texto_(datos.pago)) throw new ErrorUsuario_('La reposición no se cobra.');
    extra['Repone asistencia'] = texto_(falta['ID asistencia']);
  } else {
    if (texto_(datos.idNino)) {
      n = buscarNino_(ninos, datos.idNino);
      var est = texto_(n['Estado']);
      if (est === ESTADO.activo) throw new ErrorUsuario_(nombreDe_(n) + ' está Activo: viene a su clase o a una reposición, no como eventual.');
      if (est === ESTADO.revisar) throw new ErrorUsuario_(nombreDe_(n) + ' está «Por revisar»: revísalo antes de agendarlo como eventual.');
    } else valores = valoresNinoVisita_(datos, cfg, ninos);
    if ('pago' in datos) {
      pago = valoresPagoPrueba_(datos);
      extra['Pagó'] = pago['Pagó']; extra['Monto pagado'] = pago['Monto pagado'];
    }
  }
  if (n) exigirNinoLibreEn_(n, v.codigo, v.iso, ins, pruebas, 'visita');
  exigirCupoVisita_(v, ins, pruebas);

  // Todo validado: ahora se escribe.
  var hist = [], idNino;
  if (n) {
    idNino = texto_(n['ID']);
    if (tipo === TIPO_VISITA.eventual && texto_(n['Estado']) !== ESTADO.eventual) {
      hist.push([texto_(n['Estado']) + ' → ' + ESTADO.eventual, idNino, 'visita eventual en ' + v.codigo + ' el ' + fechaCorta_(v.iso)]);
      ponerCeldas_(ninos, n, { 'Estado': ESTADO.eventual });
    }
  } else {
    idNino = agregarNino_(ninos, valores, ESTADO.eventual);
    hist.push(['Crear eventual', idNino, nombreDe_(valores)]);
  }
  var id = escribirVisita_(pruebas, v, idNino, tipo, extra, datos.nota, usuario);
  hist.push(['Agendar ' + tipo.toLowerCase(), id, idNino + ' · ' + v.codigo + ' · ' + fechaCorta_(v.iso) +
    (extra['Repone asistencia'] ? ' · repone ' + extra['Repone asistencia'] : '') + (pago ? textoPagoPrueba_(pago) : '')]);
  historialVarios_(usuario, hist);
  return { id: id, idNino: idNino };
}

/**
 * Resultado de una prueba: Asistió / No asistió (solo desde el día de la
 * prueba) / Cancelada (cuando sea). Se inscribió: Sí, No o vacío; si es No,
 * el motivo de la lista de Config es obligatorio. No inscribe a nadie: eso lo
 * hace Inscribir, que pasa al Prospecto a Activo.
 */
function accResultadoPrueba_(datos, usuario) {
  var cfg = leerConfig_(), pruebas = leerTabla_('pruebas');
  var f = buscarPrueba_(pruebas, datos.idPrueba);
  var iso = aISO_(f['Fecha']), hoy = hoyISO_(), codigo = texto_(f['Clase ID']);
  if (tipoVisita_(f) === TIPO_VISITA.reposicion && (texto_(datos.seInscribio) || texto_(datos.pago)))
    throw new ErrorUsuario_('«Se inscribió» y el pago no aplican a una reposición.');
  var estado = enLista_(datos.estado, [ESTADO_PRUEBA.asistio, ESTADO_PRUEBA.noAsistio, ESTADO_PRUEBA.cancelada]);
  if (!estado) throw new ErrorUsuario_('El resultado tiene que ser Asistió, No asistió o Cancelada.');
  if (estado !== ESTADO_PRUEBA.cancelada && iso > hoy)
    throw new ErrorUsuario_('«' + estado + '» se marca desde el día de la prueba (' + fechaCorta_(iso) + ').');
  // Una prueba cancelada que vuelve a ocupar cupo hoy tiene que caber.
  if (PRUEBA_OCUPA.indexOf(estado) >= 0 && !pruebaOcupa_(f) && iso >= hoy) {
    var c = claseUsable_(leerTabla_('clases'), codigo);
    var o = ocupacionEn_(codigo, iso, leerTabla_('inscripciones'), pruebas);
    if (o.total >= c.cupo) throw new ErrorUsuario_('La clase ' + codigo + ' ya no tiene cupo el ' + fechaCorta_(iso) + ': ' + textoOcupacion_(o, c.cupo) + '.', 'llena');
  }
  var se = texto_(datos.seInscribio);
  if (se && se !== SI && se !== NO) throw new ErrorUsuario_('«Se inscribió» tiene que ser Sí, No o vacío.');
  var motivo = '';
  if (se === NO) {
    if (!texto_(datos.motivo)) throw new ErrorUsuario_('Si no se inscribió, el motivo es obligatorio.');
    motivo = enLista_(datos.motivo, cfg.motivosNoInscripcion);
    if (!motivo) throw new ErrorUsuario_('El motivo «' + texto_(datos.motivo) + '» no está en la lista «' + LISTA.motivoNoInscripcion + '» de Config.');
  }
  var cambios = { 'Estado': estado, 'Se inscribió': se, 'Motivo no inscripción': motivo };
  if ('nota' in datos) cambios['Nota'] = texto_(datos.nota);
  // El pago puede venir en el mismo diálogo; si no viene, no se toca.
  var pago = 'pago' in datos ? valoresPagoPrueba_(datos) : null;
  if (pago) { cambios['Pagó'] = pago['Pagó']; cambios['Monto pagado'] = pago['Monto pagado']; }
  // Lo decide una persona: la lista ya no lo vuelve a cambiar.
  cambios['Resultado por lista'] = '';
  Object.keys(cambios).forEach(function (k) { if (texto_(f[k]) === texto_(cambios[k])) delete cambios[k]; });
  if (!Object.keys(cambios).length) return { id: texto_(f['ID prueba']), sinCambios: true };
  ponerCeldas_(pruebas, f, cambios);
  historial_(usuario, 'Resultado de prueba', texto_(f['ID prueba']), texto_(f['Niño ID']) + ' · ' + codigo + ' · ' + fechaCorta_(iso) +
    ' · ' + estado + (se ? ' · se inscribió: ' + se : '') + (motivo ? ' · ' + motivo : '') + (pago ? textoPagoPrueba_(pago) : ''));
  return { id: texto_(f['ID prueba']) };
}

/**
 * Pago de la clase de prueba. No hay precio fijo: el monto se escribe a mano.
 *   Pagó «Sí» → monto obligatorio, número mayor que cero (se guarda a 2 decimales).
 *   Pagó «No» o vacío → el monto queda vacío.
 * Devuelve las dos celdas a escribir.
 */
function valoresPagoPrueba_(datos) {
  var pago = texto_(datos.pago);
  if (pago && pago !== SI && pago !== NO) throw new ErrorUsuario_('«Pagó» tiene que ser Sí, No o vacío.');
  var monto = '';
  if (pago === SI) {
    monto = numeroDe_(datos.monto);
    if (!(monto > 0)) throw new ErrorUsuario_('Si pagó, el monto es obligatorio y tiene que ser un número mayor que cero.');
    monto = Math.round(monto * 100) / 100;
  }
  return { 'Pagó': pago, 'Monto pagado': monto };
}

function textoPagoPrueba_(v) {
  return ' · pagó: ' + (v['Pagó'] || '—') + (v['Pagó'] === SI ? ' (' + v['Monto pagado'] + ')' : '');
}

/** Registra o corrige el pago de una prueba: antes, durante o después de la clase. */
function accPagoPrueba_(datos, usuario) {
  var pruebas = leerTabla_('pruebas');
  var f = buscarPrueba_(pruebas, datos.idPrueba);
  if (tipoVisita_(f) === TIPO_VISITA.reposicion) throw new ErrorUsuario_('La reposición no se cobra.');
  var cambios = valoresPagoPrueba_(datos);
  Object.keys(cambios).forEach(function (k) { if (texto_(f[k]) === texto_(cambios[k])) delete cambios[k]; });
  if (!Object.keys(cambios).length) return { id: texto_(f['ID prueba']), sinCambios: true };
  var antes = { 'Pagó': texto_(f['Pagó']), 'Monto pagado': texto_(f['Monto pagado']) };
  ponerCeldas_(pruebas, f, cambios);
  historial_(usuario, 'Pago de prueba', texto_(f['ID prueba']), texto_(f['Niño ID']) + ' · ' + texto_(f['Clase ID']) + ' · ' +
    fechaCorta_(aISO_(f['Fecha'])) + textoPagoPrueba_({ 'Pagó': texto_(f['Pagó']), 'Monto pagado': f['Monto pagado'] }) +
    (antes['Pagó'] ? ' · antes:' + textoPagoPrueba_(antes).replace(' · ', ' ') : ''));
  return { id: texto_(f['ID prueba']) };
}


// ─── Pasar lista y seguimiento (21-oct) ──────────────────────────────────────
//
// Asistencia: una fila por niño, clase y fecha (las de «fuera de lista», una
// por nombre escrito). Corregir = actualizar la fila; el cambio de estado
// queda en Historial. Quién puede qué día lo decide el puente: api.php manda
// soloHoy = true para quien no puede corregir otros días (Profesor), y aquí
// se respeta. Nunca se pasa lista de un día futuro.
//
// v8 (23-oct): el puente manda además limiteProfesor = true para el Profesor
// y entonces manda la VENTANA de Config (no soloHoy): ve y marca desde hoy − N
// hasta hoy, y ve sin marcar hasta hoy + M. soloHoy queda para que un puente y
// un script de versiones distintas sigan siendo seguros. Los días futuros
// (hasta hoy + M) los ve también la coordinación, sin marcar: NADIE marca un
// día que todavía no llega.

function buscarAsistencia_(t, id) {
  id = texto_(id);
  for (var i = 0; i < t.filas.length; i++) if (texto_(t.filas[i]['ID asistencia']) === id) return t.filas[i];
  throw new ErrorUsuario_('No existe la asistencia ' + (id || '(sin ID)') + '.');
}

/** Edad el día iso: «18 meses» hasta los 2 años, después «7 años». */
function edadEn_(nac, iso) {
  var n = aISO_(nac);
  if (!n) return '';
  var meses = (+iso.slice(0, 4) - +n.slice(0, 4)) * 12 + (+iso.slice(5, 7) - +n.slice(5, 7)) - (+iso.slice(8, 10) < +n.slice(8, 10) ? 1 : 0);
  if (meses < 0) return '';
  return meses < 24 ? meses + ' meses' : Math.floor(meses / 12) + ' años';
}

/**
 * La fecha de una lista y lo que se puede hacer ese día: {iso, desde, hasta}
 * ('' en desde = sin límite hacia atrás). Hoy si no viene fecha.
 *   · NADIE marca un día futuro (escribir = true lo rechaza para todos).
 *   · Los días futuros se VEN hasta hoy + M (Config), para cualquier rol: la
 *     coordinación tiene como mínimo lo que tiene el Profesor.
 *   · limiteProfesor: además, hacia atrás solo hasta hoy − N (Config).
 *   · soloHoy sin limiteProfesor (puente anterior a v8): solo hoy.
 *   · Coordinación (sin límites): cualquier día pasado.
 */
function fechaLista_(datos, escribir) {
  var hoy = hoyISO_();
  var iso = texto_(datos.fecha) ? Utilities.formatDate(exigirFecha_(datos.fecha, 'la fecha de la lista'), zona_(), 'yyyy-MM-dd') : hoy;
  if (escribir && iso > hoy) throw new ErrorUsuario_('El ' + fechaCorta_(iso) + ' todavía no llega: su lista se puede ver, pero se marca ese día.', 'dia_futuro');
  var profesor = datos.limiteProfesor === true;
  if (!profesor && datos.soloHoy === true) {
    if (iso !== hoy) throw new ErrorUsuario_('Solo se puede pasar y corregir la lista de hoy. Las correcciones de otros días las hace la coordinación.', 'solo_hoy');
    return { iso: iso, desde: hoy, hasta: hoy };
  }
  // La ventana de Config. El Profesor la necesita siempre; a la coordinación, sin
  // el parámetro de días adelante, no se le bloquean los días pasados: solo no ve los futuros.
  var cfg = leerConfig_();
  if ((profesor && (cfg.listaAtras === null || cfg.listaAdelante === null)) || (iso > hoy && cfg.listaAdelante === null))
    throw new ErrorUsuario_('Falta en Config «' + LISTA.param + ' / ' + PARAM_LISTA_ATRAS + '» o «' + LISTA.param + ' / ' +
      PARAM_LISTA_ADELANTE + '» con un número entero (0 o más).' + (profesor ? ' Pasar lista no se abre hasta tenerlos.' : ''), 'sin_configuracion');
  var desde = profesor ? sumarDiasISO_(hoy, -cfg.listaAtras) : '';
  var hasta = cfg.listaAdelante === null ? hoy : sumarDiasISO_(hoy, cfg.listaAdelante);
  if (desde && iso < desde) throw new ErrorUsuario_('Solo se ve y corrige la lista de los últimos ' + cfg.listaAtras + ' días. ' +
    'Las de antes las corrige la coordinación.', 'fuera_de_plazo');
  if (iso > hasta) throw new ErrorUsuario_('Solo se ve la lista de los próximos ' + cfg.listaAdelante + ' días.', 'fuera_de_plazo');
  return { iso: iso, desde: desde, hasta: hasta };
}

function exigirDiaDeClase_(c, iso) {
  var dia = enLista_(c['Día'], DIAS_ORDEN);
  if (dia !== diaSemana_(iso)) throw new ErrorUsuario_('La clase ' + texto_(c['Código clase']) + ' es los ' +
    String(dia || texto_(c['Día'])).toLowerCase() + ' y el ' + fechaCorta_(iso) + ' es ' + diaSemana_(iso).toLowerCase() + '.');
}

/**
 * Quién va en la lista de una clase en una fecha: los inscritos ese día y
 * las visitas no canceladas (con su tipo), una vez por niño. Más lo ya
 * marcado (por ID de niño) y los «fuera de lista».
 */
function armarLista_(codigo, iso, ins, pruebas, asis) {
  var marcas = {}, fuera = [];
  asis.filas.forEach(function (a) {
    if (texto_(a['Código clase']) !== codigo || aISO_(a['Fecha']) !== iso) return;
    if (texto_(a['Presencia']) === PRESENCIA.fuera) fuera.push(a);
    else marcas[texto_(a['ID niño'])] = a;
  });
  var lista = [], vistos = {};
  ins.filas.forEach(function (f) {
    if (texto_(f['Código clase']) !== codigo || !inscripcionEnFecha_(f, iso)) return;
    var id = texto_(f['ID niño']);
    if (vistos[id]) return;
    vistos[id] = true;
    lista.push({ idNino: id, presencia: PRESENCIA.inscrito, idVisita: '', visita: null });
  });
  pruebas.filas.forEach(function (f) {
    if (texto_(f['Clase ID']) !== codigo || aISO_(f['Fecha']) !== iso || texto_(f['Estado']) === ESTADO_PRUEBA.cancelada) return;
    var id = texto_(f['Niño ID']);
    if (vistos[id]) return;
    vistos[id] = true;
    lista.push({ idNino: id, presencia: tipoVisita_(f), idVisita: texto_(f['ID prueba']), visita: f });
  });
  return { lista: lista, marcas: marcas, fuera: fuera };
}

/**
 * Las clases de un día con su lista. Por niño SOLO nombre, edad, la marca de
 * visita y lo ya marcado: es lo que ve el profesor (api.php además recorta).
 */
function accLeerLista_(datos) {
  var F = fechaLista_(datos, false), iso = F.iso, dia = diaSemana_(iso);
  var ninos = leerTabla_('ninos'), clases = leerTabla_('clases'), ins = leerTabla_('inscripciones');
  var pruebas = leerTabla_('pruebas'), asis = leerTabla_('asistencia'), sin = leerTabla_('sinClase');
  var porId = {};
  ninos.filas.forEach(function (n) { porId[texto_(n['ID'])] = n; });
  var lista = clases.filas.filter(function (c) {
    return norm_(c['Activa']) === norm_(SI) && enLista_(c['Día'], DIAS_ORDEN) === dia;
  }).map(function (c) {
    var codigo = texto_(c['Código clase']), L = armarLista_(codigo, iso, ins, pruebas, asis);
    var chicos = L.lista.map(function (x) {
      var n = porId[x.idNino], a = L.marcas[x.idNino];
      return { idNino: x.idNino, nombre: n ? nombreDe_(n) : x.idNino, edad: n ? edadEn_(n['Fecha nacimiento'], iso) : '',
               presencia: x.presencia, idVisita: x.idVisita, estado: a ? texto_(a['Estado']) : '', nota: a ? texto_(a['Nota']) : '' };
    }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    var fuera = L.fuera.map(function (a) {
      return { idAsistencia: texto_(a['ID asistencia']), nombre: texto_(a['Nombre fuera de lista']), estado: texto_(a['Estado']), nota: texto_(a['Nota']) };
    });
    return { codigo: codigo, servicio: texto_(c['Servicio']), hora: aHora_(c['Hora inicio']),
             guardada: Object.keys(L.marcas).length + L.fuera.length > 0,
             sinClase: sin.filas.some(function (s) { return texto_(s['Código clase']) === codigo && aISO_(s['Fecha']) === iso; }),
             ninos: chicos, fueraDeLista: fuera };
  }).sort(function (a, b) { return (a.hora + a.servicio).localeCompare(b.hora + b.servicio); });
  return { fecha: iso, hoy: hoyISO_(), dia: dia, otroDia: datos.soloHoy !== true || datos.limiteProfesor === true,
           desde: F.desde, hasta: F.hasta, soloLectura: iso > hoyISO_(), estados: ESTADOS_ASIS, clases: lista };
}

/**
 * Guarda la lista de UNA clase en una fecha (todo lo de la clase en una
 * llamada, con ID de solicitud). Solo niños de esa lista; un niño una vez;
 * estados de ESTADOS_ASIS. Las visitas se marcan solas: Presente o Llegó
 * tarde → Asistió; Ausente o Falta justificada → No asistió. No toca «Se
 * inscribió» ni pisa un resultado que puso una persona (solo cambia las
 * Agendadas o las que ya marcó la lista).
 */
function accGuardarLista_(datos, usuario) {
  var iso = fechaLista_(datos, true).iso;
  var codigo = texto_(datos.codigo);
  var clases = leerTabla_('clases'), c = buscarClase_(clases, codigo);
  exigirDiaDeClase_(c, iso);
  var sin = leerTabla_('sinClase');
  if (sin.filas.some(function (s) { return texto_(s['Código clase']) === codigo && aISO_(s['Fecha']) === iso; }))
    throw new ErrorUsuario_('La clase ' + codigo + ' del ' + fechaCorta_(iso) + ' está marcada «No hubo clase».');
  var ins = leerTabla_('inscripciones'), pruebas = leerTabla_('pruebas'), asis = leerTabla_('asistencia');
  var L = armarLista_(codigo, iso, ins, pruebas, asis);
  var esperados = {};
  L.lista.forEach(function (x) { esperados[x.idNino] = x; });
  var esLista = function (v) { return Object.prototype.toString.call(v) === '[object Array]'; };
  var marcas = esLista(datos.marcas) ? datos.marcas : [];
  var fuera = esLista(datos.fueraDeLista) ? datos.fueraDeLista : [];
  // v9: quitar marcas ya guardadas (tocar otra vez el estado elegido).
  var quitar = esLista(datos.quitar) ? datos.quitar : [], quitarFuera = esLista(datos.quitarFuera) ? datos.quitarFuera : [];
  if (!marcas.length && !fuera.length && !quitar.length && !quitarFuera.length) throw new ErrorUsuario_('La lista está vacía: marca al menos un niño.');
  var estadoDe = function (v) {
    var e = enLista_(v, ESTADOS_ASIS);
    if (!e) throw new ErrorUsuario_('Estado de asistencia inválido: «' + texto_(v) + '».');
    return e;
  };
  var vistos = {};
  var plan = marcas.map(function (m) {
    var id = texto_(m && m.idNino), e = esperados[id];
    if (!e) throw new ErrorUsuario_('El niño ' + (id || '(sin ID)') + ' no está en la lista de ' + codigo + ' del ' + fechaCorta_(iso) + '.');
    if (vistos[id]) throw new ErrorUsuario_('El niño ' + id + ' viene dos veces en la lista.');
    vistos[id] = true;
    return { e: e, estado: estadoDe(m.estado), nota: texto_(m.nota) };
  });
  var planFuera = fuera.map(function (x) {
    var a = null;
    if (texto_(x && x.idAsistencia)) {
      a = L.fuera.filter(function (f) { return texto_(f['ID asistencia']) === texto_(x.idAsistencia); })[0];
      if (!a) throw new ErrorUsuario_('La asistencia ' + texto_(x.idAsistencia) + ' no es de esta lista.');
    } else if (!texto_(x && x.nombre)) throw new ErrorUsuario_('Escribe el nombre del niño que no está en la lista.');
    return { a: a, nombre: texto_(x.nombre), estado: estadoDe(x.estado), nota: texto_(x.nota) };
  });
  // v9: lo que se quita. Una falta con reposición en pie no se quita (la reposición quedaría sin su falta).
  var exigirSinReposicion = function (a) {
    var id = texto_(a['ID asistencia']);
    var r = pruebas.filas.filter(function (f) { return texto_(f['Repone asistencia']) === id && texto_(f['Estado']) !== ESTADO_PRUEBA.cancelada; })[0];
    if (r) throw new ErrorUsuario_('La falta del ' + fechaCorta_(iso) + ' tiene una reposición en pie (' + texto_(r['ID prueba']) +
      '): no se puede quitar la marca. Si hace falta, la coordinación cancela antes la reposición.');
  };
  var porQuitar = [];
  quitar.forEach(function (q) {
    var id = texto_(q), e = esperados[id];
    if (!e) throw new ErrorUsuario_('El niño ' + (id || '(sin ID)') + ' no está en la lista de ' + codigo + ' del ' + fechaCorta_(iso) + '.');
    if (vistos[id]) throw new ErrorUsuario_('El niño ' + id + ' viene para marcar y para quitar a la vez.');
    vistos[id] = true;
    var a = L.marcas[id];
    if (!a) return;                                   // no tenía marca guardada: nada que quitar
    exigirSinReposicion(a);
    porQuitar.push({ a: a, e: e, quien: id });
  });
  quitarFuera.forEach(function (q) {
    var id = texto_(q), a = L.fuera.filter(function (f) { return texto_(f['ID asistencia']) === id; })[0];
    if (!a) throw new ErrorUsuario_('La asistencia ' + (id || '(sin ID)') + ' no es de esta lista.');
    if (planFuera.some(function (p) { return p.a === a; })) throw new ErrorUsuario_('La asistencia ' + id + ' viene para marcar y para quitar a la vez.');
    if (texto_(a['Resolución'])) throw new ErrorUsuario_('La coordinación ya resolvió a «' + texto_(a['Nombre fuera de lista']) + '»: su marca no se quita desde la lista.');
    if (porQuitar.some(function (p) { return p.a === a; })) return;
    porQuitar.push({ a: a, e: null, quien: 'fuera de lista' });
  });

  // Todo validado: ahora se escribe.
  var ahora = ahora_(), fecha = fechaDeTexto_(iso), sig = siguienteId_(asis.filas, 'ID asistencia', PREFIJO.asistencia);
  var nuevas = [], hist = [], corregidas = 0, visitasMarcadas = 0;
  var fila = function (o) {
    return { 'ID asistencia': sig(), 'Fecha': fecha, 'Código clase': codigo, 'ID niño': o.idNino || '', 'Presencia': o.presencia,
             'ID visita': o.idVisita || '', 'Estado': o.estado, 'Nombre fuera de lista': o.nombre || '', 'Marcado por': usuario,
             'Hora': ahora, 'Nota': o.nota, 'Resolución': '' };
  };
  // v8: el registro anterior (estado, nota, quién y cuándo) queda en el detalle
  // de Historial; la fila de Historial ya dice quién corrigió y cuándo.
  var cuando = function (v) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, zona_(), 'dd/MM/yyyy HH:mm') : texto_(v); };
  var previoDe = function (a) {
    var antes = texto_(a['Estado']), notaAntes = texto_(a['Nota']);
    return 'antes: ' + (antes || '(sin marcar)') + (notaAntes ? ' «' + notaAntes + '»' : '') +
      ', marcado por ' + (texto_(a['Marcado por']) || '—') + (cuando(a['Hora']) ? ' el ' + cuando(a['Hora']) : '');
  };
  var actualizar = function (a, estado, nota, quien, extra) {
    if (texto_(a['Estado']) === estado && texto_(a['Nota']) === nota && !extra) return;
    var antes = texto_(a['Estado']), notaAntes = texto_(a['Nota']);
    var previo = previoDe(a);
    var cambios = { 'Estado': estado, 'Nota': nota, 'Marcado por': usuario, 'Hora': ahora };
    Object.keys(extra || {}).forEach(function (k) { cambios[k] = extra[k]; });
    ponerCeldas_(asis, a, cambios);
    var donde = quien + ' · ' + codigo + ' · ' + fechaCorta_(iso) + ' · ';
    if (antes !== estado) {
      corregidas++;
      hist.push(['Corregir asistencia', texto_(a['ID asistencia']), donde + antes + ' → ' + estado + ' · ' + previo]);
    } else if (notaAntes !== nota) {
      hist.push(['Corregir nota', texto_(a['ID asistencia']), donde + 'nota «' + notaAntes + '» → «' + nota + '» · ' + previo]);
    }
  };
  plan.forEach(function (p) {
    var a = L.marcas[p.e.idNino];
    if (a) actualizar(a, p.estado, p.nota, p.e.idNino);
    else nuevas.push(fila({ idNino: p.e.idNino, presencia: p.e.presencia, idVisita: p.e.idVisita, estado: p.estado, nota: p.nota }));
    var v = p.e.visita;
    if (!v) return;
    var est = texto_(v['Estado']), porLista = texto_(v['Resultado por lista']) === SI;
    if (est !== ESTADO_PRUEBA.agendada && !(porLista && est !== ESTADO_PRUEBA.cancelada)) return;   // la puso una persona
    var nuevo = (p.estado === ESTADO_ASIS.presente || p.estado === ESTADO_ASIS.tarde) ? ESTADO_PRUEBA.asistio : ESTADO_PRUEBA.noAsistio;
    if (nuevo === est && porLista) return;
    ponerCeldas_(pruebas, v, { 'Estado': nuevo, 'Resultado por lista': SI });
    visitasMarcadas++;
    hist.push(['Resultado por lista', texto_(v['ID prueba']), p.e.idNino + ' · ' + codigo + ' · ' + fechaCorta_(iso) + ' · ' + nuevo]);
  });
  planFuera.forEach(function (p) {
    if (p.a) actualizar(p.a, p.estado, p.nota, 'fuera de lista', p.nombre && p.nombre !== texto_(p.a['Nombre fuera de lista']) ? { 'Nombre fuera de lista': p.nombre } : null);
    else nuevas.push(fila({ presencia: PRESENCIA.fuera, nombre: p.nombre, estado: p.estado, nota: p.nota }));
  });
  agregarFilas_(asis, 'asistencia', nuevas);
  // v9: quitar va al final (borrar filas corre el número de las de abajo). El registro completo queda en Historial.
  porQuitar.forEach(function (p) {
    hist.push(['Quitar asistencia', texto_(p.a['ID asistencia']), p.quien + ' · ' + codigo + ' · ' + fechaCorta_(iso) + ' · quitada · ' + previoDe(p.a)]);
    var v = p.e && p.e.visita;
    if (!v || texto_(v['Resultado por lista']) !== SI || texto_(v['Estado']) === ESTADO_PRUEBA.cancelada) return;
    ponerCeldas_(pruebas, v, { 'Estado': ESTADO_PRUEBA.agendada, 'Resultado por lista': '' });   // la había marcado la lista: vuelve a Agendada
    hist.push(['Resultado por lista', texto_(v['ID prueba']), p.quien + ' · ' + codigo + ' · ' + fechaCorta_(iso) + ' · vuelve a ' + ESTADO_PRUEBA.agendada + ' (se quitó la marca)']);
  });
  borrarFilas_(asis, porQuitar.map(function (p) { return p.a; }));
  hist.unshift(['Pasar lista', codigo, fechaCorta_(iso) + ' · ' + nuevas.length + ' nuevas · ' + corregidas + ' corregidas' +
    (porQuitar.length ? ' · ' + porQuitar.length + ' quitadas' : '') + (visitasMarcadas ? ' · ' + visitasMarcadas + ' visita(s) marcadas' : '')]);
  historialVarios_(usuario, hist);
  return { fecha: iso, codigo: codigo, nuevas: nuevas.length, corregidas: corregidas, quitadas: porQuitar.length, visitasMarcadas: visitasMarcadas };
}

/** «No hubo clase» (feriado…): la clase de ese día no se avisa como «sin lista». Queda en Historial. */
function accNoHuboClase_(datos, usuario) {
  var iso = Utilities.formatDate(exigirFecha_(datos.fecha, 'la fecha'), zona_(), 'yyyy-MM-dd');
  if (iso > hoyISO_()) throw new ErrorUsuario_('No se marca «No hubo clase» en un día que todavía no llega.');
  var codigo = texto_(datos.codigo), c = buscarClase_(leerTabla_('clases'), codigo);
  exigirDiaDeClase_(c, iso);
  if (leerTabla_('asistencia').filas.some(function (a) { return texto_(a['Código clase']) === codigo && aISO_(a['Fecha']) === iso; }))
    throw new ErrorUsuario_('La clase ' + codigo + ' del ' + fechaCorta_(iso) + ' ya tiene lista guardada.');
  var sin = leerTabla_('sinClase');
  if (sin.filas.some(function (s) { return texto_(s['Código clase']) === codigo && aISO_(s['Fecha']) === iso; }))
    return { fecha: iso, codigo: codigo, sinCambios: true };
  agregarFilas_(sin, 'sinClase', [{ 'Fecha': fechaDeTexto_(iso), 'Código clase': codigo, 'Nota': texto_(datos.nota),
    'Registrado por': usuario, 'Fecha registro': ahora_() }]);
  historial_(usuario, 'No hubo clase', codigo, fechaCorta_(iso) + (texto_(datos.nota) ? ' · ' + texto_(datos.nota) : ''));
  return { fecha: iso, codigo: codigo };
}

/**
 * Un niño «fuera de lista» (el profesor escribió el nombre): la coordinación
 * lo vincula a un niño existente, lo crea (como Eventual: vino un día sin
 * matrícula) o lo descarta. Una sola vez.
 */
function accResolverFueraDeLista_(datos, usuario) {
  var asis = leerTabla_('asistencia'), a = buscarAsistencia_(asis, datos.idAsistencia);
  var idA = texto_(a['ID asistencia']), iso = aISO_(a['Fecha']), codigo = texto_(a['Código clase']);
  if (texto_(a['Presencia']) !== PRESENCIA.fuera) throw new ErrorUsuario_(idA + ' no es un niño fuera de lista.');
  if (texto_(a['Resolución'])) throw new ErrorUsuario_(idA + ' ya está resuelto (' + texto_(a['Resolución']) + ').');
  var ninos = leerTabla_('ninos'), hist = [], idNino = '', cambios;
  var accion = texto_(datos.resolucion);
  if (accion === 'vincular') {
    var n = buscarNino_(ninos, datos.idNino);
    idNino = texto_(n['ID']);
    if (asis.filas.some(function (x) { return x !== a && texto_(x['ID niño']) === idNino && texto_(x['Código clase']) === codigo && aISO_(x['Fecha']) === iso; }))
      throw new ErrorUsuario_(nombreDe_(n) + ' ya tiene asistencia en ' + codigo + ' el ' + fechaCorta_(iso) + '.');
    cambios = { 'ID niño': idNino, 'Resolución': RESOLUCION.vinculado };
  } else if (accion === 'crear') {
    var valores = valoresNinoVisita_(datos, leerConfig_(), ninos);
    idNino = agregarNino_(ninos, valores, ESTADO.eventual);
    hist.push(['Crear eventual', idNino, nombreDe_(valores) + ' · desde ' + idA]);
    cambios = { 'ID niño': idNino, 'Resolución': RESOLUCION.creado };
  } else if (accion === 'descartar') {
    cambios = { 'Resolución': RESOLUCION.descartado };
  } else throw new ErrorUsuario_('La resolución tiene que ser vincular, crear o descartar.');
  ponerCeldas_(asis, a, cambios);
  hist.push(['Fuera de lista: ' + cambios['Resolución'].toLowerCase(), idA, '«' + texto_(a['Nombre fuera de lista']) + '» · ' + codigo + ' · ' +
    fechaCorta_(iso) + (idNino ? ' · ' + idNino : '')]);
  historialVarios_(usuario, hist);
  return { id: idA, idNino: idNino };
}

/** 'HH:mm' + minutos → 'HH:mm' (sin pasar de 23:59). */
function sumarMinutos_(hhmm, min) {
  var m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return '23:59';
  var t = Math.min(+m[1] * 60 + +m[2] + min, 23 * 60 + 59);
  return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
}

/**
 * Seguimiento para la coordinación:
 *   · faltasSeguidas: niños Activos cuya racha actual de Ausente llega al
 *     umbral de Config. Por niño, todas sus clases en orden de fecha y hora;
 *     Presente o Llegó tarde cortan la racha; Falta justificada se salta.
 *   · faltasPorReponer: Ausente y Falta justificada de clase fija, de niños
 *     Activos, de los últimos N días (Config), sin reposición en pie.
 *   · clasesSinLista: desde «Asistencia desde» (Config), clases activas que
 *     ya terminaron (hora + duración de Config), con niños ese día, sin
 *     ninguna asistencia guardada y sin «No hubo clase».
 *   · fueraDeLista: los «fuera de lista» sin resolver.
 */
function accSeguimiento_() {
  var cfg = leerConfig_(), hoy = hoyISO_();
  var ninos = leerTabla_('ninos'), clases = leerTabla_('clases'), ins = leerTabla_('inscripciones');
  var pruebas = leerTabla_('pruebas'), asis = leerTabla_('asistencia'), sin = leerTabla_('sinClase');
  var porId = {}, clase = {};
  ninos.filas.forEach(function (n) { porId[texto_(n['ID'])] = n; });
  clases.filas.forEach(function (c) { clase[texto_(c['Código clase'])] = c; });
  var activo = function (id) { return porId[id] && texto_(porId[id]['Estado']) === ESTADO.activo; };
  var servicio = function (codigo) { return clase[codigo] ? texto_(clase[codigo]['Servicio']) : ''; };
  var hora = function (codigo) { return clase[codigo] ? aHora_(clase[codigo]['Hora inicio']) : ''; };
  var repuestas = faltasRepuestas_(pruebas);
  var filas = asis.filas.map(function (a) {
    return { id: texto_(a['ID asistencia']), fecha: aISO_(a['Fecha']), codigo: texto_(a['Código clase']), idNino: texto_(a['ID niño']),
             presencia: texto_(a['Presencia']), estado: texto_(a['Estado']), nota: texto_(a['Nota']),
             nombreFuera: texto_(a['Nombre fuera de lista']), resolucion: texto_(a['Resolución']) };
  });

  var porNino = {};
  filas.forEach(function (x) { if (x.idNino) (porNino[x.idNino] = porNino[x.idNino] || []).push(x); });
  var umbral = cfg.faltasSeguidas || 2, faltasSeguidas = [];
  Object.keys(porNino).forEach(function (id) {
    if (!activo(id)) return;
    var racha = [];
    porNino[id].sort(function (a, b) { return (a.fecha + hora(a.codigo)).localeCompare(b.fecha + hora(b.codigo)); }).forEach(function (x) {
      if (x.estado === ESTADO_ASIS.ausente) racha.push(x);
      else if (x.estado === ESTADO_ASIS.presente || x.estado === ESTADO_ASIS.tarde) racha = [];
      // Falta justificada: se salta (ni cuenta ni corta).
    });
    if (racha.length >= umbral) faltasSeguidas.push({ idNino: id, nombre: nombreDe_(porId[id]), cuantas: racha.length,
      desde: racha[0].fecha, hasta: racha[racha.length - 1].fecha,
      clases: racha.map(function (x) { return x.codigo; }).filter(function (c, i, l) { return l.indexOf(c) === i; }) });
  });
  faltasSeguidas.sort(function (a, b) { return b.cuantas - a.cuantas || a.nombre.localeCompare(b.nombre, 'es'); });

  var desdeReponer = sumarDiasISO_(hoy, -(cfg.diasReponer || 30));
  var faltasPorReponer = filas.filter(function (x) {
    return x.idNino && x.presencia === PRESENCIA.inscrito && FALTAS.indexOf(x.estado) >= 0 && x.fecha >= desdeReponer &&
      !repuestas[x.id] && activo(x.idNino);
  }).map(function (x) {
    return { idAsistencia: x.id, idNino: x.idNino, nombre: nombreDe_(porId[x.idNino]), fecha: x.fecha, codigo: x.codigo,
             servicio: servicio(x.codigo), estado: x.estado };
  }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre, 'es'); });

  var clasesSinLista = [];
  if (cfg.asistenciaDesde && cfg.asistenciaDesde <= hoy) {
    var hecha = {};
    filas.forEach(function (x) { hecha[x.codigo + '|' + x.fecha] = true; });
    sin.filas.forEach(function (s) { hecha[texto_(s['Código clase']) + '|' + aISO_(s['Fecha'])] = true; });
    var fechas = [];
    for (var d = cfg.asistenciaDesde; d <= hoy; d = sumarDiasISO_(d, 1)) fechas.push(d);
    var ocup = ocupacionFechas_(fechas, clases, ins, pruebas), ahoraHM = horaAhora_(), dur = cfg.duracionClase || 60;
    fechas.forEach(function (d) {
      Object.keys(ocup[d]).forEach(function (codigo) {
        var o = ocup[d][codigo];
        if (hecha[codigo + '|' + d] || o.i + o.v === 0) return;
        if (d === hoy && ahoraHM < sumarMinutos_(hora(codigo), dur)) return;   // todavía no termina
        clasesSinLista.push({ fecha: d, codigo: codigo, servicio: servicio(codigo), hora: hora(codigo) });
      });
    });
    clasesSinLista.sort(function (a, b) { return (b.fecha + a.hora).localeCompare(a.fecha + b.hora); });
  }

  var fueraDeLista = filas.filter(function (x) { return x.presencia === PRESENCIA.fuera && !x.resolucion; }).map(function (x) {
    return { idAsistencia: x.id, fecha: x.fecha, codigo: x.codigo, servicio: servicio(x.codigo), nombre: x.nombreFuera, estado: x.estado, nota: x.nota };
  });
  return { hoy: hoy, umbral: umbral, diasReponer: cfg.diasReponer || 30, faltasSeguidas: faltasSeguidas,
           faltasPorReponer: faltasPorReponer, clasesSinLista: clasesSinLista, fueraDeLista: fueraDeLista };
}

/** La asistencia de un niño (para su ficha y para elegir la falta que se repone). Sin plazo. */
function accAsistenciaNino_(datos) {
  var n = buscarNino_(leerTabla_('ninos'), datos.idNino), id = texto_(n['ID']);
  var clases = leerTabla_('clases'), clase = {};
  clases.filas.forEach(function (c) { clase[texto_(c['Código clase'])] = c; });
  var repuestas = faltasRepuestas_(leerTabla_('pruebas')), activo = texto_(n['Estado']) === ESTADO.activo;
  var lista = leerTabla_('asistencia').filas.filter(function (a) { return texto_(a['ID niño']) === id; }).map(function (a) {
    var codigo = texto_(a['Código clase']), idA = texto_(a['ID asistencia']), estado = texto_(a['Estado']), presencia = texto_(a['Presencia']);
    return { id: idA, fecha: aISO_(a['Fecha']), codigo: codigo, servicio: clase[codigo] ? texto_(clase[codigo]['Servicio']) : '',
             presencia: presencia, idVisita: texto_(a['ID visita']), estado: estado, nota: texto_(a['Nota']),
             repuestaCon: repuestas[idA] || '',
             reponible: activo && presencia === PRESENCIA.inscrito && FALTAS.indexOf(estado) >= 0 && !repuestas[idA] };
  }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo); });
  return { idNino: id, asistencias: lista };
}
