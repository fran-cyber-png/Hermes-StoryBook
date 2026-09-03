// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * 🔴 EL CABLEADO DEL CHAT TOMADO (ADR 0083).
 *
 * La regla pura vive en `dominio/tenencia.ts` y tiene sus tests. Esto fija que el
 * componente la LLAME, que es otra cosa: `lecturaDeTenencia` puede estar perfecta
 * y el compositor seguir escribiendo igual, y en pantalla eso se ve idéntico a no
 * tener la funcionalidad. Es la lección de ADR 0024 y del candado #11 — el
 * defecto suele ser que nadie llama a la regla, no que esté mal escrita.
 *
 * ⚠️ **Lo que este test NO es**: la garantía. El que rechaza el envío es el
 * server (`whatsapp/enviarYProyectar.ts`, con su propio candado de montaje).
 * Apagar la caja es cortesía, y confundir las dos es cómo se pierde la mitad que
 * sí protege.
 */

const TELEFONO = '51955010001';
const LINEA = '51900112233';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${LINEA}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Yaneth Cóndor',
  numero_propio: LINEA,
  texto: '¿Dónde es el mitin del sábado?',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 0,
} as Conversacion;

/** El server contesta lo mínimo para que el hilo se dibuje y la sesión esté viva. */
function conServerVivo() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada);
      const json = (c: unknown) =>
        new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/whatsapp/sesion')) return json({ estado: 'conectado', telefono: LINEA });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ mensajes: [], origen: null });
      return json({});
    }),
  );
}

/**
 * El `bloqueoDeChat` no lo pide el hilo: lo dejó la cola en su caché. Sembrarlo es
 * reproducir el estado real — y omitirlo es exactamente lo que pasa con un server
 * viejo, que es el otro caso que hay que fijar.
 */
const conBloqueoPrendido = (cliente: {
  setQueryData: (k: unknown[], v: unknown) => void;
}) => {
  cliente.setQueryData(['conversaciones', 'lo-que-sea'], {
    pages: [{ conversaciones: [], hayMas: false, bloqueoDeChat: true }],
    pageParams: [0],
  });
};

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

const caja = () => montado!.contenedor.querySelector('textarea');
const rotulo = () =>
  [...montado!.contenedor.querySelectorAll('span')].find(
    (s) => s.textContent && s.textContent.startsWith('activo con'),
  );
const contorno = () => montado!.contenedor.querySelector('.outline-success');

describe('el chat que atiende otra persona', () => {
  test('🔴 se rotula, se contornea y NO se puede escribir', async () => {
    conServerVivo();
    montado = montar(
      <HiloWhatsapp
        conversacion={
          {
            ...CONVERSACION,
            asignada_a: 'luz',
            asignada_hasta: new Date(Date.now() + 6 * 60_000).toISOString(),
          } as Conversacion
        }
        miVendedora="sindy"
      />,
      conBloqueoPrendido,
    );
    await reposar();

    expect(rotulo()?.textContent).toBe('activo con Luz · 6 min');
    expect(contorno()).not.toBeNull();
    expect(caja()?.disabled).toBe(true);
    expect(caja()?.getAttribute('placeholder')).toBe('Luz está atendiendo esta conversación');
  });

  /**
   * 🔴 Lo propio no se rotula NUNCA. Sin esto, quien abre sus propios chats ve
   * borde verde todo el día y la señal deja de ser una señal.
   */
  test('🔴 el chat propio no se rotula ni se bloquea', async () => {
    conServerVivo();
    montado = montar(
      <HiloWhatsapp
        conversacion={
          {
            ...CONVERSACION,
            asignada_a: 'Sindy',
            asignada_hasta: new Date(Date.now() + 6 * 60_000).toISOString(),
          } as Conversacion
        }
        miVendedora="sindy"
      />,
      conBloqueoPrendido,
    );
    await reposar();

    expect(rotulo()).toBeUndefined();
    expect(contorno()).toBeNull();
    expect(caja()?.disabled).toBe(false);
  });

  /**
   * 🔴 EL CASO QUE PROTEGE AL EQUIPO ENTERO. N4 sale solo y N5 es un botón: sin
   * `bloqueoDeChat` en el caché, cada vendedora quedaría sin poder escribir en
   * todo lo que tenga dueño — 3.637 conversaciones en producción.
   */
  test('🔴 con el server viejo no se bloquea nada', async () => {
    conServerVivo();
    montado = montar(
      <HiloWhatsapp
        conversacion={
          {
            ...CONVERSACION,
            asignada_a: 'luz',
            asignada_hasta: new Date(Date.now() + 6 * 60_000).toISOString(),
          } as Conversacion
        }
        miVendedora="sindy"
      />,
      // Sin sembrar nada: es exactamente lo que hay cuando el server no manda el campo.
    );
    await reposar();

    expect(rotulo()).toBeUndefined();
    expect(contorno()).toBeNull();
    expect(caja()?.disabled).toBe(false);
  });

  /** La tenencia que no vence bloquea igual, y sin reloj: no hay nada que contar. */
  test('la tenencia sin vencimiento bloquea y no muestra reloj', async () => {
    conServerVivo();
    montado = montar(
      <HiloWhatsapp
        conversacion={{ ...CONVERSACION, asignada_a: 'luz', asignada_hasta: null } as Conversacion}
        miVendedora="sindy"
      />,
      conBloqueoPrendido,
    );
    await reposar();

    expect(rotulo()?.textContent).toBe('activo con Luz');
    expect(caja()?.disabled).toBe(true);
  });
});

