import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlarmClock,
  ChevronRight,
  Columns3,
  Compass,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Notebook,
  Package,
  Phone,
  Route,
  Users,
  Bot,
} from 'lucide-react';
import { Escudo } from './components/Marca';
import { Avisos } from './components/Avisos';
import { BotonDeTema } from './components/BotonDeTema';
import { TituloDeSeccion } from './components/TituloDeSeccion';
import { useLocalStorage } from './lib/useLocalStorage';
import { botonAzulClass } from './lib/styles';
import { ColaUnificada } from './features/canales/ColaUnificada';
import { ConversacionActiva } from './features/canales/ConversacionActiva';
import type { Conversacion } from './dominio/conversaciones';
import { conversacionDeTelefono } from './dominio/conversacionNueva';
import BarraFrescura from './features/canales/BarraFrescura';
import { EstadoWhatsapp } from './features/whatsapp/EstadoWhatsapp';
import { useLineas } from './dominio/lineas';
import { ElegirLinea } from './features/canales/ElegirLinea';
import { InterruptorAutoRespuesta } from './features/autorespuesta/InterruptorAutoRespuesta';
import { InterruptorBot } from './features/bot/InterruptorBot';
import { ColaRevision } from './features/autorespuesta/ColaRevision';
import { PorQueEstaSugerencia } from './features/autorespuesta/PorQueEstaSugerencia';
import { useModoRevision } from './features/autorespuesta/useModoRevision';
import { useAutoRespuesta } from './features/autorespuesta/datos';
import { conversacionDeSugerencia, paso as pasoDeRevision } from './features/autorespuesta/revision';
import { PanelDerecho } from './features/panel/PanelDerecho';
import { VistaProductos } from './features/productos/VistaProductos';
import { entrenaYNoEsDeCampana, noEsDeCampana, type QuienMira, veRouting } from './features/vistas/acceso';
import { pendientesQueApuran, useAgenda } from './features/agenda/agenda';
import { Login } from './features/auth/Login';
import { useSesion, type Vendedora } from './features/auth/sesion';
import { useLatidoDeSesion } from './features/auth/actividad';
import { useEfectoAlCambiar } from './lib/useEfectoAlCambiar';
import { AvisoCerberus } from './features/auth/AvisoCerberus';
import { PanelUsuario } from './features/auth/PanelUsuario';
import { MenuMovil } from './features/auth/MenuMovil';
import { BarraDeNavegacionMovil, PISO_MOVIL } from './features/movil/BarraDeNavegacionMovil';
import { useEsMovil } from './lib/useEsMovil';
import { enTauri } from './lib/tauri';

import { useTiempoReal } from './lib/datos/tiempoReal';
import { useLlamadaActual } from './features/llamadas/llamadaActual';
import { SELECTOR_CAMPOS } from './lib/teclado/escapeDePopover';
import type { DestinoCorreo, Puente } from './lib/puente';
import { esAtajoLibreta } from './features/notas/notas';

/**
 * La Libreta se carga PEREZOSA y solo se monta cuando su vista está a la vista.
 * El editor no puede entrar al bundle del arranque: se le cobraría a todas,
 * incluso a las que ese día no escriben nada.
 *
 * ⚠️ **Acá había dos números y los dos quedaron viejos** («BlockNote 269 KB
 * gzip», «el bundle principal pasa de 222 a 491»). Medido el 18-ago-2026 con
 * `vite build`: el arranque son **317 KB gzip** y este chunk llegó a **391**
 * antes de partirse. Hoy son tres (ver `notas/perezosos.tsx`): entrar a la vista
 * **20 KB**, abrir una página de texto **+289**, abrir un diagrama **+82**.
 * El número no se vuelve a escribir a mano acá: lo mide `npm run presupuesto`.
 *
 * Y como toda vista que no es la Bandeja, se DESMONTA al salir: por eso la
 * Libreta adelanta su autoguardado pendiente en el desmontaje (ver su archivo).
 */
/**
 * ══ 🔴 LAS OCHO VISTAS CONMUTADAS VIAJAN PEREZOSAS — 21-ago-2026 ═══════════
 *
 * Hasta hoy sólo la Libreta era `lazy()` y las otras nueve entraban al chunk de
 * arranque. Medido con `vite build`: **578 KB gzip**, contra los «317 KB» que el
 * comentario de acá abajo daba por buenos tres días antes. Partiéndolas:
 * **578 → 460 KB gzip (−117, −20 %)**.
 *
 * Eso es la mitad del arreglo. La otra mitad la encontró el techo nuevo del
 * chunk de entrada (`scripts/presupuesto-de-chunks.mjs`) en su primera corrida:
 * **el motor del editor viajaba en el arranque** —102 ocurrencias de
 * `prosemirror`— arrastrado por `bloquesDeTexto`, cinco líneas puras alojadas en
 * un archivo que importa `@blocknote/core`. Sacándola: **466 → 239 KB**.
 *
 * **586 → 239 KB gzip en total, −59 %.** Ver `src/features/notas/bloques.ts`.
 *
 * ⚠️ **Mensajes NO está acá, y es correcto**: vive SIEMPRE montada (se esconde
 * con `hidden`, no se desmonta) para conservar el chat abierto, el scroll y el
 * borrador. Partirla no ahorraría nada — es la vista que siempre se carga.
 *
 * ⚠️ **El arranque abre en Dashboard**, así que la primera pantalla paga
 * `460 + 19 KB` en dos viajes en vez de 578 en uno. Sigue ganando (−98 KB), pero
 * el ahorro completo lo cobra quien va directo a Mensajes. Precargarla es el
 * siguiente paso y va con su medición, no de prepo.
 */
const VistaDashboard = lazy(() => import('./features/dashboard/VistaDashboard').then((m) => ({ default: m.VistaDashboard })));
const VistaEmbudo = lazy(() => import('./features/vistas/VistaEmbudo').then((m) => ({ default: m.VistaEmbudo })));
const VistaPersonas = lazy(() => import('./features/vistas/VistaPersonas').then((m) => ({ default: m.VistaPersonas })));
/**
 * ⚠️ **Perezosa como su hermana, y por el mismo motivo**: sólo una de las dos se
 * monta nunca (según el módulo), así que meter las dos en el chunk de arranque
 * le costaría a cada persona el peso de la vista que no va a ver. El presupuesto
 * de chunks (`npm run presupuesto`) mide el cierre de imports ESTÁTICOS del
 * entry — un `import` normal acá no rompe el corte, pero sí engorda el arranque
 * de todos por una pantalla que abre una parte del equipo.
 */
const VistaContactosCampana = lazy(() =>
  import('./features/contactos/VistaContactosCampana').then((m) => ({ default: m.VistaContactosCampana })),
);
const VistaAgenda = lazy(() => import('./features/agenda/VistaAgenda').then((m) => ({ default: m.VistaAgenda })));
const VistaCorreos = lazy(() => import('./features/correos/VistaCorreos').then((m) => ({ default: m.VistaCorreos })));
const VistaEntrenamiento = lazy(() => import('./features/entrenamiento/VistaEntrenamiento').then((m) => ({ default: m.VistaEntrenamiento })));
const VistaNavegador = lazy(() => import('./features/navegador/VistaNavegador').then((m) => ({ default: m.VistaNavegador })));
const VistaRouting = lazy(() => import('./features/routing/VistaRouting').then((m) => ({ default: m.VistaRouting })));
/**
 * 🔴 **Ésta TIENE que ser perezosa, y no por costumbre**: es la única vista que
 * usa MUI X Charts, y MUI arrastra su propio motor de estilos (emotion) —
 * cientos de KB que el presupuesto de chunks (`npm run presupuesto`) le cobraría
 * al arranque de TODO el equipo, incluida la gente que nunca abre Llamadas. Un
 * `import` normal acá no rompe ningún test; solo engorda la primera pantalla de
 * todos y nadie lo nota hasta la próxima medición.
 */
const VistaLlamadas = lazy(() => import('./features/llamadas/VistaLlamadas').then((m) => ({ default: m.VistaLlamadas })));
// La barra de la llamada va perezosa por el presupuesto del chunk de arranque (`npm run presupuesto`); el
// estado de la llamada y la suscripción a la señal sí van en el arranque (`features/llamadas/llamadaActual.ts`).
const BarraDeLlamada = lazy(() => import('./features/llamadas/BarraDeLlamada').then((m) => ({ default: m.BarraDeLlamada })));

const Libreta = lazy(() => import('./features/notas/Libreta').then((m) => ({ default: m.Libreta })));

/**
 * HERMES — la mesa de la vendedora.
 *
 * UN espacio con vistas (ADR 0002), conmutadas por estado — sin router. La
 * navegación es un RIEL vertical a la izquierda: el escudo arriba, las vistas
 * al medio (ícono + nombre: nadie navega adivinando), la vendedora abajo.
 * El Dashboard es la página principal. Se trabaja en la Bandeja — que queda
 * SIEMPRE montada (oculta, no desmontada): el borrador del composer y el hilo
 * abierto sobreviven a cualquier paseo por las demás vistas.
 *
 * Teclado global (§2.8 del spec): ⌘1..⌘N cambia de vista (el rango sale de
 * `VISTAS`, no de un número escrito a mano) · «/» va a la búsqueda de la cola ·
 * Escape cierra la conversación (solo en Mensajes, nunca desde un input) · «?»
 * abre la cabina con el mapa completo · «n» va a la libreta personal (#47).
 */

/** `WebkitAppRegion` no está en los tipos de CSSProperties; el webview sí lo lee. */
const ARRASTRABLE = { WebkitAppRegion: 'drag' } as CSSProperties;
const NO_ARRASTRABLE = { WebkitAppRegion: 'no-drag' } as CSSProperties;

