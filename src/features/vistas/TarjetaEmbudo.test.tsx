// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrastrar, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { TarjetaEmbudo } from './TarjetaEmbudo';
import { ETAPA_ROTULO } from '../../lib/etapas';
import { PORQUE_DE_RELLENO } from '../../dominio/semaforo';

/**
 * LA TARJETA CLICKEABLE, ADENTRO DE UNA TARJETA ARRASTRABLE.
 *
 * Un test puro no puede ver ninguna de las dos cosas que se rompen acá: que un
 * arrastre termine contando como clic (y cada drop abra una ficha encima del
 * tablero que se estaba ordenando), y que un botón de adentro dispare además la
 * acción de afuera. Las dos son cableado, y el cableado se ve montando.
 */

const BASE: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51986394450',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51986394450',
  texto: 'me interesa el diplomado',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 3,
  referencia: '2026-08-05T12:00:00.000Z',
  ultimo_at: '2026-08-05T12:00:00.000Z',
  dias: 0,
  nivel: 3,
};

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

function pintar(props: Partial<Parameters<typeof TarjetaEmbudo>[0]> = {}) {
  const todo = {
    c: BASE,
    indice: 0,
    onAbrir: vi.fn(),
    onFicha: vi.fn(),
    alArrastrar: vi.fn(),
    alTerminar: vi.fn(),
    arrastrando: false,
    rebotada: false,
    cotizando: false,
    ...props,
  };
  vista = montar(<TarjetaEmbudo {...todo} />);
  const tarjeta = vista.contenedor.querySelector('[role="button"]');
  if (!tarjeta) throw new Error('la tarjeta no se dibujó como clickeable');
  return { ...todo, tarjeta, contenedor: vista.contenedor };
}

describe('TarjetaEmbudo — el clic que abre la ficha', () => {
  it('un clic en la tarjeta abre la ficha de esa conversación', () => {
    const { tarjeta, onFicha } = pintar();

    tocar(tarjeta);

    expect(onFicha).toHaveBeenCalledWith(BASE);
  });

  it('🔴 un ARRASTRE no cuenta como clic', async () => {
    // La tarjeta es `draggable` desde #60. Un drag que empieza y termina sobre
    // ella misma —soltar sin moverse, cancelar con Escape— puede terminar
    // disparando `click`: sin la guarda, cada arrastre fallido abre la ficha.
    const { tarjeta, onFicha } = pintar();

    arrastrar(tarjeta);
    tocar(tarjeta);

    expect(onFicha).not.toHaveBeenCalled();
  });

  it('y en el tick siguiente la tarjeta vuelve a ser clickeable', async () => {
    // La guarda se levanta sola: si no, arrastrar una tarjeta la dejaría muda
    // para siempre y nadie relacionaría las dos cosas.
    const { tarjeta, onFicha } = pintar();

    arrastrar(tarjeta);
    await reposar();
    tocar(tarjeta);

    expect(onFicha).toHaveBeenCalledTimes(1);
  });

  it('el botón de Mensajes lleva al chat y NO abre además la ficha', () => {
    // Sin `stopPropagation`, el clic haría las dos: la vista se va a Mensajes y
    // queda una hoja abierta atrás, en una vista que ya nadie está mirando.
    const { contenedor, onAbrir, onFicha } = pintar();

    const boton = contenedor.querySelector('button[title="Abrir en Mensajes"]');
    expect(boton).not.toBeNull();
    tocar(boton!);

    expect(onAbrir).toHaveBeenCalledWith(BASE);
    expect(onFicha).not.toHaveBeenCalled();
  });

  it('el botón del atajo asienta el interés y NO abre además la ficha', () => {
    const onCotizar = vi.fn();
    const { contenedor, onFicha } = pintar({
      c: { ...BASE, precio_enviado: true, interes_curso: 'Inteligencia y Contrainteligencia' },
      onCotizar,
    });

    // Por el rótulo canónico y no por una copia literal: este test se rompió al
    // unificar los nombres, que es justo lo que no tiene que volver a pasar.
    const boton = [...contenedor.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(ETAPA_ROTULO.cotizado.uno),
    );
    expect(boton).toBeDefined();
    tocar(boton!);

    expect(onCotizar).toHaveBeenCalledTimes(1);
    expect(onFicha).not.toHaveBeenCalled();
  });

  it('sin `onFicha` la tarjeta no se anuncia como clickeable', () => {
    // El Pipeline es el único que la pasa. Un `role="button"` sin nada detrás le
    // promete al lector de pantalla una acción que no existe.
    const sinFicha = montar(
      <TarjetaEmbudo
        c={BASE}
        indice={0}
        onAbrir={vi.fn()}
        alArrastrar={vi.fn()}
        alTerminar={vi.fn()}
        arrastrando={false}
        rebotada={false}
        cotizando={false}
      />,
    );

    expect(sinFicha.contenedor.querySelector('[role="button"]')).toBeNull();
    sinFicha.desmontar();
  });
});

