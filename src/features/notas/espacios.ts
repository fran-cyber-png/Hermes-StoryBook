import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * LOS ESPACIOS DE TRABAJO DE LA LIBRETA (ADR 0046) — datos y reglas de lectura.
 *
 * Un espacio es DÓNDE VIVE una página, y por lo tanto quién la ve. La libreta
 * privada **no está en esta lista**: es implícita (`espacioId === null`), y por
 * eso el selector la dibuja aparte y siempre primera.
 *
 * A propósito NO entra a `PERSISTIBLES` (`src/lib/datos/persistencia.ts`), como
 * las notas: un espacio del que te sacaron, rehidratado desde IndexedDB, sería
 * un lugar que se ve en la pantalla y responde 403 al abrirlo. Peor que un
 * spinner.
 */

export interface Espacio {
  id: number;
  nombre: string;
  /** Quién lo creó: la única que puede agregar/sacar miembros y archivarlo. */
  creadaPor: string;
  creadoAt: string;
  /** Con la grafía con la que se guardaron — ver `mismoUsuario`. */
  miembros: string[];
  /** `null` = vivo. Ausente en `GET /` (esa ruta ni sirve archivados —
   *  siempre sería `null`); presente en `GET /mios` (26-ago-2026). */
  archivadoAt?: string | null;
  /**
   * CUÁNTAS PÁGINAS VIVAS tiene, para "Tus espacios" en la barra lateral
   * (03-sep-2026) — de CUALQUIER miembro, no solo las tuyas: es un dato del
   * lugar. **Solo en `GET /`** (la lista para navegar): `GET /mios` — el
   * modal de administrar — no lo pide, así que viene `undefined` ahí.
   */
  paginas?: number;
  /**
   * UNA CLAVE del set curado (`iconosDeEspacio.ts`), o `null`/ausente para el
   * ícono por defecto (`Users`, el de siempre). `undefined` puede pasar en
   * respuestas viejas de caché — se trata igual que `null`.
   */
  icono?: string | null;
}

/**
 * DÓNDE ESTOY PARADA. `null` = mi libreta privada.
 *
 * Es el mismo valor que viaja al server (`?espacio=`), así que no hay una
 * traducción en el medio que se pueda equivocar.
 */
export type DondeEstoy = number | null;

/**
 * QUÉ SE ESTÁ MIRANDO EN EL RIEL (03-sep-2026) — reemplaza al viejo
 * "Mi libreta"/espacio de dos valores por CUATRO: las tres vistas de "MI
 * LIBRETA" ("solo tú" — nunca cruzan a un espacio) más un espacio puntual.
 *
 * ⚠️ `'todas'` NO es un cuarto lugar nuevo: es, carácter por carácter, lo que
 * antes se llamaba simplemente "Mi libreta" (`espacioId === null`, sin
 * filtrar). No hay una fila de "Mi libreta" aparte de "Todas las páginas" —
 * sería la misma pregunta hecha dos veces.
 */
export type VistaLibreta = { tipo: 'todas' } | { tipo: 'favoritas' } | { tipo: 'papelera' } | { tipo: 'espacio'; id: number };

/** El `DondeEstoy`/`espacioId` que le corresponde a una vista — las tres de "MI LIBRETA" son SIEMPRE la libreta privada. */
export function dondeDeVista(vista: VistaLibreta): DondeEstoy {
  return vista.tipo === 'espacio' ? vista.id : null;
}

/** ¿Es la MISMA vista? — lo que decide si un clic en el riel cambia de lugar o solo hace toggle del panel. */
export function mismaVista(a: VistaLibreta, b: VistaLibreta): boolean {
  if (a.tipo !== b.tipo) return false;
  return a.tipo === 'espacio' && b.tipo === 'espacio' ? a.id === b.id : true;
}

/**
 * ⚠️ **EL MISMO HUMANO TIENE DOS GRAFÍAS VIVAS EN PRODUCCIÓN.** Cerberus empuja
 * `Luz` y ella entra escribiendo `luz`; hay `usuario1` y `Usuario1`. Comparar
 * exacto no da error: da que **Luz no ve los botones de su propio espacio**.
 *
 * Es el gemelo en el front de `mismaVendedora` (server, `reparto/destino.ts`) y
 * de `esMio` en `features/eventos/`. Los tres tienen que decir lo mismo.
 */
export function mismoUsuario(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toLowerCase();
  return x !== '' && x === (b ?? '').trim().toLowerCase();
}

/** ¿Puedo administrar este espacio (miembros, archivarlo)? Solo quien lo creó. */
export function puedoAdministrar(espacio: Espacio, vendedoraId: string | null | undefined): boolean {
  return mismoUsuario(espacio.creadaPor, vendedoraId);
}

