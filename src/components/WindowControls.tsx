import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

const appWindow = getCurrentWindow();

/* ================================================================== */
/*  Windows style: ─  □  ✕  with subtle hover backgrounds             */
/* ================================================================== */
const WindowsControls: React.FC = () => {
  const { t } = useTranslation();
  const isMaximized = useProfileSettingsStore((s) => s.window.isMaximized);
  const setIsMaximized = useProfileSettingsStore((s) => s.setIsMaximized);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error('Failed to check window state:', error);
      }
    };

    // Check initial state
    checkMaximized();

    // Listen for window state changes
    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(fn => fn?.());
    };
  }, [setIsMaximized]);

  return (
    <div className="flex items-stretch h-9">
      <button
        onClick={() => appWindow.minimize()}
        className="flex items-center justify-center w-[46px] h-full text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        aria-label={t('windowControls.minimize')}
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="flex items-center justify-center w-[46px] h-full text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        aria-label={t('windowControls.maximize')}
      >
        {isMaximized ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Carré avant — bas à gauche */}
            <rect x="1" y="4" width="9" height="9" rx="1.2"
              stroke="currentColor" strokeWidth="1.3" fill="none" />
            {/* Carré arrière — bord haut + coins arrondis + bord droit */}
            <path d="M4 3.5 L4 2.2 Q4 1 5.2 1 L11.8 1 Q13 1 13 2.2 L13 8.8 Q13 10 11.8 10 L10 10"
              stroke="currentColor" strokeWidth="1.3" fill="none"
              strokeLinecap="butt"/>
          </svg>
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={() => appWindow.close()}
        className="flex items-center justify-center w-[46px] h-full text-gray-300 hover:bg-[#c42b1c] hover:text-white transition-colors cursor-pointer"
        aria-label={t('windowControls.close')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ================================================================== */
/*  macOS style: colored traffic-light dots (same size as hybrid)      */
/*  Order: close, minimize, maximize (native macOS order)              */
/*  Positioned LEFT via TitleBar                                       */
/* ================================================================== */
const MacOSControls: React.FC = () => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 px-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => appWindow.close()}
        className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.close')}
      >
        {isHovered && <X className="w-2 h-2 text-black/60 stroke-[3]" />}
      </button>
      <button
        onClick={() => appWindow.minimize()}
        className="w-3.5 h-3.5 rounded-full bg-[#febc2e] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.minimize')}
      >
        {isHovered && <Minus className="w-2 h-2 text-black/60 stroke-[3]" />}
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="w-3.5 h-3.5 rounded-full bg-[#28c840] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.maximize')}
      >
        {isHovered && <Maximize2 className="w-1.5 h-1.5 text-black/60 stroke-[3]" />}
      </button>
    </div>
  );
};

/* ================================================================== */
/*  Hybrid style: colored dots + icons on hover                        */
/*  Order: minimize, maximize, close (Windows order)                   */
/* ================================================================== */
const HybridControls: React.FC = () => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2.5 px-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => appWindow.minimize()}
        className="w-3.5 h-3.5 rounded-full bg-[#febc2e] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.minimize')}
      >
        {isHovered && <Minus className="w-2 h-2 text-black/70 stroke-[3]" />}
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="w-3.5 h-3.5 rounded-full bg-[#28c840] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.maximize')}
      >
        {isHovered && <Maximize2 className="w-1.5 h-1.5 text-black/70 stroke-[3]" />}
      </button>
      <button
        onClick={() => appWindow.close()}
        className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] flex items-center justify-center transition-all hover:brightness-110 cursor-pointer shadow-sm"
        aria-label={t('windowControls.close')}
      >
        {isHovered && <X className="w-2 h-2 text-black/70 stroke-[3]" />}
      </button>
    </div>
  );
};

/* ================================================================== */
/*  Main export — renders the selected style                           */
/* ================================================================== */
const WindowControls: React.FC = () => {
  const style = useProfileSettingsStore((s) => s.personalization.windowControlsStyle);

  switch (style) {
    case 'macos':
      return <MacOSControls />;
    case 'hybrid':
      return <HybridControls />;
    case 'windows':
    default:
      return <WindowsControls />;
  }
};

export default WindowControls;
