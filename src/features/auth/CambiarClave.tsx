import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Info, KeyRound, Loader2, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { ErrorApi } from '../../lib/datos/cliente';
import { motivoParaNoCambiar, useCambiarClave, type CamposDeClave } from './cambioDeClave';

/**
 * CAMBIAR MI CONTRASEÑA — el modal que abre `PanelUsuario` (el avatar del riel,
 * abajo a la izquierda). Pedido del dueño del 18-ago-2026.
 *
 * Molde: `VincularMiWhatsapp`. Partido en dos igual: acá el cableado (estado,
 * mutación, Escape) y en `VistaCambiarClave` lo que se DIBUJA, para que la
 * galería (`galeria-cambiar-clave.tsx`) pinte cada paso sin fetch ni click.
 *
 * Lo que la pantalla decide sola vive en `cambioDeClave.ts`
 * (`motivoParaNoCambiar`); lo que decide Cerberus llega en el error del POST y
 * se muestra tal cual — sus mensajes ya vienen en castellano y son más
 * precisos que cualquier traducción («Esta contraseña es demasiado común»).
 *
 * ⚠️ Cambiar la clave NO cierra la sesión de Hermes: el token no depende de la
 * clave. Por eso el paso final dice «la próxima vez que entres», no «vuelve a
 * entrar» — y no hay nada que la pantalla tenga que invalidar.
 *
 * ══ `esCenturion` — LOS CANDIDATOS DE CAMPAÑA NO TIENEN CLAVE EN CERBERUS ═══
 *
 * Una identidad de Centurión (`centurion:…`) no puede cambiar nada acá: el
 * server la corta ANTES de preguntarle a Cerberus (`POST /api/auth/cambiar-clave`,
 * `routes/auth.ts` — 409 `sin_cuenta_de_cerberus`, «esta cuenta entra con
 * Centurión: la contraseña se cambia allá, no en Hermes»). Hasta el 25-ago-2026
 * el BOTÓN ya no llegaba a abrirse para esta población (`ConfiguracionPerfil`
 * lo escondía con `tieneSesionDeCerberus`), así que ni siquiera se enteraban de
 * ESE motivo — un botón que falta se lee como «no tengo esa opción», no como
 * «tengo que ir a otro lado». Ahora el botón se ve igual que para una
 * vendedora, y acá adentro se corta antes del formulario: pedirle usuario y
 * clave para algo que el server va a rechazar SIEMPRE, sea cual sea lo que
 * escriba, es puro relleno.
 *
 * 🔴 **Esto es un cartel, no el cambio de verdad.** Cambiarle la clave a un
 * candidato de campaña vive en Centurión, y Hermes ya no le habla directo —le
 * pregunta a `auth-goberna` (`authGoberna/credenciales.ts`), que hoy solo
 * expone `/login`. Falta ese endpoint del otro lado antes de que este panel
 * pueda hacer algo más que avisar.
 */
export function CambiarClave({ onCerrar, esCenturion = false }: { onCerrar: () => void; esCenturion?: boolean }) {
  useEscape(onCerrar);
  const [campos, setCampos] = useState<CamposDeClave>({ actual: '', nueva: '', repetir: '' });
  // El motivo local se muestra recién al INTENTAR mandar, no mientras escribe:
  // «las dos no coinciden» en rojo con la segunda a medio tipear es ruido.
  const [intentado, setIntentado] = useState(false);
  const cambiar = useCambiarClave();

  const motivoLocal = motivoParaNoCambiar(campos);

  function enviar() {
    setIntentado(true);
    if (motivoLocal) return;
    cambiar.mutate({ claveActual: campos.actual, claveNueva: campos.nueva });
  }

  const paso: PasoCambiarClave = esCenturion
    ? { tipo: 'no_disponible' }
    : cambiar.isSuccess
      ? { tipo: 'listo', onCerrar }
      : {
          tipo: 'formulario',
          campos,
          onCampo: (k, v) => {
            setCampos((c) => ({ ...c, [k]: v }));
            // Un error del server es sobre lo que se mandó; al retocar, se retira.
            if (cambiar.isError) cambiar.reset();
          },
          onEnviar: enviar,
          enviando: cambiar.isPending,
          error: (intentado && motivoLocal) || (cambiar.error instanceof ErrorApi ? cambiar.error.message : null),
        };

  return <VistaCambiarClave paso={paso} onCerrar={onCerrar} />;
}

