import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { VistaEmbudo } from './VistaEmbudo';
import { semaforoDe, type EntradaSemaforo } from '../../dominio/semaforo';
import type { FilaDesglose } from '../../dominio/desglose';
import { TituloDeSeccion } from '../../components/TituloDeSeccion';
import { CONTEOS_PROD_2026_09_10, DESGLOSE_PROD_2026_09_10 } from './galeriaDatosProd';
import { LEYENDA_SEMAFORO } from './resumen';
import type { PuentePipeline } from './puentePipeline';
import { esRecorteDelDia, type RecorteDelDia } from '../../dominio/recortesDelDia';
import { tableroDeCampana } from './galeriaCampana';

/**
 * LA GALERÍA DEL PIPELINE — la evidencia de la ficha al costado, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-embudo.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-embudo.html
 *     …/galeria-embudo.html?ficha=1 → con la hoja de la ficha abierta
 *     …?vista=lista     → la Lista en vez del Tablero
 *     …?luz=verde       → con esa luz de la leyenda puesta (el recorte de la mesa)
 *     …?hoy=1           → siembra `nacioHoy` («N nuevas hoy» y «N hoy» por columna)
 *     …?supervisor=1    → las líneas dicen `veTodo`: la dueña en cada tarjeta y el filtro de la Lista
 *     …?rango=hoy       → toca ese rango de la fila de arriba (`hoy` · `d7`): `franjaEn=*`
 *     …?puente=sinRespuesta24h → abre como lo abre el Dashboard (`escribioHoy` · `sinRespuesta24h`)
 *     …?servidorViejo=1 → el tablero no publica `recortesDisponibles`: rango apagado, el puente avisa
 *     …?campana=1       → el tablero de campaña, con lo medido de Betto y Américo (`galeriaCampana.ts`)
 *                          y `mesaPorCanal`; con `&servidorViejo=1`, sin él
 *
 * Existe por la regla dura #2, y sobre todo para poder mirar UNA cosa a
 * 1280×720: el `GRID` del tablero declara mínimos que suman **1.000 px** y la
 * hoja se lleva 360. Ése es el ancho donde se decide si la hoja podía empujar
 * las columnas o tenía que superponerse — y la captura es la única forma de
 * verificar que la respuesta elegida no rompe el tablero.
 */

const PARAMS = new URLSearchParams(location.search);

/**
 * Las columnas, con los conteos REALES de producción del 10-sep-2026
 * (`galeriaDatosProd.ts`): Te esperan 1.109 · Nunca contestaron 7.505 ·
 * Contestaron 421 · Saben el precio 3.410 · Compraron 86.
 */
const POR_ETAPA: Record<string, number> = CONTEOS_PROD_2026_09_10;

/**
 * ⚠️ **LOS SILENCIOS, UNO POR UNO** — y no un número suelto (7.505, los de
 * `POR_ETAPA.sin_respuesta` en la foto de producción del 10-sep-2026).
 *
 * La franja de tiempo (`franja.ts`) se prueba contando: «últimos 30 min» tiene
 * que dar un puñado y «hoy» un par de cientos. Con un total inventado por franja,
 * la captura probaría que sé escribir constantes, no que el filtro filtra. Así
 * que la galería siembra un INSTANTE por silencio y el stub los cuenta como los
 * contaría postgres — el mismo `ultimo_at >= desde` de `consultarCola.ts`.
 *
 * El reparto es parejo sobre los 30 días que mira la cola: 7.505 / 30 ≈ 250 por
 * día, ≈ 10 por hora. No es la forma real de un día de trabajo (que se apelotona
 * de mañana), y no hace falta que lo sea: lo que la captura tiene que mostrar es
 * que la cifra CAMBIA y que la lista es la de esa franja.
 */
const MINUTOS_DE_LA_COLA = 30 * 24 * 60;
/**
 * Y un instante por conversación en CADA columna: fecha las tarjetas y cuenta la
 * franja de «Cuándo». ⚠️ **El TOTAL del rango de arriba no sale de acá**: sale de
 * lo medido en producción (`MEDIDO_2026_09_10_0710`). Esto sólo elige qué
 * tarjetas se dibujan y con qué «hace».
 *
 * 🔴 **Las que nacieron hoy (`?hoy=1`) caen HOY**, y el resto parejo en los 30
 * días: una conversación que nació hoy tiene mensajes de hoy, y repartidas por
 * igual la galería se contradecía en la misma fila. Se arma al primer pedido y no
 * al cargar el módulo, porque el desglose se declara más abajo.
 */
