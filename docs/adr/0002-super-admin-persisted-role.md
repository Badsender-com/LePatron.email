# Super admin is a persisted role, bootstrapped by the configuration account

- Status: proposed
- Date: 2026-10-05
- Epic: #1153

Until now the only super admin was the account defined by the deployment configuration: a frozen object outside the database, one per environment, shared by everyone who operates the platform. `super_admin` becomes a value of the `role` field of `User`, and a user's admin status derives from that role, so several named super admin accounts can exist. The configuration account is kept, unchanged: it is what creates the first super admin of a new environment, and it stays the one account the application never lists, demotes or removes. We chose this over a one-off migration script because the account already passes the admin guard without any data, so the management screen is the only creation path to build and test.

A super admin always belongs to the platform group (`Group.isPlatform`), reusing the single group each environment already flags for the AI playground, rather than making `_company` optional for this role. The invariant keeps super admins out of every client's user list, and gives them an ordinary account: invitation email, password reset, deactivation, single active session, with no special case in the authentication code. Only the configuration account keeps its exemptions, in one place.

Super admins are managed from a dedicated screen, not from the platform group's user tab, where they are hidden. Only a super admin can grant, revoke, deactivate or reactivate the role, including on existing members of the platform group; a super admin can neither demote nor deactivate themselves; and at least one active super admin must remain in the database, the configuration account not counting. Demotion is allowed and leaves the account in the platform group with the role chosen by the actor.

## Considered Options

- **`_company` optional for super admins**: rejected, every group-scoped query and guard assumes a company on the user; the platform group costs nothing and already exists.
- **Atomic permissions skeleton in the same change** (the RBAC plan's increment A): rejected, it has no consumer until the new roles of #1099 land, and this change is the riskiest of the RBAC work.
- **Forbidding demotion, deactivation only**: rejected, a demoted operator keeps their history and their account in the platform group.

## Consequences

- Flipping `isAdmin` from "always false" to "derived from the role" changes nothing at deployment, since no stored user has the role yet; the risk lives in the accounts created afterwards, hence the dedicated guard tests.
- The screen is a global admin page without a group in its URL, so it is exposed to #1074, fixed separately.
- The screen refuses to create anything on an environment with no platform group, with an explicit message, instead of creating one.
