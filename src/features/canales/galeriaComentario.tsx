import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { AvisoDeOculto, ContenidoDelComentario } from './ContenidoDelComentario';

/**
 * LOS TIPOS DE COMENTARIO — fases 5 y 14 del rediseño.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-comentario.html
 *
 * ══ POR QUÉ SE MIRAN JUNTOS ═════════════════════════════════════════════════
 *
 * `dominio/comentario.test.ts` prueba la CLASIFICACIÓN y no puede ver lo único
 * que importa acá: si los emojis grandes conviven con una burbuja de texto sin
 * que la tarjeta salte de alto, y si el tope de ocho se nota. Eso se juzga de un
 * vistazo o no se juzga.
 *
 * ⚠️ Los textos son de comentarios REALES de la campaña (los del sembrado y los
 * de las capturas del dueño), no inventados — candado #10.
 */
const FILETE = 'border-l-primary';

const CASOS: { titulo: string; nota: string; texto: string | null }[] = [
  {
    titulo: 'Texto',
    nota: 'Burbuja, como en Facebook. Antes era una cita con comilla gigante: elegante y ajena a lo que la persona mira.',
    texto: 'Betto tú sí me das confianza!!! Todo el apoyo desde Chimbote',
  },
  {
    titulo: 'Texto corto',
    nota: 'La mayoría de los comentarios de campaña son así de cortos.',
    texto: 'Bendiciones',
  },
  {
    titulo: '🔴 Sólo emojis',
    nota: 'Grandes y sin burbuja, como Messenger. En cuerpo 16 alineados a la izquierda se leen como un error de renderizado.',
    texto: '👏👏👏',
  },
  {
    titulo: 'Un solo emoji',
    nota: 'El caso más común de todos en una publicación de campaña.',
    texto: '❤️',
  },
  {
    titulo: '🔴 Emoji compuesto',
    nota: 'Bandera (dos letras regionales, CERO pictogramas) y pulgar con tono de piel. Una implementación ingenua los manda a «texto».',
    texto: '🇵🇪 👍🏽',
  },
  {
    titulo: '🔴 Ristra larga — el tope de ocho',
    nota: 'Pasado el tope se dibuja como texto normal: en cuerpo 40 rompería el alto que la fase 11 pide cuidar.',
    texto: '😂😂😂😂😂😂😂😂😂😂😂😂',
  },
  {
    titulo: 'Texto + emoji',
    nota: 'Hay algo que leer, así que va en burbuja y los emojis quedan a su tamaño.',
    texto: '¡Excelente propuesta! 👏 Cuenten conmigo 💪',
  },
  {
    titulo: '🔴 Un número NO es un emoji',
    nota: 'Unicode dice que los dígitos son `Emoji` (son la base de `1️⃣`). Con la propiedad ingenua, un «2» se dibujaría gigante y centrado.',
    texto: '2',
  },
  {
    titulo: 'Con saltos de línea',
    nota: 'Se respetan: sin `pre-line` se pegan frases que la persona separó a propósito.',
    texto: 'Excelente\nCuenten con mi voto\nY el de mi familia',
  },
  {
    titulo: 'Vacío — el sticker',
    nota: 'Meta manda `message: ""` y el contenido vive en el adjunto. Acá no se dibuja nada: lo pone `AdjuntoDelComentario`.',
    texto: '',
  },
];

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Tipos de comentario — fases 5 y 14
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        La UI detecta de qué está hecho el comentario y adapta la presentación. La regla es pura
        (`dominio/comentario.ts`); esto es lo único que esa regla no puede mostrar.
      </p>

      <h2 className="mt-8 font-heading text-sm font-bold text-foreground">Comentario oculto</h2>
      <p className="mb-2 max-w-xl text-xs text-muted-foreground">
        Va arriba del contenido y no en las acciones: es un hecho sobre el comentario, y pudo
        ocultarlo alguien desde el celular sin que Hermes lo viera pasar.
      </p>
      <div className="max-w-[520px]">
        <AvisoDeOculto />
        <ContenidoDelComentario texto="Betto tú sí me das confianza!!!" fileteCanal={FILETE} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {CASOS.map((c) => (
          <section key={c.titulo}>
            <h2 className="font-heading text-sm font-bold text-foreground">{c.titulo}</h2>
            <p className="mb-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{c.nota}</p>
            <div className="max-w-[520px] rounded-xl border border-dashed border-border p-2">
              <ContenidoDelComentario texto={c.texto} fileteCanal={FILETE} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <Galeria />
  </StrictMode>,
);
