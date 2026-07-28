import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

const TutorialBadge: React.FC = () => {
  const { t } = useTranslation();
  const startTutorial = useTutorialStore((s) => s.startTutorial);
  const isActive = useTutorialStore((s) => s.isActive);
  const hasSeenInvitation = useProfileSettingsStore((s) => s.tutorialHasSeenInvitation);
  const hasCompleted = useProfileSettingsStore((s) => s.tutorialHasCompleted);
  const setTutorialHasSeenInvitation = useProfileSettingsStore((s) => s.setTutorialHasSeenInvitation);

  const shouldShow = !hasSeenInvitation && !hasCompleted && !isActive;

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.4 }}
        className="relative group overflow-hidden flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-primary/30 shadow-xl shadow-primary/10 hover:border-primary/60 transition-all duration-300"
      >
        <div className="absolute inset-0 tutorial-shimmer-bg opacity-20 pointer-events-none" />

        {/* Glowing sparkles icon container */}
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0 border border-primary/40 group-hover:scale-105 transition-transform">
          <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
        </div>

        <button
          onClick={startTutorial}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white transition-colors cursor-pointer whitespace-nowrap group/btn"
        >
          <span>{t('tutorial.badge')}</span>
          <ArrowRight className="w-3 h-3 text-primary group-hover/btn:translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={() => setTutorialHasSeenInvitation(true)}
          className="w-5 h-5 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
          title={t('tutorial.skip')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default TutorialBadge;
