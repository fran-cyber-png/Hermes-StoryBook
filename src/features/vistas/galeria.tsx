import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { VistaEmbudo } from './VistaEmbudo';
import { TituloDeSeccion } from '../../components/TituloDeSeccion';

/**
 * LA GALERÍA DEL PIPELINE — la evidencia de la ficha al costado, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-embudo.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-embudo.html
 *     …/galeria-embudo.html?ficha=1 → con la hoja de la ficha abierta
 *
 * Existe por la regla dura #2, y sobre todo para poder mirar UNA cosa a
 * 1280×720: el `GRID` del tablero declara mínimos que suman **1.000 px** y la
 * hoja se lleva 360. Ése es el ancho donde se decide si la hoja podía empujar
 * las columnas o tenía que superponerse — y la captura es la única forma de
 * verificar que la respuesta elegida no rompe el tablero.
 */

const PARAMS = new URLSearchParams(location.search);

/**
 * Las columnas, con la forma real de producción (medida el 10-ago-2026).
 *
 * ⚠️ **`sin_respuesta` ya no está**: desde el 10-ago dejó de ser columna
 * (decisión del dueño — era el 65 % de la mesa y nadie la trabajaba). Sigue
 * derivándose en el server, así que si alguien la vuelve a poner acá la galería
 * mentiría sobre lo que la pantalla dibuja.
 */
const POR_ETAPA: Record<string, number> = {
  interesado: 377,
  sin_respuesta: 4491,
  contactado: 217,
  cotizado: 798,
  cierre: 12,
  perdido: 47,
};

/**
 * ⚠️ **LOS 4.491 SILENCIOS, UNO POR UNO** — y no un número suelto.
 *
 * La franja de tiempo (`franja.ts`) se prueba contando: «últimos 30 min» tiene
 * que dar un puñado y «hoy» un par de cientos. Con un total inventado por franja,
 * la captura probaría que sé escribir constantes, no que el filtro filtra. Así
 * que la galería siembra los 4.491 INSTANTES y el stub los cuenta como los
 * contaría postgres — el mismo `ultimo_at >= desde` de `consultarCola.ts`.
 *
 * El reparto es parejo sobre los 30 días que mira la cola: 4.491 / 30 ≈ 150 por
 * día, ≈ 6 por hora. No es la forma real de un día de trabajo (que se apelotona
 * de mañana), y no hace falta que lo sea: lo que la captura tiene que mostrar es
 * que la cifra CAMBIA y que la lista es la de esa franja.
 */
const MINUTOS_DE_LA_COLA = 30 * 24 * 60;
const INSTANTES_SIN_RESPUESTA: number[] = Array.from({ length: POR_ETAPA.sin_respuesta }, (_, i) => {
  const atras = ((i + 0.5) * MINUTOS_DE_LA_COLA) / POR_ETAPA.sin_respuesta;
  return Date.now() - atras * 60_000;
});

/**
 * CUÁNTAS DEJA CADA RECORTE — medido en producción el 8-ago-2026, y es lo que
 * hace que esta galería sirva de evidencia y no de dibujo: el punto del frente es
 * que «Para seguir 82» sea drásticamente más chico que «3.051».
 */
const POR_RECORTE: Record<string, Record<string, number>> = {
  // ⚠️ En «Te esperan» el chip «En ventana» daría CASI EL TOTAL —te escribieron
  // recién, por definición—, y ahí la otra mitad de la regla del cero lo esconde
  // sola. Está puesto en el TOTAL a propósito: es el caso que hay que poder ver.
  interesado: { ventana: 377, seguir: 88, precio: 0 },
  // «Nunca contestaron», con los números que la pantalla muestra hoy.
  sin_respuesta: { ventana: 0, seguir: 1349, precio: 2497 },
  contactado: { ventana: 0, seguir: 24, precio: 0 },
  cotizado: { ventana: 2, seguir: 82, precio: 798 },
};

