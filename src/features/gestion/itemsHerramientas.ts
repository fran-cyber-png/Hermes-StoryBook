import { Mail, MessageSquareQuote, NotebookPen, Package, Sparkles, Tag, type LucideIcon } from 'lucide-react';

/**
 * EL MENÚ DE HERRAMIENTAS — el contenedor, no las herramientas.
 *
 * Las cinco entradas que el equipo decidió (`FLUJO.md`) para el botón `···`
 * de la `BarraGestion`. Cada herramienta real (correo rápido, mensajes
 * predeterminados, etiquetas con color, notas, catálogo) es su propio issue
 * y todavía no aterrizó — por eso `armarItemsMenu` recibe los handlers como
 * un mapa PARCIAL: la herramienta sin handler se pinta deshabilitada con
 * «Próximamente», y el día que exista el issue de esa herramienta alcanza
 * con pasarle su callback acá para que el item cobre vida solo.
 */

export type IdHerramienta = 'correo' | 'mensajes' | 'etiquetas' | 'notas' | 'catalogo' | 'datos';

/** Los tres grupos del panel — el orden acá es el orden en que se dibujan. */
export type SeccionHerramienta = 'frecuentes' | 'herramientas' | 'inteligencia';

export const ROTULO_SECCION: Record<SeccionHerramienta, string> = {
  frecuentes: 'Acciones frecuentes',
  herramientas: 'Herramientas',
  inteligencia: 'Inteligencia',
};

/**
 * Los dos módulos de CRM que vive Hermes (ADR 0063). Se escribe inline en tres
 * lugares más del front (`lib/etapas.ts`, `vistas/tablero.ts`, `BarraGestion`),
 * así que acá se le pone nombre y no se inventa un tercer vocabulario.
 */
export type ModuloCrm = 'ventas' | 'campana';

export interface DefinicionHerramienta {
  id: IdHerramienta;
  etiqueta: string;
  Icono: LucideIcon;
  seccion: SeccionHerramienta;
  /** Clase de color del ícono cuando la herramienta está habilitada (Tailwind, literal). */
  color: string;
  /** Se resalta con la píldora «Nuevo» en vez del `>` — para lo recién habilitado. */
  nuevo?: boolean;
  /**
   * DE QUÉ MÓDULO DE CRM ES ESTA HERRAMIENTA (ADR 0063). Ausente = de los dos.
   *
   * Es la misma forma que `SUPERFICIES` en el server (`modulos/modulo.ts`) y el
   * mismo default a propósito: **lo que no se declara es compartido**, porque el
   * motor del CRM —etapas, etiquetas, intereses— le sirve igual a una vendedora
   * y a un operador de campaña, y son las más. Lo que hay que anotar es la
   * excepción, y la excepción es lo que toca Cerberus, icarus o el negocio de la
   * Escuela.
   *
   * ⚠️ **ESCONDE, NO PROTEGE.** Lo que de verdad niega estas herramientas es
   * `modulos/deEsteModulo.ts`; acá se saca el ícono para que no quede una puerta
   * que abre un 403.
   *
   * 🔴 **Y NO importa `noEsDeCampana` de `vistas/acceso.ts`, aunque el riel lo
   * use** — se midió el 24-ago-2026: esa arista `gestion → vistas` subía el nudo
   * de módulos del front **de 7 a 11** (`docs/mapa.md`), o sea que arrastraba a
   * `campana`, `canales`, `padron` y `vistas` adentro del mismo enredo por un
   * predicado de una línea. No es una segunda grafía de la regla: el hecho
   * —«esta persona es de campaña»— lo decide el SERVER y baja una sola vez en la
   * vendedora; acá abajo sólo se compara, igual que ya hace `etapasBarraDe` dos
   * capas arriba en esta misma barra.
   */
  modulo?: ModuloCrm;
}

