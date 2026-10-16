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

---

## backfill-gallery-dimensions.js

Script **one-shot** — à lancer une seule fois après le déploiement de l'US-09 (tooltip de métadonnées).

### Ce que le script fait

Le tooltip de la galerie affiche les dimensions d'origine d'une image. Les uploads les enregistrent depuis l'US-09, mais rien de ce qui a été stocké avant ne les possède — et elles ne sont pas récupérables depuis la vignette, qui est un carré de 111px. Le script relit donc chaque fichier stocké pour le mesurer.

Pour chaque image de chaque galerie :

- **Skip** si `width` et `height` sont déjà renseignés (idempotent — relançable sans risque)
- **Sinon** : lit **l'en-tête seulement** du fichier (128 Ko au plus, pas l'image entière), le mesure, et écrit `width` / `height`
- **Illisible** : une image listée en galerie mais absente du stockage, ou qui n'est pas une image, est comptée et passée — son tooltip n'affichera pas de dimensions, rien d'autre ne casse

### Usage

```bash
# 1. Dry-run sur une copie de prod
MONGODB_URI=mongodb://localhost:27017/lepatron-prod-copy \
  node packages/server/scripts/backfill-gallery-dimensions.js --dry-run

# 2. Réel
MONGODB_URI=mongodb://<prod-uri> \
  node packages/server/scripts/backfill-gallery-dimensions.js
```

### Propriétés

| Propriété             | Détail                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Idempotent**        | Relançable sans risque — les images déjà mesurées sont skippées                                               |
| **Resumable**         | Une interruption se rattrape par une relance                                                                  |
| **Dry-run**           | `--dry-run` simule sans écrire en base                                                                        |
| **Écriture atomique** | Chaque paire `width`/`height` est écrite par un update positionnel qui ne touche à rien d'autre du document   |
| **Sans arrêt**        | Peut tourner pendant que l'application sert                                                                   |
| **Doux**              | Lecture séquentielle, en-tête uniquement, timeout de 10s par fichier pour ne pas bloquer sur un stockage lent |

### Pourquoi l'écriture positionnelle

Même raison que pour `migrate-gallery-v1.js` ci-dessus, et elle vaut la peine d'être répétée : lire `gallery.files` et le réécrire efface tout ce que le getter du schéma ne projette pas, et perd les uploads arrivés pendant la lecture. Aucune des deux erreurs ne se signale.
