# AI Playground

> Dernière mise à jour : 2026-08-24 — intègre les correctifs de la passe de
> review (PR #1076).

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
  - **Filtre dynamique** — `expertiseFilter: { scope, categories, emailType, language }`.
    Le runner délègue à `expertiseRepo.findApplicable()` au moment de
    l'exécution. **`scope` ET `categories` sont tous deux obligatoires** pour
    que `findApplicable` matche : un filtre incomplet ne renvoie rien. L'UI
    pré-remplit `categories` avec la catégorie de la skill sélectionnée, et
    l'endpoint de preview répond 400 (jamais « 0 résultat ») sur un filtre
    incomplet — cette distinction est l'objet de
    `expertise-resolver.previewFilter()` vs `resolveExpertise()`.
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
- `status`, `output`, `errorMessage`, `latencyMs`, `tokenUsage` (dénormalisés depuis `AISkillInvocation`).
  `status` est **dérivé** de `InvocationStatuses` (`RunStatuses` dans
  `playground-constants.js`) : pas de copie d'enum à maintenir.
- `fieldErrors[]` — `{ field, issue }` quand la validation zod a échoué.
  Persisté : la réponse de l'`execute` et tous les GET ultérieurs du run
  portent la même information, et le libellé reste dans les locales
  (`aiPlayground.validation.*`), jamais en base.
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
- **Ordre des opérations** : résolution skill (refusée si la skill n'est pas
  `ACTIVE`) → résolution des expertises → composition de l'input →
  **pré-validation zod** → consommation du budget → appel provider →
  persistance du run. La pré-validation est avant le budget parce qu'un input
  que zod refuse ne déclenche aucun appel provider : il ne doit donc rien
  coûter. `invoke()` revalide de son côté.
- **Budget de test** : `MaxDailyPlaygroundRuns = 50`/jour
  (`ai-playground/services/test-budget.service.js`) ; épuisé → HTTP 429,
  affiché en clair dans l'UI. **Aucun compteur n'est exposé** : `consumeBudget`
  calcule bien `{ count, max, remaining }` mais le runner ne lit pas la valeur
  de retour, donc le budget ne se manifeste que par le 429. Volontaire tant que
  le compteur est par worker — afficher un chiffre reviendrait à afficher un
  chiffre faux (cf. §3 de l'issue ci-dessous).
  ⚠️ **Ce compteur est en mémoire, donc PAR WORKER.** Le pseudo-compte
  `config.admin` n'a pas de ligne `users` (cf. `userIdOf`), le service tombe
  toujours sur sa branche mémoire, et `packages/server/index.js` démarre un
  cluster de `WORKERS` process. Le plafond réel est donc `50 × WORKERS` par
  jour, remis à zéro à chaque deploy ou crash de worker. Suffisant pour stopper
  une boucle folle, ce n'est pas un plafond de coût fiable — cf.
  [issue #1086](https://github.com/Badsender-com/LePatron.email/issues/1086).
- **Timeout provider** : `PlaygroundTimeoutMs = 90 s`, passé explicitement à
  `invoke()` (dont le défaut, 30 s, est calibré pour une feature user-facing).
  C'est l'outil où l'on essaie de longs prompts exprès.
- **Contrat de sortie** : injecté automatiquement par le moteur de skills depuis
  `outputSchemaId`, avec mode natif `response_format: json_object` quand le
  provider le supporte — rien à configurer côté playground
  (cf. [AI_SKILL_AUTHORING.md](./AI_SKILL_AUTHORING.md)).

## Hiérarchie skill / expertise / instruction

Point acté en review (R-02), à connaître avant d'écrire une skill :
`prompt-builder.service.js` compose **deux** messages.

- **system** = `systemPrompt` + `skillBody` + contrat de sortie. La skill domine
  donc, par le rôle.
- **user** = le modèle d'entrée interpolé — instruction, contexte **et**
  expertises — encadré par des balises anti-injection à suffixe aléatoire.

Conséquence : **expertise et instruction utilisateur sont au même niveau.** Leur
poids relatif ne dépend que de l'ordre et de la formulation du modèle d'entrée,
choisis par l'auteur de la skill ; rien ne l'impose techniquement. La doctrine
interne (de confiance) est donc placée dans la même zone « quarantaine » que la
saisie utilisateur (non fiable). Acceptable tant que seul le playground
super-admin invoque — à revoir avant la première feature user-facing.

## `invocationSource: 'playground'`

Toute invocation produite par le runner porte `invocationSource: 'playground'` sur l'`AISkillInvocation`. Cette valeur fait partie des sources **non productives** (`NonProductiveSources` dans `invocation-log.service.js`) : elle est **exclue côté serveur** des analytics de l'onglet Invocations, sauf opt-in explicite via le switch "Inclure les invocations non productives".

## Rétention & purge

- Purge assurée par l'**index TTL** `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` sur `AIPlaygroundRun` — pas de job planifié, même mécanisme que `AISkillInvocation.expiresAt` et `translation-job.schema.js`.
- Fenêtre : `DefaultPlaygroundRunRetentionDays = 365` jours, `expiresAt` étant estampillé à la création (`run-retention.service.js`).
- Les **golden runs ne sont jamais purgés** : `markGolden` met `expiresAt` à `null`, `unmarkGolden` le recalcule depuis `createdAt` — une échéance déjà passée est rendue telle quelle, la suppression qui aurait dû avoir lieu est simplement rattrapée.
- Les runs écrits avant l'index (données de dev uniquement, la fonctionnalité n'est pas livrée) ont `expiresAt: null` et n'expirent donc jamais : pas de script de backfill, contrairement aux invocations.

## Endpoints REST

Tous sous `GUARD_ADMIN`, préfixe `/api/ai-playground` :

| Méthode | Route                            | Effet                                               |
| ------- | -------------------------------- | --------------------------------------------------- |
| GET     | `/scenarios`                     | liste paginée                                       |
| POST    | `/scenarios`                     | création                                            |
| GET     | `/scenarios/facets`              | valeurs distinctes `{ skillIds, tags }` des filtres |
| GET     | `/scenarios/:scenarioId`         | détail                                              |
| PATCH   | `/scenarios/:scenarioId`         | mise à jour                                         |
| DELETE  | `/scenarios/:scenarioId`         | suppression cascade des runs                        |
| POST    | `/scenarios/:scenarioId/execute` | exécute, crée Invocation + Run                      |
| GET     | `/scenarios/:scenarioId/runs`    | historique paginé                                   |
| GET     | `/preview-expertise-filter`      | preview count `findApplicable`                      |
| GET     | `/runs/:runId`                   | détail run                                          |
| PATCH   | `/runs/:runId/feedback`          | feedback rating/score/comment                       |
| POST    | `/runs/:runId/mark-golden`       | marque comme golden (exclusif)                      |
| POST    | `/runs/:runId/unmark-golden`     | retire le golden                                    |
| DELETE  | `/runs/:runId`                   | suppression (action ⋮ de la liste des runs)         |

`groupId` **n'est pas** lu dans le corps de `/execute` : il choisit
l'intégration — donc la clé API et le budget — d'un Group client, et aucune UI
ne le renseigne. Un override runtime est un sujet d'étape 2 et demandera une
whitelist.

Les filtres de liste (`skillId`, `tag`, `owner`, `search`, `status`,
`startedFrom`, `startedTo`) passent par `utils/query-scalars.js` : un opérateur
Mongo injecté depuis la query string (`?status[$ne]=`) répond 400.

## Dépendance `markdown-it`

Le rendu de la sortie (`bs-markdown-renderer.vue`) dépend de `markdown-it`,
déclaré en **version exacte `13.0.2`**. Deux contraintes qui se croisent, à
connaître avant tout bump :

- **plafond** : la 14.x est ESM-only et cette stack (Nuxt 2 / webpack 4) ne sait
  pas consommer les exports nommés de ses dépendances CJS (`entities`,
  `mdurl`) — le bundle client ne compile pas ;
- **plancher** : le correctif de la CVE-2022-21670 (ReDoS) est arrivé en 12.3.2,
  et ce composant rend précisément de la sortie LLM non maîtrisée avec
  `linkify: true`.

Donc : 13.x uniquement, jusqu'à une éventuelle migration webpack 5.

## Déploiement — migration obligatoire

`categories` est devenu **obligatoire** dans `expertiseFilter` pour que
`findApplicable` matche (cf. Concepts). Les scénarios créés avant ce changement
ont un filtre sans catégorie : ils cesseraient silencieusement de résoudre la
moindre expertise. À jouer **une fois par environnement**, après le déploiement :

```bash
node scripts/migrate-playground-filter-categories.js --dry-run   # planifie, n'écrit rien
node scripts/migrate-playground-filter-categories.js             # applique
```

Le script est idempotent (il ignore un scénario qui a déjà des `categories`) et
déduit la catégorie depuis la skill référencée ; il logge le **host** de la base,
jamais la chaîne de connexion. Un environnement sans scénario existant — un
déploiement neuf — n'a rien à jouer.

## Seed démo

```bash
node scripts/seed-playground-demo.js
```

Crée (ou met à jour) un scénario `demo-generic-text` sur la skill `generic.text` sans expertise.

## Tests

```bash
npx jest tests/server/ai-playground
```

Couvre : modèles (validation pinned version), resolver (3 modes + filtre vide

- preview), runner (path heureux, erreurs, budget non consommé sur input
  invalide, skill non-ACTIVE refusée, quota épuisé), service runs (mark/unmark
  golden exclusif), **rétention** (calcul d'`expiresAt` — la purge elle-même est
  un index TTL Mongo, pas un job planifié), routes (CRUD + execute + golden).

Côté UI, les helpers purs sont couverts à 100 % :

```bash
npx jest tests/ui/helpers
```
