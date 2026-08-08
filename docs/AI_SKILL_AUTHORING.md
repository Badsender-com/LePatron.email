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

## FeatureTypes réservés (non productifs)

`'playground'` (AI Playground) et tout type préfixé `'poc.'` (proofs of
concept) sont réservés aux invocations non productives : ils sont exclus par
défaut des analytics de l'onglet Invocations. Une feature productive utilise
son propre featureType, déclaré dans son `skill-manifest.js`.

> Historique : un featureType `'admin-test'` existait pour un runner de test
> super-admin (onglet Test de la page skill), supprimé depuis. Il reste dans la
> liste d'exclusion analytics pour d'éventuels logs historiques, mais aucun
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
