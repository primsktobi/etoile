function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.changeAvatar = () => {
  const input = document.createElement('input');
  input.type='file'; input.accept='image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast('⚠️ Image trop lourde (max 8 Mo)'); return; }
    openCropModal(file);
  };
  input.click();
};

let cropImage = null;
let cropCanvas = null;
let cropCtx = null;
let cropZoom = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropDragStart = { x: 0, y: 0 };
let cropPinchStartDist = null;
let cropPinchStartZoom = 1;
const CROP_SIZE = 280; // doit correspondre à .crop-canvas-wrap en CSS

function openCropModal(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      cropImage = img;
      cropZoom = 1;
      cropOffsetX = 0;
      cropOffsetY = 0;
      document.getElementById('crop-zoom-slider').value = 100;
      setupCropCanvas();
      document.getElementById('crop-modal').classList.add('open');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function setupCropCanvas() {
  cropCanvas = document.getElementById('crop-canvas');
  cropCanvas.width = CROP_SIZE;
  cropCanvas.height = CROP_SIZE;
  cropCtx = cropCanvas.getContext('2d');
  drawCropCanvas();

  const wrap = document.getElementById('crop-canvas-wrap');
  // On retire d'éventuels anciens listeners (si l'utilisateur rouvre le modal)
  wrap.onmousedown = null; wrap.ontouchstart = null;

  wrap.addEventListener('mousedown', startCropDrag);
  window.addEventListener('mousemove', moveCropDrag);
  window.addEventListener('mouseup', endCropDrag);

  wrap.addEventListener('touchstart', startCropDragTouch, { passive: false });
  wrap.addEventListener('touchmove', moveCropDragTouch, { passive: false });
  wrap.addEventListener('touchend', endCropDrag);
}

function drawCropCanvas() {
  if (!cropImage || !cropCtx) return;
  cropCtx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

  const imgRatio = cropImage.width / cropImage.height;
  let baseW, baseH;
  if (imgRatio > 1) { baseH = CROP_SIZE; baseW = CROP_SIZE * imgRatio; }
  else { baseW = CROP_SIZE; baseH = CROP_SIZE / imgRatio; }

  const w = baseW * cropZoom;
  const h = baseH * cropZoom;
  const x = (CROP_SIZE - w) / 2 + cropOffsetX;
  const y = (CROP_SIZE - h) / 2 + cropOffsetY;

  cropCtx.drawImage(cropImage, x, y, w, h);
}

function clampCropOffsets() {
  // Empêche de déplacer l'image hors du cadre visible (évite les zones vides)
  const imgRatio = cropImage.width / cropImage.height;
  let baseW, baseH;
  if (imgRatio > 1) { baseH = CROP_SIZE; baseW = CROP_SIZE * imgRatio; }
  else { baseW = CROP_SIZE; baseH = CROP_SIZE / imgRatio; }
  const w = baseW * cropZoom;
  const h = baseH * cropZoom;
  const maxOffsetX = Math.max(0, (w - CROP_SIZE) / 2);
  const maxOffsetY = Math.max(0, (h - CROP_SIZE) / 2);
  cropOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, cropOffsetX));
  cropOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, cropOffsetY));
}

window.updateCropZoom = (val) => {
  cropZoom = val / 100;
  clampCropOffsets();
  drawCropCanvas();
};

// ── Pan souris ──
function startCropDrag(e) {
  cropDragging = true;
  cropDragStart = { x: e.clientX - cropOffsetX, y: e.clientY - cropOffsetY };
}
function moveCropDrag(e) {
  if (!cropDragging) return;
  cropOffsetX = e.clientX - cropDragStart.x;
  cropOffsetY = e.clientY - cropDragStart.y;
  clampCropOffsets();
  drawCropCanvas();
}
function endCropDrag() { cropDragging = false; cropPinchStartDist = null; }

