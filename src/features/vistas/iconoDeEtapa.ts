import {
  BadgeCheck,
  BadgeDollarSign,
  Clock,
  Handshake,
  Heart,
  MessageCircle,
  MessageCircleDashed,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { EtapaTrabajo } from './tablero';

/**
 * EL ÍCONO DE CADA COLUMNA (13-sep-2026, la maqueta que eligió el dueño): una forma
 * que se reconoce antes de leer el título. Lo leen la cabecera de la columna
 * (`CabeceraColumna`) y, grande y tenue, la columna vacía (`VistaEmbudo`).
 *
 * Nació para las cinco de campaña; el 14-sep-2026 el dueño pidió el mismo diseño
 * para la Escuela y entraron las tres que sólo tiene ventas. Cada una repite el
 * glifo con el que la TARJETA ya cuenta el mismo hecho, para no enseñar dos
 * dibujos para una sola cosa (`TarjetaEmbudo`): «Saben el precio» es la etiqueta
 * del chip «Precio», «Compraron» es la insignia del chip «Cliente». «Nunca
 * contestaron» es un globo PUNTEADO —la conversación que abrimos y quedó en el
 * aire—; no el reloj de arena, que en esta app es la ventana de 24 h y nada más.
 *
 * Vive aparte y no en el componente: un archivo de componente que además exporta una
 * constante rompe el Fast Refresh de Vite (`only-export-components`).
 */
export const ICONO_DE_ETAPA: Partial<Record<EtapaTrabajo, LucideIcon>> = {
  interesado: Clock,
  sin_respuesta: MessageCircleDashed,
  contactado: MessageCircle,
  cotizado: BadgeDollarSign,
  cierre: BadgeCheck,
  simpatiza: Heart,
  comprometido: Handshake,
  voluntario: Users,
};
