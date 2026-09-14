import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { Avisos } from '../../components/Avisos';
import type { Conversacion } from '../../dominio/conversaciones';
import { BarraGestion } from './BarraGestion';
import { ProximoSeguimiento } from '../agenda/ProximoSeguimiento';

/**
 * LA GALERÍA DE LAS ACCIONES DEL CHAT — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-chat.html
 *
 * Existe por la regla dura #2 (nada de UI se reporta listo sin captura) y por
 * una razón práctica: el frente entero se puede MIRAR sin Postgres, que es
 * exactamente lo que no hay en una máquina de desarrollo recién clonada.
 *
 *  - sin params — un lead nuevo: la barra con `+ Contacto`.
 *  - `?registrado=1` — el contacto ya registrado (el botón muestra el nombre) y
 *    su próximo seguimiento arriba del hilo.
 *  - `?ficha=1` — el drawer del registro rápido, con el prellenado que sale del
 *    alias de WhatsApp «Jorge Martin - JM RUSH AUTOMOTRIZ».
 *  - `?vencido=1` — el mismo seguimiento, pero pasado de hora: el banner grita.
 *  - `?supervisor=1` — el «+» de etiquetas (`EtiquetasInline`) suma el formulario
 *    de «nueva categoría»; sin el param, la vendedora solo elige de las que ya
 *    existen (22-ago-2026: crear categoría es solo del supervisor).
 *  - `?llamada=vigente|sin_permiso|sin_activas|otra_linea` — los estados de `BotonLlamar`
 *    (ADR 0123): con permiso ya dado (el clic llama, no hay popover que fotografiar),
 *    pidiendo permiso (el popover con el texto de espera), esta cuenta sin las
 *    llamadas activadas — el caso medido el 14-sep-2026 — y una línea que no es
 *    Ventas Meta (marcador + el motivo, uno distinto en cada caso). Sin el param,
 *    `/api/llamadas/*` cae al `fetch` real — que en la galería no tiene con qué
 *    contestar y el botón queda en «No se pudo consultar», la misma respuesta
 *    honesta que da en producción.
 *
 * ⚠️ Los datos son fixture y se apoyan en el reloj de la máquina, como en la
 * galería de la agenda: la foto tiene que mostrar el caso feo, no el ideal.
 */

const params = new URLSearchParams(location.search);
const registrado = params.has('registrado') || params.has('vencido');
const vencido = params.has('vencido');
/** `?supervisor=1` — para fotografiar las dos caras de `EtiquetasInline` (22-ago-2026):
 *  con y sin el formulario de «nueva categoría», que es solo del supervisor. */
const supervisor = params.has('supervisor');
/** `?llamada=` — ver el docblock de arriba. */
const llamada = params.get('llamada');

const CLAVE = 'conv:whatsapp:51984429504:51955950559';

const CONVERSACION: Conversacion = {
  clave: CLAVE,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51955950559',
  persona_nombre: 'Jorge Martin - JM RUSH AUTOMOTRIZ',
  numero_propio: '51984429504',
  texto: 'Gracias por comunicarte con JM RUSH AUTOMOTRIZ, en qué te podemos ayudar ?',
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 3,
  referencia: new Date().toISOString(),
  ultimo_at: new Date().toISOString(),
  dias: 0,
  nivel: 2,
};

const cuando = new Date();
cuando.setHours(cuando.getHours() + (vencido ? -3 : 18), 0, 0, 0);

/**
 * UN DATO DE PRUEBA POR CADA CANAL EXISTENTE (`canalesDelRiel.ts`,
 * `OPCIONES_CANAL`) — para verificar de un vistazo que la barra compacta
 * (Llamar/Agendar/Contacto sin texto, sin «···») se ve bien en los cinco:
 * WhatsApp, el comentario y el DM de cada red de Meta, y el formulario.
 *
 * `Llamar` sólo se dibuja para WhatsApp (`BarraGestion` lo filtra por
 * `canal === 'whatsapp'`): que falte en las otras cuatro filas es lo
 * correcto, no un olvido.
 */
const BASE_PRUEBA = {
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: new Date().toISOString(),
  ultimo_at: new Date().toISOString(),
  dias: 0,
  nivel: 2 as const,
};

