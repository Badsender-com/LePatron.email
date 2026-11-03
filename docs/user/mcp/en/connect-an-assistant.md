# Connect an AI assistant to LePatron

Your AI assistant (Claude, ChatGPT, Copilot…) can read LePatron on your behalf: Badsender's expertises and skills, to use them when you ask it to write or review an email. It does so with **your rights**, in **one company only**, the one you choose when connecting. It cannot change anything in LePatron.

The connection uses MCP (Model Context Protocol), which all these assistants support.

## Before you start

- **MCP access must be on for your company.** The company's tech admin (or Badsender) turns it on in **Settings › AI Features › MCP access**, with the "Allow AI assistants to connect" switch. When it is off, the connection is refused.
- **Log in with your own LePatron account**, the one you use every day.
- **The MCP server address** is your LePatron address followed by `/mcp`, for instance `https://app.lepatron.email/mcp`. Your tech admin finds it, with every other value an assistant may ask for, in **Settings › MCP clients › Server settings**.

## Pick your assistant

| Assistant                                       | Who sets it up                               | Page                        |
| ----------------------------------------------- | -------------------------------------------- | --------------------------- |
| Claude (claude.ai, Claude Desktop, Claude Code) | you, or the owner of the Claude organization | [Claude](./claude.md)       |
| ChatGPT Business, Enterprise, Edu               | an admin of the ChatGPT workspace            | [ChatGPT](./chatgpt.md)     |
| Microsoft Copilot Studio, Microsoft 365 Copilot | your company's IT                            | [Microsoft](./microsoft.md) |
| VS Code with GitHub Copilot                     | you                                          | [VS Code](./vscode.md)      |

## What happens when you connect

1. The assistant opens a LePatron window. Log in if needed (password, company SSO, two-factor authentication).
2. The **"Connect … to LePatron"** screen shows:
   - which application asks for access;
   - which site you will be sent back to;
   - what it will be able to do;
   - the company the connection will be bound to.
3. Check the application's name. If the screen says the application "registered itself", only go on if you just started the connection from your assistant.
4. Click **Allow**. You are sent back to your assistant, now connected.

The consent screen shows at every new connection: that is where the company is chosen.

## See and revoke your connected applications

The plug icon at the bottom of the sidebar opens **Connected applications**. For each assistant it shows the company, when it was connected and when it was last used.

**Revoke** cuts its access at once: the assistant is refused at its next request. To use it again, connect it again.

The company's admin can also revoke them all at once, in **Settings › General › Connected applications**, for instance if an access leaked.

## If the connection fails

| Message                                                                    | Cause                                                                                   | What to do                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Your company has no MCP access                                             | MCP access is off                                                                       | ask the tech admin to turn it on                |
| This account cannot connect an assistant                                   | you are logged in with the platform's administration account                            | log in with your user account                   |
| This application is reserved for the users of the company that declared it | the MCP client belongs to another company                                               | use your own company's connector                |
| This connection request has expired, or was started in another browser     | more than 10 minutes went by, or the window opened in another browser                   | start the connection again from the assistant   |
| The assistant says it lost access                                          | the application was revoked, MCP access was turned off, or your account was deactivated | connect the assistant again once access is back |
