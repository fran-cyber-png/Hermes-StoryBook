// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { montar, tocar } from '../../pruebas/dom';
import { RielDeCanales } from './RielDeCanales';
import { opcionDeCanal, opcionesDeCanal } from './canalesDelRiel';

/**
 * EL RIEL DE CANALES — lo que no puede romperse.
 *
 * 🔴 El caso que importa es **Grupos**: es la única entrada que NO filtra la
 * cola. Si terminara mandándole su id a `ColaUnificada`, la cola pediría el
 * canal «grupos» —que no existe en `interactions`— y quedaría vacía sin decir
 * por qué, con la ficha de la derecha pidiendo «Elige a alguien de la cola»
 * para algo que no es alguien.
 */

function botones(c: HTMLElement): HTMLButtonElement[] {
  return [...c.querySelectorAll('button')];
}

function porRotulo(c: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return botones(c).find((b) => (b.textContent ?? '').includes(texto));
}

describe('qué ofrece el riel', () => {
  it('lleva «Todos» más los seis canales', () => {
    const v = montar(<RielDeCanales canal="" onCanal={() => {}} />);
    const texto = (v.contenedor.textContent ?? '').replace(/\s+/g, ' ');
    for (const esperado of ['Todos', 'WhatsApp', 'Facebook', 'Messenger', 'Instagram', 'Formulario', 'Grupos']) {
      expect(texto, `falta «${esperado}» en el riel`).toContain(esperado);
    }
    v.desmontar();
  });

  it('⚠️ en CAMPAÑA no ofrece «Formulario»: ahí no hay landing y sería un filtro que da cero', () => {
    const v = montar(<RielDeCanales canal="" onCanal={() => {}} esDeCampana />);
    expect(v.contenedor.textContent).not.toContain('Formulario');
    expect(v.contenedor.textContent).toContain('WhatsApp');
    v.desmontar();
  });

  it('marca como activo el que baja por prop, y sólo ese', () => {
    const v = montar(<RielDeCanales canal="instagram" onCanal={() => {}} />);
    expect(porRotulo(v.contenedor, 'Instagram')?.getAttribute('aria-pressed')).toBe('true');
    expect(porRotulo(v.contenedor, 'WhatsApp')?.getAttribute('aria-pressed')).toBe('false');
    v.desmontar();
  });
});

describe('🔴 Grupos no es un filtro de la cola', () => {
  it('está apagado y un clic NO cambia el canal', () => {
    const emitidos: string[] = [];
    const v = montar(<RielDeCanales canal="" onCanal={(id) => emitidos.push(id)} />);
    const grupos = porRotulo(v.contenedor, 'Grupos');
    expect(grupos, 'la entrada de Grupos tiene que existir').toBeTruthy();
    expect(grupos!.disabled, 'Grupos tiene que estar deshabilitado mientras no haya ruta').toBe(true);
    tocar(grupos!);
    expect(emitidos, 'un clic en Grupos no puede angostar la cola: no está en `interactions`').toEqual([]);
    v.desmontar();
  });

  it('dice POR QUÉ está apagado, con una insignia visible y no sólo en el `title`', () => {
    const v = montar(<RielDeCanales canal="" onCanal={() => {}} />);
    const grupos = porRotulo(v.contenedor, 'Grupos')!;
    // Visible, no sólo en el `title`: un reloj en la esquina del círculo
    // (rediseño 07-sep-2026) reemplaza a la palabra «Pronto» que antes vivía
    // en una segunda línea de texto — un círculo gris sin ninguna marca se
    // leería como «roto», y esto no está roto: todavía no está.
    expect(
      grupos.querySelector('.lucide-clock'),
      'el reloj de «todavía no» tiene que estar en el DOM',
    ).toBeTruthy();
    // Y el motivo completo llega también a quien navega con lector de pantalla.
    expect(grupos.getAttribute('aria-label') ?? '').toContain('falta la ruta');
    expect(grupos.getAttribute('title') ?? '').toContain('falta la ruta');
    v.desmontar();
  });
});

describe('🔴 el riel nunca le puede dar a la cola un id que no sea un filtro suyo', () => {
  it('todo lo que emite resuelve a una opción de la lista «cola»', () => {
    // El invariante de verdad, y no que la lista tenga seis entradas: el día que
    // alguien agregue un canal que muestra OTRA cosa (comunidades, difusiones),
    // este test se cae si lo deja apretable.
    for (const esDeCampana of [false, true]) {
      const emitidos: string[] = [];
      const v = montar(<RielDeCanales canal="" onCanal={(id) => emitidos.push(id)} esDeCampana={esDeCampana} />);
      for (const b of botones(v.contenedor)) if (!b.disabled) tocar(b);
      for (const id of emitidos) {
        if (id === '') continue; // «Todos» no es una opción, es su ausencia
        const o = opcionDeCanal(id, esDeCampana);
        expect(o, `el riel emitió «${id}» y no existe en la lista`).toBeTruthy();
        expect(o!.lista, `«${id}» no filtra la cola y sin embargo se pudo apretar`).toBe('cola');
      }
      // Y que de verdad haya apretado algo: un riel sin botones pasaría vacío.
      expect(emitidos.length).toBeGreaterThan(1);
      v.desmontar();
    }
  });

  it('«Todos» limpia el filtro', () => {
    const emitidos: string[] = [];
    const v = montar(<RielDeCanales canal="whatsapp" onCanal={(id) => emitidos.push(id)} />);
    tocar(porRotulo(v.contenedor, 'Todos')!);
    expect(emitidos).toEqual(['']);
    v.desmontar();
  });

  it('toda entrada apagada de la lista viene con su motivo escrito', () => {
    for (const o of opcionesDeCanal(false)) {
      if (o.lista === 'cola') continue;
      expect(o.porQueNo, `«${o.id}» no filtra la cola pero no dice por qué está apagado`).toBeTruthy();
    }
  });
});
