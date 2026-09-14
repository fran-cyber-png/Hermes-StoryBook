import {
  AlertTriangle,
  Calendar,
  Check,
  Info,
  ListChecks,
  MapPin,
  MessageCircle,
  ShoppingBag,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import { cifra } from '../../lib/formato';
import { controlDeBarraClass } from '../../lib/styles';
import { encabezadoSeccion } from '../panel/estiloSeccion';
import {
  alternarGrupo,
  contactosDelGrupo,
  contactosSinGrupo,
  esSinAsignar,
  ETAPA_GRUPOS,
  grupoActivo,
  NIVEL_GRUPOS,
  opcionesDeReparto,
  type GrupoCondensado,
  type OpcionDeReparto,
} from '../../dominio/segmentosPadron';
import { FiltroFaceta } from './FiltroFaceta';
import {
  alternar,
  type Facetas,
  type FacetaReparto,
  type FiltrosPadron,
  type OpcionLinea,
} from './padron';
import type { ChipDelRecorte } from './vistasDelPadron';

/**
 * LOS FILTROS DEL PADRÓN — el botón, los chips y el panel LATERAL.
 *
 * ══ LA FILA QUIETA (ADR 0102, 10-sep-2026) ══════════════════════════════════
 * Hasta el rediseño esto dibujaba su propia fila —«Más nuevos» · País · Filtros—
 * y debajo la de chips, que con el default del supervisor no se iba nunca. Ahora
 * cada pieza se exporta suelta y `PantallaPadron` las pone en UNA fila:
 *
 *   · **País entró al panel.** Era la única faceta que vivía afuera, sin otro
 *     motivo que haber sido la primera.
 *   · **El orden salió de acá.** No recorta nada, así que no cuenta en «Filtros
 *     N» ni se limpia con ellos: vive en `PantallaPadron`, al lado de Repartir.
 *   · **Los chips son sólo lo que refina a la vista** (`chipsDelRecorte`): lo
 *     que la vista puso ya lo dice el selector, y «Filtros N» cuenta esos mismos
 *     chips.
 *
 * ══ POR QUÉ UNA COLUMNA LATERAL Y NO UN POPOVER ═════════════════════════════
 * 🔴 **La primera versión fue un acordeón a ancho completo que EMPUJABA la tabla
 * fuera de la pantalla** (más de 1.000 px de alto, cero filas visibles).
 * Estephano la rechazó: «para filtrar hay que perder de vista justo lo que se
 * está filtrando». Un popover flotando encima de la tabla tiene el mismo
 * defecto, en chico. `PanelLateralFiltros` es una COLUMNA de ancho fijo (~380 px)
 * al lado de la tabla que EMPUJA su ancho, nunca más alta que la ventana:
 * scrollea por dentro, la página no.
 *
 * ══ ETAPA Y NIVEL YA NO SON FACETAS CRUDAS ═════════════════════════════════
 * Van agrupadas (`ETAPA_GRUPOS`/`NIVEL_GRUPOS`) porque un valor solo
 * —`contacted`— es el 84 % del padrón, y un desplegable de 10 valores en inglés
 * no lo puede leer un supervisor. País/Curso/Fuente siguen siendo
 * `FiltroFaceta`: esas SÍ recortan parejo.
 */

/**
 * «FILTROS N» — abre y cierra la columna lateral. `cuantos` es el largo de los
 * chips: los dos cuentan lo mismo porque salen de `chipsDelRecorte`.
 */
export function BotonFiltros({
  cuantos,
  abierto,
  onAbrirCerrar,
}: {
  cuantos: number;
  abierto: boolean;
  onAbrirCerrar: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrirCerrar(!abierto)}
      aria-expanded={abierto}
      className={`${controlDeBarraClass} ${abierto ? 'bg-muted' : ''}`}
    >
      <SlidersHorizontal size={13} className="text-muted-foreground" />
      Filtros
      {cuantos > 0 && (
        <span className="rounded-md bg-primary px-1.5 text-[10px] font-bold tabular-nums text-primary-foreground">
          {cuantos}
        </span>
      )}
    </button>
  );
}

/**
 * LO QUE REFINA A LA VISTA, EN UNA LÍNEA — y NADA si no hay: una fila vacía de
 * chips es una fila de chrome. «Limpiar filtros» vuelve a la vista puesta, no al
 * padrón entero.
 */
