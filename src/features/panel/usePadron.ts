import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * F.1 — EL PADRÓN DE ICARUS, POR TELÉFONO. Mismo patrón que `useFicha` y
 * `useLeadForm`: una query aparte, para que un fallo de icarus (503, ver
 * `routes/contactos.ts`) no tumbe ni la ficha de Cerberus ni el lead-form —
 * son tres fuentes independientes que el panel compone.
 */
export interface CompraDelPadron {
  folio: string | null;
  fecha: string | null;
  monto: string | null;
  moneda: string | null;
  canal: string | null;
  fuente: string;
  /** #1033 — ¿Es una compra de la persona? La pone el server (`dominio/estadosVenta.ts`: 1, 2 y 9). */
  esCompra?: boolean;
}

export interface PadronDeTelefono {
  nombre: string | null;
  correo: string | null;
  pais: string | null;
  ocupacion: string | null;
  compras: CompraDelPadron[];
  fuente: 'icarus';
}

export function usePadron(telefono: string | null, activo: boolean) {
  return useQuery({
    queryKey: ['padron', telefono],
    queryFn: () =>
      api<{ padron: PadronDeTelefono | null }>(`/api/contactos/padron?telefono=${encodeURIComponent(telefono ?? '')}`),
    enabled: activo && Boolean(telefono),
    staleTime: 60_000,
    // Un 503 de icarus (no configurado, o caído) no vale la pena reintentarlo:
    // el bloque simplemente no se dibuja, igual que un lead sin match.
    retry: false,
  });
}
