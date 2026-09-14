import type { Escucha } from './campana';

/**
 * LA ESCUCHA DE LA GALERÍA — los valores REALES de la campaña de Betto.
 *
 * ══ 🔴 POR QUÉ ESTE ARCHIVO EXISTE ═════════════════════════════════════════
 *
 * Hasta el 4-sep-2026 la respuesta de `/api/dashboard/campana` de la galería no
 * traía la clave `escucha`, así que `PanelEscucha` devolvía `null` y **el panel
 * entero era invisible ahí**. Con la regla dura #10 en la mano eso no es un
 * detalle: la única forma de volver a ver la escucha era levantar la base local
 * con los 27.313 mensajes clasificados de Betto. Sin esto, dentro de un mes
 * nadie puede revisar este trabajo.
 *
 * ══ ⚠️ SON LOS NÚMEROS DE LA BASE, NO NÚMEROS LINDOS ═══════════════════════
 *
 * Salieron de `GET /api/dashboard/campana?periodo=30d` contra el corpus real
 * (ventana 2026-08-06T05:00Z → 2026-09-05T05:00Z) y están enteros, no podados a
 * las seis filas que el panel dibuja: los rótulos «de 13 temas» y «de 20
 * provincias» cuentan la lista COMPLETA, así que recortarla acá rompería justo
 * lo que esos rótulos vinieron a arreglar.
 *
 * El repo ya se comió tres defectos escondidos detrás de un caso ideal, y este
 * corpus trae solo los casos incómodos que hacen falta:
 *
 *   · **Instagram en CERO** — no recibe un comentario desde julio de 2025, así
 *     que su chip no se ofrece (`canalesConAlgo`) y la galería prueba que no
 *     aparece un «Instagram 0» invitando a abrir una pantalla vacía.
 *   · **`pro_rival` casi todo fuera de la sustancia** — 30 marcados y 27 fuera.
 *     Es el defecto que originó la corrección de ADR 0092, y con estos números
 *     el bloque «Cuánto de esto sirve» se puede leer y verificar a ojo.
 *   · **Messenger con 307 sobre 6.082** — el canal chico al lado del grande, que
 *     es donde se ve si el filtro por canal sirve de algo.
 *   · **Los dos universos peleados**: el resto del fixture de campaña dice 608
 *     entrantes y esto dice 6.082, porque miden cosas distintas a propósito. Es
 *     exactamente la confusión que la línea de `explicacionDelUniverso` explica.
 */
