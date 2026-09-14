import type { ReactNode } from 'react';
import { insigniaDe, LogoDeCanal } from '../../components/BadgeCanal';
import type { AlcanceDeCanal } from '../../dominio/conversaciones';
import { cifra } from '../../lib/formato';
import type { CanalDeLaMesa, ConteoDeCanal, GrupoDeCanal } from './canalDeMesa';
import { ICONO_DE_ETAPA } from './iconoDeEtapa';
import type { ColumnaTablero } from './tablero';

/**
 * LA CABECERA DE UNA COLUMNA DEL PIPELINE — «la tarjeta superior» (13-sep-2026).
 *
 * Pedido del dueño: «en cada tarjeta superior debería decir cuántos de wspp cuántos de
 * fb o ig hay en cada columna». Dice, en este orden: QUÉ es la columna (ícono, título y
 * el (i)), CUÁNTAS hay en el canal que se está mirando (la cifra grande) y DE DÓNDE
 * vienen todas las de esa etapa (la composición por canal, con el elegido resaltado).
 * En «Te esperan», además, lo del día: dos celdas que cada mesa llena con lo suyo
 * (campaña: «N nuevas hoy · N respondidos»; ventas: «N nuevas hoy · N sin abrir»).
 *
 * Nació como `CabeceraColumnaCampana`, sólo para Betto y Américo; el 14-sep-2026 el
 * dueño pidió «el nuevo diseño a escuela ventas» y pasó a ser la cabecera de las DOS
 * mesas. No sabe de módulos: recibe los pares de la fila de íconos de esta mesa
 * (`opciones`) y las celdas ya resueltas (`delDia`), y dibuja lo que le llega.
 *
 * 🔴 **La cifra y la composición cuentan cosas distintas, y es a propósito.** La cifra
 * es la lista de abajo (el canal elegido); la composición es la etapa entera, con todos
 * los canales. Si la composición también se filtrara, con WhatsApp puesto diría «12 · 0 ·
 * 0 · 0 · 0» y no respondería la pregunta del dueño.
 *
 * ⚠️ **Sin card dentro de card** (el sistema de diseño y la maqueta que eligió el dueño):
 * la cabecera es la parte de arriba de la columna y no lleva borde propio. El color sale
 * sólo como señal —el logo de cada canal en su color de marca y un tinte de ese color
 * detrás del elegido—; el resto es navy, gris y blanco. Sin oro: acá nada vence.
 *
 * Con un server que no sabe `mesaPorCanal`, `conteos` llega `null` y la cabecera dice
 * la cifra y el título, nada más.
 */

/** Una celda de «lo del día»: la cifra y su rótulo, con la ayuda que dice de qué es. */
export interface CeldaDelDia {
  n: number;
  rotulo: string;
  ayuda: string;
}

export function CabeceraColumna({
  columna,
  cifras,
  conteos,
  opciones,
  alcance,
  delDia,
  pista,
  colapsar,
  aviso,
  chips,
}: {
  columna: ColumnaTablero;
  /** Las dos cifras de la columna (`cifrasDeColumna`): la del recorte y, si achica, el total. */
  cifras: { principal: number; de: number | null };
  /** La composición por canal de la etapa (`conteoPorCanal`). `null` = server viejo: no se dibuja. */
  conteos: readonly ConteoDeCanal[] | null;
  /** Los pares que ofrece la fila de íconos de ESTA mesa (`canalesDeLaMesa(modulo)`): los que la composición dibuja. */
  opciones: readonly CanalDeLaMesa[];
  /** El canal que se está mirando, para resaltarlo. `null` = «Todos»: no se resalta ninguno. */
  alcance: AlcanceDeCanal | null;
  /**
   * Lo del día, sólo en «Te esperan»: hasta dos celdas ya resueltas por quien llama.
   * Vacío o `null` = la card calla (un recorte puesto, un server sin desglose).
   */
  delDia: readonly CeldaDelDia[] | null;
  /** El (i) de la columna y el botón de colapsar. */
  pista: ReactNode;
  colapsar: ReactNode;
  /** Lo que cambia MIENTRAS se arrastra («Suelta para registrar la venta»); casi siempre nada. */
  aviso?: ReactNode;
  /** Los chips de recorte de la columna, si los ofrece. */
  chips: ReactNode;
}) {
  const Icono = ICONO_DE_ETAPA[columna.id];
  const celdas = delDia ?? [];
  return (
    <header
      data-card-columna={columna.id}
      data-card-te-esperan={columna.id === 'interesado' || undefined}
      className="px-1.5 pb-3 pt-1.5"
    >
      <div className="flex items-center gap-2">
        {Icono && (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-navy-ink shadow-[0_1px_2px_rgba(14,42,82,0.08)]"
          >
            <Icono size={14} strokeWidth={2} />
          </span>
        )}
        <h3 title={columna.titulo} className="min-w-0 truncate font-heading text-[13px] font-bold text-foreground">
          {columna.titulo}
        </h3>
        {pista}
        {colapsar}
      </div>

      <p className="mt-2.5 flex items-baseline gap-1.5 pl-0.5">
        <span
          data-cifra-columna
          className="font-heading text-[26px] font-bold leading-none tracking-tight tabular-nums text-navy-ink"
        >
          {cifra(cifras.principal)}
        </span>
        {/* El tamaño real del montón, cuando un recorte lo achica: sin esto, «47» se
            leería como si la columna entera fueran 47. */}
        {cifras.de != null && (
          <span
            className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
            title={`${cifra(cifras.principal)} de ${cifra(cifras.de)} en total`}
          >
            de {cifra(cifras.de)}
          </span>
        )}
      </p>

      {aviso}

      {conteos && <ComposicionPorCanal conteos={conteos} opciones={opciones} alcance={alcance} />}

      {/* LO DEL DÍA, sólo en «Te esperan»: dos cifras en dos celdas y no una tira. A
          1280 la columna deja ~199 px útiles, y «82 nuevas hoy · 40 respondidos · 30 d»
          en un renglón se partía en dos a la mitad de una frase. */}
      {celdas.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-border/70 pt-2.5">
          {celdas.map((celda) => (
            <div key={celda.rotulo} title={celda.ayuda} className="min-w-0">
              <p className="font-heading text-[15px] font-bold leading-none tabular-nums text-foreground">
                {cifra(celda.n)}
              </p>
              <p className="mt-1 whitespace-nowrap text-[10.5px] leading-none text-muted-foreground">{celda.rotulo}</p>
            </div>
          ))}
        </div>
      )}

      {chips}
    </header>
  );
}

