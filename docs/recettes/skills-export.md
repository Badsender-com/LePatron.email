# Recette — Export et import des skills et expertises

À rejouer avant la release qui porte l'export de skills (ADR 0018, epic #1406), puis à chaque release qui touche les skills, les expertises ou leurs versions. Elle vérifie qu'un skill et ses expertises passent d'une instance à une autre, en brouillon, sans rien ouvrir à l'extérieur.

La documentation suivie pendant la recette est [docs/user/skills-export/](../user/skills-export/README.md).

## 0. Préparation

Deux instances : **A**, la source (par exemple le staging), et **B**, la cible (une autre instance de staging, ou A elle-même avec une base vide pour les skills). Un compte **super admin** sur chacune, et un compte **admin d'entreprise** sur B.

Sur A :

- un skill de tâche actif qui consomme deux expertises actives, X et Y ;
- un skill de fonctionnalité actif ;
- une expertise archivée et une expertise jamais publiée.

## 1. Exporter

1. Sur A, onglet **Expertise** : les cases de l'expertise archivée et de celle jamais publiée ne se cochent pas.
2. Cocher le skill de tâche : la barre propose X et Y. Retirer Y, puis **Exporter la sélection**.
3. Ouvrir le fichier : il porte `"format": 1`, l'origine A, la date et votre nom. Il contient le skill de tâche et X, pas Y. Aucun élément ne porte d'`audience`, de `servedToAssistants` ni d'`owner`.
4. **Tout exporter** : le fichier contient chaque skill et chaque expertise actifs, rien d'archivé ni de jamais publié.

## 2. Aperçu sur la cible

1. Sur B, **Importer**, puis le fichier de l'étape 1.4, puis **Voir l'aperçu**. Vérifier que rien n'est encore écrit : les listes de B n'ont pas changé.
2. Chaque élément absent de B est **Nouveau** et coché ; un élément identique sur A et B est **À jour** et ne se coche pas.
3. Importer le fichier de l'étape 1.2 sur une B sans Y : le skill de tâche est **Nouveau**, avec l'avertissement « Expertises absentes ici et du fichier : Y ».
4. **Refus du fichier :** un fichier qui n'est pas du JSON, un fichier dont on a changé `format` en `2`, un fichier de plus de 5 Mo sont refusés avant l'aperçu, avec un message.

## 3. Importer

1. Importer la sélection. Le compte-rendu indique les éléments créés, avec un lien vers chaque brouillon.
2. Ouvrir un brouillon : il porte le numéro de version de A, il est **en brouillon**, sans version active. Son audience est l'**entreprise plateforme**, il n'est pas servi aux assistants, et vous en êtes propriétaire.
3. Publier le brouillon du skill de tâche : il fonctionne comme sur A.

## 4. Mises à jour et blocages

Sur B, publier le brouillon de X importé à l'étape 3 : sans version active ici, X serait bloqué par ce brouillon. Sur A, publier une nouvelle version mineure de X, puis l'exporter. Sur B :

1. **Mise à jour :** X est **Mise à jour**. Après l'import, la version active de B sert toujours, et un brouillon porte le numéro de A.
2. **Brouillon ouvert :** sans publier ce brouillon, réimporter le même fichier : X est **Bloqué**, « Un brouillon est ouvert ici ».
3. **Divergence :** sur B, publier le brouillon. Réimporter le même fichier : X est **À jour**. Puis, dans le fichier, modifier le `body` de X sans toucher à son numéro, et le réimporter : **Bloqué**, « les deux instances ont divergé ». Une version active ne se modifie pas : la divergence se fabrique dans le fichier.
4. **Plus récent ici :** importer un fichier plus ancien que la version active de B : **Bloqué**, « Une version plus récente existe ici ».
5. **Archivé ici :** archiver X sur B, réimporter : **Bloqué**, « Archivé ici ».
6. **Schéma manquant :** dans un fichier, remplacer l'`inputSchemaId` du skill de fonctionnalité par un identifiant inconnu, et son `skillId` par un identifiant que B n'a pas (sinon, le brouillon importé à l'étape 3 le bloque avant) : **Bloqué**, « Son schéma n'existe pas sur cette instance ».

7. **Version déjà là :** sur B, sur le skill de tâche (X est archivé depuis l'étape 5), créer deux nouvelles versions mineures, publier la seconde, puis la première, restée en brouillon derrière elle : la seconde est archivée. Dans un fichier, donner au skill de tâche le numéro de cette version archivée, puis l'importer : **Bloqué**, « Cette version existe déjà ici ».
8. **Autre nature :** dans un fichier, passer la `nature` du skill de tâche à `feature`, et son numéro à une version plus haute que toutes celles qu'il a sur B : **Mise à jour**, avec l'avertissement « Autre nature ici : la version importée sera un brouillon « Skill de fonctionnalité », et la publier changera la nature de ce skill ». Après l'import, le brouillon a la nature `feature`, et la version active de B garde la sienne.
9. **Fichier mal formé :** une catégorie inconnue, un `body` qui n'est pas du texte, un même élément deux fois : le fichier est refusé avant l'aperçu.
10. **Version refusée par le modèle :** une expertise nouvelle dont deux sections ont le même identifiant (`## [a] Un` et `## [a] Deux`) : l'import la met en échec avec la raison, et elle n'apparaît pas dans la liste.

## 5. Droits

Avec le compte **admin d'entreprise** de B : la page Skills & Expertise n'est pas accessible, et les appels `POST /api/ai-skills/export`, `/api/ai-skills/import/preview` et `/api/ai-skills/import` répondent 401.
