import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { PantallaPadron } from './PantallaPadron';
import { FACETAS, NOMBRES, TOTAL_PADRON } from './galeriaDatos';
import {
  CARGA_POR_VENDEDORA,
  filtrarContactosIlustrativos,
  LINEAS_DE_ENTRADA,
  totalIlustrativo,
  YA_ASIGNADOS_DE_BASE,
} from './galeriaFiltrado';

/**
 * LA GALERÍA DEL PADRÓN — la evidencia, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-padron.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-padron.html
 *     …/galeria-padron.html?vendedora=1 → la misma pantalla para quien NO reparte
 *
 * Existe por la regla dura #2 y para poder ver de una las dos cosas que esta
 * pantalla tiene que resolver sin que nadie lea: que **«compró» de verdad se
 * distinga de «icarus dice que compró»**, y que el número del lote esté a la
 * vista antes de repartirlo.
 */

const SOY_VENDEDORA = new URLSearchParams(location.search).has('vendedora');

function contactos() {
  return NOMBRES.map(([nombre, pais, curso, fuente], i) => ({
    id: 1000 + i,
    nombre,
    telefono: `${pais === 'MX' ? '52' : pais === 'GT' ? '502' : '51'}9${String(84429504 + i * 137)}`,
    correo: `${nombre.split(' ')[0].toLowerCase()}${i}@correo.com`,
    pais,
    etapa: i % 4 === 0 ? 'interested' : 'contacted',
    nivel: i % 5 === 0 ? 'vip' : 'prospect',
    gastado: i % 5 === 0 ? '1250.00' : null,
    // El caso que hay que poder distinguir de un vistazo: los tres estados de
    // «compró». `conVenta` es el único afirmable.
    compras: i % 3 === 0 ? 3 : null,
    conVenta: i % 5 === 0,
    // 🔴 El caso que se veía al revés: quien compró por Cerberus tiene producto y
    // NO tiene curso declarado; quien declaró curso muchas veces no compró.
    comprado: i % 5 === 0 ? 'Diploma Internacional de Inteligencia y Contrainteligencia' : null,
    curso: i % 5 === 0 && i % 2 === 0 ? null : curso,
    fuente,
    creadoEn: new Date(Date.UTC(2026, 6, 28 - i, 12)).toISOString(),
  }));
}

/**
 * LO QUE LA HOJA DE LA FICHA LE PREGUNTA A CERBERUS (`?ficha=1`).
 *
 * La fila del padrón dice lo que icarus guardó; la hoja dice lo que Cerberus sabe
 * HOY. Acá se siembra el caso que hace útil abrirla: alguien que la tabla marca
 * «sin respaldo» —icarus dice que compró y no hay venta— y que en Cerberus sí
 * tiene dos folios pagados. Ver esa diferencia es el punto de la hoja.
 */
const FICHA_CERBERUS = {
  estado: 'cliente',
  id: 4821,
  nombre: 'Ana Lucía Quispe Mamani',
  codigo: 'CL-4821',
  dni: '41287654',
  pais: 'Perú',
  correo: 'ana0@correo.com',
  ventasCount: 2,
  ventas: [
    {
      folio: 'F001-2291',
      estado: 'Pagado',
      monto: '750.00',
      moneda: 'PEN',
      fecha: '2026-07-14',
      productos: ['Diplomado en Gestión Pública'],
    },
    {
      folio: 'F001-1877',
      estado: 'Pagado',
      monto: '500.00',
      moneda: 'PEN',
      fecha: '2026-04-02',
      productos: ['Curso de Inteligencia y Contrainteligencia'],
    },
  ],
};

/**
 * CUÁLES YA SE REPARTIERON EN ESTA SESIÓN DE GALERÍA — estado, no una
 * constante.
 *
 * 🔴 **La primera versión servía `TOTAL_PADRON` fijo en toda respuesta**, sin
 * importar qué se repartiera: la captura de «Quedan N» no podía demostrar que
 * el número baja, porque nada en el mock reaccionaba a nada (hermes-4c lo
 * encontró revisando la evidencia, 24-ago-2026 — el mismo tipo de hueco que
 * «Se perdió: 0»). Ahora `/habilitar` y `/habilitar-recorte` marcan ids acá,
 * `/quitar` los saca, y el total que sirve `/api/padron/contactos` con
 * `sinHabilitar=true` puesto los descuenta de verdad.
 */
