import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * LA LIBRETA DE CONTACTOS DEL EQUIPO — la parte pura + el hook.
 *
 * Lo que el equipo registró desde el chat (`contacto_ficha`, ADR 0060) y hasta
 * el 23-ago-2026 no tenía dónde verse: la única forma de leer una ficha era
 * volver a abrir la conversación que la generó. En una campaña eso es grave —no
 * hay padrón de icarus ni Cerberus del otro lado, así que **lo que se registra a
 * mano ES la base de datos**.
 *
 * Nada de JSX acá: la regla de «qué se muestra y en qué orden» tiene que poder
 * interrogarse sin montar un DOM.
 */

export interface ContactoRegistrado {
  clave: string;
  telefono: string | null;
  nombre: string | null;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  prioridad: string | null;
  vendedoraId: string;
  distrito: string | null;
  direccion: string | null;
  /**
   * La geografía real (INEI): «distrito, departamento» o «provincia,
   * departamento» — lo más específico que devolvió el mapa, aunque no calce
   * con ningún distrito del catálogo propio.
   */
  ubicacion: string | null;
  /** El punto que marcó el mapa al anotar la dirección (ADR 0088). `null` si nunca se marcó. */
  lat: number | null;
  lon: number | null;
  linea: string;
  favorito: boolean;
  /** Si fue registrado a mano en ficha o ingresó por chat/anuncio */
  registrado?: boolean;
  campanaId?: string | null;
  campanaNombre?: string | null;
  adId?: string | null;
  aviso?: string | null;
  creadoAt: string;
  actualizadoAt: string;
}

export interface RespuestaContactos {
  contactos: ContactoRegistrado[];
  porPersona: { vendedoraId: string; cuantos: number }[];
}

export function useContactosRegistrados(activo = true) {
  return useQuery({
    queryKey: ['contactos-registrados'],
    enabled: activo,
    queryFn: () => api<RespuestaContactos>('/api/contactos/registrados'),
  });
}

/**
 * Marcar/desmarcar favorito — OPTIMISTA. A diferencia del territorio (dato de
 * campo que no se puede dar por tomado), esto es un estado chico y reversible:
 * esperar el viaje de ida y vuelta antes de prender la estrella se siente como
 * que el clic no hizo nada. Si el server rechaza, se revierte solo.
 */
export function useMarcarFavorito() {
  const qc = useQueryClient();
  const key = ['contactos-registrados'];
  return useMutation({
    mutationFn: ({ clave, favorito }: { clave: string; favorito: boolean }) =>
      api(`/api/contactos/registro/${encodeURIComponent(clave)}/favorito`, {
        method: 'PATCH',
        body: JSON.stringify({ favorito }),
      }),
    onMutate: async ({ clave, favorito }) => {
      await qc.cancelQueries({ queryKey: key });
      const previo = qc.getQueryData<RespuestaContactos>(key);
      if (previo) {
        qc.setQueryData<RespuestaContactos>(key, {
          ...previo,
          contactos: previo.contactos.map((c) => (c.clave === clave ? { ...c, favorito } : c)),
        });
      }
      return { previo };
    },
    onError: (_err, _vars, contexto) => {
      if (contexto?.previo) qc.setQueryData(key, contexto.previo);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

/**
 * "RECLAMAR" un contacto manual — antes de abrir Mensajes con «Mensaje»
 * (`PanelContacto`), para que la conversación real nazca con la ficha, el
 * territorio, las etiquetas y el timeline ya adentro en vez de "Sin nombre" y
 * "— sin anotar —" (ver `server/src/contactos/reclamar.ts`).
 */
export function useReclamarContactoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claveManual, claveReal }: { claveManual: string; claveReal: string }) =>
      api<{ ok: true; migrado: boolean }>(
        `/api/contactos/registro/${encodeURIComponent(claveManual)}/reclamar`,
        { method: 'POST', body: JSON.stringify({ claveReal }) },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contactos-registrados'] }),
  });
}

