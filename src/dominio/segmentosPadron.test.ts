import { describe, expect, test } from 'vitest';
import {
  alternarGrupo,
  chipsDeGrupos,
  contactosDelGrupo,
  contactosSinGrupo,
  esNadieTodavia,
  grupoActivo,
  ID_NADIE_TODAVIA,
  opcionesDeReparto,
  type GrupoCondensado,
  type OpcionFaceta,
} from './segmentosPadron';

const CONVERSACION: GrupoCondensado = {
  id: 'conversacion',
  rotulo: 'En conversación',
  valores: ['interested', 'follow_up', 'recontact'],
};
const PERDIDO: GrupoCondensado = { id: 'perdido', rotulo: 'Se perdió', valores: ['lost'] };
const GRUPOS = [CONVERSACION, PERDIDO];

describe('un grupo condensado (Etapa, Nivel)', () => {
  test('suma los valores crudos que le corresponden, ignora los demás', () => {
    const opciones: OpcionFaceta[] = [
      { valor: 'interested', contactos: 658 },
      { valor: 'follow_up', contactos: 135 },
      { valor: 'recontact', contactos: 46 },
      { valor: 'lost', contactos: 7 },
      { valor: 'contacted', contactos: 61366 },
    ];
    expect(contactosDelGrupo(opciones, CONVERSACION)).toBe(658 + 135 + 46);
    expect(contactosDelGrupo(opciones, PERDIDO)).toBe(7);
  });

  test('sin ninguna opción (facetas sin cargar todavía), da cero y no explota', () => {
    expect(contactosDelGrupo(undefined, CONVERSACION)).toBe(0);
  });

  test('grupoActivo exige TODOS los valores del grupo, no alguno', () => {
    expect(grupoActivo(CONVERSACION, ['interested', 'follow_up', 'recontact'])).toBe(true);
    // Estado a medias — caché vieja de antes de agrupar (ADR 0007): la casilla
    // tiene que mostrarse VACÍA, no a medio marcar.
    expect(grupoActivo(CONVERSACION, ['interested'])).toBe(false);
    expect(grupoActivo(CONVERSACION, undefined)).toBe(false);
  });

  test('alternarGrupo prende TODOS sus valores de una', () => {
    expect(alternarGrupo(CONVERSACION, undefined)).toEqual(['interested', 'follow_up', 'recontact']);
  });

  test('un estado A MEDIAS (caché vieja) cuenta como apagado: tocarlo lo completa, no lo vacía', () => {
    // `grupoActivo` exige TODOS los valores — con solo «interested» puesto la
    // casilla se ve destildada, así que tocarla la TILDA (agrega los otros
    // dos), igual que cualquier checkbox destildado.
    expect(alternarGrupo(CONVERSACION, ['interested', 'sold']).sort()).toEqual(
      ['follow_up', 'interested', 'recontact', 'sold'].sort(),
    );
  });

  test('apagar un grupo no toca los valores de OTRO grupo ya puesto', () => {
    const actuales = alternarGrupo(CONVERSACION, undefined);
    const conLosDos = alternarGrupo(PERDIDO, actuales);
    expect(conLosDos.sort()).toEqual(['follow_up', 'interested', 'lost', 'recontact'].sort());
    const soloConversacion = alternarGrupo(PERDIDO, conLosDos);
    expect(soloConversacion.sort()).toEqual(['follow_up', 'interested', 'recontact'].sort());
  });

  test('contactosSinGrupo: lo que ningún grupo publicado cubre', () => {
    const opciones: OpcionFaceta[] = [
      { valor: 'interested', contactos: 658 },
      { valor: 'lost', contactos: 7 },
      { valor: 'contacted', contactos: 61366 },
    ];
    // `contacted` no está en GRUPOS: cae del lado de «sin grupo».
    expect(contactosSinGrupo(61366 + 658 + 7, opciones, GRUPOS)).toBe(61366);
  });

  test('contactosSinGrupo nunca da negativo', () => {
    // Un total desactualizado (llegó de una consulta anterior) no puede
    // dibujar «−4 contactos»: es peor que un cero.
    expect(contactosSinGrupo(0, [{ valor: 'interested', contactos: 658 }], GRUPOS)).toBe(0);
  });

  test('chipsDeGrupos: un chip por grupo activo, con su rótulo humano', () => {
    const chips = chipsDeGrupos('etapa', GRUPOS, ['interested', 'follow_up', 'recontact']);
    expect(chips).toEqual([{ llave: 'etapa:conversacion', rotulo: 'En conversación', quitar: expect.any(Function) }]);
  });

  test('chipsDeGrupos deja ver, sin rótulo lindo, un valor que quedó sin grupo', () => {
    // Caché vieja de antes de esta versión (ADR 0007), o un valor de icarus
    // que ningún grupo cubre todavía — un chip feo es mejor que un filtro
    // puesto que no se ve en ningún lado.
    const chips = chipsDeGrupos('etapa', GRUPOS, ['sold']);
    expect(chips).toEqual([{ llave: 'etapa:sold', rotulo: 'sold', quitar: expect.any(Function) }]);
  });

  test('el `quitar` de un chip de grupo saca TODOS sus valores', () => {
    const chips = chipsDeGrupos('etapa', GRUPOS, ['interested', 'follow_up', 'recontact', 'lost']);
    const deConversacion = chips.find((c) => c.llave === 'etapa:conversacion')!;
    expect(deConversacion.quitar(['interested', 'follow_up', 'recontact', 'lost'])).toEqual(['lost']);
  });
});

describe('el control unificado de Reparto', () => {
  test('«Nadie todavía» va PRIMERO, con el conteo de `sinRepartir`', () => {
    const filas = opcionesDeReparto({
      opciones: [{ valor: 'luz', contactos: 877 }],
      sinRepartir: 61506,
    });
    expect(filas[0]).toEqual({ id: ID_NADIE_TODAVIA, rotulo: 'Nadie todavía', contactos: 61506 });
  });

  test('las vendedoras llevan el nombre corto, no la grafía cruda', () => {
    const filas = opcionesDeReparto({
      opciones: [{ valor: 'ventas11@grupogoberna.com', contactos: 3383 }],
      sinRepartir: 0,
    });
    expect(filas[1].rotulo).toBe('Ventas11');
  });

  test('sin faceta todavía (cargando), lista vacía y no explota', () => {
    expect(opcionesDeReparto(undefined)).toEqual([]);
  });

  test('esNadieTodavia distingue la fila especial de una vendedora real', () => {
    const [nadie, vendedora] = opcionesDeReparto({
      opciones: [{ valor: 'luz', contactos: 877 }],
      sinRepartir: 61506,
    });
    expect(esNadieTodavia(nadie)).toBe(true);
    expect(esNadieTodavia(vendedora)).toBe(false);
  });
});
