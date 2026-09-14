import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import type { ClavePeriodo } from './negocio';

/**
 * EL PANEL DE LA CAMPAÑA — la lectura propia del módulo `campana` (ADR 0063).
 *
 * El server (`server/src/dashboard/campana.ts`) manda los conteos crudos; acá
 * viven sólo las derivaciones de PRESENTACIÓN — el rótulo de cada franja y el
 * formato de una espera en minutos. Nada de aritmética de negocio: si la
 * pantalla necesitara recalcular una métrica, el seam estaría incompleto.
 *
 * 🔴 **DESDE EL 4-SEP-2026 SÍ SABE DE TERRITORIO Y DE TEMAS, y lo que cambió no
 * es la promesa sino de dónde salen los nombres.** Este docblock decía que era
 * imposible «porque el diccionario es de UNA candidatura, y clavarlo acá
 * rompería ADR 0063». Seguía siendo cierto: lo que faltaba era que el
 * diccionario fuera **dato del cliente** y no constante del producto. Ahora vive
 * en `server/src/campana/reporte/diccionarios/`, uno por `cliente_id`, y la
 * segunda candidatura sigue entrando sin tocar código — que era la promesa que
 * había que no romper.
 *
 * ⚠️ **El front no tiene el diccionario ni lo necesita**: el server manda los
 * nombres ya resueltos. Traerlo acá sería la misma regla en dos paquetes.
 */

export const FRANJAS = ['madrugada', 'manana', 'tarde', 'noche'] as const;
export type Franja = (typeof FRANJAS)[number];

/** Cómo se llama y a qué horas va cada franja, para la pantalla. */
export const ROTULO_FRANJA: Record<Franja, { nombre: string; horas: string }> = {
  madrugada: { nombre: 'Madrugada', horas: '12 a 6 a. m.' },
  manana: { nombre: 'Mañana', horas: '6 a. m. a 12 m.' },
  tarde: { nombre: 'Tarde', horas: '12 m. a 6 p. m.' },
  noche: { nombre: 'Noche', horas: '6 p. m. a 12 p. m.' },
};

export interface PuntoFranja {
  franja: Franja;
  personas: number;
  atendidas: number;
  demora_mediana_min: number | null;
  entrantes: number;
}

export interface Apertura {
  texto: string;
  personas: number;
  solo_eso: number;
}

export interface FilaEquipoCampana {
  operador: string;
  /** Cómo se llama, de la tabla `equipo`. `null` si no está dada de alta. */
  nombre: string | null;
  envios: number;
  personas: number;
  leidos: number;
  automaticos: number;
}

/** Un tema o un lugar con su conteo. El nombre lo resuelve el server. */
export interface ConteoEscucha {
  clave: string;
  nombre: string;
  n: number;
}

export interface ConteoLugar extends ConteoEscucha {
  esProvincia: boolean;
}

export interface BloqueDeCanal {
  total: number;
  sustancia: number;
  temas: ConteoEscucha[];
  lugares: ConteoLugar[];
  /** Cuántos mensajes llevan cada marca. Un mensaje puede llevar varias. */
  marcas: Record<string, number>;
}

/** Las superficies por las que se puede filtrar. Espeja `campana/reporte/superficie.ts`. */
export const CANALES = ['todas', 'muro', 'whatsapp', 'messenger', 'instagram'] as const;
export type CanalEscucha = (typeof CANALES)[number];

