import { apiPostJson } from '@/lib/api';

export type HistoryLog = {
  section: string;
  action: string;
  note?: string;
  meta?: Record<string, unknown>;
  userEmail?: string;
  userId?: string;
};

export async function logHistory(entry: HistoryLog) {
  try {
    // Frontend should avoid noisy logs; only allow clear CRUD-like actions.
    const action = (entry.action || '').toLowerCase();
    const allowedPrefixes = ['create', 'update', 'delete', 'created ', 'updated ', 'deleted '];
    const denyList = ['page_view', 'data_loaded', 'data_refreshed', 'navigate', 'sidebar_toggled', 'mobile_menu_toggled'];
    const isDenied = denyList.includes(action);
    const isAllowed = allowedPrefixes.some(p => action.startsWith(p));
    if (!isAllowed || isDenied) return; // drop noisy events

    await apiPostJson('/api/history', entry);
  } catch (e) {
    // swallow errors to avoid disrupting UX
  }
}
