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
| `comun/vea.css` | El **único** archivo de estilos del portal (variables de color, botones en píldora, tarjetas, pestañas, ocupación, Pasar lista, adaptaciones a tablet y celular). Dos temas sobre los mismos componentes: Vida en Arte (por defecto) y **Vida en Arte Kids** (`.tema-kids` en `<html>`: solo cambia variables; lo usa Preschool). |
| `comun/marca.js` | `window.Marca`: el encabezado (logo —el de Kids con la opción `logo`—, ruta, usuario, «Cambiar mi contraseña», Salir), avisos y formato de fechas. |
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
| Preschool (`/kinder/`) | Rama `preschool-marca-kids` de este repo (`dashboard-kinder.html`, se publica como `kinder/index.html`) | Tema Kids, encabezado estándar con el logo Kids | Igual que antes: `config.php` → `csv.php` (no pasa por `datos.js`) |
| Base de Datos (`/basededatos/`) | Repo `bdclientesvea`, rama `marca-vea` | `vea.css` en una capa `@layer` (sus reglas mandan), encabezado estándar | Igual que antes: `api.php` directo. **No pasa por `datos.js`**: la lectura mira el texto crudo para distinguir una página de Google de una hoja vacía |
| Veranito (`/veranito/`) | `veranito/index.html` (hub de enlaces: tarjetas de herramientas y «Copiar link») | `vea.css` en una capa `@layer` y encabezado estándar si existe `/comun/marca.js`; sin la barra lateral (la navegación es la portada). Sin `/comun/` se ve idéntica a antes | Solo `/acceso.php` (formato JS), igual que antes; no llama a ningún puente |
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
  persona ocupa o del que es jefe.
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
  (After School `leer` y `seguimiento`, Equipo `leer`). Cifras y lo que quedó
  fuera, en [ACCIONES_API.md › Resumen](ACCIONES_API.md). Finanzas dice
  «Próximamente», sin números.

**Estilo vidrio** (`vea.css`, tema por página: `<html class="vidrio">`): foto
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
| `pruebas-portal/prueba-portal.js` | El portal de punta a punta con `php -S` y las reglas de `htaccess.txt`: roles, Procesos (recorte para todos los roles), Equipo (quién ve, acepta, marca y revisa qué puesto, por rol, buscando en el texto de la respuesta), Resumen solo para Dirección y Administrador, estilo vidrio por página, biblioteca, portada por marca y entrada por rol, áreas, acciones por rol, recortes, usuarios, CSRF, bloqueo tras 5 fallos, contraseña temporal, logout, a dónde va cada rol tras entrar y en qué pestaña abre After School, `/comun/` público sin listado ni PHP, y el recorrido sin bucle con el `.htaccess` nuevo y el anterior. |
| `pruebas-portal/roturas-portal.js` | Roturas de roles y usuarios. |
| `procesos-script/pruebas/prueba-procesos.js` | El Apps Script de Equipo en un simulador: lectura por título, períodos, aceptar, marcar y revisar, y que solo escribe en Aceptaciones, Marcas y Revisiones. Roturas en `procesos-script/pruebas/roturas.js`. |

Los datos de prueba son siempre inventados.
