import { lazy, Suspense, useEffect, useState } from 'react';
import { Building2, Check, Loader2, Mail, MapPin, Pencil, Phone, Plus, UserPlus, X } from 'lucide-react';
import { avisar } from '../../lib/avisos';
import { useEscape } from '../../lib/teclado/useEscape';
import type { Conversacion } from '../../dominio/conversaciones';
import { personaEsTelefono } from '../../dominio/canal';
import { useFicha } from '../cerberus/useFicha';
import type { Ficha } from '../cerberus/ficha';
import { useLeadForm } from '../cerberus/BloqueLeadForm';
import { Intereses } from '../gestion/Intereses';
import { useAnotarTerritorio, useTerritorio } from '../territorio/territorio';

/**
 * `lazy`, MISMO motivo que `BloqueTerritorio.tsx`: `leaflet` toca `window» al
 * cargarse, y con un `import` estático cualquier test que importe este
 * archivo de pasada (la inmensa mayoría, que nunca abre el mapa) revienta sin
 * DOM.
 */
const ModalDireccion = lazy(() =>
  import('../territorio/ModalDireccion').then((m) => ({ default: m.ModalDireccion })),
);
import {
  faltaLoMinimo,
  prellenar,
  useFichaLocal,
  useGuardarFicha,
  type DatosFicha,
  type FichaLocal,
  PRIORIDADES,
} from './fichaLocal';

/**
 * EL REGISTRO RÁPIDO — la ficha del contacto SIN salir del chat.
 *
 * La meta es de segundos, no de campos: el drawer abre con todo lo que la
 * conversación ya sabe puesto (nombre, apellido, empresa y teléfono salen del
 * alias de WhatsApp; el correo, de Cerberus o del formulario), así que en el
 * caso normal la vendedora sólo mira y guarda.
 *
 * Lo que NO se duplica acá: el INTERÉS se compone del mismo componente de la
 * barra (`gestion/Intereses`) porque `intereses` es la única fuente de verdad de
 * «qué curso quiere» (#37), y el ASESOR no se toca —eso es del reparto, que
 * tiene su propio rastro de quién decidió qué (`PasarConversacion`).
 */

/** El estrechamiento de la unión, con nombre: `Ficha` sólo trae datos si es cliente. */
function fichaDeCliente(f: Ficha | undefined): Extract<Ficha, { estado: 'cliente' }> | null {
  return f?.estado === 'cliente' ? f : null;
}

function Campo({
  icono,
  children,
}: {
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2.5 px-4 py-2">
      <span className="w-4 shrink-0 text-muted-foreground">{icono}</span>
      {children}
    </label>
  );
}

const CLASE_INPUT =
  'min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none transition-colors hover:border-border focus:border-primary focus:bg-muted/30';

