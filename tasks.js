let advancedFilters = { list: '', minPriority: 0 };

function renderTaskList() {
  const el = document.getElementById('task-list');
  if (!el) return;
  let filtered = tasks.filter(t => t.status !== 'deleted');
  const now = new Date();
  const todayStr = fmtDate(now);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate()+7);

  if (currentFilter==='today') filtered = filtered.filter(t => t.date===todayStr && t.status !== 'done');
  else if (currentFilter==='week') filtered = filtered.filter(t => t.date && new Date(t.date)<=weekEnd && t.status !== 'done');
  else if (currentFilter==='done') filtered = filtered.filter(t => t.status==='done');
  else if (currentFilter==='all') filtered = filtered.filter(t => t.status !== 'done');


  if (advancedFilters.list) filtered = filtered.filter(t => t.list === advancedFilters.list);
  if (advancedFilters.minPriority > 0) filtered = filtered.filter(t => (t.priority||0) >= advancedFilters.minPriority);

  filtered.forEach(t => { if (t.status==='pending' && isPastDue(t)) t._overdue=true; });

  if (filtered.length===0) {
    el.innerHTML = taskEmptyStateHTML(currentFilter, tasks.length === 0);
    return;
  }
  el.innerHTML = filtered.map(taskHTML).join('');
}


let taskViewMode = 'list'; 

window.toggleTaskView = () => {
  taskViewMode = taskViewMode === 'list' ? 'kanban' : 'list';
  const listEl = document.getElementById('task-list');
  const kanbanEl = document.getElementById('kanban-board');
  const filterTabsRow = document.getElementById('filter-tabs-row');
  const btn = document.getElementById('view-toggle-btn');

  if (taskViewMode === 'kanban') {
    listEl.style.display = 'none';
    kanbanEl.style.display = 'flex';
    filterTabsRow.style.display = 'none'; // les onglets rapides n'ont pas de sens en vue kanban (déjà organisé par statut)
    btn.classList.add('active');
    btn.innerHTML = '<i class="fa-solid fa-list"></i>';
    renderKanbanBoard();
  } else {
    listEl.style.display = 'block';
    kanbanEl.style.display = 'none';
    filterTabsRow.style.display = 'flex';
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fa-solid fa-table-columns"></i>';
    renderTaskList();
  }
};

function renderKanbanBoard() {
  const el = document.getElementById('kanban-board');
  if (!el) return;
  let visible = tasks.filter(t => t.status !== 'deleted' && t.status !== 'missed');
  if (advancedFilters.list) visible = visible.filter(t => t.list === advancedFilters.list);
  if (advancedFilters.minPriority > 0) visible = visible.filter(t => (t.priority||0) >= advancedFilters.minPriority);

  const todoCol = visible.filter(t => t.status === 'pending' && t.id !== focusState.taskId);
  const inProgressCol = visible.filter(t => t.status === 'pending' && t.id === focusState.taskId && focusState.active);
  const doneCol = visible.filter(t => t.status === 'done');

  const columns = [
    { key: 'todo', title: 'À faire', icon: 'fa-circle', items: todoCol },
    { key: 'progress', title: 'En cours', icon: 'fa-bolt', items: inProgressCol },
    { key: 'done', title: 'Terminé', icon: 'fa-circle-check', items: doneCol },
  ];

  el.innerHTML = columns.map(col => `
    <div class="kanban-column">
      <div class="kanban-column-header">
        <div class="kanban-column-title"><i class="fa-solid ${col.icon}"></i> ${col.title}</div>
        <div class="kanban-column-count">${col.items.length}</div>
      </div>
      <div class="kanban-cards">
        ${col.items.length === 0
          ? `<div class="kanban-empty-col">Vide</div>`
          : col.items.map(t => kanbanCardHTML(t)).join('')
        }
      </div>
    </div>`).join('');
}

function kanbanCardHTML(t) {
  const color = t.color || '#2563eb';
  const isDone = t.status === 'done';
  return `
    <div class="kanban-card" style="--task-color:${color};" onclick="openTaskModal('${t.id}')">
      <div class="kanban-card-title ${isDone?'done':''}">${escHtml(t.title)}</div>
      <div class="kanban-card-meta">
        ${t.list ? `<span><i class="fa-solid fa-folder"></i> ${escHtml(t.list)}</span>` : ''}
        ${t.date ? `<span>📅 ${fmt(t.date)}</span>` : ''}
      </div>
    </div>`;
}

window.toggleAdvancedFilters = () => {
  const panel = document.getElementById('advanced-filters-panel');
  const btn = document.getElementById('advanced-filter-btn');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) populateFilterListSelect();
};

function populateFilterListSelect() {
  const select = document.getElementById('filter-list-select');
  const lists = [...new Set(tasks.map(t => t.list).filter(Boolean))];
  const current = select.value;
  select.innerHTML = `<option value="">Toutes les listes</option>` + lists.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');
  select.value = current;
}

window.applyAdvancedFilters = () => {
  advancedFilters.list = document.getElementById('filter-list-select').value;
  updateAdvancedFilterButtonState();
  renderTaskList();
};

window.selectFilterPriority = (el) => {
  document.querySelectorAll('#filter-priority-picker .priority-opt').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  advancedFilters.minPriority = parseInt(el.dataset.pri);
  updateAdvancedFilterButtonState();
  renderTaskList();
};

window.resetAdvancedFilters = () => {
  advancedFilters = { list: '', minPriority: 0 };
  document.getElementById('filter-list-select').value = '';
  document.querySelectorAll('#filter-priority-picker .priority-opt').forEach((d,i) => d.classList.toggle('selected', i===0));
  updateAdvancedFilterButtonState();
  renderTaskList();
};

