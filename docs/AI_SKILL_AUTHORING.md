# Rédaction des skills — règles de cohérence prompt ↔ schémas

> Dernière mise à jour : 2026-06-13 — ajoute le modèle conceptuel
> feature/invocation et le contrat de chargement des expertises.

> Le schéma zod est la source de vérité. Tout ce qui peut être dérivé du
> schéma (contrat de sortie, liste des champs valides) ne repose jamais sur la
> mémoire d'un rédacteur. Ces deux garde-fous sont nés de la campagne de smoke
> tests du playground (deux classes d'erreurs de contenu rencontrées deux fois).

## 1. Contrat de format de sortie : ne l'écrivez plus

N'écrivez plus de contrat de format de sortie (« réponds en JSON… ») dans vos
prompts : il est **injecté automatiquement** à l'invocation depuis le schéma de
sortie de la skill (`outputSchemaId`), à la fin de la section statique du
prompt (compatible prompt caching). Un contrat écrit à la main est au mieux
redondant, au pire contradictoire avec le schéma réel.

## 2. Placeholders du template : alignés sur le schéma d'entrée, sinon publication bloquée

À la publication (activation d'une version), tout placeholder `{{input.x}}` du
template doit correspondre à un champ du schéma d'entrée (`inputSchemaId`) —
sinon la publication est **bloquée** avec la liste des champs fautifs (un champ
hors schéma `.strict()` serait toujours interpolé vide : bug garanti). À la
sauvegarde d'un brouillon, ces incohérences (et les champs requis non
référencés) ne sont que des avertissements non bloquants affichés dans l'UI.

Note : `{{input.expertise}}` n'est valide que si le schéma d'entrée déclare un
champ `expertise` (cf. `expertiseArraySchema`) ; le contenu injecté par le
playground y est sérialisé en JSON.

## Sources d'invocation réservées (non productives)

`'playground'` (AI Playground) et toute source préfixée `'poc.'` (proofs of
concept) sont réservées aux invocations non productives : elles sont exclues par
défaut des analytics de l'onglet Invocations. Une feature productive utilise sa
propre source, déclarée dans son `skill-manifest.js`.

> La source est le champ `invocationSource` d'`AISkillInvocation`, passé en
> paramètre d'`invoke()`. Il s'appelait `featureType` — homonyme du
> `featureType` d'`AIFeatureConfig`, qui désigne le _type de moteur_ et n'a
> rien à voir. Migration : `scripts/migrate-invocation-source.js`.

> Historique : une source `'admin-test'` existait pour un runner de test
> super-admin (onglet Test de la page skill), supprimé depuis. Elle reste dans
> la liste d'exclusion analytics pour d'éventuels logs historiques, mais aucun
> code ne l'émet plus — on teste désormais une skill via le Playground.

## Modèle conceptuel : feature / invocation / skill

| Notion         | Définition                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature**    | Capacité produit (ex. le bouton de génération d'un bloc). **Orchestre**, possède le `skill-manifest.js`. 1 feature → N invocations, potentiellement de skills différentes, chacune avec son propre mix d'expertise. |
| **Invocation** | Appel **atomique** : exactement UNE skill (skillId toujours littéral, jamais de sélection dynamique) + un input composé. Unité de log, de coût et de traçabilité (une ligne `AISkillInvocation`).                   |
| **Skill**      | Fonction pure de son input (cf. §1) ; ne fetch jamais de contexte.                                                                                                                                                  |

Conséquences :

- **La composition vit dans le code de la feature** (ordre des appels,
  chaînage des outputs, gestion d'erreurs) — c'est le corollaire du rejet de
  l'invocation skill-à-skill.
- **L'expertise est chargée par invocation, pas par feature** : chaque appel
  compose son input via `findApplicable` avec **son propre** scope + categories.

## Chargement des expertises (`findApplicable`)

`expertiseRepo.findApplicable({ scope, categories, emailType?, language? })`
exige **scope ET categories** — un appelant qui veut un mix large énumère
explicitement. La lourdeur est volontaire : le mix d'expertise d'une feature
est une décision qui doit être **visible en review de code**.

Une expertise matche si :

- `status` ACTIVE
- ET ( `isTransversal === true` OU intersection(`expertise.scope`, `scope`) ≠ ∅ )
- ET `expertise.category ∈ categories`
- ET ( `appliesToEmailTypes` vide OU `emailType ∈ appliesToEmailTypes` )
- ET ( `appliesToLanguages` vide OU `language ∈ appliesToLanguages` )

### Périmètres : normalisés des deux côtés, et un warning si ça ne matche pas

L'intersection est une **égalité stricte de chaînes**. Le périmètre est saisi en
texte libre par un admin dans l'UI, et écrit en dur par un dev dans l'appel :
les deux côtés doivent tomber sur le même mot.

Pour que ça ne dépende pas de la casse, les deux passent par
`services/expertise-scope.js` (`trim` + minuscules + dédoublonnage + tri) — à
l'enregistrement comme à la requête. `CTA` saisi dans l'UI matche donc `cta`
écrit dans le code. Les données antérieures sont alignées par
`node scripts/migrate-expertise-scope-normalize.js [--dry-run]`, **obligatoire**
sinon une expertise taguée `CTA` cesse de matcher.

La normalisation ne peut rien contre les **synonymes** (`cta` vs `bouton`).
Donc `findApplicable` logue un warning quand un périmètre demandé ne matche
aucune expertise ACTIVE, en listant les périmètres réellement en usage — c'est
la seule information nécessaire pour corriger l'appel :

```
[expertise] scope(s) ["bouton"] matched no ACTIVE expertise — nothing from that
scope will reach the prompt. Scopes in use: ["cta","objet"]. Check the
findApplicable call against the expertise tagging.
```

Volontairement un warning et pas une erreur : une expertise manquante dégrade
la sortie, elle ne rend pas l'invocation invalide, et une feature ne doit pas
casser parce qu'un module de doctrine n'est pas encore écrit. Attention, le
warning se déclenche **aussi** quand des expertises transversales sont revenues
— c'est le cas le plus vicieux : la liste n'est pas vide, le prompt part sans la
doctrine spécifique, et sans ce log personne ne le remarque.

### Ordre de retour (déterministe)

`findApplicable` trie les expertises de façon stable = **l'ordre d'apparition
dans le prompt composé** : les **transversales d'abord** (les générales, ex.
voix de marque), puis par **`expertiseId` alphabétique**. Objectif : un mix
prévisible et reviewable, les principes généraux posés avant les règles
spécifiques. En mode filtre du playground, l'aperçu suit ce même ordre. Pour un
ordre sur mesure, utiliser la **sélection explicite** (liste réordonnançable) —
il n'y a volontairement pas de champ de priorité en mode filtre (différé tant
qu'un besoin réel n'est pas constaté).

### Transversalité — « traverse les périmètres, pas les catégories »

`isTransversal: true` charge l'expertise **quel que soit le périmètre demandé**
(ex. une voix de marque), mais elle reste filtrée par **catégorie**, type
d'email et langue. Le flag court-circuite uniquement le scope, jamais le reste.

### Sémantique du scope vide (inversée)

Une expertise au **scope vide et non transversale** ne matche **jamais** une
requête filtrée. C'est volontaire : l'oubli d'un périmètre devient **visible**
(« mon expertise n'apparaît nulle part ») au lieu d'être silencieusement global.
Pour qu'une expertise soit chargée partout, il faut la marquer transversale —
un acte délibéré.

## Manifests : déclarer ses filtres (`expertiseFilters`)

Un `skill-manifest.js` peut déclarer les filtres `findApplicable` qu'émet la
feature :

```js
expertiseFilters: [
  { scope: 'cta', categories: ['redaction'], emailType: 'promo' },
],
```

`yarn check-skills` valide la _forme_ de ce champ (déclaratif en v1, pas de
cross-check avec les call-sites). Ces déclarations alimentent l'**alerte
d'impact** affichée à l'activation d'une expertise : on y voit quelles
fonctionnalités la chargeront (consentement éclairé, non bloquant).
