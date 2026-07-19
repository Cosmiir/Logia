import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, X, Paperclip, Calendar, CalendarCheck, Star, CircleDot, Activity } from 'lucide-react';
import { MEDIA_STATUS_LABELS, MEDIA_STATUS_COLORS } from '@/lib/status-labels';
import type { MediaStatus } from '@/types';
import Tooltip from './Tooltip';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Media, MediaDetail } from '@/types';
import { getCollectionIconComponent } from './CollectionIcons';
import { normalizeCollectionName, formatDateFr } from '@/lib/utils';
import { getRatingColor } from '@/utils/ratingColors';
import { PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';
import { mediaApi } from '@/lib/tauri-api';


/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/* ================================================================== */
/*  Glass Card CSS                                                     */
/* ================================================================== */
const GLASS_CARD_STYLES = `
  @keyframes media-card-sweep {
    0%   { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateX(220%) skewX(-12deg); opacity: 0; }
  }

  /* 3D Flip Card Container */
  .media-card-perspective {
    perspective: 1200px;
    width: 100%;
    position: relative;
    contain: layout paint style;
  }

  /* Élément invisible, dans le flux normal : c'est LUI qui donne sa hauteur
     à la carte, calée sur le ratio réel de l'image (via l'intrinsèque du
     <img>, ou sur 2:3 par défaut tant qu'elle n'est pas chargée / si pas de
     cover). Chaque carte adopte ainsi exactement le ratio de SON cover —
     plus aucun recadrage, plus aucune bande, quel que soit le format. */
  .media-card-sizer {
    display: block;
    width: 100%;
    height: 0;
    padding-top: calc(150% + var(--card-info-h, 64px));
    visibility: hidden;
    pointer-events: none;
  }

  /* Zone image — haut de la carte, ratio 2:3 exact, image entièrement visible */
  .media-card-image-area {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: calc(100% - var(--card-info-h, 64px));
    overflow: hidden;
  }

  /* Zone info — bas de la carte, hauteur fixe, s'étend au hover.
     Le ::before affiche le bas de l'image cover flouté via background-image.
     Le ::after ajoute un overlay sombre léger pour la lisibilité. */
  .media-card-info-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--card-info-h, 64px);
    overflow: hidden;
    z-index: 20;
    background-color: #18181b;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: height;
  }

  .media-card-info-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--card-cover-url, none);
    background-size: cover;
    background-position: bottom center;
    background-repeat: no-repeat;
    filter: blur(12px);
    transform: scaleX(1.1);
    pointer-events: none;
  }

  .media-card-info-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }

  .media-card-front:hover .media-card-info-bar {
    height: var(--card-info-h-hover, 140px);
  }

  .media-card-inner {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.65s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .media-card-inner.is-flipped {
    transform: rotateY(180deg);
  }

  .media-card-front, .media-card-back {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 14px;
    overflow: hidden;
    /* Force Safari à respecter le border-radius pour les enfants avec
       backdrop-filter (bug connu de clipping WebKit) — géométrique et non
       lié à un ratio particulier, donc valable quelle que soit la hauteur
       réelle de la carte. */
    -webkit-mask-image: -webkit-radial-gradient(white, black);
  }

  .media-card-front {
    z-index: 2;
    transform: rotateY(0deg);
  }

  .media-card-back {
    z-index: 1;
    transform: rotateY(180deg);
    border: 1px solid rgba(255, 255, 255, 0.10);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 8px 32px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }

  /* Info flip button on front hover */
  .media-card-flip-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 30;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    transform: scale(0.8) translateY(-4px);
    pointer-events: auto;
  }

  .media-card-front:hover .media-card-flip-btn {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .media-card-flip-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.35);
    color: white;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
  }

  /* Sweep overlay — hidden by default */
  .media-card-sweep {
    position: absolute;
    inset: 0;
    z-index: 25;
    pointer-events: none;
    overflow: hidden;
    border-radius: 12px;
  }

  /* Masque CSS pour fondu garanti sur les deux bords, sans skew */
  .media-card-sweep::after {
    content: '';
    position: absolute;
    top: -20%;
    left: 0;
    width: 55%;
    height: 140%;
    background: rgba(255,255,255,0.10);
    transform: translateX(-120%) skewX(-12deg);
    opacity: 0;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0%,
      black 25%,
      black 75%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0%,
      black 25%,
      black 75%,
      transparent 100%
    );
  }

  .media-card-front:hover .media-card-sweep::after {
    animation: media-card-sweep 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  /* Glass border ring */
  .media-card-border {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    pointer-events: none;
    z-index: 30;
    transition: box-shadow 0.32s ease, border-color 0.32s ease;
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.10),
      0 1px 3px rgba(0,0,0,0.5);
  }

  .media-card-front:hover .media-card-border {
    border-color: rgba(255,255,255,0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 8px 32px rgba(0, 0, 0, 0.6);
  }

  /* Top-left static shimmer — always visible, premium feel */
  .media-card-shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 55%;
    height: 45%;
    pointer-events: none;
    z-index: 24;
    border-radius: 12px 0 0 0;
    background: radial-gradient(
      ellipse at 20% 0%,
      rgba(255,255,255,0.07) 0%,
      transparent 70%
    );
    transition: opacity 0.32s ease;
  }

  .media-card-front:hover .media-card-shimmer {
    opacity: 0.5;
  }

  /* Bottom color aura */
  .media-card-aura {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
    pointer-events: none;
    z-index: 23;
    border-radius: 0 0 12px 12px;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--card-coll-color, #22d3ee) 10%, transparent) 0%,
      transparent 100%
    );
    opacity: 0;
    transition: opacity 0.32s ease;
  }

  .media-card-front:hover .media-card-aura {
    opacity: 1;
  }
`;

/* Inject styles once */
if (typeof document !== 'undefined' && !document.getElementById('media-card-glass-styles')) {
  const tag = document.createElement('style');
  tag.id = 'media-card-glass-styles';
  tag.textContent = GLASS_CARD_STYLES;
  document.head.appendChild(tag);
}

const STATUS_LABELS = PROGRESS_STATUS_LABELS;

// Lucide icon for the collection type in the badge
const CollectionIcon: React.FC<{ type: string; color: string; iconId?: string | null }> = ({ type, color, iconId }) => {
  const Icon = getCollectionIconComponent(type, iconId);
  // Gamepad2 renders smaller, apply scale to ensure exactly 10px visual height
  const scale = type.toLowerCase().replace(/[^a-z]/g, '').includes('jeu') ? 1.25 : 1;
  return <Icon style={{ 
    width: 10, 
    height: 10, 
    minWidth: 10, 
    minHeight: 10, 
    color, 
    flexShrink: 0,
    transform: `scale(${scale})`,
    transformOrigin: 'center'
  }} />;
};

export const getCollectionColor = (type: string): string => {
  switch (normalizeCollectionName(type)) {
    case 'FILM': return '#60a5fa';       // blue-400
    case 'SERIE': return '#22d3ee';      // cyan-400
    case 'ANIME': return '#f472b6';      // pink-400
    case 'MANGA': return '#f87171';      // red-400
    case 'MANHWA': return '#c084fc';     // purple-400
    case 'LIVRE': return '#fbbf24';      // amber-400
    case 'JEU VIDEO': return '#fb923c';  // orange-400
    default: return '#22d3ee';
  }
};

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */
/*
  NB : le badge de statut (haut-gauche), la pastille de note (bas-droite)
  et le hover "date + progression" ont été retirés de la face avant.
  Ces informations sont déjà présentes en détail sur la face arrière
  (flip via le bouton "i"), les dupliquer ici ne faisait qu'encombrer
  le poster. Si tu veux les remettre, ils sont conservés dans l'ancienne
  version du fichier — dis-le moi et je les réintègre différemment
  (ex: une pastille de note discrète à côté du nom de la collection).
*/

/* ================================================================== */
/*  BottomInfo — collection + titre, en overlay flottant sur le poster */
/* ================================================================== */
const BottomInfo: React.FC<{ media: Media; collectionName: string; collectionIcon?: string | null; collectionColor?: string; contentRef?: React.RefObject<HTMLDivElement | null> }> = ({ media, collectionName, collectionIcon, collectionColor, contentRef }) => {
  const collColor = collectionColor || getCollectionColor(collectionName);
  return (
    <div ref={contentRef} className="relative z-10 px-2.5 py-2 flex flex-col gap-1" style={{ height: '100%' }}>
      <span
        className="inline-flex items-center gap-1 self-start bg-black/40 rounded-full"
        style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 6, color: collColor }}
      >
        <CollectionIcon type={collectionName} color={collColor} iconId={collectionIcon} />
        <span style={{ fontSize: 13, lineHeight: 'normal' }} className="font-semibold tracking-wider">{collectionName}</span>
      </span>
      <Tooltip content={media.title} onlyWhenTruncated className="overflow-hidden min-w-0">
        <h4 className="text-[16px] font-bold text-white leading-tight" style={{ maxHeight: 80, overflow: 'hidden' }}>{media.title}</h4>
      </Tooltip>
    </div>
  );
};

