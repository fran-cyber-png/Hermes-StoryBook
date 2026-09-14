import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { traerDocumento, traerPaginaDePdf } from './documentos';
import type { Nota } from './notas';

/**
 * UNA PÁGINA-DOCUMENTO (26-ago-2026): el visor de un PDF/Word/txt adjuntado
 * como `tipo = 'archivo'` — el gemelo de `EditorDePagina` (BlockNote) para
 * esta segunda clase de página. Nunca se edita desde acá: es un archivo que
 * alguien subió tal cual, no prosa de Hermes, así que no hay autoguardado ni
 * `onCambio` que cablear.
 *
 * ══ POR QUÉ SE BAJA CON `fetch` Y NO CON `<embed src="/api/...">` DIRECTO ═══
 *
 * Mismo motivo que las imágenes de la capa de anotaciones
 * (`dibujo/adjuntos.ts`): `/api/*` exige el token de la vendedora y una
 * etiqueta no manda cabeceras, así que la URL directa dejaría un documento
 * privado al alcance de cualquiera que la copie. Se baja autenticado, se arma
 * un `blob:` local, y ESE es el que entra al visor.
 *
 * ⚠️ **SIN CABECERA PROPIA, a pedido explícito (04-sep-2026).** Hasta acá cada
 * visor abría con un renglón (ícono + nombre + tamaño) y el botón «Descargar»
 * al lado — una cabecera que ocupaba espacio de sobra antes de mostrar una
 * sola línea del documento, y duplicaba el nombre que `AccionesDePagina.tsx`
 * ya edita arriba de este componente. Se sacó entera: «Descargar» se mudó al
 * menú `⋮` de la fila (`MenuDeFila.tsx`, ADR 0093) — queda disponible SIN
 * abrir la página, y el visor arranca donde antes arrancaba la cabecera.
 */

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_TXT = 'text/plain';

/**
 * LA MISMA ALTURA PARA LOS TRES VISORES (04-sep-2026, reportado con captura:
 * un PDF y un Word en pantalla dividida se veían «desalineados» — el PDF casi
 * A4 y el Word compacto, cada uno con su propio criterio de tamaño). Antes de
 * esto cada visor decidía la suya: el PDF por `vh` (ver la cicatriz de abajo),
 * el Word por el contenido real ya sin el margen de papel (la corrección
 * anterior, necesaria pero incompleta: sacó el relleno de sobra y con eso el
 * Word pasó a medir lo que el TEXTO mide, no lo que la CAJA del visor de al
 * lado mide), y el .txt con un `max-height` que tampoco fuerza nada. Ahora
 * los tres usan esta MISMA caja — con scroll propio si el contenido no entra
 * — así que dos páginas abiertas una al lado de la otra (con o sin pantalla
 * dividida) siempre quedan del mismo alto, sea cual sea el tipo de archivo.
 *
 * ⚠️ **LA ALTURA NO PUEDE SER UN `vh` FIJO.** `75vh` es una FRACCIÓN del alto
 * de pantalla, y lo que hay ARRIBA del visor (la barra de pestañas + el
 * renglón de «Nombre · Dividir pantalla») es una cantidad de píxeles FIJA, no
 * una fracción — así que en una pantalla más alta que la que se midió, ese
 * 25% que el `vh` se guarda de más crece más rápido que el espacio de verdad
 * ocupado arriba, y el visor termina más corto que lo que el panel tiene para
 * darle. `calc(100dvh - 17.5rem)` resta ese fijo en vez de reservar un
 * porcentaje — el mismo molde que ya usan los modales de `correos/` y
 * `PanelNotas.tsx` (`max-h-[calc(100dvh-2rem)]`). El offset (17.5rem) es una
 * medida, no un número redondo — y **sirve igual dividida o no**: medido
 * contra el DOM real de las dos mitades, el renglón de arriba mide lo mismo
 * en las dos (`Libreta.tsx` y `PantallaDividida.tsx` comparten el mismo molde
 * de `min-h-7`), así que una sola constante alcanza para ambas.
 */
const ALTO_VISOR = 'h-[calc(100dvh-17.5rem)] min-h-[420px]';

