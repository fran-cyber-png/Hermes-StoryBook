import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Lock, MessageCircle, Send } from 'lucide-react';
import '../../index.css';
import { sectionLabel } from '../../lib/styles';

/**
 * DÓNDE VA EL BOTÓN DE ENVIAR — las tres formas, una al lado de la otra.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-envio.html
 *
 * ══ POR QUÉ ESTA GALERÍA ════════════════════════════════════════════════════
 *
 * El footer actual se come ~104 px para UNA acción, y en una mesa de 720 px de
 * alto eso es caro. La propuesta era partirlo en dos botones, uno por caja.
 * Esta pantalla existe para poder mirar las tres opciones antes de elegir, con
 * los tokens y los componentes de verdad: el peso visual de un botón no se
 * juzga en un diagrama.
 *
 * ══ 🔴 LO QUE NINGUNA MAQUETA MUESTRA, Y DECIDE LA ELECCIÓN ═════════════════
 *
 * `POST /api/responder/:id` recibe los DOS textos y manda el privado PRIMERO.
 * Si el privado falla, no publica nada: la vendedora decide con otro clic si
 * publica sola la respuesta pública (ADR 0112). Es una transacción, no dos envíos.
 *
 * Dos botones independientes no pueden sostener eso: habilitan publicar el
 * público prometiendo un privado que nunca salió, que es el defecto que este
 * panel existe para evitar («se aprendió rompiéndolo», docblock de
 * `ResponderPanel`). Por eso la opción B lleva su advertencia dibujada: no es
 * una preferencia estética, cambia lo que le llega a una persona real.
 */

/** Las dos cajas, iguales en las tres opciones. Lo único que cambia es el envío. */
function Cajas({ botonesAdentro }: { botonesAdentro?: boolean }) {
  const [publico, setPublico] = useState(
    '¡Hola! Te acabamos de escribir por mensaje privado con toda la información 📩',
  );
  const [privado, setPrivado] = useState('');

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
          <MessageCircle size={12} /> Respuesta pública
        </span>
        <div className="grid">
          <textarea
            style={{ gridArea: '1 / 1' }}
            value={publico}
            onChange={(e) => setPublico(e.target.value)}
            className={
              'block min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary ' +
              (botonesAdentro ? 'pb-12' : '')
            }
          />
          {botonesAdentro && <BotonChico />}
        </div>
        <span className="text-[11px] leading-snug text-muted-foreground">
          Todos podrán verla en la publicación.
        </span>
      </label>

      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
          <Lock size={12} /> Respuesta privada
          <span className="rounded-full bg-secondary px-1.5 py-px font-normal normal-case tracking-normal text-secondary-foreground">
            por Messenger
          </span>
        </span>
        <div className="grid">
          <textarea
            style={{ gridArea: '1 / 1' }}
            value={privado}
            onChange={(e) => setPrivado(e.target.value)}
            placeholder="La información de verdad va acá: fecha, lugar, precio, cómo inscribirse…"
            className={
              'block min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary ' +
              (botonesAdentro ? 'pb-12' : '')
            }
          />
          {botonesAdentro && <BotonChico />}
        </div>
        <span className="text-[11px] leading-snug text-muted-foreground">
          No será visible en la publicación.
        </span>
      </label>
    </div>
  );
}

/**
 * El botón chico azul, anclado abajo a la derecha de una caja.
 *
 * ⚠️ **Va por GRID superpuesto y no por `absolute`.** La primera versión lo
 * posicionaba con `absolute bottom-2.5` sobre un contenedor `relative`, y en la
 * captura salió **encima del texto**, cerca del borde de arriba. Con las dos
 * celdas en `col-start-1 row-start-1` la caja manda el alto y el botón se apoya
 * en su borde inferior real, sin depender de a qué se resolvió el `relative`.
 * Si no, la comparación castigaba a B y C por un error de maquetado mío en vez
 * de por lo que de verdad tienen en contra.
 */
function BotonChico({ texto = 'Enviar' }: { texto?: string }) {
  return (
    <span
      style={{ gridArea: '1 / 1', alignSelf: 'end', justifySelf: 'end' }}
      className="p-2.5"
    >
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform duration-200 ease-house hover:bg-primary-hover active:scale-[0.98]"
      >
        <Send size={13} /> {texto}
      </button>
    </span>
  );
}

