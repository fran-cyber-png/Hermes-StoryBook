import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '../src/index.css';
import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Un QueryClient nuevo por historia — nunca el singleton de la app (lib/datos/cliente.ts),
 * para que el caché de una historia no se filtre a la siguiente.
 */
function ClienteDeConsultaAislado({ children }: { children: React.ReactNode }) {
  const [cliente] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const preview: Preview = {
  /**
   * TODAS las historias entran a la suite de vitest.
   *
   * `@storybook/addon-vitest` sólo corre las que llevan el tag `test`
   * (`tags?.include ?? [Tag.TEST]` en su plugin), y sin esta línea no corría
   * NINGUNA: el addon estaba instalado, declarado en `main.ts` y encontraba los
   * 43 archivos, pero los descartaba a todos por el filtro de tags. Se veía como
   * «no tests», que es indistinguible de «todo bien».
   *
   * Ponerlo acá y no historia por historia es a propósito: una historia que hay
   * que acordarse de marcar es una historia que va a quedar sin correr. Las que
   * no tengan `play()` igual valen — se montan, y una que reviente al renderizar
   * falla el test.
   */
  tags: ['test'],
  parameters: {
    /** «Novedades» siempre primera en el sidebar: es donde se avisa qué trajo la última sincronización. */
    options: {
      storySort: {
        order: ['Novedades', 'Fundamentos', 'Átomos', 'Moléculas', 'Organismos', 'Templates', 'Páginas'],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'claro',
      values: [
        { name: 'claro', value: '#F5F7FB' },
        { name: 'oscuro', value: '#0F1419' },
      ],
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      <ClienteDeConsultaAislado>
        <Story />
      </ClienteDeConsultaAislado>
    ),
  ],
};

export default preview;
