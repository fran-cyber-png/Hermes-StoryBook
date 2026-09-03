/**
 * EL CONTRATO DE CORREOS, DEL LADO DEL NAVEGADOR — copia del server, y ninguna
 * de las dos mitades es la fuente de verdad de la otra.
 *
 * ══ POR QUÉ CASI TODO ES OPCIONAL ═══════════════════════════════════════════
 *
 * 🔴 **El front y el server NO se despliegan juntos, y la ventana entre los dos
 * dura horas.** El front sale por **N4** (automático, sin restart, apenas pasa
 * staging) y el server por **N5**, que es un botón que aprieta una persona. O sea
 * que existe —siempre, en cada PR que toca las dos mitades— un rato en que la app
 * NUEVA le está hablando al server VIEJO. Y hay un segundo camino para lo mismo
 * que no depende del deploy: el caché de consultas se persiste en IndexedDB
 * (ADR 0007) y se rehidrata antes del primer render, así que una respuesta de ayer
 * —guardada por una versión anterior de la app— se lee como si acabara de llegar.
 *
 * Por eso **el tipo dice la verdad sobre lo que puede faltar** en vez de mentir
 * con campos requeridos que el consumidor va a completar con un `??` a mano. Un
 * `supervisor: boolean` requerido no evita el `undefined`: lo esconde, y el
 * `if (estado.supervisor)` de la pantalla se lee como si nunca pudiera fallar.
 * Con `supervisor?: boolean`, TypeScript obliga a decidir qué se hace mientras
 * no se sabe — que es la pregunta que importa.
 *
 * ⚠️ **El default de cada campo ausente NO es siempre `false`, y por eso no vive
 * acá sino en cada consumidor**: `remitentes ?? []` (no hay ninguno que mostrar) y
 * `supervisor ?? false` (fail-closed: no se dibuja una pantalla de administración
 * sobre una duda) van para un lado, pero el precedente exacto de que a veces va al
 * revés es `soloMisAsignadas ?? true` en `VistaDashboard.tsx:221` — ahí el `false`
 * por default le habría escondido «El negocio» a TODAS durante la ventana N4↔N5.
 *
 * ══ LO QUE **NO** ESTÁ ACÁ, A PROPÓSITO ═════════════════════════════════════
 *
 * 🔴 **`CorreoEnLista` no lleva `cuerpo`.** `GET /api/correos` servía el cuerpo
 * COMPLETO de todos los correos del equipo en cada carga de la vista: el texto que
 * Sindy le escribió a un lead viajaba al navegador de las otras ocho sin que nadie
 * lo pidiera ni lo mostrara. Ahora el cuerpo se PIDE, de a uno, por
 * `GET /api/correos/:id` (`CorreoCompleto`). Que sean dos tipos y no uno con
 * `cuerpo?: string` es deliberado: con el campo opcional, la lista y el detalle se
 * vuelven el mismo tipo y nada impide que mañana alguien lo emita de nuevo en la
 * lista «total ya está en el tipo».
 */

/**
 * Un remitente tal como lo ve una vendedora: lo que hace falta para DIBUJAR el
 * sobre antes de mandar.
 *
 * 🔴 Es lo que vuelve verdadera la promesa vieja de la pantalla. El pie del
 * composer decía «con tu nombre» y el `From` era `Escuela Goberna
 * <escuela@goberna.us>` para las nueve; el placeholder decía «con tu firma de
 * siempre» y no había una sola línea de código que agregara una firma. Con estos
 * campos la pantalla puede **mostrar** con qué nombre sale y a dónde vuelven las
 * respuestas, en vez de prometerlo — ver `resumenDelSobre` en `correos.ts`.
 */
/**
 * ⚠️ Sale de `dominio/correo.ts` y no se redeclara acá: ese archivo es el que el
 * candado de paridad cruza contra el catálogo del server (`rielEnParidad.test.ts`).
 * Una segunda lista de estados en este archivo sería una copia sin vigilancia.
 */
import type { EstadoCorreo } from '../../dominio/correo';

