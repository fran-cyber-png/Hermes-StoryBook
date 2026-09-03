import { StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../index.css';
import { queryClient } from '../lib/datos/cliente';
import { limpiarBlobsAutenticados } from '../lib/datos/blobAutenticado';
import { Avatar } from './Avatar';

/**
 * LA GALERÍA DEL AVATAR Y EL FRENO DE LA FOTO — la evidencia, sin server detrás.
 *
 * Entry APARTE de Vite (`galeria-avatar.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199   →  http://localhost:5199/galeria-avatar.html
 *
 * Existe por la regla dura #2, y sobre todo para poder ver de una lo único que
 * una captura puede probar acá: que **los tres casos se ven igual de bien** —con
 * foto, sin foto y con la línea caída— y que el CONTADOR DE PEDIDOS deja de
 * subir cuando se reabre un contacto que ya falló. El contador es la mitad
 * importante: el fondo del frente no es cómo se ve el círculo, es cuántas veces
 * se pregunta lo que ya sabemos.
 *
 * ⚠️ Sirve los tres casos incluidos los feos, a propósito: una galería que
 * muestra sólo el caso ideal ya escondió tres defectos una vez en este repo.
 */

/** Un PNG de 2×2 rosa, para que «con foto» muestre una imagen de verdad. */
const PNG_ROSA =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAHElEQVQI12P8z8DwnwEJMDEgAVQ' +
  'OCwMSGKQcAJvcAwqQ2AwtAAAAAElFTkSuQmCC';

function pngRosa(): Blob {
  const crudo = atob(PNG_ROSA);
  return new Blob([Uint8Array.from(crudo, (c) => c.charCodeAt(0))], { type: 'image/png' });
}

/** Qué contesta la línea para cada teléfono de la galería. */
const RESPUESTAS: Record<string, number> = {
  '51955950559': 200, // tiene foto
  '51999888777': 404, // no tiene foto — el server ya cachea ese «no» 7 días
  '51944112233': 503, // la línea no está montada ahora mismo
};

let pedidos: string[] = [];
const oyentes = new Set<() => void>();

function anotarPedido(url: string | null): void {
  pedidos = url === null ? [] : [...pedidos, url];
  for (const avisar of oyentes) avisar();
}

/**
 * ⚠️ Un `let` de módulo leído en el render NO alcanza: con el React Compiler
 * prendido el componente se memoiza y el contador se queda clavado en 0 —
 * pasó al sacar la primera captura de esta galería. `useSyncExternalStore` es
 * la forma que el compilador entiende, y `pedidos` se reasigna entero para que
 * la instantánea tenga identidad estable.
 */
function usePedidos(): string[] {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => void oyentes.delete(avisar);
    },
    () => pedidos,
  );
}

/**
 * El transporte de la galería. No es un mock de conveniencia: es exactamente lo
 * que devuelve `routes/whatsapp.ts` en los tres casos —404 vacío, 503 con
 * cuerpo, 200 con bytes— porque lo que se está mirando es cómo reacciona el
 * front a ESOS status y no a otros.
 */
window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(entrada);
  anotarPedido(url);
  const telefono = url.split('/foto/')[1]?.split('?')[0] ?? '';
  const status = RESPUESTAS[telefono] ?? 503;
  if (status === 404) return new Response(null, { status: 404 });
  if (status === 503) return new Response('{"ok":false}', { status: 503 });
  return new Response(pngRosa(), { status: 200 });
}) as typeof fetch;

const CASOS = [
  {
    telefono: '51955950559',
    nombre: 'Ana Torres',
    titulo: 'Tiene foto',
    pie: '200 · se baja una vez y queda en el caché de blobs',
  },
  {
    telefono: '51999888777',
    nombre: 'Beto Ruiz',
    titulo: 'No tiene foto',
    pie: '404 · se recuerda: no se vuelve a preguntar nunca',
  },
  {
    telefono: '51944112233',
    nombre: 'Carla Núñez',
    titulo: 'La línea está caída',
    pie: '503 · se frena 30 s, después 1 min, 2, 4… con techo de 1 h',
  },
];

function Galeria() {
  const [ronda, setRonda] = useState(0);
  const pedidos = usePedidos();

  return (
    <div className="min-h-screen bg-background p-10 text-foreground">
      <h1 className="text-2xl font-bold">El avatar y el freno de la foto</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Los tres casos se dibujan igual de bien: con foto se ve la foto, sin foto y con la línea
        caída se ven las iniciales. Lo que cambia no es el círculo — es cuántas veces se pregunta.
      </p>

      <div className="mt-8 flex gap-10">
        {CASOS.map((c) => (
          <div key={c.telefono} className="w-56">
            <Avatar
              key={`${c.telefono}-${ronda}`}
              nombre={c.nombre}
              telefono={c.telefono}
              conFoto
              className="size-20 rounded-full bg-muted text-xl font-semibold text-navy-ink"
            />
            <p className="mt-3 font-semibold">{c.titulo}</p>
            <p className="text-xs text-muted-foreground">{c.nombre}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.pie}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 max-w-3xl rounded-lg border border-border p-5">
        <button
          type="button"
          className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white"
          onClick={() => setRonda((n) => n + 1)}
        >
          Volver a abrir los tres contactos
        </button>
        <p className="mt-3 text-sm">
          Pedidos que salieron a la red: <strong>{pedidos.length}</strong> — veces que se abrieron
          los contactos: <strong>{(ronda + 1) * 3}</strong>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Antes de este cambio los dos números subían juntos: cada montaje volvía a preguntar. Ahora
          el 404 no se pregunta nunca más y el 503 espera su turno.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ⚠️ El 503 sale <strong>dos</strong> veces y no una: la foto de Ana llegó bien, y un solo
          «sí» prueba que se puede preguntar, así que suelta todos los frenos. La segunda vez ya
          queda frenado. Es la regla que evita que un contacto real quede sin foto cuando su línea
          vuelve.
        </p>
        <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          {pedidos.map((p, i) => (
            <li key={i}>{p.replace('http://localhost:4100', '')}</li>
          ))}
          {pedidos.length === 0 && <li>— todavía no salió ninguno —</li>}
        </ul>
        <button
          type="button"
          className="mt-4 rounded border border-border px-3 py-1.5 text-xs"
          onClick={() => {
            limpiarBlobsAutenticados();
            anotarPedido(null);
            setRonda((n) => n + 1);
          }}
        >
          Cerrar sesión (limpia caché y frenos)
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
