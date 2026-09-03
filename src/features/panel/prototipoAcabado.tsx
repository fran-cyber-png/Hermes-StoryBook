import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Clock, IdCard, Link2, Mail, MapPin, Pencil, Plus, ShoppingCart, UserRound,
} from 'lucide-react';
import '../../index.css';

/**
 * PROTOTIPO DE ACABADO — el detalle de contacto en el lenguaje del war room.
 *
 * ⚠️ **THROWAWAY, y sigue el precedente de ADR 0078**: ahí se compararon dos
 * variantes de la fila de la cola en un prototipo (`docs/evidencia/
 * prototipo-rediseno-fila.png`, borrado tras decidir) ANTES de tocar el
 * componente real. Acá igual: esto no está cableado a ninguna consulta, no lo
 * importa la app, y se borra cuando el dueño elija. Los datos son los del
 * cliente real de la captura que originó el frente.
 *
 *     npx vite --port 5200  →  /prototipo-acabado.html
 *
 * 🔴 **LO QUE HAY QUE DECIDIR ANTES DE LLEVARLO A PRODUCCIÓN: EL ORO.**
 * `CLAUDE.md` lo repite en quince lugares — «el dorado significa tiempo que se
 * acaba, nada más», y por eso las categorías, las señales, el bot, el embudo y
 * el territorio están todos marcados «sin oro». Acá el oro es ESTRUCTURA
 * (filetes, eyebrows, el disco numerado, el CTA), que es como lo usa la
 * referencia. Las dos cosas no pueden ser ciertas a la vez: o el oro deja de
 * significar plazo, o este acabado usa otro acento. Es decisión del dueño.
 */

/**
 * ══ LA PALETA, CORREGIDA CONTRA §3 DE `creative-director-goberna` ═══════════
 *
 * 🔴 **La primera versión de este prototipo tenía MÁS DE QUINCE elementos
 * dorados** (el filete de cada placa, cada eyebrow, los cuatro discos, el riel
 * punteado, el CTA, dos cifras). El criterio de la casa es explícito y va en la
 * dirección contraria:
 *
 *   · «Dorado: valor, institución, **el dato que importa**. Regla: **poco**.»
 *   · 🔴 «Un color que aparece en todos lados deja de significar.»
 *   · ⚠️ «Si un plano brilla mucho, saca dorado. **Siempre es dorado de más**.»
 *   · Checklist: «el dorado se puede contar con los dedos de una mano».
 *
 * Y en Hermes el token tiene además su propio significado: **tiempo que se
 * acaba** (`index.css`, y quince «sin oro» repartidos por las reglas). Gastarlo
 * en filetes le apagaría la señal al reloj de la cola.
 *
 * **Presupuesto de oro acá: DOS.** La cifra héroe y nada más — que es
 * literalmente «cifra héroe» del criterio.
 *
 * ⚠️ **Lo que hace el trabajo estructural es el HUESO**, no el oro. Y no es un
 * invento para esquivar la regla: mirando el render de referencia, la masa
 * cálida son los PANELES color crema, no el dorado — el oro ahí son los discos
 * numerados y poco más.
 */
const ORO = '#FFC800';
/** El crema de los paneles de la referencia: estructura cálida sin gastar oro. */
const HUESO = '#E6DCC4';
const GROUND = '#080F1D';

/** Micro-rótulo en mono, versalitas y tracking abierto: el tono «plano técnico». */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.22em]"
      style={{ color: HUESO, opacity: 0.55 }}
    >
      {children}
    </span>
  );
}

/**
 * LA PLACA — el molde de la tarjeta flotante de la referencia: filete de oro a
 * la izquierda, fondo hundido, y un highlight de 1 px arriba que simula el canto
 * de una placa iluminada desde arriba. Una sola dirección de luz en todo.
 */
function Placa({
  eyebrow, titulo, icono, children, accion,
}: {
  eyebrow: string;
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-xl px-3.5 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: HUESO, opacity: 0.30 }} />
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span style={{ color: HUESO, opacity: 0.55 }}>{icono}</span>
          <div className="min-w-0 leading-tight">
            <div className="font-heading text-[13px] font-bold text-white">{titulo}</div>
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function BotonMini({ icono, children, oro = false }: { icono: React.ReactNode; children: React.ReactNode; oro?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-[background-color,transform] duration-200 ease-house active:scale-[0.97]"
      style={{ color: oro ? '#7FA9F0' : 'rgba(190,209,236,0.75)' }}
    >
      {icono}
      {children}
    </button>
  );
}

