// ══════════════════════════════════════════════════════════════════════════════
//  STUDENT.JS — Module Étudiant v2
// ══════════════════════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let studentPrefs    = null;
let studentSchedule = {};
let studentSubjects = [];

let editingCourseDay    = null;
let editingCourseId     = null;
let editingIsAutoStudy  = false; // true quand on édite une session de révision auto-générée (pas un bloc manuel)
let selectedCourseType  = 'cours';
let selectedCourseImp   = 'high';
let selectedCourseColor = '#2563eb';
let editingSubjectId    = null;
let studentActiveTab    = 'schedule';

const DAYS_FR  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_EN  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const HOURS_START = 4;   // 4h du matin
const HOURS_END   = 27;  // 3h du matin = heure 27
const PX_PER_MIN  = 1.0;

const SUBJECT_COLORS = [
  '#2563eb','#dc2626','#16a34a','#f97316',
  '#a855f7','#0ea5e9','#db2777','#65a30d'
];

// Statuts matière (4 niveaux)
const SUBJECT_STATUS = {
  none:      { label: 'Pas encore maîtrisé', color: '#ef4444', icon: 'fa-circle-xmark' },
  some:      { label: 'Quelques notions',     color: '#f97316', icon: 'fa-circle-half-stroke' },
  good:      { label: 'Je suis bien',         color: '#3b82f6', icon: 'fa-circle-check' },
  mastered:  { label: 'Matière maîtrisée',    color: '#22c55e', icon: 'fa-star' }
};

// ── Navigation ────────────────────────────────────────────────────────────────
window.goToStudent = async () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-student').classList.add('active');
  document.querySelector('[data-screen="student"]')?.classList.add('active');
  document.getElementById('fab-add').style.display = 'none';
  document.getElementById('topbar-title').textContent = '🎓 Étudiant';
  await loadStudentData();
  if (!studentPrefs?.onboardingDone) {
    startOnboarding();
  } else {
    // Comptes déjà onboardés avant ce correctif : pas encore de sessions
    // persistées dans studentSchedule — on les génère une première fois.
    const hasStudyBlocks = DAYS_EN.some(d => (studentSchedule[d]||[]).some(b => b.type === 'study'));
    if (!hasStudyBlocks) { generateStudyBlocks(); await saveStudentData(); }
    renderStudentSchedule();
  }
};

// ── Chargement / Sauvegarde ───────────────────────────────────────────────────
async function loadStudentData() {
  const cp = await idbGet('prefs','studentPrefs');
  const cs = await idbGet('prefs','studentSchedule');
  const cx = await idbGet('prefs','studentSubjects');
  if (cp?.value) studentPrefs    = cp.value;
  if (cs?.value) studentSchedule = cs.value;
  if (cx?.value) studentSubjects = cx.value;
  if (currentUser) {
    try {
      const snap = await getDoc(doc(db,'users',currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.studentPrefs)    studentPrefs    = d.studentPrefs;
        if (d.studentSchedule) studentSchedule = d.studentSchedule;
        if (d.studentSubjects) studentSubjects = d.studentSubjects;
        await idbPut('prefs',{key:'studentPrefs',    value:studentPrefs});
        await idbPut('prefs',{key:'studentSchedule', value:studentSchedule});
        await idbPut('prefs',{key:'studentSubjects', value:studentSubjects});
      }
    } catch(e) {}
  }
}

async function saveStudentData() {
  await idbPut('prefs',{key:'studentPrefs',    value:studentPrefs});
  await idbPut('prefs',{key:'studentSchedule', value:studentSchedule});
  await idbPut('prefs',{key:'studentSubjects', value:studentSubjects});
  if (currentUser)
    updateDoc(doc(db,'users',currentUser.uid),{studentPrefs,studentSchedule,studentSubjects}).catch(()=>{});
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  { emoji:'🎓', title:'Bienvenue, étudiant.',
    sub:'Trivo va construire ton programme automatiquement.\nAjoute tes cours — le reste, c\'est nous.', type:'intro' },
  { emoji:'🌅', title:'Tu préfères étudier quand ?',
    sub:'On planifiera tes sessions selon ta préférence.', type:'choice', key:'studyTime',
    options:[
      {value:'morning', label:'🌅 Tôt le matin', sub:'Avant les cours ou en début de journée'},
      {value:'evening', label:'🌙 Le soir',       sub:'Après les cours, quand tu es rentré'}
    ]},
  { emoji:'🚌', title:'Temps pour aller à l\'école ?',
    sub:'En minutes — pour calculer ton heure de réveil.', type:'number', key:'travelTo', placeholder:'Ex: 30', unit:'minutes'},
  { emoji:'🏠', title:'Temps pour rentrer chez toi ?',
    sub:'En minutes après la fin des cours.', type:'number', key:'travelFrom', placeholder:'Ex: 45', unit:'minutes'},
  { emoji:'📚', title:'Heures d\'étude les jours ordinaires ?',
    sub:'Lundi au jeudi — les jours chargés. Ces heures seront réparties selon tes disponibilités.', type:'number', key:'studyHoursWeekday', placeholder:'Ex: 3', unit:'heures'},
  { emoji:'🧘', title:'Heures d\'étude les jours légers ?',
    sub:'Vendredi, samedi, dimanche.', type:'number', key:'studyHoursLight', placeholder:'Ex: 1', unit:'heures'},
  { emoji:'✅', title:'Tout est prêt.',
    sub:'Ajoute tes cours dans le programme. Trivo s\'occupe du reste.', type:'finish'}
];

let onboardingStep    = 0;
let onboardingAnswers = {};

