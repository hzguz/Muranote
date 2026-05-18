import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: typeof TRANSLATIONS['en'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_STORAGE_KEY = 'muranote_lang';

interface LanguageProviderProps {
    children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [lang, setLangState] = useState<Language>(() => {
        const saved = localStorage.getItem(LANG_STORAGE_KEY) as Language;
        return saved === 'en' ? saved : 'en';
    });

    const t = TRANSLATIONS[lang];

    useEffect(() => {
        // Persist preference
        localStorage.setItem(LANG_STORAGE_KEY, lang);
    }, [lang]);

    const setLang = (newLang: Language) => {
        setLangState(newLang);
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export default LanguageContext;
