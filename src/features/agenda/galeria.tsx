import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { VistaAgenda } from './VistaAgenda';
import { SelectorFechaHora } from './SelectorFechaHora';
import { agruparPorDia } from './fechas';
import type { Recordatorio } from './agenda';
import type { Modo } from './modos';

/**
 * LA GALERÍA DE LA AGENDA — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-agenda.html
 *
 * Existe por la regla dura #2 (nada de UI se reporta listo sin captura). Los
 * cuatro cambios del frente se miran por query param:
 *
 *  - `?vista=mes` (default) — «Hoy» en el CENTRO junto al título, y el resumen
 *    de próximas actividades en la COLUMNA IZQUIERDA, bajo el minicalendario.
 *  - `?vista=gantt` — el Gantt: una fila por promesa y el largo de la barra es
 *    el tiempo que queda (o la deuda, si ya venció).
 *  - `?crear=1` — «Nuevo seguimiento» como MODAL al centro, no como panel en la
 *    esquina de abajo a la derecha.
 *  - `?detalle=1` — el detalle, también modal al centro, **abierto desde el
 *    resumen de la columna**: es la prueba de que cada renglón de «Próximas
 *    actividades» es
 *    otra puerta al mismo detalle y no una segunda pantalla.
 *
 * ⚠️ **Los datos son fixture y se apoyan en el reloj de la máquina** (`hoy` sale
 * de `new Date()`): así la captura muestra siempre vencidas, cosas de hoy y
 * cosas por delante, que es justo lo que el frente decide cómo dibujar. La
 * galería NO sirve el caso ideal a propósito — un ideal ya escondió tres
 * defectos una vez en este repo.
 */

const HOY = new Date();
const dia = (dias: number, hora: number, min = 0) => {
  const d = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + dias, hora, min);
  return d.toISOString();
};

function r(id: number, cuando: string, nota: string, over: Partial<Recordatorio> = {}): Recordatorio {
  return {
    id,
    clave: `conv:whatsapp:5199900${id}:51984429504`,
    canal: 'whatsapp',
    personaId: `5199900${id}0`,
    personaNombre: null,
    numeroPropio: '51984429504',
    nota,
    cuando,
    estado: 'pendiente',
    ...over,
  };
}

/** El fixture: vencidas que gritan, lo de hoy, y lo que viene — con los feos incluidos. */
const RECORDATORIOS: Recordatorio[] = [
  r(1, dia(-6, 9, 0), 'llamada a Rosa — quedó en confirmar', { personaNombre: 'Rosa Quispe', importancia: 'alta' }),
  r(2, dia(-2, 16, 30), 'wsp temario de Gestión Pública', { personaNombre: 'Carlos Medina' }),
  r(3, dia(-1, 11, 0), 'correo con el folio de la cuota 2', { personaNombre: 'Ana Tello', importancia: 'media' }),
  r(4, dia(0, 9, 30), 'llamada a Julio — cierre', { personaNombre: 'Julio Ramos', importancia: 'alta' }),
  r(5, dia(0, 12, 0), 'wsp precio del diploma OSINT', { personaNombre: 'Marisol Ayala' }),
  r(6, dia(0, 18, 0), 'reunión con la coordinadora', { personaNombre: null, personaId: null, canal: 'general', clave: 'general' }),
  r(7, dia(1, 9, 0), 'llamada a Betty — quedó en pagar hoy', { personaNombre: 'Betty Chávez', importancia: 'alta' }),
  r(8, dia(1, 15, 0), 'mandar el link de inscripción', { personaNombre: 'Luis Fernández' }),
  r(9, dia(2, 10, 0), 'wsp seguimiento cuotas', { personaNombre: 'Gladys Roca', importancia: 'baja' }),
  r(10, dia(4, 9, 0), 'llamada a Wilder — se enfrió', { personaNombre: 'Wilder Paz' }),
  r(11, dia(6, 11, 30), 'correo con el certificado', { personaNombre: 'Nadia Soto' }),
  r(12, dia(9, 9, 0), 'reunión de cierre de mes', { personaNombre: null, personaId: null, canal: 'general', clave: 'general' }),
  r(13, dia(13, 16, 0), 'wsp bienvenida al grupo', { personaNombre: 'Erick Vargas', importancia: 'media' }),
  r(14, dia(-3, 10, 0), 'llamada a Sara — ya compró', { personaNombre: 'Sara Loayza', estado: 'hecho' }),
];

/**
 * El server, de mentira. Se stubea `fetch` en vez de sembrar el caché porque la
 * agenda **repregunta sola cada minuto** (`refetchInterval`): con el caché
 * sembrado, el primer refetch fallido pondría la pantalla en error justo
 * mientras se saca la foto.
 */
