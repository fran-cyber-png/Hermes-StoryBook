import { useState } from 'react';
import { Check, Layers, Loader2, MapPin, Megaphone, MessageSquare, Pencil, Phone, Plus, Star, Trash2, User, X } from 'lucide-react';
import { BotonLlamar } from '../gestion/BotonLlamar';
import { FichaRapida } from '../panel/FichaRapida';
import { RegistrarEvento } from '../eventos/RegistrarEvento';
import { TOPE_NOTA, useEventos, useMutacionesEventos, type EventoContacto } from '../eventos/eventos';
import { rotuloDeTipo } from '../eventos/eventos';
import { fechaCorta, formatoTelefono, hace } from '../../lib/formato';
import { useEscape } from '../../lib/teclado/useEscape';
import { usePopover } from '../../lib/teclado/usePopover';
import { mismaVendedora } from '../../dominio/dueno';
import { quienDiceSer } from '../auth/sesion';
import { tokenGuardado } from '../../lib/datos/token';
import { EtiquetasContacto } from './EtiquetasContacto';
import { claveRealDeContacto, conversacionDeFicha, esClaveDeContactoManual } from './conversacionDeContacto';
import {
  inicialesDe,
  nombreVisible,
  quienRegistro,
  useMarcarFavorito,
  useReclamarContactoManual,
  type ContactoRegistrado,
} from './contactosRegistrados';

/**
 * LA FICHA DE UN CONTACTO DE CAMPAÑA — panel lateral de `VistaContactosCampana`.
 *
 * Mismo molde que `FichaRapida` (drawer fijo pegado a la derecha, con scrim:
 * clic afuera o Escape cierran) — pedido del 24-ago-2026, en el mismo lugar
 * donde se registra un contacto. Las secciones son propias de campaña — nada
 * acá inventa dato: Ubicación es `/api/territorio` (ADR 0063), Etiquetas es
 * `/api/categorias` + `/api/gestiones/etiquetas`, Notas y Actividad son
 * `eventos_contacto` (`tipo: 'nota'` para lo primero, el resto del
 * vocabulario de campaña para lo segundo).
 */
