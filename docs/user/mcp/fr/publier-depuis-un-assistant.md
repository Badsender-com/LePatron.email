# Rédiger, publier et ouvrir les skills depuis un assistant

Cette page s'adresse à l'équipe de l'entreprise plateforme : aux personnes qui peuvent gérer la plateforme, c'est-à-dire les super admins. Un utilisateur d'entreprise ne voit aucun de ces outils : son assistant lit LePatron sans rien y modifier ([Connecter un assistant](./connecter-un-assistant.md)).

Depuis un assistant connecté avec le droit d'écriture, vous pouvez :

- rédiger des brouillons de skills et d'expertises ;
- les essayer avant de les publier ;
- publier un brouillon, en deux temps ;
- ouvrir une skill ou une expertise publiée à toutes les entreprises, ou la réserver de nouveau à l'entreprise plateforme.

## Se connecter avec le droit d'écriture

Connectez l'assistant comme d'habitude, en choisissant l'entreprise plateforme. Sur l'écran de consentement, une case **« Écrire aussi, publier et ouvrir les skills et expertises »** apparaît, décochée, pour un super admin seulement, et seulement une fois l'entreprise plateforme choisie : elle n'est pas proposée sur une connexion à une entreprise cliente. Cochez-la pour un assistant de l'équipe de l'entreprise plateforme, et pour lui seul : elle donne à la connexion le droit `skills:write`.

Ce droit ne suffit pas à lui seul. À chaque appel, LePatron vérifie de nouveau que vous pouvez gérer la plateforme et que la connexion est faite sur l'entreprise plateforme : si l'un des deux ne tient plus, les outils d'écriture sont refusés, même sur une connexion qui avait le droit.

Sans la case, ces outils n'apparaissent pas dans l'assistant.

## Rédiger un brouillon

| Outil                      | Ce qu'il fait                                                                     |
| -------------------------- | --------------------------------------------------------------------------------- |
| `propose_expertise_change` | écrit un changement d'expertise dans son brouillon ouvert, ou en ouvre un nouveau |
| `propose_skill_change`     | la même chose pour une skill                                                      |
| `create_expertise`         | crée une expertise, en brouillon                                                  |
| `create_task_skill`        | crée une skill de tâche, en brouillon                                             |

Un brouillon n'est lu que par l'équipe de l'entreprise plateforme. Les utilisateurs de LePatron et les assistants des entreprises lisent toujours la version publiée.

## Essayer un brouillon

L'outil `use_drafts` active le mode brouillons pour la connexion : chaque skill et chaque expertise est alors servie dans son dernier brouillon, quand elle en a un, y compris les expertises qu'une skill consomme. Chaque contenu servi depuis un brouillon le dit.

Le mode se coupe de lui-même au bout de quatre heures, et à chaque nouvelle connexion. Demandez à l'assistant de recharger les skills et les expertises quand il le propose.

## Publier un brouillon, en deux temps

L'outil `publish_draft` publie un brouillon d'une skill ou d'une expertise. Il se joue en deux temps, avec entre les deux une vérification qui tourne sur le serveur.

**Premier temps : la vérification.** L'assistant appelle l'outil sans clé. Rien n'est publié. LePatron lance la vérification de publication, la même que dans le back-office, et répond tout de suite, avec ce qu'elle va rejouer :

- les fonctionnalités qui utilisent cette skill ou cette expertise ;
- le nombre d'appels à l'IA qu'elle fait.

La vérification tourne sur le serveur, trois appels à l'IA à la fois au plus : comptez une minute ou plus. L'assistant la relit avec `read_publication_check`, qui ne change rien, jusqu'à ce qu'elle soit terminée. Terminée, elle montre :

- chaque cas de test des skills de fonctionnalité concernées, avec la version active puis avec le brouillon ;
- les skills de fonctionnalité sans cas de test ;

et une **clé de confirmation**. Un écart vous avertit, il ne bloque jamais : vous décidez. Une vérification qui n'a pas pu aboutir le dit ; relancez-la.

**Second temps : la publication.** Si vous êtes d'accord, l'assistant rappelle `publish_draft` avec la clé. Le brouillon devient la version active, et les fonctionnalités de LePatron le lisent aussitôt.

La première réponse et la publication disent aussi ce dont la publication avertit, sans la bloquer : pour une skill de tâche, les expertises qu'elle consomme qui ne sont pas publiées, ou qui sont réservées à l'entreprise plateforme alors que la skill est ouverte à toutes les entreprises.

**Un élément qui a plusieurs brouillons.** Quand une skill ou une expertise a plus d'un brouillon, l'outil ne choisit pas : il les liste, et l'assistant donne la version à publier (`version`, par exemple `2.1`) à chaque appel. Avec un seul brouillon, il n'y a rien à donner.

**Changelog et notes de version.** Une version majeure se publie avec son changelog et ses notes de version, comme dans le back-office : ceux du brouillon, ou ceux que vous donnez à l'assistant. Sans eux, l'outil refuse avant la vérification, et l'assistant doit les écrire. La clé leur est liée : donnez les mêmes aux deux temps.

**Sur une copie** (staging, développement), l'élément publié est gardé sur la copie, comme la publication du back-office le propose par défaut : le suivi suivant de la production ne la défait pas. La réponse le dit (`keptOnCopy`).

