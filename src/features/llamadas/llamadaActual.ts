import { useSyncExternalStore } from 'react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { suscribirSenalDeLlamada, type SenalDeLlamada } from '../../lib/datos/senalDeLlamada';
import { formatoTelefono } from '../../lib/formato';
import { notificarEscritorio } from '../../lib/notificaciones/escritorio';
import { reproducirSonidoMensaje } from '../../lib/notificaciones/sonido';
import { queHacerConLaSenal, type EstadoLlamada } from './decidirSenal';
import type { Conexion } from './webrtc';

/**
 * LA LLAMADA DE ESTA PESTAÑA — una sola a la vez, y fuera de React a propósito (ADR 0123).
 *
 * Una llamada no puede vivir en el panel de la conversación: cambiar de chat, de vista o cerrar la ficha
 * desmonta el componente, y con él se cortaría la voz. Por eso el estado, la conexión WebRTC y el timbre
 * viven en el módulo, y la pantalla los lee con `useLlamadaActual`.
 *
 * Qué hacer ante cada señal del server lo decide `decidirSenal.ts`, que es puro y tiene su test. Acá se
 * ejecuta: micrófono, SDP, pedidos al server y sonido.
 *
 * 🔴 **Cada intento lleva su número, y después de cada `await` se pregunta si sigue siendo el vigente.**
 * Juntar candidatos ICE tarda hasta 4 s, pedir el micrófono lo que la vendedora tarde en aceptar, y Meta lo
 * suyo: en cualquiera de esos huecos se puede colgar o empezar otra llamada. Sin el número, el intento viejo
 * seguía de largo — sacaba una llamada que ya nadie quería, o contestaba una que la vendedora había cortado.
 *
 * ⚠️ **Este módulo va en el arranque y `webrtc.ts` NO**: la suscripción a la señal tiene que existir antes
 * de que la vendedora abra nada (una entrante puede sonar apenas carga Hermes), pero el audio recién hace
 * falta al llamar o contestar. Importarlo estático pasaba el presupuesto del chunk de arranque
 * (`npm run presupuesto`, 310,7 KB contra 310 KB el 13-sep-2026).
 */

const cargarWebrtc = () => import('./webrtc');

interface Instantanea {
  estado: EstadoLlamada;
  error: string | null;
  /** Un aviso que no es un error: «La contestó luz.» */
  nota: string | null;
}

const TIMBRE_MS = 1600;
const MOSTRAR_AVISO_MS = 6000;

let instantanea: Instantanea = { estado: { fase: 'libre' }, error: null, nota: null };
let conexion: Conexion | null = null;
let respuestaAplicada = false;
let intento = 0;
let timbre: ReturnType<typeof setInterval> | undefined;
let aLibre: ReturnType<typeof setTimeout> | undefined;
const ignoradas = new Set<string>();
const oyentes = new Set<() => void>();

function poner(estado: EstadoLlamada, error: string | null = null, nota: string | null = null): void {
  if (estado.fase === 'entrante') {
    if (timbre === undefined) {
      reproducirSonidoMensaje();
      timbre = setInterval(reproducirSonidoMensaje, TIMBRE_MS);
    }
  } else if (timbre !== undefined) {
    clearInterval(timbre);
    timbre = undefined;
  }
  if (aLibre !== undefined) {
    clearTimeout(aLibre);
    aLibre = undefined;
  }
  if (estado.fase === 'terminada' || (estado.fase === 'libre' && nota)) {
    aLibre = setTimeout(() => poner({ fase: 'libre' }), MOSTRAR_AVISO_MS);
  }
  instantanea = { estado, error, nota };
  for (const o of oyentes) o();
}

function estadoActual(): EstadoLlamada {
  return instantanea.estado;
}

const rutaDe = (callId: string, accion = '') => `/api/llamadas/en-curso/${encodeURIComponent(callId)}${accion}`;
const avisarAlServer = (callId: string, accion: '/colgar' | '/soltar' | '/pasar') =>
  api(rutaDe(callId, accion), { method: 'POST' }).catch(() => {});

interface Detalle {
  callId: string;
  direccion: 'entrante' | 'saliente';
  fase: string;
  telefono: string;
  clave: string;
  laAtiendeOtra: string | null;
  respuesta: string | null;
}

function detalle(callId: string): Promise<Detalle> {
  return api<{ ok: true; llamada: Detalle }>(rutaDe(callId)).then((r) => r.llamada);
}

