# portal-clientes

Portal de proyecto de Actio Growth. Un solo archivo, `portal-v2.html`, sin build
ni dependencias: lee en cada carga cuatro CSV publicados de Google Sheets.

## Cómo se trabaja hoy

Se commitea directo a `main`. Pages publica esa rama, de modo que la dirección
publicada es a la vez la de revisión: hay una sola URL y se refresca el
navegador. Un commit por cambio, para poder revertir cualquiera por separado.

Esto vale **solo mientras nadie externo tenga la URL**.

> **Cuando se le entregue la dirección al cliente hay que volver al esquema de
> rama con revisión previa:** trabajar en una rama aparte, revisar, y fusionar a
> `main` solo lo aprobado. A partir de ese momento `main` es lo que el cliente
> está viendo en vivo, y commitear directo deja de ser aceptable.
>
> Si en ese momento hace falta una dirección de revisión separada, conviene
> recordar que Pages publica una sola fuente por repositorio: las dos
> direcciones tienen que ser dos rutas dentro de lo publicado, no dos ramas.

## Notas

- **No se abre con doble clic.** Con origen `file://` el navegador bloquea las
  peticiones a Google y las cuatro hojas fallan con "Failed to fetch". Hay que
  verlo servido por http, que es como funciona en Pages.
- **Las unidades de negocio y las áreas no están escritas en el código.** Salen
  de una pestaña de catálogo publicada, con su orden y su activación. Si esa
  pestaña falta o no responde, el portal las deriva de los propios datos por
  orden de aparición, así que nunca deja de funcionar.
- **Replicar el portal a otro cliente** son las URLs de CSV y los tokens de
  marca del bloque `:root`. Nada más: no queda ninguna lista de un cliente
  concreto en el código.
