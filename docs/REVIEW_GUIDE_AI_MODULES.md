# Guide de review — Modules IA (Skills, Expertise, Playground)

> Dernière mise à jour : 2026-06-18. Écrit pour le reviewer qui découvre ces
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
- **Les schémas sont versionnés** (`inputSchemaId`/`outputSchemaId` sur la
  version, plus sur la racine skill — UX review §3). Éditables en DRAFT comme
  les prompts, figés sur ACTIVE/ARCHIVED, requis à la publication (gate).
  `invoke()` et la gate de cohérence lisent les schémas de la version résolue
  (active ou épinglée). L'onglet Détails ne porte que Titre / Description /
  Catégorie : les schémas ne s'affichent et ne s'éditent que dans l'éditeur de
  version (seule source de vérité — correctif recette). Migration :
  `scripts/migrate-skill-schemas-to-version.js` (recopie racine→versions puis
  `$unset` racine, idempotente).
- **Création d'une skill = démarrage sur le contrat générique.** `createSkill`
  seed une v1.0 DRAFT avec `inputSchemaId: 'genericTextInput'` /
  `outputSchemaId: 'genericTextOutput'` pré-remplis ; l'UI redirige vers
  l'onglet Versions avec cette v1.0 dépliée (`?tab=versions&expand=1.0`). La
  bascule vers un schéma typé est un geste ultérieur (nouvelle version majeure).
