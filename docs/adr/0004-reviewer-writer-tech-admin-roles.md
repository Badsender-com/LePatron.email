# Reviewer, writer and tech admin roles: a role is a fixed list of capabilities, refused unless listed

- Status: proposed
- Date: 2026-10-13, revised 2026-10-15
- Issue: #1099
- Extends: ADR 0002 (the permissions module)

Three roles join `regular_user`, `company_admin` and `super_admin` (ADR 0002): `company_admin_tech`, `reviewer` and `writer`. The design, the rights matrix and the progress live in `docs/plans/rbac-refonte.md`; this record keeps the decisions that are hard to reverse or easy to misread.

A role is a fixed list of capabilities, declared once in `packages/shared/access/roles.js`, which the server, the UI and the editor all read. A capability names one thing a role allows anywhere (`mailing.delete`, `folder.manage`, `group.manage-tech`). Nothing is granted by default: a capability a role does not list is refused, a role the product does not define has none, and a new role starts with none. A super admin and the bootstrap account hold every capability. An account stored before roles existed has no role and is read as a regular user, as it always was.

This extends ADR 0002 rather than sitting beside it: the permissions module answers `can(user, capability)`, and keeps answering the scope apart (which group, which workspace). Every server route that writes declares the capability it needs (`GUARD_CAN`). A test walks every write route of every router and fails on one that declares nothing, unless it is listed as open on purpose, with the reason: signing in, the user's own preferences. The server sends the user's capabilities with the current user. The UI asks its store (`CAN`) and the editor asks `userCan`, so neither tests the user's role, and both show what the server will accept; a page names the capability it needs. Another account's role is data the screens display, and what it allows is read through the shared map (`roleCan`), never by its name. On the server, `permissions.js` reads every right from the role alone, and is the only code that does: elsewhere the code asks `can` for a right and `canAccessGroup` for the company of a resource.

A tech admin is a company admin with the technical settings on top (integrations, AI features, feed mappings, tracking): its list is the company admin's plus `group.manage-tech`, which a company admin does not have. Nobody grants a role, or manages an account, whose capabilities are not all their own: a company admin neither makes a tech admin nor edits, resets, deactivates or reactivates one, since editing the email then resetting the password is taking the account. The super admin role keeps its own, stricter rules, checked first.

What the server enforces for the writer is what a route can tell: starting an email from a template, deleting one, deleting a folder (which deletes its emails), saving to the block library. A writer declines the existing emails into variants, so copying and duplicating are open to it. Inside a save, the email's JSON mixes structure, content and style, so the writer's limits on structure and style are held by the editor only, until #1103. The reviewer saves nothing, not even the save the editor runs on opening an email without preview: the stored rendering is what the exports send, so it waits for someone who may edit the email.

Every role may approve an email, comment, send tests, export and use the image gallery.

## Considered Options

- **A guard refusing the reviewer, route by route** (the first version of this change): rejected. It let through every route nobody thought of: deleting a folder deleted the emails a reviewer could not delete one by one, and a new route was open to every role by default.
- **Comparing roles where a right is checked**: rejected. Three layers each compared role names, and they already disagreed about the writer. Asking for a capability leaves one place to change.
- **Capabilities as resource × action** (`mailing: ['create', 'delete']`, as start-ui's access control declares them): not taken. The routes group into a few coarse capabilities, and a flat closed list is enough to check names in tests and templates. The list can be split later without touching the roles' callers.
- **A generic permission engine with roles stored in the database** (#1103): rejected for this change. The roles are fixed for the product today; #1103 adds the server checks inside a save on top of the same capabilities.
- **A tech admin without the company admin rights**: rejected by the product. A tech admin supports a company admin on users and works on the emails of every workspace.

## Consequences

- Adding a route that writes means choosing its capability, or the test fails; adding a role means writing its list, and the matrix test (`tests/shared/access/roles.test.js`) states every role × capability.
- The writer's limits on structure and style guide users, they are not a boundary between roles, until #1103.
- A misspelt capability throws, on the server when the routes load and in the editor and the UI at the first check, instead of refusing everyone silently.
- The workspace created with a group resets every role but the super admin to `regular_user` (`group.service.js`); whether the three new roles should be kept is to be settled with the super admin epic's owner.