const VISTAS = [
  { id: 'dashboard', label: 'Dashboard', icono: LayoutDashboard },
  { id: 'embudo', label: 'Pipeline', icono: Columns3 },
  // 🔴 CONTACTOS ES DE VENTAS, ENTERA: sus dos solapas son el padrón de icarus
  // (ADR 0035) y el buscador de Cerberus por teléfono. Las dos rutas ya son 403
  // para campaña (`modulos/modulo.ts`), así que dejarla en el riel sería un
  // ícono que no abre nada.
  /**
   * ⚠️ **YA NO lleva `soloPara: noEsDeCampana`** (23-ago-2026). Se le sacó a
   * campaña porque sus dos solapas —el padrón de icarus y el buscador de
   * Cerberus— leen el negocio educativo; el pedido del dueño es que campaña
   * tenga «la pestaña contactos donde van registrando todos sus contactos», que
   * es otra cosa: lo que el equipo anota desde el chat (`contacto_ficha`).
   * Misma entrada del riel, DOS contenidos — ver el render más abajo.
   */
  { id: 'personas', label: 'Contactos', icono: Users },
  { id: 'bandeja', label: 'Mensajes', icono: MessagesSquare },
  { id: 'correos', label: 'Correos', icono: Mail, soloPara: noEsDeCampana },
  { id: 'agenda', label: 'Agenda', icono: AlarmClock },
  // La séptima: donde se mira trabajar al bot sin gastar un lead de la pauta.
  // No es trabajo diario de la vendedora, pero vive en el riel igual — fuera de
  // la app quedaría huérfana, y lo que no está a la vista no se usa.
  // 🔴 Y desde ADR 0077 es de UNA persona: la entrenadora (`puedeEntrenar`, que
  // lo decide el server). Para el resto del equipo el ícono no existe, y la API
  // contesta 403 igual (`soloEntrenadoras`).
  { id: 'entrenamiento', label: 'Entrenar bot', icono: Bot, soloPara: entrenaYNoEsDeCampana },
  // La octava (ADR 0034). Entra por el MISMO criterio que dejó afuera a la
  // Cabina (y a Ivi, mientras existió: ADR 0076) —«el riel es para LUGARES»—, no
  // por una excepción: a la Cabina se la consulta, a la libreta se entra. Vivió 12 días detrás de la tecla «n»
  // sin ícono en ningún lado, y `notas` terminó con cero filas.
  // 🔴 YA NO lleva `soloPara: noEsDeCampana` (ADR 0084, revierte la parte de
  // Libreta de ADR 0061/0063): un comando de campaña también necesita su propio
  // playbook. `/api/notas`, `/api/espacios` y `/api/plantillas-texto` pasaron a
  // compartidas en `modulos/modulo.ts`.
  { id: 'libreta', label: 'Libreta', icono: Notebook },
  // La novena (ADR 0040). Entra por el mismo criterio de ADR 0034 —el riel es
  // para LUGARES— y no por ser útil: se sale a la web con la sesión de trabajo
  // y se vuelve, como a la Libreta se entra a escribir. La acción primaria se
  // puede nombrar en dos palabras: «abrir un sitio».
  { id: 'navegador', label: 'Navegador', icono: Compass, soloPara: noEsDeCampana },
  // La décima (20-ago-2026). Mismo criterio de ADR 0034 que las tres de
  // arriba —un LUGAR con acción primaria nombrable, «mirar el catálogo»— y
  // el mismo `soloPara`: es el catálogo de productos de Cerberus, y una
  // campaña no vende nada. Sin tecla propia (⌘1..⌘9 ya están ocupadas por
  // las nueve de arriba, y el rango no se agranda por esto).
  { id: 'productos', label: 'Productos', icono: Package, soloPara: noEsDeCampana },
  // La undécima. Mismo criterio de ADR 0034 —un LUGAR con acción primaria
  // nombrable, «revisar las llamadas»—, y sin tecla propia: ⌘1..⌘9 ya están
  // ocupadas por las nueve de arriba y el rango no se agranda por esto.
  //
  // ⚠️ Lleva el MISMO `soloPara` que Productos: el registro es de la línea de
  // WhatsApp de la Escuela, y una campaña no la usa. Y como toda vista que SÍ le
  // pide datos al server, esconderla del riel no protege nada — el recorte de
  // verdad vive en su ruta (`/api/llamadas` está montada con `deVentas`).
  { id: 'llamadas', label: 'Llamadas', icono: Phone, soloPara: noEsDeCampana },
  // La undécima. `soloPara` decide quién la tiene en el riel
  // (`features/vistas/acceso.ts`).
  //
  // ⚠️ Lo que `soloPara` hace es ESCONDER, no proteger, y ésta es la ÚNICA que se
  // puede dar ese lujo: mientras la vista no pida nada al server no hay
  // diferencia. Las cinco de arriba sí piden, así que su recorte vive en el
  // `WHERE` de sus rutas (`modulos/deEsteModulo.ts`, ADR 0035/0036) y el
  // `soloPara` es sólo la mitad que se ve.
  { id: 'routing', label: 'Routing', icono: Route, soloPara: (q: QuienMira) => veRouting(q.id) },
] as const;

type Vista = (typeof VISTAS)[number]['id'];

/**
 * CUÁNTAS VISTAS ALCANZA EL TECLADO. No es un tope de diseño: es cuántas teclas
 * de dígito hay para un acorde (⌘0 es del navegador, no nuestro). De la décima
 * en adelante se entra por el riel, y el `title` del botón **no promete** una
 * tecla que no existe.
 *
 * 🔴 Y hay una trampa que ya casi muerde: el rango se comparaba como CADENA
 * (`e.key >= '1' && e.key <= String(VISTAS.length)`). Con nueve vistas eso
 * andaba de casualidad; con diez, `String(10)` es `'10'` y `'2' <= '10'` da
 * **false** — se rompían ⌘2..⌘9 y quedaba andando solo ⌘1. Ahora se compara el
 * NÚMERO, y el tope sigue derivándose (del mínimo entre lo que esta persona ve
 * y las teclas que existen), nunca de un número escrito a mano.
 */
const TECLAS_DE_VISTA = 9;

/**
 * Las vistas que ESTA persona tiene en el riel. Sin `soloPara`, la ve todo el mundo.
 *
 * ⚠️ Recibe la vendedora entera y no su id: desde que hay una regla que pregunta
 * «¿de qué lado del negocio trabaja?» (`noEsDeCampana`), el id no alcanza — ese
 * hecho lo sabe el server y baja por `/api/auth/yo`.
 */
function vistasDe(quien: QuienMira | null | undefined) {
  return VISTAS.filter((v) => ('soloPara' in v ? v.soloPara(quien ?? {}) : true));
}

/**
 * Lee la vista que la URL pide (`?vista=...`) y la valida contra las vistas que
 * esta persona realmente puede ver. Si no hay nada en la URL, si el valor no es
 * una vista conocida, o si no le corresponde, cae a Dashboard.
 *
 * Esto hace que un refresh o hard refresh preserve la sección: el estado de la
 * vista viaja en la URL, no en `localStorage` (que se mezclaría entre pestañas y
 * persistiría más allá de la sesión).
 */
function vistaInicialDesdeUrl(permitidas: Set<Vista>): Vista {
  const raw = new URLSearchParams(location.search).get('vista');
  return raw && permitidas.has(raw as Vista) ? (raw as Vista) : 'dashboard';
}

/**
 * Sincroniza la URL con la vista activa sin agregar una entrada al historial.
 * `replaceState` evita que el botón Atrás se llene de cambios de vista.
 */
function reflejarVistaEnUrl(vista: Vista) {
  const url = new URL(location.href);
  if (url.searchParams.get('vista') === vista) return;
  url.searchParams.set('vista', vista);
  // `history.state` y no `null`: en el celular la entrada actual puede ser la de
  // un chat abierto (ver abajo), y pisarla con `null` dejaría al botón atrás sin
  // saber que tiene un chat que cerrar.
  history.replaceState(history.state, '', url.toString());
}

/**
 * ══ EN EL CELULAR, EL CHAT ABIERTO ES UNA ENTRADA DEL HISTORIAL ═════════════
 *
 * En Android el botón atrás es el gesto de «volver a la lista», igual que en
 * WhatsApp. Sin una entrada propia, ese botón sacaría a la vendedora de Hermes
 * con el chat abierto. Por eso abrir un chat en el celular apila una entrada
 * (con la MISMA URL: no hay rutas, ADR 0002), y volver —con el botón del sistema
 * o con la flecha del chat— la consume.
 *
 * ⚠️ **La flecha no cierra el chat directo: hace `history.back()` y deja que el
 * `popstate` lo cierre.** Si cerrara por su cuenta, la entrada quedaría apilada y
 * cada chat atendido dejaría un «atrás» muerto: la vendedora aprieta atrás para
 * salir y no pasa nada, una vez por persona.
 *
 * ⚠️ **Abrir otro chat con uno ya abierto REEMPLAZA la entrada, no apila otra**
 * («abrir contacto» desde el registro rápido): atrás vuelve a la lista, no al
 * chat de antes — que es lo que hace WhatsApp.
 */
const CHAT_EN_EL_HISTORIAL = 'hermesChat';

function hayChatEnElHistorial(): boolean {
  const estado = history.state as Record<string, unknown> | null;
  return Boolean(estado?.[CHAT_EN_EL_HISTORIAL]);
}

function apilarChatEnElHistorial(clave: string) {
  const estado = { ...((history.state as Record<string, unknown> | null) ?? {}), [CHAT_EN_EL_HISTORIAL]: clave };
  if (hayChatEnElHistorial()) history.replaceState(estado, '');
  else history.pushState(estado, '');
}

/**
 * ¿El teclado está "ocupado" escribiendo? Ningún atajo global pisa un input.
 * El selector es el mismo que usan los popovers (`src/lib/teclado/`): dos listas
 * distintas significaban que la misma tecla se juzgaba distinto según quién la oyera.
 */
function tecleandoEn(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLElement && Boolean(t.closest(SELECTOR_CAMPOS));
}

/**
 * LA CABINA LEE LAS VISTAS DE ESTA PERSONA, no `VISTAS`. Con la lista completa
 * prometería una tecla que no lleva a ningún lado —y peor: la numeración se
 * correría, así que ⌘4 diría una vista y abriría otra— apenas alguna vista deje
 * de ser para todas. Una sola lista, un solo número (#37).
 */
function atajosDe(vistas: readonly { label: string }[]): { tecla: string; que: string }[] {
  return [
    ...vistas.slice(0, TECLAS_DE_VISTA).map((v, i) => ({ tecla: `⌘${i + 1}`, que: v.label })),
    { tecla: '/', que: 'Buscar en la cola' },
    { tecla: '↑↓ ⏎', que: 'Recorrer la cola' },
    { tecla: 'Esc', que: 'Cerrar la conversación' },
    // Las tres del chat abierto: no existen sin una conversación adelante, y
    // por eso se leen juntas y después de las de navegación.
    { tecla: '⌘K', que: 'Acciones rápidas' },
    { tecla: 'r', que: 'Registrar el contacto' },
    { tecla: 'e', que: 'Cambiar la etapa' },
    { tecla: 't', que: 'Poner una etiqueta' },
    { tecla: 'a', que: 'Agendar seguimiento (revisar auto-respuestas si no hay chat abierto)' },
    { tecla: 'n', que: 'Anotar algo (tu libreta si no hay chat abierto)' },
    { tecla: '?', que: 'Esta ayuda' },
  ];
}

