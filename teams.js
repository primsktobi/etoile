let teamLastSeen = {}; 
let teamLastMessageTime = {}; 

function renderTeams() {
  const el = document.getElementById('teams-list');
  if (!el) return;
  if (myTeams.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Aucune équipe</div><div class="empty-sub">Crée ou rejoins une équipe</div></div>`;
    return;
  }
  el.innerHTML = myTeams.map(team => {
    const cnt = team.memberIds?.length || 0;
    const pend = team.pending?.length || 0;
    const isOwner = team.ownerId === currentUser.uid;
    const lastMsg = teamLastMessageTime[team.id] || 0;
    const lastSeen = teamLastSeen[team.id] || 0;
    const hasUnread = lastMsg > lastSeen;

    // DM — afficher le pseudo et la photo de l'autre personne
    if (team.type === 'dm') {
      const other = team.members?.find(m => m.uid !== currentUser.uid);
      const otherName = other?.pseudo || '?';
      const otherPhoto = other?.photoURL || '';
      const initials = otherName.slice(0, 2).toUpperCase();
      const avatarHtml = otherPhoto
        ? `<img src="${otherPhoto}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;">`
        : `<div class="team-avatar">${initials}</div>`;
      return `<div class="team-card fade-in" onclick="openTeamDetail('${team.id}')" style="position:relative;">
        ${hasUnread ? '<span class="nav-dot" style="position:absolute;top:10px;right:10px;"></span>' : ''}
        <div class="team-header">
          ${avatarHtml}
          <div>
            <div class="team-name">${escHtml(otherName)}</div>
            <div class="team-id" style="color:var(--text3);font-size:12px;">Message privé</div>
          </div>
        </div>
      </div>`;
    }

    // Groupe standard
    return `<div class="team-card fade-in" onclick="openTeamDetail('${team.id}')" style="position:relative;">
      ${hasUnread ? '<span class="nav-dot" style="position:absolute;top:10px;right:10px;"></span>' : ''}
      <div class="team-header">
        <div class="team-avatar">${(team.name||'??').slice(0,2).toUpperCase()}</div>
        <div>
          <div class="team-name">${escHtml(team.name)}</div>
          <div class="team-id"># ${team.id.slice(0,8)}…</div>
          <div class="team-members">👤 ${cnt} membre${cnt>1?'s':''}</div>
        </div>
        <div style="margin-left:auto;display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          ${isOwner ? '<span class="badge badge-blue">Admin</span>' : '<span class="badge badge-green">Membre</span>'}
          ${pend > 0 ? `<span class="badge badge-orange">⏳ ${pend}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateTeamsBadge() {
  const hasPending = myTeams.some(t => t.ownerId===currentUser.uid && (t.pending?.length||0)>0);
  const hasUnreadAny = myTeams.some(t => (teamLastMessageTime[t.id]||0) > (teamLastSeen[t.id]||0));
  const dot = document.getElementById('teams-dot');
  if (dot) dot.style.display = (hasPending || hasUnreadAny) ? 'block' : 'none';
}

// ── Écoute légère du dernier message de chaque équipe (pour le point rouge) ──
let teamUnreadUnsubs = {};
function startTeamUnreadListeners() {
  Object.values(teamUnreadUnsubs).forEach(u => u());
  teamUnreadUnsubs = {};
  myTeams.forEach(team => {
    const mq = query(collection(db, 'teamMessages'), where('teamId', '==', team.id));
    teamUnreadUnsubs[team.id] = onSnapshot(mq, snap => {
      let latest = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.uid === currentUser.uid) return; // on ignore ses propres messages envoyés
        const ts = data.timestamp?.toMillis?.() || 0;
        if (ts > latest) latest = ts;
      });
      teamLastMessageTime[team.id] = latest;
      renderTeams();
      updateTeamsBadge();
    }, () => {});
  });
}

window.openDM = () => {
  teamMode = 'dm';
  document.getElementById('team-modal-title').textContent = 'Nouveau message';
  document.getElementById('team-name-label').textContent = 'Nom d\'utilisateur';
  document.getElementById('team-name-input').placeholder = 'Rechercher par nom d\'utilisateur';
  document.getElementById('team-name-input').value = '';
  document.getElementById('team-name-input').style.display = 'block';
  document.getElementById('join-id-wrap').style.display = 'none';
  document.getElementById('dm-results-wrap').style.display = 'none';
  document.getElementById('dm-results-list').innerHTML = '';
  document.getElementById('team-modal-action-btn').textContent = 'Rechercher';
  document.getElementById('team-modal').classList.add('open');
};

window.openCreateTeam = () => {
  teamMode = 'create';
  document.getElementById('team-modal-title').textContent = 'Créer une équipe';
  document.getElementById('team-name-label').textContent = 'Nom de l\'équipe';
  document.getElementById('team-name-input').placeholder = 'Ex: Groupe de révision';
  document.getElementById('team-modal-action-btn').textContent = 'Créer';
  document.getElementById('team-name-input').value = '';
  document.getElementById('team-name-input').style.display = 'block';
  document.getElementById('join-id-wrap').style.display = 'none';
  document.getElementById('dm-results-wrap').style.display = 'none';
  document.getElementById('team-modal').classList.add('open');
};

window.openJoinTeam = () => {
  teamMode = 'join';
  document.getElementById('team-modal-title').textContent = 'Rejoindre une équipe';
  document.getElementById('team-name-label').textContent = 'Nom de l\'équipe';
  document.getElementById('team-modal-action-btn').textContent = 'Envoyer la demande';
  document.getElementById('team-name-input').style.display = 'none';
  document.getElementById('join-id-wrap').style.display = 'block';
  document.getElementById('dm-results-wrap').style.display = 'none';
  document.getElementById('team-join-id-input').value = '';
  document.getElementById('team-modal').classList.add('open');
};

window.closeTeamModal = () => {
  document.getElementById('team-modal').classList.remove('open');
  document.getElementById('team-name-input').style.display = 'block';
  document.getElementById('dm-results-wrap').style.display = 'none';
  document.getElementById('dm-results-list').innerHTML = '';
};

window.confirmTeamAction = async () => {
  if (teamMode === 'dm') {
    const search = document.getElementById('team-name-input').value.trim().toLowerCase();
    if (!search) { showToast('Entre un nom d\'utilisateur'); return; }

    // Recherche dans users par username — contient la valeur saisie
    const snap = await getDocs(query(collection(db, 'users'), where('username', '>=', search), where('username', '<=', search + '\uf8ff')));
    const results = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== currentUser.uid); // exclure soi-même

    const listEl = document.getElementById('dm-results-list');
    document.getElementById('dm-results-wrap').style.display = 'block';

    if (results.length === 0) {
      listEl.innerHTML = `<div style="padding:12px;color:var(--text3);font-size:13px;text-align:center;">Aucun résultat</div>`;
      return;
    }

    listEl.innerHTML = results.map(u => {
      const photo = u.photoURL || u.photoBase64 || '';
      const initials = (u.pseudo || u.username || '?').slice(0, 2).toUpperCase();
      const avatar = photo
        ? `<img src="${photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
        : `<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${initials}</div>`;
      return `<div onclick="startDM('${u.uid}')" style="display:flex;align-items:center;gap:12px;padding:10px 4px;cursor:pointer;border-bottom:1px solid var(--border);">
        ${avatar}
        <div>
          <div style="font-weight:600;font-size:14px;">${escHtml(u.pseudo || u.username)}</div>
          <div style="font-size:12px;color:var(--text3);">@${escHtml(u.username)}</div>
        </div>
      </div>`;
    }).join('');

    // Changer le bouton en "Fermer" après les résultats
    document.getElementById('team-modal-action-btn').textContent = 'Rechercher encore';
    return;
  }

  if (teamMode === 'create') {
    const name = document.getElementById('team-name-input').value.trim();
    if (!name) { showToast('Donne un nom à ton équipe'); return; }
    const ref2 = await addDoc(collection(db,'teams'), {
      name, ownerId: currentUser.uid,
      memberIds: [currentUser.uid],
      members: [{ uid: currentUser.uid, pseudo: userProfile.pseudo||currentUser.displayName||'?', photoURL: userProfile.photoURL||'', groupAvatar: userProfile.groupAvatar||'ga1', joinedAt: Date.now() }],
      pending: [], allowIdCopy: true, createdAt: serverTimestamp()
    });
    showToast('Équipe créée');
    closeTeamModal();
    setTimeout(() => openTeamDetail(ref2.id), 400);

  } else {
    const teamId = document.getElementById('team-join-id-input').value.trim();
    if (!teamId) { showToast('Colle l\'ID de l\'équipe'); return; }
    const snap = await getDoc(doc(db,'teams',teamId));
    if (!snap.exists()) { showToast('Équipe introuvable'); return; }
    const team = snap.data();
    if (team.memberIds?.includes(currentUser.uid)) { showToast('Tu es déjà dans cette équipe'); return; }
    if (team.pending?.find(p => p.uid===currentUser.uid)) { showToast('Demande déjà envoyée'); return; }
    await updateDoc(doc(db,'teams',teamId), {
      pending: [...(team.pending||[]), { uid: currentUser.uid, pseudo: userProfile.pseudo||currentUser.displayName, photoURL: userProfile.photoURL||'', groupAvatar: userProfile.groupAvatar||'ga1' }]
    });
    showToast('Demande envoyée');
    closeTeamModal();
  }
};

