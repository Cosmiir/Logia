import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ToasterProvider, ThemeProvider, configure as configureUIKit } from "@gravity-ui/uikit";
import { toaster } from "@gravity-ui/uikit/toaster-singleton";
import { configure as configureMarkdownEditor } from "@gravity-ui/markdown-editor";
import i18next from "i18next";
import App from "./App";
import { ThemeProvider as CustomThemeProvider } from "./contexts/ThemeContext";
import "./i18n/config";
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";
import "./styles/global.css";
import "./styles/markdown-editor.css";

// Configure Gravity UI components to match application language
const configureGravityUII18n = () => {
  const currentLanguage = localStorage.getItem('logia-language') || 'en';
  
  // Map React i18n language to Gravity UI language codes
  const gravityUILanguage = currentLanguage === 'fr' ? 'fr' : 'en';
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configureUIKit({ lang: gravityUILanguage as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configureMarkdownEditor({ lang: gravityUILanguage as any });
};

// Initialize Gravity UI i18n configuration
configureGravityUII18n();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toaster.add({
        name: 'mutation-error',
        title: i18next.t('common.error'),
        content: message,
        theme: 'danger',
        autoHiding: 4000,
        isClosable: true,
      });
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme="dark">
      <ToasterProvider toaster={toaster}>
        <CustomThemeProvider>
          <App />
        </CustomThemeProvider>
      </ToasterProvider>
    </ThemeProvider>
  </QueryClientProvider>,
);