// ── Pan + pinch-to-zoom tactile ──
function startCropDragTouch(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    cropDragging = true;
    cropDragStart = { x: e.touches[0].clientX - cropOffsetX, y: e.touches[0].clientY - cropOffsetY };
  } else if (e.touches.length === 2) {
    cropDragging = false;
    cropPinchStartDist = touchDistance(e.touches);
    cropPinchStartZoom = cropZoom;
  }
}
function moveCropDragTouch(e) {
  e.preventDefault();
  if (e.touches.length === 1 && cropDragging) {
    cropOffsetX = e.touches[0].clientX - cropDragStart.x;
    cropOffsetY = e.touches[0].clientY - cropDragStart.y;
    clampCropOffsets();
    drawCropCanvas();
  } else if (e.touches.length === 2 && cropPinchStartDist) {
    const newDist = touchDistance(e.touches);
    const ratio = newDist / cropPinchStartDist;
    cropZoom = Math.max(1, Math.min(3, cropPinchStartZoom * ratio));
    document.getElementById('crop-zoom-slider').value = Math.round(cropZoom * 100);
    clampCropOffsets();
    drawCropCanvas();
  }
}
function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

window.cancelCrop = () => {
  document.getElementById('crop-modal').classList.remove('open');
  cropImage = null;
};

window.confirmCrop = async () => {
  if (!cropCanvas) return;
  document.getElementById('crop-modal').classList.remove('open');
  showToast('⏳ Enregistrement…');

 const base64 = cropCanvas.toDataURL('image/jpeg', 0.9);

  try {
    await idbPut('prefs', { key: 'avatarBase64', value: base64 });
    userProfile.photoURL = base64;
    renderUserUI();
    showToast('Photo enregistrée !');

    // Upload Firebase Storage en arrière-plan (best-effort)
    try {
      const blob = await (await fetch(base64)).blob();
      const storRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(storRef, blob);
      const url = await getDownloadURL(storRef);
      await updateProfile(currentUser, { photoURL: url });
      await updateDoc(doc(db,'users',currentUser.uid), { photoURL: url, photoBase64: base64 });
    } catch (cloudErr) {
      console.warn('Upload cloud différé (hors-ligne ou Storage non activé) :', cloudErr);
      await updateDoc(doc(db,'users',currentUser.uid), { photoBase64: base64 }).catch(() => {});
    }
  } catch(e) { showToast('❌ Erreur enregistrement'); }
  cropImage = null;
};

window.openEditPseudo = () => {
  const p = prompt('Nouveau pseudo :', userProfile.pseudo||'');
  if (!p?.trim()) return;
  updateProfile(currentUser,{displayName:p.trim()})
    .then(()=>updateDoc(doc(db,'users',currentUser.uid),{pseudo:p.trim()}))
    .then(()=>{ userProfile.pseudo=p.trim(); renderUserUI(); showToast(' Pseudo mis à jour'); })
    .catch(()=>showToast('❌ Erreur'));
};

window.openEditPassword = async () => {
  const oldPwd = prompt('Pour confirmer, entre ton mot de passe actuel :');
  if (!oldPwd) return;

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, oldPwd);
    await reauthenticateWithCredential(currentUser, credential);
  } catch (e) {
    showToast('❌ Mot de passe actuel incorrect');
    return;
  }

  const newPwd = prompt('Nouveau mot de passe (6+ caractères) :');
  if (!newPwd || newPwd.length < 6) { showToast('❌ Trop court'); return; }

  updatePassword(currentUser, newPwd)
    .then(()=>showToast(' Mot de passe modifié'))
    .catch(()=>showToast('❌ Erreur lors du changement'));
};

window.openThanksModal = () => document.getElementById('thanks-modal').classList.add('open');

window.setAccentColor = async (color) => {
  document.documentElement.setAttribute('data-accent', color === 'blue' ? '' : color);
  document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('selected', d.dataset.accent === color));
  await savePref('accentColor', color);
  settings.accentColor = color;
  if (currentUser) await updateDoc(doc(db,'users',currentUser.uid), { settings }).catch(()=>{});
};