/* ================================================================== */
/*  MediaCard — main exported component                                */
/* ================================================================== */
interface MediaCardProps {
  media: Media;
  collectionName?: string;
  collectionIcon?: string | null;
  collectionColor?: string;
  progressionLabel?: string;
  progressionShortLabel?: string;
  pluralWithS?: boolean;
  creatorLabel?: string;
  /** Dynamic experience date label — e.g: "Watched on", "Read on", "Played on" */
  experienceDateLabel?: string;
  cardDensity?: 'compact' | 'normal' | 'large' | 'detailed';
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  collectionName = '',
  collectionIcon,
  collectionColor,
  creatorLabel = '',
  experienceDateLabel = '',
  cardDensity: rawCardDensity = 'normal',
  onContextMenu,
  onClick,
  className = '',
  style
}) => {
  const { t } = useTranslation();
  const cardDensity = rawCardDensity === 'detailed' ? 'normal' : rawCardDensity;
  // State for 3D flip details
  const [isFlipped, setIsFlipped] = useState(false);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Ref for adaptive hover height — measure content scrollHeight to expand
  // the info bar only as much as needed for the title
  const infoContentRef = useRef<HTMLDivElement>(null);
  const hoverHeightRef = useRef<number | null>(null);

  // Mesurer la hauteur naturelle du contenu une seule fois (au montage ou
  // après un resize) pour éviter un reflow synchrone à chaque hover.
  const measureHoverHeight = useCallback(() => {
    if (!infoContentRef.current) return;
    const content = infoContentRef.current;
    const prevHeight = content.style.height;
    content.style.height = 'auto';
    const naturalHeight = content.offsetHeight;
    content.style.height = prevHeight;
    hoverHeightRef.current = Math.min(naturalHeight, 130);
  }, []);

  const handleMouseEnter = () => {
    if (hoverHeightRef.current == null) measureHoverHeight();
    if (hoverHeightRef.current != null && infoContentRef.current) {
      const cardEl = infoContentRef.current.closest('.media-card-perspective') as HTMLElement | null;
      if (cardEl) {
        cardEl.style.setProperty('--card-info-h-hover', `${hoverHeightRef.current}px`);
      }
    }
  };

  // Cover image: placeholder gradient if no cover
  const hasCover = !!media.cover_image;
  const coverUrl = hasCover ? `${convertFileSrc(media.cover_image!)}?t=${media.updated_at}` : null;

  const collColor = collectionColor || getCollectionColor(collectionName);

  const handleFlipClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);

    if (newFlipped && !detail && !loadingDetail) {
      setLoadingDetail(true);
      try {
        const data = await mediaApi.getById(media.id);
        if (data) {
          setDetail(data);
        }
      } catch (err) {
        console.error('Error fetching media details for flip:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const handleFlipBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFlipped(false);
  };

  const handleMouseLeave = () => {
    if (isFlipped) {
      setIsFlipped(false);
    }
    if (infoContentRef.current) {
      const cardEl = infoContentRef.current.closest('.media-card-perspective') as HTMLElement | null;
      if (cardEl) {
        cardEl.style.removeProperty('--card-info-h-hover');
      }
    }
  };

  return (
    <div
      className={`media-card-perspective shrink-0 snap-start flex-1 ${className}`}
      onMouseLeave={handleMouseLeave}
      style={{
        borderRadius: 14,
        ['--card-coll-color' as string]: collColor,
        ['--card-info-h' as string]: '64px',
        ['--card-cover-url' as string]: coverUrl ? `url("${coverUrl}")` : 'none',
        ...style,
      }}
    >
      {/* Sizer — hauteur = width × 1.5 (ratio 2:3) + info bar */}
      <div className="media-card-sizer" />

      <div className={`media-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
        
        {/* ========================================== */}
        {/*  FRONT FACE                                */}
        {/* ========================================== */}
        <div 
          className="media-card-front w-full h-full relative group cursor-pointer overflow-hidden bg-zinc-900"
          onMouseEnter={handleMouseEnter}
          onClick={(e) => {
            if (isFlipped) return;
            onClick?.(e);
          }}
          onContextMenu={onContextMenu}
        >
          {/* Glass border ring — placed inside to rotate with the front card */}
          <div className="media-card-border" />

          {/* Dynamic flip trigger button */}
          <button
            type="button"
            className="media-card-flip-btn"
            onClick={handleFlipClick}
            title={t('mediaCard.quickInfo')}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Zone image — ratio 2:3 exact, image entièrement visible */}
          <div className="media-card-image-area">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0 w-full h-full"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(0,229,255,0.15))' }}
              />
            )}
          </div>

          {/* Top-left static shimmer — full card */}
          <div className="media-card-shimmer" />

          {/* Bottom collection-color aura — full card */}
          <div className="media-card-aura" />

          {/* Sweep light reflection on hover — full card */}
          <div className="media-card-sweep" />

          {/* Zone info — bas de la carte, s'étend au hover */}
          <div className="media-card-info-bar">
            <BottomInfo media={media} collectionName={collectionName} collectionIcon={collectionIcon} collectionColor={collectionColor} contentRef={infoContentRef} />
          </div>
        </div>

        {/* ========================================== */}
        {/*  BACK FACE                                 */}
        {/* ========================================== */}
        <div 
          className="media-card-back w-full h-full relative text-left select-none"
          onClick={handleFlipBack}
        >
          {/* Background: cover image blurred as wallpaper, or dark gradient */}
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(18px) brightness(0.35) saturate(1.4)', transform: 'scale(1.08)' }}
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(15,15,22,0.98), rgba(8,8,12,0.99))' }}
            />
          )}
          {/* Dark vignette overlay for readability */}
          <div className="absolute inset-0 bg-black/45" />

          {/* Content layer */}
          <div className={`relative z-10 h-full flex flex-col ${cardDensity === 'compact' ? 'p-3' : 'p-3.5'}`}>

            {/* Header row: collection pill + close button */}
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                style={{ color: collColor, background: `${collColor}22`, border: `1px solid ${collColor}44` }}
              >
                <CollectionIcon type={collectionName} color={collColor} iconId={collectionIcon} />
                <span className="tracking-wider uppercase">{collectionName}</span>
              </span>
              <button
                type="button"
                className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors shrink-0"
                onClick={handleFlipBack}
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Title */}
            <h4 className="text-[13.5px] font-extrabold text-white leading-snug line-clamp-2 mb-2">
              {media.title}
            </h4>

            {/* Metadata rows */}
            <div className="flex flex-col gap-1 text-[10.5px] text-white/70 mb-2">
              {media.creator && cardDensity !== 'compact' && (
                <div className="flex items-baseline gap-1 truncate">
                  <span className="text-white/40 shrink-0">{creatorLabel || t('common.creator')} :</span>
                  <span className="font-semibold text-white/90 truncate">{media.creator}</span>
                </div>
              )}
              {media.release_date && (
                <div className="flex items-baseline gap-1 truncate">
                  {cardDensity === 'compact' ? (
                    <Calendar className="w-3 h-3 text-white/40 shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-white/40 shrink-0">{t('media.releaseDate')} :</span>
                  )}
                  <span className="truncate">{formatDateFr(media.release_date)}</span>
                </div>
              )}
              {media.experience_date && (
                <div className="flex items-baseline gap-1 truncate">
                  {cardDensity === 'compact' ? (
                    <CalendarCheck className="w-3 h-3 text-white/40 shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-white/40 shrink-0">{experienceDateLabel || t('media.experienceDate')} :</span>
                  )}
                  <span className="truncate">{formatDateFr(media.experience_date)}</span>
                </div>
              )}
            </div>

            {/* Genres — max 3 */}
            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {media.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ color: g.color, background: `${g.color}22`, border: `1px solid ${g.color}44` }}
                  >
                    {g.name}
                  </span>
                ))}
                {media.genres.length > 3 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/35 bg-white/5 border border-white/10 whitespace-nowrap">
                    +{media.genres.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom section: rating + statuses + attachments */}
            <div className={`flex flex-col ${cardDensity === 'compact' ? 'gap-1' : 'gap-1.5'} pt-2 border-t border-white/10`}>

              {/* Rating */}
              {(() => {
                const rating = media.user_rating ?? 0;
                const ratingColor = getRatingColor(rating);
                return (
                  <div className="flex items-center gap-2">
                    {cardDensity === 'compact' ? (
                      <Star className="w-3 h-3 text-white/35 shrink-0" />
                    ) : (
                      <span className={`text-[9px] uppercase tracking-wider text-white/35 font-bold ${cardDensity === 'normal' ? 'w-16' : 'w-20'} shrink-0`}>{t('common.rating')}</span>
                    )}
                    <span
                      className="text-[10px] px-2.5 py-0.5 rounded-full font-black text-white whitespace-nowrap"
                      style={{ backgroundColor: ratingColor, boxShadow: `0 0 6px 1px ${ratingColor}55` }}
                    >
                      {rating > 0 ? rating : '—'}
                    </span>
                  </div>
                );
              })()}

              {/* Media status */}
              {media.media_status && (() => {
                const ms = media.media_status as MediaStatus;
                const msColor = MEDIA_STATUS_COLORS[ms] ?? '#6b7280';
                const msLabel = MEDIA_STATUS_LABELS[ms] ?? media.media_status;
                return (
                  <div className="flex items-center gap-2">
                    {cardDensity === 'compact' ? (
                      <CircleDot className="w-3 h-3 text-white/35 shrink-0" />
                    ) : (
                      <span className={`text-[9px] uppercase tracking-wider text-white/35 font-bold ${cardDensity === 'normal' ? 'w-16' : 'w-20'} shrink-0`}>{t('common.media')}</span>
                    )}
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: msColor, background: `${msColor}22`, border: `1px solid ${msColor}55` }}
                    >
                      {msLabel}
                    </span>
                  </div>
                );
              })()}

              {/* Progress status */}
              {media.progress_status && (() => {
                const ps = media.progress_status as keyof typeof PROGRESS_STATUS_COLORS;
                const psColor = PROGRESS_STATUS_COLORS[ps] ?? '#6b7280';
                const psLabel = STATUS_LABELS[ps] ?? media.progress_status;
                return (
                  <div className="flex items-center gap-2">
                    {cardDensity === 'compact' ? (
                      <Activity className="w-3 h-3 text-white/35 shrink-0" />
                    ) : (
                      <span className={`text-[9px] uppercase tracking-wider text-white/35 font-bold ${cardDensity === 'normal' ? 'w-16' : 'w-20'} shrink-0`}>{t('common.progress')}</span>
                    )}
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: psColor, background: `${psColor}22`, border: `1px solid ${psColor}55` }}
                    >
                      {psLabel}
                    </span>
                  </div>
                );
              })()}

              {/* Attachments count — async */}
              {loadingDetail ? (
                <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
              ) : detail && detail.attachments && detail.attachments.length > 0 ? (
                <div className="flex items-center gap-2">
                  {cardDensity === 'compact' ? (
                    <Paperclip className="w-3 h-3 text-white/35 shrink-0" />
                  ) : (
                    <span className={`text-[9px] uppercase tracking-wider text-white/35 font-bold ${cardDensity === 'normal' ? 'w-16' : 'w-20'} shrink-0`}>{t('common.files')}</span>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-cyan-400/80 whitespace-nowrap">
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span>{t('common.fileAttached', { count: detail.attachments.length })}</span>
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

// Memoïser MediaCard pour éviter les re-renders inutiles quand les props ne changent pas
export const MemoizedMediaCard = React.memo(MediaCard, (prevProps, nextProps) => {
  return (
    prevProps.media.id === nextProps.media.id &&
    prevProps.media.title === nextProps.media.title &&
    prevProps.media.progress_status === nextProps.media.progress_status &&
    prevProps.media.user_rating === nextProps.media.user_rating &&
    prevProps.media.cover_image === nextProps.media.cover_image &&
    prevProps.media.updated_at === nextProps.media.updated_at &&
    prevProps.creatorLabel === nextProps.creatorLabel &&
    prevProps.experienceDateLabel === nextProps.experienceDateLabel &&
    prevProps.cardDensity === nextProps.cardDensity &&
    prevProps.onContextMenu === nextProps.onContextMenu &&
    prevProps.onClick === nextProps.onClick
  );
});