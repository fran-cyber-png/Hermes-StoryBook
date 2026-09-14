import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * EL BOTÓN "SINCRONIZAR AHORA" DE LA PÁGINA NOVEDADES.
 *
 * Storybook es solo un frontend (Vite) — un botón en el navegador no puede correr
 * `git`/`npm` por su cuenta. Este plugin le agrega al servidor de desarrollo una
 * ruta (`POST /__sync-hermes`) que sí puede: cuando el botón la llama, este código
 * (determinístico, sin IA) corre en Node, en la máquina de quien tiene
 * `npm run storybook` abierto.
 *
 * A propósito NO pushea a GitHub ni borra archivos huérfanos solo: deja el commit
 * local listo y dice qué revisar a mano — el mismo criterio conservador que se usó
 * en la sincronización manual.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOVEDADES_PATH = path.join(REPO_ROOT, 'src/stories/fixtures/novedades.json');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
}

function lineasNoVacias(texto: string): string[] {
  return texto.split('\n').filter((l) => l.trim() !== '');
}

/** Carpeta de feature (primer segmento después de src/features/, o el archivo suelto). */
function agruparPorFeature(rutas: string[]): Record<string, number> {
  const grupos: Record<string, number> = {};
  for (const r of rutas) {
    const m = r.match(/^src\/features\/([^/]+)\//);
    const clave = m ? `src/features/${m[1]}` : r.replace(/\/[^/]+$/, '') || r;
    grupos[clave] = (grupos[clave] ?? 0) + 1;
  }
  return grupos;
}

/**
 * EL id DE UNA HISTORIA A PARTIR DE SU `title` — la misma cuenta que hace
 * Storybook (`sanitize`, en `@storybook/csf`). Es lo que arma el link: con el
 * título solo, la entrada de Novedades diría dónde está el componente pero no
 * llevaría hasta ahí.
 *
 * ⚠️ Los acentos SE QUEDAN: «Moléculas/FilaConversacion» es
 * `moléculas-filaconversacion`, no `moleculas-...`. Sacarlos daría un link roto.
 */
function idDeStory(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * QUÉ COMPONENTE CUBRE CADA HISTORIA — leyendo los `.stories.tsx` del repo.
 *
 * Se lee del disco y no del `index.json` del server a propósito: este código
 * corre DENTRO de ese server, y pedirse a sí mismo por HTTP para saber algo que
 * está en un archivo al lado es un rodeo que además puede colgarse.
 *
 * Es una heurística deliberadamente simple: el `title:` de cada archivo, más los
 * imports que apunten a `src/` fuera de `stories/`. Alcanza para lo que esto
 * tiene que contestar —«¿este componente que cambió tiene story, y dónde?»— y no
 * pretende reemplazar el índice real de Storybook.
 */
function mapaDeStories(): Map<string, { titulo: string; id: string }> {
  const mapa = new Map<string, { titulo: string; id: string }>();
  const archivos = lineasNoVacias(
    git(['ls-files', 'src/stories']),
  ).filter((f) => f.endsWith('.stories.tsx'));

  for (const archivo of archivos) {
    let fuente: string;
    try {
      fuente = readFileSync(path.join(REPO_ROOT, archivo), 'utf-8');
    } catch {
      continue;
    }
    const titulo = fuente.match(/title:\s*'([^']+)'/)?.[1];
    if (!titulo) continue;
    const entrada = { titulo, id: idDeStory(titulo) };

    for (const m of fuente.matchAll(/from '((?:\.\.\/)+[^']+)'/g)) {
      const resuelto = path
        .relative(REPO_ROOT, path.resolve(path.join(REPO_ROOT, path.dirname(archivo)), m[1]))
        .replace(/\\/g, '/');
      if (!resuelto.startsWith('src/') || resuelto.startsWith('src/stories/')) continue;
      // El import viene sin extensión; se prueban las dos que usa el repo.
      for (const ext of ['.tsx', '.ts']) {
        mapa.set(resuelto + ext, entrada);
      }
    }
  }
  return mapa;
}

/** Un archivo tocado por la sincronización, con su lugar en el árbol de Storybook. */
interface CambioDeArchivo {
  archivo: string;
  /** `A` nuevo · `M` modificado · `D` borrado · `R` renombrado. */
  estado: 'A' | 'M' | 'D' | 'R';
  /** De dónde venía, solo en los renombrados. */
  desde?: string;
  /** El `title` de su story, o `null` si ese componente todavía no tiene. */
  story: string | null;
  storyId?: string;
}

interface ResultadoSync {
  cambios: boolean;
  mensaje: string;
  resumen?: string;
  detalle?: string;
  archivos?: string[];
  cambiosDeArchivos?: CambioDeArchivo[];
  commit?: string;
  huerfanosSinBorrar?: string[];
  dependenciasQuitadasDelMonorepo?: string[];
}

