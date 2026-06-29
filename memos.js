
let editingMemoId = null;
let memoSaveDebounce = null;

window.goToMemos = () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-memos').classList.add('active');
  document.getElementById('fab-add').style.display = 'none';
  document.getElementById('topbar-title').textContent = '📝 Mémos';
  showMemosListView();
};

function showMemosListView() {
  document.getElementById('memos-list-view').style.display = 'block';
  document.getElementById('memo-editor-view').style.display = 'none';
  renderMemosList();
}

function renderMemosList() {
  const el = document.getElementById('memos-list');
  if (!el) return;
  const visible = memos.filter(m => m.status !== 'deleted');
  if (visible.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-note-sticky"></i></div><div class="empty-title">Aucun mémo</div><div class="empty-sub">Appuie sur + pour écrire ton premier mémo</div></div>`;
    return;
  }
  el.innerHTML = visible.map(memoCardHTML).join('');
  attachMemoSwipeHandlers();
}

function memoCardHTML(m) {
  const lines = (m.text || '').split('\n').filter(Boolean);
  const title = lines[0] || 'Sans titre';
  const preview = lines.slice(1).join(' ') || (m.audioId ? 'Enregistrement vocal' : '');
  const dateLabel = m.updatedAtMs ? new Date(m.updatedAtMs).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : '';
  return `
  <div class="memo-card-wrap" data-memo-id="${m.id}">
    <div class="memo-card-delete-bg"><i class="fa-solid fa-trash"></i></div>
    <div class="memo-card fade-in" onclick="openMemoEditor('${m.id}')">
      <div class="memo-card-title">${escHtml(title)}</div>
      ${preview ? `<div class="memo-card-preview">${escHtml(preview)}</div>` : ''}
      <div class="memo-card-meta">
        <span>${dateLabel}</span>
        ${m.audioId ? `<span><i class="fa-solid fa-microphone"></i></span>` : ''}
      </div>
    </div>
  </div>`;
}

// ── Swipe pour supprimer (façon iPhone Mail) ──
// Seuil de 40% de la largeur de la carte : au-delà, relâcher supprime directement.
let memoSwipe = null;
let memoSwipeBlockClick = false;

function attachMemoSwipeHandlers() {
  const list = document.getElementById('memos-list');
  if (!list || list.dataset.swipeBound) return;
  list.dataset.swipeBound = '1';
  list.addEventListener('touchstart', onMemoSwipeStart, { passive: true });
  list.addEventListener('touchmove', onMemoSwipeMove, { passive: false });
  list.addEventListener('touchend', onMemoSwipeEnd);
  list.addEventListener('touchcancel', onMemoSwipeEnd);
  // Empêche l'ouverture de l'éditeur si le tap qui suit faisait en réalité partie d'un swipe
  list.addEventListener('click', e => {
    if (memoSwipeBlockClick) { e.preventDefault(); e.stopPropagation(); memoSwipeBlockClick = false; }
  }, true);
}

function onMemoSwipeStart(e) {
  const wrap = e.target.closest('.memo-card-wrap');
  if (!wrap) return;
  memoSwipe = {
    wrap, card: wrap.querySelector('.memo-card'),
    startX: e.touches[0].clientX, startY: e.touches[0].clientY,
    width: wrap.offsetWidth, dragging: false,
  };
}

function onMemoSwipeMove(e) {
  if (!memoSwipe) return;
  const dx = e.touches[0].clientX - memoSwipe.startX;
  const dy = e.touches[0].clientY - memoSwipe.startY;
  if (!memoSwipe.dragging) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) <= Math.abs(dy)) { memoSwipe = null; return; } // scroll vertical, pas un swipe
    memoSwipe.dragging = true;
    memoSwipeBlockClick = true;
  }
  if (dx > 0) { resetMemoSwipe(); return; } // on ignore le swipe vers la droite
  e.preventDefault();
  const clamped = Math.max(dx, -memoSwipe.width);
  memoSwipe.card.style.transition = 'none';
  memoSwipe.card.style.transform = `translateX(${clamped}px)`;
}