window.startDM = async (otherUid) => {
  // Vérifier si un DM existe déjà entre les deux utilisateurs
  const existing = myTeams.find(t =>
    t.type === 'dm' &&
    t.memberIds?.includes(otherUid) &&
    t.memberIds?.includes(currentUser.uid) &&
    t.memberIds?.length === 2
  );

  if (existing) {
    closeTeamModal();
    setTimeout(() => openTeamDetail(existing.id), 400);
    return;
  }

  // Récupérer le profil de l'autre personne
  const otherSnap = await getDoc(doc(db, 'users', otherUid));
  if (!otherSnap.exists()) { showToast('Utilisateur introuvable'); return; }
  const other = otherSnap.data();

  // Créer le DM — même structure qu'un groupe mais type:'dm', sans pending ni allowIdCopy
  const ref2 = await addDoc(collection(db, 'teams'), {
    type: 'dm',
    name: '',  // pas de nom fixe — chaque côté affiche le pseudo de l'autre
    ownerId: currentUser.uid,
    memberIds: [currentUser.uid, otherUid],
    members: [
      { uid: currentUser.uid, pseudo: userProfile.pseudo||currentUser.displayName||'?', photoURL: userProfile.photoURL||'', groupAvatar: userProfile.groupAvatar||'ga1', joinedAt: Date.now() },
      { uid: otherUid, pseudo: other.pseudo||other.username||'?', photoURL: other.photoURL||other.photoBase64||'', groupAvatar: other.groupAvatar||'ga1', joinedAt: Date.now() }
    ],
    pending: [],
    createdAt: serverTimestamp()
  });

  closeTeamModal();
  setTimeout(() => openTeamDetail(ref2.id), 400);
};

