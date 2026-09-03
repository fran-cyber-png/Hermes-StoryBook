import type { Temperature } from '../leads/temperature';

/**
 * CUÁNTO HACE QUE ENTRÓ AL PADRÓN — misma paleta que `leads/temperature.ts`,
 * umbrales propios.
 *
 * ── Por qué no se reusa `temperatureOf` tal cual ──
 * Esa función mide la ventana de respuesta de un lead EN COLA: sus cortes son
 * 1/3/14 DÍAS porque a las pocas horas ya importa si se contestó o no. El
 * padrón es lo contrario — contactos que nunca escribieron, algunos de hace
 * AÑOS (`crm_import` trae historia vieja) — y con los cortes de horas, el 99 %
 * saldría «helado» el primer día: la señal no distinguiría nada.
 *
 * Se reusa el TIPO `Temperature` y su paleta de colores (mismo significado:
 * cuánto hace que se puede seguir esperando) para no inventar un cuarto
 * vocabulario de color en el repo — pero NO el texto («A tiempo», «Perdido»):
 * esos hablan de una respuesta que se está demorando, y acá nadie le debe una
 * respuesta a nadie todavía.
 *
 * ── Por qué esto SÍ usa oro y `dominio/antiguedad.ts` (el tiempo en una etapa
 * del Pipeline) explícitamente NO ──
 * `antiguedad.ts` mide una conversación que YA se está trabajando: no hay
 * ningún plazo corriendo, así que el oro ahí significaría «vieja» y le sacaría
 * el significado al oro donde sí hace falta (la ventana de WhatsApp). Acá es
 * al revés: un contacto recién entrado SÍ tiene más chance de convertir cuanto
 * antes se lo trabaje — es el mismo argumento de `leads/temperature.ts`
 * («cada día que espera baja su probabilidad»), no el de `antiguedad.ts`.
 *
 * ⚠️ **LOS CORTES SON PROVISIONALES.** Nadie midió todavía el histograma real
 * de antigüedad de `icarus.contacts` — 7/30/180 días es una propuesta de FORMA
 * para poder mostrar la idea, no una medición. Pedido a Estephano; cuando
 * llegue, se ajusta acá y en ningún otro lado.
 *
 * 🔴 **Y el dato que la alimenta miente, medido el 24-ago-2026: `created_at` es
 * cuándo se IMPORTÓ la fila, no cuándo llegó el lead.** Contra la fecha
 * original del formulario, el 70 % de lo que `created_at` fecha en 2026 es en
 * realidad de 2025 o antes. Hoy esta función pinta de «fresco» leads que
 * tienen más de un año — la señal (la idea de una rampa) está bien, el insumo
 * no. Hay un PR del lado de datos en camino para recuperar la fecha real de
 * ~19.000 contactos; NO se saca la rampa mientras tanto (sigue siendo mejor
 * que nada, y el día que la fecha se corrija esto empieza a decir la verdad
 * solo, sin tocar una línea acá) — pero no se vende como algo que ya funciona
 * bien hasta que ese PR entre.
 */
export const UMBRAL_ENTRADA_DIAS = { tibio: 7, frio: 30, helado: 180 } as const;

/** `null` sin fecha o con una fecha que no se puede leer — nunca una antigüedad inventada. */
export function temperaturaDeEntrada(creadoEn: string | null | undefined, ahora: Date): Temperature | null {
  if (!creadoEn) return null;
  const entrada = new Date(creadoEn).getTime();
  if (Number.isNaN(entrada)) return null;

  const dias = (ahora.getTime() - entrada) / 86_400_000;
  if (dias < UMBRAL_ENTRADA_DIAS.tibio) return 'fresco';
  if (dias < UMBRAL_ENTRADA_DIAS.frio) return 'tibio';
  if (dias < UMBRAL_ENTRADA_DIAS.helado) return 'frio';
  return 'helado';
}
