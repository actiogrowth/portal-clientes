# portal-clientes — reglas del proyecto

## Repositorio público

Este repositorio es público y GitHub Pages sirve su contenido. Ningún dato de
clientes (y en especial de niños) entra aquí, ni siquiera como ejemplo: los
datos reales viven en `datos_privados/`, que está en `.gitignore`. Tampoco
entran claves, direcciones `/exec` ni contraseñas.

## Nombres de personas del cliente

En documentos, textos de la página y comentarios del código **no se usan
nombres de personas del cliente**. Se escribe el nombre de la organización
(por ejemplo «Vida en Arte») o el rol: recepción, administración, dirección.

- Bien: «para que administración registre los pagos», «la cuenta que usa recepción».
- Mal: un nombre propio de alguien del equipo del cliente.

Los nombres de usuario de acceso (los logins de `as_usuarios`) son
identificadores técnicos y van solo en la configuración del servidor, no en
textos ni comentarios. En datos de prueba se usan nombres inventados que no
coincidan con los de personas del cliente.

## Documentación (`docs/`)

`docs/` describe el sistema: arquitectura, modelo de datos, catálogo de
acciones (el contrato), reglas de negocio con su prueba, decisiones y la
preparación para migrar a Supabase.

**Toda entrega actualiza `docs/` en el mismo commit.** Si cambia una acción,
una tabla (pestaña o columna), una regla, un rol o la forma de publicar, su
documento cambia con ella. Una decisión nueva se agrega a `DECISIONES.md`. Una
acción nueva se documenta en `ACCIONES_API.md` antes de implementarla.

`docs/` sigue las mismas reglas del repo: sin claves, sin direcciones
`/exec`, sin datos de niños y sin nombres de personas del cliente.
