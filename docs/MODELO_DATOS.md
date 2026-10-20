# Modelo de datos — After School (`VEA_AfterSchool_BD`)

Cada pestaña del Sheet es una tabla. Convenciones de la hoja (las aplica el
`.gs`, no hay que tocarlas a mano):

- Títulos en la **fila 5**, datos desde la **6**, columna A vacía.
- Las columnas se buscan **por título**, nunca por letra. Una columna nueva se
  agrega **al final** con *Actualizar estructura*; nunca se mueve ni se renombra una existente.
- Una fila cuenta si su **primera columna** (la llave) no está vacía.
- Columnas de texto con formato `@` (IDs, teléfonos, códigos, horas, meses) para que Sheets no las convierta.
- Fechas en la zona horaria **del archivo**; en el contrato viajan como `yyyy-MM-dd`.
- **Sin fórmulas**: toda la lógica está en el `.gs`.

Leyenda: **Oblig.** = el script la exige al escribir. Tipos: `texto`, `fecha`
(día), `fechahora`, `número`, `Sí/No`.

---

## Niños

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| ID | texto | sí | `AS-0001`… lo genera el script (máximo + 1, 4 dígitos mínimo). Estable: nunca cambia. |
| Número socio Poliwin | texto | | Herencia de Poliwin. |
| Nombre | texto | sí | |
| Apellidos | texto | al agendar prueba | |
| Fecha nacimiento | fecha | al agendar prueba | |
| Sexo | texto | | Texto libre. |
| Nombre responsable | texto | al agendar prueba | **Contacto** (nombre: lo ven todos los roles con After School). |
| Teléfono | texto | al agendar prueba | **Contacto** (se recorta por rol). |
| Teléfono 2 | texto | | **Contacto**. |
| Correo | texto | | **Contacto**. |
| Cabeza de familia | texto | | |
| Estado | texto | sí | `Activo`, `Prospecto`, `Por revisar`, `Retirado`. |
| Fecha ingreso | fecha | | Se pone al crear (hoy) o al pasar de Prospecto a Activo. |
| Notas | texto | | |
| Colegio | texto | | 15-oct. |
| Cómo nos conoció | texto | | Valor de la lista de Config. |
| Familia que lo refirió | texto | | |
| Hermanos (edades) | texto | | |
| Interés en otros servicios | texto | | **Varios valores separados por «, »** (lista de Config). Ver hallazgo H3. |
| Responsable 2 | texto | | |
| Teléfono responsable 2 | texto | | **Contacto**. |

Estados del niño:

```
           agendar prueba (niño nuevo)            inscribir
 (nada) ─────────────────────────────▶ Prospecto ─────────▶ Activo
 crear niño ──────────────────────────────────────────────▶ Activo
 carga Poliwin con «Revisar» ─▶ Por revisar ─(revisar)─▶ Activo | Retirado
 Activo / Prospecto / Por revisar ─(baja total)─▶ Retirado ─(reactivar)─▶ Activo
```

## Clases

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| Código clase | texto | sí | Llave natural, p. ej. `LUN-1630-PARKOUR`. La escribe Vida en Arte. Ver hallazgo H2. |
| Servicio | texto | | Parkour, Telas, Baby & Me… |
| Modalidad | texto | | |
| Día | texto | | `Lunes` … `Domingo` (vocabulario fijo `DIAS_ORDEN`). |
| Hora inicio | texto `HH:mm` | | No hay hora de fin ni duración. |
| Cupo | número | sí (> 0 para usarla) | |
| Edades | texto | | Informativo. |
| Activa | Sí/No | | Una clase inactiva no admite inscripciones ni pruebas. |

## Inscripciones

Una fila por niño y clase. Una baja **cierra** la fila (no se borra); mover de clase cierra una y abre otra.

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| ID inscripción | texto | sí | `INS-0001`… |
| ID niño | texto | sí | → Niños.ID |
| Código clase | texto | sí | → Clases.Código clase |
| Fecha alta | fecha | sí | No puede ser futura. |
| Fecha baja | fecha | | Vacía = activa. No futura, no anterior al alta. |
| Motivo baja | texto | con baja | Lista de Config, o `Cambio de clase` al mover. |
| Detalle motivo | texto | | Al mover: «A X» / «Viene de X». |
| Registrado por | texto | sí | Usuario del portal. |
| Fecha registro | fechahora | sí | |
| Notas | texto | | P. ej. «Por verificar: clase de adultos» (carga inicial). |

Una inscripción **ocupa cupo en el día D** si `alta ≤ D` y (`sin baja` o `baja > D`).

## Pagos

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| ID pago | texto | sí | `PAG-0001`… |
| ID niño | texto | sí | → Niños.ID |
| Mes que cubre | texto `yyyy-MM` | sí | |
| Concepto | texto | sí | Lista de Config. |
| Plan | texto | | Lista de Config (con precio de referencia). |
| Monto | número | sí (> 0) | 2 decimales. |
| Fecha pago | fecha | sí | |
| Forma de pago | texto | sí | Lista de Config. |
| Registrado por | texto | sí | |
| Notas | texto | | |

