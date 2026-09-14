// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { HojaContacto } from './HojaContacto';

/**
 * EL CABLEADO DEL ESCAPE DE LA HOJA — lo único que un test puro no puede ver.
 *
 * `useEscape` registra en CAPTURA sobre `window` y hace `stopPropagation()`. La
 * decisión de qué cierra está testeada hasta el hueso en `escapeDePopover.ts`, y
 * aun así la app perdió el Escape global una vez (ADR 0024): el defecto estaba en
 * QUIÉN registra el listener y cuándo, que solo se ve montando de verdad.
 *
 * Acá se fija lo que esa lección dejó: con algo encima que ya escucha, esta hoja
 * **no puede quedarse con la tecla**.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51986394450',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51986394450',
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

function fetchPorDefecto(): typeof fetch {
  return vi.fn((input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/reparto/rueda')) {
      return Promise.resolve(
        new Response(JSON.stringify({
          linea: '51986394450',
          rueda: [],
          destinos: ['ana', 'luz'],
          // El diccionario que resuelve el username al NOMBRE de la persona.
          nombres: { ana: 'Ana', luz: 'Luz' },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (url.includes('/api/whatsapp/lineas')) {
      return Promise.resolve(
        new Response(JSON.stringify({ lineas: [{ numero: '51986394450', etiqueta: 'Ventas', estado: 'conectado' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    // El panel pregunta por la ficha de Cerberus, el lead-form, las señales y los
    // intereses. Acá no se está probando ninguno: que fallen todos es el estado
    // más parecido a la app sin server, y react-query los absorbe (retry: false).
    return Promise.reject(new Error('sin server en el test'));
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchPorDefecto());
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

describe('HojaContacto — el Escape', () => {
  it('cierra la hoja', () => {
    const cerrar = vi.fn();
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={cerrar} />);

    teclear('Escape');

    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('CORTA la propagación al cerrar: el shell no tiene que enterarse', () => {
    // Sin el corte, el mismo Escape que cierra la hoja seguiría hasta el listener
    // de `App.tsx` y se llevaría puesta la conversación abierta detrás.
    const delShell = vi.fn();
    window.addEventListener('keydown', delShell);
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={vi.fn()} />);

    teclear('Escape');

    expect(delShell).not.toHaveBeenCalled();
    window.removeEventListener('keydown', delShell);
  });

  it('con `escapeActivo={false}` no cierra Y DEJA PASAR la tecla', () => {
    // El caso real: un modal de compuerta del Pipeline encima. Ese modal maneja
    // su propio Escape; si esta hoja igual se quedara con la tecla, una sola
    // pulsación cerraría las dos cosas — y la vendedora perdería de vista a quién
    // le estaba por registrar la venta.
    const cerrar = vi.fn();
    const delShell = vi.fn();
    window.addEventListener('keydown', delShell);
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={cerrar} escapeActivo={false} />);

    teclear('Escape');

    expect(cerrar).not.toHaveBeenCalled();
    expect(delShell).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', delShell);
  });

  it('al desmontarse suelta el listener: la app recupera su Escape', () => {
    // La otra mitad de la lección de ADR 0024. Un listener que sobrevive al
    // desmontaje apaga el Escape de TODA la app, y en silencio.
    const delShell = vi.fn();
    const vistaLocal = montar(<HojaContacto conversacion={CONTACTO} onCerrar={vi.fn()} />);
    vistaLocal.desmontar();

    window.addEventListener('keydown', delShell);
    teclear('Escape');

    expect(delShell).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', delShell);
  });

  it('el botón de cerrar hace lo mismo que la tecla', () => {
    const cerrar = vi.fn();
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={cerrar} />);

    const boton = vista.contenedor.querySelector('button[aria-label="Cerrar la ficha"]');
    expect(boton).not.toBeNull();
    tocar(boton!);

    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('muestra el selector de asignación cuando la línea tiene reparto', async () => {
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={vi.fn()} miVendedora="ana" />);
    // ⚠️ `esperarA` y no un `reposar()` suelto: el chip aparece recién cuando
    // resuelve `useRueda`, o sea después de un fetch, su escritura en el caché y
    // el re-render. Un solo tick alcanzaba **de casualidad** — lo sostenía un
    // `setState` de más que `PasarConversacion` hacía al montar (un `reset()`
    // sobre una mutación que ya estaba `idle`). Al sacar ese render de más por
    // rendimiento, este test empezó a fallar 1 de cada 3 corridas y tumbó `main`.
    // Esperar la CONDICIÓN no depende de cuántos renders haya en el camino.
    await esperarA(
      () => vista!.contenedor.querySelector('button[title*="asignar"]') !== null,
      'el chip de asignar de la hoja',
    );

    const boton = vista.contenedor.querySelector('button[title*="asignar"]');
    expect(boton).not.toBeNull();
    // ⚠️ Dice «Asignar», no «Sin asignar» (ADR 0083): el estado vacío nombra la
    // ACCIÓN que falta, no la ausencia. Lo que este test fija sigue siendo lo
    // mismo — que el control aparece cuando la línea tiene reparto y **con
    // palabra**, nunca mudo.
    expect(boton?.textContent).toContain('Asignar');
  });

  /**
   * 🔴 DOS DEFECTOS DEL MISMO CONTROL, y los dos le pegaban al SUPERVISOR, que
   * es quien lo usa a cada rato (ADR 0083).
   *
   * Este chip resolvía su rótulo con `marcaDeDueno`, que es la regla de la FILA
   * DE LA COLA. Allá es correcta; acá hacía dos cosas al revés:
   *
   *  1. **Devuelve `null` para lo propio** («lo propio no se rotula», porque en
   *     1.900 filas serían 1.900 píldoras iguales) → una conversación asignada a
   *     vos misma dibujaba **«Asignar»**, o sea el estado vacío sobre algo que sí
   *     tiene dueña.
   *  2. **Abrevia con `nombreCorto`** → el chip decía «Ventas11» y su propio
   *     menú, tres píxeles abajo, «Tracy». Dos nombres para la misma persona
   *     adentro del mismo control.
   *
   * Se fijan los dos juntos porque comparten causa: leer el dueño de la fila con
   * la regla de otra pantalla.
   */
  it('🔴 con dueña dice su NOMBRE, y si es tuya dice «Tú» — nunca «Asignar»', async () => {
    const deOtra = { ...CONTACTO, asignada_a: 'luz' };
    vista = montar(<HojaContacto conversacion={deOtra} onCerrar={vi.fn()} miVendedora="ana" />);
    await esperarA(
      () => vista!.contenedor.querySelector('button[title*="signada"]') !== null,
      'el chip con la dueña de la conversación',
    );
    let boton = vista.contenedor.querySelector('button[title*="signada"]');
    expect(boton, 'con dueña el chip tiene que existir').not.toBeNull();
    expect(boton?.textContent, 'el nombre de la rueda, no el username abreviado').toContain('Luz');
    expect(boton?.textContent, 'ya tiene dueña: no puede ofrecer «Asignar»').not.toContain('Asignar');
    vista.desmontar();

    // Y la mitad que rompía: asignada a QUIEN MIRA. Se compara normalizando —
    // `Luz` de Cerberus contra `luz` del login es un caso vivo en producción.
    const mia = { ...CONTACTO, asignada_a: 'Ana' };
    vista = montar(<HojaContacto conversacion={mia} onCerrar={vi.fn()} miVendedora="ana" />);
    await esperarA(
      () => vista!.contenedor.querySelector('button[title*="tuya"]') !== null,
      'el chip que dice que la conversación es tuya',
    );
    boton = vista.contenedor.querySelector('button[title*="tuya"]');
    expect(boton, 'asignada a mí: el chip lo tiene que decir, no volver al vacío').not.toBeNull();
    expect(boton?.textContent).toContain('Tú');
  });

  it('muestra "Escribirle" cuando no hay hilo y hay puente', async () => {
    const escribir = vi.fn();
    vista = montar(<HojaContacto conversacion={CONTACTO} onCerrar={vi.fn()} onEscribir={escribir} />);
    await reposar();

    const boton = Array.from(vista.contenedor.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Escribirle'),
    );
    expect(boton).not.toBeNull();
    tocar(boton!);
    expect(escribir).toHaveBeenCalledWith('51987654321');
  });

  it('NO muestra "Escribirle" cuando la conversación ya tiene hilo', async () => {
    const escribir = vi.fn();
    const conHilo = { ...CONTACTO, n: 5 };
    vista = montar(<HojaContacto conversacion={conHilo} onCerrar={vi.fn()} onEscribir={escribir} />);
    await reposar();

    const boton = Array.from(vista.contenedor.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Escribirle'),
    );
    expect(boton).toBeUndefined();
  });
});
