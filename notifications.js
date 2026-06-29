
// ══════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════
async function checkNotifPermission() {
  const el = document.getElementById('notif-status-text');
  if (!('Notification' in window)) { if(el) el.textContent='Non supporté'; return; }
  if (el) el.textContent = Notification.permission==='granted' ? 'Activées ✅' : 'Non activées';
  checkNotifBanner();
}

function checkNotifBanner() {
  const wrap = document.getElementById('notif-banner-wrap');
  if (!wrap) return;
  // Priorité : mise à jour de l'app > icône changée > rappel d'activation des notifications
  if (updateAvailable) { showUpdateBanner(); return; }
  if (iconVersionChanged) { showIconUpdateBanner(); return; }
  if (Notification.permission==='default') {
    wrap.innerHTML=`<div class="notif-banner"><div class="notif-banner-icon">🔔</div><div class="notif-banner-text"><strong>Active les notifications</strong><br>Pour recevoir tes alarmes</div><button class="notif-banner-btn" onclick="requestNotif()">Activer</button></div>`;
  } else { wrap.innerHTML=''; }
}

function showIconUpdateBanner() {
  const wrap = document.getElementById('notif-banner-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="notif-banner"><div class="notif-banner-icon">🆕</div><div class="notif-banner-text"><strong>Nouvelle icône disponible</strong><br>iOS ne la met pas à jour seul — supprime puis réinstalle l'app pour la voir</div><button class="notif-banner-btn" onclick="dismissIconBanner()">J'ai compris</button></div>`;
}

window.dismissIconBanner = () => {
  iconVersionChanged = false;
  checkNotifBanner();
};

window.requestNotif = async () => {
  const perm = await Notification.requestPermission();
  const el = document.getElementById('notif-status-text');
  if (perm==='granted') {
    showToast(' Notifications activées !');
    if(el) el.textContent='Activées';
    checkNotifBanner();
    scheduleAllAlarms();
    setupFCM();
  } else {
    showToast('❌ Notifications refusées');
    if(el) el.textContent='Refusées ❌';
  }
};

window.toggleNotifications = async () => {
  if (Notification.permission!=='granted') await window.requestNotif();
  else showToast('ℹ️ Désactive dans les réglages du navigateur');
};

// ══════════════════════════════════════════════════════════
//  FCM — TOKEN + NOTIFICATIONS FOREGROUND
// ══════════════════════════════════════════════════════════
const FCM_ENABLED = false; // 

async function setupFCM() {
  if (!FCM_ENABLED) return; // Évite l'erreur 403 (plan Spark = pas de FCM)
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });
    if (!token || !currentUser) return;

    // Sauvegarder le token dans Firestore (éviter les doublons)
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const existingTokens = userSnap.data()?.fcmTokens || [];
    if (!existingTokens.includes(token)) {
      await updateDoc(userRef, { fcmTokens: [...existingTokens, token] });
    }

    // Notifications reçues quand l'app est OUVERTE (foreground)
    onMessage(messaging, payload => {
      const { title, body } = payload.notification || {};
      showToast(`🔔 ${title}: ${body}`);
      // Aussi afficher une vraie notif navigateur
      if (Notification.permission === 'granted') {
        new Notification(title || 'TRIVO', {
          body: body || '',
          icon: '/icons/icon-192-v2.png',
          badge: '/icons/icon-72-v2.png',
        });
      }
    });
  } catch(e) { console.warn('FCM setup:', e); }
}