const INSTANTES_POR_ETAPA = new Map<string, number[]>();
function instantesDe(etapa: string): number[] {
  const hechos = INSTANTES_POR_ETAPA.get(etapa);
  if (hechos) return hechos;
  const n = POR_ETAPA[etapa] ?? 0;
  const nacidas = DESGLOSE.filter((f) => f.etapa === etapa && f.nacioHoy).reduce((s, f) => s + f.n, 0);
  const deHoy = Math.min(n, nacidas);
  const ahora = Date.now();
  const medianoche = new Date(ahora).setHours(0, 0, 0, 0);
  const hoy = Array.from({ length: deHoy }, (_, i) => ahora - ((i + 0.5) * (ahora - medianoche)) / deHoy);
  const resto = Array.from(
    { length: n - deHoy },
    (_, i) => ahora - (((i + 0.5) * MINUTOS_DE_LA_COLA) / (n - deHoy)) * 60_000,
  );
  const todos = [...hoy, ...resto].sort((a, b) => b - a);
  INSTANTES_POR_ETAPA.set(etapa, todos);
  return todos;
}

/**
 * CUÁNTAS DEJA CADA RECORTE — contadas sobre el desglose real, fila por fila,
 * como las contaría el server. Así la cabecera de la columna («764 de 3.410») y
 * la lista que se ve salen de la MISMA foto, y no de dos constantes que se pueden
 * desalinear (hasta el 10-sep-2026 eran números del 8-ago escritos a mano).
 */
const CAMPO_DE_RECORTE = { ventana: 'ventana', seguir: 'paraSeguir', precio: 'precio', seCallo: 'seCallo' } as const;
/**
 * EL RANGO Y LOS RECORTES DEL DÍA (#946), MEDIDOS EN PRODUCCIÓN — no sembrados.
 *
 * Los midió hermes-97 el 10-sep-2026 a las 07:10 de Lima (12:10:24Z): el
 * `consultarCola` de `integracion-arm-crm`, que ya trae #946, contra la base de
 * producción, como la supervisora de Ventas y cada pedido en su transacción con
 * ROLLBACK. Producción todavía no corre #946, así que no hay API que lo sirva.
 * «7 d» es ahora − 7×24 h, igual que `limitesDe('d7')`.
 *
 * ⚠️ A las 7 a. m. «Hoy» y «escribió hoy» salen bajos: el día recién empieza.
 * ⚠️ **Los CRUCES no están medidos** (`totalDelRango`): «Hoy» × «sin respuesta >
 * 24 h» = 0 y «7 d» × «escribió hoy» = «escribió hoy» salen de las definiciones, y
 * «7 d» × «sin respuesta > 24 h» es una COTA: el menor de los dos.
 * ⚠️ El 0 de «Nunca contestaron» en los dos recortes del día no es un hueco: esa
 * columna es «le escribimos y nunca escribió», y los dos piden a alguien que sí
 * escribió.
 */
const MEDIDO_2026_09_10_0710: Record<'hoy' | 'd7' | RecorteDelDia, Record<string, number>> = {
  hoy: { interesado: 48, sin_respuesta: 0, contactado: 0, cotizado: 18, cierre: 1 },
  d7: { interesado: 442, sin_respuesta: 5103, contactado: 209, cotizado: 2448, cierre: 55 },
  escribioHoy: { interesado: 42, sin_respuesta: 0, contactado: 0, cotizado: 5, cierre: 0 },
  sinRespuesta24h: { interesado: 467, sin_respuesta: 0, contactado: 3, cotizado: 240, cierre: 23 },
};
function totalDeRecorte(etapa: string, recorte: string): number {
  if (esRecorteDelDia(recorte)) return MEDIDO_2026_09_10_0710[recorte][etapa] ?? 0;
  const campo = CAMPO_DE_RECORTE[recorte as keyof typeof CAMPO_DE_RECORTE];
  if (!campo) return 0;
  return DESGLOSE.filter((f) => f.etapa === etapa && f[campo]).reduce((s, f) => s + f.n, 0);
}

