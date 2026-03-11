import { useState } from 'react';
import { Star, X, Send, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/supabase';
import { User, Job } from '../types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  workerId: number;
  workerName: string;
  hirerId: number;
  onSuccess: () => void;
}

export default function ReviewModal({ isOpen, onClose, job, workerId, workerName, hirerId, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (comment.trim().length < 10) {
      setError('Comment must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert([{
          job_id: job.id,
          hirer_id: hirerId,
          worker_id: workerId,
          rating,
          comment
        }]);

      if (reviewError) throw reviewError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">Rate Worker</h2>
                  <p className="text-sm text-zinc-500">How was your experience with {workerName}?</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3 text-center">
                  <label className="text-sm font-bold uppercase tracking-widest text-zinc-400">Your Rating</label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="p-1 transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star 
                          className={`w-10 h-10 transition-colors ${
                            star <= (hover || rating) 
                              ? 'fill-amber-400 text-amber-400' 
                              : 'text-zinc-200 dark:text-zinc-800'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-zinc-400">Review Comment</label>
                  <textarea
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Describe your experience working with this professional..."
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[150px] resize-none"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Submit Review
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
