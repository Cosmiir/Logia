import React, { useState, useEffect, useMemo } from 'react';
import i18next from 'i18next';
import { Image as ImageIcon } from 'lucide-react';
import MediaMetaBar from '@/components/MediaDetail/MediaMetaBar';
import { SynopsisSection } from '@/components/MediaDetail/SynopsisSection';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import type { Collection } from '@/types';

/* ================================================================== */
/*  Crop preview image                                                 */
/* ================================================================== */
interface CropData { x: number; y: number; zoom: number; }

const CropPreviewImg: React.FC<{
  src: string;
  cropData: CropData | null;
  /** Modal preview frame used to generate the crop (cover: 200x300, backdrop: 1280x720-ish) */
  modalW?: number;
  modalH?: number;
  objectPosition?: string;
}> = ({ src, cropData, modalW = 200, modalH = 300, objectPosition = 'center' }) => {
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  if (!cropData || !natSize) {
    return <img src={src} alt="" className="w-full h-full object-cover select-none pointer-events-none" style={{ objectPosition }} />;
  }

  const coverScale = Math.max(modalW / natSize.w, modalH / natSize.h);
  const totalScale = coverScale * cropData.zoom;
  // We render at the container's own size, so ratio = 1 (modal-space ≈ container-space).
  // The crop modal displays at modalW x modalH; the container here is sized by CSS to the
  // same aspect ratio, so a 1:1 scale mapping is correct.
  const ratio = 1;

  return (
    <img
      src={src}
      alt=""
      className="select-none pointer-events-none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: modalW,
        height: modalH,
        transform: `translate(-50%, -50%) translate(${cropData.x * ratio}px, ${cropData.y * ratio}px) scale(${totalScale * ratio})`,
        transformOrigin: 'center center',
        maxWidth: 'none',
      }}
    />
  );
};

/* ================================================================== */
/*  MediaCreateBackdrop — page-level background (like MediaDetail)    */
/* ================================================================== */
export interface MediaCreateBackdropProps {
  src: string | null;
  cropData: CropData | null;
  useEditUrl: boolean;
  removed: boolean;
}

