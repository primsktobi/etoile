function renderDashboard() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

  const done = tasks.filter(t => t.status === 'done').length;

  const hoursOf = arr => arr.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
  setText('stat-done', done);
  setText('stat-done-h', `${hoursOf(tasks.filter(t => t.status==='done'))}h complétées`);

  const weekTasks = tasks.filter(t => { if (!t.date) return false; const d=new Date(t.date); return d>=weekStart && d<weekEnd; });
  const weekDone = weekTasks.filter(t => t.status==='done').length;
  const pct = weekTasks.length > 0 ? Math.round(weekDone/weekTasks.length*100) : 0;
  setText('ring-pct', pct + '%');
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.strokeDashoffset = 150 - (pct/100)*150;

  // Message de motivation dynamique selon progression hebdo
  const motEl = document.getElementById('week-motivation');
  if (motEl) {
    const msgs = pct === 0  ? ['Commence ta semaine avec énergie !', 'La première tâche est la plus importante.'] :
                 pct < 25   ? ['Tu es lancé, continue !', 'Chaque tâche compte.'] :
                 pct < 50   ? ['Belle progression cette semaine.', 'Tu es sur la bonne voie.'] :
                 pct < 75   ? ['Plus de la moitié du chemin parcouru !', 'Tu dépasses tes objectifs.'] :
                 pct < 100  ? ['Presque au sommet — ne lâche pas !', 'La ligne d\'arrivée est proche.'] :
                              ['Semaine parfaite. Tu es inarrêtable.', '100% cette semaine. Bravo.'];
    motEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
  }

  const days = ['L','M','M','J','V','S','D'];
  const barsEl = document.getElementById('week-bars');
  if (barsEl) {
    barsEl.innerHTML = '';
    for (let i=0; i<7; i++) {
      const day = new Date(weekStart); day.setDate(weekStart.getDate()+i);
      const ds = fmtDate(day);
      const dt = tasks.filter(t => t.date===ds);
      const dd = dt.filter(t => t.status==='done').length;
      const pctD = dt.length>0 ? (dd/dt.length*100) : 0;
      const isToday = fmtDate(now)===ds;
      barsEl.innerHTML += `<div class="week-bar-wrap"><div class="week-bar ${isToday?'today':''}"><div class="week-bar-fill" style="height:${pctD}%"></div></div><div class="week-day">${days[i]}</div></div>`;
    }
  }
  checkNotifBanner();
  renderGreeting();
  renderMyDay();
  renderUpcomingTasks();
  renderStreak();
  renderHabits();
  if (typeof renderCoachMessage === 'function') renderCoachMessage();
  if (typeof checkThemeUnlocks === 'function') checkThemeUnlocks();
}


function renderHabits() {
  const wrap = document.getElementById('habits-wrap');
  const el = document.getElementById('habits-list');
  if (!wrap || !el) return;

  const habitTitles = [...new Set(tasks.filter(t => t.recurrence && t.status !== 'deleted').map(t => t.title))];

  if (habitTitles.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const today = new Date();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    last7Days.push(fmtDate(d));
  }

  el.innerHTML = habitTitles.map(title => {
    const occurrences = tasks.filter(t => t.title === title && t.recurrence);
    const doneDates = new Set(occurrences.filter(t => t.status === 'done').map(t => t.date));
    const dots = last7Days.map(dateStr => {
      const isDone = doneDates.has(dateStr);
      const isToday = dateStr === fmtDate(today);
      return `<div class="habit-dot ${isDone?'done':''} ${isToday?'today':''}"></div>`;
    }).join('');
    return `<div class="habit-card"><div class="habit-name">${escHtml(title)}</div><div class="habit-dots">${dots}</div></div>`;
  }).join('');
}

// ── FLAMME VIVANTE ────────────────────────────────────────────────────────────
// Score cumulatif sauvegardé dans Firebase et IDB
// Base : 35% au premier lancement
// +5 par tâche complétée (bonus +3 si toutes les tâches du jour faites)
// -5 par jour sans aucune tâche complétée
// Min: 10%, Max: 100%

let flameScore = 35; // valeur par défaut premier lancement
let flameCarouselIndex = 0;
let flameCarouselTimer = null;

