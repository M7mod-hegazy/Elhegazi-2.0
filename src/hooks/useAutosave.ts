import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type UseAutosaveOptions<T> = {
  delay?: number; // ms
  enabled?: boolean;
  validate?: (data: T) => boolean;
  onError?: (error: unknown) => void;
};

export function useAutosave<T>(data: T, saveFn: (quiet?: boolean) => Promise<void>, opts: UseAutosaveOptions<T> = {}) {
  const { delay = 1000, enabled = true, validate, onError } = opts;
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const isValid = useMemo(() => (validate ? validate(data) : true), [data, validate]);

  const triggerSave = useCallback(
    (quiet = true) => {
      if (!enabled || !isValid) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        try {
          setSaving(true);
          await saveFn(quiet);
          if (!mounted.current) return;
          setLastSavedAt(Date.now());
        } catch (e) {
          onError?.(e);
        } finally {
          if (mounted.current) setSaving(false);
        }
      }, delay) as unknown as number;
    },
    [delay, enabled, isValid, saveFn, onError]
  );

  // Automatically trigger on data changes
  useEffect(() => {
    triggerSave(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const cancel = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const isDirty = useMemo(() => !!timer.current, []);

  return { saving, lastSavedAt, triggerSave, cancel, isDirty } as const;
}
