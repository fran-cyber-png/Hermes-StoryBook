import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Undo2, X } from 'lucide-react';
import { ErrorApi } from '../../lib/datos/cliente';
import { cifra, hace, horasDesde } from '../../lib/formato';
import { useDeshacerUltimaTanda, useUltimaTanda, type ResultadoDeshacer } from './padron';

/**
 * EL DESHACER — una red PERMANENTE, no un botón que caduca (pedido del dueño,
 * 24-ago-2026, contrato final del server el mismo día).
 *
 * ── Por qué no hay cuenta regresiva ──
 * El server no impone un plazo, así que anunciar uno mentiría. En vez de eso,
 * `useUltimaTanda` se pregunta CADA VEZ que la pantalla se monta (y después de
 * cada reparto): si hay algo, se ofrece; si no, no aparece nada. La única
 * frontera real es la PRÓXIMA tanda propia — ahí «la última» pasa a ser otra y
 * ésta deja de poder deshacerse, no por un timer sino porque ya no es «la
 * última».
 *
 * ── Por qué dos pesos, no uno ──
 * Una tanda de hace un minuto es «revertir un clic de más». Una de ayer es
 * «sacarle el trabajo de hoy a alguien» — la vendedora tuvo horas para
 * escribirles, moverlos de etapa, quizás cerrar una venta. El botón se ve
 * IGUAL en los dos casos si no se hace nada a propósito, así que HORAS_TANDA_VIEJA
 * separa un tratamiento neutro de uno en ámbar (el mismo tono que ya usa el
 * aviso de «ya tienen dueño» — no un color nuevo) con una frase que nombra el
 * riesgo, no solo la cifra.
 *
 * ── Por qué solo repartir, nunca quitar ──
 * El server no guarda quién ejecutó un «quitar del reparto» — agregarlo pide
 * una migración y quedó de seguimiento. No hay nada que forzar acá: si
 * `quitar` no genera una tanda, esto simplemente no tiene nada que ofrecer
 * después de uno.
 */
const HORAS_TANDA_VIEJA = 24;

export function useDeshacer(habilitado: boolean) {
  const tanda = useUltimaTanda(habilitado);
  const deshacer = useDeshacerUltimaTanda();
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeshacer | null>(null);

  // El resultado se borra solo — mismo patrón que el acuse de repartir. No es
  // la ventana del deshacer (ésa no expira): es cuánto dura el AVISO de que ya
  // se deshizo, para no dejarlo pegado en pantalla para siempre.
  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => setResultado(null), 10_000);
    return () => clearTimeout(t);
  }, [resultado]);

  function confirmar() {
    deshacer.mutate(undefined, {
      onSuccess: (r) => {
        setResultado(r);
        setConfirmando(false);
      },
      // El 404 `nada_que_deshacer` es una carrera (otra pestaña, doble clic),
      // no un error para mostrar en rojo: la tira ya se va a ir sola cuando
      // `padron-ultima-tanda` se revalide (ver `onSettled` en la mutación).
      onError: () => setConfirmando(false),
    });
  }

  return {
    tanda: tanda.data,
    confirmando,
    setConfirmando,
    resultado,
    setResultado,
    confirmar,
    trabajando: deshacer.isPending,
    esCarrera: deshacer.error instanceof ErrorApi && deshacer.error.status === 404,
  };
}

export type Deshacer = ReturnType<typeof useDeshacer>;

/** ¿Esta tanda ya no tiene NADA para deshacer — todo lo movió alguien después? */
export function todoOmitido(tanda: { total?: number; omitidosPorCambioPosterior?: number } | undefined): boolean {
  return !!tanda && tanda.total === tanda.omitidosPorCambioPosterior && (tanda.total ?? 0) > 0;
}

export function esVieja(cuando: string): boolean {
  return horasDesde(cuando) >= HORAS_TANDA_VIEJA;
}

/**
 * LA TIRA EN REPOSO — vive donde iba la franja de «lo que no es repartir»
 * (`BarraReparto`), cuando no hay selección ni acuse fresco. Se reconstruye
 * SOLA al montar: es la parte que hace de esto una red permanente.
 */
export function TiraDeshacer({ deshacer }: { deshacer: Deshacer }) {
  const { tanda, confirmando, setConfirmando, resultado } = deshacer;

  if (resultado) return <ResultadoDeshacerVista deshacer={deshacer} />;
  if (!tanda?.hayTanda || !tanda.cuando) return null;

  if (todoOmitido(tanda)) {
    return (
      <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
        <Undo2 size={13} className="shrink-0 opacity-50" />
        <span>
          El reparto de {hace(tanda.cuando)} ya no tiene nada para deshacer — a esos{' '}
          {cifra(tanda.total ?? 0)} ya los movió alguien después.
        </span>
      </div>
    );
  }

  const vieja = esVieja(tanda.cuando);

  return (
    <>
      {confirmando && <ConfirmacionDeshacer deshacer={deshacer} />}
      <div
        className={`sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-xs ${
          vieja ? 'border-warning/30 bg-warning/10 text-warning-foreground' : 'border-border bg-muted/60 text-muted-foreground'
        }`}
      >
        {vieja ? <AlertTriangle size={13} className="shrink-0" /> : <Undo2 size={13} className="shrink-0" />}
        <span title={new Date(tanda.cuando).toLocaleString('es')}>
          Deshacer el reparto de {hace(tanda.cuando)} · {cifra(tanda.total ?? 0)} contactos
        </span>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={`ml-auto rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
            vieja
              ? 'border-warning/40 bg-card text-warning-foreground hover:bg-warning/15'
              : 'border-border bg-card text-foreground hover:bg-muted'
          }`}
        >
          Deshacer
        </button>
      </div>
    </>
  );
}

