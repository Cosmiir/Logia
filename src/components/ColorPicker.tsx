import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { COLLECTION_COLORS } from '@/lib/collection-icons';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  label?: string;
}

/* ── helpers ──────────────────────────────────────────────── */
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  presets = COLLECTION_COLORS,
  label,
}) => {
  const { t } = useTranslation();
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const [showCustom, setShowCustom] = useState(false);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'sv' | 'hue' | null>(null);

  // Sync when value changes externally (e.g. preset click)
  useEffect(() => {
    setHsv(hexToHsv(value));
    setHexInput(value);
  }, [value]);

  const commitColor = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    setHsv([h, s, v]);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  /* ── SV area drag ─────────────────────────────────────── */
  const handleSvMove = useCallback((clientX: number, clientY: number) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    commitColor(hsv[0], s, v);
  }, [hsv, commitColor]);

  const handleSvDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = 'sv';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSvMove(e.clientX, e.clientY);
  }, [handleSvMove]);

  const handleSvPointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current === 'sv') handleSvMove(e.clientX, e.clientY);
  }, [handleSvMove]);

  /* ── Hue bar drag ─────────────────────────────────────── */
  const handleHueMove = useCallback((clientX: number) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    commitColor(h, hsv[1], hsv[2]);
  }, [hsv, commitColor]);

  const handleHueDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = 'hue';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleHueMove(e.clientX);
  }, [handleHueMove]);

  const handleHuePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current === 'hue') handleHueMove(e.clientX);
  }, [handleHueMove]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  /* ── Hex input ────────────────────────────────────────── */
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const newHsv = hexToHsv(v);
      setHsv(newHsv);
      onChange(v.toLowerCase());
    }
  };

  const pureHueHex = hsvToHex(hsv[0], 1, 1);

  return (
    <div className="space-y-3">
      {label && <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{label}</p>}

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => {
          const isSelected = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setShowCustom(false); }}
              className={`w-7 h-7 rounded-full cursor-pointer transition-all duration-200 ${isSelected ? 'scale-110' : 'hover:scale-110'}`}
              style={{
                backgroundColor: c,
                boxShadow: isSelected ? `0 0 12px ${c}80, 0 0 0 2px #12141f, 0 0 0 3.5px ${c}` : undefined,
              }}
            >
              {isSelected && <Check className="w-3 h-3 text-white mx-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />}
            </button>
          );
        })}
      </div>

      {/* Toggle custom */}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
      >
        {showCustom ? t('common.hideCustomColor') : t('common.showCustomColor')}
      </button>

      {showCustom && (
        <div className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
          {/* SV area */}
          <div
            ref={svRef}
            className="relative w-full h-32 rounded-lg cursor-crosshair overflow-hidden"
            style={{ backgroundColor: pureHueHex }}
            onPointerDown={handleSvDown}
            onPointerMove={handleSvPointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* white → transparent horizontal */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
            {/* transparent → black vertical */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
            {/* Thumb */}
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hsv[1] * 100}%`,
                top: `${(1 - hsv[2]) * 100}%`,
                backgroundColor: value,
              }}
            />
          </div>

          {/* Hue bar */}
          <div
            ref={hueRef}
            className="relative w-full h-3 rounded-full cursor-pointer"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            onPointerDown={handleHueDown}
            onPointerMove={handleHuePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] pointer-events-none -translate-x-1/2 top-1/2 -translate-y-1/2"
              style={{
                left: `${(hsv[0] / 360) * 100}%`,
                backgroundColor: pureHueHex,
              }}
            />
          </div>

          {/* Hex input + preview */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg border border-white/10 shrink-0"
              style={{ backgroundColor: value }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={handleHexChange}
              spellCheck={false}
              className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-white/25 transition-colors"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
