# User Stories — Refonte galerie d'images (MVP V1)

> Découpage opérationnel pour Claude Code et l'équipe.
> Chaque US = une PR à part (option B validée).
> Estimations en jours-développeur ; à ajuster selon ressources.
>
> **Périmètre V1 resserré** : améliorer l'existant sans introduire de nouveaux concepts produit.
> Les fonctionnalités plus ambitieuses (collections, panneau droit, bulk, soft delete) sont
> reportées en V2+ — voir `CLAUDE.md` section 4.

---

## Légende

- 🔴 **Critique** : bloquant pour la suite
- 🟡 **Majeur** : fonctionnalité MVP
- 🟢 **Polissage** : amélioration

- ⏱ Estimation
- ⚠ Risques / points de vigilance
- 🧪 Stratégie de test

---

## US-00 — Spike : investigation Mosaico 🔴

**Objectif** : comprendre exactement comment Mosaico interagit avec les images de LePatron, avant de toucher au modèle de données ou aux endpoints.

**Tâches** :

- Lire le code de l'intégration Mosaico dans `packages/editor/`
- Identifier les endpoints API consommés par Mosaico pour les images (upload, list, delete…)
- Identifier le format de réponse attendu par Mosaico
- Lister les champs d'image utilisés par Mosaico (id, url, dimensions…)
- Documenter dans un fichier `docs/gallery-redesign/MOSAICO_COMPAT.md` les contraintes à respecter

**Livrable** : document Markdown listant les contraintes Mosaico.

⏱ 1 jour
⚠ Si on ne fait pas ce spike, on risque de casser l'éditeur email à la première modif. Investissement essentiel.
🧪 Pas de tests automatisés, mais une PR "documentation" mergée dans develop.

---

## US-01 — Modèle de données : extensions du schéma Image 🔴

**Objectif** : faire évoluer le modèle Mongoose `Image` pour ajouter les champs nécessaires à la V1, **sans casser la compatibilité Mosaico**.

**Tâches** :

