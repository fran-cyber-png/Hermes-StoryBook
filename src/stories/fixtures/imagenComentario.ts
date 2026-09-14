/**
 * SVG embebidos para las historias de `canales` que muestran imágenes de Meta
 * (post, adjunto). Las URLs reales del CDN de Facebook vencen (`oe=`/`oh=`) y no
 * se guardan — mismo motivo que documenta `galeriaPanelCompleto.tsx`. Estos SVG
 * son sólo para juzgar el encuadre en Storybook, no una captura real.
 */
const svg = (cuerpo: string, w: number, h: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${cuerpo}</svg>`);

export const imagenDePost = svg(
  `<rect width="640" height="360" fill="#0E2A52"/>
   <rect x="0" y="0" width="640" height="70" fill="#F2C230"/>
   <text x="24" y="50" fill="#0E2A52" font-family="sans-serif" font-size="30" font-weight="bold">¡ÁNCASH MERECE LO BUENO!</text>
   <circle cx="150" cy="220" r="70" fill="#123B6D"/>
   <text x="330" y="180" fill="#ffffff" font-family="sans-serif" font-size="22">Obras que permanezcan</text>
   <text x="330" y="215" fill="#ffffff" font-family="sans-serif" font-size="22">y un futuro seguro</text>`,
  640,
  360,
);

export const avatarDePagina = svg(
  `<rect width="64" height="64" fill="#123B6D"/>
   <text x="50%" y="60%" fill="#F2C230" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle">BB</text>`,
  64,
  64,
);

export const gifDeReaccion = svg(
  `<rect width="320" height="240" fill="#B91C1C"/>
   <circle cx="160" cy="95" r="46" fill="#111827"/>
   <text x="160" y="180" fill="#ffffff" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">VICTORY!</text>`,
  320,
  240,
);
