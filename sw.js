const CACHE_NAME = 'TRIVO v8.11';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase-bridge.js',
  '/core.js',
  '/sync.js',
  '/dashboard.js',
  '/tasks.js',
  '/memos.js',
  '/calendar.js',
  '/teams.js',
  '/student.js',
  '/settings.js',
  '/notifications.js',
  '/music.js',
  '/lib/jsmediatags.min.js',
  '/focus.js',
  '/manifest.json'
];
// Chemins du shell (app statique) -> chargement cache-first, jamais bloqué par le réseau.
const SHELL_PATHS = new Set(ASSETS.map(a => a === '/' ? '/' : a));

const NETWORK_TIMEOUT_MS = 1500;

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

// Récupère une ressource sur le réseau avec un délai maximum : si le réseau
// ne répond pas sous NETWORK_TIMEOUT_MS (ex: wifi lent/instable), on bascule
// immédiatement sur le cache au lieu d'attendre indéfiniment une réponse qui
// ne viendra peut-être jamais (contrairement à une vraie erreur réseau, un
// fetch lent ne rejette jamais tout seul).
function networkWithTimeout(request) {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      caches.match(request).then(cached => resolve(cached || fetch(request).catch(() => undefined)));
    }, NETWORK_TIMEOUT_MS);

    fetch(request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
      if (settled) return; // le timeout a déjà résolu avec le cache, trop tard
      settled = true;
      clearTimeout(timer);
      resolve(res);
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      caches.match(request).then(cached => resolve(cached));
    });
  });
}

// Fetch
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // On ignore les requêtes qui ne sont pas http/https (ex: chrome-extension://),
  // car l'API Cache du navigateur ne les supporte pas et lève une erreur.
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  const isShell = url.origin === self.location.origin && SHELL_PATHS.has(url.pathname);

  if (isShell) {
    // Cache-first : affichage instantané quelle que soit la vitesse du réseau.
    // Le cache est rafraîchi en arrière-plan (stale-while-revalidate), sans
    // jamais bloquer le rendu sur la réponse réseau.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const refresh = fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || refresh;
      })
    );
    return;
  }

  // Hors shell (CDN Firebase, appels API…) : réseau avec timeout de secours.
  e.respondWith(networkWithTimeout(e.request));
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
