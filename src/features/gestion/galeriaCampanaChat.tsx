import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { RegistrarEvento } from '../eventos/RegistrarEvento';
import { MenuHerramientas } from './MenuHerramientas';
import { FichaRapida } from '../panel/FichaRapida';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LO QUE EL COMANDO DE CAMPAÑA HACE SOBRE UNA CONVERSACIÓN — los dos módulos,
 * lado a lado.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-campana-chat.html
 *
 * Fotografía las dos cosas que el 22-ago-2026 se reportaron rotas desde el
 * comando de Betto («no se registran», «tampoco me deja etiquetar»):
 *
 *  1. **Las notas rápidas**, que le ofrecían a un operador de campaña «Preguntó
 *     por un curso» y «Pidió precio» sobre el chat de un vecino que escribía
 *     «las principales problemáticas de mi provincia son…».
 *  2. **«Registrar contacto»**, que contestaba «No se guardó — prueba de nuevo»
 *     porque `/api/contactos` entero era superficie de `ventas`.
 *  3. **El menú `···`** (24-ago-2026), que le ofrecía «Datos recomendados» — el
 *     catálogo de argumentos de venta de la Escuela. `/api/hechos` es de
 *     `ventas`, así que la pantalla abría, comía 403 y lo dibujaba como
 *     «Todavía no hay datos cargados»: un candado leído como un catálogo vacío
 *     que a la campaña le tocaba llenar.
 *
 * 🔴 **EL `fetch` CONTESTA 403 EN LO QUE PRODUCCIÓN CONTESTA 403**, y no un
 * caso ideal: `/api/contactos/ficha`, `/api/contactos/lead` y
 * `/api/gestiones/intereses` siguen siendo de `ventas`, así que en la columna de
 * campaña fallan de verdad. Lo que tiene que verse es que el drawer **igual
 * guarda** — con un stub que responde bien a todo, la mitad interesante no se
 * distingue de la rota. Es la cicatriz de «la galería mostraba el caso ideal».
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51920024566:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51920024566',
  // Un alias real de la cola de campaña, con su mojibake: el prellenado lo parte
  // en nombre + empresa y eso es lo que hay que poder mirar.
  persona_nombre: 'inketo del música',
  numero_propio: '51963139984',
  texto: 'Hola. Las principales problemáticas de mi provincia son',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: '2026-08-22T22:04:00.000Z',
  ultimo_at: '2026-08-22T22:04:00.000Z',
  dias: 0,
  nivel: 3,
};

const params = new URLSearchParams(location.search);

/**
 * `?roto=1` reproduce EL DEFECTO: `/api/contactos` entero como superficie de
 * `ventas`, que es lo que había hasta el 23-ago-2026.
 *
 * 🔴 **Está acá para poder fotografiar el ANTES.** El reporte del comando de
 * Betto fue «no se registran», y lo que la pantalla mostraba —«No se guardó —
 * prueba de nuevo»— se lee como un problema de red: nadie podía saber que era una
 * frontera de módulo. Sin este caso, la captura del arreglo no prueba nada,
 * porque un formulario que anda se ve igual que uno que nunca se probó.
 */
const roto = params.has('roto');

/** Lo que sigue siendo de `ventas` después del 23-ago-2026. */
const DE_VENTAS = [
  '/api/contactos/ficha',
  '/api/contactos/lead',
  '/api/contactos/registrar-venta',
  '/api/gestiones/intereses',
  // El catálogo de datos recomendados: es lo que el ítem del `···` abría, y
  // contesta 403 igual que en producción. Sin este renglón la galería mostraría
  // el caso ideal — la cicatriz de la regla dura #9.
  '/api/hechos',
  ...(roto ? ['/api/contactos/registro'] : []),
];

const real = globalThis.fetch;
globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : (entrada as Request).url);
  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

  if (DE_VENTAS.some((r) => url.includes(r))) {
    return json({ ok: false, codigo: 'otro_modulo_del_crm', message: 'esta parte de Hermes es del módulo de ventas' }, 403);
  }
  /**
   * La ficha rápida: CRM genérico, anda en los dos módulos.
   *
   * ⚠️ **Distingue GET de POST**, o el botón no se puede probar: el GET contesta
   * `null` (todavía sin registrar, que es el estado que muestra la captura) y el
   * POST contesta `{ ok: true, ficha }`, que es lo que el drawer necesita para
   * cerrarse. Con una sola respuesta para los dos, apretar «Registrar contacto»
   * se veía igual que el 403 que este frente vino a arreglar.
   */
  if (url.includes('/api/contactos/registro')) {
    if ((init?.method ?? 'GET').toUpperCase() !== 'POST') return json({ ficha: null });
    const enviado = JSON.parse(String(init?.body ?? '{}'));
    return json({
      ok: true,
      ficha: {
        clave: CONTACTO.clave,
        telefono: enviado.telefono ?? null,
        nombre: enviado.nombre ?? null,
        apellido: enviado.apellido ?? null,
        empresa: enviado.empresa ?? null,
        email: enviado.email ?? null,
        prioridad: enviado.prioridad ?? null,
        vendedoraId: 'centurion:job.meneses',
        creadoAt: '2026-08-23T13:00:00.000Z',
        actualizadoAt: '2026-08-23T13:00:00.000Z',
      },
    });
  }
  if (url.includes('/api/eventos')) return json({ eventos: [], correos: [], notas: [] });
  return real(entrada, init);
}) as typeof fetch;

