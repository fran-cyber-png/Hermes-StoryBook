import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { VistaContactosCampana } from './VistaContactosCampana';

/**
 * LA VISTA CONTACTOS DEL MÓDULO DE CAMPAÑA, sin server.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-contactos-campana.html
 *     ?vacio=1   nadie registró nada todavía
 *     ?falla=1   el server no contesta
 *
 * 🔴 **Los datos son los REALES de producción**, no un caso ideal: los teléfonos
 * y los distritos salen de la línea de campaña `51963139984` del 23-ago-2026, y
 * `porPersona` trae **las dos cuentas de la misma persona** (`Usuario2` de
 * Cerberus y `centurion:usuario2` de Centurión) — que es justo el caso que
 * obliga a `productividad()` a agrupar. Con un fixture prolijo, ese defecto no
 * se ve. Es la cicatriz de «la galería mostraba el caso ideal».
 *
 * ══ AMPLIACIÓN DEL 24-AGO-2026 ═══════════════════════════════════════════════
 * El mock deja de ser de solo lectura: favoritos, etiquetas (asignar Y crear),
 * ubicación y eventos (notas/actividad) ESCRIBEN sobre un estado en memoria —
 * si no, un clic no se distingue de un bug (fue justo el reporte del 24-ago).
 *
 * ⚠️ «Nuevo contacto» se sacó de la pantalla el 01-sep-2026 (pedido del dueño):
 * el mock de `POST /api/contactos/registro` de abajo sigue existiendo porque
 * también lo usa «Editar»/«Registrar ficha» desde el panel de un contacto ya
 * existente — no es código muerto, solo perdió su otro punto de entrada.
 */

const params = new URLSearchParams(location.search);

const LINEA = '51963139984';

interface ContactoMock {
  clave: string;
  telefono: string | null;
  nombre: string | null;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  prioridad: string | null;
  vendedoraId: string;
  distrito: string | null;
  linea: string;
  favorito: boolean;
  registrado?: boolean;
  campanaId?: string | null;
  campanaNombre?: string | null;
  adId?: string | null;
  aviso?: string | null;
  creadoAt: string;
  actualizadoAt: string;
}