/**
 * 🔴 EL VEREDICTO DEL BOT EN LA TARJETA — el cableado que faltaba.
 *
 * `bot_temperatura` y `bot_escalada` viajan en cada fila de `/api/conversaciones`
 * desde que la cola los sirve, y el tablero come de la MISMA consulta
 * (`GET /tablero` y `GET /` comparten `consultarCola`). O sea que el dato ya
 * estaba en el objeto que esta tarjeta recibe, y la tarjeta no lo miraba: la
 * escalada se veía en Mensajes y no en el Pipeline, que es donde la vendedora
 * elige a quién tocar.
 *
 * El QUÉ se dice está probado en `dominio/bot.test.ts`. Lo único que se mide acá
 * es que la tarjeta LLAME a esa regla — la clase de defecto que ningún test puro
 * puede ver (ADR 0024).
 */
describe('TarjetaEmbudo — lo que el bot dijo', () => {
  it('🔴 muestra la escalada: el bot se frenó y en el tablero no se veía', () => {
    const { contenedor } = pintar({
      c: { ...BASE, bot_escalada: true, bot_motivo: 'por_cerrar' },
    });
    expect(contenedor.textContent).toMatch(/Listo para cerrar/i);
  });

  it('muestra «Caliente» cuando el bot la calificó así', () => {
    const { contenedor } = pintar({
      c: { ...BASE, bot_temperatura: 'caliente', bot_motivo: 'pidió el precio' },
    });
    expect(contenedor.textContent).toMatch(/Caliente/i);
  });

  it('sin veredicto no dibuja nada: la tarjeta no crece por una fila que el bot no tocó', () => {
    const { contenedor } = pintar();
    expect(contenedor.textContent).not.toMatch(/Caliente|Listo para cerrar|Pidió ayuda/i);
  });

  it('🔴 se dibuja aunque el veredicto sea LO ÚNICO que la tarjeta tiene que decir', () => {
    // El renglón de chips es condicional, y su condición enumeraba curso, precio,
    // ventana, antigüedad, preview, «Cotizar» y `landing` — no el bot. Una
    // conversación escalada sin ninguna de esas siete calculaba la marca y no la
    // dibujaba nunca: el chip desaparecía justo en la tarjeta más pobre, que es
    // el mismo defecto que el comentario de `landing` ya describe ahí al lado.
    const { contenedor } = pintar({
      c: {
        ...BASE,
        texto: null,
        interes_curso: null,
        lead_curso: null,
        precio_enviado: false,
        ventana_cierra: null,
        etapa_desde: null,
        respondida: true,
        bot_escalada: true,
        bot_motivo: 'pidio_humano',
      },
      onCotizar: undefined,
    });
    expect(contenedor.textContent).toMatch(/Pidió una persona/i);
  });

  it('🔴 `tibio` y `frio` NO entran a la tarjeta, igual que en la fila de la cola', () => {
    // La misma regla que la fila de la cola, y su medición vive una sola vez en
    // `dominio/bot.ts`: un chip en tres de cada cuatro tarjetas de una columna de
    // 1.389 no ayuda a elegir a quién atender. Las tres temperaturas se leen en
    // la ficha, que es donde hay lugar.
    const { contenedor } = pintar({ c: { ...BASE, bot_temperatura: 'tibio' } });
    expect(contenedor.textContent).not.toMatch(/tibio/i);
  });
});

/**
 * EL SEMÁFORO EN LA TARJETA (#826, S.2) — el cableado: que la tarjeta LLAME al
 * degradado y muestre el `porque`. La regla de qué luz corresponde a qué señal
 * ya está probada en `dominio/semaforo.test.ts`; acá solo se mide que
 * `TarjetaEmbudo` no la ignore (ADR 0024: el defecto suele estar en el
 * cableado, no en la regla).
 */