function startOnboarding() {
  onboardingStep = 0; onboardingAnswers = {};
  document.getElementById('student-onboarding').style.display = 'flex';
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStep];
  document.getElementById('onboarding-progress').innerHTML =
    ONBOARDING_STEPS.map((_,i)=>`<div class="onboarding-dot ${i<=onboardingStep?'done':''}"></div>`).join('');
  const wrap = document.getElementById('onboarding-steps-wrap');
  let html = `<div class="onboarding-step active">
    <div class="onboarding-emoji">${step.emoji}</div>
    <div class="onboarding-title">${step.title}</div>
    <div class="onboarding-sub">${step.sub.replace(/\n/g,'<br>')}</div>`;
  if (step.type==='choice') {
    html += `<div class="onboarding-options">${step.options.map(o=>`
      <div class="onboarding-option ${onboardingAnswers[step.key]===o.value?'selected':''}"
           onclick="selectOnboardingChoice('${step.key}','${o.value}',this)">
        ${o.label}<br><span style="font-size:12px;opacity:0.7;">${o.sub}</span>
      </div>`).join('')}</div>
    <button class="onboarding-next" onclick="nextOnboardingStep()">Continuer →</button>`;
  } else if (step.type==='number') {
    html += `<input class="onboarding-input" type="number" min="1" max="120"
      id="onboarding-number-input" value="${onboardingAnswers[step.key]||''}" placeholder="${step.placeholder}"/>
    <div style="font-size:13px;color:var(--text3);margin-top:6px;">${step.unit}</div>
    <button class="onboarding-next" onclick="nextOnboardingStepNumber('${step.key}')">Continuer →</button>`;
  } else if (step.type==='finish') {
    html += `<button class="onboarding-next" onclick="finishOnboarding()">Voir mon programme 🎓</button>`;
  } else {
    html += `<button class="onboarding-next" onclick="nextOnboardingStep()">Commencer →</button>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;
  if (step.type==='number') setTimeout(()=>document.getElementById('onboarding-number-input')?.focus(),300);
}

window.selectOnboardingChoice = (key,value,el) => {
  onboardingAnswers[key] = value;
  el.closest('.onboarding-options').querySelectorAll('.onboarding-option').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
};
window.nextOnboardingStep = () => {
  const step = ONBOARDING_STEPS[onboardingStep];
  if (step.type==='choice' && !onboardingAnswers[step.key]) { showToast('Fais un choix pour continuer'); return; }
  onboardingStep++;
  if (onboardingStep < ONBOARDING_STEPS.length) renderOnboardingStep();
};
window.nextOnboardingStepNumber = (key) => {
  const val = parseInt(document.getElementById('onboarding-number-input')?.value);
  if (!val||val<1) { showToast('Entre un nombre valide'); return; }
  onboardingAnswers[key] = val;
  onboardingStep++;
  if (onboardingStep < ONBOARDING_STEPS.length) renderOnboardingStep();
};
window.finishOnboarding = async () => {
  studentPrefs = {
    studyTime:         onboardingAnswers.studyTime||'evening',
    travelTo:          onboardingAnswers.travelTo||30,
    travelFrom:        onboardingAnswers.travelFrom||45,
    studyHoursWeekday: onboardingAnswers.studyHoursWeekday||2,
    studyHoursLight:   onboardingAnswers.studyHoursLight||1,
    onboardingDone:    true
  };
  if (!studentSchedule||!Object.keys(studentSchedule).length) {
    studentSchedule = {};
    DAYS_EN.forEach(d=>{ studentSchedule[d]=[]; });
  }
  await saveStudentData();
  document.getElementById('student-onboarding').style.display = 'none';
  generateSleepBlocks();
  generateStudyBlocks();
  renderStudentSchedule();
  showToast('Programme créé. Ajoute maintenant tes cours.');
};

// ── BLOC SOMMEIL AUTO ─────────────────────────────────────────────────────────
// Génère les blocs sommeil selon la préférence (matin/soir)
// Plage horaire : 4h–27h (27h = 3h du matin du lendemain)
function generateSleepBlocks() {
  if (!studentPrefs) return;
  DAYS_EN.forEach(dayKey => {
    if (!studentSchedule[dayKey]) studentSchedule[dayKey] = [];
    // Supprimer les anciens blocs sommeil auto
    studentSchedule[dayKey] = studentSchedule[dayKey].filter(b => b.type !== 'sleep');
    // Ajouter le nouveau bloc sommeil
    let sleepStart, sleepEnd;
    if (studentPrefs.studyTime === 'morning') {
      // Coucher tôt, lever tôt — 22h à 4h (=4h du lendemain)
      sleepStart = '22:00'; sleepEnd = '28:00'; // 28h = 4h du matin
    } else {
      // Coucher tard — 23h à 4h
      sleepStart = '23:00'; sleepEnd = '28:00';
    }
    studentSchedule[dayKey].push({
      id: `sleep-${dayKey}`, type: 'sleep', name: '😴 Sommeil',
      start: sleepStart, end: sleepEnd, autoGenerated: true
    });
  });
}

// ── SESSIONS D'ÉTUDE AUTO — persistées comme les blocs sommeil ──────────────────
// Contrairement à avant (recalcul à chaque rendu), les sessions de révision auto
// sont désormais enregistrées dans studentSchedule au même titre qu'un bloc manuel :
// modifiables et supprimables, et ça reste comme ça tant que l'utilisateur ne clique
// pas explicitement sur "Regénérer le programme de révision" (qui, lui, efface tout
// et recalcule à neuf — modifications et suppressions comprises).
function generateStudyBlocks() {
  if (!studentPrefs) return;
  DAYS_EN.forEach(dayKey => {
    if (!studentSchedule[dayKey]) studentSchedule[dayKey] = [];
    // Supprimer les anciens blocs d'étude auto (modifiés ou non) avant de recalculer
    studentSchedule[dayKey] = studentSchedule[dayKey].filter(b => b.type !== 'study');
    const fresh = getAutoStudyBlocks(dayKey);
    studentSchedule[dayKey].push(...fresh);
  });
}

// ── RENDU DU PROGRAMME ────────────────────────────────────────────────────────
function renderStudentSchedule() {
  const scheduleEl = document.getElementById('student-schedule');
  const labelsEl   = document.getElementById('student-hour-labels');
  if (!scheduleEl) return;

  const totalH  = HOURS_END - HOURS_START; // 4h à 27h = 23h
  const totalPx = totalH * 60 * PX_PER_MIN;

  // Étiquettes heures — afficher en format lisible (27h = 3h)
  if (labelsEl) {
    labelsEl.style.height = totalPx + 40 + 'px';
    labelsEl.innerHTML = '';
    for (let h = HOURS_START; h <= HOURS_END; h++) {
      const top    = (h - HOURS_START) * 60 * PX_PER_MIN;
      const label  = h >= 24 ? `${h-24}h` : `${h}h`;
      const el     = document.createElement('div');
      el.style.cssText = `position:absolute;top:${top}px;font-size:8px;color:var(--text3);right:2px;transform:translateY(-50%);`;
      el.textContent = label;
      labelsEl.appendChild(el);
    }
  }

  const today   = new Date().getDay();
  scheduleEl.innerHTML = '';

  DAYS_EN.forEach((dayKey, idx) => {
    const jsDayIdx = idx === 6 ? 0 : idx + 1;
    const isToday  = today === jsDayIdx;
    const allBlocks = (studentSchedule[dayKey] || []);

    const col = document.createElement('div');
    col.className = 'student-day-col';

    const headerLabel = DAYS_FR[idx].slice(0,3);
    col.innerHTML = `<div class="student-day-header ${isToday?'today':''}">${headerLabel}</div>
      <div class="student-timeline" style="height:${totalPx}px;" id="timeline-${dayKey}"></div>`;
    scheduleEl.appendChild(col);

    const timeline = col.querySelector(`#timeline-${dayKey}`);

    // Lignes d'heure
    for (let h = HOURS_START; h <= HOURS_END; h++) {
      const line = document.createElement('div');
      line.className = 'student-hour-line';
      line.style.top = (h - HOURS_START) * 60 * PX_PER_MIN + 'px';
      timeline.appendChild(line);
    }

    // Slot cliquable
    const slotOverlay = document.createElement('div');
    slotOverlay.style.cssText = 'position:absolute;inset:0;z-index:1;';
    slotOverlay.onclick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y    = e.clientY - rect.top;
      const mins = Math.round(y / PX_PER_MIN / 30) * 30;
      const absH = HOURS_START + Math.floor(mins / 60);
      const absM = mins % 60;
      const displayH = absH >= 24 ? absH - 24 : absH;
      openAddCourseModal(dayKey, `${String(displayH).padStart(2,'0')}:${String(absM).padStart(2,'0')}`);
    };
    timeline.appendChild(slotOverlay);

    // Blocs
    allBlocks.forEach(block => {
      const el = buildBlockElement(block, dayKey);
      if (el) timeline.appendChild(el);
    });
  });
}

