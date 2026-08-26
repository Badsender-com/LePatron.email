# Refonte des rôles et permissions

Document de conception pour la refonte du système de rôles et permissions de LePatron.email. Rédigé à partir de la vision produit d'Olivier Fredon et d'un audit du code existant. Ce document couvre le cadrage complet ; l'implémentation se fait en incréments séparés (voir [Incréments](#4-incréments-dimplémentation)), chacun étant une PR distincte.

Issue GitHub associée : `Refonte des rôles et permissions`.

## Sommaire

1. [Vision produit](#1-vision-produit)
2. [Audit — vision vs code réel](#2-audit--vision-vs-code-réel)
3. [Modèle RBAC cible](#3-modèle-rbac-cible)
4. [Incréments d'implémentation](#4-incréments-dimplémentation)
5. [Spectateur non loggué — lien de partage](#5-spectateur-non-loggué--lien-de-partage)
6. [Audit log](#6-audit-log)
7. [Plan de tests](#7-plan-de-tests)
8. [Hors périmètre](#8-hors-périmètre)

---

## 1. Vision produit

### Rôles existants, à faire évoluer

- **Utilisateur (regular user)** : droits d'accès et d'actions limités à l'application. Évolution prévue : en tant que company admin, on doit pouvoir assigner les workspaces disponibles depuis le profil utilisateur au moment de sa création ou de sa modification.
- **Administrateur de compte (group admin → company admin)** : mêmes droits qu'un regular user + accès complet à la company et à son administration. Évolution : devient "propriétaire" de la company et peut désigner de nouveaux rôles parmi les utilisateurs de sa company.
- **Super administrateur (super admin)** : mêmes droits que company admin, applicables sur l'ensemble des comptes. Aujourd'hui un seul compte par environnement (prod/staging/dev), défini en variable d'environnement. Évolution : doit devenir un rôle à part entière dans l'application, avec plusieurs comptes individuels possibles.

### Note de vocabulaire

"Group"/"group admin" évoluent vers "company"/"company admin" dans le vocabulaire produit.

### Nouveaux rôles envisagés

- **Administrateur technique (company admin tech)** : accède aux réglages techniques (intégrations, IA, profils d'export, hébergement d'images…) sans pouvoir gérer les utilisateurs ni les workspaces.
- **Relecteur (reviewer)** : ouvre un email en lecture, peut commenter/tester/valider, mais ne peut pas modifier la structure, les contenus ou le style.
- **Rédacteur (writer)** : édite le contenu d'un email mais ne touche pas à sa structure (ajout/suppression de bloc) et n'accède pas aux options de style.
- **Spectateur (non loggué)** : consulte un email partagé via un lien et ajoute un commentaire contextualisé, sans pouvoir modifier l'email. US liée : un utilisateur génère un lien de partage donnant accès à un email à un spectateur non loggué pour recueillir des commentaires.

### Bonus — gestion d'utilisateurs multiples

- Notion d'équipe au sein d'une company.
- Vue d'administration des équipes par les rôles admin (même type d'UI que workspace).
- Liste des utilisateurs assignables à une équipe.
- Si une équipe existe : select dans la vue d'édition de profil pour assigner une ou plusieurs équipes.
- Si une équipe existe : select dans la vue d'édition du workspace pour assigner une ou plusieurs équipes.

### Notes sur l'administration actuelle

- Les super admin n'ont pas d'action associée au listing d'email (copier, renommer, déplacer…).
- Les super admin ne peuvent pas retrouver l'arborescence et donc situer l'email dans l'organisation (workspace > folder) d'une company.
- Les ESP sont administrés par le super admin ; l'admin tech devrait pouvoir le gérer à l'avenir.

### Cadrage fonctionnel de départ

Aujourd'hui, le rôle touche uniquement l'accès au backoffice de l'application ; les permissions associées définissent des actions disponibles sur ce même backoffice (accès réglages, ajout workspace/utilisateur, liste de test, nuancier…). Le rôle n'a pas d'incidence sur les permissions et fonctionnalités du builder. Demain, d'autres outils viendront s'ajouter au builder, et certaines fonctionnalités du builder pourraient être réservées à certains rôles. **Décision : oui**, il faut introduire des permissions liées directement aux fonctionnalités des outils, pas seulement à l'accès aux outils.

Règles de compatibilité actées :

- Un utilisateur ne peut **pas** avoir des rôles différents selon le workspace — le rôle est global à la company.
- Un company admin **peut** déléguer/désigner des rôles à d'autres utilisateurs de sa company.

### Plan d'action macro (4 phases)

1. **Cadrage fonctionnel** — décisions à figer (ce document).
2. **Conception produit (UX + garde-fous)** — écran "Utilisateurs & rôles", UI d'accès dans l'éditeur (actions désactivées), partage "spectateur" (lien, droits, expiration, journal).
3. **Implémentation par incréments** — A (RBAC propre sur les rôles existants) / B (nouveaux rôles standards) / C (spectateur non loggué), activables via feature flags, migration progressive.
4. **Migration, conformité, exploitation** — mapping ancien→nouveau rôle, audit log, tests de non-régression/sécurité/UX, documentation.

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
- Les intégrations/ESP sont déjà gérables par `company_admin` (`GUARD_GROUP_ADMIN` sur `packages/server/integration/integration.routes.js`), pas réservées au super admin comme décrit dans la note d'usage. **Écart documenté, non corrigé pour l'instant** — le resserrement (super admin + futur company admin tech, sans company admin générique) est repoussé à l'incrément B.
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

### 3.1 Rôles codés en dur, permissions atomiques en code

Pour ce chantier (pas de rôles sur-mesure demandés), les rôles restent codés en dur mais la logique est structurée pour qu'un futur passage à des rôles persistés en base soit un simple changement de "backend" de `getPermissionsForRole`, sans toucher les appelants (guards, controllers, UI) :

- `packages/server/account/permissions.js` (nouveau) — constantes de permissions atomiques par domaine : `company:manage-settings`, `company:manage-users`, `company:assign-roles`, `company:delete` (super_admin only), `workspace:manage`, `workspace:access`, `content:write`, `content:read`, `modules:toggle`, `integration:manage`, `ai:manage`, `ai:use`, `builder:edit-structure`, `builder:edit-content`, `builder:edit-style`, `builder:comment`.
- `packages/server/account/role-permissions.js` (nouveau) — table rôle → `Set` de permissions + fonctions pures `getPermissionsForRole(role)` / `hasPermission(user, permission)`.
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
- `packages/server/account/permission.guard.js` (nouveau) — factory `guardPermission(permission)`, **additive** : on ne remplace pas `GUARD_GROUP_ADMIN`/`GUARD_ADMIN`/`GUARD_USER` existants (zéro régression), on ajoute cette factory pour les nouveaux points de contrôle fins de l'incrément B.

### 3.2 `super_admin` : du compte env var au rôle DB multi-comptes (additif)

Point clé : tous les guards et services branchent déjà sur `user.isAdmin` (`auth.guard.js`, `group.guard.js`, `workspace.service.js`, `comment.service.js:verifyMailingAccess`, `integration.service.js:checkIfUserIsAuthorizedToAccessIntegration`). Un seul changement cascade partout :

```js
UserSchema.virtual('isAdmin').get(function () {
  return this.role === Roles.SUPER_ADMIN;
});
```

Étapes, sans casser le bootstrap existant :

1. Étendre l'enum `role` (`user.schema.js:45-49`) pour accepter les 4 nouvelles valeurs. `_company` reste `required` : les comptes super admin sont rattachés au groupe plateforme déjà existant (`Group.isPlatform === true`).
2. Script de migration one-off `scripts/migrate-super-admin.js` (dossier déjà utilisé pour `scripts/seed-playground-demo.js`) : crée le premier `User` avec `role: 'super_admin'`, rattaché au groupe `isPlatform`, email paramétrable, mot de passe à réinitialiser au premier login. Idempotent.
3. **Le compte env var (`config.admin`) reste actif indéfiniment** en parallèle — c'est le mécanisme de bootstrap qui permet de créer/gérer les comptes super admin réels, et le filet de secours permanent de chaque environnement.
4. Garde-fou anti-lockout : vérifier qu'il existe au moins un `super_admin` actif OU que `config.admin` est configuré, sinon logguer une alerte.
5. Écran de gestion des comptes super admin, réservé aux super admin eux-mêmes (via `user.controller.js`/`user.routes.js` existants + garde-fou 3.3).

### 3.3 Garde-fous anti-escalade

1. Impossible de retirer le dernier `company_admin` d'une company (comptage avant désactivation/changement de rôle).
2. Impossible de retirer le dernier `super_admin` de la plateforme (comptage global).
3. Un `company_admin` ne peut pas s'auto-attribuer ni attribuer `super_admin` à un tiers — seul un `super_admin` peut poser ce rôle.
4. Un `company_admin` ne peut assigner des rôles qu'à des utilisateurs de sa propre company.

### 3.4 Règle "rôle global à la company, pas par workspace"

Le rôle vit sur `User.role`, un champ scalaire — aucune structure supplémentaire n'est nécessaire pour respecter cette règle, elle est déjà garantie par construction. À documenter explicitement comme invariant pour éviter qu'un futur développeur n'introduise un rôle par workspace en réutilisant `Workspace._users`.

### 3.5 Matrice rôles × permissions (cible)

Légende : **Full** = CRUD complet · **Own** = restreint à sa company · **Assigned** = restreint aux workspaces assignés · **R** = lecture seule · **C** = commenter seulement · **—** = aucun accès.

| Domaine                                                 | regular_user | writer             | reviewer                                    | company_admin_tech         | company_admin                          | super_admin |
| ------------------------------------------------------- | ------------ | ------------------ | ------------------------------------------- | -------------------------- | -------------------------------------- | ----------- |
| Company (créer/supprimer)                               | —            | —                  | —                                           | —                          | —                                      | Full        |
| Company (réglages généraux)                             | —            | —                  | —                                           | —                          | Own (déjà restreint par `pick()`)      | Full        |
| Users & rôles (créer/assigner un rôle)                  | —            | —                  | —                                           | —                          | Own, sauf `super_admin`                | Full        |
| Workspaces (CRUD + membres)                             | —            | —                  | —                                           | —                          | Own                                    | Full        |
| Workspaces (accès)                                      | Assigned     | Assigned           | Assigned                                    | Assigned                   | Own                                    | Full        |
| Contenu / mailing (créer, éditer, déplacer, supprimer)  | Assigned     | Assigned (contenu) | R + C                                       | —                          | Own                                    | Full        |
| Modules (`enableEmailBuilder`, `enableCrmIntelligence`) | —            | —                  | —                                           | —                          | — (déjà restreint)                     | Full        |
| Exports / intégrations                                  | —            | —                  | —                                           | Own (nouveau, incrément B) | Own _(inchangé, écart documenté)_      | Full        |
| IA (config skills/quotas)                               | Utilise      | Utilise            | Utilise                                     | Own                        | Own                                    | Full        |
| Builder — structure                                     | Full         | —                  | —                                           | n/a                        | Full                                   | Full        |
| Builder — contenu                                       | Full         | Full               | —                                           | n/a                        | Full                                   | Full        |
| Builder — style                                         | Full         | —                  | —                                           | n/a                        | Full                                   | Full        |
| Builder — commentaire                                   | Full (siens) | Full               | Full (créer/résoudre, pas supprimer autrui) | n/a                        | Full (aussi autrui, comme aujourd'hui) | Full        |

`reviewer`/`writer` n'ont aucun accès aux domaines admin (company/workspace/modules/intégrations/IA au-delà de l'usage), pour matérialiser "rôle = permissions builder uniquement". Le spectateur non loggué n'apparaît pas dans cette matrice : ce n'est pas un `User.role`, c'est un accès dérivé d'un token de partage (section 5).

---

## 4. Incréments d'implémentation

### Incrément A — RBAC propre + super_admin en vrai rôle DB

**Livrable** : sécuriser le socle actuel sans toucher à l'éditeur ; `super_admin` devient un rôle persistable multi-comptes, en complément du bootstrap env var.

Fichiers à créer : `permissions.js`, `role-permissions.js` (mapping limité à `regular_user`/`company_admin`/`super_admin` pour A), `permission.guard.js` (posé, pas encore branché), `scripts/migrate-super-admin.js`.

Fichiers à modifier : `roles.js` (ajouter les 3 constantes futures), `user.schema.js` (enum `role` étendu, flip du virtual `isAdmin`), `user.controller.js`/`user.service.js` (garde-fous anti-escalade 3.3).

Migration de données : aucune migration destructive — l'enum ne fait qu'ajouter des valeurs, les `User` existants gardent leur rôle actuel.

### Incrément B — Nouveaux rôles standards + UI + restriction fine des intégrations

**Livrable** : `company_admin_tech`, `reviewer`, `writer` opèrent réellement sur les réglages techniques et l'éditeur.

Côté serveur : compléter `role-permissions.js` ; sur `integration.routes.js`, passer à `guardPermission(PERMISSIONS.INTEGRATION_MANAGE)` — permission détenue par `company_admin_tech`, `super_admin`, et encore `company_admin` (pour ne pas régresser tant que le produit n'a pas tranché le retrait, cf. écart documenté) ; nouveau `packages/server/mailing/builder-permission.guard.js` (`GUARD_BUILDER_STRUCTURE`/`STYLE`/`CONTENT`) sur les endpoints de sauvegarde de mailing qui modifient structure/style, en miroir des permissions builder côté client.

Côté éditeur : `packages/editor/src/js/ext/badsender-current-user.js` enrichi de booléens dérivés (`canEditStructure`, `canEditContent`, `canEditStyle`, `canComment`), idéalement renvoyés directement par `/api/users/current-user` pour éviter de dupliquer la logique de permission côté client. `toolbox.tmpl.html` (les deux variantes) étendu avec ces booléens pour griser/masquer les actions de structure/style pour reviewer/writer — état "désactivé + tooltip explicatif" pour reviewer plutôt qu'un masquage pur.

Côté UI Nuxt : `packages/ui/helpers/roles.js` (nouveau) — liste unique des 6 rôles avec labels i18n, remplace les deux listes dupliquées de `users/form.vue` et `settings/users/_userId.vue`. Composant partagé `workspace-multiselect.vue` extrait de `workspace-form.vue`, réutilisé pour ajouter la section workspace manquante sur l'écran de création utilisateur et pour remplacer les `v-switch` un par un de l'écran d'édition. Si le bonus équipe est retenu : `packages/server/team/team.schema.js` (calqué sur `workspace.schema.js`), routes/écran calqués sur l'existant workspace, même composant multiselect généralisé.

Garde-fous complémentaires : hiérarchie explicite `super_admin > company_admin > company_admin_tech > reviewer/writer > regular_user` pour l'assignation de rôle (sauf `super_admin`, réservé aux super admin uniquement).

Migration de données : aucune — les nouveaux rôles ne s'appliquent qu'aux utilisateurs reclassés manuellement.

### Incrément C — Spectateur non loggué via lien de partage

Voir détail complet section 5. Résumé des fichiers : `packages/server/share/share-link.schema.js`, `.service.js`, `.controller.js`, `.routes.js`, `.guard.js` (nouveaux) ; modifications additives sur `comment.controller.js`/`comment.routes.js` pour accepter session **ou** token de partage ; adaptation de `badsender-comments.js` côté éditeur pour un "utilisateur virtuel spectateur" sans droit de suppression ; écran de gestion des liens côté UI (génération/expiration/révocation/journal).

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

Sur `comment.routes.js`, un middleware composite `GUARD_USER_OR_SHARE_TOKEN` (nouveau, `comment.guard.js`) essaie `GUARD_USER` puis, à défaut, `GUARD_SHARE_TOKEN`. Restrictions additives dans `comment.controller.js`/`comment.service.js` : si `req.user.isShareViewer`, refuser `deleteComment`/`resolveComment`/`unresolveComment` (le spectateur commente, il ne modère pas), et exiger un nom saisi à la volée pour l'auteur du commentaire. `CommentSchema._author` devient nullable, avec un champ additif `authorType: 'user' | 'share-viewer'` et `_shareLink` (ref) pour tracer la provenance.

### 5.3 Révocation / expiration / journal

- Révocation : `PATCH /api/share-links/:id/revoke`, guard `GUARD_USER` + `verifyMailingAccess` réutilisé.
- Expiration : vérifiée à chaque résolution de token (`expiresAt < now` ou `revokedAt` non-null ⇒ 410 Gone).
- Journal : chaque création/révocation de lien, et chaque commentaire posté via un lien, génère une entrée d'audit log (section 6) avec `actorType: 'share-viewer'`.

---

## 6. Audit log

Un seul modèle, un seul service, appelé explicitement aux points sensibles — pas d'interception automatique de toutes les requêtes.

### 6.1 Schéma — `packages/server/audit/audit-log.schema.js`

```
AuditLogSchema = {
  action: String (enum fermé : user.role.changed, user.created, user.deactivated,
                  company.settings.changed, integration.created, integration.deleted,
                  share-link.created, share-link.revoked, workspace.deleted, ...),
  _actor: ObjectId ref User (null si spectateur anonyme),
  actorLabel: String (dénormalisé, même pattern que CommentSchema.authorName),
  _company: ObjectId ref Group,
  _target: ObjectId,
  targetType: String,
  metadata: Mixed (ex: { before: 'regular_user', after: 'company_admin' }),
  createdAt (timestamps: true, log immuable, pas de updatedAt),
}
```

Index : `{ _company: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`.

### 6.2 Service — `packages/server/audit/audit-log.service.js`

Fonction unique `recordAuditEvent({ action, actor, company, target, targetType, metadata })`, fire-and-forget (try/catch + log d'erreur, jamais de `throw` qui ferait échouer la requête métier).

### 6.3 Points d'instrumentation (uniquement les actions sensibles)

- Changement de rôle, désactivation/réactivation de compte, création d'un super admin (`user.controller.js`/`user.service.js`).
- Modification de réglages sensibles de company : FTP/CDN/SAML/modules (`group.controller.js:update`, masquer les secrets comme le fait déjà `groupFtpService.maskFtpCredentials`).
- CRUD intégrations (`integration.controller.js`).
- Création/révocation de lien de partage (`share-link.service.js`).
- Pas d'instrumentation à granularité fine sur les actions builder (structure/contenu/style) — hors périmètre "actions sensibles" ; le commentaire garde son propre historique via `CommentSchema`.

### 6.4 Consultation

Écran minimal `packages/ui/routes/groups/_groupId/settings/audit-log.vue` (`company_admin`/`super_admin` uniquement), route `GET /api/audit-logs?groupId=` filtrée par company (super admin voit tout). Pas d'export CSV ni de recherche full-text pour le MVP.

---

## 7. Plan de tests

### 7.1 Renforcer les tests de guards existants

- `tests/server/account/roles.test.js` : étendre pour couvrir les 3 nouvelles constantes de rôle et l'absence de collision.
- **Nouveau** `tests/server/account/auth.guard.test.js` (aucun test dédié n'existe aujourd'hui sur `guard()` lui-même, contrairement à `group.guard.test.js`) : `GUARD_USER` accepte tout user authentifié ; `GUARD_GROUP_ADMIN` accepte `isGroupAdmin` OU `isAdmin` ; `GUARD_ADMIN` accepte **seulement** `isAdmin: true` — test critique post-incrément A puisque `isAdmin` passe de "toujours false" à "dérivé du rôle" ; cas `super_admin` réel en base.
- **Nouveau** test sur l'enum `role` de `user.schema.js` : accepte les 6 valeurs, rejette une valeur arbitraire.

### 7.2 Matrice de permissions systématique

**Nouveau** `tests/server/account/role-permissions.test.js` : pour chaque rôle × chaque permission, assertion générée par boucle, miroir de la matrice section 3.5 — casse si `role-permissions.js` est modifié sans mise à jour de la matrice documentée.

### 7.3 Tests d'escalade de privilège

Dans `tests/server/security/`, même naming que l'existant (`exploit-f2-idor-cross-tenant.test.js`, `exploit-f4-apikey-leak.test.js`) :

- `exploit-rbac-1-self-promote-super-admin.test.js` : un company admin ne peut pas se poser/poser à un tiers `role: 'super_admin'`.
- `exploit-rbac-2-remove-last-company-admin.test.js` : impossible de désactiver/rétrograder le dernier company admin.
- `exploit-rbac-3-cross-tenant-role-assignment.test.js` : un company admin ne peut pas modifier le rôle d'un user d'une autre company.
- `exploit-rbac-4-share-token-scope.test.js` (incrément C) : un token de partage d'un mailing A ne donne pas accès aux commentaires du mailing B, ni `delete`/`resolve`.

### 7.4 Non-régression fonctionnelle

Étendre `group.guard.test.js` (cas `company_admin_tech`), `integration.service.test.js` (déjà bon niveau cross-tenant), et créer `tests/server/comment/comment.service.test.js` si absent, pour couvrir `deleteComment` avec un reviewer/writer (échec sur commentaire d'autrui, succès sur le sien).

### 7.5 Tests UX/UI

Composant `users/form.vue` : le sélecteur de rôle propose les 6 rôles. Composant `workspace-multiselect.vue` : pré-sélection correcte, comportement verrouillé pour company_admin (repris de `isUserSelected`/`toggleUserSelection`).

Une checklist QA manuelle (`docs/rbac-testing-checklist.md`, sur le modèle de `docs/comments-testing-checklist.md`) sera créée au moment de l'implémentation de l'incrément A, une fois les écrans réels disponibles à tester.

---

## 8. Hors périmètre

- **Renommage des identifiants de code** `group`→`company` (modèle Mongoose `Group`, fichiers `group.*.js`, guards `isGroupAdmin`/`GUARD_GROUP_ADMIN`, ACL `ACL_GROUP_ADMIN`, routes `/groups/...`) : seul le vocabulaire visible (libellés UI, i18n `fr.js`/`en.js`, documentation) est renommé dans l'immédiat. Le renommage du code est un incrément technique séparé, sans urgence fonctionnelle.
- **Resserrement de l'accès aux intégrations** pour le retirer à `company_admin` : documenté comme écart avec la vision produit, mais non traité avant qu'une décision produit explicite ne soit prise (au plus tôt incrément B, pour `company_admin_tech` en alternative, pas en remplacement immédiat).
- **Retrait du compte super admin en variable d'environnement** : ce compte reste le mécanisme de bootstrap/break-glass permanent, il n'est pas remplacé par les comptes DB.
