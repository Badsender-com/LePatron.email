# Connect an AI assistant to LePatron

Your AI assistant (Claude, ChatGPT, Copilot…) can read LePatron on your behalf:

- Badsender's expertises and skills, to use them when you ask it to write or review an email;
- your mailings: it lists them (by workspace, folder, author, tags or dates, with their status) and reads their text, or the HTML of their preview. Personalization variables, such as `{{firstname}}`, stay as they are. Claude, ChatGPT, Microsoft 365 Copilot and VS Code also show the email itself in the conversation, without running any script; images hosted outside LePatron show as their alternative text.

It does so with **your rights**, in **one company only**, the one you choose when connecting. It changes nothing in your emails, skills or settings: the only things it sends LePatron are your feedback, when you ask it to, and your retex, which you approve one by one ([Retex](./retex.md)).

The one exception is for the platform company's team: a super admin connected to the platform company may let their assistant write, publish and open skills and expertises ([Publish from an assistant](./publish-from-an-assistant.md)).

The connection uses MCP (Model Context Protocol), which all these assistants support.

## Before you start

- **Your company must have the MCP module.** It is part of the subscription, and a super admin opens it. Without it, the MCP access section says "Not included".
- **MCP access must be on for your company.** The company's tech admin, or a super admin, turns it on in **Settings › AI Features › MCP access**, with the switch of the section. When it is off, the connection is refused.
- **Log in with your own LePatron account**, the one you use every day.
- **The MCP server address** is your LePatron address followed by `/mcp`, for instance `https://app.lepatron.email/mcp`. Your tech admin copies it in **Settings › AI features › MCP access**, under "Address to give your users". The other values an assistant may ask for are on the MCP clients page (row "Clients registered by hand", **Manage** link), under "Server settings".

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

Assistants installed on your computer, such as Cursor or Claude Code, connect through a `localhost` address: LePatron sends its answer back to your own machine. An assistant that asks to come back through an address of its own (`cursor://…`) is refused.

## See and revoke your connected applications

The plug icon at the bottom of the sidebar opens **Connected applications**. For each connection it shows the assistant, the company, when it was connected and when it was last used. The same assistant connected on two computers shows twice.

**Revoke** cuts its access at once: the assistant is refused at its next request. To use it again, connect it again.

The company's tech admin, or a super admin, can also revoke them all at once, in **Settings › AI features**, MCP access section, **Revoke all**, for instance if an access leaked.

A connection lasts 90 days at most: past that, the assistant asks you to connect it again. Changing your password also disconnects all your assistants, and so does an admin resetting your two-factor authentication. Each connection is kept separately: past 10 connections of the same assistant in the same company, the oldest is revoked.

## If the connection fails

| Message                                                                    | Cause                                                                                                                                                                                                                 | What to do                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| The MCP module is not part of your company's subscription                  | the company has no MCP module                                                                                                                                                                                         | contact the platform company                    |
| Your company has no MCP access                                             | MCP access is off                                                                                                                                                                                                     | ask the tech admin to turn it on                |
| This application is reserved for the users of the company that declared it | the MCP client belongs to another company                                                                                                                                                                             | use your own company's connector                |
| This connection request has expired, or was started in another browser     | more than 10 minutes went by, or the window opened in another browser                                                                                                                                                 | start the connection again from the assistant   |
| The assistant says it lost access                                          | the application was revoked, MCP access was turned off or the MCP module closed, your password changed, your two-factor authentication was reset, your account was deactivated, or the connection is over 90 days old | connect the assistant again once access is back |
