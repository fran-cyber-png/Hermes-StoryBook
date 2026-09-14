import { useEffect, useState, type KeyboardEvent } from 'react';
import { EmojiPicker, type EmojiPickerListComponents, type SkinTone } from 'frimousse';
import { anotarReciente, leerRecientes } from '../lib/emojisRecientes';
import { useLocalStorage } from '../lib/useLocalStorage';

/**
 * EL SELECTOR DE EMOJIS DEL COMPOSER (ADR 0126, #1081–#1083).
 *
 * Capa 0: no sabe de WhatsApp, de Messenger ni del cursor. Avisa qué emoji se eligió con
 * `onElegir` y el composer decide dónde entra. Cada composer lo carga PEREZOSO: al arranque
 * le toca el botón, y `npm run presupuesto` falla si `frimousse` aparece en el camino de entrada.
 *
 * ══ LO QUE NO SE VE A SIMPLE VISTA ══════════════════════════════════════════
 *
 *  · **Los datos salen de `public/emojis/`** (`npm run emojis`), nunca del CDN: el fallback
 *    local de Tauri tiene que tenerlos.
 *  · **No se fija `emojiVersion`.** Sin número, `frimousse` dibuja un emoji de prueba por
 *    versión y esconde lo que esta máquina no sabe dibujar (Windows 10 se quedó muy atrás).
 *    Con número, esa detección se apaga y vuelven los cuadrados vacíos.
 *  · **Si los datos no llegan, `frimousse` se queda en «cargando» para siempre**: lo anota en
 *    la consola y nada más. Por eso antes de montarla se pide `messages.json` (11 KB): si
 *    falla, se ofrece «Reintentar» en vez de un panel que nunca termina.
 *  · **`frimousse` cachea con claves propias**: `frimousse/data/es` en `localStorage` y
 *    `frimousse/metadata` en `sessionStorage`. Lo de Hermes vive en `hermes.emojis.*`.
 *  · **No hay barra de categorías.** La lista es virtualizada y la librería no expone cómo
 *    saltar a una categoría; los encabezados quedan fijos arriba mientras se recorre.
 */

const DATOS = `${import.meta.env.BASE_URL}emojis`;

type Carga = 'viendo' | 'lista' | 'fallo';

const COMPONENTES: Partial<EmojiPickerListComponents> = {
  CategoryHeader: ({ category, ...props }) => (
    <div {...props} className="bg-card px-3 pb-1 pt-2.5 text-xs font-bold text-muted-foreground">
      {category.label}
    </div>
  ),
  Row: ({ children, ...props }) => (
    <div {...props} className="scroll-my-1.5 px-1.5">
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }) => (
    <button {...props} className="flex size-9 items-center justify-center rounded-lg text-2xl data-[active]:bg-muted">
      {emoji.emoji}
    </button>
  ),
};

export function SelectorDeEmojis({ onElegir, onCerrar }: { onElegir: (emoji: string) => void; onCerrar: () => void }) {
  const [carga, setCarga] = useState<Carga>('viendo');
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [recientes, setRecientes] = useState(leerRecientes);
  const [tono, setTono] = useLocalStorage<SkinTone>('hermes.emojis.tono', 'none');

  useEffect(() => {
    const corte = new AbortController();
    fetch(`${DATOS}/es/messages.json`, { signal: corte.signal })
      .then((r) => setCarga(r.ok ? 'lista' : 'fallo'))
      .catch(() => {
        if (!corte.signal.aborted) setCarga('fallo');
      });
    return () => corte.abort();
  }, [intento]);

  function elegir(emoji: string) {
    setRecientes(anotarReciente(emoji));
    onElegir(emoji);
  }

  // Escape con el foco adentro del panel (en la búsqueda, que es un campo): `usePopover` deja
  // pasar las teclas de los campos a propósito, así que el cierre lo pide el panel.
  function cerrarConEscape(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onCerrar();
  }

  return (
    <div
      role="dialog"
      aria-label="Elegir un emoji"
      onKeyDown={cerrarConEscape}
      className="absolute bottom-full left-0 z-30 mb-2 w-[344px] max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-panel"
    >
      {carga !== 'lista' ? (
        <div className="flex h-[360px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          {carga === 'viendo' ? (
            'Cargando emojis…'
          ) : (
            <>
              <span>No se pudieron cargar los emojis. Revisa tu conexión.</span>
              <button
                type="button"
                onClick={() => {
                  setCarga('viendo');
                  setIntento((n) => n + 1);
                }}
                className="rounded-lg border border-border px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Reintentar
              </button>
            </>
          )}
        </div>
      ) : (
        <EmojiPicker.Root
          locale="es"
          columns={9}
          skinTone={tono}
          emojibaseUrl={DATOS}
          onEmojiSelect={(e) => elegir(e.emoji)}
          className="isolate flex h-[360px] w-full flex-col"
        >
          <div className="flex items-center gap-2 border-b border-border p-2">
            <EmojiPicker.Search
              // eslint-disable-next-line jsx-a11y/no-autofocus -- abrir y tipear es el gesto que el panel existe para dar
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar emoji…"
              aria-label="Buscar emoji"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <EmojiPicker.SkinTone>
              {({ skinToneVariations }) => {
                const actual = Math.max(0, skinToneVariations.findIndex((v) => v.skinTone === tono));
                const siguiente = skinToneVariations[(actual + 1) % skinToneVariations.length];
                return (
                  <button
                    type="button"
                    onClick={() => siguiente && setTono(siguiente.skinTone)}
                    title="Cambiar el tono de piel"
                    aria-label="Cambiar el tono de piel"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {skinToneVariations[actual]?.emoji ?? '✋'}
                  </button>
                );
              }}
            </EmojiPicker.SkinTone>
          </div>
          {!busqueda && recientes.length > 0 && (
            <section aria-label="Recientes" className="border-b border-border px-1.5 pb-1.5">
              <h3 className="px-1.5 pb-1 pt-2 text-xs font-bold text-muted-foreground">Recientes</h3>
              <div className="grid grid-cols-9">
                {recientes.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => elegir(emoji)}
                    aria-label={emoji}
                    className="flex size-9 items-center justify-center rounded-lg text-2xl transition-colors hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          )}
          <EmojiPicker.Viewport className="relative flex-1 outline-none">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Cargando emojis…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {({ search }) => <>Nada con “{search}”</>}
            </EmojiPicker.Empty>
            <EmojiPicker.List className="select-none pb-1.5" components={COMPONENTES} />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      )}
    </div>
  );
}