const repartidosIds = new Set<number>();

/**
 * LA ÚLTIMA TANDA — ilustrativa, con tres formas de forzar el caso que hace
 * falta ver sin tener que repartir primero: `?tanda=vieja` (de hace 30 h, el
 * peso ámbar), `?tanda=omitida` (todo lo movió alguien después, nada para
 * deshacer) o `?tanda=no` (nunca hubo nada). Sin el parámetro, sigue lo que
 * `repartidosIds` ya sabe — repartí 4 con `?lote=1&destino=1` y la tira
 * aparece sola, con los mismos ids que el reparto de verdad marcó.
 */
function ultimaTandaIlustrativa(): {
  hayTanda: boolean;
  cuando?: string;
  total?: number;
  restaurados?: number;
  devueltos?: number;
  omitidosPorCambioPosterior?: number;
} {
  const forzado = new URLSearchParams(location.search).get('tanda');
  if (forzado === 'vieja') {
    return {
      hayTanda: true,
      cuando: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      total: 470,
      restaurados: 130,
      devueltos: 340,
      omitidosPorCambioPosterior: 0,
    };
  }
  if (forzado === 'omitida') {
    return {
      hayTanda: true,
      cuando: new Date(Date.now() - 5 * 60_000).toISOString(),
      total: 4,
      restaurados: 0,
      devueltos: 0,
      omitidosPorCambioPosterior: 4,
    };
  }
  if (forzado === 'no' || repartidosIds.size === 0) return { hayTanda: false };
  return {
    hayTanda: true,
    cuando: new Date(Date.now() - 90_000).toISOString(),
    total: repartidosIds.size,
    restaurados: 0,
    devueltos: repartidosIds.size,
    omitidosPorCambioPosterior: 0,
  };
}