let teamItemsUnsub = null;
let teamChatCache = [];

window.openTeamDetail = async (teamId) => {
  currentTeamId = teamId;
  const snap = await getDoc(doc(db,'teams',teamId));
  if (!snap.exists()) return;
  const team = { id: snap.id, ...snap.data() };

  if (team.type === 'dm') {
    // DM — afficher le pseudo et la photo de l'autre personne
    const other = team.members?.find(m => m.uid !== currentUser.uid);
    const otherName = other?.pseudo || '?';
    const otherPhoto = other?.photoURL || '';
    const initials = otherName.slice(0, 2).toUpperCase();
    document.getElementById('team-detail-name').textContent = otherName;
    const chatAvatar = document.getElementById('team-chat-avatar');
    if (otherPhoto) {
      chatAvatar.innerHTML = `<img src="${otherPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      chatAvatar.textContent = initials;
    }
    document.getElementById('team-chat-members-count').textContent = 'Message privé';
    document.getElementById('team-detail-id').textContent = team.id;
  } else {
    document.getElementById('team-detail-name').textContent = team.name;
    document.getElementById('team-chat-avatar').textContent = (team.name||'??').slice(0,2).toUpperCase();
    document.getElementById('team-chat-members-count').textContent = `${team.memberIds?.length||0} membre${(team.memberIds?.length||0)>1?'s':''}`;
    document.getElementById('team-detail-id').textContent = team.id;
  }

  renderTeamMembersInfo(team);

  // Gestion de la permission "copier l'ID" — masquée pour les DMs
  const isOwner = team.ownerId === currentUser.uid;
  const allowCopy = team.allowIdCopy !== false;
  const ownerToggleRow = document.getElementById('owner-id-copy-toggle-row');
  const copyBtn = document.getElementById('copy-id-btn');
  if (team.type === 'dm') {
    ownerToggleRow.style.display = 'none';
    copyBtn.style.display = 'none';
  } else if (isOwner) {
    ownerToggleRow.style.display = 'flex';
    document.getElementById('allow-id-copy-toggle').classList.toggle('on', allowCopy);
    copyBtn.style.display = 'block';
  } else {
    ownerToggleRow.style.display = 'none';
    copyBtn.style.display = allowCopy ? 'block' : 'none';
  }

  // Marquer comme vu (retire le point rouge)
  teamLastSeen[teamId] = Date.now();
  renderTeams();
  updateTeamsBadge();

  document.getElementById('team-detail-modal').classList.add('open');
  startTeamChatListener(teamId);
};

window.toggleAllowIdCopy = async () => {
  if (!currentTeamId) return;
  const toggle = document.getElementById('allow-id-copy-toggle');
  const newVal = !toggle.classList.contains('on');
  toggle.classList.toggle('on', newVal);
  await updateDoc(doc(db,'teams',currentTeamId), { allowIdCopy: newVal }).catch(()=>{});
  showToast(newVal ? ' Copie de l\'ID autorisée' : '🔒 Copie de l\'ID désactivée');
};

function renderTeamMembersInfo(team) {
  document.getElementById('team-members-list').innerHTML = (team.members||[]).map(m=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      ${groupAvatarHTML(m.groupAvatar, m.pseudo, 36)}
      <div style="flex:1;font-size:14px;font-weight:600;">${escHtml(m.pseudo||'?')}</div>
      ${team.ownerId===m.uid?'<span class="badge badge-blue">Admin</span>':''}
    </div>`).join('');

  const isOwner = team.ownerId===currentUser.uid;
  const pendingWrap = document.getElementById('pending-members-wrap');
  if (isOwner && team.pending?.length>0) {
    pendingWrap.style.display='block';
    document.getElementById('pending-members-list').innerHTML = team.pending.map(p=>`
      <div class="pending-item">
        <div class="pending-avatar">${(p.pseudo||'?').slice(0,2).toUpperCase()}</div>
        <div class="pending-info"><div class="pending-name">${escHtml(p.pseudo)}</div><div class="pending-sub">Demande de rejoindre</div></div>
        <div class="pending-actions">
          <button class="btn-accept" onclick="acceptMember('${team.id}','${p.uid}','${escHtml(p.pseudo)}','${p.photoURL||''}','${p.groupAvatar||'ga1'}')">✓</button>
          <button class="btn-reject" onclick="rejectMember('${team.id}','${p.uid}')">✕</button>
        </div>
      </div>`).join('');
  } else { pendingWrap.style.display='none'; }
}

// Génère le HTML d'un avatar de groupe (icône + dégradé) avec repli sur initiales
function groupAvatarHTML(avatarId, pseudo, size = 36) {
  if (!avatarId) {
    const initials = (pseudo||'?').slice(0,2).toUpperCase();
    return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${size*0.36}px;">${initials}</div>`;
  }
  const a = getGroupAvatar(avatarId);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${a.grad};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${size*0.42}px;flex-shrink:0;"><i class="fa-solid ${a.icon}"></i></div>`;
}

window.openTeamInfoModal = () => document.getElementById('team-info-modal').classList.add('open');

// ── Chat listener : messages + tâches mélangés, triés par date ──
function startTeamChatListener(teamId) {
  if (teamItemsUnsub) teamItemsUnsub();
  let msgs = [], tsks = [];

  const renderMerged = () => {
    const merged = [...msgs, ...tsks];
    merged.sort((a,b) => (a.timestamp?.toMillis?.()||0) - (b.timestamp?.toMillis?.()||0));
    teamChatCache = merged;
    renderTeamChat(merged);
  };

  const mq = query(collection(db,'teamMessages'), where('teamId','==',teamId));
  const tq = query(collection(db,'teamTasks'), where('teamId','==',teamId));
  const typingQ = query(collection(db,'typingStatus'), where('teamId','==',teamId));

  const unsub1 = onSnapshot(mq, snap => {
    msgs = snap.docs.map(d => ({ id:d.id, kind:'message', ...d.data() }));
    renderMerged();
  }, e => console.error('chat msgs:', e));

  const unsub2 = onSnapshot(tq, snap => {
    tsks = snap.docs.map(d => ({ id:d.id, kind:'task', ...d.data() }));
    renderMerged();
  }, e => console.error('chat tasks:', e));

  // Le statut "en train d'écrire" ne touche plus jamais à la liste des messages —
  // seul un petit bloc dédié (typing-indicator-slot) est mis à jour, pour éviter
  // de redessiner tout le fil (et donc de faire "sauter" l'écran) à chaque frappe.
  const unsub3 = onSnapshot(typingQ, snap => {
    const now = Date.now();
    const typingUsers = snap.docs
      .map(d => d.data())
      .filter(t => t.uid !== currentUser.uid && (now - (t.updatedAt?.toMillis?.() || 0)) < 5000);
    renderTypingIndicator(typingUsers);
  }, e => console.error('typing status:', e));

  teamItemsUnsub = () => { unsub1(); unsub2(); unsub3(); };
}

let typingDebounce = null;
let lastTypingWriteAt = 0;
window.handleTypingInput = () => {
  if (!currentTeamId) return;
  clearTimeout(typingDebounce);
  const typingDocId = `${currentTeamId}_${currentUser.uid}`;
  const now = Date.now();
  // Limite les écritures Firestore à environ 1 fois toutes les 1,5s pendant une frappe continue
  // (avant : une écriture à CHAQUE caractère, ce qui déclenchait un redessin du chat à chaque touche)
  if (now - lastTypingWriteAt > 1500) {
    lastTypingWriteAt = now;
    setDoc(doc(db,'typingStatus',typingDocId), {
      teamId: currentTeamId, uid: currentUser.uid,
      pseudo: userProfile.pseudo || currentUser.displayName || '?',
      updatedAt: serverTimestamp()
    }).catch(()=>{});
  }
  typingDebounce = setTimeout(() => {
    deleteDoc(doc(db,'typingStatus',typingDocId)).catch(()=>{});
  }, 3000);
};

// ── Auto-grow du champ de saisie (façon WhatsApp) ──
window.autoGrowChatInput = (el) => {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 132) + 'px';
};

