# Arquitectura del portal Vida en Arte 360

Documento vivo: toda entrega que cambie una capa, un archivo de lugar o la
forma de publicar lo actualiza en el mismo commit (ver `CLAUDE.md`).

Este repositorio es **público**. Aquí no van claves, direcciones `/exec`,
datos de niños ni nombres de personas del cliente.

## 1. Capas

```
 Navegador (páginas HTML + JS)
   presentación: comun/vea.css + comun/marca.js   (sin PHP, sin datos)
   capa de datos: comun/datos.js  (window.Datos) — la ÚNICA que hace fetch
        │  fetch same-origin, cookie de sesión «vea_portal»
        ▼
 Control de acceso (PHP en el cPanel)
   .htaccess → gate.php / puentes  ──  auth.php: requerir_sesion()
   permisos.php (roles)  ·  cuentas.php (usuarios)
        │
        ▼
 Puentes de datos (PHP)            after-school/api.php, pasar-lista/api.php,
                                   configuracion/api.php, kinder/csv.php, basededatos/api.php…
        │  POST JSON + clave compartida + usuario de la sesión
        ▼
 Apps Script (doPost)              after-school-script/AfterSchool.gs
        │  LockService, Solicitudes (idempotencia), Historial
        ▼
 Google Sheet                      VEA_AfterSchool_BD (una pestaña por tabla)
```

| Capa | Qué hace | Qué NO hace |
|---|---|---|
| Páginas | Muestran datos, arman formularios, validan para avisar antes. Esconden lo que el rol no puede usar. | No deciden nada: el servidor vuelve a validar todo. No llaman a ningún `.php`: piden todo a `Datos`. |
| Capa de datos (`comun/datos.js`) | Sabe a qué dirección va cada pedido, pone el ID de solicitud y el CSRF, y convierte las respuestas raras en un error con código (`sesion`, `incierto`, `cambiar_clave`…). | No decide nada ni pinta nada. |
| Control de acceso | Sesión, roles, área por carpeta, contraseña temporal, CSRF. | No conoce las reglas de After School. |
| Puentes | Exigen el permiso de cada acción, ponen la clave y el usuario, reintentan, recortan la respuesta según el rol. | No guardan datos ni aplican reglas de negocio. |
| Apps Script | Reglas de negocio (cupos, bajas, pruebas, pagos), idempotencia, Historial. | No sabe de roles: confía en el usuario que le pasa el puente. |
| Sheet | Almacena las tablas. | Sin fórmulas ni lógica: solo datos. |

## 2. Cómo viaja una petición (ejemplo: inscribir)

1. La página arma `{accion:'inscribir', datos:{…}, idSolicitud}` y hace `POST after-school/api.php`.
   El ID de solicitud es el mismo si la persona repite la misma acción con los mismos datos.
2. El `.htaccess` deja pasar `*/api.php` directo (regla 3b).
3. `api.php` carga `auth.php` → `requerir_sesion()`:
   sesión válida (cuenta activa, misma versión de contraseña), contraseña
   temporal ya cambiada y rol con `area:afterschool`. Si no, 302 al login o 403 JSON.
4. `api.php` exige el permiso de la acción (`permiso_de_accion_as`: inscribir → `as.completo`). Sin permiso: 403 `sin_permiso`; la petición no sale.
5. `api.php` arma el cuerpo con la **clave** (de `portal_config.php`) y el **usuario** de la sesión; descarta los que mande el navegador.
6. POST al `/exec` del Apps Script. Google contesta 302 al «echo»; `api.php` lo sigue a mano (solo a `*.googleusercontent.com`). Esperas: POST 5/40 s, echo 5/10 s. Lecturas y escrituras con ID se reintentan (hasta 3 ciclos; el 3.º no empieza pasados 60 s).
7. `doPost` → `atender_()`: valida clave y usuario, toma el lock (escrituras), mira en **Solicitudes** si el ID ya se procesó (si sí, devuelve lo guardado), ejecuta la acción, registra el ID y devuelve `{ok, resultado, estado}`.
8. `api.php` recorta la respuesta según el rol (contactos, pagos), agrega `permisos` y la devuelve.
9. La página aplica `estado` (el mismo formato que `leer`) y repinta.

### Pasar lista (21-oct; dentro de After School desde el rediseño)

`pasar-lista/api.php` carga las funciones de transporte de `after-school/api.php`
(con `AS_SOLO_FUNCIONES`) y solo admite `leerLista` y `guardarLista`. Fija
`soloHoy` según el rol y recorta la respuesta a una lista blanca.

Desde el rediseño (D-039) la **pantalla** de Pasar lista es una pestaña de
`after-school/index.html`; el **puente** sigue siendo `pasar-lista/api.php` con
todos sus cerrojos. El rol Profesor tiene `area:afterschool` (para abrir la
página) y `area:pasarlista` (para el puente), pero ningún `as.ver`:
`after-school/api.php` le contesta 403 a todo y la página le muestra solo Pasar
lista, sin pestañas. `/pasar-lista/` es una página que redirige a
`/after-school/#lista` conservando `?fecha=&clase=`.

**Por días (23-oct, AfterSchool.gs v8).** Encima de las clases, el día
(«Viernes 23 oct») con flechas y «Hoy»; la coordinación además tiene el
calendario. Hasta dónde llegan las flechas lo dice la respuesta de
`leerLista` (`desde`, `hasta`); un día futuro llega con `soloLectura` y la
lista se ve sin botones de marcar ni «Guardar», para el Profesor y para la
coordinación (que ve, como mínimo, lo mismo que el Profesor). La regla la vuelve a exigir
el Apps Script en cada lectura y escritura (`limiteProfesor`, que pone
`pasar-lista/api.php`). El Profesor, que entra directo a Pasar lista, tiene
en el encabezado una fila propia con «Inicio» y «Procesos»
(`Marca.cabecera({accesos})`, 44 px, visible también en celular).

**Ajustes tras producción (23-oct, v9).** Cambio de día: cada pedido lleva
un número (`LISTA.pedido`) y su fecha; al cambiar de día la lista se borra al
instante y queda «Leyendo la lista…»; la respuesta que no sea del día en
pantalla se descarta. Los días leídos quedan en memoria (`LISTA.cache`) y se
leen antes el día anterior y el siguiente (`precargarVecinos`). Desmarcar:
tocar otra vez el estado; al guardar, `quitar` / `quitarFuera` (ver
`ACCIONES_API.md`). **De dónde viene la demora:** Pasar lista no tiene copia
temporal (la lista cambia mientras se pasa): cada lectura es PHP → Apps Script
(dos pasos, POST y la respuesta en `googleusercontent`) → lectura de 7
pestañas → vuelta. PHP suma milisegundos; casi todo el tiempo es Google. La
respuesta trae `tiempos: {script_ms, total_ms}` (y la cabecera
`Server-Timing`); la pantalla lo escribe en la consola del navegador.

**Demora de Pasar lista (23-oct): diagnóstico y opciones.**

*Medido en producción* (total / servidor del portal / esperando a Google, en
ms): 19-oct 2784/2710/2710 · 22-oct 3554/3478/3477 · 23-oct 8360/8281/2636 ·
22-oct 8849/8776/3915 · 24-oct 11882/11803/3033 · 21-oct 8002/7929/4821 ·
20-oct 11600/11524/4030. Con un pedido solo, el portal no suma nada; con la
precarga (tres pedidos a la vez) el portal sumaba 5–9 s: era la **fila de la
sesión**, ya corregida (D-068). Lo que queda es Google: **2,6–4,8 s por
lectura**.

*Qué hay dentro de esos segundos* (por lo que hace el código; los números de
cada pestaña los da `MedirLectura.gs`, que se ejecuta desde el editor):
arranque del Apps Script como aplicación web; dos idas y vueltas (el POST y la
respuesta en `googleusercontent`); y la lectura **entera** de 7 pestañas
(Niños, Clases, Inscripciones, Pruebas, Asistencia, Clases sin dictar,
Config). Asistencia crece todos los días y se lee completa aunque la lista
sea de un solo día.

