# Reglas de negocio y la prueba que cubre cada una

Dónde vive cada regla: en el `.gs` (After School) o en el PHP (acceso). La
página repite algunas solo para avisar antes; **manda el servidor**.

Cobertura: «§ sección» = sección de la prueba; «rotura» = el sabotaje que la
prueba tiene que detectar. Archivos:
- **AS** = `after-school-script/pruebas/prueba-after-school.js` · roturas en `roturas.js`
- **TR** = `after-school-script/pruebas/prueba-api-transporte.php` · roturas en `roturas-api.js`
- **PO** = `pruebas-portal/prueba-portal.js` · roturas en `roturas-portal.js`

Una regla sin prueba se marca **SIN PRUEBA**.

## Cupos y ocupación

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R01 | Una clase admite inscripciones fijas hasta su `Cupo`; los inscritos sin baja cuentan. | `exigirCupoFijo_` | AS § inscribir · rotura «deja pasar la clase llena» |
| R02 | Una inscripción ocupa cupo el día D si `alta ≤ D` y (`sin baja` o `baja > D`). | `inscripcionEnFecha_` | AS § ocupación en una fecha · rotura «las inscripciones cerradas cuentan después de la baja», «cuenta las bajas como activas» |
| R03 | Una visita de un día (Prueba, Reposición o Eventual) ocupa cupo en su fecha mientras esté `Agendada` o `Asistió`. | `PRUEBA_OCUPA`, `ocupacionEn_` | AS § clases de prueba: agendar, § visitas: ocupación · roturas «la prueba no ocupa cupo», «las reposiciones no ocupan cupo» |
| R04 | Inscribir o mover exige cupo también en cada fecha futura con pruebas (inscritos ese día + pruebas + el niño ≤ cupo). | `exigirCupoFijo_` | AS § las pruebas futuras cuentan al inscribir y al mover · rotura «inscribir ignora las pruebas futuras» |
| R05 | Las pruebas del propio niño no le cierran el cupo. | `ocupacionEn_(…, excluirNino)` | AS · rotura «la propia prueba del niño le cierra el cupo» |
| R06 | Clase inactiva o sin cupo válido: no admite inscripciones ni pruebas. | `claseUsable_` | AS § inscribir, § clases de prueba: agendar |
| R07 | La ocupación la calcula el servidor (`leer` la trae por fecha y clase; otras semanas con la acción `ocupacion`); la página solo la pinta (21-oct, resuelve H9). | `ocupacionFechas_` | AS § visitas: ocupación («coincide con la regla del servidor en las N celdas») · roturas «leer no cuenta las visitas en la ocupación», «la ocupación de leer cuenta mal las bajas» |

## Inscripciones y bajas

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R10 | Un niño no se inscribe dos veces en la misma clase activa. | `inscribirEn_`, `accMover_` | AS § inscribir, § mover |
| R11 | Un Retirado no se inscribe: primero se reactiva. | `inscribirEn_` | AS § inscribir |
| R12 | La fecha de alta no puede ser futura (alta futura prohibida por decisión). | `exigirNoFutura_` | AS · rotura «acepta alta futura» |
| R13 | Inscribir varias es todo o nada. | `inscribirEn_` | AS § inscribir varias · rotura «inscribir varias no es todo o nada» |
| R14 | Un Prospecto o un Eventual que se inscribe pasa a Activo (y toma fecha de ingreso). | `inscribirEn_` | AS · roturas «el Prospecto no pasa a Activo», «el Eventual no pasa a Activo al inscribirse» |
| R15 | Bajas: fecha no futura y no anterior al alta; motivo de la lista de Config. | `exigirBajaNoAntesDeAlta_`, `exigirMotivo_` | AS § bajas · roturas «acepta bajas futuras», «no exige motivo de la lista» |
| R16 | Mover = baja con motivo `Cambio de clase` + alta nueva el mismo día; valida cupo del destino; fecha no futura. | `accMover_` | AS § mover · roturas «mover no valida el cupo del destino», «mover acepta fecha futura» |
| R17 | Baja total: cierra todas sus inscripciones, Estado Retirado, fila en Bajas y cancela sus pruebas Agendadas de hoy en adelante (no las pasadas ni las que tienen resultado; agrega nota). | `retirar_` | AS § baja total cancela las pruebas agendadas · 5 roturas |
| R18 | La baja de UNA clase no cancela pruebas. | `accBajaClase_` | AS § baja total… (control) |
| R19 | Por revisar → Activo, o → Retirado con las reglas de la baja total. | `accRevisar_` | AS § por revisar |
| R20 | La nota de una inscripción activa se cambia o quita, con Historial. | `accNotaInscripcion_` | AS § nota de inscripción |

