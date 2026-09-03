import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Clock,
  Loader2,
  Mail,
  MailOpen,
  PenLine,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/datos/cliente';
import { entradaDeRiel, type Riel } from '../../dominio/correo';
import { Composer, type BorradorAbierto } from './Composer';
import { FilaDeHilo } from './FilaDeHilo';
import { LecturaDeCorreo } from './LecturaDeCorreo';
import { RielDeCorreos } from './RielDeCorreos';
import type {
  CorreoCompleto,
  CorreoEnLista,
  EtiquetaDeCorreo,
  HiloDeBandeja,
  RespuestaDeBandeja,
} from './tipos';

/**
 * CORREOS — la bandeja, no el formulario.
 *
 * ══ 🔴 QUÉ CAMBIÓ, Y POR QUÉ NO ES COSMÉTICA ════════════════════════════════
 *
 * Hasta acá esta pantalla era **un composer con una lista debajo**, dibujado en
 * una columna de `max-w-2xl` —672 px— centrada. Medido sobre la captura de
 * producción: en un monitor de 2.560 px el 75 % del ancho quedaba vacío y
 * entraban ocho renglones de enviados. No era un problema de gusto: era que la
 * única pregunta que una vendedora le hace a Correos —«¿qué pasó con lo que
 * mandé?»— se contestaba de a ocho filas por pantallazo.
 *
 * Ahora es una bandeja de verdad: riel de carpetas a la izquierda, lista al
 * ancho completo, y el composer **encima**, en un panel que se abre con
 * «Redactar». El composer no se tocó —vive en `Composer.tsx`, con sus mismas
 * garantías sobre el sobre y el ritmo—; lo que cambió es que dejó de ser lo
 * único que hay.
 *
 * ══ LO QUE ESTA PANTALLA NO PUEDE HACER TODAVÍA, Y LO DICE ══════════════════
 *
 * 🔴 **Hermes NO RECIBE CORREO.** El SMTP es Amazon SES, que sólo manda, y el MX
 * de `goberna.us` es Google Workspace: no hay IMAP, ni Gmail API, ni webhook de
 * entrada, ni una sola fila con `estado = 'recibido'`. Recibidos existe, está
 * cableada y **está vacía**, y la pantalla lo dice con todas las letras en vez de
 * dibujar una lista vacía que se lee como «no te escribió nadie».
 *
 * ⚠️ **Ésa es la regla que rige todo este archivo**: el frente entero está armado
 * para que el día que entre la ingesta no haya que tocar ni el riel, ni la
 * consulta, ni la fila — sólo aparecen filas. Lo que NO se hace es fingir
 * mientras tanto. Es la misma corrección que este módulo ya se comió una vez, con
 * el «con tu firma de siempre» que ninguna línea de código pegaba.
 */

/** Cuántos hilos por página. Es lo que la referencia dibuja como «1-50 de 1.478». */
const POR_PAGINA = 50;

export interface VistaCorreosProps {
  correoInicial?: string | null;
  claveInicial?: string | null;
  nombreInicial?: string | null;
  onConsumido?: () => void;
  /**
   * Con qué carpeta abre. **Sólo lo usa la galería de evidencia**: la app entra
   * siempre por el default.
   *
   * ⚠️ Existe porque una galería sin esto no puede fotografiar ninguna carpeta que
   * no sea la de arranque —el navegador headless no hace clic—, y el vacío honesto
   * de Recibidos es justamente lo que hay que poder mirar. Es un asiento de
   * prueba, no una opción de producto: nada en la app se lo pasa.
   */
  rielInicial?: Riel;
  /** Ídem: la galería necesita fotografiar el composer abierto. */
  abrirComposer?: boolean;
  /**
   * Ídem: arranca con toda la lista tildada.
   *
   * ⚠️ **Sin esto la barra de acciones masivas NO SE PUEDE FOTOGRAFIAR.** Se
   * dibuja sólo con algo seleccionado —a propósito: dibujarla siempre, apagada,
   * llena la barra de botones que no hacen nada— y el navegador headless no hace
   * clic. O sea que la evidencia de «Archivados ofrece la vuelta» era imposible
   * de capturar, y la regla #9 de la casa pide capturarla.
   */
  tildarTodoAlAbrir?: boolean;
}

