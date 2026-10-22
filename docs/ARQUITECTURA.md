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

## 2b. Presentación y entrada (21-oct, rediseño con la marca Vida en Arte)

| Pieza | Qué es |
|---|---|
| `comun/vea.css` | El **único** archivo de estilos del portal (variables de color, botones en píldora, tarjetas, pestañas, ocupación, Pasar lista, adaptaciones a tablet y celular). Dos temas sobre los mismos componentes: Vida en Arte (por defecto) y **Vida en Arte Kids** (`.tema-kids` en `<html>`: solo cambia variables; lo usa Preschool). |
| `comun/marca.js` | `window.Marca`: el encabezado (logo —el de Kids con la opción `logo`—, ruta, usuario, «Cambiar mi contraseña», Salir), avisos y formato de fechas. |
| `comun/datos.js` | `window.Datos`: la capa de datos (ver la tabla de capas). Es lo único que habría que reescribir para hablar con otro servidor (Firebase o Supabase). |
| `comun/logo-vea.png`, `comun/logo-kids.png` | Logos. |
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
`comun/<nombre>.(css|js|png|svg)` (un nombre simple, sin subcarpetas). Lo hace
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
| Sistema Operativo | GitHub Pages (`portal-v2.html`) | Reemplazado por **Proyecto Actio** (`/proyecto-actio/`, abajo). Hay una redirección preparada para subir cuando Proyecto Actio esté publicado | — |

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

- La pantalla (rediseño visual del 23-oct): franja negra «Lo que hemos
  construido juntos» con «Desde <mes del primer registro> · datos al
  <fecha>», el selector Proyecto 1 / Proyecto 2 (este con «Solo Actio», solo
  Administrador) y cuatro cifras calculadas del proyecto elegido
  (entregables y % entregado, unidades, reuniones, horas de acompañamiento).
  Pestañas: Entregables (filas agrupadas por unidad con su color; un botón
  por versión que abre ESA versión en el visor; el estado solo si no está
  entregado; buscador a la derecha), Reuniones (por mes, fecha en forma de
  calendario, Minuta y Grabación) y Acompañamiento (totales, horas por mes
  en barras y el detalle de cada encuentro desplegable).
- El visor (`comun/visor.js`) muestra el documento en la misma página, con
  una pestaña por versión (Documento, Presentación, Interactiva): Drive en
  `/preview`, Google Docs/Hojas/Presentaciones en `/preview` (solo lectura),
  Gamma en su modo de inserción; cualquier otro enlace, en pestaña nueva.
  Descargar solo donde hay un archivo que bajar (Drive y Google Docs).
- El portal depende solo del **enlace** de cada documento, no de quién es su
  dueño: cuando los documentos pasen a una unidad de Vida en Arte o el
  catálogo a Firebase, cambian los enlaces o la fuente, no la pantalla
  (modelo en `MODELO_DATOS.md`).

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

## 3. Dónde vive cada cosa

| Qué | Dónde | Cómo se cambia |
|---|---|---|
| Código de las páginas y PHP | Este repo (`portal-raiz/`, `after-school/`, `configuracion/`, `pasar-lista/`, `comun/`) | Commit → Actio sube los archivos al cPanel |
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
| `pruebas-portal/prueba-portal.js` | El portal de punta a punta con `php -S` y las reglas de `htaccess.txt`: roles, áreas, acciones por rol, recortes, usuarios, CSRF, bloqueo tras 5 fallos, contraseña temporal, logout, a dónde va cada rol tras entrar y en qué pestaña abre After School, `/comun/` público sin listado ni PHP, y el recorrido sin bucle con el `.htaccess` nuevo y el anterior. |
| `pruebas-portal/roturas-portal.js` | Roturas de roles y usuarios. |

Los datos de prueba son siempre inventados.
