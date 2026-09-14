import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';
import '../../index.css';

/**
 * EL COMPOSER REAL, SIN SERVER NI BASE — para ver ⌘V con un portapapeles de verdad.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-composer.html
 *
 * Monta `HiloWhatsapp` TAL CUAL lo usa la app (no una maqueta: la galería de
 * `galeria-mensajes-completa` es un dibujo y no sirve para probar un handler).
 * Lo único falso es el `fetch`, pisado acá abajo — así el ⌘V que se prueba es
 * el del navegador, con su `DataTransfer` real, y no un evento sintético.
 *
 * `?revision=1` abre el modo revisión, donde pegar un adjunto se rechaza.
 * `?voz=sintetica` graba una nota de voz con un tono en vez del micrófono.
 * `?descargas=registrar` anota las descargas en `window.__descargas` en vez de guardarlas.
 * `?varita=muda` hace que el bot no tenga nada que sugerir — el caso FEO, que es
 * el que muestra si el aviso se entiende o si parece que la app se colgó. Con
 * `&motivo=sin_cliente` se calla por la línea de campaña sin cliente (#951).
 *
 * ⚠️ **Los tres casos de cita que hay abajo NO son decoración.** En este repo una
 * galería con el caso ideal ya escondió tres defectos (radar de leads, 8-ago), así
 * que acá están el bonito Y los dos feos: la cita a un mensaje que Hermes no tiene
 * (el hueco honesto) y la cita a un adjunto sin texto. Los dos van a ser lo NORMAL
 * las primeras semanas del frente, porque la captura empieza de hoy en adelante.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';

const HACE = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const MENSAJES = [
  { id: 1, direccion: 'entrante', autor: TELEFONO, texto: 'Hola, buenas tardes 👋', occurred_at: HACE(94), external_id: 'e1' },
  { id: 2, direccion: 'entrante', autor: TELEFONO, texto: '¿El diploma de Gestión Pública sigue abierto?', occurred_at: HACE(93), external_id: 'e2' },
  {
    id: 3,
    direccion: 'saliente',
    autor: 'luz',
    texto: '¡Hola Javier! Sí, todavía hay cupos. Te paso el temario.',
    occurred_at: HACE(41),
    external_id: 'e3',
    // Lo que hasta hoy se descartaba: el lead reaccionó y nadie lo veía.
    reacciones: [{ emoji: '👍', nuestra: false }],
    entrega: 'leido',
  },
  // ── LAS IMÁGENES, para el visor (11-sep-2026) ─────────────────────────────
  // Lo que de verdad llega por el chat: el flyer que manda la vendedora, el
  // voucher en captura (con el texto que lo acompaña) y el caso FEO — el voucher
  // fotografiado de costado, que es para lo que existe «Girar». Los nombres son
  // los de producción: `wa-cloud-<id>.jpg` y `nombre` vacío en lo que manda el lead.
  {
    id: 31, direccion: 'saliente', autor: 'luz', texto: 'Te dejo el flyer con las fechas', occurred_at: HACE(40), external_id: 'e31',
    enviado_por: 'centurion:luz.huaman', entrega: 'leido',
    media: { clase: 'imagen', archivo: 'wa-3EB0C4D2A1F9.png', mime: 'image/png', nombre: 'flyer-gestion-publica.png' },
  },
  {
    id: 32, direccion: 'entrante', autor: TELEFONO, texto: 'Ya pagué, te mando el voucher', occurred_at: HACE(15), external_id: 'e32',
    media: { clase: 'imagen', archivo: 'wa-cloud-1873649201.jpg', mime: 'image/jpeg', nombre: null },
  },
  {
    id: 33, direccion: 'entrante', autor: TELEFONO, texto: null, occurred_at: HACE(14), external_id: 'e33',
    media: { clase: 'imagen', archivo: 'wa-cloud-2231907745.jpg', mime: 'image/jpeg', nombre: null },
  },
  { id: 4, direccion: 'entrante', autor: TELEFONO, texto: '¿Me pasas el precio y las formas de pago?', occurred_at: HACE(9), external_id: 'e4',
    // Una reacción NUESTRA se ve distinta: delineada en navy.
    reacciones: [{ emoji: '❤️', nuestra: true }] },
  { id: 5, direccion: 'entrante', autor: TELEFONO, texto: 'Perfecto, gracias', occurred_at: HACE(6), external_id: 'e5',
    reacciones: [{ emoji: '🙌', nuestra: false }, { emoji: '🙌', nuestra: true }] },
  // Los cuatro estados, para poder mirarlos juntos.
  // 🔴 QUIÉN CONTESTÓ (23-ago-2026). Los tres casos que hay que poder distinguir
  // en una línea que atienden 18 personas, y el tercero es el que importa:
  //   · con `enviado_por` → sale el nombre de quien lo mandó desde Hermes
  //   · sin `enviado_por`  → NO se dibuja nada (lo mandaron desde el teléfono,
  //     o es anterior a este frente). Un nombre inventado es peor que un hueco.
  //   · `automatico`       → gana la marca del bot: el `vendedora_id` de ahí es
  //     el del despachador, y dos etiquetas dirían lo mismo dos veces.
  { id: 6, direccion: 'saliente', autor: 'luz', texto: 'Te dejo el link de pago', occurred_at: HACE(4), external_id: 'e6', entrega: 'entregado', enviado_por: 'centurion:job.meneses' },
  { id: 7, direccion: 'saliente', autor: 'luz', texto: '¿Lo pudiste abrir?', occurred_at: HACE(3), external_id: 'e7', entrega: 'enviado', enviado_por: 'ventas10@grupogoberna.com' },
  // ── LOS TRES FALLIDOS, y los tres se leen distinto a propósito ─────────
  // 1 · EL CASO MEDIDO (17-ago-2026): la ventana de 24 h, con el texto REAL que
  //     rebotó. Es el único motivo que apareció en envíos manuales.
  { id: 8, direccion: 'saliente', autor: 'luz', texto: 'Buenas tardes señor Ronald. ¿Aun te encuentras interesado en inscribirte en el foro?', occurred_at: HACE(2), external_id: 'e8', entrega: 'fallido', entregaMotivo: '131047' },
  // 2 · UN CÓDIGO QUE NO ESTÁ EN EL DICCIONARIO: no se inventa una explicación.
  //     El crudo va al hover, que es de donde sale para poder agregarlo.
  { id: 81, direccion: 'saliente', autor: 'luz', texto: 'Te reenvío el comprobante', occurred_at: HACE(2), external_id: 'e81', entrega: 'fallido', entregaMotivo: '133010' },
  // 3 · UN FALLO SIN CÓDIGO: todo lo anterior a la migración 0028 — o sea, lo
  //     mayoritario las primeras semanas. Se comporta como antes del frente.
  { id: 82, direccion: 'saliente', autor: 'luz', texto: 'Quedo atenta a tu respuesta', occurred_at: HACE(2), external_id: 'e82', entrega: 'fallido' },
  // Un mensaje viejo, de antes de este frente: SIN estado. No dibuja nada.
  { id: 9, direccion: 'saliente', autor: 'luz', texto: 'Cualquier cosa me escribes', occurred_at: HACE(1), external_id: 'e9' },
  // ADR 0100: un mensaje ya ELIMINADO de verdad («delete for everyone») —
  // tachado, sin texto ni acciones. `revocadoEnWhatsapp: true`: al lead ya
  // no le queda.
  { id: 91, direccion: 'saliente', autor: 'luz', texto: 'perdón, te mandé el precio equivocado', occurred_at: HACE(1), external_id: 'e91', eliminado: { eliminadoEn: HACE(1), revocadoEnWhatsapp: true } },
  // ADR 0100 §"eliminar el mensaje del lead": un ENTRANTE ya OCULTADO en
  // Hermes — misma burbuja tachada, texto DISTINTO (`revocadoEnWhatsapp:
  // false`, nunca tocó WhatsApp: el lead lo sigue teniendo intacto).
  { id: 92, direccion: 'entrante', autor: TELEFONO, texto: 'oye esto es spam disculpa', occurred_at: HACE(1), external_id: 'e92', eliminado: { eliminadoEn: HACE(1), revocadoEnWhatsapp: false } },

  // ── LAS TRES CITAS, y dos son el caso feo ──────────────────────────────
  // 1 · El caso bonito: responde a un mensaje que Hermes tiene entero.
  {
    id: 10,
    direccion: 'entrante',
    autor: TELEFONO,
    texto: '¿Esas dos cuotas son sin interés?',
    occurred_at: HACE(1),
    external_id: 'e10',
    cita: {
      mensajeExternalId: 'e3',
      texto: '¡Hola Javier! Sí, todavía hay cupos. Te paso el temario.',
      direccion: 'saliente',
      mediaClase: null,
    },
  },
  // 2 · EL HUECO HONESTO: la cita apunta a algo anterior a la captura. Ni autor
  //     ni texto — y el mensaje se dibuja igual, con su tirita puesta.
  {
    id: 11,
    direccion: 'entrante',
    autor: TELEFONO,
    texto: 'me refería a esto que me mandaron la semana pasada',
    occurred_at: HACE(1),
    external_id: 'e11',
    cita: { mensajeExternalId: 'wa:DE_ANTES', texto: null, direccion: null, mediaClase: null },
  },
  // 3 · Una cita a un ADJUNTO sin texto: se nombra por lo que es.
  {
    id: 12,
    direccion: 'saliente',
    autor: 'luz',
    texto: 'Ese es el flyer de la edición de agosto',
    occurred_at: HACE(1),
    external_id: 'e12',
    cita: { mensajeExternalId: 'e0', texto: null, direccion: 'entrante', mediaClase: 'imagen' },
  },
  // ── LA NOTA DE VOZ, y los dos feos al lado del bonito ──────────────────
  // Con duración es la de una línea whatsmeow; SIN duración es la de la Cloud
  // API, que marca `voice` pero no manda los segundos. Y el audio común, para
  // ver que no se confunden: ese no dice «Nota de voz».
  { id: 95, direccion: 'entrante', autor: TELEFONO, texto: null, occurred_at: HACE(1), external_id: 'e95',
    media: { clase: 'audio', archivo: 'galeria-voz-1.ogg', mime: 'audio/ogg; codecs=opus', voz: { segundos: 14 } } },
  { id: 96, direccion: 'entrante', autor: TELEFONO, texto: null, occurred_at: HACE(1), external_id: 'e96',
    media: { clase: 'audio', archivo: 'galeria-voz-2.ogg', mime: 'audio/ogg; codecs=opus', voz: { segundos: null } } },
  { id: 97, direccion: 'saliente', autor: 'luz', texto: null, occurred_at: HACE(1), external_id: 'e97', entrega: 'entregado',
    media: { clase: 'audio', archivo: 'galeria-audio.mp3', mime: 'audio/mpeg', nombre: 'testimonio.mp3' } },
  // ── VER Y GUARDAR UN ADJUNTO: una foto sin nombre (se guarda con uno legible),
  // un PDF (se ve en el visor) y un Excel (no se puede ver: se descarga).
  { id: 98, direccion: 'entrante', autor: TELEFONO, texto: 'Ya pagué, te mando la constancia', occurred_at: HACE(1), external_id: 'e98',
    media: { clase: 'imagen', archivo: 'galeria-voucher.jpg', mime: 'image/jpeg' } },
  { id: 99, direccion: 'saliente', autor: 'luz', texto: null, occurred_at: HACE(1), external_id: 'e99', entrega: 'leido',
    media: { clase: 'documento', archivo: 'galeria-temario.pdf', mime: 'application/pdf', nombre: 'temario-gestion-publica.pdf' } },
  { id: 100, direccion: 'entrante', autor: TELEFONO, texto: null, occurred_at: HACE(1), external_id: 'e100',
    media: { clase: 'documento', archivo: 'galeria-notas.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nombre: 'notas.xlsx' } },
];

/**
 * `?descargas=registrar` — lo que se «descarga» NO se guarda en el disco: queda en
 * `window.__descargas` (nombre y tipo), para mirarlo desde afuera sin llenar la
 * carpeta de Descargas de quien prueba.
 */
