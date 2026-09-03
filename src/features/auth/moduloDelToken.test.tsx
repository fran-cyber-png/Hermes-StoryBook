// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { noEsDeCampana } from '../vistas/acceso';
import { CLAVE_ULTIMO_USUARIO, moduloDelToken, quienDiceSer, useSesion } from './sesion';
import { tokenGuardado } from '../../lib/datos/token';

/**
 * 🔴 QUÉ RIEL VE QUIEN ACABA DE ENTRAR — Y POR QUÉ ESTO SE MONTA.
 *
 * ══ EL DEFECTO, medido el 21-ago-2026 ═══════════════════════════════════════
 *
 * `esDeCampana` lo resolvía **sólo** `GET /api/auth/yo`. Las dos puertas del
 * login devuelven `{ id, nombre }` y nada más, y `useSesion.entrar()` no vuelve
 * a pedir `/yo`: un operador de campaña entraba y veía **las cinco vistas de la
 * Escuela** —Contactos, Correos, Libreta, Entrenar bot, Navegador— hasta el
 * próximo reload, comiendo 403 en cada una. Al recargar tampoco era instantáneo:
 * `quienDiceSer` leía el token y tampoco traía el módulo, así que el riel
 * correcto llegaba recién con `/yo`, cuyo **p90 en producción es 41 s**.
 *
 * ══ POR QUÉ MONTADO Y NO PURO ═══════════════════════════════════════════════
 *
 * Porque el defecto vivía en el CABLEADO —quién le pasa qué a quién— y no en una
 * regla que se pueda interrogar sola: `moduloDelToken` podía ser perfecta y el
 * riel seguir mal mientras `entrar()` no la llamara. Es la lección de ADR 0024,
 * la misma por la que existe `sesion.entrar.test.tsx` al lado.
 *
 * Y el aserto final es sobre **`noEsDeCampana`**, la función que de verdad
 * decide el riel (`features/vistas/acceso.ts`), no sobre el booleano suelto: lo
 * que se fija es la consecuencia, no el campo.
 */

