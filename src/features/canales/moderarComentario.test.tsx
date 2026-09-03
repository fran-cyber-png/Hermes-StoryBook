// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import AccionesDelComentario from './AccionesDelComentario';

/**
 * OCULTAR Y BORRAR UN COMENTARIO — el CABLEADO, no la regla.
 *
 * La regla (qué se puede hacer con qué estado) vive en
 * `server/src/moderacion/accionDeModeracion.ts` y tiene sus propios tests. Éste
 * cubre lo que aquéllos **no pueden ver**: que la pantalla llame a la regla, que
 * apague el botón cuando corresponde y que mande la acción correcta.
 *
 * Es la lección de ADR 0024 y de ADR 0068, escrita dos veces en este repo: el
 * defecto casi nunca es que la regla esté mal, es que nadie la llama.
 *
 * 🔴 **Y el caso que más importa es el de borrar**: las tres acciones comparten
 * la misma ruta y sólo se distinguen por el cuerpo. Un `if` mal escrito manda a
 * borrar cuando alguien quiso ocultar, y eso no se deshace desde Hermes.
 *
 * ⚠️ **Apunta a `AccionesDelComentario` desde el rediseño (fase 7).** Antes
 * apuntaba a `AccionesDeModeracion`, que se fusionó con `QuePuedoHacer` en las
 * cuatro cards — y durante un rato este archivo siguió **en verde sobre un
 * componente que ya no dibujaba nadie**, que es la misma trampa que su propio
 * docblock describe. Un test de cableado que no apunta a lo que se renderiza no
 * es un test de cableado.
 */

const ID = 4242;

let vista: Montado;
let pedidos: { url: string; cuerpo: unknown }[];

function montarCon(estado: Record<string, boolean>) {
  vista = montar(
    <AccionesDelComentario
      interactionId={ID}
      estado={estado}
      cargando={false}
      cap={{ puedePrivado: true, motivo: null }}
      onEscribirPublico={() => {}}
      onEscribirPrivado={() => {}}
    />,
  );
}

const botonQueDice = (texto: RegExp): HTMLButtonElement | undefined =>
  [...vista.contenedor.querySelectorAll('button')].find((b) => texto.test(b.textContent ?? ''));

async function clic(texto: RegExp) {
  const boton = botonQueDice(texto);
  expect(boton, `no encontré el botón ${texto}`).toBeTruthy();
  tocar(boton!);
  await reposar();
}

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url: String(url), cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ ok: true, mensaje: 'Oculto.' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vi.unstubAllGlobals();
});

test('con can_hide=true el botón de ocultar está habilitado', () => {
  montarCon({ can_hide: true, is_hidden: false, can_remove: true });
  expect(botonQueDice(/Ocultar comentario/)?.disabled).toBe(false);
});

test('🔴 con can_hide=false el botón queda APAGADO y se dice por qué', () => {
  // Medido contra producción el 25-ago-2026: de cuatro comentarios reales, dos
  // daban false. Un botón siempre habilitado falla la mitad de las veces, y el
  // error de Meta no explica cuál de los dos casos es.
  montarCon({ can_hide: false, is_hidden: false, can_remove: true });
  expect(botonQueDice(/Ocultar comentario/)?.disabled).toBe(true);
  expect(vista.contenedor.textContent).toMatch(/Facebook no deja ocultar este comentario/);
});

test('lo que ya está oculto ofrece volver a mostrarlo', () => {
  montarCon({ can_hide: false, is_hidden: true, can_remove: true });
  expect(botonQueDice(/Volver a mostrarlo/)?.disabled).toBe(false);
  // Y NO dice «Facebook no deja ocultarlo»: Meta manda can_hide=false para lo
  // que YA está oculto, y ésa sería la explicación equivocada del hecho correcto.
  expect(vista.contenedor.textContent).not.toMatch(/no deja ocultar/);
});

test('el clic en ocultar pregunta, y al confirmar llega con la acción correcta', async () => {
  montarCon({ can_hide: true, is_hidden: false, can_remove: true });
  await clic(/Ocultar comentario/);
  expect(pedidos, 'la card sólo abre el modal').toHaveLength(0);

  // El modal explica que ocultar NO es borrar: quien lo escribió lo sigue viendo.
  expect(vista.contenedor.textContent).toMatch(/¿Ocultar comentario\?/);
  await clic(/^Ocultar comentario$/);

  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].url).toContain(`/api/comentario/${ID}/moderar`);
  expect(pedidos[0].cuerpo).toEqual({ accion: 'ocultar' });
});

test('volver a mostrar manda «mostrar», no «ocultar»', async () => {
  montarCon({ can_hide: false, is_hidden: true, can_remove: true });
  await clic(/Volver a mostrarlo/);
  expect(pedidos[0]?.cuerpo).toEqual({ accion: 'mostrar' });
});

