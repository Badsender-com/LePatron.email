# Connect ChatGPT to LePatron

[← Connect an assistant](./connect-an-assistant.md)

In ChatGPT Business, Enterprise and Edu, an MCP server such as LePatron is added as a **custom app** of the workspace. ChatGPT registers itself with LePatron: there is no client ID or secret to enter.

OpenAI often renames these menus ("Connectors", "Apps", "Plugins"). When in doubt, follow OpenAI's help page listed below.

## 1. Create the app (ChatGPT workspace admin)

Only the workspace's admins and owners can create and publish a custom app.

1. In the workspace settings, open the creation of a custom MCP app. Depending on the version, **developer mode** must be turned on first.
2. Fill in:
   - name: `LePatron`;
   - MCP server URL: for instance `https://app.lepatron.email/mcp`;
   - authentication: **OAuth**.
3. Save: ChatGPT opens the LePatron consent screen. Allow it with your own account, which tests the connection.
4. Check the list of actions offered, then **publish** the app to the workspace.

## 2. Connect (each user)

Once the app is published, each user turns it on in their ChatGPT apps, then allows it on the LePatron screen. The connection is personal: everyone reads LePatron with their own rights.

## Good to know

- **List of actions:** when LePatron adds tools later, the admin has to refresh the app's list of actions. On some plans, the app has to be created again.
- **Unverified app:** a custom app is not verified by OpenAI. The workspace admin vouches for it to its users.

## Reference

- [Creating custom MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt) (OpenAI)
- [Admin controls for apps](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-in-apps-connectors-enterprise-edu-and-business) (OpenAI)
