// ══════════════════════════════════════════════════════════
//  MUSIQUE — écran dédié uniquement à "Ma musique" (plus de
//  dossiers, plus d'ambiance, plus de mode bibliothèque).
// ══════════════════════════════════════════════════════════

let audioPlayer = null;

const MUSIC_COVERS = [
  { icon: 'fa-music', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { icon: 'fa-headphones', grad: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { icon: 'fa-compact-disc', grad: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { icon: 'fa-guitar', grad: 'linear-gradient(135deg,#eab308,#f97316)' },
  { icon: 'fa-drum', grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
  { icon: 'fa-wave-square', grad: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { icon: 'fa-volume-high', grad: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' },
];

function getMusicCover(index) {
  return MUSIC_COVERS[Math.abs(index) % MUSIC_COVERS.length];
}

const musicCoverCanvasCache = {};
function getMusicCoverDataURL(index) {
  const key = Math.abs(index) % MUSIC_COVERS.length;
  if (musicCoverCanvasCache[key]) return musicCoverCanvasCache[key];

  const cover = MUSIC_COVERS[key];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');

  const colors = cover.grad.match(/#[0-9a-fA-F]{6}/g) || ['#6366f1', '#8b5cf6'];
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.22, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.07, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  const dataUrl = canvas.toDataURL('image/png');
  musicCoverCanvasCache[key] = dataUrl;
  return dataUrl;
}

// Applique soit la vraie pochette (coverBase64), soit un dégradé généré, dans un conteneur.
function paintCoverEl(el, coverBase64, coverIndex) {
  if (!el) return;
  if (coverBase64) {
    el.style.background = 'none';
    el.innerHTML = `<img src="${coverBase64}" alt="" />`;
  } else {
    const cover = getMusicCover(coverIndex ?? 0);
    el.style.background = cover.grad;
    el.innerHTML = `<i class="fa-solid ${cover.icon}"></i>`;
  }
}

let musicPlaylist = []; // morceaux perso { id, name, artist, coverBase64, liked, base64 }
let currentTrackIndex = -1;
let isLooping = false;
let musicSortOrder = 'recent'; // 'recent' | 'name' | 'liked'
let musicSearchQuery = '';

function getAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.addEventListener('ended', () => { if (!isLooping) musicNext(); });
    audioPlayer.addEventListener('play', () => updatePlayButton(true));
    audioPlayer.addEventListener('pause', () => updatePlayButton(false));
    audioPlayer.addEventListener('timeupdate', updateSeekBar);
    setupMediaSessionActions();
  }
  return audioPlayer;
}

function setupMediaSessionActions() {
  if (!('mediaSession' in navigator)) return; // API absente sur certains navigateurs
  navigator.mediaSession.setActionHandler('play', () => { getAudioPlayer().play(); });
  navigator.mediaSession.setActionHandler('pause', () => { getAudioPlayer().pause(); });
  navigator.mediaSession.setActionHandler('previoustrack', () => { musicPrev(); });
  navigator.mediaSession.setActionHandler('nexttrack', () => { musicNext(); });
}

function updateMediaSessionMetadata(title, artist, coverIndex, coverBase64) {
  if (!('mediaSession' in navigator)) return;
  const artworkSrc = coverBase64 || (coverIndex != null ? getMusicCoverDataURL(coverIndex) : 'icons/icon-512-v2.png');
  navigator.mediaSession.metadata = new MediaMetadata({
    title: title || 'TRIVO',
    artist: artist || 'TRIVO',
    album: 'TRIVO',
    artwork: [
      { src: artworkSrc, sizes: '512x512', type: 'image/png' },
    ]
  });
}

window.toggleMusicFeature = async () => {
  settings.musicEnabled = !settings.musicEnabled;
  await saveSettings();
  document.getElementById('nav-music-btn').style.display = settings.musicEnabled ? 'flex' : 'none';
  if (settings.musicEnabled) { showToast('🎵 Onglet Musique activé'); loadMusicScreen(); }
  else { stopMusicCompletely(); showToast('Onglet Musique masqué'); }
};

// Arrête complètement la musique en cours et masque l'icône topbar + mini-lecteur + barre du bas
function stopMusicCompletely() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.src = '';
  }
  currentTrackIndex = -1;
  document.getElementById('topbar-music-icon').style.display = 'none';
  document.getElementById('mini-player-drop').classList.remove('open');
  document.getElementById('topbar-music-icon').classList.remove('active');
  clearTimeout(miniPlayerTimer);
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  updateMusicBottomBarVisibility();
  renderMusicList?.();
}
window.stopMusicCompletely = stopMusicCompletely;

async function loadMusicScreen() {
  const allTracks = await idbGetAll('musicTracks');
  musicPlaylist = allTracks.filter(t => t.uid === currentUser?.uid);
  updateSortTabsUI();
  renderMusicList();
  updateMusicBottomBarVisibility();
}

const MUSIC_SORT_MODES = ['recent', 'name', 'liked'];
const MUSIC_SORT_ICONS = {
  recent: '<i class="fa-solid fa-circle"></i>',
  name: 'A→Z',
  liked: '🤍',
};

window.cycleMusicSort = () => {
  const nextIndex = (MUSIC_SORT_MODES.indexOf(musicSortOrder) + 1) % MUSIC_SORT_MODES.length;
  musicSortOrder = MUSIC_SORT_MODES[nextIndex];
  updateSortTabsUI();
  renderMusicList();
};

function updateSortTabsUI() {
  const btn = document.getElementById('music-sort-btn');
  if (!btn) return;
  btn.innerHTML = MUSIC_SORT_ICONS[musicSortOrder];
  const titles = { recent: 'Récent', name: 'Nom (A→Z)', liked: 'Favoris' };
  btn.title = titles[musicSortOrder];
}

// Liste "Ma musique" style Spotify : recherche + tri (récent/nom/favoris) + pochette réelle + like.
function renderMusicList() {
  const container = document.getElementById('my-music-list');
  if (!container) return;

  const q = musicSearchQuery.trim().toLowerCase();
  let items = [...musicPlaylist];
  if (q) {
    items = items.filter(t => (t.name||'').toLowerCase().includes(q) || (t.artist||'').toLowerCase().includes(q));
  }
  if (musicSortOrder === 'name') {
    items.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  } else if (musicSortOrder === 'liked') {
    items.sort((a,b) => (b.liked?1:0) - (a.liked?1:0));
  }
  // 'recent' = ordre d'insertion (par défaut IndexedDB)

  if (musicPlaylist.length === 0) {
    container.innerHTML = `<div class="music-list-empty">Aucune musique pour l'instant — appuie sur + pour en ajouter</div>`;
    return;
  }
  if (items.length === 0) {
    container.innerHTML = `<div class="music-list-empty">Aucun résultat pour « ${escHtml(musicSearchQuery)} »</div>`;
    return;
  }

  const rows = items.map((t, i) => {
    // On identifie le morceau par son id, pas par sa position affichée — sinon un tri/filtre
    // joue le morceau resté à cette même position dans musicPlaylist (ordre d'insertion)
    // au lieu de celui réellement affiché à cette ligne.
    const realIndex = musicPlaylist.findIndex(x => x.id === t.id);
    const isPlaying = currentTrackIndex === realIndex;
    const coverInner = t.coverBase64
      ? `<img src="${t.coverBase64}" alt="" />`
      : `<i class="fa-solid ${getMusicCover(realIndex).icon}"></i>`;
    const coverStyle = t.coverBase64 ? '' : ` style="background:${getMusicCover(realIndex).grad};color:#fff;"`;
    return `
      <div class="music-list-row-wrap">
        <div class="music-list-row-delete-bg"><i class="fa-solid fa-trash"></i></div>
        <div class="music-list-row${isPlaying?' playing':''}" data-id="${t.id}" data-name="${escHtml(t.name)}" onclick="playMyTrack('${t.id}')">
          <div class="music-list-index">${isPlaying ? '<i class="fa-solid fa-volume-high"></i>' : (i+1)}</div>
          <div class="music-list-cover"${coverStyle}>${coverInner}</div>
          <div class="music-list-info">
            <div class="music-list-title">${escHtml(t.name)}</div>
            <div class="music-list-artist">${escHtml(t.artist || 'Artiste inconnu')}</div>
          </div>
          <div class="music-list-like${t.liked?' liked':''}" onclick="event.stopPropagation();toggleTrackLike('${t.id}')">
            <i class="fa-${t.liked?'solid':'regular'} fa-heart"></i>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = rows;
  attachSwipeToDelete(container);
}

// Swipe horizontal sur une ligne : au-delà de 40% de sa largeur, on relâche -> confirmation
// de suppression. En dessous, la ligne revient à sa place (snap-back).
// ⚠️ N'attacher les écouteurs qu'une seule fois sur le conteneur (delegation) : le conteneur
// #my-music-list n'est jamais recréé, seul son innerHTML change à chaque rendu. Sans le flag
// ci-dessous, chaque appel à renderMusicList() (recherche, tri, lecture, ajout, suppression...)
// empilait un nouveau jeu d'écouteurs, provoquant plusieurs popups de suppression simultanés
// après quelques interactions.
function attachSwipeToDelete(container) {
  if (container.dataset.swipeBound === '1') return;
  container.dataset.swipeBound = '1';

  let dragging = null; // { row, startX, startY, width, currentX, locked }

  container.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.music-list-row');
    if (!row) return;
    const touch = e.touches[0];
    dragging = { row, startX: touch.clientX, startY: touch.clientY, width: row.offsetWidth, currentX: 0, locked: null };
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragging.startX;
    const dy = touch.clientY - dragging.startY;

    if (dragging.locked === null) {
      // On détermine si c'est un swipe horizontal ou un scroll vertical (une seule fois)
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragging.locked = Math.abs(dx) > Math.abs(dy);
      if (dragging.locked) dragging.row.classList.add('dragging');
    }
    if (!dragging.locked) return; // scroll vertical normal, on ne touche pas à la ligne

    e.preventDefault();
    const clamped = Math.min(0, Math.max(dx, -dragging.width)); // swipe vers la gauche uniquement
    dragging.currentX = clamped;
    dragging.row.style.transform = `translateX(${clamped}px)`;
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (!dragging) return;
    const { row, currentX, width } = dragging;
    row.classList.remove('dragging');
    const passedThreshold = Math.abs(currentX) >= width * 0.4;
    if (passedThreshold) {
      row.style.transform = `translateX(-${width}px)`;
      confirmDeleteTrack(row.dataset.id, row.dataset.name);
      // Si l'utilisateur annule, la ligne réapparaît au prochain rendu (renderMusicList
      // est appelé après annulation ou suppression, donc pas besoin de snap-back ici).
    } else {
      row.style.transform = 'translateX(0)';
    }
    dragging = null;
  });
}

// ── Recherche depuis la topbar (écran Musique uniquement) ──────────────────
window.toggleMusicSearchBar = () => {
  const bar = document.getElementById('music-topbar-search');
  const isOpen = bar.classList.contains('open');
  if (isOpen) { closeMusicSearchBar(); return; }
  bar.classList.add('open');
  requestAnimationFrame(() => document.getElementById('music-topbar-search-input')?.focus());
};

function closeMusicSearchBar() {
  const bar = document.getElementById('music-topbar-search');
  if (!bar) return;
  bar.classList.remove('open');
  musicSearchQuery = '';
  const input = document.getElementById('music-topbar-search-input');
  if (input) input.value = '';
  renderMusicList();
}
window.closeMusicSearchBar = closeMusicSearchBar;

window.onMusicSearchInput = (value) => {
  musicSearchQuery = value;
  renderMusicList();
};

window.toggleTrackLike = async (id) => {
  const track = musicPlaylist.find(t => t.id === id);
  if (!track) return;
  track.liked = !track.liked;
  await idbPut('musicTracks', track);
  renderMusicList();
};

window.confirmDeleteTrack = (id, name) => {
  document.getElementById('confirm-delete-popup')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'confirm-delete-popup';
  overlay.className = 'confirm-popup-overlay';
  overlay.innerHTML = `
    <div class="confirm-popup">
      <div class="confirm-popup-title">Supprimer « ${escHtml(name)} » ?</div>
      <div class="confirm-popup-actions">
        <button class="btn-secondary" style="flex:1;padding:10px;border-radius:10px;" onclick="document.getElementById('confirm-delete-popup').remove();renderMusicList();">Annuler</button>
        <button class="btn-danger" style="flex:1;padding:10px;border-radius:10px;" onclick="deleteMyTrack('${id}');document.getElementById('confirm-delete-popup').remove()">Supprimer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); renderMusicList(); } });
};

// Lit les métadonnées embarquées (ID3 pour mp3, tags MP4/iTunes pour m4a) via jsmediatags,
// chargée en local (lib/jsmediatags.min.js) — aucune connexion requise, ça marche offline.
// Renvoie { title, artist, coverBase64 } — chaque champ est null si absent du fichier.
function readTrackMetadata(file) {
  return new Promise((resolve) => {
    if (typeof jsmediatags === 'undefined') { resolve({ title: null, artist: null, coverBase64: null }); return; }
    new jsmediatags.Reader(file)
      .setTagsToRead(['title', 'artist', 'picture'])
      .read({
        onSuccess: (tag) => {
          const t = tag.tags || {};
          let coverBase64 = null;
          if (t.picture && t.picture.data && t.picture.format) {
            try {
              let binary = '';
              const data = t.picture.data;
              for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
              coverBase64 = `data:${t.picture.format};base64,${btoa(binary)}`;
            } catch(e) { coverBase64 = null; }
          }
          resolve({ title: t.title || null, artist: t.artist || null, coverBase64 });
        },
        onError: () => resolve({ title: null, artist: null, coverBase64: null })
      });
  });
}

window.handleMusicUpload = async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  showToast('⏳ Ajout des morceaux…');
  let added = 0;
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) { showToast(`⚠️ ${file.name} trop lourd (max 15 Mo)`); continue; }
    try {
      const base64 = await fileToBase64(file);
      const meta = await readTrackMetadata(file);
      const id = 'track-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
      await idbPut('musicTracks', {
        id, uid: currentUser.uid,
        name: meta.title || file.name.replace(/\.[^.]+$/, ''),
        artist: meta.artist || 'Artiste inconnu',
        coverBase64: meta.coverBase64 || null, // null = pas de pochette dans le fichier -> fallback généré à l'affichage
        liked: false,
        base64
      });
      added++;
    } catch(e) { console.error('Upload musique:', e); }
  }
  showToast(`✅ ${added} morceau${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} !`);
  event.target.value = '';
  const allTracks = await idbGetAll('musicTracks');
  musicPlaylist = allTracks.filter(t => t.uid === currentUser?.uid);
  renderMusicList();
};

