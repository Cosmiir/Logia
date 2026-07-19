import React from 'react';
import TitleBar from '@/components/TitleBar';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AppShell component - Wrapper principal pour toutes les pages
 * Gère la structure globale : h-screen, flex-col, overflow
 * Applique le fond cosmic mesh et les styles globaux
 */
export const AppShell: React.FC<AppShellProps> = ({ children, className = '' }) => {
  return (
    <div className={`h-screen flex flex-col overflow-hidden bg-fixed font-display text-white select-none selection:bg-primary/50 ${className}`} style={{ background: 'var(--theme-gradient)' }}>
      <TitleBar />
      {children}
    </div>
  );
};
