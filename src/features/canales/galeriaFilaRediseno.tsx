import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { FilaConversacion } from './FilaConversacion';
import { MenuFila } from './MenuFila';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA GALERÍA DEL REDISEÑO DE LA FILA (28-ago-2026) — la evidencia, sin server ni
 * base, de TODO lo que este frente tocó: nombre en negrita siempre; preview en
 * negrita mientras el chat está SIN ABRIR (peso normal al abrirse, nunca
 * opacidad); la hora en el mismo tono siempre, sólo cambia de peso; la ventana
 * de conversación a la izquierda de la hora; el conteo de sin leer en azul; el
 * avatar de 36px con color variado por contacto; el ícono de agente asignado
 * debajo del avatar; la jerarquía bot→curso→«Preguntó»→etiquetas bajo el
 * mensaje, todas con la misma UI (sin borde, cápsula, `px-1 py-px`); la marca
 * de cliente a la derecha del nombre, también sin borde; el ícono de canal
 * REDONDO de verdad (el bug del disco invertido de Facebook/Messenger,
 * corregido); sin el punto azul de "sin leer" pegado al nombre; y la banda de
 * temperatura con su escala de 4 colores intacta.
 *
 * Filas 1-5: los casos originales (leídos/no leídos, WhatsApp/IG/FB, ventana,
 * categorías). Filas 6 en adelante: una por cada pieza nueva, para que cada
 * una se pueda mirar sin ruido de las demás.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-fila-rediseno.html
 */

const AHORA = Date.now();
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const haceDias = (d: number) => new Date(AHORA - d * 24 * 3_600_000).toISOString();

function fila(over: Partial<Conversacion>): Conversacion {
  return {
    clave: `conv:whatsapp:${over.persona_id ?? '51900000000'}:51984429504`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51900000000',
    persona_nombre: 'Persona',
    numero_propio: '51984429504',
    texto: 'Buenas, quería consultar por el diploma.',
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: false,
    n: 1,
    referencia: haceHoras(6),
    ultimo_at: haceHoras(6),
    dias: 0,
    nivel: 0,
    ...over,
  };
}

