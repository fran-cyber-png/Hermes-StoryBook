import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Tag, UserPlus, X } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { usePopover } from '../../lib/teclado/usePopover';
import { ETAPA_CHIP, etapasDeclarablesDe, rotuloEtapa } from '../../lib/etapas';
import type { Conversacion } from '../../dominio/conversaciones';
import { AgendarRapido } from '../agenda/AgendarRapido';
import { FichaRapida } from '../panel/FichaRapida';
import { useFichaLocal } from '../panel/fichaLocal';
import { PasarConversacion } from '../reparto/PasarConversacion';
import { BotonLlamar } from './BotonLlamar';
import { Intereses } from './Intereses';
import { MenuHerramientas } from './MenuHerramientas';
import { useCategorias, useEtiquetasDe, useMutacionesCategorias, usePuedeAdministrarCategorias } from './categorias';
import {
  CLASE_FONDO,
  CLASE_TEXTO,
  COLORES,
  NOMBRE_COLOR,
  claseBorde,
  normalizarNombre,
  resolverColor,
  type ColorCategoria,
} from '../../dominio/paletaCategorias';

/**
 * LA BARRA DE GESTIÓN — el embudo entero manejable DESDE el chat.
 *
 * Vive arriba de toda conversación abierta (WhatsApp, comentario, Messenger):
 * la ETAPA se cambia con un clic (las compuertas del server frenan y explican
 * acá mismo — y la barra señala DÓNDE destrabarla), las ETIQUETAS y los CURSOS
 * DE INTERÉS se agregan inline, y AGENDAR es un popover de dos toques. Perdido
 * vive aparte del segmented y pide confirmación: no es una etapa más, es tirar
 * la toalla.
 */

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
 * Etiquetas inline: las CATEGORÍAS (con color) asignadas a esta conversación.
 *
 * La ASIGNACIÓN sigue contra el endpoint compartido del equipo
 * (`/api/gestiones/etiquetas`, por string) — CUALQUIERA etiqueta, eso no
 * cambió. El COLOR se resuelve en el front contra el catálogo del módulo
 * (`/api/categorias`) — una etiqueta que matchea una categoría toma su color;
 * la que no, se pinta neutra.
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
 * mismo patrón que `GestorCategorias.tsx`.
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
  const [nuevo, setNuevo] = useState('');
  const [colorNuevo, setColorNuevo] = useState<ColorCategoria>('azul');
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
  const disponibles = categorias.filter((c) => !asignadas.has(c.nombre));

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
      <Tag size={11} className="shrink-0 text-muted-foreground" />
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
        className={
          'rounded-full border border-dashed px-1.5 py-0.5 text-[11px] transition-colors ' +
          (abierto
            ? 'border-primary text-foreground'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
        }
      >
        +
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute left-4 top-6 z-30 w-56 rounded-xl bg-card p-2 shadow-panel">
            {disponibles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {disponibles.map((c) => {
                  const color = resolverColor(c.nombre, categorias);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        asignar.mutate(c.nombre);
                        setAbierto(false);
                      }}
                      className={
                        'inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-105 ' +
                        claseBorde(color) +
                        (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
                      }
                    >
                      {color && <span className={'h-1.5 w-1.5 rounded-full ' + CLASE_FONDO[color]} />}
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Crear una categoría nueva es SOLO del supervisor — cualquiera
                sigue pudiendo elegir de las de arriba (`disponibles`). */}
            {puedeAdministrar ? (
              <div className="rounded-lg border border-border p-1.5">
                <div className="flex items-center gap-1">
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
                    autoFocus
                    placeholder="nueva categoría…"
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label="Crear y asignar"
                    onClick={crearYAsignar}
                    disabled={!normalizarNombre(nuevo) || crear.isPending}
                    className="flex items-center rounded-md bg-primary p-1 text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
                  >
                    {crear.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Elegir color">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={NOMBRE_COLOR[c]}
                      aria-pressed={colorNuevo === c}
                      title={NOMBRE_COLOR[c]}
                      onClick={() => setColorNuevo(c)}
                      className={
                        'h-4 w-4 rounded-full transition-transform ' +
                        CLASE_FONDO[c] +
                        (colorNuevo === c ? ' scale-110 ring-2 ring-navy ring-offset-1 ring-offset-card' : ' hover:scale-110')
                      }
                    />
                  ))}
                </div>
              </div>
            ) : (
              disponibles.length === 0 && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Todavía no hay categorías para asignar. Pídele al supervisor que arme el catálogo.
                </p>
              )
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
  onElegir: (etapa: string) => void;
  /** Señal externa (contador): al cambiar, abre el menú. La usa el atajo `E`. */
  senalAbrir?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmaPerdido, setConfirmaPerdido] = useState(false);
  const [visto, setVisto] = useState(senalAbrir);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  if (senalAbrir !== visto) {
    setVisto(senalAbrir);
    setAbierto(true);
  }

  function elegir(id: string) {
    onElegir(id);
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
          <div role="menu" className="absolute left-0 top-8 z-30 w-48 rounded-xl bg-card p-1 shadow-panel">
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
              <div className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold">
                <span className="flex-1 text-muted-foreground">¿{rotuloEtapa('perdido')}?</span>
                <button
                  type="button"
                  onClick={() => elegir('perdido')}
                  className="rounded px-1.5 text-destructive transition-colors hover:bg-destructive/10"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmaPerdido(false)}
                  className="rounded px-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  No
                </button>
              </div>
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
        title={ficha ? 'Ver la ficha del contacto (R)' : 'Registrar el contacto (R)'}
        className={
          'flex max-w-[13rem] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm transition-all duration-200 ' +
          (ficha
            ? 'bg-success/10 text-success hover:bg-success/15'
            : 'bg-primary text-primary-foreground hover:shadow-[0_0_12px_rgba(37,99,235,0.6)] hover:brightness-110')
        }
      >
        {ficha ? <Check size={11} className="shrink-0" /> : <UserPlus size={11} className="shrink-0" />}
        <span className="truncate">{ficha ? nombre || 'Registrado' : 'Contacto'}</span>
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
}: {
  conversacion: Conversacion;
  /** Quién está mirando — lo necesita el reparto para decir «tú» (`PasarConversacion`). */
  miVendedora?: string | null;
  /** Abrir OTRA conversación: la del contacto que ya estaba registrado. */
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  /**
   * LAS SEÑALES DE LOS ATAJOS. Son contadores, no booleanos: con un booleano,
   * cerrar el popover y volver a apretar la tecla no cambia el valor y no
   * abriría nada. Es el mismo patrón que ya usaba `Intereses.senalAbrir`.
   */
  senalRegistrar?: number;
  senalEstado?: number;
  senalEtiqueta?: number;
  senalAgendar?: number;
  /**
   * ¿De qué módulo de CRM es quien mira? (ADR 0063). Decide DOS cosas:
   *
   * · **Qué peldaños se ofrecen**: con los de ventas clavados, un operador de
   *   campaña podía declarar «Sabe el precio» y su tablero lo devolvía a
   *   «Contestaron», mudo.
   * · **Qué herramientas trae el `···`** (24-ago-2026): «Datos recomendados» es
   *   el playbook de la Escuela y su ruta ya contesta 403 para campaña.
   */
  esDeCampana?: boolean;
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
      api<{ etapa: string | null }>(`/api/gestiones/de/${encodeURIComponent(conversacion.clave)}`),
  });
  const etapaActual = data?.etapa ?? 'interesado';

  const mover = useMutation({
    mutationFn: (etapa: string) =>
      api('/api/gestiones', {
        method: 'POST',
        body: JSON.stringify({
          clave: conversacion.clave,
          canal: conversacion.canal,
          personaId: conversacion.persona_id,
          personaNombre: conversacion.persona_nombre,
          numeroPropio: conversacion.numero_propio,
          etapa,
        }),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['gestiones', conversacion.clave] });
      void qc.invalidateQueries({ queryKey: ['embudo'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err, etapaIntentada) => {
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
    <div className="shrink-0 rounded-2xl bg-card px-3 py-2 shadow-panel">
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
          onElegir={(e) => etapaActual !== e && mover.mutate(e)}
          senalAbrir={senalEstado}
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
            <BotonLlamar telefono={conversacion.persona_id} />
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
          <AgendarRapido conversacion={conversacion} senalAbrir={senalAgendar} />
          <ContactoRegistrado
            conversacion={conversacion}
            onAbrirOtra={onAbrirOtra}
            senalAbrir={senalRegistrar}
            esDeCampana={esDeCampana}
          />
          <MenuHerramientas conversacion={conversacion} esDeCampana={esDeCampana} />
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
