import { lazy, Suspense, useState } from 'react';
import { Clock, MessageCircle, UserRound } from 'lucide-react';
import { encabezadoSeccion } from './estiloSeccion';
import type { Conversacion } from '../../dominio/conversaciones';
import { marcaDeCliente } from '../../dominio/cliente';
import { BloqueTerritorio } from '../territorio/BloqueTerritorio';
import type { Ficha } from '../cerberus/ficha';
import { useIntereses } from '../gestion/Intereses';
import { useSenales } from '../senales/senales';
import { useEventos, useMutacionesEventos } from '../eventos/eventos';
import { useAgenda } from '../agenda/agenda';
import { PRIORIDADES, useFichaLocal } from './fichaLocal';
import { RegistrarEvento } from '../eventos/RegistrarEvento';
import { FichaRapida } from './FichaRapida';
import { useUnificado } from '../identidad/enlaces';
import { BuscadorContactos } from '../identidad/BuscadorContactos';
import { etiquetaDeOrigen } from '../identidad/etiquetaOrigen';
import { nombreCanal } from '../../components/BadgeCanal';
import { paisDelContacto, paisDelNumero } from '../../dominio/pais';
import { LoQueDijoElBot } from './LoQueDijoElBot';
import { HistorialVacio } from './HistorialVacio';
import { useCategorias, useEtiquetasDe } from '../gestion/categorias';
import { useHistorialDeGestiones } from '../gestion/historialDeGestiones';
import { estadoDelContacto } from './estadoContacto';
import { correoDelContacto, nombreDelContacto, procedenciaDelNombre } from './identidad';
import { ensamblarTimeline } from './timeline';
import { EncabezadoTimeline, type IdentidadDeCabecera } from './EncabezadoTimeline';
import { EventoLinea } from './EventoLinea';
import { PieAccionTimeline } from './PieAccionTimeline';
import { FichaContacto } from '../cerberus/FichaContacto';
import { CarritoDeseado } from './CarritoDeseado';
import type { ProductoElegido } from '../venta/useVenta';
import { metaDelContacto } from './metaDeContacto';
import { deDondeVino } from '../../dominio/origen';
import { useOrigenWa } from '../whatsapp/conversacionWa';
import { personaEsTelefono } from '../../dominio/canal';
import type { DestinoCorreo } from '../../lib/puente';
import { useHistorialLlamadas } from '../llamadas/useLlamadas';
import { usePerfil } from './usePerfil';
import { PanelLlamada } from '../llamadas/PanelLlamada';
import { BarraSeccionesDetalle } from './BarraSeccionesDetalle';
import { seccionInicial, type IdSeccionDetalle } from './pestanas';
import { TilesResumen } from './TilesResumen';
import { ultimaActividad } from './resumenDetalle';
import { comprasUnificadas, ultimaCompra } from './comprasUnificadas';
import { resumenDelContacto } from './resumenDelContacto';

/**
 * PEREZOSO: el cajón de la venta (`FormularioVenta` y lo suyo) sólo se monta
 * después de tocar «Registrar venta». Estático le sumaba al arranque, que está
 * al tope (`scripts/presupuesto-de-chunks.mjs`).
 */
const VentaDesdeElPanel = lazy(() => import('../venta/VentaDesdeElPanel').then((m) => ({ default: m.VentaDesdeElPanel })));

function fichaDeCliente(f: Ficha | undefined): Extract<Ficha, { estado: 'cliente' }> | null {
  return f?.estado === 'cliente' ? f : null;
}

/**
 * 🔴 **EL BUG QUE ESTO ARREGLA (25-ago-2026): con 9 dígitos o menos NO hay
 * código de país que sacar.** Un contacto de campaña tipeado a mano
 * («Registrar contacto») entra tal como la persona lo escribe —
 * `normalizarE164` (`server/src/telefono/identidad.ts`) NO le agrega el
 * código de país si no lo tenía, solo arregla dobles y ceros troncales—, así
 * que «998765423» (9 dígitos, un local peruano sin `51`) llega acá TAL CUAL.
 * La versión vieja asumía que esos primeros dos dígitos SIEMPRE eran el
 * código de país y los cortaba, mostrando «+51 876 542 3» — un teléfono
 * ajeno, con dos dígitos de menos, no el que estaba guardado.
 *
 * 🔴 **13-SEP-2026 — Y EL CÓDIGO NO ES «LO QUE SOBRA ANTES DE LOS ÚLTIMOS 9».**
 * Eso vale para Perú y rompía todo país con un local de otro largo: una
 * dominicana salía «+18 097 961 936» en vez de «+1 809 796 1936». Desde que el
 * número va grande en su propio renglón de la cabecera, se leía a primera vista.
 * El código sale ahora de la lista de países (`dominio/pais.ts`), y un local de
 * 10 dígitos se agrupa 3-3-4, que es como se dicta.
 */
export function formatearTelefono(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  if (digitos.length < 8) return raw;
  const tieneCodigoPais = digitos.length > 9;
  const cc = tieneCodigoPais ? codigoDePais(digitos) : '51';
  const resto = tieneCodigoPais ? digitos.slice(cc.length) : digitos;
  const grupos = resto.length === 10 ? [resto.slice(0, 3), resto.slice(3, 6), resto.slice(6)] : (resto.match(/.{1,3}/g) ?? [resto]);
  return '+' + [cc, ...grupos].join(' ');
}

function codigoDePais(digitos: string): string {
  const conocido = paisDelNumero(digitos)?.codigo;
  if (conocido) return conocido;
  // Un +1 que no es de República Dominicana: `paisDelNumero` no adivina si es Estados
  // Unidos o Canadá, pero el código de un dígito y el local de 10 sí se saben.
  if (digitos.length === 11 && digitos.startsWith('1')) return '1';
  return digitos.slice(0, digitos.length - 9);
}

