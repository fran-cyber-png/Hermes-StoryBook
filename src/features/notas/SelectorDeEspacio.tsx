import { useState } from 'react';
import { Check, Files, Plus, Star, Trash2 } from 'lucide-react';
import { type VistaLibreta, mismaVista, nombreCorto, useEspacios, useMutacionesEspacios, usePadron } from './espacios';
import { iconoDeEspacio } from './iconosDeEspacio';

/**
 * EL RIEL DE LA LIBRETA — "MI LIBRETA" (Todas/Favoritas/Papelera, "solo tú")
 * más "TUS ESPACIOS" (03-sep-2026, rediseño con panel flotante).
 *
 * ══ ES UN RIEL, NO UN SELECTOR QUE ABRE UNA LISTA APILADA ═══════════════════
 *
 * Hasta acá esto encabezaba una lista de páginas que vivía DEBAJO, en el mismo
 * `<aside>` de `Libreta.tsx`. Ahora es angosto y SIEMPRE visible, y la lista de
 * páginas de lo que se elija acá vive en un panel APARTE que se abre flotando
 * — `Libreta.tsx` es quien decide si ese panel está abierto y con qué vista,
 * este componente solo REPORTA qué fila se tocó (`onElegir`). Es a propósito:
 * "clic en algo ya elegido hace toggle del panel, clic en algo nuevo cambia y
 * abre" es una decisión sobre EL PANEL, no sobre el riel, y vive una vez en
 * `Libreta.tsx` — acá duplicarla sería la próxima vez que diverjan (#37).
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
  contador,
}: {
  activo: boolean;
  onIr: () => void;
  icono: React.ReactNode;
  nombre: string;
  /** Cuántas páginas tiene — `undefined` mientras no se sabe (ver `Espacio.paginas`). */
  contador?: number;
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
      {contador !== undefined && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
          {contador}
        </span>
      )}
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
  vista,
  onElegir,
  totalCount,
  favoritasCount,
  papeleraCount,
}: {
  vista: VistaLibreta;
  /** El riel solo REPORTA qué fila se tocó — ver el docblock de arriba. */
  onElegir: (v: VistaLibreta) => void;
  /** Los tres contadores de "MI LIBRETA" — `Libreta.tsx` los calcula porque
   *  necesita las mismas consultas para armar la lista del panel. */
  totalCount: number;
  favoritasCount: number;
  papeleraCount: number;
}) {
  const [creando, setCreando] = useState(false);
  const espacios = useEspacios();

  const lista = espacios.data ?? [];

  return (
    // `pt-[17px]` (antes `py-2` parejo, 03-sep-2026 a pedido explícito) — EL
    // MISMO alto que le toma a la primera página del panel de al lado llegar
    // a su título (el `py-2` de su propia tarjeta más el borde, ver
    // `FilaPagina` en `Libreta.tsx`): con el mismo `py-2` de acá "MI LIBRETA"
    // quedaba más arriba que "Blame" — dos arranques distintos para lo que
    // se lee como la misma fila. Medido con Playwright, no a ojo.
    <div className="px-2 pb-2 pt-[17px]">
      {/* "MI LIBRETA" — las tres vistas de la libreta privada. "solo tú" describe
          a las TRES: ninguna cruza a un espacio compartido (confirmado con el
          dueño del pedido, 03-sep-2026) — `dondeDeVista` en `espacios.ts` es la
          prueba de que esto no es solo un rótulo, es la regla. */}
      <p className="flex items-center justify-between px-2.5 pb-1 text-xs font-bold uppercase tracking-wide text-foreground">
        <span>Mi libreta</span>
        <span className="text-[0.6875rem] font-medium normal-case text-muted-foreground">solo tú</span>
      </p>
      <div className="space-y-0.5">
        <FilaDeLugar
          activo={mismaVista(vista, { tipo: 'todas' })}
          onIr={() => onElegir({ tipo: 'todas' })}
          icono={<Files className="size-3.5" />}
          nombre="Todas las páginas"
          contador={totalCount}
        />
        <FilaDeLugar
          activo={mismaVista(vista, { tipo: 'favoritas' })}
          onIr={() => onElegir({ tipo: 'favoritas' })}
          icono={<Star className="size-3.5" />}
          nombre="Favoritas"
          contador={favoritasCount}
        />
        <FilaDeLugar
          activo={mismaVista(vista, { tipo: 'papelera' })}
          onIr={() => onElegir({ tipo: 'papelera' })}
          icono={<Trash2 className="size-3.5" />}
          nombre="Papelera"
          contador={papeleraCount}
        />
      </div>

      {/*
        UN RÓTULO Y UN BORDE separan "MI LIBRETA" —siempre existe, siempre son
        las mismas tres— de LOS ESPACIOS —una lista que puede crecer—, para que
        las dos cosas no se lean como una sola lista plana. Solo aparece si hay
        al menos uno: el rótulo de una sección vacía es ruido, no orientación.
      */}
      {lista.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-border pt-2">
          <p className="px-2.5 pb-1 text-xs font-bold uppercase tracking-wide text-foreground">Tus espacios</p>
          {lista.map((e) => {
            const Icono = iconoDeEspacio(e.icono);
            return (
              <FilaDeLugar
                key={e.id}
                activo={mismaVista(vista, { tipo: 'espacio', id: e.id })}
                onIr={() => onElegir({ tipo: 'espacio', id: e.id })}
                icono={<Icono className="size-3.5" />}
                nombre={e.nombre}
                // `paginas` viene de `GET /api/espacios` (03-sep-2026) — de
                // CUALQUIER miembro, no solo lo que escribiste vos. `?? 0` cubre
                // el instante entre que la lista llega y el conteo (misma
                // respuesta, así que en la práctica siempre vienen juntos).
                contador={e.paginas ?? 0}
              />
            );
          })}
        </div>
      )}

      {/* ⚠️ Un fallo al traer los espacios SE DICE. Sin esto, la lista se dibuja
          con "MI LIBRETA" sola y se lee como «no tienes ningún espacio» — que es
          una afirmación sobre datos que no se pudieron leer. */}
      {espacios.isError && <p className="px-2.5 py-1 text-xs text-destructive">No pude traer tus espacios.</p>}

      {/* «Nuevo espacio» — una ACCIÓN, no un lugar al que ir, separada del
          resto por su propio borde. «Administrar espacios» se mudó al menú
          de «Configuración» al pie del riel (`Libreta.tsx`, 03-sep-2026):
          las dos vivían juntas acá cuando eran las únicas dos acciones de
          administración de la Libreta, y dejaron de serlo cuando
          "Configurar Respuestas Rápidas" pidió el mismo lugar. */}
      <div className="mt-2 space-y-0.5 border-t border-border pt-2">
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
    </div>
  );
}
