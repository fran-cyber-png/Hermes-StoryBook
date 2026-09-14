import { describe, expect, it } from 'vitest';

/**
 * 🔴 LOS COMPONENTES DIFERIDOS DEL CHAT SE CARGAN CON `perezoso`, NO CON UN `lazy` PELADO (revisión de #996).
 *
 * Una vendedora con Hermes abierto desde antes de un deploy abre un chat: el navegador pide por nombre el
 * chunk viejo (el grabador, el visor) y el server contesta `index.html`, porque ese archivo ya no existe.
 * Con un `lazy` pelado el import rechaza y, sin un ErrorBoundary, se desmonta la pantalla entera.
 * `lib/perezoso.ts` lo convierte en «no se dibuja», y esa regla tiene su propio test.
 *
 * Lo que se fija acá es el CABLEADO: que estos archivos la usen. Se lee el código y no se monta el chat
 * con un chunk roto a propósito, y no por comodidad: simular el rechazo con un `vi.mock` que tira hace
 * fallar el test por el error del propio mock, con el cableado bien o mal. Así no podía ponerse rojo por
 * el motivo correcto, y se probó.
 *
 * ⚠️ `import.meta.glob` y nunca `node:fs`: con `fs` pasa en vitest y falla el typecheck de
 * `tsconfig.app.json` (la cicatriz de `etapas.test.ts`, ADR 0049).
 */
const FUENTES: Record<string, string> = import.meta.glob(['./HiloWhatsapp.tsx', '../canales/ContextoDelComentario.tsx'], {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('los componentes diferidos del chat', () => {
  it('el glob encontró los dos archivos: sin fuente, este test aprobaría sin mirar nada', () => {
    expect(Object.keys(FUENTES).sort()).toEqual(['../canales/ContextoDelComentario.tsx', './HiloWhatsapp.tsx']);
  });

  it.each([
    ['./HiloWhatsapp.tsx', ['GrabadorDeVoz', 'VisorDeAdjunto']],
    ['../canales/ContextoDelComentario.tsx', ['VisorDeAdjunto']],
  ])('🔴 %s carga sus diferidos con perezoso', (archivo, componentes) => {
    const fuente = FUENTES[archivo] ?? '';
    expect(fuente, `${archivo} usa un lazy pelado: un chunk que ya no existe deja la pantalla en blanco`).not.toMatch(/\blazy\(/);
    for (const componente of componentes) {
      expect(fuente, `${componente} no se carga con perezoso en ${archivo}`).toMatch(new RegExp(`const ${componente} = perezoso[<(]`));
    }
  });
});
