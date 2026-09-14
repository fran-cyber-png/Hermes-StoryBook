import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  MoreHorizontal,
  MoveDown,
  MoveRight,
  MoveUp,
  Pencil,
  Plus,
  Trash2,
  Unlock,
} from 'lucide-react';
import { MiniaturaDeCapa } from './MiniaturaDeCapa';
import type { Capa } from './capas';
import { figurasDe } from './capas';
import type { Figura, Reordenamiento } from './figuras';

/**
 * EL PANEL DE CAPAS — qué hay en cada una, cuál está activa, qué se ve.
 *
 * ══ LA LISTA VA AL REVÉS QUE EL ARRAY ═══════════════════════════════════════
 *
 * 🔴 Arriba se muestra la capa que se pinta ENCIMA. Es la convención de todo
 * editor gráfico y la que hace que arrastrar «hacia arriba» signifique «adelante».
 * En `capas.ts` el índice 0 es el fondo, así que la vuelta se da acá y en un solo
 * lugar: `alReves`. Con la inversión repartida, arrastrar movería la capa al
 * lado contrario del que se soltó y nadie sabría por qué.
 *
 * ══ DOS EJES DISTINTOS Y CONVIENE NO MEZCLARLOS ═════════════════════════════
 *
 * El ORDEN DE LAS CAPAS (arrastrando la tarjeta) decide qué capa tapa a cuál.
 * El ORDEN DE LOS OBJETOS (las acciones rápidas de abajo) decide qué figura tapa
 * a cuál **dentro** de su capa. Mezclarlos —«mandar a la capa de arriba»— es la
 * fuente clásica de confusión: un objeto puede estar en la capa de arriba y aun
 * así quedar tapado por otro de su misma capa.
 */

const ORDENES: { id: Reordenamiento; rotulo: string; Icono: typeof ArrowUp }[] = [
  { id: 'frente', rotulo: 'Traer al frente', Icono: ChevronsUp },
  { id: 'subir', rotulo: 'Subir una posición', Icono: ArrowUp },
  { id: 'bajar', rotulo: 'Bajar una posición', Icono: ArrowDown },
  { id: 'fondo', rotulo: 'Enviar al fondo', Icono: ChevronsDown },
];

function Icono({
  rotulo,
  onClick,
  activo,
  deshabilitado,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  activo?: boolean;
  deshabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // La tarjeta entera es clicable para activar la capa; sin esto, tocar el
        // ojo además la seleccionaría.
        e.stopPropagation();
        onClick();
      }}
      disabled={deshabilitado}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={activo}
      className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** El ancho del menú, en píxeles — el mismo número que antes daba `w-40`. */
const ANCHO_MENU_CAPA = 160;

