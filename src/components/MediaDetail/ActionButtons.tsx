import React from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { BookOpen, Globe } from 'lucide-react';

interface ActionButtonsProps {
  canRead: boolean;
  onRead: () => void;
  externalUrl?: string | null;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ canRead, onRead, externalUrl }) => {
  const { t } = useTranslation();

  const handleOpenWeb = () => {
    if (!externalUrl) return;
    openUrl(externalUrl).catch(() => {});
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {canRead && (
        <button
          type="button"
          onClick={onRead}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold text-white/90 bg-[#15172b]/85 hover:bg-[#1e2035]/90 border border-white/[0.09] hover:border-white/20 shadow-xl shadow-black/30 hover:shadow-black/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          {t('mediaDetail.read')}
        </button>
      )}

      {externalUrl && (
        <button
          type="button"
          onClick={handleOpenWeb}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold text-white/90 bg-[#15172b]/85 hover:bg-[#1e2035]/90 border border-white/[0.09] hover:border-white/20 shadow-xl shadow-black/30 hover:shadow-black/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Globe className="w-4 h-4" />
          {t('mediaDetail.open')}
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
