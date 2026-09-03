import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, Loader2 } from 'lucide-react';
import { traerDocumento } from './documentos';
import type { Nota } from './notas';

/**
 * UNA PÁGINA-DOCUMENTO (26-ago-2026): el visor de un PDF/Word/txt adjuntado
 * como `tipo = 'archivo'` — el gemelo de `EditorDePagina` (BlockNote) y de
 * `DiagramaPerezoso` (React Flow) para esta tercera clase de página. Nunca se
 * edita desde acá: es un archivo que alguien subió tal cual, no prosa de
 * Hermes, así que no hay autoguardado ni `onCambio` que cablear.
 *
 * ══ POR QUÉ SE BAJA CON `fetch` Y NO CON `<embed src="/api/...">` DIRECTO ═══
 *
 * Mismo motivo que las imágenes de la capa de anotaciones
 * (`dibujo/adjuntos.ts`): `/api/*` exige el token de la vendedora y una
 * etiqueta no manda cabeceras, así que la URL directa dejaría un documento
 * privado al alcance de cualquiera que la copie. Se baja autenticado, se arma
 * un `blob:` local, y ESE es el que entra al visor.
 */

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_TXT = 'text/plain';

function tamañoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** El botón de abajo de cada visor: siempre el mismo, sea cual sea el formato. */
function BotonDescargar({ blob, nombre }: { blob: Blob; nombre: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        // Un `<a download>` disparado a mano: no hay servidor de por medio para
        // esto, el blob ya está en memoria desde la bajada autenticada de arriba.
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        enlace.click();
        URL.revokeObjectURL(url);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Download className="size-3.5" />
      Descargar
    </button>
  );
}

function Cabecera({ nombre, bytes, children }: { nombre: string; bytes: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{nombre}</p>
          <p className="text-xs text-muted-foreground">{tamañoLegible(bytes)}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** El PDF: visor nativo del navegador — no hace falta ninguna librería. */
function VisorPdf({ blob, nombre }: { blob: Blob; nombre: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <div className="flex h-full flex-col">
      <Cabecera nombre={nombre} bytes={blob.size}>
        <BotonDescargar blob={blob} nombre={nombre} />
      </Cabecera>
      {url && (
        <embed
          src={url}
          type={MIME_PDF}
          className="h-[75vh] w-full rounded-lg border border-border"
          title={nombre}
        />
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
 * No es pixel-perfect contra Word (algunas fuentes/plantillas no tienen
 * equivalente en CSS): si algo se rompe, siempre queda «Descargar» al lado.
 */
function VisorDocx({ blob, nombre }: { blob: Blob; nombre: string }) {
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
        if (vivo) setEstado('listo');
      } catch {
        if (vivo) setEstado('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [blob]);

  return (
    <div>
      <Cabecera nombre={nombre} bytes={blob.size}>
        <BotonDescargar blob={blob} nombre={nombre} />
      </Cabecera>

      {estado === 'error' && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          No se pudo mostrar el contenido. Descárgalo para abrirlo en Word.
        </p>
      )}

      {/* Siempre montado (nunca condicionado a `estado`): `renderAsync` escribe
          adentro con `replaceChildren`, así que este nodo tiene que existir
          antes de que la promesa resuelva. */}
      <div
        ref={contenedor}
        className={`rounded-lg border border-border bg-white p-6 text-black ${estado === 'cargando' ? 'min-h-40' : ''}`}
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
function VisorTxt({ blob, nombre }: { blob: Blob; nombre: string }) {
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    blob.text().then((t) => {
      if (vivo) setTexto(t);
    });
    return () => {
      vivo = false;
    };
  }, [blob]);

  return (
    <div>
      <Cabecera nombre={nombre} bytes={blob.size}>
        <BotonDescargar blob={blob} nombre={nombre} />
      </Cabecera>
      <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground">
        {texto ?? ''}
      </pre>
    </div>
  );
}

export function PaginaDocumento({ nota }: { nota: Nota }) {
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

  if (archivo.mime === MIME_PDF) return <VisorPdf blob={blob} nombre={archivo.nombreOriginal} />;
  if (archivo.mime === MIME_DOCX) return <VisorDocx blob={blob} nombre={archivo.nombreOriginal} />;
  if (archivo.mime === MIME_TXT) return <VisorTxt blob={blob} nombre={archivo.nombreOriginal} />;

  // Un tipo que el server ya no acepta (cambió `TIPOS_DE_DOCUMENTO` y esta fila
  // es vieja): se ofrece igual la descarga, nunca una pantalla muda.
  return (
    <div>
      <Cabecera nombre={archivo.nombreOriginal} bytes={archivo.bytes}>
        <BotonDescargar blob={blob} nombre={archivo.nombreOriginal} />
      </Cabecera>
      <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        No hay vista previa para este tipo de archivo.
      </p>
    </div>
  );
}
