/**
 * El disco de color que dice por qué canal entró la conversación.
 *
 * El canal es una INSIGNIA, no una columna: la cola es una sola lista mezclada, y
 * el canal se percibe de un vistazo sin ocupar espacio ni partir la lista en
 * secciones. Los colores son de marca externa (excepción documentada, como el
 * `--meta-blue`) — no de la paleta Goberna.
 */
/**
 * ══ Y CADA COLOR TRAE SU TINTA, PORQUE NO HAY UNA QUE SIRVA PARA LOS CUATRO ══
 *
 * 🔴 **Blanco sobre el verde de WhatsApp da 1,98:1.** Medido con la fórmula de
 * `pruebas/contraste.ts`, que es la de WCAG. En la píldora eso se tolera porque
 * lo que va encima es un LOGO —una silueta se reconoce por su forma, no por su
 * contraste—, pero cuando encima va un NÚMERO hay que LEERLO, y a 11 px con ese
 * contraste no se lee. Por eso la tinta se declara acá, al lado del color, y no
 * la elige cada consumidor.
 *
 * Los cuatro colores, blanco contra el navy de la casa (`#0E2A52` fijo, no el
 * token `--navy-ink`, que se da vuelta con el tema — y el color de marca no):
 *
 * ```
 *   WhatsApp   #25D366 → blanco 1,98 · navy  7,19   ← navy, y por goleada
 *   Messenger  #0084FF → blanco 3,66 · navy  3,90   ← navy
 *   Instagram  #C13584 → blanco 5,11 · navy  2,79   ← blanco
 *   Facebook   #1877F2 → blanco 4,23 · navy  3,37   ← blanco
 * ```
 *
 * ⚠️ **Messenger y Facebook no llegan a 4,5:1 con NINGUNA de las dos**, y queda
 * escrito con la cifra en vez de arreglado a escondidas: subirlos exige oscurecer
 * un color de MARCA, que es decisión del dueño y no efecto colateral de pintar un
 * globito. Es el mismo criterio con el que `temaOscuroLegible.test.ts` dejó
 * anotado el 3,30:1 de `--success`. Los dos pasan el 3:1 de elemento de interfaz.
 */
const NAVY = '#0E2A52';
const BLANCO = '#FFFFFF';

const CANAL = {
  facebook: { nombre: 'Facebook', color: '#1877F2', tinta: BLANCO, inicial: 'f', sigla: 'FB' },
  instagram: { nombre: 'Instagram', color: '#C13584', tinta: BLANCO, inicial: 'ig', sigla: 'IG' },
  whatsapp: { nombre: 'WhatsApp', color: '#25D366', tinta: NAVY, inicial: 'wa', sigla: 'WPP' },
} as const;

/**
 * ══ EL CANAL NO ALCANZA: HAY QUE DECIR TAMBIÉN EL TIPO ═══════════════════════
 *
 * 🔴 Hasta el 22-ago-2026 esto pintaba TRES discos, uno por `canal`, y eso deja
 * **un comentario público de Instagram y un mensaje directo de Instagram
 * exactamente iguales** — mismo color, mismo nombre, misma píldora. Son dos
 * trabajos opuestos: al directo se le contesta en privado; el comentario lo lee
 * cualquiera que pase por el post, y contestarlo mal se ve en el muro.
 *
 * El dato ya viajaba: `Conversacion.tipo` distingue `mensaje` · `comentario` ·
 * `lead` desde ADR 0051. No faltaba backend — faltaba dibujarlo.
 *
 * ⚠️ **`tipo` es OPCIONAL a propósito.** Varias pantallas arman una
 * `Conversacion` sin él (la agenda, el buscador, la persona unificada), y ahí
 * ausente tiene que valer «como siempre»: disco lleno y el nombre pelado del
 * canal. Requerirlo obligaría a inventar un valor en esos cinco llamadores, que
 * es cómo se cuela un `mensaje` sobre algo que nadie verificó.
 *
 * ⚠️ **`landing` NO está en `CANAL`, y sigue sin estarlo.** No tiene color de
 * marca ni disco: un formulario no entró por ninguna red. Sí tiene NOMBRE, y por
 * eso `nombreDeCanal` lo resuelve y `BadgeCanal` lo sigue devolviendo `null`.
 */
