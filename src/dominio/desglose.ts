/**
 * EL DESGLOSE QUE SIRVE EL SERVER: etapa × ya-le-hablamos × precio × viva, con su
 * conteo. Es la MISMA foto que las tarjetas, contada de una pasada
 * (`server/src/cola/consultarCola.ts`).
 *
 * **Vive en `dominio/` y no en `vistas/tablero.ts`, que es de donde salió.** Lo
 * necesitan las dos puntas: el Pipeline para repartir columnas y `conversaciones.ts`
 * para tipar lo que devuelve la cola. Mientras estaba adentro de la vista, el modelo
 * del front tenía que importar una PANTALLA para tipar su propia respuesta — que es
 * exactamente la inversión de capas que `arquitectura.json` › `capas` prohíbe.
 */
export interface FilaDesglose {
  etapa: string;
  yaLeHablamos: boolean;
  precio: boolean;
  viva: boolean;
  /**
   * La ventana de conversación sigue abierta (server: `cola/ventana.ts`): se le
   * puede escribir texto libre AHORA, sin pagar una plantilla. Opcional porque
   * un server viejo no manda el campo — y ahí el chip no se dibuja, que es como
   * se comportaba antes.
   */
  ventana?: boolean;
  /**
   * «Para seguir» (server: `cola/tiempoEnEtapa.ts`): silencio nuestro + entre 3 y
   * 14 días en la etapa. Opcional por lo mismo que `ventana` — un server viejo no
   * manda el campo, y ahí el chip no se dibuja en vez de prometer un recorte que
   * el server no sabe aplicar.
   */
  paraSeguir?: boolean;
  /**
   * «Se calló con el precio» (server: `cola/tiempoEnEtapa.ts`): había hablado y no
   * volvió a escribir después de recibirlo. Opcional, como los otros dos: sin el
   * campo el chip no se dibuja.
   */
  seCallo?: boolean;
  /**
   * EL SEMÁFORO DEL LEAD (server: `cola/semaforoSql.ts`, #826): cuánto quiere
   * comprar. Opcional por lo mismo que los otros tres — un server sin S.1 no
   * lo manda, y ahí los recortes «Verdes · Ámbar · Grises · Rojos» no se
   * ofrecen (regla del cero: sin el campo, cada conteo da 0).
   */
  luz?: 'gris' | 'verde' | 'ambar' | 'rojo';
  /**
   * NACIÓ HOY — lo cuenta el server contra el `?inicioDeHoy=` que resuelve el
   * navegador (el hoy de la vendedora, no el del server, #421): el primer mensaje
   * de la conversación, entrante o saliente, es de hoy. En «Nunca contestaron» eso
   * es la difusión del día, que es lo que quien supervisa quiere ver ahí.
   * Opcional por lo mismo que los otros cuatro: un server que no lo manda no dice
   * «0 hoy», no dice nada (`vistas/tablero.ts#contarHoy`).
   *
   * 🔴 **No es `escribioHoy`**, el recorte que abre el Dashboard: ése es el primer
   * ENTRANTE de toda la historia (450 un día en que nacieron 1.800). Dos hechos,
   * dos palabras: acá «nuevas», allá «escribieron por primera vez» (#37).
   */
  nacioHoy?: boolean;
  /**
   * DE QUÉ CANAL Y TIPO ES LA FILA — sólo con `?mesaPorCanal=1` (el Pipeline de
   * campaña, 13-sep-2026). Con esa marca el desglose cuenta TODOS los canales del
   * rango puesto, y cada fila dice el suyo: la card de cada columna reparte por
   * canal y la mesa se queda con las del canal elegido (`vistas/canalDeMesa.ts`).
   * Ausentes = un server viejo o un pedido sin la marca, donde el desglose ya
   * viene recortado por el canal pedido.
   */
  canal?: 'whatsapp' | 'facebook' | 'instagram' | 'landing' | (string & {});
  tipo?: 'mensaje' | 'comentario' | 'lead' | (string & {});
  n: number;
}