/** Cómo se llama cada canal en pantalla. */
export const NOMBRE_CANAL: Record<CanalEscucha, string> = {
  todas: 'Todos',
  muro: 'Facebook',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export interface Escucha {
  /**
   * 🔴 LOS TRES VACÍOS SIGNIFICAN COSAS DISTINTAS. `sin_cliente` es config que
   * falta (la línea no está asociada a ninguna candidatura), `sin_diccionario`
   * es que nadie escribió el suyo, y `ok` con todo en cero es que de verdad
   * nadie escribió. El panel dice cuál, porque un cero a secas manda a buscar el
   * problema al lugar equivocado.
   */
  estado: 'ok' | 'sin_cliente' | 'sin_diccionario';
  cliente: string | null;
  version: number | null;
  /** Mensajes del período que todavía no pasaron por `campana:clasificar`. */
  pendientes: number;
  canales: Record<CanalEscucha, BloqueDeCanal>;
}

export interface DatosCampana {
  rango: { desde: string; hasta: string };
  periodo: ClavePeriodo | 'libre';
  lineas: string[];
  gente: { escribieron: number; respondidas: number; sin_responder: number; nuevas: number };
  mensajes: { entrantes: number; salientes: number; entrantes_sin_texto: number };
  franjas: PuntoFranja[];
  dias: { dia: string; entrantes: number; salientes: number }[];
  aperturas: Apertura[];
  equipo: FilaEquipoCampana[];
  escucha: Escucha;
}

export function useCampana(params: {
  periodo: ClavePeriodo;
  /** El panel escanea el histórico de las líneas: no se pide si nadie lo mira. */
  activo: boolean;
}) {
  return useQuery({
    queryKey: ['dashboard', 'campana', params.periodo],
    queryFn: () => api<DatosCampana>(`/api/dashboard/campana?periodo=${params.periodo}`),
    enabled: params.activo,
    // Mismo criterio que «El negocio»: se mira, se piensa y se cambia de
    // período. Un número que se mueve solo mientras lo lees es ruido.
    staleTime: 60_000,
    placeholderData: (previo) => previo,
  });
}

// ── Derivaciones de presentación ─────────────────────────────────────────────

/**
 * UNA ESPERA, EN CASTELLANO. Minutos hasta la hora; de ahí, horas con un decimal.
 *
 * ⚠️ No redondea a «1 h» una espera de 95 minutos: la diferencia entre hora y
 * media y once horas es toda la información que este panel tiene para dar.
 */
export function esperaEnPalabras(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos < 1) return 'al toque';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = minutos / 60;
  return horas >= 10 ? `${Math.round(horas)} h` : `${horas.toFixed(1).replace('.', ',')} h`;
}

/**
 * ¿ESTA FRANJA ESTÁ EN PROBLEMAS? — el umbral que pinta la barra de rojo.
 *
 * Media hora es el criterio del comando: más que eso y la persona ya se fue a
 * hacer otra cosa. Vive acá, en un solo lugar, y no repetido en el JSX.
 */
export const ESPERA_QUE_PREOCUPA_MIN = 30;

export function franjaEnProblemas(p: PuntoFranja): boolean {
  return p.demora_mediana_min !== null && p.demora_mediana_min > ESPERA_QUE_PREOCUPA_MIN;
}

/**
 * ⚠️ CUATRO RAYITAS Y CUATRO BARRAS VACÍAS NO DICEN POR QUÉ.
 *
 * Cuando nadie contestó en el período no hay ninguna mediana que medir, así que
 * las cuatro franjas dibujan «—» sobre una pista en blanco. El dato es correcto
 * y la lectura no: se ve igual que un bloque roto. Con la base de Betto pasa en
 * los cuatro períodos —27.313 entrantes y **cero** salientes— y en producción
 * pasa cualquier día en que nadie alcance a responder.
 */
export function nadieRespondio(franjas: PuntoFranja[]): boolean {
  return franjas.length > 0 && franjas.every((f) => f.demora_mediana_min === null);
}


// ── Lo que la escucha derivó, en castellano ──────────────────────────────────

/**
 * QUÉ PROPORCIÓN DICE ALGO MÁS QUE APLAUDIR.
 *
 * 🔴 Es el número que hace que todo lo demás signifique algo. Medido el
 * 4-sep-2026 en la campaña de Betto: **13,9 %** de 6.231 mensajes. Sin esta
 * proporción al lado, «57 pidieron agua» se lee como desinterés cuando en
 * realidad es 57 sobre 866 que dijeron algo, no sobre 6.231 que saludaron.
 */
export function porcentajeDeSustancia(b: BloqueDeCanal): number | null {
  return b.total === 0 ? null : Math.round((b.sustancia * 1000) / b.total) / 10;
}

/**
 * ⚠️ **UN CANAL SIN MENSAJES NO SE OFRECE.** El chip de Instagram con «0» al
 * lado invita a hacer clic para ver una pantalla vacía — y en esta campaña
 * Instagram no recibe un comentario desde julio de 2025. Se muestran los que
 * tienen algo, más «Todos», que siempre está.
 */
export function canalesConAlgo(e: Escucha): CanalEscucha[] {
  return CANALES.filter((c) => c === 'todas' || (e.canales[c]?.total ?? 0) > 0);
}

/**
 * CUÁNTA GENTE MANDÓ LA PLANTILLA DEL ANUNCIO Y NO ESCRIBIÓ NADA MÁS.
 *
 * Medido: **72 %** (161 de 224). El link de clic-a-WhatsApp abre el chat con el
 * mensaje ya escrito, la persona lo manda tal cual y se va. El panel muestra la
 * proporción y no sólo el número, porque «161» sin denominador no dice si es
 * mucho o poco.
 */
