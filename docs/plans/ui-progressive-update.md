# Plan de mise à jour progressive de l'interface LePatron.email

> **Type**: Plan d'harmonisation UI progressive
> **Durée estimée**: Plusieurs sprints/branches
> **Référence**: `docs/design-system/`

---

## Résumé des phases

| Phase | Nom | Objectif | Priorité | Branches |
|-------|-----|----------|----------|----------|
| **1** | Typographie | Unifier sur Work Sans | HAUTE | `ui/typography-work-sans` |
| **2** | Boutons | Harmoniser accent/primary | HAUTE | `ui/button-harmonization` |
| **3** | White-Label Foundation | Couleurs dynamiques via DB | MOYENNE | `feat/white-label-branding` |
| **4** | Nettoyage CSS | Variables CSS, inline styles | BASSE | `refactor/css-cleanup` |
| **5** | Patterns modaux | Centraliser la logique | BASSE | `refactor/modal-patterns` |
| **6** | Documentation continue | Maintenir le design system | CONTINUE | Sur chaque branche |
| **7** | Interface Admin | Moderniser les réglages groupe | MOYENNE | `ui/admin-interface-redesign` |
| **8** | Barre supérieure | Harmoniser header app-wide | MOYENNE | `ui/top-bar-harmonization` |
| **9** | Liste des emails | Moderniser navigation mailings | MOYENNE | `ui/mailings-list-redesign` |
| **10** | Canvas Éditeur | Moderniser les interactions blocs | MOYENNE | `ui/editor-canvas-modernization` |
| **11** | Sidebars Éditeur | Moderniser les panneaux d'options | HAUTE | `ui/editor-sidebars-modernization` |

---

## Phase 1 : Typographie unifiée (Work Sans)

**Branche**: `ui/typography-work-sans`
**Priorité**: HAUTE
**Dette**: DEBT-001

### Contexte
Actuellement 3 polices différentes créent une rupture visuelle :
- Vue App : Montserrat (Google Fonts)
- Editor : Trebuchet MS (système)
- Website : Work Sans (marque)

### Objectif
Unifier sur **Work Sans** (déjà utilisée sur lepatron.email).

### Fichiers à modifier

#### Vue App (`packages/ui/`)
```
packages/ui/assets/global-styles/variables.scss
packages/ui/nuxt.config.js (Google Fonts import)
```

**Changements** :
```scss
// variables.scss
$body-font-family: 'Work Sans', sans-serif;
```

```javascript
// nuxt.config.js - Google Fonts
googleFonts: {
  families: {
    'Work+Sans': [300, 400, 500, 600, 700]
  }
}
```

#### Editor (`packages/editor/`)
```
packages/editor/src/css/style_variables.less
packages/editor/src/tmpl/main.tmpl.html (font import)
```

**Changements** :
```less
// style_variables.less
@font-family: 'Work Sans', sans-serif;
```

### Critères de validation
- [ ] Vue App affiche Work Sans
- [ ] Editor affiche Work Sans
- [ ] Aucune régression visuelle majeure
- [ ] Preview HTML mis à jour (statut "Cible" → "OK")

---

## Phase 2 : Harmonisation des boutons

**Branche**: `ui/button-harmonization`
**Priorité**: HAUTE
**Dette**: DEBT-R001 (partiellement résolu)

### Contexte
Certains boutons utilisent `color="primary"` pour les actions principales au lieu de `color="accent"`.

### Convention cible
| Type d'action | Props Vuetify |
|---------------|---------------|
| Action principale | `color="accent" elevation="0"` |
| Annulation | `text color="primary"` |
| Destructive | `color="error"` |

### Fichiers à auditer
```bash
# Rechercher les boutons mal configurés
grep -r 'v-btn.*color="primary"' packages/ui/
```

Fichiers probables :
```
packages/ui/components/**/*.vue
packages/ui/routes/**/*.vue
```

### Critères de validation
- [ ] Aucun bouton d'action principale n'utilise `color="primary"`
- [ ] Review visuelle des formulaires principaux
- [ ] Documentation mise à jour (`02-atoms.md`)

---

## Phase 3 : White-Label Foundation