export function PanelDerecho({
  conversacion,
  miVendedora,
  esDeCampana = false,
  onMandarCorreo,
  onEscribir,
  senalNotas,
}: {
  conversacion: Conversacion;
  /**
   * SEÑAL DEL ATAJO `N` (y de ⌘K): contador que, al cambiar, abre el popover de
   * «Registrar algo del contacto» al pie del timeline.
   *
   * 🔴 **Vive acá desde que el chip «Notas» se fue de la barra del chat**
   * (25-ago-2026): antes la señal moría en `BarraGestion`, que está siempre
   * montada. Este panel se puede CONTRAER, así que el shell lo despliega antes
   * de señalar — sin eso la tecla apuntaría a un componente desmontado y no
   * pasaría nada, que es como se ve un atajo roto.
   */
  senalNotas?: number;
  /**
   * Quién está mirando. Lo usa el timeline para decidir qué eventos puedes
   * editar o borrar — solo los tuyos. Opcional porque la galería monta este
   * panel sin sesión: sin esto, `esMio` da `false` y no se dibuja ningún botón,
   * que es la degradación correcta (nunca al revés).
   */
  miVendedora?: string | null;
  /**
   * ¿Quien mira trabaja en el módulo de CAMPAÑAS? (`modulos/modulo.ts`).
   *
   * 🔴 **Apaga las consultas, no sólo el dibujo.** Dos de los bloques de este
   * panel —el perfil (la ficha de Cerberus, el lead del formulario y el padrón)
   * y los intereses— salen de rutas que para campaña son **403**: sin esto la
   * pantalla se llenaría de errores por pedir cosas que el server ya decidió
   * que no le tocan.
   *
   * ⚠️ Viaja como PROP y no llamando a `useSesion()` acá: ese hook hace su
   * propio fetch al montar, y este panel se monta en tres lugares.
   *
   * ⚠️ Opcional y `false` por default — la galería lo monta sin sesión, y ahí
   * lo correcto es el panel de siempre.
   */
  esDeCampana?: boolean;
  /**
   * Puente a Correos. Sin esto, «Escribirle» no se dibuja (ver el cableado
   * abajo, donde está el porqué de que eso ya haya costado un mes de feature
   * invisible).
   */
  onMandarCorreo?: (destino: DestinoCorreo) => void;
  /** Puente a Mensajes para iniciar un chat nuevo desde la ficha. */
  onEscribir?: (telefono: string) => void;
}) {
  /**
   * El registro de la venta. Vive acá y no adentro del pie porque el pie es
   * presentación: decide cómo se ve el botón, no qué pasa al tocarlo.
   */
  const [vendiendo, setVendiendo] = useState(false);
  /**
   * EL DRAWER DE LA FICHA RÁPIDA, abierto desde acá.
   *
   * Mismo patrón —y mismo motivo— que `vendiendo`: el pie y el bloque son
   * presentación (deciden cómo se ve el botón), no dueños de lo que pasa al
   * tocarlo. Que `BarraGestion` también lo monte no es una segunda
   * implementación: es el MISMO componente montado desde otro lugar, como el
   * panel entero vive en Mensajes, en el Pipeline y en el padrón.
   *
   * 🔴 Y hace falta un segundo punto de montaje porque `BarraGestion` se monta
   * **sólo en `ConversacionActiva`**: desde el Pipeline y desde el padrón, donde
   * este panel se abre como hoja, no había ninguna forma de anotar la ficha.
   */
  const [anotandoFicha, setAnotandoFicha] = useState(false);
  /**
   * «UNIR CON OTRA FICHA», abierto desde el ícono de la cabecera. Vivía adentro de
   * «Quién es», en la pestaña «Datos», que se fue el 13-sep-2026: el buscador se
   * monta acá, al lado de la ficha rápida, por el mismo motivo que ella.
   */
  const [uniendo, setUniendo] = useState(false);
  /**
   * El carrito de la ficha (`CarritoDeseado`): qué quiere llevarse el cliente,
   * armado ANTES de registrar la venta. Vive acá y no en `CarritoDeseado`
   * porque `VentaDesdeElPanel`/`FormularioVenta` lo necesitan como carga
   * inicial — el mismo motivo por el que `vendiendo` vive acá y no en el pie.
   *
   * 🔴 **UNO POR CONVERSACIÓN, no uno solo** — y es a propósito: `PanelDerecho`
   * NO SE REMONTA al cambiar de conversación (sigue siendo el mismo
   * componente, solo cambia la prop `conversacion`), así que un único
   * `useState` habría mostrado el carrito de UN contacto en la ficha de
   * cualquier otro. Se guarda por `clave` —la identidad real de una
   * conversación, no por `persona_id`: dos números propios pueden
   * compartirlo— y cada conversación mantiene el suyo: entrar, salir y volver
   * no lo pierde. Sigue siendo de la SESIÓN nada más (decisión del 19-ago): se
   * pierde si se cierra Hermes, igual que el carrito de `FormularioVenta` hoy.
   */
  const [carritosPorConversacion, setCarritosPorConversacion] = useState<Record<string, ProductoElegido[]>>({});
  const carrito = carritosPorConversacion[conversacion.clave] ?? [];
  function setCarrito(productos: ProductoElegido[]) {
    setCarritosPorConversacion((prev) => ({ ...prev, [conversacion.clave]: productos }));
  }
  /**
   * LA MONEDA QUE SE ELIGIÓ EN EL CARRITO — vive acá y no adentro de
   * `CarritoDeseado`, por el MISMO motivo que el carrito: `VentaDesdeElPanel`
   * la necesita como semilla al abrir «Registrar venta».
   *
   * 🔴 **Y ES DE IDA Y VUELTA** (20-ago-2026, pedido del dueño): cambiar la
   * moneda DENTRO del formulario también actualiza esto —vía
   * `onMonedaCambiar` en `VentaDesdeElPanel`— y por eso el select de
   * `CarritoDeseado` se actualiza solo si la vendedora la corrige ahí
   * adentro. Es la ÚNICA pieza del carrito con este comportamiento:
   * cantidad y precio siguen siendo de una sola vía (`lineasIniciales`
   * solo siembra), porque ésos SÍ son la negociación final y pisarlos de
   * vuelta sería raro; la moneda es un solo dato describiendo la misma
   * venta en dos pantallas, y que dijeran cosas distintas confundía más
   * que la asimetría con los otros dos. Una por conversación, mismo
   * criterio que el carrito.
   */
  const [monedasPorConversacion, setMonedasPorConversacion] = useState<Record<string, string>>({});
  const monedaCarrito = monedasPorConversacion[conversacion.clave] ?? '';
  function setMonedaCarrito(monedaId: string) {
    setMonedasPorConversacion((prev) => ({ ...prev, [conversacion.clave]: monedaId }));
  }
  /**
   * #887 — QUÉ SECCIÓN DEL DETALLE ESTÁ ABIERTA (Resumen · Actividad · Compras;
   * «Datos» se fue a la cabecera el 13-sep-2026), UNA POR CONVERSACIÓN — mismo criterio que el carrito: el panel no
   * se remonta al cambiar de conversación, así que un único `useState` habría
   * mostrado la pestaña de UN contacto en la de cualquier otro.
   */
  const [seccionPorConversacion, setSeccionPorConversacion] = useState<Record<string, IdSeccionDetalle>>({});
  // En campaña «Compras» no existe, y una preferencia por ella cae en Resumen (`pestanas.ts`).
  const seccion = seccionInicial(seccionPorConversacion[conversacion.clave] ?? null, { esDeCampana });
  function setSeccion(id: IdSeccionDetalle) {
    setSeccionPorConversacion((prev) => ({ ...prev, [conversacion.clave]: id }));
  }
  /**
   * 🔴 ACÁ LA PREGUNTA ES «¿HAY TELÉFONO?», NO «¿ES WHATSAPP?» — y se llamaba
   * `esWa`, que es lo que rompió la ficha de los leads de formulario.
   *
   * Los seis usos de abajo (la ficha de Cerberus, el lead-form, la banda de
   * estado, su spinner, el número del encabezado y el «cargando» de Meta) son
   * todos la MISMA pregunta, y para un lead de landing la respuesta es SÍ:
   * `cola/leadsCte.ts` emite el teléfono como `persona_id`. Con el nombre viejo,
   * el panel de Raul Duran salía con «Sin ficha · este canal no lo trae» al lado
   * de su propio número — y sin su correo, que es el insumo para cotizarle.
   *
   * ⚠️ Ninguno de los seis es un permiso de ENVÍO ni un pedido de FOTO: esas son
   * las otras dos preguntas, y siguen siendo solo-WhatsApp (ver `canales/canal.ts`).
   */
  const tieneTelefono = personaEsTelefono(conversacion.canal, conversacion.persona_id);
  const telefono = conversacion.persona_id;

  /**
   * 🔴 LO DE CERBERUS SE APAGA EN CAMPAÑA, y `senales` NO.
   *
   * `/api/contactos/perfil` y `/api/gestiones/intereses` son superficies de
   * `ventas` (`modulos/modulo.ts`): pedirlas desde campaña es un 403 garantizado.
   * `/api/senales` no lo es —«ya le mandaron el precio», «se enfrió» se derivan
   * del hilo y no tocan Cerberus— así que sigue andando para los dos módulos.
   * Que la línea esté acá y no en cada hook es a propósito: es UNA decisión.
   */
  const conCerberus = !esDeCampana;
  /**
   * #1033 — EL PERFIL, UNA SOLA CONSULTA ARMADA EN HERMES.
   *
   * Reemplaza a las tres que este panel pedía al abrirse: la ficha EN VIVO de
   * Cerberus (techo de 12 s, y «sin verificar» para todo cliente porque el
   * detalle da 302), el formulario y el padrón de icarus (F.1). El server las
   * arma con lo que Hermes ya guardó y devuelve las tres formas de siempre, así
   * que lo que las dibuja no cambia (`panel/usePerfil.ts`).
   *
   * ⚠️ `padronDelPerfil` y no `padron`: ese nombre ya lo usa `marcaDeCliente`
   * más abajo (el chip «Ya compró» de la cola, la copia de `clientes_padron`
   * que deliberadamente no tiene nombre ni correo) — otra cosa.
   *
   * ⚠️ Registrar una venta sigue preguntando en vivo, dentro de
   * `VentaDesdeElPanel`: ahí un «no está en la copia» no puede terminar en crear
   * un cliente duplicado en el ERP.
   */
  const perfil = usePerfil(telefono, tieneTelefono && conCerberus);
  const fichaCerberus = perfil.data?.ficha;
  const leadDelPerfil = perfil.data?.lead ?? null;
  const padronDelPerfil = perfil.data?.padron ?? null;
  /**
   * DE DÓNDE VINO, con los nombres de Meta puestos — y es lo que los PONE.
   *
   * ⚠️ **No se apaga en campaña.** El perfil se apaga porque `/api/contactos/perfil`
   * y `/api/gestiones/intereses` son superficies de `ventas` y darían 403; ésta
   * es el hilo de WhatsApp, que las dos mitades ya piden. Y la pregunta «¿de
   * dónde vino esta persona?» tampoco es de un módulo: Betto también compra
   * pauta.
   *
   * ⚠️ **`numero_propio ?? undefined`** y no la cadena vacía: `useOrigenWa` la
   * usa para armar la MISMA clave de caché que el chat, y `''` es una línea
   * distinta de «ninguna» — con la cadena, el panel pediría el hilo por su
   * cuenta con el chat abierto al lado.
   */
  /* ⚠️ **Un lead de formulario NO pide el hilo**: `personaEsTelefono` dice que sí
     para `canal = 'landing'` (tiene teléfono, por eso se le puede escribir), pero
     todavía no hay conversación — el server contestaría `origen: null` y
     `deDondeVino` ya sabe la respuesta por el `tipo`. Es un pedido que no puede
     cambiar nada, y este repo ya pagó caro los pedidos que no cambian nada. */
  const origenWa = useOrigenWa(
    tieneTelefono && conversacion.tipo !== 'lead' ? telefono : null,
    conversacion.numero_propio ?? undefined,
  );
  /**
   * DE DÓNDE VINO, ya resuelto por precedencia (`dominio/origen.ts`): lo que la
   * ficha resolvió contra Meta primero —es lo único que trae los NOMBRES—,
   * después el primer anuncio que la cola ya traía, y al final el «no sabemos».
   */
  const origenDelPanel = deDondeVino({
    tipo: conversacion.tipo,
    canal: conversacion.canal,
    origen_anuncio: conversacion.origen_anuncio,
    ultima_origen: conversacion.ultima_origen,
    resuelto: origenWa.data ?? null,
  });
  /**
   * ⚠️ **`isLoading` y no `isPending`, por el mismo motivo escrito abajo**: con
   * la consulta apagada `isPending` es `true` para siempre y el skeleton no
   * terminaría nunca. Se calcula acá arriba porque lo usan DOS props —el
   * skeleton y la meta— y con la condición escrita dos veces el bloque podría
   * dibujar valores a medio cargar mientras el skeleton dice que todavía carga.
   */
  const cargandoMeta = tieneTelefono && (perfil.isLoading || origenWa.isLoading);
  const { data: senales } = useSenales([conversacion.clave]);
  const { data: intereses } = useIntereses(conversacion.clave, conCerberus);
  const { data: delTimeline } = useEventos(conversacion.clave);
  /**
   * 🔴 **VUELVE A PEDIRSE EN CAMPAÑA, y eso REVIERTE el apagado del 21-ago-2026.**
   * Ese día se apagó acá porque `/api/contactos` era superficie de `ventas` y
   * esto era un 403 garantizado en cada apertura. La causa se arregló donde
   * estaba: la ficha rápida escribe en `contacto_ficha`, una tabla de Hermes, y
   * desde el 23-ago es CRM genérico de los dos módulos
   * (`server/src/modulos/modulo.ts`). Apagarla acá trataba el síntoma y le
   * costaba a la campaña el bloque que le dice quién es la persona.
   *
   * ⚠️ **No lleva `conCerberus` y no es un olvido**: `conCerberus` responde «¿le
   * puedo preguntar al ERP?», y esto no le pregunta nada al ERP.
   */
  const fichaLocal = useFichaLocal(conversacion.clave);
  /**
   * LAS ETIQUETAS Y SU CATÁLOGO — CRM genérico, o sea los DOS módulos.
   *
   * No llevan `conCerberus`: `/api/gestiones/etiquetas` y `/api/categorias` no le
   * preguntan nada al ERP, y desde ADR 0078 el catálogo ya viene recortado al
   * módulo de quien mira. La lectura es la MISMA que usa `BarraGestion`
   * (`useEtiquetasDe`), así que poner una etiqueta en el chat la refresca acá sin
   * que nadie cablee los dos componentes entre sí.
   */
  const { data: etiquetas } = useEtiquetasDe(conversacion.clave);
  const { data: categorias } = useCategorias();
  const { agenda } = useAgenda();
  const { editar, borrar } = useMutacionesEventos(conversacion.clave);

  const padron = marcaDeCliente(conversacion);
  const llamadas = useHistorialLlamadas(conversacion.persona_id);
  const estado = estadoDelContacto({
    conTelefono: tieneTelefono,
    cargando: perfil.isPending && tieneTelefono,
    error: perfil.isError,
    ficha: fichaCerberus,
    /**
     * ⚠️ `?.` DESPUÉS DE `senales`, TAMBIÉN.
     *
     * `senales?.senales[clave]` sólo protege que la RESPUESTA sea undefined; si
     * el cuerpo llega sin la clave `senales` —un cuerpo de error, una forma que
     * cambió— entonces `undefined[clave]` **tumba el panel entero**, y no hay
     * ErrorBoundary en `src/`: se lleva puesta la app.
     *
     * Se encontró abriendo la ficha desde el Dashboard, pero el defecto era de
     * `PanelDerecho` y valía igual en Pipeline y en el padrón.
     */
    enfriada: senales?.senales?.[conversacion.clave]?.enfriamiento?.enfriada ?? false,
    padron: padron?.nivel ?? null,
    sinCerberus: esDeCampana,
  });

  const cliente = fichaDeCliente(fichaCerberus);

  const nombreData = nombreDelContacto({
    pushname: conversacion.persona_nombre,
    leadNombre: leadDelPerfil?.nombre ?? null,
    cerberusNombre: cliente?.nombre ?? null,
    icarusNombre: padronDelPerfil?.nombre ?? null,
    // Lo que el equipo anotó a mano en «Registrar contacto» — sin esto, un
    // contacto de campaña recién creado (sin Cerberus ni lead-form) seguía
    // diciendo «Sin nombre» aunque ya estuviera guardado (`identidad.ts`).
    fichaNombre: [fichaLocal.data?.nombre, fichaLocal.data?.apellido].filter(Boolean).join(' ').trim() || null,
  });

  const timeline = ensamblarTimeline({
    ficha: fichaCerberus,
    intereses: intereses?.lista,
    senales: senales?.senales?.[conversacion.clave],
    leadForm: leadDelPerfil ? { campana: leadDelPerfil.campana ?? undefined, fecha: leadDelPerfil.fecha } : undefined,
    conversacion: { persona_nombre: conversacion.persona_nombre ?? undefined, lead_nombre: conversacion.lead_nombre ?? undefined },
    // Para que el timeline no repita como «evento» el nombre que el encabezado
    // ya tiene escrito 30 px más arriba. Ver el docblock de `nombreMostrado`.
    nombreMostrado: nombreData.principal,
    // #887 — el alias ya se muestra en la cabecera (más abajo); no hace
    // falta repetirlo como un evento sin fecha en Actividad.
    aliasMostrado: nombreData.alias,
    eventos: delTimeline?.eventos ?? [],
    correos: delTimeline?.correos ?? [],
    yo: miVendedora,
    fichaLocal: fichaLocal.data,
    // Sólo los de ESTA conversación: `useAgenda` trae la agenda entera de quien
    // mira (una sola query compartida con el riel y la vista Agenda), y el
    // timeline es de una persona.
    seguimientos: agenda.data?.recordatorios?.filter((r) => r.clave === conversacion.clave),
    sinCerberus: esDeCampana,
    llamadas: llamadas.data?.llamadas,
  });

  const nombre = nombreData.principal ?? 'Sin nombre';

  // #887 — «Resumen»: los tres tiles se derivan de lo que YA se pidió (el
  // timeline y las compras unificadas de F.5), sin una consulta más.
  const comprasDelContacto = comprasUnificadas(fichaCerberus, padronDelPerfil?.compras);
  // #1033 — la lista muestra todo lo que vino de Cerberus, marcado; los tiles
  // cuentan sólo lo que es compra (`dominio/estadosVenta.ts`: 1, 2 y 9). Una
  // cotización no es «la última compra» ni suma al total.
  const comprasQueCuentan = comprasDelContacto.filter((c) => c.esCompra);
  const laUltimaActividad = ultimaActividad(timeline.grupos);
  const laUltimaCompra = ultimaCompra(comprasQueCuentan);

  /**
   * #1033 — PAÍS Y OCUPACIÓN, UN CAMPO POR HECHO: lo que el cliente declaró en
   * Cerberus al comprar antes que el padrón de icarus. Nunca del prefijo del
   * teléfono, que es una probabilidad y no un dato (`bot/identidad.ts`).
   */
  const paisDelPerfil = cliente?.pais || padronDelPerfil?.pais || null;
  const ocupacionDelPerfil = cliente?.ocupacion || padronDelPerfil?.ocupacion || null;

  /**
   * ══ LA TARJETA DE IDENTIDAD DE LA CABECERA (dueño, 13-sep-2026) ══════════════
   *
   * «Apartado Datos ya no existirá, lo pondremos de forma elegante arriba: 1
   * número, 1 correo, 1 nombre, 1 país.» Todo lo que vivía en «Quién es» se
   * resuelve acá UNA vez y la cabecera sólo lo dibuja:
   *
   *   · el país, como bandera: el declarado (Cerberus, icarus) o, si no hay, el del
   *     código del número, avisado (`dominio/pais.ts`);
   *   · el correo por precedencia, con su fuente al pasar el mouse
   *     (`correoDelContacto`);
   *   · ocupación y empresa junto al país; las fichas unidas en un renglón;
   *   · Editar y Unir como íconos; el código de cliente y el DNI en el `title` del
   *     chip «Cliente».
   *
   * ⚠️ Nada de esto le agrega una consulta al panel: son los mismos datos que ya
   * se pedían para «Quién es».
   */
  const { data: unificado } = useUnificado(conversacion.clave);
  const origenesUnidos = unificado?.origenes ?? [];
  const correoDeLaCabecera = correoDelContacto({
    anotado: fichaLocal.data?.email,
    cerberus: cliente?.correo,
    icarus: padronDelPerfil?.correo,
    lead: leadDelPerfil,
  });
  const paisDeclarado = cliente?.pais
    ? { valor: cliente.pais, fuente: 'de Cerberus' }
    : padronDelPerfil?.pais
      ? { valor: padronDelPerfil.pais, fuente: 'de icarus' }
      : null;
  const prioridad = PRIORIDADES.find((p) => p.id === fichaLocal.data?.prioridad);
  const identidad: IdentidadDeCabecera = {
    procedenciaNombre: procedenciaDelNombre(nombreData),
    alias: nombreData.alias,
    pais: paisDelContacto({ declarado: paisDeclarado?.valor, telefono: tieneTelefono ? telefono : null }),
    fuentePais: paisDeclarado?.fuente ?? null,
    // «Empresa» no se ofrece en campaña (tampoco en el drawer): mostrarla sería un dato
    // que el operador ve y no puede corregir desde ningún lado.
    detalles: [ocupacionDelPerfil, esDeCampana ? null : fichaLocal.data?.empresa].filter(
      (d): d is string => Boolean(d?.trim()),
    ),
    correo: correoDeLaCabecera,
    cargandoCorreo: fichaLocal.isLoading || (conCerberus && perfil.isLoading),
    // 🔴 UN SOLO «Escribirle», en el renglón que tiene el correo (el candado es
    // `QuienEs.test.tsx`). La `clave` viaja para que el correo quede en el timeline
    // de ESTA conversación (`lib/puente.ts`).
    // ⚠️ `escribirCorreo` y no `on…Correo`: el candado de `puenteCorreo.test.ts` lee cada
    // `on…Correo:` después de `export function PanelDerecho` como una prop del panel.
    escribirCorreo:
      onMandarCorreo && correoDeLaCabecera.valor
        ? () =>
            onMandarCorreo({
              para: correoDeLaCabecera.valor,
              clave: conversacion.clave,
              nombre: nombreData.principal ?? undefined,
            })
        : undefined,
    // `etiquetaDeOrigen` es la MISMA que usa `PersonaUnificada`: con dos reglas, la
    // misma ficha unida se llamaría distinto en dos lugares.
    tambien: origenesUnidos.map((o) => `${nombreCanal(o.canal)} · ${etiquetaDeOrigen(o.canal, o.personaId, o.nombre)}`),
    detalleEstado: cliente
      ? ['Cliente de Cerberus', cliente.codigo, cliente.dni && `DNI ${cliente.dni}`].filter(Boolean).join(' · ')
      : null,
    // En campaña el lápiz no va: «Anotar quién es» ya está en el pie, y dos puertas
    // al mismo drawer en la misma pantalla son una de más.
    onEditar: esDeCampana ? undefined : () => setAnotandoFicha(true),
    onUnir: conversacion.clave.startsWith('conv:') ? () => setUniendo(true) : undefined,
    // Sin `llamar`: la llamada es `PanelLlamada`, debajo de la cabecera (ADR 0123).
    // Interés es superficie de `ventas` (`/api/gestiones/intereses` es 403 en campaña):
    // en campaña no hay renglón, en ventas está aunque esté vacío.
    interes: esDeCampana ? undefined : (intereses?.lista?.map((i) => i.curso) ?? []),
    prioridad: prioridad ? { rotulo: prioridad.rotulo, punto: prioridad.punto } : null,
  };

  /**
   * #1033 — EL PERFIL EN UNA FRASE, con lo verificado y sin LLM
   * (`resumenDelContacto.ts`). Se arma con lo que el panel ya tiene: no pide
   * nada más.
   *
   * 🔴 Sólo en ventas: es la ficha de Goberna, no la de Betto ni la de Américo
   * (dueño, 13-sep-2026). En campaña la etapa y la última actividad alcanzaban
   * para armar una frase igual; el candado es `PanelDerecho.campana.test.tsx`.
   */
  const textoDelPerfil = esDeCampana
    ? null
    : resumenDelContacto({
        esCliente: Boolean(cliente),
        pais: paisDelPerfil,
        ocupacion: ocupacionDelPerfil,
        compras: comprasDelContacto,
        intereses: intereses?.lista?.map((i) => i.curso) ?? [],
        etapa: conversacion.etapa_efectiva ?? null,
        ultimaActividad: laUltimaActividad,
      });

  const chips: string[] = [];
  if (padron?.nivel === 'vip') {
    chips.push('VIP');
  }

  // Por qué se perdió (ADR 0107): se pide sólo si está en «Dijo que no», que es rara.
  const historialDeGestiones = useHistorialDeGestiones(conversacion.clave, conversacion.etapa_efectiva === 'perdido');

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
      <EncabezadoTimeline
        nombre={nombre}
        identidad={identidad}
        telefono={tieneTelefono && telefono ? formatearTelefono(telefono) : ''}
        canal={conversacion.canal}
        tipoDeFila={conversacion.tipo}
        telefonoCrudo={tieneTelefono ? telefono : null}
        numeroPropio={conversacion.numero_propio}
        etapa={conversacion.etapa_efectiva}
        perdida={historialDeGestiones.data?.perdida ?? null}
        etiquetas={etiquetas}
        categorias={categorias}
        acento={estado.acento}
        tituloEstado={estado.titulo}
        compras={estado.compras}
        chips={chips}
        /**
         * 🔴 `isLoading`, NUNCA `isPending` — Y ESTO NO ERA LENTITUD, ERA UN
         * SKELETON QUE NO TERMINABA NUNCA.
         *
         * En React Query **v5** el estado `idle` no existe: una query con
         * `enabled: false` se queda en `status: 'pending'` **para siempre**. Y
         * el perfil está apagado en campaña (`conCerberus`), así que
         * `perfil.isPending` sería `true` eterno y las dos barras de
         * `BloqueMetaSkeleton` pulsarían hasta que la vendedora cerrara la ficha.
         * Se reportó como «el detalle del contacto se demora tanto en cargar»;
         * no se demoraba, no iba a cargar.
         *
         * `isLoading` es `isPending && isFetching`, o sea «pendiente Y de verdad
         * pidiendo»: con la query apagada da `false`. Se arregla acá y no con un
         * `&& conCerberus` porque la causa es la lectura del estado, no el
         * módulo — con el `&&`, el próximo que apague una query se come el mismo
         * skeleton eterno sin un solo síntoma.
         */
        cargandoMeta={cargandoMeta}
        /**
         * ══ «ORIGEN» AHORA SE DIBUJA SIEMPRE, Y SE RESUELVE POR PRECEDENCIA ══
         *
         * 🔴 **Antes este bloque entero era `null` sin lead de formulario**, o
         * sea que la ficha de la enorme mayoría de las conversaciones —11.016
         * personas escribieron en 90 días, 3.257 traen anuncio— no decía una
         * palabra sobre de dónde venían. Ni «vino de un anuncio», que Hermes
         * sabía, ni «no sabemos», que es la otra respuesta legítima. Ese
         * silencio es lo que se leyó como «no vino de ningún lado» el
         * 6-sep-2026.
         *
         * Y no se arregla poniendo un bloque nuevo al lado: **un campo por
         * hecho, resuelto por precedencia, con la fuente anotada** — la regla
         * que `identidad.ts` documenta y que este bloque estaba salteando. El
         * anuncio de Click-to-WhatsApp gana porque es lo más específico que
         * hay (sabemos el creativo y la campaña); el formulario respalda; si no
         * hay ninguno de los dos, «Sin origen» **lo dice** y el `title` explica
         * los dos motivos por los que puede faltar.
         *
         * ⚠️ La precedencia entera vive en `metaDeContacto.ts` y no acá adentro
         * porque la galería de evidencia arma la MISMA cabecera: con la cuenta
         * escrita en el JSX, la galería tendría que copiarla, y una galería que
         * calcula por su cuenta puede verse bien con la app rota (regla dura
         * #10). La palabra del formulario sale de `origenDeLead`, la misma que
         * la fila del radar: acá decía «Web» y la fila «Landing» sobre el mismo
         * hecho.
         */
        meta={cargandoMeta ? null : metaDelContacto(origenDelPanel, leadDelPerfil)}
        resumenIa={null}
      />
      {/* #887 — LA CABECERA PERSISTENTE, la misma en todas las pestañas. Desde el
          13-sep-2026 es entera de `EncabezadoTimeline`: la identidad, la tarjeta
          «Contacto» y la tarjeta «De dónde viene» (con el interés y la prioridad
          como renglones). 🔴 #1033 — «Cerberus · sin verificar» se fue: la ficha
          sale de la copia local, verificada por construcción.
          La llamada NO es un ícono de la tarjeta: es `PanelLlamada` (ADR 0123),
          que consulta el permiso a Meta antes de pedirlo. El `BotonLlamar` que
          iba de ícono se retiró como predecesor (#1049, #1050). */}
      {tieneTelefono && <PanelLlamada conversacion={conversacion} />}
      <BarraSeccionesDetalle activa={seccion} onCambiar={setSeccion} esDeCampana={esDeCampana} />
      {/* 🔴 **`hidden`, NUNCA un `&&` que desmonta.** `RegistrarEvento` (en
          Actividad) escucha `senalAbrir` — un contador que sube desde el shell
          con el atajo `N` — y React sólo puede reaccionar a un prop en un
          componente MONTADO. Desmontar la sección al cambiar de pestaña
          rompía el atajo apenas la vendedora no estaba parada en Actividad,
          sin un solo error: `senalNotas` subía y no había quién lo escuchara. */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        <div className={seccion === 'resumen' ? '' : 'hidden'}>
          {/* ══ RESUMEN, COMPACTO (dueño, 13-sep-2026, sobre una referencia) ══════
              Una tarjeta —la última actividad y las compras, con el producto que
              compró a la vista— y debajo el perfil en la suya. «Registrar
              actividad» ya no se repite acá: la puerta es la de Actividad, y la tecla
              `N` la abre desde cualquier pestaña. */}
          <div className="space-y-2.5 px-4 py-3">
            {/* 🔴 En campaña, sin renglón de compras (regla del dueño, 11-sep-2026):
                el detalle de campaña no habla de ventas. Ver `TilesResumen`. */}
            <TilesResumen
              actividad={laUltimaActividad}
              compra={laUltimaCompra}
              totalCompras={comprasQueCuentan.length}
              montoTotal={esDeCampana ? null : estado.compras}
              /* La verdad de la ficha, no un cero: mientras viaja no hay «Sin
                 compras», y si no cargó el renglón lo dice y ofrece reintentar
                 (reemplaza al chip «No se pudo saber», 13-sep-2026). */
              estadoCompras={
                !tieneTelefono
                  ? 'listo'
                  : perfil.isError || fichaCerberus?.estado === 'error'
                    ? 'error'
                    : perfil.isPending
                      ? 'cargando'
                      : 'listo'
              }
              onReintentar={() => void perfil.refetch()}
              onVerTodasLasCompras={comprasDelContacto.length > 0 ? () => setSeccion('compras') : undefined}
              conCompras={!esDeCampana}
            />
            {/* #1033 — el perfil en una frase. Sin nada verificado que decir no se dibuja:
                un hueco permanente enseña a no mirarlo (ADR 0080). */}
            {textoDelPerfil && (
              <section aria-label="Perfil" className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5">
                <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <UserRound size={12} aria-hidden /> Perfil
                </h3>
                <p className="text-[12.5px] leading-relaxed text-foreground">{textoDelPerfil}</p>
              </section>
            )}
          </div>
          {/* ══ LO QUE VIVÍA EN «DATOS», REUBICADO SIN PERDER NADA (13-sep-2026) ══
              La identidad subió a la cabecera; lo que no es un dato de identidad
              sino algo que el sistema ya sabe o decide viene a Resumen:
              · «Lo que dijo el bot» — sólo si el bot dijo algo; en campaña la
                columna llega nula y no aparece.
              · «Dónde vota» (ADR 0063) — sólo en campaña: se apaga solo con
                `activo={false}`, así que en ventas no se monta ni pide nada. */}
          <LoQueDijoElBot conversacion={conversacion} />
          <BloqueTerritorio clave={conversacion.clave} activo={esDeCampana} />
        </div>
        <div className={seccion === 'actividad' ? '' : 'hidden'}>
        {/* El MISMO ritmo vertical que «Quién es» y «Locación» (`px-4 py-3`):
            eran tres paddings distintos —2.5, 3 y 3.5— en tres secciones
            apiladas de la misma columna, y esa clase de deriva no se ve de a una
            pero hace que el conjunto se lea desprolijo. */}
        <div className="px-4 py-3">
          {onEscribir && telefono && tieneTelefono && conversacion.n === 0 && (
            <button
              type="button"
              onClick={() => onEscribir(telefono)}
              className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <MessageCircle size={13} /> Escribirle
            </button>
          )}
          <h3 className={encabezadoSeccion}>
            {/* «Qué pasó», no «Timeline»: es la única palabra en inglés que
                le quedaba a esta pantalla, y nombra lo que la vendedora viene a
                leer. Los rótulos de adentro ya estaban todos en castellano. */}
            <Clock size={14} className="text-muted-foreground" /> Qué pasó
          </h3>
          {timeline.grupos.length === 0 && <HistorialVacio />}
          <ol className="mt-1.5">
            {timeline.grupos.map((grupo) => (
              <li key={grupo.etiqueta}>
                {/* Sin `uppercase`. El grupo más frecuente de una conversación
                    nueva es «Sin fecha», y en versalitas —«SIN FECHA»— se lee
                    como un dato roto y no como el encabezado de un montón. Los
                    otros valores son «Hoy», «Ayer» y «12 ago»: ninguno gana
                    nada gritado. */}
                <h4 className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                  {grupo.etiqueta}
                </h4>
                <ol className="mt-0.5">
                  {grupo.eventos.map((e, i) => (
                    <EventoLinea
                      key={e.id}
                      e={e}
                      esUltimo={i === grupo.eventos.length - 1}
                      onEditar={(id, nota) => editar.mutate({ id, nota: nota || null, curso: e.valor ?? null })}
                      onBorrar={(id) => borrar.mutate(id)}
                    />
                  ))}
                </ol>
              </li>
            ))}
          </ol>

          {/* ══ REGISTRAR ALGO EN EL TIMELINE ══════════════════════════════
              Va al PIE de la lista y no arriba: la pregunta que contesta es
              «pasó algo más», y esa se hace después de leer lo que ya pasó.

              🔴 **Y es la ÚNICA puerta desde el 25-ago-2026.** Tenía un gemelo
              —el chip «Notas» en la barra del chat— que era este MISMO
              componente abriendo el MISMO popover sobre el MISMO contacto. Se
              sacó el de la barra (pedido del dueño): dos botones para un gesto,
              y uno de ellos en la barra que ya pelea el ancho a 1280. */}
          <div className="mt-3">
            <RegistrarEvento
              clave={conversacion.clave}
              senalAbrir={senalNotas ?? 0}
              esDeCampana={esDeCampana}
              rotuloBoton="Registrar actividad"
            />
          </div>
        </div>
        </div>
        {/* 🔴 En campaña la sección entera NO SE MONTA, no sólo se esconde: el
            DOM oculto con `hidden` sigue siendo parte de la pantalla (lectores,
            búsqueda del navegador) y el detalle de campaña no lleva nada de
            compras. Acá desmontar es seguro — lo que obliga a `hidden` en las
            otras secciones es `RegistrarEvento`, que vive en Actividad. */}
        {!esDeCampana && (
        <div className={seccion === 'compras' ? '' : 'hidden'}>
        <div className="px-4 py-3">
          {/* ══ LA FICHA DE CERBERUS ══════════════════════════════════════
              `FichaContacto` estaba HUÉRFANO: el componente que muestra DNI,
              correo, código de cliente y los folios con estado, fecha y monto
              existía entero y `grep '<FichaContacto' src/` daba **cero**. Se
              dejó de renderizar cuando el rediseño del timeline reemplazó al
              panel viejo, y solo sobrevivió su hook `useFicha` —que es por lo
              que la banda de arriba seguía diciendo «Cliente» sin que se
              pudiera ver una sola compra.

              Va DEBAJO del timeline y no arriba: el timeline es la narración
              («qué pasó con esta persona») y la ficha es la referencia («cuál
              es su DNI, qué folios tiene»). Se consulta, no se lee de corrido.

              `embebida`: el marco y el encabezado los pone el panel; sin esto
              dibujaría una segunda tarjeta con el nombre repetido. */}
          {/* 🔴 **SÓLO SI HAY ALGO DE COMPRAS QUE MOSTRAR.** Antes este bloque
              siempre tenía contenido, porque adentro vivían el lead-form y «La
              misma persona»; al mudarlos a «Quién es» (ADR 0083), para un lead
              que NO es cliente `FichaContacto` pasó a devolver `null` y quedaba
              **el encabezado solo, con el hueco abajo** — lo reportó una captura
              del dueño el mismo día.

              Se dibuja con `cliente` (hay folios), y también mientras la
              consulta viaja o si falló: ahí el esqueleto y el «Buscar de nuevo»
              SON el contenido. Con `nuevo` no se dibuja nada, que es la verdad:
              esta persona no compró y no hay una lista que enseñar. */}
          {conCerberus && (perfil.isPending || perfil.isError || fichaCerberus?.estado !== 'nuevo') && (
          <div>
            {/* Sin encabezado propio (13-sep-2026): «Lo que compró» iba arriba de
                «Compras», que `FichaContacto` ya dibuja. Dos títulos para una lista. */}
            {/* 🔴 EL SEGUNDO PUENTE MUERTO DE ESTE MISMO COMPONENTE, y el
                diagnóstico es idéntico al de tres líneas más arriba: hasta hoy
                `grep 'onCorreo=' src/` daba **CERO**. `FichaContacto` declaraba
                la prop, dibujaba «Escribirle» solo si le llegaba (o sea: nunca)
                y nadie se la pasaba — así que **la acción no existió en la app
                durante casi un mes**, con el correo del contacto ahí al lado.

                ⚠️ El patrón «prop opcional que esconde la feature cuando falta»
                se rompe SIN un solo síntoma: no hay error, no hay log, no hay
                test rojo y la pantalla se ve perfecta. Es correcto como diseño
                —un botón que no hace nada es peor— pero obliga a que el
                cableado sea lo primero que se verifique, no lo último.

                Acá se le suma la `clave`: la ficha sabe a quién escribirle, y
                sólo el panel sabe DE QUÉ conversación salió. Sin eso el correo
                se guarda con `clave = NULL` y desaparece del timeline de esta
                misma persona (ver `lib/puente.ts`). */}
            {/* 🔴 #1033 — `datos`: la pestaña está MONTADA aunque no se vea
                (`hidden`), así que sin esto `FichaContacto` volvería a pedirle a
                Cerberus en vivo en cada apertura, que es justo lo que el perfil
                vino a sacar. */}
            <FichaContacto
              conversacion={conversacion}
              embebida
              datos={{
                ficha: fichaCerberus,
                cargando: perfil.isPending,
                error: perfil.isError,
                padron: padronDelPerfil,
                lead: leadDelPerfil,
              }}
              onCorreo={
                onMandarCorreo
                  ? (destino) =>
                      onMandarCorreo({
                        ...destino,
                        clave: destino.clave ?? conversacion.clave,
                        // El nombre resuelto (Cerberus > formulario > alias de
                        // WhatsApp, #118), no el crudo del canal: es lo que la
                        // vendedora tiene delante de los ojos al tocar el botón.
                        nombre: destino.nombre ?? nombreData.principal ?? undefined,
                      })
                  : undefined
              }
            />
            {/* ══ EL CARRITO DE LA FICHA ════════════════════════════════════
                Solo cuando YA es cliente en Cerberus (`cliente` truthy):
                pedir «qué va a comprar» antes de que la venta pueda existir
                sería la misma trampa que el alta de cliente vino a resolver —
                acá el orden real es al revés (primero está creado, después
                arma qué se lleva). Va DENTRO del mismo bloque con borde para
                leerse como una unidad con la ficha, no como algo suelto. */}
            {cliente && (
              <CarritoDeseado
                productos={carrito}
                onCambiar={setCarrito}
                monedaId={monedaCarrito}
                onMonedaCambiar={setMonedaCarrito}
              />
            )}
          </div>
          )}
        </div>
        </div>
        )}
      </div>
      {/* ⚠️ EL `onVender` ES LO QUE FALTABA. Sin él, `PieAccionTimeline` no
          dibuja nada —por diseño: nunca un no-op— y el botón de registrar la
          venta era invisible en TODOS los estados, no solo en algunos. */}
      {/* ⚠️ En campaña NO se le pasa `onVender`, y con eso el pie no dibuja el
          botón — es su diseño («nunca un no-op»), así que no hace falta un `if`
          nuevo. Registrar una venta escribe en el ERP de la Escuela
          (`/api/venta`, superficie de `ventas`): ahí el botón existiría para
          contestar 403. */}
      {/* ⚠️ En campaña NO va `onVender` — registrar una venta escribe en el ERP
          de la Escuela (`/api/venta`, superficie de `ventas`), así que ahí el
          botón existiría para contestar 403. Lo que va en su lugar es la ficha
          rápida: la acción central del comando de campaña según ADR 0080. Un
          módulo, un handler: nunca los dos. */}
      <PieAccionTimeline
        estado={estado}
        onVender={conCerberus ? () => setVendiendo(true) : undefined}
        onAnotarQuienEs={conCerberus ? undefined : () => setAnotandoFicha(true)}
        tieneFicha={Boolean(fichaLocal.data)}
      />
      {anotandoFicha && (
        <FichaRapida
          conversacion={conversacion}
          esDeCampana={esDeCampana}
          onCerrar={() => setAnotandoFicha(false)}
        />
      )}
      {uniendo && (
        <BuscadorContactos
          clave={conversacion.clave}
          nombreActual={nombreData.principal ?? telefono ?? 'este contacto'}
          yaEnlazadas={origenesUnidos.flatMap((o) => o.claves)}
          onCerrar={() => setUniendo(false)}
        />
      )}
      {/* Su propio Suspense, como la barra de la llamada: el cajón sólo existe
          después de tocar «Registrar venta», así que no paga el arranque. */}
      {vendiendo && (
        <Suspense fallback={null}>
          <VentaDesdeElPanel
            conversacion={conversacion}
            onCerrar={() => setVendiendo(false)}
            carritoInicial={carrito}
            monedaInicial={monedaCarrito}
            onMonedaCambiar={setMonedaCarrito}
          />
        </Suspense>
      )}
    </div>
  );
}
