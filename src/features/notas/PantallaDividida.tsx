import { useRef, useState } from 'react';
import { Loader2, Notebook, Paperclip, Plus, Search, X } from 'lucide-react';
import { ColumnaDeEscritura, EditorPerezoso } from './perezosos';
import { PaginaDocumento } from './PaginaDocumento';
import { TituloEditable } from './TituloEditable';
import { ACEPTA_DOCUMENTOS, ErrorDeDocumento, subirDocumento } from './documentos';
import { renglonDeEstado } from './guardado';
import { useAutoguardado, type DestinoDeGuardado } from './useAutoguardado';
import {
  type Nota,
  docParaEditor,
  resumenDeNota,
  tituloDeNota,
  useBuscarNotas,
  useMutacionesNotas,
  useNotaPorId,
} from './notas';

/**
 * DIVIDIR PANTALLA — el panel de la derecha (17-ago-2026).
 *
 * ══ TRES ESTADOS, Y LOS TRES VIVEN ACÁ Y NO EN `Libreta.tsx` ════════════════
 *
 *   1. **Eligiendo**: recién apretaste «Dividir pantalla» — buscador + lista +
 *      «Página nueva». Local y descartable: nada se escribió todavía.
 *   2. **Creando** (texto): elegiste «Página nueva» — un editor en blanco. El
 *      primer cambio la crea (en el mismo espacio que la de la izquierda —
 *      `donde`) Y la divide en el mismo movimiento (`alCrear` dispara
 *      `dividir`).
 *   3. **Dividida**: `divididaId` (que viene de la propia nota de la
 *      izquierda, persistido) ya apunta a algo — se trae con `useNotaPorId` y
 *      se edita con su propio autoguardado. Es la fuente de verdad: gana
 *      sobre los estados de arriba en cuanto el server confirma, y `tipo` de
 *      esa nota decide qué editor se monta.
 *
 * ══ POR QUÉ NO REUSA EL AUTOGUARDADO DE LA IZQUIERDA ════════════════════════
 *
 * Son dos páginas distintas escribiéndose en paralelo. Con un solo hook, tocar
 * la de la derecha reiniciaría el estado de guardado de la izquierda (mismo
 * defecto que el hook entero existe para evitar, del lado de acá).
 */
