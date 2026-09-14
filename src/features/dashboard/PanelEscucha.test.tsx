// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { montar, tocar } from '../../pruebas/dom';
import { PanelCampana } from './PanelCampana';
import { PanelEscucha } from './PanelEscucha';
import type { BloqueDeCanal, DatosCampana, Escucha } from './campana';

/**
 * QUE EL PANEL LLAME A SUS REGLAS — no que las reglas estén bien escritas.
 *
 * 🔴 Las de `campana.escucha.test.ts` pasan aunque el JSX vuelva a escribir el
 * texto a mano y no llame a ninguna. Ese es exactamente el defecto que este repo
 * ya se comió dos veces (ADR 0024 con el Escape global, ADR 0068 de nuevo): la
 * regla testeada hasta el hueso y el cableado suelto.
 *
 * Los números de los fixtures son los que el panel mostraba con el corpus REAL
 * de Betto el 4-sep-2026, para que un rojo se pueda ir a mirar a la pantalla.
 */

function bloque(p: Partial<BloqueDeCanal> = {}): BloqueDeCanal {
  return { total: 0, sustancia: 0, temas: [], lugares: [], marcas: {}, ...p };
}

function temas(n: number) {
  return Array.from({ length: n }, (_, i) => ({ clave: `t${i}`, nombre: `Tema ${i}`, n: n - i }));
}

function provincias(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    clave: `p${i}`,
    nombre: `Provincia ${i}`,
    n: n - i,
    esProvincia: true,
  }));
}

function escucha(canales: Partial<Record<string, BloqueDeCanal>>): Escucha {
  return {
    estado: 'ok',
    cliente: 'betto',
    version: 1,
    pendientes: 0,
    canales: {
      todas: bloque(),
      muro: bloque(),
      whatsapp: bloque(),
      messenger: bloque(),
      instagram: bloque(),
      ...canales,
    } as Escucha['canales'],
  };
}

/** El texto de la pantalla, sin los saltos que mete el JSX. */
function leer(nodo: HTMLElement): string {
  return (nodo.textContent ?? '').replace(/\s+/g, ' ');
}

describe('las tres marcas se cuentan sobre el TOTAL, y el panel lo dice', () => {
  /**
   * 🔴 EL DEFECTO MEDIDO. El panel decía «lo de al lado sale de esos 842» con la
   * lista de marcas justo debajo, así que las tres filas se leían como un corte
   * dentro de la sustancia. `clasificar.ts` las pone SIN mirar `sustancia`: en la
   * misma ventana que el panel dibuja para «30 días», de los 30 `pro_rival`
   * **27 caen fuera** — el 90 %. La fila decía 30 bajo una promesa que 27 de
   * esos 30 no cumplían.
   */
  const b = bloque({
    total: 6082,
    sustancia: 842,
    temas: temas(13),
    lugares: provincias(20),
    marcas: { pedido: 157, ataque_al_candidato: 31, pro_rival: 30 },
  });

  it('🔴 nombra el total como denominador de las marcas, no la sustancia', () => {
    const v = montar(<PanelEscucha escucha={escucha({ todas: b })} canal="todas" cargando={false} />);
    const texto = leer(v.contenedor);
    // 🔴 «6,082» con COMA no es un descuido: `es-PE` separa los miles con coma
    // —el Perú sigue la convención de EE. UU., no la de Buenos Aires ni la de
    // Madrid— y es lo que `Cifra` ya imprime en el resto del panel. Verificado
    // con ICU completo: es-PE «6,082» · es-AR «6.082» · es-ES «6082».
    expect(texto).toContain('De esos mismos 6,082');
    // La promesa vieja no puede volver por ninguna redacción.
    expect(texto).not.toContain('sale de esos 842');
    expect(texto).not.toContain('Lo de al lado');
    v.desmontar();
  });

  it('la sustancia sigue estando, con su propio denominador', () => {
    const v = montar(<PanelEscucha escucha={escucha({ todas: b })} canal="todas" cargando={false} />);
    expect(leer(v.contenedor)).toContain('842 de los 6,082 mensajes del período');
    v.desmontar();
  });

  it('🔴 escribe los miles con separador, como el resto del panel', () => {
    const v = montar(<PanelEscucha escucha={escucha({ todas: b })} canal="todas" cargando={false} />);
    expect(leer(v.contenedor)).not.toMatch(/\b6082\b/);
    v.desmontar();
  });

  it('🔴 declara cuántas filas quedaron afuera de cada lista', () => {
    const v = montar(<PanelEscucha escucha={escucha({ todas: b })} canal="todas" cargando={false} />);
    const texto = leer(v.contenedor);
    expect(texto).toContain('de 13 temas');
    expect(texto).toContain('de 20 provincias');
    v.desmontar();
  });
});

