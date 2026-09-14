import { useState } from 'react';
import {
  BookOpen,
  Box,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Headphones,
  Layers,
  Package,
  Shirt,
  type LucideIcon,
} from 'lucide-react';
import { CLASE_FONDO_SUAVE, CLASE_TEXTO } from '../../dominio/paletaCategorias';
import { cn } from '../../lib/utils';
import { glifoDe, type Glifo, type Producto } from './productos';

const ICONO: Record<Glifo, LucideIcon> = {
  curso: GraduationCap,
  evento: CalendarDays,
  libro: BookOpen,
  audio: Headphones,
  objeto: Box,
  merch: Shirt,
  servicio: Briefcase,
  pack: Layers,
  otro: Package,
};

/**
 * LA PORTADA DE UN PRODUCTO — la foto cuando existe, y una portada con identidad
 * cuando no (ADR 0106).
 *
 * El pedido del dueño es «que tenga una imagen para que sea un poco visual, darle
 * más utilidad e identidad a la página». Lo medido es que hoy **ninguna** imagen
 * llega a Hermes: la API pública de Cerberus no publica `imagen_producto`, y los 32
 * datos activos tienen cero imágenes. Por eso la portada sin foto NO es un recuadro
 * gris (que es exactamente lo que Cerberus guarda por default, `productos/default.png`):
 * es el color con el que la cola ya pinta ese curso, sus iniciales y el ícono de su
 * categoría. Un producto sin foto se reconoce igual.
 *
 * ⚠️ **Nunca oro**: el color sale de `colorDeCurso`, que ya lo excluye (el oro es
 * tiempo que se acaba).
 *
 * `variante="tarjeta"` se achica a miniatura cuando la grilla es angosta (en el
 * teléfono la tarjeta es un renglón). Ahí la categoría pasa al texto de la tarjeta y
 * la foto va recortada: entera quedaba un sello chiquito sobre un desenfoque lavado,
 * y lo mostró la captura a 390 px, no un test.
 */
export function Portada({
  producto,
  variante = 'tarjeta',
  apagada = false,
  className,
}: {
  producto: Producto;
  variante?: 'tarjeta' | 'hoja';
  apagada?: boolean;
  className?: string;
}) {
  // La URL que falló, no un booleano: si la foto cambia, la nueva merece su intento.
  const [rota, setRota] = useState<string | null>(null);
  const Icono = ICONO[glifoDe(producto.categoria)];
  const imagen = producto.imagen && producto.imagen !== rota ? producto.imagen : null;
  const enHoja = variante === 'hoja';

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden',
        CLASE_FONDO_SUAVE[producto.color],
        apagada && 'grayscale',
        className,
      )}
    >
      {imagen ? (
        <>
          {/* La foto llega en cualquier proporción: la portada OG de una landing es
              1,9:1 y la tapa de un libro es vertical. En la tarjeta ancha y en la hoja
              se muestra ENTERA y el hueco lo llena la misma foto desenfocada: recortar
              a 40:21 le cortaba el título al Manual de Inteligencia. */}
          <img
            src={imagen}
            alt=""
            aria-hidden
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl',
              !enHoja && 'hidden @min-[30rem]:block',
            )}
          />
          <img
            src={imagen}
            alt={`Portada de ${producto.nombre}`}
            loading="lazy"
            onError={() => setRota(imagen)}
            className={cn(
              'relative h-full w-full',
              enHoja ? 'object-contain' : 'object-cover @min-[30rem]:object-contain',
              apagada && 'opacity-60',
            )}
          />
        </>
      ) : (
        <div aria-hidden className={cn('absolute inset-0', CLASE_TEXTO[producto.color], apagada && 'opacity-60')}>
          {/* Una trama de líneas en el color del curso, casi invisible: le quita lo
              plano a la superficie sin sumar un color nuevo. */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_11px)] opacity-[0.07]" />
          <Icono
            strokeWidth={1.1}
            className={cn(
              'absolute opacity-25',
              enHoja
                ? '-bottom-6 -right-4 size-40'
                : '-bottom-2 -right-2 size-14 @min-[30rem]:-bottom-4 @min-[30rem]:-right-3 @min-[30rem]:size-24',
            )}
          />
          <span
            className={cn(
              'absolute font-heading font-extrabold leading-none tracking-tight',
              enHoja
                ? 'left-5 top-5 text-6xl'
                : 'left-2.5 top-2.5 text-[1.35rem] @min-[30rem]:left-3.5 @min-[30rem]:top-3 @min-[30rem]:text-[2.1rem]',
            )}
          >
            {producto.iniciales}
          </span>
        </div>
      )}

      <span
        className={cn(
          'absolute bottom-2 left-2 z-10 items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-sm',
          enHoja ? 'inline-flex' : 'hidden @min-[30rem]:inline-flex',
        )}
      >
        <Icono size={11} aria-hidden />
        {producto.categoria}
      </span>

      {apagada && (
        <span className="absolute right-2 top-2 z-10 rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          Dado de baja
        </span>
      )}
    </div>
  );
}
