import { useEffect, useRef, useState } from 'react';
import { AudioLines, CalendarClock, Hash, MessageSquareText, Phone, Trash2, User, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { fieldClass } from '../../lib/styles';
import { ErrorApi } from '../../lib/datos/cliente';
import { mismaVendedora } from '../../dominio/dueno';
import {
  comoFechaHora,
  useBorrarNotaLlamada,
  useGuardarNotaLlamada,
  useNotaLlamada,
  type FilaLlamada,
} from './registro';

/**
 * EL DETALLE DE UNA LLAMADA — el «Ver contenido» de la tabla, al costado.
 *
 * Clon de la cáscara de `HojaContacto` (`features/panel/HojaContacto.tsx`):
 * misma animación, mismo cierre con Esc, mismo botón X — para que se sienta
 * como la misma pieza que ya existe en Pipeline. No es el MISMO componente
 * porque el contenido no es una `Conversacion` (no hay ficha de Cerberus, no
 * hay timeline): es el detalle de UNA fila del registro.
 *
 * ⚠️ **`fixed`, no `absolute`.** `HojaContacto` se ancla `absolute` contra el
 * tablero de Pipeline, que es un contenedor chico y NO scrollea (scrollea
 * adentro). Acá la vista entera es la que scrollea (`overflow-y-auto` en
 * `VistaLlamadas`), y la fila que abre el detalle puede estar bien abajo — un
 * panel `absolute` se iría scroll arriba con el resto y desaparecería de la
 * vista. `fixed` lo deja clavado al viewport, sin importar cuánto se scrollee
 * la tabla de atrás.
 *
 * ⚠️ **Cierra al tocar afuera, a diferencia de `HojaContacto` (que lo deja
 * opt-in).** Ahí no cierra sin scrim porque se está ELIGIENDO a quién mirar
 * en una lista de al lado; acá es solo el detalle de una fila puntual, y
 * pedido explícito del dueño. `mousedown`, no `click`: corre ANTES que el
 * `onClick` de «Ver contenido» de otra fila, así que abrir el detalle de OTRA
 * llamada cambia de contenido en vez de cerrar y quedar cerrado (mismo motivo
 * que documenta `HojaContacto`).
 */
export const ANCHO_DETALLE = '26rem';

export function DetalleLlamada({
  fila,
  miVendedoraId,
  onCerrar,
}: {
  fila: FilaLlamada;
  miVendedoraId: string;
  onCerrar: () => void;
}) {
  useEscape(onCerrar);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    function alTocarAfuera(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onCerrar();
    }
    document.addEventListener('mousedown', alTocarAfuera);
    return () => document.removeEventListener('mousedown', alTocarAfuera);
  }, [onCerrar]);

  return (
    <aside
      ref={ref}
      aria-label="Detalle de llamada"
      style={{ width: ANCHO_DETALLE }}
      className="fixed inset-y-3 right-3 z-30 flex flex-col gap-2 animate-entrar"
    >
      <header className="flex shrink-0 items-center gap-2.5 rounded-xl bg-card px-4 py-3 shadow-panel">
        <Phone size={17} strokeWidth={2.1} className="shrink-0 text-navy-ink" />
        <h2 className="font-heading text-sm font-bold text-navy-ink">Llamada</h2>
        <kbd className="ml-auto rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
          Esc
        </kbd>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el detalle"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-200 ease-house hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card shadow-panel">
        <section className="border-b border-border px-5 py-5">
          <TituloDeSeccion icono={<Phone size={16} />}>Detalle de llamada</TituloDeSeccion>
          <div className="mt-4 space-y-4">
            <CampoConIcono icono={<Hash size={17} />} etiqueta="Número">
              <span className="tabular-nums">{fila.telefono}</span>
            </CampoConIcono>
            <CampoConIcono icono={<User size={17} />} etiqueta="Contacto">
              {fila.contacto ?? <span className="italic text-muted-foreground">Sin registrar</span>}
            </CampoConIcono>
            <CampoConIcono icono={<CalendarClock size={17} />} etiqueta="Fecha y hora">
              {comoFechaHora(fila.cuando)}
            </CampoConIcono>
          </div>
        </section>

        <TextoDeLaLlamada callId={fila.id} miVendedoraId={miVendedoraId} />

        <section className="px-5 py-5">
          <TituloDeSeccion icono={<AudioLines size={16} />}>Transcripción</TituloDeSeccion>
          <p className="mt-3 text-sm italic text-muted-foreground">Disponible próximamente.</p>
        </section>
      </div>
    </aside>
  );
}

