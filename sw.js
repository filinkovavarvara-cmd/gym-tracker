const CACHE_NAME = 'gym-tracker-v49';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './import.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icons/arrows-clockwise.svg',
  './icons/arrows-down-up.svg',
  './icons/bookmark-simple.svg',
  './icons/chat-teardrop-dots.svg',
  './icons/barbell.svg',
  './icons/caret-down.svg',
  './icons/caret-left.svg',
  './icons/chart-bar-outline.svg',
  './icons/chart-bar.svg',
  './icons/check.svg',
  './icons/clock-counter-clockwise.svg',
  './icons/copy.svg',
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
  './icons/Rows.svg',
  './icons/stop.svg',
  './icons/trash.svg',
  './icons/Wrench.svg',
  './icons/x.svg'
];

// Установка Service Worker и кэширование статических ресурсов
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const existed = await caches.has(CACHE_NAME);
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      // Never remove a pre-existing cache, including another build using this key.
      if (!existed) await caches.delete(CACHE_NAME);
      throw error; // A rejected install keeps the previous worker active.
    }
    await self.skipWaiting();
  })());
});

// Активация и удаление старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Transfer control to the fully precached worker before retiring old caches.
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^gym-tracker-v\d+$/.test(key) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
  })());
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