**Branche**: `feat/white-label-branding`
**Priorité**: MOYENNE

### Contexte
Permettre aux clients/agences de personnaliser leur instance (couleurs, logo).

### Objectif
Injecter les couleurs de marque depuis la base de données via CSS variables.

### Architecture

#### 3.1 Schéma Mongoose (`Group`)
```javascript
// packages/server/group/group.schema.js
branding: {
  primaryColor: { type: String, default: '#093040' },
  secondaryColor: { type: String, default: '#265090' },
  accentColor: { type: String, default: '#00ACDC' },
  warningColor: { type: String, default: '#FFB400' },
  errorColor: { type: String, default: '#F04E23' },
  logo: { type: String }, // URL ou base64
  favicon: { type: String }
}
```

#### 3.2 API endpoint
```
GET /api/groups/:id/branding
```

#### 3.3 Injection CSS côté client
```javascript
// packages/ui/plugins/branding.js
export default async function ({ store }) {
  const branding = store.state.user.group?.branding;
  if (branding) {
    document.documentElement.style.setProperty('--v-primary-base', branding.primaryColor);
    document.documentElement.style.setProperty('--v-accent-base', branding.accentColor);
    // etc.
  }
}
```

#### 3.4 UI d'administration
```
packages/ui/components/group/branding-settings.vue
```

### Critères de validation
- [ ] Les couleurs sont personnalisables par groupe
- [ ] Le logo peut être uploadé
- [ ] L'Editor hérite des couleurs (CSS variables)
- [ ] Preview white-label fonctionnel

---

## Phase 4 : Nettoyage CSS

**Branche**: `refactor/css-cleanup`
**Priorité**: BASSE
**Dettes**: DEBT-003, DEBT-004

### Objectifs
1. Remplacer les couleurs hardcodées par CSS variables
2. Réduire les `!important`
3. Supprimer les inline styles non-dynamiques

### Audit à faire
```bash
# Couleurs hardcodées
grep -rE '#[0-9a-fA-F]{6}|rgb\(' packages/ui/ --include="*.vue" --include="*.scss"

# !important
grep -r '!important' packages/ui/ --include="*.vue" --include="*.scss"
```

### Fichiers Editor à vérifier
```
packages/editor/src/css/badesender-image-gallery.less:798
# Remplacer @link-color par var(--v-error-base)
```

### Critères de validation
- [ ] Aucune couleur de marque hardcodée
- [ ] `!important` réduits de 50%+
- [ ] Debt registry mis à jour

---

## Phase 5 : Patterns modaux centralisés

**Branche**: `refactor/modal-patterns`
**Priorité**: BASSE
**Dette**: DEBT-005

### Contexte
Plusieurs composants modal avec patterns légèrement différents :
- `modal-confirm.vue`
- `modal-confirm-form.vue`
- `mailings/modal-duplicate.vue`
- `mailings/modal-rename.vue`
- etc.

### Objectif
Créer un composable Vue réutilisable pour la logique modale.

### Architecture proposée
```javascript
// packages/ui/composables/useModal.js
export function useModal() {
  const isOpen = ref(false);
  const open = () => { isOpen.value = true; };
  const close = () => { isOpen.value = false; };
  return { isOpen, open, close };
}
```

### Critères de validation
- [ ] Composable créé et documenté
- [ ] Au moins 2 modals migrés vers le nouveau pattern
- [ ] Documentation mise à jour (`03-molecules.md`)

---

## Phase 6 : Documentation continue

**Sur chaque branche**

### Checklist avant merge
- [ ] Vérifier si des composants du design system sont affectés
- [ ] Mettre à jour la documentation correspondante
- [ ] Si nouveau pattern : l'ajouter à `06-patterns.md`
- [ ] Si dette résolue : mettre à jour `05-debt-registry.md`

### Fichiers de documentation
```
docs/design-system/01-tokens.md      # Tokens (couleurs, typo)
docs/design-system/02-atoms.md       # Composants de base
docs/design-system/03-molecules.md   # Composants composés
docs/design-system/05-debt-registry.md # Dettes techniques
docs/design-system/preview/*.html    # Previews visuels
```

