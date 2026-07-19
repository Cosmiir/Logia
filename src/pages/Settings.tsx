import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Palette, Bell, Keyboard, Database, Info, Settings as SettingsIcon } from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import {
  ProfileSection,
  PersonalizationSection,
  NotificationsSection,
  ShortcutsSection,
  DataSection,
  AboutSection,
} from '@/components/Settings';

/* ================================================================== */
/*  Tabs                                                               */
/* ================================================================== */
type SettingsTab = 'profile' | 'personalization' | 'notifications' | 'shortcuts' | 'data' | 'about';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const settingsTabs: TabDef[] = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'personalization', label: t('settings.tabs.personalization'), icon: Palette },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
    { id: 'shortcuts', label: t('settings.tabs.shortcuts'), icon: Keyboard },
    { id: 'data', label: t('settings.tabs.data'), icon: Database },
    { id: 'about', label: t('settings.tabs.about'), icon: Info },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileSection />;
      case 'personalization': return <PersonalizationSection />;
      case 'notifications': return <NotificationsSection />;
      case 'shortcuts': return <ShortcutsSection />;
      case 'data': return <DataSection />;
      case 'about': return <AboutSection />;
    }
  };

  return (
    <AppShell>
      <SharedHeader activePage="settings" />
      <MainContent>
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-flashy-purple" />
          <h1 className="text-xl font-bold text-white">{t('settings.title')}</h1>
        </div>

        {/* Glass card container */}
        <div className="glass-card rounded-2xl p-8">
          {/* Tab navigation — CSS sliding pill */}
          <div className="mb-8 flex justify-center overflow-x-auto custom-scrollbar">
            <SettingsTabNav tabs={settingsTabs} activeTab={activeTab} onSelect={setActiveTab} />
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </MainContent>
    </AppShell>
  );
};

/* ================================================================== */
/*  Sliding pill nav (CSS transitions, no Framer LayoutGroup)          */
/* ================================================================== */
const SettingsTabNav: React.FC<{ tabs: TabDef[]; activeTab: SettingsTab; onSelect: (tab: SettingsTab) => void }> = ({
  tabs,
  activeTab,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const btn = buttonRefs.current.get(activeTab);
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({
      left: bRect.left - cRect.left,
      width: bRect.width,
    });
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex h-[50px] items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-1.5 py-1 backdrop-blur-md"
    >
      {/* Sliding indicator */}
      <span
        className="absolute top-1 bottom-1 rounded-full border border-white/5 bg-white/10 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => { if (el) buttonRefs.current.set(tab.id, el); }}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`relative z-10 flex h-[42px] items-center gap-2 rounded-full px-5 text-xs font-semibold tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
              isActive ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Settings;
