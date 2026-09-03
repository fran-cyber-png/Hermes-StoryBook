// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { VistaConfiguracionPerfil } from './ConfiguracionPerfil';
import { motivoParaVincular } from '../whatsapp/miLinea';
import type { Vendedora } from './sesion';

/**
 * 🔴 «VINCULAR TU WHATSAPP» — el cableado del botón dentro del modal de
 * Configuración, migrado desde `PanelUsuario.lineaPropia.test.tsx` (20-ago-2026)
 * cuando el botón se mudó del popover chico a acá.
 *
 * `motivoParaVincular` (mias/tienePropia/estadoDeSesion → el motivo) ya tiene
 * sus propios tests puros en `whatsapp/miLinea.test.ts`; lo que se fija ACÁ es
 * que `VistaConfiguracionPerfil` dibuje lo que ese motivo dice — un botón que
 * el server ofrece y la pantalla no dibuja (o al revés) es mudo, y eso solo se
 * ve montando (ADR 0024).
 *
 * ⚠️ La lista de líneas propias («del equipo», etc.) SE ELIMINÓ del todo con
 * este mismo cambio (decisión del dueño) — no hay nada que probar de eso acá.
 */

const LUZ: Vendedora = { id: 'luz', nombre: 'Luz' };

const SIN_PERFIL = {
  fotoUrl: null,
  onCerrar: () => {},
  onGuardar: () => {},
  guardando: false,
  errorGuardar: null,
  onElegirFoto: () => {},
  subiendoFoto: false,
  errorFoto: null,
  onQuitarFoto: () => {},
  quitandoFoto: false,
  actividad: { activo: true, transcurrido: '00:00:00' },
} as const;

function panel(motivoVincular: ReturnType<typeof motivoParaVincular>) {
  return <VistaConfiguracionPerfil vendedora={LUZ} motivoVincular={motivoVincular} {...SIN_PERFIL} />;
}

const boton = (m: Montado) =>
  [...m.contenedor.querySelectorAll('button')].find((b) => /vincular tu whatsapp/i.test(b.textContent ?? ''));

describe('ConfiguracionPerfil · a quién se le ofrece traer su línea', () => {
  let m: Montado | null = null;
  afterEach(() => m?.desmontar());

  it('🔴 con SOLO la línea del equipo (sin propia), el botón SÍ aparece', () => {
    // El caso de las siete personas que comparten `51984429504`.
    m = montar(panel(motivoParaVincular(false, undefined)));
    expect(boton(m)).toBeTruthy();
  });

  it('con una línea PROPIA que ANDA, el botón NO aparece', () => {
    m = montar(panel(motivoParaVincular(true, 'conectado')));
    expect(boton(m)).toBeFalsy();
  });

  it('sin ninguna línea, aparece — el caso de siempre, que no se rompió', () => {
    m = montar(panel(motivoParaVincular(false, undefined)));
    expect(boton(m)).toBeTruthy();
  });

  it('🔴 con línea propia SIN VINCULAR, ofrece volver a vincular y lo dice', () => {
    // 'sin_vincular' (guión bajo) es el string real que manda el server acá —
    // el del CONTRATO (`numeros/dominio.ts`), no el crudo del transporte
    // ('sin-vincular', con guión). Usar el crudo era justo el bug que hacía
    // que el botón nunca reapareciera después de un `logged_out` real.
    m = montar(panel(motivoParaVincular(true, 'sin_vincular')));
    const b = boton(m);
    expect(b).toBeTruthy();
    expect(b?.textContent).toContain('Volver a vincular');
    expect(m.contenedor.textContent).toContain('no está conectada');
  });

  it('🔴 con la línea BANEADA no se ofrece vincular', () => {
    m = montar(panel(motivoParaVincular(true, 'baneado')));
    expect(boton(m)).toBeFalsy();
  });

  it('`motivoVincular` ausente (undefined u opcional) no ofrece nada — mismo criterio que `null`', () => {
    m = montar(<VistaConfiguracionPerfil vendedora={LUZ} {...SIN_PERFIL} />);
    expect(boton(m)).toBeFalsy();
  });
});

/**
 * 🔴 «DESVINCULAR WHATSAPP» — el rojo que reemplaza al verde una vez que la
 * línea auto-vinculada anda. Vive aparte del describe de arriba porque no lo
 * gobierna `motivoVincular`: depende de `numeroVinculado` + `conectada`, los
 * mismos dos datos que ya se usan para pintar el punto verde/rojo.
 */
const botonDesvincular = (m: Montado) =>
  [...m.contenedor.querySelectorAll('button')].find((b) => /desvincular whatsapp/i.test(b.textContent ?? ''));

describe('ConfiguracionPerfil · cuándo se ofrece desvincular', () => {
  let m: Montado | null = null;
  afterEach(() => m?.desmontar());

  it('🔴 línea propia CONECTADA: aparece "Desvincular WhatsApp" y NO el verde', () => {
    m = montar(
      <VistaConfiguracionPerfil
        vendedora={LUZ}
        numeroVinculado="51955135507"
        conectada={true}
        motivoVincular={motivoParaVincular(true, 'conectado')}
        {...SIN_PERFIL}
      />,
    );
    expect(botonDesvincular(m)).toBeTruthy();
    expect(boton(m)).toBeFalsy();
  });

  it('con línea propia pero SIN conectar, no se ofrece desvincular (no hay sesión que cortar)', () => {
    m = montar(
      <VistaConfiguracionPerfil
        vendedora={LUZ}
        numeroVinculado="51955135507"
        conectada={false}
        motivoVincular={motivoParaVincular(true, 'sin_vincular')}
        {...SIN_PERFIL}
      />,
    );
    expect(botonDesvincular(m)).toBeFalsy();
  });

  it('sin ninguna línea vinculada, no se ofrece desvincular', () => {
    m = montar(
      <VistaConfiguracionPerfil
        vendedora={LUZ}
        numeroVinculado={null}
        conectada={false}
        motivoVincular={motivoParaVincular(false, undefined)}
        {...SIN_PERFIL}
      />,
    );
    expect(botonDesvincular(m)).toBeFalsy();
  });
});