function onMemoSwipeEnd() {
  if (!memoSwipe || !memoSwipe.dragging) { memoSwipe = null; return; }
  const { wrap, card, width } = memoSwipe;
  const style = card.style.transform.match(/-?\d+(\.\d+)?/);
  const currentX = style ? parseFloat(style[0]) : 0;
  const ratio = Math.abs(currentX) / width;
  card.style.transition = 'transform 0.2s ease';
  if (ratio >= 0.4) {
    card.style.transform = `translateX(-${width}px)`;
    const memoId = wrap.dataset.memoId;
    setTimeout(() => deleteMemoFromSwipe(memoId), 180);
  } else {
    card.style.transform = 'translateX(0)';
  }
  memoSwipe = null;
}

function resetMemoSwipe() {
  if (!memoSwipe) return;
  memoSwipe.card.style.transition = 'transform 0.2s ease';
  memoSwipe.card.style.transform = 'translateX(0)';
  memoSwipe = null;
}

async function deleteMemoFromSwipe(memoId) {
  // Récupérer l'audioId avant de supprimer le document pour pouvoir nettoyer le blob
  const memo = memos.find(m => m.id === memoId);
  if (memo?.audioId) {
    await idbDelete('memos', `_audio_${memo.audioId}`).catch(() => {});
  }
  await deleteDoc(doc(db, 'memos', memoId))
    .catch(e => console.warn('deleteMemoFromSwipe:', e));
  showToast('🗑️ Mémo supprimé');
}

// ── Édition ──────────────────────────────────────────────────
window.openMemoEditor = (id = null) => {
  editingMemoId = id;
  const textarea = document.getElementById('memo-textarea');
  const deleteBtn = document.getElementById('memo-delete-btn');
  document.getElementById('memos-list-view').style.display = 'none';
  document.getElementById('memo-editor-view').style.display = 'block';
  document.getElementById('memo-audio-player').style.display = 'none';
  document.getElementById('memo-recording-indicator').style.display = 'none';

  if (id) {
    const m = memos.find(x => x.id === id);
    textarea.value = m?.text || '';
    deleteBtn.style.display = 'block';
    if (m?.audioId) loadMemoAudioPlayer(m.audioId);
  } else {
    textarea.value = '';
    deleteBtn.style.display = 'none';
  }
  setTimeout(() => textarea.focus(), 100);
};

window.closeMemoEditor = () => {
  // Arrête un éventuel enregistrement en cours avant de quitter
  if (memoRecorder && memoRecorder.state === 'recording') stopMemoRecording();
  showMemosListView();
};


window.autoSaveMemo = () => {
  clearTimeout(memoSaveDebounce);
  memoSaveDebounce = setTimeout(saveMemoNow, 600);
};

async function saveMemoNow() {
  const text = document.getElementById('memo-textarea').value;
  if (!text.trim() && !editingMemoId) return; // rien à sauvegarder pour un mémo vide jamais créé

  const data = {
    text,
    uid: currentUser.uid,
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (editingMemoId) {
    await updateDoc(doc(db, 'memos', editingMemoId), data).catch(e => console.warn('saveMemoNow update:', e));
  } else {
    data.status = 'active';
    data.timestamp = serverTimestamp();
    const ref = await addDoc(collection(db, 'memos'), data).catch(e => console.warn('saveMemoNow create:', e));
    if (ref) editingMemoId = ref.id; // les sauvegardes suivantes mettront à jour ce même mémo
  }
}

window.confirmDeleteMemo = async () => {
  if (!editingMemoId) return;
  if (!confirm('Supprimer ce mémo ?')) return;
  // Nettoyer le blob audio en IndexedDB avant de supprimer le document
  if (currentMemoAudioId) {
    await idbDelete('memos', `_audio_${currentMemoAudioId}`).catch(() => {});
  }
  await deleteDoc(doc(db, 'memos', editingMemoId))
    .catch(e => console.warn('confirmDeleteMemo:', e));
  showMemosListView();
  showToast('🗑️ Mémo supprimé');
};

let memoRecorder = null;
let memoRecordedChunks = [];
let memoRecordingStartTime = null;
let memoRecordingTimerInterval = null;
let memoAudioPlayer = null;
let currentMemoAudioId = null;

window.toggleMemoRecording = async () => {
  if (memoRecorder && memoRecorder.state === 'recording') {
    stopMemoRecording();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Important : on laisse le navigateur choisir son format par défaut plutôt que d'en
    // imposer un. Safari iOS n'enregistre JAMAIS en webm (contrairement à Chrome) — si on
    // force ce type sur le Blob final, l'enregistrement existe mais est illisible (silence
    // total à la lecture, sans erreur visible). On lit donc le type réellement utilisé.
    memoRecorder = new MediaRecorder(stream);
    const recorderMimeType = memoRecorder.mimeType || 'audio/mp4';
    memoRecordedChunks = [];
    memoRecorder.ondataavailable = e => { if (e.data.size > 0) memoRecordedChunks.push(e.data); };
    memoRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(memoRecordedChunks, { type: recorderMimeType });
      await saveMemoAudioBlob(blob);
    };
    memoRecorder.start();
    memoRecordingStartTime = Date.now();
    document.getElementById('memo-recording-indicator').style.display = 'flex';
    document.getElementById('memo-mic-btn').classList.add('active');
    memoRecordingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - memoRecordingStartTime) / 1000);
      setText('memo-recording-time', formatTime(elapsed));
    }, 1000);
  } catch (e) {
    showToast('⚠️ Micro inaccessible — vérifie les autorisations');
  }
};

