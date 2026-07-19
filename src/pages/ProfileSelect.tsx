import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getDefaultAvatar } from '@/lib/default-avatars';
import { profilesApi } from '@/lib/tauri-api';
import TitleBar from '@/components/TitleBar';
import type { Profile } from '@/types';

interface ProfileSelectProps {
  profiles: Profile[];
  onSelect: (profile: Profile) => void;
}

const AvatarDisplay: React.FC<{ profile: Profile; size?: number }> = ({ profile, size = 72 }) => {
  const isCustom = profile.avatar_id === 'custom' && profile.custom_avatar_data_url;
  const defaultAvatar = getDefaultAvatar(profile.avatar_id);

  if (isCustom) {
    return (
      <div
        className="rounded-full overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img src={profile.custom_avatar_data_url!} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (defaultAvatar) {
    return (
      <div
        className="rounded-full overflow-hidden"
        style={{ width: size, height: size, background: defaultAvatar.bgGradient }}
        dangerouslySetInnerHTML={{ __html: defaultAvatar.svg }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-white/10 flex items-center justify-center text-white/40 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </div>
  );
};

const ProfileSelect: React.FC<ProfileSelectProps> = ({ profiles, onSelect }) => {
  const { t } = useTranslation();
  const [passwordPrompt, setPasswordPrompt] = useState<Profile | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleClick = useCallback((profile: Profile) => {
    if (profile.password_hash) {
      setPasswordPrompt(profile);
      setPassword('');
      setError('');
      setShowPassword(false);
    } else {
      onSelect(profile);
    }
  }, [onSelect]);

  const handleVerify = useCallback(async () => {
    if (!passwordPrompt || !password.trim()) return;
    setVerifying(true);
    setError('');
    try {
      const valid = await profilesApi.verifyPassword(passwordPrompt.id, password);
      if (valid) {
        onSelect(passwordPrompt);
      } else {
        setError(t('app.incorrectPassword'));
      }
    } catch {
      setError(t('app.verificationError'));
    } finally {
      setVerifying(false);
    }
  }, [passwordPrompt, password, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    } else if (e.key === 'Escape') {
      setPasswordPrompt(null);
    }
  }, [handleVerify]);

  return (
    <div className="h-screen flex flex-col bg-fixed font-display select-none">
      <TitleBar />
      <div className="flex-1 flex flex-col items-center justify-center" data-tauri-drag-region>
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white mb-2">{t('profileSelect.whoIsWatching')}</h1>
        <p className="text-sm text-white/40">{t('profileSelect.selectProfile')}</p>
      </div>

      {/* Profile grid */}
      {!passwordPrompt ? (
        <div className="flex flex-wrap justify-center gap-8 max-w-[600px]">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleClick(profile)}
              className="group flex flex-col items-center gap-3 cursor-pointer transition-transform hover:scale-105 focus:outline-none"
            >
              <div className="relative">
                <div className="ring-2 ring-transparent group-hover:ring-primary/50 rounded-full transition-all">
                  <AvatarDisplay profile={profile} size={80} />
                </div>
                {profile.password_hash && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-white/60" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors max-w-[100px] truncate">
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* Password prompt */
        <div className="flex flex-col items-center gap-5 w-[320px]">
          <div className="flex flex-col items-center gap-3">
            <AvatarDisplay profile={passwordPrompt} size={72} />
            <span className="text-base font-semibold text-white">{passwordPrompt.name}</span>
          </div>

          <div className="w-full">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <ShieldCheck className="w-4 h-4 text-white/30" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder={t('app.passwordPlaceholder')}
                autoFocus
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-400 text-center">{error}</p>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => setPasswordPrompt(null)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              {t('common.back')}
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || !password.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {verifying ? t('app.verifying') : t('common.continue')}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ProfileSelect;
