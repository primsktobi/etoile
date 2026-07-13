// ══════════════════════════════════════════════════════════════════════════════
//  MOTIVATION.JS — Système émotionnel de Trivo
//
//  5 templates × 30 messages + déblocage de thèmes premium
//  Le coach parle vrai — pas que gentil, pas que dur. Juste juste.
// ══════════════════════════════════════════════════════════════════════════════

// ── TEMPLATE 1 : SÉRIE ACTIVE ─────────────────────────────────────────────
// Tu es là, tu travailles. Messages qui alimentent le feu.
const MSG_SERIE = [
  "Tu es là encore aujourd'hui. C'est ça la différence entre ceux qui réussissent et les autres.",
  "Jour après jour. Ça paraît simple, mais la plupart abandonnent avant d'arriver là où tu es.",
  "Ta flamme brûle. Continue de l'alimenter.",
  "Chaque jour que tu coches, tu construis quelque chose que personne ne peut t'enlever.",
  "Les gens voient le résultat. Ils ne voient pas les jours comme aujourd'hui. Mais toi tu les vis.",
  "Tu n'as pas besoin de te motiver. Tu l'as déjà prouvé — tu es du genre à revenir.",
  "Régulier. C'est le mot le plus puissant en business, en art, en vie. Et tu l'incarnes.",
  "Ta série grandit. Ta flamme grandit. Toi aussi tu grandis, même si tu ne le sens pas encore.",
  "Certains attendent l'inspiration. Toi tu te lèves et tu travailles. C'est pour ça que ça va marcher.",
  "Petite progression chaque jour. Dans 6 mois, tu regarderas en arrière et tu ne reconnaîtras plus ton niveau.",
  "La discipline, c'est choisir ce que tu veux à long terme plutôt que ce que tu veux maintenant. Tu choisis bien.",
  "Tu ne sais pas encore ce que cette régularité va produire. Mais elle va produire quelque chose de grand.",
  "Aujourd'hui encore. C'est tout ce qu'on te demande. Demain, on recommence.",
  "Ta flamme ne s'éteint pas. Et ça, c'est déjà énorme.",
  "Le travail invisible d'aujourd'hui devient le succès visible de demain.",
  "Tu es en train de construire l'habitude la plus rare qui soit — celle de ne pas lâcher.",
  "Pas besoin d'être parfait. Juste besoin d'être présent. Et tu l'es.",
  "Ta série, c'est ta signature. Elle dit qui tu es quand personne ne regarde.",
  "Même les jours difficiles, tu reviens. C'est ça le vrai caractère.",
  "Continue. Pas parce que c'est facile. Parce que c'est toi.",
  "Chaque tâche complétée est une promesse tenue — à toi-même. Et ça compte.",
  "Tu construis un momentum. Ne le brise pas pour rien.",
  "Les grands accomplissements sont faits de petits jours ordinaires comme celui-ci.",
  "Ta cohérence est ton superpower. Peu de gens en ont un aussi solide.",
  "Revenir encore. C'est l'acte le plus courageux qui soit.",
  "Tu n'as pas besoin de tout réussir aujourd'hui. Juste d'avancer d'un pas. C'est fait.",
  "La série continue. Et avec elle, la confiance en toi grandit.",
  "On ne voit pas la croissance au quotidien. Mais elle est là. Chaque jour.",
  "Tu te bats pour quelque chose. N'oublie jamais pourquoi tu as commencé.",
  "Aujourd'hui compte. Même si ça ne semble pas grand chose. Ça compte."
];

