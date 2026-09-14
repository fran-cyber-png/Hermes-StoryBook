import { describe, expect, test } from 'vitest';
import { atencionDe, muestraChipDeRiesgo } from './dimensiones';

/**
 * LA ATENCIÓN Y EL CHIP DE RIESGO — las dos reglas del front que no son un tipo.
 *
 * 🔴 La atención es de TRES valores y el caso que importa es el tercero: «le
 * escribimos y nunca contestó» era 2.580 de 3.973 conversaciones el 8-ago-2026,
 * el peldaño más grande del embudo. Sin `hablo`, `respondida` lo confunde con
 * «contestó» — porque una conversación sin ningún entrante da `respondida = true`.
 */

describe('atencionDe', () => {
  test('🔴 sin entrantes y con salientes: NUNCA contestó, no «contestó»', () => {
    expect(atencionDe({ respondida: true, hablo: false, yaLeHablamos: true })).toBe(
      'nunca_contesto',
    );
  });

  test('habló y le contestamos: contestó', () => {
    expect(atencionDe({ respondida: true, hablo: true, yaLeHablamos: true })).toBe('contesto');
  });

  test('habló y no le contestamos: te espera', () => {
    expect(atencionDe({ respondida: false, hablo: true, yaLeHablamos: true })).toBe('te_espera');
  });

  test('⚠️ sin `hablo` no se inventa un «nunca contestó»', () => {
    // Un server viejo o una respuesta rehidratada del caché de IndexedDB no lo
    // trae. Ausente se comporta como siempre: se prefiere no afirmar de más.
    expect(atencionDe({ respondida: true })).toBe('contesto');
    expect(atencionDe({ respondida: false })).toBe('te_espera');
  });
});

describe('muestraChipDeRiesgo', () => {
  test('🔴 no se dibuja si lo prende el MISMO mensaje que fijó la postura', () => {
    // Repetiría lo que la postura ya dice, ocupando lugar sin agregar nada.
    expect(
      muestraChipDeRiesgo({ riesgo: true, riesgo_evidencia: '10', postura_evidencia: '10' }),
    ).toBe(false);
  });

  test('se dibuja cuando el riesgo viene de OTRO mensaje', () => {
    expect(
      muestraChipDeRiesgo({ riesgo: true, riesgo_evidencia: '11', postura_evidencia: '10' }),
    ).toBe(true);
  });

  test('sin riesgo vigente no hay chip, aunque haya evidencia vieja', () => {
    expect(
      muestraChipDeRiesgo({ riesgo: false, riesgo_evidencia: '11', postura_evidencia: '10' }),
    ).toBe(false);
  });

  test('🔴 lee la fila CON LOS NOMBRES QUE EMITE EL SERVER, y en ventas vienen en null', () => {
    // Una fila de campaña tal como la arma consultarCola. Si la función volviera
    // a leer camelCase, las dos evidencias serían `undefined`, iguales entre sí, y
    // el chip no se prendería nunca: este caso se pone rojo.
    const deCampana = { riesgo: true, riesgo_evidencia: '11', postura_evidencia: '10' };
    expect(muestraChipDeRiesgo(deCampana)).toBe(true);
    const deVentas = { riesgo: null, riesgo_evidencia: null, postura_evidencia: null };
    expect(muestraChipDeRiesgo(deVentas)).toBe(false);
  });
});