const CANALES_PRUEBA: readonly { rotulo: string; conversacion: Conversacion }[] = [
  {
    rotulo: 'WhatsApp',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'conv:whatsapp:51900000001:51984429504',
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: '51900000001',
      persona_nombre: 'Prueba WhatsApp',
      numero_propio: '51984429504',
      texto: '¿Cuánto cuesta el diplomado?',
    },
  },
  {
    rotulo: 'Messenger (Facebook · DM)',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'conv:facebook:fb-dm-prueba:',
      canal: 'facebook',
      tipo: 'mensaje',
      persona_id: 'fb-dm-prueba',
      persona_nombre: 'Prueba Messenger',
      numero_propio: null,
      texto: 'Hola, vi el anuncio en Facebook',
    },
  },
  {
    rotulo: 'Facebook (comentario)',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'int:900001',
      canal: 'facebook',
      tipo: 'comentario',
      persona_id: 'fb-comentario-prueba',
      persona_nombre: 'Prueba Comentario FB',
      numero_propio: null,
      texto: '¿Precio del curso?',
    },
  },
  {
    rotulo: 'Instagram (DM)',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'conv:instagram:ig-dm-prueba:',
      canal: 'instagram',
      tipo: 'mensaje',
      persona_id: 'ig-dm-prueba',
      persona_nombre: 'Prueba Instagram',
      numero_propio: null,
      texto: 'Me interesa el curso',
    },
  },
  {
    rotulo: 'Instagram (comentario)',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'int:900002',
      canal: 'instagram',
      tipo: 'comentario',
      persona_id: 'ig-comentario-prueba',
      persona_nombre: 'Prueba Comentario IG',
      numero_propio: null,
      texto: '¿Cuándo empieza?',
    },
  },
  {
    rotulo: 'Formulario (landing)',
    conversacion: {
      ...BASE_PRUEBA,
      clave: 'lead:landing-prueba',
      canal: 'landing',
      tipo: 'lead',
      persona_id: '51900000002',
      persona_nombre: 'Prueba Formulario',
      numero_propio: null,
      texto: null,
    },
  },
];

/**
 * El server, de mentira. Se stubea `fetch` y no se siembra el caché por lo
 * mismo que en la galería de la agenda: la agenda repregunta sola cada minuto y
 * un refetch fallido pondría la pantalla en error justo al sacar la foto.
 */
