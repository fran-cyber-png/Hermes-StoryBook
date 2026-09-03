import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import { FichaRapida } from '../panel/FichaRapida';
import { useMiLineaDeCampana } from '../territorio/territorio';
import { conversacionNueva } from './conversacionDeContacto';

/**
 * "NUEVO CONTACTO" — solo para el candidato (ampliación de ADR 0060).
 *
 * 🔴 **No es un formulario nuevo.** Abre el MISMO drawer que el botón
 * «Contacto» de Mensajes (`FichaRapida.tsx`, `BarraGestion.tsx`), sin tocarlo:
 * ese componente ya sabe portarse distinto en campaña, ya guarda contra
 * `POST /api/contactos/registro` y —desde el 24-ago-2026— también pregunta
 * dónde vota cuando `esDeCampana`. Lo único que este wrapper le arma es una
 * `Conversacion` SINTÉTICA (`conversacionNueva`, clave
 * `conv:whatsapp:manual-<uuid>:<línea>` — la forma que el servidor reconoce
 * para exigir `administra(req) && esDeCampana`, ver `esClaveDeContactoManual`
 * en `server/src/contactos/fichaLocal.ts`).
 */
export function NuevoContacto() {
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  // Solo se pide la línea cuando el botón está por usarse: no tiene sentido
  // pagar la consulta en cada render de la barra de Contactos.
  const linea = useMiLineaDeCampana(conversacion == null);

  return (
    <>
      <button
        type="button"
        onClick={() => linea && setConversacion(conversacionNueva(linea))}
        disabled={!linea}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-[background-color,transform] duration-200 ease-house hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
      >
        <UserPlus size={13} />
        Nuevo contacto
      </button>

      {conversacion && (
        <FichaRapida conversacion={conversacion} onCerrar={() => setConversacion(null)} esDeCampana />
      )}
    </>
  );
}
