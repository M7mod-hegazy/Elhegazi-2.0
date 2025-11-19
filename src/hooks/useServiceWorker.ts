import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
}

/**
 * Hook to register and manage Service Worker
 * Enables offline support and asset caching
 */
export const useServiceWorker = (): ServiceWorkerState => {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
  });

  useEffect(() => {
    // Check if Service Workers are supported
    if (!('serviceWorker' in navigator)) {
      console.log('⚠️ Service Workers not supported');
      return;
    }

    setState((prev) => ({ ...prev, isSupported: true }));

    // Register Service Worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        console.log('✅ Service Worker registered:', registration);
        setState((prev) => ({ ...prev, isRegistered: true }));

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New Service Worker is ready
                console.log('🔄 Service Worker update available');
                setState((prev) => ({ ...prev, updateAvailable: true }));

                // Notify user about update
                window.dispatchEvent(
                  new CustomEvent('service-worker-update', {
                    detail: { registration },
                  })
                );
              }
            });
          }
        });
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    };

    // Delay registration to avoid blocking initial load
    const timeout = setTimeout(registerServiceWorker, 2000);

    // Listen for online/offline events
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
};

/**
 * Hook to handle Service Worker updates
 * Prompts user to refresh when update is available
 */
export const useServiceWorkerUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔄 Service Worker update available');
      setUpdateAvailable(true);

      // Auto-refresh after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };

    window.addEventListener('service-worker-update', handleUpdate);
    return () => window.removeEventListener('service-worker-update', handleUpdate);
  }, []);

  const skipUpdate = () => setUpdateAvailable(false);
  const applyUpdate = () => window.location.reload();

  return { updateAvailable, skipUpdate, applyUpdate };
};
