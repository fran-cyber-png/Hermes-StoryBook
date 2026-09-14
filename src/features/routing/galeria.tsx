import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '../../index.css';
import { queryClient } from '../../lib/datos/cliente';
import { Lienzo } from './Lienzo';
import { columnasDeDivision, cablesDeDivision, columnasDePieza, type Apertura, type Pieza } from './piezas';
import { HojaDelAnuncio } from './HojaDelAnuncio';
import { Monitoreo } from './Monitoreo';
import { emitirPulsoDeRuteo } from '../../lib/datos/pulsoDeRuteo';
import type { TableroDeRuteo } from './routing';
import type { CableLienzo, ColumnaLienzo } from './reglasDelLienzo';

/**
 * LA GALERÍA DEL RUTEO POR PRODUCTO — la evidencia, sin nada vivo detrás.
 *
 * Entry APARTE de Vite (`galeria-routing.html` en la raíz): **no entra al bundle
 * de la app** —`vite build` toma solo `index.html`— y no habla con ningún server.
 *
 *     npx vite --port 5199  →  http://localhost:5199/galeria-routing.html
 *
 * Existe por la regla dura #9 (nada de UI se reporta listo sin captura) y para
 * poder ver de una las tres cosas que este frente promete y que ningún test
 * puede mirar: que **el puntito se vea llegar a la persona**, que el que cae por
 * la rueda —el caso mayoritario— **también se vea**, y que la franja de
 * monitoreo diga algo útil de un vistazo.
 *
 * 🔴 **LOS VALORES SON LOS MEDIDOS EN PRODUCCIÓN**, no un caso ideal (regla dura
 * #10): las divisiones y sus tamaños salen del catálogo real de Cerberus del
 * 24-ago-2026, y el desglose de `cayo` refleja lo que de verdad hay —casi todo
 * por la rueda, cero por campaña—, que es justo lo que la pantalla tiene que
 * saber mostrar sin parecer rota.
 */

const VENDEDORAS = ['Luz', 'Sindy', 'Darian', 'Nicole', 'ventas10@grupogoberna.com'];

const COLUMNAS: ColumnaLienzo[] = [
  {
    id: 'division',
    titulo: 'La división',
    ancho: 16,
    nodos: [
      {
        id: 'div:inteligencia',
        titulo: 'Inteligencia',
        pie: '58 familias · 96 productos',
        icono: 'producto',
        salida: true,
      },
    ],
  },
  {
    id: 'productos',
    titulo: 'Lo que le entra',
    ancho: 20,
    nodos: [
      {
        id: 'prod:dipicot',
        titulo: 'Diplomado en Inteligencia y Contrainteligencia',
        pie: '23 productos · 120 leads',
        icono: 'producto',
        entrada: true,
        salida: true,
      },
      {
        id: 'prod:diposoc',
        titulo: 'Diploma Técnico en OSINT & SOCMINT',
        pie: '4 productos · 59 leads',
        icono: 'producto',
        entrada: true,
        salida: true,
      },
      {
        id: 'prod:dipcoco',
        titulo: 'Diploma de Contraterrorismo y Contrainsurgencia',
        pie: '3 productos · 4 leads',
        icono: 'producto',
        entrada: true,
        salida: true,
      },
    ],
  },
  {
    id: 'vendedoras',
    titulo: 'Vendedoras',
    ancho: 14,
    nodos: VENDEDORAS.map((v) => ({ id: `v:${v}`, titulo: v, icono: 'vendedora' as const, entrada: true })),
  },
];

const CABLES: CableLienzo[] = [
  { de: 'div:inteligencia', a: 'prod:dipicot', tipo: 'pertenencia', color: 'producto' },
  { de: 'div:inteligencia', a: 'prod:diposoc', tipo: 'pertenencia', color: 'producto' },
  { de: 'div:inteligencia', a: 'prod:dipcoco', tipo: 'pertenencia', color: 'producto' },
  { de: 'prod:dipicot', a: 'v:Luz', tipo: 'regla', color: 'producto' },
  { de: 'prod:dipicot', a: 'v:Sindy', tipo: 'regla', color: 'producto' },
  { de: 'prod:diposoc', a: 'v:Darian', tipo: 'regla', color: 'producto' },
];

