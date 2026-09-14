import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';
import type { EstadoDeRespuesta, RespuestaPrevia } from './respuestaUnica';

/**
 * UN COMENTARIO SE RESPONDE UNA VEZ — el panel DE VERDAD, con el comentario de Nina Silva.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-respuesta-unica.html
 *                              …/galeria-respuesta-unica.html?caso=respondiendo
 *                              …/galeria-respuesta-unica.html?caso=se-adelanto
 *
 * Se monta `ResponderPanel` entero y lo único falso es la red, como en
 * `galeriaPlantillaPorCliente.tsx`. Es la evidencia de ADR 0115:
 *
 * · **sin `caso`**: el comentario 521348 con sus cuatro respuestas. No hay cajas
 *   hasta «Responder otra vez».
 * · **`?caso=respondiendo`**: otra agente lo tiene abierto. La caja sigue ahí,
 *   con el aviso arriba.
 * · **`?caso=se-adelanto`**: al enviar, otra agente ya respondió. El server
 *   contesta 409, la caja se cierra y aparece su respuesta.
 * · **`?caso=respondido-y-abierto`** (ADR 0121): las cuatro respuestas y otra
 *   agente con el comentario abierto. A 390 px es la evidencia del panel móvil:
 *   el aviso fijo bajo la cabecera y la lista plegada.
 *
 * ⚠️ **Los valores son los de producción** (candado 10), leídos de `hermes_db` el
 * 13-sep-2026: textos y horas de las cuatro respuestas de la 521348. `quien` va
 * en `null` porque salieron antes de que la ruta guardara `vendedoraId`, y así
 * se van a ver el día del deploy. La identidad de la presencia es
 * `centurion:americo.agente4`, la que respondió en la Página de Américo el
 * 11-sep (ADR 0112), sin nombre en `equipo`. El comentario de Nina no trae
 * texto (así está en la base). El del caso `respondiendo` es su 522611.
 */

const CASO = new URLSearchParams(location.search).get('caso');

const DE_NINA: RespuestaPrevia[] = [
  { cuando: '2026-09-12T17:18:54.260Z', texto: 'Hola Nina Silva te agradezco' },
  { cuando: '2026-09-12T17:20:21.921Z', texto: 'Buenos días estimada sigamos adelante' },
  {
    cuando: '2026-09-12T17:35:41.525Z',
    texto: 'Hola te invito a seguirme en mi canal de WhatsApp! https://whatsapp.com/channel/0029VbDJePQJuyAAbGjb3L3n 👍👀',
  },
  { cuando: '2026-09-13T04:15:49.926Z', texto: 'Vecina Nina! Feliz de contar con tu apoyo, saludos!' },
].map((r) => ({ origen: 'hermes' as const, quien: null, nombre: null, conPrivado: false, ...r }));

const FRASE_DEL_409 =
  'No se envió nada: este comentario ya tiene una respuesta. La última la mandó alguien del equipo: «Hola Nina Silva te agradezco».';

let estado: EstadoDeRespuesta =
  CASO === 'respondido-y-abierto'
    ? {
        respuestas: DE_NINA,
        respondiendo: [{ quien: 'centurion:americo.agente4', nombre: null, desde: new Date().toISOString() }],
      }
    : CASO === 'respondiendo'
    ? {
        respuestas: [],
        respondiendo: [{ quien: 'centurion:americo.agente4', nombre: null, desde: new Date().toISOString() }],
      }
    : CASO === 'se-adelanto'
      ? { respuestas: [], respondiendo: [] }
      : { respuestas: DE_NINA, respondiendo: [] };

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

window.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (url.includes('/estado')) return json(estado);
  if (url.includes('/presencia')) return json({ ok: true });
  if (url.includes('/puede-privado')) {
    return json({ puede: true, motivo: null, dias: 0, modulo: 'campana', cliente: 'americo' });
  }
  if (url.includes('/api/responder/') && init?.method === 'POST') {
    if (CASO === 'se-adelanto') {
      estado = { respuestas: DE_NINA.slice(0, 1), respondiendo: [] };
      return json({ type: 'ya_respondido', respuestas: estado.respuestas, errores: [FRASE_DEL_409] }, 409);
    }
    return json({ type: 'enviado', publico: 'c_1', errores: [] });
  }
  if (url.includes('/contexto')) return json({ post: null, adjunto: null, estado: {} });
  return json({ permalink: null });
}) as typeof fetch;

const COMENTARIO: Interaccion =
  CASO === 'respondiendo'
    ? {
        id: 522611,
        canal: 'facebook',
        tipo: 'comentario',
        persona_nombre: 'Nina Silva',
        texto: 'La mejor opción! RR 🩵💪🏻',
        contexto_texto: null,
        occurred_at: '2026-09-13T03:34:29.000Z',
        status: 'nuevo',
        pide_info: false,
        ventana_abierta: true,
        dias: 0,
      }
    : {
        id: 521348,
        canal: 'facebook',
        tipo: 'comentario',
        persona_nombre: 'Nina Silva',
        texto: '',
        contexto_texto: null,
        occurred_at: '2026-09-12T17:12:28.000Z',
        status: CASO === 'se-adelanto' ? 'nuevo' : 'contactado',
        pide_info: false,
        ventana_abierta: true,
        dias: 0,
      };

const CONVERSACION: Conversacion = {
  clave: `int:${COMENTARIO.id}`,
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: COMENTARIO.persona_nombre,
  numero_propio: null,
  texto: COMENTARIO.texto,
  contexto_texto: null,
  respondida: COMENTARIO.status !== 'nuevo',
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: COMENTARIO.occurred_at,
  ultimo_at: COMENTARIO.occurred_at,
  dias: 0,
  nivel: 2,
};

const TITULOS: Record<string, string> = {
  respondiendo: 'Américo — otra agente tiene abierto el comentario',
  'se-adelanto': 'Américo — al enviar, otra agente ya había respondido',
  'respondido-y-abierto': 'Américo — ya respondido, y otra agente lo tiene abierto',
};

const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <h1 className="font-heading text-lg font-bold text-foreground">
          {TITULOS[CASO ?? ''] ?? 'Américo — el comentario de Nina Silva, que ya tiene cuatro respuestas'}
        </h1>
        <div className="mt-4 h-[820px] max-w-3xl">
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
