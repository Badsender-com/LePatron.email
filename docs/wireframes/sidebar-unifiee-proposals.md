# Propositions Sidebar Unifiée - Style Linear/Notion

## Analyse des références

### Linear

- Sidebar unique ~240px
- Sections collapsibles (chevrons)
- Workspace switcher en haut
- Modules/vues dans la même sidebar
- Toggle manuel (Cmd+\)
- Pas d'auto-collapse

### Notion

- Sidebar unique ~240px
- Workspace switcher + user menu en haut
- Favoris / Private / Shared sections
- Pages imbriquées (tree)
- Toggle manuel + hover pour révéler si collapsed
- Settings dans popup depuis user menu

---

## Proposition A : Linear-Style Compact

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────────────┐                                               │
│  │ ☰  LePatron.email    │  ← Toggle collapse                            │
│  │     Clarins ▼        │  ← Workspace/Company switcher                 │
│  └──────────────────────┘                                               │
│  │                      │                                               │
│  │  🔍 Recherche...     │  ← Quick search (ouvre Cmd+K)                 │
│  │                      │                                               │
│  │  ─────────────────── │                                               │
│  │                      │                                               │
│  │  📧 EMAIL BUILDER    │  ← Section module (collapsible)               │
│  │  ├─ ▼ Workspaces     │                                               │
│  │  │  ├─ ▼ Clarins WS  │                                               │
│  │  │  │  ├─ Dossier 1  │         ┌─────────────────────────────────┐   │
│  │  │  │  └─ Dossier 2  │         │                                 │   │
│  │  │  ├─ ▶ Autre WS    │         │      CONTENU PRINCIPAL          │   │
│  │  │  └─ ▶ Test WS     │         │                                 │   │
│  │  └─ + Nouveau dossier│         │      (Table des emails,         │   │
│  │                      │         │       Dashboard CRM, etc.)      │   │
│  │  ─────────────────── │         │                                 │   │
│  │                      │         │                                 │   │
│  │  📊 CRM INTELLIGENCE │         │                                 │   │
│  │  ├─ Dashboard 1      │         │                                 │   │
│  │  ├─ Dashboard 2      │         │                                 │   │
│  │  └─ + Nouveau        │         │                                 │   │
│  │                      │         │                                 │   │
│  │  ─────────────────── │         │                                 │   │
│  │                      │         │                                 │   │
│  │  ⚙️ PARAMÈTRES       │         │                                 │   │
│  │  ├─ Général          │         │                                 │   │
│  │  ├─ Workspaces       │         │                                 │   │
│  │  ├─ Utilisateurs     │         │                                 │   │
│  │  ├─ Intégrations     │         │                                 │   │
│  │  └─ Email Builder    │         └─────────────────────────────────┘   │
│  │     ├─ Templates     │                                               │
│  │     ├─ Couleurs      │                                               │
│  │     └─ Profils       │                                               │
│  │                      │                                               │
│  │  ─────────────────── │                                               │
│  │                      │                                               │
│  │  ❓ Aide             │                                               │
│  │                      │                                               │
│  │  ─────────────────── │                                               │
│  │  👤 Jonathan L.      │  ← User menu (logout, profil)                 │
│  │     Se déconnecter   │                                               │
│  └──────────────────────┘                                               │
│        240px                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Comportement Collapsed (56px)

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌────┐                                                             │
│ │ ☰  │  ← Logo only, click to expand                               │
│ └────┘                                                             │
│ │    │                                                             │
│ │ 🔍 │  ← Search icon                                              │
│ │    │                                                             │
│ │────│                                                             │
│ │ 📧 │  ← Email Builder (hover = tooltip)                          │
│ │ 📊 │  ← CRM Intelligence                                         │
│ │ ⚙️ │  ← Paramètres                                               │
│ │────│                   ┌─────────────────────────────────────┐   │
│ │ ❓ │                   │                                     │   │
│ │────│                   │       CONTENU PRINCIPAL             │   │
│ │ 👤 │                   │                                     │   │
│ └────┘                   │                                     │   │
│  56px                    └─────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Proposition B : Notion-Style avec Favoris

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────────────┐                                               │
│  │ 🏢 Clarins        ▼  │  ← Company/Workspace switcher                 │
│  │ jonathan@email.com   │                                               │
│  └──────────────────────┘                                               │
│  │                      │                                               │
│  │  🔍 Rechercher...    │  ← Opens command palette                      │
│  │  ─────────────────── │                                               │
│  │                      │                                               │
│  │  ⭐ FAVORIS          │  ← Quick access (drag & drop)                 │
│  │  ├─ 📧 Newsletter    │                                               │
│  │  ├─ 📊 KPIs Mensuel  │                                               │
│  │  └─ + Ajouter        │                                               │
│  │                      │                                               │
│  │  ─────────────────── │         ┌─────────────────────────────────┐   │
│  │                      │         │                                 │   │
│  │  📧 EMAILS           │         │                                 │   │
│  │  ├─ 📁 Clarins WS    │         │      CONTENU PRINCIPAL          │   │
│  │  │  ├─ 📁 Campagnes  │         │                                 │   │
│  │  │  │  └─ 📄 Email 1 │         │                                 │   │
│  │  │  └─ 📁 Templates  │         │                                 │   │
│  │  ├─ 📁 Autre WS      │         │                                 │   │
│  │  └─ + Nouveau        │         │                                 │   │
│  │                      │         │                                 │   │
│  │  ─────────────────── │         │                                 │   │
│  │                      │         │                                 │   │
│  │  📊 ANALYTICS        │         │                                 │   │
│  │  ├─ Dashboard 1      │         │                                 │   │
│  │  └─ Dashboard 2      │         │                                 │   │
│  │                      │         │                                 │   │
│  │  ─────────────────── │         └─────────────────────────────────┘   │
│  │                      │                                               │
│  │  ⚙️ Paramètres       │  ← Opens settings panel/modal                │
│  │  ❓ Aide & Support   │                                               │
│  │                      │                                               │
│  │  ─────────────────── │                                               │
│  │  [◀ Réduire]    ⌘\   │  ← Toggle button with shortcut hint          │
│  └──────────────────────┘                                               │
│        260px                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Proposition C : Hybrid Minimaliste

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────────────┐                                               │
│  │ LP  LePatron     [◀] │  ← Logo + Toggle                              │
│  └──────────────────────┘                                               │
│  │                      │                                               │
│  │  ┌────────────────┐  │                                               │
│  │  │ 🔍 Recherche   │  │  ← Command palette trigger                    │
│  │  │    ⌘K         │  │                                               │
│  │  └────────────────┘  │                                               │
│  │                      │                                               │
│  │  MODULES             │  ← Section header (subtle)                    │
│  │  ┌────────────────┐  │                                               │
│  │  │ 📧 Emails      │● │  ← Active indicator (dot)                     │
│  │  └────────────────┘  │                                               │
│  │  ┌────────────────┐  │         ┌─────────────────────────────────┐   │
│  │  │ 📊 CRM         │  │         │                                 │   │
│  │  └────────────────┘  │         │                                 │   │
│  │                      │         │      CONTENU PRINCIPAL          │   │
│  │  ─────────────────── │         │                                 │   │
│  │                      │         │                                 │   │
│  │  NAVIGATION       ▼  │  ← Collapsible section                       │
│  │  ├─ ▼ Clarins WS     │         │                                 │   │
│  │  │  ├─ Dossier 1  ●  │  ← Current location                          │
│  │  │  └─ Dossier 2     │         │                                 │   │
│  │  ├─ ▶ Test WS        │         │                                 │   │
│  │  └─ ▶ Demo WS        │         │                                 │   │
│  │                      │         │                                 │   │
│  │                      │         │                                 │   │
│  │                      │         │                                 │   │
│  │                      │         │                                 │   │
│  │                      │         └─────────────────────────────────┘   │
│  │  ─────────────────── │                                               │
│  │  ⚙️ Paramètres       │                                               │
│  │  ❓ Aide             │                                               │
│  │  ─────────────────── │                                               │
│  │  👤 Jonathan      ▼  │  ← User dropdown                              │
│  └──────────────────────┘                                               │
│        220px                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Proposition D : Ultra-Linear (Ma Recommandation)

