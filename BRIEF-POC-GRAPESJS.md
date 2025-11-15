# Brief POC : Intégration GrapesJS dans LePatron

## 📋 Contexte

LePatron utilise actuellement **Mosaico/Knockout** comme éditeur d'emails. Nous souhaitons intégrer **GrapesJS** comme éditeur alternatif moderne pour offrir plus de flexibilité aux utilisateurs tout en conservant la compatibilité avec les templates existants.

### Problématiques Actuelles

1. **Éditeur Knockout vieillissant** : Technologie obsolète, difficile à maintenir
2. **Manque de flexibilité** : Création de blocs personnalisés complexe
3. **Pas de blocs partagés** : Chaque template est isolé, pas de bibliothèque commune
4. **Multi-marque complexe** : Code triplé pour gérer Badsender/SM/LePatron

### Opportunités avec GrapesJS

- ✅ Éditeur moderne et activement maintenu
- ✅ Système de composants/blocs flexible
- ✅ Bibliothèque de blocs partageable
- ✅ Templates personnalisables par client
- ✅ Meilleure UX pour les utilisateurs finaux

---

## 🎯 Objectifs du POC

### Objectif Principal

**Valider la faisabilité technique** de l'intégration GrapesJS dans LePatron en créant une **preuve de concept fonctionnelle** qui coexiste avec l'éditeur Mosaico/Knockout existant.

### Objectifs Spécifiques

1. **Coexistence des éditeurs**
   - [ ] GrapesJS et Mosaico/Knockout fonctionnent en parallèle
   - [ ] L'utilisateur peut choisir son éditeur au moment de créer un template
   - [ ] Les deux types de templates peuvent coexister dans la base de données
   - [ ] Pas de régression sur les fonctionnalités Mosaico existantes

2. **Blocs standards partagés**
   - [ ] Bibliothèque de blocs GrapesJS utilisables par tous
   - [ ] Minimum 6 blocs standards (text, title, image, button, divider, spacer)
   - [ ] Blocs stockés côté serveur et chargés dans l'éditeur
   - [ ] Interface d'administration pour gérer les blocs standards

3. **Templates personnalisés**
   - [ ] Création de templates GrapesJS avec blocs standards + blocs custom
   - [ ] Réplication du template `template-newsletter-badsender.html` en GrapesJS
   - [ ] Support multi-marque (Badsender/SM/LePatron) via CSS Variables
   - [ ] Export HTML compatible email (tables, inline CSS)

### Critères de Succès

- ✅ **Technique** : Les 2 éditeurs fonctionnent sans conflit
- ✅ **Fonctionnel** : Un template Badsender créé en GrapesJS est utilisable
- ✅ **UX** : L'éditeur GrapesJS est aussi facile que Mosaico pour l'utilisateur
- ✅ **Performance** : Temps de chargement < 3 secondes
- ✅ **Email** : Export HTML testé et validé sur Gmail + Outlook

---

## 👤 User Stories

### US-1 : En tant qu'administrateur, je veux activer l'éditeur GrapesJS

**Description :**
En tant qu'administrateur de LePatron, je veux pouvoir activer/désactiver l'éditeur GrapesJS via une option de configuration, afin de contrôler le déploiement progressif de la nouvelle fonctionnalité.

**Critères d'acceptation :**
- [ ] Une variable d'environnement `ENABLE_GRAPESJS_EDITOR=true/false` existe
- [ ] Si `false`, l'option GrapesJS n'apparaît pas dans l'interface
- [ ] Si `true`, l'option GrapesJS est disponible dans le sélecteur d'éditeur
- [ ] La configuration est documentée dans le README

**Complexité :** XS (2h)

---

### US-2 : En tant qu'utilisateur, je veux choisir mon éditeur lors de la création d'un template

**Description :**
Lorsque je crée un nouveau template email, je veux pouvoir choisir entre l'éditeur Mosaico (legacy) et GrapesJS (moderne), afin d'utiliser l'outil le plus adapté à mes besoins.

**Critères d'acceptation :**
- [ ] Lors de la création d'un template, un sélecteur "Type d'éditeur" apparaît
- [ ] Options disponibles : "Mosaico (classique)" et "GrapesJS (moderne)"
- [ ] Le choix est sauvegardé avec le template (`editor_type: 'mosaico' | 'grapesjs'`)
- [ ] L'éditeur sélectionné s'ouvre automatiquement lors de l'édition du template
- [ ] Impossible de changer d'éditeur après création (message d'erreur explicite)

**Maquette :**
```
┌─────────────────────────────────────────┐
│  Créer un nouveau template email       │
├─────────────────────────────────────────┤
│  Nom du template:                       │
│  [ Newsletter Janvier 2025          ]   │
│                                          │
│  Type d'éditeur:                        │
│  ○ Mosaico (classique)                  │
│  ● GrapesJS (moderne) ← recommandé      │
│                                          │
│  [ Annuler ]  [ Créer le template ]     │
└─────────────────────────────────────────┘
```

**Complexité :** S (4h)

---

### US-3 : En tant qu'utilisateur, j'accède à des blocs standards depuis la bibliothèque

**Description :**
Lorsque j'utilise l'éditeur GrapesJS, je veux avoir accès à une bibliothèque de blocs standards (texte, titre, image, bouton, etc.) que je peux glisser-déposer dans mon template, afin de construire rapidement mes emails.

**Critères d'acceptation :**
- [ ] Une section "Blocs Standards" apparaît dans le panneau gauche de GrapesJS
- [ ] Au minimum 6 blocs disponibles :
  - `textBlock` : Bloc de texte riche (paragraphe éditable)
  - `titleBlock` : Titre (H1/H2/H3 sélectionnable)
  - `imageBlock` : Image avec lien optionnel
  - `buttonBlock` : Bouton CTA (texte + lien + style)
  - `dividerBlock` : Séparateur horizontal
  - `spacerBlock` : Espacement vertical configurable
- [ ] Chaque bloc est **glisser-déposer** dans la zone de canvas
- [ ] Les blocs sont **éditables** via le panneau Traits (propriétés)
- [ ] Les blocs génèrent du **HTML compatible email** (tables, pas de div)

**Exemple de rendu d'un textBlock :**
```html
<table width="100%" cellpadding="0" cellspacing="0" role="none">
  <tr>
    <td style="padding: 24px; font-family: Arial, sans-serif; font-size: 14px; line-height: 21px; color: #333333;">
      <p style="margin: 0;">Votre texte éditable ici</p>
    </td>
  </tr>
</table>
```

**Complexité :** M (8h)

---

### US-4 : En tant qu'administrateur technique, je veux gérer les blocs standards

**Description :**
En tant qu'administrateur technique, je veux pouvoir créer, modifier ou supprimer des blocs standards qui seront disponibles pour tous les utilisateurs, afin de maintenir une bibliothèque de composants cohérente.

**Critères d'acceptation :**
- [ ] Les blocs standards sont définis dans un fichier de configuration JSON
- [ ] Structure : `server/config/grapesjs-blocks/standard-blocks.json`
- [ ] Chaque bloc contient :
  - `id` : Identifiant unique
  - `label` : Nom affiché dans l'interface
  - `category` : Catégorie (Basic, Layout, Content, etc.)
  - `content` : HTML du bloc (template)
  - `attributes` : Propriétés éditables (traits)
  - `style` : CSS par défaut
- [ ] Les blocs sont chargés au démarrage de l'éditeur via API
- [ ] Un endpoint `/api/grapesjs/blocks/standard` retourne la liste des blocs
- [ ] Hot-reload : modification du JSON = rechargement sans redémarrer le serveur

