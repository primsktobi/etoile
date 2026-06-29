
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCsQDE6X6aZMQP7uJslJhWTQRGd4yWGXEM",
  authDomain: "notesnyc-55d0a.firebaseapp.com",
  projectId: "notesnyc-55d0a",
  storageBucket: "notesnyc-55d0a.firebasestorage.app",
  messagingSenderId: "727233752008",
  appId: "1:727253752008:web:b8961ac87ad1d1d7142efd"
});

const messaging = firebase.messaging();

// Notification reçue en background
messaging.onBackgroundMessage(payload => {
  const { title, body, icon, data } = payload.notification || {};
  self.registration.showNotification(title || 'TRIVO', {
    body: body || '',
    icon: icon || '/icons/icon-192-v2.png',
    badge: '/icons/icon-72-v2.png',
    vibrate: [200, 100, 200, 100, 200],
    data: data || {},
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  });
});

// Clic sur la notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action !== 'dismiss') {
    e.waitUntil(clients.openWindow('/'));
  }
});
