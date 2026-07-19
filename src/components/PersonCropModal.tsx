import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

const PREVIEW_W = 180;
const PREVIEW_H = 240; // 3:4
const OUTPUT_W = 360;
const OUTPUT_H = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const WHEEL_STEP = 0.1;

interface PersonCropModalProps {
  imageDataUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const PersonCropModal: React.FC<PersonCropModalProps> = ({ imageDataUrl, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const getCoverScale = useCallback(() => {
    if (!natSize) return 1;
    const scaleX = PREVIEW_W / natSize.w;
    const scaleY = PREVIEW_H / natSize.h;
    return Math.max(scaleX, scaleY);
  }, [natSize]);

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

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2)));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
      ctx.clearRect(0, 0, OUTPUT_W, OUTPUT_H);

      const coverScale = getCoverScale();
      const totalScale = coverScale * zoom;
      const drawW = natSize!.w * totalScale * (OUTPUT_W / PREVIEW_W);
      const drawH = natSize!.h * totalScale * (OUTPUT_H / PREVIEW_H);
      const drawX = (OUTPUT_W - drawW) / 2 + pan.x * (OUTPUT_W / PREVIEW_W);
      const drawY = (OUTPUT_H - drawH) / 2 + pan.y * (OUTPUT_H / PREVIEW_H);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      onConfirm(canvas.toDataURL('image/webp', 0.85));
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, zoom, pan, onConfirm, getCoverScale, natSize]);

  const coverScale = getCoverScale();
  const totalScale = coverScale * zoom;
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${totalScale})`,
    transformOrigin: 'center center',
    maxWidth: 'none',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e1025] border border-white/10 rounded-2xl p-6 w-[360px] flex flex-col items-center gap-5 shadow-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          {t('personManagement.cropPhoto', { defaultValue: 'Recadrer la photo' })}
        </h3>

        <div
          ref={frameRef}
          className="relative rounded-xl overflow-hidden border-2 border-white/20 cursor-move bg-black/40"
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <Move className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>

        <p className="text-[10px] text-gray-500 -mt-2">{t('mediaCreate.cropHint')}</p>

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

export default PersonCropModal;
