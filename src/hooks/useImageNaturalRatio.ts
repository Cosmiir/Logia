import { useCallback, useState } from 'react';

/**
 * Returns the natural aspect ratio of an image once it has loaded.
 * Before load, falls back to a sensible default (3/4 = portrait) to avoid
 * a flash of zero-width while the browser figures out the dimensions.
 *
 * Usage:
 *   const { ratio, onLoad } = useImageNaturalRatio();
 *   <img src={src} onLoad={onLoad} style={{ aspectRatio: ratio }} />
 */
export function useImageNaturalRatio(defaultRatio = 3 / 4) {
  const [ratio, setRatio] = useState(defaultRatio);

  const onLoad = useCallback<React.ReactEventHandler<HTMLImageElement>>((e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setRatio(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  return { ratio, onLoad };
}
