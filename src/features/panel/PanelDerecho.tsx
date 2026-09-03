import { useState } from 'react';
import { Clock, IdCard, MessageCircle } from 'lucide-react';
import { encabezadoSeccion } from './estiloSeccion';
import type { Conversacion } from '../../dominio/conversaciones';
import { marcaDeCliente } from '../../dominio/cliente';
import { useFicha } from '../cerberus/useFicha';
import { BloqueTerritorio } from '../territorio/BloqueTerritorio';
import type { Ficha } from '../cerberus/ficha';
import { useLeadForm } from '../cerberus/BloqueLeadForm';
import { useIntereses } from '../gestion/Intereses';
import { useSenales } from '../senales/senales';
import { useEventos, useMutacionesEventos } from '../eventos/eventos';
import { useAgenda } from '../agenda/agenda';
import { useFichaLocal } from './fichaLocal';
import { RegistrarEvento } from '../eventos/RegistrarEvento';
import { FichaRapida } from './FichaRapida';
import { QuienEs } from './QuienEs';
import { HistorialVacio } from './HistorialVacio';
import { useCategorias, useEtiquetasDe } from '../gestion/categorias';
import { estadoDelContacto } from './estadoContacto';
import { nombreDelContacto } from './identidad';
import { ensamblarTimeline } from './timeline';
import { EncabezadoTimeline } from './EncabezadoTimeline';
import { EventoLinea } from './EventoLinea';
import { PieAccionTimeline } from './PieAccionTimeline';
import { FichaContacto } from '../cerberus/FichaContacto';
import { VentaDesdeElPanel } from '../venta/VentaDesdeElPanel';
import { CarritoDeseado } from './CarritoDeseado';
import type { ProductoElegido } from '../venta/useVenta';
import { origenDeLead } from '../cerberus/leadForm';
import { personaEsTelefono } from '../../dominio/canal';
import type { DestinoCorreo } from '../../lib/puente';
import { useHistorialLlamadas } from '../llamadas/useLlamadas';
import { BotonLlamar } from '../llamadas/BotonLlamar';

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
 */
