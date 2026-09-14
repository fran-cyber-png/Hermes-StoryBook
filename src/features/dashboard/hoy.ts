import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import { intervaloConStream, streamVivo } from '../../lib/datos/latido';
import type { Puente } from '../../lib/puente';
import { nombreDeOperador } from './campana';
import { formatearDemora } from './negocio';

/**
 * «HOY» — la pestaña de operación del Dashboard (ADR 0104).
 *
 * La regla que parte las dos pantallas: **lo que se TRABAJA está en el Pipeline;
 * lo que se MIDE está en el Dashboard**. Por eso acá no hay filas de gente para
 * atender, y cada cifra es un enlace que abre el Pipeline con su recorte: una cifra
 * que no se puede abrir no le sirve a nadie para decidir qué hacer.
 *
 * El server (`server/src/dashboard/hoy.ts`) manda los conteos y ya recorta por quién
 * mira. Acá viven solo las derivaciones de PRESENTACIÓN: a qué recorte lleva cada
 * número, cómo se llama cada línea y a quién le toca cada cifra.
 */

/** El puente que abre el Pipeline. Viene de `lib/puente.ts`, que es el contrato con esa vista. */
export type PuenteAlPipeline = Extract<Puente, { tipo: 'pipeline' }>;

/**
 * Una línea que aparece en la pantalla, con su clase — la clase es lo que dice de
 * quién es lo que sale por ella:
 *   · `propia` — una sola persona y sin rueda: lo que sale desde su teléfono es de ella.
 *   · `compartida` — varias personas sin rueda (Libros Mx): lo que sale desde el
 *     teléfono no se puede repartir entre ellas.
 *   · `equipo` — con rueda (Ventas Meta): se atiende desde Hermes y se atribuye por envío.
 *   · `sin_asignar` — nadie la tiene en el mapa (Ventas Perú, «Por identificar»): sus
 *     cifras aparecen por línea y no son de ninguna persona.
 *
 * `personas` viene normalizada y sin actores de sistema (bot, goberna-admin, campana).
 */
export interface LineaDeHoy {
  numero: string;
  etiqueta: string;
  clase: 'propia' | 'compartida' | 'equipo' | 'sin_asignar';
  personas: string[];
}

export interface CifraPorLinea {
  /** El número propio. `null` = no entró por ninguna línea (un DM de Messenger/IG). */
  linea: string | null;
  /**
   * Sólo cuando `linea` es null: por qué canal entró el DM (`facebook` · `instagram`), o
   * `comentarios_y_leads` para lo que no es un chat. Eso no es un canal y no se abre: el
   * Pipeline abre `canal` sólo con chats (decisión del 10-sep-2026).
   */
  canal?: string;
  n: number;
}

export interface CifraPorDuena {
  /** Normalizada en el server (`lower(btrim())`). `null` = sin dueña. */
  duena: string | null;
  n: number;
}

export interface PersonaDeHoy {
  vendedora: string;
  nombre: string | null;
  lineas: string[];
  /** Conversaciones de la mesa (30 días) con ella de dueña. */
  asignadas: number;
  /** Conversaciones a las que les cerró una espera HOY, atribuidas por línea propia o por envío. */
  contestadas: number;
  /**
   * La primera respuesta a quienes escribieron por primera vez hoy y le tocan.
   * `sobre` = las que ya tienen respuesta; `de` = todas. `null` = no le tocó ninguna.
   */
  primeraRespuesta: { medianaMin: number | null; sobre: number; de: number } | null;
  /** `null` en campaña: ahí no hay ventas, y la cifra no existe, que no es un cero (#954). */
  ventas: number | null;
}

export interface DatosHoy {
  inicioDeHoy: string;
  generadoEn: string;
  /** ¿Ve al equipo entero? `false` = sólo su fila y su universo (el server ya recortó). */
  supervisor: boolean;
  modulo: 'ventas' | 'campana';
  lineas: LineaDeHoy[];
  escribieron: { total: number; porLinea: CifraPorLinea[] };
  sinRespuesta: { total: number; porDuena: CifraPorDuena[]; porLinea: CifraPorLinea[] };
  /** `null` en campaña: sin precio no hay semáforo que las pinte de verde. */
  calientesSinDuena: { total: number; porLinea: CifraPorLinea[] } | null;
  personas: PersonaDeHoy[];
  /**
   * Lo contestado que no se puede atribuir a una persona, dicho por LÍNEA: desde el
   * teléfono en una línea compartida, o (`linea: null`) un DM de Messenger/IG
   * contestado fuera de Hermes.
   */
  sinAtribuir: { linea: string | null; contestadas: number }[];
}

