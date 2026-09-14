import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type {
  GeoJSONSource,
  IControl,
  LngLatBoundsLike,
  Map as TipoMapaLibre,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  PointLike,
  StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ChevronRight, Layers, RefreshCw, Search, X } from 'lucide-react';
import { formatoTelefono } from '../../lib/formato';
import { locacionDe, nombreVisible, normalizar, inicialesDe, type ContactoRegistrado } from './contactosRegistrados';

// `maplibre-gl` no expone estos como named exports ESM reales (el `dist` es un
// módulo AMD, aunque `package.json` diga `"type": "module"`) — esbuild/Vite en
// modo dev no encuentra los named exports y el mapa se cae entero. El import
// default sí trae el objeto completo en cualquiera de los dos modos.
const { Map: MapLibreMap, GeolocateControl, NavigationControl, Popup, ScaleControl } = maplibregl;
type MapLibreMap = TipoMapaLibre;

/**
 * Las cuatro vistas del panel «Mapas» — todas comparten el mismo lienzo y la
 * misma fuente de contactos (`FUENTE_MARCADORES`); lo único que cambia es QUÉ
 * capa los representa:
 *   minimalista/relieve → el pin de siempre (`CAPA_MARCADORES`), con o sin
 *                          terreno 3D (`aplicarVista`).
 *   calor                → `heatmap` (`crearCapaCalor`) — el pin reaparece
 *                          solo a partir de cierto zoom, mismo patrón oficial
 *                          de MapLibre.
 *   clusteres             → círculos agrupados por cercanía (`crearCapasCluster`,
 *                          fuente APARTE con `cluster: true` — un layer
 *                          `heatmap`/símbolo no admite agrupar puntos, hace
 *                          falta que la FUENTE lo sepa).
 */
export type VistaMapaId = 'minimalista' | 'relieve' | 'calor' | 'clusteres';

/**
 * EL LIENZO DEL MAPA DE CONTACTOS (pedido del 2-sep-2026, panel de pantalla
 * completa desde el 4-sep-2026) — un punto por cada contacto con dirección
 * geocodificada (`contacto_territorio.lat/lon`, ADR 0088), sobre un mapa
 * acotado al Perú. El clic en un punto muestra nombre, dirección y celular —
 * nada más se edita ni se guarda desde acá.
 *
 * 🔴 **NO es el panel entero.** El header, el sidebar «Vistas de mapa» y el
 * resto del cascarón de pantalla completa viven en `PanelMapaContactos.tsx`,
 * que es quien monta esto y le pasa `vista` (`VistaMapaId`, arriba). Este
 * componente solo sabe dibujar el mapa mismo — la barra de búsqueda/filtro y
 * el breadcrumb de abajo son del MAPA (drill-down geográfico), no del panel.
 *
 * MapLibre y no Leaflet (que ya usa `ModalDireccion.tsx`) porque así lo pidió
 * el dueño para esta pieza — sin API key, tiles crudos de OpenStreetMap
 * envueltos en un `StyleSpecification` propio (misma fuente que ya usa el
 * mapa de Leaflet, solo que MapLibre no trae un `TileLayer` de más alto nivel).
 *
 * ── La geometría de los niveles administrativos y por qué el resto del Perú
 * queda intacto ──────────────────────────────────────────────────────────
 * `departamentos`/`provincias`/`distritos` salen de un geojson OFICIAL que
 * trajo el dueño (`geometria-peru`, INEI) — 25 departamentos (Lima
 * Metropolitana NO es un departamento aparte acá, a diferencia de un intento
 * anterior con otra fuente; esta es la lectura correcta), 196 provincias, 1891
 * distritos, ligados entre sí por ID numérico (`id_departamento`/`id_provincia`),
 * no por coincidencia de nombre — sin el lío de acentos/mayúsculas que trajeron
 * las dos fuentes públicas que se probaron antes. Los nombres del dataset
 * vienen en MAYÚSCULA SIN TILDES; se los pasa a Título+tildes con una tabla a
 * mano para los 25 departamentos (lista chica, se puede corregir una por una)
 * y con una función de Título genérica para provincias/distritos (1891+196
 * nombres — ahí sí, sin diccionario, algunas tildes quedan sin poner).
 * Cada nivel se simplificó con mapshaper (no a mano con turf) porque preserva
 * la topología COMPARTIDA entre vecinos del mismo nivel — simplificar cada
 * polígono por separado los deja con micro-huecos en el borde común.
 *
 * ── Sector y subsector — dos niveles más, pero SOLO donde existen de verdad ──
 * `sectores`/`subsectores` (`sectores-reales.geojson` +
 * `subsectores-enriquecido.geojson`, el mismo dueño) son la subdivisión que la
 * propia campaña ya trazó a mano — no una división administrativa oficial del
 * país entero. Por eso cubren apenas 15 distritos (la mayoría en Lima): el
 * dataset trae TAMBIÉN un `sectores.geojson` genérico de 39 MB con «un sector
 * de relleno» (el distrito entero, sin subdividir) para cada uno de los 1891
 * distritos, pero ese relleno no aporta ningún detalle nuevo al hacer clic —
 * clickear un distrito sin sector real simplemente se queda en distrito, como
 * siempre. Enlazados por `id_distrito`/`id_sector` contra el MISMO dataset
 * oficial de arriba (mismos ids, mismos nombres resultantes) — nunca por
 * nombre de distrito a secas, porque hay homónimos nacionales reales para 2 de
 * los 15 (hay más de un «Comas» y más de un «San Isidro» en el Perú). El
 * propio dato trae nombres de sector/subsector repetidos como filas separadas
 * dentro de un mismo padre (dos «Desierto» en Nuevo Chimbote, un subsector
 * partido en 14 piezas todas con el mismo nombre) — sin fusionarlas primero,
 * el filtro por nombre de `crearCapasDeNivel` iba a resaltar todas las filas
 * homónimas a la vez en lugar de solo la clickeada; se resuelve con un
 * `mapshaper -dissolve` agrupado por (padre, nombre) antes de enlazar.
 *
 * Lo que no es Perú se oscurece con UN SOLO polígono CON UN AGUJERO con la
 * forma exacta del país (`public/geo/mundo-sin-peru.geo.json`, el país entero
 * DISUELTO con mapshaper —unirlo a mano con `turf.union` se quedó sin memoria
 * dos veces con esta geometría, más detallada que las anteriores— menos un
 * rectángulo, con 2 km de margen antes de la máscara, `turf.mask`,
 * precalculado una vez con un script de un solo uso, no en el navegador de
 * cada vendedora). El país no lleva NINGÚN relleno propio: la sombra
 * sencillamente no lo cubre.
 *
 * 🔴 **EL MARGEN NO ES DECORATIVO — sin él, un detalle costero fino puede
 * quedar del lado equivocado de la sombra** (se vio con La Punta, en Callao,
 * con un dataset anterior mucho menos detallado que este). 2 km de margen
 * sobre la unión, siempre, para que ningún borde fino de NINGÚN departamento
 * dependa de que la simplificación haya sido perfecta ahí.
 *
 * ── Hillshade + Terreno 3D ────────────────────────────────────────────────
 * Antes de esto hubo tres intentos de «relieve por clic» —resaltar un
 * departamento, extruirlo en 3D con un color, extruirlo con una textura
 * recortada del propio canvas— y los tres chocaban con lo mismo: MapLibre no
 * tiene forma de pegarle el raster real a un volumen arbitrario sin costuras.
 * Se abandonó esa vía entera a favor de RELIEVE REAL, siempre visible, no
 * algo que se revela clickeando: una fuente `raster-dem` (Terrarium, AWS Open
 * Data — dato público, sin API key) alimenta dos cosas al mismo tiempo —
 *   1. Un layer `hillshade`: sombreado 2D de la topografía, visible aunque la
 *      cámara mire derecho hacia abajo, como cualquier mapa físico.
 *   2. `terrain` en el propio `StyleSpecification`: desplaza el mapa ENTERO
 *      en 3D según la elevación real. Para verse hace falta inclinar la
 *      cámara, así que el mapa arranca con algo de `pitch` por default (el
 *      control de navegación de arriba a la derecha deja enderezarlo).
 *
 * 🔴 **LOS MARCADORES SON UN LAYER `symbol`, NO UN `Marker` DE DOM — y esto
 * no es un detalle de implementación, es la razón por la que dejaron de
 * verse «flotando».** Un `Marker` es un `<div>` que MapLibre posiciona con
 * `map.project()`, que proyecta SIEMPRE a nivel del mar: no sabe nada de
 * terreno. El primer intento de arreglarlo —aproximar a mano cuánto debía
 * subir cada pin en pantalla según su elevación (`queryTerrainElevation`) y
 * el `pitch` actual, con una fórmula propia (`sin(pitch)`)— no calzaba con la
 * proyección 3D real que usa el motor para el terreno mismo: quedaba
 * consistentemente mal (el reporte textual fue «siento que los marcadores se
 * quedan volando»). La solución correcta —documentada por el propio
 * MapLibre, ejemplo oficial `elevate-symbols-above-the-terrain`— es dejar de
 * pelear con la proyección a mano: un layer `symbol` se renderiza en el MISMO
 * pipeline WebGL que ya dibuja el terreno desplazado, así que hereda la
 * posición 3D correcta gratis, sin ninguna fórmula propia. El ícono (la
 * bandera) se registra una vez como imagen (`mapa.addImage`) y el layer lo
 * referencia por id — el popup se abre a mano en el clic, con
 * `queryRenderedFeatures`, el mismo patrón que ya usa el clic de
 * departamentos.
 */

// A qué zoom centrar la cámara al clickear un marcador — «me acerca e intenta
// centrar» (pedido explícito). `Math.max` contra el zoom actual en el handler
// de clic: si ya estás más cerca que esto (drill-down hasta distrito/sector),
// no aleja la cámara para «volver» a este valor, solo recentra.
const ZOOM_AL_CLICKEAR_MARCADOR = 14;
// Sin esto el terreno 3D no se nota — mirando derecho hacia abajo, un
// desplazamiento de elevación no cambia nada en pantalla.
// ⚠️ Bajado de 45 a esto (pedido: «que las palabras y lugares se noten») — a
// más inclinación, el texto del raster (nombres de ciudad, ya HORNEADOS en la
// imagen, no vectores que MapLibre pueda enderezar) se ve cada vez más de
// costado y más difícil de leer. Sigue habiendo relieve, solo que más plano.
const PITCH_INICIAL = 25;

// Caja que cubre el Perú continental + insular, con margen — el mapa no deja
// panear más allá de esto (pedido explícito: «el mapa será solo de Perú»).
// 🔴 **EL ANCHO IMPORTA, Y NO ES DECORATIVO.** Perú es angosto y alargado
// norte-sur (`PERU_BBOX`, abajo, mide 12.8° de longitud por 18.4° de
// latitud); un contenedor de pantalla completa casi siempre es MÁS ancho que
// alto, así que encuadrar el país entero (efecto/pedido de «90% del
// contenedor», ver `encuadrarPeru`) necesita mostrar bastante más longitud de
// la que el país ocupa, solo para no dejar el alto sin llenar. Medido: a
// 1900×1100 hacen falta ~35° de longitud (`-92.7` a `-57.3`) para que la
// ALTURA llegue al 90%.
//
// 🔴 **UN `maxBounds` FIJO NO PUEDE CUMPLIR LAS DOS COSAS A LA VEZ** — se
// probaron dos y las dos fallaron. Angosto (`[-84,-68]`, el original) CORTA
// el encuadre inicial en pantallas anchas: `maxBounds` fuerza el zoom antes
// de que `fitBounds` termine, y el país sale recortado arriba/abajo en vez
// de ocupar el 90% pedido. Ancho (`[-115,-38]`, el segundo intento, pensado
// para no recortar en NINGUNA pantalla) sí encuadra bien, pero una vez que
// el usuario hace zoom dentro de ese margen puede arrastrar y llegar hasta
// Bahía, Brasil — reportado el 4-sep-2026 con captura.
//
// La solución es calcular `maxBounds` DESPUÉS de que `fitBounds` ya
// encuadró (`calcularLimitesDePaneo`, más abajo) — nunca al revés. Como el
// encuadre ya está adentro por construcción, `setMaxBounds` no tiene nada
// que corregir/recortar, y el margen que se le agrega es chico y a
// propósito ASIMÉTRICO: generoso hacia el oeste (mar, inofensivo) y angosto
// hacia el este (Brasil/Bolivia, que es justo lo que había que frenar).

// El bbox REAL del Perú continental — el que se usa para encuadrar al abrir
// el mapa y al volver a «Perú» desde el breadcrumb, pedido explícito
// (4-sep-2026): «debe poder visualizarse la mayor parte [del país] cuando se
// abran por primera vez», ~90% del contenedor.
const PERU_BBOX: LngLatBoundsLike = [
  [-81.4, -18.4],
  [-68.6, -0.03],
];

/**
 * Encuadra el país ENTERO ocupando ~90% del contenedor — se usa al abrir el
 * mapa (sin animación, es el primer frame) y al volver a «Perú» desde el
 * breadcrumb (animado). El margen (`padding` de `fitBounds`) se calcula del
 * tamaño ACTUAL del contenedor en vez de un número fijo en píxeles: un
 * padding fijo cumpliría el 90% en una ventana y lo rompería en otra más
 * chica o más grande — acá siempre es el 5% del lado más corto, así que el
 * país siempre llena el ~90% sin importar el tamaño de pantalla.
 */
function encuadrarPeru(mapa: MapLibreMap, vista: VistaMapaId, animar: boolean) {
  const contenedor = mapa.getContainer();
  const margen = Math.round(Math.min(contenedor.clientWidth, contenedor.clientHeight) * 0.05);
  const pitch = vista === 'relieve' ? PITCH_INICIAL : 0;
  const duration = animar ? 900 : 0;

  // `cameraForBounds` calcula {center, zoom} SIN mover la cámara — a
  // diferencia de `fitBounds` (usado en el montaje inicial), acá hace falta
  // poder corregir el zoom ANTES de animar: `getBounds()`/`getZoom()` durante
  // una animación en curso devuelven el valor a MITAD de camino, no el
  // destino, así que revisar el ancho recién en el medio del `easeTo` de
  // abajo llegaría tarde (ver `limitarAnchoVisible`, que sí funciona porque
  // se usa después de un encuadre YA terminado, sin animación).
  const candidato = mapa.cameraForBounds(PERU_BBOX, { padding: margen });
  if (!candidato || candidato.zoom == null || candidato.center == null) {
    // No debería pasar con un bbox válido, pero sin cámara candidata no hay
    // nada que corregir — `fitBounds` de toda la vida, mejor que nada.
    mapa.fitBounds(PERU_BBOX, { padding: margen, pitch, duration });
    return;
  }

  // El mismo cálculo que `limitarAnchoVisible`, pero ANALÍTICO en vez de
  // medido con `getBounds()` (que exige haber saltado ahí de verdad): a
  // zoom `z`, un contenedor de `anchoPx` muestra `anchoPx·360/(512·2^z)`
  // grados de longitud — la fórmula de Web Mercator que ya usa MapLibre por
  // dentro, verificada contra los casos medidos con `getBounds()` real.
  const anchoResultante = (contenedor.clientWidth * 360) / (512 * Math.pow(2, candidato.zoom));
  const zoom =
    anchoResultante > ANCHO_MAXIMO_SEGURO
      ? candidato.zoom + Math.log2(anchoResultante / ANCHO_MAXIMO_SEGURO)
      : candidato.zoom;

  mapa.easeTo({ center: candidato.center, zoom, pitch, duration });
}