---

## Phase 7 : Modernisation de l'interface Admin

**Branche**: `ui/admin-interface-redesign`
**Priorité**: MOYENNE
**Preview**: `docs/design-system/preview/admin-settings.html`

### Problèmes identifiés

| Problème | Impact |
|----------|--------|
| Navigation dupliquée (sidebar + tabs) | Confusion utilisateur |
| Sidebar sous-utilisée (1 lien + 3 actions) | Gaspillage d'espace |
| Actions "Ajouter" décontextualisées | UX non intuitive |
| 7-8 tabs horizontaux (overflow) | Difficile à scanner |
| Champs éparpillés sans structure | Manque de clarté |

### Solution : Navigation verticale unifiée

Remplacer tabs horizontaux + sidebar par une navigation verticale groupée (pattern Notion/Linear/Figma).

### Groupement des sections

| Groupe | Onglets | Icône |
|--------|---------|-------|
| **GÉNÉRAL** | Informations | `mdi-information` |
| **CONTENU** | Templates, Workspaces | `mdi-folder-multiple` |
| **UTILISATEURS** | Utilisateurs, Listes test | `mdi-account-group` |
| **INTÉGRATIONS** | ESP, Variables, Intégrations | `mdi-connection` |
| **AVANCÉ** | Fonctionnalités IA | `mdi-brain` |

### Fichiers à modifier

```
packages/ui/routes/groups/_groupId/index.vue
packages/ui/components/group/menu.vue
packages/ui/components/layout-left-menu.vue
```

### Critères de validation

- [ ] Navigation verticale implémentée
- [ ] Sections groupées logiquement
- [ ] Actions déplacées dans leurs onglets respectifs
- [ ] Contenu structuré en cards
- [ ] Preview validé par l'équipe

---

## Phase 8 : Harmonisation de la barre supérieure

**Branche**: `ui/top-bar-harmonization`
**Priorité**: MOYENNE
**Preview**: `docs/design-system/preview/top-bar.html`

### Problèmes identifiés

| Problème | Impact |
|----------|--------|
| Hauteurs incohérentes (40px / 48px / 64px) | Rupture visuelle entre contextes |
| Bibliothèques d'icônes différentes (MDI vs FA) | Incohérence, double charge |
| Actions variables selon contexte | Navigation imprévisible |
| Structure différente par page | Pas de pattern réutilisable |

### Solution : Header unifié avec slots contextuels

**Hauteur cible** : 48px (compromis entre 40px editor et 64px Vuetify)
**Structure** : 3 slots (Gauche, Centre, Droite) avec contenu contextuel

| Contexte | Slot Gauche | Slot Centre | Slot Droite |
|----------|-------------|-------------|-------------|
| **Dashboard/Mailings** | Logo LePatron | "Emails" | Aide, Réglages, Logout |
| **Admin/Réglages** | Logo LePatron | "Réglages : [Groupe]" | Aide, Logout |
| **Editor** | Tabs navigation | Nom du mailing | Actions, Sauvegarder |

### Fichiers à modifier

```
packages/ui/layouts/default.vue
packages/ui/routes/mailings/__partials/mailings-header.vue
packages/editor/src/css/badsender-topbar.less
packages/editor/src/css/style_variables.less
packages/editor/src/tmpl/main.tmpl.html
```

### Critères de validation

- [ ] Hauteur unifiée à 48px sur tous les contextes
- [ ] Icônes Material Design dans l'Editor
- [ ] Structure de slots implémentée
- [ ] Tokens CSS partagés
- [ ] Preview validé par l'équipe

---

## Phase 9 : Modernisation de la liste des emails

**Branche**: `ui/mailings-list-redesign`
**Priorité**: MOYENNE
**Preview**: `docs/design-system/preview/mailings-list.html`

### Problèmes identifiés

| Problème | Impact |
|----------|--------|
| Filtres cachés dans un accordéon | Discoverability faible |
| Bouton "NEW EMAIL" dans la sidebar | Déconnecté du contexte |
| Actions cachées (menu "⋮") | Clic supplémentaire nécessaire |
| 7 colonnes denses | Difficile à scanner |

