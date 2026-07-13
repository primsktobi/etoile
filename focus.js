const POMODORO_MIN = 25;
const POMODORO_BREAK_MIN = 5;
const AWAY_LIMIT_MS = 3 * 60 * 1000; 
const AWAY_LIMIT_COUNT = 3; 

let focusState = {
  active: false,
  taskId: null,
  taskTitle: '',
  cycles: [], 
  cycleIndex: 0,
  secondsLeft: 0,
  paused: false,
  tickInterval: null,
  awayCount: 0,
  awaySince: null,
  awayTimer: null,
  secondsSpentTotal: 0,
};

function buildPomodoroCycles(totalHours) {
  const totalMinutes = Math.round(totalHours * 60);
  const cycles = [];
  let remaining = totalMinutes;
  if (remaining <= 0) remaining = POMODORO_MIN; // valeur par défaut si pas d'heures précisées
  let first = true;
  while (remaining > 0) {
    if (!first) cycles.push({ type: 'break', durationSec: POMODORO_BREAK_MIN * 60 });
    const work = Math.min(POMODORO_MIN, remaining);
    cycles.push({ type: 'work', durationSec: work * 60 });
    remaining -= work;
    first = false;
  }
  return cycles;
}

window.startFocusForTask = (taskId) => {
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  if (focusState.active) { showToast('⚠️ Une session est déjà en cours'); return; }

  const cycles = buildPomodoroCycles(parseFloat(t.hours) || 0);
  focusState = {
    active: true, taskId, taskTitle: t.title,
    cycles, cycleIndex: 0,
    secondsLeft: cycles[0].durationSec,
    paused: false, tickInterval: null,
    awayCount: 0, awaySince: null, awayTimer: null,
    secondsSpentTotal: 0,
    tickStartTime: Date.now(),
    tickStartSecondsLeft: cycles[0].durationSec,
  };
  goTo('dashboard');
  document.getElementById('focus-card').style.display = 'flex';
  document.getElementById('upcoming-wrap').style.display = 'none';
  renderFocusUI();
  startFocusTick();
  activateConcentrationMode();
  showToast('🎯 Focus démarré !');
};

// ── Mode concentration : volume réduit + voile sombre pendant une session ──
let concentrationPrevVolume = null;
function activateConcentrationMode() {
  // Volume réduit automatiquement
  const targetVolPct = settings.concentrationVolume ?? 50;
  if (audioPlayer && !audioPlayer.paused) {
    concentrationPrevVolume = audioPlayer.volume;
    audioPlayer.volume = targetVolPct / 100;
  }
  // Voile d'assombrissement
  if (settings.dimmingEnabled !== false) {
    const overlay = document.getElementById('concentration-overlay');
    const intensity = (settings.dimIntensity ?? 35) / 100;
    overlay.style.setProperty('--dim-intensity', intensity);
    overlay.classList.add('active');
  }
}

function deactivateConcentrationMode() {
  if (concentrationPrevVolume !== null && audioPlayer) {
    audioPlayer.volume = concentrationPrevVolume;
    concentrationPrevVolume = null;
  }
  document.getElementById('concentration-overlay').classList.remove('active');
}

window.updateConcentrationVolumeLabel = (val) => setText('concentration-volume-label', val + '%');
window.updateConcentrationDimLabel = (val) => setText('concentration-dim-label', `Intensité : ${val}%`);

window.toggleDimmingFeature = async () => {
  settings.dimmingEnabled = !(settings.dimmingEnabled !== false);
  document.getElementById('dimming-toggle').classList.toggle('on', settings.dimmingEnabled);
  await saveSettings();
};

window.saveConcentrationSettings = async () => {
  settings.concentrationVolume = parseInt(document.getElementById('concentration-volume-slider').value);
  settings.dimIntensity = parseInt(document.getElementById('concentration-dim-slider').value);
  await saveSettings();
  showToast('Réglages enregistrés');
};

function loadConcentrationSettingsUI() {
  const volSlider = document.getElementById('concentration-volume-slider');
  const dimSlider = document.getElementById('concentration-dim-slider');
  const dimToggle = document.getElementById('dimming-toggle');
  if (volSlider) {
    volSlider.value = settings.concentrationVolume ?? 50;
    setText('concentration-volume-label', (settings.concentrationVolume ?? 50) + '%');
  }
  if (dimSlider) {
    dimSlider.value = settings.dimIntensity ?? 35;
    setText('concentration-dim-label', `Intensité : ${settings.dimIntensity ?? 35}%`);
  }
  if (dimToggle) dimToggle.classList.toggle('on', settings.dimmingEnabled !== false);

  const iosNote = document.getElementById('concentration-volume-ios-note');
  if (iosNote) iosNote.style.display = isIOS ? 'block' : 'none';
}