// ── TEMPLATE 2 : ABSENCE ─────────────────────────────────────────────────
// Direct, honnête, selon le nombre de jours manqués
const MSG_ABSENCE_1 = [ // 1 jour
  "Tu n'étais pas là hier. Ta flamme t'attend toujours.",
  "Un jour de pause, ça arrive. Mais ne laisse pas ça devenir une habitude.",
  "Hier tu n'as pas avancé. Aujourd'hui tu peux reprendre. C'est maintenant.",
  "Une journée perdue se rattrape. Une semaine perdue est plus difficile. Reviens.",
  "Tout le monde a des jours sans. L'important c'est ce que tu fais le lendemain.",
  "Ta flamme a baissé d'un cran hier. Elle peut remonter aujourd'hui. À toi de jouer."
];
const MSG_ABSENCE_2 = [ // 2 jours
  "Deux jours. C'est le moment critique — soit tu reprends maintenant, soit ça devient une excuse.",
  "Tu sais ce que tu dois faire. Arrête de remettre à demain ce que tu peux faire là.",
  "Deux jours sans avancer. Ta flamme a besoin de toi. Maintenant.",
  "Ce n'est pas un jugement. C'est un constat : deux jours perdus. La question c'est : qu'est-ce qui t'a arrêté ?",
  "Deux jours. Les grandes séries sont mortes de moins que ça. Reviens.",
  "Tu avais une belle dynamique. Ne la laisse pas mourir pour deux jours d'absence."
];
const MSG_ABSENCE_3 = [ // 3 jours et plus
  "Trois jours. Je ne vais pas te mentir — c'est beaucoup. Mais ce n'est pas fini.",
  "Tu t'es perdu quelque part ces derniers jours. Retrouve-toi.",
  "Ce n'est pas de la paresse. C'est peut-être de la fatigue ou du doute. Mais la réponse n'est pas l'absence — c'est de revenir.",
  "Quelque chose t'a éloigné. Ça arrive. Mais chaque jour qui passe rend le retour plus difficile. Fais-le maintenant.",
  "Tu avais commencé quelque chose. Ce n'est pas terminé. Reprends.",
  "Trois jours ou plus — ta flamme a besoin d'être rallumée. Toi seul peux le faire."
];

// ── TEMPLATE 3 : SEMAINE PARFAITE ────────────────────────────────────────
// 100% tous les jours pendant 7 jours. Célébration intense.
const MSG_SEMAINE_PARFAITE = [
  "Semaine parfaite. 100% tous les jours. Tu viens de prouver quelque chose d'important sur toi-même.",
  "7 jours à 100%. Sais-tu combien de personnes font ça ? Très peu. Et tu en fais partie.",
  "Une semaine sans faille. Pas une fois tu as dit 'demain'. Ça, c'est du caractère.",
  "Tu n'as pas juste complété tes tâches cette semaine. Tu as construit qui tu es.",
  "Semaine parfaite. Ce n'est pas de la chance — c'est de la volonté. La tienne.",
  "100% toute la semaine. Ta flamme est à son maximum. Maintenant tu sais que tu peux.",
  "Une semaine impeccable. Le thème Cosmos vient de se débloquer. Tu l'as mérité.",
  "7 jours de discipline pure. Peu importe ce qui se passe autour, toi tu avances.",
  "Semaine parfaite. Je ne dis pas ça pour te faire plaisir — tu as vraiment tout donné.",
  "Tu as tenu 7 jours sans exception. C'est la preuve que tu peux tenir 7 semaines.",
  "Cette semaine va compter dans ta progression. Même si tu ne le vois pas encore.",
  "Semaine sans faille. Garde cette énergie — elle est précieuse.",
  "100% cette semaine. Le monde appartient aux gens comme toi.",
  "Tu ne te contentes pas de faire les choses. Tu les fais bien, tous les jours. C'est rare.",
  "Semaine parfaite terminée. La prochaine commence maintenant. Continue.",
  "Toute la semaine à fond. Voilà à quoi ressemble la vraie discipline.",
  "7 jours à 100%. Chaque tâche, chaque jour. C'est une semaine dont tu peux être fier.",
  "Tu as passé 7 jours à honorer tes engagements envers toi-même. Ça ne se mesure pas.",
  "Semaine impeccable. Le cosmos t'appartient maintenant.",
  "Une semaine parfaite ne se répète pas par hasard. Reproduis-la.",
  "7/7. Tu sais maintenant ce dont tu es capable. Ne l'oublie jamais.",
  "Cette semaine, tu n'as pas laissé une seule excuse gagner. Impressionnant.",
  "Semaine parfaite. Tu viens de poser une barre pour toi-même. Maintenant tiens-la.",
  "Tout complété, tous les jours. C'est ce qu'on appelle être sérieux.",
  "7 jours sans faillir. Ta flamme brûle plus fort que jamais.",
  "Semaine parfaite. Maintenant repose-toi un peu — mais reviens demain.",
  "100% cette semaine. La prochaine étape ? Faire pareil le mois prochain.",
  "Tu as tout fait. Vraiment tout. Cette semaine t'appartient.",
  "7 jours à 100%. C'est la semaine dont tu te souviendras quand tu raconteras ton parcours.",
  "Semaine parfaite. Thème débloqué. C'est votre travail qui paye."
];

