import { User } from '../types';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, ShieldCheck, Users } from 'lucide-react';

export default function Home({ user }: { user: User | null }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4"
    >
      <div className="max-w-3xl w-full text-center space-y-8 py-20">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Secure & Verified Marketplace
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white"
        >
          Connecting skilled labor with <span className="text-emerald-500">quality projects</span>
        </motion.h1>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto"
        >
          KamayiChowk is the simplest way to find work or hire talent. 
          Real-time updates, direct communication, and verified professionals.
        </motion.p>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link
            to={user ? "/dashboard" : "/auth?role=worker"}
            className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            Find Work
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to={user ? "/dashboard" : "/auth?role=hirer"}
            className="w-full sm:w-auto px-8 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            Hire Talent
          </Link>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full py-20 border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="space-y-2 text-center md:text-left">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto md:mx-0">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">Verified Users</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">All workers and hirers are vetted for quality.</p>
        </div>
        <div className="space-y-2 text-center md:text-left">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto md:mx-0">
            <Briefcase className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">Real-time Jobs</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Get notified the second a new job is posted.</p>
        </div>
        <div className="space-y-2 text-center md:text-left">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mx-auto md:mx-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">Secure Platform</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Your data and projects are always protected.</p>
        </div>
      </div>
    </motion.div>
  );
}
