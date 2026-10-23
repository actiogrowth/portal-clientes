# Catálogo de acciones

Este es **el contrato**: lo que las páginas mandan y reciben. Si se cambia el
almacenamiento (Sheet → Supabase), el contrato no cambia; ver
`MIGRACION_SUPABASE.md`.

## Sobre común

Petición de la página (`POST after-school/api.php`, JSON):

```json
{ "accion": "inscribir", "datos": { … }, "idSolicitud": "a1b2c3d4-…" }
```

- `idSolicitud`: solo en escrituras. `^[A-Za-z0-9-]{8,64}$`. Mismo ID si se repite la misma acción con los mismos datos. Con ID, `api.php` reintenta y el script no ejecuta dos veces (devuelve `repetida: true`).
- `key` y `usuario` **los pone `api.php`**; lo que mande el navegador se descarta.

Respuesta correcta: `{ "ok": true, "resultado": {…}, "estado": {…}, "permisos": [...] }`
- `estado` solo en escrituras: lo mismo que devuelve `leer`, ya con el cambio.
- `permisos`: lo agrega `api.php` (permisos de After School del rol).
- `repetida: true`: el ID ya se había procesado; `resultado` es el de la primera vez.

Respuesta con error: `{ "ok": false, "error": "texto para la persona", "codigo": "…" }`

| Código | Quién | Significado |
|---|---|---|
| `sin_permiso` | api.php / auth.php | El rol no permite la acción o el área. HTTP 403. No llegó al script. |
| `cambiar_clave` | auth.php | Contraseña temporal sin cambiar. HTTP 403. |
| `no_autorizado` | api.php (sin roles) / script | Usuario fuera de `as_usuarios` (modo anterior) o clave del puente inválida. |
| `sin_usuario` | api.php | No se pudo leer el usuario de la sesión. |
| `sin_conexion` | api.php | No hubo conexión con Google: seguro que no se guardó. HTTP 502. |
| `incierto` | api.php | La respuesta se perdió: en escrituras **puede** haberse guardado. La página relee y comprueba. HTTP 502. |
| `sin_clave` | script | El script no tiene `AS_CLAVE_API`. |
| `ocupado` | script | Otra escritura tiene el lock (20 s). |
| `id_invalido` | script | ID de solicitud con formato inválido. |
| `id_repetido` | script | Ese ID ya se usó con otros datos u otra acción. |
| `llena` | script | Sin cupo (inscribir, mover, agendar una visita, resultado). |
| `solo_hoy` | script | Pasar lista de otro día con `soloHoy` (Profesor). |
| `duplicado` | script | Niño con el mismo nombre, o pago del mismo mes y concepto: se repite con `confirmarDuplicado: true`. |
| `varias` | script | Inscribir varias: falló más de una clase (no se escribió ninguna). |
| (vacío) | script | Error de validación con mensaje para la persona. |

Sin sesión: HTTP 302 a `/login.html` (la capa de datos lo trata como «sesión caducada»).

## Entrada y sesión (21-oct, rediseño)

Estos puntos los usa solo `comun/datos.js`. Responden JSON; `codigo` dice el motivo de un error.

| Punto | Pedido | Respuesta | Errores |
|---|---|---|---|
| `login.php?estado=1&r=` | GET | `{ok, csrf, conSesion, destino, mantenimiento}` | — |
| `login.php` | POST `{usuario, clave, csrf, r}` | `{ok, destino, csrf}` (con temporal, `destino` = `/cambiar-clave.html?r=…`) | 403 `csrf` · 429 `bloqueado` (5 fallos, 15 min) · 403 `credenciales` · 503 `mantenimiento` |
| `cambiar-clave.php?estado=1` | GET | `{ok, usuario, obligatorio, csrf, claveMinima}` | 401 `sesion` |
| `cambiar-clave.php` | POST `{actual, nueva, repetir, csrf, r}` | `{ok, obligatorio, destino}` | 401 `sesion` · 403 `csrf` · 400 `actual` / `corta` / `distintas` / `igual` · 500 `guardar` |
| `acceso.php?formato=json` | GET | `{ok, usuario, roles[{id, nombre}], areas, inicio, inicioAS, permisosAS}` | 401 `sesion` · 403 `cambiar_clave` |
| `logout.php` | GET | 302 al login con «Cerraste sesión» | — |

