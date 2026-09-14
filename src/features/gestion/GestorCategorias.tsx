import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { sectionLabel } from '../../lib/styles';
import { useEscape } from '../../lib/teclado/useEscape';
import { useCategorias, useMutacionesCategorias, usePuedeAdministrarCategorias, type Categoria } from './categorias';
import {
  CLASE_BORDE,
  CLASE_FONDO,
  CLASE_TEXTO,
  COLORES,
  NOMBRE_COLOR,
  esColorCategoria,
  normalizarNombre,
  type ColorCategoria,
} from '../../dominio/paletaCategorias';

/**
 * GESTOR DE CATEGORÍAS — la pantalla del `···` › «Etiquetas» (#48, GLOBAL desde
 * el 22-ago-2026).
 *
 * El catálogo de etiquetas con color es compartido por TODO el equipo de un
 * mismo módulo: crear, renombrar, recolorear (de la paleta fija, SIN oro),
 * marcar favorita, reordenar y borrar son acciones del SUPERVISOR — cualquier
 * otra persona ve el mismo catálogo en modo LECTURA, sin los controles de
 * edición (el server ya rechazaría el POST/PATCH/DELETE con 403
 * `no_es_supervisor`; acá se esconden para no ofrecer un botón que solo
 * rebota). `usePuedeAdministrarCategorias()` es la ÚNICA fuente de esa
 * bandera — nunca un rol calculado en el front.
 *
 * La ASIGNACIÓN a la conversación abierta se hace en la barra
 * (`EtiquetasInline`) y esa sigue siendo de CUALQUIERA — acá se administra el
 * catálogo, no quién etiqueta qué. Borrar del catálogo NO borra las
 * asignaciones: quedan neutras hasta re-etiquetar.
 *
 * Regla dura de la casa: la píldora usa BORDE de color, nunca sombra.
 */

/** Los swatches de la paleta fija. Sin oro — el oro es tiempo que se acaba. */
function SelectorColor({
  valor,
  onElegir,
}: {
  valor: ColorCategoria;
  onElegir: (c: ColorCategoria) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir color">
      {COLORES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={NOMBRE_COLOR[c]}
          aria-pressed={valor === c}
          title={NOMBRE_COLOR[c]}
          onClick={() => onElegir(c)}
          className={
            'h-6 w-6 rounded-full transition-transform ' +
            CLASE_FONDO[c] +
            (valor === c
              ? ' scale-110 ring-2 ring-navy ring-offset-2 ring-offset-card'
              : ' hover:scale-110')
          }
        />
      ))}
    </div>
  );
}

