/**
 * QUÉ ES UN CORREO, DEL LADO DEL NAVEGADOR — capa 1 (`src/dominio/`).
 *
 * Vive acá y no en `features/correos` por lo mismo que `conversaciones.ts` salió
 * de `features/canales` (ADR 0057): el modelo lo van a necesitar la bandeja, el
 * composer, la ficha del contacto y el timeline, y un modelo que vive adentro de
 * una VISTA obliga a las otras tres a importar esa pantalla para tipar su propia
 * consulta. Importa `lib` y nada más.
 *
 * ══ 🔴 ACÁ ESTÁ EL CATÁLOGO, NUNCA EL PREDICADO ═════════════════════════════
 *
 * Lo que el navegador sabe de las carpetas es **cómo se llaman y en qué orden
 * van**. Lo que NO sabe —y no puede saber, a propósito— es qué correo cae en
 * cada una: ese predicado vive una sola vez, en `server/src/correos/carpetas.ts`,
 * emitido como SQL. La tentación de copiarlo acá es real (permitiría sacar una
 * fila de la lista sin esperar la respuesta) y es exactamente la trampa de #37:
 * dos definiciones de «archivado» divergen mudas, y en una frontera divergir
 * falla hacia ABIERTO — la pantalla muestra en Recibidos algo que el server ya
 * mandó a la papelera.
 *
 * Lo que la pantalla hace en su lugar es más simple y no se puede desincronizar:
 * al archivar, **saca la fila de la lista que tiene en la mano** y deja que el
 * refresco la ponga donde el server diga. No re-evalúa nada.
 *
 * ⚠️ El candado de que esta lista siga diciendo lo mismo que la del server es
 * `rielEnParidad.test.ts`, que lee los dos archivos.
 */

/** Los ids del riel, en el orden en que se dibujan. */
export const RIELES = [
  'recibidos',
  'destacados',
  'pospuestos',
  'enviados',
  'borradores',
  'programados',
  'archivados',
  'papelera',
  'spam',
] as const;

export type Riel = (typeof RIELES)[number];

export interface EntradaDeRiel {
  id: Riel;
  rotulo: string;
  /**
   * Qué dirección manda en el renglón: a quién le escribimos (`para`) o quién nos
   * escribió (`desde`).
   *
   * 🔴 Es lo que evita el defecto de dibujar «escuela@goberna.us» cuarenta veces
   * seguidas en Recibidos — nuestro propio buzón repetido, que es justo el dato
   * que no aporta nada. Vive en el catálogo y no en un `if` de la fila porque la
   * fila se dibuja igual en las nueve listas.
   */
  columna: 'para' | 'desde';
  /** ¿Tiene sentido «Archivar» acá? En Archivados y en la papelera, no. */
  archivable: boolean;
  /**
   * ¿Tiene sentido «Desarchivar» acá? Sólo en Archivados.
   *
   * 🔴 **La acción del server existía desde el principio** (`a-bandeja`, la misma
   * que «Recuperar» de la papelera) y ninguna pantalla la ofrecía: archivar era
   * un viaje de ida, así que quien archivaba por error se quedaba mirando una
   * carpeta sin salida. Es peor que una acción que falta — la capacidad estaba
   * escrita y testeada, y no había cómo llegar a ella.
   *
   * ⚠️ **No es `!archivable`.** En Borradores y Programados los dos son `false`:
   * ahí no se archiva y tampoco hay nada que desarchivar. Derivarlo pondría un
   * «Desarchivar» sobre correos que nunca salieron de la bandeja.
   */
  desarchivable: boolean;
}

export const RIEL: readonly EntradaDeRiel[] = [
  { id: 'recibidos', rotulo: 'Recibidos', columna: 'desde', archivable: true, desarchivable: false },
  { id: 'destacados', rotulo: 'Destacados', columna: 'desde', archivable: true, desarchivable: false },
  { id: 'pospuestos', rotulo: 'Pospuestos', columna: 'desde', archivable: true, desarchivable: false },
  { id: 'enviados', rotulo: 'Enviados', columna: 'para', archivable: true, desarchivable: false },
  { id: 'borradores', rotulo: 'Borradores', columna: 'para', archivable: false, desarchivable: false },
  { id: 'programados', rotulo: 'Programados', columna: 'para', archivable: false, desarchivable: false },
  { id: 'archivados', rotulo: 'Archivados', columna: 'para', archivable: false, desarchivable: true },
  { id: 'papelera', rotulo: 'Papelera', columna: 'para', archivable: false, desarchivable: false },
  { id: 'spam', rotulo: 'Spam', columna: 'desde', archivable: false, desarchivable: false },
] as const;

export function entradaDeRiel(id: Riel): EntradaDeRiel {
  return RIEL.find((r) => r.id === id) ?? RIEL[0]!;
}

