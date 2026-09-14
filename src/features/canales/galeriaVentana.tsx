import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { BarraFiltros } from './BarraFiltros';
import { opcionesDeLinea } from './alcance';
import { FilaConversacion } from './FilaConversacion';
import type { Conversacion } from '../../dominio/conversaciones';
import type { LineaWhatsapp } from '../../dominio/lineas';

/**
 * LA GALERÍA DE LA VENTANA DE CONVERSACIÓN — la evidencia, sin server ni base.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-ventana.html
 *
 * Existe por la regla dura #2 (nada de UI se reporta listo sin captura) y para
 * poder mirar de una las cuatro cosas que este frente decide:
 *
 *  1. **Tres colores: verde 24→12 h, amarillo 11→6 h, rojo 5 h→1 min** (reemplaza al oro,
 *     20-ago-2026). Antes toda ventana abierta salía dorada; con 6 días por
 *     delante ni el oro ni el rojo dirían «ahora».
 *  2. **Una ventana cerrada no dibuja nada.** El plazo es duro solo en la línea
 *     de la Cloud API — decir «cerrada» sería falso en tres de cuatro líneas.
 *  3. **WhatsApp ahora tiene ventana.** Hasta acá la marca era de comentarios, y
 *     Goberna vende por WhatsApp.
 *  4. **El chip lleva su número** y no se come el renglón del preview.
 */

/**
 * LAS DOS LÍNEAS QUE CORREN EN PRODUCCIÓN, con su transporte real. Sin esto la
 * galería no puede mostrar el caso que motivó el frente: la MISMA cuenta
 * regresiva se dibuja en la línea de Cloud API y NO en la de whatsmeow, porque
 * allá Meta rechaza a las 24 h (131047) y acá no rechaza nada.
 */
