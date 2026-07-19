import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, ChevronRight, ChevronLeft, Camera, Check, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { DEFAULT_AVATARS } from '@/lib/default-avatars';
import ImageCropModal from '@/components/Settings/ImageCropModal';

interface ProfileStepProps {
  name: string;
  setName: (name: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (confirmPassword: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  selectedAvatarId: string;
  setSelectedAvatarId: (id: string) => void;
  customAvatarDataUrl: string | null;
  setCustomAvatarDataUrl: (url: string | null) => void;
  cropImage: string | null;
  setCropImage: (image: string | null) => void;
  error: string;
  setError: (error: string) => void;
  existingProfiles: any[];
  onBack: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
}

const ProfileStep: React.FC<ProfileStepProps> = ({
  name,
  setName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  selectedAvatarId,
  setSelectedAvatarId,
  customAvatarDataUrl,
  setCustomAvatarDataUrl,
  cropImage,
  setCropImage,
  error,
  setError,
  existingProfiles,
  onBack,
  onNext,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setCustomAvatarDataUrl(croppedDataUrl);
    setSelectedAvatarId('custom');
    setCropImage(null);
  };

  const isCustomSelected = selectedAvatarId === 'custom' && customAvatarDataUrl;

  const handleNext = () => {
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
    setError('');
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('common.profile')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">{t('onboarding.profile.stepLabel')}</span>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT COLUMN — 3/5 */}
        <div className="col-span-3 space-y-4">
          {/* Name */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('createProfile.profileName')}</span>
            </div>
            <div className="p-5">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                placeholder={t('createProfile.namePlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
                autoFocus
                maxLength={30}
              />
              {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
            </div>
          </div>

          {/* Password */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('common.password')}</span>
              <span className="text-xs text-white/30 font-normal">({t('common.optional')})</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('common.password') + '...'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
                    maxLength={64}
                  />
                  {password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('common.confirm') + '...'}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-500/40'
                        : 'border-white/10'
                    }`}
                    maxLength={64}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">{t('createProfile.passwordHint')}</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — 2/5 */}
        <div className="col-span-2">
          <div className="glass-card rounded-2xl overflow-hidden h-full">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Camera className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('common.avatar')}</span>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-3 justify-center">
                {/* Custom photo upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative w-14 h-14 rounded-full border-2 border-dashed transition-all duration-200 cursor-pointer flex items-center justify-center ${
                    isCustomSelected
                      ? 'border-primary/50 ring-2 ring-primary/30'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  {isCustomSelected ? (
                    <>
                      <div className="w-full h-full rounded-full overflow-hidden">
                        <img src={customAvatarDataUrl} alt="Custom" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-md">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Default avatars */}
                {DEFAULT_AVATARS.map((avatar) => {
                  const isActive = selectedAvatarId === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => { setSelectedAvatarId(avatar.id); }}
                      className={`relative w-14 h-14 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'border-primary/50 ring-2 ring-primary/30 scale-110'
                          : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <div
                        className="w-full h-full rounded-full overflow-hidden"
                        style={{ background: avatar.bgGradient }}
                        dangerouslySetInnerHTML={{ __html: avatar.svg }}
                      />
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-md">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className={`px-6 py-2.5 text-white text-sm rounded-lg transition-all shadow-lg shadow-primary/25 flex items-center gap-2 ${
            isSubmitting
              ? 'bg-primary/50 cursor-not-allowed opacity-70'
              : 'bg-primary hover:bg-primary/90 cursor-pointer'
          }`}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t('common.creating')}</>
          ) : (
            <>{t('common.next')} <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {cropImage && (
        <ImageCropModal
          imageDataUrl={cropImage}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropImage(null)}
        />
      )}
    </div>
  );
};

export default ProfileStep;
