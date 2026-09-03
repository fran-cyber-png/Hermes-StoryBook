import { API_URL } from '../../config';
import { tokenGuardado } from '../../lib/datos/token';

/**
 * LOS DOCUMENTOS QUE SE ADJUNTAN COMO PÁGINA (26-ago-2026) — subirlos y
 * bajarlos. Mismo molde que `dibujo/adjuntos.ts`: el cuerpo viaja en bytes
 * crudos en los dos sentidos (así lo espera `express.raw` del server, y así
 * esquiva el límite de 100 KB de `express.json()`), y la bajada exige el mismo
 * `Authorization` que el resto de `/api/*` — nunca una URL con el token adentro
 * ni una etiqueta que la mande sin cabeceras.
 */

/** Lo que el server acepta. Se repite acá para poder avisar ANTES de subir. */
export const TIPOS_DOCUMENTO_ACEPTADOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

/** Lo que se le pasa a un `<input type="file">`. Las extensiones son la ayuda
 * del selector del sistema operativo; el server igual valida por `content-type`. */
export const ACEPTA_DOCUMENTOS = '.pdf,.docx,.txt,' + TIPOS_DOCUMENTO_ACEPTADOS.join(',');

export interface DocumentoAdjunto {
  archivo: string;
  nombreOriginal: string;
  mime: string;
  bytes: number;
}

export class ErrorDeDocumento extends Error {}

/**
 * SUBE UN DOCUMENTO y devuelve el puntero que la fila de `notas` guarda. El
 * nombre original viaja en un header (`X-Nombre-Original`, URL-encoded: un
 * nombre con tilde o espacio no es un header HTTP válido tal cual) porque el
 * cuerpo son los bytes crudos del archivo, no hay dónde más ponerlo sin volver
 * a un JSON que reintroduciría el límite de 100 KB que este camino esquiva.
 */
export async function subirDocumento(archivo: File): Promise<DocumentoAdjunto> {
  const mime = archivo.type;
  if (!TIPOS_DOCUMENTO_ACEPTADOS.includes(mime as (typeof TIPOS_DOCUMENTO_ACEPTADOS)[number])) {
    throw new ErrorDeDocumento(`«${mime || 'ese tipo de archivo'}» no se puede adjuntar. Solo PDF, Word (.docx) o texto (.txt).`);
  }

  const token = tokenGuardado();
  const res = await fetch(`${API_URL}/api/notas/documentos`, {
    method: 'POST',
    headers: {
      'content-type': mime,
      'x-nombre-original': encodeURIComponent(archivo.name),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: archivo,
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new ErrorDeDocumento(cuerpo.message ?? `No se pudo subir el documento (${res.status}).`);
  }

  const { adjunto } = (await res.json()) as { adjunto: DocumentoAdjunto };
  return adjunto;
}

/**
 * BAJA LOS BYTES de un documento ya adjuntado, autenticado. Devuelve `null` si
 * no se pudo —archivo borrado, red caída— para que quien pinta la página
 * muestre un aviso legible en vez de reventar.
 */
export async function traerDocumento(archivo: string): Promise<Blob | null> {
  try {
    const token = tokenGuardado();
    const res = await fetch(`${API_URL}/api/notas/documentos/${encodeURIComponent(archivo)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
