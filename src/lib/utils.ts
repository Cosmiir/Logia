import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Media, ProgressStatus } from "@/types";
import i18next from "i18next";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Determine media status based on progress_status or calculate from progress_current and progress_total
 */
export function getProgressStatus(media: Media): ProgressStatus {
  // Use progress_status if available
  if (media.progress_status) return media.progress_status;
  
  // Fallback: calculate from progress_current and progress_total
  const current = media.progress_current ?? 0;
  const total = media.progress_total ?? 0;
  
  if (total === 0 || current === 0) return 'NOT_STARTED';
  if (current >= total) return 'COMPLETED';
  return 'IN_PROGRESS';
}

/**
 * Format date according to current locale
 */
export function formatDateFr(dateString: string | null): string {
  if (!dateString) return '-';
  const locale = i18next.language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatDate(dateString: string): string {
  const locale = i18next.language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(dateString).toLocaleDateString(locale, { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}

/**
 * Format rating to French format (15,5/20)
 */
export function formatRating(rating: number | null): string {
  if (rating === null) return '-';
  return `${Math.round(rating)}/100`;
}

/**
 * Convert minutes to hours and minutes
 */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}${i18next.t('common.durationUnit.minute')}`;
  if (mins === 0) return `${hours}${i18next.t('common.durationUnit.hour')}`;
  return i18next.t('common.durationUnit.hourMinute', { hours, minutes: mins });
}

/**
 * Format file size with locale-aware units
 */
export function formatFileSize(bytes: number): string {
  if (!bytes) return `0 ${i18next.t('common.byteUnit.kilobyte')}`;
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${i18next.t(`common.byteUnit.${units[index]}`)}`;
}

/**
 * Get status color class
 */
export function getStatusColor(status: ProgressStatus): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-status-en-cours';
    case 'COMPLETED':
      return 'bg-status-termine';
    case 'NOT_STARTED':
      return 'bg-status-a-commencer';
    case 'ABANDONED':
      return 'bg-status-abandonne';
    case 'ON_HOLD':
      return 'bg-yellow-500';
    default:
      return 'bg-status-a-commencer';
  }
}

/**
 * Normalize a collection name for display:
 * - Uppercase
 * - Remove accents (É→E, etc.)
 * - Singular form (Films→FILM, Séries→SERIE, etc.)
 * - Normalize "Jeu-vidéo" / "Jeu vidéo" → "JEU VIDEO"
 */
export function normalizeCollectionName(name: string): string {
  let normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  // Singular mappings
  const pluralToSingular: Record<string, string> = {
    'FILMS': 'FILM',
    'SERIES': 'SERIE',
    'ANIMES': 'ANIME',
    'MANGAS': 'MANGA',
    'MANHWAS': 'MANHWA',
    'LIVRES': 'LIVRE',
    'JEUX-VIDEO': 'JEU VIDEO',
    'JEUX VIDEO': 'JEU VIDEO',
    'JEU-VIDEO': 'JEU VIDEO',
  };

  return pluralToSingular[normalized] ?? normalized;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format progression quantity with units (with custom singular/plural rules).
 * - Singular if quantity < 2.
 * - If there is a decimal part, formats as "[integer] [unit] [decimal]".
 */
export function formatProgression(
  value: number | null | undefined,
  unit: string | undefined | null,
  pluralWithS: boolean
): string {
  if (value == null) return '';
  const baseUnit = unit || '';
  
  // Rule: singular if value < 2, plural otherwise (if pluralWithS is true)
  const displayUnit = baseUnit
    ? (pluralWithS && value >= 2 ? baseUnit + 's' : baseUnit)
    : '';

  // Check if there is a decimal part
  const strValue = value.toString();
  const parts = strValue.split('.');
  if (parts.length === 2 && parts[1].length > 0) {
    const integerPart = parts[0];
    const decimalPart = parts[1];
    return displayUnit 
      ? `${integerPart} ${displayUnit} ${decimalPart}`
      : strValue;
  }

  return displayUnit ? `${value} ${displayUnit}` : strValue;
}