function Marco({
  letra,
  titulo,
  alto,
  nota,
  peligro,
  children,
}: {
  letra: string;
  titulo: string;
  alto: string;
  nota: string;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-heading text-sm font-bold text-foreground">
        <span className="flex size-5 items-center justify-center rounded-md bg-navy text-[11px] text-white">
          {letra}
        </span>
        {titulo}
        <span className="rounded-full bg-muted px-2 py-px font-mono text-[11px] font-normal text-muted-foreground">
          {alto}
        </span>
      </h2>
      <p
        className={
          'mb-2 flex items-start gap-1.5 text-[11px] leading-snug ' +
          (peligro ? 'font-semibold text-destructive' : 'text-muted-foreground')
        }
      >
        {peligro && <AlertTriangle size={12} className="mt-px shrink-0" />}
        {nota}
      </p>
      <div className="overflow-hidden rounded-2xl bg-card shadow-panel">{children}</div>
    </section>
  );
}

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Dónde va el botón de enviar — las tres opciones
      </h1>
      <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">
        Mismas cajas, mismos tokens. Lo único que cambia es el envío. El número gris es lo que
        ocupa el pie <strong className="text-foreground">además</strong> de las cajas.
      </p>

      <div className="mt-8 flex flex-col gap-10">
        {/* ── HOY ─────────────────────────────────────────────────────────── */}
        <Marco
          letra="·"
          titulo="Hoy"
          alto="~104 px"
          nota="Un bloque de ancho completo para una sola acción, con el texto de ayuda centrado abajo."
        >
          <div className="p-4">
            <Cajas />
          </div>
          <footer className="border-t border-border p-4">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              <Send size={15} />
              Responder a esta persona
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Se envía solo a esta persona. Puedes borrarlo después.
            </p>
          </footer>
        </Marco>

        {/* ── A ───────────────────────────────────────────────────────────── */}
        <Marco
          letra="A"
          titulo="Fila compacta a la derecha"
          alto="~56 px"
          nota="Una sola línea: la ayuda a la izquierda, el botón azul chico con la flecha a la derecha. Conserva la transacción única — sigue siendo UN envío coordinado."
        >
          <div className="p-4">
            <Cajas />
          </div>
          <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Se envía solo a esta persona. Puedes borrarlo después.
            </p>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform duration-200 ease-house hover:bg-primary-hover active:scale-[0.98]"
            >
              <Send size={14} /> Enviar
            </button>
          </footer>
        </Marco>

        {/* ── B ───────────────────────────────────────────────────────────── */}
        <Marco
          letra="B"
          titulo="Dos botones, uno por caja"
          alto="0 px de pie"
          peligro
          nota="Rompe la garantía: son dos envíos independientes, así que se puede publicar el comentario público prometiendo un privado que nunca salió. Es el bug que este panel existe para evitar, y ningún test lo vería — cada envío por separado funciona bien."
        >
          <div className="p-4">
            <Cajas botonesAdentro />
          </div>
        </Marco>

        {/* ── C ───────────────────────────────────────────────────────────── */}
        <Marco
          letra="C"
          titulo="Un botón, en la esquina de la caja privada"
          alto="0 px de pie"
          nota="Ahorra el pie entero y sigue siendo un solo envío. El costo: un botón metido adentro del recuadro privado se lee como si mandara sólo eso — y también publica el comentario público."
        >
          <div className="p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
                  <MessageCircle size={12} /> Respuesta pública
                </span>
                <textarea
                  defaultValue="¡Hola! Te acabamos de escribir por mensaje privado con toda la información 📩"
                  className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary"
                />
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Todos podrán verla en la publicación.
                </span>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
                  <Lock size={12} /> Respuesta privada
                  <span className="rounded-full bg-secondary px-1.5 py-px font-normal normal-case tracking-normal text-secondary-foreground">
                    por Messenger
                  </span>
                </span>
                <div className="grid">
                  <textarea
                    style={{ gridArea: '1 / 1' }}
                    placeholder="La información de verdad va acá: fecha, lugar, precio, cómo inscribirse…"
                    className="block min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 pb-12 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <BotonChico texto="Enviar las dos" />
                </div>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  No será visible en la publicación.
                </span>
              </label>
            </div>
          </div>
        </Marco>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <Galeria />
  </StrictMode>,
);
