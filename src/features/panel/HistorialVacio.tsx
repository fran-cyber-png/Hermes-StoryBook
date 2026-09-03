/**
 * TODAVÍA NO PASÓ NADA — el hueco del timeline, dibujado.
 *
 * ══ POR QUÉ NO ES UNA FRASE ════════════════════════════════════════════════
 *
 * La regla de la casa (27-jul-2026, al pedir el rediseño de este mismo panel):
 * *«lo peor que podemos hacer es llenarlos de texto con datos vacíos que se
 * pueden mostrar con una buena UX/UI»*. Un hueco se dibuja con **la forma de lo
 * que falta** —riel punteado donde iba la historia, renglones fantasma— y el
 * matiz se mueve al `title` y al lector de pantalla, donde sigue existiendo sin
 * ocupar los 360 px de la columna.
 *
 * ══ POR QUÉ HACE FALTA ═════════════════════════════════════════════════════
 *
 * Antes de este frente, una conversación recién llegada tenía UN evento —«Nombre
 * identificado»— que repetía el título del encabezado. Al dejar de repetirlo, el
 * caso más común del módulo de campaña quedaba con **un encabezado de sección y
 * nada debajo**: peor que la redundancia, porque un rótulo sin contenido se lee
 * como algo que no cargó.
 *
 * ⚠️ **No parpadea.** Los renglones son estáticos, sin `animate-pulse`: un
 * esqueleto que late afirma «esto está por llegar», y acá no viene nada — no hay
 * nada que haya pasado todavía. Es la diferencia entre cargando y vacío, y
 * dibujarlos igual es cómo una pantalla vacía se disfraza de lenta.
 */
export function HistorialVacio() {
  return (
    <div
      className="relative mt-2 select-none pl-1"
      title="Todavía no hay nada registrado en esta conversación"
    >
      {/* El riel, punteado: es el mismo eje vertical sobre el que se apoyan los
          eventos reales (`EventoLinea`), en su versión «acá todavía no hay». */}
      <span
        aria-hidden
        className="absolute bottom-2 left-[8px] top-2 w-px border-l border-dashed border-border"
      />
      {[0, 1].map((i) => (
        <div key={i} aria-hidden className="relative flex items-center gap-3 py-1.5">
          <span className="relative z-10 size-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground/30 bg-card" />
          {/* Dos largos distintos: dos renglones iguales se leen como una tabla
              rota, y un historial real nunca tiene dos entradas del mismo ancho. */}
          <span
            className="h-2 rounded-full bg-muted"
            style={{ width: i === 0 ? '58%' : '38%' }}
          />
        </div>
      ))}
      <p className="sr-only">Todavía no hay nada registrado en esta conversación.</p>
    </div>
  );
}
