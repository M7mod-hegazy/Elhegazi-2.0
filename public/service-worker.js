/**
 * Service Worker for Offline Support & Asset Caching
 * Caches critical assets for instant load and offline support
 */

const CACHE_NAME = 'app-cache-v3';
const RUNTIME_CACHE = 'runtime-cache-v1';
const IMAGE_CACHE = 'image-cache-v1';

// Critical assets to cache on install
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/iconPng.png',
  '/favicon.ico',
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Caching critical assets');
      return cache.addAll(CRITICAL_ASSETS).catch((error) => {
        console.warn('⚠️ Service Worker: Failed to cache some assets', error);
      });
    }).then(() => {
      // Skip waiting to activate immediately
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME &&
            cacheName !== RUNTIME_CACHE &&
            cacheName !== IMAGE_CACHE) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip Vite HMR and development files
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@fs') ||
    url.pathname.includes('/@id') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/__vite') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname.endsWith('.map') ||
    url.search.includes('?v=') || // Vite versioned imports
    url.search.includes('?t=')    // Vite timestamp imports
  ) {
    return;
  }

  // Handle API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses (clone before returning)
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache on network error
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a proper error response if no cache available
            return new Response(
              JSON.stringify({ error: 'Network error and no cached data available' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Handle image requests - cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Return placeholder image on error
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#f0f0f0" width="100" height="100"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });
      })
    );
    return;
  }

  // Handle navigation requests (HTML) - Network First, Cache Fallback
  // This ensures the user always gets the latest version of the app
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh version
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Handle other requests - cache first, network fallback
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok && (request.destination === 'style' || request.destination === 'script')) {
          // STRICT CHECK: Never cache HTML for scripts or styles
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

// Helper functions for background sync
async function syncCart() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const response = await cache.match('/api/cart');
    if (response) {
      const data = await response.json();
      await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
  } catch (error) {
    console.error('Failed to sync cart:', error);
  }
}

async function syncOrders() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const response = await cache.match('/api/orders');
    if (response) {
      const data = await response.json();
      await fetch('/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
  } catch (error) {
    console.error('Failed to sync orders:', error);
  }
}

console.log('✨ Service Worker loaded');
