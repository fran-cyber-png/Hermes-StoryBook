/**
 * La voz de imprenta: helpers de formato compartidos entre vistas.
 *
 * tempClass/tempBorde son EL contrato único de la rampa de temperatura: tiñen
 * solo tinta de marcas de tiempo (y el filete de 2px del kanban) — jamás fondos
 * ni bordes en masa. El oro NO vive acá: la ventana de 20-24h la maneja quien
 * conoce la ventana, no esta rampa.
 */

/** Horas transcurridas desde una fecha hasta ahora. Acepta ISO, epoch ms o Date. */
export function horasDesde(fecha: string | number | Date): number {
  const t = typeof fecha === 'number' ? fecha : new Date(fecha).getTime();
  return (Date.now() - t) / 3_600_000;
}

/** Tinta para el "hace X" según la edad del dato. Fresco y tibio callan. */
export function tempClass(fecha: string | Date): string {
  const h = horasDesde(fecha);
  if (h < 72) return 'text-muted-foreground';
  if (h < 336) return 'text-temp-frio';
  return 'text-temp-helado';
}

/** Filete izquierdo (border-l) de temperatura para tarjetas del kanban. */
export function tempBorde(fecha: string | Date): string {
  const h = horasDesde(fecha);
  if (h < 24) return 'border-l-temp-fresco';
  if (h < 72) return 'border-l-temp-tibio';
  if (h < 336) return 'border-l-temp-frio';
  return 'border-l-temp-helado';
}

/**
 * EL FONDO DE LA TARJETA SEGÚN EL SEMÁFORO (D1, 8-sep-2026) — reemplaza a
 * `tempBorde` en la tarjeta del Pipeline (`TarjetaEmbudo.tsx`): «que agarre
 * presencia de fondo», un degradado suave del tinte a `--card`, no un filete.
 * Las clases viven en `src/index.css` (`.tarjeta-semaforo--*`) porque un
 * `color-mix()` de tres partes no entra cómodo en una clase arbitraria de
 * Tailwind. Gris (el default: todos llegan grises) no lleva clase — la
 * tarjeta se queda en `bg-card`, como cualquier tarjeta sin `luz`.
 *
 * ⚠️ `tempBorde` NO se toca ni se borra: `VistaDashboard.tsx` (otro frente)
 * lo sigue usando para su propio kanban.
 */
export function fondoSemaforo(luz: 'gris' | 'verde' | 'ambar' | 'rojo' | null | undefined): string {
  if (luz === 'verde') return 'tarjeta-semaforo--verde';
  if (luz === 'ambar') return 'tarjeta-semaforo--ambar';
  if (luz === 'rojo') return 'tarjeta-semaforo--rojo';
  return '';
}

/**
 * EL BORDE PUNTEADO DE LA PROPUESTA (ADR 0095: el borde dice quién afirmó).
 * `origen_semaforo === 'maquina'` = la razón que ganó salió del bot o del
 * reloj de inferencias (#792), todavía sin destapar (#797) — se dibuja
 * punteada. Ausente = derivado por Hermes mismo, se dibuja lleno.
 */
export function bordePropuestaSemaforo(origen: 'maquina' | null | undefined): string {
  return origen === 'maquina' ? 'tarjeta-semaforo--propuesta' : '';
}

/**
 * La marca del semáforo para la banda de 3px de la cola (`FilaConversacion.tsx`,
 * reemplaza a `TEMPERATURE_META`/`temperatureOf` de `features/leads/temperature.ts`
 * — ESE archivo no se toca porque el Dashboard y el Padrón, de otro frente,
 * siguen usándolo para su propia temperatura por antigüedad).
 */
export const SEMAFORO_META: Record<'gris' | 'verde' | 'ambar' | 'rojo', { bar: string }> = {
  gris: { bar: 'bg-sem-gris' },
  verde: { bar: 'bg-sem-verde' },
  ambar: { bar: 'bg-sem-ambar' },
  rojo: { bar: 'bg-sem-rojo' },
};

/** '51986394450' → '51 986 394 450' (código de país + tríos). */
export function formatoTelefono(t: string): string {
  const digitos = t.replace(/\D/g, '');
  if (digitos.length < 8) return t;
  const cc = digitos.length > 9 ? digitos.slice(0, digitos.length - 9) : '';
  const resto = digitos.slice(cc.length);
  const grupos = resto.match(/.{1,3}/g) ?? [resto];
  return [cc, ...grupos].filter(Boolean).join(' ');
}

/**
 * Los meses de la fecha corta, escritos acá y no pedidos a ICU:
 * `toLocaleDateString('es')` abrevia septiembre «sept» y los otros once en tres
 * letras, así que una columna de fechas dejaba de alinear justo ese mes (medido
 * el 10-sep-2026, `formato.test.ts`).
 */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** '2026-03-12…' → '12 mar 2026'. Si no parsea, devuelve el crudo tal cual. */
export function fechaCorta(f: string): string {
  const ms = Date.parse(f);
  if (Number.isNaN(ms)) return f;
  const d = new Date(ms);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * UNA CIFRA ENTERA CON SEPARADOR DE MILES SIEMPRE: «7.025», nunca «7025».
 *
 * `toLocaleString('es')` no agrupa por debajo de 10.000 (regla de CLDR para el
 * español), y en una franja de conteos eso dejaba «7025» al lado de «73.200».
 * Tampoco depende del ICU del entorno: un node compilado con `small-icu` devuelve
 * «20,000», y un test que afirma sobre el texto exacto se vuelve un flake.
 *
 * ⚠️ **Es UNA sola función para toda la app.** Correos tenía su propia copia
 * (`conMiles`, con la misma expresión) para que el contador del composer y el
 * motivo del tope contaran la misma cadena de la misma manera; dos copias son
 * justo la forma de que dejen de hacerlo (#37). Es para contar enteros: los
 * decimales no pasan por acá.
 */
export function cifra(n: number): string {
  const entero = String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${entero}` : entero;
}

/**
 * «recién» / «hace 40 min» / «hace 2 h» / «hace 3 días» — a partir de una fecha
 * ISO. Compartida (antes vivía copiada en `VistaCorreos.tsx` y de nuevo en
 * `PanelNotas.tsx`; una tercera copia fue la señal de sacarla para acá).
 * Distinta de `datos/frescura.ts#hace`, que recibe HORAS ya calculadas (esa
 * vive aparte porque su reloj es inyectable — la usa el sello de "caché
 * viejo" con `Date.now()` como parámetro, no como global).
 */
export function hace(fecha: string): string {
  const ms = Date.now() - new Date(fecha).getTime();
  if (Number.isNaN(ms)) return '';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}
