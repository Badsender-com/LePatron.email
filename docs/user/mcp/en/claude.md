# Connect Claude to LePatron

[← Connect an assistant](./connect-an-assistant.md)

LePatron is added to Claude as a **custom connector**. Claude registers itself with LePatron: there is no client ID or secret to enter.

## claude.ai and Claude Desktop

A connector added on claude.ai is also available in Claude Desktop, with the same Claude account.

### Team and Enterprise plans

1. **The owner of the Claude organization** adds the connector, once for everyone:
   1. **Organization settings › Connectors › Add**, then **Custom › Web**;
   2. name: `LePatron`; URL: the MCP server address, for instance `https://app.lepatron.email/mcp`; **Continue**;
   3. keep the detected authentication settings;
   4. **OAuth client**: **Use Claude's published identity (Recommended)**;
   5. **Add**.
2. **Each user** then opens **Customize › Connectors**, finds **LePatron** (labelled "Custom"), clicks **Connect** and allows it on the LePatron screen.

### Individual plans (Pro, Max)

**Customize › Connectors › + Add › Add custom connector**: enter the name and URL, keep the suggested settings (**Use Claude's published identity**), then **Add** and **Connect**.

### Use

In a conversation, turn LePatron on with the **+** button, then **Connectors**. Claude can then:

- read Badsender's expertises and find the ones that apply to your request;
- use Badsender's skills, which also show among the suggested commands;
- send feedback to Badsender when you ask it to;
- report a retex on a skill or an expertise, with your approval ([Retex](./retex.md)).

## Claude Code

In a terminal:

```bash
claude mcp add --transport http lepatron https://app.lepatron.email/mcp
```

Then, in a Claude Code session, type `/mcp`, choose **lepatron** and **Authenticate**: the browser opens the LePatron consent screen.

Add `--scope user` to have LePatron in all your projects.

## Reference

- [Using connectors in claude.ai](https://support.claude.com/en/articles/11175166-using-connectors-in-claude-ai) (Anthropic)
