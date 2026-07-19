import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string | null | undefined;
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** When true, only show tooltip if child text is actually truncated */
  onlyWhenTruncated?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, delay = 400, className = '', onlyWhenTruncated = false }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!content) return;
    const el = triggerRef.current;
    if (!el) return;
    if (onlyWhenTruncated) {
      const child = el.firstElementChild as HTMLElement | null;
      const target = child || el;
      if (target.scrollWidth <= target.clientWidth) return;
    }
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top - 6 });
      }
      setVisible(true);
    }, delay);
  }, [content, delay, onlyWhenTruncated]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className={className || undefined}
        style={className ? undefined : { display: 'inherit', overflow: 'hidden', minWidth: 0 }}
      >
        {children}
      </div>
      {visible && content && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="px-2.5 py-1.5 rounded-lg bg-[#1a1d2e]/95 backdrop-blur-sm border border-white/10 shadow-2xl text-[11px] text-white/90 max-w-[280px] whitespace-pre-wrap">
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default Tooltip;
