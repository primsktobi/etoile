// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITY.JS — Module de suivi de progression personnelle
//  Comme Mémos : s'ouvre dans le topbar, pas dans tasks
// ══════════════════════════════════════════════════════════════════════════════

const ACTIVITY_PROFILES = {
  vidéaste: {
    label: 'Vidéaste', icon: 'fa-video', color: '#ef4444',
    emoji: '🎬',
    description: 'Tes vues, abonnés et vidéos publiées',
    metrics: [
      { key: 'views',  label: 'Vues gagnées', unit: 'vues',    icon: '👁' },
      { key: 'subs',   label: 'Nouveaux abonnés', unit: 'abonnés', icon: '👥' },
      { key: 'videos', label: 'Vidéos publiées', unit: 'vidéos', icon: '📹' },
    ]
  },
  reseaux: {
    label: 'Réseaux sociaux', icon: 'fa-hashtag', color: '#a855f7',
    emoji: '📱',
    description: 'Tes followers, posts et portée',
    metrics: [
      { key: 'followers', label: 'Nouveaux followers', unit: 'followers', icon: '👥' },
      { key: 'posts',     label: 'Publications', unit: 'posts', icon: '📸' },
      { key: 'reach',     label: 'Portée (vues)', unit: 'vues', icon: '👁' },
    ]
  },
  vendeur: {
    label: 'Vendeur', icon: 'fa-bag-shopping', color: '#22c55e',
    emoji: '🛍️',
    description: 'Tes ventes et chiffre du jour',
    metrics: [
      { key: 'sales',   label: 'Articles vendus', unit: 'articles', icon: '📦' },
      { key: 'revenue', label: 'Chiffre du jour', unit: 'FCFA', icon: '💰' },
    ]
  },
  rappeur: {
    label: 'Rappeur', icon: 'fa-microphone-lines', color: '#f97316',
    emoji: '🎤',
    description: 'Tes couplets, sons et concerts',
    metrics: [
      { key: 'couplets',  label: 'Couplets écrits', unit: 'couplets', icon: '✍️' },
      { key: 'tracks',    label: 'Sons publiés', unit: 'sons', icon: '🎵' },
      { key: 'streams',   label: 'Streams du jour', unit: 'écoutes', icon: '▶️' },
    ]
  }
};

let activityProfiles = [];
let activityData = {};
let activityDashCarouselIdx = 0;
let activityDashTimer = null;

// ── Navigation — exactement comme Mémos ─────────────────────────────────────
window.goToActivity = () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-activity').classList.add('active');
  document.getElementById('fab-add').style.display = 'none';
  document.getElementById('topbar-title').textContent = '📈 Activité';
  renderActivityScreen();
};

// ── Chargement ───────────────────────────────────────────────────────────────
async function loadActivityData() {
  const cachedProfiles = await idbGet('prefs', 'activityProfiles');
  const cachedData     = await idbGet('prefs', 'activityData');
  if (cachedProfiles?.value) activityProfiles = cachedProfiles.value;
  if (cachedData?.value)     activityData     = cachedData.value;
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
  updateActivitySummary();
  renderActivityDashboard();
}

async function saveActivityData() {
  await idbPut('prefs', { key: 'activityProfiles', value: activityProfiles });
  await idbPut('prefs', { key: 'activityData',     value: activityData });
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), { activityProfiles, activityData }).catch(() => {});
  }
}

// ── Rendu écran activité ─────────────────────────────────────────────────────
function renderActivityScreen() {
  const empty     = document.getElementById('activity-empty-state');
  const chartsWrap = document.getElementById('activity-charts-wrap');
  const motEl     = document.getElementById('activity-motivation');
  if (!empty || !chartsWrap) return;

  if (!activityProfiles.length) {
    empty.style.display = 'block';
    chartsWrap.innerHTML = '';
    if (motEl) motEl.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  let html = '';
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    html += buildProfileSection(profileKey, profile);
  }
  chartsWrap.innerHTML = html;

  const msg = generateActivityMotivation();
  if (motEl) {
    if (msg) { motEl.style.display = 'block'; motEl.innerHTML = msg; }
    else motEl.style.display = 'none';
  }
}