/** Un token como los que firma el server (`server/src/auth/sesion.ts`). */
function tokenDelServer(id: string, modulo?: string): string {
  const partes = [id, String(Date.now() + 14 * 24 * 3600 * 1000)];
  if (modulo) partes.push(modulo);
  const cuerpo = btoa(partes.join('|')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${cuerpo}.firma-que-solo-el-server-verifica`;
}

describe('moduloDelToken — el adelanto que ahorra la ida al server', () => {
  it('un token de campaña dice que es de campaña', () => {
    expect(moduloDelToken(tokenDelServer('centurion:betto.romero', 'campana'))).toEqual({
      esDeCampana: true,
    });
  });

  it('un token de ventas dice que NO es de campaña', () => {
    expect(moduloDelToken(tokenDelServer('luz', 'ventas'))).toEqual({ esDeCampana: false });
  });

  it('🔴 un token SIN módulo no afirma nada: la clave no está, no vale `false`', () => {
    // Con `esDeCampana: false` explícito, esto pisaría lo que después traiga
    // `/api/auth/yo` en cualquier merge. Sin la clave, no pisa nada — y el riel
    // se comporta como antes de este frente hasta que el server conteste.
    expect(moduloDelToken(tokenDelServer('luz'))).toEqual({});
    expect('esDeCampana' in moduloDelToken(tokenDelServer('luz'))).toBe(false);
  });

  it('un token ilegible no rompe: no hay adelanto y se espera al server', () => {
    expect(moduloDelToken('esto-no-es-un-token')).toEqual({});
  });

  it('⚠️ un módulo que este front no conoce cae en el riel COMPLETO, no en uno vacío', () => {
    // Esconder de más sería peor que mostrar de más: lo que protege es
    // `modulos/deEsteModulo.ts` en el server, nunca este archivo.
    expect(moduloDelToken(tokenDelServer('x', 'modulo_nuevo'))).toEqual({ esDeCampana: false });
  });

  it('el atajo del arranque lo lee: al recargar, el riel correcto sale en el primer render', () => {
    expect(quienDiceSer(tokenDelServer('centurion:betto.romero', 'campana'))).toEqual({
      id: 'centurion:betto.romero',
      nombre: 'centurion:betto.romero',
      esDeCampana: true,
    });
  });
});

// ── El cableado: qué queda dibujado después de apretar «Entrar» ──────────────

let ultima: ReturnType<typeof useSesion> | null = null;

function Sonda({ usuario }: { usuario: string }) {
  const sesion = useSesion();
  ultima = sesion;
  return (
    <button type="button" onClick={() => void sesion.entrar(usuario, 'la-clave-que-nunca-se-loguea')}>
      entrar
    </button>
  );
}

let montado: Montado | null = null;
const fetchDeVerdad = globalThis.fetch;

/** Entra con un login que devuelve el token pedido y el cuerpo REAL del server. */
async function entrarCon(usuario: string, token: string): Promise<void> {
  localStorage.setItem(CLAVE_ULTIMO_USUARIO, usuario); // así `entrar()` no toca IndexedDB
  globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0]) => {
    const url = String(entrada);
    if (!url.includes('/api/auth/login')) throw new Error(`pedido inesperado: ${url}`);
    // 🔴 El cuerpo es el que devuelve el server DE VERDAD: `{ id, nombre }` y
    // nada más (`auth/loginCascada.ts`). Si el test le agregara `esDeCampana`
    // acá, pasaría con el cableado roto — que es justo el defecto que cierra.
    return new Response(
      JSON.stringify({ ok: true, token, vendedora: { id: usuario, nombre: usuario } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  montado = montar(<Sonda usuario={usuario} />);
  await reposar();
  tocar(montado.contenedor.querySelector('button')!);
  await reposar();
}

beforeEach(() => {
  localStorage.clear();
  ultima = null;
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  globalThis.fetch = fetchDeVerdad;
  localStorage.clear();
});

describe('useSesion — entrar() deja el riel correcto, sin pedir /api/auth/yo', () => {
  it('🔴 quien entra a la campaña NO ve las vistas de la Escuela', async () => {
    const quien = 'centurion:betto.romero';
    await entrarCon(quien, tokenDelServer(quien, 'campana'));
    expect(ultima?.vendedora?.id).toBe(quien);
    expect(noEsDeCampana(ultima?.vendedora)).toBe(false);
  });

  it('y una vendedora de la Escuela las sigue viendo — las dos mitades, o el test pasa roto', async () => {
    await entrarCon('luz', tokenDelServer('luz', 'ventas'));
    expect(noEsDeCampana(ultima?.vendedora)).toBe(true);
  });

  it('⚠️ contra un server viejo que no firma el módulo, se comporta como antes de este frente', async () => {
    const quien = 'centurion:betto.romero';
    await entrarCon(quien, tokenDelServer(quien));
    // Riel de la Escuela hasta que `/api/auth/yo` conteste: es lo de ayer, no
    // una regresión — y no hay frontera que se abra, porque quien niega es el
    // `WHERE` del server.
    expect(noEsDeCampana(ultima?.vendedora)).toBe(true);
  });
});


// ── La re-emisión: que «el token no dice el módulo» dure UN solo arranque ────

/**
 * 🔴 SIN ESTO, EL FRENTE TARDA CATORCE DÍAS EN SURTIR EFECTO.
 *
 * Los tokens ya emitidos no traen el módulo y viven dos semanas: hasta que esa
 * persona volviera a loguearse, cada arranque suyo dibujaría el riel por defecto
 * y esperaría a `/api/auth/yo`, cuyo p90 en producción es de **41 s**. Con la
 * re-emisión, el primer arranque después del deploy se lleva un token que sí lo
 * dice y del siguiente en adelante sale bien en el primer frame.
 *
 * Las dos mitades acá son «pide cuando falta» y **«NO pide cuando ya lo tiene»**:
 * sin la segunda, esto renovaría el token en cada arranque para siempre — mucho
 * más tráfico del que se quiso ahorrar, y sobre la ruta que ya es el cuello.
 */
function Arranque() {
  useSesion();
  return null;
}

/** Un token del server, opcionalmente con módulo. */
function tokenConVida(id: string, modulo?: string): string {
  const partes = [id, String(Date.now() + 14 * 24 * 3600 * 1000)];
  if (modulo) partes.push(modulo);
  const cuerpo = btoa(partes.join('|')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${cuerpo}.firma-que-solo-el-server-verifica`;
}

describe('useSesion — el token viejo se cambia por uno que dice el módulo', () => {
  /** Monta el arranque con `token` guardado y devuelve las URLs pedidas. */
  async function arrancarCon(token: string, devuelve?: string): Promise<string[]> {
    localStorage.setItem('hermes.token', token);
    const urls: string[] = [];
    globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0]) => {
      const url = String(entrada);
      urls.push(url);
      return new Response(
        JSON.stringify({
          ok: true,
          vendedora: { id: 'centurion:betto.romero', nombre: 'Betto' },
          cerberus: false,
          ...(devuelve ? { token: devuelve } : {}),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    montado = montar(<Arranque />);
    await reposar();
    return urls;
  }

  it('🔴 con un token SIN módulo pide la renovación y GUARDA el que vuelve', async () => {
    const conModulo = tokenConVida('centurion:betto.romero', 'campana');
    const urls = await arrancarCon(tokenConVida('centurion:betto.romero'), conModulo);

    expect(urls.some((u) => u.includes('/api/auth/yo?renovar=1'))).toBe(true);
    // Guardarlo es la mitad que importa: sin esto se pide la renovación en cada
    // arranque y el defecto no se cierra nunca.
    expect(tokenGuardado()).toBe(conModulo);
  });

  it('🔴 LA OTRA MITAD: con un token que YA lo dice, no se renueva nada', async () => {
    const yaLoTiene = tokenConVida('centurion:betto.romero', 'campana');
    const urls = await arrancarCon(yaLoTiene);

    expect(urls.some((u) => u.includes('renovar=1'))).toBe(false);
    expect(tokenGuardado(), 'el token no se tocó').toBe(yaLoTiene);
  });

  it('⚠️ contra un server viejo que no devuelve token, se sigue con el que había', async () => {
    const viejo = tokenConVida('centurion:betto.romero');
    await arrancarCon(viejo); // sin `devuelve`
    expect(tokenGuardado()).toBe(viejo);
  });
});

// ── LA OTRA PUERTA: llegar desde Centurión con `#centurion=<jwt>` ────────────

/**
 * 🔴 EL DEFECTO QUE ESTA SUITE NO CUBRÍA, y es el de la puerta que MÁS importa.
 *
 * `entrar()` (arriba) quedó cubierto el 21-ago-2026, pero el canje de Centurión
 * hace lo mismo desde otro lado y se quedó sin el merge: `POST
 * /api/auth/centurion` devuelve `{ id, nombre, puedeEntrenar }` y nada más, así
 * que quien llegaba por el link veía **el riel de la Escuela** hasta el próximo
 * reload.
 *
 * Y es la puerta de campaña por definición: una identidad de Centurión **no
 * existe en Cerberus**, o sea que por el formulario no entra nadie de ese lado.
 * El 100 % de la gente a la que el módulo le cambia el riel llega por acá.
 *
 * Se encontró abriendo dos sesiones a la vez para probar ADR 0083 — que es
 * también el motivo de que este archivo monte en vez de testear puro: la regla
 * estaba bien y nadie la llamaba.
 */
describe('useSesion — llegar desde Centurión deja el riel correcto', () => {
  /** Un JWT con la forma que `tokenCenturionDeLaUrl` acepta (tres partes base64url). */
  const jwtDeCenturion = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma';

  function SondaSso() {
    ultima = useSesion();
    return null;
  }

  /** Llega por el link, y el server contesta con el cuerpo REAL: sin `esDeCampana`. */
  async function llegarDesdeCenturion(quien: string, token: string): Promise<void> {
    window.location.hash = `#centurion=${jwtDeCenturion}`;
    globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0]) => {
      const url = String(entrada);
      if (!url.includes('/api/auth/centurion')) throw new Error(`pedido inesperado: ${url}`);
      // El cuerpo del server de verdad (`routes/auth.ts`). Agregarle `esDeCampana`
      // acá haría pasar el test con el cableado roto — el mismo cuidado que
      // arriba con `/login`.
      return new Response(
        JSON.stringify({ ok: true, token, vendedora: { id: quien, nombre: quien, puedeEntrenar: false } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    montado = montar(<SondaSso />);
    await reposar();
  }

  it('🔴 quien llega de Centurión a la campaña NO ve las vistas de la Escuela', async () => {
    const quien = 'centurion:diego.tapia';
    await llegarDesdeCenturion(quien, tokenDelServer(quien, 'campana'));
    expect(ultima?.vendedora?.id).toBe(quien);
    expect(noEsDeCampana(ultima?.vendedora)).toBe(false);
  });

  it('las dos mitades: una identidad de ventas por esta puerta las sigue viendo', async () => {
    const quien = 'centurion:alguien.de.ventas';
    await llegarDesdeCenturion(quien, tokenDelServer(quien, 'ventas'));
    expect(noEsDeCampana(ultima?.vendedora)).toBe(true);
  });

  it('⚠️ con un server viejo que no firma el módulo, se comporta como antes', async () => {
    const quien = 'centurion:diego.tapia';
    await llegarDesdeCenturion(quien, tokenDelServer(quien));
    expect(noEsDeCampana(ultima?.vendedora)).toBe(true);
  });
});
