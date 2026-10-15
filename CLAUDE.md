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
