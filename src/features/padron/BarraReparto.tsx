import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Loader2, UserMinus, UserPlus, X } from 'lucide-react';
import { cifra } from '../../lib/formato';
import { usePopover } from '../../lib/teclado/usePopover';
import {
  nombreCorto,
  useContarConDueno,
  useHabilitar,
  useHabilitarRecorte,
  useQuitarDelReparto,
  type CargaVendedora,
  type FiltrosPadron,
} from './padron';
import { cuantos, necesitaConfirmar, type Seleccion } from './seleccion';
import { DeshacerEnAcuse, TiraDeshacer, type Deshacer } from './Deshacer';

/**
 * REPARTIR EL LOTE — un control FIJO arriba (`BotonDeReparto`) y una franja
 * abajo que solo habla de lo que NO es repartir (`BarraReparto`).
 *
 * ── Por qué se partió en dos (24-ago-2026, pedido del dueño) ──
 * Antes todo esto era una sola barra que aparecía y desaparecía con la
 * selección: tildar, elegir destino, repartir, la barra se iba, tildar de
 * nuevo, volver a elegir destino. Viendo la pantalla en vivo, el dueño pidió
 * mover el reparto arriba a la derecha —donde vivía «Más nuevos»— para que
 * sea un control **estable**: el destino elegido siempre a la vista, el botón
 * siempre en el mismo lugar, y lo único que cambia es el número.
 *
 * ⚠️ **El botón fijo con destino recordado es fácil de apretar por inercia**
 * (el riesgo que el dueño mismo marcó). Dos frenos, ninguno nuevo — ya
 * existían para el caso momentáneo, ahora hacen falta para el permanente:
 * el rótulo siempre nombra a quién y cuántos («Repartir 4 a Luz», nunca un
 * «Repartir» sin dueño ni cifra) y con 0 elegidos el botón queda
 * VISIBLEMENTE apagado (gris, deshabilitado) en vez de listo. El paso de
 * confirmación desde `CONFIRMAR_DESDE` (abajo) sigue intacto.
 *
 * `useReparto` es el estado y las mutaciones, UNA vez, en `PantallaPadron`:
 * la tira de arriba y la franja de abajo leen el mismo objeto porque las dos
 * hablan de la MISMA selección — separarlas en dos hooks hubiera significado
 * dos mutaciones corriendo por separado para la misma acción.
 */
