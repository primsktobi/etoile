// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITY.JS — Module de suivi de progression personnelle
//
//  Profils disponibles : vidéaste, reseaux, vendeur, rappeur
//  Saisie manuelle quotidienne → courbes de progression → motivation
//  Sauvegarde : Firebase + IDB (offline-first comme la flamme)
// ══════════════════════════════════════════════════════════════════════════════

// ── Définition des profils et de leurs métriques ────────────────────────────
const ACTIVITY_PROFILES = {
  vidéaste: {
    label: 'Vidéaste',
    icon: 'fa-video',
    color: '#ef4444',
    metrics: [
      { key: 'views',   label: 'Vues gagnées aujourd\'hui', unit: 'vues',  type: 'daily' },
      { key: 'subs',    label: 'Abonnés gagnés aujourd\'hui', unit: 'abonnés', type: 'daily' },
      { key: 'videos',  label: 'Vidéos postées cette semaine', unit: 'vidéos', type: 'weekly' },
    ]
  },
  reseaux: {
    label: 'Réseaux sociaux',
    icon: 'fa-hashtag',
    color: '#a855f7',
    metrics: [
      { key: 'followers', label: 'Followers gagnés aujourd\'hui', unit: 'followers', type: 'daily' },
      { key: 'posts',     label: 'Publications cette semaine', unit: 'posts', type: 'weekly' },
      { key: 'reach',     label: 'Portée du jour (vues)', unit: 'vues', type: 'daily' },
    ]
  },
  vendeur: {
    label: 'Vendeur',
    icon: 'fa-bag-shopping',
    color: '#22c55e',
    metrics: [
      { key: 'sales',    label: 'Articles vendus aujourd\'hui', unit: 'articles', type: 'daily' },
      { key: 'revenue',  label: 'Chiffre du jour (FCFA)', unit: 'FCFA', type: 'daily' },
    ]
  },
  rappeur: {
    label: 'Rappeur',
    icon: 'fa-microphone-lines',
    color: '#f97316',
    metrics: [
      { key: 'couplets', label: 'Couplets écrits aujourd\'hui', unit: 'couplets', type: 'daily' },
      { key: 'tracks',   label: 'Musiques postées ce mois', unit: 'musiques', type: 'monthly' },
    ]
  }
};

// ── State ───────────────────────────────────────────────────────────────────
let activityProfiles = [];   // profils actifs ex: ['vidéaste', 'vendeur']
let activityData = {};       // { 'vidéaste': { '2025-07-05': { views: 40, subs: 5 } } }
let activityDashCarouselIdx = 0;
let activityDashTimer = null;

// ── Navigation ───────────────────────────────────────────────────────────────
window.goToActivity = () => {
  // Utilise le même système que goTo — ajoute screen-activity à la gestion
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-activity').classList.add('active');
  renderActivityScreen();
};

// ── Chargement depuis Firebase + IDB ────────────────────────────────────────
async function loadActivityData() {
  // IDB d'abord
  const cachedProfiles = await idbGet('prefs', 'activityProfiles');
  const cachedData     = await idbGet('prefs', 'activityData');
  if (cachedProfiles?.value) activityProfiles = cachedProfiles.value;
  if (cachedData?.value)     activityData     = cachedData.value;

  // Firebase en arrière-plan
  if (currentUser) {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.activityProfiles) activityProfiles = d.activityProfiles;
        if (d.activityData)     activityData     = d.activityData;
        await idbPut('prefs', { key: 'activityProfiles', value: activityProfiles });
        await idbPut('prefs', { key: 'activityData',     value: activityData });
      }
    } catch(e) {}
  }
  renderActivityDashboard();
}

async function saveActivityData() {
  await idbPut('prefs', { key: 'activityProfiles', value: activityProfiles });
  await idbPut('prefs', { key: 'activityData',     value: activityData });
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), {
      activityProfiles,
      activityData
    }).catch(() => {});
  }
}

// ── Rendu écran activité ─────────────────────────────────────────────────────
function renderActivityScreen() {
  const empty = document.getElementById('activity-empty-state');
  const chartsWrap = document.getElementById('activity-charts-wrap');
  const motEl = document.getElementById('activity-motivation');

  if (!activityProfiles.length) {
    empty.style.display = 'block';
    chartsWrap.innerHTML = '';
    motEl.style.display = 'none';
    return;
  }

  empty.style.display = 'none';

  // Courbes pour chaque profil actif
  let chartsHtml = '';
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    chartsHtml += `<div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">
      <i class="fa-solid ${profile.icon}" style="color:${profile.color};margin-right:6px;"></i>${profile.label}
    </div>`;
    for (const metric of profile.metrics) {
      chartsHtml += buildChartHTML(profileKey, metric);
    }
  }
  chartsWrap.innerHTML = chartsHtml;

  // Message de motivation
  const msg = generateMotivationMessage();
  if (msg) {
    motEl.style.display = 'block';
    motEl.textContent = msg;
  } else {
    motEl.style.display = 'none';
  }
}