/**
 * LAS DOS LÍNEAS QUE CORREN HOY, con sus números y rótulos reales (medido el
 * 18-ago-2026): `51984429504` «Ventas Meta», que es la que trae los leads, y
 * `51963139984` «Betto», la de campaña.
 *
 * ⚠️ Son las que el SERVER decidió ofrecerle a quien mira: `GET
 * /api/whatsapp/lineas` ya recorta las que no están vivas y la frontera de
 * campaña de ADR 0061 — o sea que «Betto» sólo llega a este menú en la pantalla
 * de quien la atiende. La galería no vuelve a decidir eso; sirve la lista tal
 * como llegaría.
 */
const LINEAS = [
  { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true, compartida: true },
  { numero: '51963139984', etiqueta: 'Betto', estado: 'conectado', mias: true, compartida: false },
];

const NOMBRES = [
  ['Javier Peralta Ríos', 'Diplomado en Gestión Pública', true],
  ['Ana Lucía Quispe Mamani', 'Inteligencia y Contrainteligencia', true],
  ['Roberto Carlos Medina', null, false],
  ['María Fernanda Toledo', 'Foro de Estado', true],
  ['Luis Alberto Chávez Rojas', null, false],
  ['Carmen Rosa Huamán', 'Escuela de Gobierno', true],
  ['Jorge Enrique Salazar', null, false],
  ['Patricia Elena Vargas', 'Diplomado en Gestión Pública', true],
] as const;

/** Cada columna arranca en otro bloque de números: ver abajo por qué importa. */
const DESDE: Record<string, number> = {
  interesado: 400,
  // ⚠️ Sin su bloque, el teléfono salía `NaN` y las cuatro tarjetas compartían
  // clave: `repartirColumnas` pinta cada clave UNA vez, así que la columna
  // mostraba UNA tarjeta con «faltan 4.490» debajo. El defecto que este mismo
  // archivo ya tenía escrito arriba, cobrado de nuevo.
  sin_respuesta: 500,
  contactado: 0,
  cotizado: 100,
  cierre: 200,
  perdido: 300,
};

