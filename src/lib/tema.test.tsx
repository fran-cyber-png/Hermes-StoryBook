// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useLayoutEffect } from 'react';
import { montar, tocar, type Montado } from '../pruebas/dom';
import { BotonDeTema } from '../components/BotonDeTema';
import { CLAVE_TEMA, arrancarTema, temaGuardado, useTema, type Tema } from './tema';
import { useLocalStorage } from './useLocalStorage';

/**
 * EL TEMA ES UNO SOLO, Y ES EL DE LA APP.
 *
 * Lo que este archivo vigila no es «el botón cambia de ícono» —eso se ve en
 * cualquier captura— sino las dos cosas que ya fallaron y no se veían:
 *
 *  1. **Que el interruptor mande sobre TODA la app.** El anterior le pegaba una
 *     clase al contenedor de la Agenda: apretarlo desde ahí y entrar a la
 *     Libreta daba dos temas distintos en la misma sesión.
 *  2. **Que dos lugares que leen el tema lean lo mismo.** La Libreta no puede
 *     usar el `data-theme` del CSS —BlockNote trae hoja propia y hay que pasarle
 *     el tema como prop—, así que hay un segundo lector, y dos lectores que se
 *     desincronizan es exactamente el defecto que `useLocalStorage` vino a
 *     matar.
 */

let montado: Montado | null = null;

beforeEach(() => {
  window.localStorage.removeItem(CLAVE_TEMA);
  // ⚠️ `removeItem` NO alcanza. `useLocalStorage` cachea el crudo en un `Map` de
  // módulo que sobrevive entre casos, así que el tema que dejó el test anterior
  // se filtra al siguiente y la suite pasa a depender del ORDEN. El evento
  // `storage` es la puerta que el propio módulo abre para invalidar esa caché.
  window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_TEMA, newValue: null }));
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
});

const puesto = () => document.documentElement.dataset.theme;

it('sin elección guardada, el tema lo pone el sistema', () => {
  // El `matchMedia` de `pruebas/dom.tsx` contesta «no matchea» a todo, o sea
  // sistema en claro. Es lo único honesto: jsdom no tiene media queries.
  expect(temaGuardado()).toBe(null);
  arrancarTema();
  expect(puesto()).toBe('light');
});

/**
 * La clave anterior guardaba `"true"`/`"false"` (`agenda-dark-mode`). Un valor
 * que no es un tema no puede dejar la app en un tema que no existe: se ignora y
 * manda el sistema.
 */
it('una elección guardada ilegible se ignora en vez de romper', () => {
  for (const basura of ['true', '{"tema":"oscuro"}', 'no-es-json']) {
    window.localStorage.setItem(CLAVE_TEMA, basura);
    expect(temaGuardado(), `«${basura}» no es un tema`).toBe(null);
  }
});

it('lo elegido sobrevive al arranque, aunque el sistema diga otra cosa', () => {
  window.localStorage.setItem(CLAVE_TEMA, JSON.stringify('oscuro'));
  arrancarTema();
  expect(puesto()).toBe('dark');
});

/**
 * 🔴 EL TEST DEL DEFECTO ANTERIOR. El botón tiene que mover `<html>`, no un
 * `<div>` de una vista: es la única forma de que el tema alcance a las pantallas
 * donde el botón no está.
 */
it('el botón da vuelta el tema de toda la app y lo deja guardado', () => {
  arrancarTema();
  montado = montar(<BotonDeTema />);
  const boton = montado.contenedor.querySelector('button')!;

  expect(boton.getAttribute('aria-label')).toBe('Cambiar a modo oscuro');
  tocar(boton);
  expect(puesto()).toBe('dark');
  expect(temaGuardado()).toBe('oscuro');
  expect(boton.getAttribute('aria-label')).toBe('Cambiar a modo claro');

  tocar(boton);
  expect(puesto()).toBe('light');
  expect(temaGuardado()).toBe('claro');
});

it('el otro lector del tema —la Libreta— se entera en el mismo clic', () => {
  // El doble de la Libreta: lo único que hace es lo que hace ella, leer el tema
  // para pasárselo al editor.
  function ComoLaLibreta() {
    const { tema } = useTema();
    return <span data-testid="libreta">{tema}</span>;
  }

  montado = montar(
    <>
      <BotonDeTema />
      <ComoLaLibreta />
    </>,
  );
  const libreta = () => montado!.contenedor.querySelector('[data-testid="libreta"]')!.textContent;

  expect(libreta()).toBe('claro');
  tocar(montado.contenedor.querySelector('button')!);
  expect(libreta()).toBe('oscuro');
});

/**
 * 🔴 EL TEST DEL PARPADEO — mide el ORDEN de los efectos, no el resultado final.
 *
 * `aplicarTema()` vivía en un `useEffect`, que corre DESPUÉS de pintar. El clic
 * ya había cambiado el ícono en ese mismo render, así que quedaba un cuadro con
 * el ícono nuevo y el `data-theme` —o sea, todo el fondo— todavía viejo. Eso es
 * el parpadeo. `useLayoutEffect` corre antes de pintar: los dos llegan juntos.
 *
 * ⚠️ **Mirar el DOM después del clic NO sirve para esto**, y es la trampa en la
 * que cae el intento obvio. Para cuando el test puede preguntar, los efectos
 * pasivos ya corrieron —`act()` los vacía, y `flushSync` también— así que
 * `useEffect` y `useLayoutEffect` dan exactamente el mismo resultado. Un test
 * escrito así pasa con la versión que parpadea: verde y decorativo.
 *
 * La única diferencia observable es CUÁNDO. `Sonda` se cuelga del mismo dato y
 * anota el atributo desde su propio `useLayoutEffect`; como va después de
 * `BotonDeTema` en el árbol, su efecto de layout corre después del de él, dentro
 * del MISMO commit. Si `tema.ts` aplica el tema en la fase de layout, la sonda ya
 * lo ve puesto. Si vuelve a `useEffect`, la sonda lee el valor viejo — el cuadro
 * del parpadeo, congelado y afirmable.
 */
it('el tema se estampa antes de pintar, no un cuadro después', () => {
  const enLayout: string[] = [];

  // Se cuelga de la MISMA clave para re-renderizar con el clic, pero no aplica
  // ningún tema: solo mira. Usar `useTema` acá la volvería cómplice.
  function Sonda() {
    const [guardado] = useLocalStorage<Tema | null>(CLAVE_TEMA, null);
    useLayoutEffect(() => {
      enLayout.push(String(document.documentElement.dataset.theme));
    }, [guardado]);
    return null;
  }

  arrancarTema();
  montado = montar(
    <>
      <BotonDeTema />
      <Sonda />
    </>,
  );
  expect(enLayout).toEqual(['light']);

  tocar(montado.contenedor.querySelector('button')!);

  // La segunda anotación es la del commit del clic. Tiene que decir `dark` ya.
  expect(
    enLayout[1],
    'en la fase de layout el tema todavía era el viejo: `tema.ts` volvió a `useEffect`',
  ).toBe('dark');
});
