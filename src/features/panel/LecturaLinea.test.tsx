// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, tocar, type Montado } from '../../pruebas/dom';
import { LecturaLinea } from './LecturaLinea';
import type { Afirmacion } from '../../dominio/lecturas';

/**
 * ══ ACEPTAR Y CORREGIR, CABLEADOS (#784) ════════════════════════════════════
 *
 * 🔴 **Esto es CABLEADO, no regla.** `lecturas.test.ts` ya fija qué dice cada
 * fila y cuál pide veredicto; lo que ningún test puro puede ver es que los
 * botones existan, que estén VISIBLES sin hover y que el clic llegue **con la
 * regla**. Es la lección de ADR 0024 y la de ADR 0068: el defecto casi nunca es
 * la regla mal escrita, es que nadie la llama — y acá hay una tercera forma de
 * fallar, que es llamarla sin el dato que la vuelve útil.
 */

const LEIDA: Afirmacion = {
  id: 'af:1',
  dimension: 'postura',
  valor: 'pide agua',
  detalle: 'Huarmey',
  regla: 'escucha.apoyo',
  origen: 'sistema',
  confianza: 'alta',
  evidencia: 'int:9001',
  cita: 'pide agua para su sector y dice que va a ganar',
  ocurridoAt: '2026-09-05T10:42:00.000Z',
};

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

function pintar(props: Partial<Parameters<typeof LecturaLinea>[0]> = {}) {
  const todo = {
    a: LEIDA,
    esUltima: true,
    onVeredicto: vi.fn(),
    onVerMensaje: vi.fn(),
    ...props,
  };
  vista = montar(
    <ul>
      <LecturaLinea {...todo} />
    </ul>,
  );
  return { ...todo, contenedor: vista.contenedor };
}

const botones = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('button')];

/** El elemento y todos sus ancestros hasta la fila, para juzgar si algo lo esconde. */
function cadenaHastaLaFila(el: HTMLElement): HTMLElement[] {
  const cadena: HTMLElement[] = [];
  let actual: HTMLElement | null = el;
  while (actual && actual.tagName !== 'LI') {
    cadena.push(actual);
    actual = actual.parentElement;
  }
  if (actual) cadena.push(actual);
  return cadena;
}
const boton = (c: HTMLElement, texto: string) => {
  const b = botones(c).find((el) => el.textContent?.includes(texto));
  if (!b) throw new Error(`no se dibujó ningún botón que diga «${texto}»`);
  return b;
};

describe('la fila dice lo que el sistema leyó', () => {
  it('el verbo, el valor y quién lo escribió', () => {
    const { contenedor } = pintar();
    expect(contenedor.textContent).toContain('pide agua');
    expect(contenedor.textContent).toContain('Huarmey');
    expect(contenedor.textContent).toContain('la escucha');
  });

  /** El punto punteado dice «lo escribió una máquina y nadie lo miró». */
  it('🔴 lo del sistema sin veredicto sale punteado', () => {
    const { contenedor } = pintar();
    const punto = contenedor.querySelector<HTMLElement>('[data-punto]');
    expect(punto?.dataset.punto).toBe('sistema');
    expect(punto?.className).toContain('border-dashed');
  });

  it('una vez dictaminada, el punto pasa a lleno: ahora la sostiene una persona', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, veredicto: 'acepta' } });
    const punto = contenedor.querySelector<HTMLElement>('[data-punto]');
    expect(punto?.dataset.punto).toBe('resuelto');
    expect(punto?.className).not.toContain('border-dashed');
  });
});

