import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Role } from '../types';
import { Mail, Lock, User as UserIcon, Briefcase, ArrowRight, MapPin, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>((searchParams.get('role') as Role) || 'worker');
  const [field, setField] = useState('labor');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your Secrets.');
      setLoading(false);
      return;
    }

    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'justinwilson9017@gmail.com';
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin706';
    const isAdmin = email === adminEmail ? 1 : 0;

    try {
      if (isLogin) {
        // Special case for the requested admin credentials
        if (email === adminEmail && password === adminPassword) {
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

          if (!existingUser) {
            const { data: newUser, error: insertError } = await supabase
              .from('users')
              .insert([{ email, password, name: 'Super Admin', role: 'admin', is_admin: 1 }])
              .select()
              .single();
            if (insertError) throw insertError;
            onLogin({ ...newUser, isAdmin: true });
          } else {
            const { data: updatedUser, error: updateError } = await supabase
              .from('users')
              .update({ is_admin: 1, role: 'admin' })
              .eq('email', email)
              .select()
              .single();
            if (updateError) throw updateError;
            onLogin({ ...updatedUser, isAdmin: true });
          }
        } else {
          const { data: user, error: loginError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

          if (loginError) throw new Error('Invalid credentials');
          if (!user) throw new Error('Invalid credentials');
          onLogin({ ...user, isAdmin: !!user.is_admin });
        }
      } else {
        const { data: newUser, error: regError } = await supabase
          .from('users')
          .insert([{ 
            email, 
            password, 
            name, 
            role: isAdmin ? 'admin' : role, 
            field, 
            location: location || '', 
            is_admin: isAdmin 
          }])
          .select()
          .single();

        if (regError) throw regError;
        onLogin({ ...newUser, isAdmin: !!newUser.is_admin });
      }
      
      navigate('/dashboard');
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Connection error: Could not reach Supabase. Please check your SUPABASE_URL and internet connection.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto px-4 py-12"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            {isLogin ? 'Welcome Back' : 'Join KamayiChowk'}
          </h2>
          <p className="text-sm text-zinc-500">
            {isLogin ? 'Enter your credentials to continue' : 'Start your journey today'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">I am here to</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('worker')}
                    className={`py-3 rounded-2xl border-2 font-semibold transition-all ${
                      role === 'worker' 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/50'
                    }`}
                  >
                    WORK
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('hirer')}
                    className={`py-3 rounded-2xl border-2 font-semibold transition-all ${
                      role === 'hirer' 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/50'
                    }`}
                  >
                    HIRE
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="e.g. New York, NY"
                  />
                </div>
              </div>

              {role === 'worker' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Expertise</label>
                  <select
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold"
                  >
                    <option value="labor">Labor</option>
                    <option value="electrician">Electrician</option>
                    <option value="plumber">Plumber</option>
                    <option value="carpenter">Carpenter</option>
                    <option value="mechanic">Mechanic</option>
                  </select>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="email"
                id="user_email_login"
                name="user_email_login"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="password"
                id="user_password_login"
                name="user_password_login"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-semibold text-zinc-500 hover:text-emerald-500 transition-colors uppercase tracking-wider"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
