import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Smartphone, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { ErrorApi } from '../../lib/datos/cliente';
import {
  useCancelarAutoVinculacion,
  useEstadoAutoVinculacion,
  useIniciarAutoVinculacion,
  useInvalidarMiLinea,
  useOlvidarEstadoAutoVinculacion,
} from './miLinea';

/**
 * VINCULAR MI WHATSAPP — la auto-vinculación desde `PanelUsuario` (decisión del
 * dueño, 15-ago-2026): «siempre un vendedor (no supervisor) va a tener la
 * posibilidad de enlazar su número, solo 1».
 *
 * Molde: la consola de operador (`routes/vincular.ts`, D13) — mismo ritmo de
 * polling, mismos cinco estados. Lo que cambia es que ACÁ hay una vendedora
 * detrás del token, así que el server sabe de quién es el pareo y este
 * componente no pide ni muestra un número ajeno.
 *
 * Partido en DOS, como `PanelUsuario`/`ContenidoUsuario`: acá el cableado
 * (hooks, polling), en `VistaMiLinea` lo que se DIBUJA. La galería
 * (`galeria-mi-linea.tsx`) pinta cada paso importando la vista directo, sin
 * simular un click ni mockear `fetch` — misma regla que ya vale para
 * `ContenidoUsuario`: la evidencia no puede depender de un navegador que sepa
 * hacer click.
 */
/**
 * 🔴 EL CAMPO ARRANCA CON SU PROPIO NÚMERO CUANDO YA TIENE UNO, Y NO ES COMODIDAD.
 *
 * `puedeAutoVincular` (server) deja re-parear **la línea propia y ninguna otra**:
 * cualquier otro número cae en 409 `ya_tiene_linea`. O sea que cuando esto se
 * abre para re-vincular hay **exactamente un valor que funciona**, y hasta hoy el
 * campo salía vacío con un placeholder peruano — la vendedora tenía que
 * adivinarlo dígito por dígito.
 *
 * Medido el 2-sep-2026: la línea de Nicole es `5215610584485`, con el «1»
 * heredado de México que su propio teléfono **no muestra**. Tipear lo que ve
 * (`525610584485`) daba 409, y el mensaje tampoco decía cuál era el bueno.
 *
 * ⚠️ Sigue siendo editable: quien no tiene línea propia lo escribe entero, y
 * `numeroPropio` llega `null` justo en ese caso.
 */