/**
 * EL INICIO DEL DÍA DE QUIEN MIRA, como instante (#421).
 *
 * El día calendario depende del reloj de quien mira y el server corre con el suyo,
 * así que el navegador manda su medianoche ya resuelta. El server no interpreta
 * «hoy».
 */
export function inicioDeHoyLocal(ahora: Date = new Date()): string {
  const medianoche = new Date(ahora);
  medianoche.setHours(0, 0, 0, 0);
  return medianoche.toISOString();
}

/**
 * «HOY», PEDIDO DONDE SE MIRA.
 *
 * ⚠️ **El inicio del día vive en un estado que cambia a medianoche**, y no se
 * calcula en cada render: con React Compiler un `new Date()` sin dependencias se
 * puede memoizar, y la pantalla quedaría clavada en el día en que se abrió.
 *
 * ⚠️ **El ritmo es el del latido** (`intervaloConStream`): con el stream vivo, cada
 * 5 minutos; sin stream, cada minuto. Tampoco la refresca el SSE
 * (`lib/datos/tiempoReal.ts`): cada pedido arma la `todo` de la cola en el server
 * (1 a 2 s en producción), y con 7 a 18 mensajes por minuto un refresco por mensaje
 * es la tormenta que tumbó «El negocio» el 9-sep-2026. Lo que se mide acá no
 * cambia de sentido en cinco minutos.
 */
export function useHoy({ activo }: { activo: boolean }) {
  const [inicioDeHoy, setInicioDeHoy] = useState(() => inicioDeHoyLocal());

  useEffect(() => {
    const ahora = new Date();
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    // Un segundo después de la medianoche: justo en el borde, `inicioDeHoyLocal`
    // podría devolver todavía el día que termina.
    const t = window.setTimeout(() => setInicioDeHoy(inicioDeHoyLocal()), manana.getTime() - ahora.getTime() + 1_000);
    return () => window.clearTimeout(t);
  }, [inicioDeHoy]);

  return useQuery({
    queryKey: ['dashboard', 'hoy', inicioDeHoy],
    queryFn: () => api<DatosHoy>(`/api/dashboard/hoy?inicioDeHoy=${encodeURIComponent(inicioDeHoy)}`),
    enabled: activo,
    staleTime: 60_000,
    refetchInterval: () => intervaloConStream(streamVivo(), 60_000),
    refetchOnWindowFocus: false,
    placeholderData: (previo) => previo,
  });
}

// ── Derivaciones de presentación ─────────────────────────────────────────────

/**
 * CUÁNDO SE TRAJERON LAS CIFRAS QUE SE ESTÁN VIENDO — «actualizado hace N min».
 *
 * «Hoy» se refresca cada 5 minutos con el stream vivo: sin este rótulo, quien mira
 * no sabe si el número que lee es de ahora o de hace un rato. `traidoEn` es el
 * `dataUpdatedAt` de react-query; en 0 todavía no llegó nada y no se dice nada. Un
 * reloj del navegador adelantado no puede dar un tiempo negativo.
 */
export function rotuloDeActualizacion(traidoEn: number, ahora: number): string | null {
  if (traidoEn <= 0) return null;
  const minutos = Math.floor(Math.max(0, ahora - traidoEn) / 60_000);
  if (minutos < 1) return 'actualizado hace un momento';
  if (minutos < 60) return `actualizado hace ${minutos} min`;
  return `actualizado hace ${Math.floor(minutos / 60)} h`;
}

/** Una cifra de la pantalla: lo que se tocó. */
export type Cifra =
  | { tipo: 'escribieron'; linea?: string | null; canal?: string }
  | { tipo: 'sinRespuesta'; linea?: string | null; canal?: string }
  | { tipo: 'sinRespuestaDe'; duena: string | null }
  | { tipo: 'calientes'; linea?: string | null; canal?: string }
  | { tipo: 'asignadas'; vendedora: string };

