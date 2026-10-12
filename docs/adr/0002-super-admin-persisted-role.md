# Super admin is a persisted role; the bootstrap account creates the first one

- Status: proposed
- Date: 2026-10-05
- Epic: #1153

Until now the only super admin was the account defined by the deployment configuration: a frozen object outside the database, one per environment, shared by everyone who operates the platform. `super_admin` becomes a value of the `role` field of `User`, and a user's admin status derives from that role, so several named super admin accounts can exist. The bootstrap account is kept, unchanged: it is what creates the first super admin of a new environment, and it stays the one account the application never lists, demotes or removes. We chose this over a one-off migration script because the account already passes the admin guard without any data, so the management screen is the only creation path to build and test.

A super admin always belongs to the platform group (`Group.isPlatform`), reusing the single group each environment already flags for the AI playground, rather than making `_company` optional for this role. The invariant keeps super admins out of every client's user list, and gives them an ordinary account: invitation email, password reset, deactivation, single active session, with no special case in the authentication code. Only the bootstrap account keeps its exemptions.

Super admins are managed from a dedicated screen, not from the platform group's user tab, where they are hidden. Only a super admin can grant or revoke the role, and edit, deactivate, reactivate or reset the password of a super admin, including existing members of the platform group; and a super admin can neither demote nor deactivate themselves. No rule keeps a last active super admin: a super admin acting on another always leaves at least themselves, and the bootstrap account, which is what keeps the platform reachable, may deactivate or demote the last one. Demotion is allowed and leaves the account in the platform group with the role chosen by the actor. The platform flag cannot be unset or moved while active super admins belong to the group, since the invariant would otherwise break after the grant, with one exception: the bootstrap account can move it to another group, and every super admin of the group moves with it. A role the product does not define is refused wherever a role is read: creation, update and the listing filter.

## Considered Options

- **`_company` optional for super admins**: rejected, every group-scoped query and guard assumes a company on the user; the platform group costs nothing and already exists.
- **Atomic permissions skeleton in the same change** (the RBAC plan's increment A): rejected, it has no consumer until the new roles of #1099 land, and this change is the riskiest of the RBAC work.
- **Forbidding demotion, deactivation only**: rejected, a demoted operator keeps their history and their account in the platform group.

## Consequences

- Flipping `isAdmin` from "always false" to "derived from the role" changes nothing at deployment, since no stored user has the role yet; the risk lives in the accounts created afterwards, hence the dedicated guard tests.
- `isAdmin` has carried two meanings: "has platform-wide rights" and "is the bootstrap account". Session tracking and session validation skip it, login does not reload it from the database, the AI playground stores its runs and scenarios without an owner and meters its quota per admin. The flip keeps the first meaning on the role; every check of the second meaning is re-keyed on the bootstrap account's identity, so a persisted super admin has one active session and owns what it creates, like any user. The session side is pinned by the acceptance tests; the playground side by the acceptance criteria of the ticket that flips the virtual.
- Two super admins demoting or deactivating each other at the same moment can leave none. Accepted, since the bootstrap account creates a new one.
- Moving the flag with the super admins is the bootstrap account's job. Unsetting it, or deleting the group, needs no active super admin left in it, which only the bootstrap account can arrange, by deactivating or demoting the last ones.
- The same holds for a promotion racing a move of the flag: checked before the write, it can leave a super admin outside the platform group. Accepted for the same reason; the bootstrap account moves them.
- A super admin is an operator, like the bootstrap account: the app routes it to the groups, it creates no mailing, and it reads and opens the mailings of every group from that group's settings. A member promoted leaves the mailing screens of their group; the promotion says so before it is confirmed.
- Hiding super admins from the platform group's user listing also removes them from that group's workspace member pickers. A super admin reaches every workspace anyway.
- The screen is a global admin page without a group in its URL, so it is exposed to #1074, fixed separately.
- The screen refuses to create anything on an environment with no platform group, with an explicit message, instead of creating one.
