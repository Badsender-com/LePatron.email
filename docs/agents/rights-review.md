# Rights review

Run by every review (`code-reviewer`, `security-auditor`, `/review`, `/security-review`) when the diff touches rights. It checks what each role may do after the change, on the server, in the UI and in the editor. The rules it checks are in `AGENTS.md`, section "Rights"; the decisions in [ADR 0004](../adr/0004-reviewer-writer-tech-admin-roles.md) and `docs/plans/rbac-refonte.md` §3.6.

## When it applies

The diff touches any of:

- `packages/shared/access/roles.js`, `packages/server/account/` (guards, permissions, scope), `packages/server/user/` (roles, account management);
- a `*.routes.js` (a route added, removed, or its guard changed), or a controller or service that reads `req.user`;
- a `CAN(` / `CAPABILITIES.` in the UI, `packages/ui/helpers/pages-acls.js`, `packages/ui/helpers/constants/roles.js`, a role picker or the users table;
- a `userCan(` / `isReadOnly` / `lockMessageKey` in the editor or its templates;
- an `isAdmin`, `isGroupAdmin`, `isGroupAdminTech`, `Roles.` or `.role` test, added or inside a function the diff changes.

None of these: write `Rights touched: none` with the reason in one line, and stop.

## Steps

1. **List the acts.** Each thing a user can now do, or do differently: a route (`DELETE /folders/:id`), a button, a menu entry, an editor action. One act per line, named as the user sees it.
2. **Fill the table.** For each act, the expected answer for each role, taken from ADR 0004 and §3.6, not from the code. A role the documents do not settle is a question for the user, not a guess.
3. **Read where it is enforced.** For each act, read the three places in the code and compare them with the table; a place the act does not have (no UI for an API-only route) is marked `—`:
   - **server**: the route's `GUARD_CAN` capability, then `roleCan` of that capability for each role (`roles.js`);
   - **UI**: the `CAN(...)` or page ACL that shows, hides or disables the control;
   - **editor**: the `userCan(...)` behind the lock or the button.
4. **Check the rules.**
   - **One definition**: no role comparison deciding a right outside `account/permissions.js`. Any `isAdmin` / `isGroupAdmin` / `Roles.X` test the diff adds is a finding; for one it runs through, say which branch each role takes and whether that branch is intended. A page names its capability in `meta.acl`.
   - **Same capability on both sides**: the UI and the editor ask for the capability the server's route declares. A control shown that answers 403, or hidden while the request would succeed, is a finding.
   - **Scope**: the server checks that the resource (mailing, folder, workspace, user, image) belongs to the user's group or workspace, not only the capability, through `permissions.canAccessGroup` or the workspace checks, not an id comparison written by hand. A super admin's selected group goes through `request-scope.js`. An id taken from the request is a string, or refused.
   - **Inputs on the wire**: every response that returns the current user carries its capabilities (`withCapabilities`), the login response included; the UI has what its check needs (the target account's role for `canManageAccount`).
   - **Escalation**: a role picker offers only the roles the actor may grant (`roleItems`), and the server refuses the others (`rights-policy.js`). Editing, resetting, activating or deactivating an account with more capabilities than the actor is refused.
   - **Tests in the same diff**: a route added gets its capability or a reasoned `EXEMPTIONS` entry; a role's list changed changes the matrix in `tests/shared/access/roles.test.js`; a test of a right covers every role.
5. **Report.** The table, then one finding per divergence (`file:line — problem — fix`). A cell that differs from the documents without a decision in the diff is a finding, even when the code is consistent.

## Table format

```
## Rights touched

| Act                        | super_admin | company_admin_tech | company_admin | regular_user | writer | reviewer | Server · UI · editor            |
| -------------------------- | ----------- | ------------------ | ------------- | ------------ | ------ | -------- | ------------------------------- |
| Delete a folder            | ✅          | ✅                 | ✅            | ✅           | ❌     | ❌       | folder.delete · folder.delete · — |
| Save the email from editor | ✅          | ✅                 | ✅            | ✅           | ✅     | ❌       | mailing.edit-content · — · canSave |
```

✅ allowed, ❌ refused, as the documents decide. The last column names the capability each place asks for; a divergence is shown there and listed as a finding.

## Public repository

Findings go to the user. A comment on a PR names the fix, never how to exploit the gap; a gap that already exists on `develop` is reported to the user only.