// ── Section profil avec courbe scrollable ────────────────────────────────────
function buildProfileSection(profileKey, profile) {
  const data = activityData[profileKey] || {};

  // Tous les jours avec des données — trié chronologiquement
  const allDays = Object.keys(data).sort();
  // Minimum 30 jours visibles (avec zéros si pas de données)
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = window.fmtDate ? window.fmtDate(d) : d.toISOString().slice(0,10);
    if (!days.includes(ds)) days.push(ds);
  }
  // Ajouter les jours plus anciens si données existent
  for (const d of allDays) {
    if (!days.includes(d)) days.unshift(d);
  }

  let sectionHtml = `
  <div style="margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:0 2px;">
      <span style="font-size:24px;">${profile.emoji}</span>
      <div>
        <div style="font-size:16px;font-weight:900;color:var(--text);">${profile.label}</div>
        <div style="font-size:12px;color:var(--text3);">${profile.description}</div>
      </div>
    </div>`;

  for (const metric of profile.metrics) {
    sectionHtml += buildScrollableChart(profileKey, metric, profile, days, data);
  }

  sectionHtml += `</div>`;
  return sectionHtml;
}

// ── Courbe scrollable horizontalement ────────────────────────────────────────
function buildScrollableChart(profileKey, metric, profile, days, data) {
  const values = days.map(d => data[d]?.[metric.key] || 0);
  const today  = window.fmtDate ? window.fmtDate(new Date()) : new Date().toISOString().slice(0,10);
  const todayVal = data[today]?.[metric.key] || 0;
  const total  = values.reduce((a, b) => a + b, 0);
  const max    = Math.max(...values, 1);

  // Calcul tendance
  const last7  = values.slice(-7);
  const prev7  = values.slice(-14, -7);
  const last7sum = last7.reduce((a,b) => a+b, 0);
  const prev7sum = prev7.reduce((a,b) => a+b, 0);
  let trendHtml = '';
  if (prev7sum > 0) {
    const delta = last7sum - prev7sum;
    const pct   = Math.round(Math.abs(delta) / prev7sum * 100);
    if (delta > 0) trendHtml = `<span style="color:#22c55e;font-size:12px;font-weight:700;">↑ +${pct}% vs semaine précédente</span>`;
    else if (delta < 0) trendHtml = `<span style="color:#ef4444;font-size:12px;font-weight:700;">↓ -${pct}% vs semaine précédente</span>`;
    else trendHtml = `<span style="color:var(--text3);font-size:12px;">→ Stable vs semaine précédente</span>`;
  }

  // SVG scrollable — 1 point par jour, largeur dynamique
  const ptW = 40; // largeur par point
  const svgW = days.length * ptW;
  const svgH = 80;
  const pts  = values.map((v, i) => `${i * ptW + ptW/2},${svgH - 8 - (v / max) * (svgH - 16)}`);
  const polyline = pts.join(' ');
  const areaPath = `M${pts[0]} ${pts.slice(1).map(p => `L${p}`).join(' ')} L${(days.length-1)*ptW+ptW/2},${svgH} L${ptW/2},${svgH} Z`;

  // Étiquettes jours
  const dayLabels = days.map((d, i) => {
    const date = new Date(d + 'T12:00:00');
    const isToday = d === today;
    const label = isToday ? 'Auj.' : `${date.getDate()}/${date.getMonth()+1}`;
    const x = i * ptW + ptW/2;
    return `<text x="${x}" y="${svgH + 14}" text-anchor="middle" font-size="9"
      fill="${isToday ? profile.color : 'var(--text3)'}"
      font-weight="${isToday ? '700' : '400'}">${label}</text>`;
  }).join('');

  // Points avec valeur au survol (on affiche les valeurs non-nulles)
  const dots = values.map((v, i) => {
    const x = i * ptW + ptW/2;
    const y = svgH - 8 - (v / max) * (svgH - 16);
    const isToday = days[i] === today;
    if (v === 0 && !isToday) return '';
    return `<circle cx="${x}" cy="${y}" r="${isToday ? 5 : 3.5}"
      fill="${isToday ? profile.color : profile.color}"
      opacity="${isToday ? 1 : 0.7}"/>
      ${v > 0 ? `<text x="${x}" y="${y - 8}" text-anchor="middle" font-size="9" fill="${profile.color}" font-weight="700">${v}</text>` : ''}`;
  }).join('');

  return `
  <div class="activity-chart-wrap" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:16px;">${metric.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">${metric.label}</div>
          ${trendHtml}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:900;color:${profile.color};">${todayVal.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text3);">aujourd'hui</div>
      </div>
    </div>

    <!-- Courbe scrollable horizontalement -->
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;">
      <svg viewBox="0 0 ${svgW} ${svgH + 20}" width="${svgW}" height="${svgH + 20}" style="display:block;">
        <defs>
          <linearGradient id="ag-${profileKey}-${metric.key}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${profile.color}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${profile.color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#ag-${profileKey}-${metric.key})"/>
        <polyline points="${polyline}" fill="none" stroke="${profile.color}" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${dayLabels}
      </svg>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text3);">Total : <strong style="color:var(--text);">${total.toLocaleString()} ${metric.unit}</strong></div>
      <div style="font-size:11px;color:var(--text3);">Meilleur : <strong style="color:${profile.color};">${Math.max(...values).toLocaleString()} ${metric.unit}</strong></div>
    </div>
  </div>`;
}