/** Un campo: rótulo en mono a la izquierda, dato en blanco, fuente al costado. */
function Campo({ rotulo, valor, fuente, mono, accion }: {
  rotulo: string; valor?: string; fuente?: string; mono?: boolean; accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 py-[3px]">
      <dt className="w-[52px] shrink-0 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(143,166,196,0.65)' }}>
        {rotulo}
      </dt>
      <dd className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span
          className={'min-w-0 truncate text-[12px] ' + (mono ? 'font-mono ' : '')}
          style={{ color: valor ? '#EAF1FB' : 'rgba(143,166,196,0.35)' }}
          title={valor}
        >
          {valor || '—'}
        </span>
        {valor && fuente && (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'rgba(143,166,196,0.5)' }}>
            {fuente}
          </span>
        )}
        {accion}
      </dd>
    </div>
  );
}

/** El disco numerado de la referencia: oro sólido, número en navy. */
function Disco({ n }: { n: number }) {
  return (
    <span
      className="relative z-10 grid size-[18px] shrink-0 place-items-center rounded-full font-mono text-[9px] font-bold"
      style={{
        background: 'linear-gradient(150deg, #2A4C7C, #1B3358)',
        color: HUESO,
        boxShadow: `0 0 0 3px #101F38, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {n}
    </span>
  );
}

function Evento({ n, titulo, detalle, extra, hora }: {
  n: number; titulo: string; detalle?: string; extra?: string; hora: string;
}) {
  return (
    <li className="relative flex gap-3 pb-3.5 last:pb-0">
      <Disco n={n} />
      <div className="min-w-0 flex-1 pt-px">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-semibold text-white">{titulo}</span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums" style={{ color: 'rgba(143,166,196,0.6)' }}>{hora}</span>
        </div>
        {detalle && <div className="mt-0.5 font-mono text-[11px] tabular-nums" style={{ color: HUESO, opacity: 0.85 }}>{detalle}</div>}
        {extra && <div className="mt-0.5 truncate text-[11px]" style={{ color: 'rgba(190,209,236,0.7)' }}>{extra}</div>}
      </div>
    </li>
  );
}

function Panel() {
  return (
    <div
      className="relative flex h-[860px] w-[380px] flex-col overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(168deg, #16294A 0%, #101F38 55%, #0C1930 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 40px 80px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      {/* ══ IDENTIDAD ═══════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-4 pb-3.5 pt-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span
              className="grid size-[54px] place-items-center rounded-2xl font-heading text-base font-bold text-white"
              style={{
                background: 'linear-gradient(150deg, #24446F, #16294A)',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 0 0 1px rgba(255,255,255,0.10), 0 8px 20px -8px rgba(0,0,0,0.7)`,
              }}
            >
              EN
            </span>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full"
              style={{ background: '#3DD68C', boxShadow: `0 0 0 2.5px #16294A` }}
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <Eyebrow>Cliente · Cerberus</Eyebrow>
            <h2 className="mt-0.5 font-heading text-[19px] font-bold leading-[1.15] text-white">
              Renzo Chuquival Medina
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-white"
                style={{ background: '#25D366' }}
              >
                WhatsApp
              </span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: 'rgba(190,209,236,0.8)' }}>
                +51 900 111 222
              </span>
            </div>
          </div>
        </div>

        {/* La cifra que manda, tratada como cifra héroe y no como un renglón más. */}
        <div className="mt-3.5 flex items-end justify-between">
          <div>
            <Eyebrow>Compró</Eyebrow>
            <div className="mt-0.5 font-heading text-[26px] font-bold leading-none tabular-nums" style={{ color: ORO }}>
              300<span className="ml-1 text-[13px] font-semibold opacity-70">PEN</span>
            </div>
          </div>
          <div className="text-right">
            <Eyebrow>Etapa</Eyebrow>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: 'rgba(61,214,140,0.12)', boxShadow: 'inset 0 0 0 1px rgba(61,214,140,0.35)' }}>
              <span className="size-1.5 rounded-full" style={{ background: '#3DD68C' }} />
              <span className="text-[11px] font-bold" style={{ color: '#3DD68C' }}>Compraron</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ÓPTICA Y GRANO (§7 «qué separa se ve bien de se ve caro») ══════
          Dos capas fijas, `pointer-events-none`, encima de todo:

          · **Viñeteo**: el ojo lee «lente», y lente significa cámara. Sin esto
            la placa se lee como un rectángulo de CSS.
          · **Grano fino**: el digital perfectamente limpio se lee barato. Va en
            un SVG inline —una request menos— y a opacidad mínima; con mezcla
            aditiva y densidad alta se quema a blanco, que es el error que el
            criterio marca.

          ⚠️ **Fijas y sin eventos**: el guardarraíl de rendimiento prohíbe
          colgarle texturas o blur a un contenedor que scrollea — es repintado
          de GPU en cada frame. Éstas no scrollean. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        style={{ boxShadow: 'inset 0 0 90px 20px rgba(0,0,0,0.42)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl mix-blend-overlay"
        style={{
          opacity: 0.30,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
        <Placa
          eyebrow="Quién es · 3 fuentes"
          titulo="Ficha"
          icono={<UserRound size={14} />}
          accion={
            <span className="flex gap-0.5">
              <BotonMini icono={<Link2 size={10} />}>Unir</BotonMini>
              <BotonMini icono={<Pencil size={10} />} oro>Editar</BotonMini>
            </span>
          }
        >
          <dl>
            <Campo rotulo="Cliente" valor="CLI-04812" fuente="Cerberus" mono />
            <Campo rotulo="DNI" valor="71004812" fuente="Cerberus" mono />
            <Campo
              rotulo="Correo"
              valor="r.chuquival.m@gmail.com"
              fuente="Cerberus"
              mono
              accion={<Mail size={11} className="shrink-0 self-center" style={{ color: '#7FA9F0' }} />}
            />
            <Campo rotulo="Empresa" />
            <Campo rotulo="Interés" />
          </dl>
        </Placa>

        <Placa eyebrow="Idea → dónde vota" titulo="Territorio" icono={<MapPin size={14} />}>
          <div
            className="flex h-9 items-center justify-between rounded-lg px-2.5 font-mono text-[11px]"
            style={{ background: 'rgba(0,0,0,0.28)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)', color: '#EAF1FB' }}
          >
            Villa María del Triunfo
            <span style={{ color: HUESO, opacity: 0.8 }}>212 acá</span>
          </div>
        </Placa>

        <Placa eyebrow="Cronología · 4 hitos" titulo="Qué pasó" icono={<Clock size={14} />}>
          {/* El riel dorado punteado de la referencia, uniendo los hitos. */}
          <ol className="relative">
            <span
              className="absolute bottom-3 left-[8.5px] top-2 w-px"
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, ${HUESO} 0 3px, transparent 3px 7px)`, opacity: 0.22 }}
            />
            <Evento n={4} titulo="Compra" detalle="300.00 PEN" extra="Diploma Internacional del Gestor Parlamentario" hora="28 abr" />
            <Evento n={3} titulo="Cotización" extra="Señal automática" hora="26 abr" />
            <Evento n={2} titulo="Nombre identificado" extra="Renzo Chuquival · del formulario" hora="22 abr" />
            <Evento n={1} titulo="Llegada" extra="Diploma Élite del Gestor Parlamentario" hora="22 abr" />
          </ol>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-[background-color,transform] duration-200 ease-house active:scale-[0.99]"
            style={{ color: 'rgba(190,209,236,0.85)', boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.10)` }}
          >
            <Plus size={11} /> Anotar algo
          </button>
        </Placa>

        <Placa eyebrow="Folios · Cerberus" titulo="Lo que compró" icono={<IdCard size={14} />}>
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-mono text-[10px]"
            style={{ background: 'rgba(0,0,0,0.28)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)' }}
          >
            <span className="font-bold text-white">GOB-10488</span>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase" style={{ background: 'rgba(61,214,140,0.15)', color: '#3DD68C' }}>
              Pagado
            </span>
            <span className="ml-auto tabular-nums" style={{ color: 'rgba(143,166,196,0.7)' }}>28/04</span>
            <span className="font-bold tabular-nums" style={{ color: '#3DD68C' }}>300.00</span>
          </div>
        </Placa>
      </div>

      {/* ══ LA ACCIÓN ═══════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <button
          type="button"
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl font-heading text-[13px] font-bold transition-transform duration-200 ease-house active:scale-[0.98]"
          /* Azul de marca y no oro: es el primario de TODA la app, y un CTA
             dorado en cada ficha sería el «brilla mucho» del criterio. */
          style={{
            background: 'linear-gradient(180deg, #3B82F6, #2563EB)',
            color: '#FFFFFF',
            boxShadow: '0 8px 22px -10px rgba(37,99,235,0.75), inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          <ShoppingCart size={15} className="transition-transform duration-200 ease-house group-hover:-translate-y-px" />
          Registrar venta
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <div
      className="flex min-h-dvh items-center justify-center gap-10 p-10"
      style={{
        background: `radial-gradient(1200px 700px at 30% 15%, #16294A 0%, ${GROUND} 62%)`,
      }}
    >
      <Panel />
      <div className="max-w-[300px] space-y-3 text-[12px] leading-relaxed" style={{ color: 'rgba(190,209,236,0.75)' }}>
        <div className="font-heading text-base font-bold text-white">Prototipo de acabado</div>
        <p>
          El lenguaje del war room llevado a la ficha: placa hundida con filete de hueso, eyebrow en
          mono y versalitas, hitos numerados sobre riel punteado, y la cifra que manda tratada como
          cifra y no como un renglón más.
        </p>
        <p>
          La estructura cálida la lleva el <span style={{ color: HUESO }}>hueso</span>, como los
          paneles crema del render. El <span style={{ color: ORO }}>oro</span> se gasta en una sola
          cosa —la cifra héroe— para no apagarle la señal al reloj de la cola.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(190,209,236,0.45)' }}>
          Prototipo · datos anonimizados
        </p>
      </div>
    </div>
  </StrictMode>,
);