export function porcentajeQueNoEscribioNada(a: Apertura): number | null {
  return a.personas === 0 ? null : Math.round((a.solo_eso * 100) / a.personas);
}

/**
 * UN NÚMERO, CON SEPARADOR DE MILES. Vive acá para que las dos mitades del
 * panel escriban la misma cifra igual.
 *
 * ⚠️ **El bloque de escucha imprimía los suyos crudos** — «de 6082 mensajes»
 * al lado de un «341» ya formateado, en la misma pantalla y a dos tarjetas de
 * distancia. Con cuatro y cinco dígitos, que es todo lo que este panel muestra,
 * la diferencia se nota.
 */
export function numero(n: number): string {
  return n.toLocaleString('es-PE');
}

/**
 * UN PORCENTAJE, SIEMPRE CON UN DECIMAL.
 *
 * ⚠️ `porcentajeDeSustancia` devuelve un número, así que un 12,0 se imprimía
 * **«12 %»** mientras el de al lado decía «13,9 %»: la cifra héroe del bloque
 * cambiaba de forma según el canal, y se lee como si midiera otra cosa. Medido
 * con el corpus de Betto: pasa en 7 días · Facebook y en 7 días · Messenger.
 */
export function porcentajeEnPalabras(pct: number | null): string {
  return pct === null ? '—' : `${pct.toFixed(1).replace('.', ',')} %`;
}

/**
 * 🔴 EL VACÍO TIENE QUE NOMBRAR EL CANAL QUE SE ESTÁ MIRANDO.
 *
 * El texto era uno solo y explicaba **el muro** («la mayoría de los comentarios
 * son aliento») aunque el chip activo fuera WhatsApp. Se ve con datos reales:
 * en «Hoy · WhatsApp» hay 3 mensajes y ningún tema, y el panel se justificaba
 * hablando de otra superficie. Un vacío que explica el canal equivocado es peor
 * que un vacío sin explicación: manda a buscar la causa donde no está.
 */
export function sinTemas(canal: CanalEscucha): string {
  if (canal === 'muro') {
    return 'Nadie nombró un tema concreto en el muro en este período: casi todo lo que llega es aliento.';
  }
  if (canal === 'todas') return 'Nadie nombró un tema concreto en este período, en ningún canal.';
  return `Nadie nombró un tema concreto por ${NOMBRE_CANAL[canal]} en este período.`;
}

export function sinProvincias(canal: CanalEscucha): string {
  if (canal === 'todas') return 'Todavía nadie nombró una provincia.';
  return `Todavía nadie nombró una provincia por ${NOMBRE_CANAL[canal]}.`;
}

/**
 * 🔴 EL CANAL ELEGIDO PUEDE DEJAR DE EXISTIR AL CAMBIAR DE PERÍODO, y sin esto
 * el panel se queda en un canal que ya no está.
 *
 * `canalesConAlgo` sólo ofrece los que tienen mensajes EN ESTE período, pero la
 * elección vive en el estado del panel y sobrevive al cambio. Elegir Messenger
 * en «90 días» y volver a «Hoy» dejaba el chip sin dibujar y las tres tarjetas
 * en cero: sin un solo chip activo, sin error y sin nada que explicara el vacío.
 * Se cae a «Todos», que siempre está, y cuando el canal vuelve a tener algo la
 * elección se respeta de nuevo.
 *
 * ⚠️ Con el corpus de Betto NO se puede llegar a mano —los cuatro canales tienen
 * mensajes en los cuatro períodos, e Instagram no tiene en ninguno, así que
 * nunca se ofrece—. El candado es un test, no una captura.
 */
export function canalEfectivo(e: Escucha | undefined, elegido: CanalEscucha): CanalEscucha {
  if (!e || e.estado !== 'ok') return elegido;
  return canalesConAlgo(e).includes(elegido) ? elegido : 'todas';
}

/**
 * DE DÓNDE SALE LO QUE ESTE BLOQUE LEE — y no se puede afirmar de antemano.
 *
 * 🔴 La frase existe porque los dos universos se leen como un error: arriba
 * «3 recibidos» y acá abajo «Todos 116», en la misma pantalla y sin nada en el
 * medio. Que sean dos es deliberado (ADR 0092) — meter los 4.543 comentarios
 * del muro en «Siguen sin respuesta» la volvería una alarma de 4.000 que nadie
 * puede accionar.
 *
 * ⚠️ **Pero prometer el muro cuando no hay muro es el mismo defecto al revés.**
 * ADR 0092 deja escrito que `numeros_wa.cliente_id` es config a mano; una
 * candidatura con su línea y sin Páginas de Meta —o con Páginas sin nada en el
 * período— leería una promesa que el panel no está cumpliendo, y sus chips ni
 * se ofrecen (`canalesConAlgo`). Así que la frase se deriva de lo que hay.
 */
