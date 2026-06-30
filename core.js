function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmt(ds) { if(!ds) return ''; const [y,m,d]=ds.split('-'); return `${d}/${m}/${y}`; }
function fmtTs(ts) {
  if(!ts) return '–';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function fmtTime(ts) {
  if(!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let toastTimer;
function showToast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'), 2800);
}

// Fermer modals sur clic overlay
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); });
});

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function updateAppHeight() {
  document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
}
updateAppHeight();
window.addEventListener('resize', updateAppHeight);
window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 100));


// ══════════════════════════════════════════════════════════════════════════════
//  INDEXEDDB — deux bases distinctes
//
//  trivo-display  : source d'affichage de l'app (offline, chargement rapide)
//                   Stores : tasks | teams | memos | prefs | musicTracks
//                   Purge à la déconnexion : tasks, teams, memos
//                   Jamais touché : musicTracks, prefs (thème/design)
//
//  trivo-queue    : file d'attente vers Firebase uniquement
//                   Stores : queue
//                   Chaque entrée = une action (create/update/delete/recover/hard-delete)
//                   Se vide après flush réussi vers Firebase
//                   Nécessite une connexion pour flush
// ══════════════════════════════════════════════════════════════════════════════

let idb = null;        // trivo-display
let idbQueue = null;   // trivo-queue

// ── IDB Display ───────────────────────────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('trivo-display', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('tasks'))       d.createObjectStore('tasks',       { keyPath: 'id' });
      if (!d.objectStoreNames.contains('teams'))       d.createObjectStore('teams',       { keyPath: 'id' });
      if (!d.objectStoreNames.contains('memos'))       d.createObjectStore('memos',       { keyPath: 'id' });
      if (!d.objectStoreNames.contains('prefs'))       d.createObjectStore('prefs',       { keyPath: 'key' });
      if (!d.objectStoreNames.contains('musicTracks')) d.createObjectStore('musicTracks', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror  = () => reject(req.error);
  });
}

async function idbGet(store, key) {
  return new Promise(resolve => {
    const tx  = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
}
async function idbPut(store, value) {
  return new Promise(resolve => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
  });
}
async function idbDelete(store, key) {
  return new Promise(resolve => {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
  });
}
async function idbGetAll(store) {
  return new Promise(resolve => {
    const tx  = idb.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => resolve([]);
  });
}

// Expose sur window — les autres scripts (music.js, sync.js, tasks.js…)
// sont des fichiers séparés et ne peuvent pas accéder aux fonctions
// locales de core.js sans ça.
window.idbGet    = idbGet;
window.idbPut    = idbPut;
window.idbDelete = idbDelete;
window.idbGetAll = idbGetAll;

// ── IDB Queue ─────────────────────────────────────────────────────────────────
function openIDBQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('trivo-queue', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      // Une seule store : queue
      // Clé composite : `${collection}_${docId}` — une seule entrée par document
      // (la dernière action écrase la précédente pour le même doc)
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror  = () => reject(req.error);
  });
}

async function queueGet(key) {
  return new Promise(resolve => {
    const tx  = idbQueue.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
}
async function queuePut(entry) {
  return new Promise(resolve => {
    const tx = idbQueue.transaction('queue', 'readwrite');
    tx.objectStore('queue').put(entry);
    tx.oncomplete = resolve;
  });
}
async function queueDelete(key) {
  return new Promise(resolve => {
    const tx = idbQueue.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(key);
    tx.oncomplete = resolve;
  });
}
async function queueGetAll() {
  return new Promise(resolve => {
    const tx  = idbQueue.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => resolve([]);
  });
}

// Ajoute ou remplace une entrée dans la queue
// Une seule entrée par (collection + docId) — la dernière action gagne
async function queuePush(type, collectionName, docId, data) {
  const entry = {
    id:         `${collectionName}_${docId}`,  // clé unique par document
    type,                                       // 'create' | 'update' | 'delete' | 'recover' | 'hard-delete'
    collection: collectionName,
    docId,
    data:       { ...data },
    updatedAt:  Date.now()
  };
  await queuePut(entry);
}

// Expose sur window
window.queuePush    = queuePush;
window.queueGetAll  = queueGetAll;
window.queueDelete  = queueDelete;
window.queueGet     = queueGet;

//  State
let currentUser = null;
let userProfile = {};
let tasks = [];
let tasksUnsub = null;
let memos = [];
let memosUnsub = null;
let teamsUnsub = null;
let myTeams = [];
let currentFilter = 'today';
let currentHistoryFilter = 'done';
let editingTaskId = null;
let currentTeamId = null;
let teamMode = 'create';
let calendarDate = new Date();
let alarmTimers = {};
let settings = { groupNotif: true, hidePseudo: false };

//  PWA 
let updateAvailable = false;
let swRegistration = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    swRegistration = reg;
    // Détecte une nouvelle version du Service Worker (donc une nouvelle version de l'app)
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        // "installed" + un controller déjà actif = il y avait déjà une version avant -> c'est une mise à jour
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateAvailable = true;
          showUpdateBanner();
        }
      });
    });
  }).catch(console.error);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && swRegistration) {
    swRegistration.update().catch(() => {});
  }
});