// ── TEMPLATE 4 : STATS ACTIVITÉ ──────────────────────────────────────────
// Analyse réelle avec vrais conseils selon le profil
const MSG_ACTIVITE = {
  vidéaste: [
    "Tu postes, c'est bien. Mais si tes vues stagnent, la question n'est pas la quantité — c'est la qualité des 30 premières secondes.",
    "Beaucoup de vidéos peu de vues ? Teste un hook plus fort en ouverture. Les algorithmes récompensent la rétention.",
    "Tes abonnés augmentent — c'est le signe que ton contenu parle à quelqu'un. Continue et affine.",
    "Les vues de la semaine sont bonnes. Maintenant analyse : quel contenu a le mieux performé et pourquoi ?",
    "Si tes vues ne décollent pas, regarde tes miniatures. 80% des clics viennent de là.",
    "Tu publies régulièrement. C'est la base. La prochaine étape : trouver ton format signature.",
    "Les hashtags ne sont pas une formule magique, mais les bons hashtags dans la bonne niche changent tout.",
    "Une vidéo par semaine bien faite vaut mieux que 5 vidéos moyennes. Qualité sur quantité.",
    "Tes vues augmentent — maintenant concentre-toi sur l'engagement. Les commentaires nourrissent l'algorithme.",
    "Tu as un public qui commence à te suivre. Parle-leur directement dans tes prochaines vidéos."
  ],
  reseaux: [
    "Tes followers augmentent mais ton engagement baisse ? Publie moins mais avec plus d'intention.",
    "Les sons en tendance multiplient la portée organique par 3 en moyenne. Utilise-les intelligemment.",
    "Tu publies régulièrement — c'est la clé. Maintenant ajoute une vraie accroche dans les 2 premières secondes.",
    "Tes publications ont de la portée ? Alors réponds à chaque commentaire. Ça crée une vraie communauté.",
    "Si tu n'as pas de public cible défini, tu parles à tout le monde — ce qui veut dire à personne.",
    "Les hashtags de niche (10k-200k) performent mieux que les hashtags géants. Teste.",
    "Publie aux heures où ton audience est active. Analyse tes insights et adapte.",
    "Un post qui crée la conversation vaut 10 posts qui créent juste des likes.",
    "Ta croissance cette semaine est correcte. Mais la vraie question : est-ce que ton contenu te représente vraiment ?",
    "Les collaborations avec d'autres créateurs de ta niche accélèrent la croissance comme rien d'autre."
  ],
  vendeur: [
    "Tes ventes du jour sont bonnes. Mais as-tu demandé à tes clients ce qui les a convaincus d'acheter ?",
    "Si certains articles ne se vendent pas, ce n'est peut-être pas le produit — c'est la façon dont tu le présentes.",
    "Chaque client satisfait est un commercial gratuit. Encourage les avis et le bouche-à-oreille.",
    "Tes chiffres progressent. C'est le moment d'analyser tes meilleurs articles et de mettre l'accent dessus.",
    "La régularité de tes ventes construit ta réputation. Continue à livrer de la qualité.",
    "Si tu veux doubler tes ventes, commence par comprendre pourquoi les gens n'achètent pas encore.",
    "Une photo de qualité peut multiplier les ventes d'un article par 5. Ne négliges pas la présentation.",
    "Tes clients réguliers sont ton trésor. Traite-les mieux que les nouveaux.",
    "Les jours sans vente sont aussi informatifs que les jours avec. Qu'est-ce qui a changé ?",
    "Le prix n'est jamais le vrai problème. La valeur perçue l'est. Travaille sur ça."
  ],
  rappeur: [
    "Tu écris régulièrement — c'est la base de tout. Un rappeur qui n'écrit pas est un rappeur qui régresse.",
    "Beaucoup de couplets cette semaine ? Bien. Maintenant prends le meilleur et travaille-le jusqu'à ce qu'il soit parfait.",
    "Poster une musique par mois c'est un bon rythme. Mais la constance sur 12 mois, c'est là que les carrières se construisent.",
    "Si tes morceaux ne décollent pas, la question n'est pas le talent — c'est la distribution et le marketing.",
    "Travaille ta signature vocale. Les gens doivent reconnaître ta voix en 3 secondes.",
    "Les collaborations exposent ton son à des audiences nouvelles. Cherche des artistes complémentaires.",
    "La qualité de la prod compte autant que les paroles. Investis dans ton son.",
    "Tu écris beaucoup — maintenant enregistre plus. Les idées dans ta tête ne comptent pas.",
    "Un clip moyen peut tuer une bonne musique. Soigne la vidéo autant que le son.",
    "La régularité de ta sortie crée l'anticipation. Ton public doit savoir quand tu arrives."
  ]
};