**Exemple de structure :**
```json
{
  "blocks": [
    {
      "id": "textBlock",
      "label": "Bloc Texte",
      "category": "Basic",
      "media": "<svg>...</svg>",
      "content": {
        "tagName": "table",
        "attributes": {
          "width": "100%",
          "cellpadding": "0",
          "cellspacing": "0",
          "role": "none"
        },
        "components": [
          {
            "tagName": "tr",
            "components": [
              {
                "tagName": "td",
                "attributes": {
                  "style": "padding: 24px; font-family: Arial, sans-serif;"
                },
                "components": [
                  {
                    "type": "text",
                    "content": "Votre texte ici",
                    "editable": true
                  }
                ]
              }
            ]
          }
        ]
      },
      "traits": [
        {
          "type": "text",
          "name": "padding",
          "label": "Espacement (px)",
          "value": "24"
        }
      ]
    }
  ]
}
```

**Complexité :** M (8h)

---

### US-5 : En tant qu'utilisateur, je crée un template personnalisé avec blocs custom

**Description :**
Lorsque je crée un template GrapesJS personnalisé (par exemple pour la marque Badsender), je veux pouvoir utiliser à la fois les blocs standards ET des blocs spécifiques à mon template, afin de créer des newsletters uniques tout en bénéficiant des composants communs.

**Critères d'acceptation :**
- [ ] Possibilité de définir des blocs custom au niveau du template
- [ ] Les blocs custom sont stockés dans la définition du template (JSON)
- [ ] Les blocs custom apparaissent dans une catégorie "Blocs Custom" séparée
- [ ] Les blocs custom peuvent utiliser des propriétés avancées (colonnes dynamiques, etc.)
- [ ] Les blocs custom ne sont visibles QUE dans le template qui les définit
- [ ] Pas de conflit entre blocs standards et blocs custom (IDs uniques)

**Exemple :** Template Badsender avec bloc `toparticleBlock` custom :
- Bloc standard `titleBlock` disponible
- Bloc custom `toparticleBlock` (image + catégorie + titre + texte + CTA + podcast icons)
- Lors de l'édition, les 2 types de blocs sont accessibles

**Complexité :** L (16h)

---

### US-6 : En tant qu'utilisateur, j'édite le template Badsender en GrapesJS

**Description :**
Je veux pouvoir créer et éditer le template newsletter Badsender (actuellement en Mosaico) avec GrapesJS, afin de valider que GrapesJS peut gérer un cas d'usage réel complexe.

**Critères d'acceptation :**
- [ ] Création d'un nouveau template "Newsletter Badsender (GrapesJS)"
- [ ] Au minimum 6 blocs du template original répliqués :
  - `headerBlock` : Logo Badsender + baseline + liens webversion/désinscription
  - `toparticleBlock` : Article principal avec image, titre, texte, CTA
  - `textBlock` : Bloc de texte simple
  - `titleBlock` : Titre de section
  - `buttonsBlock` : Bouton CTA
  - `footerBlock` : Footer avec logo, liens, social
- [ ] Support des propriétés conditionnelles (ex: `titleVisible`, `ctaVisible`)
- [ ] Export HTML fonctionnel et compatible email
- [ ] Prévisualisation mobile/desktop

**Complexité :** XL (24h)

---

### US-7 : En tant qu'utilisateur, je gère le multi-marque via thème

**Description :**
Lorsque je travaille sur un template multi-marque (Badsender/SM/LePatron), je veux pouvoir basculer entre les marques pour prévisualiser les différences de style, afin de m'assurer que mon template fonctionne pour toutes les marques.

**Critères d'acceptation :**
- [ ] Un sélecteur de marque apparaît en haut de l'éditeur GrapesJS
- [ ] Options : "Badsender", "Sobriété & Marketing", "Le Patron"
- [ ] Le changement de marque applique immédiatement les CSS Variables
- [ ] Les CSS Variables incluent :
  - `--brand-logo` : URL du logo
  - `--brand-primary-color` : Couleur principale
  - `--brand-secondary-color` : Couleur secondaire
  - `--brand-font-title` : Police des titres
  - `--brand-font-body` : Police du texte
- [ ] Le HTML reste identique, seuls les styles changent
- [ ] La marque sélectionnée est sauvegardée avec le template

**Maquette :**
```
┌────────────────────────────────────────────────────────────┐
│  Newsletter Badsender  [ ⚙ ]  [ 💾 Sauvegarder ] [ 👁 Preview ]  │
├────────────────────────────────────────────────────────────┤
│  Marque: [ Badsender ▼ ]  [ Sobriété & Marketing ]  [ Le Patron ] │
├────────────────────────────────────────────────────────────┤
│  Blocs │  Canvas (prévisualisation)         │  Propriétés  │
└────────────────────────────────────────────────────────────┘
```

**Complexité :** M (8h)

---

### US-8 : En tant qu'utilisateur, j'exporte mon template en HTML email

**Description :**
Une fois mon template créé dans GrapesJS, je veux pouvoir l'exporter en HTML compatible email (avec inline CSS, tables, compatibilité Outlook), afin de l'envoyer via mon ESP.

**Critères d'acceptation :**
- [ ] Bouton "Exporter HTML" dans l'interface
- [ ] Export génère un fichier HTML complet (doctype, head, body)
- [ ] CSS inline (via librairie `juice` ou équivalent)
- [ ] Structure en `<table>` (pas de `<div>` pour le layout)
- [ ] Commentaires conditionnels Outlook (`<!--[if mso]>`)
- [ ] Media queries pour responsive mobile
- [ ] Variables email remplacées (`{{mirror}}`, `{{unsubscribe}}`, etc.)
- [ ] Test de rendu sur Litmus ou Email on Acid (optionnel pour POC)

**Exemple de sortie :**
```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Badsender</title>
  <!--[if mso]>
  <style>
    /* Styles Outlook */
  </style>
  <![endif]-->
  <style>
    @media screen and (max-width: 600px) {
      .mobile-full { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <!-- Contenu ici avec inline CSS -->
  </table>
</body>
</html>
```

**Complexité :** M (12h)

---

### US-9 : En tant qu'utilisateur, je sauvegarde et charge mes templates GrapesJS

**Description :**
Je veux pouvoir sauvegarder mon travail dans GrapesJS et le retrouver lors de ma prochaine connexion, afin de ne pas perdre mes modifications.

**Critères d'acceptation :**
- [ ] Bouton "Sauvegarder" dans l'interface GrapesJS
- [ ] Sauvegarde automatique toutes les 30 secondes (auto-save)
- [ ] Données stockées en base MongoDB dans la collection `mailings`
- [ ] Structure de données :
  ```json
  {
    "_id": "...",
    "name": "Newsletter Badsender",
    "editor_type": "grapesjs",
    "grapesjs_data": {
      "components": [...],  // Structure du template
      "styles": [...],       // Styles CSS
      "assets": [...],       // Images uploadées
      "customBlocks": [...]  // Blocs custom du template
    },
    "brand": "badsender",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T14:30:00Z"
  }
  ```
- [ ] Chargement du template au clic sur "Éditer"
- [ ] Gestion des versions (optionnel pour POC)
- [ ] Message de confirmation "Sauvegarde réussie"

**Complexité :** M (10h)

---

### US-10 : En tant que développeur, j'ai accès à la documentation technique