function buildBlockElement(block, dayKey) {
  let startMin = timeToAbsMin(block.start);
  let endMin   = timeToAbsMin(block.end);

  // Normaliser les heures après minuit (ex: 1h = 25h)
  if (startMin < HOURS_START * 60) startMin += 24 * 60;
  if (endMin   < HOURS_START * 60) endMin   += 24 * 60;
  if (endMin   <= startMin)        endMin   += 24 * 60;

  if (startMin < HOURS_START*60 || endMin > HOURS_END*60) return null;

  const top    = (startMin - HOURS_START*60) * PX_PER_MIN;
  const height = Math.max((endMin - startMin) * PX_PER_MIN, 18);

  const el = document.createElement('div');

  if (block.type === 'sleep') {
    el.style.cssText = `position:absolute;left:2px;right:2px;top:${top}px;height:${height}px;
      background:linear-gradient(180deg,#1e3a5f 0%,#0d1f3c 100%);border-radius:6px;
      display:flex;align-items:center;justify-content:center;font-size:10px;color:#60a5fa;
      z-index:2;cursor:pointer;`;
    el.innerHTML = `<span>😴</span>`;
    el.onclick = (e) => { e.stopPropagation(); openEditSleepModal(dayKey, block.id); };
    return el;
  }

  el.className = `student-block ${block.autoGenerated?'study':''} ${block.importance?'imp-'+block.importance:''}`;
  el.style.cssText = `top:${top}px;height:${height}px;z-index:${block.autoGenerated?2:3};`;

  if (block.type === 'revision') {
    el.style.background = 'linear-gradient(135deg,#7c3aed,#4f46e5)';
    el.style.borderLeft = '3px solid #a78bfa';
  } else if (block.autoGenerated) {
    el.style.background = 'linear-gradient(135deg,#1d4ed8,#1e40af)';
    el.style.borderLeft = '3px solid #60a5fa';
  } else if (block.color) {
    el.style.background = block.color;
  }

  const timeLabel = `${block.start}–${block.end}`;
  el.innerHTML = `<div class="block-title">${block.name}</div><div class="block-time">${timeLabel}</div>`;

  if (!block.autoGenerated) {
    el.onclick = (e) => { e.stopPropagation(); openEditCourseModal(dayKey, block.id); };
  } else if (block.type === 'study') {
    el.onclick = (e) => { e.stopPropagation(); openEditStudyBlockModal(dayKey, block.id); };
  }
  return el;
}

