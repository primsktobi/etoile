// ══════════════════════════════════════════════════════════════════════════════
//  STUDENT.JS — Module Étudiant
//  Programme hebdomadaire intelligent avec sessions d'étude auto-générées
// ══════════════════════════════════════════════════════════════════════════════

// ── State ───────────────────────────────────────────────────────────────────
let studentPrefs = null;
let studentSchedule = {};
let studentSubjects = [];
// [ { id, name, color, chapters: [ {id, name, status:'unseen'|'inprogress'|'mastered'} ] } ]

let editingCourseDay    = null;
let editingCourseId     = null;
let selectedCourseType  = 'cours';
let selectedCourseImp   = 'high';
let selectedCourseColor = '#2563eb';
let editingSubjectId    = null;
let studentActiveTab    = 'schedule'; // 'schedule' | 'subjects'

const DAYS_FR   = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_EN   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const HOURS_START = 6;
const HOURS_END   = 23;
const PX_PER_MIN  = 1.2;

const SUBJECT_COLORS = [
  '#2563eb','#dc2626','#16a34a','#f97316',
  '#a855f7','#0ea5e9','#db2777','#65a30d'
];

// ── Navigation ───────────────────────────────────────────────────────────────
window.goToStudent = async () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-student').classList.add('active');
  document.getElementById('fab-add').style.display = 'none';
  document.getElementById('topbar-title').textContent = '🎓 Étudiant';
  await loadStudentData();
  if (!studentPrefs?.onboardingDone) {
    startOnboarding();
  } else {
    renderStudentSchedule();
  }
};

// ── Chargement ───────────────────────────────────────────────────────────────
async function loadStudentData() {
  const cachedPrefs    = await idbGet('prefs', 'studentPrefs');
  const cachedSchedule = await idbGet('prefs', 'studentSchedule');
  const cachedSubjects = await idbGet('prefs', 'studentSubjects');
  if (cachedPrefs?.value)    studentPrefs    = cachedPrefs.value;
  if (cachedSchedule?.value) studentSchedule = cachedSchedule.value;
  if (cachedSubjects?.value) studentSubjects = cachedSubjects.value;
  if (currentUser) {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.studentPrefs)    studentPrefs    = d.studentPrefs;
        if (d.studentSchedule) studentSchedule = d.studentSchedule;
        if (d.studentSubjects) studentSubjects = d.studentSubjects;
        await idbPut('prefs', { key: 'studentPrefs',    value: studentPrefs });
        await idbPut('prefs', { key: 'studentSchedule', value: studentSchedule });
        await idbPut('prefs', { key: 'studentSubjects', value: studentSubjects });
      }
    } catch(e) {}
  }
}

async function saveStudentData() {
  await idbPut('prefs', { key: 'studentPrefs',    value: studentPrefs });
  await idbPut('prefs', { key: 'studentSchedule', value: studentSchedule });
  await idbPut('prefs', { key: 'studentSubjects', value: studentSubjects });
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), {
      studentPrefs, studentSchedule, studentSubjects
    }).catch(() => {});
  }
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    emoji: '🎓',
    title: 'Bienvenue, étudiant.',
    sub: 'Trivo va construire ton programme de la semaine automatiquement.\nTu n\'as qu\'à ajouter tes cours — le reste, c\'est nous.',
    type: 'intro'
  },
  {
    emoji: '🌅',
    title: 'Tu préfères étudier quand ?',
    sub: 'On va planifier tes sessions d\'étude selon ta préférence.',
    type: 'choice',
    key: 'studyTime',
    options: [
      { value: 'morning', label: '🌅 Tôt le matin', sub: 'Avant les cours ou en début de journée' },
      { value: 'evening', label: '🌙 Le soir',      sub: 'Après les cours, quand tu es rentré' }
    ]
  },
  {
    emoji: '🚌',
    title: 'Combien de temps pour aller à l\'école ?',
    sub: 'En minutes. On en tiendra compte pour ton réveil et tes horaires.',
    type: 'number',
    key: 'travelTo',
    placeholder: 'Ex: 30',
    unit: 'minutes'
  },
  {
    emoji: '🏠',
    title: 'Et pour rentrer chez toi ?',
    sub: 'En minutes après la fin des cours.',
    type: 'number',
    key: 'travelFrom',
    placeholder: 'Ex: 45',
    unit: 'minutes'
  },
  {
    emoji: '📚',
    title: 'Combien d\'heures d\'étude les jours ordinaires ?',
    sub: 'Lundi au jeudi — les jours chargés.',
    type: 'number',
    key: 'studyHoursWeekday',
    placeholder: 'Ex: 2',
    unit: 'heures'
  },
  {
    emoji: '🧘',
    title: 'Et les jours plus légers ?',
    sub: 'Vendredi, samedi, dimanche — un peu de liberté.',
    type: 'number',
    key: 'studyHoursLight',
    placeholder: 'Ex: 1',
    unit: 'heures'
  },
  {
    emoji: '✅',
    title: 'Tout est prêt.',
    sub: 'Ajoute maintenant tes cours dans le programme. Trivo s\'occupe du reste — réveil, étude, temps libre.',
    type: 'finish'
  }
];

