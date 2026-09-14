import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { TituloDeSeccion } from '../../components/TituloDeSeccion';
import { CLAVE_CATALOGO, type HechoDelCatalogo, type RespuestaCatalogo } from '../hechos/catalogo';
import { CATALOGO_MEDIDO_10_SEP } from './catalogoMedido';
import type { Recorte } from './productos';
import { VistaProductos } from './VistaProductos';

/**
 * LA GALERÍA DE PRODUCTOS POR NEGOCIO — la vista REAL con el catálogo de producción.
 *
 * Entry APARTE de Vite (`galeria-productos.html` en la raíz): **no entra al bundle de
 * la app** —`vite build` toma solo `index.html`— y no habla con ningún server: el
 * caché de consultas se siembra antes de montar, así que ni `/api/productos` ni
 * `/api/hechos/catalogo` se piden.
 *
 * 🔴 **Monta `VistaProductos`, no una maqueta.** La galería de Routing montaba `Lienzo`
 * directo, salteándose la vista, y retrató perfecta una feature que en la app estaba
 * muerta (ADR 0082, enmienda). Acá el árbol de componentes es el que corre; lo único
 * que falta es el shell (riel y cabecera real).
 *
 *     npx vite --port 5199 → http://localhost:5199/galeria-productos.html
 *     ?detalle=DIPICOT                          → con la hoja del producto abierta
 *     ?detalle=DIPICOT&sinEnlazar=1             → la hoja como queda HOY en producción
 *     ?negocio=LifeStyle&division=Inteligencia  → regla del cero: Categoría no se dibuja
 *     ?negocio=Editorial&q=contraterrorismo     → el vacío que ofrece el otro negocio
 *     ?sinImagenes=1                            → lo que llega HOY a Hermes: ninguna imagen
 *     ?bajas=1                                  → con lo dado de baja
 *
 * ⚠️ Lo que NO sale de producción tal cual va rotulado acá, porque una galería que
 * inventa es decorado (candado 10 de `CLAUDE.md`): las IMÁGENES y el ENLACE de los
 * precios con su producto.
 */

const PARAMS = new URLSearchParams(location.search);

/**
 * TRES PORTADAS REALES, y a propósito sólo tres. Son el `og:image` de landings de
 * grupogoberna.com (medido el 10-sep-2026), puestas en la edición vigente de la familia
 * cuyo nombre coincide sin ambigüedad con el título de la landing: es como se vería si
 * Cerberus publicara `imagen_producto`. **Hoy ninguna llega a Hermes.** Sirven para ver
 * cómo convive una foto con las portadas sin foto, que es el estado que va a existir
 * durante meses aunque se decida cargarlas.
 */
const IMAGENES_DE_LANDINGS: Record<string, string> = {
  // grupogoberna.com/diploma-tecnico-en-osint-socmint/ — 1200×630
  DIPOSOC005: 'https://grupogoberna.com/wp-content/uploads/2025/04/portada-osint-socmint.jpg',
  // grupogoberna.com/manual-de-inteligencia/ — la tapa del libro, 699×916
  FISINMI002: 'https://grupogoberna.com/wp-content/uploads/2024/07/landing-libro-miyc.png',
};

// Lo que el server le sirve a ventas: sin el negocio «Consultoria» (enmienda a ADR 0106 del
// 12-sep-2026, `server/src/cerberus/negociosDeVentas.ts`). La medición del 10-sep queda entera
// en `catalogoMedido.ts` —es lo que manda Cerberus—; la galería muestra lo que llega a la pantalla.
const QUE_LLEGA = CATALOGO_MEDIDO_10_SEP.filter((p) => p.negocio !== 'Consultoria');

const catalogo = PARAMS.has('sinImagenes')
  ? QUE_LLEGA
  : QUE_LLEGA.map((p) => (IMAGENES_DE_LANDINGS[p.sku] ? { ...p, imagen: IMAGENES_DE_LANDINGS[p.sku] } : p));

/**
 * LOS DATOS POR PAÍS de producción (tabla `hechos`, leída el 10-sep-2026): claves y
 * rótulos reales. Los precios van con su texto real; los de pago van RECORTADOS antes
 * de las cuentas de banco, que no se versionan.
 *
 * ⚠️ En producción ningún dato tiene `familia` todavía (la columna nace con ADR 0106).
 * Por default la galería muestra los cuatro `precio-*` enlazados a DIPICOT —lo que
 * pasa cuando alguien elige el producto en Datos, porque `titulo-que-recibe` dice
 * Inteligencia y Contrainteligencia—; con `?sinEnlazar=1`, como están hoy.
 */