/**
 * 🔴 BORRAR PIDE CONFIRMACIÓN, Y EN OTRO LUGAR DE LA PANTALLA.
 *
 * Antes la card se transformaba en «¿Seguro? Eliminar», así que el segundo clic
 * caía en el MISMO punto que el primero y un doble clic apurado borraba sin que
 * nadie leyera nada. El modal (fase 10) mueve la confirmación lejos del gesto
 * que la disparó — por eso este test comprueba que el primer clic no manda nada
 * **y** que el texto del modal dice qué va a pasar.
 */
test('🔴 BORRAR PIDE CONFIRMACIÓN: el primer clic no manda nada', async () => {
  montarCon({ can_hide: true, is_hidden: false, can_remove: true });

  await clic(/Eliminar comentario/);
  expect(pedidos, 'el primer clic sólo pregunta').toHaveLength(0);
  expect(vista.contenedor.textContent).toMatch(/¿Eliminar comentario\?/);
  expect(vista.contenedor.textContent).toMatch(/No se puede deshacer/);

  await clic(/^Eliminar$/);
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].cuerpo).toEqual({ accion: 'eliminar' });
});

/**
 * 🔴 CANCELAR NO MANDA NADA. Es la mitad que un test de «confirma y manda» deja
 * pasar: un modal cuyo «Cancelar» ejecuta igual se ve idéntico hasta que borra
 * algo.
 */
test('🔴 cancelar en el modal no manda nada', async () => {
  montarCon({ can_hide: true, is_hidden: false, can_remove: true });
  await clic(/Eliminar comentario/);
  await clic(/^Cancelar$/);
  expect(pedidos).toHaveLength(0);
  expect(vista.contenedor.textContent).not.toMatch(/¿Eliminar comentario\?/);
});

/** Volver a mostrar es deshacer, no un riesgo: no pasa por el modal. */
test('volver a mostrarlo NO pide confirmación', async () => {
  montarCon({ can_hide: false, is_hidden: true, can_remove: true });
  await clic(/Volver a mostrarlo/);
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].cuerpo).toEqual({ accion: 'mostrar' });
});

test('con can_remove=false no se puede borrar, y se dice', () => {
  montarCon({ can_hide: true, is_hidden: false, can_remove: false });
  expect(botonQueDice(/Eliminar comentario/)?.disabled).toBe(true);
  expect(vista.contenedor.textContent).toMatch(/no deja borrar/);
});

test('🔴 mientras se pregunta a Meta, las destructivas están APAGADAS', () => {
  /**
   * La versión vertical que esto reemplaza no dibujaba ningún botón hasta saber
   * la respuesta. Las cards se dibujan siempre (fase 7: «se ve pero apagada»),
   * así que el candado se mudó al `disabled` — y esta prueba es la que lo obliga:
   * sin ella, en el segundo que tarda la consulta se puede borrar un comentario
   * que Meta no dejaba borrar, y eso no se deshace desde Hermes.
   */
  vista = montar(
    <AccionesDelComentario
      interactionId={ID}
      estado={{}}
      cargando
      cap={null}
      onEscribirPublico={() => {}}
      onEscribirPrivado={() => {}}
    />,
  );
  expect(botonQueDice(/Ocultar comentario/)?.disabled).toBe(true);
  expect(botonQueDice(/Eliminar comentario/)?.disabled).toBe(true);
  // Y se ven igual: esconderlas dejaría a la vendedora sin saber que existen.
  expect(vista.contenedor.textContent).toMatch(/Ocultar comentario/);
});

/**
 * 🔴 EL ESCAPE ES DEL MODAL, NO DE LOS DOS.
 *
 * `useEscape` registra en CAPTURA sobre `window`, y `stopPropagation()` no frena
 * a un hermano registrado en el mismo nodo. Con el modal abierto, un Escape
 * cerraba el modal **y también la conversación entera**, dejando a la vendedora
 * en la lista sin saber por qué. Lo encontró apretando la tecla en la app.
 *
 * Este test fija el AVISO, que es la mitad que el panel necesita para apagar su
 * propio Escape (`useEscape(onCerrar, !modalDeModeracion)`).
 */
test('🔴 avisa cuando su modal se abre y cuando se cierra', async () => {
  const avisos: boolean[] = [];
  vista = montar(
    <AccionesDelComentario
      interactionId={ID}
      estado={{ can_hide: true, is_hidden: false, can_remove: true }}
      cargando={false}
      cap={{ puedePrivado: true, motivo: null }}
      onEscribirPublico={() => {}}
      onEscribirPrivado={() => {}}
      onModal={(abierto) => avisos.push(abierto)}
    />,
  );
  await reposar();
  expect(avisos.at(-1), 'arranca cerrado').toBe(false);

  await clic(/Eliminar comentario/);
  expect(avisos.at(-1), 'se abrió: el Escape pasa a ser del modal').toBe(true);

  await clic(/^Cancelar$/);
  expect(avisos.at(-1), 'se cerró: el Escape vuelve al panel').toBe(false);
});