// ── Message de motivation activité ───────────────────────────────────────────
function generateActivityMotivation() {
  if (!activityProfiles.length) return null;
  const today     = window.fmtDate ? window.fmtDate(new Date()) : new Date().toISOString().slice(0,10);
  const yesterday = window.fmtDate ? window.fmtDate(new Date(Date.now()-86400000)) : new Date(Date.now()-86400000).toISOString().slice(0,10);
  const msgs = [];

  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    const todayD  = activityData[profileKey]?.[today] || {};
    const yesterD = activityData[profileKey]?.[yesterday] || {};

    for (const metric of profile.metrics) {
      const t = todayD[metric.key] || 0;
      const y = yesterD[metric.key] || 0;

      if (profileKey === 'rappeur') {
        if (t > 0 && metric.key === 'couplets') {
          if (t >= 10) msgs.push(`${t} couplets aujourd'hui. Tu as travaillé ta plume sérieusement. C'est comme ça qu'on forge un style.`);
          else if (t >= 5) msgs.push(`${t} couplets. Bien. Mais sois honnête — est-ce que chaque ligne est vraiment forte ? La quantité, c'est bien. La qualité, c'est ce qui reste.`);
          else msgs.push(`${t} couplet${t>1?'s':''}. Petit jour ou grand début ? Continue d'écrire, même quand ça ne sort pas facilement.`);
        }
        if (t > 0 && metric.key === 'tracks') {
          msgs.push(`${t} son${t>1?'s':''} publié${t>1?'s':''} ce mois. Est-ce que tu as fait la promo de chaque sortie ? Un bon son sans promo, c'est une perte.`);
        }
        if (t > 0 && metric.key === 'streams') {
          if (t > y * 1.5 && y > 0) msgs.push(`Tes écoutes ont explosé aujourd'hui. Quelque chose a marché — identifie quoi et reproduis-le.`);
          else if (t < y * 0.5 && y > 0) msgs.push(`Moins d'écoutes qu'hier. Ça fluctue — l'important c'est la tendance sur le mois, pas un seul jour.`);
        }
      }

      if (profileKey === 'vidéaste') {
        if (metric.key === 'views' && t > 0) {
          if (t > y * 2 && y > 0) msgs.push(`Tes vues ont doublé aujourd'hui. Analyse cette vidéo — miniature, titre, hook. Tu as trouvé quelque chose qui marche.`);
          else if (t < 100 && t > 0) msgs.push(`${t} vues. Si tes vues stagnent, la priorité c'est le hook des 3 premières secondes. Les algorithmes mesurent ça.`);
        }
        if (metric.key === 'subs' && t > 0) {
          msgs.push(`+${t} abonnés aujourd'hui. Continue de publier régulièrement — la croissance n'est jamais linéaire.`);
        }
      }

      if (profileKey === 'vendeur') {
        if (metric.key === 'sales' && t > 0) {
          if (t > y && y > 0) msgs.push(`Plus de ventes qu'hier. Qu'est-ce que tu as fait différemment ? Reproduis-le.`);
          else if (t === 0) msgs.push(`Pas de ventes aujourd'hui. Ce n'est pas un problème si tu travailles sur quelque chose. Mais si tu attends — agis.`);
        }
      }
    }
  }

  if (!msgs.length) return null;
  const m = msgs[Math.floor(Math.random() * msgs.length)];
  return `<div style="display:flex;gap:10px;align-items:flex-start;">
    <i class="fa-solid fa-brain" style="color:var(--accent);margin-top:2px;flex-shrink:0;"></i>
    <div style="font-size:13px;color:var(--text);line-height:1.65;">${m}</div>
  </div>`;
}