**Description :**
En tant que développeur travaillant sur le POC, je veux avoir accès à une documentation technique claire expliquant l'architecture, les API et les décisions techniques, afin de pouvoir maintenir et étendre le code facilement.

**Critères d'acceptation :**
- [ ] Fichier `docs/GRAPESJS_INTEGRATION.md` créé
- [ ] Documentation inclut :
  - Architecture générale (schémas)
  - Structure de données (modèles MongoDB)
  - API endpoints (routes Express)
  - Configuration GrapesJS (plugins, options)
  - Création de blocs custom (tutoriel)
  - Export HTML (pipeline)
  - Gestion multi-marque (CSS Variables)
- [ ] Exemples de code commentés
- [ ] Diagrammes de séquence pour les flows principaux
- [ ] README mis à jour avec section GrapesJS

**Complexité :** S (6h)

---

## 🏗️ Architecture Technique

### Stack Technologique

**Frontend :**
- **GrapesJS** v0.21+ (éditeur)
- **grapesjs-preset-newsletter** (plugin email)
- **Vue.js 2.6** (framework actuel de LePatron)
- **Axios** (requêtes HTTP)

**Backend :**
- **Node.js 14+** (serveur actuel)
- **Express.js** (API)
- **MongoDB** (base de données)
- **Mongoose** (ODM)

**Librairies Complémentaires :**
- **juice** : Inline CSS pour emails
- **cheerio** : Manipulation HTML côté serveur
- **multer** : Upload d'images

---

### Architecture des Composants

```
┌─────────────────────────────────────────────────────────────┐
│                    LEPATRON PLATFORM                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                   ┌─────────▼────────┐
│  MOSAICO/KO    │                   │    GRAPESJS      │
│   (Legacy)     │                   │    (Moderne)     │
└────────────────┘                   └──────────────────┘
        │                                       │
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  SHARED LAYER  │
                    │                │
                    │  - Storage     │
                    │  - Assets      │
                    │  - ESP Export  │
                    └────────────────┘
```

---

### Structure de Dossiers

```
LePatron.email/
├── packages/
│   ├── editor/                    # Éditeur Mosaico existant
│   │   ├── ...                    # Code existant (ne pas toucher)
│   │
│   ├── grapesjs-editor/           # NOUVEAU : Éditeur GrapesJS
│   │   ├── client/                # Code frontend
│   │   │   ├── components/
│   │   │   │   ├── GrapesJSEditor.vue      # Composant principal
│   │   │   │   ├── BlockManager.vue        # Gestion des blocs
│   │   │   │   ├── BrandSelector.vue       # Sélecteur de marque
│   │   │   │   └── ExportModal.vue         # Modal d'export
│   │   │   ├── config/
│   │   │   │   ├── grapesjs-config.js      # Configuration GrapesJS
│   │   │   │   ├── plugins.js              # Plugins GrapesJS
│   │   │   │   └── brand-tokens.js         # CSS Variables par marque
│   │   │   ├── blocks/
│   │   │   │   ├── standard/               # Blocs standards
│   │   │   │   │   ├── textBlock.js
│   │   │   │   │   ├── titleBlock.js
│   │   │   │   │   ├── imageBlock.js
│   │   │   │   │   ├── buttonBlock.js
│   │   │   │   │   ├── dividerBlock.js
│   │   │   │   │   └── spacerBlock.js
│   │   │   │   └── custom/                 # Blocs Badsender custom
│   │   │   │       ├── headerBlock.js
│   │   │   │       ├── toparticleBlock.js
│   │   │   │       └── footerBlock.js
│   │   │   └── utils/
│   │   │       ├── export-html.js          # Export HTML + inline CSS
│   │   │       └── email-compatibility.js  # Helpers compatibilité
│   │   │
│   │   └── server/                # Code backend
│   │       ├── routes/
│   │       │   └── grapesjs.js             # Routes API GrapesJS
│   │       ├── controllers/
│   │       │   ├── blocks.controller.js    # CRUD blocs
│   │       │   ├── templates.controller.js # CRUD templates
│   │       │   └── export.controller.js    # Export HTML
│   │       ├── models/
│   │       │   └── grapesjs-template.js    # Modèle Mongoose
│   │       ├── config/
│   │       │   └── standard-blocks.json    # Définition blocs standards
│   │       └── services/
│   │           ├── inline-css.service.js   # Service juice
│   │           └── email-export.service.js # Service export
│   │
│   └── ui/                        # Interface LePatron existante
│       ├── pages/
│       │   └── templates/
│       │       ├── create.vue              # MODIFIÉ : Sélecteur éditeur
│       │       └── edit.vue                # MODIFIÉ : Router vers bon éditeur
│       └── ...
│
├── docs/
│   ├── GRAPESJS_INTEGRATION.md            # NOUVEAU : Doc technique
│   └── ...
│
└── .env.example                            # MODIFIÉ : Ajout ENABLE_GRAPESJS_EDITOR
```

---

### Modèle de Données

#### Collection `mailings` (existante, étendue)

```javascript
const mailingSchema = new mongoose.Schema({
  // Champs existants
  name: { type: String, required: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  _company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // NOUVEAU : Type d'éditeur
  editor_type: {
    type: String,
    enum: ['mosaico', 'grapesjs'],
    default: 'mosaico',
    required: true
  },

  // Champs existants pour Mosaico
  data: { type: mongoose.Schema.Types.Mixed }, // JSON Mosaico

  // NOUVEAU : Données GrapesJS
  grapesjs_data: {
    type: {
      components: { type: Array, default: [] },     // Structure HTML
      styles: { type: Array, default: [] },         // Styles CSS
      assets: { type: Array, default: [] },         // Images/fichiers
      customBlocks: { type: Array, default: [] },   // Blocs custom
      pages: { type: Array, default: [] }           // Pages (multi-page)
    },
    required: false
  },

  // NOUVEAU : Configuration multi-marque
  brand: {
    type: String,
    enum: ['badsender', 'sm', 'lepatron'],
    required: false
  },

  // Champs existants
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index pour performance
mailingSchema.index({ editor_type: 1, workspace: 1 });
mailingSchema.index({ brand: 1 });
```

---

### API Endpoints

#### Routes GrapesJS

```javascript
// packages/grapesjs-editor/server/routes/grapesjs.js

const express = require('express');
const router = express.Router();

// 1. Récupérer les blocs standards
router.get('/api/grapesjs/blocks/standard', (req, res) => {
  // Charge standard-blocks.json
  // Retourne la liste des blocs
});

// 2. Récupérer les blocs custom d'un template
router.get('/api/grapesjs/blocks/custom/:templateId', (req, res) => {
  // Charge grapesjs_data.customBlocks du template
});

// 3. Sauvegarder un template GrapesJS
router.post('/api/grapesjs/templates/:id/save', (req, res) => {
  // Sauvegarde grapesjs_data dans MongoDB
  // Auto-save ou sauvegarde manuelle
});

// 4. Charger un template GrapesJS
router.get('/api/grapesjs/templates/:id', (req, res) => {
  // Récupère grapesjs_data depuis MongoDB
  // Retourne components, styles, assets, customBlocks
});

// 5. Exporter un template en HTML
router.post('/api/grapesjs/templates/:id/export', (req, res) => {
  // Récupère HTML + CSS de GrapesJS
  // Inline CSS avec juice
  // Retourne HTML final
});

// 6. Prévisualiser un template
router.post('/api/grapesjs/templates/:id/preview', (req, res) => {
  // Génère preview HTML
  // Substitue variables ({{mirror}}, etc.)
});

// 7. Upload d'images (assets)
router.post('/api/grapesjs/assets/upload', upload.single('file'), (req, res) => {
  // Upload image vers serveur ou S3
  // Retourne URL de l'image
});

module.exports = router;
```

