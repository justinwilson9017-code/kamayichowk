import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { Sun, Moon, LogOut, User as UserIcon, LayoutDashboard, Briefcase, Shield, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationDropdown from './NotificationDropdown';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ user, onLogout, theme, onToggleTheme }: NavbarProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = user ? [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/profile", icon: UserIcon, label: "Profile" },
    ...(user.isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin", color: "text-purple-500" }] : []),
  ] : [];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            kamayichowk
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onToggleTheme}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {user ? (
            <>
              <NotificationDropdown user={user} />
              
              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-emerald-500 transition-colors ${link.color || ''}`}
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
                  <span>Logout</span>
                </button>
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/auth"
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Get Started
              </Link>
              <Link
                to="/auth?admin=true"
                className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors"
                title="Admin Login"
              >
                <UserIcon className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && user && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="p-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-4 rounded-xl font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${link.color || ''}`}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                  navigate('/');
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