- Ajouter le champ `label` (libellé d'affichage, distinct du nom de fichier technique)
  - Par défaut, à l'upload, `label = nom de fichier original` (avant renommage technique)
- Ajouter le champ `source` (String, default `upload`)
- Ajouter le champ `externalMetadata` (Mixed, default `{}`)
- **Aucune modification ni suppression de champ existant**
- Ajouter les index Mongo nécessaires :
  - `templateId + label` (recherche)
  - `templateId + format` (filtre type)
  - `templateId + createdAt` (tri date)
- Adapter les sérializeurs API pour exposer ces nouveaux champs aux nouveaux endpoints, sans les exposer aux endpoints consommés par Mosaico (à valider via US-00)

⏱ 0.5 jour
⚠ La compat Mosaico est cruciale : ne pas modifier les champs existants. Voir US-00.
🧪 Tests unitaires Jest sur le modèle (validation, defaults, virtuals).

**Hors scope V1** :

- ❌ `deletedAt` / soft delete (reporté V2)
- ❌ Relation Image ↔ Collection (reporté V2, pas de collections en V1)

---

## US-02 — API backend : recherche, filtres, renommage 🔴

**Objectif** : enrichir l'endpoint de liste d'images existant pour supporter recherche et filtres, et ajouter un endpoint de renommage.

**Endpoints à modifier ou créer** :

- `GET /api/templates/:templateId/images` (modification) :
  - Filtres : `?search=`, `?format=jpg|png|gif`, `?sortBy=date_desc|date_asc`
  - Pagination/curseur pour scroll virtualisé
  - La normalisation du paramètre `format` doit gérer toutes les variantes de casse (JPG, jpg, JpG…) et matcher JPG ET JPEG pour le filtre "JPG"
- `PATCH /api/images/:id/label` (nouveau) :
  - Modifier le libellé d'une image
  - Le nom de fichier technique reste inchangé

**Compat Mosaico** : tous les endpoints existants utilisés par Mosaico doivent rester compatibles (voir US-00). Si nécessaire, dupliquer un endpoint plutôt que modifier celui consommé par Mosaico.

⏱ 1 jour
⚠ Préserver la compat Mosaico. Performance de recherche : utiliser un index Mongo sur `label`.
🧪 Tests Jest sur chaque endpoint (cas nominal + cas d'erreur). Test sur les variantes de casse du filtre format.

**Hors scope V1** :

- ❌ Endpoints de soft delete / restore / corbeille (reporté V2)
- ❌ Endpoints de collections (reporté V2)
- ❌ Endpoints de bulk (reporté V2)
- ❌ Endpoint d'usage `?usedIn` (reporté V2)

---

## US-03 — Script de migration des données existantes 🔴

**Objectif** : migrer les images existantes vers le nouveau modèle, sans interruption de service.

**Tâches** :

- Script `packages/server/scripts/migrate-gallery-v1.js`
- Pour chaque image existante :
  - Initialiser `label` à partir du nom de fichier original (ou nom technique si non disponible)
  - Initialiser `source = 'upload'`
  - Initialiser `externalMetadata = {}`
  - Régénérer les thumbnails standardisés via Sharp si nécessaire
- Propriétés :
  - **Idempotent** : skip les images déjà migrées (`label` non vide = skip)
  - **Resumable** : reprend là où il s'est arrêté (via curseur ou checkpoint)
  - **Dry-run** : option `--dry-run`
  - **Batched** : traite par lots de 100 images
  - **Logs progressifs** : `[1234/5678] Migrée image XYZ`
- Documentation d'utilisation dans `packages/server/scripts/README.md`

⏱ 1 jour
⚠ Tester sur un dump de prod avant de lancer en réel. Prévoir une fenêtre de maintenance pour le run réel.
🧪 Tests Jest unitaires sur les fonctions de migration. Un test E2E sur un dataset de 10 images mock.

---

## US-04 — Refonte de la grille galerie (panneau gauche) 🟡

**Objectif** : remplacer l'UI actuelle de la galerie par la nouvelle version. **Sans introduire de panneau droit, sans collections, sans sélection multiple.**

**Tâches** :

- Composant `GalleryPanel.vue` (ou équivalent, nom à valider à l'exploration) qui contient :
  - Onglets `Spécifique à l'email` / `Commun au template` (inchangés)
  - Barre de recherche (debounce 300ms, requête API avec `?search=`)
  - Filtres rapides (JPG/PNG/GIF) → requête API avec `?format=`
  - Filtres rapides date (récent/ancien) → requête API avec `?sortBy=`
  - Zone d'upload compacte (réduite quand des images existent — drag & drop + clic)
  - Grille virtualisée (lib type `vue-virtual-scroller` ou équivalent compatible Vue 2 / Vuetify 1.12)
  - Compteur d'images
- Composant `Thumb.vue` (ou équivalent) :
  - Vignette carrée
  - Damier si fond transparent (PNG/GIF), fond uni si JPG
  - Libellé sous la vignette (tronqué avec ellipsis si trop long)
  - Badge GIF si applicable
  - Tooltip au survol prolongé : libellé complet, dimensions, format, date d'upload
  - Overlay au survol avec 2 actions : **Éditer** / **Supprimer**
    - L'action "Renommer" peut être déclenchée par un double-clic sur le libellé (interaction subtile, pas dans l'overlay)
    - Ou via menu contextuel ⋯ — à arbitrer en cours de dev
- Empty state quand 0 image (galerie vide, recherche sans résultat, filtre sans résultat)

**Hors scope dans cette US** :

- ❌ Panneau droit (reporté V2)
- ❌ Mode Détails (reporté V2)
- ❌ Sélection multiple, checkboxes, bulk (reporté V2)
- ❌ Action "Collections" dans l'overlay (reporté V2)
- ❌ Avertissement à la suppression (décision produit : ISO existant)

⏱ 2.5 jours
🧪 Cypress : ouverture galerie, recherche d'une image, filtre par format, filtre par date, upload d'une image, survol d'une vignette pour voir le tooltip, ouverture de l'overlay.

---

## US-05 — Action Éditer depuis la galerie 🟡

**Objectif** : pouvoir relancer l'éditeur Konva sur une image déjà uploadée.

**Tâches** :

- Identifier le composant existant qui lance l'éditeur Konva lors d'un upload
- Créer un point d'entrée pour relancer cet éditeur sur une image existante :
  - Charger l'image source depuis le storage (FS ou S3)
  - Ouvrir l'éditeur Konva avec cette image
  - À la sauvegarde : remplacer l'image originale (pas de nouvelle version dans la V1)
- Brancher depuis l'action "Éditer" de l'overlay au survol d'une vignette
- À la sauvegarde, mettre à jour le thumbnail et invalider le cache front si nécessaire

**Décision produit confirmée** : on **remplace** l'image originale (plus simple, conforme au comportement actuel d'upload). L'historique des versions est explicitement reporté.

⏱ 1.5 jour
⚠ Konva est explicitement hors scope de modifications. On l'utilise, on ne le modifie pas. Vérifier que la sauvegarde régénère bien le thumbnail Sharp.
🧪 Cypress : ouvrir une image existante dans l'éditeur, modifier, sauvegarder, vérifier que la vignette est mise à jour.

---

## US-06 — Action Renommer le libellé 🟡

**Objectif** : permettre de renommer le libellé d'une image (le nom de fichier technique reste inchangé).

**Tâches** :

- Implémenter l'UI de renommage : **double-clic sur le libellé sous la vignette → champ inline éditable** (style Figma / Finder / Notion)
  - Valider par Entrée ou perte de focus
  - Annuler par Échap
  - Sélectionner tout le texte à l'entrée en mode édition (UX standard)
- Appel à l'endpoint `PATCH /api/images/:id/label`
- Mise à jour optimiste dans l'UI
- Gestion d'erreur (si le libellé est vide, trop long, ou en erreur réseau)

**Fallback si la solution s'avère complexe à implémenter proprement** : menu contextuel `⋯` sur la vignette → "Renommer" → input ou petite modale. À ne mobiliser qu'en dernier recours, avec validation du PO.

⏱ 0.5 jour
🧪 Cypress : renommer une image, vérifier l'affichage, vérifier la persistence après refresh.

---

## US-07 — Polissage 🟢

**Objectif** : finaliser les détails qui font la différence côté UX.

**Tâches** :

- Animations légères (apparition de l'overlay, transitions)
- États vides soignés (galerie vide, recherche sans résultat)
- Accessibilité de base (rôles ARIA, focus visible, navigation clavier)
- Gestion des erreurs (upload qui échoue, network error, timeout)
- Tooltips sur les icônes au survol prolongé
- Loading states (squelettes pendant le chargement de la grille)
- Cohérence visuelle finale avec le design system LePatron (validation avec Jonathan/Olivier)
- Tests de non-régression sur l'ensemble du flux
- Vérification finale de la compat Mosaico (test manuel : upload, édition d'email avec images, export)

⏱ 0.5 à 1 jour
🧪 Cypress sur les états vides, les erreurs réseau (avec interception). Test manuel Mosaico complet.

---

## Total estimé

| Phase          | US                  | Jours              |
| -------------- | ------------------- | ------------------ |
| Investigation  | US-00               | 1                  |
| Backend & data | US-01 à US-03       | 2.5                |
| UI             | US-04, US-05, US-06 | 4.5                |
| Polissage      | US-07               | 0.5 - 1            |
| **TOTAL V1**   |                     | **~8.5 à 9 jours** |

À ajouter : temps de review, allers-retours, intégration continue, débuggage en environnement de test. Compter probablement **2 à 3 semaines de calendrier** pour une exécution sereine à 1 développeur.

---

## V2 — Prévisualisation du périmètre suivant

À titre indicatif, la V2 ajoutera probablement, dans l'ordre :

1. Architecture 3 colonnes (panneau droit dédié)
2. Mode Détails dans le panneau droit (preview enrichie, métadonnées étendues, usage)
3. Soft delete + corbeille 30j + UI de restauration
4. Collections (création, gestion, navigation, vue "Non classées")
5. Sélection multiple + bulk actions
6. Indicateur d'usage généralisé
7. Avertissement à la suppression

L'estimation V2 sera à faire au moment venu, en intégrant les retours utilisateurs sur la V1.

---

_Ce découpage est indicatif. À ajuster en cours de chantier selon les découvertes, les retours de review, et les priorités du PO._
