const APP_CACHE_NAME = 'crypto-analyzer-v0.6.1'; // Bump version to force update
const DATA_CACHE_NAME = 'dahab-app-data-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event: cache the app shell and activate immediately.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force activation
  );
});

// Activate event: clean up old caches and take control.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old app caches, but preserve the data cache
          if (cacheName !== APP_CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        console.log('[Service Worker] Claiming clients.');
        return self.clients.claim(); // Take control of open pages
      });
    })
  );
});

// Fetch event: Apply caching strategies.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isApiCall = url.hostname.includes('api.binance.com') || 
                    url.hostname.includes('api.alternative.me') ||
                    url.hostname.includes('api.coingecko.com') ||
                    url.hostname.includes('api.allorigins.win');

  // API calls: Network only.
  if (isApiCall) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell and other static assets: Stale-while-revalidate.
  // Serve from cache first for speed, then update cache from network.
  event.respondWith(
    caches.open(APP_CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const networkFetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
          console.log('[Service Worker] Network fetch failed:', error);
          // If network fails and we don't have a cached response, the browser will show its offline page.
          // For the app shell (e.g., index.html), it will already be in the cache from the install event.
        });

        // Return cached response immediately if available, otherwise wait for network.
        return cachedResponse || networkFetchPromise;
      });
    })
  );
});

// Listen for a message from the app to skip waiting and activate the new SW
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});