/** Los tres grupos de la fila, en su orden: el filete va ENTRE grupos, nunca antes del primero. */
const GRUPOS: readonly GrupoDeCanal[] = ['mensajes', 'comentarios', 'formulario'];

/**
 * LA COMPOSICIÓN POR CANAL — los pares de la fila de íconos de arriba, con la misma
 * convención: primero los MENSAJES, un filete y después los COMENTARIOS —y en ventas
 * otro filete y FORMULARIO—; el comentario va con un aro (hueco = en público,
 * `BadgeCanal`). Color, logo y nombre salen de `insigniaDe`, la fuente única (#37);
 * Formulario no es una marca y va con el trazo de la casa, como en la fila.
 *
 * ⚠️ Un canal en cero se dibuja igual, más tenue: la fila es la misma en las cinco
 * columnas, y un hueco movería los demás canales de lugar entre una columna y otra.
 */
function ComposicionPorCanal({
  conteos,
  opciones,
  alcance,
}: {
  conteos: readonly ConteoDeCanal[];
  opciones: readonly CanalDeLaMesa[];
  alcance: AlcanceDeCanal | null;
}) {
  const celda = (conteo: ConteoDeCanal) => {
    const op = opciones.find((o) => o.id === conteo.id);
    if (!op) return null;
    const insignia = insigniaDe(op.canal, op.tipo ?? undefined);
    const color = insignia?.color;
    const elegido = alcance != null && alcance.canal === op.canal && alcance.tipo === op.tipo;
    const vacio = conteo.n === 0;
    return (
      <li
        key={op.id}
        data-conteo-canal={op.id}
        data-elegido={elegido || undefined}
        title={`${op.label}: ${cifra(conteo.n)}`}
        style={elegido && color ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined}
        className={
          'inline-flex items-center gap-0.5 rounded-full py-0.5 pl-0.5 pr-1.5 text-[11px] font-semibold tabular-nums ' +
          (elegido ? 'text-foreground' : vacio ? 'text-muted-foreground/60' : 'text-muted-foreground') +
          // Formulario elegido: sin color de marca que tintar, se marca con el gris de la casa.
          (elegido && !color ? ' bg-secondary' : '')
        }
      >
        <span
          aria-hidden
          className={'flex size-3.5 items-center justify-center rounded-full ' + (vacio && !elegido ? 'opacity-45' : '')}
          style={{ color, boxShadow: op.tipo === 'comentario' && color ? `inset 0 0 0 1px ${color}` : undefined }}
        >
          <LogoDeCanal canal={insignia?.logo ?? op.canal} soloGlifo size={op.tipo === 'comentario' ? 8 : 10} />
        </span>
        <span className="sr-only">{op.label}: </span>
        {cifra(conteo.n)}
        {/* Sin la pausa, un lector de pantalla leía «0 2 nuevas hoy» de corrido: el
            último conteo se pegaba a la cifra de abajo. */}
        <span className="sr-only">. </span>
      </li>
    );
  };

  const grupos = GRUPOS.map((grupo) =>
    conteos.filter((c) => opciones.find((o) => o.id === c.id)?.grupo === grupo),
  ).filter((delGrupo) => delGrupo.length > 0);

  return (
    <ul aria-label="De qué canal son" className="mt-2 flex flex-wrap items-center gap-x-0.5 gap-y-1">
      {grupos.map((delGrupo, i) => [
        i > 0 ? <li key={`filete-${i}`} aria-hidden className="mx-0.5 h-3 w-px bg-border" /> : null,
        ...delGrupo.map(celda),
      ])}
    </ul>
  );
}
