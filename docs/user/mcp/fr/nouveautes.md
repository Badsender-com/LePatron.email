# Suivre les nouveautés des skills et des expertises

Les skills et les expertises changent souvent. Votre assistant peut vous dire ce qui a changé, et quand, sans rien deviner : demandez-lui par exemple « Quoi de neuf dans LePatron cette semaine ? » ou « Qu'est-ce qui a changé dans les expertises de délivrabilité depuis le 1er novembre ? ».

## Ce que l'assistant sait de chaque élément

- **Sa version et sa date de publication.** Chaque skill et chaque expertise que lit l'assistant indique sa version et le jour où elle a été publiée, en UTC. Pour une entreprise cliente, la première version qu'elle voit d'un élément est datée du jour où l'élément lui a été ouvert ; les versions publiées ensuite gardent leur date de publication. Une version dont la publication n'a pas été enregistrée n'a pas de date : l'assistant ne l'invente pas.
- **Sa note de version.** Chaque publication dit, en 500 caractères au plus, ce qui change pour qui utilise l'élément. Les anciennes versions mineures publiées avec la phrase générique « Correction mineure sans changement de doctrine. » n'ont pas de note de version.
- **La recherche couvre les skills.** L'outil `search` trouve les skills, comme les mailings et les expertises, par les mots de leur identifiant, de leur titre ou de leur description, et `fetch` lit une skill trouvée avec sa version et sa date. Il ne trouve que les skills que l'assistant peut utiliser : ni une skill archivée, ni une skill de fonctionnalité qui n'est pas proposée aux assistants, ni, hors du mode brouillons de l'entreprise plateforme, une skill jamais publiée.

## Les nouveautés d'une période

L'outil `list_changes` liste, pour une période (les 7 derniers jours par défaut), ce qui a été :

| Nouveauté                                          | Ce qui s'est passé                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| créé (`created`)                                   | un nouvel élément est disponible                                      |
| mis à jour (`updated`)                             | une nouvelle version a été publiée, avec sa note de version           |
| ouvert (`opened`), entreprise plateforme seulement | l'élément est désormais ouvert à toutes les entreprises               |
| retiré (`withdrawn`)                               | l'élément n'est plus disponible : retiré de leur audience, ou archivé |

Les nouveautés sont données dans l'ordre chronologique. Au-delà de 200, seules les 200 plus récentes sont listées, et l'assistant en est prévenu : réduisez la période pour voir les autres.

Une date sans heure vaut la journée entière, en UTC : « du 16 au 22 novembre » inclut le 22.

Un brouillon n'est jamais une nouveauté : seul ce qui a été publié compte.

Pour qui écrit une tâche planifiée : chaque nouveauté donne sa date (`at`), en UTC, au format ISO 8601 terminé par `Z`, sa note de version (`releaseNotes`) et, pour qui lit le journal des modifications, celui de la version (`changelog`).

## Ce que voit chaque entreprise

- **Une entreprise cliente** ne voit que ce qui lui est ouvert, et seulement trois sortes de nouveautés : créé, mis à jour et retiré. Un élément ouvert à toutes les entreprises apparaît comme **créé** le jour de son ouverture, même s'il existait avant pour l'entreprise plateforme : ses versions d'avant ne lui sont jamais montrées. Un élément retiré puis rouvert réapparaît comme **créé**. Un élément retiré n'apparaît que par son titre, et seulement si elle en a vu une version publiée.
- **L'entreprise plateforme** voit tout, ouvertures et retraits compris, avec le **journal des modifications** de chaque version : comment et pourquoi elle a été écrite.
- **Le journal des modifications et les retours d'expérience suivent la personne.** Le journal des modifications est lu par l'entreprise plateforme, et par un super admin quel que soit le connecteur. Un super admin voit aussi, quel que soit le connecteur, les retours d'expérience que chaque version a pris en compte ([Retours d'expérience](./retours-d-experience.md)). Les autres entreprises ne voient ni l'un ni les autres.
- **Par le connecteur d'un client**, le catalogue reste celui du client : un super admin y voit les éléments que ce client voit, datés comme il les voit.

Un élément ouvert à toutes les entreprises avant la mise en place de ce suivi l'est depuis sa première publication : il apparaît créé à cette date. L'historique des ouvertures est enregistré depuis.
