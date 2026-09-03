import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Sparkles, UserX, Users } from 'lucide-react';
import { contactosDelGrupo, esNadieTodavia, ETAPA_GRUPOS, opcionesDeReparto } from '../../dominio/segmentosPadron';
import type { Facetas, FacetaReparto, FiltrosPadron, OpcionLinea } from './padron';

/**
 * SOLO DOS GRUPOS DE ETAPA, LOS ACCIONABLES — no los cinco. «Ya compró» y «Se
 * perdió» no son algo para REPARTIR (ya se resolvieron); «Todavía sin
 * trabajar» es el 84 % del padrón, demasiado grande para ser un atajo de un
 * clic. Éstos dos son los que de verdad significan «hay trabajo esperando».
 *
 * 🔴 **Corregido antes de mostrarse mal (24-ago-2026):** la primera versión
 * de esta franja iba a leer estos dos grupos de la faceta SIN cruzar con
 * «sin repartir» — «En conversación · 512» hubiera contado gente que YA
 * tiene dueño, mintiendo justo bajo el título «Para repartir hoy». Por eso
 * `facetas` acá SIEMPRE viene de una consulta con `sinHabilitar: true` de
 * base (ver `PantallaPadron.tsx`) — el número que se lee es el cruce, no el
 * grupo solo.
 */
const GRUPOS_ACCIONABLES = ETAPA_GRUPOS.filter((g) => g.id === 'conversacion' || g.id === 'sin_cerrar');

/**
 * PARA REPARTIR HOY — la franja de atajos, pedida por el dueño el mismo día
 * que la cinta: "sin asignar, ver los que están asignados a tal vendedora,
 * curso". Saltos directos a una vista útil, no un refinamiento de lo que ya
 * está filtrado.
 *
 * ══ POR QUÉ SUS NÚMEROS SON INDEPENDIENTES DEL FILTRO ACTIVO ═══════════════
 * `PantallaPadron` le pasa `facetas`/`asignadoA`/`entroPorLinea` de una
 * consulta APARTE, fija en `{ sinHabilitar: true }` — no la del filtro que el
 * supervisor esté mirando ahora mismo. Es a propósito: un atajo es un punto
 * de referencia fijo ("hoy hay 73.145 sin asignar"), no algo que cambie de
 * significado según qué tenga puesto el supervisor en ese momento. Por la
 * misma razón, tocar un atajo RESETEA los demás filtros (`aplicarAtajo` en
 * `PantallaPadron.tsx`) — si no, el número que se prometió acá podría no
 * coincidir con lo que termina viendo la tabla.
 *
 * ══ POR QUÉ NO HAY CHIPS DE CURSO ═══════════════════════════════════════════
 * Los hubo (top-3 por gente sin repartir) y salieron el 25-ago-2026 —
 * feedback directo de Estephano: «1 chip por curso me parece mucho, un
 * filtro buscador de cursos me parece más preciso, con seleccionador
 * múltiple». Tenía razón: con 104 cursos, tres chips fijos son un ranking
 * arbitrario, no un atajo. Esa vía ya existe — `FiltroFaceta` (rótulo
 * «Curso» en `PanelLateralFiltros`) ya tiene buscador y multiselección,
 * no hubo que construir nada nuevo.
 *
 * ══ POR QUÉ «ASIGNADOA»/«ENTROPORLINEA» SON PROPS APARTE ═══════════════════
 * El server los manda como claves HERMANAS de `facetas`, nunca anidadas
 * adentro (ver el docblock de `RespuestaFacetas` en `padron.ts` — ahí vivió
 * un bug real por meterlos juntos). Recrear ese anidado acá adentro sería
 * repetir el mismo error un nivel más arriba.
 */
export function AtajosDeReparto({
  facetas,
  asignadoA,
  entroPorLinea,
  onElegir,
}: {
  facetas: Facetas | undefined;
  asignadoA: FacetaReparto | null | undefined;
  entroPorLinea: OpcionLinea[] | null | undefined;
  onElegir: (p: Partial<FiltrosPadron>) => void;
}) {
  if (!facetas) return null;

  const vendedoras = opcionesDeReparto(asignadoA ?? undefined).filter((o) => !esNadieTodavia(o));
  // La línea con más gente sin repartir — hoy es «Ventas Meta» (3.272, 43,8 %
  // de conversión contra 6,8 % del padrón, la mejor de toda la pantalla), sin
  // clavar su número acá: mañana puede ser otra, y esto sigue apuntando a la
  // que de verdad importa más.
  const lineaDestacada = [...(entroPorLinea ?? [])].sort((a, b) => b.contactos - a.contactos)[0];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Para repartir hoy</span>

      {lineaDestacada && (
        <button
          type="button"
          title={`Por dónde entró: ${lineaDestacada.etiqueta}`}
          onClick={() =>
            onElegir({ entroPorLinea: [lineaDestacada.valor], sinHabilitar: true, asignadoA: [], etapa: [], curso: [] })
          }
          className="flex items-center gap-1.5 rounded-full border border-navy/30 bg-navy/5 px-3 py-1.5 text-xs font-bold text-navy-ink transition-colors hover:bg-navy/10"
        >
          <Sparkles size={13} />
          {lineaDestacada.etiqueta}
          <span className="rounded-full bg-navy/15 px-1.5 text-[10px] font-bold tabular-nums text-navy-ink">
            {lineaDestacada.contactos.toLocaleString('es')}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onElegir({ sinHabilitar: true, asignadoA: [] })}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <UserX size={13} className="text-muted-foreground" />
        Sin asignar
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {(asignadoA?.sinRepartir ?? 0).toLocaleString('es')}
        </span>
      </button>

      {GRUPOS_ACCIONABLES.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onElegir({ etapa: [...g.valores], sinHabilitar: true, asignadoA: [] })}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {g.rotulo}
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {contactosDelGrupo(facetas.etapa, g).toLocaleString('es')}
          </span>
        </button>
      ))}

      <AsignadosA vendedoras={vendedoras} onElegir={(id) => onElegir({ asignadoA: [id], sinHabilitar: false })} />
    </div>
  );
}

/** Igual que `ElegirDestino` en `BarraReparto.tsx`, pero para SALTAR a ver el
 * docket de una vendedora, no para elegirla como destino de un reparto. */
function AsignadosA({
  vendedoras,
  onElegir,
}: {
  vendedoras: { id: string; rotulo: string; contactos: number }[];
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', escape, true);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <Users size={13} className="text-muted-foreground" />
        Asignados a
        <ChevronDown size={12} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
          <div className="max-h-64 overflow-y-auto p-1">
            {vendedoras.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">Todavía nadie tiene nada asignado.</p>
            ) : (
              vendedoras.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onElegir(v.id);
                    setAbierto(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {v.rotulo}
                  <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                    {v.contactos.toLocaleString('es')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
