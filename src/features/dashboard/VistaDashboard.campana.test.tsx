// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import { VistaDashboard } from './VistaDashboard';

/**
 * EL CONMUTADOR DEL DASHBOARD EN EL MÓDULO DE CAMPAÑA (ADR 0063) — y lo que se
 * fija es el CABLEADO, no la regla.
 *
 * 🔴 **El defecto que estaba vivo antes de este test**: `puedeVerNegocio` salía
 * SÓLO de `supervisor`, así que el supervisor de un comando de campaña veía el
 * botón «El negocio», lo apretaba y comía el 403 de `/api/dashboard/negocio` —
 * que es superficie de `ventas`. El candado del server nunca estuvo mal; lo que
 * fallaba es que la pantalla ofrecía una puerta que ya sabía cerrada. Eso no lo
 * puede ver ningún test puro del booleano: hay que mirar qué se dibuja y qué
 * `fetch` sale (ADR 0024).
 *
 * 🔴 **Y tiene las DOS MITADES**, por el mismo motivo que
 * `PanelDerecho.campana.test.tsx`: un test que sólo comprueba que en campaña no
 * aparece «El negocio» pasa en verde si alguien rompe el conmutador entero y no
 * aparece para nadie. Lo que se fija es la DIFERENCIA.
 */

let vista: Montado | null = null;
let pedidos: string[] = [];

/** Lo mínimo que el radar necesita para pintar sin explotar. */
const RADAR_VACIO = {
  chats: [], formularios: [], etapas: {}, etiquetas: {}, porVendedora: [],
  automaticos: null, embudo: {}, cursos: [],
  series: { leads_dia: [], envios_dia: [], ventas_dia: [] },
  // `supervisor: true` a propósito: es el caso que estaba roto. Sin él, «El
  // negocio» no aparecería para nadie y la mitad de ventas pasaría sola.
  supervisor: true,
  soloMisAsignadas: false,
};

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      const u = String(url);
      pedidos.push(u);
      // El radar contesta; el resto falla y react-query lo absorbe. Lo que
      // importa acá es QUÉ se pidió, no qué volvió.
      if (u.includes('/api/dashboard') && !u.includes('/negocio') && !u.includes('/campana')) {
        return Promise.resolve(new Response(JSON.stringify(RADAR_VACIO), {
          status: 200, headers: { 'content-type': 'application/json' },
        }));
      }
      return Promise.reject(new Error('sin server en el test'));
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const props = {
  onAbrir: () => {}, onBuscarPersona: () => {}, onIrAgenda: () => {},
  miVendedora: 'centurion:job.meneses',
};

describe('el conmutador del Dashboard según el módulo', () => {
  it('🔴 en CAMPAÑA ofrece «La campaña» y NO ofrece «El negocio»', async () => {
    vista = montar(<VistaDashboard {...props} esDeCampana />);
    await reposar();

    expect(vista.contenedor.textContent).toContain('La campaña');
    expect(vista.contenedor.textContent).not.toContain('El negocio');
  });

  it('la otra mitad: en VENTAS ofrece «El negocio» y NO ofrece «La campaña»', async () => {
    vista = montar(<VistaDashboard {...props} />);
    await esperarA(
      () => vista!.contenedor.textContent?.includes('El negocio') ?? false,
      'que el conmutador ofrezca «El negocio» a una supervisora de ventas',
    );

    expect(vista.contenedor.textContent).toContain('El negocio');
    expect(vista.contenedor.textContent).not.toContain('La campaña');
  });

  it('🔴 abrir «La campaña» pide SU ruta y nunca la de la Escuela', async () => {
    vista = montar(<VistaDashboard {...props} esDeCampana />);
    await reposar();

    const boton = [...vista.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'La campaña');
    expect(boton, 'el botón de «La campaña» tiene que existir en el módulo de campaña').toBeTruthy();
    boton!.click();
    await esperarA(
      () => pedidos.some((u) => u.includes('/api/dashboard/campana')),
      'que abrir «La campaña» dispare su propia consulta',
    );

    expect(pedidos.some((u) => u.includes('/api/dashboard/campana'))).toBe(true);
    expect(
      pedidos.some((u) => u.includes('/api/dashboard/negocio')),
      'un operador de campaña no puede pedir jamás la lectura de la Escuela',
    ).toBe(false);
  });
});