/**
 * EL PDF: cada página, ya renderizada a PNG por el SERVER (08-sep-2026, ver
 * ADR 0101, última sección) — no `pdfjs-dist` en el navegador (dos intentos
 * fallidos con un PDF real, `pdfjs-dist` en el CLIENTE) ni el `<embed>`
 * nativo como camino principal.
 *
 * ⚠️ **POR QUÉ SERVER Y NO NAVEGADOR, DE NUEVO.** `pdfjs-dist` en el cliente
 * rechazó, sin causa reproducible, un PDF real que el `<embed>` abría sin
 * problema. La apuesta acá no es correr el mismo motor en otro lado: es OTRO
 * motor — **PDFium** (`server/src/notas/pdfARaster.ts`, vía `@hyzyla/pdfium`
 * WASM), literalmente el mismo motor que usa Chrome para pintar el `<embed>`.
 * El server convierte cada página a PNG (con caché en disco: la primera
 * vista de un PDF lo renderiza entero, las siguientes leen el archivo ya
 * generado) y el front las muestra como imágenes comunes — contenido NUESTRO
 * en NUESTRO DOM, mismo patrón que `VisorDocx`/`VisorTxt`
 * (`registrarContenedor`), así que el dibujo de la Libreta puede seguirle el
 * scroll sin ningún caso especial en `CapaDeAnotaciones`. Cero librería de
 * PDF en el bundle del navegador: una imagen no necesita parser.
 *
 * **Con red de seguridad, igual que antes**: si el server no puede procesar
 * el PDF (`422 pdf_no_renderizable` — contraseña, estructura corrupta) o la
 * red falla, `traerPaginaDePdf` devuelve `null` y este componente cae al
 * `<embed>` nativo usando el `blob` que `PaginaDocumento` YA tiene descargado
 * — sin una segunda vuelta de red. Nunca una pantalla de error.
 */