// ── LA VISTA — sin un solo hook de datos, así se puede importar en la galería ──

export type PasoCambiarClave =
  | {
      tipo: 'formulario';
      campos: CamposDeClave;
      onCampo: (campo: keyof CamposDeClave, valor: string) => void;
      onEnviar: () => void;
      enviando: boolean;
      error: string | null;
    }
  | { tipo: 'listo'; onCerrar: () => void }
  /** Identidad de Centurión: no hay formulario que mostrar, solo el porqué. */
  | { tipo: 'no_disponible' };

const CLASE_INPUT =
  'w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none ' +
  'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25';

export function VistaCambiarClave({ paso, onCerrar }: { paso: PasoCambiarClave; onCerrar: () => void }) {
  return (
    <>
      {/* Mismo arreglo que `ConfiguracionPerfil`: el contenedor de z-50 cubre toda
          la pantalla y tapaba el overlay de abajo — el click afuera nunca llegaba. */}
      <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cambiar tu contraseña"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <KeyRound size={16} /> Cambiar tu contraseña
            </div>
            <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-lg p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </header>

          {paso.tipo === 'formulario' && (
            <form
              className="flex flex-col gap-3 p-5"
              onSubmit={(ev: FormEvent) => {
                ev.preventDefault();
                paso.onEnviar();
              }}
            >
              <p className="text-[12px] leading-snug text-muted-foreground">
                Es la misma contraseña con la que entras a Hermes y a Cerberus. Vas a seguir adentro: la nueva
                vale desde la próxima vez que entres.
              </p>
              <Campo
                rotulo="Contraseña actual"
                valor={paso.campos.actual}
                onCambio={(v) => paso.onCampo('actual', v)}
                autoComplete="current-password"
                autoFocus
              />
              <Campo
                rotulo="Contraseña nueva"
                valor={paso.campos.nueva}
                onCambio={(v) => paso.onCampo('nueva', v)}
                autoComplete="new-password"
              />
              <Campo
                rotulo="Repite la nueva"
                valor={paso.campos.repetir}
                onCambio={(v) => paso.onCampo('repetir', v)}
                autoComplete="new-password"
              />
              {paso.error && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12px] leading-snug text-destructive"
                >
                  <AlertTriangle size={13} className="mt-px shrink-0" />
                  {paso.error}
                </p>
              )}
              <button
                type="submit"
                disabled={paso.enviando}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {paso.enviando && <Loader2 size={14} className="animate-spin" />}
                {paso.enviando ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </form>
          )}

          {paso.tipo === 'no_disponible' && (
            <div className="flex flex-col items-center gap-2 p-5 py-6 text-center">
              <Info size={32} className="text-primary" />
              <p className="text-sm font-bold text-foreground">Tu contraseña no se cambia acá.</p>
              <p className="text-[12px] leading-snug text-muted-foreground">
                Tu cuenta entra con Centurión, no con Cerberus: la contraseña se cambia allá. Todavía no podemos
                hacer ese cambio desde Hermes.
              </p>
              <button
                type="button"
                onClick={onCerrar}
                autoFocus
                className="mt-1 rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white"
              >
                Cerrar
              </button>
            </div>
          )}

          {paso.tipo === 'listo' && (
            <div className="flex flex-col items-center gap-2 p-5 py-6 text-center">
              <CheckCircle2 size={32} className="text-success" />
              <p className="text-sm font-bold text-foreground">Listo, tu contraseña cambió.</p>
              <p className="text-[12px] leading-snug text-muted-foreground">
                Sigues adentro. Usa la nueva la próxima vez que entres a Hermes o a Cerberus.
              </p>
              <button
                type="button"
                onClick={paso.onCerrar}
                autoFocus
                className="mt-1 rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Campo({
  rotulo,
  valor,
  onCambio,
  autoComplete,
  autoFocus,
}: {
  rotulo: string;
  valor: string;
  onCambio: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted-foreground">{rotulo}</span>
      <input
        type="password"
        value={valor}
        onChange={(ev) => onCambio(ev.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={CLASE_INPUT}
        placeholder="••••••••"
      />
    </label>
  );
}
