import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

export function usePresence(user: User | null) {
  useEffect(() => {
    if (!user) return;

    const updatePresence = async (isOnline: boolean) => {
      try {
        const { error } = await supabase
          .from('users')
          .update({ 
            last_seen: new Date().toISOString(),
            is_online: isOnline
          })
          .eq('id', user.id);
        
        if (error && error.message.includes('column "is_online" does not exist')) {
          console.warn('Supabase schema missing "is_online" column. Presence features may be limited.');
          // Fallback to just updating last_seen if possible
          await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (err) {
        console.error('Error updating presence:', err);
      }
    };

    // Set online on mount
    updatePresence(true);

    // Update last_seen every 60 seconds
    const interval = setInterval(() => {
      updatePresence(true);
    }, 60000);

    // Set offline on unmount (best effort)
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [user?.id]);
}