/** El orden es el de `FLUJO.md`: no se reordena por gusto. */
export const HERRAMIENTAS: DefinicionHerramienta[] = [
  { id: 'correo', etiqueta: 'Correo rápido', Icono: Mail, seccion: 'frecuentes', color: 'text-primary' },
  {
    id: 'mensajes',
    etiqueta: 'Mensajes predeterminados',
    Icono: MessageSquareQuote,
    seccion: 'frecuentes',
    color: 'text-primary',
  },
  { id: 'etiquetas', etiqueta: 'Etiquetas', Icono: Tag, seccion: 'herramientas', color: 'text-success' },
  { id: 'notas', etiqueta: 'Listas / notas', Icono: NotebookPen, seccion: 'herramientas', color: 'text-cat-morado' },
  { id: 'catalogo', etiqueta: 'Catálogo', Icono: Package, seccion: 'herramientas', color: 'text-cat-naranja' },
  /**
   * La sexta, y no estaba en `FLUJO.md`: **«Datos recomendados»** — el catálogo
   * `hechos`, las frases que la vendedora toca en el panel.
   *
   * No reusa el slot `catalogo` porque ése es otra cosa: el catálogo de CURSOS
   * con contexto (#51), que se consulta desde el chat. Éste se EDITA, es del
   * equipo, y hasta ahora se mantenía por SQL a mano — su API existía desde
   * #153 con cero consumidores en el front.
   *
   * Vive acá y no en el panel derecho por un motivo medido: el bloque que
   * mostraba estas frases (`hechos/BloqueHechos.tsx`) **quedó huérfano** cuando
   * el panel se reescribió como timeline (`0b3d17b`), igual que `PanelNotas`.
   * Nadie lo monta. Una puerta ahí no se abre desde ningún lado.
   */
  {
    id: 'datos',
    etiqueta: 'Datos recomendados',
    Icono: Sparkles,
    seccion: 'inteligencia',
    color: 'text-cat-cian',
    nuevo: true,
    /**
     * 🔴 **NO ES DEL OPERADOR DE CAMPAÑA** (24-ago-2026, pedido del dueño). Son
     * los argumentos de venta de la ESCUELA —el precio, el material, «dejó de
     * contestar»— y una candidatura no vende un curso: leerlos en el menú de una
     * campaña es contexto de vendedora ofrecido a quien no lo es.
     *
     * ⚠️ **Y la puerta ya no abría nada**: `/api/hechos` es `ventas` en
     * `modulos/modulo.ts` desde ADR 0063, así que para campaña contesta 403. La
     * pantalla NO mostraba ese error — mostraba «Todavía no hay datos cargados»
     * y «Tienes 0 datos prendidos», o sea que un 403 se leía como un catálogo
     * vacío que a la campaña le tocaba llenar. Un candado que falla hacia
     * «vacío» y no hacia «esto no es tuyo» es peor que ninguno: se le cree.
     */
    modulo: 'ventas',
  },
];

export interface ItemMenu extends DefinicionHerramienta {
  /** `null` = todavía no hay herramienta (issue aparte): el item se deshabilita. */
  onSeleccionar: (() => void) | null;
}

export interface GrupoMenu {
  seccion: SeccionHerramienta;
  items: ItemMenu[];
}

/**
 * Agrupa los items por sección PRESERVANDO el orden de `HERRAMIENTAS` — no
 * ordena, solo junta lo consecutivo. Con eso alcanza porque el array ya viene
 * agrupado por sección; una sección salteada y retomada más abajo se pintaría
 * dos veces, y hoy eso no pasa.
 */
export function agruparPorSeccion(items: readonly ItemMenu[]): GrupoMenu[] {
  const grupos: GrupoMenu[] = [];
  for (const item of items) {
    const actual = grupos.at(-1);
    if (actual && actual.seccion === item.seccion) actual.items.push(item);
    else grupos.push({ seccion: item.seccion, items: [item] });
  }
  return grupos;
}

/**
 * Las herramientas que este módulo tiene en el menú. Sin `modulo` declarado, la
 * herramienta es de los dos.
 *
 * ⚠️ **Ausente se lee como `ventas`**, igual que en el riel (`noEsDeCampana`) y
 * por el mismo motivo: mientras el server no AFIRME que alguien es de campaña
 * —un token viejo, `/yo` que todavía no contestó— el menú tiene que ser el de
 * siempre. Degradar al revés le sacaría herramientas a toda vendedora cuya
 * sesión aún no trajo el módulo, y esconder de más es peor que mostrar de más
 * cuando el server ya niega lo que no le toca.
 */
export function herramientasDe(modulo: ModuloCrm = 'ventas'): DefinicionHerramienta[] {
  return HERRAMIENTAS.filter((h) => !h.modulo || h.modulo === modulo);
}

/**
 * Ata cada herramienta a la `clave` de la conversación abierta — lo único
 * que el menú «pasa hacia abajo». Pura: sin DOM, testeable con un spy sobre
 * el handler para verificar que le llega la `clave` correcta.
 *
 * ⚠️ El tercer parámetro es EL MÓDULO de quien mira, y omitirlo da el menú de
 * `ventas`: los tests que no hablan de módulos siguen viendo las seis, y una
 * pantalla que se olvide de pasarlo falla hacia «se ve» — por eso el candado de
 * verdad está en el server (`modulos/deEsteModulo.ts`) y esto es sólo lo que se
 * dibuja.
 */
export function armarItemsMenu(
  clave: string,
  handlers: Partial<Record<IdHerramienta, (clave: string) => void>> = {},
  modulo: ModuloCrm = 'ventas',
): ItemMenu[] {
  return herramientasDe(modulo).map((herramienta) => {
    const handler = handlers[herramienta.id];
    return {
      ...herramienta,
      onSeleccionar: handler ? () => handler(clave) : null,
    };
  });
}
