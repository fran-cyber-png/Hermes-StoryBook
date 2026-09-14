import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { FilaConversacion } from './FilaConversacion';
import { TarjetaEmbudo } from '../vistas/TarjetaEmbudo';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * «RESPONDIDO» Y «QUIÉN LO TIENE ABIERTO», EN LA COLA Y EN EL PIPELINE (ADR 0121).
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-comentario-respondido.html
 *
 * La fila y la tarjeta DE VERDAD; lo único falso es la red. Evidencia de ADR 0121.
 *
 * ⚠️ **Los valores son los de producción** (candado 10), los mismos de
 * `galeriaRespuestaUnica.tsx`: el comentario 521348 de Nina Silva en la Página de
 * Américo, respondido cuatro veces el 12 y 13-sep-2026, y su 522611 del 13-sep,
 * todavía sin responder. La identidad que lo tiene abierto es
 * `centurion:americo.agente4`, sin nombre en `equipo`, así que se lee el username.
 */

const RESPONDIDO: Conversacion = {
  clave: 'int:521348',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: 'Nina Silva',
  numero_propio: null,
  texto: '',
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: '2026-09-13T04:15:49.926Z',
  ultimo_at: '2026-09-13T04:15:49.926Z',
  dias: 0,
  nivel: 2,
};

const ABIERTO: Conversacion = {
  ...RESPONDIDO,
  clave: 'int:522611',
  texto: 'La mejor opción! RR 🩵💪🏻',
  respondida: false,
  referencia: '2026-09-13T03:34:29.000Z',
  ultimo_at: '2026-09-13T03:34:29.000Z',
};

const RESPONDIDO_Y_ABIERTO: Conversacion = { ...RESPONDIDO, clave: 'int:521350', persona_nombre: 'Nina Silva' };

const SIN_NADA: Conversacion = { ...ABIERTO, clave: 'int:522612' };

const AGENTE4 = { quien: 'centurion:americo.agente4', nombre: null, desde: new Date().toISOString() };

window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const cuerpo = url.includes('/api/responder/presencias')
    ? { presencias: { 522611: [AGENTE4], 521350: [AGENTE4] } }
    : {};
  const status = url.includes('/api/whatsapp/foto/') ? 404 : 200;
  return new Response(status === 404 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

const CASOS: { titulo: string; c: Conversacion }[] = [
  { titulo: 'Respondido', c: RESPONDIDO },
  { titulo: 'Sin responder, y otra agente lo tiene abierto', c: ABIERTO },
  { titulo: 'Respondido, y otra agente lo tiene abierto', c: RESPONDIDO_Y_ABIERTO },
  { titulo: 'Sin responder y nadie en él', c: SIN_NADA },
];

const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Galeria() {
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        <section className="space-y-2">
          <h1 className="text-lg font-bold text-foreground">La cola — Página de Américo</h1>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {CASOS.map(({ titulo, c }, i) => (
              <div key={c.clave} data-caso={titulo}>
                <FilaConversacion c={c} indice={i} seleccionada={false} onAbrir={() => {}} esDeCampana />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <h1 className="text-lg font-bold text-foreground">El Pipeline — la misma Página</h1>
          <div className="w-[260px] max-w-full space-y-2 rounded-xl bg-muted p-2">
            {CASOS.map(({ c }, i) => (
              <TarjetaEmbudo
                key={c.clave}
                c={c}
                indice={i}
                onAbrir={() => {}}
                alArrastrar={() => {}}
                alTerminar={() => {}}
                arrastrando={false}
                rebotada={false}
                cotizando={false}
                esDeCampana
              />
            ))}
          </div>
          <ul className="space-y-0.5 pt-2 text-xs text-muted-foreground">
            {CASOS.map(({ titulo }, i) => (
              <li key={titulo}>
                {i + 1}. {titulo}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
