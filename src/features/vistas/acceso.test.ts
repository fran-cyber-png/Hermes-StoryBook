import { describe, expect, it } from 'vitest';
import { entrena, entrenaYNoEsDeCampana, noEsDeCampana, VEN_ROUTING, veRouting } from './acceso';

describe('quién ve Routing', () => {
  it('la ven las dos personas de la lista', () => {
    expect(veRouting('alan')).toBe(true);
    expect(veRouting('Usuario1')).toBe(true);
  });

  it('no la ve nadie más', () => {
    expect(veRouting('luz')).toBe(false);
    expect(veRouting('ventas10@grupogoberna.com')).toBe(false);
  });

  /**
   * 🔴 EL CASO QUE MUERDE EN SILENCIO. `Usuario1` es la grafía que empuja
   * Cerberus y `usuario1` es la que se tipea al entrar — el `vendedoraId` del
   * token sale de lo SEGUNDO. Con comparación exacta esto no da error: da que
   * la vista no aparece nunca y no hay a quién preguntarle por qué.
   */
  it('no le importa la grafía, de ninguno de los dos lados', () => {
    expect(veRouting('usuario1')).toBe(true);
    expect(veRouting('USUARIO1')).toBe(true);
    expect(veRouting('Alan')).toBe(true);
    expect(veRouting(' alan ')).toBe(true);
  });

  it('sin sesión no ve nada — y una cadena vacía no matchea por accidente', () => {
    expect(veRouting(null)).toBe(false);
    expect(veRouting(undefined)).toBe(false);
    expect(veRouting('')).toBe(false);
    expect(veRouting('   ')).toBe(false);
  });

  it('la lista es la que se pidió, y se lee de un solo lado', () => {
    expect([...VEN_ROUTING]).toEqual(['alan', 'Usuario1']);
  });
});

/**
 * El árbol del front como texto. `import.meta.glob` y **no `node:fs`**: el
 * segundo pasa en vitest y **falla** en `tsc -p tsconfig.app.json`, que no lleva
 * los tipos de node (la cicatriz de `lib/etapas.test.ts`).
 */