async function loadFlameScore() {
  // 1. IDB d'abord (offline-first)
  const cached = await idbGet('prefs', 'flameScore');
  if (cached?.value !== undefined) flameScore = cached.value;
  // 2. Firebase en arrière-plan
  if (currentUser) {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists() && snap.data().flameScore !== undefined) {
        flameScore = snap.data().flameScore;
        await idbPut('prefs', { key: 'flameScore', value: flameScore });
      }
    } catch(e) {}
  }
  renderFlame();
}

async function saveFlameScore() {
  await idbPut('prefs', { key: 'flameScore', value: flameScore });
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), { flameScore }).catch(() => {});
  }
}

async function updateFlameOnTaskComplete(taskId) {
  const today = fmtDate(new Date());
  const todayTasks = tasks.filter(t => t.date === today && t.status !== 'deleted');
  const todayDone = tasks.filter(t => t.date === today && t.status === 'done');
  const allDone = todayTasks.length > 0 && todayDone.length >= todayTasks.length;

  flameScore = Math.min(100, flameScore + 5 + (allDone ? 3 : 0));
  await saveFlameScore();
  renderFlame();
  // Particules au clic
  spawnFlameParticles();
}

function checkFlameDailyDecay() {
  // Vérifie si hier aucune tâche n'a été complétée → diminue la flamme
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yd = fmtDate(yesterday);
  const hadActivity = tasks.some(t => t.date === yd && t.status === 'done');
  if (!hadActivity) {
    flameScore = Math.max(10, flameScore - 5);
    saveFlameScore();
  }
}