/**
 * A QUÉ RECORTE DEL PIPELINE LLEVA CADA CIFRA — la única tabla que lo decide.
 *
 * Un eje por vez (`recorte`), y el alcance aparte (`asignadaA`, `linea`): es la
 * forma que el Pipeline sabe dibujar y apagar (`lib/puente.ts`).
 *
 * 🔴 **Lo que no tiene línea se abre por su CANAL, o no se abre.** Un DM de
 * Messenger o de Instagram no tiene número propio, así que viaja `canal` (el recorte
 * `?canal=` que la cola ya sabe hacer). Sin canal —o con uno que el Pipeline no
 * recorta— devuelve `null`: el puente viajaría sin `linea` ni `canal`, que significa
 * TODAS las líneas, y la pantalla prometería 8 para mostrar 425. Una cifra que abre
 * otra cosa que la que dice es peor que una que no se abre.
 */
export function puenteDe(cifra: Cifra): PuenteAlPipeline | null {
  switch (cifra.tipo) {
    case 'escribieron':
      return conLinea({ tipo: 'pipeline', recorte: { escribioHoy: true } }, cifra.linea, cifra.canal);
    case 'sinRespuesta':
      return conLinea({ tipo: 'pipeline', recorte: { sinRespuesta24h: true } }, cifra.linea, cifra.canal);
    case 'sinRespuestaDe':
      return { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, asignadaA: cifra.duena };
    case 'calientes':
      return conLinea({ tipo: 'pipeline', recorte: { luz: 'verde' }, asignadaA: null }, cifra.linea, cifra.canal);
    case 'asignadas':
      return { tipo: 'pipeline', asignadaA: cifra.vendedora };
  }
}

/**
 * `undefined` = el total (sin línea en el puente). `null` = no entró por ninguna
 * línea: se abre por su canal si el Pipeline sabe recortarlo, y si no, no se abre.
 */
function conLinea(
  puente: PuenteAlPipeline,
  linea: string | null | undefined,
  canal: string | undefined,
): PuenteAlPipeline | null {
  if (linea === undefined) return puente;
  if (!seAbreEnElPipeline(linea, canal)) return null;
  return linea !== null ? { ...puente, linea } : { ...puente, canal: canal as 'facebook' | 'instagram' };
}

/**
 * ¿La cifra de ESTA línea se puede abrir en el Pipeline? Una línea, siempre; lo que no
 * tiene línea, sólo si trae un canal que el Pipeline sabe recortar. Es la misma regla
 * que decide el puente y la que decide si el chip se dibuja como enlace: con dos, la
 * pantalla ofrecería un enlace que no abre nada.
 */
export function seAbreEnElPipeline(linea: string | null, canal?: string): boolean {
  return linea !== null || canal === 'facebook' || canal === 'instagram';
}

export const SIN_LINEA = 'Sin línea (Messenger/IG)';

/**
 * Lo que no tiene línea, nombrado por su canal: Facebook es Messenger para quien mira.
 * `comentarios_y_leads` no es un canal: es lo que el server aparta porque no es un chat
 * (ver `CifraPorLinea.canal`), y por eso `seAbreEnElPipeline` no lo abre.
 */
const CANAL_SIN_LINEA: Record<string, string> = {
  facebook: 'Messenger (sin línea)',
  instagram: 'Instagram (sin línea)',
  comentarios_y_leads: 'Comentarios y leads (sin línea)',
};

/** Cómo se llama una línea: su etiqueta, o su número. Nunca un hueco. */
export function rotuloDeLinea(linea: string | null, lineas: readonly LineaDeHoy[], canal?: string): string {
  if (linea === null) return (canal && CANAL_SIN_LINEA[canal]) || SIN_LINEA;
  const etiqueta = lineas.find((l) => l.numero === linea)?.etiqueta.trim();
  return etiqueta || linea;
}

/**
 * QUÉ ES CADA LÍNEA, EN UNA FRASE — lo que se lee al pasar el mouse por su cifra.
 *
 * Lo que la clase dice de quién es lo que sale por ella, sin que haga falta
 * saber qué es una rueda. `null` para una línea que no está en el catálogo: sin
 * datos, no se inventa una frase.
 */