function VisorPdf({
  blob,
  archivo,
  nombre,
  registrarContenedor,
}: {
  blob: Blob;
  /** El nombre de archivo en el server (`nota-doc-...pdf`), para pedirle sus páginas. */
  archivo: string;
  nombre: string;
  /** Mismo motivo que en `VisorDocx`: el `<div>` de abajo es el que scrollea de verdad. */
  registrarContenedor?: (el: HTMLDivElement | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'embed'>('cargando');
  const [urlDeRespaldo, setUrlDeRespaldo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const urlsCreadas: string[] = [];
    setEstado('cargando');
    setUrlDeRespaldo(null);

    (async () => {
      const primera = await traerPaginaDePdf(archivo, 1);
      if (!vivo) return;

      if (!primera) {
        const u = URL.createObjectURL(blob);
        urlsCreadas.push(u);
        setUrlDeRespaldo(u);
        setEstado('embed');
        return;
      }
      if (!contenedor.current) return;

      contenedor.current.replaceChildren();
      const pintar = (numero: number, blobDePagina: Blob) => {
        const u = URL.createObjectURL(blobDePagina);
        urlsCreadas.push(u);
        const img = document.createElement('img');
        img.src = u;
        img.alt = `Página ${numero}`;
        img.className = 'mb-2 block w-full rounded border border-border/60 shadow-sm last:mb-0';
        contenedor.current?.appendChild(img);
      };
      pintar(1, primera.blob);

      // El resto en paralelo — todas ya están renderizadas y en caché desde
      // que se pidió la página 1 (`asegurarPaginasRenderizadas` en el
      // server hace TODO el documento de una vez), así que esto es leer
      // archivos ya generados, no volver a correr PDFium.
      const numeros = Array.from({ length: primera.totalDePaginas - 1 }, (_, i) => i + 2);
      const resto = await Promise.all(numeros.map((numero) => traerPaginaDePdf(archivo, numero)));
      if (!vivo || !contenedor.current) return;

      resto.forEach((pagina, i) => {
        // Una página puntual que no llegó (red, no el render — eso ya se
        // sabe que funcionó porque la 1 llegó) se salta: no tiene sentido
        // tirar el documento entero al `<embed>` por una de varias.
        if (pagina) pintar(numeros[i], pagina.blob);
      });

      setEstado('listo');
    })();

    return () => {
      vivo = false;
      urlsCreadas.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [blob, archivo]);

  /** Igual que en `VisorDocx`: recién en `'listo'`, para no medir un `<div>`
   * vacío antes de que las páginas terminen de pintarse. */
  useEffect(() => {
    if (!registrarContenedor) return;
    if (estado !== 'listo') return;
    registrarContenedor(contenedor.current);
    return () => registrarContenedor(null);
  }, [registrarContenedor, estado]);

  if (estado === 'embed') {
    return (
      <div className="flex h-full flex-col">
        {urlDeRespaldo && (
          <embed
            src={urlDeRespaldo}
            type={MIME_PDF}
            className={`${ALTO_VISOR} w-full rounded-lg border border-border`}
            title={nombre}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* `relative`: mismo motivo que en `VisorDocx` y `VisorTxt` — sin
          ancestro posicionado propio, el canvas de anotaciones portado acá
          adentro no queda contenido por ESTE scroll. */}
      <div
        ref={contenedor}
        className={`${ALTO_VISOR} relative overflow-y-auto rounded-lg border border-border bg-muted/30 p-3`}
        title={nombre}
      />

      {estado === 'cargando' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          Preparando la vista previa…
        </p>
      )}
    </div>
  );
}

/**
 * EL WORD: se renderiza a HTML en el navegador con `docx-preview` — no hay
 * conversión del lado del server, así que no hace falta LibreOffice ni
 * ninguna dependencia nativa en el deploy. `ignoreHeight: true` deja que el
 * contenido fluya en un solo scroll en vez de paginarse a la altura de una
 * hoja A4 impresa, que acá no tiene sentido: no hay impresora de por medio.
 *
 * ⚠️ **`ignoreHeight` saca la ALTURA de página, no el MARGEN** (04-sep-2026,
 * reportado con captura: «mucho espacio vertical»). `docx-preview` sigue
 * escribiendo, sección por sección, el `padding` que el propio `.docx` trae
 * de fábrica (`w:pgMar` del XML) — medido en el archivo real de esta sesión:
 * `96px 120px`, es decir **el margen de 1 pulgada de una hoja para
 * imprimir**, arriba de la card que YA tiene su propio `p-6`. No hay opción
 * de `docx-preview` para esto (no existe un `ignoreMargins`): se pisa a mano
 * después de renderizar, mismo criterio que ya justifica `ignoreHeight` —
 * acá no hay impresora, así que el margen de papel tampoco tiene sentido.
 *
 * No es pixel-perfect contra Word (algunas fuentes/plantillas no tienen
 * equivalente en CSS): si algo se rompe, siempre queda «Descargar» en el
 * menú `⋮` de la fila.
 */
function VisorDocx({
  blob,
  registrarContenedor,
}: {
  blob: Blob;
  /**
   * Le presta al padre el `<div>` de VERDAD que scrollea el documento (o
   * `null` al desmontarse) — lo necesita `CapaDeAnotaciones` para portar ahí
   * su canvas, igual que `.hoja-a4` en una página de texto. Mismo motivo: el
   * `ALTO_VISOR` de este visor es fijo, con `overflow-y-auto` propio (ver su
   * docblock) — un Word largo scrollea ACÁ ADENTRO, no en la columna de
   * afuera, y un dibujo posicionado fuera de este `<div>` se queda quieto
   * mientras el documento se escapa por su propio scroll (el mismo defecto
   * que ya se corrigió para BlockNote, 08-sep-2026).
   */
  registrarContenedor?: (el: HTMLDivElement | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (!contenedor.current) return;
        contenedor.current.replaceChildren();
        await renderAsync(blob, contenedor.current, undefined, {
          // `inWrapper: false` — SIN ESTO se ve un rectángulo gris asomando
          // detrás de la página: es `.docx-wrapper`, el fondo con el que
          // docx-preview simula una mesa de trabajo con hojas sueltas encima
          // (como Google Docs). Acá la «mesa» ya la pone `.visor-docx` (el
          // borde blanco de este componente) — un fondo de página adentro de
          // otro fondo de página es justo el defecto que se reportó.
          inWrapper: false,
          // `ignoreWidth: true` — sin esto el documento se renderiza a su
          // ancho de papel real en píxeles (816px para carta), que no
          // coincide con el ancho del contenedor y lo desborda o lo achica
          // de forma rara. Con esto el contenido usa el 100% del ancho que
          // este visor le da, como cualquier otro bloque de la página.
          ignoreWidth: true,
          ignoreHeight: true,
          className: 'docx',
        });
        // El margen de papel que `ignoreHeight` no saca (ver el docblock de
        // arriba) — se pisa DESPUÉS de renderizar porque `docx-preview` lo
        // escribe como `style` inline por sección, y no hay forma de pedirle
        // que no lo haga desde las opciones.
        contenedor.current.querySelectorAll<HTMLElement>('.docx').forEach((seccion) => {
          seccion.style.padding = '0';
        });
        if (vivo) setEstado('listo');
      } catch {
        if (vivo) setEstado('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [blob]);

  /**
   * SE REGISTRA RECIÉN EN `'listo'`, no al montar. `CapaDeAnotaciones` usa la
   * llegada de este nodo como señal de «ya hay algo que medir» (dispara su
   * primera medición) — registrarlo antes de que `renderAsync` termine de
   * escribir mediría un `<div>` vacío, con el `scrollHeight` de la caja fija
   * y no el del documento real.
   */
  useEffect(() => {
    if (!registrarContenedor) return;
    if (estado !== 'listo') return;
    registrarContenedor(contenedor.current);
    return () => registrarContenedor(null);
  }, [registrarContenedor, estado]);

  return (
    <div>
      {estado === 'error' && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          No se pudo mostrar el contenido. Descárgalo para abrirlo en Word.
        </p>
      )}

      {/* Siempre montado (nunca condicionado a `estado`): `renderAsync` escribe
          adentro con `replaceChildren`, así que este nodo tiene que existir
          antes de que la promesa resuelva.
          `overflow-y-auto` — ÚNICO scroll propio de los tres visores: un Word
          real (no el de prueba de esta sesión) puede tener varias páginas de
          texto, y con la caja de altura fija (`ALTO_VISOR`, ver su docblock)
          eso ya no empuja el visor entero hacia abajo — scrollea ADENTRO. */}
      {/* `relative`: sin esto, un canvas portado ACÁ ADENTRO (`CapaDeAnotaciones`,
          08-sep-2026) no queda contenido por el scroll de este `<div>` — un
          `position:absolute` busca el ANCESTRO POSICIONADO más cercano, y sin
          uno propio salta hasta el próximo que sí lo sea, bypaseando el
          `overflow-y-auto` de acá. Mismo arreglo que ya tiene `.hoja-a4`
          (`index.css`), por el mismo motivo. */}
      <div
        ref={contenedor}
        className={`${ALTO_VISOR} relative overflow-y-auto rounded-lg border border-border bg-white p-6 text-black`}
      />

      {estado === 'cargando' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          Preparando la vista previa…
        </p>
      )}
    </div>
  );
}

/** El .txt: se lee tal cual, en monoespaciado — de solo lectura, no se convierte
 * en una página editable de BlockNote (a propósito: sigue siendo el archivo que
 * se subió, no una nota nueva). */
function VisorTxt({
  blob,
  registrarContenedor,
}: {
  blob: Blob;
  /** Mismo motivo que en `VisorDocx`: el `<pre>` de abajo es el que scrollea de verdad. */
  registrarContenedor?: (el: HTMLPreElement | null) => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const contenedor = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    let vivo = true;
    blob.text().then((t) => {
      if (vivo) setTexto(t);
    });
    return () => {
      vivo = false;
    };
  }, [blob]);

  // Recién con `texto` puesto: antes, el `<pre>` está vacío y su `scrollHeight`
  // mediría la caja fija, no el archivo real.
  useEffect(() => {
    if (!registrarContenedor || texto === null) return;
    registrarContenedor(contenedor.current);
    return () => registrarContenedor(null);
  }, [registrarContenedor, texto]);

  return (
    <div>
      {/* `relative`: mismo motivo que en `VisorDocx` — sin ancestro posicionado
          propio, el canvas portado adentro no queda contenido por ESTE
          scroll (`overflow-auto`). */}
      <pre
        ref={contenedor}
        className={`${ALTO_VISOR} relative overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground`}
      >
        {texto ?? ''}
      </pre>
    </div>
  );
}

export function PaginaDocumento({
  nota,
  registrarContenedorDeArchivo,
}: {
  nota: Nota;
  /**
   * El `<div>`/`<pre>` que scrollea de verdad un PDF, un Word o un .txt, o
   * `null` sin uno (todavía cargando, o un PDF que cayó al `<embed>` nativo —
   * ver el docblock de `VisorPdf`). Ver el docblock de `VisorDocx`.
   */
  registrarContenedorDeArchivo?: (el: HTMLElement | null) => void;
}) {
  const archivo = nota.archivo;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!archivo) return;
    let vivo = true;
    setBlob(null);
    setFallo(false);
    traerDocumento(archivo.archivo).then((b) => {
      if (!vivo) return;
      if (b) setBlob(b);
      else setFallo(true);
    });
    return () => {
      vivo = false;
    };
  }, [archivo]);

  if (!archivo) return null;

  if (fallo) {
    return (
      <p className="mx-auto flex max-w-md items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0 text-destructive" />
        No se pudo traer «{archivo.nombreOriginal}». Puede que ya no esté en el servidor.
      </p>
    );
  }

  if (!blob) {
    return (
      <p className="mx-auto flex max-w-md items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        Trayendo «{archivo.nombreOriginal}»…
      </p>
    );
  }

  if (archivo.mime === MIME_PDF) {
    return (
      <VisorPdf
        blob={blob}
        archivo={archivo.archivo}
        nombre={archivo.nombreOriginal}
        registrarContenedor={registrarContenedorDeArchivo}
      />
    );
  }
  if (archivo.mime === MIME_DOCX) {
    return <VisorDocx blob={blob} registrarContenedor={registrarContenedorDeArchivo} />;
  }
  if (archivo.mime === MIME_TXT) {
    return <VisorTxt blob={blob} registrarContenedor={registrarContenedorDeArchivo} />;
  }

  // Un tipo que el server ya no acepta (cambió `TIPOS_DE_DOCUMENTO` y esta fila
  // es vieja): nunca una pantalla muda — «Descargar» sigue disponible en el
  // menú `⋮` de la fila, aunque acá no haya nada que previsualizar.
  return (
    <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      No hay vista previa para este tipo de archivo. Descárgalo desde el menú «⋮» de la fila.
    </p>
  );
}
