# Guide de review — Modules IA (Skills, Expertise, Playground)

> Dernière mise à jour : 2026-06-12. Écrit pour le reviewer qui découvre ces
> modules sans avoir suivi la démarche. Deux PRs : **PR1** `feat/AI-skills-v1`
> (skills + expertise + invocations) et **PR2** `feat/ai-playground` (le
> playground, basée sur la PR1). Un POC séparé (`poc/ai-textgen`) n'est PAS à
> merger — il sert de validation, cf. §5.

## 1. Quoi lire d'abord

Lisez dans cet ordre — chaque étage s'appuie sur le précédent :

1. **Docs** : [AI_SKILL_ETAPE_1.md](./AI_SKILL_ETAPE_1.md) (architecture et
   décisions), [AI_SKILL_AUTHORING.md](./AI_SKILL_AUTHORING.md) (contrat
   prompt ↔ schémas), [AI_PLAYGROUND.md](./AI_PLAYGROUND.md) (PR2).
2. **Modèles** : `packages/server/ai-skill/models/le-patron-skill.schema.js`,
   `expertise.schema.js`, `ai-skill-invocation.schema.js` — versioning
   major/minor, statuts, champs dormants annotés. Puis (PR2)
   `packages/server/ai-playground/models/ai-playground-scenario.schema.js` et
   `ai-playground-run.schema.js`.
