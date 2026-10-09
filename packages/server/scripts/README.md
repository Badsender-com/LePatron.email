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
Galeries : 47 | Images totales : 312

[1/47] 507f1f77bcf86cd799439011 — 8 migrée(s), 2 déjà à jour
[2/47] 507f1f77bcf86cd799439022 — 0 migrée(s), 5 déjà à jour
...

--- Résultat ---
Galeries traitées : 47/47
Images migrées    : 287
Images skippées   : 25
```

### Propriétés

| Propriété      | Détail                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| **Idempotent** | Relançable sans risque — les images déjà migrées sont skippées                       |
| **Resumable**  | Par conception : si le script est interrompu, relancer reprend là où il s'est arrêté |
| **Dry-run**    | `--dry-run` simule sans écrire en base                                               |
| **Batché**     | Traite les galeries par lots de 10                                                   |
| **Résilient**  | Une erreur sur une galerie n'arrête pas la migration des suivantes                   |

### ⚠️ À lancer galerie au repos — écriture non atomique

**Le script lit une galerie, la modifie et la réécrit** (`gallery.save()`). C'est précisément le motif que le serveur a abandonné pour les écritures galerie : lors d'un upload concurrent, le second enregistrement porte une version périmée et Mongoose le refuse avec une `VersionError`. L'image était stockée mais n'apparaissait jamais dans la galerie.

**Conséquence si le script tourne pendant que des utilisateurs uploadent :**

| Risque             | Détail                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Galerie non migrée | Le `save()` du script échoue sur une `VersionError` — cette galerie est comptée en erreur et passée        |
| **Upload perdu**   | À l'inverse, c'est l'upload de l'utilisateur qui peut échouer, et son image ne jamais rejoindre la galerie |

Le premier cas est bénin : le script est résilient et reprenable, une relance rattrape la galerie. **Le second ne l'est pas** — l'utilisateur perd son image sans que le script le sache.

**Donc : lancer le script quand personne n'édite.** Hors heures de bureau, ou mieux, en fenêtre de maintenance. Ce n'est pas une recommandation de confort, c'est la condition pour ne pas faire perdre de données.

Le script n'a volontairement pas été réécrit en écritures atomiques : c'est un one-shot, et une migration en fenêtre de maintenance est de toute façon la bonne pratique pour un backfill de cette nature.

### Précautions

- Tester sur un dump de prod avant de lancer en environnement réel
- **Lancer hors heures de bureau** (voir l'avertissement ci-dessus — ce n'est pas optionnel)
- Vérifier les logs après exécution (ligne `Erreurs : N` absente = OK)
- Si des erreurs apparaissent, relancer : le script est idempotent et reprendra les galeries manquées
- La valeur de `uploadedAt` pour les images existantes est une approximation (`gallery.createdAt`) — ce n'est pas la vraie date d'upload