let onboardingStep = 0;
let onboardingAnswers = {};

function startOnboarding() {
  onboardingStep = 0;
  onboardingAnswers = {};
  const overlay = document.getElementById('student-onboarding');
  overlay.style.display = 'flex';
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStep];
  const total = ONBOARDING_STEPS.length;

  // Progress dots
  const progressEl = document.getElementById('onboarding-progress');
  progressEl.innerHTML = ONBOARDING_STEPS.map((_, i) =>
    `<div class="onboarding-dot ${i <= onboardingStep ? 'done' : ''}"></div>`
  ).join('');

  const wrap = document.getElementById('onboarding-steps-wrap');
  let html = `
    <div class="onboarding-step active">
      <div class="onboarding-emoji">${step.emoji}</div>
      <div class="onboarding-title">${step.title}</div>
      <div class="onboarding-sub">${step.sub.replace(/\n/g, '<br>')}</div>`;

  if (step.type === 'choice') {
    html += `<div class="onboarding-options">
      ${step.options.map(o => `
        <div class="onboarding-option ${onboardingAnswers[step.key]===o.value?'selected':''}"
             onclick="selectOnboardingChoice('${step.key}','${o.value}',this)">
          ${o.label}<br><span style="font-size:12px;opacity:0.7;">${o.sub}</span>
        </div>`).join('')}
    </div>`;
    html += `<button class="onboarding-next" onclick="nextOnboardingStep()" style="margin-top:16px;">Continuer →</button>`;
  } else if (step.type === 'number') {
    html += `<input class="onboarding-input" type="number" min="1" max="120"
      id="onboarding-number-input" value="${onboardingAnswers[step.key]||''}"
      placeholder="${step.placeholder}" />
    <div style="font-size:13px;color:var(--text3);margin-top:6px;">${step.unit}</div>
    <button class="onboarding-next" onclick="nextOnboardingStepNumber('${step.key}')">Continuer →</button>`;
  } else if (step.type === 'finish') {
    html += `<button class="onboarding-next" onclick="finishOnboarding()">Voir mon programme 🎓</button>`;
  } else {
    html += `<button class="onboarding-next" onclick="nextOnboardingStep()">Commencer →</button>`;
  }

  html += `</div>`;
  wrap.innerHTML = html;

  if (step.type === 'number') {
    setTimeout(() => document.getElementById('onboarding-number-input')?.focus(), 300);
  }
}

