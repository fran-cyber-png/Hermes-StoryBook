import { useEffect, useRef, useState } from 'react';
import { Camera, Check, KeyRound, Loader2, Pencil, Settings, Smartphone, Trash2, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { API_URL } from '../../config';
import { useBlobAutenticado } from '../../lib/datos/blobAutenticado';
import { inicial } from '../../lib/iniciales';
import { ErrorApi } from '../../lib/datos/cliente';
import { formatoTelefono } from '../../lib/formato';
import { useLineas, type LineaWhatsapp } from '../../dominio/lineas';
import { VincularMiWhatsapp } from '../whatsapp/VincularMiWhatsapp';
import { DesvincularMiWhatsapp } from '../whatsapp/DesvincularMiWhatsapp';
import { motivoParaVincular, rotuloDeVincular, useMiLinea, type MotivoDeVincular } from '../whatsapp/miLinea';
import { CambiarClave } from './CambiarClave';
import { esIdentidadDeCenturion } from './identidad';
import { TOPE_NOMBRE, usePerfil, useGuardarPerfil, useSubirFotoDePerfil, useQuitarFotoDePerfil } from './perfil';
import type { Vendedora } from './sesion';
import { useEstadoDeActividad, type EstadoActividad, type FuenteDeActividad } from './actividad';

/**
 * «CONFIGURACIÓN» — el modal que reemplaza al viejo popover cargado del
 * avatar. Pedido del dueño (20-ago-2026): el popover queda con dos botones
 * (Configuración, Cerrar sesión) y todo lo demás —incluida la info de
 * diagnóstico que había antes (sesión de Cerberus, líneas propias)— se
 * elimina o se muda para acá.
 *
 * Partido en DOS, como `CambiarClave`/`VistaCambiarClave`: acá el cableado
 * (los hooks de datos), en `VistaConfiguracionPerfil` lo que se DIBUJA — así
 * el candado de «a quién se le ofrece Vincular tu WhatsApp / Cambiar
 * contraseña» (`ConfiguracionPerfil.test.tsx`, migrado de
 * `PanelUsuario.lineaPropia.test.tsx`) monta la vista con props resueltas a
 * mano, sin mockear `fetch` para tres hooks de red.
 */
export function ConfiguracionPerfil({
  vendedora,
  onCerrar,
  onPerfilActualizado,
  actividad,
}: {
  vendedora: Vendedora;
  onCerrar: () => void;
  /** Avisa cuando nombre/apodo/foto cambiaron, para que el riel se actualice. */
  onPerfilActualizado: () => void;
  /**
   * El latido de la sesión (`useLatidoDeSesion`, calculado en `App.tsx`).
   *
   * 🔴 Llega como FUENTE y no como estado ya calculado, y esa es la corrección:
   * el cronómetro tickea cada segundo, y mientras vivió en `App.tsx` ese tick
   * re-renderizaba la app entera todo el día para mover un número que sólo se
   * ve acá. Este componente se monta con el modal, así que acá el reloj corre
   * exactamente mientras alguien lo mira.
   */
  actividad: FuenteDeActividad;
}) {
  // EL CRONÓMETRO, ACÁ Y NO EN LA RAÍZ. Este componente existe sólo mientras el
  // modal está abierto, así que el `setInterval` de un segundo vive exactamente
  // lo que dura la mirada. Ver `actividad.ts`.
  const estadoActividad = useEstadoDeActividad(actividad);
  const { data: perfil } = usePerfil();
  const guardar = useGuardarPerfil();
  const subirFoto = useSubirFotoDePerfil();
  const quitarFoto = useQuitarFotoDePerfil();

  const { lineas } = useLineas();
  const mias = lineas.filter((l) => l.mias === true);
  const tienePropia = mias.some((l) => l.compartida !== true);
  const { data: miLinea } = useMiLinea();
  // La fecha del último pareo va como tercer argumento: sin ella, `desconectado`
  // se lee como transitorio y una línea que NUNCA se pareó se queda sin botón.
  const motivoVincular = motivoParaVincular(
    tienePropia,
    miLinea?.sesion?.estado,
    miLinea?.sesion?.vinculado_at,
  );

  return (
    <VistaConfiguracionPerfil
      vendedora={vendedora}
      fotoUrl={perfil?.fotoUrl ?? vendedora.fotoUrl ?? null}
      numeroVinculado={miLinea?.numero ?? null}
      conectada={miLinea?.sesion?.estado === 'conectado'}
      lineasPropias={mias}
      motivoVincular={motivoVincular}
      onCerrar={onCerrar}
      onGuardar={(campos) =>
        guardar.mutate(campos, {
          onSuccess: onPerfilActualizado,
        })
      }
      guardando={guardar.isPending}
      errorGuardar={guardar.error instanceof ErrorApi ? guardar.error.message : guardar.isError ? 'No se guardó — prueba de nuevo.' : null}
      onElegirFoto={(archivo) => subirFoto.mutate(archivo, { onSuccess: onPerfilActualizado })}
      subiendoFoto={subirFoto.isPending}
      errorFoto={subirFoto.error instanceof ErrorApi ? subirFoto.error.message : subirFoto.isError ? 'No se pudo subir la foto.' : null}
      onQuitarFoto={() => quitarFoto.mutate(undefined, { onSuccess: onPerfilActualizado })}
      quitandoFoto={quitarFoto.isPending}
      actividad={estadoActividad}
    />
  );
}

/** El input de archivo vive acá, no en la vista pura: es DOM real, no un dato para testear con props. */
function useSelectorDeFoto(onElegir: (archivo: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onChange={(e) => {
        const archivo = e.target.files?.[0];
        if (archivo) onElegir(archivo);
        e.target.value = '';
      }}
    />
  );
  return { abrir: () => ref.current?.click(), input };
}

export function VistaConfiguracionPerfil({
  vendedora,
  fotoUrl,
  numeroVinculado = null,
  conectada = false,
  lineasPropias = [],
  motivoVincular,
  onCerrar,
  onGuardar,
  guardando,
  errorGuardar,
  onElegirFoto,
  subiendoFoto,
  errorFoto,
  onQuitarFoto,
  quitandoFoto,
  actividad,
}: {
  vendedora: Vendedora;
  /** La ruta de la foto YA resuelta (server u optimista) — la vista no decide de dónde sale. */
  fotoUrl: string | null;
  /** El número que trajo por auto-vinculación (`useMiLinea`), no el de `numero_vendedora`. */
  numeroVinculado?: string | null;
  /** `sesion?.estado === 'conectado'` — la MISMA lectura que `motivoParaVincular`. */
  conectada?: boolean;
  /** Las líneas que `numero_vendedora` le asigna, propias o del equipo (`useLineas`). */
  lineasPropias?: LineaWhatsapp[];
  /** `null` = no se ofrece vincular. La regla la resuelve `motivoParaVincular` (`whatsapp/miLinea.ts`). */
  motivoVincular?: MotivoDeVincular | null;
  onCerrar: () => void;
  onGuardar: (campos: { nombre: string }) => void;
  guardando: boolean;
  errorGuardar: string | null;
  onElegirFoto: (archivo: File) => void;
  subiendoFoto: boolean;
  errorFoto: string | null;
  /** Pedido del dueño (20-ago-2026): poder volver al respaldo (la inicial) sin subir una foto nueva. */
  onQuitarFoto: () => void;
  quitandoFoto: boolean;
  /** El latido de la sesión (`useActividadDeSesion`): ACTIVO/INACTIVO + el cronómetro `HH:mm:ss`. */
  actividad: EstadoActividad;
}) {
  useEscape(onCerrar);
  const [vinculando, setVinculando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  // Cualquiera de los tres abre un modal PROPIO por encima de éste (ver el
  // docblock de `VincularMiWhatsapp`) — mientras esté abierto, esta tarjeta
  // retrocede (se achica y se apaga un toque) para que se note que sigue
  // ahí, en pausa, y no que desapareció. Pedido del dueño, 10-sep-2026.
  const haySubModal = vinculando || desvinculando || cambiandoClave;

  // El botón ROJO reemplaza al verde una vez que la auto-vinculación anda: con
  // `motivoVincular` en null por «conectado» (ver `motivoParaVincular`,
  // `whatsapp/miLinea.ts`) y una línea propia de verdad conectada, no hay
  // ambigüedad entre «no tiene nada que ofrecer» y «tiene algo que cortar».
  const puedeDesvincular = Boolean(numeroVinculado) && conectada;

  const [nombre, setNombre] = useState(vendedora.nombre);
  const [tocado, setTocado] = useState(false);

  // EL CHECK VERDE — «Guardar» confirma en vez de solo volver a su texto de
  // siempre. Se dispara al ver `guardando` pasar de true a false SIN error:
  // no hay un evento de éxito propio, así que el gesto es leer la transición.
  const [guardadoReciente, setGuardadoReciente] = useState(false);
  const guardandoAntes = useRef(guardando);
  useEffect(() => {
    const veniaGuardando = guardandoAntes.current;
    guardandoAntes.current = guardando;
    if (veniaGuardando && !guardando && !errorGuardar) {
      setGuardadoReciente(true);
      const id = setTimeout(() => setGuardadoReciente(false), 1200);
      return () => clearTimeout(id);
    }
  }, [guardando, errorGuardar]);

  const { url: foto } = useBlobAutenticado(fotoUrl ? `${API_URL}${fotoUrl}` : null);
  const { abrir: abrirSelectorDeFoto, input: inputFoto } = useSelectorDeFoto(onElegirFoto);

  return (
    <>
      {/* El contenedor de z-50 cubre TODA la pantalla (para centrar la tarjeta) y
          por eso queda encima del overlay: un click afuera de la tarjeta nunca
          llegaba al `onClick` del overlay de abajo. El cierre va acá, y la
          tarjeta corta la propagación para no cerrarse con un click adentro. */}
      <div className="fixed inset-0 z-40 animate-velo-entrar bg-navy/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configuración"
          onClick={(e) => e.stopPropagation()}
          className={
            'flex w-full max-w-sm animate-modal-entrar flex-col overflow-hidden rounded-2xl bg-card shadow-panel ' +
            'transition-[transform,filter] duration-[240ms] ease-house ' +
            (haySubModal ? 'scale-[0.94] translate-y-[6px] filter brightness-[0.82] blur-[0.3px]' : '')
          }
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <Settings size={16} /> Configuración
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onCerrar}
              className="rounded-lg p-1 transition-transform duration-150 ease-house hover:rotate-90 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex flex-col gap-4 p-5">
            {/* LA FOTO — o la primera letra, si no hay una. Una sola letra: es SU
                avatar, no el de un contacto (dos letras se ven apretadas en un
                círculo chico).
                El CÍRCULO ENTERO es el botón de elegir/cambiar — pedido del
                dueño, 10-sep-2026: un velo centrado en el círculo (cámara si
                todavía no hay foto, lápiz si ya la hay — la acción es
                literalmente distinta: una AÑADE, la otra REEMPLAZA) en vez de
                un botón de 24px aparte. Eliminar es la única acción que queda
                como chapa propia — no tiene sentido meterla adentro del mismo
                click que abre el selector — y se recorta en la esquina
                inferior derecha, mordiendo el borde del círculo. */}
            <div className="flex items-center gap-3">
              <span className="relative shrink-0">
                <button
                  type="button"
                  onClick={abrirSelectorDeFoto}
                  disabled={subiendoFoto}
                  aria-label={foto ? 'Cambiar foto de perfil' : 'Añadir foto de perfil'}
                  title={foto ? 'Cambiar foto de perfil' : 'Añadir foto de perfil'}
                  className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-navy font-heading text-2xl font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait"
                >
                  {foto ? <img src={foto} alt="" className="size-full object-cover" /> : inicial(vendedora.nombre)}
                  <span
                    aria-hidden="true"
                    className={
                      'absolute inset-0 flex items-center justify-center rounded-full bg-navy/65 transition-opacity duration-150 ease-house group-hover:opacity-100 group-focus-visible:opacity-100 ' +
                      (subiendoFoto ? 'opacity-100' : 'opacity-0')
                    }
                  >
                    <span
                      className={
                        'scale-75 transition-transform duration-150 ease-house group-hover:scale-100 group-focus-visible:scale-100 ' +
                        (subiendoFoto ? 'scale-100' : '')
                      }
                    >
                      {subiendoFoto ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : foto ? (
                        <Pencil size={20} />
                      ) : (
                        <Camera size={20} />
                      )}
                    </span>
                  </span>
                </button>
                {/* Quitar la foto — solo tiene sentido si hay una que quitar. */}
                {foto && (
                  <button
                    type="button"
                    onClick={onQuitarFoto}
                    disabled={quitandoFoto}
                    aria-label="Quitar foto de perfil"
                    title="Quitar foto de perfil"
                    className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-panel transition-[background-color,transform] duration-150 ease-house hover:scale-110 hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {quitandoFoto ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                )}
                {inputFoto}
              </span>
              <div className="min-w-0">
                {/* El nombre un escalón arriba (text-base, no text-sm) — pedido
                    del dueño, 10-sep-2026: que se note más la distancia con la
                    línea de abajo en vez de quedar los dos casi parejos. */}
                <p className="truncate text-base font-bold text-foreground">{vendedora.nombre}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-semibold">Usuario Cerberus:</span>{' '}
                  <span className="font-mono" title={vendedora.id}>
                    {vendedora.id}
                  </span>
                </p>
                {/* Apiladas, una debajo de la otra — no lado a lado. Número
                    vinculado y actividad son dos preguntas distintas y cada
                    una se lee sola, igual que en el resumen del popover. */}
                <div className="mt-1.5 flex flex-col items-start gap-1.5">
                  <EstadoChip conectada={conectada}>
                    {numeroVinculado ? formatoTelefono(numeroVinculado) : 'Sin número vinculado'}
                  </EstadoChip>
                  {/* EL LATIDO DE LA SESIÓN — pedido del dueño. Mismo punto
                      verde/rojo de arriba, misma píldora: no es un widget
                      nuevo, es una fila más de este mismo resumen. */}
                  <EstadoChip conectada={actividad.activo}>
                    {actividad.activo ? 'Activo' : 'Inactivo'}
                    {actividad.transcurrido && <> · {actividad.transcurrido}</>}
                  </EstadoChip>
                </div>
              </div>
            </div>

            {errorFoto && <p className="text-[11px] text-destructive">{errorFoto}</p>}

            {/* NOMBRE */}
            <div className="flex flex-col gap-3">
              <Campo
                rotulo="Nombre"
                valor={nombre}
                tope={TOPE_NOMBRE}
                onCambio={(v) => {
                  setNombre(v);
                  setTocado(true);
                }}
              />
              {errorGuardar && <p className="text-[11px] text-destructive">{errorGuardar}</p>}
              <button
                type="button"
                onClick={() => {
                  onGuardar({ nombre: nombre.trim() });
                  setTocado(false);
                }}
                disabled={!tocado || guardando}
                className={
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-primary-foreground transition-colors disabled:opacity-40 ' +
                  (guardadoReciente ? 'bg-success' : 'bg-primary hover:bg-primary-hover')
                }
              >
                {guardando && <Loader2 size={14} className="animate-spin" />}
                {guardadoReciente && !guardando && <Check size={14} />}
                {guardando ? 'Guardando…' : guardadoReciente ? 'Guardado' : 'Guardar'}
              </button>
            </div>

            <div className="border-t border-border" />

            {/* TUS LÍNEAS — vuelve del viejo popover (pedido del dueño,
                20-ago-2026): lo que `numero_vendedora` le asigna, propia o
                del equipo. Es OTRO dato que el «Número Vinculado» de arriba
                (ese es solo la auto-vinculación por QR de esta persona). */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Tus líneas</p>
              {lineasPropias.length === 0 ? (
                <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2.5 text-center">
                  <Smartphone size={16} className="text-muted-foreground/70" />
                  <p className="text-[11px] text-muted-foreground">No tienes ninguna asignada.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {lineasPropias.map((l) => (
                    <li
                      key={l.numero}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11px] font-semibold text-foreground">{l.etiqueta}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatoTelefono(l.numero)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border" />

            {/* LA CUENTA — se mudó tal cual desde el viejo popover. */}
            <div className="flex flex-col gap-1.5">
              {motivoVincular && (
                <button
                  type="button"
                  onClick={() => setVinculando(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-success/50 py-1.5 text-[11px] font-bold text-success transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-house hover:-translate-y-0.5 hover:border-success hover:bg-success/10 hover:shadow-panel"
                >
                  <Smartphone size={12} /> {rotuloDeVincular(motivoVincular)}
                </button>
              )}
              {/* La línea está registrada y no atiende: decirlo importa tanto
                  como el botón — sin esto, «tengo mi línea puesta» y «mi línea
                  anda» se ven igual. */}
              {motivoVincular === 'linea_muda' && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Tu línea está registrada pero no está conectada.
                </p>
              )}
              {/* El ROJO — misma forma que el botón verde de arriba, mismo
                  ícono, solo cambia el color y la acción. */}
              {puedeDesvincular && (
                <button
                  type="button"
                  onClick={() => setDesvinculando(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/50 py-1.5 text-[11px] font-bold text-destructive transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-house hover:-translate-y-0.5 hover:border-destructive hover:bg-destructive/10 hover:shadow-panel"
                >
                  <Smartphone size={12} /> Desvincular WhatsApp
                </button>
              )}
              {/*
                Antes solo se ofrecía a quien tiene sesión de Cerberus: una
                identidad de Centurión (candidatos de campaña) no tiene clave
                en Cerberus, así que el botón desaparecía sin explicación.
                Ahora se muestra SIEMPRE — para Centurión, `CambiarClave` dibuja
                un aviso en vez del formulario (ver su docblock: el backend que
                de verdad cambiaría esa clave en Centurión todavía no existe).
              */}
              <button
                type="button"
                onClick={() => setCambiandoClave(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/50 py-1.5 text-[11px] font-bold text-primary transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-house hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-panel"
              >
                <KeyRound size={12} /> Cambiar contraseña
              </button>
            </div>
          </div>
        </div>
      </div>

      {vinculando && (
        <VincularMiWhatsapp
          // Su propio número prellena el campo: el server sólo acepta ESE para
          // re-vincular, y hasta hoy había que adivinarlo.
          numeroPropio={numeroVinculado}
          onCerrar={() => setVinculando(false)}
        />
      )}
      {desvinculando && <DesvincularMiWhatsapp onCerrar={() => setDesvinculando(false)} />}
      {cambiandoClave && (
        <CambiarClave onCerrar={() => setCambiandoClave(false)} esCenturion={esIdentidadDeCenturion(vendedora.id)} />
      )}
    </>
  );
}

/**
 * EL PUNTO VERDE/ROJO — «¿el número que trajo por QR está atendiendo ahora?».
 * Se comparte entre acá y `PanelUsuario` (el resumen del popover), así que
 * vive acá y se importa: dos puntos con criterios distintos serían el #37
 * de siempre, sobre un dato binario que además titila.
 */
export function PuntoDeConexion({ conectada }: { conectada: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'inline-block size-2 shrink-0 rounded-full ' + (conectada ? 'animate-pulse bg-success' : 'bg-destructive')
      }
    />
  );
}

/**
 * LA PÍLDORA DE ESTADO — el mismo renglón «punto + texto» de siempre, pero
 * envuelto en una superficie propia (`bg-muted`, esquinas redondas) en vez de
 * texto suelto. Comparte `PuntoDeConexion` y se usa acá y en `PanelUsuario`:
 * dos versiones de la misma píldora serían el mismo #37 de siempre.
 */
export function EstadoChip({ conectada, children }: { conectada: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <PuntoDeConexion conectada={conectada} />
      {children}
    </span>
  );
}

function Campo({
  rotulo,
  valor,
  tope,
  placeholder,
  onCambio,
}: {
  rotulo: string;
  valor: string;
  tope: number;
  placeholder?: string;
  onCambio: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted-foreground">{rotulo}</span>
      <input
        value={valor}
        maxLength={tope}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
      />
    </label>
  );
}
