import React from 'react';
import WindowControls from '@/components/WindowControls';

import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

type DragRegionStyle = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

/**
 * TitleBar — Thin strip at the very top of the window.
 * Full-width drag region + window controls (position depends on style).
 * Replaces the native Windows title bar (decorations: false).
 */
const TitleBar: React.FC = () => {
  const style = useProfileSettingsStore((s) => s.personalization.windowControlsStyle);
  const controlsOnLeft = style === 'macos';
  const isHybrid = style === 'hybrid';
  const isWindows = style === 'windows';
  const leftControlsOffset = controlsOnLeft ? '-4px' : undefined;

  const paddingClass = controlsOnLeft
    ? 'pt-1 px-10'
    : isHybrid
      ? 'pt-1 pl-10 pr-[36px]'
      : 'pt-0 pl-10 pr-0';

  const dragRegionStyle: DragRegionStyle = { WebkitAppRegion: 'drag' };
  const noDragStyle: DragRegionStyle = { WebkitAppRegion: 'no-drag' };

  return (
    <div
      data-tauri-drag-region
      className={`h-9 ${paddingClass} shrink-0 flex items-center justify-between w-full select-none z-50`}
      style={dragRegionStyle}
    >
      {/* Left slot */}
      <div
        data-tauri-drag-region
        className="flex items-center h-full gap-3"
      >
        {controlsOnLeft && (
          <div
            data-tauri-drag-region="no-drag"
            style={{ ...noDragStyle, marginLeft: leftControlsOffset }}
            className="flex items-center h-full"
          >
            <WindowControls />
          </div>
        )}
      </div>

      {/* Center — empty drag area */}
      <div data-tauri-drag-region className="flex-1 h-full" style={dragRegionStyle} />

      {/* Right slot */}
      <div
        className={`flex h-full ${controlsOnLeft ? 'items-center gap-3' : 'items-start'}`}
        data-tauri-drag-region={controlsOnLeft ? undefined : undefined}
        style={dragRegionStyle}
      >
        {!controlsOnLeft && (
          <div
            className="flex h-full self-start"
            style={{
              ...noDragStyle,
              marginRight: isWindows ? '-1px' : undefined,
            }}
          >
            <WindowControls />
          </div>
        )}
      </div>
    </div>
  );
};

export default TitleBar;