window.selectOnboardingChoice = (key, value, el) => {
  onboardingAnswers[key] = value;
  el.closest('.onboarding-options').querySelectorAll('.onboarding-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
};

window.nextOnboardingStep = () => {
  const step = ONBOARDING_STEPS[onboardingStep];
  if (step.type === 'choice' && !onboardingAnswers[step.key]) {
    showToast('Fais un choix pour continuer'); return;
  }
  onboardingStep++;
  if (onboardingStep < ONBOARDING_STEPS.length) renderOnboardingStep();
};

window.nextOnboardingStepNumber = (key) => {
  const val = parseInt(document.getElementById('onboarding-number-input')?.value);
  if (!val || val < 1) { showToast('Entre un nombre valide'); return; }
  onboardingAnswers[key] = val;
  onboardingStep++;
  if (onboardingStep < ONBOARDING_STEPS.length) renderOnboardingStep();
};

window.finishOnboarding = async () => {
  studentPrefs = {
    studyTime:         onboardingAnswers.studyTime || 'evening',
    travelTo:          onboardingAnswers.travelTo  || 30,
    travelFrom:        onboardingAnswers.travelFrom || 45,
    studyHoursWeekday: onboardingAnswers.studyHoursWeekday || 2,
    studyHoursLight:   onboardingAnswers.studyHoursLight   || 1,
    onboardingDone:    true
  };
  if (!studentSchedule || !Object.keys(studentSchedule).length) {
    studentSchedule = {};
    DAYS_EN.forEach(d => { studentSchedule[d] = []; });
  }
  await saveStudentData();
  document.getElementById('student-onboarding').style.display = 'none';
  renderStudentSchedule();
  showToast('Programme créé. Ajoute maintenant tes cours.');
};

// ── RENDU DU PROGRAMME ────────────────────────────────────────────────────────
function renderStudentSchedule() {
  const scheduleEl = document.getElementById('student-schedule');
  const labelsEl   = document.getElementById('student-hour-labels');
  if (!scheduleEl) return;

  const totalH   = HOURS_END - HOURS_START;
  const totalPx  = totalH * 60 * PX_PER_MIN;

  // Étiquettes heures
  if (labelsEl) {
    labelsEl.style.height = totalPx + 40 + 'px';
    labelsEl.innerHTML = '';
    for (let h = HOURS_START; h <= HOURS_END; h++) {
      const top = (h - HOURS_START) * 60 * PX_PER_MIN;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;top:${top}px;font-size:8px;color:var(--text3);right:2px;transform:translateY(-50%);`;
      el.textContent = `${h}h`;
      labelsEl.appendChild(el);
    }
  }

  // Colonnes jours
  const today = new Date().getDay(); // 0=dim, 1=lun...
  scheduleEl.innerHTML = '';
  DAYS_EN.forEach((dayKey, idx) => {
    const jsDayIdx = idx === 6 ? 0 : idx + 1; // lundi=1,..., dimanche=0
    const isToday = today === jsDayIdx;
    const blocks = (studentSchedule[dayKey] || [])
      .concat(getAutoStudyBlocks(dayKey));

    const col = document.createElement('div');
    col.className = 'student-day-col';
    col.innerHTML = `<div class="student-day-header ${isToday?'today':''}">${DAYS_FR[idx].slice(0,3)}</div>
      <div class="student-timeline" style="height:${totalPx}px;" id="timeline-${dayKey}"></div>`;
    scheduleEl.appendChild(col);

    // Lignes d'heure
    const timeline = col.querySelector(`#timeline-${dayKey}`);
    for (let h = HOURS_START; h <= HOURS_END; h++) {
      const line = document.createElement('div');
      line.className = 'student-hour-line';
      line.style.top = (h - HOURS_START) * 60 * PX_PER_MIN + 'px';
      timeline.appendChild(line);
    }

    // Slot cliquable (toute la colonne)
    const slotOverlay = document.createElement('div');
    slotOverlay.style.cssText = `position:absolute;inset:0;z-index:1;`;
    slotOverlay.onclick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutes = Math.round(y / PX_PER_MIN / 30) * 30;
      const h = HOURS_START + Math.floor(minutes / 60);
      const m = minutes % 60;
      openAddCourseModal(dayKey, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    };
    timeline.appendChild(slotOverlay);

    // Blocs
    blocks.forEach(block => {
      const el = buildBlockElement(block, dayKey);
      if (el) timeline.appendChild(el);
    });
  });
}

function buildBlockElement(block, dayKey) {
  const startMin = timeToMin(block.start);
  const endMin   = timeToMin(block.end);
  if (startMin < HOURS_START * 60 || endMin > HOURS_END * 60) return null;

  const top    = (startMin - HOURS_START * 60) * PX_PER_MIN;
  const height = Math.max((endMin - startMin) * PX_PER_MIN, 20);

  const el = document.createElement('div');
  el.className = `student-block ${block.autoGenerated?'study':''} ${block.importance?'imp-'+block.importance:''}`;
  el.style.cssText = `top:${top}px;height:${height}px;z-index:2;`;
  if (block.color && !block.autoGenerated) el.style.background = block.color;
  if (block.autoGenerated) {
    el.style.background = 'linear-gradient(135deg,#1d4ed8,#1e40af)';
    el.style.borderLeft  = '3px solid #60a5fa';
  }

  el.innerHTML = `<div class="block-title">${block.name}</div>
    <div class="block-time">${block.start}–${block.end}</div>`;

  if (!block.autoGenerated) {
    el.style.zIndex = '3';
    el.onclick = (e) => { e.stopPropagation(); openEditCourseModal(dayKey, block.id); };
  }
  return el;
}

// ── AUTO-GÉNÉRATION DES SESSIONS D'ÉTUDE ─────────────────────────────────────
function getAutoStudyBlocks(dayKey) {
  if (!studentPrefs) return [];
  const dayIdx  = DAYS_EN.indexOf(dayKey);
  const isLight = dayIdx >= 4; // ven=4, sam=5, dim=6
  const studyH  = isLight ? studentPrefs.studyHoursLight : studentPrefs.studyHoursWeekday;
  const courses = (studentSchedule[dayKey] || []).filter(b => b.type === 'cours');

  if (!courses.length || studyH <= 0) return [];

  courses.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  const lastCourse = courses[courses.length - 1];
  const returnMin  = timeToMin(lastCourse.end) + studentPrefs.travelFrom;

  // Important : on laisse 1h30 de buffer après le retour (douche, repas, etc.)
  const bufferMin  = returnMin + 90;

  // Trouver les trous dans le programme (pauses entre cours) — on ne les utilise pas
  const studyStart = studentPrefs.studyTime === 'morning'
    ? courses[0] ? timeToMin(courses[0].start) - studentPrefs.travelTo - studyH * 60 - 30 : 6 * 60
    : bufferMin;

  if (studyStart < HOURS_START * 60 || studyStart + studyH * 60 > HOURS_END * 60) return [];

  const start = minToTime(studyStart);
  const end   = minToTime(studyStart + studyH * 60);

  return [{
    id: `auto-study-${dayKey}`,
    type: 'study',
    name: 'Révision',
    start, end,
    autoGenerated: true
  }];
}

// ── GÉNÉRATION DES TÂCHES D'ÉTUDE DANS TRIVO ─────────────────────────────────
window.generateStudyPlan = async () => {
  if (!studentPrefs?.onboardingDone) return;
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // lundi

  let addedCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    const dayKey   = DAYS_EN[i];
    const dateStr  = window.fmtDate ? window.fmtDate(d) : d.toISOString().slice(0,10);
    const autoBlocks = getAutoStudyBlocks(dayKey);

    for (const block of autoBlocks) {
      // Vérifier si une tâche d'étude existe déjà pour ce jour
      const alreadyExists = tasks.some(t =>
        t.date === dateStr && t.studentStudy === true && t.studentDay === dayKey
      );
      if (alreadyExists) continue;

      const now   = Date.now();
      const newId = `study-${dayKey}-${now}-${Math.random().toString(36).slice(2,6)}`;
      const newTask = {
        id: newId, uid: currentUser.uid,
        title: `Révision — ${DAYS_FR[i]}`,
        content: `Session d'étude automatique : ${block.start} – ${block.end}`,
        date: dateStr, time: block.start,
        status: 'pending', color: '#1d4ed8',
        studentStudy: true, studentDay: dayKey,
        timestamp: now, updatedAt: now
      };
      await idbPut('tasks', newTask);
      tasks.unshift(newTask);
      await queuePush('create', 'tasks', newId, newTask);
      addedCount++;
    }
  }
  if (navigator.onLine) await window.queueFlush();
  renderTaskList?.();
  showToast(addedCount > 0 ? `${addedCount} session${addedCount>1?'s':''} d'étude ajoutée${addedCount>1?'s':''} à tes tâches` : 'Programme à jour');
};

