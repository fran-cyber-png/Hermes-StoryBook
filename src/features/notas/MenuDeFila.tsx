import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  Download,
  Link2,
  Lock,
  MoreVertical,
  MoveRight,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Users,
} from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import type { DondeEstoy, Espacio } from './espacios';

/**
 * EL MENÚ `⋮` DE LA FILA — fijar, mover, compartir y archivar una página SIN
 * abrirla (04-sep-2026, a pedido explícito del dueño).
 *
 * ══ QUÉ REEMPLAZA ════════════════════════════════════════════════════════════
 *
 * Antes de esto, «fijar» y «archivar» eran dos iconos sueltos flotando sobre la
 * fila (al hover), y «mover»/«compartir con link» solo existían en la barra de
 * arriba del editor, viendo la página ya ABIERTA (`AccionesDePagina.tsx`, ADR
 * 0047 — que ADR 0092 todavía daba por «tal cual el mockup los pedía»). Se
 * juntan las cuatro acciones en un solo botón `⋮` por fila, molde de
 * `canales/MenuFila.tsx` (mismo `usePopover`, mismo panel `absolute` con
 * `shadow-panel`, sin roles de menú — botones planos en un panel). Ver ADR 0093.
 *
 * ⚠️ **«Compartir con link» pasa a llamarse, a secas, «Compartir»**: el ícono
 * `Link2` que ya se dibuja al lado del título cuando hay un link activo
 * (`FilaPagina`, «que está afuera se dice en la lista») es quien sigue
 * afirmando «esto está compartido», así que el rótulo del ítem no necesita
 * repetirlo — y deja de sonar a que el link es la única forma de compartir.
 *
 * ══ «MOVER» ES UNA SEGUNDA VISTA DEL MISMO PANEL, NO UN SEGUNDO POPOVER ═════
 *
 * La lista de destinos (`Mi libreta` + cada espacio) y el aviso de «esto se lo
 * saca a tu equipo» (`ConfirmarSacarDelEquipo`, calcado de `AccionesDePagina.tsx`
 * de antes de este cambio) viven ADENTRO del mismo panel que abrió el disparador
 * — cambia `vista`, no `abierto`. Con un popover propio para «mover» habría dos
 * capas de Escape en captura compitiendo por el mismo evento (la cicatriz de
 * ADR 0024): acá solo hay UNA, y basta con `usePopover` una vez.
 *
 * «Compartir» en cambio abre un MODAL (`ModalDeLink`, centrado, `z-40`) — y ese
 * modal no vive acá: `MenuDeFila` solo avisa (`onCompartir`) y el padre
 * (`Libreta.tsx`) decide qué nota mostrar, con el mismo criterio con el que ya
 * resuelve `paginaAbierta` (buscarla en la lista VIVA, no guardar una foto
 * vieja — si no, «Generar el link» dejaría el modal mostrando el token
 * anterior hasta que algo más fuerce un refetch).
 *
 * ══ «DESCARGAR» (04-sep-2026) — solo para una página-documento ═══════════════
 *
 * Reemplaza al botón «Descargar» que vivía adentro de `PaginaDocumento.tsx`,
 * sobre una cabecera (ícono + nombre + tamaño) que ocupaba media pantalla de
 * alto ANTES de mostrar una sola línea del documento — a pedido explícito del
 * dueño: esa cabecera se saca entera, y «Descargar» se muda acá para que
 * quede al lado de cada página LISTADA, sin tener que abrirla primero.
 * `onDescargar` es **opcional**: solo lo manda `Libreta.tsx` cuando
 * `nota.tipo === 'archivo'` — una página de texto no tiene nada que bajar.
 *
 * ══ «RENOMBRAR» (04-sep-2026) — se muda acá adentro, a pedido explícito ═════
 *
 * Vivía como un lápiz suelto al hover, afuera de este menú (`FilaPagina.tsx`
 * antes de este cambio); el hueco que dejó lo ocupa la estrella de Favoritos.
 * Viaja como prop APARTE (`onRenombrar`, no adentro de `AccionDeFila`) porque
 * no dispara una mutación: activa el `editando`/`TituloEditable` que ya vive
 * en `FilaPagina` — este menú solo tiene que pedirle que se muestre. Opcional,
 * igual que `onDescargar`: `FilaPagina` lo manda solo para `tipo === 'archivo'`
 * (el único caso donde el nombre es un campo propio y no la primera línea del
 * documento — ver su docblock).
 */
