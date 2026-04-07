# Review Critique : WYSIWYG Block Builder

> **Branche** : `WYSIWYG-block-builder` > **Date de review** : 20 mars 2026
> **Reviewer** : Claude (AI)
> **Statut** : POC fonctionnel, non production-ready

---

## 1. User Stories - Objectifs de la fonctionnalité (RÉVISÉES)

> **IMPORTANT** : Les US ci-dessous remplacent la vision initiale "modale" par une approche **édition inline** qui préserve le contexte utilisateur.

### US-1 : Insertion d'un bloc personnalisable

**En tant qu'** utilisateur de l'éditeur
**Je veux** glisser-déposer un bloc "Custom" depuis la toolbox vers mon email
**Afin de** créer un bloc à ma convenance **sans quitter le canvas**

**Critères d'acceptation :**

- [ ] Un nouveau type de bloc "Custom" apparaît dans la toolbox
- [ ] Je peux le glisser-déposer entre mes autres blocs
- [ ] Le bloc s'insère avec un état initial (structure par défaut)
- [ ] **Je reste sur le canvas principal, pas de fenêtre modale**

### US-2 : Édition inline du bloc custom

**En tant qu'** utilisateur
**Je veux** éditer mon bloc custom directement dans le canvas
**Afin de** voir comment il s'intègre avec les blocs environnants

**Critères d'acceptation :**

- [ ] Quand je sélectionne le bloc, le panneau de propriétés affiche ses options
- [ ] Je peux modifier la structure (colonnes) via le panneau
- [ ] Je peux ajouter/supprimer des éléments via le panneau
- [ ] Les modifications sont visibles en temps réel dans le canvas
- [ ] **Je vois toujours les blocs au-dessus et en-dessous**

### US-3 : Panneau d'édition adapté

**En tant qu'** utilisateur
**Je veux** un panneau de propriétés riche pour mon bloc custom
**Afin d'** avoir accès à toutes les options de personnalisation

**Critères d'acceptation :**

- [ ] Section "Structure" : choix du layout (1-4 colonnes)
- [ ] Section "Éléments" : liste avec drag-and-drop interne
- [ ] Section "Style" : background, padding, border-radius
- [ ] Clic sur un élément → ses propriétés s'affichent

### US-4 : Ajout d'éléments

**En tant qu'** utilisateur
**Je veux** ajouter des éléments (texte, image, bouton...) dans mon bloc
**Afin de** composer le contenu

**Critères d'acceptation :**

- [ ] Boutons "+ Texte", "+ Image", "+ Bouton", etc. dans le panneau
- [ ] L'élément s'ajoute dans la colonne sélectionnée
- [ ] Réordonnancement par drag-and-drop
- [ ] Suppression d'un élément

### US-5 : Édition des éléments

**En tant qu'** utilisateur
**Je veux** éditer chaque élément de mon bloc
**Afin de** personnaliser le contenu et le style

**Critères d'acceptation :**

- [ ] **Texte** : éditeur riche OU textarea HTML
- [ ] **Image** : URL, alt text, lien optionnel, largeur
- [ ] **Bouton** : texte, URL, couleurs, border-radius
- [ ] **Espacement** : hauteur en pixels
- [ ] **Séparateur** : hauteur, couleur, style

### US-6 : Sauvegarde automatique

**En tant qu'** utilisateur
**Je veux** que mes modifications soient sauvegardées automatiquement
**Afin de** ne pas perdre mon travail

**Critères d'acceptation :**

- [ ] Chaque modification met à jour le HTML généré
- [ ] Le bloc est sauvegardé avec le mailing
- [ ] Pas de bouton "Terminer" spécifique - c'est inline

### US-7 : Blocs personnels réutilisables (MVP)

**En tant qu'** utilisateur avancé
**Je veux** sauvegarder un bloc custom comme modèle réutilisable
**Afin de** le réutiliser dans mes prochains emails

**Critères d'acceptation :**

- [ ] Bouton "Sauvegarder comme bloc perso" dans le panneau
- [ ] Le bloc apparaît dans l'onglet "Blocs perso" de la toolbox
- [ ] Glisser-déposer depuis la liste des blocs perso

