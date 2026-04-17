
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { Languages, Check, ChevronRight } from 'lucide-react';
import { Language } from '../translations';

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();

  const languages: { code: Language; name: string; native: string }[] = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto px-4 py-8 sm:py-12"
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t('settings.title') || 'Settings'}</h1>
          <p className="text-zinc-500 mt-2">{t('settings.subtitle') || 'Manage your preferences and account settings'}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Languages className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold">{t('settings.language') || 'Language'}</h3>
                <p className="text-xs text-zinc-500">{t('settings.languageDesc') || 'Choose your preferred language'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  language === lang.code
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    language === lang.code ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}>
                    {lang.code.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{lang.name}</p>
                    <p className="text-xs text-zinc-500">{lang.native}</p>
                  </div>
                </div>
                {language === lang.code ? (
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
          <p className="text-xs text-zinc-500 leading-relaxed">
            {t('settings.info') || 'Changing the language will update the entire interface. We are constantly adding support for more languages to make KamayiChowk accessible to everyone.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
