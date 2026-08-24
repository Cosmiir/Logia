import React from 'react';
import i18next from 'i18next';
import { formatDateFr, formatProgression } from '@/lib/utils';
import { MEDIA_STATUS_LABELS } from '@/lib/status-labels';
import type { Collection, Media } from '@/types';

/**
 * Minimal subset of Media that MediaMetaBar actually reads.
 * Allows callers (e.g. MediaCreateHero preview) to pass a partial object
 * without fabricating the full Media interface.
 */
export interface MediaMetaBarMedia {
  creator?: string | null;
  release_date?: string | null;
  progress_total?: number | null;
  media_status?: string | null;
}

interface MediaMetaBarProps {
  media: Media | MediaMetaBarMedia;
  collection?: Collection | null;
  className?: string;
}

const MediaMetaBar: React.FC<MediaMetaBarProps> = ({ media, collection, className = '' }) => {
  const directorLabel = collection?.creator_label || i18next.t('mediaDetail.director');
  const directors = media.creator
    ? media.creator.split(';').map(c => c.trim()).filter(Boolean)
    : [];
  const releaseDate = media.release_date ? formatDateFr(media.release_date) : null;
  const duration =
    media.progress_total != null && media.progress_total > 0
      ? formatProgression(media.progress_total, collection?.progression_label, collection?.plural_with_s ?? false)
      : null;
  const mediaStatus =
    media.media_status
      ? MEDIA_STATUS_LABELS[media.media_status as keyof typeof MEDIA_STATUS_LABELS]
      : null;

  const items: { label: string; value: string; title?: string }[] = [];
  if (directors.length > 0) {
    items.push({
      label: directorLabel,
      value: directors.slice(0, 2).join(', ') + (directors.length > 2 ? ` +${directors.length - 2}` : ''),
      title: directors.join(', '),
    });
  }
  if (releaseDate) {
    items.push({ label: i18next.t('mediaDetail.release'), value: releaseDate });
  }
  if (duration) {
    items.push({ label: i18next.t('mediaDetail.duration'), value: duration });
  }
  if (mediaStatus) {
    items.push({ label: i18next.t('common.mediaStatus'), value: mediaStatus });
  }

  if (items.length === 0) return null;

  const shadow = '0 1px 2px rgba(0,0,0,0.95), 0 3px 8px rgba(0,0,0,0.6)';

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 max-w-2xl ${className}`}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <span className="text-white/30 select-none" style={{ textShadow: shadow }}>
              ·
            </span>
          )}
          <span className="whitespace-nowrap">
            <span
              className="text-[10.5px] font-semibold uppercase tracking-wider text-white/55"
              style={{ textShadow: shadow }}
            >
              {item.label}{' '}
            </span>
            <span
              className="text-[13px] font-bold text-white"
              style={{ textShadow: shadow }}
              title={item.title}
            >
              {item.value}
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default MediaMetaBar;