// ── Saisie du jour ───────────────────────────────────────────────────────────
window.openActivityEntry = () => {
  if (!activityProfiles.length) {
    showToast('Configure ton activité dans les paramètres');
    return;
  }
  const today = window.fmtDate ? window.fmtDate(new Date()) : new Date().toISOString().slice(0,10);
  const fieldsEl = document.getElementById('activity-entry-fields');
  let html = '';
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    html += `<div style="margin:14px 0 6px;font-size:13px;font-weight:800;color:var(--text);">
      ${profile.emoji} ${profile.label}
    </div>`;
    for (const metric of profile.metrics) {
      const existing = activityData[profileKey]?.[today]?.[metric.key] || '';
      html += `<div class="activity-field">
        <div class="activity-field-label">${metric.icon} ${metric.label}</div>
        <input type="number" min="0" id="act-${profileKey}-${metric.key}" value="${existing}" placeholder="0" />
      </div>`;
    }
  }
  fieldsEl.innerHTML = html;
  document.getElementById('activity-entry-modal').classList.add('open');
};

window.saveActivityEntry = async () => {
  const today = window.fmtDate ? window.fmtDate(new Date()) : new Date().toISOString().slice(0,10);
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

// ── Dashboard carousel ───────────────────────────────────────────────────────
window.renderActivityDashboard = function() {
  const wrap = document.getElementById('activity-dashboard-wrap');
  if (!wrap) return;
  if (!activityProfiles.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const allMetrics = [];
  for (const profileKey of activityProfiles) {
    const profile = ACTIVITY_PROFILES[profileKey];
    if (!profile) continue;
    for (const metric of profile.metrics) allMetrics.push({ profileKey, metric, profile });
  }
  if (!allMetrics.length) return;

  const idx = activityDashCarouselIdx % allMetrics.length;
  const { profileKey, metric, profile } = allMetrics[idx];
  const data  = activityData[profileKey] || {};
  const today = window.fmtDate ? window.fmtDate(new Date()) : new Date().toISOString().slice(0,10);
  const val   = data[today]?.[metric.key] || 0;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(window.fmtDate ? window.fmtDate(d) : d.toISOString().slice(0,10));
  }
  const values = days.map(d => data[d]?.[metric.key] || 0);
  const max    = Math.max(...values, 1);
  const svgW = 120; const svgH = 30;
  const pts  = values.map((v, i) => `${(i/6)*svgW},${svgH - (v/max)*svgH}`).join(' ');

  wrap.innerHTML = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;font-weight:700;margin-bottom:2px;">
        ${profile.emoji} ${profile.label}
      </div>
      <div style="font-size:22px;font-weight:900;color:var(--text);">${val.toLocaleString()}</div>
      <div style="font-size:11px;color:var(--text3);">${metric.icon} ${metric.unit} aujourd'hui</div>
    </div>
    <svg viewBox="0 0 ${svgW} ${svgH}" style="width:${svgW}px;height:${svgH}px;flex-shrink:0;">
      <polyline points="${pts}" fill="none" stroke="${profile.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  ${allMetrics.length > 1 ? `<div style="display:flex;gap:5px;justify-content:center;margin-top:-10px;margin-bottom:12px;">
    ${allMetrics.map((_, i) => `<div style="width:5px;height:5px;border-radius:50%;background:${i===idx?'var(--accent)':'var(--border)'};transition:background 0.3s;"></div>`).join('')}
  </div>` : ''}`;

  if (activityDashTimer) clearInterval(activityDashTimer);
  if (allMetrics.length > 1) {
    activityDashTimer = setInterval(() => {
      activityDashCarouselIdx = (activityDashCarouselIdx + 1) % allMetrics.length;
      renderActivityDashboard();
    }, 5000);
  }
};

// ── Paramètres ───────────────────────────────────────────────────────────────
window.openActivitySettings = () => {
  const el = document.getElementById('activity-profile-chips');
  if (!el) return;
  el.innerHTML = Object.entries(ACTIVITY_PROFILES).map(([key, p]) => `
    <div class="activity-profile-chip ${activityProfiles.includes(key) ? 'selected' : ''}"
         onclick="toggleActivityProfile('${key}', this)">
      <span style="font-size:18px;margin-right:6px;">${p.emoji}</span>${p.label}
      <div style="font-size:10px;opacity:0.7;margin-top:2px;">${p.description}</div>
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
  // Mettre à jour l'écran activité si déjà ouvert
  if (document.getElementById('screen-activity')?.classList.contains('active')) {
    renderActivityScreen();
  }
};