---

---

## Problème majeur identifié : L'approche modale

L'implémentation actuelle ouvre une **fenêtre modale** pour composer un nouveau bloc. Cela pose des problèmes fondamentaux :

| Problème                | Impact                                                     |
| ----------------------- | ---------------------------------------------------------- |
| **Perte de contexte**   | L'utilisateur ne voit plus les blocs au-dessus/en-dessous  |
| **Rupture du workflow** | "Sortir" de l'interface habituelle = discontinuité         |
| **Incohérence UX**      | Les autres blocs s'éditent inline, pourquoi pas celui-ci ? |

**Conséquence** : L'approche modale doit être abandonnée au profit d'une **édition inline** dans le canvas Mosaico.

---

## 2. État de l'implémentation

### Ce qui fonctionne

| Fonctionnalité        | Statut | Qualité                                      |
| --------------------- | ------ | -------------------------------------------- |
| Interface de création | OK     | Bonne UX, cohérente                          |
| Structures colonnes   | OK     | 6 layouts disponibles                        |
| Éléments de base      | OK     | Texte, Image, Bouton, Espacement, Séparateur |
| Drag-and-drop         | OK     | Fluide (vuedraggable)                        |
| Preview temps réel    | OK     | Rendu fidèle                                 |
| Génération HTML       | OK     | Compatible email                             |
| Intégration Mosaico   | OK     | customBlock type enregistré                  |

### Ce qui ne fonctionne PAS

| Fonctionnalité                 | Statut                  | Impact                      |
| ------------------------------ | ----------------------- | --------------------------- |
| **Édition de blocs existants** | NON IMPLÉMENTÉ          | Bloquant                    |
| Éditeur de texte riche         | NON                     | Textarea simple seulement   |
| Validation des entrées         | NON                     | Risque de données invalides |
| Tests automatisés              | AUCUN                   | Risque de régression        |
| API serveur                    | CRÉÉE MAIS NON UTILISÉE | Code mort                   |

### Captures d'écran analysées

**Screenshot 1 - Toolbox** :

