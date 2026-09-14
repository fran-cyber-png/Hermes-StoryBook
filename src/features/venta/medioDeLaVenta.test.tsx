// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { FormularioVenta } from './FormularioVenta';
import { ModalVentaCierre } from '../vistas/ModalesCompuerta';
import type { Conversacion } from '../../dominio/conversaciones';
import type { ProductoCurso } from './useVenta';

/**
 * EL MEDIO DE UNA VENTA SE ELIGE — y arranca en lo que Hermes infiere.
 *
 * ── El bug (11-sep-2026, reportado por el dueño) ────────────────────────────
 * «La venta que se registre por Hermes que salga para elegir: solo sale
 * ORGÁNICO. En este caso la venta es postventa.» El Medio era un rótulo, no un
 * campo: `dominio/medioVenta.ts` lo decidía y la vendedora no tenía cómo
 * corregirlo. Y desde el Pipeline (soltar en Cierre) nunca podía salir
 * PostVenta, porque ese camino no le decía al formulario que la persona ya había
 * comprado. En producción la PostVenta es el 37 % de las ventas de Cerberus
 * (2.841 de 7.588, medido el 11-sep-2026): no es un borde.
 *
 * Lo que se fija acá es lo que viaja a Cerberus, no lo que se ve: un select que
 * dice PostVenta y un POST que manda `organico` es exactamente este bug.
 */

const TELEFONO = '51987654321';

const MEDIOS = [
  { id: 'organico', nombre: 'Orgánico' },
  { id: 'pagado', nombre: 'Pagado' },
  { id: 'referente', nombre: 'Referente' },
  { id: 'remarketing', nombre: 'Remarketing' },
  { id: 'postventa', nombre: 'PostVenta' },
];

const CURSO = {
  id: '77',
  nombre: 'Diploma en Gestión Pública',
  precioNormal: 900,
  precioPromocion: 450,
} as unknown as ProductoCurso;

let montado: Montado | null = null;
let ventasCreadas: Array<Record<string, unknown>> = [];
/** Se suelta SIEMPRE al terminar: una promesa colgada deja al runner esperando aunque el test ya haya fallado. */
let soltarOrigen: (o: unknown) => void = () => {};

/**
 * El server de mentira. `origen` puede llegar TARDE (una promesa que el test
 * suelta cuando quiere): es lo que permite ver que la inferencia no le pisa a la
 * vendedora lo que ya eligió.
 */
function conServidor({ origen = null as unknown, origenTarde = null as Promise<unknown> | null, ficha = null as unknown } = {}) {
  ventasCreadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const json = (c: unknown, status = 200) =>
        new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/venta/formulario'))
        return json({
          monedas: [{ id: '1', nombre: 'PEN' }],
          paises: [{ id: '10', nombre: 'Perú' }],
          locales: [{ id: '5', nombre: 'Lima — Miraflores' }],
          medios: MEDIOS,
          origenes: [{ id: 'whatsapp', nombre: 'WhatsApp' }],
        });
      if (url.includes('/api/venta/locales')) return json({ locales: [{ id: '5', nombre: 'Lima — Miraflores' }] });
      if (url.includes('/api/whatsapp/conversacion/')) {
        if (origenTarde) return json({ origen: await origenTarde });
        return json({ origen });
      }
      if (url.includes('/api/contactos/ficha')) return json(ficha);
      if (url.includes('/api/venta/crear')) {
        ventasCreadas.push(JSON.parse(String(init?.body ?? '{}')));
        return json({ ok: true, folio: 'V-000123', ventaId: 123 });
      }
      return json({}, 404);
    }),
  );
}

