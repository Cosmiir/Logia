import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigationStore } from './stores/useNavigationStore';
import { useProfileSettingsStore } from './hooks/useProfileSettingsStore';
import { useProfiles, useActiveProfile, useSwitchProfile } from './hooks/useProfiles';
import { useInitializeSettings } from './hooks/useInitializeSettings';
import { useAppStatus } from './hooks/useAppStatus';
import { useAutoGenerateNotifications } from './hooks/useTriggerNotifications';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useGravityUII18n } from './hooks/useGravityUII18n';
import { profilesApi } from './lib/tauri-api';
import TitleBar from './components/TitleBar';
import Onboarding from './components/Onboarding';
import ProfileSelect from './pages/ProfileSelect';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Settings from './pages/Settings';
import StorageMissingScreen from './components/StorageMissingScreen';
import type { Profile } from './types';

// Lazy-loaded pages (secondary routes — not needed on initial render)
const Stats = lazy(() => import('./pages/Stats'));
const Notifications = lazy(() => import('./pages/Notifications'));
const CreateProfile = lazy(() => import('./pages/CreateProfile'));
const CollectionEdit = lazy(() => import('./pages/CollectionEdit'));
const MediaCreate = lazy(() => import('./pages/MediaCreate'));
const GenreManagement = lazy(() => import('./pages/GenreManagement'));
const PersonManagement = lazy(() => import('./pages/PersonManagement'));
const TemplateManagement = lazy(() => import('./pages/TemplateManagement'));
const MediaDetail = lazy(() => import('./pages/MediaDetail'));
const ObjectiveCreate = lazy(() => import('./pages/ObjectiveCreate'));
const Import = lazy(() => import('./pages/Import'));
const Export = lazy(() => import('./pages/Export'));

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const LazyFallback = () => (
  <div className="h-screen flex items-center justify-center" style={{ background: 'var(--theme-gradient)' }}>
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const withSuspense = (Component: React.LazyExoticComponent<React.FC>): React.FC =>
  function SuspendedPage() {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Component />
      </Suspense>
    );
  };

const pages: Record<string, React.FC> = {
  dashboard: Dashboard,
  library: Library,
  settings: Settings,
  stats: withSuspense(Stats),
  notifications: withSuspense(Notifications),
  'create-profile': withSuspense(CreateProfile),
  'collection-edit': withSuspense(CollectionEdit),
  'media-create': withSuspense(MediaCreate),
  'media-detail': withSuspense(MediaDetail),
  'genre-management': withSuspense(GenreManagement),
  'person-management': withSuspense(PersonManagement),
  'template-management': withSuspense(TemplateManagement),
  'objective-create': withSuspense(ObjectiveCreate),
  import: withSuspense(Import),
  export: withSuspense(Export),
};

function App() {
  const { t } = useTranslation();
  const currentPage = useNavigationStore((s) => s.currentPage);
  const animationsEnabled = useProfileSettingsStore((s) => s.personalization.animationsEnabled);
  const showProfileSelector = useProfileSettingsStore((s) => s.personalization.showProfileSelectorOnStartup);
  const { data: profiles, isLoading } = useProfiles();
  const { data: activeProfile } = useActiveProfile();
  const switchProfile = useSwitchProfile();
  const { status: appStatus, loading: appStatusLoading } = useAppStatus();
  useAutoGenerateNotifications();
  useInitializeSettings(); // Initialize settings store for active profile
  useGlobalShortcuts();
  useGravityUII18n(); // Keep Gravity UI components in sync with React i18n

  // Sync animations class with user preference (ignores Windows prefers-reduced-motion)
  useEffect(() => {
    document.documentElement.classList.toggle('no-animations', !animationsEnabled);
  }, [animationsEnabled]);

  const [onboardingDone, setOnboardingDone] = useState(false);
  const [profileSelected, setProfileSelected] = useState(false);
  const [lockedProfileUnlocked, setLockedProfileUnlocked] = useState(false);

  // Locked-profile gate state
  const [lockPassword, setLockPassword] = useState('');
  const [lockShowPassword, setLockShowPassword] = useState(false);
  const [lockError, setLockError] = useState('');
  const [lockVerifying, setLockVerifying] = useState(false);

  const handleProfileSelect = useCallback(async (profile: Profile) => {
    try {
      await switchProfile.mutateAsync(profile.id);
    } catch { /* already active */ }
    setProfileSelected(true);
    setLockedProfileUnlocked(true);
  }, [switchProfile]);

  const handleUnlockActive = useCallback(async () => {
    if (!activeProfile || !lockPassword.trim()) return;
    setLockVerifying(true);
    setLockError('');
    try {
      const valid = await profilesApi.verifyPassword(activeProfile.id, lockPassword);
      if (valid) {
        setLockedProfileUnlocked(true);
      } else {
        setLockError(t('app.incorrectPassword'));
      }
    } catch {
      setLockError(t('app.verificationError'));
    } finally {
      setLockVerifying(false);
    }
  }, [activeProfile, lockPassword]);

  // Loading state while fetching profiles
  if (isLoading || appStatusLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-fixed font-display" style={{ background: 'var(--theme-gradient)' }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Storage missing screen - takes priority over onboarding
  if (appStatus?.storage_missing) {
    return <StorageMissingScreen storagePath={appStatus.storage_path} hasConfig={appStatus.has_config} />;
  }

  // First launch: no profiles exist yet
  // Only show onboarding if storage is accessible (not missing)
  if (!onboardingDone && profiles && profiles.length === 0 && !appStatus?.storage_missing) {
    return <Onboarding onComplete={() => setOnboardingDone(true)} />;
  }

  // Profile selection on startup (only if multiple profiles exist and setting is enabled)
  if (!profileSelected && showProfileSelector && profiles && profiles.length > 1) {
    return <ProfileSelect profiles={profiles} onSelect={handleProfileSelect} />;
  }

  // Locked active profile gate: if selector is OFF (or single profile) and active profile has a password
  if (!lockedProfileUnlocked && activeProfile?.password_hash) {
    return (
      <div className="h-screen flex flex-col bg-fixed font-display select-none" style={{ background: 'var(--theme-gradient)' }}>
        <TitleBar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-5 w-[320px]">
            <ShieldCheck className="w-10 h-10 text-primary/60" />
            <div className="text-center">
              <h2 className="text-lg font-bold text-white mb-1">{activeProfile.name}</h2>
              <p className="text-xs text-white/40">{t('app.profileLocked')}</p>
            </div>
            <div className="w-full">
              <div className="relative">
                <input
                  type={lockShowPassword ? 'text' : 'password'}
                  value={lockPassword}
                  onChange={(e) => { setLockPassword(e.target.value); setLockError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockActive()}
                  placeholder={t('app.passwordPlaceholder')}
                  autoFocus
                  className="w-full px-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setLockShowPassword(!lockShowPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                >
                  {lockShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {lockError && <p className="mt-2 text-xs text-red-400 text-center">{lockError}</p>}
            </div>
            <button
              onClick={handleUnlockActive}
              disabled={lockVerifying || !lockPassword.trim()}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lockVerifying ? t('app.verifying') : t('app.unlock')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const PageComponent = pages[currentPage];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        variants={pageVariants}
        initial={animationsEnabled ? "initial" : undefined}
        animate={animationsEnabled ? "animate" : undefined}
        exit={animationsEnabled ? "exit" : undefined}
        transition={{ duration: animationsEnabled ? 0.15 : 0, ease: 'easeInOut' }}
        className="contents"
      >
        <PageComponent />
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
