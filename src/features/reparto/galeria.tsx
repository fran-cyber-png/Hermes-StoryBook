import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { BarraFiltros } from '../canales/BarraFiltros';
import { opcionesDeLinea } from '../canales/alcance';
import { FilaConversacion } from '../canales/FilaConversacion';
import { PanelDerecho } from '../panel/PanelDerecho';
import { PanelUsuario } from '../auth/PanelUsuario';
import { PasarConversacion } from './PasarConversacion';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA GALERÍA DEL REPARTO DE LEADS — la evidencia, sin nada vivo detrás.
 *
 * Entry APARTE de Vite (`galeria-reparto.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199   →  http://localhost:5199/galeria-reparto.html
 *
 * Existe por la regla dura #2 (nada de UI se reporta listo sin captura).
 *
 * ⚠️ **La píldora "de quién es" en la fila SE SACÓ (28-ago-2026, pedido del
 * dueño)**: quedaba duplicada con el ícono de agente asignado debajo del
 * avatar, que ya muestra el mismo dato (`c.asignada_a`) al pasar el mouse —
 * dos maneras de decir lo mismo en la misma fila. Las cuatro filas de acá
 * abajo siguen sirviendo para ver que ese ícono aparece igual (y que su
 * tooltip trae el nombre correcto) sea de quién sea la conversación; lo que
 * YA NO demuestran es una diferencia VISIBLE sin hover entre "es tuya", "es
 * de otra persona" y "sin dueño" — esa distinción quedó atrás del hover a
 * propósito.
 */

const AHORA = Date.now();
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

/**
 * El latido que `PanelUsuario` reenvía a Configuración. Es una FUENTE, no un
 * estado ya formateado: el cronómetro lo calcula quien lo dibuja (`actividad.ts`).
 * Con `iniciadaEn` a 14 m 32 s de `AHORA`, el modal muestra `00:14:32`.
 */
const ACTIVIDAD_DE_MUESTRA = {
  iniciadaEn: AHORA - (14 * 60_000 + 32_000),
  hayVendedora: true,
  ultimaActividad: () => Date.now(),
};

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:51984429504`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51984429504',
    texto: 'Buenas, quería consultar por el diploma. ¿Cuánto sale y en cuántas cuotas se puede?',
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: true,
    n: 2,
    referencia: haceHoras(3),
    ultimo_at: haceHoras(3),
    dias: 0,
    nivel: 0,
    ...over,
  };
}

/**
 * Los mismos cuatro casos de antes del 28-ago-2026 — sin dueño, de otra
 * persona, tuya, y el peor caso con cliente+bot a la vez —, ahora para
 * comprobar que el ÍCONO de agente asignado (debajo del avatar) se comporta
 * igual en los cuatro: aparece siempre, y su `title` sólo trae un nombre
 * cuando `asignada_a` existe.
 */
const FILAS: { rotulo: string; c: Conversacion }[] = [
  {
    rotulo: 'SIN DUEÑO — el ícono aparece igual, pero su tooltip no dice ningún nombre.',
    c: fila({ persona_id: '51900000001', persona_nombre: 'Marta Quispe' }),
  },
  {
    rotulo: 'ES DE OTRA PERSONA — el tooltip del ícono dice "Sindy". Ya no hay ninguna píldora en el renglón 1 que lo repita.',
    c: fila({ persona_id: '51900000003', persona_nombre: 'Rosa Huamán', asignada_a: 'sindy.rojas' }),
  },
  {
    rotulo: 'ES TUYA — el tooltip dice "Ana" igual que para cualquier otra persona: el ícono ya no distingue "mía" de "ajena", ese criterio vivía sólo en la píldora que se sacó.',
    c: fila({ persona_id: '51900000004', persona_nombre: 'Carlos Vega', asignada_a: 'ana' }),
  },
  {
    rotulo: 'EL PEOR CASO (~4 % de las filas) — dueño + cliente + bot a la vez, y el ícono de agente sigue alineado con las etiquetas, sin competir con el bot ni con la marca de cliente de arriba.',
    c: fila({
      persona_id: '51900000005',
      persona_nombre: 'Lucía Ferrer',
      asignada_a: 'walter',
      cliente_nivel: 'recompro',
      cliente_compras: 3,
      bot_escalada: true,
      bot_motivo: 'por_cerrar',
      bot_temperatura: 'caliente',
    }),
  },
];