// ── Construction d'une courbe SVG ────────────────────────────────────────────
function buildChartHTML(profileKey, metric) {
  const data = activityData[profileKey] || {};
  // Derniers 7 jours
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(fmtDate(d));
  }
  const values = days.map(d => (data[d]?.[metric.key]) || 0);
  const total  = values.reduce((a, b) => a + b, 0);
  const today  = values[values.length - 1];
  const yesterday = values[values.length - 2] || 0;

  // Delta
  let deltaHtml = '';
  if (yesterday > 0) {
    const delta = today - yesterday;
    const sign  = delta > 0 ? '+' : '';
    const cls   = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    deltaHtml = `<span class="activity-chart-delta ${cls}">${sign}${delta} ${metric.unit} vs hier</span>`;
  }

  // SVG courbe
  const svgW = 300; const svgH = 60;
  const max   = Math.max(...values, 1);
  const pts   = values.map((v, i) => {
    const x = (i / 6) * svgW;
    const y = svgH - (v / max) * svgH;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const areaPath = `M${pts[0]} ${pts.map((p, i) => i === 0 ? '' : `L${p}`).join(' ')} L${svgW},${svgH} L0,${svgH} Z`;

  const profile = ACTIVITY_PROFILES[profileKey];
  const color   = profile?.color || 'var(--accent)';

  return `
  <div class="activity-chart-wrap">
    <div class="activity-chart-title">${metric.label}</div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
      <div class="activity-chart-value">${today.toLocaleString()} <span style="font-size:13px;color:var(--text3);font-weight:400;">${metric.unit} aujourd'hui</span></div>
    </div>
    ${deltaHtml}
    <svg class="activity-svg" viewBox="0 0 ${svgW} ${svgH}" style="margin-top:10px;">
      <defs>
        <linearGradient id="grad-${profileKey}-${metric.key}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="activity-svg-area" d="${areaPath}" fill="url(#grad-${profileKey}-${metric.key})"/>
      <polyline class="activity-svg-line" points="${polyline}" style="stroke:${color};"/>
      ${values.map((v, i) => {
        const x = (i / 6) * svgW;
        const y = svgH - (v / max) * svgH;
        return `<circle class="activity-svg-dot" cx="${x}" cy="${y}" r="3.5" style="fill:${color};"/>`;
      }).join('')}
    </svg>
    <div style="font-size:11px;color:var(--text3);margin-top:6px;">Total 7 jours : ${total.toLocaleString()} ${metric.unit}</div>
  </div>`;
}

// ── Saisie du jour ───────────────────────────────────────────────────────────
window.openActivityEntry = () => {
  if (!activityProfiles.length) {
    showToast('Configure ton activité dans les paramètres');
    return;
  }
  const today = fmtDate(new Date());
  const fieldsEl = document.getElementById('activity-entry-fields');
  let html = '';
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    html += `<div style="margin-bottom:6px;font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-top:14px;">
      <i class="fa-solid ${profile.icon}" style="color:${profile.color};margin-right:6px;"></i>${profile.label}
    </div>`;
    for (const metric of profile.metrics) {
      const existing = activityData[profileKey]?.[today]?.[metric.key] || '';
      html += `<div class="activity-field">
        <div class="activity-field-label">${metric.label}</div>
        <input type="number" min="0" id="act-${profileKey}-${metric.key}" value="${existing}" placeholder="0" />
      </div>`;
    }
  }
  fieldsEl.innerHTML = html;
  document.getElementById('activity-entry-modal').classList.add('open');
};

window.saveActivityEntry = async () => {
  const today = fmtDate(new Date());
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    if (!activityData[profileKey]) activityData[profileKey] = {};
    if (!activityData[profileKey][today]) activityData[profileKey][today] = {};
    for (const metric of profile.metrics) {
      const el = document.getElementById(`act-${profileKey}-${metric.key}`);
      if (el) activityData[profileKey][today][metric.key] = parseInt(el.value) || 0;
    }
  }
  await saveActivityData();
  closeModal('activity-entry-modal');
  renderActivityScreen();
  renderActivityDashboard();
  showToast('Activité enregistrée');
};

