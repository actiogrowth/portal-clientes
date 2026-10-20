# Migración a Supabase: qué cambia y qué no

La migración **no es un salto al vacío** si se respeta una frontera: el
**contrato** (`ACCIONES_API.md`) se queda igual y solo cambia lo que hay
detrás.

## Qué NO cambia

| Pieza | Por qué se queda |
|---|---|
| Las páginas (`after-school/index.html`, `configuracion/`, portada) | Hablan solo con `api.php` y con el contrato: misma acción, mismos datos, misma respuesta. |
| El contrato de cada acción | Nombres, parámetros, `resultado`, `estado`, códigos de error. |
| El control de acceso (`auth.php`, `permisos.php`, `gate.php`) | Roles y áreas no dependen de dónde están los datos. |
| `api.php` como puerta | Sigue exigiendo el permiso por acción y recortando por rol antes de responder. |
| Los IDs visibles (`AS-0001`, `INS-0001`, `PAG-0001`, `PRU-0001`) | Pasan como columna `codigo` única; las personas y el Historial los siguen usando. |

## Qué SÍ se reemplaza

| Hoy | Mañana |
|---|---|
| `AfterSchool.gs` (reglas + acceso al Sheet) | Las **implementaciones** de cada acción: funciones de Postgres (`rpc`) con transacción, o una Edge Function por acción. |
| El transporte de `api.php` a Apps Script (POST + echo, reintentos) | Una llamada HTTP a Supabase (PostgREST/rpc) con la *service key* guardada en `portal_config.php`. Los reintentos se simplifican: la idempotencia la da la tabla `solicitudes` con llave única. |
| `LockService` | Transacciones de Postgres (+ `select … for update` o restricciones únicas). |
| Pestaña Solicitudes (ventana de 500 filas) | Tabla `solicitudes` con `id_solicitud` como llave primaria. |
| Config (listas y parámetros mezclados) | Tablas de catálogo + `parametros`. |
| Historial (texto libre) | Tabla `auditoria` con `entidad`, `entidad_codigo` y `detalle jsonb`. |
| El recorte por rol en `api.php` | Puede quedarse en `api.php` (más simple) o pasar a vistas/RLS si algún día las páginas hablan directo con Supabase. Mientras `api.php` sea la única puerta, no hace falta RLS por rol. |

## Cómo se migra sin cortar el servicio

1. **Esquema** en Supabase según `MODELO_DATOS.md`.
2. **Copia de datos**: un script lee las pestañas (por título, como el `.gs`) y escribe las tablas conservando los `codigo`. Se compara conteo por tabla y ocupación por clase y fecha entre los dos lados.
3. **Implementar las acciones** en Postgres con el mismo contrato.
4. **Validar con las pruebas actuales** (ver abajo) contra la implementación nueva.
5. **Corte**: modo solo lectura en el Sheet (un parámetro), última copia, `api.php` apunta a Supabase (un valor en `portal_config.php`). Volver atrás = devolver ese valor.

## Cómo usar las pruebas actuales para validar la versión nueva

`prueba-after-school.js` llama a las acciones con `llamar(accion, datos)` y
comprueba las respuestas y el estado. Hoy `llamar` ejecuta el `.gs` en el
simulador; para la migración:

- Se separa en dos: **escenarios** (las llamadas y lo que se espera de la respuesta) y **adaptador** (cómo se ejecuta una llamada).
- Adaptador A: el simulador del Sheet (hoy). Adaptador B: Supabase local (`supabase start`) con las funciones nuevas.
- Los mismos escenarios tienen que pasar con los dos adaptadores. Las comprobaciones que hoy miran celdas de la hoja (formato de texto, columnas al final) quedan solo para el adaptador A; las de contrato valen para los dos.
- `prueba-portal.js` no cambia: ya prueba por HTTP contra `api.php` con un servidor falso detrás; se le agrega un modo con Supabase local.
- Las roturas se reescriben para la implementación nueva (cada regla de `REGLAS_NEGOCIO.md` tiene que seguir teniendo una).

Lo que hoy facilita la migración: el contrato está fijado, las reglas están
en un solo lugar (el `.gs`), y la hoja no tiene fórmulas. Lo que la dificulta
está en la sección de hallazgos de abajo.

## Hallazgos que conviene resolver antes (o durante) la migración

Ver el detalle y la propuesta de cada uno; **ninguno se cambió todavía**.

| # | Hallazgo | Propuesta |
|---|---|---|
| H1 | Los IDs se generan como «máximo + 1» leyendo la columna. Bajo el lock es seguro, pero dependen de que nadie edite o borre filas a mano. | En Supabase: secuencias. Mientras tanto: no borrar filas a mano (documentado). |
| H2 | La llave de Clases es un código que describe día, hora y servicio (`LUN-1630-PARKOUR`). Si la clase cambia de hora, el código miente; si se renombra, se rompen inscripciones, pruebas e Historial. | Tratarlo como ID estable que nunca se renombra; para cambiar de horario, crear una clase nueva y mover. En Supabase: `id` interno + `codigo`. |
| H3 | «Interés en otros servicios» guarda varios valores en una celda separados por coma (por eso no se permiten comas en la lista). | Tabla de relación `nino_interes`. |
| H4 | La baja total queda en tres lugares: inscripciones cerradas, Estado Retirado y la pestaña Bajas. | Bajas como registro de eventos (o vista sobre auditoría); el Estado como fuente de verdad. |
| H5 | Historial: la columna ID mezcla IDs de niño, inscripción, pago y prueba, y el detalle es texto libre. | Columna `entidad` y detalle estructurado (JSON) en Supabase. Ya hoy se puede inferir por el prefijo. |
| H6 | El Estado del niño se guarda y no se recalcula: puede haber un Activo sin ninguna inscripción activa. | Aceptable (es una decisión de la persona); en Supabase, una vista de control «Activos sin clase». |
| H7 | Nombres distintos para lo mismo: `ID niño`/`Código clase` en Inscripciones vs `Niño ID`/`Clase ID` en Pruebas. | No renombrar en el Sheet (rompería); unificar en Supabase (`nino_id`, `clase_id`). |
| H8 | Config mezcla listas y parámetros, y usa la columna Nota como valor (`Concepto de mensualidad`). | Catálogos + tabla `parametros` en Supabase. |
| H9 | La ocupación y el «hay cupo» se calculan dos veces: en el `.gs` (manda) y en la página (para pintar), con la misma regla escrita dos veces. Si cambia la regla —y las visitas la cambian— hay que tocar las dos. | Que `leer` devuelva la ocupación ya calculada por fecha (o una función compartida probada contra los mismos casos). Proponer junto con las visitas. |
| H10 | La regla «Prospecto ve contactos» y los campos de contacto están escritos en `permisos.php` (espejo del `.gs`). | Mantener la lista en un solo lugar del contrato (`ACCIONES_API.md`) y probarla (ya probada en PO). |
