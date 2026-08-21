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

- **Pagination UI absente** sur les listes (skills, expertises, scénarios,
  runs) alors que le serveur pagine (50 par défaut, `total` renvoyé). Assumé :
  volumes super-admin actuels très en dessous de 50 ; l'API est prête, c'est un
  ajout UI pur quand le besoin arrivera. **L'onglet Invocations est sorti de cet
  écart** (review A8) : c'est la seule collection à croissance non bornée, elle
  pagine et trie désormais côté serveur.
- ~~**Purge des invocations de Groups supprimés**~~ : **résolu** par le passage
  à l'index TTL (review R1). La deadline est stampée sur chaque document à
  l'écriture, donc elle ne dépend plus de l'existence du Group : les invocations
  orphelines expirent comme les autres.
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

- ~~**MEDIUM — `JobScheduler` sous `ai-skill` connaît `ai-playground`**~~ :
  **sans objet** — le scheduler n'existe plus (review R1/A6). Il n'y a plus de
  composition root à sortir, ni d'instance `agenda` partagée entre modules.
  **Impact PR2** : son job de purge des runs de playground n'a plus de
  `job-scheduler.js` à requérir ; il doit passer au même modèle TTL (index
  `expireAfterSeconds` sur la collection de runs).
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
- **LOW** : `reload()` du playground sans
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

## 7. Retours de review PR #1075 — traités / reportés

Passe de review externe sur la PR #1075 : 12 retours bug/UX (R1–R12) et 8
retours d'architecture (A1–A8). Corrigés sur `fix/ai-skills-review-1075`.

### Traités dans la PR

| Réf          | Sujet                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** 🔴    | `agenda@6` ESM-only → le scheduler ne démarrait jamais, la purge RGPD n'a jamais tourné. **agenda supprimé** au profit d'un index TTL sur `expiresAt` (cf. ci-dessous).                                       |
| **R2** 🔴    | Périmètres d'expertise normalisés des deux côtés + warning quand un périmètre demandé ne matche rien. La garde CI proposée n'a pas été retenue — voir ci-dessous.                                             |
| **R3** 🟠    | Intégrations filtrées sur `type=ai` côté UI **et** refusées côté serveur (`validateIntegrationOwnership`).                                                                                                    |
| **R4** 🟠    | Modèle par défaut du provider exposé (`defaultModel` sur `/models`) et nommé dans le select — seul chemin de retour au défaut.                                                                                |
| **R5** 🟠    | Changement d'intégration → `config.model` remis à `null` dans le même appel.                                                                                                                                  |
| **R6** 🟠    | Sélecteurs de type d'email alimentés par `EMAIL_TYPES` ∪ facettes (`emailTypeItems`).                                                                                                                         |
| **R7** 🟠    | `placeholdersHelp` corrigé fr/en : les placeholders ne valent que dans le modèle d'entrée.                                                                                                                    |
| **R8** 🟡    | Chips de placeholders copiables au clic (`helpers/copy-to-clipboard.js`, fallback hors contexte sécurisé).                                                                                                    |
| **R9** 🟡    | Override `DATABASE_URL` supprimé de `node.config.js`.                                                                                                                                                         |
| **A3** 🟠    | Le schéma de sortie est résolu **avant** l'appel provider (il l'était après, d'où un TypeError une fois la requête LLM facturée). Le croisement base↔registre en CI n'a **pas** été retenu — voir ci-dessous. |
| **A4/A5** 🟡 | Conventions actées : règle plat/sous-dossiers dans `AGENTS.md`, rôle de `repositories/` en tête de fichier.                                                                                                   |
| **A7** 🟡    | `AISkillInvocation.featureType` → `invocationSource` + migration `$rename` idempotente.                                                                                                                       |
| **A8** 🟡    | Onglet Invocations paginé et trié côté serveur (tri sur whitelist de champs).                                                                                                                                 |