if (new URLSearchParams(location.search).get('descargas') === 'registrar') {
  const descargas: { nombre: string; href: string }[] = [];
  (window as unknown as { __descargas: typeof descargas }).__descargas = descargas;
  const clicOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) {
      descargas.push({ nombre: this.download, href: this.href });
      console.info('[galeria] descarga →', this.download);
      return;
    }
    clicOriginal.call(this);
  };
}

/** Una constancia de pago dibujada: la foto de 1×1 no sirve para ver el visor. */
async function voucherDeGaleria(): Promise<Blob> {
  const lienzo = new OffscreenCanvas(900, 1400);
  const g = lienzo.getContext('2d')!;
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, 900, 1400);
  g.fillStyle = '#742284';
  g.fillRect(0, 0, 900, 220);
  g.fillStyle = '#ffffff';
  g.font = 'bold 72px sans-serif';
  g.fillText('¡Yapeaste!', 60, 140);
  g.fillStyle = '#0e2a52';
  g.font = 'bold 110px sans-serif';
  g.fillText('S/ 450', 60, 400);
  g.font = '40px sans-serif';
  ['Goberna Escuela SAC', '11 set. 2026 · 03:42 p. m.', 'Nro. de operación: 04821377', 'Diploma en Gestión Pública'].forEach((linea, i) =>
    g.fillText(linea, 60, 520 + i * 80),
  );
  return lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}