/**
 * EL LÍMITE DE PANEO — se calcula DESPUÉS de que `mapa` ya está encuadrado
 * (por `bounds`/`fitBoundsOptions` en el constructor, la primera vez), nunca
 * antes: así `setMaxBounds` jamás tiene que corregir la vista actual, que es
 * lo que causaba el recorte del encuadre inicial cuando el límite era fijo y
 * angosto (ver el comentario grande junto a `PERU_BBOX`).
 *
 * El margen que se agrega es intencionalmente chico Y ASIMÉTRICO — la mitad
 * del pedido «que no me pueda alejar del mapa de Perú»: hacia el OESTE
 * (océano Pacífico, nadie se queja de ver de más mar) es más generoso que
 * hacia el ESTE (Brasil/Bolivia, la frontera por la que se reportó llegar
 * hasta Bahía con el límite viejo). Devuelve el rectángulo ya calculado, NO
 * lo aplica — lo aplica quien llama (`setMaxBounds`), separado a propósito
 * para poder probar el cálculo solo.
 */
function calcularLimitesDePaneo(bounds: {
  getWest(): number;
  getEast(): number;
  getSouth(): number;
  getNorth(): number;
}): LngLatBoundsLike {
  const ancho = bounds.getEast() - bounds.getWest();
  const alto = bounds.getNorth() - bounds.getSouth();
  return [
    [bounds.getWest() - ancho * 0.25, bounds.getSouth() - alto * 0.08],
    [bounds.getEast() + ancho * 0.05, bounds.getNorth() + alto * 0.08],
  ];
}

/**
 * EL RECTÁNGULO REAL de `mundo-sin-peru.geo.json` — medido directo del
 * archivo (`node` + recorrer coordenadas, no a ojo). Si ese asset se
 * regenera con otro margen, este número queda desactualizado — es un bbox
 * MEDIDO, no una decisión de diseño que se pueda ajustar libremente acá.
 */
const MASCARA_MUNDO_BBOX = { oeste: -100, sur: -30, este: -50, norte: 10 };

// El ancho de `MASCARA_MUNDO_BBOX` (50°) con un 10% de colchón — el techo
// de cuánta longitud puede llegar a mostrar la vista SIN pitch (ver
// `limitarAnchoVisible`), no solo con pitch. Nombrado aparte del bbox de
// arriba porque este si es una decisión de margen, no una medida del asset.
const ANCHO_MAXIMO_SEGURO = (MASCARA_MUNDO_BBOX.este - MASCARA_MUNDO_BBOX.oeste) * 0.9;

/**
 * 🔴 **HASTA EL PITCH 0 SE SALÍA DE LA MÁSCARA** — descubierto probando la
 * proporción de pantalla de la propia captura del reporte (~1630×530, bien
 * ancha y baja): ahí `encuadrarPeru` (el 90% del contenedor, sin pitch
 * siquiera) ya necesitaba mostrar 74° de longitud para llenar el alto —
 * `pitchMaximoSeguro` de abajo daba «0» porque NINGÚN pitch entraba, ni el
 * de arranque. La máscara (50° de ancho) sencillamente no alcanza para una
 * pantalla tan panorámica.
 *
 * La única salida sin regenerar el asset (`mundo-sin-peru.geo.json`, un
 * archivo precalculado con mapshaper+turf, no algo que se agranda acá) es
 * ACEPTAR menos del 90% de alto en el caso extremo: si el ancho que
 * `fitBounds` acaba de lograr supera el techo seguro, se hace zoom-in lo
 * justo para bajarlo hasta ahí (manteniendo el centro), sacrificando parte
 * del norte/sur del país en vez de mostrar Brasil sin sombra — mucho más
 * barato que lo contrario, y solo se nota en proporciones de pantalla
 * inusuales (la enorme mayoría se queda exactamente igual que antes: 1900×1100
 * ya mostraba 35° de ancho, bien por debajo del techo de 45°).
 */
function limitarAnchoVisible(mapa: MapLibreMap): void {
  const b = mapa.getBounds();
  const anchoActual = b.getEast() - b.getWest();
  if (anchoActual <= ANCHO_MAXIMO_SEGURO) return;
  mapa.setZoom(mapa.getZoom() + Math.log2(anchoActual / ANCHO_MAXIMO_SEGURO));
}

/**
 * EL PITCH MÁXIMO SEGURO PARA ESTE CONTENEDOR — pedido explícito (4-sep-2026,
 * con dos capturas): al inclinar/girar con clic derecho se llegaba a ver
 * terreno SIN la sombra de `mundo-sombra`, porque esa máscara es un
 * rectángulo fijo (`MASCARA_MUNDO_BBOX`) y no el globo entero — un horizonte
 * que se estira más allá del rectángulo revela mapa a plena luz.
 *
 * 🔴 **UN NÚMERO FIJO NO ALCANZA, y ya se probó** — el primer intento fijó
 * `maxPitch` en 36° medido a mano contra dos tamaños de ventana (1500×950 y
 * 1900×1100) y volvió a fallar en una tercera pantalla más ancha y más baja
 * (aspecto ~3:1): a más ancho el `fitBounds` inicial (90% del contenedor, ver
 * `encuadrarPeru`) ya necesita más longitud de por sí, así que el margen que
 * quedaba hasta el borde de la máscara variaba según la pantalla — el mismo
 * problema, otra vez, que ya resolvieron `encuadrarPeru`/`calcularLimitesDePaneo`
 * calculando del tamaño real en vez de un número de memoria.
 *
 * Por eso este SÍ prueba pitches crecientes contra el contenedor real,
 * subiendo de a 5° mientras `getBounds()` siga adentro del rectángulo
 * medido, y devuelve el último que entró — sincrónico y barato
 * (`setPitch`/`getBounds` no piden red ni relayout de tiles), y deja el
 * pitch como estaba al terminar (quien llama decide adónde moverlo).
 */
function pitchMaximoSeguro(mapa: MapLibreMap): number {
  const pitchOriginal = mapa.getPitch();
  let seguro = 0;
  for (let candidato = 5; candidato <= 60; candidato += 5) {
    mapa.setPitch(candidato);
    const b = mapa.getBounds();
    const seSale =
      b.getWest() < MASCARA_MUNDO_BBOX.oeste ||
      b.getSouth() < MASCARA_MUNDO_BBOX.sur ||
      b.getEast() > MASCARA_MUNDO_BBOX.este ||
      b.getNorth() > MASCARA_MUNDO_BBOX.norte;
    if (seSale) break;
    seguro = candidato;
  }
  mapa.setPitch(pitchOriginal);
  return seguro;
}

// El mismo rectángulo, ya sin el Perú — generado una vez con `mapshaper -dissolve`
// (los 25 departamentos disueltos en un solo contorno) + margen + `turf.mask`
// contra el bbox.
const RUTA_MASCARA_MUNDO = `${import.meta.env.BASE_URL}geo/mundo-sin-peru.geo.json`;
// Departamentos/provincias/distritos: dataset oficial (`geometria-peru`, INEI),
// re-procesado una vez con un script propio que enlaza cada nivel con el de
// arriba por ID (`id_departamento`/`id_provincia`), no por nombre — Callao ya
// es un departamento propio en este dataset, así que no hace falta ningún caso
// especial para Lima Metropolitana. Solo se cargan cuando hace falta (clic en
// un departamento/provincia/distrito), nunca de entrada.
const RUTA_DEPARTAMENTOS = `${import.meta.env.BASE_URL}geo/peru-departamentos.geo.json`;
const CLAVE_DEPARTAMENTO = 'NOMBDEP';
const RUTA_PROVINCIAS = `${import.meta.env.BASE_URL}geo/peru-provincias.geo.json`;
const RUTA_DISTRITOS = `${import.meta.env.BASE_URL}geo/peru-distritos.geo.json`;
const CLAVE_PROVINCIA = 'NOMBPROV';
const CLAVE_DISTRITO = 'NOMBDIST';
// Sectores/subsectores: SOLO existen para los distritos donde la campaña ya
// subdividió el territorio a mano (15 distritos, la mayoría en Lima) — el
// resto del país no tiene este nivel y el drill-down se corta en distrito,
// igual que antes. `sectores-reales.geojson`/`subsectores(-enriquecido).geojson`
// (no el `sectores.geojson` genérico de 39 MB, que trae un «sector» de relleno
// —el distrito entero, sin subdividir— para TODO el país: no aporta nada
// nuevo ahí y no vale la pena el peso). Enlazados por `id_distrito`/`id_sector`
// contra el mismo dataset oficial de arriba — incluye un `mapshaper -dissolve`
// propio: el dato trae nombres de sector/subsector repetidos como filas
// separadas (p. ej. dos «Desierto» en Nuevo Chimbote), y sin fusionarlos el
// filtro por nombre de `crearCapasDeNivel` resaltaría los dos a la vez.
const RUTA_SECTORES = `${import.meta.env.BASE_URL}geo/peru-sectores.geo.json`;
const RUTA_SUBSECTORES = `${import.meta.env.BASE_URL}geo/peru-subsectores.geo.json`;
const CLAVE_SECTOR = 'NOMBSECTOR';
const CLAVE_SUBSECTOR = 'NOMBSUBSECTOR';

// El rótulo de cada nivel NO sale del polígono de arriba — sale de un archivo
// «-etiquetas» aparte, un punto por lugar (`turf.pointOnFeature`, precalculado
// una vez). Motivo: un layer `symbol` sobre una fuente con geometría Polygon
// coloca un rótulo POR TILE en el que el polígono tiene presencia, no uno por
// feature — un departamento grande cae en varios tiles a la vez y su nombre
// se repite (se vio en producción, «LIMA» x4, «arreglado» antes con un
// `maxzoom` que solo evitaba verlo, no lo evitaba). Un Point vive en un único
// tile: «cada lugar figura solo en su punto», sin el bug, sea cual sea el zoom.
const RUTA_DEPARTAMENTOS_ETIQUETAS = `${import.meta.env.BASE_URL}geo/peru-departamentos-etiquetas.geo.json`;
const RUTA_PROVINCIAS_ETIQUETAS = `${import.meta.env.BASE_URL}geo/peru-provincias-etiquetas.geo.json`;
const RUTA_DISTRITOS_ETIQUETAS = `${import.meta.env.BASE_URL}geo/peru-distritos-etiquetas.geo.json`;
const RUTA_SECTORES_ETIQUETAS = `${import.meta.env.BASE_URL}geo/peru-sectores-etiquetas.geo.json`;
const RUTA_SUBSECTORES_ETIQUETAS = `${import.meta.env.BASE_URL}geo/peru-subsectores-etiquetas.geo.json`;

const FUENTE_MARCADORES = 'contactos-con-punto';
const CAPA_MARCADORES = 'contactos-con-punto-icono';
const IMAGEN_PIN = 'hermes-pin-bandera';

// Calor: reusa `FUENTE_MARCADORES` tal cual — un layer `heatmap` no necesita
// una fuente propia, a diferencia de clústeres (ver más abajo).
const CAPA_CALOR = 'contactos-calor';

// Clústeres SÍ necesita una fuente aparte: `cluster: true` es una opción de
// la FUENTE (le dice a MapLibre que agrupe puntos cercanos en el propio
// worker), y `FUENTE_MARCADORES` ya está en uso sin esa opción para
// minimalista/relieve/calor — no se puede prender a mitad de camino.
const FUENTE_CLUSTER = 'contactos-cluster';
const CAPA_CLUSTER_CIRCULOS = 'contactos-cluster-circulos';
const CAPA_CLUSTER_CONTEO = 'contactos-cluster-conteo';

// Bandera del Perú: rojo (Pantone 186C) y blanco — nada de dorado ni navy acá,
// es el color que pidió el dueño para el marcador, no el de la marca de Hermes.
const ROJO_PERU = '#D91023';
// Apaga lo que no es EL nivel activo (el resto de los departamentos, o el
// resto de las provincias de un departamento, etc.) — un gris, translúcido
// (se mezcla con el raster de abajo, sin taparlo del todo: es la vuelta
// atrás del intento «sólido» — pedido explícito 4-sep-2026, «me gustaba como
// lucía antes... sin aplicar ningún efecto»). El activo sigue «así de claro»
// (sin overlay propio, se ve con los colores reales del mapa) — esto es
// SOLO para el resto.
const GRIS_OPACO = '#6E6E67';
const OPACIDAD_GRIS_OPACO = 0.62;
// Hover de DATOS (calor/clústeres) — un verde azulado que marca el extremo
// «frío/bajo» de esas dos escalas. Nace pensado para eso; NO se usa para el
// hover de departamento/provincia/distrito (ver `AZUL_HOVER_ZONA`) — ese es
// selección de zona, no dato, y un pedido explícito (4-sep-2026) fue no
// mezclar los dos: «no quiero que usemos el sombreado verde».
const HOVER_TEAL = '#0F766E';
// El azul primario de la interfaz (`--primary` en `index.css`, valor de modo
// claro) — reusado tal cual para calor/clústeres («empleando configuraciones
// que ya hemos tenido», pedido explícito): un layer de MapLibre no puede leer
// variables CSS, así que va literal, pero es el MISMO valor.
const AZUL_PRIMARIO = '#2563EB';
// El hover de departamento/provincia/distrito — antes un gris (`#5B6472` a
// 0.3), pedido explícito (4-sep-2026) de revertir: «no se sombree de gris,
// sino que sea un cambio ligeramente notorio, no que opaque todo». El MISMO
// azul primario que ya usa el resto de la interfaz para «esto es
// interactivo» (botones, tarjetas activas de KPIs) — ni gris (sombreado de
// zona apagada) ni verde (dato de calor/clústeres, ver `HOVER_TEAL`), un
// tercer color a propósito para que un pase de mouse no se confunda con
// ninguno de los otros dos efectos. 0.15 de opacidad — la mitad de lo que
// tenía antes — para que se note el contorno sin teñir el mapa real de
// abajo. Sectores/subsectores NO piden hover propio y siguen con el rojo
// tenue de siempre (`crearCapasDeNivel` los deja en su default).
const AZUL_HOVER_ZONA = AZUL_PRIMARIO;
const OPACIDAD_HOVER_ZONA = 0.15;

