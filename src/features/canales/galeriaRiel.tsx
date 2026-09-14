import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { arrancarTema } from '../../lib/tema';
import { queryClient } from '../../lib/datos/cliente';
import { FilaConversacion } from './FilaConversacion';
import { RielDeCanales } from './RielDeCanales';
import { opcionDeCanal } from './canalesDelRiel';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA GALERÍA DEL RIEL DE CANALES — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-riel.html
 *     …?campana=1 → lo que ve un operador de campaña (sin «Formulario»)
 *
 * ══ 🔴 LO QUE ESTA GALERÍA TIENE QUE PROBAR ════════════════════════════════
 *
 * 1. **Que el riel entra a 1280 sin comerse el chat.** Las cuatro anchuras de
 *    abajo están COPIADAS de `App.tsx`, no elegidas para que quede lindo:
 *    navegación `4.75rem`, cola `25rem`, ficha `22.5rem`, `gap-3` y `p-3`. A
 *    1280 (80rem) eso dejaba **24,75rem** al chat; con el riel de `4.5rem`
 *    quedan **20,25rem**. Si alguien ensancha el riel, acá se ve primero.
 * 2. **Que «Grupos» se lee como “todavía no”, y no como “roto”.** Es la única
 *    entrada apagada y la única que no filtra la cola.
 * 3. **Que el canal activo se distingue del resto** de un vistazo.
 *
 * ══ ⚠️ LO QUE ESTA GALERÍA **NO** PRUEBA ═══════════════════════════════════
 *
 * El riel y las filas son los componentes REALES. El chat y la ficha son dos
 * bloques vacíos: acá se mide el REPARTO de ancho, no lo que dibujan. Y la
 * cabecera de `ColaUnificada` —que perdió el desplegable «Canales ▾»— no se ve,
 * porque montarla pide el server. Eso queda verificado por tipos y por tests,
 * no por captura, y está dicho en vez de aparentado.
 *
 * ⚠️ Los textos de las filas salieron de producción (censo del 11-ago-2026), por
 * el mismo motivo que el resto de las galerías de este frente: la que mostraba
 * el caso ideal no reflejó ninguno de los tres defectos que producción tenía a
 * la vista.
 */

const PARAMS = new URLSearchParams(location.search);
const CAMPANA = PARAMS.has('campana');

function haceHoras(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:51986394450`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51986394450',
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: false,
    n: 1,
    referencia: haceHoras(3),
    ultimo_at: haceHoras(3),
    dias: 0,
    nivel: 3,
    ...over,
  };
}

/** Una fila por canal, para que el filtro se pueda ver funcionando de verdad. */
const FILAS: Conversacion[] = [
  fila({
    persona_id: '51987654321',
    persona_nombre: 'Rosa M.',
    texto: 'Hola Quiero más información del Diploma de Inteligencia y Contrainteligencia',
    nivel: 3,
  }),
  fila({
    persona_id: '51912345678',
    persona_nombre: 'Luis Ángel',
    texto: 'Pásame la cotización urgentemente quiero comprar ahora mismo',
    pregunto: true,
    nivel: 1,
  }),
  fila({
    clave: 'conv:facebook:comentario:1',
    canal: 'facebook',
    tipo: 'comentario',
    persona_id: '10012345',
    persona_nombre: 'Jorge Luis Ocaña',
    texto: 'Cuánto dura el diplomado?',
    contexto_texto: 'Convocatoria abierta — Diploma de Consultor Político',
    nivel: 2,
  }),
  fila({
    clave: 'conv:facebook:mensaje:2',
    canal: 'facebook',
    tipo: 'mensaje',
    persona_id: '10098765',
    persona_nombre: 'Marisol Ayala',
    texto: 'Buenas noches, sigo interesada',
    nivel: 2,
  }),
  fila({
    clave: 'conv:instagram:3',
    canal: 'instagram',
    tipo: 'comentario',
    persona_id: 'ig_44210',
    persona_nombre: 'karito.vlz',
    texto: 'info porfa 🙏',
    nivel: 3,
  }),
];

function Galeria() {
  const [canal, setCanal] = useState('');
  const opcion = opcionDeCanal(canal, CAMPANA);
  // `FILAS` es un fixture fijo, no una respuesta del server: acá se simulan
  // los DOS filtros (`canal` y `tipo`) sobre el mismo array para poder ver el
  // riel sin levantar la cola de verdad. En la cola real, hoy, los dos ya
  // los aplica el server (`consultarCola.ts`).
  const visibles = FILAS.filter(
    (c) => (!opcion?.canal || c.canal === opcion.canal) && (!opcion?.tipo || c.tipo === opcion.tipo),
  );

  return (
    <div className="flex h-screen flex-col bg-app">
      <div className="shrink-0 border-b border-border bg-card px-4 py-2">
        <p className="text-xs font-bold text-navy-ink">
          Riel de canales — anchuras reales de `App.tsx` a 1280 {CAMPANA ? '· módulo CAMPAÑA' : ''}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Navegación 4,75rem · riel 4,5rem · cola 25rem · ficha 22,5rem. Lo que sobra es el chat.
        </p>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* La navegación de vistas: acá es un bloque, sólo ocupa su ancho real. */}
        <div className="flex w-[4.75rem] shrink-0 items-start justify-center border-r border-border bg-card pt-3">
          <span className="text-[10px] font-semibold text-muted-foreground">vistas</span>
        </div>
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <RielDeCanales canal={canal} onCanal={setCanal} esDeCampana={CAMPANA} />
          <main className="min-h-0 w-[25rem] shrink-0 overflow-y-auto rounded-2xl bg-card">
            {visibles.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nada por {opcion?.label} todavía.
              </p>
            ) : (
              visibles.map((c, i) => (
                <FilaConversacion key={c.clave} c={c} seleccionada={false} onAbrir={() => {}} indice={i} />
              ))
            )}
          </main>
          <section className="min-h-0 flex-1 rounded-2xl border border-dashed border-border">
            <p className="p-3 text-[11px] text-muted-foreground">
              el chat (bloque: acá se mide el ancho que le queda, no lo que dibuja)
            </p>
          </section>
          <aside className="min-h-0 w-[22.5rem] shrink-0 rounded-2xl border border-dashed border-border">
            <p className="p-3 text-[11px] text-muted-foreground">la ficha (bloque)</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

arrancarTema();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