La clé est liée à ce brouillon exact, à vous, au changelog et aux notes de version vérifiés, et à une heure. L'outil la refuse dans ces cas :

| Cas                                                                                            | Réponse de l'outil                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| le brouillon a changé depuis la vérification                                                   | « The draft changed after it was checked: call publish_draft without a confirmation to check it again. »                                          |
| la clé a plus d'une heure, est inventée, ou donnée pour un autre élément ou une autre personne | « This confirmation key is not valid for this draft, or has expired: call publish_draft without one to check the draft again. »                   |
| le changelog ou les notes de version ne sont pas ceux vérifiés                                 | « The changelog or release notes differ from the ones checked: give the same ones, or call publish_draft without a confirmation to check again. » |
| l'élément a plusieurs brouillons et aucune version n'est donnée                                | « "…" has several drafts: give the version to publish. », avec les brouillons                                                                     |
| l'élément n'a pas de brouillon                                                                 | « "…" has no draft to publish: write one first, or it is already published. »                                                                     |

Dans les trois premiers cas, il suffit de relancer la vérification.

La publication est enregistrée sur la version, comme dans le back-office : qui a publié, depuis quelle application, et le résultat de la vérification (nombre de cas, d'écarts, skills sans cas de test).

Publier ne montre rien aux entreprises : c'est l'audience qui décide qui lit une skill ou une expertise.

## Ouvrir ou fermer une audience

L'outil `set_audience` change l'audience d'une skill ou d'une expertise :

- `all` l'ouvre à toutes les entreprises : dans les fonctionnalités de l'éditeur, et dans l'assistant de celles qui ont l'accès MCP ;
- `platform` la réserve de nouveau à l'entreprise plateforme.

Il le fait en deux appels, comme une publication :

1. Le premier appel ne change rien. Il répond la version que les entreprises liront (`clientsRead`), ce que le changement laisse derrière lui, et une clé de confirmation.
2. Une fois votre accord donné, l'assistant rappelle l'outil avec les mêmes arguments et la clé : l'audience change. La clé vaut une heure, pour ce changement, pour vous uniquement, et pour l'élément tel qu'il a été vérifié : s'il a changé entre-temps, de quelque façon que ce soit, l'outil refuse (« "…" changed after the check… »), et il suffit de vérifier de nouveau.

Quand l'audience est déjà celle demandée, l'outil le dit (`changed: false`) et ne change rien, à l'un comme à l'autre appel. Sur une copie (staging, développement), l'élément est gardé sur la copie, pour que le suivi suivant de la production ne défasse pas le changement ; la réponse le dit (`keptOnCopy`).

Les entreprises lisent toujours la version active, jamais un brouillon. Une skill ou une expertise jamais publiée ne s'ouvre pas : « "…" was never published: publish a version before opening it. » Une archivée non plus.

Refermer une audience est immédiat : les assistants des entreprises ne la lisent plus à leur appel suivant.

L'outil suit les mêmes règles que le back-office :

- **Ouvrir une skill de tâche :** la réponse liste les expertises qu'elle consomme qui restent réservées à l'entreprise plateforme (`platformOnlyExpertises`) : les assistants des autres entreprises suivent la skill sans elles. Pour en ouvrir aussi, demandez à l'assistant de vérifier de nouveau avec elles (`openExpertiseIds`), puis de confirmer. Ouvrir une expertise l'applique aussi, tout de suite, aux fonctionnalités de l'éditeur de toutes les entreprises : choisissez-les une par une.
- **Réserver de nouveau une expertise à l'entreprise plateforme :** la réponse liste les skills de tâche ouvertes à toutes les entreprises qui la consomment (`openTaskSkills`) : elles ne la reçoivent plus chez les clients.

## Pourquoi l'assistant vous demande confirmation

`publish_draft` et `set_audience` sont déclarés comme des outils qui modifient LePatron. Les assistants demandent donc votre accord avant de les lancer. Lisez ce qu'ils s'apprêtent à faire avant d'accepter : la décision vous revient, l'assistant ne fait que la porter.

## Ce que garde le journal des appels

Comme pour tout appel MCP, le journal garde la personne, l'application, l'outil appelé, l'identifiant de l'élément, l'heure, la durée et l'issue (réussi ou en erreur). Il ne garde ni le contenu des brouillons, ni la clé de confirmation. Pour `set_audience`, il garde aussi dans quel sens l'audience devait aller, et si l'appel l'a seulement vérifié (`audience:all:check`) ou appliqué (`audience:all`, `audience:platform`).

## Si l'outil refuse

| Réponse                                                                                                                                                             | Cause                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| « Not allowed: publishing skills and expertises needs the skills:write scope, the right to manage the platform, and a connection to the platform company. »         | la connexion n'a pas le droit d'écriture, est faite sur une entreprise cliente, ou vous ne gérez plus la plateforme |
| « Not allowed: opening or closing skills and expertises needs the skills:write scope, the right to manage the platform, and a connection to the platform company. » | même cause, pour l'audience                                                                                         |

Dans les deux cas, reconnectez l'assistant sur l'entreprise plateforme en cochant la case d'écriture, si vous pouvez gérer la plateforme.
