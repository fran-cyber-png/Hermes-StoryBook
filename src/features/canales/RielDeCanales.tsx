import type { ReactNode } from 'react';
import { Clock, Users } from 'lucide-react';
import { LogoDeCanal } from '../../components/BadgeCanal';
import { colorDeOpcionCanal, opcionesDeCanal, type OpcionDeCanal } from './canalesDelRiel';

/**
 * ⚠️ **MISMO VALOR QUE `NAVY` EN `BadgeCanal.tsx`, A PROPÓSITO NO IMPORTADO**:
 * ahí es privado del módulo porque sirve a un cálculo de contraste puntual: acá
 * es el relleno de una insignia, y las dos cosas conviven mejor como dos
 * constantes iguales que como un export que ata un archivo de UI al otro. Es
 * una CHAPA (color de marca fijo), no TINTA — no usa `--navy-ink`, que se da
 * vuelta en oscuro para que el TEXTO siga siendo legible; una chapa no lee, se
 * mira, y su trabajo es no cambiar.
 */
const NAVY = '#0E2A52';

/**
 * EL ANCHO DEL RIEL, EXPORTADO (08-sep-2026) — `ColaUnificada.tsx` lo necesita
 * para animar el ancho del wrapper que lo acopla (`w-0` → este número) y tiene
 * que ser EL MISMO que el `<nav>` de acá abajo, o el wrapper terminaría
 * recortando el riel a medio dibujar (si es más chico) o dejando un borde de
 * más (si es más grande). Un solo número, importado, en vez de dos que puedan
 * desviarse (#37).
 */
export const ANCHO_RIEL_REM = 4.5;

/**
 * EL RIEL DE CANALES — la columna de la izquierda de Mensajes.
 *
 * Pedido del dueño (4-sep-2026): *«los canales estarán a la izquierda
 * escribiendo de arriba abajo, y que le haga clic y que se filtre por canal»*.
 * Antes vivía en un desplegable «Canales ▾» al lado de Todo / No leídos /
 * Favoritos: un eje entero de la mesa escondido detrás de un clic.
 *
 * ══ POR QUÉ SEIS Y NO LOS CUATRO DEL DIBUJO ════════════════════════════════
 *
 * El boceto decía «FB · IG · WSPP · GRUPOS», y hoy los filtros son cinco —
 * Messenger y Formulario también—. Se preguntó y la respuesta fue **los cinco
 * que existen más Grupos**: el dibujo era de DISPOSICIÓN, no una lista cerrada.
 * Recortar la lista después es una línea; **devolver un filtro que alguien ya
 * usaba es un bug reportado**. Y Facebook y Messenger siguen separados porque
 * el dueño lo pidió así el 25-ago-2026.
 *
 * ══ 🔴 POR QUÉ ES ANGOSTO, Y POR QUÉ NO SE LE SACA ANCHO A LA COLA ═════════
 *
 * A 1280 —la laptop de la vendedora, y el mínimo medido del repo— el reparto ya
 * estaba ajustado antes de este riel: 4,75rem de navegación + 25rem de cola +
 * 22,5rem de ficha dejan **24,75rem** para el chat. El riel sale de ahí, no de
 * la cola: angostar la cola es angostar el trabajo. Por eso es ícono + rótulo
 * corto y no una lista con conteos.
 *
 * ⚠️ **No es una segunda navegación aunque esté al lado de la primera.** El riel
 * de vistas (⌘1..⌘9) lleva a OTRO lugar; éste angosta el lugar donde ya estás.
 * Por eso no repite su lenguaje —sin borde propio, sin fondo de tarjeta— y se
 * lee como parte de la cola.
 *
 * ══ 🔴 UN SOLO FORMATO DE ÍCONO PARA LAS SEIS ENTRADAS (07-sep-2026) ═════════
 *
 * Antes convivían tres lenguajes en la misma columna: el glifo de marca
 * AUTOCONTENIDO de WhatsApp/Facebook/Messenger (ya trae su propio disco de
 * color, `LogoDeCanal` sin `soloGlifo`), el trazo SIN relleno de Instagram —al
 * lado de esos tres se leía más débil, no como la misma familia— y un ícono de
 * MENÚ (☰) para «Todos», que en cualquier interfaz dice «abrir un menú», no
 * «ver todos los canales». Medido en captura (`docs/evidencia/…riel…`, pedido
 * del dueño): eso es lo que se leía como «se ve mal», más que cualquier pieza
 * suelta.
 *
 * Ahora las seis comparten `Insignia`: un círculo de 32px con el glifo en
 * BLANCO encima —`soloGlifo`, la misma pieza que ya pinta el logo en la
 * esquina del avatar de `FilaConversacion`—, así que agregar un séptimo canal
 * no exige inventar un cuarto lenguaje. El color de cada círculo sigue
 * saliendo de `colorDeOpcionCanal` (la MISMA fuente que ya pintaba el glifo
 * suelto): no hay un segundo mapa de colores que pueda divergir del que ya usa
 * la cola (#37). «Formulario» no tiene color de marca a propósito —no es una
 * red— y por eso cae al morado de categoría (`--cat-morado`), igual que
 * `PildoraCanal` para el mismo caso. «Todos» y «Grupos» no tienen `canal`, así
 * que llevan su propio color fijo: `NAVY` para «Todos» (una chapa, no un
 * canal) y `--cat-pizarra` para «Grupos» (gris intencional: es la única
 * apagada). Los dos son colores FIJOS, no `--navy-ink`/`--muted-foreground`
 * (que se dan vuelta en oscuro): un relleno de insignia con glifo blanco
 * encima necesita quedarse oscuro en los DOS temas, o el blanco se vuelve
 * invisible sobre un fondo que se aclaró.
 *
 * ⚠️ **«Pronto» se sacó de la segunda línea de texto**: era la ÚNICA entrada
 * con dos renglones, así que su fila medía distinto a las otras cinco y
 * rompía el ritmo vertical de la columna. El aviso ahora vive en una insignia
 * de reloj en la esquina del círculo —mismo mecanismo que el logo de canal
 * sobre el avatar— y sigue completo en el `aria-label`/`title` para quien no
 * lo vea.
 */
