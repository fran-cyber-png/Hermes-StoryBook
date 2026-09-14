/**
 * RECORTA UN NOMBRE A UN LARGO FIJO DE CARACTERES — no de píxeles.
 *
 * `truncate`/`line-clamp` de Tailwind cortan por ANCHO, y ese ancho depende de
 * la fuente, el zoom y el idioma de quien mira: el mismo nombre se corta
 * distinto en dos pantallas. Este tope es el mismo número para cualquiera —
 * pedido del dueño, 11-sep-2026, para que la cabecera del chat
 * (`CabeceraDeChat`, vía `HiloWhatsapp`) y el encabezado del detalle
 * (`EncabezadoTimeline`) corten el MISMO nombre en el MISMO lugar, en vez de
 * cada uno a su propio ancho de columna.
 *
 * ⚠️ **El límite es de los 35 caracteres que se MUESTRAN, no de lo que
 * queda al final.** A 35 caracteres o menos, el nombre vuelve intacto; más
 * largo, se recortan los primeros 35 y se le pegan tres puntos suspensivos
 * aparte — «JASZ Vros Contratistas General» + `...`, no un nombre de 35
 * caracteres YA CONTANDO los puntos.
 *
 * ⚠️ **A propósito NO se usa en «Quién es» (`QuienEs.tsx`)** — ahí el nombre
 * completo es el dato que se vino a buscar, y cortarlo ahí sería esconder lo
 * único que esa fila existe para mostrar. Este recorte es sólo para los dos
 * encabezados, donde el nombre comparte renglón con el teléfono y las
 * píldoras de estado.
 */
export function recortarNombre(nombre: string, limite = 35): string {
  if (nombre.length <= limite) return nombre;
  return nombre.slice(0, limite).trimEnd() + '...';
}
