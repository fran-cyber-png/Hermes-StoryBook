import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  File as ArchivoIcono,
  FileText,
  Image as ImagenIcono,
  Loader2,
  Mail,
  Paperclip,
  Send,
  Settings2,
  Video as VideoIcono,
  X,
} from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { tokenGuardado } from '../../lib/datos/token';
import { quienDiceSer } from '../auth/sesion';
import { mismoUsuario } from '../notas/espacios';
import { AdminRemitentes } from './AdminRemitentes';
import {
  conMiles,
  lecturaDeError,
  motivoAdjuntoInvalido,
  motivoParaNoEnviar,
  pesoLegible,
  resumenDelSobre,
  techoQuemado,
  TOPE_ADJUNTOS_BYTES,
  TOPE_CUERPO,
} from './correos';
import type { EstadoDeCorreos } from './tipos';

/**
 * CORREOS — mandarle un mail a una persona sin salir de Hermes.
 *
 * Un correo = una vendedora, un destinatario, una acción humana (la misma
 * filosofía que WhatsApp: sin listas, sin campañas). Abajo, los últimos enviados
 * del equipo: coordinación a la vista, incluidos los fallidos.
 *
 * ══ 🔴 ESTA PANTALLA MINTIÓ DURANTE UN MES, Y ASÍ ES COMO SE ARREGLA ═════════
 *
 * Desde el 21-jul-2026 el pie del composer decía **«Se envía solo a esta persona,
 * con tu nombre»** y el placeholder **«(va en texto plano, con tu firma de
 * siempre)»**. Las dos frases eran falsas al mismo tiempo: el `From` era
 * `Escuela Goberna <escuela@goberna.us>` para las nueve vendedoras, no había
 * `Reply-To` —o sea que la respuesta del lead caía en un buzón que nadie de
 * ventas lee— y no existía **una sola línea de código** que agregara una firma.
 * Nadie lo descubrió operando porque la tabla tiene tres filas y las tres son
 * pruebas.
 *
 * El server ahora sí hace las dos cosas. Lo que cambia acá es más fuerte que
 * volver ciertas esas frases: **se borran**. Una promesa no se puede verificar
 * mirando la pantalla; el sobre dibujado —`Luz · Escuela Goberna
 * <escuela@goberna.us>`, «las respuestas te llegan a ti»— sí, y se rompe a la
 * vista el día que el server cambie de opinión. Todo lo que esta vista afirma
 * sobre lo que va a salir lo arma `resumenDelSobre` (`correos.ts`), que es el
 * gemelo declarado de `armarSobre` del server.
 *
 * ⚠️ **El corolario para quien agregue algo acá**: si quieres escribir una frase
 * que empieza con «se envía…» o «va con…», lo que hace falta no es la frase, es
 * el dato al lado del campo.
 */

/**
 * Dónde se recuerda con qué remitente sale cada una.
 *
 * ⚠️ **Va por vendedora y en minúsculas.** En producción el mismo humano tiene dos
 * grafías vivas del `vendedora_id` (`Luz` y `luz`, `Usuario1` y `usuario1`): sin
 * normalizar, entrar tipeando la otra forma le devuelve la pantalla como si nunca
 * hubiera elegido nada — el mismo defecto mudo que `mismoUsuario` evita en la
 * Libreta, acá en su versión barata.
 */
function claveDelRemitente(vendedoraId: string): string {
  return `hermes.correos.remitente.${vendedoraId.trim().toLowerCase()}`;
}

/**
 * ⚠️ Las dos puertas a `localStorage` van con `try`: en la app de escritorio y
 * detrás de un modo privado el acceso puede tirar, y perder la preferencia de un
 * desplegable no puede llevarse puesta la vista entera de Correos.
 */
