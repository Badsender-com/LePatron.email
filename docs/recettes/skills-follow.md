# Recette — Une copie suit la production

À rejouer avant la release qui porte le suivi de la production (ADR 0019, epic #1420), puis à chaque release qui touche les skills, les expertises, leurs versions ou les jetons de lecture. Elle vérifie qu'une copie suit en tout ce que la production tient, ne perd jamais le travail fait sur elle, laisse tel quel ce qui n'existe que chez elle, et ne lit plus rien une fois son jeton révoqué.

La documentation suivie pendant la recette est [docs/user/skills-follow/](../user/skills-follow/README.md).

## 0. Préparation

Deux instances déployées en https : **P**, qui joue la production (par exemple `https://production.example`), et **C**, la copie. Un compte **super admin** sur chacune, et un compte **admin d'entreprise** sur P. Le suivi refuse le http et les adresses privées : deux instances locales ne suffisent pas. Pour les étapes en base, le shell Compass de chaque instance.

Sur P :

- une expertise X active en 1.0, ouverte à **Tous les groupes abonnés à l'accès MCP** ;
- un **skill de fonctionnalité** F actif, ouvert à **Tous les groupes abonnés à l'accès MCP** et **proposé aux assistants** (la case n'existe que pour un skill de fonctionnalité) ;
- une expertise D en brouillon, jamais publiée ;
- deux expertises E et K actives en 1.0.

C joue une recette qui existait avant le suivi. Sur C, aucune variable `SKILLS_SOURCE_*` pour commencer, et déjà des éléments :

- E et K, importées plus tôt depuis P par fichier, puis modifiées et publiées sur C : leur version active diffère de celle de P ;
- une expertise L, qui n'existe que sur C.

## 1. Jeton de lecture

1. Sur P, onglet **Production et copies**, **Créer un jeton** nommé « Recette ». Le jeton s'affiche une fois.
2. Refuser au navigateur l'accès au presse-papiers (ou ne pas cliquer sur **Copier**), copier le jeton à la main, confirmer qu'il est enregistré : la fenêtre se ferme.
3. La liste montre « Recette », « jamais utilisé ». Recharger la page : le jeton n'est plus affiché nulle part.
4. Dans la base de P, `db.securityevents.find().sort({ _id: -1 }).limit(1)` montre la création du jeton, à votre nom.
5. Avec le compte **admin d'entreprise** de P, `GET /api/ai-skills/read-tokens` répond 401.

## 2. Configurer la copie

1. Sur C, renseigner `SKILLS_SOURCE_URL` (l'adresse de P) et `SKILLS_SOURCE_TOKEN` (le jeton de l'étape 1), sans `SKILLS_SOURCE_NIGHTLY`, puis redémarrer.
2. Onglet **Production et copies** de C : la section **Suivre la production** apparaît avec « Production : » suivi de l'origine de P, sans le jeton, et « La production n'a encore jamais été suivie. ». Elle dit que le suivi de nuit n'est pas actif sur cette instance.
3. Sur C, **Créer un jeton** n'apparaît pas.
4. Sur C, E, K et L portent le badge **Pas encore suivi**.
5. Sur K, section **Origine sur cette copie**, **Garder sur cette copie** est proposé alors que K n'a jamais été suivie : le choisir. K porte le badge **Gardé sur cette copie**.

## 3. Premier suivi d'une copie qui a déjà des éléments

1. **Suivre maintenant**, le premier suivi lancé à la main. Le dernier suivi est **Réussi**, à votre nom, avec X, F et D **ajoutés**.
2. Le rapport montre E en **travail de la copie mis de côté** : la version active de C est en brouillon dans un nouvel élément `<id de E>.copie`, intitulé « <titre de E> (travail de la copie) », et E porte maintenant la 1.0 de P.
3. K est **gardé sur cette copie** : sa version de C n'a pas changé. L n'est pas touchée, et porte le badge **Écrit sur cette copie**.
4. Sur C, X et F sont **actifs**, aux mêmes numéros que sur P, et D est en brouillon. F est ouvert aux groupes abonnés et proposé aux assistants, comme sur P. X, F, D et E portent le badge **Suit la production** ; plus aucun élément ne porte **Pas encore suivi**.
5. Sur P, le jeton « Recette » indique maintenant une dernière utilisation.
6. **Suivre maintenant** une seconde fois : tout est **déjà à jour**, rien n'est réécrit (la date de mise à jour de X ne change pas).

## 4. Un brouillon qui arrive

