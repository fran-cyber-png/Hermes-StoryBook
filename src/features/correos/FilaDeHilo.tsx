import { Archive, ArchiveRestore, Clock, MailOpen, Mail, Star, Trash2 } from 'lucide-react';
import { avanceLimpio, fechaDeLista, nombreParaMostrar, type EntradaDeRiel } from '../../dominio/correo';
import { CLASE_BORDE, CLASE_TEXTO, esColorCategoria } from '../../dominio/paletaCategorias';
import type { HiloDeBandeja } from './tipos';

/**
 * UN RENGLÓN DE LA BANDEJA.
 *
 * ══ 🔴 UNA SOLA LÍNEA, Y ESO ES LA MITAD DEL REDISEÑO ═══════════════════════
 *
 * La versión vieja de Correos dibujaba los enviados en una columna de `max-w-2xl`
 * —672 px— centrada en una pantalla de 2.560: el 75 % del ancho quedaba vacío y
 * entraban ocho filas. Un renglón de una sola línea con el asunto y el avance
 * corridos en la misma fila es lo que hace que entren cuarenta, que es la
 * diferencia entre buscar con la rueda del mouse y ver la bandeja de un vistazo.
 *
 * Por eso todo acá es `truncate` y nada envuelve: el ancho lo reparten tres
 * columnas fijas (tilde, estrella, fecha) y una elástica (asunto + avance). Un
 * `whitespace-normal` en cualquiera de ellas rompe la grilla entera.
 *
 * ══ LAS ACCIONES DEL HOVER SE MONTAN SIEMPRE ════════════════════════════════
 *
 * ⚠️ **Están en el DOM desde el primer render, invisibles hasta el hover** — el
 * mismo molde que el botón de reaccionar de `HiloWhatsapp.tsx`, y por la misma
 * razón: montarlas al pasar el mouse hace que el primer clic caiga en la nada,
 * porque el botón aparece bajo el cursor en el mismo frame en que se lo aprieta.
 */

interface FilaDeHiloProps {
  hilo: HiloDeBandeja;
  /** Qué dirección manda en este riel — sale del catálogo, no de un `if` de acá. */
  entrada: EntradaDeRiel;
  tildado: boolean;
  onTildar: (tildado: boolean) => void;
  onAbrir: () => void;
  onDestacar: () => void;
  onArchivar: () => void;
  /**
   * Sacarlo de Archivados y devolverlo a la bandeja.
   *
   * ⚠️ **Se dibuja donde el catálogo dice `desarchivable`, no donde `archivable`
   * es `false`.** En Borradores los dos son `false` y ahí no hay nada que
   * desarchivar: la fila nunca salió de la bandeja.
   */
  onDesarchivar: () => void;
  onPapelera: () => void;
  onLeido: (leido: boolean) => void;
  onPosponer: () => void;
  ahora?: Date;
}

