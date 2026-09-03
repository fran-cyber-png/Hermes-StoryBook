import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * LAS PLANTILLAS APROBADAS, A UN CLIC DE LA CAJA (ADR 0062).
 *
 * ── Qué resuelve ────────────────────────────────────────────────────────────
 * Los textos que el equipo ya escribió, revisó y le hizo aprobar a Meta vivían
 * en Contactos → Campañas, que es una pantalla de supervisor y está a tres clics
 * y una vista de distancia de la conversación. La vendedora los tenía en un
 * WhatsApp propio, en un bloc de notas o en la cabeza. Acá se abren al lado del
 * clip, se pegan en la caja, y ella manda.
 *
 * ── Lo que este módulo NO hace, y hay que tenerlo presente ──────────────────
 * 🔴 **No manda una HSM.** El cuerpo cae en la caja y sale como texto libre por
 * `EnvioControlado`, igual que cualquier cosa que ella escriba. O sea que **esto
 * no reabre una ventana de 24 h vencida**: fuera de la ventana rebota con
 * `131047` como cualquier otro texto, y el aviso que lo dice ya está arriba de la
 * caja (ADR 0058). Mandar la plantilla *como plantilla* es otro frente.
 *
 * ⚠️ **Tampoco manda la imagen del header.** Varias de estas plantillas llevan
 * flyer, y en Goberna el precio vive DENTRO del flyer (ADR 0022). Pegando el
 * texto sale el texto solo: la pantalla lo dice y adjuntarlo es de ella.
 *
 * ── Por qué las reglas del pegado viven acá y no en el componente ───────────
 * Por lo de siempre (ADR 0024): esto es una máquina de bordes —caja vacía, caja
 * con un borrador a medio escribir, cursor en el medio, una plantilla con huecos
 * y una sin— y adentro de un `onClick` esos bordes no se pueden interrogar.
 */

/** Una plantilla lista para pegar. Espejo de `server/src/campana/paraElChat.ts`. */
export interface PlantillaAMano {
  nombre: string;
  idioma: string;
  categoria: string | null;
  cuerpo: string;
  /** Lleva flyer en Meta. Acá sale texto solo: es un aviso, no un bloqueo. */
  headerDeImagen: boolean;
}

export interface CatalogoAMano {
  plantillas: PlantillaAMano[];
  /**
   * Cuántas quedaron afuera. **Opcional a propósito**: el front sale por N4 y el
   * server por N5 (ADR 0021), así que hay una ventana real en la que esta
   * pantalla corre contra un server que todavía no manda el campo. Sin él no se
   * afirma nada sobre lo que falta, porque no se sabe.
   */
  ocultas?: { noAprobadas: number; sinCuerpo: number };
}

export const CLAVE_PLANTILLAS_A_MANO = ['whatsapp', 'plantillas-a-mano'] as const;

/**
 * El catálogo, pedido **solo cuando se abre el selector** (`activo`).
 *
 * Detrás de cada llamada hay una request a la Graph API con 15 s de techo: hacerla
 * al montar el composer la pagaría cada vez que se abre una conversación, que es
 * la acción más frecuente del día, para una lista que se mira de vez en cuando.
 *
 * `staleTime` largo porque el catálogo cambia por acción humana y con el ciclo de
 * aprobación de Meta, que es de horas. `retry: false`: un 502 de Meta se muestra,
 * no se reintenta tres veces contra un reloj de 15 s.
 */
