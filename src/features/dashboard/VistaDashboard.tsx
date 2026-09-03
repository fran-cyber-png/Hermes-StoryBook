import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, MessageSquareText, Search, X } from 'lucide-react';
import { hace } from '../../lib/datos/frescura';
import { iniciales } from '../../lib/iniciales';
import { useSelloDeViejo } from '../../lib/datos/useSelloDeViejo';
import { SelloDeAntes } from '../../components/SelloDeAntes';
import { horasDesde, tempBorde, tempClass } from '../../lib/formato';
import { kicker, sectionLabel } from '../../lib/styles';
import { ETAPA_CHIP, colorSegmento, ordenDelEmbudo, rotuloEtapa, totalDelEmbudo } from '../../lib/etapas';
import { kpisDe, panelesDe } from './kpis';
import { Columnas } from '../../components/graficos/Columnas';
import { BarraSegmentada } from '../../components/graficos/BarraSegmentada';
import { Chispa } from '../../components/graficos/Chispa';
import { BadgeCanal, nombreCanal } from '../../components/BadgeCanal';
import { ESPACIO_HOJA, HojaContacto } from '../panel/HojaContacto';
import type { DestinoCorreo } from '../../lib/puente';
import type { Conversacion } from '../../dominio/conversaciones';
import { conversacionDeRecordatorio, useAgenda, type Recordatorio } from '../agenda/agenda';
import { conversacionDeTelefono } from '../../dominio/conversacionNueva';
import { useSesionWa } from '../whatsapp/conversacionWa';
import {
  conversacionDeChat,
  paisDe,
  esDeuda,
  useDashboard,
  type LeadChat,
  type LeadFormulario,
} from './dashboard';
import { textoDePreview } from '../../lib/preview';
import { marcaDeFila, TINTA_MARCA } from './marca';
import { useNegocio } from './negocio';
import { FiltrosNegocio, PanelNegocio, type FiltrosNegocioState } from './PanelNegocio';
import { useCampana } from './campana';
import { PanelCampana } from './PanelCampana';
import { BotonLlamar } from '../gestion/BotonLlamar';
import { PasarConversacion } from '../reparto/PasarConversacion';

/**
 * EL DASHBOARD — DOS LECTURAS de la misma mesa, en un conmutador (#128, #126).
 *
 * · **Mi turno** — el radar de la vendedora: «¿a quién atiendo ahora?». Es lo
 *   que sigue abajo y es el default: quien abre Hermes casi siempre viene a eso.
 * · **El negocio** — la del que pone la plata: «¿qué curso se está vendiendo,
 *   cuál estoy dejando pasar, y en qué anuncio conviene invertir?»
 *   (`PanelNegocio.tsx`).
 *
 * Son dos pantallas y no dos mitades de una porque son dos personas con dos
 * ritmos, y esta app NO scrollea: apiladas, ninguna de las dos se lee. La BANDA
 * de arriba es la bisagra — mantiene el conmutador siempre en el mismo lugar y
 * NO cambia de altura al conmutar (h-16 fija): a la izquierda el conmutador, a
 * la derecha lo que cada lectura necesita — el titular y la agenda en «Mi
 * turno», la fila de filtros en «El negocio». Cero salto de layout.
 *
 * ─── MI TURNO ──────────────────────────────────────────────────────────────
 * Orden vertical = orden de urgencia:
 *   A · TU MAÑANA (banda fija h-16): abre con EL TITULAR — la cifra héroe de
 *       calientes calculada sobre la MISMA unión chats+formularios que el
 *       filtro «Solo calientes» — más tu deuda de Agenda y el ÚNICO botón
 *       primario de la vista: "Atender a {nombre} →".
 *   B · EL RADAR (flex-1, scroll interno): los leads cayendo, filas de 2
 *       líneas. Canon de listas: banda izquierda = TEMPERATURA (tempBorde);
 *       la relevancia alta se marca con el punto dorado, no con la banda.
 *   C · EL RIEL (w-80): Embudo → Los últimos 14 días → Qué piden → Equipo.
 *       Las gráficas hablan en voz de imprenta y no compiten con el titular.
 *
 * La página NUNCA scrollea (solo radar y riel, por adentro). El oro significa
 * tiempo que se acaba: punto de calientes, pills de hoy, ventanita 20–24h.
 * Vencido es rojo: oro = se acaba; rojo = ya se acabó.
 */

/**
 * LO QUE DURA EL VAIVÉN DE LA HOJA — los mismos 240 ms de `--animate-entrar`
 * (`index.css`), que es la única física de movimiento de la casa. Está acá en
 * JS porque el desmontaje tiene que esperar a que la transición termine, y un
 * `transitionend` no sirve: con `prefers-reduced-motion` no llega nunca.
 */
const MS_HOJA = 240;

const FUENTES = [
  { id: '', label: 'Todo' },
  { id: 'chat', label: 'Chats' },
  { id: 'comentario', label: 'Comentarios' },
  { id: 'landing', label: 'Landings' },
  { id: 'lead-ad', label: 'Lead Ads' },
] as const;

type Fila = { fuente: 'chat' | 'comentario'; chat: LeadChat } | { fuente: 'landing' | 'lead-ad'; form: LeadFormulario };
/** La fila con la clave de urgencia que mandó el server. El front la aplica, no la calcula. */
type FilaConClave = Fila & { nivel: number; orden: number };

/** Anchos variados para el skeleton del radar: anatomía real de 2 líneas. */
const SKELETON_RADAR = [
  ['w-2/5', 'w-3/5'],
  ['w-3/5', 'w-1/3'],
  ['w-1/3', 'w-2/5'],
  ['w-2/5', 'w-1/3'],
  ['w-3/5', 'w-2/5'],
  ['w-1/3', 'w-3/5'],
  ['w-2/5', 'w-3/5'],
  ['w-3/5', 'w-1/3'],
  ['w-1/3', 'w-2/5'],
] as const;

/** Columnas fantasma (alturas %) para el skeleton de la gráfica de 14 días. */
const SKELETON_COLUMNAS = [40, 65, 30, 75, 50, 25, 60, 45, 80, 35, 55, 70, 30, 60] as const;