/** Una tarjeta con la forma que sirve la cola (`/api/conversaciones`). */
function tarjetas(etapa: string, cuantas: number, instantes?: number[]) {
  return Array.from({ length: cuantas }, (_, i) => {
    const [nombre, curso] = NOMBRES[i % NOMBRES.length];
    // Con franja puesta, la tarjeta se fecha con el instante que la hizo entrar:
    // si dijera «hace 2 h» dentro de «últimos 30 minutos», la captura mostraría
    // el filtro contradiciéndose a sí mismo en la misma pantalla.
    const horas = instantes ? (Date.now() - instantes[i]) / 3_600_000 : 2 + i * 5;
    const cuando = new Date(Date.now() - horas * 3_600_000).toISOString();
    // ⚠️ La clave tiene que ser ÚNICA ENTRE COLUMNAS. `repartirColumnas` pinta
    // cada clave UNA sola vez (así una tarjeta que se está moviendo no se
    // duplica), así que con el mismo teléfono en las cuatro columnas, las tres
    // últimas salían vacías — con su total en la cabecera diciendo 611. La
    // galería habría mostrado el Pipeline roto sin que el Pipeline lo esté.
    const telefono = `5198765${String(4321 + DESDE[etapa] + i)}`;
    /**
     * LOS LEADS DE FORMULARIO comparten columna con quien te escribió: «Te
     * esperan» es «la pelota es nuestra», no «te escribieron por WhatsApp».
     * Se siembran uno de cada tres para que la captura muestre las DOS formas
     * juntas — que es el caso que hay que poder mirar: la tarjeta de un lead no
     * tiene hilo, ni línea, ni reloj de respuesta.
     */
    const esLead = etapa === 'interesado' && i % 3 === 1;
    if (esLead)
      return {
        clave: `lead:${900 + i}`,
        canal: 'landing',
        tipo: 'lead',
        persona_id: telefono,
        persona_nombre: nombre,
        lead_nombre: nombre,
        numero_propio: null,
        // Lo que pidió en el formulario. Es todo lo que sabemos de esta persona.
        texto: curso ?? 'Diplomado en Gestión Pública',
        contexto_texto: null,
        respondida: false,
        ya_le_hablamos: false,
        precio_enviado: false,
        etapa_efectiva: 'interesado',
        interes_curso: null,
        lead_curso: curso,
        ventana_abierta: false,
        // Sin conversación no hay ventana que abrir: hay que ABRIRLE el chat.
        ventana_cierra: null,
        pregunto: false,
        n: 1,
        referencia: cuando,
        ultimo_at: cuando,
        dias: Math.floor(horas / 24),
        etapa_desde: null,
        nivel: 0,
      };
    return {
      clave: `conv:whatsapp:${telefono}:${LINEAS[0].numero}`,
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: telefono,
      persona_nombre: nombre,
      lead_nombre: nombre,
      numero_propio: LINEAS[0].numero,
      texto: i % 3 === 0 ? '¿me puede pasar más información del diplomado?' : null,
      contexto_texto: null,
      // En «Te esperan» la pelota es NUESTRA: la persona escribió y nadie le
      // contestó, así que `respondida` es false — es lo que deriva esa etapa.
      respondida: etapa === 'interesado' ? false : i % 2 === 0,
      ya_le_hablamos: true,
      // El precio DERIVA la etapa: si la tarjeta tiene precio, está en Cotizados.
      precio_enviado: etapa === 'cotizado',
      etapa_efectiva: etapa,
      interes_curso: etapa === 'cotizado' ? curso : null,
      lead_curso: curso,
      ventana_abierta: false,
      // La VENTANA (ADR 0041): las primeras de cada columna todavía la tienen
      // abierta — y como es de WhatsApp (24 h), sale siempre en rojo (20-ago-2026,
      // `dominio/ventana.ts`). El resto sin ventana, que es como se ve la mayoría
      // de una columna de seguimiento.
      ventana_cierra:
        i % 4 === 0
          ? new Date(Date.now() + (i === 0 ? 40 * 60_000 : (3 + i) * 3_600_000)).toISOString()
          : null,
      pide_info: i % 3 === 0,
      n: 4 + i,
      referencia: cuando,
      ultimo_at: cuando,
      dias: Math.floor(horas / 24),
      // DESDE CUÁNDO ESTÁ EN LA ETAPA (ADR: `cola/tiempoEnEtapa.ts`). Se escalona
      // a propósito para que la evidencia muestre las tres cosas que la marca
      // tiene que hacer: callarse cuando entró hoy (i=0), callarse cuando repite
      // lo que ya dice el reloj de arriba, y hablar cuando difieren — que es el
      // caso que justifica el frente («recibió el precio hace tres semanas»).
      etapa_desde:
        i === 0
          ? new Date(Date.now() - 4 * 3_600_000).toISOString()
          : new Date(Date.now() - (2 + i * 4) * 86_400_000).toISOString(),
      nivel: i % 2 === 0 ? 4 : 0,
    };
  });
}

/** El desglose que alimenta la bandeja y los conteos por columna. */
const DESGLOSE = [
  // «Te esperan» es columna desde el 10-ago, así que estas dos filas ya no
  // alimentan una tira: alimentan su cabecera («sin abrir» vs «volvieron») y su
  // conteo. `ventana: true` en las dos es lo real —te acaban de escribir— y es
  // lo que hace que el chip «En ventana» dé el total y la regla lo esconda.
  // Las «sin abrir» son 238 y solo una parte está escribiendo AHORA (<24 h). Van
  // en dos filas para que los tres números de la cabecera sean distintos: con
  // `viva` en las 238, decía «238 ahora · 238 sin abrir» y se leía como un bug.
  // ⚠️ En producción hoy `vivas` es 0 —hace días que no escribe nadie—, así que
  // ese segmento no se dibuja; acá se siembra para poder verlo.
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, ventana: true, paraSeguir: false, n: 12 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: true, paraSeguir: false, n: 226 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: true, paraSeguir: true, n: 88 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: true, paraSeguir: false, n: 51 },
  // ⚠️ Desde el 8-ago-2026 NINGUNA fila de `contactado` puede tener `precio`:
  // `precio_enviado` deriva `cotizado` (`cola/etapaEfectivaSql.ts`), así que esa
  // combinación ya no existe. Por eso el chip «Con precio» desaparece de
  // Contactados solo — la regla «un recorte que daría cero no se ofrece».
  // Los números son los MEDIDOS en producción el 8-ago-2026 (ver `POR_RECORTE`):
  // «en ventana» deja 0 de 544 y 2 de 3.051 —por eso ese chip casi no aparece— y
  // «para seguir» es el único que recorta de verdad.
  // «Nunca contestaron»: le escribimos y nunca dijo una palabra. `yaLeHablamos`
  // en true y `ventana` en false — la ventana la abre un ENTRANTE, y acá no hubo.
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, n: 1349 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, n: 1148 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, n: 1994 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, n: 24 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, n: 193 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, n: 2 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, n: 82 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, n: 714 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, paraSeguir: false, n: 12 },
  { etapa: 'perdido', yaLeHablamos: true, precio: false, viva: false, paraSeguir: false, n: 47 },
];

