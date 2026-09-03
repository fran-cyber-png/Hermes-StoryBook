import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { VistaCambiarClave, type PasoCambiarClave } from './CambiarClave';
import { VistaConfiguracionPerfil } from './ConfiguracionPerfil';

/**
 * LA GALERÍA DE «CAMBIAR CONTRASEÑA» — evidencia de la regla dura #2, sin server
 * ni `fetch`: importa `VistaCambiarClave` directo (sin hooks), el mismo truco que
 * `galeria-mi-linea.tsx`, y el modal de Configuración abierto con
 * `VistaConfiguracionPerfil` (desde el 20-ago-2026 «Cambiar contraseña» vive
 * ahí, no en el popover chico del avatar).
 *
 * Entry APARTE de Vite (`galeria-cambiar-clave.html`, no entra al bundle):
 *
 *     npx vite --port 5199
 *     → http://localhost:5199/galeria-cambiar-clave.html?paso=panel
 *     → ?paso=formulario | formulario_error | rechazo_django | enviando | listo | no_disponible
 *     → ?paso=panel_centurion — el mismo panel, con una identidad de Centurión (el botón ya se ofrece)
 *
 * Los dos rechazos son los que devuelve producción, no un texto inventado: el
 * de la actual es el de `routes/auth.ts`, y el de Django es literalmente lo que
 * dice su `MinimumLengthValidator` en castellano.
 */

const nada = () => {};
const CAMPOS = { actual: '••••••••', nueva: 'Nueva-Segura-2026', repetir: 'Nueva-Segura-2026' };

const PASOS: Record<string, PasoCambiarClave> = {
  formulario: { tipo: 'formulario', campos: { actual: '', nueva: '', repetir: '' }, onCampo: nada, onEnviar: nada, enviando: false, error: null },
  formulario_error: {
    tipo: 'formulario',
    campos: CAMPOS,
    onCampo: nada,
    onEnviar: nada,
    enviando: false,
    error: 'La contraseña actual no es correcta.',
  },
  rechazo_django: {
    tipo: 'formulario',
    campos: { actual: '••••••••', nueva: '1234', repetir: '1234' },
    onCampo: nada,
    onEnviar: nada,
    enviando: false,
    error: 'Esta contraseña es demasiado corta. Debe contener al menos 8 caracteres. Esta contraseña es completamente numérica.',
  },
  enviando: { tipo: 'formulario', campos: CAMPOS, onCampo: nada, onEnviar: nada, enviando: true, error: null },
  listo: { tipo: 'listo', onCerrar: nada },
  /** Un candidato de campaña (identidad de Centurión): sin formulario, solo el aviso. */
  no_disponible: { tipo: 'no_disponible' },
};

const paso = new URLSearchParams(location.search).get('paso') ?? 'formulario';

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {paso === 'panel' || paso === 'panel_centurion' ? (
        // El modal de Configuración, centrado, con «Cambiar contraseña» a la vista.
        <VistaConfiguracionPerfil
          vendedora={
            paso === 'panel_centurion'
              ? { id: 'centurion:usuario14', nombre: 'centurion:usuario14' }
              : { id: 'ventas12@grupogoberna.com', nombre: 'Ventas12' }
          }
          fotoUrl={null}
          numeroVinculado={paso === 'panel_centurion' ? null : '51955135507'}
          conectada={paso !== 'panel_centurion'}
          lineasPropias={
            paso === 'panel_centurion'
              ? [{ numero: '51963139984', etiqueta: 'Betto', estado: 'conectado', mias: true, compartida: false }]
              : [{ numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true, compartida: true }]
          }
          motivoVincular={null}
          onCerrar={nada}
          onGuardar={nada}
          guardando={false}
          errorGuardar={null}
          onElegirFoto={nada}
          subiendoFoto={false}
          errorFoto={null}
          onQuitarFoto={nada}
          quitandoFoto={false}
          actividad={{ activo: true, transcurrido: '00:14:32' }}
        />
      ) : (
        <VistaCambiarClave paso={PASOS[paso] ?? PASOS.formulario} onCerrar={nada} />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
