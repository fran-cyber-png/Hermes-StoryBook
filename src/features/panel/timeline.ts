import { esCompra, type Ficha } from '../cerberus/ficha';
import type { InteresRegistrado } from '../gestion/lineaDeTiempo';
import type { Senal } from '../senales/senales';
import {
  esMio,
  nombreCortoVendedora,
  rotuloDeTipo,
  type CorreoEnTimeline,
  type EventoContacto,
} from '../eventos/eventos';

export type TipoEvento = 'llegada' | 'identidad' | 'mensaje' | 'interes_detectado'
  | 'interes_registrado' | 'compra' | 'cotizacion' | 'enfriamiento' | 'pendiente'
  /** Lo que una persona registró a mano (`eventos_contacto`). */
  | 'registrado'
  /** Un correo que salió (o no salió) desde Hermes hacia esta persona. */
  | 'correo'
  /** La ficha rápida del contacto (`contacto_ficha`). */
  | 'ficha'
  /** Una promesa de la agenda (`recordatorios`), pasada o futura. */
  | 'seguimiento'
  /** Una llamada de WhatsApp (voip por Cloud API). */
  | 'llamada';

/**
 * ⚠️ **`fallido` es el único que pide UNA ACCIÓN, y por eso rompe el molde.**
 * Los otros cuatro describen de dónde salió el dato; éste describe que algo no
 * pasó. Es el mismo criterio que el ✓✓ del hilo, donde el fallido es lo único
 * que se dibuja distinto (triángulo rojo) en vez de un tilde más.
 */
/**
 * ⚠️ **`senal` no es `ia`.** Antes del destape de #797 nada del timeline salió
 * de un LLM: «Cotización» es una regla sobre el texto saliente
 * (`server/src/senales/cotizacion.ts`), no una inferencia. Rotularla «IA»
 * afirmaba una tecnología que no corrió. `ia` queda reservado para cuando
 * #797 destape la temperatura del bot/LLM de verdad.
 */
export type EstadoEvento = 'confirmado' | 'manual' | 'ia' | 'senal' | 'pendiente' | 'fallido';

export interface EventoLinea {
  /** Estable: sirve de key de React. `${tipo}:${timestamp ?? 'sin-fecha'}:${valor ?? ''}`. */
  id: string;
  tipo: TipoEvento;
  rotulo: string;
  valor?: string;
  fuente?: string;
  timestamp?: string;
  estado: EstadoEvento;
  editable?: boolean;
  /**
   * QUIÉN LO REGISTRÓ, ya en nombre corto («Ventas10»).
   *
   * Hasta ahora el timeline calculaba `fuente` y **no la dibujaba en ningún
   * lado** (verificado por grep: `e.fuente` no aparece en ningún JSX). O sea
   * que la pantalla no decía de dónde salía nada — ni de una máquina, ni de
   * una persona. Esto es lo que hace que un evento sea una afirmación de
   * alguien y no un dato que apareció solo.
   */
  autor?: string;
  /**
   * El id de la fila en `eventos_contacto`, SOLO para los registrados a mano.
   * Es lo que permite editarlo y archivarlo — los derivados no tienen fila.
   */
  eventoId?: number;
  /** ¿Lo escribió quien está mirando? Decide si se dibujan Editar y Borrar. */
  mio?: boolean;
  /** El comentario en criollo, cuando lo hay. Va debajo, en cursiva. */
  comentario?: string;
  /**
   * Qué producto fue — HOY solo lo llena una compra. Va aparte de `valor`
   * (que en una compra es el monto) porque son dos preguntas distintas:
   * cuánto pagó y qué se llevó. Sin este campo, «Compra · 344.00 BOB» no
   * decía qué compró — justo lo que la vendedora necesita para no cotizarle
   * de nuevo lo mismo.
   */
  detalle?: string;
}

export interface GrupoDia {
  etiqueta: string;
  eventos: EventoLinea[];
}