const HELP_CONTENT = [
  { key: 'dashboard', icon: 'fa-chart-pie', title: 'Dashboard', body: `
    Vois ta date du jour, ta tâche prioritaire à démarrer, ta série de jours consécutifs (streak), tes statistiques de la semaine et ton taux de complétion.<br><br>
    Une carte spéciale 🎉 apparaît automatiquement si une tâche contient un mot lié à une fête (anniversaire, soirée…).` },
  { key: 'tasks', icon: 'fa-list-check', title: 'Tâches', body: `
    Crée une tâche avec titre, description, date, heure, couleur, alarme (5 min avant), durée estimée, récurrence (quotidien/hebdo/mensuel), tags personnalisés et sous-tâches.<br><br>
    Clique sur la flèche pour déplier le détail. Le bouton <strong>Démarrer</strong> lance une session de concentration (Pomodoro) basée sur la durée prévue.` },
  { key: 'focus', icon: 'fa-bolt', title: 'Mode concentration', body: `
    Quand tu démarres une tâche, l'app découpe ton temps en cycles Pomodoro (25 min de travail + 5 min de pause).<br><br>
    Le volume de la musique baisse automatiquement et un léger voile sombre apparaît pour t'aider à rester concentré. Réglable dans Paramètres.<br><br>
    Si tu t'absentes plus de 3 minutes, la session se met en pause ; après 3 pauses, elle se termine automatiquement.` },
  { key: 'calendar', icon: 'fa-calendar-days', title: 'Agenda', body: `
    Le calendrier marque les jours avec des tâches prévues. La section "Aujourd'hui" liste automatiquement les tâches du jour.<br><br>
    L'historique te permet de consulter les tâches terminées, supprimées, non faites ou sautées. Une tâche supprimée peut être récupérée pendant 3 jours avant suppression définitive.` },
  { key: 'music', icon: 'fa-music', title: 'Musique', body: `
    Active l'onglet Musique dans Paramètres. Ajoute tes propres MP3 dans "Ma playlist" ou choisis un son d'ambiance (pluie, concentration, forêt, calme).<br><br>
    Le <strong>minuteur de session</strong> arrête automatiquement la musique après 15, 30 ou 45 minutes.<br><br>
    Le <strong>mode Bibliothèque</strong> lance un son calme avec un minuteur de 30 min en un seul geste, pour une ambiance studieuse sans réflexion.` },
  { key: 'teams', icon: 'fa-users', title: 'Équipes', body: `
    Crée une équipe ou rejoins-en une avec son ID. Le créateur valide les demandes d'adhésion.<br><br>
    Choisis un avatar de groupe dans Paramètres, visible uniquement par tes coéquipiers. Le créateur peut aussi autoriser ou bloquer la copie de l'ID de l'équipe.<br><br>
    Dans le chat d'équipe, les messages et les tâches partagées se mélangent dans le même fil, avec réactions (1 par personne).` },
  { key: 'settings', icon: 'fa-gear', title: 'Paramètres', body: `
    Personnalise ton thème (sombre/clair), ta couleur d'accent (bleu/vert/orange/violet), ton pseudo et mot de passe (avec confirmation de l'ancien), tes notifications, et les réglages du mode concentration.` },
];

function renderHelpContent() {
  const el = document.getElementById('help-categories');
  if (!el) return;
  el.innerHTML = HELP_CONTENT.map(h => `
    <div class="help-category">
      <div class="help-category-header" onclick="toggleHelpCategory('${h.key}')">
        <div class="help-category-icon"><i class="fa-solid ${h.icon}"></i></div>
        <div class="help-category-title">${h.title}</div>
        <i class="fa-solid fa-chevron-${openHelpCategory===h.key?'up':'down'}" style="color:var(--text3);font-size:12px;"></i>
      </div>
      ${openHelpCategory===h.key ? `<div class="help-category-body">${h.body}</div>` : ''}
    </div>`).join('');
}

let openHelpCategory = null;
window.toggleHelpCategory = (key) => {
  openHelpCategory = openHelpCategory === key ? null : key;
  renderHelpContent();
};

window.openHelp = () => {
  document.getElementById('help-modal').classList.add('open');
  renderHelpContent();
};
window.openBugReport = () => document.getElementById('bug-modal').classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

window.submitBug = async () => {
  const desc = document.getElementById('bug-desc').value.trim();
  if (!desc) { showToast('⚠️ Décris le bug'); return; }
  await addDoc(collection(db,'bugs'), { desc, uid:currentUser.uid, pseudo:userProfile.pseudo||currentUser.displayName, email:currentUser.email, timestamp:serverTimestamp() });
  showToast('🐛 Bug signalé, merci !');
  closeModal('bug-modal');
};