---

### Configuration GrapesJS

```javascript
// packages/grapesjs-editor/client/config/grapesjs-config.js

export const getGrapesJSConfig = (brand = 'badsender') => {
  return {
    // Container
    container: '#gjs',
    fromElement: false,

    // Dimensions du canvas
    height: '100vh',
    width: 'auto',

    // Storage Manager (sauvegarde auto)
    storageManager: {
      type: 'remote',
      autosave: true,
      autoload: true,
      stepsBeforeSave: 1,
      options: {
        remote: {
          urlLoad: `/api/grapesjs/templates/${templateId}`,
          urlStore: `/api/grapesjs/templates/${templateId}/save`,
          onLoad: (result) => result.grapesjs_data,
          onStore: (data) => ({ grapesjs_data: data }),
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        }
      }
    },

    // Plugins
    plugins: [
      'grapesjs-preset-newsletter',
      'gjs-blocks-basic',
      'grapesjs-custom-code'
    ],

    pluginsOpts: {
      'grapesjs-preset-newsletter': {
        modalTitleImport: 'Importer template',
        modalLabelImport: 'Coller votre HTML ici',
        modalTitleExport: 'Exporter template',
        codeViewerTheme: 'material',
        importPlaceholder: '<table>...</table>',
        cellStyle: {
          'font-size': '14px',
          'font-family': 'Arial, sans-serif',
          'color': '#333333',
          'line-height': '21px',
          'padding': '0'
        }
      }
    },

    // Asset Manager (gestion des images)
    assetManager: {
      upload: '/api/grapesjs/assets/upload',
      uploadName: 'file',
      multiUpload: false,
      autoAdd: true,
      assets: []
    },

    // Canvas
    canvas: {
      styles: [],
      scripts: []
    },

    // Panels
    panels: {
      defaults: [
        {
          id: 'basic-actions',
          el: '.panel__basic-actions',
          buttons: [
            {
              id: 'visibility',
              active: true,
              className: 'btn-toggle-borders',
              label: '<i class="fa fa-clone"></i>',
              command: 'sw-visibility'
            }
          ]
        },
        {
          id: 'panel-devices',
          el: '.panel__devices',
          buttons: [
            {
              id: 'device-desktop',
              label: '<i class="fa fa-desktop"></i>',
              command: 'set-device-desktop',
              active: true
            },
            {
              id: 'device-mobile',
              label: '<i class="fa fa-mobile"></i>',
              command: 'set-device-mobile'
            }
          ]
        }
      ]
    },

    // Device Manager (responsive)
    deviceManager: {
      devices: [
        {
          id: 'desktop',
          name: 'Desktop',
          width: '100%'
        },
        {
          id: 'mobile',
          name: 'Mobile',
          width: '320px',
          widthMedia: '480px'
        }
      ]
    },

    // Style Manager
    styleManager: {
      sectors: [
        {
          name: 'Général',
          open: true,
          properties: [
            'display',
            'width',
            'height',
            'padding',
            'margin'
          ]
        },
        {
          name: 'Typographie',
          open: false,
          properties: [
            'font-family',
            'font-size',
            'font-weight',
            'color',
            'text-align',
            'line-height'
          ]
        },
        {
          name: 'Décorations',
          open: false,
          properties: [
            'background-color',
            'border',
            'border-radius'
          ]
        }
      ]
    }
  };
};
```

---

### CSS Variables Multi-Marque

```javascript
// packages/grapesjs-editor/client/config/brand-tokens.js

export const brandTokens = {
  badsender: {
    name: 'Badsender',
    tokens: {
      // Logos
      '--brand-logo-header': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_bs_dm.png)',
      '--brand-logo-footer': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_bs_dm.png)',

      // Couleurs
      '--brand-primary-color': '#000000',
      '--brand-secondary-color': '#666666',
      '--brand-accent-color': '#000000',
      '--brand-bg-color': '#ffffff',
      '--brand-text-color': '#333333',

      // Typographie
      '--brand-font-title': "'Playfair Display', serif",
      '--brand-font-body': "'Montserrat', Tahoma, Arial, sans-serif",
      '--brand-font-cta': "'Montserrat_cta', Tahoma, Arial, sans-serif",

      // Tailles
      '--brand-title-size': '36px',
      '--brand-text-size': '14px',
      '--brand-cta-size': '14px',

      // Espacements
      '--brand-spacing-outer': '24px',
      '--brand-spacing-inner': '12px',

      // Boutons
      '--brand-cta-bg-primary': '#000000',
      '--brand-cta-color-primary': '#ffffff',
      '--brand-cta-border-primary': '1px solid #000000',
      '--brand-cta-bg-secondary': 'transparent',
      '--brand-cta-color-secondary': '#000000',
      '--brand-cta-border-secondary': '1px solid #000000',

      // Divers
      '--brand-border-radius': '3px',
      '--brand-divider-color': '#cccccc'
    }
  },

  sm: {
    name: 'Sobriété & Marketing',
    tokens: {
      '--brand-logo-header': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_sm.png)',
      '--brand-logo-footer': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_sm.png)',
      '--brand-primary-color': '#1a1a1a',
      '--brand-secondary-color': '#7dc5ce',
      '--brand-accent-color': '#7dc5ce',
      '--brand-bg-color': '#ffffff',
      '--brand-text-color': '#333333',
      '--brand-font-title': "'Montserrat', Arial, sans-serif",
      '--brand-font-body': "'Montserrat', Tahoma, Arial, sans-serif",
      '--brand-font-cta': "'Montserrat_cta', Tahoma, Arial, sans-serif",
      '--brand-title-size': '36px',
      '--brand-text-size': '14px',
      '--brand-cta-size': '14px',
      '--brand-spacing-outer': '24px',
      '--brand-spacing-inner': '12px',
      '--brand-cta-bg-primary': '#000000',
      '--brand-cta-color-primary': '#ffffff',
      '--brand-cta-border-primary': '1px solid #000000',
      '--brand-cta-bg-secondary': 'transparent',
      '--brand-cta-color-secondary': '#000000',
      '--brand-cta-border-secondary': '1px solid #000000',
      '--brand-border-radius': '3px',
      '--brand-divider-color': '#E6E6E6'
    }
  },

  lepatron: {
    name: 'Le Patron',
    tokens: {
      '--brand-logo-header': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_lp.png)',
      '--brand-logo-footer': 'url(https://live.lepatron.email/badsender_lib/lepatron/images/logos/logo_lp.png)',
      '--brand-primary-color': '#000000',
      '--brand-secondary-color': '#c9a961',
      '--brand-accent-color': '#c9a961',
      '--brand-bg-color': '#ffffff',
      '--brand-text-color': '#333333',
      '--brand-font-title': "'Playfair Display Black', serif",
      '--brand-font-body': "'Montserrat', Tahoma, Arial, sans-serif",
      '--brand-font-cta': "'Montserrat_cta', Tahoma, Arial, sans-serif",
      '--brand-title-size': '36px',
      '--brand-text-size': '14px',
      '--brand-cta-size': '14px',
      '--brand-spacing-outer': '24px',
      '--brand-spacing-inner': '12px',
      '--brand-cta-bg-primary': '#000000',
      '--brand-cta-color-primary': '#ffffff',
      '--brand-cta-border-primary': '1px solid #000000',
      '--brand-cta-bg-secondary': 'transparent',
      '--brand-cta-color-secondary': '#000000',
      '--brand-cta-border-secondary': '1px solid #000000',
      '--brand-border-radius': '3px',
      '--brand-divider-color': '#cccccc'
    }
  }
};

/**
 * Applique les tokens d'une marque au canvas GrapesJS
 */
export function applyBrandTheme(editor, brandKey) {
  const brand = brandTokens[brandKey];
  if (!brand) {
    console.error(`Brand "${brandKey}" not found`);
    return;
  }

  const canvas = editor.Canvas.getBody();

  Object.entries(brand.tokens).forEach(([varName, value]) => {
    canvas.style.setProperty(varName, value);
  });

  console.log(`✅ Applied brand theme: ${brand.name}`);
}
```

