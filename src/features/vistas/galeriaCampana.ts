import type { FilaDesglose } from '../../dominio/desglose';
import { semaforoDe, type EntradaSemaforo } from '../../dominio/semaforo';
import { filasDelCanal } from './canalDeMesa';

/**
 * LA GALERÍA DEL PIPELINE DE CAMPAÑA (`?campana=1`) — la mesa de Betto y Américo, sin
 * nada de la Escuela.
 *
 * Pedido del dueño (13-sep-2026), al ver una captura con «¿Cuánto cuesta el diploma?» y
 * «Formulario · Inteligencia y…» en el tablero de campaña: «no combines Escuela con
 * campaña Américo». En producción la frontera ya separa los dos (ADR 0061/0081); la que
 * los mezclaba era la galería, que pintaba la foto de VENTAS en el tablero de campaña.
 * Ventas sigue sirviendo `galeriaDatosProd.ts`.
 *
 * ── QUÉ ES MEDIDO Y QUÉ NO (candado 10) ────────────────────────────────────────
 *  · **Medido el 13-sep-2026 en producción (sólo lectura), por hermes-d0**: los `n` por
 *    etapa × canal · tipo de «Hoy», «nacieron hoy» y 30 días
 *    (`MEDIDO_CAMPANA_2026_09_13`), y los textos de `MENSAJES_CAMPANA_2026_09_13`, tal
 *    cual y recortados a 90 caracteres. ⚠️ La medición es una APROXIMACIÓN por último
 *    mensaje: `interesado` = el último es entrante y sin respuesta; `contactado` = el
 *    último es saliente. Los nombres van recortados a nombre e inicial, a propósito:
 *    ni apellidos ni números en el repo.
 *  · **No medido**: la luz de cada fila (se reparte con `PARTE_DE_LUZ`), «7 d» (se
 *    interpola entre «Hoy» y 30 días) y qué tarjeta lleva qué texto (se reparten en
 *    ciclo). La cifra de cada columna sí sale de lo medido: es la suma del desglose con
 *    la misma regla con la que el server recorta la columna (`filasDelCanal`, #37).
 *  · Simpatizan, Se comprometieron y Son voluntarios: 0 en toda la historia (nadie los
 *    declaró todavía). Esas columnas vacías SON la foto real.
 */

type Canal = 'whatsapp' | 'facebook' | 'instagram';
type Tipo = 'mensaje' | 'comentario';
type Luz = 'verde' | 'ambar' | 'gris' | 'rojo';

interface Medicion {
  etapa: string;
  canal: Canal;
  tipo: Tipo;
  hoy: number;
  nacieronHoy: number;
  treintaDias: number;
}

/** Betto + Américo, por etapa × canal · tipo. `sin_respuesta` no es columna en campaña, pero el server la cuenta. */
export const MEDIDO_CAMPANA_2026_09_13: readonly Medicion[] = [
  { etapa: 'interesado', canal: 'facebook', tipo: 'comentario', hoy: 320, nacieronHoy: 320, treintaDias: 11185 },
  { etapa: 'contactado', canal: 'facebook', tipo: 'comentario', hoy: 3, nacieronHoy: 3, treintaDias: 693 },
  { etapa: 'interesado', canal: 'facebook', tipo: 'mensaje', hoy: 6, nacieronHoy: 2, treintaDias: 154 },
  { etapa: 'contactado', canal: 'facebook', tipo: 'mensaje', hoy: 0, nacieronHoy: 0, treintaDias: 45 },
  { etapa: 'sin_respuesta', canal: 'facebook', tipo: 'mensaje', hoy: 0, nacieronHoy: 0, treintaDias: 129 },
  { etapa: 'interesado', canal: 'instagram', tipo: 'comentario', hoy: 0, nacieronHoy: 0, treintaDias: 1 },
  { etapa: 'interesado', canal: 'whatsapp', tipo: 'mensaje', hoy: 5, nacieronHoy: 5, treintaDias: 192 },
  { etapa: 'contactado', canal: 'whatsapp', tipo: 'mensaje', hoy: 0, nacieronHoy: 0, treintaDias: 240 },
  { etapa: 'sin_respuesta', canal: 'whatsapp', tipo: 'mensaje', hoy: 0, nacieronHoy: 0, treintaDias: 15 },
];

