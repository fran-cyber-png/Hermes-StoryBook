import { esCompra, type Ficha, type VentaFicha } from '../cerberus/ficha';
import type { CompraDelPadron } from './usePadron';

/**
 * #887 — LAS COMPRAS, UNA SOLA LISTA — para el tile «Última compra», la
 * sección Compras y (más adelante) la capa canónica de ventas históricas.
 *
 * Mismo criterio que F.5 (`FichaContacto.tsx` › `modoCompras`): mientras el
 * detalle de Cerberus (`ventasCount`) siga sin verificar, lo que Hermes YA
 * sabe por icarus/`conversiones_wa` (F.1) es lo único que hay para mostrar. NO
 * se mezclan las dos listas — mezclar una fuente verificada con una que no lo
 * es volvería a ser la mentira que F.5 vino a sacar.
 *
 * ── El seam para la capa canónica ──
 * El día que entre la carga histórica (Excel 2020–2025 → Cerberus →
 * `conversiones_wa`/capa canónica), esas filas van a tener
 * `fuente: 'historica'` en `CompraDelPadron.fuente` — esta función no necesita
 * cambiar: ya devuelve lo que `comprasDelPadron` le sirva, marcado.
 */
export interface CompraUnificada {
  folio: string;
  monto: string | null;
  moneda: string | null;
  /** ISO, o `null` cuando la fuente no la tiene (no se inventa una fecha). */
  fecha: string | null;
  /** El canal de la venta (padrón) o el estado de Cerberus («Pagado»…). */
  canalOEstado: string | null;
  fuente: 'cerberus' | 'padron';
  /**
   * #1033 — QUÉ SE LLEVÓ. Cerberus lo manda en cada venta y hasta acá se
   * perdía: sin esto el resumen del perfil no puede decir qué compró, que es lo
   * que evita cotizarle de nuevo lo mismo. Vacío cuando la fuente no lo trae
   * (el padrón), nunca un nombre inventado.
   */
  productos: string[];
  /**
   * #1033 — ¿Es una compra de la persona? La marca la pone el server con
   * `dominio/estadosVenta.ts` (1, 2 y 9). Lo que no es compra —una cotización,
   * una anulada, un reembolso— sigue en la lista, pero no cuenta.
   */
  esCompra: boolean;
  /** #1033 — de qué negocios de Goberna es lo que se llevó. Vacío si la fuente no lo trae. */
  negocios: string[];
}

function deCerberus(ventas: readonly VentaFicha[]): CompraUnificada[] {
  return ventas.map((v) => ({
    folio: v.folio,
    monto: v.monto || null,
    moneda: v.moneda || null,
    fecha: v.fecha || null,
    canalOEstado: v.estado || null,
    fuente: 'cerberus',
    // `?? []`: una ficha rehidratada del caché (ADR 0007) puede venir de un
    // server que todavía no mandaba productos.
    productos: [...(v.productos ?? [])],
    esCompra: esCompra(v),
    negocios: [...(v.negocios ?? [])],
  }));
}

function dePadron(compras: readonly CompraDelPadron[]): CompraUnificada[] {
  return compras.map((c) => ({
    folio: c.folio ?? '',
    monto: c.monto,
    moneda: c.moneda,
    fecha: c.fecha,
    canalOEstado: c.canal,
    fuente: 'padron',
    productos: [],
    // Sin marca (un server anterior a #1033), cuenta: es lo que contaba siempre.
    esCompra: c.esCompra !== false,
    negocios: [],
  }));
}

/**
 * `ficha` verificada (`ventasCount !== null`) manda; si no, el padrón. Ninguna
 * de las dos fuentes se pregunta por su cuenta — reciben lo que ya se pidió.
 */
export function comprasUnificadas(
  ficha: Ficha | undefined,
  comprasDelPadron: readonly CompraDelPadron[] | undefined,
): CompraUnificada[] {
  const cliente = ficha?.estado === 'cliente' ? ficha : undefined;
  if (cliente && cliente.ventasCount !== null) return deCerberus(cliente.ventas);
  return dePadron(comprasDelPadron ?? []);
}

/** La más reciente. Las dos fuentes ya vienen ordenadas de más nueva a más vieja. */
export function ultimaCompra(compras: readonly CompraUnificada[]): CompraUnificada | null {
  return compras[0] ?? null;
}