/**
 * ══ Y UN DIRECTO DE FACEBOOK NO ES FACEBOOK: ES MESSENGER ═══════════════════
 *
 * Pedido del dueño (25-ago-2026), después de que el mensaje privado a un
 * comentario empezara a funcionar: «que esto ya deje de ser Facebook y empiece
 * a ser Messenger, cambia su ícono también».
 *
 * 🔴 **Lo que NO se hizo, y es la decisión que sostiene todo el frente: NO hay
 * un canal `messenger`.** `interactions.canal` sólo admite
 * `facebook|instagram|whatsapp`, y los DOS caminos de ingesta (webhook y
 * polling) escriben `facebook` para un DM de Messenger. Un canal nuevo sería
 * una mentira a nivel dato y arrastraría `ventanaCierraSql`, `plazoDuro`,
 * `fotoVisible`, el `filtroCanal` de la cola y ~20 sitios más.
 *
 * Messenger es lo que se llama el PAR `(facebook, mensaje)` — la misma lectura
 * que `features/identidad/etiquetaOrigen.ts` y `galeriaFiltros.tsx` ya hacían.
 * Por eso vive acá y no en `CANAL`.
 *
 * ⚠️ Y por eso mismo: `(instagram, mensaje)` sigue siendo Instagram. Un DM de
 * Instagram no entra por Messenger.
 */
export interface Insignia {
  nombre: string;
  color: string;
  /**
   * Qué tinta se lee ENCIMA de `color`. Va acá y no en el consumidor porque es
   * una propiedad del color, no de la pantalla: quien elija el fondo por su
   * cuenta y le ponga `text-white` reinventa el 1,98:1 del verde de WhatsApp.
   */
  tinta: string;
  /** Qué logo dibujar. No siempre es el canal: `(facebook, mensaje)` dibuja el de Messenger. */
  logo: string;
  inicial: string;
}

/**
 * LA FUENTE ÚNICA — nombre, color y logo salen todos de acá.
 *
 * 🔴 Antes el nombre lo decidía `nombreDeCanal` y el color el mapa `CANAL`, y
 * eso alcanzaba mientras los dos dependieran sólo del canal. Messenger rompe
 * esa premisa: cambia el nombre **y** el color (`#0084FF`, no el `#1877F2` de
 * Facebook). Si cada uno lo decidiera por su lado, divergirían — que es
 * exactamente el defecto que el docblock de `PildoraCanal` dice haber
 * arreglado en agosto.
 */
export function insigniaDe(canal: string, tipo?: string): Insignia | null {
  if (canal === 'facebook' && tipo === 'mensaje') {
    return { nombre: 'Messenger', color: '#0084FF', tinta: NAVY, logo: 'messenger', inicial: 'm' };
  }
  const meta = CANAL[canal as keyof typeof CANAL];
  if (!meta) return null;
  return {
    nombre: tipo === 'comentario' ? `Comentario de ${meta.nombre}` : meta.nombre,
    color: meta.color,
    tinta: meta.tinta,
    logo: canal,
    inicial: meta.inicial,
  };
}

export function nombreDeCanal(canal: string, tipo?: string): string {
  if (canal === 'landing') return 'Formulario';
  return insigniaDe(canal, tipo)?.nombre ?? canal;
}

/**
 * ══ ¿ESTE CANAL TIENE INSIGNIA? ═════════════════════════════════════════════
 *
 * Un canal que no conocemos no se dibuja: inventarle un color y un símbolo sería
 * afirmar de dónde vino algo que no sabemos de dónde vino.
 *
 * ⚠️ Reemplazó a `siglaDeCanal` (`WPP` · `FB` · `IG` · `FORM`), que vivió medio
 * día: fue el paso intermedio entre el nombre completo y el logo. El nombre
 * largo NO se fue — sigue en `nombreDeCanal`, que es lo que se lee en el `title`
 * y lo que oye un lector de pantalla.
 */
export function canalConInsignia(canal: string): boolean {
  return canal === 'landing' || canal in CANAL;
}

