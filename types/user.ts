import { Subscription } from '@/types/subscriptions';
import { Categories } from './categories';

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  currency: string;
  dateFormat: string;
  theme: string;
  transactionsDateFrom?: string | null;
  transactionsDateTo?: string | null;
}

export interface ResponseUser {
  ok: boolean;
  error?: string;
}

export interface User {
  email: string;
  id: string;
  name: string;
  image: string;
  signupDate: string;
  updatedAt: string;
  subscriptions: Subscription[];
  categories: Categories[];
  dateFormat: string;
  transactionsDate?: {
    from: string; // Date in format yyyy-MM-dd
    to: string; // Date in format yyyy-MM-dd
  };
}

export interface UpdateUserPreferencesResponse {
  ok: boolean;
  updatedUser?: LocalUser;
  error?: string;
  message?: string;
}
