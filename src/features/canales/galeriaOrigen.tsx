import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { FilaConversacion } from './FilaConversacion';
import { EncabezadoTimeline } from '../panel/EncabezadoTimeline';
import { metaDelContacto } from '../panel/metaDeContacto';
import { deDondeVino, type OrigenCrudo } from '../../dominio/origen';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * ══ DE DÓNDE VINO EL LEAD — LA EVIDENCIA (7-sep-2026) ══════════════════════
 *
 * 🔴 **TODOS LOS VALORES DE ESTA PÁGINA SALEN DE PRODUCCIÓN, no de un caso
 * ideal** (regla dura #10: «una galería que no sirve los valores REALES de
 * producción no es evidencia; el caso ideal ya escondió tres defectos a la
 * vez»). Se sacaron por SSH, en sólo lectura, contra `hermes_db` el 7-sep-2026:
 *
 *   · **Luis López Loarte** — ad `120249753997080789`, resuelto: anuncio «flyer
 *     principal», campaña «[SEP][DIPICOT027] Diplomado en Inteligencia 27 -
 *     Perú». Es el caso bonito, y es la MINORÍA.
 *   · **Rafael** — ad `120253750387870341`, SIN resolver: `anuncio_resuelto` no
 *     lo tiene. **Así llegan 1.954 de las 3.257 personas que vinieron por
 *     anuncio: el 60 %.** Lo único legible que traen es el titular del creativo
 *     —y lo traen las 1.954, el 100 %—, por eso el fallback es ése y no el
 *     `ad_id`.
 *   · **Ing. Mario Sánchez** — sus 8 mensajes tienen `origen` nulo. Es el caso
 *     del 6-sep: escribió «si seguí tu anuncio en Facebook deberías saber qué
 *     necesito», la pantalla no decía nada, y terminó tratado de grosero.
 *
 * ⚠️ **LA FILA DE «LANDING» NO ES UN CASO REAL, Y HAY QUE DECIRLO.** Producción
 * tiene **0 filas** con `origen.fuente = 'landing'` en toda la historia de
 * `events`, aunque `server/src/whatsapp/origen.ts` la detecta desde siempre. Se
 * dibuja con la forma que ESE detector escribe, para que el estado exista y se
 * pueda mirar — pero no es evidencia de nada que haya pasado. Va marcada.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-origen.html
 */

