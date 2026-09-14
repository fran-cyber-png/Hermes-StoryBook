import { api } from '../../lib/datos/cliente';

/**
 * LA VARITA, DEL LADO DEL NAVEGADOR — pedirle al bot qué contestar.
 *
 * ── Qué NO decide este archivo ───────────────────────────────────────────
 *
 * Si el texto salió tal cual o corregido lo decide el SERVER, comparando. Acá
 * solo se reporta QUÉ se mandó. La tentación de calcular `editada` en el front
 * —está el texto original a mano, es una línea— es justo la que hace que la
 * regla viva en dos lados: el día que uno recorte espacios y el otro no, la
 * mitad de las correcciones se cuentan como aciertos y el bot parece mejor de
 * lo que es. Ver `server/src/bot/varita.ts`.
 */

export interface SugerenciaDelBot {
  id: number;
  /** `null` cuando el bot no tuvo nada que decir; entonces `motivo` explica por qué. */
  texto: string | null;
  motivo: string | null;
}

/** Lo que está en la caja porque lo puso el bot, no la vendedora. */
export interface VaritaActiva {
  id: number;
  textoBot: string;
}

export async function pedirSugerencia(clave: string): Promise<SugerenciaDelBot> {
  return await api<SugerenciaDelBot>('/api/bot/redactar', {
    method: 'POST',
    body: JSON.stringify({ clave }),
  });
}

/**
 * Cierra el ciclo: qué se mandó de verdad. `null` es «no se mandó nada».
 *
 * **No propaga el error a propósito.** Esto corre DESPUÉS de que el mensaje ya
 * salió: si el reporte falla, el mensaje igual llegó, y hacer explotar el envío
 * por no poder anotar una estadística sería cambiar un dato perdido por un
 * susto de la vendedora. Queda en el log y la fila se queda `pendiente`, que es
 * un estado previsto.
 */
export async function reportarDesenlace(id: number, textoFinal: string | null): Promise<void> {
  try {
    await api(`/api/bot/sugerencias/${id}`, {
      method: 'POST',
      body: JSON.stringify({ textoFinal }),
    });
  } catch (err) {
    console.warn('[varita] no se pudo reportar el desenlace', err);
  }
}

/**
 * QUÉ DICE EL BOTÓN CUANDO NO HAY TEXTO.
 *
 * El motor tiene motivos legítimos para no proponer nada (nadie escribió
 * todavía, el pipeline saltó, faltan credenciales) y todos llegan como una
 * cadena escrita para un log. Sin esta traducción la vendedora ve la jerga del
 * pipeline —«el pipeline cortó antes de producir una respuesta»— y concluye que
 * la app está rota.
 */
export function avisoDeVarita(motivo: string | null): string {
  if (!motivo) return 'El bot no tuvo nada que sugerir.';
  if (/ningún mensaje del lead/i.test(motivo)) return 'Todavía no hay nada que responder acá.';
  if (/falta_config|credenciales/i.test(motivo)) return 'El bot no está configurado en este entorno.';
  if (/motor falló/i.test(motivo)) return 'El bot no pudo responder ahora. Prueba de nuevo.';
  // Los motivos de salto del pipeline (`bot/decision.ts`). Cada uno dice qué
  // pasó de verdad: el genérico de abajo suena a que el bot lo pensó y decidió
  // callarse, y eso mandaba a buscar el problema al lado equivocado.
  if (/^apagado$/i.test(motivo)) return 'El bot está apagado en esta línea.';
  if (/linea_no_habilitada/i.test(motivo)) return 'El bot no está habilitado en esta línea.';
  // `sin_perfil` salta cuando el perfil de la línea y su propósito en la base no
  // coinciden, en las dos direcciones: decir «no tiene perfil» mentiría en una.
  if (/sin_perfil/i.test(motivo)) return 'El perfil del bot no coincide con la configuración de esta línea.';
  // `sin_cliente`: una línea de campaña sin cliente en la base no lee las respuestas
  // rápidas de nadie (#951). Se arregla asignándole el cliente, no esperando.
  if (/sin_cliente/i.test(motivo)) return 'Esta línea de campaña todavía no tiene cliente asignado.';
  if (/^frenado$/i.test(motivo)) return 'El bot está frenado ahora mismo.';
  if (/^pausado$/i.test(motivo)) return 'Esta conversación está pausada para el bot.';
  if (/vendedora_activa/i.test(motivo)) return 'Ya hay una respuesta tuya después del último mensaje.';
  if (/^spam$/i.test(motivo)) return 'El último mensaje repite el anterior.';
  if (/tope_turnos|tope_linea/i.test(motivo)) return 'Se llegó al tope de turnos del bot por hoy.';
  if (/desconectado/i.test(motivo)) return 'La línea no está conectada.';
  if (/sin_texto_entrante|entrante_sin_texto/i.test(motivo))
    return 'El último mensaje no trae texto que el bot pueda leer.';
  return 'El bot prefirió no sugerir nada en esta conversación.';
}