/**
 * El total de una columna con el rango de arriba puesto, de lo medido. El rango
 * CONVIVE con un recorte del día, y el server da la intersección.
 */
function totalDelRango(etapa: string, recorte: string | undefined, desde: number): number {
  const rango = desde >= new Date().setHours(0, 0, 0, 0) ? 'hoy' : 'd7';
  const delRango = MEDIDO_2026_09_10_0710[rango][etapa] ?? 0;
  if (!esRecorteDelDia(recorte)) return delRango;
  // «Escribió hoy» cae entero adentro de cualquier rango: tiene mensajes de hoy.
  if (recorte === 'escribioHoy') return MEDIDO_2026_09_10_0710.escribioHoy[etapa] ?? 0;
  // «Sin respuesta > 24 h» no tiene mensajes en las últimas 24 h: «Hoy» no deja a nadie.
  if (rango === 'hoy') return 0;
  // ⚠️ «7 d» × «sin respuesta > 24 h» NO está medido todavía: se sirve la cota, el menor de los dos.
  return Math.min(delRango, MEDIDO_2026_09_10_0710.sinRespuesta24h[etapa] ?? 0);
}

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


/**
 * LOS OCHO CASOS REALES DEL SEMÁFORO DE VENTAS — y por qué están acá.
 *
 * 🔴 **Hasta el 9-set-2026 esta galería no fijaba `luz` en absoluto**, así que
 * las tarjetas salían todas grises y la pieza más cara del Pipeline no tenía
 * evidencia posible. Una galería que no sirve los valores REALES de producción
 * no es evidencia (candado 10 del CLAUDE.md), y ésta ni siquiera servía uno.
 *
 * Los textos son literales de la cola de producción del 8 y 9 de setiembre (las
 * piezas `osint_socmint_*` y `agente_ia_*`). Las SEÑALES son las que el server
 * manda en la fila; la LUZ la calcula `semaforoDe`, que es exactamente la regla
 * que cambió — así que esta galería muestra el cambio, no un dibujo de él.
 *
 * Los seis del medio son los que se ven distinto antes y después:
 * un contestador de empresa y un ex-cliente pasan de VERDE a gris, el curso del
 * formulario pasa de VERDE a ámbar (y sólo si contestó), el rechazo nuevo entra
 * al rojo, y quien rechazó en julio y volvió a preguntar el precio deja de estar
 * enterrado en rojo.
 */
const SIN_SENAL: EntradaSemaforo = {
  hablo: false,
  entranteConSustancia: false,
  preguntoPrecio: false,
  nombroUnCurso: false,
  dijoQueNo: false,
  autoRespuestaDeNegocio: false,
  incoherente: false,
  perdidoDeclarado: false,
  botTemperatura: null,
  enfriada: false,
};