/**
 * LO QUE CAMBIÓ, ARCHIVO POR ARCHIVO — con `--name-status` y no con `--stat`.
 *
 * 🔴 `--stat` venía dando basura en la lista: abrevia las rutas largas con «...»
 * y escribe los renombrados como `{viejo.tsx => nuevo.tsx}`, así que en Novedades
 * aparecían entradas como `...eceraColumnaCampana.tsx => CabeceraColumna.tsx}`,
 * que no son una ruta ni sirven para ir a ningún lado. `--name-status` da la ruta
 * entera y además dice QUÉ le pasó a cada una, que es la pregunta de fondo.
 *
 * Los tests quedan afuera: la pregunta que esto contesta es «¿qué componente
 * cambió y dónde lo miro?», y un `.test.tsx` no se mira en Storybook.
 */
function archivosQueCambiaron(): CambioDeArchivo[] {
  const crudo = git([
    'diff',
    '--name-status',
    'HEAD',
    'hermes/main',
    '--',
    'src',
    'index.html',
    'vite.config.ts',
    ':!src/stories',
  ]);
  const stories = mapaDeStories();

  return lineasNoVacias(crudo)
    .map((linea): CambioDeArchivo | null => {
      const partes = linea.split('\t');
      const marca = partes[0];
      const esRename = marca.startsWith('R');
      const archivo = esRename ? partes[2] : partes[1];
      if (!archivo || /\.test\.tsx?$/.test(archivo)) return null;

      const estado = esRename ? 'R' : (marca[0] as 'A' | 'M' | 'D');
      const enStorybook = stories.get(archivo);
      return {
        archivo,
        estado,
        ...(esRename ? { desde: partes[1] } : {}),
        story: enStorybook?.titulo ?? null,
        ...(enStorybook ? { storyId: enStorybook.id } : {}),
      };
    })
    .filter((c): c is CambioDeArchivo => c !== null);
}