export function BadgeCanal({ canal, tipo, size = 14 }: { canal: string; tipo?: string; size?: number }) {
  const meta = insigniaDe(canal, tipo);
  if (!meta) return null;
  /**
   * En el disco no entra una palabra, así que acá el tipo lo carga el RELLENO:
   * lleno = te escribieron a vos · hueco = lo escribieron en público. Se
   * distingue a 14 px sin leer nada, y el `title` lo dice con todas las letras
   * para quien lo necesite.
   */
  const publico = tipo === 'comentario';
  // Bajo 18px la inicial sería ruido ilegible: el disco de color alcanza. Y en
  // el hueco NUNCA va: sobre el fondo de la tarjeta, la inicial en el color de
  // marca queda por debajo del contraste que exige `temaOscuroLegible`.
  const conInicial = size >= 18 && !publico;
  return (
    <span
      title={nombreDeCanal(canal, tipo)}
      className={
        'inline-flex items-center justify-center rounded-full font-bold ring-2 ring-card ' +
        (publico ? 'bg-card' : 'text-white')
      }
      style={{
        width: size,
        height: size,
        ...(publico
          ? { border: `${Math.max(2, Math.round(size / 7))}px solid ${meta.color}` }
          : { backgroundColor: meta.color }),
        ...(conInicial ? { fontSize: Math.max(9, size * 0.5) } : {}),
      }}
    >
      {conInicial ? meta.inicial : null}
    </span>
  );
}

export function nombreCanal(canal: string): string {
  return CANAL[canal as keyof typeof CANAL]?.nombre ?? canal;
}

/**
 * EL CANAL COMO PÍLDORA CON NOMBRE — no un disco (rediseño de la fila,
 * 22-ago-2026: el dueño pidió más protagonismo para el canal). Misma fuente
 * de verdad que `BadgeCanal` (el mapa `CANAL` de arriba): un color y un
 * nombre nuevos no se escriben dos veces.
 *
 * Acá el tipo lo carga el NOMBRE, no el relleno: hay lugar para la palabra, y
 * una palabra no se puede confundir. La píldora se queda SÓLIDA en los dos
 * casos — un hueco pondría el color de marca como tinta sobre el fondo de la
 * fila, y ni `#1877F2` ni `#C13584` llegan a 4.5:1 contra `--card` en oscuro.
 * El glifo de globo es redundante con la palabra a propósito: la cola se
 * barre, no se lee.
 */
/**
 * ══ LOS LOGOS DE MARCA, DIBUJADOS A MANO ════════════════════════════════════
 *
 * 🔴 **`lucide-react` NO trae logos de marca** — los retiró de la librería, así
 * que no hay import posible y hay que traer los trazos. Van inline y no como
 * archivo: son cuatro paths, y un `<img>` sería una request más por fila.
 *
 * Pedido del dueño (22-ago-2026): «¿podemos poner el logo de wpp, ig y fb en vez
 * de las letras?». Es el caso raro donde un ícono le gana a una palabra: no hay
 * tres símbolos más reconocidos en el mundo, y la vendedora usa las tres apps
 * todos los días. Además `WPP` no es una abreviatura que use nadie en castellano
 * — la habíamos inventado nosotros esa misma mañana.
 *
 * ⚠️ **El riesgo, y hay que tenerlo escrito**: esto se parece al disco de 14 px
 * que ADR 0078 retiró por «casi invisible». Lo que cambia es DÓNDE y CUÁNTO: ahí
 * era un punto de color SIN glifo, pegado al avatar; acá es una píldora del color
 * de marca, con el logo en blanco, abriendo el renglón 1. Si aun así el equipo no
 * los distingue, la vuelta atrás es devolver la sigla al lado del logo.
 *
 * Los colores y los trazos son de marca externa (la excepción de paleta que este
 * archivo ya declaraba arriba).
 */