`destino` siempre es una dirección del portal (`destino_seguro`); nunca otro sitio.

## Recorte por rol (lo hace `api.php`, no el script)

| Política | Roles | Qué se quita |
|---|---|---|
| contactos `todos` | Administrador, Dirección, Coordinación After School, Recepción | nada |
| contactos `prospectos` | Comercial | `telefono`, `telefono2`, `correo`, `telefonoResp2` de los niños que **no** están en `Prospecto` |
| contactos `ninguno` | Contabilidad | esos cuatro campos de todos los niños (queda el nombre del responsable) |
| sin `as.pagos.ver` | Comercial | `pagosMes` vacío en `resultado` y en `estado` |
| Pasar lista (`pasar-lista/api.php`) | Profesor y quien pase lista | **lista blanca**: por niño solo `idNino, nombre, edad, presencia, idVisita, estado, nota`; sin `estado` de After School |

Se aplica a cualquier niño que aparezca en la respuesta (lectura, estado de una escritura, resultado).

## Acciones de After School

L = lectura, E = escritura. «ID sol.» = acepta ID de solicitud (todas las escrituras).
Roles: **Ad** Administrador, **Di** Dirección, **CA** Coordinación After School,
**Re** Recepción, **Co** Comercial, **Cn** Contabilidad, **Pr** Profesor.

