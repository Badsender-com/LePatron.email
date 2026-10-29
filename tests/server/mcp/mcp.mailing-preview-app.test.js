'use strict';

// The email itself in the conversation (ADR 0012, MCP Apps): `get_mailing`
// points the clients that render apps at a UI resource, which shows the
// mailing's sanitised preview in a sandbox. The other clients keep the text.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const PREVIEW_APP = 'ui://lepatron/mailing-preview';
const APP_MIME_TYPE = 'text/html;profile=mcp-app';

// Turned on by #1342 (the email preview in the conversation)
describe.skip('email preview app', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const getMailingTool = async () =>
    (await client.listTools()).tools.find(
      (tool) => tool.name === 'get_mailing'
    );

  it('points get_mailing at the preview app, for MCP Apps and for ChatGPT', async () => {
    const tool = await getMailingTool();

    expect(tool._meta).toMatchObject({
      ui: { resourceUri: PREVIEW_APP },
      'openai/outputTemplate': PREVIEW_APP,
    });
  });

  it('serves the preview app as an MCP App', async () => {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });

    expect(contents[0]).toMatchObject({
      uri: PREVIEW_APP,
      mimeType: APP_MIME_TYPE,
    });
  });

  it('declares no outside origin the app could connect to', async () => {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });

    expect(contents[0]._meta?.ui?.csp?.connectDomains ?? []).toEqual([]);
  });

  it('hands the app the preview of the mailing, as the text answer stays', async () => {
    const result = await client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_NEWSLETTER },
    });

    expect(result.structuredContent.text).toContain('Black Friday is coming');
    expect(result._meta?.ui?.previewHtml).toContain(
      '<a href="https://shop.example.test/black-friday"'
    );
  });

  it('hands the app nothing for a mailing the user cannot read', async () => {
    const result = await client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_PROMO },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.ui?.previewHtml).toBeUndefined();
  });
});
