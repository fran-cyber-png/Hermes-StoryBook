import type { ReactNode } from 'react';

/**
 * Las piezas que dibujan las páginas de Fundamentos. Viven acá y no adentro del
 * `.mdx` porque el MDX de Storybook no es un buen lugar para lógica: cada bloque
 * de JSX ahí adentro se vuelve difícil de leer y no se puede tipar.
 *
 * ⚠️ **Los colores se leen del token, nunca del hexadecimal.** Cada muestra pinta
 * con `var(--…)`, así que si el token cambia —o si se mira en tema oscuro— la
 * muestra cambia con él. Una página de fundamentos con hexadecimales escritos a
 * mano miente el día que alguien toca la paleta, que es justo el día en que más
 * se la consulta.
 *
 * 🔴 **Son los tokens CRUDOS de `:root` (`--gold`), no los de Tailwind
 * (`--color-gold`), y eso no es una preferencia de estilo.** Tailwind 4 emite las
 * variables de `@theme` sólo para los tokens que alguna utility usa en el código
 * escaneado. Estas páginas los usan dentro de `style={{…}}`, que Tailwind no ve,
 * así que `var(--color-temp-fresco)` resolvía a cadena VACÍA y la muestra salía
 * en blanco. Los únicos que funcionaban eran los que algún componente usaba por
 * otro lado (`--color-navy`, `--color-gold`), o sea que la página parecía andar
 * y mentía en la mitad de las muestras. Lo atrapó mirarla, no el typecheck.
 */

export function Muestra({
  token,
  nombre,
  significado,
  tinta,
}: {
  /** El nombre crudo, sin prefijo: `gold`, `temp-fresco`… */
  token: string;
  nombre: string;
  significado: ReactNode;
  /** El token de la tinta que va ENCIMA, cuando la muestra lleva texto adentro. */
  tinta?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: '0.5rem 0' }}>
      <div
        style={{
          background: `var(--${token})`,
          color: tinta ? `var(--${tinta})` : undefined,
          width: '5.5rem',
          minHeight: '3rem',
          flexShrink: 0,
          borderRadius: '10px',
          border: '1px solid rgb(0 0 0 / 0.08)',
          display: 'grid',
          placeItems: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}
      >
        {tinta ? 'Aa' : ''}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{nombre}</div>
        <code style={{ fontSize: '0.72rem', opacity: 0.65 }}>--{token}</code>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.25rem' }}>{significado}</div>
      </div>
    </div>
  );
}

export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: '1px solid var(--sb-border, #E2E8F0)',
        borderRadius: '12px',
        padding: '0.5rem 1.1rem 1rem',
        marginBottom: '1.5rem',
      }}
    >
      <h3 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>{titulo}</h3>
      {children}
    </section>
  );
}

/** Una regla dura de la marca: se lee como advertencia, no como nota al pie. */
export function Regla({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        borderLeft: '3px solid var(--gold)',
        background: 'color-mix(in oklab, var(--gold) 10%, transparent)',
        padding: '0.7rem 1rem',
        borderRadius: '0 8px 8px 0',
        fontSize: '0.88rem',
        lineHeight: 1.55,
        margin: '1rem 0',
      }}
    >
      {children}
    </p>
  );
}