describe('TarjetaEmbudo — el semáforo del lead', () => {
  it('una tarjeta verde lleva la clase del degradado', () => {
    const { tarjeta } = pintar({ c: { ...BASE, luz: 'verde', porque: 'preguntó precio' } });
    expect(tarjeta.className).toContain('tarjeta-semaforo--verde');
  });

  it('una tarjeta gris NO lleva ninguna clase de degradado (D2: todos llegan grises)', () => {
    const { tarjeta } = pintar({ c: { ...BASE, luz: 'gris', porque: 'llegó, todavía no contestó' } });
    expect(tarjeta.className).not.toMatch(/tarjeta-semaforo--/);
  });

  it('sin `luz` (server sin S.1) tampoco lleva clase: no se inventa un color', () => {
    const { tarjeta } = pintar();
    expect(tarjeta.className).not.toMatch(/tarjeta-semaforo--/);
  });

  it('el `porque` se lee bajo el nombre, en texto', () => {
    const { contenedor } = pintar({ c: { ...BASE, luz: 'rojo', porque: 'dijo que no' } });
    expect(contenedor.textContent).toMatch(/dijo que no/);
  });

  it('el `porque` también es el tooltip (title) de esa línea', () => {
    const { contenedor } = pintar({
      c: { ...BASE, luz: 'ambar', porque: 'preguntó precio y se enfrió' },
    });
    const linea = [...contenedor.querySelectorAll('p')].find((p) =>
      p.textContent?.includes('preguntó precio y se enfrió'),
    );
    expect(linea?.getAttribute('title')).toBe('preguntó precio y se enfrió');
  });

  /**
   * 🔴 LOS TRES PORQUÉS DE RELLENO NO SE DIBUJAN (10-sep-2026). Medido sobre las
   * cien primeras tarjetas de cada columna: «contestó, sin decir todavía qué
   * quiere» iba debajo del nombre en el 90 % de «Saben el precio» y
   * «Contestaron». Un renglón idéntico en miles de tarjetas no explica nada — la
   * lección de ADR 0016 con el preview. La regla vive en
   * `dominio/semaforo.ts#porqueDestacable`; acá se fija que la tarjeta la LLAME.
   */
  it('🔴 un porqué de relleno no ocupa un renglón: la luz ya lo dice', () => {
    for (const porque of Object.values(PORQUE_DE_RELLENO)) {
      const { contenedor } = pintar({ c: { ...BASE, luz: 'ambar', porque } });
      expect(contenedor.textContent, porque).not.toContain(porque);
      vista?.desmontar();
      vista = null;
    }
  });

  it('🔴 una propuesta del bot (origen: maquina) se dibuja con borde punteado', () => {
    const { tarjeta } = pintar({
      c: { ...BASE, luz: 'rojo', porque: 'frío según el bot', origen_semaforo: 'maquina' },
    });
    expect(tarjeta.className).toContain('tarjeta-semaforo--propuesta');
  });

  it('lo derivado (sin origen: maquina) NO lleva el borde punteado', () => {
    const { tarjeta } = pintar({ c: { ...BASE, luz: 'verde', porque: 'preguntó precio' } });
    expect(tarjeta.className).not.toContain('tarjeta-semaforo--propuesta');
  });
});

/**
 * A QUIÉN ESTÁ ASIGNADA — sólo para quien supervisa (pedido del dueño,
 * 10-sep-2026: «para un supervisor es imprescindible ver a quién está
 * asignado»). Qué se dice lo decide `dominio/dueno.ts#marcaDeAsignacion`; acá se
 * fija que la tarjeta lo dibuje cuando corresponde y lo calle cuando no.
 */
describe('TarjetaEmbudo — a quién está asignada', () => {
  it('para quien supervisa dice el nombre corto de la dueña', () => {
    const { contenedor } = pintar({ c: { ...BASE, asignada_a: 'sindy.rojas' }, conAsignacion: true });
    expect(contenedor.textContent).toContain('Sindy');
  });

  it('🔴 y «Sin asignar» cuando no la tiene nadie, aunque sea lo único que la tarjeta tiene que decir', () => {
    // Sin texto, curso, precio, ventana ni antigüedad: el renglón de chips no
    // tiene otro motivo para dibujarse. Es el mismo defecto que ya mordió con el
    // bot y con `landing` — la marca calculada y nunca dibujada.
    const { contenedor } = pintar({ c: { ...BASE, texto: null, asignada_a: null }, conAsignacion: true });
    expect(contenedor.textContent).toContain('Sin asignar');
  });

  it('a una vendedora no se le dibuja', () => {
    const { contenedor } = pintar({ c: { ...BASE, asignada_a: null } });
    expect(contenedor.textContent).not.toContain('Sin asignar');
  });
});