---

### Exemple de Bloc Standard : textBlock

```javascript
// packages/grapesjs-editor/client/blocks/standard/textBlock.js

export default {
  id: 'textBlock',
  label: 'Bloc Texte',
  category: 'Basic',
  media: `
    <svg viewBox="0 0 24 24" width="48" height="48">
      <path d="M3 5h18v2H3V5m0 6h18v2H3v-2m0 6h12v2H3v-2z"/>
    </svg>
  `,
  content: {
    type: 'email-text-block',
    tagName: 'table',
    attributes: {
      width: '100%',
      cellpadding: '0',
      cellspacing: '0',
      role: 'none',
      class: 'text-block',
      style: 'width: 100%; max-width: 600px; margin: 0 auto;'
    },
    components: [
      {
        tagName: 'tr',
        components: [
          {
            tagName: 'td',
            attributes: {
              style: `
                padding: var(--brand-spacing-outer);
                font-family: var(--brand-font-body);
                font-size: var(--brand-text-size);
                line-height: 21px;
                color: var(--brand-text-color);
                text-align: left;
              `
            },
            components: [
              {
                type: 'text',
                content: `
                  <p style="margin: 0; margin-bottom: 12px;">
                    Ceci est un paragraphe éditable. Vous pouvez modifier ce texte,
                    ajouter des liens, mettre en <strong>gras</strong> ou en <em>italique</em>.
                  </p>
                  <p style="margin: 0;">
                    Vous pouvez ajouter plusieurs paragraphes dans ce bloc.
                  </p>
                `,
                editable: true
              }
            ]
          }
        ]
      }
    ],
    styles: `
      .text-block p {
        margin: 0;
        margin-bottom: 12px;
      }
      .text-block p:last-child {
        margin-bottom: 0;
      }
      .text-block a {
        color: var(--brand-primary-color);
        text-decoration: underline;
      }
    `,
    traits: [
      {
        type: 'select',
        name: 'align',
        label: 'Alignement',
        options: [
          { value: 'left', name: 'Gauche' },
          { value: 'center', name: 'Centre' },
          { value: 'right', name: 'Droite' }
        ],
        changeProp: 1
      },
      {
        type: 'number',
        name: 'padding',
        label: 'Espacement (px)',
        min: 0,
        max: 60,
        value: 24,
        changeProp: 1
      }
    ]
  },

  // Custom component type
  component: {
    model: {
      defaults: {
        name: 'Bloc Texte'
      }
    },

    view: {
      init() {
        this.listenTo(this.model, 'change:align', this.updateAlign);
        this.listenTo(this.model, 'change:padding', this.updatePadding);
      },

      updateAlign() {
        const align = this.model.get('align');
        const td = this.el.querySelector('td');
        if (td) {
          td.style.textAlign = align;
        }
      },

      updatePadding() {
        const padding = this.model.get('padding');
        const td = this.el.querySelector('td');
        if (td) {
          td.style.padding = `${padding}px`;
        }
      }
    }
  }
};
```

---

### Exemple de Bloc Custom : toparticleBlock

```javascript
// packages/grapesjs-editor/client/blocks/custom/toparticleBlock.js

export default {
  id: 'toparticleBlock',
  label: 'Article Principal',
  category: 'Badsender Custom',
  media: `<svg>...</svg>`,
  content: {
    type: 'toparticle-block',
    tagName: 'table',
    attributes: {
      width: '100%',
      cellpadding: '0',
      cellspacing: '0',
      role: 'none',
      style: 'width: 100%; max-width: 600px; background-color: var(--brand-bg-color);'
    },
    components: [
      {
        tagName: 'tr',
        components: [
          {
            tagName: 'td',
            attributes: {
              style: 'padding: var(--brand-spacing-outer);'
            },
            components: [
              // Image (conditionnelle)
              {
                tagName: 'table',
                attributes: {
                  'data-visible-if': 'imageVisible',
                  style: 'display: none;'
                },
                components: [
                  {
                    tagName: 'tr',
                    components: [
                      {
                        tagName: 'td',
                        components: [
                          {
                            type: 'image',
                            attributes: {
                              src: 'https://via.placeholder.com/600x280',
                              alt: 'Image article',
                              width: '600',
                              style: 'width: 100%; display: block;'
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              },

              // Catégorie (conditionnelle)
              {
                tagName: 'table',
                attributes: {
                  'data-visible-if': 'categoryVisible',
                  style: 'display: none; margin-top: 24px;'
                },
                components: [
                  {
                    tagName: 'tr',
                    components: [
                      {
                        tagName: 'td',
                        attributes: {
                          style: `
                            padding: 3px 12px;
                            background-color: #E6E6E6;
                            border-radius: 60px;
                            display: inline-block;
                          `
                        },
                        components: [
                          {
                            type: 'text',
                            content: 'tag',
                            editable: true,
                            attributes: {
                              style: `
                                margin: 0;
                                font-family: var(--brand-font-body);
                                font-size: 12px;
                                color: #1a1a1a;
                                text-transform: lowercase;
                              `
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              },

              // Titre (conditionnel)
              {
                tagName: 'h2',
                attributes: {
                  'data-visible-if': 'titleVisible',
                  style: `
                    margin: 0;
                    margin-top: 12px;
                    font-family: var(--brand-font-title);
                    font-size: var(--brand-title-size);
                    font-weight: bold;
                    color: var(--brand-primary-color);
                  `
                },
                content: 'Titre de l\'article',
                editable: true
              },

              // Texte
              {
                type: 'text',
                content: '<p style="margin: 0; margin-top: 12px;">Texte de l\'article...</p>',
                editable: true,
                attributes: {
                  style: `
                    font-family: var(--brand-font-body);
                    font-size: var(--brand-text-size);
                    line-height: 21px;
                    color: var(--brand-text-color);
                  `
                }
              },

              // Bouton CTA (conditionnel)
              {
                tagName: 'table',
                attributes: {
                  'data-visible-if': 'ctaVisible',
                  style: 'display: none; margin-top: 18px;'
                },
                components: [
                  {
                    tagName: 'tr',
                    components: [
                      {
                        tagName: 'td',
                        attributes: {
                          style: `
                            padding: 12px;
                            background-color: var(--brand-cta-bg-primary);
                            border-radius: var(--brand-border-radius);
                            display: inline-block;
                          `
                        },
                        components: [
                          {
                            type: 'link',
                            content: 'CALL TO ACTION',
                            attributes: {
                              href: '#',
                              style: `
                                text-decoration: none;
                                font-family: var(--brand-font-cta);
                                font-size: var(--brand-cta-size);
                                color: var(--brand-cta-color-primary);
                                text-transform: uppercase;
                              `
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],

    traits: [
      {
        type: 'checkbox',
        name: 'imageVisible',
        label: 'Afficher l\'image',
        value: true,
        changeProp: 1
      },
      {
        type: 'checkbox',
        name: 'categoryVisible',
        label: 'Afficher la catégorie',
        value: true,
        changeProp: 1
      },
      {
        type: 'checkbox',
        name: 'titleVisible',
        label: 'Afficher le titre',
        value: true,
        changeProp: 1
      },
      {
        type: 'checkbox',
        name: 'ctaVisible',
        label: 'Afficher le bouton',
        value: true,
        changeProp: 1
      },
      {
        type: 'select',
        name: 'titleLevel',
        label: 'Niveau de titre',
        options: [
          { value: 'h2', name: 'H2' },
          { value: 'h3', name: 'H3' },
          { value: 'h4', name: 'H4' }
        ],
        value: 'h2',
        changeProp: 1
      }
    ]
  },

  component: {
    model: {
      defaults: {
        name: 'Article Principal'
      }
    },

    view: {
      init() {
        this.listenTo(this.model, 'change:imageVisible', this.toggleImage);
        this.listenTo(this.model, 'change:categoryVisible', this.toggleCategory);
        this.listenTo(this.model, 'change:titleVisible', this.toggleTitle);
        this.listenTo(this.model, 'change:ctaVisible', this.toggleCta);
        this.listenTo(this.model, 'change:titleLevel', this.updateTitleLevel);
      },

      toggleImage() {
        const visible = this.model.get('imageVisible');
        const imageTable = this.el.querySelector('[data-visible-if="imageVisible"]');
        if (imageTable) {
          imageTable.style.display = visible ? 'table' : 'none';
        }
      },

      toggleCategory() {
        const visible = this.model.get('categoryVisible');
        const categoryTable = this.el.querySelector('[data-visible-if="categoryVisible"]');
        if (categoryTable) {
          categoryTable.style.display = visible ? 'table' : 'none';
        }
      },

      toggleTitle() {
        const visible = this.model.get('titleVisible');
        const titleEl = this.el.querySelector('[data-visible-if="titleVisible"]');
        if (titleEl) {
          titleEl.style.display = visible ? 'block' : 'none';
        }
      },

      toggleCta() {
        const visible = this.model.get('ctaVisible');
        const ctaTable = this.el.querySelector('[data-visible-if="ctaVisible"]');
        if (ctaTable) {
          ctaTable.style.display = visible ? 'table' : 'none';
        }
      },

      updateTitleLevel() {
        const level = this.model.get('titleLevel');
        const oldTitle = this.el.querySelector('h2, h3, h4');

        if (oldTitle) {
          const newTitle = document.createElement(level);
          newTitle.innerHTML = oldTitle.innerHTML;
          newTitle.setAttribute('style', oldTitle.getAttribute('style'));
          oldTitle.replaceWith(newTitle);
        }
      }
    }
  }
};
```

