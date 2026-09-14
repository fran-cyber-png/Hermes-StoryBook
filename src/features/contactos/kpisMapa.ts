import { useEffect, useMemo, useState } from 'react';
import { locacionDe, quienRegistro, type ContactoRegistrado } from './contactosRegistrados';

/**
 * LOS KPIS DE LA VENTANA «Mapas» (pedido del 4-sep-2026) — deliberadamente
 * SEPARADOS de `MapaContactosLienzo.tsx`: ese archivo ya es el más delicado
 * del panel (drill-down, cámara, sombreado, tres sesiones de idas y vueltas
 * documentadas ahí mismo), así que esto no le agrega una prop ni un efecto
 * más. Recalcula lo mínimo que hace falta (punto-en-polígono contra el mismo
 * geojson de departamentos) de forma independiente, con su propio fetch —
 * el archivo del navegador queda cacheado, así que el segundo `fetch` no
 * pesa nada.
 */

const RUTA_DEPARTAMENTOS = `${import.meta.env.BASE_URL}geo/peru-departamentos.geo.json`;
const CLAVE_DEPARTAMENTO = 'NOMBDEP';

/**
 * A qué distancia dos contactos cuentan como «el mismo lugar» para el KPI de
 * «más denso» — 15 km, la escala de una sola ciudad (cubre Lima+Callao, que
 * el mapa de clústeres ya agrupa juntos a simple vista). No es el radio en
 * píxeles que usa MapLibre (`crearCapasCluster`, 35px): ese depende del zoom
 * actual en pantalla, y este KPI tiene que dar el MISMO número esté la vista
 * donde esté — necesita una unidad que no cambie con el zoom.
 */
const RADIO_CLUSTER_KM = 15;

/** Ray casting sobre un anillo — copia deliberada de la misma función en `MapaContactosLienzo.tsx` (ver el comentario del módulo). */
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

function puntoEnPoligono(lon: number, lat: number, geometria: GeoJSON.Geometry): boolean {
  const enPoligono = ([externo, ...huecos]: GeoJSON.Position[][]) =>
    dentroDelAnillo(lon, lat, externo) && !huecos.some((h) => dentroDelAnillo(lon, lat, h));
  if (geometria.type === 'Polygon') return enPoligono(geometria.coordinates);
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.some(enPoligono);
  return false;
}

/** Distancia entre dos puntos (haversine, en km) — para agrupar por cercanía real, no por píxeles. */
function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const aRad = (d: number) => (d * Math.PI) / 180;
  const dLat = aRad(b.lat - a.lat);
  const dLon = aRad(b.lon - a.lon);
  const lat1 = aRad(a.lat);
  const lat2 = aRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface KpisMapa {
  total: number;
  conUbicacion: number;
  sinUbicacion: number;
  /** 0-100, redondeado. `0` si no hay ningún contacto. */
  porcentajeConUbicacion: number;
  /** De mayor a menor. Vacío mientras el geojson de departamentos no cargó. */
  porDepartamento: { nombre: string; cuantos: number }[];
  /** Cuántos de los 25 departamentos (incluido Callao) tienen al menos un contacto — el alcance geográfico de la libreta. */
  departamentosCubiertos: number;
  /** `0` mientras el geojson de departamentos no cargó (no hay con qué comparar «cubiertos»). */
  totalDepartamentos: number;
  /** Los que NO tienen ningún contacto todavía — el hueco, no el logro. Vacío mientras el geojson no cargó. */
  departamentosSinCobertura: string[];
  /** `prioridad === 'alta'` — sobre TODOS los contactos, tengan ubicación o no (no es una métrica geográfica). */
  prioridadAlta: number;
  /** Desglose completo de prioridad, sobre TODOS los contactos — para el detalle detrás de la tarjeta «Prioridad alta». */
  porPrioridad: { alta: number; media: number; baja: number; sinDato: number };
  /**
   * Quién anotó cada contacto (`quienRegistro`, colapsa Cerberus/Centurión de
   * la misma persona), de mayor a menor — el detalle detrás de la tarjeta
   * «Contactos registrados». Sobre TODOS los contactos, no solo los que
   * tienen punto: quién registró no depende de si el punto se marcó.
   */
  porRegistrador: { nombre: string; cuantos: number }[];
  /**
   * `null` = ningún contacto con ubicación tiene a otro a menos de
   * `RADIO_CLUSTER_KM` (nada que agrupar). Si existe, `cuantos` siempre es
   * ≥ 2 — un grupo de 1 no es una concentración, es un contacto suelto.
   */
  clusterMasGrande: { cuantos: number; departamento: string | null; ubicacion: string | null } | null;
}