/**
 * LOS DOS AVISOS DE LA VENTANA DE 7 DÍAS.
 *
 * 🔴 **Existe porque uno de los dos se perdió en el rediseño y nadie se enteró.**
 * `QuePuedoHacer.tsx` —el componente que las cuatro cards reemplazan— dibujaba
 * el bloque de «la ventana se cerró» como un aviso propio; al fusionarlo, ese
 * texto quedó colapsado adentro del `detalle` de la card apagada, y en la
 * pantalla eso se lee como que el aviso ya no está. No falló ningún test: la
 * fase 7 no tenía ninguno que mirara este bloque.
 *
 * ⚠️ **Lo que se fija es CUÁNDO aparece cada uno, no cómo se ve.** Son dos
 * mensajes distintos porque contestan preguntas distintas —«apurate» y «ya no se
 * puede»— y el error caro es mostrar el equivocado: decirle «te queda 1 día» a
 * quien ya no puede escribir manda a redactar un privado que Meta no entrega.
 */
function montarConCap(cap: {
  puedePrivado: boolean;
  motivo: 'ventana-cerrada' | 'privacidad' | 'instagram' | 'error' | null;
  dias?: number;
}) {
  vista = montar(
    <AccionesDelComentario
      interactionId={ID}
      estado={{ can_hide: true, is_hidden: false, can_remove: true }}
      cargando={false}
      cap={cap}
      onEscribirPublico={() => {}}
      onEscribirPrivado={() => {}}
    />,
  );
}

const texto = () => vista.contenedor.textContent ?? '';

test('🔴 con la ventana cerrada dice que se cerró, y no una cuenta regresiva', async () => {
  montarConCap({ puedePrivado: false, motivo: 'ventana-cerrada', dias: 9 });
  await reposar();

  expect(texto(), 'el aviso de ventana cerrada no está').toMatch(/La ventana se cerró/);
  expect(texto(), 'una cuenta regresiva acá manda a redactar lo que Meta no entrega').not.toMatch(
    /Te queda/,
  );
});

test('a 1 día del cierre cuenta los días, y no dice que se cerró', async () => {
  montarConCap({ puedePrivado: true, motivo: null, dias: 6 });
  await reposar();

  expect(texto()).toMatch(/Te queda 1 día para poder escribirle en privado/);
  expect(texto(), 'todavía se puede: no se anuncia el cierre').not.toMatch(/La ventana se cerró/);
});

test('recién comentado no dibuja ningún aviso de tiempo', async () => {
  montarConCap({ puedePrivado: true, motivo: null, dias: 0 });
  await reposar();

  expect(texto(), 'avisar a los 7 días de plazo es ruido').not.toMatch(/Te quedan?/);
  expect(texto()).not.toMatch(/La ventana se cerró/);
});

/**
 * ⚠️ **`privacidad` NO es la ventana cerrada.** Los dos apagan el privado, pero
 * el plazo no tiene nada que ver: esta persona no acepta mensajes de páginas y
 * responder más rápido no lo habría cambiado. Prometerle a la vendedora que
 * apurarse servía es la mentira que este test evita.
 */
test('🔴 el privado apagado por privacidad no dice que se cerró la ventana', async () => {
  montarConCap({ puedePrivado: false, motivo: 'privacidad', dias: 1 });
  await reposar();

  expect(texto()).not.toMatch(/La ventana se cerró/);
  expect(texto()).toMatch(/no acepta mensajes de páginas/);
});

/**
 * 🔴 EL AVISO DE PRIVACIDAD ES UN TERCER MENSAJE, NO UNA VARIANTE DEL DE LA VENTANA.
 *
 * Los dos apagan la caja privada y por eso es tentador contarlos con el mismo
 * texto. No son lo mismo: la ventana vencida es NUESTRO retraso —responder antes
 * lo evitaba— y esto es una decisión de la otra persona en su propio teléfono.
 * Decirle a la vendedora que se apure por algo que no dependía de ella le enseña
 * a desconfiar del aviso que sí importa.
 */
test('🔴 privacidad avisa que no dependía de responder más rápido', async () => {
  montarConCap({ puedePrivado: false, motivo: 'privacidad', dias: 1 });
  await reposar();

  expect(texto(), 'el aviso de privacidad no está').toMatch(/No se le puede escribir en privado/);
  expect(texto()).toMatch(/responder más rápido no lo habría cambiado/);
  expect(texto(), 'no es un plazo vencido').not.toMatch(/La ventana se cerró/);
  expect(texto(), 'no corresponde apurar a nadie').not.toMatch(/Te queda/);
});

/**
 * ⚠️ Con el privado ABIERTO no se dibuja ninguno de los tres. Parece obvio y es
 * el caso que un `motivo == null` mal comparado rompe: `null` cae en el `default`
 * de `porQueNoPuedePrivado` y ahí hay una frase — pero el aviso pide además
 * `!puedePrivado`, y ésa es la mitad que lo evita.
 */
test('con el privado abierto no se anuncia ningún impedimento', async () => {
  montarConCap({ puedePrivado: true, motivo: null, dias: 1 });
  await reposar();

  expect(texto()).not.toMatch(/No se le puede escribir en privado/);
  expect(texto()).not.toMatch(/La ventana se cerró/);
});