/** Todo endpoint responde de mentira: la galería no toca la red ni una vez. */
window.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
  const cuerpoPedido = init?.body ? JSON.parse(String(init.body)) : {};

  // `?deshacer404=1` fuerza el 404 «nada_que_deshacer» (jamás repartió) — un
  // status real, no un 200 con `status: 404` adentro del cuerpo, porque `api()`
  // decide si tirar `ErrorApi` mirando la respuesta HTTP, no el JSON.
  if (url.includes('/api/padron/deshacer-ultima-tanda') && new URLSearchParams(location.search).has('deshacer404')) {
    return new Response(JSON.stringify({ motivo: 'nada_que_deshacer' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const cuerpo = url.includes('/api/padron/ultima-tanda')
    ? ultimaTandaIlustrativa()
    : url.includes('/api/padron/deshacer-ultima-tanda')
    ? (() => {
        const antes = ultimaTandaIlustrativa();
        // Deshacer «de verdad» devuelve los ids al pozo: la tira siguiente
        // consulta y ya no encuentra nada, sin necesitar un caso aparte.
        if (!new URLSearchParams(location.search).get('tanda')) repartidosIds.clear();
        return {
          ok: true,
          cuando: antes.cuando,
          restaurados: antes.restaurados ?? 0,
          devueltos: antes.devueltos ?? 0,
          omitidosPorCambioPosterior: antes.omitidosPorCambioPosterior ?? 0,
        };
      })()
    : url.includes('/api/padron/habilitar-recorte')
    ? (() => {
        const excluidos: number[] = cuerpoPedido.excluidos ?? [];
        // Ilustrativo: no hay 73.145 filas de verdad acá, así que se marcan
        // como repartidas las visibles de este recorte (menos las excluidas)
        // — alcanza para demostrar que el total baja, que es lo único que
        // esto necesita probar.
        if (cuerpoPedido.filtros?.sinHabilitar) {
          contactos()
            .map((c) => c.id)
            .filter((id) => !excluidos.includes(id))
            .forEach((id) => repartidosIds.add(id));
        }
        return { ok: true, habilitados: TOTAL_PADRON - excluidos.length, vendedoraId: cuerpoPedido.vendedoraId };
      })()
    : url.includes('/api/padron/habilitar')
    ? (() => {
        const ids: number[] = cuerpoPedido.contactoIds ?? [];
        ids.forEach((id) => repartidosIds.add(id));
        return { ok: true, habilitados: ids.length, vendedoraId: cuerpoPedido.vendedoraId };
      })()
    : url.includes('/api/padron/quitar')
    ? (() => {
        const ids: number[] = cuerpoPedido.contactoIds ?? [];
        ids.forEach((id) => repartidosIds.delete(id));
        return { ok: true, quitados: ids.length };
      })()
    : url.includes('/api/contactos/ficha')
    ? FICHA_CERBERUS
    : url.includes('/api/contactos/lead')
    ? {
        lead: {
          nombre: 'Ana Lucía Quispe Mamani',
          fuente: 'meta',
          campana: 'Gestión Pública · julio',
          anuncio: 'Adquiérelo ahora',
          fecha: '2026-07-02T15:12:00.000Z',
        },
      }
    : // Nunca escribió: no hay hilo del que derivar señales ni intereses. Vacío
      // acá es la VERDAD, y por eso la hoja no dibuja nada en esos bloques.
      url.includes('/api/senales')
    ? { senales: {}, umbralDias: 3 }
    : url.includes('/api/gestiones/intereses')
    ? { lista: [], derivados: [] }
    : url.includes('/api/whatsapp/sesion')
    ? { estado: 'conectado', telefono: '51986394450' }
    : url.includes('/api/padron/facetas')
    ? // 🔴 `asignadoA` y `entroPorLinea` son HERMANOS de `facetas`, nunca
      // anidados adentro — el mismo bug que rompió la sección Reparto en
      // producción (ver `RespuestaFacetas` en `padron.ts`). Antes esta
      // galería los anidaba igual que el tipo viejo: los tres en el mismo
      // nivel es la forma real, verificada contra `respuestaDeFacetas`
      // (server) y el curl en vivo de #605.
      {
        facetas: Object.fromEntries(
          Object.entries(FACETAS).map(([d, ops]) => [
            d,
            (ops as [string, number][]).map(([valor, contactos]) => ({ valor, contactos })),
          ]),
        ),
        // Ilustrativo: la faceta de reparto real la sirve `/api/padron/reparto`
        // (destinos reales), pero el conteo POR persona en este recorte es un
        // campo nuevo (24-ago-2026) que la galería todavía no midió — la forma
        // sí es la real: `sinRepartir` viaja aparte de `opciones`.
        asignadoA: {
          opciones: Object.entries(CARGA_POR_VENDEDORA).map(([valor, contactos]) => ({ valor, contactos })),
          sinRepartir: TOTAL_PADRON - YA_ASIGNADOS_DE_BASE,
        },
        entroPorLinea: LINEAS_DE_ENTRADA,
      }
    : url.includes('/api/padron/contar-con-dueno')
    ? // Ilustrativo: nadie midió esta intersección todavía. Sirve para poder
      // FOTOGRAFIAR el aviso, no como evidencia de un número real.
      { total: 4, conDueno: 3, deOtra: 2 }
    : url.includes('/api/padron/reparto')
    ? {
        destinos: [
          'ventas11@grupogoberna.com',
          'ventas12@grupogoberna.com',
          'ventas13@grupogoberna.com',
          'ventas14@grupogoberna.com',
          'luz',
        ],
        carga: [
          { vendedoraId: 'ventas11@grupogoberna.com', contactos: 340 },
          { vendedoraId: 'ventas12@grupogoberna.com', contactos: 338 },
          { vendedoraId: 'ventas13@grupogoberna.com', contactos: 12 },
        ],
      }
    : (() => {
        // Qué filtro simula de verdad este mock (y por qué el resto no hace
        // falta) está declarado en `galeriaFiltrado.ts` — `COBERTURA_DE_FILTROS`,
        // tipado contra `FiltrosPadron`, se pone rojo en tsc si alguien agrega
        // un campo nuevo sin decidir qué hacer con él acá.
        const params = new URL(url, location.origin).searchParams;
        const visibles = filtrarContactosIlustrativos(contactos(), params, repartidosIds);

        return {
          contactos: visibles.slice(0, SOY_VENDEDORA ? 6 : 12),
          total: SOY_VENDEDORA ? 6 : totalIlustrativo(params, repartidosIds),
          supervisor: !SOY_VENDEDORA,
          porPagina: 50,
          paginaActual: 1,
          sinSupervisores: false,
        };
      })();
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * `?lote=1` marca las primeras filas después de montar, para poder capturar la
 * barra de reparto. La selección es estado interno de la pantalla y no se puede
 * sembrar por props — y el estado que hay que MIRAR es justamente ése: el número
 * del lote junto al destino, antes de apretar (regla dura #7).
 */
const PARAMS = new URLSearchParams(location.search);

/**
 * `?ficha=1` abre la hoja de la ficha de la primera fila.
 *
 * Es la evidencia de lo que la tabla NO puede decir: la fila afirma «sin
 * respaldo» (icarus dice 3 compras y no hay venta) y Cerberus, preguntado en
 * vivo por teléfono, devuelve dos folios pagados.
 */
if (PARAMS.has('ficha')) {
  setTimeout(() => {
    document.querySelector<HTMLElement>('tbody tr[role="button"]')?.click();
  }, 400);
}

/** `?filtro=1` abre el desplegable de País, para capturar las facetas con conteo. */
if (PARAMS.has('filtro')) {
  setTimeout(() => {
    const botones = [...document.querySelectorAll('button')];
    botones.find((b) => b.textContent?.trim().startsWith('País'))?.click();
  }, 400);
}

/** `?todo=1` tilda la página entera y salta al recorte completo (17.014). */
if (PARAMS.has('todo')) {
  setTimeout(() => {
    document.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.click();
    setTimeout(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        x.textContent?.includes('de este filtro'),
      );
      b?.click();
      // …y abre el destino, para ver el botón con la cifra grande.
      setTimeout(() => {
        [...document.querySelectorAll('button')]
          .find((x) => x.textContent?.trim() === 'Elegir a quién')
          ?.click();
        // `?confirmar=1` elige destino y dispara el paso de confirmación.
        if (PARAMS.has('confirmar')) {
          setTimeout(() => {
            [...document.querySelectorAll('button')]
              .find((x) => x.textContent?.includes('Ventas13'))
              ?.click();
            setTimeout(() => {
              [...document.querySelectorAll('button')]
                .find((x) => x.textContent?.startsWith('Habilitar'))
                ?.click();
            }, 200);
          }, 200);
        }
      }, 200);
    }, 200);
  }, 400);
}

if (PARAMS.has('lote') || PARAMS.has('destino')) {
  setTimeout(() => {
    document
      .querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')
      .forEach((casilla, i) => {
        if (i < 4) casilla.click();
      });
    // `?destino=1` abre además el desplegable de destino: la carga de cada
    // persona al lado del nombre es lo que evita repartir 3.000 a una y 40 a otra.
    if (PARAMS.has('destino')) {
      setTimeout(() => {
        const botones = [...document.querySelectorAll('button')];
        botones.find((b) => b.textContent?.trim() === 'Elegir a quién')?.click();
      }, 200);
    }
  }, 400);
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <div className="flex h-screen flex-col bg-background">
        <header className="shrink-0 border-b border-border bg-card px-4 py-2.5">
          <h1 className="font-heading text-sm font-bold text-foreground">
            Contactos · Padrón —{' '}
            <span className="font-normal text-muted-foreground">
              {SOY_VENDEDORA ? 'lo que ve una vendedora (solo lo habilitado)' : 'lo que ve el supervisor'}
            </span>
          </h1>
        </header>
        <PantallaPadron onEscribir={() => {}} />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
