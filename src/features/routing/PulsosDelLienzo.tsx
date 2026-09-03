import { useEffect, useRef, useState } from 'react';
import { suscribirPulsoDeRuteo, type PulsoDeRuteo } from '../../lib/datos/pulsoDeRuteo';
import type { CableLienzo } from './reglasDelLienzo';

/**
 * EL PUNTITO QUE VIAJA — «acaba de caer un dato, y fue para ella».
 *
 * ══ 🔴 POR QUÉ ES UN COMPONENTE APARTE Y NO ESTADO DE `VistaRouting` ════════
 *
 * Medido corriendo el compilador sobre los dos archivos: **el React Compiler NO
 * optimiza `VistaRouting` ni `Lienzo`** (los dos dan `CompileError`). O sea que
 * un `useState` de pulsos arriba re-renderizaría el árbol ENTERO —hasta 185
 * filas de familia más todos los nodos— por cada lead que cae **y otra vez** al
 * apagarse el pulso. Con una ráfaga de doce leads son veinticuatro renders
 * completos en segundo y medio.
 *
 * Acá el estado vive en la hoja: un pulso re-renderiza este componente y nada
 * más. `Lienzo` sólo se vuelve a dibujar cuando cambian los cables de verdad.
 *
 * ══ LA ANIMACIÓN LA HACE SVG, NO REACT ══════════════════════════════════════
 *
 * `<animateMotion>` recorre el mismo `d` que ya calculó el lienzo, en el
 * compositor del navegador. Sin `requestAnimationFrame`, sin un `setState` por
 * cuadro: React sólo monta y desmonta el círculo. Es la diferencia entre
 * sesenta renders por segundo y dos por pulso.
 */

/** Un pulso ya resuelto a geometría. `d` ausente = llegó sin cable. */
interface PulsoEnVuelo {
  id: number;
  /** El trazo por el que viaja, o `null` si no hay cable (rueda, línea, recortado). */
  d: string | null;
  /** Dónde aterriza. Siempre presente: sin destino no se dibuja nada. */
  destino: { x: number; y: number };
  motivo: string;
  /** `revencida` se pinta distinto: no es un lead nuevo. */
  hecho: string;
}

/** Cuánto dura el viaje. Suficiente para seguirlo con el ojo, corto para no molestar. */
const VUELO_MS = 1400;

/**
 * 🔴 **TOPE DURO DE PULSOS SIMULTÁNEOS.** Sin esto, una ráfaga de la ingesta
 * —que en producción llega a 18 mensajes por minuto— llenaría la pantalla de
 * confeti y volvería el lienzo ilegible justo cuando más importa mirarlo. El
 * tope se aplica descartando los MÁS VIEJOS: lo que acaba de pasar es lo que
 * interesa.
 */
const TOPE = 12;