const FILAS: Conversacion[] = [
  // ══ 1-5: LOS CASOS ORIGINALES ══
  fila({
    persona_id: '51988111222',
    persona_nombre: 'Sandra Ticona',
    canal: 'whatsapp',
    referencia: haceHoras(6),
    texto: 'Diploma en Gestión Pública',
    pregunto: true,
    n: 2,
    sin_leer: 2,
    no_leido: true,
    asignada_a: 'sindy.rojas',
  }),
  fila({
    persona_id: 'ig-kevin',
    persona_nombre: 'kevin.dev',
    canal: 'instagram',
    tipo: 'comentario',
    numero_propio: null,
    referencia: haceHoras(24),
    ventana_cierra: new Date(AHORA + 5 * 24 * 3_600_000).toISOString(),
    texto: '¿Dan certificado?',
    contexto_texto: 'Diploma en Gestión Pública',
    pregunto: true,
    n: 4,
    sin_leer: 4,
    no_leido: true,
    asignada_a: 'walter.diaz',
  }),
  fila({
    persona_id: 'fb-rocio',
    persona_nombre: 'Rocío Paredes',
    canal: 'facebook',
    tipo: 'comentario',
    numero_propio: null,
    referencia: haceHoras(4),
    ventana_cierra: new Date(AHORA + 6 * 24 * 3_600_000).toISOString(),
    texto: 'Info por favor',
    contexto_texto: 'Diploma en Gestión Pública',
    pregunto: true,
    n: 1,
    sin_leer: 0,
    no_leido: false,
    asignada_a: null,
  }),
  fila({
    persona_id: '51988444555',
    persona_nombre: 'Bruno Salas',
    canal: 'whatsapp',
    referencia: haceHoras(48),
    texto: 'Curso de OSINT y SOCMINT',
    pregunto: false,
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
    asignada_a: 'sindy.rojas',
  }),
  fila({
    persona_id: '51988999777',
    persona_nombre: 'Marisol Quenta',
    canal: 'whatsapp',
    referencia: haceHoras(2),
    ventana_cierra: new Date(AHORA + 20 * 3_600_000).toISOString(),
    texto: 'Quiero saber si tiene descuento por pago adelantado',
    pregunto: true,
    n: 3,
    sin_leer: 3,
    no_leido: true,
    asignada_a: 'walter.diaz',
    categorias: ['interesado', 'sin dni'],
  }),

  // ══ 6-7: EL CHIP DEL BOT — los dos únicos tonos que se dibujan ══
  fila({
    persona_id: '51977222333',
    persona_nombre: 'Jhonny Apaza',
    canal: 'whatsapp',
    referencia: haceHoras(1),
    texto: 'Ya no quiero hablar con un robot, pásame con una persona',
    pregunto: false,
    n: 2,
    sin_leer: 2,
    no_leido: true,
    bot_escalada: true,
    bot_motivo: 'pidio_humano',
  }),
  fila({
    persona_id: '51977333444',
    persona_nombre: 'Katherine Soto',
    canal: 'whatsapp',
    referencia: haceHoras(3),
    texto: '¿En cuántas cuotas puedo pagar?',
    pregunto: true,
    pregunto_precio: true,
    n: 1,
    sin_leer: 1,
    no_leido: true,
    bot_temperatura: 'caliente',
  }),

  // ══ 8: EL CHIP DE CURSO (sin bot) ══
  fila({
    persona_id: '51977444555',
    persona_nombre: 'Renzo Huamaní',
    canal: 'whatsapp',
    referencia: haceHoras(5),
    texto: 'Vi el anuncio y me interesa',
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
    interes_curso: 'Diploma en Inteligencia y Contrainteligencia',
  }),

  // ══ 9-11: LA MARCA DE CLIENTE — los tres escalones, a la derecha del nombre ══
  fila({
    persona_id: '51977555666',
    persona_nombre: 'Doris Mamani',
    canal: 'whatsapp',
    referencia: haceHoras(10),
    texto: '¿Tienen el diploma de Gestión Municipal?',
    pregunto: true,
    n: 1,
    sin_leer: 1,
    no_leido: true,
    cliente_nivel: 'compro',
    cliente_compras: 1,
  }),
  fila({
    persona_id: '51977666777',
    persona_nombre: 'Wilfredo Chura',
    canal: 'whatsapp',
    referencia: haceHoras(30),
    texto: 'Quiero llevar otro diploma este semestre',
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
    cliente_nivel: 'recompro',
    cliente_compras: 3,
  }),
  fila({
    persona_id: '51977777888',
    persona_nombre: 'Milagros Flores',
    canal: 'whatsapp',
    referencia: haceHoras(15),
    texto: 'Avísame cuando abran la próxima cohorte',
    pregunto: true,
    n: 2,
    sin_leer: 2,
    no_leido: true,
    cliente_nivel: 'vip',
    cliente_compras: 7,
  }),

  // ══ 12: RENGLÓN 1 COMPLETO — dueño ajeno + etapa + pin + favorita, todos juntos ══
  fila({
    persona_id: '51977888999',
    persona_nombre: 'Elmer Quispe',
    canal: 'whatsapp',
    referencia: haceHoras(8),
    texto: 'Perfecto, mándame el número de cuenta',
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
    asignada_a: 'walter.diaz',
    etapa_manual: 'cotizado',
    fijada: true,
    favorita: true,
  }),

  // ══ 13-14: LA VENTANA — los otros dos colores de la escala ══
  fila({
    persona_id: '51977999000',
    persona_nombre: 'Yesenia Cutipa',
    canal: 'whatsapp',
    referencia: haceHoras(14),
    ventana_cierra: new Date(AHORA + 8 * 3_600_000).toISOString(), // 8h restantes → amarillo
    texto: 'Lo converso con mi esposo y te aviso',
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
  }),
  fila({
    persona_id: '51977000111',
    persona_nombre: 'Freddy Ninanya',
    canal: 'whatsapp',
    referencia: haceHoras(22),
    ventana_cierra: new Date(AHORA + 1.5 * 3_600_000).toISOString(), // 1h30 restante → rojo
    texto: '¿Sigue vigente el precio?',
    pregunto: true,
    n: 1,
    sin_leer: 1,
    no_leido: true,
  }),

  // ══ 15-17: LA BANDA DE TEMPERATURA — la escala completa (fresco/tibio/frío/helado) ══
  fila({
    persona_id: '51977111000',
    persona_nombre: 'Ruth Apaza (fresco, verde)',
    canal: 'whatsapp',
    referencia: haceHoras(3), // < 1 día
    texto: 'Recién escribió',
    n: 1,
    sin_leer: 1,
    no_leido: true,
  }),
  fila({
    persona_id: '51977111001',
    persona_nombre: 'Percy Layme (frío, 3-13 días)',
    canal: 'whatsapp',
    referencia: haceDias(6), // 3-13 días
    texto: 'Todavía no responde',
    n: 1,
    sin_leer: 0,
    no_leido: false,
  }),
  fila({
    persona_id: '51977111002',
    persona_nombre: 'Nora Ccama (helado, 14+ días)',
    canal: 'whatsapp',
    referencia: haceDias(20), // 14+ días
    texto: 'Silencio hace semanas',
    n: 1,
    sin_leer: 0,
    no_leido: false,
    respondida: true,
  }),

  // ══ 18: TELÉFONO SIN NOMBRE (WhatsApp sin registrar) ══
  fila({
    persona_id: '51966123456',
    persona_nombre: null,
    canal: 'whatsapp',
    referencia: haceHoras(1),
    texto: 'Hola, quería información',
    pregunto: true,
    n: 1,
    sin_leer: 1,
    no_leido: true,
  }),

  // ══ 19: LEAD DE FORMULARIO ("landing") — llenó el form, nunca escribió ══
  fila({
    clave: 'landing:9001',
    persona_id: null,
    persona_nombre: 'Grover Mendoza',
    canal: 'landing',
    tipo: 'lead',
    numero_propio: null,
    referencia: haceHoras(9),
    texto: null,
    lead_curso: 'Diploma en Gestión Pública',
    n: 1,
    sin_leer: 0,
    no_leido: false,
  }),
];

