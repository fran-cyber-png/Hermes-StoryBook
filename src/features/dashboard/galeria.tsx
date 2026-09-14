import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { respuestaLineasNoLeidas } from '../../pruebas/lineasNoLeidas';
import { VistaDashboard } from './VistaDashboard';
import type { PuenteAlPipeline } from './hoy';
import { ESCUCHA_CON_ATRASO, ESCUCHA_DE_BETTO } from './galeria.escucha';
import { HOY_CAMPANA, HOY_NICOLE, HOY_SUPERVISOR, HOY_VACIO, SERIES_14 } from './galeria.hoy';
import {
  NEGOCIO_POR_ANUNCIO,
  NEGOCIO_POR_CAMPANA,
  NEGOCIO_POR_CANAL,
  NEGOCIO_POR_CURSO,
  NEGOCIO_POR_LINEA,
  NEGOCIO_POR_VENDEDORA,
} from './galeria.negocio';

/**
 * LA GALERÍA DEL DASHBOARD — la evidencia, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-dashboard.html` en la raíz): **no entra al bundle de
 * la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-dashboard.html
 *     (sin params)   → «Hoy» de una vendedora (nicole): su universo y su fila, «Tú»
 *     …?supervisor=1 → «Hoy» de quien supervisa: el equipo entero, con «El negocio»
 *     …?vacio=1      → una vendedora recién llegada, sin nada que medir
 *     …?campana=1    → el comando de campaña: «Hoy» sin calientes, y «La campaña»
 *     …?atraso=1     → lo mismo, con el clasificador de campaña atrasado
 *
 * Desde ADR 0104 lo que hay que mirar acá es «Hoy»: que cada cifra abra el Pipeline
 * con SU recorte (abajo se imprime el puente que se mandaría), que la deuda sin
 * dueña se vea más grande que la de las personas, y que una primera respuesta con
 * cero contestadas diga «sin respuesta» y no «0 min». Los valores son los de
 * producción: ver `galeria.hoy.ts`.
 */

const PARAMS = new URLSearchParams(location.search);
const SUPERVISOR = PARAMS.has('supervisor');
const VACIO = PARAMS.has('vacio');
/** El módulo CAMPAÑA. `?atraso=1` lo implica: es una lectura de ese módulo. */
const CAMPANA = PARAMS.has('campana') || PARAMS.has('atraso');
/**
 * 🔴 EL ATRASO DEL CLASIFICADOR, el único estado del panel de escucha que ninguna
 * captura con datos reales puede mostrar (sobre la base de Betto `pendientes` es 0).
 */
const ATRASO = PARAMS.has('atraso');
/**
 * `?hoy=falla`: el server no pudo leer las líneas de quien mira y cerró con 503 (ADR 0108, #952).
 * Es el cuerpo de `pruebas/lineasNoLeidas.ts`, que su paridad cruza con el del server; lo que hay
 * que mirar es que «Hoy» lo diga y ofrezca reintentar, no que se quede en blanco.
 *
 * `?hoy=refresco-caido`: «Hoy» llega bien y el 503 lo contesta el refresco siguiente (tocar
 * «Actualizar»). Lo que hay que mirar es que las cifras se queden y el aviso vaya encima.
 */
const HOY_FALLA = PARAMS.get('hoy') === 'falla';
const HOY_REFRESCO_CAIDO = PARAMS.get('hoy') === 'refresco-caido';
let pedidosDeHoy = 0;

