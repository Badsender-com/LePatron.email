# Moteur LLM des Skills — Étape 1 (déblocage Playground)

> Brief d'implémentation validé. Première étape d'une refonte plus large du choix
> du moteur LLM (voir « Étape 2 » en fin de document). Objectif : un playground
> qui tourne bout-en-bout, en s'exécutant par défaut sur une **company plateforme**
> Badsender plutôt qu'en empruntant le moteur d'une company cliente.

## Contexte (rappel du dilemme)

Le moteur LLM réel (`Integration` : provider + clé API) est **toujours rattaché à
une company** via `AIFeatureConfig._company`. Une skill ne s'invoque jamais « dans
le vide » : `skillInvocation.invoke()` résout l'`Integration` à partir de la
feature `featureType: 'skill'` de la company. Le playground délègue à ce **même
moteur** — il doit donc s'exécuter au nom d'une company qui a un moteur `skill`
configuré.

Deux maillons manquaient :

1. **Aucune UI** ne permettait de configurer le moteur `skill` (l'écran
   « Fonctionnalités IA » ne gérait que `translation`).
2. Le playground n'avait **aucune company** à utiliser (pas de sélecteur, pas de
   défaut).

## Contrat à ne jamais violer : `featureType` ≠ `categoryOverride`

Deux axes **orthogonaux** que les futurs devs ne doivent pas confondre (gravé en
JSDoc dans `skill-invocation.service.js`) :

| Axe                                | Sert à                                                                                                                      | Vit où                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `featureType` (param d'`invoke()`) | **Analytics** : source de l'appel (`'playground'`, `'admin-test'`, feature productive). Inclusion/exclusion dans les stats. | `AISkillInvocation.featureType` |
| `categoryOverride` _(étape 2)_     | **Résolution du moteur** : quel `AIFeatureConfig.featureType` alimente l'appel. Défaut = `skill.category`.                  | `resolveGroupIntegration()`     |

→ Ne jamais utiliser `featureType` (analytics) pour choisir le moteur, ni la
catégorie moteur pour les analytics.

## Ce qui a été livré (étape 1)

### 1. Doc de contrat (`feat/AI-skills-v1`)

JSDoc explicite sur `invoke()` et `resolveGroupIntegration()` séparant les deux
axes ci-dessus, **avant** que `categoryOverride` n'existe, pour cadrer l'étape 2.

### 2. UI « Moteur Skills » dans Fonctionnalités IA (`feat/AI-skills-v1`)

- **Composant extrait** `BsAiFeatureSkillEngineSection.vue` (~260 l.,
  auto-contenu : fetch config/intégrations/modèles, activation, sélection
  d'`Integration` + modèle). Réutilise `updateFeature('skill', …)`.
- Intégré dans `ai-features-tab.vue` en ~6 lignes (le parent était déjà > 300 l. ;
  l'extraction évite de l'aggraver et **prépare** la refonte hiérarchique de
  l'étape 2bis — la section translation pourra être extraite sur le même modèle).
- Backend **inchangé** : `getOrCreateConfig` crée déjà une feature par
  `AIFeatureTypeValues` (dont `'skill'`), et `model` est déjà whitelisté dans
  `FEATURE_CONFIG_FIELDS`. `updateFeature('skill', …)` fonctionnait déjà.
- i18n `aiFeatures.skill.*` (fr + en).
- **Visibilité plateforme-only** : la section n'est rendue que si
  `group.isPlatform === true` (prop passée par la route `ai-features.vue` au tab).
  Tant qu'aucune feature productive client ne consomme les skills, exposer ce
  moteur à tous les groupes serait du bruit. Asymétrie assumée avec la section
  Traduction (feature productive shippée, visible partout). TODO de retrait du
  `v-if` quand des features productives consommeront les skills (étape 2bis / 3).

### 3. Company plateforme (`feat/AI-skills-v1`)

On **ne crée pas** de company dédiée : dans toute install LePatron il existe déjà
un groupe **opérateur** (Badsender, ou le groupe interne d'un self-host). On le
**flaggue**.

- `Group.isPlatform: Boolean` + **index unique partiel** (`unique_platform_group`)
  garantissant au plus une company plateforme (même pattern que l'index
  golden-run du playground).
- Deux moyens de flagger un groupe existant (la clé API du moteur Skills se
  saisit ensuite via l'UI dans tous les cas) :
  - **UI** : action « Définir comme Group plateforme » par ligne sur la page
    `/groups` (super-admin) + chip « Plateforme » sur le groupe courant. Endpoint
    dédié `PUT /groups/:groupId/platform` qui **déplace** le flag (retire l'ancien
    avant de poser le nouveau) — gère le singleton en un point.
  - **CLI one-shot** `yarn flag-platform-group <groupId>`
    (`scripts/flag-platform-group.js`) pour les installs headless/ops : pose le
    flag si aucun autre groupe ne l'a déjà (sinon refuse explicitement),
    idempotent.
- **Pas de filtrage** : le groupe plateforme est un vrai groupe opérateur utilisé
  pour l'emailing réel → il apparaît dans les listes comme n'importe quel autre.
- Le concept se **généralise** : pas de hardcoding « Badsender » ; un self-host
  flaggue son propre groupe opérateur.

### 4. Playground → défaut plateforme (`feat/ai-playground`, après merge)

`executeScenario()` : si ni `groupId` (runtime) ni `scenario.groupContext`,
fallback sur `Groups.findOne({ isPlatform: true })` au lieu de jeter
« A Group context is required ». Échec explicite seulement si aucun groupe
plateforme n'est flaggé / n'a de moteur `skill` actif. `featureType: 'playground'`
(analytics) inchangé.

## Critères de done (étape 1)

1. `yarn flag-platform-group <groupId>` flaggue un groupe opérateur existant, et
   un super-admin y configure une `Integration` sur le moteur **Skills**.
2. La section **Moteur Skills** n'est visible **que** sur le groupe plateforme ;
   le groupe reste présent dans les listes / le switcher (pas de filtrage).
3. Le run d'un scénario aboutit avec un output non nul (clé API saisie au
   préalable).
4. Le contrat `featureType` ≠ `categoryOverride` est documenté (code + ce doc).

## Répartition par branche

- `feat/AI-skills-v1` (puis merge → `feat/ai-playground`) : points 1, 2, 3.
- `feat/ai-playground` : point 4 (+ fix `bs-select` du sélecteur d'expertise).

## Étape 2 (core, après merge de l'étape 1)

- Étendre l'enum `featureType` aux typologies **sans** réutiliser `'translation'`
  (collision de sémantique avec le legacy ; les skills de catégorie `translation`
  tombent en fallback `'skill'` jusqu'à leur ré-implémentation en skill).
- Résolution **en cascade** : `skill.category` (ou `categoryOverride`) →
  `featureType` correspondant → fallback `'skill'` → erreur.
- `costMode` sur `AIPlaygroundRun` (`platform` | `client`) + warning UI en mode
  client.
- Documenter la migration future `translation` (legacy) → skill `translation.text`.

Reporté en **étape 2bis / 3** (sur besoin réel) : refonte UI hiérarchique
« défaut + surcharges », sélecteur d'`Integration` côté playground, et mode
**benchmark multi-Integration** (qui exige au préalable que `invoke()` accepte une
`Integration` explicite — provider + clé — et pas seulement un override de modèle).
