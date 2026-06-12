# AI Playground

> Dernière mise à jour : 2026-06-12 — reflète l'état final de la branche avant review.

Module super-admin permettant de composer, exécuter, sauvegarder et rejouer des **scénarios de test** combinant skill + expertises.

## Cas d'usage

- Itération rapide sur les prompts d'une skill ou d'une expertise.
- Validation d'une mise à jour de version d'expertise avant activation.
- Prototypage de futures features LePatron (sans toucher au code applicatif).
- Régression manuelle via les **golden runs** (référence stable par scénario).
- Delivery interne ad hoc (générer un résultat à partir d'un input figé).

## Concepts

### Scénario (`AIPlaygroundScenario`)

Configuration **réutilisable** comprenant :

- `skillRef` : skill ciblée + mode `active` ou `pinned` (`versionMajor[.versionMinor]`).
- Sélection d'expertises selon **trois modes** mutuellement exclusifs :
  - **Aucune** — `expertiseRefs: []` + `expertiseFilter: null`. Légitime ; warning info non bloquant.
  - **Sélection explicite** — `expertiseRefs[]` avec optionally `mode: 'pinned'` + version.
  - **Filtre dynamique** — `expertiseFilter: { scope, emailType, language }`. Le runner délègue à `expertiseRepo.findApplicable()` au moment de l'exécution.
- `input` (objet libre, passé tel quel à la skill).
- Champs **dormants par design** (aucune UI ne les expose en v1, cf. annotations
  `// Réservé étape N` dans `ai-playground-scenario.schema.js`) :
  - `providerOverride` — réservé étape 3 (mode benchmark). Le runner le
    transmet en enveloppe forward-compat dans `options.providerOverride`, mais
    le provider effectif vient toujours de l'Integration moteur du Group.
  - `groupContext` — réservé étape 2 (sélecteur de Group). S'il est vide, le
    runner retombe sur le **Group plateforme** (`Group.isPlatform`).

### Run (`AIPlaygroundRun`)

Snapshot **complet et reproductible** d'une exécution :

- `composedInput` — l'input final passé à la skill, **bodies d'expertise inlinés**.
- `resolvedExpertise[]` — refs légères `{ expertiseId, versionMajor, versionMinor }`.
- `status`, `output`, `error`, `latencyMs`, `tokenUsage` (dénormalisés depuis `AISkillInvocation`).
- `_invocation` — lien vers l'invocation source.
- `feedback` (rating + score + comment), indépendant du feedback `AISkillInvocation`.
- `isGolden` — un seul golden actif par scénario (index unique partial Mongo).

## Composition de l'input (v1)

Le runner **n'auto-injecte qu'un seul champ** dans `composedInput` : `expertise` (les bodies + exemples des expertises résolues). Tous les autres champs (`brandVoice`, `brief`, `userInput`, etc.) restent dans `scenario.input` et sont saisis manuellement.

Principe : _le playground orchestre, la skill est une fonction pure de son input._ Toute future auto-injection (ex. brand voice du Group) devra être **explicite et nommée** dans la config du scénario, jamais une convention cachée.

## Exécution

- **Résolution du Group** : `groupId` runtime > `scenario.groupContext` > Group
  plateforme (`yarn flag-platform-group` ou bouton sur /groups). Le moteur
  (Integration, modèle) vient de la config "Fonctionnalités IA" de ce Group.
- **Budget de test** : l'exécution consomme le budget quotidien admin partagé
  (`test-budget.service.js`, `MaxDailyTestInvocations`) ; épuisé → HTTP 429,
  affiché en clair dans l'UI.
- **Contrat de sortie** : injecté automatiquement par le moteur de skills depuis
  `outputSchemaId`, avec mode natif `response_format: json_object` quand le
  provider le supporte — rien à configurer côté playground
  (cf. [AI_SKILL_AUTHORING.md](./AI_SKILL_AUTHORING.md)).

## `featureType: 'playground'`

Toute invocation produite par le runner porte `featureType: 'playground'` sur l'`AISkillInvocation`. Cette valeur est **exclue par défaut** des analytics de l'onglet Invocations (cf. toggle "Inclure admin-test / playground" dans `BsAiInvocationsTab.vue`).

## Rétention & purge

- `purge-playground-runs.job.js` tourne via Agenda à **4h UTC** chaque jour.
- Fenêtre : `DefaultPlaygroundRunRetentionDays = 365` jours.
- Filtre : `createdAt < cutoff && isGolden !== true` — les **golden runs ne sont jamais purgés**.

## Endpoints REST

Tous sous `GUARD_ADMIN`, préfixe `/api/ai-playground` :

| Méthode | Route                            | Effet                          |
| ------- | -------------------------------- | ------------------------------ |
| GET     | `/scenarios`                     | liste paginée                  |
| POST    | `/scenarios`                     | création                       |
| GET     | `/scenarios/:scenarioId`         | détail                         |
| PATCH   | `/scenarios/:scenarioId`         | mise à jour                    |
| DELETE  | `/scenarios/:scenarioId`         | suppression cascade des runs   |
| POST    | `/scenarios/:scenarioId/execute` | exécute, crée Invocation + Run |
| GET     | `/scenarios/:scenarioId/runs`    | historique paginé              |
| GET     | `/preview-expertise-filter`      | preview count `findApplicable` |
| GET     | `/runs/:runId`                   | détail run                     |
| PATCH   | `/runs/:runId/feedback`          | feedback rating/score/comment  |
| POST    | `/runs/:runId/mark-golden`       | marque comme golden (exclusif) |
| POST    | `/runs/:runId/unmark-golden`     | retire le golden               |
| DELETE  | `/runs/:runId`                   | suppression                    |

## Seed démo

```bash
node scripts/seed-playground-demo.js
```

Crée (ou met à jour) un scénario `demo-generic-text` sur la skill `generic.text` sans expertise.

## Tests

```bash
npx jest tests/server/ai-playground
```

Couvre : modèles (validation pinned version), resolver (3 modes + filter vide), runner (path heureux + erreurs), service runs (mark/unmark golden exclusif), job purge (exclut golden + fenêtre), routes (CRUD + execute + golden).