export type AccionDeFila =
  | {
      tipo: 'normal';
      onFijar: () => void;
      /** Entra/sale de Favoritos (04-sep-2026, ADR 0093) — independiente de `onFijar`. */
      onFavorito: () => void;
      onArchivar: () => void;
      onMover: (destino: DondeEstoy) => void;
      onCompartir: () => void;
      donde: DondeEstoy;
      espacios: readonly Espacio[];
      vendedoraId?: string | null;
      onDescargar?: () => void;
    }
  | { tipo: 'papelera'; onRestaurar: () => void; onEliminarParaSiempre: () => void; onDescargar?: () => void };

/**
 * EL AVISO QUE NADIE ESPERA — calcado de `AccionesDePagina.tsx` de antes de
 * este cambio (ahí vivía porque «mover» vivía ahí; el texto no cambió una
 * palabra). Traer una página del espacio a tu libreta privada se la saca a
 * todos los demás, y en la pantalla de ellos simplemente desaparece.
 */
function ConfirmarSacarDelEquipo({
  espacio,
  vendedoraId,
  onSi,
  onNo,
}: {
  espacio: Espacio;
  vendedoraId?: string | null;
  onSi: () => void;
  onNo: () => void;
}) {
  const otros = espacio.miembros.filter((m) => m.trim().toLowerCase() !== (vendedoraId ?? '').trim().toLowerCase());

  return (
    <div role="alertdialog" className="rounded-lg border border-border bg-card p-3 text-sm">
      <p className="font-medium text-foreground">Traerla a tu libreta la saca del espacio</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {otros.length > 0
          ? `${otros.join(', ')} dejan de verla.`
          : 'Nadie más la está viendo, así que no le saca nada a nadie.'}
      </p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={onSi}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Traerla igual
        </button>
        <button type="button" onClick={onNo} className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
          Dejarla acá
        </button>
      </div>
    </div>
  );
}