*Opciones (propuestas, NO construidas; la solución de fondo es la Fase 1,
Firebase):*

| | Qué | Ahorro esperado | Esfuerzo | Riesgo |
|---|---|---|---|---|
| A | Leer de Asistencia solo las filas recientes (la lista mira un día y la ventana es de 7): las últimas N filas, o una pestaña de archivo para lo de hace más de 3 meses | crece con el tiempo: hoy poco, en meses lo más grande | bajo | bajo, si Asistencia sigue en orden de escritura |
| B | Leer solo las columnas que usa la lista (Niños: ID, nombre, apellidos, nacimiento; Inscripciones: niño, clase, alta, baja) | 20–40 % de la lectura de esas pestañas | bajo | bajo (el mapa de títulos ya existe) |
| C | Copia corta en el Apps Script (CacheService, 2–5 min) de lo que no cambia durante la clase: Clases, Niños, Config, Inscripciones; Asistencia y Pruebas siempre frescas; la copia se borra en cada escritura que toca esas pestañas | lo mayor hoy: deja de leer 4 de las 7 pestañas en la mayoría de los pedidos | medio | un cambio hecho a mano en el Sheet tarda hasta 5 min en verse |
| D | Todas las pestañas en una sola llamada (servicio avanzado de Sheets, `batchGet`) | menos idas y vueltas dentro de Google | medio | hay que activar el servicio avanzado en el proyecto |
| E | Mantener despierto el Apps Script (un activador cada 5–10 min) | quita el arranque en frío (el primer pedido tras un rato sin uso) | bajo | consume cuota de ejecuciones |
| F | Copia en el servidor del portal de la respuesta de un día FUTURO (solo lectura) por 1–2 min | los días futuros vuelven al instante | bajo | ninguno para marcar (los días que se marcan siguen frescos) |

Recomendación: correr `MedirLectura.gs` primero; con sus números, empezar por
**C + B** (lo que más ahorra con poco riesgo) y **A** cuando Asistencia
pese. Nada de esto se construye sin la aprobación de Marco.

## 2b. Presentación y entrada (21-oct, rediseño con la marca Vida en Arte)

| Pieza | Qué es |
|---|---|
| `comun/vea.css` | (3-nov: con `comun/armazon.css`, la estructura común; ver §2i) El archivo de estilos del portal (variables de color, botones en píldora, tarjetas, pestañas, ocupación, Pasar lista, adaptaciones a tablet y celular). Dos temas sobre los mismos componentes: Vida en Arte (por defecto) y **Vida en Arte Kids** (`.tema-kids` en `<html>`: solo cambia variables; lo usa Preschool). |
| `comun/marca.js` | `window.Marca`: desde el 3-nov, la estructura común (barra lateral, superior e inferior, notificaciones, buscador, «Nuevo», partículas y esqueletos; §2i), avisos y formato de fechas. |
| `comun/datos.js` | `window.Datos`: la capa de datos (ver la tabla de capas). Es lo único que habría que reescribir para hablar con otro servidor (Firebase o Supabase). |
| `comun/logo-vea.png`, `comun/logo-kids.png` | Logos. |
| `comun/app.webmanifest`, `comun/app-icono-{180,192,512}.png` | **App instalable** (23-oct): el manifiesto (nombre «Vida en Arte 360», corto «VEA 360», empieza en `/`, abarca todo el sitio, pantalla completa sin barra del navegador) y los íconos (el símbolo de las tres bolitas sobre blanco; el de 512 sirve también de «maskable»). Todas las páginas con la marca los enlazan en el `<head>`, así que se instala desde cualquier pantalla: Android/Chrome «Instalar app», iPhone Safari › Compartir › «Agregar a inicio». **Sin service worker**: nada se guarda para usar sin conexión y no hay una caché más que pueda servir una página vieja o una sesión vencida. |
| `comun/.htaccess` (`comun/htaccess.txt` en el repo) | Segundo cerrojo: sin listado, sin CGI, y niega `.php`, `.phtml`, `.phar`, `.html` y otros aunque alguien los suba. |
| `login.html`, `cambiar-clave.html` (raíz) | Páginas **fijas** (sin PHP). Piden su estado a `login.php?estado=1` / `cambiar-clave.php?estado=1` y mandan el formulario por JSON. `login.php` y `cambiar-clave.php` sin `estado` redirigen a la página fija (direcciones viejas). |
| `acceso.php?formato=json` | Quién soy: `{usuario, roles, areas, inicio, inicioAS, permisosAS}`. Sin `formato`, el JS de antes (para poder volver atrás). |

**Versión en cada referencia a `comun/` (22-oct).** Las páginas cargan
`/comun/vea.css?v=<hash>` (y igual `marca.js`, `datos.js` y los logos): el
hash son 10 caracteres del sha256 del contenido del archivo, así que cambia
solo cuando el archivo cambia y el navegador nunca usa un `vea.css` viejo de
su caché. Lo pone `pruebas-portal/versionar-comun.js --escribir` (también a
`marca.js`, que carga el logo); `prueba-versiones.js` falla en Actions si una
página carga algo de `comun/` sin versión o con una vieja. El servidor ignora
el `?v=` (el `.htaccess` y `gate.php` miran solo la ruta). Preschool y Base de
Datos viven en otras ramas: se versionan pasando sus rutas al mismo comando.

**Sin sesión se entrega solo:** `login.html`, `cambiar-clave.html` y
`comun/<nombre>.(css|js|png|svg|webmanifest)` (un nombre simple, sin subcarpetas; el
navegador pide el manifiesto y los íconos sin cookies, por eso son públicos). Lo hace
el `.htaccess` (reglas 3 y 3c) y, por si el servidor tuviera un `.htaccess`
anterior, también `gate.php` antes de pedir sesión. Cualquier otra cosa dentro
de `comun/` responde 403 (regla 3c), y `comun/.htaccess` niega PHP aunque la
regla faltara.

**Por qué no hay bucle de redirección** (el error del 20-oct): `requerir_sesion()`
solo redirige a `login.html` o `cambiar-clave.html`, que se entregan **sin**
sesión; esas páginas nunca redirigen desde el servidor, y deciden a dónde ir
con la respuesta JSON. `prueba-portal.js` recorre el login con contraseña
temporal con el `.htaccess` nuevo y con el anterior y falla si hay más de 8 saltos.

**A dónde va cada rol tras entrar** (`destino_inicio` y `inicio_as` en `permisos.php`):
si pidió una dirección, a esa; si su rol abre **una sola** sección, directo a
ella; si no, a la portada. Dentro de After School, la pestaña de entrada es la
del rol (`inicio_as`): Ocupación (Administrador, Dirección, Coordinación After
School), Visitas del día (Recepción, Comercial), Pagos (Contabilidad), Pasar
lista (Profesor). La portada no muestra contadores.

### Segunda ronda de diseño (22-oct)

- **Ocupación compacta.** Cada clase en una línea («● Parkour 16/20»); el
  fondo se llena con el tinte del servicio según inscritos + visitas que
  ocupan cupo; desde «casi lleno» (umbral de Config), borde del color del
  servicio y número en negrita. La edad, los niños y las visitas salen al
  tocar la clase. La semana va en **bloques**: lunes a viernes y, aparte, el
  fin de semana; cada bloque lleva solo los días con clases y solo los
  horarios que tienen clases en ese bloque (se calcula de la pestaña Clases).
  Por debajo de 1000 px, vista **por día**.
- **Sin botón «Actualizar».** Al cambiar de pestaña o de semana la página
  relee `leer` en silencio si lo leído tiene más de 30 s; no relee con un
  diálogo abierto ni mientras guarda, y solo repinta si algo cambió.
- **Pasar lista** compacta con mouse (`@media (pointer: fine)`, sin
  `.solo-lista`): filas de ~44 px y botones de ~36 px. En pantallas táctiles
  y para el Profesor sigue grande (≥ 52 px).