export function VincularMiWhatsapp({
  onCerrar,
  numeroPropio = null,
}: {
  onCerrar: () => void;
  /** Su línea de hoy, si ya tiene una. `null` = está trayendo la primera. */
  numeroPropio?: string | null;
}) {
  useEscape(onCerrar);
  const [numero, setNumero] = useState(numeroPropio ?? '');

  const iniciar = useIniciarAutoVinculacion();
  const cancelar = useCancelarAutoVinculacion();
  const invalidarMiLinea = useInvalidarMiLinea();
  const olvidarEstado = useOlvidarEstadoAutoVinculacion();

  /**
   * 🔴 EL POLLING ARRANCA CON EL 200 DEL POST, NUNCA CON EL CLIC.
   *
   * Antes esto era un `setEnVuelo(true)` **antes** del `await`: el primer poll
   * salía mientras el POST todavía viajaba, el server no tenía pareo tomado
   * todavía y contestaba `expirado` — o sea que el camino feliz mostraba «La
   * vinculación se cortó» a los pocos milisegundos de apretar Vincular, antes de
   * que existiera un QR. `isSuccess` es exactamente «el POST volvió 200», que es
   * la condición real; `isPending` cubre el rato de la espera para que la
   * pantalla no se quede en el formulario sin decir nada.
   */
  const hayPareo = iniciar.isSuccess;
  const estadoQuery = useEstadoAutoVinculacion(hayPareo);
  const e = estadoQuery.data;

  async function vincular() {
    const limpio = numero.replace(/\D/g, '');
    if (limpio.length < 8) return;
    // El estado del intento anterior no puede sobrevivir al siguiente: misma
    // queryKey, así que sin esto el primer render mostraría el `conectado` viejo.
    olvidarEstado();
    try {
      await iniciar.mutateAsync(limpio);
    } catch {
      /* el 400/409 lo muestra `iniciar.error`; no hay nada que pollear */
    }
  }

  function volverAIntentar() {
    olvidarEstado();
    iniciar.reset();
  }

  async function cancelarPareo() {
    await cancelar.mutateAsync();
    volverAIntentar();
  }

  const paso: PasoMiLinea = !hayPareo
    ? iniciar.isPending
      ? { tipo: 'esperando', onCancelar: () => void cancelarPareo() }
      : {
          tipo: 'formulario',
          numero,
          onNumero: setNumero,
          onVincular: () => void vincular(),
          error: iniciar.error instanceof ErrorApi ? iniciar.error.message : null,
          esReVinculacion: numeroPropio !== null,
        }
    : e?.estado === 'conectado'
      ? {
          tipo: 'conectado',
          numero: e.numero,
          // Ausente = server viejo, que no sabía distinguirlo: se lee «anduvo».
          montada: e.montada ?? true,
          onCerrar: () => {
            invalidarMiLinea();
            onCerrar();
          },
        }
      : e?.estado === 'baneado'
        ? { tipo: 'baneado', ban: e.ban, onVolver: volverAIntentar }
        : e?.estado === 'error'
          ? { tipo: 'error', motivo: e.motivo, onVolver: volverAIntentar }
          : e?.estado === 'expirado'
            ? { tipo: 'error', motivo: 'La vinculación se cortó. Prueba de nuevo.', onVolver: volverAIntentar }
            : e?.estado === 'esperando_qr'
              ? { tipo: 'qr', qr: e.qr, onCancelar: () => void cancelarPareo() }
              : { tipo: 'esperando', onCancelar: () => void cancelarPareo() };

  return <VistaMiLinea paso={paso} onCerrar={onCerrar} />;
}

// ── LA VISTA — sin un solo hook de datos, así se puede importar en la galería ──

export type PasoMiLinea =
  | {
      tipo: 'formulario';
      numero: string;
      onNumero: (v: string) => void;
      onVincular: () => void;
      error: string | null;
      /**
       * `true` = ya tiene una línea y está volviendo a parear ESA. Cambia lo que
       * dice el texto: «es solo 1 por vendedora» es la advertencia correcta para
       * quien trae la primera y una confusión para quien está reintentando la
       * suya — el server acepta ese reintento sin límite.
       */
      esReVinculacion?: boolean;
    }
  | { tipo: 'esperando'; onCancelar: () => void }
  | { tipo: 'qr'; qr: string; onCancelar: () => void }
  /**
   * `montada: false` = quedó vinculada y REGISTRADA, pero el server no la pudo
   * poner a atender en caliente. No es un error de la vendedora y no se esconde:
   * decir «¡Listo!» sobre una línea muda es justo la mentira que este frente
   * existe para no contar. El reintento es volver a vincular el mismo número.
   */
  | { tipo: 'conectado'; numero: string; montada: boolean; onCerrar: () => void }
  | { tipo: 'baneado'; ban: { codigo: string; expira: string }; onVolver: () => void }
  | { tipo: 'error'; motivo: string; onVolver: () => void };