export function ayudaDeLinea(
  linea: string | null,
  datos: Pick<DatosHoy, 'lineas' | 'personas'>,
  canal?: string,
): string | null {
  if (linea === null) {
    if (canal === 'facebook') {
      return `${CANAL_SIN_LINEA.facebook}: mensajes directos a la Página de Facebook, que no entran por ninguna línea de WhatsApp.`;
    }
    if (canal === 'instagram') {
      return `${CANAL_SIN_LINEA.instagram}: mensajes directos a la cuenta de Instagram, que no entran por ninguna línea de WhatsApp.`;
    }
    if (canal === 'comentarios_y_leads') {
      return `${CANAL_SIN_LINEA.comentarios_y_leads}: comentarios de Facebook o Instagram y leads de formulario, que no son un chat; el Pipeline no los recorta así, y esta cifra no se abre.`;
    }
    return `${SIN_LINEA}: no se sabe por qué canal entró, así que esta cifra no se abre.`;
  }
  const l = datos.lineas.find((x) => x.numero === linea);
  if (!l) return null;
  const etiqueta = rotuloDeLinea(linea, datos.lineas);
  const quienes = enumerar(l.personas.map((id) => nombreVisible(id, datos.personas)));
  switch (l.clase) {
    case 'sin_asignar':
      return `${etiqueta}: nadie tiene esta línea en el mapa, así que sus cifras no son de ninguna persona.`;
    case 'propia':
      return `${etiqueta}: la línea de ${quienes}.`;
    case 'compartida':
      return `${etiqueta}: la comparten ${quienes}.`;
    case 'equipo':
      return `${etiqueta}: línea de equipo, con rueda; se atiende desde Hermes.`;
  }
}

