import { describe, expect, it } from 'vitest';
import {
  FUENTE_CSS,
  MINIMO_TEXTO,
  TEMAS,
  TOKENS_CLAROS as CLAROS,
  TOKENS_OSCUROS as OSCUROS,
  contraste,
} from './pruebas/contraste';

/**
 * ══ QUE EL TEMA OSCURO SE LEA — el candado del desdoble de `--navy` ══════════
 *
 * 🔴 EL DEFECTO QUE ESTO VIGILA TAMPOCO SE VE EN UN DOM, Y ADEMÁS SOLO LE PASA A
 * ALGUNAS. Durante semanas la app se ponía oscura sola —una media query global
 * que nadie pedía— y en oscuro `--navy` seguía valiendo #0E2A52. `--navy` era a
 * la vez la SUPERFICIE de una chapa (`bg-navy text-white`) y la TINTA del título
 * de cada pantalla (`text-navy`), así que el título quedaba en azul institucional
 * sobre #1A2332: contraste 1.1:1. El título estaba ahí, ocupaba su lugar, tenía
 * su texto en el DOM y era un rectángulo vacío. Quien tenía el sistema en claro
 * no vio nunca nada raro.
 *
 * La corrección no fue un color: fue partir el token en dos papeles —`--navy`
 * superficie, `--navy-ink` tinta— y elegir el papel en el marcado. Este test fija
 * ESA RELACIÓN, no la ortografía de un hex: el dueño puede cambiar el azul
 * cuando quiera; lo que no puede es elegir uno que desaparezca sobre una mesa.
 */

/** Las superficies donde se apoya texto. Todo lo demás se lee sobre alguna. */
const SUPERFICIES = ['--card', '--secondary', '--background', '--muted'] as const;

/** Las tintas que tienen que leerse sobre cualquiera de esas superficies. */
const TINTAS = ['--foreground', '--navy-ink', '--warning-foreground'] as const;

/**
 * 🔴 **`--warning-foreground` ENTRÓ A ESTA LISTA EL 24-AGO-2026, y su ausencia
 * era el defecto.** En oscuro valía la tinta del tema claro (`#78350F`, marrón)
 * y daba **1,74:1** sobre `--card` — el aviso «Cerberus cortó la consulta» del
 * panel de contacto, ilegible. Una lista de tintas incompleta no se pone roja:
 * deja de mirar justo donde nadie miró.
 *
 * ⚠️ **LO QUE LA MEDICIÓN ENCONTRÓ Y NO SE TOCÓ, con su número:** `--success`
 * (`#16A34A`) sobre `--card` en el tema **CLARO** da **3,30:1**, y se usa como
 * TEXTO de 11 px en el panel («1 compra · 300 PEN», la píldora «Cliente»). Pasa
 * el mínimo de 3:1 de un elemento de interfaz y **no** el de 4,5:1 de texto
 * chico. Arreglarlo es oscurecer un color de MARCA para toda la app —el ✓✓ del
 * hilo, los estados de éxito, la píldora de cliente de la cola— así que es una
 * decisión del dueño, no un efecto colateral de un rediseño de panel. Queda
 * escrito acá con la cifra para que la próxima vez se discuta con un dato.
 */

/**
 * Todo el front como texto, para preguntarle QUÉ PAPEL eligió cada llamada.
 * Es la parte del invariante que no vive en el CSS: un token con dos papeles no
 * se arregla en la hoja, se arregla en quien lo escribe.
 */
