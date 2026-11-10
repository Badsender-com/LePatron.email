# Suivre les skills et expertises de la production

La **production** est la source des skills et des expertises : l'entreprise plateforme les y rédige, les y publie et les y ouvre aux clients. Les autres instances, la recette ou le développement, sont des **copies** : elles reçoivent ce que la production tient, et ce qu'on y essaie ne remonte jamais vers la production. Une copie suit la production **à la demande**, depuis son back-office, et **chaque nuit** si son instance l'active.

Réservé aux **super admins**, dans **Paramètres › Super administrateur › Skills & Expertise**, onglet **Production et copies**.

Pour déplacer ponctuellement quelques éléments par un fichier, voir plutôt [Exporter et importer des skills](../../skills-export/fr/exporter-importer.md).

## 1. En production : créer un jeton de lecture

Une copie lit la production avec un **jeton de lecture**.

**Ce qu'un jeton lit.** Tous les skills et toutes les expertises de la production : les versions actives, mais aussi les **brouillons**, les éléments **réservés à l'entreprise plateforme** et les **cas de test**. Il ne lit rien d'autre : ni les emails, ni les utilisateurs, ni les autres routes de l'application.

**À qui le donner.** Seulement à une copie dont tous les super admins peuvent lire tout cela, puisque la copie l'affichera dans son back-office. Si ce n'est pas le cas, transférez plutôt quelques éléments par un fichier (lien ci-dessus).

1. Sur la production, onglet **Production et copies**, section **Jetons de lecture**, cliquer sur **Créer un jeton**.
2. Donner un **Nom** : la copie qu'il sert, par exemple « Recette ». Un jeton par copie : vous pourrez révoquer celle que vous retirez sans toucher aux autres.
3. Le jeton s'affiche **une seule fois**. Copiez-le (bouton **Copier**, ou à la main si le navigateur refuse la copie), transmettez-le à la personne qui configure la copie, puis confirmez que vous l'avez enregistré pour fermer la fenêtre.