| Acción | Tipo | Permiso | Roles | Parámetros (`datos`) | `resultado` | Errores propios |
|---|---|---|---|---|---|---|
| `leer` | L | as.ver | Ad Di CA Re Co Cn | — | ver abajo | — |
| `listarPagos` | L | as.pagos.ver | Ad Di CA Re Cn | `mes` (`yyyy-MM`) | `{mes, pagos[]}` | mes inválido |
| `crearNino` | E | as.completo | Ad Di CA Re | `nino` {campos del niño}, `confirmarDuplicado?` | `{id}` | nombre obligatorio · `duplicado` · valor fuera de lista |
| `editarNino` | E | as.completo | Ad Di CA Re | `id`, `cambios` {campos}, `reactivar?` | `{id, sinCambios?}` | nombre vacío · reactivar a un no Retirado |
| `inscribir` | E | as.completo | Ad Di CA Re | `idNino`, `codigo`, `fechaAlta?` (hoy) | `{id}` | Retirado · ya inscrito · `llena` · alta futura |
| `inscribirVarias` | E | as.completo | Ad Di CA Re | `idNino`, `codigos[]`, `fechaAlta?` | `{ids[]}` | igual; todo o nada · `varias` |
| `mover` | E | as.completo | Ad Di CA Re | `idInscripcion`, `codigoNuevo`, `fecha`, `detalle?` | `{id}` (inscripción nueva) | misma clase · ya inscrito · `llena` · fecha futura o anterior al alta |
| `bajaClase` | E | as.completo | Ad Di CA Re | `idInscripcion`, `fecha`, `motivo`, `detalle?` | `{id}` | ya dada de baja · motivo fuera de lista · fecha futura o anterior al alta |
| `bajaTotal` | E | as.completo | Ad Di CA Re | `idNino`, `fecha`, `motivo`, `detalle?` | `{id, clasesCerradas, pruebasCanceladas}` | ya Retirado · motivo · fechas |
| `revisar` | E | as.completo | Ad Di CA Re | `idNino`, `estado` (`Activo`/`Retirado`), si Retirado `fecha`, `motivo`, `detalle?` | `{id, estado, …}` | no está Por revisar |
| `notaInscripcion` | E | as.completo | Ad Di CA Re | `idInscripcion`, `nota` (vacía = quitar) | `{id, sinCambios?}` | inscripción cerrada |
| `registrarPago` | E | as.pagos.registrar | Ad Di CA Re Cn | `idNino`, `mes`, `concepto`, `plan?`, `monto`, `fechaPago`, `forma`, `notas?`, `confirmarDuplicado?` | `{id}` | listas de Config · monto ≤ 0 · `duplicado` |
| `agendarPrueba` | E | as.pruebas.agendar | Ad Di CA Re Co | `fecha`, `codigo`, `idNino` **o** `nino` {nombre, apellidos, nacimiento, responsable, telefono obligatorios}, `nota?`, `confirmarDuplicado?` | `{id, idNino}` | fecha pasada · día distinto al de la clase · clase inactiva · ya inscrito · ya tiene prueba ese día · `llena` · faltan datos · `duplicado` |
| `resultadoPrueba` | E | as.completo | Ad Di CA Re | `idPrueba`, `estado` (`Asistió`/`No asistió`/`Cancelada`), `seInscribio?` (`Sí`/`No`/''), `motivo` (si No), `nota?`, `pago?`, `monto?` | `{id, sinCambios?}` | Asistió/No asistió antes del día · `llena` al reactivar una cancelada · motivo obligatorio |
| `pagoPrueba` | E | as.pruebas.pago | Ad Di CA Re Cn | `idPrueba`, `pago` (`Sí`/`No`/''), `monto` (si Sí) | `{id, sinCambios?}` | monto ≤ 0 con Sí · es una Reposición (no se cobra) |
| `agendarVisita` | E | as.visitas.agendar | Ad Di CA Re | `tipo` (`Reposición`/`Eventual`), `fecha`, `codigo`, `nota?`. Reposición: `idNino` (Activo) + `reponeAsistencia` (ID de la falta). Eventual: `idNino` (no Activo ni Por revisar) **o** `nino` {mismos obligatorios que la prueba}, `pago?`, `monto?` | `{id, idNino}` | las de agendarPrueba · tipo inválido · Reposición: niño no Activo, falta de otro niño, no es falta, de una visita, otro servicio, ya repuesta, con pago · Eventual: niño Activo o Por revisar |
| `ocupacion` | L | as.ver | Ad Di CA Re Co Cn | `desde`, `hasta` (máx. 62 días) | `{ocupacion}` (mismo formato que en `leer`) | rango inválido |
| `seguimiento` | L | as.seguimiento | Ad Di CA Re | — | `{hoy, umbral, diasReponer, faltasSeguidas[{idNino, nombre, cuantas, desde, hasta, clases}], faltasPorReponer[{idAsistencia, idNino, nombre, fecha, codigo, servicio, estado}], clasesSinLista[{fecha, codigo, servicio, hora}], fueraDeLista[{idAsistencia, fecha, codigo, servicio, nombre, estado, nota}]}` | — |
| `asistenciaNino` | L | as.seguimiento | Ad Di CA Re | `idNino` | `{idNino, asistencias[{id, fecha, codigo, servicio, presencia, idVisita, estado, nota, repuestaCon, reponible}]}` | niño inexistente |
| `noHuboClase` | E | as.lista.corregir | Ad Di CA | `fecha` (no futura), `codigo`, `nota?` | `{fecha, codigo, sinCambios?}` | día distinto al de la clase · ya tiene lista |
| `resolverFueraDeLista` | E | as.lista.corregir | Ad Di CA | `idAsistencia`, `resolucion` (`vincular` + `idNino` / `crear` + `nino` / `descartar`) | `{id, idNino}` | no es fuera de lista · ya resuelto · ya tiene asistencia ese día |
| `leerLista`, `guardarLista` | — | — | nadie por aquí | — | — | 403: solo por `pasar-lista/api.php` |
| *(otra)* | — | as.completo | Ad Di CA Re | — | — | «acción desconocida» |

### `leer` → `resultado`

