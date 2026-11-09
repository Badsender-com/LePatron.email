/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The email preview app as a host runs it (ADR 0012, MCP Apps): its script,
// in a DOM, talking to the host by messages. JSDOM loads no `srcdoc`, and
// applies neither `sandbox` nor CSP: the frame's document is built here, at
// the address a browser gives it.

const { JSDOM } = require('jsdom');
const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');

const PREVIEW_APP = 'ui://lepatron/mailing-preview';

describe('the preview app, as a host runs it', () => {
  let client;

  beforeEach(async () => {
    harness.seed(f.SEED);
    client = await harness.connectAs(f.FRANK);
  });
  afterEach(() => harness.disconnect());

  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

  function loadSrcdoc(window) {
    Object.defineProperty(window.HTMLIFrameElement.prototype, 'srcdoc', {
      configurable: true,
      get() {
        return this.getAttribute('srcdoc') || '';
      },
      set(html) {
        this.setAttribute('srcdoc', html);
        const email = new JSDOM(html, { url: 'about:srcdoc' });
        Object.defineProperty(this, 'contentDocument', {
          configurable: true,
          get: () => email.window.document,
        });
        setTimeout(() => this.dispatchEvent(new window.Event('load')));
      },
    });
  }

  // The app served, run with what the host hands it: its messages are
  // kept in `sent`, and `fromHost` answers them.
  async function runApp({ openai } = {}) {
    const { contents } = await client.readResource({ uri: PREVIEW_APP });
    const sent = [];
    const { window } = new JSDOM(contents[0].text, {
      runScripts: 'dangerously',
      beforeParse(appWindow) {
        // The app's parent is the host; JSDOM's top window is its own.
        appWindow.postMessage = (message) => sent.push(message);
        if (openai) appWindow.openai = openai;
        loadSrcdoc(appWindow);
      },
    });
    const fromHost = (message) =>
      window.dispatchEvent(
        new window.MessageEvent('message', {
          data: { jsonrpc: '2.0', ...message },
          source: window,
        })
      );
    const frame = window.document.getElementById('email');
    return { window, sent, fromHost, frame };
  }

  const toolResult = (args) =>
    client.callTool({
      name: 'get_mailing',
      arguments: { mailingId: f.M_NEWSLETTER, ...args },
    });

  const showing = async (preview, options) => {
    const app = await runApp(options);
    app.fromHost({
      method: 'ui/notifications/tool-result',
      params: { _meta: { 'lepatron/previewHtml': preview } },
    });
    await settled();
    return app;
  };

  it('asks the host to initialize, then says it is', async () => {
    const { sent, fromHost } = await runApp();

    expect(sent).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: expect.objectContaining({
          appInfo: expect.objectContaining({
            name: 'lepatron-mailing-preview',
          }),
        }),
      },
    ]);

    fromHost({ id: 1, result: {} });
    await settled();

    expect(sent[1]).toEqual({
      jsonrpc: '2.0',
      method: 'ui/notifications/initialized',
      params: {},
    });
  });

  it('shows the email of the tool result, in its frame', async () => {
    const { window, fromHost, frame } = await runApp();

    fromHost({
      method: 'ui/notifications/tool-result',
      params: await toolResult(),
    });
    await settled();

    expect(frame.hidden).toBe(false);
    expect(window.document.getElementById('status').hidden).toBe(true);
    expect(frame.contentDocument.body.textContent).toContain(
      'Black Friday is coming'
    );
  });

  it('shows the email of an answer asked as HTML', async () => {
    const { fromHost, frame } = await runApp();

    fromHost({
      method: 'ui/notifications/tool-result',
      params: await toolResult({ format: 'html' }),
    });
    await settled();

    expect(frame.contentDocument.body.textContent).toContain(
      'Black Friday is coming'
    );
  });

  it('says so when the result has no preview', async () => {
    const { window, fromHost, frame } = await runApp();

    fromHost({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { text: 'A mailing never saved' } },
    });
    await settled();

    expect(frame.hidden).toBe(true);
    expect(window.document.getElementById('status').textContent).toMatch(
      /No preview/
    );
  });

  it('shows the email ChatGPT hands it through its own bridge', async () => {
    const result = await toolResult();
    const openai = {
      toolResponseMetadata: result._meta,
      toolOutput: result.structuredContent,
      openExternal: jest.fn(),
    };
    const { sent, frame } = await runApp({ openai });
    await settled();

    expect(frame.contentDocument.body.textContent).toContain(
      'Black Friday is coming'
    );

    frame.contentDocument
      .querySelector('a[href="https://shop.example.test/black-friday"]')
      .click();

    expect(openai.openExternal).toHaveBeenCalledWith({
      href: 'https://shop.example.test/black-friday',
    });
    expect(sent.map((message) => message.method)).not.toContain('ui/open-link');
  });

  it('tells the host its size once the email is shown', async () => {
    const { sent, frame } = await showing('<p>An email</p>');

    expect(frame.style.height).toMatch(/^\d+px$/);
    expect(sent).toContainEqual({
      jsonrpc: '2.0',
      method: 'ui/notifications/size-changed',
      params: { height: expect.any(Number) },
    });
  });

  // A link clicked before the app catches it would navigate the frame.
  it('lets the email be clicked once its links are caught', async () => {
    const { fromHost, frame } = await runApp();

    fromHost({
      method: 'ui/notifications/tool-result',
      params: { _meta: { 'lepatron/previewHtml': '<p>An email</p>' } },
    });

    expect(frame.style.pointerEvents).toBe('none');
    await settled();
    expect(frame.style.pointerEvents).toBe('auto');
  });

  const LINKS = `
    <p><a id="html" href="https://shop.example.test/html">HTML</a></p>
    <img usemap="#map" alt="A map" />
    <map name="map">
      <area id="area" href="https://shop.example.test/area" shape="rect" coords="0,0,10,10" alt="Area" />
    </map>
    <svg>
      <a href="https://shop.example.test/svg"><text id="svg">SVG</text></a>
      <a xlink:href="https://shop.example.test/xlink"><text id="xlink">XLink</text></a>
    </svg>
    <math>
      <mrow href="https://shop.example.test/mathml"><mtext id="mathml">MathML</mtext></mrow>
      <mrow href="javascript:void(0)"><mtext id="mathml-script">Script</mtext></mrow>
    </math>
    <p><a id="mail" href="mailto:someone@example.test">Mail</a></p>
    <p><a id="script" href="javascript:void(0)">Script</a></p>`;

  // A click on what the link holds, as a reader makes it.
  const click = (frame, id) => {
    const email = frame.contentDocument;
    return email.getElementById(id).dispatchEvent(
      new email.defaultView.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );
  };

  it.each([
    ['an HTML link', 'html', 'https://shop.example.test/html'],
    ['an image map area', 'area', 'https://shop.example.test/area'],
    ['an SVG link', 'svg', 'https://shop.example.test/svg'],
    ['an SVG link by xlink:href', 'xlink', 'https://shop.example.test/xlink'],
    [
      'a MathML element with an address',
      'mathml',
      'https://shop.example.test/mathml',
    ],
  ])(
    'opens %s through the host, never in the frame',
    async (_kind, id, url) => {
      const { sent, frame } = await showing(LINKS);

      const navigated = click(frame, id);

      expect(navigated).toBe(false);
      expect(sent).toContainEqual({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'ui/open-link',
        params: { url },
      });
    }
  );

  it.each([
    ['a mail address', 'mail'],
    ['a script', 'script'],
    ['a script, from a MathML element', 'mathml-script'],
  ])('opens no link to %s, nor follows it', async (_kind, id) => {
    const { sent, frame } = await showing(LINKS);

    const navigated = click(frame, id);

    expect(navigated).toBe(false);
    expect(sent.map((message) => message.method)).not.toContain('ui/open-link');
  });
});