/**
 * Abre el popover después de montar.
 *
 * ⚠️ **No alcanza con montar con `senalAbrir={1}`**: la señal es un contador que
 * se compara contra lo ya visto, y el estado inicial arranca en el valor de la
 * prop — o sea que en el primer render no hay nada que consumir. Tiene que
 * CAMBIAR, que es exactamente cómo la usan el atajo `n` y la paleta.
 */
function ConNotasAbiertas({ esDeCampana }: { esDeCampana: boolean }) {
  const [senal, setSenal] = useState(0);
  useEffect(() => setSenal(1), []);
  return (
    <RegistrarEvento clave={CONTACTO.clave} senalAbrir={senal} esDeCampana={esDeCampana} />
  );
}

/**
 * El `···` abierto, por la MISMA puerta que la vendedora: el botón con su
 * `aria-label`. Un menú abierto por un estado forzado desde afuera fotografiaría
 * un componente que nadie abrió — y el defecto de ADR 0024 es justamente que la
 * regla esté bien y el cableado no.
 */
function ConMenuAbierto({ esDeCampana }: { esDeCampana: boolean }) {
  const [raiz, setRaiz] = useState<HTMLElement | null>(null);
  useEffect(() => {
    raiz?.querySelector<HTMLButtonElement>('[aria-label="Más herramientas"]')?.click();
  }, [raiz]);
  // ⚠️ El panel se ancla `right-0` sobre el botón —así vive arriba del chat, con
  // el `···` pegado al borde derecho de la barra—, así que abre hacia la
  // IZQUIERDA. En una grilla suelta eso lo tira fuera de la captura: la columna
  // reserva el ancho del panel (`w-64`) y empuja el botón a su derecha.
  return (
    <div ref={setRaiz} className="flex w-64 justify-end">
      <MenuHerramientas conversacion={CONTACTO} esDeCampana={esDeCampana} />
    </div>
  );
}

function Caso({ titulo, nota, children }: { titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="max-w-[26rem]">
        <h2 className="font-heading text-sm font-bold text-foreground">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * ⚠️ **La ficha va en su propio caso (`?ficha=1`) y no al lado de las notas.**
 * `FichaRapida` es un drawer `fixed` —así vive en la app— así que se sale de
 * cualquier contenedor y deja un hueco donde debería estar. Encerrarlo para que
 * entre en la grilla sería fotografiar algo que la app no hace.
 */
const soloFicha = params.has('ficha');

/** `?menu=1` — el `···` de los dos módulos, lado a lado (24-ago-2026). */
const soloMenu = params.has('menu');

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {soloMenu ? (
        <div className="flex gap-16 bg-background p-8 pb-64">
          <Caso
            titulo="Menú ··· · campaña"
            nota="Sin «Datos recomendados»: es el playbook de la Escuela (el precio, el material) y /api/hechos contesta 403 acá. Con el ítem, la pantalla dibujaba ese 403 como un catálogo vacío."
          >
            <ConMenuAbierto esDeCampana />
          </Caso>
          <Caso
            titulo="Menú ··· · ventas"
            nota="La otra mitad, intacta: la vendedora sigue teniendo su sección «Inteligencia»."
          >
            <ConMenuAbierto esDeCampana={false} />
          </Caso>
        </div>
      ) : soloFicha ? (
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-[26rem]">
            <h2 className="font-heading text-sm font-bold text-foreground">Registrar contacto · campaña</h2>
            <p className="text-xs text-muted-foreground">
              {roto
                ? '?roto=1 — el ANTES: con /api/contactos entero vedado, apretar el botón contesta «No se guardó — prueba de nuevo». Es lo que reportó el comando de Betto el 22-ago-2026.'
                : 'Guarda de verdad: la ficha rápida es de los dos módulos. Prellena partiendo el alias de WhatsApp en nombre + apellido. Sin «Qué le interesa» — eso es el catálogo de cursos, y acá contesta 403.'}
            </p>
          </div>
          <FichaRapida conversacion={CONTACTO} onCerrar={() => {}} esDeCampana />
        </div>
      ) : (
        <div className="flex gap-16 bg-background p-8">
          <Caso
            titulo="Notas rápidas · campaña"
            nota="Quiere apoyar · Pidió ayuda · Problema de su zona · Se comprometió. Ninguna pide un curso de Cerberus."
          >
            <div className="h-[22rem]">
              <ConNotasAbiertas esDeCampana />
            </div>
          </Caso>
          <Caso
            titulo="Notas rápidas · ventas"
            nota="La otra mitad, intacta: el vocabulario de la Escuela no cambió una letra."
          >
            <div className="h-[22rem]">
              <ConNotasAbiertas esDeCampana={false} />
            </div>
          </Caso>
        </div>
      )}
    </QueryClientProvider>
  </StrictMode>,
);