### Páginas de las unidades con la marca (22-oct)

| Página | Dónde vive el código | Marca | Datos |
|---|---|---|---|
| Preschool (`/kinder/`) | **Desde el 28-oct, la carpeta `kinder/` de este repo** (`index.html`, `config.php`, `csv.php`; antes, la rama `preschool-procesos` con `dashboard-kinder.html`) | Tema Kids, encabezado estándar con el logo Kids | `config.php` → `csv.php` (no pasa por `datos.js`). **Operativo, sin finanzas** (D-083): `csv.php` rehace las tablas sin montos, sin plan y sin responsable (R138) |
| Base de Datos (`/basededatos/`) | Repo `bdclientesvea`, rama `marca-vea` | `vea.css` en una capa `@layer` (sus reglas mandan), encabezado estándar | Igual que antes: `api.php` directo. **No pasa por `datos.js`**: la lectura mira el texto crudo para distinguir una página de Google de una hoja vacía |
| Veranito (`/veranito/`) | `veranito/index.html` (hub de enlaces: tarjetas de herramientas y «Copiar link») | `vea.css` en una capa `@layer` y, si existe `/comun/marca.js`, la estructura común (3-nov: con la barra lateral; su barra propia se oculta). Sin `/comun/` se ve idéntica a antes | Solo `/acceso.php` (formato JS), igual que antes; no llama a ningún puente |
| Sistema Operativo | GitHub Pages (`portal-v2.html`) | Reemplazado por **Proyecto Actio** (`/proyecto-actio/`, abajo). Desde el 23-oct `portal-v2.html` redirige allá (en `main`) | — |

Preschool, Base de Datos y Veranito funcionan igual si `/comun/` no existiera: la página sigue
sin encabezado (Preschool) o con su barra de siempre (Base de Datos).

## 2c. Proyecto Actio (22-oct)

Lo que Actio Growth le entrega a Vida en Arte, en un solo lugar del portal.
Reemplaza al «Sistema Operativo» de GitHub Pages. **Solo lectura.**

```
 /proyecto-actio/index.html  ── datos.js: Datos.proyectoActio.leer()
        │  POST {accion:'leer'}
        ▼
 proyecto-actio/api.php      requerir_sesion (área proyecto-actio: Ad, Di)
        │                    copia en /home/…/portal_cache/ (pa_cache_seg)
        │                    RECORTE: Dirección solo pa_proyectos_cliente;
        │                    lista blanca de campos (nada interno de Actio)
        ▼
 ProyectoActio.gs (doPost)   clave PA_CLAVE_API · solo «leer» · por títulos
        ▼
 Sheet «Datos — Vida en Arte» (lo escribe Actio desde el Tablero de Tareas)
```

- La pantalla (23-oct): cabecera como el resto del portal («Proyecto
  Actio», «Desde <mes más antiguo de todos los datos> · datos al <fecha>» y
  el selector Proyecto 1 / Proyecto 2, este con «Solo Actio», solo
  Administrador). Pestañas: Entregables («N entregables · X % entregados»;
  filas por unidad con su color; un botón por versión que abre ESA versión
  en el visor; el estado solo si no está entregado), Documentos (TODAS las
  filas de «Documentos VEA», también las que no tienen entregable, por
  unidad; bajo el nombre, la versión —Documento, Presentación, Interactiva
  o Video— y la fecha; con Abrir y Descargar), Reuniones (por mes, fecha en forma de
  calendario, Minuta y Grabación) y Acompañamiento (horas, encuentros y
  reuniones; horas por mes en barras; el detalle desplegable).
  Unidades y meses son desplegables (botón con aria-expanded), cerrados al
  abrir cada pestaña; el buscador (Entregables y Documentos) abre solo los
  grupos donde encuentra resultados.
- El visor (`comun/visor.js`) muestra el documento en la misma página, con
  una pestaña por versión (Documento, Presentación, Interactiva): Drive en
  `/preview`, Google Docs/Hojas/Presentaciones en `/preview` (solo lectura),
  Gamma en su modo de inserción; cualquier otro enlace, en pestaña nueva.
  Descargar solo donde hay un archivo que bajar (Drive y Google Docs).
- El portal depende solo del **enlace** de cada documento, no de quién es su
  dueño: cuando los documentos pasen a una unidad de Vida en Arte o el
  catálogo a Firebase, cambian los enlaces o la fuente, no la pantalla
  (modelo en `MODELO_DATOS.md`).

**Visible para el cliente** (23-oct): columna opcional en Entregables y
Documentos VEA; la regla la aplica `api.php` (ver `ACCIONES_API.md`). La
pantalla de Administrador marca con «Oculto al cliente» lo que Dirección no
ve.

**Presentaciones privadas** (23-oct; **desde la tarde del 23-oct viven en
`/biblioteca/` y las abre cualquier usuario con sesión: ver 2d**):
`/proyecto-actio/archivos/` guardaba presentaciones `.html` que solo se
abrían con sesión y con el área `proyecto-actio` (las entrega `gate.php`,
como `text/html`, sin caché).
Segundo cerrojo: `proyecto-actio/archivos/.htaccess` (sin listado, sin
ejecutar scripts aunque alguien suba un `.php`). Nombres: solo minúsculas,
números y guiones, terminados en `.html` (`^[a-z0-9][a-z0-9-]*\.html$`); el
Enlace del Sheet es la ruta: `/proyecto-actio/archivos/<nombre>.html`. El
visor las abre en un iframe con `sandbox="allow-scripts allow-popups
allow-popups-to-escape-sandbox"`, **sin `allow-same-origin`**: la
presentación corre en un origen propio y no ve la sesión ni la página del
portal (comprobado: las presentaciones no usan almacenamiento ni cookies).
Pantalla completa por el botón del visor o el de la propia presentación.
Ojo: un archivo de esta carpeta lo abre cualquier Administrador o
Dirección que conozca su ruta; «Visible para el cliente» oculta la fila, no
el archivo.

**Sección «Procesos»** (construida el 23-oct, ver 2d; esta era la idea
inicial): cada rol verá las presentaciones de procesos que le tocan (p. ej. Recepción las de atención,
Coordinación las de su unidad). Reutilizará estas mismas piezas: archivos
privados del portal, visor aislado y un catálogo en el Sheet con una columna
de roles.

**Instalar el Apps Script** (lo hace Actio, una sola vez):
1. Abrir el Sheet «Datos — Vida en Arte» › Extensiones › Apps Script.
2. Pegar `proyecto-actio-script/ProyectoActio.gs` (reemplazando lo que haya en
   un proyecto nuevo) y guardar.
3. Configuración del proyecto (engranaje) › Propiedades del script › Agregar:
   `PA_CLAVE_API` = una clave nueva de 32 caracteres o más (no la de After School).
4. Implementar › Nueva implementación › Tipo: Aplicación web ›
   Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier usuario** › Implementar
   (autorizar con la cuenta de Actio la primera vez).
5. Copiar la dirección `/exec` y la clave a `portal_config.php` (abajo). Si
   después se cambia el `.gs`: Implementar › Gestionar implementaciones ›
   editar › **Nueva versión** (la dirección `/exec` no cambia).

**`portal_config.php`** (fuera de la carpeta pública), dentro del `return [ … ]`:
```
  'pa_exec'              => '',                // la dirección /exec del paso 5
  'pa_clave'             => '',                // la misma que PA_CLAVE_API
  'pa_proyectos_cliente' => ['Proyecto 1'],    // los proyectos que ve Vida en Arte
  'pa_cache_seg'         => 300,               // segundos de la copia del servidor (opcional)
```
La carpeta `portal_cache/` la crea `api.php` sola junto a `portal_config.php`.

## 2d. Portada por marca y Procesos (23-oct)