export function useReparto({
  seleccion,
  total,
  filtros,
  onListo,
}: {
  seleccion: Seleccion;
  /** El total del recorte: en modo `recorte` es de donde sale «cuántos». */
  total: number;
  filtros: FiltrosPadron;
  /** `huboRecorte`: si el reparto fue «todo el filtro», la página tiene que volver a 1. */
  onListo: (huboRecorte: boolean) => void;
}) {
  const [destino, setDestino] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [hecho, setHecho] = useState<{ cuantos: number; a: string } | null>(null);
  const porLista = useHabilitar();
  const porRecorte = useHabilitarRecorte();
  const quitar = useQuitarDelReparto();

  const n = cuantos(seleccion, total);

  /**
   * EL DESTINO SOBREVIVE AL REPARTO, y es a propósito (pedido del dueño,
   * 24-ago-2026: repartir en tandas rápidas a la misma persona sin reabrir
   * «Elegir a quién» en cada una — antes `setDestino('')` en cada éxito
   * obligaba a reelegir).
   *
   * ⚠️ **Pero SÍ se resetea si cambia el FILTRO** (no la página, no un reparto
   * exitoso): el reverso del pedido es no repartir a la persona equivocada por
   * inercia. Cambiar de «Sin asignar» a «Asignado a Tracy» para MIRAR su
   * lote no debería dejar el botón listo para repartírselo a alguien más sin
   * que el supervisor lo haya vuelto a elegir a propósito.
   */
  const { pagina: _pagina, porPagina: _porPagina, ...criterioDelFiltro } = filtros;
  const claveDelFiltro = JSON.stringify(criterioDelFiltro);
  useEffect(() => {
    setDestino('');
  }, [claveDelFiltro]);

  // Antes de repartir, no en el acuse de después (regla dura #7). Solo en modo
  // `recorte`: ver el docblock de `useContarConDueno` en `padron.ts`.
  const conDueno = useContarConDueno(
    seleccion.modo === 'recorte' && n > 0
      ? { filtros, excluidos: seleccion.excluidos, vendedoraId: destino }
      : null,
  );

  // El acuse sobrevive a que la selección se vacíe (que es lo que pasa al
  // terminar): sin esto, repartir 17.014 contactos no deja NINGUNA señal de que
  // algo pasó — la franja de abajo simplemente desaparece.
  useEffect(() => {
    if (!hecho) return;
    const t = setTimeout(() => setHecho(null), 8000);
    return () => clearTimeout(t);
  }, [hecho]);

  const trabajando = porLista.isPending || porRecorte.isPending || quitar.isPending;
  const error = porLista.error ?? porRecorte.error ?? quitar.error;

  function repartir() {
    const huboRecorte = seleccion.modo === 'recorte';
    const listo = (r: { habilitados: number; vendedoraId: string }) => {
      // El número del ACUSE es el que devolvió el server, no el que teníamos en
      // la mano: el recorte se resuelve de nuevo allá y pueden haber entrado
      // contactos nuevos. Repetir la cifra vieja esconde la diferencia.
      setHecho({ cuantos: r.habilitados, a: r.vendedoraId });
      // ⚠️ `destino` NO se resetea acá — ver el docblock de más arriba. Sí se
      // limpia la selección y, en modo `recorte`, la página (vía `onListo`):
      // el recorte que se veía ya no existe como tal.
      setConfirmando(false);
      onListo(huboRecorte);
    };

    if (huboRecorte) {
      porRecorte.mutate(
        { filtros, excluidos: seleccion.excluidos, vendedoraId: destino },
        { onSuccess: listo },
      );
      return;
    }
    porLista.mutate({ contactoIds: seleccion.ids, vendedoraId: destino }, { onSuccess: listo });
  }

  function intentarRepartir() {
    if (necesitaConfirmar(n)) {
      setConfirmando(true);
      return;
    }
    repartir();
  }

  function quitarSeleccion() {
    if (seleccion.modo !== 'lista') return;
    quitar.mutate(seleccion.ids, {
      onSuccess: (r) => {
        setHecho({ cuantos: r.quitados, a: '' });
        onListo(false);
      },
    });
  }

  return {
    n,
    /** Lectura EN VIVO, para el «Quedan N» del acuse — ver `BarraReparto` abajo. */
    total,
    seleccionEsRecorte: seleccion.modo === 'recorte',
    destino,
    setDestino,
    confirmando,
    setConfirmando,
    hecho,
    setHecho,
    trabajando,
    error,
    conDueno,
    repartir,
    intentarRepartir,
    quitarSeleccion,
    quitarPendiente: quitar.isPending,
    puedeQuitar: seleccion.modo === 'lista',
    /**
     * ⚠️ **Con el filtro «Sin asignar» puesto, NINGUNA fila visible tiene
     * dueño** — no es un límite del modo (como el de `recorte`, que se saca
     * cambiando a `lista`), es que la lista misma garantiza que no hay nada
     * que devolver al pozo común. Por eso «Quitar» ni se OFRECE acá: un botón
     * deshabilitado diría «esto existe pero no aplica ahora», y lo que hace
     * falta decir es que esto no va con lo que se está mirando (hermes-4c,
     * revisando `flujo-5-sigo-tildando.png`, 24-ago-2026).
     */
    mostrarQuitar: !filtros.sinHabilitar,
  };
}

export type Reparto = ReturnType<typeof useReparto>;

/**
 * EL BOTÓN DE REPARTIR, PARTIDO — `[Repartir 4 a Luz | ▾]` (ADR 0102).
 *
 * ── La regla que sigue en pie (24-ago-2026) ──
 * NO puede desaparecer: desaparecer es exactamente el vaivén que esto vino a
 * sacar. El destino se recuerda, el botón está siempre en el mismo lugar, y el
 * rótulo nombra a quién y cuántos cuando lo sabe.
 *
 * ── Lo que cambió con la fila quieta ──
 * Antes era una tira de ~300 px —el contador en «0», «Elegir a quién ▾» y
 * «Repartir»— que con nada elegido ocupaba la fila apagada. Ahora es UN control:
 * la mitad izquierda reparte, la flecha elige a quién. Con 0 elegidos se lee
 * «Repartir» apagado (o «Repartir a Luz», si ya eligió); la flecha sigue viva,
 * así que se puede elegir el destino antes de tildar.
 *
 * El freno contra apretar por inercia es el mismo de siempre: el botón armado
 * dice la cifra y el nombre, y desde `CONFIRMAR_DESDE` hay confirmación.
 */
