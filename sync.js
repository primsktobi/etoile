// ══════════════════════════════════════════════════════════════════════════════
//  SYNC.JS — Moteur de synchronisation queue → Firebase
//
//  Rôle unique : vider trivo-queue vers Firebase quand la connexion est dispo.
//  Jamais appelé hors connexion. Ne touche pas trivo-display.
//
//  Actions supportées :
//    create      → addDoc (avec serverTimestamp côté Firebase)
//    update      → updateDoc (avec serverTimestamp côté Firebase)
//    delete      → soft-delete Firebase (status:'deleted', deletedAt)
//    recover     → updateDoc status:'pending', supprime deletedAt
//    hard-delete → deleteDoc Firebase (suppression définitive)
// ══════════════════════════════════════════════════════════════════════════════

let _flushInProgress = false;

// ── queueFlush ────────────────────────────────────────────────────────────────
// Lit toutes les entrées de trivo-queue, les envoie à Firebase dans l'ordre
// chronologique (updatedAt ASC), supprime chaque entrée après succès.
// Si hors ligne ou Firebase indisponible → s'arrête proprement sans crasher.
window.queueFlush = async function () {
  if (_flushInProgress) return;
  if (!navigator.onLine) return;
  if (!currentUser) return;

  _flushInProgress = true;

  try {
    const entries = await queueGetAll();
    if (entries.length === 0) { _flushInProgress = false; return; }

    // Trier par updatedAt croissant — respecte l'ordre des actions
    entries.sort((a, b) => a.updatedAt - b.updatedAt);

    for (const entry of entries) {
      try {
        await _processEntry(entry);
        await queueDelete(entry.id);
      } catch (e) {
        // Si une entrée échoue (ex: doc supprimé côté Firebase entre-temps),
        // on la supprime quand même pour ne pas bloquer la queue indéfiniment.
        // Les cas réels d'échec réseau font sortir la boucle via le catch global.
        if (e?.code === 'not-found') {
          await queueDelete(entry.id);
        } else {
          // Erreur réseau → on arrête, on réessaiera au prochain flush
          console.warn('[sync] Flush interrompu :', e?.code || e?.message);
          break;
        }
      }
    }
  } finally {
    _flushInProgress = false;
  }
};

// ── _processEntry ─────────────────────────────────────────────────────────────
// Exécute une entrée de queue sur Firebase selon son type.
async function _processEntry(entry) {
  const { type, collection: col, docId, data } = entry;

  // Nettoyage : on retire les champs IDB-only avant d'envoyer à Firebase
  const firebaseData = _stripIdbFields(data);

  switch (type) {

    case 'create': {
      await setDoc(doc(db, col, docId), {
        ...firebaseData,
        updatedAt: entry.updatedAt,  // timestamp réel de la modification
        timestamp: entry.updatedAt
      });
      break;
    }

    case 'update': {
      await updateDoc(doc(db, col, docId), {
        ...firebaseData,
        updatedAt: entry.updatedAt   // timestamp réel de la modification
      });
      break;
    }

    case 'delete': {
      await updateDoc(doc(db, col, docId), {
        status: 'deleted',
        deletedAt: entry.updatedAt,
        updatedAt: entry.updatedAt
      });
      break;
    }

    case 'recover': {
      await updateDoc(doc(db, col, docId), {
        status: 'pending',
        deletedAt: null,
        updatedAt: entry.updatedAt
      });
      break;
    }

    case 'hard-delete': {
      // Suppression définitive — irréversible côté Firebase aussi
      await deleteDoc(doc(db, col, docId));
      break;
    }

    default:
      console.warn('[sync] Type inconnu ignoré :', type);
  }
}

// ── _stripIdbFields ───────────────────────────────────────────────────────────
// Retire les champs internes IDB qui ne doivent pas partir vers Firebase.
function _stripIdbFields(data) {
  if (!data) return {};
  const clean = { ...data };
  delete clean._idbOnly;   // flag interne si jamais utilisé plus tard
  return clean;
}

// ── queuePushMerge ────────────────────────────────────────────────────────────
// Comme queuePush, mais lit d'abord l'entrée existante de la queue pour ce
// document et fusionne les champs au lieu d'écraser. Garantit qu'aucune
// modification n'est perdue quand plusieurs champs du même document
// (ex: users/{uid} avec accentColor puis fullscreenStable) sont modifiés
// séparément hors ligne avant le prochain flush.
async function queuePushMerge(type, collectionName, docId, newFields) {
  const key = `${collectionName}_${docId}`;
  const existing = await queueGet(key);
  const mergedData = { ...(existing?.data || {}), ...newFields };
  await queuePush(type, collectionName, docId, mergedData);
}

window.queuePushMerge = queuePushMerge;

// ── Auto-flush au retour de connexion ────────────────────────────────────────
window.addEventListener('online', () => {
  if (currentUser) window.queueFlush();
});
