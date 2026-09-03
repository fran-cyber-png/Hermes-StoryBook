import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { VistaDashboard } from './VistaDashboard';

/**
 * LA GALERÍA DEL DASHBOARD PERSONAL — la evidencia, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-dashboard.html` en la raíz): **no entra al
 * bundle de la app** —`vite build` toma solo `index.html`— y no habla con ningún
 * server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-dashboard.html
 *     …?supervisor=1 → lo que ve quien reparte (todo, con «El negocio»)
 *     …?vacio=1      → sin nada asignado todavía
 *     …?campana=1    → el módulo campaña: otra escalera, sin plata y sin cursos
 *                      (y su lectura «La campaña», con los números de prod)
 *
 * Existe por la regla dura #2 y para poder mirar de una las tres cosas que este
 * frente tiene que resolver **sin que nadie lea**: que «El negocio» no esté para
 * quien no le toca, que los chips de lo que no tiene dueño no aparezcan como
 * ceros, y sobre todo que **un radar vacío diga su motivo** — porque medido en
 * prod el 5-ago, cuatro vendedoras lo abrirían casi vacío.
 *
 * Y desde el 24-ago-2026, el chip de ASIGNAR de la fila (donde estaba el `+` de
 * etiquetar): que sus tres formas —«Tú», el nombre de otra persona, y el estado
 * vacío «Asignar»— se distingan de un vistazo sin comerse el nombre del lead.
 */

const PARAMS = new URLSearchParams(location.search);
const SUPERVISOR = PARAMS.has('supervisor');
const VACIO = PARAMS.has('vacio');
/**
 * 🔴 El módulo CAMPAÑA. Sin este caso la galería no puede mostrar lo que este
 * frente decide —qué tiles y qué paneles cambian entre los dos negocios— y la
 * captura probaría sólo la mitad que ya funcionaba.
 */
const CAMPANA = PARAMS.has('campana');

const NOMBRES = [
  ['Javier Peralta Ríos', '51987654321', 'Perú', 'me interesa el diplomado, ¿cuánto cuesta?'],
  ['Ana Lucía Quispe Mamani', '51984429504', 'Perú', '¿se puede pagar en dos cuotas?'],
  ['Roberto Carlos Medina', '52984429641', 'México', 'buenas, quisiera más información'],
  ['María Fernanda Toledo', '59384429778', 'Ecuador', '¿el certificado tiene validez acá?'],
  ['Luis Alberto Chávez Rojas', '51984429915', 'Perú', 'ya hice la transferencia'],
  ['Carmen Rosa Huamán', '59184430052', 'Bolivia', '¿cuándo empieza la próxima edición?'],
] as const;

/** Un chat del radar, con la forma que sirve `/api/dashboard`. */
function chats(cuantos: number) {
  return NOMBRES.slice(0, cuantos).map(([nombre, telefono, pais, texto], i) => {
    const horas = 2 + i * 7;
    const cuando = new Date(Date.now() - horas * 3_600_000).toISOString();
    return {
      clave: `conv:whatsapp:${telefono}:51984429504`,
      fuente: 'chat',
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: telefono,
      persona_nombre: nombre,
      numero_propio: '51984429504',
      texto,
      texto_clase: null,
      texto_origen: null,
      contexto_texto: null,
      telefono,
      pais_dato: pais,
      pregunto: i % 2 === 0,
      ventana_dias: null,
      ventana_abierta: false,
      respondida: i % 3 === 0,
      referencia: cuando,
      cayo_at: cuando,
      seguimiento_en: null,
      seguimiento_nota: null,
      /**
       * DE QUIÉN ES — lo que lee el chip de asignar de la fila.
       *
       * Las TRES formas del chip en las tres primeras filas, a propósito: «Tú»
       * (la de quien mira), el nombre de otra persona, y el estado vacío
       * «Asignar». Es lo que hay que MIRAR de este frente, y un caso donde
       * todas se vieran iguales no probaría nada.
       *
       * ⚠️ La proporción, en cambio, no es la real y conviene saberlo: en
       * producción el estado vacío es la abrumadora mayoría —medido el
       * 18-ago-2026, `luz` tenía dueña en 1 de 1.008 conversaciones—, así que
       * en la pantalla de verdad esto se ve como una fila con nombre cada
       * tantas. Acá se juntan para poder compararlas de un vistazo.
       */
      asignada_a: i === 0 ? 'ventas11@grupogoberna.com' : i === 1 ? 'ventas12@grupogoberna.com' : null,
      nivel: i % 3 === 0 ? 4 : 0,
      orden: i,
    };
  });
}