/** Únicamente para las cuentas de acá: sin lat/lon no hay dónde ubicarlo, igual que en el lienzo del mapa. */
function conPuntoDe(contactos: readonly ContactoRegistrado[]): (ContactoRegistrado & { lat: number; lon: number })[] {
  return contactos.filter((c): c is ContactoRegistrado & { lat: number; lon: number } => c.lat != null && c.lon != null);
}

function departamentoPorContacto(
  conPunto: readonly (ContactoRegistrado & { lat: number; lon: number })[],
  departamentos: GeoJSON.FeatureCollection | null,
): Map<string, string> {
  const mapa = new Map<string, string>();
  if (!departamentos) return mapa;
  for (const c of conPunto) {
    const feature = departamentos.features.find((f) => puntoEnPoligono(c.lon, c.lat, f.geometry));
    const nombre = feature?.properties?.[CLAVE_DEPARTAMENTO];
    if (typeof nombre === 'string') mapa.set(c.clave, nombre);
  }
  return mapa;
}

/**
 * Agrupa por cercanía real con un union-find simple — O(n²) en distancias,
 * de sobra para el tamaño de una libreta de contactos (no es una tabla de
 * millones de filas). Devuelve el grupo más grande, o `null` si el más
 * grande tiene un solo contacto (nadie cerca de nadie).
 */
function clusterMasGrandeDe(
  conPunto: readonly (ContactoRegistrado & { lat: number; lon: number })[],
  depPorClave: Map<string, string>,
): KpisMapa['clusterMasGrande'] {
  const n = conPunto.length;
  if (n === 0) return null;
  const padre = Array.from({ length: n }, (_, i) => i);
  function raiz(i: number): number {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]];
      i = padre[i];
    }
    return i;
  }
  function unir(a: number, b: number) {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[ra] = rb;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (distanciaKm(conPunto[i], conPunto[j]) <= RADIO_CLUSTER_KM) unir(i, j);
    }
  }
  const grupos = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = raiz(i);
    const arr = grupos.get(r) ?? [];
    arr.push(i);
    grupos.set(r, arr);
  }
  let mejor: number[] | null = null;
  for (const arr of grupos.values()) {
    if (!mejor || arr.length > mejor.length) mejor = arr;
  }
  if (!mejor || mejor.length < 2) return null;

  const conteoDep = new Map<string, number>();
  for (const idx of mejor) {
    const dep = depPorClave.get(conPunto[idx].clave);
    if (dep) conteoDep.set(dep, (conteoDep.get(dep) ?? 0) + 1);
  }
  let departamento: string | null = null;
  let max = 0;
  for (const [dep, c] of conteoDep) {
    if (c > max) {
      max = c;
      departamento = dep;
    }
  }
  // Solo si TODOS los del grupo comparten la misma locación puntual (p.ej.
  // «San Isidro, Lima») vale la pena mostrarla — si el grupo mezcla dos
  // locaciones distintas que igual quedaron cerca en el mapa, el departamento
  // ya alcanza para decir «dónde está» sin inventar precisión que no hay.
  const ubicaciones = new Set(mejor.map((idx) => locacionDe(conPunto[idx])).filter(Boolean));
  const ubicacion = ubicaciones.size === 1 ? [...ubicaciones][0]! : null;
  return { cuantos: mejor.length, departamento, ubicacion };
}