1. Sur P, ouvrir une version mineure 1.1 de X, la modifier et l'enregistrer, sans publier.
2. Sur C, suivre : X est **mis à jour**. La 1.0 reste active, et un brouillon 1.1 porte le contenu de P. En base, cette version porte `followedAt`.
3. Sur P, publier la 1.1. Sur C, suivre : la 1.1 est **active** et la 1.0 **archivée**.

## 5. L'audience, l'archivage et les assistants suivent

1. Sur P, fermer F à l'entreprise plateforme et décocher **proposé aux assistants**. Sur C, suivre : F n'est plus ouvert qu'à l'entreprise plateforme, ni proposé aux assistants.
2. Sur P, rouvrir F aux groupes abonnés et le proposer aux assistants. Sur C, suivre : F l'est de nouveau.
3. Sur P, archiver une version ou un élément suivi ; sur C, suivre : il est archivé aussi.
4. Sur P, vider la description de X. Sur C, suivre : la description de X est vide sur C aussi.

## 6. Le travail de la copie n'est jamais perdu

1. **Un brouillon de la copie, tant que la production n'en a pas :** sur C, ouvrir un brouillon 1.2 de X et y écrire « travail de C ». Suivre : le brouillon reste où il est, intact.
2. **Puis la production apporte un brouillon :** sur P, ouvrir un brouillon 1.2 de X avec un autre contenu. Sur C, suivre : le rapport montre X en **travail de la copie mis de côté**, avec un lien.
3. Le lien mène à un nouvel élément `<id de X>.copie`, intitulé « <titre de X> (travail de la copie) », badge **Travail de la copie** avec un lien vers X. Il tient « travail de C » en brouillon, il est réservé à l'entreprise plateforme et n'est pas proposé aux assistants. X porte maintenant le brouillon 1.2 de P.
4. **Une version publiée sur la copie :** sur C, ouvrir un brouillon de F, le publier en **décochant** **Garder sur cette copie** : F garde le badge **Suit la production**, et la version publiée sur C est active jusqu'au suivi. Suivre : le rapport montre F en **travail de la copie mis de côté**. La version publiée sur C est en brouillon dans un nouvel élément de la copie, et F a repris la version active de P.
5. Suivre encore : les deux éléments du travail de la copie ne sont pas touchés.

## 7. Garder sur cette copie, puis suivre de nouveau

1. Sur C, modifier le brouillon 1.2 de X (y écrire « gardé par C ») et le publier : la case **Garder sur cette copie** est proposée, **cochée**. La laisser cochée. X porte le badge **Gardé sur cette copie**.
2. Sur P, publier le brouillon 1.2 de X. Sur C, suivre : le rapport montre X **gardé sur cette copie**, et dit que la production l'a changé. X garde sur C la version publiée à l'étape 1.
3. Sur C, sur la fiche de X, section **Origine sur cette copie**, **Suivre la production** : le badge redevient **Suit la production**. Suivre : « gardé par C » est mis de côté dans un nouvel élément (`<id de X>.copie-2`), et X a repris la version active de P.

## 8. Dupliquer sur cette copie

1. Sur C, sur la fiche de F, section **Origine sur cette copie**, **Dupliquer sur cette copie**, en choisissant la version active.
2. Un nouvel élément de la copie apparaît, intitulé « <titre de F> (travail de la copie) », avec cette version en brouillon, réservé à l'entreprise plateforme et non proposé aux assistants. F n'a pas changé.
3. Suivre : le nouvel élément n'est pas touché.

## 9. Ce que la production supprime, et ce que la copie a écrit

1. **Brouillon supprimé :** sur P, ouvrir un brouillon de F ; sur C, suivre (le brouillon arrive). Sur P, supprimer ce brouillon ; sur C, suivre : le rapport montre un **brouillon supprimé**, nommé « brouillon <numéro> de F », qui a disparu de C. F reste, avec sa version active.
2. **Élément jamais publié supprimé :** sur P, supprimer D. Sur C, suivre : le rapport montre D comme **élément supprimé**, distinct d'un brouillon supprimé, et D a disparu de C.
3. **Ce que la copie a écrit :** sur C, créer une expertise T qui n'existe pas sur P. Elle porte le badge **Écrit sur cette copie**. Suivre : T reste intacte. Les éléments du travail de la copie des étapes 6 à 8 sont toujours là.
4. **Puis la production prend le même identifiant :** sur P, créer et publier une expertise avec l'identifiant de T. Sur C, suivre : T porte maintenant le badge **Suit la production** et la version de P, et le rapport montre T en **travail de la copie mis de côté** : le contenu écrit sur C est en brouillon dans `<id de T>.copie`.

