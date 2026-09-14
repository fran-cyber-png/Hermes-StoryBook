import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { VistaPersonas } from '../vistas/VistaPersonas';
import { FACETAS, NOMBRES, SIN_ASIGNAR } from './galeriaDatos';
import { CARGA_POR_VENDEDORA, LINEAS_DE_ENTRADA, totalIlustrativo } from './galeriaFiltrado';
import { comoQuery } from './padron';

/**
 * LA GALERÍA DEL PADRÓN — la evidencia, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-padron.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-padron.html
 *     …?vendedora=1   → la misma pantalla para quien NO reparte
 *     …?tema=oscuro   → el tema del dueño
 *     …?vista=1       → el selector de vista abierto
 *     …?filtros=1     → el panel lateral abierto (`?filtro=1`: y País desplegado)
 *     …?destino=1     → cuatro filas tildadas y el destino desplegado
 *                       (`&elegido=1`: y Ventas12 elegida, el botón armado)
 *
 * Existe por la regla dura #2 y para poder ver de una las dos cosas que esta
 * pantalla tiene que resolver sin que nadie lea: que **«compró» de verdad se
 * distinga de «icarus dice que compró»**, y que el número del lote esté a la
 * vista antes de repartirlo.
 *
 * ⚠️ **Monta `VistaPersonas` entera, con las pestañas, y un hueco del ancho del
 * riel de vistas (76 px).** Hasta el 10-sep-2026 montaba sólo el padrón y sin
 * riel, así que medía 76 px más de ancho que la app y le faltaba una fila de
 * chrome: justo lo que se estaba por rediseñar (contar filas antes de la tabla)
 * no se podía medir acá.
 */

const SOY_VENDEDORA = new URLSearchParams(location.search).has('vendedora');

/** Como el server: una página son 50 filas. */
const POR_PAGINA = 50;

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
 * DE QUIÉN ES CADA FILA — lo que la galería sirve en `asignadoA` (ADR 0102). Tres
 * filas tienen dueña de base, y lo que se reparta en esta sesión toma la dueña
 * que eligió el reparto: sin eso, «Todos» mostraría libre algo recién repartido.
 * Quitar del reparto deja la marca vacía, que le gana también a la de base.
 */
const DUENAS_DE_BASE: Record<number, string> = {
  1001: 'ventas11@grupogoberna.com',
  1005: 'luz',
  1009: 'ventas12@grupogoberna.com',
};
const duenaDeRepartidos = new Map<number, string>();
function duenaIlustrativa(id: number): string | null {
  const enEstaSesion = duenaDeRepartidos.get(id);
  if (enEstaSesion !== undefined) return enEstaSesion || null;
  return DUENAS_DE_BASE[id] ?? null;
}

/**
 * LAS FILAS DE UNA PÁGINA, ARMADAS PARA EL PEDIDO — hasta 50, como el server.
 *
 * 🔴 **Hasta el 10-sep-2026 la galería tenía doce contactos fijos y los
 * filtraba.** Con 73.200 en el total, el pie decía «se ven 1–9» de 1.464
 * páginas, y con Perú «1–5» de 341: algo que la app no puede mostrar nunca, y
 * que la revisión de spec marcó como evidencia inválida (candado #10). Ahora
 * cada fila se ARMA cumpliendo lo que el pedido filtra —el país, la etapa, el
 * curso o la dueña pedidos— y la página trae tantas como el total permite.
 *
 * ⚠️ El texto buscado (`q`) no se simula: no hay una cifra prometida que igualar
 * (ver `COBERTURA_DE_FILTROS`).
 */
const APELLIDOS = [
  'Quispe Mamani', 'Medina Paredes', 'Toledo Vera', 'Chávez Rojas', 'Huamán Soto',
  'Salazar Ríos', 'Vargas Luna', 'Ramírez Cruz', 'Ocampo Díaz', 'Flores Ibarra',
];
const PAISES = ['Perú', 'México', 'Ecuador', 'Bolivia', 'Colombia', 'Guatemala'];
const PREFIJOS: Record<string, string> = {
  Perú: '51',
  México: '52',
  Ecuador: '593',
  Bolivia: '591',
  Colombia: '57',
  Guatemala: '502',
};

