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
| `llena` | script | Sin cupo (inscribir, mover, agendar, resultado). |
| `duplicado` | script | Niño con el mismo nombre, o pago del mismo mes y concepto: se repite con `confirmarDuplicado: true`. |
| `varias` | script | Inscribir varias: falló más de una clase (no se escribió ninguna). |
| (vacío) | script | Error de validación con mensaje para la persona. |

Sin sesión: HTTP 302 al login (la página lo trata como «sesión caducada»).

## Recorte por rol (lo hace `api.php`, no el script)

| Política | Roles | Qué se quita |
|---|---|---|
| contactos `todos` | Administrador, Dirección, Coordinación After School, Recepción | nada |
| contactos `prospectos` | Comercial | `telefono`, `telefono2`, `correo`, `telefonoResp2` de los niños que **no** están en `Prospecto` |
| contactos `ninguno` | Contabilidad | esos cuatro campos de todos los niños (queda el nombre del responsable) |
| sin `as.pagos.ver` | Comercial | `pagosMes` vacío en `resultado` y en `estado` |

Se aplica a cualquier niño que aparezca en la respuesta (lectura, estado de una escritura, resultado).

## Acciones de After School

L = lectura, E = escritura. «ID sol.» = acepta ID de solicitud (todas las escrituras).
Roles: **Ad** Administrador, **Di** Dirección, **CA** Coordinación After School,
**Re** Recepción, **Co** Comercial, **Cn** Contabilidad.

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
| `pagoPrueba` | E | as.pruebas.pago | Ad Di CA Re Cn | `idPrueba`, `pago` (`Sí`/`No`/''), `monto` (si Sí) | `{id, sinCambios?}` | monto ≤ 0 con Sí |
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
pruebas[]: { id, fecha, codigo, idNino, estado, seInscribio, motivo, nota, registradoPor, pago, monto },
pagosMes[] (mes actual): { id, idNino, mes, concepto, plan, monto, fecha, forma, registradoPor, notas },
estados[], motivoCambio, estadosPrueba[], pruebaOcupa[], dias[]
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

---

## PROPUESTAS — visitas, Pasar lista y seguimiento (pendientes de aprobar)

Contratos escritos **antes** de implementar. Las preguntas abiertas están en `DECISIONES.md`.

| Acción | Tipo | Permiso (nuevo) | Roles | Parámetros | `resultado` |
|---|---|---|---|---|---|
| `agendarVisita` | E | as.visitas.agendar | Ad Di CA Re | `tipo` (`Reposición`/`Eventual`), `fecha`, `codigo`, `nota?`; Reposición: `idNino` + `reponeAsistencia`; Eventual: `idNino` **o** `nino` {mismos obligatorios que la prueba}, `pago?`, `monto?` | `{id, idNino}` |
| `agendarPrueba` | E | as.pruebas.agendar | Ad Di CA Re Co | sin cambios (crea tipo `Prueba`) | sin cambios |
| `pagoPrueba` | E | as.pruebas.pago | Ad Di CA Re Cn | sin cambios; vale para Prueba y Eventual; rechaza Reposición | sin cambios |
| `leerLista` | L | as.lista.ver | Profesor, Ad Di CA | `fecha?` (hoy; otra fecha solo con as.lista.corregir) | `{fecha, clases[{codigo, servicio, dia, hora, ninos[{idNino, nombre, edad, presencia, idVisita?, estado?, nota?}], guardada}]}` — **sin ningún otro dato del niño** |
| `guardarLista` | E | as.lista.marcar | Profesor (solo hoy), Ad Di CA (cualquier día no futuro) | `fecha`, `codigo`, `marcas[{idNino, idVisita?, estado, nota?}]`, `fueraDeLista[{nombre, estado, nota?}]` | `{guardadas, visitasMarcadas}` |
| `seguimiento` | L | as.seguimiento | Ad Di CA Re | — | `{faltasSeguidas[], faltasPorReponer[], clasesSinLista[], fueraDeLista[]}` |
| `asistenciaNino` | L | as.seguimiento | Ad Di CA Re | `idNino` | `{asistencias[]}` |

Para Profesor, `api.php` no usa el recorte de contactos: la acción `leerLista`
ya devuelve solo nombre, edad y etiqueta, y el rol no tiene ninguna otra acción.
