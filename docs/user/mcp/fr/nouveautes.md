# Suivre les nouveautés des skills et des expertises

Les skills et les expertises changent souvent. Votre assistant peut vous dire ce qui a changé, et quand, sans rien deviner : demandez-lui par exemple « Quoi de neuf dans LePatron cette semaine ? » ou « Qu'est-ce qui a changé dans les expertises de délivrabilité depuis le 1er novembre ? ».

## Ce que l'assistant sait de chaque élément

- **Sa version et sa date de publication.** Chaque skill et chaque expertise que lit l'assistant indique sa version et le jour où elle a été publiée, en UTC. Une version dont la publication n'a pas été enregistrée n'a pas de date : l'assistant ne l'invente pas.
- **Sa note de version.** Chaque publication dit, en 500 caractères au plus, ce qui change pour qui utilise l'élément. Les anciennes versions mineures publiées avec la phrase générique « Correction mineure sans changement de doctrine. » n'ont pas de note de version.
- **La recherche couvre les skills.** L'outil `search` trouve les skills, comme les mailings et les expertises, par les mots de leur titre ou de leur description.

## Les nouveautés d'une période

L'outil `list_changes` liste, pour une période (les 7 derniers jours par défaut, 200 nouveautés au plus), ce qui a :

| Nouveauté  | Ce qui s'est passé                                                    |
| ---------- | --------------------------------------------------------------------- |
| créé       | un nouvel élément est disponible                                      |
| mis à jour | une nouvelle version a été publiée, avec sa note de version           |
| ouvert     | l'élément est désormais ouvert à toutes les entreprises               |
| retiré     | l'élément n'est plus disponible : retiré de leur audience, ou archivé |

Une date sans heure vaut la journée entière, en UTC : « du 16 au 22 novembre » inclut le 22.

Un brouillon n'est jamais une nouveauté : seul ce qui a été publié compte.

## Ce que voit chaque entreprise

- **Une entreprise cliente** ne voit que ce qui lui est ouvert. Un élément ouvert à toutes les entreprises apparaît comme **créé** le jour de son ouverture, même s'il existait avant pour l'entreprise plateforme : ses versions d'avant ne lui sont jamais montrées. Un élément retiré n'apparaît que par son titre.
- **L'entreprise plateforme** voit tout, ouvertures et retraits compris, avec le **changelog** de chaque version : comment et pourquoi elle a été écrite. Le changelog n'est jamais montré aux autres entreprises.
- **Un super admin** voit en plus les retours d'expérience que chaque version a pris en compte ([Retours d'expérience](./retours-d-experience.md)).

Les ouvertures se datent depuis la mise en place de ce suivi. Pour les plus anciennes, seules celles faites depuis un assistant, et encore dans le journal des appels, ont pu être reprises : un élément dont l'ouverture n'a pas pu être datée n'apparaît pas comme créé, mais ses versions suivantes apparaissent bien.