function listaDe(pedido: URLSearchParams, clave: string): string[] {
  return pedido.get(clave)?.split(',').filter(Boolean) ?? [];
}

/** Un contacto estable por id que cumple lo que el pedido filtra. */
function contacto(id: number, pedido: URLSearchParams) {
  const i = Math.abs(id - 1000);
  const pedidoO = (clave: string, siNo: string) => {
    const valores = listaDe(pedido, clave);
    return valores.length ? valores[i % valores.length] : siNo;
  };
  const [nombreBase, , cursoBase, fuenteBase] = NOMBRES[i % NOMBRES.length];
  const pila = nombreBase.split(' ').slice(0, 2).join(' ');
  const pais = pedidoO('pais', PAISES[i % PAISES.length]);
  const conVenta = pedido.get('conVenta') === 'true' || i % 5 === 0;
  return {
    id,
    nombre: `${pila} ${APELLIDOS[(i * 7) % APELLIDOS.length]}`,
    telefono: `${PREFIJOS[pais] ?? '51'}9${String(84429504 + i * 137)}`,
    correo: `${pila.split(' ')[0].toLowerCase()}${i}@correo.com`,
    pais,
    etapa: pedidoO('etapa', i % 4 === 0 ? 'interested' : 'contacted'),
    nivel: pedidoO('nivel', i % 5 === 0 ? 'vip' : 'prospect'),
    gastado: conVenta ? '1250.00' : null,
    // El caso que hay que poder distinguir de un vistazo: los tres estados de
    // «compró». `conVenta` es el único afirmable.
    compras: i % 3 === 0 ? 3 : null,
    conVenta,
    // 🔴 El caso que se veía al revés: quien compró por Cerberus tiene producto y
    // NO tiene curso declarado; quien declaró curso muchas veces no compró.
    comprado: conVenta ? 'Diploma Internacional de Inteligencia y Contrainteligencia' : null,
    curso: pedidoO('curso', conVenta && i % 2 === 0 ? '' : cursoBase) || null,
    fuente: pedidoO('fuente', fuenteBase),
    creadoEn: new Date(Date.UTC(2026, 6, 28, 12) - i * 86_400_000).toISOString(),
  };
}

