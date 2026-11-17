'use strict';

// The Emarsys API v3 (ADR 0028). Both hosts are fixed: an admin gives
// credentials, never an address.
const TOKEN_URL = 'https://auth.emarsys.net/oauth2/token';
const API_URL = 'https://api.emarsys.net/api/v3';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Where the Emarsys provider sends its calls. On a developer's machine,
 * `emarsysFakeUrl` points them at the fake Emarsys of scripts/fake-emarsys.js;
 * the server refuses to start with it outside development
 * (config/dev-defaults.js), and it must be the machine itself.
 *
 * @param {Object} config the application's (node.config.js)
 * @returns {{ tokenUrl: string, apiUrl: string, isDevFake: boolean }}
 * @throws {Error} when `emarsysFakeUrl` is not an http address of the machine
 */
function emarsysEndpoints(config) {
  const fake = config && config.emarsysFakeUrl;
  if (!fake) return { tokenUrl: TOKEN_URL, apiUrl: API_URL, isDevFake: false };

  let parsed;
  try {
    parsed = new URL(fake);
  } catch (error) {
    parsed = null;
  }
  if (
    !parsed ||
    parsed.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.includes(parsed.hostname)
  ) {
    throw new Error(
      'emarsysFakeUrl must be an http address of this machine (localhost)'
    );
  }
  const base = `${parsed.origin}`;
  return {
    tokenUrl: `${base}/oauth2/token`,
    apiUrl: `${base}/api/v3`,
    isDevFake: true,
  };
}

module.exports = { emarsysEndpoints };
