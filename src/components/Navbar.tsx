import { Link, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { Sun, Moon, LogOut, User as UserIcon, LayoutDashboard, Briefcase, Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Navbar({ user, onLogout, theme, onToggleTheme }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            kamayichowk
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={onToggleTheme}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {user ? (
            <div className="flex items-center gap-4">
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-emerald-500 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:text-emerald-500 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <button
                onClick={() => {
                  onLogout();
                  navigate('/');
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
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
    </nav>
  );
}
