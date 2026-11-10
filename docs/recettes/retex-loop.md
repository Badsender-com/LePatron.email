# Recette — La boucle des retours d'expérience

À rejouer avant la release qui porte les retours d'expérience (ADR 0021, epic #1472), puis à chaque release qui touche les outils MCP d'écriture, la publication ou les avis. Elle vérifie qu'un retour d'expérience est une divergence ou un complément, jamais un résumé, que deux retours qui convergent mènent à un brouillon qui les cite, et que sa publication les clôt.

La documentation suivie pendant la recette est [Retours d'expérience](../user/mcp/fr/retours-d-experience.md). Les outils sont nommés en clair dans les demandes à l'assistant : il s'en sert sans qu'on ait à les appeler soi-même.

## 0. Préparation

Sur le staging :

- un compte **super admin**, et un compte **utilisateur** d'un groupe A qui a l'accès MCP ;
- une expertise **E** active, dont le texte a des sections ancrées (`## [longueur] Longueur`), lisible par le groupe A ;
- aucune expertise sur les préheaders en arabe ;
- trois connexions : l'utilisateur, connecté au groupe A ; le super admin, connecté au groupe A (la case d'écriture n'y est pas proposée) ; le super admin, connecté à l'entreprise plateforme, la case d'écriture cochée.

## 1. Un utilisateur d'entreprise

- [ ] Le groupe A n'autorise pas les retours d'expérience. Avec l'utilisateur, contredire une recommandation de la section `longueur` de E et demander à l'assistant de le signaler : il répond qu'il n'a rien envoyé, parce que l'entreprise ne l'autorise pas.
- [ ] Autoriser les retours d'expérience pour le groupe A (Fonctionnalités IA, section Accès MCP). Recommencer en refusant quand l'assistant demande l'approbation : rien n'est envoyé.
- [ ] Recommencer en approuvant : le retour est gardé.
- [ ] Demander à l'assistant d'envoyer « un résumé de notre conversation » comme retour d'expérience : LePatron le refuse.
- [ ] Envoyer un avis (pouce baissé et commentaire) : il est enregistré, sans résumé.

## 2. Un consultant, et la convergence

- [ ] Avec le super admin connecté au groupe A : `find_applicable_expertises` sur la partie de E donne `openRetex: 1` pour E.
- [ ] Sur la même connexion, apporter un complément sur la même section de E : l'assistant l'enregistre sans demander d'approbation, et LePatron lui répond le retour de l'utilisateur comme candidat.
- [ ] `list_retex` sur E montre les deux retours, sans nom ni identifiant d'auteur : celui de l'utilisateur avec le groupe A et le rôle `client`, celui du super admin avec l'entreprise plateforme, le rôle `consultant` et le groupe A en contexte (`connectedTo`).
- [ ] Sur cette connexion, l'assistant ne rédige pas l'évolution : les outils d'écriture n'y sont pas, il renvoie à une connexion à l'entreprise plateforme.
- [ ] Avec le super admin connecté à l'entreprise plateforme : l'assistant juge que les deux retours vont dans le même sens et propose l'évolution, un brouillon de E qui les cite (`addressesRetex`).

## 3. Publier, et clore

- [ ] Publier le brouillon depuis le back-office : les deux retours passent à « Pris en compte » avec E et la version publiée (`list_retex`, statut `addressed`, `addressedIn`).
- [ ] Recommencer avec un nouveau retour et un brouillon qui le cite, puis supprimer le brouillon : le retour reste ouvert.

## 4. Un complément sans expertise, et un écart

- [ ] Signaler deux fois un complément sur les préheaders en arabe (catégorie rédaction, partie préheader) : la seconde fois, la première est candidate. L'assistant propose une nouvelle expertise qui les cite (`create_expertise`).
- [ ] Avec le super admin connecté au groupe A, écarter un retour ouvert sans raison : refusé. Avec une raison : il disparaît des retours ouverts, reste lisible avec `status: dismissed`, et n'est plus candidat.

## 5. Les droits

- [ ] Avec l'utilisateur, l'assistant ne liste ni `list_retex` ni `dismiss_retex`, et `find_applicable_expertises` ne donne aucun `openRetex`.
- [ ] Retirer au super admin le droit de gérer la plateforme : `list_retex` est refusé, sur ses deux connexions.

## 6. Couper les retours d'expérience

- [ ] Couper les retours d'expérience du groupe A : les retours de l'utilisateur disparaissent de `list_retex`, ouverts ou clos ; celui du super admin reste, avec l'entreprise plateforme.
