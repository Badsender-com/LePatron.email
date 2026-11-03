# Connect Microsoft Copilot to LePatron

[← Connect an assistant](./connect-an-assistant.md)

Two Microsoft products connect to LePatron. In both cases, the company's IT sets them up, in its own Microsoft tenant.

| Product                                   | Setup                                               | Client ID and secret                  |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| Copilot Studio, dynamic discovery         | in the agent, by its maker                          | none, Copilot Studio registers itself |
| Copilot Studio, manual                    | in the agent, by its maker                          | created in LePatron by the tech admin |
| Microsoft 365 Copilot (declarative agent) | Microsoft 365 Agents Toolkit, then the admin center | none, the agent registers itself      |

## Copilot Studio

1. In the agent, open **Tools › Add a tool › New tool**, then **Model Context Protocol**.
2. Fill in:
   - **Server name**: `LePatron`;
   - **Server description**: for instance "Badsender expertises and skills to write and review emails". The agent uses it to decide when to call LePatron;
   - **Server URL**: for instance `https://app.lepatron.email/mcp`.
3. Authentication: **OAuth 2.0**, then one of the two types below.

### Dynamic discovery (recommended)

Choose **Dynamic discovery**, then **Create**: Copilot Studio finds LePatron and registers itself. Go on to "Create the connection".

### Manual

Only when the company's policy requires a client declared in advance.

Copilot Studio only gives its **callback URL** once the tool is created, while LePatron asks for it when the client is created. It takes three steps:

1. In Copilot Studio, choose **Manual** and fill in the fields with the values below, with a temporary `to-replace` in **Client ID** and **Client secret**. **Create**, then copy the **callback URL** shown.
2. In LePatron, the tech admin creates the client with this callback URL as its redirect URL (see below), and copies its ID and secret.
3. Replace the temporary values with the real **Client ID** and **Client secret**. The tool's OAuth settings are edited in the custom connector it created: Power Apps portal, **Custom connectors**.

| Copilot Studio field | Value                                             |
| -------------------- | ------------------------------------------------- |
| Client ID            | the client's ID, starting with `lepatron-`        |
| Client secret        | the secret, shown once when the client is created |
| Authorization URL    | `https://app.lepatron.email/oauth/auth`           |
| Token URL template   | `https://app.lepatron.email/oauth/token`          |
| Refresh URL          | `https://app.lepatron.email/oauth/token`          |
| Scopes               | `mcp:read`                                        |

### Create the connection

In **Add tool**, choose **Create a new connection**: the LePatron consent screen opens. Allow it with your own account, then **Add to agent**.

### Create a client for the manual type (tech admin)

1. In LePatron, open **Settings › AI features**, then the **Manage MCP clients** link of the MCP access section, then **Add a client**.
2. Fill in:
   - the name, shown on the consent screen;
   - the redirect URL: the callback URL Copilot Studio gave;
   - how the secret is sent: keep "In the request body" unless told otherwise.
3. **Copy the secret right away**: it will never be shown again. If it is lost, delete the client and create another one.

The client belongs to your company: only its users can connect with it. Deleting it cuts every connection made through it at once.

## Microsoft 365 Copilot

LePatron is added to Microsoft 365 Copilot through a **declarative agent** with an MCP plugin.

1. In **Microsoft 365 Agents Toolkit** (version 6.12 or later), create a declarative agent, then add an action from an **MCP server**:

   - URL: for instance `https://app.lepatron.email/mcp`;
   - authentication: **OAuth (with dynamic registration)**.

   LePatron gives the agent the secret Microsoft requires.

2. Test the agent, then package it as an app.
3. **The tenant admin** deploys the package to the users concerned, from the Microsoft 365 admin center (integrated apps).
4. On first use, each user allows it on the LePatron screen.

## Reference

- [Connect your agent to an existing MCP server](https://learn.microsoft.com/microsoft-copilot-studio/mcp-add-existing-server-to-agent) (Microsoft Learn)
- [Build a declarative agent plugin from an MCP server](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/build-mcp-plugins) (Microsoft Learn)
- [Dynamic client registration authentication](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication-dynamic-client-registration) (Microsoft Learn)
