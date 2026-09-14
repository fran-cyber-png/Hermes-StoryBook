import { useState } from 'react';
import { ChevronDown, Eye, MessageSquareReply, Reply } from 'lucide-react';
import { hace } from '../../lib/formato';
import { nombresEnFila, quienSeLee, type EnElComentario, type EstadoDeRespuesta } from './respuestaUnica';

/**
 * LO QUE EL COMENTARIO YA TIENE, Y QUIÉN MÁS ESTÁ EN ÉL (13-sep-2026).
 *
 * Va arriba de las cajas de respuesta, para leerse ANTES de escribir. El
 * comentario de Nina Silva recibió cuatro respuestas porque cada agente que lo
 * abría veía la caja vacía (ver `respuestaUnica.ts`).
 *
 * Dos avisos distintos:
 *
 *   · **Quién más lo tiene abierto** (`AvisoDePresencia`). Es lo que evita
 *     escribir en vano.
 *   · **Las respuestas que ya tiene**, con quién, cuándo y qué dijo. Con
 *     respuestas, las cajas no se muestran hasta que la agente elige «Responder
 *     otra vez». Lo decide `ResponderPanel`; acá sólo se ofrece el botón.
 *
 * 📱 **En el celular** (ADR 0121) la lista arranca plegada, con la última
 * respuesta en un renglón, y el aviso de presencia lo dibuja el panel fijo bajo
 * la cabecera: en 390 px la lista entera empujaba las cajas fuera de la pantalla,
 * y el aviso se iba con el scroll justo mientras se escribe.
 *
 * ⚠️ **Sin dorado.** En Hermes el dorado significa tiempo que se acaba
 * (`src/index.css`), y esto no apura a nadie. «Ya respondido» usa el mismo verde
 * que el «Respondido» de `EstadoEnviado`, porque es el mismo hecho.
 */
interface Props {
  estado: EstadoDeRespuesta;
  /** «Facebook» o «Instagram», para la respuesta hecha por fuera de Hermes. */
  red: string;
  /** Esta persona acaba de responder: lo dice `EstadoEnviado`, y la lista sería eco. */
  sinLista?: boolean;
  /** Ya eligió responder otra vez: las cajas están abiertas y el botón sobra. */
  otraVez: boolean;
  onResponderOtraVez: () => void;
  /** El aviso de presencia lo dibuja el panel en otro lugar (el celular). */
  sinPresencia?: boolean;
  /** La lista arranca plegada y se abre con un toque (el celular). */
  plegable?: boolean;
}

/** «Luz lo está respondiendo ahora», o «también lo tiene abierto» si ya hay respuestas. */
export function AvisoDePresencia({
  respondiendo,
  conRespuestas,
}: {
  respondiendo: readonly EnElComentario[];
  conRespuestas: boolean;
}) {
  if (respondiendo.length === 0) return null;
  const varias = respondiendo.length > 1;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-foreground"
    >
      <Eye size={15} className="mt-0.5 shrink-0 text-primary" />
      <p className="min-w-0 leading-snug">
        <strong>{nombresEnFila(respondiendo)}</strong>{' '}
        {conRespuestas
          ? varias
            ? 'también tienen abierto este comentario.'
            : 'también tiene abierto este comentario.'
          : varias
            ? 'lo están respondiendo ahora.'
            : 'lo está respondiendo ahora.'}
        {!conRespuestas && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Si le respondes tú también, a esta persona le llegan dos respuestas.
          </span>
        )}
      </p>
    </div>
  );
}

export default function YaRespondido({
  estado,
  red,
  sinLista = false,
  otraVez,
  onResponderOtraVez,
  sinPresencia = false,
  plegable = false,
}: Props) {
  const [abierta, setAbierta] = useState(!plegable);
  const { respuestas, respondiendo } = estado;
  const conLista = !sinLista && respuestas.length > 0;
  const conPresencia = !sinPresencia && respondiendo.length > 0;
  if (!conLista && !conPresencia) return null;

  const titulo = respuestas.length === 1 ? 'Ya tiene respuesta' : `Ya tiene ${respuestas.length} respuestas`;
  const ultima = respuestas[respuestas.length - 1];
  const verLista = abierta || !plegable;

  return (
    <div className="flex flex-col gap-3">
      {conPresencia && <AvisoDePresencia respondiendo={respondiendo} conRespuestas={respuestas.length > 0} />}

      {/* `/10` y no `/5`: es el fondo que ya tiene sólido en el tema oscuro, el mismo de `EstadoEnviado` (`temaOscuroLegible.test.ts`). */}
      {conLista && (
        <section className="rounded-xl border border-temp-fresco/40 bg-temp-fresco/10 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-temp-fresco">
            {plegable ? (
              <button
                type="button"
                aria-expanded={abierta}
                onClick={() => setAbierta((a) => !a)}
                className="flex w-full items-center gap-1.5 text-left uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <MessageSquareReply size={12} />
                <span className="flex-1">{titulo}</span>
                <ChevronDown size={14} className={'shrink-0 transition-transform ' + (abierta ? 'rotate-180' : '')} />
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <MessageSquareReply size={12} />
                {titulo}
              </span>
            )}
          </h3>

          {!verLista && ultima && (
            <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">
              Última: <span className="font-bold text-foreground">{ultima.origen === 'facebook' ? `Desde ${red}` : quienSeLee(ultima)}</span>
              {' · '}
              {hace(ultima.cuando)}
              {ultima.texto ? ` · «${ultima.texto}»` : ''}
            </p>
          )}

          {verLista && (
            <ol className="mt-2 flex flex-col gap-2.5">
              {respuestas.map((r, i) => (
                <li key={`${r.cuando}-${i}`} className="min-w-0">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {r.origen === 'facebook' ? `Desde ${red}` : quienSeLee(r)}
                    </span>
                    {' · '}
                    {hace(r.cuando)}
                    {r.texto && r.conPrivado ? ' · y por privado' : ''}
                  </p>
                  {r.texto ? (
                    <p className="mt-1 w-fit max-w-full break-words rounded-lg bg-card px-2.5 py-1.5 text-sm text-foreground shadow-sm">
                      {r.texto}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs italic text-muted-foreground">Le escribió solo por privado.</p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!otraVez && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-temp-fresco/20 pt-2.5">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Otra respuesta al mismo comentario se ve repetida en la publicación.
              </p>
              <button
                type="button"
                onClick={onResponderOtraVez}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
              >
                <Reply size={12} />
                Responder otra vez
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