La liste montre ensuite chaque jeton avec sa date de création et sa dernière utilisation (« jamais utilisé » tant que la copie ne l'a pas employé). Le jeton lui-même n'est plus jamais affiché : s'il est perdu, révoquez-le et créez-en un autre. La création et la révocation d'un jeton sont enregistrées, avec leur auteur, dans le journal de sécurité.

Une copie ne crée pas de jeton : **Créer un jeton** n'apparaît pas sur une copie. Une copie ne sert jamais de source à une autre copie.

## 2. Sur la copie : la configurer

Une copie se configure dans ses **variables d'environnement**, pas dans une page : le jeton n'est ainsi ni enregistré en base, ni affiché dans le navigateur. C'est le rôle de la personne qui déploie l'instance (voir [DEPLOYMENT.md](../../../DEPLOYMENT.md)).

| Variable                | Valeur                                                                         |
| ----------------------- | ------------------------------------------------------------------------------ |
| `SKILLS_SOURCE_URL`     | L'adresse de la production, en https, par exemple `https://production.example` |
| `SKILLS_SOURCE_TOKEN`   | Le jeton de lecture créé à l'étape 1                                           |
| `SKILLS_SOURCE_NIGHTLY` | `true` pour que cette instance suive la production chaque nuit                 |

Sur la production elle-même, on laisse ces variables vides. Changer de production demande de modifier ces variables, puis de redémarrer l'instance.

Une fois la copie configurée, l'onglet **Production et copies** affiche en tête une section **Suivre la production**, avec l'origine de la production (son adresse, jamais le jeton), et dit si le suivi de nuit est actif sur cette instance. Sans configuration, cette section n'apparaît pas.

## 3. Suivre la production

### À la demande

Cliquer sur **Suivre maintenant**. Le suivi lit d'abord toute la réponse de la production, puis l'applique élément par élément. À la fin, les listes de skills et d'expertises se rechargent, et la section montre le **dernier suivi** (voir [le rapport](#4-le-rapport-dun-suivi)).

### Chaque nuit

Sur une instance où `SKILLS_SOURCE_NIGHTLY` vaut `true`, la copie suit la production toute seule chaque nuit, vers 3 h (UTC), comme si l'on avait cliqué sur le bouton. Le dernier suivi indique alors « par le suivi de nuit ». Quand l'application tourne sur plusieurs instances, chacune lance le suivi de nuit : un suivi de nuit est sauté si un autre a commencé il y a moins de 60 minutes, si bien que la copie ne suit qu'une fois par nuit. Sans cette variable, la copie ne suit la production qu'à la demande, et l'onglet l'indique.

### Un seul suivi à la fois

Un suivi en cours est enregistré en base dès qu'il commence. Tant qu'il tourne, un second suivi est refusé, qu'il vienne du bouton, du suivi de nuit ou d'une autre instance de la même application : la section dit qu'un suivi est déjà en cours. Si le processus qui suivait s'arrête en route, cet enregistrement expire de lui-même, et l'on peut suivre de nouveau.

### Le premier suivi d'une copie qui a déjà des éléments

Une recette qui existait avant le suivi tient des éléments importés par fichier ou écrits sur elle, qu'aucun suivi n'a marqués. Tant que la copie n'a pas réussi un premier suivi, ses éléments portent le badge **Pas encore suivi**.

Le premier suivi reprend **chaque élément dont la production a le même identifiant** : il suit la production à partir de là. Si sa version active sur la copie diffère de celle de la production, elle part en brouillon dans un élément « (travail de la copie) », comme tout travail de la copie. Une recette qui s'est éloignée de la production en aura beaucoup après son premier suivi : rien n'est perdu, et le rapport les liste un par un.

**Avant ce premier suivi**, vous pouvez **Garder sur cette copie** n'importe quel élément, suivi ou non : le premier suivi n'y touchera pas. Lancez ensuite ce premier suivi à la main, avec **Suivre maintenant**, et lisez son rapport.

## 4. Le rapport d'un suivi

Un suivi est **Réussi**, **Réussi en partie** (au moins un élément en échec, les autres ont été écrits, affiché en orange) ou **Échoué** (rien n'a été écrit). Le rapport donne sa date, qui l'a lancé, et ce qui est arrivé à chaque élément :

| Issue                               | Ce que ça veut dire                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ajouté**                          | L'élément n'existait pas sur la copie.                                                                                                                                          |
| **mis à jour**                      | La copie a pris ce que tient la production.                                                                                                                                     |
| **déjà à jour**                     | Rien n'a changé depuis le dernier suivi.                                                                                                                                        |
| **gardé sur cette copie**           | L'élément est gardé sur la copie : le suivi n'y a pas touché. Le rapport dit si la production l'a changé depuis.                                                                |
| **travail de la copie mis de côté** | Ce qui avait été écrit sur la copie a été déplacé dans un nouvel élément de la copie, avant que l'élément prenne la version de la production. Le lien mène à ce nouvel élément. |
| **supprimé**                        | La production ne l'a plus, et la copie l'avait reçu par un suivi.                                                                                                               |
| **en échec**                        | Cet élément n'a pas pu être écrit : la raison est donnée à côté. Les autres éléments ont été écrits.                                                                            |

Le rapport peut aussi porter des **avertissements**, par exemple un skill de tâche dont une expertise consommée manque sur la copie.

Un élément qui a changé sur la copie pendant le suivi (dans le back-office, ou par un assistant) n'est pas écrasé : il passe **en échec**, et le suivi suivant le reprend.

## 5. Ce que la copie suit, et ce qu'elle ne perd jamais

### Un élément venu de la production la suit en tout

Sa version active, son brouillon, son audience, son archivage, le fait d'être proposé aux assistants, son titre, sa catégorie et sa portée sont ceux de la production, avec les mêmes numéros de version. Une copie n'ouvre ni ne ferme rien d'elle-même : elle montre ce que les clients vivent en production. Chaque version reçue est marquée comme venant de la production.

### Le travail fait sur la copie n'est jamais perdu

Quand le suivi doit remplacer quelque chose qui a été écrit sur la copie, ce contenu part **en brouillon dans un nouvel élément de la copie**, que le suivi ne touche jamais. C'est le cas :

- **d'un brouillon écrit sur la copie, quand la production apporte un brouillon** ; tant que la production n'en apporte pas, le brouillon de la copie reste où il est ;
- **d'une version publiée sur la copie**, que la production n'a pas.

Ce nouvel élément porte l'identifiant de l'élément d'origine suivi d'un suffixe (`<identifiant>.copie`, puis `.copie-2`…), et son titre suivi de « (travail de la copie) ». Il est réservé à l'entreprise plateforme et n'est pas proposé aux assistants. Le rapport du suivi donne son lien.

### Ce que la production supprime

Un brouillon ou un élément jamais publié que la production supprime disparaît de la copie, **si la copie l'avait reçu par un suivi**. Ce que la copie a écrit elle-même n'est jamais supprimé.

### Un élément écrit sur la copie

Un élément créé sur la copie, par exemple un skill en cours d'essai, est laissé tel quel **tant que la production n'a pas d'élément du même identifiant**. Si la production en a un, l'élément la suit à partir du suivi suivant, et ce qui a été écrit sur la copie part dans un élément à part, « (travail de la copie) ». Pour essayer quelque chose sur une copie, choisissez un identifiant que la production n'utilise pas.

### D'où vient chaque élément

Sur une copie, les listes et la fiche d'un skill ou d'une expertise portent un badge :

| Badge                     | Ce que ça veut dire                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Pas encore suivi**      | La copie n'a encore réussi aucun suivi : le premier dira lesquels de ses éléments suivent la production (voir plus haut).     |
| **Suit la production**    | L'élément vient de la production et la suit à chaque suivi.                                                                   |
| **Gardé sur cette copie** | L'élément vient de la production, mais le suivi n'y touche plus (voir plus bas).                                              |
| **Écrit sur cette copie** | L'élément a été créé sur la copie : le suivi le laisse tel quel tant que la production n'a pas d'élément du même identifiant. |
| **Travail de la copie**   | L'élément tient le travail de la copie mis de côté, ou une version dupliquée. Le lien mène à l'élément d'origine.             |

Ces badges et les actions ci-dessous n'apparaissent pas sur la production.

## 6. Garder, suivre de nouveau, dupliquer

Sur une copie, la fiche d'un élément venu de la production propose trois actions :

- **Garder sur cette copie** détache l'élément : le suivi ne le touche plus, et son rapport signale seulement que la production l'a changé. Utile pour garder une version en essai plusieurs jours.
- **Suivre la production** le rattache. Au suivi suivant, ce qui a été écrit sur la copie part dans un nouvel élément (voir plus haut), et l'élément reprend ce que tient la production.
- **Dupliquer sur cette copie** crée un élément de la copie qui tient la version choisie en brouillon, pour tester sans toucher au suivi.

**Publier sur une copie.** Publier un élément qui suit la production propose la case **Garder sur cette copie**, cochée par défaut : l'élément garde ce que vous publiez. Décochée, l'élément continue de suivre la production, et le suivi suivant mettra la version publiée de côté dans un nouvel élément.

## 7. Un skill de fonctionnalité qui naît avant son code

Le skill d'une nouvelle fonctionnalité se rédige en production, en brouillon, avant que son code soit déployé, puis descend vers la copie du développeur par le suivi. Son brouillon peut nommer un schéma d'entrée ou de sortie que le code de l'instance ne connaît pas encore :

- l'enregistrement avertit, et un badge reste sur le brouillon tant que le schéma manque au code de cette instance ;
- la publication est refusée, avec un message qui dit pourquoi, jusqu'au déploiement du code qui déclare le schéma.

## Quand un suivi échoue

Un suivi **Échoué** n'a rien écrit, et la section dit pourquoi :

| Message                                                                                                               | Que faire                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| La production n'a pas pu être jointe.                                                                                 | Vérifier l'adresse et que la production répond, puis réessayer.  |
| La production a refusé le jeton de lecture : il a peut-être été révoqué.                                              | Créer un nouveau jeton en production et mettre à jour la copie.  |
| La production a répondu par une erreur.                                                                               | Réessayer plus tard ; si cela dure, prévenir l'équipe technique. |
| La réponse de la production n'a pas pu être lue : les deux instances n'ont peut-être pas la même version de LePatron. | Mettre la copie à la même version que la production.             |
| L'adresse de la production n'est pas une adresse https valide.                                                        | Corriger `SKILLS_SOURCE_URL`.                                    |

Pendant une recette, le code de la copie est souvent plus récent que celui de la production : une copie accepte aussi une réponse au format précédent. Un élément que la copie ne sait pas lire est refusé seul : il passe **en échec**, et les autres sont écrits.

## Révoquer un jeton

Quand une copie est retirée, ou si son jeton a pu fuiter : sur la production, onglet **Production et copies**, cliquer sur **Révoquer** à côté du jeton, puis confirmer. La copie qui l'utilisait ne peut plus lire la production, et son prochain suivi échoue avec « La production a refusé le jeton de lecture ». Un jeton révoqué ne se rétablit pas : pour reprendre le suivi, créez-en un nouveau.