/** Lo que la hoja de la ficha le pregunta a Cerberus. */
const FICHA_CERBERUS = {
  estado: 'cliente',
  id: 4821,
  nombre: 'Javier Peralta Ríos',
  codigo: 'CL-4821',
  dni: '41287654',
  pais: 'Perú',
  correo: 'javier.peralta@correo.com',
  ventasCount: 2,
  ventas: [
    {
      folio: 'F001-2291',
      estado: 'Pagado',
      monto: '750.00',
      moneda: 'PEN',
      fecha: '2026-07-14',
      productos: ['Diplomado en Gestión Pública'],
    },
    {
      folio: 'F001-1877',
      estado: 'Pagado',
      monto: '500.00',
      moneda: 'PEN',
      fecha: '2026-04-02',
      productos: ['Curso de Inteligencia y Contrainteligencia'],
    },
  ],
};

/**
 * La franja que pide la URL, si es la de ESTA columna. Es la misma guarda que el
 * server (`cola/franjaPedida.ts`): sin `franjaEn` la franja no se aplica a nadie,
 * porque aplicada a todas vaciaría las columnas que la vendedora no tocó.
 */
function franjaDe(q: URLSearchParams, etapa: string): { desde: number; hasta: number | null } | null {
  const desde = q.get('desde');
  if (!desde || q.get('franjaEn') !== etapa) return null;
  const hasta = q.get('hasta');
  return { desde: new Date(desde).getTime(), hasta: hasta ? new Date(hasta).getTime() : null };
}

/**
 * La página de una columna: qué tarjetas y cuántas hay en total.
 *
 * ⚠️ EL STUB TIENE QUE RESPETAR EL RECORTE. Si devolviera siempre el total de la
 * etapa, la cabecera diría «82 · de 3.051» sobre una columna que sigue pintando
 * las mismas tarjetas — o sea, la captura probaría lo contrario de lo que el
 * frente hace. Es el mismo cuidado que la clave única por columna.
 *
 * Y la franja se cuenta de verdad, instante por instante (ver
 * `INSTANTES_SIN_RESPUESTA`): es lo que hace que «Últimos 30 minutos · 3 de
 * 4.491» sea una medición del filtro y no un número escrito a mano.
 */
function paginaDe(etapa: string, recorte: string | undefined, franja: ReturnType<typeof franjaDe>) {
  if (franja) {
    const dentro = INSTANTES_SIN_RESPUESTA.filter(
      (t) => t >= franja.desde && (franja.hasta == null || t < franja.hasta),
    );
    const cuantas = Math.min(dentro.length, 8);
    return {
      conversaciones: tarjetas(etapa, cuantas, dentro),
      total: dentro.length,
      hayMas: dentro.length > cuantas,
    };
  }
  const total = recorte ? (POR_RECORTE[etapa]?.[recorte] ?? 0) : (POR_ETAPA[etapa] ?? 0);
  const cuantas = Math.min(total, etapa === 'contactado' || etapa === 'interesado' ? 8 : 4);
  return { conversaciones: tarjetas(etapa, cuantas), total, hayMas: total > cuantas };
}

