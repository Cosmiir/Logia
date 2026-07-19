import React, { useRef, useCallback } from 'react';
import i18next from 'i18next';

interface RangeSliderProps {
  value: number | null;
  value2?: number | null;
  min: number;
  max: number;
  step?: number;
  operator: 'gte' | 'lte' | 'eq' | 'neq' | 'between';
  onChange: (value: number | null, value2?: number | null) => void;
  className?: string;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
  value,
  value2,
  min,
  max,
  step = 1,
  operator,
  onChange,
  className = ''
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumb1Ref = useRef<HTMLDivElement>(null);
  const thumb2Ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'thumb1' | 'thumb2' | null>(null);

  const range = max - min || 1;

  const toPercentage = (val: number) =>
    Math.max(0, Math.min(100, ((val - min) / range) * 100));

  const fromClientX = useCallback((clientX: number) => {
    if (!sliderRef.current) return null;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const raw = min + (percent / 100) * range;
    return Math.round(Math.max(min, Math.min(max, raw)) / step) * step;
  }, [min, max, step, range]);

  const handlePointerDown = (thumbType: 'thumb1' | 'thumb2') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = thumbType;
    const ref = thumbType === 'thumb1' ? thumb1Ref : thumb2Ref;
    ref.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (thumbType: 'thumb1' | 'thumb2') => (e: React.PointerEvent) => {
    if (dragRef.current !== thumbType) return;
    const newVal = fromClientX(e.clientX);
    if (newVal === null) return;
    if (thumbType === 'thumb1') onChange(newVal, value2 ?? null);
    else onChange(value ?? null, newVal);
  };

  const handlePointerUp = (thumbType: 'thumb1' | 'thumb2') => (e: React.PointerEvent) => {
    if (dragRef.current !== thumbType) return;
    dragRef.current = null;
    const ref = thumbType === 'thumb1' ? thumb1Ref : thumb2Ref;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleKeyDown = (thumbType: 'thumb1' | 'thumb2') => (e: React.KeyboardEvent) => {
    const cur = thumbType === 'thumb1' ? value : value2;
    if (cur === null || cur === undefined) return;
    let next = cur;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(min, cur - step);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, cur + step);
    else return;
    e.preventDefault();
    if (thumbType === 'thumb1') onChange(next, value2 ?? null);
    else onChange(value ?? null, next);
  };

  const thumb1Pos = value != null ? toPercentage(value) : 0;
  const thumb2Pos = value2 != null ? toPercentage(value2) : 100;

  const thumbClass =
    'absolute top-1/2 w-4 h-4 bg-primary rounded-full shadow-lg cursor-grab active:cursor-grabbing border-2 border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50';

  if (operator === 'between') {
    const fillLeft = Math.min(thumb1Pos, thumb2Pos);
    const fillRight = 100 - Math.max(thumb1Pos, thumb2Pos);
    return (
      <div className={`relative h-6 ${className}`}>
        <div ref={sliderRef} className="absolute inset-0 bg-white/5 border border-white/10 rounded-full">
          <div
            className="absolute h-full bg-primary/30 rounded-full"
            style={{ left: `${fillLeft}%`, right: `${fillRight}%` }}
          />
          <div
            ref={thumb1Ref}
            className={thumbClass}
            style={{ left: `${thumb1Pos}%`, transform: 'translate(-50%, -50%)' }}
            onPointerDown={handlePointerDown('thumb1')}
            onPointerMove={handlePointerMove('thumb1')}
            onPointerUp={handlePointerUp('thumb1')}
            onPointerCancel={handlePointerUp('thumb1')}
            onKeyDown={handleKeyDown('thumb1')}
            tabIndex={0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value ?? undefined}
            aria-label={i18next.t('common.minValue')}
          />
          <div
            ref={thumb2Ref}
            className={thumbClass}
            style={{ left: `${thumb2Pos}%`, transform: 'translate(-50%, -50%)' }}
            onPointerDown={handlePointerDown('thumb2')}
            onPointerMove={handlePointerMove('thumb2')}
            onPointerUp={handlePointerUp('thumb2')}
            onPointerCancel={handlePointerUp('thumb2')}
            onKeyDown={handleKeyDown('thumb2')}
            tabIndex={0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value2 ?? undefined}
            aria-label={i18next.t('common.maxValue')}
          />
        </div>
      </div>
    );
  }

  const singlePos = value != null ? toPercentage(value) : 0;

  return (
    <div className={`relative h-6 ${className}`}>
      <div ref={sliderRef} className="absolute inset-0 bg-white/5 border border-white/10 rounded-full">
        {(operator === 'gte' || operator === 'lte') && value !== null && (
          <div
            className="absolute h-full bg-primary/30 rounded-full"
            style={{
              left: operator === 'gte' ? '0%' : `${singlePos}%`,
              right: operator === 'lte' ? '0%' : `${100 - singlePos}%`,
            }}
          />
        )}
        <div
          ref={thumb1Ref}
          className={thumbClass}
          style={{ left: `${singlePos}%`, transform: 'translate(-50%, -50%)' }}
          onPointerDown={handlePointerDown('thumb1')}
          onPointerMove={handlePointerMove('thumb1')}
          onPointerUp={handlePointerUp('thumb1')}
          onPointerCancel={handlePointerUp('thumb1')}
          onKeyDown={handleKeyDown('thumb1')}
          tabIndex={0}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value ?? undefined}
          aria-label={`Valeur ${operator}`}
        />
      </div>
    </div>
  );
};

export default RangeSlider;