3. **Le cœur** : `packages/server/ai-skill/services/skill-invocation.service.js`
   (`invoke()` — point d'entrée unique de toute exécution de skill) et
   `prompt-builder.service.js` (interpolation du template, injection du
   contrat de sortie, parsing/réparation du JSON).
4. **Le registre de schémas** : `packages/server/ai-skill/schemas/index.js` —
   les contrats d'entrée/sortie zod, versionnés via git, référencés par id.
5. **Routes** : `ai-skill.routes.js` puis (PR2) `ai-playground.routes.js` —
   tout est `GUARD_ADMIN`.
6. **UI** : commencez par les pages (`packages/ui/routes/ai-skills/`,
   `ai-expertise/`, `ai-playground/`), les composants `BsAi*` suivent.

Pour le playground, le fichier porteur est
`packages/server/ai-playground/services/playground-runner.service.js` : il
montre la philosophie entière du module (résolution skill + expertises,
composition d'input, snapshot reproductible).

## 2. Invariants à vérifier

C'est la liste des propriétés que la review doit confirmer — si vous trouvez
une violation, c'est un bug :

- **Skill = fonction pure de son input.** `invoke()` ne fetch jamais de
  contexte métier ; l'appelant (runner playground, future feature) compose
  l'input. Le seul enrichissement automatique est le contrat de format de
  sortie, dérivé de `outputSchemaId`.
- **`featureType` (analytics) ≠ résolution moteur.** Le `featureType` d'une
  `AISkillInvocation` dit _qui a appelé_ (`'admin-test'`, `'playground'`,
  `'poc.*'` réservés non productifs, exclus par défaut de l'onglet
  Invocations). La config moteur (provider/modèle) vient de l'`AIFeatureConfig`
  `featureType='skill'` du Group — deux notions homonymes, jamais croisées.
- **Contenu skills/expertise en clair en DB** : décision documentée
  (AI_SKILL_ETAPE_1.md) — c'est du savoir-faire interne, pas du secret, et le
  chiffrement aurait coûté l'observabilité (recherche, diff de versions).
- **Un seul Group plateforme** : index unique partiel `unique_platform_group`
  sur `Group.isPlatform` (`group.schema.js`). Flaggé via
  `yarn flag-platform-group` ou le bouton sur /groups — pas de Group seedé.
- **Un seul golden run par scénario** (PR2) : index unique partiel sur
  `AIPlaygroundRun.isGolden`.
- **Validation `{{input.*}}` confinée à l'inputTemplate.** La gate de
  cohérence (`template-coherence.js`) bloque l'activation si un placeholder
  référence un champ hors schéma d'entrée (strict ⇒ interpolation vide
  garantie = bug). Warnings non bloquants à la sauvegarde de brouillon.
- **Pas de point dans les clés persistées** (Mongoose 5.12/BSON ancien) : les
  structures à clés dynamiques sont stockées en `[{path, value}]`.

## 3. Dormant par design (ne pas signaler, ne pas supprimer)

Champs présents dans les schémas mais volontairement non câblés en v1,
annotés `// Réservé étape N` à la source :

| Champ              | Où                                          | Pourquoi                                                                                                                                           |
| ------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variantPath`      | `AISkillInvocation`, `AIPlaygroundScenario` | Étape 2, variantes de prompt (DSE v2) — la dimension d'analyse doit exister dès les premiers logs                                                  |
| `feedback`         | `AISkillInvocation`                         | Étape 2 (RAG) — distinct du feedback de `AIPlaygroundRun`, qui lui est câblé et fonctionne                                                         |
| `groupContext`     | `AIPlaygroundScenario`                      | Étape 2, sélecteur de Group — le runner retombe sur le Group plateforme                                                                            |
| `providerOverride` | `AIPlaygroundScenario`                      | Étape 3, mode benchmark — transmis en enveloppe forward-compat, jamais appliqué ; aucune UI ne l'expose (principe : jamais un contrôle sans effet) |

La migration `scripts/migrate-version-major-minor.js` est conservée
(idempotente) : les bases locales des autres devs en ont besoin.

## 4. Explicitement reporté (ne pas chercher dans ces PRs)

- **Étape 2 core** : enum de typologies de features + cascade de résolution
  de config + `costMode` ; sélecteur de Group au playground ; variantes de
  prompt.
- **Étape 2bis** : UI de surcharge de config par feature.
- **Étape 3** : mode benchmark (multi-provider côte à côte), Integration
  explicite passée à `invoke()`.
- **Prérequis bloquants identifiés par le POC textgen** (avant toute feature
  user-facing consommant les skills) : rate-limit + cap de payload
  (rétroactivement sur `/api/translation` aussi), DOMPurify sur les sorties
  HTML (translate inclus), résolution du scope d'expertise depuis les champs
  du bloc. Détail : `docs/poc-textgen-report.md` (branche `poc/ai-textgen`).

## 5. Preuves de validation déjà passées

- **Campagne smoke rejouable** (script jetable, non commité — décrit dans
  l'historique des PRs) : 11/11 vert sur OpenAI, puis 4/4 vert après bascule
  du moteur plateforme sur Mistral — couvre CRUD scénario, run complet,
  validation d'input, golden, feedback, budget.
- **Validation multi-provider du contrat de sortie** : les trois classes
  d'erreurs LLM rencontrées (objet dans un champ string, `\n` bruts dans le
  JSON, guillemets non échappés) ont chacune leur défense : fidélité de types
  dans le contrat auto-injecté, passe de réparation `parseJsonFromLLM`, mode
  natif `response_format: json_object` (openai/mistral).
- **Gate de cohérence en conditions réelles** : a bloqué des activations avec
  placeholders hors schéma pendant le provisionnement des scénarios QC.
- **Scénarios QC provisionnés** (data, pas code) : `qc.subject` v1.2 + grille
  de correction, exécutés au playground.
- **POC textgen** (`poc/ai-textgen`) : chaîne complète bouton de bloc Mosaico
  → modale → `POST /api/email-builder/textgen/block` → `invoke()` avec
  expertises via `findApplicable()` → injection multi-champs Knockout + undo
  en une étape. Verdict de faisabilité : `docs/poc-textgen-report.md`.
- `yarn check-skills` : cohérence manifests ↔ call-sites `invoke()` ↔ skills
  ACTIVE en base.

## 6. Écarts connus et assumés (self-review)

Une passe `code-reviewer` interne a été faite avant ouverture des PRs. Tout
ce qui était CRITICAL/HIGH a été corrigé (exécution effective des versions
épinglées par le playground, opt-out de logging de contenu respecté aussi sur
les échecs, gate de cohérence non contournable via PATCH du schéma, exécution
playground qui sauvegarde d'abord le scénario), ainsi que la majorité des
MEDIUM. Les écarts suivants sont **connus et assumés** :

- **Pagination UI absente** sur les listes (skills, expertises, invocations,
  scénarios, runs) alors que le serveur pagine (50 par défaut, `total`
  renvoyé). Assumé : volumes super-admin actuels très en dessous de 50 ;
  l'API est prête, c'est un ajout UI pur quand le besoin arrivera.
- **Purge des invocations de Groups supprimés** : le job de rétention itère
  les Groups existants ; les invocations orphelines ne sont pas purgées.
  Assumé pour la v1 (la suppression de Group est exceptionnelle) — à traiter
  avec la politique de suppression de Group globale.
- **Casting/validation léger des query params admin** (`?status[$ne]=…`
  injecte un opérateur Mongo ; IDs malformés → CastError 500 au lieu de 400).
  Routes GUARD_ADMIN, lecture seule — à durcir en étape 2 avec un middleware
  de validation transversal plutôt qu'au cas par cas.
- **`DELETE /runs/:runId`** exposé côté API sans bouton UI (la clé i18n
  `runs.deleteConfirm` attend) — le besoin UI n'est pas confirmé, la route
  sert les scripts d'entretien.
- **Budget de test consommé avant `invoke()`** : une erreur de config brûle
  une unité du budget quotidien (50/jour). Sans gravité à ce volume.
- **Test « 401 sur toutes les routes »** n'échantillonne qu'une route par
  module — le guard est monté en tête de router (`router.use(GUARD_ADMIN)`),
  la garantie réelle est structurelle.
- **`parseVersionParam('1.')`** accepte `1.0` silencieusement (Number('')
  === 0) — entrée d'URL admin, sans conséquence.
- Un scénario peut épingler une version DRAFT, qui reste supprimable →
  exécution en 404 explicite. Assumé : le playground est l'outil même qui
  sert à tester les DRAFT ; le 404 est clair et l'état réparable.
