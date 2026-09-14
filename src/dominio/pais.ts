/**
 * DE QUÉ PAÍS ES ESTA PERSONA — para la bandera de la cabecera del detalle
 * (dueño, 13-sep-2026: «el país debe salir como bandera»).
 *
 * ══ LA PRECEDENCIA ═══════════════════════════════════════════════════════════
 *
 *   1. **El país que alguien DECLARÓ**: Cerberus al comprar, o el padrón de
 *      icarus. Es un dato.
 *   2. **Si no hay, el que dice el CÓDIGO DEL NÚMERO**, marcado `porNumero`.
 *      Dice dónde se sacó la línea, no dónde vive la persona, y la cabecera lo
 *      avisa al pasar el mouse. Es la decisión del dueño para que la campaña
 *      —que casi nunca tiene un país declarado— también tenga bandera.
 *
 * ⚠️ **Esto no cambia `resumenDelContacto`**: el texto del perfil sigue sin
 * sacar el país del prefijo. Una frase afirma; una bandera con su aviso, no.
 *
 * ══ POR QUÉ HAY UNA COPIA DE LA LISTA DEL SERVER ═════════════════════════════
 *
 * `server/src/telefono/paises.ts` no trae el código ISO que necesita la bandera,
 * y en campaña no hay un perfil del server que lo mande resuelto. La copia se
 * cruza con la del server en `features/panel/pais.paridad.test.ts` (#37): los
 * mismos códigos, largos y nombres. La única diferencia a propósito es el +1,
 * que el server trata como un solo país y acá se parte en tres para poder
 * dibujar una bandera sin adivinar.
 */

export interface PaisConocido {
  /** ISO 3166-1 alfa-2: el nombre de la bandera. */
  iso: string;
  /** Cómo se muestra. */
  nombre: string;
  /** El código telefónico, sin `+`. */
  codigo: string;
  /** Los largos NACIONALES plausibles (sin el código): lo que evita que `502…` se lea como Perú. */
  largos: readonly number[];
  /** Cómo lo escribe la gente en una ficha. Se comparan con `clavePais`. */
  nombres: readonly string[];
  /**
   * 🔴 SÓLO PARA EL +1. El código lo comparten Estados Unidos, Canadá, República
   * Dominicana y una veintena de países más: por el número sólo se reconoce el
   * que tiene códigos de área propios y conocidos.
   */
  areas?: readonly string[];
  /** Un país del +1 sin áreas propias: se reconoce por el nombre declarado, nunca por el número. */
  soloPorNombre?: true;
}

