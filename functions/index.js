const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// ── Notif push à chaque nouveau message d'équipe ──────────────────────────
// Déclenché dès qu'un document est créé dans teamMessages.
// Envoie une notification à tous les membres de l'équipe SAUF l'expéditeur,
// avec le nom du groupe comme titre.
exports.onNewTeamMessage = onDocumentCreated('teamMessages/{msgId}', async (event) => {
  const msg = event.data.data();
  if (!msg) return;

  const { teamId, uid: senderUid, pseudo, text } = msg;
  if (!teamId || !senderUid) return;

  // Récupérer l'équipe pour avoir son nom et la liste des membres
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) return;
  const team = teamSnap.data();
  const teamName = team.name || 'Équipe';
  const memberIds = (team.memberIds || []).filter(id => id !== senderUid);
  if (memberIds.length === 0) return;

  // Récupérer les tokens FCM de tous les membres (sans l'expéditeur)
  const tokens = [];
  for (const memberId of memberIds) {
    const userSnap = await db.collection('users').doc(memberId).get();
    if (!userSnap.exists) continue;
    const fcmTokens = userSnap.data()?.fcmTokens || [];
    tokens.push(...fcmTokens);
  }
  if (tokens.length === 0) return;

  // Préparer et envoyer les notifications (par lots de 500 max)
  const notification = {
    title: teamName,
    body: `${pseudo || 'Quelqu\'un'} : ${text?.slice(0, 100) || '…'}`,
  };
  const batches = [];
  for (let i = 0; i < tokens.length; i += 500) {
    batches.push(tokens.slice(i, i + 500));
  }
  for (const batch of batches) {
    await getMessaging().sendEachForMulticast({
      tokens: batch,
      notification,
      webpush: {
        notification: {
          icon: '/icons/icon-192-v2.png',
          badge: '/icons/icon-72-v2.png',
          vibrate: [200, 100, 200],
        },
        fcmOptions: { link: '/' },
      },
    }).catch(e => console.error('FCM send error:', e));
  }
});
