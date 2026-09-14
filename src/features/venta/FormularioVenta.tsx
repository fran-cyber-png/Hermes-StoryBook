import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Check, Copy, FileText, Loader2, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { sectionLabel } from '../../lib/styles';
import { useEscape } from '../../lib/teclado/useEscape';
import { ETAPAS, colorSegmento, rotuloEtapa } from '../../lib/etapas';
import { BarraSegmentada } from '../../components/graficos/BarraSegmentada';
import { useDashboard } from '../dashboard/dashboard';
import {
  precioDe,
  useCrearVenta,
  useEnviarCotizacion,
  useFormularioVenta,
  useLocalesDePais,
  useProductos,
  type Opcion,
  type ProductoCurso,
  type ProductoElegido,
} from './useVenta';
import { repartirEnCuotas } from './cuotas';
import { LineaProducto } from './LineaProducto';
import { VentaSinCerberus } from '../auth/AvisoCerberus';
import { medioDeVenta, type MedioVenta } from '../../dominio/medioVenta';

/** Cerberus llama "Origen" al canal por donde llegó el lead. Arranca en el canal de la conversación y se puede cambiar. */
const ORIGEN_POR_CANAL: Record<string, { id: string; nombre: string }> = {
  whatsapp: { id: 'whatsapp', nombre: 'WhatsApp' },
  facebook: { id: 'facebook', nombre: 'Facebook' },
  instagram: { id: 'instagram', nombre: 'Instagram' },
};

/** Lo que se ve en la píldora del formulario, para cada `MedioVenta` de Cerberus. */
const MEDIO_NOMBRE: Record<MedioVenta, string> = {
  organico: 'Orgánico',
  pagado: 'Pagado',
  postventa: 'PostVenta',
};

/** Referencia estable para el «todavía no hay locales»: si no, el efecto de precarga se redispara siempre. */
const SIN_LOCALES: Opcion[] = [];

/**
 * HOY, en la zona horaria de la vendedora, con la forma que pide un `<input
 * type="date">`.
 *
 * ⚠️ **No sale de `toISOString()`**, que es UTC: en Lima (UTC-5) a partir de las
 * 19:00 devuelve MAÑANA, y la primera cuota —la del pago al contado que se acaba
 * de cobrar— nacería venciendo al día siguiente.
 */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


/**
 * EL FORMULARIO DE VENTA, DENTRO DE HERMES.
 *
 * La vendedora llena esto y Hermes lo manda a Cerberus con su sesión — ella nunca
 * abre Cerberus. **El Origen arranca en el canal** (vino por WhatsApp) y desde el
 * 14-sep-2026 se elige entre los ocho de Cerberus (pedido de ventas). **El Medio se
 * elige, arrancando en lo inferido**: la precedencia es `dominio/medioVenta.ts`
 * — **postventa gana**: si la persona ya le compró a Goberna antes, la venta es
 * una recompra aunque ESTA conversación haya venido de un anuncio (decisión del
 * dueño, 8-sep-2026 — bug reportado por Luz: antes el medio salía de un binario
 * anuncio/no-anuncio y Cerberus acepta cinco). Y desde el 11-sep-2026 se puede
 * corregir: Hermes no siempre sabe que ya compró, y un rótulo fijo dejaba la
 * venta como «Orgánico» sin salida (pedido del dueño).
 * Al cerrar, el RECIBO: folio copiable, el embudo con Cierre creciendo, y la
 * siguiente jugada (agendar la bienvenida) servida.
 */

