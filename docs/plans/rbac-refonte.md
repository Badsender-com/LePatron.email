# Ajout de nouveaux rôles et spectateur non loggué

Document de conception pour l'ajout de nouveaux rôles au système de rôles et permissions de LePatron.email. Rédigé à partir de la vision produit d'Olivier Fredon et d'un audit du code existant.

**Scope réduit le 2026-08-27** : le chantier RBAC initial couvrait tout en un seul cadrage (nouveaux rôles, `super_admin` en rôle DB multi-comptes, notion d'équipe, spectateur non loggué, audit log). Jugé trop "epic" et risqué pour un seul incrément, il est désormais découpé :

- **Ce document/incrément** : ajout des rôles `company_admin_tech`, `reviewer`, `writer`, + spectateur non loggué via lien de partage. Issue GitHub [#1099](https://github.com/Badsender-com/LePatron.email/issues/1099).
- Team / notion d'équipe au sein d'une company — différé, issue [#1100](https://github.com/Badsender-com/LePatron.email/issues/1100).
- `super_admin` en rôle persistant multi-comptes — différé, issue [#1101](https://github.com/Badsender-com/LePatron.email/issues/1101).
- Audit log des changements de rôle et réglages sensibles — différé, issue [#1102](https://github.com/Badsender-com/LePatron.email/issues/1102).
- Gestion granulaire des droits par feature et action — différé, issue [#1103](https://github.com/Badsender-com/LePatron.email/issues/1103).

L'audit du code existant (section 2) reste une référence factuelle valide pour l'ensemble de ces chantiers, pas seulement celui-ci.

## Sommaire

1. [Vision produit](#1-vision-produit)
2. [Audit — vision vs code réel](#2-audit--vision-vs-code-réel)
3. [Modèle RBAC cible](#3-modèle-rbac-cible)
4. [Incrément d'implémentation](#4-incrément-dimplémentation)
5. [Spectateur non loggué — lien de partage](#5-spectateur-non-loggué--lien-de-partage)
6. [Audit log — différé](#6-audit-log--différé)
7. [Plan de tests](#7-plan-de-tests)
8. [Hors périmètre](#8-hors-périmètre)

---

## 1. Vision produit

### Rôles existants, à faire évoluer

- **Utilisateur (regular user)** : droits d'accès et d'actions limités à l'application. Évolution prévue : en tant que company admin, on doit pouvoir assigner les workspaces disponibles depuis le profil utilisateur au moment de sa création ou de sa modification.
- **Administrateur de compte (group admin → company admin)** : mêmes droits qu'un regular user + accès complet à la company et à son administration. Évolution : devient "propriétaire" de la company et peut désigner de nouveaux rôles parmi les utilisateurs de sa company.
- **Super administrateur (super admin)** : mêmes droits que company admin, applicables sur l'ensemble des comptes. Aujourd'hui un seul compte par environnement (prod/staging/dev), défini en variable d'environnement. Évolution envisagée (différée, [issue #1101](https://github.com/Badsender-com/LePatron.email/issues/1101)) : devenir un rôle à part entière dans l'application, avec plusieurs comptes individuels possibles. **Hors scope de cet incrément.**

### Note de vocabulaire

"Group"/"group admin" évoluent vers "company"/"company admin" dans le vocabulaire produit.

### Nouveaux rôles envisagés

- **Administrateur technique (company admin tech)** : accède aux réglages techniques (intégrations, IA, profils d'export, hébergement d'images…) sans pouvoir gérer les utilisateurs ni les workspaces. Dans cet incrément, l'accès couvre intégrations/AI features/feed mappings/tracking ; les exports et profils ESP (FTP/CDN) restent super-admin-only pour l'instant (section 3.2).
- **Relecteur (reviewer)** : ouvre un email en lecture, peut commenter/tester/valider, mais ne peut pas modifier la structure, les contenus ou le style — **ni les actions de gestion du listing** (renommer/déplacer/dupliquer/supprimer un mailing). Rôle entièrement passif sur le contenu, actif uniquement sur commentaire/test/validation. Détail affiné en section 3.3.
- **Rédacteur (writer)** : édite le contenu d'un email mais ne touche pas à sa structure (ajout/suppression de bloc) et n'accède pas aux options de style. Peut dupliquer/renommer/déplacer un mailing pour créer des variantes/déclinaisons, mais ne peut ni créer un mailing from scratch ni en supprimer. Détail affiné en section 3.3.
- **Spectateur (non loggué)** : consulte un email partagé via un lien et ajoute un commentaire contextualisé, sans pouvoir modifier l'email. US liée : un utilisateur génère un lien de partage donnant accès à un email à un spectateur non loggué pour recueillir des commentaires.

### Notion d'équipe — différée

La notion d'équipe au sein d'une company (vue d'administration façon workspace, assignation multi-select depuis le profil utilisateur et depuis le workspace) est différée dans une issue dédiée : [#1100](https://github.com/Badsender-com/LePatron.email/issues/1100). **Hors scope de cet incrément.**

### Notes sur l'administration actuelle

- Les super admin n'ont pas d'action associée au listing d'email (copier, renommer, déplacer…).
- Les super admin ne peuvent pas retrouver l'arborescence et donc situer l'email dans l'organisation (workspace > folder) d'une company.
- Les ESP sont administrés par le super admin ; l'admin tech devrait pouvoir le gérer à l'avenir.

### Cadrage fonctionnel de départ

Aujourd'hui, le rôle touche uniquement l'accès au backoffice de l'application ; les permissions associées définissent des actions disponibles sur ce même backoffice (accès réglages, ajout workspace/utilisateur, liste de test, nuancier…). Le rôle n'a pas d'incidence sur les permissions et fonctionnalités du builder. Demain, d'autres outils viendront s'ajouter au builder, et certaines fonctionnalités du builder pourraient être réservées à certains rôles. **Décision : oui**, il faut introduire des permissions liées directement aux fonctionnalités des outils, pas seulement à l'accès aux outils — mais un moteur de permissions générique par feature × action est un chantier à part entière, différé dans [l'issue #1103](https://github.com/Badsender-com/LePatron.email/issues/1103) (avec un premier inventaire des features administrables actuelles). Pour cet incrément, `reviewer`/`writer` sont traités au cas par cas via des booléens dérivés du rôle côté éditeur (voir section 4), sans construire ce moteur générique.

Règles de compatibilité actées :

- Un utilisateur ne peut **pas** avoir des rôles différents selon le workspace — le rôle est global à la company.
- Un company admin **peut** déléguer/désigner des rôles à d'autres utilisateurs de sa company.

### Plan d'action macro (3 phases)

1. **Cadrage fonctionnel** — décisions à figer (ce document).
2. **Conception produit (UX + garde-fous)** — écran "Utilisateurs & rôles", UI d'accès dans l'éditeur (actions désactivées), partage "spectateur" (lien, droits, expiration).
3. **Implémentation en un seul incrément** — nouveaux rôles (`company_admin_tech`, `reviewer`, `writer`) + spectateur non loggué, voir section 4. Pas de migration de données destructive : l'enum `role` ne fait qu'ajouter des valeurs.

---

## 2. Audit — vision vs code réel

Basé sur l'exploration du code réel (`packages/server`, `packages/ui`, `packages/editor`) et la vérification manuelle des fichiers cités.

### Ce qui va déjà (réutilisable, pas à recréer)

- Un vrai lien **user ↔ workspace** existe déjà en base : `Workspace._users` (ref `User[]`, `packages/server/workspace/workspace.schema.js`) + `Group.userHasAccessToAllWorkspaces` (bool, défaut `true`, `packages/server/group/group.schema.js`) qui bascule entre "tout le monde accède à tout" et "accès restreint aux `_users` listés" (logique dans `packages/server/workspace/workspace.service.js`).
- `packages/ui/components/workspaces/workspace-form.vue` a déjà un bon pattern UI de multi-sélection (data-table Vuetify avec `show-select`, checkbox, tooltip pour les lignes verrouillées) — réutilisable pour "assigner workspace(s)/équipe(s) à un profil utilisateur".
- Un **système de commentaires complet** existe déjà et est récent : `packages/server/comment/comment.schema.js` (threads via `_parentComment`, catégories `design`/`content`/`general`, sévérité `info`/`important`/`blocking`, `resolved`/`resolvedAt`/`_resolvedBy`, `mentions`, soft delete, `blockSnapshot`), `packages/server/comment/comment.service.js` (`verifyMailingAccess` scope déjà par company, bypass super admin), câblage éditeur `packages/editor/src/js/ext/badsender-comments.js`. Socle solide pour le rôle reviewer et pour le futur spectateur non loggué — pas de logique à dupliquer, juste à brancher dessus.
- Le pattern `guard(roles)` (`packages/server/account/auth.guard.js`) est propre et déjà extensible sans casser l'existant.
- `packages/server/group/group.controller.js:456-463` filtre déjà les champs modifiables par un company admin via un `pick()` explicite (`name`, `id`, `colorScheme`, `trackingConfig`) — pattern directement réutilisable pour le futur company admin tech.
- `Group.isPlatform` existe déjà (utilisé par l'AI Playground) — réutilisable pour héberger les futurs comptes super admin sans changer le schéma `User` (qui exige toujours une `_company`).
- Le rôle stocké en base est déjà littéralement `'company_admin'` (`Roles.GROUP_ADMIN === 'company_admin'`, `packages/server/account/roles.js`) — le vocabulaire produit cible existe déjà côté donnée ; seuls les noms de code, routes et libellés UI disent encore "group".
- Le constat du cadrage ("aujourd'hui le rôle n'affecte que le backoffice, pas le builder") est vérifié quasi exact : seules 2 exceptions existent, toutes deux dérivées de `isAdminOfCurrentGroup` dans `packages/editor/src/js/ext/badsender-current-user.js` — gestion de la bibliothèque de blocs personnalisés (`toolbox.tmpl.html`) et suppression des commentaires d'autrui (`badsender-comments.js`, miroir serveur `comment.service.js:309-311`).
- Un groupe peut déjà avoir plusieurs `company_admin` sans limite — "company admin peut désigner des rôles" est donc déjà supporté mécaniquement par les données ; il manque les garde-fous et l'UI, pas la structure.

### Ce qui ne va pas (écarts avec la vision)

- **`super_admin` n'est pas un rôle en base.** C'est un compte unique codé en dur (`config.admin.id/username/password`, `packages/server/node.config.js`, un `ObjectId` fixe `576b90a441ceadc005124896`), et `UserSchema.virtual('isAdmin')` (`packages/server/user/user.schema.js:156-158`) retourne **toujours `false`** pour un vrai utilisateur en base. "Super admin doit devenir un rôle à part entière avec plusieurs comptes individuels" est donc un changement structurel, pas une simple évolution d'UI.
  - **Important** : le compte super admin en variable d'environnement (`config.admin`) n'est **pas remplacé**. Il devient le mécanisme de **bootstrap/break-glass permanent** : dans chaque environnement, il sert à créer le tout premier compte `super_admin` réel en base (on se connecte avec les identifiants env var — qui passent déjà `GUARD_ADMIN` via l'objet figé `isAdmin: true`, indépendamment de toute donnée en base — puis on crée/gère les comptes super admin individuels depuis ce compte). Il reste actif indéfiniment comme filet de secours (nouvel environnement, perte d'accès aux comptes DB) ; il n'est **pas prévu de le retirer**.
- Les intégrations/ESP sont déjà gérables par `company_admin` (`GUARD_GROUP_ADMIN` sur `packages/server/integration/integration.routes.js`), pas réservées au super admin comme décrit dans la note d'usage. **Écart documenté, non corrigé pour l'instant** — `company_admin_tech` reçoit cet accès en alternative (section 3.2), mais `company_admin` ne le perd pas dans cet incrément (voir section 8).
- La liste des rôles est dupliquée en dur dans deux composants Vue distincts (`packages/ui/components/users/form.vue:16-19` et `packages/ui/routes/groups/_groupId/settings/users/_userId.vue`) — tout ajout de rôle oblige à modifier les deux, risque d'oubli.
- L'écran de **création** d'utilisateur (`packages/ui/routes/groups/_groupId/new-user.vue` + `components/users/form.vue`) n'a aucune section workspace/équipe — l'US "j'assigne les workspaces disponibles depuis le profil utilisateur au moment de sa création" n'est pas couverte aujourd'hui ; elle n'existe qu'à l'édition, et de façon plus faible (des `v-switch` un par un, pas un multi-select comme dans `workspace-form.vue`).

### Oublié / absent (à créer de zéro)

- **Aucun audit log / activity log** nulle part dans le code (aucun modèle/service `audit`, `activity-log`, `history`). Pas de traçabilité des changements de rôle ni des actions sensibles.
- **Aucun lien de partage public/anonyme** (pas de route `/share` ou `/public`, pas de token, tout est derrière l'authentification) — à créer intégralement pour le rôle spectateur non loggué.
- **Aucun test dédié** à la logique même de `GUARD_GROUP_ADMIN`/`GUARD_ADMIN` (contrairement à `GUARD_CAN_ACCESS_GROUP`, bien couvert dans `tests/server/group/group.guard.test.js`).
- **Aucune notion d'équipe** (team) — à créer de zéro si le bonus est retenu, en s'inspirant du modèle `Workspace` existant.
- **Aucun garde-fou anti-escalade** : rien n'empêche aujourd'hui de retirer le dernier company admin d'une company, ou (une fois super admin en base) de s'auto-attribuer ce rôle.

### Warnings

- Le jour où `isAdmin` passera de "toujours `false`" à "dérivé du rôle", **tout le code qui teste `user.isAdmin`** change de comportement en cascade (guards, `verifyMailingAccess`, `checkIfUserIsAuthorizedToAccessIntegration`, `group.guard.js`...). C'est le point de bascule le plus sensible de tout le chantier — à ne merger qu'avec un test de non-régression dédié.
- Le compte `config.admin` (env var) doit continuer à passer `GUARD_ADMIN` exactement comme aujourd'hui — c'est le mécanisme de bootstrap, il ne s'agit pas d'un chemin legacy à déprécier.
- La matrice cible laisse `company_admin` avec un accès large aux intégrations même après la création de company admin tech (pour ne pas régresser tout de suite) — un vrai cloisonnement futur demandera une décision explicite de retrait.
- Renommer seulement le vocabulaire visible (`group`→`company`) crée une période où le nom de code (`Group`, `isGroupAdmin`, `/groups/...`) et le nom produit (company) divergent — à garder en tête pour les devs et les agents IA qui liront le code.
- Rien dans la structure de données n'empêche techniquement de réutiliser `Workspace._users` pour y accrocher un rôle par workspace — ce qui casserait la règle actée "un utilisateur n'a pas de rôle différent selon le workspace". Cette contrainte est un invariant à préserver explicitement, pas seulement déduite du code actuel.

---

## 3. Modèle RBAC cible

### 3.1 Rôles codés en dur, pas de moteur de permissions générique

Pas de rôles sur-mesure demandés, et pas de moteur générique de permissions (feature × action) construit dans cet incrément — ce chantier plus large est différé dans [l'issue #1103](https://github.com/Badsender-com/LePatron.email/issues/1103). Ici, on se contente d'étendre les rôles codés en dur et d'ajouter des guards additifs ciblés :

- `packages/server/account/roles.js` (existant, étendu) — ajout des 3 nouveaux rôles :
  ```js
  Roles = {
    REGULAR_USER: 'regular_user',
    GROUP_ADMIN: 'company_admin',
    SUPER_ADMIN: 'super_admin',
    GROUP_ADMIN_TECH: 'company_admin_tech',
    REVIEWER: 'reviewer',
    WRITER: 'writer',
  };
  ```
  `SUPER_ADMIN` reste hors de l'enum `role` persisté (`user.schema.js:45-49`) — inchangé, voir [#1101](https://github.com/Badsender-com/LePatron.email/issues/1101).
- `packages/server/account/auth.guard.js` (existant, étendu) — nouveau guard additif `GUARD_GROUP_ADMIN_OR_TECH = guard([Roles.GROUP_ADMIN, Roles.GROUP_ADMIN_TECH])`, sans toucher `GUARD_GROUP_ADMIN`/`GUARD_ADMIN`/`GUARD_USER` existants (zéro régression sur les routes déjà en place).
- `packages/ui/helpers/roles.js` (nouveau) — liste unique des 6 valeurs de rôle (les 5 assignables + `super_admin` non exposé dans le picker) avec labels i18n, remplace les deux listes dupliquées de `packages/ui/components/users/form.vue` et `packages/ui/routes/groups/_groupId/settings/users/_userId.vue`.

### 3.2 `company_admin` vs `company_admin_tech` : matrice de droits par feature

**Statut : en cours de validation avec Olivier — les cases sont à remplir avant implémentation.** `company_admin_tech` n'est pas un simple sous-ensemble additif de `company_admin` : c'est un vrai partage/retrait de pouvoirs (`company_admin` perd l'accès à plusieurs domaines qu'il a aujourd'hui), donc chaque ligne doit être tranchée explicitement plutôt que déduite.

Légende des colonnes : **Lecture** = consulter la feature/l'écran · **Écriture** = créer et/ou modifier · **Suppression** = supprimer (`—` = l'action n'existe pas pour cette feature). Valeurs possibles par cellule : `company_admin`, `company_admin_tech`, `super_admin`, ou une combinaison (ex. `company_admin + company_admin_tech`).

| #   | Feature                                                                           | Lecture | Écriture                | Suppression |
| --- | --------------------------------------------------------------------------------- | ------- | ----------------------- | ----------- |
| 1   | Workspaces                                                                        |         |                         |             |
| 2   | Utilisateurs                                                                      |         |                         |             |
| 3   | Rôles (assigner un rôle à un utilisateur)                                         |         | _(assigner = écriture)_ | —           |
| 4   | Test lists (listes d'emails de test)                                              |         |                         |             |
| 5   | Couleurs (nuancier)                                                               |         |                         |             |
| 6   | Bibliothèque de blocs personnalisés                                               |         |                         |             |
| 7   | Modération de commentaires (supprimer un commentaire d'autrui)                    | —       | —                       |             |
| 8   | Variables personnalisées (merge tags)                                             |         |                         |             |
| 9   | Profils ESP (Adobe/Actito/DSC/Sendinblue)                                         |         |                         |             |
| 10  | Export options (hébergement CDN/FTP)                                              |         |                         |             |
| 11  | Intégrations (connecteurs AI/feed/dashboard)                                      |         |                         |             |
| 12  | AI Features (traduction, config skills par company)                               |         |                         |             |
| 13  | Tracking (UTM) — niveau company                                                   |         |                         | —           |
| 14  | Tracking (UTM) — override par template                                            |         |                         | —           |
| 15  | Feed mappings (flux de contenu)                                                   |         |                         |             |
| 16  | CRM Intelligence — dashboards                                                     |         |                         |             |
| 17  | Templates — admin (CRUD templates d'une company)                                  |         |                         |             |
| 18  | Mailings — rapport admin (vue d'ensemble lecture seule)                           |         | —                       | —           |
| 19  | Company — réglages généraux (nom, statut, modules, rétention logs)                |         |                         | —           |
| 20  | Company — SAML (authentification)                                                 |         |                         |             |
| 21  | AI Skills Hub (plateforme, skills/expertise)                                      |         |                         |             |
| 22  | AI Playground (plateforme)                                                        |         |                         |             |
| 23  | Annuaire des companies (créer/supprimer une company, lister toutes les companies) |         |                         |             |

Décisions déjà actées dans la conversation de cadrage (à reporter dans les cases ci-dessus, comme rappel — pas encore vérifiées ligne par ligne) :

- `company_admin` exclusif : Workspaces (1), Utilisateurs (2), Rôles (3), Test lists (4), Couleurs (5).
- `company_admin_tech` exclusif (retiré à `company_admin`) : Profils ESP (9), Export options CDN/FTP (10), Intégrations (11), AI Features (12), Tracking company (13), Tracking par template (14), Feed mappings (15).
- Partagé `company_admin` + `company_admin_tech` : Variables personnalisées (8).
- `super_admin` exclusif, ni `company_admin` ni `company_admin_tech` : Templates admin (17), Company réglages généraux (19), Company SAML (20), AI Skills Hub (21), AI Playground (22), Annuaire des companies (23).
- Encore ouvert : Bibliothèque de blocs (6), Modération de commentaires (7), CRM Intelligence dashboards (16), Mailings rapport admin (18).

Une fois la matrice validée, la mise en œuvre technique suit le même mécanisme pour toutes les lignes qui passent de `GUARD_GROUP_ADMIN` (les deux) à un guard exclusif : remplacer `GUARD_GROUP_ADMIN` par un nouveau guard dédié (`GUARD_GROUP_ADMIN_TECH` pour les lignes exclusives à `company_admin_tech`, sans `GROUP_ADMIN` dans la liste) sur les routes concernées (`integration.routes.js`, `ai-feature.routes.js`, `feed-mapping.routes.js`, `template.routes.js` pour le tracking par template, `profile.routes.js`, et les futures routes d'export options). Pour les lignes partagées (variables personnalisées), garder `GUARD_GROUP_ADMIN_OR_TECH` (additif) comme prévu initialement. Le détail par route sera précisé une fois la matrice figée, pour éviter de re-documenter deux fois.

### 3.3 `reviewer` / `writer` : restriction UI du canvas ET du listing, pas d'enforcement serveur

**Constat technique clé** : la sauvegarde d'un mailing passe par un seul endpoint (`PUT /:mailingId/mosaico`, `packages/server/mailing/mailing.controller.js:398`, `mailing.data = req.body.data`) qui écrase tout le JSON Mosaico (structure + contenu + style mélangés) en une fois. Il n'existe aucune séparation champ par champ côté serveur. Garantir côté API que `writer` ne modifie que le contenu nécessiterait de diffuser ce JSON — jugé trop risqué pour cet incrément, différé dans [#1103](https://github.com/Badsender-com/LePatron.email/issues/1103). De la même façon, les actions de listing (renommer/déplacer/dupliquer/supprimer un mailing) passent par `mailing.routes.js`, toutes en `GUARD_USER` — aucune restriction serveur par rôle n'existe non plus à ce niveau.

**Décision actée (affinée après revue produit)** : restriction **UI uniquement** pour `reviewer` et `writer`, à la fois dans le canvas de l'éditeur et dans le listing de mailings. Aucun garde-fou serveur nouveau dans cet incrément — écart de sécurité documenté et élargi (un `reviewer`/`writer` appelant l'API directement pourrait encore modifier structure/style, ou renommer/déplacer/dupliquer/supprimer un mailing) ; le vrai fix serveur est différé dans [#1103](https://github.com/Badsender-com/LePatron.email/issues/1103).

**`reviewer`** — rôle passif sur le contenu, actif uniquement sur commentaire/test/validation :

- Canvas builder : structure, contenu, style — aucun contrôle d'édition affiché (`toolbox.tmpl.html` griffé par les booléens `canEditStructure`/`canEditContent`/`canEditStyle`, tous `false`).
- Listing de mailings (`packages/ui/routes/mailings/__partials/mailings-table.vue`) : renommer, déplacer, dupliquer/copier, supprimer — **masqués**. Ce fichier calcule déjà une liste d'actions cachées par contexte (`TABLE_HIDDEN_COLUMNS_ADMIN`/`_USER`/`_NO_ACCESS`, lignes ~117-193) ; on y ajoute un jeu `TABLE_HIDDEN_COLUMNS_REVIEWER` (RENAME, DELETE, MOVE_MAIL, COPY_MAIL, ADD_TAGS) sélectionné quand `role === 'reviewer'`, sur le même modèle que l'existant.
- Gestion de dossiers (`packages/ui/components/sidebar/context/bs-sidebar-workspace-tree.vue`) : renommer/déplacer/supprimer un dossier, créer un sous-dossier — masqués pour `reviewer` (`checkIfAuthorizedFolderMenu`/`hasRightToCreateFolder` gagnent une condition de rôle), cohérent avec un rôle entièrement passif sur l'organisation du contenu.
- Envoi de test (`sendTestMail`, `GUARD_USER`) : **conservé**, correspond au "tester" de la vision produit — aucune restriction.
- Commentaire : créer/répondre/résoudre/rouvrir — conservé (déjà ouvert à tout utilisateur avec accès au mailing, `GUARD_USER` + `verifyMailingAccess`) ; suppression limitée aux siens, comme tout le monde. Peut en plus poser une **décision d'approbation** sur un commentaire (voir 3.4) — c'est le mécanisme concret de "valider".

**`writer`** — édite le contenu, gère ses variantes, ne crée ni ne supprime :

- Canvas builder : contenu — **édition activée** ; structure, style — aucun contrôle affiché (mêmes booléens que reviewer, sauf `canEditContent: true`).
- Listing de mailings : renommer, déplacer, dupliquer/copier — **conservés** (permet de décliner des variantes à partir d'un mailing existant) ; créer un nouveau mailing "from scratch" et supprimer — **masqués**. Même mécanisme `TABLE_HIDDEN_COLUMNS_WRITER` que pour reviewer, mais avec un jeu d'actions cachées plus restreint (DELETE + l'entrée "nouveau mailing" du point d'entrée de création, pas RENAME/MOVE_MAIL/COPY_MAIL).
- Gestion de dossiers : inchangée par rapport à `regular_user` — rien dans la demande produit ne justifie de la restreindre pour `writer`.
- Envoi de test : conservé.
- Commentaire : mêmes droits qu'un `regular_user` (pas d'action de décision d'approbation affichée par défaut — voir 3.4).

### 3.4 Décision d'approbation sur les commentaires (mécanisme de "validation")

"Valider" pour `reviewer` ne crée pas un nouveau statut d'approbation séparé sur le mailing — c'est un commentaire qui porte une décision. Extension minimale du système de commentaires existant (`packages/server/comment/comment.schema.js`, 200 lignes, déjà riche : `category`, `severity`, `resolved`/`_resolvedBy`/`resolvedAt`, `mentions`, soft delete) :

- Nouveau champ `decision: { type: String, enum: ['approved', 'changes_requested'], default: null }` sur `CommentSchema`. `null` = commentaire normal ; `'approved'`/`'changes_requested'` = décision de revue.
- `createComment` (`comment.controller.js:129-152`, `comment.service.js:133-187`) : threader `decision` dans les paramètres acceptés et dans le payload `Comments.create`, au même niveau que `category`/`severity`. Pas de validation supplémentaire côté service au-delà de l'enum Mongoose.
- Restriction additive pour le spectateur non loggué (section 5) : `req.user.isShareViewer` ne peut pas poser de `decision` (même logique que l'interdiction actuelle de `delete`/`resolve`) — l'approbation est une action de revue interne, pas une action de spectateur externe.
- Côté UI éditeur (composeur de commentaire) : deux actions dédiées "Approuver" / "Demander des changements" qui soumettent un commentaire avec `decision` renseigné ; affichées pour `reviewer`/`company_admin`/`super_admin`, masquées pour `writer`/`regular_user` (qui gardent le commentaire simple). Le fil de commentaires affiche un badge distinct pour les commentaires de décision.
- Pas de rollup "statut d'approbation courant du mailing" affiché dans le listing dans cet incrément (ex. badge "Approuvé" sur la ligne du mailing) — amélioration possible mais non nécessaire pour livrer le besoin exprimé ; à envisager plus tard si le besoin se confirme, indépendamment de [#1103](https://github.com/Badsender-com/LePatron.email/issues/1103) puisque ce n'est pas un problème de permissions.

### 3.5 Règle "rôle global à la company, pas par workspace"

Le rôle vit sur `User.role`, un champ scalaire — aucune structure supplémentaire n'est nécessaire pour respecter cette règle, elle est déjà garantie par construction. À documenter explicitement comme invariant pour éviter qu'un futur développeur n'introduise un rôle par workspace en réutilisant `Workspace._users`.

### 3.6 Matrice rôles × permissions (cible, scope réduit et affiné)

Légende : **Full** = CRUD complet · **Own** = restreint à sa company · **Assigned** = restreint aux workspaces assignés · **R** = lecture seule · **C** = commenter seulement · **—** = aucun accès · **UI:** = restriction non garantie côté serveur (section 3.3).

| Domaine                                                | regular_user | writer   | reviewer | company_admin_tech | company_admin                          |
| ------------------------------------------------------ | ------------ | -------- | -------- | ------------------ | -------------------------------------- |
| Company (réglages généraux)                            | —            | —        | —        | —                  | Own (déjà restreint par `pick()`)      |
| Users & rôles (créer/assigner un rôle)                 | —            | —        | —        | —                  | Own, sauf `super_admin`                |
| Workspaces (CRUD + membres)                            | —            | —        | —        | —                  | Own                                    |
| Workspaces (accès)                                     | Assigned     | Assigned | Assigned | Assigned           | Own                                    |
| Mailing — créer                                        | Full         | UI: —    | UI: —    | Full               | Own                                    |
| Mailing — renommer / déplacer / dupliquer              | Full         | UI: Full | UI: —    | Full               | Own                                    |
| Mailing — supprimer                                    | Full         | UI: —    | UI: —    | Full               | Own                                    |
| Mailing — dossiers (créer/renommer/déplacer/supprimer) | Full         | Full     | UI: —    | Full               | Own                                    |
| Mailing — envoyer un test                              | Full         | Full     | Full     | Full               | Own                                    |
| Intégrations / AI features / feed mappings             | —            | —        | —        | Own (nouveau)      | Own _(inchangé, écart documenté)_      |
| Exports / profils ESP                                  | —            | —        | —        | —                  | — (inchangé, super-admin only)         |
| Builder — structure                                    | Full         | UI: —    | UI: —    | Full               | Full                                   |
| Builder — contenu                                      | Full         | UI: Full | UI: —    | Full               | Full                                   |
| Builder — style                                        | Full         | UI: —    | UI: —    | Full               | Full                                   |
| Commentaire — créer/répondre/résoudre                  | Full (siens) | Full     | Full     | Full               | Full (aussi autrui, comme aujourd'hui) |
| Commentaire — décision d'approbation (3.4)             | —            | —        | Full     | —                  | Full                                   |

`super_admin` n'apparaît plus dans cette matrice : inchangé par cet incrément (toujours le compte env var, accès complet partout). `company_admin_tech` a un accès "Full" identique à `regular_user` sur mailing/builder/commentaire (rien ne justifie de le restreindre là-dessus, sa spécificité est uniquement l'accès technique en plus). Le spectateur non loggué n'apparaît pas dans cette matrice : ce n'est pas un `User.role`, c'est un accès dérivé d'un token de partage (section 5), lui-même restreint à créer/répondre (jamais résoudre/supprimer/décider) sur le seul mailing pointé par son lien.

---

## 4. Incrément d'implémentation

### Incrément unique — Nouveaux rôles + spectateur non loggué

**Livrable** : `company_admin_tech`, `reviewer`, `writer` existent en tant que rôles assignables ; `company_admin_tech` opère réellement sur les réglages techniques ; `reviewer`/`writer` ont une expérience builder restreinte côté UI ; un spectateur non loggué peut consulter et commenter un mailing via un lien de partage.

Fichiers à créer : `packages/server/share/share-link.schema.js`, `.service.js`, `.controller.js`, `.routes.js`, `.guard.js` ; `packages/ui/helpers/roles.js`.

Fichiers à modifier :

- `packages/server/account/roles.js` (3 nouvelles constantes), `packages/server/user/user.schema.js` (enum `role` étendu, pas de flip d'`isAdmin` — hors scope), `packages/server/account/auth.guard.js` (nouveau `GUARD_GROUP_ADMIN_OR_TECH`).
- `integration.routes.js`/`ai-feature.routes.js`/`feed-mapping.routes.js`/`template.routes.js` (swap du guard pour `company_admin_tech`), `packages/ui/helpers/pages-acls.js` + `meta.acl` des pages techniques + sidebar.
- `packages/editor/src/js/ext/badsender-current-user.js` + `toolbox.tmpl.html` (booléens `canEditStructure`/`canEditContent`/`canEditStyle`/`canComment`).
- `packages/ui/routes/mailings/__partials/mailings-table.vue` (nouveaux jeux `TABLE_HIDDEN_COLUMNS_REVIEWER`/`_WRITER` dans le calcul existant des actions cachées) et `packages/ui/components/sidebar/context/bs-sidebar-workspace-tree.vue` (restriction des actions de dossier pour `reviewer`).
- `packages/server/comment/comment.schema.js` (nouveau champ `decision`), `comment.controller.js`/`comment.service.js` (threader `decision`, interdiction pour le spectateur non loggué), composeur de commentaire côté éditeur (actions "Approuver"/"Demander des changements", badge de décision) — détail en section 3.4.
- `comment.controller.js`/`comment.routes.js`/`comment.service.js` (accepter session **ou** token de partage, restrictions spectateur), `packages/editor/src/js/ext/badsender-comments.js` (utilisateur virtuel spectateur), écran de gestion des liens côté UI (génération/expiration/révocation).

Détail du spectateur non loggué : voir section 5. Détail de la restriction `company_admin_tech`/`reviewer`/`writer` : voir sections 3.2 et 3.3. Détail de la décision d'approbation : voir section 3.4.

Migration de données : aucune migration destructive — l'enum `role` ne fait qu'ajouter des valeurs, les `User` existants gardent leur rôle actuel ; les nouveaux rôles ne s'appliquent qu'aux utilisateurs reclassés manuellement.

---

## 5. Spectateur non loggué — lien de partage

### 5.1 Schéma — `packages/server/share/share-link.schema.js`

```
ShareLinkSchema = {
  token: String (unique, index, généré via rand-token comme UserSchema.token),
  _mailing: ObjectId ref Creation (required),
  _company: ObjectId ref Group (dénormalisé, même pattern que CommentSchema._company),
  _createdBy: ObjectId ref User (required),
  permissions: { type: [String], enum: ['read', 'comment'], default: ['read', 'comment'] },
  expiresAt: Date (required — pas de lien sans expiration, ex. +30 jours par défaut),
  revokedAt: Date (null = actif),
  lastAccessedAt: Date,
  accessCount: Number (default: 0),
}
```

Index : `{ token: 1 }` unique, `{ _mailing: 1 }`, `{ expiresAt: 1 }`.

### 5.2 Branchement sans dupliquer `comment.service.js`

Point d'extension unique : `verifyMailingAccess(mailingId, user)` (`comment.service.js:99-128`). Un nouveau middleware `GUARD_SHARE_TOKEN` résout le token en un **objet `user` synthétique** : `{ id: null, isAdmin: false, isShareViewer: true, _company: shareLink._company, group: { id: shareLink._company } }`. Ce faux "user" satisfait déjà la comparaison de company dans `verifyMailingAccess` **sans modifier une seule ligne du service existant**.

Sur `comment.routes.js`, un middleware composite `GUARD_USER_OR_SHARE_TOKEN` (nouveau, `comment.guard.js`) essaie `GUARD_USER` puis, à défaut, `GUARD_SHARE_TOKEN`. Restrictions additives dans `comment.controller.js`/`comment.service.js` : si `req.user.isShareViewer`, refuser `deleteComment`/`resolveComment`/`unresolveComment` et refuser de poser une `decision` (section 3.4) — le spectateur commente, il ne modère pas et ne valide pas — et exiger un nom saisi à la volée pour l'auteur du commentaire. `CommentSchema._author` devient nullable, avec un champ additif `authorType: 'user' | 'share-viewer'` et `_shareLink` (ref) pour tracer la provenance.

### 5.3 Révocation / expiration / journal

- Révocation : `PATCH /api/share-links/:id/revoke`, guard `GUARD_USER` + `verifyMailingAccess` réutilisé.
- Expiration : vérifiée à chaque résolution de token (`expiresAt < now` ou `revokedAt` non-null ⇒ 410 Gone).
- Compteurs par lien uniquement (`lastAccessedAt`, `accessCount` sur `ShareLinkSchema`, section 5.1) — pas de journal d'audit transverse dans cet incrément. Un audit log générique (traçabilité des changements de rôle et réglages sensibles, incluant création/révocation de lien) est différé dans [l'issue #1102](https://github.com/Badsender-com/LePatron.email/issues/1102).

---

## 6. Audit log — différé

Le chantier d'audit log (modèle, service, points d'instrumentation, écran de consultation) est sorti de cet incrément et traité dans [l'issue #1102](https://github.com/Badsender-com/LePatron.email/issues/1102). Il n'existe aujourd'hui aucun mécanisme de traçabilité des changements de rôle ou des réglages sensibles — ce constat reste valide et documenté dans cette issue.

---

## 7. Plan de tests

### 7.1 Renforcer les tests de guards existants

- `tests/server/account/roles.test.js` : étendre pour couvrir les 3 nouvelles constantes de rôle et l'absence de collision.
- **Nouveau** `tests/server/account/auth.guard.test.js` (aucun test dédié n'existe aujourd'hui sur `guard()` lui-même, contrairement à `group.guard.test.js`) : `GUARD_USER` accepte tout user authentifié ; `GUARD_GROUP_ADMIN` accepte `isGroupAdmin` OU `isAdmin` ; `GUARD_GROUP_ADMIN_OR_TECH` accepte `company_admin`, `company_admin_tech` OU `isAdmin`, mais pas `reviewer`/`writer`/`regular_user`.
- **Nouveau** test sur l'enum `role` de `user.schema.js` : accepte les 5 valeurs persistées (`regular_user`, `company_admin`, `company_admin_tech`, `reviewer`, `writer`), rejette `super_admin` (toujours hors enum, voir [#1101](https://github.com/Badsender-com/LePatron.email/issues/1101)) et toute valeur arbitraire.

### 7.2 Tests d'isolation cross-tenant

Dans `tests/server/security/`, même naming que l'existant (`exploit-f2-idor-cross-tenant.test.js`, `exploit-f4-apikey-leak.test.js`) :

- `exploit-rbac-1-share-token-scope.test.js` : un token de partage d'un mailing A ne donne pas accès aux commentaires du mailing B, ni `delete`/`resolve`.
- `exploit-rbac-2-tech-admin-no-user-access.test.js` : un `company_admin_tech` ne peut pas lister/créer/modifier des utilisateurs ou des workspaces via l'API, même en devinant les routes.

Les tests d'escalade liés à `super_admin` (auto-promotion, retrait du dernier admin) sont différés avec [#1101](https://github.com/Badsender-com/LePatron.email/issues/1101), puisque `super_admin` reste hors de l'enum persisté dans cet incrément.

### 7.3 Non-régression fonctionnelle

Étendre `group.guard.test.js` (cas `company_admin_tech`), `integration.service.test.js` (déjà bon niveau cross-tenant), et créer `tests/server/comment/comment.service.test.js` si absent, pour couvrir : `deleteComment`/`resolveComment` avec un spectateur non loggué (refus) et un reviewer/writer (comportement inchangé : échec sur commentaire d'autrui, succès sur le sien) ; `createComment` avec `decision: 'approved'|'changes_requested'` pour un utilisateur normal (accepté, persisté) et pour un spectateur non loggué (`isShareViewer`, rejeté).

### 7.4 Tests UX/UI

- Composant `users/form.vue` : le sélecteur de rôle propose les 5 rôles assignables (hors `super_admin`). Vérifier que les onglets Intégrations/AI Features/Feed Mappings/Tracking sont visibles pour `company_admin_tech` et que Users/Workspaces/Réglages généraux ne le sont pas.
- Composant `mailings-table.vue` : pour `reviewer`, les actions renommer/déplacer/dupliquer/supprimer sont absentes des lignes de la table ; pour `writer`, renommer/déplacer/dupliquer restent présentes mais supprimer et "nouveau mailing" sont absents ; pour `regular_user`/`company_admin_tech`, comportement inchangé.
- Composant `bs-sidebar-workspace-tree.vue` : pour `reviewer`, les actions de dossier (renommer/déplacer/supprimer/créer sous-dossier) sont absentes du menu.
- Éditeur (`toolbox.tmpl.html`, composeur de commentaire) : pour `reviewer`, structure/style/contenu désactivés, actions "Approuver"/"Demander des changements" visibles ; pour `writer`, contenu activé, structure/style désactivés, pas d'action de décision affichée.

Une checklist QA manuelle (`docs/rbac-testing-checklist.md`, sur le modèle de `docs/comments-testing-checklist.md`) sera créée au moment de l'implémentation de cet incrément, une fois les écrans réels disponibles à tester.

---

## 8. Hors périmètre

Quatre chantiers sont explicitement sortis de cet incrément et suivis dans des issues dédiées :

- **Team / notion d'équipe au sein d'une company** — [issue #1100](https://github.com/Badsender-com/LePatron.email/issues/1100).
- **`super_admin` en rôle persistant multi-comptes** (migration DB, flip d'`isAdmin`, garde-fous anti-escalade) — [issue #1101](https://github.com/Badsender-com/LePatron.email/issues/1101). Le compte super admin en variable d'environnement reste le mécanisme de bootstrap/break-glass permanent, il n'est pas remplacé par des comptes DB dans cet incrément.
- **Audit log** des changements de rôle et réglages sensibles — [issue #1102](https://github.com/Badsender-com/LePatron.email/issues/1102).
- **Gestion granulaire des droits par feature et action** (moteur de permissions générique, enforcement serveur fin pour `writer`) — [issue #1103](https://github.com/Badsender-com/LePatron.email/issues/1103), avec un premier inventaire des features administrables actuelles.

Autres éléments hors périmètre, indépendants du découpage ci-dessus :

- **Renommage des identifiants de code** `group`→`company` (modèle Mongoose `Group`, fichiers `group.*.js`, guards `isGroupAdmin`/`GUARD_GROUP_ADMIN`, ACL `ACL_GROUP_ADMIN`, routes `/groups/...`) : seul le vocabulaire visible (libellés UI, i18n `fr.js`/`en.js`, documentation) est renommé dans l'immédiat. Le renommage du code est un incrément technique séparé, sans urgence fonctionnelle.
- **Resserrement de l'accès aux intégrations** pour le retirer à `company_admin` : documenté comme écart avec la vision produit (section 2), mais non traité avant qu'une décision produit explicite ne soit prise — `company_admin_tech` reçoit cet accès en alternative dans cet incrément, sans que `company_admin` ne le perde.