const ESTILO_OSM: StyleSpecification = {
  version: 8,
  // Necesario para que un layer `symbol` con `text-field` dibuje algo: sin
  // `glyphs`, MapLibre no tiene de dónde bajar el font (PBF con los glifos) y
  // el texto sencillamente no aparece, sin ningún error en consola. Servidor
  // público del propio proyecto MapLibre — «Noto Sans» es la única familia
  // que expone.
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
    // Terrarium (AWS Open Data «elevation-tiles-prod»): elevación global,
    // público, sin API key — la misma fuente que usan media docena de
    // proyectos open-source de mapas para esto mismo.
    'terreno-dem': {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 15,
      attribution: 'Elevation data AWS Terrain Tiles',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terreno-dem',
      paint: {
        // Tenue a propósito: es un acento sobre el raster de OSM, no un mapa
        // físico aparte — demasiado fuerte tapa las calles y los nombres.
        // ⚠️ Bajado de 0.45 (pedido: «que las palabras y lugares se noten»):
        // la sombra del relieve se comía el contraste de los nombres de
        // ciudad en las zonas montañosas, que es donde más hacen falta.
        'hillshade-exaggeration': 0.22,
        'hillshade-shadow-color': '#4A5568',
        'hillshade-highlight-color': '#FFFFFF',
      },
    },
  ],
  // ⚠️ `terrain` NO va acá — a diferencia de antes, cuando el relieve era la
  // única vista. Ahora es una de dos (ver `VistaMapaId`), así que se prende y
  // apaga en caliente con `mapa.setTerrain(...)` (`aplicarVista`, más abajo)
  // sobre la MISMA instancia de mapa, nunca recreándola: cambiar de vista no
  // puede perder el centro/zoom/drill-down que ya había.
  // Sin esto, el hueco más allá del horizonte —donde no hay tile que dibujar—
  // se ve como un plano azul marino liso y cortado en seco contra el mapa
  // (pedido: «figura de esa forma fea»). El `fog` además difumina lo lejano
  // —países vecinos que se alcanzan a ver al inclinar la cámara— en vez de
  // dejarlos nítidos: no se pueden ocultar del todo sin límite de `maxBounds`
  // en altura (no existe), pero al menos no compiten en foco con el Perú.
  sky: {
    'sky-color': '#B3D9F7',
    'horizon-color': '#DCE9F5',
    'fog-color': '#DCE9F5',
    'fog-ground-blend': 0.65,
  },
};

/**
 * El filtro del mapa — SOLO nombre y celular (pedido explícito), a diferencia
 * de `filtrarContactos` de la tabla, que además busca por campaña, aviso,
 * distrito, etc. Sin acentos/mayúsculas de los dos lados, misma regla que el
 * resto de los buscadores de Contactos.
 */
function coincideBusqueda(c: ContactoRegistrado, busqueda: string): boolean {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  return normalizar([c.nombre, c.apellido, c.telefono].filter(Boolean).join(' ')).includes(q);
}

/** Ray casting sobre un anillo — el mismo algoritmo de siempre para punto-en-polígono. */
function dentroDelAnillo(lon: number, lat: number, anillo: GeoJSON.Position[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    const cruza = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/**
 * ¿El contacto cae dentro de este departamento? Sin `@turf/boolean-point-in-polygon`
 * a propósito — es una función chica y el resto del geojson ya se resolvió sin
 * agregar una librería de geometría al bundle.
 */
function puntoEnPoligono(lon: number, lat: number, geometria: GeoJSON.Geometry): boolean {
  const enPoligono = ([externo, ...huecos]: GeoJSON.Position[][]) =>
    dentroDelAnillo(lon, lat, externo) && !huecos.some((h) => dentroDelAnillo(lon, lat, h));
  if (geometria.type === 'Polygon') return enPoligono(geometria.coordinates);
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.some(enPoligono);
  return false;
}

/** El bbox (lon/lat) de una geometría — min/max sobre todos sus anillos. */
function bboxDeGeometria(geometria: GeoJSON.Geometry): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  const recorrer = (anillo: GeoJSON.Position[]) => {
    for (const [lon, lat] of anillo) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geometria.type === 'Polygon') geometria.coordinates.forEach(recorrer);
  else if (geometria.type === 'MultiPolygon') geometria.coordinates.forEach((p) => p.forEach(recorrer));
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Un cargador con caché de módulo para UN nivel del drill-down — el geojson no
 * cambia entre una apertura del modal y la siguiente, así que se pide UNA vez
 * por sesión de pestaña, no una vez por modal abierto. Si falla (sin red, ruta
 * rota), ese nivel sencillamente no llega a tener datos y el drill-down se
 * corta ahí — el resto del mapa (marcadores, relieve, el nivel de arriba) sigue
 * andando igual.
 */
function crearCargador(ruta: string): (cb: (datos: GeoJSON.FeatureCollection) => void) => void {
  let cache: GeoJSON.FeatureCollection | null = null;
  return (cb) => {
    if (cache) {
      cb(cache);
      return;
    }
    fetch(ruta)
      .then((r) => r.json())
      .then((datos: GeoJSON.FeatureCollection) => {
        cache = datos;
        cb(datos);
      })
      .catch(() => {});
  };
}
const cargarProvincias = crearCargador(RUTA_PROVINCIAS);
const cargarDistritos = crearCargador(RUTA_DISTRITOS);
const cargarSectores = crearCargador(RUTA_SECTORES);
const cargarSubsectores = crearCargador(RUTA_SUBSECTORES);
const cargarProvinciasEtiquetas = crearCargador(RUTA_PROVINCIAS_ETIQUETAS);
const cargarDistritosEtiquetas = crearCargador(RUTA_DISTRITOS_ETIQUETAS);
const cargarSectoresEtiquetas = crearCargador(RUTA_SECTORES_ETIQUETAS);
const cargarSubsectoresEtiquetas = crearCargador(RUTA_SUBSECTORES_ETIQUETAS);

/** Lo que trae el `Promise.all` inicial del efecto 1 — máscara + departamentos + sus etiquetas. */
type MapaGeoJSON = [GeoJSON.Feature, GeoJSON.FeatureCollection, GeoJSON.FeatureCollection];

/** Lo que el tooltip flotante necesita para dibujarse — el mismo por los 3 niveles. */
export interface InfoHover {
  etiqueta: string;
  nombre: string;
  x: number;
  y: number;
}

/**
 * Las capas de UN nivel del drill-down (provincias, distritos, sectores o
 * subsectores — todo menos departamentos, que se arman a mano en el efecto 1
 * porque son el primer nivel, sin nada activo todavía que filtrar) — apagado
 * del resto, borde y hover, más la capa invisible para el clic. El activo NO
 * lleva ninguna capa propia (ver `activarResaltado`): se distingue por
 * contraste contra el apagado del resto, nunca por un relleno o borde propio.
 * Los cuatro niveles comparten exactamente esta receta; solo cambian la
 * fuente y la propiedad que los nombra, así que es una función y no cuatro
 * bloques calcados. `etiqueta`/`onHover` alimentan el tooltip flotante
 * (pedido: «al pasarle el mouse... debe de aparecerme el nombre del lugar»).
 *
 * `nombreActivoRef` es el filtro de ESTE MISMO nivel (p. ej. `provinciaFiltroRef`
 * al crear el de provincias) — sin él, pasar el mouse DENTRO de la provincia ya
 * elegida seguía mostrando el tooltip «Provincia» aunque el de distritos, que
 * cubre exactamente esa misma área, debería mandar ahí (mismo criterio que ya
 * usa el clic para no reelegir el nivel en el que ya estás parado).
 */
/**
 * Un layer nuevo se agrega SIEMPRE arriba de todo lo que ya existe — y como
 * provincias/distritos/sectores/subsectores se crean recién al hacer clic (ya
 * con los marcadores puestos hace rato), su atenuado terminaba pintado ENCIMA
 * de cualquier marcador que cayera en una zona apagada (pedido: «si presiono
 * una zona... el marcador no se oscurecerá»). `moveLayer` sin segundo
 * argumento manda un layer al TOPE de la pila — llamar esto después de crear
 * cualquier capa nueva del drill-down deja los marcadores siempre arriba, sin
 * importar en qué orden se hayan ido creando las cosas.
 */
function asegurarMarcadoresArriba(mapa: MapLibreMap) {
  // Orden importa acá: `moveLayer` sin segundo argumento manda AL TOPE, así
  // que el último de esta lista en existir queda arriba de todo — el pin
  // suelto (minimalista/relieve/calor) va al final para que un popup siga
  // siendo clickeable por encima del heatmap o los círculos, si algún día
  // conviven visualmente.
  for (const capa of [CAPA_CALOR, CAPA_CLUSTER_CIRCULOS, CAPA_CLUSTER_CONTEO, CAPA_MARCADORES]) {
    if (mapa.getLayer(capa)) mapa.moveLayer(capa);
  }
}

/**
 * ¿HAY UN MARCADOR DE CONTACTO JUSTO EN ESTE PUNTO? — el candado que le
 * faltaba al drill-down.
 *
 * Los layers `departamentos-hit`/`provincias-hit`/`distritos-hit`/
 * `sectores-hit`/`subsectores-hit` cubren el polígono ENTERO de su nivel, así
 * que un pin parado adentro de un departamento comparte píxel con la capa de
 * ese departamento. MapLibre no tiene noción de «el layer de arriba gana»:
 * cada `on('click', layerId, ...)` se dispara por su cuenta si encuentra un
 * feature en ese punto, sin que abrir el popup del marcador cancele nada por
 * debajo — a diferencia del DOM, acá no hay `stopPropagation` que valga.
 *
 * 🔴 Por eso tocar un marcador también reencuadraba (`irA` → `fitBounds`) al
 * departamento/provincia/distrito entero: el reporte fue «se acerca e intenta
 * centrar, pero se aleja un poco» — la cámara no erraba el cálculo del punto,
 * es que UN SEGUNDO clic (el del polígono de abajo) se disparaba en paralelo
 * y mandaba la vista a encuadrar un área mucho más grande que el pin.
 *
 * Se pregunta con `queryRenderedFeatures` acotado a las capas «tipo
 * marcador» que existan en este momento — determinístico sin importar en
 * qué orden se hayan registrado los listeners (a diferencia de una bandera
 * puesta por el propio clic del marcador, que dependería de quién se
 * dispara primero). Incluye los círculos/puntos de clústeres: el mismo
 * problema de «dos capas comparten píxel» aplica ahí igual que al pin
 * suelto — `heatmap` NO entra en la lista porque no tiene su propio
 * `on('click', ...)` con el que competir.
 */
function hayMarcadorEn(mapa: MapLibreMap, punto: PointLike): boolean {
  const capas = [CAPA_MARCADORES, CAPA_CLUSTER_CIRCULOS].filter((id) => mapa.getLayer(id) != null);
  return capas.length > 0 && mapa.queryRenderedFeatures(punto, { layers: capas }).length > 0;
}

/**
 * ALTERNA ENTRE «minimalista» Y «relieve» SOBRE LA MISMA instancia de mapa —
 * nunca se recrea al cambiar de vista desde el panel lateral, así se cumple
 * lo pedido: «debe sentirse fluido y mantener la misma estructura de
 * navegación, controles y posición geográfica» — centro, zoom, marcadores y
 * el drill-down activo siguen exactamente donde estaban.
 *
 * `setTerrain(null)` apaga el desplazamiento 3D pero NO borra la fuente
 * `terreno-dem` ni el layer `hillshade` (ambos siguen definidos en
 * `ESTILO_OSM`) — alcanza con ocultar este último por `visibility`, más
 * barato que agregar/quitar el layer entero en cada cambio de vista.
 */
function aplicarVista(mapa: MapLibreMap, vista: VistaMapaId, animar: boolean) {
  const relieve = vista === 'relieve';
  mapa.setTerrain(relieve ? { source: 'terreno-dem', exaggeration: 1.5 } : null);
  if (mapa.getLayer('hillshade')) {
    mapa.setLayoutProperty('hillshade', 'visibility', relieve ? 'visible' : 'none');
  }
  const pitch = relieve ? PITCH_INICIAL : 0;
  if (animar) mapa.easeTo({ pitch, duration: 600 });
  else mapa.setPitch(pitch);

  // QUÉ CAPA REPRESENTA A LOS CONTACTOS — la otra mitad de `aplicarVista`,
  // separada del terreno/pitch de arriba porque es un concepto distinto
  // («cómo se ve el mapa» vs. «cómo se ven los contactos»), pero se decide
  // en el mismo lugar y en el mismo momento (al abrir y al cambiar de vista)
  // para que las dos cosas cambien juntas, nunca a medio camino.
  //
  // El pin (`CAPA_MARCADORES`) se usa en TRES vistas, no una sola: en calor
  // reaparece a partir de cierto zoom (mismo patrón oficial de MapLibre
  // «create a heatmap layer» — el heatmap se atenúa cuando el pin ya se
  // puede leer solo). `verMarcadores`/`verFronteras` (el panel de Capas) es
  // ORTOGONAL a esto — ver los efectos que reaccionan a esos dos estados,
  // que se aplican DESPUÉS y pueden volver a ocultar lo que esto dejó visible.
  if (mapa.getLayer(CAPA_MARCADORES)) {
    mapa.setLayoutProperty(CAPA_MARCADORES, 'visibility', vista === 'clusteres' ? 'none' : 'visible');
    mapa.setPaintProperty(
      CAPA_MARCADORES,
      'icon-opacity',
      vista === 'calor' ? ['interpolate', ['linear'], ['zoom'], 8, 0, 11, 1] : 1,
    );
  }
  if (mapa.getLayer(CAPA_CALOR)) {
    mapa.setLayoutProperty(CAPA_CALOR, 'visibility', vista === 'calor' ? 'visible' : 'none');
  }
  for (const capa of [CAPA_CLUSTER_CIRCULOS, CAPA_CLUSTER_CONTEO]) {
    if (mapa.getLayer(capa)) mapa.setLayoutProperty(capa, 'visibility', vista === 'clusteres' ? 'visible' : 'none');
  }
}

/**
 * LA CAPA DE CALOR — un solo layer `heatmap` sobre `FUENTE_MARCADORES`, la
 * MISMA fuente que ya alimenta el pin (no hace falta una fuente aparte: a
 * diferencia de clústeres, `heatmap` no necesita que la fuente sepa nada
 * especial). Perezosa como el resto del drill-down (`crearCapasDeNivel` y
 * compañía): se crea una sola vez, oculta, y el efecto de vista la muestra u
 * oculta después.
 *
 * La paleta reusa los tres colores que la interfaz YA tenía —pedido
 * explícito, «empleando configuraciones que ya hemos tenido»— en vez de
 * inventar una nueva: `HOVER_TEAL` (frío/bajo), `AZUL_PRIMARIO` (medio),
 * `ROJO_PERU` (caliente/alto) — el mismo recorrido frío→caliente de
 * cualquier mapa de calor, con los tonos de Hermes en vez de los genéricos.
 */
function crearCapaCalor(mapa: MapLibreMap) {
  if (mapa.getLayer(CAPA_CALOR)) return;
  mapa.addLayer(
    {
      id: CAPA_CALOR,
      type: 'heatmap',
      source: FUENTE_MARCADORES,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        // Más intensidad a más zoom: con pocos puntos ya lejos entre sí, la
        // intensidad base los dejaría casi invisibles — así cada uno sigue
        //«pesando» lo mismo visualmente sin importar cuánto te acercaste.
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 3],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(15, 118, 110, 0)',
          0.2, 'rgba(15, 118, 110, 0.55)',
          0.45, 'rgba(37, 99, 235, 0.7)',
          0.7, 'rgba(217, 16, 35, 0.8)',
          1, '#7A0A17',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 9, 22, 14, 36],
        // Se atenúa según sube el zoom — mismo rango donde `aplicarVista`
        // hace reaparecer el pin (`icon-opacity` 8→11): el relevo entre
        // «mancha de calor» y «pines individuales» pasa sin salto.
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 11, 0.35],
      },
    },
    // Antes de los marcadores, nunca arriba — `asegurarMarcadoresArriba` ya
    // decide el orden final; esto solo evita un parpadeo si se crea después
    // de que el pin ya existía.
  );
  asegurarMarcadoresArriba(mapa);
}