Au passage, trois clés i18n dupliquées issues du rebase (bloc `aiFeatures`
entier dans `fr.js`, `global.savedSuccessfully` dans `fr.js` et `en.js`), toutes
masquées par une définition ultérieure et invisibles jusqu'à ce qu'eslint
`no-dupe-keys` soit déclenché sur ces fichiers.

### Reportés, décision consciente

- **R2** 🔴 — **traité**, mais pas comme proposé : voir la section dédiée plus
  bas.
- **R10** 🟡 — section « Anatomie d'une skill » dans `AI_SKILL_AUTHORING.md`.
- **R11** 🟡 — garde-fou anti-perte de saisie (~½ journée) et écrasement entre
  deux panneaux de versions dépliés.
- **R12** 🟡 — publication d'une version au contenu entièrement vide.
- **A1** 🔴 — factoriser la machine à états versionnée dupliquée entre
  `skill.service` et `expertise.service`. Refactor de code validé en recette :
  **prérequis avant une troisième entité versionnée**, pas maintenant.
- **A2** 🟠 — **traité** : `ai-feature.service.js` expose désormais
  `resolveActiveFeature({ groupId, featureType })`, qui renvoie
  `{ ok: true, feature, integration }` ou `{ ok: false, reason }` parmi
  `NO_CONFIG` / `FEATURE_INACTIVE` / `NO_INTEGRATION` /
  `INTEGRATION_INACTIVE`. `resolveGroupIntegration` d'`ai-skill` le consomme et
  ne garde que ce qui lui est propre : le typage `CONFIG_ERROR`, la traduction
  de la raison en message (le vocabulaire est celui des skills, pas celui de la
  machinerie feature) et la lecture du Group, qui porte l'opt-out RGPD et la
  fenêtre de rétention.

  **Fait maintenant plutôt qu'à l'étape 2** parce que le helper a été _enrichi_
  et non _modifié_ : `getActiveFeatureWithIntegration` devient un wrapper au
  contrat `null` inchangé, donc `translation` (4 appels) et `mailing.schema` ne
  sont pas touchés — et un test verrouille ce contrat. Le compromis que la
  reviewer signalait (« ne pas perdre les trois messages distincts ») est
  couvert par un test paramétré sur les quatre raisons.

- **A6** 🟡 — **résolu par le TTL** : le scheduler n'existe plus, donc plus rien
  à déplacer.

### R2 : normaliser, et rendre l'échec audible

Le retour proposait trois pistes : (a) normaliser à l'enregistrement, (b) croiser
les `scope` déclarés dans les manifests avec la base via `check-skill-usage.js`,
(c) une constante partagée de périmètres.

Retenu : **(a), plus une variante de (b)**.

**(a) Normalisation des deux côtés.** `services/expertise-scope.js` est la seule
source de vérité de « c'est le même périmètre » : `trim` + minuscules +
dédoublonnage + tri. Consommé par le service (écriture), le repository
(requête) et la migration, donc les trois ne peuvent pas diverger. `CTA` saisi
dans l'UI matche désormais `cta` écrit dans un appel. Migration **obligatoire**
(`scripts/migrate-expertise-scope-normalize.js`) : sans elle, une expertise
taguée `CTA` cesse de matcher puisque la lecture normalise.

**(b) Pas dans la CI, dans `findApplicable`.** Le croisement via
`check-skill-usage.js` aurait eu le même sort que celui d'A3 : le script passe
`--dry`, aucun workflow ne l'appelle, et sans base joignable il sort en vert. Et
la question « ce périmètre existe-t-il ? » n'a pas de réponse au build : elle
dépend de l'environnement. Donc le contrôle vit là où il a la donnée réelle,
c'est-à-dire à l'appel : un warning listant les périmètres réellement en usage,
la seule information utile pour corriger.

Le warning se déclenche **aussi quand des expertises transversales sont
revenues** — c'est le cas qui rendait la panne indétectable : la liste n'est pas
vide, le prompt part sans la doctrine spécifique, et la sortie est seulement
« un peu moins bonne ».

