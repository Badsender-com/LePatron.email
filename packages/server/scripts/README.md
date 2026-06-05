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
# 1. Toujours commencer par un dry-run
node packages/server/scripts/migrate-gallery-v1.js --dry-run

# 2. Vérifier les logs, puis lancer la migration réelle
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

### Précautions

- Tester sur un dump de prod avant de lancer en environnement réel
- Lancer hors heures de bureau
- Vérifier les logs après exécution (ligne `Erreurs : N` absente = OK)
- La valeur de `uploadedAt` pour les images existantes est une approximation (`gallery.createdAt`) — ce n'est pas la vraie date d'upload
