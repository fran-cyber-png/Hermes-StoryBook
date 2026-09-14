import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { PanelDerecho } from './PanelDerecho';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA FICHA UNIFICADA — ANTES / DESPUÉS (F.1/F.2/F.4/F.5, 8-sep-2026).
 *
 * Monta el `PanelDerecho` DE VERDAD, mismo patrón que `galeriaCampana.tsx`: no
 * es una maqueta, es el componente que corre en producción con el `fetch`
 * interceptado. El caso es el de la persona diagnosticada: un alumno de
 * República Dominicana (icarus:23913, venta GOB-10291, correo medido en
 * `icarus.contacts` el 8-sep) cuyo alias de WhatsApp es «Pedro López», a quien
 * Cerberus SÍ ubica por `buscar/?q=` (por eso el nombre no cambia entre las dos
 * columnas) pero cuyo detalle —el que trae las ventas— devuelve 302 al login
 * (medido en producción el 8-sep): `ficha()` modela eso como
 * `verificado: false` y `ventasCount: null` (F.5).
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-ficha-unificada.html
 *
 * «ANTES» es el MISMO código con `/api/contactos/padron` devolviendo `{ padron:
 * null }` — exactamente lo que contestaba producción antes de F.1 (el endpoint
 * no existía). No es una versión vieja congelada del componente: es la
 * degradación honesta que la propia función ya sabe hacer sin icarus. Lo que
 * cambia de una columna a la otra: correo, país, ocupación, la procedencia al
 * lado del nombre, el aviso «sin verificar» de Cerberus y la venta GOB-10291 en
 * «Lo que compró» — todo lo que dependía de preguntarle a icarus.
 *
 * F.4 viaja en LAS DOS columnas por igual (no depende de icarus): la difusión
 * del 14-ago llevaba precio, así que `/api/senales` siembra esa cotización con
 * `ocurridoEn` real — el timeline la tiene que mostrar fechada y con el tag
 * «señal», no «IA · Sin fecha».
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

/** El detalle de Cerberus (con las ventas) devuelve 302 al login: `ficha()` lo modela así (F.5). */
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
    // El correo real medido en icarus.contacts para este caso (8-sep-2026).
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

const ANTES_CLAVE = 'conv:whatsapp:18099990000:51984429504';

const real = globalThis.fetch;
globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : (entrada as Request).url);
  // `usePadron`/`useFicha` piden por TELÉFONO, no por clave: el «antes» usa un
  // número distinto (mismo caso, antes de que icarus existiera para esta app)
  // para que el mismo `fetch` pueda contestar las dos cosas.
  const conIcarus = url.includes('18097961936');

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  // #1033 — el panel lee UNA consulta de perfil; se arma con las mismas piezas de abajo.
  if (url.includes('/api/contactos/perfil')) {
    return json({ ficha: FICHA_SIN_VERIFICAR, lead: null, padron: conIcarus ? PADRON_ICARUS.padron : null, errores: [] });
  }
  if (url.includes('/api/contactos/ficha')) return json(FICHA_SIN_VERIFICAR);
  if (url.includes('/api/contactos/padron')) return json(conIcarus ? PADRON_ICARUS : { padron: null });
  if (url.includes('/api/contactos/lead')) return json({ lead: null });
  if (url.includes('/api/contactos/registro')) return json({ ficha: null });
  if (url.includes('/api/enlaces')) return json({ origenes: [] });
  if (url.includes('/api/eventos')) return json({ eventos: [], correos: [] });
  // F.4 — la difusión del 14-ago llevaba precio: es la señal de cotización
  // real de este caso (diagnóstico, sección 5). Antes de F.4 el timeline la
  // rotulaba «IA» y perdía la fecha; ahora es «señal» con `ocurridoEn`.
  if (url.includes('/api/senales')) {
    const senal = {
      clave: '',
      etiquetas: [],
      corroborada: false,
      enfriamiento: { enfriada: false, diasDeSilencio: null, motivo: '' },
      cotizacion: { esCotizacion: true, motivo: 'la difusión llevaba precio', ocurridoEn: '2026-08-14T15:00:00.000Z' },
    };
    return json({
      senales: {
        [ANTES_CLAVE]: { ...senal, clave: ANTES_CLAVE },
        [PEDRO.clave]: { ...senal, clave: PEDRO.clave },
      },
    });
  }
  if (url.includes('/api/agenda')) return json({ recordatorios: [] });
  if (url.includes('/api/gestiones/intereses')) return json({ lista: [], derivados: [] });
  if (url.includes('/api/gestiones/etiquetas')) return json({ etiquetas: {} });
  // ADR 0107: la pérdida vigente, SEMBRADA (en ventas no hay un solo perdido real). El panel la pide
  // sólo si la conversación está en «Dijo que no», o sea con `?perdido=1`.
  if (url.includes('/api/gestiones/de/')) {
    return json({
      etapa: 'perdido',
      gestiones: [],
      perdida: { motivo: 'horario_o_fecha', detalle: 'Trabaja de noche; pidió que le avisemos del próximo grupo' },
    });
  }
  if (url.includes('/api/categorias')) return json({ categorias: [], supervisor: false });
  return real(entrada, init);
}) as typeof fetch;

