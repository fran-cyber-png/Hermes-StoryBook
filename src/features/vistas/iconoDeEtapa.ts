import { Clock, Handshake, Heart, MessageCircle, Users, type LucideIcon } from 'lucide-react';
import type { EtapaTrabajo } from './tablero';

/**
 * EL ÍCONO DE CADA COLUMNA DE CAMPAÑA (13-sep-2026, la maqueta que eligió el dueño): una
 * forma que se reconoce antes de leer el título. Lo leen la cabecera de la columna
 * (`CabeceraColumnaCampana`) y, grande y tenue, la columna vacía (`VistaEmbudo`).
 *
 * Vive aparte y no en el componente: un archivo de componente que además exporta una
 * constante rompe el Fast Refresh de Vite (`only-export-components`).
 */
export const ICONO_DE_ETAPA: Partial<Record<EtapaTrabajo, LucideIcon>> = {
  interesado: Clock,
  contactado: MessageCircle,
  simpatiza: Heart,
  comprometido: Handshake,
  voluntario: Users,
};
