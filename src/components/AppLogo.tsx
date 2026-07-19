import React from 'react';
import logiaLogo from '@/assets/LOGIA.png';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const heightConfig = {
  sm: 'h-[24px]',
  md: 'h-[32px]',
  lg: 'h-[40px]',
};

const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const heightClass = heightConfig[size];

  return (
    <div className={`group/logo flex items-center select-none ${className}`}>
      <img
        src={logiaLogo}
        alt="LOGIA Logo"
        className={`${heightClass} w-auto object-contain transition-all duration-300 group-hover/logo:drop-shadow-[0_0_8px_rgba(217,70,239,0.3)]`}
      />
    </div>
  );
};

export default AppLogo;
