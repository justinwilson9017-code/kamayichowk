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
