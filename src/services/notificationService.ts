import { supabase } from './supabase';

export const notificationService = {
  async send({
    user_id,
    title,
    message,
    type,
    link
  }: {
    user_id: number;
    title: string;
    message: string;
    type: 'job_new' | 'bid_update' | 'bid_new' | 'review_request' | 'message';
    link?: string;
  }) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id,
          title,
          message,
          type,
          link,
          is_read: false
        }]);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  },

  async markAsRead(id: number) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  },

  async markAllAsRead(userId: number) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  },

  async getUnreadCount(userId: number) {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error getting unread count:', err);
      return 0;
    }
  }
};