describe('el atraso del clasificador', () => {
  /**
   * ⚠️ ESTE ESTADO NO SE PUEDE CAPTURAR CON EL CORPUS REAL, y por eso va acá.
   * En la base local `campana:clasificar` ya corrió entero, así que `pendientes`
   * es 0 en los cuatro períodos y el aviso no se dibuja nunca — no hay captura
   * posible. Producción sí lo alcanza en cuanto el script se atrasa, y mientras
   * el aviso no diga cero los porcentajes de arriba son de una muestra parcial.
   */
  it('🔴 avisa que lo mostrado es una parte, no el total', () => {
    const e: Escucha = {
      ...escucha({ todas: bloque({ total: 6082, sustancia: 842, temas: temas(13) }) }),
      pendientes: 1908,
    };
    const v = montar(<PanelEscucha escucha={e} canal="todas" cargando={false} />);
    const texto = leer(v.contenedor);
    expect(texto).toContain('1,908 mensajes del período todavía sin leer');
    expect(texto).toContain('una parte, no el total');
    // El punto dorado, que en este repo significa una sola cosa: tiempo que se
    // acaba. Acá lo es — son mensajes ya recibidos que el panel todavía no leyó.
    expect(v.contenedor.querySelector('.bg-gold-ink')).toBeTruthy();
    v.desmontar();
  });

  it('sin atraso no dibuja el aviso: un cartel permanente enseña a no mirarlo', () => {
    const e = escucha({ todas: bloque({ total: 6082, sustancia: 842, temas: temas(13) }) });
    const v = montar(<PanelEscucha escucha={e} canal="todas" cargando={false} />);
    expect(leer(v.contenedor)).not.toContain('sin leer');
    expect(v.contenedor.querySelector('.bg-gold-ink')).toBeFalsy();
    v.desmontar();
  });
});

describe('el vacío de un canal explica ESE canal', () => {
  it('🔴 en WhatsApp sin temas no se justifica hablando del muro', () => {
    // «Hoy · WhatsApp» con el corpus real: 3 mensajes, ningún tema.
    const e = escucha({
      todas: bloque({ total: 116, sustancia: 20 }),
      muro: bloque({ total: 92, sustancia: 13 }),
      whatsapp: bloque({ total: 3, sustancia: 1, lugares: provincias(1) }),
    });
    const v = montar(<PanelEscucha escucha={e} canal="whatsapp" cargando={false} />);
    const texto = leer(v.contenedor);
    expect(texto).toContain('WhatsApp');
    expect(texto.toLowerCase()).not.toContain('muro');
    v.desmontar();
  });
});

// ── El cableado del canal, que necesita la pantalla entera ────────────────────

function datos(e: Escucha): DatosCampana {
  return {
    rango: { desde: '2026-09-04T05:00:00.000Z', hasta: '2026-09-05T05:00:00.000Z' },
    periodo: 'hoy',
    lineas: ['51963139984'],
    gente: { escribieron: 2, respondidas: 0, sin_responder: 2, nuevas: 0 },
    mensajes: { entrantes: 3, salientes: 0, entrantes_sin_texto: 0 },
    franjas: [],
    dias: [],
    aperturas: [],
    equipo: [],
    escucha: e,
  };
}

function chip(contenedor: HTMLElement, nombre: string): HTMLButtonElement | undefined {
  const grupo = contenedor.querySelector('[aria-label="Filtrar por canal"]');
  return [...(grupo?.querySelectorAll('button') ?? [])].find((b) =>
    (b.textContent ?? '').startsWith(nombre),
  );
}

