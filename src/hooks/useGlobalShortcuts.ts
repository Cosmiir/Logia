import { useEffect } from 'react';
import { useNavigationStore } from '@/stores/useNavigationStore';

function isInputActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts() {
  const navigate = useNavigationStore((s) => s.navigate);
  const goBack = useNavigationStore((s) => s.goBack);
  const navigateToMediaCreate = useNavigationStore((s) => s.navigateToMediaCreate);
  const navigateToLibrary = useNavigationStore((s) => s.navigateToLibrary);
  const setFocusLibrarySearch = useNavigationStore((s) => s.setFocusLibrarySearch);
  const selectedCollectionId = useNavigationStore((s) => s.selectedCollectionId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if modifier keys with non-standard combinations (avoid blocking browser defaults)
      // We handle Ctrl + key combinations
      if (!e.ctrlKey && !e.metaKey && e.key !== 'Escape') return;

      // If in an input/textarea, only handle Escape
      if (isInputActive() && e.key !== 'Escape') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n': {
            e.preventDefault();
            navigateToMediaCreate();
            return;
          }
          case ',': {
            e.preventDefault();
            navigate('settings');
            return;
          }
          case 'd': {
            e.preventDefault();
            navigate('dashboard');
            return;
          }
          case 'l': {
            e.preventDefault();
            if (selectedCollectionId != null) {
              navigateToLibrary(selectedCollectionId);
            } else {
              navigate('library');
            }
            return;
          }
          case 'f': {
            e.preventDefault();
            setFocusLibrarySearch(true);
            if (selectedCollectionId != null) {
              navigateToLibrary(selectedCollectionId);
            } else {
              navigate('library');
            }
            return;
          }
        }
      }

      if (e.key === 'Escape') {
        // If a dialog/modal is open, let its own Escape handler deal with it first.
        // We check for common modal/dialog indicators in the DOM.
        const modalEl = document.querySelector('[role="dialog"], [data-modal], [data-escape-to-close]');
        if (modalEl) {
          // Dispatch a synthetic Escape on the modal so its own listeners can close it.
          const synthetic = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
          });
          modalEl.dispatchEvent(synthetic);
          e.preventDefault();
          return;
        }

        // Otherwise go back
        e.preventDefault();
        goBack();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, goBack, navigateToMediaCreate, navigateToLibrary, setFocusLibrarySearch, selectedCollectionId]);
}
