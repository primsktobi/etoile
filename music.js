let ambientCategories = {};
let ambientFlatList = []; 
let openCategory = null; 

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

  // Reproduit le dégradé CSS (135deg, 2 couleurs) dans le canvas
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

let musicPlaylist = []; // morceaux perso { id, name, base64 }
let currentTrackIndex = -1;
let currentTrackSource = null; // 'mine' | 'ambient'
let isLooping = false;

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

function updateMediaSessionMetadata(title, artist, coverIndex) {
  if (!('mediaSession' in navigator)) return;
  const artworkSrc = coverIndex != null ? getMusicCoverDataURL(coverIndex) : 'icons/icon-512-v2.png';
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

// Arrête complètement la musique en cours et masque l'icône topbar + mini-lecteur
function stopMusicCompletely() {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.src = '';
  }
  currentTrackIndex = -1;
  currentTrackSource = null;
  document.getElementById('music-now-playing').style.display = 'none';
  document.getElementById('topbar-music-icon').style.display = 'none';
  document.getElementById('mini-player-drop').classList.remove('open');
  document.getElementById('topbar-music-icon').classList.remove('active');
  clearTimeout(miniPlayerTimer);
  clearMusicSessionTimer();
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  renderMyMusicList?.();
  renderAmbientList?.();
  renderMusicFolders?.();
}
window.stopMusicCompletely = stopMusicCompletely;

// ── Minuteur de session musique : arrête automatiquement après X minutes ──
let musicSessionTimer = null;
let musicSessionEndAt = null;
let musicSessionTickInterval = null;

window.setMusicSessionTimer = (minutes, btnEl) => {
  clearMusicSessionTimer();
  document.querySelectorAll('.music-timer-opt').forEach(b => b.classList.remove('active'));
  if (minutes === 0) {
    document.getElementById('music-timer-active').style.display = 'none';
    return;
  }
  if (btnEl) btnEl.classList.add('active');
  musicSessionEndAt = Date.now() + minutes * 60 * 1000;
  document.getElementById('music-timer-active').style.display = 'flex';
  showToast(`⏱️ Arrêt auto programmé dans ${minutes} min`);

  musicSessionTickInterval = setInterval(() => {
    const remaining = Math.max(0, musicSessionEndAt - Date.now());
    setText('music-timer-countdown', formatTime(Math.floor(remaining / 1000)));
    if (remaining <= 0) {
      clearMusicSessionTimer();
      stopMusicCompletely();
      showToast('⏱️ Musique arrêtée (minuteur terminé)');
    }
  }, 1000);
};

function clearMusicSessionTimer() {
  clearTimeout(musicSessionTimer);
  clearInterval(musicSessionTickInterval);
  musicSessionTimer = null;
  musicSessionTickInterval = null;
  musicSessionEndAt = null;
  const opts = document.querySelectorAll('.music-timer-opt');
  opts.forEach(b => b.classList.remove('active'));
  const activeEl = document.getElementById('music-timer-active');
  if (activeEl) activeEl.style.display = 'none';
}

// ── Mode Bibliothèque silencieuse : ambiance + minuteur combinés ──
window.toggleLibraryMode = async () => {
  const toggle = document.getElementById('library-mode-toggle');
  const isOn = toggle.classList.contains('on');
  if (isOn) {
    toggle.classList.remove('on');
    showToast('📚 Mode Bibliothèque désactivé');
    return;
  }
  toggle.classList.add('on');
  showToast('📚 Mode Bibliothèque activé — ambiance + 30min');
  // Lance automatiquement un son d'ambiance calme + minuteur 30 min
  await loadAmbientManifest();
  const calmTrack = ambientFlatList.find(t => t.category === 'calme') || ambientFlatList[0];
  if (calmTrack) {
    const idx = ambientFlatList.indexOf(calmTrack);
    playAmbientTrack(idx);
  }
  setMusicSessionTimer(30);
};

async function loadAmbientManifest() {
  try {
    const res = await fetch('sounds/sounds-manifest.json');
    const data = await res.json();
    ambientCategories = data;
    ambientFlatList = [];
    Object.entries(data).forEach(([key, cat]) => {
      if (key.startsWith('_')) return;
      (cat.files || []).forEach(filename => {
        ambientFlatList.push({ category: key, label: cat.label, icon: cat.icon, filename, url: `sounds/${key}/${filename}` });
      });
    });
  } catch (e) {
    console.warn('Manifest sons d\'ambiance introuvable ou invalide:', e);
    ambientCategories = {};
    ambientFlatList = [];
  }
}