export function FilaDeHilo({
  hilo,
  entrada,
  tildado,
  onTildar,
  onAbrir,
  onDestacar,
  onArchivar,
  onDesarchivar,
  onPapelera,
  onLeido,
  onPosponer,
  ahora,
}: FilaDeHiloProps) {
  /**
   * ⚠️ **El default de `sinLeer` ausente es `false`, y no es arbitrario.** Un
   * server viejo (ventana N4↔N5) no manda el campo; asumir `true` pintaría la
   * bandeja entera en negrita como si todo fuera nuevo, que es exactamente la
   * clase de mentira que este frente vino a sacar de la pantalla. El criterio de
   * cada default vive en su consumidor, como dice `tipos.ts`.
   */
  const sinLeer = hilo.sinLeer === true;
  const destacado = hilo.destacado === true;
  const mensajes = hilo.mensajes ?? 1;
  const etiquetas = hilo.etiquetas ?? [];
  const fallido = hilo.estado === 'fallido';

  const quien = entrada.columna === 'desde' ? hilo.desde : hilo.para;
  const avance = avanceLimpio(hilo.avance);

  return (
    <div
      className={
        'group relative flex items-center gap-3 border-b border-border/50 pl-2 pr-3 text-[13px] ' +
        'transition-colors hover:bg-muted/40 ' +
        (tildado ? 'bg-primary/10 ' : sinLeer ? 'bg-card ' : 'bg-transparent ')
      }
    >
      {/* ── Tilde ── */}
      <input
        type="checkbox"
        checked={tildado}
        onChange={(e) => onTildar(e.target.checked)}
        aria-label={`Seleccionar el correo «${hilo.asunto}»`}
        className="size-3.5 shrink-0 cursor-pointer accent-primary"
      />

      {/* ── Estrella ──
          🔴 Va antes del remitente y no al final: es una acción de UN clic sobre
          una lista larga, así que su posición tiene que ser predecible sin mirar.
          Al final de un renglón elástico, la columna se mueve con el largo del
          asunto. */}
      <button
        type="button"
        onClick={onDestacar}
        aria-label={destacado ? 'Quitar de destacados' : 'Destacar'}
        aria-pressed={destacado}
        title={destacado ? 'Quitar de destacados' : 'Destacar'}
        className="shrink-0 rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Star
          size={15}
          className={
            destacado
              ? /* El dorado significa TIEMPO que se acaba (marca de la casa), así
                   que la estrella NO es dorada: usa el ámbar de la paleta de
                   categorías, que no compite con esa lectura. */
                'fill-cat-naranja text-cat-naranja'
              : 'text-muted-foreground/50 hover:text-muted-foreground'
          }
        />
      </button>

      {/* ── Quién ── */}
      <button
        type="button"
        onClick={onAbrir}
        title={quien ?? undefined}
        className={
          'w-44 shrink-0 truncate text-left transition-colors hover:underline ' +
          (sinLeer ? 'font-bold text-foreground' : 'text-muted-foreground')
        }
      >
        {nombreParaMostrar(quien)}
        {/* El contador del hilo, pegado al nombre como en la referencia. Con un
            solo mensaje no se dibuja: «1» al lado de cada renglón es ruido. */}
        {mensajes > 1 && (
          <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground">{mensajes}</span>
        )}
      </button>

      {/* ── Asunto + avance, corridos en la misma línea ── */}
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
      >
        {etiquetas.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {etiquetas.map((e) => {
              const color = esColorCategoria(e.color) ? e.color : null;
              return (
                <span
                  key={e.id}
                  className={
                    'max-w-32 truncate rounded border px-1.5 py-px text-[10px] font-semibold ' +
                    (color ? `${CLASE_BORDE[color]} ${CLASE_TEXTO[color]}` : 'border-border text-muted-foreground')
                  }
                >
                  {e.nombre}
                </span>
              );
            })}
          </span>
        )}

        <span className={'min-w-0 shrink-0 truncate ' + (sinLeer ? 'font-bold text-foreground' : 'text-foreground/90')}>
          {/* Un correo sin asunto existe: el server lo rechaza al mandar, pero un
              entrante puede llegar así. Se nombra en vez de dejar el hueco. */}
          {hilo.asunto.trim() === '' ? '(sin asunto)' : hilo.asunto}
        </span>

        {avance !== '' && (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            <span aria-hidden="true"> — </span>
            {avance}
          </span>
        )}
      </button>

      {/* ── Fecha, o las acciones al pasar el mouse ──
          Se turnan en el MISMO rectángulo: si las acciones se sumaran a la
          derecha, el renglón entero se correría al pasar el mouse y el clic
          caería en otra fila. */}
      <div className="relative w-24 shrink-0 text-right">
        <span
          className={
            'font-mono text-[11px] transition-opacity group-hover:opacity-0 ' +
            (fallido ? 'text-destructive' : sinLeer ? 'font-bold text-foreground' : 'text-muted-foreground')
          }
        >
          {fallido ? 'no salió' : fechaDeLista(hilo.creadoAt, ahora)}
        </span>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {entrada.archivable && (
            <AccionDeFila etiqueta="Archivar" onClick={onArchivar} icono={Archive} />
          )}
          {entrada.desarchivable && (
            <AccionDeFila etiqueta="Desarchivar" onClick={onDesarchivar} icono={ArchiveRestore} />
          )}
          <AccionDeFila etiqueta="Eliminar" onClick={onPapelera} icono={Trash2} />
          <AccionDeFila
            etiqueta={sinLeer ? 'Marcar como leído' : 'Marcar como no leído'}
            onClick={() => onLeido(sinLeer)}
            icono={sinLeer ? MailOpen : Mail}
          />
          <AccionDeFila etiqueta="Posponer" onClick={onPosponer} icono={Clock} />
        </div>
      </div>

      {/* ⚠️ El motivo del fallo va en el `title` de la fila y no en un chip: en un
          renglón de una línea, un chip de error le come el ancho al asunto de
          TODAS las filas para explicar una. */}
      {fallido && hilo.motivo && <span className="sr-only">No salió: {hilo.motivo}</span>}
    </div>
  );
}

function AccionDeFila({
  etiqueta,
  onClick,
  icono: Icono,
}: {
  etiqueta: string;
  onClick: () => void;
  icono: typeof Archive;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icono size={15} />
    </button>
  );
}
