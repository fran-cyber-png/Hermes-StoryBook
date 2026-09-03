// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, tocar, type Montado } from '../../pruebas/dom';
import { FiltroCuando } from './FiltroCuando';
import type { Franja } from './franja';

/**
 * EL CHIP DE «CUÁNDO», MONTADO — porque lo que puede fallar es el CABLEADO.
 *
 * La política está en `franja.ts` y tiene sus tests puros; lo que no se puede
 * afirmar sin montar es que el menú devuelva LA franja que se tocó y que se
 * cierre después. Un menú que se queda abierto tapa la columna de al lado, y uno
 * que devuelve la franja equivocada deja el chip diciendo «Hoy» sobre la lista de
 * otra cosa — que es el defecto que todo este frente existe para evitar.
 */

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
});

const AHORA = new Date(2026, 7, 20, 15, 47);
const botones = () => [...montado!.contenedor.querySelectorAll('button')];
/**
 * ⚠️ Se toca con el helper del andamio y no con `.click()` a secas: el clic
 * directo dispara el handler PERO deja el repintado fuera de `act`, así que el
 * DOM que el test lee es el de antes de abrir el menú — verde o rojo por el
 * motivo equivocado.
 */
const tocarRotulo = (texto: string) =>
  tocar(botones().find((b) => b.textContent?.trim() === texto)!);

function montarFiltro(franja: Franja | null, onElegir = vi.fn()) {
  montado = montar(<FiltroCuando franja={franja} onElegir={onElegir} ahora={AHORA} />);
  return onElegir;
}

describe('FiltroCuando', () => {
  it('cerrado es un chip solo, y dice «Cuándo» mientras no filtre nada', () => {
    montarFiltro(null);
    expect(botones()).toHaveLength(1);
    expect(botones()[0].textContent).toContain('Cuándo');
    expect(montado!.contenedor.querySelector('[role="menu"]')).toBeNull();
  });

  it('el chip puesto dice QUÉ franja está puesta, no «Cuándo»', () => {
    montarFiltro({ tipo: 'preset', id: 'm30' });
    expect(botones()[0].textContent).toContain('Últimos 30 minutos');
    expect(botones()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('abierto ofrece los tres grupos y el techo de la cola', () => {
    montarFiltro(null);
    tocar(botones()[0]);
    const texto = montado!.contenedor.textContent ?? '';
    for (const rotulo of ['Todas las fechas', 'Hoy', 'Ayer', 'Última hora', 'Últimos 30 minutos']) {
      expect(texto).toContain(rotulo);
    }
    // 🔴 El techo, escrito donde se elige: más atrás la cola no tiene tarjetas.
    expect(texto).toContain('30 días');
  });

  it('🔴 devuelve la franja que se tocó, y cierra el menú', () => {
    const onElegir = montarFiltro(null);
    tocar(botones()[0]);
    tocarRotulo('Últimos 15 minutos');
    expect(onElegir).toHaveBeenCalledWith({ tipo: 'preset', id: 'm15' });
    expect(montado!.contenedor.querySelector('[role="menu"]')).toBeNull();
  });

  it('«Todas las fechas» apaga la franja: devuelve null, no otro preset', () => {
    const onElegir = montarFiltro({ tipo: 'preset', id: 'hoy' });
    tocar(botones()[0]);
    tocarRotulo('Todas las fechas');
    expect(onElegir).toHaveBeenCalledWith(null);
  });

  it('el rango a medida no se puede aplicar vacío', () => {
    const onElegir = montarFiltro(null);
    tocar(botones()[0]);
    tocarRotulo('Elegir rango…');
    const aplicar = botones().find((b) => b.textContent === 'Aplicar')!;
    expect(aplicar.disabled).toBe(true);
    tocar(aplicar);
    expect(onElegir).not.toHaveBeenCalled();
    // Y el calendario no deja pedir más atrás de lo que la cola mira.
    const desde = montado!.contenedor.querySelector('input[type="date"]');
    expect(desde?.getAttribute('min')).toBe('2026-07-21');
  });
});
