import { useState } from 'react';
import { Check, Lock, Plus, Settings2, Users } from 'lucide-react';
import { ModalDeEspacios } from './ModalDeEspacios';
import { type DondeEstoy, nombreCorto, useEspacios, useMutacionesEspacios, usePadron } from './espacios';

/**
 * DÓNDE ESTOY ESCRIBIENDO — el selector que encabeza la lista de páginas.
 *
 * ══ LA LIBRETA PRIVADA VA PRIMERA Y NO SE PUEDE SACAR ═══════════════════════
 *
 * No sale de la lista del server (es implícita, `espacioId === null`), así que se
 * dibuja acá a mano y siempre arriba. Es deliberado: quien no crea ni un espacio
 * tiene que ver **exactamente la Libreta de antes**, con un renglón de más.
 *
 * ══ EL CANDADO Y LA GENTE SON LA MISMA INFORMACIÓN ══════════════════════════
 *
 * 🔒 privado · 👥 compartido. **Sin oro**: el dorado significa tiempo que se
 * acaba y acá no se acaba nada. Y el ícono no es decoración — es lo único que
 * contesta la pregunta que una vendedora se hace antes de escribir un precio mal
 * puesto: «¿esto lo ve alguien más?».
 */

function FilaDeLugar({
  activo,
  onIr,
  icono,
  nombre,
  detalle,
}: {
  activo: boolean;
  onIr: () => void;
  icono: React.ReactNode;
  nombre: string;
  detalle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onIr}
      aria-current={activo ? 'true' : undefined}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
        activo ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <span className="shrink-0">{icono}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombre}</span>
      {detalle && <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{detalle}</span>}
    </button>
  );
}

/**
 * CREAR UN ESPACIO. Los miembros se eligen del padrón — **no hay campo libre**,
 * y ése es el punto: Hermes no tiene tabla de usuarios, así que un nombre
 * tipeado a mano escribe una fila válida y esa persona no ve el espacio nunca,
 * sin un solo síntoma. El server igual rechaza con 409; esto es para que no se
 * llegue.
 */
function NuevoEspacio({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const padron = usePadron(true);
  const { crear } = useMutacionesEspacios();

  const puedeGuardar = nombre.trim().length > 0 && !crear.isPending;

  return (
    <form
      className="space-y-2 rounded-lg border border-border bg-card p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!puedeGuardar) return;
        crear.mutate({ nombre: nombre.trim(), miembros: elegidos }, { onSuccess: onListo });
      }}
    >
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del espacio"
        aria-label="Nombre del espacio"
        maxLength={80}
        className="h-8 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
      />

      <div>
        <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Quiénes entran</p>
        {padron.isPending && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {padron.isError && <p className="text-xs text-destructive">No pude traer la lista de gente.</p>}
        <div className="flex flex-wrap gap-1">
          {(padron.data ?? []).map((p) => {
            const puesto = elegidos.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={puesto}
                onClick={() => setElegidos((prev) => (puesto ? prev.filter((x) => x !== p) : [...prev, p]))}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                  puesto ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {puesto && <Check className="size-3" />}
                {nombreCorto(p)}
              </button>
            );
          })}
        </div>
        {/* Lo que la pantalla NO puede dejar de decir: quien crea entra siempre.
            Sin esto, elegir a nadie se lee como «un espacio vacío». */}
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">Tú entras siempre. Puedes sumar gente después.</p>
      </div>

      {crear.isError && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {crear.error instanceof Error ? crear.error.message : 'No se pudo crear'}
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={!puedeGuardar}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
        >
          {crear.isPending ? 'Creando…' : 'Crear'}
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function SelectorDeEspacio({
  donde,
  onIr,
}: {
  donde: DondeEstoy;
  onIr: (donde: DondeEstoy) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [administrando, setAdministrando] = useState(false);
  const espacios = useEspacios();

  const lista = espacios.data ?? [];

  return (
    <div className="border-b border-border px-2 py-2">
      <div className="space-y-0.5">
        <FilaDeLugar
          activo={donde === null}
          onIr={() => onIr(null)}
          icono={<Lock className="size-3.5" />}
          nombre="Mi libreta"
          detalle="solo tú"
        />
      </div>

      {/*
        UN RÓTULO Y UN BORDE separan «Mi libreta» —siempre existe, siempre es
        la primera— de LOS ESPACIOS —una lista que puede crecer—, para que las
        dos cosas no se lean como una sola lista plana de seis renglones
        parecidos (reportado: «hazlo más intuitivo, dales alguna separación»).
        Solo aparece si hay al menos uno: el rótulo de una sección vacía es
        ruido, no orientación.
      */}
      {lista.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-border pt-2">
          <p className="px-2.5 pb-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Tus espacios
          </p>
          {lista.map((e) => (
            <FilaDeLugar
              key={e.id}
              activo={donde === e.id}
              onIr={() => onIr(e.id)}
              icono={<Users className="size-3.5" />}
              nombre={e.nombre}
              detalle={`${e.miembros.length}`}
            />
          ))}
        </div>
      )}

      {/* ⚠️ Un fallo al traer los espacios SE DICE. Sin esto, la lista se dibuja
          con «Mi libreta» sola y se lee como «no tienes ningún espacio» — que es
          una afirmación sobre datos que no se pudieron leer. */}
      {espacios.isError && <p className="px-2.5 py-1 text-xs text-destructive">No pude traer tus espacios.</p>}

      {/* «Administrar espacios» / «Nuevo espacio» van juntas, separadas del
          resto por su propio borde: son ACCIONES, no lugares a los que ir —
          mezclarlas con las filas de «Mi libreta»/espacios es lo que hacía
          que todo el bloque se leyera parejo.

          🔴 «Administrar espacios» es FIJO (26-ago-2026) — antes decía
          «Administrar «X»…» y aparecía o desaparecía según cuál espacio
          estuvieras mirando, lo que reportaron como que desarmaba la UI (el
          botón saltaba de lugar, o no estaba, según dónde estuvieras parada).
          Ahora siempre está, siempre dice lo mismo, y abre un modal que lista
          TODOS los que creaste — vivos y archivados — en un solo lugar. Ver
          `ModalDeEspacios.tsx`. */}
      <div className="mt-2 space-y-0.5 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setAdministrando(true)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Administrar espacios
        </button>

        {creando ? (
          <NuevoEspacio onListo={() => setCreando(false)} onCancelar={() => setCreando(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex w-full items-center gap-1.5  rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Nuevo espacio
          </button>
        )}
      </div>

      {administrando && <ModalDeEspacios onCerrar={() => setAdministrando(false)} />}
    </div>
  );
}
