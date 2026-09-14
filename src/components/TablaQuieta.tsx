import type { ReactNode } from 'react';
import { Avatar } from './Avatar';

/**
 * LA TABLA QUIETA — cómo se ve una tabla de datos en Hermes (ADR 0102).
 *
 * Nació con el rediseño de Contactos (10-sep-2026) sobre una referencia que
 * mostró el dueño: bordes finos en las dos direcciones, filas altas, encabezado
 * en tipo de oración y la persona con su avatar. La usan el padrón y la Lista del
 * Pipeline (`features/vistas/ListaPipeline.tsx`): `celdaQuietaDensa`, `alLado`
 * y `data-nombre` existen por pedido de esa lista.
 *
 * ── Por qué son CLASES y no un componente `<Tabla>` ──
 * Las dos tablas dibujan sus filas distinto: el padrón a mano, la Lista con el
 * `flexRender` de TanStack. Un componente que envolviera `<table>` no le serviría
 * a ninguna sin volverse un segundo motor de tabla. Lo que tiene que ser igual es
 * cómo se VEN, y eso son unas pocas cadenas.
 *
 * ⚠️ **Bordes separados con espaciado cero, no colapsados.** Con la cabecera
 * pegajosa, el borde de una tabla colapsada es de la TABLA y no de la celda: al
 * hacer scroll la línea de abajo del encabezado se queda atrás y las filas pasan
 * por debajo sin corte. Con bordes separados, cada celda lleva el suyo.
 *
 * ⚠️ **La última celda de cada fila no lleva borde derecho**: el contenedor ya
 * tiene el suyo, y dos líneas juntas se leen como una gruesa.
 */

/**
 * El `<table>`. Lleva el fondo de la tarjeta: sin él las filas toman el gris de
 * la página y el encabezado —que sí es tarjeta— se lee como otra superficie
 * (medido en la captura clara del 10-sep-2026).
 */
export const tablaQuieta = 'w-full border-separate border-spacing-0 bg-card text-sm';

/** El `<thead>`: pegajoso y OPACO — con fondo translúcido las filas se leen a través al hacer scroll. */
export const cabeceraQuieta = 'sticky top-0 z-10 bg-card';

/** Un `<th>`: tipo de oración, no mayúsculas — un encabezado en mayúsculas pesa más que los datos que nombra. */
export const celdaDeCabecera =
  'whitespace-nowrap border-b border-r border-border px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground last:border-r-0';

/** Un `<td>` de una tabla que se LEE fila por fila (el padrón): filas altas, alineadas al medio. */
export const celdaQuieta = 'border-b border-r border-border px-3 py-3 align-middle last:border-r-0';

/**
 * Un `<td>` de una lista de TRABAJO de cientos de filas (la Lista del Pipeline).
 * Misma tabla, otra altura: a 720 px, con la alta entran ~10 filas y con ésta 13
 * (medido por hermes-5d el 10-sep-2026). Los bordes son los mismos.
 */
export const celdaQuietaDensa = 'border-b border-r border-border px-3 py-1.5 align-middle last:border-r-0';

/**
 * UNA PERSONA EN UNA CELDA — iniciales en círculo, el nombre y, si hay, una línea
 * de detalle debajo.
 *
 * ⚠️ **Nunca con foto**: una tabla dibuja hasta 50 filas de una, y pedirle a
 * WhatsApp una foto por fila es el patrón que la regla dura #7 prohíbe
 * (rate-limit, riesgo de ban). Iniciales solas, como manda el docblock de
 * `Avatar`.
 *
 * ⚠️ **El círculo va en `secondary`, no en un azul marino con transparencia**: el
 * marino al 10 % sobre la tarjeta oscura da el mismo color que la tarjeta, y en
 * tema oscuro las iniciales flotaban sin círculo (captura del 10-sep-2026).
 *
 * El nombre lleva `data-nombre`: es el gancho estable para un test que busca una
 * fila por persona, sin depender de cómo se parte el texto de la celda.
 */
export function CeldaPersona({
  nombre,
  detalle,
  insignia,
  alLado,
  titulo,
  compacta = false,
}: {
  nombre: string | null;
  /** La segunda línea (un correo, un rol). Tenue y truncada. */
  detalle?: ReactNode;
  /** Algo MONTADO sobre el avatar, abajo a la derecha — el punto de frescura del padrón. */
  insignia?: ReactNode;
  /**
   * Algo EN LÍNEA después del nombre — el canal de una conversación en la Lista
   * del Pipeline. ⚠️ Un canal no va montado sobre las iniciales: achicado sobre el
   * avatar, el círculo verde de WhatsApp se lee como el punto verde del semáforo,
   * que es otra cosa y tiene su propia columna.
   */
  alLado?: ReactNode;
  /** El `title`: el dato completo cuando el nombre se muestra recortado. */
  titulo?: string;
  /** Avatar chico y una sola línea: para una columna secundaria, como «Asignado a». */
  compacta?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5" title={titulo}>
      <span className="relative shrink-0">
        <Avatar
          nombre={nombre}
          className={`rounded-full bg-secondary font-bold text-secondary-foreground ${compacta ? 'size-6 text-[9px]' : 'size-8 text-[11px]'}`}
        />
        {insignia}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            data-nombre={nombre ?? ''}
            className={`min-w-0 truncate text-foreground ${compacta ? 'text-xs font-medium' : 'font-semibold'}`}
          >
            {nombre ?? '—'}
          </span>
          {alLado && <span className="shrink-0">{alLado}</span>}
        </span>
        {detalle && !compacta && <span className="block truncate text-xs text-muted-foreground">{detalle}</span>}
      </span>
    </span>
  );
}
