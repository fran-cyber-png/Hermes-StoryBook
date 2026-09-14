import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Hourglass, Loader2, UserRound } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import { claveDeVendedora, marcaDeAsignacion } from '../../dominio/dueno';
import { transporteDeLinea, type LineaWhatsapp } from '../../dominio/lineas';
import { lecturaDeVentana, plazoDuro } from '../../dominio/ventana';
import { porqueParaMostrar } from '../../dominio/semaforo';
import { insigniaDe, LogoDeCanal, nombreDeCanal } from '../../components/BadgeCanal';
import {
  cabeceraQuieta,
  CeldaPersona,
  celdaDeCabecera,
  celdaQuietaDensa,
  tablaQuieta,
} from '../../components/TablaQuieta';
import { ETAPA_ROTULO } from '../../lib/etapas';
import { cifra, horasDesde, SEMAFORO_META } from '../../lib/formato';
import { controlDeBarraClass } from '../../lib/styles';
import { BotonAbrirChat } from './BotonAbrirChat';
import { filtrarPorAsignada, opcionesDeAsignada, SIN_ASIGNAR, type FilaDeLista } from './lista';
import { PildoraAsignacion } from './PildoraAsignacion';
import { luzDeTarjeta, rangoDeLuz, type ColumnaTablero } from './tablero';
import { cursoDeTarjeta, haceCorto, nombreDeTarjeta } from './tarjeta';

/**
 * LA LISTA DEL PIPELINE — la misma mesa que el tablero, en filas.
 *
 * No pide nada propio: recibe lo que las columnas ya cargaron, con los recortes
 * ya aplicados (`lista.ts#filasDeLista`), así que cambiar de vista no cambia la
 * respuesta. Agrega lo que una tabla hace mejor que un tablero —ordenar por
 * cualquier columna— y, para quien supervisa, la columna y el filtro de dueña.
 *
 * ⚠️ **Sin foto de perfil**: una fila por conversación son cientos de avatares a
 * la vez, y pedir la foto de cada uno es exactamente la ráfaga que el tope de la
 * tarjeta evita (`CON_FOTO_ARRIBA`, anti-ban #59). Acá van las iniciales.
 *
 * Se ve como toda tabla de Hermes (`TablaQuieta`, ADR 0102), con la celda DENSA:
 * es una lista de trabajo de cientos de filas, no un padrón que se lee de a una.
 */

type Fila = FilaDeLista<Conversacion>;

/** Los tonos de la ventana, los mismos tres del chip de la tarjeta (`dominio/ventana.ts`). */
const TINTA_VENTANA = { verde: 'text-success', amarillo: 'text-warning-foreground', rojo: 'text-destructive' } as const;

