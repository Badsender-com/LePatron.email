# Recette — Publier et ouvrir les skills depuis un assistant

À rejouer avant la release qui porte la publication depuis un assistant (ADR 0019, epic #1422), puis à chaque release qui touche les outils MCP d'écriture, la vérification de publication ou l'audience. Elle vérifie qu'un super admin publie un brouillon en deux appels, qu'un brouillon modifié entre-temps est refusé, et qu'une audience s'ouvre et se referme.

La documentation suivie pendant la recette est [Publier depuis un assistant](../user/mcp/fr/publier-depuis-un-assistant.md). Les outils sont nommés en clair dans les demandes à l'assistant : il s'en sert sans qu'on ait à les appeler soi-même.

## 0. Préparation

Sur le staging :

- un compte **super admin** et un compte **utilisateur** d'un groupe qui a l'accès MCP (le groupe A de [la matrice des clients](./mcp-clients.md)) ;
- une expertise **E** active, utilisée par une fonctionnalité, avec son audience sur l'équipe Badsender (`platform`) ;
- une skill de fonctionnalité qui lit E, avec au moins un cas de test sur sa version active ;
- une expertise **N** jamais publiée, en brouillon ;
- un assistant (Claude Desktop par exemple) qui a les outils de LePatron.

## 1. Connexion avec le droit d'écriture

- [ ] Connecter l'assistant avec le compte utilisateur : l'écran de consentement ne propose pas la case d'écriture, et l'assistant ne liste ni `publish_draft` ni `set_audience`.
- [ ] Connecter l'assistant avec le super admin : la case **« Écrire aussi, publier et ouvrir les skills et expertises »** est décochée. La cocher, autoriser.
- [ ] L'assistant liste `publish_draft`, `set_audience`, `use_drafts` et les outils de brouillon.

## 2. Essayer un brouillon

- [ ] Demander à l'assistant de modifier E : il écrit un brouillon (`propose_expertise_change`). Dans le back-office, E a un brouillon ouvert, sa version active n'a pas changé.
- [ ] Demander d'activer le mode brouillons (`use_drafts`), puis de lire E : le contenu servi est celui du brouillon, et il dit qu'il vient d'un brouillon.
- [ ] Le couper : E est de nouveau servie dans sa version active.

## 3. Publier avec la confirmation

- [ ] Demander à l'assistant de publier le brouillon de E. Le client demande votre accord avant de lancer l'outil : l'accepter.
- [ ] Premier appel : rien n'est publié (le back-office montre toujours la version active d'avant). L'assistant montre la fonctionnalité qui utilise E, chaque cas de test avant et après, les skills sans cas, et une clé de confirmation.
- [ ] Confirmer à l'assistant. Le client redemande votre accord : l'accepter.
- [ ] Second appel : la réponse dit `published: true`. Dans le back-office, le brouillon est devenu la version active, l'ancienne est archivée.
- [ ] Sur la version publiée, l'historique de la vérification porte votre nom, l'application et le nombre de cas et d'écarts.
- [ ] L'audience de E n'a pas changé : toujours l'équipe Badsender.

## 4. Brouillon modifié entre les deux appels

- [ ] Faire écrire un nouveau brouillon de E, puis demander de le publier : l'assistant fait le premier appel et rend une clé.
- [ ] Avant de confirmer, modifier le brouillon (par l'assistant, ou dans le back-office, puis **Enregistrer le brouillon**).
- [ ] Confirmer : l'outil refuse avec « The draft changed after it was checked: call publish_draft without a confirmation to check it again. » Rien n'est publié.
- [ ] Relancer la vérification, puis confirmer avec la nouvelle clé : la publication passe.
- [ ] Donner à l'assistant une clé inventée : refus « This confirmation key was not given for this draft… ».

## 5. Ouvrir et refermer une audience

- [ ] Demander d'ouvrir E aux entreprises (`set_audience`, `all`). Le client demande votre accord. La réponse indique la version que les entreprises lisent (`clientsRead`).
- [ ] Avec l'assistant du compte utilisateur, retrouver E (`find_applicable_expertises`) : elle est lue, dans sa version active.
- [ ] Demander de refermer E (`platform`) : à son appel suivant, l'assistant du compte utilisateur ne la trouve plus.
- [ ] Demander d'ouvrir N, jamais publiée : refus « "…" was never published: a person publishes a version before it is opened. » Son audience n'a pas changé.
- [ ] Sur une skill de tâche publiée **T**, réservée à l'entreprise plateforme et qui consomme E réservée elle aussi : demander d'ouvrir T. La réponse liste E (`platformOnlyExpertises`), et E reste réservée. Demander d'ouvrir E avec T (`openExpertiseIds`) : E est ouverte.
- [ ] Demander de réserver de nouveau E (`platform`) : la réponse liste T (`openTaskSkills`).

## 6. Refus et journal

- [ ] Retirer au compte connecté le droit de gérer la plateforme, sans le reconnecter : `publish_draft` et `set_audience` répondent « Not allowed: … needs the skills:write scope and the right to manage the platform. »
- [ ] Dans le journal des appels MCP, les appels de la recette apparaissent avec l'outil, l'identifiant de E et l'application, jamais la clé. Ceux de `set_audience` disent dans quel sens l'audience est allée.

## 7. Après la recette

- [ ] Remettre E et T dans l'audience de l'équipe Badsender, supprimer N.
- [ ] Révoquer les applications de test.
