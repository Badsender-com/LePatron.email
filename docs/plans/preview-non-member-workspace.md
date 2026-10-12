# Aperçu d'un email d'un workspace non-membre

Statut : correctif écrit (test d'abord). Règle retenue : l'aperçu se lit comme la source d'une copie.
Branche : `fix/preview-non-member-workspace`.

## Symptôme

Dans une company où `userHasAccessToAllWorkspaces` est actif, un `regular_user` peut parcourir un workspace dont il n'est pas membre. L'action rapide « Aperçu » y affiche « L'aperçu sera généré lors de l'ouverture dans l'éditeur », alors qu'il n'a pas les droits d'ouvrir l'éditeur. L'aperçu sert pourtant à choisir quoi dupliquer vers ses propres workspaces.

## Cause

Régression confirmée par lecture du code. Elle n'a pas été reproduite dans un navigateur.

- Commit `d913872a` (2026-09-24, « appliquer le flag htmlBlockEnabled côté serveur, protéger l'aperçu »). Il a ajouté `addGroupFilter` et `assertUserCanEditMailing` à `previewMail` (`packages/server/mailing/mailing.service.js`, appel ligne 1476).
- Le filtre de company ajouté par ce commit est correct et reste.
- `assertUserCanEditMailing` (l. 274-292) exige l'appartenance au workspace via `workspaceService.hasAccess` (`workspace.service.js:61-71`). Cette fonction ne lit jamais `userHasAccessToAllWorkspaces` :
  - email dans un workspace : 403 `FORBIDDEN_RESOURCE_OR_ACTION` ;
  - email dans un dossier : `folderService.hasAccess` lève un 404.
- Côté UI, `packages/ui/routes/mailings/__partials/mailings-preview-modal.vue` (`fetchPreview`) attrape toute erreur et affiche `mailings.errorPreview` / `subErrorPreview` (`packages/ui/helpers/locales/fr.js:397-398`, `en.js:391-393`). Le 403 devient le même message que celui d'un aperçu pas encore généré.

Chaîne complète : `mailings-table.vue` (action `preview`, l. 311-316) → modal → `GET /mailings/:id/preview` (`mailing.routes.js:26`) → `previewHtml` (`mailing.controller.js:397-405`) → `previewMail`.

## Chronologie

- 2026-08-19, `5f3f4bd2` : sanitisation de l'aperçu, pas de contrôle d'accès.
- 2026-09-24, `d913872a` : ajout du contrôle d'accès, qui introduit la régression.
- Présent sur `master` (HEAD `06eb4337`, 2026-09-28), `staging` et `develop`. En prod depuis environ le 2026-09-24 à 28.
- `feat/roles-permissions` a le même `previewMail` et ne corrige rien. `docs/plans/rbac-refonte.md` (sur cette branche) ne couvre pas l'endpoint d'aperçu.

## Incohérence avec les autres actions

| Action                                         | Droit exigé sur la source                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Listing                                        | lecture, avec `restrictAccessingWorkspacesForNonMemberUser`                          |
| `POST /mailings/copy` (`copyMailing`, l. 1212) | lecture : `workspaceService.doesUserHaveReadAccess` (`workspace.service.js:310-316`) |
| `POST /mailings/:id/duplicate`                 | company seulement (`addGroupFilter`)                                                 |
| `GET /mailings/:id/preview`                    | **appartenance au workspace**                                                        |

L'aperçu est la seule action de lecture qui exige l'appartenance. `copyMailing` précise en commentaire que copier hors d'un workspace est une lecture.

## Correctif prévu

1. **Serveur.** Dans `previewMail`, remplacer `assertUserCanEditMailing` par le contrôle de lecture de `copyMailing` : résoudre le workspace (`folderService.getWorkspaceForFolder` pour un email en dossier, `workspaceService.getWorkspace` sinon), puis `workspaceService.doesUserHaveReadAccess(user, workspace)`. Extraire cette résolution en helper partagé avec `copyMailing`. Garder `addGroupFilter` et la sanitisation en sortie. Vérifier que le super admin passe toujours.
2. **Serveur.** Un aperçu vide répond 404 avec son propre code, `MAILING_PREVIEW_NOT_GENERATED`, après le contrôle d'accès. Un 404 veut aussi dire « email, workspace ou dossier introuvable » : le statut seul ne suffit pas à choisir le message.
3. **UI.** Le message suit le code d'erreur, via `previewErrorMessages` (`packages/ui/helpers/preview-error.js`) :

   - aperçu pas encore généré, utilisateur qui peut éditer : message actuel (« sera généré lors de l'ouverture dans l'éditeur ») ;
   - aperçu pas encore généré, utilisateur en lecture seule : « sera généré quand un membre du workspace ouvrira l'email dans l'éditeur » ;
   - toute autre erreur : « L'aperçu n'a pas pu être chargé ».

   Le listing passe `canEdit` (son `hasAccess`) au modal. Nouvelles clés dans `fr.js` et `en.js` (pas de DE dans `packages/ui/helpers/locales`).

## Règle d'accès retenue

Tout utilisateur de la company peut prévisualiser un email de n'importe quel workspace de cette company, membre ou non, quel que soit `userHasAccessToAllWorkspaces`. Ce réglage décide de ce que le listing montre ; il ne restreint ni l'aperçu ni la copie. Une URL d'aperçu partagée entre collègues d'une même company s'ouvre donc pour chacun d'eux.

Ce choix aligne l'aperçu sur la copie (`copyMailing`), qui suit déjà cette règle. Les deux passent par `getOwningWorkspace` puis `doesUserHaveReadAccess`, et des tests figent la règle sur les deux chemins.

## Tests

`tests/server/mailing/mailing.service.preview-mail.test.js`, avec le vrai `doesUserHaveReadAccess` :

- non-membre : l'aperçu est retourné (email en workspace et en dossier), sans lire le réglage de la company ;
- email ni en workspace ni en dossier : servi sur le seul filtre de company ;
- workspace d'une autre company : NotFound, avant de dire si l'aperçu existe ;
- super admin : inchangé ;
- `previewHtml` vide : NotFound `MAILING_PREVIEW_NOT_GENERATED`.

`tests/server/mailing/mailing.service.copy-access.test.js` : la même règle pour la source d'une copie (workspace, dossier, autre company), et l'écriture toujours exigée sur la destination.

`tests/ui/helpers/preview-error.test.js` : le message affiché pour chaque erreur, selon que l'utilisateur peut éditer.

## Vérification

- `yarn test-ci` sur le fichier ci-dessus, puis `yarn code:lint`.
- À la main sur la stack locale : company avec `userHasAccessToAllWorkspaces`, `regular_user` non-membre d'un workspace. L'aperçu depuis le listing doit s'afficher, puis la copie vers son workspace doit fonctionner. Un utilisateur d'une autre company doit être refusé.
- Pas de changement dans `packages/editor/`, donc pas de `yarn editor:build`.
