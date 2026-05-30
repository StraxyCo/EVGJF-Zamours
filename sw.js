const CACHE = 'zamours-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/sw.js',
  '/public/data/questions.json',
  '/public/images/zamours-logo.png',
  '/public/images/stickerDavid.png',
  '/public/images/stickerJu.png',
  '/public/images/bulleBackground.svg',
  '/public/images/heart.svg',
  '/public/images/check.svg',
  '/public/images/close.svg',
  '/public/images/pass.svg',
  '/public/fonts/BebasNeue-Regular.woff2',
  '/public/fonts/Damion-Regular.woff2',
  '/public/audio/background.mp3',
  '/public/audio/questionSuccess.mp3',
  '/public/audio/questionFailure.mp3',
  '/public/audio/questionSkip.mp3',
  '/public/audio/finaleSuccess.mp3',
  '/public/audio/finaleFailure.mp3',
  '/public/audio/gong.mp3',
  // Video excluded: too large; served fresh or from browser cache
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Cache-first for same-origin requests; network-only for video
  if (e.request.url.includes('/public/videos/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