### Solution : Filtres visibles et actions rapides

#### 9.1 Barre de filtres toujours visible
```
[+ NEW EMAIL]  🔍 Search...  │ Template [▼] │ Tags [▼] │ [✕ Clear]
```

#### 9.2 Quick actions au hover
```
│ Email Name  │ pierre │ v4 │ 27/03 │ 👁 📋 ⋯ │
```

#### 9.3 Bulk actions toolbar (quand sélection)
```
☑ 3 sélectionnés  │ [Tags] [Move] [Duplicate] [Delete] │ [✕]
```

### Fichiers à modifier

```
packages/ui/routes/mailings/index.vue
packages/ui/routes/mailings/__partials/mailings-filters.vue
packages/ui/routes/mailings/__partials/mailings-table.vue
packages/ui/routes/mailings/__partials/mailings-header.vue
```

### Critères de validation

- [ ] Bouton "NEW EMAIL" dans le header
- [ ] Filtres toujours visibles
- [ ] Quick actions au hover
- [ ] Bulk actions toolbar
- [ ] Preview validé par l'équipe

---

## Phase 10 : Modernisation du canvas éditeur

**Branche**: `ui/editor-canvas-modernization`
**Priorité**: MOYENNE
**Preview**: `docs/design-system/preview/editor-canvas.html`

### Analyse de l'existant

**Structure actuelle** (captures analysées) :
```
┌─────────────────────────────────────────────────────────────┐
│  [Header bloc: "Drop an image here"]                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │            Image placeholder 600x280                  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SUBHEAD                                              │  │
│  │  Lorem ipsum dolor                                    │  │
│  │  Description text...                                  │  │
│  │  [Be gorgeous]                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

État hover :     Bordure cyan 10px
État sélectionné : Bordure rouge (#cc0000) + boutons flottants
Actions :        [↕] gauche    [⬇][📋][🗑] droite (25x25px, cyan)
Drop zone :      Bordure pointillés + texte centré
```

### Problèmes identifiés

| Problème | Impact | Sévérité |
|----------|--------|----------|
| **Bordures épaisses (10px)** | Aspect daté, agressif visuellement | HAUTE |
| **Couleur rouge pour sélection** | Évoque l'erreur, pas l'action | HAUTE |
| **Boutons dispersés** | Float left/right, pas de toolbar groupée | MOYENNE |
| **Font Awesome icons** | Incohérence avec MDI dans Vue App | MOYENNE |
| **Pas de transitions CSS** | Changements d'état brusques | MOYENNE |
| **Drop zone basique** | Bordure pointillés statique | BASSE |

### Solution : Interactions modernes (pattern Notion/Figma)

#### 10.1 États visuels modernisés

| État | Actuel | Cible |
|------|--------|-------|
| **Hover** | Bordure cyan 10px | Ombre légère + bordure 2px accent |
| **Sélectionné** | Bordure rouge 10px dashed | Ombre accent + bordure 2px solid accent |
| **Éditable** | Pointillés internes | Fond légèrement teinté |
| **Drop zone** | Pointillés statiques | Animation pulse + fond semi-transparent |

**CSS Variables cibles** :
```less
@canvas-hover-shadow: 0 0 0 2px fade(@bs-accent-color, 30%);
@canvas-selected-shadow: 0 0 0 2px @bs-accent-color, 0 4px 12px fade(@bs-accent-color, 20%);
@canvas-transition: all 0.2s ease-out;
@canvas-drop-bg: fade(@bs-accent-color, 5%);
```

#### 10.2 Toolbar flottante groupée

**Actuel** : Boutons dispersés (float left / float right)
```
[↕]                                              [⬇] [📋] [🗑]
```

**Cible** : Toolbar centrée groupée
```
         ┌────────────────────────────────────┐
         │  [↑] [↓]  │  [⬇] [📋] [🗑]        │
         └────────────────────────────────────┘
```