- **Éditeur de version ordonné selon le flux réel** (contrat d'abord) :
  schémas d'entrée/sortie → system prompt → corps → modèle d'entrée. Sous le
  modèle, un helper de placeholders dérivé du descripteur du schéma d'entrée
  (`GET /ai-skills/schemas/:id/descriptor`) liste `{{input.<champ>}}` (+
  `{{input.expertise}}` si `hasExpertiseField`), astérisque sur les requis, mis
  à jour au changement de schéma. Comportement de la gate de cohérence
  inchangé au changement de schéma sur un DRAFT (placeholders orphelins
  signalés à l'enregistrement).
- **`invocationSource` (analytics) ≠ résolution moteur.** L'`invocationSource`
  d'une `AISkillInvocation` dit _qui a appelé_ (`'admin-test'`, `'playground'`,
  `'poc.*'` réservés non productifs, exclus par défaut de l'onglet
  Invocations). La config moteur (provider/modèle) vient de l'`AIFeatureConfig`
  `featureType='skill'` du Group. Les deux champs s'appelaient `featureType` :
  l'homonymie est levée (review A7), migration
  `scripts/migrate-invocation-source.js`.
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
- **`findApplicable` exige scope ET categories** (sinon 400) : le mix
  d'expertise d'une feature est explicite et visible en review. Le filtrage par
  catégorie empêche qu'une expertise d'une autre catégorie (ex. `qc.cta.*`)
  pollue les prompts d'une feature de rédaction au même scope.
- **Transversalité explicite** : `Expertise.isTransversal` charge l'expertise
  hors scope (mais jamais hors catégorie). Un scope vide non transversal n'est
  chargé **nulle part** (sémantique inversée — l'oubli devient visible). Seul
  `redaction.brand-voice-defaults` est flaggé (migration explicite par id).
- **Manifests avec `expertiseFilters`** : une feature déclare les filtres
  `findApplicable` qu'elle émet ; le registre
  (`ai-skill/services/manifest-registry.js`) calcule l'**alerte d'impact** non
  bloquante à l'activation d'une expertise (qui la chargera). `check-skills`
  valide la forme du champ.

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

## 4bis. Surfaces retirées avant la review (« où est passé X ? »)

Trois surfaces mortes ont été supprimées pour ne pas générer d'allers-retours :

- **Runner de test super-admin** (onglet « Test » de la page skill, route
  `POST /ai-skills/:id/test`, controller `testSkill`, `getBudget` + route
  `/budget`, invocationSource `admin-test`). Remplacé par un lien **« Tester dans le
  playground »** dans le header de la page skill. `test-budget.service` est
  **conservé** (consommé par le playground pour le quota 50/jour).
- **Champ `consumedBySkills`** (Expertise) + les onglets « Expertises liées »
  (page skill) et « Consommée par » (page expertise). Le lien réel
  skill↔expertise sera affiché **post-v1 depuis les manifests et les logs
  d'invocation** (cf. registre de manifests, §2) — pas hand-déclaré.
- **Champ `intendedUseCases`** (Skill) : champ de gouvernance déclaratif
  jamais exploité.

Migration `scripts/migrate-drop-dead-ai-fields.js` (`$unset` idempotent des
deux champs). `admin-test` reste dans la liste d'exclusion analytics pour
d'éventuels logs historiques (commenté comme tel) — aucun code ne l'émet plus.

## 4ter. Journal de commits ≠ diff

Le log de ces branches contient des commits **design-system** (avril–mai,
Jonathan + Olivier Fredon) et **gallery-redesign** dont le contenu a depuis été
intégré à develop par ses **propres PRs** : leur diff net vs develop est **nul
ou marginal** (mesuré : ~88 % du diff est de l'IA pure, le design-system pèse
~300 lignes nettes). **La review se fait sur les fichiers du diff, pas sur le
log.** Ces commits n'ont pas été extraits : réécrire un historique traversé de
merges porteurs de résolutions (regreffe `chatComplete`, merges develop) pour
~2 % de diff a un rapport risque/bénéfice défavorable.

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

## 6bis. Passe de review 4 agents (pré-PR)

Avant ouverture, les branches ont été repassées par les 4 agents du projet
(security-auditor → architect → code-reviewer → ux-reviewer). **Aucun
CRITICAL ni HIGH** sur les axes bug/sécurité/architecture. Les findings
MEDIUM/LOW ci-dessous sont **connus et assumés** pour ces PRs (politique :
seuls CRITICAL/HIGH sont corrigés avant PR ; le reste est documenté ici, et les
incohérences UX portent sur des parcours déjà validés en recette — leur
alignement est un lot de polish séparé, pas un correctif de cette review).

### Sécurité (aucun CRITICAL/HIGH)

Guards super-admin montés en tête de chaque router IA, input Zod `.strict()`
avant le LLM, balises anti-injection en `crypto.randomBytes` (non
prédictibles), `apiKey` jamais copiée dans `resolvedConfig`, purges/deletes
scopés, golden préservé. Les 2 écarts LOW (cast ObjectId → 500 au lieu de
400 ; opérateur Mongo injectable dans un filtre de liste admin read-only) sont
déjà couverts au §6 (« Casting/validation léger des query params admin »).

### Architecture

- **MEDIUM — `JobScheduler` sous `ai-skill` connaît `ai-playground`** :
  `ai-skill/jobs/job-scheduler.js` require le job de purge du playground (câblage
  ajouté par la PR2 dans un fichier possédé par la PR1). Assumé : une seule
  instance `agenda`, PR1 seule reste cohérente (l'import n'existe pas sur
  `feat/AI-skills-v1`). Refactor = sortir le scheduler vers une composition-root
  neutre alimentée par des registrars → backlog (c'est un redesign, hors
  périmètre « corrige, ne redessine pas »).
- **LOW — `manifest-registry.filterMatchesExpertise` miroir manuel de
  `findApplicable`** ayant déjà divergé (clause `language` absente du miroir).
  Impact nul aujourd'hui (les manifests présents déclarent `expertiseFilters: []`). Réaligner ou extraire un prédicat unique → backlog.

### Qualité de code

- **MEDIUM — `expertise.service` ne suit pas le pattern `VERSION_CONTENT_FIELDS`**
  (liste unique) introduit côté `skill.service` : `body/examplesGood/examplesBad`
  sont énumérés à 3 endroits. Ajouter un champ de contenu d'expertise rouvrirait
  la classe de bug refermée côté skill. Assumé : le jeu de champs d'expertise est
  stable ; à mutualiser avec la factory de service versionné → backlog.
- **MEDIUM — Français en dur dans quelques messages serveur** (gate d'activation,
  changelog par défaut « Correction mineure »), et un mélange EN/FR dans
  `activateVersion`. Écart à AGENTS.md assumé : produit FR, messages surfacés
  dans une UI FR ; homogénéisation EN + `ERROR_CODES` → backlog (modifierait des
  textes vus en recette).
- **MEDIUM — Garde défensive asymétrique** : `inputSchema` est null-checké,
  `outputSchema` non (`skill-invocation.service.js`). Cas rendu improbable par les
  hooks de validation/activation ; un `outputSchemaId` invalide au runtime ferait
  un 500 opaque. → backlog (guard 3 lignes).
- **MEDIUM — 11 fichiers > 300 lignes** dans le périmètre (`.vue` majoritairement
  template+style ; le dense est `skill-invocation.service.js` à 394). Découpe =
  refactor → backlog.
- **LOW** : `console.error` au lieu de `logger` pour le scheduler dans `index.js`
  (cohérent avec le style local du fichier) ; `reload()` du playground sans
  try/catch ; `latencyMillis` interpole `${ms}` brut ; `statusColor` colore
  `CANCELLED` en rouge. Tous cosmétiques/robustesse → backlog.

### Cohérence UX (incohérences inter-parcours, parcours validés en recette)

Alignements reportés en **lot de polish UI** (aucune régression, chaque écran
validé individuellement) :

- **Types d'email** (`promo/newsletter/transactional`) rendus bruts alors que les
  catégories/statuts sont traduits (sélecteur playground + modale/form expertise)
  → prévoir un dico `aiSkills.emailTypes.*`.
- **`BsTimestamp` appliqué à moitié** : listes d'entités oui, tables runs/
  invocations et en-têtes de version non (refont un `toLocaleString()` local).
- **Filtrage divergent** Skills (catégorie/statut = refetch serveur, recherche
  client) vs Expertise (tout client) sous le même écran à onglets.
- **Identifiant technique** : replié en bas + bouton reset côté skill/expertise ;
  en haut, sans reset, côté scénario.
- **Changelog/notes** éditables sur tout brouillon côté skill, majeure seulement
  côté expertise (+ placeholders présents skill, absents expertise).
- **Suppression de brouillon** via `confirm()` natif alors que les autres actions
  destructives passent par une modale stylée.
- **Dico de statuts dupliqué** (`aiSkills.statuses.*` vs `aiPlayground.status.*`)
  avec divergence de genre FR (`Annulé`/`Annulée`).
- **« Publier » (bouton) vs « Activer » (modale)** pour un même geste.
- LOW : icône/position du champ recherche, chip de catégorie de la liste
  expertise plus gros, latence des vues détail ré-implémentée hors `BsLatency`.

Suggestions d'amélioration (hors incohérences) → issues GitHub post-PR.