// ── MODAL SOMMEIL (modifier/supprimer) ───────────────────────────────────────
window.openEditSleepModal = (dayKey, blockId) => {
  if (!confirm('Modifier les heures de sommeil pour ce jour ?\n\nOK = supprimer ce bloc (tu pourras en ajouter un nouveau)\nAnnuler = conserver')) return;
  studentSchedule[dayKey] = (studentSchedule[dayKey]||[]).filter(b => b.id !== blockId);
  saveStudentData();
  renderStudentSchedule();
  showToast('Bloc sommeil supprimé. Clique sur le créneau pour en ajouter un nouveau.');
};

// ── AUTO-GÉNÉRATION SESSIONS D'ÉTUDE ─────────────────────────────────────────
// Répartit les heures d'étude dans les créneaux disponibles
// après le retour de l'école (+buffer) en évitant les pauses entre cours
function getAutoStudyBlocks(dayKey) {
  if (!studentPrefs) return [];

  const dayIdx   = DAYS_EN.indexOf(dayKey);
  const isLight  = dayIdx >= 4;
  const studyH   = isLight ? studentPrefs.studyHoursLight : studentPrefs.studyHoursWeekday;
  if (studyH <= 0) return [];

  const courses  = (studentSchedule[dayKey]||[]).filter(b => b.type==='cours');
  const sleeps   = (studentSchedule[dayKey]||[]).filter(b => b.type==='sleep');
  const revisions= (studentSchedule[dayKey]||[]).filter(b => b.type==='revision');

  // Trouver les créneaux occupés (cours + sommeil + révisions manuelles)
  const occupied = [...courses, ...sleeps, ...revisions].map(b => ({
    start: timeToAbsMin(b.start), end: timeToAbsMin(b.end)
  }));

  // Heure de début disponible selon préférence
  let availableFrom;
  if (studentPrefs.studyTime === 'morning') {
    if (courses.length > 0) {
      const firstCourse = courses.sort((a,b)=>timeToAbsMin(a.start)-timeToAbsMin(b.start))[0];
      // Étudier avant le premier cours (si assez de temps)
      availableFrom = 4 * 60; // 4h du matin
    } else {
      availableFrom = 6 * 60;
    }
  } else {
    if (courses.length > 0) {
      const lastCourse = courses.sort((a,b)=>timeToAbsMin(a.start)-timeToAbsMin(b.start)).slice(-1)[0];
      availableFrom = timeToAbsMin(lastCourse.end) + studentPrefs.travelFrom + 90; // buffer 1h30
    } else {
      availableFrom = 18 * 60; // 18h par défaut si pas de cours
    }
  }

  // Répartir les heures d'étude en blocs de 1h max avec pauses
  const blocks     = [];
  let remaining    = studyH * 60; // en minutes
  let cursor       = availableFrom;
  const endOfDay   = 23 * 60; // ne pas planifier après 23h

  while (remaining > 0 && cursor < endOfDay) {
    const blockDur = Math.min(remaining, 60); // bloc max 1h
    const blockEnd = cursor + blockDur;

    // Vérifier qu'on ne chevauche pas un créneau occupé
    const overlaps = occupied.some(o => cursor < o.end && blockEnd > o.start);
    if (!overlaps && blockEnd <= endOfDay) {
      blocks.push({
        id: `auto-${dayKey}-${cursor}`, type:'study',
        name: _getStudyBlockName(dayKey),
        start: absMinToTime(cursor), end: absMinToTime(blockEnd),
        autoGenerated: true
      });
      remaining -= blockDur;
      cursor = blockEnd + 15; // 15 min de pause entre blocs
    } else {
      // Avancer de 15 min et réessayer
      cursor += 15;
    }
  }
  return blocks;
}

function _getStudyBlockName(dayKey) {
  const priority = getPrioritySubject(dayKey);
  if (priority?.subject) return `Révision — ${priority.subject.name}`;
  return 'Révision';
}

// ── GÉNÉRATION TÂCHES D'ÉTUDE ─────────────────────────────────────────────────
window.generateStudyPlan = async () => {
  if (!studentPrefs?.onboardingDone) return;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0,0,0,0);

  let addedCount = 0;
  for (let i=0; i<7; i++) {
    const d       = new Date(weekStart); d.setDate(weekStart.getDate()+i);
    const dayKey  = DAYS_EN[i];
    const dateStr = window.fmtDate ? window.fmtDate(d) : d.toISOString().slice(0,10);
    const auto    = (studentSchedule[dayKey]||[]).filter(b => b.type === 'study');

    for (const block of auto) {
      const exists = tasks.some(t => t.date===dateStr && t.studentStudy===true && t.studentDay===dayKey && t.time===block.start);
      if (exists) continue;
      const now   = Date.now();
      const newId = `study-${dayKey}-${now}-${Math.random().toString(36).slice(2,6)}`;
      // Rappel 1h avant — obligatoire
      const reminderMin = timeToAbsMin(block.start) - 60;
      const newTask = {
        id:newId, uid:currentUser.uid,
        title: block.name,
        content: `Session d'étude : ${block.start}–${block.end}`,
        date:dateStr, time:block.start,
        status:'pending', color:'#00f7ff',
        alarm:true, studentStudy:true, studentDay:dayKey,
        timestamp:now, updatedAt:now
      };
      await idbPut('tasks', newTask);
      tasks.unshift(newTask);
      await queuePush('create','tasks',newId,newTask);
      addedCount++;
    }
  }
  if (navigator.onLine) await window.queueFlush();
  renderTaskList?.();
  showToast(addedCount>0 ? `${addedCount} session${addedCount>1?'s':''} ajoutée${addedCount>1?'s':''} à tes tâches`:'Programme à jour');
};

