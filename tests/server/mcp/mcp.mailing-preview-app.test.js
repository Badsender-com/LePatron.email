/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The email itself in the conversation (ADR 0012, MCP Apps): `get_mailing`
// points the clients that render apps at a UI resource, which shows the
// mailing's sanitised preview in a sandbox. The other clients keep the text.

const { JSDOM } = require('jsdom');
const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const PREVIEW_APP = 'ui://lepatron/mailing-preview';
const APP_MIME_TYPE = 'text/html;profile=mcp-app';

describe('email preview app', () => {
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

  it('loads images from LePatron only', async () => {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });

    expect(contents[0]._meta.ui.csp.resourceDomains).toEqual([
      expect.stringMatching(/^https?:\/\/[^/]+$/),
    ]);
  });

  // The policy of the app's own page, as a browser reads it.
  const ownPolicyOf = (html) =>
    new JSDOM(html).window.document.querySelectorAll(
      'head meta[http-equiv="Content-Security-Policy"]'
    );

  // Whatever the host makes of the CSP declared, the app and the email's
  // frame, which inherits it, load nothing but images from LePatron.
  it('holds the CSP it declares, images from LePatron only', async () => {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });
    const [origin] = contents[0]._meta.ui.csp.resourceDomains;

    const policies = ownPolicyOf(contents[0].text);

    expect(policies).toHaveLength(1);
    expect(policies[0].getAttribute('content')).toBe(
      `default-src 'none'; img-src ${origin} data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'`
    );
  });

  it('writes the origin into its CSP as text', async () => {
    const config = require('../../../packages/server/node.config.js');
    const { host } = config;
    config.host = 'lepatron.test" data-host="lepatron.test';
    try {
      const { contents } = await client.readResource({ uri: PREVIEW_APP });

      const [policy] = ownPolicyOf(contents[0].text);

      expect(policy.hasAttribute('data-host')).toBe(false);
      expect(policy.getAttribute('content')).toContain(
        'lepatron.test" data-host="lepatron.test data:;'
      );
    } finally {
      config.host = host;
    }
  });

  // Whatever the sanitiser missed, nothing in the email runs.
  it('frames the email where no script runs', async () => {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });
    const frame = /<iframe[^>]*id="email"[^>]*>/.exec(contents[0].text)[0];

    expect(frame).toMatch(/sandbox="[^"]*"/);
    expect(frame).not.toMatch(/allow-scripts/);
  });

  it('hands the app the preview of the mailing, as the text answer stays', async () => {
    const result = await client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_NEWSLETTER },
    });

    expect(result.structuredContent.text).toContain('Black Friday is coming');
    expect(result._meta?.['lepatron/previewHtml']).toContain(
      'href="https://shop.example.test/black-friday"'
    );
  });

  it('hands the app nothing more when the answer holds the HTML', async () => {
    const result = await client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_NEWSLETTER, format: 'html' },
    });

    expect(result.structuredContent.html).toContain('Black Friday is coming');
    expect(result._meta?.['lepatron/previewHtml']).toBeUndefined();
  });

  it('hands the app nothing for a mailing the user cannot read', async () => {
    const result = await client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_PROMO },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['lepatron/previewHtml']).toBeUndefined();
  });
});