// ── TEMPLATE 5 : ESSAIE PLUTÔT ────────────────────────────────────────────
// Tu travailles mais les résultats stagnent. Pistes concrètes.
const MSG_ESSAIE = [
  "Tu fais beaucoup de choses. Peut-être trop. Essaie de te concentrer sur une seule chose jusqu'au bout.",
  "La quantité de travail est là. Maintenant pose-toi cette question : est-ce que tu travailles sur les bonnes choses ?",
  "Tu avances, mais pas assez vite ? Identifie la tâche qui a le plus d'impact et mets-la en premier chaque jour.",
  "Essaie la règle du 80/20 : 20% de tes actions produisent 80% de tes résultats. Trouve ces 20% et double la mise.",
  "Si quelque chose ne marche pas après 3 semaines d'essais sérieux, ce n'est pas un problème de travail — c'est une question d'approche.",
  "Tu travailles dur, mais travailler dur dans la mauvaise direction ne mène nulle part. Prends 10 minutes pour réfléchir à ta stratégie.",
  "Essaie de noter ce qui fonctionne et ce qui ne fonctionne pas. Sans analyse, tu répètes les mêmes erreurs.",
  "La routine est bonne pour la discipline. Mauvaise pour l'innovation. Essaie quelque chose de différent cette semaine.",
  "Les résultats stagnent ? Cherche quelqu'un qui fait mieux que toi et observe comment il s'y prend.",
  "Tu complètes tes tâches mais tu n'avances pas vers ton objectif. Vérifie que tes tâches sont bien alignées avec ce que tu veux vraiment.",
  "Essaie de bloquer 30 minutes sans téléphone, sans distraction, uniquement sur ta priorité du jour. Tu seras surpris du résultat.",
  "Parfois ralentir aide à aller plus vite. Prends une journée pour tout réévaluer.",
  "Tu pourrais déléguer certaines tâches pour te concentrer sur ce que toi seul peux faire ?",
  "Les meilleures idées ne viennent pas pendant le travail. Prends du recul régulièrement.",
  "Essaie de commencer par la tâche la plus difficile chaque matin. Tout le reste sera plus facile après.",
  "Tu cherches à tout faire parfaitement ? Parfois 80% bien vaut mieux que 100% jamais fini.",
  "Tes objectifs sont-ils clairs et mesurables ? Sans cible précise, on tourne en rond.",
  "Essaie de trouver un partenaire de responsabilité — quelqu'un à qui tu annonces tes objectifs chaque semaine.",
  "Les breaks ne sont pas du temps perdu. Ils sont nécessaires pour maintenir la qualité du travail.",
  "Tu travailles beaucoup le soir ? Le cerveau est moins efficace. Essaie de déplacer ton travail important le matin.",
  "Essaie d'écrire tes 3 priorités absolues chaque matin avant d'ouvrir ton téléphone.",
  "Le manque de résultats vient souvent d'un manque de clarté sur ce qu'on veut vraiment.",
  "Tu t'es comparé à d'autres récemment ? C'est dangereux. Compare-toi seulement à qui tu étais hier.",
  "Essaie de revoir tes objectifs. Parfois on travaille dur pour atteindre quelque chose qu'on ne veut plus vraiment.",
  "Une chose à la fois. C'est contre-intuitif mais c'est prouvé — le multitasking divise les résultats.",
  "Essaie de visualiser ton objectif final chaque matin pendant 2 minutes. Ça aligne toutes tes actions.",
  "Le problème n'est peut-être pas toi — c'est ton environnement. Change quelque chose dans ton espace de travail.",
  "Parfois le blocage vient de la peur de ne pas être à la hauteur. Reconnais-le et avance quand même.",
  "Tu fais déjà l'essentiel bien. Maintenant peaufine. C'est dans les détails que la différence se fait.",
  "Essaie de célébrer tes petites victoires. Ça construit la confiance qui te permet d'atteindre les grandes."
];

