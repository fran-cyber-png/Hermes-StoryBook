/**
 * LOS DATOS DE LA GALERÍA — separados de `galeria.tsx` para que se puedan
 * testear sin montar React ni pisar `window.fetch`.
 *
 * 🔴 **Por qué existe este archivo, con evidencia:** `FACETAS.etapa` estuvo
 * incompleta acá adentro tres semanas (versión del 4-ago-2026, le faltaban
 * `recontact`/`resold`/`lost`/`client`) y una captura de esta misma galería
 * mostró «Se perdió: 0» cuando en producción hay 7 — casi se validó un
 * rediseño entero contra datos que nunca tuvieron ese valor. Es el candado
 * dura #9 del CLAUDE.md cumpliéndose: una galería con datos viejos no es
 * evidencia. `galeriaDatos.test.ts` hace ese error imposible de repetir sin
 * que un test se ponga rojo solo.
 */

/** Las facetas REALES medidas en producción, con sus conteos. */
export const FACETAS = {
  pais: [
    ['Perú', 17013], ['México', 11646], ['Ecuador', 11310], ['Bolivia', 8646],
    ['República Dominicana', 4270], ['Colombia', 3886], ['Guatemala', 2906],
    ['Panamá', 1753], ['Honduras', 1400], ['Chile', 1351], ['Paraguay', 945],
  ],
  curso: [
    ['Diploma Internacional de Inteligencia', 4820], ['Diplomado en Gestión Pública', 3910],
    ['Manual del Consultor Político', 2140], ['Foro de Estado', 1290], ['War Room', 980],
  ],
  /**
   * Las 10 etapas, COMPLETAS — medidas el 24-ago-2026 (73.145 contactos).
   * `contactosDelGrupo`/`ETAPA_GRUPOS` (`padron.ts`) suman cada una de estas:
   * si falta una, `galeriaDatos.test.ts` lo agarra solo (suma ≠ `TOTAL_PADRON`).
   */
  etapa: [
    ['contacted', 61366], ['delivered', 5796], ['sold', 4968], ['interested', 658],
    ['new', 140], ['follow_up', 135], ['recontact', 46], ['resold', 28], ['lost', 7], ['client', 1],
  ],
  /**
   * `buyer_tier` NUNCA suma `TOTAL_PADRON` a propósito: ~33 % es NULL (ver el
   * docblock de `NIVEL_GRUPOS` en `padron.ts`), y la faceta del server excluye
   * los valores vacíos. No es un candidato para el test de sumar contra el
   * total — sí lo es para «están los 4 valores que `NIVEL_GRUPOS` conoce».
   */
  nivel: [['prospect', 39306], ['single', 6784], ['repeat', 2544], ['vip', 460]],
  fuente: [
    ['crm_import', 39623], ['landing', 19865], ['google_contacts', 5349], ['import', 3366],
    ['whatsapp', 1939], ['escuela_erp', 1827], ['cerberus', 615], ['whatsapp_sync', 429],
    ['goberna_app', 131], ['manual', 1],
  ],
} satisfies Record<string, [string, number][]>;

export const NOMBRES = [
  ['Ana Lucía Quispe Mamani', 'PE', 'Diplomado en Gestión Pública', 'anuncio'],
  ['Roberto Carlos Medina', 'MX', 'Inteligencia y Contrainteligencia', 'formulario'],
  ['María Fernanda Toledo', 'EC', 'Diplomado en Gestión Pública', 'anuncio'],
  ['Luis Alberto Chávez Rojas', 'PE', 'Foro de Estado', 'organico'],
  ['Carmen Rosa Huamán', 'BO', 'Escuela de Gobierno', 'anuncio'],
  ['Jorge Enrique Salazar', 'GT', 'Inteligencia y Contrainteligencia', 'formulario'],
  ['Patricia Elena Vargas', 'PE', 'Diplomado en Gestión Pública', 'anuncio'],
  ['Miguel Ángel Ramírez', 'CO', 'Foro de Estado', 'organico'],
  ['Sandra Milena Ocampo', 'PE', 'Escuela de Gobierno', 'anuncio'],
  ['Diego Armando Flores', 'MX', 'Inteligencia y Contrainteligencia', 'formulario'],
  ['Rosa María Ticona', 'PE', 'Diplomado en Gestión Pública', 'anuncio'],
  ['Fernando José Aguirre', 'EC', 'Foro de Estado', 'organico'],
] as const;

export const TOTAL_PADRON = 73_145;

/**
 * LO QUE LA PANTALLA DEL DUEÑO MOSTRABA EL 10-SEP-2026 — su captura, en tema
 * oscuro, con «sin repartir» puesto. Son los únicos números de HOY que tiene
 * esta galería: el SSH a producción no estuvo disponible para medir el resto.
 *
 * ⚠️ **De la captura salen sólo cuatro cifras**: `total` (73.200), «Contactado»
 * (850, la suma de sus tres valores), «En negociación» (5.792) y `ventasMeta`
 * (7.025). El reparto valor por valor de `etapa` es PROPORCIONAL a lo medido el
 * 24-ago (`FACETAS.etapa`) para que los grupos den esas cifras y el total cuadre:
 * sirve para fotografiar la pantalla, no como dato de un valor suelto.
 */
export const SIN_ASIGNAR = {
  total: 73_200,
  etapa: [
    ['contacted', 61410], ['delivered', 5792], ['sold', 4972], ['interested', 667],
    ['new', 140], ['follow_up', 137], ['recontact', 46], ['resold', 28], ['lost', 7], ['client', 1],
  ],
  ventasMeta: 7_025,
} satisfies { total: number; etapa: [string, number][]; ventasMeta: number };
