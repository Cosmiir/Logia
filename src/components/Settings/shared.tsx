import React from 'react';

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">{children}</h3>
);

export const Divider: React.FC = () => <div className="border-t border-white/[0.06] my-6" />;

export const SettingRow: React.FC<{
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}> = ({ icon: Icon, iconColor, iconBg, title, description, children }) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <h4 className="text-sm font-medium text-white">{title}</h4>
        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
    {children && <div className="shrink-0 ml-4">{children}</div>}
  </div>
);

export const Toggle: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
  <button
    onClick={onToggle}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${
      enabled ? 'bg-primary shadow-lg shadow-primary/40' : 'bg-white/10'
    }`}
    type="button"
  >
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
      enabled ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
    }`} />
  </button>
);
