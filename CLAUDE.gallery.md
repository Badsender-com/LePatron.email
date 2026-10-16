# CLAUDE.md — Refonte galerie d'images LePatron (MVP V1)

> Ce fichier est lu automatiquement par Claude Code à chaque session sur ce dépôt.
> Il contient tout le contexte nécessaire pour travailler sur la **refonte de la galerie d'images** de LePatron.
> Il ne remplace PAS les conventions générales du projet : il s'y ajoute, scopé à ce chantier.

---

## 1. Contexte produit

**Projet** : refonte de la galerie d'images de LePatron, l'outil WYSIWYG de création d'emails de Badsender.

**Approche** : itération par phases. Cette V1 améliore l'existant **sans introduire de nouveaux concepts produit**. Les fonctionnalités plus ambitieuses (collections, panneau droit, bulk, soft delete) sont reportées explicitement en V2+.

**Problème actuel** :

- Vignettes trop grosses, mal calibrées, libellés invisibles
- Pas de recherche sur les images
- Impossible de relancer l'éditeur sur une image déjà uploadée
- Galerie "Commun au template" presque inutilisée

**Cibles utilisateurs** :

- **Marie, marketeer (principal)** : multitâche, sous deadline, veut retrouver vite la bonne image
- **Alex, freelance/agence (secondaire)** : plus exigeant, utilise les fonctionnalités avancées

**Objectif V1** : améliorer significativement la galerie sur les 3 plus gros irritants (vignettes/lisibilité, recherche, édition rétroactive) **sans rien casser ni rien complexifier**.

---

## 2. ⚠️ Principe directeur : ISO comportement existant

**Cette V1 améliore l'UI/UX, la recherche, et ajoute l'édition rétroactive et le renommage. Rien d'autre dans le comportement utilisateur ne doit changer.**

Conséquences concrètes à respecter :

