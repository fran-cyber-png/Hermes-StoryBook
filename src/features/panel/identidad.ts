/**
 * CÓMO SE LLAMA ESTA PERSONA — con cinco nombres compitiendo y ninguno
 * confiable por igual.
 *
 * En producción el pushname de WhatsApp es, muy seguido, «🦋W», «.» o «10 ❤️L»:
 * no sirve para encabezar nada ni para meterlo en un `{nombre}` de plantilla.
 * Al mismo tiempo hay 26.075 leads con el nombre que la persona **escribió ella
 * misma** en el formulario, las fichas de Cerberus con el nombre legal, el
 * padrón de icarus (72.923 contactos, la mayoría sin ficha de Cerberus todavía),
 * y lo que alguien del equipo anotó a mano en «Registrar contacto»
 * (`contacto_ficha`, ADR 0060) — que en campaña, sin Cerberus ni lead-form, es a
 * menudo el ÚNICO nombre que existe (ampliación del 25-ago-2026: sin esto, un
 * contacto recién creado con «Nuevo contacto» y ya reclamado por «Mensaje»
 * seguía diciendo «Sin nombre» en el encabezado, aunque el nombre ya estuviera
 * guardado).
 *
 * La precedencia es la del dato más comprometido: Cerberus (firmó una venta) >
 * icarus (compró, aunque su ficha de cliente todavía no llegó al panel) >
 * formulario (lo tipeó la propia persona) > ficha (lo anotó alguien del equipo,
 * de oído) > pushname (se lo puso para sus amigos).
 *
 * 🔴 **F.2 — ÉSTA ES LA ÚNICA ESCALERA.** Hasta el 8-sep la cabecera admitía el
 * alias de WhatsApp como cuarto escalón y «Quién es» tenía su propia escalera
 * SIN ese escalón — la misma pantalla podía decir «Pedro López» arriba y
 * «Nombre —» treinta píxeles más abajo, para el mismo contacto. Desde el
 * 13-sep-2026 «Quién es» ya no existe: la identidad es la tarjeta de la
 * cabecera, que llama a ÉSTA y no decide el orden por su cuenta.
 *
 * El pushname NO se tira: se muestra como segunda línea cuando difiere, porque
 * es el nombre que aparece en la cola y en el teléfono de la vendedora. Sin eso,
 * el panel diría «Javier Zeballos» mientras el chat dice «javier» y nadie sabría
 * si son la misma persona.
 */

import { etiquetaFuente, type LeadForm } from '../cerberus/leadForm';

export type FuenteNombre = 'cerberus' | 'icarus' | 'formulario' | 'ficha' | 'whatsapp' | 'ninguna';

export interface NombreDelContacto {
  /** El que va grande, arriba. */
  principal: string | null;
  /** El pushname, solo si aporta algo distinto del principal. */
  alias: string | null;
  fuente: FuenteNombre;
}

/**
 * DE DÓNDE SALE EL NOMBRE QUE SE MUESTRA. Va a la vista, chiquito, al lado del
 * alias: decisión del dueño (#118) — «el nombre del formulario manda», pero la
 * ficha tiene que **decir de dónde sale**, porque no es lo mismo un nombre que
 * alguien tipeó en un anuncio que uno que firmó una compra. Sin la procedencia,
 * el panel afirmaría con la misma cara un dato verificado y uno declarado.
 *
 * `icarus` es una función y no una cadena fija: lleva la fecha de la última
 * sincronización (`clientes_padron.sincronizadoAt` / F.1) porque es un dato que
 * puede tener semanas — «de icarus» a secas escondería que puede estar
 * desactualizado.
 */
export const PROCEDENCIA: Record<Exclude<FuenteNombre, 'icarus'>, string | null> = {
  cerberus: 'de Cerberus',
  formulario: 'del formulario',
  ficha: 'registrado a mano',
  whatsapp: null, // el alias YA se muestra como «en WhatsApp: …»: decirlo dos veces sobra
  ninguna: null,
};

/** La procedencia de `icarus`, con la fecha de sincronización al lado. */
export function procedenciaIcarus(sincronizadoEn: string | null | undefined): string {
  if (!sincronizadoEn) return 'de icarus';
  const fecha = new Date(sincronizadoEn);
  if (Number.isNaN(fecha.getTime())) return 'de icarus';
  return `de icarus · ${fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

const canon = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Un nombre tiene que NOMBRAR: al menos una letra o un dígito. Un pushname de
 * pura puntuación o sólo emojis («.», «-», «🦋🦋») no es nombre ni alias —la
 * cabecera de un cliente decía «alias de WhatsApp: .» (#1033)—. «🦋W» sí pasa:
 * la W dice algo, y es justo el alias basura que el caso del formulario fija.
 */
function util(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return /[\p{L}\p{N}]/u.test(s) ? s : null;
}

export function nombreDelContacto(e: {
  pushname?: string | null;
  leadNombre?: string | null;
  cerberusNombre?: string | null;
  /** Del padrón de icarus (F.1), por (sufijo, país). */
  icarusNombre?: string | null;
  fichaNombre?: string | null;
}): NombreDelContacto {
  const push = util(e.pushname);
  const candidatos: [FuenteNombre, string | null][] = [
    ['cerberus', util(e.cerberusNombre)],
    ['icarus', util(e.icarusNombre)],
    ['formulario', util(e.leadNombre)],
    ['ficha', util(e.fichaNombre)],
    ['whatsapp', push],
  ];
  const elegido = candidatos.find(([, v]) => v !== null);
  if (!elegido) return { principal: null, alias: null, fuente: 'ninguna' };

  const [fuente, principal] = elegido;
  const alias = fuente !== 'whatsapp' && push && canon(push) !== canon(principal!) ? push : null;
  return { principal: principal!, alias, fuente };
}

/** De dónde sale el nombre, en palabras («de Cerberus»), o `null` si no hace falta decirlo. */
export function procedenciaDelNombre(nombre: NombreDelContacto, icarusSincronizadoEn?: string | null): string | null {
  if (nombre.fuente === 'icarus') return procedenciaIcarus(icarusSincronizadoEn);
  return PROCEDENCIA[nombre.fuente];
}

/**
 * EL CORREO, UNO, CON SU FUENTE: lo anotado por el equipo, Cerberus, icarus y el
 * formulario, en ese orden.
 *
 * Vivía adentro de `QuienEs.tsx`. Desde que la pestaña «Datos» se fue y el correo
 * pasó a la cabecera (dueño, 13-sep-2026), la precedencia sale a una función: una
 * regla escrita en un componente es la que el próximo componente copia.
 *
 * ⚠️ icarus va entre Cerberus y el formulario: es el correo de una compra hecha,
 * no el que alguien tipeó en un anuncio (F.1).
 */
export function correoDelContacto(e: {
  anotado?: string | null;
  cerberus?: string | null;
  icarus?: string | null;
  lead?: Pick<LeadForm, 'email' | 'fuente'> | null;
}): { valor: string; fuente?: string } {
  const candidatos: [string | null | undefined, string][] = [
    [e.anotado, 'anotado'],
    [e.cerberus, 'Cerberus'],
    [e.icarus, 'de icarus'],
    [e.lead?.email, e.lead ? etiquetaFuente(e.lead.fuente) : 'del formulario'],
  ];
  for (const [valor, fuente] of candidatos) if (valor?.trim()) return { valor: valor.trim(), fuente };
  return { valor: '' };
}
