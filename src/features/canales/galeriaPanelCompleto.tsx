import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Lock, MessageCircle, Send } from 'lucide-react';
import '../../index.css';
import { AdjuntoDelComentario, PublicacionOriginal } from './ContextoDelComentario';
import { ContenidoDelComentario } from './ContenidoDelComentario';
import AccionesDelComentario from './AccionesDelComentario';
import { porQueNoPuedePrivado, type Capacidades } from './puedeEscribirPrivado';
import { sectionLabel } from '../../lib/styles';

/**
 * CÓMO SE VE EL PANEL CON META CONECTADO — la maqueta, no la app.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-panel-completo.html
 *
 * ══ 🔴 POR QUÉ ESTO EXISTE, Y QUÉ NO ES ═════════════════════════════════════
 *
 * En una máquina de trabajo **este panel no se puede ver entero**: la imagen del
 * post, el avatar, la fecha y el adjunto del comentario los trae Meta EN VIVO, y
 * sin token de Página el server contesta `degradado: true`. Y no es que falte
 * configurar algo: esas URLs no se guardan **a propósito**, porque las del CDN
 * de Facebook vencen (`oe=`/`oh=`) y guardarlas daría imágenes rotas a los pocos
 * días, sin error y sin que nadie sepa si el comentario tenía algo.
 *
 * ⚠️ **Esto es una MAQUETA y hay que leerla como tal.** Los componentes son los
 * de verdad —los mismos que renderiza `ResponderPanel`— pero los datos están
 * escritos acá con la forma que Meta devuelve. Sirve para juzgar la composición
 * antes de tener el token; **no prueba que la integración funcione**. Eso se ve
 * en el entorno de pruebas y en ningún otro lado.
 *
 * Las imágenes son SVG embebidos porque las del CDN ya vencieron: un ícono de
 * imagen rota no deja juzgar el encuadre, que es lo único que hay que juzgar.
 */

/**
 * DESCARGAR, SIN SERVER: `/api/comentario/:id/imagen` contesta con la misma
 * imagen dibujada, y lo que se «guarda» queda en `window.__descargas` en vez de ir
 * a la carpeta de Descargas. Lo que se prueba es el cableado del botón —que pida
 * a Hermes y guarde con la extensión de lo que llegó—, no a Meta.
 *
 * ⚠️ **El `content-type` es el que manda el CDN de Meta, no el del dibujo**: jpeg la
 * publicación, gif la reacción. Con `image/svg+xml` —lo que el dibujo es— se
 * guardaba SIN extensión, porque Meta nunca lo manda y `descargarArchivo.ts` no lo
 * conoce: la galería mostraba lo contrario de lo que dice probar (candado 10).
 */
const fetchOriginal = window.fetch.bind(window);
window.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (url.includes('/api/comentario/')) {
    const [de, tipo] = url.includes('de=post') ? [piezaDeCampana, 'image/jpeg'] : [gifDeReaccion, 'image/gif'];
    return new Response(decodeURIComponent(de.split(',')[1]), { status: 200, headers: { 'content-type': tipo } });
  }
  return fetchOriginal(entrada, init);
}) as typeof fetch;
const descargas: string[] = [];
(window as unknown as { __descargas: string[] }).__descargas = descargas;
const clicOriginal = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  if (this.download) {
    descargas.push(this.download);
    return;
  }
  clicOriginal.call(this);
};

const svg = (cuerpo: string, w: number, h: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${cuerpo}</svg>`);

const piezaDeCampana = svg(
  `<rect width="640" height="360" fill="#0E2A52"/>
   <rect x="0" y="0" width="640" height="70" fill="#F2C230"/>
   <text x="24" y="50" fill="#0E2A52" font-family="sans-serif" font-size="34" font-weight="bold">¡ÁNCASH MERECE LO BUENO!</text>
   <circle cx="150" cy="220" r="70" fill="#123B6D"/>
   <text x="150" y="315" fill="#ffffff" font-family="sans-serif" font-size="20" text-anchor="middle">Betto Barrionuevo</text>
   <text x="330" y="180" fill="#ffffff" font-family="sans-serif" font-size="22">Obras que permanezcan</text>
   <text x="330" y="215" fill="#ffffff" font-family="sans-serif" font-size="22">y un futuro seguro</text>`,
  640,
  360,
);

const avatarPagina = svg(
  `<rect width="64" height="64" fill="#123B6D"/>
   <text x="50%" y="60%" fill="#F2C230" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle">BB</text>`,
  64,
  64,
);

