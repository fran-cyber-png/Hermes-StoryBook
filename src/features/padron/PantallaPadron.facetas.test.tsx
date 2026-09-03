// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { esperarA, montar, tocar } from '../../pruebas/dom';
import { PantallaPadron } from './PantallaPadron';

/**
 * EL CANDADO DEL CABLEADO, NO DEL TIPO — `facetas.data?.facetas.asignadoA`
 * daba `undefined` en producción porque el server manda `asignadoA` como
 * HERMANO de `facetas`, nunca anidado adentro (ver el docblock de
 * `RespuestaFacetas` en `padron.ts`). Un test de tipos NO lo hubiera
 * atrapado: `api<T>()` es un cast contra la red, no una validación — el tipo
 * viejo afirmaba una forma que nadie comprobaba contra la real.
 *
 * Por eso esto monta la pantalla ENTERA (no una función pura) contra un
 * fixture con la forma REAL — verificada con un curl en vivo en #605, no
 * inventada acá — y confirma que la sección Reparto del panel muestra a la
 * vendedora de verdad. Si alguien vuelve a anidar mal el tipo, esto se cae
 * viendo la lista vacía, que es exactamente el síntoma que tuvo en
 * producción: sin este test, `opcionesDeReparto` blinda con `if (!faceta)
 * return []` y nada tira error — la pantalla se ve «bien» y miente callada.
 */
const RESPUESTA_REAL_DE_FACETAS = {
  facetas: { pais: [], curso: [], etapa: [], nivel: [], fuente: [] },
  asignadoA: {
    opciones: [{ valor: 'ventas12@grupogoberna.com', contactos: 338 }],
    sinRepartir: 72_807,
  },
  // La forma real de #605, verificada con curl: un ARRAY suelto, no
  // `{ opciones: [...] }` — el primer contrato que se relayó decía lo
  // segundo, y era una simplificación, no lo que el server manda de verdad.
  entroPorLinea: [{ valor: '51984429504', etiqueta: 'Ventas Meta', contactos: 3272 }],
};

function instalarFetchDePrueba(): () => void {
  const original = window.fetch;
  window.fetch = (async (entrada: RequestInfo | URL) => {
    const url = String(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
    const cuerpo = url.includes('/api/padron/facetas')
      ? RESPUESTA_REAL_DE_FACETAS
      : url.includes('/api/padron/reparto')
      ? { destinos: [], carga: [] }
      : url.includes('/api/whatsapp/sesion')
      ? { estado: 'desconectado' }
      : url.includes('/api/padron/contactos')
      ? { contactos: [], total: 0, supervisor: true, porPagina: 50, paginaActual: 1, sinSupervisores: false }
      : {};
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => {
    window.fetch = original;
  };
}

describe('PantallaPadron × la forma real de /api/padron/facetas', () => {
  test('la sección Reparto muestra a la vendedora real, no la lista vacía', async () => {
    const restaurar = instalarFetchDePrueba();
    const m = montar(<PantallaPadron />);
    try {
      const botonFiltros = () =>
        [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith('Filtros'));
      await esperarA(() => !!botonFiltros(), 'que cargue y aparezca el botón Filtros (soySupervisor)');
      tocar(botonFiltros()!);

      await esperarA(
        () => m.contenedor.textContent?.includes('Ventas12') ?? false,
        'que la sección Reparto muestre a Ventas12 (338)',
      );

      expect(m.contenedor.textContent).toContain('Ventas12');
      expect(m.contenedor.textContent).not.toContain('Todavía no hay nadie en el reparto');
    } finally {
      m.desmontar();
      restaurar();
    }
  });
});
