function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = new Date();
  document.getElementById('cal-month-label').textContent = calendarDate.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  document.getElementById('cal-day-names').innerHTML = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<div class="cal-day-name">${d}</div>`).join('');

  const first = new Date(year, month, 1);
  let startDay = first.getDay()-1; if(startDay<0) startDay=6;
  const daysInMonth = new Date(year,month+1,0).getDate();
  const daysInPrev = new Date(year,month,0).getDate();
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  for (let i=0;i<startDay;i++) grid.innerHTML+=`<div class="cal-day other-month">${daysInPrev-startDay+1+i}</div>`;
  for (let d=1;d<=daysInMonth;d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasTasks = tasks.some(t => t.date===ds && t.status!=='deleted');
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    grid.innerHTML+=`<div class="cal-day ${isToday?'today':''} ${hasTasks?'has-tasks':''}" onclick="calDayClick('${ds}')">${d}</div>`;
  }
  renderTodayTasks();
  renderHistory();
}

function renderTodayTasks() {
  const el = document.getElementById('today-tasks-list');
  if (!el) return;
  const todayStr = fmtDate(new Date());
  const todayTasks = tasks.filter(t => t.date === todayStr && t.status !== 'deleted');

  if (todayTasks.length === 0) {
    el.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:6px 0;">Aucune tâche prévue aujourd'hui</div>`;
    return;
  }
  el.innerHTML = todayTasks.map(taskHTML).join('');
}

window.calDayClick = (dateStr) => {
  goTo('tasks');
  setTimeout(() => {
    const filtered = tasks.filter(t => t.date===dateStr && t.status!=='deleted');
    const el = document.getElementById('task-list');
    if (filtered.length===0) el.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Aucune tâche ce jour</div></div>`;
    else el.innerHTML = filtered.map(taskHTML).join('');
  }, 150);
};

window.changeMonth = (dir) => { calendarDate.setMonth(calendarDate.getMonth()+dir); renderCalendar(); };

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  let filtered = [];
  if (currentHistoryFilter==='done') filtered = tasks.filter(t => t.status==='done');
  else if (currentHistoryFilter==='deleted') filtered = tasks.filter(t => t.status==='deleted');
  else if (currentHistoryFilter==='missed') filtered = tasks.filter(t => t.status==='missed'||(t.status==='pending'&&isPastDue(t)));
  else if (currentHistoryFilter==='skipped') filtered = tasks.filter(t => t.status==='skipped');
  filtered.sort((a,b) => {
    const da = a.updatedAt?.toDate?.() || new Date(a.date||0);
    const db2 = b.updatedAt?.toDate?.() || new Date(b.date||0);
    return db2-da;
  });
  if (filtered.length===0) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">Aucune tâche ici</div></div>`; return; }

  if (currentHistoryFilter === 'deleted') {
    el.innerHTML = filtered.map(deletedTaskHTML).join('');
  } else {
    el.innerHTML = filtered.map(taskHTML).join('');
  }
}

// Carte spéciale pour les tâches supprimées : lecture seule, juste un bouton Récupérer
function deletedTaskHTML(t) {
  const color = t.color || '#2563eb';
  return `
  <div class="task-item fade-in" style="background:${hexToRgba(color,0.06)};border-color:${hexToRgba(color,0.2)};opacity:0.85;">
    <div class="task-color-bar" style="background:${color}"></div>
    <div style="padding-left:8px;display:flex;gap:12px;align-items:center;width:100%;">
      <div class="task-body">
        <div class="task-title" style="margin-bottom:0;">${escHtml(t.title)}</div>
        <div class="task-meta">
          ${t.date?`<span class="task-tag">📅 ${fmt(t.date)}${t.time?' '+t.time:''}</span>`:''}
          <span class="task-tag" style="background:#ef444422;color:#ef4444;">🗑️ Supprimée</span>
        </div>
      </div>
      <button class="task-recover-btn" onclick="recoverTask('${t.id}')"><i class="fa-solid fa-rotate-left"></i> Récupérer</button>
    </div>
  </div>`;
}

window.recoverTask = async (id) => {
  await updateDoc(doc(db,'tasks',id), { status: 'pending', deletedAt: null, updatedAt: serverTimestamp() });
  showToast('Tâche récupérée');
};

window.filterHistory = (f, el) => {
  currentHistoryFilter = f;
  document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderHistory();
};

