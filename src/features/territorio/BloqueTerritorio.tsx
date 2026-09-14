import { lazy, Suspense, useState } from 'react';
import { Loader2, MapPin, Pencil, Plus } from 'lucide-react';
import { conteoDelDistritoActual, lecturaDeTerritorio, useAnotarTerritorio, useTerritorio } from './territorio';

/**
 * `lazy`, y no un `import` estático: `leaflet` toca `window` al cargarse —
 * bien en el navegador, pero revienta cualquier test `.test.ts` que importe
 * ESTE archivo de pasada (`node`, sin DOM, ADR 0088). Con `lazy` el import
 * dinámico no corre hasta que el modal se abre de verdad, así que un test que
 * nunca hace clic en "Marcar en el mapa" —la inmensa mayoría— no lo toca.
 */
const ModalDireccion = lazy(() =>
  import('./ModalDireccion').then((m) => ({ default: m.ModalDireccion })),
);

/**
 * DÓNDE VOTA ESTA PERSONA — el bloque del panel, sólo en el módulo de campañas
 * (ADR 0063, y desde ADR 0088 con mapa en vez de lista).
 *
 * Va arriba del timeline y no adentro de una pestaña por la misma razón que
 * «Qué quiere» en el panel de ventas (ADR 0017): **una pestaña guarda lo que se
 * CONSULTA, nunca lo que se DECIDE**, y la dirección es lo primero que decide si
 * esta conversación vale una caminata o una llamada.
 *
 * ⚠️ **Sin oro**: acá no corre ningún plazo. El dorado significa tiempo que se
 * acaba y nada más (`index.css`) — por eso el pin del mapa es navy, no dorado.
 *
 * 🔴 **La dirección es el dato primario; el distrito es derivado.** La
 * operadora marca un punto en `ModalDireccion` y el servidor clasifica sola,
 * en segundo plano, el distrito de catálogo más parecido — nunca se le
 * ofrece una lista para elegir. El contador "N acá" sólo aparece cuando ese
 * auto-match encontró algo; sin match, silencioso, porque no es un error.
 */
export function BloqueTerritorio({ clave, activo }: { clave: string; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const { data, isPending } = useTerritorio(clave, activo);
  const { anotar, sacar } = useAnotarTerritorio(clave);
  if (!activo) return null;

  const { puedeAnotar, vacio } = lecturaDeTerritorio(data);
  const actual = data?.actual;
  const conteo = conteoDelDistritoActual(data);
  const guardando = anotar.isPending || sacar.isPending;

  return (
    <section className="border-t border-border px-4 py-3">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MapPin size={12} />
        Locación
      </h3>

      {isPending && <p className="text-sm text-muted-foreground">Buscando…</p>}

      {/* El único vacío que queda bloquea por falta de línea de campaña — el
          catálogo vacío ya NO bloquea anotar (ADR 0088, ver `lecturaDeTerritorio`). */}
      {!isPending && vacio && <p className="text-sm text-muted-foreground">{vacio}</p>}

      {!isPending &&
        puedeAnotar &&
        (actual?.direccion ? (
          <div className="flex items-start gap-2">
            <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground" title={actual.direccion}>
                {actual.direccion}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAbierto(true)}
                  disabled={guardando}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors hover:underline disabled:opacity-50"
                >
                  <Pencil size={10} aria-hidden /> Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => sacar.mutate()}
                  disabled={guardando}
                  className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  Quitar
                </button>
                {/* Cuánta gente hay ya en ese distrito: el número que convierte una
                    dirección suelta en una decisión de recorrido. Sólo si el
                    auto-match encontró uno — silencioso si no. */}
                {conteo != null && (
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {conteo} acá
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border py-2 text-xs font-bold text-primary transition-[background-color,border-color,transform] duration-200 ease-house hover:border-primary hover:bg-primary/5 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus size={13} aria-hidden /> Marcar en el mapa
          </button>
        ))}

      {anotar.isError && <p className="mt-1 text-xs text-destructive">No se pudo guardar. Prueba de nuevo.</p>}
      {sacar.isError && <p className="mt-1 text-xs text-destructive">No se pudo quitar. Prueba de nuevo.</p>}

      {abierto && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/30" aria-hidden="true">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          }
        >
          <ModalDireccion
            inicial={
              actual?.direccion && actual.lat != null && actual.lon != null
                ? { direccion: actual.direccion, lat: actual.lat, lon: actual.lon }
                : null
            }
            guardando={anotar.isPending}
            onConfirmar={(v) => anotar.mutate(v, { onSuccess: () => setAbierto(false) })}
            onCerrar={() => setAbierto(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