function renderFlame() {
  const card = document.getElementById('flame-card');
  const wrap = document.getElementById('flame-wrap');
  if (!card || !wrap) return;

  // Couleurs selon niveau — appliquées directement sur les attributs fill SVG
  // pour garantir l'affichage sur tous les navigateurs et OS
  let colors = { outer:'#dc2626', mid:'#f97316', core:'#fbbf24', tip:'#93c5fd',
                 glow:'rgba(249,115,22,0.6)' };
  let szClass = 'sz2'; let heatClass = 'heat-low';

  if (flameScore >= 85) {
    colors = { outer:'#7e22ce', mid:'#a855f7', core:'#c084fc', tip:'#67e8f9', glow:'rgba(168,85,247,0.6)' };
    szClass = 'sz5'; heatClass = 'heat-max';
  } else if (flameScore >= 65) {
    colors = { outer:'#991b1b', mid:'#ef4444', core:'#f97316', tip:'#60a5fa', glow:'rgba(239,68,68,0.6)' };
    szClass = 'sz4'; heatClass = 'heat-high';
  } else if (flameScore >= 50) {
    colors = { outer:'#dc2626', mid:'#f97316', core:'#fbbf24', tip:'#93c5fd', glow:'rgba(249,115,22,0.6)' };
    szClass = 'sz3'; heatClass = 'heat-mid';
  } else if (flameScore >= 35) {
    colors = { outer:'#dc2626', mid:'#f97316', core:'#fbbf24', tip:'#93c5fd', glow:'rgba(249,115,22,0.6)' };
    szClass = 'sz2'; heatClass = 'heat-low';
  } else {
    colors = { outer:'#64748b', mid:'#94a3b8', core:'#cbd5e1', tip:'#e2e8f0', glow:'rgba(100,116,139,0.5)' };
    szClass = 'sz1'; heatClass = '';
  }

  wrap.className = `flame-wrap ${szClass}`;
  card.className = `flame-card ${heatClass}`.trim();

  // Appliquer les couleurs directement sur les paths SVG
  const outer = wrap.querySelector('.flame-outer');
  const mid   = wrap.querySelector('.flame-mid');
  const core  = wrap.querySelector('.flame-core');
  const tip   = wrap.querySelector('.flame-tip');
  const glow  = wrap.querySelector('.flame-glow');
  if (outer) outer.setAttribute('fill', colors.outer);
  if (mid)   mid.setAttribute('fill', colors.mid);
  if (core)  core.setAttribute('fill', colors.core);
  if (tip)   tip.setAttribute('fill', colors.tip);
  if (glow)  glow.style.background = `radial-gradient(ellipse, ${colors.glow} 0%, transparent 70%)`;

  // Stats
  const today = fmtDate(new Date());
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

  const todayDone  = tasks.filter(t => t.date === today && t.status === 'done').length;
  const todayTotal = tasks.filter(t => t.date === today && t.status !== 'deleted').length;
  const weekDone   = tasks.filter(t => { if (!t.date) return false; const d = new Date(t.date); return d >= weekStart && d < weekEnd && t.status === 'done'; }).length;
  const pctToday   = todayTotal > 0 ? Math.round(todayDone / todayTotal * 100) : 0;

  const doneDates = new Set(tasks.filter(t => t.status === 'done' && t.date).map(t => t.date));
  let streak = 0; let cursor = new Date();
  if (!doneDates.has(fmtDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (doneDates.has(fmtDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('flame-streak-val', streak);
  setText('flame-streak-sub', `jour${streak > 1 ? 's' : ''} consécutif${streak > 1 ? 's' : ''}`);
  setText('flame-today-val', todayDone);
  setText('flame-today-sub', `tâche${todayDone > 1 ? 's' : ''} complétée${todayDone > 1 ? 's' : ''} aujourd'hui`);
  setText('flame-week-val', weekDone);
  setText('flame-week-sub', `tâche${weekDone > 1 ? 's' : ''} cette semaine`);
  setText('flame-pct-val', pctToday + '%');
  setText('flame-pct-sub', todayTotal > 0 ? `sur ${todayTotal} tâche${todayTotal > 1 ? 's' : ''} du jour` : 'aucune tâche planifiée');
  setText('flame-lvl-val', flameScore + '%');

  if (!flameCarouselTimer) startFlameCarousel();
}

function startFlameCarousel() {
  const slides = document.querySelectorAll('.flame-stat-slide');
  const dots   = document.querySelectorAll('.flame-dot');
  if (!slides.length) return;

  // Swipe support
  const stats = document.getElementById('flame-stats');
  let touchStartX = 0;
  if (stats && !stats._swipeSet) {
    stats._swipeSet = true;
    stats.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    stats.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goFlameSlide(dx < 0 ? 1 : -1);
    });
  }

  flameCarouselTimer = setInterval(() => goFlameSlide(1), 3000);
}

function goFlameSlide(dir) {
  const slides = document.querySelectorAll('.flame-stat-slide');
  const dots   = document.querySelectorAll('.flame-dot');
  if (!slides.length) return;
  slides[flameCarouselIndex].classList.remove('active');
  dots[flameCarouselIndex]?.classList.remove('active');
  flameCarouselIndex = (flameCarouselIndex + dir + slides.length) % slides.length;
  slides[flameCarouselIndex].classList.add('active');
  dots[flameCarouselIndex]?.classList.add('active');
}

function spawnFlameParticles() {
  const card = document.getElementById('flame-card');
  if (!card) return;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.style.cssText = `position:absolute;pointer-events:none;width:6px;height:6px;border-radius:50%;
      background:${['#f97316','#fbbf24','#ef4444','#93c5fd'][Math.floor(Math.random()*4)]};
      left:${20 + Math.random() * 40}px;bottom:${10 + Math.random() * 20}px;z-index:10;
      animation:particleUp 0.8s ease forwards;`;
    card.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

function renderStreak() { renderFlame(); } // compatibilité ancienne référence

// Greeting : affiché 2x par jour (matin + soir), disparaît après 3 min
let greetingShownToday = { morning: false, evening: false };
let greetingHideTimer = null;

function renderGreeting() {
  const now = new Date();
  const dayEl = document.getElementById('dash-day');
  const dateEl = document.getElementById('dash-date');
  const pill = document.getElementById('dash-greeting-pill');
  const pillText = document.getElementById('dash-greeting-text');

  if (dayEl) dayEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase()) + '.';
  if (dateEl) dateEl.textContent = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  const dashAv = document.getElementById('dash-avatar');
  if (dashAv) {
    const pseudo = userProfile.pseudo || currentUser?.displayName || '?';
    const photoURL = userProfile.photoURL || '';
    if (photoURL) dashAv.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
    else dashAv.textContent = pseudo.slice(0,2).toUpperCase();
  }

  if (!pill || !pillText) return;
  const hour = now.getHours();
  const pseudo = userProfile.pseudo || currentUser?.displayName || '';
  const isMorning = hour >= 5 && hour < 12;
  const isEvening = hour >= 18 && hour < 23;
  const slot = isMorning ? 'morning' : isEvening ? 'evening' : null;

  if (!slot || greetingShownToday[slot]) return;
  const msg = isMorning ? `Bonjour${pseudo ? ', '+pseudo : ''} 👋` : `Bonsoir${pseudo ? ', '+pseudo : ''} 🌙`;
  pillText.textContent = msg;
  pill.style.display = 'inline-flex';
  requestAnimationFrame(() => pill.classList.add('show'));
  greetingShownToday[slot] = true;
  clearTimeout(greetingHideTimer);
  greetingHideTimer = setTimeout(() => {
    pill.classList.remove('show');
    setTimeout(() => { pill.style.display = 'none'; }, 350);
  }, 3 * 60 * 1000);
}

function resetGreetingForNewSession() {
  greetingShownToday = { morning: false, evening: false };
  clearTimeout(greetingHideTimer);
}

// ── Phrase de motivation : affichée une fois par session, 5 min, puis disparaît ──
const MOTIVATION_QUOTES = [
  "Chaque petit pas compte. Continue !",
  "Ton futur toi te remerciera pour aujourd'hui.",
  "La discipline bat le talent quand le talent ne travaille pas.",
  "Un jour à la fois, une tâche à la fois.",
  "Tu n'as pas besoin d'être parfait, juste constant.",
  "La motivation te lance, l'habitude te fait avancer.",
  "Les grands résultats viennent de petites actions répétées.",
  "Concentre-toi sur le progrès, pas la perfection.",
  "Le meilleur moment pour commencer, c'est maintenant.",
  "Chaque session de travail te rapproche de ton objectif.",
  "Tu es plus capable que tu ne le penses.",
  "La régularité crée la réussite.",
  "Une tâche terminée vaut mieux que dix commencées.",
  "Ton seul concurrent, c'est qui tu étais hier.",
  "Le succès se construit dans le silence du quotidien.",
  "Avance, même lentement, mais n'arrête jamais.",
  "Crois en ton travail, les résultats suivront.",
  "La fatigue est temporaire, la fierté est durable.",
  "Sois fier de chaque effort, même petit.",
  "Aujourd'hui est une nouvelle chance de progresser."
];
let motivationShownThisSession = false;
let motivationHideTimer = null;

function maybeShowMotivationQuote() {
  if (motivationShownThisSession) return;
  const el = document.getElementById('motivation-quote');
  if (!el) return;
  motivationShownThisSession = true;
  const quote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
  el.querySelector('.motivation-text').textContent = quote;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(motivationHideTimer);
  motivationHideTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 5 * 60 * 1000);
}

function resetMotivationForNewSession() {
  motivationShownThisSession = false;
  clearTimeout(motivationHideTimer);
}

// ── MA JOURNÉE : sélection manuelle quotidienne, reset auto chaque jour ──
// Stockée en IndexedDB (pas Firestore) car c'est une préférence éphémère,
// propre à l'appareil, qui n'a pas besoin de synchronisation entre appareils.
let myDaySelection = { date: '', taskIds: [] };

async function loadMyDaySelection() {
  const saved = await idbGet('prefs', 'myDaySelection');
  const todayStr = fmtDate(new Date());
  if (saved?.value?.date === todayStr) {
    myDaySelection = saved.value;
  } else {
    // Nouveau jour : on réinitialise automatiquement la sélection
    myDaySelection = { date: todayStr, taskIds: [] };
    await idbPut('prefs', { key: 'myDaySelection', value: myDaySelection });
  }
}

function renderMyDay() {
  const el = document.getElementById('my-day-list');
  if (!el) return;
  const selectedTasks = myDaySelection.taskIds
    .map(id => tasks.find(t => t.id === id))
    .filter(t => t && t.status !== 'deleted');

  if (selectedTasks.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = selectedTasks.map(t => `
    <div class="my-day-card">
      <div class="my-day-card-check ${t.status==='done'?'done':''}">${t.status==='done'?'<i class="fa-solid fa-check"></i>':''}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;${t.status==='done'?'text-decoration:line-through;color:var(--text2);':''}">${escHtml(t.title)}</div>
        ${t.list?`<div style="font-size:11px;color:var(--text3);">${escHtml(t.list)}</div>`:''}
      </div>
      ${t.status!=='done' ? `<button class="task-action-btn" onclick="startFocusForTask('${t.id}')"><i class="fa-solid fa-play"></i></button>` : ''}
    </div>`).join('');
}

window.openMyDayPicker = () => {
  const el = document.getElementById('my-day-picker-list');
  const activeTasks = tasks.filter(t => t.status === 'pending' && !isPastDue(t));
  if (activeTasks.length === 0) {
    el.innerHTML = `<div class="my-day-empty">Aucune tâche active à choisir. Crée d'abord une tâche.</div>`;
  } else {
    el.innerHTML = activeTasks.map(t => `
      <div class="my-day-pick-item ${myDaySelection.taskIds.includes(t.id)?'selected':''}" data-task-id="${t.id}" onclick="toggleMyDayPick(this)">
        <div class="my-day-pick-check">${myDaySelection.taskIds.includes(t.id)?'<i class="fa-solid fa-check"></i>':''}</div>
        <div style="flex:1;min-width:0;font-size:14px;font-weight:600;">${escHtml(t.title)}</div>
      </div>`).join('');
  }
  document.getElementById('my-day-modal').classList.add('open');
};

window.toggleMyDayPick = (el) => {
  el.classList.toggle('selected');
  const check = el.querySelector('.my-day-pick-check');
  check.innerHTML = el.classList.contains('selected') ? '<i class="fa-solid fa-check"></i>' : '';
};

window.saveMyDaySelection = async () => {
  const selected = [...document.querySelectorAll('.my-day-pick-item.selected')].map(el => el.dataset.taskId);
  myDaySelection = { date: fmtDate(new Date()), taskIds: selected };
  await idbPut('prefs', { key: 'myDaySelection', value: myDaySelection });
  closeModal('my-day-modal');
  renderMyDay();
  showToast(` ${selected.length} tâche${selected.length>1?'s':''} pour aujourd'hui`);
};

// ── Cards de tâches premium pour le Dashboard ──
function renderUpcomingTasks() {
  const el = document.getElementById('upcoming-tasks-list');
  const wrap = document.getElementById('upcoming-wrap');
  if (!el) return;
  if (focusState.active) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = 'block';

  const upcoming = tasks
    .filter(t => t.status === 'pending' && t.date && !isPastDue(t))
    .map(t => ({ ...t, _dt: new Date(t.date + (t.time ? 'T'+t.time : 'T00:00')) }))
    .sort((a,b) => a._dt - b._dt)
    .slice(0, 2);

  if (upcoming.length === 0) {
    el.innerHTML = `<div style="padding:10px 4px;color:var(--text3);font-size:12px;text-align:center;">Aucune tâche à venir</div>`;
    return;
  }

  el.innerHTML = upcoming.map((t, idx) => dashTaskCardHTML(t, idx === 0)).join('');
}

function dashTaskCardHTML(t, isMain) {
  const dateObj = new Date(t.date);
  const day = dateObj.toLocaleDateString('fr-FR', { day: 'numeric' });
  const month = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
  const cardClass = isMain ? 'dash-task-card-main' : 'dash-task-card-secondary';
  return `
  <div class="dash-task-card ${cardClass} fade-in">
    <div class="dash-task-top">
      <div class="dash-task-title-wrap">
        <div class="dash-task-name">${escHtml(t.title)}</div>
        <div class="dash-task-sub">
          ${t.time ? `<span><i class="fa-solid fa-clock"></i> ${t.time}</span>` : ''}
          ${t.hours ? `<span><i class="fa-solid fa-hourglass-half"></i> ${t.hours}h</span>` : ''}
          ${t.alarm ? `<span><i class="fa-solid fa-bell"></i> -5min</span>` : ''}
        </div>
      </div>
      <div class="dash-task-badge">
        <span class="dash-task-badge-day">${day}</span>
        <span class="dash-task-badge-month">${month}</span>
      </div>
    </div>
    <div class="dash-task-bottom">
      <button class="dash-task-start-btn" onclick="startFocusForTask('${t.id}')">
        <i class="fa-solid fa-play"></i> Démarrer
      </button>
    </div>
  </div>`;
}

function isPastDue(t) {
  if (!t.date) return false;
  return new Date(t.date + (t.time ? 'T'+t.time : 'T23:59')) < new Date();
}