/**
 * LAS CAPAS DE CLÚSTERES — a diferencia de calor, necesitan su PROPIA fuente
 * (`FUENTE_CLUSTER`) con `cluster: true`: es la fuente la que agrupa puntos
 * cercanos (en un worker, no en el layer), así que no se puede reusar
 * `FUENTE_MARCADORES` tal cual. Se crea una sola vez, con los datos que haya
 * en ese momento — el efecto que la mantiene sincronizada (junto a
 * `FUENTE_MARCADORES`) le hace `setData` cada vez que cambian los contactos
 * visibles, igual que ya hacía el pin.
 *
 * Dos layers, SIN filtro por `point_count` — pedido explícito (4-sep-2026):
 * «aunque solo haya un marcador, estos también sean clustering». Un punto que
 * la fuente NO agrupó con nadie no trae `point_count` (esa propiedad la
 * agrega la propia fuente SOLO a los clústers reales), así que ambos layers
 * usan `coalesce` para tratarlo como «un grupo de 1»:
 *   círculos — coloreados por tamaño con la MISMA escala fría→caliente que
 *     calor (`HOVER_TEAL`→`AZUL_PRIMARIO`→`ROJO_PERU`, «configuraciones que
 *     ya hemos tenido»); un punto suelto cae en el primer escalón (radio 16,
 *     `HOVER_TEAL`), igual que un grupo de 2 a 9.
 *   el número adentro de cada círculo (`point_count_abbreviated` si es un
 *     grupo real, si no «1»).
 * Ya no hay un tercer layer de pin suelto para clústeres (`CAPA_CLUSTER_PUNTO`,
 * removido): con estos dos alcanza para representar CUALQUIER punto de esta
 * fuente, agrupado o no. El clic sobre un círculo de un solo contacto abre su
 * popup en vez de expandir zoom — ver el handler de clic, más abajo.
 */
function crearCapasCluster(mapa: MapLibreMap, datos: GeoJSON.FeatureCollection) {
  if (mapa.getSource(FUENTE_CLUSTER)) return;
  mapa.addSource(FUENTE_CLUSTER, {
    type: 'geojson',
    data: datos,
    cluster: true,
    clusterMaxZoom: 14,
    // 35px (antes 50, el default de los ejemplos oficiales de MapLibre) —
    // pedido explícito (4-sep-2026): «solo agrupación cuando están muy
    // cerca». Un radio más chico exige que los puntos estén más pegados
    // entre sí en pantalla para contar como un mismo grupo; dos contactos
    // que se ven claramente separados a un zoom dado dejan de agruparse
    // antes que con el default.
    clusterRadius: 35,
  });
  mapa.addLayer({
    id: CAPA_CLUSTER_CIRCULOS,
    type: 'circle',
    source: FUENTE_CLUSTER,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': [
        'step',
        ['coalesce', ['get', 'point_count'], 1],
        HOVER_TEAL,
        10,
        AZUL_PRIMARIO,
        50,
        ROJO_PERU,
      ],
      'circle-radius': ['step', ['coalesce', ['get', 'point_count'], 1], 16, 10, 21, 50, 27],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
    },
  });
  mapa.addLayer({
    id: CAPA_CLUSTER_CONTEO,
    type: 'symbol',
    source: FUENTE_CLUSTER,
    layout: {
      visibility: 'none',
      'text-field': ['to-string', ['coalesce', ['get', 'point_count_abbreviated'], 1]],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: { 'text-color': '#FFFFFF' },
  });
  asegurarMarcadoresArriba(mapa);
}

const SVG_CAPAS =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';

/**
 * EL BOTÓN «CAPAS» DEL MAPA (control propio, pedido explícito junto a zoom,
 * ubicación y escala) — MapLibre no trae uno genérico para alternar la
 * visibilidad de layers, así que es un `IControl` a mano, mismo patrón que
 * cualquier control custom de la librería (una `<div>` con la clase de
 * MapLibre para que el navegador la apile y estilice igual que Navigation/
 * Geolocate). Solo abre/cierra el panelito de React (`capasAbiertas`) — la
 * lista de capas y sus checkboxes viven en el componente, no acá adentro.
 */
class ControlCapas implements IControl {
  private contenedor: HTMLDivElement | null = null;
  private alternar: () => void;
  constructor(alternar: () => void) {
    this.alternar = alternar;
  }
  onAdd(): HTMLElement {
    this.contenedor = document.createElement('div');
    this.contenedor.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.title = 'Capas';
    boton.setAttribute('aria-label', 'Capas');
    boton.style.cssText = 'display:flex;align-items:center;justify-content:center;width:29px;height:29px;';
    boton.innerHTML = SVG_CAPAS;
    boton.addEventListener('click', () => this.alternar());
    this.contenedor.appendChild(boton);
    return this.contenedor;
  }
  onRemove(): void {
    this.contenedor?.parentNode?.removeChild(this.contenedor);
    this.contenedor = null;
  }
}

function crearCapasDeNivel(
  mapa: MapLibreMap,
  fuente: string,
  clave: string,
  etiqueta: string,
  onHover: (info: InfoHover | null) => void,
  nombreActivoRef?: { current: string },
  colorHover: string = ROJO_PERU,
  opacidadHover: number = 0.1,
) {
  if (mapa.getLayer(`${fuente}-borde`)) return;
  mapa.addLayer({
    id: `${fuente}-dim`,
    type: 'fill',
    source: fuente,
    filter: ['==', ['get', clave], ''],
    layout: { visibility: 'none' },
    paint: { 'fill-color': GRIS_OPACO, 'fill-opacity': OPACIDAD_GRIS_OPACO },
  });
  mapa.addLayer({
    id: `${fuente}-borde`,
    type: 'line',
    source: fuente,
    paint: { 'line-color': '#5B3A29', 'line-width': 1.2, 'line-opacity': 0.8 },
  });
  mapa.addLayer({
    id: `${fuente}-hover`,
    type: 'fill',
    source: fuente,
    paint: {
      'fill-color': colorHover,
      'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], opacidadHover, 0],
    },
  });
  mapa.addLayer({ id: `${fuente}-hit`, type: 'fill', source: fuente, paint: { 'fill-opacity': 0 } });
  asegurarMarcadoresArriba(mapa);

  let idConHover: string | number | undefined;
  mapa.on('mouseenter', `${fuente}-hit`, () => {
    mapa.getCanvas().style.cursor = 'pointer';
  });
  mapa.on('mousemove', `${fuente}-hit`, (e) => {
    const feature = e.features?.[0];
    const nombre = feature?.properties?.[clave];
    // El nivel ACTIVO (el que ya está abierto, mostrando el nivel de abajo)
    // no lleva hover propio — pedido explícito (4-sep-2026): «si paso el
    // mouse por encima del departamento, todo el departamento no tiene por
    // qué tener algún efecto... solo la provincia». Esta capa y la del nivel
    // de abajo comparten EXACTAMENTE el mismo polígono en pantalla (la
    // provincia activa cubre la misma área que su departamento): sin este
    // corte, pasar el mouse por cualquier distrito también prendía el hover
    // de TODA la provincia por debajo, tapándola entera en vez de resaltar
    // solo lo que está bajo el cursor.
    if (typeof nombre === 'string' && nombreActivoRef && nombre === nombreActivoRef.current) {
      if (idConHover !== undefined) {
        mapa.setFeatureState({ source: fuente, id: idConHover }, { hover: false });
        idConHover = undefined;
      }
      onHover(null);
      return;
    }
    const id = feature?.id;
    if (id !== idConHover) {
      if (idConHover !== undefined) mapa.setFeatureState({ source: fuente, id: idConHover }, { hover: false });
      idConHover = id;
      if (id !== undefined) mapa.setFeatureState({ source: fuente, id }, { hover: true });
    }
    if (typeof nombre !== 'string') return;
    onHover({ etiqueta, nombre, x: e.point.x, y: e.point.y });
  });
  mapa.on('mouseleave', `${fuente}-hit`, () => {
    mapa.getCanvas().style.cursor = '';
    if (idConHover !== undefined) mapa.setFeatureState({ source: fuente, id: idConHover }, { hover: false });
    idConHover = undefined;
    onHover(null);
  });
}

/**
 * El rótulo persistente de UN nivel (provincia/distrito/sector/subsector) —
 * fuente `${fuente}-etiquetas` (un Point por lugar, no el polígono: mismo
 * motivo que `departamentos-etiquetas`, ver `RUTA_DEPARTAMENTOS_ETIQUETAS`).
 * `paradasOpacidad`/`paradasTamanio` son pares zoom/valor ya en formato
 * `interpolate` — se entrelazan a mano en vez de una firma con 4 números fijos
 * porque los niveles más profundos (sector, subsector) no tienen un hijo que
 * haga zoom más allá, así que su rótulo entra y se queda (2 paradas), mientras
 * que provincia/distrito entran Y salen cuando el nivel de abajo toma la posta
 * (4 paradas) — mismo diseño que ya usa `departamentos-etiquetas`, para que
 * acercar/alejar el zoom se sienta continuo en los 5 niveles por igual.
 */
function crearCapaEtiquetas(
  mapa: MapLibreMap,
  fuente: string,
  clave: string,
  paradasOpacidad: number[],
  paradasTamanio: number[],
) {
  const id = `${fuente}-etiquetas`;
  if (mapa.getLayer(id)) return;
  mapa.addSource(id, { type: 'geojson', data: SIN_FEATURES });
  mapa.addLayer({
    id,
    type: 'symbol',
    source: id,
    layout: {
      'text-field': ['get', clave],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], ...paradasTamanio],
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#3A2317',
      'text-halo-color': '#FFFFFF',
      'text-halo-width': 1.4,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], ...paradasOpacidad],
    },
  });
  asegurarMarcadoresArriba(mapa);
}

/**
 * Prende el apagado del resto para UN nivel, filtrado al nombre activo — el
 * activo no lleva NINGÚN relleno ni borde propio (pedido: «quita el borde
 * rojo»): se distingue solo por contraste contra el resto, que se atenúa.
 */
function activarResaltado(mapa: MapLibreMap, fuente: string, clave: string, nombreActivo: string) {
  if (!mapa.getLayer(`${fuente}-dim`)) return;
  mapa.setFilter(`${fuente}-dim`, ['!=', ['get', clave], nombreActivo]);
  mapa.setLayoutProperty(`${fuente}-dim`, 'visibility', 'visible');
}

/** Apaga el apagado del resto para UN nivel (sin borrar sus datos). */
function desactivarResaltado(mapa: MapLibreMap, fuente: string) {
  if (!mapa.getLayer(`${fuente}-dim`)) return;
  mapa.setLayoutProperty(`${fuente}-dim`, 'visibility', 'none');
}

const SIN_FEATURES: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Vacía la fuente de un nivel Y la de sus etiquetas (sin borrar los layers) —
 * se usa al subir un nivel en el drill-down. La de etiquetas puede no existir
 * todavía (nivel que nunca se llegó a crear) — `getSource` da `undefined`, no
 * un error, así que el segundo `if` sencillamente no hace nada en ese caso.
 */
