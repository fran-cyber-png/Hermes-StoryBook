// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarA, escribir, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { BarraGestion } from './BarraGestion';

/**
 * «DIJO QUE NO» PIDE SU MOTIVO — EL CABLEADO DE LA BARRA (ADR 0107).
 *
 * La regla la hace cumplir el server (`server/src/gestiones/motivosDePerdida.ts`) y la
 * lista tiene su paridad en `lib/motivosDePerdida.paridad.test.ts`. Lo que ninguno de
 * los dos ve es si la barra —el único lugar donde una persona declara `perdido`— pide el
 * motivo y lo MANDA: con la regla escrita y la barra sin el campo, cada «Dijo que no»
 * sería un 400 que la vendedora no entiende.
 *
 * El server se simula con `fetch`: el historial dice la etapa, el POST se captura y todo
 * lo demás contesta 503, como en `App.test.tsx` (cada hijo de la barra cae en su estado de
 * error y lo que queda en pie es lo que se mide).
 *
 * ⚠️ El jsdom de este repo no trae `localStorage`, y `api()` lo lee para el token: sin el
 * stub, la mutación revienta antes del `fetch` (la trampa de `EtiquetasContacto.test.tsx`).
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
  referencia: '2026-09-10T14:00:00.000Z',
  ultimo_at: '2026-09-10T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;
let posteos: Record<string, unknown>[] = [];

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const json = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });

/** El server de mentira: el historial de la conversación y un POST que se captura. */
function servidor(historial: { etapa: string | null; perdida?: { motivo: string | null; detalle: string | null } | null }) {
  posteos = [];
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const ruta = String(url);
      if (ruta.includes('/api/gestiones/de/')) return json({ gestiones: [], perdida: null, ...historial });
      if (ruta.endsWith('/api/gestiones') && init?.method === 'POST') {
        posteos.push(JSON.parse(String(init.body)));
        return json({ ok: true });
      }
      return new Response('{"ok":false,"message":"el test no levanta server"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function boton(texto: string): HTMLButtonElement {
  const b = [...vista!.contenedor.querySelectorAll('button')].find((x) => x.textContent?.trim() === texto);
  expect(b, `no hay un botón «${texto}»`).toBeTruthy();
  return b as HTMLButtonElement;
}

/** Abre el selector de etapa y elige «Dijo que no», que pide confirmación adentro del menú. */
function declararDijoQueNo(): void {
  const selector = vista!.contenedor.querySelector('button[title="Cambiar la etapa (E)"]');
  expect(selector, 'el selector de etapa tiene que existir').not.toBeNull();
  tocar(selector!);
  const item = [...vista!.contenedor.querySelectorAll('[role="menuitem"]')].find((x) => x.textContent?.includes('Dijo que no'));
  expect(item, 'el menú tiene que ofrecer «Dijo que no»').toBeTruthy();
  tocar(item!);
}

const motivosOfrecidos = () =>
  [...vista!.contenedor.querySelectorAll('[aria-label="Por qué dijo que no"] button')].map((b) => b.textContent?.trim());

describe('BarraGestion — «Dijo que no» con su motivo', () => {
  it('🔴 en ventas pide el motivo: «Sí» no se puede tocar hasta elegir uno, y el POST lo lleva con el detalle', async () => {
    servidor({ etapa: 'contactado' });
    vista = montar(<BarraGestion conversacion={CONTACTO} />);
    await reposar();

    declararDijoQueNo();
    expect(motivosOfrecidos()).toEqual(['Precio', 'Horario o fecha', 'Compró en otro lado', 'Ya no le interesa', 'No contesta', 'Otro']);
    expect(boton('Sí, dijo que no').disabled, 'sin motivo no se declara').toBe(true);

    tocar(boton('Precio'));
    const detalle = vista.contenedor.querySelector<HTMLInputElement>('input[aria-label="Detalle (opcional)"]');
    expect(detalle, 'el detalle es un campo de la misma confirmación').not.toBeNull();
    escribir(detalle!, 'le pareció caro');
    expect(boton('Sí, dijo que no').disabled).toBe(false);

    tocar(boton('Sí, dijo que no'));
    await esperarA(() => posteos.length === 1, 'la barra mandó la gestión');
    expect(posteos[0]).toMatchObject({ etapa: 'perdido', motivoPerdida: 'precio', detallePerdida: 'le pareció caro' });
  });

  it('🔴 una conversación ya perdida puede corregir su motivo: la barra deja volver a declarar con otro', async () => {
    servidor({ etapa: 'perdido', perdida: { motivo: 'precio', detalle: null } });
    vista = montar(<BarraGestion conversacion={CONTACTO} />);
    await esperarA(
      () => vista!.contenedor.querySelector('button[title="Cambiar la etapa (E)"]')?.textContent?.includes('Dijo que no') === true,
      'la barra leyó que la conversación ya está perdida',
    );

    declararDijoQueNo();
    tocar(boton('No contesta'));
    tocar(boton('Sí, dijo que no'));
    await esperarA(() => posteos.length === 1, 'la corrección se mandó');
    expect(posteos[0]).toMatchObject({ etapa: 'perdido', motivoPerdida: 'no_contesta' });
  });

  it('en campaña «Dijo que no» sigue siendo Sí/No, sin motivo: esta versión es de ventas', async () => {
    servidor({ etapa: 'contactado' });
    vista = montar(<BarraGestion conversacion={CONTACTO} esDeCampana />);
    await reposar();

    declararDijoQueNo();
    expect(vista.contenedor.querySelector('[aria-label="Por qué dijo que no"]')).toBeNull();
    tocar(boton('Sí'));
    await esperarA(() => posteos.length === 1, 'la barra mandó la gestión');
    expect(posteos[0]).toMatchObject({ etapa: 'perdido' });
    expect(posteos[0]).not.toHaveProperty('motivoPerdida');
  });
});
