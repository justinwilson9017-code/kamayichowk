import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Role = 'worker' | 'hirer' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  field?: string;
  location?: string;
  picture?: string;
  isAdmin: boolean;
}

export interface Job {
  id: number;
  hirer_id: number;
  hirer_name?: string;
  title: string;
  description: string;
  field: string;
  location: string;
  budget: number;
  status: 'active' | 'completed' | 'deleted';
  created_at: string;
}

export interface Bid {
  id: number;
  job_id: number;
  job_title?: string;
  job_location?: string;
  worker_id: number;
  worker_name?: string;
  worker_picture?: string;
  amount: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'job_new' | 'bid_update' | 'bid_new' | 'review_request' | 'message';
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: number;
  job_id: number;
  hirer_id: number;
  worker_id: number;
  rating: number;
  comment: string;
  created_at: string;
  hirer_name?: string;
  hirer_picture?: string;
}