/** Una fila del catálogo: la píldora con su color + editar/favorita/reordenar/borrar (solo supervisor). */
function FilaCategoria({
  categoria,
  primera,
  ultima,
  puedeAdministrar,
  onReordenar,
}: {
  categoria: Categoria;
  primera: boolean;
  ultima: boolean;
  /** Solo el supervisor ve los controles de edición — ver el docblock del archivo. */
  puedeAdministrar: boolean;
  onReordenar: (haciaArriba: boolean) => void;
}) {
  const { editar, borrar } = useMutacionesCategorias();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(categoria.nombre);
  const [recolor, setRecolor] = useState(false);
  const color: ColorCategoria = esColorCategoria(categoria.color) ? categoria.color : 'pizarra';

  function guardarNombre() {
    const limpio = normalizarNombre(nombre);
    setEditando(false);
    if (limpio && limpio !== categoria.nombre) editar.mutate({ id: categoria.id, nombre: limpio });
    else setNombre(categoria.nombre);
  }

  // Sin permiso: la píldora se ve, sin botón de color detrás — no hay nada que abrir.
  const pildora = (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[12px] font-semibold ' +
        CLASE_BORDE[color] +
        ' ' +
        CLASE_TEXTO[color]
      }
    >
      <span className={'h-2 w-2 rounded-full ' + CLASE_FONDO[color]} />
      {categoria.nombre}
    </span>
  );

  if (!puedeAdministrar) {
    return (
      <li className="rounded-lg transition-[background-color,box-shadow] hover:bg-card hover:shadow-sm">
        <div className="flex items-center gap-2 px-2.5 py-2">
          {pildora}
          {categoria.conteo > 0 && (
            <span
              title={`${categoria.conteo} conversación(es)`}
              className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              {categoria.conteo}
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    /* `group`: los íconos de acción (lápiz, subir/bajar, borrar) se quedan
       apagados hasta que se pasa el mouse O el foco entra por teclado —
       `group-focus-within` es lo que evita que Tab los deje inalcanzables.
       La favorita NO entra en ese grupo a propósito: es un ESTADO que hay que
       poder leer de un vistazo, no una acción que solo importa al tocarla. */
    <li className="group rounded-lg transition-[background-color,box-shadow] hover:bg-card hover:shadow-sm">
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* La píldora con BORDE de color (nunca sombra, nunca oro). */}
        <button
          type="button"
          title="Cambiar color"
          aria-label={`Color de ${categoria.nombre}: ${NOMBRE_COLOR[color]}`}
          onClick={() => setRecolor((v) => !v)}
          className={
            'inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[12px] font-semibold ' +
            CLASE_BORDE[color] +
            ' ' +
            CLASE_TEXTO[color]
          }
        >
          <span className={'h-2 w-2 rounded-full ' + CLASE_FONDO[color]} />
          {editando ? '' : categoria.nombre}
        </button>

        {editando && (
          <input
            value={nombre}
            autoFocus
            maxLength={30}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarNombre();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setNombre(categoria.nombre);
                setEditando(false);
              }
            }}
            onBlur={guardarNombre}
            className="w-32 rounded-md border border-primary bg-card px-1.5 py-0.5 text-[12px] outline-none"
          />
        )}

        <span className="ml-auto flex items-center gap-0.5">
          {/* Conteo: cuántas conversaciones lleva hoy (para el modo Listas, #49). */}
          {categoria.conteo > 0 && (
            <span
              title={`${categoria.conteo} conversación(es)`}
              className="mr-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              {categoria.conteo}
            </span>
          )}
          {/* Siempre a la vista: es lo que decide el orden (favoritas primero),
              y esconderla detrás de un hover sería esconder por qué el catálogo
              está ordenado como está. */}
          <button
            type="button"
            aria-label={categoria.esFavorito ? 'Quitar de favoritas' : 'Marcar favorita'}
            aria-pressed={categoria.esFavorito}
            title={categoria.esFavorito ? 'Favorita' : 'Marcar favorita'}
            onClick={() => editar.mutate({ id: categoria.id, esFavorito: !categoria.esFavorito })}
            className={
              // El oro es SOLO tiempo que se acaba: la favorita se marca en navy, no en dorado.
              'rounded-md p-1 transition-colors ' +
              (categoria.esFavorito ? 'text-navy-ink' : 'text-muted-foreground/50 hover:text-foreground')
            }
          >
            <Star size={14} fill={categoria.esFavorito ? 'currentColor' : 'none'} />
          </button>

          {/* El resto SÍ se apaga sin hover/foco: son acciones, no estados. */}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {!editando && (
              <button
                type="button"
                aria-label={`Renombrar ${categoria.nombre}`}
                title="Renombrar"
                onClick={() => {
                  setNombre(categoria.nombre);
                  setEditando(true);
                }}
                className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              type="button"
              aria-label="Subir"
              disabled={primera}
              onClick={() => onReordenar(true)}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              aria-label="Bajar"
              disabled={ultima}
              onClick={() => onReordenar(false)}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              aria-label={`Borrar ${categoria.nombre}`}
              title="Borrar del catálogo (las asignaciones quedan)"
              onClick={() => borrar.mutate(categoria.id)}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
            >
              {borrar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </span>
        </span>
      </div>

      {recolor && (
        <div className="px-2.5 pb-2">
          <SelectorColor
            valor={color}
            onElegir={(c) => {
              editar.mutate({ id: categoria.id, color: c });
              setRecolor(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

export function GestorCategorias({ onCerrar }: { onCerrar: () => void }) {
  const { data: categorias = [], isLoading, isError, refetch } = useCategorias();
  const { data: puedeAdministrar = false } = usePuedeAdministrarCategorias();
  const { crear, editar } = useMutacionesCategorias();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<ColorCategoria>('azul');
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape cierra el gestor (el chat de atrás no lo intercepta: capture + stop).
  // Era una copia a mano a la que le faltaba la guarda de campos, y eso rompía
  // el renombrar: el listener de window va en captura y le gana al `onKeyDown`
  // del input (React delega en burbuja), así que Escape mientras se editaba el
  // nombre de una etiqueta cerraba el modal entero y se llevaba lo tipeado.
  useEscape(onCerrar);

  function crearNueva() {
    const limpio = normalizarNombre(nombre);
    if (!limpio) return;
    crear.mutate({ nombre: limpio, color }, { onSuccess: () => {
      setNombre('');
      inputRef.current?.focus();
    } });
  }

  /** Reordenar renumerando 0..N-1: deja el orden siempre limpio, sin colisiones. */
  function reordenar(indice: number, haciaArriba: boolean) {
    const destino = haciaArriba ? indice - 1 : indice + 1;
    if (destino < 0 || destino >= categorias.length) return;
    const arr = [...categorias];
    const [item] = arr.splice(indice, 1);
    arr.splice(destino, 0, item);
    arr.forEach((c, i) => {
      if (c.orden !== i) editar.mutate({ id: c.id, orden: i });
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-navy/25 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Etiquetas"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 font-heading text-sm font-bold text-navy-ink">
            <Tag size={15} /> Etiquetas
          </span>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <ul className="space-y-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
              ))}
            </ul>
          ) : isError ? (
            <div className="rounded-xl bg-warning/10 px-3 py-3 text-[12px] font-medium text-warning-foreground">
              No se pudieron cargar las categorías.
              <button type="button" onClick={() => refetch()} className="ml-2 font-bold underline">
                Reintentar
              </button>
            </div>
          ) : categorias.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted-foreground">
              {puedeAdministrar ? 'Todavía no hay categorías. Crea la primera abajo.' : 'Todavía no hay categorías.'}
            </p>
          ) : (
            // El lienzo (mismo `bg-muted` que la lista de los selectores): las
            // filas ya no llevan su propio borde, así que sin este fondo se
            // verían sueltas, cada una flotando en el blanco de la tarjeta.
            <ul className="space-y-0.5 rounded-lg bg-muted/70 p-1">
              {categorias.map((c, i) => (
                <FilaCategoria
                  key={c.id}
                  categoria={c}
                  primera={i === 0}
                  ultima={i === categorias.length - 1}
                  puedeAdministrar={puedeAdministrar}
                  onReordenar={(haciaArriba) => reordenar(i, haciaArriba)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Nueva categoría: nombre + color de la paleta, en un gesto — SOLO supervisor.
            Sin permiso, el gestor queda de solo lectura: la asignación (etiquetar
            una conversación) sigue siendo de cualquiera desde la barra del chat. */}
        {puedeAdministrar ? (
          <div className="border-t border-border p-4">
          <div className={sectionLabel}>Nueva categoría</div>
          <div className="mt-2 flex items-center gap-2">
            {/* Misma píldora con ícono que el buscador de los selectores de
                línea/categorías — una sola familia visual entre elegir y administrar. */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 focus-within:border-primary">
              <Tag size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                value={nombre}
                maxLength={30}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') crearNueva();
                }}
                placeholder="nombre de la nueva categoría…"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={crearNueva}
              disabled={!normalizarNombre(nombre) || crear.isPending}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {crear.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Crear
            </button>
          </div>
          <div className="mt-2.5">
            <SelectorColor valor={color} onElegir={setColor} />
          </div>
          {crear.isError && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
              No se creó — ¿ya existe una con ese nombre? Prueba otro.
            </p>
          )}
          {crear.isSuccess && !crear.isError && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-success">
              <Check size={11} /> Lista para asignar desde el chat.
            </p>
          )}
          </div>
        ) : (
          <p className="border-t border-border px-4 py-3 text-center text-[11px] text-muted-foreground">
            Este catálogo lo administra un supervisor. Igual puedes etiquetar conversaciones desde el chat.
          </p>
        )}
      </div>
    </div>
  );
}
