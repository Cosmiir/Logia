import React, { useRef, useState, useEffect } from 'react';

export interface ContextMenuItem {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, title, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let top = y;
    let left = x;
    if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    setPos({ top, left });
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-1.5 overflow-hidden animate-scale-in"
      style={{ top: pos.top, left: pos.left }}
    >
      {title && (
        <div className="px-3 py-1.5 mb-1 border-b border-white/5">
          <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider truncate">{title}</p>
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg mx-auto transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                : 'text-text-secondary hover:bg-white/8 hover:text-white'
            }`}
            style={{ width: 'calc(100% - 8px)', marginLeft: 4, marginRight: 4 }}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
