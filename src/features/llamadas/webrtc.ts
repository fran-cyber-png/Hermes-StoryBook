/**
 * EL AUDIO DE UNA LLAMADA DE WHATSAPP, DEL LADO DEL NAVEGADOR (ADR 0123).
 *
 * La voz va directo entre este navegador y los relays de Meta; el server solo pasa las SDP. Por eso acá
 * vive todo lo de WebRTC y nada de lo que decide a quién le suena.
 *
 * 🔴 **Se espera a juntar los candidatos ICE antes de mandar la SDP.** Meta es `ice-lite` y la señal va
 * por HTTP, no por un canal de trickle: una SDP sin candidatos llega a Meta sin por dónde conectarse, y la
 * llamada queda sin voz aunque todo lo demás haya salido bien.
 *
 * ⚠️ El STUN público solo le dice a este navegador su dirección vista desde afuera. Si una red bloquea UDP
 * no alcanza: para eso está la prueba de red y el coturn de respaldo del diseño (§8.3).
 */

const CONFIGURACION: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const TECHO_ICE_MS = 4000;

export interface Conexion {
  cerrar(): void;
  silenciar(silenciado: boolean): void;
  pc: RTCPeerConnection;
}

export function pedirMicrofono(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('Este navegador no permite usar el micrófono.'));
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
}

/** Una conexión con el micrófono ya puesto y el audio del otro lado sonando apenas llegue. */
export function crearConexion(microfono: MediaStream): Conexion {
  const pc = new RTCPeerConnection(CONFIGURACION);
  for (const pista of microfono.getAudioTracks()) pc.addTrack(pista, microfono);
  const altavoz = new Audio();
  altavoz.autoplay = true;
  pc.ontrack = (ev) => {
    altavoz.srcObject = ev.streams[0] ?? new MediaStream([ev.track]);
    void altavoz.play().catch(() => {
      // El gesto de «Llamar» o «Contestar» ya habilita el audio; si el navegador igual lo frena, no hay
      // nada que hacer desde acá sin otro clic.
    });
  };
  return {
    pc,
    cerrar() {
      pc.ontrack = null;
      pc.close();
      for (const pista of microfono.getTracks()) pista.stop();
      altavoz.srcObject = null;
    },
    silenciar(silenciado) {
      for (const pista of microfono.getAudioTracks()) pista.enabled = !silenciado;
    },
  };
}

function esperarCandidatos(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((listo) => {
    const techo = setTimeout(terminar, TECHO_ICE_MS);
    function terminar() {
      clearTimeout(techo);
      pc.removeEventListener('icegatheringstatechange', mirar);
      listo();
    }
    function mirar() {
      if (pc.iceGatheringState === 'complete') terminar();
    }
    pc.addEventListener('icegatheringstatechange', mirar);
  });
}

/** Saliente: la oferta con sus candidatos, lista para mandarla a Meta. */
export async function ofertaCompleta(c: Conexion): Promise<string> {
  const oferta = await c.pc.createOffer();
  await c.pc.setLocalDescription(oferta);
  await esperarCandidatos(c.pc);
  return c.pc.localDescription?.sdp ?? oferta.sdp ?? '';
}

/** Saliente: la respuesta de Meta, cuando el lead contestó. */
export function aplicarRespuesta(c: Conexion, sdp: string): Promise<void> {
  return c.pc.setRemoteDescription({ type: 'answer', sdp });
}

/** Entrante: la respuesta a la oferta de Meta, con sus candidatos. */
export async function respuestaCompleta(c: Conexion, sdpOferta: string): Promise<string> {
  await c.pc.setRemoteDescription({ type: 'offer', sdp: sdpOferta });
  const respuesta = await c.pc.createAnswer();
  await c.pc.setLocalDescription(respuesta);
  await esperarCandidatos(c.pc);
  return c.pc.localDescription?.sdp ?? respuesta.sdp ?? '';
}
