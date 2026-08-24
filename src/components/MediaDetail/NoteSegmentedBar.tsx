import React, { useState, useRef } from 'react';

type Segment = {
  fillPct: number;
  segColor: string;
  filled: boolean;
  partial: boolean;
  segMin: number;
  segMax: number;
  segCategory: string;
};

interface NoteSegmentedBarProps {
  segments: Segment[];
}

const NoteSegmentedBar: React.FC<NoteSegmentedBarProps> = ({ segments }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (i: number, e: React.MouseEvent<HTMLDivElement>) => {
    setHoveredIndex(i);
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const segRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const centerX = segRect.left + segRect.width / 2 - containerRect.left;
      setTooltipX(centerX);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-0.5">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm overflow-hidden relative cursor-default"
            style={{
              height: hoveredIndex === i ? 10 : 8,
              backgroundColor: 'rgba(255,255,255,0.06)',
              transition: 'height 0.1s ease',
              transformOrigin: 'bottom',
            }}
            onMouseEnter={(e) => handleMouseEnter(i, e)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {seg.fillPct > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${seg.fillPct}%`,
                  backgroundColor: seg.segColor,
                  boxShadow: seg.filled && hoveredIndex === i ? `0 0 6px ${seg.segColor}99` : seg.filled ? `0 0 3px ${seg.segColor}44` : undefined,
                  opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.45 : 1,
                  transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {hoveredIndex !== null && (() => {
        const seg = segments[hoveredIndex];
        return (
          <div
            className="absolute top-full mt-1.5 z-20 pointer-events-none"
            style={{ left: tooltipX, transform: 'translateX(-50%)' }}
          >
            <div className="flex justify-center mb-0.5">
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: `5px solid ${seg.segColor}50`,
              }} />
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap shadow-xl"
              style={{
                backgroundColor: '#1a1a2e',
                color: seg.segColor,
                border: `1px solid ${seg.segColor}50`,
              }}
            >
              <span className="text-white/35">{seg.segMin}–{seg.segMax - 1}</span>
              <span className="text-white/20">·</span>
              <span>{seg.segCategory}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default NoteSegmentedBar;
