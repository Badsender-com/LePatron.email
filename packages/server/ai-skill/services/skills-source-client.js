'use strict';

/**
 * How a copy reads production (ADR 0019): production's address and the read
 * token production gave it, both in the copy's configuration
 * (`SKILLS_SOURCE_URL`, `SKILLS_SOURCE_TOKEN`), never in its database nor in
 * a page. The call goes through the guarded outbound fetch: https only, no
 * private address, no redirect followed, the answer bounded in size and time.
 */

const config = require('../../node.config.js');
const {
  guardedFetch,
} = require('../../integration-providers/provider-http.js');

const EXPORT_PATH = '/api/skills-source/export';
// Some sixty items weigh well under a megabyte; ten leave room to grow.
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30 * 1000;

// An error that says why in a word the page translates (`reason`), and in a
// sentence the logs keep (`message`): never the token.
function followError(reason, message) {
  return Object.assign(new Error(message), { reason });
}

function sourceOf() {
  const { url, token } = config.skillsSource || {};
  return url && token ? { url, token } : null;
}

/** Whether this instance is a copy that may follow production. */
const isConfigured = () => !!sourceOf();

/**
 * Production's address, as the page may show it: its origin only.
 *
 * @returns {string|null}
 */
function productionOrigin() {
  const source = sourceOf();
  if (!source) return null;
  try {
    return new URL(source.url).origin;
  } catch (err) {
    return null;
  }
}

// The export route of production, refused unless it is https.
function exportUrlOf(source) {
  let base;
  try {
    base = new URL(source.url);
  } catch (err) {
    throw followError(
      'invalid_address',
      "Production's address is not a valid URL."
    );
  }
  if (base.protocol !== 'https:') {
    throw followError('invalid_address', "Production's address must use https.");
  }
  return new URL(EXPORT_PATH, base.origin).toString();
}

/**
 * Production's answer, read whole. The error says what went wrong, never
 * the token.
 *
 * @returns {Promise<Object>}
 */
async function fetchProductionExport() {
  const source = sourceOf();
  if (!source) {
    throw followError('not_configured', 'This instance follows no production.');
  }
  const url = exportUrlOf(source);
  let response;
  try {
    response = await guardedFetch(url, {
      headers: {
        Authorization: `Bearer ${source.token}`,
        Accept: 'application/json',
      },
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      label: 'Production',
    });
  } catch (err) {
    throw followError('unreachable', err.message);
  }
  if (response.status === 401) {
    throw followError('token_refused', 'Production refused the read token.');
  }
  if (!response.ok) {
    throw followError(
      'production_error',
      `Production answered ${response.status}.`
    );
  }
  try {
    return await response.json();
  } catch (err) {
    throw followError(
      'unreadable',
      'Production answered something that is not JSON.'
    );
  }
}

module.exports = { isConfigured, productionOrigin, fetchProductionExport };