/** Todo endpoint responde de mentira: la galería no toca la red ni una vez. */
window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(
    typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url,
  );

  // La foto de perfil NO existe en la galería, y decirlo con un 404 es lo
  // correcto: el Avatar cae a las iniciales ante cualquier problema («sin foto →
  // iniciales, nunca un roto»). Un 200 con JSON adentro le daría un blob que no
  // es una imagen, y la evidencia saldría con ocho íconos rotos.
  if (url.includes('/api/whatsapp/foto/')) {
    return new Response(null, { status: 404 });
  }

  // Las líneas por las que se le puede escribir a alguien: es lo que decide si
  // el botón de la tarjeta lleva derecho al chat o pregunta primero.
  if (url.includes('/api/whatsapp/lineas')) {
    return respuesta({ lineas: LINEAS });
  }

  /**
   * ══ EL TABLERO EN UN PEDIDO — lo que el Pipeline pide desde el 19-ago ══════
   *
   * ⚠️ **Va ANTES del `/api/conversaciones` de abajo**, que lo contiene: el
   * tablero responde `columnas`, y servirle la forma de la cola paginada dejaría
   * las cinco columnas vacías con sus totales llenos. (Era exactamente lo que
   * pasaba acá hasta hoy: esta galería quedó sirviendo el contrato viejo cuando
   * `useTablero` pasó a pedir `/tablero`.)
   */
  if (url.includes('/api/conversaciones/tablero')) {
    const q = new URL(url, location.origin).searchParams;
    const columnas: Record<string, unknown> = {};
    for (const pedida of (q.get('columnas') ?? '').split(',').filter(Boolean)) {
      const [etapa, recorte] = pedida.split(':');
      columnas[etapa] = paginaDe(etapa, recorte, franjaDe(q, etapa));
    }
    return respuesta({ columnas, conteos: POR_ETAPA, desglose: DESGLOSE });
  }

  if (url.includes('/api/conversaciones')) {
    const q = new URL(url, location.origin).searchParams;
    const etapa = q.get('etapa') ?? 'contactado';
    const recorte = ['ventana', 'seguir', 'precio'].find((r) => q.get(r) === '1');
    return respuesta({
      ...paginaDe(etapa, recorte, franjaDe(q, etapa)),
      conteos: POR_ETAPA,
      desglose: DESGLOSE,
    });
  }

  const cuerpo = url.includes('/api/contactos/ficha')
    ? FICHA_CERBERUS
    : url.includes('/api/contactos/lead')
    ? {
        lead: {
          nombre: 'Javier Peralta Ríos',
          fuente: 'meta',
          campana: 'Gestión Pública · julio',
          anuncio: 'Adquiérelo ahora',
          fecha: '2026-07-02T15:12:00.000Z',
        },
      }
    : url.includes('/api/senales')
    ? { senales: {}, umbralDias: 3 }
    : url.includes('/api/gestiones/intereses')
    ? { lista: [{ curso: 'Diplomado en Gestión Pública', creadoAt: '2026-07-20T10:00:00.000Z' }], derivados: [] }
    // Ninguna de las dos líneas de la galería tiene reparto configurado: la
    // forma real es `rueda: [], destinos: []` (`PasarConversacion` esconde el
    // botón sola con eso), no `{}` — que sin el `?.` de `reparto.ts` rompía el
    // render entero de la ficha apenas se abría.
    : url.includes('/api/reparto/rueda')
    ? { rueda: [], destinos: [], nombres: {} }
    // Nadie tiene un seguimiento agendado en la galería — la forma real es
    // `{ recordatorios: [] }`, no `{}` (mismo motivo que `/api/reparto/rueda`).
    : url.includes('/api/agenda')
    ? { recordatorios: [] }
    : {};
  return respuesta(cuerpo);
}) as typeof fetch;

