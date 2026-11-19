# Recette — Publier et ouvrir les skills depuis un assistant

À rejouer avant la release qui porte la publication depuis un assistant (ADR 0019, epic #1422), puis à chaque release qui touche les outils MCP d'écriture, la vérification de publication ou l'audience. Elle vérifie qu'un super admin publie un brouillon en deux appels, qu'un brouillon modifié entre-temps est refusé, et qu'une audience s'ouvre et se referme.

La documentation suivie pendant la recette est [Publier depuis un assistant](../user/mcp/fr/publier-depuis-un-assistant.md). Les outils sont nommés en clair dans les demandes à l'assistant : il s'en sert sans qu'on ait à les appeler soi-même.

## 0. Préparation

Sur le staging :

- un compte **super admin** et un compte **utilisateur** d'un groupe qui a l'accès MCP (le groupe A de [la matrice des clients](./mcp-clients.md)) ;
- une expertise **E** active, utilisée par une fonctionnalité, avec son audience sur l'entreprise plateforme (`platform`) ;
- une skill de fonctionnalité qui lit E, avec au moins un cas de test sur sa version active ;
- une expertise **N** jamais publiée, en brouillon ;
- un assistant (Claude Desktop par exemple) qui a les outils de LePatron.

## 1. Connexion avec le droit d'écriture

- [ ] Connecter l'assistant avec le compte utilisateur : l'écran de consentement ne propose pas la case d'écriture, et l'assistant ne liste ni `publish_draft` ni `set_audience`.
- [ ] Connecter l'assistant avec le super admin en choisissant une entreprise cliente : la case **« Écrire aussi, publier et ouvrir les skills et expertises »** n'apparaît pas, et l'assistant ne liste pas `publish_draft`.
- [ ] Reconnecter le super admin en choisissant l'entreprise plateforme : la case apparaît, décochée. La cocher, autoriser.
- [ ] L'assistant liste `publish_draft`, `read_publication_check`, `set_audience`, `use_drafts` et les outils de brouillon.

## 2. Essayer un brouillon

- [ ] Demander à l'assistant de modifier E : il écrit un brouillon (`propose_expertise_change`). Dans le back-office, E a un brouillon ouvert, sa version active n'a pas changé.
- [ ] Demander d'activer le mode brouillons (`use_drafts`), puis de lire E : le contenu servi est celui du brouillon, et il dit qu'il vient d'un brouillon.
- [ ] Le couper : E est de nouveau servie dans sa version active.

## 3. Publier avec la confirmation

- [ ] Si le brouillon de E est une version majeure, demander de le publier sans changelog : refus avant toute vérification (« changelog and releaseNotes are required… »). Les lui faire écrire.
- [ ] Demander à l'assistant de publier le brouillon de E. Le client demande votre accord avant de lancer l'outil : l'accepter.
- [ ] Premier appel : la réponse arrive tout de suite, rien n'est publié (le back-office montre toujours la version active d'avant). Elle dit `status: running`, la fonctionnalité qui utilise E et le nombre d'appels à l'IA.
- [ ] L'assistant relit la vérification (`read_publication_check`) : le client ne demande pas d'accord pour cet outil. Une fois `status: done`, il montre chaque cas de test avant et après, les skills sans cas, et une clé de confirmation.
- [ ] Confirmer à l'assistant. Le client redemande votre accord : l'accepter.
- [ ] Second appel : la réponse dit `published: true`. Dans le back-office, le brouillon est devenu la version active, l'ancienne est archivée.
- [ ] Sur la version publiée, l'historique de la vérification porte votre nom, l'application et le nombre de cas et d'écarts.
- [ ] L'audience de E n'a pas changé : toujours l'entreprise plateforme.

## 4. Brouillon modifié entre les deux appels

- [ ] Faire écrire un nouveau brouillon de E, puis demander de le publier : l'assistant fait le premier appel et rend une clé.
- [ ] Avant de confirmer, modifier le brouillon (par l'assistant, ou dans le back-office, puis **Enregistrer le brouillon**).
- [ ] Confirmer : l'outil refuse avec « The draft changed after it was checked: call publish_draft without a confirmation to check it again. » Rien n'est publié.
- [ ] Relancer la vérification, puis confirmer avec la nouvelle clé : la publication passe.
- [ ] Donner à l'assistant une clé inventée : refus « This confirmation key is not valid for this draft, or has expired… ».
- [ ] Confirmer avec d'autres notes de version que celles vérifiées : refus « The changelog or release notes differ from the ones checked… ».

## 4 bis. Plusieurs brouillons, et une copie

- [ ] Dans le back-office, donner à E un second brouillon (une mineure et une majeure). Demander de publier E sans version : refus « "…" has several drafts: give the version to publish. », avec les deux versions. Demander de publier la mineure : c'est elle qui est publiée, la majeure reste en brouillon.
- [ ] Sur une copie (staging qui suit la production) : publier un brouillon depuis l'assistant. La réponse dit `keptOnCopy: true`, et le back-office de la copie montre l'élément **gardé sur cette copie**. Lancer un suivi : l'élément n'est pas touché.
- [ ] Sur la copie, ouvrir une expertise avec `set_audience` : la réponse dit `keptOnCopy: true`, et un suivi ne referme pas l'audience.

## 5. Ouvrir et refermer une audience

- [ ] Demander d'ouvrir E aux entreprises (`set_audience`, `all`). Le premier appel ne change rien : la réponse indique la version que les entreprises liront (`clientsRead`) et une clé. E reste réservée.
- [ ] Confirmer : le client demande votre accord, l'assistant rappelle l'outil avec la clé, et E est ouverte.
- [ ] Rappeler `set_audience` avec la même clé après l'ouverture : la réponse dit `changed: false`, sans erreur.
- [ ] Vérifier de nouveau l'ouverture de E, la refermer puis la rouvrir dans le back-office, puis confirmer avec la clé obtenue : refus « "…" changed after the check… ».
- [ ] Avec l'assistant du compte utilisateur, retrouver E (`find_applicable_expertises`) : elle est lue, dans sa version active.
- [ ] Demander de refermer E (`platform`) : à son appel suivant, l'assistant du compte utilisateur ne la trouve plus.
- [ ] Demander d'ouvrir N, jamais publiée : refus « "…" was never published: publish a version before opening it. » Son audience n'a pas changé.
- [ ] Sur une skill de tâche publiée **T**, réservée à l'entreprise plateforme et qui consomme E réservée elle aussi : demander d'ouvrir T. La réponse liste E (`platformOnlyExpertises`), et E reste réservée. Demander d'ouvrir E avec T (`openExpertiseIds`), puis confirmer : E est ouverte. Une clé obtenue pour T seule ne vaut pas pour T avec E : refus « This confirmation key was not given for this change… ».
- [ ] Demander de réserver de nouveau E (`platform`) : la réponse liste T (`openTaskSkills`).

## 6. Refus et journal

- [ ] Retirer au compte connecté le droit de gérer la plateforme, sans le reconnecter : `publish_draft` et `set_audience` répondent « Not allowed: … needs the skills:write scope, the right to manage the platform, and a connection to the platform company. »
- [ ] Dans le journal des appels MCP, les appels de la recette apparaissent avec l'outil, l'identifiant de E et l'application, jamais la clé. Ceux de `set_audience` disent dans quel sens l'audience devait aller : `audience:all:check` pour une vérification, `audience:all` pour un changement appliqué. Aucun autre outil n'a de changement.

## 7. Après la recette

- [ ] Remettre E et T dans l'audience de l'entreprise plateforme, supprimer N et le second brouillon de E.
- [ ] Révoquer les applications de test.