export interface RemitentePublico {
  id: number;
  /** El buzón por el que SALE. Vive en un dominio verificado en SES (`goberna.us`). */
  direccion: string;
  /** El display name del remitente («Escuela Goberna»). SES no lo verifica. */
  nombre: string;
  /**
   * A dónde vuelven las respuestas cuando el `vendedora_id` de quien escribe no es
   * un buzón. `null` = no se configuró ninguno.
   */
  responderA: string | null;
  /** El texto que se pega al final del cuerpo. `null` = este remitente no firma. */
  firma: string | null;
}

/**
 * El remitente COMPLETO, para administrarlo. Sólo se sirve a quien manda en el
 * equipo (`GET /api/correos/remitentes`, 403 `no_es_supervisor` al resto).
 *
 * ⚠️ **Incluye los inactivos, y ése es el motivo de que exista aparte de
 * `RemitentePublico`.** Dar de baja es lógico (`activo = false`), así que sin
 * servir lo apagado no habría forma de volver a prender nada — el mismo criterio
 * que `GET /api/hechos/catalogo`.
 */
export interface Remitente extends RemitentePublico {
  activo: boolean;
  /** Ausente en un server que todavía no lo emite: es dato de auditoría, no de decisión. */
  creadoAt?: string;
}

/**
 * Cuánto le queda a ESTA vendedora antes de que el server la frene.
 *
 * ⚠️ **Es informativo; la garantía es el 429.** La pantalla lo muestra para que
 * nadie escriba un correo entero y recién ahí se entere, pero quien decide es el
 * server (`correos/ritmo.ts`). Reimplementar el corte acá y creerle sería el bug
 * de #37 en su forma más cara: dos cuentas de la misma ventana que se separan sin
 * que nada falle.
 *
 * ⚠️ El sujeto es la **vendedora**, no la línea ni el remitente: los remitentes son
 * un puñado compartido por todo el equipo, así que un techo por remitente dejaría
 * que la primera que empieza a mandar se coma el cupo de las otras ocho.
 */
export interface RitmoDeCorreos {
  techoHora: number;
  techoDia: number;
  usadoHora: number;
  usadoDia: number;
}

/** `GET /api/correos/estado`. */
export interface EstadoDeCorreos {
  /** ¿Hay SMTP configurado? Sin esto no sale nada y la pantalla lo dice en vez de fingir. */
  conectado: boolean;
  /**
   * El `SMTP_FROM` de compatibilidad: por dónde sale un correo cuando no hay ni un
   * remitente dado de alta. `null` = ni siquiera eso está configurado.
   */
  desde: string | null;
  /** Los remitentes ACTIVOS, para elegir. Ausente = server viejo → `?? []`. */
  remitentes?: RemitentePublico[];
  /**
   * No hay tabla de remitentes o no hay ni una fila: se manda por `desde`.
   *
   * ⚠️ **No es lo mismo que `remitentes.length === 0`**, aunque hoy coincidan: esto
   * dice «el frente no está montado y se está usando el camino viejo», y con eso la
   * pantalla puede no pedir que se elija un remitente que no existe.
   */
  sinRemitentes?: boolean;
  /** ¿Puede administrar remitentes? Ausente → `?? false`: fail-closed. */
  supervisor?: boolean;
  /**
   * Los dominios que SES tiene verificados (hoy `['goberna.us']`).
   *
   * 🔴 Existe porque el error que evita es caro y tardío: `grupogoberna.com` **no**
   * está verificado, y tres de las nueve tienen su `vendedora_id` en ese dominio.
   * Darlo de alta como `From` no falla al guardarlo — falla en el **554 de SES**,
   * con un lead esperando del otro lado.
   */
  dominiosVerificados?: string[];
  /** Ausente = server viejo: no se dibuja el contador y no se frena nada acá. */
  ritmo?: RitmoDeCorreos;
}

/**
 * Un correo en la lista de «últimos enviados». **Sin cuerpo** — ver el docblock
 * de arriba.
 */