/** Un PDF mínimo de verdad, armado a mano: el visor lo tiene que poder mostrar. */
function temarioDeGaleria(): Blob {
  const contenido =
    'BT /F1 26 Tf 72 760 Td (Temario - Diploma en Gestion Publica) Tj /F1 14 Tf 0 -44 Td (Modulo 1. El Estado y la gestion publica) Tj 0 -24 Td (Modulo 2. Presupuesto por resultados) Tj 0 -24 Td (Modulo 3. Contrataciones del Estado) Tj ET';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objetos.map((cuerpo, i) => {
    const desde = pdf.length;
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return desde;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

/**
 * `?voz=sintetica` — UN MICRÓFONO DE MENTIRA, para grabar sin micrófono.
 *
 * Pisa `getUserMedia` con un tono de Web Audio. Todo lo demás es de verdad: el
 * `MediaRecorder` del navegador, la conversión con ffmpeg.wasm y la request a
 * `/enviar-media`, que se deja en `window.__ultimaNotaDeVoz` para mirarla desde
 * afuera (Playwright) — sin eso no hay forma de saber qué salió.
 */
if (new URLSearchParams(location.search).get('voz') === 'sintetica') {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        const ctx = new AudioContext();
        const tono = ctx.createOscillator();
        const volumen = ctx.createGain();
        // Un tono que sube y baja, para que la onda tenga forma y no sea una raya.
        volumen.gain.setValueAtTime(0.05, ctx.currentTime);
        for (let s = 0; s < 60; s++) volumen.gain.linearRampToValueAtTime(s % 2 ? 0.05 : 0.6, ctx.currentTime + s * 0.5);
        const destino = ctx.createMediaStreamDestination();
        tono.connect(volumen).connect(destino);
        tono.start();
        return destino.stream;
      },
    },
  });
}

