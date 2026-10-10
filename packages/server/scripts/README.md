# Scripts serveur LePatron

## migrate-gallery-v1.js

Script de migration **one-shot** — à lancer une seule fois après le déploiement de la V1 galerie.

### Ce que le script fait

Pour chaque image dans toutes les galeries :

- **Skip** si `uploadedAt` est déjà défini (idempotent — relançable sans risque)
- **Sinon** : initialise les champs V1 manquants :
  - `label` → nom technique du fichier si l'original est perdu
  - `source` → `'upload'`
  - `externalMetadata` → `{}`
  - `uploadedAt` → `gallery.createdAt` (meilleure approximation disponible)

### Usage

```bash
# 1. Toujours commencer par un dry-run sur une copie de prod
MONGODB_URI=mongodb://localhost:27017/lepatron-prod-copy \
  node packages/server/scripts/migrate-gallery-v1.js --dry-run

# 2. Si le dry-run est OK, lancer la migration réelle sur la copie
MONGODB_URI=mongodb://localhost:27017/lepatron-prod-copy \
  node packages/server/scripts/migrate-gallery-v1.js

# 3. Puis sur prod
MONGODB_URI=mongodb://<prod-uri> \
  node packages/server/scripts/migrate-gallery-v1.js
```

### Exemple de sortie

```
Migration galerie V1
Galeries : 47

[1/47] 507f1f77bcf86cd799439011 — 8 migrée(s), 2 déjà à jour
[2/47] 507f1f77bcf86cd799439022 — 0 migrée(s), 5 déjà à jour
...

--- Résultat ---
Galeries traitées : 47/47
Images totales    : 312
Images migrées    : 287
Images skippées   : 25
```

### Propriétés

| Propriété             | Détail                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **Idempotent**        | Relançable sans risque — les images déjà migrées sont skippées                             |
| **Resumable**         | Par conception : si le script est interrompu, relancer reprend là où il s'est arrêté       |
| **Dry-run**           | `--dry-run` simule sans écrire en base                                                     |
| **Écriture atomique** | Chaque image est écrite par un update positionnel qui ne touche à rien d'autre du document |
| **Sans arrêt**        | Peut tourner pendant que l'application sert                                                |
| **Résilient**         | Une erreur sur une galerie n'arrête pas la migration des suivantes                         |

### Pourquoi l'écriture positionnelle

La première version lisait `gallery.files`, modifiait le tableau et le réécrivait (`gallery.save()`). Cette forme est fausse deux fois :

- le getter du schéma **projette** chaque fichier sur un jeu de clés fixe, donc réécrire cette projection efface silencieusement tout ce qu'elle ne liste pas — `originalName` en particulier ;
- réécrire le tableau entier perd tout upload arrivé pendant la lecture, et c'est exactement le motif que le serveur a abandonné pour les écritures galerie (`VersionError` sur upload concurrent).

Aucune des deux erreurs ne se signale. Le script lit donc le document brut (`gallery.get('files', null, { getters: false })`) et n'écrit que les champs V1 des images qu'il migre, un `$set` positionnel à la fois. **Il n'a donc plus besoin d'une fenêtre de maintenance.**

### Précautions

- Tester sur un dump de prod avant de lancer en environnement réel
- Vérifier les logs après exécution (ligne `Erreurs : N` absente = OK)
- Si des erreurs apparaissent, relancer : le script est idempotent et reprendra les galeries manquées
- La valeur de `uploadedAt` pour les images existantes est une approximation (`gallery.createdAt`) — ce n'est pas la vraie date d'upload
