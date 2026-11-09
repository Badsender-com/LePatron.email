'use strict';

// ESM only: Node 24 lets the app require it (ADR 0012).
const { errors } = require('oidc-provider');

// The user's own machine, as a redirect URI names it: the provider's own
// list, so a client it reads as native takes any port on them (RFC 8252, 7.3).
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parsed(uri) {
  try {
    return typeof uri === 'string' ? new URL(uri) : null;
  } catch {
    return null;
  }
}

/**
 * Whether `uri` sends the code to the user's own machine, in plain HTTP.
 *
 * @param {string} uri
 * @returns {boolean}
 */
function isLoopbackRedirect(uri) {
  const url = parsed(uri);
  return url?.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Where the authorization server may send a code (ADR 0012, and the MCP
 * specification: "MUST be either localhost or use HTTPS"): HTTPS on any host,
 * or plain HTTP to the user's own machine, on any port. An application's own
 * scheme, or plain HTTP to any other host, is refused.
 *
 * @param {string} uri
 * @returns {boolean}
 */
function isRedirectUri(uri) {
  const url = parsed(uri);
  if (!url || url.hash || uri.includes('#')) return false;
  return url.protocol === 'https:' || isLoopbackRedirect(uri);
}

const isHttpsLoopback = (uri) => {
  const url = parsed(uri);
  return url?.protocol === 'https:' && LOOPBACK_HOSTS.has(url.hostname);
};

/**
 * The redirect URIs of a client as the authorization server keeps them, for
 * every client it reads: one that registers (DCR), one known by its metadata
 * document (CIMD), one a company registered by hand. A URI that is refused is
 * left out (RFC 7591, 3.2.1), and the client gets the rest; none left, and the
 * client is refused. A client that comes back to the user's own machine is a
 * native application, whatever it says, so it takes any port there: Cursor
 * and Claude Code name none, and listen on the port they pick. A native
 * application's HTTPS URIs never name the loopback (RFC 8252, 7.2), so such a
 * URI is left out too.
 *
 * `oidc-provider` calls it before checking the metadata itself, and checks
 * what it leaves (`extraClientMetadata.validator`, synchronous).
 *
 * @param {Object} ctx the request, for a registration; none otherwise
 * @param {string} key the property it is called for
 * @param {*} value
 * @param {Object} metadata the client's metadata, changed in place
 */
function keepAcceptedRedirects(ctx, key, value, metadata) {
  if (key !== 'redirect_uris' || !Array.isArray(value) || !value.length) {
    // None at all is the provider's to refuse.
    return;
  }
  let accepted = value.filter(isRedirectUri);
  if (accepted.some(isLoopbackRedirect)) {
    metadata.application_type = 'native';
    accepted = accepted.filter((uri) => !isHttpsLoopback(uri));
  }
  if (accepted.length === 0) {
    // `redirect_uris…`: answered as `invalid_redirect_uri`.
    throw new errors.InvalidClientMetadata(
      'redirect_uris must use https, or http on a loopback address'
    );
  }
  metadata.redirect_uris = accepted;
}

// What `oidc-provider` checks every client's metadata with.
const EXTRA_CLIENT_METADATA = {
  properties: ['redirect_uris'],
  validator: keepAcceptedRedirects,
};

module.exports = {
  LOOPBACK_HOSTS,
  isLoopbackRedirect,
  isRedirectUri,
  keepAcceptedRedirects,
  EXTRA_CLIENT_METADATA,
};