export function VistaMiLinea({ paso, onCerrar }: { paso: PasoMiLinea; onCerrar: () => void }) {
  return (
    <>
      {/* Mismo arreglo que `ConfiguracionPerfil`: el contenedor de z-58 cubre toda
          la pantalla y tapaba el overlay de abajo — el click afuera nunca llegaba.
          🔴 z-55/z-58, NO z-40/z-50 — este modal SIEMPRE se abre desde adentro de
          `ConfiguracionPerfil`, que ya ocupa esos mismos dos números. Empatar el
          z-index deja a la tarjeta de Configuración (z-50) por ENCIMA del velo de
          ESTE modal (z-40) — un velo no puede oscurecer algo con más z-index que
          él, así que Configuración se veía sin atenuar, asomando por los bordes
          (reporte del dueño, 10-sep-2026). Subir a z-55/z-58 pone TODO este modal
          por encima de TODO el anterior — su propio velo incluido —, y se queda
          por debajo de z-[60] (las notificaciones de `Avisos.tsx`, que tienen que
          seguir viéndose pase lo que pase). */}
      <div className="fixed inset-0 z-[55] bg-navy/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 z-[58] flex items-center justify-center p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vincular tu WhatsApp"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <Smartphone size={16} /> Vincular tu WhatsApp
            </div>
            <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-lg p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </header>

          <div className="flex flex-col gap-3 p-5">
            {paso.tipo === 'formulario' && (
              <>
                <p className="text-sm leading-snug text-muted-foreground">
                  {paso.esReVinculacion ? (
                    <>
                      Vuelve a conectar tu línea. Tiene que ser <b>este mismo número</b>: es el que está
                      a tu nombre, y para cambiarlo por otro habla con quien administra Hermes.
                    </>
                  ) : (
                    <>
                      Trae tu número de WhatsApp a Hermes. Es <b>solo 1 por vendedora</b> — una vez
                      vinculado, para cambiarlo habla con quien administra Hermes.
                    </>
                  )}
                </p>
                <input
                  value={paso.numero}
                  onChange={(ev) => paso.onNumero(ev.target.value)}
                  placeholder="51955135507"
                  inputMode="numeric"
                  autoFocus
                  onKeyDown={(ev) => ev.key === 'Enter' && paso.onVincular()}
                  className="rounded-lg border border-border px-3 py-2 text-center font-mono text-sm"
                />
                {paso.error && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12px] leading-snug text-destructive">
                    <AlertTriangle size={13} className="mt-px shrink-0" />
                    {paso.error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={paso.onVincular}
                  disabled={paso.numero.replace(/\D/g, '').length < 8}
                  className="rounded-lg bg-blue-600 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Vincular
                </button>
              </>
            )}

            {(paso.tipo === 'esperando' || paso.tipo === 'qr') && (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                {paso.tipo === 'qr' ? (
                  <>
                    <img src={paso.qr} alt="Código QR de WhatsApp" className="size-64 rounded-xl border border-border p-2" />
                    <p className="text-[12px] leading-snug text-muted-foreground">
                      En tu teléfono: <b>WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</b>{' '}
                      → escanea este QR. Se refresca solo.
                    </p>
                  </>
                ) : (
                  <>
                    <Loader2 size={28} className="animate-spin text-muted-foreground" />
                    <p className="text-[12px] text-muted-foreground">Generando el QR…</p>
                  </>
                )}
                <button
                  type="button"
                  onClick={paso.onCancelar}
                  className="text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
                >
                  Cancelar
                </button>
              </div>
            )}

            {paso.tipo === 'conectado' && (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                {paso.montada ? (
                  <>
                    <CheckCircle2 size={32} className="text-success" />
                    <p className="text-sm font-bold text-foreground">¡Listo! Tu número quedó vinculado.</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-destructive" />
                    <p className="text-sm font-bold text-foreground">Tu número quedó vinculado.</p>
                    <p className="text-[12px] leading-snug text-muted-foreground">
                      Todavía <b>no está atendiendo</b>: Hermes no pudo ponerlo a andar ahora mismo. Vuelve a
                      vincular el mismo número, y si sigue igual avisa a quien administra Hermes.
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={paso.onCerrar}
                  className="mt-1 rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white"
                >
                  Cerrar
                </button>
              </div>
            )}

            {paso.tipo === 'baneado' && (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <AlertTriangle size={24} className="text-destructive" />
                <p className="text-[12px] font-bold text-destructive">
                  WhatsApp suspendió el número (código {paso.ban.codigo}). Se levanta {paso.ban.expira}.
                </p>
                <button type="button" onClick={paso.onVolver} className="text-[12px] underline">
                  Volver
                </button>
              </div>
            )}

            {paso.tipo === 'error' && (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <AlertTriangle size={24} className="text-destructive" />
                <p className="text-[12px] text-destructive">{paso.motivo}</p>
                <button
                  type="button"
                  onClick={paso.onVolver}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
