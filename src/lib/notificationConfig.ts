import { Clock, Hourglass, CheckCircle2, AlertTriangle, CircleOff, Trophy, CalendarDays } from 'lucide-react';
import type { NotificationType } from '@/types';
import type { ElementType } from 'react';
import i18next from 'i18next';

export interface NotificationStyle {
  icon: ElementType;
  color: string;        // text-xxx class
  bgColor: string;      // bg-xxx class for icon container
  accentHex: string;     // hex color for gradients/accents
  labelKey: string;      // i18n key for human-readable label
}

export const notificationStyles: Record<NotificationType, NotificationStyle> = {
  stagnant_media: {
    icon: Clock,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    accentHex: '#f59e0b',
    labelKey: 'notifications.stagnantMedia',
  },
  waiting_media: {
    icon: Hourglass,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    accentHex: '#f97316',
    labelKey: 'notifications.waitingMedia',
  },
  near_completion: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    accentHex: '#10b981',
    labelKey: 'notifications.nearCompletion',
  },
  objective_deadline: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    accentHex: '#ef4444',
    labelKey: 'notifications.objectiveDeadline',
  },
  objective_stalled: {
    icon: CircleOff,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    accentHex: '#fb7185',
    labelKey: 'notifications.objectiveStalled',
  },
  objective_achieved: {
    icon: Trophy,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    accentHex: '#eab308',
    labelKey: 'notifications.objectiveAchieved',
  },
  monthly_report: {
    icon: CalendarDays,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    accentHex: '#3b82f6',
    labelKey: 'notifications.monthlyReport',
  },
};

// Keep backward-compat exports for any existing consumers
export const notificationIcons: Record<NotificationType, ElementType> = Object.fromEntries(
  Object.entries(notificationStyles).map(([k, v]) => [k, v.icon])
) as Record<NotificationType, ElementType>;

export const notificationColors: Record<NotificationType, string> = Object.fromEntries(
  Object.entries(notificationStyles).map(([k, v]) => [k, v.color])
) as Record<NotificationType, string>;

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const locale = i18next.language === 'fr' ? 'fr-FR' : 'en-US';

  if (diffMins < 1) return i18next.t('notifications.relativeTime.justNow');
  if (diffMins < 60) return i18next.t('notifications.relativeTime.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18next.t('notifications.relativeTime.hoursAgo', { count: diffHours });
  if (diffDays < 7) return i18next.t('notifications.relativeTime.daysAgo', { count: diffDays });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const locale = i18next.language === 'fr' ? 'fr-FR' : 'en-US';

  if (diffMins < 1) return i18next.t('notifications.relativeTime.justNow');
  if (diffMins < 60) return i18next.t('notifications.relativeTime.minutesAgoFull', { count: diffMins });
  if (diffHours < 24) return i18next.t('notifications.relativeTime.hoursAgoFull', { count: diffHours });
  if (diffDays === 1) return i18next.t('notifications.relativeTime.yesterday');
  if (diffDays < 7) return i18next.t('notifications.relativeTime.daysAgoFull', { count: diffDays });
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return i18next.t('notifications.relativeTime.weeksAgo', { count: weeks });
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
