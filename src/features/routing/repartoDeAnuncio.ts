/**
 * EL EDITOR DEL REPARTO DE UN ANUNCIO (#1002) — las reglas, puras y sin DOM.
 *
 * Qué cuenta como una parte, qué dice el pie de la suma y qué haría el botón se
 * tienen que poder interrogar sin montar la hoja: son justo las decisiones que
 * un test de componente mira sólo de costado.
 *
 * 🔴 **SUMA 100 O NO SE GUARDA** (decisión del dueño, 11-sep-2026). El server lo
 * exige igual (`server/src/routing/repartoDeAnuncio.ts`); acá se exige ANTES,
 * para que el botón no invite a un 400. El server es la frontera y esto es la
 * invitación, pero la invitación no puede ser más ancha que la frontera: un
 * botón prendido que devuelve un 400 enseña a desconfiar del botón. Por eso los
 * límites de abajo tienen su test de paridad
 * (`server/src/routing/repartoDeAnuncio.paridad-front.test.ts`).
 */
import { claveDeVendedora } from '../../dominio/dueno';

/**
 * LOS LÍMITES DE UN REPARTO — los mismos números que el server. Se escriben acá
 * y allá porque son dos builds, y el test de paridad los lee a los dos: cambiar
 * uno solo lo pone rojo. ⚠️ Son `export const X = N;` a propósito: es la forma
 * que ese test sabe leer.
 */
export const PORCENTAJE_MINIMO = 1;
export const PORCENTAJE_MAXIMO = 100;
export const SUMA_EXIGIDA = 100;
export const PARTES_MAXIMAS = 20;

export interface ParteDeReparto {
  vendedora: string;
  porcentaje: number;
}

/** Lo que hay escrito en cada casilla, tal cual: una cadena por vendedora. */
export type Escrito = Record<string, string>;

/**
 * CON QUÉ ARRANCA EL EDITOR: los destinos de la línea, más quien ya tiene parte.
 *
 * ⚠️ **Quien tiene parte sin estar en los destinos se agrega al final, no se
 * esconde.** Pasa con alguien que dejó de atender la línea: si no apareciera,
 * su porcentaje seguiría guardado y nadie podría verlo para sacárselo — el mismo
 * criterio que `deBaja` en la foto de Routing.
 */
export function escritoInicial(
  destinos: readonly string[],
  reparto: readonly ParteDeReparto[],
): { orden: string[]; escrito: Escrito } {
  const orden = [...destinos];
  const conocidas = new Set(destinos.map((v) => claveDeVendedora(v)));
  for (const p of reparto) {
    if (!conocidas.has(claveDeVendedora(p.vendedora))) {
      orden.push(p.vendedora);
      conocidas.add(claveDeVendedora(p.vendedora));
    }
  }
  const deReparto = new Map(reparto.map((p) => [claveDeVendedora(p.vendedora), p.porcentaje]));
  const escrito: Escrito = {};
  for (const v of orden) {
    const p = deReparto.get(claveDeVendedora(v));
    escrito[v] = p === undefined ? '' : String(p);
  }
  return { orden, escrito };
}

export interface LecturaDelEscrito {
  partes: ParteDeReparto[];
  /** Las vendedoras cuya casilla no es un entero de 0 a 100. */
  invalidas: string[];
}

/**
 * Vacío y cero —escrito como sea: `0`, `00`, `000`— no son una parte: es «a ésta
 * no le toca nada de este anuncio». ⚠️ Se compara el NÚMERO y no la cadena: con
 * `crudo === '0'`, un «00» salía como una parte de 0 % que el server rechaza.
 */
export function leerEscrito(orden: readonly string[], escrito: Escrito): LecturaDelEscrito {
  const partes: ParteDeReparto[] = [];
  const invalidas: string[] = [];
  for (const vendedora of orden) {
    const crudo = (escrito[vendedora] ?? '').trim();
    if (crudo === '') continue;
    if (!/^\d{1,3}$/.test(crudo) || Number(crudo) > PORCENTAJE_MAXIMO) {
      invalidas.push(vendedora);
      continue;
    }
    const porcentaje = Number(crudo);
    if (porcentaje < PORCENTAJE_MINIMO) continue;
    partes.push({ vendedora, porcentaje });
  }
  return { partes, invalidas };
}

