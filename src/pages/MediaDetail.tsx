import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  ArrowLeft,
  Pencil,
  Clock,
  Calendar,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Plus,
  Minus,
  Tag,
  Paperclip,
  FileText,
  Download,
  BookOpen,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { PersonPhoto } from '@/components/PersonPhoto';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { save } from '@tauri-apps/plugin-dialog';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import MarkdownViewer from '@/components/MarkdownEditor/MarkdownViewer';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useFiltersStore } from '@/stores/useFiltersStore';
import { useMediaDetail, useSimilarMedia, useUpdateMedia } from '@/hooks/useMedia';
import { useCollections } from '@/hooks/useCollections';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { MangaReader } from '@/components/MangaReader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateFr, formatProgression, formatFileSize } from '@/lib/utils';
import { getRatingColor, getRatingCategory } from '@/utils/ratingColors';
import { MEDIA_STATUS_LABELS, MEDIA_STATUS_COLORS, PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';
import { MAX_MATCHING_GENRES } from '@/lib/constants';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */
// These maps are functions so labels are resolved via i18next at call time
const EXTRA_MEDIA_STATUS: Record<string, { label: () => string; color: string }> = {
  hiatus: { label: () => i18next.t('media.status.hiatus'), color: '#f59e0b' },
  cancelled: { label: () => i18next.t('media.status.cancelled'), color: '#ef4444' },
};

const getMediaStatusInfo = (status: string): { label: string; color: string } => {
  if (status in EXTRA_MEDIA_STATUS) {
    const extra = EXTRA_MEDIA_STATUS[status];
    return { label: extra.label(), color: extra.color };
  }
  return {
    label: MEDIA_STATUS_LABELS[status as keyof typeof MEDIA_STATUS_LABELS] ?? status,
    color: MEDIA_STATUS_COLORS[status as keyof typeof MEDIA_STATUS_COLORS] ?? '#ffffff',
  };
};

const getProgressStatusInfo = (status: string): { label: string; color: string } => ({
  label: PROGRESS_STATUS_LABELS[status as keyof typeof PROGRESS_STATUS_LABELS] ?? status,
  color: PROGRESS_STATUS_COLORS[status as keyof typeof PROGRESS_STATUS_COLORS] ?? '#ffffff',
});

function parseBulletPoints(text: string): string[] {
  return text.split('\n').map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}


/* ================================================================== */
/*  Section header                                                     */
/* ================================================================== */
const SectionHeader: React.FC<{ title: string; accent: string; extra?: React.ReactNode }> = ({ title, accent, extra }) => (
  <div className="flex items-center gap-2.5 mb-5">
    <div className="w-[3px] h-5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {extra && <div className="ml-auto">{extra}</div>}
  </div>
);

/* ================================================================== */
/*  Info row                                                           */
/* ================================================================== */
const InfoRow: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-2.5">
    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-white/30" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm text-white/80">{children}</div>
    </div>
  </div>
);