function renderTeamChat(items) {
  const feed = document.getElementById('team-chat-feed');
  if (!feed) return;

  // On ne force le scroll automatique que si l'utilisateur était déjà proche du bas
  // (évite que le feed "saute" pendant qu'on lit plus haut ou qu'on tape un message)
  const wasNearBottom = (feed.scrollHeight - feed.scrollTop - feed.clientHeight) < 80;

  if (items.length === 0) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-comments"></i></div><div class="empty-title">Aucun message ni tâche</div><div class="empty-sub">Écris un message ou ajoute une tâche avec +</div></div><div id="typing-indicator-slot"></div>`;
    return;
  }
  feed.innerHTML = items.map(it => it.kind === 'task' ? teamTaskChatHTML(it) : teamMessageHTML(it)).join('') + '<div id="typing-indicator-slot"></div>';
  if (wasNearBottom) {
    requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
  }
}

function renderTypingIndicator(typingUsers) {
  const slot = document.getElementById('typing-indicator-slot');
  if (!slot) return;
  const feed = document.getElementById('team-chat-feed');
  const wasNearBottom = feed && (feed.scrollHeight - feed.scrollTop - feed.clientHeight) < 80;
  slot.innerHTML = typingUsers.length > 0 ? `
    <div class="typing-indicator">
      <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
    </div>` : '';
  if (wasNearBottom && feed) feed.scrollTop = feed.scrollHeight;
}

