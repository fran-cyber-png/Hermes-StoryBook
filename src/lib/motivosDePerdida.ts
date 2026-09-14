/**
 * LOS MOTIVOS DE PÉRDIDA, DEL LADO DEL FRONT (ADR 0107).
 *
 * Espejo de `server/src/gestiones/motivosDePerdida.ts`, que es quien la hace cumplir. Acá
 * vive la copia para dibujarla y sus rótulos; la paridad está en
 * `motivosDePerdida.paridad.test.ts`. Agregar un motivo es tocar los DOS archivos: si uno
 * queda atrás, ese test se pone rojo.
 *
 * El motivo no se infiere de nada: lo declara una persona al decir «Dijo que no», porque
 * en este negocio la gente se calla (0 perdidos declarados en ventas en toda la historia).
 */

export const MOTIVOS_DE_PERDIDA = ['precio', 'horario_o_fecha', 'compro_en_otro_lado', 'sin_interes', 'no_contesta', 'otro'] as const;

export type MotivoDePerdida = (typeof MOTIVOS_DE_PERDIDA)[number];

/** El detalle es una frase que se lee junto al chip, no una nota. */
export const TOPE_DETALLE_PERDIDA = 280;

/** Cómo se lee cada motivo: en la barra, junto al chip de la ficha y en «El negocio». */
export const MOTIVO_DE_PERDIDA_ROTULO: Record<MotivoDePerdida, string> = {
  precio: 'Precio',
  horario_o_fecha: 'Horario o fecha',
  compro_en_otro_lado: 'Compró en otro lado',
  sin_interes: 'Ya no le interesa',
  no_contesta: 'No contesta',
  otro: 'Otro',
};

export function esMotivoDePerdida(x: unknown): x is MotivoDePerdida {
  return typeof x === 'string' && (MOTIVOS_DE_PERDIDA as readonly string[]).includes(x);
}

/**
 * Cómo se lee un motivo que llega del server. `null` es una perdida de antes de que se
 * pidiera; uno que este build no conoce se muestra crudo, como una etapa nueva (ADR 0049):
 * el vocabulario crece del lado del server y los dos se despliegan por separado.
 */
export function rotuloDelMotivo(motivo: string | null): string {
  if (motivo === null) return 'Sin motivo';
  return esMotivoDePerdida(motivo) ? MOTIVO_DE_PERDIDA_ROTULO[motivo] : motivo;
}
