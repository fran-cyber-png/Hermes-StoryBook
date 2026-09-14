import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { LecturaLinea } from './LecturaLinea';
import type { Afirmacion, Veredicto } from '../../dominio/lecturas';

/**
 * LAS LECTURAS DEL SISTEMA EN EL TIMELINE — la evidencia de #784, sin server.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-lecturas.html
 *     …?movil=1             →  al ancho de la hoja de contacto en un teléfono
 *
 * Entry APARTE de la app (`vite build` compila sólo `index.html`), así que esto
 * no entra al bundle de las vendedoras.
 *
 * 🔴 **SEIS CASOS DISTINTOS, no seis veces el mismo**, que es lo que hace que la
 * captura pruebe algo. De arriba abajo: una lectura pendiente con su cita · una
 * corregida (el valor viejo tachado al lado del nuevo) · una aceptada · una sin
 * evidencia, que no puede ofrecer el ancla · una que no admite corrección porque
 * su lista no es cerrada · y una que afirmó una persona, que no pide veredicto.
 *
 * ⚠️ **Nombres ficticios y mensajes parafraseados.** Los lugares y temas sí son
 * los del diccionario de la campaña, y las reglas son las reales.
 */

const HOY = new Date();
const aLas = (h: number, m: number) =>
  new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate(), h, m).toISOString();

const CASOS: Afirmacion[] = [
  {
    id: 'af:1',
    dimension: 'postura',
    valor: 'pide agua',
    detalle: 'Huarmey',
    regla: 'escucha.apoyo',
    origen: 'sistema',
    confianza: 'alta',
    evidencia: 'int:9001',
    cita: 'pide agua para su sector y dice que va a ganar',
    ocurridoAt: aLas(10, 42),
  },
  {
    id: 'af:2',
    dimension: 'compromiso',
    valor: 'simpatiza',
    regla: 'escucha.apoyo',
    origen: 'sistema',
    confianza: 'alta',
    evidencia: 'int:9001',
    cita: 'pide agua para su sector y dice que va a ganar',
    ocurridoAt: aLas(10, 42),
  },
  {
    // Corregida: las dos cosas en la misma fila, el valor viejo tachado.
    id: 'af:3',
    dimension: 'postura',
    valor: 'se opone',
    regla: 'escucha.apoyo',
    origen: 'sistema',
    confianza: 'media',
    evidencia: 'int:8890',
    cita: 'aplaude al candidato y le pega a los rivales',
    ocurridoAt: aLas(9, 58),
    veredicto: 'corrige',
    corregidoA: 'apoya',
    corregidoPor: 'Luz',
  },
  {
    // Sin evidencia: la fila existe igual y NO ofrece un ancla que no lleva a nada.
    id: 'af:4',
    dimension: 'postura',
    valor: 'indeciso',
    regla: 'escucha.apoyo',
    origen: 'sistema',
    confianza: 'baja',
    ocurridoAt: aLas(9, 30),
  },
  {
    // El lugar no admite corrección: su lista son los distritos del catálogo.
    id: 'af:5',
    dimension: 'lugar',
    valor: 'Sihuas',
    regla: 'escucha.lugar',
    origen: 'sistema',
    confianza: 'alta',
    evidencia: 'int:8700',
    cita: 'pide una reunión con el equipo en su barrio',
    ocurridoAt: aLas(9, 12),
  },
  {
    // Lo afirmó una persona: es un hecho, no pide veredicto.
    id: 'af:6',
    dimension: 'compromiso',
    valor: 'se comprometió',
    regla: 'gestion_declarada',
    origen: 'persona',
    corregidoPor: 'Luz',
    ocurridoAt: aLas(8, 55),
  },
];

function Galeria() {
  const movil = new URLSearchParams(location.search).get('movil') === '1';
  /** Lo que un clic escribiría. Se dibuja para que la captura muestre el efecto. */
  const [hechos, setHechos] = useState<string[]>([]);
  const [resueltas, setResueltas] = useState<Record<string, Veredicto>>({});

  return (
    <div className="min-h-dvh bg-background p-6 text-foreground">
      <div className="mx-auto flex flex-wrap items-start gap-8">
        <section style={{ width: movil ? 358 : 372 }}>
          <h2 className="mb-2 font-heading text-sm font-bold text-navy-ink">
            Lo que el sistema leyó
          </h2>
          <div className="rounded-2xl border border-border bg-card p-3">
            <ul className="list-none">
              {CASOS.map((a, i) => (
                <LecturaLinea
                  key={a.id}
                  a={resueltas[a.id] ? { ...a, veredicto: resueltas[a.id] } : a}
                  esUltima={i === CASOS.length - 1}
                  onVeredicto={(id, veredicto, regla, valor) => {
                    setResueltas((r) => ({ ...r, [id]: veredicto }));
                    setHechos((h) => [
                      ...h,
                      `${veredicto} · ${regla}${valor ? ` → ${valor}` : ''}`,
                    ]);
                  }}
                  onVerMensaje={(evidencia) =>
                    setHechos((h) => [...h, `ir al mensaje ${evidencia}`])
                  }
                />
              ))}
            </ul>
          </div>
        </section>

        {/*
          🔴 **QUÉ SE ESCRIBIRÍA, A LA VISTA.** Sin esto la captura probaría que
          los botones se dibujan, que es la mitad fácil. Lo que este ticket
          promete es que la corrección quede **contra la regla** —de ahí sale la
          precisión por regla (ADR 0095 §8)— y eso sólo se puede mostrar
          enseñando el argumento con el que se llama al handler.
        */}
        <section style={{ width: 300 }}>
          <h2 className="mb-2 font-heading text-sm font-bold text-navy-ink">
            Lo que se registraría
          </h2>
          <div className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs">
            {hechos.length === 0 ? (
              <p className="text-muted-foreground">
                Toca «Está bien» o «Corregir» en una fila: acá se ve contra qué regla queda.
              </p>
            ) : (
              <ul className="list-none space-y-1 font-mono text-[11px] text-foreground">
                {hechos.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <Galeria />
  </StrictMode>,
);
