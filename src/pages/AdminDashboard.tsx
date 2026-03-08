import { useState, useEffect } from 'react';
import { User, Job } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Briefcase, MessageSquare, TrendingUp, Trash2, Shield, UserX, CheckCircle, XCircle, Plus, Edit, Database, Terminal, Copy, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export default function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'users' | 'database'>('overview');
  
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
        .select('*, hirer:users(name)')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedJobs = (data || []).map(j => ({
        ...j,
        hirer_name: (j as any).hirer?.name
      }));

      setJobs(formattedJobs);
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
        .select('id, email, name, role, field, is_admin, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch users');
      setUsers([]);
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
    if (!confirm('Admin Action: Delete this user?')) return;
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
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'worker', 'hirer', 'admin'
  field TEXT, -- for workers: 'labor', 'electrician', etc.
  location TEXT,
  picture TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jobs Table
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  hirer_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  field TEXT NOT NULL,
  location TEXT,
  budget REAL NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'deleted'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bids Table
CREATE TABLE bids (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  worker_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Realtime (Supabase Specific)
-- Run this to enable real-time for these tables
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table bids;

-- 5. Insert Admin User
INSERT INTO users (email, password, name, role, is_admin) 
VALUES ('${adminEmail}', '${adminPassword}', 'Super Admin', 'admin', 1);`;

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Command Center</h1>
            <p className="text-zinc-500">Real-time platform overview and management</p>
          </div>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          {[
            { id: 'overview', icon: TrendingUp, label: 'Overview' },
            { id: 'jobs', icon: Briefcase, label: 'Jobs' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'database', icon: Database, label: 'SQL Code' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-500' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl flex items-start gap-4"
        >
          <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-800 dark:text-red-400">Database Connection Issue</h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            <div className="flex gap-3 mt-3">
              <button 
                onClick={() => navigator.clipboard.writeText(sqlCode)}
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
            <p className="text-red-600 dark:text-red-400 text-[10px] mt-3 opacity-70">
              Run this code in your Supabase SQL Editor to create the required tables.
            </p>
          </div>
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
              <StatCard icon={<Users />} label="Total Users" value={stats.totalUsers} color="emerald" />
              <StatCard icon={<Briefcase />} label="Active Jobs" value={stats.totalJobs} color="blue" />
              <StatCard icon={<MessageSquare />} label="Total Bids" value={stats.totalBids} color="amber" />
              <StatCard icon={<TrendingUp />} label="Growth" value="+12%" color="purple" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Category Distribution</h3>
                <div className="space-y-4">
                  {stats.jobsByField.map((item: any) => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                      <span className="capitalize font-medium">{item.field}</span>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-bold">{item.count} jobs</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Role Distribution</h3>
                <div className="space-y-4">
                  {stats.usersByRole.map((item: any) => (
                    <div key={item.role} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                      <span className="capitalize font-medium">{item.role}</span>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm font-bold">{item.count} users</span>
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
              <h3 className="text-xl font-bold">Manage Job Postings ({jobs.length})</h3>
              <button 
                onClick={() => { resetJobForm(); setShowJobModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create Job
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{job.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-zinc-500">
                      <span>{job.hirer_name}</span>
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs capitalize">{job.field}</span>
                      <span className="font-bold text-emerald-500">PKR {job.budget}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${job.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      {job.status}
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
              <h3 className="text-xl font-bold">User Management ({users.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((u) => (
                <div key={u.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
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
                    onClick={() => handleDeleteUser(u.id)}
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
                  <h3 className="text-xl font-bold text-white">SQL Schema & Admin Setup</h3>
                </div>
                <button 
                  onClick={() => navigator.clipboard.writeText(sqlCode)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition-all"
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </button>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 font-mono text-sm text-emerald-400 overflow-x-auto relative z-10 border border-zinc-800">
                <pre className="whitespace-pre-wrap">{sqlCode}</pre>
              </div>
              
              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative z-10">
                <p className="text-sm text-emerald-500 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  This SQL code includes the complete schema and the Super Admin initialization.
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
              <h2 className="text-2xl font-bold mb-6">{editingJob ? 'Edit Job' : 'Create New Job'}</h2>
              <form onSubmit={handleSaveJob} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Title</label>
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
                  <label className="text-sm font-medium">Description</label>
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
                    <label className="text-sm font-medium">Category</label>
                    <select
                      value={jobField}
                      onChange={(e) => setJobField(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="labor">Labor</option>
                      <option value="electrician">Electrician</option>
                      <option value="plumber">Plumber</option>
                      <option value="carpenter">Carpenter</option>
                      <option value="mechanic">Mechanic</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Budget (PKR)</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {submitting ? 'Saving...' : editingJob ? 'Update Job' : 'Create Job'}
                  </button>
                </div>
              </form>
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
