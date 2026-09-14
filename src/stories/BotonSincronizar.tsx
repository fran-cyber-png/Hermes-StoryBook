import { useRef, useState } from 'react';

/**
 * El botón "Sincronizar ahora" de la página Novedades. Pega contra `/__sync-hermes`,
 * una ruta que sólo existe cuando `npm run storybook` está corriendo local (la agrega
 * `.storybook/syncHermes.ts` al dev server de Vite) — en un Storybook publicado o
 * estático esta ruta no existe, así que el botón muestra el error de red tal cual.
 */
export function BotonSincronizar() {
  const [estado, setEstado] = useState<'quieto' | 'corriendo' | 'hecho' | 'error'>('quieto');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [huboCambios, setHuboCambios] = useState(false);
  /**
   * `estado === 'corriendo'` sólo bloquea el botón DESPUÉS de que React vuelva a
   * pintar — un doble clic (o un reintento de automatización) que entra antes de
   * ese repintado no lo ve. Este ref es síncrono: corta el segundo pedido en el
   * mismo tick en que entra, sin esperar al render.
   */
  const enVuelo = useRef(false);

  async function sincronizar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEstado('corriendo');
    setMensaje(null);
    try {
      const res = await fetch('/__sync-hermes', { method: 'POST' });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? `Error ${res.status}`);
      setMensaje(datos.mensaje as string);
      setHuboCambios(Boolean(datos.cambios));
      setEstado('hecho');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
      setEstado('error');
    } finally {
      enVuelo.current = false;
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
      <button
        type="button"
        onClick={sincronizar}
        disabled={estado === 'corriendo'}
        style={{
          border: 'none',
          borderRadius: '8px',
          padding: '0.6rem 1.1rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: estado === 'corriendo' ? 'default' : 'pointer',
          background: estado === 'corriendo' ? '#94A3B8' : '#1D4ED8',
          color: 'white',
        }}
      >
        {estado === 'corriendo' ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>

      {estado === 'corriendo' && (
        <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', opacity: 0.7 }}>
          Revisando hermes/main, esto puede tardar si hay que instalar dependencias nuevas…
        </p>
      )}

      {estado === 'hecho' && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: huboCambios ? '#DCFCE7' : '#F1F5F9',
            color: huboCambios ? '#166534' : '#475569',
            fontSize: '0.85rem',
          }}
        >
          {mensaje}
          {huboCambios && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#166534',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Recargar esta página
              </button>{' '}
              para verlo en la lista de abajo.
            </>
          )}
        </div>
      )}

      {estado === 'error' && (
        <p style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem' }}>
          No se pudo sincronizar: {mensaje}
        </p>
      )}
    </div>
  );
}