```
archivo, usuario, hoy (yyyy-MM-dd), mes (yyyy-MM),
config: { motivos[], planes[{nombre, precio}], conceptos[], formas[], umbral, conceptoMensual,
          motivosNoInscripcion[], comoConocio[], intereses[], faltan[], avisos[] },
clases[]: { codigo, servicio, modalidad, dia, hora, cupo, edades, activa, reservados },
ninos[]: { id, socio, nombre, apellidos, nacimiento, sexo, responsable, telefono, telefono2, correo,
           cabeza, estado, ingreso, notas, colegio, comoConocio, referido, hermanos, interes,
           responsable2, telefonoResp2 },
inscripciones[] (activas): { id, idNino, codigo, alta, nota },
inscripcionesCerradas[]: { idNino, codigo, alta, baja },
pruebas[] (visitas de un día): { id, fecha, codigo, idNino, estado, seInscribio, motivo, nota, registradoPor, pago, monto,
           tipo ('Prueba'|'Reposición'|'Eventual'), repone (ID de la falta), porLista (el estado lo puso la lista) },
pagosMes[] (mes actual): { id, idNino, mes, concepto, plan, monto, fecha, forma, registradoPor, notas },
ocupacion: { 'yyyy-MM-dd': { codigo: { i, v, tipos: {Prueba: n…}, ninos: [ID niño…], visitas: [ID prueba…] } } }
           — calculada por el servidor: 14 días atrás, 41 adelante y toda fecha futura con visitas,
estados[] (incluye 'Eventual'), motivoCambio, estadosPrueba[], pruebaOcupa[], dias[], tiposVisita[], estadosAsistencia[]
```

## Acciones de Configuración (`configuracion/api.php`)

Solo `usuarios.gestionar` (Administrador, Dirección). Escrituras con cabecera `X-CSRF`.

| Acción | Método | Parámetros | Respuesta | Reglas |
|---|---|---|---|---|
| `listar` | GET `?accion=listar` | — | `{usuarios[{usuario, roles, activo, cambiarClave, creado, ultimoIngreso}], roles[], yo, puedeAdmin, claveMinima, csrf}` | Nunca devuelve huellas ni contraseñas. |
| `crear` | POST | `usuario`, `roles[]` | `{temporal, usuarios}` | Usuario 3–40 `[a-z0-9-]`; al menos un rol; Dirección no asigna Administrador. |
| `roles` | POST | `usuario`, `roles[]` | `{usuarios}` | No a uno mismo; Dirección no toca cuentas Admin; el último Admin activo no pierde el rol. |
| `desactivar` / `reactivar` | POST | `usuario` | `{usuarios}` | No desactivarse a uno mismo; Dirección no toca Admin; último Admin activo. |
| `reiniciar` | POST | `usuario` | `{temporal, usuarios}` | Corta sus sesiones; cambio obligatorio al entrar. |


## Acciones de Pasar lista (`pasar-lista/api.php`)

Puente propio (carpeta `/pasar-lista/`, área `pasarlista`; la pantalla es una pestaña de After School desde D-039). Reutiliza el transporte
de `after-school/api.php`. **El límite de días lo pone el puente**: para quien no tiene
`as.lista.corregir` (Profesor) manda `limiteProfesor: true` (y `soloHoy: true`, para que un
Apps Script anterior a v8 siga limitando a hoy); para los demás, los dos en `false`. Lo que
mande el navegador se descarta. La respuesta se recorta a una lista blanca y nunca lleva el
`estado` de After School. Agrega `permisos: {puedeOtroDia}`.

**Ventana del Profesor** (23-oct, AfterSchool.gs v8). Con `limiteProfesor`, el Apps Script
calcula, con la fecha de hoy en la zona del archivo (Panamá), `desde = hoy − N` y
`hasta = hoy + M`, con N = «Parámetro / Días atrás para pasar lista (Profesor)» y
M = «Parámetro / Días adelante para ver la lista (Profesor)» de Config (7 y 7 al
instalar). Si falta alguno, se niega (`sin_configuracion`).