## Niños

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R30 | Nombre obligatorio. | `accCrearNino_` | AS § crear y editar niño |
| R31 | Mismo nombre y apellidos que otro niño: hay que confirmar (`duplicado`). | `exigirNoDuplicado_` | AS § crear y editar niño |
| R32 | «Cómo nos conoció» e «Interés» tienen que estar en las listas de Config; un interés no puede tener coma. | `validarListasNino_`, `leerConfig_` | AS § comas en la lista · roturas «no valida cómo nos conoció», «ofrece intereses con coma», «acepta al guardar un interés con coma» |
| R33 | Reactivar solo a un Retirado; vuelve a Activo. | `accEditarNino_` | AS § crear y editar niño |

## Pruebas

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R40 | Agendar: fecha de hoy en adelante y en el día de la semana de la clase. | `accAgendarPrueba_` | AS § clases de prueba: agendar · roturas «agenda en fecha pasada», «agenda en un día que no es el de la clase» |
| R41 | Niño nuevo: obligatorios nombre, apellidos, nacimiento, responsable, teléfono; nace `Prospecto`. | `accAgendarPrueba_` | AS · rotura «el prospecto nace Activo» |
| R42 | No se agenda si ya está inscrito en esa clase o ya tiene una prueba que ocupa ese día. | `accAgendarPrueba_` | AS § clases de prueba: agendar |
| R43 | Asistió / No asistió solo desde el día de la prueba; Cancelada cuando sea. | `accResultadoPrueba_` | AS § resultado · rotura «Asistió antes del día de la prueba» |
| R44 | «Se inscribió: No» exige motivo de la lista. El resultado no inscribe. | `accResultadoPrueba_` | AS · rotura «No se inscribió sin motivo» |
| R45 | Volver a ocupar cupo (Cancelada → Agendada/Asistió) exige cupo ese día. | `accResultadoPrueba_` | AS § resultado |
| R46 | Pago de prueba: Sí exige monto > 0 (2 decimales); No o vacío deja el monto vacío; se puede registrar antes, durante o después; sin precio fijo. | `valoresPagoPrueba_` | AS § pago de la clase de prueba · 8 roturas |
| R47 | Un Prospecto que no se inscribe sigue Prospecto. | (ninguna acción lo cambia) | AS § resultado |

## Visitas de un día (21-oct)

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R90 | Tres tipos: Prueba (agendarPrueba, también Comercial), Reposición y Eventual (agendarVisita). Las tres: fecha de hoy en adelante, en el día de la clase, clase activa, el niño no inscrito en esa clase ni con otra visita ese día, cupo ese día. | `validarFechaVisita_`, `exigirNinoLibreEn_`, `exigirCupoVisita_` | AS § visitas · rotura «una visita no valida el cupo» |
| R91 | Reposición: solo niños Activos; repone una falta (Ausente o Falta justificada) de una clase fija del mismo niño; en cualquier clase activa del MISMO SERVICIO; sin plazo; sin pago. | `exigirFaltaReponible_` | AS § Reposición · roturas «la reposición no exige un niño Activo», «se repone en otro servicio», «se repone algo que no es falta», «la reposición se cobra» |
| R92 | Cada falta se repone una sola vez; si la reposición queda Cancelada o No asistió, la falta vuelve a estar disponible. | `faltasRepuestas_` | AS § Reposición · roturas «una falta se repone dos veces», «una reposición No asistió sigue bloqueando la falta» |
| R93 | Eventual: niño que no está Activo (nuevo, Prospecto, Retirado o ya Eventual; Por revisar no); su estado pasa a Eventual; un niño nuevo nace Eventual con los obligatorios de la prueba; Pagó/Monto como la prueba. | `accAgendarVisita_` | AS § Eventual · roturas «un Activo viene como eventual», «el eventual no cambia de estado», «el niño nuevo de una eventual nace Prospecto» |
| R94 | Las pruebas anteriores quedan con Tipo «Prueba» al actualizar la estructura (una vez). | `actualizarEstructura` | AS § actualizar estructura · rotura «actualizar estructura no pone Tipo a las pruebas viejas» |
| R95 | El texto de ocupación dice «visitas» cuando hay tipos mezclados. | `textoOcupacion_` | AS · rotura «el texto dice pruebas aunque haya otros tipos» |