// ── MODAL AJOUT / MODIFICATION COURS ─────────────────────────────────────────
window.openAddCourseModal = (dayKey, defaultStart = '08:00') => {
  editingCourseDay = dayKey;
  editingCourseId  = null;
  selectedCourseType  = 'cours';
  selectedCourseImp   = 'high';
  selectedCourseColor = '#2563eb';

  document.getElementById('course-modal-title').textContent = `Ajouter — ${DAYS_FR[DAYS_EN.indexOf(dayKey)]}`;
  document.getElementById('course-name-input').value = '';
  document.getElementById('course-start-input').value = defaultStart;
  document.getElementById('course-end-input').value = addMinutes(defaultStart, 60);
  document.getElementById('course-delete-btn').style.display = 'none';
  document.getElementById('course-importance-wrap').style.opacity = '1';
  selectCourseType('cours');
  document.getElementById('student-course-modal').classList.add('open');
};

window.openEditCourseModal = (dayKey, courseId) => {
  const course = (studentSchedule[dayKey] || []).find(c => c.id === courseId);
  if (!course) return;

  editingCourseDay    = dayKey;
  editingCourseId     = courseId;
  selectedCourseType  = course.type;
  selectedCourseImp   = course.importance || 'high';
  selectedCourseColor = course.color || '#2563eb';

  document.getElementById('course-modal-title').textContent = `Modifier — ${DAYS_FR[DAYS_EN.indexOf(dayKey)]}`;
  document.getElementById('course-name-input').value  = course.name;
  document.getElementById('course-start-input').value = course.start;
  document.getElementById('course-end-input').value   = course.end;
  document.getElementById('course-delete-btn').style.display = 'block';
  selectCourseType(course.type);
  // Sélectionner l'importance
  document.querySelectorAll('.course-imp-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.imp === selectedCourseImp);
  });
  document.getElementById('student-course-modal').classList.add('open');
};

