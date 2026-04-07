# Plan UX : Refonte du Panneau Commentaires

> **Branche** : `mvp-comments` > **Priorité** : HIGH
> **Effort estimé** : MOYEN (2-3 sessions)

---

## Contexte

Retours utilisateurs sur le système de commentaires actuel :

1. "The filtered options is not clear: how to activate/deactivate it?"
2. "Add a number icon of unresolved comments by block?"
3. Le panneau est aligné à gauche, incohérent avec l'UX (le contenu est à gauche, les outils à droite)

---

## Objectifs

1. **Déplacer le panneau commentaires à droite** (cohérence UX)
2. **Ajouter un rail visuel** sur le côté droit montrant les indicateurs de commentaires par bloc
3. **Simplifier le système de filtre** avec une UX claire
4. **Améliorer l'action "commenter un bloc"** (focus sur création)

---

## Architecture Actuelle

### Fichiers clés

| Fichier                                                | Rôle                                   |
| ------------------------------------------------------ | -------------------------------------- |
| `packages/editor/src/css/badsender-editor.less`        | Styles du panneau (lignes 649-1523)    |
| `packages/editor/src/tmpl-badsender/toolbox.tmpl.html` | Structure HTML (lignes 226-471)        |
| `packages/editor/src/js/ext/badsender-comments.js`     | Logique Knockout.js                    |
| `packages/editor/src/tmpl/main.tmpl.html`              | Layout principal + indicateur flottant |
| `packages/editor/src/tmpl/block-wysiwyg.tmpl.html`     | Badge sur toolbar bloc                 |

### État actuel

- Panneau : Sidebar gauche (classe `.slidebar`)
- Badge commentaires : Dans la toolbar du bloc (pas sur le bloc lui-même)
- Filtre : S'active implicitement au clic sur badge, bouton "Tout voir" pour désactiver
- Indicateur flottant : Badge en bas à droite quand panneau fermé

---

## Spécifications Fonctionnelles

### US-1 : Panneau aligné à droite

**En tant qu'** utilisateur
**Quand** j'ouvre le panneau commentaires
**Alors** il s'affiche sur le côté droit de l'écran (pas à gauche)

**Critères** :

- Le panneau s'ouvre depuis la droite
- Animation slide-in cohérente
- Largeur : 360px (inchangée)
- Z-index correct (au-dessus du contenu)

---

### US-2 : Rail d'indicateurs à droite

**En tant qu'** utilisateur
**Quand** je visualise l'éditeur
**Alors** je vois un rail vertical à droite avec des marqueurs pour chaque bloc ayant des commentaires

```
┌─────────────────────────────────┐
│          ÉDITEUR                │  ●─ 2 (header)
│                                 │
│          [Bloc Header]          │
│                                 │
│          [Bloc Cover]           │  ●─ 1 (cover) [rouge si bloquant]
│                                 │
│          [Bloc Article]         │     (pas de marqueur)
│                                 │
│          [Bloc Footer]          │  ●─ 3 (footer)
└─────────────────────────────────┘
```

**Critères** :

- Marqueurs alignés verticalement avec les blocs correspondants
- Affiche le nombre de commentaires **non résolus**
- Couleur selon sévérité max :
  - Rouge (`--error`) si au moins un "bloquant"
  - Orange (`--warning`) si au moins un "important"
  - Gris (`--gray-400`) sinon
- Marqueur cliquable → filtre les commentaires sur ce bloc

---

### US-3 : Clic sur un marqueur du rail

**En tant qu'** utilisateur
**Quand** je clique sur un marqueur du rail
**Alors** :

- Le panneau commentaires s'ouvre (s'il était fermé)
- Les commentaires sont filtrés sur ce bloc
- Le textarea "nouveau commentaire" reçoit le focus
- Le marqueur est visuellement "actif"

---

### US-4 : Filtrage par chips (dans le panneau)

**En tant qu'** utilisateur
**Quand** le panneau est ouvert
**Alors** je vois deux chips de filtre en haut :

```
┌─────────────────────────────────┐
│ [Tous]  [Bloc actuel]           │
├─────────────────────────────────┤
│ ... liste des commentaires ...  │
└─────────────────────────────────┘
```

**Comportement** :

- **"Tous"** : Affiche tous les commentaires, toujours cliquable
- **"Bloc actuel"** : Affiche uniquement les commentaires du bloc sélectionné
  - Désactivé (grisé) si aucun bloc n'est sélectionné
  - Affiche le nom/type du bloc quand actif (ex: "Cover #3")
- Clic sur un marqueur du rail → active automatiquement "Bloc actuel"

---

### US-5 : Création de commentaire contextualisée

**En tant qu'** utilisateur
**Quand** je crée un commentaire avec le filtre "Bloc actuel" actif
**Alors** le commentaire est automatiquement associé à ce bloc

**Quand** je crée un commentaire avec le filtre "Tous" actif et aucun bloc sélectionné
**Alors** le commentaire est créé comme commentaire **global** (non lié à un bloc)

---

### US-6 : Synchronisation bloc sélectionné / rail

**En tant qu'** utilisateur
**Quand** je clique sur un bloc dans l'éditeur (pour l'éditer)
**Alors** :

- Le marqueur correspondant dans le rail est mis en surbrillance (si commentaires existants)
- Le "bloc actuel" en mémoire est mis à jour
- Le chip "Bloc actuel" devient cliquable

---

### US-7 : Badge dans toolbar bloc (existant, à conserver)

**En tant qu'** utilisateur
**Quand** je survole un bloc
**Alors** je vois le badge de commentaires dans la toolbar du bloc (comportement existant)

**Au clic** :

- Ouvre le panneau filtré sur ce bloc
- Focus sur le textarea