/**
 * El punto del rail y el tag textual del estado. La caja con borde + fondo se
 * fue (V2-2): el timeline no es un collage de cajas, es una fila sobre un rail.
 */
export const COLOR: Record<EstadoEvento, { punto: string; tag: string }> = {
  confirmado: { punto: 'bg-success', tag: '' },
  manual: { punto: 'bg-primary', tag: 'Manual' },
  ia: { punto: 'bg-warning', tag: 'IA' },
  senal: { punto: 'bg-warning', tag: 'Señal' },
  pendiente: { punto: 'border-dashed', tag: 'Pendiente' },
  // Sin oro: acá no corre ningún plazo. El rojo es lo que pide una acción.
  fallido: { punto: 'bg-destructive', tag: 'No salió' },
};

export interface TimelineArmada {
  grupos: GrupoDia[];
}

interface DatosTimeline {
  ficha?: Ficha;
  intereses?: InteresRegistrado[];
  senales?: Senal;
  leadForm?: { campana?: string; fecha?: string };
  conversacion?: { persona_nombre?: string; lead_nombre?: string };
  /**
   * EL NOMBRE QUE EL ENCABEZADO YA TIENE ESCRITO (`identidad.ts` arbitra
   * Cerberus > formulario > alias de WhatsApp, #118).
   *
   * 🔴 Sirve para NO repetirlo. El evento «Nombre identificado» es lo único que
   * el timeline tiene para mostrar en una conversación nueva, y decía
   * literalmente lo mismo que el título de 30 px de arriba: la primera pantalla
   * del panel afirmaba dos veces cómo se llama la persona y ninguna otra cosa.
   *
   * ⚠️ **El evento NO se borra: se calla cuando es redundante.** Cuando el
   * encabezado muestra el nombre de Cerberus y el chat trae otro alias, saber
   * que en WhatsApp se llama distinto SÍ es un dato — y ahí se sigue dibujando.
   * Ausente = nadie lo pasó, y entonces se comporta como siempre.
   */
  nombreMostrado?: string | null;
  /**
   * #887 — EL ALIAS DE WHATSAPP, cuando la cabecera YA lo muestra al lado del
   * nombre real (`identidad.ts` › `alias`). Sin fecha (no hay de dónde
   * sacarla hoy: la conversación no manda «primer mensaje entrante»), este
   * evento vivía para siempre en el grupo «Sin fecha» — el dueño lo pidió
   * como dato de cabecera, no como línea de tiempo sin fecha. Mismo criterio
   * que `nombreMostrado`: ausente = se comporta como siempre.
   */
  aliasMostrado?: string | null;
  /** Lo que las vendedoras registraron a mano (`eventos_contacto`). */
  eventos?: readonly EventoContacto[];
  /**
   * Los correos que salieron hacia esta persona desde Hermes (H7).
   *
   * 🔴 **Van en su propia lista y NO mezclados en `eventos`**, y la razón tiene
   * filo: `eventos_contacto.id` y `correos.id` son dos `bigserial`
   * independientes, así que el evento 7 y el correo 7 existen los dos. Como el
   * timeline cuelga Editar y Borrar de `eventoId`, un correo que llegara con ese
   * campo mostraría los dos botones y tocarlos haría `PATCH`/`DELETE
   * /api/eventos/7` — **archivando el evento manual de otra persona, con un 200 y
   * sin un solo síntoma**. Y además un correo no se edita ni se archiva: pasó.
   */
  correos?: readonly CorreoEnTimeline[];
  /** Quién está mirando — para saber cuáles de esos eventos puede tocar. */
  yo?: string | null;
  /**
   * ¿Esta conversación se atiende SIN Cerberus? (o sea: es del módulo de
   * campaña). Lo mismo que `estadoDelContacto` ya recibía, con el mismo nombre a
   * propósito: es UN hecho, y dos palabras para el mismo hecho terminan en dos
   * respuestas distintas en la misma pantalla (#37).
   */
  sinCerberus?: boolean;
  /**
   * La ficha rápida, si alguien la registró. Estructural a propósito: el
   * timeline no importa el módulo de la ficha para no atarse a su forma.
   */
  fichaLocal?: { creadoAt?: string; vendedoraId?: string } | null;
  /**
   * LOS SEGUIMIENTOS DE ESTA CONVERSACIÓN, incluidos los del futuro.
   *
   * Es el único evento del timeline que puede tener fecha ADELANTE, y eso es
   * justamente lo que se quiere ver: «qué quedé en hacer» es tan parte de la
   * historia comercial como «qué pasó». Se tipa estructuralmente por lo mismo
   * que la ficha.
   */
  seguimientos?: readonly {
    id: number;
    nota: string;
    cuando: string;
    estado: string;
    tipo?: string | null;
  }[];
  /** Llamadas de WhatsApp que el webhook registró (events meta_wa_call). */
  llamadas?: readonly {
    id: string;
    direccion: string;
    estado: string;
    duracion?: number;
    occurredAt: string;
  }[];
}

