import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import transform from '@diplodoc/transform';
import colorPlugin from '@diplodoc/color-extension';
import '@diplodoc/transform/dist/css/yfm.css';
import { transform as cutTransform } from '@diplodoc/cut-extension';
import { transform as tabsTransform } from '@diplodoc/tabs-extension';
import { transform as fileTransform } from '@diplodoc/file-extension';
import hljs from 'highlight.js';
import { cn } from '@/lib/utils';
import { useMediaDetail } from '@/hooks/useMedia';
import { useCollections } from '@/hooks/useCollections';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getRatingColor } from '@/utils/ratingColors';
import { PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

interface MediaHoverCardProps {
  mediaId: number;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const MediaHoverCard: React.FC<MediaHoverCardProps> = ({ mediaId, position, onMouseEnter, onMouseLeave }) => {
  const { t } = useTranslation();
  const { data: media, isLoading } = useMediaDetail(mediaId);
  const { data: collections } = useCollections();
  const cardRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Position adjustment on load to ensure the card stays fully within the viewport boundaries
  useEffect(() => {
    if (!cardRef.current) return;
    const cardWidth = 320;
    const cardHeight = cardRef.current.offsetHeight || 120;
    
    let top = position.top + 8;
    let left = position.left;

    if (left + cardWidth > window.innerWidth) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (top + cardHeight > window.innerHeight) {
      // position above the link if it falls off bottom
      top = position.top - cardHeight - 8;
    }
    left = Math.max(16, left);
    top = Math.max(16, top);

    setAdjustedPosition({ top, left });
  }, [position, isLoading, media]);

  if (isLoading) {
    return (
      <div
        className="fixed z-[9999] bg-[#12141f]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-3 w-[320px] pointer-events-auto transition-opacity duration-200"
        style={{
          top: adjustedPosition.top,
          left: adjustedPosition.left,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-[60px] h-[80px] bg-white/5 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
            <div className="h-3 bg-white/5 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!media) return null;

  const collection = collections?.find(c => c.id === media.collection_id);
  const collectionName = collection?.name || '';
  const collectionColor = collection?.color || '#22d3ee';
  
  const hasCover = !!media.cover_image;
  const coverUrl = hasCover ? `${convertFileSrc(media.cover_image!)}?t=${media.updated_at}` : null;
  const rating = media.user_rating;
  const ratingColor = rating ? getRatingColor(rating) : null;

  const statusInfo = media.progress_status ? {
    label: PROGRESS_STATUS_LABELS[media.progress_status] ?? media.progress_status,
    color: PROGRESS_STATUS_COLORS[media.progress_status] ?? '#ffffff'
  } : null;

  return (
    <div
      ref={cardRef}
      className="fixed z-[9999] bg-[#12141f]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-3 w-[320px] pointer-events-auto flex gap-3 text-white transition-all duration-200"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Cover Image */}
      <div className="w-[65px] h-[90px] rounded-lg overflow-hidden shrink-0 border border-white/5 bg-white/[0.02] flex items-center justify-center relative">
        {coverUrl ? (
          <img src={coverUrl} alt={media.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
            <span className="text-[10px] text-white/20 uppercase font-bold text-center px-1">{t('common.noImage')}</span>
          </div>
        )}
        {rating && (
          <div
            className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-black/40 text-white"
            style={{
              backgroundColor: ratingColor || '#6b7280',
              boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            {rating}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Collection tag */}
          {collectionName && (
            <span
              className="inline-block text-[9px] font-extrabold uppercase tracking-wider mb-1 px-1.5 py-0.5 rounded bg-white/5"
              style={{ color: collectionColor }}
            >
              {collectionName}
            </span>
          )}
          
          <h4 className="text-xs font-bold text-white truncate leading-snug" title={media.title}>
            {media.title}
          </h4>
          
          {media.creator && (
            <p className="text-[10px] text-white/40 truncate mt-0.5">
              {media.creator}
            </p>
          )}
        </div>

        {/* Status + Progress */}
        <div className="mt-2 space-y-1.5">
          {statusInfo && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/40">{t('common.status')}</span>
              <span className="font-bold text-[10px]" style={{ color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </div>
          )}

          {media.progress_total !== null && media.progress_total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] text-white/50">
                <span>{t('common.progress')}</span>
                <span>{media.progress_current} / {media.progress_total}</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(((media.progress_current || 0) / media.progress_total) * 100)}%`,
                    backgroundColor: collectionColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className }) => {
  const { navigateToMediaDetail } = useNavigationStore();
  const [hoveredMediaId, setHoveredMediaId] = useState<number | null>(null);
  const [hoverCardPosition, setHoverCardPosition] = useState({ top: 0, left: 0 });
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const renderedHtml = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      // Two-pass approach to bypass @diplodoc/transform's post-render sanitizer:
      // 1. Replace [@Title](media:ID) with unique text tokens before transform
      // 2. After transform (and sanitization), replace tokens with actual <a> HTML
      const mentionMap: Record<string, { id: string; title: string }> = {};

      const processedContent = content.replace(
        /\[@([^\]]+)\]\(media:(\d+)\)/g,
        (_match, title, id) => {
          const token = `LOGIAMEDIAMENTION${id}END`;
          mentionMap[token] = { id, title };
          return token;
        }
      );

      const { result } = transform(processedContent, {
        disableLiquid: true,
        highlight: (code: string, lang: string) => {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return hljs.highlightAuto(code).value;
        },
        plugins: [
          colorPlugin,
          cutTransform({ bundle: false }),
          tabsTransform({ bundle: false }),
          fileTransform({ bundle: false }),
        ],
      });

      // After sanitization, replace tokens with clickable anchor tags
      let finalHtml = result.html;
      for (const [token, { id, title }] of Object.entries(mentionMap)) {
        finalHtml = finalHtml.split(token).join(
          `<a href="#" data-media-id="${id}" class="media-mention">${title}</a>`
        );
      }

      return finalHtml;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return content;
    }
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-media-id]');
    if (link) {
      const mediaIdStr = link.getAttribute('data-media-id');
      if (mediaIdStr) {
        e.preventDefault();
        const mediaId = parseInt(mediaIdStr, 10);
        if (!isNaN(mediaId)) {
          setHoveredMediaId(null);
          if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
          navigateToMediaDetail(mediaId);
        }
      }
    }
  }, [navigateToMediaDetail]);

  const handleMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-media-id]') as HTMLElement | null;
    if (link) {
      const mediaIdStr = link.getAttribute('data-media-id');
      if (mediaIdStr) {
        const mediaId = parseInt(mediaIdStr, 10);
        if (!isNaN(mediaId)) {
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }

          if (hoveredMediaId === mediaId) return;

          if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current);
          }

          const rect = link.getBoundingClientRect();
          openTimeoutRef.current = setTimeout(() => {
            setHoveredMediaId(mediaId);
            // Use fixed position directly (no scrollY offset needed for fixed elements)
            setHoverCardPosition({
              top: rect.bottom,
              left: rect.left,
            });
          }, 150);
        }
      }
    }
  }, [hoveredMediaId]);

  const handleMouseOut = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-media-id]');
    if (link) {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }

      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = setTimeout(() => {
        setHoveredMediaId(null);
      }, 200);
    }
  }, []);

  const handleCardMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredMediaId(null);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
    };
  }, []);

  if (!renderedHtml) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .yfm a.media-mention {
          cursor: pointer !important;
          color: #60a5fa !important;
          text-decoration: none !important;
          border-bottom: 1px dashed rgba(96, 165, 250, 0.4) !important;
          transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease !important;
          font-weight: 600 !important;
        }
        .yfm a.media-mention:hover {
          color: #93c5fd !important;
          border-bottom-color: #93c5fd !important;
          background-color: rgba(96, 165, 250, 0.10) !important;
          border-radius: 4px !important;
          padding: 1px 5px !important;
          margin: 0 -5px !important;
        }
      ` }} />
      <div
        className={cn('yfm', className)}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      />
      {hoveredMediaId !== null && createPortal(
        <MediaHoverCard
          mediaId={hoveredMediaId}
          position={hoverCardPosition}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        />,
        document.body
      )}
    </>
  );
};

export default MarkdownViewer;