describe('un canal que se queda sin mensajes al cambiar de período', () => {
  it('🔴 no deja el panel en cero y sin ningún chip prendido', () => {
    const conMessenger = escucha({
      todas: bloque({ total: 656, sustancia: 90, temas: temas(4) }),
      muro: bloque({ total: 21, sustancia: 3 }),
      messenger: bloque({ total: 635, sustancia: 63, temas: temas(11) }),
    });
    const v = montar(<PanelCampana datos={datos(conMessenger)} cargando={false} actualizando={false} />);

    const aMessenger = chip(v.contenedor, 'Messenger');
    expect(aMessenger, 'el chip de Messenger tiene que existir cuando tiene 635 mensajes').toBeTruthy();
    tocar(aMessenger!);
    expect(chip(v.contenedor, 'Messenger')?.getAttribute('aria-pressed')).toBe('true');

    // Mismo panel, otro período: Messenger se queda sin nada y su chip ya no se
    // ofrece. La elección, en cambio, sigue viva en el estado del componente.
    const sinMessenger = escucha({
      todas: bloque({ total: 116, sustancia: 20, temas: temas(6) }),
      muro: bloque({ total: 92, sustancia: 13, temas: temas(5) }),
      messenger: bloque({ total: 0 }),
    });
    v.repintar(<PanelCampana datos={datos(sinMessenger)} cargando={false} actualizando={false} />);

    expect(chip(v.contenedor, 'Messenger'), 'sin mensajes, el chip no se ofrece').toBeFalsy();
    expect(
      chip(v.contenedor, 'Todos')?.getAttribute('aria-pressed'),
      'algún chip tiene que quedar prendido: si no, el panel muestra ceros sin decir de qué',
    ).toBe('true');
    expect(leer(v.contenedor)).toContain('116');
    v.desmontar();
  });
});

describe('los dos universos del panel', () => {
  it('🔴 con Páginas de Meta, dice que la escucha lee más que la línea', () => {
    // Arriba «3 recibidos», abajo el chip «Todos 116»: sin una línea que lo
    // explique, el primer reflejo es que uno de los dos está mal.
    const e = escucha({
      todas: bloque({ total: 116, sustancia: 20, temas: temas(6) }),
      muro: bloque({ total: 92, sustancia: 13 }),
      whatsapp: bloque({ total: 3, sustancia: 1 }),
    });
    const v = montar(<PanelCampana datos={datos(e)} cargando={false} actualizando={false} />);
    expect(leer(v.contenedor)).toContain('miden sólo la línea');
    v.desmontar();
  });

  it('🔴 SIN Páginas de Meta no promete un muro que no existe', () => {
    // Una candidatura con su línea y sin Páginas —o con Páginas sin nada en el
    // período— leería una promesa que el panel no cumple. ADR 0092 deja escrito
    // que `numeros_wa.cliente_id` es config a mano, así que este caso existe.
    const e = escucha({
      todas: bloque({ total: 3, sustancia: 1, temas: temas(2) }),
      whatsapp: bloque({ total: 3, sustancia: 1, temas: temas(2) }),
    });
    const v = montar(<PanelCampana datos={datos(e)} cargando={false} actualizando={false} />);
    const texto = leer(v.contenedor);
    expect(texto).toContain('sólo llegaron mensajes por la línea de WhatsApp');
    expect(texto).not.toContain('el muro');
    v.desmontar();
  });
});

describe('las franjas cuando nadie contestó', () => {
  it('🔴 explica las cuatro rayitas en vez de dejarlas parecer un bloque roto', () => {
    // La base local tiene 27.313 entrantes y CERO salientes, así que las cuatro
    // medianas son null y el bloque se dibuja en blanco.
    const d = datos(escucha({ todas: bloque({ total: 3, sustancia: 1 }) }));
    d.franjas = (['madrugada', 'manana', 'tarde', 'noche'] as const).map((franja) => ({
      franja,
      personas: 24,
      atendidas: 0,
      demora_mediana_min: null,
      entrantes: 30,
    }));
    const v = montar(<PanelCampana datos={d} cargando={false} actualizando={false} />);
    expect(leer(v.contenedor)).toContain('Nadie contestó en el período');
    v.desmontar();
  });

  it('con alguna respuesta no aparece el aviso', () => {
    const d = datos(escucha({ todas: bloque({ total: 3, sustancia: 1 }) }));
    d.franjas = [
      { franja: 'tarde', personas: 66, atendidas: 61, demora_mediana_min: 8, entrantes: 312 },
      { franja: 'noche', personas: 49, atendidas: 45, demora_mediana_min: 688, entrantes: 122 },
    ];
    const v = montar(<PanelCampana datos={d} cargando={false} actualizando={false} />);
    expect(leer(v.contenedor)).not.toContain('Nadie contestó en el período');
    v.desmontar();
  });
});
