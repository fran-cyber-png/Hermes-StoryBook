import { sectionLabel } from '../../lib/styles';
import { tarjetasAngostas, terceraTarjetaAngosta } from './disposicion';
import {
  canalesConAlgo,
  NOMBRE_CANAL,
  numero,
  porcentajeDeSustancia,
  porcentajeEnPalabras,
  resumenDeProvincias,
  resumenDeTemas,
  sinProvincias,
  sinTemas,
  type BloqueDeCanal,
  type CanalEscucha,
  type ConteoEscucha,
  type Escucha,
} from './campana';

/**
 * LO QUE LA CAMPAÑA ESTÁ ESCUCHANDO — qué piden, desde dónde, y con qué ánimo.
 *
 * Es la mitad del panel que el comando no tenía: hasta el 4-sep-2026 el
 * Dashboard de campaña contestaba «¿a cuánta gente le contestamos?» y nada
 * sobre QUÉ dice esa gente. El motor vive en `server/src/campana/reporte/`; acá
 * sólo se dibuja lo que ya viene contado y con nombre.
 *
 * ══ 🔴 CADA NÚMERO DICE SOBRE QUÉ SE CUENTA, Y ESO COSTÓ UNA MEDICIÓN ══════
 *
 * La primera versión ponía la proporción de sustancia arriba —**13,9 %** de los
 * mensajes dicen algo más que aplaudir— y debajo, sin más, «Piden algo · Atacan
 * al candidato · Promocionan a un rival», precedidas de la frase «lo de al lado
 * sale de esos 842». Se leía como que las tres filas eran un corte DENTRO de la
 * sustancia. **No lo son**: `clasificar.ts` pone esas marcas sin mirar
 * `sustancia`, que exige además un largo mínimo.
 *
 * Medido sobre la MISMA ventana que el panel dibuja para «30 días»
 * (2026-08-06T05:00Z → 2026-09-05T05:00Z, que es lo que pinta 157 · 31 · 30):
 *
 *     marca                 con la marca   FUERA de sustancia
 *     pedido                        157            10
 *     ataque_al_candidato            31             0
 *     pro_rival                      30            27   ← el 90 %
 *
 * Los 27 son «Vamos Ocrospoma» sueltos: nombran a un rival, no piden nada y no
 * llegan al largo mínimo. La fila decía «30» debajo de un texto que prometía que
 * salían de los 842, y 27 de esos 30 no estaban ahí.
 *
 * Por eso ahora **el denominador es el total del período para todo**, que es lo
 * único cierto de las tres filas a la vez, y está escrito arriba de ellas. Las
 * dos listas de al lado declaran el suyo por separado (`resumenDeTemas`).
 *
 * ══ ⚠️ ACÁ NO HAY CIFRA HÉROE, Y ES DELIBERADO ════════════════════════════
 *
 * La única de la vista es «Siguen sin respuesta», que es la que tiene algo que
 * hacer hoy. Estos bloques son para leer, no para alarmarse: van con barras y
 * números chicos. Dos titulares gigantes no son dos, son ninguno.
 */

/** Cuántas filas de cada lista entran sin que el bloque crezca. */
const FILAS_VISIBLES = 6;

function BarraDeConteo({ c, max }: { c: ConteoEscucha; max: number }) {
  return (
    <div className="flex items-center gap-2">
      {/* `w-[124px]`: con 92 px se truncaba «Agua y saneami…» y «Antonio Raimon…»
          —dos de los nombres más frecuentes del corpus— mientras a la pista le
          sobraban 200 px al lado. Truncar con espacio libre no es densidad, es
          un nombre a medias; el `title` queda igual para el caso extremo. */}
      <span className="w-[124px] shrink-0 truncate text-[11px] text-foreground" title={c.nombre}>
        {c.nombre}
      </span>
      {/* `min-w-[28px]`: con `flex-1` a secas la pista cede TODO su ancho cuando
          la columna se angosta, y la barra desaparece — quedan una etiqueta y un
          número sueltos que ya no comparan nada. Se vio en la captura de 430 px. */}
      <span className="h-1.5 min-w-[28px] flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.max(2, (c.n / max) * 100)}%` }}
        />
      </span>
      {/* `numero` también acá: es la regla de este mismo commit, y dejarla
          afuera dejaría un «1234» al lado de un «De esos mismos 6,082». Con el
          corpus de Betto el máximo es 127, así que ningún test lo puede ver —
          por eso queda escrito. El ancho da para los cuatro dígitos con coma. */}
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {numero(c.n)}
      </span>
    </div>
  );
}

