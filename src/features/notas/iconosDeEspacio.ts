import {
  Award,
  Briefcase,
  Building2,
  Compass,
  Flag,
  Folder,
  FolderOpen,
  GraduationCap,
  Globe,
  Handshake,
  Heart,
  Layers,
  Lightbulb,
  Home,
  MapPin,
  Megaphone,
  Package,
  PiggyBank,
  Rocket,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * EL SET CURADO DE ÍCONOS DE UN ESPACIO (03-sep-2026).
 *
 * Las 25 claves son texto plano, no componentes: lo que viaja al server y se
 * guarda en `espacios.icono` es la CLAVE (`"Rocket"`), nunca el ícono en sí —
 * la base no sabe dibujar nada. El server valida contra la MISMA lista
 * (`routes/espacios.ts: ICONOS_DE_ESPACIO`, copiada a mano: server y front
 * no comparten código, `docs/arquitectura.md`).
 *
 * ⚠️ Ninguna de estas 25 se reusa de las que YA tienen un significado fijo en
 * este frente: `Users` (el ícono por defecto de un espacio, y "compartido"
 * en `AccionesDePagina.tsx`), `Archive`/`ArchiveRestore`/`Trash2` (estado
 * archivado / Papelera), `Star` (Favoritas), `Files`/`FileText` (páginas),
 * `Settings2` (Configuración), `Check`/`X`/`ChevronDown`/`Plus`/`Search`/
 * `Loader2` (chrome de UI). Reasignar cualquiera de ésas leería distinto en
 * dos lugares del mismo feature.
 */
export const ICONOS_DE_ESPACIO: readonly { clave: string; Icono: LucideIcon }[] = [
  { clave: 'Briefcase', Icono: Briefcase },
  { clave: 'Building2', Icono: Building2 },
  { clave: 'Rocket', Icono: Rocket },
  { clave: 'Target', Icono: Target },
  { clave: 'Flag', Icono: Flag },
  { clave: 'Folder', Icono: Folder },
  { clave: 'FolderOpen', Icono: FolderOpen },
  { clave: 'Heart', Icono: Heart },
  { clave: 'Zap', Icono: Zap },
  { clave: 'Tag', Icono: Tag },
  { clave: 'Layers', Icono: Layers },
  { clave: 'Home', Icono: Home },
  { clave: 'Globe', Icono: Globe },
  { clave: 'MapPin', Icono: MapPin },
  { clave: 'ShoppingBag', Icono: ShoppingBag },
  { clave: 'Handshake', Icono: Handshake },
  { clave: 'Sparkles', Icono: Sparkles },
  { clave: 'Compass', Icono: Compass },
  { clave: 'Package', Icono: Package },
  { clave: 'Lightbulb', Icono: Lightbulb },
  { clave: 'TrendingUp', Icono: TrendingUp },
  { clave: 'Award', Icono: Award },
  { clave: 'Megaphone', Icono: Megaphone },
  { clave: 'GraduationCap', Icono: GraduationCap },
  { clave: 'PiggyBank', Icono: PiggyBank },
];

/** El de siempre — lo que se ve cuando `icono` es `null`/`undefined`, o una clave que ya no existe. */
export const ICONO_POR_DEFECTO: LucideIcon = Users;

const MAPA = new Map(ICONOS_DE_ESPACIO.map((i) => [i.clave, i.Icono]));

/** El componente que corresponde a la clave guardada — el de siempre si no hay clave o no se reconoce. */
export function iconoDeEspacio(clave: string | null | undefined): LucideIcon {
  return (clave && MAPA.get(clave)) || ICONO_POR_DEFECTO;
}