**Structure HTML proposée** :
```html
<div class="block-toolbar">
  <div class="toolbar-group toolbar-move">
    <button class="toolbar-btn" title="Monter"><i class="mdi mdi-chevron-up"></i></button>
    <button class="toolbar-btn" title="Descendre"><i class="mdi mdi-chevron-down"></i></button>
  </div>
  <div class="toolbar-separator"></div>
  <div class="toolbar-group toolbar-actions">
    <button class="toolbar-btn" title="Télécharger"><i class="mdi mdi-download"></i></button>
    <button class="toolbar-btn" title="Dupliquer"><i class="mdi mdi-content-copy"></i></button>
    <button class="toolbar-btn toolbar-btn--danger" title="Supprimer"><i class="mdi mdi-delete"></i></button>
  </div>
</div>
```

**Styling cible** :
```less
.block-toolbar {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
}

.editable:hover .block-toolbar,
.editable.selected .block-toolbar {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: @primary-color;
  cursor: pointer;
  transition: background 0.15s;
}

.toolbar-btn:hover {
  background: fade(@bs-accent-color, 10%);
}

.toolbar-btn--danger:hover {
  background: fade(@error-color, 10%);
  color: @error-color;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 4px;
}
```

#### 10.3 Drop zone modernisée

**Actuel** :
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│  Drop here blocs coming from "Blocs"   │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Cible** :
```
┌─────────────────────────────────────────┐
│                                         │
│     ┌───────────────────────────┐       │
│     │  [+] Glissez un bloc ici  │       │
│     └───────────────────────────┘       │
│                                         │
└─────────────────────────────────────────┘
Animation: pulse subtil sur le fond
```

**CSS** :
```less
.drop-zone {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    fade(@bs-accent-color, 3%) 25%,
    transparent 25%,
    transparent 50%,
    fade(@bs-accent-color, 3%) 50%,
    fade(@bs-accent-color, 3%) 75%,
    transparent 75%
  );
  background-size: 20px 20px;
  border: 2px dashed fade(@bs-accent-color, 40%);
  border-radius: 8px;
  transition: all 0.3s;
}

.drop-zone:hover,
.drop-zone.drag-over {
  background-color: fade(@bs-accent-color, 8%);
  border-color: @bs-accent-color;
}

.drop-zone-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border-radius: 6px;
  color: @gray-600;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

#### 10.4 Icônes Material Design

| Action | Font Awesome (actuel) | Material Design (cible) |
|--------|----------------------|------------------------|
| Move | `fa-sort` | `mdi-drag` |
| Move up | `fa-sort-asc` | `mdi-chevron-up` |
| Move down | `fa-sort-desc` | `mdi-chevron-down` |
| Download | `fa-download` | `mdi-download` |
| Duplicate | `fa-files-o` | `mdi-content-copy` |
| Delete | `fa-trash-o` | `mdi-delete` |

### Fichiers à modifier

```
packages/editor/src/css/style_variables.less     # Nouvelles variables
packages/editor/src/css/style_mosaico.less       # Mixins sélection/hover
packages/editor/src/css/style_mosaico_content.less # Toolbar styling
packages/editor/src/tmpl/block-wysiwyg.tmpl.html # Structure toolbar
packages/editor/src/tmpl/main.tmpl.html          # Import MDI fonts
```

### Critères de validation

- [ ] États hover/selected avec ombres subtiles (pas de bordures épaisses)
- [ ] Toolbar flottante groupée et centrée
- [ ] Icônes Material Design
- [ ] Transitions CSS fluides (0.2s)
- [ ] Drop zone avec animation
- [ ] Aucune régression fonctionnelle
- [ ] Preview validé par l'équipe

---

## Phase 11 : Modernisation des Sidebars de l'Éditeur

**Branche**: `ui/editor-sidebars-modernization`
**Priorité**: HAUTE
**Preview**: `docs/design-system/preview/editor-sidebars.html`

### Contexte

La sidebar de l'éditeur email (400px de large) est l'interface principale d'interaction utilisateur. Elle contient 3 onglets :
- **Blocs** : Galerie de blocs à glisser-déposer
- **Contenu** : Options de contenu des blocs sélectionnés
- **Style** : Options de style (marges, couleurs, polices)

C'est une partie critique de l'application qui nécessite une attention particulière.

### Problèmes identifiés (captures analysées)

#### 11.1 Layout et Espacement

| Problème | Impact | Sévérité |
|----------|--------|----------|
| **Densité excessive** | Options serrées, difficile à scanner | HAUTE |
| **Pas de sections collapsibles** | Tout visible, scroll important | HAUTE |
| **Espacement incohérent** | Padding variable entre éléments | MOYENNE |
| **Labels tronqués** | 45% trop étroit pour certains labels | MOYENNE |

#### 11.2 Composants de formulaire

| Problème | Impact | Sévérité |
|----------|--------|----------|
| **Toggles petits** | 34x14px, difficile à cliquer sur mobile | HAUTE |
| **Headers de section basiques** | Simple texte gras, pas de hiérarchie | MOYENNE |
| **Inputs génériques** | Pas de focus states distinctifs | MOYENNE |
| **Color pickers inline** | Affichage basique sans preview | BASSE |

#### 11.3 Galerie de blocs

| Problème | Impact | Sévérité |
|----------|--------|----------|
| **Cards petites** | 33% width = ~120px, preview illisible | HAUTE |
| **Hover minimal** | Scale 1.05 uniquement | MOYENNE |
| **Badges de nom** | Fond primary foncé, peu lisible | MOYENNE |
| **Pas de catégories** | Tous les blocs mélangés | BASSE |

#### 11.4 CSS/Code

| Problème | Impact | Sévérité |
|----------|--------|----------|
| **Couleurs hardcodées** | ~10 instances (#ccc, black, etc.) | MOYENNE |
| **Pas de transitions** | Changements d'état brusques | MOYENNE |
| **Mixed approach** | LESS + Vuetify CSS vars | BASSE |

### Solution : Interface moderne et aérée

#### 11.5 Sections collapsibles (Accordéon)

**Actuel** : Toutes les sections visibles
```
Section
  ├─ Option 1
  ├─ Option 2
  └─ Option 3
