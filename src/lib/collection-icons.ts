import {
  Film,
  Clapperboard,
  Tv,
  Swords,
  BookOpen,
  Smartphone,
  BookMarked,
  Gamepad2,
  Music,
  Mic2,
  Theater,
  Podcast,
  Radio,
  Headphones,
  Palette,
  Pen,
  Camera,
  Video,
  MonitorPlay,
  Newspaper,
  GraduationCap,
  Dices,
  Puzzle,
  Globe,
  Joystick,
  Popcorn,
  Drama,
  Brush,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';

export interface CollectionIconEntry {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Curated list of Lucide icons available for collection types.
 * The `id` is stored in DB as collection.icon.
 */
export const COLLECTION_ICONS: CollectionIconEntry[] = [
  { id: 'clapperboard', label: 'Film', icon: Clapperboard },
  { id: 'tv', label: 'Série', icon: Tv },
  { id: 'swords', label: 'Anime', icon: Swords },
  { id: 'book-open', label: 'Manga', icon: BookOpen },
  { id: 'smartphone', label: 'Manhwa', icon: Smartphone },
  { id: 'book-marked', label: 'Livre', icon: BookMarked },
  { id: 'gamepad-2', label: 'Jeu vidéo', icon: Gamepad2 },
  { id: 'music', label: 'Musique', icon: Music },
  { id: 'mic-2', label: 'Concert', icon: Mic2 },
  { id: 'theater', label: 'Théâtre', icon: Theater },
  { id: 'podcast', label: 'Podcast', icon: Podcast },
  { id: 'radio', label: 'Radio', icon: Radio },
  { id: 'headphones', label: 'Audio', icon: Headphones },
  { id: 'palette', label: 'Art', icon: Palette },
  { id: 'pen', label: 'Écriture', icon: Pen },
  { id: 'camera', label: 'Photo', icon: Camera },
  { id: 'video', label: 'Vidéo', icon: Video },
  { id: 'monitor-play', label: 'Streaming', icon: MonitorPlay },
  { id: 'newspaper', label: 'Presse', icon: Newspaper },
  { id: 'graduation-cap', label: 'Formation', icon: GraduationCap },
  { id: 'dices', label: 'Jeu de société', icon: Dices },
  { id: 'puzzle', label: 'Puzzle', icon: Puzzle },
  { id: 'globe', label: 'Web', icon: Globe },
  { id: 'joystick', label: 'Arcade', icon: Joystick },
  { id: 'popcorn', label: 'Cinéma', icon: Popcorn },
  { id: 'drama', label: 'Spectacle', icon: Drama },
  { id: 'brush', label: 'Dessin', icon: Brush },
  { id: 'megaphone', label: 'Conférence', icon: Megaphone },
  { id: 'film', label: 'Pellicule', icon: Film },
];

/**
 * Look up a LucideIcon component by its string id (stored in DB).
 * Falls back to Film if not found.
 */
export function getIconById(iconId: string | null | undefined): LucideIcon {
  if (!iconId) return Film;
  const entry = COLLECTION_ICONS.find((e) => e.id === iconId);
  return entry?.icon ?? Film;
}

/**
 * Preset color palette for collections.
 */
export const COLLECTION_COLORS: string[] = [
  '#60a5fa', // blue
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#f87171', // red
  '#c084fc', // purple
  '#fbbf24', // amber
  '#fb923c', // orange
  '#34d399', // emerald
  '#a78bfa', // violet
  '#f97316', // orange-500
  '#14b8a6', // teal
  '#e879f9', // fuchsia
  '#38bdf8', // sky
  '#facc15', // yellow
  '#4ade80', // green
  '#f43f5e', // rose
];

