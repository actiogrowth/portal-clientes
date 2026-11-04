# Plantilla de LEEME para entregas del portal (desde el 4-nov-2026)

Cada entrega lleva dos carpetas fuera del repositorio: `publicar-<nombre>/` y
`volver-<nombre>/`, cada una con su `LEEME.txt`. Esta plantilla trae los
**textos fijos** que se copian tal cual. Lo que va entre `<…>` se llena en cada
entrega. Los pasos que no aplican se borran y los demás se renumeran.

Nunca van en un LEEME guardado en el repositorio: claves, direcciones /exec
completas, correos de familias ni nombres de niños. El LEEME vive en el
computador de Marco; las claves solo van ahí.

---

```
PUBLICAR · <NOMBRE DE LA ENTREGA>
==============================================================================
(<fecha> · versión <xxxxxxx> del portal y <yyyyyyy> de la Base de Datos, en
 «<nombre de la versión de trabajo>». Guardada en GitHub; NO publicada.)

ANTES: <lo que tiene que estar publicado antes, o «nada»>.

Qué trae:
 1. <…>

Hay que hacer <N> pasos, EN ESTE ORDEN.


PASO 1 · Copia de respaldo del Sheet (1 minuto)
-----------------------------------------------------------------------------
 Abre <Sheet> › Archivo › Hacer una copia. Ponle de nombre
 «<Sheet> · respaldo <fecha> antes de <entrega>».


PASO 2 · Programa del Sheet (Apps Script)
-----------------------------------------------------------------------------
 a. <Sheet> › Extensiones › Apps Script (<proyecto, cuenta>).
 b. Abre el archivo <archivo.gs>, borra todo su contenido, pega el de esta
    carpeta y Guardar (el disquete).
 c. <Propiedades del script, si hay alguna nueva>
 d. <Función a ejecutar una vez, si hay alguna, y qué aviso debe salir>
 e. Implementar › Gestionar implementaciones › haz clic en la ACTIVA (la de
    arriba) y confirma que su ID empieza por <prefijo del ID>; las archivadas
    muestran «Biblioteca» sin /exec. En esa, el lápiz (editar) › Versión:
    «Nueva versión» › Implementar.
    NO hagas una implementación nueva: la dirección cambiaría y el portal
    dejaría de leer.


PASO 3 · portal_config.php   (solo si la entrega lo pide)
-----------------------------------------------------------------------------
 cPanel › Administrador de archivos › la carpeta de ARRIBA del portal (donde
 está portal_config.php, fuera de portal.vidaenarte.com) › editar
 portal_config.php.

 ¡CUIDADO! Una línea mal escrita en este archivo deja TODO el portal sin
 datos: las páginas abren, pero ningún puente responde. Pasó el 4-nov.
   · Escribe la línea A MANO (no la copies de un correo, un PDF o un chat:
     cambian las comillas sin que se note).
   · Comillas rectas  '  (no las curvas  ‘ ’ ).
   · Coma al final de la línea.
   · Va ANTES del  ];  del final, junto a las demás líneas.
 La línea:
        '<nombre>' => '<valor>',
 Guardar. Abre AL MOMENTO After School en el portal. Si no carga, vuelve a
 portal_config.php y revisa esa línea antes de seguir con cualquier otro paso.


PASO 4 · Archivos → cPanel › Administrador de archivos › portal.vidaenarte.com
-----------------------------------------------------------------------------
 Carpeta del archivo en esta entrega → carpeta del servidor (<N> archivos):

 <archivo>                     → portal.vidaenarte.com/<carpeta>/   NUEVO | reemplaza

 Orden: primero todo lo de comun/, después las carpetas nuevas, después
 permisos.php y al final las páginas.


COMPROBAR (ventana privada para saltar la caché; computador, tablet y celular)
-----------------------------------------------------------------------------
 a. <…>

Si algo falla: volver-<nombre>/ (LEEME dentro) deja el portal como está hoy.
```

---

## Por qué existen los textos fijos

| Texto | Qué pasó |
|---|---|
| «haz clic en la ACTIVA (la de arriba) y confirma su ID» | 4-nov, Mensajes v1: en la lista de implementaciones de la Base de Datos se vio primero una archivada (Biblioteca, versión 14, sin /exec) y parecía que el puente estaba en otro proyecto. Hay una sola activa, tipo App web. Para la Base de Datos, el ID empieza por `AKfycbyiAv7t` (proyecto «Vida en Arte», cuenta `crececon@actiogrowth.com`; ver `bdclientesvea/CONTEXTO.md` §3). Para los demás programas, compara con la dirección del mismo nombre en `portal_config.php`. |
| «¡CUIDADO! Una línea mal escrita en portal_config.php…» | 4-nov, Mensajes v1: una línea mal escrita dejó todo el portal sin datos hasta que se corrigió. `portal_config.php` lo leen todos los puentes, así que un solo error de escritura los apaga todos a la vez. |
