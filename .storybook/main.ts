import type { StorybookConfig } from '@storybook/react-vite';
import { syncHermesPlugin } from './syncHermes';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  // El plugin de sincronización solo agrega middleware al DEV SERVER (`configureServer`):
  // Vite lo ignora en `build-storybook`, así que el botón de Novedades no existe en un
  // Storybook estático publicado — tiene sentido solo corriendo local.
  async viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), syncHermesPlugin()];
    return viteConfig;
  },
};
export default config;