function respuesta(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * `?ficha=1` abre la hoja de la primera tarjeta.
 *
 * Es la evidencia de lo que la vista vino a resolver: hasta hoy, saber quién era
 * esa persona costaba **irse a Mensajes** y perder el tablero.
 */
/**
 * `?seguir=1` toca el chip «Para seguir» de Cotizados — la evidencia del frente:
 * la columna pasa de 3.051 tarjetas a 82, con el total todavía a la vista.
 */
if (PARAMS.has('seguir')) {
  setTimeout(() => {
    const chips = document.querySelectorAll<HTMLElement>('button[aria-pressed]');
    for (const chip of chips) {
      if (chip.textContent?.startsWith('Para seguir 82')) {
        chip.click();
        break;
      }
    }
  }, 400);
}

/**
 * `?colapsar=<etapa>` (p. ej. `?colapsar=cotizado`) — la evidencia del colapso
 * (ADR 0089): toca el botón de esa columna igual que la vendedora, para poder
 * capturar la franja angosta de verdad y no un dibujo de cómo debería verse.
 */
if (PARAMS.has('colapsar')) {
  setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-alternar-colapso="${PARAMS.get('colapsar')}"]`)
      ?.click();
  }, 400);
}

/**
 * EL FILTRO DE TIEMPO DE «NUNCA CONTESTARON» (`franja.ts`), en sus dos capturas:
 *
 *   · `?cuando=abierto` — el menú desplegado: los tres grupos (Fecha · Hora ·
 *     Minutos) y el techo de 30 días escrito abajo. Es lo que se puede ELEGIR.
 *   · `?cuando=<rótulo>` — con la franja PUESTA, que es lo que hay que poder
 *     mirar: la cabecera pasa a dos cifras y la columna se queda con las
 *     tarjetas de esa franja (p. ej. `?cuando=Últimos%2030%20minutos`).
 *
 * Como `--screenshot` no interactúa, la galería toca el chip igual que la
 * vendedora: el mismo botón, el mismo menú.
 */
if (PARAMS.has('cuando')) {
  setTimeout(() => {
    const chip = [...document.querySelectorAll<HTMLElement>('button[aria-expanded]')].find((b) =>
      b.textContent?.includes('Cuándo'),
    );
    chip?.click();
    const pedido = PARAMS.get('cuando') ?? 'abierto';
    if (pedido === 'abierto') return;
    setTimeout(() => {
      const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (b) => b.textContent?.trim() === pedido,
      );
      item?.click();
    }, 150);
  }, 400);
}

/**
 * EL MENÚ DE «¿POR QUÉ LÍNEA LE ESCRIBÍS?», en sus tres casos:
 *
 *   · `?linea=chat`  — la primera tarjeta: una conversación que ya vive en
 *     «Ventas Meta», así que esa línea sale marcada «este chat» y el pie avisa
 *     que las otras abren uno nuevo;
 *   · `?linea=lead`  — la segunda: un lead de formulario. No hay chat que
 *     seguir, así que no hay marca ni pie — las dos opciones empiezan uno;
 *   · `?linea=abajo` — la última de la columna, donde abrir hacia abajo sería
 *     abrir un menú cortado (las columnas son `overflow-y-auto`) y tiene que
 *     salir hacia arriba.
 *
 * Los tres y no sólo el lindo: lo que hay que poder mirar es la DIFERENCIA entre
 * seguir un hilo y empezar otro, y que el menú no se corte. El botón vive
 * escondido hasta el hover, así que la galería lo destapa antes de tocarlo.
 */
const TARJETA_DEL_MENU: Record<string, number> = { chat: 0, '1': 0, lead: 1, abajo: 7 };
if (PARAMS.has('linea')) {
  setTimeout(() => {
    const botones = document.querySelectorAll<HTMLElement>('button[title^="Abrir"]');
    const boton = botones[TARJETA_DEL_MENU[PARAMS.get('linea') ?? 'chat'] ?? 0];
    boton?.focus();
    boton?.click();
  }, 500);
}

if (PARAMS.has('ficha')) {
  setTimeout(() => {
    document.querySelector<HTMLElement>('[role="button"][aria-label^="Ver la ficha"]')?.click();
  }, 500);
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        {/* La barra imita la cabecera del shell —mismas clases, mismo componente
            de título— porque la jerarquía tipográfica sólo se puede juzgar CON
            ella: el punto es cuánto pesa «Pipeline» contra los rótulos de las
            columnas y el cuerpo de las tarjetas, no el título solo. */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 pb-3 pt-4">
          <TituloDeSeccion>Pipeline</TituloDeSeccion>
        </header>
        <VistaEmbudo onAbrir={() => {}} />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