window.deleteMyTrack = async (id) => {
  const wasPlaying = musicPlaylist[currentTrackIndex]?.id === id;
  await idbDelete('musicTracks', id);
  showToast('🗑️ Morceau supprimé');
  if (wasPlaying) stopMusicCompletely();
  const allTracks = await idbGetAll('musicTracks');
  musicPlaylist = allTracks.filter(t => t.uid === currentUser?.uid);
  renderMusicList();
};

window.playMyTrack = (id) => {
  const index = musicPlaylist.findIndex(t => t.id === id);
  if (index === -1) return;
  const t = musicPlaylist[index];
  currentTrackIndex = index;
  const player = getAudioPlayer();
  player.src = t.base64;
  setNowPlaying(t.name, t.artist || 'Artiste inconnu', index, t.coverBase64);
  player.play();
  renderMusicList();
};

function setNowPlaying(title, sub, coverIndex, coverBase64) {
  document.getElementById('topbar-music-icon').style.display = 'flex';
  setText('mini-player-title', title);
  updateMediaSessionMetadata(title, sub, coverIndex, coverBase64);

  paintCoverEl(document.getElementById('topbar-music-cover'), coverBase64, coverIndex);
  paintCoverEl(document.getElementById('music-bottom-cover'), coverBase64, coverIndex);
  setText('music-bottom-title', title);
  setText('music-bottom-sub', sub);

  const miniCover = document.getElementById('mini-player-cover');
  if (miniCover) {
    if (coverBase64) { miniCover.src = coverBase64; miniCover.style.display = 'block'; }
    else { miniCover.style.display = 'none'; miniCover.src = ''; }
  }

  // Reset visuel de la progression tant que la nouvelle durée n'est pas connue
  const ring = document.getElementById('topbar-music-ring-fill');
  if (ring) ring.style.strokeDashoffset = MUSIC_RING_CIRCUMFERENCE;
  const seek = document.getElementById('music-bottom-seek');
  if (seek) seek.value = 0;
  setText('music-bottom-elapsed', '0:00');
  setText('music-bottom-duration', '0:00');

  updateMusicBottomBarVisibility();
}

