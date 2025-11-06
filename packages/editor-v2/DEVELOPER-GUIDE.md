# Guide Développeur - POC Éditeur v2 LePatron.email

> **Version** : 0.1.0 (POC Phase 4 complétée)
> **Date** : Novembre 2025
> **Branche** : `claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU`

---

## 📖 Table des Matières

1. [Introduction](#introduction)
2. [Installation & Démarrage](#installation--démarrage)
3. [Architecture & Concepts](#architecture--concepts)
4. [API Reference](#api-reference)
5. [Créer des Composants](#créer-des-composants)
6. [Design System](#design-system)
7. [Format Email JSON](#format-email-json)
8. [Tests & Validation](#tests--validation)
9. [Performance](#performance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Introduction

### Qu'est-ce que c'est ?

L'Éditeur v2 est un POC (Proof of Concept) d'un éditeur d'emails moderne basé sur :
- **Maizzle Framework 5.x** pour le templating email
- **Vue.js 3** pour l'interface éditeur (Phase 5, pas encore implémenté)
- **Design System** avec tokens pour cohérence visuelle
- **API REST** pour le rendu des emails

### Pour qui ?

**Développeurs de templates email** qui :
- Maîtrisent HTML/CSS pour emails
- Connaissent Maizzle (optionnel mais recommandé)
- Veulent créer des composants réutilisables
- Ont besoin d'un système de rendu performant

### Ce qui fonctionne actuellement (Phase 4)

✅ **Backend API** :
- Rendu d'emails depuis JSON
- Support du Design System
- Cache pour performance
- 3 composants CORE (button, heading, container)

❌ **Pas encore implémenté** :
- Interface éditeur Vue.js (Phase 5)
- Validation WCAG/Accessibilité (Phase 6)
- Gestion des emails (CRUD)

---

## 🚀 Installation & Démarrage

### Prérequis

- **Node.js** : >= 18.0.0
- **Yarn** : >= 1.22.0 (ou npm)
- **Git**

### Installation

```bash
# Cloner le repository
git clone https://github.com/Badsender-com/LePatron.email.git
cd LePatron.email

# Switcher sur la branche POC
git checkout claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU

# Aller dans le package editor-v2
cd packages/editor-v2

# Installer les dépendances
yarn install
```

### Démarrage

```bash
# Terminal 1 : Démarrer le serveur backend
yarn dev:server
# ✅ Editor V2 API running on http://localhost:3200

# Terminal 2 (optionnel) : Démarrer le frontend (si Phase 5 implémentée)
yarn dev:client
# ✅ Frontend running on http://localhost:3100
```

### Vérification

```bash
# Test de santé
curl http://localhost:3200/health

# Réponse attendue :
{
  "status": "ok",
  "service": "editor-v2-api",
  "timestamp": "2025-11-06T..."
}
```

---

## 🏗️ Architecture & Concepts

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Frontend)                        │
│                    Vue.js 3 + Vite                          │
│                    Port 3100                                │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTP REST API
               │ Proxy /api → http://localhost:3200
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                              │
│                    Express.js + Node.js                     │
│                    Port 3200                                │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                    │
│  • GET  /v2/components          Liste composants           │
│  • GET  /v2/components/:name    Détails composant          │
│  • GET  /v2/design-systems      Liste DS                   │
│  • GET  /v2/design-systems/:id  Charger DS                 │
│  • POST /v2/render/preview      Rendu rapide (pas opti)    │
│  • POST /v2/render/export       Rendu optimisé (prod)      │
│  • POST /v2/render/component    Rendu composant seul       │
│  • GET  /v2/render/status       Stats cache                │
│  • DELETE /v2/render/cache      Vider cache                │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│              MAIZZLE FRAMEWORK 5.x                          │
│              Transformation HTML email                      │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│            COMPOSANTS MAIZZLE                               │
│            components/core/                                 │
│            • button/button.maizzle.html                     │
│            • heading/heading.maizzle.html                   │
│            • container/container.maizzle.html               │
└─────────────────────────────────────────────────────────────┘
```

### Concepts Clés

#### 1. **Email JSON Format**

Format de données unifié pour représenter un email :

```json
{
  "metadata": {
    "title": "Titre de l'email",
    "subject": "Sujet email",
    "preheader": "Texte preheader",
    "designSystemId": "demo"
  },
  "blocks": [
    {
      "id": "block-1",
      "component": "heading",
      "props": {
        "text": "Hello World",
        "level": "h1",
        "textColor": "#007bff"
      }
    }
  ]
}
```

#### 2. **Design System**

Système de tokens pour cohérence visuelle :

```javascript
// design-systems/demo/design-system.config.js
export default {
  id: 'demo',
  name: 'Demo Design System',
  tokens: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d'
    },
    spacing: {
      sm: '8px',
      md: '16px',
      lg: '24px'
    }
  }
}
```

Les composants peuvent référencer ces tokens :

```json
{
  "props": {
    "textColor": "{{designSystem.tokens.colors.primary}}"
  }
}
```

#### 3. **Composant Maizzle**

Un composant = 2 fichiers :
- **`.maizzle.html`** : Template HTML email
- **`.schema.json`** : Configuration (props, validation, UI)

```html
<!-- button.maizzle.html -->
<table role="presentation" data-block-id="{{ blockId }}">
  <tr>
    <td align="{{ align }}">
      <a href="{{ url }}" style="color: {{ textColor }};">
        {{ text }}
      </a>
    </td>
  </tr>
</table>
```

```json
// button.schema.json
{
  "name": "button",
  "label": "Bouton",
  "configurableProperties": {
    "text": { "type": "string", "default": "Click me" },
    "url": { "type": "url", "default": "#" },
    "textColor": { "type": "color", "default": "#ffffff" }
  }
}
```

#### 4. **Modes de Rendu**

**Preview** : Rapide, pas d'optimisation
- `inlineCSS: false`
- `minify: false`
- Cible : 50-80ms (cached) / <200ms (cold)

**Export** : Optimisé, prêt pour envoi email
- `inlineCSS: true`
- `removeUnusedCSS: true`
- `minify: true`
- Plus lent mais HTML production-ready

#### 5. **Cache**

Le service de rendu utilise un cache en mémoire (Map) :
- **TTL** : 5 minutes
- **Clé** : Hash MD5 du JSON + mode
- **Invalidation** : Automatique après TTL ou manuelle via API

---

## 📡 API Reference

### Base URL

```
http://localhost:3200
```

### Endpoints

#### `GET /health`

**Description** : Check santé du serveur

**Réponse** :
```json
{
  "status": "ok",
  "service": "editor-v2-api",
  "timestamp": "2025-11-06T10:30:00.000Z"
}
```

---

#### `GET /v2/components`

**Description** : Liste tous les composants disponibles

**Réponse** :
```json
{
  "success": true,
  "count": 3,
  "components": [
    {
      "name": "button",
      "label": "Bouton",
      "category": "core",
      "icon": "🔘",
      "description": ""
    },
    {
      "name": "heading",
      "label": "Titre",
      "category": "core",
      "icon": "📝"
    },
    {
      "name": "container",
      "label": "Conteneur",
      "category": "core",
      "icon": "📦"
    }
  ]
}
```

---

#### `GET /v2/components/:name`

**Description** : Récupère les détails d'un composant (schéma + template)

**Paramètres** :
- `name` (path) : Nom du composant (ex: `button`)
- `category` (query, optionnel) : Catégorie (défaut: `core`)

**Exemple** :
```bash
curl http://localhost:3200/v2/components/button
```

**Réponse** :
```json
{
  "success": true,
  "component": {
    "name": "button",
    "category": "core",
    "schema": {
      "name": "button",
      "label": "Bouton",
      "configurableProperties": {
        "content": {
          "text": { "type": "string", "default": "Click me" }
        }
      }
    },
    "template": "<table role=\"presentation\">...</table>"
  }
}
```

---

#### `GET /v2/design-systems`

**Description** : Liste tous les Design Systems disponibles

**Réponse** :
```json
{
  "success": true,
  "count": 1,
  "designSystems": [
    {
      "id": "demo",
      "name": "Demo Design System",
      "version": "1.0.0"
    }
  ]
}
```

---

#### `GET /v2/design-systems/:id`

**Description** : Charge un Design System avec tokens résolus

**Paramètres** :
- `id` (path) : ID du Design System (ex: `demo`)

**Exemple** :
```bash
curl http://localhost:3200/v2/design-systems/demo
```

**Réponse** :
```json
{
  "success": true,
  "designSystem": {
    "id": "demo",
    "name": "Demo Design System",
    "version": "1.0.0",
    "tokens": {
      "colors": {
        "primary": "#007bff",
        "secondary": "#6c757d"
      },
      "spacing": {
        "sm": "8px",
        "md": "16px"
      }
    },
    "componentDefaults": {
      "button": {
        "backgroundColor": "#007bff",
        "textColor": "#ffffff"
      }
    }
  }
}
```

---

#### `POST /v2/render/preview`

**Description** : Rendu rapide d'un email (mode preview, avec cache)

**Body** :
```json
{
  "metadata": {
    "title": "Welcome Email",
    "subject": "Bienvenue !",
    "preheader": "Découvrez notre service",
    "designSystemId": "demo"
  },
  "blocks": [
    {
      "id": "block-heading-1",
      "component": "heading",
      "props": {
        "text": "Bienvenue !",
        "level": "h1",
        "textColor": "{{designSystem.tokens.colors.primary}}",
        "fontSize": "32px",
        "align": "center"
      }
    },
    {
      "id": "block-button-1",
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
```

**Réponse** :
```json
{
  "success": true,
  "html": "<!DOCTYPE html><html>...</html>",
  "cached": false,
  "renderTime": 111,
  "mode": "preview"
}
```

**Exemple cURL** :
```bash
curl -X POST http://localhost:3200/v2/render/preview \
  -H "Content-Type: application/json" \
  -d @test-data/example-email.json
```

---

#### `POST /v2/render/export`

**Description** : Rendu optimisé d'un email (mode export, production-ready)

**Body** : Identique à `/v2/render/preview`

**Réponse** :
```json
{
  "success": true,
  "html": "<!DOCTYPE html><html>...</html>",
  "renderTime": 196,
  "mode": "export",
  "optimizations": {
    "inlineCSS": true,
    "removeUnusedCSS": true,
    "minify": true
  }
}
```

**Différences avec preview** :
- CSS inline dans les éléments
- CSS inutilisé supprimé
- HTML minifié (pas d'espaces)
- Pas de cache (export = toujours frais)

---

#### `POST /v2/render/component`

**Description** : Rendu d'un seul composant (utile pour tests)

**Body** :
```json
{
  "component": "button",
  "props": {
    "text": "Test Button",
    "url": "https://example.com",
    "backgroundColor": "#007bff",
    "textColor": "#ffffff"
  },
  "mode": "preview"
}
```

**Réponse** :
```json
{
  "success": true,
  "html": "<table role=\"presentation\">...</table>",
  "component": "button",
  "mode": "preview"
}
```

---

#### `GET /v2/render/status`

**Description** : Statistiques du cache et du serveur

**Réponse** :
```json
{
  "success": true,
  "cache": {
    "total": 5,
    "valid": 3,
    "expired": 2,
    "templates": 3,
    "ttl": 300000
  },
  "uptime": 3600,
  "memory": {
    "rss": 50331648,
    "heapTotal": 16777216,
    "heapUsed": 10485760
  }
}
```

---

#### `DELETE /v2/render/cache`

**Description** : Vide le cache (utile en développement)

**Réponse** :
```json
{
  "success": true,
  "message": "Cache cleared",
  "cleared": 5
}
```

---

## 🎨 Créer des Composants

### Structure d'un Composant

```
components/core/my-component/
├── my-component.maizzle.html    # Template HTML
└── my-component.schema.json     # Configuration
```

### 1. Créer le Template HTML

**Fichier** : `components/core/my-component/my-component.maizzle.html`

```html
<table role="presentation" style="width: 100%;" data-block-id="{{ blockId }}">
  <tr>
    <td align="{{ align }}" style="padding: {{ padding }};">
      <p style="color: {{ textColor }}; font-size: {{ fontSize }};">
        {{ text }}
      </p>
    </td>
  </tr>
</table>
```

**Syntaxe des variables** :
- `{{ variableName }}` : Variable simple (échappée HTML)
- `{{{ htmlContent }}}` : Variable HTML (non échappée)
- `<if condition="level === 'h1'">...</if>` : Conditionnel

**Variables automatiques** :
- `{{ blockId }}` : ID unique du block

### 2. Créer le Schéma JSON

**Fichier** : `components/core/my-component/my-component.schema.json`

```json
{
  "name": "my-component",
  "label": "Mon Composant",
  "category": "core",
  "icon": "🎨",
  "description": "Description du composant",

  "configurableProperties": {
    "content": {
      "text": {
        "type": "string",
        "label": "Texte",
        "default": "Hello World",
        "required": true,
        "tab": "Contenu"
      }
    },

    "style": {
      "textColor": {
        "type": "color",
        "label": "Couleur du texte",
        "default": "{{designSystem.tokens.colors.textPrimary}}",
        "allowCustom": true,
        "tab": "Style"
      },
      "fontSize": {
        "type": "slider",
        "label": "Taille de police",
        "default": "16px",
        "min": 12,
        "max": 48,
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
          { "value": "left", "label": "Gauche" },
          { "value": "center", "label": "Centre" },
          { "value": "right", "label": "Droite" }
        ],
        "tab": "Disposition"
      },
      "padding": {
        "type": "text",
        "label": "Padding",
        "default": "16px",
        "tab": "Disposition"
      }
    }
  },

  "validation": {
    "rules": [
      {
        "field": "text",
        "validator": "maxLength",
        "params": { "max": 200 },
        "message": "Le texte ne doit pas dépasser 200 caractères"
      }
    ]
  }
}
```

### 3. Types de Props Disponibles

| Type | Description | Exemple |
|------|-------------|---------|
| `string` | Texte libre | `"Hello World"` |
| `url` | URL valide | `"https://example.com"` |
| `color` | Couleur hex/rgb | `"#007bff"` |
| `slider` | Nombre avec min/max | `16` (px) |
| `button-group` | Choix multiple | `"left"`, `"center"`, `"right"` |
| `select` | Liste déroulante | Valeur parmi options |
| `toggle` | Booléen | `true` / `false` |
| `html` | Contenu HTML | `"<p>Texte</p>"` |

### 4. Conditionnels dans les Templates

```html
<if condition="level === 'h1'">
  <h1 style="...">{{ text }}</h1>
</if>
<if condition="level === 'h2'">
  <h2 style="...">{{ text }}</h2>
</if>
```

**Opérateurs supportés** : `===`, `!==`, `>`, `<`, `>=`, `<=`, `&&`, `||`

### 5. Tester votre Composant

```bash
# 1. Redémarrer le serveur (pour charger le nouveau composant)
yarn dev:server

# 2. Vérifier qu'il apparaît dans la liste
curl http://localhost:3200/v2/components | jq '.components[] | select(.name=="my-component")'

# 3. Tester le rendu
curl -X POST http://localhost:3200/v2/render/component \
  -H "Content-Type: application/json" \
  -d '{
    "component": "my-component",
    "props": {
      "text": "Test",
      "textColor": "#007bff",
      "fontSize": "18px",
      "align": "center",
      "padding": "20px"
    }
  }' | jq '.html'
```

---

## 🎨 Design System

### Structure d'un Design System

```
design-systems/my-ds/
└── design-system.config.js
```

### Exemple Complet

```javascript
export default {
  id: 'my-ds',
  name: 'My Design System',
  version: '1.0.0',

  // Tokens de design
  tokens: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',

      textPrimary: '#333333',
      textSecondary: '#666666',

      backgroundPrimary: '#ffffff',
      backgroundSecondary: '#f8f9fa',

      border: '#dee2e6'
    },

    typography: {
      fontFamily: {
        primary: 'Arial, Helvetica, sans-serif',
        heading: 'Georgia, "Times New Roman", serif'
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '24px',
        xxl: '32px'
      },
      fontWeight: {
        normal: '400',
        bold: '700'
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.5',
        relaxed: '1.8'
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

  // Règles du Design System
  rules: {
    accessibility: {
      minContrast: 4.5, // WCAG AA
      description: 'Contraste minimum texte/fond'
    },
    ecoDesign: {
      maxEmailWeight: '102400', // 100KB
      description: 'Poids maximum pour éco-conception'
    },
    branding: {
      enforceColors: true,
      description: 'Forcer utilisation palette marque'
    }
  },

  // Valeurs par défaut des composants
  componentDefaults: {
    button: {
      backgroundColor: '{{tokens.colors.primary}}',
      textColor: '#ffffff',
      borderRadius: '{{tokens.borderRadius.sm}}',
      padding: '12px 24px'
    },
    heading: {
      textColor: '{{tokens.colors.textPrimary}}',
      fontWeight: '{{tokens.typography.fontWeight.bold}}',
      lineHeight: '{{tokens.typography.lineHeight.tight}}'
    },
    container: {
      backgroundColor: '{{tokens.colors.backgroundSecondary}}',
      padding: '{{tokens.spacing.md}}',
      borderRadius: '{{tokens.borderRadius.md}}'
    }
  }
}
```

### Utiliser les Tokens

**Dans les props d'un composant** :

```json
{
  "props": {
    "textColor": "{{designSystem.tokens.colors.primary}}"
  }
}
```

**Résolution automatique** : Le service résout automatiquement `{{designSystem.tokens.colors.primary}}` → `#007bff`

---

## 📋 Format Email JSON

### Structure Complète

```json
{
  "metadata": {
    "title": "Titre de l'email (meta title)",
    "subject": "Sujet de l'email",
    "preheader": "Texte du preheader (caché, visible dans inbox)",
    "designSystemId": "demo"
  },
  "blocks": [
    {
      "id": "block-unique-1",
      "component": "heading",
      "props": {
        "text": "Bienvenue !",
        "level": "h1",
        "textColor": "#007bff",
        "fontSize": "32px",
        "align": "center",
        "marginTop": "16px",
        "marginBottom": "16px"
      }
    },
    {
      "id": "block-unique-2",
      "component": "container",
      "props": {
        "backgroundColor": "#f8f9fa",
        "padding": "24px",
        "borderRadius": "8px",
        "content": "<p style=\"margin: 0;\">Contenu HTML</p>"
      }
    },
    {
      "id": "block-unique-3",
      "component": "button",
      "props": {
        "text": "Cliquez ici",
        "url": "https://example.com",
        "backgroundColor": "#007bff",
        "textColor": "#ffffff",
        "borderRadius": "4px",
        "padding": "12px 24px",
        "align": "center"
      }
    }
  ]
}
```

### Règles de Validation

- ✅ `metadata.designSystemId` doit exister
- ✅ `blocks[].id` doivent être uniques
- ✅ `blocks[].component` doit exister dans `components/core/`
- ✅ `blocks[].props` doivent respecter le schema du composant

---

## 🧪 Tests & Validation

### Tests Automatisés

Un script de test complet est fourni : `test-render.js`

```bash
# Lancer tous les tests
node test-render.js
```

**Tests exécutés** :
1. ✅ Liste des composants disponibles
2. ✅ Détails du composant Button
3. ✅ Rendu d'un composant individuel
4. ✅ Rendu email complet (mode preview) - Cold
5. ✅ Rendu email (test du cache) - Cached
6. ✅ Rendu email (mode export optimisé)
7. ✅ Status du cache
8. ✅ Vider le cache

**Fichiers générés** :
- `test-data/output-preview.html` - Version preview
- `test-data/output-export.html` - Version export optimisée

### Validation HTML

```bash
# Installer un validateur HTML
npm install -g html-validate

# Valider le HTML généré
html-validate test-data/output-preview.html
```

### Tests de Rendu Email

**Litmus** : Service payant pour tester sur clients emails
- Outlook 2016/2019/365
- Gmail (desktop/mobile)
- Apple Mail
- Thunderbird

**Email on Acid** : Alternative à Litmus

**MailHog** (local) : Serveur SMTP de test local
```bash
# Installer MailHog
brew install mailhog  # macOS
# ou télécharger depuis https://github.com/mailhog/MailHog

# Démarrer
mailhog

# Interface web : http://localhost:8025
```

---

## ⚡ Performance

### Objectifs de Performance

| Métrique | Cible | Réalisé |
|----------|-------|---------|
| Cold render (preview) | < 200ms | ✅ 111ms |
| Cached render (preview) | 50-80ms | ✅ 0-1ms |
| Export render | < 2s | ✅ 196ms |
| Cache TTL | 5 min | ✅ 5 min |

### Monitoring

```bash
# Vérifier les stats du cache
curl http://localhost:3200/v2/render/status | jq '.cache'
```

### Optimisation du Cache

**Stratégies** :
- Cache basé sur hash MD5 du JSON + mode
- TTL de 5 minutes (configurable)
- Cache en mémoire (Map)
- Invalidation automatique

**Vider le cache manuellement** :
```bash
curl -X DELETE http://localhost:3200/v2/render/cache
```

### Benchmarks

```bash
# Cold render (sans cache)
time curl -X POST http://localhost:3200/v2/render/preview \
  -H "Content-Type: application/json" \
  -d @test-data/example-email.json > /dev/null

# Cached render (avec cache)
time curl -X POST http://localhost:3200/v2/render/preview \
  -H "Content-Type: application/json" \
  -d @test-data/example-email.json > /dev/null
```

---

## 🐛 Troubleshooting

### Le serveur ne démarre pas

**Erreur** : `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]`

**Cause** : Maizzle 5.x est un package ESM

**Solution** : Vérifier que `package.json` contient `"type": "module"`

---

### Les conditionnels `<if>` ne fonctionnent pas

**Symptôme** : Les headings sont vides

**Cause** : Regex des conditionnels ne gère pas les quotes dans les conditions

**Solution** : Vérifiée dans la version actuelle (commit 707cbed)

---

### HTML échappé dans le rendu

**Symptôme** : `{&lt;p&gt;...&lt;/p&gt;}` au lieu de `<p>...</p>`

**Cause** : Mauvais ordre de traitement des `{{{ }}}` vs `{{ }}`

**Solution** : Vérifiée dans la version actuelle (commit cb4f722)

---

### Preheader dans le `<head>`

**Symptôme** : HTML invalide, `<div>` dans `<head>`

**Cause** : Template mal structuré

**Solution** : Vérifiée dans la version actuelle (commit cb4f722)

---

### Cache non invalidé

**Symptôme** : Changements non visibles

**Solution** :
```bash
# Vider le cache manuellement
curl -X DELETE http://localhost:3200/v2/render/cache

# OU redémarrer le serveur
```

---

### Performance dégradée

**Symptôme** : Rendu > 200ms

**Diagnostic** :
```bash
# Vérifier les stats
curl http://localhost:3200/v2/render/status | jq '.'

# Vérifier la mémoire
top -p $(pgrep -f "node server/index.js")
```

**Solutions** :
1. Vider le cache si trop volumineux
2. Redémarrer le serveur
3. Vérifier le nombre de templates chargés

---

## 📚 Ressources

### Documentation Externe

- [Maizzle Framework](https://maizzle.com/docs/)
- [Vue.js 3](https://vuejs.org/)
- [Pinia](https://pinia.vuejs.org/)
- [Express.js](https://expressjs.com/)

### Email Best Practices

- [Really Good Emails](https://reallygoodemails.com/)
- [Email on Acid Guide](https://www.emailonacid.com/blog/)
- [Campaign Monitor CSS Support](https://www.campaignmonitor.com/css/)
- [Can I Email?](https://www.caniemail.com/)

### Communauté

- **Issues GitHub** : [Badsender-com/LePatron.email](https://github.com/Badsender-com/LePatron.email/issues)
- **Branche POC** : `claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU`

---

## 🎯 Prochaines Étapes

### Phase 5 : Frontend Editor Vue.js (À venir)

- Component Library (sidebar gauche)
- Canvas avec drag & drop
- Config Panel (sidebar droite)
- Preview Panel (iframe)
- Pinia store pour état global

### Phase 6 : Validation (À venir)

- Validation WCAG (contraste, accessibilité)
- Validation poids email (éco-conception)
- Validation HTML email clients

### Phase 7 : Tests & Documentation (En cours)

- ✅ Guide développeur (ce document)
- ⏳ Tests unitaires
- ⏳ Tests d'intégration
- ⏳ POC demo complet

---

**Version** : 0.1.0
**Dernière mise à jour** : Novembre 2025
**Auteurs** : Équipe LePatron.email
