// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useLayoutEffect } from 'react';
import { montar, reposar, tocar, type Montado } from '../pruebas/dom';
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

/**
 * 🔴 EL OTRO PARPADEO — el que el `useLayoutEffect` no podía ver.
 *
 * El atributo llegaba a tiempo y la app parpadeaba igual, porque ~470 elementos
 * tienen `transition-colors` para el hover y una transición de color no
 * distingue de dónde salió el color nuevo: también agarra el cambio de las
 * variables CSS. Medido en Chromium, 100 ms después de dar vuelta el tema, el
 * riel iba por `rgb(166, 172, 181)` —un gris de ningún tema— con el borde del
 * mismo elemento ya en el color nuevo.
 *
 * ⚠️ **Lo que se afirma acá es el INSTANTE, no el resultado.** Preguntar por los
 * colores no sirve: jsdom no corre transiciones, así que el final es idéntico
 * con y sin el arreglo. Lo observable es que la hoja que las apaga esté puesta
 * en el MISMO commit en que se estampa el atributo, y que se vaya después.
 */
it('el cambio de tema apaga las transiciones mientras dura, y las devuelve', async () => {
  const apagador = () => document.querySelectorAll('style[data-sin-transicion-de-tema]');

  arrancarTema();
  montado = montar(<BotonDeTema />);
  await reposar();
  expect(apagador(), 'en reposo no puede quedar ninguna hoja apagando transiciones').toHaveLength(
    0,
  );

  tocar(montado.contenedor.querySelector('button')!);

  // Todavía sin pintar: el atributo ya está puesto y la hoja tiene que seguir
  // encima. Si no está, cada elemento se toma sus 200 ms para llegar al color
  // nuevo y en el medio se ven los dos temas mezclados.
  expect(puesto()).toBe('dark');
  expect(
    apagador(),
    'el tema cambió sin apagar las transiciones: vuelve el cross-fade de 200 ms',
  ).toHaveLength(1);

  // Y se va sola: si quedara, el hover de todos los botones dejaría de
  // transicionar — arreglar el tema rompiendo el resto no es arreglarlo.
  await reposar();
  expect(apagador(), 'la hoja quedó pegada y mató las transiciones de hover').toHaveLength(0);
});

/**
 * 🔴 LA REGLA VIVE EN DOS IDIOMAS, ASÍ QUE HAY QUE CRUZARLOS.
 *
 * El fogonazo al recargar sólo lo evita un script clásico en el `<head>` de
 * `index.html`: `arrancarTema()` viaja en un módulo diferido, detrás de los
 * 822 KB del chunk de entrada, y para cuando corre el `<body>` ya se pintó
 * (700 ms medidos con el fondo equivocado). Pero eso obliga a que la regla
 * —la clave, qué valores son válidos, y el mapa a `dark`/`light`— esté escrita
 * DOS veces: una en HTML y otra en TypeScript.
 *
 * Este test no compara texto: **ejecuta el script del HTML de verdad** y exige
 * que termine en el mismo atributo que `arrancarTema()`. Si alguien cambia la
 * clave, agrega un tema o invierte el mapa de un solo lado, se pone rojo acá en
 * vez de descubrirse como un fogonazo en la máquina de una vendedora.
 */
it('el arranque del HTML dice lo mismo que tema.ts', () => {
  // ⚠️ `import.meta.glob` y NUNCA `node:fs`: con `fs` el test pasa en vitest y
  // **falla el typecheck** de `tsconfig.app.json`, que no lleva los tipos de
  // node (la cicatriz es `etapas.test.ts`, ADR 0049).
  const HTML = import.meta.glob('../../index.html', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;
  const html = Object.values(HTML)[0];
  expect(html, 'no se pudo leer index.html').toBeTruthy();

  const guion = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(guion, 'no hay script de arranque en index.html: vuelve el fogonazo al recargar').toBeTruthy();

  const correrElHtml = () => {
    delete document.documentElement.dataset.theme;
    new Function(guion!)();
    return puesto();
  };

  const casos: Array<{ guardado: string | null; que: string }> = [
    { guardado: JSON.stringify('oscuro'), que: 'la elección oscura' },
    { guardado: JSON.stringify('claro'), que: 'la elección clara' },
    { guardado: 'true', que: 'la basura de la clave vieja' },
    { guardado: 'no-es-json', que: 'un valor ilegible' },
    { guardado: null, que: 'sin elección' },
  ];

  for (const { guardado, que } of casos) {
    if (guardado === null) window.localStorage.removeItem(CLAVE_TEMA);
    else window.localStorage.setItem(CLAVE_TEMA, guardado);
    window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_TEMA, newValue: guardado }));

    const porElHtml = correrElHtml();
    delete document.documentElement.dataset.theme;
    arrancarTema();

    expect(porElHtml, `con ${que}, el HTML y tema.ts eligieron temas distintos`).toBe(puesto());
  }
});
