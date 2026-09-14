import type { DatosNegocio } from './negocio';

/**
 * LOS DATOS DE «EL NEGOCIO» PARA LA GALERÍA — con la forma de los problemas
 * REALES, no del caso ideal (regla dura #10).
 *
 * 🔴 **Hasta el 8-sep-2026 esta ruta se stubeaba con `{ porCurso, porAnuncio,
 * totales, periodo }`**, que no es ningún campo de `DatosNegocio`: o sea que el
 * panel entero se dibujaba vacío y la galería no era evidencia de nada. Es
 * exactamente lo que la regla dura #10 dice que pasa cuando la galería no sirve
 * lo que sirve producción.
 *
 * Lo que estos números están puestos para que se VEA sin que nadie lea:
 *
 *   · La fila SIN NOMBRE es la más grande de todas. No es relleno: es la
 *     cobertura parcial de «quién atendió» dicha en voz alta — un comentario de
 *     Facebook o Instagram se contesta por un camino que todavía no registra
 *     quién fue. Si algún día alguien la esconde, la tabla empieza a mentir y
 *     acá se nota de una.
 *   · Las medianas son DISPARES a propósito (8 min contra 3 h): el panel existe
 *     para que esa diferencia salte, y con tres números parecidos no se puede
 *     saber si la columna sirve.
 *   · Quien más rápido contesta no es quien más cierra, y quien más volumen
 *     tiene es quien peor responde. Un ranking donde todo ordena igual no
 *     prueba que las columnas sean independientes.
 */

const fila = (
  clave: string | null,
  llegaron: number,
  esperan: number,
  nunca: number,
  demora: number | null,
  cotizados: number,
  cerrados: number,
) => ({
  clave,
  familia: null,
  ad_id: null,
  fuente_campana: null,
  llegaron,
  respondidos: llegaron - nunca,
  nunca_respondidos: nunca,
  esperan,
  demora_mediana_min: demora,
  cotizados,
  cerrados,
  precio_mencionado: Math.round(cotizados * 1.4),
});

const celda = (
  filaDe: string | null,
  parte: string | null,
  llegaron: number,
  esperan: number,
  nunca: number,
  demora: number | null,
  cerrados: number,
) => ({ fila: filaDe, parte, llegaron, esperan, nunca_respondidos: nunca, demora_mediana_min: demora, cerrados });

export const NEGOCIO_POR_VENDEDORA: DatosNegocio = {
  rango: { desde: '2026-09-01T05:00:00.000Z', hasta: '2026-09-08T05:00:00.000Z' },
  periodo: '7d',
  numeros: ['51999888777', '51999111222'],
  numero_propio: null,
  dimension: 'vendedora',
  atencion: {
    conversaciones: 890,
    esperan: 555,
    nunca_respondidos: 495,
    sin_atender_24h: 411,
    demora_mediana_en_horario_min: 34.5,
    demora_mediana_fuera_min: 622.0,
    llegaron_fuera_de_horario: 391,
    cobertura: Array.from({ length: 24 }, (_, hora) => ({
      hora,
      entran: [31, 18, 9, 4, 2, 3, 7, 19, 44, 61, 73, 68, 55, 71, 79, 66, 58, 62, 74, 81, 77, 63, 49, 38][hora],
      salen: [0, 0, 0, 0, 0, 0, 0, 2, 27, 58, 71, 66, 41, 63, 74, 69, 57, 54, 48, 21, 6, 1, 0, 0][hora],
    })),
  },
  filas: [
    // La más grande no tiene dueña: nadie contestó desde Hermes.
    fila(null, 402, 388, 402, null, 0, 0),
    fila('luz', 218, 64, 31, 42.5, 58, 6),
    fila('sindy', 174, 91, 58, 187.0, 33, 2),
    fila('tracy', 96, 12, 4, 8.5, 41, 9),
  ],
  desglose: [
    celda('luz', 'DIPICOT', 121, 30, 12, 38.0, 4),
    celda('luz', 'Gestión Municipal', 64, 21, 11, 51.5, 2),
    celda('luz', null, 33, 13, 8, 44.0, 0),
    celda('sindy', 'DIPICOT', 88, 44, 29, 201.0, 1),
    celda('sindy', 'Marketing Político', 51, 28, 18, 166.5, 1),
    celda('sindy', null, 35, 19, 11, 174.0, 0),
    celda('tracy', 'Gestión Municipal', 58, 6, 2, 7.0, 6),
    celda('tracy', 'DIPICOT', 38, 6, 2, 11.0, 3),
    celda(null, null, 402, 388, 402, null, 0),
  ],
  sin_atribuir: 402,
  subregistro: { cotizados: 132, precio_mencionado: 186 },
};

