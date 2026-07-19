import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, Trash2 } from 'lucide-react';
import { useProfiles, useActiveProfile, useCreateProfile, useSwitchProfile, useDeleteProfile } from '@/hooks/useProfiles';
import { getDefaultAvatar } from '@/lib/default-avatars';

interface ProfileSwitcherProps {
  onClose: () => void;
}

const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { data: profiles = [] } = useProfiles();
  const { data: activeProfile } = useActiveProfile();
  const switchProfile = useSwitchProfile();
  const createProfile = useCreateProfile();
  const deleteProfile = useDeleteProfile();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeProfile?.id) return;
    await switchProfile.mutateAsync(profileId);
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProfile.mutateAsync({ name: newName.trim() });
    setNewName('');
    setIsCreating(false);
  };

  const handleDelete = async (profileId: string) => {
    await deleteProfile.mutateAsync(profileId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="w-full">
      <div className="px-4 py-2 border-b border-white/5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('settings.profile.profiles')}</p>
      </div>

      {/* Profile list */}
      <div className="py-1 max-h-[200px] overflow-y-auto">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfile?.id;
          const avatar = getDefaultAvatar(profile.avatar_id);

          return (
            <div key={profile.id} className="group flex items-center mx-2">
              <button
                onClick={() => handleSwitch(profile.id)}
                className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary/10 text-white'
                    : 'text-text-secondary hover:bg-white/10 hover:text-white'
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{
                    background: profile.custom_avatar_data_url
                      ? `url(${profile.custom_avatar_data_url}) center/cover`
                      : avatar?.bgGradient ?? 'linear-gradient(135deg, #667eea, #764ba2)',
                  }}
                >
                  {!profile.custom_avatar_data_url && avatar && (
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: avatar.svg }} />
                  )}
                  {!profile.custom_avatar_data_url && !avatar && profile.name.charAt(0).toUpperCase()}
                </div>

                <span className="truncate text-xs font-medium">{profile.name}</span>

                {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
              </button>

              {/* Delete button (not for active or if only 1 profile) */}
              {!isActive && profiles.length > 1 && (
                confirmDeleteId === profile.id ? (
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    title={t('profileSwitcher.confirmDelete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="p-1.5 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer"
                    title={t('profileSwitcher.deleteProfile')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Create new profile */}
      <div className="border-t border-white/5 pt-1 pb-1">
        {isCreating ? (
          <div className="px-3 py-2 flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
              }}
              placeholder={t('createProfile.namePlaceholder')}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
              autoFocus
              maxLength={30}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createProfile.isPending}
              className="px-2.5 py-1.5 bg-primary/20 text-primary text-xs font-medium rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-40 cursor-pointer"
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 mx-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/10 hover:text-white transition-all w-[calc(100%-16px)] text-left rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau profil
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileSwitcher;
