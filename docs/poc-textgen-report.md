# POC textgen — Rapport final

> Branche `poc/ai-textgen` (basée sur `feat/ai-playground`). Le destin du code
> (étendre / retravailler / jeter) reste à arbitrer — ce rapport est le
> livrable qui prime.

## Réponse à la question du POC

**Oui.** Depuis un bloc de l'éditeur Mosaico, on peut déclencher une génération
IA qui traverse toute la chaîne skills/expertise et écrire le résultat dans les
champs texte du bloc, **avec un effort d'intégration Knockout/Mosaico faible**
— parce que la feature block-translation a déjà payé le coût d'infrastructure :
extraction/injection génériques des champs d'un bloc (`block-content-extractor`),
undo transactionnel (`startMultiple`/`stopMultiple`, Ctrl+Z annule la
génération en une étape), pont KO→Vue pour la modale, flag de feature via
`metadata`. L'intégration éditeur du POC est une copie de pattern (~1 journée),
et elle est **générique sur n'importe quel bloc de n'importe quel template**.
La partie la plus exigeante n'était pas Mosaico mais le contrat de données :
les chemins dot-notation des champs ne peuvent pas voyager comme clés d'objets
persistés (BSON interdit les points dans les clés) — d'où le format
`[{path, value}]` de bout en bout.

## Ce qui a été livré

- **Schémas typés** `blockTextGenInput`/`blockTextGenOutput` (premiers schémas
  de production du registre) — paires `{path, value}` à clés dynamiques.
- **Skill `redaction.block.promo`** v1.1 ACTIVE (gouvernance complète,
  gate de cohérence passée), validée au playground : mêmes paths en sortie,
  HTML conservé dans `longText`, champs cohérents entre eux, contraintes
  respectées (scénario `poc.block-promo-validation`).
- **Feature serveur** `packages/server/email-builder/` :
  `POST /api/email-builder/textgen/block` (GUARD_USER), première consommation
  réelle de `expertiseRepo.findApplicable()`, `featureType: 'poc.textgen'`
  (réservé non-productif, exclu des analytics), fidélité des paths garantie
  (paths inventés filtrés, omis signalés → « 3 champs sur 4 générés » dans la
  modale), **premier manifest réel** — `yarn check-skills` vert.
- **Éditeur** : bouton ✨ sur tous les blocs (gardé par
  `metadata.hasTextGenFeature` = moteur Skills actif → invisible chez les
  clients), modale brief→génération→injection, undo natif en une étape.
- **Doc capitalisée** : `docs/mosaico-for-agents.md` (golden patterns +
  pièges de build).
- Vérifié bout-en-bout côté API (run réel Mistral : contenu premium cohérent,
  invocation loguée `poc.textgen | SUCCESS`). 692/692 tests, lint clean.

## Effort réel constaté

| Poste                                                 | Effort                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Intégration Mosaico (bouton, modale, injection, undo) | **Faible** — copie du pattern translate-block, zéro lutte avec KO          |
| Contrat de données (BSON, paths, fidélité)            | Moyen — 1 vraie surprise (clés à points), résolue proprement               |
| Chaîne skills (schémas, skill, gouvernance)           | Faible — le socle (contrat auto-injecté, JSON natif, gates) a tout absorbé |

## Obstacles rencontrés

1. **BSON interdit les points dans les clés persistées** → contrat
   `[{path, value}]` au lieu d'une map ; découvert par le scénario de
   validation, avant toute UI (l'ordre des phases a payé).
2. Le pseudo super-admin n'a pas de `req.user.group` → la modale envoie
   `metadata.groupId`, honoré **uniquement** pour les admins (un client reste
   verrouillé sur son groupe). Le chemin translate-block a la même limite non
   traitée.
3. Mineur : `expertiseConsumed` n'est pas rempli sur l'AISkillInvocation (le
   contrat d'`invoke()` ne le prend pas en paramètre) — la traçabilité fine
   expertise↔invocation attendra une évolution d'`invoke()`.

## Prérequis BLOQUANTS pour la vraie feature (pas de simples TODO)

1. **Rate-limiting par utilisateur/groupe + cap de taille de payload** sur
   l'endpoint de génération. Sans cela, n'importe quel utilisateur authentifié
   peut brûler du quota provider à volonté. **Ce prérequis vaut
   rétroactivement pour `/api/translation/block` et `/translation/text`**
   (TODO sécurité déjà présent dans translation.controller, jamais traité —
   il devient bloquant dès qu'on expose une génération LLM aux clients).
2. **Sanitization DOMPurify des valeurs HTML avant injection** dans les
   observables (`longText` est du HTML inséré dans l'éditeur puis exporté).
   C'est la ceinture manquante — **également sur le chemin translate-block
   existant**, qui injecte aujourd'hui les retours provider sans
   sanitization.
3. **Résolution du scope d'expertise depuis la nature des champs du bloc.**
   Le POC hardcode `findApplicable({scope: 'cta', emailType: 'promo'})` — un
   raccourci assumé. La vraie feature doit déduire le scope (cta ? subject ?
   body ?) des champs réellement présents dans le bloc : c'est une **donnée
   d'entrée pour la conception DSE / doc de blocs**.

## Recommandation

Le verrou technique côté éditeur est levé : l'arbitrage « QC d'abord vs
génération d'abord » peut se faire **sur des critères purement produit** (valeur
consultant, risque de contenu, coût LLM), plus sur le risque d'intégration. Si
la génération est retenue : repartir de ce POC (le pattern est le bon), traiter
les 3 prérequis ci-dessus avant toute exposition client, et généraliser la
modale (multi-propositions, contraintes de champs réelles depuis la future doc
de blocs). Si le QC est retenu d'abord : le POC reste un actif — la chaîne
feature→findApplicable→invoke→manifest est désormais documentée par l'exemple.
