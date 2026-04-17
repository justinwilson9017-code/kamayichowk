import { useState, useEffect } from 'react';
import { User, Job } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Briefcase, MessageSquare, TrendingUp, Trash2, Shield, UserX, CheckCircle, XCircle, Plus, Edit, Database, Terminal, Copy, AlertCircle, LogOut, History, Phone, Mail, MapPin, Calendar, ExternalLink, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import { useLanguage } from '../LanguageContext';

export default function AdminDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'users' | 'database' | 'logs'>('overview');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  
  // Job Form State
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobField, setJobField] = useState('labor');
  const [jobBudget, setJobBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchJobs();
    fetchUsers();
    fetchLogs();
  }, []);

  const fetchStats = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: totalJobs } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
      const { count: totalBids } = await supabase.from('bids').select('*', { count: 'exact', head: true });
      
      const { data: allJobs } = await supabase.from('jobs').select('field');
      const { data: allUsers } = await supabase.from('users').select('role');

      const jobsByField = allJobs ? Object.entries(
        allJobs.reduce((acc: any, curr) => {
          acc[curr.field] = (acc[curr.field] || 0) + 1;
          return acc;
        }, {})
      ).map(([field, count]) => ({ field, count })) : [];

      const usersByRole = allUsers ? Object.entries(
        allUsers.reduce((acc: any, curr) => {
          acc[curr.role] = (acc[curr.role] || 0) + 1;
          return acc;
        }, {})
      ).map(([role, count]) => ({ role, count })) : [];

      setStats({
        totalUsers,
        totalJobs,
        totalBids,
        jobsByField,
        usersByRole
      });
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch stats');
    }
  };

  const fetchJobs = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, hirer:users!jobs_hirer_id_fkey(name)')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedJobs = (data || []).map(j => ({
        ...j,
        hirer_name: (j as any).hirer?.name
      }));

      // Deduplicate
      const uniqueJobs = Array.from(new Map(formattedJobs.map(j => [j.id, j])).values());
      setJobs(uniqueJobs);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, field, is_admin, created_at, phone, picture, location, last_seen')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Deduplicate
      const uniqueUsers = Array.from(new Map((data || []).map(u => [u.id, u])).values());
      setUsers(uniqueUsers);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch users');
      setUsers([]);
    }
  };

  const fetchLogs = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Deduplicate
      const uniqueLogs = Array.from(new Map((data || []).map(l => [l.id, l])).values());
      setLogs(uniqueLogs);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleUpdateJobStatus = async (id: number, status: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm(`${t('admin.adminAction')}: ${t('admin.deleteUser')}`)) return;
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== id));
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingJob) {
        const { error } = await supabase
          .from('jobs')
          .update({
            title: jobTitle,
            description: jobDesc,
            field: jobField,
            budget: parseFloat(jobBudget),
          })
          .eq('id', editingJob.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert([{
            hirer_id: user.id,
            title: jobTitle,
            description: jobDesc,
            field: jobField,
            budget: parseFloat(jobBudget),
          }]);
        if (error) throw error;

        // Notify workers in this field
        const { data: workers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'worker')
          .eq('field', jobField);
        
        if (workers) {
          for (const worker of workers) {
            await notificationService.send({
              user_id: worker.id,
              title: 'New Job in Your Field',
              message: `A new ${jobField} job has been posted by Admin: ${jobTitle}`,
              type: 'job_new',
              link: '/dashboard'
            });
          }
        }
      }
      
      fetchJobs();
      setShowJobModal(false);
      resetJobForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetJobForm = () => {
    setEditingJob(null);
    setJobTitle('');
    setJobDesc('');
    setJobField('labor');
    setJobBudget('');
  };

  const openEditJob = (job: Job) => {
    setEditingJob(job);
    setJobTitle(job.title);
    setJobDesc(job.description);
    setJobField(job.field);
    setJobBudget(job.budget.toString());
    setShowJobModal(true);
  };

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'justinwilson9017@gmail.com';
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin706';

  const sqlCode = `-- Database Schema for KamayiChowk (PostgreSQL / Supabase)
-- Generated on: ${new Date().toISOString()}

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'worker', 'hirer', 'admin'
  field TEXT, -- for workers: 'labor', 'electrician', etc.
  location TEXT,
  picture TEXT,
  phone TEXT,
  is_admin INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE,
  hourly_rate REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  hirer_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  field TEXT NOT NULL,
  location TEXT,
  budget REAL NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'deleted', 'pending', 'assigned', 'in_progress'
  booking_type TEXT DEFAULT 'bid', -- 'bid', 'instant'
  assigned_worker_id INTEGER REFERENCES users(id),
  assigned_worker_name TEXT,
  assigned_worker_picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bids Table
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  worker_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'job_new', 'bid_update', 'bid_new', 'review_request', 'message', 'bid_accepted', 'bid_rejected'
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  hirer_id INTEGER NOT NULL REFERENCES users(id),
  worker_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Messages Table (Chat System)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  receiver_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL, -- 'login', 'logout', 'profile_update', etc.
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable Realtime (Supabase Specific)
-- Run this to enable real-time for these tables
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table bids;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table reviews;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table activity_logs;

-- 9. Insert Admin User
INSERT INTO users (email, password, name, role, is_admin) 
VALUES ('${adminEmail}', '${adminPassword}', 'Super Admin', 'admin', 1)
ON CONFLICT (email) DO NOTHING;

-- ==========================================
-- MIGRATION SCRIPT (Run this if you already have tables)
-- ==========================================
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_worker_id INTEGER REFERENCES users(id);
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_worker_name TEXT;
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_worker_picture TEXT;
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate REAL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
`;

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">Supabase Configuration Required</h1>
        <p className="text-zinc-500 mb-8">
          Please add <code className="bg-zinc-100 px-2 py-1 rounded">SUPABASE_URL</code> and 
          <code className="bg-zinc-100 px-2 py-1 rounded ml-2">SUPABASE_ANON_KEY</code> to your project secrets to enable the dashboard.
        </p>
      </div>
    );
  }

  if (!stats) return <div className="p-8 flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
  </div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-2xl shrink-0">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold truncate">{t('admin.console')}</h1>
            <p className="text-xs sm:text-sm text-zinc-500 truncate">{t('admin.consoleSub')}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl overflow-x-auto no-scrollbar border border-zinc-200 dark:border-zinc-800">
          {[
            { id: 'overview', icon: TrendingUp, label: t('admin.overview') },
            { id: 'jobs', icon: Briefcase, label: t('admin.jobs') },
            { id: 'users', icon: Users, label: t('admin.users') },
            { id: 'logs', icon: History, label: t('admin.logs') },
            { id: 'database', icon: Database, label: t('admin.sqlCode') }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {tab.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl flex flex-col gap-4"
        >
          <div className="flex items-start gap-4">
            <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-400">Database Connection Issue</h3>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
              {error.includes('column') && (
                <div className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">How to fix this:</p>
                  <ol className="text-xs text-zinc-600 dark:text-zinc-400 list-decimal list-inside space-y-1">
                    <li>Go to your <strong>Supabase Dashboard</strong></li>
                    <li>Open the <strong>SQL Editor</strong></li>
                    <li>Paste the <strong>Migration Script</strong> (from the Database tab below)</li>
                    <li>Click <strong>Run</strong></li>
                    <li>If the error persists, go to <strong>Settings {'>'} API</strong> and click <strong>"Reload PostgREST Schema"</strong></li>
                  </ol>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(sqlCode);
                alert('SQL Code copied to clipboard!');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy SQL Schema
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-zinc-700 transition-all"
            >
              <Database className="w-3.5 h-3.5" />
              View SQL Code
            </button>
          </div>
          <p className="text-red-600 dark:text-red-400 text-[10px] opacity-70">
            Run this code in your Supabase SQL Editor to create the required tables.
          </p>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<Users />} label={t('admin.totalUsers')} value={stats.totalUsers} color="emerald" />
              <StatCard icon={<Briefcase />} label={t('admin.activeJobs')} value={stats.totalJobs} color="blue" />
              <StatCard icon={<MessageSquare />} label={t('admin.totalBids')} value={stats.totalBids} color="amber" />
              <StatCard icon={<TrendingUp />} label={t('admin.growth')} value="+12%" color="purple" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-bold mb-6">{t('admin.categoryDist')}</h3>
                <div className="space-y-4">
                  {stats.jobsByField.map((item: any) => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                      <span className="capitalize font-medium">{t(`fields.${item.field}`)}</span>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-bold">{item.count} {t('admin.jobs').toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-bold mb-6">{t('admin.roleDist')}</h3>
                <div className="space-y-4">
                  {stats.usersByRole.map((item: any) => (
                    <div key={item.role} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                      <span className="capitalize font-medium">{item.role === 'worker' ? t('auth.roleWork').toLowerCase() : item.role === 'hirer' ? t('auth.roleHire').toLowerCase() : item.role}</span>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm font-bold">{item.count} {t('admin.users').toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'jobs' && (
          <motion.div
            key="jobs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{t('admin.manageJobs')} ({jobs.length})</h3>
              <button 
                onClick={() => { resetJobForm(); setShowJobModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
              >
                <Plus className="w-4 h-4" />
                {t('admin.createJob')}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg">{job.title}</h4>
                      {job.booking_type === 'instant' && (
                        <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border border-amber-500/20">
                          {t('dashboard.instantBooking')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-500">
                      <span>{job.hirer_name}</span>
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs capitalize">{t(`fields.${job.field}`)}</span>
                      <span className="font-bold text-emerald-500">PKR {job.budget}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                      job.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 
                      job.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                      {job.status === 'active' ? t('dashboard.active') : 
                       job.status === 'completed' ? t('dashboard.completed') : 
                       job.status === 'pending' ? t('dashboard.pending') :
                       job.status}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditJob(job)} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors"><Edit className="w-4 h-4" /></button>
                      {job.status === 'active' ? (
                        <button onClick={() => handleUpdateJobStatus(job.id, 'deactivated')} className="p-2 text-zinc-400 hover:text-amber-500 transition-colors"><XCircle className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => handleUpdateJobStatus(job.id, 'active')} className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"><CheckCircle className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleUpdateJobStatus(job.id, 'deleted')} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{t('admin.users')} ({users.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((u) => (
                <div 
                  key={u.id} 
                  onClick={() => setSelectedUser(u)}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex justify-between items-center cursor-pointer hover:border-emerald-500/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden">
                      {u.picture ? (
                        <img src={u.picture} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold group-hover:text-emerald-500 transition-colors">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      {u.phone && <p className="text-[10px] text-zinc-400 font-medium">{u.phone}</p>}
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' :
                          u.role === 'hirer' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>{u.role}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(u.id);
                    }}
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    disabled={u.email === adminEmail}
                  >
                    <UserX className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{t('admin.securityLogs')}</h3>
              <button 
                onClick={fetchLogs}
                className="text-xs font-bold text-emerald-500 hover:text-emerald-600 uppercase tracking-widest"
              >
                {t('admin.refreshLogs')}
              </button>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-bottom border-zinc-200 dark:border-zinc-800">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('admin.user')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('admin.action')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('admin.ipAddress')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('admin.time')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{log.users?.name || 'Unknown'}</span>
                            <span className="text-[10px] text-zinc-500">{log.users?.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.action === 'login' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                          {log.ip_address || '0.0.0.0'}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 font-medium italic">
                          {t('admin.noLogs')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'database' && (
          <motion.div
            key="database"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Terminal className="w-32 h-32 text-emerald-500" />
              </div>
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Database className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{t('admin.sqlSchema')}</h3>
                </div>
                <button 
                  onClick={() => navigator.clipboard.writeText(sqlCode)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition-all"
                >
                  <Copy className="w-4 h-4" />
                  {t('admin.copyCode')}
                </button>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 font-mono text-sm text-emerald-400 overflow-x-auto relative z-10 border border-zinc-800">
                <pre className="whitespace-pre-wrap">{sqlCode}</pre>
              </div>
              
              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative z-10">
                <p className="text-sm text-emerald-500 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t('admin.sqlInfo')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Modal (Create/Edit) */}
      <AnimatePresence>
        {showJobModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowJobModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-6">{editingJob ? t('admin.editJob') : t('admin.createJob')}</h2>
                <form onSubmit={handleSaveJob} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('admin.jobTitle')}</label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="e.g. Expert Plumber Needed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('admin.description')}</label>
                    <textarea
                      required
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                      placeholder="Describe the job requirements..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('admin.category')}</label>
                      <select
                        value={jobField}
                        onChange={(e) => setJobField(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="labor">{t('fields.labor')}</option>
                        <option value="electrician">{t('fields.electrician')}</option>
                        <option value="plumber">{t('fields.plumber')}</option>
                        <option value="carpenter">{t('fields.carpenter')}</option>
                        <option value="mechanic">{t('fields.mechanic')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('admin.budget')}</label>
                      <input
                        type="number"
                        required
                        value={jobBudget}
                        onChange={(e) => setJobBudget(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowJobModal(false)}
                      className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 font-bold rounded-xl"
                    >
                      {t('admin.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                    >
                      {submitting ? t('admin.saving') : editingJob ? t('admin.updateJob') : t('admin.createJob')}
                    </button>
                  </div>
                </form>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="h-32 bg-emerald-500 relative">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute -bottom-12 left-8 w-24 h-24 bg-white dark:bg-zinc-900 rounded-3xl p-1 shadow-xl">
                  <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden">
                    {selectedUser.picture ? (
                      <img src={selectedUser.picture} alt={selectedUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Users className="w-10 h-10 text-zinc-300" />
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-16 pb-8 px-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                      selectedUser.role === 'admin' ? 'bg-purple-500/10 text-purple-500' :
                      selectedUser.role === 'hirer' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {selectedUser.role}
                    </span>
                    {selectedUser.field && (
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full text-[10px] uppercase font-bold">
                        {selectedUser.field}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                      <Mail className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</p>
                      <p className="font-bold text-sm truncate">{selectedUser.email}</p>
                    </div>
                    <a href={`mailto:${selectedUser.email}`} className="ml-auto p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 rounded-lg transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                      <Phone className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Phone Number</p>
                      <p className="font-bold text-sm">{selectedUser.phone || 'Not provided'}</p>
                    </div>
                    {selectedUser.phone && (
                      <a href={`tel:${selectedUser.phone}`} className="ml-auto p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                      <MapPin className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Location</p>
                      <p className="font-bold text-sm">{selectedUser.location || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                      <Calendar className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Joined On</p>
                      <p className="font-bold text-sm">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-2xl hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white transition-all uppercase tracking-widest text-xs"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
  const colorClasses: any = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-zinc-500 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}
