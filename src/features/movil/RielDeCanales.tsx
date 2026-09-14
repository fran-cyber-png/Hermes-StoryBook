import { Menu } from 'lucide-react';
import iconoWhatsapp from './iconos/whatsapp.svg?url';
import iconoFacebook from './iconos/facebook.svg?url';
import iconoMessenger from './iconos/messenger.svg?url';
import iconoInstagram from './iconos/instagram.svg?url';
import iconoFormulario from './iconos/formulario.svg?url';

/**
 * EL RIEL DE CANALES — la barra de abajo, solo en móvil.
 *
 * En escritorio el canal se filtra desde la barra de filtros de la cola y la
 * píldora de cada fila dice por dónde entró cada uno. En un teléfono esa barra
 * no entra, y «¿qué tengo sin contestar en Instagram?» es la pregunta con la
 * que se abre la app parada en la calle. Por eso el canal sube a navegación
 * primaria: es el eje que más se usa y el único que merece el pulgar.
 *
 * ⚠️ **LOS GLIFOS SON LOS EXPORTADOS DEL FIGMA, no los de `BadgeCanal`.** Ese
 * componente solo conoce tres canales (`facebook`, `instagram`, `whatsapp`) y
 * devuelve `null` para `landing`; acá hacen falta seis, con Messenger y
 * Formulario incluidos. Son marca externa —misma excepción documentada que los
 * colores de `BadgeCanal`— así que van como SVG committeado y no dibujados a
 * mano.
 *
 * El de «Todos» sí es de lucide: tres barras es un glifo genérico, no una marca.
 */

export type CanalDelRiel = 'todos' | 'whatsapp' | 'facebook' | 'messenger' | 'instagram' | 'formulario';

const CANALES: readonly { id: CanalDelRiel; rotulo: string; icono: string | null }[] = [
  { id: 'todos', rotulo: 'Todos', icono: null },
  { id: 'whatsapp', rotulo: 'WhatsApp', icono: iconoWhatsapp },
  { id: 'facebook', rotulo: 'Facebook', icono: iconoFacebook },
  { id: 'messenger', rotulo: 'Messenger', icono: iconoMessenger },
  { id: 'instagram', rotulo: 'Instagram', icono: iconoInstagram },
  { id: 'formulario', rotulo: 'Formulario', icono: iconoFormulario },
];

export function RielDeCanales({
  activo = 'todos',
  onElegir,
}: {
  activo?: CanalDelRiel;
  /** Sin esto el riel se ve pero no filtra: la galería lo usa así a propósito. */
  onElegir?: (canal: CanalDelRiel) => void;
}) {
  return (
    <nav
      aria-label="Canales"
      /* `shrink-0` y no una altura fija: el riel es el piso de la pantalla y no
         puede cederle alto a la lista cuando la lista crece. */
      className="flex shrink-0 items-start justify-center gap-1 bg-muted pt-3 pb-2"
    >
      {CANALES.map((c) => {
        const puesto = c.id === activo;
        return (
          <button
            key={c.id}
            type="button"
            aria-current={puesto ? 'page' : undefined}
            onClick={() => onElegir?.(c.id)}
            className={
              'flex w-16 flex-col items-center justify-center gap-1 overflow-hidden px-1 pb-2 pt-2.5 transition-colors duration-200 ease-house focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              (puesto
                ? 'rounded-xl bg-card shadow-[0px_1px_3px_0px_rgba(22,33,58,0.08)]'
                : 'rounded-[10px]')
            }
          >
            {c.icono ? (
              /* Tamaño fijo en el contenedor Y en la imagen: sin alto explícito
                 el SVG exportado se estira a su tamaño intrínseco. */
              <span className="size-[18px] shrink-0 overflow-hidden">
                <img src={c.icono} alt="" className="size-full" />
              </span>
            ) : (
              <Menu size={17} strokeWidth={2.4} className="shrink-0 text-foreground" />
            )}
            <span
              className={
                'w-full text-center font-heading text-[9px] leading-tight ' +
                (puesto ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')
              }
            >
              {c.rotulo}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