export function formatearTelefono(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  if (digitos.length < 8) return raw;
  const tieneCodigoPais = digitos.length > 9;
  const cc = tieneCodigoPais ? digitos.slice(0, digitos.length - 9) : '51';
  const resto = tieneCodigoPais ? digitos.slice(cc.length) : digitos;
  const grupos = resto.match(/.{1,3}/g) ?? [resto];
  return '+' + [cc, ...grupos].join(' ');
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
   * 🔴 **Apaga las consultas, no sólo el dibujo.** Tres de los bloques de este
   * panel —la ficha de Cerberus, el lead del formulario y los intereses— salen
   * de rutas que para campaña son **403**: sin esto la pantalla se llenaría de
   * errores por pedir cosas que el server ya decidió que no le tocan.
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
   * 🔴 LAS TRES DE CERBERUS SE APAGAN EN CAMPAÑA, y `senales` NO.
   *
   * `/api/contactos` y `/api/gestiones/intereses` son superficies de `ventas`
   * (`modulos/modulo.ts`): pedirlas desde campaña es un 403 garantizado.
   * `/api/senales` no lo es —«ya le mandaron el precio», «se enfrió» se derivan
   * del hilo y no tocan Cerberus— así que sigue andando para los dos módulos.
   * Que la línea esté acá y no en cada hook es a propósito: es UNA decisión.
   */
  const conCerberus = !esDeCampana;
  const ficha = useFicha(telefono, tieneTelefono && conCerberus);
  const lead = useLeadForm(telefono, tieneTelefono && conCerberus);
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
    cargando: ficha.isPending && tieneTelefono,
    error: ficha.isError,
    ficha: ficha.data,
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

  const cliente = fichaDeCliente(ficha.data);

  const nombreData = nombreDelContacto({
    pushname: conversacion.persona_nombre,
    leadNombre: lead.data?.lead?.nombre ?? null,
    cerberusNombre: cliente?.nombre ?? null,
    // Lo que el equipo anotó a mano en «Registrar contacto» — sin esto, un
    // contacto de campaña recién creado (sin Cerberus ni lead-form) seguía
    // diciendo «Sin nombre» aunque ya estuviera guardado (`identidad.ts`).
    fichaNombre: [fichaLocal.data?.nombre, fichaLocal.data?.apellido].filter(Boolean).join(' ').trim() || null,
  });

  const timeline = ensamblarTimeline({
    ficha: ficha.data,
    intereses: intereses?.lista,
    senales: senales?.senales?.[conversacion.clave],
    leadForm: lead.data?.lead ? { campana: lead.data.lead.campana ?? undefined, fecha: lead.data.lead.fecha } : undefined,
    conversacion: { persona_nombre: conversacion.persona_nombre ?? undefined, lead_nombre: conversacion.lead_nombre ?? undefined },
    // Para que el timeline no repita como «evento» el nombre que el encabezado
    // ya tiene escrito 30 px más arriba. Ver el docblock de `nombreMostrado`.
    nombreMostrado: nombreData.principal,
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

  const chips: string[] = [];
  if (padron?.nivel === 'vip') {
    chips.push('VIP');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
      <EncabezadoTimeline
        nombre={nombre}
        telefono={tieneTelefono && telefono ? formatearTelefono(telefono) : ''}
        canal={conversacion.canal}
        tipoDeFila={conversacion.tipo}
        telefonoCrudo={tieneTelefono ? telefono : null}
        numeroPropio={conversacion.numero_propio}
        etapa={conversacion.etapa_efectiva}
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
         * `useLeadForm` está apagada en campaña (`conCerberus`), así que
         * `lead.isPending` era `true` eterno y las dos barras de
         * `BloqueMetaSkeleton` pulsaban hasta que la vendedora cerrara la ficha.
         * Se reportó como «el detalle del contacto se demora tanto en cargar»;
         * no se demoraba, no iba a cargar.
         *
         * `isLoading` es `isPending && isFetching`, o sea «pendiente Y de verdad
         * pidiendo»: con la query apagada da `false`. Se arregla acá y no con un
         * `&& conCerberus` porque la causa es la lectura del estado, no el
         * módulo — con el `&&`, el próximo que apague una query se come el mismo
         * skeleton eterno sin un solo síntoma.
         */
        cargandoMeta={tieneTelefono && lead.isLoading}
        meta={
          lead.data?.lead
            ? {
                // La MISMA palabra que la fila del radar (`origenDeLead`): acá
                // decía «Web» y la fila «Landing», sobre el mismo hecho.
                origen: origenDeLead(lead.data.lead.fuente),
                campana: lead.data.lead.campana ?? lead.data.lead.anuncio ?? '',
                primerContacto: lead.data.lead.fecha,
              }
            : null
        }
        resumenIa={null}
      />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {/* ══ DÓNDE VOTA (ADR 0063) ═══════════════════════════════════════════
            Sólo en campaña, y ARRIBA del timeline: el timeline narra qué pasó y
            esto decide qué hacer — es el equivalente de «Qué quiere» en el panel
            de ventas. El componente se apaga solo con `activo={false}`, así que
            en ventas no se monta ni pide nada. */}
        {/* ══ QUIÉN ES (la ficha rápida, ADR 0060) ═══════════════════════════
            Va PRIMERO —antes que el territorio y que el timeline— porque es la
            pregunta 1 del panel (ADR 0017) y porque hasta hoy no se dibujaba en
            ninguna parte: el panel pedía la ficha entera y usaba un campo.
            En los DOS módulos: `contacto_ficha` es una tabla de Hermes y desde
            ADR 0080 es CRM genérico. */}
        {/* ══ «POR COMPLETAR» SE RETIRÓ, Y NO POR ESPACIO ═══════════════════
            🔴 **Era inerte, medido.** `ZonaPendientes` listaba «Nombre completo»
            e «Interés específico» y llevaba un porcentaje. Completar **las dos**
            cosas dejaba la lista igual y el número en **0 %**: `pendientes` sale
            de `ficha.estado !== 'cliente'` y de nada más, y `progreso` sólo
            cuenta eventos `confirmado` — mientras que llenar la ficha o
            registrar un interés produce eventos `manual`. O sea que el
            indicador no podía responder a las acciones que él mismo pedía.

            Es el defecto que ADR 0080 nombró al sacar esta lista de campaña
            —«un indicador de avance que no avanza enseña a no mirarlo»— y que
            allá se cerró sólo para su mitad. Acá los mismos dos campos se
            dibujan en «Quién es» con su valor cuando existe, con la forma del
            hueco cuando no, y con el botón que los llena. */}
        <QuienEs
          clave={conversacion.clave}
          nombreActual={nombreData.principal ?? telefono ?? 'este contacto'}
          ficha={fichaLocal.data}
          cerberus={ficha.data}
          lead={lead.data?.lead}
          cargando={fichaLocal.isLoading}
          esDeCampana={esDeCampana}
          intereses={intereses?.lista?.map((i) => i.curso)}
          // Sólo campaña (candidatos, autenticados vía Centurión/auth-goberna): en esa vista el
          // botón "Anotar" de arriba se retira a propósito — "Anotar quién es" abajo sigue.
          onEditar={esDeCampana ? undefined : () => setAnotandoFicha(true)}
          onCorreo={
            onMandarCorreo
              ? (destino) =>
                  onMandarCorreo({
                    ...destino,
                    clave: destino.clave ?? conversacion.clave,
                    nombre: destino.nombre ?? nombreData.principal ?? undefined,
                  })
              : undefined
          }
        />
        <BloqueTerritorio clave={conversacion.clave} activo={esDeCampana} />
        {/* El MISMO ritmo vertical que «Quién es» y «Dónde vota» (`px-4 py-3`):
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
          {tieneTelefono && conversacion.canal === 'whatsapp' && telefono && (
            <div className="mb-3">
              <BotonLlamar telefono={telefono} />
            </div>
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
              senalAbrir={senalNotas}
              esDeCampana={esDeCampana}
            />
          </div>

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
          {conCerberus && (ficha.isPending || ficha.isError || ficha.data?.estado !== 'nuevo') && (
          <div className="mt-3 border-t border-border pt-3">
            {/* El encabezado ya no dice «Ficha de Cerberus»: la FICHA —quién
                es— se unificó arriba en «Quién es», y lo que queda acá son las
                compras y el carrito. Un rótulo que promete una ficha sobre una
                lista de folios manda a buscar el DNI donde ya no está. */}
            <h3 className={encabezadoSeccion}>
              <IdCard size={14} className="text-muted-foreground" /> Lo que compró
            </h3>
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
            <FichaContacto
              conversacion={conversacion}
              embebida
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
      {vendiendo && (
        <VentaDesdeElPanel
          conversacion={conversacion}
          onCerrar={() => setVendiendo(false)}
          carritoInicial={carrito}
          monedaInicial={monedaCarrito}
          onMonedaCambiar={setMonedaCarrito}
        />
      )}
    </div>
  );
}
