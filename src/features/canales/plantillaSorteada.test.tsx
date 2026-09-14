// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';
import { olvidarUltimaPlantilla, PLANTILLAS_PUBLICAS_POR_CLIENTE } from '../../dominio/plantillaPublica';

/**
 * LA SUGERENCIA PÚBLICA SORTEADA — el CABLEADO, no la regla.
 *
 * La regla (cuál sale, y que no repita la anterior) vive en
 * `src/dominio/plantillaPublica.ts` y tiene sus propios tests. Éste cubre lo que
 * aquéllos **no pueden ver**: que el panel la LLAME, y que la llame con la
 * anterior.
 *
 * 🔴 **Es exactamente el hueco de ADR 0024 y ADR 0068.** Una versión del panel
 * que importara la regla y prefilleara igual la primera frase dejaría los tests
 * de la regla en verde y la pantalla repitiendo la misma frase — que es el
 * defecto que este cambio vino a arreglar. El defecto casi nunca es que la regla
 * esté mal: es que nadie la llama.
 *
 * ⚠️ **El caso de dos comentarios seguidos no es azaroso y por eso se puede
 * afirmar**: la regla descarta la anterior, así que «distintas» es una promesa
 * dura, no una probabilidad. Si alguien saca el `anterior` del llamado, este
 * test se pone rojo una de cada TRES corridas — y ese parpadeo ES la señal.
 *
 * ⚠️ **Corre como la campaña de Betto** (11-sep-2026). Desde que cada cliente ve
 * sólo sus textos, las frases sorteadas son las de Betto, y `/puede-privado`
 * tiene que decir de quién es la Página. Que ningún otro cliente las vea lo fija
 * `plantillaPorCliente.test.tsx`.
 */

const DE_BETTO = PLANTILLAS_PUBLICAS_POR_CLIENTE.betto;

const COMENTARIO: Interaccion = {
  id: 1,
  canal: 'facebook',
  tipo: 'comentario',
  persona_nombre: null,
  texto: 'Excelente propuesta',
  contexto_texto: null,
  occurred_at: new Date(1_700_000_000_000).toISOString(),
  status: 'pendiente',
  pide_info: false,
  ventana_abierta: true,
  dias: 1,
};

/**
 * La `Conversacion` que ahora exige `CabeceraDeChat`/`BarraGestion` (08-sep-2026:
 * la barra se mudó adentro de la cabecera de `ResponderPanel`, ver su docblock).
 * Este test no la ejercita — sólo hace falta para que el panel monte.
 */
const CONVERSACION: Conversacion = {
  clave: 'int:1',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: null,
  numero_propio: null,
  texto: 'Excelente propuesta',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: COMENTARIO.occurred_at,
  ultimo_at: COMENTARIO.occurred_at,
  dias: 1,
  nivel: 2,
};

let vista: Montado;
/** Lo que contesta `/puede-privado`. Lo cambia el test de la rama sin privado. */
let puedePrivado = true;
/** De quién es la Página, también desde `/puede-privado`. */
let pagina: { modulo: 'ventas' | 'campana'; cliente: string | null } = { modulo: 'campana', cliente: 'betto' };

const panel = (id: number) => (
  <ResponderPanel
    interaccion={{ ...COMENTARIO, id }}
    conversacion={{ ...CONVERSACION, clave: `int:${id}` }}
    onCerrar={() => {}}
    onRespondido={() => {}}
  />
);

/** La primera caja es la pública; la segunda, la privada. */
const cajaPublica = () => vista.contenedor.querySelectorAll('textarea')[0] as HTMLTextAreaElement;

async function sugerenciaPara(id: number): Promise<string> {
  if (id === COMENTARIO.id) vista = montar(panel(id));
  else vista.repintar(panel(id));
  await reposar();
  return cajaPublica().value;
}

beforeEach(() => {
  puedePrivado = true;
  pagina = { modulo: 'campana', cliente: 'betto' };
  // El «anterior» vive en el módulo, así que se comparte entre casos: sin este
  // olvido, cada test arrastraría lo que sorteó el anterior.
  olvidarUltimaPlantilla();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      const cuerpo = u.includes('/puede-privado')
        ? { puede: puedePrivado, motivo: puedePrivado ? null : 'ventana-cerrada', dias: 3, ...pagina }
        : u.includes('/contexto')
          ? { post: null, adjunto: null, estado: {} }
          : { permalink: null };
      return new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vi.unstubAllGlobals();
  // ⚠️ `unstubAllGlobals` NO deshace un `vi.spyOn`: sin esto, el `Math.random`
  // clavado del test de reapertura se filtraría a los que corren después y los
  // dejaría sorteando siempre lo mismo, en verde y por el motivo equivocado.
  vi.restoreAllMocks();
});

