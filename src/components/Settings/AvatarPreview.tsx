import React from 'react';
import { getDefaultAvatar } from '@/lib/default-avatars';

const AvatarPreview: React.FC<{
  avatarId: string;
  customDataUrl: string | null;
  size?: number;
  className?: string;
}> = ({ avatarId, customDataUrl, size = 80, className = '' }) => {
  if (avatarId === 'custom' && customDataUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img src={customDataUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  const avatar = getDefaultAvatar(avatarId);
  if (!avatar) return null;

  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size, background: avatar.bgGradient }}
      dangerouslySetInnerHTML={{ __html: avatar.svg }}
    />
  );
};

export default AvatarPreview;
