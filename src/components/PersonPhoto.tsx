import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #f68084 0%, #a6c0fe 100%)',
];

export function getPersonGradient(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return GRADIENTS[sum % GRADIENTS.length];
}

export function getPersonPhotoUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  return convertFileSrc(path);
}

interface PersonPhotoProps {
  name: string;
  photoPath?: string | null;
  className?: string;
  widthClass?: string;
  textSize?: string;
}

/** Portrait 9:16 with rounded corners */
export const PersonPhoto: React.FC<PersonPhotoProps> = ({
  name,
  photoPath,
  className = '',
  widthClass = 'w-16',
  textSize = 'text-lg',
}) => {
  const url = getPersonPhotoUrl(photoPath);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`${widthClass} aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center text-white font-bold shadow-md shrink-0 select-none relative ${className}`}
      style={!url ? { background: getPersonGradient(name) } : undefined}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover object-top"
          draggable={false}
        />
      ) : (
        <span className={textSize}>{initial}</span>
      )}
      {/* Absolute border overlay to prevent anti-aliasing / bleed issues */}
      <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none" />
    </div>
  );
};