| Día | Profesor (`limiteProfesor`) | Coordinación AS, Administrador, Dirección |
|---|---|---|
| entre `desde` y ayer | ve, marca y corrige | ve, marca y corrige |
| hoy | ve, marca y corrige | ve, marca y corrige |
| entre mañana y `hasta` | **solo ve** (`soloLectura: true`); guardar → `dia_futuro` | no lo ve (día futuro) |
| antes de `desde` / después de `hasta` | no lo ve ni lo guarda (`fuera_de_plazo`) | antes: sí; después: no |

**Cada corrección deja rastro** en Historial («Corregir asistencia» o «Corregir nota»), con
quién la hizo y cuándo (columnas Usuario y Fecha) y en el detalle el estado y la nota de
antes, quién los había marcado y a qué hora. La fila de Asistencia queda con lo nuevo
(«Marcado por» y «Hora» de la corrección). El Seguimiento se calcula al leer, desde
Asistencia: refleja la corrección sin hacer nada más.

| Acción | Tipo | Permiso | Roles | Parámetros | `resultado` | Errores propios |
|---|---|---|---|---|---|---|
| `leerLista` | L | as.lista.ver | Pr (de `desde` a `hasta`), Ad Di CA (cualquier día no futuro) | `fecha?` (hoy) | `{fecha, hoy, dia, otroDia, desde, hasta, soloLectura, estados[], clases[{codigo, servicio, hora, guardada, sinClase, ninos[{idNino, nombre, edad, presencia, idVisita, estado, nota}], fueraDeLista[{idAsistencia, nombre, estado, nota}]}]}`. `desde`: '' si no hay límite hacia atrás | `fuera_de_plazo` · `sin_configuracion` · `solo_hoy` (script anterior a v8) · día futuro (coordinación) |
| `guardarLista` | E (sin `estado`) | as.lista.marcar | Pr (de `desde` a hoy), Ad Di CA (cualquier día no futuro) | `fecha?`, `codigo`, `marcas[{idNino, estado, nota?}]`, `fueraDeLista[{idAsistencia?, nombre, estado, nota?}]` | `{fecha, codigo, nuevas, corregidas, visitasMarcadas}` | `fuera_de_plazo` · `dia_futuro` · `sin_configuracion` · `solo_hoy` (script anterior a v8) · día futuro · clase de otro día · «No hubo clase» · niño fuera de la lista · repetido · estado inválido · lista vacía · fuera de lista sin nombre |

`presencia`: `Inscrito`, `Prueba`, `Reposición`, `Eventual`. `estado`: `Presente`,
`Llegó tarde`, `Ausente`, `Falta justificada`. Recepción, Comercial, Contabilidad y
Coordinación Preschool no pasan lista (403 por área).

Sesión del rol Profesor: se cierra tras **2 horas sin uso** (`inactividad_max` en `permisos.php`).

## Acciones de Proyecto Actio (`proyecto-actio/api.php`) — 22-oct

Lo que Actio Growth le entrega a Vida en Arte (reemplaza al «Sistema
Operativo» de GitHub Pages). **Solo lectura**: el portal nunca escribe en el
Sheet «Datos — Vida en Arte»; lo actualiza Actio desde el Tablero de Tareas.

Puente propio, área `proyecto-actio` (solo Administrador y Dirección). Habla
con un Apps Script aparte, `proyecto-actio-script/ProyectoActio.gs`, con el
mismo sobre que After School (`{key, usuario, accion, datos}`) y el mismo
transporte con reintentos (`after-school/api.php` cargado con
`AS_SOLO_FUNCIONES`). Configuración en `portal_config.php`: `pa_exec`,
`pa_clave`, `pa_proyectos_cliente` y, opcional, `pa_cache_seg`.