---

## Spécifications Techniques

### Phase 1 : Déplacer le panneau à droite

**Fichiers à modifier** :

1. **CSS** (`badsender-editor.less`) :

   ```less
   // Avant : left: 0
   // Après : right: 0
   .slidebar {
     position: fixed;
     right: 0; // Changé de left: 0
     // ... reste inchangé
   }
   ```

2. **Animation** : Inverser la direction du slide (de droite vers gauche)

**Estimation** : 30 min

---

### Phase 2 : Ajouter le rail d'indicateurs

**Fichiers à créer/modifier** :

1. **HTML** (`main.tmpl.html`) :

   ```html
   <!-- Rail commentaires -->
   <div class="comments-rail" data-bind="visible: commentsRailVisible">
     <!-- ko foreach: blocksWithComments -->
     <div
       class="rail-marker"
       data-bind="style: { top: position + 'px' },
                     css: { active: $root.selectedBlockForComments() === blockId },
                     click: function() { $root.openCommentsForBlock(blockId) }"
     >
       <span class="rail-count" data-bind="text: unresolvedCount"></span>
     </div>
     <!-- /ko -->
   </div>
   ```

2. **CSS** (`badsender-editor.less`) :

   ```less
   .comments-rail {
     position: fixed;
     right: 8px;
     top: 60px;
     bottom: 60px;
     width: 24px;
     z-index: 100;
   }

   .rail-marker {
     position: absolute;
     width: 24px;
     height: 24px;
     border-radius: 50%;
     background: var(--gray-400);
     color: white;
     display: flex;
     align-items: center;
     justify-content: center;
     cursor: pointer;
     font-size: 11px;
     font-weight: 600;
     transition: all 0.15s;

     &.severity-blocking {
       background: var(--error);
     }
     &.severity-important {
       background: var(--warning);
     }
     &.active {
       transform: scale(1.2);
       box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.3);
     }
   }
   ```

3. **JavaScript** (`badsender-comments.js`) :

   ```javascript
   // Nouvel observable pour le rail
   viewModel.blocksWithComments = ko.computed(function () {
     var counts = viewModel.commentCounts();
     var blocks = []; // Récupérer les blocs visibles avec leurs positions
     // ... logique de calcul des positions
     return blocks;
   });

   viewModel.commentsRailVisible = ko.computed(function () {
     return Object.keys(viewModel.commentCounts()).length > 0;
   });
   ```

**Estimation** : 2-3h

---

### Phase 3 : Chips de filtre

**Fichiers à modifier** :

1. **HTML** (`toolbox.tmpl.html`) :

   ```html
   <div class="comments-filter-chips">
     <button
       class="chip"
       data-bind="css: { selected: !selectedBlockForComments() },
                        click: showAllComments"
     >
       <span data-bind="text: t('comments-filter-all')">Tous</span>
     </button>
     <button
       class="chip"
       data-bind="css: { selected: selectedBlockForComments(),
                               disabled: !lastSelectedBlock() },
                        click: filterToCurrentBlock,
                        enable: lastSelectedBlock()"
     >
       <span data-bind="text: currentBlockLabel">Bloc actuel</span>
     </button>
   </div>
   ```

2. **JavaScript** (`badsender-comments.js`) :

   ```javascript
   // Nouveau : Garder le dernier bloc sélectionné même après "Tous"
   viewModel.lastSelectedBlock = ko.observable(null);

   viewModel.currentBlockLabel = ko.computed(function () {
     var blockId = viewModel.lastSelectedBlock();
     if (!blockId) return viewModel.t('comments-filter-block');
     // Récupérer le type/index du bloc
     return 'Cover #3'; // exemple
   });

   viewModel.filterToCurrentBlock = function () {
     var blockId = viewModel.lastSelectedBlock();
     if (blockId) {
       viewModel.selectedBlockForComments(blockId);
     }
   };
   ```

**Estimation** : 1-2h

---

### Phase 4 : API - Compteur avec sévérité

**Fichiers à modifier** :

1. **Backend** (`comment.service.js`) :

   - Modifier `getBlockCommentCounts` pour retourner la sévérité max par bloc

   ```javascript
   // Retour actuel : { blockId: count }
   // Nouveau retour : { blockId: { count: N, maxSeverity: 'blocking'|'important'|'info' } }
   ```

2. **Frontend** : Adapter le parsing de la réponse

**Estimation** : 1h

---

## Plan d'exécution

| Phase | Description        | Fichiers          | Effort |
| ----- | ------------------ | ----------------- | ------ |
| 1     | Panneau à droite   | CSS               | 30 min |
| 2     | Rail d'indicateurs | HTML, CSS, JS     | 2-3h   |
| 3     | Chips de filtre    | HTML, JS          | 1-2h   |
| 4     | API sévérité       | Backend, Frontend | 1h     |

**Total estimé** : 5-7h

---

## Décisions UX

1. **Position du rail quand panneau ouvert** : ✅ **Option B** - Rail visible mais décalé à gauche du panneau
2. **Scroll dans l'éditeur** : ✅ **Option A** - Position relative aux blocs (suit le scroll)
3. **Mobile/Responsive** : ✅ **Option A** - Rail masqué, uniquement badges dans toolbar

---

## Critères de validation

- [ ] Panneau s'ouvre depuis la droite
- [ ] Rail visible avec compteurs par bloc
- [ ] Couleur des marqueurs selon sévérité
- [ ] Chips "Tous" / "Bloc actuel" fonctionnels
- [ ] Clic sur marqueur → filtre + focus textarea
- [ ] Sélection bloc dans éditeur → highlight dans rail
- [ ] Tests manuels : création, édition, suppression commentaires

---

_Plan créé : Mars 2026_