const idDeEvento = (tipo: TipoEvento, timestamp: string | undefined, valor: string | undefined): string =>
  `${tipo}:${timestamp ?? 'sin-fecha'}:${valor ?? ''}`;

function inicioDeDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function etiquetaDeDia(dia: Date, hoy: Date): string {
  const dias = Math.round((inicioDeDia(hoy).getTime() - inicioDeDia(dia).getTime()) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias > 365) {
    return dia.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dia.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

/**
 * Cronología real: orden por fecha (desc), nunca por fuente. Los eventos sin
 * timestamp van al final, en su propio grupo «Sin fecha» — no se les inventa
 * un día ni se los descarta.
 */
function agruparPorDia(eventos: EventoLinea[], hoy: Date): GrupoDia[] {
  const ordenados = [...eventos].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : NaN;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });

  const grupos: GrupoDia[] = [];
  const indice = new Map<string, GrupoDia>();
  for (const e of ordenados) {
    const ts = e.timestamp ? new Date(e.timestamp) : null;
    const valido = ts !== null && !Number.isNaN(ts.getTime());
    const clave = valido ? ts.toDateString() : 'sin-fecha';
    let grupo = indice.get(clave);
    if (!grupo) {
      grupo = { etiqueta: valido ? etiquetaDeDia(ts!, hoy) : 'Sin fecha', eventos: [] };
      indice.set(clave, grupo);
      grupos.push(grupo);
    }
    grupo.eventos.push(e);
  }
  return grupos;
}