**Portada.** `/` ya no lista todas las unidades: arriba, una tarjeta grande
por marca con su logo (Vida en Arte, Vida en Arte Kids) y debajo, en su
propia fila, **Procesos**; abajo, Administración como antes. Tocar un logo
abre la página de la marca, que es la misma portada con `?marca=vea` o
`?marca=kids` (esta con el tema Kids): sus unidades, con las «Próximamente»
atenuadas. Cada tarjeta aparece solo si el rol tiene su área; un logo sin
unidades del rol no aparece. Qué unidad va en qué marca está en dos sitios
que la prueba compara: `MARCAS` de `comun/marca.js` (pantalla y migas) y
`MARCAS` de `permisos.php` (entrada directa).

| Marca | Unidades (área) |
|---|---|
| Vida en Arte | After School (`afterschool`), Veranito (`veranito`), Cumpleaños (`cumpleanos`) |
| Vida en Arte Kids | Preschool (`kinder`), Baby & Me (`babyandme`) |

**Entrada** (`destino_inicio` → `destino_de_areas`): una sola sección → directo
a ella; si todo lo que abre son unidades de una misma marca → la página de
esa marca; si no, la portada. Procesos no cuenta (`AREAS_SIN_ENTRADA`): todos
lo tienen y llegan a él desde Inicio. Las páginas de unidad llevan la miga
«Inicio / <Marca> / <Unidad>» (`Marca.rutaUnidad`): After School, Veranito y
Preschool.

**Procesos** (`/procesos/`, área `procesos`, todos los roles): la biblioteca
permanente de Vida en Arte. Cuando termine el contrato, Proyecto Actio se
apaga y Procesos queda.

```
 /procesos/index.html   ── datos.js: Datos.procesos.leer()
        │  POST {accion:'leer'}
        ▼
 procesos/api.php       requerir_sesion (área procesos: todos)
        │               carga proyecto-actio/api.php con PA_SOLO_FUNCIONES:
        │               la misma lectura, la MISMA copia y pa_recortar
        │               SIN pa.internos (lo que ve el cliente) para todos;
        │               después: solo documentos de los tres procesos,
        │               permiso por fila y lista blanca de 5 campos
        ▼
 ProyectoActio.gs → Sheet «Datos — Vida en Arte» (pestaña Documentos VEA)
```

- UNIDAD → PROCESO → DOCUMENTOS. Primer nivel: las unidades con al menos un
  documento, con su color e iniciales (`Marca.unidadDoc`, la misma tabla que
  Proyecto Actio); «Gerencia» va como **General**, al final. Al abrir una
  unidad (`#u=<unidad>`): Atracción, Adquisición y Entrega de servicio, en el
  orden de `procesos_segmentos`; un proceso sin documentos no se muestra.
- Filas: nombre, versión · fecha, Abrir (visor) y Descargar si aplica. Un
  buscador busca en todas las unidades.
- Qué segmento es qué proceso y qué unidades van en General viven en
  `portal_config.php` (`procesos_segmentos`, `procesos_general`): si faltan,
  el puente responde `sin_configuracion` nombrándolos.
- Permiso por unidad y proceso **preparado**: `procesos.ver:*` (hoy todos),
  `procesos.ver:<unidad>` o `procesos.ver:<unidad>:<proceso>`.

**Visor común** (`comun/visor-pantalla.js`): el diálogo a pantalla entera
(Descargar, Pantalla completa, versiones como pestañas) que antes vivía en
`proyecto-actio/index.html`. Lo usan Proyecto Actio y Procesos.

**Biblioteca** (`/biblioteca/`): las presentaciones `.html` privadas se
mudaron de `/proyecto-actio/archivos/`. Las abre **cualquier usuario con
sesión** (carpeta en `CARPETAS_LIBRES`: sin área). Sin listado; ningún
script se ejecuta (regla 3d del `.htaccess` de la raíz, que va antes de la
de los puentes, y `biblioteca/.htaccess`). `gate.php` responde
`/proyecto-actio/archivos/<nombre>.html` con un 301 a
`/biblioteca/<nombre>.html`, y el visor ya muestra esa ruta vieja desde
`/biblioteca/`: los enlaces del Sheet no se rompen. **Ojo**: un archivo de la
biblioteca lo abre cualquiera con sesión que conozca su ruta; «Visible para
el cliente» oculta la fila, no el archivo. Lo que sea solo de Actio no va en
la biblioteca.

## 2e. Equipo, Resumen de Dirección y estilo vidrio (26-oct)

**Fuente única**: el Sheet «Procesos — Vida en Arte» (cuenta de Actio, en la
misma carpeta que «Datos — Vida en Arte»). Actio edita ahí los puestos, los
contratos, las listas y las asignaciones; el portal **lee siempre de ahí**
(ningún texto de contrato está copiado en el código) y **solo escribe** en
Aceptaciones, Marcas y Revisiones. Pestañas y columnas en
[MODELO_DATOS.md › Procesos](MODELO_DATOS.md).

```
pantalla (procesos/#equipo, /equipo/, /resumen/)
   │  comun/datos.js › Datos.equipo
   ▼
equipo/api.php  ── sesión + área «equipo» → suelta la sesión → copia corta (60 s)
   │  { key, usuario, accion, datos }  (transporte de after-school/api.php)
   ▼
procesos-script/Procesos.gs  (Apps Script ligado al Sheet; clave PR_CLAVE_API)
```

- **El recorte lo hace `equipo/api.php`**: el script devuelve el Sheet entero
  y el puente arma la respuesta de cada persona (quién ve qué, en
  [ACCIONES_API.md › Equipo](ACCIONES_API.md)). Sin `equipo.todo`
  (Dirección y Administrador lo tienen por `*`), del organigrama llegan solo
  el nombre, el área y a quién reporta cada puesto, con «En construcción» si
  no está abierto; una ficha, solo de un puesto «Abierto al equipo» que la
  persona ocupa o del que es jefe. Un puesto con «Visible solo para» (26-oct)
  solo existe para esos usuarios o roles, Dirección y Administrador: sirve de
  puesto de prueba.
- **Ocupar** un puesto: una fila vigente de Asignaciones con el usuario o con
  el rol («Usuario del rol Coordinación After School» o solo el nombre del
  rol). Una persona puede ocupar varios puestos. **Jefe**: ocupa el puesto de
  «Reporta a», o uno de más arriba.
- **Escribir**: aceptar y marcar solo quien ocupa el puesto; revisar solo
  quien figura en «Verifica» (hoy «Dirección») o es su jefe; siempre en
  puestos abiertos. Lo vuelve a mirar el script: estado, versión vigente y el
  período (lo calcula el script con la fecha de hoy y «Cada cuánto»).
- Permiso por puesto **preparado**: `equipo.ficha:<ID>` abre la ficha de ese
  puesto a un rol aunque no lo ocupe (hoy no lo tiene nadie).
- **Pantallas**: Procesos tiene dos vistas, «Por unidad» (la biblioteca) y
  «Por equipo» (`#equipo`, organigrama de `comun/organigrama.js` con la ficha
  en un panel; en celular, a pantalla completa). **Mi lista** (`/equipo/`,
  pensada para tablet) y **Revisar** (`/equipo/#revisar`). La portada
  muestra «Mi lista» solo a quien ocupa un puesto abierto.
- **Resumen de Dirección** (`/resumen/`, área `resumen`: solo Dirección y
  Administrador). No tiene puente propio: junta lecturas que ya existen
  (After School `leer` y `seguimiento`, Equipo `leer`); la ocupación de
  After School, con `comun/cifras.js` (26-oct). Cifras y lo que quedó
  fuera, en [ACCIONES_API.md › Resumen](ACCIONES_API.md). Finanzas dice
  «Próximamente», sin números.