/**
 * EL «DESHACER» DE ADENTRO DEL ACUSE — mismo mecanismo, más liviano: no repite
 * ícono ni fondo propio, es un link dentro del acuse verde que ya existe.
 * Solo se ofrece cuando el acuse ES de un reparto (`hecho.a` truthy) — uno de
 * quitar no genera tanda, así que no habría nada que este link pudiera hacer.
 */
export function DeshacerEnAcuse({ deshacer }: { deshacer: Deshacer }) {
  const { tanda, confirmando, setConfirmando } = deshacer;
  if (!tanda?.hayTanda || todoOmitido(tanda)) return null;

  return (
    <>
      {confirmando && <ConfirmacionDeshacer deshacer={deshacer} />}
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex items-center gap-1 font-bold text-success underline underline-offset-2 hover:text-success/80"
      >
        <Undo2 size={12} />
        Deshacer
      </button>
    </>
  );
}

/**
 * LA CONFIRMACIÓN — mismo patrón que repartir desde 500: decir la cifra antes
 * de ejecutar, nunca un «¿estás seguro?» solo. Sin nombrar a quién: el
 * preview del server no lo dice (no hay `vendedoraId` en `ultima-tanda`), y
 * acá no hace falta desambiguar nada — solo existe UNA última tanda posible.
 */
function ConfirmacionDeshacer({ deshacer }: { deshacer: Deshacer }) {
  const { tanda, trabajando, setConfirmando, confirmar } = deshacer;
  if (!tanda?.hayTanda || !tanda.cuando) return null;
  const vieja = esVieja(tanda.cuando);

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
          aria-label="Confirmar el deshacer"
          className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <div className="p-5">
            <p className="font-heading text-lg font-bold text-foreground">
              ¿Deshacer el reparto de {hace(tanda.cuando)}?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Eran <span className="font-bold tabular-nums text-foreground">{cifra(tanda.total ?? 0)}</span>{' '}
              contactos. Los que nadie tocó después vuelven a como estaban; quien los tenía deja de verlos.
            </p>
            {vieja && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Fue hace {hace(tanda.cuando).replace('hace ', '')} — es probable que ya le hayan escrito o movido de
                etapa a varios. Deshacerlo no es revertir un clic: le saca ese trabajo a quien los tenía.
              </p>
            )}
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
              onClick={confirmar}
              disabled={trabajando}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] disabled:opacity-50"
            >
              {trabajando ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
              Sí, deshacer {cifra(tanda.total ?? 0)}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

/**
 * EL RESULTADO — en peruano llano, nunca «restaurados»/«devueltos» (las
 * palabras del contrato del server). Y `omitidosPorCambioPosterior` SIEMPRE
 * se agrega cuando es mayor que cero: un deshacer silencioso que revierte
 * trabajo ajeno sin decirlo es peor que no tenerlo.
 */
function ResultadoDeshacerVista({ deshacer }: { deshacer: Deshacer }) {
  const { resultado, setResultado } = deshacer;
  if (!resultado) return null;

  const { restaurados, devueltos, omitidosPorCambioPosterior } = resultado;
  const nadaQueDeshacer = restaurados === 0 && devueltos === 0 && omitidosPorCambioPosterior > 0;

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
      <Check size={15} className="shrink-0" />
      <span className="font-semibold">
        {nadaQueDeshacer ? (
          `No se deshizo nada: ya los había movido alguien después.`
        ) : restaurados > 0 && devueltos > 0 ? (
          `Deshecho: ${cifra(restaurados)} volvieron a quien los tenía antes, ${cifra(devueltos)} quedaron sin nadie.`
        ) : restaurados > 0 ? (
          `Deshecho: los ${cifra(restaurados)} volvieron a quien los tenía antes.`
        ) : (
          `Deshecho: los ${cifra(devueltos)} quedaron sin nadie de nuevo.`
        )}
      </span>
      {!nadaQueDeshacer && omitidosPorCambioPosterior > 0 && (
        <span className="text-success/80">
          {cifra(omitidosPorCambioPosterior)} ya los movió alguien después y no se tocaron.
        </span>
      )}
      <button
        type="button"
        onClick={() => setResultado(null)}
        aria-label="Cerrar aviso"
        className="ml-auto rounded-lg p-1 transition-colors hover:bg-success/15"
      >
        <X size={14} />
      </button>
    </div>
  );
}