const original = globalThis.fetch;
globalThis.fetch = ((url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url);
  const responder = (cuerpo: unknown) =>
    Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } }));
  if (u.includes('/api/agenda')) return responder({ recordatorios: RECORDATORIOS });
  if (u.includes('/api/whatsapp/sesion'))
    return responder({ estado: 'conectado', telefono: '51984429504', transporte: 'cloud-api' });
  return original(url, init);
}) as typeof fetch;

const params = new URLSearchParams(location.search);
const vista = (params.get('vista') ?? 'mes') as Modo;
const crear = params.has('crear');

/**
 * El clic que la captura no puede dar. `--screenshot` de Chrome headless no
 * interactúa, así que para fotografiar el detalle la galería toca por su cuenta
 * el renglón del resumen — la MISMA puerta que usa la vendedora, no un atajo
 * que se salte el componente.
 */
if (params.has('detalle')) {
  setTimeout(() => {
    const renglon = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('llamada a Julio — cierre'),
    );
    renglon?.click();
  }, 600);
}

/**
 * `?otroDia=1` — la foto del encabezado cuando la agenda NO está parada en hoy.
 * Es el único encuadre donde se ve si «Hoy» dice la verdad: el botón vive pegado
 * al título, así que con el foco en hoy los dos coinciden y el defecto se
 * esconde. Como `--screenshot` no interactúa, la galería toca la flecha ‹ — la
 * MISMA que toca la vendedora — en vez de arrancar con un foco falseado.
 */
if (params.has('otroDia')) {
  setTimeout(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Período anterior"]')?.click();
  }, 300);
}

/**
 * El tema oscuro ya no es de la Agenda: es de la app, y se estampa en `<html>`
 * (ver `src/lib/tema.ts`). Esta galería monta VistaAgenda SOLA, sin la barra de
 * la app, así que acá no hay botón que tocar — se pone el mismo atributo que
 * pondría el botón, que es exactamente lo que el navegador termina viendo.
 *
 *  - `?oscuro=1` — cualquiera de las vistas, en tema oscuro.
 */
if (params.has('oscuro')) {
  document.documentElement.dataset.theme = 'dark';
}

/**
 * `?selector=1` — EL CALENDARIO DE «OTRA FECHA», que es lo único que esta
 * galería no podía fotografiar: vive dentro del popover de `AgendarRapido`, en
 * el chat, y para llegar ahí hacía falta el server.
 *
 * Sirve el caso REAL y no el ideal: un día con TRES actividades de tipos
 * distintos (el tope de puntos), otro con una sola, y los días de antes de hoy
 * atenuados y sin poder tocarse. Con `?oscuro=1` se ve el defecto heredado de
 * `BARRA_TIPO` que el componente documenta y NO parchea: `seguimiento` y
 * `recordatorio` casi no se distinguen del fondo.
 */
if (params.has('selector')) {
  const hoy = new Date();
  const enDias = (d: number, h: number, tipo: string, id: number) => ({
    id,
    clave: `conv:whatsapp:5199900${id}:51984429504`,
    canal: 'whatsapp',
    personaId: null,
    personaNombre: null,
    numeroPropio: null,
    nota: 'lo que sea',
    cuando: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + d, h, 0).toISOString(),
    tipo,
    estado: 'pendiente',
  }) as unknown as Recordatorio;

  const porDia = agruparPorDia([
    enDias(3, 9, 'llamada', 1),
    enDias(3, 12, 'wsp', 2),
    enDias(3, 17, 'reunion', 3),
    enDias(5, 10, 'seguimiento', 4),
  ]);

  createRoot(document.getElementById('galeria')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen items-start justify-center bg-background p-10">
          {/* `relative`: en la app el panel se ancla al popover de AgendarRapido. */}
          <div className="relative w-80 rounded-xl border border-border bg-card p-3">
            <div className="mb-2 text-[11px] font-semibold text-muted-foreground">Otra fecha</div>
            <SelectorFechaHora valor={null} onSeleccionar={() => {}} porDia={porDia} />
          </div>
        </div>
      </QueryClientProvider>
    </StrictMode>,
  );
  // La galería abre el calendario sola: `--screenshot` no interactúa.
  setTimeout(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Elegir fecha"]')?.click();
  }, 200);
} else {
createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen flex-col bg-background">
        <VistaAgenda
          onAbrir={() => {}}
          modoInicial={vista}
          crearInicial={crear ? { nota: 'llamada a Rosa — confirmar la cuota', telefono: '51999001234' } : null}
        />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
}