const AHORA = Date.now();
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:${over.numero_propio ?? '51984429504'}`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51984429504',
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: true,
    pregunto: false,
    n: 1,
    referencia: haceHoras(3),
    ultimo_at: haceHoras(3),
    dias: 0,
    nivel: 3,
    ...over,
  };
}

/** El origen tal como lo devuelve el hilo YA resuelto contra Meta. */
const ORIGEN_DE_LUIS: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120249753997080789',
  titulo: '🎓 Diploma Internacional de Inteligencia y Contrainteligencia',
  anuncio: 'flyer principal',
  campana: '[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú',
};

/** El mismo hecho, sin nombre todavía: así llega el 60 %. */
const ORIGEN_DE_RAFAEL: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120253750387870341',
  titulo: 'La política no se improvisa. Se planifica.',
};

const CASOS: { fila: Conversacion; resuelto: OrigenCrudo | null; nota: string; real: boolean }[] = [
  {
    fila: fila({
      persona_id: '51913750960',
      persona_nombre: 'LUIS LOPEZ LOARTE',
      numero_propio: '51970356062',
      texto: 'Buenas tardes, quisiera información',
      origen_anuncio: { fuente: 'anuncio', adId: ORIGEN_DE_LUIS.adId!, titulo: ORIGEN_DE_LUIS.titulo },
      n: 2,
      sin_leer: 1,
      no_leido: true,
    }),
    resuelto: ORIGEN_DE_LUIS,
    nota: 'ANUNCIO, resuelto contra Meta — 1.303 personas (40 % de los leads de pauta)',
    real: true,
  },
  {
    fila: fila({
      persona_id: '59171888979',
      persona_nombre: 'Rafael',
      numero_propio: '59178814740',
      texto: 'Hola',
      origen_anuncio: { fuente: 'anuncio', adId: ORIGEN_DE_RAFAEL.adId!, titulo: ORIGEN_DE_RAFAEL.titulo },
      n: 1,
      sin_leer: 1,
      no_leido: true,
    }),
    resuelto: ORIGEN_DE_RAFAEL,
    nota: 'ANUNCIO, sin resolver — 1.954 personas (60 %). La fila dice lo mismo; el titular y el ad_id están en el tooltip y en la ficha',
    real: true,
  },
  {
    fila: fila({
      persona_id: '5215521440000',
      persona_nombre: 'Ing. Mario Sánchez',
      numero_propio: '5215610584485',
      texto: 'si seguí tu anuncio en Facebook deberías saber qué necesito',
      n: 8,
      sin_leer: 4,
      no_leido: true,
    }),
    resuelto: null,
    nota: 'SIN ORIGEN — el caso del 6-sep. Antes de este frente, esta fila era muda en este punto',
    real: true,
  },
  {
    fila: fila({
      persona_id: '51955000111',
      persona_nombre: '(caso construido)',
      texto: 'Hola, me interesa el diplomado [clandestinas]',
      ultima_origen: { fuente: 'landing', ref: 'clandestinas' },
    }),
    resuelto: { fuente: 'landing', ref: 'clandestinas' },
    nota: '⚠️ LANDING — NO ES UN CASO REAL: producción tiene 0 filas de landing en toda su historia. Se dibuja con la forma que escribe el detector',
    real: false,
  },
  {
    fila: fila({
      clave: 'int:9001',
      canal: 'facebook',
      tipo: 'comentario',
      persona_id: '77001',
      persona_nombre: 'Ana Ruiz',
      numero_propio: null,
      texto: 'Precio?',
      contexto_texto: 'Diplomado en Inteligencia 27',
    }),
    resuelto: null,
    nota: 'COMENTARIO — a propósito SIN píldora: su origen es la publicación, y la fila ya la dice abajo con «en “…”»',
    real: true,
  },
];

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[980px] space-y-6">
        <header className="space-y-2">
          <h1 className="text-lg font-bold text-foreground">
            El origen del lead, siempre visible — evidencia (7-sep-2026)
          </h1>
          <p className="max-w-[760px] text-sm text-muted-foreground">
            Valores reales de producción, leídos por SSH en sólo lectura. Izquierda: la fila de la cola,
            donde el origen es un estado en dos palabras porque el ancho no da para más y el chip de
            curso ya dice el producto. Derecha: la cabecera de la ficha, donde sí entra el nombre del
            anuncio y su campaña. El <strong>tooltip</strong> de las dos superficies dice el porqué —
            pasa el mouse por encima.
          </p>
          <p className="max-w-[760px] rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <strong>Lo medido:</strong> 3.257 personas llegaron por un anuncio y <strong>1.954 (60 %)</strong>{' '}
            traen un <code>ad_id</code> que Meta todavía no resolvió — las 1.954 traen titular, el 100 %.
            De las 11.016 personas que escribieron en 90 días, la enorme mayoría no tiene origen
            registrado: por eso «Sin origen» tiene que <em>decirse</em>, no callarse.{' '}
            <strong>«Landing» nunca ocurrió</strong>: 0 filas en toda la historia de <code>events</code>.
          </p>
        </header>

        {CASOS.map(({ fila: c, resuelto, nota, real }) => {
          const origen = deDondeVino({
            tipo: c.tipo,
            canal: c.canal,
            origen_anuncio: c.origen_anuncio,
            ultima_origen: c.ultima_origen,
            resuelto,
          });
          return (
            <section key={c.clave} className="space-y-2">
              <p
                className={
                  'text-[11px] font-semibold uppercase tracking-wide ' +
                  (real ? 'text-muted-foreground' : 'text-destructive')
                }
              >
                {nota}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <FilaConversacion c={c} indice={0} seleccionada={false} onAbrir={() => {}} />
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {/* La MISMA función que usa `PanelDerecho`: la galería no puede
                      verse bien con la app mal, porque no calcula nada por su cuenta. */}
                  <EncabezadoTimeline
                    nombre={c.persona_nombre ?? 'Sin nombre'}
                    telefono={c.persona_id ?? ''}
                    canal={c.canal}
                    tipoDeFila={c.tipo}
                    acento="neutro"
                    tituloEstado=""
                    compras={null}
                    chips={[]}
                    meta={metaDelContacto(origen, null)}
                    resumenIa={null}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
