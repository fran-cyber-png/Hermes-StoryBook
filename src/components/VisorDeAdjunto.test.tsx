// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, teclear, tocar, type Montado } from '../pruebas/dom';
import { VisorDeAdjunto } from './VisorDeAdjunto';

/**
 * EL CABLEADO DEL VISOR — lo que un test puro no ve.
 *
 * Que se cierre con Escape y con el fondo pero NO con un clic sobre la foto (que
 * es para verla en tamaño real), que su doble clic no llegue a la burbuja de
 * atrás (que cita con doble clic), y que Descargar se ofrezca sólo si hay cómo.
 */

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
});

const visor = () => document.querySelector('[role="dialog"]');

describe('VisorDeAdjunto', () => {
  it('Escape y el fondo cierran; un clic en la foto NO: alterna el tamaño real', () => {
    const onCerrar = vi.fn();
    montado = montar(
      <VisorDeAdjunto clase="imagen" src="blob:prueba/foto" nombre="imagen.jpg" onDescargar={() => {}} onCerrar={onCerrar} />,
    );

    const foto = visor()!.querySelector('img')!;
    tocar(foto);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(visor()!.querySelector('img')!.title).toBe('Ajustar a la pantalla');

    tocar(document.querySelector('[data-fondo-del-visor]')!);
    expect(onCerrar).toHaveBeenCalledTimes(1);

    teclear('Escape');
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('🔴 un doble clic adentro no llega a la burbuja de atrás (que cita con doble clic)', () => {
    const citar = vi.fn();
    montado = montar(
      <div onDoubleClick={citar}>
        <VisorDeAdjunto clase="imagen" src="blob:prueba/foto" nombre="x.jpg" onDescargar={() => {}} onCerrar={() => {}} />
      </div>,
    );
    visor()!.querySelector('img')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(citar).not.toHaveBeenCalled();
  });

  it('Descargar llama a quien sabe guardar, y no cierra el visor', () => {
    const onDescargar = vi.fn();
    const onCerrar = vi.fn();
    montado = montar(
      <VisorDeAdjunto clase="imagen" src="blob:prueba/foto" nombre="imagen.jpg" onDescargar={onDescargar} onCerrar={onCerrar} />,
    );
    tocar(document.querySelector('button[title^="Descargar"]')!);
    expect(onDescargar).toHaveBeenCalledTimes(1);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('un PDF se muestra adentro, no se descarga solo', () => {
    const onDescargar = vi.fn();
    montado = montar(<VisorDeAdjunto clase="documento" src="blob:prueba/pdf" nombre="temario.pdf" onDescargar={onDescargar} onCerrar={() => {}} />);
    expect(visor()!.querySelector('iframe')?.getAttribute('src')).toBe('blob:prueba/pdf');
    expect(onDescargar).not.toHaveBeenCalled();
  });

  it('sin `onDescargar` no hay botón: una imagen que no se puede guardar no lo promete', () => {
    montado = montar(<VisorDeAdjunto clase="imagen" src="https://scontent.test/x.jpg" nombre="x" onCerrar={() => {}} />);
    expect(document.querySelector('button[title^="Descargar"]')).toBeNull();
  });

  it('si descargar falla, se dice en el botón y se puede reintentar', async () => {
    const onDescargar = vi.fn().mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce(undefined);
    montado = montar(<VisorDeAdjunto clase="imagen" src="https://scontent.test/x.jpg" nombre="x" onDescargar={onDescargar} onCerrar={() => {}} />);
    tocar(document.querySelector('button[title^="Descargar"]')!);
    await esperarA(() => Boolean(document.body.textContent?.includes('No se pudo')), 'el aviso de que falló');
    tocar(document.querySelector('button[title^="Descargar"]')!);
    await esperarA(() => !document.body.textContent?.includes('No se pudo'), 'que el reintento lo limpie');
    expect(onDescargar).toHaveBeenCalledTimes(2);
  });
});