window.selectCourseType = (type) => {
  selectedCourseType = type;
  document.getElementById('course-type-cours')?.classList.toggle('selected', type === 'cours');
  document.getElementById('course-type-autre')?.classList.toggle('selected', type === 'autre');
  const impWrap = document.getElementById('course-importance-wrap');
  if (impWrap) impWrap.style.opacity = type === 'cours' ? '1' : '0.4';
};

window.selectCourseImp = (imp, el) => {
  selectedCourseImp = imp;
  document.querySelectorAll('.course-imp-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
};

window.selectCourseColor = (color, el) => {
  selectedCourseColor = color;
  document.querySelectorAll('#course-color-picker .color-dot').forEach(d => {
    d.style.border = d.dataset.color === color ? '2px solid #fff' : '2px solid transparent';
  });
};

window.saveCourseBlock = async () => {
  const name  = document.getElementById('course-name-input').value.trim();
  const start = document.getElementById('course-start-input').value;
  const end   = document.getElementById('course-end-input').value;

  if (!name)  { showToast('Entre un nom'); return; }
  if (!start || !end) { showToast('Entre les heures'); return; }
  if (timeToMin(start) >= timeToMin(end)) { showToast('L\'heure de fin doit être après le début'); return; }

  if (!studentSchedule[editingCourseDay]) studentSchedule[editingCourseDay] = [];

  if (editingCourseId) {
    studentSchedule[editingCourseDay] = studentSchedule[editingCourseDay].map(c =>
      c.id === editingCourseId
        ? { ...c, name, start, end, type: selectedCourseType, importance: selectedCourseType==='cours'?selectedCourseImp:'other', color: selectedCourseColor }
        : c
    );
  } else {
    const newId = `course-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    studentSchedule[editingCourseDay].push({
      id: newId, name, start, end,
      type: selectedCourseType,
      importance: selectedCourseType === 'cours' ? selectedCourseImp : 'other',
      color: selectedCourseColor
    });
  }

  await saveStudentData();
  closeModal('student-course-modal');
  renderStudentSchedule();
};

window.deleteCourseBlock = async () => {
  if (!editingCourseId || !editingCourseDay) return;
  if (!confirm('Supprimer ce cours ?')) return;
  studentSchedule[editingCourseDay] = (studentSchedule[editingCourseDay] || [])
    .filter(c => c.id !== editingCourseId);
  await saveStudentData();
  closeModal('student-course-modal');
  renderStudentSchedule();
};

// ── PARAMÈTRES ÉTUDIANT ───────────────────────────────────────────────────────
window.openStudentSettings = () => {
  const panel = document.getElementById('student-settings-panel');
  if (!panel) return;
  renderStudentSettingsContent();
  panel.classList.add('open');
};

window.closeStudentSettings = () => {
  document.getElementById('student-settings-panel')?.classList.remove('open');
};

function renderStudentSettingsContent() {
  const el = document.getElementById('student-settings-content');
  if (!el || !studentPrefs) return;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px;">

      <div class="card" style="padding:16px;">
        <div class="field-label" style="margin-bottom:10px;">Heure d'étude préférée</div>
        <div style="display:flex;gap:10px;">
          <button class="onboarding-option ${studentPrefs.studyTime==='morning'?'selected':''}"
            style="flex:1;padding:10px;font-size:13px;" onclick="updateStudentPref('studyTime','morning',this)">🌅 Matin</button>
          <button class="onboarding-option ${studentPrefs.studyTime==='evening'?'selected':''}"
            style="flex:1;padding:10px;font-size:13px;" onclick="updateStudentPref('studyTime','evening',this)">🌙 Soir</button>
        </div>
      </div>

      <div class="card" style="padding:16px;">
        <div class="field-label">Trajet pour aller à l'école</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
          <input class="field-input" type="number" min="0" max="120" value="${studentPrefs.travelTo}"
            id="pref-travelTo" style="flex:1;" />
          <span style="color:var(--text3);font-size:13px;">min</span>
        </div>
        <div class="field-label" style="margin-top:12px;">Trajet pour rentrer</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
          <input class="field-input" type="number" min="0" max="120" value="${studentPrefs.travelFrom}"
            id="pref-travelFrom" style="flex:1;" />
          <span style="color:var(--text3);font-size:13px;">min</span>
        </div>
      </div>

      <div class="card" style="padding:16px;">
        <div class="field-label">Heures d'étude — jours ordinaires (lun–jeu)</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
          <input class="field-input" type="number" min="0" max="8" value="${studentPrefs.studyHoursWeekday}"
            id="pref-studyHoursWeekday" style="flex:1;" />
          <span style="color:var(--text3);font-size:13px;">h/jour</span>
        </div>
        <div class="field-label" style="margin-top:12px;">Heures d'étude — jours légers (ven–dim)</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
          <input class="field-input" type="number" min="0" max="8" value="${studentPrefs.studyHoursLight}"
            id="pref-studyHoursLight" style="flex:1;" />
          <span style="color:var(--text3);font-size:13px;">h/jour</span>
        </div>
      </div>

      <button class="btn-primary" style="padding:14px;border-radius:14px;font-size:15px;font-weight:700;"
        onclick="saveStudentSettings()">Enregistrer les préférences</button>

      <button class="btn-secondary" style="padding:12px;border-radius:14px;font-size:13px;"
        onclick="if(confirm('Réinitialiser tout le programme étudiant ?')){studentPrefs=null;studentSchedule={};saveStudentData();closeStudentSettings();goToStudent();}">
        Réinitialiser le programme
      </button>
    </div>`;
}

window.updateStudentPref = (key, value, el) => {
  studentPrefs[key] = value;
  el.closest('div').querySelectorAll('.onboarding-option').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
};

window.saveStudentSettings = async () => {
  studentPrefs.travelTo          = parseInt(document.getElementById('pref-travelTo')?.value)          || 30;
  studentPrefs.travelFrom        = parseInt(document.getElementById('pref-travelFrom')?.value)        || 45;
  studentPrefs.studyHoursWeekday = parseInt(document.getElementById('pref-studyHoursWeekday')?.value) || 2;
  studentPrefs.studyHoursLight   = parseInt(document.getElementById('pref-studyHoursLight')?.value)   || 1;
  await saveStudentData();
  closeStudentSettings();
  renderStudentSchedule();
  showToast('Préférences enregistrées');
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function addMinutes(time, min) {
  return minToTime(timeToMin(time) + min);
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ONGLETS Programme / Matières ─────────────────────────────────────────────
window.switchStudentTab = (tab) => {
  studentActiveTab = tab;
  document.querySelectorAll('.student-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('student-schedule-view').style.display = tab === 'schedule' ? 'block' : 'none';
  document.getElementById('student-subjects-view').style.display = tab === 'subjects'  ? 'block' : 'none';
  if (tab === 'subjects') renderSubjectsView();
};

// ── MES MATIÈRES — RENDU ─────────────────────────────────────────────────────
function renderSubjectsView() {
  const el = document.getElementById('student-subjects-list');
  if (!el) return;
  if (!studentSubjects.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text3);">
      <i class="fa-solid fa-book-open" style="font-size:36px;margin-bottom:12px;opacity:0.3;display:block;"></i>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Aucune matière</div>
      <div style="font-size:12px;">Ajoute tes matières pour que Trivo sache quoi réviser.</div>
    </div>`;
    return;
  }
  const statusColor = { unseen:'var(--text3)', inprogress:'#f97316', mastered:'#22c55e' };
  el.innerHTML = studentSubjects.map(subj => {
    const total    = subj.chapters?.length || 0;
    const mastered = subj.chapters?.filter(c => c.status === 'mastered').length || 0;
    const pct      = total > 0 ? Math.round(mastered / total * 100) : 0;
    return `<div class="subject-card" onclick="openSubjectDetail('${subj.id}')">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <div style="width:14px;height:14px;border-radius:50%;background:${subj.color};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;color:var(--text);">${escHtml(subj.name)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${total} chapitre${total>1?'s':''} · ${mastered} maîtrisé${mastered>1?'s':''}</div>
          <div style="height:4px;background:var(--bg3);border-radius:4px;margin-top:6px;">
            <div style="height:4px;background:${subj.color};border-radius:4px;width:${pct}%;transition:width 0.4s;"></div>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:16px;font-weight:900;color:${subj.color};">${pct}%</div>
        <button onclick="event.stopPropagation();openEditSubjectModal('${subj.id}')"
          style="background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;">
          <i class="fa-solid fa-pen" style="font-size:13px;"></i>
        </button>
        <i class="fa-solid fa-chevron-right" style="color:var(--text3);font-size:12px;"></i>
      </div>
    </div>`;
  }).join('');
}

// ── DÉTAIL MATIÈRE (chapitres) ────────────────────────────────────────────────
window.openSubjectDetail = (subjectId) => {
  const subj = studentSubjects.find(s => s.id === subjectId);
  if (!subj) return;
  editingSubjectId = subjectId;
  document.getElementById('subject-detail-title').innerHTML =
    `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${subj.color};margin-right:8px;vertical-align:middle;"></span>${escHtml(subj.name)}`;
  renderChaptersList(subj);
  document.getElementById('subject-detail-modal').classList.add('open');
};

function renderChaptersList(subj) {
  const listEl = document.getElementById('subject-chapters-list');
  if (!listEl) return;
  if (!subj.chapters?.length) {
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">Aucun chapitre. Ajoute ton premier chapitre ci-dessous.</div>`;
    return;
  }
  const statusLabel = { unseen:'Non vu', inprogress:'En cours', mastered:'Maîtrisé' };
  const statusColor = { unseen:'var(--text3)', inprogress:'#f97316', mastered:'#22c55e' };
  const statusIcon  = { unseen:'fa-circle', inprogress:'fa-circle-half-stroke', mastered:'fa-circle-check' };
  listEl.innerHTML = subj.chapters.map(ch => `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer;"
         onclick="cycleChapterStatus('${subj.id}','${ch.id}')">
      <i class="fa-solid ${statusIcon[ch.status]}" style="color:${statusColor[ch.status]};font-size:18px;flex-shrink:0;"></i>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(ch.name)}</div>
        <div style="font-size:11px;color:${statusColor[ch.status]};">${statusLabel[ch.status]} — Appuie pour changer</div>
      </div>
      <button onclick="event.stopPropagation();deleteChapter('${subj.id}','${ch.id}')"
        style="background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;">
        <i class="fa-solid fa-trash" style="font-size:13px;"></i>
      </button>
    </div>`).join('');
}

window.cycleChapterStatus = async (subjectId, chapterId) => {
  const subj = studentSubjects.find(s => s.id === subjectId);
  if (!subj) return;
  const cycle = { unseen:'inprogress', inprogress:'mastered', mastered:'unseen' };
  subj.chapters = subj.chapters.map(c =>
    c.id === chapterId ? { ...c, status: cycle[c.status] || 'unseen' } : c
  );
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

window.deleteChapter = async (subjectId, chapterId) => {
  const subj = studentSubjects.find(s => s.id === subjectId);
  if (!subj || !confirm('Supprimer ce chapitre ?')) return;
  subj.chapters = subj.chapters.filter(c => c.id !== chapterId);
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

window.addChapterToSubject = async () => {
  const input = document.getElementById('new-chapter-input');
  const name  = input?.value.trim();
  if (!name) { showToast('Entre un nom de chapitre'); return; }
  const subj = studentSubjects.find(s => s.id === editingSubjectId);
  if (!subj) return;
  if (!subj.chapters) subj.chapters = [];
  subj.chapters.push({
    id: `ch-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    name, status: 'unseen'
  });
  input.value = '';
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

// ── CRÉER / MODIFIER UNE MATIÈRE ─────────────────────────────────────────────
window.openAddSubjectModal = () => {
  editingSubjectId = null;
  document.getElementById('subject-modal-title').textContent = 'Nouvelle matière';
  document.getElementById('subject-name-input').value = '';
  document.getElementById('subject-delete-btn').style.display = 'none';
  _selectSubjectColorUI(SUBJECT_COLORS[0]);
  document.getElementById('subject-modal').classList.add('open');
  setTimeout(() => document.getElementById('subject-name-input').focus(), 100);
};

window.openEditSubjectModal = (subjectId) => {
  const subj = studentSubjects.find(s => s.id === subjectId);
  if (!subj) return;
  editingSubjectId = subjectId;
  document.getElementById('subject-modal-title').textContent = 'Modifier la matière';
  document.getElementById('subject-name-input').value = subj.name;
  document.getElementById('subject-delete-btn').style.display = 'block';
  _selectSubjectColorUI(subj.color);
  document.getElementById('subject-modal').classList.add('open');
};

function _selectSubjectColorUI(color) {
  document.querySelectorAll('.subject-color-chip').forEach(c => {
    c.style.outline = c.dataset.color === color ? '3px solid #fff' : 'none';
    c.style.outlineOffset = '2px';
  });
  const inp = document.getElementById('selected-subject-color');
  if (inp) inp.value = color;
}

window.selectSubjectColor = (color) => { _selectSubjectColorUI(color); };

window.saveSubject = async () => {
  const name  = document.getElementById('subject-name-input').value.trim();
  const color = document.getElementById('selected-subject-color')?.value || SUBJECT_COLORS[0];
  if (!name) { showToast('Entre un nom de matière'); return; }
  if (editingSubjectId) {
    studentSubjects = studentSubjects.map(s =>
      s.id === editingSubjectId ? { ...s, name, color } : s
    );
  } else {
    studentSubjects.push({
      id: `subj-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      name, color, chapters: []
    });
  }
  await saveStudentData();
  closeModal('subject-modal');
  renderSubjectsView();
  showToast(editingSubjectId ? 'Matière modifiée' : 'Matière ajoutée');
};

window.deleteSubject = async () => {
  if (!editingSubjectId || !confirm('Supprimer cette matière et tous ses chapitres ?')) return;
  studentSubjects = studentSubjects.filter(s => s.id !== editingSubjectId);
  await saveStudentData();
  closeModal('subject-modal');
  renderSubjectsView();
  showToast('Matière supprimée');
};

// ── PRIORITÉ MATIÈRE pour sessions d'étude ───────────────────────────────────
function getPrioritySubject(dayKey) {
  if (!studentSubjects.length) return null;
  const dayCourses = (studentSchedule[dayKey] || []).filter(b => b.type === 'cours');
  for (const course of dayCourses) {
    const match = studentSubjects.find(s =>
      s.name.toLowerCase().includes(course.name.toLowerCase()) ||
      course.name.toLowerCase().includes(s.name.toLowerCase())
    );
    if (match) {
      const nextCh = match.chapters?.find(c => c.status !== 'mastered');
      if (nextCh) return { subject: match, chapter: nextCh };
    }
  }
  const sorted = [...studentSubjects].sort((a, b) => {
    const pA = a.chapters?.length ? a.chapters.filter(c=>c.status==='mastered').length/a.chapters.length : 0;
    const pB = b.chapters?.length ? b.chapters.filter(c=>c.status==='mastered').length/b.chapters.length : 0;
    return pA - pB;
  });
  const priority = sorted[0];
  const nextCh   = priority?.chapters?.find(c => c.status !== 'mastered');
  return priority ? { subject: priority, chapter: nextCh } : null;
}
