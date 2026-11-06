# Recette — Une copie suit la production

À rejouer avant la release qui porte le suivi de la production (ADR 0019, epic #1420), puis à chaque release qui touche les skills, les expertises, leurs versions ou les jetons de lecture. Elle vérifie qu'une copie reçoit ce que la production tient, garde ce qui n'existe que chez elle, et ne lit plus rien une fois son jeton révoqué.

La documentation suivie pendant la recette est [docs/user/skills-follow/](../user/skills-follow/README.md).

## 0. Préparation

Deux instances déployées en https : **P**, qui joue la production (par exemple `https://production.example`), et **C**, la copie. Un compte **super admin** sur chacune, et un compte **admin d'entreprise** sur P. Le suivi refuse le http et les adresses privées : deux instances locales ne suffisent pas.

Sur P :

- une expertise X active en 1.0 ;
- un skill de tâche S actif, ouvert à **Tous les groupes abonnés à l'accès MCP** et proposé aux assistants.

Sur C, aucune variable `SKILLS_SOURCE_*` pour commencer.

## 1. Jeton de lecture

1. Sur C, onglet **Synchronisation** : seule la section **Jetons de lecture** apparaît, pas **Suivre la production**.
2. Sur P, **Créer un jeton** nommé « Recette ». Le jeton s'affiche une fois ; **J'ai enregistré le jeton** reste indisponible tant que l'on n'a pas cliqué sur **Copier**.
3. Fermer : la liste montre « Recette », « jamais utilisé ». Recharger la page : le jeton n'est plus affiché nulle part.
4. Avec le compte **admin d'entreprise** de P, `GET /api/ai-skills/read-tokens` répond 401.

## 2. Configurer la copie

1. Sur C, renseigner `SKILLS_SOURCE_URL` (l'adresse de P) et `SKILLS_SOURCE_TOKEN` (le jeton de l'étape 1), puis redémarrer.
2. Onglet **Synchronisation** de C : la section **Suivre la production** apparaît avec « Production : » suivi de l'origine de P, sans le jeton, et « La production n'a encore jamais été suivie. ».

## 3. Premier suivi

1. **Suivre maintenant**. Le dernier suivi est **Réussi**, à votre nom, avec X et S **ajoutée(s)**.
2. Sur C, X et S sont **actifs**, aux mêmes numéros que sur P. S est ouvert aux groupes abonnés et proposé aux assistants, comme sur P.
3. Sur P, le jeton « Recette » indique maintenant une dernière utilisation.
4. **Suivre maintenant** une seconde fois : tout est **déjà à jour**, rien n'est réécrit.

## 4. Un brouillon qui arrive

1. Sur P, ouvrir une version mineure 1.1 de X, la modifier et l'enregistrer, sans publier.
2. Sur C, **Suivre maintenant** : X est **mise(s) à jour**. La 1.0 reste active et un brouillon 1.1 porte le contenu de P.
3. Sur P, publier la 1.1. Sur C, suivre : la 1.1 est **active** et la 1.0 **archivée**.

## 5. Ce que la copie garde

1. **Local seul :** sur C, créer un skill T qui n'existe pas sur P, puis suivre : T est compté dans **conservée(s) sur la copie** et reste intact.
2. **Brouillon local plus récent :** sur C, ouvrir un brouillon 2.0 de X ; sur P, ouvrir un brouillon 1.2 de X ; suivre : le brouillon 2.0 de C n'est pas écrasé.
3. **Copie en avance :** sur C, publier ce 2.0 ; suivre : X est **conservée(s) sur la copie**, toujours en 2.0.
4. **Audience :** sur P, fermer S au groupe plateforme ; suivre : sur C, S n'est plus ouvert qu'au groupe plateforme.

## 6. Suivi de nuit

1. Sur C, lancer la commande à la main (`yarn follow-production`, ou une tâche ponctuelle de l'hébergeur) : elle sort en 0, et l'onglet indique « Dernier suivi le …, par le suivi de nuit ».
2. Sur P, la même commande dit qu'il n'y a rien à suivre et sort en 0.
3. Le lendemain, vérifier dans les logs de l'hébergeur que la tâche de 3 h (UTC) a tourné sur C.

## 7. Une production injoignable

1. Sur C, mettre `SKILLS_SOURCE_URL` sur une adresse qui ne répond pas (par exemple `https://injoignable.example`), redémarrer, suivre.
2. Le dernier suivi est **Échoué**, avec « La production n'a pas pu être jointe. Rien n'a été écrit. ». Les listes de C n'ont pas changé.
3. Mettre une adresse en `http://` : **Échoué**, « L'adresse de la production n'est pas une adresse https valide. ».
4. Remettre l'adresse de P et redémarrer.

## 8. Un jeton révoqué

1. Sur P, **Révoquer** le jeton « Recette » et confirmer : la confirmation dit que la copie ne pourra plus lire cette instance.
2. Sur C, suivre : **Échoué**, « La production a refusé le jeton de lecture : il a peut-être été révoqué. Rien n'a été écrit. ».
3. Sur P, créer un nouveau jeton, le mettre dans `SKILLS_SOURCE_TOKEN` de C, redémarrer, suivre : **Réussi**.

## 9. Droits

Avec le compte **admin d'entreprise** : `GET` et `POST /api/ai-skills/follow` répondent 401. Sans jeton, `GET /api/skills-source/export` répond 401 ; avec un jeton valide, `GET /api/ai-skills` répond toujours 401 : un jeton ne lit que l'export.
