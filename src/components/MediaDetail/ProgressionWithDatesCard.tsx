import React from 'react';
import i18next from 'i18next';
import { Calendar } from 'lucide-react';
import * as Flags from 'country-flag-icons/react/3x2';
import { formatDateFr } from '@/lib/utils';
import { PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';
import type { ExperienceEntry } from '@/types';

const getProgressStatusInfo = (status: string): { label: string; color: string } => ({
  label: PROGRESS_STATUS_LABELS[status as keyof typeof PROGRESS_STATUS_LABELS] ?? status,
  color: PROGRESS_STATUS_COLORS[status as keyof typeof PROGRESS_STATUS_COLORS] ?? '#ffffff',
});

const langFlagCode = (code: string): string | null => {
  const map: Record<string, string> = {
    fr: 'FR', en: 'GB', 'en-US': 'US', ja: 'JP', ko: 'KR',
    es: 'ES', de: 'DE', it: 'IT', pt: 'PT', 'pt-BR': 'BR',
    zh: 'CN', 'zh-TW': 'TW', ru: 'RU', ar: 'SA', hi: 'IN',
    tr: 'TR', nl: 'NL', pl: 'PL', sv: 'SE', no: 'NO',
    da: 'DK', fi: 'FI', cs: 'CZ', th: 'TH', vi: 'VN',
    id: 'ID', el: 'GR', he: 'IL', hu: 'HU', ro: 'RO',
    uk: 'UA', ca: 'ES',
  };
  return map[code] || null;
};

interface ProgressionWithDatesCardProps {
  current: number;
  total: number;
  progressStatus?: string | null;
  progressionLabel?: string | null;
  pluralWithS?: boolean | null;
  experienceDate?: string | null;
  experienceEntries?: ExperienceEntry[];
  dateLabel?: string | null;
  replayDateLabel?: string | null;
}

const ProgressionWithDatesCard: React.FC<ProgressionWithDatesCardProps> = ({
  current,
  total,
  progressStatus,
  progressionLabel,
  pluralWithS,
  experienceDate,
  experienceEntries,
  dateLabel,
  replayDateLabel,
}) => {
  const rawPct = total > 0 ? Math.round((current / total) * 100) : 0;
  const displayPct = progressStatus === 'COMPLETED' ? Math.max(100, rawPct) : rawPct;
  const statusInfo = progressStatus ? getProgressStatusInfo(progressStatus) : null;

  const circleColor = progressStatus === 'ABANDONED'
    ? '#ef4444'
    : displayPct > 100
      ? '#a855f7'
      : displayPct >= 100
        ? '#22c55e'
        : displayPct >= 50
          ? '#3b82f6'
          : '#f97316';

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (Math.min(displayPct, 100) / 100) * circumference;

  const unitFor = (n: number) =>
    progressionLabel
      ? pluralWithS && n >= 2 ? progressionLabel + 's' : progressionLabel
      : '';

  const entries = experienceEntries || [];
  const hasDates = !!experienceDate || entries.length > 0;

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
      <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1">{i18next.t('common.progression')}</p>

      {hasDates && (
        <>
          <div className="flex flex-wrap gap-2">
            {entries.map((entry, idx) => {
              const isFirst = idx === 0;
              const dateStr = entry.date;
              const label = isFirst
                ? (dateLabel || i18next.t('media.experienceDate'))
                : (replayDateLabel || i18next.t('mediaDetail.newExperience')) + (entries.length > 2 ? ` ${idx}` : '');
              const fc = entry.language ? langFlagCode(entry.language) : null;
              const FlagComp = fc ? (Flags as Record<string, React.FC<{ title?: string; className?: string }>>)[fc] : null;
              const hasMeta = entry.version || entry.language;

              return (
                <div key={idx} className="px-3 py-2 rounded-xl border min-w-[130px] transition-colors bg-white/[0.03] border-white/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider leading-none mb-1.5 text-white/25">
                    {label}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 shrink-0 text-white/20" />
                    {dateStr ? (
                      <span className="text-xs font-medium text-white/75">{formatDateFr(dateStr)}</span>
                    ) : (
                      <span className="text-xs text-white/20 italic">—</span>
                    )}
                  </div>
                  {hasMeta && (
                    <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/[0.05]">
                      {entry.version && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/60 border border-white/10 font-medium leading-none">
                          {entry.version}
                        </span>
                      )}
                      {entry.language && (
                        <span className="flex items-center gap-1 ml-auto">
                          {FlagComp && (
                            <span className="inline-flex shrink-0 rounded-sm overflow-hidden" style={{ width: 15, height: 10 }} title={entry.language ?? undefined}>
                              <FlagComp className="w-full h-full" />
                            </span>
                          )}
                          <span className="text-[9px] font-semibold text-white/40 uppercase leading-none">{entry.language}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="w-full h-px bg-white/[0.06]" />
        </>
      )}

      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} className="-rotate-90 overflow-visible">
            <circle cx={40} cy={40} r={36} stroke="rgba(255,255,255,0.08)" strokeWidth={6} fill="none" />
            <circle
              cx={40} cy={40} r={36}
              stroke={circleColor} strokeWidth={6} fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${circleColor}66)`, transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: circleColor }}>
              {displayPct}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums leading-none text-white">{current}</span>
              <span className="text-sm text-white/25">
                {unitFor(current) && <span className="mr-0.5">{unitFor(current)}</span>}
                <span>/ {total}{unitFor(total) ? ` ${unitFor(total)}` : ''}</span>
              </span>
            </div>
            {statusInfo && (
              <span
                className="shrink-0 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, border: `1px solid ${statusInfo.color}30` }}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressionWithDatesCard;