Text
  ├─ Margin
  ├─ Align
  └─ Font-size
```

**Cible** : Accordéon (toutes sections ouvertes par défaut, collapsibles manuellement)
```
┌─────────────────────────────────┐
│ ▼ Section                    ─  │ (ouvert par défaut, click pour fermer)
├─────────────────────────────────┤
│   Option 1    [value]           │
│   Option 2    [value]           │
│   Option 3    [value]           │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ ▼ Text                       ─  │ (ouvert par défaut)
├─────────────────────────────────┤
│   Margin     [value]            │
│   ...                           │
└─────────────────────────────────┘
```

> **Note**: Pas de mémorisation localStorage. Toutes les sections sont ouvertes à chaque chargement.

**CSS proposé** :
```less
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--v-primary-lighten5);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--v-primary-lighten4);
  }

  .section-icon {
    transition: transform 0.2s;
  }

  &.collapsed .section-icon {
    transform: rotate(-90deg);
  }
}

.section-content {
  padding: 12px 16px;
  overflow: hidden;
  transition: max-height 0.3s ease-out;

  &.collapsed {
    max-height: 0;
    padding: 0 16px;
  }
}
```

#### 11.6 Toggles modernisés

**Actuel** : 34x14px, style iOS ancien
**Cible** : 44x24px, plus accessible

```less
// Nouvelles dimensions toggles
@toggle-width: 44px;
@toggle-height: 24px;
@toggle-knob-size: 20px;
@toggle-transition: 0.2s ease-out;