export function RielDeCanales({
  canal,
  onCanal,
  esDeCampana = false,
}: {
  /** El id de la opción activa. Vacío = «Todos». */
  canal: string;
  onCanal: (id: string) => void;
  esDeCampana?: boolean;
}) {
  const opciones = opcionesDeCanal(esDeCampana);
  return (
    <nav
      aria-label="Filtrar por canal"
      // ⚠️ El `4.5rem` de acá es EL MISMO que `ANCHO_RIEL_REM` de arriba —
      // Tailwind necesita la clase escrita literal para poder compilarla, así
      // que no se puede armar desde la constante. Si este número cambia,
      // `ANCHO_RIEL_REM` cambia con él en el MISMO commit.
      className="flex min-h-0 w-[4.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto py-1"
    >
      <EntradaTodos activo={canal === ''} onElegir={() => onCanal('')} />
      {opciones.map((o) => (
        <EntradaDeCanal key={o.id} o={o} activo={canal === o.id} onElegir={() => onCanal(o.id)} />
      ))}
    </nav>
  );
}

/**
 * Las clases que comparten «Todos» y cada canal. La forma se define una vez.
 *
 * ⚠️ **`group` acá, no en cada botón**: es lo que le permite a la `Insignia`
 * de adentro reaccionar al hover/click del BOTÓN entero (el círculo es hijo,
 * no el elemento hovereado) sin que cada llamador tenga que acordarse de
 * repetirlo.
 *
 * ⚠️ **El efecto lo lleva el MOVIMIENTO, no un fondo más oscuro (07-sep-2026,
 * pedido del dueño)**: la primera vuelta subía el hover a `bg-card` —blanco
 * sólido, igual que el activo— y quedó exactamente la queja que vino a
 * arreglar: «un fondo plano en cada ícono». Un fondo, sea gris o blanco, sigue
 * siendo un fondo. Lo que de verdad se siente como una reacción es que la
 * INSIGNIA crezca (`group-hover:scale-110` en `Insignia`) y se hunda un poco
 * al soltar el clic (`group-active:scale-95`); el fondo (`hover:bg-muted/60`)
 * queda de apoyo, tenue, para que el hover se note incluso quieto.
 *
 * 🔴 **`activo` YA NO PINTA NADA (08-sep-2026, pedido del dueño), y es la
 * MISMA queja de arriba, una segunda vez.** Hasta acá el canal elegido se
 * marcaba con el mismo `bg-card … shadow-sm` que el hover viejo — el riel
 * ahora se acopla y se queda a la vista mientras se trabaja (ya no era un
 * popover de paso), así que ese recuadro plano dejó de ser un parpadeo y
 * pasó a ser algo que se ve fijo, marcado, sin brillo. Y es INFORMACIÓN QUE
 * YA ESTÁ: el banner «N conversaciones con WhatsApp · Ver todo»
 * (`ColaUnificada.tsx`, «QUÉ ESTÁ FILTRADO AHORA MISMO») dice lo mismo que
 * este recuadro venía a decir, así que sacarlo no pierde nada. `aria-pressed`
 * se queda en los dos botones —el ESTADO sigue existiendo, sólo dejó de
 * pintarse una segunda vez—, y `apagada` sigue siendo la única rama que
 * cambia el fondo (gris intencional de «Grupos»).
 */
