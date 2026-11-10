# Exporter et importer des skills et des expertises

Les skills et les expertises se rédigent sur une instance LePatron. Pour les retrouver sur une autre (la production, une instance dédiée), on les **exporte** dans un fichier, puis on **importe** ce fichier sur l'autre instance. Rien n'est automatique : c'est toujours un fichier qu'un super admin choisit d'emporter.

Réservé aux **super admins**, dans **Paramètres › Super administrateur › Skills & Expertise**.

## Ce que contient un export

- **La version active** de chaque skill et de chaque expertise choisis, avec son numéro, son contenu, son changelog et ses notes de version. Pour un skill de fonctionnalité, son gabarit, ses schémas et ses cas de test.
- **Ce qui les décrit :** titre, description, catégorie, périmètre, filtres, nature.
- **L'origine :** l'instance, la date et la personne qui a exporté.

Il ne contient **ni** les brouillons, **ni** l'historique des versions, **ni** ce qui appartient à l'instance : l'audience, le fait d'être servi aux assistants, le propriétaire. Un élément archivé ou jamais publié ne s'exporte pas.

## Exporter

1. Dans l'onglet **Skills** ou **Expertise**, cocher les éléments à exporter. Ceux qui n'ont pas de version active ne se cochent pas.
2. Une barre apparaît au-dessus du tableau avec le nombre d'éléments choisis.
   - Pour un **skill de tâche**, les expertises qu'il consomme sont ajoutées à l'export, et listées dans la barre. Retirez celles que l'autre instance gère de son côté.
3. Cliquer sur **Exporter la sélection** : le fichier `lepatron-skills-<instance>-<date>.json` se télécharge.

Pour tout emporter d'un coup, **Tout exporter**, en haut de la page, exporte chaque skill et chaque expertise actifs.

## Importer

1. Sur l'autre instance, cliquer sur **Importer**, en haut de la page, et choisir le fichier. Il fait 5 Mo au plus.
2. Cliquer sur **Voir l'aperçu**. Un fichier illisible, d'un autre format ou mal formé est refusé en entier, avec la raison. Sinon, rien n'est encore écrit : l'aperçu dit, pour chaque élément, ce que l'import ferait.

| État            | Ce que ça veut dire                                                  |
| --------------- | -------------------------------------------------------------------- |
| **Nouveau**     | Il n'existe pas sur cette instance.                                  |
| **Mise à jour** | Le fichier porte une version plus récente que la version active ici. |
| **À jour**      | Même version, même contenu : rien à faire.                           |
| **Bloqué**      | L'import ne le touchera pas ; la raison est écrite sous l'élément.   |

Un élément est bloqué quand :

- **les deux instances ont divergé :** même numéro de version, contenu différent. À régler à la main ;
- **une version plus récente existe ici :** l'import ne revient jamais en arrière ;
- **un brouillon est ouvert ici :** publiez-le ou supprimez-le d'abord, l'import ne l'écrase jamais ;
- **cette version existe déjà ici sans être la version active**, par exemple archivée ;
- **il est archivé ici ;**
- **son schéma n'existe pas sur cette instance :** un skill nomme un schéma qui est dans le code. L'instance n'est pas à jour.

Un skill de tâche qui consomme une expertise absente à la fois d'ici et du fichier s'importe quand même, avec un avertissement dans l'aperçu. Le compte-rendu le redit, et prévient aussi quand cette expertise était dans le fichier sans avoir été importée, parce que décochée ou en échec. Son brouillon ne peut pas être publié tant que l'expertise manque : importez-la, ou créez-la avec le même identifiant, puis publiez.

Un skill dont la version active a une autre nature ici (tâche ou fonctionnalité) s'importe en **mise à jour**, avec un avertissement : le brouillon importé garde la nature de la version du fichier, et le publier change la nature du skill.

3. Les éléments nouveaux et les mises à jour sont cochés. Décochez ceux que vous ne voulez pas, puis cliquez sur **Importer la sélection**.

## Après l'import

Une mise à jour apporte une version, pas la description : le titre, la catégorie et le périmètre restent ceux de cette instance.

Chaque élément importé arrive **en brouillon**, avec le numéro de version qu'il a sur l'instance d'origine : les deux instances parlent ainsi de la même « 2.1 ». Sur une mise à jour, la version active continue de servir jusqu'à la publication.

Un élément importé :

- n'est ouvert qu'à l'**entreprise plateforme**, quelle que soit son audience d'origine ;
- n'est **pas servi aux assistants** ;
- a pour **propriétaire** la personne qui a importé.

Le compte-rendu dit ce qui a été créé, mis à jour, ignoré ou en échec, avec un lien vers chaque brouillon. Il reste à les relire et à les **publier**, puis à ouvrir leur audience si besoin, comme pour tout brouillon.

Un élément en échec n'empêche pas les autres d'être importés : le compte-rendu donne la raison.
