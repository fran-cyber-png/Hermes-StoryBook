import { describe, expect, test } from 'vitest';
import { avisoDeVarita } from './varita';

/**
 * LOS MOTIVOS DEL MOTOR, TRADUCIDOS.
 *
 * El pipeline tiene motivos legítimos para no proponer nada y todos llegan
 * escritos para un log. Mostrarlos crudos —«el pipeline cortó antes de producir
 * una respuesta»— le dice a la vendedora que la app está rota cuando lo que
 * pasó es que el bot decidió callarse, que es distinto y a veces correcto.
 */
describe('avisoDeVarita', () => {
  test('sin entrante no es un error: es que no hay nada que responder', () => {
    expect(avisoDeVarita('no hay ningún mensaje del lead que responder')).toBe(
      'Todavía no hay nada que responder acá.',
    );
  });

  test('la falta de credenciales se distingue del silencio del bot', () => {
    expect(avisoDeVarita('falta_config')).toContain('no está configurado');
  });

  test('un fallo del motor invita a reintentar; el silencio deliberado no', () => {
    expect(avisoDeVarita('el motor falló: timeout')).toContain('Prueba de nuevo');
    expect(avisoDeVarita('sin_texto_entrante')).not.toContain('Prueba de nuevo');
  });

  /**
   * Medido en producción el 9-set-2026: las dos primeras varitas volvieron con
   * `motivo: apagado` y la pantalla dijo «El bot prefirió no sugerir nada en
   * esta conversación». El bot no prefirió nada — estaba apagado. Un cartel que
   * inventa una decisión manda a buscar el problema al lado equivocado.
   */
  test('los motivos de salto del pipeline no se disfrazan de decisión del bot', () => {
    expect(avisoDeVarita('apagado')).toBe('El bot está apagado en esta línea.');
    expect(avisoDeVarita('linea_no_habilitada')).toContain('no está habilitado');
    expect(avisoDeVarita('frenado')).toContain('frenado');
    expect(avisoDeVarita('vendedora_activa')).toContain('respuesta tuya');
    expect(avisoDeVarita('desconectado')).toContain('no está conectada');
    // Salta cuando el perfil de la línea y su configuración en la base no coinciden:
    // una campaña que el mapa no conoce, o la de Betto sin su fila en numeros_wa.
    // Por eso el aviso no dice «no tiene perfil»: en el segundo caso sí lo tiene.
    expect(avisoDeVarita('sin_perfil')).toBe('El perfil del bot no coincide con la configuración de esta línea.');
    // Una línea de campaña sin cliente no lee las respuestas rápidas de nadie (#951).
    // Es otra causa que `sin_perfil`, y el aviso dice cuál falta.
    expect(avisoDeVarita('sin_cliente')).toBe('Esta línea de campaña todavía no tiene cliente asignado.');
    for (const m of ['apagado', 'linea_no_habilitada', 'sin_perfil', 'sin_cliente', 'frenado', 'desconectado']) {
      expect(avisoDeVarita(m)).not.toContain('prefirió');
    }
  });

  test('sin motivo también dice algo: un cartel vacío se lee como que se colgó', () => {
    expect(avisoDeVarita(null)).toBe('El bot no tuvo nada que sugerir.');
  });
});
