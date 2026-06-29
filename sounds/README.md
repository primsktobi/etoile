# 🎵 Comment ajouter tes sons d'ambiance

## Étape 1 — Dépose tes fichiers MP3

Place tes fichiers `.mp3` dans le dossier correspondant à leur thème :

```
sounds/
├── pluie-douce/      → tes sons de pluie
├── concentration/    → tes sons lo-fi / focus
├── foret/             → tes sons de forêt / nature
└── calme/             → tes sons calmes / méditation
```

Exemple :
```
sounds/pluie-douce/pluie-toit.mp3
sounds/pluie-douce/orage-lointain.mp3
sounds/concentration/lofi-beat-1.mp3
```

## Étape 2 — Déclare-les dans `sounds-manifest.json`

Ouvre le fichier `sounds/sounds-manifest.json` et ajoute le nom exact de chaque fichier dans la bonne catégorie :

```json
{
  "pluie-douce": {
    "label": "Pluie douce",
    "icon": "fa-cloud-rain",
    "files": ["pluie-toit.mp3", "orage-lointain.mp3"]
  },
  "concentration": {
    "label": "Concentration",
    "icon": "fa-brain",
    "files": ["lofi-beat-1.mp3"]
  },
  "foret": {
    "label": "Forêt",
    "icon": "fa-tree",
    "files": []
  },
  "calme": {
    "label": "Calme",
    "icon": "fa-spa",
    "files": []
  }
}
```

⚠️ **Important** : le nom dans `files` doit être EXACTEMENT le même que le nom du fichier (avec l'extension `.mp3`).

## Étape 3 — Déploie

Une fois tes fichiers ajoutés et le manifest mis à jour, déploie normalement (Vercel ou Firebase). L'app lira automatiquement ce fichier et affichera le menu Musique organisé par catégorie.

## Notes

- Tu peux renommer les `label` et changer les `icon` (icônes Font Awesome) si tu veux.
- Une catégorie sans fichier (`files: []`) ne s'affichera pas dans l'app.
- Formats supportés : `.mp3` (recommandé), `.wav`, `.ogg`.