/**
 * Exportado para el selector de canal de la cola (`ColaUnificada`): mismo trazo, sin reinventarlo.
 *
 * ⚠️ **`soloGlifo` (28-ago-2026, corrección de un bug real, no un ajuste de
 * gusto)** — Facebook y Messenger traen su PROPIO trazo pensado para ir
 * SOLOS: el path entero es "el disco menos la letra/el rayo", así que
 * pintado en el color de marca sobre cualquier fondo YA se ve como el
 * logotipo oficial completo (así lo usa el selector de `ColaUnificada`, con
 * `style={{ color: ... }}` y sin ningún disco propio detrás).
 *
 * `PildoraCanal` hace lo contrario: dibuja SU PROPIO disco de color y encima
 * pinta el ícono en blanco (`fill="currentColor"` + `text-white`), exactamente
 * como espera que se comporten WhatsApp e Instagram (glifos pelados, sin
 * disco propio). Puestos así, Facebook y Messenger se ven INVERTIDOS: el
 * relleno blanco cubre casi todo el disco entero (círculo-menos-letra, todo
 * en blanco) y el disco de color de `PildoraCanal` sólo asoma como un anillo
 * fino en el borde y como el agujero de la letra/el rayo — lo comprobé
 * renderizando los cuatro logos aislados y midiendo el resultado con
 * Playwright antes de tocar nada.
 *
 * `soloGlifo` (default `false`, para no mover el selector de `ColaUnificada`)
 * cambia Facebook/Messenger al MISMO patrón que WhatsApp/Instagram: sólo la
 * letra o el rayo, sin el disco propio adentro del path — el trazo se corta
 * justo antes de que empiece el arco del círculo/globo y se cierra con `Z`,
 * así queda un glifo pelado que sí se porta bien encima de un disco ajeno.
 */