function updateAdvancedFilterButtonState() {
  const hasActive = advancedFilters.list || advancedFilters.minPriority > 0;
  document.getElementById('advanced-filter-btn').classList.toggle('active', hasActive);
}

// État vide de la liste de tâches — jamais un simple "Aucune tâche", toujours
// une phrase du coach adaptée au contexte (aucune tâche du tout, rien fait
// encore, ou juste rien pour ce filtre précis).
const MSG_EMPTY_HERO = [
  { title: "Une nouvelle page t'attend", sub: "Commence par une tâche, aussi petite soit-elle." },
  { title: "Prêt·e à démarrer ?", sub: "Ajoute ta première tâche et donne le ton à ta journée." },
  { title: "Rien pour l'instant, et c'est parfait", sub: "C'est le meilleur moment pour poser ce que tu veux accomplir." },
  { title: "À toi de jouer", sub: "Une tâche à la fois. On commence par laquelle ?" }
];
const MSG_EMPTY_NOTHING_DONE = [
  "Rien de coché encore. La première fois, ça change quelque chose.",
  "Pas de victoire ici pour l'instant. La prochaine tâche terminée changera ça."
];
const MSG_EMPTY_FILTER = [
  "Rien à afficher ici. Le champ est libre.",
  "Vide pour l'instant. Pas pour longtemps si tu veux.",
  "Rien de prévu ici. Ajoute quelque chose si ça a du sens."
];

// Avatar réel de l'utilisateur (photo de profil si dispo, sinon initiales) —
// même logique que renderUserUI() dans core.js.
function taskEmptyHeroAvatarHTML() {
  const pseudo = (typeof userProfile !== 'undefined' && userProfile.pseudo) || currentUser?.displayName || '?';
  const initials = pseudo.slice(0, 2).toUpperCase();
  const photoURL = (typeof userProfile !== 'undefined' && userProfile.photoURL) || currentUser?.photoURL || '';
  return photoURL ? `<img src="${photoURL}" alt="">` : initials;
}

