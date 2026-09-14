import type { FilaDesglose } from '../../dominio/desglose';

/**
 * LA FOTO DE PRODUCCIÓN QUE SIRVE LA GALERÍA DEL PIPELINE — literal, no inventada.
 *
 * Medido el 2026-09-10T07:14:47.282Z con `GET /api/conversaciones/tablero?columnas=interesado,sin_respuesta,contactado,cotizado,cierre&limit=1 · sesión supervisora (gsifuentes, veTodo) · prod 973f8482`.
 * Setenta y dos filas etapa × ya-le-hablamos × precio × viva × ventana × para
 * seguir × se calló × luz, tal cual las devolvió el server, generadas desde el
 * JSON crudo (sin transcribir a mano).
 *
 * Existe por el candado 10: una galería que no sirve los valores REALES no es
 * evidencia. Cruces verificados sobre
 * estas mismas filas: «Nunca contestaron» = 769 ámbar + 6.736 grises · «Te
 * esperan» vivas = 98 · «Saben el precio» en ventana 455, para seguir 764, se
 * callaron 2.383 · «Compraron» = 86 · la mesa entera: 278 verdes, 5.052 ámbar,
 * 7.171 grises y 30 rojos.
 *
 * ⚠️ `nacioHoy` NO está: el server todavía no lo cuenta. La galería lo siembra
 * aparte con `?hoy=1` (ver `galeria.tsx`), dicho como lo que es.
 */
export const DESGLOSE_PROD_2026_09_10: FilaDesglose[] = [
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: true, luz: 'verde', n: 5 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'verde', n: 2 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 260 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: true, seCallo: false, luz: 'verde', n: 1 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'gris', n: 2 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: true, luz: 'verde', n: 25 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'ambar', n: 122 },
  { etapa: 'cierre', yaLeHablamos: true, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 1 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 313 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'ambar', n: 186 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 35 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 8 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 583 },
  { etapa: 'cierre', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 13 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'ambar', n: 7 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'rojo', n: 5 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 63 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 2 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: true, luz: 'ambar', n: 1 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 118 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'verde', n: 82 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'verde', n: 28 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: true, luz: 'ambar', n: 1528 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 2398 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'verde', n: 34 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'gris', n: 16 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'ambar', n: 92 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 6 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 10 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 95 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 8 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: true, luz: 'ambar', n: 226 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'rojo', n: 2 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 4030 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: true, luz: 'ambar', n: 596 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'rojo', n: 3 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: true, luz: 'gris', n: 2 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 21 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'gris', n: 3 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 17 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 29 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'rojo', n: 1 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'rojo', n: 1 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 10 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'gris', n: 2 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 5 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'gris', n: 59 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'rojo', n: 1 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: true, luz: 'ambar', n: 3 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'rojo', n: 15 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 13 },
  { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'gris', n: 3 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'gris', n: 2 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'rojo', n: 1 },
  { etapa: 'sin_respuesta', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'gris', n: 308 },
  { etapa: 'cierre', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 3 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 20 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: true, seCallo: false, luz: 'gris', n: 1 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 28 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: true, seCallo: false, luz: 'ambar', n: 11 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'verde', n: 2 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: false, luz: 'rojo', n: 1 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: true, ventana: true, paraSeguir: false, seCallo: false, luz: 'ambar', n: 63 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'verde', n: 12 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 517 },
  { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'ambar', n: 176 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 7 },
  { etapa: 'cierre', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'verde', n: 4 },
  { etapa: 'cierre', yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'ambar', n: 4 },
  { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, ventana: false, paraSeguir: false, seCallo: false, luz: 'gris', n: 251 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: true, paraSeguir: false, seCallo: true, luz: 'gris', n: 1 },
  { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, paraSeguir: true, seCallo: false, luz: 'verde', n: 28 },
];

/** Los conteos por etapa del mismo pedido. */
export const CONTEOS_PROD_2026_09_10: Record<string, number> = {"cotizado":3410,"contactado":421,"interesado":1109,"cierre":86,"sin_respuesta":7505};
