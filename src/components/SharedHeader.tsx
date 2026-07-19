import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Library,
  Bell,
  BarChart3,
  Settings,
  Tag,
  Check,
  ArrowRight,
  FileText,
  Users,
} from 'lucide-react';
import { useNavigationStore, type PageType } from '@/stores/useNavigationStore';
import { useActiveProfile } from '@/hooks/useProfiles';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { notificationStyles, formatDate } from '@/lib/notificationConfig';
import type { Notification } from '@/types';
import { getDefaultAvatar } from '@/lib/default-avatars';
import PillNavigation, { type PillNavigationItem } from '@/components/PillNavigation';
import AppLogo from '@/components/AppLogo';

interface SharedHeaderProps {
  activePage: PageType;
  disableLayoutAnimation?: boolean;
}

const SharedHeader: React.FC<SharedHeaderProps> = ({ activePage, disableLayoutAnimation }) => {
  const { t } = useTranslation();

  const navItems: PillNavigationItem<PageType>[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: t('navigation.library'), icon: Library },
    { id: 'stats', label: t('navigation.stats'), icon: BarChart3 },
  ];
  const navigate = useNavigationStore((s) => s.navigate);
  const navigateToMediaDetail = useNavigationStore((s) => s.navigateToMediaDetail);
  const navigateToObjectiveCreate = useNavigationStore((s) => s.navigateToObjectiveCreate);
  const { data: activeProfile } = useActiveProfile();
  const { data: unreadCount } = useUnreadCount(activeProfile?.id ?? null);
  const { data: notifications = [] } = useNotifications(activeProfile?.id ?? null);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setIsNotificationDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    setIsNotificationDropdownOpen(false);
    
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

  const latestNotifications = notifications.slice(0, 5);

  return (
    <header className="h-16 shrink-0 z-50 relative">
      <div className="h-full flex items-center justify-between px-10">
      {/* Logo */}
      <AppLogo size="sm" />

      {/* Navigation — pill container */}
      <div className="hidden md:flex items-center h-[50px] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <PillNavigation
          items={navItems}
          activeId={activePage}
          onSelect={navigate}
          groupId="shared-header"
          className="p-1"
          pillClassName="h-[40px]"
          uppercase
          disableLayoutAnimation={disableLayoutAnimation}
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 pr-[2px]">
        {/* Notifications */}
        <div className="relative" ref={notificationDropdownRef}>
          <button
            type="button"
            onClick={() => setIsNotificationDropdownOpen((prev) => !prev)}
            className="relative w-[40px] h-[40px] flex items-center justify-center text-text-secondary hover:text-white transition-colors rounded-full cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30"
          >
            <Bell className="w-5 h-5 fill-current" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-flashy-purple text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#0a0c1a]">
                {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[360px] bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-2 z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white">{t('notifications.title')}</p>
                  {(unreadCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {(unreadCount ?? 0) > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] text-text-secondary hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    {t('notifications.markAllAsRead')}
                  </button>
                )}
              </div>

              {/* Notifications list */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {latestNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-text-secondary">{t('notifications.none')}</p>
                  </div>
                ) : (
                  latestNotifications.map((notification) => {
                    const style = notificationStyles[notification.type];
                    const Icon = style?.icon ?? Bell;
                    const bgColor = style?.bgColor ?? 'bg-white/5';
                    const iconColor = style?.color ?? 'text-text-secondary';
                    const accentHex = style?.accentHex ?? '#888';
                    
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`relative flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-all hover:bg-white/5 ${
                          !notification.is_read ? 'bg-white/[0.03]' : ''
                        }`}
                      >
                        {/* Unread dot */}
                        {!notification.is_read && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-full"
                            style={{ backgroundColor: accentHex }}
                          />
                        )}

                        <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-xs font-semibold truncate ${!notification.is_read ? 'text-white' : 'text-white/50'}`}>
                              {notification.title}
                            </h4>
                            <span className="text-[10px] text-gray-500 shrink-0">
                              {formatDate(notification.created_at)}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-0.5 line-clamp-1 ${!notification.is_read ? 'text-text-secondary' : 'text-white/25'}`}>
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-white/5 mt-1 pt-1">
                <button
                  onClick={() => { navigate('notifications'); setIsNotificationDropdownOpen(false); }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs text-text-secondary hover:text-white hover:bg-white/5 transition-all cursor-pointer rounded-lg mx-0"
                >
                  {t('notifications.viewAll')}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsProfileMenuOpen((prev) => !prev);
            }}
            className="w-[46px] h-[46px] rounded-full overflow-hidden shadow-lg transition-all duration-300 cursor-pointer focus:outline-none flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10 ring-offset-0 ring-offset-[#0a0c1a]"
            style={{
              background: activeProfile?.avatar_id === 'custom' && activeProfile?.custom_avatar_data_url
                ? `url(${activeProfile.custom_avatar_data_url}) center/cover`
                : getDefaultAvatar(activeProfile?.avatar_id ?? 'default-1')?.bgGradient ?? 'linear-gradient(135deg, #667eea, #764ba2)',
            }}
          >
            {activeProfile?.avatar_id === 'custom' && activeProfile?.custom_avatar_data_url
              ? null
              : activeProfile?.avatar_id?.startsWith('default-')
                ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: getDefaultAvatar(activeProfile.avatar_id)?.svg ?? '' }} />
                : (activeProfile?.name ?? 'U').charAt(0).toUpperCase()
            }
          </button>
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                <p className="text-xs font-semibold text-white">{activeProfile?.name ?? t('common.profile')}</p>
              </div>
              <button
                onClick={() => { navigate('genre-management'); setIsProfileMenuOpen(false); }}
                className="flex items-center gap-2 mx-2 px-3 py-2 text-sm text-text-secondary hover:bg-white/10 hover:text-white transition-all w-[calc(100%-16px)] text-left rounded-lg cursor-pointer"
              >
                <Tag className="w-[18px] h-[18px]" />
                {t('navigation.genres')}
              </button>
              <button
                onClick={() => { navigate('person-management'); setIsProfileMenuOpen(false); }}
                className="flex items-center gap-2 mx-2 px-3 py-2 text-sm text-text-secondary hover:bg-white/10 hover:text-white transition-all w-[calc(100%-16px)] text-left rounded-lg cursor-pointer"
              >
                <Users className="w-[18px] h-[18px]" />
                {t('navigation.people') || 'Gestion des personnes'}
              </button>
              <button
                onClick={() => { navigate('template-management'); setIsProfileMenuOpen(false); }}
                className="flex items-center gap-2 mx-2 px-3 py-2 text-sm text-text-secondary hover:bg-white/10 hover:text-white transition-all w-[calc(100%-16px)] text-left rounded-lg cursor-pointer"
              >
                <FileText className="w-[18px] h-[18px]" />
                {t('navigation.templates')}
              </button>
              <button
                onClick={() => { navigate('settings'); setIsProfileMenuOpen(false); }}
                className="flex items-center gap-2 mx-2 px-3 py-2 text-sm text-text-secondary hover:bg-white/10 hover:text-white transition-all w-[calc(100%-16px)] text-left rounded-lg cursor-pointer"
              >
                <Settings className="w-[18px] h-[18px]" />
                {t('navigation.settings')}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};

export default SharedHeader;
