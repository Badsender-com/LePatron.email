# MCP server: inside the app, with its own authorization server, read-only first

- Status: proposed
- Date: 2026-10-15
- Epic: #1290
- Supersedes the approach of issue #955 (standalone server, API key per group)

LePatron exposes an MCP server so that the AI assistants its users already work with (Claude, ChatGPT, Microsoft Copilot) can read LePatron on their behalf: the Badsender expertises and skills, and the user's own mailings. It is sold as a subscription (MCP access, off unless a super admin turns it on for a group) to the platform group and to client groups alike. The first version only reads; writing waits for the server to enforce what a writer may touch (#1103, ADR 0004).

**It runs inside the Express app**, mounted on `/mcp`, not as a standalone service sharing the database. Every tool goes through the same services and access checks as the REST API (workspace and folder membership, `userHasAccessToAllWorkspaces`, the roles of ADR 0004), so no access rule is written twice.

**LePatron is its own OAuth 2.1 authorization server**, embedded in the app. The login it shows is the existing one (local password or the group's SAML), followed by a consent screen. An external identity provider would have had to send users back to LePatron anyway, and would add a third party processing personal data. Because Claude, ChatGPT and Microsoft do not register clients the same way, the server accepts three: Client ID Metadata Documents, open Dynamic Client Registration issuing a client secret (Microsoft 365 Copilot does not take public clients), and clients pre-registered by a super admin (Copilot Studio in manual mode). It is built on `oidc-provider`, which serves the three natively; its maintained major requires Node 22, so the app moves from Node 18 to Node 22 before the authorization server lands. Writing our own token storage and rotation on Node 18 was rejected: more security code of our own, to keep a runtime that is already out of support. Access tokens are short-lived, refresh tokens rotate; the user revokes a connected application from their profile, a company admin revokes all of a group's.

**A token is bound to one user and one group.** A super admin, who has rights on every group, picks the group on the consent screen, like the selected group of ADR 0002; working on another group means connecting again. This keeps two clients' data from meeting in one assistant conversation. On every call the server checks the user's current role, their membership of the group and the group's MCP access, so a change takes effect without waiting for the token to expire. Each token carries scopes derived from the role through one table in the code; in this version every role gets the same read scope, and the table is where write scopes will be granted per role.

**What is exposed.** Active versions of expertises (as resources, with their version and update date) and skills (as prompts); never drafts. Mailings the user can reach, as extracted text by default and sanitised HTML on request. A mailing's status is derived from its facts and never stored (see `GLOSSARY.md`): LePatron does not know that an email was sent, so no status says so. The `search` and `fetch` tools follow the shape ChatGPT expects.

**Feedback and retex.** MCP has no feedback primitive and the server never sees the conversation, so feedback is a tool. Its retex part, a session summary written by the assistant, is kept only if the group allows retex and the user agrees to it for that feedback. Calls are logged as metadata only (who, which client, which tool, which objects, how long), never the content returned, and kept for the group's log retention.

## Considered Options

- **API key per group** (issue #955): rejected, it cannot tell users apart, so it cannot respect workspace rights or roles, and ChatGPT and claude.ai connectors require OAuth.
- **A token covering every group of a super admin**, with a `group` argument on each tool: rejected, an assistant would mix two clients' data in one conversation.
- **A stored mailing status with a workflow**: rejected for this feature, it is a product feature of its own; the derived status can be replaced by it later.

## Consequences

- The authorization server is blocked by the move to Node 22; the MCP tools are not, and are built on the v1 MCP SDK meanwhile. Moving to the v2 SDK, which follows the stateless 2026-07-28 protocol, is decided once clients speak it.
- `oidc-provider` serves Client ID Metadata Documents as an experimental feature: its version is pinned to a minor.
- Clients that cannot share the embedded authorization server's registration modes are not supported until one of the three fits them.
- Exposing the expertises in full to subscribers is accepted: their value is in being kept up to date.
