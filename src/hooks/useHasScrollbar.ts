import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Hook pour détecter si un élément a une scrollbar verticale
 * Retourne une ref à attacher à l'élément et un boolean indiquant la présence de scrollbar
 */
export function useHasScrollbar<T extends HTMLElement = HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const checkScrollbar = () => {
      const hasVerticalScrollbar = element.scrollHeight > element.clientHeight;
      setHasScrollbar(hasVerticalScrollbar);
    };

    // Vérification initiale
    checkScrollbar();

    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(checkScrollbar);
    resizeObserver.observe(element);

    // Observer les changements de contenu (mutation)
    const mutationObserver = new MutationObserver(checkScrollbar);
    mutationObserver.observe(element, { 
      childList: true, 
      subtree: true,
      characterData: true 
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return [ref, hasScrollbar];
}