function vaciarFuente(mapa: MapLibreMap, fuente: string) {
  const source = mapa.getSource(fuente) as GeoJSONSource | undefined;
  if (source) void source.setData(SIN_FEATURES);
  const etiquetas = mapa.getSource(`${fuente}-etiquetas`) as GeoJSONSource | undefined;
  if (etiquetas) void etiquetas.setData(SIN_FEATURES);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

let estiloPopupInyectado = false;
/**
 * El CSS del popup, inyectado UNA vez en `<head>` — no hay dónde más ponerlo:
 * `Popup.setHTML` cuelga el marcado fuera del árbol de React, así que Tailwind
 * nunca lo procesa y las clases de utilidad no existen ahí. Colores en
 * `var(--...)` (los mismos tokens de `index.css`) para que, si el modo oscuro
 * los redefine, el popup seque igual.
 */
function asegurarEstiloPopup() {
  if (estiloPopupInyectado) return;
  estiloPopupInyectado = true;
  const style = document.createElement('style');
  style.textContent = `
    .hermes-popup-contacto .maplibregl-popup-content {
      padding: 0;
      background: transparent;
      box-shadow: none;
      border-radius: 0;
    }
    .hermes-popup-contacto .maplibregl-popup-tip { display: none; }
    .hermes-popup-contacto .maplibregl-popup-close-button {
      color: var(--muted-foreground);
      font-size: 18px;
      line-height: 1;
      padding: 6px 8px;
    }
    .hermes-popup-contacto .maplibregl-popup-close-button:hover {
      color: var(--foreground);
      background: transparent;
    }
    .hermes-tarjeta-contacto {
      min-width: 220px;
      max-width: 260px;
      background: var(--card);
      color: var(--foreground);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 12px 32px -8px rgba(14, 42, 82, 0.35);
      overflow: hidden;
      font-family: inherit;
    }
    .hermes-tarjeta-contacto__cabecera {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 32px 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .hermes-tarjeta-contacto__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      color: var(--primary);
      font-size: 11px;
      font-weight: 700;
    }
    .hermes-tarjeta-contacto__nombre {
      font-size: 13px;
      font-weight: 700;
      color: var(--foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hermes-tarjeta-contacto__cuerpo {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 10px 12px 12px;
    }
    .hermes-tarjeta-contacto__fila {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      font-size: 12px;
      color: var(--foreground);
    }
    .hermes-tarjeta-contacto__fila svg { flex-shrink: 0; margin-top: 1px; color: var(--muted-foreground); }
    .hermes-tarjeta-contacto__etiqueta {
      display: block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted-foreground);
    }
  `;
  document.head.appendChild(style);
}

const SVG_DIRECCION =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
const SVG_TELEFONO =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 9.6a2 2 0 0 1 0 2.8l-.9.9a12 12 0 0 0 4.2 4.2l.9-.9a2 2 0 0 1 2.8 0l1.8 1.8a2 2 0 0 1 0 2.9l-1 1c-.6.6-1.5.9-2.3.7-3.4-.8-6.6-2.6-9.2-5.2S5.1 12.6 4.3 9.2c-.2-.8.1-1.7.7-2.3l1-1a2 2 0 0 1 2.9 0Z"/></svg>';

type DatosPopup = Pick<ContactoRegistrado, 'nombre' | 'apellido' | 'telefono' | 'direccion' | 'distrito' | 'ubicacion'>;

function contenidoPopup(c: DatosPopup): string {
  const direccion = c.direccion ?? locacionDe(c) ?? 'Sin registrar';
  const celular = c.telefono ? formatoTelefono(c.telefono) : 'Sin registrar';
  return (
    '<div class="hermes-tarjeta-contacto">' +
    '<div class="hermes-tarjeta-contacto__cabecera">' +
    `<span class="hermes-tarjeta-contacto__avatar">${escapeHtml(inicialesDe(nombreVisible(c)))}</span>` +
    `<span class="hermes-tarjeta-contacto__nombre">${escapeHtml(nombreVisible(c))}</span>` +
    '</div>' +
    '<div class="hermes-tarjeta-contacto__cuerpo">' +
    '<div class="hermes-tarjeta-contacto__fila">' +
    SVG_DIRECCION +
    `<span><span class="hermes-tarjeta-contacto__etiqueta">Dirección</span>${escapeHtml(direccion)}</span>` +
    '</div>' +
    '<div class="hermes-tarjeta-contacto__fila">' +
    SVG_TELEFONO +
    `<span><span class="hermes-tarjeta-contacto__etiqueta">Celular</span>${escapeHtml(celular)}</span>` +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

// El mismo pin bandera del Perú de siempre (rojo-blanco-rojo), ahora como UNA
// sola imagen compartida — ya no hace falta un `clipPath` por marcador porque
// no hay un `<svg>` de DOM por cada uno, es un solo ícono que el layer reusa.
const SVG_PIN_BANDERA =
  '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="74" viewBox="0 0 28 40">' +
  '<defs><clipPath id="gota"><path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 26 14 26s14-16.2 14-26C28 6.3 21.7 0 14 0z"/></clipPath></defs>' +
  '<g clip-path="url(#gota)">' +
  `<rect x="0" y="0" width="9.4" height="40" fill="${ROJO_PERU}"/>` +
  '<rect x="9.4" y="0" width="9.2" height="40" fill="#FFFFFF"/>' +
  `<rect x="18.6" y="0" width="9.4" height="40" fill="${ROJO_PERU}"/>` +
  '</g>' +
  '<path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 26 14 26s14-16.2 14-26C28 6.3 21.7 0 14 0z" fill="none" stroke="#16213A" stroke-width="1.4"/>' +
  '<circle cx="14" cy="14" r="4.6" fill="#FFFFFF" stroke="#16213A" stroke-width="1"/>' +
  '</svg>';

/** Registra el ícono del pin UNA vez — `cb` corre ya mismo si ya estaba. */
function asegurarImagenPin(mapa: MapLibreMap, cb: () => void) {
  if (mapa.hasImage(IMAGEN_PIN)) {
    cb();
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (!mapa.hasImage(IMAGEN_PIN)) mapa.addImage(IMAGEN_PIN, img, { pixelRatio: 2 });
    cb();
  };
  img.src = `data:image/svg+xml;base64,${btoa(SVG_PIN_BANDERA)}`;
}

function featureCollectionDeContactos(contactos: readonly ContactoRegistrado[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: contactos.map((c) => ({
      type: 'Feature',
      properties: {
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        direccion: c.direccion,
        distrito: c.distrito,
        ubicacion: c.ubicacion,
      },
      geometry: { type: 'Point', coordinates: [c.lon as number, c.lat as number] },
    })),
  };
}

export function MapaContactosLienzo({
  contactos,
  vista,
  onMapaListo,
  onRefrescar,
}: {
  contactos: ContactoRegistrado[];
  vista: VistaMapaId;
  /** Para que `PanelMapaContactos` pueda exportar el lienzo («Exportar vista») sin que este componente sepa nada de esa función. */
  onMapaListo?: (mapa: MapLibreMap) => void;
  /**
   * El botón de refresco junto al buscador (pedido explícito 4-sep-2026):
   * «hasta que no escribí otra letra o nombre, el estado no cambiaba». Vuelve
   * a pedir `contactos` al server — `visibles` (el filtro de nombre/celular)
   * ya es puro y reacciona solo a cada tecla, así que si de verdad hay un
   * atasco no está ACÁ: está en que el dato de arriba (`data?.contactos`,
   * react-query) quedó viejo. Este botón no necesita saber cuál de las dos
   * cosas pasó — refresca la fuente para descartar la primera sin que la
   * persona tenga que ir a buscar el botón de refresco de otra pantalla.
   */
  onRefrescar?: () => void | Promise<unknown>;
}) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MapLibreMap | null>(null);
  // `true` recién después de que el efecto 1 terminó de aplicar la vista
  // INICIAL en su handler de `load` — el efecto que reacciona a cambios de
  // `vista` (más abajo) se queda quieto hasta entonces, para no pisarle la
  // animación al primer render.
  const estiloListoRef = useRef(false);
  const vistaRef = useRef(vista);
  useEffect(() => {
    vistaRef.current = vista;
  }, [vista]);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  // El panelito de «Capas» (control propio del mapa) — dos checkboxes chicos,
  // nada de un sistema de capas genérico: es lo que pidió el diseño («capas»
  // junto a zoom/ubicación/escala), no una reconstrucción del drill-down.
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [verFronteras, setVerFronteras] = useState(true);
  const [verMarcadores, setVerMarcadores] = useState(true);
  // El botón vive en un `IControl` de MapLibre, armado UNA vez dentro del
  // efecto 1 (deps `[]`) — no puede cerrar sobre `setCapasAbiertas` de un
  // render viejo, así que el `onClick` llama a esta ref, que sí se actualiza
  // en cada render.
  const alternarCapasRef = useRef<() => void>(() => {});
  alternarCapasRef.current = () => setCapasAbiertas((v) => !v);
  // El drill-down país → departamento → provincia → distrito → sector →
  // subsector. Elegir un nivel nuevo limpia los de abajo (efecto 4/5, más
  // adelante) — un departamento nuevo no puede convivir con la provincia del
  // departamento ANTERIOR. Sector/subsector solo existen para 15 distritos
  // (los que tienen sectores reales) — en el resto, distrito sigue siendo el
  // último nivel, igual que antes.
  const [departamentoFiltro, setDepartamentoFiltro] = useState('');
  const [provinciaFiltro, setProvinciaFiltro] = useState('');
  const [distritoFiltro, setDistritoFiltro] = useState('');
  const [sectorFiltro, setSectorFiltro] = useState('');
  const [subsectorFiltro, setSubsectorFiltro] = useState('');
  // El tooltip flotante que sigue al mouse — «al pasarle el mouse por un
  // lugar... debe de aparecerme el nombre del lugar». `x`/`y` son
  // `e.point.x/y` de MapLibre: pixeles relativos al CONTENEDOR del mapa, el
  // mismo sistema que el `relative` que envuelve al mapa más abajo en el JSX.
  const [hover, setHover] = useState<InfoHover | null>(null);
  // Los 26 polígonos, para saber en qué departamento cae cada contacto — el
  // mismo geojson que ya se pide para las líneas divisorias y los nombres,
  // guardado acá también porque ESTE cálculo lo necesita el componente, no
  // solo el mapa.
  const [departamentos, setDepartamentos] = useState<GeoJSON.FeatureCollection | null>(null);

  // Refs que reflejan el estado más reciente PARA los closures de adentro del
  // efecto 1 (que se arma una sola vez, con `[]` de dependencias) — sin esto,
  // el clic en el mapa vería siempre el valor de filtro que había al montar.
  const departamentoFiltroRef = useRef(departamentoFiltro);
  const provinciaFiltroRef = useRef(provinciaFiltro);
  const distritoFiltroRef = useRef(distritoFiltro);
  const sectorFiltroRef = useRef(sectorFiltro);
  useEffect(() => {
    departamentoFiltroRef.current = departamentoFiltro;
  }, [departamentoFiltro]);
  useEffect(() => {
    provinciaFiltroRef.current = provinciaFiltro;
  }, [provinciaFiltro]);
  useEffect(() => {
    distritoFiltroRef.current = distritoFiltro;
  }, [distritoFiltro]);
  useEffect(() => {
    sectorFiltroRef.current = sectorFiltro;
  }, [sectorFiltro]);

  // El bbox del departamento/provincia/distrito/sector activos — para poder
  // volver a encuadrar ahí cuando el breadcrumb sube un nivel (no hay otra
  // forma de recuperar «el encuadre de mi padre» sin guardarlo al elegirlo).
  const boundsDepartamentoRef = useRef<GeoJSON.Geometry | null>(null);
  const boundsProvinciaRef = useRef<GeoJSON.Geometry | null>(null);
  const boundsDistritoRef = useRef<GeoJSON.Geometry | null>(null);
  const boundsSectorRef = useRef<GeoJSON.Geometry | null>(null);

  // Las funciones de selección viven DENTRO del efecto 1 (necesitan `mapa` y
  // las fuentes que ese efecto crea) pero las dispara un `click` registrado en
  // ESE MISMO efecto — no hay problema de stale closures ahí. Estas refs son
  // para el caso de reintentar desde afuera si hiciera falta; hoy no se usan
  // fuera del efecto 1, pero evitan declarar la función dos veces si el
  // handler de clic se define antes de que la función exista en el mismo bloque.
  const seleccionarDepartamentoRef = useRef<((nombre: string, geometria: GeoJSON.Geometry) => void) | null>(null);
  const seleccionarProvinciaRef = useRef<((nombre: string, geometria: GeoJSON.Geometry) => void) | null>(null);
  const seleccionarDistritoRef = useRef<((nombre: string, geometria: GeoJSON.Geometry) => void) | null>(null);
  const seleccionarSectorRef = useRef<((nombre: string, geometria: GeoJSON.Geometry) => void) | null>(null);
  // `irANivel` vive en el render (usa `vista`, estado), pero el clic «fuera
  // del mapa» que la dispara se registra UNA sola vez en el efecto 1 — este
  // ref evita el stale closure, igual que `departamentoFiltroRef` de arriba.
  const irANivelRef = useRef<((nivel: 'pais' | 'departamento' | 'provincia' | 'distrito' | 'sector') => void) | null>(
    null,
  );

  // Solo lo que tiene punto: sin lat/lon no hay dónde poner el marcador.
  const conPunto = useMemo(() => contactos.filter((c) => c.lat != null && c.lon != null), [contactos]);

  // Departamento de CADA contacto, por punto-en-polígono — no hay una columna
  // «departamento» en `ContactoRegistrado` (lo que hay es `distrito`/`ubicacion`,
  // texto libre de otro origen), así que se deriva contra la misma geometría
  // que el mapa ya dibuja, para que el filtro y lo que se ve coincidan siempre.
  const departamentoPorClave = useMemo(() => {
    const mapa = new Map<string, string>();
    if (!departamentos) return mapa;
    for (const c of conPunto) {
      const feature = departamentos.features.find((f) =>
        puntoEnPoligono(c.lon as number, c.lat as number, f.geometry),
      );
      const nombre = feature?.properties?.[CLAVE_DEPARTAMENTO];
      if (typeof nombre === 'string') mapa.set(c.clave, nombre);
    }
    return mapa;
  }, [departamentos, conPunto]);

  const departamentosDisponibles = useMemo(
    () => [...new Set(departamentoPorClave.values())].sort((a, b) => a.localeCompare(b, 'es')),
    [departamentoPorClave],
  );

  const visibles = useMemo(
    () =>
      conPunto.filter(
        (c) =>
          coincideBusqueda(c, busqueda) &&
          (!departamentoFiltro || departamentoPorClave.get(c.clave) === departamentoFiltro),
      ),
    [conPunto, busqueda, departamentoFiltro, departamentoPorClave],
  );

  // Efecto 1: el mapa se arma UNA sola vez al montar — recrearlo en cada
  // tecla de la búsqueda recargaría las tiles del raster y del terreno de
  // nuevo por nada. Los marcadores viven en el efecto de abajo.
  useEffect(() => {
    if (!contenedorRef.current) return;
    asegurarEstiloPopup();

    // El país entero ocupando ~90% del contenedor DESDE EL PRIMER FRAME —
    // pedido explícito («debe poder visualizarse la mayor parte cuando se
    // abran por primera vez»). `bounds` + `fitBoundsOptions` (en vez de
    // `center`/`zoom` fijos) porque el zoom que hace falta para llenar el
    // 90% DEPENDE del tamaño real del contenedor, que acá ya se conoce
    // (`contenedorRef.current` ya está montado).
    const margenInicial = Math.round(
      Math.min(contenedorRef.current.clientWidth, contenedorRef.current.clientHeight) * 0.05,
    );

    const mapa = new MapLibreMap({
      container: contenedorRef.current,
      style: ESTILO_OSM,
      bounds: PERU_BBOX,
      fitBoundsOptions: { padding: margenInicial },
      // El pitch de arranque lo decide `aplicarVista` en el handler de
      // `load`, según la vista con la que se abrió el panel — acá siempre 0
      // para no mostrar un frame inclinado antes de que esa decisión corra.
      pitch: 0,
      // `maxBounds` NO va acá — si fuera un valor fijo, `fitBounds` de arriba
      // se recortaría contra él antes de terminar de encuadrar (ver el
      // comentario grande junto a `PERU_BBOX`). Se calcula y se aplica unas
      // líneas más abajo, DESPUÉS del encuadre, con `calcularLimitesDePaneo`.
      // `minZoom` NO va acá fijo — lo fija `setMinZoom` unas líneas más abajo,
      // igual al zoom que `bounds`/`fitBoundsOptions` ya calculó para ESTE
      // contenedor. Pedido explícito (4-sep-2026): «que el zoom no se pueda
      // alejar más [...] que es la posición que me dejaste al abrir cada
      // mapa» — el encuadre inicial (el 90% de arriba) pasa a ser también el
      // límite de cuánto se puede alejar, así que un número fijo (`4`, como
      // antes) serviría en una pantalla y dejaría alejarse de más —o de
      // menos— en otra, exactamente el mismo problema que ya resolvió
      // `encuadrarPeru` para el encuadre.
      // `maxPitch` NO va fijo acá — mismo motivo que `maxBounds`/`minZoom`
      // arriba: cuánto se puede inclinar antes de que el horizonte se
      // estire más allá del rectángulo de `mundo-sombra` (`MASCARA_MUNDO_BBOX`)
      // DEPENDE del contenedor (a más ancho, el `fitBounds` del 90% ya
      // necesita más longitud de por sí, y queda menos margen hasta el
      // borde de la máscara). Se calcula unas líneas más abajo con
      // `pitchMaximoSeguro`, probando contra ESTE contenedor — no un número
      // fijo que funcionaba en dos pantallas y falló en la tercera, más
      // ancha y más baja (reportado el 4-sep-2026, dos capturas).
      // Sin esto, «Exportar vista» (`PanelMapaContactos`) puede leer un
      // lienzo ya limpiado por el navegador — WebGL no promete conservar el
      // buffer de dibujo entre frames salvo que se lo pida explícitamente.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    // Primero achicar el ancho si hace falta (pantallas muy panorámicas,
    // ver `limitarAnchoVisible`) — TODO lo que sigue (límite de paneo, zoom
    // mínimo, pitch máximo) se calcula sobre la vista YA corregida, nunca al
    // revés.
    limitarAnchoVisible(mapa);
    // `getBounds()`/`getZoom()` ya reflejan el encuadre (corregido arriba)
    // acá mismo (corre síncrono al construir, no espera a `load`) — recién
    // ACÁ, con la vista ya encuadrada, se calcula y aplica el límite de
    // paneo. `setMaxBounds` no tiene nada que corregir porque el encuadre ya
    // está adentro del rectángulo que se le pasa (`calcularLimitesDePaneo` lo
    // arma agregando margen alrededor de la vista actual, nunca al revés).
    mapa.setMaxBounds(calcularLimitesDePaneo(mapa.getBounds()));
    // El `bounds` de arriba ya dejó a `mapa` en el zoom exacto que llena el
    // 90% del contenedor — ESE es el piso: de acá no se puede alejar más.
    mapa.setMinZoom(mapa.getZoom());
    // Un escalón (5°) por debajo del máximo medido — de colchón para cuando
    // el usuario ya paneó hasta el borde del límite de paneo (arriba) ANTES
    // de inclinar: desde ahí el horizonte llega un poco más lejos hacia ese
    // lado que desde el centro, que es donde `pitchMaximoSeguro` midió.
    mapa.setMaxPitch(Math.max(0, pitchMaximoSeguro(mapa) - 5));

    // 🔴 EL ARRASTRE, NO SOLO EL ZOOM — pedido explícito (4-sep-2026): al
    // zoom mínimo (la posición de apertura, con el país entero ya a la
    // vista) arrastrar el mouse no debe deslizar el mapa. Sigue haciendo
    // falta AUNQUE `maxBounds` ya sea chico (`calcularLimitesDePaneo`, más
    // arriba): a esa vista no hay nada útil que panear —ya se ve el país
    // entero— y antes de este candado alcanzaba a arrastrarse hasta el borde
    // del límite de paneo, aunque fuera angosto. Acá es apagar
    // `dragPan` exactamente mientras el zoom esté en el mínimo, y prenderlo
    // solo cuando el usuario ya hizo zoom +. `zoom` (no `zoomend`) para que
    // reaccione en cuanto el zoom cruza el umbral, incluso a mitad de un
    // gesto de scroll — el pequeño margen (`+ 0.01`) es por el redondeo de
    // punto flotante que el propio `fitBounds`/zoom-por-scroll dejan.
    const actualizarArrastre = () => {
      if (mapa.getZoom() > mapa.getMinZoom() + 0.01) mapa.dragPan.enable();
      else mapa.dragPan.disable();
    };
    actualizarArrastre();
    mapa.on('zoom', actualizarArrastre);

    // 🔴 SIN ROTACIÓN — el click derecho (`DragRotateHandler`) mueve DOS ejes
    // a la vez: arrastre horizontal = `bearing` (girar), vertical = `pitch`
    // (inclinar). El segundo es el efecto de relieve que sí se quiere; el
    // primero es lo que de verdad reventaba la máscara de `mundo-sombra`
    // (medido: pitch 45° solo ya se pasaba un poco del rectángulo, pero
    // pitch 45° CON bearing girado se pasaba por 22°, media Sudamérica a
    // plena luz). MapLibre no separa los dos ejes en un solo handler, así
    // que en vez de apagar el clic derecho ENTERO (perdiendo el tilt),
    // se lo deja girar y se lo devuelve a 0 en cada evento — el resultado
    // visible es «nunca gira», sin tocar el pitch que la misma gestualidad
    // sigue moviendo en paralelo.
    mapa.on('rotate', () => {
      if (mapa.getBearing() !== 0) mapa.setBearing(0);
    });

    mapa.addControl(new NavigationControl(), 'top-right');
    // Ubicación — mismo corner, apilado debajo del de zoom (pedido: «zoom
    // +/-, centrar ubicación, capas y escala» juntos en el mapa).
    mapa.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
    mapa.addControl(new ControlCapas(() => alternarCapasRef.current()), 'top-right');
    mapa.addControl(new ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
    mapaRef.current = mapa;
    onMapaListo?.(mapa);

    let cancelado = false;
    mapa.on('load', () => {
      // La vista con la que se abrió el panel — sin animación, es el estado
      // de arranque, no un cambio que el usuario tenga que VER ocurrir.
      aplicarVista(mapa, vistaRef.current, false);
      estiloListoRef.current = true;
      // Se piden DESPUÉS de `load` — agregar una fuente antes de que el
      // estilo esté listo la descarta en silencio.
      Promise.all([
        fetch(RUTA_MASCARA_MUNDO).then((r) => r.json()),
        fetch(RUTA_DEPARTAMENTOS).then((r) => r.json()),
        fetch(RUTA_DEPARTAMENTOS_ETIQUETAS).then((r) => r.json()),
      ])
        .then(([mascaraMundo, departamentosCargados, etiquetasDepartamentos]: MapaGeoJSON) => {
          if (cancelado) return;
          setDepartamentos(departamentosCargados);
          mapa.addSource('mundo-sin-peru', { type: 'geojson', data: mascaraMundo });
          mapa.addSource('departamentos', { type: 'geojson', data: departamentosCargados, promoteId: CLAVE_DEPARTAMENTO });
          mapa.addSource('departamentos-etiquetas', { type: 'geojson', data: etiquetasDepartamentos });

          // 1. Oscurece SOLO lo que no es Perú — el polígono ya viene con un
          // agujero con la forma del país, así que el Perú no recibe ningún
          // relleno propio y conserva el color (y ahora el relieve) que ya
          // tenía.
          mapa.addLayer({
            id: 'mundo-sombra',
            type: 'fill',
            source: 'mundo-sin-peru',
            paint: { 'fill-color': '#0E2A52', 'fill-opacity': 0.55 },
          });
          // 2. Las líneas divisorias — arriba de la sombra, bien marcadas
          // (pedido: «que se noten mucho más»), no la línea apenas visible de
          // un mapa físico común.
          mapa.addLayer({
            id: 'departamentos-borde',
            type: 'line',
            source: 'departamentos',
            paint: { 'line-color': '#5B3A29', 'line-width': 1.6, 'line-opacity': 0.85 },
          });
          // 3. Los nombres — arriba de todo, en mayúscula y con halo blanco
          // para que se lean igual sobre el verde de la selva que sobre el
          // sombreado oscuro de la cordillera. Fuente `departamentos-etiquetas`
          // (un Point por departamento, no el polígono) — ver el comentario
          // junto a `RUTA_DEPARTAMENTOS_ETIQUETAS`: así «cada lugar figura
          // solo en su punto», sin el bug de repetirse por tile.
          //
          // El desvanecido (`text-opacity`/`text-size` como `interpolate`, no
          // un corte seco) es lo que hace que acercar/alejar el zoom se sienta
          // continuo — pedido: «como Google Maps» primero, «mejora el zoom y
          // la navegación» después. Se apaga entre zoom 8 y 10, el mismo rango
          // en que el de provincias se prende — el relevo entre los dos
          // niveles pasa sin salto ni hueco en el medio.
          mapa.addLayer({
            id: 'departamentos-etiquetas',
            type: 'symbol',
            source: 'departamentos-etiquetas',
            maxzoom: 10.5,
            layout: {
              'text-field': ['get', CLAVE_DEPARTAMENTO],
              'text-font': ['Noto Sans Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 16],
              'text-transform': 'uppercase',
              'text-letter-spacing': 0.05,
              'text-max-width': 8,
            },
            paint: {
              'text-color': '#3A2317',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.6,
              'text-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 8.5, 1, 10, 0],
            },
          });

          // 4. El resaltado del departamento ACTIVO (clic en el mapa o
          // elegido en el selector de arriba) — SIN relleno ni borde propio
          // (pedido: «quita el sombreado rojo»... y después «quita el borde
          // rojo»): el activo se ve con los colores reales del mapa, relieve y
          // calles incluidos, y lo que marca cuál es el elegido es el
          // CONTRASTE contra el resto, que se apaga con `GRIS_OPACO`. Arranca
          // oculto — sin filtro no hay nada que atenuar — y los efectos de más
          // abajo (reaccionan a
          // `departamentoFiltro`/`provinciaFiltro`/`distritoFiltro`) lo
          // actualizan cuando cambia el selector o un clic en el mapa.
          mapa.addLayer({
            id: 'departamentos-dim',
            type: 'fill',
            source: 'departamentos',
            filter: ['==', ['get', CLAVE_DEPARTAMENTO], ''],
            layout: { visibility: 'none' },
            paint: { 'fill-color': GRIS_OPACO, 'fill-opacity': OPACIDAD_GRIS_OPACO },
          });
          // Hover — mismo
          // mecanismo de `feature-state` que ya usa `crearCapasDeNivel` para
          // provincias/distritos, armado a mano acá porque departamentos no
          // pasa por esa función (es el primer nivel, se arma en este mismo
          // efecto).
          mapa.addLayer({
            id: 'departamentos-hover',
            type: 'fill',
            source: 'departamentos',
            paint: {
              'fill-color': AZUL_HOVER_ZONA,
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], OPACIDAD_HOVER_ZONA, 0],
            },
          });
          // Capa invisible SOLO para poder preguntarle a `queryRenderedFeatures`
          // qué departamento tocaron — `fill-opacity: 0` no pinta nada.
          mapa.addLayer({
            id: 'departamentos-hit',
            type: 'fill',
            source: 'departamentos',
            paint: { 'fill-opacity': 0 },
          });
          asegurarMarcadoresArriba(mapa);
          let idDepartamentoConHover: string | number | undefined;
          mapa.on('mouseenter', 'departamentos-hit', () => {
            mapa.getCanvas().style.cursor = 'pointer';
          });
          mapa.on('mousemove', 'departamentos-hit', (e) => {
            const feature = e.features?.[0];
            const nombre = feature?.properties?.[CLAVE_DEPARTAMENTO];
            // Ya estamos adentro de este departamento: la capa de provincias
            // cubre exactamente la misma área y es la que tiene que mandar el
            // tooltip Y el resaltado, no esta — pedido explícito (4-sep-2026):
            // «todo el departamento no tiene por qué tener algún efecto...
            // solo la provincia». Sin este corte, mover el mouse sobre
            // CUALQUIER provincia también prendía el hover de TODO el
            // departamento por debajo (comparten el mismo polígono), tapando
            // el departamento entero en vez de resaltar solo la provincia.
            if (typeof nombre === 'string' && nombre === departamentoFiltroRef.current) {
              if (idDepartamentoConHover !== undefined) {
                mapa.setFeatureState({ source: 'departamentos', id: idDepartamentoConHover }, { hover: false });
                idDepartamentoConHover = undefined;
              }
              setHover(null);
              return;
            }
            const id = feature?.id;
            if (id !== idDepartamentoConHover) {
              if (idDepartamentoConHover !== undefined) {
                mapa.setFeatureState({ source: 'departamentos', id: idDepartamentoConHover }, { hover: false });
              }
              idDepartamentoConHover = id;
              if (id !== undefined) mapa.setFeatureState({ source: 'departamentos', id }, { hover: true });
            }
            if (typeof nombre !== 'string') return;
            setHover({ etiqueta: 'Departamento', nombre, x: e.point.x, y: e.point.y });
          });
          mapa.on('mouseleave', 'departamentos-hit', () => {
            mapa.getCanvas().style.cursor = '';
            if (idDepartamentoConHover !== undefined) {
              mapa.setFeatureState({ source: 'departamentos', id: idDepartamentoConHover }, { hover: false });
            }
            idDepartamentoConHover = undefined;
            setHover(null);
          });
          mapa.on('click', 'departamentos-hit', (e) => {
            if (hayMarcadorEn(mapa, e.point)) return;
            const feature = e.features?.[0];
            const clave = feature?.properties?.[CLAVE_DEPARTAMENTO];
            if (typeof clave !== 'string' || !feature) return;
            // Ya estamos adentro de este departamento: el clic es para elegir
            // una PROVINCIA, no para reelegir el mismo departamento — que
            // decida la capa de provincias, que está encima.
            if (clave === departamentoFiltroRef.current) return;
            seleccionarDepartamentoRef.current?.(clave, feature.geometry);
          });

          // Clic FUERA de cualquier polígono seleccionable (mar, países
          // vecinos tapados por `mundo-sombra`, cualquier hueco) — pedido
          // explícito: «al hacerle click fuera del mapa el mapa del Perú
          // muestre su color original sin sombreadas, sin nada». No es un
          // layer con su propio `on('click', id, ...)` (esos solo se
          // disparan si SÍ hay feature debajo); este es un handler genérico
          // del mapa que se pregunta, con `queryRenderedFeatures`, si el
          // punto cayó en alguna de las capas «-hit» que existan en este
          // momento — si no cayó en ninguna, es un clic afuera de verdad.
          // El guard de `departamentoFiltroRef` evita reencuadrar a Perú de
          // nuevo si ya se estaba ahí (nada seleccionado, nada que limpiar).
          mapa.on('click', (e) => {
            if (!departamentoFiltroRef.current) return;
            const capasHit = [
              'subsectores-hit',
              'sectores-hit',
              'distritos-hit',
              'provincias-hit',
              'departamentos-hit',
            ].filter((id) => mapa.getLayer(id) != null);
            if (mapa.queryRenderedFeatures(e.point, { layers: capasHit }).length > 0) return;
            irANivelRef.current?.('pais');
          });

          // ── Provincias: se crean recién cuando hace falta ─────────────────
          function crearCapasProvinciasSiHaceFalta() {
            if (mapa.getLayer('provincias-borde')) return;
            if (!mapa.getSource('provincias')) {
              mapa.addSource('provincias', { type: 'geojson', data: SIN_FEATURES, promoteId: 'NOMBPROV' });
            }
            crearCapasDeNivel(
              mapa,
              'provincias',
              CLAVE_PROVINCIA,
              'Provincia',
              setHover,
              provinciaFiltroRef,
              AZUL_HOVER_ZONA,
              OPACIDAD_HOVER_ZONA,
            );
            // Entra 8→9.5, se queda, sale 12→13.5 — toma la posta de
            // departamento (que sale 8.5→10) y se la deja a distrito (que
            // entra 10.5→12).
            crearCapaEtiquetas(mapa, 'provincias', CLAVE_PROVINCIA, [8, 0, 9.5, 1, 12, 1, 13.5, 0], [8, 11, 13.5, 15]);
            mapa.on('click', 'provincias-hit', (e) => {
              if (hayMarcadorEn(mapa, e.point)) return;
              const feature = e.features?.[0];
              const clave = feature?.properties?.[CLAVE_PROVINCIA];
              if (typeof clave !== 'string' || !feature) return;
              if (clave === provinciaFiltroRef.current) return;
              seleccionarProvinciaRef.current?.(clave, feature.geometry);
            });
          }

          // ── Distritos: igual, recién cuando hace falta ────────────────────
          // Ya no es el último nivel siempre: 15 distritos (los que tienen
          // sectores reales) siguen bajando a sector/subsector, el resto se
          // corta acá como antes — pero eso lo decide `sectores`, filtrado por
          // distrito, no esta capa. Por eso el guard es un `return` sin más
          // (como el de departamentos/provincias arriba), no el toggle de
          // antes: un distrito con sectores necesita que la capa de encima
          // (`sectores-hit`) reciba el clic sin que éste lo deseleccione.
          function crearCapasDistritosSiHaceFalta() {
            if (mapa.getLayer('distritos-borde')) return;
            if (!mapa.getSource('distritos')) {
              mapa.addSource('distritos', { type: 'geojson', data: SIN_FEATURES, promoteId: 'NOMBDIST' });
            }
            crearCapasDeNivel(
              mapa,
              'distritos',
              CLAVE_DISTRITO,
              'Distrito',
              setHover,
              distritoFiltroRef,
              AZUL_HOVER_ZONA,
              OPACIDAD_HOVER_ZONA,
            );
            // Entra 10.5→12, se queda, sale 14→15.5 — releva a provincia y se
            // la deja a sector.
            crearCapaEtiquetas(mapa, 'distritos', CLAVE_DISTRITO, [10.5, 0, 12, 1, 14, 1, 15.5, 0], [10.5, 10, 15.5, 14]);
            mapa.on('click', 'distritos-hit', (e) => {
              if (hayMarcadorEn(mapa, e.point)) return;
              const feature = e.features?.[0];
              const clave = feature?.properties?.[CLAVE_DISTRITO];
              if (typeof clave !== 'string' || !feature) return;
              if (clave === distritoFiltroRef.current) return;
              seleccionarDistritoRef.current?.(clave, feature.geometry);
            });
          }

          // ── Sectores: solo los 15 distritos que los tienen de verdad ──────
          function crearCapasSectoresSiHaceFalta() {
            if (mapa.getLayer('sectores-borde')) return;
            if (!mapa.getSource('sectores')) {
              mapa.addSource('sectores', { type: 'geojson', data: SIN_FEATURES, promoteId: 'NOMBSECTOR' });
            }
            crearCapasDeNivel(mapa, 'sectores', CLAVE_SECTOR, 'Sector', setHover, sectorFiltroRef);
            // Entra 13→14.5 y se queda — subsector no hace zoom más allá del
            // propio sector, así que conviven a la misma escala, sin salida.
            crearCapaEtiquetas(mapa, 'sectores', CLAVE_SECTOR, [13, 0, 14.5, 1], [13, 10, 16, 13]);
            mapa.on('click', 'sectores-hit', (e) => {
              if (hayMarcadorEn(mapa, e.point)) return;
              const feature = e.features?.[0];
              const clave = feature?.properties?.[CLAVE_SECTOR];
              if (typeof clave !== 'string' || !feature) return;
              if (clave === sectorFiltroRef.current) return;
              seleccionarSectorRef.current?.(clave, feature.geometry);
            });
          }

          // ── Subsectores: el último nivel de verdad — el mismo clic dos
          // veces deselecciona, igual que el distrito de antes.
          function crearCapasSubsectoresSiHaceFalta() {
            if (mapa.getLayer('subsectores-borde')) return;
            if (!mapa.getSource('subsectores')) {
              mapa.addSource('subsectores', { type: 'geojson', data: SIN_FEATURES, promoteId: 'NOMBSUBSECTOR' });
            }
            crearCapasDeNivel(mapa, 'subsectores', CLAVE_SUBSECTOR, 'Subsector', setHover);
            // Entra 14.5→16 y se queda — el último nivel, nada más abajo.
            crearCapaEtiquetas(mapa, 'subsectores', CLAVE_SUBSECTOR, [14.5, 0, 16, 1], [14.5, 9, 18, 12]);
            mapa.on('click', 'subsectores-hit', (e) => {
              if (hayMarcadorEn(mapa, e.point)) return;
              const clave = e.features?.[0]?.properties?.[CLAVE_SUBSECTOR];
              if (typeof clave !== 'string') return;
              setSubsectorFiltro((actual) => (actual === clave ? '' : clave));
            });
          }

          /** Centra + acerca la cámara al bbox de una geometría — «se centra… además de acercarse». */
          function irA(geometria: GeoJSON.Geometry, maxZoom: number) {
            const [minLon, minLat, maxLon, maxLat] = bboxDeGeometria(geometria);
            mapa.fitBounds(
              [
                [minLon, minLat],
                [maxLon, maxLat],
              ],
              { padding: 60, duration: 900, maxZoom },
            );
          }

          seleccionarDepartamentoRef.current = (nombre, geometria) => {
            // Un tooltip que quedó flotando de un hover anterior no se borra
            // solo al elegir un nivel por el `<select>` o el breadcrumb —
            // ambos caminos no pasan mouse por encima de nada, así que sin
            // esto se veía el rótulo de un lugar que ya no correspondía.
            setHover(null);
            setProvinciaFiltro('');
            setDistritoFiltro('');
            setSectorFiltro('');
            setSubsectorFiltro('');
            setDepartamentoFiltro(nombre);
            boundsDepartamentoRef.current = geometria;
            irA(geometria, 9);
            crearCapasProvinciasSiHaceFalta();
            cargarProvincias((todas) => {
              const deEsteDepto: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter((f) => f.properties?.[CLAVE_DEPARTAMENTO] === nombre),
              };
              const fuente = mapa.getSource('provincias') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteDepto);
            });
            cargarProvinciasEtiquetas((todas) => {
              const deEsteDepto: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter((f) => f.properties?.[CLAVE_DEPARTAMENTO] === nombre),
              };
              const fuente = mapa.getSource('provincias-etiquetas') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteDepto);
            });
            vaciarFuente(mapa, 'distritos');
            vaciarFuente(mapa, 'sectores');
            vaciarFuente(mapa, 'subsectores');
          };

          seleccionarProvinciaRef.current = (nombre, geometria) => {
            setHover(null);
            setDistritoFiltro('');
            setSectorFiltro('');
            setSubsectorFiltro('');
            setProvinciaFiltro(nombre);
            boundsProvinciaRef.current = geometria;
            irA(geometria, 11);
            crearCapasDistritosSiHaceFalta();
            cargarDistritos((todas) => {
              const deEstaProvincia: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter((f) => f.properties?.[CLAVE_PROVINCIA] === nombre),
              };
              const fuente = mapa.getSource('distritos') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEstaProvincia);
            });
            cargarDistritosEtiquetas((todas) => {
              const deEstaProvincia: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter((f) => f.properties?.[CLAVE_PROVINCIA] === nombre),
              };
              const fuente = mapa.getSource('distritos-etiquetas') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEstaProvincia);
            });
            vaciarFuente(mapa, 'sectores');
            vaciarFuente(mapa, 'subsectores');
          };

          // Un distrito con sectores reales se comporta como provincia (centra
          // + acerca + carga el nivel de abajo); uno sin sectores queda igual
          // que antes: el filtro se pone, no hay nada más abajo que cargar, y
          // el `setData([])` de `sectores` no dibuja nada (no hace falta un
          // camino aparte para «este distrito no tiene sector»).
          seleccionarDistritoRef.current = (nombre, geometria) => {
            setHover(null);
            setSectorFiltro('');
            setSubsectorFiltro('');
            setDistritoFiltro(nombre);
            boundsDistritoRef.current = geometria;
            irA(geometria, 13);
            crearCapasSectoresSiHaceFalta();
            cargarSectores((todas) => {
              const deEsteDistrito: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter(
                  (f) => f.properties?.[CLAVE_DISTRITO] === nombre && f.properties?.[CLAVE_PROVINCIA] === provinciaFiltroRef.current,
                ),
              };
              const fuente = mapa.getSource('sectores') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteDistrito);
            });
            cargarSectoresEtiquetas((todas) => {
              const deEsteDistrito: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter(
                  (f) => f.properties?.[CLAVE_DISTRITO] === nombre && f.properties?.[CLAVE_PROVINCIA] === provinciaFiltroRef.current,
                ),
              };
              const fuente = mapa.getSource('sectores-etiquetas') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteDistrito);
            });
            vaciarFuente(mapa, 'subsectores');
          };

          seleccionarSectorRef.current = (nombre, geometria) => {
            setHover(null);
            setSubsectorFiltro('');
            setSectorFiltro(nombre);
            boundsSectorRef.current = geometria;
            irA(geometria, 15);
            crearCapasSubsectoresSiHaceFalta();
            cargarSubsectores((todas) => {
              const deEsteSector: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter(
                  (f) => f.properties?.[CLAVE_SECTOR] === nombre && f.properties?.[CLAVE_DISTRITO] === distritoFiltroRef.current,
                ),
              };
              const fuente = mapa.getSource('subsectores') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteSector);
            });
            cargarSubsectoresEtiquetas((todas) => {
              const deEsteSector: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: todas.features.filter(
                  (f) => f.properties?.[CLAVE_SECTOR] === nombre && f.properties?.[CLAVE_DISTRITO] === distritoFiltroRef.current,
                ),
              };
              const fuente = mapa.getSource('subsectores-etiquetas') as GeoJSONSource | undefined;
              if (fuente) void fuente.setData(deEsteSector);
            });
          };
        })
        .catch(() => {
          // Sin el geojson el mapa sigue sirviendo para lo esencial (los
          // marcadores y el relieve): se pierde el apagado de los países
          // vecinos y el rótulo de los departamentos, no el mapa entero.
        });
    });

    return () => {
      cancelado = true;
      mapaRef.current = null;
      mapa.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto 1b: el cambio de vista DESPUÉS del arranque — el panel lateral
  // (`PanelMapaContactos`) cambia `vista` y acá se traduce a `aplicarVista`
  // sobre la misma instancia, animado. `estiloListoRef` evita correr esto
  // antes de que el handler de `load` del efecto 1 haya aplicado la vista
  // inicial (si `vista` llegara a cambiar en ese instante, cosa que hoy no
  // pasa porque el panel la fija recién al montar este componente).
  //
  // 🔴 **Y REENCUADRA A PERÚ COMPLETO, a diferencia del resto de esta función**
  // (pedido explícito, 4-sep-2026: «debe posicionarse el mapa en su posición
  // original, para comenzar a ver de nuevo el mapa completo»). El resto de
  // `aplicarVista` (el otro lugar donde se llama, en la sincronización de
  // capas) preserva centro/zoom a propósito; esto es distinto: elegir «Mapa
  // de calor» estando con zoom en un distrito dejaba el heatmap encajonado en
  // esa misma área, mostrando una sola mancha en vez del panorama completo
  // que ese modo necesita para leerse. `encuadrarPeru` ya es la misma función
  // que usa el breadcrumb «Perú» (`irANivel('pais')`), así que reencuadrar es
  // literal, no una aproximación nueva.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !estiloListoRef.current) return;
    aplicarVista(mapa, vista, true);
    encuadrarPeru(mapa, vista, true);
  }, [vista]);

  // Efecto 1c/1d: el panelito de «Capas» — fronteras (borde + rótulo de
  // departamentos, el único nivel siempre presente) y marcadores. Toca solo
  // esos layers, nunca `departamentos-dim`/`-hover` (el resaltado del
  // departamento activo, otro mecanismo, ver `activarResaltado`): mezclar
  // los dos haría que un toggle le gane la visibilidad al otro en silencio.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    for (const id of ['departamentos-borde', 'departamentos-etiquetas']) {
      if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', verFronteras ? 'visible' : 'none');
    }
  }, [verFronteras]);
  // 🔴 Depende de `vista` A PROPÓSITO, no solo de `verMarcadores` — el
  // checkbox «Marcadores de contactos» tiene que apagar la representación
  // que esté activa EN ESE MOMENTO (pin, calor o clústeres), no solo el pin
  // suelto: sin esto, destildarlo en clústeres no ocultaba nada (el pin ya
  // estaba oculto por `aplicarVista`) y volver a tildarlo en esa misma vista
  // reencendía el pin VIEJO por encima de los círculos. Declarado DESPUÉS del
  // efecto que llama a `aplicarVista` (arriba): React corre los efectos de un
  // mismo componente en orden de declaración, así que esto siempre corrige
  // la visibilidad que `aplicarVista` acaba de fijar, nunca al revés.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (mapa.getLayer(CAPA_MARCADORES)) {
      mapa.setLayoutProperty(CAPA_MARCADORES, 'visibility', verMarcadores && vista !== 'clusteres' ? 'visible' : 'none');
    }
    if (mapa.getLayer(CAPA_CALOR)) {
      mapa.setLayoutProperty(CAPA_CALOR, 'visibility', verMarcadores && vista === 'calor' ? 'visible' : 'none');
    }
    for (const capa of [CAPA_CLUSTER_CIRCULOS, CAPA_CLUSTER_CONTEO]) {
      if (mapa.getLayer(capa)) {
        mapa.setLayoutProperty(capa, 'visibility', verMarcadores && vista === 'clusteres' ? 'visible' : 'none');
      }
    }
  }, [verMarcadores, vista]);

  // Efecto 2: sincroniza el resaltado del departamento activo con
  // `departamentoFiltro` — cambia tanto por clic en el mapa (efecto 1, más
  // arriba) como por el selector de la barra de búsqueda. Al deseleccionar
  // (breadcrumb «Perú») también vacía provincias/distritos: sin departamento
  // no hay contexto para ninguno de los dos. No hace falta reintentar si el
  // layer todavía no existe: `departamentoFiltro` solo puede dejar de estar
  // vacío por esas dos vías, y las dos dependen de que el geojson de
  // departamentos ya haya cargado — el mismo momento en que el layer ya existe.
  //
  // 🔴 **EL GUARD BUSCABA `-resaltado`, Y EL LAYER SE LLAMA `-dim`** — bug
  // encontrado el 4-sep-2026 al pedir «lo que se opaca en gris», no navío:
  // el efecto se cortaba SIEMPRE en el `if` de arriba, así que
  // `activarResaltado`/`desactivarResaltado` nunca corrían y el apagado del
  // resto jamás se aplicaba, en NINGÚN nivel (los cinco efectos de este
  // bloque tenían el mismo desface de nombre). Cambiar el color del `-dim`
  // no iba a notarse nunca mientras el layer se quedara con
  // `visibility: 'none'` para siempre.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.getLayer('departamentos-dim')) return;
    if (departamentoFiltro) {
      activarResaltado(mapa, 'departamentos', CLAVE_DEPARTAMENTO, departamentoFiltro);
    } else {
      desactivarResaltado(mapa, 'departamentos');
      vaciarFuente(mapa, 'provincias');
      vaciarFuente(mapa, 'distritos');
      vaciarFuente(mapa, 'sectores');
      vaciarFuente(mapa, 'subsectores');
    }
  }, [departamentoFiltro]);

  // Efecto 2b: igual, un nivel más abajo — la provincia activa DENTRO del
  // departamento elegido. Al deseleccionar (breadcrumb al departamento) vacía
  // distritos/sectores/subsectores, por la misma razón de arriba.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.getLayer('provincias-dim')) return;
    if (provinciaFiltro) {
      activarResaltado(mapa, 'provincias', CLAVE_PROVINCIA, provinciaFiltro);
    } else {
      desactivarResaltado(mapa, 'provincias');
      vaciarFuente(mapa, 'distritos');
      vaciarFuente(mapa, 'sectores');
      vaciarFuente(mapa, 'subsectores');
    }
  }, [provinciaFiltro]);

  // Efecto 2c: el distrito activo. Ya no es siempre el último nivel — un
  // distrito con sectores reales deja sectores/subsectores cargados debajo, y
  // hay que vaciarlos igual que arriba al deseleccionar.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.getLayer('distritos-dim')) return;
    if (distritoFiltro) {
      activarResaltado(mapa, 'distritos', CLAVE_DISTRITO, distritoFiltro);
    } else {
      desactivarResaltado(mapa, 'distritos');
      vaciarFuente(mapa, 'sectores');
      vaciarFuente(mapa, 'subsectores');
    }
  }, [distritoFiltro]);

  // Efecto 2d: el sector activo (solo existe donde hay sectores reales).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.getLayer('sectores-dim')) return;
    if (sectorFiltro) {
      activarResaltado(mapa, 'sectores', CLAVE_SECTOR, sectorFiltro);
    } else {
      desactivarResaltado(mapa, 'sectores');
      vaciarFuente(mapa, 'subsectores');
    }
  }, [sectorFiltro]);

  // Efecto 2e: el subsector activo — el último nivel de verdad, nada que
  // vaciar debajo.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.getLayer('subsectores-dim')) return;
    if (subsectorFiltro) activarResaltado(mapa, 'subsectores', CLAVE_SUBSECTOR, subsectorFiltro);
    else desactivarResaltado(mapa, 'subsectores');
  }, [subsectorFiltro]);

  // Efecto 3: la fuente de los marcadores (Y la de clústeres, que viaja con
  // los mismos datos) se actualiza con cada búsqueda — la primera vez crea
  // fuentes/capas/ícono; de ahí en más solo `setData`, sin tocar layers ni
  // recargar el ícono. Pin, calor y clústeres COMPARTEN esta sincronización
  // porque las tres vistas muestran los mismos contactos, solo que
  // representados distinto — separar esto en tres efectos habría triplicado
  // la lógica de «primera vez vs. ya existe» sin ganar nada.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    let cancelado = false;

    const datos = featureCollectionDeContactos(visibles);

    // Compartido entre el pin suelto (`CAPA_MARCADORES`) y un círculo de
    // clústeres que resultó ser de un solo contacto (`CAPA_CLUSTER_CIRCULOS`)
    // — el mismo contacto, el mismo popup, sin importar cuál de las dos
    // capas lo mostró.
    function abrirPopupDeContacto(e: MapLayerMouseEvent) {
      const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!feature || feature.geometry.type !== 'Point') return;
      const [lon, lat] = feature.geometry.coordinates;
      // Centra + acerca la cámara EXACTO en el marcador clickeado — antes
      // esto lo terminaba haciendo (mal) el `fitBounds` del departamento/
      // provincia/distrito de abajo (mismo punto, layer distinta: ver
      // `hayMarcadorEn`), que reencuadraba a la geometría ENTERA del nivel
      // en vez del punto — de ahí el reporte «se acerca pero se aleja».
      // `Math.max` contra el zoom actual: si ya se venía de un drill-down
      // más cercano que esto, no aleja la cámara para «volver» acá.
      mapa!.easeTo({
        center: [lon, lat],
        zoom: Math.max(mapa!.getZoom(), ZOOM_AL_CLICKEAR_MARCADOR),
        duration: 700,
      });
      new Popup({ offset: 30, closeButton: true, maxWidth: 'none', className: 'hermes-popup-contacto' })
        .setLngLat([lon, lat])
        .setHTML(contenidoPopup(feature.properties as DatosPopup))
        .addTo(mapa!);
    }

    function sincronizar() {
      if (cancelado) return;
      const fuente = mapa!.getSource(FUENTE_MARCADORES) as GeoJSONSource | undefined;
      if (fuente) {
        void fuente.setData(datos);
        const fuenteCluster = mapa!.getSource(FUENTE_CLUSTER) as GeoJSONSource | undefined;
        if (fuenteCluster) void fuenteCluster.setData(datos);
        return;
      }
      asegurarImagenPin(mapa!, () => {
        if (cancelado) return;
        mapa!.addSource(FUENTE_MARCADORES, { type: 'geojson', data: datos });
        mapa!.addLayer({
          id: CAPA_MARCADORES,
          type: 'symbol',
          source: FUENTE_MARCADORES,
          layout: {
            'icon-image': IMAGEN_PIN,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
        });
        mapa!.on('mouseenter', CAPA_MARCADORES, () => {
          mapa!.getCanvas().style.cursor = 'pointer';
        });
        mapa!.on('mouseleave', CAPA_MARCADORES, () => {
          mapa!.getCanvas().style.cursor = '';
        });
        mapa!.on('click', CAPA_MARCADORES, abrirPopupDeContacto);

        crearCapaCalor(mapa!);
        crearCapasCluster(mapa!, datos);

        mapa!.on('mouseenter', CAPA_CLUSTER_CIRCULOS, () => {
          mapa!.getCanvas().style.cursor = 'pointer';
        });
        mapa!.on('mouseleave', CAPA_CLUSTER_CIRCULOS, () => {
          mapa!.getCanvas().style.cursor = '';
        });
        // Clickear un círculo con más de un contacto ACERCA hasta el zoom
        // donde ese grupo se abre en grupos más chicos (o en círculos de 1)
        // — `getClusterExpansionZoom` es lo que la propia fuente ya sabe
        // calcular, nada a mano. Un círculo que YA es de un solo contacto
        // (sin `cluster_id`, la fuente no lo agrupó con nadie) no tiene nada
        // que expandir — abre su popup directo, mismo comportamiento que el
        // pin suelto de siempre.
        mapa!.on('click', CAPA_CLUSTER_CIRCULOS, (e) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          const clusterId = feature.properties?.cluster_id;
          if (clusterId == null) {
            abrirPopupDeContacto(e);
            return;
          }
          const fuenteCluster = mapa!.getSource(FUENTE_CLUSTER) as GeoJSONSource;
          const centro = feature.geometry.coordinates as [number, number];
          fuenteCluster
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => mapa!.easeTo({ center: centro, zoom, duration: 500 }))
            .catch(() => {
              // Sin red o el cluster ya se disolvió solo (los datos
              // cambiaron a mitad de camino) — no hay nada que reintentar.
            });
        });

        // La vista pudo haber cambiado MIENTRAS estas capas no existían
        // (el usuario clickeó «Mapa de calor»/«clústeres» apenas se abrió
        // el panel, antes de que este bloque terminara de correr) —
        // sincronizarlas ahora evita que se queden invisibles hasta el
        // PRÓXIMO cambio de vista.
        aplicarVista(mapa!, vistaRef.current, false);
      });
    }

    if (mapa.isStyleLoaded()) sincronizar();
    else mapa.once('load', sincronizar);

    return () => {
      cancelado = true;
    };
  }, [visibles]);

  /**
   * El breadcrumb sube de nivel: limpia lo que quedó debajo y vuelve a
   * encuadrar en el bbox guardado al elegir ese nivel (`bounds*Ref`) — es la
   * única forma de «volver» que tiene el drill-down, la referencia no
   * describió ninguna, así que esta es una decisión propia, no una copia.
   */
  function irANivel(nivel: 'pais' | 'departamento' | 'provincia' | 'distrito' | 'sector') {
    const mapa = mapaRef.current;
    // Igual que en `seleccionarXRef`: el breadcrumb no pasa el mouse por
    // encima de nada, así que sin esto un tooltip de un hover anterior se
    // quedaba flotando con el nombre de un lugar que ya no aplica.
    setHover(null);
    const reencuadrar = (geometria: GeoJSON.Geometry | null, maxZoom: number) => {
      if (!mapa || !geometria) return;
      const [minLon, minLat, maxLon, maxLat] = bboxDeGeometria(geometria);
      mapa.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 60, duration: 900, maxZoom },
      );
    };
    if (nivel === 'pais') {
      setDepartamentoFiltro('');
      setProvinciaFiltro('');
      setDistritoFiltro('');
      setSectorFiltro('');
      setSubsectorFiltro('');
      if (mapa) encuadrarPeru(mapa, vista, true);
      return;
    }
    if (nivel === 'departamento') {
      setProvinciaFiltro('');
      setDistritoFiltro('');
      setSectorFiltro('');
      setSubsectorFiltro('');
      reencuadrar(boundsDepartamentoRef.current, 9);
      return;
    }
    if (nivel === 'provincia') {
      setDistritoFiltro('');
      setSectorFiltro('');
      setSubsectorFiltro('');
      reencuadrar(boundsProvinciaRef.current, 11);
      return;
    }
    if (nivel === 'distrito') {
      setSectorFiltro('');
      setSubsectorFiltro('');
      reencuadrar(boundsDistritoRef.current, 13);
      return;
    }
    setSubsectorFiltro('');
    reencuadrar(boundsSectorRef.current, 15);
  }
  // Mantiene `irANivelRef` apuntando a ESTA versión de `irANivel` (cierra
  // sobre `vista`, que cambia) — sin esto, el clic «fuera del mapa» del
  // efecto 1 llamaría siempre a `null` y nunca resetearía nada.
  useEffect(() => {
    irANivelRef.current = irANivel;
  });

  async function refrescar() {
    if (!onRefrescar || refrescando) return;
    setRefrescando(true);
    try {
      await onRefrescar();
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o celular…"
            aria-label="Buscar contactos en el mapa"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        {onRefrescar && (
          <button
            type="button"
            onClick={refrescar}
            disabled={refrescando}
            aria-label="Actualizar contactos"
            title="Actualizar contactos"
            className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={14} className={refrescando ? 'animate-spin' : undefined} />
          </button>
        )}
        <select
          value={departamentoFiltro}
          onChange={(e) => {
            const valor = e.target.value;
            if (!valor) {
              setDepartamentoFiltro('');
              return;
            }
            // Mismo camino que el clic en el mapa (centra + acerca +
            // carga provincias) — elegir del selector no puede dejar el
            // mapa a medio actualizar respecto de clickear directo.
            const feature = departamentos?.features.find((f) => f.properties?.[CLAVE_DEPARTAMENTO] === valor);
            if (feature) seleccionarDepartamentoRef.current?.(valor, feature.geometry);
            else setDepartamentoFiltro(valor);
          }}
          aria-label="Filtrar por departamento"
          disabled={departamentosDisponibles.length === 0}
          className="shrink-0 rounded-lg border border-border bg-card py-2 pl-3 pr-7 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-50"
        >
          <option value="">Todos los departamentos</option>
          {departamentosDisponibles.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {(busqueda.trim() || departamentoFiltro) && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {visibles.length} de {conPunto.length}
          </span>
        )}
      </div>

      {departamentoFiltro && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-4 py-1.5 text-xs">
          <button
            type="button"
            onClick={() => irANivel('pais')}
            className="rounded px-1.5 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Perú
          </button>
          <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
          <button
            type="button"
            onClick={() => irANivel('departamento')}
            className={
              'rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-muted ' +
              (provinciaFiltro ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')
            }
          >
            {departamentoFiltro}
          </button>
          {provinciaFiltro && (
            <>
              <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => irANivel('provincia')}
                className={
                  'rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-muted ' +
                  (distritoFiltro ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')
                }
              >
                {provinciaFiltro}
              </button>
            </>
          )}
          {distritoFiltro && (
            <>
              <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => irANivel('distrito')}
                className={
                  'rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-muted ' +
                  (sectorFiltro ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')
                }
              >
                {distritoFiltro}
              </button>
            </>
          )}
          {sectorFiltro && (
            <>
              <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => irANivel('sector')}
                className={
                  'rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-muted ' +
                  (subsectorFiltro ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')
                }
              >
                {sectorFiltro}
              </button>
            </>
          )}
          {subsectorFiltro && (
            <>
              <ChevronRight size={12} className="shrink-0 text-muted-foreground/60" />
              <span className="rounded px-1.5 py-0.5 font-medium text-foreground">{subsectorFiltro}</span>
            </>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={contenedorRef} className="h-full w-full" />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-navy px-3 py-1.5 text-white shadow-panel"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/60">
              {hover.etiqueta}
            </span>
            <span className="block text-sm font-bold leading-tight">{hover.nombre}</span>
          </div>
        )}
        {capasAbiertas && (
          <div className="absolute left-3 top-3 z-20 w-56 rounded-xl border border-border bg-card p-3 text-xs shadow-panel">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Layers size={13} /> Capas
              </span>
              <button
                type="button"
                aria-label="Cerrar capas"
                onClick={() => setCapasAbiertas(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={13} />
              </button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={verMarcadores}
                onChange={(e) => setVerMarcadores(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-foreground">Marcadores de contactos</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={verFronteras}
                onChange={(e) => setVerFronteras(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-foreground">Fronteras administrativas</span>
            </label>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {conPunto.length} de {contactos.length} {contactos.length === 1 ? 'contacto' : 'contactos'} con ubicación registrada
      </footer>
    </div>
  );
}