function teamMessageHTML(m) {
  const mine = m.uid === currentUser.uid;
  return `
  <div class="chat-msg ${mine?'mine':''}">
    ${!mine ? `<div class="chat-msg-author">${escHtml(m.pseudo||'?')}</div>` : ''}
    <div>${escHtml(m.text)}</div>
    <div class="chat-msg-time">${fmtTime(m.timestamp)}</div>
  </div>`;
}

const REACTION_EMOJIS = ['👍','👎','☝️','😎','😡'];

function teamTaskChatHTML(t) {
  const color = t.color || '#2563eb';
  const reactions = t.reactions || {};
  const reactionsHtml = Object.entries(reactions).filter(([,uids]) => uids.length>0).map(([emoji, uids]) => {
    const active = uids.includes(currentUser.uid);
    return `<span class="chat-reaction ${active?'active':''}" onclick="toggleReaction('${t.id}','${emoji}')">${emoji} ${uids.length}</span>`;
  }).join('');
  return `
  <div class="chat-task-card fade-in">
    <div class="task-color-bar" style="background:${color}"></div>
    <div onclick="openTeamTaskEdit('${t.id}')">
      <div class="chat-task-label"><i class="fa-solid fa-list-check"></i> Tâche partagée</div>
      <div class="chat-task-title">${escHtml(t.title)}</div>
      ${t.content?`<div class="chat-task-content">${escHtml(t.content)}</div>`:''}
      <div class="task-meta">
        ${t.date?`<span class="task-tag">📅 ${fmt(t.date)}${t.time?' '+t.time:''}</span>`:''}
        <span class="task-tag">👤 ${escHtml(t.creatorPseudo||'?')}</span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">
        Créé ${fmtTs(t.timestamp)}${t.updatedAt ? ' · Modifié '+fmtTs(t.updatedAt)+(t.lastModifiedBy?' par '+escHtml(t.lastModifiedBy):'') : ''}
      </div>
    </div>
    <div class="chat-reactions">
      ${reactionsHtml}
      <span class="chat-add-reaction" onclick="openReactionPicker(event,'${t.id}')"><i class="fa-regular fa-face-smile"></i></span>
    </div>
  </div>`;
}