/** Todo endpoint responde de mentira: la galería no toca la red ni una vez. */
window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);

  if (url.includes('/api/dashboard/hoy')) {
    pedidosDeHoy += 1;
    if (HOY_FALLA || (HOY_REFRESCO_CAIDO && pedidosDeHoy > 1)) return respuestaLineasNoLeidas();
    return respuesta(CAMPANA ? HOY_CAMPANA : VACIO ? HOY_VACIO : SUPERVISOR ? HOY_SUPERVISOR : HOY_NICOLE);
  }

  if (url.includes('/api/dashboard/series')) return respuesta(SERIES_14);

  /**
   * LA LECTURA DE CAMPAÑA (ADR 0085) — los números son los de producción, medidos el
   * 24-ago-2026 sobre la línea de Betto (`51963139984`, 11 al 24 de agosto).
   */
  if (url.includes('/api/dashboard/campana')) {
    return respuesta({
      rango: { desde: '2026-08-11T05:00:00.000Z', hasta: '2026-08-25T04:59:59.000Z' },
      periodo: '30d',
      lineas: ['51963139984'],
      gente: { escribieron: 152, respondidas: 143, sin_responder: 9, nuevas: 152 },
      mensajes: { entrantes: 608, salientes: 533, entrantes_sin_texto: 92 },
      franjas: [
        { franja: 'madrugada', personas: 10, atendidas: 10, demora_mediana_min: 329, entrantes: 21 },
        { franja: 'manana', personas: 27, atendidas: 27, demora_mediana_min: 88, entrantes: 153 },
        { franja: 'tarde', personas: 66, atendidas: 61, demora_mediana_min: 8, entrantes: 312 },
        { franja: 'noche', personas: 49, atendidas: 45, demora_mediana_min: 688, entrantes: 122 },
      ],
      // Con los seis días en cero del 12 al 17: es el apagón real de la línea.
      dias: [
        { dia: '2026-08-11', entrantes: 117, salientes: 116 },
        { dia: '2026-08-12', entrantes: 0, salientes: 0 },
        { dia: '2026-08-13', entrantes: 0, salientes: 0 },
        { dia: '2026-08-14', entrantes: 0, salientes: 0 },
        { dia: '2026-08-15', entrantes: 0, salientes: 0 },
        { dia: '2026-08-16', entrantes: 0, salientes: 0 },
        { dia: '2026-08-17', entrantes: 0, salientes: 0 },
        { dia: '2026-08-18', entrantes: 6, salientes: 1 },
        { dia: '2026-08-19', entrantes: 5, salientes: 0 },
        { dia: '2026-08-20', entrantes: 7, salientes: 2 },
        { dia: '2026-08-21', entrantes: 22, salientes: 92 },
        { dia: '2026-08-22', entrantes: 91, salientes: 62 },
        { dia: '2026-08-23', entrantes: 227, salientes: 131 },
        { dia: '2026-08-24', entrantes: 133, salientes: 129 },
      ],
      aperturas: [{ texto: 'Hola. Las principales problemáticas de mi provincia son', personas: 86, solo_eso: 68 }],
      // Sin esta clave `PanelEscucha` devuelve `null` y el panel es invisible (4-sep-2026).
      escucha: ATRASO ? ESCUCHA_CON_ATRASO : ESCUCHA_DE_BETTO,
      equipo: [
        { operador: 'centurion:usuario1', nombre: 'Andrea', envios: 126, personas: 60, leidos: 115, automaticos: 0 },
        { operador: 'centurion:usuario4', nombre: null, envios: 98, personas: 44, leidos: 80, automaticos: 0 },
        { operador: 'centurion:job.meneses', nombre: 'Job Meneses', envios: 59, personas: 31, leidos: 57, automaticos: 0 },
        { operador: 'bot', nombre: null, envios: 49, personas: 19, leidos: 0, automaticos: 49 },
        { operador: 'centurion:usuario9', envios: 40, personas: 30, leidos: 26, automaticos: 0 },
        { operador: 'centurion:usuario7', envios: 35, personas: 15, leidos: 27, automaticos: 0 },
        { operador: 'centurion:usuario3', envios: 32, personas: 15, leidos: 30, automaticos: 0 },
        { operador: 'usuario2', envios: 31, personas: 20, leidos: 0, automaticos: 0 },
        { operador: 'centurion:usuario1', envios: 19, personas: 7, leidos: 11, automaticos: 0 },
      ],
    });
  }

  if (url.includes('/api/dashboard/negocio')) {
    // La dimensión sale de la URL que pidió el panel, como la sirve el server: un stub
    // que contesta lo mismo para todas haría que el conmutador se vea andando aunque
    // estuviera roto.
    const porDimension = url.includes('dimension=vendedora')
      ? NEGOCIO_POR_VENDEDORA
      : url.includes('dimension=anuncio')
        ? NEGOCIO_POR_ANUNCIO
        : url.includes('dimension=campana')
          ? NEGOCIO_POR_CAMPANA
          : url.includes('dimension=linea')
            ? NEGOCIO_POR_LINEA
            : url.includes('dimension=canal')
              ? NEGOCIO_POR_CANAL
              : NEGOCIO_POR_CURSO;
    // «Por qué se pierden» (ADR 0107). En producción no hay un solo `perdido` declarado en ventas, así
    // que estos valores son SEMBRADOS: `?perdidas=1` los muestra, `?perdidas=0` fotografía el vacío, y
    // sin el param la respuesta no trae el bloque, como un server viejo (ADR 0007).
    const pedidoDePerdidas = new URLSearchParams(location.search).get('perdidas');
    return respuesta(
      pedidoDePerdidas === null
        ? porDimension
        : {
            ...porDimension,
            perdidas:
              pedidoDePerdidas === '0'
                ? { total: 0, porMotivo: [] }
                : {
                    total: 6,
                    porMotivo: [
                      { motivo: 'precio', n: 3 },
                      { motivo: 'horario_o_fecha', n: 1 },
                      { motivo: 'compro_en_otro_lado', n: 1 },
                      { motivo: null, n: 1 },
                    ],
                  },
          },
    );
  }

  return new Response(JSON.stringify({ ok: false, message: 'la galería no sirve esta ruta' }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

function respuesta(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });
}

/** La vista, más una línea al pie con el puente que se mandaría al Pipeline. */
function Galeria() {
  const [ultimo, setUltimo] = useState<PuenteAlPipeline | null>(null);
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <VistaDashboard esDeCampana={CAMPANA} onAbrirPipeline={setUltimo} />
      {ultimo && (
        <p
          role="status"
          className="fixed bottom-3 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-navy px-4 py-2 font-mono text-[11px] text-white shadow-panel"
        >
          Abriría el Pipeline con {JSON.stringify(ultimo)}
        </p>
      )}
    </div>
  );
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