const original = globalThis.fetch;
globalThis.fetch = ((url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url);
  const responder = (cuerpo: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

  if (u.includes('/api/contactos/registro')) {
    return responder({
      ficha: registrado
        ? {
            clave: CLAVE,
            telefono: '51955950559',
            nombre: 'Jorge',
            apellido: 'Martin',
            empresa: 'JM Rush Automotriz',
            email: 'jorge@jmrush.pe',
            prioridad: 'alta',
            vendedoraId: 'luz',
            creadoAt: new Date().toISOString(),
            actualizadoAt: new Date().toISOString(),
          }
        : null,
    });
  }
  if (u.includes('/api/agenda')) {
    return responder({
      recordatorios: registrado
        ? [
            {
              id: 1,
              clave: CLAVE,
              canal: 'whatsapp',
              personaId: '51955950559',
              personaNombre: 'Jorge Martin',
              numeroPropio: '51984429504',
              nota: 'Llamar a Jorge por el Foro de Estado',
              cuando: cuando.toISOString(),
              tipo: 'llamada',
              estado: 'pendiente',
              importancia: 'alta',
            },
          ]
        : [],
    });
  }
  // `?perdido=1`: la conversación ya está en «Dijo que no», con un motivo SEMBRADO (ADR 0107): en ventas
  // no hay un solo perdido real. Sirve para fotografiar la corrección; sin el param se declara desde cero.
  if (u.includes('/api/gestiones/de/')) {
    return responder(
      params.has('perdido')
        ? { etapa: 'perdido', perdida: { motivo: 'precio', detalle: 'Le pareció caro; lo vuelve a ver en marzo' } }
        : { etapa: registrado ? 'cotizado' : 'interesado' },
    );
  }
  if (u.includes('/api/gestiones/etiquetas')) {
    return responder({ etiquetas: registrado ? { [CLAVE]: ['VIP', 'Consultor Político'] } : {} });
  }
  if (u.includes('/api/categorias')) {
    return responder({
      categorias: [
        { id: 1, nombre: 'VIP', color: 'dorado' },
        { id: 2, nombre: 'Consultor Político', color: 'azul' },
        { id: 3, nombre: 'Pidió precio', color: 'verde' },
      ],
      supervisor,
    });
  }
  if (u.includes('/api/intereses')) {
    return responder({ lista: registrado ? [{ curso: 'Foro de Estado Perú 2026', creadoAt: new Date().toISOString() }] : [] });
  }
  if (u.includes('/api/eventos/notas-recientes')) {
    return responder({
      notas: [
        'No contesta, reintentar mañana a la tarde',
        'Pidió que la llamemos después de las 18:00',
        'Dijo que lo consulta con su socio y responde',
      ],
    });
  }
  // #1033 — el panel lee UNA consulta de perfil: el mismo lead nuevo, sin formulario ni padrón.
  if (u.includes('/api/contactos/perfil')) {
    return responder({ ficha: { estado: 'nuevo' }, lead: null, padron: null, errores: [] });
  }
  if (u.includes('/api/contactos/ficha')) return responder({ estado: 'nuevo' });
  if (u.includes('/api/contactos/lead')) return responder({ lead: null });
  if (u.includes('/api/whatsapp/sesion')) {
    return responder({ estado: 'conectado', telefono: '51984429504', transporte: 'cloud-api' });
  }
  // `BotonLlamar` (ADR 0123) — ver `?llamada=` en el docblock de arriba. `otra_linea` necesita
  // `activa: true`: si fuera `false`, `llamablePor` corta ahí y nunca llega a comparar la línea.
  if (u.includes('/api/llamadas/activas')) {
    return responder({
      ok: true,
      activa: llamada !== 'sin_activas',
      linea: llamada === 'otra_linea' ? '51900000000' : '51984429504',
    });
  }
  if (u.includes('/api/llamadas/permiso')) {
    return responder({
      ok: true,
      permiso:
        llamada === 'vigente'
          ? { estado: 'permanente', venceEn: null, puedePedir: false, puedeLlamar: true }
          : { estado: 'sin_permiso', venceEn: null, puedePedir: true, puedeLlamar: false },
    });
  }
  if (u.includes('/api/llamadas/pedir-permiso')) {
    return responder({ ok: true, mensaje: 'Pedido enviado. Cuando la persona acepte, vas a poder llamarla.' });
  }
  return original(url, init);
}) as typeof fetch;

/**
 * El clic que la captura no puede dar: Chrome headless no interactúa, así que
 * la galería abre el drawer por la MISMA puerta que la vendedora —el botón—, no
 * por un atajo que se saltee el componente.
 */
if (params.has('ficha')) {
  setTimeout(() => {
    const boton = [...document.querySelectorAll('button')].find((b) =>
      /^Contacto$|Jorge/.test(b.textContent?.trim() ?? ''),
    );
    boton?.click();
  }, 400);
}

/**
 * Lo mismo para `BotonLlamar`: con permiso vigente el clic llama y no hay popover que
 * fotografiar (por diseño — ver el docblock de `BotonLlamar.tsx`), así que sólo se
 * autoclickea para los casos que SÍ dejan algo escrito en pantalla.
 */
if (llamada === 'sin_permiso' || llamada === 'sin_activas' || llamada === 'otra_linea') {
  setTimeout(() => {
    const boton = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Llamar');
    boton?.click();
  }, 400);
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen flex-col gap-2 bg-background p-4">
        <BarraGestion conversacion={CONVERSACION} miVendedora="luz" />
        <ProximoSeguimiento clave={CLAVE} />
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-card text-xs text-muted-foreground shadow-panel">
          (acá va el hilo de la conversación)
        </div>

        {/* Un dato de prueba por cada canal existente — ver `CANALES_PRUEBA`. */}
        <div className="shrink-0 rounded-2xl bg-card p-3 shadow-panel">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Un canal por fila
          </h2>
          <div className="flex flex-col gap-2">
            {CANALES_PRUEBA.map(({ rotulo, conversacion }) => (
              <div key={conversacion.clave} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-[11px] font-semibold text-muted-foreground">
                  {rotulo}
                </span>
                <BarraGestion conversacion={conversacion} />
              </div>
            ))}
          </div>
        </div>

        <Avisos />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
