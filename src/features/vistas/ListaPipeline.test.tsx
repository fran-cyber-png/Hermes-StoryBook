// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { columnasDe, type EtapaTrabajo } from './tablero';
import { SIN_ASIGNAR, type FilaDeLista } from './lista';
import { ListaPipeline } from './ListaPipeline';

/**
 * LA LISTA DEL PIPELINE, MONTADA — ordenar, filtrar por dueña, traer más.
 *
 * Qué filas hay y cómo se filtran está probado en puro (`lista.test.ts`). Lo que
 * se fija acá es el cableado de la tabla: que tocar un encabezado reordene, que
 * el filtro de dueña exista sólo para quien supervisa y que el pie diga la verdad
 * sobre cuántas se ven de cuántas hay.
 */

function conversacion(clave: string, etapa: EtapaTrabajo, p: Partial<Conversacion> = {}): FilaDeLista<Conversacion> {
  const telefono = `51987${clave.padStart(6, '0')}`;
  return {
    etapa,
    c: {
      clave: `conv:whatsapp:${telefono}:51984429504`,
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: telefono,
      persona_nombre: `Persona ${clave}`,
      numero_propio: '51984429504',
      texto: null,
      contexto_texto: null,
      respondida: true,
      ventana_abierta: false,
      pregunto: false,
      n: 1,
      referencia: '2026-09-09T12:00:00.000Z',
      ultimo_at: '2026-09-09T12:00:00.000Z',
      dias: 1,
      nivel: 4,
      etapa_efectiva: etapa,
      ...p,
    },
  };
}

const FILAS = [
  conversacion('1', 'interesado', { n: 3, persona_nombre: 'Ana Quispe', asignada_a: null }),
  conversacion('2', 'cotizado', { n: 20, persona_nombre: 'Beto Ríos', asignada_a: 'sindy.rojas', luz: 'verde' }),
  conversacion('3', 'contactado', { n: 9, persona_nombre: 'Carla Soto', asignada_a: 'Luz' }),
];

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

function pintar(props: Partial<Parameters<typeof ListaPipeline>[0]> = {}) {
  const todo = {
    filas: FILAS,
    columnas: columnasDe('ventas'),
    total: 12531,
    hayMas: true,
    cargandoMas: false,
    onTraerMas: vi.fn(),
    onFicha: vi.fn(),
    onAbrir: vi.fn(),
    ...props,
  };
  vista = montar(<ListaPipeline {...todo} />);
  return { ...todo, contenedor: vista.contenedor };
}

const filas = () => [...document.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const nombres = () => filas().map((f) => f.querySelector('[data-nombre]')?.textContent);
const encabezado = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('thead button')].find((b) => b.textContent?.trim() === texto);