/**
 * El desglose REAL: 3.637 asignaciones, cero por campaña. Es la foto que la
 * pantalla tiene que saber mostrar — si sólo supiera dibujar el caso cableado,
 * acá se vería vacía y parecería rota.
 */
const TABLERO: TableroDeRuteo = {
  divisiones: [],
  familias: [],
  actualizadoAt: new Date().toISOString(),
  ventanaDias: 30,
  cayo: [
    { motivo: 'round-robin', vendedoraId: 'luz', conversaciones: 41, ultima: null },
    { motivo: 'round-robin', vendedoraId: 'sindy', conversaciones: 38, ultima: null },
    { motivo: 'producto', vendedoraId: 'luz', conversaciones: 12, ultima: null },
    { motivo: 'division', vendedoraId: 'darian', conversaciones: 7, ultima: null },
    { motivo: 'manual', vendedoraId: 'nicole', conversaciones: 3, ultima: null },
  ],
};

/**
 * REPARTIR UN ANUNCIO EN PORCENTAJES (#1002).
 *
 * La campaña y el anuncio son los medidos el 11-ago-2026 (`db/routing.ts`):
 * `[JUL] INTELIGENCIA | WSP` son nueve anuncios, y `120248616484060016` es el
 * que llega con dos titulares. Las columnas salen de `columnasDePieza`, la misma
 * función de la pantalla, con la campaña ABIERTA: un anuncio con su reparto y
 * otro que sigue la regla de la campaña.
 *
 * ⚠️ **Esto retrata la hoja y el renglón, no el cableado.** Que tocar el renglón
 * abra la hoja y que el `PUT` salga con el conjunto completo lo fija
 * `VistaRouting.anuncio.test.tsx`, que monta la vista de verdad.
 *
 * 🔴 **Y SÓLO MUESTRA ESTADOS QUE PUEDEN EXISTIR** (candado #10). La primera
 * versión le pasaba a la hoja un reparto GUARDADO de 30 + 50, que el server
 * nunca acepta: la captura mostraba «Quitar el reparto» —que no aparece al
 * tipear en un anuncio sin regla— y el renglón del lienzo no coincidía con la
 * hoja. Ahora el segundo caso es el anuncio SIN reparto, y el «faltan 20 %» se
 * obtiene tipeando 30 y 50 en la hoja, que es como lo ve una persona.
 */
const CAMPANA_ANUNCIOS: Pieza = {
  id: 'campana:120248613186140016',
  titulo: '[JUL] INTELIGENCIA | WSP',
  icono: 'campana',
  pie: '9 anuncios · 61 personas',
  estado: 'activa',
  familia: null,
  volumen: 61,
  vendedoras: ['Luz'],
  anunciosConReparto: 1,
};
const ANUNCIO_SIN_REPARTO = {
  adId: '120248613186150016',
  titular: 'I Foro de Estado 2026',
  personas: 14,
  ultima: null,
  reparto: [],
};
const ANUNCIO_REPARTIDO = {
  adId: '120248616484060016',
  titular: 'Inteligencia Estratégica',
  personas: 23,
  ultima: null,
  reparto: [
    { vendedora: 'Luz', porcentaje: 70 },
    { vendedora: 'Sindy', porcentaje: 30 },
  ],
};
const APERTURA_ANUNCIOS: Apertura = {
  id: CAMPANA_ANUNCIOS.id,
  cargando: false,
  anuncios: [ANUNCIO_REPARTIDO, ANUNCIO_SIN_REPARTO],
};
const COLUMNAS_ANUNCIOS = columnasDePieza(CAMPANA_ANUNCIOS, VENDEDORAS, APERTURA_ANUNCIOS);