**Estilo vidrio** (RETIRADO el 3-nov en el rediseño, §2i; queda como historia) (`vea.css`, tema por página: `<html class="vidrio">`): foto
de fondo `comun/fondo-local.jpg` (1600×1200, 40 KB) con un velo oscuro del
60 %, tarjetas semitransparentes con desenfoque, borde claro y sombra; los
títulos sobre la foto en blanco con sombra. Lo llevan la portada (y la página
de cada marca, que es la misma), Procesos, Equipo, Mi lista y Resumen. **No**
lo llevan Pasar lista, After School, Configuración, los formularios ni la
Base de Datos. Sin desenfoque en el navegador (`@supports not
(backdrop-filter…)`) o con «reducir transparencia» del sistema, las tarjetas
salen sólidas. Contraste medido: texto blanco sobre el punto más claro de la
foto con el velo, 5,3:1 (AA pide 4,5:1).

**Instalar el Apps Script** (una vez):

1. Abrir el Sheet «Procesos — Vida en Arte» › Extensiones › Apps Script.
2. Pegar `procesos-script/Procesos.gs` y guardar.
3. Configuración del proyecto › Propiedades del script: `PR_CLAVE_API` con
   una clave larga (24 caracteres o más).
4. Implementar › Nueva implementación › Aplicación web: ejecutar como «yo»,
   acceso «cualquier usuario». Copiar la dirección `/exec`.
5. En `portal_config.php` (fuera de la web): `'pr_exec' => '…/exec'`,
   `'pr_clave' => '…'` (la misma de `PR_CLAVE_API`) y, si se quiere,
   `'pr_cache_seg' => 60`. Sin `pr_exec` y `pr_clave`, el puente responde
   `sin_configuracion`.

## 2f. Ajustes de Equipo y Resumen del negocio (26-oct)

- **Procesos** entra por dos tarjetas: «Documentos» (`/procesos/#documentos`:
  la biblioteca por unidad, con el buscador; los documentos se leen al
  entrar) y «Equipo» (`/procesos/#equipo`). Ruta «Inicio / Procesos /
  Documentos» y «Inicio / Procesos / Equipo» (en celular, sobre el título).
- **Organigrama** (`comun/organigrama.js`): en computador y tablet un árbol
  que se arrastra y se acerca (rueda, pellizco, − / + / «Ajustar»), con las
  áreas en una fila y líneas del color del área; en celular, lista por áreas.
  La ficha es un `<dialog>` centrado sobre el organigrama desenfocado (Esc,
  la X o tocar afuera la cierran; el foco no sale). Las mismas reglas de
  quién ve qué (R119).
- **Resumen del negocio** (`/resumen/`): la pantalla lee `resumen/api.php`
  (metas y Preschool) y After School `leer`; todas las cuentas en
  `comun/cifras.js`. Finanzas con su contrato listo y «Próximamente» hasta
  que haya fuente.

```
resumen/index.html ─ Datos.resumen.leer() ─▶ resumen/api.php ─┬─ eq_sheet (Procesos.gs: pestaña Metas)
                   │                                          └─ csv.analisis + csv.config (tablas de Preschool; solo conteos)
                   └─ Datos.afterSchool('leer') ─▶ after-school/api.php
portada ─ Datos.pendientes.leer() ─▶ pendientes/api.php ─┬─ After School seguimiento / leer (solo si el rol lo atiende)
                                                        └─ eq_sheet + eq_vista (Equipo)
```

- **Pendientes de hoy** (portada): `pendientes/api.php` (área `equipo`)
  decide con los permisos de cada rol qué cuenta (R130).
- **Nombre y apellido** en las cuentas del servidor; `acceso.php` los manda
  con la sesión; `Marca.cabecera` y `Marca.saludo` los usan.
- `equipo/api.php` y los dos puentes nuevos se cargan uno a otro con
  `EQ_SOLO_FUNCIONES` (solo funciones), como `AS_SOLO_FUNCIONES`.
- **Reglas de After School del Resumen (27-oct)**: altas, bajas y pruebas que
  se inscriben (R134–R137) salen de After School `leer`, sin puente nuevo:
  `AfterSchool.gs` v10 agrega `bajas` (solo ID niño y fecha) y dos
  parámetros de Config; las cuentas, en `comun/cifras.js`. Cuando se
  unifiquen las bases, solo cambia de dónde sale `leer`.

**Metas** (una vez, tras pegar `Procesos.gs` v2): en el editor de Apps Script
elegir `actualizarEstructura` y «Ejecutar». Crea la pestaña «Metas» con sus
títulos y listas, y agrega «Visible solo para» a Puestos si faltara. No
mueve ni borra nada.

## 2g. Equipo v2 (29-oct): contrato en formato papel, hojas diarias, Reglas del juego, Horarios y organigrama 3D

- **Datos**: Procesos.gs **v3** lee además Hojas, Reglas del juego, Horarios
  del servicio y Marcas de hojas (esta la crea él mismo la primera vez que
  escribe, o `actualizarEstructura()`, que también agrega su renglón al
  Léeme). Acción nueva `marcarHoja`; `revisar` con `hoja` (contrato en
  [ACCIONES_API.md › Equipo](ACCIONES_API.md)). El portal escribe solo en
  Aceptaciones, Marcas, Marcas de hojas y Revisiones.
- **El puente** (`equipo/api.php`) empareja «Verifica» con el nombre de un
  puesto, sube la verificación a Dirección cuando alguien se verificaría a sí
  mismo, manda a todos las Reglas del juego y la hora de cada momento, y la
  tabla de Horarios solo con `equipo.todo`. Quién ocupa qué: una sola
  función, `eq_asignaciones()` (hoy, la pestaña Asignaciones).
- **Colores de las áreas en un solo lugar**: `comun/puestos.js` (`AREAS`).
  Qué áreas hay y su orden salen de Puestos. El mismo archivo busca los
  momentos dentro de los textos (`momentosEn`) para poner la hora al lado;
  lo usan la ficha y Mi lista.
- **Organigrama «Escenario 3D»** (`comun/organigrama.js` + `vea.css`
  › Equipo v2), en `/procesos/#equipo`: la escena oscura (`<html
  class="eq-escena">`: degradado casi negro, brillos de los colores de las
  áreas, la foto del vidrio muy tenue, piso con cuadrícula y la barra de
  arriba en vidrio oscuro con el logo en blanco). Dirección arriba con su
  halo; las áreas en columnas; plano inclinado 7° con `perspective`;
  tarjetas con grosor que se levantan; «Por cargar» como vidrio con borde
  punteado. Entrada en cascada (~2,5 s, una vez), luz en las líneas, chispas
  (16, máximo 20), halo. Solo `transform` y `opacity`; se pausa con la
  pestaña oculta; «reducir movimiento» = quieto; «reducir transparencia» o
  sin desenfoque = fondo plano sin foto ni animación. Se mantienen mover,
  acercar y «Ajustar». En celular, la lista por áreas, sin 3D.
- **Ficha** (`<dialog>`): el formato del contrato en papel («Contrato de
  posición», tabla Puesto · Unidad · Reporta a, 1. Resultado, 2. Trabajo,
  3. Estándares, 4. Aceptación); debajo, la lista de verificación y cada hoja
  diaria (por momento; cada paso se marca al tocarlo con la hora y las
  iniciales; el mismo día se desmarca; quien verifica tiene el formulario).
  **Aceptar** solo con el puesto «Abierto al equipo» y a quien lo ocupa, y
  pasa antes por las Reglas del juego con la confirmación «Leí las Reglas del
  juego». **Descargar PDF**: una hoja de impresión propia (`#eq-impresion`,
  `@media print`, letra Inter, títulos en verde, firma, nombre y fecha) y el
  diálogo de imprimir del navegador; sin librerías; sin las horas de los
  momentos (pueden cambiar sin que cambie el contrato).
- **Rutas** de `/procesos/`: `#equipo`, `#reglas` (Reglas del juego, todos),
  `#horarios` (Horarios del servicio, Dirección y Administrador) y
  `#puesto=<ID>` (Equipo con esa ficha abierta; Mi lista enlaza ahí para la
  hoja diaria).