/** El menú `…` de una capa. Se cierra al elegir o al tocar afuera. */
function MenuDeCapa({
  puedeBorrar,
  haySeleccion,
  onRenombrar,
  onDuplicar,
  onBorrar,
  onMoverAqui,
}: {
  puedeBorrar: boolean;
  /** Si hay algo elegido en el lienzo: es lo que habilita «Mover selección aquí». */
  haySeleccion: boolean;
  onRenombrar(): void;
  onDuplicar(): void;
  onBorrar(): void;
  onMoverAqui(): void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const boton = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  /**
   * 🔴 EL MENÚ SE PORTA A `document.body` — no es estética, es lo que lo hace
   * VISIBLE. La lista de capas scrollea (`overflow-y-auto`, en
   * `PanelDeCapas`), y CSS recorta a cualquier descendiente que se salga de
   * esa caja —con `z-index` o sin él—, así que un menú `absolute` colgado de
   * la tarjeta quedaba tapado por la fila de abajo la mayoría de las veces.
   * Es el mismo defecto, un nivel más adentro, que ya obligó a portar el
   * selector de color y el panel entero fuera de la barra que scrollea (ver
   * esos docblocks): acá se posiciona a mano contra el botón que lo abre, en
   * coordenadas de VIEWPORT (`position: fixed`), y se cierra solo si algo
   * scrollea mientras está abierto — más simple que perseguir al botón pixel
   * a pixel en cada evento de scroll.
   */
  useEffect(() => {
    if (!abierto) return;
    const r = boton.current?.getBoundingClientRect();
    if (r) setPosicion({ top: r.bottom + 4, left: r.right - ANCHO_MENU_CAPA });

    // Cerrar al tocar afuera. En captura, para ganarle al `onPointerDown` de
    // la tarjeta que hay debajo. El menú ya no es descendiente del botón —se
    // portó— así que "afuera" tiene que revisar los DOS.
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !menu.current?.contains(t)) setAbierto(false);
    };
    const cerrar = () => setAbierto(false);
    document.addEventListener('pointerdown', afuera, true);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      document.removeEventListener('pointerdown', afuera, true);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  const opciones: { rotulo: string; Ic: typeof Pencil; hacer: () => void; apagado?: boolean }[] = [
    {
      // Es lo que evita tener que crear la capa ANTES de tener a mano lo que
      // va a llevar: se elige la imagen en el lienzo y se la manda para acá.
      rotulo: 'Mover selección aquí',
      Ic: MoveRight,
      hacer: onMoverAqui,
      apagado: !haySeleccion,
    },
    { rotulo: 'Renombrar', Ic: Pencil, hacer: onRenombrar },
    { rotulo: 'Duplicar capa', Ic: Copy, hacer: onDuplicar },
    { rotulo: 'Eliminar capa', Ic: Trash2, hacer: onBorrar, apagado: !puedeBorrar },
  ];

  return (
    <>
      <span ref={boton} className="relative inline-flex shrink-0">
        <Icono rotulo="Opciones de la capa" activo={abierto} onClick={() => setAbierto((a) => !a)}>
          <MoreHorizontal className="size-3.5" />
        </Icono>
      </span>

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label="Opciones de la capa"
            style={{ position: 'fixed', top: posicion.top, left: posicion.left, width: ANCHO_MENU_CAPA }}
            // Mismo motivo que el `onPointerDown` del panel entero: sin esto,
            // un clic adentro del menú se lee además como un clic en lo que
            // hay debajo (la barra de dibujo).
            onPointerDown={(e) => e.stopPropagation()}
            className="z-50 rounded-lg border border-border bg-card py-1 shadow-lg"
          >
            {opciones.map(({ rotulo, Ic, hacer, apagado }) => (
              <button
                key={rotulo}
                type="button"
                role="menuitem"
                disabled={apagado}
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierto(false);
                  hacer();
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-foreground transition hover:bg-muted disabled:opacity-40"
              >
                <Ic className="size-3.5 text-muted-foreground" />
                {rotulo}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function PanelDeCapas({
  capas,
  figuras,
  capaActiva,
  haySeleccion,
  onCapaActiva,
  onCambiarCapa,
  onRenombrar,
  onAgregar,
  onDuplicar,
  onBorrar,
  onMover,
  onOrdenar,
  onMoverSeleccionA,
}: {
  capas: Capa[];
  figuras: Figura[];
  capaActiva: string;
  haySeleccion: boolean;
  onCapaActiva(id: string): void;
  onCambiarCapa(id: string, cambios: Partial<Omit<Capa, 'id'>>): void;
  onRenombrar(id: string, nombre: string): void;
  onAgregar(): void;
  onDuplicar(id: string): void;
  onBorrar(id: string): void;
  /** `hacia` es el índice en el ARRAY (0 = fondo), ya desinvertido. */
  onMover(id: string, hacia: number): void;
  onOrdenar(a: Reordenamiento): void;
  /** Muda la selección del lienzo a esta capa, sin importar dónde estuviera. */
  onMoverSeleccionA(id: string): void;
}) {
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  /** Sobre qué tarjeta está el puntero mientras se arrastra. */
  const [encima, setEncima] = useState<string | null>(null);

  // Arriba la que se pinta encima. Ver el docblock.
  const alReves = [...capas].reverse();
  const puedeBorrar = capas.length > 1;

  return (
    <div
      className="flex max-h-[26rem] w-72 flex-col rounded-lg border border-border bg-card shadow-lg"
      role="dialog"
      aria-label="Capas"
      // El panel vive pegado a la barra; sin esto, cada clic acá dentro también
      // cuenta como un clic en la barra.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Capas</span>
        <button
          type="button"
          onClick={onAgregar}
          aria-label="Nueva capa"
          title="Nueva capa"
          className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[0.6875rem] text-foreground transition hover:bg-muted"
        >
          <Plus className="size-3" />
          Nueva
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {alReves.map((capa) => {
          const activa = capa.id === capaActiva;
          const cuantas = figurasDe(figuras, capa.id).length;

          return (
            <li
              key={capa.id}
              draggable
              onDragStart={() => setArrastrando(capa.id)}
              onDragEnd={() => {
                setArrastrando(null);
                setEncima(null);
              }}
              onDragOver={(e) => {
                // Sin el `preventDefault` el navegador no considera esta zona un
                // destino válido y el `drop` no llega nunca.
                e.preventDefault();
                if (capa.id !== arrastrando) setEncima(capa.id);
              }}
              onDragLeave={() => setEncima((v) => (v === capa.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setEncima(null);
                if (!arrastrando || arrastrando === capa.id) return;
                // La lista está invertida: el índice del array es el complemento.
                onMover(arrastrando, capas.length - 1 - alReves.findIndex((c) => c.id === capa.id));
              }}
              onClick={() => onCapaActiva(capa.id)}
              aria-current={activa}
              className={
                'mb-1 flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 transition ' +
                (activa ? 'border-primary bg-secondary' : 'border-transparent hover:bg-muted') +
                (arrastrando === capa.id ? ' opacity-40' : '') +
                // La línea de destino va ARRIBA de la tarjeta señalada, que es
                // donde va a quedar la capa arrastrada.
                (encima === capa.id ? ' border-t-2 border-t-primary' : '')
              }
            >
              <MiniaturaDeCapa capa={capa} figuras={figuras} />

              <div className="min-w-0 flex-1">
                {renombrando === capa.id ? (
                  <input
                    autoFocus
                    defaultValue={capa.nombre}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v) onRenombrar(capa.id, v);
                      setRenombrando(null);
                    }}
                    onKeyDown={(e) => {
                      // El teclado no sube: una Enter acá no puede llegar al
                      // documento ni a los atajos de la capa de dibujo.
                      e.stopPropagation();
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenombrando(null);
                    }}
                    aria-label={`Nombre de ${capa.nombre}`}
                    className="w-full rounded border border-input bg-card px-1 py-0.5 text-xs outline-none focus:border-ring"
                  />
                ) : (
                  <p
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenombrando(capa.id);
                    }}
                    title="Doble clic para renombrar"
                    className="truncate text-xs font-medium text-foreground"
                  >
                    {capa.nombre}
                  </p>
                )}

                <p className="flex items-center gap-1.5 text-[0.625rem] text-muted-foreground">
                  <span>{Math.round(capa.opacidad * 100)}%</span>
                  <span>·</span>
                  <span>
                    {cuantas} {cuantas === 1 ? 'objeto' : 'objetos'}
                  </span>
                </p>
              </div>

              <Icono
                rotulo={`${capa.visible ? 'Ocultar' : 'Mostrar'} ${capa.nombre}`}
                activo={!capa.visible}
                onClick={() => onCambiarCapa(capa.id, { visible: !capa.visible })}
              >
                {capa.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Icono>

              <Icono
                rotulo={`${capa.bloqueada ? 'Desbloquear' : 'Bloquear'} ${capa.nombre}`}
                activo={capa.bloqueada}
                onClick={() => onCambiarCapa(capa.id, { bloqueada: !capa.bloqueada })}
              >
                {capa.bloqueada ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </Icono>

              <MenuDeCapa
                puedeBorrar={puedeBorrar}
                haySeleccion={haySeleccion}
                onRenombrar={() => setRenombrando(capa.id)}
                onDuplicar={() => onDuplicar(capa.id)}
                onBorrar={() => onBorrar(capa.id)}
                onMoverAqui={() => onMoverSeleccionA(capa.id)}
              />
            </li>
          );
        })}
      </ul>

      {/* OPACIDAD DE LA CAPA ACTIVA. Va acá y no en la tarjeta: un deslizador por
          fila haría cada tarjeta el doble de alta para una perilla que se toca
          sobre una capa a la vez. */}
      {capas.find((c) => c.id === capaActiva) && (
        <div className="shrink-0 border-t border-border px-2 py-1.5">
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">Opacidad</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((capas.find((c) => c.id === capaActiva)?.opacidad ?? 1) * 100)}
              onChange={(e) => onCambiarCapa(capaActiva, { opacidad: Number(e.target.value) / 100 })}
              aria-label="Opacidad de la capa"
              className="min-w-0 flex-1 cursor-pointer accent-primary"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round((capas.find((c) => c.id === capaActiva)?.opacidad ?? 1) * 100)}
              onChange={(e) => {
                if (e.target.value === '') return;
                const n = Math.min(100, Math.max(0, Number(e.target.value)));
                onCambiarCapa(capaActiva, { opacidad: n / 100 });
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Opacidad de la capa en porcentaje"
              className="w-11 shrink-0 rounded border border-input bg-card px-1 py-0.5 text-right text-[0.6875rem] tabular-nums outline-none focus:border-ring"
            />
          </label>
        </div>
      )}

      {/*
        ORDEN DE LA CAPA ACTIVA. Va A LA VISTA y no solo adentro del «⋯» de
        cada tarjeta (donde también está, para poder mover una capa sin
        activarla primero): es la acción que la vendedora busca de verdad al
        tocar unas flechas en este panel, y dejarla solo en un menú angosto es
        justo lo que hizo que «Orden del objeto», de acá abajo, se leyera como
        si tuviera que mover la capa y no un objeto suyo.
      */}
      {(() => {
        const indiceActiva = capas.findIndex((c) => c.id === capaActiva);
        if (indiceActiva === -1) return null;
        return (
          <div className="shrink-0 border-t border-border px-2 py-1.5">
            <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">Orden de la capa</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onMover(capaActiva, indiceActiva + 1)}
                disabled={indiceActiva >= capas.length - 1}
                title="Subir capa (queda más adelante)"
                aria-label="Subir capa (queda más adelante)"
                className="flex flex-1 items-center justify-center gap-1 rounded border border-border py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <MoveUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMover(capaActiva, indiceActiva - 1)}
                disabled={indiceActiva <= 0}
                title="Bajar capa (queda más atrás)"
                aria-label="Bajar capa (queda más atrás)"
                className="flex flex-1 items-center justify-center gap-1 rounded border border-border py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <MoveDown className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })()}

      {/*
        ACCIONES RÁPIDAS: el orden del OBJETO elegido DENTRO de su capa — no el
        de la capa misma (esa es la sección de arriba). Apagadas sin
        selección, antes que sin efecto.
      */}
      <div className="shrink-0 border-t border-border px-2 py-1.5">
        <p className="mb-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">Orden del objeto</p>
        <div className="flex gap-1">
          {ORDENES.map(({ id, rotulo, Icono: Ic }) => (
            <button
              key={id}
              type="button"
              onClick={() => onOrdenar(id)}
              disabled={!haySeleccion}
              title={rotulo}
              aria-label={rotulo}
              className="flex flex-1 items-center justify-center rounded border border-border py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <Ic className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      <p className="shrink-0 px-2 pb-2 text-[0.625rem] leading-tight text-muted-foreground">
        Una capa bloqueada se ve pero no se puede seleccionar. También podés arrastrar su tarjeta para cambiar el
        orden. En su «⋯» está «Mover selección aquí», para llevar lo elegido a otra capa.
      </p>
    </div>
  );
}