describe('🔴 las acciones, y que escriban CONTRA LA REGLA', () => {
  /**
   * 🔴 SIEMPRE VISIBLES, no al hover. Son la única fuente de correcciones
   * etiquetadas que el sistema va a tener —hoy hay cero— y en la hoja de
   * contacto en móvil no hay hover que las revele.
   */
  it('🔴 los tres veredictos se dibujan sin que nadie pase el mouse', () => {
    const { contenedor } = pintar();
    for (const texto of ['Está bien', 'Corregir', 'No aplica']) {
      /**
       * ⚠️ **Se mira TODA la cadena hasta la fila, no sólo el botón**, y esa es
       * la parte que hace candado al test. La primera versión miraba
       * `boton.className` y pasaba igual escondiendo las acciones: basta con
       * poner `opacity-0 group-hover:opacity-100` en el DIV que las envuelve
       * —que es exactamente como se esconden Editar y Borrar en `EventoLinea`,
       * o sea el error probable— para que el botón siga limpio y la acción
       * desaparezca. Se descubrió rompiéndolo a propósito y viendo que el test
       * seguía verde (candado 11).
       */
      for (const el of cadenaHastaLaFila(boton(contenedor, texto))) {
        expect(el.className, `${texto} · ${el.tagName}`).not.toContain('opacity-0');
        expect(el.className, `${texto} · ${el.tagName}`).not.toContain('group-hover');
      }
    }
  });

  /**
   * 🔴 **EL ACIERTO DEL TICKET.** La corrección se registra contra la REGLA que
   * produjo el dato, no contra la conversación: de ahí sale la precisión por
   * regla, que es lo que autoriza a una regla a pasar de «sugiere» a «declara»
   * (ADR 0095 §8). Un clic que no lleve la regla escribe una corrección que no
   * sirve para aprender — y eso no se ve en ninguna captura.
   */
  it('🔴 aceptar lleva la regla, no sólo el id', () => {
    const { contenedor, onVeredicto } = pintar();
    tocar(boton(contenedor, 'Está bien'));
    expect(onVeredicto).toHaveBeenCalledWith('af:1', 'acepta', 'escucha.apoyo', undefined);
  });

  it('🔴 corregir lleva la regla Y el valor nuevo', () => {
    const { contenedor, onVeredicto } = pintar();
    tocar(boton(contenedor, 'Corregir'));
    tocar(boton(contenedor, 'Se opone'));
    expect(onVeredicto).toHaveBeenCalledWith('af:1', 'corrige', 'escucha.apoyo', 'se_opone');
  });

  it('«No aplica» es un veredicto propio, no un corregir con cualquier valor', () => {
    const { contenedor, onVeredicto } = pintar();
    tocar(boton(contenedor, 'No aplica'));
    expect(onVeredicto).toHaveBeenCalledWith('af:1', 'no_aplica', 'escucha.apoyo', undefined);
  });

  /** Corregir pasa EN LA FILA: un modal taparía el chat contra el que se verifica. */
  it('corregir abre las opciones en la misma fila, sin modal', () => {
    const { contenedor } = pintar();
    expect(contenedor.textContent).not.toContain('¿Qué dice en realidad?');
    tocar(boton(contenedor, 'Corregir'));
    expect(contenedor.textContent).toContain('¿Qué dice en realidad?');
    expect(contenedor.querySelector('dialog')).toBeNull();
    for (const rotulo of ['Apoya', 'Indeciso', 'Se opone', 'Con el rival']) {
      expect(boton(contenedor, rotulo)).toBeTruthy();
    }
  });

  it('cancelar vuelve a las tres acciones sin dictaminar nada', () => {
    const { contenedor, onVeredicto } = pintar();
    tocar(boton(contenedor, 'Corregir'));
    tocar(boton(contenedor, 'Cancelar'));
    expect(contenedor.textContent).not.toContain('¿Qué dice en realidad?');
    expect(onVeredicto).not.toHaveBeenCalled();
  });

  /**
   * 🔴 Sin lista cerrada de valores no se ofrece la acción: el `lugar` son los
   * distritos del catálogo, una búsqueda y no cuatro botones. Ofrecerlo con una
   * lista recortada dejaría a quien atiende sin poder poner el que de verdad es.
   */
  it('🔴 una dimensión sin lista cerrada no ofrece «Corregir», y sí las otras dos', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, dimension: 'lugar', valor: 'Huarmey' } });
    expect(botones(contenedor).some((b) => b.textContent?.includes('Corregir'))).toBe(false);
    expect(boton(contenedor, 'Está bien')).toBeTruthy();
    expect(boton(contenedor, 'No aplica')).toBeTruthy();
  });

  it('lo que afirmó una persona no ofrece ningún veredicto', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, origen: 'persona' } });
    for (const texto of ['Está bien', 'Corregir', 'No aplica']) {
      expect(botones(contenedor).some((b) => b.textContent?.includes(texto)), texto).toBe(false);
    }
  });

  it('una ya dictaminada tampoco vuelve a preguntar', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, veredicto: 'acepta' } });
    expect(botones(contenedor).some((b) => b.textContent?.includes('Está bien'))).toBe(false);
  });

  /** Sin handler no se dibuja la acción — nunca un no-op (regla de la casa). */
  it('sin `onVeredicto` no se dibujan las acciones', () => {
    const { contenedor } = pintar({ onVeredicto: undefined });
    expect(botones(contenedor).some((b) => b.textContent?.includes('Está bien'))).toBe(false);
  });
});