// La barre au-dessus du footbar n'apparaît que sur l'écran Musique, et seulement
// si un morceau est chargé.
function updateMusicBottomBarVisibility() {
  const bar = document.getElementById('music-bottom-bar');
  if (!bar) return;
  const onMusicScreen = document.getElementById('screen-music')?.classList.contains('active');
  const hasTrack = currentTrackIndex !== -1;
  bar.classList.toggle('show', !!(onMusicScreen && hasTrack));
  if (!onMusicScreen || !hasTrack) { bar.classList.remove('expanded'); clearTimeout(bottomBarCollapseTimer); }
}
window.updateMusicBottomBarVisibility = updateMusicBottomBarVisibility;

// Clic/interaction sur la barre du bas = elle s'agrandit (précédent, pause, suivant,
// stop, écouter plusieurs) puis se replie toute seule après 5s sans y toucher.
let bottomBarCollapseTimer = null;
window.musicBottomBarInteract = () => {
  const bar = document.getElementById('music-bottom-bar');
  if (!bar) return;
  bar.classList.add('expanded');
  clearTimeout(bottomBarCollapseTimer);
  bottomBarCollapseTimer = setTimeout(() => bar.classList.remove('expanded'), 5000);
};

// "Écouter plusieurs" : referme la barre et ramène sur la liste des morceaux pour en choisir un autre.
window.openMusicQueue = () => {
  document.getElementById('music-bottom-bar')?.classList.remove('expanded');
  clearTimeout(bottomBarCollapseTimer);
  document.getElementById('screen-music')?.scrollTo({ top: 0, behavior: 'smooth' });
  showToast?.('🎵 Choisis un autre morceau dans la liste');
};