Cette proposition est la plus proche de Linear, avec une organisation très claire.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌──────────────────────┐                                               │
│  │ [LP] Clarins      ⌄  │  ← Workspace switcher (admins only)           │
│  └──────────────────────┘                                               │
│  │                      │                                               │
│  │  ┌────────────────┐  │                                               │
│  │  │ 🔍 Rechercher  │  │  ← Quick search                               │
│  │  └────────────────┘  │                                               │
│  │                      │                                               │
│  │  📧 Emails        >  │  ← Module (> = has submenu/content)           │
│  │  📊 CRM Intel     >  │                                               │
│  │                      │                                               │
│  │  ═══════════════════ │         ┌─────────────────────────────────┐   │
│  │                      │         │  Clarins WS > Dossier 1         │   │
│  │  ESPACES DE TRAVAIL  │         │  ─────────────────────────────  │   │
│  │  ▼ Clarins Workspace │         │                                 │   │
│  │    ├─ 📁 Dossier 1 ← │ ACTIF   │  [+ Nouveau]  [Filtres]         │   │
│  │    ├─ 📁 Dossier 2   │         │                                 │   │
│  │    └─ 📁 Archives    │         │  ┌─────────────────────────┐    │   │
│  │  ▶ Test Workspace    │         │  │ 📧 Campaign Été 2026   │    │   │
│  │  ▶ Demo Client       │         │  │    Modifié il y a 2h   │    │   │
│  │                      │         │  ├─────────────────────────┤    │   │
│  │  + Nouveau dossier   │         │  │ 📧 Newsletter Mars     │    │   │
│  │                      │         │  │    Modifié hier        │    │   │
│  │  ═══════════════════ │         │  ├─────────────────────────┤    │   │
│  │                      │         │  │ 📧 Promo Printemps     │    │   │
│  │  DASHBOARDS CRM      │         │  │    Modifié 03/04       │    │   │
│  │  ├─ 📊 Vue globale   │         │  └─────────────────────────┘    │   │
│  │  ├─ 📊 Performances  │         │                                 │   │
│  │  └─ + Nouveau        │         │                                 │   │
│  │                      │         └─────────────────────────────────┘   │
│  │  ═══════════════════ │                                               │
│  │                      │                                               │
│  │  ⚙️ Paramètres       │  ← Opens settings (slide-over or page)       │
│  │  ❓ Aide & Docs      │                                               │
│  │                      │                                               │
│  │  ───────────────────│                                               │
│  │  👤 Jonathan Loriaux │                                               │
│  │     Déconnexion      │                                               │
│  │                      │                                               │
│  │  [« Réduire]    ⌘\   │  ← Explicit toggle with shortcut             │
│  └──────────────────────┘                                               │
│        240px                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### État Collapsed de la Proposition D

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ┌────┐                                                               │
│ │ LP │  ← Logo compact                                               │
│ └────┘                                                               │
│ │    │                                                               │
│ │ 🔍 │  ← Hover: "Rechercher (⌘K)"                                   │
│ │    │                                                               │
│ │ 📧 │● ← Active module indicator                                    │
│ │ 📊 │                                                               │
│ │    │                                                               │
│ │────│                ┌──────────────────────────────────────────┐   │
│ │    │                │  Clarins WS > Dossier 1                  │   │
│ │ 📁 │  ← Hover shows │  ────────────────────────────────────    │   │
│ │ 📁 │    folder name │                                          │   │
│ │ 📁 │                │  [+ Nouveau]  [Filtres]                  │   │
│ │    │                │                                          │   │
│ │────│                │  Liste des emails...                     │   │
│ │ 📊 │                │                                          │   │
│ │ 📊 │                │                                          │   │
│ │    │                │                                          │   │
│ │────│                │                                          │   │
│ │ ⚙️ │                │                                          │   │
│ │ ❓ │                │                                          │   │
│ │────│                │                                          │   │
│ │ 👤 │                │                                          │   │
│ │    │                └──────────────────────────────────────────┘   │
│ │ »  │  ← Expand button                                              │
│ └────┘                                                               │
│  48px                                                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Comparaison des Propositions