export const MediaCreateBackdrop: React.FC<MediaCreateBackdropProps> = ({
  src, cropData, useEditUrl, removed,
}) => {
  const previewSrc = useMemo(() => {
    if (removed || !src) return null;
    return src;
  }, [src, removed]);

  if (!previewSrc) return null;

  return (
    <div
      className="absolute top-6 right-8 w-[76%] max-w-[1380px] h-[620px] pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      <div
        className="w-full h-full relative"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 76%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 76%, transparent 100%)',
        }}
      >
        {useEditUrl && !cropData ? (
          <img
            src={previewSrc}
            alt=""
            className="w-full h-full object-cover object-top filter brightness-[0.95] contrast-[1.03]"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full relative overflow-hidden">
            <CropPreviewImg
              src={previewSrc}
              cropData={cropData}
              modalW={1280}
              modalH={720}
              objectPosition="top"
            />
          </div>
        )}

        {/* Reading scrim — same as MediaDetailBackdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(6,7,14,0.86) 0%, rgba(6,7,14,0.66) 26%, rgba(6,7,14,0.40) 48%, rgba(6,7,14,0.18) 68%, transparent 88%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 72% 90% at 22% 40%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.18) 45%, transparent 74%)',
            mixBlendMode: 'multiply',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(8,9,15,0.6) 0%, rgba(8,9,15,0.15) 60%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
};

/* ================================================================== */
/*  MediaCreateHero — foreground content (cover + title + meta)       */
/*  Sits on top of the page-level backdrop. No bordered container.    */
/* ================================================================== */
export interface MediaCreateHeroProps {
  title: string;
  collection: Collection | null;
  /** Form fields projected into a Media-like object for MediaMetaBar */
  creator: string;
  releaseDate: string;
  progressTotal: number | null;
  mediaStatus: string;
  synopsis: string;
  /** Cover preview */
  coverSrc: string | null;
  coverCrop: CropData | null;
  coverUseEditUrl: boolean;
  coverRemoved: boolean;
  /** Whether a backdrop is active (controls text shadow) */
  hasBackdrop: boolean;
}

const MediaCreateHero: React.FC<MediaCreateHeroProps> = ({
  title,
  collection,
  creator,
  releaseDate,
  progressTotal,
  mediaStatus,
  synopsis,
  coverSrc,
  coverCrop,
  coverUseEditUrl,
  coverRemoved,
  hasBackdrop,
}) => {
  const CollIcon = collection ? getCollectionIconComponent(collection.name, collection.icon) : null;
  const collColor = collection?.color || '#8b5cf6';

  // Cover preview URL
  const coverPreviewSrc = useMemo(() => {
    if (coverRemoved || !coverSrc) return null;
    return coverSrc;
  }, [coverSrc, coverRemoved]);

  // Media-like object for MediaMetaBar
  const metaMedia = useMemo(() => ({
    creator: creator || null,
    release_date: releaseDate || null,
    progress_total: progressTotal ?? null,
    media_status: mediaStatus || null,
  }), [creator, releaseDate, progressTotal, mediaStatus]);

  const hasTitle = title.trim().length > 0;
  const hasSynopsis = synopsis.trim().length > 0;
  const hasAnyMeta = !!(creator || releaseDate || (progressTotal && progressTotal > 0) || mediaStatus);
  const isEmpty = !hasTitle && !hasSynopsis && !hasAnyMeta && !coverPreviewSrc;

  return (
    <div className="mb-6 flex flex-col md:flex-row gap-6 items-start">
      {/* Cover poster */}
      <div className="shrink-0 w-[200px] xl:w-[240px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/15 bg-black/40 relative">
        {coverPreviewSrc ? (
          <div className="w-full h-full overflow-hidden relative">
            {coverUseEditUrl && !coverCrop ? (
              <img src={coverPreviewSrc} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
            ) : (
              <CropPreviewImg
                src={coverPreviewSrc}
                cropData={coverCrop}
                modalW={200}
                modalH={300}
              />
            )}
          </div>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/8 to-white/3 flex flex-col items-center justify-center gap-2 text-white/20">
            <ImageIcon className="w-10 h-10" />
            <span className="text-[10px] font-medium text-center px-2 leading-tight">
              {i18next.t('mediaCreate.coverPreviewHint')}
            </span>
          </div>
        )}
      </div>

      {/* Main details */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Collection badge */}
        {collection && (
          <div className="flex items-center gap-2 mb-2">
            {CollIcon && <CollIcon className="w-3.5 h-3.5 shrink-0" style={{ color: collColor }} />}
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: collColor, textShadow: hasBackdrop ? '0 1px 3px rgba(0,0,0,0.85)' : undefined }}>
              {collection.name}
            </span>
          </div>
        )}

        {/* Title */}
        <h1
          className="text-3xl sm:text-4xl xl:text-5xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-3xl"
        >
          {hasTitle ? title : (
            <span className="text-white/25">{i18next.t('mediaCreate.titlePlaceholder')}</span>
          )}
        </h1>

        {/* Metadata bar */}
        {hasAnyMeta && (
          <MediaMetaBar
            media={metaMedia}
            collection={collection}
            className="mb-4"
          />
        )}

        {/* Synopsis preview */}
        {hasSynopsis && (
          <div className="mb-4 max-w-2xl">
            <SynopsisSection synopsis={synopsis} />
          </div>
        )}

        {isEmpty && (
          <p className="text-xs text-white/25 italic mt-2">
            {i18next.t('mediaCreate.heroEmptyHint') || 'Aperçu de la fiche — remplissez les champs ci-dessous.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default MediaCreateHero;
