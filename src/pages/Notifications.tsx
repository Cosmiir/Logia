import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Trash2, Check, CheckCheck, Filter, Inbox } from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import { useActiveProfile } from '@/hooks/useProfiles';
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useDeleteNotification } from '@/hooks/useNotifications';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { notificationStyles, formatDate, formatDateLong } from '@/lib/notificationConfig';
import type { Notification, NotificationType } from '@/types';

type FilterType = 'all' | 'unread';
type CategoryFilter = 'all' | NotificationType;

const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const { data: activeProfile } = useActiveProfile();

  const categoryFilters: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: t('notifications.all') },
    { id: 'near_completion', label: t('notifications.nearCompletion') },
    { id: 'stagnant_media', label: t('notifications.stagnantMedia') },
    { id: 'waiting_media', label: t('notifications.waitingMedia') },
    { id: 'objective_deadline', label: t('notifications.objectiveDeadline') },
    { id: 'objective_stalled', label: t('notifications.objectiveStalled') },
    { id: 'objective_achieved', label: t('notifications.objectiveAchieved') },
    { id: 'monthly_report', label: t('notifications.monthlyReport') },
  ];
  const { data: notifications = [], isLoading } = useNotifications(activeProfile?.id ?? null);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();
  const navigateToMediaDetail = useNavigationStore((s) => s.navigateToMediaDetail);
  const navigateToObjectiveCreate = useNavigationStore((s) => s.navigateToObjectiveCreate);
  const [readFilter, setReadFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.related_entity_type === 'media' && notification.related_entity_id) {
      navigateToMediaDetail(notification.related_entity_id);
    } else if (notification.related_entity_type === 'objective' && notification.related_entity_id) {
      navigateToObjectiveCreate(notification.related_entity_id);
    }
  };

  const handleMarkAllAsRead = () => {
    if (activeProfile?.id) {
      markAllAsRead.mutate(activeProfile.id);
    }
  };

  const handleDelete = (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    deleteNotification.mutate(notificationId);
  };

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;
    if (readFilter === 'unread') {
      result = result.filter(n => !n.is_read);
    }
    if (categoryFilter !== 'all') {
      result = result.filter(n => n.type === categoryFilter);
    }
    return result;
  }, [notifications, readFilter, categoryFilter]);

  // Group notifications by date
  const groups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const result: { title: string; items: Notification[] }[] = [];

    const todayItems = filteredNotifications.filter(n => {
      const date = new Date(n.created_at);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    });
    if (todayItems.length > 0) result.push({ title: t('notifications.dateGroups.today'), items: todayItems });

    const yesterdayItems = filteredNotifications.filter(n => {
      const date = new Date(n.created_at);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === yesterday.getTime();
    });
    if (yesterdayItems.length > 0) result.push({ title: t('notifications.dateGroups.yesterday'), items: yesterdayItems });

    const thisWeekItems = filteredNotifications.filter(n => {
      const date = new Date(n.created_at);
      date.setHours(0, 0, 0, 0);
      return date >= oneWeekAgo && date < yesterday;
    });
    if (thisWeekItems.length > 0) result.push({ title: t('notifications.dateGroups.thisWeek'), items: thisWeekItems });

    const thisMonthItems = filteredNotifications.filter(n => {
      const date = new Date(n.created_at);
      return date >= oneMonthAgo && date < oneWeekAgo;
    });
    if (thisMonthItems.length > 0) result.push({ title: t('notifications.dateGroups.thisMonth'), items: thisMonthItems });

    const olderItems = filteredNotifications.filter(n => {
      const date = new Date(n.created_at);
      return date < oneMonthAgo;
    });
    if (olderItems.length > 0) result.push({ title: t('notifications.dateGroups.older'), items: olderItems });

    return result;
  }, [filteredNotifications, t]);

  // Aggregate stats
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NotificationType, number>> = {};
    for (const n of notifications) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, [notifications]);

  // Available category filters (only show types that have notifications)
  const availableCategoryFilters = categoryFilters.filter(
    f => f.id === 'all' || (typeCounts[f.id as NotificationType] ?? 0) > 0
  );

  if (isLoading) {
    return (
      <AppShell>
        <SharedHeader activePage="notifications" />
        <MainContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-text-secondary">{t('common.loading')}</div>
          </div>
        </MainContent>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SharedHeader activePage="notifications" />
      <MainContent>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-flashy-purple/20 border border-primary/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('notifications.title')}</h1>
              <p className="text-xs text-text-secondary">
                {notifications.length} {t('notifications.notification', { count: notifications.length })}
                {unreadCount > 0 && (
                  <span className="ml-2 text-primary">· {unreadCount} {t('notifications.unread', { count: unreadCount })}</span>
                )}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              {t('notifications.markAllAsRead')}
            </button>
          )}
        </div>

        {/* Filters bar */}
        <div className="flex items-center gap-3 mb-6">
          {/* Read/Unread filter */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setReadFilter('all')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                readFilter === 'all'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {t('notifications.all')}
            </button>
            <button
              onClick={() => setReadFilter('unread')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                readFilter === 'unread'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {t('notifications.unread')}
              {unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Category filter toggle */}
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-xl transition-all cursor-pointer ${
              categoryFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-white/5 border-white/10 text-text-secondary hover:text-white hover:border-white/20'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {categoryFilter !== 'all'
              ? t(notificationStyles[categoryFilter as NotificationType]?.labelKey ?? 'notifications.filter')
              : t('notifications.filterByType')
            }
          </button>
        </div>

        {/* Category filter pills */}
        {showCategoryFilter && (
          <div className="flex flex-wrap gap-2 mb-6 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
            {availableCategoryFilters.map(filter => {
              const isActive = categoryFilter === filter.id;
              const style = filter.id !== 'all' ? notificationStyles[filter.id as NotificationType] : null;
              const count = filter.id !== 'all' ? typeCounts[filter.id as NotificationType] ?? 0 : notifications.length;
              const Icon = style?.icon;
              return (
                <button
                  key={filter.id}
                  onClick={() => setCategoryFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer border ${
                    isActive
                      ? 'text-white border-white/20 bg-white/10'
                      : 'text-text-secondary hover:text-white border-transparent hover:bg-white/5'
                  }`}
                  style={isActive && style ? { borderColor: `${style.accentHex}40`, backgroundColor: `${style.accentHex}15` } : undefined}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" style={isActive ? { color: style?.accentHex } : undefined} />}
                  {filter.label}
                  <span className="text-[10px] opacity-50">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Notifications list */}
        {filteredNotifications.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            {readFilter === 'unread' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-white font-semibold text-lg">{t('notifications.allUpToDate')}</p>
                <p className="text-text-secondary text-sm mt-2">{t('notifications.noUnread')}</p>
              </>
            ) : categoryFilter !== 'all' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-text-secondary" />
                </div>
                <p className="text-white font-semibold text-lg">{t('library.noResults')}</p>
                <p className="text-text-secondary text-sm mt-2">{t('notifications.noneOfType')}</p>
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="mt-4 px-4 py-2 text-sm text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-lg transition-all cursor-pointer"
                >
                  {t('notifications.seeAll')}
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-text-secondary" />
                </div>
                <p className="text-white font-semibold text-lg">{t('notifications.noNotificationsYet')}</p>
                <p className="text-text-secondary text-sm mt-2 max-w-sm mx-auto">
                  {t('notifications.hint')}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{group.title}</h2>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[10px] text-text-secondary">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map((notification) => {
                    const style = notificationStyles[notification.type];
                    const Icon = style?.icon ?? Bell;
                    const bgColor = style?.bgColor ?? 'bg-white/5';
                    const iconColor = style?.color ?? 'text-text-secondary';
                    const accentHex = style?.accentHex ?? '#888';

                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group relative flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                          !notification.is_read
                            ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.12]'
                            : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]'
                        }`}
                      >
                        {/* Unread indicator */}
                        {!notification.is_read && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full"
                            style={{ backgroundColor: accentHex }}
                          />
                        )}

                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                          <Icon className={`w-5 h-5 ${iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={`text-sm font-semibold truncate ${!notification.is_read ? 'text-white' : 'text-white/60'}`}>
                                  {notification.title}
                                </h3>
                                {/* Type badge */}
                                <span
                                  className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                                  style={{
                                    color: accentHex,
                                    backgroundColor: `${accentHex}10`,
                                    borderColor: `${accentHex}25`,
                                  }}
                                >
                                  {style ? t(style.labelKey) : notification.type}
                                </span>
                              </div>
                              <p className={`text-sm mt-1 ${!notification.is_read ? 'text-text-secondary' : 'text-white/30'}`}>
                                {notification.message}
                              </p>
                            </div>

                            {/* Right side: date + actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-gray-500" title={formatDateLong(notification.created_at)}>
                                {formatDate(notification.created_at)}
                              </span>
                              <button
                                onClick={(e) => handleDelete(e, notification.id)}
                                className="p-1.5 text-transparent group-hover:text-white/30 hover:!text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                title={t('media.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </MainContent>
    </AppShell>
  );
};

export default Notifications;