// ── MODAL AJOUT / MODIFICATION COURS ─────────────────────────────────────────
window.openAddCourseModal = (dayKey, defaultStart='08:00') => {
  editingCourseDay    = dayKey;
  editingCourseId     = null;
  editingIsAutoStudy  = false;
  selectedCourseType  = 'cours';
  selectedCourseImp   = 'high';
  selectedCourseColor = studentSubjects[0]?.color || '#2563eb';

  document.getElementById('course-modal-title').textContent = `Ajouter — ${DAYS_FR[DAYS_EN.indexOf(dayKey)]}`;
  document.getElementById('course-start-input').value       = defaultStart;
  document.getElementById('course-end-input').value         = addMinutes(defaultStart,60);
  document.getElementById('course-delete-btn').style.display = 'none';
  document.getElementById('course-type-field').style.display = 'block';
  document.getElementById('course-importance-wrap').style.display = 'block';
  selectCourseType('cours');
  _renderSubjectPicker(null);
  document.getElementById('student-course-modal').classList.add('open');
};

window.openEditCourseModal = (dayKey, courseId) => {
  const course = (studentSchedule[dayKey]||[]).find(c=>c.id===courseId);
  if (!course) return;
  editingCourseDay    = dayKey;
  editingCourseId     = courseId;
  editingIsAutoStudy  = false;
  selectedCourseType  = course.type;
  selectedCourseImp   = course.importance||'high';
  selectedCourseColor = course.color||'#2563eb';

  document.getElementById('course-modal-title').textContent  = `Modifier — ${DAYS_FR[DAYS_EN.indexOf(dayKey)]}`;
  document.getElementById('course-start-input').value        = course.start;
  document.getElementById('course-end-input').value          = course.end;
  document.getElementById('course-delete-btn').style.display = 'block';
  document.getElementById('course-type-field').style.display = 'block';
  document.getElementById('course-importance-wrap').style.display = 'block';
  selectCourseType(course.type);
  _renderSubjectPicker(course.subjectId||null);
  if (course.type!=='cours' && course.type!=='revision') {
    const nameInput = document.getElementById('course-name-input');
    if (nameInput) nameInput.value = course.name;
  }
  document.querySelectorAll('.course-imp-chip').forEach(c => c.classList.toggle('selected', c.dataset.imp===selectedCourseImp));
  document.getElementById('student-course-modal').classList.add('open');
};

// Édition d'une session de révision auto-générée — mêmes actions (modifier
// l'heure/la matière, supprimer) qu'un bloc manuel, mais elle reste classée
// comme session auto : "Regénérer le programme de révision" l'efface et la
// recalcule quand même, modifiée ou non.
window.openEditStudyBlockModal = (dayKey, blockId) => {
  const block = (studentSchedule[dayKey]||[]).find(b=>b.id===blockId);
  if (!block) return;
  editingCourseDay    = dayKey;
  editingCourseId     = blockId;
  editingIsAutoStudy  = true;
  selectedCourseType  = 'revision'; // usage interne : affiche le sélecteur de matière
  selectedCourseImp   = 'high';
  selectedCourseColor = block.color || '#e4c111';

  document.getElementById('course-modal-title').textContent  = 'Session de révision';
  document.getElementById('course-start-input').value        = block.start;
  document.getElementById('course-end-input').value          = block.end;
  document.getElementById('course-delete-btn').style.display = 'block';
  // Le type et l'importance ne s'appliquent pas à une session auto — seules
  // l'heure et la matière restent modifiables ici.
  document.getElementById('course-type-field').style.display = 'none';
  document.getElementById('course-importance-wrap').style.display = 'none';
  _renderSubjectPicker(block.subjectId||null);
  document.getElementById('student-course-modal').classList.add('open');
};

// Sélecteur de matière — remplace le champ texte quand type=cours ou revision
function _renderSubjectPicker(selectedSubjectId) {
  const nameWrap = document.getElementById('course-name-wrap');
  if (!nameWrap) return;
  if (selectedCourseType === 'cours' || selectedCourseType === 'revision') {
    if (!studentSubjects.length) {
      nameWrap.innerHTML = `<div class="field-label">Matière</div>
        <div style="font-size:12px;color:var(--text3);padding:10px;">
          Aucune matière. Va dans l'onglet Matières pour en créer.
        </div>`;
      return;
    }
    nameWrap.innerHTML = `<div class="field-label">Matière</div>
      <select class="field-input" id="course-subject-select" style="padding:12px;">
        ${studentSubjects.map(s=>`<option value="${s.id}" ${s.id===selectedSubjectId?'selected':''}>${s.name}</option>`).join('')}
      </select>`;
  } else {
    nameWrap.innerHTML = `<div class="field-label">Nom</div>
      <input class="field-input" id="course-name-input" placeholder="Ex: Réunion, Sport…" maxlength="40" />`;
  }
}

window.selectCourseType = (type) => {
  selectedCourseType = type;
  ['cours','revision','autre'].forEach(t => {
    document.getElementById(`course-type-${t}`)?.classList.toggle('selected', t===type);
  });
  const impWrap = document.getElementById('course-importance-wrap');
  if (impWrap) impWrap.style.opacity = type==='cours' ? '1' : '0.4';
  _renderSubjectPicker(null);
};