export function PanelContacto({
  contacto,
  onCerrar,
  onEscribir,
}: {
  contacto: ContactoRegistrado;
  onCerrar: () => void;
  /** Puente a Mensajes: abre el chat de esta persona. */
  onEscribir?: (telefono: string) => void;
}) {
  const iniciales = inicialesDe(nombreVisible(contacto));
  const marcarFavorito = useMarcarFavorito();
  const reclamar = useReclamarContactoManual();
  const [editando, setEditando] = useState(false);
  useEscape(onCerrar);

  /**
   * «MENSAJE» — antes de abrir Mensajes, si esta ficha nació con «Nuevo
   * contacto» (sin chat), la conversación real que se va a abrir tiene una
   * clave DISTINTA a la de esta ficha (`conv:whatsapp:<teléfono>:<línea>`, no
   * la `manual-<uuid>` bajo la que está todo). Sin "reclamarla" antes,
   * Mensajes se ve «Sin nombre», sin etiquetas y sin timeline aunque todo eso
   * ya esté cargado (ver `server/src/contactos/reclamar.ts`).
   */
  function escribir() {
    if (!contacto.telefono || !onEscribir) return;
    const telefono = contacto.telefono;
    if (!esClaveDeContactoManual(contacto.clave)) {
      onEscribir(telefono);
      return;
    }
    const claveReal = claveRealDeContacto(contacto);
    if (!claveReal) {
      onEscribir(telefono);
      return;
    }
    reclamar.mutate(
      { claveManual: contacto.clave, claveReal },
      { onSettled: () => onEscribir(telefono) },
    );
  }

  return (
    <>
      {/* El mismo scrim que `FichaRapida`: clic afuera cierra. */}
      <div className="fixed inset-0 z-40 bg-navy/20" onClick={onCerrar} aria-hidden="true" />
      <aside
        aria-label={`Ficha de ${nombreVisible(contacto)}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[25rem] max-w-full flex-col gap-2 overflow-y-auto bg-card p-4 shadow-panel animate-entrar"
      >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 truncate text-sm font-bold text-foreground">{nombreVisible(contacto)}</h2>
            <button
              type="button"
              aria-label={contacto.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={contacto.favorito}
              onClick={() => marcarFavorito.mutate({ clave: contacto.clave, favorito: !contacto.favorito })}
              className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-muted"
            >
              <Star
                size={14}
                className={contacto.favorito ? 'fill-warning text-warning' : 'text-muted-foreground'}
              />
            </button>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {contacto.vendedoraId ? quienRegistro(contacto.vendedoraId) : 'Contacto ingresado por chat'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la ficha"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {contacto.telefono && <BotonLlamar telefono={contacto.telefono} />}
        {contacto.telefono && onEscribir && (
          <button
            type="button"
            onClick={escribir}
            disabled={reclamar.isPending}
            className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
          >
            {reclamar.isPending ? <Loader2 size={11} className="animate-spin" /> : <MessageSquare size={11} />}
            Mensaje
          </button>
        )}
        {/* Sin función todavía: Correos es de ventas (`deVentas`), campaña no
            tiene canal de email. Se deja visible a pedido, deshabilitado. */}
        <button
          type="button"
          disabled
          title="Todavía no disponible en campaña"
          className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground opacity-40"
        >
          Email
        </button>
      </div>

      <section className="rounded-xl bg-card p-3 shadow-panel">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Información de contacto
          </h3>
          {/* La edición (teléfono, prioridad y también "Locación") vive en
              la misma ficha que registra el contacto — nunca acá, para no
              tener dos formularios diciendo lo mismo (#37). */}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Pencil size={10} /> {contacto.registrado === false ? 'Registrar ficha' : 'Editar'}
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
          {contacto.telefono && (
            <>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Phone size={12} className="shrink-0" /> Teléfono
              </dt>
              <dd className="font-mono text-foreground">{formatoTelefono(contacto.telefono)}</dd>
            </>
          )}
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin size={12} className="shrink-0" /> Locación
          </dt>
          {/* La ficha lleva la dirección COMPLETA que marcó el mapa (pedido del
              1-sep-2026) — el distrito/ubicación derivada es lo que se ve en
              la columna de la tabla, no acá. */}
          <dd className="text-foreground" title={contacto.direccion ?? undefined}>
            {contacto.direccion ?? 'Sin especificar'}
          </dd>
          {contacto.campanaNombre && (
            <>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Megaphone size={12} className="shrink-0" /> Campaña
              </dt>
              <dd className="font-medium text-foreground">{contacto.campanaNombre}</dd>
            </>
          )}
          {contacto.aviso && (
            <>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Layers size={12} className="shrink-0" /> Anuncio
              </dt>
              <dd className="text-foreground">{contacto.aviso}</dd>
            </>
          )}
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <User size={12} className="shrink-0" /> {contacto.registrado === false ? 'Atendido por' : 'Registrado por'}
          </dt>
          <dd className="text-foreground">
            <span className="font-semibold">{contacto.vendedoraId ? quienRegistro(contacto.vendedoraId) : 'Sin agente'}</span>{' '}
            <span className="text-muted-foreground">· {fechaCorta(contacto.creadoAt)}</span>
          </dd>
        </dl>
      </section>

      <EtiquetasContacto clave={contacto.clave} />

      <ActividadDeContacto clave={contacto.clave} />

      {/* Mismo drawer que «Nuevo contacto» y que «Contacto» en Mensajes — acá
          `FichaRapida` detecta sola que la ficha YA existe (`yaRegistrado`) y
          se abre en modo edición, con el botón diciendo «Guardar cambios». */}
      {editando && (
        <FichaRapida conversacion={conversacionDeFicha(contacto)} onCerrar={() => setEditando(false)} esDeCampana />
      )}
      </aside>
    </>
  );
}

/** Notas + Actividad reciente — las dos secciones del mismo `eventos_contacto`. */
function ActividadDeContacto({ clave }: { clave: string }) {
  const { data } = useEventos(clave);
  const { editar, borrar } = useMutacionesEventos(clave);
  const eventos = data?.eventos ?? [];
  const notas = eventos.filter((e) => e.tipo === 'nota');
  const actividad = eventos.filter((e) => e.tipo !== 'nota');
  // Solo se toca lo propio — misma regla que `EventoLinea` en el panel del
  // chat (ADR 0059/#37): comparar exacto haría que Luz no reconozca sus
  // propias notas si entró como `luz` y Cerberus le empujó `Luz`.
  const miId = quienDiceSer(tokenGuardado() ?? '')?.id;

  return (
    <>
      <section className="rounded-xl bg-card p-3 shadow-panel">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notas</h3>
          <BotonAgregarNota clave={clave} />
        </div>
        {notas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin notas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notas.map((n) => (
              <NotaFila
                key={n.id}
                nota={n}
                puedeTocar={miId != null && mismaVendedora(miId, n.vendedoraId)}
                onEditar={(nota) => editar.mutate({ id: n.id, nota, curso: n.curso })}
                onBorrar={() => borrar.mutate(n.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-card p-3 shadow-panel">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Actividad reciente
        </h3>
        {actividad.length === 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">Sin actividad todavía.</p>
        ) : (
          <ul className="mb-2 flex flex-col gap-2">
            {actividad.map((e) => (
              <li key={e.id} className="text-xs">
                <p className="font-semibold text-foreground">{rotuloDeTipo(e.tipo)}</p>
                {e.nota && <p className="text-muted-foreground">{e.nota}</p>}
                <p className="text-[10px] text-muted-foreground">
                  {quienRegistro(e.vendedoraId)} · {hace(e.creadoAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <RegistrarEvento clave={clave} esDeCampana />
      </section>
    </>
  );
}

/**
 * Una nota, con Editar y Borrar — mismo gesto que `EventoLinea` en el panel
 * del chat: los íconos solo aparecen al pasar el mouse (o con foco, para
 * teclado) y solo si la nota es de quien mira. Sin `puedeTocar` no se dibuja
 * ni un botón inerte: un ícono sin acción es la misma clase de defecto que ya
 * se sacó de `EventoLinea` (ver su docblock).
 */
function NotaFila({
  nota,
  puedeTocar,
  onEditar,
  onBorrar,
}: {
  nota: EventoContacto;
  puedeTocar: boolean;
  onEditar: (nota: string) => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [texto, setTexto] = useState(nota.nota ?? '');

  function confirmarEdicion() {
    const limpio = texto.trim();
    if (limpio) onEditar(limpio);
    setEditando(false);
  }

  return (
    <li className="group/nota rounded-lg bg-warning/10 p-2 text-xs text-foreground">
      {editando ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={texto}
            maxLength={TOPE_NOTA}
            autoFocus
            rows={3}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setEditando(false);
              }
            }}
            className="w-full resize-none rounded-lg border border-primary bg-card px-2 py-1.5 text-xs outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmarEdicion}
              disabled={!texto.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              <Check size={11} /> Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : borrando ? (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="text-muted-foreground">¿Borrar esta nota?</span>
          <button
            type="button"
            onClick={onBorrar}
            className="rounded px-1 text-destructive transition-colors hover:bg-destructive/10"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setBorrando(false)}
            className="rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            No
          </button>
        </p>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap">{nota.nota}</p>
            {puedeTocar && (
              <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/nota:opacity-100 group-focus-within/nota:opacity-100">
                <button
                  type="button"
                  aria-label="Editar nota"
                  onClick={() => {
                    setTexto(nota.nota ?? '');
                    setEditando(true);
                  }}
                  className="grid min-h-6 min-w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Borrar nota"
                  onClick={() => setBorrando(true)}
                  className="grid min-h-6 min-w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {quienRegistro(nota.vendedoraId)} · {hace(nota.creadoAt)}
          </p>
        </>
      )}
    </li>
  );
}

/**
 * "+ Nota" — un atajo directo a `tipo: 'nota'` en vez del selector genérico de
 * `RegistrarEvento` (pedido del 24-ago-2026: una nota tiene que verse tan
 * disponible como el resto). Misma mutación (`useMutacionesEventos`), sin
 * duplicar la ruta ni la validación — el server sigue exigiendo el texto
 * porque `nota.exigeNota` es `true` en el catálogo.
 */
function BotonAgregarNota({ clave }: { clave: string }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const { registrar } = useMutacionesEventos(clave);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  function guardar() {
    const limpio = texto.trim();
    if (!limpio) return;
    registrar.mutate(
      { tipo: 'nota', nota: limpio },
      {
        onSuccess: () => {
          setTexto('');
          setAbierto(false);
        },
      },
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={
          'flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-semibold transition-colors ' +
          (abierto
            ? 'border-primary text-foreground'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
        }
      >
        <Plus size={11} /> Nota
      </button>
      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute right-0 top-6 z-30 w-64 rounded-xl bg-card p-2 shadow-panel">
          <textarea
            value={texto}
            maxLength={TOPE_NOTA}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setAbierto(false);
              }
            }}
            autoFocus
            rows={3}
            placeholder="Prefiere que lo llamen después de las 6pm…"
            className="w-full resize-none rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11px] outline-none focus:border-primary"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={!texto.trim() || registrar.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {registrar.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Guardar nota
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
          </div>
        </>
      )}
    </span>
  );
}