function TituloDeSeccion({ icono, children }: { icono: React.ReactNode; children: string }) {
  return (
    <h3 className="flex items-center gap-2 font-heading text-sm font-bold text-navy-ink">
      <span className="text-primary">{icono}</span>
      {children}
    </h3>
  );
}

/** Un campo del detalle: icono a la izquierda, etiqueta chica arriba, valor grande abajo. */
function CampoConIcono({
  icono,
  etiqueta,
  children,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icono}
      </span>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
        <p className="mt-0.5 text-base font-semibold text-foreground">{children}</p>
      </div>
    </div>
  );
}

/**
 * EL TEXTO DE LA LLAMADA — la primera escritura mutable del registro.
 *
 * Regla de autoría (decidida con el dueño): cualquiera crea la primera nota;
 * solo la autora (o una supervisora) la edita o la borra. El front NO sabe si
 * quien mira es supervisora —ese dato no viaja hoy a `Vendedora`, y agregarlo
 * para esto solo hubiera sido tocar un tipo que once pantallas ya leen—, así
 * que la caja se ofrece editable igual y es el 403 del server el que corta:
 * un intento sin permiso muestra el motivo en vez de fingir que no existe el
 * botón. La autora ve su caja editable sin fricción, que es el caso de todos
 * los días.
 */
function TextoDeLaLlamada({ callId, miVendedoraId }: { callId: string; miVendedoraId: string }) {
  const { data, isPending } = useNotaLlamada(callId);
  const guardar = useGuardarNotaLlamada(callId);
  const borrar = useBorrarNotaLlamada(callId);
  const nota = data?.nota ?? null;

  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');

  // Sincroniza el borrador con lo que llega del server, salvo mientras se
  // está escribiendo: una respuesta tardía de `useNotaLlamada` no puede
  // pisarle a la vendedora lo que ya tipeó.
  useEffect(() => {
    if (!editando) setTexto(nota?.texto ?? '');
  }, [nota, editando]);

  const esMia = nota == null || mismaVendedora(nota.vendedoraId, miVendedoraId);
  const error = guardar.error ?? borrar.error;
  const mensajeDeError = error instanceof ErrorApi ? error.message : error ? 'No se pudo guardar.' : null;

  if (isPending) {
    return (
      <section className="border-b border-border px-5 py-5">
        <TituloDeSeccion icono={<MessageSquareText size={16} />}>Texto de la llamada</TituloDeSeccion>
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" />
      </section>
    );
  }

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <TituloDeSeccion icono={<MessageSquareText size={16} />}>Texto de la llamada</TituloDeSeccion>
        {nota && !esMia && (
          <span className="text-xs text-muted-foreground">Escrita por {nota.vendedoraId}</span>
        )}
      </div>

      {!editando && nota ? (
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{nota.texto}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => borrar.mutate()}
              disabled={borrar.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 size={13} /> {borrar.isPending ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué se habló, qué quedó pendiente…"
            rows={6}
            className={`${fieldClass} w-full resize-none text-sm`}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={!texto.trim() || guardar.isPending}
              onClick={() =>
                guardar.mutate(texto.trim(), {
                  onSuccess: () => setEditando(false),
                })
              }
              className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            {nota && (
              <button
                type="button"
                onClick={() => {
                  setTexto(nota.texto);
                  setEditando(false);
                }}
                className="rounded-md border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {mensajeDeError && <p className="mt-2 text-xs text-destructive">{mensajeDeError}</p>}
    </section>
  );
}