// ── Système de célébration ─────────────────────────────────────────────────
let motivationLastShownDate = null;
let unlockedThemes = [];
let firstTaskCreated = false;
let firstTaskCompleted = false;

async function loadMotivationState() {
  const cached = await idbGet('prefs', 'motivationState');
  if (cached?.value) {
    motivationLastShownDate = cached.value.lastDate;
    unlockedThemes = cached.value.unlockedThemes || [];
    firstTaskCreated = !!cached.value.firstTaskCreated;
    firstTaskCompleted = !!cached.value.firstTaskCompleted;
  }
  if (currentUser) {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.unlockedThemes) unlockedThemes = d.unlockedThemes;
      }
    } catch(e) {}
  }
  updateThemeUnlockUI();
}

async function saveMotivationState() {
  const state = { lastDate: motivationLastShownDate, unlockedThemes, firstTaskCreated, firstTaskCompleted };
  await idbPut('prefs', { key: 'motivationState', value: state });
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), { unlockedThemes }).catch(() => {});
  }
}

// ── PHRASES : PREMIER LANCEMENT (écran vide) ────────────────────────────────
// Accroche affichée tant qu'aucune tâche n'a jamais été créée sur le compte.
const MSG_FIRST_LAUNCH_HOOK = [
  "T'es là. C'est déjà ça. Qu'est-ce qu'on fait aujourd'hui ?",
  "Bon. On commence par quoi ?",
  "Une page blanche. À toi de décider ce qui compte.",
  "Rien encore. Ça va changer.",
  "T'as ouvert l'app. Premier pas fait. La suite ?",
  "Pas de liste. Pas d'historique. Juste toi, maintenant.",
  "On y va quand tu veux. Pas de pression, juste une première tâche.",
  "Ta flamme n'attend qu'une chose : que tu commences."
];

// ── PHRASES : PREMIÈRE TÂCHE CRÉÉE ──────────────────────────────────────────
const MSG_FIRST_TASK_CREATED = [
  "Une tâche posée, un engagement pris envers toi. On y va.",
  "C'est parti. Ce n'est plus une idée, c'est écrit.",
  "Première ligne posée. Le reste va suivre.",
  "Tu viens de te donner un rendez-vous. Tiens-le.",
  "Posée. Maintenant elle existe, et toi tu sais qu'elle t'attend.",
  "Le début compte plus que tu ne le penses. C'est fait.",
  "Une tâche, un engagement. Simple, mais ça change tout.",
  "Tu viens d'ouvrir le compte. La suite s'écrit maintenant."
];

// ── PHRASES : PREMIÈRE TÂCHE TERMINÉE (moment le plus marquant) ────────────
const MSG_FIRST_TASK_DONE = [
  "Tu l'as fait. C'est le genre de moment qui compte plus qu'il n'y paraît.",
  "Première promesse tenue envers toi-même. Ça ne s'oublie pas.",
  "Ce n'est pas une case cochée. C'est la preuve que tu tiens parole.",
  "Tu viens de faire ce que beaucoup remettent à demain. Aujourd'hui, tu l'as fait.",
  "Une première fois. Il y en aura d'autres — mais celle-ci, tu t'en souviendras.",
  "Ta flamme vient de s'allumer. C'est toi qui l'as fait.",
  "Tu doutais peut-être. Et pourtant, c'est fait.",
  "Le premier pas est le plus dur. Tu viens de le passer."
];