export function PulsosDelLienzo({
  trazos,
  anclas,
}: {
  /** Los trazos ya medidos por el lienzo: la misma geometría que ve el ojo. */
  trazos: readonly { d: string; cable: CableLienzo }[];
  /** Dónde entra cada nodo (su puerto izquierdo), por id de nodo. */
  anclas: ReadonlyMap<string, { x: number; y: number }>;
}) {
  const [vuelos, setVuelos] = useState<PulsoEnVuelo[]>([]);

  /**
   * 🔴 **La geometría entra por un `ref`, no por las dependencias del efecto.**
   * `trazos` y `anclas` son objetos nuevos en cada render del lienzo; si
   * estuvieran en las deps, la suscripción al SSE se desmontaría y remontaría en
   * cada render — y como cada pulso provoca un render, quedaría un ciclo
   * suscribir/desuscribir por evento. Con el ref, el efecto se suscribe UNA vez
   * y siempre lee la foto más nueva.
   */
  const geo = useRef({ trazos, anclas });
  geo.current = { trazos, anclas };

  const proximoId = useRef(0);

  useEffect(() => {
    return suscribirPulsoDeRuteo((p: PulsoDeRuteo) => {
      const vuelo = resolver(p, geo.current.trazos, geo.current.anclas, proximoId.current++);
      if (!vuelo) return;
      setVuelos((previos) => [...previos, vuelo].slice(-TOPE));
    });
  }, []);

  /**
   * ⚠️ **Una sola barrida para apagar los pulsos, no un temporizador por pulso.**
   * Doce timers independientes vencen en doce momentos distintos, y React no
   * agrupa `setState` entre tareas separadas: serían hasta doce renders más. Acá
   * un solo intervalo filtra los vencidos y hace un `setState` por barrida.
   *
   * Y sólo corre cuando hay algo en vuelo: con la pantalla quieta no queda un
   * intervalo despertando al navegador cada 300 ms para no hacer nada.
   */
  useEffect(() => {
    if (vuelos.length === 0) return;
    const t = setInterval(() => {
      const corte = Date.now() - VUELO_MS;
      setVuelos((previos) => {
        // `?? 0` y no `!`: un id sin fecha se apaga en vez de quedarse pegado
        // para siempre. Y el id ARRANCA EN 0, así que no se puede usar como
        // condición de verdad — el primer pulso de la sesión se apagaría al
        // instante y nadie lo vería.
        const vivos = previos.filter((v) => (nacido.get(v.id) ?? 0) > corte);
        if (vivos.length === previos.length) return previos;
        for (const v of previos) if (!vivos.includes(v)) nacido.delete(v.id);
        return vivos;
      });
    }, 300);
    return () => clearInterval(t);
  }, [vuelos.length]);

  if (vuelos.length === 0) return null;

  return (
    <>
      {vuelos.map((v) => (
        <g key={v.id} className={TONO[v.hecho] ?? TONO.alta}>
          {v.d ? (
            <>
              {/**
               * La ESTELA: el mismo recorrido, más grande y translúcida, con un
               * pelín de retraso. Es lo que hace que un punto de 6 px se lea como
               * algo que se MUEVE y no como un puerto más del nodo — que fue
               * exactamente lo que pasó en la primera captura.
               */}
              <circle r={11} fill="currentColor" opacity={0.18}>
                <animateMotion dur={`${VUELO_MS + 160}ms`} path={v.d} fill="freeze" />
              </circle>
              <circle r={6} fill="currentColor" stroke="var(--color-background)" strokeWidth={1.5}>
                {/* `fill="freeze"` deja el punto en el destino hasta que se
                    desmonta: sin eso vuelve al origen de un salto al terminar. */}
                <animateMotion dur={`${VUELO_MS}ms`} path={v.d} fill="freeze" />
              </circle>
            </>
          ) : (
            /**
             * 🔴 **SIN CABLE TAMBIÉN SE VE, y es el caso MAYORITARIO.** Medido en
             * producción: 3.637 asignaciones y CERO con motivo `campana`. Casi
             * todo cae por la rueda, que no tiene nodo de origen. Si el puntito
             * sólo existiera sobre un cable, la pantalla se vería quieta mientras
             * los leads siguen entrando — y quien la mire concluiría que el ruteo
             * está muerto. Éste llega desde el borde, sin origen que inventar.
             */
            <>
              <circle r={11} fill="currentColor" opacity={0.18}>
                <animateMotion dur={`${VUELO_MS + 160}ms`} path={desdeElBorde(v.destino)} fill="freeze" />
              </circle>
              <circle r={6} fill="currentColor" stroke="var(--color-background)" strokeWidth={1.5}>
                <animateMotion dur={`${VUELO_MS}ms`} path={desdeElBorde(v.destino)} fill="freeze" />
              </circle>
            </>
          )}
          {/* El halo al aterrizar: es lo que hace que se vea LLEGAR y no sólo pasar. */}
          <circle cx={v.destino.x} cy={v.destino.y} r={5} fill="none" stroke="currentColor" strokeWidth={2}>
            <animate attributeName="r" from={5} to={20} dur="600ms" begin={`${VUELO_MS - 300}ms`} fill="freeze" />
            <animate attributeName="opacity" from={0.9} to={0} dur="600ms" begin={`${VUELO_MS - 300}ms`} fill="freeze" />
          </circle>
        </g>
      ))}
    </>
  );
}