/**
 * LA MISMA MESA, LEÍDA POR CURSO — y con el desglose al revés: cada curso
 * abierto dice qué vendedora lo atiende y cuánto tarda.
 *
 * Los totales de las filas son los MISMOS 890 leads y los mismos 402 sin
 * atribuir que `NEGOCIO_POR_VENDEDORA`: son dos cortes del mismo universo, y si
 * no cerraran igual la galería estaría enseñando a desconfiar de los números.
 */
export const NEGOCIO_POR_CURSO: DatosNegocio = {
  ...NEGOCIO_POR_VENDEDORA,
  dimension: 'curso',
  filas: [
    fila(null, 402, 388, 402, null, 0, 0),
    fila('DIPICOT', 247, 80, 43, 62.0, 71, 8),
    fila('Gestión Municipal', 122, 27, 13, 22.0, 38, 8),
    fila('Marketing Político', 119, 60, 37, 166.5, 23, 1),
  ],
  desglose: [
    celda('DIPICOT', 'luz', 121, 30, 12, 38.0, 4),
    celda('DIPICOT', 'sindy', 88, 44, 29, 201.0, 1),
    celda('DIPICOT', 'tracy', 38, 6, 2, 11.0, 3),
    celda('Gestión Municipal', 'tracy', 58, 6, 2, 7.0, 6),
    celda('Gestión Municipal', 'luz', 64, 21, 11, 51.5, 2),
    celda('Marketing Político', 'sindy', 51, 28, 18, 166.5, 1),
    celda('Marketing Político', null, 68, 32, 19, null, 0),
    celda(null, null, 402, 388, 402, null, 0),
  ],
};

/**
 * Y POR ANUNCIO — el mismo universo otra vez, con los títulos como los escribe
 * Meta (corchetes, mes, canal) y su `adId`. Deliberadamente feos: así se ven en
 * producción, y el panel tiene que aguantar que no entren en la columna.
 */
