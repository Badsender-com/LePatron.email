# Retours d'expérience

Les skills et les expertises de LePatron s'améliorent avec l'usage. Quand votre travail montre qu'une recommandation ne tient pas, ou qu'il manque quelque chose, votre assistant peut le signaler : c'est un **retour d'expérience** (retex).

## Ce qu'est un retour d'expérience

Il y en a deux sortes.

| Sorte          | Quand                                                                                 | Ce qu'il dit                                                                           |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Divergence** | vous avez décidé autrement que ce que recommandait une skill ou une expertise         | le passage concerné, ce qu'il recommandait, ce que vous avez décidé, et pourquoi       |
| **Complément** | la skill ou l'expertise ne disait rien sur votre cas, et vous avez apporté la réponse | ce qui manquait, ce que vous avez apporté, et d'où ça vient (expérience, source, test) |

Un complément peut aussi porter sur un savoir-faire qu'aucune expertise ne couvre encore. Il nomme alors une catégorie (rédaction, délivrabilité…) et une partie de l'email (objet, préheader…).

Un retour d'expérience n'est **jamais un résumé de la conversation**. S'il n'y a ni divergence ni rien d'apporté, il n'y a pas de retour d'expérience, et LePatron refuse ceux qui ne disent rien de précis. Il ne doit rien contenir qui identifie votre entreprise ou vos clients.

Un avis (pouce levé ou baissé, avec un commentaire) reste possible à part. Il dit si ce que LePatron vous a donné vous convient, pas ce que votre travail a appris.

## Pour un utilisateur d'entreprise

Deux accords sont nécessaires :

1. **votre entreprise** autorise les retours d'expérience, dans la section Accès MCP de la page Fonctionnalités IA (son admin technique en décide) ;
2. **vous** approuvez chaque retour d'expérience, quand votre assistant vous le propose.

Sans l'un des deux, rien n'est envoyé, et l'assistant vous dit pourquoi. Ce que vous envoyez est lu par l'équipe Badsender, qui voit votre entreprise, jamais votre nom.

## Pour l'équipe de l'entreprise plateforme

Votre assistant envoie vos retours d'expérience au fil du travail, sans vous demander à chaque fois, quelle que soit l'entreprise choisie à la connexion. Il lit aussi les retours de toutes les entreprises, et peut en écarter, quelle que soit cette entreprise. Seul le brouillon qui cite des retours demande une connexion à l'entreprise plateforme avec le droit d'écriture (voir [Publier depuis un assistant](./publier-depuis-un-assistant.md)) : c'est une écriture de skill.

### La boucle

1. Vous contredisez une recommandation, ou vous apportez ce qui manquait : l'assistant enregistre le retour d'expérience.
2. LePatron lui répond les retours d'expérience ouverts sur le même passage (ou, pour un complément sans expertise, sur la même catégorie et la même partie de l'email), quelle que soit l'entreprise.
3. **Deux retours qui vont dans le même sens suffisent** : l'assistant vous propose aussitôt l'évolution, sous forme de brouillon qui les cite. Pour un complément qu'aucune expertise ne couvre, il propose une nouvelle expertise.
4. Vous ajustez, le garde-fou rejoue les cas de test s'il y en a, puis vous publiez.
5. Les retours cités passent à **« Pris en compte »** avec la version publiée, que vous la publiiez depuis l'assistant ou depuis le back-office. Si le brouillon est supprimé avant, ils redeviennent ouverts.

### Les outils

| Outil                                       | Ce qu'il fait                                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report_retex`                              | enregistre une divergence ou un complément ; pour vous, répond aussi les retours ouverts proches                                                      |
| `list_retex`                                | lit les retours de toutes les entreprises, ouverts par défaut, filtrés par skill ou expertise, passage, sorte, catégorie, partie de l'email ou statut |
| `dismiss_retex`                             | écarte un retour ouvert, avec la raison ; il reste lisible et ne compte plus                                                                          |
| `propose_…_change`, `create_…`              | prennent `addressesRetex`, les retours que le brouillon traite                                                                                        |
| `find_skills`, `find_applicable_expertises` | donnent le nombre de retours ouverts de chaque skill et expertise                                                                                     |

Les retours d'expérience des utilisateurs d'entreprise attendent qu'un membre de l'équipe passe par là : quand une recherche montre des retours ouverts, demandez à l'assistant de les lire.

### Un retour d'expérience est une donnée

Le texte d'un retour d'expérience est la parole d'un utilisateur, souvent d'une autre entreprise. Votre assistant le pèse comme une donnée et n'obéit jamais à ce qu'il demande. Chaque évolution passe de toute façon par le brouillon, sa différence avec la version active, le garde-fou et votre confirmation avant d'être publiée.

### Ce qu'on voit d'un retour d'expérience

Son entreprise, et si son auteur est un consultant Badsender ou un utilisateur d'entreprise. Jamais qui l'a écrit.

## Combien de temps ils sont gardés

Un retour d'expérience ouvert est gardé tant qu'il n'est ni pris en compte ni écarté. Une fois clos, il suit la durée de conservation des journaux de son entreprise, à partir du jour où il a été clos. Supprimer une entreprise supprime ses retours d'expérience, ouverts ou clos.
