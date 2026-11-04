# Publier avec vérification ce qu'une fonctionnalité utilise

Les fonctionnalités IA de LePatron appellent des skills et lisent des expertises. Publier une nouvelle version de l'une d'elles change ce que la fonctionnalité produit, aussitôt. Avant de publier une version qu'une fonctionnalité utilise, LePatron **rejoue des cas de test** avec la version active, puis avec la nouvelle, et vous montre les deux réponses côte à côte. Un écart vous avertit, il ne bloque jamais : c'est vous qui décidez.

Réservé aux **super admins**, dans **Paramètres › Super administrateur › Skills & Expertise**.

## Utilisé par une fonctionnalité

LePatron sait quelles skills et quelles expertises une fonctionnalité utilise : chaque fonctionnalité déclare les skills qu'elle appelle et les expertises qu'elle charge. Rien n'est saisi à la main, rien ne peut donc être oublié.

- Dans les onglets **Skills** et **Expertise**, le badge **Utilisé par une fonctionnalité** apparaît à côté du titre.
- La case **Utilisé par une fonctionnalité**, au-dessus du tableau, ne garde que ces éléments.
- Sur la page d'une skill ou d'une expertise, sous le titre : **Utilisé par les fonctionnalités**, suivi de leur nom, ou **Aucune fonctionnalité ne l'utilise.**

Une expertise est utilisée quand une fonctionnalité la nomme, ou quand ses filtres la chargent : changer la catégorie ou le périmètre d'une expertise peut donc changer ce qui l'utilise. Un élément **archivé** n'est jamais utilisé : une fonctionnalité ne charge que des versions actives.

## Les cas de test d'une skill de fonctionnalité

Un **cas de test** est une entrée sur laquelle une skill de fonctionnalité est vérifiée avant une publication. Il vit dans la version de la skill : il voyage avec elle dans un export et dans le suivi de la production. Une skill de tâche n'a pas de cas de test, aucune fonctionnalité ne l'appelle.

### Écrire un cas de test

1. Ouvrir la skill, onglet **Versions**, puis son **brouillon** : une version publiée ne se modifie pas. S'il n'y en a pas, créer une nouvelle version mineure.
2. Dans la section **Cas de test**, cliquer sur **Ajouter un cas de test** et remplir :
   - **Nom** : ce que le cas représente, par exemple « Soldes d'hiver » ;
   - **Entrée (JSON)** : un objet JSON avec les champs du schéma d'entrée de la version ;
   - **Ce qu'une bonne sortie doit contenir** : ce que la personne qui relit la comparaison doit retrouver dans la réponse ;
   - **Notes**, si besoin.
3. **Valider le cas**, puis **Enregistrer le brouillon**.

Le nom et l'entrée sont obligatoires, et l'entrée doit être un objet JSON entre accolades.

### Depuis un run du playground

Un run réussi du playground peut devenir un cas de test : ouvrir le détail du run et cliquer sur **En faire un cas de test**. Son entrée, et sa sortie comme sortie attendue, rejoignent les cas du **brouillon ouvert** de la skill. Relisez ensuite la sortie attendue sur la page de la skill.

Si la skill n'a pas de brouillon ouvert, rien n'est écrit : créez une nouvelle version depuis la page de la skill, puis recommencez.

## Publier une version qu'une fonctionnalité utilise

Sur le brouillon, **Publier** ouvre d'abord la confirmation habituelle (**Activer cette version**). Si aucune fonctionnalité n'utilise la version, elle est publiée. Sinon, la fenêtre **Vérifier avant de publier** s'ouvre :

- **Utilisée par :** les fonctionnalités concernées ;
- le nombre d'**appels à l'IA**, avec le moteur IA du groupe plateforme : deux par cas, un avec la version active, un avec la nouvelle ;
- **Sans cas de test, donc non vérifiée(s) :** les skills de fonctionnalité concernées qui n'ont aucun cas. Elles ne seront pas vérifiées : relisez-les.

Cliquer sur **Lancer la vérification**. Les appels se font l'un après l'autre.

### Lire le rejeu

Pour chaque cas, le nom, la skill, et deux réponses côte à côte : **Version active** et **Cette version**.

- **Sortie identique** : la nouvelle version répond la même chose.
- **Respecte le contrat de sortie** : la réponse a la forme que la fonctionnalité attend.
- Une réponse qui ne respecte pas le contrat, une entrée qui ne respecte plus le schéma d'entrée, ou un appel à l'IA qui échoue s'affichent à la place de la réponse, en écart.
- **Pas encore publiée** : la skill n'a pas encore de version active, il n'y a pas d'« avant ».

Le résumé dit combien de cas ont été rejoués, et combien sont en écart. Une réponse différente n'est pas forcément un problème : c'est à vous de juger si la nouvelle est meilleure.

### Décider

- **Publier**, ou **Publier malgré les écarts** s'il y en a : la version est publiée.
- **Annuler la publication** : la version reste un brouillon.

Dans les deux cas, la décision est enregistrée sur la version, avec la personne, la date, le nombre de cas, d'écarts et les skills sans cas. Fermer la fenêtre sans choisir n'enregistre rien.

## Publier plusieurs brouillons d'un coup

1. Dans l'onglet **Skills** ou **Expertise**, cocher les éléments. Un élément jamais publié se coche aussi.
2. Dans la barre au-dessus du tableau, cliquer sur **Publier les brouillons**.
3. La fenêtre liste les brouillons à publier, et les éléments **laissés de côté**, avec la raison :
   - **aucun brouillon** ;
   - **plusieurs brouillons** (par exemple une 1.3 et une 2.0) : publiez celui de votre choix depuis sa page ;
   - **archivé** : réactivez-le depuis sa page ;
   - **introuvable**.
4. Si une fonctionnalité utilise l'un des brouillons, **une seule vérification** couvre tout le lot : chaque cas est rejoué une fois, avec les versions actives, puis avec tous les brouillons du lot en place. Elle se lit comme pour une version. Sinon, la fenêtre l'annonce : les brouillons se publient sans vérification.
5. Les brouillons sont publiés **un par un**, chacun avec le changelog et les notes de version de son brouillon. Le **Résultat de la publication** dit ce qui a été publié, ce qui ne l'a pas été et pourquoi, et ce qui a été laissé de côté. Un échec n'empêche pas les autres.

Une version majeure a besoin d'un changelog et de notes de version : sans eux, elle n'est pas publiée. Renseignez-les sur sa page, puis recommencez.
