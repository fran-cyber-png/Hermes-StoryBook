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
  parameters: {
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