export function VistaDashboard({
  onAbrir,
  onBuscarPersona,
  onIrAgenda,
  miVendedora,
  esDeCampana,
  onMandarCorreo,
}: {
  onAbrir: (c: Conversacion) => void;
  onBuscarPersona: (telefono: string) => void;
  onIrAgenda: () => void;
  miVendedora: string;
  /**
   * ¿Quien mira trabaja en el módulo de CAMPAÑAS? Baja hasta `PanelDerecho`,
   * que apaga con esto las tres consultas que van contra Cerberus (`modulos/
   * modulo.ts`). Opcional: sin él se comporta como el panel de siempre.
   */
  esDeCampana?: boolean;
  /**
   * Puente a Correos (§2.9): prellena el Para.
   *
   * ⚠️ **Acepta el correo suelto O el destino completo, y las dos formas se
   * usan acá adentro.** La fila del radar solo tiene el correo del formulario
   * (no hay conversación de la cual sacar una `clave`), y la `HojaContacto`
   * sí la tiene. Estrechar esto a `(para: string)` volvería a dejar sin origen
   * a todo correo que salga de la ficha — que es el defecto que se está
   * arreglando (ver `lib/puente.ts`).
   */
  onMandarCorreo?: (destino: string | DestinoCorreo) => void;
}) {
  /**
   * LA FICHA AL COSTADO, TAMBIÉN ACÁ (ADR 0037, PR #292).
   *
   * El radar contesta «¿a quién atiendo?», y la pregunta que sigue —«¿quién es
   * esta persona?»— se contestaba yéndose a Mensajes: se perdía el radar y había
   * que volver. Es el mismo problema que la hoja ya cerró en Pipeline y en el
   * padrón, y no había motivo para que el Dashboard fuera la excepción.
   */
  const [ficha, setFicha] = useState<Conversacion | null>(null);
  /**
   * LA HOJA QUE SE ESTÁ YENDO — y por qué el cierre necesita un estado propio.
   *
   * Acá la hoja **empuja** (ver abajo, «la ficha al costado»): el tablero le
   * reserva el hueco y lo recupera con una transición. Desmontarla en el mismo
   * frame en que arranca esa transición deja el cierre a media película — el
   * panel desaparece de golpe y lo único que se mueve es el contenido
   * ensanchándose contra un vacío. Se la deja montada mientras dura el vaivén y
   * recién después se desmonta.
   *
   * ⚠️ **Montada de más, sale caro de dos formas, y las dos ya mordieron acá.**
   * El Escape: `useEscape` registra en CAPTURA sobre `window` y se come la tecla
   * de TODA la app mientras exista (ADR 0024) — por eso viaja `escapeActivo` en
   * `false` durante el cierre, que es exactamente para lo que esa prop existe.
   * Y las consultas: `PanelDerecho` pide la ficha de Cerberus, las señales y el
   * timeline, así que dejarla viva sería refrescar a alguien que ya nadie mira
   * (la lección de `dashboardFueraDeLaRaiz.test.ts`, en chico).
   */
  const [saliendo, setSaliendo] = useState<Conversacion | null>(null);
  useEffect(() => {
    if (!saliendo) return;
    const t = window.setTimeout(() => setSaliendo(null), MS_HOJA);
    return () => window.clearTimeout(t);
  }, [saliendo]);
  /** La abierta manda; la que se va sólo se dibuja mientras no haya otra. */
  const fichaEnPantalla = ficha ?? saliendo;
  const cerrarFicha = () => {
    setSaliendo(ficha);
    setFicha(null);
  };

  // Renombrados como en la cola (`conversaciones.ts`): el vocabulario de
  // react-query no cruza hacia las vistas.
  // `vivo`: ÉSTA es la pantalla que se queda mirando el radar, así que es la
  // única que lo refresca sola. Las otras dos consumidoras lo leen y se cierran.
  const { data, isPending, dataUpdatedAt: traidoEn, isFetching: actualizando } = useDashboard({
    vivo: true,
  });
  // Al abrir la app el radar viene del caché persistido. Mientras eso sea lo que
  // se ve, «en vivo» sería mentira: el sello dice de cuándo es hasta que llega
  // lo fresco (ver `lib/datos/persistencia.ts`).
  const deAntes = useSelloDeViejo(traidoEn);
  const { agenda } = useAgenda();
  const [fuente, setFuente] = useState<(typeof FUENTES)[number]['id']>('');
  /**
   * La línea propia para la clave de una ficha SIN hilo (un lead de formulario).
   * Sin WhatsApp conectado queda `null` y la ficha se abre igual — el porqué
   * está escrito en `conversacionDeTelefono`. Mismo uso que en el padrón.
   */
  const { data: sesionWa } = useSesionWa();
  const miLinea = sesionWa?.estado === 'conectado' ? sesionWa.telefono : null;
  const [etapaFiltro, setEtapaFiltro] = useState<string | null>(null);
  const [soloCalientes, setSoloCalientes] = useState(false);
  const [periodo, setPeriodo] = useState<'hoy' | '7d'>('hoy');
  const [correoCopiado, setCorreoCopiado] = useState<string | null>(null);

  // ── Las lecturas. El default es el radar: quien abre Hermes viene a atender. ──
  const [lectura, setLectura] = useState<'turno' | 'negocio' | 'campana'>('turno');
  const [filtros, setFiltros] = useState<FiltrosNegocioState>({ periodo: '7d', numero: null, dimension: 'curso' });

  /**
   * DE QUIÉN ES ESTE DASHBOARD (5-ago-2026). Lo decide el SERVER y viaja en la
   * respuesta: acá no hay lista de supervisores ni recorte propio — un recorte
   * hecho en el navegador sería cosmético, los datos ya viajaron.
   *
   * ⚠️ **`?? true` y no `?? false`.** El campo falta en dos casos reales: un
   * server viejo, y una respuesta rehidratada del caché de IndexedDB (ADR 0007).
   * Con `false` por default, «El negocio» desaparecería **para todos, incluido
   * el supervisor**, en la ventana entre el deploy del front (N4, sin restart) y
   * el del server (N5, a botón). Ausente = como era antes.
   */
  /**
   * 🔴 **Y NUNCA para el módulo de campaña, aunque sea supervisor.** Hasta acá
   * esto salía sólo de `supervisor`, así que el supervisor de un comando de
   * campaña veía el conmutador, apretaba «El negocio» y comía el 403 de
   * `/api/dashboard/negocio`, que es superficie de `ventas` (ADR 0063). El
   * candado del server estaba bien; lo que faltaba era que la pantalla no
   * ofreciera una puerta que ya sabía cerrada.
   */
  const puedeVerNegocio = !esDeCampana && (data?.supervisor ?? true);
  /**
   * LA LECTURA PROPIA DE LA CAMPAÑA. Sale del token (`esDeCampana`), la misma
   * fuente que apaga las consultas de Cerberus en `PanelDerecho` — no de una
   * segunda pregunta que mañana conteste distinto (#37).
   */
  const puedeVerCampana = esDeCampana === true;
  /** El server sirvió SOLO lo asignado a quien mira. Lo que explica los huecos. */
  const soloMisAsignadas = data?.soloMisAsignadas ?? false;
  const negocio = useNegocio({ ...filtros, activo: lectura === 'negocio' && puedeVerNegocio });
  const campana = useCampana({ periodo: filtros.periodo, activo: lectura === 'campana' && puedeVerCampana });

  // Si estaba en una lectura que la respuesta dice que no le toca, vuelve al radar.
  // Pasa de verdad: el caché persistido pinta la pantalla antes de que llegue lo
  // fresco, así que la primera respuesta del server puede cambiar la respuesta.
  const lecturaEfectiva =
    (lectura === 'negocio' && !puedeVerNegocio) || (lectura === 'campana' && !puedeVerCampana)
      ? 'turno'
      : lectura;

  /**
   * LAS LECTURAS QUE ESTA PERSONA TIENE. El conmutador se DERIVA de esta lista y
   * no de un `if` por opción: con dos fuentes, agregar una cuarta lectura deja
   * un botón que no aparece o un panel que no se puede abrir.
   */
  const lecturas = [
    ['turno', 'Mi turno'] as const,
    ...(puedeVerNegocio ? [['negocio', 'El negocio'] as const] : []),
    ...(puedeVerCampana ? [['campana', 'La campaña'] as const] : []),
  ];

  // ── A · Tu mañana: la deuda personal, de la Agenda ya cargada. ──
  const { vencidas, deHoy } = useMemo(() => {
    const rs = agenda.data?.recordatorios ?? [];
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date(inicioHoy.getTime() + 86_400_000);
    return {
      vencidas: rs.filter((r) => r.estado === 'pendiente' && new Date(r.cuando) < inicioHoy),
      deHoy: rs.filter((r) => {
        const d = new Date(r.cuando);
        return r.estado === 'pendiente' && d >= inicioHoy && d < finHoy;
      }),
    };
  }, [agenda.data]);
  const pills: { r: Recordatorio; vencida: boolean }[] = [
    ...vencidas.map((r) => ({ r, vencida: true })),
    ...deHoy.map((r) => ({ r, vencida: false })),
  ].slice(0, 3);
  const masEnAgenda = vencidas.length + deHoy.length - pills.length;

  // ── El titular de las 9am: calientes sobre la MISMA unión que el filtro. ──
  const { nCalientes, masViejaHoras } = useMemo(() => {
    const bases = [
      ...(data?.chats ?? []).map((c) => ({ nivel: c.nivel, cayo_at: c.cayo_at })),
      ...(data?.formularios ?? []).map((f) => ({ nivel: f.nivel, cayo_at: f.cayo_at })),
    ];
    const esperan = bases.filter((b) => esDeuda(b.nivel));
    let masVieja: number | null = null;
    for (const c of esperan) {
      const t = new Date(c.cayo_at).getTime();
      if (masVieja === null || t < masVieja) masVieja = t;
    }
    return {
      nCalientes: esperan.length,
      masViejaHoras: masVieja === null ? null : horasDesde(masVieja),
    };
  }, [data]);

  // ── B · Las filas del radar, con todos los filtros aplicados. ──
  const { filas, totalFiltradas } = useMemo(() => {
    if (!data) return { filas: [] as FilaConClave[], totalFiltradas: 0 };
    const todas: FilaConClave[] = [
      ...data.chats.map((c) => ({ fuente: c.fuente, chat: c, nivel: c.nivel, orden: c.orden }) as FilaConClave),
      ...data.formularios.map((f) => ({ fuente: f.fuente, form: f, nivel: f.nivel, orden: f.orden }) as FilaConClave),
    ];
    const filtradas = todas
      .filter((f) => !fuente || f.fuente === fuente)
      .filter((f) => {
        if (!etapaFiltro) return true;
        const clave = 'chat' in f ? f.chat.clave : f.form.clave;
        const etapa = data.etapas[clave] ?? ('chat' in f ? 'interesado' : f.form.estado_lead === 'nuevo' ? 'interesado' : f.form.estado_lead);
        return etapa === etapaFiltro;
      })
      .filter((f) => !soloCalientes || esDeuda(f.nivel))
      // Esto NO es un criterio del front: es la clave que mandó el server,
      // aplicada tal cual para poder mezclar las dos listas en una. El orden lo
      // decide cola/urgencia.ts, del otro lado.
      .sort((a, b) => a.nivel - b.nivel || a.orden - b.orden);
    return { filas: filtradas.slice(0, 80), totalFiltradas: filtradas.length };
  }, [data, fuente, etapaFiltro, soloCalientes]);

  // El gatillo de "Atender a {nombre} →". Ya NO elige por su cuenta: toma la
  // primera conversación en Deuda de la lista que el server mandó ordenada. Lo
  // que el titular recomienda y lo que está arriba son la misma fila, por
  // construcción — antes eran dos criterios opuestos y se contradecían.
  const atender = useMemo(() => data?.chats.find((c) => esDeuda(c.nivel)) ?? null, [data]);

  // ── El radar que se siente radar: solo las filas NUEVAS del SSE se animan. ──
  const vistosRef = useRef<Set<string> | null>(null);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const claves = [...data.chats, ...data.formularios].map((x) => x.clave);
    if (vistosRef.current === null) {
      // Primera carga: nada se anima — nuevo es solo lo que llega DESPUÉS.
      vistosRef.current = new Set(claves);
      return;
    }
    const vistos = vistosRef.current;
    const recien = claves.filter((c) => !vistos.has(c));
    if (recien.length === 0) return;
    for (const c of recien) vistos.add(c);
    setNuevas((prev) => new Set([...prev, ...recien]));
    window.setTimeout(() => {
      setNuevas((prev) => {
        const s = new Set(prev);
        for (const c of recien) s.delete(c);
        return s;
      });
    }, 2000);
  }, [data]);

  // "últ. hace X" por fuente, para los pills (¿fuente muerta? se ve acá).
  const ultimaPor = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of data?.chats ?? []) m[c.fuente] = Math.max(m[c.fuente] ?? 0, new Date(c.cayo_at).getTime());
    for (const f of data?.formularios ?? []) m[f.fuente] = Math.max(m[f.fuente] ?? 0, new Date(f.cayo_at).getTime());
    return m;
  }, [data]);

  const countPor = (id: string) =>
    !data ? 0 : id === '' ? data.chats.length + data.formularios.length : [...data.chats, ...data.formularios].filter((x) => x.fuente === id).length;

  /**
   * Con el Dashboard personal, los chips de lo que NO tiene dueño no se dibujan.
   *
   * Un lead de formulario y un comentario de FB/IG no se reparten —el reparto
   * asigna conversaciones, y su clave es `int:<id>`— así que para quien ve solo
   * lo suyo esos chips serían ceros permanentes: tres botones que no filtran
   * nada y que se leen como «hoy no cayó ninguno», que es distinto de «esto no
   * te toca». El mismo criterio de los chips del bot: se dibujan donde tienen
   * algo que decir.
   */
  const fuentesVisibles = soloMisAsignadas
    ? FUENTES.filter((f) => f.id === '' || f.id === 'chat')
    : FUENTES;

  // El total y los segmentos salen de las CLAVES QUE EL SERVER MANDÓ, nunca
  // de una lista fija del front (issue #329): `ETAPAS` excluye `sin_respuesta`
  // a propósito, y ésta es la etapa más grande del embudo (65 %) — iterar
  // `ETAPAS` acá es exactamente el bug que omitía 2.576 conversaciones.
  const etapasEmbudo = useMemo(() => ordenDelEmbudo(Object.keys(data?.embudo ?? {})), [data]);
  // La banda de arriba. Del MISMO embudo que la barra de abajo, así que los
  // números de la pantalla no se pueden contradecir entre sí (`dashboard/kpis.ts`).
  const kpis = useMemo(() => kpisDe(data?.embudo, esDeCampana), [data, esDeCampana]);
  const totalEmbudo = totalDelEmbudo(data?.embudo);
  const maxCurso = Math.max(1, ...(data?.cursos ?? []).map((c) => c.n));

  // ── Los últimos 14 días: la serie de leads en voz de imprenta. ──
  const { puntosLeads, resumenLeads } = useMemo(() => {
    const serie = data?.series?.leads_dia ?? [];
    const puntos = serie.map((d) => {
      const total = d.chats + d.comentarios + d.formularios;
      const partes = [
        d.chats > 0 ? `${d.chats} ${d.chats === 1 ? 'chat' : 'chats'}` : null,
        d.comentarios > 0 ? `${d.comentarios} ${d.comentarios === 1 ? 'comentario' : 'comentarios'}` : null,
        d.formularios > 0 ? `${d.formularios} ${d.formularios === 1 ? 'formulario' : 'formularios'}` : null,
      ].filter((p): p is string => p !== null);
      return { dia: d.dia, total, detalle: partes.length > 0 ? partes.join(' · ') : undefined };
    });
    const suma = (ps: typeof puntos) => ps.reduce((n, p) => n + p.total, 0);
    return {
      puntosLeads: puntos,
      resumenLeads: `Esta semana cayeron ${suma(puntos.slice(-7))}; la pasada, ${suma(puntos.slice(-14, -7))}.`,
    };
  }, [data]);

  const enviosValores = (data?.series?.envios_dia ?? []).map((d) => d.n);

  const equipo = useMemo(() => {
    const lista = [...(data?.porVendedora ?? [])];
    lista.sort((a, b) => (a.vendedora === miVendedora ? -1 : b.vendedora === miVendedora ? 1 : 0));
    return lista;
  }, [data, miVendedora]);

  // El server ya apartó lo que firma el software (`dashboard/equipo.ts`). Un
  // server viejo —o una respuesta rehidratada del caché de IndexedDB, ADR 0007—
  // no manda el campo: `undefined` y el renglón no se dibuja, que es exactamente
  // el comportamiento de antes.
  const automaticos = data?.automaticos ?? null;

  const copiarCorreo = (correo: string, clave: string) => {
    void navigator.clipboard.writeText(correo);
    setCorreoCopiado(clave);
    window.setTimeout(() => setCorreoCopiado((v) => (v === clave ? null : v)), 2000);
  };

  return (
    <div
      /*
       * 🔴 `relative` NO ES COSMÉTICO: sin él la hoja se anclaba al VIEWPORT.
       * `absolute` busca el ancestro posicionado más cercano y acá no había
       * ninguno, así que el `inset-y-3` de la hoja se medía desde el borde de la
       * ventana — o sea por ENCIMA del header de la app, que arranca más abajo.
       * El padrón ya tenía este `relative` con el comentario que lo explica
       * (`PantallaPadron.tsx`); el Dashboard se lo había olvidado.
       *
       * El `padding-right` es el hueco que el tablero CEDE cuando la hoja está
       * abierta. Es todo lo que hace falta para que deje de superponerse: el
       * contenido vive en la caja de contenido y se angosta solo —el radar, los
       * KPIs y la banda ya ceden con `min-w-0` y truncan—, mientras que la hoja
       * es `absolute` y se mide contra la caja de PADDING, que no se mueve. Los
       * dos anchos salen del mismo `ESPACIO_HOJA`, así que no pueden divergir.
       */
      className="relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3 transition-[padding-right] duration-[240ms] ease-house"
      style={ficha ? { paddingRight: ESPACIO_HOJA } : undefined}
    >
      {/* ═══ A · LA BANDA — el conmutador fijo + lo que cada lectura necesita.
              Altura fija h-16 en las DOS: conmutar no mueve nada de lugar. ═══ */}
      <section className="flex h-16 shrink-0 items-center gap-3 overflow-hidden rounded-2xl bg-card px-4 shadow-panel">
        {/* El conmutador solo existe si hay entre qué conmutar: para quien no ve
            «El negocio», un segmentado de un solo segmento es un botón que no
            hace nada. En su lugar va el rótulo de qué se está mirando — que ahora
            hace falta, porque el radar dejó de ser el de todos. */}
        {lecturas.length > 1 ? (
          <div className="flex shrink-0 rounded-full bg-muted p-0.5">
            {lecturas.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLectura(id)}
                aria-pressed={lecturaEfectiva === id}
                className={
                  'rounded-full px-3 py-1 text-xs font-bold transition-[background-color,color] duration-200 ease-house ' +
                  (lecturaEfectiva === id ? 'bg-card text-navy-ink shadow-panel' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="shrink-0 font-heading text-xs font-bold text-navy-ink">Mi turno</h2>
        )}
        <span className="h-7 w-px shrink-0 bg-border" aria-hidden="true" />

        {lecturaEfectiva === 'negocio' || lecturaEfectiva === 'campana' ? (
          /* El mismo control de período para las dos lecturas de conjunto: es la
             misma pregunta («¿de cuándo?») y partirla en dos widgets haría que
             conmutar cambiara de sitio el único filtro que ambas usan. En
             campaña viajan sólo los presets — no hay selector de línea, porque
             las líneas salen del token y no de la pantalla. */
          <FiltrosNegocio
            valor={filtros}
            onCambio={setFiltros}
            datos={negocio.data}
            soloPeriodo={lecturaEfectiva === 'campana'}
            rango={lecturaEfectiva === 'campana' ? campana.data?.rango : undefined}
          />
        ) : (
          <>
        {isPending ? (
          <div className="h-8 w-44 shrink-0 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-gold-ink" />
            <span className="font-heading text-2xl font-bold tabular-nums text-foreground">{nCalientes}</span>
            <span className="text-xs text-muted-foreground">
              {nCalientes === 1 ? 'persona espera' : 'personas esperan'}
              {nCalientes > 0 && masViejaHoras !== null
                ? nCalientes === 1
                  ? ` · ${hace(masViejaHoras)}`
                  : ` · la más vieja ${hace(masViejaHoras)}`
                : ''}
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {agenda.isPending ? (
            <>
              <div className="h-7 w-36 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
            </>
          ) : pills.length === 0 ? (
            <span className="truncate text-xs text-muted-foreground">Agenda al día — nada vencido, nada para hoy.</span>
          ) : (
            <>
              {pills.map(({ r, vencida }) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onAbrir(conversacionDeRecordatorio(r))}
                  title={r.nota}
                  className={
                    'max-w-52 truncate rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,transform] duration-200 ease-house active:scale-[0.98] ' +
                    (vencida ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-gold/20 text-gold-ink hover:bg-gold/30')
                  }
                >
                  {r.personaNombre ?? r.nota} ·{' '}
                  {vencida
                    ? hace(horasDesde(r.cuando))
                    : new Date(r.cuando).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
              {masEnAgenda > 0 && (
                <button type="button" onClick={onIrAgenda} className="shrink-0 text-xs font-semibold text-primary hover:underline">
                  +{masEnAgenda} más →
                </button>
              )}
            </>
          )}
        </div>

        {atender && (
          <button
            type="button"
            onClick={() => onAbrir(conversacionDeChat(atender))}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)] transition-[transform,background-color] duration-200 ease-house hover:bg-primary-hover active:scale-[0.98]"
          >
            Atender a {(atender.persona_nombre ?? atender.telefono ?? 'lead').split(' ')[0]}
            <ArrowRight size={13} />
          </button>
        )}
          </>
        )}
      </section>

      {lecturaEfectiva === 'campana' && (
        <PanelCampana
          datos={campana.data}
          cargando={campana.isPending || (campana.isFetching && !campana.data)}
          actualizando={campana.isFetching && !!campana.data}
        />
      )}

      {lecturaEfectiva === 'negocio' && (
        <PanelNegocio
          datos={negocio.data}
          cargando={negocio.isPending || (negocio.isFetching && !negocio.data)}
          actualizando={negocio.isFetching && Boolean(negocio.data)}
          dimension={filtros.dimension}
        />
      )}

      {/* ═══ A2 — LA BANDA DE NÚMEROS GRANDES ═══
          Responde «¿cómo viene?» de un vistazo, antes de la lista. Va DEBAJO de
          la barra de arriba y no adentro: esa barra tiene alto fijo (`h-16`) y
          es donde vive la acción del día («Atender a…»); meter cuatro números
          ahí la partiría en dos filas y empujaría el botón fuera de la vista.

          🔴 Sólo en «Mi turno». En «El negocio» manda `PanelNegocio`, que tiene
          sus propias cifras y su propio período: dos bandas de números en la
          misma pantalla, con la misma forma y distinto universo, es el defecto
          que este frente vino a evitar, no a introducir.

          Qué tiles van y de dónde salen: `dashboard/kpis.ts` (puro). Los dos que
          el diseño pedía y NO existen —conversión y tiempo de primera
          respuesta— no se dibujan: un tile con «—» es un skeleton eterno. */}
      {lecturaEfectiva === 'turno' && (
        <section aria-label="Los números del embudo" className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.id} className="min-w-0 rounded-2xl bg-card px-4 py-3 shadow-panel">
              <div className="flex items-center gap-1.5">
                {/* El punto de color ata el número con su segmento de la barra
                    del embudo, que está más abajo en la misma pantalla. El total
                    no lleva punto: no es una etapa. */}
                {k.etapa && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorSegmento(k.etapa) }}
                  />
                )}
                <span className="truncate text-[11px] text-muted-foreground">{k.rotulo}</span>
              </div>
              <p className="mt-1 font-heading text-2xl font-bold tabular-nums leading-none text-foreground">
                {/* ⚠️ SIN separador de miles, y no es un olvido: el resto de
                    esta pantalla dibuja los números crudos con `tabular-nums`
                    —el total del embudo, doce renglones más abajo, dice `3973`—
                    así que un `3,973` acá pondría el MISMO valor con dos formatos
                    en la misma vista. Cambiar la convención es otra decisión, y
                    entonces se cambia en todos lados. */}
                {isPending ? '—' : k.n}
              </p>
              {k.nota && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={k.nota}>{k.nota}</p>}
            </div>
          ))}
        </section>
      )}

      {/* ═══ B + C — MI TURNO ═══ */}
      <div className={'min-h-0 flex-1 gap-2.5 ' + (lecturaEfectiva === 'turno' ? 'flex' : 'hidden')}>
        {/* ── B · EL RADAR — el punto vivo + el contador identifican la zona ── */}
        {/* 🔴 `@container`: LA FILA SE MIDE CONTRA EL RADAR, NO CONTRA LA VENTANA.
            Desde que la hoja empuja, el radar cambia de ancho sin que la ventana
            cambie de nada — a 1180 pasa de 762 px a 380 según haya ficha abierta.
            Una media query no puede ver esa diferencia: contestaría lo mismo en
            los dos casos, así que o esconde campos cuando sobra lugar o los deja
            cuando no cabe ninguno. La pregunta que hay que hacer es «¿cuánto mide
            ESTA lista?», y eso es una consulta de contenedor. */}
        <section aria-label="El radar" className="@container flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-card shadow-panel">
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{filas.length}</span>
            {deAntes ? (
              <SelloDeAntes texto={deAntes} actualizando={actualizando} />
            ) : (
              <>
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                </span>
                <span className="text-[11px] text-muted-foreground">en vivo</span>
              </>
            )}

            {etapaFiltro && (
              <button
                type="button"
                onClick={() => setEtapaFiltro(null)}
                className="flex items-center gap-1 rounded-full bg-navy px-2.5 py-0.5 text-[11px] font-semibold text-white"
              >
                {rotuloEtapa(etapaFiltro, 'varios')} <X size={10} />
              </button>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1">
              {fuentesVisibles.map((f) => {
                const ult = f.id && ultimaPor[f.id] ? horasDesde(ultimaPor[f.id]) : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFuente(f.id)}
                    className={
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
                      (fuente === f.id ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
                    }
                  >
                    {f.label} {countPor(f.id) > 0 && <span className="font-mono">{countPor(f.id)}</span>}
                    {ult !== null && ult > 24 && <span className="ml-1 font-normal opacity-70">· sin caídas {hace(ult)}</span>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSoloCalientes((v) => !v)}
                className={
                  'ml-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
                  (soloCalientes ? 'border-gold-ink bg-gold/15 text-gold-ink' : 'border-border text-muted-foreground hover:text-foreground')
                }
              >
                <span className="size-1.5 rounded-full bg-gold-ink" /> Solo calientes
              </button>
            </div>
          </header>

          {/* `data-scroll-radar`: el chip de asignar de cada fila mide contra ESTE
              contenedor para decidir si su panel abre hacia arriba o hacia abajo
              — lo que lo recorta es este `overflow-y-auto`, no la ventana. Misma
              convención que `data-scroll-cola` y `data-scroll-columna`. */}
          <div data-scroll-radar className="min-h-0 flex-1 overflow-y-auto">
            {isPending ? (
              <div>
                {SKELETON_RADAR.map(([w1, w2], i) => (
                  <div key={i} className="border-b border-border/70 px-4 py-2 last:border-b-0">
                    <div className={'h-3 animate-pulse rounded bg-muted ' + w1} />
                    <div className={'mt-1.5 h-3 animate-pulse rounded bg-muted ' + w2} />
                  </div>
                ))}
              </div>
            ) : filas.length === 0 ? (
              <p className="px-6 py-14 text-center text-xs leading-relaxed text-muted-foreground">
                {/* para sistemas: conectar Bravo → Hermes está en el runbook §9 (docs/plan-hermes-mvp.md). */}
                {fuente === 'landing'
                  ? 'Las landings todavía no llegan a Hermes — falta que Sistemas conecte Bravo. No es que no caigan.'
                  : /* 🔴 EL VACÍO TIENE QUE DECIR SU MOTIVO. Con el Dashboard
                       personal, «nada cayó» sería FALSO: cayó, no es tuyo. Y sin
                       el motivo, la vendedora lee «se rompió algo» o «hoy no hay
                       trabajo», que son las dos conclusiones equivocadas. */
                    soloMisAsignadas && !fuente && !etapaFiltro && !soloCalientes
                    ? 'Todavía no tienes conversaciones asignadas. Acá aparecen las que te reparte el supervisor — no es que no haya caído nada.'
                    : soloMisAsignadas
                      ? 'Ninguna de las tuyas con estos filtros. Este radar muestra solo lo que te asignaron.'
                      : 'Nada cayó con estos filtros. Si la frescura del header está verde, este vacío es real.'}
                {(fuente || etapaFiltro || soloCalientes) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFuente('');
                      setEtapaFiltro(null);
                      setSoloCalientes(false);
                    }}
                    className="ml-1.5 font-bold text-primary hover:underline"
                  >
                    Volver a Todo
                  </button>
                )}
              </p>
            ) : (
              <>
                {filas.map((fila) => {
                  const esChat = 'chat' in fila;
                  const base = esChat ? fila.chat : fila.form;
                  const clave = base.clave;
                  const etapa =
                    data!.etapas[clave] ?? (esChat ? 'interesado' : fila.form.estado_lead === 'nuevo' ? 'interesado' : fila.form.estado_lead);
                  const alta = esDeuda(fila.nivel);
                  const tags = data!.etiquetas[clave] ?? [];
                  const pais = paisDe(base.pais_dato, esChat ? fila.chat.telefono : fila.form.telefono);
                  const horas = horasDesde(base.cayo_at);
                  // Por qué esta fila está donde está (#22, #23). Un formulario no
                  // tiene Ventana —no hay comentario público del que colgarse— ni
                  // agenda, así que no tiene nada que explicar.
                  const marca = esChat
                    ? marcaDeFila({
                        nivel: fila.nivel,
                        ventana_dias: fila.chat.ventana_dias,
                        seguimiento_nota: fila.chat.seguimiento_nota,
                      })
                    : null;
                  // Con la Ventana cerrada ya no se puede escribir en privado, así
                  // que la fila deja de ofrecerlo: un botón que no lleva a ningún
                  // lado enseña a desconfiar de todos los demás. `null` es WhatsApp,
                  // donde no hay ventana y siempre se puede escribir.
                  const puedeEscribirPrivado = !esChat || fila.chat.ventana_dias == null || fila.chat.ventana_dias > 0;
                  const clickeable = esChat || Boolean(fila.form.telefono);
                  /**
                   * EL CLIC ABRE LA FICHA AL COSTADO, no conmuta de vista.
                   *
                   * Antes saltaba a Mensajes, y eso costaba el radar entero para
                   * responder «¿quién es?». Ahora es el mismo gesto que en
                   * Pipeline: la hoja se superpone, se puede tocar otra fila y
                   * cambia de persona sin cerrarse — que es lo que se hace
                   * mientras se elige a quién atender.
                   *
                   * El salto a Mensajes NO se pierde: vive en el botón de
                   * escribir de la fila, que es donde corresponde una acción
                   * que te saca de acá.
                   *
                   * 🔴 **Y UN FORMULARIO TAMBIÉN ABRE LA FICHA** (8-ago-2026).
                   * Acá decía «un formulario sin chat no tiene ficha que
                   * mostrar, así que sigue yendo al buscador», y era falso: la
                   * ficha de un lead es justo lo que hace falta —quién es, de
                   * qué landing vino, cuándo llenó, si ya compró— y la mitad
                   * que responde eso se busca por TELÉFONO, no por hilo. Es
                   * exactamente el caso que `conversacionDeTelefono` existe
                   * para cubrir (ADR 0035, el padrón: 72.923 personas que
                   * nunca escribieron y sí tienen ficha).
                   *
                   * Lo que se ve es la verdad: timeline, señales e intereses
                   * vacíos —porque no hay hilo— y la ficha de Cerberus + el
                   * lead-form completos. Mandar al buscador costaba el radar
                   * entero para responder «¿quién es este?».
                   */
                  const abrir = () =>
                    esChat
                      ? setFicha(conversacionDeChat(fila.chat))
                      : setFicha(
                          conversacionDeTelefono({
                            telefono: fila.form.telefono!,
                            numeroPropio: miLinea,
                            nombre: fila.form.persona_nombre,
                          }),
                        );
                  const esNueva = nuevas.has(clave);

                  return (
                    <div
                      key={clave}
                      role={clickeable ? 'button' : undefined}
                      tabIndex={clickeable ? 0 : undefined}
                      onClick={clickeable ? abrir : undefined}
                      onKeyDown={
                        clickeable
                          ? (e) => {
                              if (e.target !== e.currentTarget) return;
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                abrir();
                              }
                            }
                          : undefined
                      }
                      className={
                        'group border-b border-border/70 border-l-[3px] px-4 py-2 transition-colors last:border-b-0 ' +
                        tempBorde(base.cayo_at) +
                        (clickeable ? ' cursor-pointer hover:bg-accent' : '') +
                        (esNueva ? ' animate-entrar bg-secondary' : '')
                      }
                    >
                      {/* L1 · QUIÉN — metadato en voz chica: canal, nombre, país,
                          etiquetas, la marca que explica la posición, y a la
                          derecha el reloj y la etapa. Todo esto ANTES ocupaba el
                          renglón principal y tapaba lo único que contesta el
                          «por qué a ese» (#20). */}
                      <div className="flex items-center gap-2">
                        {/* El grupo de la izquierda CEDE espacio (min-w-0): sin esto
                            la suma de metadatos desborda la fila en una ventana
                            angosta y el radar aparece con scroll horizontal — que
                            en esta app no existe, se scrollea solo el riel. */}
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          {alta && <span title="caliente" className="size-1.5 shrink-0 rounded-full bg-gold-ink" />}
                          {esChat ? <BadgeCanal canal={fila.chat.canal} size={13} /> : null}
                          {/* 🔴 EL NOMBRE NO CEDE — `shrink-0`, y es la corrección
                              de una jerarquía que estaba AL REVÉS. Con `shrink` y
                              un país `shrink-0` al lado, el dato que no cedía era
                              el país: medido a 1180 con la ficha abierta (el radar
                              en 380 px), «República Dominicana» se quedaba entero y
                              el nombre de esa fila quedaba en **clientWidth 0** —
                              la fila decía «República Dominicana · hace 3 horas ·
                              Te espera» y a QUIÉN atendías no aparecía por ningún
                              lado. Sin error, sin desborde y sin scroll: la fila se
                              veía perfecta y le faltaba el único dato que la fila
                              existe para dar.
                              El tope es 40 % mientras haya con quién compartir el
                              renglón, y 70 % cuando el radar se angosta y el país y
                              el canal ya se guardaron: sin eso el nombre seguía
                              cortado en 73 px al lado de un hueco vacío. */}
                          <span className="@max-[560px]:max-w-[70%] max-w-[40%] shrink-0 truncate text-[11px] font-semibold text-foreground">
                            {base.persona_nombre ?? (
                              <span className="font-mono font-normal text-muted-foreground">
                                {(esChat ? fila.chat.telefono : (fila.form.telefono ?? fila.form.correo)) ?? 'sin dato'}
                              </span>
                            )}
                          </span>
                          {/* El país cede DESPUÉS del canal y ANTES del nombre, y
                              por debajo de 440 px SE GUARDA: un «Repú…» de tres
                              letras no dice de dónde es nadie — ocupa el lugar del
                              nombre y encima ensucia. El `title` conserva el dato
                              entero mientras se dibuja. */}
                          {pais && (
                            <span
                              className="@max-[440px]:hidden min-w-0 shrink truncate font-mono text-[11px] text-muted-foreground"
                              title={pais}
                            >
                              {pais}
                            </span>
                          )}
                          {/* El nombre del canal es lo PRIMERO que se sacrifica si
                              falta lugar: el badge de la izquierda ya lo dice — y
                              hasta hoy eso era una intención escrita que el layout
                              no cumplía, porque truncar no es sacrificar: dejaba un
                              «Wh…» que ocupa igual y no se lee. */}
                          <span className="@max-[560px]:hidden min-w-0 shrink truncate font-mono text-[11px] text-muted-foreground">
                            {esChat
                              ? fila.fuente === 'comentario'
                                ? 'Comentario'
                                : nombreCanal(fila.chat.canal)
                              : fila.fuente === 'landing'
                                ? 'Landing'
                                : 'Lead Ad'}
                          </span>
                          {tags.map((t) => (
                            <span key={t} className="shrink-0 rounded-md border border-border px-1.5 text-[11px] leading-4 text-muted-foreground">
                              {t}
                            </span>
                          ))}
                          {/* ══ EL CHIP DE ASIGNAR — QUIÉN ATIENDE A ESTA PERSONA ═══════════
                              Pedido del dueño (24-ago-2026) sobre esta misma fila:
                              *«un botón para poder asignar a un vendedor
                              rápidamente»*, en el lugar donde estaba el `+` de
                              etiquetar.

                              🔴 **Reemplaza al `+`, no lo acompaña**, y la etiqueta
                              no se pierde: `BarraGestion` (la hoja, y el panel de
                              Mensajes) sigue poniendo Y QUITANDO etiquetas — que es
                              más de lo que hacía el `+`, que solo agregaba. Lo que
                              se pierde es el atajo desde el radar; lo que se gana es
                              la única acción de equipo que esta pantalla existe para
                              tomar. Las etiquetas YA PUESTAS se siguen viendo acá
                              arriba (`tags`, dos renglones más arriba).

                              ⚠️ **Sólo en los chats, y el hueco es honesto.** Un
                              comentario de FB/IG no tiene línea y un lead de
                              formulario no tiene dueño posible (el server lo dice
                              con todas las letras en `consultasDelDashboard.ts`):
                              el propio control se borra solo en esos casos, en vez
                              de ofrecer una lista vacía. */}
                          {esChat && (
                            <PasarConversacion
                              conversacion={conversacionDeChat(fila.chat)}
                              miVendedora={miVendedora}
                              // La lista del radar es un `overflow-y-auto`: en las
                              // últimas filas, abrir hacia abajo es abrir un panel
                              // cortado. Mismo cuidado que `MenuFila` en la cola.
                              recortaEn="[data-scroll-radar]"
                            />
                          )}
                          {/* La marca trunca en vez de empujar: vale más una marca
                              recortada que una fila que se sale de la pantalla.
                              ⚠️ Pero recortada TIENE UN PISO, y era un falso dilema:
                              «se e…» no explica ninguna posición — es el ruido de
                              «Wh…» con otro texto. Por debajo de 440 se guarda con
                              el país, y el `title` la conserva. */}
                          {marca && (
                            <span
                              title={marca.texto}
                              className={'@max-[440px]:hidden min-w-0 shrink truncate text-[11px] font-semibold ' + TINTA_MARCA[marca.tono]}
                            >
                              {marca.texto}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={
                              'font-mono text-[11px] tabular-nums ' +
                              (esChat && horas > 20 && horas < 24 ? 'text-gold-ink' : tempClass(base.cayo_at))
                            }
                            title={new Date(base.cayo_at).toLocaleString('es')}
                          >
                            {hace(horas)}
                          </span>
                          {/* El chip de UNA conversación: singular, y por el rótulo
                              canónico — antes pintaba el IDENTIFICADOR crudo con un
                              `capitalize` de CSS, que con ids de una palabra se veía
                              bien de casualidad. */}
                          <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + (ETAPA_CHIP[etapa] ?? ETAPA_CHIP.interesado)}>
                            {rotuloEtapa(etapa)}
                          </span>
                        </span>
                      </div>

                      {/* L2 · QUÉ DIJO — el renglón principal. Es el único campo
                          que contesta «¿por qué a ese?», y viajaba desde el server
                          sin que nadie lo pintara. Un formulario no tiene mensaje:
                          su equivalente es el producto que pidió. */}
                      <div className="mt-0.5 flex items-center gap-2">
                        {esChat && fila.chat.pregunto && (
                          <span className="shrink-0 rounded bg-primary/10 px-1 py-px text-[11px] font-semibold text-primary">
                            Preguntó
                          </span>
                        )}
                        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                          {esChat
                            ? textoDePreview({
                                texto: fila.chat.texto,
                                clase: fila.chat.texto_clase,
                                origen: fila.chat.texto_origen,
                                soloClic: fila.chat.solo_clic,
                              })
                            : (fila.form.producto ?? fila.form.campana ?? 'sin campaña')}
                        </p>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          <span className="flex items-center gap-1.5 text-muted-foreground transition-colors focus-within:text-navy-ink group-hover:text-navy-ink">
                            {(esChat ? fila.chat.telefono : fila.form.telefono) && (
                              <BotonLlamar telefono={(esChat ? fila.chat.telefono : fila.form.telefono)!} compacto />
                            )}
                            {esChat ? (
                              /* ⚠️ ESTE ÍCONO ERA DECORATIVO Y AHORA HACE ALGO.
                                 Mientras el clic de la fila saltaba a Mensajes,
                                 alcanzaba con insinuar «acá se puede escribir».
                                 Ahora la fila abre la ficha al costado, así que
                                 el salto necesita su propia puerta — y esta es
                                 la que ya prometía serlo. `stopPropagation`
                                 porque la fila entera es clicable. */
                              puedeEscribirPrivado ? (
                                <button
                                  type="button"
                                  title="Escribirle — abre la conversación en Mensajes"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAbrir(conversacionDeChat(fila.chat));
                                  }}
                                  className="rounded p-0.5 transition-colors hover:text-navy-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                  <MessageSquareText size={13} />
                                </button>
                              ) : null
                            ) : fila.form.telefono ? (
                              <button
                                type="button"
                                title="Ver en Contactos"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBuscarPersona(fila.form.telefono!);
                                }}
                                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.96]"
                              >
                                <Search size={13} />
                              </button>
                            ) : fila.form.correo ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => copiarCorreo(fila.form.correo!, clave)}
                                  className="rounded px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98]"
                                >
                                  {correoCopiado === clave ? 'Copiado' : 'Copiar correo'}
                                </button>
                                {onMandarCorreo && (
                                  <button
                                    type="button"
                                    onClick={() => onMandarCorreo(fila.form.correo!)}
                                    className="rounded px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98]"
                                  >
                                    Mandar correo
                                  </button>
                                )}
                              </>
                            ) : null}
                          </span>
                        </span>
                      </div>

                      {/* L3 · DÓNDE lo dijo — solo para comentarios, y solo si hay
                          contexto. Antes iba pegado a la atribución en L1, donde
                          competía con el nombre; acá abajo no le quita renglón a
                          nada y sigue diciendo bajo qué publicación comentó. */}
                      {esChat && fila.fuente === 'comentario' && fila.chat.contexto_texto && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          en “{fila.chat.contexto_texto}”
                        </p>
                      )}
                    </div>
                  );
                })}
                {totalFiltradas > 80 && (
                  <p className="py-3 text-center text-[11px] text-muted-foreground">
                    Mostrando los 80 más recientes de {totalFiltradas} — afina los filtros para ver el resto.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── C · EL RIEL: Embudo → Los últimos 14 días → Qué piden → Equipo ── */}
        <aside
          className={
            'flex w-80 shrink-0 flex-col gap-2.5 overflow-y-auto' +
            /*
             * Con la hoja abierta el tablero cede 382 px, y la cuenta tiene un
             * piso: riel (320) + aire (10) + hoja (382) + el riel de vistas de
             * la app (76) + el padding (12) son 800 px antes de la primera fila
             * del radar. Por debajo de 1160 el radar quedaría más angosto que
             * una fila suya y el riel —que es `shrink-0`— se cortaría contra el
             * borde. Ahí el riel SE GUARDA: es el resumen, el radar es el
             * trabajo. Cerrando la hoja vuelve, sin que nadie tenga que pedirlo.
             */
            (ficha ? ' max-[1159px]:hidden' : '')
          }
        >
          {/* C1 · Embudo: UNA barra segmentada, click filtra */}
          <section className="rounded-xl bg-card p-3.5 shadow-panel">
            <h3 className="text-xs font-medium text-foreground">
              <span className="font-mono tabular-nums">{totalEmbudo}</span> en el embudo
            </h3>
            {isPending ? (
              <div className="mt-2.5 h-2 animate-pulse rounded-full bg-muted" />
            ) : totalEmbudo === 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                El embudo se arma cuando los leads cambian de etapa en Mensajes o el Pipeline.
              </p>
            ) : (
              <>
                <BarraSegmentada
                  className="mt-2.5"
                  segmentos={etapasEmbudo.map((e) => ({
                    id: e,
                    n: data?.embudo[e] ?? 0,
                    color: colorSegmento(e),
                    // Sin esto el `title` y el `aria-label` de la barra dicen el id.
                    label: rotuloEtapa(e, 'varios'),
                  }))}
                  activo={etapaFiltro}
                  onSegmento={(id) => setEtapaFiltro(etapaFiltro === id ? null : id)}
                />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  {etapasEmbudo.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEtapaFiltro(etapaFiltro === e ? null : e)}
                      className={
                        'font-mono text-[11px] tabular-nums transition-colors ' +
                        (etapaFiltro === e ? 'font-bold text-navy-ink' : 'text-muted-foreground hover:text-foreground')
                      }
                    >
                      {/* La leyenda del riel: contaba montones y decía el IDENTIFICADOR
                          en minúscula («611 cotizado»). Es el mismo defecto que el chip
                          de la fila, en el mismo panel — lo destapó la captura, no un test. */}
                      {data?.embudo[e] ?? 0} {rotuloEtapa(e, 'varios')}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* C2 · Los últimos 14 días: la serie de leads, quieta y honesta */}
          <section className="rounded-xl bg-card p-3.5 shadow-panel">
            <h3 className={sectionLabel}>Los últimos 14 días</h3>
            {isPending ? (
              <div className="mt-2.5 flex h-16 items-end gap-[2px] border-b border-border pb-px">
                {SKELETON_COLUMNAS.map((h, i) => (
                  <div key={i} className="min-w-0 flex-1 animate-pulse rounded-t-[2px] bg-muted" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : puntosLeads.length === 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                La serie de los últimos 14 días todavía no llega.{' '}
                <span className="font-mono">para sistemas: series.leads_dia en /api/dashboard</span>
              </p>
            ) : (
              <div className="mt-2.5">
                <Columnas puntos={puntosLeads} resumen={resumenLeads} unidad="leads" />
              </div>
            )}
          </section>

          {/* C3 · Qué piden — SÓLO EN VENTAS.
              🔴 Es el ranking de CURSOS, y un curso es de la Escuela. En campaña
              no es un cero de hoy: es un cero ESTRUCTURAL, y encima le explicaría
              a un operador político que existe un catálogo de diplomados que
              nunca va a ver. Mismo defecto que ADR 0063 encontró en el panel
              derecho, en otra pantalla. Quién decide: `dashboard/kpis.ts`. */}
          {panelesDe(esDeCampana).includes('quePiden') && (
          <section className="rounded-xl bg-card p-3.5 shadow-panel">
            <h3 className={sectionLabel}>Qué piden</h3>
            {isPending ? (
              <div className="mt-2 space-y-1.5">
                {['w-full', 'w-4/5', 'w-3/5', 'w-5/6', 'w-2/3'].map((w) => (
                  <div key={w} className={'h-3 animate-pulse rounded bg-muted ' + w} />
                ))}
              </div>
            ) : (data?.cursos.length ?? 0) === 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {/* Honestidad: esto lee `intereses`, que se llena TIPEANDO. En prod
                    tiene un solo registro, así que este vacío es lo normal, no una
                    falla — y el dato bueno (el curso que la persona eligió en el
                    formulario) ya está, del otro lado del conmutador. */}
                Nadie tipeó un curso todavía — los intereses se registran a mano desde el chat o al cotizar.{' '}
                {/* ⚠️ El atajo a «El negocio» solo se ofrece a quien puede
                    abrirlo. Para el resto sería un callejón: un link a una
                    pantalla que no existe en su app, y el 403 del server
                    esperándolo del otro lado. */}
                {puedeVerNegocio && (
                  <button type="button" onClick={() => setLectura('negocio')} className="font-semibold text-primary hover:underline">
                    El curso que eligieron en el formulario está en El negocio →
                  </button>
                )}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {data!.cursos.slice(0, 5).map((c, i) => (
                  <div key={c.curso} className="flex items-center gap-2 text-xs">
                    <span className="w-3 shrink-0 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className={'min-w-0 flex-1 truncate ' + (i === 0 ? 'font-semibold text-foreground' : 'text-foreground')} title={c.curso}>
                      {c.curso}
                    </span>
                    <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-secondary-foreground/50" style={{ width: `${(c.n / maxCurso) * 100}%` }} />
                    </span>
                    <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{c.n}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {/* C4 · Equipo — el único kicker de la vista; la chispa es el pulso */}
          <section className="rounded-xl bg-card p-3.5 shadow-panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Con una sola fila —la propia— «Equipo» es un rótulo falso: no
                    hay equipo del que este cuadro hable. */}
                <h3 className={kicker}>{soloMisAsignadas ? 'Tú' : 'Equipo'}</h3>
                {enviosValores.length >= 2 && (
                  <Chispa
                    valores={enviosValores}
                    etiqueta={`Mensajes enviados por día, últimos 14 días: hoy ${enviosValores[enviosValores.length - 1] ?? 0}`}
                    ancho={64}
                    alto={20}
                    className="text-navy-ink"
                  />
                )}
              </div>
              <div className="flex rounded-full border border-border p-0.5">
                {(['hoy', '7d'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodo(p)}
                    className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + (periodo === p ? 'bg-navy text-white' : 'text-muted-foreground')}
                  >
                    {p === 'hoy' ? 'Hoy' : '7d'}
                  </button>
                ))}
              </div>
            </div>
            {isPending ? (
              <div className="mt-2 space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : equipo.length === 0 && !automaticos ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Nadie registró actividad todavía — el día arranca con la primera respuesta.
              </p>
            ) : (
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex-1" />
                  <span className="w-9 text-right">conv</span>
                  <span className="w-9 text-right">msj</span>
                  <span className="w-9 text-right">vtas</span>
                </div>
                {equipo.length === 0 && (
                  <p className="border-t border-border/60 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {soloMisAsignadas
                      ? 'Todavía no registraste actividad hoy.'
                      : 'Nadie del equipo registró actividad todavía.'}
                  </p>
                )}
                {equipo.map((v) => {
                  const soyYo = v.vendedora === miVendedora;
                  const [conv, msj, vtas] =
                    periodo === 'hoy'
                      ? [v.conversaciones_hoy, v.mensajes_hoy, v.ventas_hoy]
                      : [v.conversaciones_7d, v.mensajes_7d, v.ventas_7d];
                  return (
                    <div key={v.vendedora} className="flex items-center gap-2 border-t border-border/60 py-1.5 text-xs">
                      <span
                        title={soyYo ? 'tú' : undefined}
                        className={
                          'flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-secondary font-heading text-[11px] font-bold text-navy-ink' +
                          (soyYo ? ' ring-2 ring-navy' : '')
                        }
                      >
                        {iniciales(v.vendedora)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{v.vendedora}</span>
                      <span className="w-9 text-right font-mono tabular-nums text-foreground">{conv}</span>
                      <span className="w-9 text-right font-mono tabular-nums text-foreground">{msj}</span>
                      <span className={'w-9 text-right font-mono tabular-nums ' + (vtas > 0 ? 'font-bold text-success' : 'text-foreground')}>
                        {vtas}
                      </span>
                    </div>
                  );
                })}
                {/* Lo que mandó el SOFTWARE — `bot` y `goberna-admin` firman
                    `envios_wa` igual que una vendedora, y salían como filas del
                    equipo (537 de 620 envíos el 4-ago). Va como RENGLÓN y no
                    como fila: sin avatar de iniciales ni ring de «tú», porque
                    no es alguien. Pero va: borrarlo dejaría el cuadro diciendo
                    que el equipo mandó 83 mensajes cuando salieron 620, y esa
                    resta invisible es peor que el ruido que vino a sacar.
                    `conv` y `vtas` son «—» de verdad: las conversaciones son un
                    DISTINCT por actor y sumarlas contaría dos veces a quien
                    atendieron los dos. */}
                {automaticos && (
                  <div
                    className="flex items-center gap-2 border-t border-border/60 py-1.5 text-[11px] text-muted-foreground"
                    title={`No son del equipo: ${automaticos.quienes.join(', ')}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center">
                      <Bot size={13} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">Automático</span>
                    <span className="w-9 text-right">—</span>
                    <span className="w-9 text-right font-mono tabular-nums">
                      {periodo === 'hoy' ? automaticos.mensajes_hoy : automaticos.mensajes_7d}
                    </span>
                    <span className="w-9 text-right">—</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ═══ LA FICHA AL COSTADO — UNA COLUMNA MÁS, NO UNA HOJA ENCIMA ═══
          El molde de Pipeline y el padrón, con la corrección que este frente
          vino a hacer: acá NO se superpone. Tapar el radar del que se está
          eligiendo hacía falsa la pregunta que el radar contesta — se elegía a
          ciegas sobre la mitad de la lista. Ahora el tablero le cede el hueco
          (el `padding-right` de la raíz) y sigue entero: se puede tocar otra
          fila y la hoja cambia de persona sin cerrarse, como siempre.

          LO QUE SE ANIMA ES UNA VENTANA, y esa es toda la mecánica: este `div`
          es un recorte cuyo ANCHO va de 0 a `ESPACIO_HOJA` con la misma curva y
          los mismos 240 ms que el hueco de la raíz. La hoja de adentro no se
          entera —conserva sus 360 px, así que nada se comprime ni se reflowea
          mientras dura— y aparece descubriéndose desde el borde derecho. Cerrar
          es la misma película al revés.

          ⚠️ `inset-y-0` y no `inset-y-3`: la ventana tiene que ser más grande
          que la hoja para no comerle la sombra. La hoja se pone su `inset-y-3`
          adentro, contra ESTA ventana, y los 12 px que sobran arriba y abajo
          son el lugar donde `shadow-panel` cae. */}
      <div
        aria-hidden={!fichaEnPantalla}
        className="absolute inset-y-0 right-0 z-30 overflow-hidden transition-[width] duration-[240ms] ease-house"
        style={{ width: ficha ? ESPACIO_HOJA : 0 }}
      >
        {fichaEnPantalla && (
          <HojaContacto
            conversacion={fichaEnPantalla}
            onCerrar={cerrarFicha}
            /* Cerrando, la hoja todavía existe pero ya no es de nadie: si se
               quedara con el Escape, la tecla no volvería al shell hasta que
               termine la transición. */
            escapeActivo={Boolean(ficha)}
            miVendedora={miVendedora}
            esDeCampana={esDeCampana}
            onMandarCorreo={onMandarCorreo}
          />
        )}
      </div>
    </div>
  );
}