export const ESCUCHA_DE_BETTO: Escucha = {
  estado: 'ok',
  cliente: 'betto',
  version: 1,
  // El script corrió entero: en la base real es 0 en los cuatro períodos. El
  // caso con atraso va aparte, abajo, porque no se puede capturar de otra forma.
  pendientes: 0,
  canales: {
    todas: {
      total: 6082,
      sustancia: 842,
      temas: [
        { clave: 'obras', nombre: 'Obras en general', n: 75 },
        { clave: 'vias', nombre: 'Carreteras y vías', n: 65 },
        { clave: 'agua', nombre: 'Agua y saneamiento', n: 61 },
        { clave: 'salud', nombre: 'Salud', n: 47 },
        { clave: 'agro', nombre: 'Agro y riego', n: 45 },
        { clave: 'pesca', nombre: 'Pesca artesanal', n: 32 },
        { clave: 'juventud', nombre: 'Jóvenes', n: 30 },
        { clave: 'educacion', nombre: 'Educación', n: 25 },
        { clave: 'empleo', nombre: 'Empleo', n: 21 },
        { clave: 'seguridad', nombre: 'Seguridad', n: 12 },
        { clave: 'turismo', nombre: 'Turismo', n: 7 },
        { clave: 'mineria', nombre: 'Minería', n: 6 },
        { clave: 'electricidad', nombre: 'Electrificación', n: 4 },
      ],
      lugares: [
        { clave: 'chimbote', nombre: 'Chimbote', n: 91, esProvincia: false },
        { clave: 'huarmey', nombre: 'Huarmey', n: 73, esProvincia: true },
        { clave: 'huaraz', nombre: 'Huaraz', n: 55, esProvincia: true },
        { clave: 'sihuas', nombre: 'Sihuas', n: 41, esProvincia: true },
        { clave: 'santa', nombre: 'Santa', n: 37, esProvincia: true },
        { clave: 'nuevo chimbote', nombre: 'Nuevo Chimbote', n: 32, esProvincia: false },
        { clave: 'casma', nombre: 'Casma', n: 27, esProvincia: true },
        { clave: 'yungay', nombre: 'Yungay', n: 27, esProvincia: true },
        { clave: 'coishco', nombre: 'Coishco', n: 22, esProvincia: false },
        { clave: 'huari', nombre: 'Huari', n: 22, esProvincia: true },
        { clave: 'culebras', nombre: 'Culebras', n: 17, esProvincia: false },
        { clave: 'carhuaz', nombre: 'Carhuaz', n: 16, esProvincia: true },
        { clave: 'quillo', nombre: 'Quillo', n: 15, esProvincia: false },
        { clave: 'antonio raimondi', nombre: 'Antonio Raimondi', n: 15, esProvincia: true },
        { clave: 'mancos', nombre: 'Mancos', n: 14, esProvincia: false },
        { clave: 'pomabamba', nombre: 'Pomabamba', n: 12, esProvincia: true },
        { clave: 'yaután', nombre: 'Yaután', n: 11, esProvincia: false },
        { clave: 'caraz', nombre: 'Caraz', n: 9, esProvincia: false },
        { clave: 'bolognesi', nombre: 'Bolognesi', n: 8, esProvincia: true },
        { clave: 'corongo', nombre: 'Corongo', n: 8, esProvincia: true },
        { clave: 'recuay', nombre: 'Recuay', n: 6, esProvincia: true },
        { clave: 'mirgas', nombre: 'Mirgas', n: 5, esProvincia: false },
        { clave: 'pallasca', nombre: 'Pallasca', n: 5, esProvincia: true },
        { clave: 'carlos fermín fitzcarrald', nombre: 'Carlos Fermín Fitzcarrald', n: 5, esProvincia: true },
        { clave: 'piscobamba', nombre: 'Piscobamba', n: 4, esProvincia: false },
        { clave: 'asunción', nombre: 'Asunción', n: 4, esProvincia: true },
        { clave: 'huaylas', nombre: 'Huaylas', n: 4, esProvincia: true },
        { clave: 'tarica', nombre: 'Tarica', n: 3, esProvincia: false },
        { clave: 'marcará', nombre: 'Marcará', n: 3, esProvincia: false },
        { clave: 'cátac', nombre: 'Cátac', n: 3, esProvincia: false },
        { clave: 'pariacoto', nombre: 'Pariacoto', n: 3, esProvincia: false },
        { clave: 'moro', nombre: 'Moro', n: 3, esProvincia: false },
        { clave: 'aija', nombre: 'Aija', n: 3, esProvincia: true },
        { clave: 'mariscal luzuriaga', nombre: 'Mariscal Luzuriaga', n: 3, esProvincia: true },
        { clave: 'san marcos', nombre: 'San Marcos', n: 3, esProvincia: false },
        { clave: 'independencia', nombre: 'Independencia', n: 2, esProvincia: false },
        { clave: 'ocros', nombre: 'Ocros', n: 2, esProvincia: true },
        { clave: 'huallabamba', nombre: 'Huallabamba', n: 1, esProvincia: false },
        { clave: 'chiquián', nombre: 'Chiquián', n: 1, esProvincia: false },
        { clave: 'yuramarca', nombre: 'Yuramarca', n: 1, esProvincia: false },
      ],
      marcas: { sustancia: 842, pro_rival: 30, vacio: 285, ataque: 62, escepticismo: 10, hinchada: 4955, pedido: 157, apoyo: 3723, ataque_al_candidato: 31 },
    },
    muro: {
      total: 4403,
      sustancia: 514,
      temas: [
        { clave: 'obras', nombre: 'Obras en general', n: 65 },
        { clave: 'pesca', nombre: 'Pesca artesanal', n: 28 },
        { clave: 'vias', nombre: 'Carreteras y vías', n: 28 },
        { clave: 'juventud', nombre: 'Jóvenes', n: 19 },
        { clave: 'agro', nombre: 'Agro y riego', n: 17 },
        { clave: 'empleo', nombre: 'Empleo', n: 15 },
        { clave: 'salud', nombre: 'Salud', n: 15 },
        { clave: 'agua', nombre: 'Agua y saneamiento', n: 14 },
        { clave: 'educacion', nombre: 'Educación', n: 6 },
        { clave: 'mineria', nombre: 'Minería', n: 5 },
        { clave: 'turismo', nombre: 'Turismo', n: 4 },
        { clave: 'seguridad', nombre: 'Seguridad', n: 3 },
        { clave: 'electricidad', nombre: 'Electrificación', n: 1 },
      ],
      lugares: [
        { clave: 'huarmey', nombre: 'Huarmey', n: 54, esProvincia: true },
        { clave: 'chimbote', nombre: 'Chimbote', n: 51, esProvincia: false },
        { clave: 'huaraz', nombre: 'Huaraz', n: 27, esProvincia: true },
        { clave: 'sihuas', nombre: 'Sihuas', n: 22, esProvincia: true },
        { clave: 'nuevo chimbote', nombre: 'Nuevo Chimbote', n: 20, esProvincia: false },
        { clave: 'casma', nombre: 'Casma', n: 18, esProvincia: true },
        { clave: 'culebras', nombre: 'Culebras', n: 17, esProvincia: false },
        { clave: 'coishco', nombre: 'Coishco', n: 17, esProvincia: false },
        { clave: 'santa', nombre: 'Santa', n: 15, esProvincia: true },
        { clave: 'antonio raimondi', nombre: 'Antonio Raimondi', n: 10, esProvincia: true },
        { clave: 'mancos', nombre: 'Mancos', n: 10, esProvincia: false },
        { clave: 'yaután', nombre: 'Yaután', n: 9, esProvincia: false },
        { clave: 'yungay', nombre: 'Yungay', n: 9, esProvincia: true },
        { clave: 'pomabamba', nombre: 'Pomabamba', n: 8, esProvincia: true },
        { clave: 'quillo', nombre: 'Quillo', n: 7, esProvincia: false },
        { clave: 'huari', nombre: 'Huari', n: 7, esProvincia: true },
        { clave: 'caraz', nombre: 'Caraz', n: 5, esProvincia: false },
        { clave: 'carhuaz', nombre: 'Carhuaz', n: 5, esProvincia: true },
        { clave: 'mirgas', nombre: 'Mirgas', n: 4, esProvincia: false },
        { clave: 'pallasca', nombre: 'Pallasca', n: 4, esProvincia: true },
        { clave: 'bolognesi', nombre: 'Bolognesi', n: 3, esProvincia: true },
        { clave: 'recuay', nombre: 'Recuay', n: 3, esProvincia: true },
        { clave: 'huaylas', nombre: 'Huaylas', n: 3, esProvincia: true },
        { clave: 'independencia', nombre: 'Independencia', n: 2, esProvincia: false },
        { clave: 'moro', nombre: 'Moro', n: 2, esProvincia: false },
        { clave: 'asunción', nombre: 'Asunción', n: 2, esProvincia: true },
        { clave: 'pariacoto', nombre: 'Pariacoto', n: 2, esProvincia: false },
        { clave: 'cátac', nombre: 'Cátac', n: 1, esProvincia: false },
        { clave: 'huallabamba', nombre: 'Huallabamba', n: 1, esProvincia: false },
        { clave: 'tarica', nombre: 'Tarica', n: 1, esProvincia: false },
        { clave: 'ocros', nombre: 'Ocros', n: 1, esProvincia: true },
        { clave: 'aija', nombre: 'Aija', n: 1, esProvincia: true },
        { clave: 'carlos fermín fitzcarrald', nombre: 'Carlos Fermín Fitzcarrald', n: 1, esProvincia: true },
        { clave: 'piscobamba', nombre: 'Piscobamba', n: 1, esProvincia: false },
      ],
      marcas: { pro_rival: 30, escepticismo: 9, hinchada: 3712, vacio: 177, pedido: 68, sustancia: 514, ataque_al_candidato: 25, ataque: 53, apoyo: 3387 },
    },
    whatsapp: {
      total: 1372,
      sustancia: 300,
      temas: [
        { clave: 'agua', nombre: 'Agua y saneamiento', n: 45 },
        { clave: 'vias', nombre: 'Carreteras y vías', n: 33 },
        { clave: 'salud', nombre: 'Salud', n: 29 },
        { clave: 'agro', nombre: 'Agro y riego', n: 26 },
        { clave: 'educacion', nombre: 'Educación', n: 15 },
        { clave: 'juventud', nombre: 'Jóvenes', n: 11 },
        { clave: 'seguridad', nombre: 'Seguridad', n: 8 },
        { clave: 'obras', nombre: 'Obras en general', n: 8 },
        { clave: 'empleo', nombre: 'Empleo', n: 5 },
        { clave: 'pesca', nombre: 'Pesca artesanal', n: 4 },
        { clave: 'electricidad', nombre: 'Electrificación', n: 3 },
        { clave: 'turismo', nombre: 'Turismo', n: 2 },
      ],
      lugares: [
        { clave: 'chimbote', nombre: 'Chimbote', n: 34, esProvincia: false },
        { clave: 'huaraz', nombre: 'Huaraz', n: 27, esProvincia: true },
        { clave: 'santa', nombre: 'Santa', n: 18, esProvincia: true },
        { clave: 'sihuas', nombre: 'Sihuas', n: 18, esProvincia: true },
        { clave: 'yungay', nombre: 'Yungay', n: 18, esProvincia: true },
        { clave: 'huarmey', nombre: 'Huarmey', n: 17, esProvincia: true },
        { clave: 'huari', nombre: 'Huari', n: 14, esProvincia: true },
        { clave: 'nuevo chimbote', nombre: 'Nuevo Chimbote', n: 11, esProvincia: false },
        { clave: 'carhuaz', nombre: 'Carhuaz', n: 9, esProvincia: true },
        { clave: 'casma', nombre: 'Casma', n: 7, esProvincia: true },
        { clave: 'quillo', nombre: 'Quillo', n: 7, esProvincia: false },
        { clave: 'corongo', nombre: 'Corongo', n: 6, esProvincia: true },
        { clave: 'coishco', nombre: 'Coishco', n: 5, esProvincia: false },
        { clave: 'bolognesi', nombre: 'Bolognesi', n: 5, esProvincia: true },
        { clave: 'caraz', nombre: 'Caraz', n: 4, esProvincia: false },
        { clave: 'antonio raimondi', nombre: 'Antonio Raimondi', n: 4, esProvincia: true },
        { clave: 'pomabamba', nombre: 'Pomabamba', n: 4, esProvincia: true },
        { clave: 'carlos fermín fitzcarrald', nombre: 'Carlos Fermín Fitzcarrald', n: 4, esProvincia: true },
        { clave: 'mancos', nombre: 'Mancos', n: 4, esProvincia: false },
        { clave: 'piscobamba', nombre: 'Piscobamba', n: 3, esProvincia: false },
        { clave: 'recuay', nombre: 'Recuay', n: 3, esProvincia: true },
        { clave: 'mariscal luzuriaga', nombre: 'Mariscal Luzuriaga', n: 3, esProvincia: true },
        { clave: 'san marcos', nombre: 'San Marcos', n: 3, esProvincia: false },
        { clave: 'tarica', nombre: 'Tarica', n: 2, esProvincia: false },
        { clave: 'marcará', nombre: 'Marcará', n: 2, esProvincia: false },
        { clave: 'asunción', nombre: 'Asunción', n: 2, esProvincia: true },
        { clave: 'cátac', nombre: 'Cátac', n: 2, esProvincia: false },
        { clave: 'yaután', nombre: 'Yaután', n: 2, esProvincia: false },
        { clave: 'aija', nombre: 'Aija', n: 2, esProvincia: true },
        { clave: 'pariacoto', nombre: 'Pariacoto', n: 1, esProvincia: false },
        { clave: 'pallasca', nombre: 'Pallasca', n: 1, esProvincia: true },
        { clave: 'huaylas', nombre: 'Huaylas', n: 1, esProvincia: true },
        { clave: 'moro', nombre: 'Moro', n: 1, esProvincia: false },
        { clave: 'ocros', nombre: 'Ocros', n: 1, esProvincia: true },
        { clave: 'mirgas', nombre: 'Mirgas', n: 1, esProvincia: false },
        { clave: 'chiquián', nombre: 'Chiquián', n: 1, esProvincia: false },
      ],
      marcas: { sustancia: 300, ataque: 9, pedido: 74, vacio: 58, escepticismo: 1, apoyo: 222, hinchada: 1014, ataque_al_candidato: 6 },
    },
    messenger: {
      total: 307,
      sustancia: 28,
      temas: [
        { clave: 'vias', nombre: 'Carreteras y vías', n: 4 },
        { clave: 'educacion', nombre: 'Educación', n: 4 },
        { clave: 'salud', nombre: 'Salud', n: 3 },
        { clave: 'agua', nombre: 'Agua y saneamiento', n: 2 },
        { clave: 'obras', nombre: 'Obras en general', n: 2 },
        { clave: 'agro', nombre: 'Agro y riego', n: 2 },
        { clave: 'empleo', nombre: 'Empleo', n: 1 },
        { clave: 'seguridad', nombre: 'Seguridad', n: 1 },
        { clave: 'turismo', nombre: 'Turismo', n: 1 },
        { clave: 'mineria', nombre: 'Minería', n: 1 },
      ],
      lugares: [
        { clave: 'chimbote', nombre: 'Chimbote', n: 6, esProvincia: false },
        { clave: 'santa', nombre: 'Santa', n: 4, esProvincia: true },
        { clave: 'carhuaz', nombre: 'Carhuaz', n: 2, esProvincia: true },
        { clave: 'huarmey', nombre: 'Huarmey', n: 2, esProvincia: true },
        { clave: 'casma', nombre: 'Casma', n: 2, esProvincia: true },
        { clave: 'corongo', nombre: 'Corongo', n: 2, esProvincia: true },
        { clave: 'huari', nombre: 'Huari', n: 1, esProvincia: true },
        { clave: 'quillo', nombre: 'Quillo', n: 1, esProvincia: false },
        { clave: 'antonio raimondi', nombre: 'Antonio Raimondi', n: 1, esProvincia: true },
        { clave: 'huaraz', nombre: 'Huaraz', n: 1, esProvincia: true },
        { clave: 'marcará', nombre: 'Marcará', n: 1, esProvincia: false },
        { clave: 'yuramarca', nombre: 'Yuramarca', n: 1, esProvincia: false },
        { clave: 'sihuas', nombre: 'Sihuas', n: 1, esProvincia: true },
        { clave: 'nuevo chimbote', nombre: 'Nuevo Chimbote', n: 1, esProvincia: false },
      ],
      marcas: { vacio: 50, hinchada: 229, apoyo: 114, pedido: 15, sustancia: 28 },
    },
    instagram: {
      total: 0,
      sustancia: 0,
      temas: [],
      lugares: [],
      marcas: {  },
    },  },
};

/**
 * EL MISMO PANEL, CON EL CLASIFICADOR ATRASADO (`?atraso=1`).
 *
 * 🔴 **ESTE ESTADO NO SE PUEDE CAPTURAR CON DATOS REALES**, y por eso la galería
 * lo ofrece: `campana:clasificar` ya corrió entero sobre la base local, así que
 * `pendientes` es 0 en los cuatro períodos y el aviso dorado no se dibuja nunca.
 * Producción sí lo alcanza apenas el script se atrasa —no corre solo, va al cron
 * o al deploy (ADR 0092 §«Lo que esto NO resuelve»)— y mientras el aviso no diga
 * cero, los porcentajes de arriba son de una muestra y no del total.
 *
 * ⚠️ **El número tampoco es inventado**: 205 es lo que entró en las últimas 24 h
 * de esa misma ventana (153 muro + 29 messenger + 23 whatsapp), o sea justo lo
 * que quedaría sin leer si nadie corriera el script por un día.
 */
export const ESCUCHA_CON_ATRASO: Escucha = { ...ESCUCHA_DE_BETTO, pendientes: 205 };