- **Ajuste 1 (30-oct)**: «Ajustar» encaja el árbol al ANCHO del lienzo (sin
  pasar de escala 1) y el lienzo crece hasta mostrarlo entero; la página baja
  con su scroll (la rueda sola y el dedo bajan la página; Ctrl con la rueda, o
  el pellizco, acercan). Si a ese ancho la letra quedaría por debajo de la
  escala 0,85 (`M.legible`), las áreas se reparten en filas parejas
  (tablet vertical: dos filas de 3), unidas por un tronco a la izquierda; al
  girar la tablet se vuelve a repartir. En Equipo la página llega a 1440 px de
  ancho. Los avisos del Sheet (solo Dirección y Administrador) van en una
  franja «Avisos del Sheet (n)» que se despliega.
- **Ajuste 2 (30-oct): el clic en las tarjetas.** Con el plano inclinado en 3D
  (`rotateX` con perspectiva), Chrome ubicaba mal un botón que además tenía
  su propia transformación (`translateZ`, y al pasar el cursor
  `translateY` + `translateZ`): el clic caía en la columna (`.eq-hijos`) y
  la ficha no se abría. Ahora cada tarjeta es un botón SIN transformación
  (la zona de clic) y lo que se ve y se levanta es su cara (`.eq-cara`), que
  no recibe clics; tampoco las líneas, el halo ni los trazos. Con el mouse, a
  la escala de «Ajustar» no se arrastra (sin manito; la mano de clic solo
  sobre las tarjetas); acercado con + o Ctrl + rueda, sí; en pantalla
  táctil, siempre. Lo prueba `pruebas-portal/prueba-clics-organigrama.js`
  con clics y toques reales en Chrome (Playwright).
- **Página aparte del organigrama**: no existe en el portal (se buscó en el
  código y en el servidor de pruebas); el único organigrama es este.

## 2h. Equipo v3 (2-nov): ficha en pestañas, contrato como el PDF, lista con marcas y desmarcadas

- **Datos**: Procesos.gs **v5**. Marcas con Resultado «Ejecutado», «No
  ejecutado» o «Desmarcada»; acción nueva `desmarcar` (quitar una marca
  propia mientras siga su período: agrega «Desmarcada», nunca borra);
  `marcarHoja` tampoco borra ya (D-094). `leer` manda el calendario de 120
  días y la forma de cada punto y paso (D-095). `actualizarEstructura()`
  agrega Resultado y Nota a Marcas de hojas, Asignación a Hojas y sus
  renglones del Léeme. Columnas en [MODELO_DATOS.md](MODELO_DATOS.md);
  acciones en [ACCIONES_API.md › Equipo](ACCIONES_API.md).
- **El puente** traduce las marcas viejas (`eq_resultado`), deja pasar
  `desmarcar` solo a quien ocupa el puesto y manda al script solo puesto,
  orden y fecha; marca las hojas temporales.
- **La lista de verificación es una sola pieza**: `comun/verificacion.js`
  (`Verificacion.crear`), que usan la pestaña «Lista de verificación» de la
  ficha y Mi lista (`equipo/index.html`, sin botón Guardar). Se guarda al
  tocar; «No ejecutado» y los puntos por evento abren la nota obligatoria;
  la marca propia se quita tocándola; Pendiente / Vencido y el selector de
  fecha (solo lectura en días anteriores). Quien no ocupa el puesto la ve de
  solo lectura, con las marcas quitadas y el enlace a Revisar. Revisar
  muestra también las quitadas.
- **Ficha** (`comun/organigrama.js`): pestañas Contrato · Lista de
  verificación · Hojas del día (flechas del teclado entre pestañas). La
  pestaña Contrato es la hoja del PDF (`papelHtml`, la misma que imprime
  «Descargar PDF», sin las horas). «Ampliar» pone el mismo `<dialog>` a
  pantalla completa (clase `amplio`, letra de 18 px); Esc, la X y «Volver»
  regresan; desde ahí, Descargar PDF y Aceptar (por las Reglas del juego).
  Subpuntos «N.M »: `conSubpuntos` los cuelga del punto general de arriba.
  Las hojas: cada paso en su período (día, semana o mes), «Pendiente ·
  esta semana / este mes», «Vencido», «Asignación temporal» y la hora del
  momento junto al nombre de la hoja («Por definir» si no tiene).
- **Rutas**: `/procesos/#puesto=<ID>&pestana=lista|hojas` abre la ficha en
  esa pestaña; Mi lista enlaza a la de hojas.
- **Pruebas**: `procesos-script/pruebas/prueba-equipo-v3.js` (el script contra
  un Sheet en memoria, con roturas), `prueba-procesos.js` al día,
  `prueba-organigrama.js` (pestañas, contrato, Ampliar, subpuntos, lista y
  hojas), `prueba-clics-organigrama.js` (pestañas y Ampliar con clics y
  toques reales, computador y celular) y `prueba-portal.js` (el puente).

## 2i. Rediseño etapa 1 (3-nov): un solo sistema visual y la estructura común

**Por qué.** Había cuatro estilos (vidrio sobre foto, blanco plano, oscuro en
Equipo, otro en Veranito), títulos Bebas gigantes con texto de 11–13 px,
contenido en una columna angosta y ninguna navegación fija. Esta etapa deja un
sistema único y lo aplica a la base de todas las páginas. Decisiones D-097 a
D-104.

**Sistema visual** (`comun/vea.css`, `:root`): fondo `--fondo` #FAF8F5,
paneles `--panel` blancos con borde `--linea` #ECE8E2, radio 18 y sombra
suave; tinta `--tinta` #16181D, texto suave `--suave` #5B5F68, `--tenue`
#8A8E96 solo para detalles; botón principal `--accion` #D71C0E. Disciplinas
con color fijo en toda la app: `--parkour` #E0412F, `--telas` #1974A8,
`--parkids` #F2A01E, `--babyme` #7FB3D5. Estados `--ok` #278746 (ajuste 1: el verde justo para letra blanca a 4,5:1; uno solo en toda la app), `--alerta`
#E08A00, `--peligro` #D71C0E (con `*-texto` para letras sobre blanco y
`*-fondo` para etiquetas). Los colores de las áreas de Equipo siguen solo en
`comun/puestos.js`. Los nombres de antes (`--rojo`, `--texto`, `--gris`…)
siguen existiendo y apuntan a los nuevos, para que ninguna página se rompa.
Bebas Neue solo en el `h1` de cada página y en las cifras grandes
(`.cifra-grande`, `.titulo` en números); todo lo demás Poppins, texto base
15 px y nada de texto de trabajo por debajo de 13 px. Botones de 42 px de alto
(48 px en tablet táctil), pestañas subrayadas, etiquetas `.chip` (`ok`,
`alerta`, `peligro`, `pronto`). **Sin vidrio ni foto**: `comun/fondo-local.jpg`
se retiró (también de la escena de Equipo, que conserva su fondo oscuro 3D).

**Estructura común** (`comun/marca.js` › `Marca.cabecera`, estilos en
`comun/armazon.css`). Toda página que llamaba a `Marca.cabecera` (todas menos
login y cambiar contraseña) recibe, la primera vez que hay sesión:

| Pieza | Computador | Tablet (≤ 1024 px) | Celular (≤ 640 px) |
|---|---|---|---|
| Barra lateral | 248 px: Inicio · Vida en Arte (After School, Veranito, Cumpleaños) · Vida en Arte Kids (Preschool, Baby & Me) · Gestión (Resumen del negocio, Procesos, Equipo) · Administración (Base de datos, Proyecto Actio, Configuración) · el usuario abajo, con «Cambiar mi contraseña» y «Salir» | 76 px, solo iconos; el nombre en un globo al pasar, enfocar o mantener el dedo | oculta |
| Barra superior | buscador (Ctrl K / ⌘ K), «Nuevo» y campana | igual | logo y «Nuevo» (solo el +) |
| Barra inferior | — | — | Inicio · la unidad principal del rol · Buscar · Avisos · Más (la lista completa en una hoja) |