export function esRiel(x: unknown): x is Riel {
  return typeof x === 'string' && (RIELES as readonly string[]).includes(x);
}

/**
 * EL NOMBRE QUE SE DIBUJA EN LA COLUMNA DE LA IZQUIERDA.
 *
 * Un `From` de correo viene en dos formas —`Ana Pérez <ana@x.com>` y `ana@x.com`
 * pelado— y la referencia muestra **la persona**, no la dirección: «Anthropic»,
 * «BCP Notificaciones», no `no-reply@…`. Cuando no hay display name se muestra
 * la parte local, que es lo más parecido a un nombre que existe.
 *
 * ⚠️ **Nunca devuelve la cadena vacía.** Un renglón sin nada en la primera
 * columna se lee como una fila rota; con la dirección cruda al menos se puede
 * identificar de quién es. El último recurso es el guion largo.
 */
export function nombreParaMostrar(crudo: string | null | undefined): string {
  const s = (crudo ?? '').trim();
  if (s === '') return '—';

  const conPicos = /^(.*?)<([^>]+)>\s*$/.exec(s);
  if (conPicos) {
    const nombre = conPicos[1]!.trim().replace(/^["']|["']$/g, '').trim();
    if (nombre !== '') return nombre;
    return parteLocal(conPicos[2]!.trim());
  }
  return parteLocal(s);
}

/** `ana.perez@x.com` → `ana.perez`. Sin arroba, la cadena entera. */
function parteLocal(direccion: string): string {
  const corte = direccion.lastIndexOf('@');
  const local = corte === -1 ? direccion : direccion.slice(0, corte);
  return local.trim() === '' ? direccion : local.trim();
}

/**
 * LA DIRECCIÓN pelada, sin el display name. Para el `title` y para comparar.
 *
 * ⚠️ Se usa para preguntarle al CRM «¿de quién es este correo?», así que va en
 * minúsculas: un buzón no distingue mayúsculas y `Ana@X.com` tiene que encontrar
 * al mismo contacto que `ana@x.com`. Es la misma normalización de los dos lados
 * que el `vendedora_id` necesita en el server, acá sobre otra columna.
 */
export function direccionDe(crudo: string | null | undefined): string {
  const s = (crudo ?? '').trim();
  const conPicos = /<([^>]+)>\s*$/.exec(s);
  return (conPicos ? conPicos[1]! : s).trim().toLowerCase();
}

/**
 * LA FECHA DE LA COLUMNA DERECHA — la regla de la referencia, exacta.
 *
 * Hoy → la hora (`9:49 a.m.`). Este año → día y mes (`22 ago`). Más viejo → con
 * año (`4/8/2025`). No es cosmética: en una lista de cuarenta renglones la fecha
 * tiene que ocupar el mismo ancho y contestar «¿es de hoy?» sin leerla entera.
 *
 * ⚠️ **`ahora` entra por parámetro**, como en todo el dominio de este repo
 * (`ventana.ts`, `antiguedad.ts`): sin eso el test tendría que esperar a que
 * cambie el día para poder interrogar la tercera rama.
 */
export function fechaDeLista(fecha: string | Date, ahora: Date = new Date()): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';

  const mismoDia =
    d.getFullYear() === ahora.getFullYear() &&
    d.getMonth() === ahora.getMonth() &&
    d.getDate() === ahora.getDate();

  if (mismoDia) {
    return d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  }
  if (d.getFullYear() === ahora.getFullYear()) {
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/**
 * EL AVANCE DEL CUERPO, limpio para un renglón.
 *
 * ⚠️ **Colapsa los saltos de línea a espacios.** El cuerpo viene con `\n` y en un
 * renglón de una sola línea esos saltos se dibujan como espacios de ancho raro:
 * la referencia muestra el preview corrido, y hacerlo acá es más barato que
 * pelearlo con CSS.
 */
export function avanceLimpio(cuerpo: string | null | undefined): string {
  return (cuerpo ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * ¿ESTE HILO ESTÁ EN VENTANA DE SER RESPONDIDO POR EL LEAD?
 *
 * ⚠️ **NO existe todavía, y este comentario es el recordatorio de por qué.** La
 * pregunta «¿nos contestó?» necesita correo ENTRANTE, y Hermes no lo recibe: el
 * SMTP es Amazon SES, que sólo manda. Cualquier función que hoy conteste esto
 * estaría contestando sobre datos que no existen — o sea, mintiendo con la misma
 * forma con la que el composer prometía una firma que nadie pegaba. Cuando entre
 * la ingesta, va acá.
 */

/** Los estados que puede tener un correo. Espejo del server; el candado los cruza. */
export const ESTADOS = ['recibido', 'borrador', 'programado', 'enviado', 'fallido'] as const;
export type EstadoCorreo = (typeof ESTADOS)[number];
