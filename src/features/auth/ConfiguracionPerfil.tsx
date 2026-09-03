import { useRef, useState } from 'react';
import { Camera, KeyRound, Loader2, Settings, Smartphone, Trash2, X } from 'lucide-react';
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
import type { EstadoActividad } from './actividad';

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
  /** El latido de la sesión (`useActividadDeSesion`, calculado en `App.tsx`): solo se reenvía. */
  actividad: EstadoActividad;
}) {
  const { data: perfil } = usePerfil();
  const guardar = useGuardarPerfil();
  const subirFoto = useSubirFotoDePerfil();
  const quitarFoto = useQuitarFotoDePerfil();

  const { lineas } = useLineas();
  const mias = lineas.filter((l) => l.mias === true);
  const tienePropia = mias.some((l) => l.compartida !== true);
  const { data: miLinea } = useMiLinea();
  const motivoVincular = motivoParaVincular(tienePropia, miLinea?.sesion?.estado);

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
      actividad={actividad}
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

  // El botón ROJO reemplaza al verde una vez que la auto-vinculación anda: con
  // `motivoVincular` en null por «conectado» (ver `motivoParaVincular`,
  // `whatsapp/miLinea.ts`) y una línea propia de verdad conectada, no hay
  // ambigüedad entre «no tiene nada que ofrecer» y «tiene algo que cortar».
  const puedeDesvincular = Boolean(numeroVinculado) && conectada;

  const [nombre, setNombre] = useState(vendedora.nombre);
  const [tocado, setTocado] = useState(false);

  const { url: foto } = useBlobAutenticado(fotoUrl ? `${API_URL}${fotoUrl}` : null);
  const { abrir: abrirSelectorDeFoto, input: inputFoto } = useSelectorDeFoto(onElegirFoto);

  return (
    <>
      {/* El contenedor de z-50 cubre TODA la pantalla (para centrar la tarjeta) y
          por eso queda encima del overlay: un click afuera de la tarjeta nunca
          llegaba al `onClick` del overlay de abajo. El cierre va acá, y la
          tarjeta corta la propagación para no cerrarse con un click adentro. */}
      <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configuración"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <Settings size={16} /> Configuración
            </div>
            <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-lg p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </header>

          <div className="flex flex-col gap-4 p-5">
            {/* LA FOTO — o la primera letra, si no hay una. Una sola letra: es SU
                avatar, no el de un contacto (dos letras se ven apretadas en un
                círculo chico). */}
            <div className="flex items-center gap-3">
              <span className="relative shrink-0">
                <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-navy font-heading text-xl font-bold text-white">
                  {foto ? <img src={foto} alt="" className="size-full object-cover" /> : inicial(vendedora.nombre)}
                </span>
                <button
                  type="button"
                  onClick={abrirSelectorDeFoto}
                  disabled={subiendoFoto}
                  aria-label="Cambiar foto de perfil"
                  title="Cambiar foto de perfil"
                  className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel transition-colors hover:bg-primary-hover disabled:opacity-60"
                >
                  {subiendoFoto ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                </button>
                {/* Quitar la foto — solo tiene sentido si hay una que quitar. */}
                {foto && (
                  <button
                    type="button"
                    onClick={onQuitarFoto}
                    disabled={quitandoFoto}
                    aria-label="Quitar foto de perfil"
                    title="Quitar foto de perfil"
                    className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-panel transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {quitandoFoto ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                )}
                {inputFoto}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{vendedora.nombre}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-semibold">Usuario Cerberus:</span>{' '}
                  <span className="font-mono" title={vendedora.id}>
                    {vendedora.id}
                  </span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PuntoDeConexion conectada={conectada} />
                  {numeroVinculado ? formatoTelefono(numeroVinculado) : 'Sin número vinculado'}
                </p>
                {/* EL LATIDO DE LA SESIÓN — pedido del dueño. Mismo punto verde/rojo
                    de arriba, mismo tamaño de texto: no es un widget nuevo, es una
                    fila más de este mismo resumen. */}
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PuntoDeConexion conectada={actividad.activo} />
                  {actividad.activo ? 'Activo' : 'Inactivo'}
                  {actividad.transcurrido && <> · {actividad.transcurrido}</>}
                </p>
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
                className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                {guardando && <Loader2 size={14} className="animate-spin" />}
                {guardando ? 'Guardando…' : 'Guardar'}
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
                <p className="text-[11px] text-muted-foreground">No tienes ninguna asignada.</p>
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
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-success/50 py-1.5 text-[11px] font-bold text-success transition-colors hover:border-success hover:bg-success/10"
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
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/50 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
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
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/50 py-1.5 text-[11px] font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10"
              >
                <KeyRound size={12} /> Cambiar contraseña
              </button>
            </div>
          </div>
        </div>
      </div>

      {vinculando && <VincularMiWhatsapp onCerrar={() => setVinculando(false)} />}
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