afterEach(() => {
  soltarOrigen(null);
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

function formulario(yaCompro?: boolean) {
  return (
    <FormularioVenta
      clienteId={4410}
      clienteNombre="Javier Quispe"
      telefono={TELEFONO}
      canal="whatsapp"
      paisNombre="Perú"
      monedaInicial="1"
      lineasIniciales={[{ producto: CURSO, cantidad: 1, precio: '450' }]}
      yaCompro={yaCompro}
      onCerrar={() => {}}
    />
  );
}

function campo(nombre: string): HTMLSelectElement | null {
  const label = [...document.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === nombre);
  return label?.querySelector('select') ?? null;
}
const medio = () => campo('Medio');

function elegir(select: HTMLSelectElement, valor: string) {
  act(() => {
    select.value = valor;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function listoParaRegistrar() {
  await esperarA(() => Boolean(medio()), 'el formulario cargado');
  // El local no se precarga sin una venta anterior: se elige, como la vendedora.
  await esperarA(() => (campo('Local')?.options.length ?? 0) > 1, 'los locales del país');
  elegir(campo('Local')!, '5');
}

function botonRegistrar(): HTMLButtonElement {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Registrar venta') && b.closest('footer'))!;
}

describe('el Medio de la venta se elige', () => {
  test('🔴 ofrece los cinco medios de Cerberus, no un rótulo fijo', async () => {
    conServidor();
    montado = montar(formulario());
    await esperarA(() => Boolean(medio()), 'el select del Medio');
    expect([...medio()!.options].map((o) => o.value)).toEqual(['organico', 'pagado', 'referente', 'remarketing', 'postventa']);
  });

  test('🔴 elegir PostVenta hace que la venta viaje a Cerberus como postventa', async () => {
    conServidor();
    montado = montar(formulario());
    await listoParaRegistrar();
    expect(medio()!.value).toBe('organico');

    elegir(medio()!, 'postventa');
    tocar(botonRegistrar());
    await esperarA(() => ventasCreadas.length === 1, 'el POST de la venta');
    expect(ventasCreadas[0].medio).toBe('postventa');
  });

  /**
   * El origen del lead llega en otra consulta. Si al llegar recalculara el
   * Medio, lo que la vendedora corrigió a mano volvería a lo inferido justo antes
   * de apretar «Registrar» — y no se notaría.
   */
  test('🔴 lo que eligió a mano no lo pisa la inferencia que llega tarde', async () => {
    conServidor({ origenTarde: new Promise((listo) => (soltarOrigen = listo)) });
    montado = montar(formulario());
    await listoParaRegistrar();

    elegir(medio()!, 'referente');
    soltarOrigen({ fuente: 'anuncio' });
    await reposar();
    await reposar();
    expect(medio()!.value).toBe('referente');
  });
});

describe('arranca en lo que Hermes infiere', () => {
  test('ya compró antes: PostVenta, y lo dice', async () => {
    conServidor();
    montado = montar(formulario(true));
    await esperarA(() => medio()?.value === 'postventa', 'PostVenta precargado');
    expect(montado.contenedor.ownerDocument.body.textContent).toContain('ya te había comprado antes');
  });

  test('vino de un anuncio y no compró antes: Pagado', async () => {
    conServidor({ origen: { fuente: 'anuncio' } });
    montado = montar(formulario(false));
    await esperarA(() => medio()?.value === 'pagado', 'Pagado precargado');
  });
});

/**
 * EL CAMINO DEL PIPELINE. Soltar una tarjeta en Cierre abre el mismo formulario,
 * pero armado por `ModalVentaCierre`, que no le pasaba `yaCompro`: ahí la
 * PostVenta era imposible aunque la ficha de Cerberus dijera que ya compró.
 */
describe('desde el Pipeline (soltar en Cierre)', () => {
  const TARJETA = {
    clave: `conv:whatsapp:${TELEFONO}:51984429504`,
    canal: 'whatsapp',
    persona_id: TELEFONO,
    persona_nombre: 'Javier',
    numero_propio: '51984429504',
  } as Conversacion;

  const fichaCliente = (ventasCount: number | null) => ({
    estado: 'cliente',
    id: 4410,
    nombre: 'Javier Quispe',
    codigo: 'C-4410',
    dni: '',
    pais: 'Perú',
    correo: '',
    ventasCount,
    ventas: [],
    verificado: true,
  });

  test('🔴 un cliente con ventas previas arranca en PostVenta', async () => {
    conServidor({ ficha: fichaCliente(3) });
    montado = montar(<ModalVentaCierre c={TARJETA} onCerrar={() => {}} onAbrir={() => {}} />);
    await esperarA(() => medio()?.value === 'postventa', 'PostVenta precargado desde el Pipeline');
  });

  /** `null` es «el detalle de Cerberus no cargó» (F.5), no «nunca compró»: no se afirma PostVenta. */
  test('con las ventas sin verificar no afirma PostVenta', async () => {
    conServidor({ ficha: fichaCliente(null) });
    montado = montar(<ModalVentaCierre c={TARJETA} onCerrar={() => {}} onAbrir={() => {}} />);
    await esperarA(() => Boolean(medio()), 'el formulario desde el Pipeline');
    expect(medio()!.value).toBe('organico');
  });
});
