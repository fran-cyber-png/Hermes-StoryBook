import { useEffect, useState } from 'react';
import { api } from '../../lib/datos/cliente';
import { VENTANA_DIAS } from './types';

/**
 * ¿META DEJA ESCRIBIRLE EN PRIVADO A QUIEN COMENTÓ?
 *
 * Se llamaba `QuePuedoHacer.tsx` y dibujaba una lista vertical de tres filas.
 * Esa lista se fusionó con los botones de moderación en las cuatro cards de
 * `AccionesDelComentario` (fase 7 del rediseño, 25-ago-2026), y lo único que
 * sobrevivió fue el PEDIDO — que es lo que este archivo es ahora, y por eso
 * cambió de nombre: un archivo que se llama por una pantalla que ya no existe
 * manda a buscar el dibujo adentro.
 */

export interface Capacidades {
  puedePrivado: boolean;
  motivo: 'ventana-cerrada' | 'privacidad' | 'instagram' | 'error' | null;
  dias?: number;
  /**
   * DE QUIÉN ES LA PÁGINA, para elegir qué textos se sugieren
   * (`dominio/plantillaPublica.ts`). `modulo` es desde dónde responde quien
   * pregunta y `cliente`, el `paginas_meta.cliente_id` de la Página (`null` =
   * sin registrar).
   *
   * ⚠️ **Ausentes significan «no se sabe»**, no «la Escuela»: un pedido que
   * falló o un server viejo dejan la caja pública vacía.
   */
  modulo?: 'ventas' | 'campana';
  cliente?: string | null;
}

/**
 * Lo que llega de la red se lee con desconfianza: un valor que no es uno de los
 * dos módulos, o un cliente que no es texto ni `null`, cuenta como que no vino.
 */
function dePagina(d: { modulo?: unknown; cliente?: unknown }): Pick<Capacidades, 'modulo' | 'cliente'> {
  return {
    modulo: d.modulo === 'ventas' || d.modulo === 'campana' ? d.modulo : undefined,
    cliente: typeof d.cliente === 'string' || d.cliente === null ? d.cliente : undefined,
  };
}


/**
 * ¿SE LE PUEDE ESCRIBIR EN PRIVADO? — el pedido, aparte del dibujo.
 *
 * Se extrae en el rediseño (fase 7): antes vivía adentro del componente que
 * pintaba la lista vertical, así que sacar ese componente de la pantalla se
 * llevaba puesto el pedido — y `puedePrivado` quedaba en `false` para siempre,
 * apagando la caja privada sin que nada fallara. Ahora lo pide quien lo
 * necesita, y el dibujo es otra cosa.
 *
 * ⚠️ **Un fallo declara `motivo: 'error'` y no deja el estado en `null`**: `null`
 * significa «todavía no contestó» y dejaría el esqueleto para siempre.
 */
export function useCapacidades(interactionId: number | undefined): Capacidades | null {
  const [cap, setCap] = useState<Capacidades | null>(null);

  useEffect(() => {
    if (interactionId == null) return;
    setCap(null);
    let vigente = true;
    // Por `api()`: la ruta está detrás del perímetro y necesita el Bearer.
    api<{ puede: boolean; motivo: Capacidades['motivo']; dias?: number; modulo?: unknown; cliente?: unknown }>(
      `/api/persona/${interactionId}/puede-privado`,
    )
      .then((d) => {
        if (vigente) setCap({ puedePrivado: d.puede, motivo: d.motivo, dias: d.dias, ...dePagina(d) });
      })
      .catch(() => {
        if (vigente) setCap({ puedePrivado: false, motivo: 'error' });
      });
    return () => {
      // Cambiar de comentario mientras el anterior viaja: la respuesta vieja no
      // puede pisar la nueva, o la caja privada se apagaría por otro comentario.
      vigente = false;
    };
  }, [interactionId]);

  return cap;
}


/**
 * POR QUÉ NO SE LE PUEDE ESCRIBIR EN PRIVADO — la frase, en UN solo lugar.
 *
 * 🔴 **Se extrae porque ya estaba escrita dos veces y con distinto texto.** La
 * card apagada de `AccionesDelComentario` decía «Esta persona no acepta mensajes
 * de páginas» y el placeholder de la caja privada de `ResponderPanel` decía «Meta
 * no permite escribirle en privado a esta persona» — sobre el MISMO hecho, en la
 * misma pantalla, a diez centímetros de distancia. Es #37: dos lugares diciendo
 * lo mismo divergen, y acá ya habían divergido.
 *
 * ⚠️ **`privacidad` es lo que INFERIMOS, no lo que Meta dice.** Meta contesta
 * `can_reply_privately: false` y no explica por qué; dentro de la ventana de 7
 * días, la causa que se conoce es la configuración de la persona («no recibir
 * mensajes de desconocidos»). Por eso la frase describe el efecto —no acepta
 * mensajes de páginas— y **no promete un ajuste concreto de su teléfono**, que
 * sería afirmar algo que nadie verificó.
 */
export function porQueNoPuedePrivado(cap: Capacidades): string {
  switch (cap.motivo) {
    case 'ventana-cerrada':
      return `Meta lo permite solo ${VENTANA_DIAS} días. Este ya tiene ${cap.dias}.`;
    case 'privacidad':
      return 'Esta persona no acepta mensajes de páginas.';
    case 'instagram':
      return 'En Instagram, Meta lo tiene tras una revisión de app.';
    default:
      // `error` y cualquier motivo que este front todavía no conozca: no se
      // inventa una causa. La lección del bot y de los ✓✓ — un código
      // desconocido muestra lo que hay, nunca una explicación parecida.
      return 'Meta no lo permite en este comentario.';
  }
}
