import { User } from '../types';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, ShieldCheck, Users } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export default function Home({ user }: { user: User | null }) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12 sm:py-20"
    >
      <div className="max-w-3xl w-full text-center space-y-4 sm:space-y-8 py-6 sm:py-20">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider"
        >
          <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          Secure & Verified Marketplace
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]"
        >
          {t('home.heroTitle')}
        </motion.h1>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto px-4"
        >
          {t('home.heroSubtitle')}
        </motion.p>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 px-4"
        >
          <Link
            to={user ? "/dashboard" : "/auth?role=worker"}
            className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-sm sm:text-base uppercase tracking-wider"
          >
            {t('home.findWork')}
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to={user ? "/dashboard" : "/auth?role=hirer"}
            className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base uppercase tracking-wider"
          >
            {t('home.hireWorker')}
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl w-full py-12 sm:py-20 border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">{t('home.feature1Title')}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('home.feature1Desc')}</p>
        </div>
        <div className="space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
            <Briefcase className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">{t('home.feature3Title')}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('home.feature3Desc')}</p>
        </div>
        <div className="space-y-2 text-center sm:text-left sm:col-span-2 md:col-span-1">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">{t('home.feature2Title')}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('home.feature2Desc')}</p>
        </div>
      </div>
    </motion.div>
  );
}
