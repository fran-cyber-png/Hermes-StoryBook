import { useState } from 'react';
import { Archive, ArchiveRestore, Check, ChevronDown, Users, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { TituloEditable } from './TituloEditable';
import { mismoUsuario, nombreCorto, useEspaciosMios, useMutacionesEspacios, usePadron, type Espacio } from './espacios';

/**
 * ADMINISTRAR TUS ESPACIOS — un modal, no un panel que se abre y se cierra
 * dentro de la barra de 19rem (26-ago-2026).
 *
 * ══ POR QUÉ CAMBIÓ ═══════════════════════════════════════════════════════════
 *
 * Antes «Administrar «X»…» era un botón que aparecía y desaparecía según cuál
 * espacio estuvieras mirando — reportado como que desarmaba la UI (el botón
 * saltaba de lugar, o directamente no estaba, según dónde estuvieras parada).
 * Ahora el disparador es FIJO (`SelectorDeEspacio.tsx`) y siempre dice lo
 * mismo; lo que cambia según el espacio pasó ADENTRO del modal, que lista
 * TODOS los que creaste — vivos y archivados — en un solo lugar.
 *
 * ══ MIEMBROS SIGUE ACÁ, NO SE PERDIÓ ═════════════════════════════════════════
 *
 * El pedido nombraba renombrar y archivar/desarchivar; agregar y sacar gente
 * no se mencionó, pero es la MISMA acción de administrar que ya existía —
 * sacarla habría sido una regresión silenciosa. Vive plegada por fila (un
 * espacio con mucha gente no tiene por qué mostrar los chips todo el tiempo)
 * y solo en los vivos: administrar miembros de un espacio archivado no tiene
 * con qué — ya nadie escribe ahí.
 */

/** Los chips del padrón, igual molde que el viejo `Miembros` de `SelectorDeEspacio.tsx`. */
function ChipsDeMiembros({ espacio }: { espacio: Espacio }) {
  const padron = usePadron(true);
  const { agregarMiembro, sacarMiembro } = useMutacionesEspacios();
  return (
    <div className="flex flex-wrap gap-1 border-t border-border pt-2.5">
      {padron.isPending && <p className="text-xs text-muted-foreground">Cargando…</p>}
      {padron.isError && <p className="text-xs text-destructive">No pude traer la lista de gente.</p>}
      {(padron.data ?? []).map((p) => {
        const esta = espacio.miembros.some((m) => mismoUsuario(m, p));
        // 🔴 A LA CREADORA NO SE LA PUEDE SACAR — el espacio quedaría sin
        // nadie que pueda administrarlo.
        const esLaCreadora = mismoUsuario(espacio.creadaPor, p);
        return (
          <button
            key={p}
            type="button"
            disabled={esLaCreadora}
            title={esLaCreadora ? 'Creó el espacio: no se puede sacar' : undefined}
            onClick={() =>
              esta
                ? sacarMiembro.mutate({ espacioId: espacio.id, vendedoraId: p })
                : agregarMiembro.mutate({ espacioId: espacio.id, vendedoraId: p })
            }
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-60 ${
              esta ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {esta && <Check className="size-3" />}
            {nombreCorto(p)}
          </button>
        );
      })}
    </div>
  );
}

function FilaEspacio({
  espacio,
  miembrosAbiertos,
  onAlternarMiembros,
}: {
  espacio: Espacio;
  miembrosAbiertos: boolean;
  onAlternarMiembros: () => void;
}) {
  const { renombrar, archivar, desarchivar } = useMutacionesEspacios();
  const archivado = Boolean(espacio.archivadoAt);

  return (
    <div className={`rounded-lg border p-3 ${archivado ? 'border-dashed border-border bg-muted/40' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground">
          {archivado ? <Archive className="size-4" /> : <Users className="size-4" />}
        </span>

        {archivado ? (
          // Un espacio archivado no se renombra desde acá: ya nadie escribe
          // ahí, y ofrecer el campo invitaría a tocar algo que no hace falta.
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{espacio.nombre}</span>
        ) : (
          <TituloEditable
            valor={espacio.nombre}
            placeholder="Nombre del espacio"
            onGuardar={(nombre) => renombrar.mutate({ espacioId: espacio.id, nombre })}
            className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-foreground outline-none hover:border-input focus:border-ring"
          />
        )}

        {!archivado && (
          <button
            type="button"
            onClick={onAlternarMiembros}
            aria-expanded={miembrosAbiertos}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {espacio.miembros.length} {espacio.miembros.length === 1 ? 'persona' : 'personas'}
            <ChevronDown className={`size-3.5 transition-transform ${miembrosAbiertos ? 'rotate-180' : ''}`} />
          </button>
        )}

        {archivado ? (
          <button
            type="button"
            onClick={() => desarchivar.mutate(espacio.id)}
            disabled={desarchivar.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            <ArchiveRestore className="size-3.5" />
            Desarchivar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => archivar.mutate(espacio.id)}
            disabled={archivar.isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-60"
          >
            <Archive className="size-3.5" />
            Archivar
          </button>
        )}
      </div>

      {!archivado && miembrosAbiertos && (
        <div className="mt-2.5">
          <ChipsDeMiembros espacio={espacio} />
        </div>
      )}

      {archivado && (
        <p className="mt-1.5 pl-6 text-[0.6875rem] text-muted-foreground">
          Archivado el {new Date(espacio.archivadoAt!).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

export function ModalDeEspacios({ onCerrar }: { onCerrar: () => void }) {
  useEscape(onCerrar);
  const espacios = useEspaciosMios(true);
  const [miembrosDe, setMiembrosDe] = useState<number | null>(null);

  const lista = espacios.data ?? [];
  const activos = lista.filter((e) => !e.archivadoAt);
  const archivados = lista.filter((e) => e.archivadoAt);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-navy/25 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Administrar tus espacios"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Tus espacios</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Los que creaste — renómbralos, mira quién entra, o archívalos.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-border px-6 py-4">
          {espacios.isPending && <p className="py-4 text-center text-sm text-muted-foreground">Cargando…</p>}
          {espacios.isError && <p className="py-4 text-center text-sm text-destructive">No pude traer tus espacios.</p>}
          {!espacios.isPending && !espacios.isError && lista.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Todavía no creaste ningún espacio — el botón «Nuevo espacio» está en la Libreta.
            </p>
          )}

          {activos.length > 0 && (
            <div className="space-y-1.5">
              {activos.map((e) => (
                <FilaEspacio
                  key={e.id}
                  espacio={e}
                  miembrosAbiertos={miembrosDe === e.id}
                  onAlternarMiembros={() => setMiembrosDe((actual) => (actual === e.id ? null : e.id))}
                />
              ))}
            </div>
          )}

          {archivados.length > 0 && (
            <div>
              <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Archivados</p>
              <div className="space-y-1.5">
                {archivados.map((e) => (
                  <FilaEspacio key={e.id} espacio={e} miembrosAbiertos={false} onAlternarMiembros={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