/**
 * LA RUEDA DE LA LÍNEA — sin esto el chip de asignar no se dibuja NINGUNA vez.
 *
 * `PasarConversacion` se borra solo cuando la línea no tiene reparto («un botón
 * que abre una lista vacía no es una acción, es una promesa incumplida»), así
 * que una galería que no contesta esta ruta probaría exactamente el caso en que
 * el frente no se ve.
 *
 * Los valores son los REALES de producción (medidos el 18-ago-2026, los mismos
 * que sirve `features/reparto/galeria.tsx`), con las dos cuentas que Hermes NO
 * sabe cómo se llaman incluidas: `ventas13@` se sigue viendo «Ventas13» porque
 * en Cerberus no tiene nombre, y ése es justo el borde que un caso ideal
 * escondería.
 */
const RUEDA = {
  linea: '51984429504',
  rueda: [
    { vendedoraId: 'ventas11@grupogoberna.com', asignadas: 11, orden: 1, activa: true },
    { vendedoraId: 'ventas12@grupogoberna.com', asignadas: 11, orden: 2, activa: true },
    { vendedoraId: 'ventas13@grupogoberna.com', asignadas: 1, orden: 3, activa: false },
  ],
  destinos: ['Luz', 'Sindy', 'ventas11@grupogoberna.com', 'ventas12@grupogoberna.com', 'ventas13@grupogoberna.com'],
  nombres: { 'ventas11@grupogoberna.com': 'Cielo Huambo', 'ventas12@grupogoberna.com': 'James' },
};

/** Los leads de formulario: SOLO los ve el supervisor (no tienen dueño posible). */
function formularios() {
  /**
   * Los valores REALES de producción (8-ago-2026): los de landing entran con
   * `platform='web'` y su curso vive en `campaign_name` — «Diploma Internacional
   * del Consultor Político» son 49 de los 87 leads de los últimos 14 días.
   * Hasta hoy esta galería mostraba el caso ideal y por eso nunca reflejó el
   * defecto: la fila decía «icarus:landing» y se etiquetaba «Lead Ad».
   */
  return [
    ['Edward Rodríguez Acevedo', '18294430463', 'República Dominicana', 'Diploma Internacional del Consultor Político'],
    ['GROVER ZAPANA ZARATE', '59171234567', 'Bolivia', 'Diploma Internacional de Inteligencia y Contrainteligencia'],
  ].map(([nombre, telefono, pais, producto], i) => {
    const cuando = new Date(Date.now() - (3 + i * 9) * 3_600_000).toISOString();
    return {
      clave: `lead:${900 + i}`,
      // Los dos son de LANDING: es lo que dice `platform='web'` una vez que
      // `dashboard/fuenteLead.ts` lo traduce bien.
      fuente: 'landing',
      canal: 'web',
      persona_nombre: nombre,
      telefono,
      correo: `${nombre.split(' ')[0].toLowerCase()}@correo.com`,
      pais_dato: pais,
      producto,
      campana: producto,
      flyer: null,
      es_organico: false,
      estado_lead: 'nuevo',
      cayo_at: cuando,
      nivel: 0,
      orden: 10 + i,
    };
  });
}

const SERIE = (base: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    dia: new Date(Date.UTC(2026, 6, 23 + i)).toISOString().slice(0, 10),
    n: Math.max(0, base + ((i * 7) % 9) - 3),
  }));

