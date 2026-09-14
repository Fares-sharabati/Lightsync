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

// Claude's audience localization commit introduced a UTF-8 -> Latin-1/Windows-1252
// mojibake into a number of Turkish translation strings (for example
// "BAÄLANDINIZ" instead of "BAĞLANDINIZ"). Keep the fix in the translation
// boundary so existing screens are repaired without touching their behavior,
// Firebase data, or the bilingual architecture.
function repairMojibake(value: string): string {
  if (!/[ÃÂÄÅ]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(value, char => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
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
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

// Small helper so each page can write `t({ tr: '...', en: '...' })`
// instead of repeating `language === 'tr' ? x : y` everywhere.
export function useTranslate() {
  const { language } = useLanguage();
  return <T,>(pair: Record<Language, T>): T => {
    const value = pair[language];
    return typeof value === 'string' ? (repairMojibake(value) as T) : value;
  };
}
