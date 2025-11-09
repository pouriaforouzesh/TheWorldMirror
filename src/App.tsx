import React, { useState, useEffect, useMemo } from 'react';
import FortuneTeller from './components/FortuneTeller';
import CreativeStudio from './components/CreativeStudio';
import Converse from './components/Converse';
import MediaAnalyzer from './components/MediaAnalyzer';
import { CelestialIcon } from './constants';
import { LanguageContext } from './LanguageContext';
import { translations } from './translations';

type ActiveApp = 'fortune' | 'creative' | 'converse' | 'analyzer';

const App: React.FC = () => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [activeApp, setActiveApp] = useState<ActiveApp>('fortune');

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = ['fa', 'ar'].includes(language) ? 'rtl' : 'ltr';
    document.title = translations[language as keyof typeof translations]?.appName || 'The World Mirror';
  }, [language]);

  const t = (key: string, replacements: { [key: string]: string } = {}) => {
    let translation = translations[language as keyof typeof translations]?.[key as keyof typeof translations['en']] || translations['en'][key as keyof typeof translations['en']];
    if(translation) {
      Object.keys(replacements).forEach(placeholder => {
          translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
      });
    }
    return translation;
  };
  
  const contextValue = useMemo(() => ({ language, setLanguage, t }), [language]);
  
  const NavButton = ({ app, label }: { app: ActiveApp, label: string }) => (
    <button 
      onClick={() => setActiveApp(app)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${activeApp === app ? 'bg-slate-800/50 border-b-2 border-indigo-400 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}
    >
        {label}
    </button>
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      <div className="min-h-screen font-sans text-slate-200">
        <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md shadow-lg shadow-indigo-900/10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <CelestialIcon className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                {t('appName')}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded-md py-2 pl-3 pr-8 text-white focus:ring-2 focus:ring-indigo-500 appearance-none"
                  aria-label="Select language"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="fa">فارسی</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="hi">हिन्दी</option>
                  <option value="ar">العربية</option>
                  <option value="zh">中文 (简体)</option>
                  <option value="ja">日本語</option>
                  <option value="pt">Português</option>
                  <option value="mr">मराठी</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="border-b border-slate-700 mb-8">
                <nav className="flex space-x-2" aria-label="Tabs">
                    <NavButton app="fortune" label="Celestial Reading" />
                    <NavButton app="creative" label="Creative Studio" />
                    <NavButton app="converse" label="Converse with AI" />
                    <NavButton app="analyzer" label="Media Analyzer" />
                </nav>
            </div>

          <div className="animate-fade-in-up">
            {activeApp === 'fortune' && <FortuneTeller />}
            {activeApp === 'creative' && <CreativeStudio />}
            {activeApp === 'converse' && <Converse />}
            {activeApp === 'analyzer' && <MediaAnalyzer />}
          </div>
        </main>
        
        <footer className="text-center py-6 text-slate-500 text-sm">
          <p>{t('footer')}</p>
        </footer>
      </div>
    </LanguageContext.Provider>
  );
};

export default App;