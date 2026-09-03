# Hermes StoryBook

Design system de **Hermes** (el CRM de la Escuela de Goberna) montado en [Storybook](https://storybook.js.org/),
con los componentes reales del front (`src/`) — no reimplementaciones.

Trabajado en orden atómico: **Átomos → Moléculas** primero (Organismos, Templates y Páginas quedan para después).

## Correr en local

```bash
npm install
npm run storybook   # http://localhost:6006
```

## Qué hay acá

- `.storybook/` — configuración (framework `@storybook/react-vite`, addons `a11y`, `docs`, `vitest`).
- `src/stories/` — las historias, organizadas por capa atómica y por feature.
- `src/` — el resto del front de Hermes (`components/`, `features/`, `dominio/`, `lib/`), tal como vive en el
  repo principal: las historias importan los componentes reales desde acá, no copias.

Este repo es un recorte **solo del frontend** del monorepo de Hermes (`Goberna-Lab/hermes`) — no incluye el
server (Express/Drizzle), el shell de escritorio (Tauri) ni la documentación de negocio. Sirve para iterar el
sistema de diseño con pruebas visuales, de interacción y de funcionamiento, sin tocar el repo de producción.