## Bajas

Registro de **bajas totales** (además de cerrar las inscripciones y poner el niño Retirado). Ver hallazgo H4.

| Columna | Tipo | Notas |
|---|---|---|
| ID niño | texto | → Niños.ID |
| Fecha baja | fecha | |
| Motivo | texto | Lista de Config. |
| Detalle | texto | |
| Registrado por | texto | |

## Pruebas (clases de prueba)

Un niño en una clase en una fecha puntual. **Ocupa cupo ese día** mientras su estado sea `Agendada` o `Asistió`.

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| ID prueba | texto | sí | `PRU-0001`… |
| Fecha | fecha | sí | Hoy o futura al agendar; tiene que caer el día de la clase. |
| Clase ID | texto | sí | → Clases.Código clase (ver hallazgo H7: nombre distinto). |
| Niño ID | texto | sí | → Niños.ID |
| Estado | texto | sí | `Agendada`, `Asistió`, `No asistió`, `Cancelada`. |
| Se inscribió | Sí/No/vacío | | |
| Motivo no inscripción | texto | si «No» | Lista de Config. |
| Nota | texto | | La baja total le agrega «Cancelada por baja total». |
| Registrado por | texto | sí | |
| Fecha de registro | fechahora | sí | |
| Pagó | Sí/No/vacío | | 16-oct. |
| Monto pagado | número | si Pagó = Sí | > 0, 2 decimales. |

## Config

Listas y parámetros en una sola tabla. Ver hallazgo H8.

| Columna | Notas |
|---|---|
| Lista | `Motivo baja`, `Plan`, `Concepto`, `Forma de pago`, `Parámetro`, `Motivo no inscripción`, `Cómo nos conoció`, `Interés en servicios` |
| Valor | El valor de la lista (o el nombre del parámetro). |
| Número | Precio del plan; valor numérico del parámetro. |
| Nota | Texto libre; en `Concepto de mensualidad` guarda **el concepto** (no es una nota). |

Parámetros actuales: `Umbral amarillo` (Número: fracción de ocupación), `Concepto de mensualidad` (Nota: el concepto que cuenta como «pagó el mes»).
Los valores iniciales están en `INS_CONFIG` y solo se escriben si la lista no existe; después manda la hoja.

## Historial

Registro de auditoría: una fila por cambio.

| Columna | Notas |
|---|---|
| Fecha | fechahora |
| Usuario | usuario del portal |
| Acción | texto: `Inscribir`, `Baja total`, `Pago de prueba`… |
| ID | El ID del objeto tocado: **puede ser de niño, inscripción, pago o prueba** (ver hallazgo H5). |
| Detalle | Texto libre con los datos del cambio. |

Los registros viejos conservan los nombres de usuario de entonces: no se reescriben.

## Solicitudes

Idempotencia de las escrituras (16-oct). Sin datos de niños: solo la huella.

| Columna | Notas |
|---|---|
| ID solicitud | `^[A-Za-z0-9-]{8,64}$`, lo genera la página. |
| Acción | |
| Huella | SHA-256 de `acción + JSON con claves ordenadas de los datos`. |
| Resultado | JSON de lo que devolvió la acción (máx. 2.000 caracteres). |
| Usuario | |
| Fecha | fechahora |

Se buscan solo las **últimas 500 filas** (un reintento llega en segundos).

---

## Equivalente propuesto en Postgres / Supabase

Principios: IDs actuales se conservan como columna `codigo` única (los
documentos, el Historial y las personas los usan); la llave interna es `id`
(`bigint identity` o `uuid`). Fechas `date`, momentos `timestamptz`,
dinero `numeric(10,2)`. Catálogos de Config en tablas propias.