export function explicacionDelUniverso(e: Escucha): string {
  const hayMeta = CANALES.some(
    (c) => c !== 'todas' && c !== 'whatsapp' && (e.canales[c]?.total ?? 0) > 0,
  );
  return hayMeta
    ? 'Lee el muro y los privados de la Página, además de la línea de WhatsApp. Los tres bloques de arriba miden sólo la línea.'
    : 'En este período sólo llegaron mensajes por la línea de WhatsApp.';
}

/**
 * DE QUÉ SUBCONJUNTO SALE UNA LISTA — porque las listas cortan a seis filas y
 * no lo decían.
 *
 * 🔴 Medido con el corpus de Betto en 30 días: «Qué piden» mostraba 6 temas de
 * **13**, y «De dónde hablan» 6 provincias de **20**. Media lista escondida se
 * lee como la lista entera, y entonces «no hablan de seguridad» pasa a ser una
 * conclusión sobre datos que sí están y no se dibujaron.
 *
 * ⚠️ Y en «De dónde hablan» el rótulo hace un segundo trabajo: la lista filtra
 * los distritos y se queda sólo con provincias —20 de 40 lugares en ese mismo
 * corte—, cosa que el título «De dónde hablan» no dice por ningún lado.
 */
export function resumenDeTemas(total: number, visibles: number): string {
  if (total === 0) return '';
  if (total === 1) return 'Un solo tema nombrado en el período.';
  if (total <= visibles) return `Los ${total} temas nombrados en el período.`;
  return `Los ${visibles} más nombrados, de ${total} temas.`;
}

export function resumenDeProvincias(total: number, visibles: number): string {
  if (total === 0) return '';
  if (total === 1) return 'Una sola provincia nombrada en el período.';
  if (total <= visibles) return `Las ${total} provincias nombradas en el período.`;
  return `Las ${visibles} más nombradas, de ${total} provincias.`;
}


/**
 * CÓMO SE LLAMA QUIEN ATIENDE — y por qué el id no sirve como nombre.
 *
 * 🔴 En un comando de campaña los `vendedora_id` son `centurion:usuario4`,
 * `centurion:job.meneses`… El bloque «Quién atiende» los mostraba crudos, así
 * que el jefe de campaña abría el panel, no reconocía a nadie y concluía que
 * estaba roto — con los números perfectamente bien. Lo reportó el dueño así:
 * «creo que no está jalando bien quién atiende».
 *
 * El orden de preferencia, y cada escalón existe por algo:
 *   1. **El nombre de `equipo`** («Andrea», «Job Meneses»). Es el único que una
 *      persona reconoce.
 *   2. **El id sin el prefijo del namespace**, para quien todavía no está dado
 *      de alta. `centurion:` dice de qué sistema viene la credencial, no quién
 *      es — y en este panel TODOS vienen del mismo, así que es una columna de
 *      ruido repetida en cada fila.
 *   3. **El id crudo**, si no hay ni eso. Nunca vacío: una fila sin etiqueta con
 *      280 envíos al lado es peor que una fea.
 *
 * ⚠️ **No se inventa un nombre bonito a partir del id.** «usuario4» se queda
 * «usuario4»: convertirlo en «Usuario 4» sugiere que el sistema sabe quién es
 * cuando no lo sabe, y esconde justo lo que hay que arreglar —que a esa persona
 * le falta el alta en `equipo`.
 */
export function nombreDeOperador(fila: { operador: string; nombre: string | null }): string {
  const nombre = fila.nombre?.trim();
  if (nombre) return nombre;
  const sinNamespace = fila.operador.includes(':')
    ? fila.operador.slice(fila.operador.indexOf(':') + 1).trim()
    : fila.operador.trim();
  return sinNamespace || fila.operador;
}

/**
 * ¿A esta persona le falta el alta en `equipo`? El panel lo marca en vez de
 * disimularlo: es config que falta, y sin señal nadie la va a poner nunca.
 */
export function operadorSinAlta(fila: { nombre: string | null }): boolean {
  return !fila.nombre?.trim();
}
