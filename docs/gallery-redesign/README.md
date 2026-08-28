# Pack de transfert — Refonte galerie LePatron (MVP V1)

Ce dossier contient tout ce qu'il faut pour démarrer le développement de la **V1 de la refonte galerie** avec Claude Code.

> ⚠️ **Important** : ce pack reflète le **périmètre V1 resserré** après alignement avec Jonathan.
> Beaucoup de fonctionnalités initialement envisagées (collections, panneau droit, bulk, soft delete)
> sont explicitement reportées en V2+. Lire `CLAUDE.md` section 3 et 4 pour les détails.

## Contenu

- **`CLAUDE.md`** — Fichier de contexte principal, lu automatiquement par Claude Code à chaque session
- **`USER_STORIES.md`** — Découpage opérationnel en 7 user stories priorisées (V1 uniquement)
- **`mockup-v1.html`** — Première maquette, galerie en panneau gauche unique. **Référence visuelle V1.**
- **`mockup-v2.html`** — Maquette avec architecture split gauche/droite. **Cible V2 future, à ne pas implémenter dans la V1.**

## Périmètre V1 (rappel rapide)

**INCLUS** :

- Refonte UI grille (vignettes, libellés, overlay, damier, upload compact, scroll virtualisé)
- Recherche par libellé
- Filtres : type de fichier, date
- Actions : Éditer (Konva), Renommer (libellé), Supprimer (ISO existant), Télécharger (ISO existant)
- Tooltip au survol
- Migration des données existantes

**HORS SCOPE V1 (V2+)** :

- Panneau droit
- Collections
- Sélection multiple / bulk actions
- Soft delete / corbeille
- Mode Détails enrichi
- Indicateur d'usage
- Avertissement à la suppression

**Estimation** : ~8.5 à 9 jours-développeur, soit 2 à 3 semaines en calendrier.

## Installation dans le dépôt LePatron.email

### 1. Cloner le dépôt et passer sur develop

```bash
git clone git@github.com:Badsender-com/LePatron.email.git
cd LePatron.email
git checkout develop
git pull
```

### 2. Créer la structure de documentation

```bash
mkdir -p docs/gallery-redesign
```

### 3. Copier les fichiers du pack

Place les fichiers de ce pack aux emplacements suivants dans ton dépôt :

| Fichier source    | Destination dans le dépôt               |
| ----------------- | --------------------------------------- |
| `CLAUDE.md`       | `CLAUDE.md` (à la racine du dépôt)      |
| `USER_STORIES.md` | `docs/gallery-redesign/USER_STORIES.md` |
| `mockup-v1.html`  | `docs/gallery-redesign/mockup-v1.html`  |
| `mockup-v2.html`  | `docs/gallery-redesign/mockup-v2.html`  |

⚠️ **Attention** : il y a probablement déjà un `CLAUDE.md` à la racine si Bearstudio en a mis un (la branche `chore/migrate-claude-commands-to-claude-skills` le suggère). Dans ce cas, ne pas écraser ! Soit :

- Renommer notre fichier en `CLAUDE.gallery.md` à la racine
- Soit intégrer notre contenu en bas du fichier existant dans une section dédiée `## Refonte galerie d'images V1`

### 4. Créer une branche dédiée pour la documentation

```bash
git checkout -b chore/gallery-redesign-docs
git add CLAUDE.md docs/gallery-redesign/
git commit -m "docs: setup gallery redesign V1 project structure and references"
git push -u origin chore/gallery-redesign-docs
```

Ouvre une PR pour valider l'intégration de la doc dans `develop` avant de commencer le dev.

### 5. Démarrer Claude Code

Une fois la PR mergée (ou en parallèle sur la branche, peu importe) :

```bash
cd LePatron.email
claude
```

Au premier prompt, dis à Claude Code :

> Lis le fichier CLAUDE.md à la racine du dépôt, puis docs/gallery-redesign/USER_STORIES.md. On va démarrer le chantier de refonte de la galerie d'images, version V1. Avant d'attaquer l'US-00, explore brièvement le dépôt pour me confirmer la structure du monorepo et identifier les fichiers liés aux images (modèle Mongoose, endpoints, composants Vue). Donne-moi un état des lieux en 10-15 lignes maximum.

Claude Code prendra le contexte et te proposera un état des lieux, puis on attaquera l'US-00 (spike Mosaico).

## Workflow recommandé pour chaque US

1. **Lire** l'US dans `USER_STORIES.md`
2. **Demander un plan** à Claude Code avant tout dev (fichiers impactés, stratégie de test, risques)
3. **Valider le plan** ensemble
4. **Créer la branche** : `git checkout -b feat/gallery-redesign-XX-nom-court`
5. **Implémenter** (en plusieurs allers-retours avec Claude Code)
6. **Tester** localement
7. **Commit + push + PR**
8. **Review** (par toi ou un reviewer)
9. **Merge** dans develop
10. **Tester sur l'env de test**

## Si tu hésites ou si tu sens Claude Code dériver

Quelques prompts utiles :

- "Relis CLAUDE.md, j'ai l'impression qu'on s'éloigne du périmètre V1."
- "Cette fonctionnalité est-elle bien dans le périmètre V1 d'après CLAUDE.md ? Si non, on l'écarte."
- "Avant de continuer, fais un point sur l'avancement de l'US courante et ce qu'il reste à faire."

## Garde-fou anti-dérive de scope

Le piège principal de ce chantier : **ajouter des fonctionnalités "au passage" qui semblent évidentes**. Par exemple : "tant qu'on fait la suppression, autant ajouter la corbeille". NON. Le périmètre V1 est volontairement serré. Si une idée semble pertinente mais hors scope V1, **note-la pour la V2** mais ne l'implémente pas.

## Contacts

- PO du chantier : toi
- Refonte panneau gauche (en parallèle) : Olivier
- Refonte interface globale (panneau droit etc.) : Jonathan
- À surveiller : la branche `feat/unified-sidebar` pour éviter les conflits

---

Bonne route ! 🚀
