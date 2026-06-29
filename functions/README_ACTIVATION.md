# Activer les notifications push de groupe (point 6)

## Prérequis : passer Firebase au plan Blaze

1. Firebase Console → ton projet → en bas à gauche, clique sur **"Spark"** → **"Upgrade"**
2. Sélectionne **Blaze** (paie à l'usage)
3. Entre ta carte bancaire — **tu restes dans les quotas gratuits** pour un usage perso/petite équipe

---

## Déployer la Cloud Function

Dans ton terminal, à la racine du projet :

```bash
# 1. Installer Firebase CLI si besoin
npm install -g firebase-tools

# 2. Se connecter
firebase login

# 3. Installer les dépendances de la fonction
cd functions && npm install && cd ..

# 4. Déployer uniquement la fonction (pas tout le projet)
firebase deploy --only functions
```

---

## Activer le FCM côté app

Dans `notifications.js`, ligne 41, change :

```js
const FCM_ENABLED = false;
```

en :

```js
const FCM_ENABLED = true;
```

Puis redéploie le hosting :

```bash
firebase deploy --only hosting
```

---

## Ce que ça fait

Dès qu'un membre envoie un message dans un groupe, tous les autres membres
reçoivent une notification push (même si TRIVO est fermé) avec :
- **Titre** : le nom du groupe
- **Corps** : "Pseudo : début du message…"

La notif clique ramène à l'app.
