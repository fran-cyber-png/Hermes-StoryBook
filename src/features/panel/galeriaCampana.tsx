import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { PanelDerecho } from './PanelDerecho';
import { HojaContacto } from './HojaContacto';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * EL PANEL DERECHO EN LOS DOS MÓDULOS, UNO AL LADO DEL OTRO.
 *
 * Monta el `PanelDerecho` **de verdad** (no una maqueta como `galeria.tsx`, que
 * es la del rediseño de ADR 0017): es la única forma de fotografiar qué ve un
 * operador de campaña, que es lo que se reportó mal.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-panel-campana.html
 *
 * 🔴 **EL `fetch` DE ESTA GALERÍA DEVUELVE 403 EN LAS RUTAS DE `ventas` Y CUELGA
 * EN LA FICHA — a propósito, las dos cosas.** El 403 es literalmente lo que
 * contesta producción (`modulos/deEsteModulo.ts`) y colgar la ficha es el estado
 * «cargando» de verdad, que es donde vivía el defecto: en React Query v5 una
 * query apagada se queda `pending` para siempre, así que el skeleton del panel
 * de campaña no terminaba nunca. Con un stub que resuelve rápido y bonito, ese
 * defecto **no se ve** — la cicatriz de «la galería mostraba el caso ideal».
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987461490:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987461490',
  persona_nombre: 'Mario',
  numero_propio: '51963139984',
  texto: 'Buenas, quería saber más',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 2,
  referencia: '2026-08-21T14:00:00.000Z',
  ultimo_at: '2026-08-21T14:00:00.000Z',
  dias: 0,
  nivel: 3,
};

/**
 * LA MISMA CONVERSACIÓN, PERO TRABAJADA — ficha anotada, etapa declarada,
 * etiquetas puestas y distrito elegido.
 *
 * 🔴 **Existe porque el caso vacío solo NO es evidencia.** Con un único contacto
 * recién llegado, la galería no podía mostrar ni el bloque «Quién es» lleno, ni
 * el chip de etapa, ni las píldoras de etiqueta — o sea, justo lo que este
 * frente agrega. La cicatriz de la casa es la contraria (servir el caso ideal y
 * esconder los feos): acá hacen falta **los dos**, uno al lado del otro.
 */
const TRABAJADA: Conversacion = {
  ...CONTACTO,
  clave: 'conv:whatsapp:51900333444:51963139984',
  persona_id: '51900333444',
  persona_nombre: 'Karina Tarazona',
  etapa_efectiva: 'comprometido',
  n: 9,
};

/**
 * EL CLIENTE DE VENTAS CON LAS TRES FUENTES A LA VEZ — Cerberus, el formulario
 * y la ficha anotada.
 *
 * 🔴 **Es el caso que reportó la duplicación y ninguna galería lo servía.** Con
 * Cerberus colgado (el otro caso de acá) el panel nunca llega a dibujar la mitad
 * donde el correo salía dos veces, cada vez con su propio «Escribirle». Los
 * valores son los de la captura del dueño del 24-ago-2026, con el correo largo
 * incluido: es donde el renglón se trunca.
 */
const CLIENTE: Conversacion = {
  ...CONTACTO,
  clave: 'conv:whatsapp:51900111222:51984429504',
  persona_id: '51900111222',
  persona_nombre: 'Renzo Chuquival',
  numero_propio: '51984429504',
  etapa_efectiva: 'cierre',
  n: 14,
};

/** Ventas con línea propia: sin `numero_propio` no hay rueda que consultar. */
const CONTACTO_VENTAS: Conversacion = { ...CONTACTO, numero_propio: '51984429504' };
/** La misma, ya asignada: el chip pasa de verbo a nombre. */
const ASIGNADA: Conversacion = { ...CONTACTO_VENTAS, asignada_a: 'ventas11@grupogoberna.com' };

/**
 * Las superficies que `modulos/modulo.ts` declara de `ventas`.
 *
 * ⚠️ **Decía `/api/contactos` a secas y eso ya no es producción**: desde el
 * 23-ago-2026 se vedan las tres subrutas que van contra Cerberus y NO el router,
 * porque `/registro` —la ficha rápida— es CRM genérico de los dos módulos. Con
 * el prefijo corto, esta galería seguiría dibujando el defecto que se arregló.
 */
const DE_VENTAS = [
  // #1033 — la consulta única del perfil también es de `ventas`.
  '/api/contactos/perfil',
  '/api/contactos/ficha',
  '/api/contactos/lead',
  '/api/contactos/registrar-venta',
  '/api/gestiones/intereses',
  '/api/venta',
  '/api/productos',
];

