// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, tocar, type Montado } from './pruebas/dom';
import App from './App';

/**
 * EL CABLEADO DEL TECLADO DEL SHELL — montado de verdad, no razonado.
 *
 * ── Por qué este archivo existe ──
 * Mover la Libreta al riel (ADR 0034) le sacó una rama a la cascada de Escape de
 * `App.tsx`, y ese es exactamente el lugar donde esta app ya se rompió una vez:
 * el defecto de ADR 0024 no estaba en la decisión —`escapeDePopover.ts` está
 * testeado hasta el hueso— sino en el CABLEADO, y **ningún test puro lo vio**.
 * `ConsultaIvi` se comió el Escape de toda la app y dejaron de andar cerrar la
 * conversación, cerrar la Cabina y cerrar la libreta.
 *
 * Así que acá no se testea una función: se monta el shell entero, con su
 * listener real sobre `window`, y se le tiran teclas que viajan.
 *
 * ── Por qué el server contesta 503 a todo ──
 * Solo `/api/auth/yo` responde bien; TODO lo demás falla a propósito. No es
 * pereza: es lo que hace que el test no dependa de la forma del payload de cada
 * pantalla. Con un `{}` amable, `data` existe y los `data?.campo.find(…)` de los
 * hijos revientan; con un fallo, cada uno cae en su estado de error —que ya está
 * escrito, porque la app tiene que sobrevivir a un server caído— y lo que queda
 * en pie es justo lo que se quiere medir: el shell y su teclado. Un componente
 * nuevo en cualquier vista no puede romper este archivo.
 */

let montado: Montado | null = null;

/** Un token que `quienDiceSer` acepta sin server: `<id>|<vencimiento>` en base64url. */
function tokenVivo(id = 'ana'): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}

