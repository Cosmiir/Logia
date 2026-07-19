import React from 'react';

interface MediaCardSkeletonProps {
  count?: number;
}

export const MediaCardSkeleton: React.FC<MediaCardSkeletonProps> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex-1 shrink-0 snap-start rounded-[14px] animate-pulse"
          style={{
            padding: '2px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.06))',
          }}
        >
          <div className="w-full relative rounded-xl overflow-hidden bg-white/5" style={{ height: 0, paddingTop: 'calc(150% + 64px)' }}>
            {/* Skeleton image zone (top, ratio 2:3 minus info bar) */}
            <div className="absolute top-0 left-0 w-full bg-gradient-to-br from-white/8 to-white/3" style={{ height: 'calc(100% - 64px)' }}></div>

            {/* Skeleton info bar (bottom, 64px) */}
            <div
              className="absolute inset-x-0 bottom-0 px-2.5 py-2 flex flex-col gap-1 bg-zinc-900/80"
              style={{ height: 64 }}
            >
              {/* Collection pill */}
              <div className="h-[14px] w-16 bg-white/10 rounded-full"></div>
              {/* Title line */}
              <div className="h-3.5 bg-white/12 rounded w-[85%]"></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default MediaCardSkeleton;
