import { useState } from 'react';
import { Megaphone, Scale, Undo2, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { claveDeVendedora } from '../../dominio/dueno';
import { nombreCortoLocal } from './piezas';
import { usePonerRepartoDeAnuncio, type AnuncioDeCampana } from './routing';
import {
  escritoInicial,
  estadoDeLaSuma,
  leerEscrito,
  queGuardaria,
  repartirParejo,
  type Escrito,
} from './repartoDeAnuncio';

/**
 * CÓMO SE REPARTEN LOS LEADS DE UN ANUNCIO — en porcentajes (#1002).
 *
 * ══ QUÉ PROBLEMA CIERRA ══════════════════════════════════════════════════════
 *
 * Hasta #1002 la unidad del ruteo era la campaña, y adentro repartía parejo.
 * El pedido del dueño (11-sep-2026) fue poder decir, **por anuncio**, «de éste
 * 30 % para Ana y 70 % para Luz». Un anuncio sin reparto propio sigue con la
 * regla de su campaña, así que esta hoja es una excepción opcional, no un paso
 * que haya que hacer en cada anuncio.
 *
 * ══ 🔴 SUMA 100 O NO SE GUARDA ═══════════════════════════════════════════════
 *
 * Decisión del dueño. El pie lo dice con palabras («faltan 20 %») y el botón no
 * se prende con otra suma: con 30 + 50 guardado, el 20 % restante lo terminaría
 * decidiendo alguien que no está en la pantalla.
 *
 * ══ POR QUÉ UNA HOJA Y NO CABLES ═════════════════════════════════════════════
 *
 * Los anuncios viven adentro del nodo de la campaña, en una lista con scroll
 * propio. Un cable que sale de un renglón que se desplaza no tiene dónde
 * anclarse, y un número pegado a una curva no se puede editar con el teclado.
 * Acá cada parte es una casilla con su nombre.
 *
 * ══ SE SUPERPONE, Y EL LLAMADOR APAGA SU ESCAPE ══════════════════════════════
 *
 * Mismo molde que `HojaDeLaPieza`: encima del lienzo, sin scrim, y `useEscape`
 * en captura. `VistaRouting` apaga el Escape que cierra la campaña mientras esta
 * hoja está montada — si no, un Escape cerraría la hoja y la campaña de una.
 *
 * **Sin oro**: el dorado significa tiempo que se acaba y acá no corre nada.
 */
export function HojaDelAnuncio({
  anuncio,
  campana,
  destinos,
  deBaja,
  onCerrar,
}: {
  anuncio: AnuncioDeCampana;
  /** El nombre de la campaña, para decir de dónde es este anuncio. */
  campana: string;
  destinos: readonly string[];
  deBaja: readonly string[];
  onCerrar: () => void;
}) {
  const previo = anuncio.reparto ?? [];
  const [editor, setEditor] = useState(() => escritoInicial(destinos, previo));
  const poner = usePonerRepartoDeAnuncio();
  useEscape(onCerrar);

  const lectura = leerEscrito(editor.orden, editor.escrito);
  const suma = estadoDeLaSuma(lectura.partes);
  const plan = queGuardaria(lectura, previo);
  const seFueron = new Set(deBaja.map((v) => claveDeVendedora(v)));
  const seFue = (v: string) => seFueron.has(claveDeVendedora(v));

  function escribir(vendedora: string, valor: string) {
    setEditor((e) => ({ ...e, escrito: { ...e.escrito, [vendedora]: valor } }));
  }

  /**
   * PAREJO ENTRE LAS QUE YA TIENEN PARTE, o entre todas si no hay ninguna.
   * Es el atajo para no tipear 34 · 33 · 33 y quedarse mirando «faltan 1 %».
   */
  function parejo() {
    const conParte = lectura.partes.map((p) => p.vendedora);
    const entre = conParte.length > 0 ? conParte : editor.orden.filter((v) => !seFue(v));
    const partes = new Map(repartirParejo(entre).map((p) => [p.vendedora, String(p.porcentaje)]));
    const escrito: Escrito = {};
    for (const v of editor.orden) escrito[v] = partes.get(v) ?? '';
    setEditor((e) => ({ ...e, escrito }));
  }

  function guardar() {
    if (plan.accion === 'guardar') poner.mutate({ adId: anuncio.adId, reparto: lectura.partes });
  }

  function quitar() {
    poner.mutate(
      { adId: anuncio.adId, reparto: [] },
      {
        onSuccess: () => {
          const escrito: Escrito = {};
          for (const v of editor.orden) escrito[v] = '';
          setEditor((e) => ({ ...e, escrito }));
        },
      },
    );
  }

  const tonoDeLaSuma =
    suma.tipo === 'justo' ? 'text-navy-ink' : suma.tipo === 'vacio' ? 'text-muted-foreground' : 'text-destructive';

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex w-[22.5rem] flex-col border-l border-border bg-background shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)]"
      aria-label="Reparto de este anuncio"
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
        <Megaphone size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-cat-morado" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-foreground">{anuncio.titular ?? '(sin titular)'}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Anuncio de «{campana}» · {anuncio.personas} {anuncio.personas === 1 ? 'persona' : 'personas'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors duration-200 ease-house hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="px-4 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo se reparten sus leads
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Cada lead nuevo de este anuncio le toca a quien esté más lejos de su parte. Si lo dejas
            vacío, decide la regla de la campaña.
          </p>

          <ul className="mt-3 space-y-1">
            {editor.orden.map((v) => {
              const deBajaV = seFue(v);
              const invalida = lectura.invalidas.includes(v);
              const nombre = nombreCortoLocal(v);
              return (
                <li key={v} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary/60">
                  <span title={v} className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {nombre}
                    {deBajaV && <span className="ml-1.5 text-[10px] text-muted-foreground">de baja</span>}
                  </span>
                  <label
                    className={
                      'flex w-[4.5rem] shrink-0 items-center rounded-lg border bg-background px-2 py-1 transition-colors duration-200 ease-house focus-within:border-navy/60 ' +
                      (invalida ? 'border-destructive' : 'border-border')
                    }
                  >
                    <input
                      value={editor.escrito[v] ?? ''}
                      onChange={(e) => escribir(v, e.target.value)}
                      // ⚠️ Texto con teclado numérico y no `type="number"`: el
                      // numérico acepta «1e2» y «33.5», y en Safari la rueda del
                      // mouse le cambia el valor a quien sólo quería desplazarse.
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="0"
                      // A quien se fue se le puede SACAR la parte (vaciarla), no dar una nueva.
                      disabled={deBajaV && !(editor.escrito[v] ?? '').trim()}
                      aria-label={`Porcentaje de ${nombre}`}
                      aria-invalid={invalida}
                      className="w-full min-w-0 bg-transparent text-right text-xs tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                    />
                    <span className="ml-0.5 text-[11px] text-muted-foreground" aria-hidden>
                      %
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {editor.orden.length === 0 && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Esta línea todavía no tiene a nadie a quien repartirle.
            </p>
          )}
        </section>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3">
        <p className={'text-xs font-medium tabular-nums ' + tonoDeLaSuma} aria-live="polite">
          {suma.texto}
        </p>
        {plan.bloqueo && plan.bloqueo !== suma.texto && (
          <p className="text-[11px] text-muted-foreground">{plan.bloqueo}</p>
        )}
        {/**
         * ⚠️ **Se dice ANTES de guardar, no en el acuse**: cambiar el reparto
         * reinicia la cuenta de lo que cada una ya recibió de este anuncio. Es lo
         * que evita ráfagas, y quien lo cambia tiene que saberlo antes de apretar.
         */}
        {previo.length > 0 && plan.accion === 'guardar' && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Al guardar, lo repartido se vuelve a contar desde cero con los porcentajes nuevos.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={plan.accion !== 'guardar' || poner.isPending}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-200 ease-house hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={parejo}
            disabled={poner.isPending || editor.orden.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-[color,border-color] duration-200 ease-house hover:border-navy/40 hover:text-navy-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Scale size={12} strokeWidth={2} aria-hidden />
            Repartir parejo
          </button>
          {previo.length > 0 && (
            <button
              type="button"
              onClick={quitar}
              disabled={poner.isPending}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors duration-200 ease-house hover:text-navy-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Undo2 size={12} strokeWidth={2} aria-hidden />
              Quitar el reparto
            </button>
          )}
        </div>

        {poner.isError && (
          <p className="text-[11px] text-destructive">{(poner.error as Error).message}</p>
        )}
        {/**
         * ⚠️ **El acuse lee lo que se MANDÓ (`variables`), no el eco del server.**
         * Con el eco, una respuesta con otra forma —un server de otra versión,
         * durante un despliegue— tiraba la vista entera de Routing por un texto
         * de confirmación. `cambio` sí sale del server, y si falta se lee como
         * «guardado», que es lo que pasó.
         */}
        {poner.isSuccess && poner.variables && (
          <p className="text-[11px] text-navy-ink">
            {poner.variables.reparto.length === 0
              ? 'Listo: este anuncio vuelve a la regla de la campaña.'
              : poner.data?.cambio === false
                ? 'No había cambios que guardar.'
                : 'Guardado. Lo repartido se cuenta desde ahora.'}
          </p>
        )}
      </footer>
    </aside>
  );
}