// La ligne de progression est un vrai curseur : on peut avancer/reculer la musique en la faisant glisser.
document.addEventListener('input', e => {
  if (e.target.id !== 'music-bottom-seek') return;
  const player = getAudioPlayer();
  if (player.duration && isFinite(player.duration)) {
    player.currentTime = (e.target.value / 100) * player.duration;
  }
  musicBottomBarInteract();
});

let miniPlayerTimer = null;
window.toggleMiniPlayer = () => {
  const drop = document.getElementById('mini-player-drop');
  const isOpen = drop.classList.contains('open');
  if (isOpen) { drop.classList.remove('open'); clearTimeout(miniPlayerTimer); return; }
  drop.classList.add('open');
  document.getElementById('topbar-music-icon').classList.add('active');
  resetMiniPlayerAutoClose();
};

function resetMiniPlayerAutoClose() {
  clearTimeout(miniPlayerTimer);
  miniPlayerTimer = setTimeout(() => {
    document.getElementById('mini-player-drop').classList.remove('open');
    document.getElementById('topbar-music-icon').classList.remove('active');
  }, 2500);
}

// Touch/click sur le mini-lecteur = on relance le délai de 2.5s avant fermeture
document.addEventListener('click', e => {
  const drop = document.getElementById('mini-player-drop');
  if (drop && drop.contains(e.target)) resetMiniPlayerAutoClose();
});

