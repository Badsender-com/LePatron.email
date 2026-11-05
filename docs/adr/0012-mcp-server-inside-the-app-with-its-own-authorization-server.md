# MCP server: inside the app, with its own authorization server, read-only first

- Status: proposed
- Date: 2026-10-15
- Epic: #1290
- Supersedes the approach of issue #955 (standalone server, API key per company)

LePatron exposes an MCP server so that the AI assistants its users already work with (Claude, ChatGPT, Microsoft Copilot) can read LePatron on their behalf: the expertises and skills the platform company writes, and the user's own mailings. It is sold as a subscription, to the platform company and to client companies alike, and switched on per company by MCP access: off unless a super admin, or the company's tech admin as part of its AI features, turns it on for a company (`group.manage-tech`, ADR 0004). The first version only reads; writing waits for the server to enforce what a writer may touch (#1103, ADR 0004).

**It runs inside the Express app**, mounted on `/mcp`, not as a standalone service sharing the database. Every tool goes through the same services and access checks as the REST API (workspace and folder membership, `userHasAccessToAllWorkspaces`, the roles of ADR 0004), so no access rule is written twice.

**LePatron is its own OAuth 2.1 authorization server**, embedded in the app. The login it shows is the existing one (local password or the company's SAML), followed by a consent screen. An external identity provider would have had to send users back to LePatron anyway, and would add a third party processing personal data. Because Claude, ChatGPT and Microsoft do not register clients the same way, the server accepts three: Client ID Metadata Documents, open Dynamic Client Registration issuing a client secret (Microsoft 365 Copilot does not take public clients), and clients pre-registered by a super admin (Copilot Studio in manual mode). It is built on `oidc-provider`, which serves the three natively; its maintained major requires a current LTS, so the app moves from Node 18 to Node 24 (#1337) before the authorization server lands; Node 24 also lets the CommonJS app `require()` that ESM-only package. Writing our own token storage and rotation on Node 18 was rejected: more security code of our own, to keep a runtime that is already out of support. Access tokens are short-lived, refresh tokens rotate; the user revokes a connected application from their profile, a company admin revokes all of a company's.

**A token is bound to one user and one company.** A super admin, who has rights on every company, picks the company on the consent screen, like the selected company of ADR 0002; working on another company means connecting again. This keeps two companies' data from meeting in one assistant conversation. On every call the server checks the user's current role, their membership of the company and the company's MCP access, so a change takes effect without waiting for the token to expire. A token's scopes only record what the user consented to (`mcp:read` in this version); what the user may do is asked of the permissions module on every call, from the capabilities of ADR 0004, like any route of the app. Reading through MCP needs no capability, as reading in the app does not: membership of the company and access to the workspace decide. The write tools will ask for the capabilities that already exist (`mailing.create`, `mailing.edit-content`), so a role is defined once for the app and for MCP.

**What is exposed.** Active versions of expertises (as resources, with their version and update date) and skills (as prompts); never drafts. Mailings the user can reach, listed through the search across accessible workspaces (ADR 0007, #1144) rather than a listing of its own, and read as extracted text by default and sanitised HTML on request. A mailing's status is derived from its facts and never stored (see `GLOSSARY.md`): LePatron does not know that an email was sent, so no status says so. The `search` and `fetch` tools follow the shape ChatGPT expects. Every tool declares an output schema and answers structured content; every tool but `submit_feedback` is annotated read-only, so clients do not ask for a confirmation on each read; a list links each mailing as a resource. A mailing's preview is also offered as an MCP App, so the clients that render apps (Claude, ChatGPT, Microsoft 365 Copilot, VS Code) show the email itself in the conversation, sandboxed, while the others keep the text (#1342).

**It is built on the v2 MCP SDK**, served without state behind one route. The v2 SDK follows the 2026-07-28 protocol and still answers the clients that speak the 2025 versions, which most do today; the v1 SDK will not follow the 2026 protocol and only gets fixes for a few months more. The v2 SDK needs Node 20, which the move to Node 24 (#1337) brings.

**Feedback and retex.** MCP has no feedback primitive and the server never sees the conversation, so feedback is a tool. Its retex part, a session summary written by the assistant, is kept only if the company allows retex and the user agrees to it for that feedback. Calls are logged as metadata only (who, which client, which tool, which objects, how long), never the content returned, and kept for the company's log retention.

## Considered Options

- **API key per company** (issue #955): rejected, it cannot tell users apart, so it cannot respect workspace rights or roles, and ChatGPT and claude.ai connectors require OAuth.
- **A token covering every company of a super admin**, with a company argument on each tool: rejected, an assistant would mix two companies' data in one conversation.
- **A table of MCP scopes per role**: rejected, it would define each role's rights a second time beside the capabilities of ADR 0004.
- **The v1 MCP SDK, which runs on Node 18**: rejected, it stays on the 2025 protocol and its fixes end a few months after the v2 release; starting on it means a migration before the first write tool.
- **A stored mailing status with a workflow**: rejected for this feature, it is a product feature of its own; the derived status can be replaced by it later.

## Consequences

- The MCP server and its authorization server are blocked by the move to Node 24 (#1337).
- `oidc-provider` serves Client ID Metadata Documents as an experimental feature: its version is pinned to a minor.
- Clients that cannot share the embedded authorization server's registration modes are not supported until one of the three fits them.
- Exposing the expertises in full to the client companies with MCP access is accepted: their value is in being kept up to date.
- Left for later, for want of clients that support them, and kept possible by the stateless v2 server: the Skills extension of MCP (skills stay prompts), asking the retex consent through elicitation (it stays a tool argument), Tasks for long operations (the write tools will also answer a job to poll), and enterprise-managed authorization.
