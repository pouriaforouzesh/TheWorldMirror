import React, { useContext, useState } from 'react';
import { LanguageContext } from '../../LanguageContext';

interface GuideWelcomeProps {
  onDismiss: () => void;
}

const GuideWelcome: React.FC<GuideWelcomeProps> = ({ onDismiss }) => {
  const { t } = useContext(LanguageContext);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = () => {
    setIsDismissing(true);
    // Wait for animation to complete before calling parent onDismiss
    setTimeout(() => {
      onDismiss();
    }, 600); // Animation is 0.5s, give it a little buffer
  };

  const Sparkles = () => (
    <>
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="sparkle"
          style={{
            top: '50%',
            left: '50%',
            // @ts-ignore
            '--tx': `${(Math.random() - 0.5) * 300}px`,
            '--ty': `${(Math.random() - 0.5) * 300}px`,
          }}
        />
      ))}
    </>
  );

  return (
    <div 
      className={`relative p-6 mb-8 bg-indigo-900/50 border border-indigo-700 rounded-xl shadow-lg ${isDismissing ? 'animate-cosmic-implode' : 'animate-fade-in-up'}`}
    >
      {isDismissing && <Sparkles />}
      <div className={isDismissing ? 'opacity-0 transition-opacity duration-200' : ''}>
         <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-yellow-300 animate-pulse"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <h3 className="text-xl font-bold text-purple-300 mb-2">{t('welcome_title')}</h3>
        <p className="text-slate-300 pr-10 rtl:pl-10 rtl:pr-0">{t('welcome_message')}</p>
        <button 
          onClick={handleDismiss} 
          className="mt-4 bg-slate-700 text-slate-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-600 transition-colors"
        >
          {t('welcome_dismiss')}
        </button>
      </div>
    </div>
  );
};

export default GuideWelcome;