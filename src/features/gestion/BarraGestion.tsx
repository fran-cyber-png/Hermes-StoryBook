import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Search, Star, Tag, UserPlus, X } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { usePopover } from '../../lib/teclado/usePopover';
import { CLASE_RELLENO_HOVER, claseIconoNeon } from '../../lib/estiloNeon';
import { ETAPA_CHIP, etapasDeclarablesDe, rotuloEtapa } from '../../lib/etapas';
import type { Conversacion } from '../../dominio/conversaciones';
import { categoriasOrdenadas } from '../../dominio/cola';
import { AgendarRapido } from '../agenda/AgendarRapido';
import { FichaRapida } from '../panel/FichaRapida';
import { useFichaLocal } from '../panel/fichaLocal';
import { PasarConversacion } from '../reparto/PasarConversacion';
import { BotonLlamar } from './BotonLlamar';
import { Intereses } from './Intereses';
import { ConfirmarPerdida, type PerdidaDeclarada } from './ConfirmarPerdida';
import { esMotivoDePerdida, type MotivoDePerdida } from '../../lib/motivosDePerdida';
import { useCategorias, useEtiquetasDe, useMutacionesCategorias, usePuedeAdministrarCategorias } from './categorias';
import {
  CLASE_FONDO,
  CLASE_FONDO_SUAVE,
  CLASE_TEXTO,
  COLORES,
  NOMBRE_COLOR,
  claseBorde,
  esColorCategoria,
  normalizarNombre,
  resolverColor,
  type ColorCategoria,
} from '../../dominio/paletaCategorias';

/** Sin acentos y en minúsculas — para buscar, nunca para mostrar. Misma copia chica que ya
 *  viven en `BarraFiltros.tsx` y `lib/producto.ts`: es de 2 líneas, y centralizarla costaría
 *  más en el import que en mantener las tres iguales. */