/**
 * EL DISEÑO DE CAMPAÑA (13-sep-2026, la maqueta que eligió el dueño): «el color
 * aparece SÓLO como señal». La luz deja de ser un degradado de fondo con el borde
 * entero teñido y pasa a ser un filete izquierdo sobre una tarjeta blanca. Ventas
 * conserva su degradado: lo fijan los tests de arriba.
 */
describe('TarjetaEmbudo — en campaña la luz es un filete, no un fondo', () => {
  it('🔴 una tarjeta verde de campaña es blanca con el filete de su luz, sin degradado', () => {
    const { tarjeta } = pintar({ c: { ...BASE, luz: 'verde', porque: 'preguntó por el local' }, esDeCampana: true });
    expect(tarjeta.className).not.toMatch(/tarjeta-semaforo--(verde|ambar|rojo)/);
    expect(tarjeta.getAttribute('data-luz')).toBe('verde');
    expect(tarjeta.className).toContain('border-l-sem-verde');
  });

  it('sin luz, el filete es gris: un dato que no vino no se pinta de otro color', () => {
    const { tarjeta } = pintar({ esDeCampana: true });
    expect(tarjeta.getAttribute('data-luz')).toBe('gris');
    expect(tarjeta.className).toContain('border-l-sem-gris');
  });
});

/**
 * 🔴 LA TARJETA DEL PIPELINE DE CAMPAÑA NO MUESTRA NADA DE LA ESCUELA (regla del
 * dueño, 11-sep-2026): ni el curso, ni «Ya compró», ni «Saben el precio», ni el
 * atajo a Cotizados. Las dos mitades sobre la MISMA conversación.
 */
describe('TarjetaEmbudo — en campaña, nada de la Escuela', () => {
  const DE_LA_ESCUELA: Conversacion = {
    ...BASE,
    lead_curso: 'Diplomado en Inteligencia y Contrainteligencia',
    cliente_nivel: 'recompro',
    cliente_compras: 2,
    precio_enviado: true,
  };

  it('🔴 en campaña no hay curso, marca de cliente, precio ni cotizar', () => {
    const { contenedor } = pintar({ c: DE_LA_ESCUELA, esDeCampana: true, onCotizar: vi.fn() });
    const texto = contenedor.textContent ?? '';
    expect(texto, 'el curso de la Escuela apareció en campaña').not.toContain('Inteligencia');
    expect(texto, 'la marca de cliente apareció en campaña').not.toContain('Cliente ×');
    expect(texto, '«Saben el precio» es de ventas').not.toMatch(/precio/i);
    expect(contenedor.querySelector('[aria-label*="precio"], [title*="precio"]'), 'el atajo a cotizar es de ventas').toBeNull();
  });

  /** «Quítale el chip [⧗ 6 d] a todo el pipeline, que quede el del hace tiempo» (dueño, 13-sep-2026). */
  it('🔴 en campaña no hay reloj de arena de la ventana; en ventas sí', () => {
    const conVentana: Conversacion = { ...BASE, ventana_cierra: new Date(Date.now() + 6 * 3_600_000).toISOString() };
    const ventas = pintar({ c: conVentana });
    expect(ventas.contenedor.querySelector('[title*="sin pagar una plantilla"]'), 'en ventas la ventana se ve').not.toBeNull();
    vista?.desmontar();
    vista = null;
    const campana = pintar({ c: conVentana, esDeCampana: true });
    expect(campana.contenedor.querySelector('[title*="sin pagar una plantilla"]')).toBeNull();
  });

  it('en ventas la misma tarjeta sí muestra el curso, la marca y el precio', () => {
    const { contenedor } = pintar({ c: DE_LA_ESCUELA, onCotizar: vi.fn() });
    const texto = contenedor.textContent ?? '';
    expect(texto).toContain('Inteligencia');
    expect(texto).toContain('Cliente ×2');
  });
});
