const CACHE_NAME = 'TRIVO v3 0.3';
const ASSETS = [
  '/',
  '/index.html',
  '/firebase-bridge.js',
  '/core.js',
  '/dashboard.js',
  '/tasks.js',
  '/memos.js',
  '/calendar.js',
  '/teams.js',
  '/settings.js',
  '/notifications.js',
  '/music.js',
  '/focus.js',
  '/manifest.json'
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch (offline first)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // On ignore les requêtes qui ne sont pas http/https (ex: chrome-extension://),
  // car l'API Cache du navigateur ne les supporte pas et lève une erreur.
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'TRIVO';
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icons/icon-192-v2.png',
    badge: '/icons/icon-72-v2.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'open' || !e.action) {
    e.waitUntil(clients.openWindow(e.notification.data || '/'));
  }
});

// Alarm notifications (scheduled via postMessage)
// On garde une référence par tâche (taskId) pour annuler l'ancien timer avant
// d'en programmer un nouveau — évite les notifications dupliquées.
const scheduledAlarms = {};
const repeatAlarms = {}; // { taskId: { title, body, intervalMs, timerId } }

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_ALARM') {
    const { taskId, title, body, delay } = e.data;
    if (taskId && scheduledAlarms[taskId]) {
      clearTimeout(scheduledAlarms[taskId]);
    }
    const timerId = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192-v2.png',
        badge: '/icons/icon-72-v2.png',
        vibrate: [300, 100, 300, 100, 300]
      });
      if (taskId) delete scheduledAlarms[taskId];
    }, delay);
    if (taskId) scheduledAlarms[taskId] = timerId;
  }

  // Rappel répété : se reprogramme lui-même tant que le Service Worker reste actif.
  // ⚠️ Limite connue : les navigateurs (surtout mobile) peuvent mettre en veille
  // ou arrêter un Service Worker inactif après quelques minutes pour économiser
  // la batterie. Le rappel fonctionne de façon fiable si l'app est régulièrement
  // rouverte, mais n'est pas garanti à 100% sur plusieurs heures app fermée —
  // c'est une limitation structurelle des PWA, pas un bug applicatif.
  if (e.data && e.data.type === 'SCHEDULE_REPEAT_ALARM') {
    const { taskId, title, body, intervalMs } = e.data;
    if (repeatAlarms[taskId]) clearTimeout(repeatAlarms[taskId].timerId);

    function fireAndReschedule() {
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192-v2.png',
        badge: '/icons/icon-72-v2.png',
        vibrate: [300, 100, 300]
      });
      repeatAlarms[taskId].timerId = setTimeout(fireAndReschedule, intervalMs);
    }
    repeatAlarms[taskId] = { title, body, intervalMs, timerId: setTimeout(fireAndReschedule, intervalMs) };
  }

  if (e.data && e.data.type === 'CANCEL_ALARM') {
    const { taskId } = e.data;
    if (taskId && scheduledAlarms[taskId]) {
      clearTimeout(scheduledAlarms[taskId]);
      delete scheduledAlarms[taskId];
    }
    if (taskId && repeatAlarms[taskId]) {
      clearTimeout(repeatAlarms[taskId].timerId);
      delete repeatAlarms[taskId];
    }
  }
});