window.selectCourseImp = (imp, el) => {
  selectedCourseImp = imp;
  document.querySelectorAll('.course-imp-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
};

window.saveCourseBlock = async () => {
  const start = document.getElementById('course-start-input').value;
  const end   = document.getElementById('course-end-input').value;
  if (!start||!end) { showToast('Entre les heures'); return; }
  if (timeToAbsMin(start)>=timeToAbsMin(end)) { showToast('L\'heure de fin doit être après le début'); return; }

  let name, subjectId=null, color=selectedCourseColor;

  if (selectedCourseType==='cours'||selectedCourseType==='revision') {
    const sel = document.getElementById('course-subject-select');
    if (!sel) { showToast('Ajoute d\'abord une matière'); return; }
    subjectId = sel.value;
    const subj = studentSubjects.find(s=>s.id===subjectId);
    if (!subj) { showToast('Matière introuvable'); return; }
    name  = subj.name;
    color = subj.color;
  } else {
    const inp = document.getElementById('course-name-input');
    name = inp?.value.trim();
    if (!name) { showToast('Entre un nom'); return; }
  }

  if (!studentSchedule[editingCourseDay]) studentSchedule[editingCourseDay]=[];

  const block = {
    id: editingCourseId || `block-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    type: editingIsAutoStudy ? 'study' : selectedCourseType, name, start, end, subjectId,
    importance: selectedCourseType==='cours' ? selectedCourseImp : 'other',
    color
  };
  if (editingIsAutoStudy) block.autoGenerated = true;

  if (editingCourseId) {
    studentSchedule[editingCourseDay] = studentSchedule[editingCourseDay].map(c=>c.id===editingCourseId?block:c);
  } else {
    studentSchedule[editingCourseDay].push(block);
  }

  // Si c'est une révision manuelle (pas une session auto), créer automatiquement une tâche
  if (selectedCourseType==='revision' && !editingIsAutoStudy) {
    await _createRevisionTask(block, editingCourseDay);
  }

  await saveStudentData();
  closeModal('student-course-modal');
  editingIsAutoStudy = false;
  renderStudentSchedule();
};

async function _createRevisionTask(block, dayKey) {
  const dayIdx = DAYS_EN.indexOf(dayKey);
  const now    = new Date();
  const today  = now.getDay();
  const jsDayIdx = dayIdx===6 ? 0 : dayIdx+1;
  let diff = jsDayIdx - today;
  if (diff < 0) diff += 7;
  const taskDate = new Date(now); taskDate.setDate(now.getDate()+diff);
  const dateStr  = window.fmtDate ? window.fmtDate(taskDate) : taskDate.toISOString().slice(0,10);
  const ts   = Date.now();
  const newId = `rev-${dayKey}-${ts}`;
  const subj  = studentSubjects.find(s=>s.id===block.subjectId);
  const newTask = {
    id:newId, uid:currentUser.uid,
    title:`Révision — ${subj?.name||block.name}`,
    content:`Session de révision : ${block.start}–${block.end}`,
    date:dateStr, time:block.start, status:'pending',
    color: subj?.color||'#7c3aed', alarm:true,
    studentStudy:true, studentDay:dayKey,
    timestamp:ts, updatedAt:ts
  };
  await idbPut('tasks', newTask);
  tasks.unshift(newTask);
  await queuePush('create','tasks',newId,newTask);
  if (navigator.onLine) await window.queueFlush();
}

window.deleteCourseBlock = async () => {
  if (!editingCourseId||!editingCourseDay) return;
  if (!confirm('Supprimer ce bloc ?')) return;
  studentSchedule[editingCourseDay] = (studentSchedule[editingCourseDay]||[]).filter(c=>c.id!==editingCourseId);
  await saveStudentData();
  closeModal('student-course-modal');
  editingIsAutoStudy = false;
  renderStudentSchedule();
};

// ── PARAMÈTRES ÉTUDIANT ───────────────────────────────────────────────────────
window.openStudentSettings = () => {
  if (!studentPrefs) return;
  renderStudentSettingsContent();
  document.getElementById('student-settings-panel').classList.add('open');
};
window.closeStudentSettings = () => {
  document.getElementById('student-settings-panel')?.classList.remove('open');
};

function renderStudentSettingsContent() {
  const el = document.getElementById('student-settings-content');
  if (!el||!studentPrefs) return;
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;">
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
      <div class="field-label">Trajet aller (min)</div>
      <input class="field-input" type="number" min="0" max="120" value="${studentPrefs.travelTo}" id="pref-travelTo" style="margin-top:6px;"/>
      <div class="field-label" style="margin-top:12px;">Trajet retour (min)</div>
      <input class="field-input" type="number" min="0" max="120" value="${studentPrefs.travelFrom}" id="pref-travelFrom" style="margin-top:6px;"/>
    </div>
    <div class="card" style="padding:16px;">
      <div class="field-label">Heures d'étude jours ordinaires (lun–jeu)</div>
      <input class="field-input" type="number" min="0" max="12" value="${studentPrefs.studyHoursWeekday}" id="pref-studyHoursWeekday" style="margin-top:6px;"/>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">Ces heures sont réparties selon tes disponibilités — pas en bloc unique.</div>
      <div class="field-label" style="margin-top:12px;">Heures d'étude jours légers (ven–dim)</div>
      <input class="field-input" type="number" min="0" max="12" value="${studentPrefs.studyHoursLight}" id="pref-studyHoursLight" style="margin-top:6px;"/>
    </div>
    <button class="btn-primary" style="padding:14px;border-radius:14px;font-size:15px;font-weight:700;" onclick="saveStudentSettings()">Enregistrer</button>
    <button class="btn-secondary" style="padding:12px;border-radius:14px;font-size:13px;"
      onclick="if(confirm('Regénérer les blocs sommeil ?')){generateSleepBlocks();saveStudentData();closeStudentSettings();renderStudentSchedule();}">
      Regénérer les blocs sommeil
    </button>
    <button class="btn-secondary" style="padding:12px;border-radius:14px;font-size:13px;"
      onclick="if(confirm('Regénérer le programme de révision ? Les sessions auto (modifiées ou supprimées) seront recalculées.')){generateStudyBlocks();saveStudentData();closeStudentSettings();renderStudentSchedule();}">
      Regénérer le programme de révision
    </button>
    <button class="btn-secondary" style="padding:12px;border-radius:14px;font-size:13px;color:var(--red);"
      onclick="if(confirm('Réinitialiser tout le programme étudiant ?')){studentPrefs=null;studentSchedule={};saveStudentData();closeStudentSettings();goToStudent();}">
      Réinitialiser le programme
    </button>
  </div>`;
}

window.updateStudentPref = (key,value,el) => {
  studentPrefs[key]=value;
  el.closest('div').querySelectorAll('.onboarding-option').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
};

window.saveStudentSettings = async () => {
  studentPrefs.travelTo          = parseInt(document.getElementById('pref-travelTo')?.value)||30;
  studentPrefs.travelFrom        = parseInt(document.getElementById('pref-travelFrom')?.value)||45;
  studentPrefs.studyHoursWeekday = parseInt(document.getElementById('pref-studyHoursWeekday')?.value)||2;
  studentPrefs.studyHoursLight   = parseInt(document.getElementById('pref-studyHoursLight')?.value)||1;
  await saveStudentData();
  closeStudentSettings();
  renderStudentSchedule();
  showToast('Préférences enregistrées');
};

// ── ONGLETS ───────────────────────────────────────────────────────────────────
window.switchStudentTab = (tab) => {
  studentActiveTab = tab;
  // Mettre à jour les styles inline directement car les boutons ont des styles inline
  document.querySelectorAll('.student-tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.style.background = isActive ? 'var(--card)' : 'transparent';
    b.style.color       = isActive ? 'var(--text)'  : 'var(--text3)';
  });
  document.getElementById('student-schedule-view').style.display = tab === 'schedule' ? 'block' : 'none';
  document.getElementById('student-subjects-view').style.display = tab === 'subjects'  ? 'block' : 'none';
  if (tab === 'subjects') renderSubjectsView();
};

// ── MES MATIÈRES ──────────────────────────────────────────────────────────────
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
  el.innerHTML = studentSubjects.map(subj => {
    const total    = subj.chapters?.length||0;
    const mastered = subj.chapters?.filter(c=>c.status==='mastered').length||0;
    const pct      = total>0 ? Math.round(mastered/total*100) : 0;
    const st       = SUBJECT_STATUS[subj.masteryStatus||'none'];
    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="openSubjectDetail('${subj.id}')">
      <div style="width:14px;height:14px;border-radius:50%;background:${subj.color};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:var(--text);">${escHtml(subj.name)}</div>
        <div style="font-size:11px;color:${st.color};margin-top:2px;"><i class="fa-solid ${st.icon}" style="margin-right:4px;"></i>${st.label}</div>
        <div style="height:4px;background:var(--bg3);border-radius:4px;margin-top:6px;">
          <div style="height:4px;background:${subj.color};border-radius:4px;width:${pct}%;transition:width 0.4s;"></div>
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

window.openSubjectDetail = (subjectId) => {
  const subj = studentSubjects.find(s=>s.id===subjectId);
  if (!subj) return;
  editingSubjectId = subjectId;
  document.getElementById('subject-detail-title').innerHTML =
    `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${subj.color};margin-right:8px;vertical-align:middle;"></span>${escHtml(subj.name)}`;
  renderMasteryPicker(subj);
  renderChaptersList(subj);
  document.getElementById('subject-detail-modal').classList.add('open');
};

function renderMasteryPicker(subj) {
  const el = document.getElementById('subject-mastery-picker');
  if (!el) return;
  el.innerHTML = Object.entries(SUBJECT_STATUS).map(([key,st])=>`
    <div onclick="setSubjectMastery('${subj.id}','${key}')"
      style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;cursor:pointer;
             background:${(subj.masteryStatus||'none')===key?'rgba(255,255,255,0.06)':'transparent'};
             border:1px solid ${(subj.masteryStatus||'none')===key?st.color:'transparent'};">
      <i class="fa-solid ${st.icon}" style="color:${st.color};font-size:16px;flex-shrink:0;"></i>
      <span style="font-size:13px;font-weight:600;color:var(--text);">${st.label}</span>
      ${(subj.masteryStatus||'none')===key?'<i class="fa-solid fa-check" style="margin-left:auto;color:'+st.color+';"></i>':''}
    </div>`).join('');
}

window.setSubjectMastery = async (subjectId, status) => {
  const subj = studentSubjects.find(s=>s.id===subjectId);
  if (!subj) return;
  subj.masteryStatus = status;
  await saveStudentData();
  renderMasteryPicker(subj);
  renderSubjectsView();
};

function renderChaptersList(subj) {
  const listEl = document.getElementById('subject-chapters-list');
  if (!listEl) return;
  if (!subj.chapters?.length) {
    listEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Ajoute ton premier chapitre ci-dessous.</div>`;
    return;
  }
  const statusLabel = {unseen:'Non vu',inprogress:'En cours',mastered:'Maîtrisé'};
  const statusColor = {unseen:'var(--text3)',inprogress:'#f97316',mastered:'#22c55e'};
  const statusIcon  = {unseen:'fa-circle',inprogress:'fa-circle-half-stroke',mastered:'fa-circle-check'};
  listEl.innerHTML = subj.chapters.map(ch=>`
    <div style="display:flex;align-items:center;gap:10px;padding:12px 4px;border-bottom:1px solid var(--border);cursor:pointer;"
         onclick="cycleChapterStatus('${subj.id}','${ch.id}')">
      <i class="fa-solid ${statusIcon[ch.status]}" style="color:${statusColor[ch.status]};font-size:18px;flex-shrink:0;"></i>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(ch.name)}</div>
        <div style="font-size:11px;color:${statusColor[ch.status]};">${statusLabel[ch.status]}</div>
      </div>
      <button onclick="event.stopPropagation();deleteChapter('${subj.id}','${ch.id}')"
        style="background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;">
        <i class="fa-solid fa-trash" style="font-size:13px;"></i>
      </button>
    </div>`).join('');
}

window.cycleChapterStatus = async (subjectId, chapterId) => {
  const subj = studentSubjects.find(s=>s.id===subjectId);
  if (!subj) return;
  const cycle = {unseen:'inprogress',inprogress:'mastered',mastered:'unseen'};
  subj.chapters = subj.chapters.map(c=>c.id===chapterId?{...c,status:cycle[c.status]||'unseen'}:c);
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

window.deleteChapter = async (subjectId, chapterId) => {
  const subj = studentSubjects.find(s=>s.id===subjectId);
  if (!subj||!confirm('Supprimer ce chapitre ?')) return;
  subj.chapters = subj.chapters.filter(c=>c.id!==chapterId);
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

window.addChapterToSubject = async () => {
  const input = document.getElementById('new-chapter-input');
  const name  = input?.value.trim();
  if (!name) { showToast('Entre un nom de chapitre'); return; }
  const subj = studentSubjects.find(s=>s.id===editingSubjectId);
  if (!subj) return;
  if (!subj.chapters) subj.chapters=[];
  subj.chapters.push({id:`ch-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,name,status:'unseen'});
  input.value='';
  await saveStudentData();
  renderChaptersList(subj);
  renderSubjectsView();
};

window.openAddSubjectModal = () => {
  editingSubjectId=null;
  document.getElementById('subject-modal-title').textContent='Nouvelle matière';
  document.getElementById('subject-name-input').value='';
  document.getElementById('subject-delete-btn').style.display='none';
  _selectSubjectColorUI(SUBJECT_COLORS[0]);
  document.getElementById('subject-modal').classList.add('open');
  setTimeout(()=>document.getElementById('subject-name-input').focus(),100);
};

window.openEditSubjectModal = (subjectId) => {
  const subj = studentSubjects.find(s=>s.id===subjectId);
  if (!subj) return;
  editingSubjectId=subjectId;
  document.getElementById('subject-modal-title').textContent='Modifier la matière';
  document.getElementById('subject-name-input').value=subj.name;
  document.getElementById('subject-delete-btn').style.display='block';
  _selectSubjectColorUI(subj.color);
  document.getElementById('subject-modal').classList.add('open');
};

function _selectSubjectColorUI(color) {
  document.querySelectorAll('.subject-color-chip').forEach(c=>{
    c.style.outline=c.dataset.color===color?'3px solid #fff':'none';
    c.style.outlineOffset='2px';
  });
  const inp=document.getElementById('selected-subject-color');
  if(inp) inp.value=color;
}

window.selectSubjectColor = (color) => { _selectSubjectColorUI(color); };

window.saveSubject = async () => {
  const name  = document.getElementById('subject-name-input').value.trim();
  const color = document.getElementById('selected-subject-color')?.value||SUBJECT_COLORS[0];
  if (!name) { showToast('Entre un nom de matière'); return; }
  if (editingSubjectId) {
    studentSubjects = studentSubjects.map(s=>s.id===editingSubjectId?{...s,name,color}:s);
  } else {
    studentSubjects.push({
      id:`subj-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      name, color, chapters:[], masteryStatus:'none'
    });
  }
  await saveStudentData();
  closeModal('subject-modal');
  renderSubjectsView();
  showToast(editingSubjectId?'Matière modifiée':'Matière ajoutée');
};

window.deleteSubject = async () => {
  if (!editingSubjectId||!confirm('Supprimer cette matière et tous ses chapitres ?')) return;
  studentSubjects=studentSubjects.filter(s=>s.id!==editingSubjectId);
  await saveStudentData();
  closeModal('subject-modal');
  renderSubjectsView();
  showToast('Matière supprimée');
};

// ── PRIORITÉ MATIÈRE ──────────────────────────────────────────────────────────
function getPrioritySubject(dayKey) {
  if (!studentSubjects.length) return null;
  // Prioriser les matières pas encore maîtrisées
  const sorted = [...studentSubjects]
    .filter(s => s.masteryStatus !== 'mastered')
    .sort((a,b) => {
      const order = {none:0,some:1,good:2,mastered:3};
      return (order[a.masteryStatus||'none']||0) - (order[b.masteryStatus||'none']||0);
    });
  const priority = sorted[0] || studentSubjects[0];
  const nextCh   = priority?.chapters?.find(c=>c.status!=='mastered');
  return priority ? {subject:priority, chapter:nextCh} : null;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function timeToAbsMin(t) {
  if (!t) return 0;
  const [h,m] = t.split(':').map(Number);
  return h*60+m;
}
function absMinToTime(min) {
  const h = Math.floor(min/60);
  const m = min%60;
  return `${String(h>=24?h-24:h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function addMinutes(time, min) {
  return absMinToTime(timeToAbsMin(time)+min);
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Onboarding : proposition explicite du mode Student ──────────────────────
// Déclenché une seule fois, peu après la première tâche créée (jamais sur
// l'écran vide du tout premier lancement — un seul CTA à la fois, cf. spec).
window.maybeOfferStudentMode = () => {
  if (settings.studentModeEnabled || settings.studentPromptShown) return;
  settings.studentPromptShown = true;
  saveSettings();
  showCelebrationModal(
    '🎓',
    'Tu es étudiant ?',
    "Active le mode Student : emploi du temps, matières et sessions de révision générées automatiquement. Activable à tout moment depuis Paramètres.",
    () => { window.toggleStudentMode(); }
  );
};