/**
 * EL NOMBRE QUE SE MUESTRA.
 *
 * ⚠️ **Cae al teléfono, nunca a «Sin nombre».** Una ficha se registra a veces
 * con el teléfono solo (`faltaLoMinimo` deja pasar con uno de los dos), y una
 * fila que dice «Sin nombre» sobre un número que está ahí al lado no informa
 * nada: esconde el único dato que hay.
 */
export function nombreVisible(c: Pick<ContactoRegistrado, 'nombre' | 'apellido' | 'telefono'>): string {
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ').trim();
  return nombre || c.telefono || '—';
}

/**
 * LA COLUMNA «LOCACIÓN» — el distrito PROPIO de la campaña si el punto cayó
 * ahí, o si no, la geografía real (pedido del 1-sep-2026): «distrito,
 * departamento» o «provincia, departamento», nunca un nombre suelto sin decir
 * de qué departamento es. `distrito` es más específico y es la pregunta que
 * la campaña se hace todos los días («¿cuántos tengo en Comas?»), así que
 * gana cuando existe; `ubicacion` es el resto del país, que la campaña no
 * cargó como distrito propio pero que igual dice algo en vez de un «—» mudo.
 */
export function locacionDe(c: Pick<ContactoRegistrado, 'distrito' | 'ubicacion'>): string | null {
  return c.distrito ?? c.ubicacion;
}

/** Las iniciales del avatar: hasta dos letras de `nombreVisible`. */
export function inicialesDe(nombre: string): string {
  const letras = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return letras || '—';
}

/**
 * EL NOMBRE CORTO DE QUIEN REGISTRÓ. `centurion:job.meneses` → «Job.meneses»,
 * `ventas10@grupogoberna.com` → «Ventas10».
 *
 * ⚠️ **Le saca el prefijo `centurion:`** además de cortar en el `@`. Las dos
 * familias de identidad conviven en producción y la columna es angosta; el
 * prefijo es lo único que no aporta nada al leer una fila.
 *
 * 🔴 **NORMALIZA MAYÚSCULAS/MINÚSCULAS DEL TODO, no solo la primera letra —
 * la regla dura #4 del repo, aplicada al RÓTULO.** En producción el mismo
 * `vendedora_id` vive con grafías distintas (`Luz`, `LUZ`, `luz`); antes esta
 * función solo forzaba mayúscula la primera letra y dejaba el resto tal cual,
 * así que `LUZ` y `luz` quedaban como DOS rótulos distintos («LUZ» y «Luz»).
 * `productividad()` agrupa por el rótulo que devuelve esta función, así que
 * esa diferencia partía a una sola persona en dos filas de «Cuántos registró
 * cada uno», cada una con parte del total — el conteo se veía mal sin que el
 * `GROUP BY` del server estuviera mal: estaba agrupando bien, por grafías que
 * de verdad son distintas.
 */
export function quienRegistro(id: string): string {
  const sinPrefijo = id.startsWith('centurion:') ? id.slice('centurion:'.length) : id;
  const corto = sinPrefijo.split('@')[0]?.trim() ?? '';
  if (!corto) return id;
  return corto.charAt(0).toUpperCase() + corto.slice(1).toLowerCase();
}

/**
 * EL FILTRO DE BÚSQUEDA — sobre todo lo que se ve en la fila.
 *
 * 🔴 **Incluye `vendedoraId` a propósito**: la pregunta «¿a quiénes registró
 * Job?» es la que hace útil la atribución, y sin esto habría que agregar un
 * filtro aparte para contestarla. Busca sobre el nombre CORTO además del id
 * crudo, que es lo que la fila muestra — filtrar por algo que no está en
 * pantalla es un buscador que a veces no encuentra lo que se ve.
 *
 * ⚠️ Sin acentos y sin mayúsculas de los dos lados: «áncash» tiene que
 * encontrar «Áncash», o el buscador falla justo con los nombres peruanos.
 */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function filtrarContactos(
  contactos: readonly ContactoRegistrado[],
  busqueda: string,
): ContactoRegistrado[] {
  const q = normalizar(busqueda.trim());
  if (!q) return [...contactos];
  return contactos.filter((c) =>
    normalizar(
      [
        c.nombre,
        c.apellido,
        c.telefono,
        c.email,
        c.empresa,
        c.distrito,
        c.vendedoraId,
        quienRegistro(c.vendedoraId),
        c.campanaNombre,
        c.aviso,
      ]
        .filter(Boolean)
        .join(' '),
    ).includes(q),
  );
}