- Cada entrada aparece si el rol tiene su área (`sesion.areas`, que sale de
  `permisos.php`); Equipo pide `procesos` y `equipo`. Cumpleaños y Baby & Me
  se ven con «Próximamente». El servidor sigue cerrando cada carpeta igual.
- La ruta de siempre (`ruta`) se muestra como **ceja** sobre el título
  («Vida en Arte», «Procesos»); los parámetros `prefijo`, `logo` y `accesos`
  ya no hacen nada (el Profesor navega con la barra).
- `armazon.css` va aparte y **sin capa** porque Veranito y la Base de Datos
  cargan `vea.css` dentro de `@layer vea`, debajo de sus propios estilos;
  `marca.js` lo pide en cuanto carga (con su `?v=`).
- **Partículas**: 26 puntos de los colores de la marca que suben despacio
  (solo `transform` y `opacity`), detrás del contenido, sin recibir clics; en
  pausa con la pestaña oculta y quietas con «reducir movimiento». En la
  escena oscura de Equipo no se ven.
- **Esqueletos**: `Marca.esqueleto(tipo)` (`ocupacion`, `lista`, `tabla`,
  `tarjetas`, `inicio`) reemplaza la tarjeta «Cargando…» en After School,
  Procesos, Mi lista, Proyecto Actio e Inicio.

**Notificaciones** (la campana; antes «Pendientes de hoy» en la portada).
Las lee `Datos.pendientes.leer()` (`pendientes/api.php`, los mismos cálculos
y permisos por rol: R130) 0,7 s después de cargar la página, con copia de 3
minutos en `sessionStorage`. Solo salen los avisos con número > 0; cada uno
enlaza a su pantalla. Lo leído se guarda en `localStorage` por usuario
(`vea360.leidas.<usuario>`) como «día:número»: el aviso vuelve a contar si
cambia su número o es otro día. «Marcar todo como leído» los marca todos.

**Buscador general** (`Marca.abrirBuscador`). Los datos se piden al abrirlo,
no en cada página, y siempre por la capa de datos y el puente de cada
sección, que ya recortan según el rol:

| Grupo | Fuente | Quién |
|---|---|---|
| Niños (nombre, ID, unidad, estado) y Clases | After School `leer` (en After School se reutiliza lo ya leído: `Marca.datosAS`) | quien tiene `as.ver`: Administrador, Dirección, Coordinación After School, Recepción, Comercial y Contabilidad |
| Documentos | Procesos `leer` (todos) y Proyecto Actio `leer` (Administrador y Dirección; Dirección sin lo interno) | todos |
| Secciones | la barra lateral del rol y las pestañas de After School que su rol ve | todos |

El **Profesor** no busca niños ni clases: su puente solo entrega la lista del
día y no existe una asignación de profesor a clases que permita limitarlo
«a sus clases». Coordinación Preschool tampoco (Preschool no tiene ficha de
niño en el portal todavía). Sin tildes ni mayúsculas; flechas, Enter y Esc.
Elegir un niño abre `/after-school/#ficha=<ID>`, una clase
`#clase=<código>` (su detalle en Ocupación, en la semana en pantalla) y un
documento el visor común (`comun/visor.js` y `visor-pantalla.js`, que se
cargan la primera vez si la página no los tenía).

**«Nuevo»**: Inscribir niño (`as.completo`), Agendar visita
(`as.pruebas.agendar`; reposición y eventual siguen pidiendo
`as.visitas.agendar` dentro del formulario) y Registrar pago
(`as.pagos.registrar`). Cada una lleva a `/after-school/#nuevo=inscribir|visita|pago`
y After School abre el formulario de siempre (`atenderHash`). Sin ninguna
acción, no hay botón.

**Pantallas de esta etapa**

- **Inicio** (`portal-raiz/index.html`): saludo, una tarjeta por marca con sus
  unidades y un dato real (After School: inscritos activos y la barra de
  ocupación de la semana, R125; Preschool: niños y ocupación, solo para quien
  abre el Resumen, que es quien recibe esos datos), accesos rápidos del rol
  (Pasar lista, Agendar visita, Inscribir y Mi lista si ocupa un puesto
  abierto; «Mensaje a familias» oculto hasta que exista) y, para Dirección y
  Administrador, el Resumen en corto con `Cifras.resumenNegocio` (las mismas
  cuentas que `/resumen/`). «Niños activos» del negocio sigue «Próximamente»
  (R128) y se muestra por unidad. `?marca=` muestra solo esa tarjeta.
- **After School › Ocupación**: cuatro cifras de la semana en pantalla
  (ocupación con la regla R125 —en la semana de hoy, la misma cuenta de
  `Cifras.ocupacionAS`—, cupos para vender en lo que queda de la semana,
  inscritos activos y clases llenas), filtros por disciplina, cada clase con
  «N libres» o «Lleno» y la columna «Dónde hay más cupos» (las 6 clases con
  más cupos libres en lo que queda de la semana). Ajuste 1 (decidido por Vida
  en Arte): «Lleno» solo sin ningún cupo (inscritos + visitas del día ≥
  cupo), con borde de color; «casi lleno» desde el umbral de Config hasta
  antes de llenarse, con sus «N libres» en color de alerta y sin borde; la
  cifra «Clases llenas» cuenta solo las de 100 % y las nombra. En
  celular la ventana de una clase va a pantalla completa y cada niño en un
  bloque (antes se cortaban los botones).
- **Pasar lista**: botones de 48 px y ancho fijo (92 px; no saltan al
  marcarse), con el color del estado y una marca; «Guardar lista (N sin
  marcar)» grande, gris mientras no hay nada que guardar (todo botón de color
  deshabilitado se ve gris) y rojo cuando se puede. El comportamiento no cambió (días, correcciones, niño
  fuera de lista, reglas del Profesor). El Profesor ve el título «Pasar
  lista» con la ceja «After School».
- **Solo la base nueva** (estructura, fondo, tipografía, botones, tarjetas),
  sin rediseñar su contenido: Preschool, Veranito, Base de Datos, Resumen,
  Procesos, Equipo, Mi lista, Proyecto Actio y Configuración. En el Resumen,
  «Próximamente» ya no se parte en celular (etiqueta en Poppins).

## 3. Dónde vive cada cosa

| Qué | Dónde | Cómo se cambia |
|---|---|---|
| Código de las páginas y PHP | Este repo (`portal-raiz/`, `after-school/`, `configuracion/`, `pasar-lista/`, `comun/`, `proyecto-actio/`, `procesos/`, `biblioteca/`, `equipo/`, `resumen/`) | Commit → Actio sube los archivos al cPanel |
| Estilos, capa de datos y logos | `comun/` → `/comun/` en el servidor (pública, sin datos) | Su `htaccess.txt` se sube renombrado a `.htaccess` **dentro** de `comun/` |
| Maquetas de referencia del diseño | `docs/diseno/` (ignorada por git: traen nombres de ejemplo) | Solo en el equipo; no entran al repo ni se publican |
| Raíz del portal en el servidor | `/home/…/portal.vidaenarte.com/` | Se sube desde `portal-raiz/` (el `.htaccess` es `htaccess.txt` renombrado) |
| `portal_config.php` | `/home/…/` (una carpeta arriba, fuera de la web) | A mano en el cPanel. Lleva `as_exec`, `as_clave` y la configuración de los tableros. **No está en el repo.** |
| Cuentas del portal | `/home/…/portal_usuarios.json` (fuera de la web) | Solo desde Configuración › Usuarios |
| Sesiones | `/home/…/portal_sesiones/` | Las crea PHP |
| Apps Script | Proyecto ligado al Sheet `VEA_AfterSchool_BD` | Copiar `after-school-script/AfterSchool.gs`, pegar, **Nueva versión** de la implementación |
| Clave del puente | Propiedad del script `AS_CLAVE_API` y `as_clave` en `portal_config.php` | A mano, las dos iguales |
| Datos | El Sheet `VEA_AfterSchool_BD` | Solo a través del puente (o a mano, con cuidado) |
| Catálogo de Proyecto Actio | Sheet «Datos — Vida en Arte» (lo escribe Actio) · Apps Script `proyecto-actio-script/ProyectoActio.gs` · copia en `/home/…/portal_cache/` | Desde el Tablero de Tareas de Actio; el portal nunca escribe |
| Puestos, contratos y listas del equipo | Sheet «Procesos — Vida en Arte» (lo edita Actio) · Apps Script `procesos-script/Procesos.gs` (clave `PR_CLAVE_API` = `pr_clave`) · copia de 60 s en `/home/…/portal_cache/equipo.json` | Actio edita a mano; el portal solo escribe en Aceptaciones, Marcas y Revisiones |
| Datos reales para cargas | `datos_privados/` (ignorada por git) | Nunca entran al repo |
| Especificaciones internas | `Spec*.md` (ignoradas por git) | Notas de trabajo; lo estable va a `docs/` |

