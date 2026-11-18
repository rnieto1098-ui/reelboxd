import {
  Bookmark,
  Compass,
  House,
  List,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Tv,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

// Navigation items are built in a server component and handed to client
// ones, and a component can't cross that boundary as a prop, so items carry
// an icon *name* and this maps it back to the drawing.
const ICONS = {
  home: House,
  sparkles: Sparkles,
  list: List,
  bookmark: Bookmark,
  trophy: Trophy,
  tv: Tv,
  users: Users,
  user: User,
  settings: Settings,
  shield: ShieldCheck,
  search: Search,
  compass: Compass,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof ICONS;

export function NavIcon({ name, className = "h-5 w-5" }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className={className} strokeWidth={1.9} />;
}
