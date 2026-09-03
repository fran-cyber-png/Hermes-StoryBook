// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { CambiarClave } from './CambiarClave';
import { VistaConfiguracionPerfil } from './ConfiguracionPerfil';
import type { Vendedora } from './sesion';

const SIN_PERFIL = {
  fotoUrl: null,
  motivoVincular: null,
  onCerrar: () => {},
  onGuardar: () => {},
  guardando: false,
  errorGuardar: null,
  onElegirFoto: () => {},
  subiendoFoto: false,
  errorFoto: null,
  onQuitarFoto: () => {},
  quitandoFoto: false,
  actividad: { activo: true, transcurrido: '00:00:00' },
} as const;

/**
 * CAMBIAR MI CONTRASEÑA — lo que se fija montando de verdad, porque el defecto
 * que importa acá vive en el CABLEADO (ADR 0024): que el POST salga con lo que
 * se tipeó, que un rechazo del server se LEA, y que a quien no tiene cuenta de
 * Cerberus el botón ni se le ofrezca (ofrecerlo es ofrecerle un 409).
 */

const LUZ: Vendedora = { id: 'luz', nombre: 'Luz' };
const BETTO: Vendedora = { id: 'centurion:betto.romero', nombre: 'Betto' };

let m: Montado | null = null;
const fetchDeVerdad = globalThis.fetch;
/** Lo que salió hacia el server, para poder afirmar sobre el cuerpo. */
let pedidos: { url: string; body: unknown }[] = [];

function servidorQueContesta(status: number, cuerpo: unknown) {
  globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
    pedidos.push({ url: String(entrada), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

afterEach(() => {
  m?.desmontar();
  m = null;
  globalThis.fetch = fetchDeVerdad;
  pedidos = [];
  localStorage.clear();
});

const inputs = () => [...m!.contenedor.querySelectorAll('input[type="password"]')] as HTMLInputElement[];
const alerta = () => m!.contenedor.querySelector('[role="alert"]')?.textContent ?? '';
const enviar = () => tocar(m!.contenedor.querySelector('button[type="submit"]')!);

async function llenarYMandar(actual: string, nueva: string, repetir = nueva) {
  const [a, n, r] = inputs();
  escribir(a, actual);
  escribir(n, nueva);
  escribir(r, repetir);
  enviar();
  await reposar();
}

describe('CambiarClave — el modal', () => {
  it('manda la actual y la nueva al server, y al 200 dice que cambió', async () => {
    servidorQueContesta(200, { ok: true });
    m = montar(<CambiarClave onCerrar={() => {}} />);
    await llenarYMandar('la-de-antes', 'Nueva-Segura-2026');

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toMatch(/\/api\/auth\/cambiar-clave$/);
    expect(pedidos[0].body).toEqual({ claveActual: 'la-de-antes', claveNueva: 'Nueva-Segura-2026' });
    expect(m.contenedor.textContent).toMatch(/tu contraseña cambió/i);
    // No se le dice «vuelve a entrar»: la sesión de Hermes sigue viva.
    expect(m.contenedor.textContent).not.toMatch(/vuelve a entrar/i);
  });

  it('con las dos nuevas distintas NO sale nada al server y se lee por qué', async () => {
    servidorQueContesta(200, { ok: true });
    m = montar(<CambiarClave onCerrar={() => {}} />);
    await llenarYMandar('la-de-antes', 'Nueva-Segura-2026', 'Otra-Cosa-2026');

    expect(pedidos).toHaveLength(0);
    expect(alerta()).toMatch(/no coinciden/);
  });

  it('un rechazo del server (la actual mal) se muestra tal cual y se queda en el formulario', async () => {
    servidorQueContesta(400, { ok: false, type: 'clave_actual_incorrecta', message: 'La contraseña actual no es correcta.' });
    m = montar(<CambiarClave onCerrar={() => {}} />);
    await llenarYMandar('mala', 'Nueva-Segura-2026');

    expect(alerta()).toContain('La contraseña actual no es correcta.');
    expect(inputs()).toHaveLength(3);
    expect(m.contenedor.textContent).not.toMatch(/tu contraseña cambió/i);
  });

  it('lo que dijo Django sobre la nueva llega a la pantalla sin traducir', async () => {
    const dicho = 'Esta contraseña es demasiado común.';
    servidorQueContesta(400, { ok: false, type: 'clave_nueva_rechazada', message: dicho, errores: [dicho] });
    m = montar(<CambiarClave onCerrar={() => {}} />);
    await llenarYMandar('la-de-antes', 'password1234');

    expect(alerta()).toContain(dicho);
  });

  it('Escape cierra el modal', () => {
    let cerrado = 0;
    m = montar(<CambiarClave onCerrar={() => cerrado++} />);
    teclear('Escape');
    expect(cerrado).toBe(1);
  });

  it('con `esCenturion`, no dibuja el formulario ni manda nada al server', () => {
    m = montar(<CambiarClave onCerrar={() => {}} esCenturion />);
    expect(inputs()).toHaveLength(0);
    expect(m.contenedor.querySelector('button[type="submit"]')).toBeFalsy();
    expect(pedidos).toHaveLength(0);
  });
});

const botonCambiar = () =>
  [...m!.contenedor.querySelectorAll('button')].find((b) => /cambiar contraseña/i.test(b.textContent ?? ''));

describe('ConfiguracionPerfil · a quién se le ofrece cambiar la contraseña', () => {
  it('a una vendedora de Cerberus, sí — y abre el FORMULARIO de verdad (no un callback)', async () => {
    // No depende de si Hermes conservó la cookie de Cerberus (`cerberusVivo`
    // ya no es un prop de esta vista): cambiar la clave anda aunque se haya
    // perdido, el server vuelve a entrar con la actual.
    m = montar(<VistaConfiguracionPerfil vendedora={LUZ} {...SIN_PERFIL} />);
    const b = botonCambiar();
    expect(b).toBeTruthy();
    tocar(b!);
    await reposar();
    expect(m.contenedor.querySelector('[aria-label="Cambiar tu contraseña"]')).toBeTruthy();
    expect(inputs()).toHaveLength(3);
  });

  /**
   * 🔴 HASTA EL 25-AGO-2026 EL BOTÓN NI SE OFRECÍA — y con eso, una identidad
   * de Centurión no tenía forma de enterarse de POR QUÉ: un botón que falta se
   * lee como «no tengo esa opción», no como «tengo que ir a otro lado». Ahora
   * se ve igual que para una vendedora, y lo que cambia es lo que abre: un
   * AVISO, no el formulario — pedirle usuario/clave para algo que el server
   * (`routes/auth.ts`, 409 `sin_cuenta_de_cerberus`) va a rechazar SIEMPRE,
   * sea lo que sea que escriba, es puro relleno.
   */
  it('a una identidad de Centurión también se le ofrece — pero abre un AVISO, no el formulario', async () => {
    m = montar(<VistaConfiguracionPerfil vendedora={BETTO} {...SIN_PERFIL} />);
    const b = botonCambiar();
    expect(b).toBeTruthy();
    tocar(b!);
    await reposar();
    expect(m.contenedor.querySelector('[aria-label="Cambiar tu contraseña"]')).toBeTruthy();
    expect(inputs()).toHaveLength(0);
    expect(m.contenedor.textContent).toMatch(/centurión/i);
  });
});