/**
 * LA VENTANA DE 24 H, para ver el aviso de arriba de la caja (ADR 0058).
 *
 * `?ventana=cerrada` es el caso que costó dos mensajes el 16-ago-2026;
 * `?ventana=porcerrar` es el que los habría salvado. Sin el parámetro la ventana
 * está holgada y **no se dibuja nada**, que es el estado normal — un aviso
 * permanente dejaría de leerse a la semana.
 *
 * ⚠️ El aviso solo sale en `cloud-api`: con `?whatsmeow=1` desaparece aunque la
 * ventana esté vencida, porque ahí Meta no rechaza nada. Es el veto de ADR 0041
 * y se puede comprobar combinando los dos parámetros.
 */
const HORA_MS = 60 * 60 * 1000;
const VENTANA = new URLSearchParams(location.search).get('ventana');
const VENTANA_CIERRA = new Date(
  Date.now() + (VENTANA === 'cerrada' ? -4 * HORA_MS : VENTANA === 'porcerrar' ? 1.5 * HORA_MS : 18 * HORA_MS),
).toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  ventana_cierra: VENTANA_CIERRA,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Javier Quispe',
  numero_propio: NUMERO_PROPIO,
  texto: '¿Me pasas el temario y el precio?',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: true,
  n: 4,
  referencia: 'r1',
  ultimo_at: HACE(6),
  dias: 0,
  nivel: 0,
} as Conversacion;

const MB = 1024 * 1024;
const whatsmeow = new URLSearchParams(location.search).has('whatsmeow');
/** El bot sin nada que decir: el caso que muestra si el aviso se entiende. */
const varitaMuda = new URLSearchParams(location.search).get('varita') === 'muda';
/**
 * Por qué se calla, con `?varita=muda`. Sin `motivo`, el caso de siempre: no hay entrante
 * que responder. `&motivo=sin_cliente` es la línea de campaña que todavía no tiene cliente
 * y por eso no lee las respuestas rápidas de nadie (#951).
 */
const motivoDeLaVaritaMuda =
  new URLSearchParams(location.search).get('motivo') ?? 'no hay ningún mensaje del lead que responder';