function leerRemitenteGuardado(vendedoraId: string): number | null {
  try {
    const crudo = window.localStorage.getItem(claveDelRemitente(vendedoraId));
    const n = Number(crudo);
    return crudo !== null && Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

function guardarRemitente(vendedoraId: string, id: number): void {
  try {
    window.localStorage.setItem(claveDelRemitente(vendedoraId), String(id));
  } catch {
    // Bloqueado: la próxima vez arranca sin preferencia. No es motivo para frenar nada.
  }
}

interface ComposerProps {
  /** El puente desde la ficha: llega con el «Para» ya lleno. */
  correoInicial?: string | null;
  /**
   * La conversación de la que salió el puente.
   *
   * 🔴 **Sin esto el correo no existe para el resto de Hermes.** `correos.clave` es
   * lo que ata el mail a su conversación: sin ella no aparece en ningún timeline,
   * no entra en ninguna medición y no se cruza con la venta — las tres filas que
   * hay en producción la tienen en `NULL`, y por eso son invisibles salvo en esta
   * lista.
   */
  claveInicial?: string | null;
  /** Cómo se llama esa persona: se usa para el asunto y para el acuse, nunca se manda. */
  nombreInicial?: string | null;
  /** Avisa al shell que el puente ya se consumió, para que lo limpie. */
  onConsumido?: () => void;
  /**
   * UN BORRADOR QUE SE ESTÁ RETOMANDO. `null` = uno nuevo, en blanco.
   *
   * ⚠️ **Trae el `id`, y ése es el campo que importa.** Sin él, retomar un
   * borrador y volver a cerrarlo guardaría uno NUEVO: Borradores terminaría con
   * una copia por cada vez que se abrió el mismo correo, todas menos una viejas.
   */
  borradorInicial?: BorradorAbierto | null;
  /**
   * SEÑAL DE CIERRE (contador): al cambiar, el composer guarda lo escrito como
   * borrador y recién entonces avisa que se puede cerrar.
   *
   * 🔴 **Existe porque la X vive AFUERA de este componente** — es el marco del
   * panel, en `VistaCorreos`— y lo que hay que guardar vive acá adentro. La
   * alternativa era subir los cuatro campos al padre, que es mucho más caro y
   * pone el estado del formulario lejos del formulario. Es el mismo patrón de
   * contador que ya usan `senalAbrir` de la barra del chat y de agendar: con un
   * booleano, cerrar y volver a abrir no cambiaría el valor y no dispararía nada.
   */
  senalCerrar?: number;
  /**
   * «Ya guardé, puedes cerrar». **Sólo se llama cuando el borrador quedó a
   * salvo** — o cuando no había nada que guardar. Si el guardado falla, esto NO
   * se llama y el panel queda abierto con lo escrito a la vista: cerrar sobre un
   * guardado fallido es perder el texto sin decirlo.
   */
  onListoParaCerrar?: () => void;
}

/** Lo que hace falta para retomar un borrador donde se dejó. */
export interface BorradorAbierto {
  id: number;
  para: string;
  asunto: string;
  cuerpo: string;
  clave: string | null;
  remitenteId: number | null;
}

type TonoDeAviso = 'ok' | 'error' | 'techo';

export function Composer({
  correoInicial,
  claveInicial,
  nombreInicial,
  onConsumido,
  borradorInicial,
  senalCerrar = 0,
  onListoParaCerrar,
}: ComposerProps) {
  const qc = useQueryClient();

  /**
   * 🔴 **Quién escribe se lee del TOKEN, que es la misma fuente que va a usar el
   * server.** No es una comodidad para evitar una prop: el `Reply-To` lo decide el
   * server a partir del `vendedora_id` que viene firmado en el Bearer, así que
   * dibujar el sobre con un id que llegó por otro camino sería justamente la forma
   * de que la pantalla anuncie un buzón y salga otro. Se lee **una vez** (lazy
   * init) porque el shell desmonta el árbol entero al cambiar de sesión: un token
   * nuevo llega con un componente nuevo.
   */
  const [vendedoraId] = useState(() => quienDiceSer(tokenGuardado() ?? '')?.id ?? '');

  const [para, setPara] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [remitenteId, setRemitenteId] = useState<number | null>(null);
  const [firmaAbierta, setFirmaAbierta] = useState(false);
  const [adminAbierto, setAdminAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: TonoDeAviso; texto: string } | null>(null);
  /** El remitente que esta vendedora venía usando ya no está activo. Se DICE. */
  const [remitenteRetirado, setRemitenteRetirado] = useState(false);

  /**
   * QUÉ FILA ES ESTE BORRADOR. `null` = todavía no se guardó ninguna vez.
   *
   * 🔴 **Es lo que hace que guardar dos veces PISE en vez de duplicar.** El
   * server crea cuando le llega sin id y actualiza cuando le llega con uno; acá
   * se recuerda el que contestó. Sin este estado, un composer que se abre y se
   * cierra tres veces deja tres filas en Borradores del mismo correo a medias, y
   * la vendedora tiene que adivinar cuál es la buena.
   *
   * ⚠️ **Se suelta al enviar**, igual que la clave del puente: esa fila ya no es
   * un borrador —pasó a `enviado`— y volver a guardar sobre ella la reviviría. El
   * server lo impide igual (su `WHERE` exige `estado = 'borrador'`), pero
   * apoyarse sólo en eso dejaría al composer pidiendo algo imposible y comiéndose
   * un 409 en la cara de quien acaba de mandar bien un correo.
   */
  const [borradorId, setBorradorId] = useState<number | null>(null);

  // ── Lo que trajo el puente, y que viaja con el envío (H7) ──
  const [clave, setClave] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  /** Contra qué destinatario se pactó esa clave. Ver `escribirPara`. */
  const [paraDelPuente, setParaDelPuente] = useState<string | null>(null);

  /**
   * LOS ADJUNTOS — sólo viven en este componente, nunca en el server hasta que
   * se manda. `/api/correos/borrador` sigue siendo JSON puro: guardar un
   * borrador con archivos adentro pediría persistirlos en algún lado (hoy no
   * hay dónde, ver `server/src/correos/adjuntos.ts`), así que retomar un
   * borrador trae el texto de vuelta y no los archivos — el mismo criterio
   * que ya rige para la firma, que tampoco se pega dos veces.
   */
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  /**
   * Se llama con la lista COMPLETA —lo que ya había más lo nuevo— porque
   * `motivoAdjuntoInvalido` juzga el CONJUNTO (el peso total, la cantidad), no
   * un archivo aislado: agregar el quinto de 2 MB puede ser el que hace
   * rebalsar el tope aunque él solo entre de sobra.
   */
  function agregarArchivos(lista: FileList | File[]) {
    const nuevos = Array.from(lista);
    if (nuevos.length === 0) return;
    const combinados = [...adjuntos, ...nuevos];
    const motivo = motivoAdjuntoInvalido(combinados);
    if (motivo) {
      setAviso({ tipo: 'error', texto: motivo });
      return;
    }
    setAdjuntos(combinados);
  }

  function quitarAdjunto(indice: number) {
    setAdjuntos((a) => a.filter((_, i) => i !== indice));
  }

  /**
   * ⚠️ **Sin `correoInicial` no se hace nada, aunque venga la clave.** Un puente sin
   * dirección no es un correo a medio escribir: es una persona de la que no tenemos
   * mail, y prellenar la conversación sin destinatario dejaría una clave colgada
   * esperando a que alguien tipee cualquier dirección para colgarse de ese hilo.
   */
  useEffect(() => {
    if (!correoInicial) return;
    setPara(correoInicial);
    setParaDelPuente(correoInicial);
    setClave(claveInicial ?? null);
    setNombre(nombreInicial ?? null);
    onConsumido?.();
  }, [correoInicial, claveInicial, nombreInicial, onConsumido]);

  /**
   * RETOMAR UN BORRADOR — se cargan los cuatro campos y, sobre todo, su `id`.
   *
   * ⚠️ **Depende del `id` y no del objeto entero.** El padre arma ese objeto en
   * cada render; con el objeto en las dependencias, este efecto correría en cada
   * repintado y le pisaría a la vendedora lo que está escribiendo con el texto
   * que tenía guardado. Es un defecto que no se ve en un test rápido y que en la
   * pantalla se lee como «se borró solo lo que escribí».
   *
   * ⚠️ **`clave` viaja pero `paraDelPuente` NO se toca.** Esa marca es del puente
   * —«esta clave se pactó contra esta dirección»— y un borrador retomado no viene
   * de un puente: dejarla vacía hace que cambiar el «Para» suelte la conversación,
   * que es exactamente lo correcto para un correo que se está reescribiendo.
   */
  useEffect(() => {
    if (!borradorInicial) return;
    setBorradorId(borradorInicial.id);
    setPara(borradorInicial.para);
    setAsunto(borradorInicial.asunto);
    setCuerpo(borradorInicial.cuerpo);
    setClave(borradorInicial.clave);
    if (borradorInicial.remitenteId !== null) setRemitenteId(borradorInicial.remitenteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorInicial?.id]);

  const estado = useQuery({
    queryKey: ['correos', 'estado'],
    queryFn: () => api<EstadoDeCorreos>('/api/correos/estado'),
  });

  /**
   * Todo campo nuevo se lee OPCIONAL. El front sale por N4 (automático) y el server
   * por N5 (un botón que aprieta una persona), así que hay horas en que esta app le
   * habla a un server que no emite nada de esto; y el caché de IndexedDB (ADR 0007)
   * rehidrata respuestas de ayer antes del primer render. El precedente exacto es
   * `soloMisAsignadas ?? true` en `VistaDashboard.tsx:221`.
   */
  const remitentes = estado.data?.remitentes ?? [];
  const supervisor = estado.data?.supervisor ?? false;
  const ritmo = estado.data?.ritmo;
  /** Cuál ventana del ritmo está llena. Es la misma pregunta que apaga el botón. */
  const quemado = techoQuemado(ritmo);
  /**
   * ⚠️ **`sinRemitentes` no es `remitentes.length === 0`, aunque hoy coincidan.**
   * Dice «el frente no está montado y se manda por el `SMTP_FROM` de siempre», y por
   * eso el `??` cae en la longitud: un server viejo no emite ninguno de los dos
   * campos y tiene que comportarse exactamente como antes, no pedir que se elija un
   * remitente que no existe.
   */
  const sinRemitentes = estado.data?.sinRemitentes ?? remitentes.length === 0;

  /**
   * ⚠️ **Lo guardado se VALIDA contra la lista que llegó.** Dar de baja un remitente
   * es lógico (`activo = false`), así que sin este chequeo el desplegable seguiría
   * mostrando el de siempre —guardado hace tres semanas en esta máquina— y el envío
   * moriría en un 400 del server hablando de un id que la vendedora nunca eligió.
   * Cuando el suyo desapareció **no se elige otro por ella**: se apaga el botón (vía
   * `motivoParaNoEnviar`) y se dice qué pasó.
   */
  useEffect(() => {
    const lista = estado.data?.remitentes ?? [];
    if (lista.length === 0) return;

    const guardado = leerRemitenteGuardado(vendedoraId);
    const guardadoVive = guardado !== null && lista.some((r) => r.id === guardado);

    setRemitenteId((actual) => {
      if (actual !== null && lista.some((r) => r.id === actual)) return actual;
      if (guardadoVive) return guardado;
      // Con uno solo no hay nada que elegir: pedir una elección de una sola opción
      // es un trámite. Con dos o más, la elección la hace ella.
      return lista.length === 1 ? lista[0].id : null;
    });
    setRemitenteRetirado(guardado !== null && !guardadoVive);
  }, [estado.data, vendedoraId]);

  const remitenteElegido = remitentes.find((r) => r.id === remitenteId) ?? null;
  const sobre = resumenDelSobre(remitenteElegido, vendedoraId, estado.data?.desde ?? null);
  /**
   * Por dónde sale — es a dónde caen las respuestas cuando no hay `Reply-To`.
   *
   * ⚠️ **No siempre es un buzón pelado, y por eso el nombre no promete eso.** Con
   * remitente elegido es `direccion` a secas; sin ninguno se cae al `SMTP_FROM` de
   * compatibilidad, que en producción viene como cabecera completa
   * (`Escuela Goberna <escuela@goberna.us>`). Cualquier cosa que se quiera hacer con
   * esto —un `mailto:`, una comparación contra otra dirección— tiene que partirlo
   * primero; hoy sólo se muestra, y mostrarlo tal cual es lo honesto.
   */
  const buzonDeSalida = remitenteElegido?.direccion ?? estado.data?.desde ?? null;
  /**
   * ¿El `Reply-To` es SU casilla, o un buzón compartido? Las dos cosas se dicen
   * distinto, y por eso esta comparación decide qué frase sale.
   *
   * 🔴 **Estaba escrita exacta (`=== vendedoraId.trim()`) y HOY no muerde — verificado
   * corriendo el test de DOM contra la versión vieja, que pasa igual.** No muerde por
   * un accidente: cuando el `Reply-To` es de ella, `resumenDelSobre` lo devuelve
   * **literalmente derivado de `vendedoraId.trim()`**, así que las dos cadenas son la
   * misma por construcción. O sea que la corrección no arregla un síntoma: **saca una
   * trampa armada**. El día que alguien normalice el `Reply-To` de un lado —bajarlo a
   * minúsculas al armar el sobre es lo primero que uno haría, y las cabeceras de
   * correo no distinguen mayúsculas— la igualdad se rompe **sin error y sin log**, y
   * lo que se apaga es la buena noticia: a `Ventas11@grupogoberna.com` la pantalla le
   * diría «cae en un buzón compartido, no en tu casilla» sobre un buzón que es suyo.
   * En este repo esa comparación ya costó cuatro bugs mudos (reparto, espacios de la
   * Libreta, eventos, cola), y cinco de los nueve `vendedora_id` son correos enteros.
   *
   * ⚠️ Es `mismoUsuario` de la Libreta a propósito, **no un normalizador nuevo**: ya
   * hay cuatro (`mismaVendedora` en el server, `mismoUsuario` acá, `esMio` en
   * eventos) y el quinto es el que se olvida de un `trim`.
   */
  const respondeAElla = mismoUsuario(sobre.respondeA, vendedoraId);

  /**
   * GUARDAR LO ESCRITO COMO BORRADOR.
   *
   * ══ 🔴 EL DEFECTO QUE CIERRA ════════════════════════════════════════════════
   *
   * Hasta el 25-ago-2026 cerrar el composer **tiraba lo escrito a la basura, sin
   * preguntar y sin avisar**. Borradores existía en el riel, con su predicado en
   * el server y su carpeta dibujada, y decía «No hay borradores guardados»
   * siempre — porque no había una sola línea que guardara uno. Media cotización
   * escrita se perdía con un clic en la X, que es el gesto más barato de la
   * pantalla.
   *
   * ⚠️ **No hay autoguardado por tiempo, y es una decisión.** Un `setInterval`
   * que escribe cada treinta segundos llena Borradores de fragmentos de una línea
   * y obliga a resolver qué pasa cuando se cierra sin haber tocado nada. El
   * momento en que lo escrito corre peligro es UNO —cerrar— y es ahí donde se
   * guarda. El día que haga falta más, el `id` que este componente ya recuerda es
   * exactamente lo que un autoguardado necesitaría.
   */
  const guardarBorrador = useMutation({
    mutationFn: () =>
      api<{ ok: true; guardado: boolean; id: number | null }>('/api/correos/borrador', {
        method: 'POST',
        body: JSON.stringify({
          id: borradorId ?? undefined,
          remitenteId: remitenteId ?? undefined,
          para: para.trim(),
          asunto,
          cuerpo,
          clave: clave ?? undefined,
        }),
      }),
    onSuccess: (r) => {
      if (r.id !== null) setBorradorId(r.id);
      // La carpeta Borradores acaba de cambiar. Se invalida la bandeja entera y no
      // sólo esa carpeta: al enviar, la misma fila se muda a Enviados, y una clave
      // por carpeta obligaría a acertar las dos desde acá.
      void qc.invalidateQueries({ queryKey: ['correos', 'bandeja'] });
    },
  });

  /** ¿Hay algo que valga la pena guardar? Los tres vacíos son «no se escribió nada». */
  const hayQueGuardar = para.trim() !== '' || asunto.trim() !== '' || cuerpo.trim() !== '';

  /**
   * LA SEÑAL DE CIERRE — guardar primero, avisar después.
   *
   * 🔴 **`onListoParaCerrar` NO se llama si el guardado falla.** Cerrar igual
   * sería perder el texto en el mismo gesto que prometía conservarlo, y encima en
   * silencio: la vendedora ve el panel cerrarse y da por hecho que quedó
   * guardado. Con el fallo a la vista y el panel abierto, lo escrito sigue en
   * pantalla y se puede copiar o reintentar.
   *
   * ⚠️ **Sin nada escrito se cierra sin tocar el server.** Abrir el composer y
   * cerrarlo es lo más común que se hace con él; un POST por cada vez sería ruido
   * puro, y una fila vacía en Borradores por cada arrepentimiento.
   */
  const [cierreVisto, setCierreVisto] = useState(senalCerrar);
  useEffect(() => {
    if (senalCerrar === cierreVisto) return;
    setCierreVisto(senalCerrar);

    if (!hayQueGuardar) {
      onListoParaCerrar?.();
      return;
    }
    setAviso(null);
    guardarBorrador.mutate(undefined, {
      onSuccess: () => onListoParaCerrar?.(),
      onError: (err) => {
        setAviso({
          tipo: 'error',
          texto: `No se pudo guardar el borrador: ${lecturaDeError(err).texto} Lo escrito sigue acá.`,
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senalCerrar]);

  const enviar = useMutation({
    mutationFn: () => {
      const campos = {
        remitenteId: remitenteId ?? undefined,
        para: para.trim(),
        asunto,
        cuerpo,
        clave: clave ?? undefined,
        // Con esto el server CONVIERTE esa fila en el correo que salió en vez de
        // insertar otra: el borrador no queda en Borradores después de mandarse.
        borradorId: borradorId ?? undefined,
      };

      // Sin adjuntos, el camino de siempre: JSON puro, sin tocar `api()`.
      if (adjuntos.length === 0) {
        // `JSON.stringify` se come las claves `undefined`, así que un server que
        // todavía no conoce `remitenteId` ni `clave` recibe exactamente el cuerpo
        // que sabe leer.
        return api<{ ok: true }>('/api/correos/enviar', { method: 'POST', body: JSON.stringify(campos) });
      }

      // ⚠️ **Con adjuntos el body es `FormData`, no JSON** — es lo que le permite a
      // `multer` leer los archivos del lado del server (`routes/correos.ts`). Los
      // campos que no son archivo viajan como texto: es lo mismo que hace
      // `enviar-media` de WhatsApp con los metadatos por query, adaptado a que acá
      // hay varios archivos y no uno.
      const form = new FormData();
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor !== undefined) form.append(campo, String(valor));
      }
      for (const archivo of adjuntos) form.append('adjuntos', archivo, archivo.name);
      return api<{ ok: true }>('/api/correos/enviar', { method: 'POST', body: form });
    },
    onMutate: () => {
      setAviso(null);
    },
    onSuccess: () => {
      setAviso({ tipo: 'ok', texto: `Enviado a ${nombre ? `${nombre} (${para.trim()})` : para.trim()}.` });
      setPara('');
      setAsunto('');
      setCuerpo('');
      setAdjuntos([]);
      // 🔴 **La clave se suelta con el envío, y esto no es higiene.** Es del PUENTE,
      // no del composer: si sobreviviera, el próximo correo —escrito a mano, a otra
      // persona— quedaría colgado del timeline del lead anterior. Un correo en la
      // conversación equivocada no se ve roto: se ve como un correo más.
      setClave(null);
      setNombre(null);
      setParaDelPuente(null);
      // 🔴 **El borrador se suelta con el envío, por el mismo motivo que la clave.**
      // Esa fila acaba de dejar de ser un borrador —el server la convirtió en el
      // correo que salió— así que guardar sobre ella sería pedir revivir un enviado.
      // El server no lo permite; soltarlo acá es lo que evita que el próximo cierre
      // del composer se coma un 409 sobre un correo que salió perfecto.
      setBorradorId(null);
      void qc.invalidateQueries({ queryKey: ['correos', 'lista'] });
      // La fila se movió de Borradores a Enviados: sin esto las dos carpetas
      // mienten hasta el próximo montaje de la vista.
      void qc.invalidateQueries({ queryKey: ['correos', 'bandeja'] });
      // El ritmo lo lleva el server y acaba de moverse: sin esto el contador de la
      // cabecera diría «3 de 20» hasta el próximo montaje de la vista.
      void qc.invalidateQueries({ queryKey: ['correos', 'estado'] });
    },
    onError: (err) => {
      const lectura = lecturaDeError(err);
      // 🔴 **Un 429 NO es una falla: es un techo, y se ve distinto.** Pintado de rojo
      // como los demás, lo que dice la pantalla es «se rompió» y lo que hace quien lo
      // lee es volver a apretar Enviar — contra un server que ya decidió que no.
      const esTecho = err instanceof ErrorApi && err.status === 429;
      setAviso({ tipo: esTecho ? 'techo' : 'error', texto: lectura.texto });
      if (esTecho) void qc.invalidateQueries({ queryKey: ['correos', 'estado'] });
    },
  });

  /**
   * 🔴 **El botón y `⌘↵` preguntan lo MISMO, una sola vez.** Cada uno con su copia
   * de la condición fue exactamente el bug de Ivi (#169): el botón apagado por el
   * tope y el acorde mandando igual. La regla vive pura en `correos.ts`.
   */
  const veredicto = motivoParaNoEnviar(
    { para, asunto, cuerpo, remitenteId, enVuelo: enviar.isPending },
    estado.data,
  );

  /** Cambiar el destinatario a mano SUELTA la conversación que trajo el puente. */
  function escribirPara(v: string) {
    setPara(v);
    if (clave !== null && v.trim() !== (paraDelPuente ?? '').trim()) {
      setClave(null);
      setNombre(null);
    }
  }

  function elegirRemitente(id: number) {
    setRemitenteId(id);
    setRemitenteRetirado(false);
    setFirmaAbierta(false);
    if (vendedoraId !== '') guardarRemitente(vendedoraId, id);
  }

  /** El contador aparece cuando falta poco, no siempre: un número que no corre peligro es ruido. */
  const cercaDelTope = cuerpo.length > TOPE_CUERPO * 0.9;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="w-full">
        {/* ── El composer ── */}
        <section className="rounded-2xl bg-card p-5 shadow-panel">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-navy-ink" />
            <h2 className="font-heading text-lg font-bold text-foreground">Nuevo correo</h2>
            <div className="ml-auto flex items-center gap-3">
              {/* 🔴 **El contador se dibujaba IDÉNTICO quemado que sano.** «20/20 esta
                  hora» salía en el mismo `text-muted-foreground` que «3/20», o sea que
                  el único momento en que ese número importa era el único en que no se
                  distinguía: la vendedora escribe el correo entero, aprieta Enviar y
                  recién ahí se entera, con el freno al lado del botón. Ahora el estado
                  se ve **sin leer las cifras** — fondo tenido y el mismo ámbar del aviso
                  de techo, que es el color con el que esta pantalla ya dice «esto no es
                  una falla, es un tope». **Sin oro**: el dorado significa tiempo que se
                  acaba y acá no corre ningún plazo — lo que se acabó es el cupo.
                  ⚠️ Quién está quemado lo dice `techoQuemado`, la MISMA función que apaga
                  el botón: con un `>=` propio acá el número podría gritar sobre un botón
                  que anda, o quedarse gris sobre uno apagado. */}
              {ritmo && (
                <span
                  className={
                    'rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums ' +
                    (quemado
                      ? 'bg-warning/15 font-semibold text-warning-foreground'
                      : 'text-muted-foreground')
                  }
                  title={
                    quemado
                      ? 'El cupo de esta ventana está lleno. Los techos los aplica el server: el corte de verdad es el 429.'
                      : 'Los techos los aplica el server; esto es para no enterarte con el correo escrito.'
                  }
                >
                  {ritmo.usadoHora}/{ritmo.techoHora} esta hora · {ritmo.usadoDia}/{ritmo.techoDia} hoy
                </span>
              )}
              {supervisor && (
                <button
                  type="button"
                  onClick={() => setAdminAbierto(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
                >
                  <Settings2 size={12} />
                  Administrar remitentes
                </button>
              )}
            </div>
          </div>

          {estado.isError ? (
            <div className="mt-4 rounded-xl bg-muted/50 p-3.5 text-xs leading-relaxed text-foreground">
              <p>No se pudo consultar el estado del canal de correo — reintenta en un momento.</p>
              <button
                type="button"
                onClick={() => void estado.refetch()}
                className="mt-2.5 rounded-lg border border-border px-3 py-1.5 font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
              >
                Reintentar
              </button>
            </div>
          ) : estado.data?.conectado === false ? (
            /* 🔴 Acá decía «la cuenta vive en mail.goberna.us» y era falso: el SMTP es
               Amazon SES y el MX de goberna.us es Google Workspace. Un dato inventado
               en la pantalla de una falla manda a sistemas a revisar un host que no
               existe — y encima suena a que quien escribe la pantalla sabe. */
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs leading-relaxed text-warning-foreground">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p>
                  El canal de correo no está configurado en este servidor: no hay por dónde mandarlo. Es un
                  paso de sistemas — dos minutos — y esta pantalla se enciende sola cuando esté.
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  para sistemas: SMTP_HOST · SMTP_USER · SMTP_PASS en el .env
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {/* ── Desde: con qué correo sale ──
                  ⚠️ **Todo este bloque espera a que `estado.data` exista.** Mientras la
                  consulta viaja, `remitentes` es `[]` y `sinRemitentes` da `true`: sin
                  esta guarda la pantalla afirmaría «todavía no hay remitentes cargados»
                  —y dibujaría un sobre vacío— durante el segundo que tarda en llegar la
                  respuesta. Es el mismo error que este frente vino a corregir, en
                  chiquito: decir algo que no se sabe todavía. */}
              {!estado.data ? (
                <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  Viendo por dónde sale…
                </p>
              ) : sinRemitentes ? (
                /* ⚠️ Una lista vacía se lee «se rompió», no «falta configurarlo»: el
                   mismo criterio que `sinLineasPropias` y `sinPadron`. Así que no se
                   dibuja un desplegable sin opciones — se dice qué está pasando. */
                /* ⚠️ **Acá NO se repite por dónde sale.** Decía «— sale por
                   escuela@goberna.us» y el bloque del sobre, dos renglones más abajo,
                   dice exactamente lo mismo: dos frases pegadas afirmando el mismo
                   hecho se leen como dos hechos, y la vendedora busca en qué se
                   diferencian. Lo que este renglón tiene que aportar es lo que el
                   sobre NO puede decir: que la lista está vacía y qué se hace con
                   eso. */
                <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Todavía no hay remitentes cargados: sale por el buzón de siempre, el de acá abajo.
                  {supervisor ? ' Puedes darlos de alta en «Administrar remitentes».' : ''}
                </p>
              ) : (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-12 shrink-0 font-semibold">Desde</span>
                  <select
                    value={remitenteId === null ? '' : String(remitenteId)}
                    onChange={(e) => {
                      if (e.target.value !== '') elegirRemitente(Number(e.target.value));
                    }}
                    aria-label="Desde qué correo sale"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                  >
                    {remitenteId === null && <option value="">Elige con qué correo sale…</option>}
                    {remitentes.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.nombre} · {r.direccion}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {remitenteRetirado && (
                <p className="text-[11px] leading-relaxed text-warning-foreground">
                  El remitente que venías usando ya no está activo. Elige con cuál sale este correo.
                </p>
              )}

              {/* ── EL SOBRE: lo que va a salir, no lo que prometemos que va a salir ── */}
              {estado.data && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <p className="truncate" title={sobre.de}>
                  <span className="font-semibold">De:</span>{' '}
                  <span className="font-mono text-foreground">{sobre.de || '—'}</span>
                </p>
                <p className="mt-0.5 truncate">
                  {sobre.respondeA === null ? (
                    /* ⚠️ **No se repite la cabecera que el renglón «De:» acaba de
                       imprimir.** Sin remitente elegido `buzonDeSalida` ES `sobre.de`
                       —los dos caen al `SMTP_FROM`, que en producción viene entero
                       (`Escuela Goberna <escuela@goberna.us>`)—, así que la frase salía
                       con un display name y unos picos metidos en el medio de la prosa,
                       diciendo por segunda vez y peor lo que el renglón de arriba ya
                       decía bien. Dos frases pegadas afirmando el mismo hecho se leen
                       como dos hechos, y la vendedora busca en qué se diferencian; es
                       la misma razón por la que el aviso de «sin remitentes» no vuelve
                       a nombrar el buzón. Con remitente elegido sí son distintos (arriba
                       el nombre, acá el buzón pelado) y ahí decirlo aporta. */
                    <>
                      Las respuestas caen{' '}
                      {buzonDeSalida !== null && buzonDeSalida !== sobre.de ? (
                        <>
                          en <span className="font-mono">{buzonDeSalida}</span>
                        </>
                      ) : (
                        'en ese mismo buzón'
                      )}{' '}
                      — no en tu casilla.
                    </>
                  ) : respondeAElla ? (
                    <>
                      Las respuestas te llegan a ti (
                      <span className="font-mono">{sobre.respondeA}</span>)
                    </>
                  ) : (
                    <>
                      Las respuestas caen en <span className="font-mono">{sobre.respondeA}</span>, que es un
                      buzón compartido — no en tu casilla.
                    </>
                  )}
                </p>

                {/* 🔴 La firma se MUESTRA, nunca se pega en el textarea: el server la
                    agrega al final del cuerpo, así que pegarla acá la manda dos veces. */}
                {remitenteElegido?.firma && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setFirmaAbierta((v) => !v)}
                      className="rounded font-semibold underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {firmaAbierta ? 'ocultar firma' : 'ver firma'}
                    </button>
                    {firmaAbierta && (
                      <pre className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-2 font-sans text-[11px] text-foreground">
                        {remitenteElegido.firma}
                      </pre>
                    )}
                  </div>
                )}
              </div>
              )}

              {clave && (
                <p className="text-[11px] text-muted-foreground">
                  Queda anotado en la conversación de {nombre ?? 'esta persona'}.
                </p>
              )}

              <input
                value={para}
                onChange={(e) => escribirPara(e.target.value)}
                type="email"
                aria-label="Para"
                placeholder="Para: persona@correo.com"
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-sans focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
              />
              <input
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                aria-label="Asunto"
                /* ⚠️ El nombre va en el PLACEHOLDER y no prellenado. Un asunto que la
                   app escribe sola es texto que sale hacia un lead sin que nadie lo
                   haya leído, y el asunto es lo primero —a veces lo único— que se lee. */
                placeholder={nombre ? `Asunto — lo primero que lee ${nombre}` : 'Asunto'}
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
              />
              <textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (veredicto.puede) enviar.mutate();
                  }
                }}
                // Arrastrar un archivo hasta acá adjunta, sin obligar a ir a buscar
                // el botón — el mismo gesto que ya existe en el chat de WhatsApp
                // (`HiloWhatsapp.tsx`), adaptado a un solo elemento en vez de a la
                // ventana entera: el composer es un panel angosto y no toda la app.
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  agregarArchivos(e.dataTransfer.files);
                }}
                rows={8}
                aria-label="Cuerpo del correo"
                placeholder="Escribe el correo… (también puedes soltar un archivo acá)"
                className={
                  'resize-y rounded-lg border bg-muted/40 px-3 py-2 text-sm leading-relaxed outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] ' +
                  (arrastrando ? 'border-primary bg-primary/[0.06]' : 'border-border')
                }
              />

              {cercaDelTope && (
                <p
                  className={
                    'text-right font-mono text-[11px] tabular-nums ' +
                    (cuerpo.length > TOPE_CUERPO ? 'text-destructive' : 'text-muted-foreground')
                  }
                >
                  {conMiles(cuerpo.length)} de {conMiles(TOPE_CUERPO)} caracteres
                </p>
              )}

              {/* ── Adjuntos ──
                  🔴 **Sólo viajan al MANDAR, nunca al guardar un borrador**: ver el
                  docblock de `adjuntos` más arriba. Por eso el botón vive acá y no
                  cerca de «Para»/«Asunto» — es lo último que se agrega antes de
                  enviar, no parte del sobre. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={inputArchivoRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    agregarArchivos(e.target.files ?? []);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputArchivoRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
                >
                  <Paperclip size={12} />
                  Adjuntar
                </button>
                {adjuntos.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    fotos, videos o documentos — hasta {pesoLegible(TOPE_ADJUNTOS_BYTES)} en total
                  </span>
                )}
                {adjuntos.map((archivo, i) => (
                  <span
                    key={`${archivo.name}-${archivo.size}-${i}`}
                    className="flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-muted/40 py-1 pl-2 pr-1 text-[11px]"
                  >
                    <IconoDeAdjunto tipo={archivo.type} />
                    <span className="min-w-0 flex-1 truncate text-foreground" title={archivo.name}>
                      {archivo.name}
                    </span>
                    <span className="shrink-0 font-mono text-muted-foreground">{pesoLegible(archivo.size)}</span>
                    <button
                      type="button"
                      onClick={() => quitarAdjunto(i)}
                      aria-label={`Quitar el adjunto ${archivo.name}`}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>

              {aviso && (
                <div
                  role="status"
                  className={
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ' +
                    (aviso.tipo === 'ok'
                      ? 'bg-success/10 text-success'
                      : aviso.tipo === 'techo'
                        ? 'border border-warning/40 bg-warning/10 text-warning-foreground'
                        : 'bg-destructive/10 text-destructive')
                  }
                >
                  {aviso.tipo === 'ok' ? (
                    <Check size={13} className="shrink-0" />
                  ) : (
                    <AlertTriangle size={13} className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">{aviso.texto}</span>
                  <button
                    type="button"
                    onClick={() => setAviso(null)}
                    aria-label="Cerrar aviso"
                    className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => enviar.mutate()}
                  disabled={!veredicto.puede}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-[0_4px_16px_-4px_rgba(37,99,235,0.5)] transition-[background-color,transform] duration-200 ease-house hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                >
                  {enviar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar
                </button>
                {/* Un botón gris SIN explicación se lee como que la app se colgó, y lo
                    que hace quien lo mira es apretarlo de nuevo. Por eso el motivo va
                    al lado, y sale de la misma función que apagó el botón. */}
                <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                  {veredicto.puede ? (
                    <>
                      <span className="font-mono">⌘↵</span> para enviar.
                    </>
                  ) : (
                    veredicto.motivo
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Los últimos enviados del equipo ── */}
      </div>

      {adminAbierto && <AdminRemitentes onCerrar={() => setAdminAbierto(false)} />}
    </div>
  );
}

/** Qué dibujar en el chip de un adjunto — por el MIME, no por la extensión. */
function IconoDeAdjunto({ tipo }: { tipo: string }) {
  if (tipo.startsWith('image/')) return <ImagenIcono size={12} className="shrink-0 text-muted-foreground" />;
  if (tipo.startsWith('video/')) return <VideoIcono size={12} className="shrink-0 text-muted-foreground" />;
  if (tipo === 'application/pdf' || tipo.startsWith('text/')) {
    return <FileText size={12} className="shrink-0 text-muted-foreground" />;
  }
  return <ArchivoIcono size={12} className="shrink-0 text-muted-foreground" />;
}
