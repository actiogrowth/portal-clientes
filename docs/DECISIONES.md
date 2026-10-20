# Registro de decisiones

Una entrada por decisión: fecha, decisión, motivo y alternativas descartadas.
Las nuevas se agregan al final con el número siguiente. Una decisión que se
revierte no se borra: se agrega otra que la reemplaza y se anota «reemplazada por D-0xx».

| # | Fecha | Decisión | Motivo | Descartado |
|---|---|---|---|---|
| D-001 | 13-oct-2026 | After School deja Poliwin y pasa a una herramienta propia: página en el portal + Apps Script + Google Sheet. | Poliwin se dejó el 13-oct; hacía falta algo ya, que Vida en Arte pudiera ver y corregir. | Seguir con Poliwin; una base de datos desde el día 1 (más lenta de montar). |
| D-002 | 13-oct-2026 | Sheet propio `VEA_AfterSchool_BD`; no se toca `VEA_BaseDatos_Clientes`. | Aislar el riesgo de la herramienta nueva. | Pestañas nuevas en la base de clientes. |
| D-003 | 13-oct-2026 | El repo es público: datos reales solo en `datos_privados/` (ignorada); pruebas con datos inventados; sin claves ni `/exec`; sin nombres de personas del cliente. | GitHub Pages sirve el repo. | Repo privado (cambia la publicación del portal). |
| D-004 | 13-oct-2026 | Ninguna regla de negocio escrita en el código: cupos en Clases; motivos, planes, conceptos, formas y umbral en Config. | Vida en Arte ajusta sin pedir un cambio de código. | Constantes en el `.gs`. |
| D-005 | 14-oct-2026 | La hoja se lee por título de columna; las columnas nuevas van al final con *Actualizar estructura*. | Se puede agregar sin romper lo que ya hay ni el script anterior. | Posiciones fijas por letra. |
| D-006 | 14-oct-2026 | `api.php` sigue a mano la redirección de Apps Script, solo a `*.googleusercontent.com`; nunca GET a `/exec`. | Con FOLLOWLOCATION una inscripción guardada mostró error (INS-0220). | Seguir redirecciones automáticamente. |
| D-007 | 15-oct-2026 | Alta futura prohibida: se registra el día que el niño empieza (o se agenda como prueba). | Una inscripción futura ocuparía el cupo desde hoy. | Altas programadas. |
| D-008 | 15-oct-2026 | La clase de prueba ocupa cupo ese día; las pruebas futuras bloquean inscribir y mover si no cabe. | El cupo real de un día incluye a quien viene a probar. | Pruebas fuera del cupo. |
| D-009 | 15-oct-2026 | Un Prospecto que no se inscribe sigue Prospecto; inscribir lo pasa a Activo. | Seguimiento comercial. | Pasarlo a Retirado. |
| D-010 | 15-oct-2026 | La baja total cancela las pruebas Agendadas de hoy en adelante (no las pasadas ni con resultado). | Liberar el cupo de esos días. | Dejarlas o borrarlas. |
| D-011 | 15-oct-2026 | Las lecturas se reintentan; las escrituras sin ID nunca. | Repetir una escritura podía duplicarla. | Reintentar todo. |
| D-012 | 16-oct-2026 | Escrituras idempotentes con ID de solicitud registrado en la pestaña Solicitudes, dentro del lock y después de escribir. | Reintentar escrituras sin duplicar. | CacheService (puede olvidar), PropertiesService (tope 500 KB, otro orden de escritura), registrar el ID antes (diría «guardado» sin guardar). |
| D-013 | 16-oct-2026 | Pago de la clase de prueba: columnas Pagó / Monto pagado; sin precio fijo; antes, durante o después. | La prueba tiene costo y varía. | Precio fijo en Config; tabla de pagos aparte. |
| D-014 | 16-oct-2026 | Reintentos: el intento 2 siempre; el 3 no empieza pasados 60 s. | Un primer ciclo lento dejaba sin reintentos. | Tope de 25 s total. |
| D-015 | 17-oct-2026 | Esperas de curl por paso: POST 5/40 s, echo 5/10 s. | Peor caso de ~725 s a ~144 s. | 90 s por paso. |
| D-016 | 17-oct-2026 | Las pruebas de PHP solo corren en GitHub Actions. | El antivirus del equipo de desarrollo retiene los PHP de prueba. | Excepciones en el antivirus. |
| D-017 | 19-oct-2026 | Roles que se suman (8 roles); `requerir_sesion()` es el punto central y exige el área de cada carpeta; las carpetas no asignadas solo para Administrador y Dirección. | Antes cualquier usuario abría cualquier área por URL. | Comprobar en cada puente; listas por área en cada archivo. |
| D-018 | 19-oct-2026 | Cuentas en `portal_usuarios.json` fuera de la web; migración única desde `usuarios.php` + `roles_iniciales`, todo o nada. | Nadie pierde acceso; nada a medias. | Base de datos para 10 usuarios; editar `usuarios.php` a mano. |
| D-019 | 19-oct-2026 | El recorte de contactos lo hace `api.php` por rol: Comercial solo de Prospectos; Contabilidad sin contactos pero con el nombre del responsable; quien no ve Pagos no recibe pagos. | Mínimo dato necesario por rol. | Recortar en la página (el dato viajaría igual). |
| D-020 | 19-oct-2026 | Dirección no toca cuentas con rol Administrador; nadie cambia sus roles ni se desactiva; el último Administrador activo se conserva. | Evitar escaladas y quedarse sin administración. | — |
| D-021 | 20-oct-2026 | `gate.php` ejecuta directo login, logout, cambiar-clave y acceso. | Con el `.htaccess` anterior el login con contraseña temporal entraba en bucle. | Depender solo del `.htaccess`. |
| D-022 | 20-oct-2026 | Documentación del sistema en `docs/`; toda entrega la actualiza en el mismo commit. | El sistema va a crecer y probablemente migrar a Supabase. | Solo Specs internos. |

## Pendientes de decidir (encargo de visitas, Pasar lista y seguimiento)

Propuestas escritas en `MODELO_DATOS.md` y `ACCIONES_API.md`. Se anotan como
decisiones cuando Actio las apruebe.

- P-01 Visitas en la misma pestaña Pruebas con columnas Tipo, Repone asistencia y Resultado por lista (sin renombrar la pestaña ni el prefijo `PRU-`).
- P-02 Acción separada `agendarVisita` (Reposición, Eventual) para que el permiso se decida por acción, como hoy.
- P-03 Pasar lista en una carpeta propia `/pasar-lista/` con su puente, que reutiliza el transporte de `after-school/api.php`.
- P-04 Una fila de Asistencia por niño, clase y fecha; corregir = actualizar la fila con Historial.