const LINEAS_VIVAS: LineaWhatsapp[] = [
  { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', transporte: 'cloud-api' },
  { numero: '51963139984', etiqueta: 'Campaña Betto', estado: 'conectado', transporte: 'whatsmeow' },
];

const AHORA = Date.now();
const en = (ms: number) => new Date(AHORA + ms).toISOString();
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const HORA = 3_600_000;
const DIA = 24 * HORA;

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:51984429504`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51984429504',
    texto: 'Buenas, quería consultar por el diploma. ¿Cuánto sale y en cuántas cuotas se puede?',
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: true,
    n: 2,
    referencia: haceHoras(3),
    ultimo_at: haceHoras(3),
    dias: 0,
    nivel: 0,
    ...over,
  };
}

/** Las cuatro líneas vivas de producción — es el caso que rompía la barra de una pista. */
const LINEAS = [
  { numero: '51986394450', etiqueta: 'Ventas Perú', estado: 'conectado', mias: true },
  { numero: '51941654039', etiqueta: 'Walter Ventas', estado: 'conectado' },
  { numero: '51944531711', etiqueta: 'Venta Perú', estado: 'conectado' },
  { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true },
];

const CASOS: { titulo: string; nota: string; filas: Conversacion[] }[] = [
  {
    titulo: 'WhatsApp — la escala de tres colores, con sus dos bordes',
    nota:
      'Verde de 24 h a 12 h · amarillo de 11 h a 6 h · rojo de 5 h a 1 min (decisión del dueño, 20-ago-2026). ' +
      'Las seis filas cubren las tres bandas Y los dos bordes exactos. 🔴 El número y el color NUNCA se ' +
      'contradicen, y no es casualidad: `cuantoFalta` redondea para ABAJO, así que un «12 h» es siempre ' +
      '≥ 12 h (verde) y un «11 h» es siempre < 12 h (amarillo). Por eso alcanza con leer el número.',
    filas: [
      fila({
        persona_id: '51988111222',
        persona_nombre: 'Javier Ríos',
        ventana_cierra: en(20 * HORA),
        // ⚠️ La referencia va A MANO y no con el default de `fila()` (3 h): con
        // una ventana de 20 h, los dos relojes tienen que sumar 24. Sin esto la
        // galería mostraba «19 h» junto a «hace 3 horas» — o sea, reproducía la
        // desincronización aparente que este mismo bloque explica.
        referencia: haceHoras(4),
        texto: 'Me interesa el diploma de Gestión Pública, ¿cuándo empieza?',
      }),
      fila({
        persona_id: '51988222333',
        persona_nombre: 'Nélida Paredes',
        // 🔴 EL BORDE DE ARRIBA, y hay que sumarle un minuto a mano: `en(12*HORA)`
        // ya perdió unos ms para cuando esto se dibuja, así que caería en 11 h 59
        // y saldría AMARILLO — el borde quedaría sin probar, mostrando la banda
        // de al lado. Es la misma trampa que dejaba esta galería sin ningún caso
        // amarillo: `en(6*HORA)` se leía «5 h» y salía rojo.
        ventana_cierra: en(12 * HORA + 60 * 1000),
        referencia: haceHoras(12),
        texto: 'Gracias, lo reviso y te escribo.',
      }),
      fila({
        persona_id: '51988333444',
        persona_nombre: 'Marta Quispe',
        ventana_cierra: en(9 * HORA),
        referencia: haceHoras(15),
        texto: 'Perfecto, lo converso con mi esposo y te aviso.',
      }),
      fila({
        persona_id: '51988444555',
        persona_nombre: 'Elber Ticona',
        /** El borde de abajo del amarillo: 6 h justas + un minuto. */
        ventana_cierra: en(6 * HORA + 60 * 1000),
        referencia: haceHoras(18),
        texto: '¿Me pasas el temario completo?',
      }),
      fila({
        persona_id: '51988555666',
        persona_nombre: 'Luis Ccahuana',
        ventana_cierra: en(5 * HORA),
        referencia: haceHoras(19),
        texto: '¿Sigue vigente el precio que me pasaste?',
      }),
      fila({
        persona_id: '51988777888',
        persona_nombre: 'Rosa Huamán',
        ventana_cierra: en(25 * 60 * 1000),
        referencia: haceHoras(23),
        texto: 'Ya hice el depósito, te mando el voucher.',
      }),
    ],
  },
  {
    titulo: 'La ventana cerrada NO se dibuja — se dice a quién sí, nunca a quién no',
    nota: 'Escribió hace 30 h. En la línea de la Cloud API Meta ya solo acepta una plantilla; en la línea whatsmeow no rechaza nada. Una píldora que dijera «cerrada» sería falsa ahí — y desde este frente, en whatsmeow tampoco se dibuja la cuenta regresiva.',
    filas: [
      fila({
        persona_id: '51988999000',
        persona_nombre: 'Carmen Loayza',
        ventana_cierra: en(-6 * HORA),
        referencia: haceHoras(30),
        dias: 1,
        nivel: 3,
        texto: '¿Me pasas el temario completo?',
      }),
      fila({
        persona_id: '51988999111',
        persona_nombre: 'Pedro Salas',
        ventana_cierra: null,
        referencia: haceHoras(72),
        dias: 3,
        nivel: 4,
        respondida: true,
        texto: 'Gracias por la información.',
      }),
    ],
  },
  {
    titulo: '🔴 LA MISMA CONVERSACIÓN, POR LAS DOS LÍNEAS — sólo una tiene plazo',
    nota:
      'Idénticas salvo por el número propio. Arriba sale por 51984429504 (Cloud API): a las 24 h Meta ' +
      'RECHAZA con 131047, así que la cuenta regresiva es un hecho. Abajo sale por 51963139984 ' +
      '(whatsmeow): ahí Meta no rechaza nada — el riesgo es el ban, que no tiene reloj— y una cuenta ' +
      'regresiva prometería un vencimiento que no ocurre. ⚠️ No se pierde información: «hace 20 horas» ' +
      'sigue estando en las dos, en tinta neutra y sin prometer nada.',
    filas: [
      fila({
        persona_id: '51977111222',
        persona_nombre: 'Yesenia Palomino',
        numero_propio: '51984429504',
        ventana_cierra: en(4 * HORA),
        referencia: haceHoras(20),
        texto: '¿Todavía hay cupo para el diploma?',
      }),
      fila({
        persona_id: '51977333444',
        persona_nombre: 'Yesenia Palomino',
        numero_propio: '51963139984',
        ventana_cierra: en(4 * HORA),
        referencia: haceHoras(20),
        texto: '¿Todavía hay cupo para el diploma?',
      }),
    ],
  },
  {
    titulo: 'Comentarios de FB/IG — los 7 días, en la MISMA marca',
    nota:
      'Un solo concepto para los dos plazos: la píldora no sabe de canales, solo de cuánto FALTA. El de ' +
      '5 días sale verde y el que entra en las últimas horas, rojo. ⚠️ Acá los dos relojes suman SIETE ' +
      'días, no 24 h — mira «1 h» junto a «hace 6 días»: es el mismo mecanismo, con otro plazo.',
    filas: [
      fila({
        clave: 'int:9001',
        canal: 'facebook',
        tipo: 'comentario',
        persona_id: 'fb-9001',
        persona_nombre: 'Ana Beltrán',
        numero_propio: null,
        ventana_cierra: en(5 * DIA),
        // Los comentarios tienen SIETE días, no 24 h: si la ventana cierra en 5,
        // comentó hace 2. El default de `fila()` (3 h) armaba un par imposible.
        referencia: haceHoras(48),
        dias: 2,
        contexto_texto: 'Diploma en Gestión Pública — inscripciones abiertas',
        texto: '¿Cuánto está la inversión?',
        n: 1,
      }),
      fila({
        clave: 'int:9002',
        canal: 'instagram',
        tipo: 'comentario',
        persona_id: 'ig-9002',
        persona_nombre: 'sofia.mendoza',
        numero_propio: null,
        ventana_cierra: en(90 * 60 * 1000),
        referencia: haceHoras(7 * 24 - 1.5),
        dias: 6,
        nivel: 2,
        contexto_texto: 'Últimas vacantes — Foro de Estado',
        texto: 'Info por favor 🙌',
        n: 1,
      }),
    ],
  },
  {
    titulo: 'Respaldo: server viejo (sin `ventana_cierra`) — el comentario no pierde su cuenta',
    nota: 'N4 despliega el front solo y N5 el server a botón: existe una franja con el front nuevo hablando con el server viejo. Sin este respaldo, ahí los comentarios perderían la cuenta regresiva y nadie lo ataría al deploy.',
    filas: [
      fila({
        clave: 'int:9003',
        canal: 'facebook',
        tipo: 'comentario',
        persona_id: 'fb-9003',
        persona_nombre: 'Diego Arana',
        numero_propio: null,
        ventana_abierta: true,
        dias: 5,
        nivel: 2,
        contexto_texto: 'Diploma en Contrataciones del Estado',
        texto: '¿Es virtual?',
        n: 1,
      }),
    ],
  },
];

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[420px] space-y-8">
        <header className="space-y-1">
          <h1 className="text-lg font-bold text-foreground">
            «Puedo escribirle» — la ventana de conversación
          </h1>
          <p className="text-sm text-muted-foreground">
            24 h desde que la persona escribió · 7 días desde que comentó. Tres colores según
            cuánto FALTA: verde de 24 h a 12 h, amarillo de 11 h a 6 h, rojo de 5 h a 1 min.
            El reloj de ARENA cuenta hacia atrás; el «hace N horas» de abajo cuenta hacia
            adelante y no mide lo mismo — por eso los dos números no son iguales.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            La barra: dos pistas, con el chip nuevo y su número
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Arriba se elige <strong>qué cola</strong>, abajo se recorta <strong>dentro</strong>. Con
            las cuatro líneas vivas en una sola pista, el segmentado se comía los 336 px y «Sin
            responder» —que es la red que devuelve la deuda entera cuando lo leído baja— quedaba
            detrás de un scroll invisible. Un chip más lo empeoraba.
          </p>
          <div className="rounded-xl border border-border bg-card p-3">
            <BarraFiltros
              filtroSec=""
              onFiltro={() => {}}
              conteos={{
                preguntoPrecio: 65,
                teEscribieron: 33,
                puedoEscribirle: 25,
              }}
              opciones={opcionesDeLinea(LINEAS, false)}
              lineaActiva=""
              onLinea={() => {}}
              categoriaActiva={null}
              onCategoria={() => {}}
              onListas={() => {}}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <BarraFiltros
              filtroSec="puedo-escribirle"
              onFiltro={() => {}}
              conteos={{
                preguntoPrecio: 18,
                teEscribieron: 5,
                puedoEscribirle: 25,
              }}
              opciones={opcionesDeLinea(LINEAS, true)}
              lineaActiva="mias"
              onLinea={() => {}}
              categoriaActiva={null}
              onCategoria={() => {}}
              onListas={() => {}}
            />
          </div>
        </section>

        {CASOS.map((caso) => (
          <section key={caso.titulo} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {caso.titulo}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{caso.nota}</p>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {caso.filas.map((c, i) => (
                <FilaConversacion
                  key={c.clave}
                  c={c}
                  indice={i}
                  seleccionada={false}
                  onAbrir={() => {}}
                  lineas={LINEAS_VIVAS}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Galeria />
    </QueryClientProvider>
  </StrictMode>,
);