/** Lista de campañas únicas presentes en los contactos. */
export function campanasDe(contactos: readonly ContactoRegistrado[]): string[] {
  const nombres = new Set(contactos.map((c) => c.campanaNombre?.trim()).filter(Boolean) as string[]);
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Lista de avisos/anuncios únicos presentes en los contactos (opcionalmente filtrados por campaña). */
export function avisosDe(contactos: readonly ContactoRegistrado[], campanaSeleccionada?: string): string[] {
  const universo = campanaSeleccionada ? contactos.filter((c) => c.campanaNombre === campanaSeleccionada) : contactos;
  const avisos = new Set(universo.map((c) => c.aviso?.trim()).filter(Boolean) as string[]);
  return [...avisos].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * EL PUNTO DE COLOR DE LA PRIORIDAD.
 *
 * ⚠️ **`normal` y ausente NO se dibujan**, y no es lo mismo por dentro pero sí
 * en pantalla: un punto gris en todas las filas deja de significar algo y
 * convierte la columna en ruido. Se marca lo que pide atención.
 *
 * **Sin oro**: en Hermes el dorado significa tiempo que se acaba, y acá no
 * corre ningún plazo.
 */
export function puntoDePrioridad(prioridad: string | null): { clase: string; rotulo: string } | null {
  // 🔴 `bg-destructive`, NO `bg-danger`: «danger» no existe en `index.css` y
  // Tailwind no avisa — la clase se emite, el punto no se pinta y la fila queda
  // con el rótulo «Alta» y sin marca. Lo encontró la CAPTURA, no un test: el
  // candado miraba que el color no fuera el dorado, no que existiera.
  if (prioridad === 'alta') return { clase: 'bg-destructive', rotulo: 'Alta' };
  if (prioridad === 'media') return { clase: 'bg-warning', rotulo: 'Media' };
  if (prioridad === 'baja') return { clase: 'bg-muted-foreground', rotulo: 'Baja' };
  return null;
}

/**
 * CUÁNTOS REGISTRÓ CADA PERSONA — agrupado por el nombre que se VE.
 *
 * 🔴 **EXISTE PORQUE EL SERVER NO PUEDE HACERLO, Y NO DEBE.** `Usuario2`
 * (Cerberus) y `centurion:usuario2` (Centurión) son **la misma persona con dos
 * cuentas**: el server los sirve separados porque para el resto del sistema son
 * dos identidades distintas —unificarlas allá sería inventar una que no
 * existe—, pero `quienRegistro` los colapsa al mismo rótulo. Sin esta función,
 * el bloque de productividad dibujaba **dos filas que dicen «Usuario2»** con
 * números distintos, que se lee como un bug y no como dos cuentas.
 *
 * 🔴 **Lo encontró un test que yo había escrito al revés**: afirmaba que los dos
 * ids NO colapsaban, y colapsaban. El defecto no estaba en el código sino en lo
 * que yo creía del código — por eso la afirmación se invirtió en vez de
 * borrarse.
 *
 * ⚠️ **Agrupa la PRESENTACIÓN, nunca el dato**: la respuesta cruda sigue
 * llegando con las dos entradas, y `porPersona` no se toca. El día que alguien
 * necesite auditar por cuenta, el dato está.
 */
export function productividad(
  porPersona: readonly { vendedoraId: string; cuantos: number }[],
): { nombre: string; cuantos: number }[] {
  const suma = new Map<string, number>();
  for (const p of porPersona) {
    const nombre = quienRegistro(p.vendedoraId);
    suma.set(nombre, (suma.get(nombre) ?? 0) + p.cuantos);
  }
  return [...suma]
    .map(([nombre, cuantos]) => ({ nombre, cuantos }))
    .sort((a, b) => b.cuantos - a.cuantos || a.nombre.localeCompare(b.nombre, 'es'));
}
