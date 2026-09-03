import { ETAPA_ROTULO, SIN_RESPUESTA, totalDelEmbudo } from '../../lib/etapas';

/**
 * ══ LOS NÚMEROS GRANDES DEL DASHBOARD — puros, fuera del JSX ════════════════
 *
 * La banda de arriba responde «¿cómo viene el negocio?» de un vistazo. Vive acá
 * y no adentro del componente por el motivo de siempre: un `if` en el JSX no se
 * puede interrogar sobre el caso que todavía no pasó — el módulo campaña, el
 * embudo vacío, el server viejo que no manda una etapa.
 *
 * ══ 🔴 TODO SALE DEL EMBUDO, Y NO ES PEREZA ════════════════════════════════
 *
 * Se descartó sacarlos de `porVendedora`: esas cifras son **por persona y por
 * ventana** (`conversaciones_hoy`, `ventas_7d`), así que sumarlas da otro
 * universo que el del embudo — dos números en la misma pantalla contando cosas
 * distintas con el mismo rótulo. Del embudo salen todos del MISMO recorte y del
 * MISMO período, y el total es exactamente la suma de los segmentos que la barra
 * de abajo dibuja.
 *
 * ⚠️ **`conversaciones` NO es `filas.length`**: el radar sirve como máximo 80
 * filas. Contarlas daría «80» para siempre en cuanto el negocio pase de 80.
 *
 * ══ 🔴 LO QUE NO EXISTE NO SE DIBUJA — NI SIQUIERA CON UN GUIÓN ═════════════
 *
 * El diseño aprobado traía dos tiles más: «Conversión» y «Tiempo de primera
 * respuesta». Los dos quedaron AFUERA, y la forma de decirlo es no dibujarlos:
 *
 *   · **Primera respuesta**: `server/src/atencion/tiempos.ts` existe y **no está
 *     enchufado a ninguna ruta** — no baja por `/api/dashboard`. Un tile con «—»
 *     es un skeleton eterno con otro nombre, y ésa es la lección de ADR 0063:
 *     un indicador que no avanza enseña a no mirar la pantalla.
 *   · **Conversión**: se podría calcular `cierre / total`, y **no se llama
 *     conversión**. `resultados/medicion.ts` prohíbe las palabras causales por
 *     una razón medida: `conversiones_wa` dice «esta persona compró alguna vez»,
 *     no «esta conversación vendió». El tile «Compraron» dice el hecho y deja la
 *     causa afuera.
 */
export type IdKpi = 'esperan' | 'conversaciones' | 'precio' | 'compraron' | 'comprometidos' | 'voluntarios';

export interface Kpi {
  id: IdKpi;
  /** Lo que se lee arriba del número. */
  rotulo: string;
  n: number;
  /** La línea chica de abajo. `null` = no hay nada honesto que decir. */
  nota: string | null;
  /** La etapa que este tile representa, para pintarlo con su color. `null` = agregado. */
  etapa: string | null;
}

/**
 * ⚠️ **La ventana la impone la cola, no este archivo**: el embudo cuenta lo de
 * los últimos 30 días (`server/src/cola/consultarCola.ts`, `ventanaCola`). Se
 * dice en la nota del total porque un número grande sin período es un número sin
 * significado — y alguien lo va a leer como «histórico».
 */
const VENTANA = 'últimos 30 días';

function tile(id: IdKpi, rotulo: string, n: number, etapa: string | null, nota: string | null = null): Kpi {
  return { id, rotulo, n, nota, etapa };
}

/**
 * LOS TILES DE ESTA PERSONA, en orden de lectura.
 *
 * 🔴 **Los dos módulos comparten los dos primeros y difieren en los dos
 * últimos**, exactamente como el embudo: `interesado` y `contactado` derivan de
 * quién habló y valen en los dos negocios; lo que sigue no. En ventas la escalera
 * termina en plata (`cotizado` → `cierre`) y en campaña en compromiso
 * (`comprometido` → `voluntario`), que **una persona afirma** — ADR 0063.
 *
 * ⚠️ Un tile cuya etapa el server no mandó se dibuja en CERO, no se esconde: en
 * un embudo, «nadie llegó hasta acá» es información, y esconderlo haría que la
 * banda cambie de forma según el día. Distinto de un tile cuyo DATO no existe
 * (conversión, primera respuesta): ésos no se dibujan nunca.
 */
