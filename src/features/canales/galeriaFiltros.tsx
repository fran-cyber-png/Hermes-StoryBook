import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { arrancarTema } from '../../lib/tema';
import { queryClient } from '../../lib/datos/cliente';
import { AvisoFilaQueBajo } from './AvisoFilaQueBajo';
import { BarraFiltros } from './BarraFiltros';
import { FilaConversacion } from './FilaConversacion';
import type { FiltroSec } from '../../dominio/cola';
import type { Conversacion } from '../../dominio/conversaciones';
import type { LineaWhatsapp } from '../../dominio/lineas';

/**
 * LA GALERÍA DE LOS FILTROS DE LA COLA — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-filtros.html
 *
 * ⚠️ **Todos los textos y todos los números de acá salieron de producción**
 * (censo del 11-ago-2026 sobre 3.995 conversaciones). No es un detalle de
 * prolijidad: la galería anterior de un frente de la cola mostraba el caso ideal
 * y por eso **no reflejó ninguno de los tres defectos que producción tenía a la
 * vista**. Una galería que no sirve los valores reales no es evidencia.
 *
 * Lo que hay que poder ver de una:
 *
 *  1. **La barra tiene tres chips, no cinco.** Se retiraron «Piden info» (mentía)
 *     y «Sin responder» (505 filas, el 93 % de más de una semana); «Ya compraron»
 *     (1.082, el 27 % de la mesa) dejó de ser filtro y sigue siendo la píldora de
 *     la fila.
 *  2. **La fila de un clic de anuncio ya no finge una pregunta.** Es el cambio
 *     que más se nota: 563 filas dejan de decir «Hola Quiero más información
 *     del Diploma…» y pasan a decir «📣 Vino del anuncio».
 *  3. **«Preguntó precio» y «Preguntó» son dos rótulos distintos**, porque son
 *     dos trabajos distintos.
 */

