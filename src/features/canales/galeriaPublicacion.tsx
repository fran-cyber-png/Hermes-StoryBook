import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { PublicacionOriginal } from './ContextoDelComentario';

/**
 * LA GALERÍA DE «PUBLICACIÓN ORIGINAL» — fases 2 y 3 del rediseño de comentarios.
 *
 * Entry APARTE de Vite (`galeria-publicacion.html`): **no entra al bundle de la
 * app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-publicacion.html
 *
 * ══ POR QUÉ HACE FALTA, HABIENDO TESTS ══════════════════════════════════════
 *
 * Esta tarjeta se alimenta EN VIVO de Meta (`/api/comentario/:id/contexto`), y
 * las URLs del CDN de Facebook vencen — por eso el server no las guarda. O sea
 * que en una máquina de trabajo la tarjeta **no se puede ver con datos reales**:
 * sin token de Página no hay respuesta, y la URL del fixture ya venció.
 *
 * ⚠️ **Los textos son los MEDIDOS, no inventados** (candado #10: una galería con
 * datos lindos ya escondió tres defectos). Salen del payload real que está en
 * `server/src/moderacion/contextoDelComentario.test.ts` — el post del sector
 * pesquero, con su bloque de hashtags y sus emojis.
 *
 * ⚠️ **Las imágenes son SVG embebidos y no las del CDN**, justamente porque las
 * de Meta vencen: una galería que muestra un ícono de imagen rota no deja juzgar
 * el encuadre, que es lo único que esta pieza necesita que se juzgue.
 */

/** Un placeholder con la proporción típica de una pieza de campaña (16:9). */
const imagenAncha =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
       <rect width="640" height="360" fill="#0E2A52"/>
       <text x="50%" y="46%" fill="#F2C230" font-family="sans-serif" font-size="46" font-weight="bold" text-anchor="middle">¡ÁNCASH!</text>
       <text x="50%" y="62%" fill="#ffffff" font-family="sans-serif" font-size="24" text-anchor="middle">merece lo bueno</text>
     </svg>`,
  );

/** Y una VERTICAL, que es donde `object-cover` le cortaría la cara al candidato. */
const imagenAlta =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640">
       <rect width="360" height="640" fill="#123B6D"/>
       <circle cx="180" cy="200" r="90" fill="#F2C230"/>
       <text x="50%" y="70%" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">AFICHE</text>
       <text x="50%" y="78%" fill="#ffffff" font-family="sans-serif" font-size="20" text-anchor="middle">vertical 9:16</text>
     </svg>`,
  );

const avatar =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
       <rect width="64" height="64" fill="#123B6D"/>
       <text x="50%" y="60%" fill="#ffffff" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle">BB</text>
     </svg>`,
  );

/** El texto real del fixture del server, con sus emojis y su bloque de hashtags. */
const TEXTO_REAL =
  '#GranRespaldo | 🐟El sector pesquero artesanal ya decidió 🅿️ y trabajaremos juntos por generar trabajo y bienestar para los hombres del mar💪';

const TEXTO_LARGO =
  '🔵 Áncash merece lo bueno, no más de lo mismo. ❌\n\n' +
  'Merecemos obras que permanezcan y un futuro seguro para nuestras familias. 💪\n' +
  'Sigamos recorriendo cada rincón de nuestra región, escuchando a la gente que ' +
  'nunca fue escuchada y comprometiéndonos con soluciones que se puedan medir. ' +
  '¿Cuál debería ser nuestro próximo destino? Coméntanos acá abajo y vamos.\n\n' +
  '#BettoBarrionuevo #PodemosPerú #Áncash #GranRespaldo #TrabajoParaTodos';

const CASOS: { titulo: string; nota: string; post: Parameters<typeof PublicacionOriginal>[0]['post'] }[] = [
  {
    titulo: 'El caso completo',
    nota: 'Autor, avatar, fecha, imagen apaisada y texto corto. Es lo que se ve el 90 % de las veces.',
    post: {
      texto: TEXTO_REAL,
      imagen: imagenAncha,
      enlace: 'https://facebook.com/x',
      autor: 'Betto Barrionuevo',
      avatar,
      publicadoEn: '2026-05-08T15:30:00+0000',
    },
  },
  {
    titulo: 'Texto largo — el corte de «Ver más»',
    nota: 'Pasa los 280 caracteres, así que se corta justo antes del bloque de hashtags, que es donde deja de haber información.',
    post: {
      texto: TEXTO_LARGO,
      imagen: imagenAncha,
      enlace: 'https://facebook.com/x',
      autor: 'Betto Barrionuevo',
      avatar,
      publicadoEn: '2026-05-08T15:30:00+0000',
    },
  },
  {
    titulo: '🔴 Imagen VERTICAL — por qué es `object-contain`',
    nota: 'Un afiche 9:16. Con `object-cover` acá se le corta la cara al candidato, que en una pieza de campaña ES el mensaje. Se paga con bandas laterales.',
    post: {
      texto: TEXTO_REAL,
      imagen: imagenAlta,
      enlace: 'https://facebook.com/x',
      autor: 'Betto Barrionuevo',
      avatar,
      publicadoEn: '2026-05-08T15:30:00+0000',
    },
  },
  {
    titulo: 'Server viejo — sin autor ni fecha',
    nota: 'N4 sale antes que N5: `autor`, `avatar` y `publicadoEn` llegan ausentes y la cabecera simplemente no se dibuja. La tarjeta pierde el nombre, no el contenido.',
    post: { texto: TEXTO_REAL, imagen: imagenAncha, enlace: 'https://facebook.com/x' },
  },
  {
    titulo: 'Sólo texto',
    nota: 'Un post sin imagen. El texto ocupa el ancho entero en vez de dejar media tarjeta vacía.',
    post: {
      texto: TEXTO_REAL,
      imagen: null,
      enlace: 'https://facebook.com/x',
      autor: 'Betto Barrionuevo',
      avatar,
      publicadoEn: '2026-05-08T15:30:00+0000',
    },
  },
  {
    titulo: 'Sólo imagen',
    nota: 'Pasa con las piezas que no llevan copy. Sin texto no se dibuja el hueco.',
    post: {
      texto: null,
      imagen: imagenAncha,
      enlace: 'https://facebook.com/x',
      autor: 'Betto Barrionuevo',
      avatar,
      publicadoEn: '2026-05-08T15:30:00+0000',
    },
  },
];

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Publicación original — fases 2 y 3
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        La imagen va a la izquierda y el texto a la derecha (no apilados): apilados, la imagen empuja
        el comentario fuera de la pantalla, que es lo que la fase 11 viene a evitar. Y hay un solo
        «Ver en Facebook», adentro de la tarjeta.
      </p>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        {CASOS.map((c) => (
          <section key={c.titulo}>
            <h2 className="font-heading text-sm font-bold text-foreground">{c.titulo}</h2>
            <p className="mb-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{c.nota}</p>
            {/* 520 px es el ancho real de la columna central en 1440. */}
            <div className="max-w-[520px]">
              <PublicacionOriginal post={c.post} />
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
