'use strict';

const dns = require('dns');
const net = require('net');
// ESM only: Node 24 lets the app require it (ADR 0012).
const { errors } = require('oidc-provider');
const { isBlockedAddress } = require('../utils/outbound-host.js');

// The rule of the redirect URIs, which the form of a client registered by
// hand reads too.
const {
  LOOPBACK_HOSTS,
  isLoopbackRedirect,
  isRedirectUri,
  acceptedRedirectUris,
} = require('../../shared/mcp/redirect-uris.js');

function parsed(uri) {
  try {
    return typeof uri === 'string' ? new URL(uri) : null;
  } catch {
    return null;
  }
}

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
  const { accepted, native } = acceptedRedirectUris(value);
  if (native) metadata.application_type = 'native';
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

/**
 * Whether an address is one of the public internet: the ranges the outgoing
 * calls refuse (`utils/outbound-host.js`) are not, nor is anything else than
 * an IP address. An IPv4 address mapped in IPv6 is checked as itself.
 *
 * @param {string} address an IP address
 * @returns {boolean} whether it is one of the public internet
 */
function isPublicAddress(address) {
  return net.isIP(address) !== 0 && !isBlockedAddress(address);
}

// A URL's host, an IPv6 address without its brackets.
const bareHost = (url) => url.hostname.replace(/^\[(.*)\]$/, '$1');

/**
 * Whether the authorization server reads the metadata document a `client_id`
 * names (`features.clientIdMetadataDocument.allowFetch`): only on a public
 * host. An address that is not public, or the loopback's name, is refused
 * before any request; a name is checked once resolved (`publicOnly`).
 *
 * @param {Object} ctx
 * @param {string} clientId the document's URL
 * @returns {Promise<boolean>}
 */
async function allowFetch(ctx, clientId) {
  const url = parsed(clientId);
  if (!url) return false;
  const host = bareHost(url).toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  return !net.isIP(host) || isPublicAddress(host);
}

// One answer for every document that cannot be used, whatever the reason.
const UNUSABLE = 'client document unavailable';

/**
 * `fetch`, to public addresses only: the host's name is resolved first, and
 * every address it resolves to must be public. The request then goes with the
 * options the provider gave, its dispatcher included, which checks the
 * address actually connected to: a name that resolves elsewhere by then is
 * refused there.
 *
 * @param {Function} fetch
 * @param {Function} [lookup] as `dns.promises.lookup`
 * @returns {Function}
 */
function publicOnly(fetch, lookup = dns.promises.lookup) {
  return async (url, options) => {
    const host = bareHost(new URL(url));
    const addresses = net.isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      !addresses.every(({ address }) => isPublicAddress(address))
    ) {
      throw new Error(UNUSABLE);
    }
    return fetch(url, options);
  };
}

// The provider's own limit for a client document.
const DOCUMENT_LIMIT = 5 * 1024;

async function bytesUpTo(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// The provider asks for a client's metadata document, and only for it,
// without following redirections (oidc-provider 9.13).
const isDocumentRequest = (options = {}) =>
  (options.method || 'GET') === 'GET' && options.redirect === 'manual';

/**
 * `fetch`, whose client documents come back only when they can be used: a
 * JSON document of at most 5 KB that names itself by the URL it is read at.
 * Any other answer fails as an unreachable host does, so the authorization
 * server tells nobody which of the two it met. The document keeps its
 * headers, and the time it may be cached with them.
 *
 * @param {Function} fetch
 * @returns {Function}
 */
function checkedDocuments(fetch) {
  return async (url, options) => {
    const response = await fetch(url, options);
    if (!isDocumentRequest(options)) return response;
    const body =
      response.status === 200
        ? await bytesUpTo(response, DOCUMENT_LIMIT)
        : null;
    let document;
    try {
      document = body && JSON.parse(body.toString('utf8'));
    } catch {
      document = null;
    }
    if (document?.client_id !== String(url)) throw new Error(UNUSABLE);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * Every fetch of the authorization server: to public addresses only, and a
 * client document checked before the provider reads it.
 *
 * @param {Object} [options]
 * @param {Function} [options.fetch] the request itself; the global `fetch`
 *   when not given
 * @param {Function} [options.lookup] the resolution of a host's name
 * @returns {Function}
 */
function providerFetch({ fetch, lookup } = {}) {
  const send = fetch || ((url, options) => globalThis.fetch(url, options));
  return checkedDocuments(publicOnly(send, lookup));
}

module.exports = {
  acceptedRedirectUris,
  LOOPBACK_HOSTS,
  isLoopbackRedirect,
  isRedirectUri,
  keepAcceptedRedirects,
  EXTRA_CLIENT_METADATA,
  isPublicAddress,
  allowFetch,
  publicOnly,
  checkedDocuments,
  providerFetch,
  DOCUMENT_LIMIT,
};
