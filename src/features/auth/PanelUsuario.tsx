import { useCallback, useRef, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import { API_URL } from '../../config';
import { useBlobAutenticado } from '../../lib/datos/blobAutenticado';
import { inicial } from '../../lib/iniciales';
import { formatoTelefono } from '../../lib/formato';
import { useMiLinea } from '../whatsapp/miLinea';
import { ConfiguracionPerfil, PuntoDeConexion } from './ConfiguracionPerfil';
import { tieneSesionDeCerberus } from './identidad';
import type { Vendedora } from './sesion';
import type { EstadoActividad } from './actividad';

/**
 * QUIÉN SOY, EN ESTA APP — el avatar del riel, abajo a la izquierda.
 *
 * Hasta el 20-ago-2026 este popover mostraba identidad + estado de Cerberus +
 * líneas propias + los botones de vincular/cambiar clave. Primera decisión
 * del dueño ese día: el popover queda liviano, con SOLO dos acciones —
 * «Configuración» y «Cerrar sesión» — y todo el detalle (líneas del equipo,
 * vincular WhatsApp, cambiar contraseña) se muda adentro de
 * `ConfiguracionPerfil`. **Enmienda, mismo día**: arriba de esas dos acciones
 * vuelve un RESUMEN — foto, nombre y el número que trajo por auto-vinculación
 * con un punto de conexión (verde parpadeante · rojo) — porque un popover sin
 * ningún «quién soy» resultó demasiado liviano. La diferencia con lo viejo:
 * esto es un resumen de tres líneas, no la lista completa de antes.
 *
 * El disparador ahora muestra la FOTO de perfil si hay una, y si no, la
 * PRIMERA letra del nombre (una sola: es su propio icono, no el de un
 * contacto). `useBlobAutenticado` porque el endpoint está detrás del
 * perímetro y un `<img src>` no manda el Bearer (mismo mecanismo que
 * `components/Avatar.tsx`).
 */
export function PanelUsuario({
  vendedora,
  onSalir,
  onPerfilActualizado,
  cerberusVivo,
  actividad,
}: {
  vendedora: Vendedora;
  onSalir: () => void;
  /** El nombre/apodo/foto cambiaron: refresca `vendedora` (`useSesion().reintentar`). */
  onPerfilActualizado: () => void;
  /** `null` = todavía no se sabe. Mismo criterio que `AvisoCerberus`: solo `false` es lo que hay que denunciar. */
  cerberusVivo: boolean | null;
  /** El latido de la sesión (`useActividadDeSesion`, calculado en `App.tsx`): solo se reenvía. */
  actividad: EstadoActividad;
}) {
  const [abierto, setAbierto] = useState(false);
  // Vive ACÁ y no adentro del popover: si conviviera, dos listeners de Escape
  // en captura sobre `window` (el de `usePopover` y el de `useEscape` del
  // modal) competirían por la MISMA tecla. Al abrir el modal se cierra el
  // popover (`cerrar()`), así que su listener se desregistra y solo queda uno.
  const [configurando, setConfigurando] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);

  const cerrar = useCallback(() => {
    setAbierto(false);
    disparador.current?.focus();
  }, []);
  const { propsOverlay } = usePopover(abierto, cerrar, { z: 'z-30' });

  const { url: foto } = useBlobAutenticado(vendedora.fotoUrl ? `${API_URL}${vendedora.fotoUrl}` : null);
  // Solo hace falta mientras el popover está abierto: `staleTime` de 5 min en
  // `useMiLinea` hace que abrir/cerrar no dispare una consulta de más.
  const { data: miLinea } = useMiLinea();
  const conectadaLinea = miLinea?.sesion?.estado === 'conectado';
  // Identidades de Centurión no tienen sesión de Cerberus posible — mostrar
  // el punto ahí sería denunciar algo que nunca pudo estar conectado.
  const mostrarCerberus = tieneSesionDeCerberus(vendedora.id);
  const conectadaCerberus = cerberusVivo !== false;

  return (
    <span className="relative">
      <button
        ref={disparador}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        title={`${vendedora.nombre} — toca para ver tu información`}
        className={
          'flex size-9 items-center justify-center overflow-hidden rounded-lg font-heading text-[11px] font-bold ' +
          'transition-[background-color,transform] duration-200 ease-house active:scale-[0.96] ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          (abierto ? 'bg-navy text-white' : 'bg-secondary text-navy-ink hover:bg-navy hover:text-white')
        }
      >
        {foto ? <img src={foto} alt="" className="size-full object-cover" /> : inicial(vendedora.nombre)}
      </button>

      {abierto && (
        <>
          <div {...propsOverlay} />
          {/* Se abre a la DERECHA y anclado abajo: el riel está pegado al borde
              izquierdo y el avatar al pie, así que cualquier otra dirección se
              sale de la pantalla. */}
          <div
            role="dialog"
            aria-label="Tu cuenta"
            className="absolute bottom-0 left-full z-40 ml-2 w-72 rounded-xl border border-border bg-card p-3 shadow-panel"
          >
            {/* Foto, nombre, línea vinculada y sesión de Cerberus — en ese
                orden y APILADOS (pedido del dueño, 20-ago-2026: la foto 2,5×
                más grande — 140px, contra los 56px de la primera versión — y
                el popover más alto para que entre bien). El detalle completo
                (líneas del equipo, vincular, cambiar contraseña) vive en
                «Configuración»; acá solo el resumen. */}
            <div className="flex flex-col items-center gap-1 pb-3 text-center">
              <span className="flex size-[140px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy font-heading text-4xl font-bold text-white">
                {foto ? <img src={foto} alt="" className="size-full object-cover" /> : inicial(vendedora.nombre)}
              </span>
              <p className="mt-2 max-w-full truncate text-sm font-bold text-foreground">{vendedora.nombre}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <PuntoDeConexion conectada={conectadaLinea} />
                {miLinea?.numero ? formatoTelefono(miLinea.numero) : 'Sin vincular'}
              </p>
              {mostrarCerberus && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PuntoDeConexion conectada={conectadaCerberus} />
                  {conectadaCerberus ? 'Conectado a Cerberus' : 'Sin sesión de Cerberus'}
                </p>
              )}
            </div>
            <div className="mx-1 mb-1.5 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                cerrar();
                setConfigurando(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Settings size={16} className="shrink-0 text-muted-foreground" /> Configuración
            </button>
            <button
              type="button"
              onClick={onSalir}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut size={16} className="shrink-0" /> Cerrar sesión
            </button>
          </div>
        </>
      )}

      {configurando && (
        <ConfiguracionPerfil
          vendedora={vendedora}
          onCerrar={() => setConfigurando(false)}
          onPerfilActualizado={onPerfilActualizado}
          actividad={actividad}
        />
      )}
    </span>
  );
}