describe('la evidencia es un ancla al mensaje', () => {
  it('🔴 tocar la cita lleva el hilo al mensaje exacto', () => {
    const { contenedor, onVerMensaje } = pintar();
    tocar(boton(contenedor, 'ver el mensaje en el chat'));
    expect(onVerMensaje).toHaveBeenCalledWith('int:9001');
  });

  /**
   * Un «ver el mensaje» que no lleva a ningún lado es peor que no ofrecerlo — la
   * misma regla por la que el repo no dibuja botones sin handler.
   */
  it('🔴 sin evidencia la cita se dibuja SIN enlace, no con uno muerto', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, evidencia: undefined } });
    expect(contenedor.textContent).toContain('pide agua para su sector');
    expect(contenedor.textContent).not.toContain('ver el mensaje en el chat');
  });

  it('sin handler tampoco se ofrece el enlace', () => {
    const { contenedor } = pintar({ onVerMensaje: undefined });
    expect(contenedor.textContent).not.toContain('ver el mensaje en el chat');
  });
});

describe('una corrección deja las dos cosas a la vista', () => {
  /**
   * 🔴 Corregir REVOCA, no borra. El valor viejo queda tachado al lado del
   * nuevo: es la prueba de que esa regla falló ahí, y lo único con lo que
   * Revisión puede decir «acierta el 94 %».
   */
  it('🔴 el valor viejo queda TACHADO, no desaparece', () => {
    const { contenedor } = pintar({
      a: { ...LEIDA, valor: 'se opone', veredicto: 'corrige', corregidoA: 'apoya', corregidoPor: 'Luz' },
    });
    expect(contenedor.textContent).toContain('corrigió: apoya');
    expect(contenedor.textContent).toContain('por Luz');
    const tachado = contenedor.querySelector('s');
    expect(tachado?.textContent).toBe('se opone');
  });
});

describe('la confianza y la hora', () => {
  it('la alta no se escribe; la media sí', () => {
    expect(pintar().contenedor.textContent).not.toContain('alta');
    vista?.desmontar();
    expect(pintar({ a: { ...LEIDA, confianza: 'media' } }).contenedor.textContent).toContain('media');
  });

  /**
   * 🔴 La hora es la del MENSAJE (`ocurridoAt`), no la de la deducción: el reloj
   * corre cada 15 minutos, así que fechar la lectura diría «10:55» de algo que
   * la persona escribió a las 10:42.
   */
  it('🔴 la hora sale de cuándo habló la persona', () => {
    const { contenedor } = pintar();
    const t = contenedor.querySelector('time');
    expect(t?.textContent).toBe(
      new Date('2026-09-05T10:42:00.000Z').toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );
  });
});

/**
 * 🔴 **EL VERBO SE DIBUJA, y este bloque existe porque no se dibujaba.**
 *
 * `verboDe` estaba escrito, testeado y calculado en cada fila — y el JSX no lo
 * usaba: las filas decían «pide agua» donde tenían que decir «leyó: pide agua».
 * Lo mostró la captura, no un test, porque `lecturas.test.ts` afirmaba sobre el
 * valor devuelto y ahí el verbo estaba perfecto.
 *
 * Es el mismo defecto que este timeline ya tuvo con `fuente`, que durante meses
 * se computaba sin que ningún JSX la usara. Un dato calculado y no dibujado no
 * existe para quien mira.
 */
describe('🔴 los tres verbos llegan al DOM', () => {
  it('🔴 una lectura dice «leyó», no sólo el valor', () => {
    const { contenedor } = pintar();
    expect(contenedor.textContent).toContain('leyó');
    expect(contenedor.textContent).toContain('leyó: pide agua'.replace(': ', ': '));
  });

  it('lo que cambió el tablero dice «anotó»', () => {
    const { contenedor } = pintar({ a: { ...LEIDA, dimension: 'compromiso', valor: 'simpatiza' } });
    expect(contenedor.textContent).toContain('anotó');
  });

  it('lo que espera a una persona dice «propone»', () => {
    const { contenedor } = pintar({
      a: { ...LEIDA, dimension: 'identidad', valor: 'es la misma persona', aplicada: false },
    });
    expect(contenedor.textContent).toContain('propone');
  });

  it('una corregida dice «corrigió», que es el único verbo de una persona', () => {
    const { contenedor } = pintar({
      a: { ...LEIDA, valor: 'se opone', veredicto: 'corrige', corregidoA: 'apoya', corregidoPor: 'Luz' },
    });
    expect(contenedor.textContent).toContain('corrigió');
    expect(contenedor.textContent).toContain('apoya');
  });
});
