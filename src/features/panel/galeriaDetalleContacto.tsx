import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { PanelDerecho } from './PanelDerecho';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * #887 — «EL DETALLE DEL CONTACTO»: Resumen · Actividad · Compras · Datos, EN
 * LA HOJA LATERAL (decisión del dueño, 8-sep-2026: no página completa).
 *
 * Monta el `PanelDerecho` DE VERDAD, mismo patrón que `galeriaFichaUnificada`:
 * no es una maqueta, es el componente que corre en producción con el `fetch`
 * interceptado. Mismo caso — José Francisco Lopez Fermin / icarus:23913 /
 * GOB-10291 — para que las dos galerías cuenten la misma historia.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-detalle-contacto.html
 */

const PEDRO: Conversacion = {
  clave: 'conv:whatsapp:18097961936:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '18097961936',
  persona_nombre: 'Pedro López',
  numero_propio: '51984429504',
  texto: 'Hola, me interesa el programa',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 2,
  referencia: '2026-09-03T14:00:00.000Z',
  ultimo_at: '2026-09-03T14:00:00.000Z',
  dias: 0,
  nivel: 3,
};

const FICHA_SIN_VERIFICAR = {
  estado: 'cliente',
  id: 4333,
  nombre: 'José Francisco Lopez Fermin',
  codigo: 'CLI-02491',
  dni: '',
  pais: '',
  correo: '',
  ventasCount: null,
  ventas: [],
  verificado: false,
};

const PADRON_ICARUS = {
  padron: {
    nombre: 'José Francisco Lopez Fermin',
    correo: 'jl5421485@gmail.com',
    pais: 'República Dominicana',
    ocupacion: 'Maestro',
    fuente: 'icarus',
    compras: [
      {
        folio: 'GOB-10291',
        fecha: '2025-10-31T00:00:00.000Z',
        monto: '2505',
        moneda: 'DOP',
        canal: 'whatsapp',
        fuente: 'puente-icarus',
      },
    ],
  },
};

const SENALES = {
  senales: {
    [PEDRO.clave]: {
      clave: PEDRO.clave,
      etiquetas: [],
      corroborada: false,
      enfriamiento: { enfriada: false, diasDeSilencio: null, motivo: '' },
      cotizacion: { esCotizacion: true, motivo: 'la difusión llevaba precio', ocurridoEn: '2026-08-14T15:00:00.000Z' },
    },
  },
};

/**
 * #1033 — LO QUE EL PANEL LEE AHORA: una sola consulta de perfil, armada en
 * Hermes con la copia local de Cerberus (#1032). La ficha llega verificada por
 * teléfono y con sus ventas; el folio, la fecha, el monto, el país y la
 * ocupación son los del caso real de arriba.
 *
 * ⚠️ **El nombre del producto es ilustrativo**: la galería no puede leer
 * producción, y el que Cerberus manda para GOB-10291 recién se ve en la copia
 * local después de la carga inicial. La evidencia con el valor real es la
 * captura en pruebas (regla dura #10).
 *
 * `FICHA_SIN_VERIFICAR` se queda en `/api/contactos/ficha`: si el panel volviera
 * a leer esa ruta, la galería mostraría el chip y se vería en la captura.
 */
const PERFIL = {
  ficha: {
    estado: 'cliente',
    id: 4333,
    nombre: 'José Francisco Lopez Fermin',
    codigo: 'CLI-02491',
    dni: '',
    pais: 'República Dominicana',
    correo: 'jl5421485@gmail.com',
    ocupacion: 'Maestro',
    // Una compra y una cotización: la cotización se ve en Compras, marcada, pero
    // no cuenta (`dominio/estadosVenta.ts`, dueño 13-sep-2026). Cada venta dice
    // de qué negocio de Goberna es.
    ventasCount: 1,
    ventas: [
      {
        folio: 'GOB-11020',
        estado: 'Cotización',
        monto: '3200',
        moneda: 'DOP',
        fecha: '2026-08-14T15:00:00.000Z',
        productos: ['Asesoría de campaña municipal'],
        esCompra: false,
        negocios: ['Consultoria'],
      },
      {
        folio: 'GOB-10291',
        estado: 'Pagado',
        monto: '2505',
        moneda: 'DOP',
        fecha: '2025-10-31T15:00:00.000Z',
        productos: ['Diplomado en Gestión Pública'],
        esCompra: true,
        negocios: ['Escuela'],
      },
    ],
    verificado: true,
  },
  lead: null,
  padron: PADRON_ICARUS.padron,
  errores: [],
};

const real = globalThis.fetch;
globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : (entrada as Request).url);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  if (url.includes('/api/contactos/perfil')) return json(PERFIL);
  if (url.includes('/api/contactos/ficha')) return json(FICHA_SIN_VERIFICAR);
  if (url.includes('/api/contactos/padron')) return json(PADRON_ICARUS);
  if (url.includes('/api/contactos/lead')) return json({ lead: null });
  if (url.includes('/api/contactos/registro')) return json({ ficha: null });
  if (url.includes('/api/enlaces')) return json({ origenes: [] });
  if (url.includes('/api/eventos')) return json({ eventos: [], correos: [] });
  if (url.includes('/api/senales')) return json(SENALES);
  if (url.includes('/api/agenda')) return json({ recordatorios: [] });
  if (url.includes('/api/gestiones/intereses')) return json({ lista: [], derivados: [] });
  if (url.includes('/api/gestiones/etiquetas')) return json({ etiquetas: {} });
  if (url.includes('/api/categorias')) return json({ categorias: [], supervisor: false });
  return real(entrada, init);
}) as typeof fetch;

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex bg-background p-8">
        <div className="h-[820px] w-[372px] overflow-hidden rounded-2xl border border-border">
          <PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