/** Un lienzo de `ancho`×`alto` pintado por `pintar`, como archivo del `mime` pedido. */
function lienzo(ancho: number, alto: number, mime: string, pintar: (c: CanvasRenderingContext2D) => void): () => Promise<Blob> {
  return () =>
    new Promise((listo) => {
      const el = document.createElement('canvas');
      el.width = ancho;
      el.height = alto;
      pintar(el.getContext('2d')!);
      el.toBlob((b) => listo(b!), mime, 0.9);
    });
}

/** El comprobante, dibujado derecho sobre un lienzo de 720×1280 (una captura de celular). */
function pintarVoucher(c: CanvasRenderingContext2D) {
  c.fillStyle = '#f4f5f7';
  c.fillRect(0, 0, 720, 1280);
  c.fillStyle = '#0e2a52';
  c.fillRect(0, 0, 720, 220);
  c.fillStyle = '#ffffff';
  c.font = 'bold 44px sans-serif';
  c.fillText('Comprobante de pago', 60, 130);
  c.fillStyle = '#ffffff';
  c.fillRect(40, 260, 640, 760);
  c.fillStyle = '#1b7f4b';
  c.font = 'bold 40px sans-serif';
  c.fillText('¡Pago exitoso!', 60, 340);
  c.fillStyle = '#0e2a52';
  c.font = 'bold 96px sans-serif';
  c.fillText('S/ 450.00', 60, 480);
  c.fillStyle = '#5b6474';
  c.font = '30px sans-serif';
  const filas = [
    ['Para', 'Goberna Escuela SAC'],
    ['Concepto', 'Diploma Gestión Pública'],
    ['Fecha', '11 sep 2026 · 10:42'],
    ['N.º de operación', '04817263'],
  ];
  filas.forEach(([k, v], i) => {
    c.fillText(k, 60, 600 + i * 100);
    c.fillStyle = '#0e2a52';
    c.font = 'bold 32px sans-serif';
    c.fillText(v, 60, 640 + i * 100);
    c.fillStyle = '#5b6474';
    c.font = '30px sans-serif';
  });
}

const IMAGENES_DEL_HILO: Record<string, () => Promise<Blob>> = {
  'wa-cloud-1873649201.jpg': lienzo(720, 1280, 'image/jpeg', pintarVoucher),
  // El mismo voucher fotografiado DE COSTADO: el archivo es apaisado y el texto corre vertical.
  'wa-cloud-2231907745.jpg': lienzo(1280, 720, 'image/jpeg', (c) => {
    c.fillStyle = '#d9d4cb';
    c.fillRect(0, 0, 1280, 720);
    c.save();
    c.translate(0, 720);
    c.rotate(-Math.PI / 2);
    pintarVoucher(c);
    c.restore();
  }),
  'wa-3EB0C4D2A1F9.png': lienzo(1600, 900, 'image/png', (c) => {
    c.fillStyle = '#0e2a52';
    c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#c9a227';
    c.fillRect(0, 760, 1600, 140);
    c.fillStyle = '#ffffff';
    c.font = 'bold 110px sans-serif';
    c.fillText('Diploma en', 100, 300);
    c.fillText('Gestión Pública', 100, 430);
    c.font = '48px sans-serif';
    c.fillText('Inicio: sábado 26 de septiembre · 100 % virtual', 100, 560);
    c.fillStyle = '#0e2a52';
    c.font = 'bold 56px sans-serif';
    c.fillText('Inscripciones abiertas', 100, 850);
  }),
};

