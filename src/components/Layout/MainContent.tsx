import React, { forwardRef, useImperativeHandle } from 'react';
import { useHasScrollbar } from '@/hooks/useHasScrollbar';

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
 * Compense la scrollbar (8px) pour avoir exactement 40px de marge à droite
 */
export const MainContent = forwardRef<HTMLElement, MainContentProps>(({ 
  children, 
  className = '', 
  useContainer = true,
  showScrollbar = true,
  onMouseDown,
}, ref) => {
  const [mainRef, hasScrollbar] = useHasScrollbar<HTMLElement>();

  useImperativeHandle(ref, () => mainRef.current!, [mainRef]);
  const paddingClasses = useContainer ? 'py-6 md:py-8' : 'p-6 md:p-8';
  const scrollbarClass = showScrollbar 
    ? (hasScrollbar ? 'custom-scrollbar' : 'no-scrollbar')
    : '';

  // Container personnalisé avec compensation scrollbar conditionnelle :
  // AVEC scrollbar :
  //   - Marge de base souhaitée : 40px (px-10)
  //   - Scrollbar custom : 9px
  //   - margin-right sur main : 3px (voir global.css ligne 129)
  //   - Total à compenser : 12px
  //   - Donc pr-[28px] = 40px - 12px pour obtenir 40px de marge visuelle à droite
  // SANS scrollbar :
  //   - On garde la valeur standard pr-10 (40px)
  const rightPadding = hasScrollbar ? 'pr-[28px]' : 'pr-10';
  
  const content = useContainer ? (
    <div className={`w-full pl-10 ${rightPadding}`}>{children}</div>
  ) : (
    children
  );

  return (
    <main ref={mainRef} onMouseDown={onMouseDown} className={`flex-1 overflow-y-auto ${paddingClasses} ${scrollbarClass} ${className}`}>
      {content}
    </main>
  );
});

MainContent.displayName = 'MainContent';