const real = globalThis.fetch;
globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : (entrada as Request).url);

  /**
   * ⚠️ **El 403 es de las conversaciones de CAMPAÑA, no de la ruta.** Este `if`
   * no miraba de quién era la conversación, así que le contestaba 403 también a
   * los casos de ventas — y ahí `/api/contactos/ficha` es legítima. El síntoma:
   * el caso «cliente» se dibujaba con «No se pudo saber» y los cuatro campos en
   * guion, o sea fotografiando un fallo en vez de lo que se quería mostrar.
   */
  const deCampana = url.includes('51987461490') || url.includes('51900333444');

  // Lo de la Escuela contesta 403, como en producción para una línea de campaña.
  if (deCampana && DE_VENTAS.some((r) => url.includes(r))) {
    return new Response(JSON.stringify({ ok: false, message: 'este módulo no es tuyo' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  const esCliente = url.includes('51900111222');

  // #1033 — en los casos de ventas el panel lee UNA consulta de perfil: se arma con
  // las mismas respuestas de abajo. Para quien no es cliente la ficha se cuelga, y
  // el perfil también: el mismo «cargando» de verdad.
  if (url.includes('/api/contactos/perfil')) {
    const pedir = async (ruta: string) => (await globalThis.fetch(url.replace('/api/contactos/perfil', ruta))).json();
    const [ficha, lead] = await Promise.all([pedir('/api/contactos/ficha'), pedir('/api/contactos/lead')]);
    return new Response(JSON.stringify({ ficha, lead: lead?.lead ?? null, padron: null, errores: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  // La ficha de Cerberus: para el cliente contesta; para los demás **se cuelga**,
  // que es el estado «cargando» de verdad (donde vivía el skeleton eterno).
  if (url.includes('/api/contactos/ficha') || url.includes('/api/cerberus')) {
    if (!esCliente) return new Promise<Response>(() => {});
    return new Response(
      JSON.stringify({
        estado: 'cliente',
        id: 5936,
        nombre: 'Renzo Chuquival Medina',
        codigo: 'CLI-04812',
        dni: '71004812',
        pais: 'Perú',
        correo: 'r.chuquival.m@gmail.com',
        ventasCount: 1,
        ventas: [
          {
            folio: 'GOB-10488',
            estado: 'Pagado',
            fecha: '2026-04-28T23:24:00.000Z',
            monto: '300.00',
            moneda: 'PEN',
            productos: ['Diploma Internacional del Gestor Parlamentario 1'],
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  // El formulario: el MISMO correo que Cerberus — que es exactamente el caso que
  // hacía salir «Escribirle» dos veces.
  if (url.includes('/api/contactos/lead')) {
    return new Response(
      JSON.stringify({
        lead: esCliente
          ? {
              nombre: 'Renzo Chuquival',
              email: 'r.chuquival.m@gmail.com',
              campana: 'Diploma Élite del Gestor Parlamentario',
              anuncio: null,
              formulario: 'icarus:landing',
              fecha: '2026-04-22T17:41:00.000Z',
              fuente: 'web',
            }
          : null,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  // La rueda: sin ella `PasarConversacion` no se dibuja («un botón que abre una
  // lista vacía no es una acción»), así que el chip de asignación no se podría
  // fotografiar. Los nombres son los de la rueda real de la Escuela.
  if (url.includes('/api/reparto/rueda')) {
    return new Response(
      JSON.stringify({
        destinos: ['ventas10@grupogoberna.com', 'ventas11@grupogoberna.com', 'luz'],
        rueda: [
          { vendedoraId: 'ventas10@grupogoberna.com', asignadas: 34 },
          { vendedoraId: 'ventas11@grupogoberna.com', asignadas: 31 },
          { vendedoraId: 'luz', asignadas: 12 },
        ],
        nombres: { 'ventas10@grupogoberna.com': 'Sindy', 'ventas11@grupogoberna.com': 'Tracy', luz: 'Luz' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/api/enlaces')) {
    return new Response(JSON.stringify({ origenes: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // ¿Cuál de las dos conversaciones de campaña pregunta? Los stubs de abajo
  // contestan distinto para poder fotografiar el panel vacío y el trabajado.
  const trabajada = url.includes('51900333444');

  // ADR 0088 — el buscador y la reversa del modal, ANTES del `/api/territorio`
  // a secas de más abajo: las dos rutas empiezan con ese mismo prefijo.
  if (url.includes('/api/territorio/geocodificar/inverso')) {
    return new Response(
      JSON.stringify({
        ok: true,
        direccion: { displayName: 'Jr. Los Pinos 456, San Isidro, Lima, Perú', lat: -12.0977, lon: -77.0365 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/api/territorio/geocodificar')) {
    return new Response(
      JSON.stringify({
        ok: true,
        resultados: [
          { displayName: 'Av. Javier Prado Este 4200, Villa María del Triunfo, Lima, Perú', lat: -12.166, lon: -76.935 },
          { displayName: 'Jr. Los Pinos 456, San Isidro, Lima, Perú', lat: -12.0977, lon: -77.0365 },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/api/territorio')) {
    // Los distritos REALES que carga `npm run territorio:distritos`, no tres
    // inventados: el bloque tiene que verse con nombres del largo que va a tener.
    const distritos = [
      { id: 1, nombre: 'San Isidro', zona: 'Lima Centro', orden: 0 },
      { id: 2, nombre: 'Villa María del Triunfo', zona: 'Lima Sur', orden: 1 },
      { id: 3, nombre: 'San Juan de Lurigancho', zona: 'Lima Este', orden: 2 },
    ];
    return new Response(
      JSON.stringify({
        distritos,
        // Desde ADR 0088 la dirección es el dato primario y el distrito lo
        // clasificó solo el servidor — acá se simula ese resultado YA hecho,
        // que es lo único que la galería puede fotografiar sin backend real.
        actual: trabajada
          ? {
              distritoId: 2,
              direccion: 'Av. Javier Prado Este 4200, Villa María del Triunfo, Lima, Perú',
              lat: -12.166,
              lon: -76.935,
              anotadoPor: 'centurion:betto.romero',
            }
          : null,
        conteos: { '1': 34, '2': 212, '3': 96 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  // La ficha rápida: anda en los dos módulos. `null` = todavía sin registrar,
  // que es el estado en el que el botón dice «Anotar quién es».
  if (url.includes('/api/contactos/registro')) {
    return new Response(
      JSON.stringify({
        ficha: trabajada
          ? {
              clave: TRABAJADA.clave,
              telefono: '51900333444',
              nombre: 'Karen',
              apellido: 'Tarazona Quispe',
              empresa: null,
              // Un correo largo a propósito: es donde el renglón se trunca.
              email: 'k.tarazona.q@gmail.com',
              prioridad: 'alta',
              vendedoraId: 'centurion:betto.romero',
              creadoAt: '2026-08-22T15:12:00.000Z',
              actualizadoAt: '2026-08-22T15:12:00.000Z',
            }
          : null,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  // Etiquetas y catálogo: CRM genérico, los dos módulos. El vocabulario es el de
  // una campaña —no «precio»/«reclamo», que no dicen nada acá (ADR 0078).
  if (url.includes('/api/gestiones/etiquetas')) {
    return new Response(
      JSON.stringify({
        etiquetas: trabajada ? { [TRABAJADA.clave]: ['líder vecinal', 'quiere volantear'] } : {},
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/api/categorias')) {
    return new Response(
      JSON.stringify({
        categorias: [
          { id: 1, nombre: 'líder vecinal', color: 'morado', esFavorito: true, orden: 0, conteo: 12 },
          // Sin color de catálogo: cae neutra, que es la mitad que casi nunca se
          // fotografía y la que descubre si la píldora sin punto se lee igual.
          { id: 2, nombre: 'no molestar', color: 'rojo', esFavorito: false, orden: 1, conteo: 3 },
        ],
        supervisor: false,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.includes('/api/eventos')) {
    return new Response(JSON.stringify({ eventos: [], correos: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('/api/senales')) {
    return new Response(JSON.stringify({ senales: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('/api/agenda')) {
    return new Response(JSON.stringify({ recordatorios: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return real(entrada, init);
}) as typeof fetch;

function Caso({ titulo, nota, children }: { titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div>
        <h2 className="font-heading text-sm font-bold text-foreground">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </div>
      <div className="h-[720px] w-[360px]">{children}</div>
    </section>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-wrap gap-8 bg-background p-8">
        <Caso
          titulo="Campaña · recién llegada"
          nota="El caso feo: sin ficha, sin etapa, sin etiquetas. Los huecos se dibujan con guiones, no con un párrafo, y el pie ofrece la salida."
        >
          <PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />
        </Caso>
        <Caso
          titulo="Campaña · trabajada"
          nota="Lo que antes no se veía en ninguna parte: ficha, etapa, etiquetas y distrito."
        >
          <PanelDerecho conversacion={TRABAJADA} miVendedora="centurion:betto.romero" esDeCampana />
        </Caso>
        <Caso titulo="Ventas · sin Cerberus" nota="La otra mitad: la ficha en vuelo y «Registrar venta» en el pie.">
          <PanelDerecho conversacion={CONTACTO} miVendedora="luz" />
        </Caso>
        <Caso
          titulo="Ventas · cliente"
          nota="Las tres fuentes a la vez. Un correo, un «Escribirle», y cada campo dice de dónde salió."
        >
          <PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />
        </Caso>
        {/* La HOJA — el panel como se abre desde el Pipeline y el padrón, con su
            barra propia. Es el único lugar donde vive el control de asignación,
            que es lo que el supervisor toca a cada rato. */}
        <Caso
          titulo="La hoja · sin asignar"
          nota="El chip dice «Asignar» —el verbo de lo que falta—, no «Sin asignar»."
        >
          <div className="relative h-full w-full">
            <HojaContacto conversacion={CONTACTO_VENTAS} onCerrar={() => {}} miVendedora="luz" />
          </div>
        </Caso>
        <Caso titulo="La hoja · asignada" nota="Con dueña la palabra ES el dato: quién atiende.">
          <div className="relative h-full w-full">
            <HojaContacto conversacion={ASIGNADA} onCerrar={() => {}} miVendedora="luz" />
          </div>
        </Caso>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
