# Rédaction des skills — règles de cohérence prompt ↔ schémas

> Dernière mise à jour : 2026-06-12 — reflète l'état final des branches avant review.

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

`'admin-test'` (runner de test super-admin), `'playground'` (AI Playground) et
tout type préfixé `'poc.'` (proofs of concept) sont réservés aux invocations
non productives : ils sont exclus par défaut des analytics de l'onglet
Invocations. Une feature productive utilise son propre featureType, déclaré
dans son `skill-manifest.js`.