const EQUIPO_COMPLETO = [
  { vendedora: 'luz', conversaciones_hoy: 14, mensajes_hoy: 58, ventas_hoy: 2, conversaciones_7d: 71, mensajes_7d: 305, ventas_7d: 9 },
  { vendedora: 'ventas11@grupogoberna.com', conversaciones_hoy: 6, mensajes_hoy: 23, ventas_hoy: 1, conversaciones_7d: 28, mensajes_7d: 119, ventas_7d: 3 },
  { vendedora: 'ventas12@grupogoberna.com', conversaciones_hoy: 4, mensajes_hoy: 17, ventas_hoy: 0, conversaciones_7d: 19, mensajes_7d: 82, ventas_7d: 2 },
  { vendedora: 'ventas13@grupogoberna.com', conversaciones_hoy: 3, mensajes_hoy: 11, ventas_hoy: 0, conversaciones_7d: 12, mensajes_7d: 46, ventas_7d: 1 },
];

/** Todo endpoint responde de mentira: la galería no toca la red ni una vez. */
window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(
    typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url,
  );

  // La foto de perfil no existe acá: 404, para que el Avatar caiga a iniciales
  // («sin foto → iniciales, nunca un roto») en vez de dibujar un blob que no es
  // una imagen.
  if (url.includes('/api/whatsapp/foto/')) return new Response(null, { status: 404 });

  // La rueda de la línea: lo que decide si el chip de asignar existe. Ver RUEDA.
  if (url.includes('/api/reparto/rueda')) return respuesta(RUEDA);

  /**
   * LA LECTURA DE CAMPAÑA (ADR 0085) — y acá los números **son los de
   * producción**, medidos el 24-ago-2026 sobre la línea de Betto
   * (`51963139984`, 11 al 24 de agosto). No es un capricho de prolijidad: es la
   * regla #9 del repo — una galería que sirve valores lindos no es evidencia,
   * porque justo lo que hay que mirar acá es que **la barra de la noche se
   * dispare** mientras las otras tres quedan cortas. Con datos inventados
   * parejos, el panel se ve bien y no prueba nada.
   */
  if (url.includes('/api/dashboard/campana')) {
    return respuesta({
      rango: { desde: '2026-08-11T05:00:00.000Z', hasta: '2026-08-25T04:59:59.000Z' },
      periodo: '30d',
      lineas: ['51963139984'],
      gente: { escribieron: 152, respondidas: 143, sin_responder: 9, nuevas: 152 },
      mensajes: { entrantes: 608, salientes: 533, entrantes_sin_texto: 92 },
      franjas: [
        { franja: 'madrugada', personas: 10, atendidas: 10, demora_mediana_min: 329, entrantes: 21 },
        { franja: 'manana', personas: 27, atendidas: 27, demora_mediana_min: 88, entrantes: 153 },
        { franja: 'tarde', personas: 66, atendidas: 61, demora_mediana_min: 8, entrantes: 312 },
        { franja: 'noche', personas: 49, atendidas: 45, demora_mediana_min: 688, entrantes: 122 },
      ],
      // Con los seis días en cero del 12 al 17: es el apagón real de la línea, y
      // es justo lo que la primera captura NO mostraba (barras pegadas).
      dias: [
        { dia: '2026-08-11', entrantes: 117, salientes: 116 },
        { dia: '2026-08-12', entrantes: 0, salientes: 0 },
        { dia: '2026-08-13', entrantes: 0, salientes: 0 },
        { dia: '2026-08-14', entrantes: 0, salientes: 0 },
        { dia: '2026-08-15', entrantes: 0, salientes: 0 },
        { dia: '2026-08-16', entrantes: 0, salientes: 0 },
        { dia: '2026-08-17', entrantes: 0, salientes: 0 },
        { dia: '2026-08-18', entrantes: 6, salientes: 1 },
        { dia: '2026-08-19', entrantes: 5, salientes: 0 },
        { dia: '2026-08-20', entrantes: 7, salientes: 2 },
        { dia: '2026-08-21', entrantes: 22, salientes: 92 },
        { dia: '2026-08-22', entrantes: 91, salientes: 62 },
        { dia: '2026-08-23', entrantes: 227, salientes: 131 },
        { dia: '2026-08-24', entrantes: 133, salientes: 129 },
      ],
      aperturas: [
        { texto: 'Hola. Las principales problemáticas de mi provincia son', personas: 86, solo_eso: 68 },
      ],
      equipo: [
        { operador: 'centurion:usuario4', envios: 126, personas: 60, leidos: 115, automaticos: 0 },
        { operador: 'centurion:job.meneses', envios: 59, personas: 31, leidos: 57, automaticos: 0 },
        { operador: 'bot', envios: 49, personas: 19, leidos: 0, automaticos: 49 },
        { operador: 'centurion:usuario9', envios: 40, personas: 30, leidos: 26, automaticos: 0 },
        { operador: 'centurion:usuario7', envios: 35, personas: 15, leidos: 27, automaticos: 0 },
        { operador: 'centurion:usuario3', envios: 32, personas: 15, leidos: 30, automaticos: 0 },
        { operador: 'usuario2', envios: 31, personas: 20, leidos: 0, automaticos: 0 },
        { operador: 'centurion:usuario1', envios: 19, personas: 7, leidos: 11, automaticos: 0 },
      ],
    });
  }

  /**
   * LO QUE LA FICHA DE UN LEAD DE FORMULARIO PREGUNTA. Desde el 8-ago-2026 un
   * clic en una fila de landing abre la hoja al costado en vez de mandar al
   * buscador, así que la galería tiene que responder estos dos o la evidencia
   * mostraría una ficha vacía y no se vería lo que el frente vino a resolver:
   * **de dónde vino y cuándo llenó**.
   *
   * El `campana` es el que sale del arreglo de `dashboard/fuenteLead.ts` — el
   * nombre del diploma, no el `icarus:landing` que se veía antes.
   */
  if (url.includes('/api/contactos/lead')) {
    return respuesta({
      lead: {
        nombre: 'Edward Rodríguez Acevedo',
        // ⚠️ `web` es el valor REAL del contrato (`gente/emparejar.ts`), no
        // `landing`: el vocabulario interno y la palabra que se lee son dos
        // cosas, y `origenDeLead` es quien traduce. Poner acá un valor que el
        // server no manda hacía que la ficha dijera «Meta Ads» sobre un lead de
        // landing — o sea, la galería probaba un caso que no existe.
        fuente: 'web',
        campana: 'Diploma Internacional del Consultor Político',
        anuncio: null,
        fecha: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      },
    });
  }
  /**
   * 🔴 LO QUE LA HOJA PIDE PARA PODER DIBUJARSE, Y QUE ESTA GALERÍA NO SERVÍA.
   *
   * `HojaContacto` monta `PasarConversacion`, que lee `/api/reparto/rueda` sin
   * guarda (`q.data?.destinos.length`). Sin estas dos respuestas la ficha del
   * Dashboard **reventaba al abrirse** —«Cannot read properties of undefined»,
   * el árbol de React caído entero— así que la galería podía fotografiar el
   * radar y nada más: justo la mitad que este frente vino a cambiar. Es la
   * regla dura #10 en vivo: una galería que no sirve lo que la pantalla pide de
   * verdad no es evidencia de nada.
   */
  if (url.includes('/api/reparto/rueda')) {
    return respuesta({ linea: '51984429504', rueda: [], destinos: ['luz', 'ana'], nombres: { luz: 'Luz', ana: 'Ana' } });
  }
  if (url.includes('/api/whatsapp/lineas')) {
    return respuesta({ lineas: [{ numero: '51984429504', etiqueta: 'Ventas', estado: 'conectado' }] });
  }
  // Un lead de formulario que todavía no compró: Cerberus no lo conoce, y eso
  // es un estado normal —no un error— que la ficha tiene que saber dibujar.
  if (url.includes('/api/contactos/ficha')) return respuesta({ estado: 'no_encontrado' });
  if (url.includes('/api/senales')) return respuesta({ senales: {}, umbralDias: 3 });
  if (url.includes('/api/gestiones/intereses')) return respuesta({ lista: [], derivados: [] });
  if (url.includes('/api/eventos')) return respuesta({ eventos: [] });

  const cuerpo = url.includes('/api/agenda')
    ? { recordatorios: [] }
    : url.includes('/api/dashboard/negocio')
    ? // Solo el supervisor llega acá: la vendedora ni lo pide (la solapa no existe)
      // y el server le respondería 403.
      { porCurso: [], porAnuncio: [], totales: null, periodo: '7d' }
    : {
        chats: VACIO ? [] : chats(SUPERVISOR ? 6 : 3),
        // 🔴 Los formularios NO viajan con recorte personal: un lead de
        // formulario no tiene dueño posible.
        formularios: SUPERVISOR ? formularios() : [],
        etapas: {},
        etiquetas: {},
        porVendedora: SUPERVISOR ? EQUIPO_COMPLETO : [EQUIPO_COMPLETO[1]],
        automaticos: SUPERVISOR ? { mensajes_hoy: 412, mensajes_7d: 2103, quienes: ['bot', 'goberna-admin'] } : null,
        // 🔴 Los valores REALES de producción, medidos en el issue #329 —no el
        // caso ideal—: `sin_respuesta` es el 65 % del embudo (2.576 de 3.973)
        // y hasta este fix ni se sumaba ni se dibujaba (el radar mostraba
        // 1.397). Una galería que sirve solo las cinco declarables ya escondió
        // este defecto una vez.
        embudo: VACIO
          ? {}
          : CAMPANA
            ? // La escalera de campaña (ADR 0063): sin `cotizado` ni `cierre` —
              // en campaña no hay plata que derivar. Las cifras son del orden
              // real de la línea de Betto (40 conversaciones en 30 días).
              { sin_respuesta: 9, interesado: 11, contactado: 17, simpatiza: 8, comprometido: 3, voluntario: 1 }
            : SUPERVISOR
              ? { sin_respuesta: 2576, interesado: 377, contactado: 217, cotizado: 790, cierre: 13, perdido: 0 }
              : { sin_respuesta: 11, interesado: 4, contactado: 22, cotizado: 9, cierre: 1, perdido: 2 },
        cursos: VACIO
          ? []
          : SUPERVISOR
            ? [
                { curso: 'Diplomado en Gestión Pública', n: 84 },
                { curso: 'Inteligencia y Contrainteligencia', n: 61 },
                { curso: 'Foro de Estado', n: 22 },
              ]
            : [
                { curso: 'Diplomado en Gestión Pública', n: 6 },
                { curso: 'Foro de Estado', n: 2 },
              ],
        // ⚠️ Con `?vacio=1` las series van en CERO, no vacías: el server manda
        // siempre los 14 puntos (los días sin datos en 0, «el front no inventa
        // continuidad»). Una lista vacía dispara el aviso «todavía no llega ·
        // para sistemas», que es un mensaje de cableado roto — y le estaría
        // mintiendo a una vendedora nueva sobre un estado que es normal.
        series: VACIO
          ? {
              leads_dia: SERIE(0).map((p) => ({ dia: p.dia, chats: 0, comentarios: 0, formularios: 0 })),
              envios_dia: SERIE(0).map((p) => ({ dia: p.dia, n: 0 })),
              ventas_dia: SERIE(0).map((p) => ({ dia: p.dia, n: 0 })),
            }
          : {
          leads_dia: SERIE(SUPERVISOR ? 18 : 4).map((p) => ({
            dia: p.dia,
            chats: p.n,
            comentarios: SUPERVISOR ? Math.floor(p.n / 3) : 0,
            formularios: SUPERVISOR ? Math.floor(p.n / 4) : 0,
          })),
          envios_dia: SERIE(SUPERVISOR ? 40 : 12),
          ventas_dia: SERIE(SUPERVISOR ? 4 : 1),
        },
        // De quién es lo que viajó. La pantalla no lo decide: lo dibuja.
        supervisor: SUPERVISOR,
        ...(SUPERVISOR ? {} : { soloMisAsignadas: true }),
      };

  return respuesta(cuerpo);
}) as typeof fetch;

function respuesta(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <VistaDashboard
          onAbrir={() => {}}
          onBuscarPersona={() => {}}
          onIrAgenda={() => {}}
          miVendedora={
            CAMPANA ? 'centurion:betto.romero' : SUPERVISOR ? 'ventas10@grupogoberna.com' : 'ventas11@grupogoberna.com'
          }
          esDeCampana={CAMPANA}
        />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
