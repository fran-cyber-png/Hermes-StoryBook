import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CircleQuestionMark,
  Clock,
  Ellipsis,
  HandHeart,
  LifeBuoy,
  Loader2,
  MapPin,
  MessageCircle,
  NotebookPen,
  NotebookText,
  PhoneCall,
  Plus,
  ShieldAlert,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { usePopover } from '../../lib/teclado/usePopover';
import {
  CATALOGO_EVENTOS,
  TOPE_NOTA,
  tiposDeEventos,
  motivoParaNoRegistrar,
  useMutacionesEventos,
  useNotasRecientes,
  type TipoEvento,
} from './eventos';

/** El ícono de cada tipo — decoración del front, no vive en el catálogo compartido con el server. */
/**
 * ⚠️ **`Record` sobre `TipoEvento`, así que un tipo nuevo sin ícono NO COMPILA.**
 * Es la misma guarda que `CATALOGO_EVENTOS`: sin ella, el tipo se agrega, el
 * botón se dibuja con `undefined` como componente y React tira en runtime — un
 * fallo de deploy por olvidarse de una línea.
 */
const ICONO_TIPO: Record<TipoEvento, LucideIcon> = {
  pregunto_curso: CircleQuestionMark,
  pidio_precio: Tag,
  objecion: ShieldAlert,
  quiere_apoyar: HandHeart,
  pidio_ayuda: LifeBuoy,
  problema_zona: MapPin,
  se_comprometio: Check,
  quedamos_en: MessageCircle,
  llamada: PhoneCall,
  nota: NotebookText,
  otro: Ellipsis,
};

/**
 * «RECIENTES» — las últimas notas de tipo `otro` que ESTA vendedora ya
 * escribió, en cualquier conversación, para reusar sin retipear (pedido del
 * 20-ago-2026). Flyout aparte porque no es un tipo más: elegir una nota acá
 * no pregunta qué pasó, ya lo sabe — completa `tipo` y `nota` de un toque.
 */