---

### Service d'Export HTML

```javascript
// packages/grapesjs-editor/server/services/email-export.service.js

const juice = require('juice');
const cheerio = require('cheerio');

class EmailExportService {
  /**
   * Exporte un template GrapesJS en HTML email
   */
  async exportToHTML(grapesJSData, brand = 'badsender', options = {}) {
    try {
      // 1. Récupérer HTML et CSS de GrapesJS
      const html = grapesJSData.html || '';
      const css = grapesJSData.css || '';

      // 2. Construire le HTML complet
      const fullHTML = this.buildFullHTML(html, css, brand);

      // 3. Inline CSS avec juice
      const inlinedHTML = juice(fullHTML, {
        preserveMediaQueries: true,
        preserveFontFaces: true,
        removeStyleTags: false,
        applyStyleTags: true,
        applyWidthAttributes: true,
        applyHeightAttributes: true,
        ...options.juiceOptions
      });

      // 4. Post-processing
      const processedHTML = this.postProcess(inlinedHTML, brand, options);

      // 5. Valider HTML
      const isValid = this.validateEmailHTML(processedHTML);

      return {
        success: true,
        html: processedHTML,
        isValid,
        warnings: isValid ? [] : ['HTML may have compatibility issues']
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Construit le HTML complet avec doctype, head, body
   */
  buildFullHTML(bodyHTML, css, brand) {
    const brandTokens = this.getBrandTokens(brand);

    return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr" lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no">
  <title>${brandTokens.name} Newsletter</title>

  <!--[if !mso]><!-->
  <style type="text/css">
    /* CSS Variables (pour preview) */
    :root {
      ${Object.entries(brandTokens.tokens)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n      ')}
    }
  </style>
  <!--<![endif]-->

  <style type="text/css">
    ${css}

    /* Reset styles */
    * { font-weight: auto; }
    body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    img { border: 0; display: block; }
    table { border-collapse: collapse; }

    /* Outlook fixes */
    table { mso-table-rspace: 0pt; mso-table-lspace: 0pt; }
    #outlook a { padding: 0; }

    /* Responsive */
    @media screen and (max-width: 600px) {
      .mobile-full { width: 100% !important; }
      .mobile-hidden { display: none !important; }
      .mobile-text-center { text-align: center !important; }
    }
  </style>

  <!--[if mso]>
  <style>
    /* Outlook-specific styles */
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0;">
  ${bodyHTML}
</body>
</html>
    `.trim();
  }

  /**
   * Post-processing du HTML
   */
  postProcess(html, brand, options) {
    const $ = cheerio.load(html);

    // 1. Remplacer variables email
    if (options.replaceVariables !== false) {
      $('body').html(
        $('body').html()
          .replace(/\{\{mirror\}\}/g, '[mirror_link]')
          .replace(/\{\{unsubscribe\}\}/g, '[unsubscribe_link]')
          .replace(/\{\{webversion\}\}/g, '[webversion_link]')
          .replace(/\{\{profile\}\}/g, '[profile_link]')
      );
    }

    // 2. Ajouter attributs Outlook si manquants
    $('table').each((i, el) => {
      const $table = $(el);
      if (!$table.attr('cellpadding')) $table.attr('cellpadding', '0');
      if (!$table.attr('cellspacing')) $table.attr('cellspacing', '0');
      if (!$table.attr('border')) $table.attr('border', '0');
    });

    // 3. Convertir CSS Variables en valeurs inline (pour email)
    const brandTokens = this.getBrandTokens(brand);
    $('*').each((i, el) => {
      const $el = $(el);
      const style = $el.attr('style');

      if (style && style.includes('var(--')) {
        let newStyle = style;
        Object.entries(brandTokens.tokens).forEach(([varName, value]) => {
          const regex = new RegExp(`var\\(${varName}\\)`, 'g');
          newStyle = newStyle.replace(regex, value);
        });
        $el.attr('style', newStyle);
      }
    });

    return $.html();
  }

  /**
   * Validation basique du HTML email
   */
  validateEmailHTML(html) {
    const $ = cheerio.load(html);

    // Vérifications de base
    const hasTables = $('table').length > 0;
    const hasDoctype = html.includes('<!DOCTYPE');
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;

    return hasTables && hasDoctype && hasViewportMeta;
  }

  /**
   * Récupère les tokens de marque
   */
  getBrandTokens(brand) {
    // Importer depuis brand-tokens.js
    const { brandTokens } = require('../../client/config/brand-tokens');
    return brandTokens[brand] || brandTokens.badsender;
  }
}

