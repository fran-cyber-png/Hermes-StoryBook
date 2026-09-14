/**
 * EL ÍCONO NEÓN — chapa SIN borde con el ícono en el color neón, y en hover el
 * ÍCONO se rellena de SU PROPIO color (nunca de un contraste, y la chapa no
 * cambia de color) — pedido del dueño, 11-sep-2026, sobre Llamar/Agendar/
 * Contacto ya sin texto en `BarraGestion`.
 *
 * 🔴 **Tuvo un halo y un relleno sólido de la chapa entera, y los dos se
 * retiraron el mismo día (pedido del dueño): «quita el efecto de halo… el
 * exterior del ícono no debe de tener color».** Sin glow y sin fondo que
 * cambia, lo único que se prende en hover es el ícono.
 *
 * Un solo lugar para el mismo reciclado exacto: los tres botones viven en
 * archivos distintos (`BotonLlamar`, `AgendarRapido`, `BarraGestion`) y sin
 * esto cualquier retoque futuro —el radio, el punto donde se prende el
 * relleno— quedaría copiado tres veces y a la próxima pasada uno de los tres
 * se queda atrás mudo (#37).
 *
 * ⚠️ **El relleno va en el ÍCONO, no acá.** `fill` es una propiedad de SVG que
 * SÍ hereda, pero el `<svg>` de lucide trae su propio `fill="none"` puesto
 * como atributo — y el valor propio de un elemento le gana a lo heredado del
 * padre, así que un `fill-current` puesto en el botón nunca lo pisa. Por eso
 * la clase del ÍCONO es aparte (`CLASE_RELLENO_HOVER`, con `group-hover:`) y
 * el botón necesita `group` — ver el uso en cualquiera de los tres archivos.
 * Como el ícono no trae su propia tinta, hereda la del botón (`text-*`, que NO
 * cambia en hover): el relleno sale del mismo color que el trazo, nunca de uno
 * de contraste.
 *
 * ⚠️ **La chapa en reposo NO es `bg-navy` a secas — es `bg-tile-neon`.** En
 * oscuro ese token vale `--navy` (la superficie de marca de siempre); en claro
 * vale un celeste sutil (`--secondary`). Sin esto el botón quedaría con una
 * chapa oscura fija encima de una tarjeta blanca, que es un tema oscuro
 * incrustado adentro del claro — no «ajustado», copiado.
 *
 * ⚠️ **SIN BORDE, y pasó por tres vueltas antes de llegar acá.** Del borde
 * por tono (`border-{tono}/50`) a uno más grueso, a uno neutro único
 * (`border-secondary`, `#EFF4FE`), de vuelta al de tono — y en la última
 * vuelta el dueño lo sacó del todo («conserva todo, pero quita el borde de
 * color», 11-sep-2026): la chapa sola, sin marco, es lo que se queda.
 *
 * ⚠️ **`success` y `primary` usan `--neon-success`/`--neon-primary`, NO
 * `--success`/`--primary` a secas.** El primer intento sí usaba el token
 * semántico, y contra la chapa clara (`bg-tile-neon` en tema claro) se veía
 * apagado — «no eran botones neón brillantes» (pedido del dueño, mismo día).
 * Son tonos DEDICADOS de este botón, fijos en los dos temas: el brillo es del
 * control, no algo que el tema deba resolver. `--gold` ya era vívido y se
 * queda igual.
 *
 * ⚠️ **`rounded-[11px]`, NO `rounded-lg` (que acá vale 12 px, `--radius`).**
 * Pedido del dueño, 11-sep-2026: que el radio iguale al del avatar cuadrado de
 * `CabeceraDeChat`/`HiloMessenger` (`size-8 rounded-[11px]`, las iniciales
 * «PW» de la cabecera) — mismo número que ese chip, no una redondez propia.
 *
 * ⚠️ **`size-7` fijo, NO `p-*` variable — pasó por `p-1.5`, después `p-1`, y
 * terminó igualado al botón de al lado.** Primero se pidió más chico que el
 * avatar «PW» (32 px); un pedido posterior fue más específico: del mismo
 * tamaño que «Asignar categoría» (`size-7` = 28 px, en `BarraGestion.tsx`) —
 * ese botón manda el número acá, no al revés, para que un retoque futuro de
 * cualquiera de los dos no vuelva a desalinear al otro.
 */
export const CLASE_RELLENO_HOVER = 'group-hover:fill-current';

export type TonoNeon = 'success' | 'primary' | 'gold';

export function claseIconoNeon(tono: TonoNeon): string {
  switch (tono) {
    case 'success':
      return 'group inline-flex size-7 shrink-0 items-center justify-center rounded-[11px] bg-tile-neon text-neon-success transition-colors duration-200';
    case 'primary':
      return 'group inline-flex size-7 shrink-0 items-center justify-center rounded-[11px] bg-tile-neon text-neon-primary transition-colors duration-200';
    case 'gold':
      return 'group inline-flex size-7 shrink-0 items-center justify-center rounded-[11px] bg-tile-neon text-gold transition-colors duration-200';
  }
}