// Clic en dehors de la barre de recherche musique (et de son icône) = on la referme.
document.addEventListener('click', e => {
  const bar = document.getElementById('music-topbar-search');
  const icon = document.getElementById('topbar-music-search-icon');
  if (!bar || !bar.classList.contains('open')) return;
  if (bar.contains(e.target) || (icon && icon.contains(e.target))) return;
  closeMusicSearchBar();
});

window.musicTogglePlay = () => {
  const player = getAudioPlayer();
  if (!player.src) { showToast('🎵 Choisis un morceau d\'abord'); return; }
  if (player.paused) player.play(); else player.pause();
};

function updatePlayButton(playing) {
  const miniBtn = document.getElementById('mini-play-btn');
  const bottomBtn = document.getElementById('music-bottom-play-btn');
  const expandBtn = document.getElementById('music-bottom-expand-play-btn');
  const icon = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  if (miniBtn) miniBtn.innerHTML = icon;
  if (bottomBtn) bottomBtn.innerHTML = icon;
  if (expandBtn) expandBtn.innerHTML = icon;
}

window.musicNext = () => {
  if (musicPlaylist.length === 0) return;
  const nextIndex = (currentTrackIndex + 1) % musicPlaylist.length;
  playMyTrack(musicPlaylist[nextIndex].id);
};