/**
 * 🔴 LA FOTO VIEJA — la regresión que se escapó a los tres tests de arriba.
 *
 * `App` guarda la conversación abierta en un `useState` que se congela al hacer
 * clic. Cuando otra persona toma ese chat, la cola refresca sola —su fila ya
 * dibuja la píldora del dueño nuevo— pero el panel seguía leyendo la prop vieja:
 * caja habilitada, y quien escribe se come el rechazo del server DESPUÉS de
 * teclear. Medido con dos sesiones abiertas: a los 30 s seguía dejando escribir,
 * y sólo un reload lo corregía.
 *
 * O sea: el conflicto que ADR 0083 existe para cortar, ocurriendo adentro del
 * frente. Por eso el test siembra la contradicción a propósito —prop SIN dueño,
 * caché CON dueño— y exige que gane el caché.
 */
test('🔴 el chat que otro tomó recién BLOQUEA aunque la prop venga sin dueño', async () => {
  conServerVivo();
  montado = montar(
    // La prop es la foto de cuando se abrió: nadie la tenía.
    <HiloWhatsapp conversacion={{ ...CONVERSACION } as Conversacion} miVendedora="sindy" />,
    (cliente) => {
      // El caché es lo que la cola trajo hace un instante: ya la tiene Luz.
      cliente.setQueryData(['conversaciones', 'lo-que-sea'], {
        pages: [
          {
            conversaciones: [
              {
                ...CONVERSACION,
                asignada_a: 'luz',
                asignada_hasta: new Date(Date.now() + 6 * 60_000).toISOString(),
              },
            ],
            hayMas: false,
            bloqueoDeChat: true,
          },
        ],
        pageParams: [0],
      });
    },
  );
  await reposar();

  expect(rotulo()?.textContent).toBe('activo con Luz · 6 min');
  expect(contorno()).not.toBeNull();
  expect(caja()?.disabled).toBe(true);
});

/**
 * La otra mitad: si la cola NO tiene esta clave (se filtró, salió del recorte),
 * se respeta lo que traía la prop. Tratar la ausencia como «libre» abriría la
 * caja justo cuando se perdió de vista quién la tiene.
 */
test('sin la fila en el caché, manda lo que traía la prop', async () => {
  conServerVivo();
  montado = montar(
    <HiloWhatsapp
      conversacion={
        {
          ...CONVERSACION,
          asignada_a: 'luz',
          asignada_hasta: new Date(Date.now() + 6 * 60_000).toISOString(),
        } as Conversacion
      }
      miVendedora="sindy"
    />,
    (cliente) => {
      cliente.setQueryData(['conversaciones', 'otra-cola'], {
        pages: [{ conversaciones: [], hayMas: false, bloqueoDeChat: true }],
        pageParams: [0],
      });
    },
  );
  await reposar();

  expect(caja()?.disabled).toBe(true);
});
