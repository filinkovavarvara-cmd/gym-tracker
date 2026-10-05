const CACHE_NAME = 'gym-tracker-v26';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icons/arrows-clockwise.svg',
  './icons/arrows-down-up.svg',
  './icons/chat-teardrop-dots.svg',
  './icons/barbell.svg',
  './icons/caret-down.svg',
  './icons/caret-left.svg',
  './icons/chart-bar-outline.svg',
  './icons/chart-bar.svg',
  './icons/check.svg',
  './icons/clock-counter-clockwise.svg',
  './icons/dots-three.svg',
  './icons/faders-horizontal.svg',
  './icons/fire.svg',
  './icons/house.svg',
  './icons/info.svg',
  './icons/list-dashes.svg',
  './icons/magnifying-glass.svg',
  './icons/pencil-simple.svg',
  './icons/play.svg',
  './icons/plus.svg',
  './icons/stop.svg',
  './icons/trash.svg',
  './icons/x.svg'
];

// Установка Service Worker и кэширование статических ресурсов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Cache addAll partial failure (e.g. icons generated dynamically):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Активация и удаление старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия Network First с откатом на Cache для офлайн-работы
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Обрабатываем только файлы самого приложения; чужие адреса не трогаем
  if (new URL(event.request.url).origin !== self.location.origin) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если ответ валидный, обновляем кэш в фоне
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Если офлайн — отдаем из кэша
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
