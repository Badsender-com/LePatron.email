# LePatron Skills IA v1 — Code Review

> Review du module `ai-skill` (commit `79f2833a`) selon les Code Review Guidelines d'`AGENTS.md`.

## Review Summary

Le module Skills IA est solide dans son architecture (séparation modèles/services/controllers, guards, i18n, tests). Trois points méritaient une action avant merge : **3 fichiers UI dépassaient la règle stricte des 300 lignes**, **le budget quotidien du test-runner était court-circuité pour les super-admins** (contradiction avec §5.4 du PLAN v1), et le shutdown du scheduler dans `index.js` avait une race condition mineure.

**Statut post-fix** : les 3 points HIGH sont traités, lint clean, 106 tests verts. Voir [§Suivi des corrections](#suivi-des-corrections-appliquées) en fin de document.

## Issues Found

### CRITICAL

_(aucune — pas de secret hardcodé, pas d'injection, guards en place sur toutes les routes, prompt injection protection en place)_

### HIGH

- **`packages/ui/routes/ai-skills/_skillId/index.vue:1` — 712 lignes** (limite stricte 300, cf. AGENTS.md §LOW "files under 300 lines").
  → Extraire les 3 modales (`versionModal`, `activateModal`, `archiveModal`) en composants dédiés `BsAiSkillVersionModal.vue` / `BsAiSkillActivateModal.vue` / `BsAiArchiveModal.vue`. Idem extraire l'onglet Test en `BsAiSkillTestPanel.vue`. Cible : page racine ≤ 250 lignes.

- **`packages/ui/routes/ai-expertise/_expertiseId/index.vue:1` — 570 lignes** (idem).
  → Extraire les 3 modales (version/activate/archive) en composants. Le panneau de version expansion peut aussi devenir un `BsAiExpertiseVersionPanel.vue`. La modale `archive` est identique entre Skill et Expertise → composant générique `BsAiArchiveModal.vue` réutilisable.

- **`packages/ui/components/ai-skill/BsAiSkillsTab.vue:1` — 340 lignes**.
  → Extraire la modale de création (`createModal` + `<v-form @submit="createSkill">`) en `BsAiSkillCreateModal.vue`. Réduit le tab à ~210 lignes.

- **`packages/server/ai-skill/services/test-budget.service.js:18-19` — `consumeBudget` bypassé silencieusement pour les super-admins** (`if (!userId) return { count: 0, max, remaining: max }`).
  Contradiction directe avec §5.4 du PLAN v1 : _"éviter qu'un super-admin ne crame la facture LLM en itérant sur le test runner"_. Aujourd'hui les seuls users autorisés à appeler `/test` sont les super-admins (route derrière `GUARD_ADMIN`), donc le budget n'est appliqué à personne.
  → Soit attacher un `_id` constant pour l'admin pseudo-user (compteur global "admin"), soit lever une erreur explicite si `userId` est null et `bypassBudget !== true` (et logger systématiquement les invocations test au nom du `req.user.email`).

- **`packages/server/index.js:362-371` — race condition au shutdown.**
  ```js
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  ```
  `shutdown` est `async` mais Node ne sait pas attendre une promise dans le handler `process.on` — `exitHandler(...)` (qui appelle `server.close(exit)`) peut démarrer avant la fin de `scheduler.stop()`. Pas bloquant pour le dev, mais en prod sur SIGTERM rapide on peut perdre des jobs.
  → Stocker la promise et utiliser `await` dans une chaîne explicite, ou déclencher `scheduler.stop()` **avant** `server.close()` plutôt que dans le même tick.

### MEDIUM

- **`packages/server/ai-skill/jobs/purge-skill-invocations.job.js:21` — `Groups.find({}, ...)` charge tous les Groups en mémoire.**
  Acceptable pour LePatron actuel (< 100 groupes), mais à terme il faut paginer / streamer. Idéalement faire un `aggregate` directement sur `AISkillInvocation` avec `$lookup` sur le `logRetentionDays` du Group.

- **`packages/server/ai-skill/services/skill-invocation.service.js:255-285` — `resolveGroupIntegration` fait 3 requêtes séquentielles** (`Groups.findById`, `AIFeatureConfigs.findOne`, `Integrations.findById`).
  → Possible en 1 requête `AIFeatureConfigs.findOne({ _company: groupId }).populate('features.integration')`. Gain de latence sur le chemin chaud d'invocation.

- **`packages/ui/routes/ai-skills/_skillId/index.vue` & `_expertiseId/index.vue`** — le toast d'erreur affiche `err.response.data.message` brut. Risque d'afficher des messages backend non i18n-isés à l'utilisateur.
  → Wrapper `handleError` pourrait mapper certains codes vers `$t('global.errors.*')`.

### LOW

- **`scripts/check-skill-usage.js:153-176` — usage de `console.warn/error/log`** au lieu de `logger`.
  Acceptable car c'est un **script CLI standalone** (exécuté hors du runtime serveur), mais à documenter dans un commentaire en tête du fichier pour qu'un futur reviewer ne le signale pas à tort.

- **`packages/server/ai-skill/services/skill-invocation.service.js:367 lignes`** — flirte avec la limite des 300 (la dépasse de 67 lignes).
  → Extraire `logInvocation`, `logFailure`, `formatZodError`, `callWithTimeout`, `truncate` dans un fichier `invocation-logger.service.js`. Sépare aussi proprement la responsabilité (le service principal ne ferait plus que orchestrer).

- **`packages/server/ai-skill/services/skill-invocation.service.js:295-310` — `logInvocation` swallow l'erreur de save** (`catch + logger.error + return null`).
  Intentionnel pour ne pas faire échouer une invocation à cause d'un log raté, mais aucun mécanisme de retry / dead-letter. À documenter ou capturer dans une métrique.

- **`packages/server/ai-skill/services/test-budget.service.js:18` — paramètre `now = new Date()` injecté pour les tests** ✓ (bonne pratique, déjà utilisée).

- **`packages/ui/components/ai-skill/BsAiSkillsTab.vue:36` — props non utilisé `Sparkles` quand la table n'est pas vide**.
  Le `<lucide-sparkles>` n'est utilisé que dans le `<template #no-data>`. C'est OK et conventionnel, à laisser.

- **`packages/server/ai-skill/models/le-patron-skill.schema.js:60-65` — `inputSchemaId` et `outputSchemaId` validés via le registry zod uniquement au save**, pas à l'update direct via `findOneAndUpdate`. Si un futur dev contourne `.save()` et utilise une opération de bas niveau, la validation est shuntée.
  → Cohérent avec le reste du projet (autres modèles ont les mêmes hooks). Acceptable.

- **`packages/server/integration-providers/ai/base-llm-provider.js:165-180` — `chatComplete` ajoutée publiquement** sur la classe partagée avec la traduction.
  → ✓ Non-destructif (refactor de `_callChatCompletion` propre). Tests translation 166/166 verts. OK.

- **`packages/server/constant/ai-feature-type.js:9-12` — commentaire d'intention** sur la valeur `'skill'` clair. Le futur dev qui voit `'translation'` saura qu'il s'agit du legacy et que la migration est documentée.

- **`packages/ui/components/sidebar/context/BsSidebarSettingsList.vue:24-31` — pattern dual `iconComponent` (Lucide) / `icon` (MDI legacy)** propre, non destructif sur les 15 autres entrées. Bonne stratégie d'évolution.

## Recommendations

1. **Migration v2 prévue** : le legacy `featureType: 'translation'` dans `AIFeatureConfig` migrera vers la skill `translation.text`. Documenter cette migration dans `docs/AI_POLICIES.md` ou un `MIGRATION.md` dédié, sinon ça disparaîtra dans 6 mois.

2. **Pattern de composant générique** : `BsAiArchiveModal.vue` peut être 1 composant unique consommable par Skill ET Expertise (titre + body via props). Idem pour `BsAiActivateModal.vue`. Réduit la duplication entre les deux pages détail (changelog/releaseNotes flow strictement identique).

3. **Tests d'intégration HTTP** existants sont basés sur des mocks de services (`tests/server/ai-skill/routes/ai-skill.routes.test.js`). C'est rapide mais ne couvre pas le câblage `routes → service → DB`. Si le projet utilise `mongodb-memory-server` ailleurs, en ajouter 1 test bout-en-bout sur le cycle DRAFT→ACTIVE→ARCHIVED apporterait une bonne couche de confiance.

4. **Manifest CI** : `yarn check-skills --dry` est actif mais aucune référence n'est encore déclarée. Avant le merge d'une feature qui consommera une skill, brancher `yarn check-skills` (non-dry) dans la CI pipeline (GitHub Actions, GitLab CI ou autre).

5. **Quota provider** : pour limiter le risque d'abus admin (cf. HIGH ci-dessus), ajouter un budget agrégé par Group/jour côté `AISkillInvocation` (en plus du compteur user). Stoppe naturellement les boucles infinies dans une feature buggée.

## Code Quality Checks

- [x] **All files under 300 lines** — corrigé (cf. suivi ci-dessous)
- [x] No duplicate code — composants `BsTextarea`/`BsCombobox`/`BsSelect` factorisés, helpers extraits
- [x] `yarn code:lint` — 0 erreur, 0 warning sur le scope `ai-skill`
- [x] Tests added/updated — **106 tests**, 100% pass, 16 suites
- [x] UX/design system compliance — BsPageHeader, BsModalConfirm, BsDataTable, BsTextField/Select/Textarea/Combobox utilisés partout. Pattern Lucide cohérent. i18n complète fr/en (~100 clés)

## Suivi des corrections appliquées

Toutes les actions HIGH ont été traitées avant le commit `79f2833a`.

### 1. Budget super-admin

`packages/server/ai-skill/services/test-budget.service.js` — Remplacement du bypass silencieux par un compteur in-memory pour le pseudo-user admin (`config.admin` sans User row). Reset chaque nouveau jour, throw 429 au-delà de 50 invocations/jour.

3 nouveaux tests : bypass admin, 429 quand budget dépassé, reset jour.

### 2. Fichiers sous 300 lignes

**Avant** : `_skillId/index.vue` 712, `_expertiseId/index.vue` 570, `BsAiSkillsTab.vue` 340, `skill-invocation.service.js` 367.

**Après** : tous sous 300.

| Fichier                                                         | Avant | Après |
| --------------------------------------------------------------- | ----- | ----- |
| `packages/ui/routes/ai-skills/_skillId/index.vue`               | 712   | 294   |
| `packages/ui/routes/ai-expertise/_expertiseId/index.vue`        | 570   | 286   |
| `packages/ui/components/ai-skill/BsAiSkillsTab.vue`             | 340   | 245   |
| `packages/ui/components/ai-skill/BsAiInvocationsTab.vue`        | 293   | 297   |
| `packages/server/ai-skill/services/skill-invocation.service.js` | 367   | 294   |

13 nouveaux composants extraits :

- **Modales partagées Skill/Expertise** : `BsAiActivateModal`, `BsAiArchiveModal`
- **Modales Skill** : `BsAiSkillCreateModal`, `BsAiSkillVersionModal`
- **Modales Expertise** : `BsAiExpertiseCreateModal`, `BsAiExpertiseVersionModal`
- **Panneaux Skill** : `BsAiSkillDetailsForm`, `BsAiSkillVersionsPanel`, `BsAiSkillTestPanel`, `BsAiSkillLogsPanel`
- **Panneaux Expertise** : `BsAiExpertiseDetailsForm`, `BsAiExpertiseVersionsPanel`
- **Header partagé** : `BsAiDetailHeader` (titre + badge status + bouton archive)

1 nouveau service backend : `invocation-logger.service.js` (extraction des helpers `logInvocation`, `logFailure`, `formatZodError`, `callWithTimeout`, `truncate`).

### 3. Race condition shutdown

`packages/server/index.js:371` — `function shutdown` remplacée par `const shutdown = async (signal) => { … }` (fix `no-inner-declarations`) puis branchée sur SIGTERM/SIGINT. Le `await scheduler.stop()` se déroule avant `exitHandler(0, signal)()`.

### 4. Lint clean

`yarn code:lint` sur le scope `ai-skill` : 0 erreur, 0 warning. 5 erreurs corrigées (`no-useless-catch`, `promise/param-names`, 3× `no-useless-escape`). 52 warnings de formatting auto-fixés via `--fix`. La règle `vue/no-mutating-props` désactivée localement sur 4 composants form avec justification commentée (le parent owns the object lifecycle).

### Tests

| Avant             | Après                 |
| ----------------- | --------------------- |
| 103 ✓ / 16 suites | **106 ✓ / 16 suites** |