- Onglets "Blocs template" / "Blocs perso" visibles
- Bouton "+ Nouveau bloc" avec design gradient
- Liste de blocs existants (cover_promo, articles_confidentiels, etc.)
- **Observation** : Les labels de blocs apparaissent en double (bug d'affichage ?)

**Screenshot 2 - Block Builder** :

- Interface "Créer un nouveau bloc" propre
- Structures colonnes bien présentées
- Éléments avec icônes clairs
- Canvas avec état vide explicite
- Panel de propriétés à droite
- **Observation** : UX cohérente avec le reste de l'application

---

## 3. Analyse technique critique

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ARCHITECTURE                          │
├─────────────────────────────────────────────────────────┤
│  Vue Components          Knockout/Mosaico               │
│  ┌──────────────┐       ┌─────────────────┐            │
│  │ BlockBuilder │ ←───→ │ viewModel       │            │
│  │ Canvas       │       │ (observables)   │            │
│  │ Toolbox      │       │                 │            │
│  │ PropertyPanel│       │ blocks[]        │            │
│  └──────────────┘       └─────────────────┘            │
│         │                       │                       │
│         ▼                       ▼                       │
│  ┌──────────────┐       ┌─────────────────┐            │
│  │ htmlGenerator│       │ checkmodel.js   │            │
│  │ (client)     │       │ wrapper.js      │            │
│  └──────────────┘       └─────────────────┘            │
│                                                         │
│  ─────────────────── INUTILISÉ ───────────────────     │
│  ┌─────────────────────────────────────────────┐       │
│  │ Server: block-definition (CRUD API)          │       │
│  │ - schema, controller, service, routes        │       │
│  │ - html-generator.service.js                  │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Problème majeur** : L'API serveur a été créée mais n'est pas utilisée. Le bloc est stocké uniquement dans le JSON du mailing, pas en base de données. La fonctionnalité "Blocs perso" (US-3) n'existe donc pas vraiment.

### Problèmes de sécurité

| Sévérité     | Problème                  | Fichier            | Ligne |
| ------------ | ------------------------- | ------------------ | ----- |
| **CRITIQUE** | XSS dans génération texte | `htmlGenerator.js` | 161   |
| Moyenne      | Pas de validation URL     | `PropertyPanel.js` | -     |
| Basse        | Console.log en prod       | Partout            | -     |

**Vulnérabilité XSS** :

```javascript
// Client (DANGEREUX)
return `<div style="...">${content}</div>`;

// Serveur (CORRECT)
return `<div style="...">${escapeHtml(content)}</div>`;
```

Un utilisateur peut injecter `<script>` ou `<img onerror="">` dans le contenu texte.

### Dette technique

| Problème                               | Impact          | Effort correction |
| -------------------------------------- | --------------- | ----------------- |
| Deux générateurs HTML non synchronisés | Bugs potentiels | 2h                |
| Fuite mémoire (subscriptions Knockout) | Performance     | 1h                |
| Labels français hardcodés              | i18n cassée     | 2h                |
| Pas de gestion d'erreurs               | UX dégradée     | 4h                |
| Pas de tests                           | Régressions     | 8h+               |

---

## 4. Ce que j'aurais fait différemment

### 4.1 Architecture

**Actuel** : Mélange Vue + Knockout avec pont manuel
**Recommandé** :

```javascript
// Option A : Tout en Vue avec state management
// Utiliser Pinia/Vuex au lieu de prop drilling
const useBlockBuilderStore = defineStore('blockBuilder', {
  state: () => ({ rows: [], selectedElement: null }),
  actions: { addRow(), removeRow(), updateElement() }
});

// Option B : Garder Knockout mais isoler le pont
// Un seul fichier bridge.js pour la communication
```

### 4.2 Générateur HTML

**Actuel** : Deux générateurs indépendants (client + serveur)
**Recommandé** :

```javascript
// Un seul module partagé
// packages/shared/html-generator.js
// Importé côté client ET serveur
export function generateBlockHtml(blockData, options) {
  // ...
}
```

### 4.3 Sauvegarde des blocs

**Actuel** : Bloc stocké dans le JSON du mailing uniquement
**Recommandé** :

```
1. Créer un bloc → Générer ID unique
2. Sauvegarder définition en BDD (API existe déjà!)
3. Stocker uniquement la référence dans le mailing
4. Permettre la réutilisation via l'onglet "Blocs perso"
```

### 4.4 Édition de texte

**Actuel** : Textarea simple
**Recommandé** :

Intégrer TinyMCE (déjà utilisé par Mosaico) pour l'édition de texte riche :

- Gras, italique, liens
- Cohérence avec l'éditeur principal

---

## 5. Verdict : Reprendre à zéro ou adapter ?

### Analyse du code réutilisable

| Composant               | Réutilisable ?   | Effort |
| ----------------------- | ---------------- | ------ |
| `htmlGenerator.js`      | OUI (fix XSS)    | 1h     |
| `blockBuilderStore.js`  | OUI              | 0h     |
| `PropertyPanel.js`      | PARTIELLEMENT    | 4h     |
| `block-builder.css`     | OUI              | 1h     |
| `BlockBuilderCanvas.js` | NON (modale)     | -      |
| `BuilderToolbox.js`     | NON (modale)     | -      |
| Server API              | OUI (inutilisée) | 2h     |

### Estimation effort

| Approche            | Effort         | Risque     |
| ------------------- | -------------- | ---------- |
| Reprendre à zéro    | 10-15 jours    | Moyen      |
| **Adapter le code** | **7-10 jours** | **Faible** |

---

## 6. Recommandation finale

### VERDICT : ADAPTER le code existant

**~40% du code est réutilisable** directement. Seule l'intégration modale doit être remplacée par une intégration inline.

### Roadmap d'adaptation

#### Phase 1 : Corrections critiques (1 jour)

| Tâche                         | Priorité | Effort |
| ----------------------------- | -------- | ------ |
| Fix XSS (escapeHtml)          | P0       | 30min  |
| Supprimer console.log         | P1       | 1h     |
| Synchroniser générateurs HTML | P1       | 2h     |

#### Phase 2 : Refonte intégration inline (3-4 jours)

| Tâche                                         | Priorité | Effort |
| --------------------------------------------- | -------- | ------ |
| Nouveau template Knockout pour customBlock    | P0       | 1j     |
| Adaptation PropertyPanel dans panneau Mosaico | P0       | 1j     |
| Binding Knockout ↔ données bloc               | P0       | 1j     |
| Régénération HTML temps réel                  | P0       | 4h     |

#### Phase 3 : Blocs personnels - US-7 (2-3 jours)

| Tâche                           | Priorité | Effort |
| ------------------------------- | -------- | ------ |
| Connecter API serveur existante | P0       | 4h     |
| UI "Blocs perso" dans toolbox   | P0       | 1j     |
| Sauvegarde/chargement blocs     | P0       | 4h     |

#### Phase 4 : Finalisation (2 jours)

| Tâche                              | Priorité | Effort |
| ---------------------------------- | -------- | ------ |
| Tests manuels cross-browser        | P1       | 4h     |
| Validation emails (Outlook, Gmail) | P1       | 4h     |
| Gestion d'erreurs                  | P2       | 4h     |
| Documentation                      | P2       | 2h     |

---

## 7. Tableau de synthèse

| Critère              | Score | Commentaire                    |
| -------------------- | ----- | ------------------------------ |
| **Architecture**     | 6/10  | Fonctionnelle mais hybride     |
| **Code Quality**     | 5/10  | XSS, console.log, pas de tests |
| **Fonctionnalité**   | 5/10  | Création OK, édition manquante |
| **Intégration**      | 7/10  | Bonne intégration Mosaico      |
| **UX**               | 8/10  | Interface claire et intuitive  |
| **Production-ready** | 3/10  | POC, pas prêt pour prod        |

**Score global : 5.7/10**

---

## 8. Décisions prises

1. **Blocs perso (US-7)** : INCLUS dans le MVP - l'API serveur existante sera connectée

2. **Approche modale** : ABANDONNÉE - remplacée par édition inline

3. **Code existant** : ADAPTER (~40% réutilisable) plutôt que reprendre à zéro

4. **Estimation** : 7-10 jours pour la refonte complète

---

## 9. Prochaines étapes

1. Fix XSS critique dans `htmlGenerator.js`
2. Créer nouveau template Knockout pour l'édition inline
3. Adapter PropertyPanel pour le panneau Mosaico
4. Connecter API blocs personnels

---

## 10. Conventions projet à respecter

### AGENTS.md - Règles strictes

| Règle                       | Détail                                       |
| --------------------------- | -------------------------------------------- |
| **Fichiers < 300 lignes**   | Splitter les fichiers trop longs             |
| **Logger, pas console.log** | `const logger = require('../utils/logger')`  |
| **ERROR_CODES**             | Utiliser les constantes de `error-codes.js`  |
| **Anglais pour le code**    | Français uniquement dans i18n                |
| **Tests obligatoires**      | Ajouter tests pour nouvelles fonctionnalités |
| **Lint avant commit**       | `yarn code:lint && yarn code:fix`            |

### Design System - UI/UX

| Règle             | Exemple                                            |
| ----------------- | -------------------------------------------------- |
| **Vuetify First** | `<v-btn>` pas `<button>`                           |
| **Icon + Text**   | `<v-btn><v-icon left>mdi-plus</v-icon>Add</v-btn>` |
| **MDI icons**     | `mdi-*` (pas Font Awesome)                         |
| **Vuelidate**     | Validation formulaires                             |
| **ARIA labels**   | Accessibilité                                      |
| **CSS Variables** | Theming white-label                                |

### Editor Stack

| Règle           | Détail                                     |
| --------------- | ------------------------------------------ |
| **Extensions**  | Fichiers dans `/src/js/ext/badsender-*.js` |
| **Traductions** | `viewModel.t('key')`                       |
| **Styles**      | Variables LESS de `style_variables.less`   |

---

_Review générée le 20 mars 2026 - Mise à jour avec direction inline et conventions projet_
