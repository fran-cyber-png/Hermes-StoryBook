import { fechaCorta } from '../../lib/formato';
import { rotuloEtapa } from '../../lib/etapas';
import type { CompraUnificada } from './comprasUnificadas';
import type { ActividadTile } from './resumenDetalle';

/**
 * #1033 — EL PERFIL EN UNA FRASE: quién es, qué compró, qué le interesa y cómo
 * va. Pedido del dueño (12-sep-2026): «un pequeño texto resumen del dato,
 * productos comprados, actividad, nombre, país».
 *
 * ══ SÓLO LO VERIFICADO, Y SIN LLM ══════════════════════════════════════════
 *
 * Es una plantilla sobre datos que la ficha YA resolvió con su fuente: no puede
 * afirmar nada que Hermes no sepa. Lo que deduzca un modelo va aparte y en
 * sombra (#1031) — mezclarlo acá haría que la vendedora no pueda distinguir un
 * hecho de una lectura.
 *
 * ══ 🔴 ES DE VENTAS DE GOBERNA, NO DE UNA CAMPAÑA ═══════════════════════════
 *
 * El panel no lo arma en campaña (`PanelDerecho.tsx`, candado en
 * `PanelDerecho.campana.test.tsx`): es la ficha de Cerberus, no la de Betto ni
 * la de Américo (dueño, 13-sep-2026). Por eso acá no hay un modo campaña.
 *
 * ⚠️ **«Compró» lo decide el server** (`esCompra`, con `dominio/estadosVenta.ts`):
 * una cotización o un reembolso siguen en la lista de compras, pero no se cuentan
 * ni se nombran acá.
 *
 * ⚠️ **Goberna es todos sus negocios**: el texto dice en cuáles compró (Escuela,
 * Consultoria…) sin esconder ninguno (dueño, 13-sep-2026).
 *
 * ⚠️ **El nombre no va**: la cabecera lo tiene escrito 30 px más arriba, y este
 * panel ya pagó dos veces el decir lo mismo dos veces (ADR 0082).
 *
 * ⚠️ **Sin nada que decir devuelve `null`**, y el bloque no se dibuja: un hueco
 * permanente enseña a no mirarlo (ADR 0080). «No tiene compras registradas» sola
 * no alcanza para justificar el bloque.
 */
export interface DatosDelResumen {
  /** Hay un cliente de Cerberus identificado por el teléfono. */
  esCliente: boolean;
  pais: string | null;
  ocupacion: string | null;
  /** Más nueva primero (`comprasUnificadas`). */
  compras: readonly CompraUnificada[];
  intereses: readonly string[];
  /** El id de la etapa efectiva (`interesado`, `cotizado`…), no su rótulo. */
  etapa: string | null;
  ultimaActividad: ActividadTile | null;
}

/** «Correo enviado» → «correo enviado», pero «CEO de una ONG» queda como está. */
function minusculaInicial(s: string): string {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function mayusculaInicial(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «4760.00» → «4760»: los ceros de relleno no dicen nada; «344.50» se queda. */
function monto(m: string | null): string | null {
  const s = (m ?? '').trim();
  return s ? s.replace(/\.0+$/, '') : null;
}

function enumerar(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

function quienEs(d: DatosDelResumen): string | null {
  const pais = d.pais?.trim() || null;
  const ocupacion = d.ocupacion?.trim() || null;
  if (!d.esCliente && !pais && !ocupacion) return null;
  return `${d.esCliente ? 'Cliente' : 'Contacto'}${pais ? ` de ${pais}` : ''}${ocupacion ? `, ${minusculaInicial(ocupacion)}` : ''}.`;
}

function queCompro(validas: readonly CompraUnificada[]): string | null {
  if (validas.length === 0) return null;
  const ultima = validas[0];
  // Sin el nombre del producto, la compra se nombra por su folio: nunca se inventa qué fue.
  const que = ultima.productos.length > 0 ? ultima.productos.join(' + ') : ultima.folio || 'una compra';
  const importe = monto(ultima.monto);
  const cuanto = ultima.moneda && importe ? ` por ${ultima.moneda} ${importe}` : '';
  const cuando = ultima.fecha ? `, el ${fechaCorta(ultima.fecha)}` : '';
  const negocios = [...new Set(validas.flatMap((c) => c.negocios))];
  const donde = negocios.length > 0 ? ` en ${enumerar(negocios)}` : '';
  return validas.length === 1
    ? `Compró 1 vez${donde}: ${que}${cuanto}${cuando}.`
    : `Compró ${validas.length} veces${donde}; la última, ${que}${cuanto}${cuando}.`;
}

function queLeInteresa(d: DatosDelResumen): string | null {
  const cursos = d.intereses.map((c) => c.trim()).filter(Boolean);
  if (cursos.length === 0) return null;
  return `${cursos.length === 1 ? 'Le interesa' : 'Le interesan'} ${enumerar(cursos)}.`;
}

function comoVa(d: DatosDelResumen): string | null {
  const etapa = d.etapa ? `Está en «${rotuloEtapa(d.etapa)}»` : null;
  const a = d.ultimaActividad;
  const ultimo = a ? `lo último, ${minusculaInicial(a.rotulo)}${a.timestamp ? ` el ${fechaCorta(a.timestamp)}` : ''}` : null;
  if (etapa && ultimo) return `${etapa}; ${ultimo}.`;
  if (etapa) return `${etapa}.`;
  return ultimo ? `${mayusculaInicial(ultimo)}.` : null;
}

export function resumenDelContacto(d: DatosDelResumen): string | null {
  const validas = d.compras.filter((c) => c.esCompra);
  const identidad = quienEs(d);
  const compras = queCompro(validas);
  const resto = [queLeInteresa(d), comoVa(d)];
  if (!identidad && !compras && resto.every((f) => f === null)) return null;
  // Un lead sin compras lo dice como registro («no tiene registradas»), no como
  // sentencia: una venta cargada a otro teléfono no llega a esta ficha.
  const sinCompras = !d.esCliente && validas.length === 0 ? 'No tiene compras registradas.' : null;
  return [identidad, compras ?? sinCompras, ...resto].filter((f): f is string => f !== null).join(' ');
}
