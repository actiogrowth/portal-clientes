# Arquitectura del portal Vida en Arte 360

Documento vivo: toda entrega que cambie una capa, un archivo de lugar o la
forma de publicar lo actualiza en el mismo commit (ver `CLAUDE.md`).

Este repositorio es **público**. Aquí no van claves, direcciones `/exec`,
datos de niños ni nombres de personas del cliente.

## 1. Capas

```
 Navegador (páginas HTML + JS)
        │  fetch same-origin, cookie de sesión «vea_portal»
        ▼
 Control de acceso (PHP en el cPanel)
   .htaccess → gate.php / puentes  ──  auth.php: requerir_sesion()
   permisos.php (roles)  ·  cuentas.php (usuarios)
        │
        ▼
 Puentes de datos (PHP)            after-school/api.php, configuracion/api.php,
                                   kinder/csv.php, basededatos/api.php…
        │  POST JSON + clave compartida + usuario de la sesión
        ▼
 Apps Script (doPost)              after-school-script/AfterSchool.gs
        │  LockService, Solicitudes (idempotencia), Historial
        ▼
 Google Sheet                      VEA_AfterSchool_BD (una pestaña por tabla)
```

| Capa | Qué hace | Qué NO hace |
|---|---|---|
| Páginas | Muestran datos, arman formularios, validan para avisar antes. Esconden lo que el rol no puede usar. | No deciden nada: el servidor vuelve a validar todo. |
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

## 3. Dónde vive cada cosa

| Qué | Dónde | Cómo se cambia |
|---|---|---|
| Código de las páginas y PHP | Este repo (`portal-raiz/`, `after-school/`, `configuracion/`) | Commit → Actio sube los archivos al cPanel |
| Raíz del portal en el servidor | `/home/…/portal.vidaenarte.com/` | Se sube desde `portal-raiz/` (el `.htaccess` es `htaccess.txt` renombrado) |
| `portal_config.php` | `/home/…/` (una carpeta arriba, fuera de la web) | A mano en el cPanel. Lleva `as_exec`, `as_clave` y la configuración de los tableros. **No está en el repo.** |
| Cuentas del portal | `/home/…/portal_usuarios.json` (fuera de la web) | Solo desde Configuración › Usuarios |
| Sesiones | `/home/…/portal_sesiones/` | Las crea PHP |
| Apps Script | Proyecto ligado al Sheet `VEA_AfterSchool_BD` | Copiar `after-school-script/AfterSchool.gs`, pegar, **Nueva versión** de la implementación |
| Clave del puente | Propiedad del script `AS_CLAVE_API` y `as_clave` en `portal_config.php` | A mano, las dos iguales |
| Datos | El Sheet `VEA_AfterSchool_BD` | Solo a través del puente (o a mano, con cuidado) |
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
| `pruebas-portal/prueba-portal.js` | El portal de punta a punta con `php -S` y las reglas de `htaccess.txt`: roles, áreas, acciones por rol, recortes, usuarios, CSRF, contraseña temporal. |
| `pruebas-portal/roturas-portal.js` | Roturas de roles y usuarios. |

Los datos de prueba son siempre inventados.