function stopMemoRecording() {
  if (memoRecorder && memoRecorder.state === 'recording') memoRecorder.stop();
  clearInterval(memoRecordingTimerInterval);
  document.getElementById('memo-recording-indicator').style.display = 'none';
  document.getElementById('memo-mic-btn').classList.remove('active');
}

async function saveMemoAudioBlob(blob) {
  const audioId = currentMemoAudioId || `memo-audio-${Date.now()}`;
  // Le blob est stocké tel quel en IndexedDB (pas besoin de base64 ici,
  // IndexedDB gère nativement les Blob — plus léger que pour la musique).
  await idbPut('memos', { id: `_audio_${audioId}`, blob, isAudioRecord: true }).catch(() => {});
  currentMemoAudioId = audioId;

  if (editingMemoId) {
    await updateDoc(doc(db, 'memos', editingMemoId), { audioId, updatedAt: serverTimestamp() }).catch(() => {});
  } else {
    // Le mémo n'existe pas encore en base (texte jamais sauvegardé) : on le crée maintenant
    await saveMemoNow();
    if (editingMemoId) await updateDoc(doc(db, 'memos', editingMemoId), { audioId }).catch(() => {});
  }
  loadMemoAudioPlayer(audioId);
  showToast('🎙️ Enregistrement ajouté');
}

async function loadMemoAudioPlayer(audioId) {
  currentMemoAudioId = audioId;
  const record = await idbGet('memos', `_audio_${audioId}`).catch(() => null);
  if (!record || !record.blob) { document.getElementById('memo-audio-player').style.display = 'none'; return; }

  const url = URL.createObjectURL(record.blob);
  memoAudioPlayer = new Audio(url);
  document.getElementById('memo-audio-player').style.display = 'flex';

  memoAudioPlayer.addEventListener('loadedmetadata', () => {
    setText('memo-audio-duration', formatTime(Math.floor(memoAudioPlayer.duration)));
  });
  memoAudioPlayer.addEventListener('timeupdate', () => {
    const seek = document.getElementById('memo-audio-seek');
    if (memoAudioPlayer.duration) seek.value = (memoAudioPlayer.currentTime / memoAudioPlayer.duration) * 100;
  });
  memoAudioPlayer.addEventListener('ended', () => {
    document.getElementById('memo-audio-play-btn').innerHTML = '<i class="fa-solid fa-play"></i>';
  });
}

window.toggleMemoAudioPlayback = () => {
  if (!memoAudioPlayer) return;
  const btn = document.getElementById('memo-audio-play-btn');
  if (memoAudioPlayer.paused) {
    memoAudioPlayer.play();
    btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    memoAudioPlayer.pause();
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
};

window.deleteMemoAudio = async () => {
  if (!confirm('Supprimer l\'enregistrement audio ?')) return;
  if (memoAudioPlayer) { memoAudioPlayer.pause(); memoAudioPlayer = null; }
  if (currentMemoAudioId) await idbDelete('memos', `_audio_${currentMemoAudioId}`).catch(() => {});
  if (editingMemoId) await updateDoc(doc(db, 'memos', editingMemoId), { audioId: null, updatedAt: serverTimestamp() }).catch(() => {});
  document.getElementById('memo-audio-player').style.display = 'none';
  currentMemoAudioId = null;
  showToast('🗑️ Audio supprimé');
};

document.addEventListener('input', e => {
  if (e.target.id === 'memo-audio-seek' && memoAudioPlayer?.duration) {
    memoAudioPlayer.currentTime = (e.target.value / 100) * memoAudioPlayer.duration;
  }
});
