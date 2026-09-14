export function insertarEnCursor(texto: string, desde: number, hasta: number, pedazo: string) {
  return { texto: texto.slice(0, desde) + pedazo + texto.slice(hasta), cursor: desde + pedazo.length };
}