interface Props {
  clienteId: number;
  clienteNombre: string;
  /** El teléfono del contacto — para leer de dónde vino el lead (origen/medio). */
  telefono: string;
  /** El canal de la conversación — de ahí se infiere el Origen. */
  canal: string;
  onCerrar: () => void;
  /** La conversación de origen: con esto la venta mueve el embudo sola. */
  clave?: string | null;
  personaNombre?: string | null;
  numeroPropio?: string | null;
  /** El país de la ficha de Cerberus — precarga el select (editable). */
  paisNombre?: string | null;
  /** La siguiente jugada del recibo: agendar la bienvenida (cae en la Agenda vía puente). Sin esto, el botón no se muestra. */
  onAgendarBienvenida?: (telefono: string | null) => void;
  /**
   * Ya le compró a Goberna antes de ESTA venta — quien llama lo sabe por la
   * ficha de Cerberus (`useFicha`, `data.ventasCount > 0`) o por el padrón
   * (`clientes_padron` / `cliente_nivel` de la fila de la cola). Con esto en
   * `true` el medio sale `postventa` sin importar el anuncio: la precedencia
   * vive en `dominio/medioVenta.ts`. Por defecto `false` (lead nuevo).
   */
  yaCompro?: boolean;
  /**
   * Lo que ya se eligió en el «Carrito» de la ficha (`panel/CarritoDeseado`),
   * si eligió algo — arranca el carrito de acá con esos productos ya puestos.
   * El precio arranca en el que la vendedora tipeó allá (`l.precio`); si no
   * anotó ninguno, cae al de promoción del catálogo — nunca en blanco.
   * Editable acá como cualquier línea. Solo importa al MONTAR: no hay
   * `useEffect` que la vuelva a aplicar si cambia después, porque eso
   * pisaría lo que la vendedora ya esté editando acá.
   */
  lineasIniciales?: ProductoElegido[];
  /**
   * La moneda que ya se eligió en el mismo carrito (`CarritoDeseado`), si
   * eligió alguna — el `id` de Cerberus, no el código. Le gana a la última
   * usada en `localStorage`: es una elección de ESTA venta, más reciente y
   * más específica que un recuerdo de la anterior. Solo importa al MONTAR
   * — no se le vuelve a aplicar si `monedaInicial` cambia después de eso.
   */
  monedaInicial?: string;
  /**
   * 🔴 **LA MONEDA, Y SOLO LA MONEDA, SINCRONIZA EN LOS DOS SENTIDOS**
   * (20-ago-2026, pedido del dueño). A diferencia de `lineasIniciales`
   * —cantidad y precio siguen siendo de ESTE formulario, sin escribir de
   * vuelta—, cambiar la moneda ACÁ también actualiza el select del carrito:
   * es un solo dato que describe la misma venta en dos pantallas, y que
   * dijeran cosas distintas era peor que la asimetría con cantidad/precio,
   * que sí son ediciones de último momento (el descuento real se negocia
   * recién acá). Sin este callback el componente sigue andando —el
   * `<select>` local no deja de funcionar—, solo que nadie se entera afuera.
   */
  onMonedaCambiar?: (monedaId: string) => void;
}

interface Linea {
  producto: ProductoCurso;
  cantidad: number;
  /**
   * EL PRECIO PACTADO, como texto porque se está tipeando.
   *
   * Nace en el precio de promoción del catálogo y la vendedora lo puede bajar: es
   * el descuento real, y Cerberus lo acepta (`precio_venta` dentro del
   * `productos_json`). El `precio_regular` sigue siendo el del catálogo — sin los
   * dos, el descuento no se puede ni ver ni medir después.
   */
  precio: string;
}

interface Recibo {
  modo: 'cotizacion' | 'venta';
  folio: string | null;
  /** Foto del embudo ANTES de registrar — el +1 de Cierre se suma local, sin doble conteo. */
  embudo: Record<string, number> | null;
  /**
   * El id NUMÉRICO de la venta en Cerberus — sin este, no hay forma de pedir
   * el PDF de la cotización (`/ventas/cotizacion/<id>/pdf/`). `null` cuando
   * Cerberus no lo mandó (server viejo, o el residuo documentado de
   * `clasificarRespuestaVenta`): ahí el botón de mandar el PDF no aparece,
   * nunca pide un id que no tiene.
   */
  ventaId: number | null;
}