export function ensamblarTimeline(
  datos: DatosTimeline,
  ahora: () => Date = () => new Date(),
): TimelineArmada {
  const eventos: EventoLinea[] = [];

  if (datos.ficha?.estado === 'cliente') {
    const ventas = [...datos.ficha.ventas];
    ventas.sort((a, b) => {
      const ta = new Date(a.fecha).getTime();
      const tb = new Date(b.fecha).getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
    for (const venta of ventas) {
      const valor = `${venta.monto} ${venta.moneda}`;
      /**
       * 🔴 #1033 — SÓLO UNA COMPRA SE ROTULA «COMPRA». Cerberus manda por el
       * mismo webhook cotizaciones, anuladas y reembolsos, y todas salían como
       * «Compra» (el tile «Última actividad» lo decía de una cotización). Qué es
       * compra lo decide el server (`esCompra`); una cotización es actividad y
       * sale como tal, y lo demás —anulada, retiro, reembolso— no es algo que
       * pasó con la persona: se ve en la pestaña Compras, marcado.
       */
      const compra = esCompra(venta);
      const cotizacion = !compra && /cotiz/i.test(venta.estado);
      if (!compra && !cotizacion) continue;
      eventos.push({
        id: idDeEvento(compra ? 'compra' : 'cotizacion', venta.fecha || undefined, valor),
        tipo: compra ? 'compra' : 'cotizacion',
        rotulo: compra ? 'Compra' : 'Cotización',
        valor,
        fuente: 'Cerberus',
        timestamp: venta.fecha || undefined,
        estado: 'confirmado',
        detalle: venta.productos.length > 0 ? venta.productos.join(' · ') : undefined,
      });
    }
  }

  if (datos.leadForm?.campana) {
    const valor = datos.leadForm.campana;
    eventos.push({
      id: idDeEvento('llegada', datos.leadForm.fecha, valor),
      tipo: 'llegada',
      rotulo: 'Llegada',
      valor,
      fuente: 'Meta Ads',
      timestamp: datos.leadForm.fecha,
      estado: 'confirmado',
    });
  }

  // #1033 — un nombre tiene que NOMBRAR: «.» o «🦋🦋» no identifican a nadie (la
  // Actividad de un cliente decía «Nombre identificado .»). La misma regla que
  // `nombreDelContacto` aplica a la cabecera.
  const nombraAlguien = (s: string | undefined) => /[\p{L}\p{N}]/u.test(s ?? '');
  const nombreDelChat = nombraAlguien(datos.conversacion?.persona_nombre) ? datos.conversacion?.persona_nombre : undefined;
  const nombreDelForm = nombraAlguien(datos.conversacion?.lead_nombre) ? datos.conversacion?.lead_nombre : undefined;
  if (nombreDelChat || nombreDelForm) {
    const nombre = nombreDelChat ?? nombreDelForm ?? '';
    const fuente = nombreDelChat ? 'WhatsApp' : 'Formulario';
    // Se compara normalizando los DOS lados, como todo lo que compara nombres en
    // este repo: con «Karen Tarazona» vs «karen tarazona » la comparación exacta
    // no da error, da que el renglón redundante se sigue dibujando.
    const yaEstaArriba =
      nombre.trim().toLowerCase() === (datos.nombreMostrado ?? '').trim().toLowerCase() ||
      nombre.trim().toLowerCase() === (datos.aliasMostrado ?? '').trim().toLowerCase();
    if (!yaEstaArriba) eventos.push({
      id: idDeEvento('identidad', undefined, nombre),
      tipo: 'identidad',
      rotulo: 'Nombre identificado',
      valor: nombre,
      fuente,
      estado: 'confirmado',
    });
  }

  for (const i of datos.intereses ?? []) {
    eventos.push({
      id: idDeEvento('interes_registrado', i.creadoAt ?? undefined, i.curso),
      tipo: 'interes_registrado',
      rotulo: 'Interés registrado',
      valor: i.curso,
      timestamp: i.creadoAt ?? undefined,
      estado: 'manual',
      fuente: 'Vendedora',
    });
  }

  /**
   * LO QUE UNA PERSONA REGISTRÓ A MANO.
   *
   * Va con `estado: 'manual'` (el punto azul del rail) y, a diferencia de todo
   * lo demás, con AUTOR: es una afirmación de alguien, no algo que se dedujo.
   *
   * Un `tipo` que este build no conoce se muestra tal cual (`rotuloDeTipo`),
   * nunca como otro tipo y nunca con un throw — el vocabulario crece del lado
   * del server y los dos se despliegan por separado (N4 va solo, N5 es un
   * botón). El id de React lleva el id de la fila, que es lo único realmente
   * único: dos eventos del mismo tipo en el mismo segundo son posibles.
   */
  for (const ev of datos.eventos ?? []) {
    eventos.push({
      id: `registrado:${ev.id}`,
      tipo: 'registrado',
      rotulo: rotuloDeTipo(ev.tipo),
      valor: ev.curso ?? undefined,
      comentario: ev.nota ?? undefined,
      timestamp: ev.creadoAt,
      estado: 'manual',
      editable: true,
      autor: nombreCortoVendedora(ev.vendedoraId),
      eventoId: ev.id,
      mio: esMio(ev, datos.yo),
    });
  }

  /**
   * LOS CORREOS (H7) — «¿ya le escribimos por mail?».
   *
   * 🔴 **La columna `correos.clave` existía desde el 21-jul-2026 y no la leía
   * NADIE.** El front no la mandaba, el server no la consultaba y las tres filas
   * de producción la tenían en NULL: la intención estaba escrita en el schema y
   * el dato nunca existió. El caso concreto que eso costaba: una vendedora abre
   * la conversación de un lead al que OTRA le mandó la cotización por correo
   * ayer, el timeline muestra los mensajes de WhatsApp y del correo no hay una
   * sola línea — y le vuelve a mandar un precio, o peor, otro.
   *
   * ⚠️ **El fallido se dibuja, y se dibuja DISTINTO.** Es el caso que más le
   * importa a quien mira («le escribí y no salió»): esconderlo deja el mismo
   * agujero de H7 con otra forma, y pintarlo igual que un enviado es peor, porque
   * afirma lo contrario de lo que pasó.
   *
   * ⚠️ **Un `estado` que este build no conoce se trata como enviado, nunca se
   * descarta.** La columna es `text` y el vocabulario puede crecer del lado del
   * server (N4 va solo, N5 es un botón). Descartar escondería justo el correo
   * raro, que es el que hay que mirar; y afirmarlo como fallido sería inventar un
   * fracaso. Sólo el `'fallido'` explícito rompe el molde.
   *
   * ⚠️ **Sin `eventoId` y sin `editable`**: un correo no se edita ni se archiva
   * —pasó— y ese campo es lo que dibuja Editar y Borrar contra `/api/eventos/:id`,
   * que es OTRA tabla con otros ids. Ver el docblock de `correos` en `DatosTimeline`.
   */
  for (const c of datos.correos ?? []) {
    const fallado = c.estado === 'fallido';
    eventos.push({
      id: `correo:${c.id}`,
      tipo: 'correo',
      rotulo: fallado ? 'Correo que no salió' : 'Correo enviado',
      valor: c.asunto || undefined,
      // El destinatario va en el comentario y no en `valor` porque lo que se lee
      // de un vistazo es DE QUÉ era el correo; a quién ya lo dice la conversación.
      comentario: fallado && c.motivo ? `a ${c.para} · ${c.motivo}` : `a ${c.para}`,
      timestamp: c.creadoAt,
      estado: fallado ? 'fallido' : 'confirmado',
      // El nombre corto sale de la MISMA función que usan los eventos vecinos: el
      // server manda el id crudo justo para que las dos filas de la misma columna
      // no se acorten con dos reglas distintas (`luz.perez` → «Luz» vs «Luz.perez»).
      autor: nombreCortoVendedora(c.vendedoraId),
    });
  }

  /**
   * LA FICHA DEL CONTACTO, cuando alguien la registró. Es un hecho de la
   * vendedora —por eso `manual` y con autor— y va con la fecha de creación, no
   * la de la última edición: el timeline cuenta cuándo pasó algo, y lo que pasó
   * fue que esta persona dejó de ser un número suelto.
   */
  if (datos.fichaLocal) {
    eventos.push({
      id: idDeEvento('ficha', datos.fichaLocal.creadoAt, undefined),
      tipo: 'ficha',
      rotulo: 'Contacto registrado',
      timestamp: datos.fichaLocal.creadoAt,
      estado: 'manual',
      autor: datos.fichaLocal.vendedoraId ? nombreCortoVendedora(datos.fichaLocal.vendedoraId) : undefined,
    });
  }

  /**
   * LAS PROMESAS. El rótulo dice en qué terminó cada una —agendada, cumplida o
   * cancelada— porque las tres son historias distintas: «quedó en llamarla y la
   * llamó» y «quedó en llamarla y lo canceló» no se pueden leer igual.
   *
   * Lo pendiente va con `estado: 'pendiente'` (el punto hueco del rail): es lo
   * único del timeline que todavía no pasó.
   */
  for (const s of datos.seguimientos ?? []) {
    eventos.push({
      id: `seguimiento:${s.id}`,
      tipo: 'seguimiento',
      rotulo:
        s.estado === 'hecho'
          ? 'Seguimiento cumplido'
          : s.estado === 'cancelado'
            ? 'Seguimiento cancelado'
            : 'Seguimiento agendado',
      valor: s.nota,
      timestamp: s.cuando,
      estado: s.estado === 'pendiente' ? 'pendiente' : 'manual',
      fuente: 'Agenda',
    });
  }

  /**
   * LLAMADAS DE WHATSAPP — VoIP por Cloud API.
   *
   * Cada llamada registrada por el webhook (`meta_wa_call`) se muestra como un
   * evento en el timeline. El rótulo dice si fue entrante o saliente, y la
   * duración si la hubo.
   */
  for (const l of datos.llamadas ?? []) {
    const dir = l.direccion === 'inbound' ? 'entrante' : 'saliente';
    const duracion = l.duracion != null && l.duracion > 0 ? ` · ${Math.round(l.duracion / 60)}m${l.duracion % 60}s` : '';
    eventos.push({
      id: `llamada:${l.id}`,
      tipo: 'llamada',
      rotulo: `Llamada ${dir}`,
      valor: l.estado !== 'connected' && l.estado !== 'completed' ? l.estado : undefined,
      comentario: duracion || undefined,
      timestamp: l.occurredAt,
      estado: l.estado === 'connected' || l.estado === 'completed' ? 'confirmado' : 'fallido',
    });
  }

  if (datos.senales?.enfriamiento?.enfriada) {
    const dias = datos.senales.enfriamiento.diasDeSilencio;
    eventos.push({
      id: idDeEvento('enfriamiento', undefined, dias != null ? `${dias} días` : undefined),
      tipo: 'enfriamiento',
      rotulo: 'Enfriamiento',
      valor: dias != null ? `${dias} días` : undefined,
      estado: 'ia',
    });
  }

  if (datos.senales?.cotizacion?.esCotizacion) {
    const ocurrida = datos.senales.cotizacion.ocurridoEn;
    eventos.push({
      id: idDeEvento('cotizacion', ocurrida, undefined),
      tipo: 'cotizacion',
      rotulo: 'Cotización',
      timestamp: ocurrida,
      estado: 'senal',
      fuente: 'Señal automática',
    });
  }

  /**
   * ══ ACÁ VIVÍA «POR COMPLETAR», Y SE RETIRÓ EL 24-AGO-2026 ═════════════════
   *
   * 🔴 **No se movió de lugar: era inerte.** La lista pedía «Nombre completo» e
   * «Interés específico» y llevaba un porcentaje. Medido llamando a esta misma
   * función con las dos cosas completas: la lista salía IGUAL y el porcentaje
   * en **0 %**. Los dos números estaban desconectados de lo que pedían —
   * `pendientes` se derivaba sólo de `ficha.estado !== 'cliente'`, y `progreso`
   * contaba únicamente eventos `confirmado`, mientras que llenar la ficha o
   * registrar un interés emite eventos `manual`.
   *
   * ADR 0080 ya había sacado esta lista de campaña por eso mismo («un indicador
   * de avance que no avanza enseña a no mirarlo») y había dejado viva la mitad
   * de ventas. Lo que la reemplaza es la tarjeta de identidad de `panel/EncabezadoTimeline.tsx`, que dibuja los mismos
   * campos con su VALOR cuando existe, con la forma del hueco cuando no, y con
   * el botón que los llena.
   *
   * ⚠️ Por eso `TimelineArmada` ya no lleva `pendientes` ni `progreso`: dejarlos
   * calculados y sin lector es exactamente el patrón de componente huérfano que
   * este panel ya coleccionó tres veces.
   */
  return { grupos: agruparPorDia(eventos, ahora()) };
}