export function FichaRapida({
  conversacion,
  onCerrar,
  onAbrirOtra,
  esDeCampana = false,
}: {
  conversacion: Conversacion;
  onCerrar: () => void;
  /**
   * Ir al chat del contacto que YA estaba registrado. Lo resuelve el shell —
   * abrir una conversación es suyo— y **puede no existir**: sin WhatsApp
   * conectado no hay chat que abrir, y ahí el botón no se dibuja en vez de
   * prometer algo que no va a pasar.
   */
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  /**
   * 🔴 **APAGA LO QUE PRELLENA, NUNCA EL FORMULARIO.** Guardar la ficha es CRM
   * genérico y le sirve a los dos módulos (`/api/contactos/registro`); lo que es
   * de `ventas` son las DOS fuentes con las que este drawer se autocompleta —la
   * ficha de Cerberus y el lead-form de la Escuela—, y en campaña las dos
   * contestan 403. Con el `retry: 1` global eso eran cuatro requests condenadas
   * por cada apertura, todas haciendo cola en un pool que ya está al tope.
   */
  esDeCampana?: boolean;
}) {
  useEscape(onCerrar);

  const conCerberus = !esDeCampana;
  const tieneTelefono = personaEsTelefono(conversacion.canal, conversacion.persona_id);
  const ficha = useFichaLocal(conversacion.clave);
  const cerberus = useFicha(conversacion.persona_id, tieneTelefono && conCerberus);
  const lead = useLeadForm(conversacion.persona_id, tieneTelefono && conCerberus);
  const guardar = useGuardarFicha(conversacion.clave);

  /**
   * LOCACIÓN — solo en campaña (ADR 0063/0088), y editable directo acá desde
   * el 24-ago-2026: antes solo se anotaba desde el panel de Contactos, y el
   * pedido fue que viva en la MISMA ficha que el resto del contacto, sea alta
   * nueva o edición. `ubicacionTocada` evita que la respuesta del server
   * (hasta 12 s en un mal día) pise una elección que la vendedora ya hizo — el
   * mismo cuidado que ya tiene `datos` con el prellenado de Cerberus.
   */
  const territorio = useTerritorio(conversacion.clave, esDeCampana);
  const { anotar, sacar } = useAnotarTerritorio(conversacion.clave);
  const [ubicacion, setUbicacion] = useState<{ direccion: string; lat: number; lon: number } | null>(null);
  const [ubicacionTocada, setUbicacionTocada] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  useEffect(() => {
    const actual = territorio.data?.actual;
    if (!ubicacionTocada && actual?.direccion && actual.lat != null && actual.lon != null) {
      setUbicacion({ direccion: actual.direccion, lat: actual.lat, lon: actual.lon });
    }
  }, [territorio.data, ubicacionTocada]);

  const cliente = fichaDeCliente(cerberus.data);
  const inicial = prellenar({
    ficha: ficha.data,
    nombreCerberus: cliente?.nombre,
    correoCerberus: cliente?.correo,
    nombreLead: lead.data?.lead?.nombre,
    correoLead: lead.data?.lead?.email,
    aliasChat: conversacion.persona_nombre,
    telefono: conversacion.persona_id,
  });

  /**
   * El formulario arranca del prellenado y desde ahí es de quien escribe: si el
   * estado se recalculara con cada respuesta que llega (la ficha de Cerberus
   * tarda hasta 12 s), una tecleada podría quedar pisada a mitad de palabra.
   * Por eso `useState` con inicializador y no un `useEffect` que sincroniza.
   */
  const [datos, setDatos] = useState<DatosFicha>(inicial);
  const [duplicada, setDuplicada] = useState<FichaLocal | null>(null);

  const cambiar = (campo: keyof DatosFicha) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function enviar(forzar = false) {
    /**
     * 🔴 **En campaña la empresa se manda VACÍA, no como venga.** El campo no se
     * dibuja (ver abajo), pero `prellenar` lo llena solo partiendo el alias de
     * WhatsApp — así que sin esto se guardaría un dato que la persona nunca vio
     * y no puede corregir. Un campo invisible que igual se escribe es peor que
     * uno de más: aparece semanas después, en la ficha de otro.
     */
    const r = await guardar.mutateAsync({
      ...datos,
      empresa: esDeCampana ? '' : datos.empresa,
      forzar,
    });
    if (r.ok) {
      // La ubicación es OTRA tabla (`contacto_territorio`, ADR 0063/0088): se
      // guarda aparte, después de que la ficha existe — anotar contra una
      // clave que la vendedora terminó cancelando dejaría un territorio
      // huérfano.
      if (esDeCampana && ubicacionTocada) {
        if (ubicacion) await anotar.mutateAsync(ubicacion);
        else await sacar.mutateAsync();
      }
      avisar(ficha.data ? 'Ficha actualizada' : 'Contacto registrado');
      onCerrar();
      return;
    }
    setDuplicada(r.duplicada);
  }

  const yaRegistrado = ficha.data != null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/20" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={yaRegistrado ? 'Ficha del contacto' : 'Registrar contacto'}
        // Ancho de la ficha (22,5rem) + aire: el drawer se para sobre el panel
        // derecho y deja la conversación entera a la vista, que es la regla —
        // ninguna de estas acciones saca a la vendedora del chat.
        className="fixed inset-y-0 right-0 z-50 flex w-[25rem] max-w-full animate-entrar flex-col bg-card shadow-panel"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <UserPlus size={16} className="text-primary" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
            {yaRegistrado ? 'Ficha del contacto' : 'Registrar contacto'}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-1 px-0 py-1">
              <Campo>
                <input
                  value={datos.nombre}
                  onChange={cambiar('nombre')}
                  autoFocus
                  placeholder="Nombre"
                  aria-label="Nombre"
                  className={CLASE_INPUT}
                />
              </Campo>
              <Campo>
                <input
                  value={datos.apellido}
                  onChange={cambiar('apellido')}
                  placeholder="Apellido"
                  aria-label="Apellido"
                  className={CLASE_INPUT}
                />
              </Campo>
            </div>

            <Campo icono={<Phone size={15} />}>
              <input
                value={datos.telefono}
                onChange={cambiar('telefono')}
                inputMode="tel"
                placeholder="Teléfono"
                aria-label="Teléfono"
                className={CLASE_INPUT + ' font-mono text-xs'}
              />
            </Campo>

            {/* ⚠️ **«Empresa» es de ventas.** Nació para partir un alias como
                «Jorge Martin - JM RUSH AUTOMOTRIZ», que es un dato comercial: en
                una campaña, dónde trabaja alguien no cambia nada de lo que se
                hace con él. Mismo criterio con el que se fueron «+ interés» y el
                vocabulario de cursos (ADR 0080).
                🔴 **Y no basta con no dibujarlo: `prellenar` lo llena solo desde
                el alias**, así que sin vaciarlo se guardaría un campo que la
                persona no puede ver ni corregir — que es lo mismo que
                inventarlo. Por eso se limpia en `enviar()`, no acá.
                ⚠️ La COLUMNA se queda: hay fichas de ventas con empresa, y esto
                es front puro (sale por N4, sin migración). */}
            {!esDeCampana && (
              <Campo icono={<Building2 size={15} />}>
                <input
                  value={datos.empresa}
                  onChange={cambiar('empresa')}
                  placeholder="Empresa (opcional)"
                  aria-label="Empresa"
                  className={CLASE_INPUT}
                />
              </Campo>
            )}

            <Campo icono={<Mail size={15} />}>
              <input
                value={datos.email}
                onChange={cambiar('email')}
                type="email"
                placeholder="Email (opcional)"
                aria-label="Email"
                className={CLASE_INPUT}
              />
            </Campo>

            {/* Solo campaña (ADR 0063/0088): en ventas nadie pregunta dónde
                vive alguien. Se guarda aparte de la ficha (`enviar()`), en
                `contacto_territorio`, pero vive en el MISMO formulario porque
                para quien la tipea es un dato más del alta. El mapa es el
                MISMO componente que `BloqueTerritorio.tsx` (panel del chat):
                acá solo cambia que la mutación se difiere hasta guardar la
                ficha, en vez de ir directo al server. */}
            {esDeCampana && (
              <section className="px-4 py-3">
                <h3 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <MapPin size={11} /> Locación
                </h3>
                {ubicacion ? (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground" title={ubicacion.direccion}>
                        {ubicacion.direccion}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setMapaAbierto(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors hover:underline"
                        >
                          <Pencil size={10} aria-hidden /> Cambiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUbicacionTocada(true);
                            setUbicacion(null);
                          }}
                          className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMapaAbierto(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border py-2 text-xs font-bold text-primary transition-[background-color,border-color,transform] duration-200 ease-house hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                  >
                    <Plus size={13} aria-hidden /> Marcar en el mapa
                  </button>
                )}
                {mapaAbierto && (
                  <Suspense
                    fallback={
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30" aria-hidden="true">
                        <Loader2 size={28} className="animate-spin text-white" />
                      </div>
                    }
                  >
                    <ModalDireccion
                      inicial={ubicacion}
                      guardando={false}
                      onConfirmar={(v) => {
                        setUbicacionTocada(true);
                        setUbicacion(v);
                        setMapaAbierto(false);
                      }}
                      onCerrar={() => setMapaAbierto(false)}
                    />
                  </Suspense>
                )}
              </section>
            )}

            <section className="px-4 py-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Prioridad
              </h3>
              <div className="flex gap-1.5">
                {PRIORIDADES.map((p) => {
                  const activa = datos.prioridad === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => setDatos((d) => ({ ...d, prioridad: activa ? null : p.id }))}
                      className={
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ' +
                        (activa
                          ? 'border-navy bg-navy text-white'
                          : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
                      }
                    >
                      <span className={'size-1.5 rounded-full ' + p.punto} />
                      {p.rotulo}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* El interés NO se reimplementa: es el mismo componente de la barra
                y de la cola, contra la misma tabla. Con dos, la ficha y el chat
                dirían dos cosas sobre qué quiere la misma persona (#37).
                ⚠️ Y por eso mismo desaparece entero en campaña: si acá quedara,
                sería la MISMA sección 403 que ya se sacó de la barra. El motivo
                largo está en `BarraGestion`. */}
            {!esDeCampana && (
              <section className="px-4 py-3">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Qué le interesa
                </h3>
                <Intereses clave={conversacion.clave} compacto />
              </section>
            )}
          </div>

          {duplicada && (
            <div className="shrink-0 border-t border-border bg-warning/10 px-4 py-2.5 text-[11px]">
              <p className="font-semibold text-warning-foreground">Este contacto ya está registrado</p>
              <p className="mt-0.5 text-muted-foreground">
                {[duplicada.nombre, duplicada.apellido].filter(Boolean).join(' ') || duplicada.telefono} — en otra
                conversación.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {onAbrirOtra && (
                  <button
                    type="button"
                    onClick={() => {
                      onAbrirOtra({ clave: duplicada.clave, telefono: duplicada.telefono });
                      onCerrar();
                    }}
                    className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-foreground transition-colors hover:border-primary"
                  >
                    Abrir contacto
                  </button>
                )}
                <button
                  type="button"
                  disabled={guardar.isPending}
                  onClick={() => void enviar(true)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-foreground transition-colors hover:border-primary disabled:opacity-50"
                >
                  Registrar igual acá
                </button>
              </div>
            </div>
          )}

          {guardar.isError && (
            <p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-destructive">
              No se guardó — prueba de nuevo.
            </p>
          )}

          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
            <span className="text-[11px] text-muted-foreground">
              {yaRegistrado ? `Registrado por ${ficha.data?.vendedoraId}` : 'Nada se envía: sólo se guarda.'}
            </span>
            <button
              type="submit"
              disabled={guardar.isPending || faltaLoMinimo(datos)}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-[background-color,transform] duration-200 ease-house hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
            >
              {guardar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {yaRegistrado ? 'Guardar cambios' : 'Registrar contacto'}
            </button>
          </footer>
        </form>
      </aside>
    </>
  );
}
