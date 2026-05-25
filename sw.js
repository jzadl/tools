const CACHE_NAME = 'tools-cache-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/shared.css',
  '/kext-checker/',
  '/kext-checker/index.html',
  '/kext-checker/style.css',
  '/kext-checker/script.js',
  '/cava-maker/',
  '/cava-maker/index.html',
  '/cava-maker/style.css',
  '/cava-maker/script.js',
  '/color-picker/',
  '/color-picker/index.html',
  '/color-picker/style.css',
  '/color-picker/script.js',
  '/image-compressor/',
  '/image-compressor/index.html',
  '/image-compressor/style.css',
  '/image-compressor/script.js',
  '/bg-remover/',
  '/bg-remover/index.html',
  '/bg-remover/style.css',
  '/bg-remover/script.js',
  '/meta-cleaner/',
  '/meta-cleaner/index.html',
  '/meta-cleaner/style.css',
  '/meta-cleaner/script.js',
  '/qr-generator/',
  '/qr-generator/index.html',
  '/qr-generator/style.css',
  '/qr-generator/script.js',
  '/ip-lookup/',
  '/ip-lookup/index.html',
  '/ip-lookup/style.css',
  '/ip-lookup/script.js',
  '/gradient-maker/',
  '/gradient-maker/index.html',
  '/gradient-maker/style.css',
  '/gradient-maker/script.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