const CASOS_REALES: ReadonlyArray<{
  texto: string;
  senales: Partial<EntradaSemaforo>;
  /** El nivel del padrón, para el chip «Cliente» — que ahora vive en la tarjeta. */
  cliente?: { nivel: string; compras: number };
}> = [
  {
    texto: '¿Cuánto cuesta el diploma? Quiero inscribirme',
    senales: { hablo: true, entranteConSustancia: true, preguntoPrecio: true },
  },
  {
    // Antes: gris. El diccionario de ocho frases no lo veía.
    texto: 'Ya no necesito que me envíen nada',
    senales: { hablo: true, entranteConSustancia: true, dijoQueNo: true },
  },
  {
    // El «ahora no» del dueño: ámbar, nunca rojo.
    texto: 'Más adelante tal vez',
    senales: { hablo: true, entranteConSustancia: true },
  },
  {
    // Antes VERDE, porque su saludo automático menciona precios.
    texto: 'Gracias por comunicarse con BALISTIK SEGURIDAD INTEGRAL. Consulte precios y formas de pago',
    senales: { hablo: true, entranteConSustancia: true, preguntoPrecio: true, autoRespuestaDeNegocio: true },
  },
  {
    // Antes VERDE por «compró». Era el 79 % de los verdes.
    texto: null as unknown as string,
    senales: {},
    cliente: { nivel: 'recompro', compras: 3 },
  },
  {
    // Antes VERDE por el curso del formulario, sin haber dicho una palabra.
    texto: null as unknown as string,
    senales: { nombroUnCurso: true },
  },
  {
    // Antes VERDE; ahora ámbar, que es el limbo que el dueño describió.
    texto: 'Estoy revisando mis horarios estas semanas, después te cuento',
    senales: { hablo: true, entranteConSustancia: true, nombroUnCurso: true },
  },
  {
    // 🔴 EL CASO QUE ESTABA ENTERRADO: rechazó en julio y hoy pregunta el precio.
    // Antes ROJO para siempre, y «Atender siguiente» nunca abre un rojo.
    texto: '¿Sigue abierta la inscripción? ¿Cuánto cuesta?',
    senales: { hablo: true, entranteConSustancia: true, preguntoPrecio: true, dijoQueNo: true },
  },
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

/**
 * LO QUE EL BOT CALIFICÓ, con la proporción real de producción.
 *
 * Medido el 7-sep-2026 sobre `bot_calificaciones`: **85 filas, 51 calientes y 34
 * tibias**, y sólo sobre la línea «Ventas Meta» —la única de Cloud API, el 9 %
 * de los entrantes—. Por eso acá la mayoría de las tarjetas NO trae veredicto:
 * una galería donde todas están calificadas mostraría una columna que no existe.
 *
 * Las tres sembradas son las tres que hay que poder mirar en la misma captura:
 *
 *   · **i = 0 · tibia** — y ES LA PRIMERA a propósito, porque `?ficha=1` abre la
 *     hoja de ésa. La tarjeta NO dibuja nada (tibio y frío no entran a una
 *     lista) y la ficha SÍ: es exactamente el tercio del dato que hasta el
 *     7-sep-2026 no se veía en ninguna pantalla de Hermes, y la única forma de
 *     probar las dos mitades de la decisión con una sola foto.
 *   · **i = 1 · escalada por «por_cerrar», y además caliente** — el chip rojo, el
 *     hecho más caro de la tabla. En la tarjeta gana la escalada (entra un
 *     chip); en la ficha se ven los dos.
 *   · **i = 4 · caliente** con el motivo en texto libre del modelo, que es como
 *     viene cuando calificó sin escalar.
 */
function veredictoDelBot(i: number) {
  if (i === 0) return { bot_temperatura: 'tibio', bot_motivo: 'preguntó por el temario y la duración, todavía no por el precio' };
  if (i === 1) return { bot_escalada: true, bot_temperatura: 'caliente', bot_motivo: 'por_cerrar' };
  if (i === 4) return { bot_temperatura: 'caliente', bot_motivo: 'pidió el precio y la forma de pago en cuotas' };
  return {};
}

/**
 * LOS CASOS REALES QUE ESTA COLUMNA PUEDE MOSTRAR: sólo los de una luz que la
 * columna tiene de verdad en el desglose de producción. Sin esto, con «Verdes»
 * puesto, «Nunca contestaron» decía «0 de 7.505» encima de una tarjeta verde —
 * la galería contradiciéndose en la misma captura (lo mostró la captura).
 */
function casosDeEtapa(etapa: string) {
  const luces = new Set(DESGLOSE.filter((f) => f.etapa === etapa && f.n > 0).map((f) => f.luz));
  return CASOS_REALES.filter((caso) => luces.has(semaforoDe({ ...SIN_SENAL, ...caso.senales }).luz));
}

/**
 * A QUIÉN ESTÁ ASIGNADA — con la forma medida el 10-sep-2026: vacío en casi toda
 * la mesa, salvo «Compraron» (45 %). Por eso sólo se siembra ahí, en la mitad de
 * sus tarjetas, y con dos personas del equipo: «Sin asignar» tiene que verse bien
 * porque es lo que más se va a ver.
 */
function asignadaDeGaleria(etapa: string, i: number): string | null {
  if (etapa !== 'cierre' || i % 2 !== 0) return null;
  return i % 4 === 0 ? 'sindy.rojas' : 'luz';
}

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
    /**
     * EL SEMÁFORO DE VENTAS, DERIVADO — no clavado. Las primeras ocho tarjetas
     * de cada columna son los casos reales de producción; el resto queda sin
     * señal, que es como se ve la mayoría de la mesa.
     */
    const real = casosDeEtapa(etapa)[i] ?? null;
    const sem = semaforoDe({ ...SIN_SENAL, ...(real?.senales ?? {}) });
    return {
      luz: sem.luz,
      porque: sem.porque,
      origen_semaforo: sem.origen ?? null,
      cliente_nivel: real?.cliente?.nivel ?? null,
      cliente_compras: real?.cliente?.compras ?? null,
      asignada_a: asignadaDeGaleria(etapa, i),
      clave: `conv:whatsapp:${telefono}:${LINEAS[0].numero}`,
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: telefono,
      persona_nombre: nombre,
      lead_nombre: nombre,
      numero_propio: LINEAS[0].numero,
      texto: real ? real.texto : i % 3 === 0 ? '¿me puede pasar más información del diplomado?' : null,
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
      // El veredicto del bot viaja en la MISMA fila que todo lo demás: `GET /` y
      // `GET /tablero` comparten `consultarCola`, así que esto no es un dato de
      // galería, es la forma real de la respuesta.
      ...veredictoDelBot(i),
    };
  });
}