function explicar(err: unknown, porDefecto: string): string {
  if (err instanceof ErrorApi) return err.message;
  const nombre = err instanceof Error ? err.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'Hermes no tiene permiso para usar tu micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentar.';
  }
  if (nombre === 'NotFoundError') return 'No se encontró un micrófono conectado.';
  return porDefecto;
}

function cerrarConexion(): void {
  conexion?.cerrar();
  conexion = null;
  respuestaAplicada = false;
}

function soltarMicrofono(m: MediaStream | null): void {
  for (const p of m?.getTracks() ?? []) p.stop();
}

/** La llamada terminada que se muestra un rato: con quién fue y cuánto duró, si llegó a estar en curso. */
function terminadaDesde(e: EstadoLlamada, motivo: string): EstadoLlamada {
  return {
    fase: 'terminada',
    telefono: 'telefono' in e ? e.telefono : '',
    motivo,
    duracion: e.fase === 'en-curso' ? Math.round((Date.now() - e.desde) / 1000) : null,
  };
}

/** `true` si el intento `mio` sigue siendo el que está conectando. */
function sigue(mio: number): boolean {
  return mio === intento && estadoActual().fase === 'conectando';
}

async function aplicarRespuestaSiLlego(callId: string): Promise<void> {
  if (!conexion || respuestaAplicada) return;
  const d = await detalle(callId);
  if (!d.respuesta || respuestaAplicada || !conexion) return;
  respuestaAplicada = true;
  try {
    const { aplicarRespuesta } = await cargarWebrtc();
    await aplicarRespuesta(conexion, d.respuesta);
  } catch (err) {
    respuestaAplicada = false;
    throw err;
  }
}

export async function llamar(clave: string, telefono: string): Promise<void> {
  const previo = estadoActual();
  if (previo.fase !== 'libre' && previo.fase !== 'terminada') {
    poner(previo, 'Ya hay una llamada en curso.');
    return;
  }
  const mio = ++intento;
  poner({ fase: 'conectando', callId: null, direccion: 'saliente', telefono, clave });
  let microfono: MediaStream | null = null;
  let callId: string | null = null;
  try {
    const rtc = await cargarWebrtc();
    microfono = await rtc.pedirMicrofono();
    if (!sigue(mio)) return soltarMicrofono(microfono);
    conexion = rtc.crearConexion(microfono);
    microfono = null;
    const sdp = await rtc.ofertaCompleta(conexion);
    // Juntar candidatos tarda: si colgó mientras tanto, no se saca una llamada que ya nadie quiere.
    if (!sigue(mio)) return cerrarConexion();
    ({ callId } = await api<{ ok: true; callId: string }>('/api/llamadas/llamar', {
      method: 'POST',
      body: JSON.stringify({ clave, sdp }),
    }));
    if (!sigue(mio)) {
      // Colgó mientras Meta recibía el pedido: la llamada ya existe allá y hay que cortarla.
      cerrarConexion();
      void avisarAlServer(callId, '/colgar');
      return;
    }
    poner({ fase: 'llamando', callId, telefono, clave });
    // La respuesta de Meta pudo llegar antes que el id: se la busca una vez acá, y después la trae la señal.
    await aplicarRespuestaSiLlego(callId);
  } catch (err) {
    soltarMicrofono(microfono);
    if (mio !== intento) return;
    cerrarConexion();
    if (callId) void avisarAlServer(callId, '/colgar');
    poner({ fase: 'libre' }, explicar(err, 'No se pudo hacer la llamada.'));
  }
}

export async function contestar(): Promise<void> {
  const e = estadoActual();
  if (e.fase !== 'entrante') return;
  const { callId, telefono, clave } = e;
  const mio = ++intento;
  poner({ fase: 'conectando', callId, direccion: 'entrante', telefono, clave });
  let microfono: MediaStream | null = null;
  let tomada = false;
  try {
    // El micrófono va PRIMERO: si la vendedora no lo da, la llamada no se toma y pasa a las demás.
    const rtc = await cargarWebrtc();
    microfono = await rtc.pedirMicrofono();
    if (!sigue(mio)) return soltarMicrofono(microfono);
    const { oferta } = await api<{ ok: true; oferta: string }>(rutaDe(callId, '/tomar'), { method: 'POST' });
    tomada = true;
    if (!sigue(mio)) {
      soltarMicrofono(microfono);
      void avisarAlServer(callId, '/soltar');
      return;
    }
    conexion = rtc.crearConexion(microfono);
    microfono = null;
    const sdp = await rtc.respuestaCompleta(conexion, oferta);
    if (!sigue(mio)) {
      cerrarConexion();
      void avisarAlServer(callId, '/soltar');
      return;
    }
    await api(rutaDe(callId, '/contestar'), { method: 'POST', body: JSON.stringify({ sdp }) });
    if (!sigue(mio)) {
      // Meta ya la aceptó y la vendedora colgó mientras tanto: se corta de verdad.
      cerrarConexion();
      void avisarAlServer(callId, '/colgar');
      return;
    }
    poner({ fase: 'en-curso', callId, direccion: 'entrante', telefono, clave, desde: Date.now(), silenciado: false });
  } catch (err) {
    soltarMicrofono(microfono);
    if (mio !== intento) return;
    cerrarConexion();
    // Que no quede tomada por nadie ni sonando solo para quien no puede contestarla.
    void avisarAlServer(callId, tomada ? '/soltar' : '/pasar');
    ignoradas.add(callId);
    poner({ fase: 'libre' }, explicar(err, 'No se pudo contestar la llamada.'));
  }
}

