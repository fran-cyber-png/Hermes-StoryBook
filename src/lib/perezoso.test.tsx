// @vitest-environment jsdom
import { Suspense } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../pruebas/dom';
import { perezoso } from './perezoso';

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.restoreAllMocks();
});

describe('perezoso', () => {
  test('🔴 si el chunk no carga, no se dibuja y lo de al lado sigue en pie', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Roto = perezoso<{ texto: string }>(() => Promise.reject(new Error('el chunk ya no existe')));

    montado = montar(
      <div>
        <p>el hilo</p>
        <Suspense fallback={<span>cargando</span>}>
          <Roto texto="nunca" />
        </Suspense>
      </div>,
    );
    await esperarA(() => aviso.mock.calls.length > 0 || !document.body.textContent?.includes('cargando'), 'que el diferido intente cargar');
    for (let i = 0; i < 5; i++) await reposar();

    expect(document.body.textContent).toContain('el hilo');
    expect(document.body.textContent).not.toContain('nunca');
    expect(document.body.textContent).not.toContain('cargando');
  });

  test('si carga, dibuja el componente con sus props', async () => {
    const Sano = perezoso<{ texto: string }>(async () => ({ texto }: { texto: string }) => <b>{texto}</b>);

    montado = montar(
      <Suspense fallback={null}>
        <Sano texto="listo" />
      </Suspense>,
    );

    await esperarA(() => document.body.textContent?.includes('listo') ?? false, 'el componente cargado');
  });
});