export function ChipsActivos({
  chips,
  onQuitar,
  onLimpiar,
}: {
  chips: ChipDelRecorte[];
  onQuitar: (cambio: Partial<FiltrosPadron>) => void;
  onLimpiar: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.llave}
          className="flex h-6 items-center gap-1 rounded-md border border-border bg-muted pl-2 pr-0.5 text-[11px] font-medium text-foreground"
        >
          {c.rotulo}
          <button
            type="button"
            onClick={() => onQuitar(c.quitar)}
            aria-label={`Quitar ${c.rotulo}`}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onLimpiar}
        className="ml-1 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Limpiar filtros
      </button>
    </div>
  );
}

/**
 * LA COLUMNA LATERAL — se monta al lado de la tabla (`PantallaPadron.tsx`
 * decide dónde: el layout es SU responsabilidad, no la de este componente).
 * Ancho fijo, alto acotado por el padre (`min-h-0` + `overflow-y-auto`): la
 * tabla nunca deja de verse mientras esto está abierto.
 */
export function PanelLateralFiltros({
  filtros,
  onCambiar,
  facetas,
  asignadoA,
  entroPorLinea,
  cargandoFacetas,
  facetasConError,
  total,
}: {
  filtros: FiltrosPadron;
  onCambiar: (p: Partial<FiltrosPadron>) => void;
  facetas: Facetas | undefined;
  /**
   * ⚠️ Props APARTE de `facetas` a propósito — el server los manda como
   * claves HERMANAS (`{ facetas, asignadoA, entroPorLinea }`), nunca uno
   * anidado en el otro. Meterlos en un solo objeto acá adentro sería recrear
   * a mano la misma confusión que ya rompió la sección Reparto en producción
   * (ver el docblock de `RespuestaFacetas` en `padron.ts`). `null` es real:
   * así llegan para quien no es supervisor.
   */
  asignadoA: FacetaReparto | null | undefined;
  entroPorLinea: OpcionLinea[] | null | undefined;
  cargandoFacetas: boolean;
  /**
   * `/api/padron/facetas` puede devolver 409 si el recorte supera el tope de
   * 100.000 — hoy con 73.145 no pasa, pero un error sin manejar acá sería peor
   * que un conteo ausente: la sección de Reparto (la única con un control que
   * no degrada solo a «sin conteo») lo explica en vez de mostrarse vacía.
   */
  facetasConError: boolean;
  /** El total del recorte actual — lo necesita «Historial de compra» para calcular «Sin información de compra». */
  total: number;
}) {
  return (
    <div className="flex min-h-0 w-[23.75rem] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <Seccion icono={<User size={13} />} titulo="Quién es">
        <div className="flex flex-wrap gap-1.5">
          <FiltroFaceta
            rotulo="País"
            opciones={facetas?.pais ?? []}
            elegidos={filtros.pais ?? []}
            cargando={cargandoFacetas}
            onAlternar={(v) => onCambiar({ pais: alternar(filtros.pais, v) })}
            onLimpiar={() => onCambiar({ pais: [] })}
          />
          <FiltroFaceta
            rotulo="Curso"
            opciones={facetas?.curso ?? []}
            elegidos={filtros.curso ?? []}
            cargando={cargandoFacetas}
            onAlternar={(v) => onCambiar({ curso: alternar(filtros.curso, v) })}
            onLimpiar={() => onCambiar({ curso: [] })}
          />
          <FiltroFaceta
            rotulo="Fuente"
            opciones={facetas?.fuente ?? []}
            elegidos={filtros.fuente ?? []}
            cargando={cargandoFacetas}
            onAlternar={(v) => onCambiar({ fuente: alternar(filtros.fuente, v) })}
            onLimpiar={() => onCambiar({ fuente: [] })}
          />
        </div>
      </Seccion>

      <Seccion icono={<MapPin size={13} />} titulo="Etapa">
        {ETAPA_GRUPOS.map((g) => (
          <OpcionGrupo
            key={g.id}
            grupo={g}
            contactos={contactosDelGrupo(facetas?.etapa, g)}
            activo={grupoActivo(g, filtros.etapa)}
            onClick={() => onCambiar({ etapa: alternarGrupo(g, filtros.etapa) })}
          />
        ))}
      </Seccion>

      <Seccion
        icono={<ShoppingBag size={13} />}
        titulo="Historial de compra"
        nota="Viene de un dato que se cargó al importar los contactos, no siempre coincide con lo que compró de verdad — se está por mejorar."
      >
        {NIVEL_GRUPOS.map((g) => (
          <OpcionGrupo
            key={g.id}
            grupo={g}
            contactos={contactosDelGrupo(facetas?.nivel, g)}
            activo={grupoActivo(g, filtros.nivel)}
            onClick={() => onCambiar({ nivel: alternarGrupo(g, filtros.nivel) })}
          />
        ))}
        <FilaSinDato contactos={contactosSinGrupo(total, facetas?.nivel, NIVEL_GRUPOS)} />
      </Seccion>

      <Seccion icono={<User size={13} />} titulo="Reparto">
        {facetasConError ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2 py-1.5 text-[11px] leading-snug text-warning-foreground">
            <AlertTriangle size={12} className="mt-px shrink-0" />
            No se pudo calcular cuántos hay por reparto — el recorte es muy grande. Prueba achicándolo con otro filtro.
          </p>
        ) : (
          opcionesDeReparto(asignadoA ?? undefined).map((o) => (
            <OpcionReparto
              key={o.id}
              opcion={o}
              activo={esSinAsignar(o) ? filtros.sinHabilitar === true : (filtros.asignadoA ?? []).includes(o.id)}
              onClick={() =>
                esSinAsignar(o)
                  ? onCambiar({ sinHabilitar: !filtros.sinHabilitar || undefined })
                  : onCambiar({ asignadoA: alternar(filtros.asignadoA, o.id) })
              }
            />
          ))
        )}
      </Seccion>

      {/* «Por dónde entró», no «Meta» — sirve para las diez líneas conocidas
          (Ventas Meta, Ventas Perú, Betto…) y ese nombre ya confundió más de
          una vez pensando que era solo del anuncio de Meta. */}
      {!!entroPorLinea?.length && (
        <Seccion icono={<MessageCircle size={13} />} titulo="Por dónde entró">
          {entroPorLinea.map((l) => (
            <OpcionReparto
              key={l.valor}
              opcion={{ id: l.valor, rotulo: l.etiqueta, contactos: l.contactos }}
              activo={(filtros.entroPorLinea ?? []).includes(l.valor)}
              onClick={() => onCambiar({ entroPorLinea: alternar(filtros.entroPorLinea, l.valor) })}
            />
          ))}
        </Seccion>
      )}

      <Seccion
        icono={<Calendar size={13} />}
        titulo="Cuándo se cargó"
        nota="Es cuándo se cargó al sistema, no siempre cuándo escribió por primera vez — se está por corregir con la fecha real."
      >
        <FiltroFecha desde={filtros.entroDesde} hasta={filtros.entroHasta} onCambiar={(v) => onCambiar(v)} />
      </Seccion>

      <Seccion icono={<ListChecks size={13} />} titulo="Compra y contacto">
        <div className="flex flex-wrap gap-1.5">
          <Toggle
            activo={filtros.conVenta === true}
            onClick={() => onCambiar({ conVenta: !filtros.conVenta || undefined })}
            titulo="Los que tienen una venta real, no los que quedaron marcados como compradores al importar"
          >
            Con venta real
          </Toggle>
          <Toggle
            activo={filtros.conTelefono === true}
            onClick={() => onCambiar({ conTelefono: !filtros.conTelefono || undefined })}
          >
            Con teléfono
          </Toggle>
        </div>
      </Seccion>
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  nota,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  /** Una duda sobre TODA la sección, no sobre un grupo — se lee antes de tocar nada. */
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-3 py-2.5 last:border-0">
      <h3 className={encabezadoSeccion}>
        {icono} {titulo}
      </h3>
      {nota && <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">{nota}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/**
 * ⚠️ **La nota de UN grupo va siempre visible SOLO si es la de «Todavía sin
 * trabajar»** (`grupo.notaSiempreVisible`): es la que evita el error caro —
 * tratar el 84 % del padrón como si fuera un recorte útil. Las demás («Le
 * falta cerrar la venta», «Ya compró») son buena información pero no pueden
 * estar las cinco abiertas a la vez en una columna de 380 px: van detrás de un
 * ícono ⓘ con el texto en el `title` nativo, a demanda.
 */
function OpcionGrupo({
  grupo,
  contactos,
  activo,
  onClick,
}: {
  grupo: GrupoCondensado;
  contactos: number;
  activo: boolean;
  onClick: () => void;
}) {
  const explicacion = grupo.aviso ?? grupo.nota;
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-xs hover:bg-muted">
      <input type="checkbox" checked={activo} onChange={onClick} className="mt-0.5 size-3.5 shrink-0 accent-navy" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{grupo.rotulo}</span>
          {explicacion && !grupo.notaSiempreVisible && (
            <span title={explicacion} className="shrink-0 text-muted-foreground/70">
              <Info size={11} />
            </span>
          )}
          <span className="shrink-0 tabular-nums text-muted-foreground">{cifra(contactos)}</span>
        </span>
        {grupo.notaSiempreVisible && grupo.aviso && (
          <span className="mt-0.5 flex items-start gap-1 text-[10px] leading-snug text-warning-foreground">
            <AlertTriangle size={11} className="mt-px shrink-0" /> {grupo.aviso}
          </span>
        )}
        {grupo.notaSiempreVisible && grupo.nota && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{grupo.nota}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Muestra el número pero NO deja tildarlo: no hay forma de PEDIR «sin dato» al
 * server hoy (`donde.ts` compara con `= ANY(array)`, que nunca hace match
 * contra NULL) — ver el docblock de `NIVEL_GRUPOS`. La casilla deshabilitada
 * (no un espacio vacío) es lo que dice «esto existe, pero no es filtrable
 * todavía» en vez de leerse como una fila rota.
 */
function FilaSinDato({ contactos }: { contactos: number }) {
  if (contactos <= 0) return null;
  return (
    <div
      className="flex cursor-not-allowed items-start gap-2 rounded-lg px-1.5 py-1.5 text-xs text-muted-foreground"
      title="Todavía no se puede filtrar por esto — falta ese dato en la base de contactos."
    >
      <input type="checkbox" disabled checked={false} className="mt-0.5 size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span>Sin historial</span>
        <span className="shrink-0 tabular-nums">{cifra(contactos)}</span>
      </span>
    </div>
  );
}

/**
 * UNA FILA DEL CONTROL DE REPARTO — «Sin asignar» o una vendedora, la misma
 * pinta para las dos. La diferencia (a cuál campo traduce el click) la decide
 * quien la usa (`esSinAsignar`, `dominio/segmentosPadron.ts`); acá adentro
 * es solo un checkbox con nombre y número, como cualquier faceta.
 */
function OpcionReparto({
  opcion,
  activo,
  onClick,
}: {
  opcion: OpcionDeReparto;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs hover:bg-muted">
      <input type="checkbox" checked={activo} onChange={onClick} className="size-3.5 shrink-0 accent-navy" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{opcion.rotulo}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{cifra(opcion.contactos)}</span>
    </label>
  );
}

/**
 * CUÁNDO ENTRÓ — dos fechas, las dos puntas inclusivas (fijado del lado del
 * server con un test). No es una `FiltroFaceta`: no hay una lista de valores
 * para elegir, es un rango.
 */
function FiltroFecha({
  desde,
  hasta,
  onCambiar,
}: {
  desde: string | undefined;
  hasta: string | undefined;
  onCambiar: (v: { entroDesde?: string; entroHasta?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <label className="flex items-center justify-between gap-1.5 text-muted-foreground">
        Desde
        <input
          type="date"
          value={desde ?? ''}
          onChange={(e) => onCambiar({ entroDesde: e.target.value || undefined })}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1 text-foreground"
        />
      </label>
      <label className="flex items-center justify-between gap-1.5 text-muted-foreground">
        Hasta
        <input
          type="date"
          value={hasta ?? ''}
          onChange={(e) => onCambiar({ entroHasta: e.target.value || undefined })}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1 text-foreground"
        />
      </label>
      {(desde || hasta) && (
        <button
          type="button"
          onClick={() => onCambiar({ entroDesde: undefined, entroHasta: undefined })}
          className="self-start text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Quitar
        </button>
      )}
    </div>
  );
}

/**
 * UN INTERRUPTOR — prende o apaga, no abre nada. El check adentro de la pill es
 * lo que lo distingue de una `FiltroFaceta` (que lleva el ícono de lista y una
 * flechita, porque abre un desplegable): antes las dos eran la misma pill con
 * borde y nada avisaba cuál hace qué.
 */
export function Toggle({
  activo,
  onClick,
  titulo,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
        activo
          ? 'border-navy bg-navy text-white'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      <span
        className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
          activo ? 'border-white bg-white/20' : 'border-current'
        }`}
      >
        {activo && <Check size={9} strokeWidth={3.5} />}
      </span>
      {children}
    </button>
  );
}
