// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, teclear, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import type { LineaWhatsapp } from '../../dominio/lineas';
import { TarjetaEmbudo } from './TarjetaEmbudo';

/**
 * EL BOTÓN QUE LLEVA AL CHAT, AHORA QUE PREGUNTA POR QUÉ LÍNEA.
 *
 * La decisión está testeada aparte y pura (`dominio/lineaParaAbrir.test.ts`).
 * Acá se fija lo que un test puro no puede ver, que es el CABLEADO — la lección
 * de ADR 0024, donde `escapeDePopover` estaba testeada hasta el hueso y la app
 * perdió igual el Escape porque el defecto vivía en el cable:
 *
 *   · que abrir el menú NO navegue (si no, la vista se va a Mensajes y el menú
 *     queda preguntando en una pantalla que nadie mira);
 *   · que ni el disparador ni los items abran además la ficha al costado
 *     (el botón vive DENTRO de una tarjeta clickeable y arrastrable);
 *   · que el Escape cierre el menú y NO siga viaje hasta el shell, que en
 *     Mensajes cierra la conversación abierta;
 *   · que el menú no sobreviva a que la tarjeta se recicle en otra persona.
 */

const LINEA = (numero: string, etiqueta: string): LineaWhatsapp => ({
  numero,
  etiqueta,
  estado: 'conectado',
});

const META = LINEA('51984429504', 'Ventas Meta');
const BETTO = LINEA('51963139984', 'Betto');

const CHAT: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51984429504',
  texto: 'me interesa el diplomado',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 3,
  referencia: '2026-08-18T12:00:00.000Z',
  ultimo_at: '2026-08-18T12:00:00.000Z',
  dias: 0,
  nivel: 3,
};

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

function pintar(props: { c?: Conversacion; lineas?: LineaWhatsapp[] } = {}) {
  const onAbrir = vi.fn();
  const onFicha = vi.fn();
  const nodo = (c: Conversacion) => (
    <TarjetaEmbudo
      c={c}
      indice={0}
      onAbrir={onAbrir}
      onFicha={onFicha}
      alArrastrar={vi.fn()}
      alTerminar={vi.fn()}
      arrastrando={false}
      rebotada={false}
      cotizando={false}
      lineas={props.lineas ?? [META, BETTO]}
    />
  );
  vista = montar(nodo(props.c ?? CHAT));
  const contenedor = vista.contenedor;
  return {
    onAbrir,
    onFicha,
    contenedor,
    repintarCon: (c: Conversacion) => vista!.repintar(nodo(c)),
    // Por el prefijo del título y no por `aria-haspopup`: con una sola línea el
    // botón NO anuncia un menú (no lo hay), y buscarlo así lo perdería justo en
    // el caso que hay que verificar.
    disparador: () => contenedor.querySelector<HTMLButtonElement>('button[title^="Abrir"]'),
    items: () => [...contenedor.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')],
  };
}

describe('el botón del Pipeline pregunta por qué línea', () => {
  it('con dos líneas, tocarlo abre el menú y NO se va a Mensajes', () => {
    const { disparador, items, onAbrir, onFicha } = pintar();

    tocar(disparador()!);

    expect(items().map((b) => b.textContent)).toEqual([
      expect.stringContaining('Ventas Meta'),
      expect.stringContaining('Betto'),
    ]);
    expect(onAbrir).not.toHaveBeenCalled();
    // Y tampoco la ficha al costado: el botón vive dentro de una tarjeta que es
    // clickeable entera.
    expect(onFicha).not.toHaveBeenCalled();
  });

  it('la del hilo se marca «este chat» y elegirla abre la conversación tal cual', () => {
    const { disparador, items, onAbrir, onFicha } = pintar();
    tocar(disparador()!);

    const suya = items()[0];
    expect(suya.textContent).toContain('este chat');
    tocar(suya);

    expect(onAbrir).toHaveBeenCalledWith(CHAT);
    expect(onFicha).not.toHaveBeenCalled();
  });

  it('elegir la otra línea abre el chat de esa línea con la misma persona', () => {
    const { disparador, items, onAbrir } = pintar();
    tocar(disparador()!);

    tocar(items()[1]);

    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir.mock.calls[0][0]).toMatchObject({
      clave: 'conv:whatsapp:51987654321:51963139984',
      numero_propio: '51963139984',
      persona_nombre: 'Javier Peralta',
    });
  });

  it('con UNA sola línea no hay menú: lleva derecho al chat', () => {
    // Un selector de un solo elemento no es una elección, es un clic de más
    // antes de cada conversación.
    const { disparador, items, onAbrir } = pintar({ lineas: [META] });

    tocar(disparador()!);

    expect(items()).toHaveLength(0);
    expect(onAbrir).toHaveBeenCalledWith(CHAT);
  });

  it('un lead de formulario con una sola línea abre el chat POR esa línea', () => {
    // Antes de esto el botón lo mandaba al hilo de solo lectura de Messenger:
    // sin caja donde escribir, en la tarjeta que existe para abrir el chat.
    const lead: Conversacion = {
      ...CHAT,
      clave: 'lead:8821',
      canal: 'landing',
      tipo: 'lead',
      numero_propio: null,
    };
    const { disparador, onAbrir } = pintar({ c: lead, lineas: [META] });

    tocar(disparador()!);

    expect(onAbrir.mock.calls[0][0]).toMatchObject({
      clave: 'conv:whatsapp:51987654321:51984429504',
      canal: 'whatsapp',
    });
  });

  it('🔴 Escape cierra el menú y no le llega al shell', () => {
    // El shell escucha en BURBUJA y en Mensajes cierra la conversación abierta.
    // Sin el corte, una sola tecla cerraría el menú Y la conversación de atrás.
    const enElShell = vi.fn();
    window.addEventListener('keydown', enElShell);
    try {
      const { disparador, items } = pintar();
      tocar(disparador()!);
      expect(items()).toHaveLength(2);

      teclear('Escape');

      expect(items()).toHaveLength(0);
      expect(enElShell).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', enElShell);
    }
  });

  it('el menú no sobrevive a que la tarjeta pase a ser otra persona', () => {
    // Las columnas se reciclan: llega un mensaje y todo sube. Un menú que
    // sobreviva abre el chat de la de antes.
    const { disparador, items, repintarCon } = pintar();
    tocar(disparador()!);
    expect(items()).toHaveLength(2);

    repintarCon({ ...CHAT, clave: 'conv:whatsapp:51911222333:51984429504', persona_id: '51911222333' });

    expect(items()).toHaveLength(0);
  });
});