async function loadMusicScreen() {
  const allTracks = await idbGetAll('musicTracks');
  musicPlaylist = allTracks.filter(t => t.uid === currentUser?.uid);
  await loadAmbientManifest();
  renderMusicFolders();

  // Sur iPhone/iPad, le slider de volume n'a aucun effet réel (restriction système
  // Apple) — on le masque et on affiche une note explicative à la place.
  const volRow = document.getElementById('music-volume-row');
  const iosNote = document.getElementById('music-volume-ios-note');
  if (volRow && iosNote) {
    volRow.style.display = isIOS ? 'none' : 'flex';
    iosNote.style.display = isIOS ? 'flex' : 'none';
  }

  const vol = document.getElementById('music-volume');
  if (vol) paintVolumeBar(vol, vol.value);
  const seek = document.getElementById('music-seek');
  if (seek) paintProgressBar(seek, seek.value);
}

function renderMusicFolders() {
  const myEl = document.getElementById('my-music-list');
  const ambEl = document.getElementById('ambient-music-list');
  if (!myEl || !ambEl) return;

  if (openCategory) {
    // Vue dossier ouvert : un seul conteneur avec bouton retour + grid
    myEl.style.display = 'block';
    ambEl.style.display = 'none';
    renderOpenFolderGrid(myEl, openCategory);
    return;
  }

  myEl.style.display = 'block';
  ambEl.style.display = 'block';

  // Dossier "Ma playlist"
  myEl.innerHTML = folderTileHTML('ma-playlist', 'Ma playlist', 'fa-list-music', musicPlaylist.length);

  // Dossiers d'ambiance
  const categoryKeys = Object.keys(ambientCategories).filter(k => !k.startsWith('_'));
  const nonEmpty = categoryKeys.filter(k => (ambientCategories[k].files || []).length > 0);
  ambEl.innerHTML = nonEmpty.map(key => {
    const cat = ambientCategories[key];
    const count = ambientFlatList.filter(t => t.category === key).length;
    return folderTileHTML(key, cat.label, cat.icon || 'fa-music', count);
  }).join('');
}

function folderTileHTML(key, label, icon, count) {
  return `
    <div class="music-category-header" onclick="toggleMusicCategory('${key}')" style="margin-bottom:8px;">
      <div class="music-track-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="music-track-name">${escHtml(label)} <span style="color:var(--text3);font-weight:400;">(${count})</span></div>
      <i class="fa-solid fa-chevron-right" style="color:var(--text3);font-size:12px;"></i>
    </div>`;
}

function renderOpenFolderGrid(container, key) {
  const isPlaylist = key === 'ma-playlist';
  const label = isPlaylist ? 'Ma playlist' : (ambientCategories[key]?.label || key);
  const items = isPlaylist ? musicPlaylist : ambientFlatList.filter(t => t.category === key);

  const backBtn = `<div class="music-back-btn" onclick="toggleMusicCategory(null)"><i class="fa-solid fa-arrow-left"></i> ${escHtml(label)}</div>`;

  if (items.length === 0) {
    container.innerHTML = backBtn + `<div style="color:var(--text3);font-size:13px;padding:8px 0;">Aucun morceau dans ce dossier</div>`;
    return;
  }

  const gridItems = items.map((t, i) => {
    if (isPlaylist) {
      const isPlaying = currentTrackSource === 'mine' && currentTrackIndex === i;
      const name = t.name;
      return musicGridItemHTML(name, isPlaying, `playMyTrack(${i})`, `confirmDeleteTrack('${t.id}', '${escHtml(name)}')`, i);
    } else {
      const flatIndex = ambientFlatList.indexOf(t);
      const isPlaying = currentTrackSource === 'ambient' && currentTrackIndex === flatIndex;
      const name = t.filename.replace(/\.[^.]+$/, '');
      return musicGridItemHTML(name, isPlaying, `playAmbientTrack(${flatIndex})`, null, flatIndex);
    }
  }).join('');

  container.innerHTML = backBtn + `<div class="music-grid">${gridItems}</div>`;
}

