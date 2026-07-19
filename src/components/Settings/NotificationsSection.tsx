import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Hourglass, CheckCircle2, AlertTriangle, CircleOff, Trophy, CalendarDays } from 'lucide-react';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import { SectionTitle, Divider, SettingRow, Toggle } from './shared';

const NotificationsSection: React.FC = () => {
  const { t } = useTranslation();
  const notifications = useProfileSettingsStore((s) => s.notifications);
  const setStagnantMedia = useProfileSettingsStore((s) => s.setStagnantMedia);
  const setWaitingMedia = useProfileSettingsStore((s) => s.setWaitingMedia);
  const setNearCompletion = useProfileSettingsStore((s) => s.setNearCompletion);
  const setObjectiveDeadline = useProfileSettingsStore((s) => s.setObjectiveDeadline);
  const setObjectiveStalled = useProfileSettingsStore((s) => s.setObjectiveStalled);
  const setObjectiveAchieved = useProfileSettingsStore((s) => s.setObjectiveAchieved);
  const setMonthlyReport = useProfileSettingsStore((s) => s.setMonthlyReport);

  return (
    <>
      <SectionTitle>{t('settings.notifications.alerts')}</SectionTitle>
      <div className="space-y-1">
        <SettingRow
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          title={t('settings.notifications.stagnantMedia')}
          description={t('settings.notifications.stagnantMediaHint')}
        >
          <Toggle
            enabled={notifications.stagnantMedia}
            onToggle={() => setStagnantMedia(!notifications.stagnantMedia)}
          />
        </SettingRow>
        <SettingRow
          icon={Hourglass}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
          title={t('settings.notifications.waitingMedia')}
          description={t('settings.notifications.waitingMediaHint')}
        >
          <Toggle
            enabled={notifications.waitingMedia}
            onToggle={() => setWaitingMedia(!notifications.waitingMedia)}
          />
        </SettingRow>
        <SettingRow
          icon={CheckCircle2}
          iconColor="text-green-400"
          iconBg="bg-green-500/10"
          title={t('settings.notifications.nearCompletion')}
          description={t('settings.notifications.nearCompletionHint')}
        >
          <Toggle
            enabled={notifications.nearCompletion}
            onToggle={() => setNearCompletion(!notifications.nearCompletion)}
          />
        </SettingRow>
        <SettingRow
          icon={AlertTriangle}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
          title={t('settings.notifications.objectiveDeadline')}
          description={t('settings.notifications.objectiveDeadlineHint')}
        >
          <Toggle
            enabled={notifications.objectiveDeadline}
            onToggle={() => setObjectiveDeadline(!notifications.objectiveDeadline)}
          />
        </SettingRow>
        <SettingRow
          icon={CircleOff}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
          title={t('settings.notifications.objectiveStalled')}
          description={t('settings.notifications.objectiveStalledHint')}
        >
          <Toggle
            enabled={notifications.objectiveStalled}
            onToggle={() => setObjectiveStalled(!notifications.objectiveStalled)}
          />
        </SettingRow>
        <SettingRow
          icon={Trophy}
          iconColor="text-yellow-400"
          iconBg="bg-yellow-500/10"
          title={t('settings.notifications.objectiveAchieved')}
          description={t('settings.notifications.objectiveAchievedHint')}
        >
          <Toggle
            enabled={notifications.objectiveAchieved}
            onToggle={() => setObjectiveAchieved(!notifications.objectiveAchieved)}
          />
        </SettingRow>
        <SettingRow
          icon={CalendarDays}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          title={t('settings.notifications.monthlyReport')}
          description={t('settings.notifications.monthlyReportHint')}
        >
          <Toggle
            enabled={notifications.monthlyReport}
            onToggle={() => setMonthlyReport(!notifications.monthlyReport)}
          />
        </SettingRow>
      </div>

      <Divider />

      <p className="text-[11px] text-gray-500 leading-relaxed">
        {t('settings.notifications.privacyNote')}
      </p>
    </>
  );
}

export default NotificationsSection;
