import React, { useState, useCallback } from 'react';
import i18next from 'i18next';
import { ChevronDown } from 'lucide-react';
import MarkdownViewer from '@/components/MarkdownEditor/MarkdownViewer';

const SYNOPSIS_COLLAPSED_HEIGHT = 140; // px ~ 5-6 lines

interface SynopsisSectionProps {
  synopsis: string;
}

export const SynopsisSection: React.FC<SynopsisSectionProps> = ({ synopsis }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(true);

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const tooTall = node.scrollHeight > SYNOPSIS_COLLAPSED_HEIGHT + 20;
      setNeedsExpand(tooTall);
    }
  }, []);

  return (
    <>
      <style>{`
        .hero-synopsis-markdown .yfm,
        .hero-synopsis-markdown .yfm p,
        .hero-synopsis-markdown .yfm span,
        .hero-synopsis-markdown .yfm li,
        .hero-synopsis-markdown .yfm a {
          color: rgba(255,255,255,0.88) !important;
          font-weight: 400 !important;
          letter-spacing: 0 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 4px 10px rgba(0,0,0,0.55) !important;
        }
      `}</style>
      <div className="mb-4 max-w-xl">
        <div className="relative">
          {/* Content with animated height + mask fade when collapsed */}
          <div
            className="overflow-hidden"
            style={{
              maxHeight: expanded || !needsExpand ? 2000 : SYNOPSIS_COLLAPSED_HEIGHT,
              transition: needsExpand ? 'max-height 0.5s ease-in-out' : 'none',
              WebkitMaskImage: needsExpand && !expanded
                ? 'linear-gradient(to bottom, black 85%, transparent 100%)'
                : 'none',
              maskImage: needsExpand && !expanded
                ? 'linear-gradient(to bottom, black 85%, transparent 100%)'
                : 'none',
            }}
          >
            <div ref={contentRef}>
              <div className="hero-synopsis-markdown">
                <MarkdownViewer
                  content={synopsis}
                  className="text-[13.5px] leading-relaxed yfm"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Expand / collapse button */}
        {needsExpand && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer group"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
          >
            <span>{expanded ? i18next.t('mediaDetail.collapse') : i18next.t('mediaDetail.readMore')}</span>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-y-0.5"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        )}
      </div>
    </>
  );
};