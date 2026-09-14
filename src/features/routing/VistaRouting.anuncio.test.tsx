// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { escribir, esperarA, montar, reposar, teclear, type Montado } from '../../pruebas/dom';
import { VistaRouting } from './VistaRouting';

/**
 * REPARTIR UN ANUNCIO EN PORCENTAJES DESDE LA PANTALLA (#1002) — el CABLEADO.
 *
 * `repartoDeAnuncio.test.ts` fija las reglas del editor (qué dice la suma, qué
 * haría el botón) sin DOM. Lo que ninguna regla pura puede ver, y es lo que se
 * fija acá montando `VistaRouting` de verdad (ADR 0024, repetido en ADR 0068):
 *
 *  · que el renglón del anuncio adentro de la campaña ABRA la hoja — la
 *    galería monta piezas sueltas y no lo desmentiría;
 *  · que con 30 + 50 el botón esté apagado y el pie diga «faltan 20 %», y que
 *    con 30 + 70 salga el `PUT` con el conjunto COMPLETO y los números;
 *  · que el Escape cierre la hoja y NO la campaña de atrás.
 */

let montado: Montado | undefined;

const AD = '120249343592840789';

/** La foto de `/api/routing`: una campaña suelta (sin producto), para elegirla directo. */
const FOTO = {
  linea: '51984429504',
  etiqueta: 'Ventas Meta',
  ventanaDias: 30,
  campanas: [
    {
      campanaId: 'c1',
      nombre: '[SEP] OSINT | WSP',
      estado: 'activa',
      anuncios: 1,
      personas: 12,
      ultima: null,
      familia: null,
      vendedoras: [],
    },
  ],
  cursos: [],
  productos: [],
  anunciosSinResolver: 0,
  campanasEnOtraLinea: 0,
  actualizadoAt: null,
  sinMigracion: false,
  destinos: ['Luz', 'Sindy'],
  deBaja: [],
};

let repartoGuardado: { vendedora: string; porcentaje: number }[] = [];
let enviados: { url: string; body: unknown }[] = [];

beforeEach(() => {
  enviados = [];
  repartoGuardado = [];
  localStorage.setItem('hermes.token', 'no-se-verifica-en-el-front');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const u = String(url);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });

      if (opciones?.method === 'PUT') {
        enviados.push({ url: u, body: JSON.parse(String(opciones.body)) });
        return json({ ok: true, cambio: true });
      }
      // ⚠️ Antes que la foto: esta URL también contiene `/api/routing`.
      if (u.includes('/anuncios')) {
        return json({
          anuncios: [{ adId: AD, titular: 'Diploma OSINT', personas: 12, ultima: null, reparto: repartoGuardado }],
        });
      }
      if (u.includes('/api/routing/tablero')) return json({ divisiones: [], familias: [], cayo: [], actualizadoAt: null, ventanaDias: 30 });
      if (u.includes('/api/routing/historial')) return json({ filas: [] });
      if (u.includes('/api/routing')) return json(FOTO);
      return json({ ok: true });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = undefined;
  vi.unstubAllGlobals();
});

async function clic(el: Element): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

function texto(): string {
  return montado?.contenedor.textContent ?? '';
}

function porEtiqueta<T extends Element = HTMLElement>(etiqueta: string): T | null {
  return montado?.contenedor.querySelector<T>(`[aria-label="${etiqueta}"]`) ?? null;
}

/** Elegir la campaña, abrirla y abrir la hoja de su anuncio: el camino de una persona. */
async function abrirLaHojaDelAnuncio(): Promise<void> {
  await esperarA(() => texto().includes('[SEP] OSINT | WSP'), 'la campaña está en la lista');
  const fila = [...montado!.contenedor.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('sin cables'),
  );
  expect(fila, 'la fila de la campaña').toBeTruthy();
  await clic(fila!);

  await esperarA(() => Boolean(porEtiqueta('Ver los anuncios de [SEP] OSINT | WSP')), 'la campaña se dibujó en el lienzo');
  await clic(porEtiqueta('Ver los anuncios de [SEP] OSINT | WSP')!);

  await esperarA(() => Boolean(porEtiqueta('Repartir el anuncio «Diploma OSINT»')), 'el anuncio tiene con qué repartirse');
  await clic(porEtiqueta('Repartir el anuncio «Diploma OSINT»')!);
  await esperarA(() => Boolean(porEtiqueta('Reparto de este anuncio')), 'la hoja del anuncio se abrió');
}

function guardar(): HTMLButtonElement {
  const b = [...montado!.contenedor.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Guardar');
  expect(b, 'el botón de guardar').toBeTruthy();
  return b as HTMLButtonElement;
}

test('🔴 30 + 50 no deja guardar y dice lo que falta; 30 + 70 manda el conjunto completo', async () => {
  montado = montar(<VistaRouting />);
  await abrirLaHojaDelAnuncio();

  escribir(porEtiqueta<HTMLInputElement>('Porcentaje de Luz')!, '30');
  escribir(porEtiqueta<HTMLInputElement>('Porcentaje de Sindy')!, '50');
  await reposar();
  expect(texto()).toContain('faltan 20 %');
  expect(guardar().disabled, 'con 80 % el botón no puede invitar a guardar').toBe(true);

  escribir(porEtiqueta<HTMLInputElement>('Porcentaje de Sindy')!, '70');
  await reposar();
  expect(texto()).toContain('Suma 100 %');
  expect(guardar().disabled).toBe(false);

  await clic(guardar());
  await esperarA(() => enviados.length > 0, 'salió el PUT');
  expect(enviados[0]!.url).toContain(`/api/routing/anuncios/${AD}`);
  expect(enviados[0]!.body).toEqual({
    reparto: [
      { vendedora: 'Luz', porcentaje: 30 },
      { vendedora: 'Sindy', porcentaje: 70 },
    ],
  });
});

test('un anuncio con reparto lo muestra en su renglón, y quitarlo manda el conjunto vacío', async () => {
  repartoGuardado = [
    { vendedora: 'Luz', porcentaje: 70 },
    { vendedora: 'Sindy', porcentaje: 30 },
  ];
  montado = montar(<VistaRouting />);
  await abrirLaHojaDelAnuncio();
  expect(texto()).toContain('Luz 70 % · Sindy 30 %');

  const quitar = [...montado.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Quitar el reparto'));
  expect(quitar, 'con un reparto guardado se puede quitar').toBeTruthy();
  await clic(quitar!);
  await esperarA(() => enviados.length > 0, 'salió el PUT');
  expect(enviados[0]!.body).toEqual({ reparto: [] });
});

test('🔴 el Escape cierra la hoja del anuncio y deja la campaña abierta', async () => {
  /**
   * La vista tiene su propio Escape para cerrar la campaña abierta. Con los dos
   * vivos, un Escape cerraría la hoja y la campaña de una — y quien estaba
   * repartiendo un anuncio perdería la lista de los demás anuncios de atrás.
   */
  montado = montar(<VistaRouting />);
  await abrirLaHojaDelAnuncio();

  teclear('Escape');
  await reposar();
  expect(porEtiqueta('Reparto de este anuncio'), 'la hoja se cerró').toBeNull();
  expect(porEtiqueta('Repartir el anuncio «Diploma OSINT»'), 'la campaña sigue abierta').not.toBeNull();
});