function filasDeLaPagina(pedido: URLSearchParams, total: number) {
  const pagina = Math.max(1, Number(pedido.get('pagina')) || 1);
  const cuantas = Math.max(0, Math.min(POR_PAGINA, total - (pagina - 1) * POR_PAGINA));
  const sinAsignar = pedido.get('sinHabilitar') === 'true';
  const asignadas = listaDe(pedido, 'asignadoA');
  const filas: (ReturnType<typeof contacto> & { asignadoA: string | null })[] = [];
  // «Asignado a X» se numera aparte del pozo: la misma persona no puede figurar
  // libre en una vista y con dueña en otra.
  let id = (asignadas.length ? 5000 : 1000) + (pagina - 1) * POR_PAGINA;
  while (filas.length < cuantas) {
    const duena = asignadas.length ? asignadas[filas.length % asignadas.length] : duenaIlustrativa(id);
    // «Sin asignar» no trae a quien ya tiene dueña, ni la de base ni la repartida acá.
    if (!(sinAsignar && duena !== null)) filas.push({ ...contacto(id, pedido), asignadoA: duena });
    id++;
  }
  const orden = pedido.get('orden');
  if (orden === 'nombre') filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (orden === 'antiguos') filas.reverse();
  if (orden === 'mas_gastaron') filas.sort((a, b) => Number(b.conVenta) - Number(a.conVenta));
  return filas;
}

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
  const pedido = new URL(url, location.origin).searchParams;

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
        if (!new URLSearchParams(location.search).get('tanda')) {
          repartidosIds.clear();
          duenaDeRepartidos.clear();
        }
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
        const recorte = new URLSearchParams(
          comoQuery({ ...(cuerpoPedido.filtros ?? {}), pagina: 1, porPagina: POR_PAGINA }),
        );
        // El acuse dice cuántos habilitó el SERVER sobre el recorte que viajó:
        // se cuenta ANTES de marcar, o el total ya vendría descontado.
        const habilitados = totalIlustrativo(recorte, repartidosIds) - excluidos.length;
        // Ilustrativo: no hay 73.200 filas de verdad acá, así que se marcan como
        // repartidas las de la primera página del recorte (menos las excluidas)
        // — alcanza para demostrar que la lista se achica, que es lo único que
        // esto necesita probar.
        if (cuerpoPedido.filtros?.sinHabilitar) {
          filasDeLaPagina(recorte, POR_PAGINA)
            .map((f) => f.id)
            .filter((id) => !excluidos.includes(id))
            .forEach((id) => {
              repartidosIds.add(id);
              duenaDeRepartidos.set(id, cuerpoPedido.vendedoraId);
            });
        }
        return { ok: true, habilitados, vendedoraId: cuerpoPedido.vendedoraId };
      })()
    : url.includes('/api/padron/habilitar')
    ? (() => {
        const ids: number[] = cuerpoPedido.contactoIds ?? [];
        ids.forEach((id) => {
          repartidosIds.add(id);
          duenaDeRepartidos.set(id, cuerpoPedido.vendedoraId);
        });
        return { ok: true, habilitados: ids.length, vendedoraId: cuerpoPedido.vendedoraId };
      })()
    : url.includes('/api/padron/quitar')
    ? (() => {
        const ids: number[] = cuerpoPedido.contactoIds ?? [];
        ids.forEach((id) => {
          repartidosIds.delete(id);
          duenaDeRepartidos.set(id, '');
        });
        return { ok: true, quitados: ids.length };
      })()
    : // #1033 — el panel lee UNA consulta de perfil, con la misma ficha y el mismo formulario de abajo.
      url.includes('/api/contactos/perfil')
    ? {
        ficha: FICHA_CERBERUS,
        lead: {
          nombre: 'Ana Lucía Quispe Mamani',
          fuente: 'meta',
          campana: 'Gestión Pública · julio',
          anuncio: 'Adquiérelo ahora',
          fecha: '2026-07-02T15:12:00.000Z',
        },
        padron: null,
        errores: [],
      }
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
      // producción (ver `RespuestaFacetas` en `padron.ts`). Los tres en el
      // mismo nivel es la forma real, verificada contra `respuestaDeFacetas`
      // (server) y el curl en vivo de #605.
      (() => {
        const sinAsignar = pedido.get('sinHabilitar') === 'true';
        return {
          facetas: Object.fromEntries(
            Object.entries(FACETAS).map(([d, ops]) => [
              d,
              // Con «sin asignar» puesto, las etapas son las del recorte de HOY
              // (captura del 10-sep): son las que la vista promete.
              ((d === 'etapa' && sinAsignar ? SIN_ASIGNAR.etapa : ops) as [string, number][]).map(
                ([valor, contactos]) => ({ valor, contactos }),
              ),
            ]),
          ),
          asignadoA: {
            // 🔴 **Con `sinHabilitar` puesto, `opciones` llega VACÍO, y es la
            // forma real**: `facetaAsignadoA` cuenta dentro del recorte, y un
            // recorte «sin asignar» no tiene asignados por definición. Hasta el
            // 10-sep-2026 esta galería servía la carga igual, y por eso el
            // atajo «Asignados a ▾» se veía poblado acá mientras en la app no
            // podía listar a nadie.
            opciones: sinAsignar
              ? []
              : Object.entries(CARGA_POR_VENDEDORA).map(([valor, contactos]) => ({ valor, contactos })),
            sinRepartir: SIN_ASIGNAR.total - repartidosIds.size,
          },
          entroPorLinea: LINEAS_DE_ENTRADA,
        };
      })()
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
        // La MISMA carga que la faceta de arriba sin «sin asignar»: son dos
        // lecturas del mismo reparto, y con dos cifras distintas la galería
        // mostraría a Ventas11 con 340 en un lado y 3.383 en el otro.
        carga: Object.entries(CARGA_POR_VENDEDORA).map(([vendedoraId, contactos]) => ({ vendedoraId, contactos })),
      }
    : (() => {
        // Qué filtro simula de verdad este mock (y por qué el resto no hace
        // falta) está declarado en `galeriaFiltrado.ts` — `COBERTURA_DE_FILTROS`,
        // tipado contra `FiltrosPadron`, se pone rojo en tsc si alguien agrega
        // un campo nuevo sin decidir qué hacer con él acá.
        const total = SOY_VENDEDORA ? 6 : totalIlustrativo(pedido, repartidosIds);
        const filas = filasDeLaPagina(pedido, total);
        return {
          // La vendedora no recibe el campo: el server lo manda sólo a quien manda
          // (`conDuenoPorFila`), y la galería tiene que servir la misma forma.
          contactos: SOY_VENDEDORA ? filas.map(({ asignadoA: _duena, ...resto }) => resto) : filas,
          total,
          supervisor: !SOY_VENDEDORA,
          porPagina: POR_PAGINA,
          paginaActual: Math.max(1, Number(pedido.get('pagina')) || 1),
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
 * Los estados de captura se arman con clics después de montar: la selección, el
 * menú abierto y el destino son estado interno de la pantalla y no se pueden
 * sembrar por props — y es justo ese estado el que hay que MIRAR (el número del
 * lote junto al destino antes de apretar, regla dura #7).
 */
const PARAMS = new URLSearchParams(location.search);

/** Un clic en el primer botón que cumpla. */
function clic(cumple: (b: HTMLButtonElement) => boolean) {
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(cumple)?.click();
}

/** `?tema=oscuro` — el dueño usa oscuro, y la captura que motivó el rediseño lo es. */
if (PARAMS.get('tema') === 'oscuro') document.documentElement.dataset.theme = 'dark';
if (PARAMS.get('tema') === 'claro') document.documentElement.dataset.theme = 'light';

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

/** `?vista=1` abre el selector de vista, con sus cifras. */
if (PARAMS.has('vista')) {
  setTimeout(() => clic((b) => b.getAttribute('aria-label')?.startsWith('Vista:') ?? false), 400);
}

/** `?filtros=1` abre el panel lateral; `?filtro=1`, además, el desplegable de País con sus conteos. */
if (PARAMS.has('filtros') || PARAMS.has('filtro')) {
  setTimeout(() => {
    clic((b) => b.textContent?.trim().startsWith('Filtros') ?? false);
    if (PARAMS.has('filtro')) setTimeout(() => clic((b) => b.textContent?.trim().startsWith('País') ?? false), 250);
  }, 400);
}

/** `?todo=1` tilda la página entera y salta al recorte completo. */
if (PARAMS.has('todo')) {
  setTimeout(() => {
    document.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.click();
    setTimeout(() => {
      clic((x) => x.textContent?.includes('de este filtro') ?? false);
      // …y abre el destino, para ver el botón con la cifra grande.
      setTimeout(() => {
        clic((x) => x.getAttribute('aria-label') === 'Elegir a quién repartir');
        // `?confirmar=1` elige destino y dispara el paso de confirmación.
        if (PARAMS.has('confirmar')) {
          setTimeout(() => {
            clic((x) => x.textContent?.includes('Ventas13') ?? false);
            setTimeout(() => clic((x) => x.textContent?.startsWith('Repartir ') ?? false), 200);
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
        clic((b) => b.getAttribute('aria-label') === 'Elegir a quién repartir');
        // `&elegido=1` elige a Ventas12: el botón queda ARMADO, con cifra y nombre.
        if (PARAMS.has('elegido')) setTimeout(() => clic((b) => b.textContent?.includes('Ventas12') ?? false), 200);
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
        <div className="flex min-h-0 flex-1">
          {/* El hueco del riel de vistas de la app: sin él la pantalla mide 76 px
              más de lo que mide en la app, y una fila de controles que entra acá
              puede no entrar allá. */}
          <div aria-hidden="true" className="w-19 shrink-0 border-r border-border bg-card" />
          <div className="flex min-w-0 flex-1 flex-col">
            <VistaPersonas onEscribir={() => {}} />
          </div>
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