function BotonRecientes({ onElegir }: { onElegir: (nota: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const { data: notas, isLoading } = useNotasRecientes('otro', abierto);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-30' });

  return (
    <span className="flex-1">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={
          'flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ' +
          (abierto
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border text-foreground hover:bg-muted')
        }
      >
        <Clock size={13} className="shrink-0" />
        Recientes
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          {/* `right-0` cuelga del contenedor de la FILA (`relative`, en
              `RegistrarEvento`), no de este botón — con la fila entera como
              referencia el flyout nunca se sale por la izquierda del panel.
              `bottom-full` lo abre hacia ARRIBA, no hacia abajo: este botón
              vive al PIE del timeline, así que abajo casi no queda alto.
              ⚠️ **Los dos ejes importan porque este popover vive DENTRO del
              `overflow-y-auto` del timeline, adentro de un panel de alto
              fijo.** Un `right-full` sobre un botón angosto lo manda a X
              negativo, y `top-full` acá lo manda por debajo del borde del
              panel — las dos formas de salirse las recorta un ancestro con
              overflow **sin avisar**: no hay error, el flyout simplemente no
              se ve. Se vio recién con Playwright — el DOM decía
              `aria-expanded="true"` y en pantalla no había nada. */}
          <div className="absolute right-0 bottom-full z-30 mb-1 w-56 rounded-xl bg-card p-1.5 shadow-panel">
            {isLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : !notas || notas.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">
                Todavía no anotaste nada en «Otro».
              </p>
            ) : (
              notas.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onElegir(n);
                    setAbierto(false);
                  }}
                  title={n}
                  className="line-clamp-2 block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  {n}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </span>
  );
}

/**
 * «NOTAS RÁPIDAS» — el catálogo de tipos, en un flyout aparte.
 *
 * Hasta el 27-ago-2026 esta lista abría directo al tocar «Registrar algo del
 * contacto», antes que cualquier otra cosa: para anotar una frase libre había
 * que elegir un tipo primero. El pedido del dueño invirtió el orden — el
 * input libre es lo primero que se ve, y esto pasa a ser un atajo aparte, con
 * la MISMA forma que `BotonRecientes` (flyout a la izquierda, mismo
 * `usePopover`) porque las dos son variantes del mismo gesto: elegir de una
 * lista sin retipear.
 */
function BotonNotasRapidas({
  tipo,
  esDeCampana,
  onElegir,
}: {
  tipo: TipoEvento;
  esDeCampana?: boolean;
  onElegir: (t: TipoEvento) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-30' });

  return (
    <span className="flex-1">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={
          'flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ' +
          (abierto
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border text-foreground hover:bg-muted')
        }
      >
        <NotebookText size={13} className="shrink-0" />
        Notas rápidas
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          {/* `right-0` cuelga de la FILA (`relative`, en `RegistrarEvento`),
              no de este botón — ver el comentario gemelo en `BotonRecientes`:
              anclar al botón angosto lo manda a X negativo, y el
              `overflow-y-auto` del timeline lo recorta sin avisar. */}
          <div
            className="absolute right-0 bottom-full z-30 mb-1 w-56 rounded-xl bg-card p-1.5 shadow-panel"
            role="group"
            aria-label="Qué pasó"
          >
            {tiposDeEventos(esDeCampana).map((t) => {
              const Icono = ICONO_TIPO[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => {
                    onElegir(t);
                    setAbierto(false);
                  }}
                  className={
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium transition-colors ' +
                    (tipo === t ? 'bg-navy text-white' : 'text-foreground hover:bg-muted')
                  }
                >
                  <Icono size={14} className={'shrink-0 ' + (tipo === t ? 'text-white' : 'text-primary')} />
                  {CATALOGO_EVENTOS[t].rotulo}
                </button>
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

/**
 * REGISTRAR UN EVENTO DEL CONTACTO — la puerta al timeline.
 *
 * **Una sola puerta, al pie del timeline en el panel derecho.** Hasta el
 * 25-ago-2026 el mismo componente se montaba además como chip «Notas» en la
 * barra del chat, y las dos entradas abrían el MISMO popover sobre el MISMO
 * contacto: dos botones para un gesto, uno de ellos en la barra que ya pelea el
 * ancho a 1280. El dueño pidió sacar el de la barra, y se sacó la variante
 * entera y no sólo su render — un `variante` que nadie pasa es la clase de
 * huérfano que este repo ya pagó tres veces.
 *
 * Sigue siendo el lugar donde se LEE la historia, que es donde se contesta
 * «¿pasó algo más?». El atajo `N` y ⌘K lo abren desde el shell (`senalAbrir`),
 * y si el panel está contraído el shell lo despliega antes — sin eso la tecla
 * apuntaría a un componente desmontado.
 *
 * La forma es la de `AgendarRapido`: botón → popover de dos toques, cierre con
 * Escape y clic afuera vía `usePopover` (sin esto, el Escape se lo lleva el
 * shell y cierra la conversación de atrás — el agujero que ya se tapó en las
 * etiquetas y en agendar).
 *
 * ⚠️ **Esto no manda nada.** Es memoria del equipo, no un mensaje. El botón
 * dice «Registrar» y el pie del popover lo aclara, por la misma razón por la
 * que el de repartir contactos lo aclara: el gesto se parece a uno que sí
 * envía.
 */

/** El buscador de curso, contra el catálogo VIVO de Cerberus. */
function BuscadorDeCurso({
  valor,
  onElegir,
  onEscape,
}: {
  valor: { curso: string; productoId: string | null } | null;
  onElegir: (v: { curso: string; productoId: string | null } | null) => void;
  /**
   * ⚠️ **Esto no es opcional.** Con el foco en este input, `usePopover` no ve el
   * Escape: lo atrapa el `onKeyDown` de acá. Si solo se hiciera
   * `stopPropagation()` —que hay que hacerlo, o el shell cierra la conversación
   * de atrás—, la tecla quedaría comida y el popover no se cerraría con nada.
   * Se detectó capturando la evidencia, no en un test: el Escape se veía
   * «manejado» y no cerraba.
   */
  onEscape: () => void;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  // El MISMO endpoint que usa `Intereses` (`/api/venta/productos`): el curso
  // que se registra acá es el que después se cotiza, así que tiene que salir
  // del catálogo real y no de una lista nuestra que envejece.
  const sugerencias = useQuery({
    queryKey: ['productos', q],
    queryFn: () =>
      api<{ productos: { id: string; nombre: string }[] }>(
        `/api/venta/productos?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.trim().length >= 2,
    select: (d) => d.productos.slice(0, 5),
  });
  const sugs = sugerencias.data ?? [];

  if (valor) {
    return (
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-secondary-foreground">
          {valor.curso}
        </span>
        {/* Sin `producto_id` el interés queda sin precio: se dice, no se esconde. */}
        {!valor.productoId && (
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">sin precio</span>
        )}
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="shrink-0 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-2">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && sugs.length > 0) {
            e.preventDefault();
            setIdx((i) => (i + 1) % sugs.length);
          }
          if (e.key === 'ArrowUp' && sugs.length > 0) {
            e.preventDefault();
            setIdx((i) => (i - 1 + sugs.length) % sugs.length);
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            // Con resultados a la vista, Enter toma el resaltado; el texto
            // libre solo cuando Cerberus no devolvió nada (el curso todavía no
            // existe en el catálogo). Misma regla que `Intereses`.
            if (sugs.length > 0) {
              const p = sugs[Math.min(idx, sugs.length - 1)];
              onElegir({ curso: p.nombre, productoId: p.id });
            } else if (q.trim().length >= 3) {
              onElegir({ curso: q.trim(), productoId: null });
            }
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            onEscape();
          }
        }}
        autoFocus
        placeholder="Busca el curso…"
        className="w-full rounded-lg border border-primary bg-card px-2 py-1.5 text-[11px] outline-none"
      />
      {sugs.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-card shadow-panel">
          {sugs.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onElegir({ curso: p.nombre, productoId: p.id })}
              onMouseEnter={() => setIdx(i)}
              title={p.nombre}
              className={
                'block w-full truncate px-2 py-1.5 text-left text-[11px] transition-colors ' +
                (i === idx ? 'bg-secondary' : 'hover:bg-secondary')
              }
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegistrarEvento({
  clave,
  senalAbrir = 0,
  esDeCampana = false,
  rotuloBoton = 'Registrar algo del contacto',
}: {
  clave: string;
  /** Señal externa (contador): al cambiar, abre el popover. La usa el atajo `N`. */
  senalAbrir?: number;
  /**
   * #887 — EL MISMO CONTROL, DOS LUGARES, UN SOLO RÓTULO. Con «Registrar
   * actividad» en Resumen y «Registrar algo del contacto» acá abajo, la
   * vendedora podía leer las dos cosas como controles distintos. El default
   * es el texto de siempre — sólo cambia para quien pide otro.
   */
  rotuloBoton?: string;
  /**
   * De qué módulo es quien mira — decide QUÉ TIPOS SE OFRECEN, nunca cuáles se
   * pueden leer. Un evento ya registrado con el vocabulario del otro módulo se
   * sigue dibujando con su rótulo (`rotuloDeTipo`).
   *
   * ⚠️ **Default `false` a propósito**: los llamadores que no lo pasan ven el
   * vocabulario de la Escuela, que es lo de siempre. La ausencia degrada hacia
   * atrás, igual que `esDeCampana` en el resto del árbol.
   */
  esDeCampana?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  /**
   * ⚠️ **Arranca en `'otro'`, no en `null`.** El input libre es lo primero
   * que se ve al abrir (pedido del dueño, 27-ago-2026): sin un tipo por
   * defecto, `def` sería `null` y el input no tendría dónde colgarse. Elegir
   * un tipo del flyout «Notas rápidas» lo reemplaza; nunca lo vacía — no hay
   * estado «sin elegir» que esconder el input.
   */
  const [tipo, setTipo] = useState<TipoEvento>('otro');
  const [curso, setCurso] = useState<{ curso: string; productoId: string | null } | null>(null);
  const [nota, setNota] = useState('');
  /** Qué quedó registrado — el botón lo confirma hasta el próximo gesto. */
  const [listo, setListo] = useState<string | null>(null);
  const [visto, setVisto] = useState(senalAbrir);
  const notaRef = useRef<HTMLInputElement>(null);

  const { registrar } = useMutacionesEventos(clave);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  /**
   * 🔴 `useLayoutEffect`, NO EL PATRÓN «SE CONSUME EN EL RENDER» QUE HABÍA
   * ACÁ (hasta 09-sep-2026: `if (senalAbrir !== visto) { ...; setAbierto(true) }`
   * suelto en el cuerpo de la función, sin efecto).
   *
   * Esa forma —llamar a `setState` derecho en el render, para que abrir sea
   * instantáneo— es un patrón que React documenta y permite, pero en este
   * componente resultaba en una carrera de verdad: reproducido en local
   * (Vitest + jsdom, 1 de cada 5 a 7 corridas) haciendo clic en «Registrar
   * actividad» desde Resumen —el gesto sube DOS señales del padre en un
   * mismo evento (cambia de sección Y el contador `senalAbrir`)—, el estado
   * llegaba a `abierto: true` en un render y a `abierto: false` en el
   * siguiente, sin que ningún otro `setAbierto` de este archivo se hubiera
   * llamado (instrumentado uno por uno). Cambiarlo a `useLayoutEffect` —que
   * corre sincrónico después de la mutación del DOM y ANTES de que el
   * navegador pinte, así que no hay el frame de parpadeo que sí tendría un
   * `useEffect` normal— lo dejó estable: 25/25 corridas en verde, cero fallas.
   */
  useLayoutEffect(() => {
    if (senalAbrir !== visto) {
      setVisto(senalAbrir);
      setListo(null);
      setAbierto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senalAbrir]);

  // Cambió la conversación: el popover no puede sobrevivir abierto apuntando a
  // la de antes (mismo cuidado que `MenuHerramientas`, que no se re-keyea).
  useEffect(() => {
    setAbierto(false);
    setListo(null);
    limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  function limpiar() {
    setTipo('otro');
    setCurso(null);
    setNota('');
  }

  const def = CATALOGO_EVENTOS[tipo];
  // El botón y el submit consultan LA MISMA función: separadas divergen, y la
  // que se saltea la regla reporta «se rompió algo» en vez de decir qué falta.
  const motivo = motivoParaNoRegistrar({ tipo, curso: curso?.curso ?? '', nota });

  function guardar() {
    if (motivo) return;
    registrar.mutate(
      {
        tipo,
        curso: curso?.curso ?? null,
        productoId: curso?.productoId ?? null,
        nota: nota.trim() || null,
      },
      {
        onSuccess: (r) => {
          setListo(CATALOGO_EVENTOS[tipo].rotulo);
          setAbierto(false);
          limpiar();
          // El acuse cuenta si además quedó el interés — y si quedó sin precio.
          if (r.interesAsentado && r.motivoInteres) {
            setListo(`${CATALOGO_EVENTOS[tipo].rotulo} · interés sin precio`);
          }
        },
      },
    );
  }

  return (
    <span className="relative block">
      <button
        type="button"
        onClick={() => {
          setListo(null);
          setAbierto((v) => !v);
        }}
        /* La tecla del `title` es la que el shell escucha (`App.tsx`), y decía
           `(E)` — que es la de la ETAPA. Nadie lo vio porque el chip vivía al
           lado del selector de etapa, así que la letra equivocada quedaba
           «cerca de algo que sí hace eso». */
        title="Anotar algo en el timeline del contacto (N)"
        className={
          'flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed py-2 text-xs font-bold ' +
          'transition-[background-color,border-color,transform] duration-200 ease-house active:scale-[0.99] ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          (abierto
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border text-primary hover:border-primary hover:bg-primary/5')
        }
      >
        {listo ? <Check size={13} className="text-success" /> : <Plus size={13} />}
        {listo ? `Registrado · ${listo}` : rotuloBoton}
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl bg-card p-2.5 shadow-panel"
          >
            {/* ══ EL INPUT LIBRE, PRIMERO ═══════════════════════════════════
                Pedido del dueño (27-ago-2026): antes había que elegir un tipo
                del catálogo para que apareciera dónde escribir. Ahora el
                gesto de dos toques es «escribe → Registrar», y el catálogo
                («Notas rápidas») y las notas reusables («Recientes») quedan
                de atajos, no de paso obligado. */}
            {def.pideCurso && (
              <BuscadorDeCurso valor={curso} onElegir={setCurso} onEscape={() => setAbierto(false)} />
            )}

            <input
              ref={notaRef}
              value={nota}
              maxLength={TOPE_NOTA}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  guardar();
                }
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setAbierto(false);
                }
              }}
              autoFocus
              placeholder={def.ejemplo}
              className="mb-2 w-full rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11px] outline-none focus:border-primary"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={Boolean(motivo) || registrar.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-primary-foreground transition-[background-color,transform] duration-200 ease-house hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
              >
                {registrar.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <NotebookPen size={11} />
                )}
                Registrar
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
            </div>

            {/* El motivo se DICE. Un botón gris que no explica por qué está
                gris es un botón roto — y acá el motivo casi siempre es una
                cosa chiquita («falta el curso»). */}
            {motivo && <p className="mt-1.5 text-[11px] text-muted-foreground">{motivo}</p>}

            {registrar.isError && (
              <p className="mt-1.5 text-[11px] text-destructive">
                {registrar.error instanceof ErrorApi
                  ? registrar.error.message
                  : 'No se registró — prueba de nuevo.'}
              </p>
            )}

            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Queda en el timeline, firmado con tu nombre. No se envía nada.
              {def.pideCurso && ' También queda como interés (destraba Cotizado).'}
            </p>

            {/* ══ LOS DOS ATAJOS, DEBAJO ════════════════════════════════════
                «Notas rápidas» a la izquierda —el catálogo de tipos, que
                antes era lo primero que se veía—, «Recientes» a la derecha
                —las últimas notas libres de esta vendedora—. Los dos abren su
                lista hacia la izquierda y hacia arriba, colgando de ESTA fila
                (`relative`) y no de cada botón: los dos son más angostos que
                su propio flyout, y un flyout más ancho que su ancla se sale
                para el lado que sea que abra. Colgado de la fila entera —que
                ocupa todo el panel— el flyout no cruza el borde izquierdo;
                hacia arriba porque este botón vive al PIE del timeline, y
                abajo casi no queda alto contra el borde del panel. */}
            <div className="relative mt-2 flex items-center gap-2">
              <BotonNotasRapidas
                tipo={tipo}
                esDeCampana={esDeCampana}
                onElegir={(t) => {
                  setTipo(t);
                  setCurso(null);
                  window.setTimeout(() => notaRef.current?.focus(), 0);
                }}
              />
              <BotonRecientes
                onElegir={(n) => {
                  setTipo('otro');
                  setCurso(null);
                  setNota(n);
                  window.setTimeout(() => notaRef.current?.focus(), 0);
                }}
              />
            </div>
          </div>
        </>
      )}
    </span>
  );
}
