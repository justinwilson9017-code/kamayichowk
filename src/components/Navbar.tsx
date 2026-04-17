import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';
import { Sun, Moon, LogOut, User as UserIcon, LayoutDashboard, Briefcase, Shield, Menu, X, Languages, Bell, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationDropdown from './NotificationDropdown';
import { useLanguage } from '../LanguageContext';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ user, onLogout, theme, onToggleTheme }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { language, setLanguage, t, isRTL } = useLanguage();

  const navLinks = user ? [
    { to: "/", icon: Briefcase, label: t('nav.home') },
    { to: "/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/profile", icon: UserIcon, label: t('nav.profile') },
    { to: "/settings", icon: SettingsIcon, label: t('nav.settings') || 'Settings' },
    ...(user.isAdmin ? [{ to: "/admin", icon: Shield, label: t('nav.admin'), color: "text-purple-500" }] : []),
  ] : [];

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ur' : 'en');
  };

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-4 min-w-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-zinc-900 dark:text-white" />
            </button>
            
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                kamayichowk
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            {user && <NotificationDropdown user={user} />}
            
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-emerald-500 transition-colors ${link.color || ''} ${location.pathname === link.to ? 'text-emerald-500' : ''}`}
                  >
                    <link.icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                ))}
                <button
                  onClick={() => {
                    onLogout();
                    navigate('/');
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors whitespace-nowrap shadow-lg shadow-emerald-500/20"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Side Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            />
            
            {/* Side Drawer */}
            <motion.div
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} bottom-0 w-full sm:w-[320px] bg-white dark:bg-zinc-950 z-[9999] flex flex-col shadow-2xl overflow-hidden border-r border-zinc-200 dark:border-zinc-800`}
            >
              {/* Menu Header */}
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950">
                <Link to="/" onClick={() => setIsDrawerOpen(false)} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    kamayichowk
                  </span>
                </Link>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-900 dark:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Menu Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {user ? (
                  <>
                    {/* User Profile Summary */}
                    <div className="flex items-center gap-3 p-3 mb-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        {user.picture ? (
                          <img src={user.picture} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{user.name}</h4>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{user.role}</p>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    {navLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs ${
                          location.pathname === link.to 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'text-zinc-900 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <link.icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </Link>
                    ))}

                    <button
                      onClick={() => {
                        navigate('/dashboard');
                        setIsDrawerOpen(false);
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <Bell className="w-5 h-5" />
                      <span>{t('nav.notifications') || 'Notifications'}</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/auth"
                      className="flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    >
                      <LogOut className="w-5 h-5 rotate-180" />
                      <span>{t('nav.login')}</span>
                    </Link>
                    <Link
                      to="/auth?admin=true"
                      className="flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin Login</span>
                    </Link>
                  </div>
                )}

                {/* Preferences */}
                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                  <button
                    onClick={onToggleTheme}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-4">
                      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      <span>Dark Mode</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                      <motion.div animate={{ x: theme === 'dark' ? 20 : 4 }} className="absolute top-1 w-3 h-3 bg-white rounded-full" />
                    </div>
                  </button>

                  <button
                    onClick={toggleLanguage}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] sm:text-xs text-zinc-900 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-4">
                      <Languages className="w-5 h-5" />
                      <span>Language</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{language === 'en' ? 'EN' : 'اردو'}</span>
                  </button>
                </div>
              </div>

              {/* Logout */}
              {user && (
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onLogout();
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase tracking-widest text-[10px] sm:text-xs"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
