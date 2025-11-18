import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User, AuthState } from '@/types';
import { apiPostJson } from '@/lib/api';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, createUserWithEmailAndPassword, updateProfile as fbUpdateProfile } from 'firebase/auth';
import { AuthContext, type AuthContextValue, type LoginCredentials, type RegisterData } from '@/context/AuthContextBase';

// Extended context for dual authentication
export interface DualAuthState {
  user: User | null;
  adminUser: User | null;
  isAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  isAdmin: boolean;
  token: string;
  adminToken: string;
}

export const DualAuthContext = React.createContext<{
  user: User | null;
  adminUser: User | null;
  isAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  isAdmin: boolean;
  token: string;
  adminToken: string;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; isAdmin?: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; user?: User; error?: string }>;
  adminLogin: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; isAdmin?: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void> | void;
  adminLogout: () => Promise<void> | void;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; user?: User; error?: string }>;
  checkPermission: (requiredRole?: 'customer' | 'admin') => boolean;
  clearError: () => void;
} | undefined>(undefined);

export const DualAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<DualAuthState>({
    user: null,
    adminUser: null,
    isAuthenticated: false,
    isAdminAuthenticated: false,
    isAdmin: false,
    token: '',
    adminToken: ''
  });
  const [loading, setLoading] = useState(true);
  
  // Listen for 401 errors and auto-logout
  useEffect(() => {
    const handlePermissionDenied = (event: CustomEvent) => {
      const { status } = event.detail;
      if (status === 401) {
        // Session expired - clear auth and notify
        // Show notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in slide-in-from-top';
        toast.textContent = '⏱️ انتهت الجلسة - يرجى تسجيل الدخول مرة أخرى';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
        
        // Clear localStorage and redirect to login
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/admin/login';
        }, 1000);
      }
    };
    
    window.addEventListener('permission-denied', handlePermissionDenied as EventListener);
    return () => window.removeEventListener('permission-denied', handlePermissionDenied as EventListener);
  }, []);
  const [error, setError] = useState<string | null>(null);

  // Keep Firebase auth state in sync with our app state for regular users
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const dn = fbUser.displayName || '';
        const parts = dn.trim().split(' ').filter(Boolean);
        const baseUser: User = {
          id: fbUser.uid, // temporary, will be replaced by backend id
          email: fbUser.email || '',
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          phone: fbUser.phoneNumber || undefined,
          role: 'customer',
          isActive: true,
          createdAt: fbUser.metadata?.creationTime || new Date().toISOString(),
        };
        // Sync with backend to obtain MongoDB user id
        (async () => {
          try {
            const res = await apiPostJson<{ user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } }, { email: string; firstName?: string; lastName?: string; phone?: string }>(
              '/api/users/sync',
              { email: baseUser.email, firstName: baseUser.firstName, lastName: baseUser.lastName, phone: baseUser.phone }
            );
            const ok = res as { ok: true; user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } };
            const synced: User = {
              ...baseUser,
              id: ok.user.id,
              role: ok.user.role,
              isActive: ok.user.isActive,
            };
            setAuthState(prev => ({
              ...prev,
              user: synced,
              isAuthenticated: true,
              isAdmin: synced.role === 'admin'
            }));
          } catch {
            // Fallback to Firebase user only
            setAuthState(prev => ({
              ...prev,
              user: baseUser,
              isAuthenticated: true,
              isAdmin: false
            }));
          }
        })().finally(() => setLoading(false));
      } else {
        setAuthState(prev => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isAdmin: false,
          token: ''
        }));
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Restore admin session from localStorage
  useEffect(() => {
    try {
      const adminUserId = localStorage.getItem('admin.auth.userId');
      const adminEmail = localStorage.getItem('admin.auth.userEmail') || '';
      const adminRole = (localStorage.getItem('admin.auth.role') || 'admin') as User['role'];
      const adminFirstName = localStorage.getItem('admin.auth.firstName') || '';
      const adminLastName = localStorage.getItem('admin.auth.lastName') || '';
      const adminIsActiveStr = localStorage.getItem('admin.auth.isActive');
      const adminIsActive = adminIsActiveStr ? adminIsActiveStr === 'true' : true;
      const adminToken = localStorage.getItem('admin.auth.token') || '';
      
      if (adminUserId) {
        const u: User = { 
          id: adminUserId, 
          email: adminEmail, 
          firstName: adminFirstName, 
          lastName: adminLastName, 
          role: adminRole, 
          isActive: adminIsActive, 
          createdAt: new Date().toISOString() 
        };
        setAuthState(prev => ({
          ...prev,
          adminUser: u,
          isAdminAuthenticated: true,
          adminToken: adminToken
        }));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Persist basic identity for server-side audit headers and reload restore
  useEffect(() => {
    try {
      // Regular user persistence
      if (authState.user) {
        localStorage.setItem('auth.userId', authState.user.id);
        if (authState.user.email) localStorage.setItem('auth.userEmail', authState.user.email);
        else localStorage.removeItem('auth.userEmail');
        localStorage.setItem('auth.role', authState.user.role);
        localStorage.setItem('auth.firstName', authState.user.firstName || '');
        localStorage.setItem('auth.lastName', authState.user.lastName || '');
        localStorage.setItem('auth.isActive', String(authState.user.isActive ?? true));
      } else {
        localStorage.removeItem('auth.userId');
        localStorage.removeItem('auth.userEmail');
        localStorage.removeItem('auth.role');
        localStorage.removeItem('auth.firstName');
        localStorage.removeItem('auth.lastName');
        localStorage.removeItem('auth.isActive');
        localStorage.removeItem('auth.token');
      }

      // Admin user persistence
      if (authState.adminUser) {
        localStorage.setItem('admin.auth.userId', authState.adminUser.id);
        if (authState.adminUser.email) localStorage.setItem('admin.auth.userEmail', authState.adminUser.email);
        else localStorage.removeItem('admin.auth.userEmail');
        localStorage.setItem('admin.auth.role', authState.adminUser.role);
        localStorage.setItem('admin.auth.firstName', authState.adminUser.firstName || '');
        localStorage.setItem('admin.auth.lastName', authState.adminUser.lastName || '');
        localStorage.setItem('admin.auth.isActive', String(authState.adminUser.isActive ?? true));
        localStorage.setItem('admin.auth.token', authState.adminToken);
      } else {
        localStorage.removeItem('admin.auth.userId');
        localStorage.removeItem('admin.auth.userEmail');
        localStorage.removeItem('admin.auth.role');
        localStorage.removeItem('admin.auth.firstName');
        localStorage.removeItem('admin.auth.lastName');
        localStorage.removeItem('admin.auth.isActive');
        localStorage.removeItem('admin.auth.token');
      }
    } catch {
      // ignore storage errors (SSR/privacy modes)
    }
  }, [authState.user, authState.adminUser, authState.adminToken]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const fb = res.user;
      const firstName = fb.displayName?.split(' ')[0] || '';
      const lastName = fb.displayName?.split(' ').slice(1).join(' ') || '';
      // proactively sync so we can immediately return backend id
      try {
        const resp = await apiPostJson<{ user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } }, { email: string; firstName?: string; lastName?: string }>(
          '/api/users/sync',
          { email: fb.email || '', firstName, lastName }
        );
        const ok = resp as { ok: true; user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } };
        const u: User = {
          id: ok.user.id,
          email: ok.user.email,
          firstName: ok.user.firstName || firstName,
          lastName: ok.user.lastName || lastName,
          role: ok.user.role,
          isActive: ok.user.isActive,
          createdAt: fb.metadata?.creationTime || new Date().toISOString(),
        };
        setAuthState(prev => ({
          ...prev,
          user: u,
          isAuthenticated: true,
          isAdmin: u.role === 'admin'
        }));
        return { success: true, user: u };
      } catch {
        const u: User = {
          id: fb.uid,
          email: fb.email || '',
          firstName,
          lastName,
          role: 'customer',
          isActive: true,
          createdAt: fb.metadata?.creationTime || new Date().toISOString(),
        };
        setAuthState(prev => ({
          ...prev,
          user: u,
          isAuthenticated: true,
          isAdmin: false
        }));
        return { success: true, user: u };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول بواسطة Google';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Backend-only admin login (bypasses Firebase)
  const adminLogin = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiPostJson<{ user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean }; token?: string }, { email: string; password: string }>(
        '/api/auth/login',
        { email: credentials.email, password: credentials.password }
      );
      const ok = resp as { ok: true; user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean }; token?: string };
      const u: User = {
        id: ok.user.id,
        email: ok.user.email,
        firstName: ok.user.firstName || '',
        lastName: ok.user.lastName || '',
        phone: ok.user.phone,
        role: ok.user.role,
        isActive: ok.user.isActive,
        createdAt: new Date().toISOString(),
      };
      const token = ok.token || '';
      setAuthState(prev => ({
        ...prev,
        adminUser: u,
        isAdminAuthenticated: true,
        adminToken: token
      }));
      return { success: true, user: u, isAdmin: u.role === 'admin' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل دخول المشرف';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const fb = auth.currentUser;
      if (fb) {
        const dn = fb.displayName || '';
        const parts = dn.trim().split(' ').filter(Boolean);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        try {
          const resp = await apiPostJson<{ user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } }, { email: string; firstName?: string; lastName?: string }>(
            '/api/users/sync',
            { email: fb.email || '', firstName, lastName }
          );
          const ok = resp as { ok: true; user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } };
          const u: User = {
            id: ok.user.id,
            email: ok.user.email,
            firstName: ok.user.firstName || firstName,
            lastName: ok.user.lastName || lastName,
            role: ok.user.role,
            isActive: ok.user.isActive,
            createdAt: fb.metadata?.creationTime || new Date().toISOString(),
          };
          setAuthState(prev => ({
            ...prev,
            user: u,
            isAuthenticated: true,
            isAdmin: u.role === 'admin'
          }));
          return { success: true, user: u, isAdmin: u.role === 'admin' };
        } catch {
          const u: User = {
            id: fb.uid,
            email: fb.email || '',
            firstName,
            lastName,
            role: 'customer',
            isActive: true,
            createdAt: fb.metadata?.creationTime || new Date().toISOString(),
          };
          setAuthState(prev => ({
            ...prev,
            user: u,
            isAuthenticated: true,
            isAdmin: false
          }));
          return { success: true, user: u, isAdmin: false };
        }
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    setLoading(true);
    setError(null);
    try {
      // Create auth user in Firebase
      const cred = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      // Set display name for nicer UI
      try {
        await fbUpdateProfile(cred.user, { displayName: `${userData.firstName} ${userData.lastName}`.trim() });
      } catch {
        // ignore
      }
      // Sync with backend and return MongoDB id
      const resp = await apiPostJson<{ user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } }, { email: string; firstName?: string; lastName?: string; phone?: string }>(
        '/api/users/sync',
        { email: userData.email, firstName: userData.firstName, lastName: userData.lastName, phone: userData.phone }
      );
      const ok = resp as { ok: true; user: { id: string; email: string; firstName?: string; lastName?: string; phone?: string; role: 'customer' | 'admin'; isActive: boolean } };
      const u: User = {
        id: ok.user.id,
        email: ok.user.email,
        firstName: ok.user.firstName || userData.firstName,
        lastName: ok.user.lastName || userData.lastName,
        phone: ok.user.phone || userData.phone,
        role: ok.user.role,
        isActive: ok.user.isActive,
        createdAt: new Date().toISOString(),
      };
      setAuthState(prev => ({
        ...prev,
        user: u,
        isAuthenticated: true,
        isAdmin: u.role === 'admin'
      }));
      return { success: true, user: u };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الحساب';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await signOut(auth); } catch (e) { /* ignore signOut error */ }
    
    // Clear all localStorage - both regular and admin
    localStorage.removeItem('auth.userId');
    localStorage.removeItem('auth.userEmail');
    localStorage.removeItem('auth.token');
    localStorage.removeItem('auth.role');
    localStorage.removeItem('AUTH_MODE');
    
    // Clear admin localStorage
    localStorage.removeItem('admin.auth.userId');
    localStorage.removeItem('admin.auth.userEmail');
    localStorage.removeItem('admin.auth.role');
    localStorage.removeItem('admin.auth.firstName');
    localStorage.removeItem('admin.auth.lastName');
    localStorage.removeItem('admin.auth.isActive');
    localStorage.removeItem('admin.auth.token');
    
    setAuthState(prev => ({
      ...prev,
      user: null,
      adminUser: null,
      isAuthenticated: false,
      isAdminAuthenticated: false,
      isAdmin: false,
      token: '',
      adminToken: ''
    }));
    setError(null);
  }, []);

  const adminLogout = useCallback(async () => {
    setAuthState(prev => ({
      ...prev,
      adminUser: null,
      isAdminAuthenticated: false,
      adminToken: ''
    }));
    setError(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!authState.user) return { success: false, error: 'المستخدم غير مسجل الدخول' };
    const updatedUser = { ...authState.user, ...updates } as User;
    setAuthState(prev => ({ ...prev, user: updatedUser }));
    return { success: true, user: updatedUser };
  }, [authState.user]);

  const checkPermission = useCallback((requiredRole: 'customer' | 'admin' = 'customer') => {
    if (requiredRole === 'admin') {
      return authState.isAdminAuthenticated && authState.adminUser?.role === 'admin';
    }
    return authState.isAuthenticated;
  }, [authState]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(() => ({
    user: authState.user,
    adminUser: authState.adminUser,
    isAuthenticated: authState.isAuthenticated,
    isAdminAuthenticated: authState.isAdminAuthenticated,
    isAdmin: authState.isAdmin,
    token: authState.token,
    adminToken: authState.adminToken,
    loading,
    error,
    login,
    loginWithGoogle,
    adminLogin,
    register,
    logout,
    adminLogout,
    updateProfile,
    checkPermission,
    clearError,
  }), [authState, loading, error, login, loginWithGoogle, adminLogin, register, logout, adminLogout, updateProfile, checkPermission, clearError]);

  return (
    <DualAuthContext.Provider value={value}>
      {children}
    </DualAuthContext.Provider>
  );
};