export function kpisDe(embudo: Record<string, number> | null | undefined, esDeCampana = false): Kpi[] {
  const e = embudo ?? {};
  const n = (clave: string) => e[clave] ?? 0;
  const total = totalDelEmbudo(e);

  const esperan = tile(
    'esperan',
    ETAPA_ROTULO.interesado.varios,
    n('interesado'),
    'interesado',
    'Escribieron y nadie contestó',
  );

  /**
   * ⚠️ El total incluye `sin_respuesta`, que es la etapa MÁS GRANDE (el 65 % en
   * ventas, medido) y la que #329 dejaba afuera. `totalDelEmbudo` suma todas las
   * claves que mandó el server justamente para que no se pueda volver a omitir.
   */
  const conversaciones = tile('conversaciones', 'Conversaciones', total, null, VENTANA);

  if (esDeCampana) {
    return [
      esperan,
      conversaciones,
      tile(
        'comprometidos',
        ETAPA_ROTULO.comprometido.varios,
        n('comprometido'),
        'comprometido',
        'Lo que se cuenta el día de la elección',
      ),
      tile('voluntarios', ETAPA_ROTULO.voluntario.varios, n('voluntario'), 'voluntario', 'Aceptaron hacer algo'),
    ];
  }

  const sinRespuesta = n(SIN_RESPUESTA);
  return [
    esperan,
    conversaciones,
    tile(
      'precio',
      ETAPA_ROTULO.cotizado.varios,
      n('cotizado'),
      'cotizado',
      // El dato que hace accionable el tile: cuántas de esas nunca dijeron una
      // palabra. Si no hay ninguna, no se inventa una nota.
      // Sin separador de miles, como el resto de la pantalla (ver la banda en
      // `VistaDashboard.tsx`): dos formatos para el mismo valor es peor que
      // ninguno.
      sinRespuesta > 0 ? `${sinRespuesta} nunca contestaron` : null,
    ),
    tile('compraron', ETAPA_ROTULO.cierre.varios, n('cierre'), 'cierre', 'Se deriva de una venta posterior'),
  ];
}

/**
 * ══ QUÉ PANELES VAN, POR MÓDULO ════════════════════════════════════════════
 *
 * 🔴 **Es una función y no un condicional repartido por la vista.** Con la
 * decisión en tres lugares, agregar un panel a un módulo deja a los otros dos
 * dibujando el Dashboard viejo — es literalmente la lección que `columnasDe`
 * dejó escrita para el tablero (ADR 0063).
 *
 * ⚠️ **Lo que NO está acá es lo que NO EXISTE**, y la lista importa tanto como
 * la que sí está:
 *   · `ultimasVentas` — el diseño lo pedía y **no hay de dónde sacarlo**:
 *     `/api/dashboard` manda conteos (`porVendedora.ventas_7d`,
 *     `series.ventas_dia`), nunca una lista de ventas con monto y producto.
 *   · `territorio` y `elComando` — los paneles de campaña del diseño. Existe la
 *     tabla (`distrito`, ADR 0063) y **no baja por este endpoint**.
 * Los tres necesitan server, así que van en otro PR. Dibujarlos vacíos sería
 * exactamente lo que este archivo prohíbe arriba.
 */
export type IdPanel = 'miTurno' | 'embudo' | 'equipo' | 'canales' | 'dias' | 'quePiden';

export function panelesDe(esDeCampana = false): IdPanel[] {
  const comunes: IdPanel[] = ['miTurno', 'embudo', 'equipo', 'canales', 'dias'];
  /**
   * 🔴 «Qué piden» es el ranking de CURSOS (`data.cursos`), y un curso es de la
   * Escuela. En campaña ese panel es un cero estructural — no un cero de hoy —
   * y encima le explicaría a un operador político que existe un catálogo de
   * diplomados que nunca va a ver. Es el mismo defecto que ADR 0063 encontró en
   * el panel derecho, con otra pantalla.
   */
  return esDeCampana ? comunes : [...comunes, 'quePiden'];
}