const APP: string = Object.values(
  import.meta.glob('../../App.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>,
)[0];

describe('las tres vistas que un operador de campaña no tiene', () => {
  it('quien no atiende campaña las ve todas — el default es el riel de siempre', () => {
    expect(noEsDeCampana({ id: 'luz' })).toBe(true);
    expect(noEsDeCampana({ id: 'luz', esDeCampana: false })).toBe(true);
  });

  /**
   * ⚠️ El campo es OPCIONAL: falta en un server viejo y en el atajo de
   * `quienDiceSer`, que arma la vendedora leyendo el token sin preguntar nada.
   * En los dos casos el riel completo es lo correcto — negar de verdad es
   * trabajo del server (`modulos/deEsteModulo.ts`), no de este booleano.
   */
  it('ausente se lee como «no es de campaña», nunca como «sí»', () => {
    expect(noEsDeCampana({ id: 'luz' })).toBe(true);
    expect(noEsDeCampana({})).toBe(true);
    expect(noEsDeCampana(null)).toBe(true);
    expect(noEsDeCampana(undefined)).toBe(true);
  });

  it('quien atiende una campaña no las tiene', () => {
    expect(noEsDeCampana({ id: 'centurion:betto.romero', esDeCampana: true })).toBe(false);
  });

  /**
   * 🔴 EL CANDADO QUE IMPORTA: que las tres sigan marcadas en `App.tsx`.
   * Sacarle el `soloPara` a una no rompe ningún test de componente —el riel
   * renderiza lo que su lista diga— y el síntoma es que un operador de campaña
   * ve un ícono de la Escuela. Su gemelo del server, que es el que de verdad
   * niega, es `modulos/superficies.paridad.test.ts`.
   *
   * 🔴 **`personas` SALIÓ de esta lista el 23-ago-2026, y no es que se afloje el
   * candado: la vista dejó de esconderse y pasó a RAMIFICARSE.** Se marcó el
   * 19-ago porque sus dos solapas —el padrón de icarus (ADR 0035) y el buscador
   * de Cerberus— son del módulo de ventas. Pero un comando de campaña sí
   * necesita un directorio: el suyo es lo que el equipo registra desde el chat
   * (`contacto_ficha`), que hasta ese día se guardaba y **no se podía ver en
   * ningún lado**. Misma entrada del riel, dos contenidos.
   *
   * ⚠️ Lo reemplaza el caso de abajo, que fija la ramificación — sacarlo sin más
   * habría dejado a «personas» sin ninguna afirmación.
   *
   * 🔴 **`libreta` SALIÓ el 24-ago-2026 (ADR 0084)**: no ramifica como
   * «personas» — pasó a ser lisa y llanamente compartida, mismo contenido para
   * los dos módulos. La afirmación positiva vive en el caso de abajo, junto con
   * el resto de las vistas del motor.
   */
  it.each(['correos', 'navegador'])(
    'la vista «%s» está marcada con noEsDeCampana en App.tsx',
    (id) => {
      const renglon = APP.split('\n').find((l) => l.includes(`id: '${id}'`));
      expect(renglon, `no encontré la vista «${id}» en App.tsx`).toBeDefined();
      expect(renglon).toContain('soloPara: noEsDeCampana');
    },
  );

  /**
   * 🔴 **«Contactos» NO se esconde, y por eso tiene que ramificar.** Si alguien
   * le devuelve el `soloPara`, campaña pierde su directorio; si alguien saca la
   * ramificación, campaña abre la vista de ventas y se come cuatro 403 (el
   * padrón de icarus y el buscador de Cerberus). Las dos mitades en un test: lo
   * que se fija es que estén LAS DOS, porque cada una sola es un defecto.
   */
  it('🔴 «personas» no se esconde en campaña: ramifica según el módulo', () => {
    const renglon = APP.split('\n').find((l) => l.includes("id: 'personas'"));
    expect(renglon, 'no encontré la vista «personas» en App.tsx').toBeDefined();
    expect(
      renglon,
      'le devolvieron el `soloPara`: campaña se queda sin el directorio que registra a mano',
    ).not.toContain('soloPara');
    expect(
      APP,
      'la vista dejó de ramificar: campaña abriría el padrón de icarus y el buscador de Cerberus, que son 403',
    ).toContain('vendedora.esDeCampana ? (');
    expect(APP).toContain('<VistaContactosCampana ');
  });

  /**
   * «Entrenar bot» lleva las DOS condiciones (ADR 0077): no es de campaña Y es
   * la entrenadora. Con `noEsDeCampana` a secas, todo el equipo de la Escuela
   * volvería a ver la vista.
   */
  it('«entrenamiento» exige además ser la entrenadora', () => {
    const renglon = APP.split('\n').find((l) => l.includes("id: 'entrenamiento'"));
    expect(renglon).toBeDefined();
    expect(renglon).toContain('soloPara: entrenaYNoEsDeCampana');
  });

  it('y las que SÍ son de todos no la llevan', () => {
    // Las del MOTOR: sirven igual a ventas y a campaña (`modulos/modulo.ts`
    // no las declara, y ese default —«lo que no está declarado es compartido»—
    // es lo que este test fija del lado del riel). `libreta` se sumó acá el
    // 24-ago-2026 (ADR 0084): dejó de ser una excepción de ventas.
    for (const id of ['dashboard', 'embudo', 'bandeja', 'agenda', 'libreta']) {
      const renglon = APP.split('\n').find((l) => l.includes(`id: '${id}'`));
      expect(renglon).toBeDefined();
      expect(renglon).not.toContain('soloPara');
    }
  });
});

describe('quién entrena al bot (ADR 0077)', () => {
  it('sólo con la bandera puesta por el server', () => {
    expect(entrena({ id: 'usuario1', puedeEntrenar: true })).toBe(true);
    expect(entrena({ id: 'alan', puedeEntrenar: false })).toBe(false);
  });

  /**
   * 🔴 AUSENTE ES «NO», al revés que `esDeCampana`: la vista es de UNA persona
   * y esconderla hasta que el server lo afirme es el lado seguro. Cubre el
   * server viejo (no manda el campo) y el atajo del token (`quienDiceSer`).
   */
  it('ausente se lee como «no entrena», nunca como «sí»', () => {
    expect(entrena({ id: 'usuario1' })).toBe(false);
    expect(entrena({})).toBe(false);
    expect(entrena(null)).toBe(false);
    expect(entrena(undefined)).toBe(false);
  });

  it('la vista pide las dos cosas: entrenadora Y no de campaña', () => {
    expect(entrenaYNoEsDeCampana({ id: 'usuario1', puedeEntrenar: true })).toBe(true);
    expect(entrenaYNoEsDeCampana({ id: 'usuario1', puedeEntrenar: true, esDeCampana: true })).toBe(false);
    expect(entrenaYNoEsDeCampana({ id: 'luz' })).toBe(false);
  });
});
