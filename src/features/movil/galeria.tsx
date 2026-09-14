import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import type { Conversacion } from '../../dominio/conversaciones';
import { BandejaMovil } from './BandejaMovil';

/**
 * LA GALERÍA DE LA BANDEJA MÓVIL — la evidencia, sin server ni base.
 *
 * Entry APARTE de Vite (`galeria-movil.html`): `vite build` compila solo
 * `index.html`, así que esto NO entra al bundle de las vendedoras.
 *
 *     npm run dev  →  http://localhost:5173/galeria-movil.html
 *
 * Existe por la regla dura #2 y por una razón más específica: **la pantalla de
 * móvil no se puede verificar en la app**. La app pide sesión, y a 430 px lo
 * primero que aparece es el login. Acá se ve la bandeja con filas de verdad
 * —`FilaConversacion`, la misma de la cola— a su ancho real.
 *
 * ⚠️ El marco de 430×934 es de la galería, no del componente: `BandejaMovil`
 * ocupa el alto que le den. Así se ve a tamaño de teléfono en una pantalla de
 * escritorio sin tener que achicar la ventana.
 */

/** Todo endpoint contesta de mentira: esta galería no toca la red ni una vez. */
window.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(
    typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url,
  );
  // La foto de perfil no existe acá, y un 404 es lo correcto: el Avatar cae a
  // las iniciales ante cualquier problema, que es su comportamiento real.
  if (url.includes('/api/whatsapp/foto/')) return new Response(null, { status: 404 });
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

const LINEA = '51987654321';

/** Los mismos nombres y textos de la maqueta, para poder comparar contra el Figma. */
const FILAS: readonly {
  nombre: string;
  texto: string;
  horas: number;
  respondida?: boolean;
  ventanaEnHoras?: number | null;
  n?: number;
}[] = [
  { nombre: 'William Ayala Diestra', texto: 'Quiero más información sobre el Diploma de Inteligencia y Contrainteligencia', horas: 3, ventanaEnHoras: 2 },
  { nombre: 'Carmen Vílchez', texto: '¿El diplomado tiene certificado internacional?', horas: 3 },
  { nombre: 'Aurelio Ramos', texto: 'Y cuánto cuesta? nadie responde acá', horas: 5, ventanaEnHoras: 5 },
  { nombre: 'Marisol Sánchez', texto: 'Cuantas cuotas?', horas: 48, respondida: true },
  { nombre: 'Rosa Tineo', texto: 'Info porfavor 🙏', horas: 24, ventanaEnHoras: 20 },
  { nombre: 'Elma Tarratas', texto: '¡Hola! Completé el formulario y me gustaría recibir el temario', horas: 12 },
  { nombre: 'Elma Tarratas', texto: '¡Hola! Completé el formulario y me gustaría recibir el temario', horas: 12 },
  { nombre: 'Elma Tarratas', texto: '¡Hola! Completé el formulario y me gustaría recibir el temario', horas: 12 },
];

const CONVERSACIONES: Conversacion[] = FILAS.map((f, i) => {
  const cuando = new Date(Date.now() - f.horas * 3_600_000).toISOString();
  const telefono = `5198765${4321 + i}`;
  return {
    clave: `conv:whatsapp:${telefono}:${LINEA}`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: telefono,
    persona_nombre: f.nombre,
    lead_nombre: f.nombre,
    numero_propio: LINEA,
    texto: f.texto,
    contexto_texto: null,
    respondida: f.respondida ?? false,
    ya_le_hablamos: true,
    precio_enviado: false,
    etapa_efectiva: 'interesado',
    interes_curso: null,
    lead_curso: null,
    ventana_abierta: f.ventanaEnHoras != null,
    ventana_cierra:
      f.ventanaEnHoras != null
        ? new Date(Date.now() + f.ventanaEnHoras * 3_600_000).toISOString()
        : null,
    pregunto: true,
    pide_info: true,
    n: f.n ?? 5,
    referencia: cuando,
    ultimo_at: cuando,
    dias: Math.floor(f.horas / 24),
    etapa_desde: null,
    nivel: 0,
    // Con dueño, la fila dibuja su disco de agente (`dominio/dueno.ts`).
    // Sin este campo `marcaDeDueno` devuelve null — que es lo correcto, pero
    // deja la maqueta sin el tercer renglón que el Figma sí muestra.
    asignada_a: i % 4 === 3 ? 'luz' : 'kelly',
  } as unknown as Conversacion;
});

const cliente = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <div className="flex min-h-dvh items-center justify-center gap-8 bg-secondary/40 p-8">
        {/* El marco: 430×934, el tamaño del Figma. El borde y el radio son de la
            galería — el componente no dibuja ninguna cáscara de teléfono. */}
        <div data-marco className="h-[934px] w-[430px] shrink-0 overflow-hidden rounded-[22px] border border-border shadow-panel">
          <BandejaMovil
            conversaciones={CONVERSACIONES}
            avisoDelBot="bot: sin línea"
            onVolver={() => {}}
            onAbrir={() => {}}
          />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