export interface EstadoDeLaSuma {
  suma: number;
  tipo: 'vacio' | 'justo' | 'falta' | 'sobra';
  texto: string;
}

export function estadoDeLaSuma(partes: readonly ParteDeReparto[]): EstadoDeLaSuma {
  const suma = partes.reduce((s, p) => s + p.porcentaje, 0);
  if (partes.length === 0) {
    return { suma, tipo: 'vacio', texto: 'Sin reparto propio: decide la regla de la campaña.' };
  }
  if (suma === SUMA_EXIGIDA) return { suma, tipo: 'justo', texto: `Suma ${SUMA_EXIGIDA} %` };
  if (suma < SUMA_EXIGIDA) {
    return { suma, tipo: 'falta', texto: `Suma ${suma} % · faltan ${SUMA_EXIGIDA - suma} %` };
  }
  return { suma, tipo: 'sobra', texto: `Suma ${suma} % · sobran ${suma - SUMA_EXIGIDA} %` };
}

/**
 * QUÉ HARÍA EL BOTÓN, y si no hace nada, POR QUÉ.
 *
 * ⚠️ **Guardar lo mismo que ya está es `nada`**, no `guardar`: el server no lo
 * escribiría (y así no reinicia la cuenta de lo repartido), y un botón activo
 * que no cambia nada se lee como que algo cambió.
 */
export function queGuardaria(
  lectura: LecturaDelEscrito,
  previo: readonly ParteDeReparto[],
): { accion: 'guardar' | 'quitar' | 'nada'; bloqueo?: string } {
  if (lectura.invalidas.length > 0) {
    return {
      accion: 'nada',
      bloqueo: `${lectura.invalidas.map((v) => `«${v}»`).join(', ')}: el porcentaje es un entero de 0 a ${PORCENTAJE_MAXIMO}.`,
    };
  }
  if (lectura.partes.length > PARTES_MAXIMAS) {
    return { accion: 'nada', bloqueo: `Un anuncio se reparte entre ${PARTES_MAXIMAS} personas como máximo.` };
  }
  const estado = estadoDeLaSuma(lectura.partes);
  if (estado.tipo === 'falta' || estado.tipo === 'sobra') return { accion: 'nada', bloqueo: estado.texto };
  if (estado.tipo === 'vacio') return previo.length > 0 ? { accion: 'quitar' } : { accion: 'nada' };
  if (mismoReparto(lectura.partes, previo)) return { accion: 'nada', bloqueo: 'Ya está guardado así.' };
  return { accion: 'guardar' };
}

/**
 * PAREJO ENTRE LAS QUE SE ELIJAN: enteros que suman 100 exacto.
 *
 * Lo que sobra de la división entera va a las primeras de la lista, de a uno.
 * Con tres son 34 · 33 · 33: tipear eso a mano es justo lo que hace equivocarse
 * por uno y quedarse mirando «faltan 1 %».
 */
export function repartirParejo(vendedoras: readonly string[]): ParteDeReparto[] {
  const n = vendedoras.length;
  if (n === 0) return [];
  const base = Math.floor(SUMA_EXIGIDA / n);
  const resto = SUMA_EXIGIDA - base * n;
  return vendedoras.map((vendedora, i) => ({ vendedora, porcentaje: base + (i < resto ? 1 : 0) }));
}

/** «Luz 70 % · Ana 30 %» — la parte más grande primero. `''` sin reparto. */
export function resumenDelReparto(
  reparto: readonly ParteDeReparto[],
  nombre: (vendedora: string) => string,
): string {
  return [...reparto]
    .sort((a, b) => b.porcentaje - a.porcentaje || a.vendedora.localeCompare(b.vendedora, 'es'))
    .map((p) => `${nombre(p.vendedora)} ${p.porcentaje} %`)
    .join(' · ');
}

function mismoReparto(a: readonly ParteDeReparto[], b: readonly ParteDeReparto[]): boolean {
  if (a.length !== b.length) return false;
  const deA = new Map(a.map((p) => [claveDeVendedora(p.vendedora), p.porcentaje]));
  return b.every((p) => deA.get(claveDeVendedora(p.vendedora)) === p.porcentaje);
}