let openConcentrationCategory = null;
window.toggleConcentrationCategory = (key) => {
  const wasOpen = openConcentrationCategory === key;
  openConcentrationCategory = wasOpen ? null : key;
  document.getElementById('concentration-volume-body').style.display = (key==='volume' && !wasOpen) ? 'block' : 'none';
  document.getElementById('concentration-dimming-body').style.display = (key==='dimming' && !wasOpen) ? 'block' : 'none';
  document.getElementById('concentration-volume-chevron').className = `fa-solid fa-chevron-${(key==='volume' && !wasOpen)?'up':'down'}`;
  document.getElementById('concentration-dimming-chevron').className = `fa-solid fa-chevron-${(key==='dimming' && !wasOpen)?'up':'down'}`;
};

function startFocusTick() {
  clearInterval(focusState.tickInterval);
  // Sauvegarder l'heure de départ pour recalculer correctement
  // même si l'app part en arrière-plan (PWA/iOS tue setInterval)
  if (!focusState.tickStartTime) focusState.tickStartTime = Date.now();
  if (!focusState.tickStartSecondsLeft) focusState.tickStartSecondsLeft = focusState.secondsLeft;

  focusState.tickInterval = setInterval(() => {
    if (focusState.paused || !focusState.active) return;

    // Calcul basé sur l'heure réelle du téléphone — résiste à la mise en arrière-plan
    const elapsed = Math.floor((Date.now() - focusState.tickStartTime) / 1000);
    const newSecondsLeft = Math.max(0, focusState.tickStartSecondsLeft - elapsed);

    if (newSecondsLeft !== focusState.secondsLeft) {
      const delta = focusState.secondsLeft - newSecondsLeft;
      if (focusState.cycles[focusState.cycleIndex].type === 'work') {
        focusState.secondsSpentTotal += delta;
      }
      focusState.secondsLeft = newSecondsLeft;
    }

    if (focusState.secondsLeft <= 0) {
      advanceFocusCycle();
    } else {
      renderFocusUI();
    }
  }, 1000);
}

function advanceFocusCycle() {
  focusState.cycleIndex++;
  if (focusState.cycleIndex >= focusState.cycles.length) {
    finishFocusSession(true);
    return;
  }
  const cycle = focusState.cycles[focusState.cycleIndex];
  focusState.secondsLeft = cycle.durationSec;
  // Réinitialiser la référence temps pour le nouveau cycle
  focusState.tickStartTime = Date.now();
  focusState.tickStartSecondsLeft = cycle.durationSec;
  if (cycle.type === 'break') {
    showToast('Pause ! 5 minutes');
    sendLocalNotif('Pause méritée', `Petite pause de ${POMODORO_BREAK_MIN} min avant de reprendre`);
  } else {
    showToast('Reprise du focus');
    sendLocalNotif('Retour au travail', focusState.taskTitle);
  }
  renderFocusUI();
}

function renderFocusUI() {
  if (!focusState.active) return;
  const cycle = focusState.cycles[focusState.cycleIndex];
  const workCyclesTotal = focusState.cycles.filter(c => c.type === 'work').length;
  const workCyclesDone = focusState.cycles.slice(0, focusState.cycleIndex).filter(c => c.type === 'work').length + (cycle.type === 'work' ? 1 : 0);

  setText('focus-task-title', focusState.taskTitle);
  setText('focus-time-left', formatTime(focusState.secondsLeft));
  setText('focus-phase-label', cycle.type === 'work' ? `Pomodoro ${workCyclesDone}/${workCyclesTotal}` : 'Pause ☕');

  const ring = document.getElementById('focus-ring-fill');
  if (ring) {
    const pct = 1 - (focusState.secondsLeft / cycle.durationSec);
    const circumference = 553;
    ring.style.strokeDashoffset = circumference - pct * circumference;
  }

  const pauseBtn = document.getElementById('focus-pause-btn');
  if (pauseBtn) pauseBtn.innerHTML = focusState.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';

  // Points de cycle (un point par pomodoro/pause dans la session)
  const dotsEl = document.getElementById('focus-cycles-dots');
  if (dotsEl) {
    dotsEl.innerHTML = focusState.cycles.map((c, i) => {
      const isDone = i < focusState.cycleIndex;
      const isCurrent = i === focusState.cycleIndex;
      const cls = ['focus-cycle-dot'];
      if (c.type === 'break') cls.push('break');
      if (isDone) cls.push('done');
      if (isCurrent) cls.push('current');
      return `<div class="${cls.join(' ')}"></div>`;
    }).join('');
  }

  updateTopbarFocusState();
}