function showUpdateBanner() {
  const wrap = document.getElementById('notif-banner-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="notif-banner update-banner">
      <div class="notif-banner-icon"><i class="fa-solid fa-rotate"></i></div>
      <div class="notif-banner-text"><strong>Nouvelle version disponible</strong><br>Recharge l'app pour en profiter</div>
      <button class="notif-banner-btn" onclick="reloadForUpdate()">Recharger</button>
    </div>`;
}

window.reloadForUpdate = () => {
  window.location.reload();
};

function runBoot() {
(async () => {
  // Ouvrir les deux bases en parallèle pour ne pas bloquer le boot
  [idb, idbQueue] = await Promise.all([openIDB(), openIDBQueue()]);
  await loadPrefs();
  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;
      await loadUserProfile();       // IDB uniquement — instantané
      await loadMyDaySelection();    // IDB uniquement — instantané
      showApp();
      startListeners();
      syncUserProfileFromFirebase(); // Firebase — non-bloquant, en arrière-plan
      checkNotifPermission();
      setupFCM();
      resetMotivationForNewSession();
      resetGreetingForNewSession();
      setTimeout(maybeShowMotivationQuote, 600);
    } else {
      currentUser = null;
      resetMotivationForNewSession();
      resetGreetingForNewSession();
      showAuth();
    }
    document.getElementById('loading').style.display = 'none';
  });
})();
}

if (window.auth) {
  runBoot();
} else {
  window.addEventListener('firebase-bridge-ready', runBoot, { once: true });
}

// ── Prefs ──────────────────────────────────────────────────
// Version de l'icône actuelle de l'app — à incrémenter (v3, v4…) à chaque nouveau
// changement de logo. iOS ne rafraîchit JAMAIS l'icône d'une PWA déjà installée sur
// l'écran d'accueil (limite d'Apple, pas un bug ici) : on prévient donc une fois
// l'utilisateur que désinstaller/réinstaller est nécessaire pour la voir.
const CURRENT_ICON_VERSION = 'v2';
let iconVersionChanged = false;

async function checkIconVersion() {
  const seen = await idbGet('prefs', 'iconVersion');
  if (seen?.value && seen.value !== CURRENT_ICON_VERSION) {
    iconVersionChanged = true;
  }
  await idbPut('prefs', { key: 'iconVersion', value: CURRENT_ICON_VERSION });
}

async function loadPrefs() {
  const theme = await idbGet('prefs', 'theme');
  if (theme) setTheme(theme.value, false);
  const s = await idbGet('prefs', 'settings');
  if (s) settings = { ...settings, ...s.value };
  const accent = await idbGet('prefs', 'accentColor');
  if (accent?.value) {
    document.documentElement.setAttribute('data-accent', accent.value === 'blue' ? '' : accent.value);
    document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('selected', d.dataset.accent === accent.value));
  }
  await checkIconVersion();
  updateSettingsToggles();
}
async function savePref(key, value) {
  await idbPut('prefs', { key, value });
}

// ── Theme 
function setTheme(t, save = true) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-dark-btn')?.classList.toggle('active', t === 'dark');
  document.getElementById('theme-light-btn')?.classList.toggle('active', t === 'light');
  if (save) savePref('theme', t);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
}
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;

// ── Auth 
function showAuth() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app').style.display = 'none';
  document.getElementById('fab-add').style.display = 'none';
}
function showApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app').style.display = 'flex';
  renderUserUI();
  goTo('dashboard');
}

window.switchAuthTab = (tab) => {
  document.getElementById('login-form').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
};

window.doLogin = async () => {
  const email = document.getElementById('login-email').value.trim();
  const pwd = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !pwd) { errEl.textContent = 'Remplis tous les champs.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch (e) { errEl.textContent = authError(e.code); }
};

window.doRegister = async () => {
  const pseudo = document.getElementById('reg-pseudo').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pwd = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  if (!pseudo || !email || !pwd) { errEl.textContent = 'Remplis tous les champs.'; return; }
  if (pwd.length < 6) { errEl.textContent = 'Mot de passe : 6 caractères min.'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    await updateProfile(cred.user, { displayName: pseudo });
    await setDoc(doc(db, 'users', cred.user.uid), {
      pseudo, email, photoURL: '', createdAt: serverTimestamp(),
      settings: { groupNotif: true, hidePseudo: false }
    });
  } catch (e) { errEl.textContent = authError(e.code); }
};

function authError(code) {
  const m = {
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-email': 'Email invalide.',
    'auth/email-already-in-use': 'Email déjà utilisé.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  };
  return m[code] || 'Erreur : ' + code;
}

// ── Afficher / masquer le mot de passe ──
window.togglePwVisibility = (inputId, btn) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  }
};

// ── Mot de passe oublié ──
window.openForgotModal = () => {
  const overlay = document.getElementById('forgot-modal-overlay');
  if (!overlay) return;
  // Pré-remplir avec l'email déjà saisi si dispo
  const loginEmail = document.getElementById('login-email')?.value.trim();
  if (loginEmail) document.getElementById('forgot-email').value = loginEmail;
  document.getElementById('forgot-error').textContent = '';
  document.getElementById('forgot-success').style.display = 'none';
  overlay.classList.add('open');
};

window.closeForgotModal = () => {
  document.getElementById('forgot-modal-overlay')?.classList.remove('open');
};

window.doForgotPassword = async () => {
  const email = document.getElementById('forgot-email').value.trim();
  const errEl = document.getElementById('forgot-error');
  const successEl = document.getElementById('forgot-success');
  errEl.textContent = '';
  successEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Entre ton email.'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    successEl.style.display = 'block';
    // Fermeture auto après 3 secondes
    setTimeout(() => window.closeForgotModal(), 3000);
  } catch (e) {
    errEl.textContent = authError(e.code);
  }
};

// ── Déconnexion sécurisée ────────────────────────────────────────────────────
// 1. Ouvre le modal (jamais de déconnexion directe au clic)
// 2. Vérifie la connexion — bloque immédiatement si hors ligne
// 3. Réauthentifie avec le mot de passe Firebase
// 4. Si correct : spinner → flush queue → purge IDB → signOut
// 5. Si incorrect : message d'erreur, rien d'autre ne se passe

window.openLogoutModal = () => {
  document.getElementById('logout-password-input').value = '';
  document.getElementById('logout-error-msg').style.display = 'none';
  document.getElementById('logout-modal').classList.add('open');
  setTimeout(() => document.getElementById('logout-password-input').focus(), 100);
};

function _showLogoutError(msg) {
  const el = document.getElementById('logout-error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

function _setLogoutLoading(loading) {
  document.getElementById('logout-confirm-label').style.display = loading ? 'none' : 'inline';
  document.getElementById('logout-spinner').style.display = loading ? 'inline' : 'none';
  document.getElementById('logout-confirm-btn').disabled = loading;
  document.getElementById('logout-cancel-btn').disabled = loading;
  document.getElementById('logout-password-input').disabled = loading;
}

window.confirmLogout = async () => {
  document.getElementById('logout-error-msg').style.display = 'none';

  // Vérification connexion AVANT toute tentative de mot de passe —
  // évite le piège "code erroné forcé avant que le vrai fonctionne"
  if (!navigator.onLine) {
    _showLogoutError('Vérifiez votre connexion internet');
    return;
  }

  const password = document.getElementById('logout-password-input').value;
  if (!password) {
    _showLogoutError('Mot de passe requis');
    return;
  }

  _setLogoutLoading(true);

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    // Mot de passe correct — flush la queue vers Firebase avant purge
    if (navigator.onLine) await window.queueFlush();

    if (tasksUnsub) tasksUnsub();
    if (teamsUnsub) teamsUnsub();
    if (memosUnsub) memosUnsub();

    await purgeLocalDataOnLogout();
    tasks = []; myTeams = []; memos = [];

    document.getElementById('logout-modal').classList.remove('open');
    await signOut(auth);

  } catch (err) {
    _setLogoutLoading(false);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      _showLogoutError('Mot de passe incorrect');
    } else if (err.code === 'auth/network-request-failed') {
      _showLogoutError('Vérifiez votre connexion internet');
    } else {
      _showLogoutError('Une erreur est survenue');
      console.error('Logout error:', err);
    }
  }
};

async function purgeLocalDataOnLogout() {
  // Purge trivo-display : tasks, teams, memos
  const tasksStore = await idbGetAll('tasks');
  for (const t of tasksStore) await idbDelete('tasks', t.id);

  const teamsStore = await idbGetAll('teams');
  for (const t of teamsStore) await idbDelete('teams', t.id);

  const memosStore = await idbGetAll('memos');
  for (const m of memosStore) await idbDelete('memos', m.id);

  // Purge trivo-queue : vider toutes les actions en attente
  const queueStore = await queueGetAll();
  for (const q of queueStore) await queueDelete(q.id);

  // Prefs liées au compte — pas le thème ni accentColor
  await idbDelete('prefs', 'avatarBase64');
  await idbDelete('prefs', 'settings');
  await idbDelete('prefs', 'myDaySelection');
  // musicTracks, theme et accentColor conservés volontairement
}

//  User Profile 
async function loadUserProfile() {
  // Partie 1 — IDB uniquement (instantané, fonctionne hors-ligne)
  // Bloquante : showApp() attend que le profil local soit chargé avant d'afficher
  try {
    const cachedAvatar = await idbGet('prefs', 'avatarBase64');
    if (cachedAvatar?.value) userProfile.photoURL = cachedAvatar.value;
  } catch(e) {}
}

async function syncUserProfileFromFirebase() {
  // Partie 2 — Firebase (peut être lent ou indisponible)
  // Non-bloquante : lancée en arrière-plan après showApp()
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      userProfile = { ...userProfile, ...data };
      if (data.photoBase64) {
        userProfile.photoURL = data.photoBase64;
        await idbPut('prefs', { key: 'avatarBase64', value: data.photoBase64 });
      }
      settings = { ...settings, ...data.settings };
      await savePref('settings', settings);
      // Mettre à jour l'UI avec les données Firebase quand elles arrivent
      renderUserUI();
    }
  } catch (e) { console.warn('Profile Firebase:', e); }
}

function renderUserUI() {
  const pseudo = userProfile.pseudo || currentUser?.displayName || '?';
  const initials = pseudo.slice(0, 2).toUpperCase();
  const photoURL = userProfile.photoURL || currentUser?.photoURL || '';

  const av = document.getElementById('user-avatar');
  if (av) { av.innerHTML = photoURL ? `<img src="${photoURL}" alt="">` : initials; }

  const sn = document.getElementById('settings-name');
  const se = document.getElementById('settings-email');
  const bigAv = document.getElementById('settings-avatar-big');
  if (sn) sn.textContent = pseudo;
  if (se) se.textContent = currentUser?.email || '';
  if (bigAv) {
    bigAv.innerHTML = photoURL
      ? `<img src="${photoURL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : initials;
  }
  renderGroupAvatarGrid();
  updateSettingsToggles();
}

