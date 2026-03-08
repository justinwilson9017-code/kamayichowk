import { useState } from 'react';
import { User } from '../types';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Shield, Briefcase, CheckCircle, MapPin } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function Profile({ user, onUpdate }: { user: User, onUpdate: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [location, setLocation] = useState(user.location || '');
  const [picture, setPicture] = useState(user.picture || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ name, email, location, picture })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      onUpdate({ ...data, isAdmin: !!data.is_admin });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="h-48 bg-emerald-500 relative">
          <div className="absolute -bottom-16 left-12 w-32 h-32 bg-white dark:bg-zinc-900 rounded-[2rem] p-1.5 shadow-2xl">
            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 rounded-[1.75rem] flex items-center justify-center overflow-hidden">
              {picture ? (
                <img src={picture} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-16 h-16 text-zinc-400" />
              )}
            </div>
          </div>
        </div>

        <div className="pt-24 pb-12 px-12 space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold">{user.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm font-semibold text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  {user.email}
                </p>
                <p className="text-sm font-semibold text-zinc-500 flex items-center gap-2 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  {user.location || 'No location set'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="px-5 py-2 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-semibold uppercase tracking-wider">
                {user.role}
              </span>
              {user.isAdmin && (
                <span className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-3 space-y-8">
              <h3 className="text-2xl font-bold">Edit Profile</h3>
              <form onSubmit={handleUpdate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    placeholder="e.g. London, UK"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Profile Picture URL</label>
                  <input
                    type="text"
                    value={picture}
                    onChange={(e) => setPicture(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 uppercase tracking-wider text-sm"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                  {success && <CheckCircle className="w-5 h-5" />}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <h3 className="text-2xl font-bold">Membership</h3>
              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</span>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-semibold uppercase tracking-wider">Free Tier</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Member Since</span>
                  <span className="font-semibold text-sm">March 2024</span>
                </div>
                <div className="pt-4">
                  <button className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500 dark:hover:text-white transition-all uppercase tracking-wider text-xs">
                    Upgrade to Pro
                  </button>
                </div>
              </div>

              {user.role === 'worker' && (
                <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold uppercase tracking-wider text-xs">
                    <Briefcase className="w-4 h-4" />
                    Expertise
                  </div>
                  <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                    You are registered as a <span className="text-emerald-600 font-semibold uppercase tracking-wider text-[10px]">{user.field}</span>. 
                    Your dashboard is optimized for this expertise.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
