/**
 * LOS EMOJIS RECIENTES DE ESTA MÁQUINA (ADR 0126).
 *
 * Por último uso y no por frecuencia: lo que se acaba de poner va primero y lo demás se queda
 * donde estaba, en vez de reordenarse solo. Se guarda el emoji tal como entró a la caja, ya con
 * su tono de piel, así lo que se ve en recientes es lo que sale.
 *
 * Un `localStorage` bloqueado (ventana privada, cuota llena) o con basura no es un error del
 * panel: simplemente no hay recientes.
 */
const CLAVE = 'hermes.emojis.recientes';

/** Tres filas de la grilla de 9 columnas. */
const TOPE = 27;

export function leerRecientes(): string[] {
  try {
    const guardados: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(guardados) ? guardados.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}

export function anotarReciente(emoji: string): string[] {
  const recientes = [emoji, ...leerRecientes().filter((e) => e !== emoji)].slice(0, TOPE);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(recientes));
  } catch {
    // Sin dónde guardar: la lista vale para esta apertura del panel y nada más.
  }
  return recientes;
}
