import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'tr' | 'en';

const STORAGE_KEY = 'nextted-language';

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'tr';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

// Turkish is the default for every visitor unless they've explicitly
// switched before (remembered via localStorage on this device).
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage errors (private browsing, etc.) - language just
      // won't persist across visits, which is a fine fallback.
    }
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: setLanguageState,
        toggleLanguage: () => setLanguageState(prev => (prev === 'tr' ? 'en' : 'tr')),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

// Small helper so each page can write `t({ tr: '...', en: '...' })`
// instead of repeating `language === 'tr' ? x : y` everywhere.
export function useTranslate() {
  const { language } = useLanguage();
  return <T,>(pair: Record<Language, T>): T => pair[language];
}