export function LogoDeCanal({ canal, size = 11, soloGlifo = false }: { canal: string; size?: number; soloGlifo?: boolean }) {
  const comun = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    className: 'shrink-0',
  };
  if (canal === 'whatsapp') {
    return (
      <svg {...comun} fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
      </svg>
    );
  }
  if (canal === 'facebook') {
    // Con `soloGlifo`, el trazo se corta antes del arco del círculo (que en el
    // original sigue después de `v8.245`) y se cierra con `Z`: queda sólo la
    // "f", pelada — ver el docblock de más arriba.
    return (
      <svg {...comun} fill="currentColor">
        <path
          d={
            soloGlifo
              ? 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245Z'
              : 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z'
          }
        />
      </svg>
    );
  }
  if (canal === 'messenger') {
    /**
     * El globo con el rayo. No se puede reusar ninguno de los genéricos de
     * lucide: `MessageCircle` y `MessageSquare` YA están tomados por
     * «Comentario» y «Chat» en `features/canales/tipos.ts:TIPO_META`, así que
     * Messenger quedaría indistinguible de un chat de WhatsApp — que es
     * justamente la confusión que este frente viene a sacar.
     *
     * `soloGlifo` deja sólo el rayo (segunda mitad del path original, que en
     * el original arrancaba con un `m` relativo al cierre del globo — acá pasa
     * a `M` absoluto porque el globo ya no está antes para servirle de
     * referencia).
     */
    return (
      <svg {...comun} fill="currentColor">
        <path
          d={
            soloGlifo
              ? 'M19.2 8.98l-3.53 5.6c-.56.89-1.77 1.11-2.61.48l-2.81-2.1a.72.72 0 0 0-.87 0l-3.79 2.88c-.51.38-1.17-.22-.83-.76l3.53-5.6c.56-.89 1.77-1.11 2.61-.48l2.81 2.1c.26.2.61.2.87 0l3.79-2.88c.51-.38 1.17.22.83.76Z'
              : 'M12 0C5.24 0 0 4.95 0 11.64c0 3.5 1.43 6.53 3.77 8.62.2.18.32.42.32.69l.06 2.14c.02.68.72 1.13 1.35.86l2.39-1.05c.2-.09.43-.11.65-.05 1.09.3 2.26.46 3.46.46 6.76 0 12-4.95 12-11.64C24 4.95 18.76 0 12 0Zm7.2 8.98-3.53 5.6c-.56.89-1.77 1.11-2.61.48l-2.81-2.1a.72.72 0 0 0-.87 0l-3.79 2.88c-.51.38-1.17-.22-.83-.76l3.53-5.6c.56-.89 1.77-1.11 2.61-.48l2.81 2.1c.26.2.61.2.87 0l3.79-2.88c.51-.38 1.17.22.83.76Z'
          }
        />
      </svg>
    );
  }
  if (canal === 'instagram') {
    // La cámara: rectángulo redondeado + lente + el punto del flash. A 11 px se
    // lee; el degradado de marca NO se usa — el fondo de la píldora ya es el
    // color, y un degradado adentro sería ruido a este tamaño.
    return (
      <svg {...comun} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (canal === 'landing') {
    // No es una marca: un formulario. Trazo de la casa, no de nadie.
    return (
      <svg {...comun} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 4h12v16H6z" />
        <path d="M9.5 9h5M9.5 13h5M9.5 17h2.5" />
      </svg>
    );
  }
  return null;
}

export function PildoraCanal({
  canal,
  tipo,
  conEtiqueta = true,
}: {
  canal: string;
  tipo?: string;
  /**
   * ¿Lleva la palabra «Coment.» cuando el tipo es comentario? Default `true`
   * (el candado de `BadgeCanal.test.tsx` fija ese comportamiento). La fila de la
   * cola (`FilaConversacion`, rediseño 28-ago-2026) la apaga: ahí el ícono ya
   * vive pegado al nombre en una fila angosta, y el dueño pidió el logo solo,
   * sin la palabra — la distinción comentario/directo la sigue llevando el
   * `title`/`aria-label` para quien la necesite.
   */
  conEtiqueta?: boolean;
}) {
  if (!canalConInsignia(canal)) return null;
  const meta = insigniaDe(canal, tipo);
  const publico = tipo === 'comentario' && conEtiqueta;
  const nombre = nombreDeCanal(canal, tipo);
  return (
    <span
      title={nombre}
      /* `aria-label` porque el contenido visible pasó a ser un dibujo: sin esto,
         un lector de pantalla se saltea de qué canal es la fila. Va en la píldora
         y no en el `<svg>` —que es `aria-hidden`— para que se lea una sola vez. */
      aria-label={nombre}
      role="img"
      className={
        // ⚠️ **El disco SOLO-LOGO tiene que medir lo mismo de ancho que de
        // alto** (corrección del 28-ago-2026, pedido del dueño: «el ícono de
        // las redes sociales debe lucir redondo»). Con `px-1`/`py-px` —padding
        // horizontal de 4px, vertical de 1px— el resultado media ~19×13px:
        // `rounded-full` redondea las cuatro esquinas igual, pero sobre un
        // rectángulo no cuadrado eso da una CÁPSULA ovalada, no un círculo. La
        // píldora CON la palabra «Coment.» no tiene este problema —el texto
        // necesita ancho de sobra— así que la caja fija sólo aplica al caso
        // sin palabra.
        //
        // ⚠️ **`size-3.5` (14px), el número exacto del CSS exportado de la
        // fila real en Figma** (28-ago-2026) — antes `size-4` (16px) cerraba
        // el problema de la elipse pero el tamaño en sí era una estimación.
        // Sólo toca este caso sin palabra: el único que usa `FilaConversacion`
        // (`conEtiqueta={false}`), así que no mueve nada en el header del hilo.
        'inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-wide text-white ' +
        (publico ? 'gap-1 py-px pl-1 pr-1.5' : 'size-3.5')
      }
      style={{ backgroundColor: meta?.color ?? 'var(--cat-morado)' }}
    >
      {/* El logo sale de la insignia, no del canal: `(facebook, mensaje)` dibuja Messenger.

          `soloGlifo`: acá SIEMPRE es `true` — esta píldora dibuja SU PROPIO
          disco de color arriba (`backgroundColor`) y pinta el logo en blanco
          encima, así que necesita el glifo pelado de Facebook/Messenger, no
          su variante autocontenida (ver el docblock de `LogoDeCanal`). Para
          WhatsApp/Instagram no cambia nada: ya eran glifos pelados. */}
      <LogoDeCanal canal={meta?.logo ?? canal} soloGlifo />
      {/*
        EL DIRECTO ES SÓLO EL LOGO; EL COMENTARIO CONSERVA LA PALABRA.
        La asimetría de `siglaDeCanal` no cambió con los logos — al contrario, se
        vuelve más visible: `Coment.` es lo único que avisa, sin haber aprendido
        ningún símbolo, que la respuesta va al MURO. El logo dice POR DÓNDE entró,
        que es otra pregunta.
      */}
      {publico && <span>Coment.</span>}
    </span>
  );
}
