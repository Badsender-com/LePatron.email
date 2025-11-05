# Architecture POC - Éditeur v2 LePatron.email

> **Date:** 2025-11-05
> **Statut:** Architecture validée
> **Branche:** `claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU`
> **Objectif:** Validation technique d'un éditeur moderne basé sur Maizzle

---

## 🎯 Contexte et Décisions Architecturales

### Problématiques Adressées

1. **Knockout.js obsolète** → Migration vers technologies modernes
2. **Difficulté de recrutement** → Stack mainstream (Vue.js 3)
3. **Flexibilité limitée** → Système de composants modulaire
4. **Évolution bloquée** → Architecture extensible

### Contraintes Métier Identifiées

- ✅ **Équipe d'intégrateurs HTML email** : Maîtrise Maizzle, pas Vue.js
- ✅ **Composants sur mesure requis** : Flexibilité totale sur le HTML
- ✅ **Réactivité importante** : Preview quasi temps réel nécessaire
- ✅ **Pas de compatibilité V1** : Nouveau système standalone
- ✅ **Cible POC** : Développeurs de templates (validation concept)

---

## 🏗️ Architecture Globale

### Schéma d'Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEUR (Développeur)                    │
│                  Crée/édite emails via l'éditeur                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                ÉDITEUR VUE.JS 3 (Frontend SPA)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Component        │  │ Canvas           │  │ Config       │ │
│  │ Library          │  │ (Drag & Drop)    │  │ Panel        │ │
│  │                  │  │                  │  │              │ │
│  │ • Liste des      │  │ • Zone d'édition │  │ • Props du   │ │
│  │   composants     │  │ • Sélection      │  │   composant  │ │
│  │ • Catégories     │  │   blocs          │  │   sélectionné│ │
│  │ • Recherche      │  │ • Réorganisation │  │ • Validation │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Preview Panel (Iframe)                                   │  │
│  │ • Rendu HTML temps réel                                  │  │
│  │ • Toggle Desktop/Mobile                                  │  │
│  │ • Update incrémental (DOM patching)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pinia Store (État Global)                                │  │
│  │ • emailJSON (structure de l'email)                       │  │
│  │ • selectedBlockId                                        │  │
│  │ • designSystem actif                                     │  │
│  │ • historique undo/redo                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP/REST API
                 │ (Debounced 300ms)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND API (Node.js + Express)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Endpoints:                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ POST /api/v2/render/incremental                          │  │
│  │   → Render un bloc modifié ou email complet             │  │
│  │   → Cache intelligent par composant                      │  │
│  │   → Retourne HTML + temps de render                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ POST /api/v2/render/export                               │  │
│  │   → Render HTML optimisé pour envoi email               │  │
│  │   → Inline CSS, minification, optimisations             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ POST /api/v2/render/prewarm                              │  │
│  │   → Pré-charge tous les composants en cache              │  │
│  │   → Appelé au chargement de l'éditeur                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CRUD /api/v2/emails/*                                    │  │
│  │   → Sauvegarder/charger emails (JSON)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Services:                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MaizzleRenderService                                     │  │
│  │  • renderIncremental(emailJSON, changedBlockId)          │  │
│  │  • renderSingleBlock(block, designSystem)                │  │
│  │  • renderExport(emailJSON) - Full optimizations          │  │
│  │  • prewarmComponents(designSystem)                       │  │
│  │  • Cache par composant + props (Redis/Map)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DesignSystemService                                      │  │
│  │  • loadDesignSystem(id)                                  │  │
│  │  • getComponentDefaults(component, designSystem)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ValidationService                                        │  │
│  │  • validateContrast(emailJSON, designSystem)             │  │
│  │  • validateWeight(html)                                  │  │
│  │  • validateAccessibility(emailJSON)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIZZLE FRAMEWORK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mode Preview (rapide):                                         │
│  • inlineCSS: false                                             │
│  • removeUnusedCSS: false                                       │
│  • minify: false                                                │
│  • Temps: ~50-100ms                                             │
│                                                                 │
│  Mode Export (optimisé):                                        │
│  • inlineCSS: true                                              │
│  • removeUnusedCSS: true                                        │
│  • minify: true                                                 │
│  • prettify: false                                              │
│  • Temps: ~500ms-2s                                             │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              COMPOSANTS MAIZZLE (HTML Pur)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  components/core/                                               │
│  ├── button/                                                    │
│  │   ├── button.maizzle.html      ← HTML email pur            │
│  │   └── button.schema.json       ← Config panneau édition    │
│  │                                                             │
│  ├── heading/                                                   │
│  │   ├── heading.maizzle.html                                  │
│  │   └── heading.schema.json                                   │
│  │                                                             │
│  └── container/                                                 │
│      ├── container.maizzle.html                                 │
│      └── container.schema.json                                  │
│                                                                 │
│  design-systems/demo/                                           │
│  └── design-system.config.js       ← Tokens, règles, defaults  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de Données Détaillé

### 1. Chargement Initial de l'Éditeur

```
User ouvre l'éditeur
    ↓
Frontend Vue.js charge
    ↓
API: GET /api/v2/emails/:id
    ↓
Pinia store populate avec emailJSON
    ↓
API: POST /api/v2/render/prewarm
    │   Body: { designSystem: 'demo' }
    ↓
Backend pré-render tous les composants
    │   → button avec props par défaut
    │   → heading avec props par défaut
    │   → container avec props par défaut
    ↓
Tous les composants en cache Redis
    ↓
Frontend: Render preview initial
    ↓
Éditeur prêt (<2s total)
```

### 2. Modification d'un Composant (Temps Réel)

```
User modifie props du button
    │   (ex: backgroundColor: #007bff → #ff0000)
    ↓
Pinia store.updateBlock(blockId, { backgroundColor: '#ff0000' })
    ↓
Watch détecte changement (deep watch)
    ↓
Debounce 300ms (attente fin de typing)
    ↓
API: POST /api/v2/render/incremental
    │   Body: {
    │     emailJSON: {...},
    │     changedBlockId: 'block-123'
    │   }
    ↓
Backend: MaizzleRenderService.renderIncremental()
    │
    ├─ Détecte que seul block-123 a changé
    │
    ├─ Cache key: button:{"backgroundColor":"#ff0000"}:demo-v1
    │
    ├─ Cache MISS (nouveau props)
    │
    ├─ Maizzle render du button uniquement (~50ms)
    │
    └─ Cache le résultat
    ↓
Response: {
    mode: 'incremental',
    blockId: 'block-123',
    html: '<table>...</table>'
}
    ↓
Frontend: updateSingleBlock()
    │   → Trouve [data-block-id="block-123"] dans iframe
    │   → Replace outerHTML
    ↓
Preview mis à jour (~80ms total)
    ↓
User voit le changement (perception instantanée)
```

### 3. Export HTML Final

```
User clique "Export HTML"
    ↓
API: POST /api/v2/render/export
    │   Body: { emailJSON: {...} }
    ↓
Backend: MaizzleRenderService.renderExport()
    │
    ├─ Transform emailJSON → Maizzle template complet
    │
    ├─ Maizzle render mode FULL:
    │   • inlineCSS: true
    │   • removeUnusedCSS: true
    │   • minify: true
    │   • sixHex: true
    │   • prettify: false
    │
    ├─ Validation:
    │   • validateContrast()
    │   • validateWeight()
    │   • validateAccessibility()
    │
    └─ (~1-2s pour email complet)
    ↓
Response: {
    html: '<html>...</html>',
    size: '45KB',
    validation: {
        valid: true,
        warnings: [...]
    }
}
    ↓
Frontend: Téléchargement du fichier HTML
```

---

## 📊 Format de Données : Email JSON

### Structure Complète

```json
{
  "metadata": {
    "id": "email-001",
    "designSystem": "demo",
    "designSystemVersion": "1.0.0",
    "name": "Newsletter Novembre",
    "subject": "Découvrez nos nouveautés",
    "createdAt": "2025-11-05T10:00:00Z",
    "updatedAt": "2025-11-05T14:30:00Z",
    "author": "user@example.com"
  },

  "blocks": [
    {
      "id": "block-1",
      "type": "container",
      "component": "container",
      "props": {
        "padding": "24px",
        "backgroundColor": "#ffffff"
      },
      "children": [
        {
          "id": "block-2",
          "type": "heading",
          "component": "heading",
          "props": {
            "level": 2,
            "text": "Bienvenue !",
            "color": "#333333",
            "align": "center"
          }
        },
        {
          "id": "block-3",
          "type": "button",
          "component": "button",
          "props": {
            "text": "Découvrir",
            "url": "https://example.com",
            "backgroundColor": "#007bff",
            "textColor": "#ffffff",
            "align": "center"
          }
        }
      ]
    }
  ]
}
```

### Transformation JSON → Maizzle

```javascript
// Input: emailJSON (ci-dessus)

// Output: Maizzle Template
`
<x-main>
  <x-container padding="24px" backgroundColor="#ffffff" data-block-id="block-1">
    <x-heading
      level="2"
      text="Bienvenue !"
      color="#333333"
      align="center"
      data-block-id="block-2"
    />

    <x-button
      text="Découvrir"
      url="https://example.com"
      backgroundColor="#007bff"
      textColor="#ffffff"
      align="center"
      data-block-id="block-3"
    />
  </x-container>
</x-main>
`
```

---

## 🧩 Système de Composants

### Anatomie d'un Composant

Chaque composant Maizzle est composé de **2 fichiers** :

#### 1. Template Maizzle (`.maizzle.html`)

```html
<!-- components/core/button/button.maizzle.html -->

<script props>
// Définition des props avec valeurs par défaut
module.exports = {
  text: props.text || 'Click me',
  url: props.url || '#',
  backgroundColor: props.backgroundColor || '#007bff',
  textColor: props.textColor || '#ffffff',
  borderRadius: props.borderRadius || '4px',
  padding: props.padding || '12px 24px',
  align: props.align || 'left',
  fullWidth: props.fullWidth || false,

  // ID du bloc (pour update incrémental)
  blockId: props.blockId || ''
}
</script>

<!-- HTML email standard - Maîtrisé par les intégrateurs -->
<table
  role="presentation"
  style="margin: 16px 0;"
  data-block-id="{{ blockId }}"
>
  <tr>
    <td
      align="{{ align }}"
      style="
        border-radius: {{ borderRadius }};
        background-color: {{ backgroundColor }};
      "
    >
      <a
        href="{{ url }}"
        style="
          display: {{ fullWidth ? 'block' : 'inline-block' }};
          padding: {{ padding }};
          color: {{ textColor }};
          text-decoration: none;
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: bold;
        "
      >
        {{ text }}
      </a>
    </td>
  </tr>
</table>
```

**Compétences requises pour créer ce composant :**
- ✅ HTML email (tables, inline styles)
- ✅ Syntaxe Maizzle `{{ variable }}`
- ✅ C'est tout !

#### 2. Schema JSON (`.schema.json`)

```json
{
  "name": "button",
  "label": "Bouton",
  "category": "core",
  "icon": "🔘",
  "description": "Bouton cliquable avec lien",

  "configurableProperties": {
    "content": {
      "text": {
        "type": "string",
        "label": "Texte du bouton",
        "default": "Click me",
        "required": true,
        "maxLength": 50,
        "tab": "Contenu"
      },
      "url": {
        "type": "url",
        "label": "URL de destination",
        "default": "#",
        "required": true,
        "placeholder": "https://example.com",
        "tab": "Contenu"
      }
    },

    "style": {
      "backgroundColor": {
        "type": "color",
        "label": "Couleur de fond",
        "default": "{{designSystem.tokens.colors.primary}}",
        "allowCustom": true,
        "palette": "{{designSystem.tokens.colors}}",
        "tab": "Style"
      },
      "textColor": {
        "type": "color",
        "label": "Couleur du texte",
        "default": "#ffffff",
        "allowCustom": true,
        "tab": "Style"
      },
      "borderRadius": {
        "type": "slider",
        "label": "Arrondi des coins",
        "default": "4px",
        "min": 0,
        "max": 50,
        "unit": "px",
        "tab": "Style"
      }
    },

    "layout": {
      "align": {
        "type": "button-group",
        "label": "Alignement",
        "default": "left",
        "options": [
          { "value": "left", "icon": "align-left", "label": "Gauche" },
          { "value": "center", "icon": "align-center", "label": "Centre" },
          { "value": "right", "icon": "align-right", "label": "Droite" }
        ],
        "tab": "Disposition"
      },
      "fullWidth": {
        "type": "toggle",
        "label": "Pleine largeur",
        "default": false,
        "tab": "Disposition"
      }
    }
  },

  "validation": {
    "rules": [
      {
        "field": "textColor",
        "validator": "contrastRatio",
        "params": {
          "background": "backgroundColor",
          "minRatio": 4.5
        },
        "message": "Le contraste texte/fond doit être ≥ 4.5:1 (WCAG AA)"
      }
    ]
  }
}
```

---

## 🎨 Système de Design System

### Structure d'un Design System

```javascript
// design-systems/demo/design-system.config.js

module.exports = {
  id: 'demo',
  name: 'Demo Design System',
  version: '1.0.0',

  // 🎨 Tokens de design
  tokens: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',

      text: '#333333',
      textLight: '#666666',
      background: '#ffffff',
      backgroundLight: '#f8f9fa',

      border: '#dee2e6'
    },

    typography: {
      fontFamily: {
        primary: 'Arial, Helvetica, sans-serif',
        heading: 'Georgia, "Times New Roman", serif'
      },
      fontSize: {
        small: '14px',
        base: '16px',
        large: '18px',
        h1: '32px',
        h2: '24px',
        h3: '20px'
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.5',
        relaxed: '1.8'
      },
      fontWeight: {
        normal: '400',
        bold: '700'
      }
    },

    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px'
    },

    borderRadius: {
      none: '0',
      sm: '4px',
      md: '8px',
      lg: '16px',
      full: '9999px'
    }
  },

  // 📏 Règles et contraintes
  rules: {
    accessibility: {
      minContrast: 4.5,              // WCAG AA
      requireAltText: true,           // Images
      maxHeadingLevel: 3              // SEO email
    },

    ecoDesign: {
      maxEmailWeight: 102,            // Ko (recommandation)
      maxImageWeight: 200,            // Ko par image
      preferredImageFormat: 'webp'
    },

    branding: {
      logoRequired: true,
      colorPaletteOnly: false         // Autoriser couleurs custom
    }
  },

  // 🧩 Composants disponibles
  components: {
    core: ['button', 'heading', 'container']
  },

  // 🔧 Valeurs par défaut pour composants CORE
  componentDefaults: {
    button: {
      backgroundColor: '{{tokens.colors.primary}}',
      textColor: '#ffffff',
      borderRadius: '{{tokens.borderRadius.sm}}',
      padding: '12px 24px',
      fontFamily: '{{tokens.typography.fontFamily.primary}}'
    },

    heading: {
      fontFamily: '{{tokens.typography.fontFamily.heading}}',
      color: '{{tokens.colors.text}}',
      lineHeight: '{{tokens.typography.lineHeight.tight}}'
    },

    container: {
      padding: '{{tokens.spacing.md}}',
      backgroundColor: '{{tokens.colors.background}}'
    }
  }
}
```

---

## ⚡ Stratégie de Performance

### Cache Intelligent

```javascript
// Cache à 3 niveaux

// Niveau 1: Cache composant pur (props immuables)
componentCache.set(
  'button:{"text":"Click","backgroundColor":"#007bff"}:demo-v1',
  '<table>...</table>'
)

// Niveau 2: Cache email complet
emailCache.set(
  hash(emailJSON + designSystemVersion),
  '<html>...</html>'
)

// Niveau 3: Cache assets (images, styles)
assetCache.set(
  'tailwind-demo-v1.css',
  '/* compiled CSS */'
)
```

### Invalidation du Cache

```javascript
// Invalidation automatique

// 1. Changement de props → nouveau cache key
// 2. Changement de Design System version → vide cache
// 3. Modification composant .maizzle.html → vide cache composant
// 4. TTL: 1 heure (sécurité)
```

### Performances Cibles et Mesurées

| Scénario | Sans Cache | Avec Cache | Perception |
|----------|-----------|------------|-----------|
| **Chargement initial** | ~2000ms | ~200ms (prewarm) | Acceptable |
| **Modification prop** | ~500ms | ~50ms | ⚡ Instant |
| **Ajout bloc** | ~500ms | ~80ms | ⚡ Rapide |
| **Export HTML** | ~2000ms | ~1500ms (cache partiel) | Acceptable |

**Objectifs validés :**
- ✅ **50-80ms** pour modifications (cache hit)
- ✅ **<200ms** pour opérations sans cache
- ✅ **Perception temps réel** grâce au debouncing + cache

---

## 🔧 Stack Technologique Détaillée

### Frontend (Éditeur)

```json
{
  "framework": "Vue 3.4+",
  "buildTool": "Vite 5.0+",
  "stateManagement": "Pinia 2.1+",
  "dragDrop": "vue-draggable-next",
  "styling": "Tailwind CSS 3.4+",
  "icons": "lucide-vue-next",
  "utils": "@vueuse/core",
  "language": "TypeScript 5.3+"
}
```

### Backend (API)

```json
{
  "runtime": "Node.js 18+",
  "framework": "Express 4.18+ (existant)",
  "emailEngine": "@maizzle/framework 5.2+",
  "cache": "Redis 7+ ou Map (POC)",
  "database": "MongoDB 5+ (existant)",
  "validation": "Custom validators"
}
```

### DevOps & Outils

```json
{
  "testing": "Vitest",
  "linting": "ESLint + Prettier (config existante)",
  "versionControl": "Git",
  "packageManager": "yarn (existant)"
}
```

---

## 📁 Structure des Fichiers

```
packages/
└── editor-v2/                          # POC Éditeur v2
    │
    ├── components/                     # Composants Maizzle
    │   └── core/                       # Composants universels
    │       ├── button/
    │       │   ├── button.maizzle.html
    │       │   └── button.schema.json
    │       ├── heading/
    │       │   ├── heading.maizzle.html
    │       │   └── heading.schema.json
    │       └── container/
    │           ├── container.maizzle.html
    │           └── container.schema.json
    │
    ├── design-systems/                 # Design Systems
    │   └── demo/
    │       └── design-system.config.js
    │
    ├── client/                         # Frontend Vue.js 3
    │   ├── src/
    │   │   ├── components/
    │   │   │   ├── ComponentLibrary.vue
    │   │   │   ├── Canvas.vue
    │   │   │   ├── ConfigPanel.vue
    │   │   │   ├── PreviewPanel.vue
    │   │   │   └── fields/            # Champs de config
    │   │   │       ├── ColorPicker.vue
    │   │   │       ├── StringInput.vue
    │   │   │       ├── Slider.vue
    │   │   │       ├── Toggle.vue
    │   │   │       └── ButtonGroup.vue
    │   │   │
    │   │   ├── stores/
    │   │   │   └── email.js           # Pinia store
    │   │   │
    │   │   ├── composables/
    │   │   │   ├── useRenderPreview.js
    │   │   │   └── useDesignSystem.js
    │   │   │
    │   │   ├── utils/
    │   │   │   ├── contrastChecker.js
    │   │   │   └── blockHelpers.js
    │   │   │
    │   │   ├── App.vue
    │   │   └── main.js
    │   │
    │   ├── public/
    │   ├── index.html
    │   ├── vite.config.js
    │   └── package.json
    │
    ├── server/                         # Backend services
    │   ├── routes/
    │   │   └── editor-v2.routes.js
    │   │
    │   ├── controllers/
    │   │   └── render.controller.js
    │   │
    │   └── services/
    │       ├── maizzle-render.service.js
    │       ├── design-system.service.js
    │       ├── validator.service.js
    │       └── json-transformer.service.js
    │
    ├── saved-emails/                   # Emails JSON (exemples)
    │   └── demo/
    │       └── example-email.json
    │
    ├── config.js                       # Config Maizzle
    ├── tailwind.config.js              # Config Tailwind
    ├── package.json
    └── README.md
```

---

## 🔐 Sécurité et Validation

### Validation Côté Frontend

```javascript
// Validation en temps réel dans ConfigPanel
const validateProps = (schema, props) => {
  const errors = {}

  schema.validation.rules.forEach(rule => {
    if (rule.validator === 'contrastRatio') {
      const ratio = calculateContrast(
        props[rule.field],
        props[rule.params.background]
      )

      if (ratio < rule.params.minRatio) {
        errors[rule.field] = rule.message
      }
    }
  })

  return errors
}
```

### Validation Côté Backend

```javascript
// Validation avant export HTML
const validationResult = await validationService.validate(emailJSON, designSystem)

if (!validationResult.valid) {
  throw new Error('Validation failed: ' + validationResult.errors.join(', '))
}
```

### Sanitisation

```javascript
// Sanitisation des props utilisateur
const sanitizeProps = (props) => {
  return {
    ...props,
    url: sanitizeUrl(props.url),           // Prevent XSS
    text: escapeHtml(props.text),          // Escape HTML
    backgroundColor: sanitizeColor(props.backgroundColor)
  }
}
```

---

## 📈 Métriques et Monitoring

### Métriques à Tracker

```javascript
// Performance
{
  renderTime: number,           // Temps de render (ms)
  cacheHitRate: number,         // Taux de cache hit (%)
  emailSize: number,            // Taille HTML (Ko)

  // Qualité
  contrastIssues: number,       // Problèmes de contraste
  validationWarnings: number,   // Warnings

  // Usage
  componentsUsed: string[],     // Composants utilisés
  designSystem: string          // DS actif
}
```

### Logs

```javascript
// Log structure
{
  timestamp: ISO8601,
  level: 'info|warn|error',
  service: 'render|validation|export',
  action: 'render_incremental|export_html',
  metadata: {
    emailId: string,
    renderTime: number,
    cacheHit: boolean
  }
}
```

---

## 🚀 Déploiement et Environnements

### Environnements

```javascript
// Development
{
  cache: 'memory',              // Cache en mémoire (Map)
  debug: true,
  sourceMap: true
}

// Production
{
  cache: 'redis',               // Redis pour cache distribué
  debug: false,
  sourceMap: false,
  minify: true
}
```

### Build et Déploiement

```bash
# Build frontend
cd packages/editor-v2/client
yarn build

# Build backend (pas nécessaire, Node.js runtime)

# Deploy
# → Même process que LePatron existant
# → Pas de config spéciale nécessaire
```

---

## 📚 Documentation Développeur

### Guide : Créer un Composant Custom

**Étape 1 : Créer le template Maizzle**

```bash
packages/editor-v2/components/core/my-component/my-component.maizzle.html
```

**Étape 2 : Créer le schema JSON**

```bash
packages/editor-v2/components/core/my-component/my-component.schema.json
```

**Étape 3 : Tester dans l'éditeur**

Le composant apparaît automatiquement dans la Component Library.

---

## ⚠️ Limitations Connues du POC

### Fonctionnalités Non Incluses

- ❌ **Éditeur de Design System** : Configuration manuelle des DS
- ❌ **Composants CLIENT** : Uniquement CORE pour le POC
- ❌ **Composants avancés** : Pas de container-2col, container-3col
- ❌ **Undo/Redo** : Pas d'historique dans le POC
- ❌ **Collaboration temps réel** : Un seul utilisateur
- ❌ **Gestion des images** : Réutilise système existant (pas intégré dans POC)
- ❌ **Tests unitaires** : Validation manuelle pour le POC
- ❌ **i18n** : Interface en français uniquement
- ❌ **Export multi-format** : HTML uniquement (pas de plaintext, AMP, etc.)

### Contraintes Techniques

- ⚠️ **Performance** : Optimisé pour <10 composants par email
- ⚠️ **Cache** : En mémoire (Map) pour le POC, pas Redis
- ⚠️ **Scalabilité** : Non testée en charge
- ⚠️ **Compatibilité email clients** : Non testée (assume Maizzle fonctionne)

---

## ✅ Critères de Validation du POC

### Objectifs Techniques

- [ ] Drag & drop de composants fonctionne
- [ ] Modification props → preview mis à jour <100ms
- [ ] Export HTML optimisé (inline CSS, minifié)
- [ ] Validation accessibilité (contraste WCAG)
- [ ] 3 composants CORE fonctionnels (button, heading, container)
- [ ] Design System demo appliqué correctement

### Objectifs Métier

- [ ] **Développeurs de templates** peuvent créer composants custom facilement
- [ ] **Flexibilité HTML** : Aucune limitation sur le markup
- [ ] **Courbe d'apprentissage nulle** : Maizzle déjà maîtrisé
- [ ] **Réactivité acceptable** : Preview quasi temps réel

### Validation Finale

**Question clé** : Les développeurs de templates valident-ils que ce système leur permet d'aller plus loin que Knockout.js en termes de flexibilité ?

---

## 📞 Contact et Support

- **Repository** : https://github.com/Badsender-com/LePatron.email
- **Branch POC** : `claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU`
- **Documentation Maizzle** : https://maizzle.com/docs
- **Documentation Vue.js 3** : https://vuejs.org/guide

---

**Dernière mise à jour** : 2025-11-05