export const PAISES: readonly PaisConocido[] = [
  { iso: 'PE', nombre: 'Perú', codigo: '51', largos: [9], nombres: ['peru', 'pe', 'per'] },
  { iso: 'MX', nombre: 'México', codigo: '52', largos: [10, 11], nombres: ['mexico', 'mejico', 'mx', 'mex'] },
  { iso: 'EC', nombre: 'Ecuador', codigo: '593', largos: [9, 8], nombres: ['ecuador', 'ec', 'ecu'] },
  { iso: 'BO', nombre: 'Bolivia', codigo: '591', largos: [8], nombres: ['bolivia', 'bo', 'bol'] },
  {
    iso: 'DO',
    nombre: 'República Dominicana',
    codigo: '1',
    largos: [10],
    nombres: [
      'republica dominicana', 'rep dominicana', 'rep. dominicana', 'r dominicana', 'r. dominicana', 'dominicana', 'do', 'dom',
    ],
    areas: ['809', '829', '849'],
  },
  { iso: 'US', nombre: 'Estados Unidos', codigo: '1', largos: [10], nombres: ['estados unidos', 'usa', 'us', 'eeuu'], soloPorNombre: true },
  { iso: 'CA', nombre: 'Canadá', codigo: '1', largos: [10], nombres: ['canada'], soloPorNombre: true },
  { iso: 'CO', nombre: 'Colombia', codigo: '57', largos: [10], nombres: ['colombia', 'co', 'col'] },
  { iso: 'GT', nombre: 'Guatemala', codigo: '502', largos: [8], nombres: ['guatemala', 'gt', 'gtm'] },
  { iso: 'PA', nombre: 'Panamá', codigo: '507', largos: [8], nombres: ['panama', 'pa', 'pan'] },
  { iso: 'CL', nombre: 'Chile', codigo: '56', largos: [9], nombres: ['chile', 'cl', 'chl'] },
  { iso: 'AR', nombre: 'Argentina', codigo: '54', largos: [10, 11], nombres: ['argentina', 'ar', 'arg'] },
  { iso: 'VE', nombre: 'Venezuela', codigo: '58', largos: [10], nombres: ['venezuela', 've', 'ven'] },
  { iso: 'SV', nombre: 'El Salvador', codigo: '503', largos: [8], nombres: ['el salvador', 'salvador', 'sv', 'slv'] },
  { iso: 'HN', nombre: 'Honduras', codigo: '504', largos: [8], nombres: ['honduras', 'hn', 'hnd'] },
  { iso: 'NI', nombre: 'Nicaragua', codigo: '505', largos: [8], nombres: ['nicaragua', 'ni', 'nic'] },
  { iso: 'CR', nombre: 'Costa Rica', codigo: '506', largos: [8], nombres: ['costa rica', 'cr', 'cri'] },
  { iso: 'PY', nombre: 'Paraguay', codigo: '595', largos: [9], nombres: ['paraguay', 'py', 'pry'] },
  { iso: 'UY', nombre: 'Uruguay', codigo: '598', largos: [8, 9], nombres: ['uruguay', 'uy', 'ury'] },
  { iso: 'BR', nombre: 'Brasil', codigo: '55', largos: [10, 11], nombres: ['brasil', 'brazil', 'br', 'bra'] },
  { iso: 'ES', nombre: 'España', codigo: '34', largos: [9], nombres: ['espana', 'es', 'esp'] },
];

/** «México » / «MX» / «mexico» son el mismo país escrito por tres personas. La MISMA regla que el server. */
export function clavePais(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const POR_NOMBRE = new Map<string, PaisConocido>(PAISES.flatMap((p) => p.nombres.map((n) => [clavePais(n), p] as const)));

/** Los códigos más largos primero: `502` tiene que ganarle a `5…` antes de que alguien pruebe `50`. */
const POR_LARGO_DE_CODIGO = [...PAISES].sort((a, b) => b.codigo.length - a.codigo.length);

/** El país declarado en una ficha («México», «MX»), o `null` si no se reconoce. */
export function paisDeNombre(nombre: string | null | undefined): PaisConocido | null {
  if (!nombre) return null;
  return POR_NOMBRE.get(clavePais(nombre)) ?? null;
}

/** El país de un número YA con código, si el código y el largo cierran. El +1 sólo si el área es conocida. */
export function paisDelNumero(numero: string): PaisConocido | null {
  const digitos = numero.replace(/\D/g, '');
  for (const pais of POR_LARGO_DE_CODIGO) {
    if (pais.soloPorNombre || !digitos.startsWith(pais.codigo)) continue;
    if (!pais.largos.includes(digitos.length - pais.codigo.length)) continue;
    if (pais.areas && !pais.areas.includes(digitos.slice(pais.codigo.length, pais.codigo.length + 3))) continue;
    return pais;
  }
  return null;
}

export interface PaisDelContacto {
  /** `null` = un país declarado que no está en la lista: se muestra el nombre, sin bandera. */
  iso: string | null;
  nombre: string;
  /** Salió del código del número y no de algo que alguien declaró. */
  porNumero: boolean;
}

export function paisDelContacto(e: { declarado?: string | null; telefono?: string | null }): PaisDelContacto | null {
  const declarado = e.declarado?.trim();
  if (declarado) {
    const pais = paisDeNombre(declarado);
    return pais ? { iso: pais.iso, nombre: pais.nombre, porNumero: false } : { iso: null, nombre: declarado, porNumero: false };
  }
  const digitos = (e.telefono ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  // Nueve dígitos sin código: la cabecera ya lo muestra como +51 (`formatearTelefono`), y la
  // bandera tiene que decir lo mismo que el número que está al lado.
  const pais = paisDelNumero(digitos.length === 9 ? `51${digitos}` : digitos);
  return pais ? { iso: pais.iso, nombre: pais.nombre, porNumero: true } : null;
}
