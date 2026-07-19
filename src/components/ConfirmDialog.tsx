import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, type LucideIcon } from 'lucide-react';

export interface ConfirmDialogAction {
  label: string;
  onClick: () => void;
  variant?: 'danger' | 'primary' | 'secondary';
  icon?: LucideIcon;
  disabled?: boolean;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  actions: ConfirmDialogAction[];
  children?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  title,
  description,
  icon: Icon = AlertTriangle,
  iconColor = '#f59e0b',
  actions,
  children,
}) => {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md mx-4 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${iconColor}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white">{title}</h3>
                {description && <p className="text-sm text-white/40">{description}</p>}
              </div>
            </div>

            {children && <div className="mt-4 mb-2">{children}</div>}

            <div className="flex items-center gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              {actions.map((action, i) => {
                const ActionIcon = action.icon;
                const base = action.disabled
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : action.variant === 'danger'
                    ? 'bg-red-500/80 hover:bg-red-500 text-white'
                    : action.variant === 'primary'
                    ? 'bg-primary/80 hover:bg-primary text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white/80';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${action.disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${base}`}
                  >
                    {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
                    {action.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
