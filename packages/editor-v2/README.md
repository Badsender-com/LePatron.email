# LePatron.email - Éditeur v2 (POC)

> POC d'un éditeur d'emails moderne basé sur Maizzle + Vue.js 3

## 🎯 Objectif

Valider techniquement un éditeur nouvelle génération qui :
- Remplace Knockout.js par Vue.js 3
- Utilise Maizzle pour le templating email
- Offre une réactivité temps réel avec rendu incrémental
- Permet aux intégrateurs de créer des composants HTML custom facilement

## 📁 Structure

```
editor-v2/
├── components/          # Composants Maizzle (HTML pur)
│   └── core/           # button, heading, container
├── design-systems/     # Configurations Design System
│   └── demo/
├── client/             # Frontend Vue.js 3 (éditeur UI)
│   └── src/
├── server/             # Backend API Node.js
│   ├── routes/
│   ├── controllers/
│   └── services/
└── saved-emails/       # Emails JSON (exemples)
```

## 🚀 Démarrage

### Installation

```bash
cd packages/editor-v2
yarn install
```

### Développement

```bash
# Backend uniquement
yarn dev:server

# Frontend uniquement (quand créé)
yarn dev:client

# Les deux en parallèle
yarn dev
```

Le backend API sera disponible sur http://localhost:3200

### Endpoints API

- `GET /health` - Health check
- `GET /` - Liste des endpoints
- `POST /api/v2/render/incremental` - Render email (à venir)
- `GET /api/v2/design-systems/:id` - Charger Design System (à venir)

## 📚 Documentation

- Architecture complète : `../../ARCHITECTURE-POC-EDITOR-V2.md`
- Plan de développement : `../../PLAN-DEVELOPPEMENT-POC.md`

## 🔧 Technologies

- **Frontend** : Vue 3, Vite, Pinia, Tailwind CSS
- **Backend** : Node.js, Express
- **Email Engine** : Maizzle 5.x
- **Cache** : Map (en mémoire) pour le POC

## 📊 État du Développement

### Phase 1 : Infrastructure ✅ (Jour 1 terminé)

- [x] Structure de fichiers créée
- [x] package.json et dépendances installées
- [x] Configuration Maizzle
- [x] Configuration Tailwind
- [x] Serveur Express basique fonctionnel
- [ ] Setup Frontend Vue.js (Jour 2)

### Phases Suivantes

- Phase 2 : Design System
- Phase 3 : Composants Maizzle
- Phase 4 : Backend Rendering Service
- Phase 5 : Frontend Éditeur Vue.js
- Phase 6 : Validation
- Phase 7 : Tests & Documentation

## ⚡ Performance Cibles

- Preview temps réel : **50-80ms** (avec cache)
- Render cold : **<200ms**
- Cache hit rate : **>80%**

## 📝 Notes

Ce POC est destiné à valider l'architecture auprès des développeurs de templates.
Il n'est pas prévu pour la production en l'état.

---

**Version** : 0.1.0
**Branche** : `claude/editor-v2-poc-011CUq113q3F8cNNWrGxbNhU`