/**
 * EL DESGLOSE — el de producción del 10-sep-2026, literal (`galeriaDatosProd.ts`).
 *
 * ⚠️ **`?hoy=1` SIEMBRA `nacioHoy`**: el server ya lo cuenta (#946), pero esta
 * foto de producción es de antes, y las capturas que lo usan lo dicen. No se
 * combina con el rango de arriba, que sirve lo medido a las 7 a. m.: 2.175 nuevas
 * no entran en los 48 con mensajes de hoy. Los números salen de lo
 * medido, no de un caso ideal: en «Nunca contestaron» nacieron 2.175 —la
 * difusión de ese día, medida por la sesión orquestadora—. En «Te esperan» se
 * marcan las que escribieron en las últimas 24 h y a las que nunca les habíamos
 * hablado (`viva` y no `yaLeHablamos`, 83). Es una APROXIMACIÓN: nacer hoy es el
 * primer mensaje de la historia, y `viva` sólo mira el último entrante. Las demás
 * columnas quedan en cero. Sin `?hoy=1` la galería muestra lo que ve hoy
 * producción: la frase de siempre, sin «nuevas hoy».
 */
const DESGLOSE: FilaDesglose[] = PARAMS.has('hoy') ? conNacioHoy(DESGLOSE_PROD_2026_09_10) : DESGLOSE_PROD_2026_09_10;

function conNacioHoy(filas: readonly FilaDesglose[]): FilaDesglose[] {
  let difusionPorRepartir = 2175;
  return filas.flatMap((f): FilaDesglose[] => {
    if (f.etapa === 'interesado') return [{ ...f, nacioHoy: f.viva && !f.yaLeHablamos }];
    if (f.etapa !== 'sin_respuesta' || difusionPorRepartir === 0) return [{ ...f, nacioHoy: false }];
    // Una fila del desglose es un conteo: partirla en dos no inventa gente, sólo
    // dice cuántas de esas nacieron hoy.
    const deHoy = Math.min(f.n, difusionPorRepartir);
    difusionPorRepartir -= deHoy;
    return deHoy === f.n
      ? [{ ...f, nacioHoy: true }]
      : [
          { ...f, n: deHoy, nacioHoy: true },
          { ...f, n: f.n - deHoy, nacioHoy: false },
        ];
  });
}

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
 * porque aplicada a todas vaciaría las columnas que la vendedora no tocó. Con
 * `franjaEn=*` —el rango de la fila de arriba, #946— se aplica a todas porque
 * alguien lo pidió.
 */