## Pasar lista (21-oct)

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R100 | La lista de una clase en una fecha: inscritos activos ese día + visitas no canceladas (con su marca) + fuera de lista. Por niño solo nombre, edad y marca. | `armarLista_`, `accLeerLista_`, `lista_recortada` | AS § Pasar lista · PO § Pasar lista · roturas «la lista incluye las visitas canceladas», «la lista manda datos de contacto», «la lista blanca deja pasar contactos», «pasar-lista no recorta la respuesta» |
| R101 | El Profesor pasa y corrige solo el mismo día (`soloHoy` lo pone el puente); la coordinación (CA, Ad, Di) cualquier día no futuro. Nunca un día futuro. | `fechaLista_`, `pasar-lista/api.php` | AS § Pasar lista · PO § Pasar lista · roturas «la lista deja otro día con soloHoy», «la lista acepta días futuros», «pasar-lista respeta el soloHoy del navegador» |
| R102 | Una fila por niño, clase y fecha: corregir actualiza la fila y deja Historial. | `accGuardarLista_` | AS · roturas «corregir agrega otra fila», «la corrección no queda en Historial» |
| R103 | Solo niños de esa lista, una vez cada uno, estados válidos; no en una clase con «No hubo clase». | `accGuardarLista_` | AS · roturas «guarda niños que no están en la lista», «se pasa lista en una clase con No hubo clase» |
| R104 | Las visitas se marcan solas: Presente o Llegó tarde → Asistió; Ausente o Falta justificada → No asistió. No toca «Se inscribió» ni pisa un resultado puesto a mano. | `accGuardarLista_`, `accResultadoPrueba_` | AS § Pasar lista · roturas «la lista no marca las visitas», «la lista pisa el resultado puesto a mano», «Llegó tarde no cuenta como asistió», «el resultado a mano no le quita la visita a la lista» |
| R105 | guardarLista no devuelve el estado de After School; el puente de Pasar lista solo admite leerLista y guardarLista, y after-school/api.php nunca las admite. | `ACCIONES.guardarLista.sinEstado`, puentes | AS · PO § Pasar lista · roturas «guardarLista devuelve el estado completo», «pasar-lista deja pasar otras acciones», «after-school/api.php acepta Pasar lista» |
| R106 | Niño fuera de lista: queda para la coordinación (CA, Ad, Di), que lo vincula, lo crea (Eventual) o lo descarta, una vez. | `accResolverFueraDeLista_` | AS § fuera de lista · roturas «un fuera de lista se resuelve dos veces», «el fuera de lista creado nace Activo», «Recepción resuelve fuera de lista» |
| R107 | «No hubo clase» (CA, Ad, Di): no en un día futuro ni en una clase con lista; queda en Historial. | `accNoHuboClase_` | AS § fuera de lista y No hubo clase · rotura «No hubo clase en una clase con lista» |
| R108 | La sesión del Profesor se cierra tras 2 horas sin uso; el uso renueva el plazo; los demás roles sin tope. | `cuenta_actual`, `requerir_sesion` | PO § inactividad · roturas «el Profesor no tiene tope de inactividad», «el tope de inactividad no se mira», «el uso no renueva el plazo» |

## Seguimiento (21-oct)

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R110 | Faltas seguidas: por niño Activo, todas sus clases en orden de fecha y hora; Presente o Llegó tarde cortan; Falta justificada se salta; alerta desde el umbral de Config. | `accSeguimiento_` | AS § seguimiento · roturas «la falta justificada cuenta en la racha», «Llegó tarde no corta la racha», «el umbral no sale de Config» |
| R111 | Faltas por reponer: Ausente y Falta justificada de clase fija, niños Activos, últimos N días (Config), sin reposición en pie. | `accSeguimiento_` | AS § seguimiento · roturas «faltas por reponer sin plazo», «faltas por reponer incluye las repuestas» |
| R112 | Clases sin lista: desde «Asistencia desde», clases activas que ya terminaron (hora + duración de Config), con niños, sin asistencia ni «No hubo clase». | `accSeguimiento_` | AS § seguimiento · roturas «avisa clases que no terminaron», «avisa clases sin niños», «avisa clases con lista», «la duración no sale de Config» |

