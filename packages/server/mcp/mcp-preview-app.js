'use strict';

const fs = require('fs');
const path = require('path');
const { siteOrigin } = require('../email-templates/email-template.js');
const { withIdentity } = require('./mcp-identity.js');

// The email itself in the conversation (ADR 0012, #1342): get_mailing points
// the clients that render MCP Apps at this UI resource, and hands it the
// sanitised preview in its result's `_meta`, which the assistant does not
// read. The others keep the text answer.

const PREVIEW_APP_URI = 'ui://lepatron/mailing-preview';
const APP_MIME_TYPE = 'text/html;profile=mcp-app';
// Where get_mailing's result carries the preview: a key of LePatron's, out of
// the `ui` namespace the MCP Apps spec keeps for itself.
const PREVIEW_META_KEY = 'email.lepatron/previewHtml';

const APP_HTML = fs.readFileSync(
  path.join(__dirname, 'mailing-preview-app.html'),
  'utf8'
);

// What get_mailing declares: the MCP Apps key, and its ChatGPT alias.
const PREVIEW_TOOL_META = {
  ui: { resourceUri: PREVIEW_APP_URI },
  'openai/outputTemplate': PREVIEW_APP_URI,
};

/**
 * The preview app, served as an MCP App. The host frames it under the CSP it
 * declares: no connection anywhere, and images from LePatron only, where the
 * editor uploads them; an image hosted elsewhere shows as its alternative text.
 * It reads no data, but is read like every primitive, by who may call
 * (`withIdentity`).
 *
 * @param {import('@modelcontextprotocol/server').McpServer} server
 */
function registerPreviewApp(server) {
  server.registerResource(
    'mailing-preview',
    PREVIEW_APP_URI,
    {
      title: 'Mailing preview',
      description: 'Shows a mailing read by get_mailing as the email itself.',
      mimeType: APP_MIME_TYPE,
    },
    withIdentity(async (_identity, uri) => {
      const origin = siteOrigin();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: APP_MIME_TYPE,
            text: APP_HTML,
            _meta: {
              ui: {
                csp: { connectDomains: [], resourceDomains: [origin] },
                prefersBorder: true,
              },
              'openai/widgetCSP': {
                connect_domains: [],
                resource_domains: [origin],
              },
              'openai/widgetPrefersBorder': true,
            },
          },
        ],
      };
    })
  );
}

/**
 * A get_mailing result, with the preview the app shows. Not when the answer
 * holds the HTML already: the app reads it there, and it would travel twice.
 *
 * @param {Object} result the tool's result
 * @param {{ answer: Object, html: string|null }} read what was read
 * @returns {Object} the result
 */
function withPreview(result, { answer, html }) {
  if (!html || answer.html) return result;
  return { ...result, _meta: { [PREVIEW_META_KEY]: html } };
}

module.exports = {
  registerPreviewApp,
  withPreview,
  PREVIEW_TOOL_META,
  PREVIEW_META_KEY,
  PREVIEW_APP_URI,
  APP_HTML,
};
