// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { FilaConversacion } from './FilaConversacion';

/**
 * EL SEMÁFORO EN LA BANDA DE LA COLA (#826, S.2) — cableado: la banda de 3px
 * tiene que LLAMAR a `SEMAFORO_META`, no a la vieja `TEMPERATURE_META` por
 * antigüedad (ADR 0024: el defecto suele estar en el cableado).
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

function pintar(c: Partial<Conversacion> = {}) {
  vista = montar(
    <FilaConversacion c={{ ...BASE, ...c }} seleccionada={false} onAbrir={vi.fn()} indice={0} />,
  );
  const banda = vista.contenedor.querySelector('[aria-hidden="true"]');
  if (!banda) throw new Error('la banda de la fila no se dibujó');
  return { banda, contenedor: vista.contenedor };
}

describe('FilaConversacion — la banda del semáforo', () => {
  it('verde pinta la banda con el color del semáforo, no el de temperatura', () => {
    const { banda } = pintar({ luz: 'verde' });
    expect(banda.className).toContain('bg-sem-verde');
  });

  it('rojo pinta la banda de rojo', () => {
    const { banda } = pintar({ luz: 'rojo' });
    expect(banda.className).toContain('bg-sem-rojo');
  });

  it('sin `luz` (server sin S.1) cae a gris — D2: todos llegan grises', () => {
    const { banda } = pintar();
    expect(banda.className).toContain('bg-sem-gris');
  });

  it('🔴 ya NO usa la rampa de temperatura por antigüedad', () => {
    // Antes de S.2 esto pintaba `bg-temp-*` según cuántos días pasaron. Con
    // el semáforo, una conversación de hace 40 días pero verde (preguntó
    // precio) tiene que seguir viéndose verde, no helada.
    const { banda } = pintar({ luz: 'verde', referencia: '2026-01-01T00:00:00.000Z' });
    expect(banda.className).not.toMatch(/bg-temp-/);
  });
});

/**
 * 🔴 LA FILA DE CAMPAÑA NO MUESTRA NADA DE LA ESCUELA (regla del dueño,
 * 11-sep-2026). Lo reportó la cola de Américo: el chip «Inteligencia y Cont…».
 * La causa estaba en el server (`cola/cursoEnCampana.test.db.ts`); esto es la
 * guarda del front, con las dos mitades: la MISMA fila con datos de la Escuela
 * adentro, en campaña callada y en ventas con su chip y su marca de cliente.
 */
describe('FilaConversacion — en campaña, nada de la Escuela', () => {
  const DE_LA_ESCUELA: Partial<Conversacion> = {
    lead_curso: 'Diplomado en Inteligencia y Contrainteligencia',
    cliente_nivel: 'recompro',
    cliente_compras: 2,
    pregunto: true,
    pregunto_precio: true,
  };

  function pintarEn(esDeCampana: boolean) {
    vista?.desmontar();
    vista = montar(
      <FilaConversacion
        c={{ ...BASE, ...DE_LA_ESCUELA }}
        seleccionada={false}
        onAbrir={vi.fn()}
        indice={0}
        esDeCampana={esDeCampana}
      />,
    );
    return vista.contenedor.textContent ?? '';
  }

  it('🔴 en campaña no hay chip de curso, marca de cliente ni «Preguntó precio»', () => {
    const texto = pintarEn(true);
    expect(texto, 'el chip de curso de la Escuela apareció en campaña').not.toContain('Inteligencia');
    expect(texto, 'la marca de cliente de la Escuela apareció en campaña').not.toContain('Cliente ×');
    expect(texto, '«Preguntó precio» es de ventas').not.toContain('Preguntó precio');
  });

  it('en ventas la misma fila sí muestra el curso y la marca de cliente', () => {
    const texto = pintarEn(false);
    expect(texto).toContain('Inteligencia');
    expect(texto).toContain('Cliente ×2');
  });
});