/** Estado en memoria — mutable a propósito, es lo que hace que la galería responda de verdad. */
let contactos: ContactoMock[] = [
  {
    clave: 'conv:whatsapp:51943348051:51963139984',
    telefono: '51943348051',
    nombre: 'Andrea',
    apellido: null,
    empresa: null,
    email: null,
    prioridad: 'alta',
    vendedoraId: 'centurion:job.meneses',
    distrito: 'Huari · Áncash',
    linea: LINEA,
    favorito: true,
    registrado: true,
    campanaId: 'camp-01',
    campanaNombre: 'Campaña Áncash 2026',
    adId: 'ad-salud-01',
    aviso: 'Propuesta de Salud Integral',
    creadoAt: '2026-08-22T22:04:00.000Z',
    actualizadoAt: '2026-08-22T22:04:00.000Z',
  },
  {
    clave: 'conv:whatsapp:51942846080:51963139984',
    // El alias real de la cola, mojibake incluido: la fila tiene que aguantarlo.
    telefono: '51942846080',
    nombre: 'Cors@g SRL',
    apellido: null,
    empresa: null,
    email: null,
    prioridad: 'media',
    vendedoraId: 'centurion:usuario4',
    distrito: 'Huari · Áncash',
    linea: LINEA,
    favorito: false,
    registrado: true,
    campanaId: 'camp-01',
    campanaNombre: 'Campaña Áncash 2026',
    adId: 'ad-seguridad-02',
    aviso: 'Plan Seguridad Ciudadana',
    creadoAt: '2026-08-22T21:57:00.000Z',
    actualizadoAt: '2026-08-22T21:57:00.000Z',
  },
  {
    // Contacto ingresado por chat sin registrar en ficha
    clave: 'conv:whatsapp:51998877665:51963139984',
    telefono: '51998877665',
    nombre: 'Beatriz',
    apellido: 'Mendoza',
    empresa: null,
    email: null,
    prioridad: null,
    vendedoraId: 'centurion:job.meneses',
    distrito: 'San Marcos · Áncash',
    linea: LINEA,
    favorito: false,
    registrado: false,
    campanaId: 'camp-02',
    campanaNombre: 'Lanzamiento Huaraz',
    adId: 'ad-educacion-03',
    aviso: 'Educación y Juventud',
    creadoAt: '2026-08-22T21:30:00.000Z',
    actualizadoAt: '2026-08-22T21:30:00.000Z',
  },
  {
    // Sin nombre: la ficha se registró con el teléfono solo. Cae al número, que
    // es el único dato que hay — nunca a «Sin nombre».
    clave: 'conv:whatsapp:51920024566:51963139984',
    telefono: '51920024566',
    nombre: null,
    apellido: null,
    empresa: null,
    email: null,
    prioridad: null,
    vendedoraId: 'Usuario2',
    distrito: null,
    linea: LINEA,
    favorito: false,
    registrado: true,
    campanaId: null,
    campanaNombre: null,
    adId: null,
    aviso: null,
    creadoAt: '2026-08-22T20:43:00.000Z',
    actualizadoAt: '2026-08-22T20:43:00.000Z',
  },
  {
    clave: 'conv:whatsapp:51987461490:51963139984',
    telefono: '51987461490',
    nombre: 'Mario',
    apellido: 'Cárdenas',
    empresa: null,
    email: 'mario.cardenas@gmail.com',
    prioridad: null,
    vendedoraId: 'centurion:usuario1',
    distrito: 'Lima · Lima',
    linea: LINEA,
    favorito: true,
    registrado: true,
    campanaId: 'camp-01',
    campanaNombre: 'Campaña Áncash 2026',
    adId: 'ad-salud-01',
    aviso: 'Propuesta de Salud Integral',
    creadoAt: '2026-08-21T15:20:00.000Z',
    actualizadoAt: '2026-08-21T15:20:00.000Z',
  },
  {
    // Contacto ingresado por chat Meta WA CTWA
    clave: 'conv:whatsapp:51912345678:51963139984',
    telefono: '51912345678',
    nombre: 'Carlos',
    apellido: 'Valdivia',
    empresa: null,
    email: null,
    prioridad: null,
    vendedoraId: '',
    distrito: null,
    linea: LINEA,
    favorito: false,
    registrado: false,
    campanaId: 'camp-02',
    campanaNombre: 'Lanzamiento Huaraz',
    adId: 'ad-educacion-03',
    aviso: 'Educación y Juventud',
    creadoAt: '2026-08-21T14:10:00.000Z',
    actualizadoAt: '2026-08-21T14:10:00.000Z',
  },
];

const DISTRITOS = [
  { id: 1, nombre: 'Huari · Áncash', zona: 'Áncash', orden: 0 },
  { id: 2, nombre: 'Lima · Lima', zona: 'Lima', orden: 1 },
  { id: 3, nombre: 'San Marcos · Áncash', zona: 'Áncash', orden: 2 },
];
/** clave → id de distrito. Separado del fixture de arriba: `distrito` (texto) es lo que ya
 * trae `/registrados`; esto es lo que anota `/api/territorio`, y los dos se leen distinto. */
const territorioDe = new Map<string, number>([['conv:whatsapp:51943348051:51963139984', 1]]);

let categorias = [
  { id: 1, nombre: 'cliente', color: 'verde', esFavorito: false, orden: 0 },
  { id: 2, nombre: 'importante', color: 'morado', esFavorito: false, orden: 1 },
];
let proximoIdCategoria = 3;

/** clave → etiquetas asignadas. La primera ficha lleva las dos de arriba. */
const etiquetasDe = new Map<string, string[]>([[contactos[0].clave, ['cliente', 'importante']]]);

interface EventoMock {
  id: number;
  clave: string;
  tipo: string;
  curso: string | null;
  productoId: string | null;
  nota: string | null;
  vendedoraId: string;
  creadoAt: string;
  editadoAt: string | null;
}
let proximoIdEvento = 3;
const eventosDe = new Map<string, EventoMock[]>([
  [
    contactos[0].clave,
    [
      {
        id: 1,
        clave: contactos[0].clave,
        tipo: 'nota',
        curso: null,
        productoId: null,
        nota: 'Prefiere que la contacten por WhatsApp después de las 6pm.',
        vendedoraId: 'centurion:job.meneses',
        creadoAt: '2026-08-23T18:00:00.000Z',
        editadoAt: null,
      },
      {
        id: 2,
        clave: contactos[0].clave,
        tipo: 'llamada',
        curso: null,
        productoId: null,
        nota: 'Confirmó que asiste al cierre de campaña del sábado.',
        vendedoraId: 'centurion:job.meneses',
        creadoAt: '2026-08-23T10:30:00.000Z',
        editadoAt: null,
      },
    ],
  ],
]);

