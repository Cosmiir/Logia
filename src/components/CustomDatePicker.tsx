import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

type DateView = 'days' | 'months' | 'years';

const parseFRDate = (str: string): string | null => {
  const parts = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!parts) return null;
  
  const day = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1; // 0-indexed
  const year = parseInt(parts[3], 10);
  
  const date = new Date(year, month, day);
  
  if (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day &&
    !isNaN(date.getTime())
  ) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  return null;
};

const parseISODate = (str: string): string | null => {
  const parts = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!parts) return null;
  
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1;
  const day = parseInt(parts[3], 10);
  
  const date = new Date(year, month, day);
  if (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day &&
    !isNaN(date.getTime())
  ) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
};

const parseDateString = (str: string): string | null => {
  const trimmed = str.trim();
  return parseFRDate(trimmed) || parseISODate(trimmed);
};

const CustomDatePicker: React.FC<{
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  compact?: boolean;
}> = ({ value, onChange, label, placeholder = 'Sélectionner...', compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dateView, setDateView] = useState<DateView>('days');
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [panelOffsetX, setPanelOffsetX] = useState(0);
  const parsed = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
  const [yearRangeStart, setYearRangeStart] = useState(Math.floor((parsed?.getFullYear() ?? new Date().getFullYear()) / 20) * 20);

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`
    : '';

  const [inputValue, setInputValue] = useState(displayValue);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePanelPosition = () => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? 300;
      if (!containerRect) return;

      const minMargin = 8;
      let nextOffset = 0;
      const leftAlignedRightEdge = containerRect.left + panelWidth;
      if (leftAlignedRightEdge > window.innerWidth - minMargin) {
        nextOffset -= leftAlignedRightEdge - (window.innerWidth - minMargin);
      }
      const finalLeftEdge = containerRect.left + nextOffset;
      if (finalLeftEdge < minMargin) {
        nextOffset += minMargin - finalLeftEdge;
      }
      setPanelOffsetX(nextOffset);
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    return () => window.removeEventListener('resize', updatePanelPosition);
  }, [isOpen]);

  useEffect(() => {
    setInputValue(displayValue);
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value, displayValue]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const isSelected = (day: number) => {
    if (!parsed) return false;
    return parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === day;
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(str);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!isOpen) setDateView('days');
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Clean input to only contain digits, slashes, dashes, dots
    let cleaned = val.replace(/[^\d/.-]/g, '');
    
    // Auto-insert slashes if typing forwards
    if (cleaned.length > inputValue.length) {
      if (/^\d{2}$/.test(cleaned)) {
        cleaned = cleaned + '/';
      }
      else if (/^\d{2}\/\d{2}$/.test(cleaned)) {
        cleaned = cleaned + '/';
      }
    }
    
    // Limit to 10 characters max
    if (cleaned.length > 10) {
      cleaned = cleaned.substring(0, 10);
    }
    
    setInputValue(cleaned);
    
    if (cleaned.trim() === '') {
      onChange('');
      return;
    }
    
    const parsedDate = parseDateString(cleaned);
    if (parsedDate) {
      onChange(parsedDate);
    }
  };

  const handleInputBlur = () => {
    if (inputValue.trim() === '') {
      onChange('');
    } else {
      const parsedDate = parseDateString(inputValue);
      if (!parsedDate) {
        setInputValue(displayValue);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parsedDate = parseDateString(inputValue);
      if (parsedDate) {
        onChange(parsedDate);
        setIsOpen(false);
      } else if (inputValue.trim() === '') {
        onChange('');
        setIsOpen(false);
      }
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(displayValue);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      {/* Trigger container */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center gap-2 ${compact ? 'px-2 py-1.5 rounded-lg text-xs' : 'px-3 py-2.5 rounded-xl text-sm'} bg-white/5 border border-white/10 text-white hover:bg-white/[0.08] hover:border-white/20 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all cursor-text`}
      >
        <CalendarIcon
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-white/30 shrink-0 cursor-pointer`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setIsOpen(true);
            setDateView('days');
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 p-0 text-white placeholder:text-white/20 focus:outline-none"
        />
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
            className="text-white/30 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 mt-2 w-[300px] bg-[#12141f] border border-white/10 rounded-2xl shadow-2xl p-4"
            style={{ transform: `translateX(${panelOffsetX}px)` }}
          >
            {dateView === 'days' && (
              <>
                {/* Header — click month/year to switch views */}
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setDateView('months')} className="text-sm font-semibold text-white hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5">
                    {MONTHS_FR[viewMonth]} {viewYear}
                  </button>
                  <button type="button" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_FR.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-white/30 uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, i) => (
                    <div key={i} className="aspect-square flex items-center justify-center">
                      {day ? (
                        <button type="button" onClick={() => selectDay(day)} className={`w-full h-full flex items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer ${isSelected(day) ? 'bg-primary text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]' : isToday(day) ? 'bg-white/10 text-white border border-white/20' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                          {day}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}

            {dateView === 'months' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setViewYear(viewYear - 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => { setYearRangeStart(Math.floor(viewYear / 20) * 20); setDateView('years'); }} className="text-sm font-semibold text-white hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5">
                    {viewYear}
                  </button>
                  <button type="button" onClick={() => setViewYear(viewYear + 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_SHORT.map((m, i) => (
                    <button key={m} type="button" onClick={() => { setViewMonth(i); setDateView('days'); }} className={`py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${viewMonth === i && viewYear === (parsed?.getFullYear() ?? -1) ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}

            {dateView === 'years' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setYearRangeStart(yearRangeStart - 20)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-white">{yearRangeStart} — {yearRangeStart + 19}</span>
                  <button type="button" onClick={() => setYearRangeStart(yearRangeStart + 20)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 20 }, (_, i) => yearRangeStart + i).map((yr) => (
                    <button key={yr} type="button" onClick={() => { setViewYear(yr); setDateView('months'); }} className={`py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${yr === viewYear ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                      {yr}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomDatePicker;
