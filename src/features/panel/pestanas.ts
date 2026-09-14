/**
 * LAS SECCIONES DEL PANEL DERECHO — pura, para poder discutirla con un test.
 *
 * El panel mide ~360 px en una app de escritorio. Con ese ancho, un acordeón
 * obliga a scrollear para llegar a lo de abajo y a plegar lo de arriba para ver
 * lo de abajo; una barra de pestañas cuesta una fila de 28 px y deja el resto
 * del alto entero para el contenido. Cuatro secciones entran en una fila con
 * ícono + rótulo corto.
 *
 * Lo que NO va en pestañas: la identidad de la persona, sus etiquetas y las dos
 * respuestas sugeridas. Eso se ve SIEMPRE, sin elegir nada — es lo que la
 * vendedora mira en el primer segundo y lo que aprieta en el segundo.
 */

export type IdPestana = "ficha" | "plantillas" | "notas" | "curso";

export interface Pestana {
  id: IdPestana;
  etiqueta: string;
  /** `false` = se muestra apagada con su motivo, nunca se esconde en silencio. */
  disponible: boolean;
  motivo?: string;
}

export interface ContextoPanel {
  canal: "whatsapp" | "facebook" | "instagram";
  /** Hay un teléfono con el que buscar la ficha en Cerberus. */
  conTelefono: boolean;
}

/**
 * Las cuatro, siempre en el mismo orden. Una pestaña que aparece y desaparece
 * según el canal obliga a re-aprender la pantalla en cada conversación: mejor
 * apagada, con el motivo a la vista.
 */
export function pestanasDe(ctx: ContextoPanel): Pestana[] {
  const esWa = ctx.canal === "whatsapp";
  return [
    { id: "ficha", etiqueta: "Ficha", disponible: true },
    {
      id: "plantillas",
      etiqueta: "Enviar",
      disponible: esWa,
      motivo: esWa ? undefined : "Las secuencias se mandan por WhatsApp",
    },
    { id: "notas", etiqueta: "Notas", disponible: true },
    { id: "curso", etiqueta: "Curso", disponible: true },
  ];
}

/**
 * Qué pestaña se abre. Se respeta la última que la vendedora eligió mientras
 * siga disponible —cambiar de conversación no debería reordenarle la cabeza—;
 * si no, la primera disponible.
 */
export function pestanaInicial(pestanas: Pestana[], preferida: IdPestana | null): IdPestana {
  const elegida = pestanas.find((p) => p.id === preferida && p.disponible);
  if (elegida) return elegida.id;
  return pestanas.find((p) => p.disponible)!.id;
}

/**
 * #887 — LAS SECCIONES DEL DETALLE DEL CONTACTO, dentro de la pestaña «Ficha».
 *
 * Hasta acá «Ficha» era Quién es + el timeline entero + Compras, todo
 * apilado en un solo scroll — «un scroll infinito», en palabras del dueño
 * (8-sep-2026). Resumen · Actividad · Compras reparte eso mismo en tres
 * vistas, siempre en el mismo orden: no hay canal ni estado que las apague,
 * así que a diferencia de `pestanasDe` no hace falta un `disponible`/`motivo`
 * por sección.
 *
 * 🔴 **«DATOS» SE FUE EL 13-SEP-2026** (dueño: «apartado Datos ya no existirá,
 * lo pondremos de forma elegante arriba: 1 número, 1 correo, 1 nombre, 1
 * país»). La identidad vive en la cabecera (`EncabezadoTimeline`), y lo que no
 * era identidad —«Lo que dijo el bot», «Dónde vota»— pasó a Resumen. Una
 * preferencia guardada por «Datos» cae en Resumen por la regla de
 * `seccionInicial`, sin migrar nada.
 *
 * 🔴 **EN CAMPAÑA SON DOS: «Compras» NO EXISTE** (regla del dueño,
 * 11-sep-2026: el detalle de contacto de campaña es distinto al de ventas, y
 * no sale nada de ventas ni de compras). No se apaga con un motivo como
 * `pestanasDe`: una pestaña apagada promete que algún día tendrá algo, y en
 * campaña no hay un «todavía» — el negocio no vende. Lo que no cambia es el
 * ORDEN de las que quedan, que es lo que evita re-aprender la pantalla.
 */
export type IdSeccionDetalle = 'resumen' | 'actividad' | 'compras';

export interface SeccionDetalle {
  id: IdSeccionDetalle;
  etiqueta: string;
}

/** De qué módulo es quien mira. Ausente = ventas, el panel de siempre. */
export interface ContextoDetalle {
  esDeCampana?: boolean;
}

const SECCIONES_DETALLE: readonly SeccionDetalle[] = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'actividad', etiqueta: 'Actividad' },
  { id: 'compras', etiqueta: 'Compras' },
];

const SECCIONES_DETALLE_CAMPANA: readonly SeccionDetalle[] = SECCIONES_DETALLE.filter((s) => s.id !== 'compras');

/** Las secciones de quien mira, en el mismo orden — ver el porqué arriba. */
export function seccionesDetalle(ctx: ContextoDetalle = {}): readonly SeccionDetalle[] {
  return ctx.esDeCampana ? SECCIONES_DETALLE_CAMPANA : SECCIONES_DETALLE;
}

/**
 * Qué sección se abre — misma regla que `pestanaInicial`: se respeta la
 * preferencia mientras siga siendo una sección de quien mira; si no, Resumen.
 * En campaña, una preferencia por «Compras» cae ahí por esa misma regla.
 */
export function seccionInicial(preferida: IdSeccionDetalle | null, ctx: ContextoDetalle = {}): IdSeccionDetalle {
  const existe = seccionesDetalle(ctx).some((s) => s.id === preferida);
  return existe ? (preferida as IdSeccionDetalle) : 'resumen';
}