function calcularKpis(contactos: readonly ContactoRegistrado[], departamentos: GeoJSON.FeatureCollection | null): KpisMapa {
  const total = contactos.length;
  const conPunto = conPuntoDe(contactos);
  const conUbicacion = conPunto.length;
  const sinUbicacion = total - conUbicacion;
  const porcentajeConUbicacion = total > 0 ? Math.round((conUbicacion / total) * 100) : 0;

  const depPorClave = departamentoPorContacto(conPunto, departamentos);
  const conteoPorDep = new Map<string, number>();
  for (const nombre of depPorClave.values()) conteoPorDep.set(nombre, (conteoPorDep.get(nombre) ?? 0) + 1);
  const porDepartamento = [...conteoPorDep]
    .map(([nombre, cuantos]) => ({ nombre, cuantos }))
    .sort((a, b) => b.cuantos - a.cuantos || a.nombre.localeCompare(b.nombre, 'es'));

  const cubiertos = new Set(conteoPorDep.keys());
  const departamentosSinCobertura = (departamentos?.features ?? [])
    .map((f) => f.properties?.[CLAVE_DEPARTAMENTO])
    .filter((nombre): nombre is string => typeof nombre === 'string' && !cubiertos.has(nombre))
    .sort((a, b) => a.localeCompare(b, 'es'));

  const porPrioridad = { alta: 0, media: 0, baja: 0, sinDato: 0 };
  for (const c of contactos) {
    if (c.prioridad === 'alta') porPrioridad.alta++;
    else if (c.prioridad === 'media') porPrioridad.media++;
    else if (c.prioridad === 'baja') porPrioridad.baja++;
    else porPrioridad.sinDato++;
  }

  const conteoPorRegistrador = new Map<string, number>();
  for (const c of contactos) {
    const nombre = quienRegistro(c.vendedoraId);
    conteoPorRegistrador.set(nombre, (conteoPorRegistrador.get(nombre) ?? 0) + 1);
  }
  const porRegistrador = [...conteoPorRegistrador]
    .map(([nombre, cuantos]) => ({ nombre, cuantos }))
    .sort((a, b) => b.cuantos - a.cuantos || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    total,
    conUbicacion,
    sinUbicacion,
    porcentajeConUbicacion,
    porDepartamento,
    departamentosCubiertos: porDepartamento.length,
    totalDepartamentos: departamentos?.features.length ?? 0,
    departamentosSinCobertura,
    prioridadAlta: porPrioridad.alta,
    porPrioridad,
    porRegistrador,
    clusterMasGrande: clusterMasGrandeDe(conPunto, depPorClave),
  };
}

/** El geojson de departamentos, cargado una sola vez — mismo archivo que usa el mapa, así que llega de la caché del navegador. */
function useDepartamentosGeoJSON(): GeoJSON.FeatureCollection | null {
  const [departamentos, setDepartamentos] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    let cancelado = false;
    fetch(RUTA_DEPARTAMENTOS)
      .then((r) => r.json())
      .then((datos: GeoJSON.FeatureCollection) => {
        if (!cancelado) setDepartamentos(datos);
      })
      .catch(() => {
        // Sin geojson no hay ranking por departamento ni «dónde está» del
        // cluster — el resto de los KPIs (total, con/sin ubicación) igual
        // se puede calcular y mostrar, así que no hay nada que propagar acá.
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return departamentos;
}

export function useKpisMapa(contactos: readonly ContactoRegistrado[]): KpisMapa {
  const departamentos = useDepartamentosGeoJSON();
  return useMemo(() => calcularKpis(contactos, departamentos), [contactos, departamentos]);
}