## 4. Cómo se publica

Orden general (cada entrega dice sus pasos concretos):

1. **Respaldo del Sheet** si cambia la estructura (Archivo → Hacer una copia).
2. **Apps Script**: pegar el `.gs` → menú *After School › Actualizar estructura* (crea pestañas y columnas que falten, al final; no toca datos) → **Implementar › Gestionar implementaciones › Nueva versión** (la misma URL `/exec`).
3. **PHP y páginas** en el cPanel. El puente nuevo va después del script nuevo: un `api.php` que manda algo que el script viejo no conoce fallaría.
4. Comprobar en el portal.

Por qué este orden es seguro: las columnas nuevas van al final y el script
busca por título, así que un script viejo sigue funcionando con la hoja
nueva; y la página vieja sigue funcionando con el script nuevo porque las
acciones existentes no cambian de contrato.

## 5. Pruebas

Todas corren en GitHub Actions (`.github/workflows/pruebas-after-school.yml`) en cada push a las ramas de trabajo. En el equipo de desarrollo no se ejecuta PHP (el antivirus retiene los PHP de prueba).

| Suite | Qué prueba |
|---|---|
| `after-school-script/pruebas/prueba-after-school.js` | El `.gs` entero contra un simulador de Sheets (`simulador.js`): reglas de negocio, idempotencia, estructura. |
| `after-school-script/pruebas/roturas.js` | Rompe cada regla del `.gs` y exige que la prueba anterior falle. |
| `after-school-script/pruebas/prueba-api-transporte.php` (+ `correr-prueba-transporte.js`) | El transporte de `api.php`: redirecciones, reintentos, tiempos. |
| `after-school-script/pruebas/roturas-api.js` | Roturas del transporte. |
| `pruebas-portal/prueba-portal.js` | El portal de punta a punta con `php -S` y las reglas de `htaccess.txt`: roles, Procesos (recorte para todos los roles), Equipo (quién ve, acepta, marca y revisa qué puesto, por rol, buscando en el texto de la respuesta), Resumen del negocio solo para Dirección y Administrador (Preschool sin montos, metas, la nota «Datos en revisión» desde `portal_config.php`), Preschool operativo (`kinder/csv.php` sin pagos, plan, responsable, tarifas ni costos; solo filas de Kínder; «Pagó el mes»), Pendientes de hoy por rol, nombre y apellido (solo Administrador), estilo vidrio por página, biblioteca, portada por marca y entrada por rol, áreas, acciones por rol, recortes, usuarios, CSRF, bloqueo tras 5 fallos, contraseña temporal, logout, a dónde va cada rol tras entrar y en qué pestaña abre After School, `/comun/` público sin listado ni PHP, y el recorrido sin bucle con el `.htaccess` nuevo y el anterior. |
| `pruebas-portal/roturas-portal.js` | Roturas de roles y usuarios. |
| `pruebas-portal/prueba-cifras.js` | Las cifras del Resumen del negocio (`comun/cifras.js`: ocupación de After School, metas tentativas, Preschool, niños sin contar dos veces, altas, bajas y pruebas que se inscriben de After School con su plazo y su período cubierto, altas y bajas del negocio con desglose, finanzas «Próximamente», alertas) con datos inventados, y sus roturas. |
| `pruebas-portal/prueba-preschool.js` | El tablero de Preschool (`kinder/index.html`) con un documento de mentira y datos inventados: ningún monto en pantalla aunque la hoja mandara la columna de pagos, globo con nombre y edad, cupos libres por salón, salidas del mes con motivo, pendientes de pago (solo inscritos, solo meses activos, hasta el último mes con pagos) y «Plan por registrar»; con sus roturas. Lo del servidor (`kinder/csv.php`) lo prueba `prueba-portal.js`. |
| `pruebas-portal/prueba-clics-organigrama.js` | (30-oct) Clics y toques REALES en Chrome (Playwright, `playwright-core` + el Chrome instalado): pasar el mouse, esperar y hacer clic en el centro y en las esquinas de tarjetas de 4 áreas, y tocar en tablet; que se abra su ficha; la manito y el arrastre según la escala; sin errores de JavaScript. Falla con b4d1ff6. 2-nov: en computador y en celular, las pestañas de la ficha y «Ampliar» (pantalla completa, letra de 18 px, Esc / X / «Volver», PDF con subpuntos y Aceptar desde ahí). |
| `pruebas-portal/prueba-rediseno.js` | (3-nov) Rediseño etapa 1 en Chrome real (Playwright), con los roles leídos de `permisos.php` y After School del `.gs` en el simulador: colores del sistema, ninguna página con vidrio ni foto, partículas; por rol, la barra lateral (1440), la de iconos (820), la inferior (390), «Nuevo» y lo que encuentra el buscador (niños, clases, documentos de Procesos y de Proyecto Actio, secciones); notificaciones (los avisos del servidor, número rojo, leído por usuario); Ocupación (cifras, «N libres», «Lleno», «Dónde hay más cupos», filtro, abrir una clase) y Pasar lista (48 px, ancho fijo, «N sin marcar», lo que se guarda). Con 10 roturas (p. ej. la barra muestra todo, «Nuevo» sin permiso, el buscador distingue tildes). Que un rol no reciba datos de otra sección lo garantiza cada puente y lo prueba `prueba-portal.js`. |
| `pruebas-portal/prueba-organigrama.js` | El organigrama y la ficha (`comun/organigrama.js`, `comun/puestos.js`; 29-oct: Equipo v2): áreas en columnas en el orden de Puestos, sangría, líneas del color del área, cascada que termina a tiempo, máximo 20 chispas, colores en un solo lugar, la hora de los momentos, la ficha pintada con datos inventados (formato del contrato, cuándo hay Aceptar, Reglas antes de aceptar, hoja diaria, PDF) y, en el código y en vea.css, el diálogo, la pausa, «reducir movimiento», la versión sólida y la hoja de impresión; con sus roturas. 2-nov: también `comun/verificacion.js` (pestañas, contrato como el PDF, subpuntos, Ampliar, la lista con Ejecutado / No ejecutado, quitar, Pendiente / Vencido, por evento, historial, hojas semanales y mensuales, «Asignación temporal», «Por definir»). |
| `procesos-script/pruebas/prueba-procesos.js` | El Apps Script de Equipo en un simulador: lectura por título, períodos, aceptar, marcar y revisar, y que solo escribe en Aceptaciones, Marcas y Revisiones. Roturas en `procesos-script/pruebas/roturas.js`. |
| `procesos-script/pruebas/prueba-equipo-v3.js` | (2-nov) Procesos.gs v5 contra un Sheet en memoria con el reloj fijo: Ejecutado / No ejecutado con motivo, por evento con nota, una marca por período, desmarcar que AGREGA «Desmarcada» y no borra (solo la propia y en su período), hojas «Cada semana» y «Cada mes», el calendario de 120 días, que no escribe si falta una columna y `actualizarEstructura` (Asignación, Resultado, Nota, Léeme) sin tocar datos; con sus roturas dentro. |

Los datos de prueba son siempre inventados.