function musicGridItemHTML(name, isPlaying, onClickPlay, onDblClickDelete, coverIndex) {
  const dblClick = onDblClickDelete ? `ondblclick="event.stopPropagation();${onDblClickDelete}"` : '';
  const cover = getMusicCover(coverIndex);
  return `
    <div class="music-grid-item" onclick="${onClickPlay}" ${dblClick}>
      <div class="music-grid-rect" style="background:${cover.grad};${isPlaying?'outline:2px solid var(--blue);':''}"><i class="fa-solid ${isPlaying ? 'fa-volume-high' : cover.icon}"></i></div>
      <div class="music-grid-name">${escHtml(name)}</div>
    </div>`;
}

window.toggleMusicCategory = (key) => {
  openCategory = key; // null pour revenir à la liste des dossiers, sinon la clé du dossier ouvert
  renderMusicFolders();
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
        <button class="btn-secondary" style="flex:1;padding:10px;border-radius:10px;" onclick="document.getElementById('confirm-delete-popup').remove()">Annuler</button>
        <button class="btn-danger" style="flex:1;padding:10px;border-radius:10px;" onclick="deleteMyTrack('${id}');document.getElementById('confirm-delete-popup').remove()">Supprimer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};

window.handleMusicUpload = async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  showToast('⏳ Ajout des morceaux…');
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) { showToast(`⚠️ ${file.name} trop lourd (max 15 Mo)`); continue; }
    try {
      const base64 = await fileToBase64(file);
      const id = 'track-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
      await idbPut('musicTracks', { id, uid: currentUser.uid, name: file.name.replace(/\.[^.]+$/, ''), base64 });
    } catch(e) { console.error('Upload musique:', e); }
  }
  showToast(' Morceaux ajoutés !');
  event.target.value = '';
  await loadMusicScreen();
};

window.deleteMyTrack = async (id) => {
  await idbDelete('musicTracks', id);
  showToast(' Morceau supprimé');
  await loadMusicScreen();
};

window.playMyTrack = (index) => {
  const t = musicPlaylist[index];
  if (!t) return;
  currentTrackIndex = index;
  currentTrackSource = 'mine';
  const player = getAudioPlayer();
  player.src = t.base64;
  setNowPlaying(t.name, 'Mon morceau', index);
  player.play();
  renderMyMusicList();
  renderAmbientList();
};

window.playAmbientTrack = (index) => {
  const t = ambientFlatList[index];
  if (!t) return;
  currentTrackIndex = index;
  currentTrackSource = 'ambient';
  const player = getAudioPlayer();
  player.src = t.url;
  setNowPlaying(t.filename.replace(/\.[^.]+$/, ''), t.label, index);
  player.play().catch(() => showToast('⚠️ Impossible de lire ce son'));
  renderMyMusicList();
  renderAmbientList();
};

function setNowPlaying(title, sub, coverIndex) {
  setText('music-current-title', title);
  setText('music-current-sub', sub);
  document.getElementById('music-now-playing').style.display = 'block';
  document.getElementById('topbar-music-icon').style.display = 'flex';
  setText('mini-player-title', title);
  updateMediaSessionMetadata(title, sub, coverIndex);

  // Affiche la pochette (dégradé + icône) à la place du disque générique,
  // pour que "chaque musique ait son image" visible aussi dans l'app.
  const disc = document.getElementById('music-disc');
  if (disc && coverIndex != null) {
    const cover = getMusicCover(coverIndex);
    disc.style.background = cover.grad;
    disc.innerHTML = `<i class="fa-solid ${cover.icon}"></i>`;
  }
}

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

window.musicTogglePlay = () => {
  const player = getAudioPlayer();
  if (!player.src) { showToast('🎵 Choisis un morceau d\'abord'); return; }
  if (player.paused) player.play(); else player.pause();
};

function updatePlayButton(playing) {
  const btn = document.getElementById('music-play-btn');
  const disc = document.getElementById('music-disc');
  const miniBtn = document.getElementById('mini-play-btn');
  const viz = document.getElementById('music-visualizer');
  if (btn) btn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  if (miniBtn) miniBtn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  if (disc) disc.classList.toggle('spinning', playing);
  if (viz) viz.classList.toggle('playing', playing);
}