window.openReactionPicker = (event, taskId) => {
  event.stopPropagation();
  document.getElementById('reaction-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'reaction-popup';
  popup.style.cssText = `position:fixed;z-index:999;background:var(--card);border:1px solid var(--border);
    border-radius:20px;padding:8px 10px;display:flex;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);`;
  const rect = event.target.getBoundingClientRect();
  popup.style.left = Math.max(10, rect.left - 80) + 'px';
  popup.style.top = (rect.top - 50) + 'px';
  popup.innerHTML = REACTION_EMOJIS.map(e => `<span style="font-size:22px;cursor:pointer;" onclick="toggleReaction('${taskId}','${e}');document.getElementById('reaction-popup').remove();">${e}</span>`).join('');
  document.body.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closePopup); }
    });
  }, 0);
};

window.toggleReaction = async (taskId, emoji) => {
  const t = teamChatCache.find(x => x.id===taskId);
  if (!t) return;
  const reactions = {};
  // On reconstruit l'objet en retirant d'abord l'utilisateur de TOUTES les réactions existantes
  Object.entries(t.reactions || {}).forEach(([key, uids]) => {
    reactions[key] = uids.filter(u => u !== currentUser.uid);
  });
  const hadThisEmoji = (t.reactions?.[emoji] || []).includes(currentUser.uid);
  if (!hadThisEmoji) {
    // L'utilisateur n'avait pas cette réaction -> on l'ajoute (et elle remplace toute réaction précédente)
    reactions[emoji] = [...(reactions[emoji] || []), currentUser.uid];
  }
  // Sinon : l'utilisateur cliquait sur sa propre réaction active -> on la retire simplement (toggle off)
  await updateDoc(doc(db,'teamTasks',taskId), { reactions });
};

window.sendTeamMessage = async () => {
  const input = document.getElementById('team-chat-input');
  const text = input.value.trim();
  if (!text || !currentTeamId) return;
  input.value = '';
  autoGrowChatInput(input); // remet le champ à sa hauteur d'une ligne
  clearTimeout(typingDebounce);
  deleteDoc(doc(db,'typingStatus',`${currentTeamId}_${currentUser.uid}`)).catch(()=>{});
  await addDoc(collection(db,'teamMessages'), {
    teamId: currentTeamId, text,
    uid: currentUser.uid,
    pseudo: settings.hidePseudo ? 'Anonyme' : (userProfile.pseudo||currentUser.displayName||'?'),
    timestamp: serverTimestamp()
  });
  // On force le scroll en bas puisque c'est notre propre message qu'on vient d'envoyer
  const feed = document.getElementById('team-chat-feed');
  if (feed) requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
};

