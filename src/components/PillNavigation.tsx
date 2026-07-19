import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PillNavigationItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface PillNavigationProps<T extends string> {
  items: PillNavigationItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  className?: string;
  pillClassName?: string;
  indicatorClassName?: string;
  uppercase?: boolean;
  groupId?: string;
  /** When true, skip LayoutGroup wrapper to avoid interfering with other layout animations */
  disableLayoutAnimation?: boolean;
}

const PillNavigation = <T extends string>(props: PillNavigationProps<T>) => {
  const {
    items,
    activeId,
    onSelect,
    className,
    pillClassName,
    indicatorClassName,
    uppercase = false,
    groupId,
    disableLayoutAnimation = false,
  } = props;

  const pills = (
    <div
      className={cn(
        'inline-flex h-[50px] items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-1.5 py-1 backdrop-blur-md',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;

        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => !item.disabled && onSelect(item.id)}
            className={cn(
              'relative flex h-[42px] items-center gap-2 rounded-full px-5 text-xs font-semibold tracking-wider text-gray-400 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer',
              uppercase && 'uppercase',
              isActive && 'text-white',
              item.disabled && 'cursor-not-allowed opacity-50 hover:text-gray-400',
              pillClassName
            )}
          >
            {isActive && (
              disableLayoutAnimation ? (
                <span
                  className={cn(
                    'absolute inset-0 rounded-full border border-white/5 bg-white/10 shadow-sm',
                    indicatorClassName
                  )}
                />
              ) : (
                <motion.span
                  layoutId={`${groupId ?? 'pill'}-indicator`}
                  className={cn(
                    'absolute inset-0 rounded-full border border-white/5 bg-white/10 shadow-sm',
                    indicatorClassName
                  )}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )
            )}
            {Icon && <Icon className="relative z-10 h-3.5 w-3.5" />}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (disableLayoutAnimation) return pills;

  return (
    <LayoutGroup id={groupId}>
      {pills}
    </LayoutGroup>
  );
};

export default PillNavigation;