function franjaDe(
  q: URLSearchParams,
  etapa: string,
): { desde: number; hasta: number | null; enTodas: boolean } | null {
  const desde = q.get('desde');
  const en = q.get('franjaEn');
  if (!desde || (en !== etapa && en !== '*')) return null;
  const hasta = q.get('hasta');
  return { desde: new Date(desde).getTime(), hasta: hasta ? new Date(hasta).getTime() : null, enTodas: en === '*' };
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
 * `instantesDe`): es lo que hace que «Últimos 30 minutos · 3 de
 * 4.491» sea una medición del filtro y no un número escrito a mano.
 */
function paginaDe(etapa: string, recorte: string | undefined, franja: ReturnType<typeof franjaDe>) {
  const dentro = franja
    ? instantesDe(etapa).filter((t) => t >= franja.desde && (franja.hasta == null || t < franja.hasta))
    : null;
  const total = totalDePagina(etapa, recorte, franja, dentro);
  const tope = dentro || etapa === 'contactado' || etapa === 'interesado' ? 8 : 4;
  const cuantas = Math.min(total, tope);
  // Las tarjetas se fechan con el recorte del día si hay uno, si no con la
  // franja; con menos instantes que tarjetas, con el reparto genérico.
  const fechas = instantesDelRecorte(etapa, recorte) ?? dentro;
  const instantes = fechas && fechas.length >= cuantas ? fechas : undefined;
  return { conversaciones: tarjetas(etapa, cuantas, instantes), total, hayMas: total > cuantas };
}

/** Cuántas hay en la columna pedida, tomado de donde es verdadero. */
function totalDePagina(
  etapa: string,
  recorte: string | undefined,
  franja: ReturnType<typeof franjaDe>,
  dentro: number[] | null,
): number {
  // El rango de arriba (`franjaEn=*`): lo medido en producción.
  if (franja?.enTodas) return totalDelRango(etapa, recorte, franja.desde);
  // La franja de «Cuándo»: contada instante por instante.
  if (dentro) return dentro.length;
  if (recorte) return totalDeRecorte(etapa, recorte);
  return POR_ETAPA[etapa] ?? 0;
}

/**
 * Un recorte del día fecha sus tarjetas como el recorte dice: «sin respuesta hace
 * más de 24 h» encima de una tarjeta de «hace 2 h» sería la captura
 * contradiciéndose a sí misma. `null` = cualquier otro recorte, que no fecha nada.
 */
function instantesDelRecorte(etapa: string, recorte: string | undefined): number[] | null {
  if (recorte === 'sinRespuesta24h') return instantesDe(etapa).filter((t) => Date.now() - t > 86_400_000);
  if (recorte === 'escribioHoy') return instantesDe(etapa).filter((t) => t >= new Date().setHours(0, 0, 0, 0));
  return null;
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
    return respuesta({ lineas: LINEAS, veTodo: PARAMS.has('supervisor') });
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
    // `?campana=1`: la mesa de Betto y Américo, con lo medido en producción
    // (`galeriaCampana.ts`). Nunca la foto de ventas: «no combines Escuela con campaña».
    if (PARAMS.has('campana')) {
      return respuesta(tableroDeCampana(q, Date.now(), { servidorViejo: PARAMS.has('servidorViejo') }));
    }
    const columnas: Record<string, unknown> = {};
    for (const pedida of (q.get('columnas') ?? '').split(',').filter(Boolean)) {
      const [etapa, recorte] = pedida.split(':');
      columnas[etapa] = paginaDe(etapa, recorte, franjaDe(q, etapa));
    }
    return respuesta({
      columnas,
      conteos: POR_ETAPA,
      desglose: DESGLOSE,
      // La lista del server de #946, tal cual (`cola/recortesDeColumna.ts`).
      ...(PARAMS.has('servidorViejo')
        ? {}
        : { recortesDisponibles: ['precio', 'ventana', 'seguir', 'seCallo', 'nacioHoy', 'escribioHoy', 'sinRespuesta24h'] }),
    });
  }

  if (url.includes('/api/conversaciones')) {
    // «Ver más» en campaña: la galería no tiene una página 2 medida que servir, y la de
    // ventas mezclaría la Escuela en el tablero de campaña.
    if (PARAMS.has('campana')) return respuesta({ conversaciones: [], hayMas: false });
    const q = new URL(url, location.origin).searchParams;
    const etapa = q.get('etapa') ?? 'contactado';
    const recorte = ['ventana', 'seguir', 'precio', 'seCallo', 'escribioHoy', 'sinRespuesta24h'].find(
      (r) => q.get(r) === '1',
    );
    return respuesta({
      ...paginaDe(etapa, recorte, franjaDe(q, etapa)),
      conteos: POR_ETAPA,
      desglose: DESGLOSE,
    });
  }

  // #1033 — el panel lee UNA consulta de perfil, con la misma ficha y el mismo formulario de abajo.
  const cuerpo = url.includes('/api/contactos/perfil')
    ? {
        ficha: FICHA_CERBERUS,
        lead: {
          nombre: 'Javier Peralta Ríos',
          fuente: 'meta',
          campana: 'Gestión Pública · julio',
          anuncio: 'Adquiérelo ahora',
          fecha: '2026-07-02T15:12:00.000Z',
        },
        padron: null,
        errores: [],
      }
    : url.includes('/api/contactos/ficha')
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
 * `?seguir=1` toca el chip «Para seguir» de «Saben el precio» — la columna pasa
 * de 3.410 tarjetas a 764, con el total todavía a la vista.
 */