/** `ContactoMock` → la forma de `contacto_ficha` que espera `useFichaLocal`/`FichaRapida`. */
function comoFicha(c: ContactoMock) {
  return {
    clave: c.clave,
    telefono: c.telefono,
    nombre: c.nombre,
    apellido: c.apellido,
    empresa: c.empresa,
    email: c.email,
    prioridad: c.prioridad,
    vendedoraId: c.vendedoraId,
    favorito: c.favorito,
    creadoAt: c.creadoAt,
    actualizadoAt: c.actualizadoAt,
  };
}

const YO = 'centurion:job.meneses';

const real = globalThis.fetch;
globalThis.fetch = (async (entrada: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(typeof entrada === 'string' ? entrada : (entrada as Request).url);
  const metodo = (init?.method ?? 'GET').toUpperCase();
  const cuerpo = () => (init?.body ? JSON.parse(String(init.body)) : {});
  const json = (c: unknown, status = 200) =>
    new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });

  // ── /api/contactos/registrados — la lista ──────────────────────────────
  if (metodo === 'GET' && url.includes('/api/contactos/registrados')) {
    if (params.has('falla')) return json({}, 502);
    if (params.has('vacio')) return json({ contactos: [], porPersona: [] });
    return json({
      contactos,
      porPersona: [
        { vendedoraId: 'Usuario2', cuantos: 20 },
        { vendedoraId: 'centurion:job.meneses', cuantos: 14 },
        { vendedoraId: 'centurion:usuario4', cuantos: 11 },
        // 🔴 La segunda cuenta de la MISMA persona: sin agrupar, el bloque
        // dibuja dos filas que dicen «Usuario2».
        { vendedoraId: 'centurion:usuario2', cuantos: 5 },
      ],
    });
  }

  // ── /api/contactos/registro/:clave/favorito ────────────────────────────
  const favMatch = /\/api\/contactos\/registro\/([^/]+)\/favorito$/.exec(url);
  if (metodo === 'PATCH' && favMatch) {
    const clave = decodeURIComponent(favMatch[1]);
    const c = contactos.find((x) => x.clave === clave);
    if (!c) return json({ ok: false, message: 'no existe' }, 404);
    c.favorito = Boolean(cuerpo().favorito);
    return json({ ok: true, ficha: comoFicha(c) });
  }

  // ── /api/contactos/registro — leer o crear/actualizar la ficha ─────────
  if (url.includes('/api/contactos/registro') && !url.includes('/favorito')) {
    if (metodo === 'GET') {
      const clave = new URL(url, location.origin).searchParams.get('clave') ?? '';
      const c = contactos.find((x) => x.clave === clave);
      return json({ ficha: c ? comoFicha(c) : null });
    }
    if (metodo === 'POST') {
      const b = cuerpo();
      const clave = String(b.clave ?? '');
      const existente = contactos.find((x) => x.clave === clave);
      if (existente) {
        Object.assign(existente, {
          telefono: b.telefono ?? existente.telefono,
          nombre: b.nombre ?? existente.nombre,
          apellido: b.apellido ?? existente.apellido,
          empresa: b.empresa ?? existente.empresa,
          email: b.email ?? existente.email,
          prioridad: b.prioridad ?? existente.prioridad,
          actualizadoAt: new Date().toISOString(),
        });
        return json({ ok: true, ficha: comoFicha(existente) });
      }
      // Nueva: mismo criterio que `contactosRegistrados.ts` — la línea sale
      // del cuarto segmento de la clave, no de una columna.
      const linea = clave.split(':')[3] ?? LINEA;
      const nuevo: ContactoMock = {
        clave,
        telefono: b.telefono ?? null,
        nombre: b.nombre ?? null,
        apellido: b.apellido ?? null,
        empresa: b.empresa ?? null,
        email: b.email ?? null,
        prioridad: b.prioridad ?? null,
        vendedoraId: YO,
        distrito: null,
        linea,
        favorito: false,
        creadoAt: new Date().toISOString(),
        actualizadoAt: new Date().toISOString(),
      };
      contactos = [nuevo, ...contactos];
      return json({ ok: true, ficha: comoFicha(nuevo) });
    }
  }

  // ── /api/territorio ─────────────────────────────────────────────────────
  const territorioMatch = /\/api\/territorio\/([^/]+)$/.exec(url);
  if (metodo === 'PUT' && territorioMatch) {
    const clave = decodeURIComponent(territorioMatch[1]);
    territorioDe.set(clave, Number(cuerpo().distritoId));
    const c = contactos.find((x) => x.clave === clave);
    const d = DISTRITOS.find((x) => x.id === Number(cuerpo().distritoId));
    if (c && d) c.distrito = d.nombre;
    return json({ ok: true });
  }
  if (metodo === 'DELETE' && territorioMatch) {
    const clave = decodeURIComponent(territorioMatch[1]);
    territorioDe.delete(clave);
    const c = contactos.find((x) => x.clave === clave);
    if (c) c.distrito = null;
    return json({ ok: true });
  }
  if (metodo === 'GET' && url.includes('/api/territorio')) {
    const clave = new URL(url, location.origin).searchParams.get('clave') ?? '';
    const distritoId = territorioDe.get(clave);
    return json({
      ok: true,
      distritos: DISTRITOS,
      conteos: {},
      linea: LINEA,
      ...(clave ? { actual: distritoId ? { distritoId, anotadoPor: YO } : null } : {}),
    });
  }

  // ── /api/categorias — el catálogo (crear incluido) ─────────────────────
  if (url.includes('/api/categorias')) {
    if (metodo === 'POST') {
      const b = cuerpo();
      const nueva = { id: proximoIdCategoria++, nombre: b.nombre, color: b.color, esFavorito: false, orden: categorias.length };
      categorias = [...categorias, nueva];
      return json({ ok: true, categoria: nueva }, 201);
    }
    // supervisor: true — acá se mira como el candidato, que administra el catálogo.
    return json({ categorias: categorias.map((c) => ({ ...c, conteo: 0 })), supervisor: true });
  }

  // ── /api/gestiones/etiquetas — asignación ───────────────────────────────
  if (url.includes('/api/gestiones/etiquetas')) {
    if (metodo === 'POST') {
      const b = cuerpo();
      const lista = etiquetasDe.get(b.clave) ?? [];
      if (!lista.includes(b.etiqueta)) etiquetasDe.set(b.clave, [...lista, b.etiqueta]);
      return json({ ok: true });
    }
    if (metodo === 'DELETE') {
      const b = cuerpo();
      etiquetasDe.set(b.clave, (etiquetasDe.get(b.clave) ?? []).filter((e) => e !== b.etiqueta));
      return json({ ok: true });
    }
    const claves = new URL(url, location.origin).searchParams.get('claves')?.split(',') ?? [];
    const etiquetas = Object.fromEntries(claves.map((c) => [c, etiquetasDe.get(c) ?? []]));
    return json({ etiquetas });
  }

  // ── /api/eventos — notas y actividad ────────────────────────────────────
  if (url.includes('/api/eventos')) {
    if (metodo === 'POST') {
      const b = cuerpo();
      const nuevo: EventoMock = {
        id: proximoIdEvento++,
        clave: b.clave,
        tipo: b.tipo,
        curso: b.curso ?? null,
        productoId: b.productoId ?? null,
        nota: b.nota ?? null,
        vendedoraId: YO,
        creadoAt: new Date().toISOString(),
        editadoAt: null,
      };
      eventosDe.set(b.clave, [nuevo, ...(eventosDe.get(b.clave) ?? [])]);
      return json({ ok: true, evento: nuevo, interesAsentado: false, motivoInteres: null });
    }
    const clave = new URL(url, location.origin).searchParams.get('clave') ?? '';
    return json({ eventos: eventosDe.get(clave) ?? [], correos: [] });
  }

  return real(entrada, init);
}) as typeof fetch;

createRoot(document.getElementById('galeria')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="h-screen bg-background">
        <VistaContactosCampana onEscribir={(tel) => alert(`Iría a Mensajes con ${tel}`)} />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
