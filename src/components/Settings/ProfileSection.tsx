import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Camera, Pencil, Plus, Trash2, Lock, Eye, EyeOff, ShieldCheck, FolderOpen, AlertTriangle } from 'lucide-react';
import { DEFAULT_AVATARS, getDefaultAvatar } from '@/lib/default-avatars';
import { useProfiles, useActiveProfile, useUpdateProfile, useSwitchProfile, useDeleteProfile } from '@/hooks/useProfiles';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import { profilesApi, dataApi } from '@/lib/tauri-api';
import { SectionTitle, Divider } from './shared';
import AvatarPreview from './AvatarPreview';
import ImageCropModal from './ImageCropModal';
import { open } from '@tauri-apps/plugin-dialog';

const ProfileSection: React.FC = () => {
  const { t } = useTranslation();
  const { data: profiles = [] } = useProfiles();
  const { data: activeProfile } = useActiveProfile();
  const updateProfile = useUpdateProfile();
  const switchProfile = useSwitchProfile();
  const deleteProfile = useDeleteProfile();
  const navigate = useNavigationStore((s) => s.navigate);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Switch password prompt
  const [switchPasswordProfileId, setSwitchPasswordProfileId] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchPasswordError, setSwitchPasswordError] = useState('');
  const [switchPasswordVisible, setSwitchPasswordVisible] = useState(false);
  const [switchVerifying, setSwitchVerifying] = useState(false);

  // Password management
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  // Startup toggle
  const showProfileSelectorOnStartup = useProfileSettingsStore((s) => s.personalization.showProfileSelectorOnStartup);
  const setShowProfileSelectorOnStartup = useProfileSettingsStore((s) => s.setShowProfileSelectorOnStartup);

  // Storage path
  const [storagePath, setStoragePath] = useState<string>('');
  const [isChangingStorage, setIsChangingStorage] = useState(false);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    dataApi.getStoragePath().then(setStoragePath).catch(() => {});
  }, []);

  const handleChangeStoragePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Sélectionner un nouveau dossier de stockage',
      });
      if (selected && typeof selected === 'string') {
        setIsChangingStorage(true);
        setStorageError('');
        try {
          const newPath = await dataApi.setStoragePath(selected);
          setStoragePath(newPath);
          setStorageError('');
        } catch (e) {
          setStorageError(String(e));
        } finally {
          setIsChangingStorage(false);
        }
      }
    } catch (e) {
      setStorageError(String(e));
    }
  };

  const hasPassword = !!activeProfile?.password_hash;

  const handleSetPassword = async () => {
    if (!activeProfile || !newPassword.trim()) return;
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg('Les mots de passe ne correspondent pas');
      return;
    }
    setPasswordSaving(true);
    try {
      await profilesApi.update({ id: activeProfile.id, password: newPassword.trim() });
      updateProfile.mutate({ id: activeProfile.id }); // trigger refetch
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordSection(false);
      setPasswordMsg('Mot de passe défini');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch { setPasswordMsg('Erreur'); }
    setPasswordSaving(false);
  };

  const handleRemovePassword = async () => {
    if (!activeProfile) return;
    setPasswordSaving(true);
    try {
      await profilesApi.update({ id: activeProfile.id, remove_password: true });
      updateProfile.mutate({ id: activeProfile.id });
      setPasswordMsg('Mot de passe supprimé');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch { setPasswordMsg('Erreur'); }
    setPasswordSaving(false);
  };

  const currentAvatarId = activeProfile?.avatar_id ?? 'default-1';
  const currentCustomUrl = activeProfile?.custom_avatar_data_url ?? null;
  const currentName = activeProfile?.name ?? 'Profil';
  const customAvatars = activeProfile?.custom_avatars ?? [];

  const handleNameSave = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !activeProfile) { setIsEditingName(false); return; }
    const duplicate = profiles.some((p) => p.id !== activeProfile.id && p.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) { setIsEditingName(false); return; }
    updateProfile.mutate({ id: activeProfile.id, name: trimmed });
    setIsEditingName(false);
  };

  const handleAvatarSelect = (avatarId: string) => {
    if (!activeProfile) return;
    updateProfile.mutate({ id: activeProfile.id, avatar_id: avatarId });
  };

  const handleCustomAvatarSelect = (dataUrl: string) => {
    if (!activeProfile) return;
    updateProfile.mutate({ id: activeProfile.id, avatar_id: 'custom', custom_avatar_data_url: dataUrl });
  };

  const handleRemoveCustomAvatar = (dataUrl: string) => {
    if (!activeProfile) return;
    updateProfile.mutate({ id: activeProfile.id, remove_custom_avatar: dataUrl });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    if (!activeProfile) return;
    updateProfile.mutate({ id: activeProfile.id, avatar_id: 'custom', custom_avatar_data_url: croppedDataUrl });
    setCropImage(null);
  };

  const handleSwitchProfile = (profileId: string) => {
    if (profileId === activeProfile?.id) return;
    const target = profiles.find((p) => p.id === profileId);
    if (target?.password_hash) {
      setSwitchPasswordProfileId(profileId);
      setSwitchPassword('');
      setSwitchPasswordError('');
      setSwitchPasswordVisible(false);
    } else {
      switchProfile.mutate(profileId);
    }
  };

  const handleSwitchWithPassword = async () => {
    if (!switchPasswordProfileId || !switchPassword.trim()) return;
    setSwitchVerifying(true);
    setSwitchPasswordError('');
    try {
      const valid = await profilesApi.verifyPassword(switchPasswordProfileId, switchPassword);
      if (valid) {
        switchProfile.mutate(switchPasswordProfileId);
        setSwitchPasswordProfileId(null);
      } else {
        setSwitchPasswordError('Mot de passe incorrect');
      }
    } catch {
      setSwitchPasswordError('Erreur de vérification');
    }
    setSwitchVerifying(false);
  };

  const handleDeleteProfile = (profileId: string) => {
    deleteProfile.mutate(profileId);
    setConfirmDeleteId(null);
  };

  return (
    <>
      {/* Current profile display — no camera badge, import is in avatar row */}
      <div className="flex items-center gap-5 mb-8">
        <AvatarPreview
          avatarId={currentAvatarId}
          customDataUrl={currentCustomUrl}
          size={80}
          className="ring-2 ring-white/10 ring-offset-2 ring-offset-[#0a0c1a]"
        />
        <div>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 w-48"
                autoFocus
                maxLength={30}
              />
              <button
                onClick={handleNameSave}
                className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{currentName}</h2>
              <button
                onClick={() => { setNameInput(currentName); setIsEditingName(true); }}
                className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">{t('settings.profile.activeProfile')}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Divider />

      {/* Password protection */}
      <SectionTitle>{t('settings.profile.profileProtection')}</SectionTitle>
      <div className="space-y-3 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white/30" />
            <span className="text-sm text-white/70">
              {hasPassword ? t('settings.profile.passwordActive') : t('settings.profile.noPassword')}
            </span>
            {passwordMsg && <span className="text-[10px] text-primary font-medium ml-2">{passwordMsg}</span>}
          </div>
          <div className="flex items-center gap-2">
            {hasPassword && (
              <button
                onClick={handleRemovePassword}
                disabled={passwordSaving}
                className="px-3 py-1.5 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-40"
              >
                Supprimer
              </button>
            )}
            <button
              onClick={() => { setShowPasswordSection(!showPasswordSection); setNewPassword(''); }}
              className="px-3 py-1.5 text-[11px] text-white/60 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {hasPassword ? t('settings.profile.change') : t('settings.profile.set')}
            </button>
          </div>
        </div>

        {showPasswordSection && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.profile.newPasswordPlaceholder')}
                  autoFocus
                  maxLength={64}
                  className="w-full px-4 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                />
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <div className="relative flex-1">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                  placeholder={t('settings.profile.confirmPlaceholder')}
                  maxLength={64}
                  className={`w-full px-4 pr-9 py-2.5 bg-white/5 border rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors ${
                    confirmNewPassword && confirmNewPassword !== newPassword
                      ? 'border-red-500/40'
                      : 'border-white/10'
                  }`}
                />
                {confirmNewPassword && (
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <button
                onClick={handleSetPassword}
                disabled={passwordSaving || !newPassword.trim() || !confirmNewPassword.trim()}
                className="px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {passwordSaving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-gray-600">
          {t('settings.profile.passwordHint')}
        </p>
      </div>

      <Divider />

      {/* Avatar selection */}
      <SectionTitle>{t('settings.profile.avatars')}</SectionTitle>
      <div className="flex flex-wrap gap-3 py-1">
        {/* Import new photo button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-14 h-14 rounded-full border-2 border-dashed border-white/20 hover:border-white/40 hover:scale-110 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
        >
          <Camera className="w-5 h-5 text-gray-400" />
        </button>

        {/* Default avatars */}
        {DEFAULT_AVATARS.map((avatar) => {
          const isActive = currentAvatarId === avatar.id;
          return (
            <button
              key={avatar.id}
              onClick={() => handleAvatarSelect(avatar.id)}
              className={`relative w-14 h-14 rounded-full border-2 transition-all duration-200 cursor-pointer shrink-0 ${
                isActive
                  ? 'border-primary/50 ring-2 ring-primary/30 scale-110'
                  : 'border-transparent hover:border-white/20 hover:scale-110 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(217,70,239,0.15)]'
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

        {/* Saved custom avatars */}
        {customAvatars.map((dataUrl, idx) => {
          const isActive = currentAvatarId === 'custom' && currentCustomUrl === dataUrl;
          return (
            <div key={`custom-${idx}`} className="relative group/custom shrink-0">
              <button
                onClick={() => handleCustomAvatarSelect(dataUrl)}
                className={`relative w-14 h-14 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-primary/50 ring-2 ring-primary/30 scale-110'
                    : 'border-transparent hover:border-white/20 hover:scale-110 hover:-translate-y-0.5 hover:shadow-[0_0_12px_rgba(217,70,239,0.15)]'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden">
                  <img src={dataUrl} alt="Custom avatar" className="w-full h-full object-cover" />
                </div>
              </button>
              {isActive && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-md">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {/* Delete on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveCustomAvatar(dataUrl); }}
                className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center z-20 shadow-md opacity-0 group-hover/custom:opacity-100 transition-opacity cursor-pointer"
                title={t('settings.profile.deleteAvatar')}
              >
                <Trash2 className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          );
        })}
      </div>

      <Divider />

      {/* Multi-profile management */}
      <SectionTitle>{t('settings.profile.profileManagement')}</SectionTitle>
      <p className="text-[11px] text-gray-500 mb-4">
        {t('settings.profile.profileManagementHint')}
      </p>

      {/* Startup toggle */}
      {profiles.length > 1 && (
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <p className="text-sm text-white/70">{t('settings.profile.profileSelectorOnStartup')}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{t('settings.profile.profileSelectorOnStartupHint')}</p>
          </div>
          <button
            onClick={() => setShowProfileSelectorOnStartup(!showProfileSelectorOnStartup)}
            className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
              showProfileSelectorOnStartup ? 'bg-primary' : 'bg-white/10'
            }`}
            style={{ height: 22, width: 40 }}
          >
            <div
              className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-transform"
              style={{ left: showProfileSelectorOnStartup ? 19 : 2 }}
            />
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {profiles.map((p) => {
          const isActive = p.id === activeProfile?.id;
          const avatar = getDefaultAvatar(p.avatar_id);

          return (
            <div key={p.id} className="space-y-1.5">
              <div className="group flex items-center">
                <button
                  onClick={() => handleSwitchProfile(p.id)}
                  disabled={switchProfile.isPending}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 border-primary/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-white'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: p.avatar_id === 'custom' && p.custom_avatar_data_url
                        ? `url(${p.custom_avatar_data_url}) center/cover`
                        : avatar?.bgGradient ?? 'linear-gradient(135deg, #667eea, #764ba2)',
                    }}
                  >
                    {!(p.avatar_id === 'custom' && p.custom_avatar_data_url) && avatar && (
                      <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: avatar.svg }} />
                    )}
                    {!(p.avatar_id === 'custom' && p.custom_avatar_data_url) && !avatar && p.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium">{p.name}</span>
                    {isActive && (
                      <span className="ml-2 text-[10px] text-primary font-semibold uppercase">{t('settings.profile.active')}</span>
                    )}
                  </div>

                  {!isActive && p.password_hash && <Lock className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                  {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>

                {/* Delete button (not for active or if only 1 profile) */}
                {!isActive && profiles.length > 1 && (
                <div className="ml-2 shrink-0">
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteProfile(p.id)}
                        className="px-2 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        {t('common.confirm')}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        {t('common.no')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="p-2 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer rounded-lg hover:bg-white/5"
                      title={t('settings.profile.deleteProfile')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              </div>

              {/* Inline password prompt for switching to this profile */}
              {switchPasswordProfileId === p.id && (
                <div className="flex items-center gap-2 pl-4">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    <input
                      type={switchPasswordVisible ? 'text' : 'password'}
                      value={switchPassword}
                      onChange={(e) => { setSwitchPassword(e.target.value); setSwitchPasswordError(''); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSwitchWithPassword();
                        if (e.key === 'Escape') setSwitchPasswordProfileId(null);
                      }}
                      placeholder={t('settings.profile.passwordPlaceholder')}
                      autoFocus
                      className="w-full pl-9 pr-9 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    {switchPassword && (
                      <button
                        type="button"
                        onClick={() => setSwitchPasswordVisible(!switchPasswordVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors cursor-pointer"
                      >
                        {switchPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSwitchWithPassword}
                    disabled={switchVerifying || !switchPassword.trim()}
                    className="px-3 py-2 bg-primary hover:bg-primary-dark rounded-lg text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {switchVerifying ? '...' : 'OK'}
                  </button>
                  <button
                    onClick={() => setSwitchPasswordProfileId(null)}
                    className="px-2 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  {switchPasswordError && (
                    <span className="text-[10px] text-red-400">{switchPasswordError}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new profile — navigates to dedicated page */}
      <div className="mt-3">
        <button
          onClick={() => navigate('create-profile')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-all w-full cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('settings.profile.newProfile')}
        </button>
      </div>

      <Divider />

      {/* Storage path */}
      <SectionTitle>{t('settings.profile.storage')}</SectionTitle>
      <p className="text-[11px] text-gray-500 mb-4">
        {t('settings.profile.storageHint')}
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
          <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-300 truncate flex-1">{storagePath || t('common.loading')}</span>
        </div>
        {storageError && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-400">{storageError}</span>
          </div>
        )}
        <button
          onClick={handleChangeStoragePath}
          disabled={isChangingStorage}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm text-white bg-primary hover:bg-primary-dark rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isChangingStorage ? 'Changement en cours...' : 'Changer le dossier de stockage'}
        </button>
        <p className="text-[10px] text-gray-600">
          Attention : Changer le dossier de stockage déplacera toutes vos données vers le nouveau dossier.
        </p>
      </div>

      {/* Crop modal */}
      {cropImage && (
        <ImageCropModal
          imageDataUrl={cropImage}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropImage(null)}
        />
      )}
    </>
  );
};

export default ProfileSection;