const enlazados = !PARAMS.has('sinEnlazar');
const dato = (clave: string, rotulo: string, texto: string, familia: string | null = null): HechoDelCatalogo => ({
  clave,
  rotulo,
  texto,
  momentos: [],
  orden: 100,
  activo: true,
  familia,
});
const DIPICOT = enlazados ? 'DIPICOT' : null;
const HECHOS: HechoDelCatalogo[] = [
  dato('precio-peru', 'Precio (Perú)', 'En Perú el diploma cuesta S/ 500. Es el precio de promoción: el regular es de $199 USD.', DIPICOT),
  dato('precio-mexico', 'Precio (México)', 'En México el diploma cuesta $2,800 pesos. Es el precio de promoción: el regular es de $199 USD.', DIPICOT),
  dato('precio-bolivia', 'Precio (Bolivia)', 'En Bolivia el diploma cuesta 1,350 Bs. Es el precio de promoción: el regular es de $199 USD.', DIPICOT),
  dato('precio-otros-paises', 'Precio (otros países)', 'El diploma cuesta USD 150. Es el precio de promoción: el regular es de $199 USD.', DIPICOT),
  dato('pago-peru', 'Dónde pagar (Perú)', 'En Perú el pago es por depósito o transferencia a ESCUELA ACADEMICA GOBERNA EIRL. [cuentas recortadas en la galería]'),
  dato('pago-mexico', 'Dónde pagar (México)', 'En México el pago es por depósito o transferencia a GOBERNA LATAM. [cuentas recortadas en la galería] Si prefieres tarjeta de crédito te podemos facilitar un link de pago, o pagar en OXXO.'),
  dato('pago-bolivia', 'Dónde pagar (Bolivia)', 'En Bolivia el pago es por depósito o transferencia a INSTITUTO DE ANALISIS Y ESTRATEGIA BOLIVIA ISENANBOL SRL. [cuentas recortadas en la galería]'),
  dato('pago-ecuador', 'Dónde pagar (Ecuador)', 'Desde Ecuador el pago es por depósito o transferencia a CORPORACIÓN GOBERNA SAS. [cuentas recortadas en la galería]'),
  dato('pago-usa', 'Dónde pagar (EE.UU.)', 'Desde Estados Unidos el pago es a GOBERNA ANALYTICS LLC. [cuentas recortadas en la galería]'),
  dato('pago-panama-guatemala-rd', 'Dónde pagar (PA · GT · RD)', 'Desde Panamá, Guatemala o República Dominicana el pago se hace con tarjeta de débito o crédito por este link. [link recortado en la galería]'),
  dato('pago-otros-paises', 'Dónde pagar (otros)', 'Desde cualquier otro país puedes pagar con tarjeta de débito o crédito por este link. [link recortado en la galería]'),
  dato('pago-link-tarjeta', 'Link de pago con tarjeta', 'También puedes pagar con tarjeta de débito o crédito por este link. [link recortado en la galería]'),
  // Los que conviven en la tabla y NO son por país: tienen que quedar afuera de la hoja.
  dato('yape', 'YAPE', 'El pago lo puede realizar por Yape. [recortado en la galería]'),
  dato('cuotas', 'Cuotas (si las pide)', 'Si necesitas facilidad de pago se puede en 2 cuotas.'),
];

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
qc.setQueryData(['productos', 'catalogo'], { productos: catalogo });
qc.setQueryData<RespuestaCatalogo>(CLAVE_CATALOGO, { hechos: HECHOS, editable: true, origen: 'tabla' });

const recorte: Partial<Recorte> = {
  ...(PARAMS.get('negocio') ? { negocio: PARAMS.get('negocio')! } : {}),
  ...(PARAMS.get('division') ? { division: PARAMS.get('division')! } : {}),
  ...(PARAMS.get('q') ? { q: PARAMS.get('q')! } : {}),
  conBajas: PARAMS.has('bajas'),
};

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        {/* Imita la cabecera del shell —mismo componente de título— porque la
            jerarquía sólo se juzga con ella puesta. */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 pb-3 pt-4">
          <TituloDeSeccion>Productos</TituloDeSeccion>
        </header>
        <VistaProductos inicial={{ recorte, detalle: PARAMS.get('detalle') }} />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
