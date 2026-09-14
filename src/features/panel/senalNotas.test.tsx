// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * EL ATAJO `N` LLEGA AL PANEL — el CABLEADO, no la regla.
 *
 * 🔴 **Este archivo existe por lo que se rompió al sacar el chip «Notas» de la
 * barra del chat (25-ago-2026).** Esa señal moría en `BarraGestion`, que está
 * siempre montada; ahora tiene que cruzar hasta el pie del timeline, en el
 * panel derecho. `RegistrarEvento.test.tsx` ya fija que `senalAbrir` abre el
 * popover —la REGLA— y habría seguido en verde con el panel sin recibir nada:
 * es exactamente ADR 0024, el defecto no está en la decisión sino en que nadie
 * la llama.
 *
 * Lo que este test NO puede ver, y por eso queda escrito acá: que el shell
 * despliegue el panel contraído antes de señalar (`senalar()` en `App.tsx`).
 * Con el panel contraído este componente ni se monta, así que la tecla no
 * tendría a quién hablarle.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 0,
  referencia: '2026-08-05T14:00:00.000Z',
  ultimo_at: '2026-08-05T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;

beforeEach(() => {
  // Sin server: react-query lo absorbe y el panel se dibuja igual. Lo que se
  // mira acá es el popover, que no depende de ninguna respuesta.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('sin server en el test'))),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

/** El pie del popover de registrar — el mismo testigo que usa su propio test. */
function popoverAbierto(m: Montado): boolean {
  return m.contenedor.textContent?.includes('Queda en el timeline') ?? false;
}

describe('la señal del atajo `N` en el panel derecho', () => {
  it('🔴 al cambiar `senalNotas`, se abre el popover de registrar', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" senalNotas={0} />);
    await reposar();
    expect(popoverAbierto(vista), 'nace cerrado').toBe(false);

    // ⚠️ Tiene que CAMBIAR: la señal es un contador que se compara contra lo ya
    // visto, así que montar con `senalNotas={1}` no abre nada — el estado
    // inicial arranca en el valor de la prop. Es cómo la usan la tecla y ⌘K.
    vista.repintar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" senalNotas={1} />);
    await reposar();
    expect(popoverAbierto(vista), 'la tecla `N` tiene que abrirlo desde el shell').toBe(true);
  });

  it('el botón sigue estando para el mouse, sin ninguna señal', async () => {
    // La otra mitad: un panel que sólo abre por señal habría pasado el caso de
    // arriba con el botón roto o ausente, que es lo que la vendedora toca.
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();

    // #887 — «Registrar actividad», el mismo rótulo en Resumen y en
    // Actividad (antes decía «Registrar algo del contacto» acá abajo): el de
    // Resumen es el que se ve primero, y clickearlo abre el MISMO popover.
    const boton = [...vista.contenedor.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Registrar actividad',
    );
    expect(boton, 'un botón para anotar un hecho, alcanzable con el mouse').toBeTruthy();

    // `tocar()` y no `boton.click()` a secas: el resto del repo dispara así
    // los clics de verdad (envuelto en `act()`), y un DOM nativo afuera de
    // `act()` no tiene ninguna garantía de cuándo React decide procesar la
    // actualización.
    //
    // 🔴 El intermitente de fondo (rojo en el CI de `main` el 9-sep-2026, y de
    // nuevo después de subirle el presupuesto de turnos a `esperarA`) NO era
    // esto: era una carrera real en `RegistrarEvento` (ver su docblock de
    // `useLayoutEffect`), reproducida en local 1 de cada 5-7 corridas con el
    // clic ya envuelto en `act()`. `esperarA` queda igual —esperar al DOM en
    // vez de mirarlo tras un solo `reposar()` sigue siendo lo correcto,
    // aunque el fix de fondo ya no dependa de eso para ser determinístico.
    tocar(boton!);
    await esperarA(() => popoverAbierto(vista!), 'el popover de registrar, abierto por el clic');
    expect(popoverAbierto(vista)).toBe(true);
  });
});
