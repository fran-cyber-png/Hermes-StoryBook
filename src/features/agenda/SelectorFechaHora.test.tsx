// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { montar, tocar } from '../../pruebas/dom';
import type { Recordatorio } from './agenda';
import { agruparPorDia } from './fechas';
import { SelectorFechaHora } from './SelectorFechaHora';

/**
 * LO QUE ESTE ARCHIVO PROTEGE, Y POR QUÉ EXISTE.
 *
 * Estas dos capacidades venían de la rama de Einyehl322 (#447), que las escribió
 * el 19-ago-2026 en un componente propio. Al día siguiente entró un rediseño que
 * reescribió el mismo archivo y las dos se perdieron — no por una discusión, sino
 * porque **nada las afirmaba**. Se injertaron acá y esto es lo que impide que
 * vuelva a pasar en el próximo rediseño.
 */

const HOY = new Date(2026, 7, 22, 10, 0, 0); // 22-ago-2026, 10:00 local

function recordatorio(id: number, cuando: Date, tipo: string): Recordatorio {
  return {
    id,
    clave: `conv:whatsapp:5199999999${id}:51984429504`,
    canal: 'whatsapp',
    personaId: null,
    personaNombre: null,
    numeroPropio: null,
    nota: 'lo que sea',
    cuando: cuando.toISOString(),
    tipo,
  } as Recordatorio;
}

/** Abre el popover y devuelve las celdas de día del mes. */
function abrir(porDia?: Map<string, Recordatorio[]>) {
  const { contenedor } = montar(
    <SelectorFechaHora valor={null} onSeleccionar={() => {}} porDia={porDia} hoy={HOY} />,
  );
  tocar(contenedor.querySelector('button[aria-label="Elegir fecha"]')!);
  return contenedor;
}

/**
 * La celda de un día de AGOSTO-2026, por `data-dia`.
 *
 * ⚠️ No se busca por el número visible: la grilla son 42 celdas y el mes vecino
 * trae días homónimos. Buscando «31» se agarraba el 31 de JULIO —pasado y
 * deshabilitado— y el test pasaba/fallaba por el motivo equivocado.
 */
function celda(contenedor: HTMLElement, dia: number): HTMLButtonElement {
  const clave = new Date(2026, 7, dia).toDateString();
  return contenedor.querySelector<HTMLButtonElement>(`button[data-dia="${clave}"]`)!;
}

test('🔴 el pasado no se puede elegir — una promesa para ayer no es una promesa', () => {
  const c = abrir();
  expect(celda(c, 21).disabled, 'ayer tiene que estar deshabilitado').toBe(true);
  expect(celda(c, 1).disabled, 'el 1 de este mes ya pasó').toBe(true);
});

test('🔴 HOY sí se puede elegir: el corte es el día, no el instante', () => {
  // Son las 10:00 y la vendedora agenda «para hoy a las 17». Si el corte fuera el
  // instante, el día de hoy quedaría muerto desde las 00:01.
  expect(celda(abrir(), 22).disabled).toBe(false);
});

test('el futuro se puede elegir', () => {
  const c = abrir();
  expect(celda(c, 23).disabled).toBe(false);
  expect(celda(c, 31).disabled).toBe(false);
});

test('🔴 un día con algo agendado lo MUESTRA — es lo que evita la tercera llamada a la misma hora', () => {
  const porDia = agruparPorDia([
    recordatorio(1, new Date(2026, 7, 25, 10, 0), 'llamada'),
    recordatorio(2, new Date(2026, 7, 25, 16, 0), 'wsp'),
  ]);
  const c = abrir(porDia);
  const dia25 = celda(c, 25);
  expect(dia25.querySelectorAll('span.rounded-full').length, 'dos actividades, dos puntos').toBe(2);
  expect(dia25.getAttribute('title')).toContain('2');
  // Y un día sin nada no dibuja ninguno: el punto tiene que significar algo.
  expect(celda(c, 26).querySelectorAll('span.rounded-full').length).toBe(0);
});

test('los puntos se topean en tres: con más no entran en la celda y dejan de leerse', () => {
  const porDia = agruparPorDia(
    [10, 11, 12, 13, 14].map((h, i) => recordatorio(i + 1, new Date(2026, 7, 25, h, 0), 'llamada')),
  );
  expect(celda(abrir(porDia), 25).querySelectorAll('span.rounded-full').length).toBe(3);
});

test('sin `porDia` el calendario se dibuja igual que antes — la prop es opcional', () => {
  const c = abrir(undefined);
  expect(celda(c, 25).querySelectorAll('span.rounded-full').length).toBe(0);
  expect(celda(c, 25).disabled).toBe(false);
});