interface Mensaje {
  /** `null` = el webhook de Messenger no trae nombre: la fila va «Sin nombre», como en producción. */
  nombre: string | null;
  canal: Canal;
  tipo: Tipo;
  sentido: 'entrante' | 'saliente';
  /** Hora de Lima. */
  cuando: string;
  texto: string;
}

/** Los textos de la cola de campaña del 13-sep-2026, literales. */
export const MENSAJES_CAMPANA_2026_09_13: readonly Mensaje[] = [
  { nombre: 'Christian J.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-10T20:19:00-05:00', texto: 'Betto Barrionuevo Por Ancash Gobernador Regional De Ancash 🇵🇪💪🌊' },
  { nombre: 'Maria E.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-13T11:50:00-05:00', texto: 'Excelente 🫰👏👏👏' },
  { nombre: 'Roberto C.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-11T20:51:00-05:00', texto: 'Todo es bonito pero es ideología ultraderecha cola de Estados Unidos' },
  { nombre: 'Julio A.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-12T15:13:00-05:00', texto: 'Este cerdo prometió un teleférico hace 4 años.... Fuera porky mentiroso' },
  { nombre: 'FC G.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-13T10:58:00-05:00', texto: 'En huaraz dónde es su local del licenciado betto Barrionuevo' },
  { nombre: 'Layla A.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-11T14:18:00-05:00', texto: 'BETTO GANANDO 💙🅿️' },
  { nombre: 'Julio B.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-11T20:50:00-05:00', texto: 'BETTO ES EL MEJOR 🇵🇪' },
  { nombre: 'Juana R.', canal: 'facebook', tipo: 'comentario', sentido: 'entrante', cuando: '2026-09-11T18:06:00-05:00', texto: 'La mejor obsion' },
  { nombre: null, canal: 'facebook', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-12T06:39:00-05:00', texto: 'No puedes gracias' },
  { nombre: null, canal: 'facebook', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-10T17:37:00-05:00', texto: 'Vamos contodo un vensedor por Ancah' },
  { nombre: null, canal: 'facebook', tipo: 'mensaje', sentido: 'saliente', cuando: '2026-09-12T11:55:00-05:00', texto: 'Hola te envito a seguirme en mi canal de wasap' },
  { nombre: 'Vale', canal: 'whatsapp', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-11T11:53:00-05:00', texto: 'Hola 👋 Vi la propuesta para Áncash y quisiera conversar sobre ella.' },
  { nombre: 'Wilmar Y.', canal: 'whatsapp', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-10T19:07:00-05:00', texto: 'Cm estás amigo betto' },
  { nombre: '❤️🌻🌹', canal: 'whatsapp', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-10T23:04:00-05:00', texto: 'Tenemos mucho trabajo en ancash y en. Especial por la ruta de las vertientes de aija' },
  { nombre: 'Alvinco M.', canal: 'whatsapp', tipo: 'mensaje', sentido: 'entrante', cuando: '2026-09-12T17:25:00-05:00', texto: 'Hola 👋 Vi la propuesta para Áncash y quisiera conversar sobre ella.' },
];

/** La línea de campaña de la galería (la de Betto, la misma que ya lista `galeria.tsx`). */
const LINEA_DE_CAMPANA = '51963139984';

/**
 * ⚠️ NO MEDIDO: cómo se reparte cada `n` entre las cuatro luces. Proporciones de una
 * mesa donde casi nadie dice que quiere algo todavía; se reemplazan cuando esté medido.
 */
const PARTE_DE_LUZ: Record<string, readonly (readonly [Luz, number])[]> = {
  interesado: [
    ['verde', 0.06],
    ['ambar', 0.3],
    ['gris', 0.58],
    ['rojo', 0.06],
  ],
  contactado: [
    ['verde', 0.05],
    ['ambar', 0.45],
    ['gris', 0.45],
    ['rojo', 0.05],
  ],
};

/** `n` repartido según `partes`, con el resto mayor: la suma da `n` exacto. */
function repartir(n: number, partes: readonly number[]): number[] {
  const exactos = partes.map((p) => n * p);
  const pisos = exactos.map(Math.floor);
  let faltan = n - pisos.reduce((a, b) => a + b, 0);
  for (const [, i] of exactos.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])) {
    if (faltan-- <= 0) break;
    pisos[i]++;
  }
  return pisos;
}

export type RangoDeGaleria = 'hoy' | 'd7' | 'cola';

/** ⚠️ NO MEDIDO: «7 d» interpolado entre «Hoy» y los 30 días. */
function enSieteDias(m: Medicion): number {
  return m.hoy + Math.round(((m.treintaDias - m.hoy) * 6) / 29);
}

/**
 * El desglose del rango, con TODOS los canales: lo que responde el server con
 * `mesaPorCanal=1`. «Hoy» es un tramo de los 30 días, así que el de 30 días es el de
 * hoy más el resto: las que nacieron hoy son las mismas en los tres rangos.
 */
export function desgloseDeCampana(rango: RangoDeGaleria): FilaDesglose[] {
  return MEDIDO_CAMPANA_2026_09_13.flatMap((m) => {
    const resto = rango === 'hoy' ? 0 : (rango === 'cola' ? m.treintaDias : enSieteDias(m)) - m.hoy;
    const tramos = [
      { n: m.nacieronHoy, nacioHoy: true, deHoy: true },
      { n: m.hoy - m.nacieronHoy, nacioHoy: false, deHoy: true },
      { n: resto, nacioHoy: false, deHoy: false },
    ];
    return tramos.flatMap((t) => {
      const luces = PARTE_DE_LUZ[m.etapa] ?? ([['gris', 1]] as const);
      const ns = repartir(t.n, luces.map(([, p]) => p));
      return luces
        .map(
          ([luz], i): FilaDesglose => ({
            etapa: m.etapa,
            yaLeHablamos: m.etapa !== 'interesado',
            precio: false,
            viva: t.deHoy && m.etapa === 'interesado',
            ventana: t.deHoy,
            paraSeguir: false,
            seCallo: false,
            luz,
            nacioHoy: t.nacioHoy,
            canal: m.canal,
            tipo: m.tipo,
            n: ns[i],
          }),
        )
        .filter((f) => f.n > 0);
    });
  });
}

function pasaRecorte(f: FilaDesglose, recorte: string | undefined): boolean {
  switch (recorte) {
    case undefined:
      return true;
    case 'ventana':
      return f.ventana === true;
    case 'seguir':
      return f.paraSeguir === true;
    case 'seCallo':
      return f.seCallo === true;
    case 'precio':
      return f.precio;
    case 'escribioHoy':
      return f.nacioHoy === true;
    case 'sinRespuesta24h':
      return !f.viva && f.etapa === 'interesado';
    default:
      return true;
  }
}

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

/** Las tarjetas de una columna: los textos medidos de ese canal, en ciclo. */
function tarjetasDeCampana(
  etapa: string,
  cuantas: number,
  par: { canal: string; tipo: string | null } | null,
  rango: RangoDeGaleria,
  ahora: number,
) {
  const delCanal = MENSAJES_CAMPANA_2026_09_13.filter(
    (m) => !par || (m.canal === par.canal && (par.tipo == null || m.tipo === par.tipo)),
  );
  // «Te esperan» es el último entrante; «Respondidos», el último nuestro (si hay alguno de ese canal).
  const salientes = delCanal.filter((m) => m.sentido === 'saliente');
  const pool =
    etapa === 'interesado' ? delCanal.filter((m) => m.sentido === 'entrante') : salientes.length ? salientes : delCanal;
  return Array.from({ length: cuantas }, (_, i) => {
    const m = pool.length ? pool[i % pool.length] : null;
    const canal = m?.canal ?? par?.canal ?? 'whatsapp';
    const tipo = m?.tipo ?? par?.tipo ?? 'mensaje';
    const literal = m ? Math.min(Date.parse(m.cuando), ahora) : ahora;
    const t = rango === 'hoy' ? ahora - (i + 0.5) * 25 * 60_000 : literal - (i >= pool.length ? i * 3 * 3_600_000 : 0);
    const cuando = new Date(t).toISOString();
    const entrante = m?.sentido === 'entrante';
    const sem = semaforoDe({
      ...SIN_SENAL,
      hablo: entrante,
      entranteConSustancia: entrante && (m?.texto.length ?? 0) > 16,
      dijoQueNo: entrante && /^no puedes/i.test(m?.texto ?? ''),
    });
    const id = `galeria-${etapa}-${i}`;
    return {
      clave: `conv:${canal}:${id}:${LINEA_DE_CAMPANA}`,
      canal,
      tipo,
      // Sin teléfono en WhatsApp (ni números en el repo): con uno, un perfil ilegible
      // como «❤️🌻🌹» se nombraría por él, y acá se leería el id de la galería.
      persona_id: canal === 'whatsapp' ? '' : id,
      persona_nombre: m?.nombre ?? null,
      lead_nombre: null,
      numero_propio: canal === 'whatsapp' ? LINEA_DE_CAMPANA : null,
      texto: m?.texto ?? null,
      contexto_texto: null,
      respondida: etapa !== 'interesado',
      ya_le_hablamos: etapa !== 'interesado',
      precio_enviado: false,
      etapa_efectiva: etapa,
      interes_curso: null,
      lead_curso: null,
      ventana_abierta: false,
      ventana_cierra: null,
      pregunto: false,
      n: 1 + (i % 4),
      referencia: cuando,
      ultimo_at: cuando,
      dias: Math.floor((ahora - t) / 86_400_000),
      etapa_desde: new Date(t - (i % 3) * 86_400_000).toISOString(),
      nivel: 0,
      luz: sem.luz,
      porque: sem.porque,
      origen_semaforo: null,
      asignada_a: null,
    };
  });
}

/**
 * Lo que responde `GET /api/conversaciones/tablero` en la galería de campaña.
 *
 * Con `servidorViejo`: sin `recortesDisponibles` ni `mesaPorCanal`, y el desglose de
 * 30 días recortado por el canal pedido y sin decir de cuál es cada fila — como
 * responde un server de antes.
 */
export function tableroDeCampana(q: URLSearchParams, ahora: number, { servidorViejo = false } = {}) {
  const desde = q.get('desde');
  const rango: RangoDeGaleria =
    servidorViejo || q.get('franjaEn') !== '*' || !desde
      ? 'cola'
      : Date.parse(desde) >= new Date(ahora).setHours(0, 0, 0, 0)
        ? 'hoy'
        : 'd7';
  const canal = q.get('canal');
  const par = canal ? { canal, tipo: q.get('tipo') } : null;
  const todos = desgloseDeCampana(rango);
  const delCanal = filasDelCanal(todos, par) ?? [];

  const columnas: Record<string, unknown> = {};
  for (const pedida of (q.get('columnas') ?? '').split(',').filter(Boolean)) {
    const [etapa, recorte] = pedida.split(':');
    const total = delCanal.filter((f) => f.etapa === etapa && pasaRecorte(f, recorte)).reduce((s, f) => s + f.n, 0);
    const cuantas = Math.min(total, 8);
    columnas[etapa] = { conversaciones: tarjetasDeCampana(etapa, cuantas, par, rango, ahora), total, hayMas: total > cuantas };
  }

  const porCanal = q.get('mesaPorCanal') === '1' && !servidorViejo;
  const desglose = porCanal ? todos : delCanal.map(({ canal: _c, tipo: _t, ...f }) => f);
  const conteos: Record<string, number> = {};
  for (const f of desglose) conteos[f.etapa] = (conteos[f.etapa] ?? 0) + f.n;
  return {
    columnas,
    conteos,
    desglose,
    ...(servidorViejo
      ? {}
      : { recortesDisponibles: ['precio', 'ventana', 'seguir', 'seCallo', 'nacioHoy', 'escribioHoy', 'sinRespuesta24h'] }),
    ...(porCanal ? { mesaPorCanal: true } : {}),
  };
}