export function ListaPipeline({
  filas,
  columnas,
  lineas = [],
  conAsignacion = false,
  total,
  hayMas,
  cargandoMas,
  onTraerMas,
  onFicha,
  fichaAbierta,
  onAbrir,
  filtroInicial = '',
  esDeCampana = false,
}: {
  /**
   * 🔴 En campaña la lista no tiene columna «Curso o anuncio» (regla del dueño,
   * 11-sep-2026: en campaña no sale nada de la Escuela). Ausente = ventas.
   */
  esDeCampana?: boolean;
  filas: readonly Fila[];
  /** Las columnas del tablero: dan el orden de «Etapa», que es el del embudo y no el alfabético. */
  columnas: readonly ColumnaTablero[];
  lineas?: LineaWhatsapp[];
  /** Quien mira supervisa (`veTodo`): columna «Asignada a» y filtro por dueña. */
  conAsignacion?: boolean;
  /** Cuántas hay en la mesa con los recortes puestos — el «de N» del pie. */
  total: number;
  hayMas: boolean;
  cargandoMas: boolean;
  onTraerMas: () => void;
  onFicha: (c: Conversacion) => void;
  /** La clave de la conversación cuya ficha está abierta al costado. */
  fichaAbierta?: string | null;
  onAbrir: (c: Conversacion) => void;
  /**
   * Con qué filtro de dueña abre (el puente del Dashboard). Es el valor INICIAL:
   * a partir de ahí manda el `<select>`. Quien llama remonta la Lista con otra
   * `key` cuando llega un puente nuevo.
   */
  filtroInicial?: string;
}) {
  /**
   * 🔴 **FUERA DEL REACT COMPILER, a propósito.** `useReactTable` devuelve SIEMPRE
   * el mismo objeto y lo muta por dentro (ver el docblock de `Paginador`): si el
   * compilador memoiza `getRowModel()` contra esa referencia, tocar un
   * encabezado cambia el estado y la tabla sigue pintando el orden viejo. Los
   * tests corren sin compilador y no lo verían; con esta directiva la Lista se
   * porta igual compilada que en los tests.
   */
  'use no memo';

  const [orden, setOrden] = useState<SortingState>([]);
  const [filtroGuardado, setFiltro] = useState(filtroInicial);

  const opciones = conAsignacion ? opcionesDeAsignada(filas) : [];
  // Un filtro que ya no aparece en lo cargado (la persona se quedó sin filas
  // tras un refresco) vuelve a «todas»: un `<select>` con un valor que no está
  // entre sus opciones muestra la primera y filtra por otra, sin decirlo.
  const filtro =
    conAsignacion && opciones.some((o) => o.valor === filtroGuardado) ? filtroGuardado : '';
  // …y lo DICE: un filtro que llegó del Dashboard y no se pudo aplicar no puede
  // volver a «todas» callado, porque el Dashboard prometió la lista de esa persona.
  const filtroSinFilas = conAsignacion && filtroGuardado !== '' && filtro === '';
  const visibles = filtrarPorAsignada(filas, filtro);

  const indiceDeEtapa = new Map(columnas.map((col, i) => [col.id as string, i]));
  const etiquetaDeLinea = (numero: string | null) =>
    numero ? lineas.find((l) => l.numero === numero)?.etiqueta : undefined;

  const columnaVentana: ColumnDef<Fila> = {
    id: 'ventana',
    header: 'Ventana',
    accessorFn: (f) => (f.c.ventana_cierra ? Date.parse(f.c.ventana_cierra) : undefined),
    sortUndefined: 'last',
    cell: ({ row }) => {
      const { c } = row.original;
      // Sin memoizar, como en la tarjeta: el dato ES el paso del tiempo.
      const ventana = lecturaDeVentana(
        c.ventana_cierra,
        new Date(),
        plazoDuro(transporteDeLinea(lineas, c.numero_propio)),
      );
      return ventana ? (
        <span title={ventana.ayuda} className={'inline-flex items-center gap-1 text-[11px] font-semibold ' + TINTA_VENTANA[ventana.color]}>
          <Hourglass size={10} className="shrink-0" />
          {ventana.texto}
        </span>
      ) : null;
    },
  };

  const definiciones: ColumnDef<Fila>[] = [
    {
      id: 'persona',
      header: 'Persona',
      accessorFn: (f) => nombreDeTarjeta(f.c).texto,
      sortingFn: (a, b) => a.getValue<string>('persona').localeCompare(b.getValue<string>('persona'), 'es'),
      cell: ({ row }) => {
        const { c } = row.original;
        const nombre = nombreDeTarjeta(c).texto;
        // El canal va AL LADO del nombre (`alLado`) y como GLIFO gris, no como la
        // insignia de color: montado sobre el avatar —y también en línea—, el
        // disco verde de WhatsApp se leía como el punto verde del semáforo, justo
        // al lado de la columna «Luz» (lo mostró la captura, dos veces).
        return (
          <CeldaPersona
            nombre={nombre}
            titulo={nombre}
            alLado={
              <span className="text-muted-foreground" title={nombreDeCanal(c.canal, c.tipo)}>
                <LogoDeCanal canal={insigniaDe(c.canal, c.tipo)?.logo ?? c.canal} size={12} soloGlifo />
              </span>
            }
          />
        );
      },
    },
    {
      id: 'etapa',
      header: 'Etapa',
      accessorFn: (f) => indiceDeEtapa.get(f.etapa) ?? columnas.length,
      cell: ({ row }) => ETAPA_ROTULO[row.original.etapa]?.uno ?? row.original.etapa,
    },
    {
      id: 'luz',
      header: 'Luz',
      accessorFn: (f) => rangoDeLuz(f.c.luz),
      cell: ({ row }) => {
        const luz = luzDeTarjeta(row.original.c);
        return (
          <span
            role="img"
            aria-label={`Luz ${luz}`}
            // En campaña, sin los porqués de precio (regla del dueño, 13-sep-2026).
            title={porqueParaMostrar(row.original.c.porque, { esDeCampana }) ?? undefined}
            className={'inline-block size-2.5 rounded-full ' + SEMAFORO_META[luz].bar}
          />
        );
      },
    },
    ...(conAsignacion
      ? [
          {
            id: 'asignada',
            header: 'Asignada a',
            // Sin dueña ordena AL FINAL en los dos sentidos: «Sin asignar» no es
            // un nombre que empiece con S.
            accessorFn: (f: Fila) => claveDeVendedora(f.c.asignada_a) || undefined,
            sortUndefined: 'last' as const,
            cell: ({ row }: { row: { original: Fila } }) => (
              <PildoraAsignacion marca={marcaDeAsignacion(row.original.c)} />
            ),
          } satisfies ColumnDef<Fila>,
        ]
      : []),
    {
      id: 'linea',
      header: 'Línea',
      accessorFn: (f) => etiquetaDeLinea(f.c.numero_propio),
      sortUndefined: 'last',
      cell: ({ getValue }) => getValue<string | undefined>() ?? <span className="text-muted-foreground/60">—</span>,
    },
    // En campaña la columna no existe: una columna entera de «—» también dice
    // «acá iría un curso», y en campaña no hay cursos.
    ...(esDeCampana
      ? []
      : [
          {
            id: 'curso',
            header: 'Curso o anuncio',
            accessorFn: (f: Fila) => cursoDeTarjeta(f.c)?.nombre,
            sortUndefined: 'last' as const,
            cell: ({ getValue }: { getValue: () => unknown }) => {
              const nombre = getValue() as string | undefined;
              return nombre ? (
                <span title={nombre} className="block max-w-[16rem] truncate">
                  {nombre}
                </span>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              );
            },
          } satisfies ColumnDef<Fila>,
        ]),
    {
      id: 'mensajes',
      header: 'Mensajes',
      accessorFn: (f) => f.c.n,
      cell: ({ getValue }) => <span className="tabular-nums">{cifra(getValue<number>())}</span>,
    },
    {
      id: 'ultimo',
      header: 'Último contacto',
      accessorFn: (f) => Date.parse(f.c.referencia),
      cell: ({ row }) => (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground" title={row.original.c.referencia}>
          {haceCorto(horasDesde(row.original.c.referencia))}
        </span>
      ),
    },
    // En campaña no hay ventana (dueño, 13-sep-2026: «quítale el chip [⧗ 6 d] a todo
    // el pipeline»): la Lista es el mismo pipeline, y queda «Último contacto».
    ...(esDeCampana ? [] : [columnaVentana]),
    {
      id: 'acciones',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        // El botón lleva al chat y NO abre además la ficha de la fila.
        <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <BotonAbrirChat c={row.original.c} lineas={lineas} onAbrir={onAbrir} />
        </span>
      ),
    },
  ];

  const tabla = useReactTable({
    data: visibles,
    columns: definiciones,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (f) => f.c.clave,
    // 🔴 Sin paginación no hay página que reiniciar, y ese reinicio automático es
    // lo que entraba en bucle: react-table lo encola cada vez que cambia el modelo
    // ordenado, y acá las filas son un arreglo nuevo en cada render (`'use no
    // memo'`). Con un orden puesto, cada render pedía otro. Candado en
    // `ListaPipeline.test.tsx`; lo encontró la galería compilada.
    autoResetPageIndex: false,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
      {conAsignacion && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          {/* El control de la barra de una tabla (ADR 0102): el mismo alto y el
              mismo borde que los del padrón. */}
          <label className={controlDeBarraClass}>
            <UserRound size={12} className="shrink-0 text-muted-foreground" />
            <select
              aria-label="Asignada a"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="rounded bg-transparent text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="">Todas las vendedoras</option>
              {opciones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo} · {cifra(o.n)}
                </option>
              ))}
            </select>
          </label>
          {filtroSinFilas && (
            <p role="status" className="text-[11px] text-muted-foreground">
              Ninguna conversación cargada es de «{filtroGuardado === SIN_ASIGNAR ? 'Sin asignar' : filtroGuardado}»: se
              muestran todas.
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table aria-label="Lista del pipeline" className={tablaQuieta}>
          <thead className={cabeceraQuieta}>
            {tabla.getHeaderGroups().map((grupo) => (
              <tr key={grupo.id}>
                {grupo.headers.map((h) => {
                  const sentido = h.column.getIsSorted();
                  const Flecha = sentido === 'asc' ? ArrowUp : sentido === 'desc' ? ArrowDown : ChevronsUpDown;
                  return (
                    <th
                      key={h.id}
                      aria-sort={sentido === 'asc' ? 'ascending' : sentido === 'desc' ? 'descending' : undefined}
                      className={celdaDeCabecera}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={
                            'group inline-flex items-center gap-1 rounded transition-colors duration-200 ease-house hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
                            (sentido ? 'text-foreground' : '')
                          }
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <Flecha
                            size={11}
                            aria-hidden
                            className={sentido ? 'text-navy-ink' : 'opacity-0 transition-opacity group-hover:opacity-60'}
                          />
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {tabla.getRowModel().rows.map((fila) => {
              const { c } = fila.original;
              const abierta = fichaAbierta === c.clave;
              return (
                <tr
                  key={fila.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver la ficha de ${nombreDeTarjeta(c).texto}`}
                  onClick={() => onFicha(c)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onFicha(c);
                    }
                  }}
                  className={
                    // `group`: `BotonAbrirChat` se destapa con `group-hover`, como en
                    // la tarjeta. Sin la clase en la fila, la columna de acción
                    // salía vacía (lo encontró la revisión de spec).
                    'group cursor-pointer transition-colors duration-150 ease-house hover:bg-secondary/50 focus-visible:bg-secondary/60 focus-visible:outline-none ' +
                    (abierta ? 'bg-secondary' : '')
                  }
                >
                  {fila.getVisibleCells().map((celda) => (
                    <td key={celda.id} className={`${celdaQuietaDensa} whitespace-nowrap text-[12px] text-foreground`}>
                      {flexRender(celda.column.columnDef.cell, celda.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs">
        <p className="text-muted-foreground">
          Mostrando <span className="font-semibold tabular-nums text-foreground">{cifra(visibles.length)}</span> de{' '}
          <span className="font-semibold tabular-nums text-foreground">{cifra(total)}</span>
        </p>
        {hayMas && (
          <button
            type="button"
            onClick={onTraerMas}
            disabled={cargandoMas}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-foreground transition-colors duration-200 ease-house hover:border-primary disabled:opacity-50"
          >
            {cargandoMas && <Loader2 size={11} className="animate-spin" />}
            {cargandoMas ? 'Trayendo…' : 'Traer más'}
          </button>
        )}
      </div>
    </div>
  );
}