- L'upload dans la galerie continue de déclencher l'éditeur Konva
- L'upload direct dans l'email continue de déclencher le resize auto
- La suppression d'une image dans la galerie ne propage rien dans les emails (comportement actuel)
- Pas de notion de "corbeille" : la suppression reste définitive et immédiate (comme aujourd'hui)
- Pas d'avertissement à la suppression (l'image dans les emails n'est pas affectée, donc rien à avertir)
- L'API consommée par Mosaico reste compatible à 100%

**Tout ce qui n'est pas explicitement listé dans le périmètre V1 (section 3) doit conserver le comportement actuel.**

---

## 3. Périmètre MVP V1

### Inclus dans la V1

1. **Refonte UI/UX du panneau galerie (panneau gauche existant)**

   - Vignettes plus petites et standardisées (thumbnails carrés générés via Sharp)
   - Libellé visible sous chaque vignette
   - Overlay au survol avec actions rapides (éditer, supprimer)
   - Damier sur fond transparent (PNG/GIF), fond plein pour les JPG
   - Zone d'upload réduite et discrète quand des images existent
   - Compteur d'images affiché
   - Scroll virtualisé pour gérer les grandes galeries

2. **Recherche et filtres**

   - Barre de recherche sur le libellé
   - Filtres rapides par type de fichier : **JPG, PNG, GIF** (toutes variantes de casse normalisées en lowercase à l'upload)
   - Filtres rapides par date d'upload (récent / ancien)

3. **Tooltip au survol d'une vignette**

   - Libellé complet (utile si tronqué dans l'affichage)
   - Dimensions originales
   - Format
   - Date d'upload

4. **Actions sur une image**

   - **Éditer** : relance l'éditeur Konva sur l'image existante (NOUVEAU)
   - **Renommer le libellé** : le nom de fichier technique reste inchangé (NOUVEAU)
   - **Supprimer** : ISO comportement actuel, pas d'avertissement, pas de corbeille
   - **Télécharger** : ISO comportement actuel

5. **Préparation technique pour évolutions futures**

   - Champ `source` sur chaque image (default `upload`, futur `dam_bynder`, etc.)
   - Champ `externalMetadata` (objet JSON libre)
   - Aucun impact UI, juste deux champs en plus dans le modèle

6. **Migration des données existantes**
   - Script de migration pour générer les thumbnails standardisés
   - Initialisation du champ `label` (libellé) à partir du nom de fichier

### Hors scope V1 (reporté V2+)

- **Architecture 3 colonnes** (panneau droit dédié)
- **Collections** (création, gestion, navigation, vue "Non classées")
- **Sélection multiple et bulk actions** (supprimer / collections en masse)
- **Soft delete et corbeille 30 jours** + UI de restauration
- **Mode Détails** complet (panneau enrichi avec métadonnées étendues, usage, etc.)
- **Indicateur d'usage** ("utilisée dans X email(s)") affiché ou utilisé
- **Avertissement à la suppression**
- **Question du lien image ↔ email** (cascade ou pas en cas de modification/suppression — décision produit reportée explicitement)

### Hors scope V3+ (encore plus tard)

- Tagging automatique IA à l'upload (recherche thématique)
- Intégration DAM clients via API (Bynder, Cloudinary, Frontify…)
- Vues intelligentes prédéfinies (Récents, Jamais utilisées, Mes uploads)
- Système de rôles
- Transfert d'images entre galeries
- Historique des versions

---

## 4. Décisions produit reportées en V2+ (à NE PAS rouvrir dans la V1)

Ces points ont été débattus longuement en phase de cadrage. Ils sont volontairement reportés. **Ne pas les ré-implémenter, même partiellement, dans la V1.**

### Lien image ↔ email

Le comportement actuel est **strictement préservé** dans la V1.

- Supprimer une image de la galerie ne l'affecte pas dans les emails qui l'utilisent (les emails embarquent leur propre copie)
- Modifier une image dans la galerie ne propage rien
- Aucune cascade, aucun lien fort

La question d'introduire un lien plus fort (pour permettre "modifier le logo partout en une fois", par exemple) est reportée en V2+ et nécessitera une discussion produit dédiée.

### Collections vs dossiers vs tags

Après débat, le modèle retenu pour la V2 est : **collections** (regroupements non-exclusifs, créés par les utilisateurs, partagés entre tous les utilisateurs du template). Pas de dossiers, pas de tags utilisateur.

### Workspaces et galerie

Pas de lien entre les workspaces et la galerie. La galerie reste rattachée au template (galerie commune) ou à l'email (galerie spécifique). Décision reportée en V2+.

---

## 5. Architecture technique cible (V1)

### Disposition

L'éditeur LePatron a un **panneau latéral gauche** d'environ 400px (largeur fixe, 364px utiles avec padding). La V1 se loge dans ce panneau, **sans introduire de panneau droit**.

Une refonte plus large des panneaux est en cours par Jonathan et Olivier. Notre V1 doit rester **compatible avec leur travail** et **ne pas dépendre de leurs livrables**. Si la nouvelle architecture 3 colonnes arrive en cours de chantier, on s'y adaptera, mais on ne l'attend pas.

### Modèle de données

Sur le modèle Mongoose `Image` (à adapter selon le nom réel) :

```js
{
  // existant - inchangé
  ...

  // nouveau
  label: String,              // libellé d'affichage (distinct du nom de fichier technique)
  source: String,             // default: 'upload'
  externalMetadata: Mixed,    // default: {}
}
```

**Aucun champ existant ne doit être modifié ou retiré.**

Index Mongo à ajouter pour les performances de recherche/filtre :

- `templateId + label` (recherche)
- `templateId + format` (filtre type)
- `templateId + createdAt` (tri date)

---

## 6. Stack technique

| Couche        | Techno                                              |
| ------------- | --------------------------------------------------- |
| Front         | Vue 2.6.14 + Nuxt 2.17 + Vuetify 1.12               |
| State         | Vuex 3.6                                            |
| Back          | Express 4.17 + Mongoose 5.13                        |
| DB            | MongoDB 4.2                                         |
| Stockage      | FS local OU AWS S3                                  |
| Images        | Sharp 0.33                                          |
| Éditeur img   | Konva 9.3 (existant, à ne PAS toucher)              |
| Éditeur email | Mosaico (fork Badsender)                            |
| Tests         | Jest + Cypress                                      |
| Lint          | ESLint (standard + vue/recommended)                 |
| Format        | Prettier (2 spaces, single quotes)                  |
| Node          | 18.18.0 (`.nvmrc`)                                  |
| Yarn          | Classic (< v2)                                      |
| Monorepo      | `packages/server`, `packages/ui`, `packages/editor` |

**Conventions critiques** :

- Pas de TypeScript (JS only)
- Pas de migration de versions Vue/Vuetify dans ce projet
- Rester cohérent avec l'existant

---

## 7. Risques techniques identifiés

⚠️ **Points à investiguer en priorité** avant tout dev :

1. **Mosaico** : l'API images existante doit rester compatible. C'est la zone la plus risquée. Avant toute modif du modèle de données ou des endpoints, **comprendre exactement comment Mosaico consomme les images** (US-00).
2. **Vue 2 / Vuetify 1.12** : versions anciennes (Vue 2 en fin de vie). Pas de migration prévue. Choisir des composants/libs compatibles.
3. **Performance** : galeries de plusieurs centaines d'images chez gros clients (Clarins ~300 utilisateurs, 18 marchés, un template). Virtualisation front + indexation Mongo indispensables.
4. **Comportement asymétrique upload existant** : upload dans la galerie → déclenche l'éditeur Konva. Upload direct dans l'email → resize auto. **À PRÉSERVER ABSOLUMENT.**

---

## 8. Conventions de travail

### Branches

- Branche de départ : `develop`
- Branches de feature : `feat/gallery-redesign-XXX` où XXX est l'identifiant court de l'US (ex: `feat/gallery-redesign-data-model`)
- **Ne PAS** travailler sur `develop` directement
- **Une PR par US** (option B validée avec le PO)

### Commits

Style observé sur les branches récentes : préfixes `feat:`, `fix:`, `chore:`, `docs:` (Conventional Commits probable, à confirmer à l'exploration du repo).

### Pull Requests

- Description claire avec :
  - Lien vers l'US correspondante (`USER_STORIES.md`)
  - Liste des changements
  - Comment tester
  - Captures d'écran si UI
- Reviewer assigné : à définir avec le PO
- Merger uniquement après review + tests passants

### Tests

- **Jest** : tests unitaires pour tout nouveau service backend et tout nouvel endpoint API
- **Cypress** : 1 à 2 tests E2E par PR sur les parcours critiques (recherche, filtre, édition d'image, renommage…)
- **Test de non-régression Mosaico** : à chaque PR qui touche le modèle d'image ou les endpoints, vérifier que l'éditeur email fonctionne toujours

### Migration des données

- Script Node.js dans `packages/server/scripts/`
- Idempotent (relançable sans dommage)
- Resumable (reprend là où il s'est arrêté)
- Mode `--dry-run` obligatoire
- Logs progressifs
- Lancé manuellement, hors heures de bureau

---

## 9. Découpage en User Stories

Voir le fichier dédié : **`docs/gallery-redesign/USER_STORIES.md`**

Ordre de priorité (à suivre sauf décision contraire) :

1. **Investigation Mosaico** (spike) — 1 jour
2. **Modèle de données** : libellé, source, externalMetadata
3. **API backend** : recherche, filtres, renommage
4. **Script de migration** des thumbnails et libellés
5. **Refonte grille panneau gauche** : vignettes, libellé, overlay, upload, compteur, virtualisation, damier, tooltip
6. **Action Éditer** depuis la galerie (intégration Konva sur image existante)
7. **Polissage**

Estimation totale : **5 à 7 jours-développeur**, soit **1.5 à 2 semaines** en calendrier.

---

## 10. Références visuelles

Maquettes HTML statiques en référence (à ouvrir dans un navigateur) :

- **`docs/gallery-redesign/mockup-v1.html`** : première itération, galerie en panneau gauche unique. **C'est la référence visuelle la plus proche du périmètre V1**, car elle n'a pas de panneau droit. Note : elle inclut des éléments hors scope V1 (collections, bulk) qu'il faut ignorer.
- **`docs/gallery-redesign/mockup-v2.html`** : itération avec architecture split gauche/droite. **Référence pour la V2 future**, à ne pas implémenter dans la V1.

Points de design importants à respecter pour la V1 :

- **Damier** sur les fonds d'images transparentes (PNG, GIF). Pattern classique 12px gris clair / blanc.
- **Vignettes carrées** standardisées via Sharp, libellé en bas de chaque vignette
- **Overlay au survol** avec 2 actions seulement dans la V1 : **Éditer / Supprimer**
- **Tooltip** au survol prolongé avec libellé / dimensions / format / date
- **Palette** : navy `#0d3b4f`, cyan `#1bb5d6`, cyan soft `#e6f7fb`, gris neutre

---

## 11. Definition of Done (par US)

Une US est considérée terminée si :

- [ ] Code écrit et fonctionnel
- [ ] Tests Jest (back) et/ou Cypress (front) écrits et passants
- [ ] Lint et Prettier passent
- [ ] Pas de régression Mosaico (vérification manuelle ou automatisée)
- [ ] PR ouverte avec description claire
- [ ] Review validée
- [ ] Mergée dans `develop`

---

## 12. Comment travailler avec Claude Code sur ce chantier

À ton démarrage en tant que Claude Code dans ce dépôt, commence par :

1. **Lire ce fichier en entier** (déjà fait si tu lis ces lignes)
2. **Lire `docs/gallery-redesign/USER_STORIES.md`** pour comprendre le découpage détaillé
3. **Ouvrir les maquettes** `docs/gallery-redesign/mockup-v1.html` (référence V1) — note : mockup-v2.html est la cible V2, à ignorer pour cette phase
4. **Explorer le code existant** :
   - `packages/server/` pour comprendre la structure backend
   - `packages/ui/` pour comprendre les composants Vue existants
   - Chercher les fichiers actuels liés aux images (modèle Mongoose, endpoints, composants gallerie)
5. **Surveiller la branche `feat/unified-sidebar`** (travail de Jonathan/Olivier sur les panneaux) pour éviter les conflits
6. **Demander au PO** la prochaine US à attaquer (ou prendre la suivante dans l'ordre de priorité)
7. **Avant tout dev**, présenter au PO un plan d'attaque pour l'US :
   - Fichiers à créer/modifier
   - Stratégie de test
   - Risques identifiés
   - Estimation de temps

**Règles d'or** :

- Ne JAMAIS toucher au code de Mosaico (`packages/editor/`) sans validation explicite du PO
- Tout changement sur le modèle d'image doit préserver la compatibilité avec Mosaico
- Ne JAMAIS ajouter de fonctionnalités hors scope V1, même si elles semblent évidentes (collections, soft delete, bulk, etc.). Elles sont reportées explicitement.
- En cas de doute sur le scope, demander au PO.

---

_Dernière mise à jour : juin 2026 — version V1 (périmètre resserré après alignement avec Jonathan)._