describe('ListaPipeline', () => {
  it('una fila por conversación, en el orden del tablero, con su etapa dicha en singular', () => {
    pintar();
    expect(nombres()).toEqual(['Ana Quispe', 'Beto Ríos', 'Carla Soto']);
    expect(filas()[1].textContent).toContain('Sabe el precio');
  });

  it('🔴 tocar «Mensajes» ordena de más a menos, y tocarlo otra vez de menos a más', () => {
    pintar();
    const mensajes = encabezado('Mensajes');
    expect(mensajes, 'sin encabezado «Mensajes»').toBeDefined();

    // Una cifra se lee de más a menos primero: la conversación más larga es la
    // que se viene a buscar.
    tocar(mensajes!);
    expect(nombres()).toEqual(['Beto Ríos', 'Carla Soto', 'Ana Quispe']);
    expect(mensajes!.closest('th')?.getAttribute('aria-sort')).toBe('descending');

    tocar(mensajes!);
    expect(nombres()).toEqual(['Ana Quispe', 'Carla Soto', 'Beto Ríos']);
    expect(mensajes!.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  /**
   * Un filtro de dueña que llega del Dashboard y no aparece en lo cargado vuelve
   * a «todas» —un `<select>` no puede mostrar una opción que no tiene—, pero lo
   * DICE: el Dashboard prometió una lista de esa persona.
   */
  it('🔴 un filtro de dueña que no aparece en lo cargado lo dice, en vez de volver a «todas» callado', () => {
    const { contenedor } = pintar({ conAsignacion: true, filtroInicial: 'darwin' });
    expect(nombres()).toHaveLength(3);
    expect(contenedor.textContent).toMatch(/Ninguna conversación cargada es de «darwin»/);
  });

  it('🔴 el pie dice cuántas se muestran de cuántas hay, y «Traer más» pide más', () => {
    const { contenedor, onTraerMas } = pintar();
    // El separador de miles lo pone el locale (`es-PE`), no el test.
    expect(contenedor.textContent).toMatch(/Mostrando\s*3\s*de\s*12[.,]531/);
    const traer = [...contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Traer más'));
    expect(traer).toBeDefined();
    tocar(traer!);
    expect(onTraerMas).toHaveBeenCalledTimes(1);
  });

  it('sin nada más que traer, no ofrece «Traer más»', () => {
    const { contenedor } = pintar({ hayMas: false });
    expect(contenedor.textContent).not.toContain('Traer más');
  });

  it('tocar una fila abre la ficha de esa conversación', () => {
    const { onFicha } = pintar();
    tocar(filas()[2]);
    expect(onFicha).toHaveBeenCalledWith(FILAS[2].c);
  });

  it('🔴 quien supervisa ve a quién está asignada y filtra por dueña, con «Sin asignar» entre las opciones', () => {
    const { contenedor } = pintar({ conAsignacion: true });
    expect(contenedor.textContent).toContain('Sin asignar');

    const filtro = contenedor.querySelector<HTMLSelectElement>('select[aria-label="Asignada a"]');
    expect(filtro, 'sin filtro por dueña').not.toBeNull();
    expect([...filtro!.options].map((o) => o.value)).toContain(SIN_ASIGNAR);

    act(() => {
      filtro!.value = SIN_ASIGNAR;
      filtro!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(nombres()).toEqual(['Ana Quispe']);
  });

  /**
   * 🔴 CON UN ORDEN PUESTO, DATOS NUEVOS NO PUEDEN DISPARAR UN BUCLE DE RENDERS.
   *
   * react-table reinicia la página cada vez que cambia el modelo ordenado, y la
   * Lista está fuera del React Compiler (`'use no memo'`), así que sus filas son un
   * arreglo nuevo en cada render: con el orden puesto, cada render pedía otro.
   * Lo encontró la galería compilada —«Maximum update depth exceeded» al tocar
   * «Mensajes» con el tablero refrescando por detrás—, no un test.
   */
  it('🔴 con un orden puesto, datos nuevos no disparan un bucle de renders', async () => {
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { contenedor: _contenedor, ...props } = pintar();
    tocar(encabezado('Mensajes')!);
    let bucle = false;
    try {
      for (let i = 0; i < 3; i++) {
        vista!.repintar(<ListaPipeline {...props} filas={[...FILAS]} />);
        await reposar();
      }
    } catch (e) {
      bucle = String(e).includes('Maximum update depth');
    }
    bucle ||= errores.mock.calls.some((c) => String(c[0]).includes('Maximum update depth'));
    errores.mockRestore();
    expect(bucle, 'la tabla entró en bucle de renders').toBe(false);
    expect(nombres()).toHaveLength(3);
  });

  /** «Quítale el chip [⧗ 6 d] a todo el pipeline» (dueño, 13-sep-2026): la Lista es el mismo pipeline. */
  it('🔴 en campaña no hay columna «Ventana»; en ventas sí', () => {
    pintar();
    expect(encabezado('Ventana'), 'en ventas la columna existe').toBeDefined();
    vista?.desmontar();
    vista = null;
    pintar({ esDeCampana: true, columnas: columnasDe('campana') });
    expect(encabezado('Ventana')).toBeUndefined();
  });

  it('a una vendedora no le ofrece ni la columna ni el filtro de dueña', () => {
    const { contenedor } = pintar();
    expect(contenedor.querySelector('select[aria-label="Asignada a"]')).toBeNull();
    expect(encabezado('Asignada a')).toBeUndefined();
  });
});
