import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA CAJA PÚBLICA DE RESPONDER, POR CLIENTE — el panel DE VERDAD, no una maqueta.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-plantilla-por-cliente.html
 *                              …/galeria-plantilla-por-cliente.html?caso=privado-fallido
 *
 * A diferencia de `galeriaPanelCompleto.tsx`, acá se monta `ResponderPanel` entero, y lo único
 * falso es la red: `fetch` contesta lo que contestaría el server para un comentario en la Página
 * de Américo. Es la evidencia de ADR 0112:
 *
 * · **sin `caso`**: la caja pública abre vacía, sin el texto de la Escuela ni las frases de Betto;
 * · **`?caso=privado-fallido`**: al enviar, el privado rebota con `(#10900)` como en producción el
 *   11-sep-2026, y el panel dice que no se publicó nada y ofrece publicar sola la respuesta pública.
 *   La confirmación, sin privado, sale.
 *
 * ⚠️ **La frase del #10900 va copiada** de `server/src/responder/errorLegible.ts`, con el prefijo
 * que le pone `routes/responder.ts`. Si cambia allá, hay que cambiarla acá (candado 10).
 */

const CASO = new URLSearchParams(location.search).get('caso');

const CAUSA_DEL_10900 =
  'Mensaje privado: A esta persona ya se le respondió por privado en este comentario. Meta permite un solo mensaje privado por comentario: si la conversación siguió, contéstale desde su chat.';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

window.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (url.includes('/puede-privado')) {
    return json({ puede: true, motivo: null, dias: 0, modulo: 'campana', cliente: 'americo' });
  }
  if (url.includes('/api/responder/') && init?.method === 'POST') {
    const { mensajePrivado } = JSON.parse(String(init.body)) as { mensajePrivado?: string };
    if (CASO === 'privado-fallido' && mensajePrivado?.trim()) {
      return json({ type: 'privado_fallo', message: 'No se publicó nada.', errores: [CAUSA_DEL_10900] }, 409);
    }
    return json({ type: 'enviado', publico: 'c_1', errores: [] });
  }
  if (url.includes('/contexto')) return json({ post: null, adjunto: null, estado: {} });
  return json({ permalink: null });
}) as typeof fetch;

const ahora = new Date().toISOString();

const COMENTARIO: Interaccion = {
  id: 1,
  canal: 'facebook',
  tipo: 'comentario',
  persona_nombre: null,
  texto: '¡Fuerza! 💪',
  contexto_texto: null,
  occurred_at: ahora,
  status: 'nuevo',
  pide_info: false,
  ventana_abierta: true,
  dias: 0,
};

const CONVERSACION: Conversacion = {
  clave: 'int:1',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: null,
  numero_propio: null,
  texto: COMENTARIO.texto,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: ahora,
  ultimo_at: ahora,
  dias: 0,
  nivel: 2,
};

const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <h1 className="font-heading text-lg font-bold text-foreground">
          {CASO === 'privado-fallido'
            ? 'Américo — el privado rebota con (#10900)'
            : 'Américo — la caja pública, sin textos de otro cliente'}
        </h1>
        <div className="mt-4 h-[680px] max-w-4xl">
          <ResponderPanel
            interaccion={COMENTARIO}
            conversacion={CONVERSACION}
            esDeCampana
            onCerrar={() => {}}
            onRespondido={() => {}}
          />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