window.closeTeamDetailModal = () => {
  document.getElementById('team-detail-modal').classList.remove('open');
  if (teamItemsUnsub) { teamItemsUnsub(); teamItemsUnsub = null; }
  currentTeamId = null;
};
window.copyTeamId = () => { navigator.clipboard.writeText(document.getElementById('team-detail-id').textContent).then(()=>showToast('📋 ID copié !')); };

window.acceptMember = async (teamId, uid, pseudo, photoURL, groupAvatar) => {
  const ref2 = doc(db,'teams',teamId);
  const snap = await getDoc(ref2);
  const team = snap.data();
  await updateDoc(ref2, {
    pending: team.pending.filter(p=>p.uid!==uid),
    members: [...(team.members||[]), {uid,pseudo,photoURL,groupAvatar:groupAvatar||'ga1',joinedAt:Date.now()}],
    memberIds: [...(team.memberIds||[]), uid]
  });
  showToast(` ${pseudo} accepté !`);
  const newSnap = await getDoc(ref2);
  renderTeamMembersInfo({ id: teamId, ...newSnap.data() });
};

window.rejectMember = async (teamId, uid) => {
  const ref2 = doc(db,'teams',teamId);
  const snap = await getDoc(ref2);
  await updateDoc(ref2, { pending: snap.data().pending.filter(p=>p.uid!==uid) });
  showToast('❌ Membre refusé');
  const newSnap = await getDoc(ref2);
  renderTeamMembersInfo({ id: teamId, ...newSnap.data() });
};

window.leaveTeam = async () => {
  if (!currentTeamId) return;
  const ref2 = doc(db,'teams',currentTeamId);
  const snap = await getDoc(ref2);
  const team = snap.data();
  await updateDoc(ref2, {
    memberIds: team.memberIds.filter(id=>id!==currentUser.uid),
    members: (team.members||[]).filter(m=>m.uid!==currentUser.uid)
  });
  closeModal('team-info-modal');
  closeTeamDetailModal();
  showToast('👋 Équipe quittée');
};

window.openTeamTaskModal = () => {
  document.getElementById('team-task-title').value='';
  document.getElementById('team-task-title').classList.remove('error');
  document.getElementById('team-task-content').value='';
  document.getElementById('team-task-date').value=fmtDate(new Date());
  document.getElementById('team-task-time').value='';
  delete document.getElementById('team-task-modal').dataset.editId;
  document.getElementById('team-task-modal').classList.add('open');
};

window.closeTeamTaskModal = () => document.getElementById('team-task-modal').classList.remove('open');

window.openTeamTaskEdit = async (taskId) => {
  const snap = await getDoc(doc(db,'teamTasks',taskId));
  if (!snap.exists()) return;
  const t = snap.data();
  document.getElementById('team-task-title').value=t.title||'';
  document.getElementById('team-task-title').classList.remove('error');
  document.getElementById('team-task-content').value=t.content||'';
  document.getElementById('team-task-date').value=t.date||'';
  document.getElementById('team-task-time').value=t.time||'';
  document.getElementById('team-task-modal').dataset.editId=taskId;
  document.getElementById('team-task-modal').classList.add('open');
};

window.saveTeamTask = async () => {
  const titleInput = document.getElementById('team-task-title');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('error');
    titleInput.focus();
    showToast('⚠️ Le titre est obligatoire');
    return;
  }
  titleInput.classList.remove('error');
  const editId = document.getElementById('team-task-modal').dataset.editId;
  const data = {
    title, content: document.getElementById('team-task-content').value.trim(),
    date: document.getElementById('team-task-date').value,
    time: document.getElementById('team-task-time').value,
    teamId: currentTeamId, updatedAt: serverTimestamp(),
    lastModifiedBy: userProfile.pseudo||currentUser.displayName
  };
  if (editId) {
    await updateDoc(doc(db,'teamTasks',editId), data);
    showToast(' Tâche modifiée');
  } else {
    data.creatorUid=currentUser.uid;
    data.creatorPseudo=userProfile.pseudo||currentUser.displayName;
    data.timestamp=serverTimestamp();
    data.status='pending';
    data.reactions={};
    await addDoc(collection(db,'teamTasks'), data);
    showToast(' Partagée avec l\'équipe !');
  }
  closeTeamTaskModal();
};

