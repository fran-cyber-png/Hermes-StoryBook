import { useQuery } from '@tanstack/react-query';
import { api, ErrorApi } from '../../lib/datos/cliente';
import type { Ficha } from '../cerberus/ficha';
import type { LeadForm } from '../cerberus/leadForm';
import type { PadronDeTelefono } from './usePadron';

/**
 * #1033 — EL PERFIL DEL CONTACTO, UNA SOLA CONSULTA.
 *
 * Reemplaza, al abrir el panel, a las tres que se pedían por separado:
 * `useFicha` (Cerberus EN VIVO, techo de 12 s y «sin verificar» para todos),
 * `useLeadForm` y `usePadron`. El server arma las tres respuestas con lo que
 * Hermes ya guardó (`server/src/contactos/perfil.ts`): la ficha sale de la copia
 * local de Cerberus, verificada por teléfono, y ninguna fuente caída tumba a
 * las otras — lo que no contestó viene en `errores`.
 *
 * ⚠️ **Las tres formas son las de siempre** (`Ficha`, `LeadForm`, el padrón),
 * así que lo que las dibuja no cambia: cambia de dónde salen.
 *
 * ⚠️ **Registrar una venta sigue preguntando en vivo** (`VentaDesdeElPanel` usa
 * `useFicha`): un cliente de Cerberus que todavía no compró no está en la copia,
 * y crearlo de nuevo por no encontrarlo sería un duplicado en el ERP.
 */
export interface PerfilDelContacto {
  ficha: Ficha;
  lead: LeadForm | null;
  padron: PadronDeTelefono | null;
  errores: string[];
}

/**
 * ⚠️ `perfil-contacto` y no `perfil`: `['perfil']` es el perfil de QUIEN ENTRÓ
 * (`auth/perfil.ts`), y react-query invalida por prefijo — cambiar la contraseña
 * habría vuelto a pedir la ficha de cada contacto abierto. Registrar una venta la
 * invalida por esta clave (`venta/useVenta.ts`).
 */
export const CLAVE_PERFIL_CONTACTO = 'perfil-contacto';

export function usePerfil(telefono: string | null, activo: boolean) {
  return useQuery({
    queryKey: [CLAVE_PERFIL_CONTACTO, telefono],
    queryFn: ({ signal }) =>
      api<PerfilDelContacto>(`/api/contactos/perfil?telefono=${encodeURIComponent(telefono ?? '')}`, {
        // Todo lo que responde es local: si tarda más que esto, algo está colgado.
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      }),
    enabled: activo && Boolean(telefono),
    staleTime: 60_000,
    /**
     * Un corte de red o el reinicio del server en cada deploy no pueden dejar la
     * ficha en «no cargó»: eso se reintenta dos veces, rápido. Lo que reintentar no
     * cambia, no: un 4xx (la ruta no existe, la sesión venció) y el techo de 8 s
     * —con tres intentos la vendedora miraría un esqueleto casi medio minuto—.
     */
    retry: (intentos, error) =>
      intentos < 2 &&
      !(error instanceof ErrorApi && error.status < 500) &&
      !(error instanceof DOMException && error.name === 'TimeoutError'),
    retryDelay: (intento) => 600 * (intento + 1),
  });
}
