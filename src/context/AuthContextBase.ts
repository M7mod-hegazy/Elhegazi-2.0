import { createContext } from 'react';
import type { User } from '@/types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  token: string;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; isAdmin?: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; user?: User; error?: string }>;
  adminLogin: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; isAdmin?: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void> | void;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; user?: User; error?: string }>;
  checkPermission: (requiredRole?: 'customer' | 'admin') => boolean;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