function Caso({ titulo, nota, children }: { titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <section className="flex w-[360px] shrink-0 flex-col gap-2">
      <div>
        <h2 className="font-heading text-sm font-bold text-foreground">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </div>
      {/* 🔴 `PanelDerecho` es `h-full` — necesita un contenedor con altura
          real, o colapsa a 0 y todo se recorta. `galeriaCampana.tsx` usaba
          720 px porque su caso entraba ahí; con las filas de icarus (país,
          ocupación) éste ya no entra — de ahí el candado 10 (una galería
          que recorta contenido no es evidencia): 1400 px sobra para el
          contenido real, así que nada se esconde por falta de espacio. */}
      <div className="h-[1400px] w-[360px] overflow-hidden rounded-2xl border border-border">{children}</div>
    </section>
  );
}

// Mismo caso, dos teléfonos: el «antes» usa uno sin match en icarus (para que
// `usePadron` conteste `{ padron: null }`, que es lo que contestaba producción
// antes de F.1 — el endpoint no existía).
const ANTES: Conversacion = { ...PEDRO, clave: ANTES_CLAVE, persona_id: '18099990000' };
// `?perdido=1`: la misma ficha en «Dijo que no», para fotografiar el motivo junto a la etapa (ADR 0107).
const DESPUES: Conversacion = new URLSearchParams(location.search).has('perdido')
  ? { ...PEDRO, etapa_efectiva: 'perdido' }
  : PEDRO;

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-wrap gap-8 bg-background p-8">
        <Caso
          titulo="ANTES — sin el padrón de icarus"
          nota="Cerberus SÍ trae el nombre (buscar lo encuentra), pero nada más: sin correo, sin país, sin ocupación, y «Lo que compró» sin ninguna venta que mostrar — el detalle de Cerberus está vedado y nadie más sabía de la GOB-10291. La cotización del 14-ago ya se ve fechada y como «señal» (F.4): no depende de icarus."
        >
          <PanelDerecho conversacion={ANTES} miVendedora="luz" onMandarCorreo={() => {}} />
        </Caso>
        <Caso
          titulo="DESPUÉS — F.1/F.2/F.5"
          nota="Correo, país y ocupación de icarus en «Quién es» (F.1), con su procedencia. Cerberus dice que no pudo verificar el teléfono (F.5), y la venta GOB-10291 —que Hermes ya tenía registrada— llena el hueco en «Lo que compró»."
        >
          <PanelDerecho conversacion={DESPUES} miVendedora="luz" onMandarCorreo={() => {}} />
        </Caso>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
