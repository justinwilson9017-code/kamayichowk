import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';
import { Notification, User } from '../types';
import { Link } from 'react-router-dom';

export default function NotificationDropdown({ user }: { user: User }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    await notificationService.markAsRead(id);
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead(user.id);
    fetchNotifications();
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-500 hover:text-emerald-500 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <h3 className="font-bold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-600 transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto">
                      <Bell className="w-6 h-6 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {notifications.map((n) => (
                      <div 
                        key={n.id}
                        className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group relative ${!n.is_read ? 'bg-emerald-50/30 dark:bg-emerald-500/5' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            n.type === 'job_new' ? 'bg-blue-500/10 text-blue-500' :
                            n.type === 'bid_new' ? 'bg-emerald-500/10 text-emerald-500' :
                            n.type === 'bid_update' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-purple-500/10 text-purple-500'
                          }`}>
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`text-sm font-bold truncate ${!n.is_read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                {n.title}
                              </h4>
                              <span className="text-[10px] text-zinc-400 whitespace-nowrap flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getTimeAgo(n.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            <div className="flex items-center gap-3 pt-2">
                              {n.link && (
                                <Link
                                  to={n.link}
                                  onClick={() => {
                                    setIsOpen(false);
                                    handleMarkAsRead(n.id);
                                  }}
                                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600 uppercase tracking-wider flex items-center gap-1"
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                              {!n.is_read && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="text-[10px] font-bold text-zinc-400 hover:text-emerald-500 uppercase tracking-wider flex items-center gap-1"
                                >
                                  Read <Check className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(n.id)}
                                className="text-[10px] font-bold text-zinc-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Delete <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Showing latest 20 notifications
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
