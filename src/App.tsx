import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import WorkerDashboard from './pages/WorkerDashboard';
import HirerDashboard from './pages/HirerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <Router>
      <div className={`min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}>
        <Navbar user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
        <main className="pt-16">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/auth" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" />} />
              
              <Route 
                path="/dashboard" 
                element={
                  user?.role === 'worker' ? <WorkerDashboard user={user} /> :
                  user?.role === 'hirer' ? <HirerDashboard user={user} /> :
                  user?.role === 'admin' ? <AdminDashboard user={user} /> :
                  <Navigate to="/auth" />
                } 
              />

              <Route 
                path="/admin" 
                element={
                  user?.isAdmin ? <AdminDashboard user={user} /> : <Navigate to="/" />
                } 
              />
              
              <Route 
                path="/profile" 
                element={user ? <Profile user={user} onUpdate={handleLogin} /> : <Navigate to="/auth" />} 
              />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </Router>
  );
}
