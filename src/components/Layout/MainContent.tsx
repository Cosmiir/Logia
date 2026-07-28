import React, { forwardRef, useImperativeHandle, useRef } from 'react';

interface MainContentProps {
  children: React.ReactNode;
  className?: string;
  useContainer?: boolean;
  showScrollbar?: boolean;
  onMouseDown?: React.MouseEventHandler<HTMLElement>;
}

/**
 * MainContent component - Zone de contenu principale scrollable
 * Utilise Container par défaut pour les marges uniformes de 40px
 * flex-1 pour prendre tout l'espace disponible
 * overflow-y-auto pour le scroll vertical
 * scrollbar-gutter: stable réserve en permanence l'espace de la scrollbar (6px),
 * gardant clientWidth constant que la scrollbar soit visible ou non.
 * Pr-[34px] = 40px - 6px de gutter = 40px de marge visuelle à droite.
 */
export const MainContent = forwardRef<HTMLElement, MainContentProps>(({ 
  children, 
  className = '', 
  useContainer = true,
  showScrollbar = true,
  onMouseDown,
}, ref) => {
  const mainRef = useRef<HTMLElement>(null);

  useImperativeHandle(ref, () => mainRef.current!, [mainRef]);
  const paddingClasses = useContainer ? 'py-6 md:py-8' : 'p-6 md:p-8';
  const scrollbarClass = showScrollbar ? 'custom-scrollbar' : '';

  const content = useContainer ? (
    <div className="w-full pl-10 pr-[34px]">{children}</div>
  ) : (
    children
  );

  return (
    <main ref={mainRef} onMouseDown={onMouseDown} className={`flex-1 overflow-y-auto [scrollbar-gutter:stable] ${paddingClasses} ${scrollbarClass} ${className}`}>
      {content}
    </main>
  );
});

MainContent.displayName = 'MainContent';