function sinAcentos(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * LA BARRA DE GESTIÓN — el embudo entero manejable DESDE el chat.
 *
 * La ETAPA (`SelectorEtapa`, con «Dijo que no» pidiendo motivo — ADR 0107) y
 * el INTERÉS (`Intereses`, el buscador de curso) viven acá. `Asignar`
 * (`PasarConversacion`) es la excepción: vive en `HojaContacto.tsx`, no en
 * esta barra.
 */

/**
 * Etiquetas inline: las CATEGORÍAS (con color) asignadas a esta conversación.
 *
 * La ASIGNACIÓN sigue contra el endpoint compartido del equipo
 * (`/api/gestiones/etiquetas`, por string) — CUALQUIERA etiqueta, eso no
 * cambió. El COLOR se resuelve en el front contra el catálogo del módulo
 * (`/api/categorias`) — una etiqueta que matchea una categoría toma su color;
 * la que no, se pinta neutra.
 *
 * 🔴 **El ÍCONO es el que se clickea, y el popover es la misma «grilla de
 * color» del selector de categorías de la cola** (`SelectorCategorias` en
 * `BarraFiltros.tsx`) — rediseño del 11-sep-2026, pedido del dueño, con dos
 * artifacts de por medio («Categoría en un toque» y «Selector de categoría»).
 * Antes eran DOS elementos (un tag gris inerte + un botón punteado «+») para
 * una sola acción; ahora es un solo ícono con una insignia «+» que aparece en
 * hover, mismo lenguaje que Llamar/Agendar/Contacto.
 *
 * ⚠️ **La grilla muestra TODO el catálogo, no sólo lo no-asignado.** El check
 * sobre una ya asignada la QUITA (mismo `quitar.mutate` que la «x» de la
 * píldora de afuera) — antes sólo se podía quitar cerrando el popover y
 * tocando esa «x»; ahora las dos puertas hacen lo mismo. Por eso ya no hay
 * `disponibles` filtrando el catálogo: hay `categorias` entero.
 *
 * 🔴 **El «+» elige de las categorías EXISTENTES para cualquiera; «crear una
 * nueva categoría» es SOLO del supervisor** (22-ago-2026, pedido del dueño:
 * «los vendedores pueden solo etiquetar»). El server ya rechazaba el POST de
 * un no-supervisor con 403 — lo que faltaba acá era no OFRECER el formulario
 * de creación a quien no puede usarlo, y no seguir de largo hacia el `asignar`
 * cuando el `crear` fallaba (antes corría en `onSettled`, que dispara en
 * error IGUAL que en éxito: una vendedora habría terminado etiquetando con un
 * nombre que el servidor nunca llegó a dar de alta). `usePuedeAdministrarCategorias()`
 * es la ÚNICA fuente de esa bandera — nunca un rol calculado en el front,
 * mismo patrón que `GestorCategorias.tsx`. Se ofrece SIEMPRE que puede —nada
 * de un interruptor manual: eso vivió sólo en el artifact, para simular las
 * dos vistas sin sesión real.
 *
 * 🔴 **El color de la categoría nueva sigue siendo SÓLO uno de los 8 de
 * marca** (`COLORES`) — el círculo multicolor que lo elige es arcoíris fijo,
 * nunca RGB libre: abre una paleta con esos 8 y nada más, la misma decisión
 * que ya regía acá (antes una fila de 8 puntos siempre visible), sólo que
 * ahora entra en un popover propio en vez de ocupar espacio todo el tiempo.
 *
 * Regla dura: la píldora usa BORDE de color, nunca sombra, nunca oro.
 */
function EtiquetasInline({ clave, senalAbrir = 0 }: { clave: string; senalAbrir?: number }) {
  const qc = useQueryClient();
  // La MISMA lectura que dibuja el panel derecho (`useEtiquetasDe`, en
  // `categorias.ts`): una sola definición de qué se pide y cómo se lee.
  const { data: lista = [] } = useEtiquetasDe(clave);
  const { data: categorias = [] } = useCategorias();
  const { data: puedeAdministrar = false } = usePuedeAdministrarCategorias();
  const { crear } = useMutacionesCategorias();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [colorNuevo, setColorNuevo] = useState<ColorCategoria>('azul');
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  /** El atajo `T`: la señal se consume en el render, sin un frame de retraso. */
  const [visto, setVisto] = useState(senalAbrir);
  if (senalAbrir !== visto) {
    setVisto(senalAbrir);
    setAbierto(true);
  }

  // Antes solo cerraba con clic afuera: con el foco en el «+» (no en el input),
  // Escape no lo tocaba y llegaba al shell, que cerraba la conversación de atrás
  // y dejaba el panel flotando sobre otra cosa. El Escape de ADENTRO del input
  // lo sigue manejando el input, que es de quien es.
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });
  // La paleta de color es un popover ADENTRO del popover — mismo hook, mismo
  // cuidado de Escape/clic afuera, un nivel más de `z`.
  const { propsOverlay: propsOverlayPaleta } = usePopover(paletaAbierta, () => setPaletaAbierta(false), {
    z: 'z-40',
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['etiquetas', clave] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['categorias'] });
  };
  const asignar = useMutation({
    mutationFn: (etiqueta: string) =>
      api('/api/gestiones/etiquetas', { method: 'POST', body: JSON.stringify({ clave, etiqueta }) }),
    onSuccess: invalidar,
  });
  const quitar = useMutation({
    mutationFn: (etiqueta: string) =>
      api('/api/gestiones/etiquetas', { method: 'DELETE', body: JSON.stringify({ clave, etiqueta }) }),
    onSuccess: invalidar,
  });

  const asignadas = new Set(lista);
  const q = sinAcentos(busqueda.trim());
  const catalogo = categoriasOrdenadas(categorias);
  const filtradas = q ? catalogo.filter((c) => sinAcentos(c.nombre).includes(q)) : catalogo;

  function crearYAsignar() {
    if (!puedeAdministrar) return; // el botón ya está oculto/disabled; red de más.
    const limpio = normalizarNombre(nuevo);
    if (!limpio) return;
    // Dos pasos: crea la categoría (con color) y la asigna a esta conversación.
    // 🔴 `onSuccess`, NO `onSettled`: éste dispara también cuando `crear` falla
    // (409 duplicada, 403 sin permiso) y antes seguía de largo igual —
    // terminaba etiquetando con un nombre que el servidor nunca dio de alta.
    crear.mutate(
      { nombre: limpio, color: colorNuevo },
      {
        onSuccess: () => {
          asignar.mutate(limpio);
          setNuevo('');
          setAbierto(false);
        },
      },
    );
  }

  return (
    <span className="relative flex items-center gap-1">
      {lista.map((etq) => {
        const color = resolverColor(etq, categorias);
        return (
          <span
            key={etq}
            className={
              'group/tag inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold ' +
              claseBorde(color) +
              (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
            }
          >
            {color && <span className={'h-1.5 w-1.5 rounded-full ' + CLASE_FONDO[color]} />}
            {etq}
            <button
              type="button"
              aria-label={`Quitar ${etq}`}
              onClick={() => quitar.mutate(etq)}
              className="opacity-40 transition-opacity focus-visible:opacity-100 group-hover/tag:opacity-100"
            >
              <X size={9} />
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Asignar categoría"
        aria-label="Asignar categoría"
        aria-expanded={abierto}
        className={
          'group relative inline-flex size-7 shrink-0 items-center justify-center rounded-[11px] text-primary transition-colors duration-200 ' +
          (abierto ? 'bg-secondary' : 'hover:bg-secondary')
        }
      >
        <Tag
          size={15}
          className={
            'transition-transform duration-300 ease-house ' +
            (abierto ? 'rotate-0 scale-110' : '-rotate-[8deg] group-hover:rotate-0 group-hover:scale-110')
          }
        />
        <span
          aria-hidden="true"
          className={
            'absolute bottom-0.5 right-0.5 flex size-3 items-center justify-center rounded-full border-2 border-card bg-primary text-white transition-transform duration-300 ease-house ' +
            (abierto ? 'scale-100' : 'scale-0 group-hover:scale-100')
          }
        >
          <Plus size={8} />
        </span>
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            aria-label="Categorías"
            className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-muted-foreground/20 bg-card p-1.5 shadow-panel-flotante"
          >
            {catalogo.length > 6 && (
              <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1">
                <Search size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setAbierto(false);
                    }
                  }}
                  placeholder="Buscar categoría…"
                  aria-label="Buscar categoría"
                  className="min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            {catalogo.length === 0 && !puedeAdministrar && (
              <p className="px-1.5 py-3 text-[11px] text-muted-foreground">
                Todavía no hay categorías para asignar. Pídele al supervisor que arme el catálogo.
              </p>
            )}

            {catalogo.length > 0 && (
              <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted/70 p-1">
                {filtradas.map((c) => {
                  const color = esColorCategoria(c.color) ? c.color : 'pizarra';
                  const activa = asignadas.has(c.nombre);
                  return (
                    <button
                      key={c.nombre}
                      type="button"
                      aria-pressed={activa}
                      title={activa ? `Quitar «${c.nombre}»` : `Asignar «${c.nombre}»`}
                      onClick={() => (activa ? quitar.mutate(c.nombre) : asignar.mutate(c.nombre))}
                      className={
                        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold capitalize transition-[background-color,box-shadow] ' +
                        (activa
                          ? CLASE_FONDO_SUAVE[color] + ' ' + CLASE_TEXTO[color]
                          : 'text-foreground hover:bg-card hover:shadow-sm')
                      }
                    >
                      <span className={'size-2 shrink-0 rounded-full ' + CLASE_FONDO[color]} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      {c.esFavorito && (
                        <Star size={10} fill="currentColor" className="shrink-0 text-navy-ink" aria-hidden="true" />
                      )}
                      {activa && <Check size={11} className="shrink-0 text-success" aria-hidden="true" />}
                    </button>
                  );
                })}
                {filtradas.length === 0 && (
                  <p className="col-span-2 px-2 py-3 text-center text-[11px] text-muted-foreground">Sin resultados.</p>
                )}
              </div>
            )}

            {/* Crear una categoría nueva es SOLO del supervisor — cualquiera
                sigue pudiendo elegir de la grilla de arriba. */}
            {puedeAdministrar && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                <input
                  value={nuevo}
                  maxLength={30}
                  onChange={(e) => setNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') crearYAsignar();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setAbierto(false);
                    }
                  }}
                  placeholder="nueva categoría…"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                />

                <span className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaletaAbierta((v) => !v)}
                    aria-label="Elegir color"
                    aria-haspopup="menu"
                    aria-expanded={paletaAbierta}
                    title="Elegir color"
                    className="block size-[18px] rounded-full shadow-[0_0_0_2px_var(--muted),0_0_0_3px_var(--border)] transition-transform duration-150 ease-house hover:scale-110"
                    style={{
                      background:
                        'conic-gradient(var(--cat-rojo), var(--cat-naranja), var(--cat-verde), var(--cat-cian), var(--cat-azul), var(--cat-morado), var(--cat-rosa), var(--cat-rojo))',
                    }}
                  />
                  {paletaAbierta && (
                    <>
                      <span {...propsOverlayPaleta} />
                      <div className="absolute bottom-full left-1/2 z-40 mb-2 w-max -translate-x-1/2 rounded-xl border border-border bg-card p-2.5 shadow-panel-flotante">
                        <div className="grid grid-cols-4 gap-2">
                          {COLORES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={NOMBRE_COLOR[c]}
                              aria-pressed={colorNuevo === c}
                              title={NOMBRE_COLOR[c]}
                              onClick={() => {
                                setColorNuevo(c);
                                setPaletaAbierta(false);
                              }}
                              className={
                                'flex size-6 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ' +
                                CLASE_FONDO[c] +
                                (colorNuevo === c ? ' ring-2 ring-navy ring-offset-1 ring-offset-card' : '')
                              }
                            >
                              {colorNuevo === c && <Check size={11} />}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 flex items-center justify-center gap-1 border-t border-border pt-2 text-[11px] font-semibold text-foreground">
                          <span className={'size-1.5 rounded-full ' + CLASE_FONDO[colorNuevo]} aria-hidden="true" />
                          {NOMBRE_COLOR[colorNuevo]}
                        </p>
                      </div>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  aria-label="Crear y asignar"
                  onClick={crearYAsignar}
                  disabled={!normalizarNombre(nuevo) || crear.isPending}
                  className="flex shrink-0 items-center rounded-md bg-primary p-1 text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
                >
                  {crear.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {(asignar.isError || quitar.isError) && (
        <span className="text-[11px] text-destructive">No se guardó — prueba de nuevo.</span>
      )}
    </span>
  );
}

/**
 * Los cuatro peldaños que una persona puede DECLARAR, en singular: acá se habla
 * de UNA conversación. `perdido` sigue afuera a propósito — vive fuera del
 * segmented porque pide confirmación (ver abajo).
 *
 * Los rótulos salen de `lib/etapas` y no de acá: eran una de las cinco copias
 * que se unificaron, y con dos listas el Pipeline decía «Saben el precio»
 * mientras esta barra decía «Cotizado» sobre la misma conversación.
 */
const etapasBarraDe = (modulo: 'ventas' | 'campana') =>
  etapasDeclarablesDe(modulo).map((id) => ({ id, label: rotuloEtapa(id) }));

/**
 * EN QUÉ ETAPA ESTÁ ESTA CONVERSACIÓN — y cómo cambiarla sin salir del chat.
 *
 * Las cuatro que una persona puede DECLARAR, más `perdido`, que vive abajo del
 * separador porque no es una etapa más: es tirar la toalla, y por eso pide
 * confirmación adentro del mismo menú (no un modal: la acción es reversible —
 * se vuelve eligiendo otra etapa).
 *
 * ⚠️ Lo que se declara es un PISO, no la verdad: el embudo DERIVA la etapa
 * efectiva de lo que hizo el comprador (ADR 0044), y lo declarado sólo empuja
 * hacia arriba. Por eso acá no se ofrece «nunca contestó» — eso no se declara,
 * se deriva, y deja de ser cierto solo.
 */
function SelectorEtapa({
  etapa,
  etapas,
  moviendo,
  onElegir,
  senalAbrir = 0,
  pideMotivo,
  motivoActual = null,
}: {
  etapa: string;
  /**
   * Los peldaños que se OFRECEN, ya resueltos por módulo (ADR 0063).
   *
   * ⚠️ **Llegan como prop y no se calculan acá**: este componente es
   * presentación —decide cómo se ve el menú, no qué peldaños existen— y quien
   * sabe de qué embudo es la conversación es `BarraGestion`, que tiene la
   * sesión. Con el cálculo adentro habría que pasarle igual el módulo, y
   * entonces son dos lugares decidiendo lo mismo.
   */
  etapas: readonly { id: string; label: string }[];
  moviendo: boolean;
  /** `perdida` sólo viaja con `perdido`, y sólo cuando se pidió el motivo (ventas). */
  onElegir: (etapa: string, perdida?: PerdidaDeclarada | null) => void;
  /** Señal externa (contador): al cambiar, abre el menú. La usa el atajo `E`. */
  senalAbrir?: number;
  /** ¿«Dijo que no» pide su motivo? Sí en ventas, no en campaña (ADR 0107). */
  pideMotivo: boolean;
  /** El motivo de la pérdida vigente, para corregirlo arrancando desde el que tiene. */
  motivoActual?: MotivoDePerdida | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmaPerdido, setConfirmaPerdido] = useState(false);
  const [visto, setVisto] = useState(senalAbrir);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  if (senalAbrir !== visto) {
    setVisto(senalAbrir);
    setAbierto(true);
  }

  function elegir(id: string, perdida?: PerdidaDeclarada | null) {
    onElegir(id, perdida);
    setAbierto(false);
    setConfirmaPerdido(false);
  }

  return (
    <span className="relative">
      <button
        type="button"
        disabled={moviendo}
        aria-expanded={abierto}
        title="Cambiar la etapa (E)"
        onClick={() => setAbierto((v) => !v)}
        className={
          'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity disabled:opacity-50 ' +
          (ETAPA_CHIP[etapa] ?? 'bg-muted text-foreground')
        }
      >
        {moviendo ? <Loader2 size={11} className="animate-spin" /> : null}
        {rotuloEtapa(etapa)}
        <ChevronDown size={11} className="opacity-70" />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            className={
              'absolute left-0 top-8 z-30 rounded-xl bg-card p-1 shadow-panel ' +
              // Con los motivos a la vista el menú se ensancha: seis chips en 192 px serían seis renglones.
              (confirmaPerdido && pideMotivo ? 'w-72' : 'w-48')
            }
          >
            {etapas.map((e) => (
              <button
                key={e.id}
                type="button"
                role="menuitem"
                onClick={() => elegir(e.id)}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors hover:bg-muted ' +
                  (etapa === e.id ? 'text-foreground' : 'text-muted-foreground')
                }
              >
                <span className={'size-2 shrink-0 rounded-full ' + (PUNTO_ETAPA[e.id] ?? 'bg-muted-foreground')} />
                <span className="flex-1">{e.label}</span>
                {etapa === e.id && <Check size={11} className="text-success" />}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            {confirmaPerdido ? (
              <ConfirmarPerdida
                pideMotivo={pideMotivo}
                motivoInicial={motivoActual}
                onConfirmar={(perdida) => elegir('perdido', perdida)}
                onCancelar={() => setConfirmaPerdido(false)}
              />
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirmaPerdido(true)}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors hover:bg-destructive/10 ' +
                  (etapa === 'perdido' ? 'text-destructive' : 'text-muted-foreground hover:text-destructive')
                }
              >
                <span className="size-2 shrink-0 rounded-full bg-destructive" />
                <span className="flex-1">{rotuloEtapa('perdido')}</span>
                {etapa === 'perdido' && <Check size={11} />}
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

/** El punto de color del menú. Mismo vocabulario que `ETAPA_CHIP`, en sólido. */
const PUNTO_ETAPA: Record<string, string> = {
  interesado: 'bg-primary',
  contactado: 'bg-secondary-foreground',
  cotizado: 'bg-navy',
  cierre: 'bg-success',
  perdido: 'bg-destructive',
};

/**
 * EL BOTÓN PRIMARIO DE LA BARRA — y **se adapta al estado del contacto**.
 *
 * Sin ficha dice `+ Contacto`, que es la acción; con ficha dice el NOMBRE, que
 * es la información. La misma tecla (`R`) y el mismo lugar hacen las dos cosas,
 * porque para la vendedora son una sola: «esta persona, ¿la tengo?».
 *
 * ⚠️ **No confundir con registrar un HECHO** (`RegistrarEvento`, ADR 0037):
 * eso —«preguntó por el diploma»— cae en el timeline y vive al pie del panel
 * derecho. Estuvo acá al lado como chip «Notas» y se llamaba «Registrar» a
 * secas: exactamente la confusión que este botón vino a resolver, y por eso el
 * chip se fue (25-ago-2026) en vez de volver a renombrarse.
 */
function ContactoRegistrado({
  conversacion,
  onAbrirOtra,
  senalAbrir = 0,
  esDeCampana = false,
}: {
  conversacion: Conversacion;
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  /** Señal externa (contador): al cambiar, abre el drawer. La usa el atajo `R`. */
  senalAbrir?: number;
  /**
   * 🔴 **NO decide si la ficha se puede guardar — decide qué le pide al ERP.**
   * `/api/contactos/registro` es CRM genérico y le sirve a los dos módulos desde
   * el 23-ago-2026 (`server/src/modulos/modulo.ts`); lo que sí es de ventas son
   * la ficha de Cerberus y el lead-form con los que el drawer PRELLENA.
   */
  esDeCampana?: boolean;
}) {
  const { data: ficha } = useFichaLocal(conversacion.clave);
  const [abierto, setAbierto] = useState(false);
  const [visto, setVisto] = useState(senalAbrir);

  // La señal se consume en el render, sin `useEffect`: un efecto para esto
  // agrega un frame de retraso justo en el gesto que se quiere instantáneo.
  if (senalAbrir !== visto) {
    setVisto(senalAbrir);
    setAbierto(true);
  }

  const nombre = ficha ? [ficha.nombre, ficha.apellido].filter(Boolean).join(' ').trim() : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={ficha ? nombre || 'Contacto registrado' : 'Registrar contacto'}
        title={ficha ? 'Ver la ficha del contacto (R)' : 'Registrar el contacto (R)'}
        className={claseIconoNeon(ficha ? 'success' : 'gold')}
      >
        {ficha ? <Check size={15} className={CLASE_RELLENO_HOVER} /> : <UserPlus size={15} className={CLASE_RELLENO_HOVER} />}
      </button>
      {abierto && (
        <FichaRapida
          conversacion={conversacion}
          onCerrar={() => setAbierto(false)}
          onAbrirOtra={onAbrirOtra}
          esDeCampana={esDeCampana}
        />
      )}
    </>
  );
}

export function BarraGestion({
  conversacion,
  miVendedora,
  onAbrirOtra,
  esDeCampana,
  senalRegistrar = 0,
  senalEstado = 0,
  senalEtiqueta = 0,
  senalAgendar = 0,
  embebida = false,
}: {
  conversacion: Conversacion;
  /** Quién está mirando — lo necesita el reparto para decir «tú» (`PasarConversacion`). */
  miVendedora?: string | null;
  /** Abrir OTRA conversación: la del contacto que ya estaba registrado. */
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  /**
   * LAS SEÑALES DE LOS ATAJOS. Son contadores, no booleanos: con un booleano,
   * cerrar el popover y volver a apretar la tecla no cambia el valor y no
   * abriría nada.
   */
  senalRegistrar?: number;
  /** Abre el selector de etapa (`SelectorEtapa`). La usa el atajo `E`. */
  senalEstado?: number;
  senalEtiqueta?: number;
  senalAgendar?: number;
  /**
   * ¿De qué módulo de CRM es quien mira? (ADR 0063). Decide si CONTACTO se
   * ofrece (ver `ContactoRegistrado` más abajo).
   */
  esDeCampana?: boolean;
  /**
   * DENTRO DE LA CABECERA DE `HiloWhatsapp` (07-sep-2026, pedido del dueño):
   * el marco y el fondo de tarjeta los pone quien la embebe —ahí ya está
   * puesto el `rounded-2xl bg-card shadow-panel` del panel entero—, así que
   * una segunda tarjeta adentro se vería como una tarjeta dentro de otra.
   * `false` = como siempre: su propia tarjeta, para Messenger y los
   * comentarios de FB/IG, que la siguen usando como fila separada arriba del
   * chat (`ConversacionActiva.tsx`).
   */
  embebida?: boolean;
}) {
  const ETAPAS_BARRA = etapasBarraDe(esDeCampana ? 'campana' : 'ventas');
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** La compuerta guía: ring temporal + foco en el buscador de Intereses. */
  const [guiaIntereses, setGuiaIntereses] = useState(false);
  const [senalIntereses, setSenalIntereses] = useState(0);

  const { data } = useQuery({
    queryKey: ['gestiones', conversacion.clave],
    queryFn: () =>
      api<{ etapa: string | null; perdida?: { motivo: string | null; detalle: string | null } | null }>(
        `/api/gestiones/de/${encodeURIComponent(conversacion.clave)}`,
      ),
  });
  const etapaActual = data?.etapa ?? 'interesado';
  // La pérdida vigente, para corregirla arrancando desde su motivo. Ausente = server viejo (ADR 0007).
  const motivoDeLaPerdida = data?.perdida?.motivo;
  const motivoActual = esMotivoDePerdida(motivoDeLaPerdida) ? motivoDeLaPerdida : null;

  const mover = useMutation({
    mutationFn: ({ etapa, perdida }: { etapa: string; perdida?: PerdidaDeclarada | null }) =>
      api('/api/gestiones', {
        method: 'POST',
        body: JSON.stringify({
          clave: conversacion.clave,
          canal: conversacion.canal,
          personaId: conversacion.persona_id,
          personaNombre: conversacion.persona_nombre,
          numeroPropio: conversacion.numero_propio,
          etapa,
          // Sólo cuando se declaró con motivo (ventas). En campaña no viaja: el server lo rechazaría.
          ...(perdida ? { motivoPerdida: perdida.motivo, detallePerdida: perdida.detalle } : {}),
        }),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['gestiones', conversacion.clave] });
      void qc.invalidateQueries({ queryKey: ['embudo'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err, { etapa: etapaIntentada }) => {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar la etapa.');
      // La compuerta de Cotizado pide un interés: en vez de solo avisar, la
      // barra señala el control que la destraba y le pone el foco.
      if (etapaIntentada === 'cotizado') {
        setSenalIntereses((n) => n + 1);
        setGuiaIntereses(true);
        window.setTimeout(() => setGuiaIntereses(false), 2000);
      }
    },
  });

  return (
    <div className={embebida ? 'min-w-0 flex-1' : 'shrink-0 rounded-2xl bg-card px-3 py-2 shadow-panel'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* LA ETAPA, EN UN DROPDOWN. Era un segmented de cinco botones que se
            llevaba media barra a 1280 y dejaba a las acciones peleando el
            ancho. Como control es igual de directo (se ve en qué etapa está y
            se cambia sin salir del chat) y devuelve ~180 px al resto.

            🔴 Los RÓTULOS salen de `lib/etapas` (ADR 0049) y los colores de
            `ETAPA_CHIP`: acá no se escribe ni un nombre ni una clase de etapa.
            Las compuertas del server siguen frenando y explicando abajo. */}
        <SelectorEtapa
          etapa={etapaActual}
          etapas={ETAPAS_BARRA}
          moviendo={mover.isPending}
          // Otra etapa, o volver a declarar «Dijo que no» con su motivo: así se corrige (ADR 0107).
          onElegir={(e, perdida) => {
            if (etapaActual !== e || (e === 'perdido' && perdida)) mover.mutate({ etapa: e, perdida });
          }}
          senalAbrir={senalEstado}
          pideMotivo={!esDeCampana}
          motivoActual={motivoActual}
        />

        <span className="hidden h-4 w-px bg-border sm:block" />
        <EtiquetasInline clave={conversacion.clave} senalAbrir={senalEtiqueta} />

        {/* 🔴 **EL INTERÉS NO EXISTE EN CAMPAÑA, Y NO ES QUE ESTORBE: ERA UN 403.**
            El buscador autocompleta contra el catálogo de cursos de Cerberus y
            `/api/gestiones/intereses` es superficie de `ventas`, así que del lado
            de campaña las dos mitades fallaban — leer la lista y agregar uno.
            Medido el 23-ago-2026: la tabla `intereses` tiene **0 filas** para la
            línea de la campaña. No se veía como un error: la caja aceptaba el
            texto («apoyar en la campaña», escrito por un operador real) y no
            pasaba nada, que se lee como «no me deja etiquetar».
            Lo que sí tiene campaña para clasificar son las ETIQUETAS, que están
            acá al lado y son CRM genérico. */}
        {!esDeCampana && (
          <>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <Intereses
              clave={conversacion.clave}
              compacto
              resaltado={guiaIntereses}
              senalAbrir={senalIntereses}
              abrirALaDerecha
            />
          </>
        )}

        <span className="ml-auto flex items-center gap-1.5">
          {/* DE QUIÉN ES ESTA CONVERSACIÓN, y cómo pasarla. Va acá y no en el
              menú ▼ de la fila porque no es una marca personal: es una decisión
              del equipo, con rastro de quién la tomó. Se dibuja solo si la línea
              tiene reparto configurado (`PasarConversacion`). */}
          <PasarConversacion conversacion={conversacion} miVendedora={miVendedora} />
          {conversacion.canal === 'whatsapp' && conversacion.persona_id && (
            // `compacto` es el ícono sin texto de #1077 (BarraGestion sin texto en sus
            // botones); `conversacion` es lo que le permite a ESE ícono saber si hay llamada
            // por WhatsApp (ADR 0123, `useLlamable`) y llamar directo en vez de abrir el
            // marcador — ver el docblock de `BotonLlamar.tsx`.
            <BotonLlamar telefono={conversacion.persona_id} conversacion={conversacion} compacto />
          )}
          {/* AGENDAR es una PROMESA a futuro («la llamo mañana 9:00», cae en la
              Agenda); CONTACTO registra a la persona. Ninguno de los dos envía
              nada.

              🔴 **Acá había un tercero, «Notas», y se fue el 25-ago-2026.**
              Anotar un HECHO del pasado («preguntó por gestión pública») ya
              tenía su botón al pie del timeline, en el panel de la derecha, y
              era el MISMO componente abriendo el MISMO popover sobre el MISMO
              contacto: dos puertas para un gesto, una de ellas en la barra que
              ya pelea el ancho a 1280. Pedido del dueño. La tecla `N` y ⌘K
              siguen abriéndolo — el shell despliega el panel si está contraído
              (`App.tsx`), que es lo único que hacía falta para que sacarlo de
              acá no se llevara el atajo puesto. */}
          <AgendarRapido conversacion={conversacion} senalAbrir={senalAgendar} compacto />
          {/* 🔴 **En campaña, CONTACTO se retira por la misma razón que ya se
              fueron «Notas» acá arriba**: era la MISMA acción en dos puertas.
              «Anotar quién es»/«Editar la ficha», al pie del timeline del panel
              derecho (`PieAccionTimeline`), abre el MISMO `FichaRapida` sobre el
              MISMO contacto — pedido del dueño (1-sep-2026). En ventas se queda,
              porque ahí `PieAccionTimeline` no ofrece esa puerta (`conCerberus`
              usa «Vender» en su lugar). */}
          {!esDeCampana && (
            <ContactoRegistrado
              conversacion={conversacion}
              onAbrirOtra={onAbrirOtra}
              senalAbrir={senalRegistrar}
              esDeCampana={esDeCampana}
            />
          )}
        </span>
      </div>

      {error && (
        <div className="mt-1.5 flex items-start justify-between gap-2 rounded-lg bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning-foreground">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
