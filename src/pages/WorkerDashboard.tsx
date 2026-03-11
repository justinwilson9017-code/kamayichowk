import { useState, useEffect } from 'react';
import { User, Job, Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, MapPin, DollarSign, Clock, Send, CheckCircle, Trash2, AlertCircle, LogOut, Star, User as UserIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import { Review } from '../types';

export default function WorkerDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
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

  useEffect(() => {
    fetchJobs();
    fetchMyBids();
    fetchReviews();
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
      const { data, error } = await supabase
        .from('jobs')
        .select('*, hirer:users(name)')
        .eq('status', 'active')
        .eq('field', user.field)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedJobs = (data || []).map(j => ({
        ...j,
        hirer_name: (j as any).hirer?.name
      }));

      setJobs(formattedJobs);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Failed to fetch') {
        // Handle fetch error
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*, job:jobs(title, location)')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBids = (data || []).map(b => ({
        ...b,
        job_title: (b as any).job?.title,
        job_location: (b as any).job?.location
      }));

      setMyBids(formattedBids);
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

  const handleDeleteBid = async (bidId: number) => {
    if (!confirm('Are you sure you want to retract this bid?')) return;
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
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-white dark:border-zinc-900 shadow-xl">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {user.field}
              </span>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-current" />
                  {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)} ({reviews.length})
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onLogout}
            className="px-6 py-3 sm:py-4 bg-red-500/10 text-red-600 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-xs sm:text-sm hover:bg-red-500 hover:text-white"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            Logout
          </button>
          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'available' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Jobs
            </button>
            <button
              onClick={() => setActiveTab('my-bids')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'my-bids' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Bids
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'reviews' 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-500' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Reviews
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'available' ? (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 sm:py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] sm:rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold">No jobs found</h3>
              <p className="text-sm text-zinc-500">Check back later for new opportunities in {user.field}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnimatePresence mode="popLayout">
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 hover:border-emerald-500 transition-all group shadow-sm hover:shadow-xl hover:shadow-emerald-500/5"
                  >
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <h3 className="text-lg sm:text-xl font-bold group-hover:text-emerald-500 transition-colors line-clamp-1">{job.title}</h3>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                            <MapPin className="w-3 h-3" />
                            {job.location || 'Remote'}
                          </div>
                        </div>
                        <span className="shrink-0 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                          {job.field}
                        </span>
                      </div>
                      
                      <p className="text-zinc-500 dark:text-zinc-400 line-clamp-3 text-xs sm:text-sm leading-relaxed font-medium">
                        {job.description}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 gap-4">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                          <span className="font-bold text-lg sm:text-xl">PKR {job.budget}</span>
                        </div>
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-[10px] sm:text-xs rounded-xl hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white transition-all uppercase tracking-wider"
                        >
                          Place Bid
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : activeTab === 'my-bids' ? (
        <div className="space-y-4">
          {myBids.length === 0 ? (
            <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900/50 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Send className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold">No bids placed</h3>
              <p className="text-zinc-500">You haven't placed any bids yet. Start exploring jobs!</p>
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
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {bid.job_location || 'Remote'}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Your Bid: PKR {bid.amount}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => handleDeleteBid(bid.id)}
                      className="flex-1 md:flex-none px-6 py-3 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white font-semibold text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Retract Bid
                    </button>
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
              <h3 className="text-xl font-bold">No reviews yet</h3>
              <p className="text-zinc-500">Complete jobs to start receiving reviews from hirers.</p>
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
                    <h2 className="text-3xl font-bold">Bid Sent</h2>
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Your proposal is on its way</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2">Place Your Bid</h2>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Project: <span className="text-emerald-500">{selectedJob.title}</span></p>
                  </div>
                  
                  <form onSubmit={handleBid} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your Quote (PKR)</label>
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Why hire you?</label>
                      <textarea
                        required
                        value={bidMessage}
                        onChange={(e) => setBidMessage(e.target.value)}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none min-h-[140px] font-medium text-sm"
                        placeholder="Detail your experience and availability..."
                      />
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(null)}
                        className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 font-semibold text-xs uppercase tracking-wider rounded-2xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-4 bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                      >
                        {submitting ? 'Sending...' : 'Submit Bid'}
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
