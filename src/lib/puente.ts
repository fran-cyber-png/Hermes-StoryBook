/**
 * EL PUENTE — cómo una vista le pasa el mando a otra sin router (ADR 0002).
 *
 * App.tsx guarda un único `puente` y la vista destino lo consume como prop
 * inicial, limpiándolo al usarlo. Sin API nueva: es estado local del shell.
 */

/**
 * A QUIÉN SE LE ESCRIBE, Y DESDE QUÉ CONVERSACIÓN.
 *
 * 🔴 **`clave` NO ES DECORACIÓN: es la columna que `correos` tiene desde el
 * 21-jul-2026 y que NUNCA se llenó.** Las 3 filas que hay en producción la
 * tienen `NULL`, y el motivo es exactamente éste: el front mandaba
 * `{para, asunto, cuerpo}` y nada más. La columna existía, la intención estaba
 * escrita en el schema, y el dato no existió nunca.
 *
 * Lo que cuesta que falte no se ve en la pantalla de Correos —el correo sale
 * igual—: se ve en todo lo demás. Sin `clave`, ese correo **no aparece en el
 * timeline del contacto** (ADR 0037), **no entra en ninguna medición** de qué
 * se le mandó a quién (ADR 0022) y **no se cruza con la venta** (`atribucion/`).
 * O sea que el canal escribe y el CRM no se entera.
 *
 * ⚠️ **`clave` es opcional a propósito y no puede dejar de serlo**: se puede
 * escribir un correo desde la vista Correos a secas, sin conversación de
 * origen. Lo que no puede pasar es que el puente la TENGA y no la mande.
 * `nombre` es solo para saludar en la pantalla; nunca viaja al server como
 * identidad.
 */
export type DestinoCorreo = { para: string; clave?: string; nombre?: string };

/**
 * CON QUÉ RECORTE EL DASHBOARD LE ABRE EL PIPELINE (pestaña «Hoy», ADR 0104).
 *
 * La regla que parte las dos pantallas: **lo que se TRABAJA está en el Pipeline;
 * lo que se MIDE está en el Dashboard**. Por eso cada cifra de «Hoy» es un enlace:
 * una cifra que no se puede abrir no le sirve a nadie para decidir qué hacer.
 *
 * 🔴 **UN solo recorte, no banderas combinables.** El Pipeline aplica un eje por vez
 * y el server acepta UN recorte por columna (`cola/columnasPedidas.ts` responde 400
 * con dos): con tres opcionales sueltos se podrían mandar combinaciones que la
 * pantalla no sabe dibujar ni apagar.
 *
 * ⚠️ `escribioHoy` y `sinRespuesta24h` se llaman igual que los recortes de columna
 * del server (`?columnas=`), y las dos reglas viven en `server/src/cola/predicadosDeHoy.ts`.
 * Hasta que el tablero los publique, el Pipeline recibe el puente y avisa que todavía
 * no puede aplicarlos: nunca los ignora en silencio.
 *
 * 🔴 **`escribioHoy` NO es «nació hoy».** «Nació» cuenta también nuestra difusión
 * (1.800 conversaciones el 9-sep-2026, 1.240 de ellas nunca contestaron); «escribió
 * por primera vez» cuenta a quien levantó la mano (450 ese día). El Pipeline dice
 * «N nuevas hoy» con la primera; el Dashboard, «escribieron por primera vez» con la
 * segunda.
 */
export type RecorteDelPipeline =
  | { luz: 'verde' | 'ambar' | 'gris' | 'rojo' }
  | { escribioHoy: true }
  | { sinRespuesta24h: true };

export type Puente =
  | { tipo: 'chat'; telefono: string } // → Mensajes: abre (o crea) el chat con ese número
  | { tipo: 'persona'; telefono: string } // → Contactos: busca la ficha
  | { tipo: 'correo'; para: string; clave?: string; nombre?: string } // → Correos: prellena el Para y ata el correo a su conversación
  | { tipo: 'agenda'; telefono: string | null; nota?: string } // → Agenda: abre Crear precargado (p. ej. bienvenida post-venta)
  | {
      tipo: 'pipeline'; // → Pipeline: abre con un recorte («Hoy» del Dashboard)
      recorte?: RecorteDelPipeline;
      /**
       * A QUIÉN — es alcance, no recorte, y por eso va aparte. `null` = sin asignar;
       * ausente = todas. Mismo nombre que `asignada_a` de la fila, y se compara
       * normalizando los dos lados (candado 4: `Luz` y `luz` son la misma persona).
       */
      asignadaA?: string | null;
      /** POR DÓNDE — el número propio. Ausente = todas las líneas. */
      linea?: string;
      /**
       * POR QUÉ CANAL, para lo que NO entró por ninguna línea: un DM de Messenger o
       * de Instagram no tiene número propio, así que `linea` no lo puede nombrar y
       * sin esto su cifra no se podría abrir (259 DMs sin respuesta > 24 h el
       * 9-sep-2026). Es el recorte `?canal=` que la cola ya sabe hacer. Nunca va
       * junto con `linea`.
       */
      canal?: 'facebook' | 'instagram';
    };
