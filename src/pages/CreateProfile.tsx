import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, FolderOpen, User, Globe } from 'lucide-react';
import { useCreateProfile, useSwitchProfile, useProfiles } from '@/hooks/useProfiles';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { getSettingsStore, type CardDensity } from '@/stores/useSettingsStore';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import { AppShell } from '@/components/Layout';
import { dataApi } from '@/lib/tauri-api';
import Stepper, { Step } from '@/components/Stepper';
import LanguageStep from '@/components/Onboarding/LanguageStep';
import StorageStep from '@/components/Onboarding/StorageStep';
import ProfileStep from '@/components/Onboarding/ProfileStep';
import PersonalizationStep from '@/components/Onboarding/PersonalizationStep';

interface CreateProfileProps {
  /** If true, this is the first-launch onboarding flow (no back button, different wording) */
  isOnboarding?: boolean;
  onComplete?: () => void;
}

type OnboardingStep = 'language' | 'storage' | 'profile' | 'personalization';

const LINE_DURATION = 0.25;

const getTargetWidth = (lineIndex: number, idx: number) => {
  if (lineIndex < idx) return '100%';
  if (lineIndex === idx) return '50%';
  return '0%';
};

const CreateProfile: React.FC<CreateProfileProps> = ({ isOnboarding = false, onComplete }) => {
  const { t } = useTranslation();
  // Profile state
  const [name, setName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('default-1');
  const [customAvatarDataUrl, setCustomAvatarDataUrl] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  // Personalization state
  const [themeId, setThemeId] = useState('nebula');
  const [cardDensity, setCardDensity] = useState<CardDensity>('normal');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Stepper state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(isOnboarding ? 'language' : 'profile');
  const [lineWidths, setLineWidths] = useState<string[]>([]);
  const prevIndexRef = useRef<number>(0);

  const { data: existingProfiles = [] } = useProfiles();
  const createProfile = useCreateProfile();
  const switchProfile = useSwitchProfile();
  const goBack = useNavigationStore((s) => s.goBack);
  const language = useProfileSettingsStore((s) => s.language);

  // Define steps for onboarding
  const onboardingSteps: Step[] = useMemo(() => [
    { id: 'language', label: t('onboarding.steps.language'), icon: Globe },
    { id: 'storage', label: t('onboarding.steps.storage'), icon: FolderOpen },
    { id: 'profile', label: t('onboarding.steps.profile'), icon: User },
    { id: 'personalization', label: t('onboarding.steps.personalization'), icon: Sparkles },
  ], [t]);

  // Define steps for regular profile creation
  const regularSteps: Step[] = useMemo(() => [
    { id: 'profile', label: t('onboarding.steps.profile'), icon: User },
  ], [t]);

  // Get current steps based on mode
  const currentSteps = isOnboarding ? onboardingSteps : regularSteps;

  // Initialize lineWidths and handle sequential animation
  useEffect(() => {
    const currentIndex = currentSteps.findIndex((step) => step.id === currentStep);
    const prev = prevIndexRef.current;

    // Initialisation
    if (lineWidths.length !== currentSteps.length - 1) {
      setLineWidths(currentSteps.slice(0, -1).map((_, i) => getTargetWidth(i, currentIndex)));
      prevIndexRef.current = currentIndex;
      return;
    }

    if (prev === currentIndex) return;

    const forward = currentIndex > prev;
    prevIndexRef.current = currentIndex;

    setLineWidths((current) => {
      const changing = currentSteps.slice(0, -1)
        .map((_, i) => i)
        .filter((lineIndex) => current[lineIndex] !== getTargetWidth(lineIndex, currentIndex));

      if (!forward) changing.reverse();

      changing.forEach((lineIndex, order) => {
        setTimeout(() => {
          setLineWidths((s) => {
            const next = [...s];
            next[lineIndex] = getTargetWidth(lineIndex, currentIndex);
            return next;
          });
        }, order * LINE_DURATION * 1000);
      });

      return current;
    });
  }, [currentStep, isOnboarding, lineWidths.length, currentSteps]);

  // Handle step click (only allow going back to previous steps)
  const handleStepClick = (stepId: string) => {
    const stepIndex = currentSteps.findIndex((step) => step.id === stepId);
    const currentIndex = currentSteps.findIndex((step) => step.id === currentStep);

    // Only allow clicking on completed or current steps
    if (stepIndex <= currentIndex) {
      setCurrentStep(stepId as OnboardingStep);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();

    if (!trimmed) {
      setError(t('createProfile.errors.emptyName'));
      return;
    }
    if (existingProfiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t('createProfile.errors.nameExists'));
      return;
    }
    if (password.trim() && password !== confirmPassword) {
      setError(t('createProfile.errors.passwordMismatch'));
      return;
    }
    setIsSubmitting(true);
    try {
      // If onboarding and storage path is selected, initialize it before creating profile
      if (isOnboarding && storagePath) {
        try {
          await dataApi.initStoragePath(storagePath);
        } catch (e) {
          setError(t('createProfile.errors.storageConfig') + String(e));
          return;
        }
      }

      const profile = await createProfile.mutateAsync({
        name: trimmed,
        avatar_id: selectedAvatarId,
        password: password.trim() || undefined,
      });

      // If custom avatar was uploaded, update the profile with the data URL
      if (selectedAvatarId === 'custom' && customAvatarDataUrl) {
        const { profilesApi } = await import('@/lib/tauri-api');
        await profilesApi.update({
          id: profile.id,
          avatar_id: 'custom',
          custom_avatar_data_url: customAvatarDataUrl,
        });
      }

      await switchProfile.mutateAsync(profile.id);

      // Apply personalization settings if onboarding
      if (isOnboarding) {
        const newProfileStore = getSettingsStore(profile.id);
        newProfileStore.getState().setThemeId(themeId);
        newProfileStore.getState().setCardDensity(cardDensity);
        newProfileStore.getState().setAnimationsEnabled(animationsEnabled);
        newProfileStore.getState().setLanguage(language);
      }

      if (onComplete) {
        onComplete();
      } else {
        goBack();
      }
    } catch (e) {
      setError(String(e));
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'language':
        return (
          <LanguageStep
            onNext={() => setCurrentStep('storage')}
          />
        );

      case 'storage':
        return (
          <StorageStep
            storagePath={storagePath}
            setStoragePath={setStoragePath}
            onNext={() => setCurrentStep('profile')}
          />
        );

      case 'profile':
        return (
          <ProfileStep
            name={name}
            setName={setName}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            selectedAvatarId={selectedAvatarId}
            setSelectedAvatarId={setSelectedAvatarId}
            customAvatarDataUrl={customAvatarDataUrl}
            setCustomAvatarDataUrl={setCustomAvatarDataUrl}
            cropImage={cropImage}
            setCropImage={setCropImage}
            error={error}
            setError={setError}
            existingProfiles={existingProfiles}
            onBack={() => isOnboarding ? setCurrentStep('language') : goBack()}
            onNext={() => isOnboarding ? setCurrentStep('personalization') : handleSubmit()}
            isSubmitting={!isOnboarding ? isSubmitting : false}
          />
        );

      case 'personalization':
        return (
          <PersonalizationStep
            themeId={themeId}
            setThemeId={setThemeId}
            cardDensity={cardDensity}
            setCardDensity={setCardDensity}
            animationsEnabled={animationsEnabled}
            setAnimationsEnabled={setAnimationsEnabled}
            onBack={() => setCurrentStep('profile')}
            onComplete={handleSubmit}
            isSubmitting={isSubmitting}
          />
        );

      default:
        return null;
    }
  };

  const content = (
    <div className="flex-1 flex flex-col p-8">
      {/* Glow backdrop */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 w-full max-w-5xl mx-auto">
        {/* Title */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-white">
              {isOnboarding ? t('createProfile.welcome') : t('createProfile.newProfile')}
            </h1>
          </div>
          <p className="text-sm text-gray-400">
            {isOnboarding
              ? t('createProfile.onboardingSubtitle')
              : t('createProfile.newProfileSubtitle')
            }
          </p>
        </div>

        {/* Stepper */}
        {isOnboarding && (
          <Stepper
            steps={currentSteps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            lineWidths={lineWidths}
          />
        )}

        {/* Step content */}
        {renderStep()}

        {/* Footer */}
        {!isOnboarding && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={goBack}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              {t('common.cancel')} {t('createProfile.andGoBack')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Wrap in AppShell
  return <AppShell>{content}</AppShell>;
};

export default CreateProfile;