**(c) écarté.** Fermer les périmètres par un enum retirerait à l'équipe la
possibilité d'organiser sa doctrine sans livraison de code, pour se protéger
d'une faute de frappe que (a) élimine et que (b) rend visible. Disproportionné.

**Ce qui reste non couvert, assumé** : rien n'empêche un synonyme (`cta` vs
`bouton`). C'est un warning à lire, pas une garantie.

### A3 : traité au runtime, pas dans `check-skill-usage.js`

La recommandation était d'ajouter le croisement `schemaId` base↔registre zod au
script (~15 lignes, « ça transforme une panne runtime en échec de CI »). Écrit,
puis retiré après examen — le script est resté identique à la branche de base.

Raisons :

- **Ça n'aurait été un échec de CI dans aucun scénario.** `yarn check-skills`
  passe `--dry`, qui saute tous les contrôles base ; aucun workflow n'appelle le
  script ; et lancé sans `--dry` avec une base injoignable il logue
  `DB check skipped` et **sort en 0**. Un filet qui n'attrape rien.
- **Le contrôle ne peut structurellement pas être un contrôle de build** : la
  réponse dépend de l'environnement (une skill ACTIVE en recette peut être
  absente en prod). Il n'y a pas de vérité à vérifier au moment du build.
- **Le code vérifie déjà, au bon moment.** La panne se produit à l'invocation ;
  c'est là qu'elle est détectée, avec la donnée réelle. Avoir besoin d'un
  contrôle périodique pour surveiller ça signalerait que l'échec est mal traité
  à l'endroit où il se produit.

Ce qui a été retenu, et qui règle le problème signalé : `getSchema(outputSchemaId)`
est résolu à l'étape 2 de `invoke()`, à côté du schéma d'entrée, au lieu de
l'étape 6. Un identifiant qui ne résout plus (schéma renommé ou supprimé en code
alors qu'une version ACTIVE le référence) échoue désormais avec un message
explicite **avant** l'appel provider, là où il produisait un TypeError **après**
une requête LLM facturée.

Point connexe relevé au passage, non traité : quand un appelant **épingle** une
version (`version: { major, minor }`), la recherche est un `versions.find()`
**sans filtre de statut** — une version ARCHIVED reste donc invocable par
épinglage. Vraisemblablement voulu pour le mode épinglé du playground ; à
trancher côté PR2, qui est la seule consommatrice de l'épinglage.

### Rétention des invocations : TTL au lieu d'un job planifié

Le correctif R1 initial épinglait `agenda@^5`. Revu ensuite : agenda apportait
une file de jobs distribuée complète (plus son propre `mongodb@4` imbriqué, donc
un second driver et **une connexion par worker de cluster**) pour une unique
tâche quotidienne. Remplacé par le mécanisme déjà utilisé par
`translation-job.schema.js` :

- `AISkillInvocation.expiresAt`, calculé à l'écriture depuis
  `Group.logRetentionDays` (le Group est déjà chargé par `invoke()` — aucune
  requête ajoutée ; seul le chemin d'échec `INPUT_VALIDATION`, qui logue avant la
  résolution du Group, lit la rétention lui-même plutôt que de retomber sur le
  défaut et de sur-conserver).
- Index `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` : Mongo purge lui-même.
- Supprimés : la dépendance `agenda`, `ai-skill/jobs/` (scheduler + job de purge)
  et le câblage dans `index.js` (dont le wrapper `shutdown` ajouté par la PR,
  revenu à la forme de `develop`).
- Backfill des documents antérieurs :
  `node scripts/migrate-invocation-expires-at.js [--dry-run]` — sans `expiresAt`,
  un document est invisible pour le moniteur TTL et n'expirerait jamais.
  Idempotent.

**Compromis assumé** : une rétention modifiée ne se réapplique pas aux documents
déjà écrits. Aujourd'hui `logRetentionDays` n'est exposé dans aucune UI
(modifiable en base uniquement) ; si ça change, un `updateMany` recalculant
`expiresAt` au changement de config suffit.