export const NEGOCIO_POR_ANUNCIO: DatosNegocio = {
  ...NEGOCIO_POR_VENDEDORA,
  dimension: 'anuncio',
  filas: [
    { ...fila(null, 402, 388, 402, null, 0, 0), ad_id: null },
    { ...fila('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 186, 62, 34, 58.0, 54, 6), ad_id: '120219043871250412' },
    { ...fila('[SEP] GESTIÓN MUNICIPAL — ADV 3', 122, 27, 13, 22.0, 38, 8), ad_id: '120219043871250688' },
    { ...fila('[AGO] MKT POLÍTICO | remarketing', 180, 78, 46, 171.0, 40, 3), ad_id: '120218877401250199' },
  ],
  desglose: [
    celda('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 'luz', 98, 25, 10, 36.0, 4),
    celda('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 'sindy', 62, 31, 22, 188.0, 1),
    celda('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 'tracy', 26, 6, 2, 10.0, 1),
    celda('[SEP] GESTIÓN MUNICIPAL — ADV 3', 'tracy', 58, 6, 2, 7.0, 6),
    celda('[SEP] GESTIÓN MUNICIPAL — ADV 3', 'luz', 64, 21, 11, 51.5, 2),
    celda('[AGO] MKT POLÍTICO | remarketing', 'sindy', 51, 28, 18, 166.5, 1),
    celda('[AGO] MKT POLÍTICO | remarketing', null, 129, 50, 28, null, 2),
    celda(null, null, 402, 388, 402, null, 0),
  ],
};

/**
 * POR CAMPAÑA (S.4) — con las TRES fuentes a la vez, a propósito: si la
 * galería sólo mostrara «ruteo», una fila resuelta por `anuncio_resuelto` o
 * por `leads.campaign_name` podría dibujarse mal sin que nadie lo note.
 */
export const NEGOCIO_POR_CAMPANA: DatosNegocio = {
  ...NEGOCIO_POR_VENDEDORA,
  dimension: 'campana',
  filas: [
    { ...fila(null, 402, 388, 402, null, 0, 0) },
    { ...fila('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 186, 62, 34, 58.0, 54, 6), fuente_campana: 'ruteo' },
    { ...fila('Gestión Municipal — reposicionamiento', 122, 27, 13, 22.0, 38, 8), fuente_campana: 'resuelto' },
    { ...fila('Marketing Político 2026', 180, 78, 46, 171.0, 40, 3), fuente_campana: 'formulario' },
  ],
  desglose: [
    celda('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 'luz', 98, 25, 10, 36.0, 4),
    celda('[SEP] INTELIGENCIA Y CONTRAINTELIGENCIA | WSP', 'sindy', 62, 31, 22, 188.0, 1),
    celda('Gestión Municipal — reposicionamiento', 'tracy', 58, 6, 2, 7.0, 6),
    celda('Marketing Político 2026', 'sindy', 51, 28, 18, 166.5, 1),
    celda('Marketing Político 2026', null, 129, 50, 28, null, 2),
    celda(null, null, 402, 388, 402, null, 0),
  ],
};

/** POR LÍNEA (S.4) — el `numero_propio` que hoy sólo filtra, ahora también agrupa. */
export const NEGOCIO_POR_LINEA: DatosNegocio = {
  ...NEGOCIO_POR_VENDEDORA,
  dimension: 'linea',
  filas: [
    fila('51999888777', 612, 401, 350, 38.0, 96, 12),
    fila('51999111222', 278, 154, 145, 172.0, 36, 5),
  ],
  desglose: [
    celda('51999888777', 'luz', 210, 60, 28, 40.0, 4),
    celda('51999888777', 'sindy', 160, 88, 55, 190.0, 1),
    celda('51999888777', null, 242, 253, 267, null, 0),
    celda('51999111222', 'tracy', 96, 12, 4, 8.5, 9),
    celda('51999111222', null, 182, 142, 141, null, 0),
  ],
  sin_atribuir: 0,
};

/** POR CANAL (S.4) — el 65 % de lo que entra a la fila «Sin vendedora» es Facebook e Instagram. */
export const NEGOCIO_POR_CANAL: DatosNegocio = {
  ...NEGOCIO_POR_VENDEDORA,
  dimension: 'canal',
  filas: [
    fila('whatsapp', 401, 154, 71, 34.5, 121, 17),
    fila('facebook', 312, 218, 245, null, 8, 0),
    fila('instagram', 133, 96, 108, null, 3, 0),
    fila('messenger', 44, 31, 33, null, 0, 0),
  ],
  desglose: [
    celda('whatsapp', 'luz', 218, 64, 31, 42.5, 6),
    celda('whatsapp', 'sindy', 174, 91, 58, 187.0, 2),
    celda('whatsapp', null, 9, 8, 6, null, 0),
    celda('facebook', null, 312, 218, 245, null, 0),
    celda('instagram', null, 133, 96, 108, null, 0),
    celda('messenger', null, 44, 31, 33, null, 0),
  ],
  sin_atribuir: 0,
};
