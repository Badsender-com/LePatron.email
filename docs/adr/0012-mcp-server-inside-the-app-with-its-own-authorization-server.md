# MCP server: inside the app, with its own authorization server; it reads, and writes only feedback and the platform's own drafts

- Status: proposed
- Date: 2026-10-15
- Epic: #1290
- Supersedes the approach of issue #955 (standalone server, API key per company)
- Amended by ADR 0014 (drafts of the platform company's skills and expertises written from an assistant)
- Amended by ADR 0017 (the MCP module, sold apart from MCP access)
- Amended by ADR 0022 (the instance relays the external images of a mailing's preview)

LePatron exposes an MCP server so that the AI assistants its users already work with (Claude, ChatGPT, Microsoft Copilot) can read LePatron on their behalf: the expertises and skills the platform company writes, and the user's own mailings. A company's users connect an assistant once the company's MCP access is on. MCP access is the company's switch: off unless its tech admin, as part of its AI features, or a super admin turns it on (`group.manage-tech`, ADR 0004). Turning it on or off is recorded as a security event, as switching two-factor authentication is (ADR 0008). It is not what is sold: selling MCP, to the platform company and to client companies alike, goes through the MCP module of ADR 0017, which a super admin opens and without which MCP access opens nothing. The first version only read. ADR 0014 adds the first writes, drafts of the platform company's own skills and expertises; writing mailings still waits for the server to enforce what a writer may touch (#1103, ADR 0004).

**It runs inside the Express app**, mounted on `/mcp`, not as a standalone service sharing the database. Every tool goes through the same services and access checks as the REST API (workspace and folder membership, `userHasAccessToAllWorkspaces`, the roles of ADR 0004), so no access rule is written twice.

## The authorization server

### Server

**LePatron is its own OAuth 2.1 authorization server**, embedded in the app.
The login it shows is the existing one (local password or the company's SAML), followed by a consent screen.
The consent screen asks for a session like any page of the app, so the two-factor step comes first: a member of a company that requires two-factor authentication, and a super admin signing in with a password, reach it only once their code is checked (ADR 0008).
A password alone never consents.
An external identity provider would have had to send users back to LePatron anyway, and would add a third party processing personal data.
It is built on `oidc-provider`, which serves the three ways of registering a client natively.
Its maintained major requires a current LTS, so the app moved from Node 18 to Node 24 (#1337) before the authorization server; Node 24 also lets the CommonJS app `require()` that ESM-only package.
Writing our own token storage and rotation on Node 18 was rejected: more security code of our own, to keep a runtime that is already out of support.
Only the scopes this server knows are accepted (`mcp:read`, `skills:write`), so a client asking for others (`openid`, `offline_access`) is refused.
No other site may frame the authorization server's pages, the consent page included.
`/oauth` reads bodies of 64 KB at most, before the app's own parsers.
It serves neither userinfo nor sign-out, which only an OpenID client would use, and `openid` is refused.
An authorization that cannot go on (an unknown client, a redirect URI it did not register) shows a page of its own, which names the error and nothing of the server.
The SAML login carries the way back to the consent page in its RelayState, the only thing the identity provider's cross-site answer brings back.

### Clients and redirect URIs

Because Claude, ChatGPT and Microsoft do not register clients the same way, the server accepts three kinds of client:

- Client ID Metadata Documents;
- open Dynamic Client Registration, of public clients and of confidential ones, which get a secret (Microsoft 365 Copilot does not take public clients);
- clients registered by hand (Copilot Studio in manual mode).

A client registered by hand belongs to a company: its tech admin, or a super admin, registers it in the company's settings, because the assistant behind it is set up by that company's IT for its own users.
Only that company is offered at its consent, and `/mcp` refuses its tokens for any other.
It has one record, in the company's settings: the authorization server reads it there, by its id, which starts with `lepatron-`, and keeps no copy of its own.
Its routes, `/api/groups/:groupId/mcp-clients`, declare `group.manage-tech`, and the company is checked by `canAccessGroup`: a super admin reaches every company, a tech admin their own.
A platform-wide client, registered by a super admin alone, was rejected: it would let any company's users connect through another company's assistant, and would make every company wait on the platform company.

A metadata document is read on public hosts only: the host's name is resolved first, and no request goes to an address that is not on the public internet.
The document holds 5 KB at most, and names itself by the URL it is read at.

A redirect URI is accepted over `https`, on any host.
It is accepted over plain `http` on the loopback address only (`localhost`, `127.0.0.1`, `[::1]`), on any port, for an application on the user's own machine; such a client is treated as a native one (RFC 8252 §7.3).
Any other redirect URI is refused: a scheme of the application's own (`cursor://…`, `com.example.app:/…`), and plain `http` to any other host.
A redirect URI is also written as a URL writes it, so every reader of it reads the same host: no backslash, no user or password, no fragment, and the very text its URL gives back (lower case, slashes included).
This is the rule of the MCP specification, whose redirect URIs must be either localhost or use HTTPS (Communication Security).
At an open registration or in a metadata document, a refused redirect URI is left out of the client (RFC 7591 §3.2.1): the client is registered with the others, and the answer to the registration lists them.
A registration left with no redirect URI is refused with `invalid_redirect_uri`.
For a client registered by hand, any refused redirect URI blocks the creation, and the error names it.

**Open registration has its safeguards.**
Anyone may register a client, so a registration vouches for nothing.
Registering is rate limited.
The consent screen says that an application registered itself and that LePatron cannot vouch for its name, and it shows the host the user will be sent back to.
A client that connects nobody is forgotten after a day; each consent keeps it as long as the connection it opens.

### Connections and revocation

Access tokens last an hour, refresh tokens rotate and last 30 days each, and a connection lasts 90 days at most, after which the user connects the assistant again.
Consent is asked at every connection.
A connection does not depend on the browser it was consented in: neither its code nor its tokens are bound to the authorization server's session of that browser, so another consent there, or that session's end after a day, leaves it whole.
Each consent is recorded as a connected application, one connection per consent.
Connecting again does not replace an earlier connection of the same user to the same application: an assistant known by its metadata document (Claude Code, VS Code) has the same `client_id` on every machine, and a second machine would otherwise disconnect the first.
A user keeps at most 10 connections to one application in one company; the 11th revokes the oldest.
The cap counts by `client_id`: an assistant that registers itself again (DCR) gets a new one, so two of its machines are the same client only when it is known by its metadata document.
`/mcp` checks that record at every call: a revoked connection is refused at its next call, before its access token expires, and its refresh tokens are revoked with it.

The user revokes a connected application from its own page, reached from the sidebar (the app has no profile page).
The company's tech admin, or a super admin, revokes all of a company's connections at once from its MCP access settings, where the retex is allowed and the clients registered by hand are reached: everything MCP is one section of the AI features page, the tech admin's.
Its route, `/api/groups/:groupId/connected-applications`, has the scope of the clients' routes: `group.manage-tech`, and the company checked by `canAccessGroup`.
A company admin who is not its tech admin does neither.
The app's own events revoke the same way: MCP access turned off, a company deleted, a client registered by hand deleted.
A change of the credentials ends the account's connected assistants with its sessions, at one point (`endAccess`): the account deactivated, its password reset by an admin or set from the emailed link, its two-factor authentication reset by a tech admin or a super admin, and a change of its address that resets a two-factor authentication by email (ADR 0008).
Revoking a connection unlists it first, which `/mcp` refuses at once, then deletes its grant and every token the grant issued, from the store alone: a script revokes as a user does.

Turning MCP access on or off (`mcp-access.enabled`, `mcp-access.disabled`), allowing or stopping the retex (`retex.allowed`, `retex.disallowed`), registering or deleting a client by hand (`mcp-client.created`, `mcp-client.deleted`), and revoking all of a company's connections (`connected-applications.all-revoked`) are recorded as security events (ADR 0008).
The events of a client registered by hand name it, by its id and its name, never by its secret.

### Keys

Nothing is signed today.
The tokens are opaque and checked against the database, and `openid` is refused, so no ID token is ever issued.
The keys of the deployment (`lepatron_mcpOauthJwks`) are still required: the server does not start without them outside development, because `oidc-provider` would otherwise take its own development keys, which are published.
Above all, they become essential the day something is signed (access tokens as JWTs, ID tokens, signed responses): the keys must then persist and be the same on every instance.
Changing them today disconnects no assistant.
Do not remove this variable.
Cutting every connection goes through MCP access, turned off company by company, or through `node scripts/mcp-revoke-all.js --yes` for the whole platform, which keeps the clients registered.

### Storage

Access tokens, refresh tokens and authorization codes are stored as their SHA-256 digest, never as the token itself.
A client's secret is stored as its SHA-256 digest too, and the server compares the secret a client presents with it.
The ids of grants, sessions and pending consents are stored as they are: a client never presents them as a credential, and a session or a consent is reached through a cookie the server signs.
Each record keeps its payload as JSON: MongoDB before 5.0 refuses a key with a dot, and a grant names its resource by its URL.
There is no migration: nothing ran in production before, and a token stored otherwise simply stops working.

## The MCP server

**A token is bound to one user and one company.** A super admin, who has rights on every company, picks the company on the consent screen, like the selected company of ADR 0002; working on another company means connecting again. This keeps two companies' data from meeting in one assistant conversation. On every call the server checks the user's current role, their membership of the company and the company's MCP access, so a change takes effect without waiting for the token to expire. `/mcp` refuses before any MCP exchange, in HTTP with the OAuth error body (RFC 6750): a missing or invalid access token gets a 401 with a `WWW-Authenticate` challenge, whose `invalid_token` code comes only when a bearer token was sent (§3.1); an identity that no longer holds gets a 403 `access_denied` without a challenge, never `insufficient_scope`, which would send the client back to a consent that changes nothing. What fails is told to the assistant only when it can act on it: a refusal, an item not found, or a request a service refuses with a message meant to be shown, which the server logs as a warning; anything else is logged as an error and answered with a message that says nothing of the server. A token's scopes only record what the user consented to (`mcp:read`, and `skills:write`, offered unticked, and only to who may manage the platform, ADR 0014); what the user may do is asked of the permissions module on every call, from the capabilities of ADR 0004, like any route of the app. Reading through MCP needs no capability, as reading in the app does not: membership of the company and access to the workspace decide. The write tools will ask for the capabilities that already exist (`mailing.create`, `mailing.edit-content`), so a role is defined once for the app and for MCP.

**What is exposed.** Active versions of expertises (as resources, with their version and update date) and skills (as prompts); a draft only in the drafts mode of a super admin trying it (ADR 0014). Mailings the user can reach, listed through the search across accessible workspaces (ADR 0007, #1144) rather than a listing of its own, and read as extracted text by default and sanitised HTML on request. A mailing's status is derived from its facts and never stored (see `GLOSSARY.md`): LePatron does not know that an email was sent, so no status says so. The `search` and `fetch` tools follow the shape ChatGPT expects. Every tool declares an output schema and answers structured content; every tool that only reads is annotated read-only, so clients do not ask for a confirmation on each read, and the others (`submit_feedback`, the drafting tools and `use_drafts` of ADR 0014) are not: the proposals of ADR 0014 say they are destructive, since they rewrite the open draft, and the others that they destroy nothing; a list links each mailing as a resource. A mailing's preview is also offered as an MCP App, so the clients that render apps (Claude, ChatGPT, Microsoft 365 Copilot, VS Code) show the email itself in the conversation, sandboxed, while the others keep the text (#1342).

**Reading one mailing (#1304).** A mailing is read by the search's own rule (ADR 0007, `locateReadableMailing`, the rule of `findReadableMailings`): what `list_mailings` would never find, `get_mailing` never reads. This is stricter than the app's preview, which any user of the company may open, member of the workspace or not, because a preview URL is shared to pick a mailing to copy; an assistant answers what a user asked, so it reads what that user lists. The text is extracted from the sanitised preview the app serves; its preheader is the template's own field when it declares one (`preheaderText`), and otherwise the first hidden text before any visible word, hidden the way a preheader is. A preview over 1 MB is not read for an assistant, and the answer says so: sanitising and parsing are synchronous, about a second per megabyte, and real previews weigh 50 to 120 KB.

**Search and fetch (#1305).** `search` answers ChatGPT's `{ id, title, url }`: a mailing links to its editor, so a citation opens it; an expertise links to its `lepatron://` resource, since a reader has no page for it in the app, and its citation is not clickable. A public page per expertise would sell what the subscription sells. Words match whatever their case and accents, in what describes a mailing, never its content.

**The email in the conversation (#1342).** `get_mailing` points the clients that render MCP Apps at a UI resource, and hands it the sanitised preview in its result's `_meta`, under `email.lepatron/previewHtml`, prefixed with the reversed domain as the specification recommends: the assistant does not read it, and a client that renders no app ignores it. It travels with every result read as text, since a server cannot tell which client renders apps, and never twice: read as HTML, the app takes it from the answer. The app frames the email without `allow-scripts`, and opens its links through the host. Its CSP allows no connection, and images from the site's origin only, where the editor uploads them. The app declares it to the host (`_meta.ui.csp`, `openai/widgetCSP`), and holds it itself in a `<meta>` of its page, which the email's `srcdoc` frame inherits, so it holds whatever the host makes of the one declared. An image hosted elsewhere shows through an address of the instance, which relays it, a tracking pixel included (ADR 0022).

**It is built on the v2 MCP SDK**, served without state behind one route. The v2 SDK follows the 2026-07-28 protocol and still answers the clients that speak the 2025 versions, which most do today; the v1 SDK will not follow the 2026 protocol and only gets fixes for a few months more. The v2 SDK needs Node 20, which the move to Node 24 (#1337) brought.

**Feedback and retex.** MCP has no feedback primitive and the server never sees the conversation, so feedback is a tool. Its retex part, a session summary written by the assistant, is kept only if the company allows retex and the user agrees to it for that feedback. The retex is a switch of the company, off when it is created, which its tech admin or a super admin turns on or off (#1302), with the MCP access, and no other role; each change is recorded as a security event, as MCP access is. A feedback's rating and comment reach the platform company whatever the retex, which the switch says: without the retex granted, by the company and by the user, the comment holds 500 characters at most, a word on LePatron rather than room for a session summary, and 4,000 with it. A comment longer than 500 characters is allowed only with the retex, so stopping it forgets what it let the company's feedbacks keep: one forgetting erases their summaries and cuts their comments to 500 characters (as JavaScript counts them, never in the middle of a character), and it can be run again; the feedbacks stay, with their rating. The forgetting runs whenever a request says the retex is off, so one that failed can be run again, while the security event records only a change. A feedback written while the retex is being stopped checks the switch again once written, and forgets what it kept if the switch is off. A feedback names what it is about only among what the user may read: a mailing by the rule of the search across accessible workspaces (ADR 0007).

**Call log and limits.** Calls are logged as metadata only (who, which client, which tool, the ids the tool declares, bounded, how long, how it ended, a refusal of the caller told apart from a failure), never what was typed nor the content returned, and written without the call waiting for it. Feedbacks and call logs are kept for each client company's log retention (7 to 365 days), as its skill invocations are, and a change of the retention reaches what is already kept: the platform company loses a company's feedbacks, and their retex, at the end of that company's retention, on purpose (#1302). Calls are limited to 60 a minute per connection, 120 per user across the applications they connect, since anyone may register one, and 300 per company, counted for the company only once its caller is checked, so a token that no longer opens anything costs it nothing. They are counted in each process's memory: the limit guards against an assistant running away, it is no quota, and the app's workers each count their own. The guard and the log wrap every handler through the SDK's `_wrapHandler`, a private hook, so the SDK is pinned to an exact version and the call log suites fail if the hook goes.

## Considered Options

- **API key per company** (issue #955): rejected, it cannot tell users apart, so it cannot respect workspace rights or roles, and ChatGPT and claude.ai connectors require OAuth.
- **A token covering every company of a super admin**, with a company argument on each tool: rejected, an assistant would mix two companies' data in one conversation.
- **A table of MCP scopes per role**: rejected, it would define each role's rights a second time beside the capabilities of ADR 0004.
- **The v1 MCP SDK, which runs on Node 18**: rejected, it stays on the 2025 protocol and its fixes end a few months after the v2 release; starting on it means a migration before the first write tool.
- **A stored mailing status with a workflow**: rejected for this feature, it is a product feature of its own; the derived status can be replaced by it later.

## Consequences

- `oidc-provider` serves Client ID Metadata Documents as an experimental feature: its version is pinned to a minor.
- A metadata document whose redirect URIs all point to the user's own machine, and which declares no application type, is read as a native client's (RFC 8252 §7.3), so any port of the loopback address is accepted: Claude Code declares `http://localhost/callback` and listens on a port of its choosing. Codes only ever reach the user's machine, and PKCE is required of every client.
- Clients that cannot share the embedded authorization server's registration modes are not supported until one of the three fits them.
- Exposing the expertises in full to the client companies with MCP access is accepted: their value is in being kept up to date.
- Left for later, for want of clients that support them, and kept possible by the stateless v2 server: the Skills extension of MCP (skills stay prompts), asking the retex consent through elicitation (it stays a tool argument), Tasks for long operations (the write tools will also answer a job to poll), and enterprise-managed authorization.