/** No la contesta esta persona: deja de sonarle y, si le sonaba solo a ella, pasa a las demás. */
export function ignorar(): void {
  const e = estadoActual();
  if (e.fase !== 'entrante') return;
  ignoradas.add(e.callId);
  void avisarAlServer(e.callId, '/pasar');
  poner({ fase: 'libre' });
}

export async function colgar(): Promise<void> {
  const e = estadoActual();
  intento++;
  cerrarConexion();
  poner(terminadaDesde(e, 'Colgaste'));
  if (!('callId' in e) || !e.callId) return;
  // Una entrante que todavía se estaba conectando no se corta: se suelta, para que la conteste otra.
  const accion = e.fase === 'conectando' && e.direccion === 'entrante' ? '/soltar' : '/colgar';
  await avisarAlServer(e.callId, accion);
}

export function silenciar(): void {
  const e = estadoActual();
  if (e.fase !== 'en-curso' || !conexion) return;
  conexion.silenciar(!e.silenciado);
  poner({ ...e, silenciado: !e.silenciado });
}

export function cerrarAviso(): void {
  const e = estadoActual();
  poner(e.fase === 'terminada' ? { fase: 'libre' } : e);
}

async function reaccionar(s: SenalDeLlamada): Promise<void> {
  const reaccion = queHacerConLaSenal(estadoActual(), s, ignoradas);
  if (reaccion === 'aplicar-respuesta') {
    try {
      await aplicarRespuestaSiLlego(s.callId);
    } catch {
      if (estadoActual().fase !== 'libre') {
        const e = estadoActual();
        intento++;
        cerrarConexion();
        poner(terminadaDesde(e, 'No se pudo conectar el audio'), 'No se pudo conectar el audio de la llamada.');
        void avisarAlServer(s.callId, '/colgar');
      }
    }
    return;
  }
  try {
    if (reaccion === 'consultar-entrante') {
      const d = await detalle(s.callId);
      const e = estadoActual();
      if ((e.fase === 'libre' || e.fase === 'terminada') && d.direccion === 'entrante' && d.fase === 'sonando' && !d.laAtiendeOtra) {
        poner({ fase: 'entrante', callId: d.callId, telefono: d.telefono, clave: d.clave });
        notificarEscritorio('Hermes', `Llamada de WhatsApp de ${formatoTelefono(d.telefono)}`);
      }
    } else if (reaccion === 'apagar-timbre') {
      poner({ fase: 'libre' });
      if (s.fase !== 'tomada') return;
      const d = await detalle(s.callId);
      if (d.laAtiendeOtra && estadoActual().fase === 'libre') poner({ fase: 'libre' }, null, `La contestó ${d.laAtiendeOtra}.`);
    } else if (reaccion === 'marcar-en-curso') {
      const e = estadoActual();
      if (e.fase === 'llamando' || e.fase === 'conectando') {
        poner({ fase: 'en-curso', callId: s.callId, direccion: 'saliente', telefono: e.telefono, clave: e.clave, desde: Date.now(), silenciado: false });
      }
    } else if (reaccion === 'cortar') {
      const e = estadoActual();
      intento++;
      cerrarConexion();
      poner(terminadaDesde(e, e.fase === 'en-curso' ? 'La llamada terminó' : 'No contestó'));
    }
  } catch {
    // Un 404 del detalle es una llamada que ya terminó o que no es de esta pestaña: no hay nada que mostrar.
  }
}

suscribirSenalDeLlamada((s) => {
  void reaccionar(s);
});

function suscribir(o: () => void): () => void {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

export function useLlamadaActual(): Instantanea {
  return useSyncExternalStore(suscribir, () => instantanea, () => instantanea);
}
