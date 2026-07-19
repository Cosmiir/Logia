import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Calendar, MoreVertical } from 'lucide-react';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import type { Objective, Collection } from '@/types';

interface ObjectiveCardProps {
  objective: Objective;
  collection?: Collection;
  onEdit?: () => void;
  onDelete?: () => void;
}

const ObjectiveCard: React.FC<ObjectiveCardProps> = ({
  objective,
  collection,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { target_count, current_count, start_date, end_date } = objective;
  const monthlyCapacity = collection?.monthly_capacity ?? null;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const formatDateCompact = (dateStr: string): string => {
    const d = new Date(dateStr);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthKey = months[d.getMonth()];
    const monthName = t(`objectiveCard.months.${monthKey}`);
    return `${d.getDate()} ${monthName} ${d.getFullYear()}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const analysis = useMemo(() => {
    const now = new Date();
    const start = new Date(start_date);
    const end = new Date(end_date);
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const remaining = end.getTime() - now.getTime();

    const progressPercent = Math.min(100, Math.round((current_count / target_count) * 100));

    const remainingDays = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
    const totalDays = Math.max(1, Math.ceil(totalDuration / (1000 * 60 * 60 * 24)));
    const isExpired = now > end;
    const isCompleted = current_count >= target_count;
    const notStartedYet = now < start;

    let paceStatus: 'ahead' | 'on_track' | 'behind' | 'completed' | 'expired' | 'not_started' = 'on_track';

    if (isCompleted) {
      paceStatus = 'completed';
    } else if (isExpired) {
      paceStatus = 'expired';
    } else if (notStartedYet) {
      paceStatus = 'not_started';
    } else {
      if (monthlyCapacity && monthlyCapacity > 0) {
        const totalMonths = totalDays / 30;
        const canFinish = monthlyCapacity * totalMonths;
        const monthsRemaining = remainingDays / 30;
        const canFinishRemaining = monthlyCapacity * monthsRemaining;

        if (canFinish < target_count || canFinishRemaining < (target_count - current_count)) {
          paceStatus = 'behind';
        } else {
          const expectedByNow = (elapsed / totalDuration) * target_count;
          const diff = current_count - expectedByNow;
          paceStatus = diff >= 0 ? 'ahead' : 'on_track';
        }
      } else {
        const expectedProgress = totalDuration > 0 ? (elapsed / totalDuration) * target_count : 0;
        const diff = current_count - expectedProgress;

        if (diff >= 0.5) {
          paceStatus = 'ahead';
        } else if (diff >= -0.5) {
          paceStatus = 'on_track';
        } else {
          paceStatus = 'behind';
        }
      }
    }

    return {
      progressPercent,
      remainingDays,
      isExpired,
      isCompleted,
      notStartedYet,
      paceStatus,
    };
  }, [current_count, target_count, start_date, end_date, monthlyCapacity]);

  const collColor = collection?.color || '#8B5CF6';
  const collName = collection?.name || 'Collection';
  const verb = collection?.consumption_verb || 'Consommer';
  const Icon = getCollectionIconComponent(collName, collection?.icon ?? null);

  const statusConfig = {
    ahead: { color: '#22c55e', label: t('objectiveCard.status.ahead') },
    on_track: { color: '#3b82f6', label: t('objectiveCard.status.onTrack') },
    behind: { color: '#f59e0b', label: t('objectiveCard.status.behind') },
    completed: { color: '#22c55e', label: t('objectiveCard.status.completed') },
    expired: { color: '#ef4444', label: t('objectiveCard.status.expired') },
    not_started: { color: '#6b7280', label: t('objectiveCard.status.notStarted') },
  }[analysis.paceStatus];

  const statusColor = statusConfig.color;
  const statusLabel = statusConfig.label;

  const PaceIcon = {
    ahead: TrendingUp,
    on_track: Clock,
    behind: TrendingDown,
    completed: CheckCircle2,
    expired: AlertTriangle,
    not_started: Clock,
  }[analysis.paceStatus];

  const remainingDaysText = analysis.isCompleted 
    ? t('objectiveCard.timeRemaining.completed')
    : analysis.isExpired
    ? t('objectiveCard.timeRemaining.expired')
    : analysis.notStartedYet
    ? t('objectiveCard.timeRemaining.days', { count: analysis.remainingDays })
    : t('objectiveCard.timeRemaining.daysRemaining', { count: analysis.remainingDays });

  return (
    <div className="group relative flex flex-col gap-2.5">

      {/* Row 1: icon + title + menu 3 points */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-[22px] h-[22px] rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${collColor}20` }}
          >
            <Icon className="w-3 h-3" style={{ color: collColor }} />
          </div>
          <span className="text-[13px] font-medium text-white/80 leading-snug">
            {verb} {target_count} {collName.toLowerCase()}
          </span>
        </div>
        
        {/* Menu 3 points */}
        {(onEdit || onDelete) && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute top-full right-0 mt-1 py-1 bg-[#1a1a2e]/95 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl z-10 min-w-[120px]">
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit();
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-white/80 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t('objectiveCard.actions.edit')}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('objectiveCard.actions.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: count + percent badge (couleur du statut) */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-[22px] font-bold text-white leading-none">{current_count}</span>
          <span className="text-[13px] text-white/30 font-medium">/{target_count}</span>
        </div>
        {/* Percent badge — même couleur que le badge de statut */}
        <span
          className="text-[12px] font-bold px-2 py-0.5 rounded-md"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}15`,
            border: `1px solid ${statusColor}25`,
          }}
        >
          {analysis.progressPercent}%
        </span>
      </div>

      {/* Row 3: progress bar (couleur du statut) */}
      <div className="w-full bg-white/5 rounded-full h-[5px] overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${analysis.progressPercent}%`,
            minWidth: analysis.progressPercent > 0 ? 4 : 0,
            background: `linear-gradient(to right, ${statusColor}, ${statusColor}cc)`,
          }}
        />
      </div>

      {/* Row 4: Calendar + badge statut + jours restants */}
      <div className="flex items-center justify-between gap-3">
        {/* Gauche: Grand icône calendrier + dates empilées */}
        <div className="flex items-center gap-2">
          <div 
            className="flex items-center justify-center rounded-lg flex-shrink-0 bg-white/5"
            style={{ 
              width: '36px', 
              height: '36px',
            }}
          >
            <Calendar className="w-5 h-5 text-white/40" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-white/40 leading-tight">
              {formatDateCompact(start_date)}
            </span>
            <span className="text-[11px] text-white/40 leading-tight">
              {formatDateCompact(end_date)}
            </span>
          </div>
        </div>
        
        {/* Droite: Badge combiné statut + jours restants */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}15`,
            border: `1px solid ${statusColor}25`,
          }}
        >
          <PaceIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
          <div className="flex flex-col">
            <span className="text-[11px] font-medium leading-tight">{statusLabel}</span>
            <span className="text-[11px] font-medium leading-tight">{remainingDaysText}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ObjectiveCard;
