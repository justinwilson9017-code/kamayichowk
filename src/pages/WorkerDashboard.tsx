import { useState, useEffect } from 'react';
import { User, Job, Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, MapPin, DollarSign, Clock, Send, CheckCircle, Trash2, AlertCircle, LogOut, Star, User as UserIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import { Review } from '../types';
import { useLanguage } from '../LanguageContext';

import ChatModal from '../components/ChatModal';

export default function WorkerDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my-bids' | 'reviews'>('available');

  // Chat State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string; picture?: string } | null>(null);
  const [chatJobId, setChatJobId] = useState<number | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchMyBids();
    fetchReviews();

    // Real-time subscriptions
    if (isSupabaseConfigured) {
      const jobsChannel = supabase
        .channel('worker-jobs-realtime')
        .on(
          'postgres_changes' as any,
          { 
            event: '*', 
            schema: 'public', 
            table: 'jobs' 
          },
          () => {
            fetchJobs();
          }
        )
        .subscribe();

      const bidsChannel = supabase
        .channel('worker-bids-realtime')
        .on(
          'postgres_changes' as any,
          { 
            event: '*', 
            schema: 'public', 
            table: 'bids', 
            filter: `worker_id=eq.${user.id}` 
          },
          () => {
            fetchMyBids();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(jobsChannel);
        supabase.removeChannel(bidsChannel);
      };
    }
  }, [user.field, user.id]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, hirer:users(name, picture)')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReviews = (data || []).map(r => ({
        ...r,
        hirer_name: (r as any).hirer?.name,
        hirer_picture: (r as any).hirer?.picture
      }));

      setReviews(formattedReviews);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  const fetchJobs = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      // Fetch all active public jobs OR instant jobs assigned to this worker
      const { data, error } = await supabase
        .from('jobs')
        .select('*, hirer:users!jobs_hirer_id_fkey(id, name, picture)')
        .or(`status.eq.active,and(status.eq.pending,assigned_worker_id.eq.${user.id})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedJobs = (data || []).map(j => ({
        ...j,
        hirer_name: (j as any).hirer?.name,
        hirer_id: (j as any).hirer?.id,
        hirer_picture: (j as any).hirer?.picture
      }));

      // Deduplicate jobs by ID
      const uniqueJobs = Array.from(new Map(formattedJobs.map(j => [j.id, j])).values());
      
      // Sort: Jobs matching worker's field first
      const sortedJobs = [...uniqueJobs].sort((a, b) => {
        if (a.field === user.field && b.field !== user.field) return -1;
        if (a.field !== user.field && b.field === user.field) return 1;
        return 0;
      });

      setJobs(sortedJobs);
    } catch (err: any) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*, job:jobs(*, hirer:users!jobs_hirer_id_fkey(id, name, picture))')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBids = (data || []).map(b => ({
        ...b,
        job_title: (b as any).job?.title,
        job_location: (b as any).job?.location,
        job_status: (b as any).job?.status,
        hirer_id: (b as any).job?.hirer?.id,
        hirer_name: (b as any).job?.hirer?.name,
        hirer_picture: (b as any).job?.hirer?.picture
      }));

      // Deduplicate bids by ID
      const uniqueBids = Array.from(new Map(formattedBids.map(b => [b.id, b])).values());
      setMyBids(uniqueBids);
    } catch (err) {
      console.error(err);
      setMyBids([]);
    }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('bids')
        .insert([{
          job_id: selectedJob.id,
          worker_id: user.id,
          amount: parseFloat(bidAmount),
          message: bidMessage,
        }]);

      if (error) throw error;

      // Notify the hirer
      await notificationService.send({
        user_id: selectedJob.hirer_id,
        title: 'New Bid Received',
        message: `${user.name} placed a bid of PKR ${bidAmount} on your job: ${selectedJob.title}`,
        type: 'bid_new',
        link: '/dashboard'
      });

      setSuccess(true);
      fetchMyBids();
      setTimeout(() => {
        setSuccess(false);
        setSelectedJob(null);
        setBidAmount('');
        setBidMessage('');
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartWork = async (jobId: number, hirerId: number) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'in_progress' })
        .eq('id', jobId);

      if (error) throw error;

      await notificationService.send({
        user_id: hirerId,
        title: 'Work Started',
        message: `${user.name} has started working on your project.`,
        type: 'bid_update',
        link: '/dashboard'
      });

      fetchMyBids();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteWork = async (jobId: number, hirerId: number) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', jobId);

      if (error) throw error;

      await notificationService.send({
        user_id: hirerId,
        title: 'Work Completed',
        message: `${user.name} has marked the project as completed. Please review and confirm.`,
        type: 'review_request',
        link: '/dashboard'
      });

      fetchMyBids();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptInstantBooking = async (jobId: number, hirerId: number, jobTitle: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'assigned', assigned_worker_id: user.id, assigned_worker_name: user.name, assigned_worker_picture: user.picture })
        .eq('id', jobId);

      if (error) throw error;

      await notificationService.send({
        user_id: hirerId,
        title: 'Instant Booking Accepted',
        message: `${user.name} has accepted your instant booking for: ${jobTitle}`,
        type: 'bid_accepted',
        link: '/dashboard'
      });

      fetchJobs();
      fetchMyBids();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectInstantBooking = async (jobId: number, hirerId: number, jobTitle: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'deleted' })
        .eq('id', jobId);

      if (error) throw error;

      await notificationService.send({
        user_id: hirerId,
        title: 'Instant Booking Rejected',
        message: `${user.name} has declined your instant booking for: ${jobTitle}`,
        type: 'bid_rejected',
        link: '/dashboard'
      });

      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBid = async (bidId: number) => {
    if (!confirm(t('worker.confirmRetract'))) return;
    try {
      const { error } = await supabase
        .from('bids')
        .delete()
        .eq('id', bidId);

      if (error) throw error;
      setMyBids(prev => prev.filter(b => b.id !== bidId));
    } catch (err) {
      console.error(err);
    }
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 sm:mb-12 gap-6">
        <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[1.25rem] sm:rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-white dark:border-zinc-900 shadow-xl shrink-0">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-6 h-6 sm:w-10 sm:h-10 text-zinc-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold truncate">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">
                {user.field}
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                <div className={`w-1 h-1 rounded-full animate-pulse ${user.is_online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                <span className={`text-[8px] font-bold uppercase tracking-widest ${user.is_online ? 'text-emerald-500' : 'text-zinc-500'}`}>
                  {user.is_online ? t('presence.online') : t('presence.offline')}
                </span>
              </div>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'available' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('worker.jobs')}
            </button>
            <button
              onClick={() => setActiveTab('my-bids')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'my-bids' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('worker.bids')}
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'reviews' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('worker.reviews')}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'available' ? (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {['skeleton-1', 'skeleton-2', 'skeleton-3'].map(i => (
                <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 sm:py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold">{t('worker.noJobs')}</h3>
              <p className="text-sm text-zinc-500">{t('worker.checkBackLater')} {user.field}.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-end justify-between px-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">Available Opportunities</h2>
                  <p className="text-xs sm:text-sm text-zinc-500">Showing jobs matching your skills and others in your area</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <AnimatePresence mode="popLayout">
                  {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`bg-white dark:bg-zinc-900 border ${job.field === user.field ? 'border-emerald-500 shadow-lg shadow-emerald-500/5' : 'border-zinc-200 dark:border-zinc-800'} rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 hover:border-emerald-500 transition-all group shadow-sm hover:shadow-xl`}
                  >
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-bold group-hover:text-emerald-500 transition-colors line-clamp-1">{job.title}</h3>
                            {job.field === user.field && (
                              <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-widest">
                                Recommended
                              </span>
                            )}
                            {job.booking_type === 'instant' && (
                              <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border border-amber-500/20">
                                {t('dashboard.instantBooking')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                            <MapPin className="w-3 h-3" />
                            {job.location || t('worker.remote')}
                          </div>
                        </div>
                        <span className="shrink-0 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                          {job.field}
                        </span>
                      </div>
                      
                      <p className="text-zinc-500 dark:text-zinc-400 line-clamp-3 text-xs sm:text-sm leading-relaxed font-medium">
                        {job.description}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800 gap-3 sm:gap-4">
                        <div className="flex items-center justify-between sm:justify-start gap-4">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-500" />
                            <span className="font-bold text-sm sm:text-xl">PKR {job.budget}</span>
                          </div>
                          <div className="sm:hidden flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-[7px] font-bold uppercase tracking-widest">
                            {job.field}
                          </div>
                        </div>
                        {job.booking_type === 'instant' ? (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleRejectInstantBooking(job.id, job.hirer_id, job.title)}
                              className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2.5 bg-red-500/10 text-red-600 font-bold text-[9px] sm:text-xs rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-wider"
                            >
                              {t('dashboard.reject')}
                            </button>
                            <button
                              onClick={() => handleAcceptInstantBooking(job.id, job.hirer_id, job.title)}
                              className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2.5 bg-emerald-500 text-white font-bold text-[9px] sm:text-xs rounded-xl hover:bg-emerald-600 transition-all uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                            >
                              {t('dashboard.accept')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="w-full sm:w-auto px-5 py-2.5 sm:py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-[9px] sm:text-xs rounded-xl hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white transition-all uppercase tracking-wider shadow-lg shadow-zinc-900/10 dark:shadow-none"
                          >
                            {t('worker.placeBid')}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </>
      ) : activeTab === 'my-bids' ? (
        <div className="space-y-4">
          {myBids.length === 0 ? (
            <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Send className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold">{t('worker.noBids')}</h3>
              <p className="text-zinc-500">{t('worker.noBidsDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myBids.map((bid) => (
                <motion.div
                  key={bid.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold">{bid.job_title}</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          bid.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' :
                          bid.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                          'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {bid.status}
                        </span>
                        {bid.status === 'accepted' && (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            (bid as any).job_status === 'assigned' ? 'bg-blue-500/10 text-blue-600' :
                            (bid as any).job_status === 'in_progress' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            {(bid as any).job_status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {bid.job_location || t('worker.remote')}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Your Bid: PKR {bid.amount}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      {bid.status === 'accepted' && (bid as any).job_status !== 'completed' && (
                        <>
                          <button
                            onClick={() => {
                              setChatJobId(bid.job_id);
                              setChatTarget({
                                id: (bid as any).hirer_id,
                                name: (bid as any).hirer_name || 'Hirer',
                                picture: (bid as any).hirer_picture
                              });
                              setShowChatModal(true);
                            }}
                            className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 text-white font-bold text-xs rounded-xl hover:bg-emerald-600 transition-all uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                          >
                            Chat with Hirer
                          </button>
                          
                          {(bid as any).job_status === 'assigned' && (
                            <button
                              onClick={() => handleStartWork(bid.job_id, (bid as any).hirer_id)}
                              className="flex-1 md:flex-none px-6 py-3 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 transition-all uppercase tracking-wider shadow-lg shadow-amber-500/20"
                            >
                              Start Work
                            </button>
                          )}
                          
                          {(bid as any).job_status === 'in_progress' && (
                            <button
                              onClick={() => handleCompleteWork(bid.job_id, (bid as any).hirer_id)}
                              className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-wider shadow-lg shadow-emerald-600/20"
                            >
                              Complete Job
                            </button>
                          )}
                        </>
                      )}
                      
                      {bid.status === 'pending' && (
                        <button
                          onClick={() => handleDeleteBid(bid.id)}
                          className="flex-1 md:flex-none px-6 py-3 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white font-semibold text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('worker.retractBid')}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {reviews.length === 0 ? (
            <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Star className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold">{t('worker.noReviews')}</h3>
              <p className="text-zinc-500">{t('worker.noReviewsDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-4 h-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200 dark:text-zinc-800'}`} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden">
                        {review.hirer_picture ? (
                          <img src={review.hirer_picture} alt={review.hirer_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-zinc-400 font-bold text-lg">{(review.hirer_name || 'H')[0]}</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white">{review.hirer_name}</h4>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed italic">
                      "{review.comment}"
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Modal */}
      {chatTarget && chatJobId && (
        <ChatModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          jobId={chatJobId}
          currentUser={user}
          otherUser={chatTarget}
        />
      )}

      {/* Bid Modal */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
            >
              {success ? (
                <div className="text-center py-12 space-y-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto"
                  >
                    <CheckCircle className="w-12 h-12 text-emerald-500" />
                  </motion.div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">{t('worker.bidSent')}</h2>
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{t('worker.proposalWay')}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2">{t('worker.placeYourBid')}</h2>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('worker.project')}: <span className="text-emerald-500">{selectedJob.title}</span></p>
                  </div>
                  
                  <form onSubmit={handleBid} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('worker.quote')}</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                        <input
                          type="number"
                          required
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('worker.whyHire')}</label>
                      <textarea
                        required
                        value={bidMessage}
                        onChange={(e) => setBidMessage(e.target.value)}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[140px] font-medium text-sm"
                        placeholder={t('worker.whyHirePlaceholder')}
                      />
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(null)}
                        className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 font-semibold text-xs uppercase tracking-wider rounded-2xl"
                      >
                        {t('worker.cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-4 bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                      >
                        {submitting ? t('worker.sending') : t('worker.submitBid')}
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