export function BotonDeReparto({
  reparto,
  destinos,
  carga,
}: {
  reparto: Reparto;
  destinos: string[];
  carga: CargaVendedora[];
}) {
  const { n, destino, setDestino, trabajando, confirmando, intentarRepartir } = reparto;
  const activo = n > 0;
  const armado = activo && Boolean(destino) && !trabajando;
  const porQueNo = !activo && !destino
    ? 'Elige contactos en la tabla y, con la flecha, a quién dárselos'
    : !activo
      ? 'Elige contactos en la tabla'
      : !destino
        ? 'Elige a quién con la flecha'
        : undefined;

  return (
    <div className="flex h-8 shrink-0 items-stretch">
      <button
        type="button"
        disabled={!armado}
        onClick={intentarRepartir}
        title={porQueNo}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-l-lg border px-3 text-xs font-semibold transition-colors duration-200 ${
          armado
            ? 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover'
            : 'cursor-not-allowed border-border bg-muted text-muted-foreground'
        }`}
      >
        {trabajando && !confirmando ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        {rotuloDeReparto(n, destino)}
      </button>
      <ElegirDestino destinos={destinos} carga={carga} elegido={destino} onElegir={setDestino} armado={armado} />
    </div>
  );
}

/**
 * QUÉ DICE EL BOTÓN — a quién y cuántos, lo que se sepa. Nunca promete una cifra
 * que no hay: con 0 elegidos no dice «Repartir 0».
 */
export function rotuloDeReparto(n: number, destino: string): string {
  if (n > 0 && destino) return `Repartir ${cifra(n)} a ${nombreCorto(destino)}`;
  if (n > 0) return `Repartir ${cifra(n)}`;
  if (destino) return `Repartir a ${nombreCorto(destino)}`;
  return 'Repartir';
}

/**
 * EL AVISO DE «YA TIENE DUEÑO», antes de repartir (regla dura #7). Vive
 * pegado al header —donde está ahora el control de reparto— para que no haga
 * falta bajar la vista hasta la franja de abajo para verlo.
 */
export function AvisoDeDueno({ reparto }: { reparto: Reparto }) {
  const { seleccionEsRecorte, destino, conDueno, error } = reparto;
  if (!seleccionEsRecorte && !error) return null;

  return (
    <>
      {seleccionEsRecorte && !destino && !!conDueno.data?.conDueno && (
        <p className="flex items-start gap-1.5 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {cifra(conDueno.data.conDueno)} de estos ya tienen a alguien asignado.
        </p>
      )}
      {seleccionEsRecorte && destino && !!conDueno.data?.deOtra && (
        <p className="flex items-start gap-1.5 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {cifra(conDueno.data.deOtra)} de estos ya son de otra persona.
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {/* El 409 del server enumera a quién SÍ se puede, o dice cuántos son
              y que hay que acotar. Se muestra tal cual: adivinar el motivo es
              cómo un dedazo se vuelve invisible. */}
          {error.message}
        </p>
      )}
    </>
  );
}

/**
 * LA FRANJA DE ABAJO — lo que NO es repartir: el acuse de éxito (con el
 * «Quedan N»), «Quitar del reparto» y, más adelante, el deshacer. El botón de
 * repartir NO vive acá — para no tenerlo dos veces, vive solo en la tira de
 * arriba.
 */
export function BarraReparto({
  reparto,
  deshacer,
  onLimpiar,
}: {
  reparto: Reparto;
  deshacer: Deshacer;
  onLimpiar: () => void;
}) {
  const { n, total, hecho, setHecho, quitarSeleccion, quitarPendiente, puedeQuitar, mostrarQuitar } = reparto;

  // Sin selección ni acuse fresco: lo único que puede haber acá es la tira de
  // deshacer (o nada, si no hay ninguna tanda pendiente) — ver su docblock.
  if (n === 0 && !hecho) return <TiraDeshacer deshacer={deshacer} />;

  if (hecho) {
    return (
      <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <Check size={15} className="shrink-0" />
        <span className="font-semibold">
          {hecho.a
            ? `Listos ${cifra(hecho.cuantos)} para ${nombreCorto(hecho.a)}.`
            : `${cifra(hecho.cuantos)} volvieron al pozo común.`}
        </span>
        {hecho.a && <span className="text-success/80">Ya los ve en su lista de Contactos.</span>}
        {/* «Quedan N» lee `total` EN VIVO, no un número congelado en `hecho`: la
            invalidación de la consulta ya lo trae actualizado (regla dura del
            dueño, 24-ago-2026 — la señal de que el trabajo se acorta). */}
        <span className="text-success/80">Quedan {cifra(total)} en esta lista.</span>
        {/* Solo si ESTE acuse es de un reparto (`hecho.a`) — uno de quitar
            (`hecho.a === ''`) no genera tanda, no hay nada que deshacer. */}
        {hecho.a && <DeshacerEnAcuse deshacer={deshacer} />}
        <button
          type="button"
          onClick={() => setHecho(null)}
          aria-label="Cerrar aviso"
          className="ml-auto rounded-lg p-1 transition-colors hover:bg-success/15"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-card/95 px-4 py-2.5 shadow-[0_-8px_24px_-12px_rgba(14,42,82,0.25)] backdrop-blur">
      <span className="text-xs font-semibold text-muted-foreground">
        {cifra(n)} {n === 1 ? 'elegido' : 'elegidos'}
      </span>
      <button
        type="button"
        onClick={onLimpiar}
        className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Limpiar
      </button>

      {/* Con «Sin asignar» puesto, NINGUNA fila visible tiene dueño — no se
          OFRECE Quitar, ni deshabilitado: no es un límite del modo (ese es el
          de abajo, que se saca cambiando a `lista`), es que no hay nada que
          esta lista pueda devolver al pozo común. */}
      {mostrarQuitar && (
        <button
          type="button"
          disabled={quitarPendiente || !puedeQuitar}
          title={
            puedeQuitar
              ? 'Devolver al pozo común: dejan de ser de nadie'
              : 'Para devolver al pozo común, elige los contactos de a uno'
          }
          onClick={quitarSeleccion}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          {quitarPendiente ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
          Quitar {cifra(n)} del reparto
        </button>
      )}
    </div>
  );
}

/**
 * EL PASO DE MÁS, a partir de 500.
 *
 * La regla dura #7 pide la lista de destinatarios a la vista, y a partir de cierto
 * tamaño eso es imposible por definición: nadie revisa 500 filas. Entonces lo que
 * se pone a la vista es **la cifra**, escrita, y la acción deja de ser un clic
 * suelto. No pregunta «¿estás seguro?» —que nadie lee— sino que dice el número y
 * a quién.
 */
export function Confirmacion({ reparto }: { reparto: Reparto }) {
  const { confirmando, n, destino, trabajando, setConfirmando, repartir } = reparto;
  if (!confirmando || !destino) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]"
        onClick={() => setConfirmando(false)}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar el reparto"
          className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <div className="p-5">
            <p className="font-heading text-lg font-bold text-foreground">
              Vas a repartir{' '}
              <span className="tabular-nums text-navy-ink">{cifra(n)}</span> contactos a{' '}
              {nombreCorto(destino)}.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Van a aparecer en su lista de Contactos y deja de verlos cualquier otra persona. Es un
              lote más grande de lo que se puede revisar fila por fila.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              No se manda ningún mensaje: repartir solo decide de quién es cada contacto.
            </p>
          </div>
          <footer className="flex gap-2 border-t border-border p-3">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={trabajando}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={repartir}
              disabled={trabajando}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] disabled:opacity-50"
            >
              {trabajando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Sí, repartir {cifra(n)}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

/** El desplegable de destino: cada persona con lo que ya tiene. */
function ElegirDestino({
  destinos,
  carga,
  elegido,
  onElegir,
  armado,
}: {
  destinos: string[];
  carga: CargaVendedora[];
  elegido: string;
  onElegir: (v: string) => void;
  /** Si la mitad de al lado está lista para repartir: la flecha se pinta igual, como un solo botón. */
  armado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  // Escape y clic afuera: el hook de la casa (#12), no una copia a mano que se
  // come el Escape aunque el foco esté en un campo.
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false));

  const cuanto = new Map(carga.map((c) => [c.vendedoraId.toLowerCase(), c.contactos]));
  const masCargado = Math.max(1, ...carga.map((c) => c.contactos));

  return (
    <div className="relative flex">
      {/* La flecha del botón partido (ADR 0102). Viva aunque no haya nada
          elegido: elegir a quién ANTES de tildar es parte de repartir en
          tandas. El nombre elegido lo dice el botón de al lado. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Elegir a quién repartir"
        title={elegido ? `Se reparte a ${nombreCorto(elegido)} — cambiar` : 'Elegir a quién repartir'}
        className={`flex w-7 items-center justify-center rounded-r-lg border border-l-0 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          armado
            ? 'border-primary bg-primary text-primary-foreground shadow-[inset_1px_0_0_rgba(255,255,255,0.25)] hover:bg-primary-hover'
            : 'border-border bg-card text-foreground hover:bg-muted'
        }`}
      >
        <ChevronDown size={13} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {abierto && <div {...propsOverlay} />}
      {/* Flota: sombra y no borde (`lib/styles.ts`). */}
      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl bg-card shadow-panel">
          <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            A quién se lo doy
          </p>
          <div className="max-h-64 overflow-y-auto p-1">
            {destinos.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                Todavía no hay nadie en el reparto de ninguna línea.
              </p>
            ) : (
              destinos.map((d) => {
                const tiene = cuanto.get(d.toLowerCase()) ?? 0;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onElegir(d);
                      setAbierto(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${
                      d === elegido ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-[10px] font-bold uppercase text-navy-ink">
                      {nombreCorto(d).slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {nombreCorto(d)}
                      </span>
                      {/* La carga, en número y en barra: «336 y 12» se compara
                          leyendo; dos barras se comparan de un vistazo. */}
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-navy/50"
                            style={{ width: `${Math.round((tiene / masCargado) * 100)}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {cifra(tiene)}
                        </span>
                      </span>
                    </span>
                    {d === elegido && <Check size={13} className="shrink-0 text-navy-ink" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