.toggle-switch {
  position: relative;
  width: @toggle-width;
  height: @toggle-height;

  input[type="checkbox"] {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-track {
      background: var(--v-accent-base);

      .toggle-knob {
        transform: translateX(20px);
      }
    }

    &:focus + .toggle-track {
      box-shadow: 0 0 0 3px fade(@accent-color, 30%);
    }
  }

  .toggle-track {
    position: absolute;
    inset: 0;
    background: @gray-300;
    border-radius: @toggle-height / 2;
    transition: background @toggle-transition;
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: @toggle-knob-size;
    height: @toggle-knob-size;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: transform @toggle-transition;
  }
}
```

#### 11.7 Inputs améliorés

**Actuel** : Border bottom uniquement, focus basique
**Cible** : Border complète, focus states clairs, labels flottants optionnels

```less
.prop-input {
  position: relative;

  input, select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid @gray-300;
    border-radius: 6px;
    background: white;
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: @gray-400;
    }

    &:focus {
      border-color: var(--v-accent-base);
      box-shadow: 0 0 0 3px fade(@accent-color, 15%);
      outline: none;
    }

    &::placeholder {
      color: @gray-400;
    }
  }

  // Floating label variant
  &.has-label {
    label {
      position: absolute;
      top: -8px;
      left: 10px;
      padding: 0 4px;
      background: white;
      font-size: 12px;
      color: @gray-600;
    }
  }
}
```

#### 11.8 Galerie de blocs redessinée

**Actuel** : Grid 3 colonnes, cards 33% (~120px)
**Cible** : Grid 2 colonnes, cards ~170px avec preview lisible

> **Choix utilisateur** : 2 colonnes pour une meilleure visibilité des previews et une meilleure UX drag & drop.

```
┌─────────────────────────────────────┐
│ 🔍 Rechercher un bloc...            │
├─────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐         │
│ │           │ │           │         │
│ │  Preview  │ │  Preview  │         │
│ │           │ │           │         │
│ ├───────────┤ ├───────────┤         │
│ │ cover_v2  │ │ columns   │         │
│ └───────────┘ └───────────┘         │
│ ┌───────────┐ ┌───────────┐         │
│ │           │ │           │         │
│ │  Preview  │ │  Preview  │         │
...
```

```less
// Galerie 2 colonnes
.block-gallery {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px;
}

