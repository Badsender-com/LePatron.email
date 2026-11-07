'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { siteOrigin } = require('../utils/site-origin.js');
const { withIdentity } = require('./mcp-identity.js');
const { relayPreviewImages } = require('./mcp-relayed-images.js');

// The email itself in the conversation (ADR 0012, #1342): get_mailing points
// the clients that render MCP Apps at this UI resource, and hands it the
// sanitised preview in its result's `_meta`, which the assistant does not
// read. The others keep the text answer.

const PREVIEW_APP_URI = 'ui://lepatron/mailing-preview';
const APP_MIME_TYPE = 'text/html;profile=mcp-app';
// Where get_mailing's result carries the preview: a key of LePatron's, out of
// the `ui` namespace the MCP Apps spec keeps for itself.
const PREVIEW_META_KEY = 'email.lepatron/previewHtml';

const APP_PAGE = fs.readFileSync(
  path.join(__dirname, 'mailing-preview-app.html'),
  'utf8'
);
// The app's one script, which its CSP allows by its hash, as no other.
const [, APP_SCRIPT] = /<script>([\s\S]*?)<\/script>/.exec(APP_PAGE);
const SCRIPT_HASH = `'sha256-${crypto
  .createHash('sha256')
  .update(APP_SCRIPT, 'utf8')
  .digest('base64')}'`;
const APP_HTML = APP_PAGE.split('{{scriptHash}}').join(SCRIPT_HASH);
// Where the app's own CSP names the site's origin, known only once running.
const ORIGIN_SLOT = '{{siteOrigin}}';

// The app, its CSP naming the site's origin, as text of an attribute.
const appHtml = (origin) => APP_HTML.split(ORIGIN_SLOT).join(_.escape(origin));

// What get_mailing declares: the MCP Apps key, and its ChatGPT alias.
const PREVIEW_TOOL_META = {
  ui: { resourceUri: PREVIEW_APP_URI },
  'openai/outputTemplate': PREVIEW_APP_URI,
};

/**
 * The preview app, served as an MCP App. The host frames it under the CSP it
 * declares: no connection anywhere, and images from LePatron only, where the
 * editor uploads them; an image hosted elsewhere shows as its alternative text.
 * The app holds the same CSP itself, which the email's frame inherits, should
 * the host apply the one declared poorly. It reads no data, but is read like
 * every primitive, by who may call (`withIdentity`).
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
            text: appHtml(origin),
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
 * holds the HTML already and no image is relayed: the app reads it there, and
 * it would travel twice.
 *
 * @param {Object} result the tool's result
 * @param {{ answer: Object, html: string|null }} read what was read
 * @returns {Object} the result
 */
function withPreview(result, { answer, html }) {
  if (!html) return result;
  // The images hosted elsewhere, relayed by the instance (ADR 0022): the app
  // loads images from the instance only.
  const preview = relayPreviewImages(html);
  // Asked as HTML, the answer keeps the original addresses for the assistant;
  // the relayed preview travels beside it only when an image was relayed.
  if (answer.html && preview === html) return result;
  return { ...result, _meta: { [PREVIEW_META_KEY]: preview } };
}

module.exports = { registerPreviewApp, withPreview, PREVIEW_TOOL_META };