// ── 10 avatars de groupe prédéfinis (pas besoin de Firebase Storage) ──
const GROUP_AVATARS = [
  { id: 'ga1', icon: 'fa-rocket', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { id: 'ga2', icon: 'fa-fire', grad: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { id: 'ga3', icon: 'fa-leaf', grad: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { id: 'ga4', icon: 'fa-bolt', grad: 'linear-gradient(135deg,#eab308,#f97316)' },
  { id: 'ga5', icon: 'fa-star', grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
  { id: 'ga6', icon: 'fa-paw', grad: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { id: 'ga7', icon: 'fa-feather', grad: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' },
  { id: 'ga8', icon: 'fa-crown', grad: 'linear-gradient(135deg,#a855f7,#ec4899)' },
  { id: 'ga9', icon: 'fa-moon', grad: 'linear-gradient(135deg,#1e293b,#475569)' },
  { id: 'ga10', icon: 'fa-sun', grad: 'linear-gradient(135deg,#fbbf24,#f97316)' },
];

function getGroupAvatar(id) {
  return GROUP_AVATARS.find(a => a.id === id) || GROUP_AVATARS[0];
}

function renderGroupAvatarGrid() {
  const el = document.getElementById('group-avatar-grid');
  if (!el) return;
  const current = userProfile.groupAvatar || 'ga1';
  el.innerHTML = GROUP_AVATARS.map(a => `
    <div class="group-avatar-opt ${a.id===current?'selected':''}" style="background:${a.grad};" onclick="selectGroupAvatar('${a.id}')">
      <i class="fa-solid ${a.icon}"></i>
    </div>`).join('');
}

window.selectGroupAvatar = async (id) => {
  userProfile.groupAvatar = id;
  renderGroupAvatarGrid();
  if (currentUser) await updateDoc(doc(db,'users',currentUser.uid), { groupAvatar: id }).catch(()=>{});
  showToast('Avatar de groupe mis à jour');
};


function updateSettingsToggles() {
  document.getElementById('group-notif-toggle')?.classList.toggle('on', !!settings.groupNotif);
  document.getElementById('hide-pseudo-toggle')?.classList.toggle('on', !!settings.hidePseudo);
  document.getElementById('music-feature-toggle')?.classList.toggle('on', !!settings.musicEnabled);
  document.getElementById('fullscreen-toggle')?.classList.toggle('on', !!settings.fullscreenStable);
  const navMusicBtn = document.getElementById('nav-music-btn');
  if (navMusicBtn) navMusicBtn.style.display = settings.musicEnabled ? 'flex' : 'none';
  applyFullscreenMode(settings.fullscreenStable);
}

function applyFullscreenMode(enabled) {
  document.documentElement.classList.toggle('fullscreen-stable', !!enabled);
}

window.toggleGroupNotif = async () => { settings.groupNotif = !settings.groupNotif; await saveSettings(); };
window.toggleHidePseudo = async () => { settings.hidePseudo = !settings.hidePseudo; await saveSettings(); };
window.toggleFullscreenMode = async () => {
  settings.fullscreenStable = !settings.fullscreenStable;
  await saveSettings();
};

async function saveSettings() {
  updateSettingsToggles();
  await savePref('settings', settings);
  if (currentUser) await updateDoc(doc(db, 'users', currentUser.uid), { settings }).catch(() => {});
}

// ── Navigation ─────────────────────────────────────────────
window.goTo = (screen) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${screen}`)?.classList.add('active');
  document.querySelector(`[data-screen="${screen}"]`)?.classList.add('active');
  document.getElementById('fab-add').style.display = screen === 'tasks' ? 'flex' : 'none';
  const titles = { dashboard: 'TRIVO', tasks: '📋 Mes tâches', calendar: '📅 Agenda', teams: '👥 Équipes', settings: '⚙️ Paramètres', music: '🎵 Musique' };
  const topbarTitleEl = document.getElementById('topbar-title');
  if (screen === 'dashboard') {
    topbarTitleEl.innerHTML = `<img src="icons/icon-logo.png" alt="" class="topbar-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" /><i class="fa-solid fa-book-open" style="display:none;"></i> TRIVO`;
  } else {
    topbarTitleEl.textContent = titles[screen] || 'TRIVO';
  }
  if (screen === 'dashboard') renderDashboard();
  if (screen === 'tasks') { if (taskViewMode === 'kanban') renderKanbanBoard(); else renderTaskList(); }
  if (screen === 'calendar') renderCalendar();
  if (screen === 'teams') renderTeams();
  if (screen === 'settings') { renderUserUI(); loadConcentrationSettingsUI(); }
  if (screen === 'music') loadMusicScreen();
};

// ══════════════════════════════════════════════════════════
//  LISTENERS FIRESTORE
// ══════════════════════════════════════════════════════════
function startListeners() {
  if (tasksUnsub) tasksUnsub();

  // Affichage instantané depuis IDB — toujours, sans attendre Firebase
  idbGetAll('tasks').then(cached => {
    const myTasks = cached.filter(t => t.uid === currentUser?.uid);
    if (myTasks.length > 0) {
      tasks = myTasks;
      renderTaskList();
      if (taskViewMode === 'kanban') renderKanbanBoard();
      renderDashboard();
    }
  });

  const q = query(collection(db, 'tasks'), where('uid', '==', currentUser.uid));
  tasksUnsub = onSnapshot(q, async snap => {
    // ── Fusion Firebase → IDB display ──────────────────────────────────────
    // Règle : Firebase ne remplace une entrée IDB que si son updatedAt
    // est strictement plus récent. Cela évite qu'un snapshot Firebase
    // "en retard" écrase une modification locale faite hors ligne.
    for (const change of snap.docChanges()) {
      const fbDoc  = { id: change.doc.id, ...change.doc.data() };

      if (change.type === 'removed') {
        // Suppression réelle côté Firebase (hard-delete)
        await idbDelete('tasks', fbDoc.id);
        tasks = tasks.filter(t => t.id !== fbDoc.id);
        continue;
      }

      // Convertit le Timestamp Firebase en ms pour comparaison
      const fbUpdatedAt = fbDoc.updatedAt?.toMillis?.() ?? fbDoc.updatedAt ?? 0;

      // Cherche la version locale dans IDB
      const local = await idbGet('tasks', fbDoc.id);
      const localUpdatedAt = local?.updatedAt ?? 0;

      if (fbUpdatedAt >= localUpdatedAt) {
        // Firebase est plus récent (ou égal) → on accepte
        await idbPut('tasks', { ...fbDoc, updatedAt: fbUpdatedAt });
        // Met à jour le tableau en mémoire
        const idx = tasks.findIndex(t => t.id === fbDoc.id);
        const merged = { ...fbDoc, updatedAt: fbUpdatedAt };
        if (idx >= 0) tasks[idx] = merged;
        else tasks.push(merged);
      }
      // Si local plus récent → on ignore silencieusement ce snapshot pour ce doc
    }

    tasks.sort((a, b) => (b.timestamp?.toMillis?.() ?? b.timestamp ?? 0)
                       - (a.timestamp?.toMillis?.() ?? a.timestamp ?? 0));

    renderTaskList();
    if (taskViewMode === 'kanban') renderKanbanBoard();
    renderDashboard();
    scheduleAllAlarms();
    purgeOldDeletedTasks();
  }, async (err) => {
    console.error('Erreur Firestore tasks:', err);
    tasks = await idbGetAll('tasks');
    tasks = tasks.filter(t => t.uid === currentUser?.uid);
    renderTaskList();
    renderDashboard();
  });

  const tq = query(collection(db, 'teams'), where('memberIds', 'array-contains', currentUser.uid));
  teamsUnsub = onSnapshot(tq, snap => {
    myTeams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTeams();
    updateTeamsBadge();
    startTeamUnreadListeners();
  }, (err) => console.error('Erreur Firestore teams:', err));

  // Mémos : même pattern offline-first que les tâches.
  if (memosUnsub) memosUnsub();
  idbGetAll('memos').then(cached => {
    if (memos.length === 0 && cached.length > 0) {
      memos = cached.filter(m => m.uid === currentUser?.uid);
      renderMemosList();
    }
  });
  const mq = query(collection(db, 'memos'), where('uid', '==', currentUser.uid));
  memosUnsub = onSnapshot(mq, async snap => {
    memos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    memos.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    for (const m of memos) await idbPut('memos', m);
    renderMemosList();
  }, async (err) => {
    console.error('Erreur Firestore memos:', err);
    memos = await idbGetAll('memos');
    memos = memos.filter(m => m.uid === currentUser?.uid);
    renderMemosList();
  });
}

