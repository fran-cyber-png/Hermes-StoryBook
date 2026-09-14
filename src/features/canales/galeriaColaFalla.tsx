import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { respuestaLineasNoLeidas } from '../../pruebas/lineasNoLeidas';
import { ColaUnificada } from './ColaUnificada';

/**
 * LA COLA CUANDO EL SERVER NO PUDO LEER LAS LÍNEAS — galería de evidencia de #952 (ADR 0108).
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-cola-falla.html?falla=1
 *     (sin params) → la cola con una conversación, para comparar
 *
 * Monta `ColaUnificada` DE VERDAD con el `fetch` interceptado. Con `?falla=1`, `/api/conversaciones`
 * contesta el 503 `lineas_no_leidas` de `pruebas/lineasNoLeidas.ts`, que su paridad cruza con el del
 * server. Lo que hay que mirar es que la cola lo DIGA con su botón «Reintentar», y que no quede vacía,
 * y menos con «Estás al día».
 */

const FALLA = new URLSearchParams(location.search).has('falla');
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: 'conv:whatsapp:51933330003:51970356062',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51933330003',
  persona_nombre: 'Rosa Quispe',
  numero_propio: '51970356062',
  texto: 'Hola, ¿cuánto cuesta el diplomado?',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: true,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 3,
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
  if (url.includes('intencion=pregunto-precio')) return json({ conversaciones: [], total: 0, hayMas: false });
  if (url.includes('/api/conversaciones/estado')) return json({ ok: true });
  if (url.includes('/api/conversaciones')) {
    return FALLA ? respuestaLineasNoLeidas() : json({ conversaciones: [CONVERSACION], total: 1, hayMas: false });
  }
  if (url.includes('/api/whatsapp/sesion')) return json({ transporte: 'cloud-api' });
  if (url.includes('/api/whatsapp/lineas')) return json({ lineas: [] });
  if (url.includes('/api/interactions/frescura')) return json({ ultimoDato: AHORA, ultimaIngesta: AHORA, total: 1200 });
  if (url.includes('/api/categorias')) return json({ categorias: [] });
  if (url.includes('/api/agenda')) return json({ recordatorios: [] });
  if (url.includes('/api/dashboard')) return json({ porVendedora: [] });
  return json({}, 404);
}) as typeof fetch;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-[100dvh] justify-center bg-background p-4">
        <div className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
