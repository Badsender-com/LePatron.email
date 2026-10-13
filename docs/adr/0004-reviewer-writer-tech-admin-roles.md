# Reviewer, writer and tech admin roles: fixed roles, restrictions mostly in the interface

- Status: proposed
- Date: 2026-10-13
- Issue: #1099

Three roles join `regular_user`, `company_admin` and `super_admin` (ADR 0002): `company_admin_tech`, `reviewer` and `writer`. The design, the rights matrix and the progress live in `docs/plans/rbac-refonte.md`; this record keeps the decisions that are hard to reverse or easy to misread.

The roles are fixed values of `User.role`, checked in guards and in the editor, not rows of a permission engine. A tech admin is a company admin with the integrations, AI features, feed mappings and tracking on top: `isGroupAdmin` is true for both roles, `isGroupAdminTech` for the tech admin alone, and the technical routes are guarded by the latter. A company admin has no access to those four areas. Only a super admin or a tech admin grants or revokes the tech admin role, so that a company admin cannot give themselves the integrations (`tech-admin-policy.js`); the super admin role keeps its own, stricter rule.

The reviewer and the writer are limited by the editor: the editor computes each capability once (`ext/badsender-current-user.js`, read through `userCan`) and denies everything until the current user is loaded. Locking the structure, content or style of a mailing, hiding builders, saving and renaming are decisions of the interface. The server enforces two restrictions: a share link is revoked by its author or by an administrator, and a reviewer writes no mailing (`GUARD_NOT_REVIEWER` on the routes that create, rename, move, copy, delete, tag or save a mailing, its email settings and its ignored quality results), except for the save the editor runs once on opening a mailing that has no preview. What a writer may touch inside a mailing is not enforced by the server.

Every role may approve an email (the approve button is shown to all roles), use the image gallery, export, and use text generation. The compose tool, the HTML code block and the email CSS belong to the structure, so they are refused to the reviewer and the writer.

## Considered Options

- **A generic permission engine** (issue #1103): rejected for this change. It is the right shape once rights vary per feature and action, but the six roles are enough for the product today and the engine has no other consumer.
- **Server enforcement for the writer in this change**: rejected, it needs the mailing JSON to be diffed or split by area. It is tracked with #1103. The reviewer, who writes nothing, is enforced.
- **A tech admin that does not include the company admin rights**: rejected by the product, a tech admin supports a company admin on users and works on the mailings of every workspace.

## Consequences

- The writer's restrictions guide users, they are not a boundary between roles, until #1103; a reviewer is held by the server.
- The editor's permissive default for an unknown role is accepted while the roles are a closed list; a new role must be added to `badsender-current-user.js` and to the lists of `helpers/roles.js`, hence the plan's note on the four places to touch.
- A company admin can still edit, deactivate or reset the password of a tech admin: only the grant and the revocation of the role are framed.
- The workspace created with a group resets every role but the super admin to `regular_user` (`group.service.js`); whether the three new roles should be kept is to be settled with the super admin epic's owner.
