import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

const PREVIEW_SIZE = 220;
const OUTPUT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const WHEEL_STEP = 0.15;

const ImageCropModal: React.FC<{
  imageDataUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}> = ({ imageDataUrl, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);

  // Load natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // "contain" fit: scale so the LONGEST side fits inside the circle.
  // This ensures the entire image is visible at zoom=1.
  const getBaseSize = useCallback((targetSize: number) => {
    if (!natSize) return { w: targetSize, h: targetSize };
    const ratio = natSize.w / natSize.h;
    if (ratio >= 1) {
      return { w: targetSize, h: targetSize / ratio };
    }
    return { w: targetSize * ratio, h: targetSize };
  }, [natSize]);

  // ---- drag handlers ----
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPan({
        x: dragOrigin.current.panX + (e.clientX - dragOrigin.current.x),
        y: dragOrigin.current.panY + (e.clientY - dragOrigin.current.y),
      });
    };
    const up = () => { isDragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // ---- mouse wheel zoom ----
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- Canvas export — draws to 256×256 webp ----
  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();

      const base = getBaseSize(OUTPUT_SIZE);
      const scaleFactor = OUTPUT_SIZE / PREVIEW_SIZE;
      const drawW = base.w * zoom;
      const drawH = base.h * zoom;
      const drawX = (OUTPUT_SIZE - drawW) / 2 + pan.x * scaleFactor;
      const drawY = (OUTPUT_SIZE - drawH) / 2 + pan.y * scaleFactor;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      onConfirm(canvas.toDataURL('image/webp', 0.9));
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, zoom, pan, onConfirm, getBaseSize]);

  // ---- Preview rendering ----
  const previewBase = getBaseSize(PREVIEW_SIZE);
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    width: previewBase.w,
    height: previewBase.h,
    left: (PREVIEW_SIZE - previewBase.w) / 2,
    top: (PREVIEW_SIZE - previewBase.h) / 2,
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e1025] border border-white/10 rounded-2xl p-6 w-[400px] flex flex-col items-center gap-5 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('settings.profile.adjustPhoto')}</h3>

        {/* Preview circle */}
        <div
          ref={circleRef}
          className="relative rounded-full overflow-hidden border-2 border-white/20 cursor-move bg-black/40"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          onMouseDown={onMouseDown}
        >
          {natSize && (
            <img
              src={imageDataUrl}
              alt="Preview"
              className="select-none pointer-events-none"
              style={imgStyle}
              draggable={false}
            />
          )}
          {/* Move hint — only when not dragging */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <Move className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>

        <p className="text-[10px] text-gray-500 -mt-2">{t('mediaCreate.cropHint')}</p>

        {/* Zoom slider */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          <span className="text-[10px] text-gray-500 tabular-nums">{zoom.toFixed(1)}x</span>
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(MIN_ZOOM, prev - WHEEL_STEP))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-primary cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(MAX_ZOOM, prev + WHEEL_STEP))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/80 rounded-xl transition-all cursor-pointer shadow-[0_0_20px_rgba(217,70,239,0.25)]"
          >
            {t('common.apply')}
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default ImageCropModal;
