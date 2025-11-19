import { useContext } from 'react';
import { DualAuthContext } from '@/context/DualAuthContext';

export const useDualAuth = () => {
  const ctx = useContext(DualAuthContext);
  if (!ctx) {
    throw new Error('useDualAuth must be used within a DualAuthProvider');
  }
  return ctx;
};