window.musicNext = () => {
  if (currentTrackSource === 'mine' && musicPlaylist.length > 0) {
    playMyTrack((currentTrackIndex + 1) % musicPlaylist.length);
  } else if (currentTrackSource === 'ambient' && ambientFlatList.length > 0) {
    playAmbientTrack((currentTrackIndex + 1) % ambientFlatList.length);
  }
};

window.musicPrev = () => {
  if (currentTrackSource === 'mine' && musicPlaylist.length > 0) {
    playMyTrack((currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length);
  } else if (currentTrackSource === 'ambient' && ambientFlatList.length > 0) {
    playAmbientTrack((currentTrackIndex - 1 + ambientFlatList.length) % ambientFlatList.length);
  }
};

window.musicToggleLoop = () => {
  isLooping = !isLooping;
  getAudioPlayer().loop = isLooping;
  document.getElementById('music-loop-btn')?.classList.toggle('active', isLooping);
  document.getElementById('mini-loop-btn')?.classList.toggle('active', isLooping);
};

function updateSeekBar() {
  const player = audioPlayer;
  if (!player || !player.duration) return;
  const seek = document.getElementById('music-seek');
  const pct = (player.currentTime / player.duration) * 100;
  if (seek && !seek._dragging) {
    seek.value = pct;
    paintProgressBar(seek, pct);
  }
  setText('music-time-elapsed', formatTime(player.currentTime));
  setText('music-time-remaining', '-' + formatTime(player.duration - player.currentTime));
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Barre de progression : remplissage blanc qui avance, reste en gris
function paintProgressBar(el, pct) {
  el.style.background = `linear-gradient(to right, #fff 0%, #fff ${pct}%, var(--bg3) ${pct}%, var(--bg3) 100%)`;
}

// Barre de volume : couleur UNIFORME du début jusqu'au curseur, selon le niveau (bleu bas → rouge haut)
function paintVolumeBar(el, pct) {
  const t = pct / 100;
  const r = Math.round(0x25 + (0xef - 0x25) * t);
  const g = Math.round(0x63 + (0x44 - 0x63) * t);
  const b = Math.round(0xeb + (0x44 - 0xeb) * t);
  const color = `rgb(${r},${g},${b})`;
  el.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--bg3) ${pct}%, var(--bg3) 100%)`;

  const icon = document.getElementById('music-volume-icon');
  if (icon) {
    icon.style.color = color;
    icon.className = 'fa-solid ' + (pct === 0 ? 'fa-volume-xmark' : pct < 50 ? 'fa-volume-low' : 'fa-volume-high');
  }
}

document.addEventListener('input', e => {
  if (e.target.id === 'music-seek') {
    e.target._dragging = true;
    const player = getAudioPlayer();
    if (player.duration) player.currentTime = (e.target.value / 100) * player.duration;
    paintProgressBar(e.target, e.target.value);
  }
  if (e.target.id === 'music-volume') {
    getAudioPlayer().volume = e.target.value / 100;
    paintVolumeBar(e.target, e.target.value);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'music-seek') e.target._dragging = false;
});

// Initialiser l'apparence de la barre de volume au chargement (valeur par défaut 70)
document.addEventListener('DOMContentLoaded', () => {
  const vol = document.getElementById('music-volume');
  if (vol) paintVolumeBar(vol, vol.value);
});

// ── Purge automatique des tâches supprimées depuis plus de 3 jours ──
let purgeInProgress = false;
async function purgeOldDeletedTasks() {
  if (purgeInProgress) return;
  purgeInProgress = true;
  try {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const toDelete = tasks.filter(t => {
      if (t.status !== 'deleted') return false;
      const deletedAtMs = t.deletedAt?.toMillis?.() || t.updatedAt?.toMillis?.() || 0;
      if (!deletedAtMs) return false;
      return (now - deletedAtMs) >= THREE_DAYS_MS;
    });
    for (const t of toDelete) {
      await deleteDoc(doc(db, 'tasks', t.id)).catch(() => {});
      await idbDelete('tasks', t.id).catch(() => {});
    }
  } finally {
    purgeInProgress = false;
  }
}

