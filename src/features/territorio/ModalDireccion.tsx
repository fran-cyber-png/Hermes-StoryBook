import { useEffect, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { useBuscarDirecciones, useGeocodificarInverso } from './territorio';

/**
 * EL MAPA DE "DÓNDE VOTA" (ADR 0088) — busca estilo Google Maps o marca el
 * punto a mano; las dos formas llevan al mismo lugar: un punto con dirección.
 *
 * No guarda nada por sí solo: `onConfirmar` sube `{ direccion, lat, lon }` y
 * quien lo monta (`BloqueTerritorio`) es dueño de la mutación y de cuándo
 * cerrar — la misma separación que ya usa `BuscadorContactos`.
 */

const CENTRO_PERU: [number, number] = [-9.19, -75.02];
const ZOOM_PAIS = 5;
const ZOOM_PUNTO = 16;

// `divIcon` con un SVG propio: el ícono default de Leaflet referencia PNGs por
// una ruta relativa a SU paquete, y un bundler moderno la rompe (404 mudo, el
// pin queda invisible). Navy + blanco — nunca dorado: acá no corre ningún
// plazo (`BloqueTerritorio.tsx`).
const ICONO_PIN = L.divIcon({
  className: '',
  html:
    '<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 26 14 26s14-16.2 14-26C28 6.3 21.7 0 14 0z" fill="var(--color-navy, #0E2A52)"/>' +
    '<circle cx="14" cy="14" r="5.5" fill="#fff"/>' +
    '</svg>',
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

interface Punto {
  lat: number;
  lon: number;
  direccion: string;
}

/** Clic manual en el mapa → marca el punto (la reversa la resuelve el llamador). */
function ClicEnMapa({ onClic }: { onClic: (p: { lat: number; lon: number }) => void }) {
  useMapEvents({
    click(e) {
      onClic({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

/** Vuela al punto que se acaba de elegir DESDE EL BUSCADOR — nunca por un clic/arrastre. */
function VolarA({ punto }: { punto: { lat: number; lon: number } | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.flyTo([punto.lat, punto.lon], ZOOM_PUNTO, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punto?.lat, punto?.lon]);
  return null;
}

export function ModalDireccion({
  inicial,
  guardando,
  onConfirmar,
  onCerrar,
}: {
  /** Precarga el mapa sobre el punto ya anotado, para "Cambiar". */
  inicial?: { lat: number; lon: number; direccion: string } | null;
  /** El PUT está en vuelo — deshabilita "Confirmar" y muestra el spinner. */
  guardando: boolean;
  onConfirmar: (v: { direccion: string; lat: number; lon: number }) => void;
  onCerrar: () => void;
}) {
  useEscape(onCerrar);
  const [texto, setTexto] = useState('');
  const [punto, setPunto] = useState<Punto | null>(inicial ?? null);
  const [volarA, setVolarA] = useState<{ lat: number; lon: number } | null>(null);
  // El debounce vive en el hook (350 ms) — Nominatim está atado a una cola de
  // ≥1,1 s entre pedidos, así que acá se pasa `texto` tal cual.
  const { data, isFetching, debounceando } = useBuscarDirecciones(texto);
  const inverso = useGeocodificarInverso();

  const resultados = data?.resultados ?? [];

  function marcarAMano(lat: number, lon: number) {
    // El punto se ve enseguida (coordenadas), y la dirección llega apenas
    // Nominatim contesta — no se espera la reversa para mover el marcador.
    setPunto((p) => ({ lat, lon, direccion: p?.direccion ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}` }));
    inverso.mutate(
      { lat, lon },
      {
        onSuccess: (r) => {
          setPunto({ lat, lon, direccion: r.direccion?.displayName ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
        },
      },
    );
  }

  function elegirSugerencia(s: { displayName: string; lat: number; lon: number }) {
    setPunto({ lat: s.lat, lon: s.lon, direccion: s.displayName });
    setVolarA({ lat: s.lat, lon: s.lon });
    setTexto('');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dónde vota"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <MapPin size={15} /> Dónde vota
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onCerrar}
              className="rounded-lg p-1 transition-colors hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Busca una dirección"
                aria-label="Buscar dirección"
                className="w-full rounded-xl border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              {texto.trim().length >= 3 && (
                // z-index MUY por encima de 1000: los controles propios de Leaflet
                // (el +/- de zoom) usan `z-index: 1000`, y con uno menor la lista
                // de sugerencias se dibuja detrás del control cuando se solapan.
                <div className="absolute left-0 right-0 top-full z-[1200] mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-panel">
                  {debounceando || (isFetching && resultados.length === 0) ? (
                    <p className="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
                      <Loader2 size={13} className="animate-spin" /> Buscando…
                    </p>
                  ) : resultados.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">Ninguna dirección coincide.</p>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {resultados.map((s, i) => (
                        <li key={`${s.lat},${s.lon},${i}`}>
                          <button
                            type="button"
                            onClick={() => elegirSugerencia(s)}
                            className="w-full truncate rounded-lg px-2.5 py-2 text-left text-xs text-foreground transition-colors duration-200 ease-house hover:bg-muted"
                          >
                            {s.displayName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </label>

            <div className="mt-3 h-56 w-full overflow-hidden rounded-xl border border-border sm:h-80">
              <MapContainer
                center={inicial ? [inicial.lat, inicial.lon] : CENTRO_PERU}
                zoom={inicial ? ZOOM_PUNTO : ZOOM_PAIS}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClicEnMapa onClic={(p) => marcarAMano(p.lat, p.lon)} />
                <VolarA punto={volarA} />
                {punto && (
                  <Marker
                    position={[punto.lat, punto.lon]}
                    icon={ICONO_PIN}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = (e.target as L.Marker).getLatLng();
                        marcarAMano(lat, lng);
                      },
                    }}
                  />
                )}
              </MapContainer>
            </div>

            <p className="mt-3 flex min-h-9 items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground">
              <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
              {punto ? (
                <span>{punto.direccion}</span>
              ) : (
                <span className="text-muted-foreground">Busca una dirección o marca el punto en el mapa.</span>
              )}
            </p>
          </div>

          <footer className="flex shrink-0 gap-2 border-t border-border p-3">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!punto || guardando}
              onClick={() => punto && onConfirmar(punto)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(14,42,82,0.5)] transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] disabled:opacity-50"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
              Confirmar dirección
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