function Galeria() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[420px] space-y-2">
        <header className="space-y-1 pb-3">
          <h1 className="text-lg font-bold text-foreground">Fila de la cola — todos los casos (28-ago-2026)</h1>
          <p className="text-sm text-muted-foreground">
            1-5: los casos originales. 6-7: chip del bot (escalada / caliente). 8: chip de curso. 9-11:
            marca de cliente (Cliente / Cliente ×N / VIP), a la derecha del nombre. 12: dueño ajeno +
            etapa + pin + favorita juntos. 13-14: ventana amarilla y roja. 15-17: la banda de temperatura
            completa (verde / naranja-rojizo "frío" / gris "helado"). 18: WhatsApp sin nombre registrado.
            19: un lead de formulario, sin conversación iniciada.
          </p>
        </header>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {FILAS.map((c, i) => (
            <div key={c.clave} className="group/fila relative">
              <FilaConversacion
                c={c}
                indice={i}
                seleccionada={false}
                onAbrir={() => {}}
                etapa={c.etapa_manual}
                catalogoCategorias={[
                  { nombre: 'interesado', color: 'verde' },
                  { nombre: 'sin dni', color: 'naranja' },
                  { nombre: 'urgente', color: 'rojo' },
                  { nombre: 'seguimiento', color: 'azul' },
                ]}
              />
              <MenuFila clave={c.clave} estado={c} onFijar={() => {}} onFavorita={() => {}} onLeido={() => {}} />
            </div>
          ))}
        </div>
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