/** Un GIF de reacción, que es lo que llega como `attachment` de un comentario. */
const gifDeReaccion = svg(
  `<rect width="320" height="240" fill="#B91C1C"/>
   <circle cx="160" cy="95" r="46" fill="#111827"/>
   <text x="160" y="180" fill="#ffffff" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">VICTORY!</text>
   <text x="160" y="212" fill="#FCA5A5" font-family="sans-serif" font-size="15" text-anchor="middle">GIF</text>`,
  320,
  240,
);

const POST = {
  texto:
    '🔵 Áncash merece lo bueno, no más de lo mismo. ❌\n\n' +
    'Merecemos obras que permanezcan y un futuro seguro para nuestras familias. 💪\n' +
    'Sigamos recorriendo cada rincón de nuestra región.\n' +
    '¿Cuál debería ser nuestro próximo destino?\n\n' +
    '#BettoBarrionuevo #PodemosPerú #Áncash',
  imagen: piezaDeCampana,
  enlace: 'https://facebook.com/x',
  autor: 'Betto Barrionuevo',
  avatar: avatarPagina,
  publicadoEn: '2026-05-08T15:30:00+0000',
};

const ADJUNTO = {
  imagen: gifDeReaccion,
  ancho: 320,
  alto: 240,
  enlace: 'https://giphy.com/x',
  titulo: null,
};

const FILETE = 'border-l-primary';

/** El panel, tal como lo compone `ResponderPanel`. */
/**
 * ⚠️ **`cap` ENTRA COMO PROP en vez de estar escrita adentro.** La maqueta servía
 * un solo estado —privado abierto, comentario de 2 días— y con eso los dos avisos
 * de la ventana de 7 días **no se dibujaban nunca**: la cuenta regresiva pide 2
 * días o menos RESTANTES (o sea `dias >= 5`) y el de cierre pide el privado
 * cerrado. Una galería que sólo sirve el caso cómodo no es evidencia de nada.
 */