/**
 * Cómo se nombra a alguien en pantalla. El `vendedora_id` es el username de
 * Cerberus y en cinco de las nueve personas es un correo entero
 * (`ventas10@grupogoberna.com`), que en una fila de 19rem no entra ni de cerca.
 */
export function nombreCorto(vendedoraId: string): string {
  const sinDominio = vendedoraId.includes('@') ? vendedoraId.slice(0, vendedoraId.indexOf('@')) : vendedoraId;
  return sinDominio.trim() || vendedoraId;
}

export function useEspacios() {
  return useQuery({
    queryKey: ['espacios'],
    queryFn: () => api<{ espacios: Espacio[] }>('/api/espacios'),
    select: (d) => d.espacios,
  });
}

/**
 * LOS QUE YO CREÉ — vivos Y archivados, para el modal de administrar
 * (26-ago-2026). QueryKey DISTINTA de `useEspacios` a propósito: son dos
 * preguntas distintas («dónde puedo escribir» vs. «qué puedo administrar»),
 * ver el docblock del server (`espacios/repositorio.ts: listarCreadosPor`).
 */
export function useEspaciosMios(activo: boolean) {
  return useQuery({
    queryKey: ['espacios', 'mios'],
    queryFn: () => api<{ espacios: Espacio[] }>('/api/espacios/mios'),
    select: (d) => d.espacios,
    enabled: activo,
  });
}

/**
 * A QUIÉNES SE PUEDE INVITAR — el padrón que el server arma con la rueda del
 * reparto y `numero_vendedora`.
 *
 * Se pide solo cuando hace falta (`activo`): es la lista de una pantalla de
 * administración que se abre una vez por semana, no algo que la Libreta necesite
 * para dibujar una página.
 */
export function usePadron(activo: boolean) {
  return useQuery({
    queryKey: ['espacios', 'padron'],
    queryFn: () => api<{ personas: string[] }>('/api/espacios/padron'),
    select: (d) => d.personas,
    enabled: activo,
  });
}

export function useMutacionesEspacios() {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ['espacios'] });

  const crear = useMutation({
    mutationFn: (v: { nombre: string; miembros: string[] }) =>
      api<{ ok: true; espacio: Espacio }>('/api/espacios', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: invalidar,
  });

  const agregarMiembro = useMutation({
    mutationFn: (v: { espacioId: number; vendedoraId: string }) =>
      api<{ ok: true; espacio: Espacio }>(`/api/espacios/${v.espacioId}/miembros`, {
        method: 'POST',
        body: JSON.stringify({ vendedoraId: v.vendedoraId }),
      }),
    onSuccess: invalidar,
  });

  const sacarMiembro = useMutation({
    mutationFn: (v: { espacioId: number; vendedoraId: string }) =>
      api<{ ok: true; espacio: Espacio }>(
        `/api/espacios/${v.espacioId}/miembros/${encodeURIComponent(v.vendedoraId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidar,
  });

  /**
   * RENOMBRAR. Sin esto, un nombre mal puesto no tenía arreglo desde la app: la
   * única salida era archivar el espacio y rehacerlo, moviendo las páginas a mano.
   * El nombre no es la identidad (esa es el `id`), así que renombrar no rompe
   * ningún link ni ninguna membresía.
   */
  const renombrar = useMutation({
    mutationFn: (v: { espacioId: number; nombre: string }) =>
      api<{ ok: true; espacio: Espacio }>(`/api/espacios/${v.espacioId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre: v.nombre }),
      }),
    onSuccess: invalidar,
  });

  /**
   * EL ÍCONO (03-sep-2026). `icono: null` vuelve al de siempre — ver el
   * docblock de `Espacio.icono` y de la ruta en el server.
   */
  const cambiarIcono = useMutation({
    mutationFn: (v: { espacioId: number; icono: string | null }) =>
      api<{ ok: true; espacio: Espacio }>(`/api/espacios/${v.espacioId}/icono`, {
        method: 'PATCH',
        body: JSON.stringify({ icono: v.icono }),
      }),
    onSuccess: invalidar,
  });

  const archivar = useMutation({
    mutationFn: (espacioId: number) =>
      api<{ ok: true }>(`/api/espacios/${espacioId}/archivar`, { method: 'PATCH' }),
    onSuccess: invalidar,
  });

  /** El camino de vuelta (26-ago-2026), desde el modal de administrar. */
  const desarchivar = useMutation({
    mutationFn: (espacioId: number) =>
      api<{ ok: true; espacio: Espacio }>(`/api/espacios/${espacioId}/desarchivar`, { method: 'PATCH' }),
    onSuccess: invalidar,
  });

  return { crear, renombrar, cambiarIcono, agregarMiembro, sacarMiembro, archivar, desarchivar };
}
