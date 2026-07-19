/**
 * Centralized label mappings for status enums
 * Colors use fixed values (not translated).
 * Labels are resolved via i18next for proper language switching.
 */

import i18next from 'i18next';
import type { ProgressStatus, MediaStatus } from '@/types';

// ProgressStatus labels — resolved at call time via i18next
export const getProgressStatusLabel = (status: ProgressStatus): string =>
  i18next.t(`status.progressStatus.${status}`);

export const getMediaStatusLabel = (status: MediaStatus): string =>
  i18next.t(`status.mediaStatus.${status}`);

// Legacy record-style accessors — kept for compatibility, but prefer the
// getter functions above in components that need live language switching.
export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  get NOT_STARTED() { return i18next.t('status.progressStatus.NOT_STARTED'); },
  get IN_PROGRESS()  { return i18next.t('status.progressStatus.IN_PROGRESS');  },
  get ON_HOLD()      { return i18next.t('status.progressStatus.ON_HOLD');      },
  get COMPLETED()    { return i18next.t('status.progressStatus.COMPLETED');    },
  get ABANDONED()    { return i18next.t('status.progressStatus.ABANDONED');    },
};

export const MEDIA_STATUS_LABELS: Record<MediaStatus, string> = {
  get UPCOMING()  { return i18next.t('status.mediaStatus.UPCOMING');  },
  get ONGOING()   { return i18next.t('status.mediaStatus.ONGOING');   },
  get COMPLETED() { return i18next.t('status.mediaStatus.COMPLETED'); },
  get ABANDONED() { return i18next.t('status.mediaStatus.ABANDONED'); },
};

// ProgressStatus colors (not translated)
export const PROGRESS_STATUS_COLORS: Record<ProgressStatus, string> = {
  NOT_STARTED: '#818cf8',
  IN_PROGRESS: '#0ea5e9',
  ON_HOLD:     '#f59e0b',
  COMPLETED:   '#10b981',
  ABANDONED:   '#f43f5e',
};

// MediaStatus colors (not translated)
export const MEDIA_STATUS_COLORS: Record<MediaStatus, string> = {
  UPCOMING:  '#818cf8',
  ONGOING:   '#0ea5e9',
  COMPLETED: '#10b981',
  ABANDONED: '#f43f5e',
};