/* ================================================================== */
/*  Progression + Dates — merged card with CIRCLE                       */
/* ================================================================== */
const ProgressionWithDatesCard: React.FC<{
  current: number;
  total: number;
  progressStatus?: string | null;
  progressionLabel?: string;
  pluralWithS?: boolean;
  experienceDate?: string | null;
  experienceDates?: string | null;
  dateLabel?: string | null;
  replayDateLabel?: string | null;
}> = ({ current, total, progressStatus, progressionLabel, pluralWithS, experienceDate, experienceDates, dateLabel, replayDateLabel }) => {
  const rawPct = total > 0 ? Math.round((current / total) * 100) : 0;
  // If status is COMPLETED, always show 100% regardless of current/total ratio
  const displayPct = progressStatus === 'COMPLETED' ? Math.max(100, rawPct) : rawPct;
  const statusInfo = progressStatus ? getProgressStatusInfo(progressStatus) : null;

  // Circle color logic
  const circleColor = progressStatus === 'ABANDONED'
    ? '#ef4444'
    : displayPct > 100
      ? '#a855f7'
      : displayPct >= 100
        ? '#22c55e'
        : displayPct >= 50
          ? '#3b82f6'
          : '#f97316';

  const circumference = 2 * Math.PI * 36;
  // For >100%, fill the circle completely (and show the overflow visually via color+badge)
  const strokeDashoffset = circumference - (Math.min(displayPct, 100) / 100) * circumference;

  const unitFor = (n: number) =>
    progressionLabel
      ? pluralWithS && n >= 2 ? progressionLabel + 's' : progressionLabel
      : '';

  let parsedDates: string[] = [];
  try { if (experienceDates) parsedDates = JSON.parse(experienceDates); } catch { /* ignore */ }

  const hasDates = !!experienceDate || parsedDates.length > 0;

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
      <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1">{i18next.t('common.progression')}</p>

      {/* ── Dates (horizontal wrap, sous l'intitulé) ── */}
      {hasDates && (
        <>
          <div className="flex flex-wrap gap-2">
            {experienceDate && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                <Calendar className="w-3 h-3 text-white/25 shrink-0" />
                <div>
                  <p className="text-[9px] font-semibold text-white/25 uppercase tracking-wider leading-none mb-0.5">
                    {dateLabel || i18next.t('media.experienceDate')}
                  </p>
                  <p className="text-xs font-medium text-white/70">{formatDateFr(experienceDate)}</p>
                </div>
              </div>
            )}
            {parsedDates.map((d, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                <Calendar className="w-3 h-3 text-white/25 shrink-0" />
                <div>
                  <p className="text-[9px] font-semibold text-white/25 uppercase tracking-wider leading-none mb-0.5">
                    {replayDateLabel || i18next.t('mediaDetail.newExperience')}{parsedDates.length > 1 ? ` ${i + 1}` : ''}
                  </p>
                  <p className="text-xs font-medium text-white/70">{formatDateFr(d)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="w-full h-px bg-white/[0.06]" />
        </>
      )}

      {/* ── Progression with Circle ── */}
      <div className="flex items-center gap-4">
        {/* Progress Circle */}
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} className="-rotate-90 overflow-visible">
            <circle cx={40} cy={40} r={36} stroke="rgba(255,255,255,0.08)" strokeWidth={6} fill="none" />
            <circle
              cx={40} cy={40} r={36}
              stroke={circleColor} strokeWidth={6} fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${circleColor}66)`, transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: circleColor }}>
              {displayPct}%
            </span>
          </div>
        </div>

        {/* Info: values top row, status badge bottom-right */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums leading-none text-white">{current}</span>
              <span className="text-sm text-white/25">
                {unitFor(current) && <span className="mr-0.5">{unitFor(current)}</span>}
                <span>/ {total}{unitFor(total) ? ` ${unitFor(total)}` : ''}</span>
              </span>
            </div>
            {statusInfo && (
              <span
                className="shrink-0 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, border: `1px solid ${statusInfo.color}30` }}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Synopsis expandable card                                           */
/* ================================================================== */
const SYNOPSIS_COLLAPSED_HEIGHT = 160; // px

const SynopsisCard: React.FC<{ synopsis: string; accent: string }> = ({ synopsis, accent }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(true);

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const tooTall = node.scrollHeight > SYNOPSIS_COLLAPSED_HEIGHT + 20;
      setNeedsExpand(tooTall);
    }
  }, []);

  return (
    <div className="glass-card rounded-2xl p-6 mb-6">
      <SectionHeader title={i18next.t('mediaDetail.synopsis')} accent={accent} />

      <div className="relative">
        {/* Content with animated height + mask fade when collapsed */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded || !needsExpand ? 2000 : SYNOPSIS_COLLAPSED_HEIGHT,
            transition: needsExpand ? 'max-height 0.5s ease-in-out' : 'none',
            WebkitMaskImage: needsExpand && !expanded
              ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
              : 'none',
            maskImage: needsExpand && !expanded
              ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
              : 'none',
          }}
        >
          <div ref={contentRef}>
            <MarkdownViewer
              content={synopsis}
              className="text-[13px] text-white/60 leading-relaxed yfm"
            />
          </div>
        </div>

      </div>

      {/* Expand / collapse button */}
      {needsExpand && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/30 hover:text-white/70 transition-colors cursor-pointer group"
        >
          <span>{expanded ? 'Réduire' : 'Lire la suite'}</span>
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-300"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Note segmented bar with hover tooltip                             */
/* ================================================================== */
type Segment = {
  fillPct: number;
  segColor: string;
  filled: boolean;
  partial: boolean;
  segMin: number;
  segMax: number;
  segCategory: string;
};

const NoteSegmentedBar: React.FC<{ segments: Segment[] }> = ({ segments }) => {
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
      {/* Segments */}
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

      {/* Tooltip — pops downward, arrow points up, centered on segment */}
      {hoveredIndex !== null && (() => {
        const seg = segments[hoveredIndex];
        return (
          <div
            className="absolute top-full mt-1.5 z-20 pointer-events-none"
            style={{ left: tooltipX, transform: 'translateX(-50%)' }}
          >
            {/* Arrow pointing up */}
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

/* ================================================================== */
/*  Gallery Lightbox (unchanged)                                       */
/* ================================================================== */
const Lightbox: React.FC<{
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  setIndex: (i: number) => void;
}> = ({ images, index, onClose, onPrev, onNext, setIndex }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [wasMaximizedBeforeFullscreen, setWasMaximizedBeforeFullscreen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); }, [index]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      const appWindow = getCurrentWindow();
      const fs = await appWindow.isFullscreen();
      setIsFullscreen(fs);
      unlisten = await appWindow.onResized(async () => {
        const fs = await appWindow.isFullscreen();
        setIsFullscreen(fs);
      });
    };
    setup().catch(console.error);
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          const appWindow = getCurrentWindow();
          appWindow.setFullscreen(false).then(async () => {
            setIsFullscreen(false);
            if (wasMaximizedBeforeFullscreen) { await appWindow.maximize(); setWasMaximizedBeforeFullscreen(false); }
          });
        } else { onClose(); }
      }
      else if (e.key === 'ArrowLeft' && zoom === 1) onPrev();
      else if (e.key === 'ArrowRight' && zoom === 1) onNext();
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(5, z + 0.25));
      else if (e.key === '-') setZoom(z => { const nz = Math.max(1, z - 0.25); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });
      else if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360);
      else if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, zoom, isFullscreen, wasMaximizedBeforeFullscreen]);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(z => { const nz = Math.max(1, Math.min(5, z + delta)); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });
    };
    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setHasDragged(false);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;
    if (Math.abs(newX - pan.x) > 5 || Math.abs(newY - pan.y) > 5) setHasDragged(true);
    setPan({ x: newX, y: newY });
  };
  const handleMouseUp = () => setIsPanning(false);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); } else setZoom(2.5);
  };

  const toggleFullscreen = async () => {
    try {
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      if (!current) {
        const isMax = await appWindow.isMaximized();
        setWasMaximizedBeforeFullscreen(isMax);
        if (isMax) await appWindow.unmaximize();
      }
      await appWindow.setFullscreen(!current);
      setIsFullscreen(!current);
      if (current && wasMaximizedBeforeFullscreen) { await appWindow.maximize(); setWasMaximizedBeforeFullscreen(false); }
    } catch (err) { console.error('Fullscreen error:', err); }
  };

  const handleDownload = async () => {
    try {
      const srcPath = images[index];
      const fileName = srcPath.split(/[\\/]/).pop() || 'image.webp';
      const ext = fileName.split('.').pop() || 'webp';
      const destPath = await save({ defaultPath: fileName, filters: [{ name: 'Image', extensions: [ext] }] });
      if (destPath) await invoke('download_attachment', { sourcePath: srcPath, destPath });
    } catch (err) { console.error('Download error:', err); }
  };

  const canGoPrev = index > 0;
  const canGoNext = index < images.length - 1;
  const navBtnStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' };

  if (isFullscreen) {
    return (
      <div
        ref={wheelRef}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: '#000', cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        <img src={convertFileSrc(images[index])} alt="" onDoubleClick={handleDoubleClick} draggable={false}
          className="select-none pointer-events-none"
          style={{ maxHeight: '100vh', maxWidth: '100vw', objectFit: 'contain', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`, transition: isPanning ? 'none' : 'transform 0.15s ease' }}
        />
        {canGoPrev && zoom === 1 && (
          <button onClick={onPrev} className="absolute left-5 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer" style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canGoNext && zoom === 1 && (
          <button onClick={onNext} className="absolute right-5 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer" style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>{index + 1} / {images.length}</div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
          Échap pour quitter · Double-clic pour zoomer
        </div>
        <button onClick={toggleFullscreen} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'rgba(0,0,0,0.96)' }}>
      <div
        ref={wheelRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onClick={(e) => { if (e.target === e.currentTarget && !hasDragged) onClose(); setHasDragged(false); }}
      >
        <img src={convertFileSrc(images[index])} alt="" onDoubleClick={handleDoubleClick} draggable={false}
          className="select-none pointer-events-none"
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`, transition: isPanning ? 'none' : 'transform 0.15s ease', userSelect: 'none' }}
        />
        {canGoPrev && zoom === 1 && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer" style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canGoNext && zoom === 1 && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer" style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 flex flex-col gap-0" style={{ background: 'rgba(12,12,18,0.98)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.3)', minWidth: 36 }}>
            {index + 1}<span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>{images.length}
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
          <button onClick={() => setZoom(z => { const nz = Math.max(1, z - 0.25); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; })} className="w-6 h-6 flex items-center justify-center rounded cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 relative h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', minWidth: 80 }}>
            <div className="absolute left-0 top-0 h-full rounded-full pointer-events-none" style={{ width: `${((zoom - 1) / 4) * 100}%`, background: 'linear-gradient(90deg, var(--theme-accent-dark), var(--theme-accent))' }} />
            <input type="range" min={1} max={5} step={0.05} value={zoom} onChange={(e) => { const nz = parseFloat(e.target.value); setZoom(nz); if (nz === 1) setPan({ x: 0, y: 0 }); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ margin: 0 }} />
          </div>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="w-6 h-6 flex items-center justify-center rounded cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold tabular-nums shrink-0 cursor-pointer" style={{ color: zoom > 1 ? 'var(--theme-accent)' : 'rgba(255,255,255,0.2)', minWidth: 34 }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title={i18next.t('mediaDetail.clickToReset')}>
            {Math.round(zoom * 100)}%
          </span>
          {[2, 3].map(p => (
            <button key={p} onClick={() => { setZoom(p); if (p === 1) setPan({ x: 0, y: 0 }); }} className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all shrink-0"
              style={{ color: Math.round(zoom) === p ? 'var(--theme-accent)' : 'rgba(255,255,255,0.25)', background: Math.round(zoom) === p ? 'rgba(var(--theme-accent-rgb),0.12)' : 'transparent', border: `1px solid ${Math.round(zoom) === p ? 'rgba(var(--theme-accent-rgb),0.3)' : 'rgba(255,255,255,0.08)'}` }}>
              {p}×
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }} title={i18next.t('mediaDetail.rotateClockwise')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6" /><path d="M21.34 15.57a10 10 0 1 1-.57-8.38" />
            </svg>
          </button>
          <button onClick={toggleFullscreen} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }} title={i18next.t('mediaDetail.fullscreen')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V3h4" /><path d="M17 3h4v4" /><path d="M21 17v4h-4" /><path d="M7 21H3v-4" />
            </svg>
          </button>
          <button onClick={handleDownload} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }} title={i18next.t('mediaDetail.saveAs')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }} title={i18next.t('mediaDetail.closeEscape')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {images.map((path, i) => (
              <button key={i} onClick={() => setIndex(i)} className="shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all"
                style={{ width: 40, height: 60, outline: i === index ? '2px solid var(--theme-accent)' : '2px solid transparent', outlineOffset: 2, opacity: i === index ? 1 : 0.4, transform: i === index ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.15s ease' }}>
                <img src={convertFileSrc(path)} alt="" className="w-full h-full object-cover select-none pointer-events-none" draggable={false} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */
const MediaDetail: React.FC = () => {
  const { t } = useTranslation();
  const { viewingMediaId, goBack, navigateToMediaCreate, navigateToMediaDetail, navigate } = useNavigationStore();
  const { filterByPerson } = useFiltersStore();
  const { data: media, isLoading } = useMediaDetail(viewingMediaId);

  const handlePersonClick = (personId: number) => {
    filterByPerson(personId);
    navigate('library');
  };
  const { data: collections } = useCollections();
  const { data: similarMedia = [] } = useSimilarMedia(viewingMediaId, media?.collection_id ?? null, 5);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeReader, setActiveReader] = useState<{ path: string; name: string } | null>(null);
  const [progressPrompt, setProgressPrompt] = useState<{ filename: string; volumeNum: number } | null>(null);
  const updateMedia = useUpdateMedia();

  // Calculate current media's matching genre IDs once (outside the map loop)
  const currentMatchingGenreIds = useMemo(
    () => new Set((media?.genres ?? [])
      .filter(g => (g.position ?? 0) < MAX_MATCHING_GENRES)
      .map(g => g.id)
    ),
    [media?.genres]
  );

  if (isLoading) {
    return (
      <AppShell>
        <SharedHeader activePage="media-detail" />
        <MainContent>
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </MainContent>
      </AppShell>
    );
  }

  if (!media) {
    return (
      <AppShell>
        <SharedHeader activePage="media-detail" />
        <MainContent>
          <div className="text-center py-32 text-white/30">{t('mediaDetail.mediaNotFound')}</div>
        </MainContent>
      </AppShell>
    );
  }

  const collection = (collections as import('@/types').Collection[] | undefined)?.find((c: import('@/types').Collection) => c.id === media.collection_id);
  const CollIcon = collection ? getCollectionIconComponent(collection.name, collection.icon) : null;
  const collColor = collection?.color || '#8b5cf6';

  const hasProgress = media.progress_current != null && media.progress_total != null && media.progress_total > 0;

  const coverSrc = media.cover_image ? `${convertFileSrc(media.cover_image)}?t=${media.updated_at}` : null;
  const galleryImages = media.images?.map(i => i.full_path) ?? [];
  const attachments = media.attachments ?? [];

  const handleAttachmentDownload = async (path: string, fileName: string) => {
    try {
      const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
      const destPath = await save({
        defaultPath: fileName,
        filters: ext ? [{ name: 'Fichier', extensions: [ext] }] : undefined,
      });
      if (destPath) await invoke('download_attachment', { sourcePath: path, destPath });
    } catch (err) {
      console.error('Attachment download error:', err);
    }
  };

  const parseNumberFromFilename = (filename: string): number | null => {
    const match = filename.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    return null;
  };

  const isCbzFile = (name: string) => {
    const ext = name.toLowerCase().split('.').pop();
    return ext === 'cbz' || ext === 'zip';
  };

  const handleReadingComplete = (filename: string) => {
    const volumeNum = parseNumberFromFilename(filename);
    if (volumeNum !== null && (media.progress_current === null || media.progress_current < volumeNum)) {
      setProgressPrompt({ filename, volumeNum });
    }
  };

  // Accents par section
  const ACCENT_SIMILAIRES = 'var(--theme-accent)';
  const ACCENT_SYNOPSIS = '#60a5fa';
  const ACCENT_EXPERIENCE = '#f472b6';
  const ACCENT_GALERIE = '#34d399';
  const ACCENT_CREDITS = '#a78bfa';

  return (
    <AppShell className="select-text">
      <SharedHeader activePage="media-detail" />
      <MainContent>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={goBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition-all cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-white truncate max-w-lg">{media.title}</h1>
          </div>
          <button type="button" onClick={() => navigateToMediaCreate(media.collection_id, media.id)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-xl text-sm font-semibold text-white transition-all cursor-pointer">
            <Pencil className="w-4 h-4" />
            Modifier
          </button>
        </div>

        {/* ── Section 1: Hero card (Cover + metadata) + Similaires ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Left 2/3: Hero glass card */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex gap-6">
            {/* Cover */}
            <div className="shrink-0">
              {coverSrc ? (
                <div className="w-[160px] h-[240px] rounded-xl overflow-hidden shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setLightboxIndex(0)}>
                  <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-[160px] h-[240px] rounded-xl bg-gradient-to-br from-white/8 to-white/3 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-white/10" />
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Collection badge */}
              {collection && (
                <div className="flex items-center gap-2 mb-2">
                  {CollIcon && <CollIcon className="w-3.5 h-3.5" style={{ color: collColor }} />}
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: collColor }}>{collection.name}</span>
                </div>
              )}

              {/* Title + creator */}
              <h2 className="text-2xl font-bold text-white mb-1 leading-tight">{media.title}</h2>
              {media.creator && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {media.creator.split(';').map(c => c.trim()).filter(Boolean).map((cName, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/60"
                    >
                      {cName}
                    </span>
                  ))}
                </div>
              )}

              {/* Info rows */}
              <div className="space-y-0">
                {media.release_date && (
                  <InfoRow icon={Calendar} label={t('common.releaseDate')}>
                    {formatDateFr(media.release_date)}
                  </InfoRow>
                )}
                {(media.progress_total != null && media.progress_total > 0) && (
                  <InfoRow icon={Clock} label={collection?.duration_label || 'Durée totale'}>
                    {formatProgression(media.progress_total, collection?.progression_label, collection?.plural_with_s ?? false)}
                  </InfoRow>
                )}
                {media.media_status && (() => {
                  const msInfo = getMediaStatusInfo(media.media_status);
                  return (
                    <InfoRow icon={Activity} label={t('common.status')}>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{
                          backgroundColor: `${msInfo.color}20`,
                          color: msInfo.color,
                          border: `1px solid ${msInfo.color}30`,
                        }}
                      >
                        {msInfo.label}
                      </span>
                    </InfoRow>
                  );
                })()}
              </div>

              {/* Genres with label */}
              {media.genres && media.genres.length > 0 && (
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3 h-3 text-white/25" />
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">{t('common.genres')}</p>
                  </div>
                  {/* Matching genres (position < MAX_MATCHING_GENRES) */}
                  <div className="flex flex-wrap gap-1.5">
                    {media.genres.filter(g => (g.position ?? 0) < MAX_MATCHING_GENRES).map(g => (
                      <span
                        key={g.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${g.color}20`, color: `color-mix(in srgb, ${g.color} 75%, white)`, border: `1px solid ${g.color}50` }}
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                  {/* Filter genres (position >= MAX_MATCHING_GENRES) */}
                  {media.genres.some(g => (g.position ?? 0) >= MAX_MATCHING_GENRES) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {media.genres.filter(g => (g.position ?? 0) >= MAX_MATCHING_GENRES).map(g => (
                        <span
                          key={g.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: `${g.color}15`, color: `color-mix(in srgb, ${g.color} 50%, white)`, border: `1px solid ${g.color}40` }}
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right 1/3: Médias similaires */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-5 h-full">
              <SectionHeader title={t('mediaDetail.similarMedia')} accent={ACCENT_SIMILAIRES} />
              {similarMedia.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {similarMedia.slice(0, 4).map((similar) => {
                    // Filter similar media's genres to only include matching genres (position < 9) that are also in current media's matching set
                    const commonGenres = similar.genres?.filter(
                      g => (g.position ?? 0) < MAX_MATCHING_GENRES && currentMatchingGenreIds.has(g.id)
                    ) || [];
                    return (
                      <div key={similar.id} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                        onClick={() => navigateToMediaDetail(similar.id)}>
                        <div className="shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-white/5">
                          {similar.cover_image ? (
                            <img src={`${convertFileSrc(similar.cover_image)}?t=${similar.updated_at}`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{similar.title}</p>
                          {commonGenres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {commonGenres.map(g => (
                                <span key={g.id} className="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                  style={{ backgroundColor: `${g.color}25`, color: `color-mix(in srgb, ${g.color} 75%, white)`, border: `1px solid ${g.color}50` }}>
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {similar.user_rating != null && (
                          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: getRatingColor(similar.user_rating), boxShadow: `0 2px 6px ${getRatingColor(similar.user_rating)}55` }}>
                            {similar.user_rating}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-xs text-white/30">{t('mediaDetail.noSimilarMedia')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Synopsis ── */}
        {media.synopsis && (
          <SynopsisCard synopsis={media.synopsis} accent={ACCENT_SYNOPSIS} />
        )}

        {/* ── Section: Crédits ── */}
        {media.credits && media.credits.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-6">
            <SectionHeader title={t('common.credits')} accent={ACCENT_CREDITS} />
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 custom-scrollbar">
              {media.credits.map((credit, i) => (
                <div
                  key={i}
                  onClick={() => handlePersonClick(credit.person_id)}
                  className="flex flex-col items-center shrink-0 w-[100px] group/item cursor-pointer"
                >
                  <PersonPhoto
                    name={credit.name}
                    photoPath={credit.photo_path}
                    widthClass="w-[100px]"
                    textSize="text-xl"
                    className="mb-2 transition-transform duration-300 group-hover/item:scale-105"
                  />
                  <span className="text-[12px] font-bold text-white text-center line-clamp-2 w-full mb-0.5" title={credit.name}>
                    {credit.name}
                  </span>
                  {credit.role && (
                    <span className="text-[11px] text-white/40 text-center line-clamp-2 w-full" title={credit.role}>
                      {credit.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 3: Mon expérience ── */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <SectionHeader title={t('mediaDetail.myExperience')} accent={ACCENT_EXPERIENCE} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Left 2/3: Avis uniquement */}
            <div className="lg:col-span-2">
              {media.user_review ? (
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">{t('mediaCreate.review')}</p>
                  <MarkdownViewer content={media.user_review} className="text-sm text-white/70 leading-relaxed yfm" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded-xl min-h-[200px]">
                  <p className="text-sm text-white/30">{t('mediaDetail.noReview')}</p>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-300/70" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{i18next.t('common.attachments')}</p>
                    <span className="ml-auto text-[10px] text-white/20">{attachments.length}</span>
                  </div>
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-white/35" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white/70 truncate" title={attachment.original_name}>{attachment.original_name}</p>
                          <p className="text-[10px] text-white/25">{formatFileSize(attachment.size_bytes)}</p>
                        </div>
                        {isCbzFile(attachment.original_name) && (
                          <button
                            type="button"
                            onClick={() => setActiveReader({ path: attachment.stored_path, name: attachment.original_name })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400/70 hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                            title={t('mangaReader.read')}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAttachmentDownload(attachment.stored_path, attachment.original_name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                          title={t('mediaDetail.download')}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 1/3: Progression+Dates + Points +/- */}
            <div className="lg:col-span-1 space-y-4">

              {/* Progression + Dates fusionnés */}
              {hasProgress && (
                <ProgressionWithDatesCard
                  current={media.progress_current!}
                  total={media.progress_total!}
                  progressStatus={media.progress_status}
                  progressionLabel={collection?.progression_label}
                  pluralWithS={collection?.plural_with_s}
                  experienceDate={media.experience_date}
                  experienceDates={media.experience_dates}
                  dateLabel={collection?.date_label}
                  replayDateLabel={collection?.replay_date_label}
                />
              )}

              {/* Note */}
              {media.user_rating != null && (() => {
                const ratingColor = getRatingColor(media.user_rating);
                const ratingCategory = getRatingCategory(media.user_rating);
                const rating = media.user_rating;

                // 20 segments of 5pts each — matches ratingColors tiers exactly
                const segments = Array.from({ length: 20 }, (_, i) => {
                  const segMin = i * 5;
                  const segMax = segMin + 5;
                  const filled = rating >= segMax;
                  const partial = !filled && rating > segMin;
                  const fillPct = partial ? ((rating - segMin) / 5) * 100 : filled ? 100 : 0;
                  const segColor = getRatingColor(segMin + 2.5);
                  const segCategory = getRatingCategory(segMin + 2.5);
                  return { fillPct, segColor, filled, partial, segMin, segMax, segCategory };
                });

                return (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-3">{t('common.rating')}</p>

                    {/* Top row: big number + category badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black tabular-nums leading-none" style={{ color: ratingColor }}>
                          {rating}
                        </span>
                        <span className="text-sm text-white/20 font-medium">/100</span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `${ratingColor}20`, color: ratingColor, border: `1px solid ${ratingColor}40` }}
                      >
                        {ratingCategory}
                      </span>
                    </div>

                    {/* Segmented bar with hover tooltip */}
                    <NoteSegmentedBar segments={segments} />

                    {/* Scale labels */}
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] text-white/15 tabular-nums">0</span>
                      <span className="text-[9px] text-white/15 tabular-nums">50</span>
                      <span className="text-[9px] text-white/15 tabular-nums">100</span>
                    </div>
                  </div>
                );
              })()}

              {/* Points positifs */}
              {media.positive_points && (
                <div className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-400/70" />
                    <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider">{i18next.t('mediaDetail.positivePoints')}</p>
                  </div>
                  <ul className="space-y-1">
                    {parseBulletPoints(media.positive_points).map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="text-emerald-400/50 mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Points négatifs */}
              {media.negative_points && (
                <div className="p-4 rounded-xl border border-red-500/15 bg-red-500/[0.03]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsDown className="w-3.5 h-3.5 text-red-400/70" />
                    <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider">{i18next.t('mediaDetail.negativePoints')}</p>
                  </div>
                  <ul className="space-y-1">
                    {parseBulletPoints(media.negative_points).map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="text-red-400/50 mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Section 4: Galerie ── */}
        {galleryImages.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8">
            <SectionHeader
              title={t('mediaCreate.gallery')}
              accent={ACCENT_GALERIE}
              extra={<span className="text-xs text-white/25">{i18next.t('common.image', { count: galleryImages.length })}</span>}
            />
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {galleryImages.map((path, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all hover:scale-[1.02]"
                  onClick={() => setLightboxIndex(i)}>
                  <img src={convertFileSrc(path)} alt="" className="w-full h-full object-cover select-none" draggable={false} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}

      </MainContent>

      {/* Lightbox */}
      {lightboxIndex !== null && galleryImages.length > 0 && (
        <Lightbox
          images={galleryImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex(i => Math.min(galleryImages.length - 1, (i ?? 0) + 1))}
          setIndex={setLightboxIndex}
        />
      )}

      {/* Manga Reader Overlay */}
      {activeReader && (
        <MangaReader
          mediaTitle={media.title}
          attachmentPath={activeReader.path}
          attachmentName={activeReader.name}
          onClose={(currentPageIndex, totalPages) => {
            const isNearEnd = currentPageIndex >= totalPages - 2 && totalPages > 2;
            if (isNearEnd) {
              handleReadingComplete(activeReader.name);
            }
            setActiveReader(null);
          }}
          onComplete={() => {
            handleReadingComplete(activeReader.name);
            setActiveReader(null);
          }}
        />
      )}

      {/* Progress Prompt Modal */}
      <AnimatePresence>
        {progressPrompt && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('mangaReader.updateProgressTitle')}</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('mangaReader.updateProgressPrompt', {
                  filename: progressPrompt.filename,
                  progress: `${progressPrompt.volumeNum} ${collection?.progression_label || ''}`
                })}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setProgressPrompt(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Passer
                </button>
                <button
                  onClick={() => {
                    updateMedia.mutate({
                      media_id: media.id,
                      progress_current: progressPrompt.volumeNum,
                    });
                    setProgressPrompt(null);
                  }}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 transition-colors cursor-pointer"
                >
                  Mettre à jour
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default MediaDetail;