beforeEach(() => {
  localStorage.setItem('hermes.token', tokenVivo());
  // Sin esto, un test que dejó ?vista=... en la URL contamina el siguiente.
  history.replaceState(null, '', window.location.pathname);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/yo')) {
        return new Response(
          // `puedeEntrenar: true`: la persona del riel COMPLETO. Desde ADR 0077
          // «Entrenar bot» es de una sola, y sin esto el riel de estos tests
          // tendría nueve vistas y la numeración de abajo mentiría.
          JSON.stringify({ vendedora: { id: 'ana', nombre: 'Ana Lucía', puedeEntrenar: true }, cerberus: true }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{"ok":false,"message":"el test no levanta server"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function abrirApp(): Promise<Montado> {
  montado = montar(<App />);
  await reposar();
  return montado;
}

/** Qué vista está adelante: el `h1` de la cabecera lo dice, y sale de `VISTAS`. */
function vistaActual(m: Montado): string {
  return m.contenedor.querySelector('h1')?.textContent?.trim() ?? '';
}

/**
 * IR A LA LIBRETA Y ESPERAR A QUE ESTÉ DE VERDAD.
 *
 * La Libreta se carga PEREZOSA, así que después del atajo lo que hay en pantalla
 * es el esqueleto del `Suspense`, no el componente. Esperar por una marca del
 * componente REAL —su buscador— y no por un contador de turnos es lo que hace
 * que estos tests digan lo que prometen: sin esto, el de «Escape sigue llegando
 * a window» pasaba mirando un `<div>` de carga, que por supuesto no se come
 * ninguna tecla.
 *
 * ⚠️ **Acá vivía un tope de turnos, y había subido de 50 a 300** cuando el chunk
 * de la vista creció con la Ribbon y el editor de diagramas. Ese número era un
 * sensor accidental del tamaño del bundle: avisaba tarde, en el archivo
 * equivocado, y se apagaba subiéndolo. Ahora el vencimiento es en TIEMPO
 * (`esperarA`, en `pruebas/dom.tsx`) y **el aviso de «el chunk creció» vive en el
 * build**: `npm run presupuesto` falla si BlockNote o React Flow vuelven al
 * camino de entrada de la vista.
 */
async function irALaLibreta(m: Montado, tecla: 'n' | '⌘8' = 'n'): Promise<void> {
  if (tecla === 'n') teclear('n');
  else teclear('8', { meta: true });

  // «Todas las páginas» (el riel, 03-sep-2026) es lo que reemplazó al
  // buscador como marca del componente REAL montado — el riel es la única
  // parte de la Libreta que está SIEMPRE en el DOM, sin depender de que el
  // panel de "Páginas" esté abierto.
  await esperarA(
    () => libretaMontada(m),
    'la Libreta terminó de montarse (si no, el test de abajo no probaría nada)',
  );
}

/** ¿Sigue montado el riel de la Libreta? Mismo marcador que `irALaLibreta` espera. */
function libretaMontada(m: Montado): boolean {
  return [...m.contenedor.querySelectorAll('button')].some((b) => b.textContent?.includes('Todas las páginas'));
}

describe('la Libreta como octava vista', () => {
  it('tiene su lugar en el riel, con las otras siete', async () => {
    const m = await abrirApp();
    // `[title*="⌘"]` deja afuera el botón de salir, que comparte el riel y no es una vista.
    const rotulos = [
      ...m.contenedor.querySelectorAll('nav[aria-label="Vistas"] button[title*="⌘"]'),
    ].map((b) => b.textContent?.trim());

    expect(rotulos).toEqual([
      'Dashboard',
      'Pipeline',
      'Contactos',
      'Mensajes',
      'Correos',
      'Agenda',
      'Entrenar bot',
      'Libreta',
      'Navegador',
    ]);
  });

  /**
   * El rango de ⌘1..N se DERIVA de `VISTAS` desde la vista de entrenamiento —
   * antes era un `'6'` escrito a mano que se quedó corto sin que nada lo dijera.
   * Esto lo fija: si alguien vuelve a escribir el número, ⌘8 deja de andar acá.
   *
   * Y desde el Navegador (ADR 0040) hay un test gemelo para ⌘9, abajo: la
   * PENÚLTIMA vista seguiría andando con un `'8'` escrito a mano, así que el
   * candado real es siempre el de la ÚLTIMA.
   */
  it('⌘8 la abre, y el rango del atajo salió del array', async () => {
    const m = await abrirApp();
    expect(vistaActual(m)).toBe('Dashboard');

    await irALaLibreta(m, '⌘8');

    expect(vistaActual(m)).toBe('Libreta');
  });

  it('«n» sigue andando: lleva a la libreta desde cualquier vista', async () => {
    const m = await abrirApp();
    teclear('4', { meta: true });
    await reposar();
    expect(vistaActual(m)).toBe('Mensajes');

    await irALaLibreta(m);

    expect(vistaActual(m)).toBe('Libreta');
  });

  /**
   * «n» NAVEGA, no alterna. Como hoja se abría y se cerraba con la misma tecla;
   * como vista, alternar significaría que la tecla de ir a la libreta te SACA de
   * la libreta — y no hay a dónde volver que sea obvio.
   */
  it('«n» estando ya en la libreta no te saca de ahí', async () => {
    const m = await abrirApp();
    await irALaLibreta(m);

    teclear('n');
    await reposar();

    expect(vistaActual(m)).toBe('Libreta');
    // Y sigue montada: alternar la habría desmontado, llevándose el borrador.
    expect(libretaMontada(m)).toBe(true);
  });

  it('«n» con el foco en un campo escribe, no navega', async () => {
    const m = await abrirApp();
    const campo = document.createElement('input');
    m.contenedor.appendChild(campo);

    teclear('n', { target: campo });
    await reposar();

    expect(vistaActual(m)).toBe('Dashboard');
  });
});

/**
 * LA CASCADA DE ESCAPE, DESPUÉS DE SACARLE LA RAMA DE LA LIBRETA.
 *
 * Se acortó por ARRIBA (la libreta era la primera). Lo que hay que demostrar es
 * que lo de abajo quedó intacto, y que la vista nueva —que ahora vive montada
 * dentro del shell— no se quedó con la tecla de nadie.
 */
describe('Escape sigue cerrando lo que cerraba', () => {
  it('la cabina se abre con «?» y se cierra con Escape', async () => {
    const m = await abrirApp();
    teclear('?');
    await reposar();
    expect(m.contenedor.textContent).toContain('La cabina');

    teclear('Escape');
    await reposar();

    expect(m.contenedor.textContent).not.toContain('La cabina');
  });

  /** El caso ConsultaIvi, con la vista nueva: parada en la Libreta, Escape sigue siendo del shell. */
  it('la cabina se cierra con Escape TAMBIÉN parada en la Libreta', async () => {
    const m = await abrirApp();
    await irALaLibreta(m);

    teclear('?');
    await reposar();
    expect(m.contenedor.textContent).toContain('La cabina');

    teclear('Escape');
    await reposar();

    expect(m.contenedor.textContent).not.toContain('La cabina');
  });

  /**
   * Y el Escape que no le toca a nadie tiene que SEGUIR VIAJE. Es la medida
   * exacta del defecto de ADR 0024: un listener en captura que corta el evento
   * rompe atajos que ni siquiera están en el archivo que lo registró.
   */
  it('en la Libreta, un Escape que nadie reclama llega igual a window', async () => {
    const m = await abrirApp();
    await irALaLibreta(m);

    const recibio: string[] = [];
    const oreja = (e: KeyboardEvent) => recibio.push(e.key);
    window.addEventListener('keydown', oreja);
    try {
      teclear('Escape');
      await reposar();
    } finally {
      window.removeEventListener('keydown', oreja);
    }

    expect(recibio).toEqual(['Escape']);
    expect(vistaActual(m)).toBe('Libreta');
  });

  it('Escape no saca de la Libreta: de una vista se sale yendo a otra', async () => {
    const m = await abrirApp();
    await irALaLibreta(m);

    teclear('Escape');
    await reposar();

    expect(vistaActual(m)).toBe('Libreta');
    expect(libretaMontada(m)).toBe(true);
  });

  /**
   * Y con el foco EN el filtro de páginas de la libreta, Escape es del campo:
   * ni cierra la vista ni se lleva puesta la cabina de atrás. Es la guarda de
   * `SELECTOR_CAMPOS`, aplicada por el shell — o sea, cableado otra vez.
   *
   * ⚠️ El filtro vive ADENTRO del panel de "Páginas" (03-sep-2026, rediseño),
   * que arranca cerrado — hay que abrirlo primero tocando "Todas las páginas".
   */
  it('Escape con el foco en el filtro de páginas de la libreta no toca nada de atrás', async () => {
    const m = await abrirApp();
    await irALaLibreta(m);
    const todasLasPaginas = [...m.contenedor.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Todas las páginas'),
    )!;
    tocar(todasLasPaginas);
    const filtro = m.contenedor.querySelector<HTMLInputElement>('[aria-label="Filtrar páginas"]');
    expect(filtro, 'se abrió el panel con el filtro adentro').toBeTruthy();

    teclear('?');
    await reposar();
    expect(m.contenedor.textContent).toContain('La cabina');

    teclear('Escape', { target: filtro! });
    await reposar();

    expect(m.contenedor.textContent).toContain('La cabina');
  });
});

/**
 * LA BÚSQUEDA DE LA LIBRETA ES UN CAMPO, Y LOS ATAJOS SUELTOS NO LA PISAN.
 *
 * Con la libreta como hoja el riesgo era chico; como vista se escribe ahí con
 * toda la app viva detrás, y `i`/`a`/`n` son letras que aparecen en cualquier
 * palabra. La guarda existe (`SELECTOR_CAMPOS`), pero el que la aplica es el
 * shell — o sea, cableado.
 */
describe('escribir en la libreta no dispara atajos', () => {
  it('teclear «?» en un campo no abre la cabina', async () => {
    const m = await abrirApp();
    const campo = document.createElement('input');
    m.contenedor.appendChild(campo);

    teclear('?', { target: campo });
    await reposar();

    expect(m.contenedor.textContent).not.toContain('La cabina');
  });
});

/**
 * EL NAVEGADOR COMO NOVENA VISTA (ADR 0040).
 *
 * El candado que importa es el de ⌘9, y hay que decir por qué: el rango de
 * `App.tsx` es `e.key <= String(VISTAS.length)`, así que un `'8'` escrito a mano
 * dejaría andando las ocho primeras y **solo** rompería la última. El test de la
 * Libreta (⌘8) seguiría verde mientras la vista nueva es inalcanzable por
 * teclado — que es exactamente la forma que tuvo el defecto la vez anterior,
 * cuando el número clavado era `'6'`.
 */
describe('el Navegador como novena vista', () => {
  it('⌘9 lo abre: el rango del atajo se sigue derivando de VISTAS', async () => {
    const m = await abrirApp();
    expect(vistaActual(m)).toBe('Dashboard');

    teclear('9', { meta: true });
    await reposar();

    expect(vistaActual(m)).toBe('Navegador');
  });

  /**
   * No se carga perezoso (no tiene por qué: son ~4 KB, no los 269 de BlockNote),
   * así que acá sí alcanza con un turno del event loop. Se verifica que lo que
   * montó es el componente REAL y no un esqueleto — sin esto, el test de arriba
   * podría estar leyendo solo el `h1` de la cabecera.
   */
  it('monta la vista de verdad, con sus destinos', async () => {
    const m = await abrirApp();

    teclear('9', { meta: true });
    // La vista viaja PEREZOSA desde el 21-ago-2026: `reposar()` sola devuelve el
    // fallback del Suspense, no la vista. Se espera a que el chunk resuelva.
    await esperarA(
      () => m.contenedor.querySelector('input[aria-label="Dirección"]') != null,
      'que el Navegador termine de cargar su chunk',
    );

    expect(m.contenedor.querySelector('input[aria-label="Dirección"]')).not.toBeNull();
    expect(m.contenedor.textContent).toContain('Cerberus');
  });
});

/**
 * ROUTING COMO DÉCIMA VISTA — y la primera que NO la ve todo el mundo.
 *
 * Dos cosas que ningún test puro puede ver, y por eso están acá:
 *
 *   1. Que el riel de una persona sea distinto del de otra. La regla
 *      (`vistas/acceso.ts`) está testeada aparte; lo que se rompe en el
 *      CABLEADO es que el riel siga leyendo `VISTAS` y las dibuje todas.
 *   2. 🔴 Que ⌘2..⌘9 SIGAN ANDANDO con diez vistas. El rango se comparaba como
 *      CADENA, y `'2' <= '10'` es **false**: con la décima vista quedaba
 *      andando ⌘1 y se rompían las ocho del medio. El candado de la ÚLTIMA
 *      vista —el que atrapó los dos defectos anteriores— no habría visto éste,
 *      porque la décima no tiene tecla.
 */
/** Entra con otro usuario: el riel depende de quién eres, no del build. */
async function abrirAppComo(id: string, extra: Record<string, unknown> = { puedeEntrenar: true }): Promise<Montado> {
  localStorage.setItem('hermes.token', tokenVivo(id));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/yo')) {
        return new Response(JSON.stringify({ vendedora: { id, nombre: id, ...extra }, cerberus: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{"ok":false}', { status: 503, headers: { 'content-type': 'application/json' } });
    }),
  );
  return abrirApp();
}

describe('Routing, la décima vista', () => {

  const rielDe = (m: Montado) =>
    [...m.contenedor.querySelectorAll('nav[aria-label="Vistas"] button[data-vista]')].map(
      (b) => b.getAttribute('data-vista'),
    );

  it('está en el riel de alan, última', async () => {
    const m = await abrirAppComo('alan');
    expect(rielDe(m).at(-1)).toBe('routing');
  });

  it('y en el de Usuario1, que entra escribiendo su nombre en minúscula', async () => {
    const m = await abrirAppComo('usuario1');
    expect(rielDe(m)).toContain('routing');
  });

  it('no está en el riel de nadie más', async () => {
    const m = await abrirApp(); // `ana`
    expect(rielDe(m)).not.toContain('routing');
    // Las nueve de siempre + Productos y Llamadas, las dos sin tecla propia.
    //
    // ⚠️ El número está clavado a propósito: es el candado de que `soloPara` no
    // deje entrar a nadie de más. Cuando agregues una vista al riel de todos,
    // esta línea se pone roja — y eso es lo que hace, no un estorbo. Súmale uno
    // recién después de comprobar que la vista nueva DEBE verla todo el mundo.
    expect(rielDe(m)).toHaveLength(11);
  });

  /**
   * Se verifica que montó el componente REAL y no solo el `h1` de la cabecera:
   * con el server contestando 503 a todo (ver arriba), la vista cae en su
   * cartel de error, que es su comportamiento escrito. Un esqueleto no diría eso.
   */
  it('se abre desde el riel y monta la vista de verdad', async () => {
    const m = await abrirAppComo('alan');

    m.contenedor.querySelector<HTMLButtonElement>('button[data-vista="routing"]')!.click();
    // Ídem: la vista es perezosa, así que el contenido llega después del chunk.
    await esperarA(
      () => m.contenedor.textContent?.includes('No se puede mostrar el ruteo') === true,
      'que Routing termine de cargar su chunk',
    );

    expect(vistaActual(m)).toBe('Routing');
    expect(m.contenedor.textContent).toContain('No se puede mostrar el ruteo');
  });

  /**
   * 🔴 EL CANDADO QUE IMPORTA ACÁ. Con la comparación de cadenas, este test se
   * pone rojo: ⌘4 no hacía nada y la vista seguía siendo el Dashboard.
   */
  it('con diez vistas, ⌘2..⌘9 siguen andando', async () => {
    const m = await abrirAppComo('alan');

    teclear('4', { meta: true });
    await reposar();
    expect(vistaActual(m)).toBe('Mensajes');

    teclear('9', { meta: true });
    await reposar();
    expect(vistaActual(m)).toBe('Navegador');
  });

  /**
   * No hay tecla ⌘10, así que el tooltip no la nombra: prometer una tecla que
   * no existe se prueba una vez, no anda, y no se vuelve a confiar en el resto.
   */
  it('no promete un ⌘10 que no existe', async () => {
    const m = await abrirAppComo('alan');
    const boton = m.contenedor.querySelector('button[data-vista="routing"]');

    expect(boton?.getAttribute('title')).toBe('Routing');
  });

  it('la cabina cuenta las vistas de quien la abre', async () => {
    const m = await abrirAppComo('alan');

    teclear('?');
    await reposar();

    // Nueve teclas para diez vistas: la cabina no inventa la décima.
    expect(m.contenedor.textContent).toContain('⌘9');
    expect(m.contenedor.textContent).not.toContain('⌘10');
  });
});

/**
 * ENTRENAR BOT ES DE UNA PERSONA (ADR 0077). Para el resto del equipo no está en
 * el riel y la numeración se corre sola —la Libreta pasa a ⌘7—, que es lo que ya
 * pasaba con los operadores de campaña: el riel, los ⌘N y la Cabina leen la misma
 * lista filtrada. El que de verdad niega es el server (`soloEntrenadoras`); esto
 * fija que el riel no prometa un ícono que contesta 403.
 */
describe('Entrenar bot, sólo para la entrenadora', () => {
  it('quien no entrena no lo tiene en el riel, y la Libreta pasa a ⌘7', async () => {
    const m = await abrirAppComo('luz', {});
    expect(m.contenedor.querySelector('button[data-vista="entrenamiento"]')).toBeNull();
    expect(m.contenedor.querySelector('button[data-vista="libreta"]')?.getAttribute('title')).toBe('Libreta · ⌘7');
  });

  it('la entrenadora sí lo tiene, en su lugar de siempre (⌘7)', async () => {
    const m = await abrirAppComo('usuario1', { puedeEntrenar: true });
    expect(m.contenedor.querySelector('button[data-vista="entrenamiento"]')?.getAttribute('title')).toBe('Entrenar bot · ⌘7');
  });
});

/**
 * PRODUCTOS COMO DÉCIMA VISTA (20-ago-2026) — el catálogo de Cerberus, solo
 * lectura. Igual que Routing, sin tecla propia: se entra por el riel.
 */
describe('Productos, el catálogo de Cerberus', () => {
  it('está en el riel, sin ⌘10 que prometer', async () => {
    const m = await abrirApp();
    const boton = m.contenedor.querySelector('button[data-vista="productos"]');

    expect(boton).not.toBeNull();
    expect(boton?.getAttribute('title')).toBe('Productos');
  });

  /**
   * Se verifica que montó el componente REAL y no solo el `h1` de la cabecera:
   * con el server contestando 503 a todo, la vista cae en su cartel de error.
   */
  it('se abre desde el riel y monta la vista de verdad', async () => {
    const m = await abrirApp();

    m.contenedor.querySelector<HTMLButtonElement>('button[data-vista="productos"]')!.click();
    await reposar();
    await reposar();

    expect(vistaActual(m)).toBe('Productos');
    expect(m.contenedor.textContent).toContain('No se pudo leer el catálogo de productos');
  });
});

/**
 * LA VISTA ACTIVA VIAJA EN LA URL (fix/state-location-refresh).
 *
 * Sin esto, un refresh o hard refresh siempre vuelve a Dashboard porque la vista
 * vive en un `useState` que se reinicia al montar. La URL es la fuente de verdad
 * que sobrevive al recargue, sin mezclar estado entre pestañas ni persistir más
 * allá de la sesión.
 */
describe('La vista activa viaja en la URL', () => {
  it('arranca en Mensajes si la URL trae ?vista=bandeja', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=bandeja`);
    const m = await abrirApp();
    expect(vistaActual(m)).toBe('Mensajes');
  });

  it('actualiza la URL al cambiar de vista con el teclado', async () => {
    const m = await abrirApp();
    teclear('4', { meta: true });
    await reposar();
    expect(vistaActual(m)).toBe('Mensajes');
    expect(location.search).toContain('vista=bandeja');
  });

  it('si la URL pide una vista que no tiene, cae a Dashboard', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=correos`);
    const m = await abrirAppComo('luz', { esDeCampana: true });
    expect(vistaActual(m)).toBe('Dashboard');
    expect(location.search).toContain('vista=dashboard');
  });
});