// ── PHRASES : TÂCHE INTERROMPUE (ton calme, jamais culpabilisant) ──────────
const MSG_TASK_INTERRUPTED = [
  "T'as pas fini, et c'est ok. La flamme n'éteint pas pour ça. Tu reprends quand tu veux.",
  "Interrompu, pas abandonné. Ça reste là, prêt quand tu l'es.",
  "Pas aujourd'hui, apparemment. Ce n'est pas grave. Tu reviens quand tu veux.",
  "Ça arrive. Rien n'est perdu, juste mis en pause.",
  "T'as commencé, ça compte déjà. Le reste attendra.",
  "Pas besoin de finir pour que ce soit valable. Tu reprendras.",
  "Une pause, pas un échec. On continue quand tu veux.",
  "Ce n'est pas fini. Ce n'est pas grave non plus. À toi de voir la suite."
];

// ── Banner "coach" non-bloquant (utilisé pour les 3 moments déclencheurs) ──
let coachMomentTimer;
function showCoachMoment(emoji, message, tone = 'default') {
  const existing = document.getElementById('coach-moment-banner');
  if (existing) existing.remove();
  clearTimeout(coachMomentTimer);

  const el = document.createElement('div');
  el.id = 'coach-moment-banner';
  el.className = `coach-moment-banner ${tone === 'calm' ? 'calm' : ''}`;
  el.innerHTML = `<div class="coach-moment-emoji">${emoji}</div><div class="coach-moment-text">${message}</div>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  coachMomentTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

function pick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

// Déclenchée à la création de la toute première tâche du compte.
window.notifyFirstTaskCreated = async () => {
  if (firstTaskCreated) return false;
  firstTaskCreated = true;
  await saveMotivationState();
  showCoachMoment('✍️', pick(MSG_FIRST_TASK_CREATED));
  return true;
};

// Déclenchée à la complétion de la toute première tâche du compte.
window.notifyFirstTaskCompleted = async () => {
  if (firstTaskCompleted) return false;
  firstTaskCompleted = true;
  await saveMotivationState();
  showCelebrationModal('🔥', 'Première tâche terminée', pick(MSG_FIRST_TASK_DONE), null);
  return true;
};

// Déclenchée quand une session de focus est interrompue sans être terminée.
window.notifyTaskInterrupted = () => {
  showCoachMoment('🌙', pick(MSG_TASK_INTERRUPTED), 'calm');
};

// ── Vérification des déblocages ───────────────────────────────────────────
function checkThemeUnlocks() {
  const today = new Date();
  let unlocked = null;

  // Semaine parfaite — 7 jours consécutifs à 100%
  if (!unlockedThemes.includes('cosmos')) {
    let perfectWeek = true;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = fmtDateM(d);
      const dayTasks = tasks.filter(t => t.date === ds && t.status !== 'deleted');
      const doneTasks = dayTasks.filter(t => t.status === 'done');
      if (dayTasks.length === 0 || doneTasks.length < dayTasks.length) { perfectWeek = false; break; }
    }
    if (perfectWeek) { unlockedThemes.push('cosmos'); unlocked = 'cosmos'; }
  }

  // Mois parfait — 30 jours consécutifs à 100%
  if (!unlockedThemes.includes('sunrise')) {
    let perfectMonth = true;
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = fmtDateM(d);
      const dayTasks = tasks.filter(t => t.date === ds && t.status !== 'deleted');
      const doneTasks = dayTasks.filter(t => t.status === 'done');
      if (dayTasks.length === 0 || doneTasks.length < dayTasks.length) { perfectMonth = false; break; }
    }
    if (perfectMonth) { unlockedThemes.push('sunrise'); unlocked = 'sunrise'; }
  }

  if (unlocked) {
    saveMotivationState();
    updateThemeUnlockUI();
    showThemeUnlockCelebration(unlocked);
  }
}

function updateThemeUnlockUI() {
  const cosmosLock   = document.getElementById('cosmos-lock');
  const sunriseLock  = document.getElementById('sunrise-lock');
  const cosmosBtn    = document.getElementById('theme-cosmos-btn');
  const sunriseBtn   = document.getElementById('theme-sunrise-btn');

  if (unlockedThemes.includes('cosmos')) {
    if (cosmosLock)  cosmosLock.innerHTML  = '<i class="fa-solid fa-unlock" style="color:#a78bfa;"></i> Débloqué';
    if (cosmosBtn)   cosmosBtn.onclick     = () => setTheme('cosmos');
  }
  if (unlockedThemes.includes('sunrise')) {
    if (sunriseLock) sunriseLock.innerHTML = '<i class="fa-solid fa-unlock" style="color:#fbbf24;"></i> Débloqué';
    if (sunriseBtn)  sunriseBtn.onclick    = () => setTheme('sunrise');
  }
}

window.tryUnlockTheme = (theme) => {
  if (unlockedThemes.includes(theme)) { setTheme(theme); return; }
  const msg = theme === 'cosmos'
    ? 'Thème verrouillé. Complète 100% de tes tâches pendant 7 jours consécutifs pour le débloquer.'
    : 'Thème verrouillé. Complète 100% de tes tâches pendant 30 jours consécutifs pour le débloquer.';
  showToast(msg);
};

// ── Célébration déblocage thème ───────────────────────────────────────────
function showThemeUnlockCelebration(theme) {
  const name = theme === 'cosmos' ? 'Cosmos' : 'Soleil Levant';
  const msg  = theme === 'cosmos'
    ? 'Thème Cosmos débloqué. C\'est votre travail qui paye.'
    : 'Thème Soleil Levant débloqué. Un mois parfait. Vous êtes inarrêtable.';
  showCelebrationModal('🎨 Nouveau thème', name, msg, () => setTheme(theme));
}

// ── Modal de célébration générique ───────────────────────────────────────
function showCelebrationModal(emoji, title, message, onAction) {
  const existing = document.getElementById('celebration-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'celebration-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center;
    justify-content: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
  `;
  modal.innerHTML = `
    <div style="
      background: var(--card); border: 1px solid var(--border); border-radius: 24px;
      padding: 32px 24px; max-width: 320px; width: 90%; text-align: center;
      animation: scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    ">
      <div style="font-size: 48px; margin-bottom: 12px;">${emoji}</div>
      <div style="font-size: 20px; font-weight: 900; color: var(--text); margin-bottom: 6px;">${title}</div>
      <div style="font-size: 16px; font-weight: 700; color: var(--accent); margin-bottom: 12px;">${title === '🎨 Nouveau thème' ? title.replace('🎨 Nouveau thème', '') : ''}</div>
      <div style="font-size: 14px; color: var(--text2); line-height: 1.6; margin-bottom: 24px;">${message}</div>
      ${onAction ? `<button onclick="document.getElementById('celebration-modal').remove(); (${onAction.toString()})();" style="
        width: 100%; padding: 14px; border-radius: 14px; border: none; cursor: pointer;
        background: var(--accent); color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 10px;
      ">Appliquer le thème</button>` : ''}
      <button onclick="document.getElementById('celebration-modal').remove();" style="
        width: 100%; padding: 12px; border-radius: 14px; border: none; cursor: pointer;
        background: var(--bg3); color: var(--text2); font-size: 14px; font-weight: 600;
      ">Fermer</button>
    </div>`;
  document.body.appendChild(modal);
}

// ── Message du coach ──────────────────────────────────────────────────────
function getCoachMessage() {
  const today = fmtDateM(new Date());
  if (motivationLastShownDate === today) return null; // Un seul message par jour

  const doneDates = new Set(tasks.filter(t => t.status === 'done' && t.date).map(t => t.date));
  const yesterday = fmtDateM(new Date(Date.now() - 86400000));
  const twoDaysAgo = fmtDateM(new Date(Date.now() - 172800000));

  // Calcul streak
  let streak = 0;
  let cursor = new Date();
  if (!doneDates.has(fmtDateM(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (doneDates.has(fmtDateM(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // Calcul absences
  const missingDays = !doneDates.has(yesterday) ? (!doneDates.has(twoDaysAgo) ? 3 : 2) : 0;

  let pool, label;

  if (missingDays >= 3) {
    pool = MSG_ABSENCE_3; label = 'absence';
  } else if (missingDays === 2) {
    pool = MSG_ABSENCE_2; label = 'absence';
  } else if (missingDays === 1) {
    pool = MSG_ABSENCE_1; label = 'absence';
  } else if (streak >= 2) {
    // Vérifier semaine parfaite
    let perfectWeek = streak >= 7;
    if (perfectWeek) { pool = MSG_SEMAINE_PARFAITE; label = 'semaine_parfaite'; }
    else { pool = MSG_SERIE; label = 'serie'; }
  } else {
    pool = MSG_SERIE; label = 'serie';
  }

  const msg = pool[Math.floor(Math.random() * pool.length)];
  motivationLastShownDate = today;
  saveMotivationState();
  return { message: msg, label };
}

// ── Célébration à la complétion d'une tâche ──────────────────────────────
window.showTaskCompletionCelebration = (streak) => {
  if (streak < 2) return;

  // Célébration seulement aux paliers importants
  const paliers = [2, 3, 5, 7, 10, 14, 21, 30, 60, 100];
  if (!paliers.includes(streak)) return;

  let emoji, title, msg;
  if (streak === 2)  { emoji='🔥'; title=`${streak} jours de suite`; msg='La série commence. Ne la brise pas.'; }
  else if (streak === 3)  { emoji='⚡'; title=`${streak} jours de suite`; msg='Trois jours consécutifs. Le rythme s\'installe.'; }
  else if (streak === 5)  { emoji='💪'; title=`${streak} jours de suite`; msg='5 jours. Tu es sérieux. Continue.'; }
  else if (streak === 7)  { emoji='🌟'; title='Une semaine complète !'; msg='7 jours sans faillir. Tu viens peut-être de débloquer un thème...'; }
  else if (streak === 10) { emoji='🚀'; title='10 jours de suite !'; msg='10 jours. La plupart abandonnent bien avant. Pas toi.'; }
  else if (streak === 14) { emoji='💎'; title='2 semaines !'; msg='Deux semaines de régularité. Tu es dans une autre catégorie maintenant.'; }
  else if (streak === 21) { emoji='👑'; title='21 jours !'; msg='21 jours. L\'habitude est ancrée. Tu es devenu quelqu\'un d\'autre.'; }
  else if (streak === 30) { emoji='🏆'; title='30 jours !'; msg='Un mois entier. Tu viens peut-être de débloquer le thème Soleil Levant...'; }
  else if (streak === 60) { emoji='🔱'; title='60 jours !'; msg='Deux mois sans jamais lâcher. C\'est légendaire.'; }
  else { emoji='🌌'; title='100 jours !'; msg='100 jours. Tu es inarrêtable. Trivo n\'a plus de mots.'; }

  showCelebrationModal(emoji, title, msg, null);
  checkThemeUnlocks();
};

// ── Affichage du message du jour dans le dashboard ───────────────────────
window.renderCoachMessage = () => {
  const result = getCoachMessage();
  const el = document.getElementById('coach-message-wrap');
  if (!el) return;
  if (!result) { el.style.display = 'none'; return; }

  const colors = {
    'serie':           { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  icon: 'fa-fire',        color: '#22c55e' },
    'absence':         { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',  icon: 'fa-triangle-exclamation', color: '#ef4444' },
    'semaine_parfaite':{ bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)', icon: 'fa-star',        color: '#fbbf24' },
  };
  const style = colors[result.label] || colors['serie'];

  el.style.display = 'block';
  el.innerHTML = `
    <div style="
      background: ${style.bg}; border: 1px solid ${style.border};
      border-radius: 16px; padding: 14px 16px; margin-bottom: 16px;
      display: flex; gap: 12px; align-items: flex-start;
    ">
      <i class="fa-solid ${style.icon}" style="color:${style.color};font-size:16px;margin-top:2px;flex-shrink:0;"></i>
      <div style="font-size:13px;color:var(--text);line-height:1.65;">${result.message}</div>
    </div>`;
};

// Helper
function fmtDateM(d) {
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
}