function clasesDeEntrada(apagada: boolean): string {
  return (
    'group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    (apagada
      ? 'cursor-not-allowed text-muted-foreground/50'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted')
  );
}

/** El rótulo: 11 px, una línea, y el nombre completo en `title` si no entra. */
function Rotulo({ children }: { children: string }) {
  return (
    <span className="w-full truncate text-[10px] font-semibold leading-tight" title={children}>
      {children}
    </span>
  );
}

/**
 * EL CÍRCULO DE 32px QUE COMPARTEN LAS SEIS ENTRADAS — ver el docblock de más
 * arriba. `color` es siempre un valor FIJO (hex o una variable `--cat-*`/
 * `NAVY`, nunca `--navy-ink`/`--muted-foreground`): el glifo blanco de adentro
 * necesita que el círculo se quede oscuro en los dos temas.
 *
 * `interactiva` prende el crecimiento en hover/click (`group-hover`/
 * `group-active`, leyendo el `group` del botón padre — ver `clasesDeEntrada`).
 * `false` para la insignia de «Grupos»: es la única apagada, y una insignia
 * que crece al pasar el mouse promete una reacción que el clic no va a dar.
 */
function Insignia({
  children,
  color,
  interactiva = false,
}: {
  children: ReactNode;
  color: string;
  interactiva?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        'flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-150 ease-out ' +
        (interactiva ? 'group-hover:scale-110 group-active:scale-95' : '')
      }
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

function EntradaTodos({ activo, onElegir }: { activo: boolean; onElegir: () => void }) {
  return (
    <button type="button" aria-pressed={activo} onClick={onElegir} className={clasesDeEntrada(false)}>
      {/* Una cuadrícula y no un menú (☰): «Todos» es LA SUMA de los canales, no
          un desplegable — el hamburguesa venía diciendo la otra cosa. */}
      <Insignia color={NAVY} interactiva>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
      </Insignia>
      <Rotulo>Todos</Rotulo>
    </button>
  );
}

function EntradaDeCanal({
  o,
  activo,
  onElegir,
}: {
  o: OpcionDeCanal;
  activo: boolean;
  onElegir: () => void;
}) {
  const apagada = o.porQueNo !== null;
  return (
    <button
      type="button"
      // `disabled` y no un `onClick` que no hace nada: sin esto el botón se ve
      // apretable, el foco entra y nada pasa — que es peor que no ofrecerlo.
      disabled={apagada}
      aria-pressed={apagada ? undefined : activo}
      // 🔴 El motivo viaja en el nombre accesible, no sólo en un `title`: quien
      // navega con lector de pantalla también tiene que enterarse de POR QUÉ.
      aria-label={apagada ? `${o.label} — ${o.porQueNo}` : undefined}
      title={o.porQueNo ?? o.label}
      onClick={apagada ? undefined : onElegir}
      className={clasesDeEntrada(apagada)}
    >
      {apagada ? (
        // Gris intencional (`--cat-pizarra`, fijo): es la ÚNICA insignia
        // apagada, y tiene que leerse más callada que las cinco de color de
        // marca — no por opacidad (que también atenuaría el reloj de la
        // esquina), sino por ser, ella sola, la desaturada.
        <span className="relative inline-flex">
          <Insignia color="var(--cat-pizarra)">
            <Users size={15} aria-hidden="true" />
          </Insignia>
          {/* El «todavía no» que antes era una segunda línea de texto (ver el
              docblock de arriba): ahora es esta insignia de reloj, mismo
              mecanismo que el logo de canal sobre el avatar de la fila. El
              motivo completo sigue en el `aria-label`/`title` del botón. */}
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 flex size-[14px] items-center justify-center rounded-full text-white"
            style={{ backgroundColor: NAVY }}
          >
            <Clock size={9} aria-hidden="true" />
          </span>
        </span>
      ) : (
        <Insignia color={colorDeOpcionCanal(o) ?? 'var(--cat-morado)'} interactiva>
          {/* Sin logo propio se dibuja gente: una sala no es un canal de
              nadie, y prestarle el glifo de WhatsApp la haría parecer un
              WhatsApp roto. `soloGlifo`: esta insignia YA es el disco de
              color, así que Facebook/Messenger necesitan su glifo pelado —
              igual que en la esquina del avatar y en `PildoraCanal`. */}
          {o.logo ? <LogoDeCanal canal={o.logo} soloGlifo size={15} /> : <Users size={15} aria-hidden="true" />}
        </Insignia>
      )}
      <Rotulo>{o.label}</Rotulo>
    </button>
  );
}