export function MenuDeFila({
  fijada,
  accion,
  onRenombrar,
}: {
  fijada: boolean;
  accion: AccionDeFila;
  /** Ver el docblock de arriba, «RENOMBRAR». Ausente = la fila no se puede renombrar. */
  onRenombrar?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<'menu' | 'mover'>('menu');
  const [confirmarSalida, setConfirmarSalida] = useState<DondeEstoy | 'no'>('no');
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const primerItemRef = useRef<HTMLButtonElement>(null);

  function cerrar() {
    setAbierto(false);
    setVista('menu');
    setConfirmarSalida('no');
    disparadorRef.current?.focus();
  }

  const { propsOverlay } = usePopover(abierto, cerrar, { z: 'z-20' });

  useEffect(() => {
    if (abierto) primerItemRef.current?.focus();
  }, [abierto, vista]);

  const espacioActual =
    accion.tipo === 'normal' ? (accion.espacios.find((e) => e.id === accion.donde) ?? null) : null;

  function pedirMover(destino: DondeEstoy) {
    if (accion.tipo !== 'normal') return;
    // Sacar del equipo es lo único que se pregunta. Compartir hacia un espacio
    // no le quita nada a nadie, así que preguntarlo sería un clic de peaje.
    if (accion.donde !== null && destino === null) {
      setConfirmarSalida(destino);
      return;
    }
    accion.onMover(destino);
    cerrar();
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={disparadorRef}
        type="button"
        aria-label="Más acciones de la página"
        aria-haspopup="true"
        aria-expanded={abierto}
        title="Más acciones"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className={
          'rounded p-1 transition-colors ' +
          (abierto ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground')
        }
      >
        <MoreVertical className="size-3.5" />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute right-0 top-7 z-30 w-56 rounded-xl bg-card p-1.5 shadow-panel">
            {vista === 'menu' && accion.tipo === 'normal' && (
              <>
                {onRenombrar && (
                  <button
                    ref={primerItemRef}
                    type="button"
                    onClick={() => {
                      onRenombrar();
                      cerrar();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                    Renombrar
                  </button>
                )}
                <button
                  ref={onRenombrar ? undefined : primerItemRef}
                  type="button"
                  onClick={() => {
                    accion.onFijar();
                    cerrar();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  {fijada ? <PinOff className="size-3.5 shrink-0 text-muted-foreground" /> : <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
                  {fijada ? 'Desfijar' : 'Fijar'}
                </button>
                <button
                  type="button"
                  onClick={() => setVista('mover')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <MoveRight className="size-3.5 shrink-0 text-muted-foreground" />
                  Mover
                </button>
                <button
                  type="button"
                  onClick={() => {
                    accion.onCompartir();
                    cerrar();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                  Compartir
                </button>
                {accion.onDescargar && (
                  <button
                    type="button"
                    onClick={() => {
                      accion.onDescargar?.();
                      cerrar();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Download className="size-3.5 shrink-0 text-muted-foreground" />
                    Descargar
                  </button>
                )}
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => {
                    accion.onArchivar();
                    cerrar();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-destructive"
                >
                  <Archive className="size-3.5 shrink-0" />
                  Archivar
                </button>
              </>
            )}

            {vista === 'mover' && accion.tipo === 'normal' && confirmarSalida === 'no' && (
              <>
                <button
                  ref={primerItemRef}
                  type="button"
                  onClick={() => setVista('menu')}
                  className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  ‹ Llevarla a
                </button>
                <button
                  type="button"
                  disabled={accion.donde === null}
                  onClick={() => pedirMover(null)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40"
                >
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">Mi libreta</span>
                  {accion.donde === null && <Check className="size-3.5 shrink-0" />}
                </button>
                {accion.espacios.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={accion.donde === e.id}
                    onClick={() => pedirMover(e.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40"
                  >
                    <Users className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{e.nombre}</span>
                    {accion.donde === e.id && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
                {accion.espacios.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Todavía no tienes espacios.</p>
                )}
              </>
            )}

            {vista === 'mover' && accion.tipo === 'normal' && confirmarSalida !== 'no' && espacioActual && (
              <ConfirmarSacarDelEquipo
                espacio={espacioActual}
                vendedoraId={accion.vendedoraId}
                onSi={() => {
                  // Directo a `onMover`, no de vuelta a `pedirMover`: ya se
                  // confirmó, y `pedirMover` volvería a preguntar (`donde` no
                  // cambió, `destino` sigue siendo `null`) — el mismo bucle
                  // que `AccionesDePagina.tsx` nunca tuvo por evitar justo esto.
                  accion.onMover(confirmarSalida);
                  cerrar();
                }}
                onNo={() => setConfirmarSalida('no')}
              />
            )}

            {accion.tipo === 'papelera' && (
              <>
                {onRenombrar && (
                  <button
                    ref={primerItemRef}
                    type="button"
                    onClick={() => {
                      onRenombrar();
                      cerrar();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                    Renombrar
                  </button>
                )}
                <button
                  ref={onRenombrar ? undefined : primerItemRef}
                  type="button"
                  onClick={() => {
                    accion.onRestaurar();
                    cerrar();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <ArchiveRestore className="size-3.5 shrink-0 text-muted-foreground" />
                  Restaurar
                </button>
                {accion.onDescargar && (
                  <button
                    type="button"
                    onClick={() => {
                      accion.onDescargar?.();
                      cerrar();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Download className="size-3.5 shrink-0 text-muted-foreground" />
                    Descargar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    accion.onEliminarParaSiempre();
                    cerrar();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-destructive"
                >
                  <Trash2 className="size-3.5 shrink-0" />
                  Eliminar para siempre
                </button>
              </>
            )}
          </div>
        </>
      )}
    </span>
  );
}