window.musicPrev = () => {
  if (musicPlaylist.length === 0) return;
  const prevIndex = (currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length;
  playMyTrack(musicPlaylist[prevIndex].id);
};

window.musicToggleLoop = () => {
  isLooping = !isLooping;
  getAudioPlayer().loop = isLooping;
  document.getElementById('mini-loop-btn')?.classList.toggle('active', isLooping);
};

const MUSIC_RING_CIRCUMFERENCE = 94.2477; // 2 * π * 15 (r du cercle SVG topbar)

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateSeekBar() {
  const player = audioPlayer;
  if (!player || !player.duration) return;
  const pct = (player.currentTime / player.duration) * 100;

  const ring = document.getElementById('topbar-music-ring-fill');
  if (ring) ring.style.strokeDashoffset = MUSIC_RING_CIRCUMFERENCE * (1 - pct / 100);

  const seek = document.getElementById('music-bottom-seek');
  if (seek && document.activeElement !== seek) seek.value = pct;
  setText('music-bottom-elapsed', formatTime(player.currentTime));
  setText('music-bottom-duration', formatTime(player.duration));
}

// ── Purge automatique des tâches supprimées depuis plus de 3 jours ──
// ✅ CORRECTION : deletedAt est un nombre (ms, via nowMs() dans sync.js), pas un
// Timestamp Firestore — .toMillis?.() renvoyait donc toujours undefined ici,
// donc la condition `if (!deletedAtMs) return false` excluait TOUJOURS la tâche
// et la purge ne supprimait jamais rien. Appelée nulle part avant non plus.
let purgeInProgress = false;
async function purgeOldDeletedTasks() {
  if (purgeInProgress) return;
  purgeInProgress = true;
  try {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const allLocalTasks = await idbGetAll('tasks');
    const toDelete = allLocalTasks.filter(t => {
      if (!t.deleted) return false;
      const deletedAtMs = t.deletedAt || 0;
      if (!deletedAtMs) return false;
      return (now - deletedAtMs) >= THREE_DAYS_MS;
    });
    for (const t of toDelete) {
      await idbDelete('tasks', t.id).catch(() => {});
    }
    if (toDelete.length > 0) await reloadFromIDB();
  } finally {
    purgeInProgress = false;
  }
}
window.purgeOldDeletedTasks = purgeOldDeletedTasks;