module.exports = new EmailExportService();
```

---

## 🧪 Tests et Validation

### Tests Fonctionnels

**Checklist de tests :**

- [ ] **Coexistence éditeurs**
  - [ ] Créer template Mosaico → OK
  - [ ] Créer template GrapesJS → OK
  - [ ] Éditer template Mosaico → Ouvre Mosaico
  - [ ] Éditer template GrapesJS → Ouvre GrapesJS
  - [ ] Pas de conflit JavaScript entre les 2 éditeurs

- [ ] **Blocs standards**
  - [ ] 6 blocs visibles dans panneau gauche
  - [ ] Glisser-déposer fonctionne
  - [ ] Édition des propriétés (Traits) fonctionne
  - [ ] Suppression de blocs fonctionne
  - [ ] Duplication de blocs fonctionne

- [ ] **Template Badsender**
  - [ ] headerBlock : Logo + baseline + liens
  - [ ] toparticleBlock : Image + catégorie + titre + texte + CTA
  - [ ] textBlock : Texte riche éditable
  - [ ] titleBlock : Titre H2/H3/H4
  - [ ] buttonsBlock : Bouton CTA
  - [ ] footerBlock : Footer complet

- [ ] **Multi-marque**
  - [ ] Sélecteur de marque visible
  - [ ] Changement Badsender → SM → Logo change
  - [ ] Changement SM → LePatron → Couleurs changent
  - [ ] Sauvegarde de la marque sélectionnée

- [ ] **Export HTML**
  - [ ] Export génère HTML valide
  - [ ] CSS inline présent
  - [ ] Structure en tables (pas div)
  - [ ] Variables remplacées ({{mirror}}, etc.)
  - [ ] Test Outlook : Rendu OK
  - [ ] Test Gmail : Rendu OK

- [ ] **Sauvegarde/Chargement**
  - [ ] Sauvegarde manuelle fonctionne
  - [ ] Auto-save toutes les 30s fonctionne
  - [ ] Rechargement page → Contenu restauré
  - [ ] Message "Sauvegarde réussie"

---

### Tests de Performance

**Métriques à mesurer :**

| Métrique | Cible | Comment mesurer |
|----------|-------|----------------|
| Temps de chargement initial | < 3s | Chrome DevTools (Network) |
| Temps de sauvegarde | < 1s | Console.time() |
| Taille JSON template | < 500KB | JSON.stringify().length |
| Temps d'export HTML | < 2s | Performance.now() |
| FPS lors du drag & drop | > 30 FPS | Chrome DevTools (Performance) |

---

### Tests de Compatibilité Email

**Clients email à tester :**

**Desktop :**
- [ ] Outlook 2016 (Windows)
- [ ] Outlook 2019 (Windows)
- [ ] Outlook 365 (Web)
- [ ] Gmail (Web Chrome)
- [ ] Gmail (Web Firefox)
- [ ] Apple Mail (macOS)
- [ ] Thunderbird

**Mobile :**
- [ ] Gmail (iOS)
- [ ] Gmail (Android)
- [ ] Apple Mail (iOS)
- [ ] Outlook (iOS)
- [ ] Outlook (Android)

**Outils de test recommandés :**
- Litmus (payant, le meilleur)
- Email on Acid (payant)
- Mailtrap (gratuit, limité)
- Putsmail (gratuit, envoi direct)

---

## 📦 Livrables du POC

### Code

- [ ] Package `packages/grapesjs-editor/` complet
- [ ] 6 blocs standards fonctionnels
- [ ] 6 blocs custom Badsender fonctionnels
- [ ] API backend complète (7 endpoints)
- [ ] Configuration multi-marque (CSS Variables)
- [ ] Service d'export HTML

### Documentation

- [ ] `docs/GRAPESJS_INTEGRATION.md` (architecture technique)
- [ ] `README.md` mis à jour (section GrapesJS)
- [ ] Commentaires de code (JSDoc)
- [ ] Guide utilisateur (comment créer un template)

### Tests

- [ ] Checklist tests fonctionnels complétée
- [ ] Tests de performance passés
- [ ] Tests email (Gmail + Outlook minimum)
- [ ] Screenshots comparatifs (Mosaico vs GrapesJS)

### Démo

- [ ] Template Badsender créé en GrapesJS
- [ ] Export HTML du template
- [ ] Vidéo screencast (5 min) montrant :
  - Création template
  - Utilisation blocs standards + custom
  - Changement de marque
  - Export HTML

---

## 🚀 Plan d'Implémentation

### Phase 1 : Setup & Infrastructure (Semaine 1)

**Objectif :** Poser les bases techniques

**Tâches :**
1. **Setup projet** (4h)
   - [ ] Créer dossier `packages/grapesjs-editor/`
   - [ ] Installer dépendances npm (grapesjs, juice, etc.)
   - [ ] Configurer webpack/build
   - [ ] Ajouter variable env `ENABLE_GRAPESJS_EDITOR`

2. **Modèle de données** (4h)
   - [ ] Étendre schéma Mongoose `mailings`
   - [ ] Ajouter champ `editor_type`
   - [ ] Ajouter champ `grapesjs_data`
   - [ ] Ajouter champ `brand`
   - [ ] Créer migration si nécessaire

3. **API Backend** (8h)
   - [ ] Créer routes `/api/grapesjs/*`
   - [ ] Endpoint GET `/blocks/standard`
   - [ ] Endpoint POST `/templates/:id/save`
   - [ ] Endpoint GET `/templates/:id`
   - [ ] Endpoint POST `/templates/:id/export`
   - [ ] Tests Postman/Insomnia

4. **Interface sélecteur** (4h)
   - [ ] Modifier `pages/templates/create.vue`
   - [ ] Ajouter radio buttons Mosaico/GrapesJS
   - [ ] Sauvegarder choix dans DB
   - [ ] Router vers bon éditeur

**Livrable Semaine 1 :** Infrastructure complète, API fonctionnelle, sélecteur d'éditeur

---

### Phase 2 : Blocs Standards (Semaine 2)

**Objectif :** Créer la bibliothèque de blocs standards

**Tâches :**
1. **Configuration GrapesJS** (4h)
   - [ ] Créer `grapesjs-config.js`
   - [ ] Configurer plugins
   - [ ] Configurer storage manager
   - [ ] Configurer device manager

2. **Blocs standards** (16h)
   - [ ] `textBlock` (2h)
   - [ ] `titleBlock` (2h)
   - [ ] `imageBlock` (3h)
   - [ ] `buttonBlock` (3h)
   - [ ] `dividerBlock` (2h)
   - [ ] `spacerBlock` (2h)
   - [ ] Fichier `standard-blocks.json` (2h)

3. **Interface GrapesJS** (8h)
   - [ ] Composant Vue `GrapesJSEditor.vue`
   - [ ] Chargement des blocs depuis API
   - [ ] Panneau blocs (Block Manager)
   - [ ] Panneau propriétés (Trait Manager)
   - [ ] Preview desktop/mobile

4. **Tests** (4h)
   - [ ] Test chaque bloc individuellement
   - [ ] Test glisser-déposer
   - [ ] Test édition propriétés
   - [ ] Test sauvegarde/chargement

**Livrable Semaine 2 :** Éditeur GrapesJS fonctionnel avec 6 blocs standards

---

### Phase 3 : Template Badsender (Semaine 3)

**Objectif :** Répliquer le template newsletter Badsender

**Tâches :**
1. **Blocs custom Badsender** (24h)
   - [ ] `headerBlock` (4h)
   - [ ] `toparticleBlock` (6h)
   - [ ] `articlesBlock` (6h)
   - [ ] `buttonsBlock` (2h)
   - [ ] `footerBlock` (4h)
   - [ ] `socialBlock` (2h)

2. **Multi-marque** (8h)
   - [ ] Créer `brand-tokens.js`
   - [ ] Fonction `applyBrandTheme()`
   - [ ] Composant `BrandSelector.vue`
   - [ ] Intégration dans éditeur
   - [ ] Test changement de marque

3. **Export HTML** (12h)
   - [ ] Service `email-export.service.js`
   - [ ] Intégration juice (inline CSS)
   - [ ] Post-processing (variables, etc.)
   - [ ] Composant `ExportModal.vue`
   - [ ] Tests export

**Livrable Semaine 3 :** Template Badsender complet en GrapesJS avec multi-marque

---

### Phase 4 : Tests & Documentation (Semaine 4)

**Objectif :** Valider, tester, documenter

**Tâches :**
1. **Tests fonctionnels** (8h)
   - [ ] Checklist complète
   - [ ] Corrections bugs
   - [ ] Tests utilisateurs

2. **Tests email** (8h)
   - [ ] Export 3 marques
   - [ ] Test Outlook 2016
   - [ ] Test Outlook 365
   - [ ] Test Gmail Web
   - [ ] Test Gmail Mobile
   - [ ] Corrections si nécessaire

3. **Documentation** (12h)
   - [ ] `GRAPESJS_INTEGRATION.md`
   - [ ] Diagrammes architecture
   - [ ] Guide utilisateur
   - [ ] README mis à jour
   - [ ] Commentaires code

4. **Démo** (4h)
   - [ ] Créer template démo
   - [ ] Vidéo screencast
   - [ ] Screenshots
   - [ ] Rapport de POC

**Livrable Semaine 4 :** POC complet, testé, documenté

---

## 📊 Métriques de Succès du POC

### Critères Techniques

- ✅ **Coexistence** : 2 éditeurs fonctionnent sans conflit
- ✅ **Performance** : Chargement < 3s, sauvegarde < 1s
- ✅ **Blocs standards** : 6 blocs créés et fonctionnels
- ✅ **Template Badsender** : 6 blocs custom répliqués
- ✅ **Multi-marque** : 3 marques supportées via CSS Variables
- ✅ **Export HTML** : Compatible Gmail + Outlook
- ✅ **Tests** : 90% de la checklist passée

### Critères Fonctionnels

- ✅ **Utilisabilité** : Un utilisateur peut créer un template en < 10 min
- ✅ **Flexibilité** : Blocs custom ajoutables sans modifier le core
- ✅ **Maintenabilité** : Code documenté, architecture claire
- ✅ **Scalabilité** : Ajout de nouveaux blocs facile (< 2h par bloc simple)

### Critères Business

- ✅ **Validation métier** : Template developers valident la flexibilité
- ✅ **Décision GO/NO-GO** : Éléments suffisants pour décider de la suite
- ✅ **Roadmap** : Plan clair pour passer du POC à la production

---

## ⚠️ Risques et Mitigation

### Risques Techniques

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Conflit JavaScript Mosaico/GrapesJS | ÉLEVÉ | MOYENNE | Namespaces séparés, chargement conditionnel |
| Performance dégradée (templates lourds) | MOYEN | MOYENNE | Lazy loading blocs, optimisation JSON |
| Export HTML incompatible Outlook | ÉLEVÉ | FAIBLE | Tests précoces, utilisation de tables |
| CSS Variables non supportées emails | ÉLEVÉ | FAIBLE | Conversion en inline CSS à l'export |
| Complexité blocs multi-colonnes | MOYEN | ÉLEVÉE | Démarrer simple, complexifier progressivement |

### Risques Fonctionnels

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| UX moins bonne que Mosaico | ÉLEVÉ | MOYENNE | Tests utilisateurs, ajustements UI |
| Migration templates Mosaico→GrapesJS complexe | MOYEN | ÉLEVÉE | Hors scope POC, documenter limitations |
| Multi-marque insuffisant | MOYEN | FAIBLE | Validation précoce avec stakeholders |

---

## 🎯 Décisions Techniques Clés

### Décision 1 : Approche Multi-Marque

**Option choisie :** CSS Variables

**Justification :**
- ✅ Pas de duplication HTML (×3)
- ✅ Changement instantané
- ✅ Maintenable
- ⚠️ Suppose que différences = styles (à valider)

**Alternative rejetée :** Multi-Templates (3 templates séparés)

---

### Décision 2 : Storage des Blocs Standards

**Option choisie :** Fichier JSON côté serveur

**Justification :**
- ✅ Simple à maintenir
- ✅ Versionnable (Git)
- ✅ Pas besoin de DB pour blocs standards
- ✅ Hot-reload possible

**Alternative rejetée :** MongoDB (overkill pour blocs standards)

---

### Décision 3 : Coexistence Éditeurs

**Option choisie :** Champ `editor_type` dans DB + Router conditionnel

**Justification :**
- ✅ Pas de migration forcée
- ✅ Choix utilisateur
- ✅ Rollback facile si problème

**Alternative rejetée :** Migration automatique Mosaico→GrapesJS (trop risqué)

---

## 📚 Ressources et Documentation

### Documentation GrapesJS

- [GrapesJS Official Docs](https://grapesjs.com/docs/)
- [GrapesJS Newsletter Preset](https://github.com/artf/grapesjs-preset-newsletter)
- [GrapesJS API Reference](https://grapesjs.com/docs/api/)
- [GrapesJS Forum](https://github.com/artf/grapesjs/discussions)

### Tutoriels

- [Building an Email Builder with GrapesJS](https://medium.com/grapesjs/building-email-builder-with-grapesjs-93e9e7094d4f)
- [Custom Components in GrapesJS](https://grapesjs.com/docs/guides/Custom-components.html)
- [Email HTML Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)

### Outils

- [Juice (inline CSS)](https://github.com/Automattic/juice)
- [Cheerio (HTML parsing)](https://cheerio.js.org/)
- [Litmus (email testing)](https://www.litmus.com/)
- [Can I Email](https://www.caniemail.com/) - Support CSS dans emails

---

## 🤝 Communication et Suivi

### Points de Synchronisation

**Hebdomadaire :**
- Démo du travail de la semaine
- Revue des bloqueurs
- Ajustements si nécessaire

**Fin de POC :**
- Présentation complète
- Décision GO/NO-GO
- Roadmap suite si GO

### Livrables Intermédiaires

- **Semaine 1 :** API backend + sélecteur éditeur
- **Semaine 2 :** 6 blocs standards fonctionnels
- **Semaine 3 :** Template Badsender complet
- **Semaine 4 :** POC finalisé + documentation

---

## 🎬 Conclusion

Ce POC permettra de **valider la faisabilité technique** de l'intégration GrapesJS dans LePatron en 4 semaines. Les objectifs sont :

1. ✅ **Coexistence** : Mosaico et GrapesJS en parallèle
2. ✅ **Blocs standards** : Bibliothèque partagée
3. ✅ **Template custom** : Réplication Badsender
4. ✅ **Multi-marque** : Support 3 marques via CSS Variables
5. ✅ **Export HTML** : Compatible email (Gmail + Outlook)

**Effort estimé :** 4 semaines (128h)

**Critère de succès :** Template Badsender fonctionnel en GrapesJS, compatible avec 3 marques, exportable en HTML email.

**Next steps après POC :**
- Si GO : Migration progressive des templates existants
- Si NO-GO : Amélioration de l'éditeur Mosaico existant

---

**Questions ? Contactez l'équipe technique.**

**Bon développement ! 🚀**