function taskEmptyStateHTML(filter, noTasksAtAll) {
  if (noTasksAtAll) {
    const msg = pick(MSG_EMPTY_HERO);
    return `
      <div class="empty-state task-empty-hero">
        <div class="task-empty-avatar-wrap">
          <div class="task-empty-badge b1"><i class="fa-solid fa-list-check"></i></div>
          <div class="task-empty-avatar">${taskEmptyHeroAvatarHTML()}</div>
          <div class="task-empty-badge b2"><i class="fa-solid fa-bolt"></i></div>
          <div class="task-empty-badge b3"><i class="fa-solid fa-star"></i></div>
          <div class="task-empty-sparkle"><i class="fa-solid fa-sparkles"></i></div>
        </div>
        <div class="empty-title">${msg.title}</div>
        <div class="empty-sub">${msg.sub}</div>
        <button class="task-empty-cta" onclick="openTaskModal()"><i class="fa-solid fa-plus"></i> Ajouter une tâche</button>
      </div>`;
  }
  let title, sub;
  if (filter === 'done') {
    title = 'Rien de terminé pour l\'instant';
    sub = pick(MSG_EMPTY_NOTHING_DONE);
  } else {
    title = 'Rien ici';
    sub = pick(MSG_EMPTY_FILTER);
  }
  return `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}

function hexToRgba(hex, alpha) {
  hex = (hex || '#2563eb').replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

let expandedTaskIds = new Set();

window.toggleTaskExpand = (id) => {
  if (expandedTaskIds.has(id)) expandedTaskIds.delete(id);
  else expandedTaskIds.add(id);
  renderTaskList();
};

// Détection de mots-clés "fête" pour afficher une carte spéciale festive
const PARTY_KEYWORDS = ['fête','fete','anniversaire','soirée','soiree','mariage','noël','noel','nouvel an','baptême','bapteme','graduation','remise de diplôme','fiançailles','fiancailles'];
function isPartyTask(t) {
  const text = `${t.title||''} ${t.content||''}`.toLowerCase();
  return PARTY_KEYWORDS.some(k => text.includes(k));
}

function taskHTML(t) {
  const color = t.color || '#2563eb';
  const isDone = t.status==='done';
  const isExpanded = expandedTaskIds.has(t.id);
  const isParty = isPartyTask(t);
  const subtasks = t.subtasks || [];
  const subDone = subtasks.filter(s => s.done).length;
  const hasExtra = !!(t.content || t.alarm || subtasks.length > 0 || t.tags?.length);
  const priority = t.priority || 0;
  const priorityColors = { 1: '#94a3b8', 2: '#3b82f6', 3: '#f97316', 4: '#ef4444' };

  if (isParty) return partyTaskHTML(t, isDone, isExpanded);

  return `
  <div class="task-card-premium compact fade-in ${isDone?'is-done':''}" style="--task-color:${color}; background: linear-gradient(135deg, ${hexToRgba(color,0.85)} 0%, ${hexToRgba(color,0.55)} 100%); border-color: ${hexToRgba(color,0.3)};">
    <div class="task-card-glow" style="display:none;"></div>
    <div class="task-card-row">
      <div class="task-check-premium ${isDone?'done':''}" style="--task-color:${color};">${isDone?'<i class="fa-solid fa-check"></i>':''}</div>
      <div class="task-body">
        <div class="task-card-titlerow">
          ${priority>0 ? `<i class="fa-solid fa-flag" style="color:${priorityColors[priority]};font-size:12px;"></i>` : ''}
          <div class="task-title-premium ${isDone?'done':''}">${escHtml(t.title)}</div>
          ${hasExtra ? `<i class="fa-solid fa-chevron-${isExpanded?'up':'down'} task-expand-arrow" onclick="toggleTaskExpand('${t.id}')"></i>` : ''}
        </div>
        <div class="task-meta-row">
          <div class="task-meta">
            ${t.list?`<span class="task-tag-premium" style="--task-color:${color};"><i class="fa-solid fa-folder"></i> ${escHtml(t.list)}</span>`:''}
            ${t.date?`<span class="task-tag-premium" style="--task-color:${color};">📅 ${fmt(t.date)}${t.time?' '+t.time:''}</span>`:''}
            ${subtasks.length>0?`<span class="task-tag-premium" style="--task-color:${color};"><i class="fa-solid fa-list-check"></i> ${subDone}/${subtasks.length}</span>`:''}
            ${t.recurrence?`<span class="task-tag-premium" style="--task-color:${color};"><i class="fa-solid fa-rotate"></i> ${recurrenceLabel(t.recurrence)}</span>`:''}
          </div>
          ${t._overdue?`<span class="task-tag-premium overdue-centered" style="--task-color:#ef4444;">⚠️ En retard</span>`:''}
          ${(!isDone) ? `<button class="task-start-btn-compact" style="--task-color:${color};" onclick="startFocusForTask('${t.id}')"><i class="fa-solid fa-play"></i> Démarrer</button>` : ''}
        </div>
        ${t.tags?.length ? `<div class="task-tags-row">${t.tags.map(tag=>`<span class="task-tag-chip">${escHtml(tag)}</span>`).join('')}</div>` : ''}
        ${isExpanded ? `
          <div class="task-expanded-content fade-in">
            ${t.content?`<div class="task-content">${escHtml(t.content)}</div>`:''}
            <div class="task-meta" style="margin-top:4px;">
              ${t.hours?`<span class="task-tag-premium" style="--task-color:${color};">⏱ ${formatDurationLabel(t.hours)}</span>`:''}
              ${t.alarm?`<span class="task-tag-premium alarm" style="--task-color:${color};">🔔 5min</span>`:''}
              ${t.reminderVeille?`<span class="task-tag-premium alarm" style="--task-color:${color};">📅 J-1</span>`:''}
              ${t.reminderRepeat?`<span class="task-tag-premium alarm" style="--task-color:${color};">🔁 Répété</span>`:''}
            </div>
            ${subtasks.length>0 ? `
              <div class="subtask-list">
                ${subtasks.map((s,i)=>`
                  <div class="subtask-item" onclick="toggleSubtask('${t.id}',${i})">
                    <div class="subtask-check ${s.done?'done':''}" style="--task-color:${color};">${s.done?'<i class="fa-solid fa-check"></i>':''}</div>
                    <span class="${s.done?'subtask-done-text':''}">${escHtml(s.text)}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>` : ''}
      </div>
      <div class="task-actions">
        <button class="task-action-btn" onclick="duplicateTask('${t.id}')" title="Dupliquer"><i class="fa-solid fa-copy"></i></button>
        <button class="task-action-btn" onclick="openTaskModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="task-action-btn" onclick="confirmDeleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

// Carte spéciale pour les tâches détectées comme "fête"
function partyTaskHTML(t, isDone, isExpanded) {
  return `
  <div class="task-card-party fade-in ${isDone?'is-done':''}">
    <div class="party-confetti">🎉</div>
    <div class="task-card-row">
      <div class="task-check-premium party-check ${isDone?'done':''}">${isDone?'<i class="fa-solid fa-check"></i>':''}</div>
      <div class="task-body">
        <div class="task-card-titlerow">
          <div class="task-title-premium party-title ${isDone?'done':''}">🎊 ${escHtml(t.title)}</div>
          <i class="fa-solid fa-chevron-${isExpanded?'up':'down'} task-expand-arrow party-arrow" onclick="toggleTaskExpand('${t.id}')"></i>
        </div>
        <div class="task-meta">
          ${t.date?`<span class="task-tag-party">📅 ${fmt(t.date)}${t.time?' '+t.time:''}</span>`:''}
        </div>
        ${isExpanded && t.content ? `<div class="task-content party-content">${escHtml(t.content)}</div>` : ''}
        ${(!isDone) ? `<button class="task-start-btn-party" onclick="startFocusForTask('${t.id}')"><i class="fa-solid fa-play"></i> Démarrer</button>` : ''}
      </div>
      <div class="task-actions">
        <button class="task-action-btn party-action-btn" onclick="openTaskModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="task-action-btn party-action-btn" onclick="confirmDeleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

// La récurrence est stockée en objet structuré : { type, days?, interval? }
// type: 'daily' | 'weekdays' | 'interval' | 'monthly' | 'last-day-month'
const WEEKDAY_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// Affiche une durée décimale (ex: 1.5) en format lisible "1h30" ou "45min"
function formatDurationLabel(hoursDecimal) {
  const totalMinutes = Math.round(hoursDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2,'0')}`;
}

function recurrenceLabel(rec) {
  if (!rec) return '';
  if (typeof rec === 'string') return { daily:'Quotidien', weekly:'Hebdo', monthly:'Mensuel' }[rec] || rec; // anciennes tâches (rétrocompatibilité)
  if (rec.type === 'daily') return 'Quotidien';
  if (rec.type === 'weekdays') return (rec.days||[]).map(d => WEEKDAY_LABELS[d]).join(' ');
  if (rec.type === 'interval') return `Tous les ${rec.interval}j`;
  if (rec.type === 'monthly') return 'Mensuel';
  if (rec.type === 'last-day-month') return 'Fin de mois';
  return '';
}

window.toggleSubtask = async (taskId, index) => {
  const t = tasks.find(x => x.id === taskId);
  if (!t || !t.subtasks?.[index]) return;
  const subtasks = [...t.subtasks];
  subtasks[index] = { ...subtasks[index], done: !subtasks[index].done };
  const now = Date.now();
  await idbPut('tasks', { ...t, subtasks, updatedAt: now });
  tasks = tasks.map(x => x.id===taskId ? { ...x, subtasks, updatedAt: now } : x);
  renderTaskList();
  await queuePush('update', 'tasks', taskId, { subtasks });
  if (navigator.onLine) await window.queueFlush();
};


window.filterTasks = (f, el) => {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderTaskList();
};

// Le rond à cocher est désormais purement visuel/indicatif : une tâche ne peut
// être marquée "terminée" QUE via le Pomodoro (décompte complet ou arrêt manuel
// pendant le décompte). Cette fonction n'est plus appelée au clic sur le rond.
window.toggleTask = async (id) => {
  const t = tasks.find(x => x.id===id);
  if (!t) return;
  const newStatus = t.status==='done' ? 'pending' : 'done';
  const now = Date.now();
  await idbPut('tasks', { ...t, status: newStatus, updatedAt: now });
  tasks = tasks.map(x => x.id===id ? { ...x, status: newStatus, updatedAt: now } : x);
  renderTaskList();
  if (taskViewMode === 'kanban') renderKanbanBoard();
  renderDashboard();
  await queuePush('update', 'tasks', id, { status: newStatus });
  if (navigator.onLine) await window.queueFlush();
  // Mise à jour de la flamme uniquement quand on marque comme terminé
  if (newStatus === 'done' && typeof updateFlameOnTaskComplete === 'function') {
    await updateFlameOnTaskComplete(id);
  }
  // La toute première tâche terminée du compte a droit à son propre moment,
  // plus marquant qu'un simple toast et distinct des célébrations de streak.
  const wasFirstCompletion = newStatus === 'done' && typeof notifyFirstTaskCompleted === 'function'
    ? await notifyFirstTaskCompleted() : false;
  if (!wasFirstCompletion) {
    showToast(newStatus==='done' ? 'Terminée !' : 'Rouverte');
    // Célébration si palier de streak atteint (2e complétion et suivantes)
    if (newStatus === 'done' && typeof showTaskCompletionCelebration === 'function') {
      const doneDates = new Set(tasks.filter(t => t.status === 'done' && t.date).map(t => t.date));
      let streak = 0; let cursor = new Date();
      if (!doneDates.has(cursor.toISOString().slice(0,10))) cursor.setDate(cursor.getDate()-1);
      while (doneDates.has(cursor.toISOString().slice(0,10))) { streak++; cursor.setDate(cursor.getDate()-1); }
      showTaskCompletionCelebration(streak);
    }
  }
  if (newStatus === 'done' && t.recurrence) await regenerateRecurringTask(t);
};

// ── Récurrence automatique ──
// Quand une tâche récurrente est marquée terminée, on crée automatiquement
// la tâche suivante avec la date avancée selon le type de récurrence.
function getNextRecurrenceDate(dateStr, recurrence) {
  if (!dateStr || !recurrence) return null;
  const d = new Date(dateStr);

  // Rétrocompatibilité avec les anciennes tâches (récurrence en simple string)
  if (typeof recurrence === 'string') {
    if (recurrence === 'daily') { d.setDate(d.getDate()+1); return fmtDate(d); }
    if (recurrence === 'weekly') { d.setDate(d.getDate()+7); return fmtDate(d); }
    if (recurrence === 'monthly') { d.setMonth(d.getMonth()+1); return fmtDate(d); }
    return null;
  }

  if (recurrence.type === 'daily') {
    d.setDate(d.getDate() + 1);
    return fmtDate(d);
  }

  if (recurrence.type === 'weekdays') {
    const days = recurrence.days || [];
    if (days.length === 0) return null;
    // On cherche le prochain jour de la semaine sélectionné, en partant du lendemain
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(d); candidate.setDate(d.getDate() + i);
      if (days.includes(candidate.getDay())) return fmtDate(candidate);
    }
    return null;
  }

  if (recurrence.type === 'interval') {
    const n = parseInt(recurrence.interval) || 1;
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }

  if (recurrence.type === 'monthly') {
    d.setMonth(d.getMonth() + 1);
    return fmtDate(d);
  }

  if (recurrence.type === 'last-day-month') {
    // Dernier jour du mois SUIVANT (jour 0 du mois d'après = dernier jour du mois courant)
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 2, 0);
    return fmtDate(nextMonth);
  }

  return null;
}

async function regenerateRecurringTask(t) {
  const nextDate = getNextRecurrenceDate(t.date, t.recurrence);
  if (!nextDate) return;
  // Évite les doublons si la tâche suivante existe déjà (ex: double-clic, re-synchronisation)
  const alreadyExists = tasks.some(x =>
    x.id !== t.id && x.title === t.title && x.date === nextDate &&
    x.recurrence === t.recurrence && x.status !== 'deleted'
  );
  if (alreadyExists) return;

  const now = Date.now();
  const newId = _genId();
  const next = {
    id: newId,
    title: t.title,
    list: t.list || null,
    priority: t.priority || 0,
    content: t.content || '',
    date: nextDate,
    time: t.time || '',
    hours: t.hours || 0,
    alarm: !!t.alarm,
    color: t.color || '#2563eb',
    recurrence: t.recurrence,
    tags: [...(t.tags||[])],
    subtasks: (t.subtasks||[]).map(s => ({ text: s.text, done: false })),
    status: 'pending',
    uid: currentUser.uid,
    timestamp: now,
    updatedAt: now
  };
  await idbPut('tasks', next);
  tasks.unshift(next);
  await queuePush('create', 'tasks', newId, next);
  if (navigator.onLine) await window.queueFlush();
  showToast(`Prochaine occurrence créée pour ${fmt(nextDate)}`);
}

window.confirmDeleteTask = async (id) => {
  if (!confirm('Supprimer cette tâche ?')) return;
  const now = Date.now();
  const t = tasks.find(x => x.id === id);
  if (t) await idbPut('tasks', { ...t, status: 'deleted', deletedAt: now, updatedAt: now });
  tasks = tasks.map(x => x.id === id ? { ...x, status: 'deleted', deletedAt: now } : x);
  renderTaskList();
  if (taskViewMode === 'kanban') renderKanbanBoard();
  renderDashboard();
  await queuePush('delete', 'tasks', id, {});
  if (navigator.onLine) await window.queueFlush();
  showToast('Tâche déplacée dans la corbeille');
};

window.duplicateTask = async (id) => {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const now = Date.now();
  const newId = _genId();
  const copy = {
    id: newId,
    title: t.title,
    list: t.list || null,
    priority: t.priority || 0,
    content: t.content || '',
    date: '',
    time: t.time || '',
    hours: t.hours || 0,
    alarm: !!t.alarm,
    color: t.color || '#2563eb',
    recurrence: t.recurrence || null,
    tags: [...(t.tags||[])],
    subtasks: (t.subtasks||[]).map(s => ({ text: s.text, done: false })),
    status: 'pending',
    uid: currentUser.uid,
    timestamp: now,
    updatedAt: now
  };
  await idbPut('tasks', copy);
  tasks.unshift(copy);
  renderTaskList();
  await queuePush('create', 'tasks', newId, copy);
  if (navigator.onLine) await window.queueFlush();
  showToast('Tâche dupliquée — pense à lui donner une date');
};

// ── Task Modal ─────────────────────────────────────────────
let tempTaskTags = [];
let tempSubtasks = [];

// ── Saisie en langage naturel basique ──
// Détecte dans le titre : une date relative (demain, lundi...), une heure
// (18h, 18h30), un tag (#urgent) et une liste (@maison), puis remplit les
// champs correspondants automatiquement — sans jamais écraser un champ déjà
// rempli manuellement par l'utilisateur.
const WEEKDAYS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function parseNaturalLanguageInput() {
  const input = document.getElementById('task-title-input');
  let text = input.value;
  let touchedAdvanced = false;

  // Ne rien faire si le texte se termine par un espace — l'utilisateur
  // est en train de saisir un nouveau mot, on ne doit pas interférer.
  if (text.endsWith(' ')) return;

  // Ne rien faire si aucun mot-clé déclencheur n'est présent
  const hasKeyword = text.includes('#') || text.includes('@')
    || /\b\d{1,2}h\d*\b/i.test(text)
    || /\b(demain|aujourd'?hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|urgent)\b/i.test(text);
  if (!hasKeyword) return;

  const cursorPos = input.selectionStart;

  // Tag (#xxx) → ajouté à tempTaskTags s'il n'existe pas déjà
  const tagMatch = text.match(/#(\w+)/);
  if (tagMatch) {
    const tagVal = tagMatch[1];
    if (!tempTaskTags.includes(tagVal)) {
      tempTaskTags.push(tagVal);
      renderTagsPreview();
      touchedAdvanced = true;
    }
    text = text.replace(tagMatch[0], '').trim();
  }

  // Liste (@xxx) → remplit le champ liste seulement s'il est vide
  const listMatch = text.match(/@(\w+)/);
  if (listMatch) {
    const listField = document.getElementById('task-list-input');
    if (listField && !listField.value) { listField.value = listMatch[1]; touchedAdvanced = true; }
    text = text.replace(listMatch[0], '').trim();
  }

  // Heure (18h, 18h30, 9h)
  const timeMatch = text.match(/\b(\d{1,2})h(\d{2})?\b/i);
  if (timeMatch) {
    const timeField = document.getElementById('task-time-input');
    if (timeField && !timeField.value) {
      const hh = timeMatch[1].padStart(2,'0');
      const mm = (timeMatch[2] || '00').padStart(2,'0');
      timeField.value = `${hh}:${mm}`;
    }
    text = text.replace(timeMatch[0], '').trim();
  }

  // Date relative (aujourd'hui, demain, lundi, mardi...)
  const dateField = document.getElementById('task-date-input');
  if (dateField) {
    const lower = text.toLowerCase();
    if (/\bdemain\b/.test(lower)) {
      const d = new Date(); d.setDate(d.getDate()+1);
      dateField.value = fmtDate(d);
      text = text.replace(/\bdemain\b/i, '').trim();
    } else if (/\baujourd'?hui\b/.test(lower)) {
      dateField.value = fmtDate(new Date());
      text = text.replace(/\baujourd'?hui\b/i, '').trim();
    } else {
      const weekdayMatch = WEEKDAYS_FR.findIndex(day => new RegExp(`\\b${day}\\b`, 'i').test(lower));
      if (weekdayMatch !== -1) {
        const d = new Date();
        const todayIdx = d.getDay();
        let diff = (weekdayMatch - todayIdx + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        dateField.value = fmtDate(d);
        text = text.replace(new RegExp(`\\b${WEEKDAYS_FR[weekdayMatch]}\\b`, 'i'), '').trim();
      }
    }
  }

  // Priorité (urgent)
  if (/\burgent\b/i.test(text)) {
    document.querySelectorAll('.priority-opt').forEach(d => d.classList.toggle('selected', d.dataset.pri==='4'));
    text = text.replace(/\burgent\b/i, '').trim();
    touchedAdvanced = true;
  }

  if (touchedAdvanced) setTaskAdvancedOptions(true);

  // Nettoyage des espaces multiples — seulement si le texte a changé
  const cleaned = text.replace(/\s{2,}/g, ' ').trim();
  if (cleaned !== input.value) {
    input.value = cleaned;
    // Replacement du curseur sans dépasser la longueur du texte nettoyé
    const newPos = Math.min(cursorPos, cleaned.length);
    input.setSelectionRange(newPos, newPos);
  }
}

function setTaskAdvancedOptions(open) {
  const wrap = document.getElementById('task-advanced-options');
  const btn = document.getElementById('task-advanced-toggle');
  const label = document.getElementById('task-advanced-toggle-label');
  if (!wrap || !btn || !label) return;
  wrap.style.display = open ? 'block' : 'none';
  btn.classList.toggle('open', open);
  label.textContent = open ? 'Moins d\'options' : 'Plus d\'options';
}
window.toggleTaskAdvancedOptions = () => {
  const wrap = document.getElementById('task-advanced-options');
  setTaskAdvancedOptions(wrap.style.display === 'none');
};

window.openTaskModal = (id=null) => {
  editingTaskId = id;
  document.getElementById('task-title-input').classList.remove('error');
  document.getElementById('modal-title').textContent = id ? 'Modifier la tâche' : 'Nouvelle tâche';
  document.getElementById('delete-task-btn').style.display = id ? 'block' : 'none';
  renderTaskListSuggestions();
  if (id) {
    const t = tasks.find(x => x.id===id);
    if (!t) return;
    document.getElementById('task-title-input').value = t.title||'';
    document.getElementById('task-list-input').value = t.list||'';
    document.getElementById('task-content-input').value = t.content||'';
    document.getElementById('task-date-input').value = t.date||'';
    document.getElementById('task-time-input').value = t.time||'';
    // La durée totale (en heures décimales) est éclatée en heures entières + minutes
    const totalMinutes = Math.round((t.hours||0) * 60);
    document.getElementById('task-hours-input').value = Math.floor(totalMinutes / 60) || '';
    document.getElementById('task-minutes-input').value = (totalMinutes % 60) || '';
    document.getElementById('alarm-toggle').classList.toggle('on', !!t.alarm);
    document.getElementById('reminder-veille-toggle').classList.toggle('on', !!t.reminderVeille);
    document.getElementById('reminder-repeat-toggle').classList.toggle('on', !!t.reminderRepeat);
    document.getElementById('reminder-suboptions').style.display = t.alarm ? 'block' : 'none';
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.dataset.color===(t.color||'#2563eb')));
    restoreRecurrenceToForm(t.recurrence);
    document.querySelectorAll('.priority-opt').forEach(d => d.classList.toggle('selected', d.dataset.pri===String(t.priority||0)));
    tempTaskTags = [...(t.tags||[])];
    tempSubtasks = (t.subtasks||[]).map(s => ({...s}));
  } else {
    document.getElementById('task-title-input').value = '';
    document.getElementById('task-list-input').value = '';
    document.getElementById('task-content-input').value = '';
    document.getElementById('task-date-input').value = fmtDate(new Date());
    document.getElementById('task-time-input').value = '';
    document.getElementById('task-hours-input').value = '';
    document.getElementById('task-minutes-input').value = '';
    document.getElementById('alarm-toggle').classList.add('on');
    document.getElementById('reminder-veille-toggle').classList.remove('on');
    document.getElementById('reminder-repeat-toggle').classList.remove('on');
    document.getElementById('reminder-suboptions').style.display = 'block';
    document.querySelectorAll('.color-dot').forEach((d,i) => d.classList.toggle('selected', i===0));
    restoreRecurrenceToForm(null);
    document.querySelectorAll('.priority-opt').forEach(d => d.classList.toggle('selected', d.dataset.pri==='0'));
    tempTaskTags = [];
    tempSubtasks = [];
  }
  document.getElementById('task-tag-input').value = '';
  document.getElementById('subtask-input').value = '';
  renderTagsPreview();
  renderSubtaskPreview();
  // En édition, on affiche tout de suite les options avancées déjà utilisées
  // pour ne pas cacher des données existantes. En création, on part replié.
  setTaskAdvancedOptions(!!id);
  document.getElementById('task-modal').classList.add('open');
};

// Suggestions de listes existantes (datalist) basées sur les tâches déjà créées
function renderTaskListSuggestions() {
  const el = document.getElementById('task-list-suggestions');
  if (!el) return;
  const lists = [...new Set(tasks.map(t => t.list).filter(Boolean))];
  el.innerHTML = lists.map(l => `<option value="${escHtml(l)}"></option>`).join('');
}

window.selectPriority = (el) => {
  const wasSelected = el.classList.contains('selected');
  document.querySelectorAll('.priority-opt').forEach(d => d.classList.remove('selected'));
  // Clique sur la priorité déjà sélectionnée = la désélectionne (retour à "Aucune")
  if (!wasSelected) el.classList.add('selected');
  else document.querySelector('.priority-opt[data-pri="0"]').classList.add('selected');
};

window.closeTaskModal = () => { document.getElementById('task-modal').classList.remove('open'); editingTaskId=null; tempTaskTags=[]; tempSubtasks=[]; };

window.selectColor = (el) => {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
};

window.selectRecurrence = (el) => {
  document.querySelectorAll('.recurrence-opt').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  const rec = el.dataset.rec;
  document.getElementById('recurrence-weekdays-picker').style.display = rec === 'weekdays' ? 'block' : 'none';
  document.getElementById('recurrence-interval-picker').style.display = rec === 'interval' ? 'block' : 'none';
};

window.toggleReminderSubOptions = () => {
  const enabled = document.getElementById('alarm-toggle').classList.contains('on');
  document.getElementById('reminder-suboptions').style.display = enabled ? 'block' : 'none';
};

window.toggleWeekday = (el) => {
  el.classList.toggle('selected');
};

// Construit l'objet récurrence structuré à partir des champs du modal
function buildRecurrenceFromForm() {
  const selected = document.querySelector('.recurrence-opt.selected')?.dataset.rec;
  if (!selected) return null;
  if (selected === 'daily') return { type: 'daily' };
  if (selected === 'monthly') return { type: 'monthly' };
  if (selected === 'last-day-month') return { type: 'last-day-month' };
  if (selected === 'weekdays') {
    const days = [...document.querySelectorAll('.weekday-opt.selected')].map(d => parseInt(d.dataset.day));
    return days.length > 0 ? { type: 'weekdays', days } : null;
  }
  if (selected === 'interval') {
    const n = parseInt(document.getElementById('recurrence-interval-input').value) || 2;
    return { type: 'interval', interval: n };
  }
  return null;
}

// Restaure les champs du modal à partir d'un objet récurrence existant (édition)
function restoreRecurrenceToForm(rec) {
  document.getElementById('recurrence-weekdays-picker').style.display = 'none';
  document.getElementById('recurrence-interval-picker').style.display = 'none';
  document.querySelectorAll('.weekday-opt').forEach(d => d.classList.remove('selected'));

  let recKey = '';
  if (rec) {
    if (typeof rec === 'string') recKey = rec === 'weekly' ? 'weekdays' : rec; // rétrocompat
    else recKey = rec.type;
  }
  document.querySelectorAll('.recurrence-opt').forEach(d => d.classList.toggle('selected', d.dataset.rec === recKey));

  if (recKey === 'weekdays' && rec.days) {
    document.getElementById('recurrence-weekdays-picker').style.display = 'block';
    document.querySelectorAll('.weekday-opt').forEach(d => {
      if (rec.days.includes(parseInt(d.dataset.day))) d.classList.add('selected');
    });
  } else if (recKey === 'interval') {
    document.getElementById('recurrence-interval-picker').style.display = 'block';
    document.getElementById('recurrence-interval-input').value = rec.interval || 2;
  }
}

// Limite les champs heures/minutes à des valeurs cohérentes (max 24h au total)
window.clampDurationFields = () => {
  const hEl = document.getElementById('task-hours-input');
  const mEl = document.getElementById('task-minutes-input');
  let h = parseInt(hEl.value) || 0;
  let m = parseInt(mEl.value) || 0;
  if (h > 24) h = 24;
  if (h < 0) h = 0;
  if (m > 59) m = 59;
  if (m < 0) m = 0;
  if (h === 24) m = 0; // 24h00 max, pas 24h59
  hEl.value = h || '';
  mEl.value = m || '';
};

window.addTaskTag = () => {
  const input = document.getElementById('task-tag-input');
  const val = input.value.trim();
  if (!val) return;
  if (!tempTaskTags.includes(val)) tempTaskTags.push(val);
  input.value = '';
  renderTagsPreview();
};

function renderTagsPreview() {
  const el = document.getElementById('task-tags-preview');
  el.innerHTML = tempTaskTags.map((tag, i) => `
    <span class="task-tag-chip removable">${escHtml(tag)} <i class="fa-solid fa-xmark" onclick="removeTaskTag(${i})"></i></span>`).join('');
}
window.removeTaskTag = (i) => { tempTaskTags.splice(i,1); renderTagsPreview(); };

window.addSubtask = () => {
  const input = document.getElementById('subtask-input');
  const val = input.value.trim();
  if (!val) return;
  tempSubtasks.push({ text: val, done: false });
  input.value = '';
  renderSubtaskPreview();
};

function renderSubtaskPreview() {
  const el = document.getElementById('subtask-preview-list');
  if (tempSubtasks.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = tempSubtasks.map((s, i) => `
    <div class="subtask-preview-item">
      <span>${escHtml(s.text)}</span>
      <i class="fa-solid fa-xmark" onclick="removeSubtask(${i})"></i>
    </div>`).join('');
}
window.removeSubtask = (i) => { tempSubtasks.splice(i,1); renderSubtaskPreview(); };

window.saveTask = async () => {
  const titleInput = document.getElementById('task-title-input');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('error');
    titleInput.focus();
    showToast('⚠️ Le titre est obligatoire');
    return;
  }
  titleInput.classList.remove('error');
  const h = parseInt(document.getElementById('task-hours-input').value) || 0;
  const m = parseInt(document.getElementById('task-minutes-input').value) || 0;
  const now = Date.now();

  // Capturer editingTaskId AVANT closeTaskModal qui le remet à null
  const taskIdToEdit = editingTaskId;

  const data = {
    title,
    list: document.getElementById('task-list-input').value.trim() || null,
    priority: parseInt(document.querySelector('.priority-opt.selected')?.dataset.pri || '0'),
    content: document.getElementById('task-content-input').value.trim(),
    date: document.getElementById('task-date-input').value,
    time: document.getElementById('task-time-input').value,
    hours: Math.round((h + m/60) * 100) / 100,
    alarm: document.getElementById('alarm-toggle').classList.contains('on'),
    reminderVeille: document.getElementById('reminder-veille-toggle').classList.contains('on'),
    reminderRepeat: document.getElementById('reminder-repeat-toggle').classList.contains('on'),
    color: document.querySelector('.color-dot.selected')?.dataset.color||'#2563eb',
    recurrence: buildRecurrenceFromForm(),
    tags: [...tempTaskTags],
    subtasks: tempSubtasks.map(s => ({...s})),
    uid: currentUser.uid,
    updatedAt: now
  };

  // Fermer le modal immédiatement — avant tout await
  closeTaskModal();

  if (taskIdToEdit) {
    const existing = tasks.find(x => x.id === taskIdToEdit) || {};
    const updated = { ...existing, ...data, id: taskIdToEdit };
    await idbPut('tasks', updated);
    tasks = tasks.map(x => x.id === taskIdToEdit ? updated : x);
    renderTaskList();
    if (taskViewMode === 'kanban') renderKanbanBoard();
    renderDashboard();
    await queuePush('update', 'tasks', taskIdToEdit, data);
    if (navigator.onLine) await window.queueFlush();
    showToast('Tâche modifiée');

  } else {
    const newId = _genId();
    const newTask = { ...data, id: newId, status: 'pending', timestamp: now };
    await idbPut('tasks', newTask);
    tasks.unshift(newTask);
    renderTaskList();
    if (taskViewMode === 'kanban') renderKanbanBoard();
    renderDashboard();
    await queuePush('create', 'tasks', newId, newTask);
    if (navigator.onLine) await window.queueFlush();
    const wasFirst = typeof notifyFirstTaskCreated === 'function' ? await notifyFirstTaskCreated() : false;
    if (!wasFirst) {
      showToast('Tâche ajoutée');
    } else if (typeof maybeOfferStudentMode === 'function') {
      setTimeout(maybeOfferStudentMode, 5000);
    }
  }
};

// Génère un id unique côté client (22 chars, URL-safe)
function _genId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const arr = new Uint8Array(22);
  crypto.getRandomValues(arr);
  arr.forEach(b => id += chars[b % chars.length]);
  return id;
}

window.deleteCurrentTask = async () => {
  if (!editingTaskId) return;
  const now = Date.now();
  const t = tasks.find(x => x.id === editingTaskId);
  if (t) await idbPut('tasks', { ...t, status: 'deleted', deletedAt: now, updatedAt: now });
  tasks = tasks.map(x => x.id === editingTaskId ? { ...x, status: 'deleted', deletedAt: now } : x);
  closeTaskModal();
  renderTaskList();
  if (taskViewMode === 'kanban') renderKanbanBoard();
  renderDashboard();
  await queuePush('delete', 'tasks', editingTaskId, {});
  if (navigator.onLine) await window.queueFlush();
  showToast('Tâche déplacée dans la corbeille');
};

// ── Alarms ─────────────────────────────────────────────────
function scheduleAllAlarms() {
  // On annule tous les setTimeout JS locaux : seul le Service Worker programme
  // désormais les alarmes, pour éviter d'avoir 2 mécanismes qui déclenchent
  // chacun leur propre notification pour la même tâche (bug de doublon).
  Object.values(alarmTimers).forEach(clearTimeout);
  alarmTimers = {};
  const now = Date.now();

  navigator.serviceWorker.ready.then(reg => {
    tasks.forEach(t => {
      if (t.status !== 'pending' || !t.date) return;

      // Si la tâche est terminée ou supprimée entre-temps, on annule tout rappel répété en cours
      if (t.status !== 'pending') {
        reg.active?.postMessage({ type:'CANCEL_ALARM', taskId: `${t.id}-repeat` });
        return;
      }
      if (!t.alarm) return;

      // 1. Rappel 5 minutes avant (nécessite une heure précise)
      if (t.time) {
        const delay5min = new Date(t.date+'T'+t.time).getTime() - 5*60*1000 - now;
        if (delay5min > 0 && delay5min < 86400000) {
          reg.active?.postMessage({ type:'SCHEDULE_ALARM', taskId: `${t.id}-5min`, title:`⏰ ${t.title}`, body:'Dans 5 minutes !', delay: delay5min });
        } else if (delay5min <= 0) {
          reg.active?.postMessage({ type:'CANCEL_ALARM', taskId: `${t.id}-5min` });
        }
      }

      // 2. Rappel "veille" : 1 jour avant, à la même heure (ou 9h si pas d'heure précisée)
      if (t.reminderVeille) {
        const taskMoment = new Date(t.date + 'T' + (t.time || '09:00'));
        const veilleMoment = new Date(taskMoment.getTime() - 24*60*60*1000);
        const delayVeille = veilleMoment.getTime() - now;
        if (delayVeille > 0 && delayVeille < 86400000) {
          reg.active?.postMessage({ type:'SCHEDULE_ALARM', taskId: `${t.id}-veille`, title:`📅 Demain : ${t.title}`, body:'Cette tâche est prévue demain', delay: delayVeille });
        }
      }

      
      if (t.reminderRepeat) {
        reg.active?.postMessage({ type:'SCHEDULE_REPEAT_ALARM', taskId: `${t.id}-repeat`, title:`🔁 Toujours en attente : ${t.title}`, body:'Cette tâche n\'est pas encore terminée', intervalMs: 60*60*1000 });
      } else {
        reg.active?.postMessage({ type:'CANCEL_ALARM', taskId: `${t.id}-repeat` });
      }
    });
  });
}

function sendLocalNotif(title, body) {
  if (Notification.permission==='granted') {
    new Notification(title, { body, icon:'/icons/icon-192-v2.png', badge:'/icons/icon-72-v2.png', vibrate:[300,100,300] });
  }
}