function Panel({
  titulo,
  textoDelComentario,
  conAdjunto,
  cap = { puedePrivado: true, motivo: null, dias: 2 },
  antiguedad = 'hace 7 días',
}: {
  titulo: string;
  textoDelComentario: string | null;
  conAdjunto?: boolean;
  cap?: Capacidades;
  antiguedad?: string;
}) {
  const [publico, setPublico] = useState(
    '¡Hola! Te acabamos de escribir por mensaje privado con toda la información 📩',
  );
  const [privado, setPrivado] = useState('');
  const cajaPublica = useRef<HTMLTextAreaElement>(null);
  const cajaPrivada = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-[11px] bg-secondary font-heading text-xs font-bold text-navy-ink">
          JL
        </div>
        <div className="min-w-0">
          <div className="truncate font-heading text-sm font-bold text-foreground">{titulo}</div>
          <div className="text-xs text-muted-foreground">Facebook · {antiguedad}</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <PublicacionOriginal post={POST} interactionId={1} />

        <section>
          <h3 className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Comentario de {titulo}</span>
            <span className="font-normal normal-case tracking-normal">{antiguedad}</span>
          </h3>
          <ContenidoDelComentario texto={textoDelComentario} fileteCanal={FILETE} />
          {conAdjunto && <AdjuntoDelComentario adjunto={ADJUNTO} interactionId={1} />}
          <a
            href="https://facebook.com/x"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            Ver este comentario en Facebook
          </a>
        </section>

        <AccionesDelComentario
          interactionId={1}
          estado={{ can_hide: true, is_hidden: false, can_remove: true }}
          cargando={false}
          cap={cap}
          onEscribirPublico={() => cajaPublica.current?.focus()}
          onEscribirPrivado={() => cajaPrivada.current?.focus()}
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
              <MessageCircle size={12} /> Respuesta pública
            </span>
            <textarea
              ref={cajaPublica}
              value={publico}
              onChange={(e) => setPublico(e.target.value)}
              className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <span className="text-[11px] leading-snug text-muted-foreground">
              Todos podrán verla en la publicación.
            </span>
          </label>

          {/*
            ⚠️ **La caja privada se APAGA como en la pantalla real.** Servirla
            siempre habilitada convertía la maqueta en una mentira justo en el
            caso que vino a mostrar: en `ResponderPanel` esta caja lleva
            `disabled={!puedePrivado}` y su placeholder dice el motivo. Una
            galería que sólo sabe dibujar el caso cómodo ya escondió tres
            defectos una vez en este repo.
          */}
          <label className={'flex min-w-0 flex-col gap-1.5 ' + (cap.puedePrivado ? '' : 'opacity-40')}>
            <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
              <Lock size={12} /> Respuesta privada
              <span className="rounded-full bg-secondary px-1.5 py-px font-normal normal-case tracking-normal text-secondary-foreground">
                por Messenger
              </span>
            </span>
            <textarea
              ref={cajaPrivada}
              value={privado}
              onChange={(e) => setPrivado(e.target.value)}
              disabled={!cap.puedePrivado}
              placeholder={
                cap.puedePrivado
                  ? 'La información de verdad va acá: fecha, lugar, precio, cómo inscribirse…'
                  : porQueNoPuedePrivado(cap)
              }
              className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <span className="text-[11px] leading-snug text-muted-foreground">
              No será visible en la publicación.
            </span>
          </label>
        </div>
      </div>

      {/* El pie compacto de una línea, igual que `ResponderPanel`: ~56 px. */}
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2.5">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Se envía solo a esta persona. Puedes borrarlo después.
        </p>
        <button
          type="button"
          aria-label="Enviar la respuesta a esta persona"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          <Send size={14} /> Enviar
        </button>
      </footer>
    </div>
  );
}

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        El panel con Meta conectado — maqueta
      </h1>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Los componentes son los de verdad; los datos están escritos acá con la forma que Meta
        devuelve. <strong className="text-foreground">Sirve para juzgar la composición, no para
        probar la integración</strong> — eso se ve en el entorno de pruebas, con el token de la
        Página.
      </p>

      <div className="mt-8 grid gap-8 2xl:grid-cols-2">
        <section>
          <h2 className="mb-2 font-heading text-sm font-bold text-foreground">
            Comentario de texto — el caso más común
          </h2>
          <div className="h-[860px] max-w-[820px]">
            <Panel titulo="Julian Loyola" textoDelComentario="Betto tú sí me das confianza!!! Todo el apoyo desde Chimbote" />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-sm font-bold text-foreground">
            Comentario con GIF — el que antes se veía vacío
          </h2>
          <div className="h-[860px] max-w-[820px]">
            <Panel titulo="Julian Loyola" textoDelComentario="" conAdjunto />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-sm font-bold text-foreground">
            A un día del cierre — la cuenta regresiva
          </h2>
          <div className="h-[860px] max-w-[820px]">
            <Panel
              titulo="Julian Loyola"
              textoDelComentario="¿Cuánto cuesta el diplomado? Me interesa"
              antiguedad="hace 6 días"
              cap={{ puedePrivado: true, motivo: null, dias: 6 }}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-sm font-bold text-foreground">
            Ventana cerrada — ya no se le puede escribir en privado
          </h2>
          <div className="h-[860px] max-w-[820px]">
            <Panel
              titulo="Julian Loyola"
              textoDelComentario="¿Cuánto cuesta el diplomado? Me interesa"
              antiguedad="hace 9 días"
              cap={{ puedePrivado: false, motivo: 'ventana-cerrada', dias: 9 }}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-sm font-bold text-foreground">
            No acepta mensajes de páginas — dentro del plazo y aun así apagado
          </h2>
          <div className="h-[860px] max-w-[820px]">
            <Panel
              titulo="Julian Loyola"
              textoDelComentario="¿Cuánto cuesta el diplomado? Me interesa"
              antiguedad="hace 1 día"
              cap={{ puedePrivado: false, motivo: 'privacidad', dias: 1 }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