/** Un tablero recortado: lo que ve una vendedora que no manda en el equipo. */
const TABLERO_RECORTADO: TableroDeRuteo = {
  ...TABLERO,
  recortado: true,
  cayo: [{ motivo: 'round-robin', vendedoraId: 'luz', conversaciones: 41, ultima: null }],
};

/**
 * Los pulsos, en bucle: uno POR CABLE (cayó por producto) y otro SIN cable
 * (cayó por la rueda). Los dos tienen que verse, y verse distinto.
 */
function Pulsos() {
  useEffect(() => {
    const disparar = () => {
      emitirPulsoDeRuteo({
        tipo: 'ruteo',
        canal: 'whatsapp',
        motivo: 'producto',
        eje: 'familia',
        regla: 'dipicot',
        hecho: 'alta',
        destino: 'luz',
      });
      setTimeout(
        () =>
          emitirPulsoDeRuteo({
            tipo: 'ruteo',
            canal: 'whatsapp',
            motivo: 'round-robin',
            eje: '',
            regla: '',
            hecho: 'alta',
            destino: 'Nicole',
          }),
        700,
      );
      setTimeout(
        () =>
          emitirPulsoDeRuteo({
            tipo: 'ruteo',
            canal: 'whatsapp',
            motivo: 'producto',
            eje: 'familia',
            regla: 'diposoc',
            hecho: 'revencida',
            destino: 'darian',
          }),
        1400,
      );
    };
    disparar();
    const t = setInterval(disparar, 3000);
    return () => clearInterval(t);
  }, []);
  return null;
}

/**
 * El historial, sembrado en el caché: la galería no habla con ningún server.
 *
 * ⚠️ **Los valores imitan el reparto REAL** (regla dura #10): casi todo por la
 * rueda, un puñado por producto, una vencida que volvió y una movida a mano. Un
 * caso ideal —todo por producto— escondería justo lo que hay que poder leer de
 * un vistazo: que la mayoría todavía no pasa por ninguna regla.
 */
const HISTORIAL = {
  filas: [
    { id: 812, vendedoraId: 'luz', motivo: 'producto', eje: 'familia', regla: 'dipicot', tipo: 'alta', decididaPor: null, ocurrioEn: haceMin(2) },
    { id: 811, vendedoraId: 'sindy', motivo: 'round-robin', eje: '', regla: '', tipo: 'alta', decididaPor: null, ocurrioEn: haceMin(14) },
    { id: 810, vendedoraId: 'darian', motivo: 'division', eje: 'division', regla: 'inteligencia', tipo: 'alta', decididaPor: null, ocurrioEn: haceMin(48) },
    { id: 809, vendedoraId: 'luz', motivo: 'producto', eje: 'familia', regla: 'diposoc', tipo: 'revencida', decididaPor: null, ocurrioEn: haceMin(95) },
    { id: 808, vendedoraId: 'nicole', motivo: 'manual', eje: '', regla: '', tipo: 'manual', decididaPor: 'alex', ocurrioEn: haceMin(140) },
    { id: 807, vendedoraId: 'sindy', motivo: 'round-robin', eje: '', regla: '', tipo: 'alta', decididaPor: null, ocurrioEn: haceMin(190) },
  ],
};

