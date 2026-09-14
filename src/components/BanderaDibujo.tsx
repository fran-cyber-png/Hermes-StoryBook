import {
  AR, BO, BR, CA, CL, CO, CR, DO, EC, ES, GT, HN, MX, NI, PA, PE, PY, SV, US, UY, VE,
} from 'country-flag-icons/react/3x2';

/**
 * LOS DIBUJOS DE LAS BANDERAS — cargados aparte, NUNCA en el arranque.
 *
 * 🔴 **Vivían en `Bandera.tsx` con import estático y costaban ~8 KB gzip en el
 * chunk de entrada** (13-sep-2026): el arranque pasó de 304,2 a 312,2 KB contra
 * un tope de 310 (`scripts/presupuesto-de-chunks.mjs`) y el CI se puso rojo. Las
 * banderas con escudo (México, Ecuador, Guatemala…) son SVG largos, y ninguna
 * hace falta para entrar a Hermes: se ven recién al abrir un contacto.
 *
 * ⚠️ **Sólo las de `dominio/pais.ts`, importadas de a una**: así el build deja
 * afuera las otras ~240 de la librería. Un país que no está acá no tiene bandera
 * y no dibuja nada — nunca una bandera equivocada.
 */
const BANDERAS = { AR, BO, BR, CA, CL, CO, CR, DO, EC, ES, GT, HN, MX, NI, PA, PE, PY, SV, US, UY, VE } as const;

export default function BanderaDibujo({ iso, nombre, className }: { iso: string; nombre: string; className: string }) {
  const Dibujo = (BANDERAS as Record<string, (typeof BANDERAS)['PE']>)[iso];
  if (!Dibujo) return null;
  return <Dibujo role="img" aria-label={nombre} data-bandera={iso} className={className} />;
}
