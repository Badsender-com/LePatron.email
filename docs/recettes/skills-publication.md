# Recette — Publier avec vérification ce qu'une fonctionnalité utilise

À rejouer avant la release qui porte le garde-fou à la publication (ADR 0019, epic #1421), puis à chaque release qui touche les skills, les expertises, leurs versions ou les déclarations des fonctionnalités IA. Elle vérifie qu'une version utilisée par une fonctionnalité ne se publie qu'après un rejeu de ses cas de test, que ce rejeu avertit sans bloquer, et qu'un lot de brouillons se publie sous une seule vérification.

La documentation suivie pendant la recette est [docs/user/skills-publication/](../user/skills-publication/README.md).

## 0. Préparation

**Une instance où au moins une fonctionnalité IA déclare les skills qu'elle appelle et les expertises qu'elle charge** (par exemple la génération de texte de l'éditeur). Sans déclaration, rien n'est « utilisé par une fonctionnalité » et le garde-fou ne s'ouvre jamais. En local, un développeur peut déclarer un manifeste de fonctionnalité de test le temps de la recette : il ne se committe jamais.

Le **groupe plateforme** a un moteur IA actif, avec du crédit : le rejeu l'appelle. Un compte **super admin**, et un compte **admin d'entreprise**.

Repérer, sur la page **Skills & Expertise** :

- **S**, une skill de fonctionnalité qu'une fonctionnalité appelle ;
- **T**, une deuxième skill de fonctionnalité appelée par la même fonctionnalité, sans cas de test ;
- **E**, une expertise que cette fonctionnalité charge par ses filtres ;
- **L**, une skill qu'aucune fonctionnalité n'utilise.

## 1. Utilisé par une fonctionnalité

1. Onglet **Skills** : S et T portent le badge **Utilisé par une fonctionnalité**, L non.
2. Cocher la case **Utilisé par une fonctionnalité** : le tableau ne garde que les éléments utilisés, y compris ceux qui étaient au-delà de la première page.
3. Page de S : sous le titre, **Utilisé par les fonctionnalités** et le nom de la fonctionnalité. Page de L : **Aucune fonctionnalité ne l'utilise.**
4. Onglet **Expertise** : E porte le badge. Changer son périmètre pour qu'aucun filtre ne la charge, enregistrer : le badge disparaît. Remettre le périmètre.
5. Archiver une copie de test d'une expertise que les filtres chargent : elle ne porte pas le badge.

## 2. Écrire des cas de test

1. Sur S, créer une nouvelle version mineure. Dans **Cas de test**, **Ajouter un cas de test** :
   - valider sans nom ni entrée : **Ce champ est obligatoire.** ;
   - entrée `[1, 2]` : **L'entrée doit être un objet JSON, entre accolades.** ;
   - entrée `{` : **Ce n'est pas du JSON valide.**
2. Écrire un cas valide, **Valider le cas**, **Enregistrer le brouillon**. Recharger la page : le cas est là.
3. La version active de S montre ses cas en lecture seule, sans bouton d'ajout.
4. Une skill de tâche n'a pas de section **Cas de test**.
5. **Depuis le playground :** ouvrir un run réussi d'un scénario de S, **En faire un cas de test** : le message dit que le cas est ajouté au brouillon. Sur la page de S, le brouillon porte un deuxième cas, avec la note « Depuis un run du playground ». Sur un run de L sans brouillon : le message dit qu'il n'y a pas de brouillon ouvert, et rien n'est écrit.

## 3. Un rejeu qui avertit

1. Sur le brouillon de S, changer le corps de la skill pour qu'elle réponde nettement autrement. Enregistrer, puis **Publier**, puis **Activer**.
2. La fenêtre **Vérifier avant de publier** s'ouvre : **Utilisée par** nomme la fonctionnalité ; le nombre d'appels est le double du nombre de cas.
3. **Lancer la vérification** : chaque cas montre **Version active** et **Cette version** côte à côte, et le résumé compte au moins un écart. Le bouton devient **Publier malgré les écarts**.
4. **Annuler la publication** : le message dit que la version reste un brouillon ; la version active n'a pas changé.
5. Recommencer, et cette fois **Publier malgré les écarts** : le brouillon devient la version active.
6. **Contrat de sortie :** sur un nouveau brouillon de S, changer le corps pour que la réponse ne suive plus le contrat (par exemple demander du texte libre à la place du JSON attendu). Le rejeu affiche **La réponse ne respecte pas le contrat de sortie.** sous **Cette version**, et la publication reste possible.
7. **Moteur indisponible :** désactiver le moteur IA du groupe plateforme, relancer une vérification : chaque cas affiche **L'appel à l'IA a échoué.**, et la publication reste possible. Réactiver le moteur.

## 4. Un cas manquant

1. Sur E, créer une nouvelle version mineure, la modifier, puis **Publier**.
2. La fenêtre annonce **Sans cas de test, donc non vérifiée(s) :** T.
3. Le rejeu ne porte que sur les cas de S : T n'apparaît pas dans les cas rejoués.
4. Publier : la version est active. La décision est enregistrée sur la version (champ `guardHistory` en base : décision, personne, nombre de cas, d'écarts, skills sans cas).

## 5. Une version qu'aucune fonctionnalité n'utilise

Sur L, créer un brouillon et le publier : la confirmation habituelle suffit, aucune fenêtre de vérification ne s'ouvre.

## 6. Une publication groupée

1. Préparer un brouillon sur S, sur E et sur L. Ouvrir une deuxième version majeure en brouillon sur une autre skill **M**, qui a déjà un brouillon mineur.
2. Onglet **Skills**, cocher S, L, M et une skill sans brouillon ; **Publier les brouillons**.
3. La fenêtre liste S et L à publier ; laissés de côté : M (**plusieurs brouillons**) et la skill sans brouillon (**aucun brouillon**).
4. Comme S est utilisée, **Lancer la vérification** : une seule vérification pour le lot. Chaque cas n'apparaît qu'une fois.
5. **Annuler la publication** : le message dit que les brouillons restent des brouillons ; rien n'a été publié.
6. Recommencer et publier : le **Résultat de la publication** liste S et L publiés, et les éléments laissés de côté.
7. **Expertises et skills ensemble :** onglet **Expertise**, cocher E avec un nouveau brouillon, et publier : la vérification rejoue les cas de S avec le brouillon de E en place.
8. **Version majeure sans notes :** un brouillon majeur sans changelog ni notes de version, publié en lot : il apparaît en **Non publiés**, « version majeure : renseignez le changelog et les notes de version sur sa page », et les autres sont publiés.

## 7. Droits

Avec le compte **admin d'entreprise** : la page Skills & Expertise n'est pas accessible, et les appels `POST /api/ai-skills/publications`, `/api/ai-skills/publications/plan`, `/guard` et `/cancel`, comme les routes `publication`, `guard` et `cancel-publication` d'une version, répondent 401.
