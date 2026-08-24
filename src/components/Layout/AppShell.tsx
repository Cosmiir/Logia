import React from 'react';
import TitleBar from '@/components/TitleBar';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Mode immersif : le TitleBar devient un overlay absolute transparent
   * (z-50) et le contenu démarre à top:0, derrière les window controls.
   * Utilisé par les pages à hero pleine largeur (ex: MediaDetail).
   */
  immersive?: boolean;
}

/**
 * AppShell component - Wrapper principal pour toutes les pages
 * Gère la structure globale : h-screen, flex-col, overflow
 * Applique le fond cosmic mesh et les styles globaux
 */
export const AppShell: React.FC<AppShellProps> = ({ children, className = '', immersive = false }) => {
  return (
    <div
      className={`h-screen flex flex-col overflow-hidden bg-fixed font-display text-white select-none selection:bg-primary/50 ${className}`}
      style={{ background: 'var(--theme-gradient)' }}
    >
      <div className="relative z-10 flex flex-col h-full">
        <TitleBar overlay={immersive} />
        {/* Wrapper relatif positionné sous le TitleBar : un SharedHeader
            "transparent" (absolute top-0) s'aligne sur la zone de contenu et
            ne remonte pas derrière le TitleBar.
            En mode immersif, le contenu démarre à top:0 (derrière le TitleBar
            overlay) pour laisser remonter le hero derrière les window controls. */}
        <div className="relative flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};