export function FormularioVenta({ clienteId, clienteNombre, telefono, canal, clave, personaNombre, numeroPropio, paisNombre, yaCompro = false, onAgendarBienvenida, onCerrar, lineasIniciales, monedaInicial, onMonedaCambiar }: Props) {
  const { data: form, isPending: cargandoForm } = useFormularioVenta(true);
  const crear = useCrearVenta();
  const enviarCotizacion = useEnviarCotizacion();
  const { data: dash } = useDashboard();

  // El origen del lead (anuncio/landing) — misma query cacheada que el hilo, sin
  // fetch extra. Sirve para inferir el MEDIO (pagado si vino de un anuncio).
  const { data: conv } = useQuery({
    queryKey: ['wa', 'conversacion', telefono],
    queryFn: () => api<{ origen: { fuente?: string } | null }>(`/api/whatsapp/conversacion/${telefono}`),
    enabled: Boolean(telefono),
    staleTime: 60_000,
  });

  //  · Origen = SE ELIGE, y arranca en el canal (WhatsApp / Facebook / Instagram).
  //    Hasta el 14-sep-2026 era un rótulo fijo, y la venta viajaba con el canal
  //    aunque el lead hubiera llegado por otro lado (pedido de ventas).
  //  · Medio  = SE ELIGE, y arranca en la precedencia de `dominio/medioVenta.ts`
  //    (postventa gana). Hasta el 11-sep-2026 era un rótulo que no se podía
  //    cambiar, y la venta a quien ya había comprado salía «Orgánico» cada vez
  //    que Hermes no lo sabía (pedido del dueño).
  const origenInfo = ORIGEN_POR_CANAL[canal] ?? ORIGEN_POR_CANAL.whatsapp;
  /** `null` = no tocó el select y viaja el canal, igual que el Medio. */
  const [origenElegido, setOrigenElegido] = useState<string | null>(null);
  const origen = origenElegido ?? origenInfo.id;
  const medioInferido = medioDeVenta({ vinoDeAnuncio: conv?.origen?.fuente === 'anuncio', yaCompro });
  /**
   * `null` = la vendedora no tocó el select, y manda lo inferido. Es un `null` y
   * no una copia del inferido a propósito: el origen del lead llega en OTRA
   * consulta, y lo inferido puede cambiar después del primer render — hasta que
   * ella elija, tiene que poder cambiar; después, nunca le pisa lo que eligió.
   */
  const [medioElegido, setMedioElegido] = useState<string | null>(null);
  const medio = medioElegido ?? medioInferido;

  // Arranca en la moneda que ya se eligió en el carrito, si vino alguna — le
  // gana a la de `localStorage` (abajo) porque es la elección de ESTA venta,
  // no un recuerdo de la anterior.
  const [monedaId, setMonedaId] = useState(() => monedaInicial || '');
  /**
   * Todo cambio de moneda pasa por ACÁ, nunca por `setMonedaId` a secas —
   * es lo que garantiza que el carrito se entera SIEMPRE, la elija la
   * vendedora a mano o la resuelva sola la precarga de abajo.
   */
  function elegirMoneda(id: string) {
    setMonedaId(id);
    onMonedaCambiar?.(id);
  }
  const [paisId, setPaisId] = useState('');
  const [localId, setLocalId] = useState('');
  /**
   * NO arranca tildado. Cerberus marcaba TODA venta de Hermes como "Preventa"
   * sin importar el producto — hasta un Foro (categoría Evento, sin relación
   * con stock) quedaba en esa cola separada, que además nunca sincroniza sola
   * a Pagado. El flag solo tiene efecto real para Merchandising/Físico (las
   * únicas categorías con stock en Cerberus); para todo lo demás no protegía
   * nada. La vendedora lo tilda a mano si el caso lo amerita.
   */
  const [preventa, setPreventa] = useState(false);
  const [lineas, setLineas] = useState<Linea[]>(() =>
    (lineasIniciales ?? []).map((l) => ({
      producto: l.producto,
      cantidad: l.cantidad,
      precio: l.precio || String(l.producto.precioPromocion),
    })),
  );
  /**
   * EL CRONOGRAMA — arranca en UNA cuota que vence hoy.
   *
   * El caso normal es pago al contado, y una venta sin cuotas es un 400 seguro de
   * Cerberus: hacer que la vendedora agregue la primera a mano sería cobrarle un
   * clic a lo que pasa siempre, para que lo que pasa a veces cueste uno menos.
   */
  const [cuotas, setCuotas] = useState<string[]>(() => [hoyLocal()]);
  const [busqueda, setBusqueda] = useState('');
  const [saved, setSaved] = useState<Recibo | null>(null);
  const [folioCopiado, setFolioCopiado] = useState(false);

  // Precargas: la moneda de la última venta (si no vino ya del carrito) y el
  // país de la ficha. Nada pisa lo que la vendedora ya eligió.
  useEffect(() => {
    if (!form) return;
    // Se avisa igual que cualquier otro cambio, así el carrito se entera
    // también de ÉSTE: sin `monedaInicial` (nunca se usó el carrito para
    // esta venta), la precarga es la primera vez que la moneda se decide,
    // y las dos pantallas tienen que decir lo mismo.
    if (!monedaId) {
      const ultima = localStorage.getItem('hermes.ultimaMoneda');
      if (ultima && form.monedas.some((m) => m.id === ultima)) {
        setMonedaId(ultima);
        onMonedaCambiar?.(ultima);
      }
    }
    if (paisNombre) {
      const p = form.paises.find((x) => x.nombre.trim().toLowerCase() === paisNombre.trim().toLowerCase());
      if (p) setPaisId((v) => v || p.id);
    }
  }, [form, paisNombre, monedaId, onMonedaCambiar]);

  // Los locales del país elegido. Con Cerberus mudo (`locales: null`) o con un
  // server viejo que todavía no tiene la ruta, cae a la lista completa del
  // formulario: peor que ofrecer la lista fina, mucho mejor que un select vacío.
  const { data: localesDelPais } = useLocalesDePais(paisId);
  const locales = localesDelPais?.locales ?? form?.locales ?? SIN_LOCALES;

  /**
   * Precarga del local, y limpieza si dejó de valer.
   *
   * ⚠️ Cambiar el país puede invalidar el local ya elegido, y **dejarlo puesto es
   * regalar un rechazo**: `VentaForm.clean` responde «El local debe pertenecer al
   * país seleccionado» y tumba la venta entera. Se cae al último que usó, y si
   * tampoco es de este país, a nada.
   */
  useEffect(() => {
    if (locales.length === 0) return;
    setLocalId((v) => {
      if (v && locales.some((l) => l.id === v)) return v;
      const ultimo = localStorage.getItem('hermes.ultimoLocal');
      return ultimo && locales.some((l) => l.id === ultimo) ? ultimo : '';
    });
  }, [locales]);

  // Escape cierra el modal — contrato compartido de los modales (src/lib/teclado/).
  useEscape(onCerrar);

  const { data: prods } = useProductos(busqueda, busqueda.length >= 2);

  const monto = useMemo(
    () => lineas.reduce((s, l) => s + precioDe(l.precio) * l.cantidad, 0),
    [lineas],
  );
  // El espejo del reparto que va a hacer Cerberus. Ver `cuotas.ts`: la autoridad
  // es su backend, esto es para que la vendedora sepa qué está prometiendo.
  const montosCuota = repartirEnCuotas(monto, cuotas.length);
  const cuotasCompletas = cuotas.length > 0 && cuotas.every(Boolean);
  const monedaNombre = form?.monedas.find((m) => m.id === monedaId)?.nombre ?? '';
  const paisDeFicha = form && paisNombre
    ? form.paises.find((x) => x.nombre.trim().toLowerCase() === paisNombre.trim().toLowerCase())
    : null;

  function agregar(p: ProductoCurso) {
    setLineas((ls) =>
      ls.some((l) => l.producto.id === p.id)
        ? ls
        : [...ls, { producto: p, cantidad: 1, precio: String(p.precioPromocion) }],
    );
    setBusqueda('');
  }
  function cantidad(id: string, delta: number) {
    setLineas((ls) => ls.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l)));
  }
  function ponerPrecio(id: string, precio: string) {
    setLineas((ls) => ls.map((l) => (l.producto.id === id ? { ...l, precio } : l)));
  }
  function quitar(id: string) {
    setLineas((ls) => ls.filter((l) => l.producto.id !== id));
  }
  function agregarCuota() {
    // La nueva vence un mes después de la última: es lo que la vendedora quiere
    // el 90 % de las veces y sigue siendo editable.
    setCuotas((cs) => {
      const ultima = new Date(`${cs[cs.length - 1] || hoyLocal()}T12:00:00`);
      ultima.setMonth(ultima.getMonth() + 1);
      return [...cs, `${ultima.getFullYear()}-${String(ultima.getMonth() + 1).padStart(2, '0')}-${String(ultima.getDate()).padStart(2, '0')}`];
    });
  }
  function ponerCuota(i: number, fecha: string) {
    setCuotas((cs) => cs.map((c, j) => (j === i ? fecha : c)));
  }
  function quitarCuota(i: number) {
    setCuotas((cs) => (cs.length <= 1 ? cs : cs.filter((_, j) => j !== i)));
  }

  async function registrar(saveMode: 'cotizacion' | 'venta') {
    if (!monedaId || !paisId || !localId || lineas.length === 0) return;
    if (saveMode === 'venta' && !cuotasCompletas) return;
    // Foto del embudo antes del registro: el recibo dibuja Cierre +1 sobre esta
    // base aunque el refetch llegue después.
    const embudoAntes = dash?.embudo ?? null;
    let r: { folio?: string; ventaId?: number };
    try {
      r = await crear.mutateAsync({
        clienteId,
        monedaId,
        paisId,
        localId,
        preventa,
        medio,
        origen,
        montoTotal: monto,
        productos: lineas.map((l) => ({
          productoId: l.producto.id,
          nombre: l.producto.nombre,
          cantidad: l.cantidad,
          // El regular es el del catálogo aunque se haya pactado otro precio: es
          // lo único que deja ver después que hubo un descuento, y cuánto.
          precioRegular: l.producto.precioNormal,
          precioVenta: precioDe(l.precio),
        })),
        // Una cotización no necesita cronograma, pero si la vendedora lo armó va
        // igual: es lo que le está prometiendo al cliente en el presupuesto.
        cuotas: cuotas.filter(Boolean).map((fechaVencimiento) => ({ fechaVencimiento })),
        saveMode,
        // El contexto de la conversación: con esto el server asienta intereses,
        // conversión y etapa (cotizado/cierre) — el embudo se mueve solo.
        telefono,
        canal,
        clave: clave ?? null,
        personaNombre: personaNombre ?? null,
        numeroPropio: numeroPropio ?? null,
      });
    } catch {
      // El error queda a la vista vía crear.isError — nada muta en silencio.
      return;
    }
    localStorage.setItem('hermes.ultimaMoneda', monedaId);
    localStorage.setItem('hermes.ultimoLocal', localId);
    setSaved({ modo: saveMode, folio: r.folio ?? null, embudo: embudoAntes, ventaId: r.ventaId ?? null });
  }

  /**
   * LA COTIZACIÓN, AL CHAT — el PDF que Cerberus ya genera
   * (`sales/views.py:descargar_cotizacion_pdf`), como adjunto real de
   * WhatsApp. Un clic manda —mismo criterio que `DosRespuestas`—: no hay
   * texto que editar, así que no pasa por el composer.
   *
   * `numeroPropio` y `telefono` viajan tal cual llegaron por props: son los
   * de ESTA conversación, la misma en la que se está registrando la venta.
   */
  function enviarCotizacionPorWhatsapp() {
    if (!saved?.ventaId || !telefono || !numeroPropio) return;
    enviarCotizacion.mutate({
      ventaId: saved.ventaId,
      telefono,
      numeroPropio,
      referencia: clave || `venta:${saved.ventaId}`,
    });
  }

  async function copiarFolio() {
    if (!saved?.folio) return;
    await navigator.clipboard.writeText(saved.folio);
    setFolioCopiado(true);
  }

  /**
   * LAS DOS SALIDAS NO PIDEN LO MISMO, y por eso son dos booleanos.
   *
   * El local lo exigen las dos (`sales/forms.py:132`). El cronograma lo exige
   * solo la venta real: una cotización es un presupuesto y no entra a tesorería
   * (`sales/views.py:947`). Con un solo `puede` compartido, o la cotización pedía
   * de más o la venta salía a comerse un 400.
   */
  const puedeCotizar = Boolean(monedaId && paisId && localId && lineas.length > 0) && !crear.isPending;
  const puedeVender = puedeCotizar && cuotasCompletas;

  // El mini-embudo del recibo: la foto previa + Cierre creciendo 1, en verde.
  const segmentosRecibo =
    saved?.modo === 'venta' && saved.embudo
      ? ETAPAS.map((e) => ({
          id: e,
          n: (saved.embudo?.[e] ?? 0) + (e === 'cierre' ? 1 : 0),
          color: colorSegmento(e),
          // El mini-embudo cuenta montones, no personas: «Compraron», no «Compró».
          label: rotuloEtapa(e, 'varios'),
        }))
      : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Registrar venta" className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-navy px-5 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShoppingCart size={16} /> Registrar venta
            </div>
            <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-lg p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </header>

          {saved ? (
            /* EL RECIBO DE IMPRENTA — la edición cerrada, verificable y encadenada.
               La animación es del CONTENIDO, no del modal: el modal ya estaba
               en pantalla (es el mismo formulario, cambiando de cara), así que
               animar el marco entero repetiría el «pop» de apertura por nada.
               `animate-in`/`fade-in`/`slide-in-from-*`/`delay-*` son de
               `tw-animate-css` — misma convención que ya usa el resto de la
               app para lo que entra a la pantalla sin recargarla.

               ESCALONADA, no todo junto: el check aparece primero (es la
               confirmación), el texto y el folio la siguen, y el botón de
               acción llega AL FINAL — el ojo termina ahí, que es donde tiene
               que terminar. `fill-mode-both` es lo que evita el parpadeo:
               sin eso, cada elemento con `delay` se ve a opacidad plena
               durante la espera y recién en el delay salta a invisible.

               EL CHECK tiene DOS capas, las dos con las MISMAS utilidades de
               `tw-animate-css` que ya usa el resto del bloque (nada de
               `animate-ping` nativo: mezclarlo forzaría a pisar su
               `animation` shorthand con propiedades sueltas, un empate de
               cascada que depende del orden de generación de Tailwind). El
               anillo «suena» una sola vez —crece y se apaga, `animate-out` +
               `zoom-out`/`fade-out`, `fill-mode-forwards` para que no
               parpadee de vuelta— detrás del círculo; y el círculo entra con
               un `cubic-bezier` que SE PASA de 100% y vuelve, el mismo efecto
               «resorte» de un ✓ de app de pago, no un fade liso. */
            <div className="flex animate-in flex-col items-center gap-3 p-8 text-center duration-300 ease-house fade-in slide-in-from-bottom-2">
              <div className="relative flex size-12 items-center justify-center">
                <span className="absolute inset-0 animate-out rounded-full bg-success/40 delay-100 duration-700 ease-out fade-out fill-mode-forwards zoom-out-150" />
                <div className="relative z-10 flex size-12 animate-in items-center justify-center rounded-full bg-success/10 text-success duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] zoom-in-50">
                  <Check size={24} />
                </div>
              </div>
              <p className="animate-in text-sm font-bold text-foreground delay-100 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1">
                {saved.modo === 'venta' ? 'Venta registrada en Cerberus.' : 'Cotización registrada en Cerberus.'}
              </p>
              {saved.folio && (
                <div className="flex animate-in items-center gap-2 delay-150 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1">
                  <span className="font-mono text-lg tabular-nums text-foreground">{saved.folio}</span>
                  <button
                    type="button"
                    onClick={() => void copiarFolio()}
                    className={
                      'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ' +
                      (folioCopiado ? 'border-success/40 text-success' : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
                    }
                  >
                    {folioCopiado ? <Check size={11} /> : <Copy size={11} />}
                    {folioCopiado ? 'Copiado' : 'Copiar folio'}
                  </button>
                </div>
              )}
              {segmentosRecibo && (
                <div className="w-full max-w-[260px] animate-in delay-200 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1">
                  <BarraSegmentada segmentos={segmentosRecibo} />
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-success">Cierre +1</p>
                </div>
              )}
              {saved.modo === 'venta' && onAgendarBienvenida ? (
                <div className="flex animate-in flex-col items-center gap-2 delay-300 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1">
                  <button
                    type="button"
                    onClick={() => {
                      onAgendarBienvenida(telefono || null);
                      onCerrar();
                    }}
                    className="mt-2 flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98]"
                  >
                    <CalendarPlus size={15} /> Agendar bienvenida al curso
                  </button>
                  <button type="button" onClick={onCerrar} className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    Cerrar
                  </button>
                </div>
              ) : saved.modo === 'cotizacion' && saved.ventaId && telefono && numeroPropio ? (
                /* La cotización queda en Cerberus (arriba); esto es lo que le
                   falta para que el CLIENTE se entere: el PDF real que
                   Cerberus ya genera, mandado como adjunto — no un texto
                   escrito por Hermes. */
                <div className="flex animate-in flex-col items-center gap-2 delay-300 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1">
                  {enviarCotizacion.isSuccess ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-success">
                      <Check size={14} /> Cotización enviada por WhatsApp
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={enviarCotizacion.isPending}
                      onClick={enviarCotizacionPorWhatsapp}
                      className="mt-2 flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] disabled:opacity-60"
                    >
                      {enviarCotizacion.isPending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <FileText size={15} />
                      )}
                      {enviarCotizacion.isPending ? 'Enviando el PDF…' : 'Enviar PDF por WhatsApp'}
                    </button>
                  )}
                  {enviarCotizacion.isError && (
                    <p className="max-w-xs text-[11px] leading-relaxed text-destructive">
                      {enviarCotizacion.error instanceof ErrorApi
                        ? enviarCotizacion.error.message
                        : 'No se pudo mandar el PDF.'}
                    </p>
                  )}
                  <button type="button" onClick={onCerrar} className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                    Cerrar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onCerrar}
                  className="mt-2 animate-in rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground delay-300 duration-300 ease-house fade-in fill-mode-both slide-in-from-bottom-1"
                >
                  Cerrar
                </button>
              )}
            </div>
          ) : cargandoForm ? (
            <div className="space-y-4 p-5">
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-9 animate-pulse rounded-lg bg-muted" />
                <div className="h-9 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : !form ? (
            /* Antes acá había un texto que decía «vuelve a entrar» y no daba por
               dónde: la vendedora tenía que adivinar que la salida era «Salir» en
               el riel, con el cliente esperando. Ahora el botón está donde falla. */
            <VentaSinCerberus onReconectar={onCerrar} />
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {/* Cliente (ya identificado por teléfono) */}
              <Campo label="Cliente">
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground">
                  {clienteNombre}
                </div>
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Moneda">
                  <Select value={monedaId} onChange={elegirMoneda} placeholder="Elige moneda" opciones={form.monedas} autoFocus />
                </Campo>
                <Campo label="País">
                  <Select value={paisId} onChange={setPaisId} placeholder="Elige país" opciones={form.paises} />
                  {paisDeFicha && paisId === paisDeFicha.id && (
                    <span className="text-[11px] text-muted-foreground">
                      precargado de la ficha — cámbialo si hace falta
                    </span>
                  )}
                </Campo>
                {/* El local ocupa la fila entera: los nombres de almacén no entran en media. */}
                <div className="col-span-2">
                  <Campo label="Local">
                    <Select
                      value={localId}
                      onChange={setLocalId}
                      placeholder={paisId ? 'Elige local' : 'Elige el país primero'}
                      opciones={locales}
                    />
                  </Campo>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={preventa} onChange={(e) => setPreventa(e.target.checked)} />
                Preventa (cursos sin stock: no reserva stock)
              </label>

              {/* EL MEDIO Y EL ORIGEN SE ELIGEN. Las opciones son las que publica
                  el server (`cerberus/venta.ts`): los cinco medios y los ocho
                  orígenes que Cerberus guarda. El Origen arranca en el canal de
                  la conversación; el Medio arranca en lo inferido
                  —postventa le gana al anuncio, `dominio/medioVenta.ts`— y abajo
                  dice por qué, para que corregirlo sea una decisión y no un
                  descuido. */}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Medio">
                  <Select value={medio} onChange={setMedioElegido} opciones={opcionesDeMedio(form.medios, medio)} />
                  <span className="text-[11px] text-muted-foreground">
                    {medioElegido !== null && medioElegido !== medioInferido
                      ? `elegido a mano — Hermes sugería ${MEDIO_NOMBRE[medioInferido]}`
                      : medioInferido === 'postventa'
                        ? 'ya te había comprado antes — cámbialo si no es así'
                        : medioInferido === 'pagado'
                          ? 'vino de un anuncio — cámbialo si no es así'
                          : 'sugerido — si ya compró antes, elige PostVenta'}
                  </span>
                </Campo>
                <Campo label="Origen">
                  <Select value={origen} onChange={setOrigenElegido} opciones={opcionesDeOrigen(form.origenes, origenInfo)} />
                  <span className="text-[11px] text-muted-foreground">
                    {origenElegido !== null && origenElegido !== origenInfo.id
                      ? `elegido a mano — la conversación llegó por ${origenInfo.nombre}`
                      : 'por dónde llegó la conversación — cámbialo si no es así'}
                  </span>
                </Campo>
              </div>

              {/* Productos */}
              <Campo label="Carrito">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto…"
                    className="w-full rounded-lg border border-border bg-muted py-2 pl-8 pr-3 text-sm outline-none focus:border-primary"
                  />
                  {prods && busqueda.length >= 2 && prods.productos.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg bg-card shadow-panel">
                      {prods.productos.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => agregar(p)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                        >
                          <span className="truncate">{p.nombre}</span>
                          <span className="flex items-center gap-1 font-semibold text-navy-ink">
                            {p.precioPromocion} <Plus size={12} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Campo>

              {lineas.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {lineas.map((l) => (
                    <LineaProducto
                      key={l.producto.id}
                      producto={l.producto}
                      cantidad={l.cantidad}
                      precio={l.precio}
                      // LA MONEDA VA ACÁ, NO SOLO EN EL TOTAL. El precio sale del
                      // catálogo de Cerberus, que hoy NO dice en qué moneda está
                      // (`useVenta.ts`, `ProductoCurso.moneda` viene vacío): cambiar
                      // el select de arriba NO reconvierte este número. Con la
                      // moneda pegada al precio el desajuste se VE, que es mejor
                      // que un renglón de prosa explicándolo.
                      moneda={monedaNombre}
                      onCantidad={(delta) => cantidad(l.producto.id, delta)}
                      onPrecio={(precio) => ponerPrecio(l.producto.id, precio)}
                      onQuitar={() => quitar(l.producto.id)}
                    />
                  ))}
                </ul>
              )}

              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className={sectionLabel}>Monto total</span>
                <span className="font-heading text-2xl font-bold tabular-nums text-navy-ink">
                  {monedaNombre && <span className="mr-1.5 text-sm font-semibold text-muted-foreground">{monedaNombre}</span>}
                  {monto.toFixed(2)}
                </span>
              </div>

              {/* EL CRONOGRAMA — lo que faltaba, y por lo que este modal nunca
                  registró una venta. Cerberus corta ANTES de validar el formulario
                  si una venta real llega sin cuotas (`sales/views.py:947`), así que
                  el botón devolvía «Debe agregar al menos una cuota» y la pantalla
                  no ofrecía dónde agregarla: una validación imposible de satisfacer.
                  Los montos son el ESPEJO del reparto de allá (ver `cuotas.ts`). */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={sectionLabel}>Cuotas</span>
                  <button
                    type="button"
                    onClick={agregarCuota}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    <Plus size={11} /> Agregar cuota
                  </button>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {cuotas.map((fecha, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                      <span className="w-14 shrink-0 font-medium text-muted-foreground">Cuota {i + 1}</span>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => ponerCuota(i, e.target.value)}
                        aria-label={`Vencimiento de la cuota ${i + 1}`}
                        className="min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 py-1 text-xs tabular-nums outline-none focus:border-primary"
                      />
                      <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-navy-ink">
                        {(montosCuota[i] ?? 0).toFixed(2)}
                      </span>
                      {cuotas.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Quitar la cuota ${i + 1}`}
                          onClick={() => quitarCuota(i)}
                          className="text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {!cuotasCompletas && (
                  <p className="text-[11px] text-destructive">
                    Cada cuota necesita su fecha de vencimiento — sin eso Cerberus rechaza la venta.
                  </p>
                )}
              </div>

              {crear.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {crear.error instanceof ErrorApi ? crear.error.message : 'No se pudo registrar.'}
                </div>
              )}
            </div>
          )}

          {!saved && form && (
            <footer className="flex shrink-0 gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => void registrar('cotizacion')}
                disabled={!puedeCotizar}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Cotización
              </button>
              <button
                type="button"
                onClick={() => void registrar('venta')}
                disabled={!puedeVender}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] disabled:opacity-40"
              >
                {crear.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
                Registrar venta
              </button>
            </footer>
          )}
        </div>
      </div>
    </>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={sectionLabel}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Las opciones del Medio: las del server, y si por algún motivo no trae la que
 * se infirió (un server que responde `medios: []`), esa va primero. Un select
 * cuyo valor no está entre sus opciones muestra la primera y manda otra cosa —
 * justo la clase de diferencia entre pantalla y POST que este campo vino a cerrar.
 */
function opcionesDeMedio(medios: Opcion[], medio: string): Opcion[] {
  if (medios.some((m) => m.id === medio)) return medios;
  return [{ id: medio, nombre: MEDIO_NOMBRE[medio as MedioVenta] ?? medio }, ...medios];
}

/**
 * Las opciones del Origen, con la misma guarda que el Medio: si el server no
 * trae el canal de la conversación, ese va primero, para que el select nunca
 * muestre uno y mande otro.
 */
function opcionesDeOrigen(origenes: Opcion[], delCanal: Opcion): Opcion[] {
  if (origenes.some((o) => o.id === delCanal.id)) return origenes;
  return [delCanal, ...origenes];
}

function Select({ value, onChange, placeholder, opciones, autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder?: string; opciones: { id: string; nombre: string }[]; autoFocus?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary"
    >
      {/* Sin `placeholder` no hay opción vacía: el Medio nunca puede quedar en blanco. */}
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}
