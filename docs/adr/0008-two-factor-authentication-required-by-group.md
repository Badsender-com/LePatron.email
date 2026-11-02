# Two-factor authentication: required by a group, the session opened only once the code is checked

- Status: proposed
- Date: 2026-10-22
- Epic: #1318

A group requires two-factor authentication of all its members, or of none: a tech admin or a super admin switches it on (`group.manage-tech`), as the company's other technical settings (ADR 0004), and neither a company admin nor a member has a choice of their own. A persisted super admin always has it when signing in with a password, whatever their group, since the account reaches every group; signing in through SAML leaves it to the identity provider, as for every member of a SAML group. The bootstrap account has no document to keep a secret in and stays outside; a SAML group leaves it to its identity provider, and the option does not apply to it.

When a group switches it on, each member sets it up at their next sign-in; the sessions already open stay. When the group switches it off, or moves to SAML, the members' setups are kept asleep: nothing is asked, and nothing is to set up again if it comes back.

A member picks one verification method when setting up: an authenticator app (TOTP) or a code by email. They change it only through a two-factor reset. Either way they get ten recovery codes, each standing in for a verification code once; signing in with one offers a new set straight away. The TOTP secret is encrypted with the key that already encrypts the ESP secrets (`utils/crypto.js`), not hashed: the server recomputes the expected code from the secret itself, so it must read it back. Recovery codes and emailed codes are only compared, so they are hashed.

The session opens only once the code is checked. A right password no longer calls `req.logIn`: it leaves a pending step in the session, bound to the account and to its password, expiring after ten minutes, and the step of the code opens the session. A password changed meanwhile ends the step. Nothing that reads `req.isAuthenticated()` (the guards, the OAuth dialog, the session validation) ever sees an account half signed in. Every way in goes through the same step, the emailed password link included, which opens no session by itself for a member whose group requires two-factor authentication. Five wrong codes end the pending step; the step of the code has its own rate limits, per account and per address, and an emailed code is valid ten minutes. A code is used once even when two requests race: the account is updated only if the code is still unused.

The code by email is the weaker method, and knowingly so: whoever holds the mailbox can reset the password from the emailed link and then receive the code. It still stops a password that leaked or was reused elsewhere, the threat this feature answers, and it spares members an app. The authenticator app is the method to choose where the mailbox itself is at risk.

A member may mark the browser as a trusted device after a verification. It is a cookie of its own, apart from the session's, `httpOnly`, holding a random token stored hashed with its account, its expiry (thirty days, not configurable) and the browser and OS it was given to. A trusted device skips the code, never the password. The sign-in is suspicious, and asks the code all the same, when the browser or the OS no longer matches the one remembered, or after five wrong passwords on the account since its last sign-in. A two-factor reset, a password change and a deactivation forget every trusted device of the account.

There is no second verification before a sensitive action: once signed in, the session (fourteen days, rolling) is the proof.

A two-factor reset is a tech admin's or a super admin's (`group.manage-tech`), as the option, and follows the rule of ADR 0004: nobody resets an account whose capabilities are not all their own. A tech admin resets every member of their group, a super admin resets anyone, a company admin resets no one. It ends the member's sessions, forgets their trusted devices, and emails them that their two-factor authentication was reset, without saying by whom.

An emailed code goes to the account's address, so changing the address of a member who set up two-factor authentication is a tech admin's or a super admin's too; a company admin keeps changing the address of a member who has not. For a member whose method is the code by email, the change resets the setup, as above, and the email goes to the previous address. An authenticator app does not depend on the address and is kept.

Each security event (a reset, the group option switched, a setup and its method, a recovery code used, a device trusted, five wrong codes in a row) is written to a collection of its own, `SecurityEvents`, with who did it, to whom and when, and removed after a year by a TTL index. No screen reads it yet.

## Considered Options

- **A member's own choice when the group does not require it**: left out for now. It needs an account page the application does not have, for a benefit nobody asked for yet.
- **Asking the code again before sensitive actions after 15 minutes or an hour**: rejected for now. The actions concerned are rare and done by admins, and the session cookie is `httpOnly`.
- **Both methods active at once**: rejected. The recovery codes already cover a member without their usual method, and one method is simpler to explain and to reset.
- **The location of the sign-in (IP address, country) among the suspicious signs**: rejected. It needs a GeoIP database, and VPNs make it cry wolf.
- **The security events in the `Log` collection**: rejected. Its query, status and response are required, for the ESP SOAP calls it was made for; a collection of its own keeps both schemas strict.
- **A company admin switching the option, resetting a member's two-factor authentication, or changing the address of a member who set it up**: the first decision, reversed before release. The option sets how every member signs in, and the reset and the address are the ways past a member's second factor, which makes them technical settings of the company, kept with the others under `group.manage-tech`.
- **Signing out every member when the group switches the option on**: rejected. It would interrupt a whole team at once, for sessions that end within fourteen days anyway.

## Consequences

- The login page gains a step after the password: the code, or the setup of a member who has none.
- Each new route declares its rights, which the route walk test (`route-access.test.js`) checks: the step of the code and the setup are open on purpose, since they come before the session.
- The group update accepts the new option from a tech admin, next to the tracking, and drops it from a company admin as the other fields it cannot set. On the general settings page, a company admin reads whether the option is on, without the switch.
- A company without a tech admin relies on a super admin to switch the option and to reset a member, which is accepted. The emails that tell a member about their two-factor authentication send them to the company's technical administrator.
