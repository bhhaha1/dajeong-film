// 오프라인용: 앱 파일을 처음 열 때 받아 두고, 그다음부터는 저장본을 먼저 쓴다.
const CACHE = 'dajeong-film-v4';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/gl.js', 'js/filters.js', 'js/compose.js', 'js/store.js', 'js/media.js', 'js/exif.js', 'js/scenes.js', 'js/camera-art.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
