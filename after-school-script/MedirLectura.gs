/**
 * MedirLectura.gs — SOLO MIDE, no escribe nada (23-oct-2026).
 *
 * Para saber de dónde salen los 2,6–4,8 s que tarda Google en una lectura de
 * Pasar lista. Se agrega como un archivo más del mismo proyecto de Apps Script
 * de «VEA_AfterSchool_BD» (junto a AfterSchool.gs) y se ejecuta DESDE EL
 * EDITOR: no cambia la implementación ni la dirección /exec.
 *
 *   medirPasarLista()   lee cada pestaña que usa la lista de un día, la mide
 *                       y después arma la lista entera de hoy y de ayer, como
 *                       lo hace el portal. Escribe el informe en el registro.
 *
 * Usa las funciones de AfterSchool.gs (leerTabla_, accLeerLista_, …), así
 * que mide exactamente lo que corre en cada pedido.
 */
function medirPasarLista() {
  var l = [], ms = function (t0) { return Date.now() - t0; };
  var t = Date.now();
  reiniciarCache_(false);
  var libro = libro_();
  l.push('Abrir el archivo: ' + ms(t) + ' ms · AfterSchool.gs ' + VERSION_SCRIPT);

  // 1. Cada pestaña por separado, sin caché (lo que cuesta leerla entera).
  var claves = ['ninos', 'clases', 'inscripciones', 'pruebas', 'asistencia', 'sinClase', 'config', 'historial', 'solicitudes'];
  var total = 0;
  l.push('');
  l.push('Pestaña                  ms    filas × columnas   celdas');
  claves.forEach(function (k) {
    reiniciarCache_(false);
    var t0 = Date.now(), tabla = leerTabla_(k), dur = ms(t0);
    var filas = tabla.ultimaFila, cols = tabla.ancho;
    if (['historial', 'solicitudes'].indexOf(k) < 0) total += dur;   // estas dos no las lee la lista
    l.push((HOJAS[k] + '                        ').slice(0, 22) + ('      ' + dur).slice(-6) + '    ' +
      ('     ' + filas).slice(-5) + ' × ' + (cols + '   ').slice(0, 3) + ('          ' + filas * cols).slice(-10) +
      (['historial', 'solicitudes'].indexOf(k) >= 0 ? '   (la lista no la lee)' : ''));
  });
  l.push('Suma de las 7 pestañas que lee la lista: ' + total + ' ms');

  // 2. La lista entera, como en un pedido (con la caché de cada pedido).
  l.push('');
  var hoy = hoyISO_(), ayer = sumarDiasISO_(hoy, -1);
  [hoy, ayer].forEach(function (iso) {
    reiniciarCache_(true);
    var t0 = Date.now(), r = accLeerLista_({ fecha: iso });
    var ninos = r.clases.reduce(function (n, c) { return n + c.ninos.length; }, 0);
    l.push('Lista completa del ' + iso + ': ' + ms(t0) + ' ms (' + r.clases.length + ' clases, ' + ninos + ' niños)');
  });

  // 3. Lo mismo con la caché del pedido ya llena (lo que costaría si las pestañas no se releyeran).
  reiniciarCache_(true);
  accLeerLista_({ fecha: hoy });
  var t1 = Date.now();
  accLeerLista_({ fecha: ayer });
  l.push('Segunda lista con las pestañas ya leídas: ' + ms(t1) + ' ms (lo que cuesta armarla sin leer de nuevo)');
  l.push('');
  l.push('Tiempo total de esta medición: ' + ms(t) + ' ms');
  reiniciarCache_(false);
  Logger.log(l.join('\n'));
  return l.join('\n');
}
