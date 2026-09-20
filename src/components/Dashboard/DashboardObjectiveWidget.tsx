import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar, CheckCircle2 } from 'lucide-react';
import { formatDateFr } from '@/lib/utils';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { getCollectionColor } from '@/components/MediaCard';
import type { Objective, Collection } from '@/types';

interface DashboardObjectiveWidgetProps {
  objectives: Objective[];
  collectionMap: Record<number, Collection>;
  onAddObjective: () => void;
  onEditObjective: (objectiveId: number) => void;
}

export const DashboardObjectiveWidget: React.FC<DashboardObjectiveWidgetProps> = ({
  objectives,
  collectionMap,
  onAddObjective,
  onEditObjective,
}) => {
  const { t } = useTranslation();

  const activeObjectives = objectives.filter((o) => o.is_active);
  const displayObjectives = activeObjectives.length > 0 ? activeObjectives.slice(0, 2) : objectives.slice(0, 2);

  if (displayObjectives.length === 0) {
    return (
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xl flex flex-col justify-between h-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
            {t('dashboard.currentObjective')}
          </h3>
          <button
            type="button"
            onClick={onAddObjective}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title={t('dashboard.addObjective')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{t('dashboard.noObjective')}</p>
            <p className="text-xs text-white/40 mt-0.5 max-w-[220px]">
              {t('dashboard.createFirstObjective')}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddObjective}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('dashboard.addObjective')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xl flex flex-col justify-between h-full space-y-3">
      {/* Header with + button (Clean typography, no purple target icon) */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
          {t('dashboard.currentObjective')}
        </h3>
        <button
          type="button"
          onClick={onAddObjective}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          title={t('dashboard.addObjective')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Objectives list */}
      <div className="space-y-2.5 flex-1 flex flex-col justify-around">
        {displayObjectives.map((obj) => {
          const collection = obj.collection_id ? collectionMap[obj.collection_id] : null;
          const current = obj.current_count ?? 0;
          const target = obj.target_count ?? 1;
          const pct = Math.min(100, Math.round((current / target) * 100));
          const isCompleted = current >= target;
          const objectiveTitle = collection?.name || `Collection #${obj.collection_id}`;
          const CollIcon = collection ? getCollectionIconComponent(collection.name, collection.icon) : null;
          const collColor = collection?.color || (collection ? getCollectionColor(collection.name) : 'var(--theme-accent, #6366f1)');

          return (
            <div
              key={obj.id}
              onClick={() => onEditObjective(obj.id)}
              className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/15 transition-all cursor-pointer space-y-2 group"
              title={t('common.edit')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {CollIcon && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${collColor}18`,
                        border: `1px solid ${collColor}30`,
                      }}
                    >
                      <CollIcon className="w-3.5 h-3.5" style={{ color: collColor }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                      {objectiveTitle}
                    </div>
                    {obj.end_date && (
                      <div className="flex items-center gap-1 text-[10px] text-white/40">
                        <Calendar className="w-2.5 h-2.5" />
                        <span>Jusqu'au {formatDateFr(obj.end_date)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isCompleted ? (
                  <span className="shrink-0 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                ) : (
                  <span
                    className="text-xs font-extrabold shrink-0"
                    style={{ color: collColor }}
                  >
                    {pct}%
                  </span>
                )}
              </div>

              {/* Progress bar + counts */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white">
                    {current} <span className="text-white/40 font-normal">/ {target}</span>
                  </span>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isCompleted ? '#10b981' : collColor,
                      boxShadow: isCompleted
                        ? '0 0 10px rgba(16, 185, 129, 0.4)'
                        : `0 0 10px ${collColor}40`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* If only 1 objective, show a mini dashed action to add another */}
        {displayObjectives.length === 1 && (
          <button
            type="button"
            onClick={onAddObjective}
            className="w-full p-3 rounded-xl border border-dashed border-white/10 hover:border-white/20 text-white/40 hover:text-white transition-all text-center flex items-center justify-center gap-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">{t('dashboard.addObjective')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardObjectiveWidget;