export function PantallaDividida({
  paginaIzquierdaId,
  divididaId,
  notasDisponibles,
  mutaciones,
  onCerrar,
}: {
  /** La nota de la izquierda — la que se está dividiendo. */
  paginaIzquierdaId: number;
  /** El `paginaDivididaId` YA PERSISTIDO en la nota de la izquierda, o `null`. */
  divididaId: number | null;
  /** La lista ya cargada del lugar actual, para el picker por default (sin buscar). */
  notasDisponibles: Nota[];
  mutaciones: Pick<ReturnType<typeof useMutacionesNotas>, 'crear' | 'editar' | 'dividir' | 'crearDocumento'>;
  /**
   * Cierra el panel — eligiendo o ya persistida, las dos (`Libreta.tsx` lo
   * arma para cubrir ambas). ⚠️ Antes de 19-ago-2026 esto solo servía ANTES
   * de elegir algo: con una división ya persistida, la ✕ se veía pero no
   * hacía nada — el llamador solo apagaba un estado local que `dividiendo`
   * ya no miraba una vez que `divididaId` existía.
   */
  onCerrar: () => void;
}) {
  const [fase, setFase] = useState<'eligiendo' | 'creando'>('eligiendo');
  const [busqueda, setBusqueda] = useState('');
  const termino = busqueda.trim();
  const encontradas = useBuscarNotas(termino);
  const notaDerecha = useNotaPorId(divididaId);
  const { crear, editar, dividir, crearDocumento } = mutaciones;

  /**
   * ADJUNTAR UN DOCUMENTO ACÁ (26-ago-2026) — el segundo botón, al lado de
   * «Página nueva». No es una fase más del estado de arriba: un documento no
   * se «va creando» de a poco como un texto (no hay nada que autoguardar),
   * así que sube y divide en el mismo gesto, apenas se elige el archivo —
   * igual que `adjuntarDocumento` en `Libreta.tsx`, pero terminando en
   * `dividir.mutate` en vez de seleccionar la página.
   */
  const inputDocumento = useRef<HTMLInputElement | null>(null);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  const adjuntarDocumento = async (archivo: File) => {
    setSubiendoDocumento(true);
    setErrorDocumento(null);
    try {
      const subido = await subirDocumento(archivo);
      const r = await crearDocumento.mutateAsync(subido);
      dividir.mutate({ id: paginaIzquierdaId, paginaDivididaId: r.nota.id });
    } catch (e) {
      setErrorDocumento(e instanceof ErrorDeDocumento ? e.message : 'No se pudo adjuntar el documento.');
    } finally {
      setSubiendoDocumento(false);
    }
  };

  // El destino cambia de forma sola, sin que nadie tenga que sincronizar dos
  // estados: mientras no hay `divididaId` persistido, `fase` manda; en cuanto
  // el server confirma la división (`divididaId` deja de ser null), ESTE gana
  // — así una página recién creada pasa de {tipo:'nueva'} a {tipo:'nota', id}
  // sin un salto en el medio (misma garantía que `useAutoguardado` ya da).
  const destino: DestinoDeGuardado =
    divididaId !== null ? { tipo: 'nota', id: divididaId } : fase === 'creando' ? { tipo: 'nueva' } : null;

  /**
   * ¿ES UN DOCUMENTO? No tiene una fase «creando-archivo» que mirar: como no
   * hay nada que autoguardar, el único camino para que esto sea `true` es que
   * la nota ya persistida (traída por `useNotaPorId`) diga `tipo: 'archivo'`.
   */
  const esArchivo = notaDerecha.data?.tipo === 'archivo';

  const { estado: estadoGuardado, alCambiar } = useAutoguardado({
    destino,
    puertas: {
      actualizar: (v) => editar.mutateAsync(v),
      crear: (v) => crear.mutateAsync(v),
    },
    alCrear: (id) => {
      // La creación y la división son DOS escrituras, pero desde afuera se ven
      // como una: apenas hay id, se ata a la izquierda. Si esto falla, la
      // página igual quedó creada y con su contenido — no se pierde nada,
      // solo falta el lazo, que se puede reintentar apretando el botón de
      // nuevo (una vez que `onCortarDivision` la haya soltado del todo).
      dividir.mutate({ id: paginaIzquierdaId, paginaDivididaId: id });
    },
  });

  // 🔴 UN «gestion» NO SE PUEDE ELEGIR: su `id` es de la tabla `gestiones`, no
  // de `notas` — dividir contra ese número apuntaría a lo que sea que la otra
  // tabla tenga con ese id, o a nada. Ídem la propia página de la izquierda.
  const elegibles = (termino ? (encontradas.data ?? []) : notasDisponibles).filter(
    (n) => n.origen === 'nota' && n.id !== paginaIzquierdaId,
  );

  if (divididaId !== null || fase === 'creando') {
    const notaLista = divididaId !== null ? notaDerecha.data : undefined;
    const cargando = divididaId !== null && notaDerecha.isPending;
    const fallo = divididaId !== null && notaDerecha.isError;
    const titulo = notaLista ? tituloDeNota(notaLista) || 'Sin título' : 'Página nueva';

    return (
      <div role="region" aria-label="Pantalla dividida">
        {/*
          EL MISMO PAR `pt-4 pb-4` + `w-[21cm]` QUE `anchoDeAcciones` EN
          `Libreta.tsx` (19-ago-2026, bajado de `pt-8` a `pt-4` el
          03-sep-2026 a pedido explícito — ver el comentario 🔴 de ese
          archivo) — antes esto era `h-11 border-b px-4` y la mitad
          izquierda usaba su propio padding + botones con borde: dos cajas
          distintas, dos alturas distintas, y la hoja de cada lado arrancaba
          a una altura diferente. `min-h-7` en el renglón de abajo es la otra
          mitad de ESE acuerdo — mide lo mismo tenga un botón (con borde, más
          alto) o solo texto.

          `px-[1.27cm]` y no `px-[2.5cm]`: esta mitad SIEMPRE está dividida
          (es la que arma `PantallaDividida`), así que acompaña siempre al
          margen angosto de `.hoja-a4--dividida` — el mismo acuerdo que
          `anchoDeAcciones` en `Libreta.tsx`, rama `dividiendo`.
        */}
        <div className="mx-auto box-border w-[21cm] max-w-full px-[1.27cm] pt-4 pb-4">
          <div className="flex min-h-7 items-center gap-2">
            {/* NOMBRAR EL DOCUMENTO desde acá también — mismo campo que en la
                mitad izquierda (`AccionesDePagina`). Solo cuando ya existe de
                verdad: uno recién creado sin id todavía no tiene qué editar
                (`notaLista` es `undefined` hasta que el server confirma). */}
            {esArchivo && notaLista ? (
              <TituloEditable
                valor={notaLista.texto}
                placeholder="Nombra el documento"
                onGuardar={(texto) => mutaciones.editar.mutate({ id: notaLista.id, texto })}
                className="h-7 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-xs font-medium text-muted-foreground outline-none hover:border-input focus:border-ring focus:text-foreground"
              />
            ) : (
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{titulo}</p>
            )}
            {(() => {
              const r = renglonDeEstado(estadoGuardado, notaLista?.editadoAt ?? null);
              if (!r.texto) return null;
              return (
                <span
                  className={'shrink-0 text-xs ' + (r.hayFallo ? 'font-medium text-destructive' : 'text-muted-foreground')}
                  aria-live="polite"
                >
                  {r.texto}
                </span>
              );
            })()}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar la pantalla dividida"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {cargando && <p className="px-6 py-8 text-sm text-muted-foreground">Cargando…</p>}
        {fallo && <p className="px-6 py-8 text-sm text-destructive">No se pudo traer esa página.</p>}

        {/* Un documento es de solo lectura, así que la hoja A4 (con su
            margen para escribir) no aplica.
            ⚠️ SIN `pt-3` — mismo motivo que en `Libreta.tsx`: la cabecera de
            arriba ya mide lo mismo que la de la mitad izquierda (`pt-4 pb-4`
            + `min-h-7` en las dos), así que un relleno propio acá bajaba el
            visor 12px respecto de la hoja de al lado. Si cambia acá, cambiar
            en `Libreta.tsx` también. */}
        {esArchivo
          ? notaLista && (
              <div className="px-3 pb-3">
                <PaginaDocumento key={`div-${divididaId}`} nota={notaLista} />
              </div>
            )
          : (fase === 'creando' || notaLista) && (
              // Misma hoja A4 que la mitad izquierda (`.hoja-a4` se achica a
              // proporción, no se desborda): las dos mitades quedan del
              // mismo tamaño, aprovechando el ancho que el panel realmente
              // tiene. `dividida` le da el margen angosto (1,27cm en vez de
              // 2,5) — más ancho para el texto en una hoja que ya comparte
              // pantalla con otra.
              <ColumnaDeEscritura dividida>
                <EditorPerezoso
                  key={divididaId !== null ? `div-${divididaId}` : 'div-nueva'}
                  contenidoInicial={notaLista ? docParaEditor(notaLista) : undefined}
                  soloLectura={false}
                  onCambio={(doc) => alCambiar({ doc })}
                />
              </ColumnaDeEscritura>
            )}
      </div>
    );
  }

  // ── ELIGIENDO ──
  return (
    <div role="region" aria-label="Pantalla dividida">
      <div className="flex h-11 items-center gap-2 border-b border-border px-4">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">Dividir pantalla</p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cancelar"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar una página…"
            aria-label="Buscar una página para dividir"
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>

        {/* LAS DOS FORMAS DE ARRANCAR, una al lado de la otra — «Página
            nueva» ya estaba; «Adjuntar» es la segunda (26-ago-2026), mismo
            trato: un clic y queda dividida contra lo nuevo, sin un paso
            intermedio. */}
        <div className="mb-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setFase('creando')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
          >
            <Plus className="size-4" />
            Página nueva
          </button>
          <button
            type="button"
            onClick={() => inputDocumento.current?.click()}
            disabled={subiendoDocumento}
            title="PDF, Word (.docx) o texto (.txt)"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
          >
            {subiendoDocumento ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            Adjuntar
          </button>
        </div>

        <input
          ref={inputDocumento}
          type="file"
          aria-label="Elegir documento"
          accept={ACEPTA_DOCUMENTOS}
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) void adjuntarDocumento(archivo);
          }}
        />
        {errorDocumento && <p className="mb-2 text-xs text-destructive">{errorDocumento}</p>}

        <div className="space-y-0.5">
          {elegibles.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => dividir.mutate({ id: paginaIzquierdaId, paginaDivididaId: n.id })}
              className="block w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-border hover:bg-muted"
            >
              <span className="block truncate text-sm font-medium text-foreground">{tituloDeNota(n) || 'Sin título'}</span>
              {resumenDeNota(n) && <p className="mt-0.5 truncate text-xs text-muted-foreground">{resumenDeNota(n)}</p>}
            </button>
          ))}

          {elegibles.length === 0 && (
            <p className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-muted-foreground">
              <Notebook className="size-6 text-muted-foreground/40" />
              {termino ? 'Nada con ese término.' : 'No hay otra página acá — crea una nueva.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