// ── Message de motivation ────────────────────────────────────────────────────
function generateMotivationMessage() {
  if (!activityProfiles.length) return null;
  const today     = fmtDate(new Date());
  const yesterday = fmtDate(new Date(Date.now() - 86400000));
  const messages  = [];

  for (const profileKey of activityProfiles) {
    const profile  = ACTIVITY_PROFILES[profileKey];
    const todayD   = activityData[profileKey]?.[today]   || {};
    const yestD    = activityData[profileKey]?.[yesterday] || {};
    for (const metric of profile.metrics) {
      const t = todayD[metric.key] || 0;
      const y = yestD[metric.key]  || 0;
      if (t > 0 && y > 0) {
        if (t > y * 1.5) messages.push(`Exceptionnel — tes ${metric.unit} ont explosé aujourd'hui. Continue sur cette lancée.`);
        else if (t > y)  messages.push(`Progression régulière sur tes ${metric.unit}. C'est comme ça qu'on construit quelque chose de grand.`);
        else if (t === y) messages.push(`Constance parfaite. La régularité est la clé de la réussite.`);
        else              messages.push(`Journée plus calme, mais tu es là. C'est déjà une victoire.`);
      } else if (t > 0) {
        messages.push(`Premier pas enregistré. Chaque grande aventure commence par un seul chiffre.`);
      }
    }
  }
  return messages.length ? messages[Math.floor(Math.random() * messages.length)] : null;
}

// ── Dashboard — courbe carousel ──────────────────────────────────────────────
window.renderActivityDashboard = function() {
  const wrap = document.getElementById('activity-dashboard-wrap');
  if (!wrap) return;
  if (!activityProfiles.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  // Collecter toutes les métriques actives
  const allMetrics = [];
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    for (const metric of profile.metrics) {
      allMetrics.push({ profileKey, metric, profile });
    }
  }
  if (!allMetrics.length) return;

  // Afficher la métrique courante
  const idx = activityDashCarouselIdx % allMetrics.length;
  const { profileKey, metric, profile } = allMetrics[idx];
  const data  = activityData[profileKey] || {};
  const today = fmtDate(new Date());
  const val   = data[today]?.[metric.key] || 0;

  // Derniers 7 jours pour mini courbe
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(fmtDate(d));
  }
  const values = days.map(d => data[d]?.[metric.key] || 0);
  const max    = Math.max(...values, 1);
  const svgW = 120; const svgH = 30;
  const pts  = values.map((v, i) => `${(i/6)*svgW},${svgH - (v/max)*svgH}`).join(' ');

  wrap.innerHTML = `
  <div class="activity-dash-card" style="background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;font-weight:700;margin-bottom:2px;">
        <i class="fa-solid ${profile.icon}" style="color:${profile.color};margin-right:4px;"></i>${profile.label}
      </div>
      <div style="font-size:22px;font-weight:900;color:var(--text);">${val.toLocaleString()}</div>
      <div style="font-size:11px;color:var(--text3);">${metric.unit} aujourd'hui</div>
    </div>
    <svg viewBox="0 0 ${svgW} ${svgH}" style="width:${svgW}px;height:${svgH}px;flex-shrink:0;">
      <polyline points="${pts}" fill="none" stroke="${profile.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;

  // Points de navigation si plusieurs métriques
  if (allMetrics.length > 1) {
    wrap.innerHTML += `<div style="display:flex;gap:5px;justify-content:center;margin-top:-10px;margin-bottom:12px;">
      ${allMetrics.map((_, i) => `<div style="width:5px;height:5px;border-radius:50%;background:${i===idx?'var(--accent)':'var(--border)'};transition:background 0.3s;"></div>`).join('')}
    </div>`;
  }

  // Carousel auto
  if (activityDashTimer) clearInterval(activityDashTimer);
  if (allMetrics.length > 1) {
    activityDashTimer = setInterval(() => {
      activityDashCarouselIdx = (activityDashCarouselIdx + 1) % allMetrics.length;
      renderActivityDashboard();
    }, 5000);
  }
};

// ── Paramètres — sélection des profils ──────────────────────────────────────
window.openActivitySettings = () => {
  const el = document.getElementById('activity-profile-chips');
  if (!el) return;
  el.innerHTML = Object.entries(ACTIVITY_PROFILES).map(([key, p]) => `
    <div class="activity-profile-chip ${activityProfiles.includes(key) ? 'selected' : ''}"
         onclick="toggleActivityProfile('${key}', this)">
      <i class="fa-solid ${p.icon}" style="margin-right:6px;"></i>${p.label}
    </div>`).join('');
  document.getElementById('activity-settings-modal').classList.add('open');
};

function updateActivitySummary() {
  const el = document.getElementById('activity-profiles-summary');
  if (!el) return;
  el.textContent = activityProfiles.length
    ? activityProfiles.map(k => ACTIVITY_PROFILES[k]?.label || k).join(', ')
    : 'Non configuré';
}

window.toggleActivityProfile = (key, el) => {
  if (activityProfiles.includes(key)) {
    activityProfiles = activityProfiles.filter(k => k !== key);
    el.classList.remove('selected');
  } else {
    activityProfiles.push(key);
    el.classList.add('selected');
  }
  saveActivityData();
  updateActivitySummary();
  renderActivityDashboard();
};

// Helper date
function fmtDate(d) {
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
}
