// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, test } from 'vitest';
import { esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { PantallaPadron } from './PantallaPadron';

/**
 * EL CABLEADO DE LA FILA QUIETA (ADR 0102) — lo que un test puro no ve.
 *
 * `vistasDelPadron.test.ts` fija la REGLA: qué vista está puesta y qué chips
 * quedan. Esto fija que la pantalla LLAME a esa regla y que cada control que se
 * mudó de lugar siga llegando a la request. Un filtro que se muda y deja de
 * viajar no rompe nada visible: la tabla se sigue viendo, con el recorte
 * equivocado (ADR 0024).
 */

function fila(id: number, nombre: string, asignadoA?: string | null) {
  return {
    id,
    nombre,
    telefono: '51984429504',
    correo: null,
    pais: 'Perú',
    etapa: 'contacted',
    nivel: null,
    gastado: null,
    compras: null,
    conVenta: false,
    curso: null,
    comprado: null,
    fuente: 'landing',
    creadoEn: '2026-09-09T12:00:00Z',
    // Ausente ≠ null: sólo se escribe la clave si el caso la trae.
    ...(asignadoA !== undefined ? { asignadoA } : {}),
  };
}

const CON_DUENA = [fila(1, 'Ana Quispe', null), fila(2, 'Luis Chávez', 'Luz')];

const pedidos: string[] = [];

function instalarFetch({ contactos = CON_DUENA }: { contactos?: unknown[] } = {}): () => void {
  const original = window.fetch;
  pedidos.length = 0;
  window.fetch = (async (entrada: RequestInfo | URL) => {
    const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
    pedidos.push(url);
    const q = new URL(url, 'http://prueba').searchParams;
    const cuerpo = url.includes('/api/padron/facetas')
      ? {
          facetas: {
            pais: [
              { valor: 'Perú', contactos: 17_013 },
              { valor: 'México', contactos: 11_646 },
            ],
            curso: [],
            nivel: [],
            fuente: [],
            etapa: [
              { valor: 'interested', contactos: 667 },
              { valor: 'follow_up', contactos: 137 },
              { valor: 'recontact', contactos: 46 },
              { valor: 'delivered', contactos: 5_792 },
            ],
          },
          // 🔴 La forma REAL con «sin asignar» puesto: `opciones` VACÍO, porque
          // `facetaAsignadoA` cuenta dentro de un recorte que no tiene asignados.
          asignadoA: {
            opciones: q.get('sinHabilitar') === 'true' ? [] : [{ valor: 'luz', contactos: 877 }],
            sinRepartir: 73_200,
          },
          entroPorLinea: [
            { valor: '51987654321', etiqueta: 'Betto', contactos: 612 },
            { valor: '51984429504', etiqueta: 'Ventas Meta', contactos: 7_025 },
          ],
        }
      : url.includes('/api/padron/reparto')
        ? { destinos: ['luz', 'ventas12@grupogoberna.com'], carga: [{ vendedoraId: 'ventas12@grupogoberna.com', contactos: 338 }] }
        : url.includes('/api/padron/ultima-tanda')
          ? { hayTanda: false }
          : url.includes('/api/whatsapp/sesion')
            ? { estado: 'desconectado' }
            : url.includes('/api/padron/contactos')
              ? { contactos, total: 73_200, supervisor: true, porPagina: 50, paginaActual: 1, sinSupervisores: false }
              : {};
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => {
    window.fetch = original;
  };
}

const botones = (m: Montado) => [...m.contenedor.querySelectorAll('button')];
const boton = (m: Montado, texto: string | RegExp) =>
  botones(m).find((b) => {
    const t = b.textContent?.trim() ?? '';
    return typeof texto === 'string' ? t === texto : texto.test(t);
  });
const selectorDeVista = (m: Montado) => m.contenedor.querySelector<HTMLButtonElement>('[aria-label^="Vista:"]');
const encabezados = (m: Montado) => [...m.contenedor.querySelectorAll('th')].map((t) => t.textContent?.trim());
/** Los parámetros de la ÚLTIMA request a la lista — la que decide qué muestra la tabla. */
const ultimaLista = () => {
  const url = [...pedidos].reverse().find((p) => p.includes('/api/padron/contactos'));
  return url ? new URL(url, 'http://prueba').searchParams : null;
};

async function elegirVista(m: Montado, rotulo: RegExp) {
  tocar(selectorDeVista(m)!);
  await esperarA(() => !!boton(m, rotulo), `que el menú de vistas muestre ${rotulo}`);
  tocar(boton(m, rotulo)!);
}

/**
 * Elegir en un `<select>` controlado por React. Mismo motivo que `escribir` en
 * `pruebas/dom.tsx`: con `value = …` a secas React descarta el evento, así que
 * se usa el setter nativo del prototipo.
 */
function elegirEnSelect(select: HTMLSelectElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) throw new Error('sin setter nativo de value en <select>: ¿cambió jsdom?');
  act(() => {
    setter.call(select, valor);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function montarSupervisor(opciones?: { contactos?: unknown[] }) {
  const restaurar = instalarFetch(opciones);
  const m = montar(<PantallaPadron />);
  await esperarA(() => ultimaLista()?.get('sinHabilitar') === 'true', 'que el default del supervisor pida «sin asignar»');
  await esperarA(() => selectorDeVista(m) !== null, 'que aparezca el selector de vista');
  return {
    m,
    cerrar() {
      m.desmontar();
      restaurar();
    },
  };
}

describe('PantallaPadron × la fila quieta', () => {
  test('con el default no se dibuja la fila de chips, y «Filtros» no lleva número', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      await esperarA(() => selectorDeVista(m)?.getAttribute('aria-label') === 'Vista: Sin asignar', 'que la vista diga «Sin asignar»');
      expect(boton(m, 'Limpiar filtros')).toBeUndefined();
      expect(boton(m, /^Filtros/)?.textContent?.trim()).toBe('Filtros');
    } finally {
      cerrar();
    }
  });

  test('elegir «En negociación» REEMPLAZA el recorte: pide la etapa con sin asignar, y la vista lo dice', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      await elegirVista(m, /^En negociación/);
      await esperarA(() => {
        const p = ultimaLista();
        return p?.get('etapa') === 'delivered' && p?.get('sinHabilitar') === 'true';
      }, 'la request con etapa=delivered y sinHabilitar=true');
      expect(selectorDeVista(m)?.getAttribute('aria-label')).toBe('Vista: En negociación sin asignar');
    } finally {
      cerrar();
    }
  });

  test('la vista de la línea con más gente sin asignar pide ESA línea, no la primera que llegó', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      await elegirVista(m, /^Ventas Meta/);
      await esperarA(() => {
        const p = ultimaLista();
        return p?.get('entroPorLinea') === '51984429504' && p?.get('sinHabilitar') === 'true';
      }, 'la request con entroPorLinea=51984429504 y sinHabilitar=true');
    } finally {
      cerrar();
    }
  });

  /**
   * 🔴 EL BUG QUE ESTE REDISEÑO ARREGLA — el atajo «Asignados a ▾» de la franja
   * vieja NO PODÍA LISTAR A NADIE: leía `asignadoA.opciones` de las facetas
   * pedidas con `sinHabilitar: true`, que llegan vacías por definición. En
   * producción decía «Todavía nadie tiene nada asignado» con miles repartidos.
   * El fixture sirve esa forma real; si la vista vuelve a leer de ahí, el
   * `esperarA` de abajo no ve nunca a Ventas12 y se cae — ése es el candado.
   */
  test('🔴 «Asignado a» lista la carga del reparto aunque la faceta «sin asignar» venga vacía', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      tocar(selectorDeVista(m)!);
      await esperarA(() => !!boton(m, /^Ventas12/), 'que «Asignado a» liste a Ventas12');

      tocar(boton(m, /^Ventas12/)!);
      await esperarA(
        () => ultimaLista()?.get('asignadoA') === 'ventas12@grupogoberna.com',
        'la request con asignadoA=ventas12@grupogoberna.com',
      );
      // Una vista «Asignado a» no arrastra el «sin asignar» de antes: se contradirían.
      expect(ultimaLista()?.get('sinHabilitar')).toBeNull();
    } finally {
      cerrar();
    }
  });

  test('País, mudado al panel, sigue filtrando; el chip lo quita y «Limpiar filtros» vuelve a la vista', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      tocar(boton(m, /^Filtros/)!);
      await esperarA(() => !!boton(m, /^País/), 'que el panel muestre País');
      tocar(boton(m, /^País/)!);
      await esperarA(() => !!boton(m, /^Perú/), 'que País liste Perú');
      tocar(boton(m, /^Perú/)!);

      await esperarA(() => ultimaLista()?.get('pais') === 'Perú', 'la request con pais=Perú');
      await esperarA(() => boton(m, /^Filtros/)?.textContent?.trim() === 'Filtros1', 'que «Filtros» diga 1');
      expect(selectorDeVista(m)?.getAttribute('aria-label')).toBe('Vista: Sin asignar');

      /**
       * ⚠️ DESDE ACÁ SE AFIRMA SOBRE LA PANTALLA, NO SOBRE LA ÚLTIMA REQUEST.
       * Volver a un recorte ya pedido lo sirve el caché sin pedir de nuevo, así
       * que «la última request no tiene país» quedaba cierta por la request
       * VIEJA: con «Limpiar filtros» roto a propósito, este test seguía verde.
       */
      const soloLaVista = () =>
        !m.contenedor.querySelector('[aria-label="Quitar Perú"]') &&
        boton(m, /^Filtros/)?.textContent?.trim() === 'Filtros' &&
        selectorDeVista(m)?.getAttribute('aria-label') === 'Vista: Sin asignar';

      // La × del chip saca ESE filtro y deja la vista.
      tocar(m.contenedor.querySelector('[aria-label="Quitar Perú"]')!);
      await esperarA(soloLaVista, 'que la × saque Perú y deje «Sin asignar»');

      // «Limpiar filtros» vuelve a la vista puesta, no al padrón entero.
      tocar(boton(m, /^Perú/)!);
      await esperarA(() => !!boton(m, 'Limpiar filtros'), 'que vuelva el chip y «Limpiar filtros»');
      tocar(boton(m, 'Limpiar filtros')!);
      await esperarA(() => soloLaVista() && !boton(m, 'Limpiar filtros'), 'que «Limpiar filtros» deje sólo la vista');
    } finally {
      cerrar();
    }
  });

  test('el orden viaja en la request y sobrevive a cambiar de vista', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      const orden = m.contenedor.querySelector<HTMLSelectElement>('select[aria-label="Ordenar"]');
      expect(orden).not.toBeNull();
      elegirEnSelect(orden!, 'nombre');
      await esperarA(() => ultimaLista()?.get('orden') === 'nombre', 'la request con orden=nombre');
      expect(ultimaLista()?.get('sinHabilitar')).toBe('true');

      await elegirVista(m, /^En negociación/);
      await esperarA(() => {
        const p = ultimaLista();
        return p?.get('etapa') === 'delivered' && p?.get('orden') === 'nombre';
      }, 'la vista nueva con el orden de antes');
    } finally {
      cerrar();
    }
  });

  test('Repartir no desaparece: apagado con 0 elegidos, armado con una fila y a quién', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      await esperarA(() => !!boton(m, 'Repartir'), 'el botón Repartir con 0 elegidos');
      expect(boton(m, 'Repartir')!.disabled).toBe(true);

      await esperarA(() => m.contenedor.querySelectorAll('tbody tr').length === 2, 'las dos filas');
      tocar(m.contenedor.querySelector('tbody input[type="checkbox"]')!);
      await esperarA(() => !!boton(m, 'Repartir 1'), 'que diga «Repartir 1»');

      tocar(m.contenedor.querySelector('[aria-label="Elegir a quién repartir"]')!);
      await esperarA(() => botones(m).some((b) => b.textContent?.includes('Ventas12')), 'que el destino liste a Ventas12');
      tocar(botones(m).find((b) => b.textContent?.includes('Ventas12'))!);

      await esperarA(() => !!boton(m, 'Repartir 1 a Ventas12'), 'que diga «Repartir 1 a Ventas12»');
      expect(boton(m, 'Repartir 1 a Ventas12')!.disabled).toBe(false);
    } finally {
      cerrar();
    }
  });

  test('«Asignado a»: no en «Sin asignar», sí en «Todos» con la dueña del server, y nunca sin el campo', async () => {
    const conCampo = await montarSupervisor();
    try {
      await esperarA(() => conCampo.m.contenedor.querySelectorAll('tbody tr').length === 2, 'las dos filas');
      // En «Sin asignar» toda la columna diría «—» por definición: no se dibuja.
      expect(encabezados(conCampo.m)).not.toContain('Asignado a');

      await elegirVista(conCampo.m, /^Todos$/);
      await esperarA(() => encabezados(conCampo.m).includes('Asignado a'), 'la columna en «Todos»');
      const filas = [...conCampo.m.contenedor.querySelectorAll('tbody tr')];
      expect(filas[1].textContent).toContain('Luz');
      expect(filas[0].textContent).not.toContain('Luz');
    } finally {
      conCampo.cerrar();
    }

    // Un server que no preguntó (viejo, o sin la tabla del reparto): ausente NO es
    // «sin dueña», y una columna de guiones se leería como «todo esto está libre».
    const sinCampo = await montarSupervisor({ contactos: [fila(1, 'Ana Quispe'), fila(2, 'Luis Chávez')] });
    try {
      await elegirVista(sinCampo.m, /^Todos$/);
      // Sobre la pantalla y no sobre la última request: «Todos» es el MISMO recorte
      // que la primera request de la pantalla (antes de que entre el default), y el
      // caché puede servirlo sin pedir de nuevo — esperar una request nueva
      // colgaba el test según cuánto tardara el caché en soltarla.
      await esperarA(
        () => selectorDeVista(sinCampo.m)?.getAttribute('aria-label') === 'Vista: Todos los contactos',
        'que la vista sea «Todos»',
      );
      await esperarA(() => sinCampo.m.contenedor.querySelectorAll('tbody tr').length === 2, 'las dos filas');
      expect(encabezados(sinCampo.m)).not.toContain('Asignado a');
    } finally {
      sinCampo.cerrar();
    }
  });

  test('el pie dice cuántos hay y cuáles se ven', async () => {
    const { m, cerrar } = await montarSupervisor();
    try {
      await esperarA(() => m.contenedor.textContent?.includes('se ven 1–2') ?? false, 'el resumen del pie');
      expect(m.contenedor.textContent).toContain('73.200 contactos');
    } finally {
      cerrar();
    }
  });
});