/** Cuándo nació cada pulso. Fuera del estado: cambiarlo no tiene que re-renderizar. */
const nacido = new Map<number, number>();

/**
 * 🔴 **SIN ORO, y no es una preferencia estética.** En este sistema el dorado
 * tiene un significado asignado —*«el dorado significa tiempo que se acaba,
 * nada más»*, `CLAUDE.md` y `index.css`— y por eso el propio `CableLienzo` lo
 * prohíbe en el lienzo: *«Sin oro: el dorado significa tiempo que se acaba y acá
 * no corre nada»*. Un lead que llega no es un plazo venciéndose; pintarlo dorado
 * le enseñaría a la vendedora a leer urgencia donde no la hay, y le sacaría
 * fuerza al dorado donde sí importa.
 *
 * Se usa la paleta `--cat-*`, la misma de los cables, con un verde para lo que
 * ENTRA (es una llegada, no una alerta) y el gris de siempre para lo que sólo
 * vuelve al circuito.
 */
const TONO: Record<string, string> = {
  /** Un lead nuevo entrando. */
  alta: 'text-cat-verde',
  /** Una conversación vencida que volvió: no es alguien nuevo, y se lee distinto. */
  revencida: 'text-muted-foreground',
  /** La movió una persona: el navy de las decisiones humanas del lienzo. */
  manual: 'text-navy-ink',
};

/**
 * DEL EVENTO A LA GEOMETRÍA. `null` = no se dibuja nada.
 *
 * 🔴 **EL DESTINO SE RESUELVE NORMALIZANDO LOS DOS LADOS.** Los nodos del lienzo
 * llevan la grafía que vino en `destinos` (`v:Luz`), y el reparto entrega la de
 * Cerberus (`Luz`) o la del login (`luz`) según de dónde salga. Comparar exacto
 * no da error: da que a Luz no le aparece NINGÚN puntito de lo suyo, para
 * siempre y sin síntoma — el mismo defecto que la auditoría del 12-ago encontró
 * en los cables (regla dura #4).
 */
export function resolver(
  p: PulsoDeRuteo,
  trazos: readonly { d: string; cable: CableLienzo }[],
  anclas: ReadonlyMap<string, { x: number; y: number }>,
  id: number,
): PulsoEnVuelo | null {
  // Sin destino el evento vino recortado: el lead no es de quien mira y no
  // supervisa. No se dibuja, y eso es la frontera funcionando (ADR 0059).
  if (!p.destino) return null;

  const buscado = normal(p.destino);
  let nodo: string | null = null;
  for (const clave of anclas.keys()) {
    if (clave.startsWith('v:') && normal(clave.slice(2)) === buscado) {
      nodo = clave;
      break;
    }
  }
  // La dueña no está en la columna: pasa de verdad —`cablesHuerfanos` lo
  // documenta— y dibujar un puntito hacia un punto inventado sería peor.
  if (!nodo) return null;

  const destino = anclas.get(nodo)!;

  /**
   * ⚠️ **Sólo se anima sobre un cable CONFIRMADO.** Mientras un PUT está en
   * vuelo la pantalla muestra cables `pendiente` que el server todavía no
   * aplicó; animar sobre uno afirmaría que el lead viajó por una regla que quizá
   * ni existe. Sin trazo confirmado, el puntito llega desde el borde: se pierde
   * el origen, no la verdad.
   */
  const trazo = trazos.find(
    (t) => t.cable.a === nodo && !t.cable.pendiente && t.cable.tipo === 'regla',
  );

  nacido.set(id, Date.now());
  return {
    id,
    d: trazo?.d ?? null,
    destino,
    motivo: p.motivo,
    hecho: p.hecho ?? 'alta',
  };
}

function normal(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * El recorrido de un lead SIN regla: entra por izquierda y aterriza en la
 * tarjeta. Los 110 px son suficientes para que el ojo vea el movimiento y
 * cortos para no cruzar la columna de al lado y parecer que sale de un producto.
 */
function desdeElBorde(destino: { x: number; y: number }): string {
  return `M ${Math.max(0, destino.x - 110)} ${destino.y} L ${destino.x} ${destino.y}`;
}