const AHORA = Date.now();
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:51986394450`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51986394450',
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: false,
    n: 1,
    referencia: haceHoras(3),
    ultimo_at: haceHoras(3),
    dias: 0,
    nivel: 3,
    ...over,
  };
}

/** El texto EXACTO que WhatsApp prellena. 424 conversaciones lo tienen igual. */
const TEXTO_DEL_ANUNCIO = 'Hola Quiero más información del Diploma de Inteligencia y Contrainteligencia';

const CASOS: { rotulo: string; nota: string; c: Conversacion }[] = [
  {
    rotulo: 'Solo hizo clic en el anuncio',
    nota:
      '563 filas (14 % de la mesa). El texto lo escribió Meta: hay que ABRIR la conversación, no responderla. ' +
      'De qué programa se trata NO se pierde — lo dice el chip de curso, que sale del anuncio (#72).',
    c: fila({
      persona_id: '51987654321',
      persona_nombre: 'Rosa M.',
      texto: TEXTO_DEL_ANUNCIO,
      solo_clic: true,
      origen_anuncio: { fuente: 'anuncio', titulo: 'Diploma de Inteligencia y Contrainteligencia' },
      ultima_origen: { fuente: 'anuncio', titulo: 'Diploma de Inteligencia y Contrainteligencia' },
      nivel: 3,
    }),
  },
  {
    rotulo: 'Preguntó precio',
    nota:
      '65 en 30 días. Nombró plata: entra al chip esté contestada o no. ⚠️ Este texto es real pero NO es un lead: es Walter probando el bot.',
    c: fila({
      persona_id: '51912345678',
      persona_nombre: 'Luis Ángel',
      texto: 'Pásame la cotización urgentemente quiero comprar ahora mismo',
      pregunto: true,
      pregunto_precio: true,
      nivel: 0,
    }),
  },
  {
    rotulo: 'Preguntó precio — y ya le contestamos',
    nota: 'El seguimiento: preguntó, recibió el número y se calló. ADR 0044 midió 540 así. El chip NO la filtra.',
    c: fila({
      persona_id: '51911223344',
      persona_nombre: 'Marisol',
      texto: 'Cuantas cuotas?',
      pregunto: true,
      pregunto_precio: true,
      respondida: true,
      precio_enviado: true,
      n: 6,
      nivel: 4,
      referencia: haceHoras(52),
      ultimo_at: haceHoras(52),
    }),
  },
  {
    rotulo: 'Preguntó (sin plata)',
    nota: 'Un sustantivo concreto le gana al veto del anuncio: lo escribió la persona.',
    c: fila({
      persona_id: '51955667788',
      persona_nombre: 'Jorge',
      texto: 'Cuales son los requisitos ?',
      pregunto: true,
      nivel: 3,
    }),
  },
  {
    rotulo: 'Se está despidiendo — el predicado viejo la contaba como pedido',
    nota: '«informaci» la enganchaba igual. Hoy no dibuja nada.',
    c: fila({
      persona_id: '51999887766',
      persona_nombre: 'Ana Lucía',
      texto: 'Muchas gracias por la información. Talvez en otra ocasión. Buenas tardes!',
      respondida: true,
      nivel: 5,
      referencia: haceHoras(30),
      ultimo_at: haceHoras(30),
    }),
  },
  {
    rotulo: 'La autorespuesta de OTRO negocio',
    nota: 'Vuelve al escribirle a un número de empresa. No es un lead pidiendo nada.',
    c: fila({
      persona_id: '51933445566',
      persona_nombre: 'Jasper Desing',
      texto: 'Gracias por comunicarte con Jasper Desing. ¿Cómo podemos ayudarte? 😀',
      nivel: 5,
      referencia: haceHoras(12),
      ultimo_at: haceHoras(12),
    }),
  },
];

/**
 * ══ LOS SEIS ORÍGENES, UNO AL LADO DEL OTRO ═════════════════════════════════
 *
 * 🔴 Hasta el 22-ago-2026 esta galería servía **seis filas de WhatsApp**, así
 * que el defecto que estos casos muestran no se podía ver acá: un comentario
 * público de Instagram y un mensaje directo de Instagram se dibujaban IGUAL
 * —mismo color, mismo nombre— y son dos trabajos opuestos. Al directo se le
 * contesta en privado; el comentario lo lee cualquiera que pase por el post.
 *
 * ⚠️ **Acá no hay conteos**, al revés que en el resto del archivo: el censo del
 * 11-ago midió las cuatro líneas de WhatsApp y no cruzó `canal` con `tipo`. Un
 * número inventado en una galería es peor que ninguno — es la regla que este
 * mismo archivo declara arriba.
 */
const ORIGENES: { rotulo: string; nota: string; c: Conversacion }[] = [
  {
    rotulo: 'WhatsApp — mensaje directo',
    nota:
      'El LOGO dice el canal. Por qué transporte salió (Cloud API o whatsmeow) no se dibuja acá, y es ' +
      'correcto: el transporte es de la LÍNEA, no de la conversación — vive en el selector de arriba, ' +
      'donde decide si se puede editar un enviado y si el plazo de 24 h es duro.\n' +
      '🔴 El globito del conteo va en el VERDE de WhatsApp con tinta NAVY, no blanca: blanco sobre ese verde da ' +
      '1,98:1 y el número no se lee (`BadgeCanal`, con las cuatro mediciones).',
    c: fila({
      persona_id: '51984773311',
      persona_nombre: 'William Ayala Diestra',
      texto: 'Quiero más información sobre el Diploma de Inteligencia y Contrainteligencia',
      pregunto: true,
      n: 5,
      nivel: 3,
    }),
  },
  {
    rotulo: 'Messenger — mensaje directo de Facebook',
    nota:
      'Privado, como el de WhatsApp: se contesta en el hilo y nadie más lo ve. El globito del conteo va en el ' +
      'CELESTE de Messenger (#0084FF), que no es el azul de Facebook — la misma distinción que ya hacía la píldora.',
    c: fila({
      clave: 'conv:facebook:2841193...:goberna',
      canal: 'facebook',
      tipo: 'mensaje',
      persona_id: '2841193776654',
      persona_nombre: 'Carmen Vílchez',
      texto: '¿El diplomado tiene certificado internacional?',
      pregunto: true,
      n: 3,
      nivel: 3,
    }),
  },
  {
    rotulo: 'Comentario de Facebook — PÚBLICO',
    nota:
      '🔴 El directo de arriba es SÓLO el logo; éste le suma la PALABRA. La asimetría es la decisión: el ' +
      'logo dice por dónde ENTRÓ, y «Coment.» dice que la respuesta va al MURO — son dos preguntas, y la ' +
      'segunda es la que sale cara. El ancho se cobra donde hay volumen, no donde hay riesgo.',
    c: fila({
      clave: 'int:884412',
      canal: 'facebook',
      tipo: 'comentario',
      persona_id: '2841193776654',
      persona_nombre: 'Aurelio Ramos',
      texto: 'Y cuánto cuesta? nadie responde acá',
      contexto_texto: 'Últimas vacantes para el Diploma de Inteligencia — inscripciones abiertas',
      pregunto: true,
      pregunto_precio: true,
      n: 2,
      nivel: 0,
    }),
  },
  {
    rotulo: 'Instagram — mensaje directo',
    nota: 'Privado. Antes de este frente se dibujaba IDÉNTICO al comentario de abajo — mismo disco, mismo nombre.',
    c: fila({
      clave: 'conv:instagram:goberna_escuela:goberna',
      canal: 'instagram',
      tipo: 'mensaje',
      persona_id: 'marisol.sanchez',
      persona_nombre: 'Marisol Sánchez',
      texto: 'Hola! me pasas el temario porfa',
      pregunto: true,
      n: 4,
      nivel: 3,
    }),
  },
  {
    rotulo: 'Comentario de Instagram — PÚBLICO',
    nota:
      'Siete comentarios reales quedaron cuatro días sin entregar en agosto (ADR 0042). Cuando entran, tienen ' +
      'que poder distinguirse del directo de un vistazo: la palabra lo dice y el glifo lo repite.',
    c: fila({
      clave: 'int:884517',
      canal: 'instagram',
      tipo: 'comentario',
      persona_id: 'rosa.tineo',
      persona_nombre: 'Rosa Tineo',
      texto: 'Info porfavor 🙏',
      contexto_texto: 'Reel · Cómo se investiga una fuente abierta',
      pregunto: true,
      n: 2,
      nivel: 3,
    }),
  },
  {
    rotulo: 'Formulario — no entró por ninguna red',
    nota:
      '🔴 En la cola esta fila era la ÚNICA sin marca de origen: `landing` no está en el mapa de canales, ' +
      'así que no tenía disco ni píldora. Ahora lleva la suya, con el morado de la casa — el mismo que su chip ' +
      'ya usaba en la tarjeta del Pipeline. Y nadie le escribió nunca: hay que ABRIR el chat en frío.\n' +
      '⚠️ Y es la única fila cuyo globito sigue GRIS: `landing` no tiene color de marca porque no entró por ' +
      'ninguna red, y pintarlo de algo sería afirmar una procedencia que no existe.',
    c: fila({
      clave: 'lead:51955512345',
      canal: 'landing',
      tipo: 'lead',
      numero_propio: null,
      persona_id: '51955512345',
      persona_nombre: 'Elma Tarratas',
      texto: '¡Hola! Completé el formulario y me gustaría obtener más información sobre tu negocio.',
      n: 2,
      nivel: 3,
    }),
  },
];

/** Los conteos REALES del censo del 11-ago-2026 sobre las cuatro líneas. */
const CONTEOS = { preguntoPrecio: 65, teEscribieron: 33, puedoEscribirle: 25, botEscalada: 33, botCaliente: 30 };

/**
 * ⚠️ Las dos primeras se RETIRARON el 11-ago-2026 y quedan acá porque esta
 * galería documenta el censo de esa fecha. Las dos de abajo son las que corren
 * hoy — y llevan transportes DISTINTOS, que es justo lo que el tag del selector
 * viene a decir: `51984429504` sale por Cloud API (plazo de 24 h duro, no se
 * puede editar lo enviado) y `51963139984` por whatsmeow (se puede editar, sin
 * plazo duro).
 */
const LINEAS: LineaWhatsapp[] = [
  { numero: '51986394450', etiqueta: 'Ventas Perú', estado: 'conectado', mias: true, transporte: 'whatsmeow' },
  { numero: '51941654039', etiqueta: 'Walter Ventas', estado: 'conectado', transporte: 'whatsmeow' },
  { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true, transporte: 'cloud-api' },
  { numero: '51963139984', etiqueta: 'Campaña Betto', estado: 'conectado', transporte: 'whatsmeow' },
];

function Galeria() {
  const [filtroSec, setFiltroSec] = useState<FiltroSec>('');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-bold text-navy-ink">Los filtros de la cola</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Censo de producción del 11-ago-2026 · 3.995 conversaciones · los textos y los números son reales.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            La barra — tres chips de recorte, cada uno con su número
          </p>
          <BarraFiltros
            filtroSec={filtroSec}
            onFiltro={setFiltroSec}
            conteos={CONTEOS}
            lineas={LINEAS}
            lineaActiva=""
            onLinea={() => {}}
            hayMias
            categoriaActiva={null}
            onCategoria={() => {}}
            onListas={() => {}}
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            «Le contesto y desaparece» — el aviso, con la misma forma que el pin de orientación
          </p>
          <p className="mb-2 px-1 text-xs text-muted-foreground">
            Contestar mueve la fila del nivel 0/3 (deuda) al 4 (silencio) y, con cientos de filas de
            deuda arriba y páginas de 40, cae fuera de lo cargado. No se reordena: se va de la vista.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <AvisoFilaQueBajo
              aviso={{
                clave: 'conv:whatsapp:51987654321:51986394450',
                texto: 'Le contestaste a Rosa M.: bajó con las que esperan respuesta.',
              }}
              onFijar={() => {}}
            />
          </div>
        </section>

        <section className="space-y-3">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Los seis orígenes — el logo dice el canal, la palabra avisa que es público
          </p>
          {ORIGENES.map(({ rotulo, nota, c }) => (
            <div key={c.clave}>
              <p className="px-1 text-xs font-bold text-navy-ink">{rotulo}</p>
              <p className="mb-1 px-1 text-xs text-muted-foreground">{nota}</p>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <FilaConversacion c={c} seleccionada={false} onAbrir={() => {}} indice={0} />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          {CASOS.map(({ rotulo, nota, c }) => (
            <div key={c.clave}>
              <p className="px-1 text-xs font-bold text-navy-ink">{rotulo}</p>
              <p className="mb-1 px-1 text-xs text-muted-foreground">{nota}</p>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <FilaConversacion c={c} seleccionada={false} onAbrir={() => {}} indice={0} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * ══ 🔴 EL TEMA, ANTES DE MONTAR — SIN ESTO LA GALERÍA NO SE LEE ═════════════
 *
 * Medido acá el 26-ago-2026 con el sistema en oscuro: `--card` valía `#FFFFFF`
 * (el token CLARO) y `--foreground` `#F1F5F9` (el OSCURO). O sea texto casi
 * blanco sobre tarjeta blanca, **1,07:1**: las filas estaban ahí, con su texto
 * en el DOM, y no se veía una letra.
 *
 * No es un color mal elegido: es la mitad de un tema. La paleta oscura vive
 * entera bajo `:root[data-theme="dark"]` y ese atributo lo estampa
 * `arrancarTema()`, que `main.tsx` llama antes de montar React. La media query
 * de `prefers-color-scheme` **no es la paleta**: son los dos únicos tokens que
 * se pintan antes de que corra un byte de JS, para que no haya fogonazo blanco
 * (lo dice el propio `index.css`). Una galería es otro entry: nunca pasaba por
 * `main.tsx`, así que la media query le daba el fondo y la tinta oscuros y el
 * resto de los tokens se quedaba en claro.
 *
 * ⚠️ **Le pasa a las 25 galerías del repo, no sólo a ésta** — ninguna llama a
 * `arrancarTema`. Acá se arregla la que este frente toca; las otras 24 son un
 * frente aparte, y hasta que se haga siguen siendo evidencia ilegible para
 * cualquiera que tenga el sistema en oscuro.
 */
arrancarTema();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