```sql
create type estado_nino   as enum ('Activo','Prospecto','Por revisar','Retirado');   -- + 'Eventual' (propuesto)
create type estado_prueba as enum ('Agendada','Asistió','No asistió','Cancelada');

create table ninos (
  id bigint generated always as identity primary key,
  codigo text unique not null,                 -- AS-0001
  socio_poliwin text, nombre text not null, apellidos text,
  fecha_nacimiento date, sexo text,
  responsable text, telefono text, telefono2 text, correo text,
  cabeza_familia text, estado estado_nino not null, fecha_ingreso date, notas text,
  colegio text, como_nos_conocio_id bigint references cat_como_nos_conocio,
  familia_refirio text, hermanos text, responsable2 text, telefono_resp2 text
);
create table nino_interes (nino_id bigint references ninos, interes_id bigint references cat_interes,
                           primary key (nino_id, interes_id));          -- reemplaza la celda con comas

create table clases (
  id bigint generated always as identity primary key,
  codigo text unique not null,                 -- LUN-1630-PARKOUR
  servicio text, modalidad text, dia smallint check (dia between 1 and 7),
  hora_inicio time, cupo int check (cupo > 0), edades text, activa boolean not null
);

create table inscripciones (
  id bigint generated always as identity primary key,
  codigo text unique not null,                 -- INS-0001
  nino_id bigint not null references ninos, clase_id bigint not null references clases,
  fecha_alta date not null, fecha_baja date, motivo_baja text, detalle_motivo text,
  registrado_por text not null, registrado_en timestamptz not null, notas text,
  check (fecha_baja is null or fecha_baja >= fecha_alta)
);
create unique index una_activa_por_clase on inscripciones (nino_id, clase_id) where fecha_baja is null;

create table pagos (
  id bigint generated always as identity primary key, codigo text unique not null,   -- PAG-0001
  nino_id bigint not null references ninos, mes date not null,   -- primer día del mes
  concepto_id bigint not null references cat_concepto, plan_id bigint references cat_plan,
  monto numeric(10,2) not null check (monto > 0), fecha_pago date not null,
  forma_pago_id bigint not null references cat_forma_pago, registrado_por text not null, notas text
);

create table pruebas (          -- en la propuesta nueva: «visitas» con columna tipo
  id bigint generated always as identity primary key, codigo text unique not null,   -- PRU-0001
  fecha date not null, clase_id bigint not null references clases, nino_id bigint not null references ninos,
  estado estado_prueba not null, se_inscribio boolean, motivo_no_inscripcion_id bigint references cat_motivo_no_inscripcion,
  nota text, registrado_por text not null, registrado_en timestamptz not null,
  pago boolean, monto_pagado numeric(10,2), check ((pago is true) = (monto_pagado is not null))
);

create table bajas_totales (nino_id bigint references ninos, fecha date, motivo_id bigint references cat_motivo_baja,
                            detalle text, registrado_por text);       -- o vista sobre auditoria

create table parametros (nombre text primary key, numero numeric, texto text);   -- Umbral amarillo, Concepto de mensualidad
-- cat_motivo_baja, cat_plan(nombre, precio), cat_concepto, cat_forma_pago,
-- cat_motivo_no_inscripcion, cat_como_nos_conocio, cat_interes: (id, nombre unique, activo)

create table auditoria (id bigint generated always as identity primary key, en timestamptz not null,
  usuario text not null, accion text not null, entidad text, entidad_codigo text, detalle jsonb);

create table solicitudes (id_solicitud text primary key, accion text not null, huella text not null,
  resultado jsonb, usuario text not null, en timestamptz not null);   -- la unicidad reemplaza la «ventana de 500»
```

Las reglas que hoy aplica el `.gs` bajo el lock (cupo, no futuras, una
inscripción activa por clase…) pasan a funciones de Postgres con
transacción (`security definer`) o a una Edge Function; ver `MIGRACION_SUPABASE.md`.

---

## Tablas nuevas — PROPUESTA para Asistencia y visitas (pendiente de aprobar)

Diseñadas para Supabase desde el inicio: IDs estables, relaciones explícitas,
sin fórmulas. Detalle y preguntas abiertas en `DECISIONES.md` (D-020 en adelante).

### Pruebas → visitas de un día (misma pestaña, columnas nuevas al final)

| Columna nueva | Tipo | Notas |
|---|---|---|
| Tipo | texto | `Prueba`, `Reposición`, `Eventual`. *Actualizar estructura* rellena `Prueba` en las filas existentes que la tengan vacía (idempotente). |
| Repone asistencia | texto | Solo Reposición: → Asistencia.ID asistencia de la falta que repone. Única entre visitas no canceladas. |
| Resultado por lista | Sí/vacío | `Sí` = el Estado lo puso la lista; una lista posterior puede corregirlo. Vacío = lo puso una persona: la lista no lo pisa. |

Postgres: `visitas (…, tipo tipo_visita not null, repone_asistencia_id bigint unique references asistencia, resultado_por_lista boolean)`.

### Asistencia (pestaña nueva)

Una fila por niño, clase y fecha. Corregir = actualizar la fila (el cambio queda en Historial).

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| ID asistencia | texto | sí | `ASI-0001`… |
| Fecha | fecha | sí | |
| Código clase | texto | sí | → Clases |
| ID niño | texto | si no es fuera de lista | → Niños |
| Presencia | texto | sí | `Inscrito`, `Prueba`, `Reposición`, `Eventual`, `Fuera de lista` |
| ID visita | texto | si es visita | → Pruebas.ID prueba |
| Estado | texto | sí | `Presente`, `Ausente`, `Llegó tarde`, `Falta justificada` |
| Nombre fuera de lista | texto | si fuera de lista | Lo que escribió el profesor. |
| Marcado por | texto | sí | Usuario. |
| Hora | fechahora | sí | Último guardado. |
| Nota | texto | | |

Postgres: `asistencia (id, codigo unique, fecha date, clase_id, nino_id null, presencia, visita_id null, estado, nombre_fuera_lista, marcado_por, marcado_en, nota, unique (fecha, clase_id, nino_id))`.
