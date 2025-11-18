import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User, AuthState } from '@/types';
import { apiPostJson } from '@/lib/api';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, createUserWithEmailAndPassword, updateProfile as fbUpdateProfile } from 'firebase/auth';
import { AuthContext, type AuthContextValue, type LoginCredentials, type RegisterData } from '@/context/AuthContextBase';

// Context is now created in AuthContextBase to satisfy Fast Refresh constraints

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, isAuthenticated: false, isAdmin: false, token: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'firebase' | 'backend'>(() => (typeof window !== 'undefined' ? ((localStorage.getItem('AUTH_MODE') as 'firebase' | 'backend') || 'firebase') : 'firebase'));

  // Keep Firebase auth state in sync with our app state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      // If we're in backend-admin mode, don't override state with Firebase observer
      if (authMode === 'backend') { setLoading(false); return; }
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
            setAuthState({ user: synced, isAuthenticated: true, isAdmin: synced.role === 'admin', token: '' });
          } catch {
            // Fallback to Firebase user only
            setAuthState({ user: baseUser, isAuthenticated: true, isAdmin: false, token: '' });
          }
        })().finally(() => setLoading(false));
      } else {
        setAuthState({ user: null, isAuthenticated: false, isAdmin: false, token: '' });
        setLoading(false);
      }
    });
    return () => unsub();
  }, [authMode]);

  // Backend mode: restore from localStorage on mount (prevents redirect on reload)
  useEffect(() => {
    if (authMode !== 'backend') return;
    try {
      const userId = localStorage.getItem('auth.userId');
      const email = localStorage.getItem('auth.userEmail') || '';
      const role = (localStorage.getItem('auth.role') || 'customer') as User['role'];
      const firstName = localStorage.getItem('auth.firstName') || '';
      const lastName = localStorage.getItem('auth.lastName') || '';
      const isActiveStr = localStorage.getItem('auth.isActive');
      const isActive = isActiveStr ? isActiveStr === 'true' : true;
      const token = localStorage.getItem('auth.token') || '';
      if (userId) {
        const u: User = { id: userId, email, firstName, lastName, role, isActive, createdAt: new Date().toISOString() };
        setAuthState({ user: u, isAuthenticated: true, isAdmin: role === 'admin', token });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authMode]);

  // Persist basic identity for server-side audit headers and reload restore
  useEffect(() => {
    try {
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
    } catch {
      // ignore storage errors (SSR/privacy modes)
    }
  }, [authState.user]);

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
      setAuthState({ user: u, isAuthenticated: true, isAdmin: u.role === 'admin', token });
      setAuthMode('backend');
      try {
        localStorage.setItem('AUTH_MODE', 'backend');
        if (token) localStorage.setItem('auth.token', token);
      } catch (e) { /* ignore storage error */ }
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
      setAuthState({ user: u, isAuthenticated: true, isAdmin: u.role === 'admin', token: '' });
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
    try { await signOut(auth); } catch (e) { /* ignore signOut error in backend mode */ }
    setAuthState({ user: null, isAuthenticated: false, isAdmin: false, token: '' });
    setError(null);
    setAuthMode('firebase');
    try {
      localStorage.removeItem('AUTH_MODE');
      localStorage.removeItem('auth.userId');
      localStorage.removeItem('auth.userEmail');
      localStorage.removeItem('auth.token');
    } catch (e) { /* ignore storage error */ }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!authState.user) return { success: false, error: 'المستخدم غير مسجل الدخول' };
    const updatedUser = { ...authState.user, ...updates } as User;
    setAuthState(prev => ({ ...prev, user: updatedUser }));
    return { success: true, user: updatedUser };
  }, [authState.user]);

  const checkPermission = useCallback((requiredRole: 'customer' | 'admin' = 'customer') => {
    if (!authState.isAuthenticated || !authState.user) return false;
    if (requiredRole === 'admin') {
      return authState.user.role === 'admin';
    }
    return true;
  }, [authState]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isAdmin: authState.isAdmin,
    token: authState.token,
    loading,
    error,
    login,
    loginWithGoogle,
    adminLogin,
    register,
    logout,
    updateProfile,
    checkPermission,
    clearError,
  }), [authState, loading, error, login, loginWithGoogle, adminLogin, register, logout, updateProfile, checkPermission, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
