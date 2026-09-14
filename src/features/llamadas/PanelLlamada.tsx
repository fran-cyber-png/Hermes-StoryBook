import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone, PhoneCall, RefreshCw } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { llamar, useLlamadaActual } from './llamadaActual';

/**
 * LLAMAR POR WHATSAPP DESDE LA FICHA — solo donde se puede (ADR 0123).
 *
 * Aparece únicamente en una conversación de la línea Cloud API y para quien tiene las llamadas activadas.
 * En cualquier otra no se muestra nada: el botón anterior pedía permiso desde Ventas Meta en
 * conversaciones de otras líneas (#1050) y sin mirar el techo de Meta (#1049).
 *
 * La llamada en sí (timbre, en curso, colgar) vive en `BarraDeLlamada`, fuera del panel: cambiar de
 * conversación no puede cortar una llamada.
 */

interface Activas {
  ok: true;
  activa: boolean;
  linea: string | null;
}

interface Permiso {
  estado: 'sin_permiso' | 'temporal' | 'permanente' | 'desconocido';
  venceEn: string | null;
  puedePedir: boolean | null;
  puedeLlamar: boolean;
}

function rotuloDelPermiso(p: Permiso): string {
  if (p.estado === 'permanente') return 'Permiso permanente';
  if (p.estado === 'temporal') {
    const vence = p.venceEn ? new Date(p.venceEn) : null;
    return vence && !Number.isNaN(vence.getTime())
      ? `Permiso hasta el ${vence.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`
      : 'Permiso vigente';
  }
  if (p.estado === 'sin_permiso') return 'Sin permiso para llamar';
  return 'Permiso sin confirmar';
}

const BOTON =
  'inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-[background-color,transform] duration-200 ease-house active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function PanelLlamada({ conversacion }: { conversacion: Conversacion }) {
  const qc = useQueryClient();
  const { estado } = useLlamadaActual();
  const activas = useQuery({
    queryKey: ['llamadas', 'activas'],
    queryFn: () => api<Activas>('/api/llamadas/activas'),
    staleTime: 5 * 60_000,
  });

  const telefono = conversacion.persona_id ?? '';
  const linea = activas.data?.linea ?? null;
  const llamable =
    activas.data?.activa === true &&
    linea !== null &&
    conversacion.canal === 'whatsapp' &&
    conversacion.tipo !== 'lead' &&
    telefono !== '' &&
    conversacion.numero_propio === linea;

  const claveDelPermiso = ['llamadas', 'permiso', conversacion.clave];
  const permiso = useQuery({
    queryKey: claveDelPermiso,
    queryFn: () =>
      api<{ ok: true; permiso: Permiso }>(`/api/llamadas/permiso?clave=${encodeURIComponent(conversacion.clave)}`).then(
        (r) => r.permiso,
      ),
    enabled: llamable,
    staleTime: 30_000,
    retry: false,
  });

  const pedir = useMutation({
    mutationFn: () =>
      api<{ ok: true; mensaje: string }>('/api/llamadas/pedir-permiso', {
        method: 'POST',
        body: JSON.stringify({ clave: conversacion.clave }),
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: claveDelPermiso }),
  });

  if (!llamable) return null;

  const ocupada = estado.fase !== 'libre' && estado.fase !== 'terminada';
  const enEsta = ocupada && 'clave' in estado && estado.clave === conversacion.clave;
  const p = permiso.data;
  const falla = pedir.error ?? permiso.error;
  const textoDeFalla = falla instanceof ErrorApi ? falla.message : falla ? 'No se pudo consultar a Meta.' : null;
  const puedePedir = p !== undefined && !p.puedeLlamar && p.estado !== 'temporal' && p.estado !== 'permanente';

  return (
    <div className="px-4 pt-2">
      <div className="rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Llamada por WhatsApp</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {permiso.isFetching ? <Loader2 size={11} className="animate-spin" /> : null}
            {p ? rotuloDelPermiso(p) : permiso.isError ? 'No se pudo consultar' : 'Consultando…'}
            <button
              type="button"
              aria-label="Volver a consultar el permiso"
              title="Volver a consultar el permiso"
              onClick={() => void permiso.refetch()}
              className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <RefreshCw size={11} />
            </button>
          </span>
        </div>

        <div className="mt-2">
          {enEsta ? (
            <p className="text-xs font-medium text-navy-ink">En llamada con esta persona.</p>
          ) : p?.puedeLlamar ? (
            <button
              type="button"
              disabled={ocupada}
              onClick={() => void llamar(conversacion.clave, telefono)}
              className={`${BOTON} bg-navy text-white hover:bg-navy/90`}
            >
              <PhoneCall size={13} /> Llamar por WhatsApp
            </button>
          ) : puedePedir ? (
            <button
              type="button"
              disabled={pedir.isPending || pedir.isSuccess || p.puedePedir === false}
              onClick={() => pedir.mutate()}
              className={`${BOTON} border border-navy bg-card text-navy-ink hover:bg-navy/5`}
            >
              {pedir.isPending ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />} Pedir permiso para llamar
            </button>
          ) : p ? (
            <p className="text-xs text-muted-foreground">Meta no deja llamar a esta persona en este momento.</p>
          ) : null}
        </div>

        {puedePedir && p.puedePedir === false && !pedir.isSuccess ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Meta no deja volver a pedirle permiso todavía: 1 pedido por día y 2 por semana.
          </p>
        ) : null}
        {pedir.isSuccess ? (
          <p className="mt-1.5 text-[11px] font-medium text-success">
            {pedir.data.mensaje} Cuando acepte, toca <RefreshCw size={10} className="inline" /> para actualizar.
          </p>
        ) : null}
        {textoDeFalla ? <p className="mt-1.5 text-[11px] font-medium text-destructive">{textoDeFalla}</p> : null}
      </div>
    </div>
  );
}