if (PARAMS.has('seguir')) {
  setTimeout(() => {
    const chips = document.querySelectorAll<HTMLElement>('section[aria-label="Saben el precio"] button[aria-pressed]');
    for (const chip of chips) {
      if (chip.textContent?.startsWith('Para seguir')) {
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

/**
 * `?vista=lista` abre en la Lista: la preferencia vive en `localStorage`, igual
 * que en la app, así que se escribe ANTES del primer render. `?luz=verde` toca esa
 * luz de la leyenda, el mismo botón que toca la vendedora.
 */
if (PARAMS.has('vista')) {
  try {
    window.localStorage.setItem('hermes.embudo.vista', JSON.stringify(PARAMS.get('vista') === 'lista' ? 'lista' : 'tablero'));
  } catch {
    /* sin storage: abre en el tablero */
  }
}

if (PARAMS.has('luz')) {
  const rotulo = LEYENDA_SEMAFORO.find((l) => l.luz === PARAMS.get('luz'))?.label;
  setTimeout(() => {
    [...document.querySelectorAll<HTMLElement>('section[aria-label="Resumen del tablero"] button')]
      .find((b) => rotulo != null && b.textContent?.trim().startsWith(rotulo))
      ?.click();
  }, 700);
}

/**
 * `?rango=hoy` (o `d7`) toca ese botón de la fila de arriba, el mismo que toca la
 * vendedora. Después del puente, que aplica su recorte con la primera respuesta.
 */
if (PARAMS.has('rango')) {
  const rotulo = PARAMS.get('rango') === 'd7' ? '7 d' : PARAMS.get('rango') === 'cola' ? '30 d' : 'Hoy';
  setTimeout(() => {
    [...document.querySelectorAll<HTMLElement>('section[aria-label="Resumen del tablero"] [role="group"][aria-label="Rango"] button')]
      .find((b) => b.textContent?.trim() === rotulo)
      ?.click();
  }, 900);
}

/**
 * `?puente=escribioHoy` (o `sinRespuesta24h`): el Pipeline abierto desde una
 * cifra de «Hoy» del Dashboard. Constante de módulo: el puente se consume una vez.
 */
const PUENTE: PuentePipeline | null =
  PARAMS.get('puente') === 'escribioHoy'
    ? { tipo: 'pipeline', recorte: { escribioHoy: true } }
    : PARAMS.get('puente') === 'sinRespuesta24h'
      ? { tipo: 'pipeline', recorte: { sinRespuesta24h: true } }
      : null;
const consumirPuente = () => {};

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
        {/* `?campana=1`: el tablero de campaña, con su fila de canales y las cabeceras
            por canal (13-sep-2026), servido con lo medido en producción el 13-sep-2026
            (`galeriaCampana.ts`). Simpatizan, Se comprometieron y Son voluntarios salen
            vacías porque en producción también lo están. */}
        <VistaEmbudo
          onAbrir={() => {}}
          recorteInicial={PUENTE}
          onConsumido={consumirPuente}
          esDeCampana={PARAMS.has('campana')}
        />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
