import { useState, useEffect } from 'react';
import { User, Job, Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Briefcase, Users, DollarSign, Clock, Trash2, ChevronRight, CheckCircle, MapPin, User as UserIcon, AlertCircle, LogOut, Star } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import ReviewModal from '../components/ReviewModal';

export default function HirerDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  
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

  useEffect(() => {
    fetchJobs();
    fetchReviewedJobs();
  }, []);

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
      setJobs(data || []);
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

      // Fetch ratings for all workers who placed bids
      const workerIds = (data || []).map(b => b.worker_id);
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

      const formattedBids = (data || []).map(b => {
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

  const handleBidStatus = async (bidId: number, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('bids')
        .update({ status })
        .eq('id', bidId);

      if (error) throw error;

      // Notify the worker
      const bid = bids.find(b => b.id === bidId);
      if (bid) {
        await notificationService.send({
          user_id: bid.worker_id,
          title: `Bid ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your bid on "${selectedJob?.title}" has been ${status}.`,
          type: 'bid_update',
          link: '/dashboard'
        });
      }

      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status } : b));
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
    if (!confirm('Are you sure you want to delete this job?')) return;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 sm:mb-12 gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Hirer Console</h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 uppercase tracking-wider">Manage your projects and talent</p>
        </div>
        <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={onLogout}
            className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 bg-red-500/10 text-red-600 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-xs sm:text-sm hover:bg-red-500 hover:text-white"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            Logout
          </button>
          <button
            onClick={() => setShowPostModal(true)}
            className="flex-[2] sm:flex-none px-4 sm:px-8 py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-wider text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Post Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Jobs List */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />)
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 sm:py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold">No projects yet</h3>
              <p className="text-sm text-zinc-500">Start by posting your first project to find talent.</p>
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
                onClick={() => fetchBids(job)}
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
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {job.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteJob(job.id);
                        }}
                        className="p-2.5 sm:p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                        title="Mark as Completed"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id);
                      }}
                      className="p-2.5 sm:p-3 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Bids Sidebar */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Received Bids {selectedJob && `(${bids.length})`}
            </h2>
          </div>
          {!selectedJob ? (
            <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Select a project to view bids</p>
            </div>
          ) : bids.length === 0 ? (
            <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">No bids received yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => (
                <motion.div
                  key={bid.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
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
                        Accept
                      </button>
                      <button 
                        onClick={() => handleBidStatus(bid.id, 'rejected')}
                        className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider rounded-xl hover:bg-red-500 hover:text-white transition-all"
                      >
                        Reject
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
      </div>

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
              <h2 className="text-2xl font-bold mb-8">Post a Project</h2>
              <form onSubmit={handlePostJob} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Title</label>
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px] font-medium text-sm"
                    placeholder="Describe the scope of work..."
                  />
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
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                      placeholder="e.g. Brooklyn, NY"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Category</label>
                    <select
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                      className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                    >
                      <option value="labor">Labor</option>
                      <option value="electrician">Electrician</option>
                      <option value="plumber">Plumber</option>
                      <option value="carpenter">Carpenter</option>
                      <option value="mechanic">Mechanic</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Budget (PKR)</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    {submitting ? 'Posting...' : 'Post Project'}
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