function haceMin(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

queryClient.setQueryData(['routing', 'historial'], HISTORIAL);

/**
 * La división armada con las MISMAS funciones que usa la pantalla, no a mano:
 * una galería que dibuja columnas inventadas prueba el dibujo, no el código.
 * Los números salen del catálogo vivo de Cerberus del 24-ago-2026.
 */
const DIV = { division: 'inteligencia', nombre: 'Inteligencia', familias: 58, productos: 96 };
const FAMS = [
  { familia: 'dipicot', nombre: 'Diplomado en Inteligencia y Contrainteligencia', productos: 23, vendedoras: ['Luz'] },
  { familia: 'diposoc', nombre: 'Diploma Técnico en OSINT & SOCMINT', productos: 4, vendedoras: [] },
  { familia: 'dipcoco', nombre: 'Diploma de Contraterrorismo y Contrainsurgencia', productos: 3, vendedoras: [] },
];
const ARMADO_DIV = columnasDeDivision(DIV, FAMS, VENDEDORAS);
const CABLES_DIV = [
  ...ARMADO_DIV.pertenencia,
  ...cablesDeDivision({ division: DIV.division, vendedoras: ['Sindy'] }, FAMS, VENDEDORAS),
];

function Galeria() {
  return (
    <div className="min-h-dvh bg-background p-6 text-foreground">
      <h1 className="mb-1 text-lg font-semibold">Routing — el lead que cae</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Valores medidos en producción el 24-ago-2026. El puntito se dispara solo cada 3 s.
      </p>

      <h2 className="mb-2 text-sm font-medium">La franja de monitoreo</h2>
      <div className="mb-6 overflow-hidden rounded-xl border border-border">
        <Monitoreo tablero={TABLERO} />
      </div>

      <h2 className="mb-2 text-sm font-medium">
        Recortada — lo que ve una vendedora que no manda en el equipo
      </h2>
      <div className="mb-6 overflow-hidden rounded-xl border border-border">
        <Monitoreo tablero={TABLERO_RECORTADO} />
      </div>

      <h2 className="mb-2 text-sm font-medium">
        Repartir un anuncio en porcentajes — lo guardado (70 / 30)
      </h2>
      <div className="relative mb-6 flex h-[26rem] overflow-hidden rounded-xl border border-border">
        <Lienzo
          columnas={COLUMNAS_ANUNCIOS}
          cables={[]}
          onConectar={() => {}}
          onCortar={() => {}}
          onEntrar={() => {}}
          onAdentro={() => {}}
        />
        <HojaDelAnuncio
          anuncio={ANUNCIO_REPARTIDO}
          campana={CAMPANA_ANUNCIOS.titulo}
          destinos={VENDEDORAS}
          deBaja={[]}
          onCerrar={() => {}}
        />
      </div>

      <h2 className="mb-2 text-sm font-medium">
        Repartir un anuncio sin reparto — tipea 30 y 50 en la hoja para ver «faltan 20 %»
      </h2>
      <div
        className="relative mb-6 flex h-[26rem] overflow-hidden rounded-xl border border-border"
        data-galeria="tipear"
      >
        <Lienzo
          columnas={COLUMNAS_ANUNCIOS}
          cables={[]}
          onConectar={() => {}}
          onCortar={() => {}}
          onEntrar={() => {}}
          onAdentro={() => {}}
        />
        <HojaDelAnuncio
          anuncio={ANUNCIO_SIN_REPARTO}
          campana={CAMPANA_ANUNCIOS.titulo}
          destinos={VENDEDORAS}
          deBaja={[]}
          onCerrar={() => {}}
        />
      </div>

      <h2 className="mb-2 text-sm font-medium">
        Cablear la división — una regla que cubre 96 productos
      </h2>
      {/**
       * ⚠️ **Esto retrata el LIENZO, no la vista.** Monta `Lienzo` directo, así
       * que NO prueba que elegir una división en `VistaRouting` llegue hasta acá
       * — de hecho durante un rato no llegaba, y esta misma captura se veía
       * perfecta. Lo que fija ese cableado es
       * `VistaRouting.division.test.tsx`; esto muestra cómo se ve.
       */}
      <div className="mb-6 flex h-[22rem] overflow-hidden rounded-xl border border-border">
        <Lienzo
          columnas={ARMADO_DIV.columnas}
          cables={CABLES_DIV}
          onConectar={() => {}}
          onCortar={() => {}}
        />
      </div>

      <h2 className="mb-2 text-sm font-medium">
        El lienzo — división → producto → vendedora, con el puntito en vuelo
      </h2>
      <div className="flex h-[26rem] overflow-hidden rounded-xl border border-border">
        <Lienzo columnas={COLUMNAS} cables={CABLES} onConectar={() => {}} onCortar={() => {}} />
      </div>
      <Pulsos />
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
