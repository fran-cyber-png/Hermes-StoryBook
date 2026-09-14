/**
 * 🔴 EL 503 DE «NO PUDIMOS LEER TUS LÍNEAS» — el código con el que el server lo nombra (ADR 0108, #952).
 *
 * Copia de `CODIGO_LINEAS_NO_LEIDAS` (`server/src/cola/lecturaDeLineas.ts`). Está copiada y no
 * importada porque son dos `tsconfig`; lo que impide que se separen es
 * `src/pruebas/lineasNoLeidas.paridad.test.ts`.
 *
 * ── Por qué hay que mirar el CÓDIGO y no el 503 ──
 * Los guards de módulo contestan esta falla delante de todas sus superficies, y tres ya tenían su
 * propio 503: `/api/bot` y `/api/campana` («falta la migración») y `/api/correos` («falta el
 * SMTP»). Leído por el status pelado, un hipo de la base se diagnostica como un paso de sistemas
 * pendiente: un hecho falso, dicho con seguridad.
 *
 * Se mira sin `instanceof ErrorApi` a propósito: así lo usa la lógica pura de una feature
 * (`features/bot/estado.ts`) sin cargar el cliente de datos, igual que las pantallas que ya leían
 * el error como `{ status?: number }`.
 */
export const CODIGO_LINEAS_NO_LEIDAS = 'lineas_no_leidas';

/** ¿Esta falla es la de las líneas que no se pudieron leer? */
export function esLineasNoLeidas(error: unknown): boolean {
  return (error as { codigo?: unknown } | null | undefined)?.codigo === CODIGO_LINEAS_NO_LEIDAS;
}