export function usePlantillasAMano(activo: boolean) {
  return useQuery({
    queryKey: CLAVE_PLANTILLAS_A_MANO,
    queryFn: () => api<CatalogoAMano>('/api/campana/plantillas/a-mano'),
    enabled: activo,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * UN HUECO DE META: `{{1}}`, y también el `{{nombre}}` de los parámetros con
 * nombre. No se resuelve nada acá —Hermes no sabe qué va adentro—, se MARCA:
 * lo que la caja hace con esto es dejarlo seleccionado, así el primer gesto de la
 * vendedora es reemplazarlo y no descubrirlo cuando ya se lo mandó al lead.
 *
 * ⚠️ El tope de 40 caracteres y el veto al salto de línea son para no confundir
 * un hueco con un texto entre llaves que alguien escribió a propósito.
 */
const HUECO = /\{\{[^}\n]{1,40}\}\}/;

/** Dónde está el primer hueco, o `null`. El tramo es `[desde, hasta)`. */
export function primerHueco(texto: string): { desde: number; hasta: number } | null {
  const m = HUECO.exec(texto);
  return m ? { desde: m.index, hasta: m.index + m[0].length } : null;
}

/** Cuántos huecos tiene. Es lo que la pantalla dice antes de que ella toque nada. */
export function contarHuecos(texto: string): number {
  return texto.match(new RegExp(HUECO, 'g'))?.length ?? 0;
}

/**
 * LOS HUECOS NUMERADOS `{{1}}..{{n}}` — el contrato que la Cloud API pide para
 * mandar una HSM real (ADR 0072), y NO lo mismo que `HUECO`/`contarHuecos`.
 *
 * `HUECO` marca cualquier `{{...}}` para el pegado-a-texto: ahí no importa qué
 * dice adentro, solo que hay algo para reemplazar. Acá SÍ importa: el mini-
 * formulario tiene que ofrecer un input por cada `{{n}}`, en orden, y eso es
 * exactamente lo que valida `armarComponentesPlantilla` del lado server
 * (`server/src/campana/nombrePlantilla.ts:variablesDe`, la misma idea, del
 * mismo lado del contrato). Un `{{n}}` repetido cuenta una sola vez.
 */
export function variablesNumeradas(cuerpo: string): number {
  const nums = [...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return new Set(nums).size;
}

/**
 * EL TÍTULO DE UN RENGLÓN ES LA PRIMERA LÍNEA CON PALABRAS, no el nombre.
 *
 * El nombre en Meta es un slug (`foro_estado_5_ago`) y no dice de qué habla el
 * mensaje; la primera línea sí («🚨 PROMO 3X1 IMPERDIBLE»). El nombre igual se
 * muestra al lado, en mono y chico: es la identidad, y es lo que se busca cuando
 * hay que cruzar esto con una campaña.
 *
 * ⚠️ Se saltean las líneas vacías, no se toma `split('\n')[0]` a secas: hay
 * cuerpos que arrancan con un renglón en blanco y ahí el título salía vacío.
 */
export function tituloDePlantilla(cuerpo: string): string {
  for (const linea of cuerpo.split('\n')) {
    const l = linea.trim();
    if (l) return l;
  }
  return '(sin texto)';
}

/**
 * LO QUE SIGUE DESPUÉS DEL TÍTULO — el preview del renglón.
 *
 * ⚠️ **No es el cuerpo entero, y eso lo mostró la captura y no un test**: con el
 * cuerpo completo, el renglón dice dos veces la misma línea (título arriba,
 * primera línea del preview abajo) y se lee como un defecto de dibujo. Un
 * mensaje de una sola línea devuelve `''` y ahí el preview no se dibuja: mejor
 * nada que un hueco con el mismo texto.
 */
export function restoDePlantilla(cuerpo: string): string {
  const lineas = cuerpo.split('\n');
  const i = lineas.findIndex((l) => l.trim());
  return i === -1 ? '' : lineas.slice(i + 1).join('\n').trim();
}

/**
 * Las que matchean lo tipeado. Se busca en el NOMBRE y en el CUERPO por lo mismo
 * que en las respuestas rápidas: nadie se acuerda del slug, se acuerda de una
 * palabra del mensaje («foro», «3x1», «cuotas»).
 *
 * Sin consulta devuelve todo, en el orden que vino del server (alfabético por
 * nombre): reordenar por una «relevancia» inventada haría que la misma lista se
 * vea distinta cada vez sin que nadie haya tocado nada.
 */
export function filtrarPlantillas(
  plantillas: readonly PlantillaAMano[],
  consulta: string,
): PlantillaAMano[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [...plantillas];
  return plantillas.filter(
    (p) => p.nombre.toLowerCase().includes(q) || p.cuerpo.toLowerCase().includes(q),
  );
}

/** Lo que hay que escribir en la caja, y qué queda seleccionado después. */
export interface Pegado {
  texto: string;
  /** Inicio de la selección. Con `desde === hasta` es solo el cursor. */
  desde: number;
  hasta: number;
}

/**
 * PEGAR LA PLANTILLA SIN PISAR LO QUE ELLA ESTABA ESCRIBIENDO.
 *
 * 🔴 La caja **no se reemplaza**, se INSERTA en el cursor. Reemplazar es la
 * versión obvia y es la que borra un borrador de tres renglones con un clic en el
 * botón equivocado — un gesto sin deshacer, sobre lo único de la pantalla que
 * nadie más tiene guardado. Con la caja vacía —el caso normal— insertar y
 * reemplazar dan lo mismo, así que no se pierde nada.
 *
 * El salto de línea que separa no es cosmética: una plantilla es un mensaje
 * entero, y pegada al final de una frase a medio escribir queda una oración que
 * no escribió nadie. Se agrega **solo si hace falta**, para no acumular renglones
 * en blanco al pegar dos veces.
 *
 * Y la selección: si la plantilla tiene un hueco, queda MARCADO. Si no, el cursor
 * va al final de lo pegado, listo para seguir escribiendo.
 */
export function pegarPlantilla(texto: string, cursor: number, cuerpo: string): Pegado {
  if (!texto.trim()) {
    const hueco = primerHueco(cuerpo);
    return {
      texto: cuerpo,
      desde: hueco ? hueco.desde : cuerpo.length,
      hasta: hueco ? hueco.hasta : cuerpo.length,
    };
  }

  const pos = Math.max(0, Math.min(cursor, texto.length));
  const antes = texto.slice(0, pos);
  const despues = texto.slice(pos);
  const abre = antes.endsWith('\n') ? '' : '\n';
  const cierra = despues === '' || despues.startsWith('\n') ? '' : '\n';

  const inicio = antes.length + abre.length;
  const hueco = primerHueco(cuerpo);
  return {
    texto: antes + abre + cuerpo + cierra + despues,
    desde: inicio + (hueco ? hueco.desde : cuerpo.length),
    hasta: inicio + (hueco ? hueco.hasta : cuerpo.length),
  };
}