/** Todo endpoint contesta lo mínimo; el envío responde OK pero no persiste nada. */
window.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  if (String(entrada).includes('/reaccionar')) console.info('[galeria] reaccionar →', String(init?.body ?? ''));
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

  // ── LA VARITA (#918) ──
  // El caso bonito Y el mudo, por la misma razón que las tres citas de acá
  // abajo: una galería que sólo sirve el caso ideal ya escondió tres defectos
  // en este repo. Un bot que se calla va a ser normal —el pipeline salta, no
  // hay entrante— y lo que hay que poder mirar es el cartel, no el acierto.
  if (url.includes('/api/bot/redactar')) {
    console.info('[galeria] varita →', String(init?.body ?? ''));
    return varitaMuda
      ? json({ id: 1, texto: null, motivo: motivoDeLaVaritaMuda })
      : json({
          id: 1,
          texto:
            'Hola Javier, el diploma de Gestión Pública sigue abierto. ¿Te cuento cómo es la modalidad y en qué horario son las clases?',
          motivo: null,
        });
  }
  if (/\/api\/bot\/sugerencias\/\d+/.test(url)) {
    console.info('[galeria] desenlace →', String(init?.body ?? ''));
    return json({ desenlace: 'usada' });
  }

  if (url.includes('/api/whatsapp/sesion'))
    return json({
      estado: 'conectado',
      telefono: NUMERO_PROPIO,
      // La línea del bot es Cloud API: los topes de Meta. `?whatsmeow=1` la
      // cambia por una línea de vendedora, donde el mismo video sí entra.
      transporte: whatsmeow ? 'whatsmeow' : 'cloud-api',
      limitesMedia: whatsmeow
        ? undefined
        : { imagen: 5 * MB, video: 16 * MB, audio: 16 * MB, documento: 64 * MB },
      // ADR 0072: feature-detectado como `puedeEditar`, al revés — solo
      // Cloud API. `?whatsmeow=1` también lo apaga, para poder ver el
      // selector SIN el botón de «enviar como plantilla real».
      puedeMandarPlantilla: !whatsmeow,
      // ADR 0056/0100: editar y eliminar son de whatsmeow, nunca Cloud API.
      // `?whatsmeow=1` los prende para poder ver los botones en la burbuja.
      puedeEditar: whatsmeow,
      puedeEliminar: whatsmeow,
    });
  if (url.includes('/api/whatsapp/conversacion/'))
    return json({ telefono: TELEFONO, mensajes: MENSAJES, origen: { fuente: 'anuncio', anuncio: 'Diploma Gestión Pública — julio', campana: 'GP-2026' } });
  if (url.includes('/api/whatsapp/reaccionar')) {
    // Se loguea para poder verificar desde afuera que la reacción SALE: la
    // galería pisa `window.fetch`, así que no hay request de red que espiar.
    console.info('[galeria] POST /reaccionar', typeof entrada === 'object' && 'body' in entrada ? '' : '');
    return json({ ok: true, quitada: false });
  }
  if (url.includes('/api/whatsapp/editar')) {
    // STATEFUL a propósito, mismo motivo que `editarEnHilo.test.tsx`: el
    // refetch que dispara `onSettled` tiene que devolver la edición
    // aplicada, o pisaría el update optimista con el texto viejo.
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    console.info('[galeria] POST /editar', String(init?.body ?? ''));
    const fila = body && MENSAJES.find((m) => m.external_id === body.mensajeId);
    if (fila) (fila as Record<string, unknown>).editado = { texto: body.texto, editadoEn: new Date().toISOString() };
    return json({ ok: true });
  }
  if (url.includes('/api/whatsapp/eliminar')) {
    // Mismo criterio STATEFUL que `/editar`, arriba. `revocadoEnWhatsapp:
    // true` — esto SÍ salió por whatsmeow (ADR 0100).
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    console.info('[galeria] POST /eliminar', String(init?.body ?? ''));
    const fila = body && MENSAJES.find((m) => m.external_id === body.mensajeId);
    if (fila) (fila as Record<string, unknown>).eliminado = { eliminadoEn: new Date().toISOString(), revocadoEnWhatsapp: true };
    return json({ ok: true });
  }
  if (url.includes('/api/whatsapp/ocultar')) {
    // ADR 0100 §"eliminar el mensaje del lead": `revocadoEnWhatsapp: false`
    // — esto NUNCA sale hacia WhatsApp, es un ocultamiento local.
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    console.info('[galeria] POST /ocultar', String(init?.body ?? ''));
    const fila = body && MENSAJES.find((m) => m.external_id === body.mensajeId);
    if (fila) (fila as Record<string, unknown>).eliminado = { eliminadoEn: new Date().toISOString(), revocadoEnWhatsapp: false };
    return json({ ok: true });
  }
  // Las RESPUESTAS RÁPIDAS del `/`. Son los datos recomendados de verdad: estas
  // frases y estas claves salieron del catálogo de producción, no de un ejemplo
  // lindo — una galería con el caso ideal ya escondió tres defectos.
  if (url.includes('/api/hechos/catalogo'))
    return json({
      editable: true,
      origen: 'tabla',
      hechos: [
        { clave: 'cuotas', rotulo: 'Dos cuotas', texto: 'Se puede pagar en dos cuotas sin interés: la primera reserva tu lugar.', momentos: [], orden: 1, activo: true },
        { clave: 'acceso-un-anio', rotulo: 'Acceso un año', texto: 'El acceso a la plataforma lo tienes por todo un año desde que arranca.', momentos: [], orden: 2, activo: true },
        { clave: 'publico-general', rotulo: 'Para público general', texto: 'Es para público general: no se pide carrera ni experiencia previa.', momentos: [], orden: 3, activo: true },
        { clave: 'certifica', rotulo: 'Quién certifica', texto: 'Certifica la Escuela de Gobierno de Goberna, con registro.', momentos: [], orden: 4, activo: true },
        {
          clave: 'yape',
          rotulo: 'Pago con Yape',
          texto: 'Puedes pagar con Yape al 986 394 450 a nombre de Goberna.',
          // Con imagen: el caso que prueba `imagenDeHechoComoArchivo` — el chip
          // del panel «Datos que ayudan acá» (BloqueHechos) y el `/` comparten
          // este mismo catálogo, así que el flyer se ve en los dos.
          imagen: { archivo: 'galeria-yape.png', mime: 'image/png', nombre: 'yape-goberna.png' },
          momentos: [],
          orden: 5,
          activo: true,
        },
      ],
    });
  // El bloque «Datos que ayudan acá» del panel (BloqueHechos, distinto del `/`
  // de arriba): mismo catálogo, ya recortado por momento.
  if (url.includes('/api/hechos?'))
    return json({
      momento: 'en-conversacion',
      estado: null,
      editable: true,
      origen: 'tabla',
      hechos: [
        { clave: 'cuotas', rotulo: 'Dos cuotas', texto: 'Se puede pagar en dos cuotas sin interés: la primera reserva tu lugar.', momentos: [], orden: 1 },
        {
          clave: 'yape',
          rotulo: 'Pago con Yape',
          texto: 'Puedes pagar con Yape al 986 394 450 a nombre de Goberna.',
          imagen: { archivo: 'galeria-yape.png', mime: 'image/png', nombre: 'yape-goberna.png' },
          momentos: [],
          orden: 5,
        },
      ],
    });
  // Las tres imágenes del hilo. Se dibujan acá con un lienzo y no viven en el
  // repo: lo que importa para el visor es el TAMAÑO y la orientación reales (una
  // captura vertical de celular, un flyer apaisado, una foto de costado).
  const dibujada = IMAGENES_DEL_HILO[url.split('/api/whatsapp/media/')[1] ?? ''];
  if (dibujada) {
    const blob = await dibujada();
    return new Response(blob, { status: 200, headers: { 'content-type': blob.type } });
  }
  // La imagen del dato «yape», detrás del perímetro como cualquier media de
  // WhatsApp — `imagenDeHechoComoArchivo` la baja por acá.
  if (url.includes('/api/whatsapp/media/galeria-voucher.jpg'))
    return new Response(await voucherDeGaleria(), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  if (url.includes('/api/whatsapp/media/galeria-temario.pdf'))
    return new Response(temarioDeGaleria(), { status: 200, headers: { 'content-type': 'application/pdf' } });
  if (url.includes('/api/whatsapp/media/galeria-notas.xlsx'))
    return new Response(new Blob(['PK']), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  if (url.includes('/api/whatsapp/media/galeria-yape.png')) {
    // 1×1 PNG real: alcanza para probar que se arma un `File` y queda de
    // adjunto pendiente, sin necesitar un flyer de verdad en el repo.
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });
  }
  /**
   * LAS PLANTILLAS APROBADAS del botón de al lado del clip (ADR 0062).
   *
   * Los dos cuerpos son los REALES de producción (`campana/plantillasAprobadas.ts`)
   * con su flyer y todo, y el tercero es el caso feo que hay que poder mirar: una
   * plantilla CON HUECOS, que al pegarse deja el `{{1}}` seleccionado. `ocultas`
   * viene en 1 porque en producción siempre hay alguna que Meta no aprobó, y lo
   * que se dibuja ahí es el renglón que impide que desaparezca en silencio.
   *
   * `?plantillas=falla` sirve el 502 de Meta: el estado que NUNCA se puede ver
   * como «no hay plantillas».
   */
  if (url.includes('/api/campana/plantillas/a-mano')) {
    if (new URLSearchParams(location.search).get('plantillas') === 'falla')
      return json({ ok: false, motivo: 'meta_indisponible', codigo: 'sin_permiso', message: 'El token no tiene permiso para leer las plantillas.' }, 502);
    return json({
      ocultas: { noAprobadas: 1, sinCuerpo: 0 },
      plantillas: [
        {
          nombre: 'confirmacion_inscripcion',
          idioma: 'es_PE',
          categoria: 'UTILITY',
          headerDeImagen: false,
          cuerpo: 'Hola {{1}}, confirmamos tu inscripción al {{2}}. Te esperamos.',
        },
        {
          nombre: 'foro_estado_5_ago',
          idioma: 'es_PE',
          categoria: 'MARKETING',
          headerDeImagen: true,
          cuerpo: [
            '👋 Hola buen día. Te saluda Luz asesora comercial de Goberna. Quiero invitarlo a participar en el:',
            '',
            '🏛️𝗫𝗜𝗜 𝗙𝗢𝗥𝗢 𝗗𝗘 𝗘𝗦𝗧𝗔𝗗𝗢 - Aniversario GOBERNA 🏛️',
            '🗓️Fecha: Sábado 29 de agosto',
            '📍Lugar: Hotel Westin, Lima.',
            '',
            '*Único pago de S/360.00*',
            '¿Aprovechas la oferta?',
          ].join('\n'),
        },
        {
          nombre: 'promo_3x1_cursos',
          idioma: 'en',
          categoria: 'MARKETING',
          headerDeImagen: true,
          cuerpo: [
            '🚨 *PROMO 3X1 IMPERDIBLE* 🚨',
            'Fortalece tu perfil profesional en Inteligencia y Seguridad 🧠🕵️‍♂️',
            '',
            '💵 *TODO por solo $150 USD*',
            '⏰ _SOLO POR HOY_',
          ].join('\n'),
        },
      ],
    });
  }
  // ADR 0072: la HSM real. Se loguea para poder verificar desde afuera qué
  // mandó el mini-formulario — la galería pisa `window.fetch`, así que no hay
  // request de red que espiar con las devtools de red.
  if (url.includes('/api/whatsapp/enviar-plantilla')) {
    console.info('[galeria] POST /enviar-plantilla', url.split('?')[1]);
    return json({ ok: true, idExterno: 'wa:hsm:galeria' });
  }
  if (url.includes('/api/whatsapp/enviar-media')) {
    const cuerpo = init?.body as Blob | undefined;
    const query = Object.fromEntries(new URL(url).searchParams);
    const tipo = new Headers(init?.headers).get('content-type');
    const cabecera = cuerpo ? new Uint8Array(await cuerpo.arrayBuffer()) : new Uint8Array();
    const nota = {
      query,
      tipo,
      bytes: cabecera.length,
      // Los primeros bytes de un ogg son `OggS`, y el primer paquete dice `OpusHead`.
      empiezaConOggS: new TextDecoder().decode(cabecera.slice(0, 4)) === 'OggS',
      traeOpusHead: new TextDecoder('latin1').decode(cabecera.slice(0, 200)).includes('OpusHead'),
    };
    (window as unknown as { __ultimaNotaDeVoz?: unknown }).__ultimaNotaDeVoz = nota;
    console.info('[galeria] POST /enviar-media', JSON.stringify(nota));
    return json({ ok: true, idExterno: 'wa:media:galeria' });
  }
  if (url.includes('/api/whatsapp/enviar')) return json({ ok: true, idExterno: 'wa:galeria' });
  return json({}, 404);
}) as typeof fetch;

const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const enRevision = new URLSearchParams(location.search).has('revision');
/**
 * `?movil=1`: el chat como lo monta el shell en un celular (11-sep-2026) — con
 * `onVolver`, que es lo que dibuja la flecha de volver en la cabecera. El alto
 * de pantalla entera y el pie con `safe-area` no dependen de esta bandera: son
 * las clases `max-md:` del propio hilo y aparecen con sólo achicar la ventana.
 * La bandera existe para que la captura a 390 muestre la cabecera de verdad.
 */
const enMovil = new URLSearchParams(location.search).has('movil');

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <div className="mx-auto h-screen w-full max-w-3xl px-6 py-6">
        <HiloWhatsapp
          conversacion={CONVERSACION}
          onVolver={enMovil ? () => console.info('[galeria] volver a la lista') : undefined}
          sugerencia={
            enRevision
              ? {
                  id: 7,
                  texto: 'Hola Javier, gracias por escribirnos. Te comparto el temario del diploma.',
                  campana: 'Gestión Pública',
                  paso: { actual: 3, total: 12 },
                  trabajando: false,
                  onAprobar: () => {},
                  onDescartar: () => {},
                }
              : undefined
          }
        />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