| Acción | Tipo | Permiso | Roles | Parámetros | `resultado` | Errores propios |
|---|---|---|---|---|---|---|
| `leer` | L | area:proyecto-actio | Ad, Di | — | ver abajo | `sin_configuracion` (falta `pa_exec`, `pa_clave` o `pa_proyectos_cliente`) |

### `leer` → `resultado`

```
{ generado: "2026-10-22T15:04:05Z",       // cuándo lo leyó el script
  proyectos: ["Proyecto 1", "Proyecto 2"],  // los que vienen en esta respuesta
  entregables: [{ id, unidad, entregable, segmento, estado, avance, fechaCompromiso, fechaReal, proyecto, soloActio, ocultoCliente }],
  documentos:  [{ nombre, unidad, segmento, tipo, fecha, enlace, idEntregable, proyecto, soloActio, ocultoCliente }],
  reuniones:   [{ fecha, tema, minuta, grabacion, proyecto, soloActio, ocultoCliente }],
  atencion:    [{ fecha, tipo, duracionMin, asunto, unidad, enlace, proyecto, soloActio, ocultoCliente }],
  faltan: ["Documentos VEA: Enlace", …]     // columnas obligatorias que no están (vacío si todo bien)
}
// y, si la respuesta salió de la copia del servidor: copia: { segundos }
```

- Fechas en `AAAA-MM-DD` ('' si no hay); `avance` es un número de 0 a 100;
  `duracionMin`, un número de minutos.
- `proyecto`: el de la fila. Documentos sin columna Proyecto toman el de su
  entregable (`idEntregable`); una fila sin proyecto queda con
  `pa_proyectos_cliente[0]`.
- `soloActio`: `true` en las filas de un proyecto que no está en
  `pa_proyectos_cliente`. Solo para Administrador; a Dirección siempre le
  llega `false`.
- `ocultoCliente` (23-oct): `true` en lo que Dirección NO recibe. Solo para
  Administrador (sello «Oculto al cliente»); a Dirección siempre `false`.
- `enlace`: una dirección `https://…` o, para las presentaciones privadas del
  portal, una ruta `/biblioteca/<nombre>.html` (antes
  `/proyecto-actio/archivos/<nombre>.html`, que redirige allá).

### Recorte (lo hace `api.php`, no el script ni la pantalla)

| Rol | Recibe |
|---|---|
| Administrador (`pa.internos`) | todas las filas, con `soloActio` y `ocultoCliente` |
| Dirección | solo lo **visible para el cliente**; el resto no sale del servidor |

**Visible para el cliente** (23-oct). En Entregables y Documentos VEA, la
columna opcional «Visible para el cliente» decide fila por fila:

| Valor | Dirección |
|---|---|
| Sí (o S, X) | la recibe, aunque sea de un proyecto que no es del cliente (p. ej. Proyecto 2) |
| No (o N) | **nunca** la recibe |
| vacío, o sin la columna | regla por proyecto: solo `pa_proyectos_cliente` |

Un documento con la celda vacía **hereda la visibilidad de su entregable**
(igual que hereda su proyecto). Reuniones y Atención directa: solo la regla
por proyecto. El selector de proyecto de Dirección muestra un proyecto solo
si le llegó al menos una fila de ese proyecto.

En `atencion` nunca se envían «Origen duración» ni «Notas»: el script no las
lee y `api.php` igual responde con una **lista blanca** de campos por tabla.

### Copia en el servidor

La respuesta completa del script (antes del recorte) se guarda
`pa_cache_seg` segundos (300 si no se configura) en
`/home/…/portal_cache/proyecto-actio.json`, **fuera de la carpeta pública**, y
el recorte se aplica en cada pedido. Si Google no responde y la copia tiene
menos de un día, se entrega la copia con `copia.segundos` (la pantalla dice
de cuándo son los datos).

## Acciones de Procesos (`procesos/api.php`) — 23-oct