// Gère l'apparence de la topbar : maximum 2 icônes visibles à la fois.
// Normal (pas de focus) : musique (si active) + photo.
// Focus actif hors Dashboard : décompte + musique (si active) OU décompte + photo (si pas de musique).
function updateTopbarFocusState() {
  const isDashboard = document.getElementById('screen-dashboard')?.classList.contains('active');
  const avatar = document.getElementById('user-avatar');
  const focusBadge = document.getElementById('topbar-focus-badge');
  const musicIcon = document.getElementById('topbar-music-icon');
  const isMusicActive = musicIcon && musicIcon.style.display !== 'none';

  if (focusState.active && !isDashboard) {
    // Priorité : décompte toujours visible + musique si dispo, sinon photo
    focusBadge.style.display = 'flex';
    setText('topbar-focus-time', formatTime(focusState.secondsLeft));
    if (isMusicActive) {
      avatar.style.display = 'none'; // musique prend la 2e place
    } else {
      avatar.style.display = 'flex'; // pas de musique -> photo prend la 2e place
    }
  } else {
    focusBadge.style.display = 'none';
    avatar.style.display = 'flex';
  }
}

function restoreNormalTopbar() {
  document.getElementById('user-avatar').style.display = 'flex';
  const focusBadge = document.getElementById('topbar-focus-badge');
  if (focusBadge) focusBadge.style.display = 'none';
}

window.focusPauseResume = () => {
  focusState.paused = !focusState.paused;
  if (!focusState.paused) {
    // À la reprise — réinitialiser la référence temps pour que le calcul
    // basé sur Date.now() soit correct depuis ce moment
    focusState.tickStartTime = Date.now();
    focusState.tickStartSecondsLeft = focusState.secondsLeft;
  }
  renderFocusUI();
};

window.stopFocusSession = () => {
  if (!confirm('Arrêter la session ? La tâche sera marquée comme effectuée.')) return;
  // Un arrêt manuel pendant le décompte compte comme une tâche effectuée
  // (seule la détection d'absence répétée déclenche un arrêt "non complété")
  finishFocusSession(true);
};

async function finishFocusSession(completed) {
  clearInterval(focusState.tickInterval);
  clearTimeout(focusState.awayTimer);
  const taskId = focusState.taskId;
  const hoursSpent = Math.round((focusState.secondsSpentTotal / 3600) * 100) / 100;

  // On masque l'UI et désactive le focus IMMÉDIATEMENT, avant tout appel réseau.
  // Sinon, en cas de réseau lent, l'écran reste figé sur 00:00/00:01 pendant
  // toute la durée de l'attente Firestore — ce qui donnait l'impression d'un blocage.
  focusState.active = false;
  document.getElementById('focus-card').style.display = 'none';
  document.getElementById('upcoming-wrap').style.display = 'block';
  restoreNormalTopbar();
  deactivateConcentrationMode();
  renderDashboard();
  renderTaskList();

  if (taskId) {
    const updateData = { updatedAt: serverTimestamp() };
    if (completed) {
      updateData.status = 'done';
      updateData.actualHours = hoursSpent;
      showToast('🎉 Tâche terminée, bravo !');
    } else {
      updateData.actualHours = hoursSpent;
      // Interruption réelle (pas un report) : réponse du coach, jamais un message
      // système neutre, et jamais une pénalité visible sur la flamme/streak.
      if (typeof notifyTaskInterrupted === 'function') notifyTaskInterrupted();
    }

    const localTask = tasks.find(t => t.id === taskId);
    if (localTask) Object.assign(localTask, completed ? { status: 'done', actualHours: hoursSpent } : { actualHours: hoursSpent });

    try {
      await updateDoc(doc(db, 'tasks', taskId), updateData);
      if (completed && localTask?.recurrence) await regenerateRecurringTask(localTask);
    } catch(e) { console.warn('finishFocusSession update:', e); }
  }
}

// ── Détection d'absence (changement d'écran / app en arrière-plan) ──
function focusHandleAway() {
  if (!focusState.active || focusState.paused) return;
  focusState.awaySince = Date.now();
  focusState.awayTimer = setTimeout(() => {
    if (!focusState.active) return;
    focusState.paused = true;
    focusState.awayCount++;
    renderFocusUI();
    if (focusState.awayCount >= AWAY_LIMIT_COUNT) {
      finishFocusSession(false);
    } else {
      showToast(`⏸️ Session mise en pause (absence > 3 min) — ${focusState.awayCount}/${AWAY_LIMIT_COUNT}`);
    }
  }, AWAY_LIMIT_MS);
}

function focusHandleReturn() {
  if (!focusState.active) return;
  clearTimeout(focusState.awayTimer);
  focusState.awaySince = null;
}


const _originalGoTo = window.goTo;
window.goTo = (screen) => {
  if (focusState.active && screen !== 'dashboard') focusHandleAway();
  else if (focusState.active && screen === 'dashboard') focusHandleReturn();
  _originalGoTo(screen);
  updateTopbarFocusState();
};

document.addEventListener('visibilitychange', () => {
  
  if (document.visibilityState === 'hidden') focusHandleAway();
  else focusHandleReturn();
});

