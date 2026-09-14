// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { montar, tocar } from '../../pruebas/dom';
import { PasarConversacion } from './PasarConversacion';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * «PASAR LA CONVERSACIÓN A» — LO QUE NINGÚN TEST PURO PODÍA VER.
 *
 * El defecto que estos casos fijan no estaba en una regla: estaba en el CABLEADO
 * entre dos listas que llegan en la MISMA respuesta y se cruzan por un id que en
 * producción tiene dos grafías. `mismaVendedora` estaba escrita, probada y
 * exportada; este componente simplemente no la usaba para buscar la carga.
 * Es, otra vez, la lección de ADR 0024 y de la regla dura #11: un test de REGLA
 * no reemplaza uno de CABLEADO.
 *
 * 🔴 **Los datos de abajo son los REALES de la línea 51984429504, medidos en
 * VPS1 el 8-sep-2026**, no un caso ideal — que es la regla dura #10. El caso
 * ideal (un mapa y una rueda que usan la misma grafía) escondía exactamente el
 * defecto: con `Luz` y `luz` escritos igual, el `===` de antes pasaba.
 */

/** `numero_vendedora` de esa línea: lo que marca el modal de Cerberus. */
const DESTINOS_REALES = ['Alex', 'Darian', 'Darwin', 'Jahelly', 'Luz', 'Nicole', 'Sindy'];

/**
 * `comoVaElReparto` de esa línea. Trae a quien está en la rueda Y a quien tiene
 * conversaciones sin estar en ella — por eso `luz` aparece con `orden: 999`.
 *
 * ⚠️ Fíjate en las grafías, que son el punto entero: el destino dice `Luz` y la
 * carga está escrita como `luz`.
 */
const RUEDA_REAL = [
  { vendedoraId: 'ventas10@grupogoberna.com', asignadas: 21, orden: 0, activa: true },
  { vendedoraId: 'ventas11@grupogoberna.com', asignadas: 21, orden: 1, activa: true },
  { vendedoraId: 'ventas12@grupogoberna.com', asignadas: 20, orden: 2, activa: true },
  { vendedoraId: 'luz', asignadas: 3850, orden: 999, activa: false },
  { vendedoraId: 'Sindy', asignadas: 182, orden: 999, activa: false },
  { vendedoraId: 'Aperez', asignadas: 137, orden: 999, activa: false },
];

function conversacion(over: Partial<Conversacion> = {}): Conversacion {
  return {
    clave: 'conv:whatsapp:51958008023:51984429504',
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51958008023',
    persona_nombre: '51 958 008 023',
    numero_propio: '51984429504',
    texto: 'Hola, un gusto saludarte.',
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: true,
    n: 2,
    referencia: new Date().toISOString(),
    ultimo_at: new Date().toISOString(),
    dias: 0,
    nivel: 0,
    ...over,
  } as Conversacion;
}

function abrir(c: Conversacion = conversacion()) {
  const m = montar(<PasarConversacion conversacion={c} miVendedora="alex" />, (cliente) =>
    cliente.setQueryData(['reparto-rueda', '51984429504'], {
      linea: '51984429504',
      rueda: RUEDA_REAL,
      destinos: DESTINOS_REALES,
      nombres: { alex: 'Alex Roldán', luz: 'Luz', sindy: 'Sindy' },
    }),
  );
  const disparador = m.contenedor.querySelector('button');
  if (!disparador) throw new Error('el chip no se dibujó');
  tocar(disparador);
  return m;
}

/** El renglón de una persona en el panel abierto, buscado por su id crudo. */
function renglonDe(contenedor: HTMLElement, id: string): HTMLElement {
  const fila = [...contenedor.querySelectorAll('button')].find(
    (b) => b.querySelector(`span[title="${id}"]`) !== null,
  );
  if (!fila) {
    throw new Error(`no hay renglón para «${id}» — se ofrecen: ${contenedor.textContent}`);
  }
  return fila;
}

describe('PasarConversacion — la carga que se muestra al lado de cada nombre', () => {
  /**
   * 🔴 EL CASO MEDIDO: el selector decía «Luz 0» sobre 3.850 conversaciones.
   *
   * Falla hacia donde duele. El número existe para una sola cosa —no darle la
   * 3.851 a quien ya tiene 3.850— y un cero falso no se lee como un dato que
   * falta: se lee como «esta persona está libre», sobre la más cargada de todas.
   */
  it('encuentra la carga aunque el destino y la asignación tengan distinta grafía', () => {
    const m = abrir();
    expect(renglonDe(m.contenedor, 'Luz').textContent).toContain('3850');
    m.desmontar();
  });

  it('y la de quien sí coincide exacto sigue saliendo igual', () => {
    const m = abrir();
    expect(renglonDe(m.contenedor, 'Sindy').textContent).toContain('182');
    m.desmontar();
  });

  it('quien no tiene ninguna asignada muestra 0, no un hueco', () => {
    const m = abrir();
    expect(renglonDe(m.contenedor, 'Darwin').textContent).toContain('0');
    m.desmontar();
  });

  /**
   * `esActual` tenía el mismo `===`: una conversación que ya es de `luz` no se
   * reconocía contra el destino `Luz`, así que el renglón de su propia dueña
   * quedaba apretable y sin decir «la tiene». Reasignar es idempotente —no rompe
   * nada—, pero el selector estaba afirmando que la conversación no es de ella.
   */
  it('marca «la tiene» a la dueña actual aunque su grafía sea otra', () => {
    const m = abrir(conversacion({ asignada_a: 'luz' }));
    const fila = renglonDe(m.contenedor, 'Luz');
    expect(fila.textContent).toContain('la tiene');
    expect((fila as HTMLButtonElement).disabled).toBe(true);
    m.desmontar();
  });

  /**
   * El tercer `===` del mismo renglón. `miVendedora` es lo que se tipeó al
   * entrar y el destino sale del mapa de Cerberus, así que con la comparación
   * exacta el supervisor no se reconocía en su propia lista — mientras el chip
   * de arriba, que sí normalizaba, ya decía «Tú».
   */
  it('marca «(tú)» a quien está mirando aunque el mapa lo escriba con otra grafía', () => {
    const m = abrir();
    expect(renglonDe(m.contenedor, 'Alex').textContent).toContain('(tú)');
    expect(renglonDe(m.contenedor, 'Sindy').textContent).not.toContain('(tú)');
    m.desmontar();
  });

  /**
   * EL PEDIDO DEL 8-SEP-2026: la lista sale del modal «Vendedoras de la línea»,
   * o sea de `numero_vendedora`. Este caso vive acá y no sólo en el server
   * porque lo que el dueño ve es ESTA lista: si mañana alguien vuelve a sumarle
   * la rueda del lado del server, acá se ve el síntoma exacto que reportó.
   */
  it('no ofrece a las identidades viejas de la rueda, aunque tengan conversaciones', () => {
    const m = abrir();
    const nombres = [...m.contenedor.querySelectorAll('span[title]')].map((s) =>
      s.getAttribute('title'),
    );
    expect(nombres).toEqual(DESTINOS_REALES);
    expect(nombres).not.toContain('ventas10@grupogoberna.com');
    expect(nombres).not.toContain('Tracy');
    m.desmontar();
  });
});