## 10. Un skill de fonctionnalité qui naît avant son code

1. Sur P, créer un skill de fonctionnalité en brouillon dont le schéma d'entrée n'existe pas dans le code de P (par exemple `fonctionnalite-a-venir`). L'enregistrement avertit, et un badge reste sur le brouillon.
2. Publier ce brouillon : la publication est refusée, avec un message qui dit que le schéma manque au code de cette instance.
3. Sur C, suivre : le brouillon arrive, avec le même badge si le code de C n'a pas ce schéma, sans badge si C tourne sur une branche qui le déclare.

## 11. Suivi de nuit

1. Sur C, sans `SKILLS_SOURCE_NIGHTLY`, lancer la commande à la main (`yarn follow-production`, ou une tâche ponctuelle de l'hébergeur) : elle ne suit rien et sort en 0.
2. Sur C, mettre `SKILLS_SOURCE_NIGHTLY` à `true` et redémarrer : l'onglet dit que le suivi de nuit est actif sur cette instance.
3. Relancer la commande : elle sort en 0, et l'onglet indique « Dernier suivi le …, par le suivi de nuit ».
4. La relancer aussitôt : elle dit qu'un suivi de nuit a commencé il y a moins de 60 minutes et ne suit pas. Le dernier suivi de l'onglet n'a pas changé. **Suivre maintenant** suit toujours.
5. Sur P, la même commande dit qu'il n'y a rien à suivre et sort en 0.
6. Le lendemain, vérifier dans les logs de l'hébergeur que la tâche de 3 h (UTC) a tourné sur C : `clevercloud/cron.json` sur Clever Cloud, `cron.json` sur Scalingo. Si C tourne sur plusieurs instances, un seul suivi de nuit est enregistré : les autres instances ont trouvé un suivi en cours, ou un suivi de nuit commencé il y a moins de 60 minutes, et n'ont rien écrit.

## 12. Un seul suivi à la fois

1. Ouvrir l'onglet de C dans deux fenêtres, et cliquer sur **Suivre maintenant** dans les deux, aussitôt l'un après l'autre : l'un suit, l'autre dit qu'un suivi est déjà en cours.
2. Pendant un suivi, lancer `yarn follow-production` sur C : la commande trouve un suivi en cours et n'écrit rien.
3. En base de C, `db.skillsfollows.find().sort({ _id: -1 }).limit(2)` montre chaque suivi, celui en cours compris tant qu'il tourne.

## 13. Une production injoignable

1. Sur C, mettre `SKILLS_SOURCE_URL` sur une adresse qui ne répond pas (par exemple `https://injoignable.example`), redémarrer, suivre.
2. Le dernier suivi est **Échoué**, avec « La production n'a pas pu être jointe. Rien n'a été écrit. ». Les listes de C n'ont pas changé.
3. Mettre une adresse en `http://` : **Échoué**, « L'adresse de la production n'est pas une adresse https valide. ».
4. Remettre l'adresse de P et redémarrer.

## 14. Un jeton révoqué

1. Sur P, **Révoquer** le jeton « Recette » et confirmer : la confirmation dit que la copie ne pourra plus lire cette instance.
2. En base de P, le jeton porte l'auteur de la révocation, et `db.securityevents` montre la révocation, à votre nom.
3. Sur C, suivre : **Échoué**, « La production a refusé le jeton de lecture : il a peut-être été révoqué. Rien n'a été écrit. ».
4. Sur P, créer un nouveau jeton, le mettre dans `SKILLS_SOURCE_TOKEN` de C, redémarrer, suivre : **Réussi**.

## 15. Droits

1. Avec le compte **admin d'entreprise** : `GET` et `POST /api/ai-skills/follow` répondent 401, comme `POST` et `DELETE /api/ai-skills/<id>/keep-on-copy` et `POST /api/ai-skills/<id>/duplicate-on-copy`, et leurs équivalents sous `/api/ai-expertise`.
2. Avec le compte **super admin** de P : ces trois dernières routes répondent 409, puisque P n'est pas une copie. Les badges et les trois actions n'apparaissent pas sur P.
3. Sans jeton, `GET /api/skills-source/export` répond 401 ; avec un jeton valide, `GET /api/ai-skills` répond toujours 401 : un jeton ne lit que l'export.
