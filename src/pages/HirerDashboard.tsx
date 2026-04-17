import { useState, useEffect } from 'react';
import { User, Job, Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Briefcase, Users, DollarSign, Clock, Trash2, ChevronRight, CheckCircle, MapPin, User as UserIcon, AlertCircle, LogOut, Star } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import ReviewModal from '../components/ReviewModal';
import { useLanguage } from '../LanguageContext';

import ChatModal from '../components/ChatModal';

export default function HirerDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [activeWorkers, setActiveWorkers] = useState<User[]>([]);
  
  // Chat State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string; picture?: string } | null>(null);
  const [chatJobId, setChatJobId] = useState<number | null>(null);
  
  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ workerId: number, workerName: string } | null>(null);
  const [reviewedJobs, setReviewedJobs] = useState<number[]>([]);
  
  // New Job Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [field, setField] = useState('labor');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Instant Booking State
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
  const [instantTitle, setInstantTitle] = useState('');
  const [instantDesc, setInstantDesc] = useState('');
  const [instantLocation, setInstantLocation] = useState('');

  const [activeTab, setActiveTab] = useState<'projects' | 'bids' | 'workers'>('projects');

  useEffect(() => {
    fetchJobs();
    fetchReviewedJobs();
    fetchActiveWorkers();

    // Real-time subscription for jobs
    const jobsChannel = supabase
      .channel('hirer_jobs_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `hirer_id=eq.${user.id}`
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    // Real-time subscription for bids
    const bidsChannel = supabase
      .channel('hirer_bids_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
          // If a new bid is placed or updated for any job, we might want to refresh
          // But specifically if it's for the selected job, we definitely refresh
          if (selectedJob && (payload.new as any).job_id === selectedJob.id) {
            fetchBids(selectedJob);
          }
          // Also refresh jobs to update bid counts if displayed (though currently not explicitly shown on card, but good practice)
          fetchJobs();
        }
      )
      .subscribe();

    // Real-time subscription for active workers
    const workersChannel = supabase
      .channel('active_workers_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.worker'
        },
        () => {
          fetchActiveWorkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(workersChannel);
    };
  }, [selectedJob?.id]);

  const fetchActiveWorkers = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'worker')
        .limit(10);
      
      // Try to filter by is_online if the column exists
      // We do this by checking if it fails or by just attempting it
      const { data, error } = await query.eq('is_online', true);
      
      if (error) {
        if (error.message.includes('column "is_online" does not exist')) {
          // Fallback: just show some workers if the column is missing
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'worker')
            .limit(10);
          if (fallbackError) throw fallbackError;
          
          // Deduplicate
          const uniqueWorkers = Array.from(new Map((fallbackData || []).map(w => [w.id, w])).values());
          setActiveWorkers(uniqueWorkers);
        } else {
          throw error;
        }
      } else {
        // Deduplicate
        const uniqueWorkers = Array.from(new Map((data || []).map(w => [w.id, w])).values());
        setActiveWorkers(uniqueWorkers);
      }
    } catch (err) {
      console.error('Error fetching active workers:', err);
    }
  };

  const fetchReviewedJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('job_id')
        .eq('hirer_id', user.id);
      if (error) throw error;
      setReviewedJobs((data || []).map(r => r.job_id));
    } catch (err) {
      console.error('Error fetching reviewed jobs:', err);
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
        .select('*')
        .eq('hirer_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Deduplicate jobs by ID
      const uniqueJobs = Array.from(new Map((data || []).map(j => [j.id, j])).values());
      setJobs(uniqueJobs);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Failed to fetch') {
        // Handle fetch error silently or show a toast
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async (job: Job) => {
    setSelectedJob(job);
    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*, worker:users(name, picture)')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Deduplicate bids by ID
      const uniqueBids = Array.from(new Map((data || []).map(b => [b.id, b])).values());

      // Fetch ratings for all workers who placed bids
      const workerIds = uniqueBids.map(b => b.worker_id);
      const { data: ratingsData } = await supabase
        .from('reviews')
        .select('worker_id, rating')
        .in('worker_id', workerIds);

      const ratingsMap: Record<string, { total: number, count: number }> = {};
      ratingsData?.forEach(r => {
        if (!ratingsMap[r.worker_id]) {
          ratingsMap[r.worker_id] = { total: 0, count: 0 };
        }
        ratingsMap[r.worker_id].total += r.rating;
        ratingsMap[r.worker_id].count += 1;
      });

      const formattedBids = uniqueBids.map(b => {
        const ratingInfo = ratingsMap[b.worker_id];
        return {
          ...b,
          worker_name: (b as any).worker?.name,
          worker_picture: (b as any).worker?.picture,
          worker_rating: ratingInfo ? (ratingInfo.total / ratingInfo.count).toFixed(1) : null,
          worker_review_count: ratingInfo ? ratingInfo.count : 0
        };
      });

      setBids(formattedBids);
    } catch (err) {
      console.error(err);
      setBids([]);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([{
          hirer_id: user.id,
          title,
          description,
          field,
          budget: parseFloat(budget),
          location,
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Notify workers in this field
      const { data: workers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'worker')
        .eq('field', field);
      
      if (workers) {
        for (const worker of workers) {
          await notificationService.send({
            user_id: worker.id,
            title: 'New Job in Your Field',
            message: `A new ${field} job has been posted: ${title}`,
            type: 'job_new',
            link: '/dashboard'
          });
        }
      }

      setJobs(prev => [data, ...prev]);
      setShowPostModal(false);
      setTitle('');
      setDescription('');
      setBudget('');
      setLocation('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([{
          hirer_id: user.id,
          title: instantTitle,
          description: instantDesc,
          field: selectedWorker.field,
          budget: selectedWorker.hourly_rate || 0,
          location: instantLocation,
          booking_type: 'instant',
          assigned_worker_id: selectedWorker.id,
          assigned_worker_name: selectedWorker.name,
          assigned_worker_picture: selectedWorker.picture,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      // Notify the specific worker
      await notificationService.send({
        user_id: selectedWorker.id,
        title: 'New Instant Booking Request',
        message: `${user.name} has booked you directly for: ${instantTitle}`,
        type: 'job_new',
        link: '/dashboard'
      });

      setJobs(prev => [data, ...prev]);
      setShowInstantModal(false);
      setInstantTitle('');
      setInstantDesc('');
      setInstantLocation('');
      setSelectedWorker(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBidStatus = async (bidId: number, status: 'accepted' | 'rejected') => {
    try {
      const bid = bids.find(b => b.id === bidId);
      if (!bid || !selectedJob) return;

      const { error: bidError } = await supabase
        .from('bids')
        .update({ status })
        .eq('id', bidId);

      if (bidError) throw bidError;

      if (status === 'accepted') {
        // Update job status to assigned and set assigned worker
        const { error: jobError } = await supabase
          .from('jobs')
          .update({ 
            status: 'assigned',
            assigned_worker_id: bid.worker_id,
            assigned_worker_name: bid.worker_name,
            assigned_worker_picture: bid.worker_picture
          })
          .eq('id', selectedJob.id);

        if (jobError) throw jobError;

        // Reject all other pending bids for this job
        await supabase
          .from('bids')
          .update({ status: 'rejected' })
          .eq('job_id', selectedJob.id)
          .neq('id', bidId)
          .eq('status', 'pending');
          
        // Create initial message to start chat
        await supabase
          .from('messages')
          .insert([{
            job_id: selectedJob.id,
            sender_id: user.id,
            receiver_id: bid.worker_id,
            text: `Hello! I have accepted your bid for "${selectedJob.title}". Let's discuss the details.`
          }]);
      }

      // Notify the worker
      await notificationService.send({
        user_id: bid.worker_id,
        title: `Bid ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your bid on "${selectedJob.title}" has been ${status}.`,
        type: status === 'accepted' ? 'bid_accepted' : 'bid_rejected',
        link: '/dashboard'
      });

      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status } : b));
      fetchJobs(); // Refresh jobs to update status
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteJob = async (jobId: number) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', jobId);

      if (error) throw error;

      // Notify the accepted worker
      const acceptedBid = bids.find(b => b.status === 'accepted');
      if (acceptedBid) {
        await notificationService.send({
          user_id: acceptedBid.worker_id,
          title: 'Job Completed',
          message: `The job "${selectedJob?.title}" has been marked as completed. Please request a review.`,
          type: 'review_request',
          link: '/dashboard'
        });
      }

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed' } : j));
      if (selectedJob?.id === jobId) {
        setSelectedJob(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteJob = async (id: number) => {
    if (!confirm(t('hirer.confirmDelete'))) return;
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'deleted' })
        .eq('id', id);

      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
      if (selectedJob?.id === id) setSelectedJob(null);
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
        <div className="w-full md:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('hirer.console')}</h1>
          <p className="text-[10px] sm:text-sm font-semibold text-zinc-500 uppercase tracking-wider">{t('hirer.manageProjects')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'projects' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('hirer.manageProjects')}
            </button>
            <button
              onClick={() => setActiveTab('bids')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'bids' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('hirer.receivedBids')}
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'workers' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t('hirer.activeWorkers')}
            </button>
          </div>
          <button
            onClick={() => setShowPostModal(true)}
            className="px-4 sm:px-8 py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-wider text-[10px] sm:text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('hirer.postProject')}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === 'projects' && (
          <div className="space-y-4 sm:space-y-6">
            {loading ? (
              ['skeleton-1', 'skeleton-2', 'skeleton-3'].map(i => <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />)
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 sm:py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-bold">{t('hirer.noProjects')}</h3>
                <p className="text-sm text-zinc-500">{t('hirer.startByPosting')}</p>
              </div>
            ) : (
              jobs.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  className={`p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden ${
                    selectedJob?.id === job.id 
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 shadow-lg' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'
                  }`}
                  onClick={() => {
                    fetchBids(job);
                    setActiveTab('bids');
                  }}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 relative z-10">
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <h3 className="text-lg sm:text-xl font-bold">{job.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          job.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[10px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {job.location || 'Remote'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                          PKR {job.budget}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto justify-end">
                      {job.status === 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteJob(job.id);
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Complete
                        </button>
                      )}
                      {(job.status === 'assigned' || job.status === 'in_progress') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatJobId(job.id);
                            setChatTarget({
                              id: job.assigned_worker_id!,
                              name: job.assigned_worker_name || 'Worker',
                              picture: job.assigned_worker_picture
                            });
                            setShowChatModal(true);
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                        >
                          Chat with Worker
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                {t('hirer.receivedBids')} {selectedJob && `(${bids.length})`}
              </h2>
              {selectedJob && (
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                  Project: {selectedJob.title}
                </span>
              )}
            </div>
            {!selectedJob ? (
              <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('hirer.selectProject')}</p>
                <button 
                  onClick={() => setActiveTab('projects')}
                  className="mt-4 text-emerald-500 text-[10px] font-bold uppercase tracking-widest hover:underline"
                >
                  Go to Projects
                </button>
              </div>
            ) : bids.length === 0 ? (
              <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('hirer.noBids')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bids.map((bid) => (
                  <motion.div
                    key={bid.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] space-y-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                          {bid.worker_picture ? (
                            <img src={bid.worker_picture} alt={bid.worker_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{bid.worker_name}</span>
                          {(bid as any).worker_rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span className="text-[10px] font-bold text-zinc-500">{(bid as any).worker_rating} ({(bid as any).worker_review_count})</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-emerald-600 font-bold text-lg">PKR {bid.amount}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                          bid.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' :
                          bid.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                          'bg-amber-500/10 text-amber-600'
                        }`}>
                          {bid.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium leading-relaxed">{bid.message}</p>
                    
                    {bid.status === 'pending' ? (
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => handleBidStatus(bid.id, 'accepted')}
                          className="flex-1 py-2.5 bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-wider rounded-xl hover:bg-emerald-600 transition-all"
                        >
                          {t('hirer.accept')}
                        </button>
                        <button 
                          onClick={() => handleBidStatus(bid.id, 'rejected')}
                          className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          {t('hirer.reject')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bid.status === 'accepted' && selectedJob?.status === 'completed' && !reviewedJobs.includes(selectedJob.id) && (
                          <button
                            onClick={() => {
                              setReviewTarget({ workerId: bid.worker_id, workerName: bid.worker_name || 'Worker' });
                              setShowReviewModal(true);
                            }}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                            Leave Review
                          </button>
                        )}
                        
                        {bid.status === 'accepted' && reviewedJobs.includes(selectedJob?.id || 0) && (
                          <div className="w-full py-2.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider border border-zinc-100 dark:border-zinc-800 rounded-xl">
                            Review Submitted
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workers' && (
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-500" />
                {t('hirer.activeWorkers')}
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeWorkers.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-sm text-zinc-500 italic">
                    {t('presence.noActiveWorkers')}
                  </p>
                </div>
              ) : (
                activeWorkers.map((worker) => (
                  <div key={worker.id} className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/50 transition-all group">
                    <div className="relative">
                      {worker.picture ? (
                        <img src={worker.picture} alt={worker.name} className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-zinc-400" />
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm sm:text-base truncate">{worker.name}</h4>
                      <p className="text-[9px] sm:text-[11px] text-zinc-500 uppercase tracking-wider font-medium truncate">
                        {t(`fields.${worker.field}`)} • {worker.location}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[8px] sm:text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                          {t('presence.online')}
                        </p>
                        {worker.hourly_rate && worker.hourly_rate > 0 && (
                          <p className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                            PKR {worker.hourly_rate}/hr
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedWorker(worker);
                        setInstantLocation(user.location || '');
                        setShowInstantModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                    >
                      {t('dashboard.hireNow')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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

      {/* Post Job Modal */}
      <AnimatePresence>
        {showPostModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPostModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-8">{t('hirer.postProject')}</h2>
                <form onSubmit={handlePostJob} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.projectTitle')}</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                      placeholder="e.g. Full House Electrical Wiring"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.projectDesc')}</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px] font-medium text-sm"
                      placeholder="Describe the scope of work..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('auth.location')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                        placeholder="e.g. Lahore, Pakistan"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.category')}</label>
                      <select
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                      >
                        <option value="labor">{t('jobs.labor')}</option>
                        <option value="electrician">{t('jobs.electrician')}</option>
                        <option value="plumber">{t('jobs.plumber')}</option>
                        <option value="carpenter">{t('jobs.carpenter')}</option>
                        <option value="mechanic">{t('jobs.mechanic')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.budget')}</label>
                      <input
                        type="number"
                        required
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                        placeholder="500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowPostModal(false)}
                      className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 font-semibold text-xs uppercase tracking-wider rounded-2xl"
                    >
                      {t('hirer.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-4 bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
                    >
                      {submitting ? t('hirer.posting') : t('hirer.postProject')}
                    </button>
                  </div>
                </form>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Instant Booking Modal */}
      <AnimatePresence>
        {showInstantModal && selectedWorker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstantModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{t('dashboard.instantBooking')}</h2>
                  <p className="text-sm text-zinc-500 font-medium">{t('dashboard.instantBookingDesc')}</p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 mb-8 border border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center gap-4">
                  {selectedWorker.picture ? (
                    <img src={selectedWorker.picture} alt={selectedWorker.name} className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-base">{selectedWorker.name}</h4>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                      {t(`fields.${selectedWorker.field}`)} • PKR {selectedWorker.hourly_rate}/hr
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleInstantBooking} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.projectTitle')}</label>
                  <input
                    type="text"
                    required
                    value={instantTitle}
                    onChange={(e) => setInstantTitle(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    placeholder="e.g. Quick Fan Repair"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('hirer.projectDesc')}</label>
                  <textarea
                    required
                    value={instantDesc}
                    onChange={(e) => setInstantDesc(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px] font-medium text-sm"
                    placeholder="Describe what needs to be done..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('auth.location')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={instantLocation}
                      onChange={(e) => setInstantLocation(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                      placeholder="e.g. Lahore, Pakistan"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowInstantModal(false)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 font-semibold text-xs uppercase tracking-wider rounded-2xl"
                  >
                    {t('hirer.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    {submitting ? t('hirer.posting') : t('dashboard.bookWorker')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedJob && reviewTarget && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setReviewTarget(null);
          }}
          job={selectedJob}
          workerId={reviewTarget.workerId}
          workerName={reviewTarget.workerName}
          hirerId={user.id}
          onSuccess={() => {
            fetchReviewedJobs();
          }}
        />
      )}
    </div>
  );
}