test('la sugerencia pública sale de la lista sorteada', async () => {
  expect(DE_BETTO).toContain(await sugerenciaPara(1));
});

test('🔴 dos comentarios seguidos no reciben la misma frase', async () => {
  const primera = await sugerenciaPara(1);
  const segunda = await sugerenciaPara(2);
  expect(segunda).not.toBe(primera);
  expect(DE_BETTO).toContain(segunda);
});

/**
 * ⚠️ **EL LARGO DE LA CORRIDA ESTÁ CALCULADO, NO ELEGIDO A OJO.**
 *
 * Al bajar la lista de cuatro frases a tres, este test se volvió más frágil sin
 * que nada lo avisara: descartada la anterior quedan **dos** candidatas, así que
 * para que salgan sólo dos frases distintas alcanza con que N−1 monedas caigan
 * del mismo lado. Con las 12 aperturas que tenía, eso es 1 en 2.048 — un
 * parpadeo cada tantas corridas de CI, del tipo que después nadie sabe explicar.
 * Con 18 queda en 1 en 131.072.
 *
 * No se exige que salgan las tres SIEMPRE por eso mismo: «casi seguro» no es una
 * afirmación que un test pueda hacer sin parpadear alguna vez. Lo que prueba es
 * lo que importa — que hay variedad de verdad y no dos frases alternándose.
 */
test('a lo largo de una cola salen las tres frases', async () => {
  const salieron = new Set<string>();
  for (let id = 1; id <= 18; id++) salieron.add(await sugerenciaPara(id));
  expect(salieron.size).toBeGreaterThanOrEqual(3);
});

/**
 * 🔴 EL CASO QUE SE ESCAPÓ, Y QUE SÓLO APARECIÓ EN LA APP VIVA.
 *
 * Cerrar el comentario **desmonta** el panel (`ConversacionActiva` elige qué
 * dibujar con un `if`), así que la primera versión —que recordaba la anterior en
 * un `useRef`— la olvidaba en cada apertura y volvía a sortear uniforme. Abrir
 * cinco veces el mismo comentario sacó la misma frase las tres primeras.
 *
 * ⚠️ **Los otros tests de este archivo no podían verlo**: usan `repintar`, que
 * mantiene el componente montado. Reabrir NO es repintar, y la diferencia entre
 * las dos cosas era justo el defecto.
 *
 * 🔴 **Y `Math.random` va CLAVADO, porque sin eso este test no era un candado.**
 * Con el azar de verdad, cuatro aperturas sin repetición consecutiva salen el
 * 30 % de las veces por pura suerte (era 42 % cuando la lista tenía cuatro
 * frases) — o sea que la versión rota lo pasaba una de cada tres corridas, que
 * es peor que inútil: verde casi siempre y rojo sin motivo aparente de vez en
 * cuando. Comprobado poniéndolo en rojo a propósito: con el
 * azar suelto el sabotaje pasaba; clavado, se cae siempre. Fijo en 0 significa
 * «la primera candidata», y ahí las dos versiones se separan sin ambigüedad: la
 * buena alterna dos frases, la rota devuelve siempre la misma.
 */
test('🔴 cerrar y reabrir tampoco repite: la memoria sobrevive al desmontaje', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const salieron: string[] = [];
  for (let i = 0; i < 4; i++) {
    vista = montar(panel(1));
    await reposar();
    salieron.push(cajaPublica().value);
    vista.desmontar();
  }
  for (let i = 1; i < salieron.length; i++) {
    expect(salieron[i], `la apertura ${i + 1} repitió la anterior`).not.toBe(salieron[i - 1]);
  }
});

/**
 * ⚠️ **La Escuela conserva su texto de siempre**, el que invita a escribir por
 * privado. Hasta el 11-sep-2026 era además el texto que el server publicaba
 * cuando el privado fallaba, y por eso salió 13 veces en la Página de Américo sin
 * que nadie lo viera. Esa sustitución ya no existe: ahora es sólo la sugerencia de
 * la Escuela.
 */
test('🔴 la Escuela sin privado posible sigue viendo su texto, que invita a escribir', async () => {
  pagina = { modulo: 'ventas', cliente: null };
  puedePrivado = false;
  const sugerida = await sugerenciaPara(1);
  expect(sugerida).toMatch(/Escríbenos por mensaje privado/);
  expect(DE_BETTO).not.toContain(sugerida);
});