## Pagos

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R50 | Concepto, plan y forma de pago de las listas de Config; monto > 0 a centavos; mes `yyyy-MM`. | `accRegistrarPago_` | AS § pagos |
| R51 | Mismo niño, mes y concepto: hay que confirmar el pago adicional (`duplicado`). | `accRegistrarPago_` | AS § pagos · rotura «no avisa el pago repetido» |
| R52 | «Pagó el mes» = pago del concepto de `Concepto de mensualidad` (Config). | página (Pagos) | **SIN PRUEBA** automática de la página |

## Escrituras seguras

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R60 | Toda escritura va bajo el lock del script (20 s; si no, `ocupado`). | `atender_` | AS · rotura «sin lock al escribir» |
| R61 | Idempotencia: un ID de solicitud ya procesado no se ejecuta otra vez y devuelve el resultado guardado; con otros datos → `id_repetido`. | `atender_`, Solicitudes | AS § escrituras idempotentes · 8 roturas |
| R62 | El ID se registra DESPUÉS de escribir y solo si la acción salió bien. | `atender_` | AS · rotura «registra el ID antes de ejecutar» |
| R63 | Las lecturas no usan ID. | `atender_` | AS · rotura «las lecturas también usan el ID» |
| R64 | `api.php` reintenta lecturas y escrituras con ID; nunca escrituras sin ID. Intento 2 siempre; el 3 no empieza pasados 60 s. | `llamar_apps_script` | TR · roturas de transporte |
| R65 | Solo se siguen redirecciones a `*.googleusercontent.com`; nunca GET a `/exec`. | `ciclo` | TR · roturas «sigue cualquier redirección», «acepta hosts parecidos» |
| R66 | El estado que devuelve una escritura es idéntico a una lectura nueva. | caché de tablas | AS (comparación tras cada escritura) · roturas de la copia en memoria |
| R67 | La clave del puente y el usuario los pone el servidor. | `api.php`, `atender_` | AS § autenticación del puente · PO § After School |

## Estructura de la hoja

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R70 | *Actualizar estructura* crea pestañas y columnas faltantes **al final**, sin mover ni pisar; repetible. | `actualizarEstructura` | AS § actualizar estructura · rotura «estructura pisa la última columna» |
| R71 | Config: solo se escriben las listas que no existen; lo editado por Vida en Arte no se toca. | `actualizarEstructura` | AS · rotura «estructura repite listas de Config» |
| R72 | IDs, teléfonos, códigos y meses como texto; filas nuevas con formato. | `agregarFilas_` | AS § filas más allá de la 1000 · rotura «no pone texto en las filas nuevas» |
| R73 | Fechas con la zona del archivo (ida y vuelta exacta). | `fechaDeTexto_` | AS · rotura «fecha con la zona del script» |

## Acceso y usuarios

| # | Regla | Dónde | Cobertura |
|---|---|---|---|
| R80 | Cada carpeta exige el área de su rol; las no asignadas, solo Administrador y Dirección. | `requerir_sesion`, `permisos.php` | PO § áreas · roturas de área |
| R81 | Cada acción de After School exige su permiso; las prohibidas no llegan al script. | `api.php` | PO § After School · roturas |
| R82 | Recorte de contactos y pagos por rol. | `filtrar_contactos`, `respuesta_para_roles` | PO § contactos y pagos · roturas |
| R83 | Dirección no toca cuentas con rol Administrador; nadie cambia sus propios roles ni se desactiva; el último Administrador activo se conserva. | `exigir_puede_tocar` | PO § Configuración, § último Administrador · roturas |
| R84 | Contraseña temporal: una vez, cambio obligatorio, mínimo 10; solo `cambiar-clave.php` y `logout.php` abiertas mientras tanto. | `auth.php`, `gate.php` | PO § recorrido real con contraseña temporal (con los dos .htaccess) · rotura del despacho |
| R85 | Desactivar, reiniciar o cambiar contraseña corta las otras sesiones. | `cuenta_actual` | PO § desactivar, § reiniciar, § cambiar mi contraseña |
| R86 | CSRF en login, cambio de contraseña y Configuración. | `csrf_valido` | PO § CSRF · roturas |
| R87 | 5 fallos de login por conexión bloquean 15 min. | `auth.php` | PO § bloqueo |
| R88 | Migración de cuentas todo o nada. | `migrar_cuentas` | PO § migración · rotura |