La **biblioteca permanente** de Vida en Arte: los mismos documentos del
catálogo («Documentos VEA» del Sheet «Datos — Vida en Arte»), ordenados por
UNIDAD → PROCESO → DOCUMENTOS para que el equipo aprenda cómo funciona cada
unidad. Cuando termine el contrato, Proyecto Actio se apaga y Procesos queda.
**Solo lectura.**

Puente propio, área `procesos` (todos los roles). Reutiliza el Apps Script de
Proyecto Actio (acción `leer`), su transporte y **su misma copia** en
`portal_cache/proyecto-actio.json`: cargar Procesos no vuelve a llamar a
Google si Proyecto Actio ya leyó hace menos de `pa_cache_seg`.

Configuración en `portal_config.php` (además de `pa_exec`, `pa_clave` y
`pa_proyectos_cliente`, que comparte con Proyecto Actio):

```
'procesos_segmentos' => [            // proceso => segmentos del Sheet que cuentan como ese proceso,
    'Atracción'           => ['Marketing'],     // en el orden en que se muestran
    'Adquisición'         => ['Ventas'],
    'Entrega de servicio' => ['Servicio'],
],
'procesos_general' => ['Gerencia'],  // unidades cuyos documentos van en «General», al final
```

| Acción | Tipo | Permiso | Roles | Parámetros | `resultado` | Errores propios |
|---|---|---|---|---|---|---|
| `leer` | L | area:procesos (+ `procesos.ver:…` por fila) | todos | — | ver abajo | `sin_configuracion` (falta `pa_exec`, `pa_clave`, `pa_proyectos_cliente`, `procesos_segmentos` o `procesos_general`) |

### `leer` → `resultado`

```
{ generado: "2026-10-23T15:04:05Z",
  procesos: [{ nombre: "Atracción", segmentos: ["Marketing"] }, …],   // los de la configuración, en su orden
  documentos: [{ nombre, unidad, proceso, fecha, enlace }]
}
// y, si salió de la copia del servidor: copia: { segundos }
```

- **Solo documentos.** Nunca entregables con su estado, reuniones,
  acompañamiento, proyecto, `idEntregable`, tipo ni sellos internos.
- **Solo lo visible para el cliente**, con la misma regla que Dirección en
  Proyecto Actio (la misma función, `pa_recortar` sin `pa.internos`, para
  TODOS los roles, también Administrador): «Sí» → sale aunque sea de
  Proyecto 2; «No» → nunca; vacío → solo los proyectos de
  `pa_proyectos_cliente`; un documento vacío hereda la de su entregable.
- **Solo los tres procesos.** `proceso` sale de la columna Segmento con
  `procesos_segmentos` (sin mayúsculas ni tildes); un documento de otro
  segmento (Finanzas, vacío…) no sale.
- `unidad`: la del Sheet, o `General` si está en `procesos_general`.
- **Permiso por fila** (preparado; hoy todos los roles tienen
  `procesos.ver:*`): una fila sale si el rol tiene `procesos.ver:*`,
  `procesos.ver:<unidad>` o `procesos.ver:<unidad>:<proceso>` (en minúsculas,
  sin tildes, espacios como guiones: `procesos.ver:after-school:atraccion`,
  `procesos.ver:general`).
- `enlace`: `https://…` o una presentación privada `/biblioteca/<nombre>.html`
  (las rutas viejas `/proyecto-actio/archivos/<nombre>.html` el visor las
  muestra desde `/biblioteca/`).

## Biblioteca de presentaciones (`/biblioteca/`) — 23-oct

Las presentaciones `.html` privadas pasan de `/proyecto-actio/archivos/` a
`/biblioteca/`: las abre **cualquier usuario con sesión** (sin área), servidas
por `gate.php`; sin listado, sin ejecutar scripts (regla propia en el
`.htaccess` de la raíz y `biblioteca/.htaccess`), nombre simple en minúsculas.
`/proyecto-actio/archivos/<nombre>.html` responde **301 → `/biblioteca/<nombre>.html`**
(lo hace `gate.php`), para no romper los enlaces del Sheet.