const LINEAS = [
  { numero: '51986394450', etiqueta: 'Ventas Perú', estado: 'conectado' },
  { numero: '51941654039', etiqueta: 'Walter Ventas', estado: 'conectado' },
  { numero: '51944531711', etiqueta: 'Venta Peru', estado: 'conectado' },
  { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado' },
];

const CONTEOS = { preguntoPrecio: 65, teEscribieron: 33, botEscalada: 33, botCaliente: 30 };

// `useLineas()` pide `/api/whatsapp/lineas`. Acá no hay server, así que se le
// siembra la respuesta en el caché: el componente no se entera de la diferencia
// y la galería sigue sin depender de la red.
queryClient.setQueryData(['lineas-whatsapp'], {
  lineas: [{ numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true }],
});

// ── El selector de destinos, ANTES y DESPUÉS ────────────────────────────────
// Los destinos son los REALES de producción (medidos el 18-ago-2026), incluidas
// las dos cuentas que Hermes no sabe cómo se llaman: si la galería sirviera un
// caso ideal, escondería justo el borde que este frente tiene que dibujar bien.
const DESTINOS_REALES = [
  'Luz',
  'Sindy',
  'ventas11@grupogoberna.com',
  'ventas12@grupogoberna.com',
  'ventas13@grupogoberna.com',
];
const RUEDA_REAL = [
  { vendedoraId: 'ventas11@grupogoberna.com', asignadas: 11, orden: 1, activa: true },
  { vendedoraId: 'ventas12@grupogoberna.com', asignadas: 11, orden: 2, activa: true },
  { vendedoraId: 'ventas13@grupogoberna.com', asignadas: 1, orden: 3, activa: false },
];

// ANTES (o: un server sin este frente, o una respuesta rehidratada del caché de
// IndexedDB): `nombres` ausente. Cada fila cae a `nombreCorto()`.
queryClient.setQueryData(['reparto-rueda', '51900000000'], {
  linea: '51900000000',
  rueda: RUEDA_REAL,
  destinos: DESTINOS_REALES,
});

// DESPUÉS: lo que sirve `nombresDe` hoy en producción. Ojo que `ventas13@` NO
// está — en Cerberus no tiene nombre y nunca se logueó, así que `equipo.nombre`
// guarda su propio correo y `esNombreDeVerdad` lo descarta. Se sigue viendo
// «Ventas13», que es la verdad: Hermes no sabe cómo se llama.
queryClient.setQueryData(['reparto-rueda', '51984429504'], {
  linea: '51984429504',
  rueda: RUEDA_REAL,
  destinos: DESTINOS_REALES,
  nombres: {
    'ventas11@grupogoberna.com': 'Cielo Huambo',
    'ventas12@grupogoberna.com': 'James',
  },
});

// ── 🔴 DE DÓNDE SALE LA LISTA, Y CUÁNTO TIENE CADA UNO (8-sep-2026) ─────────
// Medido en VPS1 sobre la línea REAL de Ventas Meta. Es el reporte del dueño:
// «esos nombres son estáticos, deberían depender del modal de Cerberus».
//
// La rueda (`reparto_rueda`) y el mapa (`numero_vendedora`) no compartían NI UNA
// identidad: la primera se carga a mano y quedó con los `ventas1X@` que Cerberus
// ya no usa; el segundo lo empuja el modal «Vendedoras de la línea». Unirlas daba
// 13 destinos para 7 personas, con el mismo humano dos veces (Alex es también
// `ventas10@`, Cielo es `ventas11@`, James es `ventas12@`).
const CARGAS_MEDIDAS = [
  { vendedoraId: 'ventas10@grupogoberna.com', asignadas: 21, orden: 0, activa: true },
  { vendedoraId: 'ventas11@grupogoberna.com', asignadas: 21, orden: 1, activa: true },
  { vendedoraId: 'ventas12@grupogoberna.com', asignadas: 20, orden: 2, activa: true },
  { vendedoraId: 'ventas13@grupogoberna.com', asignadas: 1, orden: 3, activa: false },
  { vendedoraId: 'ventas14@grupogoberna.com', asignadas: 0, orden: 4, activa: false },
  { vendedoraId: 'Tracy', asignadas: 0, orden: 5, activa: false },
  // Las tres que tienen conversaciones sin estar en la rueda. `luz` es la clave
  // de la galería: su destino se sirve como `Luz` y su carga está escrita `luz`.
  { vendedoraId: 'luz', asignadas: 3850, orden: 999, activa: false },
  { vendedoraId: 'Sindy', asignadas: 182, orden: 999, activa: false },
  { vendedoraId: 'Aperez', asignadas: 137, orden: 999, activa: false },
];

/** Lo que `equipo.nombre` sabe hoy. Darian, Darwin, Jahelly y Nicole no tienen fila. */
const NOMBRES_MEDIDOS = {
  alex: 'Alex Roldán',
  luz: 'Luz',
  sindy: 'Sindy',
  tracy: 'Tracy',
  'ventas11@grupogoberna.com': 'Cielo Huambo',
  'ventas12@grupogoberna.com': 'James',
};

// ANTES: rueda ∪ mapa. Trece renglones, y «Luz 0» sobre 3.850 conversaciones.
queryClient.setQueryData(['reparto-rueda', '51900000013'], {
  linea: '51900000013',
  rueda: CARGAS_MEDIDAS,
  destinos: [
    'Alex', 'Darian', 'Darwin', 'Jahelly', 'Luz', 'Nicole', 'Sindy', 'Tracy',
    'ventas10@grupogoberna.com', 'ventas11@grupogoberna.com', 'ventas12@grupogoberna.com',
    'ventas13@grupogoberna.com', 'ventas14@grupogoberna.com',
  ],
  nombres: NOMBRES_MEDIDOS,
});

// DESPUÉS: sólo el mapa, y la carga buscada normalizando. Siete renglones y el
// 3850 de Luz a la vista, que es el número con el que se decide a quién pasarle.
queryClient.setQueryData(['reparto-rueda', '51900000007'], {
  linea: '51900000007',
  rueda: CARGAS_MEDIDAS,
  destinos: ['Alex', 'Darian', 'Darwin', 'Jahelly', 'Luz', 'Nicole', 'Sindy'],
  nombres: NOMBRES_MEDIDOS,
});

function paraSelector(numeroPropio: string): Conversacion {
  return fila({ persona_id: '51900000009', persona_nombre: 'Lead de prueba', numero_propio: numeroPropio, clave: `conv:whatsapp:51900000009:${numeroPropio}` } as Partial<Conversacion>);
}

function Galeria() {
  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-xl font-bold text-foreground">Reparto de leads — la evidencia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Siete personas comparten la línea 51984429504. Sin dueño en la fila, el reparto no evita
            ni que dos contesten al mismo lead ni que nadie conteste a otro.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            El selector ofrece TUS líneas, no todas las vivas
          </h2>
          <p className="text-xs text-muted-foreground">
            Antes listaba las cuatro. Con cinco vendedoras que atienden una sola, eso les ponía
            adelante tres colas ajenas — y «Ventas Perú» y «Venta Peru» se distinguen por una{' '}
            <code>s</code> y una tilde.
          </p>
          <p className="text-xs text-muted-foreground">Lo que ve una de las 5 (una línea propia): sin selector.</p>
          <div className="rounded-2xl bg-card p-3 shadow-panel">
            <BarraFiltros
              filtroSec=""
              onFiltro={() => {}}
              conteos={CONTEOS}
              categoriaActiva={null}
              onCategoria={() => {}}
              onListas={() => {}}
              opciones={opcionesDeLinea(
                LINEAS.map((l) => ({ ...l, mias: l.numero === '51984429504' })),
                true,
              )}
              lineaActiva="51984429504"
              onLinea={() => {}}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lo que ve Luz (dos líneas propias): «Las mías» + las suyas, sin «Todas».
          </p>
          <div className="rounded-2xl bg-card p-3 shadow-panel">
            <BarraFiltros
              filtroSec=""
              onFiltro={() => {}}
              conteos={CONTEOS}
              categoriaActiva={null}
              onCategoria={() => {}}
              onListas={() => {}}
              opciones={opcionesDeLinea(
                LINEAS.map((l) => ({
                  ...l,
                  mias: l.numero === '51984429504' || l.numero === '51986394450',
                })),
                true,
              )}
              lineaActiva="mias"
              onLinea={() => {}}
            />
          </div>

        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">«Quién soy» — el avatar del riel</h2>
          <p className="text-xs text-muted-foreground">
            Era un <code>&lt;span&gt;</code> con un <code>title</code>: la única forma de saber con qué
            usuario estabas era esperar el tooltip del sistema. Con cinco vendedoras compartiendo una
            línea, «¿entré con el usuario que era?» y «¿por qué no veo mis leads?» son la misma
            pregunta. El usuario va en mono y completo porque <b>es la clave con la que el reparto le
            asigna las conversaciones</b>.
          </p>
          <p className="text-xs text-muted-foreground">
            Desde el 20-ago-2026 esto vive adentro de «Configuración» (el modal centrado, evidencia
            completa en <code>galeria-cambiar-clave.html?paso=panel</code>), no en el popover chico del
            avatar — el popover quedó con solo dos botones (Configuración, Cerrar sesión). Acá el
            disparador REAL, cerrado (el modal es `fixed inset-0` y taparía el resto de esta página).
          </p>
          <div className="flex gap-4">
            <PanelUsuario
              vendedora={{ id: 'ventas10@grupogoberna.com', nombre: 'Ventas10' }}
              onSalir={() => {}}
              onPerfilActualizado={() => {}}
              cerberusVivo={true}
              actividad={ACTIVIDAD_DE_MUESTRA}
            />
          </div>

          <h2 className="pt-4 text-sm font-bold text-foreground">
            El pie del panel: «Registrar venta», y siempre está
          </h2>
          <p className="text-xs text-muted-foreground">
            El pie exigía un handler para dibujar el botón —bien: nunca un no-op— y{' '}
            <code>PanelDerecho</code> lo montaba sin pasarle ninguno, así que el botón{' '}
            <b>no podía aparecer en ningún estado</b>. Acá va el panel REAL, a 360×720 (el tamaño
            donde el reparto flex ya lo había empujado fuera una vez, ADR 0017). Sin server detrás:
            la ficha falla, y el botón está igual.
          </p>
          <div className="h-[45rem] w-[22.5rem]">
            <PanelDerecho conversacion={FILAS[0]!.c} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            «Pasar la conversación a» — un nombre, no una cuenta de sistema
          </h2>
          <p className="text-xs text-muted-foreground">
            El selector no leía mal el nombre: <b>no leía ninguno</b>. Recortaba el{' '}
            <code>vendedora_id</code>, que para media rueda es el correo de Cerberus. Luz y Sindy se
            veían bien de casualidad — su username ya es su nombre.
          </p>
          <div className="flex gap-10">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                ANTES · sin <code>nombres</code> (server viejo o caché rehidratado)
              </p>
              <div className="w-[22.5rem] rounded-2xl bg-card p-3 pb-64 shadow-panel">
                <PasarConversacion conversacion={paraSelector('51900000000')} miVendedora="Luz" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">DESPUÉS</p>
              <div className="w-[22.5rem] rounded-2xl bg-card p-3 pb-64 shadow-panel">
                <PasarConversacion conversacion={paraSelector('51984429504')} miVendedora="Luz" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <b>Ventas13 sigue diciendo «Ventas13», y está bien</b>: en Cerberus no tiene nombre
            cargado y nunca se logueó, así que <code>equipo.nombre</code> guarda su propio correo y{' '}
            <code>esNombreDeVerdad</code> lo descarta. Servirlo mostraría{' '}
            <code>ventas13@grupogob…</code> cortado, que es peor. Un hueco no se dibuja nunca.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            🔴 De dónde sale la lista, y cuánto tiene cada uno (8-sep-2026)
          </h2>
          <p className="text-xs text-muted-foreground">
            Reporte del dueño: <i>«esos nombres son estáticos, deberían depender de esto»</i>, sobre
            el modal «Vendedoras de la línea» de Cerberus. Y no eran estáticos: eran{' '}
            <b>la rueda del round-robin unida al mapa</b>, y esas dos listas no compartían{' '}
            <b>ni una sola identidad</b>. Los datos de abajo son los de producción, no un caso ideal.
          </p>
          <div className="flex gap-10">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                ANTES · rueda ∪ mapa: 13 renglones para 7 personas
              </p>
              <div className="w-[22.5rem] rounded-2xl bg-card p-3 pb-96 shadow-panel">
                <PasarConversacion conversacion={paraSelector('51900000013')} miVendedora="alex" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                DESPUÉS · lo que marca el modal, y la carga de verdad
              </p>
              <div className="w-[22.5rem] rounded-2xl bg-card p-3 pb-96 shadow-panel">
                <PasarConversacion conversacion={paraSelector('51900000007')} miVendedora="alex" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Lo que el ANTES demuestra es <b>la lista</b>: trece renglones para siete personas, con{' '}
            <b>Alex dos veces</b> —«Alex Roldán (tú)» y «Ventas10» son el mismo humano con dos
            cuentas— más <code>Tracy</code>, que está dada de baja en <code>equipo</code> desde
            hace meses.
          </p>
          <p className="text-xs text-muted-foreground">
            ⚠️ <b>El segundo defecto no se puede dibujar acá, y vale decir por qué.</b> El selector
            mostraba <b>«Luz 0» sobre 3.850 conversaciones</b> —su destino se sirve como{' '}
            <code>Luz</code> y sus asignaciones están escritas <code>luz</code>, así que la búsqueda
            exacta no encontraba la fila y caía al cero—, pero los dos paneles de arriba son el{' '}
            <b>mismo componente ya arreglado</b>: para que el de la izquierda dijera 0 habría que
            servirle datos falsos, y una galería que inventa el defecto no es evidencia de nada. La
            evidencia de ése es su test en rojo: <code>expected 'Luz0' to contain '3850'</code> en{' '}
            <code>PasarConversacion.test.tsx</code>, con los mismos números de producción.
          </p>
          <p className="text-xs text-muted-foreground">
            ⚠️ <b>La rueda no se toca desde acá</b>: sigue decidiendo a quién le CAEN los leads
            nuevos, y realinearla es operación (<code>npm run reparto:rueda</code>), no código.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-foreground">La fila: de quién es, detrás del hover</h2>
          {FILAS.map(({ rotulo, c }) => (
            <div key={c.clave} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{rotulo}</p>
              {/* 360 px: el ancho real del panel de la cola. */}
              <div className="w-[22.5rem] overflow-hidden rounded-2xl bg-card shadow-panel">
                <FilaConversacion c={c} seleccionada={false} onAbrir={() => {}} indice={0} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
