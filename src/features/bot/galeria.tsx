import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { InterruptorBot } from './InterruptorBot';
import { CODIGO_OTRO_MODULO, type RespuestaBotApi } from './estado';

/**
 * EL CHIP DEL BOT, EN LOS TRES ESTADOS QUE HAY QUE PODER DISTINGUIR.
 *
 * Entry APARTE de Vite (`galeria-bot.html`): no entra al bundle de la app y no
 * habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-bot.html
 *
 * ══ POR QUÉ ESTA GALERÍA EXISTE ══════════════════════════════════════════════
 *
 * Porque el cambio de #789 es exactamente una DIFERENCIA VISUAL, y una
 * diferencia no se verifica describiéndola. Hasta el 7-sep-2026 una operadora de
 * campaña veía **«bot: sin señal» con triángulo amarillo**: la ruta `/api/bot` va
 * con el candado `deVentas` y le contestaba 403, que el front no distinguía de
 * «el server no contestó». O sea una alarma permanente, sobre una máquina que en
 * campaña no existe, que nadie de ese lado podía apagar.
 *
 * Los tres casos van JUNTOS a propósito: lo que hay que poder ver de un vistazo
 * es que el de campaña se parece a un estado sano y NO al server caído. Un caso
 * solo no prueba nada — es la misma regla que `PanelDerecho.campana.test.tsx`
 * escribe para los fetch: **se fija la diferencia, no la ausencia**.
 */

const VIVO: RespuestaBotApi = {
  numero: '51984429504',
  habilitada: true,
  modoEfectivo: 'sombra',
  modoDeLaBase: 'sombra',
  modoDelEntorno: 'automatico',
  frenado: false,
  frenadoMotivo: null,
  modos: [
    { modo: 'apagado', descripcion: 'No piensa ni manda: los entrantes se descartan.', elegible: true },
    { modo: 'sombra', descripcion: 'Piensa y guarda la respuesta, pero NO la envía.', elegible: true },
    { modo: 'automatico', descripcion: 'Piensa y envía.', elegible: false },
  ],
};

/** Qué contesta `/api/bot/estado` en cada caso. Es la única diferencia entre los tres. */
type Caso = { id: string; titulo: string; nota: string; responde: () => Response };

const CASOS: Caso[] = [
  {
    id: 'campana',
    titulo: 'Campaña · «no aplica»',
    nota:
      'El candado `deVentas` contesta 403 con `codigo: otro_modulo_del_crm`. Sin tono de alarma y sin ' +
      'segmentos: no hay interruptor que tocar desde este lado. Antes decía «sin señal», en amarillo.',
    responde: () =>
      new Response(
        JSON.stringify({ ok: false, codigo: CODIGO_OTRO_MODULO, modulo: 'ventas', message: 'esta parte de Hermes es del módulo de ventas' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
  },
  {
    id: 'ventas',
    titulo: 'Ventas · el interruptor de verdad',
    nota: 'La otra mitad, intacta: los tres modos, el puesto marcado y «Automático» retirado por ADR 0077.',
    responde: () => new Response(JSON.stringify(VIVO), { headers: { 'content-type': 'application/json' } }),
  },
  {
    id: 'caido',
    titulo: 'Server caído · «sin señal»',
    nota:
      'Lo que NO puede confundirse con el primero: acá sí pasa algo y alguien tiene que mirarlo. Va en ' +
      'amarillo, con triángulo. Y nunca cae a «apagado», que sería el falso OK sobre un kill-switch.',
    responde: () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }),
  },
];

/**
 * 🔴 UN DOCUMENTO POR CASO, Y NO TRES COMPONENTES EN LA MISMA PÁGINA.
 *
 * La primera versión de esta galería montaba los tres `InterruptorBot` juntos y
 * le asignaba `globalThis.fetch` a cada uno en su `useEffect`. **Los tres
 * mostraban «bot: sin señal»**: el `fetch` es UNO por documento, así que ganaba
 * el último en montar —el server caído— y la galería afirmaba, en tres tarjetas,
 * un estado que sólo correspondía a una.
 *
 * Habría pasado por evidencia: tres chips dibujados, tres notas correctas al
 * lado, y la captura diciendo lo contrario de lo que el código hace. Es el
 * candado 10 tal cual —«una galería que no sirve los valores reales no es
 * evidencia»— y se descubrió mirando la captura, no leyendo el código.
 *
 * Cada caso vive ahora en su propio `iframe`, que es su propio documento y por
 * lo tanto su propio `fetch`. La página madre sólo los acomoda.
 */
function CasoBot({ caso }: { caso: Caso }) {
  return (
    <Marco titulo={caso.titulo} nota={caso.nota}>
      <iframe
        title={caso.titulo}
        src={`?caso=${encodeURIComponent(caso.id)}`}
        className="h-24 w-full rounded-xl border-0 bg-background"
      />
    </Marco>
  );
}

function Marco({ titulo, nota, children }: { titulo: string; nota: string; children: ReactNode }) {
  return (
    <div className="w-[26rem] rounded-2xl border border-border bg-card p-4 shadow-panel">
      <h2 className="mb-1 text-sm font-bold text-navy-ink">{titulo}</h2>
      <p className="mb-3 text-xs leading-snug text-muted-foreground">{nota}</p>
      {children}
    </div>
  );
}

const raiz = createRoot(document.getElementById('root')!);
const pedido = new URLSearchParams(location.search).get('caso');
const soloUno = CASOS.find((c) => c.id === pedido);

if (soloUno) {
  // UN caso: se stubea el `fetch` de ESTE documento antes de montar nada, así el
  // chip nunca llega a pedirle al server de verdad.
  globalThis.fetch = ((entrada: RequestInfo | URL) =>
    Promise.resolve(
      String(entrada).includes('/api/bot') ? soloUno.responde() : new Response('{}', { status: 404 }),
    )) as typeof fetch;
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  raiz.render(
    <StrictMode>
      <QueryClientProvider client={cliente}>
        <div className="bg-background p-3">
          <InterruptorBot />
        </div>
      </QueryClientProvider>
    </StrictMode>,
  );
} else {
  raiz.render(
    <StrictMode>
      <div className="min-h-screen bg-background p-8">
        <h1 className="mb-1 text-xl font-extrabold text-navy-ink">El chip del bot, en los dos módulos</h1>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Lo que se mira es la DIFERENCIA entre el primero y el tercero: los dos son un estado que el front no
          pudo leer, y sólo uno de los dos es un problema.
        </p>
        <div className="flex flex-wrap gap-6">
          {CASOS.map((c) => (
            <CasoBot key={c.id} caso={c} />
          ))}
        </div>
      </div>
    </StrictMode>,
  );
}