function sincronizar(): ResultadoSync {
  // Guarda: si el working tree tiene cambios sin commitear (de una sesión de
  // Claude Code, o de trabajo manual), NO seguir — el commit de abajo hace
  // `git add` acotado a los paths que este script toca, pero si hay archivos
  // sueltos modificados fuera de esos paths, mejor avisar y no tocar nada que
  // esta corrida no entiende.
  const sucio = git(['status', '--porcelain']).trim();
  if (sucio) {
    throw new Error(
      'El working tree tiene cambios sin commitear — commiteá o descartá eso primero, así el commit de la sincronización no mezcla cosas sueltas.',
    );
  }

  git(['fetch', 'hermes', 'main']);

  // `:!src/stories` es obligatorio: hermes/main NUNCA tiene esa carpeta (es propia
  // de este repo), así que sin excluirla el diff da "distinto" PARA SIEMPRE, aunque
  // no haya nada nuevo — el bug real que hizo que el botón commiteara 3 veces
  // seguidas sin tocar una sola línea de código real (ver el commit que arregla esto).
  const diff = git([
    'diff',
    '--stat',
    'HEAD',
    'hermes/main',
    '--',
    'src',
    'index.html',
    'vite.config.ts',
    ':!src/stories',
  ]);
  if (!diff.trim()) {
    return { cambios: false, mensaje: 'hermes/main no tiene cambios nuevos bajo src/, index.html o vite.config.ts.' };
  }

  // ⚠️ ANTES del checkout: después de traer los archivos el diff contra
  // hermes/main queda vacío y no habría nada que listar.
  const cambiosDeArchivos = archivosQueCambiaron();

  // Snapshot de src/ (fuera de stories/) ANTES de tocar nada, para detectar huérfanos.
  const antes = new Set(
    lineasNoVacias(git(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'src'])).filter(
      (f) => !f.startsWith('src/stories/'),
    ),
  );

  git(['checkout', 'hermes/main', '--', 'src', 'index.html', 'vite.config.ts']);

  const despues = new Set(lineasNoVacias(git(['ls-tree', '-r', '--name-only', 'hermes/main', '--', 'src'])));

  // Huérfanos: estaban antes, no están en hermes/main. Sólo se borran si NINGUNA
  // story los referencia — si no se puede confirmar eso acá adentro (grep sobre
  // src/stories), se deja el archivo y se avisa, en vez de arriesgar borrar algo
  // que una historia todavía usa.
  const huerfanos = [...antes].filter((f) => !despues.has(f));
  const huerfanosSinBorrar: string[] = [];
  for (const f of huerfanos) {
    const nombre = path.basename(f).replace(/\.(tsx?|jsx?)$/, '');
    let referenciado = false;
    try {
      execFileSync('grep', ['-rl', nombre, path.join(REPO_ROOT, 'src/stories')], { encoding: 'utf-8' });
      referenciado = true;
    } catch {
      referenciado = false; // grep sin matches sale con status 1
    }
    if (referenciado) {
      huerfanosSinBorrar.push(f);
    } else {
      try {
        git(['rm', '-q', f]);
      } catch {
        huerfanosSinBorrar.push(f); // no se pudo borrar solo (ya no existía, etc.) — no es fatal
      }
    }
  }

  // package.json: solo se reconcilia `dependencies` (nunca name/scripts/devDependencies,
  // que son propios de este repo). Nunca se quita un paquete solo — si el monorepo ya no
  // lo tiene, se avisa para revisar a mano.
  const local = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const upstream = JSON.parse(git(['show', 'hermes/main:package.json']));
  const depsAntes = { ...local.dependencies };
  local.dependencies = { ...local.dependencies, ...upstream.dependencies };
  const dependenciasQuitadasDelMonorepo = Object.keys(depsAntes).filter(
    (k) => !(k in (upstream.dependencies ?? {})),
  );
  const depsCambiaron = JSON.stringify(local.dependencies) !== JSON.stringify(depsAntes);
  if (depsCambiaron) {
    writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(local, null, 2) + '\n');
    execFileSync('npm', ['install'], { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 5 * 60_000 });
  }

  // Cada línea de `git diff --stat` con "|" es un archivo tocado; la última línea
  // ("N files changed, ...") es el resumen y no tiene "|".
  const nArchivos = lineasNoVacias(diff).filter((l) => l.includes('|')).length;
  const grupos = agruparPorFeature(cambiosDeArchivos.map((c) => c.archivo));
  /** Los que cambiaron Y ya tienen story: es lo que hay que ir a revisar. */
  const conStory = cambiosDeArchivos.filter((c) => c.story && c.estado !== 'D');
  const featuresNuevas = [...despues]
    .map((f) => f.match(/^src\/features\/([^/]+)\//)?.[1])
    .filter((f): f is string => Boolean(f) && ![...antes].some((a) => a.startsWith(`src/features/${f}/`)));
  const featuresNuevasUnicas = [...new Set(featuresNuevas)];

  const resumen =
    `Sincronizado a mano desde el botón de Novedades. ${nArchivos} archivo(s) tocados bajo src/.` +
    (featuresNuevasUnicas.length > 0 ? ` Carpeta(s) de feature nueva(s): ${featuresNuevasUnicas.join(', ')}.` : '');
  const detallePartes: string[] = [];
  if (conStory.length > 0) {
    detallePartes.push(
      `${conStory.length} de estos componentes ya tienen story y conviene revisarlas: ${conStory
        .map((c) => c.story)
        .join(', ')}.`,
    );
  }
  if (huerfanosSinBorrar.length > 0) {
    detallePartes.push(
      `${huerfanosSinBorrar.length} archivo(s) ya no están en hermes/main pero una story los referencia — revisar a mano: ${huerfanosSinBorrar.join(', ')}.`,
    );
  }
  if (dependenciasQuitadasDelMonorepo.length > 0) {
    detallePartes.push(
      `El monorepo ya no lista estas dependencias (no se quitaron solas, revisar si siguen usándose): ${dependenciasQuitadasDelMonorepo.join(', ')}.`,
    );
  }

  const novedades = JSON.parse(readFileSync(NOVEDADES_PATH, 'utf-8'));
  novedades.unshift({
    fecha: new Date().toISOString().slice(0, 10),
    resumen,
    detalle: detallePartes.join(' '),
    archivos: Object.keys(grupos).slice(0, 12),
    /** La ruta de cada archivo tocado y dónde vive en Storybook, para seguimiento. */
    cambios: cambiosDeArchivos,
    commit: '',
    tipo: 'sync-manual-boton',
  });
  writeFileSync(NOVEDADES_PATH, JSON.stringify(novedades.slice(0, 30), null, 2) + '\n');

  // Acotado a propósito (nunca `-A`): la guarda de arriba ya asegura que no hay
  // nada suelto, pero este commit no debe poder llevarse puesto algo fuera de lo
  // que el propio sync tocó (src/, index.html, vite.config.ts, package.json,
  // package-lock.json, novedades.json) aunque la guarda fallara.
  const PATHS_DEL_SYNC = ['src', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json'];
  git(['add', '--', ...PATHS_DEL_SYNC]);
  git([
    'commit',
    '-m',
    `Sincroniza con hermes/main desde el botón de Novedades\n\n${resumen}\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`,
  ]);
  const hash = git(['rev-parse', '--short', 'HEAD']).trim();

  const novedadesFinal = JSON.parse(readFileSync(NOVEDADES_PATH, 'utf-8'));
  novedadesFinal[0].commit = hash;
  writeFileSync(NOVEDADES_PATH, JSON.stringify(novedadesFinal, null, 2) + '\n');
  git(['add', '--', 'src/stories/fixtures/novedades.json']);
  git(['commit', '-m', 'Agrega el hash del commit a la entrada de Novedades']);

  return {
    cambios: true,
    mensaje: `Listo — ${nArchivos} archivo(s) sincronizados y commiteados local (${hash}). Falta hacer "git push" cuando quieras.`,
    resumen,
    detalle: detallePartes.join(' '),
    archivos: Object.keys(grupos),
    cambiosDeArchivos,
    commit: hash,
    huerfanosSinBorrar,
    dependenciasQuitadasDelMonorepo,
  };
}

export function syncHermesPlugin(): Plugin {
  return {
    name: 'sync-hermes-plugin',
    configureServer(server) {
      server.middlewares.use('/__sync-hermes', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const resultado = sincronizar();
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(resultado));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}