/** La clave canónica de una persona (candado 4: `Luz` y `luz ` son la misma). */
function clave(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * El nombre con que se lee a una persona: el de `equipo` si viene, y si no el id
 * sin el prefijo del namespace (la misma regla que «La campaña», `nombreDeOperador`).
 */
function nombreVisible(vendedora: string, personas: readonly PersonaDeHoy[]): string {
  const persona = personas.find((p) => clave(p.vendedora) === clave(vendedora));
  return nombreDeOperador({ operador: vendedora, nombre: persona?.nombre ?? null });
}

/** Una fila de la tabla del equipo. */
export interface FilaDelEquipo {
  persona: PersonaDeHoy;
  nombre: string;
  /** Las suyas sin respuesta hace más de 24 h. */
  sinRespuesta24h: number;
  /**
   * La dueña no está en el equipo de hoy (dada de baja, fuera del mapa) pero tiene
   * deuda. Se muestra igual: una deuda que se esconde es una que nadie cobra.
   */
  soloDeuda: boolean;
}

/**
 * LAS FILAS DEL EQUIPO — una por persona, ordenadas por el nombre que se lee.
 *
 * El «> 24 h» de cada una sale de `porDuena` comparando NORMALIZADO de los dos
 * lados. La deuda sin dueña no es una fila de persona (`sinDuena24h`), y quien
 * tiene deuda sin estar en el equipo de hoy va al final, marcada.
 */
export function filasDelEquipo(datos: DatosHoy): FilaDelEquipo[] {
  const deuda = new Map<string, number>();
  for (const d of datos.sinRespuesta.porDuena) {
    if (d.duena === null) continue;
    deuda.set(clave(d.duena), (deuda.get(clave(d.duena)) ?? 0) + d.n);
  }
  const conocidas = new Set(datos.personas.map((p) => clave(p.vendedora)));

  const delEquipo: FilaDelEquipo[] = datos.personas.map((persona) => ({
    persona,
    nombre: nombreDeOperador({ operador: persona.vendedora, nombre: persona.nombre }),
    sinRespuesta24h: deuda.get(clave(persona.vendedora)) ?? 0,
    soloDeuda: false,
  }));
  const soloDeuda: FilaDelEquipo[] = [...deuda]
    .filter(([id]) => !conocidas.has(id))
    .map(([id, n]) => ({
      persona: { vendedora: id, nombre: null, lineas: [], asignadas: 0, contestadas: 0, primeraRespuesta: null, ventas: 0 },
      nombre: nombreDeOperador({ operador: id, nombre: null }),
      sinRespuesta24h: n,
      soloDeuda: true,
    }));

  return [...ordenarPorNombre(delEquipo), ...ordenarPorNombre(soloDeuda)];
}

function ordenarPorNombre(filas: readonly FilaDelEquipo[]): FilaDelEquipo[] {
  return [...filas].sort(
    (a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) ||
      a.persona.vendedora.localeCompare(b.persona.vendedora, 'es'),
  );
}

/** La deuda de más de 24 h que no tiene dueña. */
export function sinDuena24h(datos: DatosHoy): number {
  return datos.sinRespuesta.porDuena.filter((d) => d.duena === null).reduce((n, d) => n + d.n, 0);
}

/**
 * DESDE QUÉ LÍNEA ATIENDE, DICHO EN PALABRAS — la columna que la tabla de equipo
 * vieja no tenía y por la que marcaba 0 · 0 · 0: contaba solo lo enviado desde
 * Hermes, y en la línea de luz eso fue 2 de 2.335 mensajes (9-sep-2026).
 */
export function atiendeDesde(
  persona: PersonaDeHoy,
  datos: Pick<DatosHoy, 'lineas' | 'personas'>,
): { numero: string; etiqueta: string; texto: string }[] {
  return persona.lineas.map((numero) => {
    const etiqueta = rotuloDeLinea(numero, datos.lineas);
    const linea = datos.lineas.find((l) => l.numero === numero);
    if (!linea) return { numero, etiqueta, texto: 'sin datos de la línea' };
    if (linea.clase === 'sin_asignar') return { numero, etiqueta, texto: 'nadie tiene esta línea en el mapa' };
    if (linea.clase === 'propia') return { numero, etiqueta, texto: 'su línea' };
    if (linea.clase === 'equipo') return { numero, etiqueta, texto: 'de equipo, desde Hermes' };
    const otras = linea.personas
      .filter((id) => clave(id) !== clave(persona.vendedora))
      .map((id) => nombreVisible(id, datos.personas));
    // Con más de dos se dice CUÁNTAS: la línea de Betto tiene 19 personas, y
    // enumerarlas en cada fila empujaba las cifras fuera de la tabla. Los nombres
    // siguen en la ayuda de la línea (`ayudaDeLinea`).
    if (otras.length > 2) return { numero, etiqueta, texto: `compartida con ${otras.length} personas` };
    return { numero, etiqueta, texto: otras.length ? `compartida con ${enumerar(otras)}` : 'compartida' };
  });
}

/**
 * UNA MEDIANA NUNCA VA SIN SU DENOMINADOR (`server/src/atencion/tiempos.ts`, regla
 * 3): la mediana de las pocas que se contestaron describe los mejores casos y
 * presentada sola dice lo contrario de lo que pasó.
 */
export function textoPrimeraRespuesta(pr: PersonaDeHoy['primeraRespuesta']): { valor: string; detalle: string | null } {
  if (pr === null) return { valor: '—', detalle: null };
  const detalle = `${pr.sobre} de ${pr.de}`;
  if (pr.medianaMin === null) return { valor: 'sin respuesta', detalle };
  return { valor: formatearDemora(pr.medianaMin), detalle };
}

/**
 * LO QUE NO SE PUEDE ATRIBUIR, DICHO POR LÍNEA — lo contestado desde el teléfono en
 * una línea que comparten varias personas. Hermes ve la línea, no quién tenía el
 * teléfono en la mano, y repartirlo sería inventar.
 *
 * ⚠️ **Un DM de Messenger/IG (`linea: null`) no se contestó «desde el teléfono»**: se
 * contestó fuera de Hermes, en la bandeja de Meta, y ahí no queda registro de quién.
 */
export function notaSinAtribuir(
  item: DatosHoy['sinAtribuir'][number],
  datos: Pick<DatosHoy, 'lineas' | 'personas'>,
): string {
  if (item.linea === null) {
    const una = item.contestadas === 1;
    return `${SIN_LINEA}: ${item.contestadas} ${una ? 'contestada' : 'contestadas'} fuera de Hermes, desde Messenger o Instagram. No queda registro de quién ${una ? 'la' : 'las'} contestó.`;
  }
  const etiqueta = rotuloDeLinea(item.linea, datos.lineas);
  const cuantas = `${item.contestadas} ${item.contestadas === 1 ? 'contestada' : 'contestadas'} desde el teléfono.`;
  const quienes = (datos.lineas.find((l) => l.numero === item.linea)?.personas ?? []).map((id) =>
    nombreVisible(id, datos.personas),
  );
  const porQue = quienes.length
    ? ` La línea la comparten ${enumerar(quienes)}, y esa parte no se puede repartir por persona.`
    : ' Esa parte no se puede repartir por persona.';
  return `${etiqueta}: ${cuantas}${porQue}`;
}

/** «a», «a y b», «a, b y c». */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
