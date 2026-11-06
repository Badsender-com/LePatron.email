# The MCP module is what Badsender sells; MCP access stays the company's choice

- Status: proposed
- Date: 2026-11-04
- Epic: #1394
- Amends: ADR 0012 (MCP access as the subscription)

MCP is billed as a flat-rate module. ADR 0012 made MCP access both the thing sold and the thing a company turns on, so a company's tech admin could switch on what nobody had bought. The two are now apart: the **MCP module**, opened or closed by a super admin in the company's Modules, like Email Builder and CRM Intelligence; and **MCP access**, the tech admin's switch in the AI features, unchanged. A company's users connect an assistant only when the module is open **and** the access is on.

**One rule, read where access is already read.** The module is checked where MCP access is: at every `/mcp` call, and when the consent screen picks the companies it offers. The company update still accepts the tech admin's access switch while the module is closed: writing it opens nothing, so the server needs no second rule for a case the interface does not produce. Refusing that write was rejected for that reason.

**No bypass for super admins.** The Email Builder guard lets a super admin through a closed module; MCP does not. A token leaves the app and a connection lasts 90 days: a super admin's assistant reading a company that pays for no module would be an access nobody sees. A super admin who needs to test opens the module.

**Opening does not turn access on.** Badsender sells, the company decides: opening the module leaves MCP access as it was, off for a new company. Turning both on at once was rejected: it would take the decision away from the tech admin, whose switch is the one the users' connections answer to.

**Closing revokes, and keeps the company's choice.** Closing the module revokes the company's connected applications, as turning MCP access off does (ADR 0012): a module no longer paid for must leave no live token, and reopening it must not revive forgotten connections. MCP access itself is left as the company set it, so a reopened module behaves as the company had chosen; its users connect their assistants again. Closing is confirmed first, with the number of connections it ends, since unlike the other modules it stops something running. Resetting MCP access on closing was rejected: the company would have to redo a choice it made, for a decision that was not its own.

**Closed, the AI features still show it.** The MCP access section stays in the AI features page, its switch disabled and its settings folded, saying the module is not part of the company's subscription; a super admin also gets a link to the company's Modules. Hiding the section, as a closed module's page leaves the sidebar, was rejected: the tech admin would not know the feature exists, nor whom to ask. The consent screen tells a user whose company lacks the module to ask Badsender, not the tech admin, who cannot do anything about it.

**Closed by default, no migration.** Nothing of MCP is in production yet. The platform company's module is opened by hand in each environment, a line of the release checklist.