/**
 * LAS TECLAS DE LA REVISIÓN, aparte porque solo existen adentro del modo — y
 * porque son todas ACORDES, que es lo que las hace seguras.
 *
 * En revisión el foco está en el composer (ahí se edita el borrador), así que
 * las teclas sueltas tipo `j`/`k` de Superhuman o Intercom no se pueden usar:
 * escribirían. Los acordes con ⌘/Ctrl no escriben texto y pasan igual. De yapa,
 * ninguna de las dos decisiones —aprobar, descartar— se dispara con un dedo que
 * resbala.
 *
 * `⌘↵` es el «enviar» de toda la industria (Intercom, Missive, Gmail) y `⌘D` el
 * «descartar borrador» de Missive: se eligieron por convención, no por gusto.
 */
const ATAJOS_REVISION: { tecla: string; que: string }[] = [
  { tecla: '⌘↵', que: 'Aprobar y seguir' },
  { tecla: '⌘D', que: 'Descartar y seguir' },
  { tecla: '⌘↓ ⌘↑', que: 'Saltar sin decidir' },
  { tecla: 'Esc', que: 'Salir de la revisión' },
];

/** La cabina: el mapa de teclas, en voz de imprenta. Se abre con «?». */
function Cabina({
  onCerrar,
  enRevision,
  atajos,
}: {
  onCerrar: () => void;
  enRevision: boolean;
  /** Los de ESTA persona: el riel y la cabina cuentan las vistas igual. */
  atajos: { tecla: string; que: string }[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/20" onClick={onCerrar} role="dialog" aria-modal="true" aria-label="Atajos de teclado">
      <div className="w-72 rounded-2xl bg-card p-5 shadow-panel animate-entrar" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-heading text-sm font-bold text-navy-ink">La cabina</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Todo Hermes sin soltar el teclado.</p>
        {/* Las de la revisión van PRIMERO y solo cuando se está adentro: es el
            único momento en que alguien abre esto para buscar una tecla. */}
        {enRevision && (
          <>
            <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wide text-navy-ink">En la revisión</p>
            <dl className="mt-1.5 space-y-1.5">
              {ATAJOS_REVISION.map((a) => (
                <div key={a.tecla + a.que} className="flex items-center justify-between gap-3">
                  <dt className="rounded-md bg-navy px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{a.tecla}</dt>
                  <dd className="text-xs text-foreground">{a.que}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Siempre</p>
          </>
        )}
        <dl className="mt-3 space-y-1.5">
          {atajos.map((a) => (
            <div key={a.tecla + a.que} className="flex items-center justify-between gap-3">
              <dt className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">{a.tecla}</dt>
              <dd className="text-xs text-muted-foreground">{a.que}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * LA PALETA DE ACCIONES RÁPIDAS (⌘K) — la puerta única a lo que se hace sobre
 * la conversación abierta.
 *
 * Existe por una razón de teclado, no de moda: las letras sueltas ya están casi
 * todas tomadas (`n` libreta, `a` auto-respuestas; `i` quedó libre con ADR 0076) y romper esas
 * para meter cinco nuevas cambiaría atajos que el equipo ya tiene en el dedo.
 * ⌘K estaba libre, es un acorde (no escribe texto, así que anda con el foco en
 * el composer) y es lo que Linear, Notion y Slack enseñaron a apretar.
 *
 * Es una LISTA DE ATAJOS, no un lugar nuevo: cada acción dispara exactamente el
 * mismo control que el mouse abre en la barra. Si algo se puede hacer acá y no
 * ahí, está mal puesto.
 */
function PaletaAcciones({
  acciones,
  onCerrar,
}: {
  acciones: { id: string; que: string; tecla?: string; hacer: () => void }[];
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [i, setI] = useState(0);

  const filtradas = acciones.filter((a) => a.que.toLowerCase().includes(texto.trim().toLowerCase()));
  const elegida = filtradas[Math.min(i, filtradas.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-navy/20 pt-[18vh]"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Acciones rápidas"
    >
      <div className="w-80 animate-entrar overflow-hidden rounded-2xl bg-card shadow-panel" onClick={(e) => e.stopPropagation()}>
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            // El teclado de la paleta se atiende ACÁ y se corta: el listener del
            // shell escucha en burbuja, así que sin esto Escape cerraría además
            // la conversación de atrás.
            e.stopPropagation();
            if (e.key === 'Escape') onCerrar();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setI((v) => Math.min(v + 1, filtradas.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setI((v) => Math.max(v - 1, 0));
            }
            if (e.key === 'Enter' && elegida) {
              e.preventDefault();
              onCerrar();
              elegida.hacer();
            }
          }}
          autoFocus
          placeholder="Qué quieres hacer…"
          aria-label="Buscar una acción"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <ul className="max-h-72 overflow-y-auto p-1">
          {filtradas.map((a, n) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseEnter={() => setI(n)}
                onClick={() => {
                  onCerrar();
                  a.hacer();
                }}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ' +
                  (elegida?.id === a.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60')
                }
              >
                <span className="flex-1">{a.que}</span>
                {a.tecla && (
                  <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-panel">
                    {a.tecla}
                  </span>
                )}
              </button>
            </li>
          ))}
          {filtradas.length === 0 && (
            <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">Nada con ese nombre.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/**
 * LA PUERTA — y NADA MÁS que la puerta.
 *
 * ══ 🔴 POR QUÉ ESTÁ PARTIDO EN DOS ═══════════════════════════════════════════
 *
 * Hasta el 19-ago-2026 esto era un solo componente de ~670 líneas, con los
 * `useSesionWa`, `useAutoRespuesta`, `useAgenda`, el radar del Dashboard y el
 * SSE declarados ARRIBA de los early returns. Las reglas de los hooks obligan a
 * eso: un `return` temprano no puede saltearse una llamada. Consecuencia
 * medida: **con la pantalla de Login adelante, cuatro polls seguían corriendo
 * contra el server** —el de la sesión de WhatsApp cada 10 s, el de la
 * auto-respuesta cada 30, el de la agenda cada 60, el del radar cada 30— todos
 * contestando 401 y ninguno visible para nadie. Una máquina abierta en el Login
 * le pegaba a producción para siempre.
 *
 * `enabled` en cada hook lo tapaba, pero es una lista que hay que acordarse de
 * mantener: el hook que se agregue mañana no lo lleva y nadie se entera. Partir
 * el componente lo hace **imposible de olvidar**, porque el hook nuevo se
 * escribe adentro de `AppAutenticada`, que no existe hasta que hay sesión.
 *
 * El candado es `src/App.polls.test.tsx`: monta `<App/>` SIN token, deja correr
 * 90 s de reloj falso y cuenta los `fetch`. Tienen que ser cero.
 *
 * ⚠️ **Y el radar del Dashboard se nombra en criollo, sin escribir el nombre de
 * su hook**: `dashboardFueraDeLaRaiz.test.ts` fija que ese identificador no
 * aparezca en este archivo —ni siquiera en un comentario— porque lo que vigila
 * es que la consulta más cara no cuelgue de la raíz, y un `grep` no distingue
 * una llamada de una anécdota. El candado tiene razón: la prosa se adapta.
 */
export default function App() {
  const { vendedora, cargando, sinServer, reintentar, entrar, salir, cerberusVivo, errorCenturion } = useSesion();

  if (cargando) {
    /**
     * EL ARRANQUE: la anatomía del shell + la marca.
     *
     * ⚠️ **El riel y el header se quedan, y eso NO es decoración**: son los dos
     * bloques que van a estar ahí cuando la app aparezca, así que dibujarlos ya
     * es lo que evita que todo salte de lugar en el primer render. Lo que se
     * reemplazó son las tres placas grises del medio —que no anticipaban nada,
     * porque ahí puede haber una cola, un tablero o un calendario— por el escudo.
     *
     * 🔴 **ESTO SE VE MENOS QUE ANTES, y es a propósito.** Desde que el módulo
     * viaja en el token (`features/auth/sesion.ts`), una sesión guardada pinta
     * la app directo: acá se cae sólo cuando NO hay atajo posible —un token
     * vencido o ilegible—, o sea justo cuando de verdad hay que esperar al
     * server. Un splash que se muestre en CADA arranque sería reintroducir la
     * espera que ese frente eliminó, y con el p90 de `/api/auth/yo` en 41 s eso
     * es un logo mirado durante cuarenta segundos.
     *
     * El `Escudo` es el que ya usa la marca (`components/Marca.tsx`), no una
     * copia: con dos, el día que cambie el emblema esta pantalla se quedaría con
     * el viejo y nadie la mira hasta que alguien se queda afuera de la sesión.
     */
    return (
      <div className="flex h-dvh bg-background">
        {/* `max-md:hidden`: en el celular no hay riel, y el esqueleto no puede prometer uno. */}
        <div className="w-[4.75rem] shrink-0 border-r border-border bg-card max-md:hidden" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-14 shrink-0 border-b border-border bg-card" />
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="animate-pulse">
              <Escudo size={44} />
            </div>
            <span className="font-heading text-xs font-extrabold tracking-[0.18em] text-muted-foreground">
              HERMES
            </span>
          </div>
        </div>
      </div>
    );
  }
  if (!vendedora) {
    return <Login entrar={entrar} sinServer={sinServer} reintentar={reintentar} errorCenturion={errorCenturion} />;
  }

  // Con sesión, la app de verdad. Se monta acá y no arriba a propósito: todo lo
  // que pregunta al server vive adentro, así que sin sesión no hay nada que
  // preguntar — ver el bloque de arriba.
  return (
    <AppAutenticada
      vendedora={vendedora}
      reintentar={reintentar}
      entrar={entrar}
      salir={salir}
      cerberusVivo={cerberusVivo}
    />
  );
}

/** Lo que `AppAutenticada` necesita de la sesión, ya resuelta. */
interface PropsAutenticada {
  vendedora: Vendedora;
  /** Vuelve a validar el token (lo dispara un 401 del stream). */
  reintentar: () => void;
  /** Reconectar con Cerberus desde el aviso, sin salir de la app. */
  entrar: (username: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  cerberusVivo: boolean | null;
}

/**
 * LA APP CON SESIÓN — el shell entero. Todo lo que le pregunta algo al server
 * cuelga de acá, así que nada de esto existe mientras la vendedora no entró.
 */
function AppAutenticada({ vendedora, reintentar, entrar, salir, cerberusVivo }: PropsAutenticada) {
  // El latido de la sesión (pedido del dueño): corre en segundo plano aunque
  // Configuración esté cerrada, porque si deja de latir el server cree que te
  // fuiste. 🔴 Es el LATIDO, no el cronómetro: acá adentro ya no hay ningún
  // `setInterval` que re-renderice el shell entero una vez por segundo (ver el
  // docblock de `features/auth/actividad.ts`). El reloj lo tickea quien lo
  // dibuja, que es el modal de Configuración.
  const actividad = useLatidoDeSesion(vendedora.id);
  const [abierta, setAbierta] = useState<Conversacion | null>(null);
  /**
   * EL PANEL DERECHO SE PUEDE CONTRAER (`PanelDerecho`, la ficha de al lado del
   * chat). Es una PREFERENCIA DE UI —no estado del servidor—, así que va a
   * `localStorage` y no a React a secas: la regla de `lib/datos/cliente.ts`
   * («preferencias de UI → localStorage, nunca al servidor») y el mismo molde
   * que ya usa la cola para su tab y su línea (`ColaUnificada.tsx`, `KEY_TAB`).
   * Empieza ABIERTO — quien nunca lo tocó ve exactamente el panel de siempre.
   */
  const [panelColapsado, setPanelColapsado] = useLocalStorage('hermes.panelDerechoColapsado', false);
  /**
   * ══ EL PANEL SE MONTA EN DOS TIEMPOS, PARA PODER ANIMAR LOS DOS SENTIDOS
   * (08-sep-2026, pedido del dueño: mismo riel/animación que el filtro de
   * canales de Mensajes) ══
   *
   * `panelColapsado` es la PREFERENCIA (persistida); estos dos son el estado
   * de RENDER, y por qué no son lo mismo:
   *
   * `PanelDerecho` dispara nueve hooks de datos (ficha, eventos, intereses,
   * agenda, llamadas…) — a diferencia de `RielDeCanales` (estático), dejarlo
   * SIEMPRE montado detrás de un `opacity-0` sería pedirle a Cerberus y
   * compañía trabajo que la vendedora pidió explícitamente no ver mientras
   * tiene el panel colapsado. Por eso `panelMontado` demora el DESMONTAR
   * hasta que la transición de CERRADO termina —220 ms, el mismo número que
   * `duration-[220ms]` de ahí abajo, no los 380 ms de abrir: desmontar antes
   * de que termine el abrir no aplica, esa rama nunca lo programa— y
   * `panelExpandido` es lo que de verdad dispara el ancho: al abrir, se monta
   * primero a ancho 0 y recién en el frame SIGUIENTE crece — sin ese primer
   * frame no hay «desde dónde» animar, un elemento no transiciona su propio
   * primer render.
   *
   * 🔴 **UN SOLO `requestAnimationFrame` NO ALCANZA, y por eso está encadenado
   * dos veces (08-sep-2026, corrección del mismo día: «se abre muy rápido» —
   * medido, ni siquiera animaba, saltaba directo a 360px en el primer frame).**
   * React puede terminar de commitear el render de `panelMontado=true` (ancho
   * 0) y el de `panelExpandido=true` (ancho completo) ANTES de que el
   * navegador llegue a pintar el primero — un `rAF` corre justo antes del
   * próximo repintado, no después de él, así que no garantiza que ese
   * repintado ya haya pasado. El segundo `rAF`, ANIDADO adentro del primero,
   * es lo que fuerza a esperar a que el ancho 0 se haya pintado de verdad
   * antes de disparar la transición — el mismo patrón que ya usa este
   * archivo para el foco del buscador (`busquedaRef`, un poco más abajo).
   */
  const [panelMontado, setPanelMontado] = useState(!panelColapsado);
  const [panelExpandido, setPanelExpandido] = useState(!panelColapsado);
  useEffect(() => {
    if (!panelColapsado) {
      setPanelMontado(true);
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setPanelExpandido(true));
      });
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    }
    setPanelExpandido(false);
    const t = setTimeout(() => setPanelMontado(false), 220);
    return () => clearTimeout(t);
  }, [panelColapsado]);
  /**
   * ══ EN EL CELULAR HAY UNA SOLA VISTA: MENSAJES — SALVO PARA CAMPAÑA ═══════
   *
   * A menos de 768 px no hay riel (no entra), así que no hay cómo ir a otra
   * vista: Mensajes es la pantalla de inicio y la única. La vista que se MUESTRA
   * se deriva y no se escribe en el estado, para que no haya un cuadro de
   * Dashboard antes de pasar a Mensajes ni un efecto que lo corrija tarde.
   *
   * **Un comando de campaña tiene dos** (12-sep-2026, pedido del dueño):
   * Mensajes y Pipeline, con la barra de abajo (`BarraDeNavegacionMovil`) como
   * único camino entre ellas. Es la misma derivación: lo que no sea una de las
   * dos cae a Mensajes, y para ventas sigue cayendo todo. Se decide con
   * `esDeCampana` porque es visibilidad, no una frontera (`vistas/acceso.ts`):
   * el Pipeline ya es de los dos módulos en escritorio.
   *
   * `vistaElegida` sigue viva por debajo: al girar el teléfono (o ensanchar la
   * ventana) vuelve el escritorio de siempre, y arranca en Mensajes si se abrió
   * en el celular — pasar de golpe al Dashboard con un chat a medio escribir
   * sería un castigo por girar la pantalla.
   */
  const esMovil = useEsMovil();
  const [vistaElegida, setVista] = useState<Vista>(() =>
    esMovil ? 'bandeja' : vistaInicialDesdeUrl(new Set(vistasDe(vendedora).map((v) => v.id))),
  );
  const barraMovil = esMovil && vendedora.esDeCampana === true;
  const vista: Vista = !esMovil ? vistaElegida : barraMovil && vistaElegida === 'embudo' ? 'embudo' : 'bandeja';
  const [direccion, setDireccion] = useState<'abajo' | 'arriba'>('abajo');
  const [cabina, setCabina] = useState(false);
  // Una llamada a la vista es una capa sobre la mesa: tapa el navegador embebido igual que la cabina. Y el
  // aviso de un error o de «la contestó otra» también se ve, así que también tapa.
  const llamadaActual = useLlamadaActual();
  const hayLlamadaALaVista =
    llamadaActual.estado.fase !== 'libre' || llamadaActual.error !== null || llamadaActual.nota !== null;
  const [paleta, setPaleta] = useState(false);
  /**
   * LAS SEÑALES DE LOS ATAJOS DEL CHAT. Contadores, no booleanos: apretar `R`,
   * cerrar el drawer y volver a apretar `R` tiene que abrirlo otra vez, y con
   * un booleano el valor no cambiaría.
   */
  const [senales, setSenales] = useState({ registrar: 0, estado: 0, etiqueta: 0, agendar: 0, notas: 0 });
  const senalar = (cual: 'registrar' | 'estado' | 'etiqueta' | 'agendar' | 'notas') => {
    // 🔴 **`notas` es la única que apunta al panel derecho, y el panel se
    // CONTRAE.** Desde que el chip «Notas» se fue de la barra del chat
    // (25-ago-2026), el botón que consume esta señal vive al pie del timeline;
    // con el panel contraído ese componente está DESMONTADO, así que la tecla
    // no abriría nada y se leería como un atajo roto. Desplegarlo es parte del
    // gesto: pediste anotar, te muestro dónde.
    if (cual === 'notas') setPanelColapsado(false);
    setSenales((s) => ({ ...s, [cual]: s[cual] + 1 }));
  };
  // EL MODO REVISIÓN (ADR 0018). No es una hoja encima de la app: es la vista
  // Mensajes con la cola filtrada a lo que hay que decidir, la conversación
  // real en el medio y el porqué a la derecha. Todo su estado vive en el hook,
  // que también sabe «a cuál voy» cuando la abierta se resuelve.
  const revision = useModoRevision();
  const { limites: limitesAuto } = useAutoRespuesta();
  // El puente (§2.9): una vista le pasa el mando a otra; la destinataria lo consume y lo limpia.
  const [puente, setPuente] = useState<Puente | null>(null);
  const busquedaRef = useRef<HTMLInputElement>(null);
  const { lineas } = useLineas();
  const [escribirPendiente, setEscribirPendiente] = useState<string | null>(null);

  // La vista activa viaja en la URL para sobrevivir al refresh. No se usa
  // `localStorage`: competiría entre pestañas y persistiría más allá de la sesión.
  useEffect(() => {
    reflejarVistaEnUrl(vista);
  }, [vista]);

  // Si la identidad se resuelve tarde (el token no traía `esDeCampana` y `/yo`
  // lo agrega), o si los permisos cambian, la vista actual puede dejar de ser
  // válida. En ese caso caemos a Dashboard en vez de dejarla en una pantalla
  // que no le corresponde.
  // Solo importa cuando cambia la identidad; no queremos revalidar en cada
  // cambio de vista.
  useEfectoAlCambiar([vendedora.id, vendedora.esDeCampana, vendedora.puedeEntrenar], () => {
    const permitidas = new Set(vistasDe(vendedora).map((v) => v.id));
    if (!permitidas.has(vista)) {
      setVista('dashboard');
    }
  });

  // Objeto estable: la Agenda re-dispararía su efecto si la identidad cambiara por render.
  const crearInicialAgenda = useMemo(
    () => (puente?.tipo === 'agenda' ? { telefono: puente.telefono ?? undefined, nota: puente.nota } : null),
    [puente],
  );

  // Entrar a una sugerencia ABRE su conversación: revisar es mirar un chat, no
  // leer un texto suelto. Es la costura entre el modo y la mesa de siempre.
  const claveDeRevision = revision.actual?.clave ?? null;
  // Solo al cambiar de sugerencia: reabrir en cada render pisaría la
  // conversación que la vendedora haya elegido a mano.
  useEfectoAlCambiar([claveDeRevision, revision.activo], () => {
    if (!revision.activo || !revision.actual) return;
    abrirEnLaBandeja(conversacionDeSugerencia(revision.actual));
    setVista('bandeja');
  });

  // El nervio en vivo: escucha el stream del server e invalida lo que cambió.
  // Solo con sesión (el stream está detrás del perímetro, #36); si el stream
  // recibe un 401, corta y dispara la re-validación — que echa si el token
  // murió de verdad, en vez de martillar cada 3 segundos.
  // `true` fijo y no `Boolean(vendedora)`: acá adentro la sesión ya existe —
  // este componente no se monta sin ella. El parámetro se conserva porque el
  // hook también lo usa para pedir el permiso de notificaciones.
  useTiempoReal(true, reintentar);

  // El badge de la Agenda: cuántas promesas apuran (vencidas + de hoy).
  // Dorado, porque es TIEMPO — la única acepción del oro en Hermes.
  const { agenda } = useAgenda();
  const apuran = pendientesQueApuran(agenda.data?.recordatorios);

  // El riel de ESTA persona. El riel, los ⌘N y la cabina leen esta lista y no
  // `VISTAS`: con dos listas, la tecla que anda y el rótulo que la anuncia se
  // separan sin que nada lo diga (#37).
  const vistas = vistasDe(vendedora);

  // La transición direccional: bajar en el riel entra desde abajo, subir desde arriba.
  function cambiarVista(destino: Vista) {
    const desde = vistas.findIndex((v) => v.id === vista);
    const hasta = vistas.findIndex((v) => v.id === destino);
    if (hasta !== desde) setDireccion(hasta > desde ? 'abajo' : 'arriba');
    setVista(destino);
  }

  /**
   * LO QUE OFRECE ⌘K. Con una conversación abierta son las acciones sobre ella;
   * sin ninguna, sólo lo que se puede hacer igual (ir a la Agenda, a la
   * libreta). **Ninguna acción es exclusiva de la paleta**: todas existen como
   * botón, y la paleta sólo las alcanza más rápido.
   */
  const accionesRapidas = [
    ...(abierta
      ? [
          { id: 'registrar', que: 'Registrar el contacto', tecla: 'r', hacer: () => senalar('registrar') },
          { id: 'estado', que: 'Cambiar la etapa', tecla: 'e', hacer: () => senalar('estado') },
          { id: 'etiqueta', que: 'Poner una etiqueta', tecla: 't', hacer: () => senalar('etiqueta') },
          { id: 'agendar', que: 'Agendar seguimiento', tecla: 'a', hacer: () => senalar('agendar') },
          { id: 'notas', que: 'Anotar algo del contacto', tecla: 'n', hacer: () => senalar('notas') },
        ]
      : []),
    { id: 'agenda', que: 'Ver mi agenda', hacer: () => cambiarVista('agenda') },
    { id: 'nota', que: 'Abrir mi libreta', hacer: () => cambiarVista('libreta') },
    { id: 'buscar', que: 'Buscar en la cola', tecla: '/', hacer: () => {
      cambiarVista('bandeja');
      requestAnimationFrame(() => requestAnimationFrame(() => busquedaRef.current?.focus()));
    } },
  ];

  // ── El teclado global (§2.8): la guarda va antes que todo. ──
  // `vendedora.id` está en las claves porque de él sale `vistas`: sin eso, el
  // listener se quedaría con el riel de quien estaba antes y ⌘N abriría otra cosa.
  useEfectoAlCambiar(
    [vista, cabina, paleta, abierta, revision.activo, revision.actualId, revision.fila, vendedora.id],
    () => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Escape cierra en orden: cabina → revisión → conversación abierta
        // (solo en Mensajes). La revisión sale ANTES que la conversación:
        // adentro del modo, Escape significa «sal de acá».
        //
        // LA LIBRETA YA NO ESTÁ EN ESTA LISTA (ADR 0034) y no es un olvido: es
        // una VISTA, y de una vista no se sale con Escape —de Dashboard tampoco—
        // se va a otra. Lo único que hay que cuidar al leer esto es que lo de
        // abajo siga andando: la cascada se acortó por arriba, no por el medio.
        //
        // Y sale AUN CON EL FOCO EN EL COMPOSER, que es la única excepción a la
        // guarda de «no pises un input». Sin esto Escape no funcionaba nunca en
        // revisión: ahí el foco vive siempre en el borrador, así que la guarda
        // se comía la tecla y la única salida era el botón. Se acota al
        // `textarea` a propósito —los popovers de la barra usan `input` y
        // siguen manejando su propio Escape— y la cabina se atiende antes, así
        // que nunca se le roba el Escape a algo abierto encima.
        const enElBorrador =
          revision.activo && e.target instanceof HTMLElement && e.target.tagName === 'TEXTAREA';
        if (tecleandoEn(e) && !enElBorrador) return;
        if (paleta) {
          setPaleta(false);
          return;
        }
        if (cabina) {
          setCabina(false);
          return;
        }
        if (revision.activo) {
          revision.salir();
          return;
        }
        if (vista === 'bandeja') cerrarConversacion();
        return;
      }
      // Los acordes con ⌘/Ctrl no escriben texto: pasan aun con el foco en un input.
      // El rango se DERIVA —de las vistas de esta persona, no de un '6' escrito
      // a mano: al agregar la séptima el atajo se quedó corto sin que nada lo
      // dijera, y el próximo que agregue una vista no tiene por qué acordarse
      // de este `if`.
      //
      // 🔴 Y se compara el NÚMERO, no la cadena. Con `e.key <= String(n)` y diez
      // vistas, `'2' <= '10'` es false: andaba ⌘1 y se rompían las ocho del
      // medio — o sea que el candado de la ÚLTIMA vista no lo habría visto.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaleta((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        const n = Number(e.key);
        const destino = n >= 1 && n <= Math.min(vistas.length, TECLAS_DE_VISTA) ? vistas[n - 1] : undefined;
        if (destino) {
          e.preventDefault();
          cambiarVista(destino.id);
          return;
        }
      }
      // ── LAS TECLAS DE LA REVISIÓN ──
      // Van acá arriba, ANTES de la guarda de «estás tecleando», porque en
      // revisión el foco vive en el composer: si esperaran a que el foco salga
      // del textarea, no funcionarían nunca. Son acordes justamente por eso.
      // `⌘↵` (aprobar) lo maneja el composer, que es el que tiene el texto
      // editado — acá solo van las que no lo necesitan.
      if (revision.activo && (e.metaKey || e.ctrlKey)) {
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          if (revision.actualId !== null) revision.descartarIds([revision.actualId]);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          revision.saltar(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          revision.saltar(-1);
          return;
        }
      }
      if (tecleandoEn(e)) return;
      if (e.key === '?') {
        e.preventDefault();
        setCabina((v) => !v);
        return;
      }
      // ── LAS CINCO DEL CHAT ABIERTO ──
      // Sólo con una conversación adelante, y sólo en Mensajes: son acciones
      // SOBRE esa conversación, así que fuera de ahí no tienen a quién
      // aplicarse. Van antes que nada global para que su significado no dependa
      // de dónde esté el foco.
      //
      // 🔴 `a` y `n` PISAN ACÁ ADENTRO a las globales (auto-respuestas y
      // libreta) — es la excepción, no la regla: afuera de este `if` siguen
      // siendo lo de siempre (más abajo en este mismo handler). Decisión del
      // dueño (20-ago-2026): con una conversación abierta, `a`/`n` son Agendar
      // y Notas; en cualquier otro lugar de la app, auto-respuestas y libreta.
      // La MISMA tecla hace dos cosas según el contexto — a propósito, y por
      // eso queda escrito acá con todas las letras.
      if (vista === 'bandeja' && abierta && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const letra = e.key.toLowerCase();
        if (letra === 'r' || letra === 'e' || letra === 't' || letra === 'a' || letra === 'n') {
          e.preventDefault();
          senalar(
            letra === 'r'
              ? 'registrar'
              : letra === 'e'
                ? 'estado'
                : letra === 't'
                  ? 'etiqueta'
                  : letra === 'a'
                    ? 'agendar'
                    : 'notas',
          );
          return;
        }
      }
      // La libreta personal (#47): «n» sola, nunca ⌘N/Ctrl+N (eso es del navegador).
      // NAVEGA, no alterna: desde que es una vista (ADR 0034), «n» es el atajo de
      // ⌘8 y nada más. Alternar la dejaría contestando dos cosas distintas según
      // dónde estés parada, y peor: la tecla de ir a la libreta te sacaría de la
      // libreta. Volver es ⌘1..⌘8 o el riel, como con cualquier otra vista.
      if (esAtajoLibreta(e)) {
        e.preventDefault();
        cambiarVista('libreta');
        return;
      }
      // La revisión de las auto-respuestas: «a» sola. Es lo que se hace a las 9
      // de la mañana, desde donde sea que estés parada.
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (revision.activo) revision.salir();
        else revision.entrar();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        cambiarVista('bandeja');
        // Doble RAF: la Bandeja está siempre montada pero oculta — hay que
        // esperar a que sea visible para que el foco agarre.
        requestAnimationFrame(() => requestAnimationFrame(() => busquedaRef.current?.focus()));
      }
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
    },
  );


  // Abrir una conversación desde cualquier vista te trae a la Bandeja: es la
  // única vista donde se conversa. Las demás miran, esta trabaja.
  function abrirConversacion(c: Conversacion) {
    abrirEnLaBandeja(c);
    cambiarVista('bandeja');
  }

  /**
   * ABRIR Y CERRAR UNA CONVERSACIÓN PASAN POR ACÁ, y no por `setAbierta` suelto:
   * en el celular las dos cosas tocan el historial (ver `CHAT_EN_EL_HISTORIAL`).
   * En escritorio no se apila nada y cerrar es `setAbierta(null)`, lo de siempre.
   *
   * `cerrarConversacion` pregunta al HISTORIAL y no a `esMovil`: si el chat se
   * abrió en el celular y después se giró la pantalla, la entrada sigue ahí y
   * hay que consumirla igual.
   */
  function abrirEnLaBandeja(c: Conversacion) {
    if (esMovil) apilarChatEnElHistorial(c.clave);
    setAbierta(c);
  }
  function cerrarConversacion() {
    // `abierta` en la guarda: al recargar con un chat abierto el navegador
    // conserva su entrada, pero ya no hay chat. Sin esto, Escape se gastaría esa
    // entrada navegando hacia atrás sin nada que cerrar. (La entrada vieja no se
    // pierde: el próximo chat que se abra la reusa con `replaceState`.)
    if (abierta && hayChatEnElHistorial()) history.back();
    else setAbierta(null);
  }
  // El que cierra de verdad: el botón atrás del sistema y la flecha del chat
  // terminan los dos acá. Sin guarda de `esMovil` por el mismo motivo de arriba.
  useEffect(() => {
    const alIrAtras = () => {
      if (!hayChatEnElHistorial()) setAbierta(null);
    };
    window.addEventListener('popstate', alIrAtras);
    return () => window.removeEventListener('popstate', alIrAtras);
  }, []);
  // Cruzar a celular CON un chat abierto —se abrió con el teléfono en horizontal,
  // que ya es escritorio, y después se giró—: ese chat no tiene entrada, y el
  // primer atrás de Android sacaría a la vendedora de Hermes. Se la da al cruzar.
  // Al volver a escritorio no se toca: la entrada queda y el atrás cierra el chat.
  useEfectoAlCambiar([esMovil], () => {
    if (esMovil && abierta && !hayChatEnElHistorial()) apilarChatEnElHistorial(abierta.clave);
  });

  // «Escribirle» desde una ficha: el chat nuevo. Siempre se abre el selector
  // antes de armar la conversación, aunque haya una sola línea: la vendedora
  // tiene que ver desde qué número va a salir el mensaje. La clave se arma en
  // `conversacionDeTelefono` y no acá: desde que el padrón abre la ficha al
  // costado hay un SEGUNDO llamador, y dos copias de la clave `conv:…` son dos
  // claves distintas el día que una cambie.
  const puedeEscribir = lineas.length > 0;
  const escribirA = puedeEscribir
    ? (telefono: string) => setEscribirPendiente(telefono)
    : undefined;

  /**
   * IR A CORREOS CON EL DESTINATARIO PUESTO — y con la conversación de la que
   * salió, que es la mitad que faltaba.
   *
   * 🔴 **Acepta las DOS formas a propósito.** El único llamador que existía
   * hasta hoy es el radar del Dashboard, que solo tiene el correo del
   * formulario (`fila.form.correo`) y ninguna conversación: pasa un string
   * suelto. Los llamadores nuevos —la ficha, en Mensajes, en el Pipeline y en
   * el padrón— sí saben de qué conversación vienen y pasan el objeto. Exigir el
   * objeto obligaría a tocar el Dashboard para no ganar nada; aceptar las dos
   * deja que cada pantalla mande lo que de verdad sabe.
   *
   * ⚠️ Sin `clave` el correo sale igual y queda huérfano (ver `lib/puente.ts`):
   * eso es correcto cuando NO hay conversación, y es un defecto cuando la hay
   * y no se pasó.
   */
  function mandarCorreoA(destino: string | DestinoCorreo) {
    const d = typeof destino === 'string' ? { para: destino } : destino;
    setPuente({ tipo: 'correo', para: d.para, clave: d.clave, nombre: d.nombre });
    cambiarVista('correos');
  }

  function agendarBienvenida(telefono: string | null) {
    setPuente({ tipo: 'agenda', telefono, nota: 'Bienvenida al curso' });
    cambiarVista('agenda');
  }

  const vistaActiva = VISTAS.find((v) => v.id === vista)!;
  const chatTapaLaLista = esMovil && abierta != null;
  const claseEntrada =
    'flex min-h-0 flex-1 flex-col duration-300 ease-house animate-in fade-in ' +
    (direccion === 'abajo' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1');

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* ── EL RIEL: ícono + nombre. Nadie navega adivinando. ──
          En el celular no se monta: a 390 px se comería un quinto del ancho, y
          ahí sólo existe Mensajes (ver `vistaElegida`). */}
      {!esMovil && (
      <nav
        aria-label="Vistas"
        className="flex w-[4.75rem] shrink-0 flex-col items-center border-r border-border bg-card pb-3 pt-9"
        style={ARRASTRABLE}
        data-tauri-drag-region
      >
        <div className="mb-3" title="Hermes · Goberna">
          <Escudo size={26} />
        </div>

        <div className="flex flex-col gap-1" style={NO_ARRASTRABLE}>
          {vistas.map((v, i) => {
            const Icono = v.icono;
            const activa = vista === v.id;
            return (
              <button
                key={v.id}
                type="button"
                data-vista={v.id}
                // De la décima en adelante no hay tecla, así que el tooltip no
                // la nombra: prometer un ⌘10 que no existe es peor que no decir
                // nada — se prueba una vez, no anda, y no se vuelve a confiar.
                title={i < TECLAS_DE_VISTA ? `${v.label} · ⌘${i + 1}` : v.label}
                onClick={() => cambiarVista(v.id)}
                className={
                  'relative flex w-[4.25rem] flex-col items-center gap-0.5 rounded-xl py-1.5 transition-[color,background-color,box-shadow,transform] duration-200 ease-house active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                  (activa
                    ? 'bg-navy text-white shadow-[0_4px_14px_-4px_rgba(14,42,82,0.55)]'
                    : 'text-muted-foreground hover:bg-secondary hover:text-navy-ink')
                }
              >
                <Icono size={17} strokeWidth={activa ? 2.2 : 1.8} />
                <span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">{v.label}</span>
                {/* `text-navy` y no `text-navy-ink`: es la única chapa de la app cuyo fondo
                    NO se apaga en el tema oscuro —el oro es señal de tiempo que se acaba, no
                    decoración—, así que su tinta tampoco se aclara. */}
                {v.id === 'agenda' && apuran > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 font-mono text-[11px] font-bold leading-none text-navy ring-2 ring-card">
                    {apuran}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* QUIÉN SOY. Era un `<span>` con un `title`: la única forma de saber
            con qué usuario estabas era esperar el tooltip del sistema. Con cinco
            vendedoras compartiendo una línea, «¿entré con el usuario que era?» y
            «¿por qué no veo mis leads?» son la misma pregunta, y no había dónde
            contestarla. El botón de salir se mudó adentro del panel: vivía suelto
            debajo del avatar, que es donde uno lo aprieta sin querer. */}
        <div className="mt-auto flex flex-col items-center gap-2" style={NO_ARRASTRABLE}>
          <PanelUsuario
            vendedora={vendedora}
            onSalir={salir}
            onPerfilActualizado={reintentar}
            cerberusVivo={cerberusVivo}
            actividad={actividad}
          />
        </div>
      </nav>
      )}

      {/* ── EL CONTENIDO: barra fina arriba (título + línea de salud) y la vista ──
          `relative` y `--piso-movil` sólo con la píldora de campaña montada: ella
          se mide contra esta columna, y lo que scrollea adentro (la cola, las
          columnas del Pipeline) lee la variable para dejarle lugar abajo. Sin
          píldora la variable no existe y el padding cae a 0: la Escuela queda igual. */}
      <div
        className={'flex min-w-0 flex-1 flex-col' + (barraMovil ? ' relative' : '')}
        style={barraMovil ? ({ '--piso-movil': PISO_MOVIL } as CSSProperties) : undefined}
      >
        {esMovil ? (
          /* EN EL CELULAR, LA CABECERA ES LA DE UNA SOLA VISTA: el escudo,
             «Mensajes» y la cuenta, que sólo sirve para salir. Lo que la de
             escritorio lleva a la derecha —el tema, el bot, los semáforos— no
             entra: son lecturas de quien administra la mesa, no de quien
             contesta desde el teléfono, y cada chip es una consulta más.
             ⚠️ **El aviso de Cerberus SÍ entra**, y sólo cuando la sesión se
             cayó: es lo único de esa barra que bloquea plata —sin él, la
             vendedora registra una venta y no sabe por qué no queda—.
             🔴 **Y la ventana de escritorio también llega acá**: Tauri deja
             angostarla hasta 720 px (`src-tauri/tauri.conf.json`), así que entre
             720 y 767 esta es SU cabecera. Por eso lleva la región de arrastre y,
             adentro de Tauri, el `pt-8` que deja lugar a los semáforos de macOS
             (la barra de título es `Overlay`); en el navegador, el
             `safe-area-inset-top` es el notch de la PWA instalada. */
          <header
            className={
              'flex shrink-0 items-center gap-2.5 border-b border-border bg-card pb-2.5 pl-4 pr-3 ' +
              (enTauri() ? 'pt-8' : 'pt-[max(0.625rem,env(safe-area-inset-top))]')
            }
            style={ARRASTRABLE}
            data-tauri-drag-region
          >
            <Escudo size={24} />
            <TituloDeSeccion>{vistaActiva.label}</TituloDeSeccion>
            <div className="ml-auto flex items-center gap-2" style={NO_ARRASTRABLE}>
              {cerberusVivo === false && <AvisoCerberus usuario={vendedora.id} entrar={entrar} />}
              <MenuMovil vendedora={vendedora} onSalir={salir} />
            </div>
          </header>
        ) : (
        <header
          className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 pb-3 pt-8"
          style={ARRASTRABLE}
          data-tauri-drag-region
        >
          <TituloDeSeccion>{vistaActiva.label}</TituloDeSeccion>
          <div className="ml-auto flex items-center gap-2" style={NO_ARRASTRABLE}>
            {/* Claro u oscuro, para toda la app. Primero de la fila porque es lo
                único de esta barra que no informa de nada: las otras piezas son
                estado (¿el canal vive?, ¿la máquina contesta sola?) y el estado
                se lee de derecha a izquierda, pegado a su semáforo. */}
            <BotonDeTema />
            {/* Primero lo que le impide COBRAR: es lo único de esta barra que
                bloquea plata, así que va antes que la salud de los datos. */}
            {cerberusVivo === false && <AvisoCerberus usuario={vendedora.id} entrar={entrar} />}
            {/* El chip del BOT: «¿qué máquina le está escribiendo a mis leads
                ahora mismo?». Vuelve a pintarse a pedido — quedó oculto junto
                al resto de la barra (fix(header) 20-ago-2026) pero nunca dejó
                de estar montado ni de llamar a `/api/bot`. */}
            <InterruptorBot />
            {/* Ocultos a pedido (limpieza visual del header): siguen montados,
                con su estado y sus llamadas corriendo igual — solo no se
                pintan. `hidden` y no un `if`, para que sea un cambio de una
                línea por volver a mostrarlos.

                ⚠️ Con el chip de auto-respuesta adentro, al MODO REVISIÓN
                (ADR 0018) se entra SOLO con la tecla `a`: el renglón del chip
                era la otra puerta y ya no se puede tocar. */}
            <div className="hidden">
              <BarraFrescura />
              {/* El interruptor va PEGADO al semáforo de WhatsApp: los dos hablan
                  del estado del canal. Que la máquina esté contestando sola es
                  parte de la misma pregunta que «¿el número está vivo?» (#125). */}
              <InterruptorAutoRespuesta onRevisar={revision.entrar} />
              <EstadoWhatsapp />
            </div>
          </div>
        </header>
        )}

        {/* La Bandeja vive SIEMPRE montada: ocultarla no es desmontarla.

            EN MODO REVISIÓN (ADR 0018) es la MISMA mesa: cambia solo quién
            ocupa la columna izquierda —la fila de sugerencias en vez de la cola
            entera— y aparece un bloque de contexto arriba de la ficha. El
            centro no se toca: la conversación real es el punto. Por eso la
            revisión no es un modal: un modal tapa justamente lo que hay que
            mirar para poder decidir. */}
        <div className={vista === 'bandeja' ? (esMovil ? 'flex min-h-0 flex-1' : 'flex min-h-0 flex-1 gap-3 p-3') : 'hidden'}>
          {/* La lista de revisión pide MENOS ancho que la cola: no tiene
              búsqueda, ni tabs, ni chips de categoría — solo quién y cuánto
              hace que espera. Devolverle esos 80 px al chat importa a 1280,
              donde el panel derecho ya se lleva 22,5rem. */}
          {/*
            🔴 **EL RIEL DE CANALES YA NO VIVE ACÁ (07-sep-2026, pedido del
            dueño).** Vivía como columna fija, hermana de `<main>`, desde el
            4-sep-2026 — y ese mismo ancho fue lo primero que se sacrificó
            cuando el pedido nuevo fue meter Todos/WhatsApp/Facebook/… DENTRO
            del contenedor de la cola, flotando desde un botón, para
            devolverle a `<main>` la alineación de siempre contra la
            navegación. Ahora `ColaUnificada` lo dibuja ella misma (ver su
            docblock grande) — por eso `<main>` ya no tiene un hermano a la
            izquierda, y por eso ya no le hacía falta ninguna condición de
            `!revision.activo` acá: en revisión se monta `ColaRevision`, no
            `ColaUnificada`, así que el riel desaparece solo con ella.
          */}
          {/* ══ EN EL CELULAR, LA LISTA NO SE DESMONTA CUANDO SE ABRE UN CHAT ══
              Queda donde está, a pantalla completa, y el chat se dibuja ENCIMA
              (`fixed`, en la `<section>` de abajo). Desmontarla —o esconderla con
              `display: none`, que en Chrome tira el scroll a cero— haría que
              volver pierda el scroll, la búsqueda y las páginas de «Ver más»: la
              vendedora buscaría otra vez desde arriba a la persona siguiente.
              `inert` la saca del foco y del lector de pantalla mientras está tapada. */}
          <main
            inert={chatTapaLaLista}
            aria-hidden={chatTapaLaLista || undefined}
            className={esMovil ? 'min-h-0 min-w-0 flex-1' : 'min-h-0 shrink-0 ' + (revision.activo ? 'w-[20rem]' : 'w-[25rem]')}
          >
            {revision.activo ? (
              <ColaRevision
                grupos={revision.grupos}
                fila={revision.fila}
                actualId={revision.actualId}
                cargando={revision.cargando}
                error={revision.error}
                trabajando={revision.trabajando}
                recibo={revision.recibo}
                onElegir={revision.abrir}
                onDescartarTodo={revision.descartarTodo}
                onCerrarRecibo={revision.cerrarRecibo}
                onSalir={revision.salir}
              />
            ) : (
              <ColaUnificada
                seleccionada={abierta?.clave ?? null}
                onSeleccionar={abrirEnLaBandeja}
                conversacionAbierta={abierta}
                miVendedora={vendedora.id}
                esDeCampana={vendedora.esDeCampana}
                onIrAgenda={() => cambiarVista('agenda')}
                inputRef={busquedaRef}
              />
            )}
          </main>
          {/* EN EL CELULAR, EL CHAT VA A PANTALLA COMPLETA, ENCIMA DE LA LISTA.
              Es el MISMO `<section>` que en escritorio, sólo cambian sus clases:
              cruzar el corte con el chat abierto (girar el teléfono) no lo
              remonta ni se lleva el borrador. `hidden` —el atributo, no la
              clase— mientras no hay nadie abierto: el vacío de «Elige a alguien
              de la cola» es para la columna de escritorio, no para tapar la
              lista.
              ⚠️ **Esta caja sólo TAPA la lista y ANIMA la entrada; no le da alto
              ni márgenes al hilo.** Por debajo de `md` cada hilo es `fixed` por su
              cuenta y se mide contra `visualViewport` (el teclado de iOS no
              achica `100dvh`), con el `safe-area-inset-bottom` en su propio pie.
              Un padding de notch acá no le llegaría —un `fixed` ignora el padding
              del padre— y sólo engañaría a quien lo lea. El `slide-in` sí lo
              arrastra: mientras dura, la transformación vuelve a esta caja el
              marco de sus hijos `fixed`, y como es `inset-0` el marco sigue
              siendo la pantalla. */}
          <section
            hidden={esMovil && !abierta}
            className={
              esMovil
                ? 'fixed inset-0 z-40 flex flex-col bg-card duration-200 ease-house animate-in slide-in-from-right'
                : 'min-h-0 min-w-0 flex-1'
            }
          >
            <ConversacionActiva
              conversacion={abierta}
              onCerrar={cerrarConversacion}
              // La flecha de volver sólo en el celular: en escritorio la lista
              // está al lado y no hay a dónde volver.
              onVolver={esMovil ? cerrarConversacion : undefined}
              miVendedora={vendedora.id}
              senales={senales}
              /* «Abrir contacto» cuando el registro rápido detecta que esa
                 persona ya está en otra conversación. Se resuelve con la MISMA
                 fábrica que el + de la cola (`escribirA`), así que la clave la
                 arma un solo lugar; sin WhatsApp conectado no hay chat que
                 abrir y el botón no se dibuja. */
              onAbrirOtra={
                escribirA ? (o) => o.telefono && escribirA(o.telefono) : undefined
              }
              esDeCampana={vendedora.esDeCampana}
              sugerencia={
                revision.activo && revision.actual && revision.actual.clave === abierta?.clave
                  ? {
                      id: revision.actual.id,
                      texto: revision.actual.texto,
                      campana: revision.actual.campana,
                      paso: pasoDeRevision(revision.fila, revision.actualId),
                      trabajando: revision.trabajando,
                      onAprobar: (texto) => revision.aprobarIds([revision.actual!.id], texto),
                      onDescartar: () => revision.descartarIds([revision.actual!.id]),
                    }
                  : undefined
              }
            />
          </section>
          {/* En el celular la ficha no se monta: no hay ancho para una tercera
              columna, y montada detrás del chat pediría sus nueve consultas para
              nada. */}
          {!esMovil && abierta && (
            /* `relative` SOLO para anclar el trigger — no le agrega ningún
               estilo al contenido, es la envoltura mínima para poder poner el
               botón `absolute` sobre el borde sin que empuje nada adentro. */
            <div className="relative flex min-h-0 shrink-0">
              {/*
                EL TRIGGER, SOBRE EL BORDE DEL PANEL — no adentro de él ni
                arriba en el header. `absolute` + `-translate-x-1/2` lo saca
                del flujo por completo: nunca empuja ni angosta el contenido
                del panel (el pedido explícito), y por eso sigue en el MISMO
                lugar tanto contraído como expandido — es lo que lo hace
                encontrable para volver a abrir.

                ══ MISMO BOTÓN, MISMO ÍCONO, MISMA FLECHA QUE EL FILTRO DE
                CANALES DE MENSAJES (08-sep-2026, pedido del dueño) ══
                Antes era su propio círculo `border border-border bg-card`
                —blanco, sin peso, `size-6`— y dos íconos
                (`ChevronLeft`/`ChevronRight`) intercambiados a mano. Ahora
                usa `botonAzulClass` (`lib/styles.ts`, la MISMA cadena que el
                filtro de canal y «chat nuevo» de Mensajes, no una copia
                parecida) tal cual —`size-7` incluido, no un `size-6` propio:
                «los mismos efectos» pedía igualarlo, no acercarlo— y un solo
                `ChevronRight` que rota.

                ⚠️ **El sentido es AL REVÉS del filtro de canales, a propósito
                (corrección del mismo día, pedido del dueño)**: ahí «cerrado
                apunta a la derecha» porque el riel se acopla A LA IZQUIERDA
                del botón, así que la flecha señala hacia dónde está el
                contenido que se va a revelar. Acá el panel vive A LA DERECHA
                del botón, así que es la flecha en reposo (`ChevronRight`,
                SIN rotar) la que ya apunta hacia donde el panel se revela —
                oculto (`panelColapsado`) rota 180° y apunta a la IZQUIERDA en
                cambio, señalando hacia el chat: «esto está guardado de este
                lado». Dos paneles, cada flecha apunta hacia SU contenido, no
                hacia una convención fija de qué lado es «abrir».
              */}
              <button
                type="button"
                onClick={() => setPanelColapsado((c) => !c)}
                title={panelColapsado ? 'Mostrar la ficha del contacto' : 'Ocultar la ficha del contacto'}
                aria-label={panelColapsado ? 'Mostrar la ficha del contacto' : 'Ocultar la ficha del contacto'}
                aria-pressed={panelColapsado}
                className={
                  'absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                  botonAzulClass
                }
              >
                <ChevronRight
                  size={15}
                  aria-hidden="true"
                  className={'transition-transform duration-200 ' + (panelColapsado ? 'rotate-180' : '')}
                />
              </button>

              {/*
                ══ SIEMPRE MONTADO MIENTRAS DURA LA TRANSICIÓN, NO DE UN
                SALTO (corrección del mismo día, pedido del dueño: «se abre y
                se cierra muy de golpe») ══
                `panelMontado` decide si esto existe (`PanelDerecho` deja de
                pedir datos apenas la transición de cierre termina, ver el
                docblock grande de `panelMontado` más arriba); `panelExpandido`
                decide el ANCHO — las dos cosas por separado son lo que
                permite animar los dos sentidos con un componente que, a
                diferencia de `RielDeCanales`, sí cuesta mantener vivo.
                `inert`/`aria-hidden` mientras se achica: nada tabulable ni
                anunciado durante el medio segundo que dura el cierre.

                🔴 **`ease-house` SOLO EN EL CIERRE, NO EN LA APERTURA
                (corrección del mismo día: «se sigue abriendo abruptamente»,
                medido con capturas cuadro a cuadro)** — misma duración
                (240 ms) que el riel de canales, y aun así se veía distinto:
                `ease-house` (`cubic-bezier(0.32, 0.72, 0, 1)`) llega al 72 %
                del recorrido al 32 % del tiempo, y en 72px (el riel) eso pasa
                inadvertido — en 360px (este panel) son ~260px de golpe en
                los primeros 40 ms y el resto del medio segundo casi sin
                movimiento: el ojo lo lee como un salto con un temblor al
                final, no como un despliegue. Cerrando, la misma curva SÍ se
                sintió bien (confirmado, pedido del dueño): un cierre que
                arranca rápido lee como «se guardó», no como «se rompió» — es
                la asimetría de percepción entre abrir y cerrar, no un
                defecto de la curva. Por eso la curva depende de
                `panelExpandido`: abriendo usa `ease-in-out`
                (`cubic-bezier(0.4,0,0.2,1)`, el estándar parejo — reparte el
                recorrido a lo largo de TODO el medio segundo), cerrando
                sigue con `ease-house`.

                🔴 **Y la duración TAMBIÉN es asimétrica (corrección del mismo
                día: «casi lo siento igual, mejora los tiempos»)** — con la
                curva corregida, 240 ms en las dos direcciones seguía leyéndose
                parecido: es la MISMA asimetría de percepción de arriba,
                aplicada a la duración y no sólo a la forma de la curva. Abrir
                es «algo está llegando» y tolera —pide— más tiempo para leerse
                como un despliegue; cerrar es «esto se guarda» y un tramo
                corto es justo lo que lo hace sentir resuelto, no lento. Por
                eso 380 ms al abrir (bien por encima de los 240 ms del riel de
                canales, a propósito: éste es 5× más ancho) y 220 ms al
                cerrar. `panelMontado` (más arriba) desmonta a los 220 ms —
                atado al cierre, que es la única dirección que de verdad
                necesita el temporizador.
              */}
              {panelMontado && (
                <div
                  inert={!panelExpandido}
                  aria-hidden={!panelExpandido}
                  className={
                    'flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,opacity] ' +
                    (panelExpandido ? 'duration-[380ms] opacity-100 ease-in-out' : 'duration-[220ms] opacity-0 ease-house')
                  }
                  style={{ width: panelExpandido ? '22.5rem' : 0 }}
                >
                  {/* 22.5rem = 360 px: el ancho para el que está diseñado el panel
                      multifunción (antes 18rem, que solo daba para la ficha). Fijo
                      acá adentro (no en el wrapper de arriba, que es el que anima):
                      es lo que deja que el `overflow-hidden` de afuera recorte el
                      contenido en vez de que el contenido se achique con él. */}
                  <aside className="flex h-full min-h-0 w-[22.5rem] shrink-0 flex-col gap-3">
                    {/* EL PORQUÉ DE LA SUGERENCIA, arriba del panel y no en vez de él:
                        «por qué se sugiere esto» y «quién es esta persona» son dos
                        preguntas y se contestan las dos. Bloque aparte a propósito —
                        el panel multifunción (ADR 0017) es de otro frente y este
                        cambio no toca ninguno de sus archivos. Cuando convenga, esto
                        se vuelve una pestaña suya: el contenido ya está aislado y no
                        depende de dónde se monte.

                        Solo aparece en revisión, así que fuera del modo el panel
                        ocupa la columna entera como siempre. */}
                    {revision.activo && revision.actual && revision.actual.clave === abierta.clave && (
                      <PorQueEstaSugerencia sugerencia={revision.actual} limites={limitesAuto} />
                    )}
                    {/* El panel se queda con lo que sobra y scrollea adentro, como
                        siempre: el bloque del porqué es `shrink-0` y él `flex-1`. Sin
                        esto, apilarlos dejaba al de abajo aplastado a media frase. */}
                    <div className="min-h-0 flex-1">
                      {/* `miVendedora` viaja como prop y no llamando a `useSesion()`
                          adentro: ese hook hace su propio `fetch` a `/api/auth/yo`
                          al montar (no es react-query), así que ahí abajo sería un
                          request más por cada conversación que se abre. Lo necesita
                          el timeline para saber cuáles eventos puedes editar. */}
                      <PanelDerecho
                        conversacion={abierta}
                        miVendedora={vendedora.id}
                        esDeCampana={vendedora.esDeCampana}
                        onMandarCorreo={mandarCorreoA}
                        senalNotas={senales.notas}
                      />
                    </div>
                  </aside>
                </div>
              )}
            </div>
          )}
        </div>

        {vista !== 'bandeja' && (
          <div key={vista} className={claseEntrada}>
            {/* UNA sola frontera perezosa para las ocho vistas conmutadas. El
                fallback es NEUTRO a propósito: cada vista tiene su anatomía
                (tablero, calendario, tres columnas) y dibujar una sola haría
                parpadear a las otras siete con la forma equivocada. La Libreta
                conserva su Suspense propio —anidado, gana el más interno— porque
                el suyo SÍ dibuja su anatomía y son 269 KB de editor los que se
                esperan. */}
            <Suspense fallback={<div className="min-h-0 flex-1" aria-busy="true" />}>
            {vista === 'dashboard' && (
              <VistaDashboard
                esDeCampana={vendedora.esDeCampana}
                // Cada cifra de «Hoy» abre el Pipeline con su recorte (ADR 0104):
                // el puente lo consume `VistaEmbudo` y lo limpia al usarlo.
                onAbrirPipeline={(p) => {
                  setPuente(p);
                  cambiarVista('embudo');
                }}
              />
            )}
            {/* El drop en Cierre/Cotizados abre su modal DENTRO del Pipeline (#60);
                acá solo se cablea la salida del recibo (agendar la bienvenida). */}
            {vista === 'embudo' && (
              <VistaEmbudo
                onAbrir={abrirConversacion}
                onAgendarBienvenida={agendarBienvenida}
                onEscribir={escribirA}
                miVendedora={vendedora.id}
                esDeCampana={vendedora.esDeCampana}
                // La hoja del Pipeline es el MISMO `PanelDerecho` que Mensajes:
                // sin este cable, «Escribirle» aparecería en una pantalla y no
                // en la otra sobre la misma ficha.
                onMandarCorreo={mandarCorreoA}
                // El puente desde el Dashboard (ADR 0104): cada cifra de «Hoy»
                // abre el Pipeline ya recortado; la vista lo aplica y lo limpia.
                recorteInicial={puente?.tipo === 'pipeline' ? puente : null}
                onConsumido={() => setPuente(null)}
              />
            )}
            {vista === 'agenda' && (
              <VistaAgenda
                onAbrir={abrirConversacion}
                crearInicial={crearInicialAgenda}
                onCrearInicialUsado={() => setPuente(null)}
              />
            )}
            {/* 🔴 **UNA ENTRADA DEL RIEL, DOS VISTAS, y no es un `if` de estilo.**
                En ventas, «Contactos» es el padrón de icarus + el buscador de
                Cerberus: superficies de `ventas` que en campaña son 403. En
                campaña es la libreta que el equipo registró desde el chat, que
                es su única base de datos. Montar la de ventas del otro lado
                llenaría la pantalla de errores; esconder la vista entera —lo que
                se hacía hasta el 23-ago-2026— le saca al comando el directorio
                que sí tiene. */}
            {vista === 'personas' &&
              (vendedora.esDeCampana ? (
                <VistaContactosCampana onEscribir={escribirA} />
              ) : (
                <VistaPersonas
                  onEscribir={escribirA}
                  miVendedora={vendedora.id}
                  // Baja hasta la `HojaContacto` del padrón: la tercera pantalla
                  // donde vive la misma ficha (ADR 0035).
                  onMandarCorreo={mandarCorreoA}
                />
              ))}
            {vista === 'entrenamiento' && <VistaEntrenamiento />}
            {/* 🔴 `tapado` NO es cosmética: el navegador es un webview hijo, o
                sea una capa del SISTEMA OPERATIVO encima del DOM (ADR 0043), y
                mientras está a la vista tapa cualquier cosa de Hermes que caiga
                en su rectángulo. La cabina es la capa que se puede abrir
                estando en esta vista, así que es la que lo esconde (Ivi era la
                otra hasta ADR 0076). **Una capa nueva sobre la mesa se suma acá**; el
                síntoma de olvidarse es inconfundible (aparece detrás del
                navegador), y por eso no hay un registro global que pueda
                desincronizarse en silencio. */}
            {vista === 'navegador' && <VistaNavegador tapado={cabina || hayLlamadaALaVista} />}
            {/* Su propio Suspense: si compartiera el de las vistas, cargar la barra mostraría el esqueleto de la vista. */}
            <Suspense fallback={null}>
              <BarraDeLlamada />
            </Suspense>
            {vista === 'productos' && <VistaProductos />}
            {vista === 'llamadas' && <VistaLlamadas miVendedoraId={vendedora.id} />}
            {/* Vacía a propósito (ver su archivo). Quién la ve se decide en el
                riel, no acá: esto renderiza si el estado dice `routing`, y a ese
                estado solo se llega desde un botón que existe para dos personas. */}
            {vista === 'routing' && <VistaRouting />}
            {/* El fallback dibuja la anatomía de la vista (lista + página) en vez
                de un texto: lo que se está esperando son 269 KB de editor, y un
                cartel de «cargando» donde después va a haber una hoja hace
                parpadear la pantalla dos veces. */}
            {vista === 'libreta' && (
              <Suspense
                fallback={
                  <div className="flex min-h-0 flex-1">
                    <div className="hidden w-[19rem] shrink-0 border-r border-border p-3 md:block">
                      <div className="h-9 animate-pulse rounded-lg bg-muted" />
                    </div>
                    <div className="min-h-0 flex-1 px-6 py-8">
                      <div className="mx-auto h-40 max-w-3xl animate-pulse rounded-lg bg-muted" />
                    </div>
                  </div>
                }
              >
                {/* `vendedoraId` viaja como prop por lo mismo que `miVendedora`
                    en el panel: `useSesion()` hace su propio fetch al montar.
                    Lo necesita el selector de espacios para saber cuáles puedes
                    administrar (ADR 0046). */}
                <Libreta vendedoraId={vendedora.id} />
              </Suspense>
            )}

            {/* El puente lleva TRES cosas y no una: el correo prellena el Para,
                la `clave` es lo que ata el correo a su conversación (sin ella
                queda huérfano — ver `lib/puente.ts`) y el nombre es solo para
                saludar. Las tres se leen del MISMO objeto y se limpian juntas
                con `onConsumido`: si el shell limpiara antes de que la vista
                las lea, se perdería la clave y el correo saldría sin origen. */}
            {vista === 'correos' && (
              <VistaCorreos
                correoInicial={puente?.tipo === 'correo' ? puente.para : null}
                claveInicial={puente?.tipo === 'correo' ? (puente.clave ?? null) : null}
                nombreInicial={puente?.tipo === 'correo' ? (puente.nombre ?? null) : null}
                onConsumido={() => setPuente(null)}
              />
            )}
            </Suspense>
          </div>
        )}

        {/* ══ LA PÍLDORA DE ABAJO DEL CELULAR, SÓLO PARA CAMPAÑA (ADR 0113) ══
            Flota sobre esta columna (`absolute`), y lo que scrollea le deja
            lugar por `--piso-movil` (arriba). `hidden` —el atributo— mientras
            un chat tapa la lista: el chat es `fixed` y la cubriría igual, pero
            sin esto seguiría en el orden de foco y en el lector de pantalla. */}
        {barraMovil && (
          <BarraDeNavegacionMovil
            activa={vista === 'embudo' ? 'embudo' : 'bandeja'}
            onElegir={cambiarVista}
            hidden={chatTapaLaLista}
          />
        )}
      </div>

      {cabina && <Cabina onCerrar={() => setCabina(false)} enRevision={revision.activo} atajos={atajosDe(vistas)} />}
      {paleta && (
        <PaletaAcciones
          onCerrar={() => setPaleta(false)}
          acciones={accionesRapidas}
        />
      )}
      {escribirPendiente && (
        <ElegirLinea
          telefono={escribirPendiente}
          lineas={lineas}
          onElegir={(numeroPropio) => {
            abrirConversacion(
              conversacionDeTelefono({ telefono: escribirPendiente, numeroPropio }),
            );
            setEscribirPendiente(null);
          }}
          onCerrar={() => setEscribirPendiente(null)}
        />
      )}

      {/* El acuse de lo que se acaba de hacer. Se monta UNA vez, al final: es lo
          único que puede aparecer sobre cualquier vista. */}
      <Avisos />
    </div>
  );
}
