'use strict';

// Where LePatron's authorization server may send a code (ADR 0012, and the MCP
// specification: "MUST be either localhost or use HTTPS"): the one rule the
// server applies to every client it reads, and the form of a client
// registered by hand reads before sending it.
//
// Same constraints as access/roles.js: no syntax that needs a Babel helper.

// The user's own machine, as a redirect URI names it: the authorization
// server's own list, so a client it reads as native takes any port on them
// (RFC 8252, 7.3).
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function parsed(uri) {
  if (typeof uri !== 'string') return null;
  try {
    return new URL(uri);
  } catch (error) {
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
  return (
    url !== null &&
    url.protocol === 'http:' &&
    LOOPBACK_HOSTS.indexOf(url.hostname) !== -1
  );
}

function isHttpsLoopback(uri) {
  const url = parsed(uri);
  return (
    url !== null &&
    url.protocol === 'https:' &&
    LOOPBACK_HOSTS.indexOf(url.hostname) !== -1
  );
}

/**
 * Whether a redirect URI is one the authorization server sends a code to:
 * HTTPS on any host, or plain HTTP to the user's own machine, on any port. An
 * application's own scheme, or plain HTTP to any other host, is refused.
 *
 * A URI is also written as a URL writes it, so that every reader of it reads
 * the same host: no backslash, no user nor password, no fragment, and the
 * very text its URL gives back (`href`), in lower case and with its slashes.
 *
 * @param {string} uri
 * @returns {boolean}
 */
function isRedirectUri(uri) {
  const url = parsed(uri);
  if (url === null || url.href !== uri || uri.indexOf('\\') !== -1) {
    return false;
  }
  if (url.username || url.password || url.hash || uri.indexOf('#') !== -1) {
    return false;
  }
  return url.protocol === 'https:' || isLoopbackRedirect(uri);
}

/**
 * The redirect URIs of a client the rule keeps, out of those it gives, and
 * whether it is a native application: one that comes back to the user's own
 * machine, whose HTTPS URIs never name it (RFC 8252, 7.2).
 *
 * @param {string[]} uris
 * @returns {{ accepted: string[], native: boolean }}
 */
function acceptedRedirectUris(uris) {
  const accepted = uris.filter(isRedirectUri);
  const native = accepted.some(isLoopbackRedirect);
  return {
    accepted: native
      ? accepted.filter(function notHttpsLoopback(uri) {
          return !isHttpsLoopback(uri);
        })
      : accepted,
    native: native,
  };
}

module.exports = {
  LOOPBACK_HOSTS: LOOPBACK_HOSTS,
  isLoopbackRedirect: isLoopbackRedirect,
  isRedirectUri: isRedirectUri,
  acceptedRedirectUris: acceptedRedirectUris,
};