.block-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: grab;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.98);
  }

  .block-preview {
    aspect-ratio: 4/3;
    background: @gray-100;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }

  .block-name {
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
    color: @gray-800;
    border-top: 1px solid @gray-200;
    background: white;

    // Truncate long names
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

#### 11.9 Onglets redessinés

**Actuel** : Background color sur tab active
**Cible** : Underline indicator moderne

```less
.sidebar-tabs {
  display: flex;
  background: var(--v-primary-base);
  padding: 0 16px;

  .tab-item {
    position: relative;
    padding: 12px 16px;
    color: rgba(255,255,255,0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: white;
    }

    &.active {
      color: white;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--v-accent-base);
        border-radius: 3px 3px 0 0;
      }
    }

    .tab-icon {
      margin-right: 8px;
    }
  }
}
```

#### 11.10 Color picker amélioré

**Actuel** : Inline avec hex et X
**Cible** : Preview coloré + popover picker

```
Actuel:  [●] #FFFFFF  ✕  ------
Cible:   ┌──────────────────────┐
         │ ■■■ #FFFFFF      [▼] │
         └──────────────────────┘

         Click → Popover avec color wheel
```

### Fichiers à modifier

#### CSS/LESS principaux
```
packages/editor/src/css/style_mosaico_tools.less    # Forms, sections, layout
packages/editor/src/css/badsender-main-toolbox.less # Block gallery
packages/editor/src/css/style_variables.less        # Nouvelles variables
packages/editor/src/css/style_elements_mixins.less  # Input/toggle mixins
```

#### Templates
```
packages/editor/src/tmpl/toolbox.tmpl.html          # Structure sidebar
packages/editor/src/tmpl/block-wysiwyg.tmpl.html    # Block structure
```

#### JavaScript (si accordéon)
```
packages/editor/src/js/ext/badsender-extensions.js  # Section collapse logic
```

### Variables CSS à ajouter

```less
// Sidebar dimensions
@sidebar-width: 400px;
@sidebar-padding: 16px;
@sidebar-section-gap: 12px;

// Section styling
@section-header-bg: fade(@primary-color, 5%);
@section-header-bg-hover: fade(@primary-color, 10%);
@section-border-radius: 8px;
@section-transition: 0.2s ease-out;

// Toggle dimensions (larger)
@toggle-width: 44px;
@toggle-height: 24px;
@toggle-knob-size: 20px;

// Input styling
@input-padding: 10px 12px;
@input-border-radius: 6px;
@input-border-color: @gray-300;
@input-border-color-hover: @gray-400;
@input-focus-shadow: 0 0 0 3px fade(@accent-color, 15%);

// Block gallery
@gallery-columns: 2;
@gallery-gap: 12px;
@block-card-radius: 8px;
@block-card-shadow: 0 1px 3px rgba(0,0,0,0.1);
@block-card-shadow-hover: 0 4px 12px rgba(0,0,0,0.15);

// Transitions
@transition-fast: 0.15s ease-out;
@transition-normal: 0.2s ease-out;
@transition-slow: 0.3s ease-out;
```

### Critères de validation

#### Fonctionnel
- [ ] Sections collapsibles avec mémorisation d'état
- [ ] Toggles cliquables sur mobile (44x24px minimum)
- [ ] Focus states clairs sur tous les inputs
- [ ] Galerie 2 colonnes avec drag & drop fonctionnel
- [ ] Onglets avec indicateur underline

#### Visuel
- [ ] Espacement cohérent (16px base)
- [ ] Transitions fluides (0.2s)
- [ ] Hiérarchie visuelle claire (headers de section)
- [ ] Aucune couleur hardcodée

#### Performance
- [ ] Animations CSS (pas JS)
- [ ] Pas de reflow sur collapse/expand

#### Accessibilité
- [ ] Contraste suffisant (WCAG AA)
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Touch targets >= 44px

---

## Dépendances entre phases

```
Phase 1 (Typo) ──────────────────────────────────────────►
                  │
Phase 2 (Boutons) ──────────────────────────────────────►
                        │
                        ▼
Phase 3 (White-Label) ─────────────────────────────────►
                              │
Phase 4 (CSS) ────────────────┴────────────────────────►
                                    │
Phase 5 (Modals) ───────────────────┴──────────────────►
                                          │
Phase 7 (Admin UI) ───────────────────────┴────────────►
                                                │
Phase 8 (Top Bar) ──────────────────────────────┴──────►
                                                      │
Phase 9 (Mailings) ───────────────────────────────────►
                                                        │
Phase 10 (Canvas) ────────────────────────────────────►
                                                          │
Phase 11 (Sidebars) ─────────────────────────────────►
```

- **Phases 1 et 2** : Indépendantes, peuvent être faites en parallèle
- **Phase 3** : Bénéficie des phases 1-2 (interface cohérente)
- **Phases 4 et 5** : Peuvent être faites quand opportun (refactoring progressif)
- **Phase 7** : Peut commencer après Phase 2 (boutons harmonisés), bénéficie de Phase 5 (modals)
- **Phase 8** : Indépendante techniquement, bénéficie de Phase 1 (typo) pour cohérence visuelle
- **Phase 9** : Peut commencer après Phase 2 (boutons), bénéficie de Phase 8 (top bar cohérente)
- **Phase 10** : Indépendante, mais bénéficie de Phase 8 (icônes MDI dans editor)
- **Phase 11** : Bénéficie de Phase 1 (typo), Phase 8 (icônes MDI), Phase 10 (cohérence canvas)

---

## Métriques de succès

| Métrique | Avant | Cible |
|----------|-------|-------|
| Polices différentes | 3 | 1 |
| Boutons `color="primary"` (actions) | ~20? | 0 |
| Couleurs hardcodées | ~30? | <5 |
| `!important` | ~50? | <25 |
| Clients white-label actifs | 0 | ≥1 |
| Hauteurs de header différentes | 3 | 1 |
| Bibliothèques d'icônes | 2 | 1 |
| Filtres cachés par défaut | 1 (mailings) | 0 |
| Épaisseur bordures canvas (px) | 10 | 2 |
| Transitions CSS dans editor | 0 | 100% |
| Taille toggles sidebar (px) | 34x14 | 44x24 |
| Colonnes galerie blocs | 3 | 2 |
| Sections collapsibles | 0 | 100% |

---

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Régression visuelle (typo) | Tests visuels, review screenshots |
| Couleurs illisibles (white-label) | Validation de contraste WCAG |
| Performance (injection CSS) | Cache des branding settings |
| Breaking changes (modals) | Migration progressive, pas de big bang |

---

*Dernière mise à jour : Février 2026*
