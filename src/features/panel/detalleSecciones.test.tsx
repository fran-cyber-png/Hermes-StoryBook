// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * #887 — EL CABLEADO DE Resumen · Actividad · Compras («Datos» se fue a la
 * cabecera el 13-sep-2026).
 *
 * No es un test de estilo: prueba que las secciones SIGUEN vivas
 * (montadas) aunque estén ocultas — es la garantía de que el atajo `N`
 * (que abre `RegistrarEvento` desde CUALQUIER pestaña) no se rompe.
 */

const CLIENTE: Conversacion = {
  clave: 'conv:whatsapp:18097961936:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '18097961936',
  persona_nombre: 'Pedro López',
  numero_propio: '51984429504',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 2,
  referencia: '2026-09-03T00:00:00.000Z',
  ultimo_at: '2026-09-03T00:00:00.000Z',
  dias: 0,
  nivel: 5,
};

function responder(url: string): unknown {
  // #1033 — el panel lee UNA consulta de perfil; se arma con las mismas piezas de abajo.
  if (url.includes('/api/contactos/perfil')) {
    return { ficha: responder('/api/contactos/ficha'), lead: null, padron: null, errores: [] };
  }
  if (url.includes('/api/contactos/ficha')) {
    return {
      estado: 'cliente',
      id: 1,
      nombre: 'José Francisco Lopez Fermin',
      codigo: 'CLI-02491',
      dni: '',
      pais: 'República Dominicana',
      correo: 'jose@x.com',
      ventasCount: 1,
      ventas: [{ folio: 'GOB-10291', estado: 'Pagado', fecha: '2025-10-31T00:00:00Z', monto: '2505', moneda: 'DOP', productos: [] }],
      verificado: true,
    };
  }
  if (url.includes('/api/contactos/padron')) return { padron: null };
  if (url.includes('/api/contactos/lead')) return { lead: null };
  if (url.includes('/api/contactos/registro')) return { ficha: null };
  if (url.includes('/api/eventos')) return { eventos: [], correos: [] };
  if (url.includes('/api/senales')) return { senales: {} };
  if (url.includes('/api/agenda')) return { recordatorios: [] };
  if (url.includes('/api/gestiones/intereses')) return { lista: [], derivados: [] };
  if (url.includes('/api/gestiones/etiquetas')) return { etiquetas: {} };
  if (url.includes('/api/categorias')) return { categorias: [], supervisor: false };
  if (url.includes('/api/enlaces')) return { origenes: [] };
  return {};
}

let vista: Montado | null = null;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(responder(String(url))), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

function pestana(v: Montado, etiqueta: string): HTMLButtonElement {
  const boton = [...v.contenedor.querySelectorAll('button[role="tab"]')].find(
    (b) => b.textContent?.trim() === etiqueta,
  ) as HTMLButtonElement | undefined;
  if (!boton) throw new Error(`no hay pestaña «${etiqueta}»`);
  return boton;
}

/** El elemento MÁS ESPECÍFICO que tiene ese texto exacto — nunca el contenedor
 *  entero, que también "contiene" el texto por herencia de `textContent`. */
function oculta(v: Montado, texto: string): boolean {
  const candidatos = [...v.contenedor.querySelectorAll('button, p, h3, span')].filter(
    (n) => n.textContent?.trim() === texto,
  );
  if (candidatos.length === 0) return true; // ni siquiera está en el DOM: cuenta como «no visible»
  return candidatos.every((n) => Boolean(n.closest('.hidden')));
}

describe('Resumen · Actividad · Compras — #887', () => {
  it('arranca en Resumen, con los tiles', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    // «Total de compras0» ya se dibuja ANTES de que la ficha cargue (el tile
    // vacío es honesto desde el primer render) — hay que esperar el DATO, no
    // el rótulo del tile.
    await esperarA(() => (v.contenedor.textContent ?? '').includes('GOB-10291'), 'que cargue la ficha');

    expect(pestana(v, 'Resumen').getAttribute('aria-selected')).toBe('true');
    expect(v.contenedor.textContent).toContain('GOB-10291');
  });

  it('las tres pestañas existen y cambian la sección activa', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes('José Francisco Lopez Fermin'), 'que cargue la ficha');

    for (const etiqueta of ['Resumen', 'Actividad', 'Compras']) {
      pestana(v, etiqueta).click();
      await esperarA(() => pestana(v, etiqueta).getAttribute('aria-selected') === 'true', `que ${etiqueta} quede activa`);
    }
  });

  it('🔴 las secciones NO activas siguen MONTADAS (ocultas con `hidden`, nunca desmontadas)', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes('José Francisco Lopez Fermin'), 'que cargue la ficha');

    // Arranca en Resumen: «Qué pasó» (el encabezado de Actividad) está en el
    // DOM pero oculto — si estuviera desmontado, `senalNotas` no tendría quién
    // lo escuche y el atajo `N` se rompería sin un solo error (ver el commit).
    // (No se usa «Registrar actividad» acá: desde #887 ese rótulo aparece
    // TAMBIÉN en Resumen, así que ya no identifica una sola sección.)
    const texto = v.contenedor.textContent ?? '';
    expect(texto).toContain('Qué pasó');
    expect(oculta(v, 'Qué pasó')).toBe(true);

    pestana(v, 'Actividad').click();
    await esperarA(() => !oculta(v, 'Qué pasó'), 'que Actividad se vuelva visible');
  });
});
