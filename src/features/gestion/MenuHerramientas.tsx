import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MoreVertical, X } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import { agruparPorSeccion, armarItemsMenu, ROTULO_SECCION } from './itemsHerramientas';
import { GestorCategorias } from './GestorCategorias';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelPlantillas } from '../plantillas/PanelPlantillas';
import { PantallaHechos } from '../hechos/PantallaHechos';

/**
 * EL BOTÓN `···` — la puerta única a las herramientas de venta, siempre en
 * el mismo lugar sobre CUALQUIER conversación.
 *
 * De las cinco herramientas (correo rápido, mensajes predeterminados,
 * etiquetas, notas, catálogo), ya aterrizaron **dos**: «Etiquetas» (#48) abre
 * el `GestorCategorias` y **«Mensajes predeterminados» (#45/#101)** abre el
 * cajón de secuencias. Las que faltan siguen deshabilitadas con «Próximamente»
 * — el día que existan, `MenuHerramientas` le pasa su callback a
 * `armarItemsMenu` y el item se habilita solo.
 *
 * El cierre —Escape y clic afuera, sin chocar con el composer del chat— lo
 * pone `usePopover` (`src/lib/teclado/`). Lo propio de acá: panel `absolute`
 * con `shadow-panel` (sombra, sin borde) y botones planos con
 * `aria-label`/`title`, sin roles de menú — son botones en un panel, no un
 * `<menu>` con navegación por flechas.
 */
export function MenuHerramientas({
  conversacion,
  esDeCampana,
}: {
  conversacion: Conversacion;
  /**
   * ¿De qué módulo de CRM es quien mira? (ADR 0063). Decide QUÉ HERRAMIENTAS se
   * ofrecen: «Datos recomendados» es el playbook de la Escuela y su ruta ya es
   * 403 para campaña, así que el ítem sobraba — abría una pantalla que decía
   * «Todavía no hay datos cargados» en vez de «esto no es tuyo».
   */
  esDeCampana?: boolean;
}) {
  const clave = conversacion.clave;
  const [abierto, setAbierto] = useState(false);
  const [gestorAbierto, setGestorAbierto] = useState(false);
  const [plantillasAbiertas, setPlantillasAbiertas] = useState(false);
  const [datosAbiertos, setDatosAbiertos] = useState(false);
  const primerItemRef = useRef<HTMLButtonElement>(null);

  // Cambió la conversación (otro lead, otra vista): el menú no puede
  // sobrevivir abierto apuntando a la de antes — `BarraGestion` no se
  // re-keyea por `clave`, así que hay que cerrarlo a mano acá.
  useEffect(() => {
    setAbierto(false);
  }, [clave]);

  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  // Al abrir, el foco va al primer item (regla del issue). Los items
  // deshabilitados usan aria-disabled en vez de `disabled` para seguir
  // siendo enfocables — un botón HTML `disabled` no puede recibir foco.
  useEffect(() => {
    if (abierto) primerItemRef.current?.focus();
  }, [abierto]);

  // «Etiquetas» ya tiene herramienta: abre el gestor de categorías (#48). El
  // resto sigue sin handler (deshabilitado) hasta que su propio issue lo conecte.
  const items = armarItemsMenu(
    clave,
    {
      etiquetas: () => setGestorAbierto(true),
      mensajes: () => setPlantillasAbiertas(true),
      // El catálogo de datos recomendados (`hechos`). Vive acá porque el bloque
      // que los mostraba en el panel derecho quedó huérfano al rediseño de ADR
      // 0017 y nadie lo monta: una puerta ahí no se abre desde ningún lado.
      datos: () => setDatosAbiertos(true),
    },
    // El módulo de quien mira, con la MISMA traducción que `etapasBarraDe` en
    // `BarraGestion`. El handler de arriba se arma igual —es más barato que
    // ramificar— y `armarItemsMenu` decide si el ítem llega a dibujarse: el
    // filtro vive en UN lugar (`herramientasDe`) y no repartido por callbacks.
    esDeCampana ? 'campana' : 'ventas',
  );
  const grupos = agruparPorSeccion(items);
  let indiceGlobal = -1;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Más herramientas"
        title="Más herramientas"
        onClick={() => setAbierto((v) => !v)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-shadow duration-200 hover:shadow-[0_0_0_4px_rgba(37,99,235,0.35),0_0_14px_rgba(37,99,235,0.65)]"
      >
        <MoreVertical size={15} />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute right-0 top-9 z-30 w-64 rounded-xl bg-card p-1.5 shadow-panel">
            {grupos.map((grupo, g) => (
              <div key={grupo.seccion}>
                {g > 0 && <div className="my-1 border-t border-border" />}
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ROTULO_SECCION[grupo.seccion]}
                </div>
                {grupo.items.map((item) => {
                  indiceGlobal += 1;
                  const habilitado = Boolean(item.onSeleccionar);
                  return (
                    <button
                      key={item.id}
                      ref={indiceGlobal === 0 ? primerItemRef : undefined}
                      type="button"
                      aria-disabled={!habilitado}
                      title={habilitado ? undefined : 'Próximamente'}
                      onClick={() => {
                        if (!item.onSeleccionar) return;
                        item.onSeleccionar();
                        setAbierto(false);
                      }}
                      className={
                        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium transition-colors ' +
                        (habilitado ? 'text-foreground hover:bg-muted/50' : 'cursor-default text-muted-foreground/50')
                      }
                    >
                      <item.Icono
                        size={14}
                        className={
                          'shrink-0 transition-transform ' +
                          (habilitado ? item.color + ' group-hover:translate-x-0.5' : 'text-muted-foreground/40')
                        }
                      />
                      <span className="flex-1 truncate">{item.etiqueta}</span>
                      {item.nuevo ? (
                        <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">
                          Nuevo
                        </span>
                      ) : habilitado ? (
                        <ChevronRight size={12} className="shrink-0 text-muted-foreground/50" />
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          Próximamente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {gestorAbierto && <GestorCategorias onCerrar={() => setGestorAbierto(false)} />}

      {/* Las secuencias de venta (#45/#101). Panel lateral, no modal: la
          vendedora sigue viendo el chat mientras elige qué mandar. */}
      {plantillasAbiertas && (
        <>
          <span
            className="fixed inset-0 z-40 bg-navy/20"
            onClick={() => setPlantillasAbiertas(false)}
            aria-hidden="true"
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-[22rem] max-w-[92vw] flex-col bg-card p-3 shadow-panel">
            <div className="mb-2 flex shrink-0 items-center gap-2">
              <h2 className="font-heading text-sm font-bold text-navy-ink">Mensajes predeterminados</h2>
              <button
                type="button"
                onClick={() => setPlantillasAbiertas(false)}
                aria-label="Cerrar"
                className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PanelPlantillas conversacion={conversacion} />
            </div>
          </aside>
        </>
      )}

      {/* El catálogo de datos recomendados: pantalla completa, porque lo que
          hay que poder mirar —qué llega a verse en cada momento— no entra en un
          cajón de 22rem. Cierra con Escape (contrato de `useEscape`). */}
      {datosAbiertos && <PantallaHechos onCerrar={() => setDatosAbiertos(false)} />}
    </span>
  );
}