const FUENTES: Record<string, string> = import.meta.glob(['./**/*.tsx', './**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Los archivos que todavía piden la TINTA por el token de la SUPERFICIE. */
function archivosConTintaDeSuperficie(): string[] {
  return Object.entries(FUENTES)
    .filter(([ruta]) => !ruta.includes('.test.') && !ruta.includes('/pruebas/'))
    .filter(([, fuente]) => /(?<![\w-])text-navy(?!-ink)/.test(fuente))
    .map(([ruta]) => ruta)
    .sort();
}

describe('el tema oscuro se lee', () => {
  it('hay dos temas que medir (si no, el test no verifica nada)', () => {
    expect(Object.keys(CLAROS).length).toBeGreaterThan(0);
    expect(Object.keys(FUENTES).length).toBeGreaterThan(50);
  });

  /**
   * El corazón del asunto. Si alguien vuelve a fundir los dos papeles en un
   * token —o «arregla» el tema oscuro invirtiendo `--navy` a secas—, esto se
   * pone rojo antes de que ningún título desaparezca.
   */
  it('la superficie no se invierte y la tinta sí', () => {
    expect(
      OSCUROS['--navy'],
      '`--navy` es superficie (`bg-navy text-white`, los velos de los modales): invertirlo deja esas chapas en blanco sobre blanco',
    ).toBe(CLAROS['--navy']);
    expect(
      OSCUROS['--navy-ink'],
      '`--navy-ink` es tinta: si no se aclara en oscuro, el título de cada pantalla queda en 1.1:1',
    ).not.toBe(CLAROS['--navy-ink']);
  });

  for (const { nombre, tokens } of TEMAS) {
    it(`[${nombre}] cada tinta se lee ${MINIMO_TEXTO}:1 sobre cada superficie`, () => {
      for (const tinta of TINTAS) {
        for (const superficie of SUPERFICIES) {
          const c = contraste(tokens[tinta], tokens[superficie]);
          expect(
            c,
            `${tinta} (${tokens[tinta]}) sobre ${superficie} (${tokens[superficie]}) da ${c.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
        }
      }
    });
  }

  /**
   * LA EXCEPCIÓN, Y POR QUÉ TIENE QUE SEGUIR SIÉNDOLO. La chapa de pendientes
   * del riel es `bg-gold text-navy`: el oro NO se apaga en el tema oscuro —es
   * señal de tiempo que se acaba, no decoración—, así que sobre esa chapa la
   * tinta clara no se ve. Es el único lugar de la app donde `text-navy` (el
   * token de superficie) es lo correcto, y el test guarda las dos mitades: que
   * la excepción se lea, y que sea UNA.
   */
  it('la chapa de oro conserva su tinta oscura, y es la única que lo hace', () => {
    for (const { nombre, tokens } of TEMAS) {
      const c = contraste(tokens['--navy'], tokens['--gold']);
      expect(c, `[${nombre}] navy sobre oro da ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        MINIMO_TEXTO,
      );
    }
    // Y la prueba de que la excepción no es capricho: la tinta clara ahí es ilegible.
    const conTintaClara = contraste(OSCUROS['--navy-ink'], OSCUROS['--gold']);
    expect(conTintaClara).toBeLessThan(MINIMO_TEXTO);

    expect(
      archivosConTintaDeSuperficie(),
      'apareció otro `text-navy`: o es tinta y va `text-navy-ink`, o es otra chapa que no se apaga en oscuro y entonces se documenta acá',
    ).toEqual(['./App.tsx']);
  });
});

/**
 * ══ LA JERARQUÍA SÓLIDA DEL TEMA OSCURO ══════════════════════════════════════
 *
 * 🔴 ESTE CANDADO REEMPLAZA AL «PISO DE OPACIDAD», Y EL CAMBIO DE ENFOQUE ES EL
 * PUNTO. Aquél vigilaba que el ALFA de la tinta apagada no bajara de 85 %.
 * Funcionaba, y aun así dejaba el mecanismo en pie: **un color con alfa no
 * tiene un color**, tiene el de lo que le toque atrás. `bg-muted/40` compone
 * #242F40 sobre `--card` y #1D2631 sobre `--background`, así que el contraste
 * del texto encima queda atado a dónde se monte el componente.
 *
 * ⚠️ **Y una corrección al reporte, con su número.** Se dijo «al achicar la
 * pantalla empeora», que hacía sospechar que al angostar los paneles cambiaban
 * de padre. Medido a 390/768/1280 px sobre las galerías: de 174 elementos
 * vistos en más de un ancho, **cero** cambian de contraste. El síntoma es
 * densidad —más texto chico junto— no composición. El sólido sigue siendo lo
 * correcto, pero por quitar la cuerda floja, no por arreglar una deriva que no
 * existía.
 *
 * Ahora el tema oscuro tiene TRES tintas sólidas y una escalera de superficies
 * sólidas. Lo que este archivo fija es la RELACIÓN entre las dos listas: que
 * cada tinta se lea sobre cada superficie, y que los tres niveles sigan siendo
 * tres niveles distinguibles — si alguien los junta, la jerarquía se muere sin
 * que ningún contraste baje.
 */
describe('la jerarquía sólida del tema oscuro', () => {
  /** La escalera de superficies, leída del CSS y no copiada acá. */
  const SUPERFICIES = ['--background', '--card', '--sup-2', '--sup-3', '--sup-4'] as const;

  /** Las tres tintas, de la más clara a la más tenue. */
  const JERARQUIA = ['--foreground', '--muted-foreground', '--texto-tenue'] as const;

  /**
   * El deshabilitado es el único que puede quedar bajo 4,5 sobre las
   * superficies levantadas: WCAG exceptúa un control deshabilitado, y ése es
   * exactamente su papel. Lo que NO puede es desaparecer — de ahí el piso
   * propio, muy por encima del 2,13 que daba el alfa que reemplazó.
   */
  const MINIMO_TENUE = 3.4;

  it('cada tinta de la jerarquía se lee sobre cada superficie sólida', () => {
    for (const tinta of JERARQUIA) {
      const minimo = tinta === '--texto-tenue' ? MINIMO_TENUE : MINIMO_TEXTO;
      for (const superficie of SUPERFICIES) {
        const c = contraste(OSCUROS[tinta], OSCUROS[superficie]);
        expect(
          c,
          `${tinta} (${OSCUROS[tinta]}) sobre ${superficie} (${OSCUROS[superficie]}) da ${c.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(minimo);
      }
    }
  });

  /**
   * LA MITAD QUE IMPIDE «ARREGLARLO» BLANQUEANDO TODO. El pedido fue explícito:
   * conservar los grises. Si alguien sube `--muted-foreground` hasta que sea
   * casi `--foreground`, los contrastes de arriba mejoran y la jerarquía deja
   * de existir — un test que sólo mira mínimos aplaudiría ese cambio.
   */
  it('los tres niveles siguen siendo distinguibles entre sí', () => {
    for (let i = 0; i < JERARQUIA.length - 1; i++) {
      const [arriba, abajo] = [JERARQUIA[i], JERARQUIA[i + 1]];
      const c = contraste(OSCUROS[arriba], OSCUROS[abajo]);
      expect(
        c,
        `${arriba} y ${abajo} están a ${c.toFixed(2)} — demasiado cerca para leerse como dos niveles`,
      ).toBeGreaterThanOrEqual(1.15);
    }
    // Y que sigan siendo GRISES: ninguno puede acercarse tanto al blanco del
    // texto principal como para volverse otro texto principal.
    const c = contraste(OSCUROS['--muted-foreground'], OSCUROS['--foreground']);
    expect(c, 'el secundario se volvió casi tan claro como el principal').toBeGreaterThanOrEqual(
      1.5,
    );
  });

  /**
   * 🔴 LA DEL CABLEADO (ADR 0024): el defecto que va a llegar no es un número
   * mal calculado, es una utility con alfa que nadie tradujo. Si alguien
   * escribe `text-muted-foreground/35` o `bg-muted/45`, la regla de arriba
   * sigue verde y en pantalla vuelve a aparecer una capa que depende del fondo.
   */
  const FUENTES: Record<string, string> = import.meta.glob(['./**/*.tsx', './**/*.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  /** Las utilities con alfa que el CSS traduce a sólido. */
  function traducidas(): Set<string> {
    const bloque = /@layer utilities \{([\s\S]*)\n\}/.exec(FUENTE_CSS)?.[1] ?? '';
    return new Set(
      [...bloque.matchAll(/\.((?:bg|text)-[a-z-]+)\\\/(\d{1,3})/g)].map((m) => `${m[1]}/${m[2]}`),
    );
  }

  /**
   * ── LAS DOS EXENCIONES, DERIVADAS DEL CÓDIGO Y NO DE UNA LISTA A MANO ──────
   *
   * Una lista escrita a mano envejece: el día que alguien agregue otro velo,
   * el test lo reporta como «falta traducir» y la corrección obvia —meterlo en
   * la lista— es justo la equivocada. Así que las dos se deducen del marcado.
   *
   * 1. **Lo que va sobre `inset-0`**: velos de modal y el destello del ✓ de
   *    `FormularioVenta` (`animate-out … fade-out`). Existen para dejar ver
   *    atenuado lo que hay detrás; solidificarlos tapa la pantalla.
   */
  function vaSobreInset0(u: string): boolean {
    // `some` y NO `every`, y la diferencia es la que hace que esto sea un
    // candado y no un adorno: con `every` la regla no se disparaba nunca.
    // `bg-navy/30` tiene 16 usos —12 velos de modal y 2 como color de chapa de
    // la Agenda—, así que «todos son velo» es falso y solidificarlo pasaba
    // inadvertido. Basta UN uso sobre `inset-0` para que el sólido rompa esa
    // pantalla: la utility es compartida, y separarla exigiría tocar el
    // marcado.
    return lineasCon(u).some((l) => l.includes('inset-0'));
  }

  /**
   * 2. **Lo que sólo aparece detrás de un prefijo de variante** (`hover:`,
   *    `focus:`): `hover:bg-primary/90` y compañía son el «oscurecer al pasar
   *    el mouse» de un botón que YA es sólido. Traducirlos sería código muerto
   *    — el `:where()` de `index.css` pierde contra cualquier variante a
   *    propósito, para no pisar los estados.
   */
  function soloTrasVariante(u: string): boolean {
    const escapada = u.replace(/[/\\]/g, '\\$&');
    const todas = contarEn(new RegExp(escapada, 'g'));
    const conPrefijo = contarEn(new RegExp('[a-z-]+:' + escapada, 'g'));
    return todas > 0 && todas === conPrefijo;
  }

  function fuentesDelFront(): string[] {
    return Object.entries(FUENTES)
      .filter(([r]) => !r.includes('.test.') && !r.includes('/pruebas/'))
      .map(([, f]) => f);
  }

  function lineasCon(u: string): string[] {
    return fuentesDelFront()
      .flatMap((f) => f.split('\n'))
      .filter((l) => l.includes(u));
  }

  function contarEn(re: RegExp): number {
    return fuentesDelFront().reduce((n, f) => n + (f.match(re)?.length ?? 0), 0);
  }

  /** Las familias que sí tienen que estar traducidas. */
  const OBLIGATORIAS =
    /^(?:(?:text-muted-foreground|text-primary-foreground|bg-muted|bg-secondary|bg-card|bg-destructive|bg-warning|bg-success|bg-primary|bg-gold)\/|bg-(?:cat|temp)-[a-z]+\/)/;

  function usadasEnElFront(): string[] {
    const vistas = new Set<string>();
    for (const [ruta, fuente] of Object.entries(FUENTES)) {
      if (ruta.includes('.test.') || ruta.includes('/pruebas/')) continue;
      for (const m of fuente.matchAll(/\b((?:bg|text)-[a-z-]+)\/(\d{1,3})\b/g)) {
        vistas.add(`${m[1]}/${m[2]}`);
      }
    }
    return [...vistas].sort();
  }

  it('toda utility con alfa de las familias traducidas tiene su sólido', () => {
    const cubiertas = traducidas();
    expect(cubiertas.size, 'no se encontró el bloque de traducción en index.css').toBeGreaterThan(
      20,
    );
    const faltantes = usadasEnElFront().filter(
      (u) => OBLIGATORIAS.test(u) && !vaSobreInset0(u) && !soloTrasVariante(u) && !cubiertas.has(u),
    );
    expect(
      faltantes,
      `estas utilities con alfa quedaron sin sólido en el tema oscuro: ${faltantes.join(', ')}`,
    ).toEqual([]);
  });

  /**
   * La otra mitad del cableado: que los velos SIGAN con alfa. Un comodín
   * entusiasta que solidifique `bg-navy/30` deja los modales sobre un
   * rectángulo opaco, y eso no lo nota ningún test de contraste.
   */
  it('los velos de los modales conservan su alfa', () => {
    const cubiertas = traducidas();
    const rotos = [...cubiertas].filter((u) => vaSobreInset0(u));
    expect(
      rotos,
      `estos velos fueron solidificados y taparían lo que hay detrás: ${rotos.join(', ')}`,
    ).toEqual([]);
  });
});