/**
 * ⚠️ **EL RECORTE Y LA FRASE QUE LO DESCRIBE VIVEN DEL MISMO LADO.** `Lista`
 * corta a `FILAS_VISIBLES` y por eso `Lista` arma también el rótulo que lo
 * declara: si el llamador calculara la frase con su propia constante, el corte
 * y su descripción podrían separarse en silencio — que es exactamente el
 * defecto que este archivo existe para no volver a tener.
 */
function Lista({
  items,
  vacio,
  resumen,
}: {
  items: ConteoEscucha[];
  vacio: string;
  resumen: (total: number, visibles: number) => string;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{vacio}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
        {resumen(items.length, FILAS_VISIBLES)}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.slice(0, FILAS_VISIBLES).map((c) => (
          <BarraDeConteo key={c.clave} c={c} max={max} />
        ))}
      </div>
    </>
  );
}

/**
 * LOS CHIPS DE CANAL — y no son cosmética.
 *
 * 🔴 El tema principal CAMBIA según el canal: en el muro es «obras» (el
 * genérico de la hinchada) y en WhatsApp «agua y saneamiento» (lo que la gente
 * pide de verdad). Mezclados, lo segundo queda enterrado bajo lo primero, que
 * tiene tres veces más volumen. El chip es lo que deja verlo.
 */
