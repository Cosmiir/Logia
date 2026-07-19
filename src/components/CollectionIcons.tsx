import { Film, Clapperboard, Tv, Swords, BookOpen, Smartphone, BookMarked, Gamepad2 } from 'lucide-react';
import { normalizeCollectionName } from '@/lib/utils';
import { getIconById } from '@/lib/collection-icons';
import type { LucideIcon } from 'lucide-react';

// Legacy fallback: map normalized collection name to a default icon
const LEGACY_ICON_MAP: Record<string, LucideIcon> = {
  'FILM': Clapperboard,
  'SERIE': Tv,
  'ANIME': Swords,
  'MANGA': BookOpen,
  'MANHWA': Smartphone,
  'LIVRE': BookMarked,
  'JEU VIDEO': Gamepad2,
};

/**
 * Get icon component for a collection.
 * - If iconId is provided (from collection.icon DB field), use the registry.
 * - Otherwise fall back to legacy name-based mapping.
 */
export const getCollectionIconComponent = (name: string, iconId?: string | null): LucideIcon => {
  if (iconId) return getIconById(iconId);
  return LEGACY_ICON_MAP[normalizeCollectionName(name)] ?? Film;
};
