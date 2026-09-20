import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight } from 'lucide-react';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { getCollectionColor } from '@/components/MediaCard';
import type { Collection } from '@/types';

interface DashboardCollectionsProps {
  collections: Collection[];
  mediaCounts?: Record<number, number>;
  isLoading?: boolean;
  onCollectionClick: (collectionId: number) => void;
  onManageCollections: () => void;
}

export const DashboardCollections: React.FC<DashboardCollectionsProps> = ({
  collections,
  mediaCounts = {},
  isLoading = false,
  onCollectionClick,
  onManageCollections,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl h-full space-y-3">
        <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl glass-card animate-pulse bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl h-full flex flex-col space-y-3">
      {/* Section Header with Clean Typography */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
          {t('dashboard.collections')}
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onManageCollections}
            className="text-xs font-semibold text-white/50 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            {t('dashboard.viewAllCollections')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid of Collection Cards */}
      {collections.length === 0 ? (
        <button
          type="button"
          onClick={onManageCollections}
          className="w-full py-6 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 hover:border-white/30 text-white/40 hover:text-white transition-all cursor-pointer bg-white/[0.02]"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-semibold">{t('dashboard.createCollection')}</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {collections.map((collection) => {
            const Icon = getCollectionIconComponent(collection.name, collection.icon);
            const collColor = collection.color || getCollectionColor(collection.name);
            const count = mediaCounts[collection.id] ?? 0;

            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onCollectionClick(collection.id)}
                className="group relative flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer text-center overflow-hidden"
              >
                {/* Subtle Ambient Hover Glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
                  style={{ background: collColor }}
                />

                {/* Collection Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-transform duration-200 group-hover:scale-110"
                  style={{
                    backgroundColor: `${collColor}18`,
                    border: `1px solid ${collColor}30`,
                  }}
                >
                  <Icon className="w-4 h-4 transition-colors" style={{ color: collColor }} />
                </div>

                {/* Collection Name */}
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight group-hover:text-primary transition-colors truncate w-full">
                  {collection.name}
                </span>

                {/* Media Count (Clean single count) */}
                <span className="text-[10px] sm:text-[11px] font-medium text-white/40 mt-0.5">
                  {count} {t(count > 1 ? 'dashboard.mediaCount_other' : 'dashboard.mediaCount')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardCollections;