export function VistaCorreos({
  correoInicial,
  claveInicial,
  nombreInicial,
  onConsumido,
  rielInicial,
  abrirComposer,
  tildarTodoAlAbrir,
}: VistaCorreosProps) {
  const qc = useQueryClient();

  /**
   * 🔴 **ARRANCA EN «ENVIADOS» Y NO EN «RECIBIDOS», al revés que la referencia.**
   * No es una copia mal hecha: Recibidos está vacía y va a seguir vacía hasta que
   * exista la ingesta, así que abrir ahí le mostraría a la vendedora el cartel de
   * «Hermes todavía no recibe correo» **cada vez que entra**, para llegar a lo que
   * vino a ver con un clic extra. Enviados es la única carpeta con trabajo real
   * adentro. El día que entren correos, este default se da vuelta — y es una línea.
   */
  const [riel, setRiel] = useState<Riel>(rielInicial ?? 'enviados');
  const [etiquetaActual, setEtiquetaActual] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [tildados, setTildados] = useState<Set<number>>(() => new Set());
  const [leyendo, setLeyendo] = useState<CorreoEnLista | null>(null);

  /**
   * 🔴 **El composer arranca ABIERTO cuando llega el puente desde la ficha.**
   * El puente trae el «Para» ya lleno (`lib/puente.ts`): abrir Correos con el
   * destinatario cargado y el composer cerrado dejaría a la vendedora mirando una
   * bandeja, sin ninguna señal de que la acción que pidió —«Escribirle»— llegó a
   * destino. El puente se consume una sola vez y el composer se abre con él.
   */
  const [redactando, setRedactando] = useState(
    () => abrirComposer === true || (correoInicial != null && correoInicial !== ''),
  );

  /**
   * EL BORRADOR QUE SE ESTÁ RETOMANDO, si se abrió uno desde la carpeta.
   *
   * ⚠️ **Se guarda el objeto entero y no sólo el id** porque el composer necesita
   * los cuatro campos para prellenarse, y pedírselos él mismo lo obligaría a saber
   * de rutas y de estados de carga — la lista ya hizo ese pedido.
   */
  const [borradorAbierto, setBorradorAbierto] = useState<BorradorAbierto | null>(null);
  /** El id que se está trayendo. Mientras tanto la fila no se puede volver a tocar. */
  const [abriendoBorrador, setAbriendoBorrador] = useState<number | null>(null);
  /**
   * SEÑAL DE CIERRE DEL COMPOSER (contador).
   *
   * 🔴 **La X ya no cierra: PIDE cerrar.** Lo escrito vive adentro del composer, y
   * cerrarlo de un `setRedactando(false)` lo desmontaba con el texto adentro —que
   * es exactamente cómo se perdía media cotización con un clic—. Ahora se le avisa,
   * él guarda el borrador y contesta cuando está a salvo (`onListoParaCerrar`).
   * Contador y no booleano por lo de siempre: abrir, cerrar y volver a cerrar tiene
   * que disparar dos veces.
   */
  const [senalCerrar, setSenalCerrar] = useState(0);
  /**
   * ¿El clic que se está haciendo EMPEZÓ afuera del panel?
   *
   * ⚠️ Un `click` se dispara sobre el ancestro común del `mousedown` y el
   * `mouseup`, así que arrastrar para seleccionar texto desde adentro del
   * textarea hasta pasarse del borde produce un clic sobre el overlay. Sin esta
   * marca, subrayar un párrafo hasta el final cierra el composer.
   *
   * 🔴 **Es un `ref` y NO un `useState`, y lo destapó el test.** Con estado, el
   * `onClick` lee el valor del render en curso: entre el `mousedown` y el `click`
   * tiene que haber pasado un repintado para que la marca llegue, y eso es una
   * apuesta sobre cuándo React decide rendirizar, no una garantía. Un ref se
   * escribe y se lee en el mismo turno — que es justo lo que un par de handlers
   * que se pasan un dato necesita— y encima evita un render por cada `mousedown`
   * sobre el fondo.
   */
  const clicEmpezoAfuera = useRef(false);

  /** Abre el composer en blanco — «Redactar», que nunca retoma nada. */
  function redactarNuevo() {
    setBorradorAbierto(null);
    setRedactando(true);
  }

  /**
   * Cierra el panel y suelta el borrador retomado.
   *
   * ⚠️ **Soltarlo es parte del cierre, no higiene.** Sin esto, el próximo
   * «Redactar» abriría con el `borradorInicial` todavía puesto y el composer
   * escribiría encima de un borrador viejo — el correo nuevo se guardaría como una
   * versión del anterior, y el anterior se perdería.
   */
  function cerrarComposer() {
    setRedactando(false);
    setBorradorAbierto(null);
  }

  const entrada = entradaDeRiel(riel);

  const bandeja = useQuery({
    queryKey: ['correos', 'bandeja', riel, pagina],
    queryFn: () =>
      api<RespuestaDeBandeja>(`/api/correos/bandeja?riel=${riel}&pagina=${pagina}&porPagina=${POR_PAGINA}`),
  });

  const etiquetas = useQuery({
    queryKey: ['correos', 'etiquetas'],
    queryFn: () => api<{ etiquetas: EtiquetaDeCorreo[] }>('/api/correos/etiquetas'),
  });

  /**
   * ⚠️ **Invalidar es lo ÚNICO que se hace después de una acción**, y por eso la
   * pantalla no necesita saber a qué carpeta fue a parar un correo. Ver el
   * docblock de `src/dominio/correo.ts`: reimplementar el predicado acá para
   * poder mover la fila «sin esperar» es la trampa de #37 en este frente.
   */
  const accion = useMutation({
    mutationFn: (pedido: { ids: number[]; accion: string; hasta?: string }) =>
      api<{ ok: true; tocadas: number }>('/api/correos/acciones', {
        method: 'POST',
        body: JSON.stringify(pedido),
      }),
    onSuccess: () => {
      setTildados(new Set());
      void qc.invalidateQueries({ queryKey: ['correos', 'bandeja'] });
    },
  });

  const hilos = useMemo(() => {
    const todos = bandeja.data?.hilos ?? [];
    if (etiquetaActual !== null) {
      /**
       * ⚠️ **Filtrar por etiqueta en el navegador es HONESTO acá y no lo sería en
       * la carpeta.** Las etiquetas de la página ya vinieron con los hilos (una
       * consulta, no N+1), así que esto no esconde datos que ya viajaron: recorta
       * lo que se dibuja sobre lo que el server ya decidió mandar. Lo que **no**
       * se hace acá es decidir a qué CARPETA pertenece un correo — eso viaja en el
       * `WHERE`, siempre.
       *
       * 🔴 La deuda que esto deja escrita: con más de una página, filtrar acá
       * pagina mal (la página 2 de «Recibidos» filtrada por «Cotizaciones» no es
       * la página 2 de «Cotizaciones»). Cuando la bandeja tenga volumen, la
       * etiqueta pasa a ser un parámetro de la consulta, al lado del riel.
       */
      return todos.filter((h) => (h.etiquetas ?? []).some((e) => e.id === etiquetaActual));
    }
    if (busqueda.trim() === '') return todos;

    /**
     * La búsqueda rápida sobre lo que está a la vista. **No es la búsqueda de
     * verdad** —ésa va en el server, sobre el cuerpo completo y todas las
     * páginas— y por eso el placeholder dice «en esta carpeta», no «en el
     * correo»: una caja que promete buscar en todo y busca en cincuenta filas es
     * la misma clase de mentira que este módulo vino a sacar.
     */
    const q = busqueda.trim().toLowerCase();
    return todos.filter(
      (h) =>
        h.asunto.toLowerCase().includes(q) ||
        (h.para ?? '').toLowerCase().includes(q) ||
        (h.desde ?? '').toLowerCase().includes(q) ||
        (h.avance ?? '').toLowerCase().includes(q),
    );
  }, [bandeja.data, busqueda, etiquetaActual]);

  const total = bandeja.data?.total ?? 0;
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  /**
   * EL ASIENTO DE LA GALERÍA: tildar todo apenas hay filas.
   *
   * ⚠️ **Corre una sola vez** (`tildadoInicial`), no en cada llegada de datos: sin
   * ese candado, destildar a mano y que el refresco periódico vuelva a traer la
   * lista volvería a tildar todo — en la app eso sería una selección que se
   * resucita sola, que es de las cosas más desconcertantes que puede hacer una
   * bandeja. Acá no pasa porque nada de la app lo pasa, pero un asiento de prueba
   * que se comporta distinto al resto es exactamente cómo un asiento de prueba
   * termina prendido en producción sin que nadie lo note.
   */
  const [tildadoInicial, setTildadoInicial] = useState(false);
  if (tildarTodoAlAbrir && !tildadoInicial && hilos.length > 0) {
    setTildadoInicial(true);
    setTildados(new Set(hilos.map((h) => h.id)));
  }

  const todosTildados = hilos.length > 0 && hilos.every((h) => tildados.has(h.id));
  const seleccion = [...tildados];

  const tildar = useCallback((id: number, si: boolean) => {
    setTildados((antes) => {
      const nuevo = new Set(antes);
      if (si) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }, []);

  function cambiarRiel(nuevo: Riel) {
    setRiel(nuevo);
    setEtiquetaActual(null);
    setPagina(1);
    setTildados(new Set());
  }

  function haceALaSeleccion(que: string, hasta?: string) {
    if (seleccion.length === 0) return;
    accion.mutate({ ids: seleccion, accion: que, hasta });
  }

  /**
   * QUÉ PASA AL TOCAR UNA FILA — y depende de si es un borrador.
   *
   * 🔴 **Un borrador se ABRE PARA SEGUIR ESCRIBIENDO, no para leerlo.** Es la
   * única fila de la bandeja que no es un hecho consumado: mostrarla en la hoja de
   * lectura —con su cabecera de «de/para» y sin una caja donde escribir— deja a la
   * vendedora mirando su propio texto a medias sin ninguna forma de continuarlo. La
   * carpeta serviría para acordarse de que existe y para nada más.
   *
   * ⚠️ **La decisión se toma por el `estado` de la fila, no por el riel abierto.**
   * Son casi lo mismo hoy —Borradores es la única carpeta que los lista— pero no
   * siempre: un borrador destacado sale también en Destacados, y ahí tocarlo tiene
   * que hacer lo mismo. Preguntar por el riel dejaría esa fila abriéndose de dos
   * maneras según desde dónde se la toque.
   *
   * ⚠️ **El cuerpo se pide por `id`**: la lista trae `avance` (las primeras
   * líneas), que alcanza para el renglón y no para retomar la redacción. Abrir un
   * borrador con el avance recortado sería perder lo que no entró en la vista
   * previa, en el gesto que promete recuperarlo todo.
   */
  function abrirFila(h: HiloDeBandeja) {
    if (h.estado !== 'borrador') {
      setLeyendo(comoCorreoEnLista(h));
      return;
    }
    if (abriendoBorrador !== null) return;
    setAbriendoBorrador(h.id);
    void api<{ correo: CorreoCompleto }>(`/api/correos/${h.id}`)
      .then((r) => {
        setBorradorAbierto({
          id: r.correo.id,
          para: r.correo.para ?? '',
          asunto: r.correo.asunto ?? '',
          cuerpo: r.correo.cuerpo ?? '',
          clave: r.correo.clave ?? null,
          remitenteId: r.correo.remitenteId ?? null,
        });
        setRedactando(true);
      })
      .catch(() => {
        // 🔴 **Se cae a la LECTURA, no a un cartel de error ni al composer vacío.**
        // Abrirlo en blanco es lo peligroso: se ve igual que un correo nuevo, y el
        // primer cierre guardaría un borrador vacío encima del que no se pudo traer.
        // La hoja de lectura muestra lo que la lista ya tenía, que es menos de lo que
        // se pidió pero no miente sobre nada.
        setLeyendo(comoCorreoEnLista(h));
      })
      .finally(() => setAbriendoBorrador(null));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ══ BARRA SUPERIOR ══════════════════════════════════════════════════ */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={redactarNuevo}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <PenLine size={16} />
          Redactar
        </button>

        <div className="relative min-w-0 max-w-2xl flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          {/* ⚠️ **`type="text"` y no `type="search"`.** Chrome le pinta al `search` su
              propio fondo de UA, y `appearance-none` no se lo saca: en el tema
              oscuro la píldora salía gris claro sobre el navy, o sea el único
              elemento de la pantalla que no respetaba la marca. Lo que aporta el
              tipo `search` —la crucecita de limpiar— no vale eso; cuando haga
              falta, el botón se dibuja. */}
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en esta carpeta"
            placeholder="Buscar en esta carpeta…"
            className="w-full appearance-none rounded-full border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void bandeja.refetch()}
            aria-label="Actualizar"
            title="Actualizar"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {bandeja.isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <RielDeCorreos
          actual={riel}
          onElegir={cambiarRiel}
          etiquetas={etiquetas.data?.etiquetas ?? []}
          etiquetaActual={etiquetaActual}
          onElegirEtiqueta={(id) => {
            setEtiquetaActual(id);
            setTildados(new Set());
          }}
          onNuevaEtiqueta={() => setRedactando(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* ══ BARRA DE LA BANDEJA ═════════════════════════════════════════ */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
            <input
              id="correos-seleccionar-todo"
              type="checkbox"
              checked={todosTildados}
              onChange={(e) => setTildados(e.target.checked ? new Set(hilos.map((h) => h.id)) : new Set())}
              disabled={hilos.length === 0}
              className="size-3.5 cursor-pointer accent-primary disabled:cursor-default disabled:opacity-40"
            />

            {/* 🔴 **Las acciones masivas aparecen SÓLO con algo tildado.** Dibujarlas
                siempre —apagadas— llena la barra de botones que no hacen nada, y el
                que las mira aprende a ignorar esa zona. Con selección, la barra
                cambia de trabajo, que es lo que la referencia hace. */}
            {seleccion.length > 0 ? (
              <>
                <span className="ml-1 text-xs font-semibold text-foreground">
                  {seleccion.length} seleccionado{seleccion.length === 1 ? '' : 's'}
                </span>
                {/* 🔴 **Estos rótulos dicen «los seleccionados» y los de la fila no,
                    y no es redundancia.** Cada renglón monta su propio «Archivar»
                    —invisible hasta el hover, pero SIEMPRE en el DOM—, así que con
                    el mismo texto hay cuarenta y un botones que se anuncian igual
                    y hacen cosas distintas: uno archiva ese correo y el otro los
                    veinte tildados. Para quien navega con lector de pantalla eso no
                    es un matiz, es no poder saber qué va a pasar. Lo destapó un
                    test que buscaba el botón por su rótulo y encontraba el de la
                    fila. */}
                {/* `role="toolbar"` no es decoración: agrupa las acciones masivas como
                    UNA cosa navegable, separada de los botones que cada renglón monta
                    para sí mismo. Es además lo que le permite a un test preguntar
                    «¿qué ofrece la barra?» sin confundirlo con lo que ofrece una fila. */}
                <div
                  role="toolbar"
                  aria-label="Acciones sobre lo seleccionado"
                  className="ml-2 flex items-center gap-1"
                >
                  <AccionMasiva
                    etiqueta="Marcar como leídos los seleccionados"
                    texto="Marcar como leído"
                    icono={MailOpen}
                    onClick={() => haceALaSeleccion('leer')}
                  />
                  {entrada.archivable && (
                    <AccionMasiva
                      etiqueta="Archivar los seleccionados"
                      texto="Archivar"
                      icono={Archive}
                      onClick={() => haceALaSeleccion('archivar')}
                    />
                  )}
                  {/* 🔴 **LA VUELTA, que faltaba desde que existe la bandeja.**
                      Archivar era un viaje de ida: la acción del server estaba
                      escrita y testeada desde el principio (`a-bandeja`, la misma
                      que «Recuperar» de la papelera) y **ninguna pantalla la
                      ofrecía**, así que quien archivaba por error se quedaba
                      mirando una carpeta sin salida. Una capacidad pagada a la que
                      no se puede llegar es peor que una que falta: nada se ve roto.

                      ⚠️ Va PRIMERO en la barra de Archivados —donde en las otras
                      carpetas está «Archivar»— a propósito: es la acción principal
                      de esta lista, y el lugar es la mitad de lo que la hace
                      encontrable. Quién la ofrece lo dice el catálogo
                      (`dominio/correo.ts`), nunca un `riel === 'archivados'` acá. */}
                  {entrada.desarchivable && (
                    <AccionMasiva
                      etiqueta="Desarchivar los seleccionados"
                      texto="Desarchivar"
                      icono={ArchiveRestore}
                      onClick={() => haceALaSeleccion('a-bandeja')}
                    />
                  )}
                  <AccionMasiva
                    etiqueta="Eliminar los seleccionados"
                    texto="Eliminar"
                    icono={Trash2}
                    variante="destructivo"
                    onClick={() => haceALaSeleccion('papelera')}
                  />
                  <AccionMasiva
                    etiqueta="Marcar como no leídos los seleccionados"
                    texto="Marcar como no leído"
                    icono={Mail}
                    onClick={() => haceALaSeleccion('no-leer')}
                  />
                  <AccionMasiva
                    etiqueta="Posponer un día los seleccionados"
                    texto="Posponer"
                    icono={Clock}
                    onClick={() => haceALaSeleccion('posponer', unDiaDesdeAhora())}
                  />
                </div>
                {accion.isPending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              </>
            ) : (
              /**
               * 🔴 EL RÓTULO DE AL LADO DEL TILDE NOMBRA LA ACCIÓN, NO LA CARPETA.
               *
               * Pedido del dueño (24-ago-2026). Acá decía `entrada.rotulo`, o sea
               * «Enviados» — el nombre de la carpeta que ya está dicho DOS veces
               * arriba: en el riel de la izquierda, resaltado, y en el placeholder
               * del buscador («Buscar en esta carpeta»). Tres carteles para el
               * mismo dato, y ninguno explicaba el cuadradito que tenían al lado.
               *
               * ⚠️ **Y es un `<label>` de verdad, no un `<span>`**: si el texto
               * dice «Seleccionar todo», tocarlo tiene que seleccionar todo — un
               * rótulo que nombra una acción y no la ejecuta enseña a no tocar los
               * de al lado. Con esto el `aria-label` del input sobra: un rótulo
               * visible le gana, y con los dos el lector de pantalla lee el que la
               * vendedora NO ve.
               */
              <label
                htmlFor="correos-seleccionar-todo"
                className={
                  'ml-1 text-xs text-muted-foreground ' +
                  (hilos.length === 0 ? 'opacity-40' : 'cursor-pointer hover:text-foreground')
                }
              >
                Seleccionar todo
              </label>
            )}

            {/* ══ PAGINACIÓN ═══════════════════════════════════════════════ */}
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {total === 0 ? '0' : `${desde}–${hasta} de ${total}`}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                aria-label="Página anterior"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronIzq />
              </button>
              <button
                type="button"
                onClick={() => setPagina((p) => p + 1)}
                disabled={hasta >= total}
                aria-label="Página siguiente"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronDer />
              </button>
            </div>
          </div>

          {/* ══ LOS ENCABEZADOS DE COLUMNA ══════════════════════════════════
              🔴 **No dice «Remitente» en TODAS las carpetas.** En Enviados —el
              arranque de esta pantalla— la columna trae a QUIÉN se le escribió
              (`para`), no quién mandó nada; rotularla «Remitente» ahí sería el
              mismo tipo de mentira que este frente vino a sacar de encima del
              composer. `entrada.columna` es la misma fuente que ya decide qué
              dirección dibuja cada fila (`FilaDeHilo.tsx`), así que el
              encabezado no puede desincronizarse de lo que hay debajo.
              Sin chevrón de orden: no hay ningún control de orden detrás. */}
          {!bandeja.isPending && !bandeja.isError && hilos.length > 0 && (
            <div className="flex shrink-0 items-center gap-3 border-b border-border pb-1.5 pl-2 pr-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="w-[15px] shrink-0" aria-hidden="true" />
              <span className="w-44 shrink-0">{entrada.columna === 'desde' ? 'Remitente' : 'Destinatario'}</span>
              <span className="min-w-0 flex-1">Asunto</span>
              <span className="w-24 shrink-0 text-right">Fecha</span>
            </div>
          )}

          {/* ══ LA LISTA ════════════════════════════════════════════════════ */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {bandeja.isPending ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Cargando la bandeja…</p>
            ) : bandeja.isError ? (
              <div className="px-4 py-6 text-sm">
                <p className="text-foreground">No se pudo leer la bandeja — reintenta en un momento.</p>
                <button
                  type="button"
                  onClick={() => void bandeja.refetch()}
                  className="mt-2.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Reintentar
                </button>
              </div>
            ) : hilos.length === 0 ? (
              <VacioHonesto riel={riel} buscando={busqueda.trim() !== '' || etiquetaActual !== null} />
            ) : (
              hilos.map((h) => (
                <FilaDeHilo
                  key={h.hilo}
                  hilo={h}
                  entrada={entrada}
                  tildado={tildados.has(h.id)}
                  onTildar={(si) => tildar(h.id, si)}
                  onAbrir={() => abrirFila(h)}
                  onDestacar={() =>
                    accion.mutate({ ids: [h.id], accion: h.destacado === true ? 'no-destacar' : 'destacar' })
                  }
                  onArchivar={() => accion.mutate({ ids: [h.id], accion: 'archivar' })}
                  onDesarchivar={() => accion.mutate({ ids: [h.id], accion: 'a-bandeja' })}
                  onPapelera={() => accion.mutate({ ids: [h.id], accion: 'papelera' })}
                  onLeido={(leido) => accion.mutate({ ids: [h.id], accion: leido ? 'leer' : 'no-leer' })}
                  onPosponer={() => accion.mutate({ ids: [h.id], accion: 'posponer', hasta: unDiaDesdeAhora() })}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* ══ EL COMPOSER, ENCIMA ═════════════════════════════════════════════
          🔴 Es un PANEL sobre la bandeja y no una vista aparte: la vendedora
          escribe mirando lo que ya mandó. Ésa es toda la razón por la que el
          rediseño empieza por el ancho — con la columna de 672 px no había dónde
          poner la bandeja detrás.

          ══ EL CLIC AFUERA CIERRA, y pasa por la MISMA puerta que la X ══════
          🔴 `setSenalCerrar` y no `cerrarComposer`: si esto cerrara derecho, el
          gesto más fácil de hacer sin querer sería el único que tira lo escrito
          —justo el defecto que los borradores vinieron a cerrar—. Los dos
          caminos de salida guardan, o ninguno sirve.

          ⚠️ **Y se exige que el clic EMPIECE afuera, no sólo que termine
          afuera.** Es la diferencia con `AdminRemitentes`, que cierra con el
          `onClick` pelado: acá adentro hay un textarea grande, y seleccionar
          texto arrastrando hasta pasarse del borde termina en un `click` sobre
          el overlay. Con la versión simple, subrayar un párrafo hasta el final
          cierra el composer. No se pierde nada —guarda igual— pero te saca de lo
          que estabas haciendo, que en una caja de escribir es lo peor que puede
          hacer un modal. */}
      {redactando && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-end bg-navy/40 p-4 sm:items-center sm:justify-center"
          onMouseDown={(e) => {
            clicEmpezoAfuera.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget || !clicEmpezoAfuera.current) return;
            setSenalCerrar((n) => n + 1);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo correo"
            /* Sin esto, cualquier clic adentro burbujea hasta el overlay y lo
               cierra: escribir en el asunto cerraría el panel. */
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
          >
            {/* ⚠️ **El panel NO repite el título.** El composer ya trae su propio
                encabezado «Nuevo correo» con el contador de ritmo al lado, y dos
                títulos iguales pegados se leen como dos secciones: quien mira
                busca en qué se diferencian. Acá va sólo la salida. */}
            <div className="flex shrink-0 items-center justify-end px-3 pt-3">
              {/* 🔴 **Esta X no cierra: PIDE cerrar.** Lo escrito vive adentro del
                  composer, así que un `setRedactando(false)` acá lo desmontaba con el
                  texto adentro — que es exactamente cómo se perdía media cotización
                  con el clic más barato de la pantalla. Ahora manda la señal, el
                  composer guarda el borrador y contesta cuando está a salvo; si el
                  guardado falla, no contesta y el panel se queda abierto con el texto
                  a la vista. */}
              <button
                type="button"
                onClick={() => setSenalCerrar((n) => n + 1)}
                aria-label="Cerrar el composer"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <Composer
                correoInicial={correoInicial}
                claveInicial={claveInicial}
                nombreInicial={nombreInicial}
                onConsumido={onConsumido}
                borradorInicial={borradorAbierto}
                senalCerrar={senalCerrar}
                onListoParaCerrar={cerrarComposer}
              />
            </div>
          </div>
        </div>
      )}

      {leyendo && <LecturaDeCorreo fila={leyendo} onCerrar={() => setLeyendo(null)} />}
    </div>
  );
}

/**
 * EL VACÍO QUE NO MIENTE.
 *
 * 🔴 **Una lista vacía se lee «no pasó nada», y en Recibidos eso sería falso**:
 * lo que pasa es que Hermes todavía no puede recibir correo. Dibujar el vacío
 * genérico ahí es exactamente el defecto que este módulo ya tuvo con la firma
 * prometida — la pantalla afirmando algo que ninguna línea de código sostiene.
 *
 * ⚠️ Y por eso el texto nombra la causa técnica en criollo en vez de decir «no
 * hay correos»: quien lo lea tiene que poder entender que falta una pieza, no
 * que nadie le escribió.
 */
function VacioHonesto({ riel, buscando }: { riel: Riel; buscando: boolean }) {
  if (buscando) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Nada coincide con eso en esta carpeta.</p>;
  }

  if (riel === 'recibidos' || riel === 'spam') {
    return (
      <div className="px-4 py-8 text-sm leading-relaxed">
        <p className="font-semibold text-foreground">Hermes todavía no recibe correo.</p>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          El canal de salida es Amazon SES, que sólo manda; lo que llega a las casillas de{' '}
          <span className="font-mono text-xs">goberna.us</span> vive en Google Workspace y Hermes no lo lee
          todavía. Esta carpeta ya está cableada: el día que se conecte la entrada, acá aparecen los correos
          sin tocar la pantalla.
        </p>
        <p className="mt-2.5 text-muted-foreground">
          Mientras tanto, lo que sale de acá está en <span className="font-semibold">Enviados</span>.
        </p>
      </div>
    );
  }

  const QUE_FALTA: Partial<Record<Riel, string>> = {
    destacados: 'Nada destacado. La estrella de cada renglón marca lo que quieres volver a encontrar.',
    pospuestos: 'Nada pospuesto. Posponer esconde un correo hasta la fecha que elijas.',
    enviados: 'Todavía no salió ningún correo tuyo desde Hermes.',
    borradores: 'No hay borradores guardados.',
    programados: 'No hay ningún correo esperando su hora.',
    archivados: 'No archivaste nada todavía.',
    papelera: 'La papelera está vacía.',
  };

  return <p className="px-4 py-6 text-sm text-muted-foreground">{QUE_FALTA[riel] ?? 'No hay nada acá.'}</p>;
}

/**
 * UNA PÍLDORA DE LA BARRA MASIVA — ícono + texto, no sólo ícono.
 *
 * ⚠️ **`etiqueta` (larga, «… los seleccionados») sigue siendo el `aria-label`; `texto`
 * (corto) es lo que se VE.** El candado de `bandeja.test.tsx` compara `aria-label`
 * contra el de cada fila —nunca lo que está escrito en pantalla— así que la
 * píldora puede decir «Archivar» a la vista sin volver a anunciarse igual que el
 * «Archivar» invisible-hasta-el-hover de cada renglón.
 */
function AccionMasiva({
  etiqueta,
  texto,
  icono: Icono,
  onClick,
  variante,
}: {
  etiqueta: string;
  texto: string;
  icono: typeof Archive;
  onClick: () => void;
  variante?: 'destructivo';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
        (variante === 'destructivo'
          ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      <Icono size={13} />
      {texto}
    </button>
  );
}

/**
 * ⚠️ **Posponer «un día» se calcula acá y el server lo valida igual.** No es una
 * copia de una regla: el server no decide CUÁNDO, decide que la fecha sea futura
 * (si no, el correo se evapora de Recibidos y de Pospuestos a la vez). Cuando
 * exista el selector de fecha, esto es su default.
 */
function unDiaDesdeAhora(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/**
 * El hilo de la lista, en la forma que `LecturaDeCorreo` ya sabe leer.
 *
 * ⚠️ Existe para no tocar `LecturaDeCorreo`, que anda y tiene su propio candado
 * de cableado (`lecturaCableada.test.ts`). Lo único que esa hoja necesita es el
 * `id` —el cuerpo lo pide ella por `GET /api/correos/:id`— y lo que dibuja
 * mientras llega.
 */
function comoCorreoEnLista(h: HiloDeBandeja): CorreoEnLista {
  return {
    id: h.id,
    vendedoraId: h.vendedoraId,
    para: h.para,
    asunto: h.asunto,
    estado: h.estado === 'fallido' ? 'fallido' : 'enviado',
    motivo: h.motivo,
    desde: h.desde,
    creadoAt: h.creadoAt,
  };
}

/* Los dos chevrones, inline: traer dos íconos más de lucide para dos flechas de
   paginación pesa más que el SVG. */
function ChevronIzq() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronDer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
