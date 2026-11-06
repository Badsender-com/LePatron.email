# Suivre les skills et expertises de la production

La **production** est la source des skills et des expertises : l'équipe Badsender les y rédige, les y publie et les y ouvre aux clients. Les autres instances, la recette ou le développement, sont des **copies** : elles ne rédigent pas ce que la production tient, elles le reçoivent. Une copie suit la production **à la demande**, depuis son back-office, et **chaque nuit**.

Réservé aux **super admins**, dans **Paramètres › Super administrateur › Skills & Expertise**, onglet **Synchronisation**.

Pour déplacer ponctuellement quelques éléments par un fichier, voir plutôt [Exporter et importer des skills](../../skills-export/fr/exporter-importer.md).

## 1. En production : créer un jeton de lecture

Une copie lit la production avec un **jeton de lecture**. Un jeton ne lit rien d'autre que les skills et expertises : ni les emails, ni les utilisateurs.

1. Sur la production, onglet **Synchronisation**, section **Jetons de lecture**, cliquer sur **Créer un jeton**.
2. Donner un **Nom** : la copie qu'il sert, par exemple « Recette ». Un jeton par copie : vous pourrez révoquer celle que vous retirez sans toucher aux autres.
3. Le jeton s'affiche **une seule fois**. Cliquer sur **Copier**, puis le transmettre à la personne qui configure la copie. **J'ai enregistré le jeton** ne se clique qu'après la copie.

La liste montre ensuite chaque jeton avec sa date de création et sa dernière utilisation (« jamais utilisé » tant que la copie ne l'a pas employé). Le jeton lui-même n'est plus jamais affiché : s'il est perdu, révoquez-le et créez-en un autre.

## 2. Sur la copie : la configurer

Une copie se configure dans ses **variables d'environnement**, pas dans une page : le jeton n'est ainsi ni enregistré en base, ni affiché dans le navigateur. C'est le rôle de la personne qui déploie l'instance (voir [DEPLOYMENT.md](../../../DEPLOYMENT.md)).

| Variable              | Valeur                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| `SKILLS_SOURCE_URL`   | L'adresse de la production, en https, par exemple `https://production.example` |
| `SKILLS_SOURCE_TOKEN` | Le jeton de lecture créé à l'étape 1                                           |

Sur la production elle-même, on laisse ces deux variables vides. Changer de production demande de modifier ces variables, puis de redémarrer l'instance.

Une fois la copie configurée, l'onglet **Synchronisation** affiche en tête une section **Suivre la production**, avec l'origine de la production (son adresse, jamais le jeton). Sans configuration, cette section n'apparaît pas.

## 3. Suivre la production

### À la demande

Cliquer sur **Suivre maintenant**. Le suivi lit d'abord toute la réponse de la production, puis l'applique élément par élément. À la fin, les listes de skills et d'expertises se rechargent, et la section montre le **dernier suivi** : son état, sa date, qui l'a lancé, et le nombre d'éléments par issue.

| Issue                         | Ce que ça veut dire                                                           |
| ----------------------------- | ----------------------------------------------------------------------------- |
| **ajoutée(s)**                | L'élément n'existait pas sur la copie.                                        |
| **mise(s) à jour**            | La copie a pris ce que tient la production.                                   |
| **déjà à jour**               | Rien n'a changé depuis le dernier suivi.                                      |
| **conservée(s) sur la copie** | La copie garde le sien (voir plus bas).                                       |
| **en échec**                  | Cet élément n'a pas pu être écrit ; la raison est sous **Éléments en échec**. |

Un suivi est **Réussi**, **Réussi en partie** (au moins un élément en échec, les autres ont été écrits) ou **Échoué** (rien n'a été écrit). Un seul suivi tourne à la fois.

### Chaque nuit

Chaque nuit, vers 3 h (UTC), la copie suit la production toute seule, comme si l'on avait cliqué sur le bouton. Le dernier suivi indique alors « par le suivi de nuit ».

## Ce que la copie prend, et ce qu'elle garde

La copie montre ce que les clients vivent en production :

- **une version active en production arrive active** sur la copie ; l'ancienne version active de la copie est archivée ;
- **un brouillon de la production arrive en brouillon** ;
- **l'état, l'audience et le fait d'être proposé aux assistants** sont ceux de la production : une copie n'ouvre ni ne ferme rien d'elle-même ;
- une version que la copie tient **au même numéro** est réécrite avec le contenu de la production : la production fait foi.

La copie garde le sien dans trois cas :

- **ce qui n'existe que sur la copie reste**, intact : par exemple un skill en cours d'essai ;
- **une copie en avance garde sa version** : si sa version active est plus récente que celle de la production, l'élément n'est pas touché. Aucun suivi ne revient en arrière ;
- **un brouillon de la copie plus récent que celui de la production n'est jamais écrasé.**

Un suivi ne remonte jamais vers la production : ce qui se rédige sur une copie y reste.

## Quand un suivi échoue

Un suivi **Échoué** n'a rien écrit, et la section dit pourquoi :

| Message                                                                                                               | Que faire                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| La production n'a pas pu être jointe.                                                                                 | Vérifier l'adresse et que la production répond, puis réessayer.  |
| La production a refusé le jeton de lecture : il a peut-être été révoqué.                                              | Créer un nouveau jeton en production et mettre à jour la copie.  |
| La production a répondu par une erreur.                                                                               | Réessayer plus tard ; si cela dure, prévenir l'équipe technique. |
| La réponse de la production n'a pas pu être lue : les deux instances n'ont peut-être pas la même version de LePatron. | Mettre la copie à la même version que la production.             |
| L'adresse de la production n'est pas une adresse https valide.                                                        | Corriger `SKILLS_SOURCE_URL`.                                    |

## Révoquer un jeton

Quand une copie est retirée, ou si son jeton a pu fuiter : sur la production, onglet **Synchronisation**, cliquer sur **Révoquer** à côté du jeton, puis confirmer. La copie qui l'utilisait ne peut plus lire la production, et son prochain suivi échoue avec « La production a refusé le jeton de lecture ». Un jeton révoqué ne se rétablit pas : pour reprendre le suivi, créez-en un nouveau.
