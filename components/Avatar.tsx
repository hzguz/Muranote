import React from 'react';
import { getAvatarBgClass, getAvatarEmoji } from '../utils/avatar';

interface AvatarProps {
  avatarId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClassMap = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
} as const;

const Avatar: React.FC<AvatarProps> = ({ avatarId, size = 'md', className = '' }) => {
  const emoji = getAvatarEmoji(avatarId);
  const bgClass = getAvatarBgClass(avatarId);
  const sizeClass = sizeClassMap[size];

  return (
    <div
      className={`${sizeClass} ${bgClass} rounded-full flex items-center justify-center select-none border border-black/10 ${className}`.trim()}
      aria-label="avatar"
    >
      <span role="img" aria-hidden="true" className="leading-none">
        {emoji}
      </span>
    </div>
  );
};

export default Avatar;
