# Connect VS Code and GitHub Copilot to LePatron

[← Connect an assistant](./connect-an-assistant.md)

GitHub Copilot, in VS Code, uses LePatron in **agent mode**. VS Code registers itself with LePatron: there is no client ID or secret to enter.

## Setup

1. Open the command palette and run **MCP: Add Server**.
2. Choose **HTTP (HTTP or Server-Sent Events)**, then enter:
   - the MCP server URL, for instance `https://app.lepatron.email/mcp`;
   - the name `lepatron`.
3. Choose where to save the server: for you alone, or for all your projects.
4. When the server starts, VS Code asks to sign in, then opens the LePatron consent screen in the browser. Allow it.
5. In the Chat view, switch to **agent mode**: LePatron's tools show in the list of tools.

## If it does not work

- VS Code's MCP servers management shows the state of `lepatron` and its error log.
- A company proxy may block the return to VS Code after the consent: try from another network.
- In a GitHub organization, a policy may turn off Copilot's use of MCP servers.

## Reference

- [Add MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) (Microsoft)
