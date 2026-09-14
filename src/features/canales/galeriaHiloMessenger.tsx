import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { HiloMessenger } from './HiloMessenger';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA GALERÍA DEL PIE DEL HILO DE MESSENGER — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-hilo-messenger.html
 *
 * Existe por la regla dura #2 (nada de UI se reporta listo sin captura) y muestra
 * los dos pies que el arreglo del 4-sep-2026 cambió, con los textos REALES que
 * escribe el server — no un caso ideal:
 *
 *  1. **La persona sólo comentó y recibió el privado**: el server cierra el redactor
 *     y explica «Le escribimos por Messenger y todavía no contesta». Antes el
 *     comentario contaba como mensaje entrante, el redactor se abría y Meta
 *     rechazaba cada envío.
 *  2. **Meta rechaza el envío**: el pie dice el motivo que `errorLegible.ts`
 *     tradujo. Antes se veía siempre el genérico «Puedes intentarlo de nuevo»,
 *     que invita a reintentar contra un rechazo que reintentar no cambia. Para
 *     verlo hay que escribir algo y apretar Enviar — el rechazo es del envío, no
 *     de la carga.
 */

const AHORA = Date.now();
const hace = (minutos: number) => new Date(AHORA - minutos * 60_000).toISOString();

/** Lo que el server contesta a `GET /api/persona/conv/facebook/<persona>` — con sus frases reales. */
const HILOS: Record<string, unknown> = {
  'solo-comento': {
    historial: [{ id: 1, direccion: 'saliente', autor: 'pagina', texto: 'Hola Jin, gracias por el apoyo. ¿De qué distrito nos escribes?', occurred_at: hace(12) }],
    nombre: 'Jin Pierre Mestanza',
    total: 1,
    ventana: {
      puede: false,
      restanteMs: 0,
      explicacion:
        'Le escribimos por Messenger y todavía no contesta. Cuando responda se abre el plazo de 24 horas para seguir la conversación.',
    },
  },
  rechazado: {
    historial: [
      { id: 2, direccion: 'entrante', autor: 'persona', texto: 'Hola, quiero saber cuándo llegan a Pomabamba', occurred_at: hace(40) },
      { id: 3, direccion: 'saliente', autor: 'pagina', texto: 'El sábado 12 estamos por allá. ¿Te sumas?', occurred_at: hace(35) },
    ],
    nombre: 'Rocío Janet Herrera',
    total: 2,
    ventana: { puede: true, restanteMs: 23 * 3_600_000 + 20 * 60_000, explicacion: 'Puedes escribirle por 23 h 20 min más.' },
  },
};

/** El rechazo de Meta ya traducido por `responder/errorLegible.ts` (código 551). */
const RECHAZO = {
  type: 'meta_rechazo',
  error: 'Esta persona no puede recibir mensajes de la página. Puede que haya bloqueado los mensajes o cerrado su cuenta.',
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

// El server, de mentira: el GET trae el hilo de cada caso; todo POST lo rechaza Meta.
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const ruta = String(url);
  if ((init?.method ?? 'GET') === 'POST') return json(RECHAZO, 502);
  const persona = Object.keys(HILOS).find((p) => ruta.endsWith(`/conv/facebook/${p}`));
  return persona ? json(HILOS[persona]) : json({ historial: [], nombre: null, total: 0 }, 404);
}) as typeof fetch;

function conversacion(persona_id: string, persona_nombre: string): Conversacion {
  return {
    clave: `conv:facebook:${persona_id}:`,
    canal: 'facebook',
    tipo: 'mensaje',
    persona_id,
    persona_nombre,
    numero_propio: null,
    texto: null,
    contexto_texto: null,
    respondida: true,
    ventana_abierta: false,
    pregunto: false,
    n: 1,
    referencia: hace(12),
    ultimo_at: hace(12),
    dias: 0,
    nivel: 5,
  };
}

const CASOS = [
  {
    titulo: '1 · Sólo comentó y recibió el privado',
    nota: 'El server cierra el redactor con el motivo. Antes se abría y Meta rechazaba cada envío.',
    conversacion: conversacion('solo-comento', 'Jin Pierre Mestanza'),
  },
  {
    titulo: '2 · Meta rechaza el envío',
    nota: 'Escribe algo y aprieta Enviar: el pie dice el motivo traducido, no «intentarlo de nuevo».',
    conversacion: conversacion('rechazado', 'Rocío Janet Herrera'),
  },
];

function Galeria() {
  return (
    <main className="min-h-screen bg-background p-6 font-sans text-foreground">
      <h1 className="font-heading text-xl font-bold">El pie del hilo de Messenger — los dos casos del 4-sep-2026</h1>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {CASOS.map((c) => (
          <section key={c.titulo}>
            <h2 className="font-heading text-sm font-bold">{c.titulo}</h2>
            <p className="mb-2 text-xs text-muted-foreground">{c.nota}</p>
            <div className="h-[420px]">
              <HiloMessenger conversacion={c.conversacion} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