| Critère              | A (Linear Compact) | B (Notion) | C (Hybrid) | D (Ultra-Linear) |
| -------------------- | ------------------ | ---------- | ---------- | ---------------- |
| Clarté hiérarchique  | ⭐⭐⭐⭐           | ⭐⭐⭐     | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐       |
| Espace écran         | ⭐⭐⭐             | ⭐⭐⭐     | ⭐⭐⭐⭐   | ⭐⭐⭐⭐         |
| Facilité navigation  | ⭐⭐⭐⭐           | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐⭐⭐       |
| Courbe apprentissage | ⭐⭐⭐⭐           | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐         |
| Modernité            | ⭐⭐⭐⭐           | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐⭐⭐       |
| Effort refactoring   | Moyen              | Élevé      | Faible     | Moyen            |

---

## Recommandation Finale

**Je recommande la Proposition D (Ultra-Linear)** pour les raisons suivantes :

1. **Organisation claire** : Modules en haut, contenu contextuel au milieu, utils en bas
2. **Toggle manuel explicite** : Bouton visible + raccourci clavier (⌘\)
3. **Pas de surprises** : Pas d'auto-collapse, comportement prévisible
4. **Scalable** : Facile d'ajouter de nouveaux modules ou sections
5. **Familier** : Pattern reconnu par les utilisateurs de Linear/Notion/Slack

### Points Clés de l'Implémentation

1. **Workspace Switcher** en haut (pour admins multi-companies)
2. **Quick Search** prominent (prépare l'ajout de Command Palette)
3. **Sections séparées** par des lignes subtiles (═══)
4. **Toggle explicite** en bas avec hint du raccourci clavier
5. **État persisté** en localStorage (expanded/collapsed + sections ouvertes)
6. **Responsive** : Sur mobile, drawer temporaire avec même structure