export interface CorreoEnLista {
  id: number;
  vendedoraId: string;
  para: string;
  asunto: string;
  estado: 'enviado' | 'fallido';
  /** Por qué falló, en criollo. `null` cuando salió bien. */
  motivo: string | null;
  /**
   * El `From` con el que SALIÓ, tal como lo vio quien lo recibió. Ausente en las
   * filas anteriores al frente: no hay backfill posible y un remitente inventado
   * es peor que un hueco (el criterio de los ✓✓).
   */
  desde?: string | null;
  /** El `Reply-To` con el que salió. Mismo criterio que `desde`. */
  responderA?: string | null;
  creadoAt: string;
}

/**
 * `GET /api/correos/:id` — lo mismo, más el cuerpo, que acá SÍ se pidió.
 *
 * ⚠️ **El `estado` se ensancha acá y NO en `CorreoEnLista`.** Esa lista es la de
 * «últimos enviados» y sus dos valores son la verdad de lo que sirve; esta ruta,
 * en cambio, devuelve la fila entera, y desde que existen los borradores eso
 * incluye uno con `estado: 'borrador'`. Tiparlo como enviado/fallido era una
 * mentira que compilaba: el composer lee esta respuesta para retomar un borrador.
 */
export interface CorreoCompleto extends Omit<CorreoEnLista, 'estado'> {
  cuerpo: string;
  estado: EstadoCorreo;
  /**
   * Los dos campos que un borrador necesita para retomarse donde se dejó, y que
   * la lista no sirve porque a un enviado no le hacen falta.
   *
   * ⚠️ Opcionales por la ventana N4↔N5: el front sale solo y el server lo sube
   * una persona, así que hay horas en que esta app le habla a un server que no
   * los emite. Es el mismo criterio que `desde` y `responderA` de acá arriba.
   */
  clave?: string | null;
  remitenteId?: number | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA BANDEJA (migración 0049)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Una etiqueta del riel. El `color` es un nombre de la paleta, nunca un hex. */
export interface EtiquetaDeCorreo {
  id: number;
  nombre: string;
  color: string;
  creadoPor: string;
}

/**
 * Un HILO en la lista — un renglón de la bandeja.
 *
 * 🔴 **La unidad de la lista es la conversación, no el mensaje**, y viene
 * agrupada del server. El navegador NO agrupa: agrupando acá, «1-50 de 1.478»
 * sería falso (pedís 50 mensajes y te quedan 31 hilos) y el orden sería el del
 * último mensaje *de la página*, no el del hilo.
 *
 * ⚠️ **Casi todo es opcional por lo mismo que el resto de este archivo**: el
 * front sale por N4 y el server por N5, así que existe siempre un rato en que
 * esta pantalla le habla a un server que todavía no conoce la 0049. Y el caché de
 * IndexedDB (ADR 0007) puede devolver una respuesta guardada por la versión
 * anterior mucho después.
 */
export interface HiloDeBandeja {
  /** La clave del hilo. En las filas anteriores a la 0049 es `correo:<id>`. */
  hilo: string;
  /** El id del ÚLTIMO mensaje: es el que se abre y del que sale todo lo de abajo. */
  id: number;
  vendedoraId: string;
  para: string;
  desde: string | null;
  asunto: string;
  clave: string | null;
  estado: string;
  motivo: string | null;
  creadoAt: string;
  carpeta?: string;
  pospuestoHasta?: string | null;
  programadoPara?: string | null;
  /** Cuántos mensajes tiene. `1` no se dibuja — la referencia tampoco lo dibuja. */
  mensajes?: number;
  sinLeer?: boolean;
  destacado?: boolean;
  importante?: boolean;
  /**
   * Las primeras líneas del cuerpo.
   *
   * ⚠️ **Viene recortado desde Postgres, no desde acá.** Lo que no se dibuja no
   * sale de la base: recortarlo en el navegador dejaría el cuerpo entero viajando
   * igual, que es exactamente el defecto que `listarCorreos` vino a cerrar.
   */
  avance?: string;
  etiquetas?: EtiquetaDeCorreo[];
}

/** `GET /api/correos/bandeja`. */
export interface RespuestaDeBandeja {
  riel: string;
  /** Total de HILOS que matchean — es lo que pagina la barra de arriba. */
  total: number;
  pagina: number;
  hilos: HiloDeBandeja[];
}
