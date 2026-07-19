import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { configure as configureUIKit } from '@gravity-ui/uikit';
import { configure as configureMarkdownEditor } from '@gravity-ui/markdown-editor';

// Register French keysets on the editor's internal i18n instance.
// This import has side-effects only (no exports used).
import '@/i18n/gravityMarkdownEditorFr';

/**
 * Hook to keep Gravity UI components in sync with React i18n language.
 *
 * Gravity UI ships 'en' and 'ru' out of the box. French keysets are registered
 * via gravityMarkdownEditorFr.ts so we can pass 'fr' directly instead of
 * falling back to 'ru'.
 */
export const useGravityUII18n = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const updateGravityUILanguage = () => {
      // Now that 'fr' keysets are registered we can pass it through directly.
      // Any other unsupported language falls back to 'en'.
      const lang = i18n.language === 'fr' ? 'fr' : 'en';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configureUIKit({ lang: lang as any });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configureMarkdownEditor({ lang: lang as any });
    };

    i18n.on('languageChanged', updateGravityUILanguage);
    updateGravityUILanguage();

    return () => {
      i18n.off('languageChanged', updateGravityUILanguage);
    };
  }, [i18n]);
};