export function ChipsDeCanal({
  escucha,
  canal,
  onCanal,
}: {
  escucha: Escucha;
  canal: CanalEscucha;
  onCanal: (c: CanalEscucha) => void;
}) {
  const disponibles = canalesConAlgo(escucha);
  if (disponibles.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por canal">
      {disponibles.map((c) => {
        const activo = c === canal;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={activo}
            onClick={() => onCanal(c)}
            className={
              'rounded-full border px-2.5 py-1 text-[11px] transition-colors ' +
              (activo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary')
            }
          >
            {NOMBRE_CANAL[c]}
            <span className="ml-1 font-mono tabular-nums opacity-70">
              {numero(escucha.canales[c]?.total ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** El aviso de que el panel está leyendo con atraso, o no puede leer. */
function AvisoDeEstado({ escucha }: { escucha: Escucha }) {
  if (escucha.estado === 'sin_cliente') {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Tu línea todavía no está asociada a ninguna candidatura, así que no hay de dónde leer qué
        pide la gente. Lo resuelve quien administra los números.
      </p>
    );
  }
  if (escucha.estado === 'sin_diccionario') {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Esta candidatura todavía no tiene su diccionario de temas y lugares. Sin él no se puede
        decir de qué habla la gente sin inventarlo.
      </p>
    );
  }
  if (escucha.pendientes > 0) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {/* 🔴 Dorado: acá el tiempo SÍ se está acabando — son mensajes ya recibidos
            que el panel todavía no leyó, y los porcentajes de abajo son de una
            muestra parcial mientras esto no diga cero. */}
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-gold-ink align-middle" />
        {numero(escucha.pendientes)} mensajes del período todavía sin leer: lo de abajo es una
        parte, no el total.
      </p>
    );
  }
  return null;
}

export function PanelEscucha({
  escucha,
  canal,
  cargando,
}: {
  escucha?: Escucha;
  canal: CanalEscucha;
  cargando: boolean;
}) {
  if (cargando) {
    return (
      <section className={`${tarjetasAngostas} md:grid-cols-[1fr_1fr_minmax(190px,0.8fr)]`}>
        {[0, 1, 2].map((i) => (
          <article key={i} className={'rounded-2xl bg-card p-3.5 shadow-panel' + (i === 2 ? ` ${terceraTarjetaAngosta}` : '')}>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (!escucha) return null;

  if (escucha.estado !== 'ok') {
    return (
      <section className="shrink-0 rounded-2xl bg-card p-3.5 shadow-panel">
        <h3 className={sectionLabel}>Qué pide la gente</h3>
        <div className="mt-2">
          <AvisoDeEstado escucha={escucha} />
        </div>
      </section>
    );
  }

  const b: BloqueDeCanal = escucha.canales[canal] ?? escucha.canales.todas;
  const pct = porcentajeDeSustancia(b);
  const m = b.marcas;
  const provincias = b.lugares.filter((l) => l.esProvincia);

  return (
    // Una columna en el teléfono, dos en sm y las tres desde md (#968), como las tarjetas de arriba.
    <section aria-label="Qué escucha la campaña" className={`${tarjetasAngostas} md:grid-cols-[1fr_1fr_minmax(200px,0.8fr)]`}>
      <article className="flex flex-col rounded-2xl bg-card p-3.5 shadow-panel">
        <h3 className={sectionLabel}>Qué piden</h3>
        <Lista
          items={b.temas}
          resumen={resumenDeTemas}
          vacio={sinTemas(canal)}
        />
      </article>

      <article className="flex flex-col rounded-2xl bg-card p-3.5 shadow-panel">
        <h3 className={sectionLabel}>De dónde hablan</h3>
        {/* Sólo provincias: con los distritos adentro, las veinte de Áncash
            compiten con sus propios distritos y ninguna lista se puede leer.
            Que la lista es de PROVINCIAS lo dice el resumen, no el título. */}
        <Lista
          items={provincias}
          resumen={resumenDeProvincias}
          vacio={sinProvincias(canal)}
        />
      </article>

      <article className={`flex flex-col rounded-2xl bg-card p-3.5 shadow-panel ${terceraTarjetaAngosta}`}>
        <h3 className={sectionLabel}>Cuánto de esto sirve</h3>
        <p className="mt-1.5 font-heading text-[26px] font-bold leading-none text-foreground">
          {porcentajeEnPalabras(pct)}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {numero(b.sustancia)} de los {numero(b.total)} mensajes del período dicen algo más que
          aplaudir.
        </p>
        {/* 🔴 EL DENOMINADOR DE LAS TRES FILAS, ESCRITO. Es el total y no la
            sustancia: las tres marcas se ponen sin mirarla (ver el docblock de
            arriba — 28 de 31 `pro_rival` quedan fuera). Y son conteos
            independientes sobre el mismo total, no las partes de una torta:
            sumarlas no da nada. */}
        <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
          De esos mismos {numero(b.total)}, cada uno por su cuenta:
        </p>
        <dl className="mt-1 flex flex-col gap-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Piden algo</dt>
            <dd className="ml-auto font-mono tabular-nums">{numero(m.pedido ?? 0)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Rojo, no dorado: esto no es tiempo que se acaba, es agresión recibida. */}
            <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
            <dt className="text-muted-foreground">Atacan al candidato</dt>
            <dd className="ml-auto font-mono tabular-nums">{numero(m.ataque_al_candidato ?? 0)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Promocionan a un rival</dt>
            <dd className="ml-auto font-mono tabular-nums">{numero(m.pro_rival ?? 0)}</dd>
          </div>
        </dl>
        <div className="mt-auto pt-2">
          <AvisoDeEstado escucha={escucha} />
        </div>
      </article>
    </section>
  );
}
